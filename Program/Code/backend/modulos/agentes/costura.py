"""Partes e costura: o que fazer quando a entrada de uma rotina não cabe numa
chamada.

O orçamento é medido antes; cabendo, não há partes nem costura. Não cabendo, a
entrada vira partes do tamanho do teto de entrada (D31), e uma chamada final
costura os resultados — em rodadas, se nem os resultados couberem numa costura
("a costura da costura"). Usado pela Documentação Técnica e pelo Resumo de
Pastas.

⚠️ Sem IA aqui dentro: quem chama o modelo é quem usa estas funções, pelo
`chamar` que passa a `costurar`. Assim a regra de partir e de juntar é uma só
para as duas rotinas, e cada uma continua dona do próprio prompt e esquema.

⚠️ A costura NÃO é retentativa: é a etapa 2 de quem não coube. Nenhuma chamada
aqui repete outra que falhou.
"""

from modulos.tokens import contar_tokens


def partir_em_linhas(linhas, limite_tokens, cortes_preferidos=()):
    """As partes de um arquivo: `[(inicio, fim), ...]`, 1-based e inclusivas.

    Cobrem o arquivo inteiro, cada uma com no máximo `limite_tokens` (somando
    os tokens de cada linha). Ao estourar, a parte volta até o último corte
    preferido dentro dela — as linhas onde começa um símbolo —, para não partir
    uma função ao meio; sem nenhum, corta na linha anterior à que estourou.

    Uma linha sozinha maior que o limite vira uma parte só: melhor uma parte
    grande que um laço que nunca termina.
    """
    total = len(linhas)
    if total == 0:
        return []
    limite = max(1, int(limite_tokens))
    custos = [contar_tokens(linha) + 1 for linha in linhas]   # +1: o fim de linha
    preferidos = set(cortes_preferidos or ())
    partes = []
    inicio = 1
    while inicio <= total:
        fim, soma = inicio - 1, 0
        while fim < total and soma + custos[fim] <= limite:
            soma += custos[fim]
            fim += 1
        if fim < inicio:
            fim = inicio
        elif fim < total:
            candidatos = [p for p in preferidos if inicio < p <= fim]
            if candidatos:
                fim = max(candidatos) - 1
        partes.append((inicio, fim))
        inicio = fim + 1
    return partes


def costurar(itens, chamar, formatar, limite_tokens, rodada=None):
    """Junta os resultados das partes num só, chamando o modelo o mínimo.

    `itens` — o que cada parte devolveu (dicionários, na ordem do arquivo; as
    chaves `_inicio`/`_fim` dizem as linhas que o item cobre, quando houver).
    `formatar(item, n, total)` — o texto do bloco de um item.
    `chamar(blocos)` — recebe a lista de textos de um grupo e devolve o
    dicionário costurado.
    `rodada(n, final)` — opcional: chamado no começo de cada rodada, com o número dela e se é a última (D7).

    Enquanto houver mais de um item, agrupa os consecutivos de modo que os
    blocos de cada grupo caibam em `limite_tokens`; grupo de um item só passa
    adiante sem chamada. Se o agrupamento não reduziu nada (cada bloco sozinho
    já enche o limite), força grupos de dois. O item costurado herda as linhas
    do primeiro e do último do grupo.

    Exemplo: um arquivo que virou 12 partes cujos 12 papéis não cabem numa
    costura → 3 costuras de 4 → 1 costura final com os 3 resultados.
    """
    itens = [dict(i) for i in itens]
    if not itens:
        return {}
    n_rodada = 0
    while len(itens) > 1:
        total = len(itens)
        n_rodada += 1
        blocos = [formatar(item, n, total) for n, item in enumerate(itens, 1)]
        custos = [contar_tokens(b) for b in blocos]
        grupos, atual, soma = [], [], 0
        for idx, custo in enumerate(custos):
            if atual and soma + custo > limite_tokens:
                grupos.append(atual)
                atual, soma = [], 0
            atual.append(idx)
            soma += custo
        if atual:
            grupos.append(atual)
        if len(grupos) == total:
            grupos = [list(range(i, min(i + 2, total))) for i in range(0, total, 2)]
        # D7: a tela mostra «costurando · rodada N». É a última quando sobra
        # um grupo só — antes disso o total de rodadas não se sabe.
        if rodada:
            rodada(n_rodada, len(grupos) == 1)
        novos = []
        for grupo in grupos:
            if len(grupo) == 1:
                novos.append(itens[grupo[0]])
                continue
            costurado = dict(chamar([blocos[i] for i in grupo]) or {})
            costurado.setdefault('_inicio', itens[grupo[0]].get('_inicio'))
            costurado.setdefault('_fim', itens[grupo[-1]].get('_fim'))
            novos.append(costurado)
        itens = novos
    return itens[0]


def texto_da_rodada(n, final):
    """O texto da fase durante a costura (D7): «costurando» quando ela é uma
    rodada só; «costurando · rodada N» enquanto não é a última; «costurando ·
    rodada N de N» na última, quando houve mais de uma."""
    if final and n == 1:
        return 'costurando'
    if final:
        return 'costurando · rodada %d de %d' % (n, n)
    return 'costurando · rodada %d' % n
