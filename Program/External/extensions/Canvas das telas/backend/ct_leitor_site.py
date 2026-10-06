"""O leitor de site: acha as telas (página, aba interna, modal) e as
ligações CERTAS entre elas, só lendo o texto do HTML e do JS.

⚠️ `html.parser` da biblioteca padrão, e não o tree-sitter do programa: a
extensão não importa o backend do programa (`Como criar extensões.md` § 4).

⚠️ Só vira ligação o que casa com a lista fechada (D7, P4) — aqui para o HTML,
em `ct_leitor_site_js.py` para o JS. Elemento cujo destino não se prova fica
sem ligação, nunca com uma "provável".
"""

import os
import re
from html.parser import HTMLParser
from urllib.parse import unquote

from . import ct_dados
from . import ct_leitor_site_js as js

_EXT = ('.html', '.htm')
_VAZIOS = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
           'meta', 'source', 'track', 'wbr'}
_ESQUEMA = re.compile(r'^[a-zA-Z][a-zA-Z0-9+.-]*:')


def aceita(arquivo):
    return bool(arquivo) and str(arquivo).lower().endswith(_EXT)


# ── o parser ─────────────────────────────────────────────────────────────────

class _Parser(HTMLParser):
    """Cada elemento em ordem de documento: `{tag, atributos, pai, texto}`,
    mais os scripts `[(src, texto)]`."""

    def __init__(self):
        HTMLParser.__init__(self, convert_charrefs=True)
        self.elementos = []
        self.scripts = []
        self._pilha = []
        self._script = None

    def _novo(self, tag, attrs):
        atributos = {}
        for nome, valor in attrs:
            atributos.setdefault(nome.lower(), valor if valor is not None else '')
        el = {'tag': tag, 'atributos': atributos,
              'pai': self._pilha[-1] if self._pilha else None, 'texto': ''}
        self.elementos.append(el)
        return len(self.elementos) - 1

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        i = self._novo(tag, attrs)
        if tag == 'script':
            self._script = [self.elementos[i]['atributos'].get('src'), []]
        if tag not in _VAZIOS:
            self._pilha.append(i)

    def handle_startendtag(self, tag, attrs):
        self._novo(tag.lower(), attrs)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag == 'script' and self._script is not None:
            self.scripts.append((self._script[0], ''.join(self._script[1])))
            self._script = None
        # Desempilha até a abertura desta tag; fechamento sem abertura é ignorado.
        for k in range(len(self._pilha) - 1, -1, -1):
            if self.elementos[self._pilha[k]]['tag'] == tag:
                del self._pilha[k:]
                break

    def handle_data(self, dado):
        if self._script is not None:
            self._script[1].append(dado)
            return
        if self._pilha and self.elementos[self._pilha[-1]]['tag'] == 'style':
            return
        for i in self._pilha:
            el = self.elementos[i]
            if len(el['texto']) < 200:
                el['texto'] += dado

    def fechar(self):
        self.close()
        if self._script is not None:
            self.scripts.append((self._script[0], ''.join(self._script[1])))
        for el in self.elementos:
            el['texto'] = ' '.join(el['texto'].split())[:40]


# ── uma página ───────────────────────────────────────────────────────────────

def _classes(el):
    return set((el['atributos'].get('class') or '').split())


def _comeca_escondido(el):
    a = el['atributos']
    classes = _classes(el)
    if 'hidden' in a:
        return True
    if 'display:none' in re.sub(r'\s', '', (a.get('style') or '').lower()):
        return True
    if classes & {'hidden', 'd-none'}:
        return True
    return 'tab-pane' in classes and 'active' not in classes


def _dentro(elementos, i, contem):
    """O ancestral mais próximo de `i` (sem contar ele) que está em `contem`."""
    p = elementos[i]['pai']
    while p is not None:
        if p in contem:
            return p
        p = elementos[p]['pai']
    return None


class _Pagina:
    def __init__(self, raiz, caminho, pid):
        self.raiz, self.caminho, self.id = raiz, caminho, pid
        self.pasta = os.path.dirname(caminho)
        p = _Parser()
        try:
            p.feed(ct_dados.ler_texto(caminho))
        except OSError as e:
            print('[ct] não deu para ler %s: %s' % (caminho, e))
        p.fechar()
        self.elementos = p.elementos
        self.ids = {}
        for i, el in enumerate(self.elementos):
            ident = el['atributos'].get('id')
            if ident and ident not in self.ids:
                self.ids[ident] = i
        self.js = []
        for src, texto in p.scripts:
            if src is None:
                self.js.append(texto)
            elif not _ESQUEMA.match(src) and not src.startswith('//'):
                arq = self.resolver(src)
                if arq and os.path.isfile(arq):
                    try:
                        self.js.append(ct_dados.ler_texto(arq))
                    except OSError:
                        pass
        self.motivo = {}        # índice → (atributo, valor): o que fez dele origem

    def resolver(self, destino):
        """O caminho absoluto de um destino relativo À PÁGINA (é assim que o
        navegador resolve, inclusive o que está num `.js`); `/x` é a raiz."""
        destino = unquote(destino.split('#', 1)[0].split('?', 1)[0]).strip()
        if not destino:
            return None
        if destino.startswith('/'):
            return os.path.normpath(os.path.join(self.raiz, destino.lstrip('/')))
        return os.path.normpath(os.path.join(self.pasta, destino))

    def marcar(self, i, atributo, valor):
        self.motivo.setdefault(i, (atributo, valor))

    def descritor(self, i):
        el = self.elementos[i]
        ident = el['atributos'].get('id')
        atributo, valor = self.motivo.get(i, (None, None))
        d = {'chave': 'e%d' % i, 'tag': el['tag'], 'id': ident or None,
             'atributo': None, 'valor': None, 'ordem': 0, 'texto': el['texto']}
        if not ident:
            d['atributo'], d['valor'] = atributo, valor
            d['ordem'] = sum(1 for k in range(i)
                             if self.elementos[k]['tag'] == el['tag']
                             and self.elementos[k]['atributos'].get(atributo) == valor)
        return d


def _alvo_de(a):
    """O `Y` de `data-bs-target`/`data-target`/`href` igual a `#Y`."""
    for nome in ('data-bs-target', 'data-target', 'href'):
        v = a.get(nome) or ''
        if v.startswith('#') and len(v) > 1:
            return nome, v, v[1:]
    return None, None, None


def _abas(pag):
    """`{alvo: [(abridor, atributo, valor)]}` dos três padrões de aba."""
    els, achados = pag.elementos, {}

    def por(alvo, i, atributo, valor):
        if alvo in pag.ids and pag.ids[alvo] != i:
            achados.setdefault(alvo, []).append((i, atributo, valor))

    nomes = {}
    for i, el in enumerate(els):
        a = el['atributos']
        if a.get('role') == 'tab' and a.get('aria-controls'):
            por(a['aria-controls'], i, 'aria-controls', a['aria-controls'])
        if (a.get('data-bs-toggle') or a.get('data-toggle')) in ('tab', 'pill'):
            atributo, valor, alvo = _alvo_de(a)
            if alvo:
                por(alvo, i, atributo, valor)
        for nome, v in a.items():
            if nome.startswith('data-') and v in pag.ids and pag.ids[v] != i:
                nomes.setdefault(nome, []).append((i, v))
    # (c) o mesmo `data-*` em dois ou mais elementos, cada um apontando para
    # um `id` diferente, e os alvos com o mesmo pai (o `data-mapa` do programa).
    for nome, lista in nomes.items():
        alvos = {v for _, v in lista}
        pais = {els[pag.ids[v]]['pai'] for v in alvos}
        if len(lista) >= 2 and len(alvos) >= 2 and len(pais) == 1:
            for i, v in lista:
                por(v, i, nome, v)
    return achados


def _eh_modal(pag, alvo):
    i = pag.ids.get(alvo)
    if i is None:
        return False
    el = pag.elementos[i]
    return el['tag'] == 'dialog' or 'modal' in _classes(el)


def _modais(pag, manips):
    achados = {}

    def por(alvo, i, atributo, valor):
        if _eh_modal(pag, alvo):
            achados.setdefault(alvo, []).append((i, atributo, valor))

    for i, el in enumerate(pag.elementos):
        a = el['atributos']
        if (a.get('data-bs-toggle') or a.get('data-toggle')) == 'modal':
            atributo, valor, alvo = _alvo_de(a)
            if alvo:
                por(alvo, i, atributo, valor)
        if a.get('commandfor') and a.get('command') == 'show-modal':
            por(a['commandfor'], i, 'commandfor', a['commandfor'])
        if a.get('onclick'):
            for alvo in js.abre_dialogo(a['onclick']):
                por(alvo, i, 'onclick', a['onclick'])
    for i, corpo in manips:
        for alvo in js.abre_dialogo(corpo):
            por(alvo, i, 'id', pag.elementos[i]['atributos'].get('id'))
    return achados


def _manipuladores(pag):
    """`[(índice do elemento, corpo)]` dos cliques ligados por `id` no JS."""
    saida = []
    for texto in pag.js:
        for ident, corpo in js.manipuladores(texto):
            if ident in pag.ids:
                saida.append((pag.ids[ident], corpo))
    return saida


def _ler_pagina(pag, paginas, prefs, telas, ligacoes):
    els = pag.elementos
    manips = _manipuladores(pag)
    containers = {}             # índice do contêiner → id da tela
    abas_tela = []

    # 1. As abas e os modais que viram tela, e para onde leva cada abridor.
    destinos = []               # (índice do abridor, id da tela de destino)
    if prefs.get('ler_abas', True):
        for alvo, abridores in _abas(pag).items():
            ic = pag.ids[alvo]
            if _comeca_escondido(els[ic]):
                tid = '%s#%s' % (pag.id, alvo)
                if tid not in containers.values():
                    containers[ic] = tid
                    abas_tela.append(tid)
                    telas.append(_tela(pag, tid, 'aba', alvo, abridores))
                for i, atr, val in abridores:
                    pag.marcar(i, atr, val)
                    destinos.append((i, tid))
            else:
                # O abridor de uma aba que começa VISÍVEL leva à própria página.
                for i, atr, val in abridores:
                    pag.marcar(i, atr, val)
                    destinos.append((i, pag.id))
    if prefs.get('ler_modais', True):
        for alvo, abridores in _modais(pag, manips).items():
            tid = '%s#%s' % (pag.id, alvo)
            ic = pag.ids[alvo]
            if ic not in containers:
                containers[ic] = tid
                telas.append(_tela(pag, tid, 'modal', alvo, abridores))
            for i, atr, val in abridores:
                pag.marcar(i, atr, val)
                destinos.append((i, containers[ic]))

    # 2. As ligações para outra página.
    def para_pagina(i, destino, atributo, valor):
        arq = pag.resolver(destino)
        pid = arq and paginas.get(os.path.normcase(arq))
        if pid:
            pag.marcar(i, atributo, valor)
            destinos.append((i, pid))

    for i, el in enumerate(els):
        a = el['atributos']
        if el['tag'] in ('a', 'area') and 'href' in a:
            x = a['href'].strip()
            if x and not _ESQUEMA.match(x) and not x.startswith(('//', '#')):
                para_pagina(i, x, 'href', a['href'])
        if a.get('onclick'):
            for x in js.navegacoes(a['onclick']):
                para_pagina(i, x, 'onclick', a['onclick'])
    for i, corpo in manips:
        for x in js.navegacoes(corpo):
            para_pagina(i, x, 'id', els[i]['atributos'].get('id'))

    # 3. De que tela sai cada uma — na ordem do documento.
    destinos.sort(key=lambda d: d[0])
    vistas = set()
    for i, para in destinos:
        c = _dentro(els, i, containers)
        origens = [containers[c]] if c is not None else [pag.id] + abas_tela
        for de in origens:
            chave = (de, para, i)
            if de == para or chave in vistas:
                continue
            vistas.add(chave)
            ligacoes.append({'de': de, 'para': para, 'origem': pag.descritor(i)})


def _tela(pag, tid, tipo, alvo, abridores):
    primeiro = abridores[0]
    pag.marcar(primeiro[0], primeiro[1], primeiro[2])
    nome = pag.elementos[primeiro[0]]['texto'] or alvo
    return {'id': tid, 'tipo': tipo, 'arquivo': pag.id, 'alvo': alvo, 'nome': nome,
            'abridor': pag.descritor(primeiro[0]), 'pai': pag.id}


def ler(raiz, arquivo_inicial, arquivos, prefs):
    """`{'telas': [...], 'ligacoes': [...]}` — cada página em `arquivos`
    (caminhos absolutos, o inicial entre eles) é uma tela; as abas e os modais
    entram logo depois da página deles."""
    prefs = prefs or {}
    raiz = os.path.abspath(raiz)
    paginas = {}
    for arq in arquivos:
        pid = os.path.relpath(os.path.abspath(arq), raiz).replace('\\', '/')
        paginas[os.path.normcase(os.path.abspath(arq))] = pid
    telas, ligacoes = [], []
    for arq in arquivos:
        pag = _Pagina(raiz, os.path.abspath(arq), paginas[os.path.normcase(os.path.abspath(arq))])
        telas.append({'id': pag.id, 'tipo': 'pagina', 'arquivo': pag.id, 'alvo': None,
                      'nome': pag.id, 'abridor': None, 'pai': None})
        _ler_pagina(pag, paginas, prefs, telas, ligacoes)
    return {'telas': telas, 'ligacoes': ligacoes}
