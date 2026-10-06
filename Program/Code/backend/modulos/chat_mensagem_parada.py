"""Parar no meio: o botão, os dois estágios, e o fechar do programa.

⚠️ SÃO DOIS ESTÁGIOS, e o segundo só existe porque o primeiro é educado. O
primeiro clique pede para parar no fim da rodada; o segundo corta agora. Um
botão só teria de escolher entre desperdiçar a rodada já paga e não obedecer.

⚠️ O CHAT CORTA NO MEIO; A FILA NÃO. A diferença não é inconsistência: aqui há
gente na frente da tela esperando, e mandar parar e ver a resposta continuar por
mais uma rodada inteira foi a queixa que originou o botão. Lá uma pesquisa roda
por horas e ninguém está olhando — jogar fora a rodada paga seria o oposto do
que o cancelamento quer.

⚠️ FECHAR O PROGRAMA NO MEIO DE UMA RESPOSTA GRAVA O PARCIAL. O registro de
gravações pendentes é "como gravar este envio agora, do jeito que ele está" — e
é o que faz o usuário reabrir o programa e encontrar a metade que já tinha
chegado, em vez de uma pergunta sem resposta nenhuma.
"""

from .chat_mensagem_constantes import *


class ChatMensagemParadaMixin:

    # ── Fechar o programa no meio de uma resposta ────────────────────────────
    # Um registro de "como gravar este envio agora, do jeito que ele está".
    # Cada worker deixa aqui uma função sua, e o handler de fechamento do
    # `.pyw` chama todas antes de o processo morrer.
    #
    # ⚠️ Vale nos DOIS caminhos do fechamento — quando a pergunta é feita e
    # respondida com "Sim", e quando a configuração diz para nunca perguntar.
    # Só no primeiro, fechar com "Nunca" apagaria o pedaço já pago E a pergunta,
    # que é o pior dos dois mundos: some o trabalho e some o aviso.

    def _chat_gravacoes_pendentes(self):
        if not hasattr(self, '_chat_gravacoes_de_emergencia'):
            self._chat_gravacoes_de_emergencia = {}
        return self._chat_gravacoes_de_emergencia

    def _chat_registrar_gravacao(self, project_name, chat_id, gravar):
        self._chat_gravacoes_pendentes()[(project_name, chat_id)] = gravar

    def _chat_esquecer_gravacao(self, project_name, chat_id):
        self._chat_gravacoes_pendentes().pop((project_name, chat_id), None)

    def gravar_parciais_antes_de_encerrar(self):
        """Manda cada envio em curso gravar o que já tem. Nunca levanta.

        Chamada do handler de fechamento do `.pyw`. Uma exceção aqui deixaria o
        programa impossível de fechar, e é justamente o cenário em que o usuário
        mais quer que ele feche.
        """
        for gravar in list(self._chat_gravacoes_pendentes().values()):
            try:
                gravar()
            except Exception:
                pass
        return {'success': True}

    def _chat_encerrar_por_parada(self, messages, texto, estagio, log_cb):
        """Fecha o turno que o "Parar" interrompeu, e diz isso aos dois lados.

        São dois destinatários, e cada um precisa de uma coisa diferente:

        · a TELA lê a marca `resposta_parada` e desenha a faixa certa. Sem a
          marca, o pedaço vira balão de resposta normal — o oposto do objetivo,
          e sem erro nenhum para desconfiar.
        · o MODELO só lê `role` e `content` (o `meta` é removido em
          `preparar_mensagens`), então precisa de uma mensagem de verdade no
          fim. Sem ela, a conversa seguinte continua de um turno pela metade
          como se ele estivesse inteiro.

        ⛔ Só ACRESCENTA no fim. Nada do que já foi dito é podado ou reescrito —
        é a regra registrada em `fila/execucao.py` e em `texto_llm.py`.
        """
        # ⚠️ A marca vai MESMO COM `texto` vazio. Parar no fim de uma rodada de
        # subagentes não deixa fala nenhuma do modelo, e é justamente aí que ela
        # importa: sem a marca, a conversa terminaria numa fileira de cartões,
        # sem resposta e sem explicação — que parece defeito do programa, e não
        # uma parada que você mandou.
        messages.append({'role': 'assistant', 'content': texto or '',
                         'meta': {'tipo': META_RESPOSTA_PARADA,
                                  'estagio': estagio}})
        aviso = (AVISO_PARADA_AGORA if estagio >= 2
                 else AVISO_PARADA_FIM_DA_RODADA)
        messages.append({'role': 'user', 'content': aviso,
                         'meta': {'tipo': META_AVISO_PARADA}})
        log_cb({'agente': 'sistema', 'mensagem': aviso})

    def parar_chat(self, project_name, chat_id):
        """O clique no "Parar". Sobe um estágio e devolve o novo (1 ou 2).

        ⛔ NÃO mata a thread do worker. Matá-la não roda nenhum `finally`: a
        TRAVA_IA ficaria presa e o programa inteiro — Chat, Fila, Rotinas,
        Designer e backup — ficaria mudo até ser reiniciado. Quem para é a
        bandeira, que o próprio worker consulta nos pontos em que desistir é
        seguro.

        ⚠️ O Chat é EXCEÇÃO DOCUMENTADA. A Fila continua cortando só no fim da
        rodada (ver o ⛔ em `agentes/fila/execucao.py`), e a diferença é real:
        lá não há ninguém na frente da tela — uma pesquisa roda por horas e o
        trabalho da rodada já foi pago. Aqui há gente esperando, e esperar uma
        rodada inteira depois de mandar parar é a queixa que originou esta obra.

        ℹ️ Nem assim uma requisição é cortada pela metade "no escuro": o
        porteiro só desiste ANTES de pedir a próxima coisa, e o que o subagente
        já leu volta como entrega parcial.
        """
        try:
            estagio = self._chat_subir_parada(project_name, chat_id)
            return {'success': True, 'estagio': estagio}
        except Exception as e:
            return {'success': False, 'error': str(e)}
