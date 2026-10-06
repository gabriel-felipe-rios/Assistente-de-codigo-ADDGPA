"""Estado de "arquivos em processamento" (aba Automação → Pendências).

Consolida, num lugar só, o que cada rotina está processando agora e quantos
faltam. Reaproveita os payloads de progresso que as rotinas já emitem
(status/total/processed/current): quem processa arquivo a arquivo chama
`_proc_apply`; quem não tem o que contar entra por `_proc_marcar_rodando`, a
partir do próprio aviso de "running" do ciclo.

⚠️ **A chave é o id da rotina, nunca o rótulo.** Antes eram dois dicionários de
texto solto que precisavam concordar (`_AC_LABEL_PROGRESSO` no ciclo e o
primeiro argumento de `_proc_apply` em cada rotina): bastava um deles mudar para
o sinal de vida sumir sem ninguém perceber. O nome bonito sai de
`PASTAS_DAS_ROTINAS`, que já é o dono dos nomes das rotinas.

⚠️ **E agora, antes do id da rotina, vem o PROJETO.** Com mais de um projeto
aberto ao mesmo tempo na interface, um `agent_id` sozinho não identifica mais
nada: dois projetos podem ter a Doc. Técnica rodando ao mesmo tempo, e um só
apagaria o sinal de vida do outro. Todo estado aqui é indexado primeiro por
`project_name`, depois por `agent_id` — mesmo padrão de `_ac_esperas[project_name]`
(`acionamentos_espera.py`) e `_chat_em_resposta[project_name]`
(`chat_persistencia.py`).

Dois consumidores, e eles pedem coisas diferentes:

  · a aba **Pendências** faz poll de `get_processando` a cada 2 s, e quer o
    andamento;
  · o **ciclo de acionamentos** lê `_proc_ultimo_sinal` para saber que uma
    rotina lenta continua VIVA. Sem essa batida, `_ac_wait_done` desiste dela
    por inatividade e derruba, em silêncio, todas as que vêm depois.

Não empurra nada para o frontend: um `evaluate_js` por arquivo somaria peso ao
fluxo já pesado da regeneração.
"""

import json
import threading
import time

from ..constantes import *


class ProcessandoMixin:
    """O registro de quem está trabalhando agora, e há quanto tempo bateu ponto."""

    # Uma falha aqui já custou caro: o estado nascia pela metade, `_proc_sinal`
    # não existia, todo `_proc_apply` estourava AttributeError dentro de um
    # `except: pass`, e o ciclo desistia de cada rotina lenta aos 5 minutos.
    # Falha de heartbeat não pode ser muda — mas também não pode inundar o
    # console a cada arquivo. Uma vez por motivo, por sessão.
    _PROC_JA_AVISADO = set()

    def _proc_reclamar(self, onde, erro):
        chave = '%s:%s' % (onde, type(erro).__name__)
        if chave in self._PROC_JA_AVISADO:
            return
        self._PROC_JA_AVISADO.add(chave)
        print('[processando] %s falhou: %s: %s' % (onde, type(erro).__name__, erro))

    def _proc_state(self, project_name):
        """Cria o estado do projeto se ainda não existe, e devolve o dicionário vivo.

        ⚠️ A guarda é `project_name in self._proc_sinal` — `_proc_sinal` é o
        ÚLTIMO campo criado, nunca o primeiro. Guardar pelo primeiro é o que
        permitiu o estado nascer pela metade: `api.py` criava `_processando`
        no `__init__`, a guarda via que ele já existia, e os outros campos
        nunca eram criados. Os QUATRO campos — `_processando`, `_proc_sinal`,
        `_proc_fila` e `_proc_threads` — nascem juntos por projeto, aqui e só
        aqui.
        """
        if not hasattr(self, '_proc_sinal'):
            self._processando = {}
            self._proc_sinal = {}
            self._proc_fila = {}
            self._proc_threads = {}
            self._proc_lock = threading.Lock()
        if project_name not in self._proc_sinal:
            self._processando[project_name] = {}
            self._proc_sinal[project_name] = {}
            self._proc_fila[project_name] = []
            self._proc_threads[project_name] = {}
        return self._processando[project_name]

    @staticmethod
    def _proc_nome(agent_id):
        """O nome que a tela mostra. Sai de `PASTAS_DAS_ROTINAS`, e de mais nada."""
        return PASTAS_DAS_ROTINAS.get(agent_id, agent_id)

    # ── Quem conta arquivo ───────────────────────────────────────────────────

    def _proc_apply(self, project_name, agent_id, payload):
        """Atualiza o estado a partir de um payload de progresso de rotina.

        `agent_id` é o id (`'doc-tecnica'`), não o rótulo. Quem chama são as
        rotinas que processam arquivo a arquivo — Documentação Técnica e Resumo
        de Pastas.
        """
        try:
            estado = self._proc_state(project_name)
            status = payload.get('status')
            with self._proc_lock:
                # A batida do coração: a hora do último sinal desta rotina,
                # NESTE projeto, seja ele qual for. É o que `_ac_wait_done` lê.
                self._proc_sinal[project_name][agent_id] = time.monotonic()
                if status == 'running':
                    total = payload.get('total', 0) or 0
                    processados = payload.get('processed', 0) or 0
                    reaproveitados = payload.get('reaproveitados', 0) or 0
                    # ⚠️ O DENOMINADOR VERDADEIRO é `a_processar`: quantos
                    # arquivos vão MESMO ser trabalhados. `total` é quantos
                    # existem, e a maioria costuma ser pulada por hash igual.
                    #
                    # Enquanto `restantes` saía de `total`, esta tela dizia
                    # "faltam 255" com 34 faltando de verdade — a mesma mentira
                    # que a barra do card contava, porque é o MESMO pacote de
                    # progresso que alimenta as duas (ver `_dt_notify`).
                    #
                    # `or total` é o degrau para quem ainda não manda o campo:
                    # as rotinas que não separam as duas contas continuam com o
                    # comportamento de antes, em vez de exibir zero.
                    a_processar = payload.get('a_processar')
                    if a_processar is None:
                        a_processar = total
                    estado[agent_id] = {
                        'id': agent_id,
                        'agente': self._proc_nome(agent_id),
                        'atual': payload.get('current', '') or '',
                        'em_progresso': payload.get('in_progress', []) or [],
                        'processados': processados,
                        'a_processar': a_processar,
                        'reaproveitados': reaproveitados,
                        'total': total,
                        'restantes': max(0, a_processar - processados),
                        'conta': True,
                    }
                else:  # done / error / idle → essa rotina terminou
                    estado.pop(agent_id, None)
        except Exception as e:
            self._proc_reclamar('_proc_apply', e)

    # ── Quem não tem o que contar ────────────────────────────────────────────

    def _proc_marcar_rodando(self, project_name, agent_id):
        """Põe na lista uma rotina que não empurra progresso por arquivo.

        Sem isso a aba Pendências conhecia 3 das rotinas e ficava dizendo
        "nenhum agente processando" com o Glossário rodando na frente do
        usuário. `total: 0` é o combinado de "não sei contar" — a tela mostra
        `—`, e não um `0/0` que parece progresso parado. É a mesma regra que
        `cobertura.py` já segue, e pelo mesmo motivo: medidor zerado por falta
        de dado e medidor zerado de verdade não são a mesma coisa.
        """
        try:
            estado = self._proc_state(project_name)
            with self._proc_lock:
                self._proc_sinal[project_name][agent_id] = time.monotonic()
                # Quem já conta arquivo manda mais informação que isto: não
                # sobrescrever com o registro pobre.
                if estado.get(agent_id, {}).get('conta'):
                    return
                estado[agent_id] = {
                    'id': agent_id,
                    'agente': self._proc_nome(agent_id),
                    'atual': '',
                    'em_progresso': [],
                    'processados': 0,
                    'total': 0,
                    'restantes': 0,
                    'conta': False,
                }
        except Exception as e:
            self._proc_reclamar('_proc_marcar_rodando', e)

    # ── A fila do ciclo: quem ainda vai rodar ────────────────────────────────
    # "Executando" e "Pronto" não davam conta de descrever o meio de um ciclo.
    # Uma rotina que está na fila, esperando a vez (ou esperando um
    # pré-requisito terminar), aparecia na tela como **Pronto** — a mesma
    # palavra de uma rotina que ninguém pediu para rodar. Quem estava olhando
    # um ciclo de quatro horas não tinha como distinguir "vai rodar" de "não
    # vai rodar".
    #
    # A fila é a lista `previstos` que `_ac_run_cycle` já monta para gravar em
    # `Pendências.json`. A diferença é o alcance: aquele arquivo é o registro
    # que sobrevive ao processo morrer, este é o estado ao vivo. Mesma
    # informação, dois prazos.

    def _proc_fila_abrir(self, project_name, agentes):
        """O ciclo vai rodar estes — os que ainda não rodaram estão ESPERANDO."""
        try:
            self._proc_state(project_name)
            with self._proc_lock:
                self._proc_fila[project_name] = list(agentes or [])
        except Exception as e:
            self._proc_reclamar('_proc_fila_abrir', e)

    def _proc_fila_riscar(self, project_name, agent_id):
        """Sai da fila quem rodou — e também quem foi PULADO.

        Pulado não é o mesmo que esperando: uma rotina cujo pré-requisito não
        terminou não vai rodar mais neste ciclo, e deixá-la em âmbar até o fim
        seria prometer um trabalho que já se sabe que não vem.
        """
        try:
            self._proc_state(project_name)
            with self._proc_lock:
                fila = self._proc_fila.get(project_name)
                if fila and agent_id in fila:
                    fila.remove(agent_id)
        except Exception as e:
            self._proc_reclamar('_proc_fila_riscar', e)

    def _proc_fila_esperando(self, project_name):
        """Quem está na fila e NÃO está rodando agora."""
        try:
            estado = self._proc_state(project_name)
            with self._proc_lock:
                fila = list(self._proc_fila.get(project_name) or [])
                rodando = set(estado)
            return [a for a in fila if a not in rodando]
        except Exception as e:
            self._proc_reclamar('_proc_fila_esperando', e)
            return []

    def _proc_marcar_parado(self, project_name, agent_id=None):
        """Tira uma rotina da lista — ou esvazia tudo, quando `agent_id` é None.

        O `None` é o caso do ciclo terminando ('watching' / 'idle'): o que
        estiver sobrando ali não está mais rodando. Sempre restrito ao
        `project_name` pedido — os outros projetos abertos ao mesmo tempo não
        são afetados.
        """
        try:
            estado = self._proc_state(project_name)
            with self._proc_lock:
                if agent_id is None:
                    # `None` é o sinal de FIM DE CICLO, e a fila morre com ele:
                    # sem isto, um ciclo interrompido deixaria rotinas em
                    # "Esperando" para sempre, sem nada que fosse rodar.
                    estado.clear()
                    self._proc_fila[project_name] = []
                else:
                    estado.pop(agent_id, None)
        except Exception as e:
            self._proc_reclamar('_proc_marcar_parado', e)

    # ── A thread da rotina ───────────────────────────────────────────────────
    # Toda rotina roda numa thread própria e devolve `{'success': True}` na hora.
    # A referência dessa thread era jogada fora, e o ciclo passava a ADIVINHAR se
    # ela ainda estava viva — por `_resumo.json` e por mtime de pasta. Adivinhar
    # errado custava caro: aos 5 minutos sem palpite bom o ciclo dava a rotina
    # como travada e abortava tudo o que vinha depois, enquanto ela seguia
    # trabalhando em segundo plano.
    #
    # ⚠️ A thread NÃO pode voltar no `return` das rotinas: aquele dicionário
    # atravessa a ponte do pywebview e vira JSON. Por isso ela fica aqui.

    def _proc_iniciar(self, project_name, agent_id, alvo):
        """Sobe a thread de uma rotina, guarda a referência e ANUNCIA.

        Substitui o `threading.Thread(target=worker, daemon=True).start()` que
        cada rotina escrevia solto.

        ⚠️ O anúncio é a parte nova, e ele existe porque havia dois caminhos
        para a mesma rotina e só um deles falava com a tela:

          · pelo **ciclo** (Ativar tudo / Ativar o principal / Detector) — `_ac_notify`
            registrava em `_processando` e acendia a bolinha;
          · pelo **card da própria rotina** ("▶ Executar") — ninguém registrava
            nada. O Glossário rodava na frente do usuário com a bolinha de
            Acionamentos apagada, o Visualizar dizendo "parado" e Pendências
            dizendo "nenhuma rotina processando".

        Aqui é o gargalo por onde as doze passam, então é aqui que o anúncio
        tem que morar — e não repetido em doze arquivos, que foi o arranjo que
        deixou nove deles de fora.
        """
        self._proc_state(project_name)

        def envelope():
            try:
                alvo()
            finally:
                # `finally`, e não depois do `alvo()`: a rotina pode levantar,
                # e sair da lista é justamente o que precisa acontecer quando
                # ela levanta. Sem isto uma falha deixaria a linha "em
                # processamento" acesa para sempre.
                self._proc_terminou(project_name, agent_id)

        self._proc_comecou(project_name, agent_id)
        # O nome da thread carrega o projeto também: com vários projetos
        # rodando ao mesmo tempo, `rotina:doc-tecnica` sozinho não dizia de qual.
        t = threading.Thread(target=envelope, daemon=True,
                             name='rotina:%s:%s' % (project_name, agent_id))
        with self._proc_lock:
            self._proc_threads[project_name][agent_id] = t
        t.start()
        return t

    # ── O anúncio para a tela ────────────────────────────────────────────────
    # Reaproveita o canal que já existe (`acionamentosEsperaStatus`), que é o
    # mesmo que acende a bolinha de Acionamentos E espelha o estado na sub-aba
    # Visualizar. Um canal, dois consumidores, nenhum código novo do lado do JS.

    def _proc_em_ciclo(self, project_name):
        """Há um ciclo de acionamentos rodando agora?

        Quando há, quem manda na tela é `_ac_notify`: ele já anuncia cada
        rotina ao começar e devolve o status global ao fim. O anúncio daqui
        precisa se calar, ou o fim de UMA rotina seria lido como o fim do
        ciclo inteiro — a faixa do botão pararia de pulsar no meio.

        ⚠️ `project_name` chega até aqui mas `_ac_get_run_lock()` AINDA é um
        lock único, global, não por projeto (ver `acionamentos_espera.py`).
        Torná-lo por-projeto está fora do escopo desta obra — ver o relatório
        final. Por ora esta consulta responde pelo programa inteiro, não só
        por este projeto: com dois projetos rodando ciclo ao mesmo tempo, o
        anúncio de um pode se calar por causa do ciclo do outro.
        """
        try:
            return self._ac_get_run_lock().locked()
        except Exception:
            return False

    def _proc_avisar_tela(self, project_name, status, agent_id=None):
        try:
            payload = json.dumps({'status': status, 'agent': agent_id,
                                  'project': project_name})
            self.window.evaluate_js('acionamentosEsperaStatus(%s)' % payload)
        except Exception as e:
            self._proc_reclamar('_proc_avisar_tela', e)

    def _proc_comecou(self, project_name, agent_id):
        self._proc_marcar_rodando(project_name, agent_id)
        if not self._proc_em_ciclo(project_name):
            self._proc_avisar_tela(project_name, 'running', agent_id)

    def _proc_terminou(self, project_name, agent_id):
        self._proc_marcar_parado(project_name, agent_id)
        if self._proc_em_ciclo(project_name):
            return
        # Só devolve a tela ao repouso quando NENHUMA outra rotina deste
        # projeto ficou de pé: nada impede o usuário de clicar "▶ Executar" em
        # duas rotinas independentes do MESMO projeto, e a primeira a
        # terminar não pode apagar a segunda.
        try:
            estado = self._proc_state(project_name)
            with self._proc_lock:
                sobrou = bool(estado)
        except Exception:
            sobrou = False
        if sobrou:
            return
        # 'watching' e não 'idle' quando o Detector está de pé: dizer "ocioso"
        # com ele vigiando seria mentir sobre o estado do programa.
        vigiando = bool(getattr(self, '_ac_esperas', {}).get(project_name, {}).get('active'))
        self._proc_avisar_tela(project_name, 'watching' if vigiando else 'idle')

    def _proc_thread_viva(self, project_name, agent_id):
        """`True` viva, `False` terminada, `None` = não sei.

        O `None` é uma resposta de primeira classe, e não um "não": rotina que
        roda de forma síncrona (Embedding) ou disparada por outro caminho nunca
        registra thread, e quem espera tem que cair na regra antiga em vez de
        concluir que ela morreu.
        """
        try:
            t = getattr(self, '_proc_threads', {}).get(project_name, {}).get(agent_id)
            return None if t is None else t.is_alive()
        except Exception as e:
            self._proc_reclamar('_proc_thread_viva', e)
            return None

    # ── Leitura ──────────────────────────────────────────────────────────────

    def _proc_ultimo_sinal(self, project_name, agent_id):
        """Quando esta rotina bateu ponto pela última vez (`time.monotonic`).

        `None` quer dizer "nunca bateu nesta sessão" — e quem espera precisa
        tratar isso como "não sei", não como "morreu".

        Sobrevive ao 'done'/'error' de propósito: houve atividade recente mesmo
        depois de a rotina sair de `_processando`.
        """
        try:
            self._proc_state(project_name)
            with self._proc_lock:
                return self._proc_sinal.get(project_name, {}).get(agent_id)
        except Exception as e:
            self._proc_reclamar('_proc_ultimo_sinal', e)
            return None

    def get_processando(self, project_name):
        """Instantâneo do que está rodando agora — e do que vem a seguir.

        Duas listas, e a segunda é nova: `esperando` são as rotinas que o ciclo
        vai rodar e ainda não rodou. É o que a sub-aba Rotinas usa para pintar
        o selo âmbar de "Esperando" no lugar do "Pronto" — que dizia a mesma
        coisa sobre uma rotina na fila e sobre uma que ninguém pediu.

        Filtrado pelo `project_name` pedido: com vários projetos abertos ao
        mesmo tempo, a aba Pendências de um não pode mostrar o que está
        rodando no outro.

        `bloqueado_por_projeto` é a terceira informação, e ela responde uma
        pergunta que as duas listas não respondem: **este projeto tem trabalho
        na mão e está parado esperando OUTRA aba de projeto soltar a janela do
        LM Studio?** Sem ela, um ciclo travado na `TRAVA_IA` fica com as duas
        listas vazias — indistinguível de um projeto sem nada ligado.

        Vem daqui, e não de `get_espera_status`, porque quem pergunta é o poll
        da tira de abas (`_projAbertosConferir`, projetos-abertos.js), que já
        chama este método uma vez por projeto aberto a cada 3s. Buscar em outro
        lugar dobraria as idas ao backend para dar a mesma resposta.
        """
        try:
            estado = self._proc_state(project_name)
            with self._proc_lock:
                snapshot = list(estado.values())
            esperando = [{'id': a, 'agente': self._proc_nome(a)}
                         for a in self._proc_fila_esperando(project_name)]
            return {'success': True, 'processando': snapshot, 'esperando': esperando,
                    'bloqueado_por_projeto': getattr(
                        self, '_ac_espera_trava_dono', {}).get(project_name)}
        except Exception as e:
            self._proc_reclamar('get_processando', e)
            return {'success': False, 'error': str(e)}
