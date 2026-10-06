"""Mandar coisa para dentro do terminal: teclas, texto, imagem, sinal, tamanho.

Todas as cinco escrevem no processo vivo; nenhuma o cria e nenhuma o mata. É o
corte com `_abrir.py` e `_fechar.py`, e ele é o que mantém as três legíveis.

⚠️ `escrever_no_shell` RECEBE BYTES CRUS, em base64, exatamente como o xterm.js
os produziu. Não é excesso de zelo: sequência de escape, tecla morta e acento
compostos não sobrevivem a uma conversão para str no meio do caminho.

⚠️ `enviar_ao_shell` É OUTRA COISA — é texto que o PROGRAMA manda, não o dedo do
usuário. Os dois caminhos existem porque só um deles pode normalizar o que
passa.

⚠️ O REDIMENSIONAR CHEGA A CADA MOVIMENTO DA PEGA, e o tamanho vem em COLUNAS e
LINHAS medidas pela tela — nunca em pixel. O `addon-fit` do xterm mede por
`getBoundingClientRect()`, que já vem multiplicado pelo zoom do canvas da
Oficina; a conta certa é por `clientWidth`, e ela é feita do lado do JS.
"""

from .trabalhos_shell_constantes import *


class TrabalhosShellDigitarMixin:

    # ── Digitar ──────────────────────────────────────────────────────────────

    def escrever_no_shell(self, project_name, id_no, b64):
        """Bytes crus do teclado, exatamente como o xterm.js os produziu.

        ⚠️ ACENDER SOZINHO NÃO É ATALHO — é o que faz o nó parecer um terminal.
        Exigir um botão "abrir" antes da primeira tecla é um passo que nenhum
        terminal do mundo pede, e o sintoma seria digitar e nada acontecer.

        ⚠️ E É AQUI QUE O Ctrl+C MORA: ele chega como o byte 0x03, escrito no
        PTY como qualquer outro. O `taskkill` que fazia esse papel saiu — matar
        a árvore para interromper um comando é serra elétrica onde bastava a
        tecla que o terminal já tem.
        """
        try:
            dados = base64.b64decode(b64 or '')
            if not self._sh_vivo(project_name, id_no):
                if self._sh_em_luto(project_name, id_no):
                    # Fechado agora há pouco de propósito: o que chega aqui é a
                    # RESPOSTA do emulador à despedida do assistente, não uma
                    # tecla. Ver `_sh_em_luto`.
                    return {'success': True, 'rodando': False, 'em_luto': True}
                r = self.abrir_shell(project_name, id_no)
                if not r.get('success'):
                    return r
                # ⚠️ A TECLA QUE ACENDEU O TERMINAL NÃO É DIGITADA DENTRO DELE,
                # e isto conserta o "bugou" de reabrir o programa. O nó volta na
                # tela com o processo morto; a primeira tecla acende o
                # `cmd.exe` — e, se o nó tiver assistente, a linha de
                # lançamento é injetada logo depois. Escrever a tecla também
                # deixava-a NA FRENTE dessa linha: o usuário digitava `a` e o
                # shell recebia `aclaude --name ...`, que não existe. (Com
                # espaço funcionava, e foi assim que o usuário descobriu: um
                # espaço à frente o `cmd.exe` ignora.)
                #
                # Das três saídas possíveis — segurar a tecla até o processo
                # existir, ignorá-la, ou acender antes de aceitar teclado —,
                # esta é a única em que nada chega pela metade. Segurar exigiria
                # uma fila que competiria com a injeção do modo pela mesma
                # linha; a tecla perdida é um caractere, e o gesto de acender
                # já tem efeito visível na tela.
                return {'success': True, 'acendeu': True}
            proc = self._sh_procs_dict().get(self._sh_chave(project_name, id_no))
            if not proc:
                return {'success': False, 'error': 'Este terminal não está aberto.'}
            proc.escrever(dados)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def enviar_ao_shell(self, project_name, id_no, texto):
        """Uma linha digitada de uma vez. Quem chama é a injeção do modo.

        ⚠️ ENTER É `CR` SOZINHO. O comentário antigo dizia que `LF` sozinho
        travava o `cmd.exe`, e isso era verdade NUM CANO. Num PTY é o
        contrário: `CR` é o Enter, e `CR LF` são DOIS Enters — o segundo
        reexecuta o prompt, e o sintoma é o comando aparecer duplicado.
        """
        texto = '' if texto is None else str(texto)
        return self.escrever_no_shell(
            project_name, id_no,
            base64.b64encode((texto + '\r').encode('utf-8')).decode('ascii'))

    # As extensões de imagem que a colagem aceita. Fechada de propósito: o que
    # vem da área de transferência é `image/<algo>`, e `<algo>` pode ser
    # qualquer coisa que o navegador resolva inventar — virar nome de arquivo
    # sem passar por uma lista é deixar o tipo MIME escolher a extensão do que
    # se grava em disco.
    EXTENSOES_DE_ANEXO = {'png': 'png', 'jpeg': 'jpg', 'jpg': 'jpg',
                          'gif': 'gif', 'webp': 'webp', 'bmp': 'bmp'}

    def colar_imagem_no_shell(self, project_name, id_no, b64, tipo=''):
        """Grava o print colado em `Anexos/` e DIGITA o caminho no terminal.

        O defeito que isto conserta, nas palavras do usuário: *"isso aí me dá
        uma raiva, cara. Eu queria clicar ali e apertar Ctrl+V, um print que eu
        tirei"*. A causa era ausência, e não recusa — a única entrada do
        terminal é `onData`, que recebe TEXTO, e a imagem era descartada antes
        de chegar ao nosso código. (No terminal do Windows funciona porque lá o
        Ctrl+V é tratado pelo terminal de verdade.)

        ⚠️ DIGITA, E NÃO ENVIA. O caminho fica no prompt com um espaço no fim,
        esperando a pergunta do usuário — que é o gesto de sempre: colar o
        print e dizer o que fazer com ele. Mandar sozinho tiraria dele a chance
        de escrever a pergunta, e não há como recuperar um turno já enviado.

        ⚠️ E O CAMINHO SOZINHO BASTA — medido nesta máquina, com a CLI 2.1.258:
        colado só o caminho do `.png`, o assistente descreveu as cores da
        imagem. Ele abre o arquivo por conta própria; não é preciso inventar
        marcação nenhuma em volta.
        """
        try:
            if not self._sh_vivo(project_name, id_no):
                return {'success': False, 'error': 'Este terminal não está aberto.'}
            sufixo = (tipo or '').split('/')[-1].lower().strip()
            extensao = self.EXTENSOES_DE_ANEXO.get(sufixo)
            if not extensao:
                return {'success': False,
                        'error': 'Este tipo de imagem não é aceito na colagem (%s).'
                                 % (tipo or 'desconhecido')}
            caminho = self._mat_novo_anexo(project_name, extensao)
            if not caminho:
                return {'success': False,
                        'error': 'A pasta raiz do projeto não está configurada, '
                                 'então não há onde guardar o print.'}
            with open(caminho, 'wb') as f:
                f.write(base64.b64decode(b64))
            self.escrever_no_shell(
                project_name, id_no,
                base64.b64encode((caminho + ' ').encode('utf-8')).decode('ascii'))
            return {'success': True, 'caminho': caminho}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def enviar_sinal_ao_shell(self, project_name, id_no):
        """O Ctrl+C, para quem chega por botão em vez de tecla.

        ⚠️ NÃO PASSA POR `escrever_no_shell`, e a diferença é o defeito que ela
        consertou: aquele ABRE UM SHELL NOVO quando o atual não está vivo. Com
        um terminal que já saiu do registro, apertar ⏹ criava outro `cmd.exe` e
        escrevia o Ctrl+C dentro dele — para o usuário, "o botão não faz nada",
        e ainda sobrava mais um processo.

        ⚠️ SÃO DOIS `0x03`, e não um. Um assistente de tela cheia põe o terminal
        em modo cru: o byte chega para ELE, não para o console, e o costume dos
        CLIs é tratar o primeiro como "limpe a linha" e só sair no segundo
        seguido. Um Ctrl+C só, que era o que este botão mandava, quase nunca
        interrompe o que o usuário quer interromper.
        """
        try:
            proc = self._sh_procs_dict().get(self._sh_chave(project_name, id_no))
            if not proc:
                return {'success': False, 'error': 'Este terminal não está aberto.'}
            proc.escrever(b'\x03')
            time.sleep(0.12)
            proc.escrever(b'\x03')
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def redimensionar_shell(self, project_name, id_no, colunas, linhas):
        """O tamanho em CÉLULAS, medido pela tela.

        ⚠️ GRAVA MESMO COM O TERMINAL FECHADO. É o tamanho com que ele vai
        nascer da próxima vez — senão um nó que o usuário deixou largo abriria
        estreito e reformataria tudo no primeiro instante.
        """
        try:
            dado = self._sh_dado(project_name, id_no)
            dado['colunas'] = max(2, int(colunas))
            dado['linhas'] = max(1, int(linhas))
            proc = self._sh_procs_dict().get(self._sh_chave(project_name, id_no))
            if proc:
                proc.redimensionar(dado['colunas'], dado['linhas'])
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}
