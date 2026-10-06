"""O chão dos handlers: o `sys.path`, os cortes e o casamento de nome de arquivo.

Arquivo próprio porque `ferramentas.py` passou a ser a MONTAGEM (ele importa os
handlers e cola no catálogo), e os dois arquivos de handler precisam destes
ajudantes — importá-los de lá fecharia um ciclo.

⚠️ O `sys.path` É RESOLVIDO AQUI, e é o que torna a família importável sozinha.
O `servidor.py` só põe `backend/` e `server/` no caminho DEPOIS de importar
estes módulos.

⚠️ `LEITOR_ASSISTENTE_EXTERNO` É QUEM RESPONDE PELOS FUNIS DE "QUEM PODE LER".
É o que faz um arquivo marcado "só o assistente externo" aparecer para o
`grep`/`ler_arquivo`/`listar_pasta` do MCP e continuar sumido para o chat
interno. Passar o valor errado não dá erro nenhum — só devolve a lista do outro
leitor.

⚠️ `_AVISO_BASE_DE_IDENTIFICADORES` É TEXTO NA RESPOSTA, E NADA MAIS. As três
ferramentas de uso continuam lendo SÓ o Índice de Identificadores; as duas bases
estão separadas por escolha de projeto, e fazer qualquer uma delas ler o grafo
desfaz essa escolha.
"""

import os
import sys

# O catálogo e o `comum.py` moram um nível acima (backend/ e server/,
# respectivamente); o `servidor.py` só põe os dois no `sys.path` depois de
# importar este módulo. Resolver aqui deixa este arquivo importável sozinho.
_SERVER_DIR = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
if _SERVER_DIR not in sys.path:
    sys.path.insert(0, _SERVER_DIR)

_BACKEND = os.path.normpath(os.path.join(_SERVER_DIR, '..', 'backend'))
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

from comum import erro_util, montar_tools  # noqa: E402
from modulos.catalogo_mcp import CATALOGO_MCP  # noqa: E402

# O mesmo helper de sugestões que o `grafo_imports` e o `pipeline` usam quando
# uma parte não existe. Reusá-lo aqui é o que faz o erro de nome do `me_usam`
# ter a mesma cara — mesmo corte, mesmo formato, mesmo rodapé.
from modulos.agentes import partes_artefato  # noqa: E402

# Quem responde pelo assistente externo nos funis de "quem pode ler" (Obra 2).
# ⚠️ É o que faz um arquivo marcado "só o assistente externo" aparecer para o
# `grep`/`ler_arquivo`/`listar_pasta` do MCP e continuar sumido para o chat
# interno. Passar o valor errado aqui não dá erro nenhum — só devolve a lista
# do outro leitor.
from modulos.ignorados import LEITOR_ASSISTENTE_EXTERNO  # noqa: E402


# ⚠️ A REDAÇÃO NÃO FOI INVENTADA AQUI. É a condensação da seção "O que torna
# `eu_uso`, `me_usam` e `relacoes_uso` diferentes de um grep", do
# `Arquivos/MCPs/Assistente/README.md`, que já lista com estas palavras
# o que estas três enxergam e um grafo de imports não.
#
# ⚠️ ISTO É TEXTO NA RESPOSTA, E NADA MAIS. As três continuam lendo SÓ o Índice
# de Identificadores. As duas bases estão separadas por escolha de projeto —
# fazer qualquer uma delas ler o grafo desfaz essa escolha.
_AVISO_BASE_DE_IDENTIFICADORES = (
    '\n\n(esta base casa MENÇÃO DE IDENTIFICADOR, e não `import`: função global '
    'JS definida num arquivo e chamada em outro, ponte `window.pywebview.api.X` '
    "↔ `def X`, ponte `evaluate_js('nomeCallback')` ↔ `function nomeCallback`, "
    'ID ou classe declarada no HTML e lida no JS, chave de dicionário escrita no '
    'Python e lida pelo nome no JS. Para quem importa quem, a ferramenta é '
    '`grafo_imports`.)')


def _match_arquivo(api, project, arquivo):
    """Casa o texto informado com uma chave de arquivo indexada do projeto.

    Devolve `(chave, recado)`. Enquanto casa, `recado` é `None` e o handler
    segue em frente. Quando NÃO casa com nada, o `recado` já vem escrito, com os
    arquivos indexados mais parecidos, e o handler devolve isso em vez de
    consultar as relações.

    ⚠️ **É PARA ISSO QUE O SEGUNDO VALOR EXISTE.** Antes esta função devolvia o
    texto cru quando nada casava, e o handler seguia adiante: `get_relacoes` de
    um caminho inexistente devolve lista vazia, e a resposta saía "ninguém usa
    (ou o índice de identificadores não foi gerado)" — **a mesma frase** que um
    arquivo real e órfão recebe. Um erro de digitação virava um fato sobre o
    projeto, e nada no texto deixava distinguir um do outro.
    """
    arquivo = (arquivo or '').replace('\\', '/').strip()
    keys = []
    try:
        r = api.list_arquivos_indexados(project)
        keys = r.get('arquivos') or r.get('files') or r.get('itens') or []
    except Exception:
        keys = []
    if not keys or not arquivo:
        # Sem índice não dá para AFIRMAR que não casou — e a resposta do handler
        # já ressalva "ou o índice de identificadores não foi gerado", que é
        # exatamente o certo neste caso. Sem `arquivo`, quem cobra o parâmetro é
        # o handler.
        return arquivo, None
    alvo = arquivo.lower()
    for k in keys:
        if k.replace('\\', '/').lower() == alvo:
            return k, None
    cands = [k for k in keys if k.replace('\\', '/').lower().endswith(alvo)]
    if not cands:
        cands = [k for k in keys if alvo in k.replace('\\', '/').lower()]
    if cands:
        return cands[0], None
    return arquivo, (
        f'"{arquivo}" não está no Índice de Identificadores deste projeto. '
        'Isso NÃO quer dizer que ninguém o usa — quer dizer que ele não foi '
        'indexado: confira a grafia, ou veja se o arquivo está fora das pastas '
        'de trabalho marcadas pelo usuário.\n'
        + partes_artefato.sugestoes(keys, alvo, rotulo='Arquivos indexados',
                                    como_ver_todas='veja a aba Relações'))


def _limite(api, chave):
    """Um limite da categoria Configurações → Servidores MCP do programa."""
    return api._mcp_limite(chave)


def _cortar(api, texto, teto_tokens):
    """Corta em TOKEN e diz quanto ficou de fora — nunca corta calado.

    ⚠️ O corte mudo é o pior dos dois mundos: quem recebe um pedaço achando que
    é o todo conclui com confiança sobre o que não leu. Mesmo princípio de
    `_sub_cortar_avisando`, do lado dos subagentes.
    """
    from modulos.tokens import contar_tokens, cortar_em_tokens
    if not texto:
        return texto
    tk = contar_tokens(texto)
    if tk <= teto_tokens:
        return texto
    return (cortar_em_tokens(texto, teto_tokens)
            + f'\n\n(cortado no teto de {teto_tokens} tokens — ficaram de fora '
              f'{tk - teto_tokens} tokens. O teto está em Configurações → '
              f'Servidores MCP do programa.)')


# ══════════════════════════════════════════ Determinísticas (saem de índice) ══

def _caminho_colavel(s):
    """O caminho de um símbolo no dialeto do resto do MCP: `Program/Code/…`.

    O índice guarda `folder` (o caminho ABSOLUTO da pasta de trabalho) e
    `relative` (o resto, com a barra do Windows). Sozinho, o `relative` saía
    `Code\\backend\\modulos\\analise.py` — contrabarra, e sem o prefixo — e não
    colava em `ler_arquivo`, que fala `Program/Code/…` como todo o resto do
    servidor. Uma ferramenta cujo resultado não entra na outra obriga o
    assistente a adivinhar o caminho, que é justamente o que o índice existe
    para poupar.

    ⚠️ É **FORMATAÇÃO, NÃO INDEXAÇÃO**: nada é recalculado e nenhum arquivo é
    aberto. A linha continua sendo a que o índice registrou.

    ⚠️ Se `folder` vier vazio, cai no comportamento de antes em vez de estourar:
    uma exceção aqui derrubaria a ferramenta inteira por causa de um item.
    """
    rel = (s.get('relative') or '').replace('\\', '/')
    folder = s.get('folder') or ''
    prefixo = os.path.basename(os.path.normpath(folder)) if folder else ''
    return f'{prefixo}/{rel}' if prefixo else rel


