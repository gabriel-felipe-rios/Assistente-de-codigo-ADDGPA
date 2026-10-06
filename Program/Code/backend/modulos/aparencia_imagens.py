from .constantes import *
import math
import base64
import xml.etree.ElementTree as ET
from .aparencia_cor import (
    aparencia_interpretar_cor, aparencia_para_hex, aparencia_agrupar_por_familia,
    aparencia_distancia)

# ═══════════════════════════════════════ APARÊNCIA · IMAGENS: O SEGUNDO ÍNDICE ══
# A aba nasceu cega para imagem. `.png`, `.jpg`, `.ico` e `.webp` não entravam de
# jeito nenhum, e o `.svg` entrava pelo lado errado: como CÓDIGO. Ler um ícone
# como texto faz um `fill="#3498DB"` de 2 pixels pesar exatamente igual a um de
# 2.000 — a busca por cor devolve o ícone, mas não sabe dizer se ele É azul ou se
# só tem um risco azul.
#
# Aqui a pergunta é a da tela: "essa imagem é dessa cor?". A resposta são as
# famílias dominantes com a FATIA DA ÁREA de cada uma.
#
# ⚠️ NUNCA média de cor. A média de um ícone azul-e-verde é um ciano que não
# existe em pixel nenhum, e some com as duas cores que existem. O que se guarda
# são as cores dominantes, cada uma com a sua porcentagem.
#
# ⚠️ Nada de OCR. Buscar texto numa imagem é buscar pelo NOME DO ARQUIVO, e ponto.

APARENCIA_EXTENSOES_IMAGEM = {
    '.svg': 'SVG', '.png': 'PNG', '.jpg': 'JPEG', '.jpeg': 'JPEG',
    '.ico': 'ICO', '.webp': 'WebP',
}
APARENCIA_EXTENSOES_RASTER = ('.png', '.jpg', '.jpeg', '.ico', '.webp')

APARENCIA_FAMILIAS_POR_IMAGEM = 3     # padrão de fábrica; vira controle na tela
APARENCIA_PRESENCA_MINIMA = 20        # em % da área
APARENCIA_LADO_AMOSTRA = 96           # reamostragem antes de contar pixel
APARENCIA_LIMITE_BYTES_IMAGEM = 8_000_000
APARENCIA_ALFA_MINIMO = 128           # abaixo disso o pixel é transparente
APARENCIA_PASSO_QUANTIZACAO = 16      # junta tons vizinhos antes de contar


def aparencia_pillow_disponivel():
    """A Pillow está instalada?

    ⚠️ Ela é OPCIONAL de propósito. O projeto não declara dependências em lugar
    nenhum, e a aba inteira não podia passar a depender de um pacote que pode não
    estar na máquina: sem Pillow, a Aparência continua funcionando com código, o
    índice de imagens fica vazio e a tela avisa. O `.svg` não depende dela —
    aquele é lido por geometria, não por pixel.
    """
    try:
        from PIL import Image  # noqa: F401
        return True
    except Exception:
        return False


# ── Raster: contar pixel ────────────────────────────────────────────────────
def aparencia_pesos_do_raster(caminho):
    """→ ([(rgb, quantidade_de_pixels)], largura, altura) ou (None, 0, 0)."""
    try:
        from PIL import Image
    except Exception:
        return (None, 0, 0)
    try:
        with Image.open(caminho) as imagem:
            largura, altura = imagem.size
            imagem = imagem.convert('RGBA')
            # Reamostrar antes de contar: um `.png` de 2000×2000 são 4 milhões de
            # pixels, e a resposta ("de que cor é isso?") não muda com 96×96.
            imagem.thumbnail((APARENCIA_LADO_AMOSTRA, APARENCIA_LADO_AMOSTRA))
            pixels = list(imagem.getdata())
    except Exception:
        return (None, 0, 0)

    contagem = {}
    passo = APARENCIA_PASSO_QUANTIZACAO
    for r, g, b, a in pixels:
        if a < APARENCIA_ALFA_MINIMO:
            continue          # transparente não pinta nada, e não conta área
        # Quantizar junta tons vizinhos do antisserrilhado, que senão viram
        # milhares de "tons dominantes" com um pixel cada.
        chave = (min(255, (r // passo) * passo + passo // 2),
                 min(255, (g // passo) * passo + passo // 2),
                 min(255, (b // passo) * passo + passo // 2))
        contagem[chave] = contagem.get(chave, 0) + 1
    return (list(contagem.items()), largura, altura)


# ── SVG: calcular área, sem rasterizar ──────────────────────────────────────
# ⚠️ Aqui não há pixel para contar: nenhuma biblioteca do projeto rasteriza SVG,
# e trazer uma (cairosvg + libcairo) por causa de um ícone seria caro demais. A
# área sai da GEOMETRIA das formas do próprio arquivo.
#
# É aproximado, e o limite está declarado: curva de `path` vira polígono pelos
# pontos de chegada, forma coberta por outra continua contando, e `transform`
# de escala é ignorado. O que ele resolve — e era o problema — é o traço de 2
# pixels deixar de pesar igual ao fundo de 2.000.
APARENCIA_SVG_NS = '{http://www.w3.org/2000/svg}'
APARENCIA_RE_NUMERO = re.compile(r'-?\d*\.?\d+(?:[eE][-+]?\d+)?')
APARENCIA_RE_COMANDO_PATH = re.compile(r'([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)')
APARENCIA_RE_ESTILO = re.compile(r'([\w-]+)\s*:\s*([^;]+)')
APARENCIA_SVG_PINTURA_VAZIA = ('none', 'transparent', 'currentcolor', 'inherit', '')


def _aparencia_sem_namespace(marca):
    return marca.split('}')[-1].lower()


def _aparencia_numeros(texto):
    return [float(n) for n in APARENCIA_RE_NUMERO.findall(texto or '')]


def _aparencia_pintura(elemento, herdado):
    """fill e stroke em vigor no elemento, já contando `style=` e a herança."""
    valores = dict(herdado)
    estilo = elemento.get('style') or ''
    for nome, valor in APARENCIA_RE_ESTILO.findall(estilo):
        if nome in ('fill', 'stroke', 'stroke-width'):
            valores[nome] = valor.strip()
    for nome in ('fill', 'stroke', 'stroke-width'):
        if elemento.get(nome) is not None:
            valores[nome] = elemento.get(nome).strip()
    return valores


def _aparencia_area_do_path(dados):
    """Área do polígono formado pelos pontos de chegada do `d`, por shoelace."""
    pontos = []
    atual = [0.0, 0.0]
    inicio = [0.0, 0.0]
    for comando, corpo in APARENCIA_RE_COMANDO_PATH.findall(dados or ''):
        numeros = _aparencia_numeros(corpo)
        relativo = comando.islower()
        letra = comando.upper()
        if letra == 'Z':
            atual = list(inicio)
            continue
        # Quantos números cada comando consome, e onde está o ponto de chegada
        tamanho = {'M': 2, 'L': 2, 'T': 2, 'H': 1, 'V': 1,
                   'C': 6, 'S': 4, 'Q': 4, 'A': 7}.get(letra, 2)
        for corte in range(0, len(numeros) - tamanho + 1, tamanho):
            grupo = numeros[corte:corte + tamanho]
            if letra == 'H':
                atual = [grupo[0] + (atual[0] if relativo else 0), atual[1]]
            elif letra == 'V':
                atual = [atual[0], grupo[0] + (atual[1] if relativo else 0)]
            else:
                destino = grupo[-2:]
                atual = [destino[0] + (atual[0] if relativo else 0),
                         destino[1] + (atual[1] if relativo else 0)]
            if letra == 'M' and not pontos:
                inicio = list(atual)
            pontos.append(tuple(atual))

    if len(pontos) < 3:
        return 0.0
    soma = 0.0
    for i in range(len(pontos)):
        x1, y1 = pontos[i]
        x2, y2 = pontos[(i + 1) % len(pontos)]
        soma += x1 * y2 - x2 * y1
    return abs(soma) / 2.0


def _aparencia_area_da_forma(elemento):
    """Área pintada da forma, e o comprimento do seu contorno."""
    marca = _aparencia_sem_namespace(elemento.tag)
    numero = lambda nome, padrao=0.0: float(elemento.get(nome, padrao) or padrao)
    try:
        if marca == 'rect':
            largura, altura = numero('width'), numero('height')
            return (largura * altura, 2 * (largura + altura))
        if marca == 'circle':
            raio = numero('r')
            return (math.pi * raio * raio, 2 * math.pi * raio)
        if marca == 'ellipse':
            rx, ry = numero('rx'), numero('ry')
            return (math.pi * rx * ry, math.pi * (rx + ry))
        if marca == 'line':
            comprimento = math.hypot(numero('x2') - numero('x1'),
                                     numero('y2') - numero('y1'))
            return (0.0, comprimento)
        if marca in ('polygon', 'polyline'):
            numeros = _aparencia_numeros(elemento.get('points', ''))
            pontos = list(zip(numeros[0::2], numeros[1::2]))
            if len(pontos) < 3:
                return (0.0, 0.0)
            soma = sum(pontos[i][0] * pontos[(i + 1) % len(pontos)][1]
                       - pontos[(i + 1) % len(pontos)][0] * pontos[i][1]
                       for i in range(len(pontos)))
            perimetro = sum(math.hypot(pontos[(i + 1) % len(pontos)][0] - pontos[i][0],
                                       pontos[(i + 1) % len(pontos)][1] - pontos[i][1])
                            for i in range(len(pontos)))
            return (abs(soma) / 2.0, perimetro)
        if marca == 'path':
            area = _aparencia_area_do_path(elemento.get('d', ''))
            return (area, 4 * math.sqrt(area) if area > 0 else 0.0)
    except (TypeError, ValueError):
        return (0.0, 0.0)
    return (0.0, 0.0)


def aparencia_pesos_do_svg(caminho):
    """→ ([(rgb, area)], largura, altura) ou (None, 0, 0)."""
    try:
        arvore = ET.parse(caminho)
        raiz = arvore.getroot()
    except Exception:
        return (None, 0, 0)

    largura = altura = 0
    caixa = _aparencia_numeros(raiz.get('viewBox') or '')
    if len(caixa) == 4:
        largura, altura = int(caixa[2]), int(caixa[3])
    for nome, destino in (('width', 'l'), ('height', 'a')):
        numeros = _aparencia_numeros(raiz.get(nome) or '')
        if numeros:
            if destino == 'l':
                largura = int(numeros[0])
            else:
                altura = int(numeros[0])

    pesos = {}
    # A forma sem `fill` escrito é preta — é o padrão do SVG, e é por isso que um
    # ícone monocromático sumiria se a herança começasse vazia.
    # Pilha, e não recursão, pela mesma razão da varredura de texto: um arquivo
    # com aninhamento fundo não pode derrubar a rodada inteira.
    pilha = [(raiz, {'fill': '#000000', 'stroke': 'none', 'stroke-width': '1'})]
    while pilha:
        elemento, herdado = pilha.pop()
        pintura = _aparencia_pintura(elemento, herdado)
        area, contorno = _aparencia_area_da_forma(elemento)
        if area or contorno:
            cor_fundo = (pintura.get('fill') or '').strip()
            if area and cor_fundo.lower() not in APARENCIA_SVG_PINTURA_VAZIA:
                rgb = aparencia_interpretar_cor(cor_fundo)
                if rgb:
                    pesos[rgb] = pesos.get(rgb, 0.0) + area
            cor_traco = (pintura.get('stroke') or '').strip()
            if contorno and cor_traco.lower() not in APARENCIA_SVG_PINTURA_VAZIA:
                rgb = aparencia_interpretar_cor(cor_traco)
                if rgb:
                    espessura = _aparencia_numeros(pintura.get('stroke-width') or '1')
                    pesos[rgb] = pesos.get(rgb, 0.0) + contorno * (espessura[0] if espessura else 1.0)
        for filho in list(elemento):
            pilha.append((filho, pintura))
    if not pesos:
        return ([], largura, altura)
    return (list(pesos.items()), largura, altura)


# ── A ficha de cada imagem ──────────────────────────────────────────────────
def aparencia_rotulo_de_formato(extensao):
    """'.png' → 'PNG'. Extensão fora do catálogo vira o próprio nome.

    ⚠️ Não devolve `None` para o que não está no catálogo. O catálogo é só o
    PADRÃO DE FÁBRICA — quem manda é a lista da tela (Configurações → Aparência),
    e o usuário pode acrescentar `.gif` ou `.bmp` ali. Recusar o que a tela
    prometeu ler seria a tela mentindo em silêncio.
    """
    return APARENCIA_EXTENSOES_IMAGEM.get(
        (extensao or '').lower(), (extensao or '').lstrip('.').upper())


def aparencia_ficha_de_imagem(caminho, relativo, maximo_familias=None):
    """Tudo o que o índice guarda de uma imagem. `None` se não deu para ler."""
    extensao = os.path.splitext(caminho)[1].lower()
    try:
        tamanho = os.path.getsize(caminho)
    except OSError:
        return None
    if tamanho > APARENCIA_LIMITE_BYTES_IMAGEM:
        return None

    # `.svg` é o único que se lê por geometria; qualquer outro formato vai para a
    # Pillow, que devolve `None` sozinha se não souber abrir aquele tipo.
    if extensao == '.svg':
        pesos, largura, altura = aparencia_pesos_do_svg(caminho)
    else:
        pesos, largura, altura = aparencia_pesos_do_raster(caminho)
    if pesos is None:
        return None

    maximo = maximo_familias or APARENCIA_FAMILIAS_POR_IMAGEM
    familias = aparencia_agrupar_por_familia(pesos, maximo)
    return {
        'tipo': 'imagem',
        'arquivo': relativo,
        'absoluto': caminho,
        'nome': os.path.basename(caminho),
        'formato': aparencia_rotulo_de_formato(extensao),
        'largura': largura,
        'altura': altura,
        'bytes': tamanho,
        'familias': familias,
        # `comparavel` é o que a busca por texto usa: em imagem, texto É o nome
        # do arquivo. Preenchido por quem monta o índice, que tem o normalizador.
        'comparavel': '',
    }


def aparencia_casar_imagem(ficha, alvo, tolerancia, presenca_minima):
    """A imagem tem a cor procurada? → a família casada, ou None.

    Os dois controles são eixos DIFERENTES e não se substituem:
      · tolerância    → "é esse verde?"           (distância até a cor)
      · presença      → "esse verde manda aqui?"  (fatia da área)

    Família abaixo da presença não é descartada: volta marcada `abaixo=True`,
    para o cartão aparecer apagado com o aviso em vez de sumir sem explicação.
    """
    melhor = None
    for familia in ficha.get('familias', []):
        distancia = aparencia_distancia(alvo, tuple(familia['cor']))
        if distancia > float(tolerancia):
            continue
        candidato = dict(familia)
        candidato['distancia'] = round(distancia, 1)
        candidato['abaixo'] = familia['fatia'] < float(presenca_minima)
        if melhor is None:
            melhor = candidato
            continue
        # Uma que passa no corte sempre ganha de uma que não passa; entre iguais,
        # ganha a de maior fatia.
        if (not candidato['abaixo'], candidato['fatia']) > (not melhor['abaixo'], melhor['fatia']):
            melhor = candidato
    return melhor


def aparencia_miniatura(caminho, lado=96):
    """A imagem como data-URI, para o cartão poder desenhá-la sem servidor.

    O `.svg` vai inteiro: é texto, já é pequeno, e desenha em qualquer tamanho.
    O resto passa pela Pillow e volta como PNG pequeno.
    """
    extensao = os.path.splitext(caminho)[1].lower()
    try:
        if extensao == '.svg':
            with open(caminho, 'rb') as arquivo:
                dados = arquivo.read(APARENCIA_LIMITE_BYTES_IMAGEM)
            return 'data:image/svg+xml;base64,' + base64.b64encode(dados).decode('ascii')
        from PIL import Image
        import io
        with Image.open(caminho) as imagem:
            imagem = imagem.convert('RGBA')
            imagem.thumbnail((lado, lado))
            memoria = io.BytesIO()
            imagem.save(memoria, format='PNG')
        return 'data:image/png;base64,' + base64.b64encode(memoria.getvalue()).decode('ascii')
    except Exception:
        return ''
