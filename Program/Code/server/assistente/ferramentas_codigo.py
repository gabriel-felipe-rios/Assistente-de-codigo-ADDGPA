"""Os handlers que respondem sobre o CÓDIGO: onde está, quem usa, quem importa.

⚠️ `eu_uso`, `me_usam` E `relacoes_uso` LEEM O ÍNDICE DE IDENTIFICADORES, e
`grafo_imports` lê outra base. Não é redundância: a primeira casa MENÇÃO DE
IDENTIFICADOR — função global JS chamada de outro arquivo, ponte
`window.pywebview.api.X` ↔ `def X`, id declarado no HTML e lido no JS —, e a
segunda casa `import`. Unificá-las apaga justamente o que um grep não acha.

⚠️ OS `_ferr_*` DA `Api` LEVANTAM `ValueError` COM A MENSAGEM PENSADA PARA O
MODELO LER. O `servidor.py` embrulharia qualquer exceção num
`Erro na ferramenta X: …`, que perde essa redação — por isso todo handler que os
chama captura `ValueError` e devolve `str(e)`.
"""

from ferramentas_apoio import *  # noqa: F401,F403
from ferramentas_apoio import (  # noqa: E402
    erro_util, partes_artefato, LEITOR_ASSISTENTE_EXTERNO,
    _AVISO_BASE_DE_IDENTIFICADORES, _match_arquivo, _limite, _cortar,
    _caminho_colavel,
)


def tool_onde_esta(api, project, args):
    nome = (args.get('nome') or '').strip()
    if not nome:
        return 'Informe o parâmetro "nome".'
    r = api.get_symbol_index(project)
    idx = r.get('index') if r.get('success') else None
    if not idx:
        return 'O índice de símbolos ainda não foi gerado para este projeto.'
    syms = idx.get('symbols', [])
    low = nome.lower()
    exatos = [s for s in syms if (s.get('name') or '').lower() == low]
    parciais = [s for s in syms if low in (s.get('name') or '').lower() and s not in exatos]
    achados = (exatos + parciais)[:_limite(api, 'mcp_onde_esta_max_simbolos')]
    if not achados:
        return f'Nenhum símbolo chamado "{nome}".'
    linhas = [f"- {s.get('name')} ({s.get('type')}) — {_caminho_colavel(s)}:{s.get('line')}" for s in achados]
    return f'{len(achados)} símbolo(s) para "{nome}":\n' + '\n'.join(linhas)


def tool_eu_uso(api, project, args):
    arq, recado = _match_arquivo(api, project, args.get('arquivo', ''))
    if recado:
        return recado
    r = api.get_relacoes(project, arq)
    if not r.get('success'):
        return r.get('error', 'Erro ao ler relações.')
    usa = r.get('usa', [])
    if not usa:
        return (f'{arq}: não usa ninguém (ou o índice de identificadores não foi '
                'gerado).' + _AVISO_BASE_DE_IDENTIFICADORES)
    return (f'{arq} USA:\n' + '\n'.join(
        f"- {u.get('arquivo')} (via {', '.join(u.get('via', []))})" for u in usa)
        + _AVISO_BASE_DE_IDENTIFICADORES)


def tool_me_usam(api, project, args):
    arq, recado = _match_arquivo(api, project, args.get('arquivo', ''))
    if recado:
        return recado
    r = api.get_relacoes(project, arq)
    if not r.get('success'):
        return r.get('error', 'Erro ao ler relações.')
    usado = r.get('usado_por', [])
    if not usado:
        return (f'{arq}: ninguém usa (ou o índice de identificadores não foi '
                'gerado).' + _AVISO_BASE_DE_IDENTIFICADORES)
    return (f'{arq} é USADO POR:\n' + '\n'.join(
        f"- {u.get('arquivo')} (via {', '.join(u.get('via', []))})" for u in usado)
        + _AVISO_BASE_DE_IDENTIFICADORES)


def tool_relacoes_uso(api, project, args):
    arq, recado = _match_arquivo(api, project, args.get('arquivo', ''))
    if recado:
        return recado
    # O nível deixou de ser o `3` cravado aqui: virou campo de Configurações →
    # Servidores MCP do programa, porque quão fundo a cascata desce é decisão
    # de quem usa.
    nivel = _limite(api, 'mcp_cascata_nivel')
    r = api.get_cascata(project, arq, nivel)
    if not r.get('success'):
        return r.get('error', 'Erro ao ler cascata.')
    niveis = r.get('niveis', [])
    if not niveis:
        return (f'{arq}: nada quebra em cascata (nível ≤ {nivel}).'
                + _AVISO_BASE_DE_IDENTIFICADORES)
    out = [f'Cascata de impacto de {arq} (nível ≤ {nivel} — só o que quebra):']
    for nv in niveis:
        out.append(f"Nível {nv.get('nivel')}:")
        for it in nv.get('itens', []):
            out.append(f"  - {it.get('arquivo')} (via {it.get('via', '')}, através de {it.get('atraves_de', '')})")
    if r.get('restantes'):
        out.append(f"... +{r['restantes']} além do nível {nivel} (omitidos).")
    return '\n'.join(out) + _AVISO_BASE_DE_IDENTIFICADORES


def tool_indice_navegacao(api, project, args):
    """O mapa do projeto, servido EM PARTES — como as três irmãs.

    ⚠️ Este handler lia o `.md` cru e devolvia a árvore inteira: **15.497 tokens
    numa tacada**, sem teto e sem paginação — a única ferramenta de artefato
    assim. Era a anomalia, e não o padrão: `_ferr_ler_indice` já divide por
    cabeçalho, já serve por partes e já traz a dica de que o índice é POR PASTA,
    e o prompt do Buscador já descreve a ferramenta exatamente assim para o
    modelo local ("sem parâmetro, devolve a LISTA das partes"). Aqui ela só
    deixou de ser ignorada — nenhum mecanismo novo foi escrito.

    ⚠️ **O comportamento muda, e de propósito.** Com `mcp_teto_parte_tokens` em
    12000, `indice_navegacao()` passa a devolver o índice das 41 partes (~732
    tokens) em vez da árvore inteira. Quem quiser a árvore numa chamada só põe
    esse campo em **16000** (Configurações → Servidores MCP do programa): fica
    acima dos 15.497 do índice e ainda abaixo dos 19.369 do pipeline, que
    continua paginado. É a única forma de descobrir o ajuste sem refazer a
    medição.

    ⚠️ **O `erro_util` é obrigatório aqui.** `_sub_conteudo_agente` levanta
    `ValueError` quando o artefato não foi gerado, e `casar_parte` levanta
    `ValueError` com as sugestões quando a parte não existe. Sem o embrulho, as
    duas viram `Erro na ferramenta indice_navegacao: …` e perdem a redação que
    foi escrita para o modelo ler.
    """
    return erro_util(lambda: api._ferr_ler_indice(
        project,
        parte=(args.get('parte') or None),
        quem=LEITOR_ASSISTENTE_EXTERNO))


def tool_grafo_imports(api, project, args):
    return erro_util(lambda: api._ferr_ler_grafo_imports(
        project,
        parte=(args.get('parte') or None),
        quem=LEITOR_ASSISTENTE_EXTERNO))


def _casar_md(api, project, agent, alvo, oque):
    """Acha o `.md` daquele arquivo dentro da árvore de saída de uma rotina.

    A saída espelha as pastas de trabalho. Ir direto ao caminho montado à mão
    não funciona — a árvore tem prefixo de pasta que o assistente não conhece.

    O casamento é pelo CAMINHO: nome repetido (`__init__.py`,
    `system-prompt.txt`) devolvia a doc de outro arquivo do mesmo projeto. Em
    ordem: o caminho inteiro ou o fim dele; o nome do arquivo; o nome contido.
    Mais de um candidato não escolhe: devolve a lista para quem pediu passar o
    caminho.
    """
    alvo = (alvo or '').replace('\\', '/').lower()
    if not alvo:
        return 'Informe o parâmetro "arquivo".'
    lst = api.list_agent_files(project, agent)
    files = [f for f in lst.get('files', []) if f.endswith('.md')]
    if not files:
        return f'{oque} ainda não foi gerado para este projeto.'
    alvo = alvo[:-3] if alvo.endswith('.md') else alvo
    nome = alvo.split('/')[-1]
    norm = {f: f.replace('\\', '/').lower()[:-3] for f in files}
    cand = [f for f, n in norm.items() if n == alvo or n.endswith('/' + alvo)]
    if not cand:
        cand = [f for f, n in norm.items() if n == nome or n.endswith('/' + nome)]
    if not cand:
        cand = [f for f, n in norm.items() if nome in n]
    if not cand:
        return f'Sem {oque.lower()} para "{alvo}".'
    if len(cand) > 1:
        caminhos = '\n'.join(f.replace('\\', '/')[:-3] for f in sorted(cand)[:20])
        return (f'Há {len(cand)} arquivos que casam com "{alvo}". Passe o caminho '
                f'de um deles:\n{caminhos}')
    r = api.read_agent_file(project, agent, cand[0])
    return r.get('content', '') if r.get('success') else r.get('error', 'Erro.')


def tool_comentarios(api, project, args):
    return _casar_md(api, project, 'comentarios', args.get('arquivo'),
                     'Os comentários')


def tool_bibliotecas(api, project, args):
    """Sem `nome`, a lista das de terceiros; com `nome`, a ficha daquela.

    A saída da rotina é uma árvore de `.md` em dois grupos —
    `Bibliotecas de terceiros (N)/` e `Padrão da linguagem (N)/`. Sem parâmetro
    listam-se as de TERCEIROS, e não as duas: as da linguagem padrão são
    dezenas de `os`, `sys`, `json` que o assistente já conhece e que só
    afogariam as que importam.
    """
    lst = api.list_agent_files(project, 'bibliotecas')
    files = [f for f in lst.get('files', []) if f.endswith('.md')]
    if not files:
        return 'As bibliotecas ainda não foram indexadas neste projeto.'

    nome = (args.get('nome') or '').strip().lower()
    if nome:
        cand = [f for f in files if nome in os.path.basename(f).lower()]
        if not cand:
            cand = [f for f in files if nome in f.lower()]
        if not cand:
            return (f'Nenhuma biblioteca chamada "{args.get("nome")}". '
                    'Chame esta ferramenta sem parâmetro para ver a lista.')
        r = api.read_agent_file(project, 'bibliotecas', cand[0])
        return r.get('content', '') if r.get('success') else r.get('error', 'Erro.')

    terceiros = [f for f in files if f.replace('\\', '/').lower().startswith('bibliotecas de terceiro')]
    if not terceiros:
        return ('Nenhuma biblioteca de terceiros neste projeto — só as padrão da '
                'linguagem. Peça uma pelo nome para ver a ficha dela.')
    # `{grupo}/{linguagem}/{nome}.md` → agrupa pela linguagem, que é o nível do meio.
    por_lang = {}
    for f in terceiros:
        partes = f.replace('\\', '/').split('/')
        lang = partes[1] if len(partes) > 2 else '(sem linguagem)'
        por_lang.setdefault(lang, []).append(os.path.splitext(partes[-1])[0])
    out = ['Bibliotecas de terceiros deste projeto '
           '(peça uma pelo nome para ver onde é usada):']
    for lang in sorted(por_lang):
        out.append(f'\n{lang}:')
        out.append('  ' + ' · '.join(sorted(por_lang[lang])))
    return '\n'.join(out)


