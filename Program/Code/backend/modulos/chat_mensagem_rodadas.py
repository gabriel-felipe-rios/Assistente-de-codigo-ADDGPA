"""O laço de rodadas de subagentes: o modelo pede, o programa executa, e volta.

O mesmo desenho da Fila — o modelo emite `{"chamadas": [...]}`, o programa roda
os subagentes e devolve os resultados —, com uma diferença de horizonte que
explica quase tudo: aqui **alguém está esperando na frente da tela**. Por isso o
teto de fábrica é 2 rodadas e não 30, e por isso o Parar corta no meio.

⚠️ O BLOCO DO RASTRO DE LEITURA É UM SÓ, SUBSTITUÍDO A CADA RODADA — nunca
empilhado. Empilhá-lo faz a conta corrente de leitura crescer sem limite dentro
da janela, e o modelo passa a ler o histórico das próprias leituras em vez do
código.

⚠️ QUANDO O TETO BARRA UMA CHAMADA, A MENSAGEM FICA CARIMBADA
(`META_CHAMADA_BARRADA`) e não se perde: é dela que `retomar_rodadas_chat` parte
(ver `chat_mensagem_retomar.py`). Uma chamada barrada e esquecida faria o botão
de retomar não ter de onde continuar.
"""

from .chat_mensagem_constantes import *
from .agentes.execucao.subagentes_constantes import MAX_PARALELO


class ChatMensagemRodadasMixin:

    # ── O laço de rodadas de subagentes ──────────────────────────────────────
    def _chat_laco_de_rodadas(self, project_name, chat_id, model, messages, cfg,
                              rastro, log_cb, stream, rodadas_feitas=0,
                              chamadas_pendentes=None, resposta_pendente='',
                              concedidas=0, obter_parada=None):
        """Vai e volta ao modelo até ele responder ao usuário ou o teto acabar.

        Mora aqui, e não dentro de `send_message`, porque a RETOMADA precisa do
        mesmo laço: ela entra com as chamadas que ficaram barradas, executa e
        segue daí. Duplicar o laço faria duas versões da mesma regra de teto, de
        correção e de contagem, e elas divergiriam no primeiro conserto.

        `chamadas_pendentes` é o único jeito de entrar pelo MEIO: em vez de
        perguntar ao modelo, o laço começa executando o que já estava decidido.
        `resposta_pendente` é o texto daquela mensagem, que volta ao histórico
        como a chamada normal de sempre.

        Devolve `(messages, ultima_resposta)`.
        """
        from modulos.agentes.json_tolerante import (extrair_json_com_chave,
                                                    validar_chamadas)

        subs_ativos = cfg['subs_ativos']
        max_rodadas = cfg['max_rodadas']
        max_tokens_resposta = cfg['max_tokens']
        contador_ativo = cfg['contador']

        tentativas_correcao = 0
        chamadas = chamadas_pendentes
        full_response = resposta_pendente
        concessao_a_anunciar = concedidas

        def _parada():
            return obter_parada() if obter_parada is not None else 0

        while True:
            if chamadas is None:
                full_response = stream(messages)

                # ⚠️ CAMINHO DE SAÍDA PRÓPRIO, e ANTES do parser. Um `break`
                # simples aqui cairia no ramo de correção logo abaixo e mandaria
                # OUTRA pergunta ao modelo depois do Parar — três vezes, e na
                # terceira o caminho de desistência quebrava.
                #
                # ℹ️ Estágio 1 com resposta normal e completa NÃO passa por
                # aqui: a resposta chegou inteira, e carimbá-la de "pela metade"
                # seria mentira. O que ela impede é abrir uma rodada NOVA.
                estagio = _parada()
                if estagio >= 2:
                    self._chat_encerrar_por_parada(messages, full_response,
                                                   estagio, log_cb)
                    break

                if not subs_ativos:
                    messages.append({'role': 'assistant', 'content': full_response})
                    break

                obj, err = extrair_json_com_chave(full_response, 'chamadas')
                if obj is None and err is None:
                    # Resposta normal ao usuário
                    messages.append({'role': 'assistant', 'content': full_response})
                    break

                if obj is not None:
                    chamadas, err = validar_chamadas(obj, subs_ativos)

                if err:
                    tentativas_correcao += 1
                    if tentativas_correcao > 2:
                        # Desiste. A resposta crua NÃO vira a resposta na tela —
                        # o JSON quebrado ficava visível como se fosse o que o
                        # modelo quis dizer. Ela continua guardada (aba Contexto
                        # e log.json), e o usuário recebe um erro limpo, igual
                        # ao que os subagentes já fazem.
                        messages.append({'role': 'assistant', 'content': full_response,
                                         'meta': {'tipo': 'chamada_invalida'}})
                        self._chat_js(project_name, 'discardStreaming')
                        # ⚠️ Não prometer o que não vai acontecer. Num chat do
                        # formato antigo (arquivo único, sem pasta) não existe
                        # log.json, e esta frase era falsa — sem nada avisando.
                        onde = ('A resposta crua ficou guardada no Log deste chat.'
                                if self._chat_tem_log_em_disco(project_name, chat_id)
                                else 'A resposta crua está na aba Contexto — este chat '
                                     'é do formato antigo e não tem Log em disco.')
                        aviso = ('O modelo não devolveu um JSON válido depois de 2 '
                                 'tentativas de correção. ' + onde)
                        self._chat_js(project_name, 'chatAviso', aviso)
                        log_cb({'agente': 'sistema', 'mensagem': aviso, 'erro': err})
                        break
                    self._chat_js(project_name, 'discardStreaming')
                    correcao = (self._ler_prompt(obter_prompt_do_assistente(
                        PASTA_CHAT, 'prompt-correcao.txt'))
                                .replace('{descricao_erro}', err)
                                .replace('{subagentes_ativos}', ', '.join(subs_ativos))
                                .replace('{max_chamadas_por_vez}', str(MAX_PARALELO)))
                    messages.append({'role': 'assistant', 'content': full_response,
                                     'meta': {'tipo': 'chamada_invalida'}})
                    messages.append({'role': 'user', 'content': correcao,
                                     'meta': {'tipo': 'correcao'}})
                    log_cb({'agente': 'correcao', 'alvo': 'chat',
                            'descricao_erro': err, 'tentativa': tentativas_correcao})
                    # A correção é MAQUINARIA: ela não vira balão na conversa
                    # (`renderMessages` a esconde), e a aba Contexto é o único
                    # lugar onde ela aparece. Sem esta linha, o que se vê é o
                    # modelo em silêncio — e não o programa mandando refazer.
                    self._chat_contexto_ao_vivo(project_name, messages)
                    chamadas = None
                    continue

                if rodadas_feitas >= max_rodadas:
                    # Limite de rodadas atingido — não executa mais chamadas. A
                    # chamada fica GRAVADA com a marca e com o contador: é dela
                    # que a retomada parte, e é ela que o frontend usa para
                    # desenhar a faixa e oferecer o botão.
                    messages.append({'role': 'assistant', 'content': full_response,
                                     'meta': {'tipo': META_CHAMADA_BARRADA,
                                              'rodadas_feitas': rodadas_feitas}})
                    break

                tentativas_correcao = 0

            # ⚠️ Estágio 1, conferido AQUI: a rodada em voo já terminou (o
            # stream fechou e o envelope foi lido), e executar estas chamadas
            # seria abrir uma rodada NOVA — o oposto de "pare no fim da que
            # está em voo".
            #
            # ℹ️ O lugar é este, e não junto da saída do estágio 2 lá em cima,
            # porque ali ainda não se sabe se a resposta É uma chamada: saber
            # exige o parser, e adivinhar pelo texto cru erraria numa resposta
            # normal que só mencionasse a palavra.
            estagio = _parada()
            if estagio:
                self._chat_encerrar_por_parada(messages, full_response,
                                               estagio, log_cb)
                break

            rodadas_feitas += 1
            self._chat_js(project_name, 'startSubagentCalls', chamadas)
            resultados, bloco = self._executar_chamadas_subagentes(
                project_name, chamadas, model, log_cb, max_tokens_resposta,
                rastro, obter_parada)
            self._chat_js(project_name, 'finishSubagentCalls', resultados)

            # ⚠️ A SEGUNDA CONFERÊNCIA, e ela não é redundante: sem esta linha o
            # laço segue e manda outra pergunta ao modelo DEPOIS do Parar. O Log
            # diria que parou, e o programa estaria falando com o LM Studio.
            #
            # ℹ️ Os resultados dos subagentes NÃO são jogados fora — eles já
            # foram para a conversa e para o disco lá embaixo... exceto que aqui
            # ainda não. Por isso o bloco entra ANTES de encerrar: o que rodou
            # já foi pago, e é o mesmo princípio da entrega parcial.
            estagio = _parada()
            if estagio:
                messages.append({'role': 'assistant', 'content': full_response,
                                 'meta': {'tipo': 'chamada_subagentes',
                                          'chamadas': chamadas}})
                messages.append({'role': 'user', 'content': bloco,
                                 'meta': {'tipo': 'resultado_subagentes',
                                          'resultados': resultados,
                                          'aviso': None}})
                self._chat_encerrar_por_parada(messages, '', estagio, log_cb)
                break

            # ⚠️ A conta CONTINUA de onde parou na retomada, e o aviso diz que
            # foram concedidas. Recomeçar em "1 de 2" deixaria o histórico com
            # "Estes são os últimos resultados" e, três linhas depois, "Você usou
            # 1 de 2" — duas afirmações que se contradizem, para um leitor que é
            # um modelo de linguagem.
            partes_aviso = []
            if concessao_a_anunciar:
                partes_aviso.append(
                    '[AVISO DO SISTEMA] O usuário concedeu mais '
                    f'{concessao_a_anunciar} rodada(s) de chamadas de subagentes.')
                concessao_a_anunciar = 0
            cabecalho = '' if partes_aviso else '[AVISO DO SISTEMA] '
            if rodadas_feitas >= max_rodadas:
                partes_aviso.append(cabecalho + 'Estes são os últimos resultados — '
                                    'responda ao usuário agora.')
            elif contador_ativo:
                restantes = max_rodadas - rodadas_feitas
                partes_aviso.append(
                    cabecalho + f'Você usou {rodadas_feitas} de {max_rodadas} '
                    'rodada(s) de chamadas de subagentes. '
                    f'Resta(m) {restantes} rodada(s).')

            aviso_sistema = None
            if partes_aviso:
                aviso_sistema = '\n'.join(partes_aviso)
                bloco += '\n\n' + aviso_sistema
                if contador_ativo or concedidas:
                    log_cb({'agente': 'sistema', 'mensagem': aviso_sistema})

            messages.append({'role': 'assistant', 'content': full_response,
                             'meta': {'tipo': 'chamada_subagentes',
                                      'chamadas': chamadas}})
            messages.append({'role': 'user', 'content': bloco,
                             'meta': {'tipo': 'resultado_subagentes',
                                      'resultados': resultados,
                                      'aviso': aviso_sistema}})

            # O rastro de leitura: ACUMULADO e SUBSTITUÍDO, nunca empilhado —
            # um bloco só, de tamanho constante na rodada 3 ou na 30. Mesmo
            # mecanismo do system prompt: remove a versão anterior pelo meta
            # antes de pôr a nova.
            #
            # ⚠️ Os NÚMEROS CRUS vão no `meta`, junto do texto. É isso que faz o
            # rastro atravessar a retomada: o objeto vive em memória e morre
            # quando o envio acaba, e o bloco de texto é substituído a cada
            # rodada — na primeira parte lida depois de retomar, o bloco novo
            # comeria o acumulado e o orquestrador mandaria reler tudo, gastando
            # justamente as rodadas recém-concedidas. Reidratar interpretando o
            # TEXTO foi avaliado e descartado: o formato do bloco já mudou uma
            # vez, e um leitor de texto quebraria em silêncio na próxima. O
            # `meta` não chega ao LM Studio (`preparar_mensagens` copia só
            # `role` e `content`), então isto é neutro para o cache.
            linha_rastro = rastro.bloco()
            if linha_rastro:
                # ⚠️ `messages[:] =` e não `messages =`. Rebindar troca a lista
                # LOCAL e deixa a do chamador para trás: a gravação de
                # emergência do `except` guarda a variável dele, e a partir
                # daqui ela deixaria de ver as rodadas seguintes. Salvava a
                # conversa até a primeira leitura e perdia todo o resto — que é
                # justamente o trabalho que já foi pago. A Fila já faz assim
                # (`msgs[:]`, em fila/execucao.py); o Chat era o que destoava.
                messages[:] = [m for m in messages
                               if (m.get('meta') or {}).get('tipo') != META_RASTRO]
                meta_rastro = {'tipo': META_RASTRO}
                meta_rastro.update(rastro.dados())
                messages.append({'role': 'user', 'content': linha_rastro,
                                 'meta': meta_rastro})

            # Fim da rodada: a chamada, os resultados, o aviso do sistema e o
            # rastro de leitura já entraram. É o retrato mais completo que
            # existe antes da próxima ida ao modelo — e é exatamente o que a
            # aba Contexto precisa mostrar enquanto a resposta ainda vem.
            self._chat_contexto_ao_vivo(project_name, messages)

            chamadas = None

        return messages, full_response
