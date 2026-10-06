from .constantes import *
from .inspetor_captura import InspetorCapturaMixin
from .inspetor_candidatos import InspetorCandidatosMixin
from .inspetor_trechos import InspetorTrechosMixin
from .inspetor_relatorio import InspetorRelatorioMixin


class InspetorMixin(InspetorCapturaMixin, InspetorCandidatosMixin,
                    InspetorTrechosMixin, InspetorRelatorioMixin):
    """Aba Inspetor: captura um elemento de UI de QUALQUER outro programa aberto
    no Windows (não precisa ser feito pelo usuário, não precisa estar em
    primeiro plano) via Windows UI Automation (`pywinauto`) + Win32
    (`pywin32`), sem renderizar o app-alvo dentro do VibeCoding e sem
    instrumentar o código dele.

    A captura usa um hook global de mouse (`pynput`) — sem nenhuma janela
    cobrindo a tela — pra não ocluir o app-alvo durante o `from_point()`; só
    o clique esquerdo é suprimido seletivamente (nunca chega ao app de baixo,
    evita acionar a ação real do elemento, tipo "Salvar"). Um contorno
    tracejado acompanha o elemento sob o cursor via uma janela pequena e
    "vazada" (click-through). Roda numa thread separada — não pode travar a
    UI principal do pywebview.

    A aba está dividida em quatro irmãos, pela AMF (teto de 500 linhas):
    `inspetor_captura.py` (hook, destaque, leitura do elemento),
    `inspetor_candidatos.py` (do elemento ao código-fonte),
    `inspetor_trechos.py` (caminhos e leitura de arquivo) e
    `inspetor_relatorio.py` (o texto que vai pra IA). Esta casca guarda só a
    ponte com o frontend e o disparo da captura.
    """

    def _insp_notify(self, payload):
        try:
            self.window.evaluate_js('inspetorCapturaResultado(%s)' % json.dumps(payload))
        except Exception:
            pass

    def inspetor_ativar_captura(self, modo='controle'):
        """Dispara a captura em thread separada. Retorna na hora; o resultado
        chega depois via `_insp_notify` -> `inspetorCapturaResultado` no JS.

        `modo` é o par de botões da tela: `'controle'` (o elemento sob o
        cursor) ou `'janela'` (a janela de topo daquele ponto). Antes o modo
        era escolhido na tela e ignorado aqui — o botão existia sem fazer
        nada."""
        modo = modo if modo in ('controle', 'janela') else 'controle'

        def worker():
            try:
                self._insp_notify({'status': 'aguardando'})
                ponto = self._inspetor_aguardar_clique_com_destaque(modo)
                if ponto is None:
                    self._insp_notify({'status': 'cancelado'})
                    return
                x, y = ponto
                relatorio = self._inspetor_capturar_elemento(x, y, modo)
                self._insp_notify({'status': 'ok', 'relatorio': relatorio})
            except Exception as e:
                self._insp_notify({'status': 'error', 'error': str(e)})

        threading.Thread(target=worker, daemon=True).start()
        return {'success': True}
