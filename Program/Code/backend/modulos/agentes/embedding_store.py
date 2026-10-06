"""Armazenamento dos embeddings em um banco SQLite único por projeto.

Antes cada documento virava um `.json` solto em `agentes/embedding/{tipo}/…`, e
toda busca fazia `os.walk` lendo todos os arquivos e comparando um a um. Aqui
tudo vai para um banco só (`agentes/embedding/index.db`), os vetores ficam como
BLOB `float32`, e a busca carrega uma matriz na memória (com cache) para um
único produto matriz·query.

Sem dependência nova: `sqlite3` é da biblioteca padrão; `numpy` já é usado.

Duas tabelas:
  - `embeddings`   — vetores da Documentação Técnica e do Resumo de Pastas
                     (busca da aba Documentação).
  - `code_symbols` — vetores do corpo de cada função (detector de Duplicados).

⚠️ **`embeddings` é FATIADA desde 2026-08-25** (Etapa 3): a chave primária passou
de `(tipo, source_file)` para `(tipo, source_file, pedaco)` — de "um arquivo, uma
linha" para "um arquivo, N linhas, uma por fronteira natural". É **um índice só**,
servindo busca e comparação; um segundo índice para a comparação seria dois donos
do mesmo dado.

⚠️ **`code_symbols` NÃO mudou e não deve mudar.** Ela é do Duplicados e da
Sincronia; mexer nela quebraria dois agentes que hoje funcionam.
"""

import os
import sqlite3
import numpy as np

from ..caminhos import obter_pasta_da_rotina

# Cache de matrizes em memória: {(db_path, chave): (mtime, matriz, meta)}
_MATRIX_CACHE = {}


def db_path(project_name):
    """Caminho do banco de embeddings do projeto (cria a pasta se faltar)."""
    d = obter_pasta_da_rotina(project_name, 'embedding')
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, 'index.db')


def _connect(project_name):
    conn = sqlite3.connect(db_path(project_name), timeout=15)
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA busy_timeout=15000')
    _garantir_esquema_fatiado(conn)
    conn.execute('''CREATE TABLE IF NOT EXISTS embeddings (
        tipo        TEXT NOT NULL,
        source_file TEXT NOT NULL,
        pedaco      TEXT NOT NULL,
        md_hash     TEXT,
        hash_pedaco TEXT,
        vector_ref  BLOB,
        linhas      INTEGER,
        excerpt     TEXT,
        dim         INTEGER,
        vector      BLOB,
        PRIMARY KEY (tipo, source_file, pedaco)
    )''')
    # ⚠️ DUAS COLUNAS ALÉM DO ESQUEMA DO BRIEFING, e as duas são derivadas:
    #
    #   · `hash_pedaco` — o md5 do CONTEÚDO do pedaço. `md_hash` continua sendo
    #     o do arquivo inteiro (é o que `get_hash` e o portão por arquivo leem),
    #     então o hash por pedaço precisava de coluna própria. Sem ele não há
    #     "só embede o pedaço que mudou", que é metade da economia da etapa.
    #   · `linhas` — o peso da média ponderada da pasta. Dá para recalcular
    #     refatiando cada `.md` a cada consulta, mas isso é trabalho repetido
    #     sobre um número que não muda entre passadas.
    #
    # O índice é o que torna o BLOCO GÊMEO barato: pedaço já embedado em
    # qualquer lugar do projeto não é embedado de novo, e a busca por conteúdo
    # tem que ser uma consulta indexada, não uma varredura da tabela.
    conn.execute('CREATE INDEX IF NOT EXISTS idx_emb_hash_pedaco '
                 'ON embeddings(hash_pedaco)')
    conn.execute('''CREATE TABLE IF NOT EXISTS code_symbols (
        file        TEXT NOT NULL,
        chave       TEXT NOT NULL,
        nome        TEXT,
        tipo        TEXT,
        line        INTEGER,
        corpo_hash  TEXT,
        excerpt     TEXT,
        dim         INTEGER,
        vector      BLOB,
        PRIMARY KEY (file, chave)
    )''')
    _garantir_colunas_de_impressao(conn)
    return conn


def _garantir_esquema_fatiado(conn):
    """Recria `embeddings` quando ela ainda é a de "um arquivo, uma linha".

    ⚠️ **RECRIAR, e não migrar, é decisão da obra — e o motivo é que migrar não
    dá.** Trocar a chave primária não se faz com `ALTER TABLE`, e
    `CREATE TABLE IF NOT EXISTS` não migra esquema nenhum: num banco que já
    existe ele simplesmente não faz nada, e o `upsert` novo cairia num
    `ON CONFLICT` sobre uma chave que não existe.

    Sem isto, o pior dos mundos: cada pedaço sobrescreveria o anterior pela
    chave velha, sobraria **um pedaço por arquivo** (o último), e nada daria
    erro. Pareceria pronto e estaria errado.

    O custo é reindexar do zero — medido em ~168 ms por pedaço, uns 5 minutos
    num projeto de 500 arquivos, **uma vez só**. `code_symbols` fica intacta, e é
    por isso que Duplicados e Sincronia não sentem nada.
    """
    try:
        colunas = {r[1] for r in conn.execute('PRAGMA table_info(embeddings)')}
    except Exception:
        return
    if not colunas or {'pedaco', 'hash_pedaco'} <= colunas:
        return          # tabela nova, ou já fatiada e completa
    try:
        conn.execute('DROP TABLE embeddings')
        conn.commit()
    except Exception:
        pass


# As duas colunas que o motor novo do Duplicados usa. Ficam FORA do
# `CREATE TABLE` acima de propósito: `IF NOT EXISTS` não migra esquema — num
# banco que já existe ele não faz nada, e as colunas novas nunca apareceriam.
#
# ⚠️ A coluna `vector` continua onde está, intocada. As impressões são inteiros
# de 64 bits e ela guarda float32; reaproveitá-la truncaria cada impressão em
# silêncio. A tabela inteira também fica: `rename_code_file` e `delete_code_file`
# são do agente SINCRONIA, e apagá-la quebraria um agente que hoje funciona.
_COLUNAS_DE_IMPRESSAO = (
    ('hash_norm', 'TEXT'),      # o corpo normalizado — clone Tipo-1 e Tipo-2
    ('impressoes', 'BLOB'),     # as digitais do winnowing — clone Tipo-3
)


def _garantir_colunas_de_impressao(conn):
    try:
        existentes = {r[1] for r in conn.execute('PRAGMA table_info(code_symbols)')}
    except Exception:
        return
    for nome, tipo in _COLUNAS_DE_IMPRESSAO:
        if nome not in existentes:
            try:
                conn.execute('ALTER TABLE code_symbols ADD COLUMN %s %s' % (nome, tipo))
            except Exception:
                pass


def _to_blob(vector):
    return np.asarray(vector, dtype=np.float32).tobytes()


def _from_blob(blob):
    return np.frombuffer(blob, dtype=np.float32)


# ── Embeddings de documentos (.md) ───────────────────────────────────────────

def get_hash(project_name, tipo, source_file):
    """md_hash guardado para o arquivo, ou None se ele não estiver no índice.

    Com o índice fatiado são N linhas por arquivo, e **todas carregam o mesmo
    `md_hash`** — o do `.md` inteiro. Qualquer uma responde, e é por isso que o
    portão de arquivo (`preview_embedding_agent`) continua funcionando sem saber
    que pedaços existem.
    """
    conn = _connect(project_name)
    try:
        row = conn.execute(
            'SELECT md_hash FROM embeddings WHERE tipo=? AND source_file=? LIMIT 1',
            (tipo, source_file)).fetchone()
        return row[0] if row else None
    finally:
        conn.close()


def load_pedacos(project_name, tipo, source_file):
    """`{pedaco: {hash_pedaco, vector, vector_ref, linhas}}` de um arquivo.

    É o que permite embedar **só o pedaço que mudou**: inserir uma função no
    meio de um arquivo passa a custar um embedding, não o arquivo inteiro.
    """
    conn = _connect(project_name)
    try:
        rows = conn.execute(
            'SELECT pedaco, md_hash, vector, vector_ref, linhas, hash_pedaco '
            'FROM embeddings WHERE tipo=? AND source_file=?',
            (tipo, source_file)).fetchall()
    finally:
        conn.close()
    return {r[0]: {'md_hash': r[1],
                   'vector': _from_blob(r[2]) if r[2] else None,
                   'vector_ref': _from_blob(r[3]) if r[3] else None,
                   'linhas': r[4] or 1,
                   'hash_pedaco': r[5]} for r in rows}


def atualizar_md_hash(project_name, tipo, source_file, md_hash):
    """Carimba o novo hash do ARQUIVO nos pedaços que não mudaram.

    ⚠️ Sem isto o arquivo seria reprocessado para sempre. O portão por arquivo
    (`get_hash`) compara o md5 do `.md` inteiro; um pedaço que não mudou não
    passa pelo `upsert`, e ficaria com o hash antigo — na passada seguinte o
    portão diria "mudou" de novo, e de novo, sem nunca convergir.
    """
    conn = _connect(project_name)
    try:
        conn.execute('UPDATE embeddings SET md_hash=? WHERE tipo=? AND source_file=?',
                     (md_hash, tipo, source_file))
        conn.commit()
    finally:
        conn.close()


def vetor_por_conteudo(project_name, hash_pedaco):
    """O vetor de um pedaço já embedado EM QUALQUER LUGAR do projeto — o
    **bloco gêmeo**.

    A chave do cache é o **hash do conteúdo**, e não `(arquivo, pedaço)`: copiar
    um bloco de código idêntico para outro arquivo deixa de custar um embedding.
    Sem apontador, sem arquivo novo, sem consumidor para adaptar.
    """
    if not hash_pedaco:
        return None
    conn = _connect(project_name)
    try:
        row = conn.execute(
            'SELECT vector FROM embeddings WHERE hash_pedaco=? AND vector IS NOT NULL '
            'LIMIT 1', (hash_pedaco,)).fetchone()
    finally:
        conn.close()
    return _from_blob(row[0]) if row and row[0] else None


def load_arquivos(project_name, tipo, prefixo=None):
    """Os `source_file` distintos de um tipo, opcionalmente sob um prefixo.

    O prefixo é o caminho da pasta, e serve à régua do Resumo de Pastas: ela
    pergunta "quanto esta PASTA mudou", e a pasta é um prefixo de caminho.
    """
    conn = _connect(project_name)
    try:
        if prefixo:
            rows = conn.execute(
                'SELECT DISTINCT source_file FROM embeddings WHERE tipo=? '
                'AND source_file LIKE ?', (tipo, prefixo + '%')).fetchall()
        else:
            rows = conn.execute(
                'SELECT DISTINCT source_file FROM embeddings WHERE tipo=?',
                (tipo,)).fetchall()
    finally:
        conn.close()
    return [r[0] for r in rows]


def marcar_referencia(project_name, tipo, source_files):
    """Move a BASE DE COMPARAÇÃO: `vector_ref = vector` nos arquivos dados.

    ⚠️ **Só quem REGEROU a saída chama isto**, e é a regra que faz a conta
    fechar. São duas bases por pedaço, e elas se movem em momentos diferentes:

      · `md_hash`    — "este `.md` foi regerado?" — anda toda vez que a Doc.
                       Técnica regenera;
      · `vector_ref` — "quanto mudou desde o último resumo da pasta?" — anda
                       **só** quando o Resumo de Pastas regenera aquela pasta.

    Se as duas andassem juntas, **vinte mudanças de 1% nunca somariam 20%**:
    cada uma seria medida contra a anterior, sempre daria "quase igual", e a
    pasta envelheceria em silêncio, uma fatia por vez.
    """
    if not source_files:
        return 0
    conn = _connect(project_name)
    try:
        cur = conn.executemany(
            'UPDATE embeddings SET vector_ref=vector WHERE tipo=? AND source_file=?',
            [(tipo, f) for f in source_files])
        conn.commit()
        return cur.rowcount
    finally:
        conn.close()


def delete_pedacos_sobrando(project_name, tipo, source_file, keep_pedacos):
    """Tira do índice os pedaços que o arquivo não tem mais.

    Sem isto, apagar uma seção de um `.md` deixaria o vetor dela no banco para
    sempre — e ela continuaria aparecendo na busca, apontando para um texto que
    não existe mais.
    """
    keep = set(keep_pedacos)
    conn = _connect(project_name)
    try:
        rows = conn.execute(
            'SELECT pedaco FROM embeddings WHERE tipo=? AND source_file=?',
            (tipo, source_file)).fetchall()
        sobrando = [(tipo, source_file, r[0]) for r in rows if r[0] not in keep]
        if sobrando:
            conn.executemany(
                'DELETE FROM embeddings WHERE tipo=? AND source_file=? AND pedaco=?',
                sobrando)
            conn.commit()
        return len(sobrando)
    finally:
        conn.close()


def upsert(project_name, tipo, source_file, pedaco, md_hash, excerpt, vector,
           linhas=1, mover_referencia=False, hash_pedaco=None):
    """Insere/atualiza o vetor de UM PEDAÇO de um documento.

    ⚠️ `vector_ref` **não é tocado por padrão**, e é o ponto todo: quem o move é
    `marcar_referencia`, chamado só por quem regerou a saída. Um `upsert` que o
    atualizasse junto zeraria a diferença acumulada a cada reindexação, e a
    pasta nunca mais seria regerada.

    `mover_referencia=True` existe para o pedaço que **nasce agora**: sem
    referência anterior não há diferença a acumular, e deixá-lo com `NULL` faria
    a régua tratá-lo como "sem par" — similaridade zero — em toda passada, para
    sempre.
    """
    conn = _connect(project_name)
    try:
        vec = np.asarray(vector, dtype=np.float32)
        blob = vec.tobytes()
        ref_sql = 'vector_ref=excluded.vector' if mover_referencia else ''
        conn.execute(
            '''INSERT INTO embeddings
                 (tipo, source_file, pedaco, md_hash, hash_pedaco, vector_ref,
                  linhas, excerpt, dim, vector)
               VALUES (?,?,?,?,?,?,?,?,?,?)
               ON CONFLICT(tipo, source_file, pedaco) DO UPDATE SET
                 md_hash=excluded.md_hash, hash_pedaco=excluded.hash_pedaco,
                 excerpt=excluded.excerpt, linhas=excluded.linhas,
                 dim=excluded.dim, vector=excluded.vector%s''' % (
                     ', ' + ref_sql if ref_sql else ''),
            (tipo, source_file, pedaco, md_hash, hash_pedaco,
             blob if mover_referencia else None, int(linhas or 1),
             excerpt, int(vec.shape[0]), blob))
        conn.commit()
    finally:
        conn.close()


def delete_missing(project_name, tipo, keep_source_files):
    """Remove embeddings de um tipo cujo source_file não está mais presente."""
    keep = set(keep_source_files)
    conn = _connect(project_name)
    try:
        rows = conn.execute(
            'SELECT source_file FROM embeddings WHERE tipo=?', (tipo,)).fetchall()
        sobrando = [(tipo, r[0]) for r in rows if r[0] not in keep]
        if sobrando:
            conn.executemany(
                'DELETE FROM embeddings WHERE tipo=? AND source_file=?', sobrando)
            conn.commit()
        return len(sobrando)
    finally:
        conn.close()


# ── Sincronia: acompanhar arquivo apagado, movido ou renomeado ───────────────
# Usadas pelo agente Sincronia (agentes/sincronia/sincronia.py). Mover um vetor
# de lugar é uma linha de UPDATE; apagar e reindexar seria uma chamada de
# embedding por símbolo, sem nenhum ganho — o conteúdo não mudou.

def delete_source(project_name, source_file):
    """Apaga os embeddings de um documento, em todos os tipos."""
    conn = _connect(project_name)
    try:
        cur = conn.execute('DELETE FROM embeddings WHERE source_file=?', (source_file,))
        conn.commit()
        return cur.rowcount
    finally:
        conn.close()


def rename_source(project_name, de, para):
    """Aponta os embeddings de um documento para o caminho novo."""
    conn = _connect(project_name)
    try:
        # O destino pode já existir (arquivo sobrescrito): apaga antes, senão o
        # UPDATE viola a chave (tipo, source_file).
        conn.execute('DELETE FROM embeddings WHERE source_file=?', (para,))
        cur = conn.execute('UPDATE embeddings SET source_file=? WHERE source_file=?',
                           (para, de))
        conn.commit()
        return cur.rowcount
    finally:
        conn.close()


# ── As três de `code_symbols` que moravam aqui ───────────────────────────────
# `_code_files_por_sufixo`, `delete_code_file` e `rename_code_file` foram para
# `embedding_store_codigo.py` em 2026-08-26.
#
# ⚠️ ELAS FICARAM PARA TRÁS NO PRIMEIRO CORTE, e o erro foi invisível até alguém
# apagar um arquivo: o corte foi feito no comentário "Embeddings do corpo de
# funções", e estas três estavam ACIMA dele — no meio das funções da Sincronia,
# porque é a Sincronia quem as chama. A Sincronia foi religada para o módulo
# novo e elas não estavam lá, então `delete_code_file` estourou
# `AttributeError` na primeira remoção de arquivo.
#
# A lição, e é por isso que esta nota fica: **o que decide onde uma função mora
# é a TABELA que ela toca, não a vizinhança em que ela estava escrita.**


def load_matrix(project_name, tipo):
    """Matriz (N×D, float32 normalizada) + metadados de um tipo.

    Metadados: lista de dicts {source_file, pedaco, excerpt}. Cache invalidado
    pela mtime do arquivo do banco.

    ⚠️ **São N linhas POR ARQUIVO desde o índice fatiado.** Quem busca tem que
    deduplicar por `source_file` DEPOIS de pontuar, ficando com o melhor pedaço
    — ver `search_embeddings` em `documentacao.py`. O cache aguenta: ~3 KB por
    vetor, 500 arquivos × 4 pedaços ≈ 6 MB.
    """
    path = db_path(project_name)
    key = (path, f'emb:{tipo}')
    mtime = os.path.getmtime(path) if os.path.isfile(path) else 0
    cached = _MATRIX_CACHE.get(key)
    if cached and cached[0] == mtime:
        return cached[1], cached[2]

    conn = _connect(project_name)
    try:
        rows = conn.execute(
            'SELECT source_file, excerpt, vector, pedaco FROM embeddings WHERE tipo=?',
            (tipo,)).fetchall()
    finally:
        conn.close()

    if not rows:
        empty = (np.zeros((0, 0), dtype=np.float32), [])
        _MATRIX_CACHE[key] = (mtime, empty[0], empty[1])
        return empty

    vecs, meta = [], []
    for source_file, excerpt, blob, pedaco in rows:
        v = _from_blob(blob)
        n = np.linalg.norm(v)
        vecs.append(v / n if n > 1e-9 else v)
        # ⚠️ `pedaco` VAI NO META, e quem busca precisa dele: agora são N linhas
        # por arquivo, e sem deduplicar por `source_file` um `.md` de quatro
        # pedaços viraria quatro resultados na tela.
        meta.append({'source_file': source_file, 'excerpt': excerpt or '',
                     'pedaco': pedaco})
    matriz = np.vstack(vecs).astype(np.float32)
    _MATRIX_CACHE[key] = (mtime, matriz, meta)
    return matriz, meta


# ── As outras duas metades moram ao lado ─────────────────────────────────────
# Este arquivo passou das 500 linhas do teto da AMF em 2026-08-25, com o índice
# fatiado da Etapa 3. Saíram daqui, cada uma respondendo uma pergunta diferente:
#
#   · `embedding_store_codigo.py`   — a tabela `code_symbols`, do Duplicados e
#                                     da Sincronia. ⚠️ Ela NÃO mudou na Etapa 3.
#   · `embedding_store_migracao.py` — a ponte com a era dos `.json` soltos.
#
# O esquema das duas tabelas continua em `_connect`, acima: é o encanamento
# comum, e duplicá-lo seria o começo de dois bancos.
# `code_symbols` — os vetores do corpo de cada função, do Duplicados e da
# Sincronia — saiu daqui em 2026-08-25, quando este arquivo passou das 500 linhas
# do teto da AMF. Ver `embedding_store_codigo.py`.
#
# O esquema das DUAS tabelas continua em `_connect`, acima: é o encanamento
# comum, e duplicá-lo seria o começo de dois bancos.
