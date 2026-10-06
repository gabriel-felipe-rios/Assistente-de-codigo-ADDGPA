from ...constantes import *
from ...versoes import hash_do_conteudo


class HashesMixin:
    """Agente determinístico de hashes — a base da regeneração incremental.

    Guarda o md5 do conteúdo de cada arquivo de código num único JSON, com
    caminho relativo à pasta de trabalho. Quem quiser saber o que mudou desde a
    última geração chama `get_arquivos_mudados`.

    Um dado, um lugar: só existe `hashes.json`. A árvore que a aba mostra é
    montada em memória por `get_hashes_tree` — nunca persistida em paralelo,
    porque duas cópias dessincronizam e não dá para saber qual está certa.

    O hash é do conteúdo, não do mtime: salvar sem alterar nada não deve
    disparar regeneração.
    """

    # ── Caminhos e persistência ───────────────────────────────────────────────

    def _hs_dir(self, project_name):
        return obter_pasta_da_rotina(project_name, 'hashes')

    def _hs_path(self, project_name):
        return os.path.join(self._hs_dir(project_name), 'hashes.json')

    def _hs_load(self, project_name):
        try:
            path = self._hs_path(project_name)
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                if isinstance(data.get('arquivos'), dict):
                    return data
        except Exception:
            pass
        return {'gerado_em': None, 'arquivos': {}}

    def _hs_save(self, project_name, arquivos):
        path = self._hs_path(project_name)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        data = {'gerado_em': datetime.now().isoformat(), 'arquivos': arquivos}
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        # _resumo.json no mesmo padrão dos outros agentes, para o Acionamentos
        # conseguir ler o finished_at.
        with open(os.path.join(self._hs_dir(project_name), '_resumo.json'), 'w', encoding='utf-8') as f:
            json.dump({'finished_at': data['gerado_em'], 'arquivos': len(arquivos)},
                      f, ensure_ascii=False, indent=2)
        return data

    def _hs_hash_arquivo(self, path):
        """Delega a `versoes.hash_do_conteudo` — o md5 tem uma implementação só.

        A rotina Hashes e o backup precisam concordar sobre o que mudou; duas
        cópias do mesmo algoritmo é o jeito mais curto de fazê-los discordar.
        """
        return hash_do_conteudo(path)

    # ── Varredura ─────────────────────────────────────────────────────────────

    def _hs_scan(self, project_name, rehash_apenas=None, anterior=None):
        """Percorre as pastas de trabalho e devolve {chave: {raiz, hash}}.

        A chave é `pasta-de-trabalho/caminho/relativo` — sobrevive a mover o
        projeto de lugar. `raiz` desambigua arquivos de mesmo nome vindos de
        pastas de trabalho diferentes.

        ⚠️ Sem filtro de extensão: o Hashes é a porteira de TODO o ciclo, não
        um agente da Doc. Técnica. Filtrar aqui pela lista dela fazia um
        arquivo `.ps1` alterado passar despercebido pelo ciclo inteiro. Cada
        agente continua filtrando o que processa, com a lista dele.

        `rehash_apenas` (caminhos absolutos) relê do disco só esses arquivos e
        reaproveita o hash salvo dos demais — é o caminho da Espera, que já
        sabe quem mudou. A varredura em si continua completa: é ela que revela
        arquivo novo e arquivo removido, e custa um `stat`, não uma leitura.
        """
        workspace = self.load_workspace(project_name)
        if not workspace.get('success'):
            return None

        config = workspace['config']
        working_folders = config.get('working_folders', [])
        ignore_list = config.get('ignore_list', [])

        reaproveitar = anterior if anterior is not None else {}
        apenas = None
        if rehash_apenas is not None:
            apenas = {os.path.normcase(os.path.abspath(p)) for p in rehash_apenas}

        arquivos = {}
        for folder in working_folders:
            if not os.path.isdir(folder):
                continue
            raiz = os.path.basename(folder.rstrip(os.sep)) or folder
            for root, dirs, files in os.walk(folder):
                if self._caminho_ignorado(root, ignore_list):
                    dirs.clear()
                    continue
                dirs[:] = [d for d in dirs
                           if not self._caminho_ignorado(os.path.join(root, d), ignore_list)]
                for fname in sorted(files):
                    fpath = os.path.join(root, fname)
                    if self._caminho_ignorado(fpath, ignore_list):
                        continue
                    rel = os.path.relpath(fpath, folder).replace('\\', '/')
                    chave = f'{raiz}/{rel}'
                    if apenas is not None and os.path.normcase(os.path.abspath(fpath)) not in apenas:
                        salvo = reaproveitar.get(chave, {}).get('hash')
                        if salvo is not None:
                            # Não mudou e já tem hash: não relê o arquivo.
                            arquivos[chave] = {'raiz': raiz, 'hash': salvo}
                            continue
                        # Sem hash salvo é arquivo novo — esse tem que ser lido,
                        # mesmo não estando na lista da Espera.
                    arquivos[chave] = {
                        'raiz': raiz,
                        'hash': self._hs_hash_arquivo(fpath),
                    }
        return arquivos

    def _hs_abs_path(self, project_name, chave):
        """Converte a chave relativa de volta em caminho absoluto."""
        workspace = self.load_workspace(project_name)
        if not workspace.get('success'):
            return None
        for folder in workspace['config'].get('working_folders', []):
            raiz = os.path.basename(folder.rstrip(os.sep)) or folder
            if chave.startswith(raiz + '/'):
                return os.path.join(folder, chave[len(raiz) + 1:].replace('/', os.sep))
        return None

    # ── API pública ───────────────────────────────────────────────────────────

    def _hs_notify(self, project_name, payload):
        # `project` no payload: o front ignora o evento quando este projeto
        # não é o exibido no momento (várias abas de projeto abertas).
        payload = {**payload, 'project': project_name}
        try:
            self.window.evaluate_js('hashesAgentProgress(%s)' % json.dumps(payload))
        except Exception:
            pass

    def run_hashes_agent(self, project_name, caminhos=None):
        """Regrava o hashes.json.

        `caminhos` (absolutos) é a lista que a Espera acumulou: relê só esses
        do disco. Sem ela, relê tudo — é o caso do botão manual e da abertura
        do projeto, em que não se sabe o que mudou.

        ⚠️ Isto REGRAVA a linha de base, e é o passo do ciclo. O botão
        "Verificar" do card não passa por aqui — ver `verificar_hashes`.
        """
        def worker():
            try:
                self._hs_notify(project_name, {'status': 'running'})
                anterior = self._hs_load(project_name)['arquivos']
                arquivos = self._hs_scan(project_name, rehash_apenas=caminhos,
                                         anterior=anterior)
                if arquivos is None:
                    raise ValueError('Workspace não carregado.')
                mudados = sum(1 for k, v in arquivos.items()
                              if anterior.get(k, {}).get('hash') != v['hash'])
                self._hs_save(project_name, arquivos)
                self._hs_notify(project_name, {'status': 'done', 'total': len(arquivos),
                                 'mudados': mudados})
            except Exception as e:
                self._hs_notify(project_name, {'status': 'error', 'error': str(e)})

        # A referência da thread fica registrada: é o que deixa o ciclo
        # saber que esta rotina continua viva (ver processando.py).
        self._proc_iniciar(project_name, 'hashes', worker)
        return {'success': True}

    # ── Os dois botões do card ────────────────────────────────────────────────
    #
    # Até esta obra havia um só, "▶ Executar", e ele fazia duas coisas de uma
    # vez: mostrava "N arquivos mudaram" e **regravava a linha de base no mesmo
    # clique** — apagando, no ato, a informação que acabava de mostrar. Clicar
    # duas vezes seguidas dava "N mudaram" e depois "0 mudaram", sobre um disco
    # onde nada tinha acontecido entre os dois cliques.
    #
    # Agora são dois verbos separados:
    #
    #   · **Verificar**             — olha e relata. Não escreve nada.
    #   · **Verificar e processar** — olha, relata e chama o ciclo com os
    #                                 caminhos que achou.
    #
    # ⚠️ Quem regrava a linha de base continua sendo o FIM DE UM CICLO COMPLETO
    # (`_ac_run_cycle_now`), e só se ele chegar ao fim. Regravá-la aqui traria
    # de volta o defeito que esta separação existe para consertar.

    def _hs_verificar(self, project_name):
        """A conta de "o que está diferente da linha de base", sem escrever nada."""
        diff = self.get_arquivos_mudados(project_name)
        if not diff.get('success'):
            raise ValueError(diff.get('error') or 'Workspace não carregado.')
        return {
            'baseline': diff.get('baseline', False),
            'total': diff.get('total', 0),
            'mudados': list(diff.get('mudados') or []),
            'removidos': list(diff.get('removidos') or []),
        }

    def verificar_hashes(self, project_name, processar=False):
        """Botão "Verificar" (e, com `processar=True`, "Verificar e processar").

        Roda em thread própria — a varredura relê o conteúdo do projeto inteiro
        e travaria a ponte do pywebview num projeto grande —, e devolve o
        resultado pelo mesmo canal de progresso que o card já escuta.

        ⚠️ NÃO passa por `_proc_iniciar`, e é de propósito: aquilo registra a
        thread da ROTINA `hashes`, e o ciclo a consulta para saber se ela ainda
        está viva. Uma verificação registrada ali faria o ciclo seguinte tomar
        esta thread pela rotina dele.
        """
        def worker():
            try:
                self._hs_notify(project_name, {'status': 'running'})
                r = self._hs_verificar(project_name)
                aviso = None
                if processar:
                    # O ciclo relê só o que mudou; sem lista, relê tudo.
                    aviso = self._ac_run_cycle_now(
                        project_name, caminhos=r['mudados'] or None)
                self._hs_notify(project_name, {'status': 'verificado', 'processar': processar,
                                 'aviso': aviso, 'baseline': r['baseline'],
                                 'total': r['total'],
                                 'mudados': len(r['mudados']),
                                 'removidos': len(r['removidos'])})
            except Exception as e:
                self._hs_notify(project_name, {'status': 'error', 'error': str(e)})

        threading.Thread(target=worker, daemon=True,
                         name='hashes:verificar').start()
        return {'success': True}

    def get_hashes_status(self, project_name):
        data = self._hs_load(project_name)
        return {
            'success': True,
            'existe': bool(data['arquivos']),
            'gerado_em': data['gerado_em'],
            'total': len(data['arquivos']),
        }

    def get_arquivos_mudados(self, project_name):
        """Caminhos absolutos dos arquivos cujo conteúdo mudou desde a última
        geração de hashes. É o que a Doc Técnica usa para pular o que
        não mudou.

        Sem baseline salvo, devolve `baseline=False` — quem chama deve tratar
        como "processar tudo", não como "nada mudou".
        """
        salvos = self._hs_load(project_name)['arquivos']
        atuais = self._hs_scan(project_name)
        if atuais is None:
            return {'success': False, 'error': 'Workspace não carregado.'}
        if not salvos:
            # `removidos` vem vazio, mas vem: sem a chave, quem consome quebra
            # ou lê como "não sei", e não é isso — sem baseline não há removido.
            return {'success': True, 'baseline': False, 'mudados': [],
                    'removidos': [], 'total': len(atuais)}

        mudados = []
        for chave, info in atuais.items():
            if salvos.get(chave, {}).get('hash') != info['hash']:
                abs_path = self._hs_abs_path(project_name, chave)
                if abs_path:
                    mudados.append(abs_path)
        removidos = [k for k in salvos if k not in atuais]
        return {
            'success': True,
            'baseline': True,
            'mudados': mudados,
            'removidos': removidos,
            'total': len(atuais),
        }

    def get_hashes_tree(self, project_name):
        """Árvore de pastas montada na hora a partir do JSON único.

        Nada disso é persistido — é só uma visão do mesmo dado. Para 500
        arquivos leva milissegundos.
        """
        data = self._hs_load(project_name)
        salvos = data['arquivos']
        atuais = self._hs_scan(project_name) or {}

        def novo_no(nome):
            return {'nome': nome, 'pastas': {}, 'arquivos': []}

        raiz = novo_no('')
        for chave in sorted(set(salvos) | set(atuais)):
            partes = chave.split('/')
            no = raiz
            for parte in partes[:-1]:
                if parte not in no['pastas']:
                    no['pastas'][parte] = novo_no(parte)
                no = no['pastas'][parte]

            h_salvo = salvos.get(chave, {}).get('hash')
            h_atual = atuais.get(chave, {}).get('hash')
            if h_salvo is None:
                estado = 'novo'
            elif h_atual is None:
                estado = 'removido'
            elif h_salvo != h_atual:
                estado = 'mudou'
            else:
                estado = 'igual'

            no['arquivos'].append({
                'nome': partes[-1],
                'hash': (h_atual or h_salvo or '')[:8],
                'estado': estado,
            })

        def serializar(no):
            return {
                'nome': no['nome'],
                'pastas': [serializar(p) for _, p in sorted(no['pastas'].items())],
                'arquivos': no['arquivos'],
            }

        return {'success': True, 'gerado_em': data['gerado_em'],
                'arvore': serializar(raiz)}
