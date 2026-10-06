"""Os handlers que respondem sobre o CÓDIGO do projeto consultado.

Onde está, quem usa, quem importa, o que o autor escreveu e o que o projeto já
tem de terceiros.

⚠️ `eu_uso`, `me_usam` E `relacoes_uso` LEEM O ÍNDICE DE IDENTIFICADORES;
`grafo_imports` lê outra base. Não é redundância: a primeira casa MENÇÃO DE
IDENTIFICADOR — função global JS chamada de outro arquivo, ponte
`window.pywebview.api.X` ↔ `def X`, id declarado no HTML e lido no JS —, e a
segunda casa `import`. Unificá-las apaga justamente o que um grep não acha.

⚠️ **AS ARESTAS SÃO RECALCULADAS AQUI**, a partir do `identificadores.json`. No
programa quem faz isso é `_id_arestas`, e ele não pode ser importado — ver o
aviso no topo de `leitura.py`. A regra é a mesma, inclusive o teto de
definidores: um nome definido em mais de dois arquivos é nome local genérico
(`worker`, `handler`), e tratá-lo como aresta ligaria todo arquivo a todo
arquivo, afogando as ligações reais.
"""

import os

import leitura as L


# A frase que acompanha as três de uso. É texto NA RESPOSTA e nada mais: as três
# continuam lendo só o Índice de Identificadores.
AVISO_IDENTIFICADORES = (
    '\n\n(esta base casa MENÇÃO DE IDENTIFICADOR, e não `import`: função global '
    'JS definida num arquivo e chamada em outro, ponte `window.pywebview.api.X` '
    '↔ `def X`, ID ou classe declarada no HTML e lida no JS. Para quem importa '
    'quem, a ferramenta é `grafo_imports`.)')

# Nome definido em mais arquivos do que isto não liga ninguém a ninguém.
MAX_DEFINIDORES = 2


# ══════════════════════════════════════════════ O índice de identificadores ══

_ARESTAS = {}


def _arestas(projeto):
    """`{arquivo: {alvo: [motivos]}}` — quem usa quem, e por qual nome.

    Uma aresta A → B existe quando A **usa** um nome que B **define**.

    ⚠️ O resultado fica em cache por processo. O `identificadores.json` deste
    projeto tem dezenas de milhares de nomes, e três ferramentas o percorrem;
    sem cache, uma sessão que use as três paga a varredura três vezes. O cache
    é invalidado pelo mtime do arquivo, então uma rodada nova da rotina no
    projeto consultado é vista sem reiniciar o servidor.
    """
    caminho = L.pasta_da_rotina(projeto, 'identificadores', 'identificadores.json')
    if not os.path.isfile(caminho):
        raise L.falta('identificadores', projeto)
    chave = (projeto, os.path.getmtime(caminho))
    if chave in _ARESTAS:
        return _ARESTAS[chave]

    dados = L.ler_json(caminho, {}) or {}
    usa = {}
    for nome, ocorrencias in (dados.get('nomes') or {}).items():
        definidores = {o['arquivo'] for o in ocorrencias if o.get('tipo') == 'definicao'}
        if not definidores or len(definidores) > MAX_DEFINIDORES:
            continue
        usuarios = {o['arquivo'] for o in ocorrencias if o.get('tipo') == 'uso'}
        for origem in usuarios:
            for destino in definidores:
                if origem == destino:
                    continue
                motivos = usa.setdefault(origem, {}).setdefault(destino, [])
                if nome not in motivos:
                    motivos.append(nome)
    _ARESTAS.clear()          # um projeto por vez basta; a base é grande
    _ARESTAS[chave] = usa
    return usa


def _arquivos_indexados(projeto):
    caminho = L.pasta_da_rotina(projeto, 'identificadores', 'identificadores.json')
    dados = L.ler_json(caminho, {}) or {}
    arquivos = set()
    for ocorrencias in (dados.get('nomes') or {}).values():
        for o in ocorrencias:
            arquivos.add(o.get('arquivo'))
    return sorted(a for a in arquivos if a)


def _casar_arquivo(projeto, pedido):
    """`(chave, recado)`. Enquanto casa, `recado` é `None`.

    ⚠️ **É PARA ISSO QUE O SEGUNDO VALOR EXISTE.** Sem ele, um erro de digitação
    devolveria "ninguém usa" — a MESMA frase que um arquivo real e órfão recebe.
    Um engano de grafia viraria um fato sobre o projeto, e nada no texto deixaria
    distinguir um do outro.
    """
    pedido = (pedido or '').replace('\\', '/').strip()
    chaves = _arquivos_indexados(projeto)
    if not chaves or not pedido:
        return pedido, None
    alvo = pedido.lower()
    for k in chaves:
        if k.replace('\\', '/').lower() == alvo:
            return k, None
    candidatos = [k for k in chaves if k.replace('\\', '/').lower().endswith(alvo)]
    if not candidatos:
        candidatos = [k for k in chaves if alvo in k.replace('\\', '/').lower()]
    if candidatos:
        return candidatos[0], None
    return pedido, (
        '"%s" não está no Índice de Identificadores do projeto "%s". Isso NÃO quer '
        'dizer que ninguém o usa — quer dizer que ele não foi indexado: confira a '
        'grafia, ou veja se o arquivo está fora das pastas de trabalho marcadas '
        'naquele projeto.\n' % (pedido, projeto)
        + L.sugestoes(chaves, alvo, rotulo='Arquivos indexados',
                      como_ver_todas='use o indice_navegacao'))


# ══════════════════════════════════════════════════════════════ Handlers ══

def tool_projetos(projeto, args, liberados):
    """Os projetos que este servidor pode consultar — os marcados pelo usuário.

    ⚠️ `projeto` chega vazio aqui de propósito: é a única ferramenta que não
    consulta projeto nenhum. Ela é a porta de entrada — sem ela o modelo teria
    de adivinhar um nome, e a recusa não diria quais existem.
    """
    if not liberados:
        return ('Nenhum projeto foi liberado para consulta. O usuário marca quais '
                'podem ser consultados na aba Arquivos → MCPs → "Outros projetos", '
                'dentro deste projeto. Enquanto a lista estiver vazia, este servidor '
                'não lê nada.')
    todos = set(L.projetos_cadastrados())
    linhas = []
    for nome in liberados:
        # Projeto liberado que sumiu da instalação: dizer isso vale mais que
        # omiti-lo, porque a marcação continua lá e o usuário precisa saber.
        linhas.append('- %s%s' % (nome, '' if nome in todos
                                  else '  (marcado, mas não existe mais nesta instalação)'))
    return ('Projetos que você pode consultar (passe o NOME, exatamente assim, no '
            'parâmetro "projeto"):\n' + '\n'.join(linhas))


def tool_onde_esta(projeto, args, _liberados):
    nome = (args.get('nome') or '').strip()
    if not nome:
        return 'Informe o parâmetro "nome".'
    caminho = L.pasta_de_dados(projeto, 'Análise', 'Índice de Símbolos.json')
    if not os.path.isfile(caminho):
        return ('O Índice de Símbolos do projeto "%s" ainda não foi gerado. Ele sai da '
                'aba Análise daquele projeto.' % projeto)
    indice = L.ler_json(caminho, {}) or {}
    simbolos = indice.get('symbols') or []
    baixo = nome.lower()
    exatos = [s for s in simbolos if (s.get('name') or '').lower() == baixo]
    parciais = [s for s in simbolos
                if baixo in (s.get('name') or '').lower() and s not in exatos]
    achados = (exatos + parciais)[:L.MAX_SIMBOLOS]
    if not achados:
        return 'Nenhum símbolo chamado "%s" no projeto "%s".' % (nome, projeto)
    linhas = ['- %s (%s) — %s:%s' % (s.get('name'), s.get('type'),
                                     _caminho_colavel(s), s.get('line'))
              for s in achados]
    return ('%d símbolo(s) para "%s" no projeto "%s":\n' % (len(achados), nome, projeto)
            + '\n'.join(linhas))


def _caminho_colavel(simbolo):
    """O caminho no mesmo dialeto do resto do servidor: `Program/Code/…`.

    O índice guarda `folder` (o caminho ABSOLUTO da pasta de trabalho) e
    `relative` (o resto, com a barra do Windows). Sozinho, o `relative` não cola
    em `ler_arquivo` — e uma ferramenta cujo resultado não entra na outra obriga
    o modelo a adivinhar o caminho, que é o que o índice existe para poupar.
    """
    rel = (simbolo.get('relative') or '').replace('\\', '/')
    pasta = simbolo.get('folder') or ''
    prefixo = os.path.basename(os.path.normpath(pasta)) if pasta else ''
    return '%s/%s' % (prefixo, rel) if prefixo else rel


def tool_eu_uso(projeto, args, _liberados):
    arquivo, recado = _casar_arquivo(projeto, args.get('arquivo', ''))
    if recado:
        return recado
    usa = _arestas(projeto).get(arquivo) or {}
    if not usa:
        return ('%s: não usa ninguém no projeto "%s".' % (arquivo, projeto)
                + AVISO_IDENTIFICADORES)
    linhas = ['- %s (via %s)' % (destino, ', '.join(motivos[:6]))
              for destino, motivos in sorted(usa.items())]
    return '%s USA:\n%s%s' % (arquivo, '\n'.join(linhas), AVISO_IDENTIFICADORES)


def tool_me_usam(projeto, args, _liberados):
    arquivo, recado = _casar_arquivo(projeto, args.get('arquivo', ''))
    if recado:
        return recado
    usado_por = []
    for origem, destinos in sorted(_arestas(projeto).items()):
        if arquivo in destinos:
            usado_por.append('- %s (via %s)' % (origem, ', '.join(destinos[arquivo][:6])))
    if not usado_por:
        return ('%s: ninguém usa no projeto "%s".' % (arquivo, projeto)
                + AVISO_IDENTIFICADORES)
    return '%s é USADO POR:\n%s%s' % (arquivo, '\n'.join(usado_por),
                                      AVISO_IDENTIFICADORES)


def tool_relacoes_uso(projeto, args, _liberados):
    arquivo, recado = _casar_arquivo(projeto, args.get('arquivo', ''))
    if recado:
        return recado
    usa_map = _arestas(projeto)

    usado_por = {}
    for origem, destinos in usa_map.items():
        for destino, motivos in destinos.items():
            usado_por.setdefault(destino, {})[origem] = motivos

    # Quem já apareceu num nível anterior não repete: em projeto grande o
    # fechamento transitivo tende a "o projeto inteiro", e aí a informação vira
    # inútil.
    vistos = {arquivo}
    fronteira = set(usado_por.get(arquivo, {}))
    vistos |= fronteira
    niveis = []
    nivel = 2
    while fronteira and nivel <= L.CASCATA_NIVEL:
        proxima, itens = set(), []
        for atual in sorted(fronteira):
            for candidato, motivos in sorted(usado_por.get(atual, {}).items()):
                if candidato in vistos:
                    continue
                proxima.add(candidato)
                itens.append('  - %s (via %s, através de %s)'
                             % (candidato, ', '.join(motivos[:4]), atual))
        if itens:
            vistos |= proxima
            niveis.append('Nível %d:\n%s' % (nivel, '\n'.join(itens)))
        fronteira = proxima
        nivel += 1

    if not niveis:
        return ('%s: nada quebra em cascata (nível ≤ %d) no projeto "%s".'
                % (arquivo, L.CASCATA_NIVEL, projeto) + AVISO_IDENTIFICADORES)
    return ('Cascata de impacto de %s no projeto "%s" (nível ≤ %d — só o que quebra):\n%s%s'
            % (arquivo, projeto, L.CASCATA_NIVEL, '\n'.join(niveis),
               AVISO_IDENTIFICADORES))


def tool_indice_navegacao(projeto, args, _liberados):
    conteudo = L.artefato(projeto, 'indice-navegacao', 'indice-navegacao.md')
    partes = L.dividir_por_cabecalho(conteudo)
    return L.servir_partes('índice de navegação de "%s"' % projeto, partes,
                           args.get('parte'))


def tool_grafo_imports(projeto, args, _liberados):
    conteudo = L.artefato(projeto, 'grafo-imports', 'grafo.json')
    try:
        import json as _json
        dados = _json.loads(conteudo)
    except Exception:
        # Grafo ilegível não é motivo para não devolver nada: serve o texto cru
        # dentro do teto, que ainda é melhor que um erro seco.
        return L.cortar(conteudo, L.TETO_PARTE)
    partes = L.dividir_grafo_por_pasta(dados)
    return L.servir_partes('grafo de imports de "%s"' % projeto, partes,
                           args.get('parte'))


def casar_md(projeto, id_rotina, alvo, oque):
    """Acha o `.md` daquele arquivo dentro da árvore de saída de uma rotina.

    A saída espelha as pastas de trabalho, então o casamento é pelo nome do
    arquivo com `.md` no fim, e só depois por substring. Montar o caminho à mão
    não funciona — a árvore tem prefixo de pasta que o modelo não conhece.
    """
    alvo = (alvo or '').replace('\\', '/').strip().lower()
    if not alvo:
        return 'Informe o parâmetro "arquivo".'
    arquivos = L.arquivos_da_rotina(projeto, id_rotina)
    if not arquivos:
        raise L.falta(id_rotina, projeto)
    base = alvo.split('/')[-1]
    candidatos = [f for f in arquivos if f.lower().endswith(base + '.md')]
    if not candidatos:
        candidatos = [f for f in arquivos if base in f.lower()]
    if not candidatos:
        return ('Sem %s para "%s" no projeto "%s".\n' % (oque.lower(), alvo, projeto)
                + L.sugestoes(arquivos, L.normalizar(alvo), rotulo=oque,
                              como_ver_todas='use o indice_navegacao'))
    return L.ler_texto(L.pasta_da_rotina(projeto, id_rotina, *candidatos[0].split('/')))


def tool_comentarios(projeto, args, _liberados):
    return casar_md(projeto, 'comentarios', args.get('arquivo'), 'Os comentários')


def tool_bibliotecas(projeto, args, _liberados):
    """Sem `nome`, as de terceiros; com `nome`, a ficha daquela.

    A saída da rotina é uma árvore em dois grupos — `Bibliotecas de terceiros (N)/`
    e `Padrão da linguagem (N)/`. Sem parâmetro listam-se as de TERCEIROS, e não
    as duas: as da linguagem padrão são dezenas de `os`, `sys`, `json` que o
    assistente já conhece e que só afogariam as que importam.
    """
    arquivos = L.arquivos_da_rotina(projeto, 'bibliotecas')
    if not arquivos:
        raise L.falta('bibliotecas', projeto)

    nome = (args.get('nome') or '').strip().lower()
    if nome:
        candidatos = [f for f in arquivos if nome in os.path.basename(f).lower()]
        if not candidatos:
            candidatos = [f for f in arquivos if nome in f.lower()]
        if not candidatos:
            return ('Nenhuma biblioteca chamada "%s" no projeto "%s". Chame esta '
                    'ferramenta sem o parâmetro "nome" para ver a lista.'
                    % (args.get('nome'), projeto))
        return L.ler_texto(L.pasta_da_rotina(projeto, 'bibliotecas',
                                             *candidatos[0].split('/')))

    terceiros = [f for f in arquivos if f.lower().startswith('bibliotecas de terceiro')]
    if not terceiros:
        return ('Nenhuma biblioteca de terceiros no projeto "%s" — só as padrão da '
                'linguagem. Peça uma pelo nome para ver a ficha dela.' % projeto)
    por_linguagem = {}
    for f in terceiros:
        partes = f.split('/')
        linguagem = partes[1] if len(partes) > 2 else '(sem linguagem)'
        por_linguagem.setdefault(linguagem, []).append(
            os.path.splitext(partes[-1])[0])
    saida = ['Bibliotecas de terceiros do projeto "%s" (peça uma pelo nome para ver '
             'onde é usada — e para saber o que precisa existir no projeto de '
             'destino):' % projeto]
    for linguagem in sorted(por_linguagem):
        saida.append('\n%s:' % linguagem)
        saida.append('  ' + ' · '.join(sorted(por_linguagem[linguagem])))
    return '\n'.join(saida)
