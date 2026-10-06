"""O ciclo completo: hashes → independentes → dependentes, respeitando a cadeia.

É o método que EXECUTA a cadeia que `acionamentos_pipeline.py` declara. Os dois
são arquivos diferentes porque a cadeia é um DADO — ela também vai para a
sub-aba Visualizar, sem rodar nada — e o ciclo é um processo com trava, espera e
interrupção.

⚠️ `CicloInterrompido` NÃO É ERRO DE PROGRAMAÇÃO. É a única saída honesta quando
quem vem depois depende de um resultado que não existe: um agente parou de dar
sinal de vida no meio do ciclo. A cadeia é interrompida SEM fechar a fila de
`Pendências.json`, para o que faltou continuar registrado — fechá-la faria o
trabalho pendente sumir junto com a interrupção.

⚠️ A ORDEM DOS TRÊS PASSOS É A RAZÃO DE O CICLO EXISTIR. Os hashes vêm primeiro
porque tudo depois deles pergunta "o que mudou?"; os independentes vêm antes dos
dependentes porque os segundos leem o que os primeiros escreveram. Um paralelismo
que ignore essa ordem entrega resultado calculado sobre arquivo velho, sem erro
em lugar nenhum.
"""

import json
import time
from datetime import datetime

from ...constantes import *
from ..trava_ia import TRAVA_IA, DONO_ROTINAS


class CicloInterrompido(Exception):
    """Um agente parou de dar sinal de vida no meio do ciclo.

    Não é erro de programação: é a única saída honesta quando quem vem depois
    depende de um resultado que não existe. Quem levanta é `executar()`, quem
    trata é `_ac_run_cycle` — que interrompe a cadeia SEM fechar a fila de
    `Pendências.json`, para o que faltou continuar registrado.

    ⚠️ A exceção à regra (D28 b): a rotina cuja thread JÁ MORREU sem gravar o
    resumo e de quem NINGUÉM depende neste ciclo não levanta isto — ela é
    marcada como erro, sai da fila e o ciclo segue (ver
    `_ac_pode_seguir_sem`). Thread viva, "não sei" e aba fechada continuam
    interrompendo.
    """



class AcionamentosPipelineCicloMixin:

    def _ac_run_cycle(self, project_name, settings, require_espera=True, caminhos=None,
                      grupos=None, rodar_hashes=True, origem='manual'):
        """Executa os agentes ligados, respeitando a ordem de dependência.

        A ordem importa: quem consome o resultado de outro só pode rodar depois
        que ele terminou. A Doc Técnica consulta os hashes para
        pular arquivo inalterado, então a BASE (Detector → Hashes → Sincronia)
        vem primeiro de tudo — sem isso ela reprocessaria o projeto inteiro a
        cada ciclo.

        `require_espera=False` deixa o ciclo rodar sem o Detector de pé — é o
        que os botões de partida usam. Quando é a Espera que dispara, o padrão
        True mantém o comportamento de abortar no meio caso a vigilância seja
        desligada durante a execução.

        `caminhos` são os arquivos que quem disparou já sabe que mudaram. O
        Detector classifica só esses e o Hashes relê só esses, em vez de
        varrer o projeto inteiro. Sem a lista (botão manual), varre tudo.

        `grupos` limita o ciclo a um dos tempos de espera (T1/T2/T3). É a
        Espera que usa: uma mudança arma os três cronômetros, e cada um dispara
        o seu grupo quando vence. `None` roda os três de uma vez — é o que o
        botão manual e os dois botões de partida fazem.

        Um agente que passa o tempo limite SEM DAR SINAL DE VIDA interrompe o
        ciclo inteiro (ver `executar` e `_ac_wait_done`), e a fila de
        `Pendências.json` não é fechada — o que faltou fica registrado lá.
        A exceção: se a thread dele já morreu e nenhuma rotina seguinte depende
        dele, ele fica como erro e o ciclo SEGUE (`_ac_pode_seguir_sem`) — mas
        termina devolvendo `False`, porque não completou.

        `rodar_hashes=False` pula A BASE INTEIRA. A Espera usa isso nos ciclos
        T2 e T3: o T1 já detectou, já regravou a linha de base e já sincronizou
        nesta mesma leva de mudanças, e refazer tudo não acrescenta nada.

        **Devolve `True` só se o ciclo chegou ao fim.** Não é detalhe: quem
        chama usa isso para decidir se pode regravar a LINHA DE BASE do
        Hashes. Regravá-la depois de um ciclo interrompido é a armadilha
        silenciosa deste programa — a base passa a dizer "nada mudou" sobre
        arquivos que nunca foram processados, e eles ficam com o `.md` velho
        para sempre, sem ninguém perceber. Arquivo SEM saída ainda é
        regenerado (as rotinas checam `os.path.isfile` do destino); o que se
        perde para sempre é o arquivo que mudou e cujo `.md` antigo existe.
        """
        model = self._ac_get_current_model()

        # A primeira linha do ciclo no `Histórico.jsonl`. `origem` é QUAL botão
        # (ou qual cronômetro da Espera) mandou — sem ela, dois ciclos seguidos
        # ficam indistinguíveis na tela, e "por que isto rodou?" volta a não ter
        # resposta.
        self._hist_ciclo(project_name, origem, grupos, caminhos)

        # Precisa ser calculado AGORA, antes de qualquer coisa — em especial
        # antes do passo da BASE logo abaixo, em que o Hashes regrava a linha
        # de base. Depois dele, comparar de novo contra a base compararia o
        # estado atual com ele mesmo e sempre daria "nada mudou": a Doc
        # Técnica pularia TODO arquivo em silêncio, sem chamar o LM
        # Studio nem gerar nada — era exatamente esse o bug (ciclo "concluía"
        # na hora, zero requisição).
        #
        # `caminhos` (da Espera, alimentada pelo Detector) já é a lista
        # verdadeira do que mudou — usa direto, sem tocar em hash. Sem ela (botão manual/'Início
        # rápido'/'Iniciar'), a única leitura confiável é ESTA, feita antes do
        # Hashes sobrescrever a base; `None` (sem base salva ainda) significa
        # "processa tudo", igual ao comportamento de sempre.
        if caminhos is not None:
            mudados_pre = set(caminhos)
        else:
            diff = self.get_arquivos_mudados(project_name)
            mudados_pre = (set(diff.get('mudados') or [])
                           if diff.get('success') and diff.get('baseline') else None)

        # ── O FILTRO DO DETECTOR ──────────────────────────────────────────
        #
        # Até a Etapa 2 o campo `acorda` do `mudanças.json` era gravado e nunca
        # lido: toda mudança acordava as cinco rotinas caras, e "Ativar tudo"
        # com o projeto inteiro já gerado ainda mandava o Pipeline para o LM
        # Studio — ele é a única das cinco sem portão incremental próprio.
        #
        # ⚠️ A regra de quando NÃO filtrar mora em `_det_filtro_do_ciclo`, e é a
        # mesma que a linha acima usa para `mudados_pre`: as duas respondem
        # "existe uma lista confiável do que mudou?". `None` de lá significa
        # "não filtre nada", e é o que salva o "Iniciar" de um projeto novo.
        #
        # ⚠️⚠️ **NASCE VAZIO E SÓ É PREENCHIDO DEPOIS DA BASE.** Ler o
        # `mudanças.json` aqui é ler a decisão do Detector ANTES DE O DETECTOR
        # RODAR — ele roda no bloco da BASE, umas cem linhas abaixo, e é lá que
        # o `acorda_pendente` desta leva é escrito. Ver o comentário grande no
        # ponto em que o filtro é calculado de verdade.
        dispensados = set()

        dispatch = self._ac_dispatch(project_name, model, mudados_pre=mudados_pre)
        rodou = {}
        # Dispensado NÃO é o mesmo que "não rodou": ver o cálculo de `faltando`.
        dispensou = {}
        # Quem caiu com a thread morta e sem dependente, e o ciclo seguiu sem
        # ele. Não entra em `rodou` (não terminou) e continua devendo em
        # `Pendências.json`; no fim, faz o ciclo devolver `False`.
        falharam = []
        # Quem foi pulado por falta de modelo. Também faz o ciclo devolver
        # `False` — ver o comentário no ponto em que se pula.
        sem_modelo = []
        motivo_sem_modelo = None
        grupos_ativos = set(grupos) if grupos else set(self._AC_ORDEM_GRUPOS)

        def ativo(agent_id):
            return settings.get(agent_id, 'off') != 'off'

        def neste_ciclo(agent_id):
            return self._ac_grupo_do_agente(agent_id) in grupos_ativos

        # Fila persistida: escrita ANTES de qualquer agente rodar. Se o processo
        # morrer no meio, é ela que diz o que faltava — ver rotinas_pendencias.py.
        #
        # ⚠️ **SEM O FILTRO, e isto é deliberado.** Neste ponto do ciclo ainda
        # não se SABE quem será dispensado — quem decide é o Detector, que só
        # roda no bloco da base logo abaixo. A fila tem que ser PESSIMISTA:
        # listar demais é seguro (quem for dispensado sai da lista na hora, ver
        # o ramo `dispensados` de `executar`), listar de menos é perder o
        # registro de trabalho que ficou faltando — que é a única coisa que este
        # arquivo existe para guardar.
        previstos = [a for a in dispatch if ativo(a) and neste_ciclo(a)]
        if rodar_hashes:
            # A base abre a fila, na ordem em que roda. Nenhuma das três tem
            # chave, então nenhuma entra pelo `ativo()` acima — e sem esta linha
            # elas trabalhariam sem nunca aparecer na tela nem no
            # `Pendências.json`.
            previstos = list(self._AC_BASE) + [a for a in previstos
                                               if a not in self._AC_BASE]
        # ⚠️ Sem `caminhos` (botão de partida), grava a lista de `mudados_pre`.
        # A retomada relê esta lista; vazia, ela recalcularia o que mudou
        # contra a linha de base — que o Hashes da base, logo abaixo, regrava
        # ANTES das rotinas caras. Um arquivo alterado que ficou sem
        # documentação sumia da retomada, e o `.md` velho ficava para sempre.
        self._rp_pend_abrir(project_name, previstos, grupos=grupos_ativos,
                            caminhos=(caminhos if caminhos is not None
                                      else sorted(mudados_pre or ())))
        # A MESMA lista, ao vivo: é o que faz a sub-aba Rotinas mostrar
        # "Esperando" em quem ainda não chegou a vez. O arquivo é o registro
        # que sobrevive ao processo morrer; este é o estado da sessão.
        self._proc_fila_abrir(project_name, previstos)

        def executar(agent_id, requisitos=()):
            nonlocal motivo_sem_modelo
            if not ativo(agent_id) or not neste_ciclo(agent_id):
                return False
            # O quinto portão. Como os outros quatro, ele AVISA — pular em
            # silêncio é o defeito que esta função inteira existe para não
            # repetir, e uma rotina cara que some sem explicação é pior do que
            # uma que roda à toa.
            if agent_id in dispensados:
                self._ac_notify_agent_pulado(
                    project_name, agent_id,
                    motivo='o Detector não viu nada que peça esta rotina',
                    dispensado=True)
                dispensou[agent_id] = True
                # ⚠️ Sai da fila PERSISTIDA também, e não só da fila viva que o
                # `_ac_notify_agent_pulado` risca. Desde que `previstos` deixou
                # de ser filtrado, a dispensada ENTRA no `Pendências.json`; sem
                # esta linha ela ficaria pendurada como pendente e a faixa de
                # retomada ofereceria rerodá-la a cada abertura do projeto, para
                # sempre — prometendo trabalho que o Detector já disse que não há.
                self._rp_pend_riscar(project_name, agent_id, None)
                return False
            # Requisito de OUTRO grupo não é cobrado: ele não ia ser atualizado
            # neste ciclo de qualquer forma, e cobrar travaria a cadeia para
            # sempre (Pipeline é T2 e depende do Grafo de imports, que é T1).
            # ⚠️ DISPENSADO CONTA COMO SATISFEITO. O Resumo de Pastas exige a
            # Doc. Técnica; com ela dispensada pelo Detector, sem esta condição
            # ele ficaria eternamente "esperando a Doc. Técnica" — e nunca rodaria.
            faltando = [r for r in requisitos if neste_ciclo(r)
                        and not rodou.get(r) and not dispensou.get(r)]
            if faltando:
                # Antes este `return` era mudo, e era por isso que "não saiu o
                # Glossário" não tinha explicação em lugar nenhum: a tela
                # simplesmente não reagia. Agora o card diz de quem ele estava
                # esperando.
                self._ac_notify_agent_pulado(project_name, agent_id, faltando[0])
                return False
            # Os dois casos abaixo eram `return False` mudos. O primeiro é o
            # pior defeito de silêncio do ciclo: sem modelo carregado no LM
            # Studio, TODAS as rotinas de LLM eram puladas sem uma palavra, e o
            # ciclo terminava com cara de sucesso. `_ac_run_single` já avisava
            # nesse caso; o ciclo, não.
            #
            # ⚠️ E pular não basta: a rotina entra em `sem_modelo`, e o ciclo
            # termina INCOMPLETO. Enquanto terminava "completou", a Espera
            # descartava os caminhos que tinha segurado e o arquivo salvo
            # nunca mais era processado. Incompleto, ela os guarda e tenta de
            # novo a cada `_AC_ESPERA_REPETIR` — e processa sozinha assim que
            # o servidor do LM Studio voltar.
            if agent_id not in self._AC_SEM_MODELO and not model:
                if motivo_sem_modelo is None:
                    motivo_sem_modelo = self._ac_motivo_sem_modelo()
                self._ac_notify_agent_pulado(
                    project_name, agent_id, motivo=motivo_sem_modelo)
                sem_modelo.append(agent_id)
                return False
            if require_espera and not self._ac_esperas.get(project_name, {}).get('active', False):
                self._ac_notify_agent_pulado(
                    project_name, agent_id,
                    motivo='o Detector foi desligado durante o ciclo')
                return False
            # O carimbo de ANTES, não a hora de agora — ver `_ac_resumo_mudou`.
            inicio = self._ac_get_resumo_time(project_name, agent_id)
            self._ac_notify(project_name, 'running', agent_id)
            dispatch[agent_id]()
            concluiu = self._ac_wait_done(project_name, agent_id, inicio, require_espera=require_espera)
            if not concluiu:
                # Chegar aqui significa agente TRAVADO, não agente lento: o
                # prazo conta inatividade (ver `_ac_wait_done`), então ele
                # passou minutos inteiros sem processar nada. A thread pode
                # continuar viva em segundo plano, e é justamente por isso que
                # o ciclo para: seguir em frente dispararia o próximo agente
                # por cima de um que ainda está de pé — foi assim que o Espelho
                # (retirado em 2026-09) e a Doc. Técnica disputaram o mesmo LM
                # Studio por horas.
                #
                # A exceção (D28 b): thread JÁ MORTA e ninguém dependendo dela.
                # Aí o risco acima não existe, e cortar derrubava dez rotinas
                # por causa de uma que nada exige — o Identificadores num
                # projeto TypeScript. Ela sai da fila, fica como erro e SEM
                # `rodou` nem `_rp_pend_riscar`: continua devendo.
                if self._ac_pode_seguir_sem(project_name, agent_id, ativo,
                                            neste_ciclo, require_espera):
                    self._ac_notify_agent_done(
                        project_name, agent_id, None,
                        'parou sem gravar o resumo — a thread morreu; '
                        'as rotinas seguintes continuaram')
                    self._proc_fila_riscar(project_name, agent_id)
                    self._proc_marcar_parado(project_name, agent_id)
                    falharam.append(agent_id)
                    return False
                self._ac_notify_agent_done(
                    project_name, agent_id, None,
                    'Sem sinal de vida — ciclo interrompido a partir daqui')
                raise CicloInterrompido(agent_id)
            rodou[agent_id] = True
            self._proc_fila_riscar(project_name, agent_id)
            # ⚠️ Sair da FILA não é sair da lista de EM EXECUÇÃO — são duas
            # listas, e até 22/08/2026 o ciclo só riscava a primeira.
            #
            # Quem tira da segunda é `_proc_terminou`, chamado pelo wrapper
            # `_proc_iniciar`. Treze rotinas passam por ele e se limpam sozinhas;
            # o **Embedding não**, porque roda de forma síncrona e nunca registra
            # thread (ver `_proc_thread_viva`). Resultado: ele terminava, o disco
            # já dizia "Concluído", e `get_processando` seguia dizendo "running"
            # até o fim do ciclo INTEIRO — quando o `_proc_marcar_parado(project_name)`
            # sem `agent_id` finalmente esvazia tudo. Nesse intervalo a tela recebia
            # duas respostas contrárias sobre a mesma rotina, e o selo oscilava.
            #
            # Aqui é o ponto certo para fechar: é o único lugar que sabe que ESTA
            # rotina acabou de terminar, independentemente do caminho que ela
            # usou para rodar. Idempotente — `estado.pop(agent_id, None)` não
            # reclama de quem já saiu por `_proc_terminou`.
            self._proc_marcar_parado(project_name, agent_id)
            self._rp_pend_riscar(project_name, agent_id,
                                 self._ac_saldo_da_rotina(project_name, agent_id))
            # Mesmo aviso que a execução manual emite — é o que pinta o nó de
            # verde na sub-aba Visualizar e atualiza o "última:".
            t = self._ac_get_resumo_time(project_name, agent_id)
            self._ac_notify_agent_done(project_name, agent_id,
                                       t.isoformat() if t else None, None)
            # ⚠️ A dívida é paga AQUI, e não na entrada. Riscar antes faria a
            # mudança sumir sem nunca ter sido processada quando o ciclo fosse
            # interrompido no meio — é a mesma regra da linha de base do Hashes
            # e da lista de caminhos da Espera, pelo mesmo motivo.
            if agent_id in self._DET_ROTINAS_CARAS:
                self._det_riscar(project_name, agent_id)
            return True

        # ── A BASE ────────────────────────────────────────────────────────
        #
        # As três rodam por fora do laço, sempre, e nesta ordem — que não é
        # cronológica por acaso:
        #
        #   1. **Detector** — vê o que mudou e decide quem isso merece. Vem
        #      antes de tudo porque é ele que produz a lista, e porque a
        #      detecção de mover/renomear depende de comparar com a linha de
        #      base do Hashes ANTES de ela ser regravada. Depois do Hashes não
        #      há mais como saber o que sumiu nem para onde foi.
        #   2. **Hashes** — regrava a linha de base. É o que permite os demais
        #      pularem o inalterado.
        #   3. **Sincronia** — move e apaga as saídas do que mudou de lugar,
        #      sem chamar o modelo. Antes da Doc. Técnica, senão
        #      ela regeraria com LLM o que era só para ser movido.
        #
        # ⚠️ NENHUMA DAS TRÊS É COBRADA POR `ativo()`, e é essa a mudança que
        # mais fácil se desfaz sem querer. Enquanto a Sincronia tinha chave,
        # esta etapa vinha embrulhada num `if ativo('sincronia')` — com a chave
        # extinta, aquela condição passaria a ser False para sempre e a
        # detecção de mover/renomear morreria em silêncio, reprocessando o
        # projeto inteiro com LLM a cada pasta que o usuário arrastasse.
        #
        # `rodar_hashes=False` (os ciclos T2 e T3) pula a base inteira: o T1
        # acabou de rodá-la nesta mesma leva de mudanças.
        if rodar_hashes:
            for agent_id in self._AC_BASE:
                if not self._ac_rodar_da_base(project_name, agent_id, caminhos,
                                              require_espera):
                    self._hist_fim(project_name, False, agent_id)
                    return False
                rodou[agent_id] = True
        else:
            for agent_id in self._AC_BASE:
                rodou[agent_id] = True

        # ── O FILTRO DO DETECTOR ──────────────────────────────────────────
        #
        # ⚠️ **AQUI, e não lá em cima antes da base.** É o Detector quem escreve
        # o `acorda_pendente`, e ele acabou de rodar duas linhas acima — dentro
        # DESTE ciclo. Enquanto o filtro era calculado antes do bloco da base,
        # ele lia a decisão do Detector do ciclo ANTERIOR, e depois de um ciclo
        # completo o `_det_riscar` deixa essa dívida VAZIA. O efeito era este:
        #
        #   1. o filtro lia dívida vazia  → dispensava as cinco rotinas caras;
        #   2. o Detector rodava e anotava a dívida certa;
        #   3. o laço dispensava assim mesmo, com a lista do passo 1.
        #
        # Ou seja: alterar um arquivo, clicar em **Iniciar** e receber "concluído"
        # sem um único `.md` atualizado. Clicar de novo funcionava — a dívida do
        # ciclo anterior finalmente estava no disco.
        #
        # ⚠️ O caminho da ESPERA nunca sofreu disso, e é por isso que passou
        # despercebido: lá o Detector roda no T1 e as rotinas caras são T2 e T3,
        # ciclos separados, que releem o arquivo já escrito. Só quebra quando os
        # três grupos rodam no MESMO ciclo — que é exatamente o que os três
        # botões de partida fazem (`grupos=None`).
        #
        # Com `rodar_hashes=False` (T2/T3) a base não rodou e esta leitura
        # devolve o mesmo que devolveria antes — inofensiva.
        #
        # Até a Etapa 2 o campo `acorda` era gravado e nunca lido: toda mudança
        # acordava as cinco, e "Ativar tudo" com o projeto inteiro já gerado
        # ainda mandava o Pipeline para o LM Studio — ele é a única das cinco sem
        # portão incremental próprio.
        dispensados = self._det_filtro_do_ciclo(project_name, mudados_pre) or set()

        # ── O CICLO ───────────────────────────────────────────────────────
        #
        # O resto, na ordem e com os pré-requisitos de `_AC_REQUISITOS`, lá em
        # cima — a mesma tabela que a sub-aba Visualizar desenha. Antes esta
        # sequência era escrita à mão aqui, e de novo (diferente) no frontend.
        #
        # Detector e Sincronia abrem a tabela e já rodaram acima; `executar()`
        # passa por elas sem fazer nada, porque nenhuma das duas tem chave
        # ligada. Ninguém as tem como requisito.
        #
        # Daqui até o fim da cadeia, um agente travado interrompe o ciclo (ver
        # `executar`). A fila de `Pendências.json` fica ABERTA de propósito
        # nesse caso: é ela que guarda o que faltou.
        ordem_do_ciclo = list(self._AC_REQUISITOS.items())
        parou_em = None
        try:
            for posicao, (agent_id, requisitos) in enumerate(ordem_do_ciclo):
                # A aba deste projeto foi fechada no meio do ciclo. Para ENTRE
                # rotinas — nunca no meio de uma —, e o que faltou fica em
                # `Pendências.json` pelo mesmo caminho de um agente travado.
                # Ver `agentes/parada_do_projeto.py`.
                # E "Desativar tudo" no meio do ciclo (D15): mesma parada.
                if self.projeto_parado(project_name) or self.rotina_parada(project_name, '*'):
                    raise CicloInterrompido(agent_id)
                if agent_id in self._AC_REQUISITOS_SO_LIGADOS:
                    requisitos = tuple(r for r in requisitos if ativo(r))
                executar(agent_id, requisitos=requisitos)
        except CicloInterrompido as parada:
            # Quem vinha DEPOIS nem chegou a ser chamado, e ninguém ficava
            # sabendo: `executar` nem rodava para elas, então não havia aviso
            # nenhum. Era metade da sensação de 'rodou uns e faltou outros'.
            parou_em = str(parada)
            # Registra no disco onde parou: é o que a faixa de retomada lê ao
            # abrir a aba. Deduzir por quem sobrou em `pendentes` não servia —
            # aquela lista está na ordem do dispatch, não na da execução.
            #
            # ⚠️ O MOTIVO PRECISA SER O VERDADEIRO. São duas causas bem
            # diferentes para a mesma exceção: o agente travou, ou o usuário
            # fechou a aba do projeto. Escrever "parou de dar sinal de vida"
            # num ciclo que o próprio usuário mandou parar mandaria ele caçar
            # um defeito que não existe.
            if self.projeto_parado(project_name):
                motivo = 'a aba do projeto foi fechada'
            elif self.rotina_parada(project_name, '*'):
                motivo = 'a Automação foi desativada'
            else:
                motivo = 'parou de dar sinal de vida'
            self._rp_pend_travou(project_name, parou_em, motivo)
            for pendente, _req in ordem_do_ciclo[posicao + 1:]:
                if ativo(pendente) and neste_ciclo(pendente):
                    self._ac_notify_agent_pulado(project_name, pendente,
                                                 requisito_id=parou_em)
            self._hist_fim(project_name, False, parou_em)
            return False

        # Chegou até aqui: a fila do ciclo pode ser fechada. Se o processo tiver
        # morrido antes desta linha, `pendentes` fica no disco e a abertura do
        # projeto retoma o que faltava.
        #
        # ⚠️ Com rotina que FALHOU e o ciclo seguiu (`falharam`), o fim NÃO
        # finge sucesso: `True` autoriza quem chamou a regravar a linha de base
        # do Hashes (`acionamentos_espera.py`), e a rotina que falhou perderia a
        # dívida para sempre. `_rp_pend_fechar` não zera `pendentes`, então a
        # falhada continua lá e a faixa de retomada a oferece.
        if falharam:
            self._rp_pend_travou(
                project_name, falharam[0],
                'falhou sem gravar o resumo; as rotinas seguintes continuaram')
        elif sem_modelo:
            self._rp_pend_travou(project_name, sem_modelo[0], motivo_sem_modelo)
        self._rp_pend_fechar(project_name)

        # Só afirma 'watching' quando é a Espera que está no comando; nos
        # outros casos quem decide o estado final é _ac_restore_global_status.
        if require_espera:
            self._ac_notify(project_name, 'watching')
        if falharam or sem_modelo:
            self._hist_fim(project_name, False, (falharam or sem_modelo)[0])
            return False
        self._hist_fim(project_name, True)
        return True

    def _ac_pode_seguir_sem(self, project_name, agent_id, ativo, neste_ciclo,
                            require_espera):
        """O ciclo pode seguir sem `agent_id`, que acabou de falhar? (D28 b)

        Só quando as três condições valem — qualquer dúvida corta como antes:

        1. a thread dele existe e JÁ MORREU (`None` = não sei → corta);
        2. o `False` da espera não veio de outro motivo: aba do projeto
           fechada, ou a Espera desligada num ciclo que a exige;
        3. nenhuma rotina posterior, ativa e deste ciclo, o tem como requisito
           — com o mesmo filtro de `_AC_REQUISITOS_SO_LIGADOS` que o laço usa.

        `ativo` e `neste_ciclo` são as funções do próprio `_ac_run_cycle`.
        """
        if self._proc_thread_viva(project_name, agent_id) is not False:
            return False
        if self.projeto_parado(project_name):
            return False
        if require_espera and not getattr(self, '_ac_esperas', {}).get(
                project_name, {}).get('active', False):
            return False
        ordem = list(self._AC_REQUISITOS.items())
        posicao = next((i for i, (aid, _r) in enumerate(ordem) if aid == agent_id), None)
        if posicao is None:
            return False
        for aid, reqs in ordem[posicao + 1:]:
            if not ativo(aid) or not neste_ciclo(aid):
                continue
            if aid in self._AC_REQUISITOS_SO_LIGADOS:
                reqs = tuple(r for r in reqs if ativo(r))
            if agent_id in reqs:
                return False
        return True
