"""A porta da extensão Subagentes normativos. Lê payload['acao'] e roteia.

As três ações que chegam aqui são do PROGRAMA, não de uma tela (a extensão
não tem frontend) — ver o contrato, `Como criar extensões.md`, parte 11:
  - `xt.ferramenta`: a `ler_base` que um subagente chamou;
  - `xt.prompt`: o texto que ela acrescenta ao prompt do Chat e da Fila;
  - `xt.envelope`: os arquivos da base que cada subagente recebe junto da
    pergunta.
"""

from . import norm_acoes


def executar(payload):
    acao = (payload or {}).get('acao')

    if acao == 'xt.ferramenta':
        return norm_acoes.ferramenta(payload)
    if acao == 'xt.prompt':
        return norm_acoes.prompt(payload)
    if acao == 'xt.envelope':
        return norm_acoes.envelope(payload)

    return {'success': False, 'error': 'ação desconhecida: %r' % acao}
