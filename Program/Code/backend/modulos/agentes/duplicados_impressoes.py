"""O motor do Duplicados: normalizar, hashear e comparar — sem IA, sem embedding.

Antes o Duplicados **vetorizava o corpo de cada função**, uma por vez, com o
modelo ONNX (`_emb_embed_text`, lote de tamanho 1). Uma passada num projeto
médio levava minutos, e qualquer refatoração grande pagava tudo de novo. O que
ele achava, além disso, era "parecido em sentido" — e o que o usuário quer é
"isto é o mesmo código".

Aqui não há inferência nenhuma. São duas técnicas, e as **duas** são
necessárias:

1. **Hash da sequência normalizada** — troca todo identificador por `ID` e todo
   literal por `LIT`, joga fora comentário e espaço, e hasheia o que sobrou.
   Pega o clone **Tipo-1** (idêntico) e o **Tipo-2** (só renomeado), de forma
   exata e barata: dois corpos com o mesmo hash são o mesmo código.

2. **Impressões digitais por winnowing** (Rabin–Karp sobre a mesma sequência) —
   pega o **Tipo-3**, o copiado-e-depois-editado. ⚠️ É este o alvo declarado do
   usuário: sem o passo 2 a ferramenta só acha o que um `Ctrl+F` já acharia.

⚠️ **Nenhuma dependência nova.** Nada de jscpd, PMD-CPD ou Simian — foi pedido
explicitamente. O que se usa aqui já está no projeto: o tree-sitter das outras
rotinas e a biblioteca padrão.

── Por que os hashes são estáveis entre execuções ──────────────────────────
As impressões vão para o disco (`code_symbols`) e são comparadas com as de
outra rodada. Por isso o id de cada token sai de `zlib.crc32`, e não do `hash()`
do Python: `hash()` de string é aleatorizado por processo (PYTHONHASHSEED), e a
comparação de uma rodada com a anterior daria zero para tudo, em silêncio.
"""

import zlib
import hashlib
import re
import struct

from modulos.treesitter import EXT_LANG, make_parser

# ── Os parâmetros do winnowing ───────────────────────────────────────────────
# `K` é o tamanho do k-grama (em tokens) e `JANELA` o da janela de seleção. A
# garantia do algoritmo é: todo trecho repetido com pelo menos K + JANELA - 1
# tokens é detectado. Com 9 e 6, o piso é 14 tokens — abaixo disso é linha
# solta, não clone, e o `_MIN_CHARS_CORPO` do agente já teria cortado antes.
K_GRAMA = 9
JANELA = 6

# Teto de impressões guardadas por símbolo. Uma função de 200 linhas produz
# perto de 130; este número só existe para um arquivo gerado por máquina não
# guardar um megabyte sozinho.
MAX_IMPRESSOES = 2000

# ⚠️ PISO EM TOKEN, e ele é obrigatório — não é otimização.
#
# O agente já corta corpo com menos de 120 CARACTERES, e isso não basta: o
# fatiador delimita o corpo de um símbolo da linha dele até a linha anterior ao
# próximo, então o corpo de uma `class` é a assinatura mais a docstring. Passa
# folgado dos 120 caracteres e produz quatro tokens — `class ID : LIT` —, que é
# a MESMA sequência para toda classe do projeto. Sem este piso, a primeira
# rodada real casou `PortaoDeContexto` com todos os dezoito Mixins do backend,
# todos a 100%, e empurrou as duplicatas de verdade para fora do ranking.
#
# O valor não é arbitrário: é exatamente a garantia do winnowing — abaixo de
# K + JANELA - 1 tokens o algoritmo não promete detectar nada, então comparar
# ali é afirmar mais do que se sabe.
MIN_TOKENS = K_GRAMA + JANELA - 1

_BASE = 257
_MOD = (1 << 61) - 1

# O fallback para extensão sem gramática instalada: separa identificador,
# número, string e pontuação. É pior que a árvore — não sabe o que é comentário
# — mas é melhor que deixar a linguagem inteira de fora da varredura.
_RE_TOKENS = re.compile(r'"[^"\n]*"|\'[^\'\n]*\'|\d+\.?\d*|[A-Za-z_]\w*|[^\s\w]')

# Tipos de nó do tree-sitter que viram marcador genérico. A comparação é por
# SUBSTRING do nome do tipo porque cada gramática batiza o seu do seu jeito:
# `identifier`, `type_identifier`, `field_identifier`, `property_identifier`…
_TIPOS_IDENTIFICADOR = ('identifier', 'field_name', 'property_name')
_TIPOS_LITERAL = ('string', 'number', 'char', 'integer', 'float', 'literal',
                  'true', 'false', 'null', 'none')
_TIPOS_COMENTARIO = ('comment', 'line_comment', 'block_comment')

# ⚠️ Linguagens DECLARATIVAS não são normalizadas, e isto não é detalhe: é o
# que separa achado de ruído.
#
# A normalização troca identificador por `ID` porque, em linguagem de
# programação, renomear uma variável não muda o que o código FAZ — e é por isso
# que o clone renomeado (Tipo-2) deve casar. Em CSS o identificador É o
# significado: `display` e `color` são dois comportamentos diferentes, não dois
# nomes para o mesmo. Normalizadas, TODAS as regras CSS com o mesmo número de
# propriedades viram a mesma sequência de tokens — a primeira rodada real
# devolveu vinte pares a 100%, todos do tipo `.btn-back:hover ≈ .btn-icon:hover`,
# e nenhuma função duplicada de verdade sobreviveu ao ranking.
#
# Aqui, então, a comparação é literal: casa o bloco realmente igual (Tipo-1),
# que é a única noção de duplicata que faz sentido numa linguagem sem variável.
_LINGUAGENS_DECLARATIVAS = ('CSS', 'HTML')


def _normalizar_token(tipo, texto, declarativa=False):
    """O token como ele entra na comparação: `ID`, `LIT`, ou ele mesmo.

    Devolve `None` para o que não deve entrar — comentário. É o que faz um
    trecho copiado e comentado de outro jeito continuar sendo reconhecido.

    `declarativa` desliga a generalização — ver `_LINGUAGENS_DECLARATIVAS`.
    O comentário continua saindo fora nos dois casos.
    """
    baixo = tipo.lower()
    if any(c in baixo for c in _TIPOS_COMENTARIO):
        return None
    if declarativa:
        return texto
    if any(c in baixo for c in _TIPOS_IDENTIFICADOR):
        return 'ID'
    if any(c in baixo for c in _TIPOS_LITERAL):
        return 'LIT'
    return texto


def _tokens_por_linha_treesitter(fonte_bytes, parser, declarativa=False):
    """[(linha_1based, token_normalizado)] varrendo as FOLHAS da árvore.

    Só folha: nó interno não tem texto próprio, e contá-lo duplicaria tudo que
    está dentro dele.
    """
    try:
        arvore = parser.parse(fonte_bytes)
    except Exception:
        return None
    saida = []
    pilha = [arvore.root_node]
    while pilha:
        no = pilha.pop()
        baixo = no.type.lower()
        # String e comentário contam como UM token mesmo tendo filhos: uma
        # f-string carrega a expressão interpolada como nó filho, e descer nela
        # faria `f"{a}"` diferir de `f"{b}"` — exatamente o que a normalização
        # existe para impedir.
        folha_forcada = any(c in baixo for c in ('string', 'comment'))
        if no.child_count and not folha_forcada:
            # Empilha ao contrário para a ordem de leitura sair certa — a
            # sequência de tokens É a informação, e embaralhá-la inutilizaria
            # tanto o hash quanto os k-gramas.
            pilha.extend(reversed(no.children))
            continue
        try:
            texto = no.text.decode('utf-8', 'replace') if no.text else no.type
        except Exception:
            texto = no.type
        norm = _normalizar_token(no.type, texto, declarativa)
        if norm:
            saida.append((no.start_point[0] + 1, norm))
    return saida


def _tokens_por_linha_regex(linhas, declarativa=False):
    """O mesmo, sem gramática. Usado quando o binding da linguagem não está lá."""
    saida = []
    for numero, linha in enumerate(linhas, start=1):
        for bruto in _RE_TOKENS.findall(linha):
            if declarativa:
                saida.append((numero, bruto))
            elif bruto[:1] in ('"', "'") or bruto[:1].isdigit():
                saida.append((numero, 'LIT'))
            elif bruto[:1].isalpha() or bruto[:1] == '_':
                saida.append((numero, 'ID'))
            else:
                saida.append((numero, bruto))
    return saida


def tokens_do_arquivo(caminho, linhas, extensao):
    """[(linha, token normalizado)] do arquivo inteiro, UMA parse por arquivo.

    O arquivo é lido uma vez e fatiado depois, por símbolo. Fazer o contrário —
    uma parse por função — era o custo que tornava a rotina antiga inviável.
    """
    lang = EXT_LANG.get((extensao or '').lower())
    declarativa = lang in _LINGUAGENS_DECLARATIVAS
    if lang:
        parser = make_parser(lang)
        if parser:
            fonte = ('\n'.join(linhas)).encode('utf-8', 'replace')
            tokens = _tokens_por_linha_treesitter(fonte, parser, declarativa)
            if tokens is not None:
                return tokens
    return _tokens_por_linha_regex(linhas, declarativa)


def _fatiar(tokens, inicio, fim):
    """Só os tokens do corpo do símbolo, pela faixa de linhas (1-based, inclusiva)."""
    return [t for (linha, t) in tokens if inicio <= linha <= fim]


def _hashes_dos_kgramas(sequencia):
    """Rabin–Karp: um hash por k-grama, em uma passada.

    Rolling de verdade, e não um hash por janela recalculado do zero: numa
    função de 800 tokens a diferença é 800 operações contra 7 200.
    """
    n = len(sequencia)
    if n < K_GRAMA:
        return []
    ids = [zlib.crc32(t.encode('utf-8')) for t in sequencia]
    potencia = pow(_BASE, K_GRAMA - 1, _MOD)
    h = 0
    for i in range(K_GRAMA):
        h = (h * _BASE + ids[i]) % _MOD
    saida = [h]
    for i in range(K_GRAMA, n):
        h = ((h - ids[i - K_GRAMA] * potencia) * _BASE + ids[i]) % _MOD
        saida.append(h)
    return saida


def _winnowing(hashes):
    """Escolhe o menor hash de cada janela — o filtro que dá a garantia.

    Empate resolve pelo mais à direita, que é o que a implementação canônica
    faz: em janelas sobrepostas isso reaproveita a mesma escolha e reduz o
    tamanho do conjunto sem perder cobertura.
    """
    n = len(hashes)
    if n == 0:
        return set()
    if n < JANELA:
        return {min(hashes)}
    escolhidos = set()
    ultimo_indice = -1
    for i in range(n - JANELA + 1):
        janela = hashes[i:i + JANELA]
        menor = min(janela)
        # `len - 1 - reverse_index` = a ocorrência mais à direita do mínimo.
        indice = i + len(janela) - 1 - janela[::-1].index(menor)
        if indice != ultimo_indice:
            escolhidos.add(menor)
            ultimo_indice = indice
    return escolhidos


def impressao_do_corpo(tokens, inicio, fim):
    """(hash_normalizado, conjunto de impressões) do corpo de um símbolo.

    `hash_normalizado` é `None` quando o corpo NÃO É COMPARÁVEL — ou porque a
    gramática não leu o arquivo (nenhum token), ou porque o corpo é curto
    demais para o algoritmo prometer alguma coisa (ver `MIN_TOKENS`). Quem
    chama pula o símbolo, em vez de casar todos os incomparáveis entre si.
    """
    sequencia = _fatiar(tokens, inicio, fim)
    if len(sequencia) < MIN_TOKENS:
        return None, set()
    bruto = ' '.join(sequencia).encode('utf-8')
    hash_norm = hashlib.md5(bruto).hexdigest()
    impressoes = _winnowing(_hashes_dos_kgramas(sequencia))
    if len(impressoes) > MAX_IMPRESSOES:
        impressoes = set(sorted(impressoes)[:MAX_IMPRESSOES])
    return hash_norm, impressoes


# ── Ida e volta para o disco ─────────────────────────────────────────────────
# As impressões são inteiros de 61 bits; vão como uint64 little-endian, em
# ordem crescente. Ordenar não é enfeite: é o que deixa a interseção usar
# `set` sem depender da ordem em que o winnowing as encontrou.

def empacotar(impressoes):
    ordenadas = sorted(impressoes)
    return struct.pack('<%dQ' % len(ordenadas), *ordenadas)


def desempacotar(blob):
    if not blob:
        return set()
    quantas = len(blob) // 8
    if quantas == 0:
        return set()
    return set(struct.unpack('<%dQ' % quantas, blob[:quantas * 8]))


# ── A comparação ─────────────────────────────────────────────────────────────

def semelhanca(a, b):
    """Coeficiente de sobreposição: quanto do MENOR dos dois está no maior.

    E não Jaccard, de propósito. A pergunta do usuário é "este código já existe
    em outro lugar?", e uma função de 10 linhas copiada inteira dentro de uma de
    200 é um "sim" — Jaccard responderia 0.05 e a esconderia. O limiar da tela
    (0.85) continua significando o mesmo de sempre: "quase tudo em comum".
    """
    if not a or not b:
        return 0.0
    comuns = len(a & b)
    if not comuns:
        return 0.0
    return comuns / float(min(len(a), len(b)))


def comparar(simbolos, limiar=0.85, max_pares=200):
    """Os pares acima do limiar, do mais parecido para o menos.

    `simbolos`: [{'file','chave','nome','tipo','line','excerpt','hash_norm',
    'impressoes'}].

    ⚠️ Isto **substitui** o antigo `load_code_matrix` + produto matriz·matriz.
    Aquele comparava todo mundo com todo mundo — 6 000 símbolos são 18 milhões
    de pares, e era daí que vinha o teto `_MAX_SIMBOLOS`. Aqui a comparação é
    feita por um ÍNDICE INVERTIDO: só entram na conta os pares que compartilham
    pelo menos uma impressão, que numa base real é uma fração ínfima do total.
    """
    # 1. Os idênticos/renomeados saem direto do hash, sem comparar nada.
    por_hash = {}
    for i, s in enumerate(simbolos):
        if s.get('hash_norm'):
            por_hash.setdefault(s['hash_norm'], []).append(i)

    pares = {}
    for indices in por_hash.values():
        for pos, a in enumerate(indices):
            for b in indices[pos + 1:]:
                pares[(a, b)] = 1.0

    # 2. Os editados: índice invertido impressão → quem a tem.
    por_impressao = {}
    for i, s in enumerate(simbolos):
        for imp in s.get('impressoes') or ():
            por_impressao.setdefault(imp, []).append(i)

    candidatos = set()
    for indices in por_impressao.values():
        # Impressão que aparece em meio projeto é ruído estrutural (o cabeçalho
        # que toda função repete), não sinal — e ainda por cima geraria n²/2
        # pares sozinha. Vinte é folgado para clone e apertado para boilerplate.
        if len(indices) > 20:
            continue
        for pos, a in enumerate(indices):
            for b in indices[pos + 1:]:
                if (a, b) not in pares:
                    candidatos.add((a, b))

    for (a, b) in candidatos:
        score = semelhanca(simbolos[a].get('impressoes'), simbolos[b].get('impressoes'))
        if score >= limiar:
            pares[(a, b)] = score

    ordenados = sorted(pares.items(), key=lambda kv: -kv[1])[:max_pares]

    def limpo(s):
        return {chave: s.get(chave) for chave in
                ('file', 'chave', 'nome', 'tipo', 'line', 'excerpt')}

    return [{'score': round(float(score), 4),
             'a': limpo(simbolos[a]),
             'b': limpo(simbolos[b])}
            for (a, b), score in ordenados]
