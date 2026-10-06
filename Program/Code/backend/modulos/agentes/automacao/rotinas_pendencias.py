"""Fila persistida do ciclo de acionamentos — `Pendências.json`.

O problema que ela resolve: se o ciclo morre no meio, o que estava pendente se
perde. O programa se recupera por acaso — no ciclo seguinte o hash mostra que o
arquivo continua diferente. Mas isso só funciona porque a linha de base é
gravada *depois* de tudo; se um agente gravou a saída e o processo morreu antes
da linha de base, **o trabalho pendente é esquecido em silêncio**.

Um arquivo por projeto, em `Automação/Rotinas/`, ao lado do `Configuração.json`:
  - **escrito** ao entrar no ciclo, com os agentes que vão rodar;
  - **riscado** conforme cada agente termina, com o saldo dele;
  - **lido** ao abrir a aba Automação, para a faixa de retomada aparecer.

⚠️ **A lista de mover/renomear/apagar NÃO mora mais aqui.** Ela passou a ser
do Detector, em `Automação/Rotinas/Detector/mudanças.json` — havia duas listas
da mesma coisa, e agora é um dado, um lugar. Este módulo continua servindo
`_rp_pend_tomar_sincronia` para não obrigar o agente Sincronia a saber onde a
lista mora, mas quem responde é o Detector.

⚠️ Até 21/08/2026 este arquivo era **escrito e nunca lido**:
`get_rotinas_pendencias` e `retomar_rotinas_pendencias` não tinham um único
chamador em todo o `Program/`. O registro do que faltou existia, completo, no
disco — e não havia nada na tela que o mostrasse.

⚠️ A retomada é por **botão**, nunca automática. Está decidido desde 20/08/2026:
nada que chame o LM Studio recomeça sozinho ao abrir o projeto. A faixa avisa; o
usuário clica.

⚠️ A aba **Pendências** (`agentes/processando.py`) mostra outra coisa: arquivos
em processamento AGORA, em memória. A colisão de termo é conhecida e aceita.
"""

from ...constantes import *


class RotinasPendenciasMixin:

    def _rp_pend_path(self, project_name):
        return obter_arquivo_de_pendencias_das_rotinas(project_name)

    def _rp_pend_vazio(self):
        # Sem a chave `sincronia`: ela mudou de dono para o `mudanças.json` do
        # Detector. Um `Pendências.json` antigo que ainda a traga é ignorado
        # por `_rp_pend_load`, que só copia as chaves que existem aqui.
        return {'iniciado_em': None, 'finalizado_em': None, 'grupos': [],
                'caminhos': [], 'pendentes': [], 'concluidos': [],
                'parou_em': None, 'motivo': None, 'saldo': {}}

    def _rp_pend_load(self, project_name):
        try:
            with open(self._rp_pend_path(project_name), 'r', encoding='utf-8') as f:
                dados = json.load(f)
            if isinstance(dados, dict):
                base = self._rp_pend_vazio()
                base.update({k: v for k, v in dados.items() if k in base})
                return base
        except Exception:
            pass
        return self._rp_pend_vazio()

    def _rp_pend_save(self, project_name, dados):
        """Grava a fila. Falha de escrita é RECLAMADA, não engolida.

        Uma fila que não consegue gravar é uma fila que não existe — e o silêncio
        aqui apagava exatamente a informação que este arquivo serve para guardar.
        """
        try:
            caminho = self._rp_pend_path(project_name)
            os.makedirs(os.path.dirname(caminho), exist_ok=True)
            with open(caminho, 'w', encoding='utf-8') as f:
                json.dump(dados, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print('[pendencias] nao consegui gravar a fila de %s: %s: %s'
                  % (project_name, type(e).__name__, e))
            return False

    # ── Ciclo de vida ────────────────────────────────────────────────────────

    def _rp_pend_abrir(self, project_name, agentes, grupos=None, caminhos=None):
        """Abre a fila ao ENTRAR no ciclo, antes de qualquer agente rodar.

        Escrever antes é o ponto: um arquivo gravado depois só registraria o que
        já deu certo, que é exatamente o que não se perde.
        """
        dados = {
            'iniciado_em': datetime.now().isoformat(),
            'finalizado_em': None,
            'grupos': sorted(grupos) if grupos else [],
            'caminhos': list(caminhos or []),
            'pendentes': list(agentes),
            'concluidos': [],
            'parou_em': None,
            'motivo': None,
            'saldo': {},
        }
        self._rp_pend_save(project_name, dados)
        return dados

    def _rp_pend_riscar(self, project_name, agent_id, saldo=None):
        """Risca um agente da fila assim que ele termina, com o saldo dele.

        O saldo (`processados` de `total`, e quantos deram erro) é o que permite
        a faixa dizer "a Doc. Técnica terminou com 4 erros" em vez de só "terminou" —
        a diferença entre as duas foi metade da sensação de que o programa
        estava mentindo sobre ter concluído.
        """
        dados = self._rp_pend_load(project_name)
        if agent_id in dados['pendentes']:
            dados['pendentes'].remove(agent_id)
        if agent_id not in dados['concluidos']:
            dados['concluidos'].append(agent_id)
        if saldo:
            dados['saldo'][agent_id] = saldo
        self._rp_pend_save(project_name, dados)

    def _rp_pend_travou(self, project_name, agent_id, motivo=None):
        """Marca ONDE o ciclo parou, para a faixa de retomada saber o que dizer.

        Antes dava para deduzir olhando quem sobrou em `pendentes`, mas dedução
        não é registro: a ordem de `pendentes` é a do dispatch, não a da
        execução, e o primeiro da lista nem sempre era o que travou.
        """
        dados = self._rp_pend_load(project_name)
        dados['parou_em'] = agent_id
        dados['motivo'] = motivo or 'a rotina parou de dar sinal de vida'
        self._rp_pend_save(project_name, dados)

    def _rp_pend_fechar(self, project_name):
        """Fecha a fila ao fim de um ciclo que chegou até o final.

        Fechar NÃO é zerar `pendentes`. Chegar ao fim do ciclo não quer dizer
        que todo mundo rodou: quem foi pulado por pré-requisito que não
        terminou continua devendo, e zerar a lista apagava exatamente a
        informação que este arquivo existe para guardar — foi assim que um
        ciclo terminou com `pendentes: []` e quatro rotinas sem sair.

        Só sai da lista quem `_rp_pend_riscar` riscou. O arquivo continua
        sendo o registro do último ciclo.
        """
        dados = self._rp_pend_load(project_name)
        dados['finalizado_em'] = datetime.now().isoformat()
        self._rp_pend_save(project_name, dados)

    # ── Retomada ─────────────────────────────────────────────────────────────

    def get_rotinas_pendencias(self, project_name):
        """O que ficou pendente do último ciclo. Lido ao abrir a aba Automação.

        `tem_pendencia` é o que acende a faixa. Ela só aparece quando há mesmo o
        que retomar — um ciclo que terminou inteiro devolve `pendentes: []` e a
        aba fica como sempre foi.
        """
        dados = self._rp_pend_load(project_name)
        pendentes = dados.get('pendentes') or []
        # A fila da Sincronia entra na conta, mas vem do Detector — ver o aviso
        # no topo do módulo.
        try:
            sincronia = self._det_ler(project_name).get('sincronia') or []
        except Exception:
            sincronia = []
        return {
            'success': True,
            'pendencias': dados,
            'tem_pendencia': bool(pendentes or sincronia),
            'pendentes': pendentes,
            'quantos': len(pendentes),
            # Nomes ficam com o frontend, que já tem a tabela id→nome. Duplicá-la
            # aqui criaria duas listas de nomes para manter em dia.
            'parou_em': dados.get('parou_em'),
            'motivo': dados.get('motivo'),
            'iniciado_em': dados.get('iniciado_em'),
            'finalizado_em': dados.get('finalizado_em'),
        }

    def retomar_rotinas_pendencias(self, project_name):
        """Roda de novo só o que ficou pendente, com os caminhos daquele ciclo.

        Não recomeça o ciclo inteiro: os agentes já concluídos ficam de fora, e
        é para isso que a lista de `concluidos` existe.
        """
        try:
            dados = self._rp_pend_load(project_name)
            if not dados['pendentes']:
                return {'success': True, 'retomado': False}
            grupos = set(dados['grupos']) or None
            aviso = self._ac_run_cycle_now(project_name, grupos=grupos,
                                           caminhos=dados['caminhos'] or None,
                                           origem='retomada')
            # ⚠️ `aviso` NÃO quer mais dizer "não retomou". Desde que
            # `_ac_run_cycle_now` passou a ENFILEIRAR em vez de recusar, ele
            # quer dizer "não começou AGORA — está na fila", e a retomada vai
            # acontecer sozinha quando a vez chegar. Devolver `retomado: False`
            # aqui faria a tela dizer que nada foi feito, e o ciclo apareceria
            # do nada minutos depois.
            #
            # A exceção é a recusa que sobrou: este projeto já ter um ciclo na
            # fila. Aí não há retomada nova mesmo — a que existe dá conta.
            if aviso and 'já tem um ciclo' in aviso:
                return {'success': True, 'retomado': False, 'aviso': aviso}
            return {'success': True, 'retomado': True, 'aviso': aviso,
                    'agentes': list(dados['pendentes'])}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Fila do Sincronia ────────────────────────────────────────────────────

    def _rp_pend_tomar_sincronia(self, project_name):
        """Retira e devolve as operações pendentes do Sincronia.

        O nome fica, o dono mudou: quem guarda a lista agora é o Detector, no
        `mudanças.json`. Este repasse existe para o agente Sincronia continuar
        chamando um método só, sem precisar saber onde a fila mora — e para o
        dia em que ela mudar de lugar de novo mexer num arquivo só.
        """
        return self._det_tomar_sincronia(project_name)
