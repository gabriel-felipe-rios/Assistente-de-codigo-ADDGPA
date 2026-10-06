"""Linguagens contadas — grupos (para a UI) + nome de exibição por extensão.

Fonte ÚNICA de "quais linguagens/extensões contam" — usada pelo Resumo do projeto
(`indexacao.py::scan_workspace`), pelos Mapas (`analise_grafo.py::
get_file_tree_metrics`) e pela Complexidade, que antes tinham mapas diferentes.

⚠️ REVOGAÇÃO — 21/08/2026. Aqui estava escrito que não existia mais escolha de
subconjunto e que a tela "Linguagens contadas" tinha sido removida de propósito.
**Isso não vale mais**, e o aviso antigo não deve ser restaurado.

A escolha voltou, e desde 23/09/2026 é a vista **O que é código** de
Configurações › Arquivos que o programa lê: `arquivos-que-o-programa-le-o-que-
e-codigo.json`, com cada linguagem, o nome dela e as extensões dela — o
usuário pode acrescentar uma linguagem ("Astro") e ela passa a aparecer no
Resumo e nos Mapas. A seleção é **lida de verdade**, por `selecao_efetiva()` e
`nome_da_linguagem()` logo abaixo.

`LANGUAGE_GROUPS` e `LANG_MAP` viraram o **padrão de fábrica** e a reserva:
quem nunca abrir a tela vê os mesmos números de sempre, mais `.mts`/`.cts`
(23/09/2026) e `.pyi`, Vue, Svelte, Astro, Dart, Lua e `.jsonc` (fase 06 da
obra «Qualidade da documentação», D41).
"""

# Grupos por linguagem — o padrão de fábrica de "O que é código".
LANGUAGE_GROUPS = [
    # `.pyi` desde a fase 06 da obra «Qualidade da documentação» (D41): stub de
    # tipos do Python — a lista própria da Documentação Técnica já o tinha.
    {'label': 'Python',            'exts': ['.py', '.pyw', '.pyi']},
    {'label': 'JavaScript',        'exts': ['.js', '.jsx', '.mjs', '.cjs']},
    # `.mts`/`.cts` desde 23/09/2026 (D50): são TypeScript de módulo ES/CJS.
    {'label': 'TypeScript',        'exts': ['.ts', '.tsx', '.mts', '.cts']},
    {'label': 'HTML',              'exts': ['.html', '.htm']},
    {'label': 'CSS',               'exts': ['.css', '.scss', '.sass', '.less']},
    # Vue, Svelte e Astro desde a fase 06 (D41): componentes de front.
    {'label': 'Vue',               'exts': ['.vue']},
    {'label': 'Svelte',            'exts': ['.svelte']},
    {'label': 'Astro',             'exts': ['.astro']},
    {'label': 'C#',                'exts': ['.cs']},
    {'label': 'Java',              'exts': ['.java']},
    {'label': 'Kotlin',            'exts': ['.kt', '.kts']},
    {'label': 'Go',                'exts': ['.go']},
    {'label': 'Rust',              'exts': ['.rs']},
    {'label': 'C / C++',           'exts': ['.c', '.h', '.cc', '.cpp', '.cxx', '.hpp']},
    {'label': 'Ruby',              'exts': ['.rb']},
    {'label': 'PHP',               'exts': ['.php']},
    {'label': 'Swift',             'exts': ['.swift']},
    # Dart e Lua desde a fase 06 (D41).
    {'label': 'Dart',              'exts': ['.dart']},
    {'label': 'Lua',               'exts': ['.lua']},
    {'label': 'SQL',               'exts': ['.sql']},
    {'label': 'Shell',             'exts': ['.sh', '.bash']},
    {'label': 'PowerShell / Batch','exts': ['.ps1', '.bat', '.cmd']},
    # `.jsonc` (JSON com comentário) desde a fase 06 (D41).
    {'label': 'Formatos especiais','exts': ['.json', '.jsonc', '.md', '.txt', '.xml', '.yml', '.yaml', '.toml', '.ini']},
]

# Nome de exibição por extensão (legenda do Resumo/Mapas) — mais fino que o grupo:
# dentro de "Formatos especiais", .json aparece como "JSON", .md como "Markdown", etc.
LANG_MAP = {
    '.py': 'Python', '.pyw': 'Python', '.pyi': 'Python',
    '.vue': 'Vue', '.svelte': 'Svelte', '.astro': 'Astro',
    '.dart': 'Dart', '.lua': 'Lua', '.jsonc': 'JSON',
    '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
    '.ts': 'TypeScript', '.tsx': 'TypeScript', '.mts': 'TypeScript', '.cts': 'TypeScript',
    '.html': 'HTML', '.htm': 'HTML',
    '.css': 'CSS', '.scss': 'CSS', '.sass': 'CSS', '.less': 'CSS',
    '.cs': 'C#', '.java': 'Java', '.kt': 'Kotlin', '.kts': 'Kotlin',
    '.go': 'Go', '.rs': 'Rust',
    '.c': 'C', '.h': 'C', '.cc': 'C++', '.cpp': 'C++', '.cxx': 'C++', '.hpp': 'C++',
    '.rb': 'Ruby', '.php': 'PHP', '.swift': 'Swift', '.sql': 'SQL',
    '.sh': 'Shell', '.bash': 'Shell', '.ps1': 'PowerShell', '.bat': 'Batch', '.cmd': 'Batch',
    '.json': 'JSON', '.md': 'Markdown', '.txt': 'Texto', '.xml': 'XML',
    '.yml': 'YAML', '.yaml': 'YAML', '.toml': 'TOML', '.ini': 'INI',
}


# O grupo "Formatos especiais" é justamente o que NÃO é linguagem: dado
# (`.json`, `.xml`, `.yml`, `.toml`, `.ini`) e texto (`.txt`, `.md`). Derivar
# daqui, em vez de repetir a lista, é o que impede os dois de divergirem quando
# alguém acrescentar uma extensão ao grupo.
GRUPO_DOS_FORMATOS = 'Formatos especiais'
FORMATOS_ESPECIAIS = {
    ext
    for g in LANGUAGE_GROUPS if g['label'] == GRUPO_DOS_FORMATOS
    for ext in g['exts']
}


def _o_que_e_codigo():
    """A vista O que é código em vigor, ou `None` se não der para ler."""
    try:
        from modulos.configuracoes import ler_o_que_e_codigo
        return ler_o_que_e_codigo()
    except Exception:
        return None


def e_linguagem(ext):
    """True se a extensão é de uma linguagem, não de um formato de dado/texto.

    HTML e CSS contam: não são linguagem de programação no sentido estrito, mas
    são arquivos que o usuário escreve e mantém — a fronteira útil aqui é
    "código do projeto" × "dado", não "tem laço e condicional".

    Responde pelo JSON de O que é código (está numa linguagem, e não nos
    formatos); `LANG_MAP` é a reserva.
    """
    codigo = _o_que_e_codigo()
    if codigo is None:
        return ext in LANG_MAP and ext not in FORMATOS_ESPECIAIS
    return (any(ext in l['extensoes'] for l in codigo['linguagens'])
            and ext not in codigo['formatos_especiais'])


def nome_da_linguagem(ext):
    """O nome que o Resumo e os Mapas mostram para a extensão, ou `None`.

    `LANG_MAP` vem primeiro — é ele que mantém "C" e "C++" separados, e dá
    "JSON"/"Markdown" aos formatos. Depois, o `nome` da linguagem do JSON que
    tem a extensão: é o que faz uma linguagem acrescentada pelo usuário
    ("Astro") aparecer com o nome que ele deu.
    """
    if ext in LANG_MAP:
        return LANG_MAP[ext]
    codigo = _o_que_e_codigo()
    if codigo is None:
        return None
    for linguagem in codigo['linguagens']:
        if ext in linguagem['extensoes']:
            return linguagem['nome']
    return None


def todas_extensoes():
    """Todas as extensões conhecidas (default = todas ligadas), sem duplicatas."""
    vistos = []
    for g in LANGUAGE_GROUPS:
        for e in g['exts']:
            if e not in vistos:
                vistos.append(e)
    return vistos


# ═════════════════════════ A seleção efetiva
# O catálogo acima é o que o programa SABE reconhecer; isto aqui é o que ele foi
# mandado CONTAR. São coisas diferentes desde 21/08/2026, e é a segunda que o
# Resumo, os Mapas e a Complexidade consultam.
#
# ⚠️ O import de `configuracoes` é preguiçoso, dentro da função, e não no topo:
# `configuracoes.py` faz `from .constantes import *`, e um import no topo daqui
# fecharia o ciclo. Também é o que mantém este módulo importável sozinho.

def selecao_efetiva():
    """As extensões que contam como código, hoje: a lista de código de
    O que é código (linguagens + formatos + soltas − desmarcadas), que
    `ler_extensoes()` entrega em `contadas`.

    Cai no catálogo completo se a leitura falhar.
    """
    try:
        from modulos.configuracoes import ler_extensoes
        cfg = ler_extensoes()
        return set(cfg['contadas']) | set(cfg['extras'])
    except Exception:
        return set(todas_extensoes()) | {'.toml', '.ini', '.txt'}


def conta_como_codigo(ext):
    """True se a extensão soma linha e entra nos mapas.

    Desde 23/09/2026 a coluna "código" da antiga tabela de exceções virou a
    própria lista (`excecao_de(ext, 'codigo')` responde sempre `None`); a
    consulta fica como reserva, sem custo.
    """
    ext = (ext or '').lower()
    try:
        from modulos.configuracoes import excecao_de
        resposta = excecao_de(ext, 'codigo')
    except Exception:
        resposta = None
    if resposta is not None:
        return resposta
    return ext in selecao_efetiva()

