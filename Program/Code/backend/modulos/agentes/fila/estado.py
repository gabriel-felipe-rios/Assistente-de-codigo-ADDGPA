"""O `Estado.json` da Fila: onde mora, como se lê e como se grava com segurança.

Este arquivo era 764 linhas e virou três, pelo teto de 500 da AMF:

| Arquivo | A pergunta que ele responde |
|---|---|
| `estado.py` | onde os arquivos ficam, e como se escreve sem perder escrita |
| `estado_constantes.py` | os status, as sub-tags e as continuações |
| `estado_tarefas.py` | o que o usuário pode fazer com uma tarefa |

`FilaEstadoMixin` continua sendo o nome único que `api.py` importa: ele COMPÕE o
irmão, no padrão de `InspetorMixin` (Convenção 5 da Arquitetura modular).

⚠️ `import *` DE `estado_constantes.py` É O QUE MANTÉM O ENDEREÇO PÚBLICO.
`execucao_constantes.py` faz `from .estado import FILA_STATUS_…` e continua
funcionando. Não trocar por import seletivo.

⚠️ `_fila_transacao` É A ÚNICA PORTA DE ESCRITA. Ela pega a trava do projeto,
recarrega o estado do disco, entrega para quem chamou mexer e grava
atomicamente. Um caminho que leia, modifique e grave por fora perde a escrita de
quem estava no meio da transação — e o sintoma é uma tarefa que "volta ao status
anterior sozinha".

⚠️ O HISTÓRICO E O LOG SÃO ARQUIVOS PRÓPRIOS, um por tarefa, e não campos do
`Estado.json`. Trinta rodadas de conversa dentro do estado fariam cada mudança
de status reescrever megabytes — e o log de ferramentas é anexado LINHA A LINHA,
justamente para não reescrever o que já está lá.

⚠️ OS ÓRFÃOS SÃO RECUPERADOS NA ABERTURA. Uma tarefa que ficou em
`pesquisando` porque o programa caiu no meio volta para a fila com a conversa
inteira guardada — nunca é descartada.
"""

from .estado_constantes import *
from .estado_constantes import _FILA_MIGRACAO_STATUS

from .estado_tarefas import FilaEstadoTarefasMixin


class FilaEstadoMixin(FilaEstadoTarefasMixin):
    """Persistência e CRUD de tarefas da Fila de pesquisa assíncrona."""

    # ── Caminhos e persistência ───────────────────────────────────────────────

    # A Fila morava em DOIS lugares distantes: `agentes/fila/` (estado,
    # histórico e log) e `Fila/`, na raiz do projeto (os relatórios .md). Agora
    # os relatórios são só mais uma subpasta daqui — o que a sub-aba Fila
    # escreve fica todo sob `Assistente/Fila/`.
    def _fila_dir(self, project_name):
        return obter_pasta_da_fila(project_name)

    def _fila_state_path(self, project_name):
        return obter_arquivo_de_estado_da_fila(project_name)

    def _fila_relatorios_dir(self, project_name):
        return obter_pasta_de_relatorios_da_fila(project_name)

    def _fila_historico_path(self, project_name, tarefa_id):
        return os.path.join(obter_pasta_de_historico_da_fila(project_name),
                            f'{tarefa_id}.json')

    def carregar_fila_historico(self, project_name, tarefa_id):
        """O histórico de mensagens do agente principal, para esta tarefa.

        Mora em arquivo próprio, e não dentro do estado.json, porque cada
        evento de ferramenta reescreve o estado inteiro: com teto de 30
        rodadas e quatro subagentes por rodada, o histórico embutido faria a
        gravação crescer ao quadrado num arquivo compartilhado por todas as
        tarefas do projeto."""
        path = self._fila_historico_path(project_name, tarefa_id)
        if not os.path.isfile(path):
            return []
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f).get('mensagens') or []
        except Exception:
            return []

    def _fila_gravar_historico(self, project_name, tarefa_id, mensagens):
        path = self._fila_historico_path(project_name, tarefa_id)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump({'mensagens': mensagens}, f, ensure_ascii=False, indent=2)

    # ── Log de ferramentas (arquivo próprio, uma linha por evento) ────────────
    # Pelo mesmo motivo do histórico, e por um a mais: o `resultado` de uma
    # ferramenta é o campo mais gordo do log inteiro, e são centenas por
    # tarefa. Dentro do estado.json ele chegou a 89% de um arquivo de 1,2 MB
    # que era reescrito INTEIRO a cada chamada — de novo o crescimento
    # quadrático que tirou o histórico dali.
    #
    # É .jsonl, e não .json, de propósito: uma linha por evento, aberta em modo
    # append. Escrever custa o tamanho do evento, não o tamanho do arquivo.

    def _fila_log_path(self, project_name, tarefa_id):
        return os.path.join(obter_pasta_de_log_da_fila(project_name),
                            f'{tarefa_id}.jsonl')

    def _fila_anexar_log_ferramenta(self, project_name, tarefa_id, evento):
        path = self._fila_log_path(project_name, tarefa_id)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'a', encoding='utf-8') as f:
            f.write(json.dumps(evento, ensure_ascii=False) + '\n')

    def carregar_fila_log(self, project_name, tarefa_id):
        """Os eventos de ferramenta desta tarefa, na ordem em que aconteceram.

        A sub-aba Log casa esta lista com os marcadores `ferramenta` que ficaram
        no estado: o marcador guarda quem chamou, o quê e quando; o conteúdo
        pesado — parâmetros e resultado — vem daqui, e só quando você abre a
        aba. Linha corrompida é pulada em vez de derrubar o log inteiro."""
        path = self._fila_log_path(project_name, tarefa_id)
        if not os.path.isfile(path):
            return []
        eventos = []
        try:
            with open(path, 'r', encoding='utf-8') as f:
                for linha in f:
                    linha = linha.strip()
                    if not linha:
                        continue
                    try:
                        eventos.append(json.loads(linha))
                    except Exception:
                        continue
        except Exception:
            return []
        return eventos

    # Apaga tudo o que pertence à tarefa: histórico, log de ferramentas e o
    # relatório em Markdown. Antes só o histórico saía, e em silêncio — por
    # isso havia arquivo órfão em disco sem tarefa correspondente no estado.
    # Devolve a lista do que não conseguiu apagar, para quem chama decidir.
    def _fila_deletar_arquivos_da_tarefa(self, project_name, tarefa, tarefa_id):
        alvos = [self._fila_historico_path(project_name, tarefa_id),
                 self._fila_log_path(project_name, tarefa_id)]
        # `relatorio_path` guarda só o NOME do arquivo — a pasta é resolvida
        # aqui. Já guardou o caminho relativo com o prefixo "Fila/" dentro, e
        # isso fazia o dado gravado depender do layout de pastas: quando a pasta
        # mudou de lugar, todo relatório antigo virou ponteiro para o vazio.
        # Mesma resolução de `load_fila_relatorio`; qualquer outra aponta para
        # um lugar que não existe, e a exclusão passaria batida sem erro nenhum.
        rel = (tarefa or {}).get('relatorio_path')
        if rel:
            alvos.append(rel if os.path.isabs(rel)
                         else os.path.join(
                             obter_pasta_de_relatorios_da_fila(project_name), rel))
        falhas = []
        for alvo in alvos:
            if not os.path.isfile(alvo):
                continue
            try:
                os.remove(alvo)
            except Exception as e:
                falhas.append(f'{os.path.basename(alvo)}: {e}')
        return falhas

    def _fila_save_state_raw(self, path, state):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(state, f, ensure_ascii=False, indent=2)

    def _fila_save_state(self, project_name, state):
        self._fila_save_state_raw(self._fila_state_path(project_name), state)

    def _fila_load_state(self, project_name):
        path = self._fila_state_path(project_name)
        if not os.path.isfile(path):
            state = {'tarefas': []}
        else:
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    state = json.load(f)
            except Exception:
                state = {'tarefas': []}

        # Migração dos nomes antigos. Vem AQUI, e não no `load_fila_estado`,
        # porque aquele é só a API da tela: uma tarefa gravada com nome velho
        # num estado.json que a tela nunca abriu chegaria ao laço de execução
        # com um status que ele não procura, e sumiria sem mensagem nenhuma.
        # Precisa vir antes da recuperação de órfãs, abaixo, senão ela compara
        # contra a constante errada.
        mudou = False
        for t in state.get('tarefas', []):
            novo = _FILA_MIGRACAO_STATUS.get(t.get('status'))
            if novo:
                t['status'] = novo
                mudou = True
            # Tarefa migrada não recebe sub-tag: não havia nenhuma para
            # traduzir, e inventar uma seria afirmar um defeito não conferido.
            if 'sub_tags' not in t:
                t['sub_tags'] = []
                mudou = True
            # O histórico do Orquestrador é descartado, não convertido: o
            # `system` dele é o prompt de um agente que deixou de existir, e
            # realimentá-lo entregaria ao agente novo um contrato morto.
            if 'orquestrador_historico' in t:
                t.pop('orquestrador_historico', None)
                mudou = True
            # Log no formato antigo (três chaves: `agentes` dict, `timeline` e
            # `ferramentas`) vira uma lista ordenada só, e as ferramentas saem
            # para o .jsonl. Ver `_fila_migrar_log`.
            if self._fila_migrar_log(project_name, t):
                mudou = True

        # ⚠️ A recuperação de órfãs e a limpeza de arquivos NÃO acontecem mais
        # aqui — ver `_fila_recuperar_orfaos`. Esta função voltou a ser LEITURA
        # PURA, que é o que a docstring de `_fila_transacao` sempre afirmou que
        # ela era. Ela é chamada por quatro lugares que não seguram o lock (o
        # polling de 4 s, `load_fila_relatorio`, `_fila_arquivos_em_comum` e
        # `_fila_processar_todas`), e gravar dali era exatamente a perda de
        # escrita que a transação existe para impedir — pelo lado que ficou de
        # fora. Agravante: `_fila_limpar_orfaos` APAGA arquivos, e uma tarefa
        # criada por outra thread e ainda não commitada tinha os arquivos
        # removidos.
        #
        # A migração acima continua aqui de propósito: ela é idempotente e não
        # apaga nada. O que ela mudou em memória é regravado na primeira
        # transação que passar.
        if mudou:
            self._fila_migracao_pendente(project_name)
        return state

    def _fila_migracao_pendente(self, project_name):
        """Anota que a migração de nomes antigos ainda não foi para o disco.

        Gravar aqui seria escrever fora do lock. Quem grava é
        `_fila_recuperar_orfaos`, que roda dentro de uma transação.
        """
        if not hasattr(self, '_fila_migracoes_pendentes'):
            self._fila_migracoes_pendentes = set()
        self._fila_migracoes_pendentes.add(project_name)

    def _fila_recuperar_orfaos(self, project_name):
        """App fechado no meio de uma tarefa: devolve as órfãs para "na fila".

        Na primeira leitura desta sessão do processo, qualquer tarefa
        "pesquisando" ou "aguardando a vez" é órfã — não há thread rodando para
        ela. Só verifica uma vez por projeto por sessão, para não atropelar o
        processamento em andamento.

        ⚠️ Roda DENTRO da transação, e é o que separa esta função da leitura.
        `_fila_limpar_orfaos` apaga histórico e log em disco, e apagar a partir
        de um estado lido sem o lock removia os arquivos de uma tarefa que outra
        thread tinha acabado de criar e ainda não gravado.
        """
        if not hasattr(self, '_fila_recuperados'):
            self._fila_recuperados = set()
        pendente = project_name in getattr(self, '_fila_migracoes_pendentes', set())
        if project_name in self._fila_recuperados and not pendente:
            return
        mexidas = []
        with self._fila_transacao(project_name) as state:
            if project_name not in self._fila_recuperados:
                self._fila_recuperados.add(project_name)
                for t in state.get('tarefas', []):
                    if t.get('status') in (FILA_STATUS_PESQUISANDO,
                                           FILA_STATUS_AGUARDANDO_VEZ):
                        t['status'] = FILA_STATUS_NA_FILA
                        mexidas.append(dict(t))
                self._fila_limpar_orfaos(project_name, state)
        if pendente:
            self._fila_migracoes_pendentes.discard(project_name)
        for t in mexidas:
            self._fila_notify_tarefa(project_name, t)

    def _fila_limpar_orfaos(self, project_name, state):
        """Apaga histórico e log de tarefas que não existem mais.

        Os dois são dados derivados, do programa: sem a tarefa no estado, não há
        tela que os leia e nada os apaga depois. Antes ficavam ali para sempre,
        porque a exclusão engolia exceção em silêncio.

        O relatório .md NÃO entra aqui, de propósito: ele é o produto da
        pesquisa, e apagar em varredura o que você talvez quisesse guardar é
        caro demais para um ganho de arrumação. Quem apaga o .md é a exclusão
        explícita da tarefa, onde a intenção é sua."""
        vivos = {t.get('id') for t in state.get('tarefas', [])}
        for pasta, ext in ((obter_pasta_de_historico_da_fila(project_name), '.json'),
                           (obter_pasta_de_log_da_fila(project_name), '.jsonl')):
            if not os.path.isdir(pasta):
                continue
            for nome in os.listdir(pasta):
                if not nome.endswith(ext) or nome[:-len(ext)] in vivos:
                    continue
                try:
                    os.remove(os.path.join(pasta, nome))
                except Exception:
                    pass

    # A ordem de um evento é o melhor carimbo que ele tem. `fim` primeiro
    # porque é o momento em que o evento entrou no log; `inicio` para os que
    # ainda não terminaram; string vazia ordena antes de qualquer data ISO, o
    # que joga para o começo os eventos sem carimbo nenhum.
    @staticmethod
    def _fila_carimbo(ev):
        return ev.get('fim') or ev.get('inicio') or ''

    def _fila_migrar_log(self, project_name, tarefa):
        """Converte o log de três chaves para a lista única `eventos`.

        O formato antigo separava `agentes` (dict por agente, sem ordem entre
        eles), `timeline` (só os turnos concluídos) e `ferramentas`. A sub-aba
        Log precisa dos três em ordem cronológica, e remontar essa ordem a cada
        render era caro e ambíguo. Agora é uma lista só, na ordem em que os
        eventos chegaram, e o pesado das ferramentas mora fora.
        """
        log = tarefa.get('log')
        if not isinstance(log, dict) or 'eventos' in log:
            return False

        eventos = []
        for lista in (log.get('agentes') or {}).values():
            eventos.extend(lista or [])
        ferramentas = list(log.get('ferramentas') or [])
        eventos.extend(ferramentas)
        # `timeline` é descartada: cada entrada dela é um resumo de um evento
        # 'fim' que já está em `agentes`. Reaproveitá-la duplicaria a bolha.
        eventos.sort(key=self._fila_carimbo)

        if ferramentas:
            path = self._fila_log_path(project_name, tarefa['id'])
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'w', encoding='utf-8') as f:
                for ev in sorted(ferramentas, key=self._fila_carimbo):
                    f.write(json.dumps(ev, ensure_ascii=False) + '\n')

        tarefa['log'] = {'eventos': [self._fila_evento_leve(ev) for ev in eventos]}
        return True

    def _fila_find_tarefa(self, state, tarefa_id):
        for t in state.get('tarefas', []):
            if t['id'] == tarefa_id:
                return t
        return None

    def _fila_slug(self, texto, tarefa_id=None):
        """Nome do arquivo do relatório, com desempate por id.

        Sem o id, duas tarefas com o mesmo começo de texto escreviam no MESMO
        `.md`, e apagar uma apagava o relatório da outra — que ficava `pronto`,
        com o botão "Ver relatório" à mostra, e o clique devolvendo "arquivo de
        relatório não encontrado em disco". Texto sem nenhum `[a-z0-9]` caía
        todo em `tarefa.md`, o que fazia toda tarefa em japonês colidir com
        toda outra.

        ⚠️ `tarefa_id` é opcional para não quebrar chamada existente, mas quem
        grava relatório sempre passa. O nome de um relatório JÁ GRAVADO não
        muda: o caminho fica em `tarefa['relatorio_path']`, e é ele que a tela
        abre.
        """
        s = re.sub(r'[^a-z0-9]+', '-', (texto or '').lower().strip())
        s = s.strip('-')[:60] or 'tarefa'
        return f'{s}-{tarefa_id}' if tarefa_id else s

    # ── Fila (lock + cancelamento em memória, por projeto) ─────────────────────

    def _fila_locks(self):
        if not hasattr(self, '_fila_locks_map'):
            self._fila_locks_map = {}
        return self._fila_locks_map

    def _fila_get_lock(self, project_name):
        locks = self._fila_locks()
        if project_name not in locks:
            locks[project_name] = threading.Lock()
        return locks[project_name]

    def _fila_state_locks(self):
        if not hasattr(self, '_fila_state_locks_map'):
            self._fila_state_locks_map = {}
        return self._fila_state_locks_map

    def _fila_state_lock(self, project_name):
        locks = self._fila_state_locks()
        if project_name not in locks:
            # Reentrante: `_fila_marcar_status` e `_fila_log_evento` são
            # chamados de dentro de blocos que já seguram o lock.
            locks[project_name] = threading.RLock()
        return locks[project_name]

    @contextmanager
    def _fila_transacao(self, project_name):
        """Lê o estado, deixa mexer, grava — tudo sob o lock do projeto.

        Sem isto o `estado.json` sofre perda de atualização: a thread da fila
        reescreve o arquivo inteiro a cada evento de ferramenta, e a thread da
        interface faz o mesmo ao criar ou complementar uma tarefa. Quem
        gravasse por último apagava o trabalho do outro — e a tarefa recém
        criada simplesmente sumia da lista.

        Toda leitura-modificação-gravação do estado passa por aqui. Leitura
        pura (a tela consultando) continua usando `_fila_load_state` direto.
        """
        with self._fila_state_lock(project_name):
            state = self._fila_load_state(project_name)
            yield state
            self._fila_save_state(project_name, state)

    def _fila_cancel_map(self):
        if not hasattr(self, '_fila_cancel_map_data'):
            self._fila_cancel_map_data = {}
        return self._fila_cancel_map_data

