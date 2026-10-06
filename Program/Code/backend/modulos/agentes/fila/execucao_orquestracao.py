"""A fila em si: começar, cancelar, e passar de uma tarefa para a outra.

Separado do núcleo (`execucao.py`) porque a pergunta é outra: aqui é *que tarefa
roda agora*, lá é *o que acontece dentro de uma*. Uma é sobre a FILA, a outra é
sobre a TAREFA, e só a primeira encosta na trava entre agentes.

⚠️ SEQUENCIAL, UMA TAREFA POR VEZ, e não é limitação técnica: é o LM Studio que
é um só. Duas tarefas em paralelo disputariam o mesmo modelo e as duas ficariam
mais lentas que se tivessem esperado a vez.

⚠️ A TRAVA (`TRAVA_IA`) É DAQUI, e não do núcleo. Ela responde "quem está usando
o modelo agora" — Chat, Fila ou Rotinas —, e é uma pergunta da fila inteira, não
de uma tarefa. Pegá-la lá dentro faria cada tarefa disputar de novo o que a
passada anterior já tinha ganhado.
"""

from .execucao_constantes import *


class FilaExecucaoOrquestracaoMixin:

    # ── Orquestração da fila (sequencial, uma tarefa por vez) ───────────────────

    def iniciar_fila(self, project_name, model, subagentes_config=None):
        lock = self._fila_get_lock(project_name)
        if not lock.acquire(blocking=False):
            return {'success': False, 'error': 'a fila já está em execução'}
        self._fila_cancel_map()[project_name] = False

        # "+ Nova tarefa" só escreve; é este clique que põe as tarefas em jogo.
        # A promoção acontece aqui, e não dentro do laço, para a tela poder
        # distinguir o que você ainda não mandou rodar (na fila, vazado) do que
        # já está esperando a vez (cheio).
        # A configuração é lida ANTES da transação porque agora ela é GRAVADA
        # em cada tarefa promovida. Os dois campos da Fila — rodadas por tarefa
        # e devoluções do Verificador — viviam só no `localStorage` do
        # navegador: mudá-los no meio de uma leva mudava a regra das tarefas
        # que já estavam esperando a vez, e limpar os dados do navegador
        # apagava a configuração sem deixar rastro. Gravada na tarefa, a regra
        # com que ela entrou em jogo é a regra com que ela roda.
        # ⚠️ Tudo daqui até o `.start()` corre dentro de um `try`, e o `finally`
        # solta o lock se a thread NÃO chegou a nascer. Sem ele, qualquer
        # exceção no meio (`_fila_config`, a transação, o próprio `.start()`)
        # deixava o lock preso e `iniciar_fila` respondia "a fila já está em
        # execução" até o programa ser reiniciado. No caso do `.start()` a
        # TRAVA_IA vazava junto, e o Chat travava também.
        entregue_a_thread = False
        reserva = None
        promovidas = 0
        try:
            cfg = self._fila_config(subagentes_config)

            promovidas = 0
            promovidas_ids = []
            with self._fila_transacao(project_name) as state:
                for t in state.get('tarefas', []):
                    # Tarefa ainda sem texto não entra em jogo: ela foi criada
                    # pelo "+ Nova tarefa" e você ainda não disse o que quer.
                    # Mandar o modelo pesquisar uma string vazia queima uma
                    # rodada para nada.
                    tem_texto = bool((t.get('texto') or '').strip())
                    na_fila = t.get('status') == FILA_STATUS_NA_FILA and tem_texto
                    # A segunda porta: tarefa que já terminou e você marcou para
                    # continuar. É AQUI que o efeito do botão é aplicado — não
                    # no clique —, porque entre marcar e iniciar você ainda pode
                    # desmarcar ou mudar de ideia.
                    continuar = t.get('proxima_continuacao') if tem_texto else None
                    if not (na_fila or continuar):
                        continue
                    if continuar == FILA_CONTINUAR_TETO_CHEIO:
                        # Teto cheio: o orçamento inteiro de novo. Os três
                        # contadores zeram juntos — deixar `voltas_usadas` de
                        # pé entregaria meio teto, porque o cinto de segurança
                        # do laço estouraria na primeira volta.
                        t['rodadas_usadas'] = 0
                        t['devolucoes'] = 0
                        t['voltas_usadas'] = 0
                    # ⚠️ A marca é CONSUMIDA aqui. Se sobrevivesse, a tarefa
                    # seria promovida de novo na leva seguinte, sozinha, para
                    # sempre — e `_fila_processar_todas` só sai quando ninguém
                    # mais está aguardando a vez.
                    t['proxima_continuacao'] = None
                    t['status'] = FILA_STATUS_AGUARDANDO_VEZ
                    t['max_rodadas'] = cfg['max_rodadas']
                    t['devolucoes_permitidas'] = cfg['devolucoes']
                    t['max_voltas'] = cfg['max_voltas']
                    promovidas += 1
                    promovidas_ids.append(t['id'])
                emJogo = [dict(t) for t in state.get('tarefas', [])
                          if t.get('status') == FILA_STATUS_AGUARDANDO_VEZ]
            for t in emJogo:
                self._fila_notify_tarefa(project_name, t)

            # A trava de CINCO pontas: enquanto a Fila roda, o Chat, as Rotinas,
            # o Designer e o backup ficam de fora — a janela do LM Studio é uma
            # só, e o backup entra porque copiar arquivo que está sendo escrito
            # dá o mesmo resultado errado com cara de certo. Recusa em vez de
            # esperar porque há gente na tela clicando "Iniciar tarefas".
            try:
                # `reserva` só recebe o valor DEPOIS de o `__enter__` passar:
                # o `finally` lá embaixo chama `__exit__`, e chamá-lo numa
                # reserva que nunca entrou soltaria a trava de outro dono.
                pedida = TRAVA_IA.ocupar(DONO_FILA, projeto=project_name, esperar=False)
                pedida.__enter__()
                reserva = pedida
            except TravaOcupada as e:
                # As tarefas já foram promovidas e notificadas ACIMA. Sair sem
                # desfazer deixava todas elas em "Aguardando a vez" com ninguém
                # rodando — e o botão "Iniciar tarefas" escondido por causa disso.
                self._fila_despromover(project_name, promovidas_ids)
                return {'success': False, 'error': e.estado.get('motivo'),
                        'trava': e.estado}

            reserva_local = reserva

            def worker():
                try:
                    self._fila_processar_todas(project_name, model, cfg)
                finally:
                    reserva_local.__exit__(None, None, None)
                    lock.release()

            threading.Thread(target=worker, daemon=True).start()
            entregue_a_thread = True
            return {'success': True, 'tarefas_iniciadas': promovidas}
        finally:
            if not entregue_a_thread:
                # A thread não nasceu: quem solta as duas travas é este bloco.
                if reserva is not None:
                    reserva.__exit__(None, None, None)
                lock.release()

    def cancelar_fila(self, project_name):
        # Deixa a chamada de LLM atual terminar e não dispara a próxima tarefa
        # — sem aborto no meio de uma request (decidido no design).
        self._fila_cancel_map()[project_name] = True
        mexidas = []
        with self._fila_transacao(project_name) as state:
            for t in state.get('tarefas', []):
                if t.get('status') == FILA_STATUS_AGUARDANDO_VEZ:
                    t['status'] = FILA_STATUS_NA_FILA
                    mexidas.append(dict(t))
        # Só o que ele TOCOU. Notificar todas era uma chamada à tela por tarefa,
        # inclusive as que ele não encostou — `iniciar_fila` já filtrava e fazia
        # o certo. A que está pesquisando é devolvida pelo próprio laço, no fim
        # da rodada, e se notifica sozinha.
        for t in mexidas:
            self._fila_notify_tarefa(project_name, t)
        return {'success': True}

    def _fila_processar_todas(self, project_name, model, cfg):
        """Uma tarefa por vez: a seguinte só começa quando a anterior sai.

        Tarefa que vira `precisa_de_voce` sai da vez sem travar as outras — o
        laço simplesmente não a enxerga mais, porque só procura quem está
        aguardando a vez.
        """
        while True:
            if self._fila_cancel_map().get(project_name):
                break
            state = self._fila_load_state(project_name)
            proxima = next((t for t in state['tarefas']
                            if t['status'] == FILA_STATUS_AGUARDANDO_VEZ), None)
            if not proxima:
                break
            self._fila_processar_tarefa(project_name, proxima['id'], model, cfg)
