"""O que o programa promete ao modelo: a política de saída e os tetos em token.

Duas coisas, e elas são a mesma pergunta vista de dois lados — *quanto e como o
modelo recebe*. Os dois interruptores da política de saída (Formato garantido e
Resgate da resposta) decidem COMO se pede; os limites em token decidem QUANTO
cabe.

⚠️ OS DOIS INTERRUPTORES MORAM EM `settings.json`, E NÃO EM `limites.json`.
`save_limites` grava o arquivo inteiro a partir do que a tela mandou; uma chave
que a tela de limites não conhece seria apagada na primeira gravação dela.

⚠️ OS LIMITES SÃO EM TOKEN, E ISSO SUBSTITUIU NÚMEROS EM CARACTERE. O que eles
protegem é a janela do modelo, e janela se mede em token: o limite por arquivo
deixou de ser um número chutado quando passou a ser medido.

⚠️ `get_context_window` PERGUNTA AO LM STUDIO, não adivinha. O número muda com o
modelo carregado, e um valor gravado envelhece na primeira troca de modelo.
"""

from .constantes import *
from .configuracoes_arquivos import (TRAVA_DA_CONFIG, arquivo_da_chave,
                                     arquivos_de_limites,
                                     avisar_configuracao_mudou,
                                     gravar_chaves_no_arquivo,
                                     ler_arquivo_de_config,
                                     ler_chaves_dos_arquivos)


class ConfigsModeloMixin:

    # ── A política de saída: os dois interruptores ───────────────────────
    # Moram em `settings.json`, e NÃO em `limites.json`: `save_limites` faz
    # `max(1, int(valor))`, que transforma `False` em `1` — ou seja, um
    # interruptor desligado voltaria ligado sozinho.

    def _formato_garantido_ligado(self):
        """Mandar o JSON Schema junto do prompt, obrigando o formato?

        Vale para as seis rotinas de documentação E para o agente principal da
        FILA. Chat, Subagentes e Designer continuam de fora por decisão
        registrada: ali a prosa livre é o produto, e o Designer devolve HTML,
        que não cabe em esquema JSON.

        ⚠️ A Fila entrou depois, e não por simetria: a resposta dela SEMPRE foi
        um JSON de envelope — o prompt manda "nada antes, nada depois" —, então
        ali não havia prosa livre a proteger. O que havia era uma tarefa que
        falhou nove vezes com a mesma resposta byte a byte, porque o modelo
        escreveu uma aspa não escapada dentro de uma string. Isso é gramática
        léxica: um decodificador restrito nunca oferece a aspa nua ali.

        ⚠️ Um interruptor SÓ, e não um por consumidor: `_RF_SUPPORTED` é global
        de sessão, e dois interruptores na tela não resolveriam um acoplamento
        que é global no código.
        """
        try:
            return bool(self.load_settings()['settings'].get(
                'formato_garantido', FORMATO_GARANTIDO_PADRAO))
        except Exception:
            return FORMATO_GARANTIDO_PADRAO

    def _resgate_ligado(self):
        """Tentar salvar uma resposta que veio suja?

        Alcance MAIOR que o do Formato garantido: vale para as seis rotinas E
        para o Chat, a Fila e os subagentes.
        """
        try:
            return bool(self.load_settings()['settings'].get(
                'resgate_da_resposta', RESGATE_DA_RESPOSTA_PADRAO))
        except Exception:
            return RESGATE_DA_RESPOSTA_PADRAO


    def detectar_modelos(self):
        """A lista do botão "Detectar modelos" de Modelo e contexto — o que o LM
        Studio tem, o que está carregado e o que pensa."""
        from .llm_geracao import listar_modelos_do_lm_studio
        resultado = listar_modelos_do_lm_studio(self.load_settings()['settings'])
        resultado['quando'] = datetime.now().isoformat(timespec='seconds')
        return resultado

    def get_context_window(self):
        """Consulta o LM Studio pelo tamanho da janela de contexto do modelo carregado."""
        try:
            import urllib.request
            from .llm_cliente import obter_endereco_do_lm_studio
            settings = self.load_settings()['settings']
            # `/api/v0/models` é a API NATIVA do LM Studio, não a compatível com
            # a OpenAI — só ela informa a janela de contexto do modelo carregado.
            # Por isso aqui se monta a URL na mão, com `urllib`, em vez de abrir
            # um cliente: não há cliente para essa rota. O que vem do módulo é só
            # o endereço, para o padrão de fábrica continuar num lugar só.
            url = obter_endereco_do_lm_studio(settings) + '/api/v0/models'
            with urllib.request.urlopen(url, timeout=3) as resp:
                data = json.loads(resp.read().decode('utf-8'))
            for m in data.get('data', []):
                if m.get('state') == 'loaded' and m.get('type') != 'embeddings':
                    ctx = m.get('loaded_context_length') or m.get('max_context_length')
                    if ctx:
                        return {'success': True, 'context_length': int(ctx), 'model': m.get('id')}
            return {'success': False, 'error': 'nenhum modelo carregado'}
        except Exception as e:
            return {'success': False, 'error': str(e)}


    def load_doc_tecnica_limite(self):
        default = 80000
        if not os.path.exists(DOC_TECNICA_LIMITE_FILE):
            return {'success': True, 'valor': default}
        try:
            with open(DOC_TECNICA_LIMITE_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return {'success': True, 'valor': int(data.get('valor', default))}
        except Exception:
            return {'success': True, 'valor': default}

    def save_doc_tecnica_limite(self, valor):
        try:
            os.makedirs(CONFIGS_DIR, exist_ok=True)
            with open(DOC_TECNICA_LIMITE_FILE, 'w', encoding='utf-8') as f:
                json.dump({'valor': int(valor)}, f, ensure_ascii=False, indent=2)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}


    # ── Limites em tokens (substituem os limites fixos em caracteres) ─────────
    # O limite de conteúdo por arquivo deixa de ser um número chutado e passa a
    # ser calculado de trás para frente a partir destes quatro campos.
    # Ver modulos/tokens.py::calcular_orcamento.

    # Os três delays da Espera (T1/T2/T3) substituem o `debounce_segundos`
    # único. O propósito do debounce NÃO mudou: ele existe para esperar o Claude
    # Code parar de escrever, e o cronômetro reinicia a cada escrita. O que muda
    # é que os grupos não têm a mesma urgência — ver acionamentos_pipeline.py.
    _LIMITES_DEFAULTS = {
        # ⚠️ QUEM ESCREVE `janela_contexto` MUDOU. O campo na tela virou
        # somente-leitura: quem o preenche é `get_context_window()`,
        # perguntando ao LM Studio qual modelo está carregado. O valor salvo
        # aqui continua sendo o que TODO o backend lê — ele só passou a ser
        # a RESERVA, para quando o LM Studio estiver fora do ar. É o mesmo
        # arranjo que o Designer já usava.
        'janela_contexto':   50000,   # tokens da janela do modelo no LM Studio
        'teto_saida_pct': 17,   # % da janela — vira o max_tokens da chamada (em tokens, derivado em load_limites)
        # Quanto da JANELA de entrada uma chamada pode ocupar. Não existia: o programa
        # só tinha teto de saída, e a entrada era o que sobrasse da conta.
        # Com o campo, o Chat e a Fila — que não têm teto nenhum hoje —
        # passam a ter onde encostar.
        'teto_entrada_pct':  45,   # % da janela que uma chamada pode ocupar de entrada — é também o tamanho de cada parte da costura (D31)
        'margem_pct':           20,   # folga sobre a janela
        'debounce_t1_segundos': 10,   # determinísticos (baratos): a espera mais curta
        'debounce_t2_segundos': 30,   # para agente externo: espera intermediária
        'debounce_t3_segundos': 90,   # para o usuário ler: a espera mais longa
        # Tempo SEM SINAL DE VIDA — não é duração máxima. Enquanto o agente
        # estiver processando, a espera se renova (ver
        # acionamentos_pipeline.py::_ac_wait_done). 5 minutos sem processar
        # nada é agente travado, não agente lento.
        'timeout_agente_minutos': 5,

        # Quantos arquivos as rotinas processam ao mesmo tempo. Era um campo
        # em CADA card (Doc. Técnica, Resumo de Pastas), gravado
        # por projeto no `Configuração.json` — e lido de dois jeitos que não
        # conversavam: o botão do card lia o `<input>` do DOM, o ciclo lia o
        # arquivo. Virou um número só, global, porque é sobre a MÁQUINA e o
        # LM Studio, não sobre o projeto.
        'paralelas_rotinas': PARALELISMO_PADRAO,

        # ── Quando vale a pena regenerar ────────────────────────────────────
        # Os dois interruptores que o Detector consulta para decidir se uma
        # mudança merece as rotinas caras. Lidos em `_det_acorda`, e só lá.
        #
        # "Ignorar só espaço" nasce LIGADO: reindentar um arquivo não muda o
        # que a documentação diz sobre ele.
        #
        # "Ignorar só comentário" nasce DESLIGADO, e não é descuido: a Síntese
        # da Doc. Técnica nasce da docstring, então mexer num comentário muda de verdade
        # o que ele deveria dizer. Quem prefere economizar liga.
        'ignorar_so_espaco': True,
        'ignorar_so_comentario': False,

        # ── As réguas de similaridade (Etapa 3) ─────────────────────────────
        # Em PORCENTAGEM na tela porque é assim que se pensa nelas; a conta usa
        # fração, e a conversão mora em `_det_limiar`. Abaixo do limiar, regera.
        #
        # 95 nos dois: trocar um ponto final por exclamação num prompt fica em
        # ~99% e não regera nada; reescrever metade dele cai bem abaixo e regera.
        'doc_tecnica_similaridade_pct': 95,
        'resumo_pastas_similaridade_pct': 95,

        # De que tamanho o texto é cortado ANTES de ir ao modelo de embedding.
        # ⚠️ Não confundir com `embedding_truncar_tokens`, de "Ferramentas dos
        # subagentes": aquele é quanto o modelo chega a VER de um texto que já
        # chegou nele. Duas caixas para o mesmo número é o erro que este projeto
        # já consertou uma vez com o `parallel` — são perguntas diferentes.
        #
        # 512 é medido, não gosto: a atenção é O(n²), e dobrar a janela custa
        # quatro vezes mais (512 → 166 ms; 8192 → 17 s, por arquivo).
        'pedaco_tokens': 512,

        # ── A régua do Pipeline (fase 03 do Pipeline em níveis, D24, D59) ────
        # Em PORCENTAGEM, como na tela: o nome e o resumo de uma cadeia (de um
        # bloco, de uma área) só são refeitos quando pelo menos esta fração dos
        # filhos mudou desde o último texto escrito. Filho que entrou ou saiu
        # refaz sempre. Lidos em `pipeline_passos.py` e `pipeline_blocos.py`.
        'pipeline_cadeia_refazer_pct': 30,   # % dos passos com frase nova
        'pipeline_bloco_refazer_pct': 30,    # % das cadeias com resumo novo
        'pipeline_area_refazer_pct': 30,     # % dos blocos com resumo novo
        # Até que nível a cadeia segue as chamadas a partir do começo (mín. 1).
        # Medido no projeto Assistente: com 3, 154 cadeias, a maior com 73
        # passos; sem parada, uma cadeia só de 1 184 passos.
        'pipeline_cadeia_niveis': 3,

        # ── Tamanho das respostas (D19): três travas contra o modelo que entra
        # em repetição. Nenhuma molda a resposta de um arquivo normal. ──
        'teto_proporcional_base': 1500,
        'teto_proporcional_fator': 0.5,   # tokens de saída a mais por token do arquivo
        'limite_sintese_chars': 800,
        'limite_texto_chars': 400,        # cada atribuição, frase ou termo
        'limite_atribuicoes': 30,
        'limite_tags': 15,
        'limite_termos_por_arquivo': 30,

        # ── Partes e costura: a resposta estimada do Resumo de Pastas (D30,
        # D36). A pasta cuja resposta estimada passa do teto de saída já
        # vira partes na primeira tentativa. 60 × 1,2 = 72 tokens por
        # arquivo: `frontend/modulos` (206 arquivos) dá ~14 800 e, com teto
        # de saída de 11 900, vira 2 partes. ──
        'resumo_pastas_tokens_por_arquivo': 60,
        'resumo_pastas_margem_estimativa_pct': 20,
        # Teto de ATENÇÃO, não de tokens: com ~105 fichas numa parte o modelo
        # perdia a conta e repetia até o teto (frontend/modulos, 26/09/2026).
        'resumo_pastas_max_arquivos_por_parte': 40,

        # ── Partes e costura, um cartão por rotina (D21, D28): cada uma com
        # o próprio «% da janela», o interruptor «Dividir e costurar» (D9,
        # D13, D26, D30) e «O máximo aceito, mesmo dividindo» (D15, D29).
        # O `teto_entrada_pct` lá em cima continua valendo para o resto do
        # programa (Chat, Fila, Pipeline).
        'doc_tecnica_teto_entrada_pct': 45,
        'doc_tecnica_dividir': True,
        'doc_tecnica_max_kb': 512,
        'doc_tecnica_max_linhas': 5000,
        'doc_tecnica_max_tokens': 100000,
        'resumo_pastas_teto_entrada_pct': 45,
        'resumo_pastas_dividir': True,
        'resumo_pastas_max_arquivos': 400,
        'resumo_pastas_max_tokens': 250000,
        # O que vai na ficha de cada arquivo (D20, D24, D25). A Síntese não
        # tem chave: vai sempre — sem ela a pasta não tem o que resumir.
        'resumo_pastas_ficha_atribuicoes': True,
        'resumo_pastas_ficha_simbolos': False,
        'resumo_pastas_ficha_frases': False,
        'resumo_pastas_ficha_usa': False,

        # ── Quem entra no Glossário (D29): em quantos arquivos DIFERENTES
        # um termo precisa aparecer. Critério de relevância, não teto (P2). ──
        'glossario_minimo_modo': 'proporcional',   # 'proporcional' · 'fixo'
        'glossario_minimo_pct': 1.0,               # % dos arquivos documentados
        'glossario_minimo_piso': 3,
        'glossario_minimo_fixo': 5,
    }

    # ⚠️ OS BOOLEANOS PRECISAM DE RAMO PRÓPRIO, E O MOTIVO APAGA O CAMPO EM
    # SILÊNCIO. `save_limites` fazia `max(1, int(valor))` em tudo — e
    # `max(1, int(False))` é **1**. O interruptor desligado voltaria LIGADO
    # sozinho no carregamento seguinte, sem erro nenhum, e "Ignorar só
    # comentário" (que nasce desligado) seria impossível de deixar assim.
    #
    # O mesmo defeito já está registrado em `_RENDER_DEFAULTS` e no comentário
    # de `POLITICA_DE_SAIDA_CAMPOS` (`limites.js`) — é a terceira vez que ele
    # aparece neste projeto.
    _LIMITES_BOOLEANOS = frozenset({'ignorar_so_espaco', 'ignorar_so_comentario',
                                    'doc_tecnica_dividir', 'resumo_pastas_dividir',
                                    'resumo_pastas_ficha_atribuicoes',
                                    'resumo_pastas_ficha_simbolos',
                                    'resumo_pastas_ficha_frases',
                                    'resumo_pastas_ficha_usa'})

    # Os limites com vírgula: `max(1, int(0.5))` daria 1 — o teto
    # proporcional viraria o dobro do arquivo, e a porcentagem do mínimo do
    # Glossário (passo de 0,5) perderia a vírgula.
    _LIMITES_DECIMAIS = frozenset({'teto_proporcional_fator', 'glossario_minimo_pct'})

    # O único limite de TEXTO, com os valores que ele aceita: o modo do
    # mínimo do Glossário (D29). `int('fixo')` levantaria dentro do `try` de
    # `load_limites`, e o `except` jogaria fora TODOS os valores salvos —
    # por isso o ramo próprio, na leitura e na gravação. Valor fora da lista
    # (JSON editado à mão) fica no padrão.
    _LIMITES_ESCOLHAS = {'glossario_minimo_modo': ('proporcional', 'fixo')}

    # Chave antiga, de quando havia um delay global só. Continua sendo lida dos
    # arquivos já salvos e vira o T1, para quem já tinha configurado não perder
    # o valor nem ficar com o padrão de fábrica sem aviso.
    _LIMITES_RENOMEADOS = {'debounce_segundos': 'debounce_t1_segundos',
                           'espelho_similaridade_pct': 'doc_tecnica_similaridade_pct'}

    def load_limites(self):
        valores = dict(self._LIMITES_DEFAULTS)
        try:
            # ⚠️ A ORDEM DO MERGE É A MIGRAÇÃO, como em `carregar_settings`:
            # desde 23/09/2026 cada limite mora no arquivo da categoria dele
            # (`configuracoes_arquivos.py`), e o `limites.json` antigo vale só
            # até a primeira gravação. Daqui para baixo o código é o de antes.
            salvos = {**ler_arquivo_de_config(os.path.basename(LIMITES_FILE)),
                      **ler_chaves_dos_arquivos(arquivos_de_limites(),
                                                so_limites=True)}
            # O nome antigo de uma chave renomeada DEPOIS da divisão em
            # categorias (`espelho_similaridade_pct`, 2026-09) mora no arquivo
            # da categoria, e `ler_chaves_dos_arquivos` descarta chave que não
            # conhece — então ele é lido cru daqui, só para a migração abaixo.
            for nome in arquivos_de_limites():
                bruto = ler_arquivo_de_config(nome)
                for antiga in self._LIMITES_RENOMEADOS:
                    if antiga in bruto and antiga not in salvos:
                        salvos[antiga] = bruto[antiga]
            if salvos:
                for antiga, nova in self._LIMITES_RENOMEADOS.items():
                    if antiga in salvos and nova not in salvos:
                        valores[nova] = int(salvos[antiga])
                for chave in valores:
                    if chave not in salvos:
                        continue
                    if chave in self._LIMITES_ESCOLHAS:
                        if salvos[chave] in self._LIMITES_ESCOLHAS[chave]:
                            valores[chave] = salvos[chave]
                        continue
                    valores[chave] = (bool(salvos[chave])
                                      if chave in self._LIMITES_BOOLEANOS
                                      else max(0.05, float(salvos[chave]))
                                      if chave in self._LIMITES_DECIMAIS
                                      else int(salvos[chave]))
        except Exception:
            pass
        # Derivados, nunca gravados: todo o backend continua lendo
        # `teto_saida`/`teto_entrada` em tokens, e eles acompanham a janela
        # lida do LM Studio.
        janela = int(valores['janela_contexto'])
        valores['teto_entrada'] = max(1, janela * valores['teto_entrada_pct'] // 100)
        # D28: o «% da janela» de cada cartão de Partes e costura, em tokens.
        valores['doc_tecnica_teto_entrada'] = max(
            1, janela * valores['doc_tecnica_teto_entrada_pct'] // 100)
        valores['resumo_pastas_teto_entrada'] = max(
            1, janela * valores['resumo_pastas_teto_entrada_pct'] // 100)
        valores['teto_saida'] = max(1, janela * valores['teto_saida_pct'] // 100)
        return {'success': True, 'limites': valores}

    def save_limites(self, patch):
        try:
            valores = self.load_limites()['limites']
            antes = dict(valores)       # para o `configuracao.mudou`, no fim
            for chave, valor in (patch or {}).items():
                if chave not in self._LIMITES_DEFAULTS:
                    continue
                if chave in self._LIMITES_ESCOLHAS:
                    # Texto: grava só um dos valores aceitos (ver `_LIMITES_ESCOLHAS`).
                    if valor in self._LIMITES_ESCOLHAS[chave]:
                        valores[chave] = valor
                    continue
                # O `max(1, ...)` é dos NÚMEROS: nenhum limite deste arquivo
                # aceita zero. Aplicá-lo a um booleano é o que transformava
                # "desligado" em "ligado" — ver `_LIMITES_BOOLEANOS`.
                valores[chave] = (bool(valor) if chave in self._LIMITES_BOOLEANOS
                                  else max(0.05, float(valor))
                                  if chave in self._LIMITES_DECIMAIS
                                  else max(1, int(valor)))
            # Cada limite no arquivo da categoria dele, sem tocar nas chaves de
            # settings que moram no mesmo arquivo (ex.: `lm_studio_url` em
            # `modelo-e-contexto.json`). O `limites.json` antigo perde as
            # chaves POR ÚLTIMO — uma queda no meio deixa o valor dos dois lados.
            with TRAVA_DA_CONFIG:
                por_arquivo = {}
                for chave, valor in valores.items():
                    nome = arquivo_da_chave(chave)
                    if nome:
                        por_arquivo.setdefault(nome, {})[chave] = valor
                for nome, chaves in por_arquivo.items():
                    gravar_chaves_no_arquivo(nome, chaves)
                # Os tetos em tokens de antes dos tetos em % (D27): número
                # velho esquecido no arquivo confunde quem abrir o JSON.
                gravar_chaves_no_arquivo('modelo-e-contexto.json', {},
                                         remover=('teto_entrada', 'teto_saida'))
                if os.path.exists(LIMITES_FILE):
                    gravar_chaves_no_arquivo(os.path.basename(LIMITES_FILE), {},
                                             remover=tuple(valores))
            # Fora da trava e depois de gravar — ver `avisar_configuracao_mudou`.
            avisar_configuracao_mudou(antes, valores)
            return {'success': True, 'limites': valores}
        except Exception as e:
            return {'success': False, 'error': str(e)}


    def preview_orcamento(self, prompt='', esqueleto=''):
        """Detalhamento da conta de contexto, para a aba Configurações mostrar."""
        from modulos.tokens import calcular_orcamento
        limites = self.load_limites()['limites']
        return {'success': True, 'orcamento': calcular_orcamento(limites, prompt, esqueleto)}

    def contar_tokens_textos(self, textos):
        """Tokens de uma lista de textos, pelo tiktoken.

        Existe para o frontend parar de estimar token dividindo caracteres por
        4 — a única contagem que vale para "cabe na janela?" é a do tokenizador
        de verdade, e ele só existe no backend.
        """
        from modulos.tokens import contar_tokens, contagem_exata
        total = sum(contar_tokens(t or '') for t in (textos or []))
        return {'success': True, 'tokens': total, 'exata': contagem_exata()}

