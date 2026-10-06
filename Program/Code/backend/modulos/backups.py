"""Aba Backups — a configuração da aba, a lista de Versões e a criação delas.

Uma **Versão** é uma lista de `(caminho relativo → hash)`, em duas metades:
**Código** (as pastas de trabalho) e **Documentação** (o que o programa gerou
dentro de `Files/projects/{Projeto}/`). O conteúdo mora uma vez só em
`arquivos/`, e quem cuida disso é `versoes.py`. A reversão mora em
`backups_reverter.py`, e o diff em `backups_diff.py`.

⚠️ O BUG QUE ABRIU TUDO: este módulo **não lê `config['ignore_list']`**, e não
pode voltar a ler. Aquela lista é a "Remover" da aba Projeto, e existe para
tirar arquivo do **contexto e da análise**. O backup pegava carona nela e vinha
perdendo em silêncio `Program/External`, `Program/Internal`, o modelo de
embedding e toda a configuração do usuário. O backup tem **a lista dele**, que
mora em `Files/backups/{Projeto}/configuracao.json` e se edita na sub-aba
Configuração — e em lugar nenhum mais.

⚠️ NÃO É GIT. Sem `subprocess`, sem `.git`, sem biblioteca de versionamento. O
id `tab-git` da aba é herdado e fica; a palavra "commit" não aparece na tela.
"""

from .constantes import *
from . import versoes
from . import backups_diff
from .agentes.trava_ia import TRAVA_IA, TravaOcupada, DONO_BACKUP


# ── O que a metade "Documentação" pode levar ─────────────────────────────────
# Um interruptor por linha, TODOS ligados de fábrica. `mapa=True` marca as
# partes que alimentam o Mapa da mudança — são as que ganham ◆ na tela.
#
# O caminho é relativo a `Files/projects/{Projeto}/`. Pasta termina em `/`.
PARTES_DA_DOCUMENTACAO = [
    {'id': 'hashes',              'rotulo': 'Hashes',                    'mapa': True},
    {'id': 'grafo-imports',       'rotulo': 'Grafo de Imports',          'mapa': True},
    {'id': 'pipeline',            'rotulo': 'Pipeline',                  'mapa': True},
    {'id': 'doc-tecnica',         'rotulo': 'Documentação Técnica',      'mapa': False},
    {'id': 'resumo-pastas',       'rotulo': 'Resumo de Pastas',          'mapa': False},
    {'id': 'glossario',           'rotulo': 'Glossário',                 'mapa': False},
    {'id': 'indice-navegacao',    'rotulo': 'Índice de Navegação',       'mapa': False},
    {'id': 'identificadores',     'rotulo': 'Índice de Identificadores', 'mapa': False},
    {'id': 'bibliotecas',         'rotulo': 'Bibliotecas',               'mapa': False},
    {'id': 'embedding',           'rotulo': 'Embedding Semântico',       'mapa': False},
    {'id': 'indice-de-simbolos',  'rotulo': 'Índice de Símbolos',        'mapa': True},
    {'id': 'assistente',          'rotulo': 'Assistente (chats, Fila, Designer)', 'mapa': False},
    {'id': 'configuracao',        'rotulo': 'Configuração do projeto',   'mapa': False},
]

# Os três que o modal "Fazer cópia" exige. Os três são parser puro — NENHUM
# chama o modelo —, e é por isso que o único botão de ação pode ser "Gerar o
# que falta e copiar" em vez de oferecer copiar assim mesmo.
PRE_REQUISITOS = ('hashes', 'grafo-imports', 'indice-de-simbolos')


class BackupsMixin:
    """Listar, configurar e criar Versões. Reverter mora no módulo irmão."""

    # ── Configuração da aba ──────────────────────────────────────────────────

    def _bk_configuracao_padrao(self):
        return {
            'exclusoes': [],
            'documentacao': {p['id']: True for p in PARTES_DA_DOCUMENTACAO},
            # ⚠️ Isto NÃO muda o que a cópia guarda — a cópia leva tudo, sempre.
            # É só como o arquivo grande APARECE no Mapa da mudança. Nasceu do
            # `index.db` do Embedding Semântico: 9,6 MB de binário que, medido
            # como qualquer outro arquivo, vira um quadrado gigante e engole o
            # desenho inteiro.
            'grandes': {
                'limiar_mb': 2,
                'modo': 'teto',      # 'teto' | 'fora'
                'teto_por_cento': 12,
            },
        }

    def carregar_configuracao_do_backup(self, project_name):
        """A lista de exclusões e os interruptores — SÓ do backup.

        Mora em `Files/backups/{Projeto}/configuracao.json`, longe do
        `Workspace.json` de propósito: guardar as duas listas no mesmo arquivo
        é o convite para uma voltar a ler a outra.
        """
        config = self._bk_configuracao_padrao()
        try:
            path = obter_arquivo_de_configuracao_do_backup(project_name)
            if os.path.exists(path):
                with open(path, encoding='utf-8') as f:
                    dados = json.load(f)
                if isinstance(dados.get('exclusoes'), list):
                    config['exclusoes'] = dados['exclusoes']
                for chave, valor in (dados.get('documentacao') or {}).items():
                    if chave in config['documentacao']:
                        config['documentacao'][chave] = bool(valor)
                for chave, valor in (dados.get('grandes') or {}).items():
                    if chave in config['grandes']:
                        config['grandes'][chave] = valor
        except Exception:
            pass
        return {'success': True, 'configuracao': config,
                'partes': PARTES_DA_DOCUMENTACAO}

    def salvar_configuracao_do_backup(self, project_name, configuracao):
        try:
            path = obter_arquivo_de_configuracao_do_backup(project_name)
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(configuracao or self._bk_configuracao_padrao(), f,
                          ensure_ascii=False, indent=2)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── A lista de exclusões ─────────────────────────────────────────────────

    def _bk_esta_excluido(self, caminho, exclusoes):
        """A exclusão é SEMPRE recursiva: pasta na lista = tudo abaixo dela.

        Sem alternância de escopo, de propósito. "Ignorar no backup" responde
        uma pergunta só — *isto entra na cópia?* —, e meia pasta dentro de uma
        Versão é o tipo de coisa que só se descobre na hora de restaurar.
        """
        for item in exclusoes or []:
            alvo = (item.get('path') or '') if isinstance(item, dict) else str(item)
            if not alvo:
                continue
            if caminho == alvo or caminho.startswith(alvo + os.sep):
                return True
        return False

    def _bk_dentro_das_versoes(self, caminho):
        """Blindagem contra recursão: a pasta de backups nunca entra na cópia."""
        return caminho == BACKUPS_DIR or caminho.startswith(BACKUPS_DIR + os.sep)

    def _bk_listar(self, raiz, exclusoes):
        """Todos os caminhos relativos sob `raiz`, menos o que a lista tirou.

        A poda é in-place em `dirs[:]`: cortar a pasta no `os.walk` evita
        descer numa `node_modules` inteira só para descartar arquivo por
        arquivo depois.
        """
        achados = []
        if not raiz or not os.path.isdir(raiz):
            return achados
        for root, dirs, files in os.walk(raiz):
            dirs[:] = [d for d in dirs
                       if not self._bk_dentro_das_versoes(os.path.join(root, d))
                       and not self._bk_esta_excluido(os.path.join(root, d), exclusoes)]
            for nome in files:
                caminho = os.path.join(root, nome)
                if self._bk_dentro_das_versoes(caminho):
                    continue
                if self._bk_esta_excluido(caminho, exclusoes):
                    continue
                achados.append(os.path.relpath(caminho, raiz))
        return achados

    # ── Onde cada parte da documentação mora ─────────────────────────────────

    def _bk_raiz_da_parte(self, project_name, id_parte):
        """O caminho absoluto de uma parte da documentação, ou None se não há."""
        if id_parte == 'indice-de-simbolos':
            return obter_arquivo_de_indice_de_simbolos(project_name)
        if id_parte == 'assistente':
            return obter_pasta_de_dados(project_name, PASTA_ASSISTENTE)
        if id_parte == 'configuracao':
            return obter_pasta_de_dados(project_name, PASTA_PROJETO)
        try:
            return obter_pasta_da_rotina(project_name, id_parte)
        except Exception:
            return None

    def _bk_listar_documentacao(self, project_name, ligadas, exclusoes=None):
        """`{caminho relativo à pasta do projeto: True}` do que entra na Versão.

        A configuração da aba Automação (`Acionamentos.json` e
        `Configuração.json`) entra junto de `configuracao`, porque é a mesma
        natureza: escolha do usuário, não artefato gerado.

        ⚠️ `exclusoes` vale AQUI TAMBÉM, e não só no Código. A lista "Ignorar no
        backup" promete, com todas as letras, dizer "o que fica de fora de cada
        cópia" — e uma lista que valesse só metade faria a "Cópia completa" ter
        efeito em um lado e não no outro, além de mostrar no Mapa arquivos que a
        próxima cópia não guardaria.
        """
        base = obter_pasta_de_dados(project_name)
        exclusoes = exclusoes or []
        rels = []

        def entra(caminho):
            return (not self._bk_dentro_das_versoes(caminho)
                    and not self._bk_esta_excluido(caminho, exclusoes))

        for parte in PARTES_DA_DOCUMENTACAO:
            if not ligadas.get(parte['id'], True):
                continue
            raiz = self._bk_raiz_da_parte(project_name, parte['id'])
            if not raiz or not entra(raiz):
                continue
            if os.path.isfile(raiz):
                rels.append(os.path.relpath(raiz, base))
            elif os.path.isdir(raiz):
                for root, dirs, files in os.walk(raiz):
                    dirs[:] = [d for d in dirs if entra(os.path.join(root, d))]
                    for nome in files:
                        caminho = os.path.join(root, nome)
                        if entra(caminho):
                            rels.append(os.path.relpath(caminho, base))
        if ligadas.get('configuracao', True):
            for extra in (obter_arquivo_de_acionamentos(project_name),
                          obter_arquivo_de_configuracao_das_rotinas(project_name),
                          obter_arquivo_de_pendencias_das_rotinas(project_name)):
                if os.path.isfile(extra) and entra(extra):
                    rels.append(os.path.relpath(extra, base))
        return sorted(set(rels))

    # ── Listar as Versões ────────────────────────────────────────────────────

    def _bk_cartao(self, project_name, versao):
        """O objeto que o cartão da sub-aba Versões consome."""
        codigo = versao.get('codigo') or {}
        documentacao = versao.get('documentacao') or {}
        return {
            'id': versao.get('id', ''),
            'criada_em': versao.get('criada_em', ''),
            'anotacao': versao.get('anotacao', ''),
            'tipo': versao.get('tipo', 'manual'),   # 'manual' | 'seguranca'
            'completa': bool(versao.get('completa')),
            'codigo': {
                'arquivos': len(codigo),
                'pastas': len({os.path.dirname(c) or '.' for c in codigo}),
            },
            'documentacao': {
                'arquivos': len(documentacao),
                'pastas': len({os.path.dirname(c) or '.' for c in documentacao}),
                'rotinas': sorted({c.split('/')[2] for c in documentacao
                                   if c.startswith(PASTA_AUTOMACAO + '/'
                                                   + PASTA_ROTINAS + '/')
                                   and c.count('/') > 2}),
            },
            'tamanho': versoes.tamanho_da_versao(project_name, versao),
        }

    def listar_versoes(self, project_name):
        try:
            lista = versoes.carregar_versoes(project_name)
            return {'success': True,
                    'versoes': [self._bk_cartao(project_name, v) for v in lista],
                    'tamanho_no_disco': versoes.tamanho_no_disco(project_name)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── O que o modal "Fazer cópia" mostra antes de copiar ───────────────────

    def resumo_para_copiar(self, project_name):
        """Assíncrono: varrer o projeto e hashear mil arquivos demora.

        Antes isto era síncrono, e o modal só aparecia depois de tudo pronto —
        era a "interface lentinha" do teste. Agora o modal abre na hora com o
        esqueleto e recebe o conteúdo por `bkAoResumoPronto`.
        """
        def worker():
            r = self._resumo_para_copiar_sync(project_name)
            # `project` no payload: o front ignora o evento quando este
            # projeto não é o exibido no momento (várias abas abertas).
            r = {**r, 'project': project_name}
            self.window.evaluate_js('bkAoResumoPronto(%s)' % json.dumps(r))
        threading.Thread(target=worker, daemon=True).start()
        return {'started': True, 'trava': TRAVA_IA.estado()}

    def _resumo_para_copiar_sync(self, project_name):
        """O que mudou desde a última cópia + o estado dos três pré-requisitos.

        Os três que travam a cópia — Hashes, Grafo de Imports e Índice de
        Símbolos — são parser puro. Nenhum deles chama o modelo, e é por isso
        que faltar não é um impasse: dá para gerar na hora. Por isso não existe
        "copiar assim mesmo": a Versão sem eles nasce cega, sem Mapa e sem
        saber o que mudou para a próxima.

        ⚠️ UMA VARREDURA SÓ. A versão anterior percorria cada pasta de trabalho
        duas vezes — uma com a lista de exclusões e outra sem — só para montar
        os dois números do "Cópia completa". Agora a passada é única e a lista
        decide, arquivo a arquivo, em qual dos dois totais ele entra.
        """
        try:
            config = self.carregar_configuracao_do_backup(project_name)['configuracao']
            ultima = (versoes.carregar_versoes(project_name) or [None])[0]
            exclusoes = config['exclusoes']

            mapa_agora = {}
            com_lista = sem_lista = 0
            for rotulo, raiz in self._bk_raizes_de_codigo(project_name):
                for rel in self._bk_listar(raiz, []):
                    absoluto = os.path.join(raiz, rel)
                    try:
                        tamanho = os.path.getsize(absoluto)
                    except OSError:
                        tamanho = 0
                    sem_lista += tamanho
                    if self._bk_esta_excluido(absoluto, exclusoes):
                        continue
                    com_lista += tamanho
                    mapa_agora[self._bk_chave(rotulo, rel)] = \
                        versoes.hash_do_conteudo(absoluto)

            codigo = backups_diff.resumir(backups_diff.comparar_mapas(
                project_name, (ultima or {}).get('codigo'), mapa_agora,
                com_contagem=False))

            base = obter_pasta_de_dados(project_name)
            mapa_doc = {}
            doc_com_lista = doc_sem_lista = 0
            for rel in self._bk_listar_documentacao(project_name,
                                                    config['documentacao']):
                absoluto = os.path.join(base, rel)
                try:
                    doc_sem_lista += os.path.getsize(absoluto)
                except OSError:
                    pass
                mapa_doc[rel.replace(os.sep, '/')] = versoes.hash_do_conteudo(absoluto)
            doc_com_lista = doc_sem_lista
            for rel in self._bk_listar_documentacao(project_name,
                                                    config['documentacao'], []):
                if rel.replace(os.sep, '/') in mapa_doc:
                    continue
                try:
                    doc_sem_lista += os.path.getsize(os.path.join(base, rel))
                except OSError:
                    pass

            documentacao = backups_diff.resumir(backups_diff.comparar_mapas(
                project_name, (ultima or {}).get('documentacao'), mapa_doc,
                com_contagem=False))

            return {'success': True,
                    'codigo': codigo,
                    'documentacao': documentacao,
                    'pre_requisitos': self._bk_pre_requisitos(project_name),
                    'trava': TRAVA_IA.estado(),
                    'tamanhos': {
                        'com_a_lista': com_lista + doc_com_lista,
                        'completa': sem_lista + doc_sem_lista,
                        'fora_da_copia': max(
                            0, (sem_lista + doc_sem_lista) - (com_lista + doc_com_lista)),
                    }}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _bk_pre_requisitos(self, project_name):
        """Quais dos três já existem em disco. Nenhum deles chama o modelo."""
        estado = []
        for id_parte in PRE_REQUISITOS:
            raiz = self._bk_raiz_da_parte(project_name, id_parte)
            rotulo = next(p['rotulo'] for p in PARTES_DA_DOCUMENTACAO
                          if p['id'] == id_parte)
            estado.append({'id': id_parte, 'rotulo': rotulo,
                           'esta_pronto': bool(raiz and os.path.exists(raiz))})
        return estado

    # ── As pastas de trabalho ────────────────────────────────────────────────

    def _bk_raizes_de_codigo(self, project_name):
        """`(rótulo, caminho absoluto)` de cada pasta de trabalho.

        A pasta de trabalho vai **inteira**. A raiz do projeto fica de fora —
        decisão do usuário, e é o que a sub-aba Configuração informa.
        """
        ws = self.load_workspace(project_name)
        config = ws.get('config', {}) if ws.get('success') else {}
        raizes = []
        vistos = {}
        for pasta in (config.get('working_folders') or []):
            if not pasta:
                continue
            nome = os.path.basename(pasta.rstrip('\\/')) or 'raiz'
            # Duas pastas de trabalho com o mesmo nome final existem; o sufixo
            # mantém as duas separadas dentro da Versão.
            vistos[nome] = vistos.get(nome, 0) + 1
            if vistos[nome] > 1:
                nome = '%s (%d)' % (nome, vistos[nome])
            raizes.append((nome, pasta))
        return raizes

    def _bk_chave(self, rotulo, rel):
        return '%s/%s' % (rotulo, rel.replace(os.sep, '/'))

    # ── Criar a Versão ───────────────────────────────────────────────────────

    def criar_versao(self, project_name, anotacao='', tipo='manual', completa=False):
        """Assíncrono: copiar demora, e a interface não pode congelar.

        Avisa o front por `evaluate_js` — `bkAoTerminarCopia` ou `bkAoFalhar`.
        """
        def worker():
            r = self._criar_versao_sync(project_name, anotacao, tipo, completa)
            # `project` no payload/argumento: o front ignora o evento quando
            # este projeto não é o exibido no momento (várias abas abertas).
            if r.get('success'):
                self.window.evaluate_js('bkAoTerminarCopia(%s)'
                                        % json.dumps({**r['versao'], 'project': project_name}))
            else:
                self.window.evaluate_js('bkAoFalhar(%s, %s)'
                                        % (json.dumps(project_name), json.dumps(r.get('error', 'erro'))))
        threading.Thread(target=worker, daemon=True).start()
        return {'started': True}

    def _criar_versao_sync(self, project_name, anotacao='', tipo='manual',
                           completa=False):
        base = obter_pasta_de_dados(project_name)
        if not os.path.isdir(base):
            return {'success': False, 'error': 'Projeto não encontrado.'}
        try:
            # `esperar=False`: é clique de gente na frente da tela. Recusar aqui
            # é honesto — o botão fica desabilitado com o motivo escrito ao lado.
            with TRAVA_IA.ocupar(DONO_BACKUP, projeto=project_name, esperar=False):
                return self._bk_montar_versao(project_name, anotacao, tipo, completa)
        except TravaOcupada as ocupada:
            return {'success': False,
                    'error': (ocupada.estado or {}).get('motivo', 'há tarefa rodando'),
                    'ocupado': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _bk_montar_versao(self, project_name, anotacao, tipo, completa):
        config = self.carregar_configuracao_do_backup(project_name)['configuracao']
        # "Cópia completa" ignora a lista de exclusões e leva tudo.
        exclusoes = [] if completa else config['exclusoes']

        codigo = {}
        for rotulo, raiz in self._bk_raizes_de_codigo(project_name):
            rels = self._bk_listar(raiz, exclusoes)
            guardado = versoes.guardar(project_name, raiz, rels)
            for rel, hash_ in guardado.items():
                codigo[self._bk_chave(rotulo, rel)] = hash_

        base = obter_pasta_de_dados(project_name)
        rels_doc = self._bk_listar_documentacao(project_name, config['documentacao'],
                                                exclusoes)
        documentacao = versoes.guardar(project_name, base, rels_doc)

        versao = {
            'id': versoes.proximo_id(project_name),
            'criada_em': datetime.now().isoformat(timespec='seconds'),
            'anotacao': (anotacao or '').strip(),
            'tipo': tipo,
            'completa': bool(completa),
            'codigo': codigo,
            'documentacao': documentacao,
            'excluidos': [(i.get('path') if isinstance(i, dict) else i)
                          for i in exclusoes],
        }
        versoes.acrescentar_versao(project_name, versao)
        return {'success': True, 'versao': self._bk_cartao(project_name, versao)}

    # ── Excluir e abrir ──────────────────────────────────────────────────────

    def excluir_versao(self, project_name, versao_id):
        """Tira a Versão da lista e recolhe o conteúdo que ficou sem dono.

        A poda tem de olhar TODAS as Versões que sobraram, não a que saiu: o
        mesmo hash costuma ser referenciado por várias, e apagar pelo que a
        excluída citava corromperia as outras.
        """
        try:
            if not versoes.carregar_versao(project_name, versao_id):
                return {'success': False, 'error': 'Versão não encontrada.'}
            versoes.remover_versao(project_name, versao_id)
            return {'success': True, 'limpeza': versoes.apagar_orfaos(project_name)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def abrir_pasta_das_versoes(self, project_name):
        alvo = obter_pasta_de_backups(project_name)
        if not os.path.isdir(alvo):
            return {'success': False, 'error': 'Pasta não encontrada.'}
        try:
            os.startfile(alvo)  # Windows
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def onde_as_versoes_ficam(self, project_name):
        """A árvore e os totais do último bloco da sub-aba Configuração."""
        lista = versoes.carregar_versoes(project_name)
        soma_solta = sum(versoes.tamanho_da_versao(project_name, v) for v in lista)
        no_disco = versoes.tamanho_no_disco(project_name)
        return {
            'success': True,
            'pasta': obter_pasta_de_backups(project_name),
            'versoes': len(lista),
            'no_disco': no_disco,
            'economizado': max(0, soma_solta - no_disco),
        }
