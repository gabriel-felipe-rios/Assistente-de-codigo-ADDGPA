"""O registro de leitores por tipo de interface.

Outra linguagem entra acrescentando um `ct_leitor_{tipo}.py` com
`aceita`/`ler` e uma linha em `LEITORES` — nada mais muda.

Todo leitor expõe as mesmas duas funções:
- `aceita(arquivo_inicial) -> bool` — este leitor sabe ler um projeto que
  começa por este arquivo?
- `ler(raiz, arquivo_inicial, arquivos, prefs) -> {'telas': [...], 'ligacoes': [...]}`
  — `arquivos` é o conjunto de páginas (caminhos absolutos), `prefs` as opções
  da página em Configurações. O formato das telas e ligações está em
  `ct_acoes.ler`.
"""

from . import ct_leitor_site

LEITORES = [ct_leitor_site]


def escolher(arquivo_inicial):
    """O primeiro leitor que aceita o arquivo, ou `None`."""
    for leitor in LEITORES:
        if leitor.aceita(arquivo_inicial):
            return leitor
    return None
