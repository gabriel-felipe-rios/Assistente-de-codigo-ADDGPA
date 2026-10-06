"""Fechar um terminal, os de um projeto, ou todos — sempre com graça primeiro.

⚠️ MATAR DIRETO DEIXA SESSÃO ÓRFÃ. O assistente externo que roda dentro do
terminal precisa de um instante para encerrar a sessão dele; morto no meio, ele
deixa estado pendurado do lado de fora do programa. Por isso todo fechamento
pede saída com graça antes de matar a árvore, e por isso existe
`ORCAMENTO_DE_GRACA_AO_FECHAR` — um orçamento do programa INTEIRO, repartido
entre os terminais que restam.

⚠️ `regerar_equipe` É PARÂMETRO, E NÃO PODE VIRAR AUTOMÁTICO. O `Equipe.md` é
regerado por abrir e fechar terminal, e SÓ pelo processo do programa: o registro
de terminais vivos é de memória, e do processo do servidor MCP ele responde
"ninguém" para todo mundo. Ao fechar todos de uma vez, regerar uma vez por
terminal reescreveria o arquivo N vezes — daí o parâmetro.

⚠️ O QUE SE GUARDA É APARADO E LIMPO ANTES DE VOLTAR À TELA. `_sh_sem_perguntas`
tira o que era pergunta interativa e `_sh_replayavel` tira as sequências de
posicionamento de cursor: reidratar a tela com elas faria o xterm redesenhar o
histórico por cima de si mesmo.
"""

from .trabalhos_shell_constantes import *


class TrabalhosShellFecharMixin:

    # ── Fechar ───────────────────────────────────────────────────────────────

    def fechar_shell(self, project_name, id_no, regerar_equipe=True,
                     prazo_de_graca=PRAZO_DE_GRACA):
        """Mata a árvore. Seguro de chamar com nada aberto.

        ⚠️ `regerar_equipe=False` NÃO É "não precisa", é "não AGORA". Quem
        fecha em lote passa `False` e regera UMA vez no fim: com quatro
        terminais, o contrário são quatro escritas do mesmo arquivo, e as três
        primeiras descrevem um estado intermediário que nunca existiu para o
        usuário.

        `prazo_de_graca` é quanto se espera o assistente sair sozinho antes do
        `taskkill /F` — é isso que tira a sessão da lista do produto. Zero pula
        a espera e mata direto; ver `trabalhos_shell_processo.PRAZO_DE_GRACA`.
        """
        try:
            proc = self._sh_procs_dict().pop(self._sh_chave(project_name, id_no), None)
            if not proc:
                return {'success': True, 'rodando': False}
            # ⚠️ O LUTO É MARCADO ANTES DE MATAR, e não depois: a despedida do
            # assistente (e as PERGUNTAS que ela emite) já está a caminho da
            # tela enquanto `fechar` espera. Marcar depois deixaria a janela
            # aberta exatamente no instante em que a resposta chega.
            self._sh_luto_dict()[self._sh_chave(project_name, id_no)] = time.monotonic()
            proc.fechar(prazo_de_graca=prazo_de_graca)
            # ⚠️ QUEM FECHA AVISA. O aviso de fim também sai da leitora quando
            # ela termina, mas depender SÓ dela é depender de uma thread que
            # está bloqueada num `recv` — e o usuário que apertou "fechar"
            # precisa da luz apagando AGORA, não quando o sistema operacional
            # resolver soltar o socket. Avisar duas vezes não custa nada: a
            # tela só recarrega o estado.
            self._sh_notify(project_name, id_no, {'status': 'fim'})
            # ⚠️ FECHAR CONTA TANTO QUANTO ABRIR. Um terminal que fechou e
            # continua listado no `Equipe.md` é pior que não listar nada: o
            # vizinho manda mensagem para uma sessão que não existe mais e fica
            # esperando resposta de ninguém. Por isso os DOIS eventos regeram.
            if regerar_equipe:
                self._mat_regerar_equipe(project_name)
            return {'success': True, 'rodando': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def fechar_todos_os_shells(self):
        """Mata TODO terminal aberto, de todo projeto. Devolve quantos.

        ⚠️ CHAMADO AO FECHAR O PROGRAMA, e a falta disto era o pior vazamento
        que a Oficina tinha. No Windows, filho não morre com o pai: fechar a
        janela deixava cada `cmd.exe` — e cada assistente externo rodando dentro
        dele — vivo indefinidamente, consumindo cota paga. Reabrir o programa
        não ajudava: o registro de processos é de MEMÓRIA (ver o ⚠️ do topo),
        então o PID já tinha ido embora junto com a janela.
        """
        # ⚠️ ORÇAMENTO GLOBAL, E NÃO O PRAZO POR TERMINAL SOMADO. Cada terminal
        # pede a saída com graça antes do `/F` — é o que apaga a sessão da
        # lista do produto —, mas dez terminais × 1,5 s seriam quinze segundos
        # entre o usuário e a janela fechando. Aqui o prazo é repartido: o que
        # sobra do orçamento é dividido pelos que faltam, e quando ele acaba os
        # restantes vão direto para o `taskkill`, exatamente como antes desta
        # obra existir.
        #
        # ⚠️ UM TERMINAL TRAVADO NÃO PODE SEGURAR O FECHAMENTO DO PROGRAMA —
        # ver o aviso do docstring acima, que continua valendo inteiro. Este
        # orçamento é o que garante isso, e é por isso que ele é global.
        orcamento = ORCAMENTO_DE_GRACA_AO_FECHAR
        mortos = 0
        tocados = set()
        pendentes = list(self._sh_procs_dict().keys())
        for i, (proj, id_no) in enumerate(pendentes):
            try:
                tocados.add(proj)
                faltam = len(pendentes) - i
                prazo = max(0.0, orcamento) / faltam
                comecou = time.monotonic()
                if self.fechar_shell(proj, id_no, regerar_equipe=False,
                                     prazo_de_graca=prazo).get('rodando'):
                    mortos += 1
                orcamento -= (time.monotonic() - comecou)
            except Exception:
                pass
        # ⚠️ UMA ESCRITA POR PROJETO, DEPOIS DE TUDO MORTO — e isto roda no
        # caminho de FECHAR O PROGRAMA. Regerar por terminal poria N escritas
        # de disco entre o usuário e a janela fechando, justamente quando cada
        # milissegundo é visível. Deixar sem regerar seria pior: o arquivo
        # ficaria em disco jurando que há terminais abertos num programa que já
        # não está de pé.
        for proj in tocados:
            try:
                self._mat_regerar_equipe(proj)
            except Exception:
                pass
        return mortos

    def fechar_shells_do_projeto(self, project_name):
        """Chamado pelo "Fechar tudo" da Oficina — um botão que promete fechar
        tudo e deixasse terminais vivos estaria mentindo."""
        fechados = []
        for (proj, id_no) in list(self._sh_procs_dict().keys()):
            if proj != project_name:
                continue
            if self.fechar_shell(project_name, id_no, regerar_equipe=False).get('rodando'):
                fechados.append(id_no)
        self._mat_regerar_equipe(project_name)
        return fechados

    # ⚠️ O REPLAY NÃO PODE CONTER PERGUNTA. Estas sequências são CONSULTAS que
    # o terminal do outro lado é obrigado a RESPONDER: `ESC[c` (quem é você),
    # `ESC[6n` (onde está o cursor), `ESC[>c`, `ESC[...t`, e as consultas de cor
    # em OSC. Na abertura elas são legítimas: quem pergunta é o conhost, e é ele
    # quem consome a resposta. Guardadas no buffer e REEXECUTADAS na
    # reidratação, viram outra coisa — ninguém mais espera a resposta, e ela
    # desce até o `cmd.exe` como se fosse tecla, aparecendo na tela como
    # `^[[?1;2c`. E como digitar num terminal morto o reabre, o terminal novo
    # pergunta de novo: o laço não fecha sozinho.
    #
    # A tela tem um porteiro para isso (`reidratando`, em `trabalhos-shell.js`),
    # e este corte é a segunda tranca: ele tira a pergunta da FONTE, e assim
    # vale mesmo que o porteiro falhe ou que outra tela leia isto um dia.
    # Cortar aqui não perde desenho nenhum — pergunta não pinta pixel.
    _SH_PERGUNTAS = re.compile(
        # `ESC [ <?|>> <números> <c|n|t>` — DA, DSR e window ops.
        rb'\x1b\[[?>]?[0-9;]*[cnt]'
        # `ESC ] <números> ; ? <BEL|ST>` — consulta de cor em OSC.
        rb'|\x1b\][0-9;]*;\?(?:\x07|\x1b\\)')

    def _sh_sem_perguntas(self, dados):
        return self._SH_PERGUNTAS.sub(b'', dados)

    # ⚠️ O POSICIONAMENTO ABSOLUTO SÓ VALE NA LARGURA EM QUE FOI ESCRITO, e por
    # isso ele sai do REPLAY — nunca do fluxo ao vivo, onde é justamente o que
    # faz a tela funcionar.
    #
    # Medido com o ConPTY de verdade: ao despejar a tela ele escreve `ESC[6;21H`
    # para pular o prompt e pôr o comando no lugar certo, e calcula essa linha e
    # essa coluna com a largura DAQUELE instante. Reproduzir isso num terminal
    # de outra largura escreve pedaço de uma linha por cima de outra — era o
    # "redimensionei e embaralhou tudo", com trechos de dois caminhos
    # diferentes na mesma linha.
    #
    # Medido também: o ConPTY NÃO repinta a tela quando o tamanho muda. Ele
    # despeja uma vez, no primeiro resize depois de abrir, e nunca mais. Não há
    # como esperar que ele conserte o desenho sozinho — quem reconstrói é este
    # lado, e é para isso que o replay existe.
    #
    # Sem essas sequências o mesmo despejo vira texto corrido com quebras de
    # linha, e o xterm o acomoda na largura de agora. É o que o docstring de
    # `carregar_shell` sempre disse: reidratar é RECONSTRUÇÃO, e reconstrução
    # não herda a geometria da foto antiga.
    #
    # H/f (linha e coluna), G (coluna), d (linha) e A/B (sobe/desce) amarram o
    # texto a uma grade que já não existe. C e D andam na linha atual e ficam:
    # são do editor de linha, e não da geometria da tela.
    _SH_POSICOES = re.compile(rb'\x1b\[[0-9;]*[HfGdAB]')

    def _sh_replayavel(self, dados):
        return self._SH_POSICOES.sub(b'', self._sh_sem_perguntas(dados))
