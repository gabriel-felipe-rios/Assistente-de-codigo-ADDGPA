"""Os dois jeitos de o terminal da Oficina nascer — e a interface que os iguala.

Arquivo próprio, e não um pedaço de `trabalhos_shell.py`, pela mesma regra que
separou `estilos_e_cores.py` de `estilos_e_cores_crud.py`: **cada arquivo
responde uma pergunta diferente**. Aqui a pergunta é *como o processo nasce e
como se fala com ele*; lá é *o que a Oficina faz com ele*.

⚠️ OS DOIS TÊM A MESMA INTERFACE, E ISSO NÃO É COINCIDÊNCIA — é o contrato:

    ler(quanto)              -> bytes; b'' quando acabou
    escrever(bytes)          -> quantos bytes foram
    redimensionar(cols, lin) -> None
    vivo()                   -> bool
    fechar()                 -> None
    .pid

É esse contrato que deixa `trabalhos_shell.py` inteiro ignorar qual dos dois
está por baixo. Quem acrescentar um terceiro (um ConPTY próprio, um shell
remoto) implementa estes seis e não toca em mais nada.

⚠️ `_ShellPty` É O CAMINHO NORMAL; `_ShellDeCano` É DEGRADAÇÃO DECLARADA. O
segundo existe para a máquina sem `pywinpty`, serve para comando de sistema e
não serve para o que exige TTY — e quem avisa isso é a tela, não este arquivo.
O porquê de tudo isso está no cabeçalho de `trabalhos_shell.py`.
"""

import socket
import subprocess
import time

try:
    from winpty import PtyProcess
except Exception:      # sem a lib, o modo degradado assume
    PtyProcess = None

# ⚠️ SEM `/Q`. Num cano o `/Q` (echo off) era inofensivo; num PTY ele some com o
# eco dos comandos digitados, que é justamente o que se ganhou ao trocar de
# motor. O `/K` mantém o shell vivo depois do `prompt`.
SHELL_PADRAO = ['cmd.exe', '/K', 'prompt $P$G']

# ── A saída com graça, antes do `/F` ────────────────────────────────────────
#
# ⚠️ O PROCESSO JÁ MORRIA DE VERDADE — O DEFEITO ERA OUTRO. O usuário excluía o
# terminal e a sessão continuava listada na barra lateral do produto como
# "ativa há N minutos". Um `taskkill /F` não dá ao assistente a chance de se
# apagar da própria lista: ele some do sistema operacional sem nunca saber que
# estava acabando, e o registro de sessão que ele deixou em disco fica.
#
# Então pede-se a saída primeiro: dois Ctrl+C (o costume dos CLIs de tela cheia
# é sair no segundo seguido — a mesma razão já registrada em
# `enviar_sinal_ao_shell`), e depois um `exit` para o `cmd.exe` que sobra. Se
# funcionar, o `taskkill` que vem depois devolve 128 — "não há esse processo" —,
# que o código já trata como sucesso.
#
# ⚠️ E A ESPERA TEM TETO, SEM EXCEÇÃO. `fechar` é chamado no caminho de FECHAR
# O PROGRAMA, e um assistente travado no meio de uma pergunta de permissão
# nunca vai responder ao Ctrl+C. Estourado o prazo, mata como sempre matou — o
# `/F` continua sendo a última linha, e é o que garante que nada fique vivo.
PRAZO_DE_GRACA = 2.0
INTERVALO_DE_ESPERA = 0.05

# ⚠️ AS DUAS PAUSAS SÃO DIFERENTES, E FORAM MEDIDAS — uma pausa só, igual para
# as duas, NÃO funciona. Medido nesta máquina, com um Claude Code de verdade
# rodando dentro de um `cmd.exe` num PTY:
#
#   · entre os dois Ctrl+C bastam ~0,15 s (o primeiro só arma o "Press Ctrl-C
#     again to exit"; o segundo é o que sai);
#   · entre o segundo Ctrl+C e o `exit`, 0,15 s é CEDO DEMAIS. O assistente
#     ainda está desmontando a tela, e o `exit` é digitado DENTRO DELE em vez
#     de chegar ao `cmd.exe`. O resultado media certo pela metade: a sessão se
#     desregistrava (que é o que importa), mas o `cmd.exe` ficava no prompt e a
#     espera gastava o prazo inteiro até o `taskkill` resolver.
#
#   pausa 0,15 s → `cmd.exe` NÃO morre sozinho
#   pausa 0,60 s → árvore inteira morre em 0,80 s
#   pausa 1,00 s → árvore inteira morre em 1,20 s
#
# 0,6 s com prazo de 2,0 s dá folga de mais que o dobro do medido.
PAUSA_ENTRE_OS_CTRL_C = 0.15
PAUSA_ANTES_DO_EXIT = 0.6


def tem_pseudoterminal():
    return PtyProcess is not None


def _esperar_morrer(shell, passos, prazo):
    """Manda os `passos` e espera até `prazo` segundos o processo sair sozinho.

    `passos` é uma lista de `(bytes, pausa depois)` — a pausa faz parte do
    passo porque ela NÃO é a mesma entre todos (ver as constantes acima, que
    foram medidas). Uma pausa única para a sequência inteira é o que fazia o
    `exit` cair dentro do assistente em vez de chegar ao `cmd.exe`.

    Uma função, e não um método em cada classe, porque a espera é idêntica nos
    dois — só a sequência muda, e ela vem por parâmetro. É o mesmo critério que
    fez os dois objetos terem a mesma interface.

    ⚠️ A PAUSA CONTA DENTRO DO PRAZO, e é assim que o teto continua sendo um
    teto: quem chama com prazo curto (o fechamento do programa reparte um
    orçamento) manda o que der e não fica preso nas pausas.

    ⚠️ `vivo()` PODE DEVOLVER `None`, que é "não sei" (ver o docstring dele). Na
    dúvida, continua-se esperando até o prazo — e o `/F` de quem chamou resolve
    de qualquer jeito. Tratar a dúvida como "morreu" aqui seria devolver `True`
    para um processo que talvez esteja vivo, e o preço disso já foi pago uma
    vez neste arquivo.
    """
    fim = time.monotonic() + max(0.0, prazo)
    for sinal, pausa in passos:
        try:
            shell.escrever(sinal)
        except Exception:
            # Cano já fechado é exatamente o caso em que não há o que pedir.
            return False
        # `min` com o que resta: sem ele, uma sequência de três passos gastaria
        # as pausas inteiras mesmo com o prazo já vencido.
        time.sleep(max(0.0, min(pausa, fim - time.monotonic())))
    while time.monotonic() < fim:
        try:
            if shell.vivo() is False:
                return True
        except Exception:
            return False
        time.sleep(INTERVALO_DE_ESPERA)
    return False


class _ShellDeCano:
    """O caminho de canos, vestido com a interface do PTY.

    Existe para a máquina sem `pywinpty`. Serve para comando de sistema e NÃO
    serve para o que exige TTY — e é a tela que avisa isso, não este objeto que
    finge.

    ⚠️ ELE PRECISA DE DISCIPLINA DE LINHA PRÓPRIA. O xterm.js manda tecla a
    tecla, e um cano não tem driver de terminal para juntar as teclas numa linha
    nem para ecoar o que foi digitado. Estes poucos ramos são esse driver: o
    mínimo para o usuário ver o que digita e o `cmd.exe` receber linhas
    inteiras.
    """

    def __init__(self, argv, cwd, env):
        self._proc = subprocess.Popen(
            argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, cwd=cwd, env=env, bufsize=0,
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        self.pid = self._proc.pid
        self._linha = bytearray()
        self._eco = bytearray()

    def ler(self, quanto=65536):
        # O eco que este objeto deve à tela sai na frente do que veio do filho.
        if self._eco:
            saiu, self._eco = bytes(self._eco), bytearray()
            return saiu
        return self._proc.stdout.read(1) or b''

    def escrever(self, dados):
        for b in dados:
            if b in (8, 127):                      # backspace
                if self._linha:
                    self._linha.pop()
                    self._eco += b'\b \b'
            elif b == 13:                          # Enter
                self._eco += b'\r\n'
                self._proc.stdin.write(bytes(self._linha) + b'\r\n')
                self._proc.stdin.flush()
                self._linha = bytearray()
            elif b >= 32:
                self._linha.append(b)
                self._eco += bytes([b])
        return len(dados)

    def redimensionar(self, colunas, linhas):
        pass                                       # um cano não tem tamanho

    def vivo(self):
        return self._proc.poll() is None

    def pedir_saida(self, prazo=PRAZO_DE_GRACA):
        """Pede `exit` e espera, com teto. Devolve `True` se ele saiu sozinho.

        Sem pseudoterminal não há assistente de tela cheia rodando aqui — só o
        `cmd.exe` —, então o Ctrl+C não tem a quem servir e a disciplina de
        linha deste objeto nem o repassaria. Um `exit` basta.
        """
        return _esperar_morrer(self, [(b'exit\r', 0.0)], prazo)

    def fechar(self, prazo_de_graca=PRAZO_DE_GRACA):
        if prazo_de_graca:
            self.pedir_saida(prazo_de_graca)
        try:
            subprocess.run(['taskkill', '/F', '/T', '/PID', str(self.pid)],
                           capture_output=True, timeout=10,
                           # ⚠️ Sem isto, cada terminal fechado PISCA uma janela
                           # de console preta na tela do usuário.
                           creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        except Exception:
            pass


class _ShellPty:
    """O `pywinpty`, vestido com a MESMA interface do irmão degradado.

    A tradução que ele faz é uma só, e vale registrar: o `PtyProcess` fala em
    `str` (ele traz o decodificador incremental de UTF-8 por dentro, que é o que
    resolve o pedaço cortado no meio de um caractere), e o resto do programa
    fala em BYTES, porque é isso que o xterm.js consome. A volta é sem perda.
    """

    def __init__(self, argv, cwd, env, colunas, linhas):
        # ⚠️ `dimensions` é (LINHAS, COLUNAS) — nesta ordem. Invertido, o
        # terminal nasce com 30 colunas e 120 linhas, e todo programa lá dentro
        # quebra a linha no lugar errado.
        self._p = PtyProcess.spawn(list(argv), cwd=cwd, env=env,
                                   dimensions=(int(linhas), int(colunas)))
        self.pid = getattr(self._p, 'pid', None)

    def ler(self, quanto=65536):
        try:
            texto = self._p.read(quanto)
        except EOFError:
            return b''
        if not texto:
            return b''
        return texto.encode('utf-8', errors='replace')

    def escrever(self, dados):
        self._p.write(dados.decode('utf-8', errors='replace'))
        return len(dados)

    def redimensionar(self, colunas, linhas):
        self._p.setwinsize(int(linhas), int(colunas))

    def vivo(self):
        """O processo ainda está de pé?

        ⚠️ ERRO NÃO É "MORREU", e a diferença custou processos órfãos. Esta
        função respondia `False` para QUALQUER exceção do `isalive()` — e a
        biblioteca levanta uma delas num soluço do socket interno. Quem lê a
        resposta é a thread leitora, que ao ver "morreu" SOLTA o processo do
        registro; e o registro é o único lugar do programa onde o PID existe.
        Um soluço bastava para o `cmd.exe` (e o assistente rodando dentro dele)
        virar órfão: o cartão apagava a luz, os botões sumiam, e nada mais no
        programa sabia como matá-lo.

        `None` é "não sei", e quem pergunta decide o que fazer com a dúvida.
        """
        try:
            return self._p.isalive()
        except Exception:
            return None

    def pedir_saida(self, prazo=PRAZO_DE_GRACA):
        """Pede a saída ao que estiver rodando e espera, com teto.

        Devolve `True` se o processo saiu sozinho — e nesse caso a sessão do
        produto se apagou da lista dele, que é a razão inteira de isto existir.
        """
        return _esperar_morrer(self, [
            (b'\x03', PAUSA_ENTRE_OS_CTRL_C),   # arma o "Press Ctrl-C again to exit"
            (b'\x03', PAUSA_ANTES_DO_EXIT),     # sai do assistente, que desmonta a tela
            (b'exit\r', 0.0),                   # agora sim o `cmd.exe` que sobrou
        ], prazo)

    def fechar(self, prazo_de_graca=PRAZO_DE_GRACA):
        """Pede a saída, e então mata a árvore E DERRUBA O CANAL.

        ⚠️ O PEDIDO VEM ANTES E O `/F` CONTINUA VINDO SEMPRE. Pedir é o que
        tira a sessão da lista do produto; matar é o que garante que nada fique
        vivo. As duas coisas, nesta ordem — e `prazo_de_graca=0` pula o pedido
        para quem já sabe que não há ninguém para atender.

        ⚠️ A ÁRVORE, e não só o filho: o produto roda DENTRO do `cmd.exe`, e
        matar só o pai o deixaria órfão segurando o pseudoconsole.

        ⚠️ MATAR O PROCESSO NÃO ACORDA QUEM ESTÁ LENDO. A leitora fica parada
        num `recv` do socket que o `pywinpty` mantém por dentro, e esse socket
        sobrevive à morte do `cmd.exe`: a thread ficava viva para sempre, uma
        por terminal fechado, e a tela nunca recebia o aviso de fim que ela
        emite ao sair. Os três passos abaixo foram MEDIDOS com quatro terminais
        fechados de uma vez: só `close()` soltava 3 de 4, e `cancel_io()` antes
        do `shutdown` é o que faz os 4. Cada um cobre uma camada diferente —
        a E/S pendente do pseudoconsole, a ponta do socket, e o objeto.
        """
        if prazo_de_graca:
            self.pedir_saida(prazo_de_graca)
        if self.pid:
            try:
                r = subprocess.run(['taskkill', '/F', '/T', '/PID', str(self.pid)],
                                   capture_output=True, timeout=10,
                                   # ⚠️ A MESMA MARCA QUE O IRMÃO DE CANO JÁ TINHA,
                                   # e que aqui faltava: sem ela, cada terminal
                                   # fechado PISCA uma janela de console preta na
                                   # tela do usuário.
                                   creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
                # ⚠️ O CÓDIGO DE SAÍDA É LIDO, e antes não era. Um `taskkill`
                # que falha — acesso negado, PID já reciclado, árvore
                # incompleta — era silêncio absoluto: nem log, nem aviso, e o
                # usuário descobria pelo gerenciador de tarefas. 128 é "não há
                # esse processo", que aqui é sucesso: já estava morto.
                if r.returncode not in (0, 128):
                    print('[terminal] taskkill do PID %s devolveu %s: %s'
                          % (self.pid, r.returncode,
                             (r.stderr or b'').decode('mbcs', 'replace').strip()))
            except Exception as e:
                print('[terminal] taskkill do PID %s não rodou: %s' % (self.pid, e))
        for passo in (lambda: self._p.pty.cancel_io(),
                      lambda: self._p.fileobj.shutdown(socket.SHUT_RDWR),
                      lambda: self._p.close(force=True),
                      lambda: self._p.terminate(force=True)):
            try:
                passo()
            except Exception:
                pass
