"""Os padrões de JavaScript que fazem uma ligação CERTA.

⚠️ A LISTA É FECHADA, E DE PROPÓSITO (D7, P4). Só casa destino escrito por
inteiro entre aspas: `location.href = 'x.html'`. Variável, concatenação
(`base + 'x.html'`), template com `${…}` ou função no lugar do nome NÃO
casam — uma ligação "provável" faria a errada parecer verdade. Não "melhore"
isto adivinhando.

O leitor não roda nada: só lê texto.
"""

import re

# Um texto literal: '…', "…" ou `…` (o de crase sem `${`, conferido depois).
_STR = r"""(?:'([^'\\\n]*)'|"([^"\\\n]*)"|`([^`\\]*)`)"""

# `location.href = 'X'` (e `window.`/`document.` na frente — o texto do
# padrão curto está dentro do longo). `=(?!=)` para não casar `==`.
_NAV = [
    re.compile(r'\blocation\s*\.\s*href\s*=(?!=)\s*' + _STR),
    re.compile(r'\blocation\s*=(?!=)\s*' + _STR),
    re.compile(r'\blocation\s*\.\s*(?:assign|replace)\s*\(\s*' + _STR + r'\s*\)'),
    re.compile(r'\bwindow\s*\.\s*open\s*\(\s*' + _STR),
]

_DIALOGO = re.compile(
    r'\bgetElementById\s*\(\s*' + _STR + r'\s*\)\s*\.\s*(?:showModal|show)\s*\(\s*\)')

# `document.getElementById('ID')` ou `document.querySelector('#ID')`.
_ALVO_ID = (r'\bdocument\s*\.\s*(?:getElementById\s*\(\s*' + _STR +
            r'|querySelector\s*\(\s*' + _STR + r')\s*\)\s*')
_PARAMS = r'(?:\([^()]*\)|[A-Za-z_$][\w$]*)'
_FUNCAO = r'function\s*[\w$]*\s*\([^()]*\)\s*\{'
_SETA_BLOCO = _PARAMS + r'\s*=>\s*\{'
_SETA_EXPR = _PARAMS + r'\s*=>(?!\s*\{)\s*'
_MANIP = [
    # (padrão, o corpo é bloco?)
    (re.compile(_ALVO_ID + r'\.\s*onclick\s*=(?!=)\s*(?:' + _FUNCAO + '|' + _SETA_BLOCO + ')'), True),
    (re.compile(_ALVO_ID + r'\.\s*onclick\s*=(?!=)\s*' + _SETA_EXPR), False),
    (re.compile(_ALVO_ID + r'\.\s*addEventListener\s*\(\s*([\'"`])click\7\s*,\s*(?:' +
                _FUNCAO + '|' + _SETA_BLOCO + ')'), True),
]


def _literal(m, inicio=1):
    """O texto de um `_STR` casado a partir do grupo `inicio`; `None` se for
    template com `${`."""
    for g in (inicio, inicio + 1, inicio + 2):
        v = m.group(g)
        if v is not None:
            if g == inicio + 2 and '${' in v:
                return None
            return v
    return None


def _antes_ok(texto, i):
    """O `location` não é propriedade de outra coisa (`quadro.location`):
    antes dele, só nada, `window.` ou `document.`."""
    j = i - 1
    while j >= 0 and texto[j] in ' \t\r\n':
        j -= 1
    if j < 0 or texto[j] != '.':
        return j < 0 or not (texto[j].isalnum() or texto[j] in '_$')
    k = j - 1
    while k >= 0 and texto[k] in ' \t\r\n':
        k -= 1
    fim = k + 1
    while k >= 0 and (texto[k].isalnum() or texto[k] in '_$'):
        k -= 1
    return texto[k + 1:fim] in ('window', 'document')


def navegacoes(texto):
    """Os destinos literais de navegação num trecho de JS, na ordem do texto."""
    achados = []
    for i, padrao in enumerate(_NAV):
        for m in padrao.finditer(texto or ''):
            if i < 3 and not _antes_ok(texto, m.start()):
                continue
            v = _literal(m)
            if v:
                achados.append((m.start(), v))
    achados.sort()
    vistos, saida = set(), []
    for pos, v in achados:
        if pos not in vistos:        # `location.href = …` não conta duas vezes
            vistos.add(pos)
            saida.append(v)
    return saida


def abre_dialogo(texto):
    """Os `Y` de `getElementById('Y').showModal()` / `.show()`."""
    saida = []
    for m in _DIALOGO.finditer(texto or ''):
        v = _literal(m)
        if v:
            saida.append(v)
    return saida


def _pular_texto(js, i):
    """`i` está numa aspa: devolve o índice logo depois de ela fechar."""
    aspa = js[i]
    i += 1
    while i < len(js):
        c = js[i]
        if c == '\\':
            i += 2
            continue
        if c == aspa:
            return i + 1
        i += 1
    return i


def _pular_comentario(js, i):
    """`i` está num `/`: devolve o fim do comentário, ou `None` se não é um."""
    if js.startswith('//', i):
        fim = js.find('\n', i)
        return len(js) if fim < 0 else fim
    if js.startswith('/*', i):
        fim = js.find('*/', i + 2)
        return len(js) if fim < 0 else fim + 2
    return None


def _bloco(js, abre):
    """O conteúdo entre a `{` em `abre` e a `}` que a fecha, contando chaves
    e pulando as que estão dentro de texto ou comentário."""
    fundo, i = 0, abre
    while i < len(js):
        c = js[i]
        if c in '\'"`':
            i = _pular_texto(js, i)
            continue
        if c == '/':
            fim = _pular_comentario(js, i)
            if fim is not None:
                i = fim
                continue
        if c == '{':
            fundo += 1
        elif c == '}':
            fundo -= 1
            if fundo == 0:
                return js[abre + 1:i]
        i += 1
    return js[abre + 1:]


def _expressao(js, inicio):
    """A expressão de uma seta sem chaves: até o `;` ou a quebra de linha
    fora de parênteses e de texto."""
    fundo, i = 0, inicio
    while i < len(js):
        c = js[i]
        if c in '\'"`':
            i = _pular_texto(js, i)
            continue
        if c in '([{':
            fundo += 1
        elif c in ')]}':
            if fundo == 0:
                break
            fundo -= 1
        elif c in ';\n' and fundo == 0:
            break
        i += 1
    return js[inicio:i]


def manipuladores(js):
    """`[(id, corpo)]` de cada manipulador de clique ligado a um `id` escrito
    por inteiro."""
    saida = []
    for padrao, eh_bloco in _MANIP:
        for m in padrao.finditer(js or ''):
            ident = _literal(m, 1)
            if ident is None:
                seletor = _literal(m, 4)
                if not seletor or not re.fullmatch(r'#[\w-]+', seletor):
                    continue
                ident = seletor[1:]
            if not ident:
                continue
            if eh_bloco:
                corpo = _bloco(js, m.end() - 1)
            else:
                corpo = _expressao(js, m.end())
            saida.append((m.start(), ident, corpo))
    saida.sort()
    return [(ident, corpo) for _, ident, corpo in saida]
