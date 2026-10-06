from .constantes import *
from .extensoes.prompts import acrescimos_de_prompt, aplicar_acrescimos


class ChatPersistenciaMixin:
    """Persistência de chats: caminhos/arquivos, CRUD, extras (log, contexto,
    subagentes) e listagem de modelos/prompts de modo."""

    # ── Chat: helpers ─────────────────────────────────────────────────────────
    def _chat_dir(self, project_name):
        d = obter_pasta_de_chats(project_name)
        os.makedirs(d, exist_ok=True)
        return d

    def _chat_folder(self, project_name, chat_id):
        return os.path.join(self._chat_dir(project_name), chat_id)

    def _chat_path(self, project_name, chat_id):
        folder = self._chat_folder(project_name, chat_id)
        if os.path.isdir(folder):
            return os.path.join(folder, 'conversa.json')
        # Formato legado: chats/{id}.json
        return os.path.join(self._chat_dir(project_name), f'{chat_id}.json')

    def _chat_extra_path(self, project_name, chat_id, nome):
        """Caminho de um arquivo extra (log.json, contexto.json, subagentes.json).
        Retorna None para chats legados (arquivo único, sem pasta)."""
        folder = self._chat_folder(project_name, chat_id)
        if not os.path.isdir(folder):
            return None
        return os.path.join(folder, nome)

    def _chat_lock(self):
        if not hasattr(self, '_chat_io_lock'):
            self._chat_io_lock = threading.Lock()
        return self._chat_io_lock

    def _append_chat_log(self, project_name, chat_id, entry):
        """Acrescenta uma entrada ao log.json do chat.

        ⚠️ Retorna **o motivo de não ter gravado**, ou `None` se gravou. Antes
        era `except Exception: pass` e um `return` mudo para chat legado — e o
        Chat promete, na tela, que "a resposta crua ficou guardada no Log deste
        chat". Num chat legado essa promessa era falsa, e nada avisava.
        """
        path = self._chat_extra_path(project_name, chat_id, 'log.json')
        if not path:
            return ('este chat é do formato antigo (arquivo único, sem pasta) '
                    'e não tem Log em disco')
        try:
            with self._chat_lock():
                entries = []
                if os.path.exists(path):
                    with open(path, 'r', encoding='utf-8') as f:
                        entries = json.load(f)
                entries.append(entry)
                with open(path, 'w', encoding='utf-8') as f:
                    json.dump(entries, f, ensure_ascii=False, indent=2)
        except Exception as e:
            return str(e)
        return None

    def _save_chat_contexto(self, project_name, chat_id, items):
        """Grava o contexto.json do chat. Mesmo contrato do `_append_chat_log`:
        devolve o motivo de não ter gravado, ou `None`."""
        path = self._chat_extra_path(project_name, chat_id, 'contexto.json')
        if not path:
            return ('este chat é do formato antigo (arquivo único, sem pasta) '
                    'e não tem Contexto em disco')
        try:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(items, f, ensure_ascii=False, indent=2)
        except Exception as e:
            return str(e)
        return None

    def _chat_tem_log_em_disco(self, project_name, chat_id):
        """Se o Log deste chat existe. É o que permite não prometer o que não
        vai acontecer — ver o aviso de JSON inválido em `chat_mensagem.py`."""
        return bool(self._chat_extra_path(project_name, chat_id, 'log.json'))

    def load_chat_extras(self, project_name, chat_id):
        """Carrega log, contexto e estado de subagentes salvos do chat."""
        extras = {'success': True, 'log': [], 'contexto': [], 'subagentes': None}
        for nome, chave in (('log.json', 'log'), ('contexto.json', 'contexto'),
                            ('subagentes.json', 'subagentes')):
            path = self._chat_extra_path(project_name, chat_id, nome)
            if path and os.path.exists(path):
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        extras[chave] = json.load(f)
                except Exception:
                    pass
        return extras

    def save_chat_subagentes(self, project_name, chat_id, estado, max_rodadas, max_tokens=None):
        """Salva os toggles de subagentes, o máximo de rodadas e o teto de resposta.

        O teto está em TOKENS. A chave antiga `max_chars` (em caractere) não é
        lida: o número de lá significava outra coisa, e reaproveitá-lo daria um
        teto sete vezes maior sem ninguém pedir.
        """
        path = self._chat_extra_path(project_name, chat_id, 'subagentes.json')
        if not path:
            return {'success': False, 'error': 'chat sem pasta própria (formato antigo)'}
        try:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump({'estado': estado, 'max_rodadas': max_rodadas,
                           'max_tokens': max_tokens},
                          f, ensure_ascii=False, indent=2)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _load_chat_data(self, project_name, chat_id):
        path = self._chat_path(project_name, chat_id)
        if not os.path.exists(path):
            return {'id': chat_id, 'title': 'Novo chat',
                    'messages': [], 'created_at': datetime.now().isoformat()}
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _save_chat_data(self, project_name, chat_id, data):
        with open(self._chat_path(project_name, chat_id), 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    # ── Chat: API pública ─────────────────────────────────────────────────────
    def list_chats(self, project_name):
        chat_dir = self._chat_dir(project_name)
        chats = []
        for fname in os.listdir(chat_dir):
            fpath = os.path.join(chat_dir, fname)
            try:
                if os.path.isdir(fpath):
                    conversa = os.path.join(fpath, 'conversa.json')
                    if not os.path.exists(conversa):
                        continue
                    with open(conversa, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    chat_id = fname
                elif fname.endswith('.json'):
                    # Formato legado: chats/{id}.json
                    with open(fpath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    chat_id = data.get('id', fname[:-5])
                else:
                    continue
                chats.append({
                    'id': chat_id,
                    'title': data.get('title', 'Chat sem título'),
                    'created_at': data.get('created_at', ''),
                })
            except Exception:
                pass
        chats.sort(key=lambda x: x['created_at'], reverse=True)
        return {'success': True, 'chats': chats}

    def new_chat(self, project_name):
        # Pasta do chat nomeada pela data e hora de criação
        base_id = datetime.now().strftime('%Y-%m-%d %H-%M-%S')
        chat_id = base_id
        n = 2
        while os.path.isdir(self._chat_folder(project_name, chat_id)):
            chat_id = f'{base_id} ({n})'
            n += 1
        os.makedirs(self._chat_folder(project_name, chat_id))
        data = {
            'id': chat_id,
            'title': 'Novo chat',
            'messages': [],
            'created_at': datetime.now().isoformat()
        }
        self._save_chat_data(project_name, chat_id, data)
        return {'success': True, 'chat_id': chat_id}

    def load_chat(self, project_name, chat_id):
        try:
            data = self._load_chat_data(project_name, chat_id)
            return {
                'success': True,
                'messages': data.get('messages', []),
                'title': data.get('title', '')
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _chat_marcar_em_resposta(self, project_name, chat_id, ligado):
        """Registra qual chat está respondendo AGORA, para o `deletar_chat`.

        A TRAVA_IA sozinha não serve: ela diz que o Chat está ocupado, não
        QUAL chat. Um dicionário por projeto basta — a trava já garante que só
        há um por vez.
        """
        if not hasattr(self, '_chat_em_resposta'):
            self._chat_em_resposta = {}
        if ligado:
            self._chat_em_resposta[project_name] = chat_id
        elif self._chat_em_resposta.get(project_name) == chat_id:
            self._chat_em_resposta.pop(project_name, None)

    def _chat_esta_respondendo(self, project_name, chat_id):
        return getattr(self, '_chat_em_resposta', {}).get(project_name) == chat_id

    # ── A bandeira de parada ─────────────────────────────────────────────────
    # Os três estágios do botão "Parar" do Chat. Um dicionário por projeto+chat,
    # no mesmo molde de `_chat_em_resposta` logo acima — e pelo mesmo motivo:
    # a TRAVA_IA diz que o Chat está ocupado, não QUAL chat parar.
    #
    #   0 — ninguém pediu nada.
    #   1 — para no fim da rodada em voo. O que já foi pedido ao modelo termina,
    #       e o laço não abre outra rodada. É o 1º clique.
    #   2 — corta no meio: aborta os subagentes e fecha o stream. É o 2º clique.
    #
    # ⚠️ O estágio só SOBE. Um clique não desfaz o outro — quem já mandou cortar
    # não volta atrás, e "parar menos" não é uma ação que exista.
    PARADA_NENHUMA = 0
    PARADA_FIM_DA_RODADA = 1
    PARADA_AGORA = 2

    def _chat_parada_map(self):
        if not hasattr(self, '_chat_paradas'):
            self._chat_paradas = {}
        return self._chat_paradas

    def _chat_zerar_parada(self, project_name, chat_id):
        """Na largada de um envio. Sem isto, um Parar antigo mataria o próximo."""
        self._chat_parada_map().pop((project_name, chat_id), None)

    def _chat_subir_parada(self, project_name, chat_id):
        """Sobe um estágio e devolve o novo. É o que o clique do botão chama."""
        mapa = self._chat_parada_map()
        chave = (project_name, chat_id)
        mapa[chave] = min(mapa.get(chave, self.PARADA_NENHUMA) + 1, self.PARADA_AGORA)
        return mapa[chave]

    def _chat_estagio_de_parada(self, project_name, chat_id):
        return self._chat_parada_map().get((project_name, chat_id), self.PARADA_NENHUMA)

    def _chat_forcar_parada_imediata(self, project_name, chat_id):
        """Pula direto para o estágio 2 — usado ao FECHAR a aba do projeto.

        Diferente do clique normal do botão "Parar" (que sobe um estágio por
        vez, dando ao usuário a chance de só cortar no fim da rodada), fechar a
        aba é um gesto mais forte: o usuário já disse que quer aquele projeto
        fora, então vai direto ao corte imediato.
        """
        self._chat_parada_map()[(project_name, chat_id)] = self.PARADA_AGORA

    def deletar_chat(self, project_name, chat_id):
        try:
            # ⛔ Apagar um chat que está respondendo o RESSUSCITAVA, mutilado: o
            # worker ainda vivo gravava no fim, `_save_chat_data` caía no
            # formato legado (`chats/{id}.json`) e recriava o chat SEM PASTA —
            # e daí em diante `_append_chat_log` e `_save_chat_contexto`
            # voltavam em silêncio. O chat voltava sem Log, sem Contexto e sem
            # os toggles de subagente, para sempre.
            # ⛔ Nada de apagar arquivo para "limpar": recusar é o conserto.
            if self._chat_esta_respondendo(project_name, chat_id):
                return {'success': False,
                        'error': 'este chat está respondendo — espere a resposta '
                                 'terminar para removê-lo'}
            folder = self._chat_folder(project_name, chat_id)
            if os.path.isdir(folder):
                shutil.rmtree(folder)
            else:
                path = self._chat_path(project_name, chat_id)
                if os.path.exists(path):
                    os.remove(path)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def list_models(self):
        try:
            from .llm_cliente import abrir_cliente_do_lm_studio
            settings = self.load_settings()['settings']
            # max_retries=0: sem LM Studio, o SDK por padrão repetiria 2× com
            # backoff (timeout 2s cada) — ~10-15s travando a abertura da aba
            # Agentes, que faz este `await` antes de ligar os cards. Aqui a
            # falha é rápida (~2s) e só significa "LM Studio offline".
            client = abrir_cliente_do_lm_studio(settings, timeout=2.0, max_retries=0)
            models = client.models.list()
            lista = [m.id for m in models.data]
            # O modelo escolhido em Modelo e geração vai para a posição 0: o
            # Chat, a Fila e o Designer pegam sempre o primeiro da lista.
            from .llm_geracao import modelo_escolhido
            escolhido = modelo_escolhido(settings)
            if escolhido:
                lista = [escolhido] + [m for m in lista if m != escolhido]
            return {'success': True, 'models': lista}
        except Exception as e:
            return {'success': False, 'error': str(e), 'models': []}

    def carregar_prompt_fixo(self, nome, tela=PASTA_CHAT):
        """Lê o texto de um prompt fixo. O nome do arquivo É a chave.

        Os cinco prompts fixos agora moram em subpasta POR TELA
        (`Assistente/Chat/Prompts fixos/`, `Assistente/Fila/Prompts fixos/`),
        e por isso quem chama diz de qual tela está falando. O que NÃO mudou é
        a chave pública: `data-prompt-fixo="revisar"` continua sendo
        `revisar.txt`.

        A contenção contra caminho arbitrário vindo da tela mora agora em
        `obter_prompt_fixo`, junto do resto da montagem de caminho — e continua
        recusando barra, contrabarra e `..`.
        """
        prompt_path = obter_prompt_fixo(tela, nome)
        if prompt_path is None:
            return None
        try:
            with open(prompt_path, 'r', encoding='utf-8') as f:
                texto = f.read()
        except Exception:
            return None
        # O que as extensões ligadas acrescentam a este prompt fixo (fase 07,
        # D52): alvo `chat.revisar`, `fila.seguranca`… no marcador
        # {acrescimos_das_extensoes}, ou nada. `get_prompt_fixo` (a tela) e a
        # Fila passam os dois por aqui — a prévia e o envio não divergem.
        return aplicar_acrescimos(texto, acrescimos_de_prompt(
            self, '%s.%s' % (tela.lower(), nome))).strip()

    def get_prompt_fixo(self, nome, tela=PASTA_CHAT):
        content = self.carregar_prompt_fixo(nome, tela)
        if content is None:
            return {'success': False, 'error': f'Prompt fixo "{nome}" não encontrado'}
        return {'success': True, 'content': content, 'prompt': content}

    def debug_context_paths(self, context_paths):
        """Debug: verifica se os caminhos existem e são legíveis."""
        if not context_paths:
            return {'valid': [], 'invalid': [], 'total': 0}
        valid = []
        invalid = []
        for path in context_paths:
            if os.path.exists(path):
                valid.append(path)
            else:
                invalid.append(path)
        return {'valid': valid, 'invalid': invalid, 'total': len(context_paths)}
