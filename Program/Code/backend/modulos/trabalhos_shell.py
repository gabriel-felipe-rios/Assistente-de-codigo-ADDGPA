"""O nó de TERMINAL da Oficina — um shell do sistema DE VERDADE, em que se digita.

É o único nó que roda coisa. Houve uma versão com dois — `terminal` (agente, em
"tiro só") e `shell` — e o usuário recusou a separação: *"agente e terminal é
uma coisa só"*. Hoje o nó é sempre um `cmd.exe`, e ser agente é um MODO dele:
uma linha que o programa digita lá dentro na hora de abrir.

⚠️ PSEUDO-TERMINAL, E NÃO CANO. Esta é a razão de o arquivo ter sido reescrito.
Um cano NÃO é um terminal: `isatty()` devolve False, o Claude Code detecta isso,
cai sozinho no modo `--print` e morre esperando entrada —

    Error: Input must be provided either through stdin or as a prompt argument
    when using --print

A documentação oficial confirma que não existe flag para forçar o modo
interativo. Não havia conserto do lado do cano.

⚠️ `pywinpty`, E NÃO ctypes — e a escolha foi MEDIDA, não preferência. Primeiro
se escreveu um ConPTY em ctypes puro, para não acrescentar dependência. Ele abre
o pseudoconsole e o filho ENTRA nele (provado: um PTY de 137x42 fez o `cmd.exe`
reportar exatamente `Linhas: 42 / Colunas: 137`), e o `ResizePseudoConsole`
funciona — mas o conhost emite só os 16 bytes de abertura e NUNCA entrega a tela
renderizada pelo cano. Foram descartadas, uma a uma: as quatro formas de passar
o `lpValue` do `UpdateProcThreadAttribute`, `COORD` por valor x empacotado em
DWORD, os três momentos de fechar as pontas do filho, leitor antes x depois do
`CreateProcess`, canos herdáveis, buffer de 64 KB,
`PSEUDOCONSOLE_INHERIT_CURSOR`, e o processo sem console. Sempre os mesmos 16
bytes, na build 26200.

Quem for tentar de novo sem dependência: o encanamento acima está certo, e o que
falta é a entrega da saída pelo conhost. Não recomece pelo começo.

⚠️ SEM `pywinpty` O PROGRAMA NÃO PARA — ele DEGRADA, e diz que degradou.
`_ShellDeCano` refaz o caminho de canos, que serve para comando de sistema
(dir, git, npm) e não serve para o que exige TTY. A tela recebe `pty: False` e
escreve um aviso dentro do próprio terminal. Degradar em silêncio seria pior que
falhar.

⚠️ O QUE TRAFEGA SÃO BYTES, e não linhas. A tela é um xterm.js, e o que vem do
PTY são sequências de escape que POSICIONAM o cursor — quebrar isso em linhas
destrói o desenho. Por isso o buffer é um `bytearray`, o transporte é base64, e
não existe mais `canal` (out/err): num terminal a ordem é a informação, e quem
colore é o próprio programa lá dentro.

⚠️ O ECO NÃO É MAIS NOSSO. Num cano o `cmd.exe` não devolve o que foi digitado e
o programa tinha de escrever `> comando` no log. Num PTY o driver ecoa de
verdade — manter o nosso daria a linha duas vezes.

⚠️ NENHUM AGENTE ABRE TERMINAL. Não há método aqui alcançável pelo servidor MCP:
quantos terminais existem é decisão do usuário, na tela, à mão.
"""

#
# ── Este arquivo era 1.090 linhas, e virou seis ─────────────────────────────
#
# Pelo teto de 500 da AMF, que é obrigatório. Cada um responde uma pergunta:
#
#   trabalhos_shell.py             o registro dos vivos, e como o shell nasce
#   trabalhos_shell_constantes.py  os números e os textos fixos
#   trabalhos_shell_modo.py        a linha que o programa digita lá dentro
#   trabalhos_shell_abrir.py       acender, e a thread que lê a saída
#   trabalhos_shell_digitar.py     mandar tecla, texto, imagem, sinal, tamanho
#   trabalhos_shell_fechar.py      fechar com graça, um, do projeto, ou todos
#
# `TrabalhosShellMixin` continua sendo o nome único que `api.py` importa: ele
# COMPÕE os quatro, no padrão de `InspetorMixin` (Convenção 5 da Arquitetura
# modular). Nenhum tem `__init__` nem `super()`, o que torna a herança múltipla
# inerte.
#
# ⚠️ `_sh_abrir_processo` FICOU AQUI, e não em `_abrir.py`, de propósito: ele é
# o único ponto que sabe COMO o shell nasce, e o levantamento do ConPTY acima
# existe para quem for mexer NELE. Trocar cano por ConPTY é reescrever aquela
# função, e mais nada — e é isso que o mantém junto do texto que explica por
# quê.
#
# ⚠️ O REGISTRO DOS TERMINAIS VIVOS É DE MEMÓRIA, e do processo do PROGRAMA. Do
# processo do servidor MCP ele responde "ninguém" para todo mundo — é o motivo
# de o `Equipe.md` ser regerado só por abrir e fechar terminal, e nunca pelo fim
# de uma transação do Quadro.

from .trabalhos_shell_constantes import *
# Os dois começam com `_`, então `import *` não os traz. Ficam aqui porque
# `_sh_abrir_processo`, logo abaixo, é o único que os usa.
from .trabalhos_shell_processo import _ShellDeCano, _ShellPty

from .trabalhos_shell_modo import TrabalhosShellModoMixin
from .trabalhos_shell_abrir import TrabalhosShellAbrirMixin
from .trabalhos_shell_digitar import TrabalhosShellDigitarMixin
from .trabalhos_shell_fechar import TrabalhosShellFecharMixin


class TrabalhosShellMixin(TrabalhosShellModoMixin, TrabalhosShellAbrirMixin,
                          TrabalhosShellDigitarMixin, TrabalhosShellFecharMixin):
    # ── O registro dos terminais vivos ───────────────────────────────────────
    #
    # Em memória, e morre com o programa: o nó continua no canvas depois de
    # fechar o app (isso é `Layout.json`), mas o processo não sobrevive — e
    # guardar um PID em disco daria um botão apontando para um processo que já
    # não existe, ou pior, para um PID reciclado.

    _sh_procs = None
    _sh_dados = None
    # Quem foi fechado de propósito, e quando. Ver `_sh_em_luto`.
    _sh_luto = None
    # O `evaluate_js` do pywebview não é reentrante, e aqui há uma thread
    # leitora POR TERMINAL ABERTO.
    _sh_notify_lock = threading.Lock()

    def _sh_procs_dict(self):
        if self._sh_procs is None:
            self._sh_procs = {}
        return self._sh_procs

    def _sh_dados_dict(self):
        if self._sh_dados is None:
            self._sh_dados = {}
        return self._sh_dados

    def _sh_chave(self, project_name, id_no):
        return (project_name, id_no)

    def _sh_dado(self, project_name, id_no):
        d = self._sh_dados_dict()
        chave = self._sh_chave(project_name, id_no)
        if chave not in d:
            d[chave] = {'bytes': bytearray(), 'cwd': None, 'pty': True,
                        'colunas': COLUNAS_PADRAO, 'linhas': LINHAS_PADRAO,
                        # A hora do último byte que chegou. É o sinal de que o
                        # shell parou de falar — ver `_sh_injetar_quando_pronto`.
                        'ultimo_byte': 0.0}
        return d[chave]

    def _sh_notify(self, project_name, id_no, payload):
        try:
            payload = dict(payload)
            payload['project'] = project_name
            payload['no'] = id_no
            with self._sh_notify_lock:
                self.window.evaluate_js('oficinaShellSaida(%s)' % json.dumps(payload))
        except Exception:
            # A ponte pode não existir (servidor MCP, teste headless). Perder a
            # notificação é aceitável; derrubar a thread do terminal não é.
            pass

    # Quanto tempo depois de um fechamento DELIBERADO o terminal se recusa a
    # ressuscitar sozinho. Ver `_sh_em_luto`.
    LUTO_DEPOIS_DE_FECHAR = 4.0

    def _sh_luto_dict(self):
        if self._sh_luto is None:
            self._sh_luto = {}
        return self._sh_luto

    def _sh_em_luto(self, project_name, id_no):
        """Este terminal acabou de ser fechado de propósito?

        ⚠️ ISTO EXISTE POR CAUSA DA SAÍDA COM GRAÇA, e o defeito era visível:
        o usuário apertava "Parar tudo", o terminal fechava — e **abria
        sozinho de novo** um instante depois.

        A causa é uma ponta solta que só apareceu quando o assistente passou a
        sair BEM. Antes ele levava `taskkill /F` e morria mudo. Agora ele sai
        pela porta, e ao sair devolve o terminal ao estado original — e nesse
        despejo vão `ESC[c` e `ESC[>0q`, que são PERGUNTAS. O xterm.js do outro
        lado é obrigado a respondê-las, e responde por `onData`, que cai em
        `escrever_no_shell`... que ACENDE um terminal apagado. O `cmd.exe`
        nascia de novo sem ninguém ter tocado numa tecla.
        (É o mesmo mecanismo que o ⚠️ do replay já descrevia; ali a pergunta
        vinha do buffer, aqui vem da despedida.)

        A resposta do emulador chega em milissegundos; uma tecla de verdade,
        logo depois de o usuário mandar fechar, não chega. Quatro segundos
        separam os dois com folga — e quem quiser mesmo reabrir tem o gesto de
        sempre, um instante depois.
        """
        quando = self._sh_luto_dict().get(self._sh_chave(project_name, id_no))
        return quando is not None and (time.monotonic() - quando) < self.LUTO_DEPOIS_DE_FECHAR

    def _sh_vivo(self, project_name, id_no):
        """Está aberto? REGISTRADO e não PROVADO morto.

        ⚠️ NA DÚVIDA, VIVO — e a dúvida existe: `vivo()` devolve `None` quando o
        `isalive()` da biblioteca levanta. Antes a dúvida virava "fechado", e o
        preço era alto dos dois lados: a tela apagava a luz de um terminal que
        estava rodando, e `escrever_no_shell` abria um `cmd.exe` NOVO por cima
        do que já existia. Registrado e sem prova de morte é o mesmo critério
        que a leitora usa para soltar o processo — as duas respostas passam a
        vir da mesma regra.
        """
        proc = self._sh_procs_dict().get(self._sh_chave(project_name, id_no))
        if proc is None:
            return False
        try:
            return proc.vivo() is not False
        except Exception:
            return True

    # ⚠️ O CORTE DO BUFFER É NUMA QUEBRA DE LINHA, NUNCA NUM OFFSET QUALQUER.
    # Cortar no meio de uma sequência de escape faz o resto do replay virar lixo
    # colorido na tela.
    def _sh_aparar(self, buf):
        if len(buf) <= TETO_DE_BYTES:
            return buf
        corte = len(buf) - TETO_DE_BYTES
        quebra = buf.find(b'\n', corte, corte + 4096)
        return buf[(quebra + 1) if quebra >= 0 else corte:]

    def _sh_ambiente(self):
        """O ambiente do filho, com o pedido de UTF-8.

        ⚠️ MEDIDO, não suposto: um filho que escreve na saída usando o code page
        ANSI do Windows devolve `faça` como `fa?a`. Estas variáveis são o que se
        pode pedir de fora, e cobrem os interpretadores mais comuns.

        `TERM` entra porque muita ferramenta de CLI escrita para POSIX consulta
        essa variável para decidir se pode usar cor e cursor.
        """
        env = dict(os.environ)
        env['PYTHONIOENCODING'] = 'utf-8'
        env['PYTHONUTF8'] = '1'
        env['TERM'] = 'xterm-256color'
        env.setdefault('LANG', 'en_US.UTF-8')
        return env

    def _sh_abrir_processo(self, cwd, colunas, linhas):
        """O ÚNICO ponto que sabe COMO o terminal nasce.

        Isolado de propósito, e a promessa se pagou: trocar cano por PTY foi
        reescrever esta função e o objeto que ela devolve, e nada acima daqui
        precisou saber qual dos dois está por baixo.
        """
        if tem_pseudoterminal():
            return _ShellPty(SHELL_PADRAO, cwd, self._sh_ambiente(),
                             colunas, linhas), True
        return _ShellDeCano(SHELL_PADRAO, cwd, self._sh_ambiente()), False

    # ── O que a tela lê ──────────────────────────────────────────────────────

    def carregar_shell(self, project_name, id_no):
        """Tudo que saiu até agora, para a tela reidratar o terminal.

        ⚠️ REIDRATAR BYTES CRUS É RECONSTRUÇÃO, NÃO FOTOGRAFIA. O xterm.js
        reexecuta as sequências, então saída em linhas volta perfeita; um
        programa de tela cheia que estava no meio de um desenho pode voltar
        torto. É o caso raro, e o preço de não manter um segundo lugar
        guardando a mesma coisa.
        """
        try:
            dado = self._sh_dado(project_name, id_no)
            return {'success': True,
                    'b64': base64.b64encode(
                        self._sh_replayavel(bytes(dado['bytes']))).decode('ascii'),
                    'rodando': self._sh_vivo(project_name, id_no),
                    'cwd': dado['cwd'], 'pty': dado['pty'],
                    'colunas': dado['colunas'], 'linhas': dado['linhas'],
                    'tem_pty_no_sistema': tem_pseudoterminal()}
        except Exception as e:
            return {'success': False, 'error': str(e)}
