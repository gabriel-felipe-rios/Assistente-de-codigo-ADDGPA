"""O CRUD de uma tarefa da Fila: enfileirar, editar, complementar, devolver, apagar.

Separado da persistência (`estado.py`) porque a pergunta é outra: lá é *como o
arquivo é lido e gravado com segurança*, aqui é *o que o usuário pode fazer com
uma tarefa*. Toda escrita daqui passa por `_fila_transacao`, que mora lá.

⚠️ COMPLEMENTAR NÃO É REENVIAR. `complementar_tarefa_fila` grava a frase nova no
histórico NO MOMENTO em que você aperta Enviar — é o que faz ela aparecer na
conversa antes de a pesquisa recomeçar. O núcleo NÃO a acrescenta de novo;
repeti-la lá mandaria a mesma frase duas vezes.

⚠️ RODADAS, DEVOLUÇÕES E VOLTAS SOBREVIVEM AO COMPLEMENTO. Quem já gastou 28 de
30 rodadas não ganha 30 novas por ter recebido uma frase a mais — o orçamento é
POR TAREFA. O que É limpo, e só quando a passada anterior ENTREGOU relatório,
são as `sub_tags`: aí sim começa passada nova.

⚠️ APAGAR UMA TAREFA APAGA OS ARQUIVOS DELA (histórico, log, relatório). É o
único ponto do módulo que remove coisa do disco, e é de propósito que ele seja
um só.
"""

from .estado_constantes import *


class FilaEstadoTarefasMixin:

    # ── CRUD de tarefas ───────────────────────────────────────────────────────

    def enfileirar_tarefa(self, project_name, texto=''):
        """Cria a tarefa NA HORA, igual ao "+ Novo Chat".

        Aceita texto vazio de propósito: o botão só cria: quem escreve o que a
        tarefa é são as suas palavras no campo de baixo, e a primeira mensagem
        vira o texto — mesma mecânica do título do chat, que também nasce
        "Novo chat" e vira a primeira frase enviada.
        """
        try:
            texto = (texto or '').strip()
            with self._fila_transacao(project_name) as state:
                tarefa = {
                    'id': str(uuid.uuid4()),
                    'texto': texto,
                    'texto_original': texto,  # imutável — 'texto' cresce com os
                                              # complementos, este fica só pra
                                              # não duplicar a 1ª bolha da aba Chat
                    'status': FILA_STATUS_NA_FILA,
                    'sub_tags': [],
                    'criado_em': datetime.now().isoformat(),
                    'iniciado_em': None,
                    'concluido_em': None,
                    'rodadas_usadas': 0,
                    'devolucoes': 0,
                    'relatorio_path': None,
                    'arquivos_tocados': [],
                    'motivo_esclarecimento': None,
                    'erro': None,
                    'proxima_mensagem_usuario': None,
                    'log': {'eventos': []},
                }
                state.setdefault('tarefas', []).append(tarefa)
            return {'success': True, 'tarefa': tarefa}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def editar_tarefa_fila(self, project_name, tarefa_id, novo_texto):
        try:
            novo_texto = (novo_texto or '').strip()
            if not novo_texto:
                return {'success': False, 'error': 'texto vazio'}
            with self._fila_transacao(project_name) as state:
                tarefa = self._fila_find_tarefa(state, tarefa_id)
                if not tarefa:
                    return {'success': False, 'error': 'tarefa não encontrada'}
                if tarefa['status'] != FILA_STATUS_NA_FILA:
                    return {'success': False,
                            'error': 'só é possível editar tarefas que ainda não iniciaram'}
                tarefa['texto'] = novo_texto
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Complementar tarefa já processada: manda mensagem pela aba Chat ─────────
    # Aceita status pós-pipeline (não pendente/pesquisando). Diferente de
    # editar_tarefa_fila (troca o texto inteiro): aqui acrescenta, e a mensagem
    # entra JÁ no histórico da tarefa — é de lá que a sub-aba Fila desenha a
    # conversa, então a sua frase aparece na hora, sem esperar a pesquisa
    # recomeçar.
    _FILA_STATUS_COMPLEMENTAVEL = (FILA_STATUS_PRECISA_DE_VOCE, FILA_STATUS_PRONTO,
                                   FILA_STATUS_PRONTO_COM_RESSALVA, FILA_STATUS_FALHOU)

    def complementar_tarefa_fila(self, project_name, tarefa_id, mensagem,
                                 prompt_fixo=None):
        """A mensagem que você digita no campo de baixo.

        Se a tarefa ainda não tem texto, esta mensagem não complementa nada:
        ela É a tarefa. É a mesma mecânica do título do chat, que nasce
        "Novo chat" e vira a primeira frase enviada.

        `prompt_fixo` é a CHAVE do texto pronto escolhido na barra (o nome do
        arquivo em `prompts/Assistente/Fila/Prompts fixos/`), nunca o conteúdo dele. Guardar a
        chave é o que preserva o título da barra lateral — que sai de
        `tarefa['texto']` — e o que permite corrigir o `.txt` depois sem que
        tarefas antigas fiquem com a redação velha.
        """
        try:
            mensagem = (mensagem or '').strip()
            if not mensagem:
                return {'success': False, 'error': 'mensagem vazia'}
            anexar_ao_historico = False
            with self._fila_transacao(project_name) as state:
                tarefa = self._fila_find_tarefa(state, tarefa_id)
                if not tarefa:
                    return {'success': False, 'error': 'tarefa não encontrada'}
                primeira = not (tarefa.get('texto') or '').strip()
                if not primeira and tarefa['status'] not in self._FILA_STATUS_COMPLEMENTAVEL:
                    return {'success': False,
                            'error': 'essa tarefa ainda não terminou uma primeira passada'}

                if primeira:
                    tarefa['texto'] = mensagem
                    tarefa['texto_original'] = mensagem
                else:
                    tarefa['texto'] = f"{tarefa['texto']}\n\n[Complemento do usuário]\n{mensagem}"
                    tarefa['proxima_mensagem_usuario'] = mensagem
                    anexar_ao_historico = True
                # `if prompt_fixo:`, e não atribuição direta: escolher "Nenhum"
                # NÃO apaga o que já estava gravado. O botão volta para "Nenhum"
                # depois de cada envio, e o prompt fixo vale para todas as
                # rodadas daquela tarefa — se "Nenhum" limpasse, todo complemento
                # numa tarefa de segurança a transformaria em pesquisa comum sem
                # ninguém pedir. Para trocar, escolhe-se o outro (sobrescreve).
                if prompt_fixo:
                    tarefa['prompt_fixo'] = prompt_fixo
                # A marca descreve a PASSADA, e o complemento nem sempre começa
                # uma passada nova. Entregou relatório (`pronto` /
                # `pronto_com_ressalva`) → a próxima é passada nova, e as marcas
                # da anterior não valem mais. Caiu no meio (`falhou`) ou parou
                # para perguntar (`precisa_de_voce`) → a conversa inteira volta,
                # é a MESMA passada, e as ressalvas de pesquisa continuam
                # valendo. As sub-tags que só explicam a parada saem nos dois
                # casos — o que ficou de pé é filtrado em `_fila_processar_tarefa`.
                terminou = tarefa['status'] in (FILA_STATUS_PRONTO,
                                                FILA_STATUS_PRONTO_COM_RESSALVA)
                tarefa['status'] = FILA_STATUS_NA_FILA
                if terminou:
                    tarefa['sub_tags'] = []
                tarefa['motivo_esclarecimento'] = None
                tarefa['erro'] = None
                # ⚠️ A marca "vai continuar" morre aqui também. Escrever um
                # complemento já devolve a tarefa para `na_fila`, e ela vai
                # rodar por essa porta; se a marca sobrevivesse, o
                # `iniciar_fila` a promoveria DE NOVO na leva seguinte, sozinha,
                # para sempre.
                tarefa['proxima_continuacao'] = None
                # ⚠️ DEVOLUÇÕES ZERAM; RODADAS NÃO. Os dois contadores estavam
                # sob o mesmo comentário — "são POR TAREFA e sobrevivem ao
                # complemento" —, e isso só vale para as rodadas: elas são
                # ORÇAMENTO, e quem gastou 28 de 30 não ganha 30 novas por ter
                # escrito uma frase a mais.
                #
                # Devolução é FREIO, não orçamento, e mantê-la o desligava: uma
                # tarefa que esgotou as 3 ficava marcada com 3, então no
                # complemento seguinte a PRIMEIRA reprovação estourava o
                # contador e ela saía com ressalva sem nenhuma chance de
                # corrigir — e assim em todas as execuções seguintes, para
                # sempre. O relatório ainda escrevia "o Verificador reprovou 4
                # vez(es)" quando ele tinha reprovado uma.
                tarefa['devolucoes'] = 0
            # Fora da transação: mexe em outro arquivo, e o lock do estado não
            # tem nada a ver com ele. Quem processa a tarefa NÃO repete esta
            # mensagem — ela já está no histórico quando a pesquisa recomeça.
            if anexar_ao_historico:
                msgs = self.carregar_fila_historico(project_name, tarefa_id)
                if msgs:
                    msgs.append({'role': 'user', 'content': mensagem,
                                 'meta': {'tipo': 'complemento_usuario'}})
                    self._fila_gravar_historico(project_name, tarefa_id, msgs)
            self._fila_notify_tarefa(project_name, tarefa)
            return {'success': True, 'primeira': primeira}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def marcar_tarefa_para_continuar(self, project_name, tarefa_id, continuacao):
        """Marca (ou desmarca) uma tarefa terminada para continuar de onde parou.

        ⚠️ **Isto NÃO inicia nada.** A tarefa fica marcada, e quem dispara é o
        "▶ Iniciar tarefas" de sempre — que passa a rodar também o que estiver
        marcado. Separar o marcar do iniciar é o que permite marcar várias e sair
        de perto, do mesmo jeito que "+ Nova tarefa" e "Iniciar tarefas" já são
        dois cliques.

        `continuacao` é um de `FILA_CONTINUACOES`, ou `None`/'' para desmarcar
        (clicar de novo no botão que já está marcado):

        - `ate_o_teto`  — usa o que sobrou do orçamento. Fez 20 de 30 → mais 10.
        - `teto_cheio`  — zera os contadores. Fez 20 de 30 → mais 30.

        O efeito de cada um é aplicado só **no momento da promoção**, em
        `iniciar_fila`, e não aqui: entre marcar e iniciar você pode marcar
        outras, desmarcar, mudar de ideia. Zerar contador na hora do clique
        tornaria o "desmarcar" impossível de desfazer.
        """
        try:
            if continuacao and continuacao not in FILA_CONTINUACOES:
                return {'success': False, 'error': 'modo de continuação desconhecido'}
            with self._fila_transacao(project_name) as state:
                tarefa = self._fila_find_tarefa(state, tarefa_id)
                if not tarefa:
                    return {'success': False, 'error': 'tarefa não encontrada'}
                if tarefa['status'] not in FILA_STATUS_CONTINUAVEL:
                    return {'success': False,
                            'error': 'só dá para continuar uma tarefa que já terminou '
                                     'uma passada'}
                tarefa['proxima_continuacao'] = continuacao or None
                marcada = dict(tarefa)
            self._fila_notify_tarefa(project_name, marcada)
            return {'success': True, 'tarefa': marcada}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def devolver_tarefa_para_fila(self, project_name, tarefa_id):
        """Destrava uma tarefa presa em "Pesquisando", sem apagar nada.

        É a mesma recuperação que já roda na abertura do programa (ver
        `_fila_recuperar_orfaos`), oferecida com o programa aberto: uma thread
        que morre sem passar pelo `except` deixa a tarefa em "pesquisando" para
        sempre — `deletar_tarefa_fila` recusa e o botão "Iniciar tarefas" some,
        porque a tela o esconde quando há tarefa em jogo.

        ⛔ NÃO inicia nada. Quem manda rodar continua sendo "Iniciar tarefas".

        ⚠️ O lock da fila é quem separa "presa" de "rodando de verdade": se ele
        estiver tomado, existe worker vivo e devolver a tarefa criaria duas
        verdades sobre a mesma tarefa. Aí o caminho é o "Cancelar".
        """
        try:
            lock = self._fila_get_lock(project_name)
            if not lock.acquire(blocking=False):
                return {'success': False,
                        'error': 'a fila está em execução — use "Cancelar" para pará-la'}
            try:
                with self._fila_transacao(project_name) as state:
                    tarefa = self._fila_find_tarefa(state, tarefa_id)
                    if not tarefa:
                        return {'success': False, 'error': 'tarefa não encontrada'}
                    if tarefa['status'] not in (FILA_STATUS_PESQUISANDO,
                                                FILA_STATUS_AGUARDANDO_VEZ):
                        return {'success': False,
                                'error': 'essa tarefa não está presa'}
                    tarefa['status'] = FILA_STATUS_NA_FILA
                    # Mesmo motivo do complemento: a tarefa passa a rodar como
                    # "na fila", e a marca sobrevivente a promoveria duas vezes.
                    tarefa['proxima_continuacao'] = None
                    devolvida = dict(tarefa)
            finally:
                lock.release()
            self._fila_notify_tarefa(project_name, devolvida)
            return {'success': True, 'tarefa': devolvida}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # A frase é uma só, e a tela usa a MESMA no `title` do "×" apagado: ler um
    # texto no botão e outro no erro faria parecer que são duas recusas
    # diferentes.
    ERRO_DELETAR_AGUARDANDO_VEZ = (
        'não é possível deletar uma tarefa que está esperando a vez enquanto a '
        'fila roda — ela pode começar a qualquer momento. Use "Cancelar".')

    def deletar_tarefa_fila(self, project_name, tarefa_id):
        # ⚠️ O lock da EXECUÇÃO, sondado sem bloquear — é ele que responde "o
        # ciclo está rodando?", a mesma pergunta que `devolver_tarefa_para_fila`
        # já faz logo acima. Quando dá para tomá-lo, a fila está parada e ele
        # fica seguro até o fim da remoção: assim um "Iniciar tarefas" não
        # começa no meio dela. Quando NÃO dá, a fila está rodando e o lock é de
        # outra thread — nada a soltar no `finally`.
        lock = self._fila_get_lock(project_name)
        fila_rodando = not lock.acquire(blocking=False)
        try:
            with self._fila_transacao(project_name) as state:
                tarefa = self._fila_find_tarefa(state, tarefa_id)
                if not tarefa:
                    return {'success': False, 'error': 'tarefa não encontrada'}
                if tarefa['status'] == FILA_STATUS_PESQUISANDO:
                    return {'success': False,
                            'error': 'não é possível deletar uma tarefa em pesquisa'}
                # ⚠️ "Aguardando a vez" também é intocável ENQUANTO o ciclo roda,
                # e este guarda não existia: o motor recusava só `pesquisando`.
                # O cenário é o que o usuário descreveu — a fila está quase no
                # fim e o clique sem querer apaga a próxima tarefa a rodar, que
                # some da lista sem nada avisando. Parada a fila, apagar uma
                # tarefa que espera a vez continua valendo.
                if (tarefa['status'] == FILA_STATUS_AGUARDANDO_VEZ
                        and fila_rodando):
                    return {'success': False,
                            'error': self.ERRO_DELETAR_AGUARDANDO_VEZ}
                state['tarefas'] = [t for t in state['tarefas'] if t['id'] != tarefa_id]
                removida = dict(tarefa)
            falhas = self._fila_deletar_arquivos_da_tarefa(
                project_name, removida, tarefa_id)
            # A tarefa já saiu do estado, então isto não é erro de exclusão —
            # é sujeira em disco, e vale ser dita em vez de engolida.
            if falhas:
                return {'success': True,
                        'aviso': 'a tarefa saiu da lista, mas ficaram arquivos em '
                                 'disco: ' + '; '.join(falhas)}
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}
        finally:
            # Só solta o que este método tomou. Se `fila_rodando`, o lock é da
            # thread da fila — soltá-lo aqui a deixaria sem proteção nenhuma.
            if not fila_rodando:
                lock.release()

    def load_fila_estado(self, project_name):
        try:
            # A recuperação de órfãs mora AQUI, e não dentro de
            # `_fila_load_state`: esta é a porta por onde a tela abre a Fila de
            # um projeto, e é o único chamador que tem direito de gravar. Ela
            # se protege sozinha contra repetição (uma vez por projeto por
            # sessão), então o polling de 4 s não paga nada por ela.
            self._fila_recuperar_orfaos(project_name)
            state = self._fila_load_state(project_name)
            return {'success': True, 'tarefas': state.get('tarefas', [])}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def load_fila_relatorio(self, project_name, tarefa_id):
        try:
            state = self._fila_load_state(project_name)
            tarefa = self._fila_find_tarefa(state, tarefa_id)
            if not tarefa or not tarefa.get('relatorio_path'):
                return {'success': False, 'error': 'relatório não disponível'}
            full = os.path.join(obter_pasta_de_relatorios_da_fila(project_name),
                                tarefa['relatorio_path'])
            if not os.path.isfile(full):
                return {'success': False, 'error': 'arquivo de relatório não encontrado em disco'}
            with open(full, 'r', encoding='utf-8') as f:
                return {'success': True, 'markdown': f.read()}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def load_fila_frescor(self, project_name):
        """Aviso condicional: só aparece se índice/pipeline/resumo-de-pastas
        estiverem defasados em relação ao código atual — nunca string fixa."""
        try:
            r = self.get_arquivos_mudados(project_name)
            if not r.get('success'):
                return {'success': True, 'defasado': False, 'aviso': None}
            defasado = bool(r.get('baseline')) and len(r.get('mudados', [])) > 0
            aviso = None
            if defasado:
                n = len(r['mudados'])
                aviso = (f'{n} arquivo(s) de código mudaram desde a última geração de índice de '
                         'navegação / pipeline / resumo de pastas — atualize esses agentes em '
                         'Rotinas antes de iniciar, para a pesquisa não trabalhar com dados '
                         'desatualizados.')
            return {'success': True, 'defasado': defasado, 'aviso': aviso}
        except Exception as e:
            return {'success': False, 'error': str(e)}
