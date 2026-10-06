"""As **impressões** do Detector — como cada arquivo estava da última vez.

Metade da classificação pergunta *"o que mudou DENTRO do arquivo?"*: só um
comentário, só a indentação, o corpo de uma função, a assinatura, um import.
Responder isso exigiria o conteúdo anterior — e ele **não existe em lugar
nenhum** do projeto. Foram conferidas as quatro fontes plausíveis:

  · `hashes.json` guarda `{chave: {raiz, hash}}` — um md5 e mais nada;
  · as Versões de Backup guardam conteúdo, mas só se o usuário criou uma Versão,
    e não são atualizadas por ciclo;
  · o Espelho (retirado em 2026-09) guardava prosa do LLM, não código;
  · o `_simbolos.json` da Doc. Técnica chega perto, mas cobre só as extensões
    dela e mistura comentário com código.

**A saída não é guardar o conteúdo, é guardar impressões derivadas dele.** Cinco
hashes por arquivo, gravados a cada passada. Comparando o par antes/depois de
cada um, a classe sai direto — sem ler o arquivo velho, sem arquivo grande no
disco e sem uma linha de LLM.

⚠️ **As impressões só precisam ser consistentes CONSIGO MESMAS**, de uma passada
para a outra. Elas não são o índice de símbolos, não alimentam nenhuma tela e
ninguém as compara com o que outra rotina produz. É isso que permite calculá-las
aqui em vez de depender do `code_symbols` (que quem preenche é a rotina
**Duplicados**, que não é da base e pode estar desligada — o Detector ficaria
dependendo de uma rotina opcional para classificar, e falharia em silêncio nos
projetos onde ela nunca rodou).

O arquivo mora **dentro da pasta da rotina**, ao lado do `mudanças.json`: assim o
botão "Limpar dados gerados" o leva junto, sem regra especial. Perdê-lo não
quebra nada — sem impressão anterior toda mudança cai em `codigo`, que é o
comportamento de antes desta etapa.
"""

from ...constantes import *
from ...treesitter import (EXT_LANG, LINGUAGENS_SEM_CORPO, make_parser,
                           simbolo_do_no)
from ...analise_grafo import _PY_IMPORT, _JS_IMPORT

import hashlib

ARQUIVO_DE_IMPRESSOES = 'impressões.json'

# Acima disto o arquivo não é lido para impressão. É o mesmo teto que
# `build_symbol_index` já usa, e pelo mesmo motivo: arquivo gigante é minificado
# ou gerado, e parseá-lo custa mais do que a economia que ele traria.
_DET_TETO_DE_LEITURA = 500 * 1024


def _md5(texto):
    return hashlib.md5((texto or '').encode('utf-8', errors='replace')).hexdigest()


class DetectorImpressoesMixin:
    """Calcula e guarda as cinco impressões de cada arquivo."""

    # ── O arquivo ───────────────────────────────────────────────────────────

    def _det_impressoes_path(self, project_name):
        return os.path.join(self._det_dir(project_name), ARQUIVO_DE_IMPRESSOES)

    def _det_impressoes_ler(self, project_name):
        """`{chave relativa: impressão}` — vazio quando não há memória ainda."""
        try:
            with open(self._det_impressoes_path(project_name), 'r', encoding='utf-8') as f:
                dados = json.load(f)
            if isinstance(dados, dict) and isinstance(dados.get('arquivos'), dict):
                return dados['arquivos']
        except Exception:
            pass
        return {}

    def _det_impressoes_gravar(self, project_name, arquivos):
        """⚠️ Grava o dicionário INTEIRO, e por isso quem chama parte do que leu.

        Gravar só os que mudaram apagaria a memória de todos os outros — e o
        efeito seria invisível: na passada seguinte cada arquivo cairia no
        fallback "sem impressão anterior ⇒ código alterado", ou seja, o programa
        voltaria a acordar tudo a cada mudança sem nada dar erro.
        """
        try:
            pasta = self._det_dir(project_name)
            os.makedirs(pasta, exist_ok=True)
            with open(self._det_impressoes_path(project_name), 'w', encoding='utf-8') as f:
                json.dump({'gerado_em': datetime.now().isoformat(),
                           'arquivos': arquivos}, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    # ── As cinco impressões ─────────────────────────────────────────────────

    def _det_impressao(self, caminho):
        """Tudo o que se precisa saber deste arquivo para a próxima comparação.

        Devolve `None` quando o arquivo não pôde ser lido — e `None` significa
        "não afirmo nada", que faz a classificação cair no fallback seguro.
        """
        try:
            tamanho = os.path.getsize(caminho)
        except Exception:
            return None
        if tamanho > _DET_TETO_DE_LEITURA:
            # Grande demais para parsear, mas o tamanho e o md5 ainda dizem
            # alguma coisa — e "sem símbolo nenhum" seria mentira aqui.
            return {'tamanho': tamanho, 'grande': True}
        try:
            with open(caminho, 'r', encoding='utf-8', errors='replace') as f:
                fonte = f.read()
        except Exception:
            return None

        ext = os.path.splitext(caminho)[1].lower()
        lang = EXT_LANG.get(ext)
        imp = {
            'tamanho': tamanho,
            'imports': _md5('\n'.join(self._det_imports_de(fonte, ext))),
        }

        blocos = self._det_prosa_de(fonte, lang)
        imp['comentarios'] = _md5('\n'.join(b['texto'] for b in blocos))
        imp['sem_comentario'] = _md5(self._det_seco(fonte, blocos))

        simbolos, corpos = self._det_simbolos_de(fonte, lang)
        imp['simbolos'] = _md5('\n'.join(simbolos))
        imp['corpos'] = corpos
        imp['tem_simbolos'] = bool(simbolos)
        imp['tem_corpo'] = bool(lang) and lang not in LINGUAGENS_SEM_CORPO
        return imp

    def _det_seco(self, fonte, blocos):
        """A fonte SEM os comentários e SEM espaço em branco nenhum.

        ⚠️ É `''.join(resto.split())`, e não uma lista de tokens. Chegou a ser
        tentador reaproveitar `tokens_do_arquivo` (`duplicados_impressoes.py`),
        mas ele só visita as FOLHAS da árvore — e em CSS `color: #ff6b9d` produz
        as folhas `property_name` e `#`, sem os dígitos do hexadecimal. Trocar
        `#ff6b9d` por `#00ff00` daria impressão idêntica, e "mudei só uma cor"
        não acordaria a Doc. Técnica. Sem erro nenhum na tela.

        O preço de fazer assim é colapsar o espaço DENTRO de literais de string
        (`"a  b"` e `"a b"` ficam iguais). É barato: quem edita o miolo de uma
        string quase sempre edita mais alguma coisa junto, e errar para menos
        aqui só custa uma documentação que não se atualizou por um espaço.
        """
        if not blocos:
            return ''.join(fonte.split())
        # Recorta de trás para frente: cortar da frente move todos os índices
        # seguintes, e o segundo corte cairia no lugar errado.
        pedacos = []
        fim_anterior = len(fonte)
        for b in sorted(blocos, key=lambda x: x['byte'], reverse=True):
            ini, fim = self._det_faixa(fonte, b)
            pedacos.append(fonte[fim:fim_anterior])
            fim_anterior = ini
        pedacos.append(fonte[:fim_anterior])
        return ''.join(''.join(reversed(pedacos)).split())

    @staticmethod
    def _det_faixa(fonte, bloco):
        """Começo e fim do bloco em índices de CARACTERE.

        ⚠️ O tree-sitter conta BYTES; o texto lido está em caracteres. Em
        arquivo só-ASCII dá no mesmo, e é por isso que o erro passaria despercebido
        num teste rápido — mas um acento antes do comentário desloca tudo. A
        conversão é feita pelo prefixo em utf-8.
        """
        try:
            bruto = fonte.encode('utf-8', errors='replace')
            ini = len(bruto[:bloco['byte']].decode('utf-8', errors='ignore'))
            fim = len(bruto[:bloco.get('fim', bloco['byte'])].decode('utf-8', errors='ignore'))
            return ini, max(ini, fim)
        except Exception:
            return 0, 0

    def _det_prosa_de(self, fonte, lang):
        """Os blocos de comentário e docstring — por GRAMÁTICA, nunca por `#`.

        Reaproveita `_com_extrair`, da rotina Comentários, que já explica no
        próprio módulo por que um filtro de `#` e `//` erra em
        `cor = "#ff6b9d"  # a cor do chip` e dentro de qualquer URL.
        """
        if not lang:
            return []
        try:
            parser = self._det_parser(lang)
            if parser is None:
                return []
            arvore = parser.parse(fonte.encode('utf-8', errors='replace'))
            return self._com_extrair(arvore.root_node, lang)
        except Exception:
            return []

    def _det_parser(self, lang):
        """Um parser por linguagem, guardado — inclusive o `None`.

        `make_parser` custa um import por chamada, e o Detector passa por
        centenas de arquivos numa varredura completa.
        """
        cache = getattr(self, '_det_parsers', None)
        if cache is None:
            cache = self._det_parsers = {}
        if lang not in cache:
            cache[lang] = make_parser(lang)
        return cache[lang]

    def _det_simbolos_de(self, fonte, lang):
        """`(assinaturas, {símbolo: hash do corpo})`.

        A assinatura é `tipo::nome`, na ordem do arquivo — é ela que responde
        "criou, apagou ou renomeou uma função?". O hash do corpo responde "mexeu
        na lógica de alguma delas?".

        ⚠️ Em CSS e HTML não há corpo de função: o "símbolo" é o seletor e o
        elemento. Mudança dentro de uma regra CSS é, por definição, valor — e é
        isso que faz "mudei só uma cor" acordar a Doc. Técnica e o Resumo de
        Pastas, e mais ninguém.
        """
        if not lang:
            return [], {}
        try:
            parser = self._det_parser(lang)
            if parser is None:
                return [], {}
            raiz = parser.parse(fonte.encode('utf-8', errors='replace')).root_node
        except Exception:
            return [], {}

        if lang in LINGUAGENS_SEM_CORPO:
            return self._det_simbolos_sem_corpo(raiz, lang), {}

        assinaturas, corpos = [], {}
        pilha = [raiz]
        # Iterativo pelo mesmo motivo que `_com_extrair`: arquivo grande com
        # aninhamento profundo estoura o limite de recursão, e um RecursionError
        # aqui derrubaria a passada inteira por causa de um arquivo só.
        while pilha:
            node = pilha.pop()
            achado = simbolo_do_no(node, lang)
            if achado is not None:
                tipo, nome = achado
                if nome:
                    chave = '%s::%s' % (tipo, nome)
                    assinaturas.append((node.start_byte, chave))
                    try:
                        corpo = node.text.decode('utf-8', errors='replace')
                    except Exception:
                        corpo = ''
                    # ⚠️ O corpo entra SECO. Sem isto, mexer num comentário
                    # dentro de uma função mudaria o hash do corpo, a classe
                    # viria como "código alterado" e a Doc. Técnica acordaria —
                    # exatamente o gasto que esta etapa existe para cortar.
                    corpos[chave] = _md5(''.join(
                        self._det_seco(corpo, self._det_prosa_de(corpo, lang))))
            pilha.extend(node.children)

        # A pilha visita fora de ordem; o byte inicial devolve a ordem do
        # arquivo, que é a única que faz a assinatura ser comparável.
        assinaturas.sort()
        return [c for _b, c in assinaturas], corpos

    @staticmethod
    def _det_simbolos_sem_corpo(raiz, lang):
        """CSS e HTML: o seletor da regra e o elemento identificável.

        Deliberadamente mais grosso que `extract_css`/`extract_html` de
        `indexacao.py` — aqui só interessa "o conjunto de seletores mudou?", não
        montar um índice navegável.
        """
        alvos = ('rule_set', 'media_statement') if lang == 'CSS' else ('start_tag',)
        nomes = []
        pilha = [raiz]
        while pilha:
            node = pilha.pop()
            if node.type in alvos:
                try:
                    bruto = node.text.decode('utf-8', errors='replace')
                except Exception:
                    bruto = ''
                # Só a cabeça: o corpo da regra é VALOR, e entrar aqui faria
                # trocar uma cor contar como "mudou a estrutura".
                cabeca = ' '.join(bruto.split('{')[0].split())[:160]
                if cabeca:
                    nomes.append((node.start_byte, cabeca))
            pilha.extend(node.children)
        nomes.sort()
        return [c for _b, c in nomes]

    @staticmethod
    def _det_imports_de(fonte, ext):
        """Os alvos de import deste arquivo, ordenados.

        Usa os regex de `analise_grafo.py` em vez de `analyze_imports`, que varre
        o PROJETO INTEIRO e custa segundos — aqui a pergunta é sobre um arquivo.
        """
        alvos = set()
        try:
            if ext in ('.py', '.pyw', '.pyi'):
                for m in _PY_IMPORT.finditer(fonte):
                    # O mesmo desdobramento de `analyze_imports`: o grupo 2 é a
                    # lista de `import a, b, c`, e sem separar por vírgula
                    # trocar a ORDEM dos nomes contaria como import alterado.
                    bruto = m.group(1) or m.group(2) or ''
                    for parte in bruto.split(','):
                        parte = parte.strip().lstrip('.')
                        if parte:
                            alvos.add(parte)
            else:
                for m in _JS_IMPORT.finditer(fonte):
                    alvo = (m.group(1) or '').strip()
                    if alvo:
                        alvos.add(alvo)
        except Exception:
            return []
        return sorted(alvos)
