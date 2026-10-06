from ...constantes import *
from modulos.agentes.texto_llm import strip_thinking
from modulos.agentes.trava_ia import TRAVA_IA, TravaOcupada, DONO_DESIGNER
from ...llm_geracao import ajustes_da_chamada


class DesignerMixin:

    # ── Designer de Interface ─────────────────────────────────────────────────

    _DESIGN_STYLES_DIR = os.path.join(ARQUIVOS_DIR, 'Estilos e cores', 'Estilos')
    _DESIGN_COLORS_DIR = os.path.join(ARQUIVOS_DIR, 'Estilos e cores', 'Cores')

    _RE_BLOCO_HTML = re.compile(r'```(?:html)?[ \t]*\r?\n?([\s\S]*?)```', re.IGNORECASE)

    @staticmethod
    def _extrair_html(texto):
        """Devolve só o documento HTML de uma resposta do modelo.

        O modelo responde com o HTML dentro de uma cerca ```html e às vezes
        aninha duas. O histórico precisa guardar o HTML PURO: se guardar a
        resposta com a cerca e ainda embrulhar em outra, o parser do frontend
        casa da cerca externa até a interna e extrai string vazia — era o que
        deixava os cards de variação em branco ao reabrir a sessão.
        """
        t = (texto or '').strip()
        for _ in range(4):
            m = DesignerMixin._RE_BLOCO_HTML.search(t)
            if not m:
                break
            miolo = m.group(1).strip()
            if miolo:
                t = miolo
                continue
            # Miolo vazio = duas cercas coladas (```html logo seguido de ```html).
            # Descarta só a cerca externa e recomeça da interna — parar aqui era
            # justamente o erro que devolvia string vazia.
            t = t[m.end() - 3:].strip()
        # Sem nenhuma tag não sobrou HTML utilizável (cerca vazia, recusa do
        # modelo): melhor devolver nada do que gravar restos de cerca.
        return t if '<' in t else ''

    # ⚠️ Os quatro leitores de estilo e paleta que moravam aqui SAÍRAM em
    # 2026-08-25 (`load_design_styles`, `get_design_colors`,
    # `get_design_style_content`, `get_design_color_content`). Eram a leitura de
    # DUAS dimensões, uma chamada por item, e ficaram sem chamador quando o
    # Designer passou a ter cinco: quem lê a biblioteca agora é
    # `carregar_estilos_e_cores` (modulos/estilos_e_cores.py), que devolve nome +
    # conteúdo + tags de todos os itens numa chamada por DIMENSÃO. Manter os dois
    # caminhos daria duas leituras do mesmo disco, e elas divergiriam na primeira
    # mudança de formato.
    #
    # `_DESIGN_STYLES_DIR` e `_DESIGN_COLORS_DIR` ficam: são o endereço das duas
    # pastas, e nada mais monta esse caminho aqui.

    @staticmethod
    def _resumo_paleta(color_content):
        """Reduz o JSON da paleta a uma linha de pares "papel: #hex".

        Só a 1ª rodada manda o JSON inteiro. No refino o que importa é a lista de
        hexadecimais — os campos de descrição do arquivo custariam contexto sem
        mudar nada no HTML gerado.
        """
        try:
            data = json.loads(color_content)
        except Exception:
            return color_content
        pares = [f'{k}: {v["hex"]}' for k, v in (data.get('cores') or {}).items()
                 if isinstance(v, dict) and v.get('hex')]
        if not pares:
            return color_content
        nome = data.get('nome', '')
        return (f'{nome} — ' if nome else '') + ', '.join(pares)

    def _erro_de_janela(self, textos, tokens_saida):
        """Mensagem de estouro de contexto, ou None se couber. Uma requisição.

        Cada variação é uma requisição INDEPENDENTE ao LM Studio, com a janela
        inteira à disposição — a janela não é repartida entre requisições. Então a
        conta é por chamada e não tem divisor: pedir 4 variações não aperta o
        contexto de nenhuma delas, só dispara quatro pedidos iguais em paralelo.

        Quem estourava a janela era a geração sem teto: sem `max_tokens`, um modelo
        com raciocínio pensa e reescreve até o fim do contexto, e o LM Studio mata o
        stream com "Context size has been exceeded" no meio. O teto resolve isso; o
        cheque aqui é para o caso em que nem entrada + teto cabe, e aí vale dizer os
        números em vez de deixar o erro cru voltar nos cards.
        """
        from modulos.tokens import contar_tokens
        limites = self.load_limites()['limites']
        entrada = sum(contar_tokens(t) for t in textos if t)
        necessario = entrada + tokens_saida
        r = self.get_context_window()
        if r.get('success'):
            janela = int(r['context_length'])
        else:
            janela = int(limites['janela_contexto'])
        # Mesma margem do resto do projeto: o template de chat do modelo, os
        # tokens especiais e a contagem aproximada do tiktoken não batem com o
        # tokenizador real, e encostar no limite exato é o mesmo que estourar.
        util = int(janela * (100 - int(limites['margem_pct'])) / 100)
        if necessario <= util:
            return None
        return (f'Não cabe na janela de contexto: o modelo carregado tem {janela} tokens '
                f'(~{util} úteis com a margem) e cada variação precisa de ~{entrada} de '
                f'entrada + ~{tokens_saida} de saída (~{necessario}). Parta de uma variação '
                f'mais enxuta, reduza o teto de saída em Configurações ou aumente o contexto '
                f'do modelo no LM Studio.')

    # ── Preferências do Designer ──────────────────────────────────────────────
    # Estilo de referência e paleta escolhidos ficam POR PROJETO, ao lado das
    # sessões: são uma decisão sobre a cara daquele projeto, não do aplicativo.
    # Sem isto a seleção sumia a cada reabertura e a 1ª rodada saía sem estilo e
    # sem paleta, mesmo com os cards marcados como "Ativo" na sessão anterior.

    # ⚠️ `load_design_prefs` / `save_design_prefs` mudaram para
    # `designer_dimensoes.py` em 2026-08-25. Elas gravavam dois campos
    # (`estilo`, `cor`) e passaram a gravar cinco dimensões mais os comentários
    # por item — foram junto do módulo que é dono desse formato.

    def _design_chat_dir(self, project_name):
        return obter_pasta_de_conversas_do_designer(project_name)

    def _design_chat_path(self, project_name, chat_id):
        return os.path.join(self._design_chat_dir(project_name), f'{chat_id}.json')

    def list_design_chats(self, project_name):
        d = self._design_chat_dir(project_name)
        if not os.path.isdir(d):
            return {'success': True, 'chats': []}
        chats = []
        for fn in os.listdir(d):
            if not fn.endswith('.json'):
                continue
            try:
                with open(os.path.join(d, fn), 'r', encoding='utf-8') as f:
                    data = json.load(f)
                chats.append({
                    'id': data['id'],
                    'title': data.get('title', 'Sem título'),
                    'created_at': data.get('created_at', '')
                })
            except Exception:
                pass
        chats.sort(key=lambda x: x['created_at'], reverse=True)
        return {'success': True, 'chats': chats}

    def create_design_chat(self, project_name):
        d = self._design_chat_dir(project_name)
        os.makedirs(d, exist_ok=True)
        chat_id = str(uuid.uuid4())
        data = {
            'id': chat_id,
            'title': 'Nova sessão',
            'messages': [],
            'created_at': datetime.now().isoformat()
        }
        with open(self._design_chat_path(project_name, chat_id), 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return {'success': True, 'chat_id': chat_id, 'title': data['title']}

    def load_design_chat(self, project_name, chat_id):
        try:
            with open(self._design_chat_path(project_name, chat_id), 'r', encoding='utf-8') as f:
                data = json.load(f)
            return {'success': True, 'messages': data.get('messages', []), 'title': data.get('title', '')}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def deletar_design_chat(self, project_name, chat_id):
        path = self._design_chat_path(project_name, chat_id)
        try:
            if os.path.exists(path):
                os.remove(path)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Rodadas de uma sessão ─────────────────────────────────────────────────
    # Uma RODADA é um par (mensagem do usuário, mensagem do assistente). O índice
    # da rodada é a posição do par — não existe id próprio, e descartar rodadas é
    # sempre truncar um sufixo da lista.
    #
    # O vínculo com a variação de origem mora na mensagem do USUÁRIO, porque a
    # base é entrada da rodada (mesma natureza do texto pedido) e porque a
    # mensagem do assistente é uma string que passa por parser — pendurar
    # metadado nela obrigaria a inventar sintaxe dentro do texto.
    #
    # Sessões gravadas antes disto não têm nenhum dos campos: ler sempre por
    # .get(), nunca por indexação direta.

    _LOCK_SESSAO_DESIGN = threading.Lock()

    def _truncar_rodadas_design(self, project_name, chat_id, rodada_base):
        """Descarta as rodadas posteriores à rodada_base. Devolve quantas saíram.

        Roda SÍNCRONO, antes da thread de geração: o worker relê o arquivo, então
        precisa já enxergar a lista truncada. Se isso acontecesse durante a
        geração, o worker sobrescreveria com o que leu antes.
        """
        if rodada_base is None:
            return 0
        path = self._design_chat_path(project_name, chat_id)
        with self._LOCK_SESSAO_DESIGN:
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            except Exception:
                return 0
            mensagens = data.get('messages', [])
            manter = (int(rodada_base) + 1) * 2
            if manter >= len(mensagens):
                return 0
            descartadas = (len(mensagens) - manter) // 2
            data['messages'] = mensagens[:manter]
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return descartadas

    def _anexar_rodada_design(self, project_name, chat_id, user_msg, texto_resposta,
                              rodada_base, variacao_base, variacoes_pedidas):
        """Acrescenta o par (usuário, assistente) ao fim da sessão e devolve o título.

        RELÊ o arquivo em vez de regravar o `data` lido no começo do worker: entre
        a leitura e aqui passaram-se minutos, e regravar o estado velho apagaria
        qualquer alteração feita nesse meio-tempo.
        """
        path = self._design_chat_path(project_name, chat_id)
        with self._LOCK_SESSAO_DESIGN:
            # Sessão deletada durante a geração: desistir em silêncio, senão o
            # worker ressuscita um arquivo que o usuário mandou remover.
            if not os.path.exists(path):
                return None
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            msg_usuario = {'role': 'user', 'content': user_msg,
                           'variacoes_pedidas': variacoes_pedidas}
            # Só grava a origem quando ela existe — rodada gerada do zero fica sem
            # os campos, exatamente como as sessões antigas.
            if rodada_base is not None:
                msg_usuario['rodada_base'] = int(rodada_base)
            if variacao_base is not None:
                msg_usuario['variacao_base'] = int(variacao_base)

            hist = data.get('messages', [])
            hist.append(msg_usuario)
            hist.append({'role': 'assistant', 'content': texto_resposta})
            data['messages'] = hist

            if data.get('title') == 'Nova sessão' and user_msg:
                data['title'] = user_msg[:60].replace('\n', ' ')

            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return data['title']

    def open_design_html(self, html_content):
        import tempfile, webbrowser
        try:
            with tempfile.NamedTemporaryFile(suffix='.html', delete=False, mode='w', encoding='utf-8') as f:
                f.write(html_content)
                tmp_path = f.name
            webbrowser.open('file:///' + tmp_path.replace(os.sep, '/'))
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def send_design_message(self, project_name, chat_id, user_msg, model,
                            variation_count, selected_variation_html='',
                            rodada_base=None, variacao_base=None):
        # ⚠️ As escolhas não viajam mais na assinatura. Eram duas (`estilo`,
        # `cor`) e passaram a ser cinco dimensões mais um comentário por item —
        # enfiar isso em argumentos posicionais atravessando a ponte pywebview
        # deixaria a chamada ilegível e obrigaria a mexer em todos os chamadores
        # na próxima dimensão. A tela grava as preferências ANTES de chamar aqui,
        # e a geração as relê do disco: uma fonte só.
        def worker():
            try:
                # O Designer chama o modelo e escreve em Assistente/Designer/
                # Conversas/, então é uma ponta da trava como o Chat e a Fila —
                # e vinha sem tomá-la. `esperar=False` porque é clique de gente
                # na frente da tela: recusar aqui é honesto, e a tela mostra o
                # motivo ao lado do botão.
                with TRAVA_IA.ocupar(DONO_DESIGNER, projeto=project_name, esperar=False):
                    self._design_gerar(
                        project_name, chat_id, user_msg, model,
                        variation_count, selected_variation_html,
                        rodada_base, variacao_base)
            except TravaOcupada as ocupada:
                motivo = (ocupada.estado or {}).get('motivo', 'há tarefa de IA rodando')
                # `project_name` vai primeiro: é o que o front usa para
                # ignorar o evento quando este projeto não é o exibido no
                # momento (várias abas de projeto abertas).
                self.window.evaluate_js('designError(%s, %s)' % (json.dumps(project_name), json.dumps(motivo)))
            except Exception as e:
                self.window.evaluate_js(f'designError({json.dumps(project_name)}, {json.dumps(str(e))})')

        # Truncar ANTES de abrir a thread: o worker relê o arquivo, então precisa
        # já encontrar a lista sem as rodadas descartadas.
        self._truncar_rodadas_design(project_name, chat_id, rodada_base)

        threading.Thread(target=worker, daemon=True).start()
        return {'success': True}

    def _design_gerar(self, project_name, chat_id, user_msg, model,
                      variation_count, selected_variation_html='',
                      rodada_base=None, variacao_base=None):
        """A geração em si. Saiu de dentro do `worker` para a trava caber em volta."""
        from ...llm_cliente import abrir_cliente_do_lm_studio
        settings = self.load_settings()['settings']

        # As cinco dimensões escolhidas, relidas do disco — as DA SESSÃO, não o
        # padrão do projeto. A tela grava antes de chamar, então aqui há uma fonte
        # só, e é a mesma que a aba Contexto lê para dizer quanto cada bloco custa.
        prefs = self.carregar_escolhas_da_sessao(project_name, chat_id)['escolhas']
        escolhas, sumiram = self._escolhas_do_designer(prefs)

        # A8 · Escolha apontando para arquivo que não existe mais NÃO segue calada.
        # Antes, apagar a paleta escolhida fazia `color_content` virar string vazia
        # e a geração continuar sem paleta nenhuma: o modelo inventava as cores e
        # nada na tela dizia por quê. Agora para e diz qual sumiu.
        if sumiram:
            self.window.evaluate_js('designError(%s, %s)' % (json.dumps(project_name), json.dumps(
                'Escolha apontando para arquivo que não existe mais: %s. '
                'Abra a aba da dimensão e escolha de novo.' % ', '.join(sumiram))))
            return

        # Usar prompt de refinamento se variação foi selecionada, senão usar prompt padrão
        #
        # Sem `try/except`. Antes havia aqui um prompt de reserva escrito em
        # Python: se o arquivo sumisse, o Designer CONTINUAVA rodando — só que
        # pior, com um prompt de quatro linhas em vez do de verdade, e sem
        # avisar ninguém. Falha silenciosa que só se descobre olhando o HTML
        # gerado. Agora arquivo faltando estoura, e quem chama trata.
        #
        # ⚠️ Vale igual para os BLOCOS de dimensão: apagar um `.txt` de
        # `Designer/Blocos/` estoura em `montar_blocos_do_designer`, e não cai em
        # reserva nenhuma. Mesma decisão, mesmo motivo.
        prompt_filename = 'refino.txt' if selected_variation_html else 'system-prompt.txt'
        prompt_path = obter_prompt_do_assistente(PASTA_DESIGNER, prompt_filename)
        with open(prompt_path, 'r', encoding='utf-8') as f:
            base_prompt = f.read()

        # A montagem modular mora em `designer_prompt.py`: junta só os blocos das
        # dimensões escolhidas, na ordem canônica, com o comentário do item quando
        # houver e a `Explicação.md` da pasta de cada animação escolhida.
        paleta = next((item for linha, item, _c in escolhas if linha['campo'] == 'cor'), None)
        system_msg, user_content = self._partes_do_prompt_do_designer(
            base_prompt, escolhas, user_msg, selected_variation_html,
            self._resumo_paleta(paleta['conteudo']) if paleta else '')

        # O estilo de referência é o que dimensiona o teto de saída: a variação
        # gerada tem o porte dele.
        estilo = next((item for linha, item, _c in escolhas if linha['campo'] == 'estilo'), None)
        style_content = (estilo or {}).get('conteudo', '')

        # O histórico NÃO vai ao modelo. O HTML da variação-base já vai na
        # mensagem do usuário acima, e é ele que carrega tudo o que foi pedido
        # nas rodadas anteriores — reenviar as mensagens antigas mandava junto
        # as 4 variações completas de cada rodada (~13 KB cada) sem ganho
        # nenhum. Também é o que impede os campos de rodada gravados em disco
        # de vazarem para dentro do pedido ao LM Studio.
        messages_base = [
            {'role': 'system', 'content': system_msg},
            {'role': 'user', 'content': user_content},
        ]

        # A saída é um documento HTML inteiro, do mesmo porte da base — e em
        # modelo com raciocínio vem um bloco de "thinking" na frente, que
        # gasta contexto igual. Sem `max_tokens` a geração ia até o fim da
        # janela e o LM Studio matava a variação com "Context size has been
        # exceeded" no meio do stream. O teto sai do mesmo campo que o resto
        # do projeto usa (Configurações → teto de saída) e é ele que vai como
        # max_tokens: o que se reserva no cheque de janela é o que o modelo
        # pode gastar de fato, senão a conta mente.
        from modulos.tokens import contar_tokens
        referencia = selected_variation_html or style_content
        tokens_saida = max(int(self.load_limites()['limites']['teto_saida']),
                           int(contar_tokens(referencia) * 1.6))
        erro_janela = self._erro_de_janela([system_msg, user_content], tokens_saida)
        if erro_janela:
            self.window.evaluate_js(f'designError({json.dumps(project_name)}, {json.dumps(erro_janela)})')
            return

        # Fazer variation_count chamadas paralelas ao LM Studio
        variations = {}
        variation_lock = threading.Lock()

        def fetch_variation(var_idx):
            try:
                # A aba do projeto foi fechada antes de esta variação começar:
                # nem abre o cliente. Ver `agentes/parada_do_projeto.py`.
                if self.projeto_parado(project_name):
                    return
                client = abrir_cliente_do_lm_studio(settings, projeto=project_name)
                stream = client.chat.completions.create(
                    model=model, messages=messages_base, stream=True,
                    max_tokens=tokens_saida, **ajustes_da_chamada(settings, 'designer', model))

                full_response = ''
                motivo_fim = None
                for chunk in stream:
                    # ⚠️ FECHOU A ABA NO MEIO DA GERAÇÃO: corta agora.
                    #
                    # É o mesmo padrão do Chat (`chat_mensagem.py`), e o
                    # `stream.close()` NÃO é opcional: sem ele o LM Studio
                    # continua gerando do outro lado, e a janela fica ocupada
                    # produzindo um texto que ninguém vai ler — exatamente o
                    # que fechar a aba existe para evitar. O `break` sozinho só
                    # faria esta thread parar de escutar.
                    if self.projeto_parado(project_name):
                        try:
                            stream.close()
                        except Exception:
                            pass
                        return
                    # O chunk final de usage vem com choices vazio: sem a
                    # guarda, o IndexError descartava a variação já pronta.
                    if not chunk.choices:
                        continue
                    escolha = chunk.choices[0]
                    if escolha.finish_reason:
                        motivo_fim = escolha.finish_reason
                    delta = escolha.delta
                    if delta and delta.content:
                        full_response += delta.content

                # Bateu no teto de saída: o HTML veio pela metade e o card
                # mostraria uma miniatura truncada como se fosse a variação
                # pronta. Melhor falhar dizendo o número que precisa mudar.
                if motivo_fim == 'length':
                    raise RuntimeError(
                        f'A variação passou do teto de saída ({tokens_saida} tokens) e '
                        f'veio cortada. Aumente o teto em Configurações — e o contexto '
                        f'do modelo no LM Studio junto, senão não cabe.')

                # Normaliza UMA vez: daqui para frente circula HTML puro,
                # tanto para o frontend quanto para o histórico em disco.
                html = self._extrair_html(strip_thinking(full_response))

                with variation_lock:
                    variations[var_idx] = {'success': True, 'content': html}

                self.window.evaluate_js(
                    f'appendDesignVariation({json.dumps(project_name)}, {var_idx}, {json.dumps(html)})')
            except Exception as e:
                with variation_lock:
                    variations[var_idx] = {'success': False, 'error': str(e)}
                self.window.evaluate_js(
                    f'designVariationError({json.dumps(project_name)}, {var_idx}, {json.dumps(str(e))})')

        # TODAS as variações pedidas vão de uma vez. São requisições
        # independentes, cada uma com sua própria janela: gerar em ondas só
        # multiplicaria o tempo de espera — 4 pedidos simultâneos custam o
        # mesmo que 1, duas ondas de 2 custam o dobro.
        with ThreadPoolExecutor(max_workers=min(variation_count, 4)) as executor:
            futures = [executor.submit(fetch_variation, i) for i in range(variation_count)]
            for future in as_completed(futures):
                future.result()

        # Monta resposta agregada para o histórico
        full_response_text = '\n\n'.join(
            f'### Variação {i+1}\n```html\n{variations[i]["content"]}\n```'
            for i in range(variation_count)
            if variations.get(i, {}).get('content')
        )

        titulo = self._anexar_rodada_design(
            project_name, chat_id, user_msg, full_response_text,
            rodada_base, variacao_base, variation_count)

        # titulo None = a sessão foi deletada durante a geração.
        if titulo is None:
            return

        self.window.evaluate_js(f'finishDesignMessage({json.dumps(project_name)}, {json.dumps(titulo)})')
