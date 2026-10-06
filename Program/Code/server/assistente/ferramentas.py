"""Os handlers das 19 ferramentas de código/navegação do servidor MCP Assistente.

Cada ferramenta é uma função `handler(api, project, args) -> str` que devolve
texto pronto para o assistente externo. Reaproveita os métodos de leitura da
classe `Api` (todos puros — não precisam da janela do pywebview).

⚠️ **A LISTA não mora aqui.** Nome, descrição, schema e metadados de cada
ferramenta estão em `backend/modulos/catalogo_mcp.py`, que é a fonte única —
a mesma lida pela aba Arquivos → MCPs e por `arquivos.py`. Aqui ficam só as
FUNÇÕES, e o `TOOLS` do fim do arquivo casa uma coisa na outra pelo campo
`fn_name`.

Acrescentar uma ferramenta: escreva o handler aqui e a entrada lá (com
`'servidor': 'assistente'`). Esquecer um dos dois falha alto, na montagem do
`TOOLS`, e não em silêncio.

⚠️ **Os `_ferr_*` da `Api` levantam `ValueError` com a mensagem pensada para o
modelo ler** ("está fora do escopo deste projeto. As pastas de trabalho são…").
O `servidor.py` embrulha qualquer exceção num `Erro na ferramenta X: …`, que
perde essa redação. Por isso os handlers que os chamam capturam `ValueError` e
devolvem `str(e)` — ver `comum.erro_util`.
"""
# ── Este arquivo era 584 linhas, e virou quatro ─────────────────────────────
#
# Pelo teto de 500 da AMF. Cada um responde uma pergunta:
#
#   ferramentas.py         a montagem final: catálogo × handler
#   ferramentas_apoio.py   o `sys.path`, os cortes e o casamento de arquivo
#   ferramentas_codigo.py  onde está, quem usa, quem importa
#   ferramentas_docs.py    o que as rotinas escreveram, e a leitura crua
#
# ⚠️ O `import *` DOS DOIS ARQUIVOS DE HANDLER NÃO É PREGUIÇA: `montar_tools`
# procura cada `fn_name` do catálogo dentro de `globals()` DESTE módulo. Um
# import seletivo que esquecesse um handler faria a montagem estourar com o nome
# da ferramenta — alto, e não em silêncio, que é o que se quer —, mas o `*`
# mantém a regra "escreveu o handler, ele entra" valendo como antes da divisão.

from ferramentas_apoio import *  # noqa: F401,F403
from ferramentas_apoio import montar_tools, CATALOGO_MCP  # noqa: E402
from ferramentas_codigo import *  # noqa: F401,F403
from ferramentas_docs import *  # noqa: F401,F403


# ══════════════════════════════════════════════════════════ A montagem final ══
# `TOOLS` é o catálogo (só as 19 com `servidor: 'assistente'`) com o handler
# colado. Uma entrada cujo `fn_name` não exista aqui estoura NA IMPORTAÇÃO, com
# o nome da ferramenta na mensagem — e não depois, na primeira chamada, com um
# `KeyError` mudo.
_CATALOGO_ASSISTENTE = [f for f in CATALOGO_MCP if f['servidor'] == 'assistente']
TOOLS = montar_tools(_CATALOGO_ASSISTENTE, globals())
