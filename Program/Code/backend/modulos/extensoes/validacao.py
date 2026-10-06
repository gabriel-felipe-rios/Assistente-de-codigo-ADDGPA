"""Os dois formatos do `extensao.json` — ler o NOVO e traduzir o ANTIGO para
uma forma só.

Pergunta que este arquivo responde: "o que esta extensão acrescenta ao
programa, item por item, e qual item não vale?". Quem o chama é
`manifesto.ler_manifesto`, que continua sendo a porta única (e o dono da regra
«silêncio aqui é o pior resultado possível»): nada aqui lança, todo erro vira
texto.

  - **Formato novo** (tem a chave `acrescenta`, mesmo vazia): `prefixo` (o
    dono), `tipos` de 1 a 4 e a lista `acrescenta`, um item por peça — cada um
    com `recurso`, `id` e lugar. O item que falha NÃO entra, e o erro diz qual
    (`acrescenta[3] (erl.comandos): …`); o resto da extensão liga.
  - **Formato antigo** (sem `acrescenta`): `tipos` com os números de 1 a 27 e
    os campos `encaixes`, `eventos`, `consultas`, `dados`. Continua ligando
    (D36): os validadores de sempre rodam como estão, e cada resultado vira um
    item de `acrescenta` com `id` gerado (`#encaixe-0`…), sem prefixo. A
    tradução mora em `validacao_antigo.py` (fase 07, teto de 500 linhas).

⚠️ Os números antigos e novos SE SOBREPÕEM ("2" antigo é Categoria de
Configurações, "2" novo é Muda uma tela). A única forma segura de saber o
formato é a presença de `acrescenta` — nunca adivinhe pelo número.

`derivar_campos_da_tela` faz o caminho de volta: de `acrescenta` para os
quatro campos que o frontend de hoje lê (`encaixes`, `eventos`, `consultas`,
`dados`). Com isso `carga.js`, `encaixes.js`, `eventos.js`, `consulta.js` e
`dados.js` não precisam saber que o manifesto mudou.

⚠️ Import: `manifesto → validacao → encaixes/eventos/consulta`. Nunca importe
`descoberta` aqui — fecharia o ciclo (ver `encaixes.py`).
"""

import os

from .constantes import (XT_TIPOS_VALIDOS, XT_RECURSOS, XT_RECURSOS_FASE,
                         XT_EDITOR_PARTES, XT_VISUAL_PARTES, XT_PREFIXO_RE,
                         XT_PREFIXOS_PROIBIDOS, XT_ID_RE, XT_BOOT_ENTRY, XT_TELA,
                         caminho_absoluto, erro_do_arquivo_declarado)
from .encaixes import XT_PONTOS_POR_NOME, validar_item_tela
from .eventos import XT_EVENTOS_POR_NOME
from .consulta import XT_CONSULTAS, XT_TETO_CONSULTA_PADRAO_MS
from .validacao_agente import validar_item_agente
# Os dois recursos da fase 07 (D51, D52), cada um na sua irmã.
from .validacao_ferramenta import nomes_declarados, validar_item_ferramenta
from .validacao_prompt import validar_item_prompt

# O que cada parte de "dado" vira POR DENTRO: a chave interna de `dados` que
# `dados.py` e o frontend (`xtDadosDoTipo('11'|'24')`) ainda usam até a fase
# 13, e se ela aponta uma PASTA (as 297 gramáticas) ou um arquivo.
# ⚠️ '11' e '24' são chave interna — nunca aparecem no manifesto novo nem na tela.
DADOS_INTERNOS = {('editor', 'cor'): '11', ('visual', 'icones'): '24'}
DADOS_EM_PASTA = frozenset({'11'})
_DADOS_DE_VOLTA = {v: k for k, v in DADOS_INTERNOS.items()}

# Que tipo cada recurso costuma pedir (a coluna "Recursos típicos" dos quatro
# tipos) — só para DEDUZIR os tipos de um manifesto antigo que não diz nenhum
# número traduzível. Comando no Acesso rápido é 3; em menu, barra ou cartão, 2.
_TIPO_TIPICO = {'tela': '1', 'painel': '2', 'marca': '2', 'segundo-plano': '3',
                'reacao': '3', 'editor': '4', 'visual': '4', 'agente': '4',
                'ferramenta': '4', 'prompt': '4'}

_CAMPOS_ANTIGOS = ('encaixes', 'eventos', 'consultas', 'dados')


def _lista(bruto, campo):
    if bruto is None:
        return [], []
    if not isinstance(bruto, list):
        return ['`%s` precisa ser uma lista, e veio %s.' % (campo, type(bruto).__name__)], []
    return [], bruto


def _ler_tipos(bruto, traduzir):
    """`(erros, tipos)`. `traduzir` é a função que leva um número ao tipo novo
    — ou devolve `(None, erro)`. Os válidos ficam: a extensão que declarou
    três e errou um ainda funciona nos dois."""
    if bruto is None:
        return ['`tipos` não foi declarado. Sem ele o programa não sabe o que '
                'carregar da extensão.'], []
    if not isinstance(bruto, list):
        return ['`tipos` precisa ser uma lista, e veio %s.' % type(bruto).__name__], []
    if not bruto:
        return ['`tipos` está vazio. Declare ao menos um dos 4 tipos.'], []
    erros, tipos = [], []
    for t in bruto:
        novo, erro = traduzir(str(t).strip())
        if erro:
            erros.append(erro)
        elif novo and novo not in tipos:
            tipos.append(novo)
    return erros, tipos


def _tipo_novo(chave):
    if chave in XT_TIPOS_VALIDOS:
        return chave, None
    return None, 'tipo desconhecido: "%s". Os tipos vão de 1 a 4.' % chave


def tipos_deduzidos(acrescenta):
    """Os tipos que os recursos de `acrescenta` pedem, na ordem 1→4."""
    achados = set()
    for item in acrescenta:
        r = item['recurso']
        if r == 'comando':
            lugares = item.get('lugares') or []
            if 'acesso-rapido.comandos' in lugares:
                achados.add('3')
            if any(l != 'acesso-rapido.comandos' for l in lugares):
                achados.add('2')
        elif r in _TIPO_TIPICO:
            achados.add(_TIPO_TIPICO[r])
    return sorted(achados)


# ── O formato novo ──────────────────────────────────────────────────────

def _erro_da_pasta_declarada(caminho_relativo, pasta, rotulo):
    """A irmã de `erro_do_arquivo_declarado` para quem aponta uma PASTA (a cor
    do código: o autoloader do Prism pede um `.js` por linguagem)."""
    if not pasta:
        return '%s: falta a `pasta`.' % rotulo
    if pasta.startswith('/') or '..' in pasta.replace('\\', '/').split('/'):
        return ('%s: `pasta` precisa ficar dentro da pasta da extensão '
                '(sem `..` e sem barra inicial).' % rotulo)
    if not os.path.isdir(os.path.join(caminho_absoluto(caminho_relativo),
                                      pasta.replace('/', os.sep))):
        return '%s: a pasta "%s" não existe na pasta da extensão.' % (rotulo, pasta)
    return None


def _texto(item, campo):
    v = item.get(campo)
    return v.strip() if isinstance(v, str) else ''


def _lugares_do_item(item, recurso, rotulo):
    """`(erro, [lugares])` — `lugares` (lista) ou `lugar` (texto). Cada um
    tem de existir PARA ESTE recurso (`XT_PONTOS[...]['recursos']`)."""
    if recurso == 'comando' and item.get('lugares') is not None:
        bruto = item.get('lugares')
        if not isinstance(bruto, list) or not bruto:
            return '%s: `lugares` precisa ser uma lista com ao menos um lugar.' % rotulo, []
        lugares = [str(l).strip() for l in bruto]
    else:
        lugar = _texto(item, 'lugar') or ('editor.decorador' if recurso == 'marca' else '')
        if not lugar:
            return '%s: falta o `lugar`.' % rotulo, []
        lugares = [lugar]
    for lugar in lugares:
        ponto = XT_PONTOS_POR_NOME.get(lugar)
        if ponto is None or recurso not in ponto.get('recursos', []):
            aceitos = sorted(n for n, p in XT_PONTOS_POR_NOME.items()
                             if recurso in p.get('recursos', []))
            return ('%s: o lugar "%s" não existe para o recurso "%s". Os que existem '
                    'hoje são: %s.' % (rotulo, lugar, recurso, ', '.join(aceitos))), []
    if len(set(lugares)) != len(lugares):
        return '%s: o mesmo lugar aparece duas vezes em `lugares`.' % rotulo, []
    return None, lugares


def validar_item(caminho_relativo, prefixo, i, item, usados):
    """Confere UM item de `acrescenta`. Devolve `(erros, normalizado)`, com
    `normalizado = None` quando o item não carrega.

    `usados` é o estado da extensão inteira (ids, pontos, eventos, consultas,
    chaves de dado já tomados por itens ANTERIORES): o registro da tela guarda
    UMA função por extensão por ponto/evento/consulta, e a segunda declaração
    apagaria a primeira em silêncio — por isso o segundo item é o recusado.
    """
    if not isinstance(item, dict):
        return ['acrescenta[%d] precisa ser um objeto `{"recurso": …, "id": …}`, e veio %s.'
                % (i, type(item).__name__)], None
    id_ = item.get('id')
    rotulo = 'acrescenta[%d]%s' % (i, ' (%s)' % id_ if isinstance(id_, str) and id_ else '')

    # 1. o recurso
    recurso = _texto(item, 'recurso')
    if recurso not in XT_RECURSOS:
        return ['%s: recurso desconhecido "%s". Os que existem são: %s.'
                % (rotulo, recurso, ', '.join(XT_RECURSOS))], None
    if not XT_RECURSOS[recurso]['pronto']:
        return ['%s: o recurso "%s" chega na fase %s — este item não carregou.'
                % (rotulo, recurso, XT_RECURSOS_FASE.get(recurso, '?'))], None

    # 2. o id: `{prefixo}.{nome}`, único
    if not isinstance(id_, str) or not id_.strip():
        return ['%s: falta o `id` (`%s.nome`).' % (rotulo, prefixo)], None
    id_ = id_.strip()
    if not id_.startswith(prefixo + '.'):
        return ['%s: o id precisa começar por "%s."' % (rotulo, prefixo)], None
    if not XT_ID_RE.match(id_[len(prefixo) + 1:]):
        return ['%s: depois de "%s." o id só aceita letras minúsculas, dígitos e `-`.'
                % (rotulo, prefixo)], None
    if id_ in usados['ids']:
        return ['%s: o id "%s" já foi usado acima.' % (rotulo, id_)], None

    avisos = []
    norm = {'recurso': recurso, 'id': id_}

    # 3 e 4. lugar e arquivo, conforme o recurso
    if recurso in ('marca', 'painel', 'comando'):
        erro, lugares = _lugares_do_item(item, recurso, rotulo)
        if erro:
            return [erro], None
        repetidos = [l for l in lugares if l in usados['pontos']]
        if repetidos:
            return ['%s: o lugar "%s" já foi declarado acima. Um lugar por extensão — '
                    'junte os dois num arquivo só.' % (rotulo, repetidos[0])], None
        arquivo = _texto(item, 'arquivo')
        erro = erro_do_arquivo_declarado(caminho_relativo, arquivo, rotulo)
        if erro:
            return [erro], None
        if recurso == 'comando':
            teclas = item.get('teclas', {})
            if not isinstance(teclas, dict) or not all(
                    isinstance(k, str) and isinstance(v, str) for k, v in teclas.items()):
                return ['%s: `teclas` precisa ser um objeto `{"id-do-comando": "Ctrl+Alt+X"}`.'
                        % rotulo], None
            norm.update(lugares=lugares, arquivo=arquivo, teclas=dict(teclas))
        else:
            norm.update(lugar=lugares[0], arquivo=arquivo)
        usados['pontos'].update(lugares)

    elif recurso == 'tela':
        # Não entra em `usados['pontos']`: duas telas da mesma extensão no
        # mesmo lugar valem (ids diferentes). O catálogo e a regra moram em
        # `encaixes.validar_item_tela`, ao lado de `XT_LUGARES_DE_TELA`.
        erro, dados = validar_item_tela(caminho_relativo, item, rotulo)
        if erro:
            return [erro], None
        norm.update(dados)

    elif recurso == 'reacao':
        evento = _texto(item, 'evento')
        catalogo = XT_EVENTOS_POR_NOME.get(evento)
        if catalogo is None:
            return ['%s: evento desconhecido "%s". Os que existem hoje são: %s.'
                    % (rotulo, evento, ', '.join(sorted(XT_EVENTOS_POR_NOME)))], None
        if evento in usados['eventos']:
            return ['%s: o evento "%s" já foi assinado acima. Uma reação por evento — a '
                    'função pode barrar OU só observar, não as duas.' % (rotulo, evento)], None
        arquivo = _texto(item, 'arquivo')
        # Evento do lado BACKEND não tem arquivo: quem recebe é o `ao_evento`
        # de `backend/extensao.py` (mesma regra de `validar_eventos`).
        if catalogo['lado'] != 'backend' or arquivo:
            erro = erro_do_arquivo_declarado(caminho_relativo, arquivo, rotulo)
            if erro:
                return [erro], None
        pode_barrar = bool(item.get('pode_barrar', False))
        # 5. barrar onde não cabe é REBAIXADO a só observar, com aviso.
        if pode_barrar and not catalogo['guardia_cabe']:
            avisos.append('%s: "%s" não aceita `pode_barrar` (não há um "antes" em que '
                          'barrar faça sentido). A reação vale depois do evento.'
                          % (rotulo, evento))
            pode_barrar = False
        norm.update(evento=evento, pode_barrar=pode_barrar, arquivo=arquivo,
                    lado=catalogo['lado'])
        usados['eventos'].add(evento)

    elif recurso in ('editor', 'visual'):
        partes = XT_EDITOR_PARTES if recurso == 'editor' else XT_VISUAL_PARTES
        parte = _texto(item, 'parte')
        if parte not in partes:
            return ['%s: a parte "%s" não existe em "%s". As que existem hoje são: %s.'
                    % (rotulo, parte, recurso, ', '.join(partes))], None
        linguagens = item.get('linguagens', ['*'])
        if recurso == 'editor':
            if (not isinstance(linguagens, list) or not linguagens
                    or not all(isinstance(l, str) and l.strip() for l in linguagens)):
                return ['%s: `linguagens` precisa ser uma lista de textos (`["*"]` = '
                        'todas).' % rotulo], None
            norm.update(parte=parte, linguagens=[l.strip() for l in linguagens])
        else:
            norm.update(parte=parte)
        chave = DADOS_INTERNOS.get((recurso, parte))
        if chave in DADOS_EM_PASTA:
            pasta = _texto(item, 'pasta')
            erro = _erro_da_pasta_declarada(caminho_relativo, pasta, rotulo)
            if erro:
                return [erro], None
            norm['pasta'] = pasta
        else:
            arquivo = _texto(item, 'arquivo')
            erro = erro_do_arquivo_declarado(caminho_relativo, arquivo, rotulo)
            if erro:
                return [erro], None
            # Trechos prontos são DADO (como os ícones): um `.json`, sem código.
            # O conteúdo é lido e conferido por `dados.py`, com o erro na tela.
            if (recurso, parte) == ('editor', 'trechos') and not arquivo.lower().endswith('.json'):
                return ['%s: "trechos prontos" é um arquivo `.json` (dado, sem código), '
                        'e veio "%s".' % (rotulo, arquivo)], None
            norm['arquivo'] = arquivo
        marca = chave or ('consulta', parte)
        if marca in usados['dados']:
            return ['%s: "%s" já foi declarado acima. Um por extensão.'
                    % (rotulo, partes[parte])], None
        usados['dados'].add(marca)

    elif recurso == 'agente':
        # As duas formas (oficina, subagente) moram em `validacao_agente.py`.
        # `usados['ferramentas']` são as que ESTA extensão declara (fase 07).
        erro, dados, avisos_agente = validar_item_agente(caminho_relativo, item, rotulo,
                                                         usados['ferramentas'])
        if erro:
            return [erro], None
        avisos.extend(avisos_agente)
        norm.update(dados)

    elif recurso in ('ferramenta', 'prompt'):
        # Fase 07 (D51, D52): as irmãs `validacao_ferramenta.py` e
        # `validacao_prompt.py`. As duas marcam `usados['pontos']`: uma
        # ferramenta por nome e um trecho por alvo, em cada extensão.
        validar = validar_item_ferramenta if recurso == 'ferramenta' else validar_item_prompt
        erro, dados, avisos_x = validar(caminho_relativo, item, rotulo, usados)
        if erro:
            return [erro], None
        avisos.extend(avisos_x)
        norm.update(dados)

    elif recurso == 'segundo-plano':
        if not os.path.isfile(os.path.join(caminho_absoluto(caminho_relativo), XT_BOOT_ENTRY)):
            return ['%s: "Em segundo plano" precisa do arquivo `%s` na raiz da extensão.'
                    % (rotulo, XT_BOOT_ENTRY)], None

    elif recurso == 'opcoes':
        if not os.path.isfile(os.path.join(caminho_absoluto(caminho_relativo), XT_TELA)):
            avisos.append('%s: "Opções" declarado, e não há `%s` — a página da '
                          'extensão sai sem opções.' % (rotulo, XT_TELA.replace(os.sep, '/')))

    usados['ids'].add(id_)
    return avisos, norm


def ler_formato_novo(caminho_relativo, bruto):
    """`(erros, tipos, prefixo, acrescenta)` do manifesto que tem `acrescenta`.

    Sem `prefixo` válido a extensão não liga (como `tipos` ausente): sem dono,
    nenhum `id` teria por onde começar — e os itens nem são conferidos.
    """
    erros = []
    erros_t, tipos = _ler_tipos(bruto.get('tipos'), _tipo_novo)
    erros.extend(erros_t)

    for campo in _CAMPOS_ANTIGOS:
        if campo in bruto:
            erros.append('`%s` é do formato antigo e é ignorado quando há `acrescenta` — '
                         'declare a peça como item de `acrescenta`.' % campo)

    prefixo = bruto.get('prefixo')
    if not isinstance(prefixo, str) or not prefixo.strip():
        erros.append('`prefixo` não foi declarado. No formato novo ele é obrigatório: '
                     '2 a 6 letras minúsculas, o dono de cada `id` (ex.: "erl").')
        return erros, tipos, '', []
    prefixo = prefixo.strip()
    if not XT_PREFIXO_RE.match(prefixo):
        erros.append('`prefixo` "%s" não vale: 2 a 6 letras minúsculas, sem acento.' % prefixo)
        return erros, tipos, '', []
    if prefixo in XT_PREFIXOS_PROIBIDOS:
        erros.append('`prefixo` "%s" é reservado do programa. Escolha outro.' % prefixo)
        return erros, tipos, '', []

    erro_l, itens = _lista(bruto.get('acrescenta'), 'acrescenta')
    erros.extend(erro_l)
    usados = {'ids': set(), 'pontos': set(), 'eventos': set(), 'dados': set(),
              # As ferramentas que ESTA extensão declara (fase 07, D51) — lidas
              # antes dos itens, para um subagente poder citar uma que vem
              # depois dele na lista.
              'ferramentas': nomes_declarados(itens)}
    acrescenta = []
    for i, item in enumerate(itens):
        erros_i, norm = validar_item(caminho_relativo, prefixo, i, item, usados)
        erros.extend(erros_i)
        if norm is not None:
            acrescenta.append(norm)
    return erros, tipos, prefixo, acrescenta


# ── De volta aos campos que o frontend de hoje lê ──────────────────────

def derivar_campos_da_tela(acrescenta):
    """`{encaixes, eventos, consultas, dados}` exatamente no formato que
    `validar_encaixes`/`validar_eventos`/`validar_consultas` e o `dados` do
    manifesto antigo produziam — nunca escritos à mão no formato novo. Mais
    `telas` (fase 11), que não tem par no formato antigo:
    `[{id, lugar, rotulo, icone, arquivo}]`, lido por `extensoes/telas.js`; e
    `trechos` (fase 12): `[{arquivo, linguagens}]`, lido por `dados.py`.

    Cada consulta sai com as `linguagens` do item e o `teto_ms` do catálogo
    (fase 12): o frontend pergunta só a quem declarou a linguagem do arquivo, e
    espera cada consulta pelo teto dela."""
    consulta_da_parte = {c['parte']: c for c in XT_CONSULTAS}
    encaixes, eventos, consultas, dados, telas, trechos = [], [], [], {}, [], []
    for item in acrescenta:
        r = item['recurso']
        if r == 'tela':
            # Campo NOVO (fase 11), e não `encaixes`: uma tela não é ponto de
            # encaixe — o registro do frontend (`extensoes/telas.js`) é por `id`.
            telas.append({'id': item['id'], 'lugar': item['lugar'], 'rotulo': item['rotulo'],
                          'icone': item.get('icone', ''), 'arquivo': item['arquivo']})
        elif r in ('marca', 'painel'):
            encaixes.append({'ponto': item['lugar'], 'arquivo': item['arquivo']})
        elif r == 'comando':
            for lugar in item['lugares']:
                encaixes.append({'ponto': lugar, 'arquivo': item['arquivo']})
        elif r == 'reacao':
            eventos.append({'nome': item['evento'], 'arquivo': item['arquivo'],
                            'guardia': item['pode_barrar'], 'lado': item['lado']})
        elif r in ('editor', 'visual'):
            chave = DADOS_INTERNOS.get((r, item['parte']))
            if chave:
                dados[chave] = item.get('pasta') or item.get('arquivo')
            elif r == 'editor' and item['parte'] == 'trechos':
                trechos.append({'arquivo': item['arquivo'],
                                'linguagens': list(item.get('linguagens') or ['*'])})
            elif r == 'editor' and item['parte'] in consulta_da_parte:
                c = consulta_da_parte[item['parte']]
                consultas.append({'nome': c['nome'], 'arquivo': item['arquivo'],
                                  'linguagens': list(item.get('linguagens') or ['*']),
                                  'teto_ms': c.get('teto_ms', XT_TETO_CONSULTA_PADRAO_MS)})
    return {'encaixes': encaixes, 'eventos': eventos, 'consultas': consultas, 'dados': dados,
            'telas': telas, 'trechos': trechos}
