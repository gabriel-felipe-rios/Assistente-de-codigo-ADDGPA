"""Disparar um agente: o mapa de execução, o botão manual, e os dois avisos.

⚠️ `_ac_dispatch` É UM LUGAR SÓ, usado pelo botão manual E pelo ciclo. Dois mapas
de "como executar cada agente" divergiriam na primeira rotina nova — e o sintoma
seria uma rotina que roda pelo botão e é pulada em silêncio pelo ciclo.

⚠️ SÃO DOIS AVISOS À TELA, e a diferença não é cosmética: `_ac_notify_agent_done`
diz que rodou (com ou sem erro), `_ac_notify_agent_pulado` diz que NÃO rodou, e
por quê — qual requisito faltou. Um agente pulado sem essa segunda mensagem
aparece na tela como se nunca tivesse sido considerado, e o usuário fica
procurando o defeito no agente errado.
"""

import json

# M4 · o barramento das extensões. Importado como MÓDULO, e não a
# função solta: `xt_eventos.emitir(...)` diz de onde o aviso sai, e um
# `emitir` nu neste arquivo seria confundido com os dois avisos à tela
# que ele já tem.
from ...extensoes import eventos as xt_eventos
import time
from datetime import datetime

from ...constantes import *
from ..trava_ia import TRAVA_IA, DONO_ROTINAS


class AcionamentosPipelineDisparoMixin:

    def _ac_dispatch(self, project_name, model, mudados_pre=MUDADOS_AUTO):
        """agent_id → como executar. Um lugar só, usado pelo botão manual e pelo ciclo.

        ⚠️ NÃO DERIVAR de `IDS_DAS_ROTINAS`: cada valor é uma chamada diferente,
        com parâmetros diferentes. A lista canônica dá os ids, não o que fazer
        com eles.

        `mudados_pre` importa para a Doc Técnica e as quatro rotinas
        incrementais sem IA (Índice de Símbolos, Bibliotecas, Comentários,
        Duplicados), e só quem chama
        de dentro de `_ac_run_cycle` o informa — ver o comentário lá sobre por
        que precisa ser calculado ANTES do Hashes rodar. `_ac_run_single`
        (card avulso) não passa nada e cai no `MUDADOS_AUTO` de sempre.
        """
        cfg = self.load_rotinas_config(project_name)['config']
        return {
            # A base. Está aqui porque é o dispatch que o ▶ Executar de cada
            # card usa; o CICLO não chama nenhuma das três por aqui — ele as
            # roda por fora, com os caminhos que já tem em mãos.
            'detector':         lambda: self.run_detector_agent(project_name),
            'hashes':           lambda: self.run_hashes_agent(project_name),
            'sincronia':        lambda: self.run_sincronia_agent(project_name),
            'indice-simbolos':  lambda: self.run_indice_simbolos_agent(project_name, mudados_pre=mudados_pre),
            'identificadores':  lambda: self.run_identificadores_agent(project_name),
            'grafo-imports':    lambda: self.run_grafo_imports_agent(project_name),
            'embedding':        lambda: self.run_embedding_agent(project_name),
            'indice-navegacao': lambda: self.run_indice_navegacao_agent(project_name),
            'bibliotecas':      lambda: self.run_bibliotecas_agent(project_name, mudados_pre=mudados_pre),
            'comentarios':      lambda: self.run_comentarios_agent(project_name, mudados_pre=mudados_pre),
            'duplicados':       lambda: self.run_duplicados_agent(project_name, mudados_pre=mudados_pre),
            # `parallel=None`: quem responde é `_rotina_paralelas`, o campo
            # global de Configurações. As `extensions` continuam por projeto.
            'doc-tecnica':      lambda: self.executar_agente_documentacao_tecnica(project_name, model, cfg['doc-tecnica']['extensions'], mudados_pre=mudados_pre),
            'resumo-pastas':    lambda: self.run_resumo_pastas_agent(project_name, model),
            'glossario':        lambda: self.run_glossario_agent(project_name, model),
            'pipeline':         lambda: self.run_pipeline_agent(project_name, model),
        }

    def _ac_run_single(self, project_name, agent_id):
        try:
            # A trava de cinco pontas. O ⟳ "Atualizar agora" de uma rotina
            # chama o LM Studio como o ciclo inteiro chama — só que era o único
            # caminho de AUTOMAÇÃO que NÃO tomava a trava. Enquanto ele rodava,
            # o botão Enviar do Chat continuava aceso e os dois disputavam a
            # mesma janela, que é exatamente o que a trava existe para impedir.
            #
            # ⚠️ E isto NÃO fechou o buraco inteiro, ao contrário do que este
            # comentário deu a entender por um tempo: os 14 botões ▶ da sub-aba
            # ROTINAS são outro caminho, e passavam por fora da trava do mesmo
            # jeito. Eles têm ponto de entrada próprio agora — ver
            # `rotinas_clique.py`, que explica por que não podia ser aqui.
            #
            # `esperar=True` aqui dentro: a recusa honesta, com o motivo na
            # tela, já foi dada por `run_agent_once` antes de abrir a thread —
            # o que sobra é a corrida rara entre aquela consulta e este ponto,
            # e esperar a vez é melhor que perder o que o usuário pediu.
            with TRAVA_IA.ocupar(DONO_ROTINAS, projeto=project_name, esperar=True), self._ac_get_run_lock():
                started_at = self._ac_get_resumo_time(project_name, agent_id)
                model = self._ac_get_current_model()
                if agent_id not in self._AC_SEM_MODELO and not model:
                    self._ac_notify_agent_done(project_name, agent_id, None,
                                               'Nenhum modelo disponível no LM Studio')
                    return

                self._ac_notify(project_name, 'running', agent_id)
                dispatch = self._ac_dispatch(project_name, model)
                dispatch[agent_id]()
                concluiu = self._ac_wait_done(project_name, agent_id, started_at,
                                              require_espera=False)
                if not concluiu:
                    # O retorno era descartado: se o agente estourasse o tempo
                    # (ou morresse antes de gravar o `_resumo.json`), a tela
                    # recebia 'concluido' sem erro nenhum depois de minutos
                    # segurando o lock. `_ac_run_cycle` ja tratava isso certo.
                    self._ac_notify_agent_done(
                        project_name, agent_id, None,
                        'Sem sinal de vida — o agente nao terminou. '
                        'Veja o card dele para o erro.')
                    return

                t = self._ac_get_resumo_time(project_name, agent_id)
                self._ac_notify_agent_done(project_name, agent_id,
                                           t.isoformat() if t else None, None)
        except Exception as e:
            self._ac_notify_agent_done(project_name, agent_id, None, str(e))
        finally:
            self._ac_restore_global_status(project_name)

    def _ac_notify_agent_done(self, project_name, agent_id, finished_at, error):
        """Avisa a tela que a rotina terminou — e escreve a linha do histórico.

        ⚠️ `project_name` é POSICIONAL e obrigatório, e não um `=None` no fim.
        Este método e o `_ac_notify_agent_pulado` são o funil por onde passam o
        ciclo, a base e o ▶ avulso; um chamador esquecido com parâmetro opcional
        deixaria de gravar EM SILÊNCIO, que é justamente o defeito que a sub-aba
        Histórico existe para acabar. Assim, quem esquecer estoura na hora.
        """
        # O desfecho olha os erros do `_resumo.json` (D39). Antes, uma rotina
        # cujo resumo avançou saía "concluída" mesmo tendo falhado em todos os
        # arquivos — ou sendo o resumo de falha de `gravar_resumo_de_falha`.
        saldo = self._ac_saldo_da_rotina(project_name, agent_id) or {}
        erros = int(saldo.get('erros') or 0)
        falha = None if error else self._ac_falha_do_resumo(project_name, agent_id)
        if error:
            desfecho, motivo = 'erro', error
        elif falha:
            desfecho, motivo = 'erro', falha
        elif erros and not saldo.get('processados'):
            desfecho, motivo = 'erro', ('falhou em todos os %d arquivos — veja a aba Erros'
                                        % erros)
        elif erros:
            desfecho, motivo = 'com_erros', '%d erro(s) — veja a aba Erros' % erros
        else:
            desfecho, motivo = 'concluida', None
        self._hist_rotina(project_name, agent_id, desfecho, motivo=motivo,
                          saldo=saldo or None)
        try:
            payload = json.dumps({'agent': agent_id, 'finished_at': finished_at,
                                  'error': motivo if desfecho == 'erro' else None,
                                  'erros': erros, 'falhou': desfecho == 'erro',
                                  'project': project_name})
            self.window.evaluate_js(f'acionamentosAgentDone({payload})')
        except Exception:
            pass
        # M4 · o barramento das extensões, no MESMO funil e pelo mesmo motivo
        # que o docstring acima dá: o ciclo, a base e o ▶ avulso passam todos
        # por aqui. Emitir no `executar()` do ciclo teria deixado o ▶ avulso de
        # fora, e o sintoma seria uma extensão que reage a rotina automática e
        # ignora a que o usuário disparou à mão.
        #
        # DEPOIS do aviso à tela: a tela é a que o usuário está olhando, e
        # `emitir` tem teto por assinante mas ainda assim espera por ele.
        xt_eventos.emitir('rotina.terminou', {
            'projeto': project_name, 'rotina': agent_id,
            'erro': error, 'terminou_em': finished_at})
        # O Painel de Mapas lê a cobertura GRAVADA (`Automação/Rotinas/
        # Cobertura.json`) em vez de varrer o projeto a cada clique. É aqui que
        # ela se regrava, pelo mesmo motivo do aviso acima: o ciclo, a base e o
        # ▶ avulso passam todos por este funil. Em segundo plano — a varredura
        # não pode segurar a próxima rotina.
        self._cob_gravar_em_segundo_plano(project_name, agent_id)

    def _ac_notify_agent_pulado(self, project_name, agent_id, requisito_id=None,
                                motivo=None, dispensado=False):
        """Avisa a tela que este agente não rodou — e por quê.

        Vai pelo mesmo canal do 'concluído' porque é a mesma pergunta que o card
        responde ("e aí, o que houve com você neste ciclo?").

        Dois jeitos de responder, e eles não se misturam:

          · `requisito_id` — o id cru de quem ele estava esperando. Quem sabe
            traduzir id em nome legível é o frontend, que já tem essa tabela;
            duplicá-la aqui criaria duas listas de nomes para manter em dia.
            Serve também para o ciclo interrompido: o id passa a ser o da
            rotina que travou, e a frase da tela continua verdadeira.
          · `motivo` — texto pronto, para o que não é pré-requisito nenhum
            (sem modelo no LM Studio, Detector desligado no meio). Antes esses
            casos eram `return False` MUDOS: a rotina não rodava e nada, em
            lugar nenhum do programa, dizia por quê.
        """
        # Sai da fila do ciclo: pulado nao e esperando. Uma rotina cujo
        # pre-requisito nao terminou nao vai mais rodar nesta volta, e deixa-la
        # em ambar ate o fim prometeria um trabalho que ja se sabe que nao vem.
        self._proc_fila_riscar(project_name, agent_id)
        # A mesma distinção vai para o disco: é o que faz a sub-aba Histórico
        # sobreviver à troca de sub-aba, que os selos pintados por `evaluate_js`
        # não fazem.
        self._hist_rotina(project_name, agent_id,
                          'dispensada' if dispensado else 'pulada',
                          motivo=motivo, requisito=requisito_id)
        try:
            # ⚠️ `dispensado` distingue DOIS motivos de não rodar, e a tela
            # precisa dos dois separados: **pulada** é "um pré-requisito não
            # terminou neste ciclo" (pode rodar no próximo), **dispensada** é "o
            # Detector olhou e não achou nada que pedisse esta rotina" — que é o
            # resultado NORMAL de um ciclo sobre um projeto já em dia. Pintar as
            # duas igual faria o funcionamento certo parecer defeito.
            payload = json.dumps({'agent': agent_id, 'finished_at': None,
                                  'error': None, 'pulado_por': requisito_id,
                                  'motivo': motivo, 'dispensado': bool(dispensado),
                                  'project': project_name})
            self.window.evaluate_js(f'acionamentosAgentDone({payload})')
        except Exception:
            pass
