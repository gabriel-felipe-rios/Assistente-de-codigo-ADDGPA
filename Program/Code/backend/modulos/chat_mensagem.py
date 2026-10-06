"""O envio de uma mensagem no Chat, do clique até a resposta na tela.

Este arquivo era 1.059 linhas e virou seis, pelo teto de 500 da AMF. O corte
segue a regra dos Backups, do Inspetor e do `arquivos.py`: **cada arquivo
responde uma pergunta diferente**.

| Arquivo | A pergunta que ele responde |
|---|---|
| `chat_mensagem.py` | o que é enviado, e como o payload é montado |
| `chat_mensagem_constantes.py` | as marcas de `meta` e os avisos de parada |
| `chat_mensagem_llm.py` | como se fala com o LM Studio, e como se grava |
| `chat_mensagem_parada.py` | o botão Parar, e fechar o programa no meio |
| `chat_mensagem_rodadas.py` | o laço de chamadas de subagentes |
| `chat_mensagem_retomar.py` | executar uma chamada que o teto barrou |

`ChatMensagemMixin` continua sendo o nome único que `api.py` importa: ele COMPÕE
os quatro, no padrão de `InspetorMixin` (Convenção 5 da Arquitetura modular).
Nenhum tem `__init__` nem `super()`, o que torna a herança múltipla inerte.

⚠️ A TRAVA É DE CINCO PONTAS — Chat, Fila, Rotinas, Designer e backup —, e ela é
pega AQUI, em `send_message`. Não é detalhe de arrumação que ela não more no
laço de rodadas: a trava vale pelo ENVIO inteiro, e pegá-la lá dentro faria cada
rodada disputar de novo o que a anterior já tinha ganhado.

⚠️ `_chat_js` SEMPRE LEVA O PROJETO JUNTO. Com vários projetos abertos, um
evento sem o nome do projeto pinta na aba errada — e o sintoma é a resposta de
um chat aparecendo dentro de outro.
"""

from .chat_mensagem_constantes import *

from .chat_mensagem_llm import ChatMensagemLlmMixin
from .chat_mensagem_parada import ChatMensagemParadaMixin
from .chat_mensagem_rodadas import ChatMensagemRodadasMixin
from .chat_mensagem_retomar import ChatMensagemRetomarMixin


class ChatMensagemMixin(ChatMensagemLlmMixin, ChatMensagemParadaMixin,
                        ChatMensagemRodadasMixin, ChatMensagemRetomarMixin):
    """Núcleo de envio de mensagem no Chat: streaming com LM Studio, loop de
    chamadas de subagentes e montagem do payload da aba Contexto."""

    def _chat_js(self, project_name, funcao, *args):
        """Empurra um evento do Chat para a tela — SEMPRE com o projeto junto.

        ⚠️ FUNIL ÚNICO, e ele existe por um buraco real. Todo o resto do
        programa já mandava `'project': project_name` no payload de
        `evaluate_js`, e o JS descarta o que não é do projeto exibido (são 28
        lugares). O Chat era a única ponta que não mandava: `appendChunk`,
        `finishMessage`, `chatError`, `chatContextoDoStream`, `chatLogDoStream`,
        `startSubagentCalls`, `finishSubagentCalls`, `discardStreaming` e
        `chatAviso` iam sem endereço nenhum.

        Na prática o dano era contido pela `TRAVA_IA` (um chat responde por vez
        no programa inteiro), mas isso é uma proteção ACIDENTAL: o filtro do
        lado JS é o `_streamChatId`, e o id de um chat é a hora de criação —
        dois projetos podem ter chats com o mesmo id. Quando isso acontece, os
        pedaços da resposta de um projeto aparecem na conversa do outro.

        O projeto vai como ÚLTIMO argumento, e não como campo dentro do
        payload: assim as funções do JS mantêm a assinatura que já tinham, e
        quem não passar o argumento continua funcionando (o guarda do lado de
        lá trata `undefined` como "serve para qualquer projeto").

        Falha em silêncio, como todos os `evaluate_js` deste arquivo: a janela
        pode ter fechado no meio, e derrubar um worker de resposta paga por
        causa de uma atualização de tela seria trocar um defeito visual por um
        erro de verdade.
        """
        try:
            partes = [json.dumps(a) for a in args]
            partes.append(json.dumps(project_name))
            self.window.evaluate_js('%s(%s)' % (funcao, ', '.join(partes)))
        except Exception:
            pass

    def _chat_contexto_ao_vivo(self, project_name, messages):
        """Empurra o Contexto para a tela NO MEIO da resposta.

        ⚠️ Existe porque a aba Contexto era a única das três que só se montava
        no fim. O Log recebia linha por linha e a conversa recebia chunk por
        chunk, mas o Contexto ficava parado no que existia ANTES do streaming —
        e ele é justamente onde se olha para entender o que o modelo está
        recebendo agora. Quem estava com a aba aberta via um envio congelado e
        concluía que a montagem tinha falhado.

        ⚠️ Não grava em disco. A gravação continua acontecendo uma vez só, no
        fim (`_save_chat_contexto`): isto aqui é tela, e escrever o JSON de
        contexto inteiro a cada rodada seria pagar disco por uma prévia.

        Falha em silêncio de propósito: é informativa, e derrubar o worker de
        uma resposta paga por causa de uma atualização de painel seria trocar
        um defeito visual por um erro de verdade.
        """
        try:
            payload = self._build_payload_items(messages)
        except Exception:
            return
        self._chat_js(project_name, 'chatContextoDoStream', payload)

    def _build_payload_items(self, messages):
        """Converte lista de mensagens em itens tipados para updatePayloadView."""
        items = []
        for m in messages:
            if m.get('meta'):
                item = dict(m)
                item['type'] = m['meta'].get('tipo', 'subagentes')
                aviso = m['meta'].get('aviso')
                if aviso and aviso in item.get('content', ''):
                    # Separa o aviso do sistema num item próprio na aba Contexto
                    item['content'] = item['content'].replace('\n\n' + aviso, '').replace(aviso, '')
                    items.append(item)
                    items.append({'role': 'user', 'type': 'aviso_sistema', 'content': aviso})
                else:
                    items.append(item)
                continue
            if m['role'] == 'system':
                content = m.get('content', '')
                if 'Documentação do projeto' in content or 'Contexto dos arquivos' in content or 'Documentação disponível' in content:
                    items.append({'role': 'system', 'type': 'context', 'content': content})
                else:
                    items.append({'role': 'system', 'type': 'system', 'content': content})
            else:
                items.append(dict(m))
        return items

    def send_message(self, project_name, chat_id, user_message, model, context_files=None, agent_context_paths=None, subagentes_config=None, prompt_fixo=None):
        # A trava de CINCO pontas (Chat, Fila, Rotinas, Designer, backup).
        # Aqui ela RECUSA em vez de esperar, e é o caso
        # em que recusar é honesto: há gente na frente da tela, e uma mensagem
        # que ficasse pendurada por meia hora esperando a Fila terminar seria
        # pior que um "não dá agora, é por isto".
        try:
            reserva = TRAVA_IA.ocupar(DONO_CHAT, projeto=project_name, esperar=False)
            reserva.__enter__()
        except TravaOcupada as e:
            return {'success': False, 'error': e.estado.get('motivo'),
                    'trava': e.estado}

        def worker():
            # ⚠️ Nascem antes do `try` porque o `except` lá embaixo GRAVA o que
            # houver. Sem isto, o próprio `except` levantaria NameError e
            # substituiria o erro real — e a gravação de emergência não
            # aconteceria justamente no caso em que ela é necessária.
            data = None
            messages = None
            # Quem está respondendo agora. É isso que faz `deletar_chat`
            # recusar — a TRAVA_IA diz que o Chat está ocupado, não QUAL chat.
            self._chat_marcar_em_resposta(project_name, chat_id, True)
            # ⚠️ A bandeira de parada ZERA na largada. Sem isto, um "Parar"
            # clicado no envio anterior mataria este antes de ele começar.
            self._chat_zerar_parada(project_name, chat_id)
            obter_parada = lambda: self._chat_estagio_de_parada(project_name, chat_id)
            # O pedaço da resposta que está chegando agora. Vive aqui, e não em
            # `messages`, porque `messages` só recebe a fala do modelo quando ela
            # TERMINA — e é justamente o caso em que ela não terminou que a
            # gravação de emergência do fechamento precisa cobrir.
            parcial = {'texto': ''}

            def _gravar_agora():
                """Como gravar ESTE envio, do jeito que ele está neste segundo.

                ⚠️ Fecha sobre `data` e `messages`, que o worker rebindeia — e
                é de propósito: a função enxerga sempre o estado ATUAL, não o de
                quando foi registrada.
                """
                if data is None or not messages:
                    return
                em_disco = list(messages)
                if parcial['texto']:
                    # Com a marca, sempre. Sem ela o pedaço vira balão de
                    # resposta normal ao reabrir o chat, e a conversa passa a
                    # afirmar que o modelo respondeu aquilo por inteiro.
                    em_disco.append({'role': 'assistant', 'content': parcial['texto'],
                                     'meta': {'tipo': META_RESPOSTA_PARADA,
                                              'estagio': 2}})
                    em_disco.append({'role': 'user', 'content': AVISO_PARADA_AGORA,
                                     'meta': {'tipo': META_AVISO_PARADA}})
                self._chat_gravar_o_que_houver(project_name, chat_id, data,
                                               em_disco, user_message)

            self._chat_registrar_gravacao(project_name, chat_id, _gravar_agora)
            try:
                client, settings = self._chat_abrir_cliente(project_name)
                _log = self._chat_fazer_log(project_name, chat_id)

                # Log: mensagem do usuário (aparece primeiro no Log)
                _log({'agente': 'usuario', 'mensagem': user_message})

                data = self._load_chat_data(project_name, chat_id)
                # ⚠️ O título é decidido AQUI e vai para o DISCO na linha
                # seguinte — as duas coisas juntas, de propósito. Decidir sem
                # gravar era o defeito: o novo nome ficava só na memória do
                # worker até o fim do turno, e qualquer remontagem da lista
                # durante a resposta (clicar noutro chat, voltar para a sub-aba
                # Chat, sair e voltar da aba Assistente) relia o disco e trazia
                # "Novo chat" de volta — sem nada para restaurá-lo depois.
                # A tela troca o texto no clique (`sendChatMessage`); é esta
                # gravação que faz a troca sobreviver a reler o disco.
                self._chat_titular_se_novo(data, user_message)
                self._save_chat_data(project_name, chat_id, data)
                messages = list(data.get('messages', []))

                manual_paths = list(agent_context_paths or [])

                if context_files:
                    parts = []
                    ilegiveis = []
                    for path in context_files:
                        try:
                            with open(path, 'r', encoding='utf-8', errors='replace') as f:
                                content = f.read()
                            name = os.path.basename(path)
                            parts.append(f'### {name}\n```\n{content}\n```')
                        except Exception as e_ctx:
                            # ⚠️ Era `except Exception: pass`. O arquivo saía do
                            # envio SEM log e SEM aviso: você marcou a caixa, viu
                            # os tokens entrarem na conta, e o bloco não foi.
                            # O modelo também precisa saber — senão ele responde
                            # como se aquele arquivo não existisse.
                            ilegiveis.append((os.path.basename(path), str(e_ctx)))
                    for nome_ilegivel, motivo in ilegiveis:
                        parts.append(f'### {nome_ilegivel}\n(ESTE ARQUIVO NÃO PÔDE '
                                     f'SER LIDO e não está aqui: {motivo})')
                        _log({'agente': 'sistema',
                              'mensagem': f'Arquivo de contexto não pôde ser lido e '
                                          f'ficou de fora do envio: {nome_ilegivel} '
                                          f'({motivo})'})
                    if parts:
                        ctx = 'Contexto dos arquivos selecionados:\n\n' + '\n\n'.join(parts)
                        messages = [{'role': 'system', 'content': ctx}] + messages

                # As regras vêm misturadas com a documentação de agente na mesma
                # lista achatada, e os dois têm destino diferente: documentação
                # é prefixo estável, regra vai para a cauda (perto da mensagem a
                # que ela se aplica). A separação é por pasta de origem.
                # Projeto sem pasta raiz não tem base normativa: _regras_dir
                # devolve '' e tudo cai como documentação, sem estourar.
                base_regras = self._regras_dir(project_name)
                regras_dir = os.path.normpath(base_regras) if base_regras else ''
                docs_paths, regras_paths = [], []
                for path in manual_paths:
                    if regras_dir and os.path.normpath(path).startswith(regras_dir + os.sep):
                        regras_paths.append(path)
                    else:
                        docs_paths.append(path)

                def _juntar_arquivos(paths):
                    parts = []
                    for path in paths:
                        try:
                            with open(path, 'r', encoding='utf-8', errors='replace') as f:
                                content = f.read()
                            parts.append(f'--- {os.path.basename(path)} ---\n{content}')
                        except Exception:
                            pass
                    return parts

                partes_docs = _juntar_arquivos(docs_paths)
                if partes_docs:
                    agent_ctx = ('Documentação do projeto (gerada por agente):\n\n'
                                 + '\n\n'.join(partes_docs))
                    messages = [{'role': 'system', 'content': agent_ctx}] + messages

                # Subagentes: system prompt modular como primeira mensagem.
                # A lista vem da tela, então é filtrada contra a lista canônica:
                # sem isso, um subagentes.json antigo autoriza na validação um
                # nome que não tem bloco no prompt nem implementação.
                pedidos = (subagentes_config or {}).get('ativos') or []
                subs_ativos = [s for s in com_subagentes_de_extensoes(SUBAGENTES_TODOS, pedidos)
                               if s in pedidos]
                max_rodadas = max(int((subagentes_config or {}).get('max_rodadas') or 1), 1)
                max_tokens_resposta = (subagentes_config or {}).get('max_tokens')
                contador_ativo = bool((subagentes_config or {}).get('contador'))
                sys_prompt = self._chat_system_prompt(project_name, subs_ativos,
                                                      max_rodadas)
                # Remove a versão anterior do system prompt principal salva no
                # histórico (os toggles ou o nº de rodadas podem ter mudado).
                # A marca é o meta, não mais um trecho do texto do prompt: com o
                # marcador literal, qualquer edição no .txt quebrava a remoção em
                # silêncio e o histórico acumulava system prompts velhos.
                messages = [m for m in messages
                            if not (m['role'] == 'system'
                                    and (m.get('meta') or {}).get('tipo') == 'system_principal')]
                messages = [{'role': 'system', 'content': sys_prompt,
                             'meta': {'tipo': 'system_principal'}}] + messages

                # ── A cauda ───────────────────────────────────────────────────
                # Ordem: system + blocos (prefixo sempre igual) → histórico →
                # regras → prompt fixo → mensagem do usuário.
                # O que varia fica no fim de propósito: o prefixo estável é o que
                # o LM Studio consegue reaproveitar de cache, e semanticamente um
                # "colar" acompanha a mensagem de agora, não abre a conversa.
                partes_regras = _juntar_arquivos(regras_paths)
                if partes_regras:
                    messages.append({
                        'role': 'user',
                        'content': 'Regras e instruções deste projeto:\n\n' + '\n\n'.join(partes_regras),
                        'meta': {'tipo': 'contexto_regras'},
                    })

                if prompt_fixo:
                    texto_fixo = self.get_prompt_fixo(prompt_fixo).get('prompt', '')
                    if texto_fixo:
                        messages.append({
                            'role': 'user', 'content': texto_fixo,
                            'meta': {'tipo': 'prompt_fixo', 'nome': prompt_fixo},
                        })
                        _log({'agente': 'sistema',
                              'mensagem': f'Prompt fixo aplicado: {prompt_fixo}'})

                messages.append({'role': 'user', 'content': user_message})

                # Atualiza Contexto antes de iniciar o streaming
                payload_antes = self._build_payload_items(messages)
                self._chat_js(project_name, 'chatContextoDoStream', payload_antes)

                _stream = self._chat_fazer_stream(
                    project_name, client, model, _log, obter_parada,
                    guardar_parcial=lambda t: parcial.__setitem__('texto', t))
                log_cb = _log

                # Uma conta corrente por TAREFA — a mensagem do usuário sendo
                # respondida, com todas as rodadas dela. Sem ela o subagente
                # relê as mesmas partes a cada devolução e o laço não fecha.
                rastro = RastroDeLeitura()
                messages, full_response = self._chat_laco_de_rodadas(
                    project_name, chat_id, model, messages,
                    {'subs_ativos': subs_ativos, 'max_rodadas': max_rodadas,
                     'max_tokens': max_tokens_resposta, 'contador': contador_ativo},
                    rastro, log_cb, _stream, obter_parada=obter_parada)

                data['messages'] = messages
                self._save_chat_data(project_name, chat_id, data)

                # Log: resposta do chat
                _log({'agente': 'chat', 'resposta_bruta': full_response})

                payload = self._build_payload_items(messages)
                self._save_chat_contexto(project_name, chat_id, payload)
                self._chat_js(project_name, 'chatContextoDoStream', payload)
                self._chat_js(project_name, 'finishMessage', data['title'])

            except Exception as e:
                # Grava ANTES de avisar a tela. A gravação era a última coisa do
                # worker: qualquer exceção antes dela — o LM Studio caindo, o
                # modelo sendo descarregado — e nada ia para o disco. Na tela a
                # pergunta sumia junto, porque o campo já tinha sido esvaziado
                # no clique. O que está em `messages` neste ponto é a pergunta e
                # as rodadas que chegaram a fechar; o pedaço de resposta que
                # ficou pela metade continua na tela, mas não é gravado como se
                # fosse uma resposta inteira.
                self._chat_gravar_o_que_houver(project_name, chat_id, data, messages,
                                               user_message)
                self._chat_js(project_name, 'chatError', str(e))
            finally:
                self._chat_marcar_em_resposta(project_name, chat_id, False)
                # E a bandeira LIMPA aqui, em qualquer saída: deixada ligada,
                # ela pararia o próximo envio deste chat antes de ele começar.
                self._chat_zerar_parada(project_name, chat_id)
                self._chat_esquecer_gravacao(project_name, chat_id)
                # Solta a trava em QUALQUER saída — inclusive no erro. Uma
                # trava presa por uma exceção deixaria o programa inteiro mudo.
                reserva.__exit__(None, None, None)
                try:
                    self.window.evaluate_js('atualizarTravaIA()')
                except Exception:
                    pass

        # ⚠️ Quem solta a trava é o `finally` do worker — e ele só existe se o
        # worker nascer. Um `.start()` que estoura deixava a trava presa até o
        # programa reiniciar, mudando o Chat, a Fila e as Rotinas de uma vez.
        try:
            threading.Thread(target=worker, daemon=True).start()
        except Exception as e:
            reserva.__exit__(None, None, None)
            return {'success': False, 'error': str(e)}
        return {'success': True}

