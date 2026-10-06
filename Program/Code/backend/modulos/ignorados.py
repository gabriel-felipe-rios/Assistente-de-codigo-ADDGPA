"""Regra única de "este caminho está fora?".

Existia em duas cópias byte-a-byte — `indexacao.py::scan_workspace::esta_ignorado`
e o funil do Espelho (retirado em 2026-09; hoje `rotinas_leitura.py::_caminho_ignorado`) — e ia virar uma terceira quando o Resumo
passou a precisar dela. Ficou uma só, aqui, e os dois consumidores chamam esta.

Há dois níveis, e eles não se misturam:

- **Por projeto** — `esta_ignorado` / `esta_em_contexto`, alimentados pela tela
  Projeto. Valem só naquele projeto.
- **Global** — `fora_do_programa` e as três funções abaixo dela, alimentadas por
  `arquivos-que-o-programa-le-nunca-ler.json` (Configurações → "Arquivos que o
  programa lê › Nunca ler"). Valem
  em todos os projetos, e o que cai nelas é tratado como se não existisse —
  inclusive por TODAS as rotinas da Automação desde 23/09/2026: os dois funis
  delas (`rotinas_leitura.py::_caminho_ignorado` e
  `analise_grafo.py::_criar_esta_ignorado`) somam `fora_do_programa` ao
  `Projeto › Remover`.

Dois conjuntos diferentes saem da tela Projeto:

- `ignore_list` (sub-aba **Remover**): itens com `type` (`file`/`folder`) e, nas
  pastas, `recursive` dizendo se pega ou não as subpastas.
- `context_items` (sub-aba **Contexto sem leitura**): só `path` e `description`.
  Sem `type` nem `recursive` — são sempre recursivos, porque a intenção de quem
  marca uma pasta como "não leia" é que nada lá dentro seja lido.

Desde 22/08/2026 cada item das DUAS listas carrega também um `quem_pode_ler`,
que abre uma exceção para um dos dois leitores. Os quatro valores estão em
`QUEM_PODE_LER_VALORES`, e o padrão é `ninguem` — que é exatamente o
comportamento de antes do campo existir.

⚠️ **Ausência do campo é o padrão, e nada migra o arquivo.** Um `Workspace.json`
gravado antes disto continua se comportando igual, item por item, porque
`pode_ler` lê com `.get()` e cai em `ninguem`.

⚠️ **`quem` é opcional nas duas funções abaixo, e o padrão é `None` de
propósito**: `None` significa "ninguém está perguntando, some com tudo", que é
o que o PROGRAMA quer quando conta arquivos, mede complexidade ou monta o
grafo. Quem representa um leitor — o funil das rotinas, os dos subagentes, o
servidor MCP — passa o leitor explicitamente.
"""

# Os dois leitores. Os ids são os MESMOS já usados no `data-destino` dos cards
# de rotina (`lmstudio`, `externo`), e não nomes novos: é o mesmo par de
# consumidores, e duas grafias para a mesma coisa seria uma tradução a mais
# para alguém manter.
LEITOR_LM_STUDIO = 'lmstudio'
LEITOR_ASSISTENTE_EXTERNO = 'externo'

QUEM_PODE_LER_PADRAO = 'ninguem'
QUEM_PODE_LER_VALORES = (QUEM_PODE_LER_PADRAO, LEITOR_LM_STUDIO,
                         LEITOR_ASSISTENTE_EXTERNO, 'ambos')


def pode_ler(item, quem):
    """True se `quem` tem permissão de ler este item da lista.

    `quem` é `LEITOR_LM_STUDIO`, `LEITOR_ASSISTENTE_EXTERNO`, ou `None` para
    "ninguém" — ver o aviso no cabeçalho. Valor desconhecido no arquivo cai no
    padrão em silêncio: é dado do usuário, e derrubar a varredura inteira por
    causa de uma letra trocada seria pior que ignorar a exceção.
    """
    if not quem:
        return False
    valor = (item or {}).get('quem_pode_ler') or QUEM_PODE_LER_PADRAO
    if valor not in QUEM_PODE_LER_VALORES:
        valor = QUEM_PODE_LER_PADRAO
    return valor == 'ambos' or valor == quem

import os


def esta_ignorado(path, ignore_list, quem=None):
    """True se `path` cai em algum item de `ignore_list` (sub-aba Remover).

    O item deixa de valer para quem ele libera: com `quem='externo'`, uma pasta
    removida mas marcada "só o assistente externo" responde False — para esse
    leitor ela não está removida.
    """
    for item in ignore_list or []:
        ip = item['path']
        if item['type'] == 'file':
            casou = (path == ip)
        elif item.get('recursive', True):
            casou = (path == ip or path.startswith(ip + os.sep))
        else:
            casou = (path == ip)
        if casou and not pode_ler(item, quem):
            return True
    return False


def esta_em_contexto(path, context_items, quem=None):
    """True se `path` cai em algum item de `context_items` (Contexto sem leitura).

    Sempre recursivo: item de contexto não tem `recursive` para consultar, e uma
    pasta marcada como "sem leitura" vale para tudo que está dentro dela.

    Mesma exceção de `esta_ignorado`: para o leitor que o item libera, ele não
    está "sem leitura" — responde False, e o arquivo é lido como qualquer outro.
    """
    for item in context_items or []:
        ip = item.get('path')
        if not ip:
            continue
        if (path == ip or path.startswith(ip + os.sep)) and not pode_ler(item, quem):
            return True
    return False


# ═════════════════════════ O que o programa nem enxerga (global)
# Estas quatro NÃO consultam `ignore_list`: são o nível de cima, o que vale para
# todos os projetos de uma vez. Um caminho que cai aqui não entra em lugar
# nenhum — nem no "Resumo completo", que existe justamente para não esconder
# nada do projeto. É a diferença entre "removido deste projeto" e "isto não é
# projeto": `node_modules` não é código de ninguém.
#
# ⚠️ Comparação EXATA, sensível a maiúsculas. Não normalize a caixa nos nomes:
# o usuário decidiu que quer poder deixar uma variação de fora de propósito, e
# cada variação é uma entrada explícita na lista. Quem gera as variações a
# partir do que ele digitou é a tela (`config-extensoes.js`), não este módulo.
# Extensão é o único caso em que a caixa some, porque ali ela não significa nada.
#
# ⚠️ `hashes.py::_hs_scan` continua SEM o filtro de extensão das rotinas, e é
# de propósito: está escrito lá por quê — um `.ps1` alterado que passasse
# despercebido ali some do radar do ciclo inteiro. Mas ele RESPEITA "Nunca ler"
# e `Projeto › Remover` (passa pelo funil das rotinas): o que está em "Nunca
# ler" não é processado por rotina nenhuma, então não ver a mudança dele não
# esconde nada.

def _config():
    """As listas globais. Import preguiçoso para não fechar ciclo com constantes."""
    try:
        from modulos.configuracoes import ler_extensoes
        return ler_extensoes()
    except Exception:
        return {'pastas_ignoradas': [], 'arquivos_ignorados': [],
                'extensoes_ignoradas': []}


def pasta_ignorada_por_nome(path):
    """True se QUALQUER segmento do caminho tem um nome da lista de pastas.

    Recursivo por natureza: a regra é por nome, não por caminho, então pega
    `node_modules` em qualquer profundidade e tudo que está dentro dele.
    """
    nomes = _config()['pastas_ignoradas']
    if not nomes:
        return False
    partes = path.replace('/', os.sep).split(os.sep)
    return any(parte in nomes for parte in partes if parte)


def arquivo_ignorado_por_nome(path):
    """True se o nome do arquivo (com extensão) está na lista."""
    return os.path.basename(path) in _config()['arquivos_ignorados']


def extensao_ignorada(path):
    """True se a extensão do arquivo está na lista."""
    ext = os.path.splitext(path)[1].lower()
    return bool(ext) and ext in _config()['extensoes_ignoradas']


def fora_do_programa(path):
    """As três juntas — é esta que os consumidores chamam.

    As três listas são exclusivas entre si (pasta por nome, arquivo por nome,
    extensão), então basta uma delas dizer sim.
    """
    return (pasta_ignorada_por_nome(path)
            or arquivo_ignorado_por_nome(path)
            or extensao_ignorada(path))

