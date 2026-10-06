"""Tree-sitter: quais extensões têm gramática, e como abrir o parser de cada uma.

Fonte ÚNICA das duas coisas que toda rotina baseada em tree-sitter precisa antes
de qualquer coisa: o mapa extensão → linguagem, e a fábrica de parser por
linguagem. Nasceu dentro de `analise.py::parse_treesitter`, como dois valores
locais, e saiu de lá quando a rotina Comentários passou a precisar dos mesmos
dois — copiá-los seria manter dois mapas que divergem no primeiro dia em que
alguém acrescentar uma linguagem só de um lado.

⚠️ `EXT_LANG` é o que decide o que ENTRA numa varredura de tree-sitter. Arquivo
de extensão que não está aqui (`.json`, `.txt`, `.md`) cai fora sozinho, sem
regra de exclusão escrita em lugar nenhum — é de propósito: uma segunda lista,
dizendo o que fica de fora, seria código morto que mente quando as duas
discordarem.

⚠️ Não confundir com `linguagens.py`, que é "quais linguagens o programa CONTA"
(usado pelo Resumo e pelos Mapas). Lá a pergunta é de estatística e cobre
extensão sem gramática; aqui é "de qual extensão eu consigo uma árvore
sintática", e a resposta depende do binding instalado.
"""

import importlib


def tree_sitter_instalado():
    """O `tree_sitter` está disponível? Quem varre pergunta antes de começar.

    Separado de `make_parser` porque as duas falhas são diferentes: sem o pacote
    base não há varredura nenhuma a fazer, e o chamador devolve erro; sem o
    binding de UMA linguagem só aquela linguagem é pulada, em silêncio.
    """
    try:
        import tree_sitter  # noqa: F401
        return True
    except ImportError:
        return False


def extrair_erros_de_sintaxe(tree):
    """Percorre a árvore de um parser Tree-sitter pronto e devolve os nós
    `ERROR`/`MISSING` como `[{linha, coluna, trecho}]` — o sublinhado ondulado
    do Editor (Obra 12). `start_point` já vem em (linha, coluna) 0-based por
    nó, então só soma 1 na linha (o editor conta a partir de 1).

    Não desce dentro de um nó já marcado: um `ERROR` costuma ENGOLIR os filhos
    que não fizeram sentido pro parser, e listar os netos também duplicaria o
    mesmo erro várias vezes pela mesma linha.
    """
    erros = []

    def visitar(no):
        if no.type == 'ERROR' or no.is_missing:
            linha, coluna = no.start_point
            trecho = (no.text or b'')[:80].decode('utf-8', 'replace')
            erros.append({'linha': linha + 1, 'coluna': coluna, 'trecho': trecho})
            return
        for filho in no.children:
            visitar(filho)

    visitar(tree.root_node)
    return erros


EXT_LANG = {
    # `.pyw` é Python — a única diferença é o Windows abrir sem console. Estava
    # de fora, e por isso um `.pyw` dentro de uma pasta de trabalho não recebia
    # árvore sintática nenhuma. ⚠️ Isto NÃO faz o `.pyw` da raiz de um projeto
    # aparecer: quem decide o que entra na varredura é a pasta de trabalho, e
    # arquivo fora dela continua fora, de propósito.
    '.py': 'Python', '.pyw': 'Python', '.js': 'JavaScript', '.jsx': 'JavaScript',
    '.ts': 'TypeScript', '.tsx': 'TypeScript', '.mts': 'TypeScript', '.cts': 'TypeScript',
    '.cs': 'C#', '.java': 'Java', '.go': 'Go',
    '.rs': 'Rust', '.c': 'C', '.cpp': 'C++', '.cc': 'C++',
    '.h': 'C', '.hpp': 'C++', '.html': 'HTML', '.css': 'CSS',
    # Só com o tree-sitter-language-pack em `Program/Dependencies/` (23/09/2026):
    # dão árvore (Comentários, Duplicados, Mapa de I/O, Aparência, Detector), mas
    # NÃO símbolo — não há regra delas em `TIPOS_DE_SIMBOLO`. Nomes iguais aos de
    # `linguagens.LANG_MAP` (`.sh` é "Shell").
    '.kt': 'Kotlin', '.kts': 'Kotlin', '.rb': 'Ruby', '.php': 'PHP',
    '.swift': 'Swift', '.sql': 'SQL', '.ps1': 'PowerShell', '.vue': 'Vue',
    '.svelte': 'Svelte', '.sh': 'Shell', '.lua': 'Lua',
}


# ── Quais chamadas são acesso a disco ────────────────────────────────────────
# Substitui os 78 `re.compile` que moravam dentro de `scan_file_io`. A diferença
# que importa não é o formato: é a coluna do RECEPTOR.
#
# Um regex só enxerga o nome. `\.remove\s*\(` casa tanto em `os.remove(f)` quanto
# em `el.classList.remove('hidden')` — e num projeto de terceiro isso vira
# "deleção de arquivo" inventada em cima de manipulação de CSS. Com a árvore
# sintática dá para exigir de QUEM a chamada é.
#
# Cada tupla é `(receptor, nome, tipo)` ou `(receptor, nome, tipo, índice)`, onde
# o índice diz QUAL argumento carrega o alvo. O padrão é 0 — o primeiro —, mas
# há exceções que importam: em `json.dump(dados, arquivo)` o primeiro argumento
# são os DADOS, e usar o índice 0 ali faria o Mapa de I/O mostrar um dicionário
# inteiro no lugar do arquivo.
#
# O receptor tem três formas:
#   'os', 'os.path', 'fs'  → o texto do receptor tem de bater exatamente
#   RECEPTOR_QUALQUER ('*') → método sobre qualquer objeto. É o caso dos métodos
#                             de `pathlib.Path` (`p.read_text()`), onde o tipo do
#                             receptor não é conhecível sem inferência de tipos.
#                             Mantém exatamente o alcance (e o risco) que os
#                             padrões não qualificados de antes já tinham.
#   SEM_RECEPTOR ('')       → função solta: `open(...)`, `fopen(...)`.
#
# ⚠️ Os tipos são os MESMOS dez de sempre — `read_file`, `write_file`, `read_dir`,
# `create_dir`, `delete_file`, `delete_dir`, `delete`, `check_file`, `check_dir`,
# `check_path`. Não acrescente um 11º sem passar pela tela: os rótulos e os
# botões de filtro vivem em `frontend/modulos/mapaio.js` e `analise-template.js`.
#
# `'open'` é um tipo de trabalho, não um dos dez: quem consome decide entre
# `read_file` e `write_file` olhando o modo de abertura.

RECEPTOR_QUALQUER = '*'
SEM_RECEPTOR = ''

IO_CHAMADAS = {
    'Python': [
        (SEM_RECEPTOR, 'open', 'open'),
        # Leitura
        (RECEPTOR_QUALQUER, 'read_text', 'read_file'),
        (RECEPTOR_QUALQUER, 'read_bytes', 'read_file'),
        ('json', 'load', 'read_file'),
        ('yaml', 'safe_load', 'read_file'),
        ('csv', 'reader', 'read_file'),
        # `Image.open` é o Pillow lendo um arquivo de imagem do disco. Fica com
        # receptor exigido, e não solto, para não casar com `webbrowser.open`,
        # `socket.open` e afins — que não tocam disco nenhum.
        ('Image', 'open', 'read_file'),
        # Escrita
        (RECEPTOR_QUALQUER, 'write_text', 'write_file'),
        (RECEPTOR_QUALQUER, 'write_bytes', 'write_file'),
        # ⚠️ Índice 1: a assinatura é `dump(dados, arquivo)`. Com o índice
        # padrão o alvo viraria o dicionário serializado.
        ('json', 'dump', 'write_file', 1),
        ('yaml', 'dump', 'write_file', 1),
        ('shutil', 'copy', 'write_file'),
        ('shutil', 'copy2', 'write_file'),
        ('shutil', 'move', 'write_file'),
        ('shutil', 'copytree', 'write_file'),
        ('os', 'rename', 'write_file'),
        ('os', 'replace', 'write_file'),
        ('tempfile', 'NamedTemporaryFile', 'write_file'),
        # Pasta — leitura
        ('os', 'listdir', 'read_dir'),
        ('os', 'scandir', 'read_dir'),
        ('os', 'walk', 'read_dir'),
        ('glob', 'glob', 'read_dir'),
        ('glob', 'iglob', 'read_dir'),
        (RECEPTOR_QUALQUER, 'iterdir', 'read_dir'),
        # Pasta — criação
        ('os', 'makedirs', 'create_dir'),
        ('os', 'mkdir', 'create_dir'),
        (RECEPTOR_QUALQUER, 'mkdir', 'create_dir'),
        # Deleção
        ('os', 'remove', 'delete_file'),
        ('os', 'unlink', 'delete_file'),
        (RECEPTOR_QUALQUER, 'unlink', 'delete_file'),
        ('shutil', 'rmtree', 'delete_dir'),
        ('os', 'rmdir', 'delete_dir'),
        (RECEPTOR_QUALQUER, 'rmdir', 'delete_dir'),
        # Verificação. `getsize`/`getmtime` são consulta de METADADO (tamanho,
        # data) — entram como verificação, não como leitura de conteúdo.
        ('os.path', 'isfile', 'check_file'),
        ('os.path', 'getsize', 'check_file'),
        ('os.path', 'getmtime', 'check_file'),
        (RECEPTOR_QUALQUER, 'is_file', 'check_file'),
        ('os.path', 'isdir', 'check_dir'),
        (RECEPTOR_QUALQUER, 'is_dir', 'check_dir'),
        ('os.path', 'exists', 'check_path'),
        ('os.path', 'lexists', 'check_path'),
        (RECEPTOR_QUALQUER, 'exists', 'check_path'),
    ],
    # `fs.promises` entra como receptor próprio porque a API assíncrona do Node
    # é o caminho mais comum hoje, e `fs.promises.readFile` não bate com `fs`.
    'JavaScript': [
        ('fs', 'readFile', 'read_file'),      ('fs.promises', 'readFile', 'read_file'),
        ('fs', 'readFileSync', 'read_file'),
        ('fs', 'writeFile', 'write_file'),    ('fs.promises', 'writeFile', 'write_file'),
        ('fs', 'writeFileSync', 'write_file'),
        ('fs', 'appendFile', 'write_file'),
        ('fs', 'readdir', 'read_dir'),        ('fs.promises', 'readdir', 'read_dir'),
        ('fs', 'readdirSync', 'read_dir'),
        ('fs', 'mkdir', 'create_dir'),        ('fs.promises', 'mkdir', 'create_dir'),
        ('fs', 'mkdirSync', 'create_dir'),
        ('fs', 'unlink', 'delete_file'),
        ('fs', 'rmdir', 'delete_dir'),
        ('fs', 'rm', 'delete'),
        ('fs', 'existsSync', 'check_path'),
        ('fs', 'access', 'check_path'),
        ('fs', 'stat', 'check_path'),
        ('fs', 'statSync', 'check_path'),
    ],
    'Go': [
        ('os', 'Open', 'read_file'),
        ('os', 'Create', 'write_file'),
        ('os', 'ReadDir', 'read_dir'),
        ('os', 'MkdirAll', 'create_dir'),
        ('os', 'Remove', 'delete'),
        ('os', 'RemoveAll', 'delete_dir'),
        ('os', 'Stat', 'check_path'),
    ],
    'Rust': [
        ('File', 'open', 'read_file'),
        ('File', 'create', 'write_file'),
        ('fs', 'create_dir', 'create_dir'),
        ('fs', 'remove_file', 'delete_file'),
        ('fs', 'remove_dir', 'delete_dir'),
        ('fs', 'metadata', 'check_path'),
    ],
    'Java': [
        ('Files', 'readAllBytes', 'read_file'),
        ('Files', 'readString', 'read_file'),
        ('Files', 'write', 'write_file'),
        ('Files', 'writeString', 'write_file'),
        ('Files', 'createDirectory', 'create_dir'),
        ('Files', 'createDirectories', 'create_dir'),
        ('Files', 'delete', 'delete'),
        ('Files', 'exists', 'check_path'),
        ('Files', 'isDirectory', 'check_dir'),
        ('Files', 'isRegularFile', 'check_file'),
    ],
    'C': [
        (SEM_RECEPTOR, 'fopen', 'open'),
    ],
}
# TypeScript é JavaScript com tipos: mesma biblioteca `fs`, mesmas chamadas.
IO_CHAMADAS['TypeScript'] = IO_CHAMADAS['JavaScript']
IO_CHAMADAS['C++'] = IO_CHAMADAS['C']

# Classes cuja INSTANCIAÇÃO é o acesso a disco — `new FileReader(caminho)`. Não
# são chamadas de função, então não cabem na tabela acima: na árvore sintática
# são um nó de criação de objeto, com o nome da classe em outro campo.
IO_INSTANCIACOES = {
    'Java': {
        'FileReader': 'read_file',
        'FileInputStream': 'read_file',
        'FileWriter': 'write_file',
        'FileOutputStream': 'write_file',
    },
}


# ── O que conta como SÍMBOLO em cada linguagem ─────────────────────────
# Estava dentro de `build_symbol_index` (`indexacao.py`), como dicionário local.
# Saiu de lá quando o Detector passou a precisar do mesmo mapa para responder
# "a assinatura deste arquivo mudou?" — pelo mesmo motivo que `EXT_LANG` e
# `make_parser` saíram de `analise.py`: dois mapas divergem no primeiro dia em
# que alguém acrescenta uma linguagem só de um lado.
#
# ⚠️ CSS e HTML NÃO estão aqui, e é de propósito: neles o símbolo não é um nó de
# um tipo, é o seletor da regra e o elemento identificável. Cada consumidor trata
# os dois à parte — ver `extract_css`/`extract_html` em `indexacao.py`.
TIPOS_DE_SIMBOLO = {
    'Python':     {'class_definition': 'class', 'function_definition': 'function'},
    'JavaScript': {'class_declaration': 'class', 'function_declaration': 'function', 'method_definition': 'method'},
    'TypeScript': {'class_declaration': 'class', 'function_declaration': 'function', 'method_definition': 'method',
                   'interface_declaration': 'interface', 'type_alias_declaration': 'type', 'enum_declaration': 'enum'},
    'C#':         {'class_declaration': 'class', 'method_declaration': 'method', 'interface_declaration': 'interface'},
    'Java':       {'class_declaration': 'class', 'method_declaration': 'method', 'interface_declaration': 'interface'},
    'Go':         {'function_declaration': 'function', 'method_declaration': 'method', 'type_spec': 'type'},
    'Rust':       {'struct_item': 'struct', 'function_item': 'function', 'impl_item': 'impl', 'enum_item': 'enum'},
    'C':          {'function_definition': 'function', 'struct_specifier': 'struct'},
    'C++':        {'class_specifier': 'class', 'function_definition': 'function', 'struct_specifier': 'struct'},
}

# Os tipos de nó que carregam o NOME de um símbolo, em qualquer das gramáticas
# acima. Quem procura o nome pega o primeiro filho que estiver aqui.
#
# `property_identifier`/`private_property_identifier` são o nome do
# `method_definition` de JS/TS (`acelerar() {}`, `#priv() {}`). Sem eles o
# método era achado e descartado em silêncio, por falta de nome. Só JS e TS têm
# esses nós — as outras gramáticas não são afetadas.
NOMES_DE_SIMBOLO = {'identifier', 'type_identifier', 'name', 'field_identifier',
                    'property_identifier', 'private_property_identifier'}

# `const f = () => …`: o nó `variable_declarator` só é símbolo quando o
# valor é uma função. `const x = 5` tem o MESMO nó e não é símbolo — por isso
# este caso não cabe no dicionário simples de `TIPOS_DE_SIMBOLO`.
FUNCOES_COMO_VALOR = {'arrow_function', 'function_expression', 'generator_function'}
SIMBOLO_PELO_VALOR = {'JavaScript': {'variable_declarator': 'function'},
                      'TypeScript': {'variable_declarator': 'function'}}


def simbolo_do_no(node, lang):
    """`(tipo, nome)` se `node` é símbolo em `lang`, senão `None`.

    A regra única dos três consumidores (indexacao, detector_pedacos,
    detector_impressoes): o nó é de um tipo de `TIPOS_DE_SIMBOLO` — ou um
    `variable_declarator` cujo valor é função — e o nome é o primeiro filho
    cujo tipo está em `NOMES_DE_SIMBOLO`. Sem nome, não é símbolo.
    """
    tipo = TIPOS_DE_SIMBOLO.get(lang, {}).get(node.type)
    if tipo is None:
        tipo = SIMBOLO_PELO_VALOR.get(lang, {}).get(node.type)
        valor = node.child_by_field_name('value') if tipo else None
        if valor is None or valor.type not in FUNCOES_COMO_VALOR:
            return None
    for filho in node.children:
        if filho.type in NOMES_DE_SIMBOLO:
            return tipo, filho.text.decode('utf-8', errors='replace')
    return None


def linguagem_tem_simbolos(lang):
    """Se `lang` tem alguma regra de símbolo — nas duas tabelas acima."""
    return bool(TIPOS_DE_SIMBOLO.get(lang) or SIMBOLO_PELO_VALOR.get(lang))

# As duas linguagens cujo símbolo não sai de `TIPOS_DE_SIMBOLO` — e, por isso,
# as duas em que "mudou dentro de um corpo" não significa "mudou lógica".
LINGUAGENS_SEM_CORPO = ('CSS', 'HTML')


# Nome que o programa usa (EXT_LANG) → nome no tree-sitter-language-pack, que
# mora em `Program/Dependencies/` (AMF § 9.6; `Workshop/requirements-dependencies.txt`).
# ⚠️ Linguagem nova em `EXT_LANG` precisa da entrada aqui, ou não ganha parser.
NOME_NO_PACOTE = {'Python': 'python', 'JavaScript': 'javascript',
                  'TypeScript': 'typescript', 'C#': 'csharp', 'Java': 'java',
                  'Go': 'go', 'Rust': 'rust', 'C': 'c', 'C++': 'cpp',
                  'HTML': 'html', 'CSS': 'css',
                  'Kotlin': 'kotlin', 'Ruby': 'ruby', 'PHP': 'php', 'Swift': 'swift',
                  'SQL': 'sql', 'PowerShell': 'powershell', 'Vue': 'vue',
                  'Svelte': 'svelte', 'Shell': 'bash', 'Lua': 'lua'}

# As gramáticas soltas do Python do sistema: (módulo, função que dá a linguagem).
# Só valem enquanto o pacote não estiver instalado em `Program/Dependencies/`.
GRAMATICA_SOLTA = {
    'Python': ('tree_sitter_python', 'language'),
    'JavaScript': ('tree_sitter_javascript', 'language'),
    'TypeScript': ('tree_sitter_typescript', 'language_typescript'),
    'C#': ('tree_sitter_c_sharp', 'language'),
    'Java': ('tree_sitter_java', 'language'),
    'Go': ('tree_sitter_go', 'language'),
    'Rust': ('tree_sitter_rust', 'language'),
    'C': ('tree_sitter_c', 'language'),
    'C++': ('tree_sitter_cpp', 'language'),
    'HTML': ('tree_sitter_html', 'language'),
    'CSS': ('tree_sitter_css', 'language'),
}


def make_parser(lang_name):
    """Um parser pronto para a linguagem, ou `None` se o binding não estiver lá.

    Carrega pelo tree-sitter-language-pack (`Program/Dependencies/`); sem ele,
    cai na gramática solta do Python do sistema. É o ÚNICO lugar do programa
    que abre parser — `indexacao.py` e `complexidade.py` chamam este.

    Devolver `None` em vez de levantar é o contrato que os chamadores esperam:
    eles cacheiam o resultado por linguagem — inclusive o `None` — e seguem para
    o próximo arquivo. Um projeto com Rust e sem `tree_sitter_rust` instalado
    continua sendo varrido nas outras dez linguagens.
    """
    nome = NOME_NO_PACOTE.get(lang_name)
    if not nome:
        return None
    try:
        from tree_sitter import Language, Parser
    except ImportError:
        return None
    try:
        from tree_sitter_language_pack import get_language
        return Parser(get_language(nome))
    except Exception:
        pass
    # Plano B: o pacote ainda não está em `Program/Dependencies/` — a gramática
    # solta do Python do sistema, como era antes. Linguagem só do pacote (Ruby,
    # Kotlin…) não tem solta e dá `None`.
    solta = GRAMATICA_SOLTA.get(lang_name)
    if not solta:
        return None
    try:
        modulo = importlib.import_module(solta[0])
        fn = getattr(modulo, solta[1], None) or getattr(modulo, 'language', None)
        return Parser(Language(fn()))
    except Exception:
        return None
