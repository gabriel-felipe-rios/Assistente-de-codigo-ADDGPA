"""O diff entre duas Versões — `difflib`, e nada além dele.

Sem dependência nova, sem Git, sem delta por linha guardado em disco. O
conteúdo das duas pontas já está em `arquivos/`, endereçado pelo hash; comparar
é ler os dois e passar no `difflib.unified_diff`.

Este módulo é usado por dois lados que não se conhecem:

* a **reversão** (`backups_reverter.py`), para dizer na tela quantas linhas
  entram e quantas saem antes de o usuário confirmar;
* o **Mapa da mudança** (`backups_mapa*.py`), onde a contagem `+`/`−` aparece
  em toda parte.

⚠️ **BINÁRIO NUNCA VAI AO `difflib`.** Medido no projeto real: um `index.db` de
9,6 MB (o banco do Embedding Semântico) vira ~152 mil "linhas" no
`str.splitlines`, que quebra em `\\v \\f \\x1c \\x1d \\x1e` além de `\\n`. Duas
sequências de 152 mil fatias de lixo binário, quase todas distintas, são a pior
entrada possível para o `SequenceMatcher`, que é quadrático — a chamada segurava
a interface por minutos. Binário é comparado **pelo hash**, e só: ou está igual,
ou está alterado.

⚠️ **ARQUIVO IGUAL NÃO É LIDO.** A medida dele sai do tamanho em disco, não do
conteúdo. Antes, um arquivo que não mudou tinha os 9,6 MB lidos e decodificados
só para contar `\\n`.

⚠️ `versao_ate` aceita o valor especial `atual`: é o disco de agora, não uma
Versão. Quem monta os mapas passa `None` no lugar do hash e o caminho absoluto
do arquivo real, e as funções daqui leem do disco.
"""

import difflib

from .constantes import *
from . import versoes


VERSAO_ATUAL = 'atual'

# Acima disto, o arquivo não é comparado linha a linha nem que seja texto puro.
# Não é medo de memória: é que um diff de 2 MB não cabe em tela nem em cabeça, e
# o custo do `SequenceMatcher` cresce rápido demais para pagar por um resultado
# que ninguém vai ler.
MAX_BYTES_PARA_DIFF = 2 * 1024 * 1024

# O quanto se lê para decidir se é binário. Byte nulo é o teste clássico e é o
# que o `git` usa: texto de verdade não tem `\0`.
_AMOSTRA = 8192


def parece_binario(dados):
    """`True` se o conteúdo tem byte nulo nos primeiros 8 KB."""
    return b'\x00' in (dados or b'')[:_AMOSTRA]


def _linhas(texto):
    return texto.splitlines(keepends=True)


# ── Ler um lado ──────────────────────────────────────────────────────────────

def carregar_bytes(project_name, hash_ou_none, caminho_absoluto=None):
    """O conteúdo bruto de um lado, ou `b''` se ele não existe ali.

    ⚠️ **O CAMINHO ABSOLUTO VEM PRIMEIRO, E ISSO NÃO É DETALHE.** Quando o lado
    é o *estado atual*, o mapa traz um hash md5 calculado na hora — e esse
    conteúdo **não está em `arquivos/`**, porque nunca foi guardado em Versão
    nenhuma. Consultando o hash primeiro, `versoes.ler` não achava o arquivo e
    devolvia `b''` **em silêncio**: todo arquivo criado ou alterado desde a
    Versão era lido como vazio.

    O estrago era invisível e grande: a comparação virava "+0 / −tudo", o
    Treemap media todo bloco em 1 (daí os retângulos todos iguais), e o trecho
    do diff mostrava o arquivo inteiro como removido.
    """
    if caminho_absoluto:
        try:
            with open(caminho_absoluto, 'rb') as f:
                return f.read()
        except OSError:
            return b''
    if hash_ou_none:
        return versoes.ler(project_name, hash_ou_none)
    return b''


def carregar_lado(project_name, hash_ou_none, caminho_absoluto=None):
    """O texto de um dos lados, decodificado com folga.

    Devolve `''` quando o arquivo não existe daquele lado — é exatamente o que
    o diff precisa para tratar criação e remoção como casos do mesmo cálculo.
    """
    return carregar_bytes(project_name, hash_ou_none,
                          caminho_absoluto).decode('utf-8', errors='replace')


def tamanho_do_lado(project_name, hash_ou_none, caminho_absoluto=None):
    """Quantos bytes, **sem ler o conteúdo**. É a medida do arquivo igual.

    Mesma ordem de `carregar_bytes`, e pelo mesmo motivo: o hash do estado
    atual não está no armazém, e `tamanho_do_conteudo` devolvia 0 calado.
    """
    if caminho_absoluto:
        try:
            return os.path.getsize(caminho_absoluto)
        except OSError:
            return 0
    if hash_ou_none:
        return versoes.tamanho_do_conteudo(project_name, hash_ou_none)
    return 0


def comparavel(dados_antes, dados_agora):
    """`(pode_comparar, motivo)` — a porta de entrada do `difflib`.

    O motivo vai por escrito para a tela. Silêncio aqui pareceria "não mudou
    nada", que é a leitura errada: mudou, só não dá para mostrar como.
    """
    if parece_binario(dados_antes) or parece_binario(dados_agora):
        return False, 'arquivo binário — comparado pelo hash, não linha a linha'
    if max(len(dados_antes), len(dados_agora)) > MAX_BYTES_PARA_DIFF:
        return False, ('arquivo com mais de %d MB — comparado pelo hash'
                       % (MAX_BYTES_PARA_DIFF // (1024 * 1024)))
    return True, ''


# ── As contas ────────────────────────────────────────────────────────────────

def contar(antes, agora):
    """Quantas linhas entram e quantas saem. É a conta que a tela repete."""
    mais = menos = 0
    for linha in difflib.unified_diff(_linhas(antes), _linhas(agora), n=0):
        if linha.startswith('+') and not linha.startswith('+++'):
            mais += 1
        elif linha.startswith('-') and not linha.startswith('---'):
            menos += 1
    return {'mais': mais, 'menos': menos}


def trecho(antes, agora, contexto=3):
    """O diff unificado, em linhas, para a Árvore mostrar quando se clica.

    ⚠️ **NÃO HÁ TETO DE LINHAS, E ISSO É DECISÃO DO USUÁRIO.** Havia um corte
    em 400 linhas, com um aviso "diff truncado" na última; quem clica num
    arquivo quer ver a diferença INTEIRA, e um diff cortado no meio obriga a
    ir procurar o resto em outro lugar. O custo já está segurado antes daqui
    por `comparavel`: binário e arquivo acima de `MAX_BYTES_PARA_DIFF` nem
    chegam ao `difflib`.
    """
    saida = []
    for linha in difflib.unified_diff(_linhas(antes), _linhas(agora),
                                      fromfile='antes', tofile='agora',
                                      n=contexto):
        # ⚠️ `\r` TAMBÉM. Este projeto tem arquivos em CRLF, e tirar só o `\n`
        # deixava um `\r` solto no fim de cada linha do diff. Ele não é
        # conteúdo, é terminador — e dentro de um `<pre>` o navegador o
        # normaliza para uma quebra de linha, somando uma linha em branco a cada
        # linha do trecho.
        saida.append(linha.rstrip('\r\n'))
    return saida


def situacao(hash_antes, hash_agora):
    """O que aconteceu com o arquivo, na palavra que a tela usa.

    Quatro estados, e só quatro: `criado`, `removido`, `alterado`, `igual`.

    ⚠️ `movido` e `renomeado` NÃO saem daqui, e não têm como sair: esta função
    olha UM caminho, e mudar de lugar é um fato sobre DOIS. Quem os descobre é
    `parear_movidos`, depois, cruzando a lista inteira.
    """
    if not hash_antes and hash_agora:
        return 'criado'
    if hash_antes and not hash_agora:
        return 'removido'
    if hash_antes != hash_agora:
        return 'alterado'
    return 'igual'


# ── Mudou de lugar, não de conteúdo ──────────────────────────────────────────

# As duas palavras que o pareamento produz. Ficam aqui porque o Mapa da mudança
# e a reversão precisam das mesmas, e uma string solta em dois arquivos vira
# duas strings diferentes na primeira vez que alguém escrever "renomeado " com
# espaço.
MOVIDO = 'movido'
RENOMEADO = 'renomeado'
SITUACOES_DE_CAMINHO = (MOVIDO, RENOMEADO)


def parear_movidos(mapa_antes, mapa_agora):
    """`{caminho: (situacao, par)}` para tudo que só mudou de lugar.

    Um caminho que sumiu e cujo **hash reaparece** em outro caminho não é um
    arquivo apagado mais um arquivo novo: é o mesmo arquivo, em outro lugar. O
    par entra duas vezes no resultado — pelo caminho velho e pelo novo —, porque
    o Mapa desenha os dois lados e cada lado só conhece o caminho dele.

    ⚠️ **SÓ O PAR 1:1 E INEQUÍVOCO.** Se dois caminhos somem com o mesmo hash,
    ou se o hash que sumiu reaparece em dois lugares, não há como dizer qual
    virou qual — e aí é melhor continuar mostrando deletado + criado do que
    afirmar um parentesco inventado.

    ⚠️ **CONTEÚDO IDÊNTICO, E SÓ.** Arquivo que mudou de lugar *e* por dentro
    não é pareado: o hash não bate, e parear por semelhança de nome seria um
    palpite. Decisão do usuário — nesse caso ele continua sendo deletado + criado.
    """
    mapa_antes = mapa_antes or {}
    mapa_agora = mapa_agora or {}
    sumiram = {c: h for c, h in mapa_antes.items() if c not in mapa_agora}
    surgiram = {c: h for c, h in mapa_agora.items() if c not in mapa_antes}
    if not sumiram or not surgiram:
        return {}

    de_por_hash = {}
    para_por_hash = {}
    for caminho, h in sumiram.items():
        de_por_hash.setdefault(h, []).append(caminho)
    for caminho, h in surgiram.items():
        para_por_hash.setdefault(h, []).append(caminho)

    pares = {}
    for h, velhos in de_por_hash.items():
        novos = para_por_hash.get(h)
        # Exatamente um de cada lado. `len != 1` é a ambiguidade, e ela passa.
        if not novos or len(velhos) != 1 or len(novos) != 1:
            continue
        velho, novo = velhos[0], novos[0]
        # Pasta diferente manda: um arquivo que mudou de pasta E de nome é
        # "movido", porque o que se procura na tela é o arquivo que saiu dali.
        est = RENOMEADO if os.path.dirname(velho) == os.path.dirname(novo) else MOVIDO
        pares[velho] = (est, novo)
        pares[novo] = (est, velho)
    return pares


# ── Cruzar dois mapas ────────────────────────────────────────────────────────

def comparar_mapas(project_name, mapa_antes, mapa_agora, raiz_atual=None,
                   com_contagem=True, absolutos=None, com_linhas=True):
    """Cruza dois `{caminho: hash}` e devolve uma linha por arquivo.

    Cada linha traz `caminho`, `situacao`, `mais`, `menos`, `linhas`, `bytes` e
    `binario`. Quem escolhe entre `linhas` e `bytes` como grandeza do desenho é
    o front, pelo alternador do painel — e binário só tem `bytes`.

    Quando o lado "agora" é o disco de agora, o conteúdo não está em
    `arquivos/` e precisa vir do arquivo real. Há duas formas de dizer onde ele
    está: `raiz_atual`, quando todos os caminhos pendem de uma raiz só (a
    metade Documentação), e `absolutos`, um `{caminho: absoluto}`, quando cada
    caminho pende de uma pasta de trabalho diferente (a metade Código).
    """
    mapa_antes = mapa_antes or {}
    mapa_agora = mapa_agora or {}
    absolutos = absolutos or {}
    linhas = []
    for caminho in sorted(set(mapa_antes) | set(mapa_agora)):
        h_antes = mapa_antes.get(caminho)
        h_agora = mapa_agora.get(caminho)
        est = situacao(h_antes, h_agora)
        absoluto = absolutos.get(caminho) or (
            os.path.join(raiz_atual, caminho.replace('/', os.sep))
            if raiz_atual else None)

        item = {'caminho': caminho, 'situacao': est, 'par': '', 'par_lado': '',
                'mais': 0, 'menos': 0, 'binario': False, 'motivo': '',
                'linhas_antes': 0, 'linhas_agora': 0,
                'bytes_antes': 0, 'bytes_agora': 0,
                'linhas': 0, 'bytes': 0}

        # Arquivo igual: nada de `difflib`. O tamanho em bytes sai do disco, e
        # as linhas só são contadas se `com_linhas` — quem desenha por bytes não
        # paga a leitura, e binário nunca é lido por causa do teto de tamanho.
        if est == 'igual' or not com_contagem:
            tamanho = tamanho_do_lado(project_name, h_agora, absoluto)
            conta = 0
            if com_linhas and tamanho:
                conta, item['binario'] = medir_linhas(
                    project_name, h_agora, absoluto, tamanho)
            elif tamanho > MAX_BYTES_PARA_DIFF:
                item['binario'] = True
            if est == 'igual':
                # Conteúdo idêntico dos dois lados: uma medida serve para os dois.
                item['bytes_antes'] = item['bytes_agora'] = tamanho
                item['linhas_antes'] = item['linhas_agora'] = conta
            else:
                item['bytes_agora'], item['linhas_agora'] = tamanho, conta
                item['bytes_antes'] = tamanho_do_lado(project_name, h_antes)
            _fechar(item)
            linhas.append(item)
            continue

        dados_antes = carregar_bytes(project_name, h_antes)
        dados_agora = carregar_bytes(project_name, h_agora, absoluto)
        item['bytes_antes'] = len(dados_antes)
        item['bytes_agora'] = len(dados_agora)

        pode, motivo = comparavel(dados_antes, dados_agora)
        if not pode:
            item['binario'] = True
            item['motivo'] = motivo
            _fechar(item)
            linhas.append(item)
            continue

        antes = dados_antes.decode('utf-8', errors='replace')
        agora = dados_agora.decode('utf-8', errors='replace')
        item.update(contar(antes, agora))
        item['linhas_antes'] = antes.count('\n') + (1 if antes else 0)
        item['linhas_agora'] = agora.count('\n') + (1 if agora else 0)
        _fechar(item)
        linhas.append(item)

    # O pareamento vem DEPOIS, e por dentro: `resumir` é chamada direto sobre a
    # saída desta função (cabeçalho de Versões), e o Mapa da mudança inteiro
    # nasce dela. Pondo aqui, os cinco estados chegam a todo mundo de graça —
    # e um arquivo movido conta como UM arquivo mudado, não dois.
    pares = parear_movidos(mapa_antes, mapa_agora)
    if pares:
        for item in linhas:
            achado = pares.get(item['caminho'])
            if not achado:
                continue
            item['situacao'], item['par'] = achado
            # Qual das duas pontas do trajeto é esta. Sem isto a tela escreve
            # "movido caminho/velho.py" sem dizer se aquele é o começo ou o fim
            # — e a seta `→` / `←` que responde isso sai daqui.
            item['par_lado'] = 'agora' if item['caminho'] in mapa_agora else 'antes'
            # Conteúdo idêntico por construção: a contagem `+`/`−` de um lado
            # sozinho ("são 300 linhas novas") mentiria sobre o que aconteceu.
            item['mais'] = item['menos'] = 0
    return linhas


def _fechar(item):
    """`bytes` e `linhas` viram o MAIOR dos dois lados.

    ⚠️ Eles eram a medida do lado **agora**, e só dela — mas quem desenhava
    os dois painéis usava o mesmo número nos dois. Um arquivo removido media 0
    e por isso sumia do painel *antes*, onde ele existe; um arquivo que dobrou
    de tamanho saía igual dos dois lados. Cada lado passa a usar `*_antes` /
    `*_agora`; estes dois ficam para a regra de "arquivo grande" e para os
    totais do cabeçalho, onde o que importa é o maior.
    """
    item['bytes'] = max(item['bytes_antes'], item['bytes_agora'])
    item['linhas'] = max(item['linhas_antes'], item['linhas_agora'])


def medir_linhas(project_name, hash_, absoluto=None, tamanho=None):
    """`(linhas, binario)` sem montar diff nenhum.

    Serve ao arquivo **igual**, que precisa de tamanho para o desenho mas não
    de comparação. O tamanho é conferido ANTES da leitura: um `.db` de 9,6 MB
    não precisa ser lido para se saber que ele não tem linhas.
    """
    if tamanho is None:
        tamanho = tamanho_do_lado(project_name, hash_, absoluto)
    if tamanho > MAX_BYTES_PARA_DIFF:
        return 0, True
    dados = carregar_bytes(project_name, hash_, absoluto)
    if parece_binario(dados):
        return 0, True
    return dados.count(b'\n') + (1 if dados else 0), False


def resumir(linhas):
    """Os totais que o cabeçalho mostra: quantos arquivos, quantas pastas, ± linhas."""
    mudados = [l for l in linhas if l['situacao'] != 'igual']
    pastas = {os.path.dirname(l['caminho']) or '.' for l in mudados}
    # Movido e renomeado entram duas vezes em `mudados` (as duas pontas). Para
    # tudo que é CONTAGEM DE ARQUIVO ou SOMA DE TAMANHO, uma ponta só — a outra
    # é o mesmo arquivo. As `pastas` acima ficam com as duas de propósito: o
    # arquivo saiu de uma pasta e entrou noutra, e as duas foram mexidas.
    unicos = _uma_ponta_por_par(mudados)
    return {
        'arquivos': len(unicos),
        'pastas': len(pastas),
        'mais': sum(l['mais'] for l in mudados),
        'menos': sum(l['menos'] for l in mudados),
        'bytes': sum(l['bytes'] for l in unicos),
        'criados': sum(1 for l in mudados if l['situacao'] == 'criado'),
        'removidos': sum(1 for l in mudados if l['situacao'] == 'removido'),
        'alterados': sum(1 for l in mudados if l['situacao'] == 'alterado'),
        # ⚠️ Um arquivo movido aparece DUAS vezes na lista — pelo caminho velho
        # e pelo novo —, porque o Mapa desenha os dois lados. Aqui ele é UM
        # arquivo: contar as duas pontas diria que o projeto mudou o dobro.
        'movidos': sum(1 for l in unicos if l['situacao'] == MOVIDO),
        'renomeados': sum(1 for l in unicos if l['situacao'] == RENOMEADO),
        'binarios': sum(1 for l in unicos if l.get('binario')),
    }


def _uma_ponta_por_par(linhas):
    """A mesma lista, com as duas pontas de cada movido reduzidas a uma."""
    vistos = set()
    saida = []
    for linha in linhas:
        if linha['situacao'] in SITUACOES_DE_CAMINHO:
            chave = tuple(sorted((linha['caminho'], linha.get('par') or '')))
            if chave in vistos:
                continue
            vistos.add(chave)
        saida.append(linha)
    return saida
