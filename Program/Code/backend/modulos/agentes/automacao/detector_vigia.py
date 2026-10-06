"""O vigia do Detector — evento nativo do Windows, com varredura de rede.

Substitui o laço de `mtime` a cada 2 segundos que vivia no antigo Watcher. A
varredura de mtime tem um buraco que nenhum ajuste de intervalo conserta: ela
compara a hora de modificação de arquivos que **já estava vendo**. Arquivo
CRIADO, RENOMEADO, MOVIDO ou APAGADO não tem mtime anterior com que comparar —
e por isso duplicar um arquivo nunca disparou o ciclo.

Duas fontes, e as duas são necessárias: o **`ReadDirectoryChangesW`** (o aviso
nativo do sistema, por pasta de trabalho, com subárvore — vê as cinco operações,
na hora, sem varrer nada) e a **varredura completa** como rede de segurança,
espaçada em minutos, nunca mais a cada 2 segundos.

⛔ **A varredura não pode ser apagada** quando o nativo está de pé. Ela é o que
segura os dois casos que o evento não cobre — buffer estourado (a documentação
da Microsoft manda revarrer) e mudança feita com o programa FECHADO.

⚠️ **Mover entre pastas NÃO chega como "renomeado".** Testado nesta máquina:
mover chega como *apagado + criado*. O par `renomeado(de)/renomeado(para)` só
aparece quando o arquivo é renomeado DENTRO da mesma pasta. Quem pareia "sumiu
aqui + nasceu ali" continua sendo o hash de conteúdo, no Detector — não conte
com o nativo para isso.

⚠️ **O ruído é da Espera, não daqui.** O nativo manda evento duplicado (dois
"alterado" para uma escrita só) e evento na própria pasta. Filtrar aqui seria
adivinhar; a Espera já junta a rajada e entrega uma vez só.
"""

import threading
import time

from ...constantes import *
from ...ignorados import fora_do_programa


class DetectorVigiaMixin:
    """A metade do Detector que fica acordada esperando o disco se mexer."""

    # ⚠️ `LAST_ACCESS` NÃO ENTRA: só abrir um arquivo para ler já geraria evento,
    # e o programa rodaria o ciclo porque alguém leu o código. (Nem daria —
    # `win32con` desta versão não tem a constante. É conveniente, não é a razão.)
    _DET_FILTRO = (0x01 |   # FILE_NOTIFY_CHANGE_FILE_NAME
                   0x02 |   # FILE_NOTIFY_CHANGE_DIR_NAME
                   0x08 |   # FILE_NOTIFY_CHANGE_SIZE
                   0x10)    # FILE_NOTIFY_CHANGE_LAST_WRITE

    # 64 KB é o teto documentado: acima disso a chamada falha em pasta de rede
    # com ERROR_INVALID_PARAMETER.
    _DET_BUFFER = 64 * 1024

    # Segundos entre duas varreduras de segurança. Minutos, não segundos: ela
    # existe para cobrir o que o evento nativo perdeu, não para ser a detecção.
    _DET_INTERVALO_VARREDURA = 180

    # ERROR_NOTIFY_ENUM_DIR — a outra forma de o sistema dizer "perdi eventos,
    # revarra". A primeira é devolver zero bytes.
    _DET_ERRO_REVARRER = 1022

    # ERROR_OPERATION_ABORTED — a espera foi cancelada de fora, por
    # `_det_parar_vigia`. É saída normal, não falha.
    _DET_ERRO_CANCELADO = 995

    # ── Estado ──────────────────────────────────────────────────────────────

    def _det_estado(self, project_name):
        if not hasattr(self, '_det_vigias'):
            self._det_vigias = {}
        return self._det_vigias.get(project_name)

    def _det_anotar(self, project_name, caminhos):
        """Guarda caminhos vistos, para a Espera drenar quando quiser."""
        vigia = self._det_estado(project_name)
        if not vigia or not caminhos:
            return
        with vigia['trava']:
            vigia['mudados'].update(caminhos)

    def _det_drenar(self, project_name):
        """Tira e devolve tudo que foi visto desde a última vez — é o que a
        Espera consome, em `_ac_espera_laco`."""
        vigia = self._det_estado(project_name)
        if not vigia:
            return set()
        with vigia['trava']:
            vistos = vigia['mudados']
            vigia['mudados'] = set()
        return vistos

    # ── Subir e parar ───────────────────────────────────────────────────────

    def _det_subir_vigia(self, project_name):
        """Abre um handle por pasta de trabalho e sobe as threads: uma por pasta,
        porque `ReadDirectoryChangesW` bloqueia até chegar evento, mais uma para
        a varredura de segurança."""
        if not hasattr(self, '_det_vigias'):
            self._det_vigias = {}
        if project_name in self._det_vigias:
            return
        self._det_vigias[project_name] = {
            'active': True, 'mudados': set(), 'trava': threading.Lock(),
            'handles': [], 'revarrer': threading.Event(),
        }
        for pasta in self._det_pastas(project_name):
            threading.Thread(target=self._det_laco, args=(project_name, pasta),
                             daemon=True, name='vigia:%s' % pasta).start()
        threading.Thread(target=self._det_laco_da_varredura, args=(project_name,),
                         daemon=True, name='vigia-varredura').start()

    def _det_parar_vigia(self, project_name):
        """Derruba as threads CANCELANDO a espera de cada handle.

        ⚠️ **Não feche o handle daqui.** `ReadDirectoryChangesW` é síncrono e
        fica parado dentro do kernel esperando evento; `CloseHandle` chamado de
        OUTRA thread sobre um handle com E/S pendente **bloqueia** — medido: o
        programa inteiro congelava ao clicar em "Desativar tudo" ou ao trocar de
        projeto, e só voltava se alguém salvasse um arquivo naquela pasta.

        `CancelIoEx` é o caminho certo: a espera volta com
        ERROR_OPERATION_ABORTED e é a própria thread do laço que fecha o handle
        dela, no `finally`. Quem abre, fecha. Vem por `ctypes` porque esta versão
        do pywin32 não o expõe — só `CancelIo`, que cancela apenas a E/S da
        thread que chama, e quem para é sempre outra thread.
        """
        vigia = self._det_estado(project_name)
        if not vigia:
            return
        vigia['active'] = False
        vigia['revarrer'].set()
        for h in list(vigia['handles']):
            self._det_cancelar_espera(h)
        vigia['handles'] = []
        self._det_vigias.pop(project_name, None)

    @staticmethod
    def _det_cancelar_espera(handle):
        """Acorda um `ReadDirectoryChangesW` parado. Silencioso se não der.

        Sem `CancelIoEx` (Windows anterior ao Vista), a thread fica parada até o
        próximo evento naquela pasta e sai então — desperdício pequeno e
        limitado. O que não se faz é fechar o handle daqui: isso troca um
        desperdício por um congelamento.
        """
        try:
            import ctypes
            kernel32 = ctypes.windll.kernel32
            kernel32.CancelIoEx.argtypes = [ctypes.c_void_p, ctypes.c_void_p]
            kernel32.CancelIoEx.restype = ctypes.c_int
            kernel32.CancelIoEx(ctypes.c_void_p(int(handle)), None)
        except Exception:
            pass

    def _det_pastas(self, project_name):
        """As pastas de trabalho do projeto, só as que existem no disco."""
        try:
            workspace = self.load_workspace(project_name)
            if not workspace.get('success'):
                return []
            return [p for p in workspace['config'].get('working_folders', [])
                    if os.path.isdir(p)]
        except Exception:
            return []

    def _det_ignore_list(self, project_name):
        try:
            workspace = self.load_workspace(project_name)
            if workspace.get('success'):
                return workspace['config'].get('ignore_list', [])
        except Exception:
            pass
        return []

    def _det_interessa(self, caminho, ignore_list):
        """Passa pelo mesmo funil da varredura — a lista "Remover" da aba Projeto
        e as listas globais de `extensoes.json`. Medido num teste real: 12
        eventos viram 10, com os dois de `node_modules` descartados. Sem isto,
        salvar dentro de uma pasta ignorada dispararia o ciclo inteiro.
        """
        if fora_do_programa(caminho):
            return False
        return not self._caminho_ignorado(caminho, ignore_list)

    # ── O laço de eventos ───────────────────────────────────────────────────

    def _det_laco(self, project_name, pasta):
        """Escuta uma pasta de trabalho até o vigia ser derrubado."""
        try:
            import win32file
            import pywintypes
        except Exception as e:
            # Sem pywin32 o programa continua funcionando: a varredura de
            # segurança vira a única fonte. Mais lenta, e só isso.
            print('[detector] sem evento nativo (%s) — só a varredura' % e)
            return

        handle = None
        try:
            handle = win32file.CreateFile(
                pasta,
                win32file.GENERIC_READ,
                (win32file.FILE_SHARE_READ | win32file.FILE_SHARE_WRITE
                 | win32file.FILE_SHARE_DELETE),
                None,
                win32file.OPEN_EXISTING,
                win32file.FILE_FLAG_BACKUP_SEMANTICS,
                None)
        except Exception as e:
            print('[detector] não consegui vigiar %s: %s' % (pasta, e))
            return

        vigia = self._det_estado(project_name)
        if not vigia or not vigia['active']:
            try:
                win32file.CloseHandle(handle)
            except Exception:
                pass
            return
        vigia['handles'].append(handle)

        # QUEM ABRE, FECHA. O handle é fechado aqui, e em lugar nenhum mais —
        # ver o aviso em `_det_parar_vigia`.
        try:
            self._det_escutar(project_name, pasta, handle, win32file, pywintypes)
        finally:
            try:
                win32file.CloseHandle(handle)
            except Exception:
                pass

    def _det_escutar(self, project_name, pasta, handle, win32file, pywintypes):
        """O laço em si. Sai quando o vigia é derrubado ou a pasta perde suporte."""
        while True:
            estado = self._det_estado(project_name)
            if not estado or not estado['active']:
                return
            try:
                eventos = win32file.ReadDirectoryChangesW(
                    handle, self._DET_BUFFER, True, self._DET_FILTRO, None, None)
            except pywintypes.error as e:
                if e.winerror == self._DET_ERRO_CANCELADO:
                    return                      # parada normal, pedida de fora
                if not self._det_estado(project_name):
                    return                      # o vigia caiu enquanto esperava
                if e.winerror == self._DET_ERRO_REVARRER:
                    self._det_pedir_varredura(project_name)
                    continue
                # ERROR_INVALID_PARAMETER (pasta de rede) e
                # ERROR_INVALID_FUNCTION (sistema de arquivos sem suporte) não
                # se resolvem tentando de novo: esta pasta passa a ser coberta
                # só pela varredura.
                print('[detector] evento nativo indisponível em %s (%s) — '
                      'só a varredura cobre esta pasta' % (pasta, e))
                self._det_pedir_varredura(project_name)
                return
            except Exception:
                return

            if not eventos:
                # Zero bytes = o buffer estourou e o sistema perdeu eventos. A
                # documentação da Microsoft manda revarrer, e é o que se faz.
                self._det_pedir_varredura(project_name)
                continue

            ignore_list = self._det_ignore_list(project_name)
            vistos = set()
            for _acao, relativo in eventos:
                caminho = os.path.join(pasta, relativo)
                if self._det_interessa(caminho, ignore_list):
                    vistos.add(caminho)
            self._det_anotar(project_name, vistos)

    def _det_pedir_varredura(self, project_name):
        vigia = self._det_estado(project_name)
        if vigia:
            vigia['revarrer'].set()

    # ── A rede de segurança ─────────────────────────────────────────────────

    def _det_laco_da_varredura(self, project_name):
        """Varre de tempos em tempos — e na hora, quando pedirem.

        Duas razões para existir, e nenhuma some quando o evento nativo funciona
        bem: buffer estourado (o sistema avisa que perdeu eventos, mas não quais)
        e mudança feita com o programa fechado.
        """
        vigia = self._det_estado(project_name)
        while vigia and vigia['active']:
            # Espera o intervalo OU um pedido de revarredura, o que vier antes.
            imediata = vigia['revarrer'].wait(self._DET_INTERVALO_VARREDURA)
            vigia = self._det_estado(project_name)
            if not vigia or not vigia['active']:
                return
            vigia['revarrer'].clear()
            if imediata:
                # Um respiro antes de varrer: o estouro de buffer costuma vir
                # no meio de uma rajada (um `git checkout`), e varrer no meio
                # dela seria varrer duas vezes.
                time.sleep(2)
            try:
                self._det_anotar(project_name,
                                 self._det_varredura_completa(project_name))
            except Exception as e:
                print('[detector] varredura de %s falhou: %s: %s'
                      % (project_name, type(e).__name__, e))

    def _det_varredura_completa(self, project_name):
        """O que mudou comparando o disco com a linha de base do Hashes.

        Devolve caminhos absolutos, inclusive dos APAGADOS: quem sumiu também é
        mudança. Sem linha de base não há comparação possível — devolve vazio, e
        o ciclo trata "tudo" por outro caminho.
        """
        diff = self.get_arquivos_mudados(project_name)
        if not diff.get('success') or not diff.get('baseline'):
            return set()
        vistos = set(diff.get('mudados') or [])
        for chave in diff.get('removidos') or []:
            caminho = self._hs_abs_path(project_name, chave)
            if caminho:
                vistos.add(caminho)
        ignore_list = self._det_ignore_list(project_name)
        return {c for c in vistos if self._det_interessa(c, ignore_list)}
