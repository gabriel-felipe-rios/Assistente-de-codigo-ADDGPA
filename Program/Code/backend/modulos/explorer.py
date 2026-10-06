from .constantes import *
from webview.dom import _dnd_state


class ExplorerMixin:

    # ── Drop nativo (WebView2 CoreWebView2File) ───────────────────────────────
    # O frontend posta 'FilesDropped' via chrome.webview.postMessageWithAdditionalObjects;
    # o pywebview preenche _dnd_state['paths'] com (nome, caminho_completo) — inclusive
    # para pastas. Isso substitui a heurística de seleção do Explorer via PowerShell.
    def get_dropped_paths(self, names):
        wanted = list(names or [])
        deadline = time.time() + 1.5
        found = []
        while time.time() < deadline:
            found = [item for item in _dnd_state['paths'] if item[0] in wanted]
            if len(found) >= len(wanted):
                break
            time.sleep(0.05)
        for item in found:
            try:
                _dnd_state['paths'].remove(item)
            except ValueError:
                pass
        return {'success': bool(found), 'paths': [p for (_, p) in found]}

    # ── Monitor de drag (detecta quando o usuário pressiona o mouse) ──────────
    def _is_cursor_outside_window(self):
        """Retorna True se o cursor estiver FORA da janela do app (drag vindo do Explorer)."""
        try:
            if not self.window:
                return False
            class POINT(ctypes.Structure):
                _fields_ = [('x', ctypes.c_long), ('y', ctypes.c_long)]
            pt = POINT()
            ctypes.windll.user32.GetCursorPos(ctypes.byref(pt))
            wx, wy = self.window.x, self.window.y
            ww, wh = self.window.width, self.window.height
            return not (wx <= pt.x <= wx + ww and wy <= pt.y <= wy + wh)
        except Exception:
            return False  # Em caso de erro, não pré-busca

    def _start_drag_monitor(self):
        # Sem listener registrado o edgechromium descarta o 'FilesDropped'
        # (ver platforms/edgechromium.py: num_listeners == 0 → return).
        _dnd_state['num_listeners'] += 1
        class POINT(ctypes.Structure):
            _fields_ = [('x', ctypes.c_long), ('y', ctypes.c_long)]

        def loop():
            VK_LBUTTON = 0x01
            user32 = ctypes.windll.user32
            was_pressed = False
            while True:
                try:
                    pressed = bool(user32.GetAsyncKeyState(VK_LBUTTON) & 0x8000)
                    if pressed and not was_pressed:
                        time.sleep(0.3)
                        if user32.GetAsyncKeyState(VK_LBUTTON) & 0x8000:
                            pt = POINT()
                            user32.GetCursorPos(ctypes.byref(pt))
                            # GetCursorPos retorna pixels físicos; Shell.Application usa
                            # pixels lógicos. Converter via DPI para que a comparação bata.
                            try:
                                dpi = user32.GetDpiForSystem()
                                scale = dpi / 96.0
                                lx = int(pt.x / scale)
                                ly = int(pt.y / scale)
                            except Exception:
                                lx, ly = pt.x, pt.y
                            with self._drag_lock:
                                self._drag_cursor = (lx, ly)
                    if not pressed and was_pressed:
                        def clear():
                            time.sleep(0.8)
                            with self._drag_lock:
                                self._drag_paths = []
                                self._drag_cursor = None
                        threading.Thread(target=clear, daemon=True).start()
                    was_pressed = pressed
                except Exception:
                    pass
                time.sleep(0.05)

        threading.Thread(target=loop, daemon=True).start()

    def _fetch_explorer_paths(self, cursor_x=None, cursor_y=None):
        """Consulta itens selecionados no Explorer. Com cursor_x/cursor_y (lógicos),
        prioriza a janela que contém aquela posição (a janela de onde o drag partiu)."""
        try:
            if cursor_x is not None and cursor_y is not None:
                ps = (
                    "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;"
                    f"$cx={cursor_x};$cy={cursor_y};"
                    "$s=New-Object -ComObject Shell.Application;"
                    "$r=@();"
                    "foreach($w in @($s.Windows())){try{"
                    "if($cx -ge $w.Left -and $cx -le ($w.Left+$w.Width)"
                    " -and $cy -ge $w.Top -and $cy -le ($w.Top+$w.Height)){"
                    "foreach($i in @($w.Document.SelectedItems())){if($i.Path){$r+=$i.Path}};break"
                    "}}catch{}};"
                    "if($r.Count -eq 0){foreach($w in @($s.Windows())){try{"
                    "foreach($i in @($w.Document.SelectedItems())){if($i.Path){$r+=$i.Path}}"
                    "}catch{}}};"
                    "$r"
                )
            else:
                ps = (
                    "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;"
                    "$s=New-Object -ComObject Shell.Application;"
                    "$r=@();"
                    "foreach($w in @($s.Windows())){try{"
                    "foreach($i in @($w.Document.SelectedItems())){if($i.Path){$r+=$i.Path}}"
                    "}catch{}};"
                    "$r"
                )
            result = subprocess.run(
                ['powershell', '-NoProfile', '-NonInteractive', '-Command', ps],
                capture_output=True, timeout=5,
                creationflags=0x08000000
            )
            if result.returncode == 0:
                stdout = result.stdout.decode('utf-8', errors='replace')
                return [p.strip() for p in stdout.splitlines() if p.strip()]
        except Exception:
            pass
        return []

    # ── Árvore de pastas ──────────────────────────────────────────────────────
    def check_is_dir(self, path):
        try:
            return {
                'success': True,
                'is_dir': os.path.isdir(path),
                'exists': os.path.exists(path),
            }
        except Exception:
            return {'success': False, 'is_dir': False, 'exists': False}

    def get_explorer_selection(self):
        """Sempre faz query fresca do PowerShell usando o cursor capturado pelo monitor.
        Isso garante que pegamos a seleção ATUAL do Explorer, não um cache potencialmente stale."""
        with self._drag_lock:
            cursor = self._drag_cursor
        # Query fresca com cursor filter (identifica a janela Explorer de origem)
        paths = self._fetch_explorer_paths(
            cursor_x=cursor[0], cursor_y=cursor[1]
        ) if cursor else self._fetch_explorer_paths()
        return {'success': bool(paths), 'paths': paths}

    def get_folder_tree(self, path, max_depth=2):
        def build(p, depth):
            name = os.path.basename(p) or p
            is_dir = os.path.isdir(p)
            node = {'name': name, 'path': p, 'is_dir': is_dir, 'children': []}
            if is_dir and depth > 0:
                try:
                    entries = sorted(os.listdir(p), key=str.lower)
                    for entry in entries[:60]:
                        node['children'].append(build(os.path.join(p, entry), depth - 1))
                except PermissionError:
                    pass
            return node
        if not os.path.exists(path):
            return {'success': False, 'error': 'Caminho não encontrado'}
        return {'success': True, 'tree': build(path, max_depth)}

    def browse_path(self, mode='folder'):
        dialog = webview.FOLDER_DIALOG if mode == 'folder' else webview.OPEN_DIALOG
        result = self.window.create_file_dialog(dialog, allow_multiple=False)
        if result:
            return {'success': True, 'path': result[0]}
        return {'success': False, 'path': None}
