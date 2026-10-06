"""A conversa com o LM Studio: abrir o cliente, transmitir, e gravar o que veio.

Tudo que encosta no servidor do modelo, e nada mais. `chat_mensagem.py` decide
O QUE mandar; este arquivo sabe COMO mandar e como o texto volta em pedaços.

⚠️ O STREAM GRAVA O QUE HOUVER, SEMPRE. `_chat_gravar_o_que_houver` existe
porque uma resposta cortada no meio — pelo botão Parar, por queda do LM Studio,
por fechar o programa — ainda é trabalho do usuário. Descartá-la por estar
incompleta apagaria a pergunta dele junto.

⚠️ O SYSTEM PROMPT É MONTADO A CADA ENVIO, e não guardado. Ele depende de quais
subagentes estão ativos e do teto de rodadas daquele envio: um system prompt
gravado envelhece na primeira mudança de configuração, e o sintoma é o modelo
chamar um subagente que já não existe.
"""

from .chat_mensagem_constantes import *
from .llm_geracao import ajustes_da_chamada


class ChatMensagemLlmMixin:

    def _chat_abrir_cliente(self, project_name=None):
        """O cliente do LM Studio e as settings deste envio.

        `project_name` anota a conexão como sendo daquele projeto, para que
        fechar a aba dele a derrube junto (ver `agentes/parada_do_projeto.py`).
        O Chat já tinha a parada dele — cooperativa, no laço de chunks —, e ela
        continua sendo o caminho normal; isto é a rede para a chamada que ainda
        não chegou no primeiro chunk.

        ⚠️ Os três blocos que esta função e as duas abaixo substituem estavam
        escritos DUAS VEZES — uma em `send_message`, outra em
        `retomar_rodadas_chat` —, funcionalmente idênticos e textualmente
        diferentes. Consertar um lado deixava o outro com o defeito, e foi o que
        aconteceu mais de uma vez. A ironia estava escrita no próprio arquivo: o
        docstring de `_chat_laco_de_rodadas` diz que duplicá-lo criaria duas
        versões que "divergiriam no primeiro conserto".
        """
        from .llm_cliente import abrir_cliente_do_lm_studio
        settings = self.load_settings()['settings']
        return abrir_cliente_do_lm_studio(settings, projeto=project_name), settings

    def _chat_fazer_log(self, project_name, chat_id):
        """Devolve o `_log` deste envio: mostra na tela e grava no log.json.

        `chatLogDoStream`, e não `addAgentLog`: a tela só pinta se o chat aberto
        for o dono deste envio. Dá para sair para outro chat no meio da
        resposta, e o Log de lá não pode receber o que está acontecendo aqui.
        """
        def _log(entry):
            self._chat_js(project_name, 'chatLogDoStream', entry)
            self._append_chat_log(project_name, chat_id, entry)
        return _log

    def _chat_fazer_stream(self, project_name, client, model, log_cb,
                           obter_parada=None, guardar_parcial=None):
        """Devolve o `_stream` deste envio: uma volta ao modelo, em streaming.

        `include_usage` faz o LM Studio mandar um chunk final com a contagem
        REAL de tokens de entrada e saída. Depois do envio, esse número vale
        mais que qualquer estimativa — antes ele era descartado sem ninguém
        olhar.
        """
        def _stream(msgs):
            stream = client.chat.completions.create(
                model=model,
                messages=preparar_mensagens(msgs),
                stream=True,
                stream_options={'include_usage': True},
                **ajustes_da_chamada(self.load_settings()['settings'], 'chat', model),
            )
            resposta = ''
            for chunk in stream:
                # O chunk de usage vem com `choices` vazio: sem esta guarda, o
                # IndexError descarta a resposta já pronta.
                uso = getattr(chunk, 'usage', None)
                if uso is not None:
                    log_cb({'agente': 'uso', 'origem': 'chat',
                            'entrada': getattr(uso, 'prompt_tokens', None),
                            'saida': getattr(uso, 'completion_tokens', None),
                            'total': getattr(uso, 'total_tokens', None)})
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                if delta and delta.content:
                    resposta += delta.content
                    self._chat_js(project_name, 'appendChunk', delta.content)
                    # O que já chegou, disponível para quem está de fora — é o
                    # que a gravação de emergência do fechamento precisa para
                    # não perder o pedaço já pago. Custo de uma atribuição.
                    if guardar_parcial is not None:
                        guardar_parcial(resposta)
                # ⚠️ O corte no meio da resposta, e só no estágio 2. O `break`
                # sozinho NÃO basta: sem o `stream.close()` o LM Studio continua
                # gerando do outro lado, e a janela fica ocupada com um texto
                # que ninguém mais vai ler — que é exatamente o que "Parar"
                # existe para evitar.
                # ℹ️ O que já chegou fica em `resposta` e é devolvido: o pedaço
                # já foi pago, e ele é o "parcial" que o Chat grava.
                if obter_parada is not None and obter_parada() >= 2:
                    try:
                        stream.close()
                    except Exception:
                        pass
                    break
            return resposta
        return _stream

    def _chat_system_prompt(self, project_name, subs_ativos, max_rodadas):
        """O system prompt que este envio vai usar.

        São dois arquivos diferentes conforme haja subagente ativo ou não, e a
        escolha estava escrita dentro do worker. Virou função porque a tela
        precisa da MESMA resposta para prever o contexto antes do envio — ver
        `prever_system_prompt_chat`. Duas cópias da escolha divergiriam, e a
        previsão passaria a mentir sem ninguém perceber.
        """
        if subs_ativos:
            return self.montar_system_prompt_chat(project_name, subs_ativos, max_rodadas)
        return self._ler_prompt(obter_prompt_do_assistente(
            PASTA_CHAT, 'system-prompt-sem-subagentes.txt')).strip()

    def prever_system_prompt_chat(self, project_name, subagentes_config=None):
        """O system prompt do PRÓXIMO envio, para a aba Contexto mostrar.

        A barra de contexto não incluía o system prompt — que é justamente a
        parte que vai SEMPRE, com ou sem caixinha marcada. Um chat novo mostrava
        zero token, e o número só passava a ser verdade depois do primeiro envio.
        """
        try:
            pedidos = (subagentes_config or {}).get('ativos') or []
            subs_ativos = [s for s in com_subagentes_de_extensoes(SUBAGENTES_TODOS, pedidos)
                           if s in pedidos]
            max_rodadas = max(int((subagentes_config or {}).get('max_rodadas') or 1), 1)
            return {'success': True,
                    'system_prompt': self._chat_system_prompt(project_name, subs_ativos,
                                                              max_rodadas)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _chat_titular_se_novo(self, data, user_message):
        """Um chat ainda chamado "Novo chat" ganha o começo da sua pergunta.

        Existe como função porque três caminhos precisam dela e a regra do
        corte (60 caracteres, sem quebra de linha) tem de ser a MESMA nos
        três — a tela faz o mesmo corte no clique, e um título que mudasse
        sozinho ao recarregar pareceria defeito.
        """
        if data.get('title') == 'Novo chat' and user_message:
            data['title'] = user_message[:60].replace(chr(10), ' ')
        return data.get('title')

    def _chat_gravar_o_que_houver(self, project_name, chat_id, data, messages,
                                  user_message=None):
        """Gravação de emergência: salva a conversa quando o turno deu errado.

        A gravação normal é a ÚLTIMA coisa do worker. Qualquer exceção antes
        dela — o LM Studio caindo, o modelo sendo descarregado — e nada ia para
        o disco: a pergunta que você acabou de escrever sumia junto com a
        resposta, porque o campo de texto já tinha sido esvaziado no clique.

        Só grava o que de fato existe. `messages` já contém a sua pergunta e as
        rodadas que chegaram a fechar; o pedaço de resposta que ficou pela
        metade não entra — gravá-lo o apresentaria como resposta inteira.

        ⚠️ Não levanta: ela roda DENTRO de um `except`, e uma exceção daqui
        substituiria o erro real por um erro de disco.
        """
        if data is None or not messages:
            return
        try:
            data['messages'] = messages
            self._chat_titular_se_novo(data, user_message)
            self._save_chat_data(project_name, chat_id, data)
        except Exception as e_disco:
            try:
                self._append_chat_log(project_name, chat_id,
                                      {'agente': 'sistema',
                                       'mensagem': f'A conversa não pôde ser gravada '
                                                   f'depois do erro: {e_disco}'})
            except Exception:
                pass
