from .constantes import *

# Teclas que são modificador, e o rótulo com que aparecem num atalho. Shift
# está aqui mas NÃO transforma uma digitação em atalho sozinho — "Shift+A" é
# só a letra A maiúscula, digitação normal.
_INSP_GRAV_MODIFICADORES = {
    'ctrl': 'Ctrl', 'ctrl_l': 'Ctrl', 'ctrl_r': 'Ctrl',
    'alt': 'Alt', 'alt_l': 'Alt', 'alt_r': 'Alt', 'alt_gr': 'Alt',
    'cmd': 'Win', 'cmd_l': 'Win', 'cmd_r': 'Win',
    'shift': 'Shift', 'shift_l': 'Shift', 'shift_r': 'Shift',
}
_INSP_GRAV_MODIFICADORES_DE_COMANDO = ('Ctrl', 'Alt', 'Win')

# Nome bonito das teclas especiais que viram passo próprio.
_INSP_GRAV_ROTULO_TECLA = {
    'enter': 'Enter', 'esc': 'Esc', 'tab': 'Tab', 'space': 'Espaço',
    'backspace': 'Backspace', 'delete': 'Delete', 'insert': 'Insert',
    'home': 'Home', 'end': 'End', 'page_up': 'Page Up', 'page_down': 'Page Down',
    'up': 'Seta para cima', 'down': 'Seta para baixo',
    'left': 'Seta para a esquerda', 'right': 'Seta para a direita',
}

_INSP_GRAV_ACAO_POR_BOTAO = {
    'left': 'clique', 'right': 'clique_direito', 'middle': 'clique_meio',
}


class InspetorGravacaoHookMixin:
    """O hook global que escuta a interação do usuário com o app-alvo.

    Escuta SEM suprimir: o clique chega no app normalmente e o programa
    reage — o objetivo aqui é registrar o fluxo, não interceptá-lo (isso é o
    Capturar). Só enfileira o evento; a consulta de UI Automation, que é cara,
    roda na thread do resolvedor.

    Dois seletores mandam no que é escutado, ambos desmarcados por padrão
    (padrão = o comportamento de antes da reforma):

    - **Mouse completo**: sem ele, só clique esquerdo. Com ele, entram duplo
      clique, botão direito, botão do meio e rolagem.
    - **Teclado**: sem ele, tecla nenhuma vira passo.

    🚫 **O que foi digitado nunca sai daqui.** O caractere é lido para
    classificar a tecla (imprimível × especial × atalho) e descartado na mesma
    expressão. Senha, token ou dado pessoal digitado durante a gravação não
    tem por onde entrar no passo nem no relatório — que vai para a área de
    transferência e daí para uma IA externa.
    """

    # Dois cliques neste intervalo e a esta distância são UM duplo clique, e o
    # segundo substitui o passo do primeiro em vez de somar mais um.
    _INSP_GRAV_DUPLO_S = 0.35
    _INSP_GRAV_DUPLO_PX = 4

    # Rolar dispara dezenas de eventos de roda por segundo. Um passo por evento
    # afogaria o fluxo — então a rolagem é agregada e só fecha depois deste
    # silêncio, virando UM passo ("rolou para baixo em «lista de projetos»").
    _INSP_GRAV_ROLAGEM_SILENCIO_S = 0.6

    # Mesma ideia para a digitação contínua no mesmo campo: um passo por tecla
    # seria ilegível. Mais folgado que a rolagem porque pausa para pensar no
    # meio de uma frase é normal.
    _INSP_GRAV_DIGITACAO_SILENCIO_S = 1.0

    def _insp_grav_classificar_tecla(self, key, modificadores):
        """`(natureza, rótulo)` — natureza é `'digitacao'`, `'tecla'` ou
        `None` (a própria tecla é um modificador, não vira passo).

        ⚠️ **O caractere não sai desta função.** Tecla imprimível vira só a
        natureza `'digitacao'`, sem rótulo nenhum. A única letra que aparece é
        a de um atalho ("Ctrl+S"), onde ela é o NOME do comando e não o texto
        que a pessoa escreveu."""
        nome = getattr(key, 'name', None) or ''
        if nome in _INSP_GRAV_MODIFICADORES:
            return None, ''

        comando = sorted(m for m in modificadores
                         if m in _INSP_GRAV_MODIFICADORES_DE_COMANDO)
        if comando:
            combinacao = '+'.join(comando)
            if 'Shift' in modificadores:
                combinacao += '+Shift'
            if nome:
                final = _INSP_GRAV_ROTULO_TECLA.get(nome, nome.replace('_', ' ').capitalize())
            else:
                final = (getattr(key, 'char', None) or '?').upper()
            return 'tecla', '%s+%s' % (combinacao, final)

        if nome and nome != 'space':
            return 'tecla', _INSP_GRAV_ROTULO_TECLA.get(
                nome, nome.replace('_', ' ').capitalize())
        return 'digitacao', ''

    def _insp_grav_loop_hook(self):
        """Escuta a interação e enfileira eventos. Um evento é um dicionário
        com `acao`, o ponto onde ela aconteceu e o que mais o rótulo precisar —
        nunca o conteúdo do que foi digitado."""
        try:
            from pynput import mouse, keyboard
        except Exception as e:
            self._insp_grav_notify({'tipo': 'erro', 'erro': 'Dependência ausente: %s' % e})
            self._insp_grav_rodando = False
            self._insp_grav_hook_vivo = False
            return

        own_pid = os.getpid()
        pendente = {'rolagem': None, 'digitacao': None}
        ultimo_clique = {'x': 0, 'y': 0, 'instante': 0.0}
        modificadores = set()

        # ── Fechamento das ações agregadas ──────────────────────────────────
        def fecha_rolagem():
            r = pendente['rolagem']
            pendente['rolagem'] = None
            if r:
                self._insp_grav_fila.put({
                    'acao': 'rolagem', 'x': r['x'], 'y': r['y'],
                    'detalhe': r['direcao'], 'quantidade': r['quantidade']})

        def fecha_digitacao():
            d = pendente['digitacao']
            pendente['digitacao'] = None
            if d:
                self._insp_grav_fila.put({
                    'acao': 'tecla', 'x': d['x'], 'y': d['y'],
                    'detalhe': 'digitou', 'titulo': d['titulo']})

        def fecha_tudo():
            fecha_rolagem()
            fecha_digitacao()

        def do_alvo(x, y):
            """`True` se o ponto pertence ao programa que está sendo gravado.
            A janela do próprio Assistente cai fora antes de tudo — é comum
            voltar aqui no meio da gravação (para clicar "Parar")."""
            pid = self._insp_grav_pid_do_ponto(x, y)
            if pid is None or pid == own_pid:
                return False
            return self._insp_grav_eh_alvo(pid)

        # ── Mouse ───────────────────────────────────────────────────────────
        def on_click(x, y, button, pressed):
            if not self._insp_grav_rodando:
                return False  # encerra o listener
            if not pressed:
                return
            acao = _INSP_GRAV_ACAO_POR_BOTAO.get(getattr(button, 'name', ''))
            if acao is None:
                return  # botão lateral do mouse: não é ação de interface
            if not self._insp_grav_mouse_completo and acao != 'clique':
                return
            if not do_alvo(x, y):
                return

            fecha_tudo()
            agora = time.time()
            substitui = False
            if acao == 'clique' and self._insp_grav_mouse_completo:
                perto = (abs(x - ultimo_clique['x']) <= self._INSP_GRAV_DUPLO_PX
                         and abs(y - ultimo_clique['y']) <= self._INSP_GRAV_DUPLO_PX)
                if perto and agora - ultimo_clique['instante'] <= self._INSP_GRAV_DUPLO_S:
                    acao, substitui = 'clique_duplo', True
                    ultimo_clique['instante'] = 0.0  # o terceiro clique não vira triplo
                else:
                    ultimo_clique.update(x=x, y=y, instante=agora)
            self._insp_grav_fila.put(
                {'acao': acao, 'x': x, 'y': y, 'substitui': substitui})

        def on_scroll(x, y, dx, dy):
            if not self._insp_grav_rodando:
                return False
            r = pendente['rolagem']
            direcao = (('para baixo' if dy < 0 else 'para cima') if dy
                       else ('para a direita' if dx > 0 else 'para a esquerda'))
            # Enquanto a rolagem continua na mesma direção, o alvo já foi
            # conferido quando ela abriu: repetir a checagem a cada evento de
            # roda custaria três chamadas Win32 dezenas de vezes por segundo.
            if r and r['direcao'] == direcao:
                r['quantidade'] += 1
                r['instante'] = time.time()
                return
            if not do_alvo(x, y):
                return
            fecha_tudo()
            pendente['rolagem'] = {'x': x, 'y': y, 'direcao': direcao,
                                   'quantidade': 1, 'instante': time.time()}

        # ── Teclado ─────────────────────────────────────────────────────────
        def on_press(key):
            if not self._insp_grav_rodando:
                return False
            modificador = _INSP_GRAV_MODIFICADORES.get(getattr(key, 'name', None) or '')
            if modificador:
                modificadores.add(modificador)
                return

            pid, x, y, titulo = self._insp_grav_foco()
            if pid is None or pid == own_pid or not self._insp_grav_eh_alvo(pid):
                return
            natureza, rotulo = self._insp_grav_classificar_tecla(key, modificadores)
            if natureza is None:
                return

            fecha_rolagem()
            if natureza == 'digitacao':
                d = pendente['digitacao']
                if d and d['x'] == x and d['y'] == y:
                    d['instante'] = time.time()  # mesma rajada, mesmo campo
                    return
                fecha_digitacao()
                pendente['digitacao'] = {'x': x, 'y': y, 'titulo': titulo,
                                         'instante': time.time()}
                return

            fecha_digitacao()
            self._insp_grav_fila.put({'acao': 'tecla', 'x': x, 'y': y,
                                      'detalhe': rotulo, 'titulo': titulo})

        def on_release(key):
            if not self._insp_grav_rodando:
                return False
            modificador = _INSP_GRAV_MODIFICADORES.get(getattr(key, 'name', None) or '')
            if modificador:
                modificadores.discard(modificador)

        ouvintes = [mouse.Listener(
            on_click=on_click,
            on_scroll=on_scroll if self._insp_grav_mouse_completo else None)]
        if self._insp_grav_teclado_ligado:
            ouvintes.append(keyboard.Listener(on_press=on_press, on_release=on_release))

        for ouvinte in ouvintes:
            ouvinte.start()
        try:
            while self._insp_grav_rodando:
                agora = time.time()
                r = pendente['rolagem']
                if r and agora - r['instante'] >= self._INSP_GRAV_ROLAGEM_SILENCIO_S:
                    fecha_rolagem()
                d = pendente['digitacao']
                if d and agora - d['instante'] >= self._INSP_GRAV_DIGITACAO_SILENCIO_S:
                    fecha_digitacao()
                time.sleep(0.05)
            # O "Parar" não pode engolir a última rolagem/digitação em aberto.
            fecha_tudo()
        finally:
            for ouvinte in ouvintes:
                ouvinte.stop()
            self._insp_grav_hook_vivo = False
