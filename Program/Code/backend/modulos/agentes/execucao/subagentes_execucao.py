"""Rodar UM subagente: o laço de ferramentas, o portão de contexto e a entrega.

⚠️ ENTREGA PARCIAL É ENTREGA. Um subagente cortado no meio — pela parada, pelo
portão de contexto, por resposta cortada do modelo — devolve o que já leu, com
`erro` preenchido e `erro_tipo='parcial'`. Descartar seria jogar fora rodadas
pagas, e é por isso que `erro_tipo` 'parcial' e 'caminho' NÃO carimbam a tarefa
de "subagente indisponível" lá na Fila: eles apareciam em 4 de 5 relatórios, e
uma ressalva que aparece sempre deixa de significar alguma coisa.

⚠️ ERRO DE CAMINHO NÃO É FALHA. O Navegador respondendo "essa pasta não existe"
é exploração dando certo — chutar caminho é o trabalho dele.

⚠️ O PORTÃO DE CONTEXTO CORTA ANTES DE ESTOURAR, e avisa. Um subagente que
enche a janela e recebe um 400 do servidor perde a rodada inteira; cortado
antes, ele responde com o que tem.

⚠️ O PORTEIRO DA PARADA DESISTE ANTES DE PEDIR A PRÓXIMA COISA, nunca no meio de
uma requisição já paga. É o que deixa o Cancelar rápido sem contrariar a regra
de não abortar trabalho pago.
"""

from .subagentes_constantes import *
from .subagentes_constantes import ParadaPedida
from ...llm_geracao import ajustes_da_chamada
from ...extensoes.prompts import acrescimos_de_prompt, aplicar_acrescimos, envelope_de_extensao


class SubagentesExecucaoMixin:

    # ── Execução de um subagente ──────────────────────────────────────────────
    def executar_subagente(self, project_name, nome, pergunta, model, log_cb=None,
                           max_tokens=None, portao=None, rastro=None,
                           obter_parada=None, origem='Chat',
                           rotulo='PERGUNTA DO ORQUESTRADOR'):
        """Executa um subagente stateless. Retorna dict:
        {'nome', 'pergunta', 'resposta', 'erro' (str|None), 'contexto': [mensagens]}

        `origem` é quem pergunta (Chat ou Fila) e vai no rótulo do envelope: o
        subagente precisa saber que é pedido de outro agente, e não mensagem do
        usuário.

        `portao` é o PortaoDeContexto compartilhado pelas chamadas do mesmo lote
        (ver `_executar_chamadas_subagentes`). Sem ele, a chamada segue direto —
        é o caso do Verificador da Fila, que roda sozinho, fora do pool.

        `obter_parada` é o "devo parar?" do Chat: um chamável sem argumentos que
        devolve o estágio pedido (0/1/2 — ver `_chat_subir_parada`). Ele desce de
        cima porque o subagente não tem como saber de qual chat ele é.

        ⚠️ O padrão `None` NÃO é descuido, é o que protege o resto do programa:
        quem não passa nada nunca é abortado. É o caso do Verificador da Fila,
        que chama este método direto, fora do pool — sem o padrão, um Parar do
        Chat derrubaria a verificação de uma tarefa da Fila."""
        log_cb = log_cb or (lambda ev: None)
        inicio = datetime.now().isoformat()
        log_cb({'agente': 'subagente', 'nome': nome, 'evento': 'inicio',
                'pergunta': pergunta, 'inicio': inicio})

        # Tokens REAIS de entrada e saída, somados por chamada ao modelo. Vêm do
        # `usage` da própria API — é o que alimenta a barra de tokens do Log.
        # O Navegador não usa LLM, então fica sempre em zero.
        uso = {'entrada': 0, 'saida': 0}

        def _somar_uso(resp):
            u = getattr(resp, 'usage', None)
            if u is None:
                return
            uso['entrada'] += getattr(u, 'prompt_tokens', 0) or 0
            uso['saida'] += getattr(u, 'completion_tokens', 0) or 0

        # `erro_tipo` separa duas coisas que o campo `erro` sozinho confundia:
        # 'caminho' é o subagente funcionando e respondendo que aquele caminho
        # não serve — exploração normal —, e 'execucao' é o subagente não ter
        # conseguido rodar. Quem lê é a Fila, para decidir se carimba a tarefa
        # com a ressalva "subagente indisponível".
        def _fim(resposta, erro=None, contexto=None, erro_tipo=None):
            log_cb({'agente': 'subagente', 'nome': nome, 'evento': 'fim',
                    'pergunta': pergunta, 'inicio': inicio,
                    'fim': datetime.now().isoformat(),
                    'resposta': resposta, 'erro': erro,
                    'contexto': contexto or [], 'uso': dict(uso)})
            return {'nome': nome, 'pergunta': pergunta, 'resposta': resposta,
                    'erro': erro, 'erro_tipo': erro_tipo,
                    'contexto': contexto or [], 'uso': dict(uso)}

        # Navegador: sem LLM — pergunta é o caminho da pasta
        if nome == 'navegador':
            try:
                # ⚠️ O corte por token vale para ele também. Todo subagente LLM
                # tem a resposta cortada em `max_tokens_resposta` lá embaixo; o
                # Navegador não passa por aquele caminho — ele não usa LLM — e
                # por isso não passava por corte NENHUM. O teto de itens da
                # ferramenta já segura o caso comum; este é o cinto de segurança
                # para uma pasta com nomes muito longos.
                listagem = self._ferr_listar_pasta(project_name, pergunta)
                teto_navegador = self._sub_max_tokens_resposta(max_tokens)
                if contar_tokens(listagem) > teto_navegador:
                    listagem = (cortar_em_tokens(listagem, teto_navegador) +
                                f'\n(listagem truncada em {teto_navegador} tokens — '
                                'liste uma subpasta para ver o resto)')
                return _fim(listagem)
            except ValueError as e:
                # Ele não passa pelo dispatcher, e por isso os erros dele nunca
                # chegavam ao rastro de leitura: o orquestrador repetia o mesmo
                # caminho errado rodada após rodada sem nada lembrá-lo.
                if rastro is not None:
                    rastro.registrar_erro('navegador', pergunta, str(e))
                return _fim(None, erro=str(e), erro_tipo='caminho')
            except Exception as e:
                return _fim(None, erro=f'falha inesperada: {e}', erro_tipo='execucao')

        # O subagente de extensão só roda com a extensão LIGADA agora; os do
        # programa nem chegam a ler a pasta das extensões (`pedidos`).
        if nome not in com_subagentes_de_extensoes(SUBAGENTES_LLM_VALIDOS, [nome]):
            return _fim(None, erro=f'subagente desconhecido: {nome}', erro_tipo='execucao')

        settings = self.load_settings()['settings']
        # ⚠️ A CHAVE depende de QUEM está rodando: o Verificador da Fila lê a
        # dele, todos os outros continuam lendo a de sempre. Ver o porquê em
        # MAX_RODADAS_FERRAMENTAS_VERIFICADOR_PADRAO, no topo do arquivo.
        if nome == VERIFICADOR_DA_FILA:
            chave_rodadas = 'max_rodadas_ferramentas_verificador'
            padrao_rodadas = MAX_RODADAS_FERRAMENTAS_VERIFICADOR_PADRAO
        else:
            chave_rodadas = 'max_rodadas_ferramentas'
            padrao_rodadas = MAX_RODADAS_FERRAMENTAS_PADRAO
        try:
            max_rodadas = int(settings.get(chave_rodadas, padrao_rodadas))
        except (TypeError, ValueError):
            max_rodadas = padrao_rodadas
        try:
            max_ferramentas = int(settings.get('max_ferramentas_rodada',
                                               MAX_FERRAMENTAS_RODADA_PADRAO))
        except (TypeError, ValueError):
            max_ferramentas = MAX_FERRAMENTAS_RODADA_PADRAO
        max_ferramentas = max(1, max_ferramentas)
        max_tentativas = self._sub_limite('max_tentativas_correcao')

        try:
            system_prompt = self._ler_prompt(
                obter_prompt_do_subagente(nome, 'system-prompt.txt'))
            # O marcador pode sobrar em prompt de extensão antigo; a pergunta
            # NÃO vai mais no system (D42) — vai uma vez, no envelope do user.
            system_prompt = (aplicar_acrescimos(system_prompt, acrescimos_de_prompt(
                                 self, 'subagente.' + nome, project_name))
                              .replace('{pergunta}', '')
                              .replace('{max_rodadas_ferramentas}', str(max_rodadas))
                              .replace('{max_ferramentas_rodada}', str(max_ferramentas)))
        except Exception as e:
            return _fim(None, erro=f'falha ao carregar prompt: {e}')

        from ...llm_cliente import abrir_cliente_do_lm_studio

        timeout_total = self._sub_timeout_segundos()
        deadline = time.monotonic() + timeout_total if timeout_total else None

        def _restante():
            """O porteiro: quanto tempo ainda há, e ainda é para continuar?

            ⚠️ Este é o ÚNICO lugar onde a bandeira de parada precisa ser
            conferida dentro do subagente, e é de propósito. Só dois pontos do
            programa chamam esta função — antes de cada pergunta ao modelo e
            antes de cada ferramenta —, que são exatamente os dois lugares onde
            faz sentido desistir. Conferir aqui dentro faz os dois obedecerem
            sem que nenhum deles seja tocado.

            ℹ️ Só o estágio 2 ("cortar agora") aborta. O estágio 1 é "pare no
            fim da rodada em voo": o que já foi pedido termina, e quem para o
            laço é o Chat, lá em cima.

            ℹ️ Quem chama já devolve `_entrega_parcial()` no `except` — então o
            que o subagente chegou a LER não se perde ao ser abortado.
            """
            if obter_parada is not None and obter_parada() >= 2:
                raise ParadaPedida()
            if deadline is None:
                return None
            r = deadline - time.monotonic()
            if r <= 0:
                raise TimeoutError()
            return r

        # O `system` é só o prompt de quem responde; a pergunta chega UMA vez,
        # no `user`, com o rótulo da casa (regra "Instrução no system, conteúdo
        # no envelope").
        conteudo_user = '[%s — %s]\n%s' % (rotulo, origem, pergunta)
        # O envelope próprio de um subagente de extensão (`"envelope": true`, D51):
        # é por ele que um subagente recebe, junto da pergunta, o que pode ler.
        conteudo_user += envelope_de_extensao(self, nome, project_name)
        messages = [{'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': conteudo_user}]
        # Para os do programa, a linha de `FERRAMENTAS_POR_SUBAGENTE` mais as que
        # uma extensão ligada empresta; o de extensão, as que declarou (D51).
        ferramentas_validas = ferramentas_do_subagente(nome)
        max_tokens_resposta = self._sub_max_tokens_resposta(max_tokens)

        def _entrega_parcial():
            """O que o subagente DE FATO leu, quando ele não chegou a responder.

            O nome do recurso é **entrega parcial**. ⚠️ NÃO é "resgate":
            `Resgate da resposta` (texto_llm.py) já existe e é outra coisa —
            limpa uma resposta que o modelo DEU, cortando o rascunho. Aqui não
            houve resposta nenhuma.

            Por que existe: o Leitor gasta as 3 rodadas lendo, acha o trecho
            certo na terceira e não tem a quarta para responder. Tudo isso era
            jogado fora e quem chamou recebia só a palavra ERRO — e normalmente
            perguntava a mesma coisa de novo. Foi assim que uma tarefa girou 23
            rodadas.

            ⚠️ Nada de esquema JSON forçado na resposta para resolver isto:
            esquema garante o FORMATO, não o CONTEÚDO, e o subagente que não
            achou nada, obrigado a preencher campos, escreve invenção com cara
            de resposta. A entrega parcial devolve o que foi lido de verdade.
            """
            # Um bloco = um [RESULTADO — ferramenta]. A rodada manda VÁRIOS
            # numa mensagem só, então recolher a mensagem inteira misturaria
            # leituras boas com erros e com o aviso interno da última rodada.
            blocos = []
            for m in messages:
                if m.get('role') != 'user':
                    continue
                conteudo = m.get('content') or ''
                if '[RESULTADO — ' not in conteudo:
                    continue
                # O aviso da última rodada é uma ORDEM endereçada ao subagente
                # ("responda agora com o que você tem") e viaja colado no mesmo
                # bloco. Entrando aqui, ele chega ao agente principal
                # apresentado como conteúdo lido.
                if conteudo.endswith(AVISO_ULTIMA_RODADA_FERRAMENTAS):
                    conteudo = conteudo[:-len(AVISO_ULTIMA_RODADA_FERRAMENTAS)]
                for parte in re.split(r'\n\n(?=\[RESULTADO — )', conteudo):
                    parte = parte.strip()
                    if not parte.startswith('[RESULTADO — '):
                        continue
                    # Linha de erro não é "o que encontrei": sob esse cabeçalho
                    # ela seria lida como leitura bem-sucedida.
                    corpo = parte.split('\n', 1)[1] if '\n' in parte else ''
                    if corpo.lstrip().startswith('ERRO'):
                        continue
                    blocos.append(parte)
            if not blocos:
                return None

            cabecalho = 'Não concluí a resposta, mas isto foi o que encontrei:'

            def _montar(escolhidos):
                de_fora = len(blocos) - len(escolhidos)
                rodape = ''
                if de_fora:
                    rodape = (f'\n\n(as {de_fora} primeira(s) leitura(s) ficaram de '
                              f'fora: a entrega parcial cabe em '
                              f'{max_tokens_resposta} tokens)')
                return cabecalho + '\n\n' + '\n\n'.join(escolhidos) + rodape

            # O corte é POR BLOCO e do FIM para o começo. Cortar o texto já
            # concatenado por tokens devolvia o COMEÇO — justamente o oposto do
            # motivo de o recurso existir — e ainda partia um [RESULTADO — …]
            # ao meio, entregando meia leitura sem cabeçalho.
            custos = [contar_tokens(p) + 2 for p in blocos]  # +2: o '\n\n'
            fixo = contar_tokens(cabecalho) + 40  # cabeçalho + rodapé
            escolhidos = list(blocos)
            gasto = sum(custos)
            i = 0
            while len(escolhidos) > 1 and fixo + gasto > max_tokens_resposta:
                gasto -= custos[i]
                i += 1
                escolhidos.pop(0)  # o mais ANTIGO sai primeiro
            texto = _montar(escolhidos)
            if contar_tokens(texto) > max_tokens_resposta:
                # Um único bloco maior que o teto: não há escolha de blocos a
                # fazer, e este é o único caso em que o corte por token é o
                # certo. Corta o BLOCO, não o texto montado — cortando o texto,
                # o rodapé (que fica no fim) era o primeiro a cair, e o
                # resultado ainda estourava o teto pelo aviso acrescentado.
                aviso = f'\n(leitura truncada em {max_tokens_resposta} tokens)'
                fora_do_bloco = contar_tokens(texto) - contar_tokens(escolhidos[-1])
                espaco = max_tokens_resposta - fora_do_bloco - contar_tokens(aviso)
                escolhidos[-1] = cortar_em_tokens(escolhidos[-1], max(espaco, 1)) + aviso
                texto = _montar(escolhidos)
            return texto

        rodadas = 0
        rodadas_so_erro = 0
        correcoes = 0
        # Quantas vezes a resposta veio cortada no teto de saída. Uma segunda
        # vez encerra: pedir "mais curto" de novo é gastar rodada com o mesmo
        # resultado.
        cortadas = 0

        # Admissão pelo PortaoDeContexto: a janela do LM Studio é UMA só, e o KV
        # cache das requisições simultâneas divide o mesmo espaço. Sem o portão,
        # quatro subagentes disparados de uma vez estouram a janela — inclusive a
        # requisição pequena que só teve o azar de estar em voo junto das grandes.
        # Esperar AQUI é admissão: o subagente ainda não começou e nada se perde.
        # A regra 'nunca espera, encerra com o que tem' vale para o MEIO do laço
        # de ferramentas, quando já há resultado na mão — não para a entrada.
        custo = (contar_tokens(system_prompt) + contar_tokens(conteudo_user) +
                 max_tokens_resposta)
        reserva = portao.reservar(custo) if portao is not None else nullcontext()

        try:
            with reserva:
                client = abrir_cliente_do_lm_studio(settings, projeto=project_name)
                while True:
                    # ⚠️ `max_tokens` agora VAI. O teto era calculado, reservado
                    # no portão de contexto e depois usado só para cortar o
                    # texto JÁ RECEBIDO: uma resposta de 12k tokens era gerada
                    # inteira, paga inteira, e jogada fora até 2000. Este era o
                    # único ponto do backend que declarava um teto de saída e
                    # não o passava ao servidor — outros seis passam.
                    resp = client.chat.completions.create(
                        model=model, messages=messages, stream=False,
                        max_tokens=max_tokens_resposta,
                        timeout=_restante(),
                        **ajustes_da_chamada(settings, 'subagentes', model),
                    )
                    _somar_uso(resp)
                    # ⚠️ Com o teto valendo no servidor, a resposta pode chegar
                    # CORTADA — e um JSON cortado no meio vira "formato
                    # inválido", gastando uma rodada de correção com o
                    # diagnóstico errado. `conferir_terminou` existe para isso e
                    # nunca era chamada aqui.
                    try:
                        conferir_terminou(resp)
                    except RespostaCortada:
                        cortadas += 1
                        if cortadas > 1:
                            # Já pedimos uma vez para encurtar e ele estourou de
                            # novo: o que foi lido vale mais que outra tentativa.
                            return _fim(_entrega_parcial(),
                                        erro=f'a resposta não coube em '
                                             f'{max_tokens_resposta} tokens',
                                        contexto=messages, erro_tipo='parcial')
                        messages.append({'role': 'assistant',
                                         'content': resp.choices[0].message.content or ''})
                        messages.append({'role': 'user',
                                         'content': '[AVISO DO SISTEMA] Sua resposta foi '
                                                    f'cortada no limite de '
                                                    f'{max_tokens_resposta} tokens. '
                                                    'Responda de novo, mais curto.'})
                        continue
                    # ⚠️ O texto CRU vai para o histórico — com o raciocínio
                    # dentro. É decisão registrada, e é contra o instinto: o
                    # pensamento da rodada anterior ajuda a rodada seguinte, e
                    # reescrever a mensagem quebra o reaproveitamento do cache
                    # do servidor, que casa prefixo por prefixo. O corte vale só
                    # na ENTREGA — a `resposta` que este subagente devolve ao
                    # agente principal, lá embaixo.
                    raw = resp.choices[0].message.content or ''
                    messages.append({'role': 'assistant', 'content': raw})

                    # O parse roda sobre uma CÓPIA limpa: o JSON de chamada de
                    # ferramenta pode vir depois de um `</think>`, e procurá-lo
                    # no texto cru acharia primeiro o rascunho que o modelo
                    # escreveu dentro do próprio raciocínio.
                    limpo = strip_thinking(raw)
                    obj, err = extrair_json_com_chave(limpo, 'ferramentas')

                    # ⚠️ ANTES do ramo de resposta final. Um `<think>` que o
                    # modelo nunca fecha faz `strip_thinking` devolver string
                    # VAZIA — e vazio não tem JSON, então caía direto no ramo de
                    # baixo e voltava com `erro=None` e resposta `''`. O agente
                    # principal recebia `[RESULTADO — leitor]` seguido de nada,
                    # apresentado como SUCESSO, e a entrega parcial (que tinha o
                    # conteúdo real) nem chegava a ser chamada.
                    if obj is None and err is None and not limpo.strip():
                        correcoes += 1
                        if correcoes > max_tentativas:
                            return _fim(_entrega_parcial(),
                                        erro='respondeu só com raciocínio, sem resposta',
                                        contexto=messages, erro_tipo='parcial')
                        messages.append({'role': 'user',
                                         'content': '[AVISO DO SISTEMA] A sua resposta veio '
                                                    'só com o bloco de raciocínio e nada '
                                                    'fora dele. Escreva a resposta em si.'})
                        log_cb({'agente': 'correcao', 'alvo': nome,
                                'descricao_erro': 'resposta só com raciocínio',
                                'tentativa': correcoes})
                        continue

                    if obj is None and err is None:
                        # Resposta final — aqui sim, entregue limpa. É esta a
                        # ponta que o interruptor "Resgate da resposta" governa
                        # nos subagentes: desligado, o agente principal recebe o
                        # texto como o modelo mandou. O `limpo` de cima continua
                        # existindo de qualquer jeito — ele é do PARSE, e sem ele
                        # o JSON de chamada de ferramenta não seria encontrado.
                        resposta = limpar_entrega(raw, self._resgate_ligado())
                        # Corta por TOKEN, contado com tiktoken — nao por caractere.
                        # O corte volta a texto pelo mesmo encoder, entao o que
                        # sobra cabe exatamente no teto que voce configurou.
                        if contar_tokens(resposta) > max_tokens_resposta:
                            resposta = (cortar_em_tokens(resposta, max_tokens_resposta) +
                                        f'\n(resposta truncada em {max_tokens_resposta} tokens — '
                                        'o teto é configurável na sub-aba Subagentes)')
                        return _fim(resposta, contexto=messages)

                    ferramentas = None
                    if obj is not None:
                        ferramentas, err = validar_ferramentas(obj, ferramentas_validas,
                                                               max_ferramentas)

                    if err:
                        correcoes += 1
                        if correcoes > max_tentativas:
                            return _fim(_entrega_parcial(),
                                        erro='devolveu formato inválido após '
                                        f'{max_tentativas} correções',
                                        contexto=messages, erro_tipo='parcial')
                        correcao = (self._ler_prompt(
                            obter_prompt_do_subagente(nome, 'prompt-correcao.txt'))
                                    .replace('{descricao_erro}', err)
                                    .replace('{ferramentas_validas}', ', '.join(ferramentas_validas))
                                    .replace('{max_ferramentas_rodada}', str(max_ferramentas))
                                    .replace('{max_rodadas_ferramentas}', str(max_rodadas)))
                        messages.append({'role': 'user', 'content': correcao})
                        log_cb({'agente': 'correcao', 'alvo': nome,
                                'descricao_erro': err, 'tentativa': correcoes})
                        continue

                    if rodadas >= max_rodadas:
                        return _fim(_entrega_parcial(),
                                    erro='não respondeu dentro do limite de rodadas '
                                    'de ferramentas', contexto=messages,
                                    erro_tipo='parcial')

                    partes = []
                    houve_sucesso = False
                    for f in ferramentas:
                        f_inicio = datetime.now().isoformat()
                        _restante()  # checa deadline antes de cada ferramenta
                        resultado = self.executar_ferramenta(project_name, nome,
                                                             f['nome'], f['parametros'],
                                                             rastro)
                        if not resultado.startswith('ERRO'):
                            houve_sucesso = True
                        log_cb({'agente': 'ferramenta', 'subagente': nome,
                                'nome': f['nome'], 'parametros': f['parametros'],
                                'resultado': resultado, 'inicio': f_inicio,
                                'fim': datetime.now().isoformat()})
                        partes.append(f'[RESULTADO — {f["nome"]}]\n{resultado}')

                    # Rodada em que TODAS as ferramentas falharam não consome o
                    # orçamento: o subagente não recebeu nada de útil, e antes três
                    # erros seguidos esgotavam o limite e ele devolvia nada
                    # aproveitável. O teto próprio evita o laço infinito.
                    if houve_sucesso:
                        rodadas += 1
                        rodadas_so_erro = 0
                    else:
                        rodadas_so_erro += 1
                        # `>=`, e não `>`: com `>` o corte só disparava quando o
                        # contador chegava a 4 — quatro rodadas de erro tinham
                        # acontecido e sido pagas, e a mensagem dizia "3 rodadas
                        # seguidas". ℹ️ O irmão logo abaixo (`correcoes >
                        # max_tentativas`) está CERTO e não deve ser mexido: lá
                        # o teto conta correções ENVIADAS, e 2 correções saem e
                        # a mensagem diz "após 2 correções".
                        if rodadas_so_erro >= MAX_RODADAS_SO_ERRO:
                            return _fim(_entrega_parcial(),
                                        erro='as ferramentas falharam em '
                                        f'{MAX_RODADAS_SO_ERRO} rodadas seguidas',
                                        contexto=messages, erro_tipo='parcial')

                    bloco = '\n\n'.join(partes)
                    if rodadas >= max_rodadas:
                        bloco += AVISO_ULTIMA_RODADA_FERRAMENTAS
                    messages.append({'role': 'user', 'content': bloco})

        except ParadaPedida:
            # ⚠️ ANTES do `except Exception`, e com classe própria: caindo no
            # genérico, a tela mostraria o nome da classe Python; caindo no
            # `TimeoutError` de baixo, diria "excedeu o tempo limite" — que é
            # mentira, e mentira plausível, porque de fábrica a espera não tem
            # teto nenhum.
            # ℹ️ `_entrega_parcial()` pelo mesmo motivo dos outros: o que ele
            # chegou a ler já foi pago, e jogar fora seria o oposto do que
            # "Parar" quer.
            return _fim(_entrega_parcial(), erro='você mandou parar',
                        contexto=messages, erro_tipo='parcial')
        except TimeoutError:
            # Os outros três pontos de esgotamento já devolvem o que foi lido.
            # Estes dois jogavam fora — e o que morre aqui morre depois de ter
            # sido lido e pago.
            return _fim(_entrega_parcial(), erro='subagente excedeu o tempo limite',
                        contexto=messages, erro_tipo='parcial')
        except Exception as e:
            return _fim(_entrega_parcial(), erro=str(e), contexto=messages,
                        erro_tipo='parcial')

