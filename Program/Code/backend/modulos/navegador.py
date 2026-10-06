"""Abrir um endereço no navegador, com tamanho de janela (G4).

Um serviço do PROGRAMA, oferecido a toda extensão pela `Api`
(`window.pywebview.api.abrir_endereco_no_navegador`). Antes cada um abria do
seu jeito — `os.startfile(url)` numa extensão, `webbrowser.open` no Designer —
e nenhum sabia pedir tamanho.

Como funciona:
  - sem `largura`/`altura` → o navegador padrão, como um duplo clique;
  - com tamanho → descobre o navegador padrão pelo registro do Windows. Se for
    da família Chromium, abre uma janela `--app` (sem barra de endereço: a área
    útil fica perto do tamanho pedido) com `--window-size`. Outro navegador →
    abre no padrão e avisa que o tamanho não vale.

⚠️ **`--window-size` só vale num processo NOVO do navegador.** Com o Chrome já
aberto, o pedido vai para a janela que existe e o tamanho é ignorado sem erro
nenhum. É por isso o `--user-data-dir` próprio: um perfil separado força um
processo separado. E é **um perfil por tamanho** (`NAVEGADOR_PERFIL_DIR/
{largura}x{altura}`): com um perfil só, a 2ª janela caía no processo da 1ª e
saía no tamanho dela. Mesmo tamanho → mesmo perfil → a janela nova cai no
processo que já tem esse tamanho, e está certo. O preço: esses perfis não têm
os logins nem as extensões do navegador do usuário.

⚠️ O Chrome não avisa quando desiste: com o caminho do perfil longo demais ele
sai («Lock file can not be created») com código 0, igual a quando entrega o
pedido a um processo que já roda. Por isso `_abrir_no_perfil` olha antes se o
perfil está em uso (o `lockfile` dele travado) e depois se o processo novo
continuou vivo: saiu sem ninguém usando o perfil → não abriu, e devolve erro.

⚠️ Só `http`/`https` com host — conferido por `urlparse`, nunca por prefixo de
texto. Nada de endereço fixo aqui: o serviço é para qualquer endereço http.
"""

import os
import shlex
import subprocess
import time
import winreg
from urllib.parse import urlparse

from .constantes import CONFIGS_DIR

# A pasta dos perfis próprios do navegador aberto com tamanho — um perfil por
# tamanho, `{largura}x{altura}/` (nome curto de propósito: caminho longo faz o
# Chrome desistir). Em `Internal/cache/`, como todo cache de ferramenta (AMF):
# é descartável — apagar só perde o que o navegador guardou, e ele se recria.
NAVEGADOR_PERFIL_DIR = os.path.abspath(
    os.path.join(CONFIGS_DIR, '..', 'cache', 'navegador'))

# Os executáveis que aceitam `--app`, `--window-size` e `--user-data-dir`.
_NAVEGADOR_CHROMIUM = frozenset(('chrome.exe', 'msedge.exe', 'brave.exe', 'vivaldi.exe'))


def _navegador_padrao_exe():
    """O `.exe` do navegador padrão para `http`, ou None. Mesma técnica de
    `terminal.py` (`_term_progid`, `_term_resolver_comando`): o ProgId do
    UserChoice e o `shell\\open\\command` dele."""
    try:
        chave = r'Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice'
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, chave) as k:
            progid = winreg.QueryValueEx(k, 'ProgId')[0]
    except OSError:
        return None
    if not progid:
        return None
    try:
        with winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, r'%s\shell\open\command' % progid) as k:
            modelo = winreg.QueryValueEx(k, '')[0]
    except OSError:
        return None
    try:
        partes = shlex.split(modelo or '', posix=False)
    except ValueError:
        return None
    if not partes:
        return None
    exe = partes[0].strip('"')
    return exe if os.path.isfile(exe) else None

# Quanto esperar para saber se o navegador novo continuou vivo. O que desiste
# sai em ~0,2 s (medido em 23/09); passado isto sem sair, está rodando.
_ESPERA_PROCESSO_VIVO_S = 0.8


def _perfil_em_uso(perfil):
    """True se um navegador está com `perfil` aberto: ele segura o `lockfile`
    da pasta sem deixar ninguém mais abrir. Sem o arquivo, ou com ele livre
    (sobra de um fechamento), não está em uso. Nunca cria o arquivo."""
    trava = os.path.join(perfil, 'lockfile')
    if not os.path.isfile(trava):
        return False
    try:
        os.close(os.open(trava, os.O_RDWR))
    except PermissionError:
        return True
    except OSError:
        return False
    return False


def _abrir_no_perfil(exe, url, largura, altura):
    """Abre a janela `--app` no perfil do tamanho pedido. Devolve None se abriu
    ou o texto do erro."""
    perfil = os.path.join(NAVEGADOR_PERFIL_DIR, '%dx%d' % (largura, altura))
    try:
        os.makedirs(perfil, exist_ok=True)
        em_uso = _perfil_em_uso(perfil)
        proc = subprocess.Popen([
            exe, '--app=' + url, '--window-size=%d,%d' % (largura, altura),
            '--user-data-dir=' + perfil,
            '--no-first-run', '--no-default-browser-check',
        ], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except OSError as e:
        return str(e)
    if em_uso:
        # Entrega o pedido ao processo que já tem esse perfil (e esse tamanho)
        # e sai: sair aqui é o esperado.
        return None
    fim = time.monotonic() + _ESPERA_PROCESSO_VIVO_S
    while time.monotonic() < fim:
        if proc.poll() is not None:
            return ('o navegador fechou logo ao abrir (código %s) — talvez o caminho do '
                    'perfil seja longo demais: %s' % (proc.returncode, perfil))
        time.sleep(0.05)
    return None


class NavegadorMixin:
    def abrir_endereco_no_navegador(self, url, largura=None, altura=None):
        """Abre `url` (http/https) no navegador. Com `largura` e `altura`,
        numa janela `--app` desse tamanho (só navegador Chromium).

        Devolve `{'success': True, 'tamanho': bool}` — `tamanho` diz se o
        tamanho pedido valeu —, com `aviso` quando não valeu."""
        try:
            partes = urlparse(str(url or ''))
        except ValueError:
            partes = None
        if not partes or partes.scheme not in ('http', 'https') or not partes.hostname:
            return {'success': False, 'error': 'endereço inesperado: %r' % (url,)}
        url = partes.geturl()

        if largura is None or altura is None:
            try:
                os.startfile(url)
            except OSError as e:
                return {'success': False, 'error': str(e)}
            return {'success': True, 'tamanho': False}

        try:
            largura, altura = int(largura), int(altura)
        except (TypeError, ValueError):
            return {'success': False, 'error': 'largura e altura têm de ser números.'}
        if largura <= 0 or altura <= 0:
            return {'success': False, 'error': 'largura e altura têm de ser maiores que zero.'}

        exe = _navegador_padrao_exe()
        if not exe or os.path.basename(exe).lower() not in _NAVEGADOR_CHROMIUM:
            try:
                os.startfile(url)
            except OSError as e:
                return {'success': False, 'error': str(e)}
            return {'success': True, 'tamanho': False,
                    'aviso': 'o navegador padrão não aceita tamanho; abriu no tamanho dele'}

        erro = _abrir_no_perfil(exe, url, largura, altura)
        if erro:
            return {'success': False, 'error': erro}
        return {'success': True, 'tamanho': True}
