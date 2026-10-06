"""Acender o terminal de um nó, e a thread que lê a saída dele.

⚠️ IDEMPOTENTE: chamar com um terminal já vivo não faz nada. A tela pede
`abrir_shell` em situações que se sobrepõem (voltar para a sub-aba, clicar no
nó, restaurar o arranjo), e cada uma abrindo um processo novo deixaria sessões
órfãs consumindo o assistente externo em segundo plano.

⚠️ A LEITURA É POR THREAD, E AGRUPADA. Cada byte atravessando a ponte sozinho
faria `evaluate_js` — que é SÍNCRONO — parar a thread leitora a cada tecla. Os
bytes se acumulam por `INTERVALO_DE_AGRUPAMENTO` ou até `TETO_DO_LOTE`, e só
então viajam.

⚠️ A INJEÇÃO DA LINHA ESPERA O TERMINAL FICAR PRONTO
(`_sh_injetar_quando_pronto`). Digitar antes de o shell ter desenhado o prompt
manda as teclas para o vazio — e o sintoma é um terminal aberto, vivo, e sem o
assistente rodando, sem erro nenhum.
"""

from .trabalhos_shell_constantes import *


class TrabalhosShellAbrirMixin:

    # ── Abrir ────────────────────────────────────────────────────────────────

    def abrir_shell(self, project_name, id_no, colunas=None, linhas=None):
        """Acende o terminal deste nó. Idempotente: com um já vivo, não faz nada.

        ⚠️ A PASTA É A DO PROJETO, e é a mesma que as ferramentas de leitura
        usam (`_sub_root_folder`). Um terminal aberto na pasta do programa
        deixaria o usuário mexendo no lugar errado sem perceber — e dois lugares
        decidindo qual é a pasta é como se abre uma exceção sem querer.
        """
        try:
            if self._sh_vivo(project_name, id_no):
                return {'success': True, 'rodando': True, 'ja_estava': True}

            # Abrir de propósito é o fim do luto: quem pediu foi a tela, e a
            # partir daqui uma tecla volta a poder reacender o terminal.
            self._sh_luto_dict().pop(self._sh_chave(project_name, id_no), None)
            dado = self._sh_dado(project_name, id_no)
            if colunas:
                dado['colunas'] = max(2, int(colunas))
            if linhas:
                dado['linhas'] = max(1, int(linhas))

            cwd = self._sub_root_folder(project_name)
            proc, tem_pty = self._sh_abrir_processo(cwd, dado['colunas'], dado['linhas'])
            self._sh_procs_dict()[self._sh_chave(project_name, id_no)] = proc
            dado['cwd'] = cwd
            dado['pty'] = tem_pty
            # Um terminal reaberto começa com a tela limpa: o que ficou da
            # sessão anterior é de um processo que já morreu, e deixá-lo em cima
            # do prompt novo faria parecer que ele continuou de onde parou.
            dado['bytes'] = bytearray()

            # ⚠️ QUEM LÊ E QUEM DESPEJA SÃO DUAS THREADS, E ISSO NÃO É LUXO —
            # é a correção de um defeito que fazia o terminal parecer morto.
            #
            # `proc.ler()` BLOQUEIA esperando o próximo byte. Com o agrupamento
            # decidido dentro do mesmo laço, o ÚLTIMO pedaço de uma rajada — que
            # é justamente a linha do prompt — caía dentro da janela de
            # 50 ms, não era despejado, e a thread voltava a bloquear segurando
            # ele. O prompt só aparecia quando o usuário digitava alguma coisa e
            # o shell falava de novo, empurrando o anterior. Daí os sintomas:
            # terminal que abre em branco, Enter que precisa de dois toques,
            # linha cortada no meio com o resto reposicionado por cima.
            #
            # O relógio agora é de quem NÃO bloqueia: a leitora só empilha, e a
            # esvaziadora acorda a cada `INTERVALO_DE_AGRUPAMENTO` e manda o que
            # houver. Nada pode ficar retido por mais que esse intervalo.
            lote = bytearray()
            trava_do_lote = threading.Lock()
            lendo = [True]

            def despejar():
                with trava_do_lote:
                    if not lote:
                        return
                    pedaco = bytes(lote)
                    lote.clear()
                dado['ultimo_byte'] = time.time()
                dado['bytes'] = self._sh_aparar(dado['bytes'] + pedaco)
                self._sh_notify(project_name, id_no, {
                    'status': 'dados',
                    'b64': base64.b64encode(pedaco).decode('ascii')})

            def esvaziar():
                chave = self._sh_chave(project_name, id_no)
                # ⚠️ DUAS CONDIÇÕES DE PARADA, e a segunda é a que importa. A
                # primeira (`lendo`) só cai quando a leitora TERMINA — e a
                # leitora fica bloqueada em `recv`, que pode nunca voltar num
                # terminal morto à força. A segunda pergunta ao registro se este
                # terminal ainda é o terminal deste nó: `fechar_shell` tira ele
                # de lá na hora. Sem isso, cada terminal fechado deixava uma
                # thread acordando de 50 em 50 ms para sempre.
                while lendo[0] and self._sh_procs_dict().get(chave) is proc:
                    time.sleep(INTERVALO_DE_AGRUPAMENTO)
                    try:
                        despejar()
                    except Exception:
                        pass

            def bombear():
                try:
                    while True:
                        pedaco = proc.ler()
                        if not pedaco:
                            # ⚠️ VAZIO NÃO QUER DIZER ACABOU. A leitura pode
                            # voltar sem nada e o shell continuar vivo; tratar
                            # isso como fim tirava o processo do registro, e daí
                            # CADA TECLA seguinte reabria um terminal novo — que
                            # foi o sintoma "toda vez que dou Enter ele abre de
                            # novo". Só a morte do processo encerra a leitora.
                            # `is not False`: `None` é "não sei", e na dúvida a
                            # leitura continua. Encerrar por dúvida era o que
                            # tirava do registro um processo que estava vivo.
                            if proc.vivo() is not False:
                                time.sleep(0.01)
                                continue
                            break
                        with trava_do_lote:
                            # ⚠️ `extend`, e NÃO `lote += pedaco`: o `+=` num nome
                            # do escopo de fora faz o Python tratar `lote` como
                            # variável local desta função, e a leitora morre de
                            # `UnboundLocalError` no primeiro byte — em silêncio,
                            # porque o `except` logo abaixo engole.
                            lote.extend(pedaco)
                            cheio = len(lote) >= TETO_DO_LOTE
                        # A rajada grande não espera o relógio: segurar 64 kB por
                        # 50 ms é o que faz um `dir` grande sair aos solavancos.
                        if cheio:
                            despejar()
                except Exception:
                    pass
                lendo[0] = False
                despejar()
                # ⚠️ SÓ SOLTA O PROCESSO SE ELE MORREU MESMO. Este `pop` é a
                # ÚNICA porta por onde o PID sai do programa, e ele saía por
                # qualquer motivo que fizesse o laço acima terminar — inclusive
                # uma exceção do socket interno da biblioteca. O `cmd.exe`
                # continuava vivo com o assistente dentro, e ninguém mais tinha
                # como matá-lo: nem o ✕, nem o ⏹, nem o "Parar tudo".
                #
                # `vivo()` devolve `None` quando não sabe responder — e na
                # dúvida o processo FICA registrado. Um registro a mais custa um
                # `taskkill` inútil no fechamento; um a menos custa um processo
                # pago rodando para sempre.
                if proc.vivo() is False:
                    self._sh_procs_dict().pop(self._sh_chave(project_name, id_no), None)
                self._sh_notify(project_name, id_no, {'status': 'fim'})

            threading.Thread(target=bombear, daemon=True).start()
            threading.Thread(target=esvaziar, daemon=True).start()
            self._sh_notify(project_name, id_no, {'status': 'aberto', 'pty': tem_pty})

            if not tem_pty:
                self._sh_escrever_aviso(
                    project_name, id_no,
                    'modo degradado: sem pseudoterminal (pywinpty não instalado). '
                    'Comando de sistema funciona; o que exige terminal de verdade, não.')

            # ⚠️ O MODO ENTRA DEPOIS DE A LEITORA EXISTIR **E DE O SHELL SE
            # AQUIETAR** — as duas coisas, e a segunda foi aprendida no teste.
            #
            # A primeira é óbvia: escrever antes da leitora faria a resposta do
            # produto chegar antes de haver quem a lesse.
            #
            # A segunda não é: um `cmd.exe` com AutoRun (o `conda_hook.bat` desta
            # máquina, por exemplo) leva segundos até o primeiro prompt, e o que
            # for escrito nesse meio-tempo **é engolido**. O sintoma seria o pior
            # possível: um nó marcado "Orquestrador" que abriu como um `cmd.exe`
            # pelado, sem erro nenhum, porque a linha do `claude` sumiu no
            # caminho. Por isso a injeção espera o silêncio.
            # ⚠️ O MATERIAL VEM ANTES DA LINHA DE LANÇAMENTO, e a ordem é a
            # obra inteira. A linha aponta o agente para `Trabalhos/` na raiz
            # do projeto; se a pasta ainda não existisse, ele nasceria olhando
            # para o nada. E o `Equipe.md` só fica certo AQUI, depois de este
            # processo já estar em `_sh_procs` — regerado antes, ele listaria
            # todo mundo menos o terminal que está abrindo.
            self._mat_limpar_anexos_velhos(project_name)
            self._mat_regerar_tudo(project_name)

            no = self._trab_achar_no(self._trab_andar(
                self._trab_carregar_layout(project_name)), id_no)
            if no is not None:
                linha, aviso = self._sh_comando_do_modo(project_name, no)
                if aviso:
                    self._sh_escrever_aviso(project_name, id_no, aviso)
                if linha:
                    threading.Thread(
                        target=self._sh_injetar_quando_pronto,
                        args=(project_name, id_no, linha), daemon=True).start()

            return {'success': True, 'rodando': True, 'ja_estava': False,
                    'cwd': cwd, 'pty': tem_pty,
                    'colunas': dado['colunas'], 'linhas': dado['linhas']}
        except FileNotFoundError:
            return {'success': False,
                    'error': 'Não encontrei o shell do sistema (%s).' % SHELL_PADRAO[0]}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # Quanto tempo sem um byte conta como "o shell terminou de acordar", e
    # quanto se espera no máximo antes de mandar assim mesmo.
    SILENCIO_ANTES_DE_INJETAR = 0.5
    ESPERA_MAXIMA_PARA_INJETAR = 25.0

    def _sh_injetar_quando_pronto(self, project_name, id_no, linha):
        """Digita a linha do modo assim que o shell parar de falar.

        ⚠️ ESPERAR O SILÊNCIO, e não um prompt específico. Procurar `>` no texto
        parece mais preciso e é pior: o prompt depende do `prompt $P$G`, que o
        usuário pode ter trocado, e um AutoRun que imprime um `>` no meio do
        caminho enganaria a busca. "Parou de escrever" vale para qualquer shell.

        ⚠️ O TETO NÃO É DESISTÊNCIA — passado ele, a linha vai assim mesmo. Um
        shell que fala sem parar (um AutoRun tagarela) não pode impedir o modo
        de entrar para sempre; melhor arriscar a linha do que nunca mandá-la.
        """
        dado = self._sh_dado(project_name, id_no)
        limite = time.time() + self.ESPERA_MAXIMA_PARA_INJETAR
        while time.time() < limite:
            if not self._sh_vivo(project_name, id_no):
                return                       # morreu antes de acordar
            quieto = time.time() - (dado.get('ultimo_byte') or 0)
            if dado.get('ultimo_byte') and quieto >= self.SILENCIO_ANTES_DE_INJETAR:
                break
            time.sleep(0.1)
        self.enviar_ao_shell(project_name, id_no, linha)

    def _sh_escrever_aviso(self, project_name, id_no, texto):
        """Um recado NOSSO dentro do terminal, em âmbar.

        Vai pelo mesmo caminho da saída do processo de propósito: é ali que o
        usuário está olhando. Um toast no canto da tela, para um terminal
        específico entre vários, não diria de QUAL deles se fala.
        """
        pedaco = ('\r\n\x1b[33m[' + texto + ']\x1b[0m\r\n').encode('utf-8')
        dado = self._sh_dado(project_name, id_no)
        dado['bytes'] = self._sh_aparar(dado['bytes'] + pedaco)
        self._sh_notify(project_name, id_no, {
            'status': 'dados', 'b64': base64.b64encode(pedaco).decode('ascii')})
