"""Retomar uma chamada que o teto de rodadas barrou.

⚠️ RETOMAR NÃO É REENVIAR. O modelo já escreveu as chamadas que queria fazer, e
elas ficaram gravadas carimbadas com `META_CHAMADA_BARRADA`; retomar EXECUTA
aquelas chamadas, sem pedir nada de novo ao modelo. Reenviar gastaria uma volta
para receber, na melhor das hipóteses, o mesmo pedido.

⚠️ É UM ARQUIVO PRÓPRIO, e não um parâmetro de `_chat_laco_de_rodadas`, porque
o ponto de partida é outro: o laço começa numa pergunta do usuário e termina
numa resposta; este começa numa resposta JÁ DADA e continua de dentro dela. As
duas trajetórias só se encontram no meio, e um parâmetro para escolher entre
elas faria cada linha do laço ter dois significados.
"""

from .chat_mensagem_constantes import *


class ChatMensagemRetomarMixin:

    # ── Retomar uma chamada que o teto barrou ────────────────────────────────
    def retomar_rodadas_chat(self, project_name, chat_id, model,
                             subagentes_config=None):
        """Executa a chamada que ficou barrada e segue o laço de onde parou.

        ⛔ NÃO reenvia a pergunta e NÃO refaz o que já rodou: reenviar o turno
        com um teto maior foi avaliado e descartado, porque repete as rodadas
        que já custaram LM Studio. O que estava barrado já está gravado em
        disco — a última mensagem da conversa é a chamada com a marca
        `chamada_barrada` —, então dá para executá-la e continuar sem
        reperguntar nada ao modelo.

        ⛔ E NÃO remonta o system prompt. Ele é montado COM o número de rodadas
        dentro (`montar_system_prompt_chat`) e fica na PRIMEIRA posição: trocar
        o número ali mudaria a primeira mensagem e mataria o cache do LM Studio
        inteiro, justamente numa conversa longa, que é onde isso dói. A
        retomada só escreve no FIM — o número novo é dito num aviso na cauda.
        """
        try:
            reserva = TRAVA_IA.ocupar(DONO_CHAT, projeto=project_name, esperar=False)
            reserva.__enter__()
        except TravaOcupada as e:
            return {'success': False, 'error': e.estado.get('motivo'),
                    'trava': e.estado}

        try:
            data = self._load_chat_data(project_name, chat_id)
            messages = list(data.get('messages', []))
            ultima = messages[-1] if messages else None
            if not ultima or (ultima.get('meta') or {}).get('tipo') != META_CHAMADA_BARRADA:
                reserva.__exit__(None, None, None)
                return {'success': False,
                        'error': 'não há chamada barrada no fim desta conversa.'}

            pedidos = (subagentes_config or {}).get('ativos') or []
            subs_ativos = [s for s in com_subagentes_de_extensoes(SUBAGENTES_TODOS, pedidos)
                           if s in pedidos]
            concedidas = max(int((subagentes_config or {}).get('max_rodadas') or 1), 1)

            from modulos.agentes.json_tolerante import (extrair_json_com_chave,
                                                        validar_chamadas)
            obj, err = extrair_json_com_chave(ultima.get('content') or '', 'chamadas')
            chamadas = None
            if obj is not None:
                chamadas, err = validar_chamadas(obj, subs_ativos)
            if not chamadas:
                reserva.__exit__(None, None, None)
                return {'success': False,
                        'error': ('a chamada barrada não pôde ser lida'
                                  + (f': {err}' if err else '')
                                  + '. Se você mudou quais subagentes estão ativos, '
                                    'a chamada antiga pode citar um que saiu.')}

            # ⚠️ O CARIMBO, e ele vai para o DISCO agora — antes de o worker
            # subir. A retomada só reescreve a conversa quando TERMINA, e até
            # lá o que está gravado continua sendo a chamada barrada: sair do
            # chat e voltar no meio da retomada redesenhava a faixa com o botão
            # "Retomar" outra vez, oferecendo de novo o que já estava rodando.
            # Com a marca, o desenho vira o selo "mais N rodadas concedidas".
            #
            # ℹ️ Ela não sobrevive ao fim da retomada, e está certo: a chamada
            # deixa de ser barrada quando ela roda, e volta ao histórico com o
            # meta `chamada_subagentes` normal. A marca só existe na janela em
            # que a pergunta "posso retomar?" já foi respondida e o resultado
            # ainda não chegou — que é exatamente a janela do defeito.
            ultima.setdefault('meta', {})['rodadas_concedidas'] = concedidas
            self._save_chat_data(project_name, chat_id, data)
        except Exception as e:
            reserva.__exit__(None, None, None)
            return {'success': False, 'error': str(e)}

        def worker():
            # ⚠️ Nascem antes do `try` pelo mesmo motivo dos de `send_message`:
            # o `except` lá embaixo os usa, e uma exceção antes da atribuição
            # faria o próprio `except` levantar NameError.
            pendente = None
            antes_do_laco = None
            self._chat_marcar_em_resposta(project_name, chat_id, True)
            # Mesma zeragem de `send_message`, e pelo mesmo motivo: a retomada
            # é um envio novo, e o "Parar" do turno anterior não vale para ela.
            self._chat_zerar_parada(project_name, chat_id)
            obter_parada = lambda: self._chat_estagio_de_parada(project_name, chat_id)
            parcial = {'texto': ''}

            def _gravar_agora():
                """Mesma gravação de emergência de `send_message`, e aqui dói
                mais: os subagentes desta retomada JÁ RODARAM e já custaram."""
                if data is None or not messages:
                    return
                em_disco = list(messages)
                if pendente is not None and len(messages) == antes_do_laco:
                    em_disco.append(pendente)
                if parcial['texto']:
                    em_disco.append({'role': 'assistant', 'content': parcial['texto'],
                                     'meta': {'tipo': META_RESPOSTA_PARADA,
                                              'estagio': 2}})
                    em_disco.append({'role': 'user', 'content': AVISO_PARADA_AGORA,
                                     'meta': {'tipo': META_AVISO_PARADA}})
                self._chat_gravar_o_que_houver(project_name, chat_id, data, em_disco)

            self._chat_registrar_gravacao(project_name, chat_id, _gravar_agora)
            try:
                client, settings = self._chat_abrir_cliente(project_name)
                _log = self._chat_fazer_log(project_name, chat_id)

                # A conta de rodadas do turno barrado veio junto da marca. É ela
                # que faz o aviso dizer "você usou 3 de 4" em vez de recomeçar
                # em "1 de 2" — duas afirmações que se contradizem no mesmo
                # histórico, para um leitor que é um modelo de linguagem.
                rodadas_feitas = int((ultima.get('meta') or {}).get('rodadas_feitas') or 0)
                _log({'agente': 'sistema',
                      'mensagem': f'Retomada: mais {concedidas} rodada(s) de '
                                  f'subagentes concedidas nesta conversa '
                                  f'(a partir da rodada {rodadas_feitas}).'})

                # ⚠️ O rastro de leitura é REIDRATADO, não recomeçado. Um rastro
                # vazio faria o subagente reler as partes que já tinha lido no
                # turno barrado — queimando exatamente as rodadas que o usuário
                # acabou de conceder.
                meta_rastro = {}
                for m in reversed(messages):
                    if (m.get('meta') or {}).get('tipo') == META_RASTRO:
                        meta_rastro = m['meta']
                        break
                rastro = RastroDeLeitura.de_meta(meta_rastro)

                _stream = self._chat_fazer_stream(
                    project_name, client, model, _log, obter_parada,
                    guardar_parcial=lambda t: parcial.__setitem__('texto', t))

                # A mensagem barrada sai daqui e volta pelo laço como a chamada
                # normal de sempre, com o meta `chamada_subagentes`. Deixá-la
                # duplicaria a fala do modelo no histórico.
                pendente = messages.pop()
                antes_do_laco = len(messages)

                novas, full_response = self._chat_laco_de_rodadas(
                    project_name, chat_id, model, messages,
                    {'subs_ativos': subs_ativos,
                     'max_rodadas': rodadas_feitas + concedidas,
                     'max_tokens': (subagentes_config or {}).get('max_tokens'),
                     'contador': bool((subagentes_config or {}).get('contador'))},
                    rastro, _log, _stream,
                    rodadas_feitas=rodadas_feitas,
                    chamadas_pendentes=chamadas,
                    resposta_pendente=pendente.get('content') or '',
                    concedidas=concedidas, obter_parada=obter_parada)

                data['messages'] = novas
                self._save_chat_data(project_name, chat_id, data)
                _log({'agente': 'chat', 'resposta_bruta': full_response})

                payload = self._build_payload_items(novas)
                self._save_chat_contexto(project_name, chat_id, payload)
                self._chat_js(project_name, 'chatContextoDoStream', payload)
                self._chat_js(project_name, 'finishMessage', data.get('title') or '')

            except Exception as e:
                # Mesmo conserto do `send_message`, e aqui dói mais: os
                # subagentes desta retomada JÁ RODARAM e já custaram.
                #
                # ⚠️ E a chamada barrada volta para o fim ANTES de gravar. Ela
                # foi TIRADA de `messages` acima para reentrar pelo laço com o
                # meta normal; se o laço não chegou a devolvê-la — é o que
                # acontece quando o subagente estoura no meio —, a gravação de
                # emergência escrevia a conversa SEM ela. Sumia a última fala do
                # modelo e, com ela, a marca `chamada_barrada`: o botão
                # "Retomar" nunca mais aparecia, e não havia mais o que retomar.
                if pendente is not None and len(messages) == antes_do_laco:
                    messages.append(pendente)
                self._chat_gravar_o_que_houver(project_name, chat_id, data, messages)
                self._chat_js(project_name, 'chatError', str(e))
            finally:
                self._chat_marcar_em_resposta(project_name, chat_id, False)
                self._chat_zerar_parada(project_name, chat_id)
                self._chat_esquecer_gravacao(project_name, chat_id)
                reserva.__exit__(None, None, None)
                try:
                    self.window.evaluate_js('atualizarTravaIA()')
                except Exception:
                    pass

        # Mesmo motivo do `send_message`: sem worker não há `finally`, e a
        # trava ficaria presa.
        try:
            threading.Thread(target=worker, daemon=True).start()
        except Exception as e:
            reserva.__exit__(None, None, None)
            return {'success': False, 'error': str(e)}
        return {'success': True}
