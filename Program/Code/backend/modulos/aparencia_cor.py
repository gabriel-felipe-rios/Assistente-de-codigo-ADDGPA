from .constantes import *
import math

# ═════════════════════════════════════════ APARÊNCIA · COR: A RÉGUA E AS FAMÍLIAS ══
# Duas perguntas, e as duas moram aqui porque as duas dependem do MESMO espaço de
# cor perceptual (CIELAB):
#
#   1. "essas duas cores são a mesma?"  → distância CIEDE2000
#   2. "essa cor é de que cor?"          → família
#
# ⚠️ A distância NÃO é mais euclidiana em RGB. A euclidiana mente: em RGB, um par
# de azuis escuros separados por 30 unidades parece igual, e um par de verdes
# claros separados pelos mesmos 30 parece diferente. Como a tolerância da tela é
# a pergunta "é esse verde?", ela precisa medir o que o OLHO vê, não o que o
# número diz. A escala de saída continua 0–100 de propósito: o slider da aba é em
# %, e trocar a régua não podia obrigar a redesenhar o controle.
#
# ⚠️ Família é sempre UMA. Um tom de fronteira vai para a família mais próxima e
# só para ela — contar em duas infla a porcentagem de área das imagens e faz a
# soma passar de 100%.

# ── Padrões de cor: os mesmos conceitos em linguagens diferentes ─────────────
APARENCIA_RE_HEX = re.compile(r'#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b')
APARENCIA_RE_RGB = re.compile(
    r'\brgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)')
APARENCIA_RE_HEXADECIMAL = re.compile(r'\b0[xX]([0-9a-fA-F]{8}|[0-9a-fA-F]{6})\b')
APARENCIA_RE_FROMARGB = re.compile(
    r'FromArgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(\d{1,3})\s*)?\)')

APARENCIA_RE_TOKEN_DEFINICAO = re.compile(r'(--[\w-]+)\s*:\s*([^;{}]+)')
APARENCIA_RE_TOKEN_USO = re.compile(r'var\(\s*(--[\w-]+)')
APARENCIA_RE_TRIPLA = re.compile(r'^\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*$')


# ── Notação → tupla, e de volta ─────────────────────────────────────────────
def aparencia_expandir_hex(bruto):
    """'#abc' -> (170,187,204); '#RRGGBBAA' descarta o alfa."""
    if len(bruto) == 3:
        bruto = ''.join(c * 2 for c in bruto)
    elif len(bruto) == 8:
        bruto = bruto[:6]
    return (int(bruto[0:2], 16), int(bruto[2:4], 16), int(bruto[4:6], 16))


def aparencia_para_hex(rgb):
    return '#%02X%02X%02X' % tuple(rgb[:3])


def aparencia_interpretar_cor(texto):
    """Aceita '#2ECC71', '2ECC71', 'rgb(46,204,113)' -> (r,g,b) ou None."""
    if not texto:
        return None
    texto = texto.strip()
    achado = APARENCIA_RE_HEX.search(texto if texto.startswith('#') else '#' + texto)
    if achado:
        return aparencia_expandir_hex(achado.group(1))
    achado = APARENCIA_RE_RGB.search(texto)
    if achado:
        return tuple(min(255, int(achado.group(i))) for i in (1, 2, 3))
    return None


# ── sRGB → CIELAB ───────────────────────────────────────────────────────────
# Iluminante D65, observador 2° — o mesmo par que o CSS e todo monitor assumem.
APARENCIA_BRANCO_D65 = (95.047, 100.000, 108.883)


def _aparencia_linearizar(canal):
    """Desfaz a curva de gama do sRGB: byte 0–255 → energia linear 0–1."""
    valor = canal / 255.0
    if valor <= 0.04045:
        return valor / 12.92
    return ((valor + 0.055) / 1.055) ** 2.4


def aparencia_para_lab(rgb):
    """(r,g,b) 0–255 → (L*, a*, b*). L* vai de 0 (preto) a 100 (branco)."""
    r, g, b = (_aparencia_linearizar(c) for c in rgb[:3])
    x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) * 100
    y = (0.2126729 * r + 0.7151522 * g + 0.0721750 * b) * 100
    z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) * 100

    def f(t):
        return t ** (1.0 / 3.0) if t > 0.008856 else (7.787 * t) + (16.0 / 116.0)

    fx = f(x / APARENCIA_BRANCO_D65[0])
    fy = f(y / APARENCIA_BRANCO_D65[1])
    fz = f(z / APARENCIA_BRANCO_D65[2])
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


def aparencia_para_lch(rgb):
    """(r,g,b) → (claridade 0–100, saturação/croma, matiz em graus 0–360)."""
    ele, a, b = aparencia_para_lab(rgb)
    croma = math.sqrt(a * a + b * b)
    matiz = math.degrees(math.atan2(b, a)) % 360.0
    return (ele, croma, matiz)


# ── CIEDE2000 ───────────────────────────────────────────────────────────────
def aparencia_distancia(uma, outra):
    """Distância perceptual entre duas cores, 0 (iguais) a 100 (opostas).

    CIEDE2000 sobre CIELAB. O corte em 100 é da ESCALA DA TELA, não da fórmula:
    alguns pares extremos (azul puro x amarelo puro) passam de 100 no ΔE00, e
    deixar o número estourar faria o rótulo "%" da aba mentir.
    """
    ele1, a1, b1 = aparencia_para_lab(uma)
    ele2, a2, b2 = aparencia_para_lab(outra)

    croma1 = math.sqrt(a1 * a1 + b1 * b1)
    croma2 = math.sqrt(a2 * a2 + b2 * b2)
    croma_media = (croma1 + croma2) / 2.0

    # Correção de G: espalha os quase-cinzas, que o CIELAB comprime demais
    g = 0.5 * (1 - math.sqrt(croma_media ** 7 / (croma_media ** 7 + 25.0 ** 7))) \
        if croma_media > 0 else 0.0
    a1l, a2l = (1 + g) * a1, (1 + g) * a2
    c1l = math.sqrt(a1l * a1l + b1 * b1)
    c2l = math.sqrt(a2l * a2l + b2 * b2)
    h1l = math.degrees(math.atan2(b1, a1l)) % 360.0 if (a1l or b1) else 0.0
    h2l = math.degrees(math.atan2(b2, a2l)) % 360.0 if (a2l or b2) else 0.0

    delta_ele = ele2 - ele1
    delta_croma = c2l - c1l

    if c1l * c2l == 0:
        delta_matiz = 0.0
    elif abs(h2l - h1l) <= 180:
        delta_matiz = h2l - h1l
    elif h2l - h1l > 180:
        delta_matiz = h2l - h1l - 360
    else:
        delta_matiz = h2l - h1l + 360
    delta_matiz_cartesiano = 2 * math.sqrt(c1l * c2l) * math.sin(math.radians(delta_matiz) / 2)

    ele_media = (ele1 + ele2) / 2.0
    croma_media_l = (c1l + c2l) / 2.0
    if c1l * c2l == 0:
        matiz_media = h1l + h2l
    elif abs(h1l - h2l) <= 180:
        matiz_media = (h1l + h2l) / 2.0
    elif h1l + h2l < 360:
        matiz_media = (h1l + h2l + 360) / 2.0
    else:
        matiz_media = (h1l + h2l - 360) / 2.0

    t = (1
         - 0.17 * math.cos(math.radians(matiz_media - 30))
         + 0.24 * math.cos(math.radians(2 * matiz_media))
         + 0.32 * math.cos(math.radians(3 * matiz_media + 6))
         - 0.20 * math.cos(math.radians(4 * matiz_media - 63)))

    peso_ele = 1 + (0.015 * (ele_media - 50) ** 2) / math.sqrt(20 + (ele_media - 50) ** 2)
    peso_croma = 1 + 0.045 * croma_media_l
    peso_matiz = 1 + 0.015 * croma_media_l * t

    rotacao = 0.0
    if croma_media_l > 0:
        rotacao = (-2 * math.sqrt(croma_media_l ** 7 / (croma_media_l ** 7 + 25.0 ** 7))
                   * math.sin(math.radians(
                       60 * math.exp(-(((matiz_media - 275) / 25.0) ** 2)))))

    delta = math.sqrt(
        (delta_ele / peso_ele) ** 2
        + (delta_croma / peso_croma) ** 2
        + (delta_matiz_cartesiano / peso_matiz) ** 2
        + rotacao * (delta_croma / peso_croma) * (delta_matiz_cartesiano / peso_matiz))
    return min(100.0, delta)


# ── Famílias de cor ─────────────────────────────────────────────────────────
# 8 cromáticas + 3 neutras. A lista é curta de propósito: ela existe para SOMAR
# variações do mesmo elemento (vermelho escuro + vermelho claro + vermelho
# dessaturado = um vermelho só), não para descrever a cor com precisão. Uma
# lista longa devolveria o problema que ela veio resolver — um botão vermelho
# gastando as três vagas de uma imagem consigo mesmo.
APARENCIA_FAMILIAS_CROMATICAS = (
    'vermelho', 'rosa', 'laranja', 'marrom', 'amarelo', 'verde', 'azul', 'roxo')
APARENCIA_FAMILIAS_NEUTRAS = ('preto', 'cinza', 'branco')
APARENCIA_FAMILIAS = APARENCIA_FAMILIAS_CROMATICAS + APARENCIA_FAMILIAS_NEUTRAS

APARENCIA_FAMILIA_ROTULO = {
    'vermelho': 'Vermelho', 'rosa': 'Rosa', 'laranja': 'Laranja', 'marrom': 'Marrom',
    'amarelo': 'Amarelo', 'verde': 'Verde', 'azul': 'Azul', 'roxo': 'Roxo',
    'preto': 'Preto', 'cinza': 'Cinza', 'branco': 'Branco',
}

APARENCIA_CROMA_NEUTRO = 8.0     # abaixo disso não há matiz que valha
APARENCIA_CLARIDADE_PRETO = 22.0
APARENCIA_CLARIDADE_BRANCO = 88.0

# Faixas de matiz em CIELAB (graus). Fronteira fechada à esquerda, aberta à
# direita — é isso que garante UMA família por cor, sem sobreposição. Os graus
# de 350° a 20° dão a volta e caem na faixa magenta, no `familia` inicial da
# função: é lá que mora o rosa de verdade (ver `aparencia_familia`).
APARENCIA_MATIZ_MAGENTA = (350.0, 20.0)
APARENCIA_FAIXAS_MATIZ = (
    (20.0, 50.0, 'vermelho'),
    (50.0, 80.0, 'laranja'),
    (80.0, 110.0, 'amarelo'),
    (110.0, 180.0, 'verde'),
    (180.0, 300.0, 'azul'),
    (300.0, 350.0, 'roxo'),
)


def aparencia_familia(rgb):
    """(r,g,b) → (familia, matiz, saturacao, claridade).

    Ordem que importa: NEUTRO ANTES DE TUDO. Um cinza tem matiz calculado — e
    ele é ruído numérico. Perguntar "que matiz é esse?" antes de perguntar "isso
    tem cor?" espalharia os cinzas do projeto pelas oito famílias cromáticas.
    """
    claridade, saturacao, matiz = aparencia_para_lch(rgb)

    if saturacao < APARENCIA_CROMA_NEUTRO:
        if claridade < APARENCIA_CLARIDADE_PRETO:
            familia = 'preto'
        elif claridade > APARENCIA_CLARIDADE_BRANCO:
            familia = 'branco'
        else:
            familia = 'cinza'
        return (familia, matiz, saturacao, claridade)

    # A faixa magenta (350°–20°) não tem linha na tabela porque ela dá a volta no
    # zero; é o valor inicial, e as faixas de tabela só a substituem se casarem.
    familia = 'vermelho'
    na_faixa_magenta = True
    for inicio, fim, nome in APARENCIA_FAIXAS_MATIZ:
        if inicio <= matiz < fim:
            familia = nome
            na_faixa_magenta = False
            break

    # Rosa e marrom não são matiz próprio — saem de matiz + claridade + saturação
    # juntos.
    #
    # ⚠️ Rosa é o lado MAGENTA do vermelho com a claridade alta, e não "vermelho
    # claro". A diferença não é preciosismo: sem ela, `#FF7878` (vermelho claro,
    # matiz 36°) vira rosa e o botão vermelho do projeto se parte em duas
    # famílias — exatamente o que o agrupamento veio impedir. `#FFC0CB` (8°) e
    # `#FF69B4` (358°) ficam do lado magenta e são rosa de verdade.
    if na_faixa_magenta and claridade > 50:
        familia = 'rosa'
    elif familia == 'vermelho' and claridade > 75 and saturacao < 35:
        familia = 'rosa'          # rosa lavado, já sem magenta que o denuncie
    elif familia in ('laranja', 'amarelo') and claridade < 50:
        familia = 'marrom'        # laranja (ou amarelo escurecido) dá o mesmo bege

    return (familia, matiz, saturacao, claridade)


def aparencia_rotulo_familia(familia):
    return APARENCIA_FAMILIA_ROTULO.get(familia, (familia or '').capitalize())


def aparencia_agrupar_por_familia(pesos, maximo=None):
    """[(rgb, peso)] → [{familia, rotulo, cor, hex, fatia, peso}], da maior fatia.

    É aqui que "vermelho escuro + vermelho claro + vermelho dessaturado" vira UM
    vermelho com a área somada. A cor que representa a família é o TOM MAIS
    PRESENTE dela — nunca a média dos tons: a média inventa uma cor que não está
    em pixel nenhum e apaga a segunda cor do desenho.
    """
    familias = {}
    total = 0.0
    for rgb, peso in pesos:
        if peso <= 0:
            continue
        total += peso
        nome = aparencia_familia(rgb)[0]
        grupo = familias.setdefault(nome, {'peso': 0.0, 'tons': {}})
        grupo['peso'] += peso
        chave = tuple(int(c) for c in rgb[:3])
        grupo['tons'][chave] = grupo['tons'].get(chave, 0.0) + peso

    if not total:
        return []

    saida = []
    for nome, grupo in familias.items():
        dominante = max(grupo['tons'].items(), key=lambda item: item[1])[0]
        saida.append({
            'familia': nome,
            'rotulo': aparencia_rotulo_familia(nome),
            'cor': list(dominante),
            'hex': aparencia_para_hex(dominante),
            'fatia': round(grupo['peso'] / total * 100, 1),
            'peso': grupo['peso'],
        })
    saida.sort(key=lambda f: -f['fatia'])
    return saida[:maximo] if maximo else saida
