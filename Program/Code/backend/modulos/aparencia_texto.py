from .constantes import *
import unicodedata
from .treesitter import EXT_LANG, make_parser, tree_sitter_instalado

# ══════════════════════════════════ APARÊNCIA · TEXTO: ONDE ELE ESTÁ, NÃO COMO É ══
# A pergunta mudou. Antes era "esse literal PARECE texto de interface?" — e a
# resposta saía de uma heurística de escrita: tem espaço, começa com maiúscula,
# tem acento. Duas coisas estavam erradas nisso:
#
#   1. Ela reprovava o que devia passar. `APARENCIA_RE_STRING` exigia string sem
#      quebra de linha e com no máximo 120 caracteres, e neste projeto a
#      interface mora em template literal de dezenas de linhas dentro dos
#      `*-template.js`. O rótulo do botão NUNCA entrava no índice.
#   2. Ela aprovava o que devia reprovar. `_aparencia_sem_acento` rebaixava a
#      caixa junto com o acento, então "tem acento?" virava "tem maiúscula em
#      qualquer posição?" — e quase tudo tem.
#
# Agora a pergunta é ONDE o texto está, e quem responde é a árvore sintática.
# Com a árvore, o template literal de 50 linhas é um nó só — e dá para entrar
# nele e achar o `<button>Salvar</button>` que mora lá dentro.
#
# ⚠️ Nada é reprovado. O que não convence não some: recebe uma etiqueta que vem
# DESLIGADA na tela e desce no ranking. Sumiço é irreversível pelo usuário;
# ordenação, não.

# ── As etiquetas ────────────────────────────────────────────────────────────
APARENCIA_ETIQUETA_ROTULO = 'rótulo'
APARENCIA_ETIQUETA_MENSAGEM = 'mensagem'
APARENCIA_ETIQUETA_ATRIBUTO = 'atributo'
APARENCIA_ETIQUETA_IDENTIFICADOR = 'identificador'
APARENCIA_ETIQUETA_IMAGEM = 'nome de imagem'

APARENCIA_ETIQUETAS = (
    APARENCIA_ETIQUETA_ROTULO, APARENCIA_ETIQUETA_MENSAGEM,
    APARENCIA_ETIQUETA_ATRIBUTO, APARENCIA_ETIQUETA_IDENTIFICADOR,
    APARENCIA_ETIQUETA_IMAGEM,
)
# Ligadas de fábrica: o que o usuário lê na tela. As outras existem, contam e
# ficam a um clique de distância.
APARENCIA_ETIQUETAS_LIGADAS = (
    APARENCIA_ETIQUETA_ROTULO, APARENCIA_ETIQUETA_MENSAGEM, APARENCIA_ETIQUETA_IMAGEM)

APARENCIA_ETIQUETA_ICONE = {
    APARENCIA_ETIQUETA_ROTULO: '🏷', APARENCIA_ETIQUETA_MENSAGEM: '💬',
    APARENCIA_ETIQUETA_ATRIBUTO: '⚙', APARENCIA_ETIQUETA_IDENTIFICADOR: '🔤',
    APARENCIA_ETIQUETA_IMAGEM: '🖼',
}

APARENCIA_TEXTO_MINIMO = 2
APARENCIA_TEXTO_MAXIMO = 200
APARENCIA_MAX_BYTES_ARVORE = 500 * 1024

APARENCIA_ARQUIVOS_TRADUCAO = ('.json', '.yaml', '.yml', '.resx', '.arb', '.po', '.ini')


# ── Normalização ────────────────────────────────────────────────────────────
def aparencia_sem_acento(texto):
    """Normaliza para COMPARAÇÃO: sem acento e minúsculo."""
    decomposto = unicodedata.normalize('NFD', texto or '')
    return ''.join(c for c in decomposto if unicodedata.category(c) != 'Mn').lower()


def aparencia_sem_acento_mantendo_caixa(texto):
    """Só tira o acento. A caixa fica.

    Existe porque a irmã acima rebaixa a caixa, e quem quiser perguntar "esse
    texto tem acento?" comparando o antes com o depois recebia `True` de
    qualquer palavra com uma maiúscula. Era esse o defeito da heurística velha.
    """
    decomposto = unicodedata.normalize('NFD', texto or '')
    return ''.join(c for c in decomposto if unicodedata.category(c) != 'Mn')


def aparencia_tem_acento(texto):
    return (texto or '') != aparencia_sem_acento_mantendo_caixa(texto)


# ── O que é estrutura, e não prosa ──────────────────────────────────────────
# ⚠️ Isto NÃO é a heurística velha de volta. A heurística velha decidia se o
# texto ENTRAVA; estas regras só decidem em que PRATELEIRA ele entra — tudo
# continua no índice, contado. E elas olham para a forma do dado (um caminho,
# um seletor, um formato de printf), não para o estilo da escrita.
APARENCIA_RE_TEM_LETRA = re.compile(r'[A-Za-zÀ-ÿ]')
APARENCIA_RE_SO_IDENTIFICADOR = re.compile(r'^[a-z0-9_.\-/]+$')
APARENCIA_MARCAS_DE_CODIGO = ('://', '\\', '{', '}', '%s', '%d', '%r', '/>')


def aparencia_parece_estrutura(texto, extensao=''):
    """O texto tem cara de caminho, seletor, chave ou formato?"""
    texto = (texto or '').strip()
    if not APARENCIA_RE_TEM_LETRA.search(texto):
        return True
    if any(marca in texto for marca in APARENCIA_MARCAS_DE_CODIGO):
        return True
    if texto.startswith(('.', '#', '@', '-', '/')):
        return True
    if (APARENCIA_RE_SO_IDENTIFICADOR.match(texto)
            and extensao not in APARENCIA_ARQUIVOS_TRADUCAO):
        return True
    return False


def aparencia_texto_aproveitavel(texto):
    texto = (texto or '').strip()
    return APARENCIA_TEXTO_MINIMO <= len(texto) <= APARENCIA_TEXTO_MAXIMO


# ── Leitor de reserva: as extensões sem gramática ───────────────────────────
# 28 das 44 extensões da aba não têm gramática em `EXT_LANG` (`.scss`, `.xaml`,
# `.vue`, `.lua`, `.resx`…). Para elas continua valendo o leitor lexical — e o
# achado sai MARCADO COMO PALPITE na tela, porque sem árvore não dá para saber
# onde o texto está, só como ele é escrito.
#
# ⚠️ A marca de palpite é SÓ para texto. Cor é lexical em toda linguagem:
# `#RRGGBB`, `rgb()`, `FromArgb()` e `var()` valem igual num arquivo com
# gramática e num sem. Marcar cor de palpite seria mentir sobre a confiança.
APARENCIA_RE_STRING_SOLTA = re.compile(
    r'"([^"\\\n]{2,200})"'
    r"|'([^'\\\n]{2,200})'"
    r'|`([^`\\\n]{2,200})`')
APARENCIA_RE_TEXTO_DE_TAG = re.compile(r'>([^<>{}]{2,200})<')
APARENCIA_RE_ATRIBUTO_DE_TAG = re.compile(
    r'\b([A-Za-z_:][\w:.-]*)\s*=\s*"([^"\n]{2,200})"')


def aparencia_ler_reserva(linhas, extensao):
    """Leitor lexical, linha a linha. Todo achado sai com `palpite=True`."""
    achados = []
    for numero, linha in enumerate(linhas, start=1):
        cortada = linha.rstrip('\n')
        if not cortada.strip():
            continue

        vistos = set()
        # Texto entre tags primeiro: em `.xaml`, `.vue`, `.svg` e `.resx` é onde
        # o rótulo de verdade mora, e ele não está entre aspas.
        for casamento in APARENCIA_RE_TEXTO_DE_TAG.finditer(cortada):
            texto = casamento.group(1).strip()
            if not aparencia_texto_aproveitavel(texto):
                continue
            vistos.add(texto)
            achados.append(_aparencia_achado_de_texto(
                texto, numero, APARENCIA_ETIQUETA_ROTULO, extensao, palpite=True))

        for casamento in APARENCIA_RE_ATRIBUTO_DE_TAG.finditer(cortada):
            texto = casamento.group(2).strip()
            if not aparencia_texto_aproveitavel(texto) or texto in vistos:
                continue
            vistos.add(texto)
            achados.append(_aparencia_achado_de_texto(
                texto, numero, APARENCIA_ETIQUETA_ATRIBUTO, extensao, palpite=True))

        for casamento in APARENCIA_RE_STRING_SOLTA.finditer(cortada):
            texto = (casamento.group(1) or casamento.group(2)
                     or casamento.group(3) or '').strip()
            if not aparencia_texto_aproveitavel(texto) or texto in vistos:
                continue
            vistos.add(texto)
            etiqueta = (APARENCIA_ETIQUETA_IDENTIFICADOR
                        if aparencia_parece_estrutura(texto, extensao)
                        else APARENCIA_ETIQUETA_ROTULO)
            achados.append(_aparencia_achado_de_texto(
                texto, numero, etiqueta, extensao, palpite=True))
    return achados


def _aparencia_achado_de_texto(texto, linha, etiqueta, extensao, palpite=False):
    return {
        'valor': texto,
        'linha': linha,
        'etiqueta': etiqueta,
        'palpite': bool(palpite),
        'eh_traducao': extensao in APARENCIA_ARQUIVOS_TRADUCAO,
    }


# ── Leitor com árvore ───────────────────────────────────────────────────────
# Tipos de nó que guardam texto. A lista é por SUFIXO e por nome inteiro porque
# cada gramática batiza o seu do seu jeito (`string_literal` em C#,
# `interpreted_string_literal` em Go, `template_string` em JS).
APARENCIA_NOS_STRING = (
    'string', 'string_literal', 'raw_string_literal', 'interpreted_string_literal',
    'char_literal', 'encapsed_string', 'line_string_literal',
    'verbatim_string_literal', 'concatenated_string', 'template_string',
)
# `raw_text` fica DE FORA: na gramática de HTML é o miolo de `<script>` e
# `<style>`, isto é, código inteiro — colhê-lo como texto de tela encheria o
# índice com o arquivo todo numa entrada só.
APARENCIA_NOS_TEXTO_MARKUP = ('text',)
APARENCIA_NOS_ATRIBUTO = ('attribute_value', 'quoted_attribute_value')

APARENCIA_NOS_MENSAGEM = ('raise_statement', 'throw_statement')
APARENCIA_ESCRITORES_DE_TELA = (
    'textContent', 'innerHTML', 'innerText', 'outerHTML', 'title', 'placeholder',
    'label', 'text', 'value', 'setText', 'setTitle', 'showToast', 'alert',
)
APARENCIA_MARCADORES_DE_ATRIBUTO = (
    'className', 'classList', 'setAttribute', 'class', 'id', 'dataset', 'style')
APARENCIA_NOS_IDENTIFICADOR = (
    'pair', 'keyword_argument', 'import_statement', 'import_from_statement',
    'field_declaration', 'attribute')

APARENCIA_RE_PARECE_MARKUP = re.compile(r'<\s*[A-Za-z][\w-]*[\s>/]')


class AparenciaLeitorDeTexto:
    """Um leitor por rodada de indexação. Guarda o cache de parser da rodada.

    O cache guarda o `None` também — é o contrato de `make_parser`: binding de
    uma linguagem ausente é pulado uma vez, não a cada arquivo.
    """

    def __init__(self):
        self.parsers = {}
        self.disponivel = tree_sitter_instalado()

    def parser(self, linguagem):
        if not self.disponivel or not linguagem:
            return None
        if linguagem not in self.parsers:
            self.parsers[linguagem] = make_parser(linguagem)
        return self.parsers.get(linguagem)

    def tem_gramatica(self, extensao):
        return bool(self.parser(EXT_LANG.get(extensao)))

    def ler(self, caminho, extensao, linhas):
        """→ [{'valor','linha','etiqueta','palpite','eh_traducao'}]

        Cai no leitor de reserva sempre que a árvore não sai: extensão sem
        gramática, binding ausente, arquivo grande demais ou arquivo que o
        parser recusou. Nenhuma dessas quatro derruba a rodada.
        """
        linguagem = EXT_LANG.get(extensao)
        parser = self.parser(linguagem)
        if not parser:
            return aparencia_ler_reserva(linhas, extensao)
        try:
            if os.path.getsize(caminho) > APARENCIA_MAX_BYTES_ARVORE:
                return aparencia_ler_reserva(linhas, extensao)
        except OSError:
            return aparencia_ler_reserva(linhas, extensao)
        try:
            with open(caminho, 'rb') as arquivo:
                conteudo = arquivo.read()
            raiz = parser.parse(conteudo).root_node
        except Exception:
            return aparencia_ler_reserva(linhas, extensao)
        return self._varrer(raiz, extensao, linguagem)

    # ── Travessia ──────────────────────────────────────────────────────────
    def _varrer(self, raiz, extensao, linguagem, deslocamento=0):
        """Iterativa com pilha, nunca recursiva.

        Um arquivo com aninhamento fundo estouraria o limite de recursão do
        Python, e o `RecursionError` derrubaria a rodada inteira por causa de um
        arquivo só. Mesmo motivo da varredura de Comentários.
        """
        achados = []
        pilha = [raiz]
        while pilha:
            node = pilha.pop()
            tipo = node.type

            if tipo in APARENCIA_NOS_TEXTO_MARKUP:
                self._colher_markup(node, extensao, deslocamento, achados)
                continue
            if tipo in APARENCIA_NOS_ATRIBUTO:
                self._colher(node, extensao, deslocamento, achados,
                             APARENCIA_ETIQUETA_ATRIBUTO)
                continue
            if tipo in APARENCIA_NOS_STRING:
                self._colher_string(node, extensao, linguagem, deslocamento, achados)
                continue     # o miolo da string já foi tratado; não descer nele

            pilha.extend(node.children)

        achados.sort(key=lambda a: a['linha'])
        return achados

    def _texto_do_no(self, node):
        try:
            return node.text.decode('utf-8', errors='replace')
        except Exception:
            return ''

    def _colher(self, node, extensao, deslocamento, achados, etiqueta):
        texto = self._texto_do_no(node).strip().strip('"\'`')
        if not aparencia_texto_aproveitavel(texto):
            return
        achados.append(_aparencia_achado_de_texto(
            texto, node.start_point[0] + 1 + deslocamento, etiqueta, extensao))

    def _colher_markup(self, node, extensao, deslocamento, achados):
        """Texto entre tags. Uma linha de cada vez: o nó pode abraçar várias."""
        bruto = self._texto_do_no(node)
        for salto, pedaco in enumerate(bruto.split('\n')):
            texto = pedaco.strip()
            if not aparencia_texto_aproveitavel(texto):
                continue
            etiqueta = (APARENCIA_ETIQUETA_IDENTIFICADOR
                        if aparencia_parece_estrutura(texto, extensao)
                        else APARENCIA_ETIQUETA_ROTULO)
            achados.append(_aparencia_achado_de_texto(
                texto, node.start_point[0] + 1 + salto + deslocamento,
                etiqueta, extensao))

    def _colher_string(self, node, extensao, linguagem, deslocamento, achados):
        bruto = self._texto_do_no(node)
        miolo = bruto.strip()
        for aspas in ('"""', "'''", '"', "'", '`'):
            if miolo.startswith(aspas) and miolo.endswith(aspas) and len(miolo) > len(aspas):
                miolo = miolo[len(aspas):-len(aspas)]
                break

        # A string que carrega markup é aberta e lida por dentro. É ISTO que faz
        # o rótulo do botão entrar no índice: nos `*-template.js` a interface
        # inteira mora num template literal, e sem abrir o nó o índice ficaria
        # com uma "string de 3.000 caracteres" no lugar de trinta rótulos.
        if APARENCIA_RE_PARECE_MARKUP.search(miolo):
            de_dentro = self._ler_markup_embutido(miolo, node, extensao, deslocamento)
            if de_dentro:
                achados.extend(de_dentro)
                return

        if not aparencia_texto_aproveitavel(miolo):
            return
        achados.append(_aparencia_achado_de_texto(
            miolo, node.start_point[0] + 1 + deslocamento,
            self._classificar(node, miolo, extensao), extensao))

    def _ler_markup_embutido(self, miolo, node, extensao, deslocamento):
        """Reparseia o conteúdo da string com a gramática de HTML."""
        parser = self.parser('HTML')
        # A string começa depois da aspa: o deslocamento de linha é o da string,
        # e a primeira linha do miolo é a mesma linha do nó.
        base = node.start_point[0] + deslocamento
        if not parser:
            # Sem a gramática de HTML instalada, ainda é melhor ler o miolo
            # linha a linha do que devolver a string inteira como um achado só.
            return [dict(achado, linha=achado['linha'] + base)
                    for achado in aparencia_ler_reserva(miolo.split('\n'), extensao)]
        try:
            raiz = parser.parse(miolo.encode('utf-8')).root_node
        except Exception:
            return []
        return self._varrer(raiz, extensao, 'HTML', deslocamento=base)

    def _classificar(self, node, texto, extensao):
        """Onde o texto está → que etiqueta ele leva.

        A ordem é do mais específico para o mais geral, e o caso geral é
        `rótulo`: quem tem de provar alguma coisa é quem quer DESLIGAR o achado,
        não quem quer mostrá-lo. Ao contrário, o índice voltaria a esconder o
        que o usuário procura.
        """
        pai = node.parent
        subida = 0
        while pai is not None and subida < 4:
            if pai.type in APARENCIA_NOS_MENSAGEM:
                return APARENCIA_ETIQUETA_MENSAGEM
            subida += 1
            pai = pai.parent

        contexto = ''
        pai = node.parent
        if pai is not None:
            try:
                contexto = pai.text.decode('utf-8', errors='replace')[:300]
            except Exception:
                contexto = ''

        if any(marca in contexto for marca in APARENCIA_MARCADORES_DE_ATRIBUTO):
            return APARENCIA_ETIQUETA_ATRIBUTO
        if any(marca in contexto for marca in APARENCIA_ESCRITORES_DE_TELA):
            return APARENCIA_ETIQUETA_ROTULO
        if pai is not None and pai.type in APARENCIA_NOS_IDENTIFICADOR:
            return APARENCIA_ETIQUETA_IDENTIFICADOR
        if aparencia_parece_estrutura(texto, extensao):
            return APARENCIA_ETIQUETA_IDENTIFICADOR
        return APARENCIA_ETIQUETA_ROTULO
