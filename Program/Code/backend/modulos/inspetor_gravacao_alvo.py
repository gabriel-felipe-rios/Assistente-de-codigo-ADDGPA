import ctypes
from ctypes import wintypes

from .constantes import *


class _INSP_GRAV_RECT(ctypes.Structure):
    _fields_ = [('left', wintypes.LONG), ('top', wintypes.LONG),
                ('right', wintypes.LONG), ('bottom', wintypes.LONG)]


class _INSP_GRAV_GUITHREADINFO(ctypes.Structure):
    """GUITHREADINFO do Win32 — o que permite saber QUAL controle está com o
    foco de teclado, e não só qual janela está em primeiro plano.

    Via ctypes porque o `win32gui` do pywin32 não expõe `GetGUIThreadInfo`. É
    leitura pura: não anexa filas de entrada nem mexe no foco de ninguém (a
    alternativa clássica, `AttachThreadInput` + `GetFocus`, mexe)."""
    _fields_ = [('cbSize', wintypes.DWORD), ('flags', wintypes.DWORD),
                ('hwndActive', wintypes.HWND), ('hwndFocus', wintypes.HWND),
                ('hwndCapture', wintypes.HWND), ('hwndMenuOwner', wintypes.HWND),
                ('hwndMoveSize', wintypes.HWND), ('hwndCaret', wintypes.HWND),
                ('rcCaret', _INSP_GRAV_RECT)]


class InspetorGravacaoAlvoMixin:
    """Quem é o programa que está sendo gravado, e onde ele está na tela.

    Antes da reforma a gravação descartava só os cliques na janela do próprio
    Assistente — clique em qualquer outro programa (Explorer, navegador, barra
    de tarefas) virava passo do fluxo. Aqui mora a barreira que faltava:
    existe um **alvo**, e evento fora dele é descartado.

    Tudo aqui é chamado de dentro dos callbacks do hook, dezenas de vezes por
    segundo numa rolagem — por isso os caminhos quentes só pegam o **PID**
    (três chamadas Win32 baratas) e deixam o nome do processo, que custa um
    `OpenProcess`, para o momento da adoção, que acontece uma vez só.
    """

    _INSP_GRAV_GA_ROOT = 2  # GetAncestor(GA_ROOT) — janela de topo do clique

    # ── O alvo ──────────────────────────────────────────────────────────────
    # Casado por **PID**, nunca por nome de processo: o app-alvo do usuário é
    # aberto com `sys.executable` quando é `.py`/`.pyw`, ou seja, roda com o
    # MESMO nome de processo do próprio Assistente. Casar por nome aceitaria
    # de volta os cliques na nossa própria janela — e qualquer outro Python
    # aberto na máquina junto.

    def _insp_grav_zerar_alvo(self):
        """Começo de gravação: adota o processo aberto pelo "▶ Executar
        programa", se houver, mas ainda **não confirmado**.

        Não confirmado = veio do `Popen` e ainda não produziu evento nenhum.
        Enquanto não produzir, um evento de outro processo pode reivindicar o
        posto: é o caso do lançador que abre a janela num processo filho (um
        `.bat`, um empacotador), em que o PID do `Popen` nunca vai ser o da
        janela com que o usuário interage."""
        self._insp_grav_alvo_pid = getattr(self, '_insp_grav_alvo_pendente', None)
        self._insp_grav_alvo_confirmado = False
        self._insp_grav_alvo_processo = ''

    def _insp_grav_adotar_alvo(self, pid):
        self._insp_grav_alvo_pid = pid
        self._insp_grav_alvo_confirmado = True
        nome, _arquivo = self._inspetor_processo_info(pid)
        if nome and nome != self._insp_grav_alvo_processo:
            self._insp_grav_alvo_processo = nome
            self._insp_grav_notify({'tipo': 'alvo', 'processo': nome})

    def _insp_grav_eh_alvo(self, pid):
        """`True` se o evento daquele processo deve virar passo.

        Sem alvo ainda: o primeiro evento não-próprio define quem é. Com alvo
        pendente e não confirmado: o primeiro evento reivindica o posto. Com
        alvo confirmado: só ele passa — é aqui que o clique no Explorer, no
        navegador ou na barra de tarefas para de entrar no fluxo."""
        if pid is None:
            return False
        if self._insp_grav_alvo_pid is None or not self._insp_grav_alvo_confirmado:
            self._insp_grav_adotar_alvo(pid)
            return True
        if pid == self._insp_grav_alvo_pid:
            if not self._insp_grav_alvo_processo:
                self._insp_grav_adotar_alvo(pid)
            return True
        return False

    # ── De onde veio o evento ───────────────────────────────────────────────
    def _insp_grav_pid_do_ponto(self, x, y):
        """PID da janela de topo naquele ponto, ou `None`. Caminho quente."""
        try:
            import win32gui
            import win32process
            hwnd = win32gui.WindowFromPoint((x, y))
            root = win32gui.GetAncestor(hwnd, self._INSP_GRAV_GA_ROOT)
            _, pid = win32process.GetWindowThreadProcessId(root)
            return pid
        except Exception:
            return None

    def _insp_grav_foco(self):
        """Onde o teclado está batendo: `(pid, x, y, titulo)`.

        `x, y` é o centro do controle em foco quando dá pra saber qual é, e o
        da janela em primeiro plano quando não dá — é o ponto que a captura do
        elemento vai usar depois. `titulo` é a reserva do rótulo, pro passo
        virar "na janela X" quando o controle não se deixa identificar."""
        try:
            import win32gui
            import win32process

            ativo = win32gui.GetForegroundWindow()
            if not ativo:
                return None, 0, 0, ''
            tid, pid = win32process.GetWindowThreadProcessId(ativo)
            titulo = win32gui.GetWindowText(ativo) or ''

            alvo_hwnd = ativo
            try:
                info = _INSP_GRAV_GUITHREADINFO()
                info.cbSize = ctypes.sizeof(_INSP_GRAV_GUITHREADINFO)
                if (ctypes.windll.user32.GetGUIThreadInfo(tid, ctypes.byref(info))
                        and info.hwndFocus):
                    alvo_hwnd = info.hwndFocus
            except Exception:
                pass

            esquerda, topo, direita, base = win32gui.GetWindowRect(alvo_hwnd)
            return pid, (esquerda + direita) // 2, (topo + base) // 2, titulo
        except Exception:
            return None, 0, 0, ''
