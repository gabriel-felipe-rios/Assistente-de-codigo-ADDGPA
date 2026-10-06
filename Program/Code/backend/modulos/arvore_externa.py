"""A árvore de uma pasta de `Program/External/` — a peça comum de Plugins,
Launchers e Extensões do programa.

Os três recursos plugáveis do programa leem uma pasta de `External/` do mesmo
jeito: descem a árvore, tratam uma pasta como CATEGORIA (organização pura) ou
como FOLHA (o recurso em si), guardam o estado de cada folha num JSON de
`Internal/config/` chaveado pelo caminho relativo, e aplicam por cima a ordem
que o usuário arrastou.

Até 04/09/2026 esse código existia DUAS vezes — `plugins.py` e
`atalhos_externos.py` tinham cinco pares de funções quase idênticas. Extensões
seria a terceira cópia de cada uma. As cinco moram aqui agora, e os dois
módulos antigos passaram a importá-las: nenhum comportamento mudou.

⚠️ **O que decide o que é folha NÃO mora aqui.** Cada sistema tem o seu
critério — Plugin é uma pasta com `plugin.json`,
Extensão é uma pasta com `extensao.json`, Launcher é qualquer ARQUIVO — e por
isso `escanear_nivel` e `montar_no` recebem a função `eh_folha` como
parâmetro. Do mesmo jeito, quem enriquece cada folha com os campos daquele
sistema (`ligado`, `tipos`, `icone`…) é o próprio sistema, via `montar_folha`:
este módulo devolve a árvore, nunca o conteúdo de uma folha.
"""

import os
import json

from .constantes import CONFIGS_DIR


def ler_json_de_config(nome_arquivo, exigir_dicionario=False):
    """Lê um JSON de `Internal/config/` — `{}` se não existir, se o disco
    recusar ou se o conteúdo estiver corrompido.

    Devolver `{}` em vez de lançar é deliberado: um arquivo de estado
    corrompido não pode impedir a lista inteira de pintar. O usuário vê tudo
    desligado (o padrão de fábrica) em vez de uma tela vazia sem explicação.

    `exigir_dicionario` existe para os arquivos de ORDEM, que são sempre um
    mapa `{pasta: [nomes]}`: um JSON válido mas com uma lista no topo viraria
    um `.get` em lista logo adiante.
    """
    caminho = os.path.join(CONFIGS_DIR, nome_arquivo)
    if not os.path.exists(caminho):
        return {}
    try:
        with open(caminho, 'r', encoding='utf-8') as f:
            dado = json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}
    if exigir_dicionario and not isinstance(dado, dict):
        return {}
    return dado


def gravar_json_de_config(nome_arquivo, dado):
    """Grava um JSON em `Internal/config/`, criando a pasta se preciso.

    ⚠️ Grava num arquivo temporário ao lado e TROCA com `os.replace`, que é
    atômico no Windows. Escrever direto por cima do arquivo deixava uma janela
    em que uma queda do programa (ou do disco) o cortava no meio — e
    `ler_json_de_config` devolve `{}` para JSON corrompido, de propósito. O
    sintoma seria todo plugin, launcher e extensão amanhecer desligado, sem
    uma linha de explicação.
    """
    os.makedirs(CONFIGS_DIR, exist_ok=True)
    destino = os.path.join(CONFIGS_DIR, nome_arquivo)
    temporario = destino + '.tmp'
    with open(temporario, 'w', encoding='utf-8') as f:
        json.dump(dado, f, ensure_ascii=False, indent=2)
    os.replace(temporario, destino)


def caminho_relativo(caminho_pasta_rel, nome):
    """Junta o caminho de uma pasta (relativo à raiz, `''` para a raiz) com o
    nome de uma entrada dentro dela — sempre com `/` como separador,
    independente do SO, porque este caminho vira CHAVE de config (JSON) e
    trafega para o frontend como string comum."""
    return f'{caminho_pasta_rel}/{nome}' if caminho_pasta_rel else nome


def aplicar_ordem(nomes, ordem):
    """Aplica a ordem salva sobre a lista alfabética. Um nome salvo que sumiu
    (pasta/arquivo apagado) é descartado; um nome novo (nunca salvo) entra na
    própria posição alfabética, não sempre no fim — mesma regra de
    `_completarOrdemSalva` em `tab-order.js`, para algo recém-criado não pular
    para o topo ou para o fundo da lista sem motivo."""
    presentes = set(nomes)
    completa = [n for n in ordem if n in presentes]
    for i, nome in enumerate(nomes):
        if nome in completa:
            continue
        completa.insert(min(i, len(completa)), nome)
    return completa


def escanear_nivel(caminho_abs, eh_folha, chave_ordenacao=None):
    """`(nomes_de_categoria, nomes_de_folha)` dos filhos DIRETOS de
    `caminho_abs`, em ordem alfabética. Não desce sozinho — quem desce é
    `montar_no`.

    `eh_folha(caminho_absoluto_do_filho)` decide; o que não é folha e é pasta
    vira categoria, e o que não é nem um nem outro é ignorado. Nunca lança:
    pasta ausente, ou apagada bem no meio da varredura (corrida entre o
    `isdir` de quem chamou e este `listdir`), devolve as duas listas vazias.

    ⚠️ `chave_ordenacao` existe porque os dois consumidores originais
    ordenavam DIFERENTE — Plugins com `str.casefold`, Launchers com o `sorted`
    cru. Manter a diferença é o que garante que a extração não mudou a ordem
    de nenhuma das duas listas na tela.
    """
    try:
        entradas = sorted(os.listdir(caminho_abs), key=chave_ordenacao)
    except OSError:
        return [], []
    categorias, folhas = [], []
    for nome in entradas:
        caminho_filho = os.path.join(caminho_abs, nome)
        if eh_folha(caminho_filho):
            folhas.append(nome)
        elif os.path.isdir(caminho_filho):
            categorias.append(nome)
    return categorias, folhas


def montar_no(raiz_abs, caminho_rel, eh_folha, montar_folha, ordem_por_pasta,
              chave_folhas='itens', ordenar_folhas=True, chave_ordenacao=None):
    """Constrói recursivamente UM nó da árvore (`caminho_rel` relativo a
    `raiz_abs`; `''` é a própria raiz).

    Devolve `{'nome', 'caminho', 'pastas', <chave_folhas>}` — `pastas` são as
    categorias (organização pura, nunca ligam/desligam) e `<chave_folhas>` são
    as folhas, cada uma passada por `montar_folha(caminho_rel_da_folha, nome)`
    para o sistema que chamou acrescentar os campos dele.

    A ordem salva em `ordem_por_pasta[caminho_rel]` vale para os nomes DAQUELE
    nível — `aplicar_ordem` filtra pelos nomes que existem em cada conjunto.
    `ordenar_folhas=False` para quem só deixa arrastar as pastas (Launchers).

    Pasta ausente em qualquer nível vira nó vazio — nunca lança.
    """
    caminho_abs = os.path.join(raiz_abs, caminho_rel.replace('/', os.sep)) \
        if caminho_rel else raiz_abs
    nomes_categorias, nomes_folhas = escanear_nivel(caminho_abs, eh_folha, chave_ordenacao)
    ordem_deste_nivel = (ordem_por_pasta or {}).get(caminho_rel, [])
    nomes_categorias = aplicar_ordem(nomes_categorias, ordem_deste_nivel)
    if ordenar_folhas:
        nomes_folhas = aplicar_ordem(nomes_folhas, ordem_deste_nivel)

    categorias = [
        montar_no(raiz_abs, caminho_relativo(caminho_rel, nome), eh_folha, montar_folha,
                  ordem_por_pasta, chave_folhas, ordenar_folhas, chave_ordenacao)
        for nome in nomes_categorias
    ]

    folhas = [montar_folha(caminho_relativo(caminho_rel, nome), nome) for nome in nomes_folhas]

    return {
        'nome': os.path.basename(caminho_rel) if caminho_rel else '',
        'caminho': caminho_rel,
        'pastas': categorias,
        chave_folhas: folhas,
    }


def listar_folhas_recursivo(raiz_abs, eh_folha, caminho_rel='', chave_ordenacao=None):
    """Caminhos relativos (achatados) de TODA folha, em qualquer profundidade
    — para quem precisa da lista inteira sem a árvore (boot, Restaurar
    padrão, validação de um caminho vindo do frontend)."""
    caminho_abs = os.path.join(raiz_abs, caminho_rel.replace('/', os.sep)) \
        if caminho_rel else raiz_abs
    categorias, folhas = escanear_nivel(caminho_abs, eh_folha, chave_ordenacao)
    caminhos = [caminho_relativo(caminho_rel, nome) for nome in folhas]
    for nome in categorias:
        caminhos.extend(listar_folhas_recursivo(
            raiz_abs, eh_folha, caminho_relativo(caminho_rel, nome), chave_ordenacao))
    return caminhos
