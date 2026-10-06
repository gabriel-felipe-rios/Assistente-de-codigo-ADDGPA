"""Encerrar, sair e excluir: quando o programa PERGUNTA antes.

Arquivo próprio porque a pergunta é sempre a mesma — *vale a pena interromper o
usuário aqui?* — e a resposta é uma tabela de quatro chaves com quatro telas.
Espalhada, ela vira quatro respostas diferentes para a mesma coisa.

Os quatro leitores (`_confirmar_ao_fechar`, `_confirmar_ao_sair_do_projeto`,
`_confirmar_ao_fechar_o_projeto`, `_confirmar_ao_deletar`) são um lugar só para
ler cada chave, com o padrão de fábrica de reserva. Não são quatro variações:
são quatro PERGUNTAS diferentes que o usuário respondeu uma vez cada.

⚠️ FECHAR UMA ABA DE PROJETO NÃO É SAIR DO PROJETO, e nunca foi. Com vários
projetos abertos, fechar uma aba deixa os outros rodando — o que precisa parar é
só o que era daquele projeto. É `parada_do_projeto.py` que sabe disso, e é por
isso que `fechar_projeto` e `executar_fechar_projeto` são dois: o primeiro
pergunta, o segundo faz.

⚠️ `_decidir_pergunta` DEVOLVE A DECISÃO, e não a executa. Quem decide se
pergunta é este módulo; quem mostra o diálogo é a tela. Juntar os dois faria o
backend precisar saber desenhar modal.
"""

from .constantes import *


class ConfigsEncerrarMixin:

    # ── Encerrar e excluir: os quatro leitores ─────────────────────────────
    # Um lugar só para ler cada chave, com o padrão de fábrica de reserva —
    # mesmo molde de `_formato_garantido_ligado`. Sem isto, cada consumidor
    # repetiria o `.get(chave, PADRAO)` e o padrão passaria a ter duas versões.

    def _quando_perguntar(self, chave, padrao):
        """Lê uma das chaves de três valores ('nunca'/'rodando'/'sempre').

        As três — fechar o programa, sair do projeto e fechar a aba de um
        projeto — têm a MESMA lista de valores e a mesma regra de reserva,
        então têm um leitor só. Valor estranho no arquivo cai no padrão em vez
        de virar erro: um `settings.json` editado à mão não pode impedir o
        programa de fechar nem de navegar.
        """
        try:
            valor = self.load_settings()['settings'].get(chave, padrao)
        except Exception:
            return padrao
        return valor if valor in QUANDO_PERGUNTAR_VALIDOS else padrao

    def _confirmar_ao_fechar(self):
        """QUANDO perguntar antes de encerrar: 'nunca', 'rodando' ou 'sempre'."""
        return self._quando_perguntar('confirmar_ao_fechar',
                                      CONFIRMAR_AO_FECHAR_PADRAO)

    def _confirmar_ao_sair_do_projeto(self):
        """QUANDO perguntar antes de sair do projeto (o "← Projetos")."""
        return self._quando_perguntar('confirmar_ao_sair_do_projeto',
                                      CONFIRMAR_AO_SAIR_DO_PROJETO_PADRAO)

    def _confirmar_ao_fechar_o_projeto(self):
        """QUANDO perguntar antes de fechar a aba de um projeto (o × da tira).

        ⚠️ NÃO é a mesma pergunta de `_confirmar_ao_sair_do_projeto`, e a
        diferença não é de grau: "← Projetos" só esconde a tela e nunca
        interrompe nada; fechar a aba para a vigilância daquele projeto e corta
        o que ele estiver usando da IA. Duas chaves separadas porque são duas
        decisões — há quem queira ser avisado no forte e não no fraco.
        """
        return self._quando_perguntar('confirmar_ao_fechar_o_projeto',
                                      CONFIRMAR_AO_FECHAR_O_PROJETO_PADRAO)

    def _confirmar_ao_deletar(self):
        """Perguntar antes de remover um chat ou uma tarefa da Fila?

        ⚠️ A chave diz `deletar` e a tela diz "remover" — ver o comentário no
        `padroes_de_fabrica.py`. Não é inconsistência, é a convenção do projeto.
        """
        try:
            return bool(self.load_settings()['settings'].get(
                'confirmar_ao_deletar', CONFIRMAR_AO_DELETAR_PADRAO))
        except Exception:
            return CONFIRMAR_AO_DELETAR_PADRAO

    # ── Abandonar o que está rodando: as duas perguntas ──────────────────
    # Quem pergunta antes de FECHAR é o `.pyw`, no handler de
    # `window.events.closing`; quem pergunta antes de SAIR DO PROJETO é o
    # `goBackToProjects` (navegacao.js). Os dois gestos abandonam trabalho de
    # IA em curso, e por isso dividem a mesma forma de resposta e a mesma
    # categoria de Configurações — mas ⚠️ só o primeiro MATA o trabalho.

    def deve_confirmar_encerramento(self):
        """Perguntar antes de fechar? E, se sim, dizendo o quê está rodando.

        `motivo` sai de `TRAVA_IA.estado()` — a frase já existe pronta lá ("a
        Fila está pesquisando", "as Rotinas estão atualizando a documentação"),
        e é ela que faz a pergunta valer a pena: um "tem certeza?" seco não
        ajuda ninguém a decidir.

        ⚠️ Nunca levanta. Ela roda no caminho de FECHAR a janela, e uma exceção
        aqui deixaria o programa impossível de encerrar por causa de um
        `settings.json` torto.
        """
        return self._decidir_pergunta(self._confirmar_ao_fechar())

    def deve_confirmar_saida_do_projeto(self):
        """Perguntar antes de sair do projeto? Mesma forma da de cima.

        ⚠️ E MESMA forma de propósito — o usuário pediu "o mesmo botão", e as
        duas telas leem `{'perguntar', 'motivo'}` pelo mesmo caminho.

        ⚠️ O que este aviso faz é SÓ avisar. Sair do projeto não interrompe
        nada: a tarefa da Fila continua rodando em segundo plano, e voltar ao
        projeto a reencontra no meio. Ele existe porque a tela do projeto é o
        único lugar onde dá para acompanhar a pesquisa — sair sem querer é
        perder o acompanhamento, não o trabalho. ⛔ Não transformar isto num
        impedimento: o "Não" só fica onde está.
        """
        return self._decidir_pergunta(self._confirmar_ao_sair_do_projeto())

    # ── Fechar uma ABA de projeto (múltiplos projetos abertos) ───────────
    # Diferente das duas de cima — que só avisam, e nunca impedem nem
    # interrompem — fechar uma aba é o gesto forte que o usuário pediu: se
    # confirmado, o projeto para de vigiar arquivos e libera a IA para as
    # outras abas abertas. Por isso vive separado de `_decidir_pergunta`, que
    # é sempre "avisar, nunca agir".

    def fechar_projeto(self, project_name):
        """Precisa perguntar antes de fechar ESTA aba? E, se sim, por quê.

        Só pergunta quando ESTE projeto especificamente está ocupado — dono da
        TRAVA_IA ou com alguma rotina em `get_processando` —, nunca por causa
        de outro projeto aberto que esteja usando a IA. Fechar uma aba ociosa
        nunca deveria perguntar só porque outra aba está ocupada.

        QUANDO perguntar sai de "Perguntar antes de fechar o projeto"
        (Configurações › Encerrar e excluir): `nunca` não pergunta, `sempre`
        pergunta mesmo com a aba parada, e `rodando` — o padrão — é o
        comportamento de sempre, só com este projeto ocupado.

        ⚠️ **Não passa por `_decidir_pergunta`, de propósito.** Aquele lê a
        TRAVA_IA inteira, sem olhar de quem é o trabalho — aqui isso faria
        fechar uma aba ociosa perguntar por causa da aba do lado.

        ⚠️ Nunca levanta — mesma regra de `deve_confirmar_encerramento`.
        """
        try:
            quando = self._confirmar_ao_fechar_o_projeto()
            if quando == QUANDO_PERGUNTAR_NUNCA:
                return {'success': True, 'perguntar': False, 'motivo': ''}
            from .agentes.trava_ia import TRAVA_IA
            estado = TRAVA_IA.estado()
            motivo = ''
            if estado and estado.get('projeto') == project_name:
                motivo = estado.get('motivo') or ''
            if not motivo:
                processando = self.get_processando(project_name)
                if processando.get('success') and processando.get('processando'):
                    motivo = 'uma rotina está processando arquivos deste projeto'
            # ⚠️ O PONTO CEGO: um ciclo DESTE projeto esperando a vez na fila.
            # Ele não é dono da TRAVA_IA (quem é dono é o projeto da frente) e
            # ainda não tem rotina rodando, então as duas checagens acima o
            # deixam passar — e fechar a aba sem perguntar descartaria um ciclo
            # que o usuário pediu. Era raro antes da fila entre projetos; com
            # ela, virou o caso comum.
            if not motivo and project_name in getattr(self, '_ac_partidas', ()):
                motivo = 'um ciclo deste projeto está na fila, esperando a vez'
            # Com 'sempre', `motivo` vazio é informação e não falta dela: a tela
            # troca a frase por "Nada está rodando agora" em vez de inventar um
            # motivo que não existe (ver `confirmarFecharAbaDeProjeto`).
            perguntar = bool(motivo) or quando == QUANDO_PERGUNTAR_SEMPRE
            return {'success': True, 'perguntar': perguntar, 'motivo': motivo}
        except Exception:
            return {'success': True, 'perguntar': False, 'motivo': ''}

    def executar_fechar_projeto(self, project_name):
        """O "Fechar" confirmado (ou direto, quando não havia nada rodando).

        Para a vigilância do Detector deste projeto (`_ac_parar_espera` — a
        mesma rotina do "Desativar tudo"), pede corte imediato ao Chat e
        **manda o projeto parar de pedir coisas ao LM Studio**.

        ⚠️ ESTA ÚLTIMA PARTE É NOVA, e ela conserta uma promessa quebrada: o
        modal de fechar já dizia "Fechar interrompe isso"
        (`frontend/modulos/encerramento.js`), e o motor deixava o ciclo rodar
        até o fim — segurando a `TRAVA_IA`, que é global, com o projeto
        seguinte da fila esperando por um trabalho que ninguém mais queria.

        ⛔ Continua NÃO matando thread nenhuma, e não é omissão: thread de
        Python não tem cancelamento de fora, e o "encerrar o programa" só
        parece que interrompe — ele faz `os._exit(0)` e mata o processo
        inteiro. O que existe é parada COOPERATIVA: cada laço pergunta
        `projeto_parado(...)` na próxima fronteira segura e desiste ali. Ver
        `agentes/parada_do_projeto.py`.

        ⛔ O **Backup** fica de fora de propósito: ele não faz uma única
        requisição ao LM Studio — copia arquivo. Cortá-lo no meio deixaria uma
        Versão pela metade sem nada dizendo que ela está incompleta, que é
        justamente o risco que ela existe para evitar. Ele termina a cópia.
        """
        # Primeiro a flag: ela é o que faz o ciclo em curso (e o que estiver na
        # fila da TRAVA_IA) desistir. As três chamadas abaixo cuidam de quem
        # tem mecanismo próprio.
        try:
            self.projeto_parar(project_name)
        except Exception:
            pass
        try:
            self._ac_parar_espera(project_name)
        except Exception:
            pass
        try:
            self.cancelar_fila(project_name)
        except Exception:
            pass
        try:
            chat_id = getattr(self, '_chat_em_resposta', {}).get(project_name)
            if chat_id:
                self._chat_forcar_parada_imediata(project_name, chat_id)
        except Exception:
            pass
        return {'success': True}

    def _decidir_pergunta(self, quando):
        """A regra dos três valores, escrita uma vez para os dois gestos.

        ⚠️ Nunca levanta — ver o docstring de `deve_confirmar_encerramento`.
        """
        try:
            from .agentes.trava_ia import TRAVA_IA
            estado = TRAVA_IA.estado()
            motivo = (estado or {}).get('motivo') or ''
            if quando == QUANDO_PERGUNTAR_NUNCA:
                return {'perguntar': False, 'motivo': motivo}
            if quando == QUANDO_PERGUNTAR_SEMPRE:
                return {'perguntar': True, 'motivo': motivo}
            # 'rodando': só quando há trabalho de IA em curso.
            return {'perguntar': estado is not None, 'motivo': motivo}
        except Exception:
            return {'perguntar': False, 'motivo': ''}

    def encerrar_programa(self):
        """O "Sim" do modal de encerramento: marca, grava o que dá, e fecha.

        ⚠️ A MARCA (`_encerramento_confirmado`) não é detalhe. `window.destroy()`
        dispara o `closing` DE NOVO, e sem ela o handler abriria o modal outra
        vez — para sempre, num laço que só o Gerenciador de Tarefas quebra.
        """
        self._encerramento_confirmado = True
        try:
            self.window.destroy()
        except Exception as e:
            return {'success': False, 'error': str(e)}
        return {'success': True}

