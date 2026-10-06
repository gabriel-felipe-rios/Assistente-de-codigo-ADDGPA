"""O que cada ação faz — e o estado do servidor, em memória.

⚠️ O estado mora NESTE MÓDULO (`_atual`), e não em disco: o módulo fica
importado enquanto a extensão está ligada (`Como criar extensões.md` § 10).
Quem garante que o servidor cai ao desligar é o programa, pelo processo
gerenciado `payload['processos']` — nome `'servidor'`.

⚠️ O servidor é DESTA extensão (D41, P2). O desenho foi copiado do "Servidor
local com recarga", mas nada dele é importado nem chamado: extensão que
depende de outra quebra em silêncio quando a outra é desligada.
"""

import os
import threading
import time
from collections import deque

from . import ct_caminhos
from . import ct_dados
from . import ct_leitores
from . import ct_servidor

_PORTA_PADRAO = 5600
_PROCESSO = 'servidor'
_EXT = ('.html', '.htm')

_PREFS_PADRAO = {'primeira_tela': 'principal', 'ler_paginas': True,
                 'ler_abas': True, 'ler_modais': True}

_SAIDA = ' — ou escolha «index.html da raiz» em Configurações › Extensões › Canvas das telas.'
_AVISO_PRINCIPAL = ('O arquivo principal deste projeto não é uma página .html — escolha '
                    '«index.html da raiz» em Configurações › Extensões › Canvas das telas.')
# ⚠️ Um aviso por caso. Juntos, "ainda não marcou o arquivo principal" saía
# como "não é .html", e quem tinha um index.html na pasta achava que a
# extensão estava quebrada.
_AVISO_SEM_PRINCIPAL = 'Este projeto ainda não tem arquivo principal marcado. Marque o index.html como arquivo principal' + _SAIDA
_AVISO_NAO_ACHADO = 'O arquivo principal deste projeto não foi encontrado: %s. Ele foi movido ou apagado? Marque-o de novo' + _SAIDA
_AVISO_FORA = 'O arquivo principal deste projeto está fora da pasta do projeto: %s.' + _SAIDA

_atual = {'porta': None, 'pasta': None}
# ⚠️ Duas chamadas de `subir` ao mesmo tempo: sem a trava, a segunda diria
# "porta ocupada" contra a primeira.
_trava = threading.Lock()


# ── ler ──────────────────────────────────────────────────────────────────────

def _dentro(caminho, raiz):
    try:
        rel = os.path.relpath(caminho, raiz)
    except ValueError:
        return False         # outro disco
    return not (rel == '..' or rel.startswith('..' + os.sep) or os.path.isabs(rel))


def _ignorado(caminho, ignore_list, eh_pasta=False):
    """Item `folder` recursivo: prefixo de caminho; `folder` não recursivo: só
    os arquivos direto nela; `file`: o caminho exato."""
    c = os.path.normcase(os.path.abspath(caminho))
    for item in ignore_list or []:
        if not isinstance(item, dict) or not item.get('path'):
            continue
        p = os.path.normcase(os.path.abspath(item['path']))
        if item.get('type') == 'file':
            if c == p and not eh_pasta:
                return True
        elif item.get('recursive', True):
            if c == p or c.startswith(p.rstrip(os.sep) + os.sep):
                return True
        elif not eh_pasta and os.path.dirname(c) == p:
            return True
    return False


def _paginas(raiz, primeira, pastas, ignore_list, ler_paginas):
    arquivos = [primeira]
    vistos = {os.path.normcase(primeira)}
    if not ler_paginas:
        return arquivos
    for pasta in (pastas or [raiz]):
        pasta = os.path.abspath(pasta if os.path.isabs(pasta) else os.path.join(raiz, pasta))
        if not os.path.isdir(pasta) or not _dentro(pasta, raiz):
            continue
        for atual, subpastas, nomes in os.walk(pasta):
            subpastas[:] = sorted(s for s in subpastas
                                  if not _ignorado(os.path.join(atual, s), ignore_list, True))
            for nome in sorted(nomes):
                if not nome.lower().endswith(_EXT):
                    continue
                arq = os.path.join(atual, nome)
                chave = os.path.normcase(arq)
                if chave in vistos or _ignorado(arq, ignore_list):
                    continue
                vistos.add(chave)
                arquivos.append(arq)
    return arquivos


def _ordenar(telas, ligacoes, comeca):
    """Busca em largura a partir da primeira tela: `coluna` = distância; na
    coluna, a ordem de descoberta. As não alcançadas vão para o fim, em ordem
    alfabética de arquivo e nome."""
    saindo = {}
    for lig in ligacoes:
        saindo.setdefault(lig['de'], []).append(lig['para'])
    por_id = {t['id']: t for t in telas}
    coluna = {comeca: 0}
    ordem = [comeca]
    fila = deque([comeca])
    while fila:
        tid = fila.popleft()
        for para in saindo.get(tid, []):
            if para in por_id and para not in coluna:
                coluna[para] = coluna[tid] + 1
                ordem.append(para)
                fila.append(para)
    saida = []
    for tid in ordem:
        t = dict(por_id[tid], coluna=coluna[tid], alcancada=True)
        saida.append(t)
    resto = sorted((t for t in telas if t['id'] not in coluna),
                   key=lambda t: (t['arquivo'].lower(), (t['nome'] or '').lower()))
    for t in resto:
        saida.append(dict(t, coluna=None, alcancada=False))
    return saida


def ler(payload):
    raiz = payload.get('pasta_projeto')
    if not raiz or not os.path.isdir(raiz):
        return {'success': False, 'error': 'Este projeto não tem pasta de código.'}
    raiz = os.path.abspath(raiz)
    prefs = dict(_PREFS_PADRAO, **(payload.get('preferencias') or {}))

    if prefs.get('primeira_tela') == 'index':
        motivo = 'index.html da raiz'
        primeira = next((os.path.join(raiz, n) for n in ('index.html', 'index.htm')
                         if os.path.isfile(os.path.join(raiz, n))), None)
        if not primeira:
            return {'success': True, 'telas': [], 'ligacoes': [],
                    'aviso': 'Não há index.html na raiz do projeto.'}
    else:
        motivo = 'arquivo principal'
        principal = payload.get('main_file')
        if not principal:
            return {'success': True, 'telas': [], 'ligacoes': [], 'aviso': _AVISO_SEM_PRINCIPAL}
        primeira = os.path.abspath(principal if os.path.isabs(principal)
                                   else os.path.join(raiz, principal))
        aviso = None
        if not primeira.lower().endswith(_EXT):
            aviso = _AVISO_PRINCIPAL
        elif not os.path.isfile(primeira):
            aviso = _AVISO_NAO_ACHADO % primeira
        elif not _dentro(primeira, raiz):
            aviso = _AVISO_FORA % primeira
        if aviso:
            return {'success': True, 'telas': [], 'ligacoes': [], 'aviso': aviso}

    leitor = ct_leitores.escolher(primeira)
    if leitor is None:
        return {'success': True, 'telas': [], 'ligacoes': [], 'aviso': _AVISO_PRINCIPAL}
    arquivos = _paginas(raiz, primeira, payload.get('working_folders'),
                        payload.get('ignore_list'), prefs.get('ler_paginas', True))
    try:
        lido = leitor.ler(raiz, primeira, arquivos, prefs)
    except Exception as e:
        print('[ct] a leitura falhou: %s' % e)
        return {'success': False, 'error': 'Não deu para ler o site: %s' % e}

    comeca = os.path.relpath(primeira, raiz).replace('\\', '/')
    return {'success': True, 'comeca': comeca, 'comeca_motivo': motivo,
            'telas': _ordenar(lido['telas'], lido['ligacoes'], comeca),
            'ligacoes': lido['ligacoes'], 'lido_em': time.strftime('%H:%M')}


# ── o servidor ───────────────────────────────────────────────────────────────

def _porta(payload):
    try:
        return int((payload.get('preferencias') or {}).get('porta') or _PORTA_PADRAO)
    except (TypeError, ValueError):
        return _PORTA_PADRAO


def _rodando(processos):
    return bool((processos.rodando(_PROCESSO) or {}).get('rodando'))


def _url_base(porta):
    return 'http://127.0.0.1:%d/' % porta


def subir(payload):
    processos = payload.get('processos')
    if processos is None:
        return {'success': False, 'error': 'o programa não entregou `processos`.'}
    pasta = payload.get('pasta_projeto')
    if not pasta or not os.path.isdir(pasta):
        return {'success': False, 'error': 'Este projeto não tem pasta de código.'}
    pasta = os.path.abspath(pasta)
    porta = _porta(payload)

    with _trava:
        if _rodando(processos) and _atual['pasta'] == pasta and _atual['porta'] == porta:
            return {'success': True, 'url_base': _url_base(porta), 'porta': porta}
        # ⚠️ PARE ANTES DE CRIAR: subir de novo sem derrubar o anterior daria
        # "porta ocupada" contra si mesmo.
        r = processos.parar(_PROCESSO)
        if not r.get('success'):
            return {'success': False, 'error': r.get('error') or 'não deu para parar o servidor anterior.'}
        _atual.update(porta=None, pasta=None)
        try:
            srv = ct_servidor.criar(porta, pasta)
        except OSError as e:
            # ⚠️ Não tenta a próxima porta: o usuário escolheu esta.
            print('[ct] a porta %d está ocupada: %s' % (porta, e))
            return {'success': False, 'error': 'A porta %d já está em uso — troque em '
                    'Configurações › Extensões › Canvas das telas.' % porta}
        r = processos.ligar(_PROCESSO, lambda parar: ct_servidor.rodar(srv, parar))
        if not r.get('success'):
            srv.server_close()
            return {'success': False, 'error': r.get('error') or 'não deu para subir o servidor.'}
        _atual.update(porta=porta, pasta=pasta)
        print('[ct] servindo %s em %s' % (pasta, _url_base(porta)))
    return {'success': True, 'url_base': _url_base(porta), 'porta': porta}


def parar(payload):
    processos = payload.get('processos')
    if processos is None:
        return {'success': False, 'error': 'o programa não entregou `processos`.'}
    with _trava:
        r = processos.parar(_PROCESSO)
        _atual.update(porta=None, pasta=None)
    if not r.get('success'):
        return {'success': False, 'error': r.get('error') or 'não deu para parar o servidor.'}
    return {'success': True}


# ── o que a aba guarda ───────────────────────────────────────────────────────

def estado_ler(payload):
    return {'success': True, 'estado': ct_dados.ler_json(ct_caminhos.arquivo_estado(), {})}


def estado_gravar(payload):
    estado = payload.get('estado')
    if not isinstance(estado, dict):
        return {'success': False, 'error': 'estado inválido.'}
    try:
        ct_dados.gravar_json(ct_caminhos.arquivo_estado(), estado)
    except OSError as e:
        return {'success': False, 'error': 'não deu para gravar: %s' % e}
    return {'success': True}


def posicoes_ler(payload):
    projeto = payload.get('projeto')
    if not projeto:
        return {'success': False, 'error': 'nenhum projeto aberto.'}
    return {'success': True,
            'posicoes': ct_dados.ler_json(ct_caminhos.arquivo_posicoes(projeto), {})}


def posicoes_gravar(payload):
    projeto, tamanho = payload.get('projeto'), payload.get('tamanho')
    posicoes = payload.get('posicoes')
    if not projeto or not tamanho or not isinstance(posicoes, dict):
        return {'success': False, 'error': 'faltou projeto, tamanho ou posições.'}
    caminho = ct_caminhos.arquivo_posicoes(projeto)
    tudo = ct_dados.ler_json(caminho, {})
    if not isinstance(tudo, dict):
        tudo = {}
    tudo[str(tamanho)] = posicoes
    try:
        ct_dados.gravar_json(caminho, tudo)
    except OSError as e:
        return {'success': False, 'error': 'não deu para gravar: %s' % e}
    return {'success': True}
