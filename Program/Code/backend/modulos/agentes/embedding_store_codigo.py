"""Os vetores do corpo de cada função — a tabela `code_symbols`.

Metade de `embedding_store.py`, separada quando o arquivo passou das 500 linhas
que a AMF deste projeto trata como teto obrigatório. O corte não é arbitrário: as
duas metades respondem perguntas diferentes, para consumidores diferentes.

| Metade | Tabela | Quem consome |
|---|---|---|
| `embedding_store` | `embeddings` | a busca semântica da aba Documentação, e as réguas do Detector |
| **esta** | `code_symbols` | o agente **Duplicados** e o agente **Sincronia** |

⚠️ **`code_symbols` NÃO mudou na Etapa 3, e não deve mudar.** A tabela irmã foi
refeita do zero para caber o índice fatiado; esta ficou intacta de propósito —
mexer nela quebraria dois agentes que hoje funcionam.

A conexão, o esquema e os conversores de BLOB continuam em `embedding_store`: são
o encanamento das duas, e duplicá-los seria o começo de dois bancos.
"""

import os

from .embedding_store import _connect, _from_blob, _to_blob, db_path, _MATRIX_CACHE   # noqa: F401


# ── Embeddings do corpo de funções (Duplicados) ──────────────────────────────


def get_code_hash(project_name, file, chave):
    """O hash do corpo já gravado — ou None, que significa "reprocesse".

    ⚠️ Devolve None também quando a LINHA EXISTE mas não tem `hash_norm`. Sem
    isso a migração nunca aconteceria: as linhas gravadas na era do embedding
    têm `corpo_hash` válido e as colunas de impressão vazias, então o
    incremental as pularia para sempre — a rotina diria "2677 pulados", e o
    `get_duplicados` acharia zero pares em qualquer projeto antigo, para
    sempre, sem um erro sequer. Falhar assim é invisível; por isso a condição
    mora AQUI, e não no ponto de chamada.
    """
    conn = _connect(project_name)
    try:
        row = conn.execute(
            'SELECT corpo_hash, hash_norm FROM code_symbols WHERE file=? AND chave=?',
            (file, chave)).fetchone()
        if not row or not row[1]:
            return None
        return row[0]
    finally:
        conn.close()


def load_code_hashes(project_name):
    """{(file, chave): corpo_hash} de tudo que JÁ TEM impressão gravada.

    O irmão em lote de `get_code_hash`. A rotina consulta o hash de milhares de
    símbolos numa passada, e `get_code_hash` abre — e fecha — uma conexão
    SQLite em cada uma: numa base de 2 600 símbolos isso sozinho respondia por
    dez segundos de uma rodada que não tinha nada a fazer.

    ⚠️ O filtro `hash_norm IS NOT NULL` é o mesmo de `get_code_hash`, e pelo
    mesmo motivo: linha gravada na era do embedding tem `corpo_hash` válido e
    impressão nenhuma, e precisa ser reprocessada. Ausência da chave aqui
    significa "reprocesse".
    """
    conn = _connect(project_name)
    try:
        rows = conn.execute(
            'SELECT file, chave, corpo_hash FROM code_symbols '
            'WHERE hash_norm IS NOT NULL').fetchall()
    finally:
        conn.close()
    return {(file, chave): corpo_hash for file, chave, corpo_hash in rows}


def upsert_code(project_name, file, chave, nome, tipo, line, corpo_hash, excerpt,
                hash_norm, impressoes):
    """Grava um símbolo com as impressões do motor determinístico.

    ⚠️ A assinatura mudou em 22/08/2026: o último parâmetro era `vector`, o
    embedding do corpo. O Duplicados deixou de embedar. `dim` passa a guardar o
    TAMANHO do blob de impressões — continua sendo "o tamanho do que está
    gravado", que é para o que a coluna sempre serviu.
    """
    conn = _connect(project_name)
    try:
        conn.execute(
            """INSERT INTO code_symbols
                 (file, chave, nome, tipo, line, corpo_hash, excerpt, dim,
                  hash_norm, impressoes)
               VALUES (?,?,?,?,?,?,?,?,?,?)
               ON CONFLICT(file, chave) DO UPDATE SET
                 nome=excluded.nome, tipo=excluded.tipo, line=excluded.line,
                 corpo_hash=excluded.corpo_hash, excerpt=excluded.excerpt,
                 dim=excluded.dim, hash_norm=excluded.hash_norm,
                 impressoes=excluded.impressoes""",
            (file, chave, nome, tipo, int(line), corpo_hash, excerpt,
             len(impressoes or b''), hash_norm, impressoes))
        conn.commit()
    finally:
        conn.close()


def delete_missing_code(project_name, keep_pairs):
    """Remove símbolos (file, chave) que não existem mais. keep_pairs: set de tuplas."""
    keep = set(keep_pairs)
    conn = _connect(project_name)
    try:
        rows = conn.execute('SELECT file, chave FROM code_symbols').fetchall()
        sobrando = [(r[0], r[1]) for r in rows if (r[0], r[1]) not in keep]
        if sobrando:
            conn.executemany(
                'DELETE FROM code_symbols WHERE file=? AND chave=?', sobrando)
            conn.commit()
        return len(sobrando)
    finally:
        conn.close()


def load_code_impressoes(project_name):
    """Todos os símbolos de código, com hash normalizado e impressões digitais.

    Substitui o antigo `load_code_matrix`, que montava uma matriz N×D de
    embeddings para o produto matriz·matriz do cosseno. Não há mais matriz: a
    comparação virou índice invertido, em `duplicados_impressoes.comparar`.

    Devolve [{file, chave, nome, tipo, line, excerpt, hash_norm, impressoes}],
    com `impressoes` já desempacotado em `set`.
    """
    from .duplicados_impressoes import desempacotar

    path = db_path(project_name)
    key = (path, 'code')
    mtime = os.path.getmtime(path) if os.path.isfile(path) else 0
    cached = _MATRIX_CACHE.get(key)
    if cached and cached[0] == mtime:
        return cached[1]

    conn = _connect(project_name)
    try:
        rows = conn.execute(
            """SELECT file, chave, nome, tipo, line, excerpt, hash_norm, impressoes
               FROM code_symbols""").fetchall()
    finally:
        conn.close()

    simbolos = [{'file': file, 'chave': chave, 'nome': nome, 'tipo': tipo,
                 'line': line, 'excerpt': excerpt or '',
                 'hash_norm': hash_norm, 'impressoes': desempacotar(blob)}
                for file, chave, nome, tipo, line, excerpt, hash_norm, blob in rows]
    # O cache guarda UM valor agora, e não mais o par (matriz, meta). A chave
    # continua sendo o mtime do banco: rodada nova o invalida sozinha.
    _MATRIX_CACHE[key] = (mtime, simbolos)
    return simbolos


# ── Migração da árvore antiga de .json para o banco ──────────────────────────


# ── Sincronia: arquivo de código apagado, movido ou renomeado ────────────────
# Chamadas pelo agente Sincronia. Mover os símbolos de lugar é um UPDATE; apagar
# e reindexar seria uma chamada de embedding por símbolo, sem nenhum ganho — o
# conteúdo não mudou.

def _code_files_por_sufixo(conn, sufixo):
    """Valores de `code_symbols.file` que terminam no caminho dado.

    Casa por sufixo porque o `file` é montado como '{folder}/{relative}' pelo
    detector de Duplicados, e a raiz nem sempre é a mesma string que o Hashes
    usa. O sufixo é o que identifica o arquivo em ambos.
    """
    rows = conn.execute('SELECT DISTINCT file FROM code_symbols').fetchall()
    return [r[0] for r in rows if r[0] == sufixo or r[0].endswith('/' + sufixo)]


def delete_code_file(project_name, rel):
    """Apaga todos os símbolos de um arquivo de código."""
    conn = _connect(project_name)
    try:
        alvos = _code_files_por_sufixo(conn, rel)
        if not alvos:
            return 0
        conn.executemany('DELETE FROM code_symbols WHERE file=?',
                         [(a,) for a in alvos])
        conn.commit()
        return len(alvos)
    finally:
        conn.close()


def rename_code_file(project_name, de, para):
    """Aponta os símbolos de um arquivo de código para o caminho novo."""
    conn = _connect(project_name)
    try:
        alvos = _code_files_por_sufixo(conn, de)
        if not alvos:
            return 0
        for antigo in alvos:
            # Preserva o prefixo de raiz que já estava gravado; só o sufixo muda.
            prefixo = antigo[:len(antigo) - len(de)]
            novo = prefixo + para
            conn.execute('DELETE FROM code_symbols WHERE file=?', (novo,))
            conn.execute('UPDATE code_symbols SET file=? WHERE file=?', (novo, antigo))
        conn.commit()
        return len(alvos)
    finally:
        conn.close()
