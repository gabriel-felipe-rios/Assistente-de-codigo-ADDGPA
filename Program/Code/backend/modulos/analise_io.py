"""Extração das operações de disco de um arquivo de código — os dois motores.

Quem varre o projeto é `analise.py::scan_file_io`; quem olha DENTRO de um
arquivo e devolve a lista de operações é este módulo. A separação nasceu quando
o motor trocou de regex para tree-sitter: os dois extratores juntos passavam de
80 linhas, e `analise.py` já estava em 471 — dividir virou obrigação da AMF, não
escolha de estilo.

── Por que DOIS motores, e não um ──
`extrair_por_arvore` é o motor principal e roda em toda linguagem com gramática
instalada (ver `EXT_LANG` em `treesitter.py`). `extrair_por_regex` é o caminho de
exceção, e continua existindo por três motivos concretos:

  1. `.rb`, `.php` e `.swift` estão em `CODE_EXTS` (contam como código para o
     Mapa de I/O) e NÃO estão em `EXT_LANG` (não há gramática instalada). Sem o
     regex, esses três perderiam a cobertura que já tinham.
  2. `make_parser` devolve `None` quando falta o binding daquela linguagem na
     máquina. Sem fallback, o arquivo sumiria da tela em vez de aparecer com
     menos precisão.
  3. Arquivo que não parseia (truncado, encoding estranho) ainda dá alguma
     resposta.

── O que o tree-sitter ganha, concretamente ──
O regex olha uma LINHA e pega a primeira coisa entre aspas como se fosse o
caminho. Em `open(fpath, 'r', encoding='utf-8')` isso captura `'r'`. Medido neste
projeto: 174 operações mostravam um modo de abertura ou um encoding no lugar do
caminho. A árvore sintática sabe qual nó é o primeiro argumento, então o valor
sai certo — e quando o argumento é uma variável, sai a expressão, que é verdade,
em vez de um literal aleatório da mesma linha.

⚠️ O que NENHUM dos dois faz: descobrir o caminho REAL no disco. Ele não está no
código — é montado em tempo de execução a partir das pastas que o usuário
configura. Foi medido por quatro métodos diferentes (regex, AST, AST com
resolução de variáveis, tree-sitter): zero de 716 chamadas resolvem para um
caminho literal. Não tente "melhorar o parser" para conseguir: a informação não
está no texto do programa.
"""

import re

from modulos.treesitter import (
    IO_CHAMADAS, IO_INSTANCIACOES, RECEPTOR_QUALQUER, SEM_RECEPTOR,
)

# Os padrões do motor antigo. Continuam sendo a verdade para `.rb`/`.php`/
# `.swift` e para quando falta o binding — ver o cabeçalho do módulo.
PATTERNS = [
    # open() genérico — o modo decide entre leitura e escrita, mais abaixo
    (re.compile(r'\bopen\s*\('),          'open'),
    (re.compile(r'\bfopen\s*\('),         'open'),
    (re.compile(r'\.read_text\s*\('),     'read_file'),
    (re.compile(r'\.read_bytes\s*\('),    'read_file'),
    (re.compile(r'\bjson\.load\b'),       'read_file'),
    (re.compile(r'\byaml\.safe_load\b'),  'read_file'),
    (re.compile(r'\bcsv\.reader\b'),      'read_file'),
    (re.compile(r'\.write_text\s*\('),    'write_file'),
    (re.compile(r'\.write_bytes\s*\('),   'write_file'),
    (re.compile(r'\bjson\.dump\b'),       'write_file'),
    (re.compile(r'\byaml\.dump\b'),       'write_file'),
    (re.compile(r'\bshutil\.copy\b'),     'write_file'),
    (re.compile(r'\bshutil\.copy2\b'),    'write_file'),
    (re.compile(r'\bshutil\.move\b'),     'write_file'),
    (re.compile(r'\bos\.listdir\s*\('),   'read_dir'),
    (re.compile(r'\bglob\.glob\s*\('),    'read_dir'),
    (re.compile(r'\bglob\.iglob\s*\('),   'read_dir'),
    (re.compile(r'\.iterdir\s*\('),       'read_dir'),
    (re.compile(r'\bos\.scandir\s*\('),   'read_dir'),
    (re.compile(r'\bos\.makedirs\s*\('),  'create_dir'),
    (re.compile(r'\bos\.mkdir\s*\('),     'create_dir'),
    (re.compile(r'\.mkdir\s*\('),         'create_dir'),
    (re.compile(r'\bos\.remove\s*\('),    'delete_file'),
    (re.compile(r'\bos\.unlink\s*\('),    'delete_file'),
    (re.compile(r'\.unlink\s*\('),        'delete_file'),
    (re.compile(r'\bfs::remove_file\b'),  'delete_file'),
    (re.compile(r'\bshutil\.rmtree\b'),   'delete_dir'),
    (re.compile(r'\bos\.rmdir\s*\('),     'delete_dir'),
    (re.compile(r'\.rmdir\s*\('),         'delete_dir'),
    (re.compile(r'\bfs::remove_dir\b'),   'delete_dir'),
    (re.compile(r'\bos\.path\.isfile\s*\('),  'check_file'),
    (re.compile(r'\.is_file\s*\('),            'check_file'),
    (re.compile(r'\bos\.path\.isdir\s*\('),   'check_dir'),
    (re.compile(r'\.is_dir\s*\('),             'check_dir'),
    (re.compile(r'\bos\.path\.exists\s*\('),  'check_path'),
    (re.compile(r'\bos\.path\.lexists\s*\('), 'check_path'),
    (re.compile(r'\.exists\s*\('),             'check_path'),
    (re.compile(r'\bfs\.readFile\b'),          'read_file'),
    (re.compile(r'\bfs\.readFileSync\b'),      'read_file'),
    (re.compile(r'\bfs\.writeFile\b'),         'write_file'),
    (re.compile(r'\bfs\.writeFileSync\b'),     'write_file'),
    (re.compile(r'\bfs\.appendFile\b'),        'write_file'),
    (re.compile(r'\bfs\.readdir\b'),           'read_dir'),
    (re.compile(r'\bfs\.readdirSync\b'),       'read_dir'),
    (re.compile(r'\bfs\.mkdir\b'),             'create_dir'),
    (re.compile(r'\bfs\.mkdirSync\b'),         'create_dir'),
    (re.compile(r'\bfs\.unlink\b'),            'delete_file'),
    (re.compile(r'\bfs\.rmdir\b'),             'delete_dir'),
    (re.compile(r'\bfs\.rm\b'),                'delete'),
    (re.compile(r'\bfs\.existsSync\b'),        'check_path'),
    (re.compile(r'\bfs\.access\b'),            'check_path'),
    (re.compile(r'\bfs\.stat\b'),              'check_path'),
    (re.compile(r'\bfs\.statSync\b'),          'check_path'),
    (re.compile(r'\bos\.Open\b'),              'read_file'),
    (re.compile(r'\bos\.Create\b'),            'write_file'),
    (re.compile(r'\bos\.ReadDir\b'),           'read_dir'),
    (re.compile(r'\bos\.MkdirAll\b'),          'create_dir'),
    (re.compile(r'\bos\.Remove\b'),            'delete'),
    (re.compile(r'\bos\.RemoveAll\b'),         'delete_dir'),
    (re.compile(r'\bos\.Stat\b'),              'check_path'),
    (re.compile(r'\bFile::open\b'),            'read_file'),
    (re.compile(r'\bFile::create\b'),          'write_file'),
    (re.compile(r'\bfs::create_dir\b'),        'create_dir'),
    (re.compile(r'\bfs::metadata\b'),          'check_path'),
    (re.compile(r'new\s+FileReader'),          'read_file'),
    (re.compile(r'new\s+FileInputStream'),     'read_file'),
    (re.compile(r'new\s+FileWriter'),          'write_file'),
    (re.compile(r'new\s+FileOutputStream'),    'write_file'),
    (re.compile(r'\bFiles\.readAllBytes\b'),   'read_file'),
    (re.compile(r'\bFiles\.readString\b'),     'read_file'),
    (re.compile(r'\bFiles\.write\b'),          'write_file'),
    (re.compile(r'\bFiles\.writeString\b'),    'write_file'),
    (re.compile(r'\bFiles\.createDirectory\b'),  'create_dir'),
    (re.compile(r'\bFiles\.createDirectories\b'),'create_dir'),
    (re.compile(r'\bFiles\.delete\b'),           'delete'),
    (re.compile(r'\bFiles\.exists\b'),           'check_path'),
    (re.compile(r'\bFiles\.isDirectory\b'),      'check_dir'),
    (re.compile(r'\bFiles\.isRegularFile\b'),    'check_file'),
]

# "Este `open()` é de leitura ou de escrita?" — decidido pelo modo, que é o
# segundo argumento: `'w'`, `'a'`, `'x'`, ou qualquer um deles com `+`/`b`.
WRITE_MODE = re.compile(r'''['"]\s*[wWaAxX+][^'"]{0,4}['"]''')
_PATH_LITERAL = re.compile(r'''["']([^"'\n]{1,200})["']''')

# Nós de chamada e de lista de argumentos, por família de gramática. Os nomes
# mudam de linguagem para linguagem; o formato da árvore, não.
_NOS_CHAMADA = {'call', 'call_expression', 'method_invocation', 'invocation_expression'}
_NOS_ARGUMENTOS = {'argument_list', 'arguments'}
_NOS_INSTANCIACAO = {'object_creation_expression', 'new_expression'}


def _texto(no, fonte):
    return fonte[no.start_byte:no.end_byte].decode('utf-8', errors='replace')


def _receptor_e_nome(no, fonte):
    """Separa `os.path.exists` em ('os.path', 'exists').

    O receptor é o que impede contar `el.classList.remove('x')` como deleção de
    arquivo. Um protótipo desta obra, sem esta separação, marcou 227 chamadas de
    `classList.remove` como I/O — todas em cima de manipulação de classe CSS.

    ⚠️ Duas formas de árvore, não uma. Em Python/JS/Go/Rust o nó da chamada tem
    um campo `function` com a expressão inteira (`Files.readString`), e basta
    partir no último separador. Em Java e C# o nó é `method_invocation` /
    `invocation_expression`, que guarda o receptor num campo `object` SEPARADO e
    deixa em `name` só o nome curto. Sem tratar as duas, todo `Files.*` do Java
    passava batido — o receptor saía vazio e nada casava na tabela.
    """
    objeto = no.child_by_field_name('object')
    nome_no = no.child_by_field_name('name')
    if objeto is not None and nome_no is not None:
        return _texto(objeto, fonte).strip(), _texto(nome_no, fonte).strip()

    alvo = no.child_by_field_name('function') or nome_no
    if alvo is None:
        return None, None
    inteiro = _texto(alvo, fonte).strip()
    # Rust usa `::`; o resto usa `.`. Normalizar aqui evita uma tabela por sintaxe.
    separador = '::' if '::' in inteiro and '.' not in inteiro else '.'
    if separador not in inteiro:
        return SEM_RECEPTOR, inteiro
    receptor, _, nome = inteiro.rpartition(separador)
    return receptor.strip(), nome.strip()


def _argumento(no, indice=0):
    """O nó do argumento nº `indice` — pela POSIÇÃO na árvore, não pela 1ª aspas.

    É esta função que acaba com o `'r'` de `open(f, 'r')` aparecendo como se
    fosse um caminho: o modo é o argumento 1, e quem interessa é o 0.

    O índice não é sempre 0 porque nem toda assinatura põe o caminho na frente —
    `json.dump(dados, arquivo)` é o caso que obrigou o parâmetro a existir.
    """
    args = no.child_by_field_name('arguments')
    if args is None:
        for filho in no.children:
            if filho.type in _NOS_ARGUMENTOS:
                args = filho
                break
    if args is None:
        return None
    reais = [f for f in args.named_children if f.type != 'comment']
    if indice < len(reais):
        return reais[indice]
    # Argumento ausente (chamada com menos parâmetros do que a assinatura
    # completa) — melhor não devolver alvo nenhum do que devolver o errado.
    return None


def _e_escrita(no, fonte):
    """Para `open(...)`: o modo de abertura diz se é leitura ou escrita.

    ⚠️ Olha SÓ o argumento do modo — o 2º posicional, ou o `mode=` nomeado —,
    nunca a linha inteira. O motor antigo varria o texto todo com `WRITE_MODE`,
    e como esse padrão aceita qualquer literal curto começando em `w`/`a`/`x`,
    um caminho como `'x.txt'` ou `'a.md'` era lido como modo de escrita:
    `open('x.txt')`, que é leitura, aparecia na tela como escrita de arquivo.
    Com a árvore dá para perguntar pelo argumento certo.
    """
    modo = _argumento(no, 1)
    if modo is not None and modo.type == 'keyword_argument':
        modo = None
    if modo is None:
        # `mode=` nomeado pode vir em qualquer posição.
        args = no.child_by_field_name('arguments')
        if args is None:
            for filho in no.children:
                if filho.type in _NOS_ARGUMENTOS:
                    args = filho
                    break
        if args is None:
            return False
        for filho in args.named_children:
            if filho.type != 'keyword_argument':
                continue
            chave = filho.child_by_field_name('name')
            if chave is not None and _texto(chave, fonte).strip() == 'mode':
                modo = filho.child_by_field_name('value')
                break
    if modo is None:
        return False
    return bool(WRITE_MODE.search(_texto(modo, fonte)))


def _formatar_alvo(texto):
    """Deixa a expressão do alvo em UMA linha, sem as aspas de fora.

    Uma chamada quebrada em cinco linhas traz o argumento com quebras e
    indentação no meio; jogado assim na tela, estoura a coluna e fica ilegível.
    Aqui vira `os.path.join(base, 'x.json')`, em linha única.
    """
    texto = ' '.join(texto.split())
    if len(texto) >= 2 and texto[0] == texto[-1] and texto[0] in '\'"`':
        texto = texto[1:-1]
    return texto[:200]


def extrair_por_arvore(fonte, parser, lang):
    """Operações de disco de um arquivo, pela árvore sintática.

    `fonte` são os bytes do arquivo. Devolve a mesma forma que o motor antigo:
    lista de dicts com `type`, `line`, `call` e `alvo`.

    O campo `alvo` é a EXPRESSÃO do primeiro argumento, como escrita no código —
    `'config.json'` quando é literal, `caminho` quando é variável,
    `os.path.join(base, 'x.json')` quando é composta. Nunca é inventado um `*`
    nem um caminho "provável": o caminho real não está no código.

    ⚠️ Devolve `None` quando NÃO CONSEGUIU ler (linguagem sem tabela, árvore que
    não montou) e uma lista — possivelmente **vazia** — quando leu. A diferença
    não é cosmética: é ela que diz ao chamador se vale a pena cair no regex.
    Tratar lista vazia como falha faz um arquivo sem I/O nenhum ser reescaneado
    pelo motor antigo, que então inventa operações a partir de `open(` escrito
    dentro de comentário ou docstring. Aconteceu.
    """
    chamadas = IO_CHAMADAS.get(lang) or []
    if not chamadas and lang not in IO_INSTANCIACOES:
        return None

    # Dois índices: um para chamadas com receptor exigido, outro para os métodos
    # que valem sobre qualquer objeto (os de `pathlib.Path`).
    por_receptor = {}
    por_nome_livre = {}
    for entrada in chamadas:
        receptor, nome, tipo = entrada[0], entrada[1], entrada[2]
        indice = entrada[3] if len(entrada) > 3 else 0
        if receptor == RECEPTOR_QUALQUER:
            por_nome_livre.setdefault(nome, (tipo, indice))
        else:
            por_receptor[(receptor, nome)] = (tipo, indice)
    instanciacoes = IO_INSTANCIACOES.get(lang) or {}

    try:
        arvore = parser.parse(fonte)
    except Exception:
        return None

    linhas = fonte.split(b'\n')
    entradas = []
    vistos = set()
    pilha = [arvore.root_node]
    while pilha:
        no = pilha.pop()
        pilha.extend(no.children)

        tipo = None
        arg = None
        if no.type in _NOS_CHAMADA:
            receptor, nome = _receptor_e_nome(no, fonte)
            if nome is None:
                continue
            achado = por_receptor.get((receptor, nome))
            # Sem receptor exigido só vale para MÉTODO — `p.read_text()`. Uma
            # função solta com o mesmo nome (`read_text(x)`) não é I/O.
            if achado is None and receptor != SEM_RECEPTOR:
                achado = por_nome_livre.get(nome)
            if achado is None:
                continue
            tipo, indice = achado
            if tipo == 'open':
                tipo = 'write_file' if _e_escrita(no, fonte) else 'read_file'
            arg = _argumento(no, indice)
        elif no.type in _NOS_INSTANCIACAO and instanciacoes:
            classe = no.child_by_field_name('type')
            if classe is None:
                continue
            tipo = instanciacoes.get(_texto(classe, fonte).strip())
            if tipo is None:
                continue
            arg = _argumento(no)
        else:
            continue

        linha = no.start_point[0] + 1
        # Mesma regra do motor antigo: uma entrada por (linha, tipo). Sem ela,
        # `open(a) if x else open(b)` viraria duas leituras idênticas na tela.
        chave = (linha, tipo)
        if chave in vistos:
            continue
        vistos.add(chave)

        alvo = ''
        if arg is not None:
            alvo = _formatar_alvo(_texto(arg, fonte))

        texto_linha = ''
        if 0 <= no.start_point[0] < len(linhas):
            texto_linha = linhas[no.start_point[0]].decode('utf-8', errors='replace').strip()

        entradas.append({
            'type': tipo,
            'line': linha,
            'call': texto_linha[:120],
            'alvo': alvo,
        })

    entradas.sort(key=lambda e: (e['line'], e['type']))
    return entradas


def extrair_por_regex(linhas):
    """O motor antigo, preservado. `linhas` é a lista de linhas de texto.

    Só entra em cena onde não há gramática — ver o cabeçalho do módulo. O campo
    `alvo` aqui continua sendo a primeira coisa entre aspas da linha, com a
    imprecisão que isso tem; é melhor do que devolver nada para as três
    linguagens sem parser.
    """
    entradas = []
    vistos = set()
    for numero, linha in enumerate(linhas, 1):
        limpa = linha.strip()
        if not limpa or limpa.startswith('#') or limpa.startswith('//'):
            continue
        for padrao, tipo in PATTERNS:
            if not padrao.search(linha):
                continue
            if tipo == 'open':
                tipo = 'write_file' if WRITE_MODE.search(linha) else 'read_file'
            chave = (numero, tipo)
            if chave in vistos:
                continue
            vistos.add(chave)
            achado = _PATH_LITERAL.search(linha)
            entradas.append({
                'type': tipo,
                'line': numero,
                'call': linha.strip()[:120],
                'alvo': achado.group(1) if achado else '',
            })
            break  # uma entrada por linha
    return entradas
