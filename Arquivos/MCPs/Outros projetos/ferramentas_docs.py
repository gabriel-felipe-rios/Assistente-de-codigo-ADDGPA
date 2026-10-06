"""Os handlers que respondem a partir do que uma ROTINA escreveu, e a análise.

Documentação técnica, resumo de pastas, pipeline, busca por descrição, glossário,
duplicados, arquivos grandes e o mapa de I/O.

⚠️ ARTEFATO NÃO GERADO DIZ QUAL ROTINA O GERA (`leitura.falta`). É a diferença
entre o assistente externo desistir da linha de investigação e o usuário receber
"peça para rodar a rotina X na aba Automação daquele projeto".

── Duas ferramentas respondem MENOS aqui que no MCP Assistente, e está dito ──

**`busca_semantica` faz busca LITERAL.** A busca por embedding exige gerar o
vetor da pergunta, e isso passa pelo modelo local que o programa hospeda. Este
servidor não invoca o programa (é a decisão de ser autocontido), então ele cai no
mesmo caminho de reserva que o MCP Assistente já usa quando o embedding não
responde. A descrição da ferramenta diz isso ao modelo, para ele não concluir que
"nada encontrado" significa "não existe".

**`io` extrai por expressão regular.** O MCP Assistente usa gramática
(tree-sitter) e acerta qual nó é o primeiro argumento; o regex olha a linha e
pega a primeira coisa entre aspas. Em `open(f, 'r', encoding='utf-8')` isso
captura `'r'`. Por isso o alvo sai marcado como aproximado — e a chamada, que é
a informação boa, vem sempre.

⚠️ O que NENHUM dos dois motores faz é descobrir o caminho REAL no disco: ele não
está no código, é montado em tempo de execução. Não tente "melhorar o parser"
para conseguir — a informação não está no texto do programa.
"""

import os
import re
import sqlite3
import struct

import leitura as L


# ═════════════════════════════ Documentação (passou por um modelo) ══

def tool_doc_tecnica(projeto, args, _liberados):
    from ferramentas_codigo import casar_md
    return casar_md(projeto, 'documentacao-tecnica', args.get('arquivo'),
                    'A documentação técnica')


def tool_resumo_pastas(projeto, args, _liberados):
    """O resumo de pastas: uma parte por pasta, lidas da árvore de saída.

    ⚠️ A busca é RECURSIVA, e precisa ser: a saída espelha a árvore do código,
    então a raiz da pasta da rotina tem só a pasta do projeto e uns `.json`
    internos — nenhum `.md`. Um `listdir` da raiz devolveria vazio e a
    ferramenta responderia "não gerado" com as quarenta partes no disco.
    """
    arquivos = L.arquivos_da_rotina(projeto, 'resumo-pastas')
    if not arquivos:
        raise L.falta('resumo-pastas', projeto)
    partes = []
    for rel in sorted(arquivos):
        corpo = L.ler_texto(L.pasta_da_rotina(projeto, 'resumo-pastas',
                                              *rel.split('/'))).strip()
        partes.append((rel[:-3], corpo))
    return L.servir_partes('resumo de pastas de "%s"' % projeto, partes,
                           args.get('parte'))


def tool_pipeline(projeto, args, _liberados):
    conteudo = L.artefato(projeto, 'pipeline', 'pipeline.md')
    partes = L.dividir_por_cabecalho(conteudo)
    return L.servir_partes('pipeline de "%s"' % projeto, partes,
                           args.get('parte'), args.get('filtro'))


# As fontes em que a busca por descrição procura. Os três ids são os mesmos do
# programa — eles viajam como parâmetro e não podem ser renomeados aqui.
FONTES_DA_BUSCA = ('documentacao-tecnica', 'espelho', 'resumo-pastas')


def tool_busca_semantica(projeto, args, _liberados):
    descricao = (args.get('descricao') or args.get('query') or '').strip()
    if not descricao:
        return 'Informe o parâmetro "descricao".'
    tipo = (args.get('tipo') or 'documentacao-tecnica').strip()
    if tipo not in FONTES_DA_BUSCA:
        return ('Fonte de busca desconhecida: "%s". As aceitas são: %s.'
                % (tipo, ', '.join(FONTES_DA_BUSCA)))
    arquivos = L.arquivos_da_rotina(projeto, tipo)
    if not arquivos:
        raise L.falta(tipo, projeto)

    alvo = descricao.lower()
    achados = []
    for rel in arquivos:
        conteudo = L.ler_texto(L.pasta_da_rotina(projeto, tipo, *rel.split('/')))
        pos = conteudo.lower().find(alvo)
        if pos == -1:
            continue
        ini = max(0, pos - 200)
        fim = min(len(conteudo), pos + len(descricao) + 200)
        trecho = ('…' if ini > 0 else '') + conteudo[ini:fim].strip() + ('…' if fim < len(conteudo) else '')
        achados.append('- %s: %s' % (rel, L.cortar(trecho, L.TETO_EXCERTO)))
        if len(achados) >= L.MAX_CANDIDATOS:
            break
    if not achados:
        return ('Nada encontrado para "%s" em %s do projeto "%s". ⚠️ A busca aqui é '
                'LITERAL: ela casa o texto como você escreveu, e não por sentido. '
                'Tente outra palavra, ou use `onde_esta` se souber o nome.'
                % (descricao, tipo, projeto))
    return ('Candidatos (busca literal em %s do projeto "%s") — é um achador, não a '
            'resposta final:\n' % (tipo, projeto) + '\n'.join(achados))


# ══════════════════════════════════════════════════════════════ Contexto ══

def tool_glossario(projeto, args, _liberados):
    conteudo = L.artefato(projeto, 'glossario', 'glossario.md')
    termo = (args.get('termo') or '').strip().lower()
    if not termo:
        return L.cortar(conteudo, L.TETO_GLOSSARIO)
    blocos, atual = [], []
    for linha in conteudo.splitlines():
        if linha.startswith('#') and atual:
            blocos.append('\n'.join(atual))
            atual = []
        atual.append(linha)
    if atual:
        blocos.append('\n'.join(atual))
    casados = [b for b in blocos if termo in b.lower()]
    if not casados:
        return ('O termo "%s" não está no glossário do projeto "%s".'
                % (args.get('termo'), projeto))
    return L.cortar('\n\n'.join(casados), L.TETO_GLOSSARIO)


# ══════════════════════════════════════════════════════════════ Análise ══

def _impressoes(blob):
    """Desempacota as impressões digitais de um símbolo (inteiros de 8 bytes)."""
    if not blob:
        return set()
    quantas = len(blob) // 8
    if not quantas:
        return set()
    return set(struct.unpack('<%dQ' % quantas, blob[:quantas * 8]))


def _semelhanca(a, b):
    """Coeficiente de sobreposição: quanto do MENOR dos dois está no maior.

    E não Jaccard, de propósito — é a mesma escolha do programa. A pergunta é
    "este código já existe em outro lugar?", e uma função de 10 linhas copiada
    inteira dentro de uma de 200 é um "sim"; Jaccard responderia 0,05 e a
    esconderia.
    """
    if not a or not b:
        return 0.0
    comuns = len(a & b)
    return comuns / float(min(len(a), len(b))) if comuns else 0.0


def tool_duplicados(projeto, args, _liberados):
    """Pares de funções parecidas, lidos do banco que a rotina Duplicados deixou.

    ⚠️ A comparação é por ÍNDICE INVERTIDO, e não todos contra todos: 6 000
    símbolos são 18 milhões de pares. Só entram na conta os que compartilham
    pelo menos uma impressão digital.
    """
    try:
        limiar = float(args.get('limiar') or 0.85)
    except (TypeError, ValueError):
        limiar = 0.85

    banco = L.pasta_da_rotina(projeto, 'embedding', 'index.db')
    if not os.path.isfile(banco):
        raise L.falta('duplicados', projeto)
    try:
        conexao = sqlite3.connect('file:%s?mode=ro' % banco.replace('\\', '/'),
                                  uri=True, timeout=15)
        try:
            linhas = conexao.execute(
                'SELECT file, nome, tipo, line, hash_norm, impressoes '
                'FROM code_symbols').fetchall()
        finally:
            conexao.close()
    except Exception:
        raise L.falta('duplicados', projeto)

    simbolos = [{'file': f, 'nome': n, 'tipo': t, 'line': ln,
                 'hash_norm': h, 'impressoes': _impressoes(blob)}
                for f, n, t, ln, h, blob in linhas]
    if len(simbolos) < 2:
        return ('Menos de duas funções indexadas no projeto "%s" — a rotina '
                'Duplicados ainda não tem o que comparar.' % projeto)

    pares = {}
    por_hash = {}
    for i, s in enumerate(simbolos):
        if s.get('hash_norm'):
            por_hash.setdefault(s['hash_norm'], []).append(i)
    for indices in por_hash.values():
        for pos, a in enumerate(indices):
            for b in indices[pos + 1:]:
                pares[(a, b)] = 1.0

    por_impressao = {}
    for i, s in enumerate(simbolos):
        for imp in s['impressoes']:
            por_impressao.setdefault(imp, []).append(i)
    candidatos = set()
    for indices in por_impressao.values():
        # Impressão que aparece em meio projeto é ruído estrutural (o cabeçalho
        # que toda função repete), não sinal — e ainda geraria n²/2 pares
        # sozinha. Vinte é folgado para clone e apertado para boilerplate.
        if len(indices) > 20:
            continue
        for pos, a in enumerate(indices):
            for b in indices[pos + 1:]:
                if (a, b) not in pares:
                    candidatos.add((a, b))
    for (a, b) in candidatos:
        score = _semelhanca(simbolos[a]['impressoes'], simbolos[b]['impressoes'])
        if score >= limiar:
            pares[(a, b)] = score

    if not pares:
        return ('%d funções indexadas no projeto "%s", nenhum par acima de %d%% de '
                'semelhança.' % (len(simbolos), projeto, int(limiar * 100)))
    ordenados = sorted(pares.items(), key=lambda kv: -kv[1])[:L.MAX_PARES]
    saida = ['%d par(es) acima de %d%% no projeto "%s" (de %d funções indexadas):'
             % (len(ordenados), int(limiar * 100), projeto, len(simbolos))]
    for (a, b), score in ordenados:
        x, y = simbolos[a], simbolos[b]
        saida.append('- %d%%  %s (%s:%s)  ≈  %s (%s:%s)'
                     % (int(score * 100), x['nome'], x['file'], x['line'],
                        y['nome'], y['file'], y['line']))
    return '\n'.join(saida)


# As extensões que contam como código para a varredura. Cópia da lista do
# programa (`CODE_EXTS`, em `analise.py`): inclui `.rb`/`.php`/`.swift`, que são
# código mesmo sem gramática instalada, e exclui `.html`/`.css`, porque a
# fronteira aqui é código × marcação.
EXTENSOES_DE_CODIGO = {
    '.py', '.pyw', '.js', '.jsx', '.ts', '.tsx', '.cs', '.java', '.go',
    '.rs', '.c', '.cpp', '.cc', '.h', '.hpp', '.rb', '.php', '.swift',
}


def tool_arquivos_grandes(projeto, args, _liberados):
    """Os arquivos que não cabem numa leitura só.

    ⚠️ **O TETO AQUI É UM PARÂMETRO, e no MCP Assistente é calculado.** Lá ele
    sai do orçamento de contexto configurado no programa; este servidor não lê a
    configuração do programa, então o teto vem do modelo ou do padrão. É uma
    diferença real, e a resposta diz qual teto usou para ninguém comparar dois
    números que medem coisas diferentes.
    """
    escopo = L.Escopo(projeto)
    try:
        teto = int(args.get('teto') or L.TETO_LER_ARQUIVO)
    except (TypeError, ValueError):
        teto = L.TETO_LER_ARQUIVO

    grandes = []
    for dirpath, dirs, files in escopo.caminhar():
        if escopo.removido(dirpath):
            dirs.clear()
            continue
        dirs[:] = [d for d in dirs if not escopo.removido(os.path.join(dirpath, d))]
        for fname in sorted(files):
            caminho = os.path.join(dirpath, fname)
            if escopo.removido(caminho):
                continue
            if os.path.splitext(fname)[1].lower() not in EXTENSOES_DE_CODIGO:
                continue
            try:
                conteudo = L.ler_texto(caminho)
            except Exception:
                continue
            tokens = L.contar_tokens(conteudo)
            if tokens > teto:
                grandes.append((escopo.relativo(caminho),
                                len(conteudo.splitlines()), tokens))
    if not grandes:
        return ('Nenhum arquivo do projeto "%s" passa de %d tokens.' % (projeto, teto))
    grandes.sort(key=lambda x: -x[2])
    saida = ['%d arquivo(s) do projeto "%s" acima de %d tokens:'
             % (len(grandes), projeto, teto)]
    for rel, linhas, tokens in grandes[:L.MAX_ARQUIVOS_GRANDES]:
        saida.append('- %s — %d linhas, %d tokens' % (rel, linhas, tokens))
    if len(grandes) > L.MAX_ARQUIVOS_GRANDES:
        saida.append('... +%d não listados.' % (len(grandes) - L.MAX_ARQUIVOS_GRANDES))
    return '\n'.join(saida)


# ── O mapa de I/O, no motor de expressão regular ─────────────────────────────
# Cópia do caminho de reserva do programa (`analise_io.py::extrair_por_regex`).
# O motor principal de lá é tree-sitter, e não cabe aqui — ver o cabeçalho.
PADROES_DE_IO = [
    (re.compile(r'\bopen\s*\('),            'open'),
    (re.compile(r'\bfopen\s*\('),           'open'),
    (re.compile(r'\bos\.remove\s*\('),      'delete'),
    (re.compile(r'\bos\.unlink\s*\('),      'delete'),
    (re.compile(r'\bshutil\.rmtree\s*\('),  'delete'),
    (re.compile(r'\bos\.rmdir\s*\('),       'delete'),
    (re.compile(r'\bos\.makedirs\s*\('),    'mkdir'),
    (re.compile(r'\bos\.mkdir\s*\('),       'mkdir'),
    (re.compile(r'\bshutil\.copy\w*\s*\('), 'copy'),
    (re.compile(r'\bshutil\.move\s*\('),    'move'),
    (re.compile(r'\bos\.rename\s*\('),      'move'),
    (re.compile(r'\bjson\.dump\s*\('),      'write'),
    (re.compile(r'\bjson\.load\s*\('),      'read'),
    (re.compile(r'\.write\s*\('),           'write'),
    (re.compile(r'\.read\s*\('),            'read'),
    (re.compile(r'\bwriteFileSync\s*\('),   'write'),
    (re.compile(r'\breadFileSync\s*\('),    'read'),
    (re.compile(r'\bwriteFile\s*\('),       'write'),
    (re.compile(r'\breadFile\s*\('),        'read'),
    (re.compile(r'\bFile\.\w+\s*\('),       'file'),
]

MODO_DE_ESCRITA = re.compile(r'''['"]\s*[wWaAxX+][^'"]{0,4}['"]''')
LITERAL = re.compile(r'''["']([^"'\n]{1,200})["']''')


def tool_io(projeto, args, _liberados):
    escopo = L.Escopo(projeto)
    alvo = (args.get('arquivo') or '').replace('\\', '/').strip()
    if not alvo:
        return 'Informe o parâmetro "arquivo".'
    caminho = escopo.resolver(alvo)
    if not escopo.dentro(caminho):
        raise escopo.erro_fora_do_escopo(alvo)
    if escopo.removido(caminho):
        raise L.ErroDeUso(
            '"%s" está na lista de removidos do projeto "%s" — o usuário o tirou do '
            'escopo de propósito.' % (alvo, projeto))
    if not os.path.isfile(caminho):
        raise L.ErroDeUso('arquivo não encontrado no projeto "%s": %s' % (projeto, alvo))

    operacoes = []
    for numero, linha in enumerate(L.ler_texto(caminho).splitlines(), 1):
        for padrao, tipo in PADROES_DE_IO:
            if not padrao.search(linha):
                continue
            if tipo == 'open':
                tipo = 'write' if MODO_DE_ESCRITA.search(linha) else 'read'
            literal = LITERAL.search(linha)
            operacoes.append((numero, tipo, linha.strip()[:L.GREP_CORTE_LINHA],
                              literal.group(1) if literal else None))
            break
    if not operacoes:
        return 'Nenhuma operação de disco em %s (projeto "%s").' % (alvo, projeto)

    saida = ['%s (projeto "%s") — %d operação(ões) de disco:'
             % (escopo.relativo(caminho), projeto, len(operacoes))]
    for numero, tipo, texto, literal in operacoes[:L.MAX_IO_OPERACOES]:
        linha = '  L%d %s: %s' % (numero, tipo, texto)
        if literal:
            # ⚠️ "aproximado" não é modéstia: no motor de regex este campo é a
            # primeira coisa entre aspas da linha, então em
            # `open(f, 'r', encoding='utf-8')` ele sai como `r`. Sem o rótulo, o
            # modelo lê um modo de abertura achando que é um caminho.
            linha += '  → alvo (aproximado): %s' % literal
        saida.append(linha)
    if len(operacoes) > L.MAX_IO_OPERACOES:
        saida.append('  ... +%d operações não listadas.'
                     % (len(operacoes) - L.MAX_IO_OPERACOES))
    return '\n'.join(saida)
