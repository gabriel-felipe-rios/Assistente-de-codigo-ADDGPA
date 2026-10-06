"""Exceções de «Arquivos que o programa lê» — o que cada parte acrescenta e retira.

A terceira vista gravada de Configurações › Arquivos que o programa lê, desde a
fase 06 da obra «Qualidade da documentação e termos do Glossário» (2026-09). Até
ali ela era Quem lê o quê, e a Documentação Técnica e as duas buscas visuais
tinham uma LISTA PRÓPRIA inteira. O usuário pediu o contrário: «posso ter coisa
que eu queira colocar, posso ter coisa que eu queira retirar… tem que ter uma
separação clara» (D39). Hoje cada parte PARTE de uma lista (a base) e guarda só
a diferença:

| Parte | Base (de onde parte) | Quem lê a lista final |
|---|---|---|
| `documentacao_tecnica` | a lista de código (O que é código) | `rotinas_config.lista_das_rotinas` |
| `busca_visual_codigo` | a lista de fábrica da Aparência, sem as imagens | `configuracoes_aparencia.ler_extensoes_aparencia` |
| `busca_visual_imagens` | a lista de fábrica de imagens da Aparência | idem |
| `busca_de_usos` | `EXTENSOES_DA_BUSCA_DE_USOS`, logo abaixo | `indexacao.find_symbol_usages` |

A lista final é sempre `aplicar_excecao(base, excecao)`: a base menos o
`retirar`, mais o `acrescentar`. De fábrica, a Documentação Técnica já traz
exceções — as que reproduzem a lista própria de antes (ver `padrao_excecoes`).

⚠️ `agentes.binarios_liberados` VIAJA JUNTO e não tem tela. É o furo antigo do
`grep` dos subagentes (`excecao_de(ext, 'agentes')`), que a linha "Agentes"
de Quem lê o quê deixou só leitura em 23/09/2026. Fica guardado para não se
perder o que alguém tenha escrito à mão no arquivo.

⚠️ ESTE MÓDULO NÃO IMPORTA `configuracoes_extensoes` NO TOPO. É o contrário:
lá se importa daqui no topo, e daqui de lá só dentro das funções — senão o
ciclo fecha na carga e o programa não abre.
"""

PARTES_DAS_EXCECOES = ('documentacao_tecnica', 'busca_visual_codigo',
                       'busca_visual_imagens', 'busca_de_usos')

# A base da Busca de usos. Era `TEXT_EXTS`, escrito dentro de
# `indexacao.find_symbol_usages`; saiu de lá para a tela poder mostrar de onde
# a parte parte. "Onde um símbolo pode APARECER?": as linguagens que o índice
# de símbolos extrai, mais .html e .css (classe e id citados na marcação e no
# estilo); .rb/.php/.swift ficam de fora porque o índice não os extrai.
# ⚠️ NÃO UNIFICAR com a lista de código nem com `CODE_EXTS` (analise.py) —
# ver `agentes/cobertura.py::_COB_EXT_GRAFO`.
EXTENSOES_DA_BUSCA_DE_USOS = (
    '.py', '.js', '.jsx', '.ts', '.tsx', '.mts', '.cts', '.cs', '.java', '.go',
    '.rs', '.c', '.cpp', '.cc', '.h', '.hpp', '.html', '.css',
)


def padrao_excecoes():
    """De fábrica: o que se lia antes desta fase continua sendo lido (D48).

    ⚠️ A DOCUMENTAÇÃO TÉCNICA NÃO NASCE VAZIA. Até a fase 06 ela lia a lista
    própria de fábrica (`rotinas_config.EXTENSOES_DA_DOCUMENTACAO`), e o que
    era a lista própria vira as exceções dela — também na fábrica. O que a
    lista própria tinha a mais que a lista de código vira `acrescentar`
    (`.psm1`, `.env`); a menos, nada. As linguagens que a D41 pôs na lista de
    código (`.astro`, `.dart`, `.lua`, `.jsonc`…) NÃO viram `retirar`: a
    Documentação Técnica parte da lista de código justamente para lê-las.

    As outras três partes nascem sem exceção: a base delas JÁ É a lista de
    fábrica que elas liam (as duas da Aparência e o conjunto da Busca de usos).
    """
    saida = {parte: {'acrescentar': [], 'retirar': []} for parte in PARTES_DAS_EXCECOES}
    # Literal: a lista própria de fábrica menos a lista de código de fábrica de ANTES da D41 (fase 06, 2026-09), que não existe mais no código.
    saida['documentacao_tecnica'] = {'acrescentar': ['.psm1', '.env'], 'retirar': []}
    saida['agentes'] = {'binarios_liberados': []}
    return saida


def base_da_parte(parte, codigo=None):
    """A lista de onde a parte parte, HOJE.

    `codigo` é a vista O que é código já lida; `None` a lê de novo. Quem está
    DENTRO de `configuracoes_extensoes._vistas()` tem de passar, senão a
    leitura volta para lá e não termina.
    """
    if parte == 'documentacao_tecnica':
        from .configuracoes_extensoes import lista_de_codigo
        return lista_de_codigo(codigo)
    if parte in ('busca_visual_codigo', 'busca_visual_imagens'):
        # Normalizada: é ela que tira de `codigo` o que também está em
        # `imagens` (o `.svg`) — a base que a tela mostra é a que vale.
        from .configuracoes_aparencia import (padrao_extensoes_aparencia,
                                              _normalizar_extensoes_aparencia)
        visual = _normalizar_extensoes_aparencia(padrao_extensoes_aparencia())
        return list(visual['codigo' if parte == 'busca_visual_codigo' else 'imagens'])
    if parte == 'busca_de_usos':
        return list(EXTENSOES_DA_BUSCA_DE_USOS)
    raise KeyError('parte desconhecida: %s' % parte)


def bases_das_excecoes(codigo=None):
    """As quatro bases, para a tela mostrar o "Parte de"."""
    return {parte: base_da_parte(parte, codigo) for parte in PARTES_DAS_EXCECOES}


def aplicar_excecao(base, excecao):
    """A lista final: a base menos o `retirar`, mais o `acrescentar`, sem repetir."""
    fora = set(excecao.get('retirar') or [])
    saida = [ext for ext in base if ext not in fora]
    for ext in excecao.get('acrescentar') or []:
        if ext not in saida:
            saida.append(ext)
    return saida


def lista_da_parte(parte):
    """O que a parte lê hoje. Levanta se a leitura falhar — quem chama tem a
    reserva dele (a lista de fábrica)."""
    from .configuracoes_extensoes import ler_excecoes
    return aplicar_excecao(base_da_parte(parte), ler_excecoes()[parte])


def _normalizar_excecoes(dados, codigo=None):
    """A vista Exceções a partir do que estiver gravado. Nunca levanta por
    dado ruim: o que não tem forma válida vira "sem exceção".

    Entende DUAS formas, e é isto que faz a migração (D48):
      · a de hoje — cada parte com `acrescentar` e `retirar`;
      · a de Quem lê o quê, até a fase 06 — a Documentação Técnica com `modo`
        e `extensoes` (a lista própria), as duas buscas visuais com
        `extensoes`, e a Busca de usos com `acrescentar` e `tirar`.
    Da lista própria sai a diferença para a base: o que ela tinha a mais vira
    `acrescentar`, o que tinha a menos vira `retirar`. No modo
    `igual_a_lista_de_codigo` não há diferença nenhuma.

    `codigo`: ver `base_da_parte`.
    """
    from .configuracoes_extensoes import _lista_de_ext
    dados = dados if isinstance(dados, dict) else {}
    saida = {}
    for parte in PARTES_DAS_EXCECOES:
        secao = dados.get(parte)
        if not isinstance(secao, dict) and parte == 'documentacao_tecnica':
            # O nome da chave até o Espelho sair (2026-09).
            secao = dados.get('espelho_e_documentacao_tecnica')
        secao = secao if isinstance(secao, dict) else {}
        if 'extensoes' in secao and 'acrescentar' not in secao and 'retirar' not in secao:
            if secao.get('modo') == 'igual_a_lista_de_codigo':
                acrescentar, retirar = [], []
            else:
                propria = _lista_de_ext(secao.get('extensoes')) or []
                base = base_da_parte(parte, codigo)
                acrescentar = [ext for ext in propria if ext not in base]
                retirar = [ext for ext in base if ext not in propria]
        else:
            acrescentar = _lista_de_ext(secao.get('acrescentar')) or []
            # `tirar` era o nome deste lado na Busca de usos, até a fase 06.
            bruto = secao['retirar'] if 'retirar' in secao else secao.get('tirar')
            retirar = _lista_de_ext(bruto) or []
        # A mesma extensão nos dois lados não diz nada: vale o acrescentar.
        retirar = [ext for ext in retirar if ext not in acrescentar]
        saida[parte] = {'acrescentar': acrescentar, 'retirar': retirar}
    agentes = dados.get('agentes') if isinstance(dados.get('agentes'), dict) else {}
    saida['agentes'] = {'binarios_liberados':
                        _lista_de_ext(agentes.get('binarios_liberados')) or []}
    return saida
