"""O ▶ de cada card de rotina: a trava de cinco pontas no ponto do CLIQUE.

O buraco que este arquivo fecha
───────────────────────────────
A trava (`trava_ia.py`) existe para impedir que duas pontas usem a janela do LM
Studio ao mesmo tempo. **Catorze dos quinze botões ▶ da sub-aba Rotinas passavam
por fora dela** — só o Hashes escapava, porque ele delega ao ciclo. Cinco desses
catorze chamam o modelo. Clicar ▶ no Espelho (retirado em 2026-09) e ▶ na
Documentação Técnica disparava os dois de uma vez: literalmente o cenário que
a trava existe para impedir, com o agravante de que o `PortaoDeContexto` de
cada um não enxerga o outro e cada um acha que a janela inteira é dele.

Por que um ponto de entrada NOVO por card, e não a trava dentro do método
────────────────────────────────────────────────────────────────────────
⛔ **Pôr `TRAVA_IA.ocupar` dentro de `run_resumo_pastas_agent` e afins é DEADLOCK
DURO.** A `TRAVA_IA` não é reentrante (ver `trava_ia.py`), e o ciclo automático
chama exatamente esses mesmos métodos — por `_ac_dispatch` — **já segurando a
trava** (`_ac_run_single`, em `acionamentos_pipeline.py`). O primeiro card do
primeiro ciclo travaria o programa inteiro, sem erro e sem saída.

⛔ **E não é caso de passar a chamar `run_agent_once`.** Ele existe, ele já
confere a trava, e ele é o caminho do ⟳ de Acionamentos — mas ele roda por
`_ac_run_single`, que traz junto a fiação de progresso do CICLO: `_ac_notify`,
`_ac_wait_done`, `_ac_notify_agent_done` e o `_ac_get_run_lock`. Adotá-la nos 14
cards trocaria a barra de progresso, o badge e o contador de cada um pela do
ciclo — quatorze telas mudariam de comportamento para consertar uma trava.

O que sobra, e é o que está aqui: uma casca de três linhas por card. Ela confere
a trava e chama o método de sempre, com os mesmos argumentos. O caminho do ciclo
não é tocado; o caminho do clique ganha o guarda.

Recusar, e nunca enfileirar
───────────────────────────
⚠️ A regra geral da trava é ENFILEIRAR, NUNCA DESCARTAR — mas ela vale para
quem dispara por evento, como o Detector. Aqui é clique: tem gente na frente da
tela, e recusar com o motivo escrito é a resposta honesta. Mesma decisão do
envio do Chat, do "Iniciar tarefas" da Fila e do `run_agent_once`.

ℹ️ O disparo AUTOMÁTICO do Detector continua enfileirando, como sempre — ele não
passa por aqui.
"""

from ..trava_ia import TRAVA_IA


class RotinasCliqueMixin:
    """Os 14 pontos de entrada do clique. Um por card, sem tabela nenhuma.

    ⚠️ Catorze métodos escritos à mão, e não um dispatch por id. É a mesma razão
    que `_ac_dispatch` documenta: cada valor é uma chamada diferente, com
    parâmetros diferentes. Uma segunda tabela de rotinas seria uma segunda lista
    para divergir da primeira no dia em que uma rotina mudasse de assinatura —
    e ela divergiria em silêncio, porque o método antigo continuaria existindo.
    """

    def _rotina_recusa_da_trava(self):
        """`None` quando pode rodar; o dicionário de recusa quando não pode.

        `trava` vai junto do erro para a tela poder repintar os botões na hora,
        sem esperar a próxima pulsação de 4 s — é o mesmo contrato que o envio
        do Chat e o início da Fila já devolvem.
        """
        ocupada = TRAVA_IA.estado()
        if not ocupada:
            return None
        return {'success': False, 'trava': ocupada,
                'error': 'não dá para rodar agora: %s'
                         % ocupada.get('motivo', 'há tarefa de IA rodando')}

    def _rotina_solta(self, project_name, agent_id):
        """Clicou para rodar: esta rotina não está mais "desativada". Sempre `None`.

        Sem isto, depois de um "Desativar tudo" o ▶ de uma rotina com IA a
        faria nascer parada — o cliente dela sairia fechado e todo arquivo
        falharia com erro de conexão. Quem clica quer rodar.
        """
        self.projeto_retomar_rotinas(project_name, agent_id)
        return None

    # ── Os catorze ──────────────────────────────────────────────────────────

    def rodar_detector_pelo_card(self, project_name, caminhos=None):
        return (self._rotina_recusa_da_trava()
                or self.run_detector_agent(project_name, caminhos))

    def rodar_sincronia_pelo_card(self, project_name, operacoes=None):
        return (self._rotina_recusa_da_trava()
                or self.run_sincronia_agent(project_name, operacoes))

    def rodar_identificadores_pelo_card(self, project_name):
        return (self._rotina_recusa_da_trava()
                or self.run_identificadores_agent(project_name))

    def rodar_grafo_imports_pelo_card(self, project_name):
        return (self._rotina_recusa_da_trava()
                or self.run_grafo_imports_agent(project_name))

    def rodar_embedding_pelo_card(self, project_name, tipo=None):
        return (self._rotina_recusa_da_trava()
                or self.run_embedding_agent(project_name, tipo))

    def rodar_indice_navegacao_pelo_card(self, project_name):
        return (self._rotina_recusa_da_trava()
                or self.run_indice_navegacao_agent(project_name))

    def rodar_bibliotecas_pelo_card(self, project_name):
        return (self._rotina_recusa_da_trava()
                or self.run_bibliotecas_agent(project_name))

    def rodar_comentarios_pelo_card(self, project_name):
        return (self._rotina_recusa_da_trava()
                or self.run_comentarios_agent(project_name))

    def rodar_indice_simbolos_pelo_card(self, project_name):
        return (self._rotina_recusa_da_trava()
                or self.run_indice_simbolos_agent(project_name))

    def rodar_duplicados_pelo_card(self, project_name):
        return (self._rotina_recusa_da_trava()
                or self.run_duplicados_agent(project_name))

    def rodar_glossario_pelo_card(self, project_name, model=None):
        return (self._rotina_recusa_da_trava()
                or self._rotina_solta(project_name, 'glossario')
                or self.run_glossario_agent(project_name, model))

    def rodar_pipeline_pelo_card(self, project_name, model=None):
        return (self._rotina_recusa_da_trava()
                or self._rotina_solta(project_name, 'pipeline')
                or self.run_pipeline_agent(project_name, model))

    def rodar_resumo_pastas_pelo_card(self, project_name, model=None, parallel=None):
        return (self._rotina_recusa_da_trava()
                or self._rotina_solta(project_name, 'resumo-pastas')
                or self.run_resumo_pastas_agent(project_name, model, parallel))

    def rodar_documentacao_tecnica_pelo_card(self, project_name, model=None,
                                             extensions=None, parallel=None):
        return (self._rotina_recusa_da_trava()
                or self._rotina_solta(project_name, 'doc-tecnica')
                or self.executar_agente_documentacao_tecnica(
                    project_name, model, extensions, parallel))
