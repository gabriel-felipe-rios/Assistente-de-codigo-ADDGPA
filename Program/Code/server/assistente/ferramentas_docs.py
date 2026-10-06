"""Os handlers que respondem a partir do que uma ROTINA escreveu — e a leitura crua.

Documentação técnica, resumo de pastas, pipeline, busca semântica, glossário,
duplicados, arquivos grandes e o mapa de I/O; mais as três de leitura direta
(`grep`, `ler_arquivo`, `listar_pasta`).

⚠️ ARTEFATO NÃO GERADO DIZ QUAL AGENTE O GERA. É a diferença entre o assistente
externo desistir da linha de investigação e o usuário receber "peça para rodar o
agente X na aba Automação".

⚠️ AS TRÊS DE LEITURA CRUA PASSAM PELO FUNIL DE "QUEM PODE LER" com
`LEITOR_ASSISTENTE_EXTERNO`. É isso que faz elas respeitarem o que o usuário
tirou do escopo — e é por isso que elas existem aqui em vez de o assistente usar
as ferramentas nativas dele.
"""

from ferramentas_apoio import *  # noqa: F401,F403
from ferramentas_apoio import (  # noqa: E402
    erro_util, partes_artefato, LEITOR_ASSISTENTE_EXTERNO,
    _match_arquivo, _limite, _cortar, _caminho_colavel,
)

# ══════════════════════════════════════ Documentação (passou por um modelo) ══

def tool_doc_tecnica(api, project, args):
    """Por seção, de vários arquivos numa chamada (D19, D34) — a MESMA leitura
    do subagente `ler_doc_tecnica`; só o teto muda, por `quem`.

    Era `_casar_md(…, args.get('arquivo'))`: o `.md` inteiro, um arquivo por
    chamada, sem teto nenhum.
    """
    return erro_util(lambda: api._ferr_ler_doc_tecnica(
        project, ler=args.get('ler'), quem=LEITOR_ASSISTENTE_EXTERNO))


def tool_resumo_pastas(api, project, args):
    return erro_util(lambda: api._ferr_ler_resumo_pastas(
        project, ler=args.get('ler'), quem=LEITOR_ASSISTENTE_EXTERNO))


def tool_pipeline(api, project, args):
    return erro_util(lambda: api._ferr_ler_pipeline(
        project,
        parte=(args.get('parte') or None),
        filtro=(args.get('filtro') or None),
        quem=LEITOR_ASSISTENTE_EXTERNO))


def tool_busca_semantica(api, project, args):
    """A fonte deixou de ser fixa: `tipo` escolhe entre as duas.

    Era `search_embeddings(project, desc, 'documentacao-tecnica', 8)` — a fonte
    e o número de candidatos cravados no código. A documentação técnica e o
    resumo de pastas são as duas fontes.
    """
    desc = (args.get('descricao') or args.get('query') or '').strip()
    if not desc:
        return 'Informe o parâmetro "descricao".'
    tipo = (args.get('tipo') or 'documentacao-tecnica').strip()
    # Tipo desconhecido é recusado AQUI: o `except` abaixo engoliria o erro da
    # busca e a resposta viraria "nada encontrado" — como se o tipo existisse.
    # `espelho` caiu nessa quando o Espelho saiu (2026-09).
    from modulos.agentes.ferramentas_subagentes_constantes import BUSCA_SEMANTICA_TIPOS
    if tipo not in BUSCA_SEMANTICA_TIPOS:
        return (f'O tipo "{tipo}" não existe. Use documentacao-tecnica (padrão, '
                'por arquivo) ou resumo-pastas (por pasta).')
    candidatos = _limite(api, 'mcp_busca_semantica_candidatos')
    # ⚠️ O trecho é cortado em TOKEN, e não nos 120 caracteres de antes: o que
    # ele consome é a janela de quem pergunta, e caractere não diz quanto de
    # janela custa — 120 de código denso não custam o mesmo que 120 de prosa.
    corte = _limite(api, 'mcp_busca_semantica_excerpt_tokens')
    try:
        r = api.search_embeddings(project, desc, tipo, candidatos)
        if r.get('success') and r.get('results'):
            return f'Candidatos (busca semântica em {tipo}):\n' + '\n'.join(
                f"- {x.get('source_file')} (score {float(x.get('score', 0)):.2f}): "
                f"{_cortar(api, x.get('excerpt') or '', corte)}"
                for x in r['results'])
    except Exception:
        pass
    try:
        r = api.search_doc_content(project, desc, tipo)
        res = r.get('results', []) if isinstance(r, dict) else []
        if res:
            linhas = []
            for x in res[:candidatos]:
                if isinstance(x, dict):
                    linhas.append(f"- {x.get('source_file') or x.get('doc_path') or x}")
                else:
                    linhas.append(f"- {x}")
            return 'Candidatos (busca literal — embedding indisponível):\n' + '\n'.join(linhas)
    except Exception as e:
        return f'Busca indisponível: {e}'
    return 'Nada encontrado para essa descrição.'


# ══════════════════════════════════════════════════════════════════ Contexto ══

def tool_glossario(api, project, args):
    """Uma linha de termo, um tópico, ou o índice dos tópicos — nunca o
    glossário inteiro de uma vez (D40).

    ⚠️ O corte é em TOKEN. Era em caractere (`mcp_glossario_chars`), e estava
    errado pela regra da unidade do projeto: caractere só vale onde o corte é de
    APRESENTAÇÃO — a linha do grep, que é amostra para o modelo se localizar.
    Aqui o corte é de ORÇAMENTO, porque o que se recorta é o que entra na janela
    de quem perguntou.
    """
    return erro_util(lambda: _cortar(api, api._ferr_ler_glossario(
        project, (args.get('termo') or '').strip() or None,
        (args.get('topico') or '').strip() or None), _limite(api, 'mcp_glossario_tokens')))


# ═════════════════════════════════════════ Análise (o que está torto no código) ══

def tool_duplicados(api, project, args):
    try:
        limiar = float(args.get('limiar') or 0.85)
    except (TypeError, ValueError):
        limiar = 0.85
    r = api.get_duplicados(project, limiar, _limite(api, 'mcp_duplicados_max_pares'))
    if not r.get('success'):
        return r.get('error', 'Erro ao comparar funções.')
    pares = r.get('pares', [])
    total = r.get('total_simbolos', 0)
    if not total:
        return ('Nenhuma função indexada. A rotina Duplicados ainda não rodou neste '
                'projeto — peça ao usuário para rodá-la na aba Automação → Rotinas.')
    if not pares:
        return (f'{total} funções indexadas, nenhum par acima de '
                f'{int(limiar * 100)}% de semelhança.')
    out = [f'{len(pares)} par(es) acima de {int(limiar * 100)}% '
           f'(de {total} funções indexadas):']
    for p in pares:
        a, b = p['a'], p['b']
        out.append(f"- {int(p['score'] * 100)}%  {a.get('nome')} "
                   f"({a.get('file')}:{a.get('line')})"
                   f"  ≈  {b.get('nome')} ({b.get('file')}:{b.get('line')})")
    return '\n'.join(out)


def tool_arquivos_grandes(api, project, args):
    """Os arquivos que NÃO CABEM numa chamada de agente do programa.

    ⚠️ O critério não é "os maiores": é passar do teto em token calculado
    contra a janela de contexto configurada, com o prompt vazio (o cenário mais
    generoso possível). Um arquivo listado aqui não cabe em chamada nenhuma.
    """
    r = api.get_arquivos_grandes(project)
    if not r.get('success'):
        return r.get('error', 'Erro ao medir os arquivos.')
    itens = r.get('arquivos') or []
    limite = r.get('limite') or 0
    if not itens:
        return (f'Nenhum arquivo passa do teto de {limite} tokens — todos cabem '
                'numa chamada de agente do programa.')
    teto_lista = _limite(api, 'mcp_arquivos_grandes_max')
    out = [f'{len(itens)} arquivo(s) acima do teto de {limite} tokens '
           '(não cabem numa chamada de agente, então precisam ser divididos):']
    for it in itens[:teto_lista]:
        out.append(f"- {it.get('file')} — {it.get('linhas')} linhas, "
                   f"{it.get('tokens')} tokens")
    if len(itens) > teto_lista:
        out.append(f'... +{len(itens) - teto_lista} não listados.')
    return '\n'.join(out)


def tool_io(api, project, args):
    filtro = (args.get('arquivo') or '').replace('\\', '/').lower()
    r = api.scan_file_io(project)
    if not r.get('success'):
        return r.get('error', 'Erro ao varrer I/O.')
    files = r.get('files', [])
    if filtro:
        files = [f for f in files
                 if filtro in (f.get('relative', '') + '|' + f.get('path', '')).replace('\\', '/').lower()]
    if not files:
        return 'Nenhuma operação de disco encontrada' + (f' para "{args.get("arquivo")}".' if filtro else '.')
    max_arq = _limite(api, 'mcp_io_max_arquivos')
    max_ops = _limite(api, 'mcp_io_max_operacoes')
    out = []
    for f in files[:max_arq]:
        entradas = f.get('entries', [])
        out.append(f"{f.get('relative')} ({f.get('io_count')} operações):")
        for e in entradas[:max_ops]:
            # `alvo` é a expressão do argumento tal como escrita no código, não
            # o caminho final no disco — esse é montado em execução e não existe
            # no texto do programa. Vem junto com a chamada, e não NO LUGAR
            # dela: antes o campo entrava com `or`, então quando ele trazia
            # lixo (`'r'`, `'utf-8'`) o modelo perdia a chamada, que era a
            # informação boa, e ficava só com o lixo.
            alvo = e.get('alvo')
            linha = f"  L{e.get('line')} {e.get('type')}: {e.get('call')}"
            if alvo:
                linha += f"  → alvo: {alvo}"
            out.append(linha)
        # O corte nunca é mudo: sem esta linha o modelo recebe as 30 primeiras
        # operações achando que são todas, e conclui sobre o que não leu.
        if len(entradas) > max_ops:
            out.append(f"  ... +{len(entradas) - max_ops} operações não listadas.")
    if len(files) > max_arq:
        out.append(f'... +{len(files) - max_arq} arquivo(s) não listados.')
    return '\n'.join(out)


# ═══════════════════════════════════════════════════════ Nativas com escopo ══
# ⚠️ As três passam `LEITOR_ASSISTENTE_EXTERNO` aos funis de "quem pode ler".
# É o único ponto do programa que o faz — todo o resto responde pelo LM Studio.

def tool_grep(api, project, args):
    termo = (args.get('termo') or '').strip()
    if not termo:
        return 'Informe o parâmetro "termo".'
    # ⚠️ AUSÊNCIA TEM DE VIRAR `False`, e nunca `None`. O cliente manda `true`/
    # `false` JSON, e `args.get(...)` de um parâmetro que ele não enviou devolve
    # `None` — que é falso em Python, mas não é o mesmo valor, e o motor testa
    # `if palavra_inteira or diferenciar_maiusculas`. `bool()` fecha os dois
    # casos e mantém a assinatura do motor honesta.
    return erro_util(lambda: api._ferr_grep(
        project, termo, pasta=(args.get('pasta') or None),
        palavra_inteira=bool(args.get('palavra_inteira')),
        diferenciar_maiusculas=bool(args.get('diferenciar_maiusculas')),
        quem=LEITOR_ASSISTENTE_EXTERNO))


def tool_ler_arquivo(api, project, args):
    caminho = (args.get('caminho') or args.get('arquivo') or '').strip()
    if not caminho:
        return 'Informe o parâmetro "caminho".'
    return erro_util(lambda: api._ferr_ler_arquivo(
        project, caminho, linhas=(args.get('linhas') or None),
        quem=LEITOR_ASSISTENTE_EXTERNO))


def tool_listar_pasta(api, project, args):
    caminho = args.get('caminho')
    if caminho is None:
        return 'Informe o parâmetro "caminho".'
    return erro_util(lambda: api._ferr_listar_pasta(
        project, caminho, quem=LEITOR_ASSISTENTE_EXTERNO))


