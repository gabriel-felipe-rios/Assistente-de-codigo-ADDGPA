import queue
import sys
from .constantes import *
from .inspetor_gravacao_alvo import InspetorGravacaoAlvoMixin
from .inspetor_gravacao_hook import InspetorGravacaoHookMixin
from .inspetor_gravacao_passos import InspetorGravacaoPassosMixin
from .inspetor_gravacao_resolucao import InspetorGravacaoResolucaoMixin


class InspetorGravacaoMixin(InspetorGravacaoAlvoMixin, InspetorGravacaoHookMixin,
                            InspetorGravacaoPassosMixin,
                            InspetorGravacaoResolucaoMixin):
    """Sub-aba Gravação do Inspetor + botão "▶ Executar programa".

    Diferença central pro Capturar (InspetorMixin): a Gravação é contínua e NÃO
    suprime o clique — você interage normal com o app-alvo e cada ação vira um
    passo. O objetivo não é achar o elemento (isso é o Capturar), e sim
    reconstruir do código-fonte a teia ligada ao botão. A análise estática
    (teia, relações, relatório) mora em InspetorGravacaoTeiaMixin.

    Pelo teto de 500 linhas da AMF, a captura em si está espalhada em cinco
    arquivos: esta casca (abrir o programa, iniciar e parar),
    `inspetor_gravacao_alvo.py` (quem está sendo gravado),
    `inspetor_gravacao_hook.py` (escuta mouse e teclado),
    `inspetor_gravacao_passos.py` (a fila vira passo) e
    `inspetor_gravacao_resolucao.py` (os passos viram teia).
    """

    # ── Abrir programa (launch detached) ────────────────────────────────────
    # Mesmo "arquivo principal" do Terminal, mas aberto e solto (Popen sem
    # esperar/timeout/capturar): o Inspetor precisa do app ABERTO pra
    # inspecionar (o run_script do Terminal bloqueia e mata em 120s).
    def inspetor_abrir_programa(self, project_name):
        workspace = self.load_workspace(project_name)
        if not workspace.get('success'):
            return {'success': False, 'error': 'Não foi possível ler o workspace do projeto.'}
        caminho = (workspace['config'] or {}).get('main_file')
        if not caminho:
            return {'success': False, 'error': (
                'Nenhum arquivo principal configurado. Defina-o na aba '
                'Projeto → Trabalho → "arquivo que inicia o programa".')}
        if not os.path.isfile(caminho):
            return {'success': False, 'error': 'Arquivo principal não encontrado: %s' % caminho}
        try:
            interpretador = sys.executable if caminho.lower().endswith(('.py', '.pyw')) else None
            cmd = [interpretador, caminho] if interpretador else [caminho]
            # DETACHED_PROCESS: solta do nosso processo (fechar o VibeCoding não
            # mata o app-alvo) e não prende console. App de GUI cria a própria janela.
            flags = getattr(subprocess, 'DETACHED_PROCESS', 0) | \
                getattr(subprocess, 'CREATE_NEW_PROCESS_GROUP', 0)
            processo = subprocess.Popen(
                cmd, cwd=os.path.dirname(caminho) or None, creationflags=flags)
            # Guarda o PID pra gravação saber, sem perguntar, qual programa é o
            # alvo. Fica "pendente" até um evento confirmar — ver
            # `_insp_grav_zerar_alvo`.
            self._insp_grav_alvo_pendente = processo.pid
            return {'success': True, 'arquivo': caminho}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Gravação: hook contínuo sem supressão ───────────────────────────────
    def _insp_grav_notify(self, payload):
        try:
            self.window.evaluate_js('inspetorGravacaoEvento(%s)' % json.dumps(payload))
        except Exception:
            pass

    def inspetor_iniciar_gravacao(self, esta_mouse_completo=False,
                                  esta_teclado_ligado=False):
        """Liga o hook. Os dois seletores vêm da tela e valem para a gravação
        inteira — por isso são lidos aqui, no início, e não consultados a cada
        evento. Desmarcados (o padrão) reproduzem o comportamento de antes da
        reforma: só clique esquerdo vira passo."""
        if getattr(self, '_insp_grav_rodando', False):
            return {'success': False, 'error': 'Já existe uma gravação em andamento.'}
        self._insp_grav_rodando = True
        self._insp_grav_hook_vivo = True
        self._insp_grav_mouse_completo = bool(esta_mouse_completo)
        self._insp_grav_teclado_ligado = bool(esta_teclado_ligado)
        self._insp_grav_fila = queue.Queue()
        self._insp_grav_seq = 0
        self._insp_grav_zerar_alvo()
        threading.Thread(target=self._insp_grav_loop_hook, daemon=True).start()
        threading.Thread(target=self._insp_grav_loop_resolver, daemon=True).start()
        return {'success': True}

    def inspetor_parar_gravacao(self):
        """Só para. **Não** resolve a teia — isso virou uma ação separada
        (`inspetor_gravacao_resolver`), que reporta progresso e pode ser
        abandonada. Antes o "Parar" disparava as duas coisas em série, sem
        aviso e sem volta.

        A rolagem ou digitação que estiver em aberto é fechada pelo próprio
        laço do hook antes dele encerrar, então o último movimento não se
        perde. O `_insp_grav_alvo_pendente` é consumido aqui pra uma segunda
        gravação não herdar o alvo da primeira."""
        self._insp_grav_rodando = False
        self._insp_grav_alvo_pendente = None
        return {'success': True}
