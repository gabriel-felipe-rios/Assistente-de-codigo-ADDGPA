from .constantes import *


class InspetorCapturaMixin:
    """Captura de um elemento de UI em (x, y): o hook global de mouse com o
    destaque tracejado click-through, e a leitura do elemento em si (bloco
    semântico via UI Automation + bloco de sistema via Win32).

    Separado de `inspetor.py` pela AMF (teto de 500 linhas): aqui mora tudo
    que fala com o Windows; a busca no código-fonte fica em
    `inspetor_candidatos.py` e o relatório em `inspetor_relatorio.py`.
    """

    # ── Hook global (pynput) + janela de destaque click-through ─────────────

    # Intervalo mínimo entre atualizações do destaque/consultas de UI
    # Automation — sem isso, o hover ficaria consultando a cada pixel de
    # movimento (cada consulta é uma travessia COM, cara). 50ms ~= 20
    # atualizações/s, responsivo sem pesar nem estourar o timeout do hook.
    _INSP_HOVER_THROTTLE_S = 0.05

    _INSP_DESTAQUE_CLASS = 'VibeCodingInspetorDestaque'

    # Watchdog: se por qualquer motivo o hook "emperrar" (ex.: sistema
    # atrasado, exceção inesperada), força o cancelamento em vez de deixar
    # travado pra sempre — foi exatamente a falta disso que exigiu taskkill
    # na rodada anterior.
    _INSP_WATCHDOG_S = 25.0

    def _inspetor_aguardar_clique_com_destaque(self, modo='controle'):
        """Sem nenhuma janela cobrindo a tela (evita o app-alvo ficar
        "atrás" da nossa própria janela durante o `from_point`): a captura de
        mouse/clique usa um hook global (`pynput`, WH_MOUSE_LL por baixo), e
        o destaque ao vivo é uma janela pequena, click-through
        (WS_EX_TRANSPARENT — não interfere no hit-test de ninguém, nem no
        nosso próprio `from_point` da próxima consulta), reposicionada em
        volta do elemento sob o cursor.

        Tudo (janela, bombeamento de mensagens, atualização do destaque,
        checagem de Esc) roda numa única thread/laço — evitar múltiplas
        threads mexendo na mesma janela é o que garante que o `WM_PAINT`
        seja processado (sem isso o destaque nunca aparecia). A captura e
        supressão do clique acontecem *dentro* do próprio filtro do hook
        (`win32_event_filter`, que já recebe as coordenadas via
        `MSLLHOOKSTRUCT`), não dependendo do callback `on_click` de mais
        alto nível — depender dele foi o bug da rodada anterior: como o
        clique era suprimido antes do pynput repassar pro `on_click`, o
        sinal de parada nunca chegava e a thread ficava travada esperando
        pra sempre (o que, com um hook de baixo nível "preso", pode
        travar a entrada de mouse do Windows inteiro)."""
        import win32api
        import win32con
        import win32gui
        from pynput import mouse

        resultado = {'ponto': None}
        estado = {'rect_atual': None, 'ultimo_ponto': None, 'rodando': True, 'ultima_consulta': 0.0}
        colorkey = win32api.RGB(255, 0, 255)  # magenta puro = "buraco" invisível

        # ── Janela de destaque (pequena, click-through) ──────────────────
        def on_paint(hwnd, msg, wparam, lparam):
            hdc, ps = win32gui.BeginPaint(hwnd)
            rect = win32gui.GetClientRect(hwnd)
            brush_fundo = win32gui.CreateSolidBrush(colorkey)
            win32gui.FillRect(hdc, rect, brush_fundo)
            win32gui.DeleteObject(brush_fundo)

            pen = win32gui.CreatePen(win32con.PS_DASH, 1, win32api.RGB(52, 152, 219))
            old_pen = win32gui.SelectObject(hdc, pen)
            old_brush = win32gui.SelectObject(hdc, win32gui.GetStockObject(win32con.NULL_BRUSH))
            win32gui.Rectangle(hdc, 0, 0, rect[2], rect[3])
            win32gui.SelectObject(hdc, old_brush)
            win32gui.SelectObject(hdc, old_pen)
            win32gui.DeleteObject(pen)

            win32gui.EndPaint(hwnd, ps)
            return 0

        hinst = win32api.GetModuleHandle(None)
        wc = win32gui.WNDCLASS()
        wc.hInstance = hinst
        wc.lpszClassName = self._INSP_DESTAQUE_CLASS
        wc.hbrBackground = win32gui.GetStockObject(win32con.NULL_BRUSH)
        wc.lpfnWndProc = {win32con.WM_PAINT: on_paint}
        try:
            win32gui.RegisterClass(wc)
        except Exception:
            pass  # já registrada de uma captura anterior nesta sessão

        ex_style = (
            win32con.WS_EX_LAYERED | win32con.WS_EX_TRANSPARENT |
            win32con.WS_EX_TOPMOST | win32con.WS_EX_TOOLWINDOW | win32con.WS_EX_NOACTIVATE
        )
        hwnd_destaque = win32gui.CreateWindowEx(
            ex_style, self._INSP_DESTAQUE_CLASS, 'VibeCoding Destaque', win32con.WS_POPUP,
            0, 0, 1, 1, 0, 0, hinst, None,
        )
        win32gui.SetLayeredWindowAttributes(hwnd_destaque, colorkey, 0, win32con.LWA_COLORKEY)

        def _atualizar_destaque(rect):
            if rect is None:
                win32gui.ShowWindow(hwnd_destaque, win32con.SW_HIDE)
                return
            l, t, r, b = rect
            margem = 3
            win32gui.SetWindowPos(
                hwnd_destaque, win32con.HWND_TOPMOST,
                l - margem, t - margem, (r - l) + margem * 2, (b - t) + margem * 2,
                win32con.SWP_NOACTIVATE | win32con.SWP_SHOWWINDOW,
            )
            win32gui.InvalidateRect(hwnd_destaque, None, True)

        # ── Consulta UIA (rápida o bastante pro tick de 50ms; se um dia
        # pesar, é candidata a mover pra thread própria) ──────────────────
        def _elemento_rect_no_ponto(x, y):
            # No modo "janela" o destaque contorna a JANELA de topo, não o
            # controle: é o que vai ser capturado, e é win32 puro (sem a
            # travessia COM do UIA, que é a parte cara deste tick).
            if modo == 'janela':
                try:
                    hwnd = win32gui.WindowFromPoint((x, y))
                    root = win32gui.GetAncestor(hwnd, self._INSP_GRAV_GA_ROOT)
                    return win32gui.GetWindowRect(root)
                except Exception:
                    return None
            try:
                from pywinauto import Desktop
                r = Desktop(backend='uia').from_point(x, y).rectangle()
                return (r.left, r.top, r.right, r.bottom)
            except Exception:
                return None

        # ── Hook global de mouse (pynput) ─────────────────────────────────
        def on_move(x, y):
            estado['ultimo_ponto'] = (x, y)

        def win32_event_filter(msg, data):
            # Captura E suprime dentro do próprio filtro — não depende do
            # on_click de mais alto nível, que não dispara pra eventos
            # suprimidos. `data` é um MSLLHOOKSTRUCT; `data.pt` já traz a
            # posição do clique, sem precisar de GetCursorPos.
            if msg == win32con.WM_LBUTTONDOWN:
                resultado['ponto'] = (data.pt.x, data.pt.y)
                estado['rodando'] = False
                listener.suppress_event()
                listener.stop()

        listener = mouse.Listener(on_move=on_move, win32_event_filter=win32_event_filter)

        # Watchdog: cancela sozinho se nada acontecer em N segundos, em vez
        # de depender só do hook pra sair do laço.
        watchdog = threading.Timer(self._INSP_WATCHDOG_S, lambda: estado.update(rodando=False))
        watchdog.daemon = True
        watchdog.start()

        try:
            listener.start()
            while estado['rodando']:
                win32gui.PumpWaitingMessages()  # processa WM_PAINT etc. da janela de destaque

                if win32api.GetAsyncKeyState(win32con.VK_ESCAPE) & 0x8000:
                    resultado['ponto'] = None
                    estado['rodando'] = False
                    break

                agora = time.time()
                if agora - estado['ultima_consulta'] >= self._INSP_HOVER_THROTTLE_S:
                    estado['ultima_consulta'] = agora
                    ponto = estado['ultimo_ponto']
                    if ponto is not None:
                        novo_rect = _elemento_rect_no_ponto(*ponto)
                        if novo_rect != estado['rect_atual']:
                            estado['rect_atual'] = novo_rect
                            _atualizar_destaque(novo_rect)

                time.sleep(0.01)
        finally:
            watchdog.cancel()
            listener.stop()
            win32gui.DestroyWindow(hwnd_destaque)

        return resultado['ponto']

    # ── Captura do elemento em (x, y) ───────────────────────────────────────

    def _inspetor_capturar_elemento(self, x, y, modo='controle'):
        if modo == 'janela':
            relatorio = self._inspetor_capturar_janela(x, y)
        else:
            relatorio = {
                'uia': self._inspetor_capturar_uia(x, y),
                'win32': self._inspetor_capturar_win32(x, y),
            }
        relatorio['ponto'] = {'x': x, 'y': y}
        relatorio['modo'] = modo
        return relatorio

    def _inspetor_capturar_janela(self, x, y):
        """Modo "Janela inteira": a janela de TOPO daquele ponto (GA_ROOT), não
        o controle sob o cursor. Win32 puro — `pywinauto.from_point` é a parte
        cara da captura e aqui não serviria pra nada: o que identifica uma
        janela é o título e o processo, não a árvore de UI.

        Devolve o MESMO formato do modo "controle" (blocos `uia` e `win32`),
        pra relatório e gravação continuarem lendo o mesmo lugar sem saber do
        modo. O que muda é o conteúdo: `automation_id` e `caminho` vêm vazios,
        o tipo é sempre `Window`, e o retângulo é o da janela inteira."""
        try:
            import win32gui
            import win32process

            hwnd = win32gui.WindowFromPoint((x, y))
            root = win32gui.GetAncestor(hwnd, self._INSP_GRAV_GA_ROOT)
            titulo = win32gui.GetWindowText(root) or ''
            rect = win32gui.GetWindowRect(root)
            _, pid = win32process.GetWindowThreadProcessId(root)
            nome_processo, arquivo_processo = self._inspetor_processo_info(pid)

            return {
                'uia': {
                    'success': True,
                    'name': titulo,
                    'automation_id': '',
                    'control_type': 'Window',
                    'texto': titulo,
                    'caminho': '',
                },
                'win32': {
                    'success': True,
                    'handle': hex(root),
                    'class_name': win32gui.GetClassName(root),
                    'processo': nome_processo,
                    'arquivo_processo': arquivo_processo,
                    'retangulo': {
                        'x': rect[0], 'y': rect[1],
                        'w': rect[2] - rect[0], 'h': rect[3] - rect[1],
                    },
                },
            }
        except Exception as e:
            erro = {'success': False, 'error': str(e)}
            return {'uia': dict(erro), 'win32': dict(erro)}

    def _inspetor_capturar_uia(self, x, y):
        """Bloco semântico — Windows UI Automation via pywinauto."""
        try:
            from pywinauto import Desktop

            elem = Desktop(backend='uia').from_point(x, y)
            info = elem.element_info

            # Não existe "caminho" pronto no UIA — monta subindo por parent().
            caminho = []
            cur = elem
            profundidade = 0
            while cur is not None and profundidade < 15:
                rotulo = (cur.element_info.control_type or '?')
                if cur.element_info.name:
                    rotulo += ' "%s"' % cur.element_info.name
                caminho.append(rotulo)
                try:
                    cur = cur.parent()
                except Exception:
                    cur = None
                profundidade += 1
            caminho.reverse()

            try:
                texto = elem.window_text()
            except Exception:
                texto = ''

            return {
                'success': True,
                'name': info.name or '',
                'automation_id': getattr(info, 'automation_id', '') or '',
                'control_type': info.control_type or '',
                'texto': texto or info.name or '',
                'caminho': ' > '.join(caminho),
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _inspetor_capturar_win32(self, x, y):
        """Bloco de sistema — Win32 cru (handle, classe, processo, retângulo)."""
        try:
            import win32gui
            import win32process

            hwnd = win32gui.WindowFromPoint((x, y))
            class_name = win32gui.GetClassName(hwnd)
            rect = win32gui.GetWindowRect(hwnd)
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            nome_processo, arquivo_processo = self._inspetor_processo_info(pid)

            return {
                'success': True,
                'handle': hex(hwnd),
                'class_name': class_name,
                'processo': nome_processo,
                'arquivo_processo': arquivo_processo,
                'retangulo': {
                    'x': rect[0], 'y': rect[1],
                    'w': rect[2] - rect[0], 'h': rect[3] - rect[1],
                },
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _inspetor_processo_info(self, pid):
        """Nome/arquivo do processo sem depender de `psutil` — só pywin32."""
        try:
            import win32api
            import win32con
            import win32process

            h = win32process.OpenProcess(
                win32con.PROCESS_QUERY_INFORMATION | win32con.PROCESS_VM_READ, False, pid,
            )
            try:
                caminho = win32process.GetModuleFileNameEx(h, 0)
                return os.path.basename(caminho), caminho
            finally:
                win32api.CloseHandle(h)
        except Exception:
            return '', ''
