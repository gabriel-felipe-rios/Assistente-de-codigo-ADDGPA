"""A casca: o endereço único que todos os handlers importam.

Os handlers fazem `import leitura as L` e chamam `L.Escopo`, `L.artefato`,
`L.cortar`, `L.servir_partes`, `L.TETO_PARTE`. Este arquivo é o que mantém esse
endereço estável enquanto o conteúdo mora em dois irmãos, cada um com a sua
pergunta:

| Arquivo | A pergunta dele |
|---|---|
| `leitura_dados.py` | **onde os dados moram**, e o que o usuário tirou do escopo |
| `formato.py` | **cabe na janela?** — os tetos, os limites e as partes |

⚠️ **O `import *` É O QUE PRESERVA O ENDEREÇO PÚBLICO.** Trocá-lo por import
seletivo obrigaria a mexer aqui a cada constante nova de `formato.py`, e o
sintoma de esquecer seria um `AttributeError` na primeira chamada da ferramenta
que a usasse. Nome começado com `_` não é levado — e nenhum deles é usado de fora.

⛔ **Nada neste servidor importa o programa.** Nem `api.py`, nem `modulos/`, nem
`caminhos.py`. Ver o cabeçalho de `leitura_dados.py` para o porquê e para o preço.
"""

from leitura_dados import *   # noqa: F401,F403
from formato import *         # noqa: F401,F403
