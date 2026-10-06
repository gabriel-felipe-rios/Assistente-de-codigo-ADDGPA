import os
import json
import base64
import io
import ctypes
from ctypes import wintypes
from functools import lru_cache

from .constantes import CODE_DIR
# A varredura da árvore, o estado em Internal/config/ e a ordem arrastada
# são os MESMOS de Plugins e de Extensões do programa — moram em
# `arvore_externa.py` desde 04/09/2026. Daqui só sai o que é de launcher.
from .arvore_externa import (ler_json_de_config, gravar_json_de_config,
                             caminho_relativo as _caminho_relativo,
                             listar_folhas_recursivo, montar_no)

# Estrutura e flags do WinAPI `SHGetFileInfoW` — via ctypes, não
# `win32gui.SHGetFileInfo` (esta função NÃO existe na versão de pywin32
# instalada, confirmado por introspecção antes de escrever este código).
# `SHGetFileInfoW` é o único caminho genérico que resolve o ícone
# ASSOCIADO pelo shell — `win32gui.ExtractIconEx`, testado primeiro, só
# devolve ícone de arquivos que EMBUTEM o recurso (.exe/.dll/.ico); para
# `.lnk` ele devolve lista vazia, porque o ícone do atalho vem da
# associação do shell (o alvo, ou um ícone customizado), não de dentro do
# próprio `.lnk`.
class _SHFILEINFOW(ctypes.Structure):
    _fields_ = [
        ('hIcon', wintypes.HICON),
        ('iIcon', ctypes.c_int),
        ('dwAttributes', wintypes.DWORD),
        ('szDisplayName', wintypes.WCHAR * 260),
        ('szTypeName', wintypes.WCHAR * 80),
    ]

_SHGFI_ICON = 0x100
_SHGFI_LARGEICON = 0x0

# Pasta-raiz dos atalhos — irmã de `External/plugins/`, mesmo balde
# `External/`. Ao contrário de plugin, um atalho não é código autoral do
# usuário: é só um arquivo que o Windows sabe abrir (.exe, .bat, .lnk, ou
# qualquer outro) — por isso não precisa da exceção registrada para
# `External/plugins/` em Saída das skills/Arquitetura modular/Exceções.md;
# cai no critério padrão do balde (recurso externo ao programa).
#
# Nome da pasta: "launchers", tudo minúsculo — para casar com o padrão das
# outras pastas de External/ (ai-models, plugins, libraries), todas
# minúsculas. O RÓTULO visível ao usuário (categoria de Configurações,
# nome das duas abas) é "Launchers", com L maiúsculo — só o nome da pasta
# em disco é minúsculo. O nome interno do módulo/Mixin/variáveis continua
# em português ("atalho"), sem relação com nenhum dos dois.
ATALHOS_EXTERNOS_DIR = os.path.abspath(os.path.join(
    CODE_DIR, '..', 'External', 'launchers'))

# O que o usuário escolheu por atalho (ligado, e onde aparece) — mesmo
# raciocínio de `plugins.py`: não é padrão de fábrica nem dado gerado pelo
# próprio arquivo, então mora em Internal/config/ como o resto do que foi
# configurado. Chave = CAMINHO RELATIVO do arquivo dentro de
# ATALHOS_EXTERNOS_DIR, com '/' como separador (nunca o separador do SO) —
# ver `_caminho_relativo`. Um atalho na raiz tem caminho = próprio nome do
# arquivo; um atalho dentro de uma subpasta tem caminho
# "Subpasta/arquivo.ext". Precisa ser o caminho inteiro, e não só o nome do
# arquivo, porque o usuário pode ter (e já teve, testando) o MESMO nome de
# arquivo em pastas diferentes — nome sozinho colidiria.
#
# O ARQUIVO leva o rótulo da categoria ("Launchers", desde 23/09/2026); o
# código e a chave `atalhos-externos` continuam como estavam. O nome antigo é
# renomeado no boot por `configuracoes_arquivos.migrar_nomes_de_config`.
ATALHOS_EXTERNOS_CONFIG_FILE = 'launchers.json'

# A ordem das PASTAS (grupos/subgrupos) arrastada em Configurações ›
# Launchers — um mapa {caminho_da_pasta_pai: [nomes das subpastas, na
# ordem]}, chave '' para a raiz. Arquivos NÃO têm ordem manual: aparecem
# sempre em ordem alfabética dentro da pasta onde estão — só a ordem das
# PASTAS é arrastável (decisão do usuário: controlar a ordem dos grupos já
# basta, e evita um drag-and-drop aninhado por item).
ATALHOS_EXTERNOS_ORDER_FILE = 'launchers-ordem.json'


def _ler_config_atalhos():
    return ler_json_de_config(ATALHOS_EXTERNOS_CONFIG_FILE)


def _gravar_config_atalhos(config):
    gravar_json_de_config(ATALHOS_EXTERNOS_CONFIG_FILE, config)


def _ler_ordem_pastas():
    return ler_json_de_config(ATALHOS_EXTERNOS_ORDER_FILE, exigir_dicionario=True)


def _gravar_ordem_pastas(mapa):
    gravar_json_de_config(ATALHOS_EXTERNOS_ORDER_FILE, dict(mapa or {}))


def _montar_no(caminho_rel, config, ordem_pastas):
    """Constrói recursivamente o nó da árvore da pasta em `caminho_rel`
    (relativo a ATALHOS_EXTERNOS_DIR; `''` é a própria raiz). A varredura, a
    recursão e a ordem são de `arvore_externa`; o que é DAQUI é só o que cada
    folha carrega — o estado gravado e o ícone real do Windows.

    ⚠️ `ordenar_folhas=False`: aqui só a ordem das PASTAS é arrastável. Os
    arquivos aparecem sempre em ordem alfabética dentro da pasta onde estão
    (decisão do usuário: controlar a ordem dos grupos já basta, e evita um
    drag-and-drop aninhado por item)."""
    def montar_folha(rel_item, nome):
        estado = config.get(rel_item, {})
        return {
            'caminho': rel_item,
            'nome': nome,
            'ligado': bool(estado.get('ligado', False)),
            'tela_principal': bool(estado.get('tela_principal', False)),
            'dentro_do_projeto': bool(estado.get('dentro_do_projeto', False)),
            'icone': _icone_base64_arquivo(
                os.path.join(ATALHOS_EXTERNOS_DIR, rel_item.replace('/', os.sep))),
        }

    return montar_no(ATALHOS_EXTERNOS_DIR, caminho_rel, os.path.isfile, montar_folha,
                     ordem_pastas, chave_folhas='itens', ordenar_folhas=False)


def _todos_caminhos_de_itens(caminho_rel=''):
    """Lista o caminho relativo de TODO arquivo na árvore, descendo em toda
    subpasta — usado só para validar que um caminho recebido do frontend
    (save/abrir) corresponde a um arquivo que existe de verdade agora."""
    return listar_folhas_recursivo(ATALHOS_EXTERNOS_DIR, os.path.isfile, caminho_rel)


def _icone_base64_arquivo(caminho):
    """Ícone real do Windows para `caminho` (o mesmo que o Explorer
    mostra), como data-URI PNG em base64, ou None em qualquer falha —
    nunca lança. O frontend degrada para um glifo neutro quando recebe
    None (arquivo sem ícone recuperável, ou já apagado)."""
    try:
        mtime = os.path.getmtime(caminho)
    except OSError:
        return None
    return _icone_base64_cache(caminho, mtime)


@lru_cache(maxsize=256)
def _icone_base64_cache(caminho, mtime):
    # `mtime` só existe como parte da CHAVE do cache — se o arquivo mudar,
    # o mtime muda e o cache velho vira lixo por si só, nunca lido dentro
    # da função. Cache só de processo (não persiste entre reinícios) — de
    # sobra pra uma pasta de "alguns atalhos".
    try:
        import win32gui
        import win32ui
        import win32con
        import win32api
        from PIL import Image

        info = _SHFILEINFOW()
        ok = ctypes.windll.shell32.SHGetFileInfoW(
            caminho, 0, ctypes.byref(info), ctypes.sizeof(info),
            _SHGFI_ICON | _SHGFI_LARGEICON)
        if not ok or not info.hIcon:
            return None
        hicon = info.hIcon
        try:
            lado = win32api.GetSystemMetrics(win32con.SM_CXICON)
            hdc_tela = win32gui.GetDC(0)
            try:
                hdc = win32ui.CreateDCFromHandle(hdc_tela)
                hdc_mem = hdc.CreateCompatibleDC()
                hbmp = win32ui.CreateBitmap()
                hbmp.CreateCompatibleBitmap(hdc, lado, lado)
                hdc_mem.SelectObject(hbmp)
                win32gui.DrawIconEx(hdc_mem.GetHandleAttrib(), 0, 0, hicon,
                                     lado, lado, 0, None, win32con.DI_NORMAL)

                bmpinfo = hbmp.GetInfo()
                bmpstr = hbmp.GetBitmapBits(True)
                img = Image.frombuffer(
                    'RGBA', (bmpinfo['bmWidth'], bmpinfo['bmHeight']),
                    bmpstr, 'raw', 'BGRA', 0, 1)
                buf = io.BytesIO()
                img.save(buf, format='PNG')
                return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')
            finally:
                win32gui.ReleaseDC(0, hdc_tela)
        finally:
            win32gui.DestroyIcon(hicon)
    except Exception:
        return None


class AtalhosExternosMixin:
    def list_atalhos_externos(self):
        """Varre External/launchers/ recursivamente (arquivos soltos na
        raiz E dentro de subpastas em qualquer profundidade) e devolve a
        árvore inteira: cada pasta com suas subpastas (na ordem arrastada
        em Configurações) e seus arquivos (sempre em ordem alfabética,
        cada um com o estado gravado em launchers.json). Pasta e
        subpasta NÃO têm configuração própria — são só organização visual;
        cada arquivo tem ligado/tela_principal/dentro_do_projeto. Sempre
        devolve {'success': True, ...}, mesmo com a árvore vazia ou a
        pasta-raiz ausente — nunca lança."""
        config = _ler_config_atalhos()
        ordem_pastas = _ler_ordem_pastas()
        arvore = _montar_no('', config, ordem_pastas)
        return {'success': True, 'arvore': arvore}

    def save_atalhos_externos_pasta_order(self, caminho_pasta, ordem):
        """Grava a ordem arrastada das SUBPASTAS diretas de uma pasta
        (`caminho_pasta`; '' é a raiz) e devolve a árvore inteira já
        atualizada — mesmo padrão de retorno dos outros métodos, pra tela
        repintar a partir do que foi de fato gravado. Arquivo não tem
        ordem própria (ver comentário de ATALHOS_EXTERNOS_ORDER_FILE)."""
        mapa = _ler_ordem_pastas()
        mapa[caminho_pasta or ''] = list(ordem or [])
        try:
            _gravar_ordem_pastas(mapa)
        except OSError as e:
            return {'success': False, 'error': str(e)}
        return self.list_atalhos_externos()

    def save_atalhos_externos_order(self, ordem_por_pasta):
        """Grava, de uma vez, a ordem das pastas de TODOS os níveis que
        estavam na tela — um `{caminho_da_pasta_pai: [nomes]}`, mesmo
        formato de `save_plugins_order`.

        ⚠️ Não substitui `save_atalhos_externos_pasta_order`: arrastar
        continua gravando ao soltar, nível a nível. Este é o método do
        botão "Salvar launchers", que regrava o que já está na tela e
        confirma em voz alta — nenhuma categoria de Configurações fica sem
        "Salvar" (decisão de 2026-08-26), mesmo quando não há nada
        pendente. Devolve a árvore, pra tela repintar a partir do que foi
        de fato gravado."""
        try:
            _gravar_ordem_pastas(ordem_por_pasta)
        except OSError as e:
            return {'success': False, 'error': str(e)}
        return self.list_atalhos_externos()

    def save_config_atalho_externo(self, caminho, patch):
        """Grava o estado de UM atalho (ligado / tela_principal /
        dentro_do_projeto), identificado pelo CAMINHO RELATIVO completo
        (inclui a(s) subpasta(s), se houver). Efeito imediato — mesma
        regra do Interruptor, sem barra de Salvar."""
        if caminho not in _todos_caminhos_de_itens():
            return {'success': False, 'error': 'Atalho não encontrado.'}
        config = _ler_config_atalhos()
        estado = config.get(caminho, {})
        estado.update(patch or {})
        config[caminho] = estado
        _gravar_config_atalhos(config)
        return self.list_atalhos_externos()

    def reset_atalhos_externos(self):
        """Padrão de fábrica: todo atalho volta a desligado, sem aparecer
        em lugar nenhum (os dois checkboxes desmarcados). Zera a config
        inteira — items sem entrada já leem como desligado por padrão
        (`estado.get(..., False)` em `_montar_no`), então limpar tudo tem
        o mesmo efeito visível de reescrever cada entrada como falsa, e de
        quebra descarta lixo de atalho já apagado. Não mexe na ordem das
        pastas — "restaurar padrão" é sobre liga/desliga, não sobre
        organização. Devolve no mesmo formato de `list_atalhos_externos`."""
        _gravar_config_atalhos({})
        return self.list_atalhos_externos()

    def abrir_atalho_externo(self, caminho):
        """Abre o arquivo (identificado pelo caminho relativo completo)
        com o programa padrão do Windows — o mesmo efeito de dar duplo
        clique nele no Explorador. Nunca lê nem interpreta o conteúdo do
        arquivo."""
        if caminho not in _todos_caminhos_de_itens():
            return {'success': False, 'error': 'Atalho não encontrado.'}
        try:
            os.startfile(os.path.join(ATALHOS_EXTERNOS_DIR, caminho.replace('/', os.sep)))
            return {'success': True}
        except OSError as e:
            return {'success': False, 'error': str(e)}
