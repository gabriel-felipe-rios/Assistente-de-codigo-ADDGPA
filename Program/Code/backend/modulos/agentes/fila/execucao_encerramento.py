"""O desfecho de uma tarefa: gravar o resultado, o progresso, ou a queda.

As quatro funções que escrevem o estado final — encerrar com relatório, marcar
progresso no meio do caminho, despromover uma tarefa que foi cancelada, e somar
o uso de tokens. Separadas do núcleo porque elas são chamadas de DEZENAS de
pontos diferentes dele (o laço tem 17 saídas), e ter as quatro juntas é o que
permite conferir de um olhar que todas gravam os mesmos contadores.

⚠️ RODADAS, DEVOLUÇÕES E VOLTAS SÃO ORÇAMENTO POR TAREFA, e sobrevivem ao
complemento: quem já gastou 28 de 30 rodadas não ganha 30 novas por ter recebido
uma frase a mais. É por isso que `_fila_marcar_progresso` grava os três a cada
rodada, e não só no fim — uma queda no meio não pode devolver orçamento gasto.

⚠️ `_fila_despromover` RECEBE `de=`, e o parâmetro não é enfeite: despromover
sem conferir o status de origem faria uma tarefa que já terminou voltar para "na
fila" porque um cancelamento chegou atrasado.
"""

from .execucao_constantes import *


class FilaExecucaoEncerramentoMixin:

    # ── Encerramento ──────────────────────────────────────────────────────────

    def _fila_encerrar(self, project_name, tarefa_id, relatorio, ressalvas, rodadas,
                       devolucoes, veredito, voltas=None):
        with self._fila_transacao(project_name) as state:
            tarefa = self._fila_find_tarefa(state, tarefa_id)
            if not tarefa:
                return

            arquivos_tocados = sorted({a['arquivo'] for a in relatorio['arquivos']
                                       if a.get('arquivo')})
            sub_tags = sorted(ressalvas)
            relatorio_md = self._fila_montar_relatorio_md(
                project_name, tarefa, relatorio, sub_tags, veredito, devolucoes,
                arquivos_tocados)

            rel_dir = self._fila_relatorios_dir(project_name)
            os.makedirs(rel_dir, exist_ok=True)
            slug = self._fila_slug(tarefa['texto'], tarefa_id)
            with open(os.path.join(rel_dir, f'{slug}.md'), 'w', encoding='utf-8') as f:
                f.write(relatorio_md)

            tarefa['status'] = FILA_STATUS_PRONTO_COM_RESSALVA if sub_tags else FILA_STATUS_PRONTO
            tarefa['sub_tags'] = sub_tags
            tarefa['concluido_em'] = datetime.now().isoformat()
            # Só o nome do arquivo: onde fica a pasta é decisão de `caminhos.py`,
            # não informação para gravar dentro de cada tarefa.
            tarefa['relatorio_path'] = f'{slug}.md'
            tarefa['arquivos_tocados'] = arquivos_tocados
            tarefa['rodadas_usadas'] = rodadas
            tarefa['devolucoes'] = devolucoes
            if voltas is not None:
                tarefa['voltas_usadas'] = voltas
            tarefa['proxima_mensagem_usuario'] = None
            tarefa = dict(tarefa)
        self._fila_notify_tarefa(project_name, tarefa)
        # Reação (D46) — `relatorio.py::_fila_avisar_extensoes`, fora da transação.
        self._fila_avisar_extensoes(project_name, tarefa)

    def _fila_marcar_progresso(self, project_name, tarefa_id, rodadas, devolucoes,
                               voltas=None):
        """Grava só os contadores, sem mexer em status — é o que o badge
        'Rodando 1 de 4' e o card do Contador leem enquanto a tarefa roda.

        `voltas` é opcional de propósito: a assinatura é posicional e chamada de
        vários lugares, e um parâmetro obrigatório a mais quebraria todos eles
        em tempo de execução.
        """
        with self._fila_transacao(project_name) as state:
            tarefa = self._fila_find_tarefa(state, tarefa_id)
            if not tarefa:
                return
            tarefa['rodadas_usadas'] = rodadas
            tarefa['devolucoes'] = devolucoes
            if voltas is not None:
                tarefa['voltas_usadas'] = voltas
            tarefa = dict(tarefa)
        self._fila_notify_tarefa(project_name, tarefa)

    def _fila_despromover(self, project_name, tarefa_ids, de=None):
        """Devolve para "na fila" as tarefas que estavam em jogo.

        Dois usos: `iniciar_fila` promove e notifica ANTES de pedir a trava —
        recusada a trava, sem isto as tarefas ficavam em "Aguardando a vez" sem
        ninguém rodando, e o botão "Iniciar tarefas" sumia porque a tela o
        esconde quando há tarefa em jogo. E o "Cancelar", que devolve a tarefa
        que estava pesquisando.

        `de` é o estado de origem aceito; o padrão é "aguardando a vez".
        """
        if not tarefa_ids:
            return
        de = de or FILA_STATUS_AGUARDANDO_VEZ
        alvo = set(tarefa_ids)
        mexidas = []
        with self._fila_transacao(project_name) as state:
            for t in state.get('tarefas', []):
                if t.get('id') in alvo and t.get('status') == de:
                    t['status'] = FILA_STATUS_NA_FILA
                    mexidas.append(dict(t))
        for t in mexidas:
            self._fila_notify_tarefa(project_name, t)

    def _fila_parece_offline(self, erro):
        texto = str(erro).lower()
        return any(p in texto for p in ('connection', 'conexão', 'refused', 'connect',
                                        'timed out', 'unreachable'))

    def _fila_somar_uso(self, resp, log_cb):
        """Tokens reais do agente principal, para a barra de tokens do Log.
        Vêm do `usage` da própria API — nunca de estimativa."""
        u = getattr(resp, 'usage', None)
        if u is None:
            return
        log_cb({'agente': 'fila', 'evento': 'uso',
                'uso': {'entrada': getattr(u, 'prompt_tokens', 0) or 0,
                        'saida': getattr(u, 'completion_tokens', 0) or 0}})
