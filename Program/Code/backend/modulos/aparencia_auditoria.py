from .constantes import *
from .aparencia_cor import aparencia_distancia, aparencia_interpretar_cor
from .aparencia_texto import APARENCIA_ETIQUETAS_LIGADAS

# ══════════════════════════════════════════ APARÊNCIA · AUDITORIA: OS APONTAMENTOS ══
# O que a aba tem a dizer sem que ninguém pergunte: cor escrita na mão em dez
# lugares, dois tons que ninguém distingue convivendo, o mesmo texto duplicado,
# dois ícones iguais, e a imagem que está na pasta sem ninguém usar.
#
# ⚠️ NÃO existe aqui o apontamento "ícone com cor fora da paleta". Ele foi
# proposto e recusado pelo usuário, com todas as letras. A ausência é decisão,
# não esquecimento — não o acrescente numa próxima passagem "de limpeza".

# Distância abaixo da qual dois tons são "o mesmo, escrito duas vezes". Em
# CIEDE2000 a diferença mal perceptível fica por volta de 1; 1.5 pega o engano
# de digitação sem acusar variação de propósito.
APARENCIA_DISTANCIA_TOM_PROXIMO = 1.5
# Peneira barata antes da régua cara: dois tons separados por mais que isto em
# RGB nunca chegam perto de 1.5 no CIEDE2000, e a comparação é O(n²).
APARENCIA_PENEIRA_RGB = 40
APARENCIA_MAX_LUGARES = 12

APARENCIA_ESPECIE_COR_REPETIDA = 'Cor repetida sem constante'
APARENCIA_ESPECIE_TONS_PROXIMOS = 'Tons quase idênticos'
APARENCIA_ESPECIE_TEXTO_DUPLICADO = 'Texto duplicado'
APARENCIA_ESPECIE_ICONES_IGUAIS = 'Ícones quase iguais'
APARENCIA_ESPECIE_IMAGEM_ORFA = 'Imagem que ninguém usa'

# Duas imagens contam como "quase iguais" quando as cores dominantes são as
# mesmas e as fatias não diferem mais que isto (em pontos percentuais).
APARENCIA_FOLGA_FATIA = 5.0


def _aparencia_lugar(ocorrencia):
    return {'arquivo': ocorrencia['arquivo'], 'linha': ocorrencia['linha'],
            'linguagem': ocorrencia.get('linguagem', ''),
            'trecho': ocorrencia.get('trecho', '')}


def _aparencia_lugar_de_imagem(ficha):
    return {'arquivo': ficha['arquivo'], 'linha': 1,
            'linguagem': ficha.get('formato', ''),
            'trecho': '%s · %s×%s' % (ficha.get('nome', ''),
                                      ficha.get('largura', 0), ficha.get('altura', 0))}


def _aparencia_cores_repetidas(cores):
    soltas = {}
    for ocorrencia in cores:
        if ocorrencia['via_token'] or ocorrencia['eh_definicao']:
            continue
        soltas.setdefault(ocorrencia['valor'], []).append(ocorrencia)
    apontamentos = []
    for valor, lista in soltas.items():
        if len(lista) < 2:
            continue
        apontamentos.append({
            'especie': APARENCIA_ESPECIE_COR_REPETIDA,
            'valor': valor,
            'cor': valor,
            'ocorrencias': len(lista),
            'linguagens': sorted({o['linguagem'] for o in lista}),
            'resumo': '%d ocorrências em %d arquivo(s)' % (
                len(lista), len({o['arquivo'] for o in lista})),
            'lugares': [_aparencia_lugar(o) for o in lista[:APARENCIA_MAX_LUGARES]],
        })
    return apontamentos


def _aparencia_tons_proximos(cores):
    """Pares de tons que ninguém distingue.

    Passou a medir na régua perceptual: antes, "1.5% de distância euclidiana em
    RGB" acusava pares de azul escuro que o olho separa bem e deixava passar
    pares de verde claro que ele não separa. A pergunta é sobre o olho.
    """
    distintas = {}
    for ocorrencia in cores:
        distintas.setdefault(ocorrencia['valor'], ocorrencia)
    valores = list(distintas.keys())
    rgbs = {v: tuple(distintas[v]['rgb']) for v in valores}

    apontamentos = []
    for i in range(len(valores)):
        um = valores[i]
        for j in range(i + 1, len(valores)):
            outro = valores[j]
            a, b = rgbs[um], rgbs[outro]
            if max(abs(a[0] - b[0]), abs(a[1] - b[1]), abs(a[2] - b[2])) > APARENCIA_PENEIRA_RGB:
                continue
            distancia = aparencia_distancia(a, b)
            if not (0 < distancia <= APARENCIA_DISTANCIA_TOM_PROXIMO):
                continue
            apontamentos.append({
                'especie': APARENCIA_ESPECIE_TONS_PROXIMOS,
                'valor': um + ' ≈ ' + outro,
                'cor': um,
                'ocorrencias': 2,
                'linguagens': sorted({distintas[um]['linguagem'],
                                      distintas[outro]['linguagem']}),
                'resumo': 'distância de %.1f%% — provável engano' % distancia,
                'lugares': [_aparencia_lugar(distintas[um]),
                            _aparencia_lugar(distintas[outro])],
            })
    return apontamentos


def _aparencia_textos_duplicados(textos):
    """Mesmo texto de interface escrito em vários arquivos.

    Só as etiquetas LIGADAS entram. Depois que a leitura passou a ser por
    árvore, o índice ganhou todo nome de classe CSS e toda chave de dicionário:
    apontar `"btn btn-sm"` como "texto duplicado em 40 arquivos" seria verdade e
    seria inútil — e afogaria os apontamentos que importam.
    """
    repetidos = {}
    for ocorrencia in textos:
        if ocorrencia.get('etiqueta') not in APARENCIA_ETIQUETAS_LIGADAS:
            continue
        repetidos.setdefault(ocorrencia['comparavel'], []).append(ocorrencia)

    apontamentos = []
    for _chave, lista in repetidos.items():
        arquivos = {o['arquivo'] for o in lista}
        if len(arquivos) < 2:
            continue
        apontamentos.append({
            'especie': APARENCIA_ESPECIE_TEXTO_DUPLICADO,
            'valor': '“%s”' % lista[0]['valor'],
            'cor': '',
            'ocorrencias': len(lista),
            'linguagens': sorted({o['linguagem'] for o in lista}),
            'resumo': '%d ocorrências em %d arquivos' % (len(lista), len(arquivos)),
            'lugares': [_aparencia_lugar(o) for o in lista[:APARENCIA_MAX_LUGARES]],
        })
    return apontamentos


def _aparencia_assinatura_de_imagem(ficha):
    """A 'cara' da imagem: as cores dominantes e a fatia de cada uma.

    ⚠️ A assinatura é pela COR, e não pela família. Por família, todo ícone
    monocromático de 16×16 vira "azul 100%" e 126 desenhos completamente
    diferentes caem num apontamento só — que não ajuda ninguém. Pela cor
    dominante arredondada, só quem tem de fato a mesma paleta se junta.
    """
    return tuple((f['hex'], round(f['fatia'] / APARENCIA_FOLGA_FATIA))
                 for f in ficha.get('familias', []))


def _aparencia_icones_iguais(imagens):
    """Duas imagens com a mesma paleta, as mesmas fatias e o mesmo tamanho.

    Dois arquivos, um ícone. Costuma ser cópia esquecida ao renomear, ou o mesmo
    desenho exportado duas vezes com nomes diferentes.
    """
    grupos = {}
    for ficha in imagens:
        if not ficha.get('familias'):
            continue
        chave = (_aparencia_assinatura_de_imagem(ficha),
                 ficha.get('largura', 0), ficha.get('altura', 0))
        grupos.setdefault(chave, []).append(ficha)

    apontamentos = []
    for (assinatura, largura, altura), lista in grupos.items():
        if len(lista) < 2:
            continue
        principal = lista[0]['familias'][0]
        apontamentos.append({
            'especie': APARENCIA_ESPECIE_ICONES_IGUAIS,
            'valor': ' ≈ '.join(f['nome'] for f in lista[:3]),
            'cor': principal['hex'],
            'ocorrencias': len(lista),
            'linguagens': sorted({f.get('formato', '') for f in lista}),
            'resumo': '%d arquivos, mesma paleta e %s×%s' % (len(lista), largura, altura),
            'lugares': [_aparencia_lugar_de_imagem(f) for f in lista[:APARENCIA_MAX_LUGARES]],
        })
    return apontamentos


def _aparencia_nomes_procuraveis(nome):
    """Os apelidos pelos quais um arquivo de imagem pode ser citado.

    `python.svg` costuma ser escrito no código só como `'python'`: quem monta o
    caminho é o programa (`` `${alvo}.svg` ``), e o nome inteiro não aparece em
    lugar nenhum. Procurar só pelo nome com extensão acusaria 928 das 929
    imagens deste projeto como órfãs — verdade literal e informação zero.
    """
    nome = (nome or '').lower()
    caule = os.path.splitext(nome)[0]
    apelidos = {nome, caule}
    # `advpl-include.clone.svg` → também `advpl-include`
    segundo = os.path.splitext(caule)[0]
    if segundo:
        apelidos.add(segundo)
    return {a for a in apelidos if a}


def _aparencia_imagens_orfas(imagens, referencias, literais):
    """Imagem que está na pasta e que nada no código cita, nem pelo apelido.

    ⚠️ É indício, não sentença. Imagem cujo nome é montado por pedaços
    (`'icone-' + tipo + '-16.png'`) não aparece inteira nem em apelido, e cai
    aqui sem culpa. Por isso o resumo diz "nenhuma citação encontrada", e não
    "não usada".
    """
    conhecidos = set(referencias) | set(literais)
    apontamentos = []
    for ficha in imagens:
        nome = ficha.get('nome', '')
        if not nome or (_aparencia_nomes_procuraveis(nome) & conhecidos):
            continue
        principal = (ficha.get('familias') or [{}])[0]
        apontamentos.append({
            'especie': APARENCIA_ESPECIE_IMAGEM_ORFA,
            'valor': nome,
            'cor': principal.get('hex', ''),
            'ocorrencias': 1,
            'linguagens': [ficha.get('formato', '')],
            'resumo': 'nenhuma citação encontrada no código do escopo',
            'lugares': [_aparencia_lugar_de_imagem(ficha)],
        })
    return apontamentos


def aparencia_montar_auditoria(indice, opcoes, limite):
    """As cinco espécies, na ordem de quem tem mais ocorrências."""
    opcoes = opcoes or {}
    ocorrencias = indice.get('ocorrencias', [])
    cores = [o for o in ocorrencias if o['tipo'] == 'cor']
    textos = [o for o in ocorrencias if o['tipo'] == 'texto']
    imagens = indice.get('imagens', [])
    referencias = set(indice.get('referencias_imagem', []))

    apontamentos = []
    if opcoes.get('cores_repetidas', True):
        apontamentos += _aparencia_cores_repetidas(cores)
    if opcoes.get('tons_proximos', True):
        apontamentos += _aparencia_tons_proximos(cores)
    if opcoes.get('textos_duplicados', True):
        apontamentos += _aparencia_textos_duplicados(textos)
    if opcoes.get('icones_iguais', True):
        apontamentos += _aparencia_icones_iguais(imagens)
    if opcoes.get('imagens_orfas', True):
        # Todo literal de texto do índice é um apelido em potencial: é assim que
        # `'python'` num dicionário de mapeamento salva `python.svg` de ser dado
        # como órfão.
        literais = {o['valor'].strip().lower() for o in textos}
        apontamentos += _aparencia_imagens_orfas(imagens, referencias, literais)

    apontamentos.sort(key=lambda a: -a['ocorrencias'])
    return apontamentos[:limite]
