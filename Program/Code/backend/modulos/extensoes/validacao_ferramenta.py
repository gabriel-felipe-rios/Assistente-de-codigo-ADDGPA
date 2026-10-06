"""O item `{"recurso": "ferramenta"}` de um manifesto — ele vale?

Pergunta que este arquivo responde: "esta ferramenta que a extensão declara
pode ser oferecida a um subagente?". Irmã de `validacao_agente.py`, pela
mesma convenção (Arquitetura modular › Convenções › Code: «Validação de um
recurso de extensão que cresce vira irmã de `validacao.py`»).

Uma ferramenta de extensão é chamada pelo modelo como as do programa
(`{"ferramentas": [{"nome": "ler_notas", "parametros": {…}}]}`), e quem a
ATENDE é o backend da extensão, na ação `xt.ferramenta` da porta
`executar(payload)`. O programa só leva o pedido e corta a resposta no teto
de leitura geral (D53) — ver `agentes/ferramentas_subagentes_extensao.py`.

⚠️ Import: nunca importe `descoberta` aqui (fecharia o ciclo
`descoberta → manifesto → validacao → validacao_ferramenta`). O catálogo das
ferramentas do programa e a lista dos subagentes vêm por import TARDIO,
dentro da função: o núcleo dos subagentes lê a camada de extensões, e um
import no topo fecharia o outro ciclo.
"""

import os

from .constantes import (XT_BACKEND_ENTRY, XT_FERRAMENTA_NOME_RE, XT_SUBAGENTE_FONTES,
                         XT_ACAO_FERRAMENTA, caminho_absoluto)


def _texto(item, campo):
    v = item.get(campo)
    return v.strip() if isinstance(v, str) else ''


def nomes_declarados(itens):
    """Os `nome` dos itens `{"recurso": "ferramenta"}` do manifesto CRU.

    Lido antes de conferir item por item (`validacao.ler_formato_novo`),
    para um subagente poder citar em `ferramentas` uma ferramenta que vem
    DEPOIS dele na lista `acrescenta`."""
    return {i['nome'].strip() for i in itens
            if isinstance(i, dict) and i.get('recurso') == 'ferramenta'
            and isinstance(i.get('nome'), str) and i['nome'].strip()}


def validar_item_ferramenta(caminho_relativo, item, rotulo, usados):
    """`(erro, dados, avisos)` do recurso Ferramenta. `dados` é `None` quando o
    item não carrega; `avisos` não impedem o item."""
    from ..agentes.ferramentas_subagentes_constantes import FERRAMENTAS_DESCRICAO
    from ..agentes.execucao.subagentes_constantes import SUBAGENTES_LLM_VALIDOS

    nome = _texto(item, 'nome')
    if not XT_FERRAMENTA_NOME_RE.match(nome):
        return ('%s: o `nome` da ferramenta é o que o modelo escreve — 3 a 40 '
                'letras minúsculas, dígitos e `_`, começando por letra (ex.: '
                '"ler_notas"); veio "%s".' % (rotulo, nome)), None, []
    if nome in FERRAMENTAS_DESCRICAO:
        return ('%s: "%s" já é o nome de uma ferramenta do programa. Escolha outro.'
                % (rotulo, nome)), None, []
    marca = 'ferramenta:' + nome
    if marca in usados['pontos']:
        return '%s: a ferramenta "%s" já foi declarada acima.' % (rotulo, nome), None, []
    devolve, se_errar = _texto(item, 'devolve'), _texto(item, 'se_errar')
    if not devolve or not se_errar:
        return ('%s: a ferramenta precisa de `devolve` e `se_errar` — é o que a '
                'tabela da sub-aba Ferramentas mostra.' % rotulo), None, []
    if not os.path.isfile(os.path.join(caminho_absoluto(caminho_relativo), XT_BACKEND_ENTRY)):
        return ('%s: quem atende a ferramenta é o `backend/extensao.py` (ação "%s"), '
                'e a extensão não tem esse arquivo.' % (rotulo, XT_ACAO_FERRAMENTA)), None, []

    avisos = []
    fonte = _texto(item, 'fonte')
    if fonte and fonte not in XT_SUBAGENTE_FONTES:
        avisos.append('%s: fonte desconhecida "%s" — as que existem são: %s. Ficou de fora.'
                      % (rotulo, fonte, ', '.join(XT_SUBAGENTE_FONTES)))
        fonte = ''

    para = item.get('subagentes_do_programa', [])
    if not isinstance(para, list) or not all(isinstance(p, str) for p in para):
        return ('%s: `subagentes_do_programa` precisa ser uma lista de ids de '
                'subagente do programa.' % rotulo), None, []
    para = [p.strip() for p in para if p.strip()]
    desconhecidos = [p for p in para if p not in SUBAGENTES_LLM_VALIDOS]
    if desconhecidos:
        avisos.append('%s: subagente do programa desconhecido %s — os que existem são: %s. '
                      'Ficou de fora.' % (rotulo, ', '.join('"%s"' % p for p in desconhecidos),
                                          ', '.join(SUBAGENTES_LLM_VALIDOS)))
        para = [p for p in para if p in SUBAGENTES_LLM_VALIDOS]

    usados['pontos'].add(marca)
    return None, {'nome': nome, 'devolve': devolve, 'se_errar': se_errar,
                  'fonte': fonte, 'subagentes_do_programa': para}, avisos
