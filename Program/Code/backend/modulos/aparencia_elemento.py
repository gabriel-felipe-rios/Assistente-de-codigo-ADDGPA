from .constantes import *
from .aparencia_cor import (
    APARENCIA_RE_HEX, APARENCIA_RE_RGB, APARENCIA_RE_HEXADECIMAL,
    APARENCIA_RE_FROMARGB, APARENCIA_RE_TOKEN_USO, APARENCIA_RE_TOKEN_DEFINICAO,
    APARENCIA_RE_TRIPLA, aparencia_expandir_hex, aparencia_interpretar_cor,
    aparencia_para_hex, aparencia_agrupar_por_familia, aparencia_familia)

# ══════════════════════════════════════ APARÊNCIA · ELEMENTO: QUEM PINTA O QUÊ ══
# Antes, cada cor citada numa linha virava um achado solto. Isso é fiel ao
# arquivo e infiel ao desenho: `linear-gradient(#3498DB, #2ECC71)` não são dois
# botões azul e verde, é UM botão com duas cores; e o `border` de um seletor não
# tem o mesmo peso visual que o `background` do mesmo seletor.
#
# Elemento é a resposta a "quais cores pintam a mesma coisa, e que fatia cada uma
# ocupa". Ele NÃO substitui o achado: cada cor continua tendo o seu arquivo e a
# sua linha. O que ele acrescenta é o vínculo entre elas.
#
# ⚠️ As fatias por propriedade abaixo são convenção, não medição. Ninguém aqui
# renderiza a página para saber quantos pixels o `border` realmente ocupa — o
# que se afirma é só a ORDEM: fundo domina, texto vem depois, borda e sombra são
# fatia mínima. Se um caso real não couber, ajuste a tabela e diga por quê.

APARENCIA_PESO_PROPRIEDADE = (
    (('background', 'background-color', 'background-image', 'bg', 'fill',
      'backgroundcolor', 'backcolor'), 1.00),
    (('color', 'colour', 'forecolor', 'text-color', 'textcolor', 'stroke'), 0.25),
    (('border', 'border-color', 'border-top', 'border-right', 'border-bottom',
      'border-left', 'border-top-color', 'border-right-color',
      'border-bottom-color', 'border-left-color', 'outline', 'outline-color',
      'bordercolor'), 0.12),
    (('box-shadow', 'text-shadow', 'shadow', 'filter'), 0.08),
)
APARENCIA_PESO_PADRAO = 0.50      # cor sem propriedade reconhecida

APARENCIA_RE_PROPRIEDADE = re.compile(r'^\s*[\'"]?(-{0,2}[A-Za-z][\w-]*)[\'"]?\s*[:=]')
APARENCIA_RE_GRADIENTE = re.compile(
    r'\b(?:repeating-)?(?:linear|radial|conic)-gradient\s*\(', re.IGNORECASE)
APARENCIA_RE_PARADA_POSICAO = re.compile(r'(-?[\d.]+)\s*%')
APARENCIA_RE_DIRECAO = re.compile(
    r'^\s*(?:to\s+|[-\d.]+(?:deg|rad|grad|turn)\b|circle\b|ellipse\b|at\s+|from\s+)',
    re.IGNORECASE)


def aparencia_peso_da_propriedade(propriedade):
    """Fatia que a propriedade ocupa no elemento. Ver a ressalva no topo."""
    nome = (propriedade or '').strip().lower().lstrip('-')
    if not nome:
        return APARENCIA_PESO_PADRAO
    for nomes, peso in APARENCIA_PESO_PROPRIEDADE:
        if nome in nomes:
            return peso
    for nomes, peso in APARENCIA_PESO_PROPRIEDADE:
        if any(nome.startswith(n) for n in nomes):
            return peso
    return APARENCIA_PESO_PADRAO


def _aparencia_bloco_balanceado(texto, inicio):
    """Do '(' em `inicio` até o ')' que o fecha. → (conteudo, posicao_do_fecha)."""
    profundidade = 0
    for i in range(inicio, len(texto)):
        if texto[i] == '(':
            profundidade += 1
        elif texto[i] == ')':
            profundidade -= 1
            if profundidade == 0:
                return texto[inicio + 1:i], i
    return texto[inicio + 1:], len(texto)


def _aparencia_partir_no_topo(texto):
    """Divide por vírgula ignorando as que estão dentro de parênteses."""
    partes, atual, profundidade = [], [], 0
    for caractere in texto:
        if caractere == '(':
            profundidade += 1
        elif caractere == ')':
            profundidade -= 1
        if caractere == ',' and profundidade == 0:
            partes.append(''.join(atual))
            atual = []
            continue
        atual.append(caractere)
    partes.append(''.join(atual))
    return [p.strip() for p in partes if p.strip()]


def aparencia_fatias_do_gradiente(conteudo):
    """Conteúdo de um gradient() → [(texto_da_parada, fatia 0–1)].

    Sem posição escrita, divide igual — é a leitura honesta de
    `linear-gradient(#3498DB, #2ECC71)`, que é meio a meio. Com posição escrita,
    cada parada leva metade da distância até cada vizinha; as das pontas levam
    só o lado de dentro.
    """
    paradas = _aparencia_partir_no_topo(conteudo)
    if paradas and APARENCIA_RE_DIRECAO.match(paradas[0]):
        paradas = paradas[1:]        # 'to right', '45deg', 'circle at center'
    if not paradas:
        return []
    if len(paradas) == 1:
        return [(paradas[0], 1.0)]

    posicoes = []
    for parada in paradas:
        achado = APARENCIA_RE_PARADA_POSICAO.search(parada)
        posicoes.append(float(achado.group(1)) if achado else None)

    if all(p is None for p in posicoes):
        fatia = 1.0 / len(paradas)
        return [(parada, fatia) for parada in paradas]

    # Completa o que não foi escrito: pontas ancoradas em 0 e 100, o miolo
    # interpolado entre as posições conhecidas mais próximas.
    if posicoes[0] is None:
        posicoes[0] = 0.0
    if posicoes[-1] is None:
        posicoes[-1] = 100.0
    for i, valor in enumerate(posicoes):
        if valor is not None:
            continue
        anterior = i - 1
        while posicoes[anterior] is None:
            anterior -= 1
        seguinte = i + 1
        while seguinte < len(posicoes) and posicoes[seguinte] is None:
            seguinte += 1
        if seguinte >= len(posicoes):
            posicoes[i] = posicoes[anterior]
            continue
        passo = (posicoes[seguinte] - posicoes[anterior]) / (seguinte - anterior)
        posicoes[i] = posicoes[anterior] + passo * (i - anterior)

    areas = []
    for i in range(len(posicoes)):
        antes = (posicoes[i] - posicoes[i - 1]) / 2 if i > 0 else 0.0
        depois = (posicoes[i + 1] - posicoes[i]) / 2 if i < len(posicoes) - 1 else 0.0
        areas.append(max(0.0, antes + depois))
    total = sum(areas)
    if total <= 0:
        fatia = 1.0 / len(paradas)
        return [(parada, fatia) for parada in paradas]
    return [(paradas[i], areas[i] / total) for i in range(len(paradas))]


def _aparencia_cores_cruas(texto, tokens):
    """Todas as cores citadas num trecho, em qualquer notação. → [(rgb, bruto, via_token)]"""
    achados = []
    for casamento in APARENCIA_RE_HEX.finditer(texto):
        achados.append((aparencia_expandir_hex(casamento.group(1)), casamento.group(0), None))
    for casamento in APARENCIA_RE_RGB.finditer(texto):
        valores = tuple(min(255, int(casamento.group(i))) for i in (1, 2, 3))
        achados.append((valores, casamento.group(0), None))
    for casamento in APARENCIA_RE_FROMARGB.finditer(texto):
        grupos = [g for g in casamento.groups() if g is not None]
        numeros = [min(255, int(g)) for g in grupos]
        if len(numeros) == 4:      # FromArgb(a, r, g, b)
            numeros = numeros[1:]
        achados.append((tuple(numeros), casamento.group(0), None))
    for casamento in APARENCIA_RE_HEXADECIMAL.finditer(texto):
        bruto = casamento.group(1)
        corpo = bruto[2:] if len(bruto) == 8 else bruto     # 0xAARRGGBB
        achados.append((aparencia_expandir_hex(corpo), casamento.group(0), None))
    for casamento in APARENCIA_RE_TOKEN_USO.finditer(texto):
        nome = casamento.group(1)
        if nome in tokens:
            achados.append((tokens[nome], casamento.group(0) + ')', nome))
    return achados


def aparencia_cores_da_linha(linha, tokens):
    """Cores de uma linha, já com a propriedade que as pinta e o peso de cada uma.

    → [{'rgb', 'bruto', 'via_token', 'propriedade', 'peso'}]

    O peso é a fatia RELATIVA dentro da linha; quem normaliza para 100% é
    `aparencia_montar_elementos`, porque a fatia só faz sentido depois que todas
    as linhas do mesmo elemento chegaram.
    """
    achado_propriedade = APARENCIA_RE_PROPRIEDADE.match(linha)
    propriedade = achado_propriedade.group(1) if achado_propriedade else ''
    peso_base = aparencia_peso_da_propriedade(propriedade)

    # Os gradientes primeiro: as cores de dentro deles saem do texto restante
    # para não serem contadas duas vezes.
    saida = []
    restante = linha
    while True:
        achado = APARENCIA_RE_GRADIENTE.search(restante)
        if not achado:
            break
        conteudo, fim = _aparencia_bloco_balanceado(restante, achado.end() - 1)
        for parada, fatia in aparencia_fatias_do_gradiente(conteudo):
            for rgb, bruto, via_token in _aparencia_cores_cruas(parada, tokens):
                saida.append({
                    'rgb': rgb, 'bruto': bruto, 'via_token': via_token,
                    'propriedade': propriedade or 'background-image',
                    'peso': peso_base * fatia,
                })
        restante = restante[:achado.start()] + ' ' + restante[fim + 1:]

    for rgb, bruto, via_token in _aparencia_cores_cruas(restante, tokens):
        saida.append({
            'rgb': rgb, 'bruto': bruto, 'via_token': via_token,
            'propriedade': propriedade, 'peso': peso_base,
        })
    return saida


# ── Tokens de cor ───────────────────────────────────────────────────────────
# ⚠️ Dois enganos moravam aqui, e os dois faziam a cor PRINCIPAL do programa
# ficar invisível para a busca. Este projeto escreve o tema assim:
#
#     --green-rgb: 46,204,113;
#     --green:     rgb(var(--green-rgb));
#     .btn-positive { background: var(--green); }
#
#   1. **Indireção.** `rgb(var(--green-rgb))` não é uma cor legível de primeira:
#      é uma cor que aponta para outro token. Sem resolver isso, `--green` nunca
#      entrava no mapa, e o verde do botão "Novo projeto" não era encontrado por
#      cor nenhuma — só pelo texto.
#   2. **Temas em conflito.** Os três arquivos de tema declaram os MESMOS nomes
#      com valores diferentes, e o último lido vencia: procurar o verde do tema
#      Ardósia devolvia o verde do tema Papel. Quem vence agora é o **tema
#      ativo**, porque é a cor que o usuário está de fato vendo na tela.
APARENCIA_RE_ARQUIVO_DE_TEMA = re.compile(r'^tema-([\w-]+)\.css$', re.IGNORECASE)
APARENCIA_RE_VAR_ANINHADO = re.compile(r'var\(\s*(--[\w-]+)')
APARENCIA_EXTENSOES_DE_ESTILO = ('.css', '.scss', '.sass', '.less')
APARENCIA_PROFUNDIDADE_TOKEN = 6      # teto de saltos de indireção


def aparencia_tema_ativo():
    """O tema escolhido em Configurações → Temas. `'ardosia'` se algo falhar."""
    try:
        # ⚠️ Pelo leitor, e não abrindo o `settings.json`: desde 23/09/2026 o
        # tema mora em `temas.json`, e a leitura direta devolveria o padrão
        # sempre, em silêncio. Import preguiçoso para não fechar ciclo com
        # `constantes` (mesmo motivo de `linguagens.py`).
        from .configuracoes import carregar_settings
        from .constantes import TEMA_PADRAO
        return (carregar_settings().get('tema') or TEMA_PADRAO).lower()
    except Exception:
        try:
            from .constantes import TEMA_PADRAO
            return TEMA_PADRAO
        except Exception:
            return 'ardosia'


def _aparencia_prioridade_do_arquivo(caminho, tema_ativo):
    """0 = vale; 1 = só vale se ninguém melhor tiver definido o mesmo nome."""
    achado = APARENCIA_RE_ARQUIVO_DE_TEMA.match(os.path.basename(caminho))
    if not achado:
        return 0                                   # arquivo comum
    return 0 if achado.group(1).lower() == tema_ativo else 1


def _aparencia_valor_para_cor(valor, resolvidos):
    """Um valor de token → (r,g,b), ou `None` se ainda depende de outro token."""
    valor = (valor or '').strip().rstrip(';').strip()
    tripla = APARENCIA_RE_TRIPLA.match(valor)
    if tripla:
        return tuple(min(255, int(tripla.group(i))) for i in (1, 2, 3))
    cor = aparencia_interpretar_cor(valor)
    if cor:
        return cor
    # `rgb(var(--x))`, `rgba(var(--x), .5)` e o `var(--x)` seco caem todos aqui:
    # o que importa é para qual token o valor aponta.
    apontado = APARENCIA_RE_VAR_ANINHADO.search(valor)
    if apontado:
        return resolvidos.get(apontado.group(1))
    return None


def aparencia_coletar_tokens(leitor, arquivos):
    """Mapa dos tokens de cor do projeto (CSS/SCSS): '--green' → (r,g,b)."""
    tema_ativo = aparencia_tema_ativo()
    bruto = {}
    prioridade = {}
    for caminho in arquivos:
        if os.path.splitext(caminho)[1].lower() not in APARENCIA_EXTENSOES_DE_ESTILO:
            continue
        linhas = leitor(caminho)
        if linhas is None:
            continue
        peso = _aparencia_prioridade_do_arquivo(caminho, tema_ativo)
        for linha in linhas:
            for nome, valor in APARENCIA_RE_TOKEN_DEFINICAO.findall(linha):
                if nome in prioridade and prioridade[nome] < peso:
                    continue          # tema não ativo não sobrescreve o ativo
                bruto[nome] = valor.strip().rstrip(';').strip()
                prioridade[nome] = peso

    # Resolve em passadas: `--green` só fica pronto depois de `--green-rgb`, e a
    # ordem em que os dois aparecem no arquivo não é garantida. Para de rodar
    # quando uma passada inteira não resolve nada novo — token que aponta para um
    # que não existe fica de fora, em vez de travar o laço.
    resolvidos = {}
    pendentes = dict(bruto)
    for _ in range(APARENCIA_PROFUNDIDADE_TOKEN):
        avancou = False
        for nome, valor in list(pendentes.items()):
            cor = _aparencia_valor_para_cor(valor, resolvidos)
            if cor:
                resolvidos[nome] = cor
                pendentes.pop(nome)
                avancou = True
        if not avancou:
            break
    return resolvidos


def aparencia_montar_elementos(ocorrencias):
    """Costura as ocorrências de cor em elementos e devolve a ficha de cada um.

    → {chave: {'nome', 'arquivo', 'cores': [...], 'familias': [...]}}

    Escreve de volta em cada ocorrência: `fatia` (a sua, no elemento) e
    `familia`. É o mesmo agrupamento por família que as imagens usam — de
    propósito: "esse botão é vermelho" e "essa imagem é vermelha" têm que ser a
    mesma pergunta, ou os dois lados da busca discordam.
    """
    grupos = {}
    for ocorrencia in ocorrencias:
        if ocorrencia.get('tipo') != 'cor':
            continue
        chave = ocorrencia.get('elemento_chave')
        if not chave:
            continue
        grupos.setdefault(chave, []).append(ocorrencia)

    elementos = {}
    for chave, lista in grupos.items():
        total = sum(max(0.0, o.get('peso', 0.0)) for o in lista) or 1.0
        cores = {}
        for ocorrencia in lista:
            fatia = max(0.0, ocorrencia.get('peso', 0.0)) / total * 100
            ocorrencia['fatia'] = round(fatia, 1)
            chave_cor = ocorrencia['valor']
            item = cores.setdefault(chave_cor, {
                'hex': chave_cor, 'rgb': list(ocorrencia['rgb']), 'fatia': 0.0})
            item['fatia'] += fatia

        familias = aparencia_agrupar_por_familia(
            [(tuple(o['rgb']), max(0.0, o.get('peso', 0.0))) for o in lista])
        for ocorrencia in lista:
            ocorrencia['familia'] = aparencia_familia(tuple(ocorrencia['rgb']))[0]

        ordenadas = sorted(cores.values(), key=lambda c: -c['fatia'])
        for cor in ordenadas:
            cor['fatia'] = round(cor['fatia'], 1)
        primeiro = lista[0]
        elementos[chave] = {
            'nome': primeiro.get('elemento') or primeiro.get('alvo') or '',
            'arquivo': primeiro.get('arquivo', ''),
            'cores': ordenadas,
            'familias': familias,
        }
        for ocorrencia in lista:
            ocorrencia['cores_do_elemento'] = len(ordenadas)
    return elementos


def aparencia_resumo_do_elemento(elemento):
    """Uma linha legível: 'Azul 62% · Verde 38%'. Alimenta o cartão da tela."""
    if not elemento:
        return ''
    return ' · '.join('%s %.0f%%' % (f['rotulo'], f['fatia'])
                      for f in elemento.get('familias', [])[:4])
