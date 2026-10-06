"""Mexer num item da biblioteca: criar, formatar, apagar, marcar e ler.

Irmão de `arquivos.py`, pela regra que já separou `backups_reverter.py` e os
onze do Inspetor: **cada arquivo responde uma pergunta**. Lá a pergunta é *o que
a biblioteca TEM* — a gramática de item e grupo, o caminho de cada um, o
metadado e a listagem. Aqui é *como se MEXE num item*.

O corte não é de tamanho: os dois lados têm gatilhos diferentes. O de lá roda a
cada abertura da aba e é lido por quem investiga por que um item não aparece; o
daqui roda quando o usuário clica, e é lido por quem investiga por que um item
foi gravado errado.

⚠️ NADA AQUI VALE PARA `estilos-e-cores` NEM PARA `agentes`. As duas têm CRUD
próprio (`estilos_e_cores_crud.py` e `arquivos_agentes.py`), e o motivo está
escrito no cabeçalho de cada um: os itens da primeira são arquivos soltos numa
árvore de dimensões, e os da segunda têm a descrição no frontmatter, não num
`Descrição.md` ao lado. A guarda `_ARQUIVOS_SEM_CRUD_GENERICO` protege a
primeira em todo método público daqui — e não é teórica: a ponte pywebview expõe
`delete_arquivo_item` ao JavaScript, e um engano ali chamaria `shutil.rmtree`
numa dimensão inteira.

As constantes de categoria (`_ARQUIVOS_FOLDER`, `_ARQUIVOS_COM_ORIGEM`,
`_MCPS_DO_PROGRAMA`…) continuam declaradas em `arquivos.py`, que é onde a
gramática mora — aqui elas chegam por `self`, como em qualquer mixin.
"""

from .constantes import *


class ArquivosCrudMixin:

    _NOME_INVALIDO = set('\\/:*?"<>|')

    def create_arquivo_item(self, kind, item_name, description='', extra=None):
        """Cria um item novo (subpasta) na categoria, no formato certo."""
        if kind in self._ARQUIVOS_SEM_CRUD_GENERICO:
            return {'success': False, 'error': 'Categoria com caminho próprio.'}
        folder = self._ARQUIVOS_FOLDER.get(kind)
        if not folder:
            return {'success': False, 'error': 'Tipo inválido.'}
        item_name = (item_name or '').strip()
        if not item_name:
            return {'success': False, 'error': 'Informe um nome.'}
        if any(c in self._NOME_INVALIDO for c in item_name):
            return {'success': False, 'error': 'Nome inválido (evite \\ / : * ? " < > |).'}
        base = os.path.join(ARQUIVOS_DIR, folder)
        os.makedirs(base, exist_ok=True)
        extra = extra or {}
        description = (description or '').strip()
        if kind in self._ARQUIVOS_ITEM_DE_ARQUIVO:
            # Categoria em que o ARQUIVO é o item (Instruções base): nasce um
            # `.md` solto com o nome do item, e nada em volta — sem pasta, sem
            # `Descrição.md`. A cópia leva o arquivo para a raiz do projeto
            # com o nome que o assistente pede (`arquivo_de_entrada`).
            dest = os.path.join(base, f'{item_name}.md')
            if os.path.exists(dest):
                return {'success': False, 'error': 'Já existe um item com esse nome.'}
            try:
                with open(dest, 'w', encoding='utf-8') as f:
                    f.write(extra.get('conteudo') or description or '')
            except Exception as e:
                return {'success': False, 'error': str(e)}
            return {'success': True}
        dest = os.path.join(base, item_name)
        if os.path.isdir(dest):
            return {'success': False, 'error': 'Já existe um item com esse nome.'}
        try:
            os.makedirs(dest)
            if kind == 'regras-instrucoes':
                self._gravar_molde_regra(dest, item_name, description, extra)
            else:
                # A FOLHA, não o caminho: `item_name` pode vir agrupado
                # ("Arquitetura modular/... - MCP"), e o título do arquivo quer
                # dizer o NOME DO ITEM. O mesmo que `format_arquivo_item` faz.
                item_name_curto = item_name.rsplit('/', 1)[-1]
                with open(os.path.join(dest, self._ARQUIVOS_DESC_CANONICO), 'w', encoding='utf-8') as f:
                    f.write(f'# {item_name_curto}\n\n{description}\n')
                for src in (extra.get('files') or []):
                    if os.path.isfile(src):
                        shutil.copy2(src, os.path.join(dest, os.path.basename(src)))
            origem = extra.get('origem')
            if kind in self._ARQUIVOS_COM_ORIGEM and origem in ('programa', 'geral'):
                self.set_item_origem(kind, item_name, origem)
        except Exception as e:
            return {'success': False, 'error': str(e)}
        return {'success': True}

    def format_arquivo_item(self, kind, item_name, description='', extra=None):
        """Aplica descrição/origem/formato a uma subpasta que já existe (jogada na mão)."""
        if kind in self._ARQUIVOS_SEM_CRUD_GENERICO:
            return {'success': False, 'error': 'Categoria com caminho próprio.'}
        if kind == 'mcps' and item_name in self._MCPS_DO_PROGRAMA:
            return {'success': False, 'error':
                    'Este é um MCP do programa — não pode ser reconfigurado.'}
        folder = self._ARQUIVOS_FOLDER.get(kind)
        if not folder:
            return {'success': False, 'error': 'Tipo inválido.'}
        base = os.path.join(ARQUIVOS_DIR, folder, item_name)
        if not os.path.isdir(base):
            return {'success': False, 'error': 'Item não encontrado.'}
        extra = extra or {}
        description = (description or '').strip()
        try:
            if kind == 'regras-instrucoes':
                self._gravar_molde_regra(base, item_name, description, extra)
            else:
                with open(os.path.join(base, self._ARQUIVOS_DESC_CANONICO), 'w', encoding='utf-8') as f:
                    f.write(f'# {item_name}\n\n{description}\n')
            origem = extra.get('origem')
            if kind in self._ARQUIVOS_COM_ORIGEM and origem in ('programa', 'geral'):
                self.set_item_origem(kind, item_name, origem)
        except Exception as e:
            return {'success': False, 'error': str(e)}
        return {'success': True}

    def delete_arquivo_item(self, kind, item_name):
        """Remove um item da biblioteca (a subpasta em Arquivos/<Categoria>/)."""
        if kind in self._ARQUIVOS_SEM_CRUD_GENERICO:
            return {'success': False, 'error': 'Categoria com caminho próprio.'}
        if kind == 'mcps' and item_name in self._MCPS_DO_PROGRAMA:
            return {'success': False, 'error':
                    'Este é um MCP do programa — não pode ser removido.'}
        folder = self._ARQUIVOS_FOLDER.get(kind)
        if not folder:
            return {'success': False, 'error': 'Tipo inválido.'}
        path = self._arquivos_caminho_do_item(kind, item_name)
        if not path:
            return {'success': False, 'error': 'Item não encontrado.'}
        try:
            # Um item-arquivo é um arquivo só; `rmtree` nele levanta.
            if os.path.isfile(path):
                os.remove(path)
            else:
                shutil.rmtree(path)
            meta = self._arquivos_meta_load(kind)
            # As duas chaves: a nova (caminho) e a antiga (só o nome). A entrada
            # de um item que existia antes dos grupos está gravada no formato
            # velho e ficaria órfã se só a nova fosse removida.
            removidas = [c for c in (item_name, item_name.rsplit('/', 1)[-1]) if c in meta]
            for chave in removidas:
                meta.pop(chave, None)
            if removidas:
                with open(self._arquivos_meta_path(kind), 'w', encoding='utf-8') as f:
                    json.dump(meta, f, ensure_ascii=False, indent=2)
        except Exception as e:
            return {'success': False, 'error': str(e)}
        return {'success': True}

    # Onde o botão "copiar" entrega um código pronto. É o MESMO caminho que o
    # comando /codigo-pronto-extrair escreve, de propósito: o
    # /codigo-pronto-implementar procura num lugar só, não importa se o pacote
    # chegou ali pelo comando ou por este botão.
    _CODIGO_DEST = ('Saída dos comandos', 'Códigos prontos')

    def copy_codigo_pronto_to_project(self, project_name, name):
        """Copia um 'código pronto' INTEIRO (código + documentação) para o projeto."""
        src = os.path.join(ARQUIVOS_DIR, self._ARQUIVOS_FOLDER['codigos'], name)
        if not os.path.isdir(src):
            return {'success': False, 'error': 'Código pronto não encontrado.'}
        ws = self.load_workspace(project_name)
        config = ws.get('config', {})
        root_folder = config.get('root_folder')
        if not root_folder or not os.path.isdir(root_folder):
            return {'success': False, 'error': 'Configure a pasta raiz do projeto na aba Trabalho primeiro.'}
        dest = os.path.join(root_folder, *self._CODIGO_DEST, name)
        copied = 0
        try:
            os.makedirs(dest, exist_ok=True)
            for root, dirs, fnames in os.walk(src):
                rel = os.path.relpath(root, src)
                outdir = dest if rel == '.' else os.path.join(dest, rel)
                os.makedirs(outdir, exist_ok=True)
                for fn in fnames:
                    # O pacote vai inteiro — a documentação é o que o
                    # /codigo-pronto-implementar lê. Sem ela, o destino recebe
                    # código sem manual.
                    shutil.copy2(os.path.join(root, fn), os.path.join(outdir, fn))
                    copied += 1
        except Exception as e:
            return {'success': False, 'error': str(e)}
        if copied == 0:
            return {'success': False, 'error': 'Nada para copiar — o item está vazio.'}
        return {'success': True, 'dest': dest, 'count': copied}

    def pick_files(self):
        """Abre o diálogo do SO para escolher arquivos (usado ao criar código pronto)."""
        try:
            result = self.window.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=True)
            return {'success': True, 'files': list(result) if result else []}
        except Exception as e:
            return {'success': False, 'error': str(e), 'files': []}

    def set_item_origem(self, kind, item_name, origem):
        """Marca um item como 'programa' ou 'geral' no _meta.json da categoria."""
        if kind in self._ARQUIVOS_SEM_CRUD_GENERICO:
            return {'success': False, 'error': 'Categoria com caminho próprio.'}
        if kind == 'mcps' and item_name in self._MCPS_DO_PROGRAMA:
            return {'success': False, 'error':
                    'Este é um MCP do programa — não pode ser favoritado nem movido para Gerais.'}
        folder = self._ARQUIVOS_FOLDER.get(kind)
        if not folder:
            return {'success': False, 'error': 'Tipo inválido.'}
        if origem not in ('programa', 'geral'):
            return {'success': False, 'error': 'Origem inválida.'}
        base = os.path.join(ARQUIVOS_DIR, folder)
        os.makedirs(base, exist_ok=True)
        meta = self._arquivos_meta_load(kind)
        # Grava SEMPRE no formato novo (caminho) e apaga a entrada antiga do
        # mesmo item, para as duas não conviverem discordando.
        antiga = item_name.rsplit('/', 1)[-1]
        if antiga != item_name:
            meta.pop(antiga, None)
        entry = meta.setdefault(item_name, {})
        entry['origem'] = origem
        try:
            with open(self._arquivos_meta_path(kind), 'w', encoding='utf-8') as f:
                json.dump(meta, f, ensure_ascii=False, indent=2)
        except Exception as e:
            return {'success': False, 'error': str(e)}
        return {'success': True}

    def list_item_files(self, kind, item):
        """Lista os arquivos dentro de um item da biblioteca (preview)."""
        if kind in self._ARQUIVOS_SEM_CRUD_GENERICO:
            return {'success': False, 'error': 'Categoria com caminho próprio.'}
        folder = self._ARQUIVOS_FOLDER.get(kind)
        if not folder:
            return {'success': False, 'error': 'Tipo inválido.'}
        base = self._arquivos_caminho_do_item(kind, item)
        if not base:
            return {'success': False, 'error': 'Item não encontrado.'}
        # Item-arquivo: a lista tem um nome só, o do próprio arquivo.
        if os.path.isfile(base):
            return {'success': True, 'files': [os.path.basename(base)]}
        files = []
        for root, dirs, fnames in os.walk(base):
            dirs.sort()
            for fn in sorted(fnames):
                rel = os.path.relpath(os.path.join(root, fn), base).replace('\\', '/')
                files.append(rel)
        return {'success': True, 'files': files}

    def read_item_file(self, kind, item, filename):
        """Lê o conteúdo de um arquivo de um item da biblioteca (com validação de path)."""
        if kind in self._ARQUIVOS_SEM_CRUD_GENERICO:
            return {'success': False, 'error': 'Categoria com caminho próprio.'}
        folder = self._ARQUIVOS_FOLDER.get(kind)
        if not folder:
            return {'success': False, 'error': 'Tipo inválido.'}
        base = self._arquivos_caminho_do_item(kind, item)
        if not base:
            return {'success': False, 'error': 'Item não encontrado.'}
        # Item-arquivo: o único "arquivo dentro dele" é ele mesmo.
        if os.path.isfile(base):
            if filename != os.path.basename(base):
                return {'success': False, 'error': 'Arquivo não encontrado.'}
            target = base
        else:
            target = os.path.abspath(os.path.join(base, filename))
        if target != base and not target.startswith(base + os.sep):
            return {'success': False, 'error': 'Caminho inválido.'}
        if not os.path.isfile(target):
            return {'success': False, 'error': 'Arquivo não encontrado.'}
        try:
            with open(target, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
        except Exception as e:
            return {'success': False, 'error': str(e)}
        return {'success': True, 'content': content}

    # ── "Como adicionar": o texto mora em `prompts/Como adicionar/` ───────
    #
    # A sub-aba explica o formato de cada categoria e entrega o prompt que faz
    # uma IA produzir o item já nesse formato. O texto não mora no código nem em
    # `Arquivos/` (que é a biblioteca do usuário): mora em
    # `Program/Code/prompts/Como adicionar/`, uma pasta por sub-aba, com
    # `categoria.json` (ordem, ícone, destino, tabela, rótulos), `Explicação.md`,
    # os prompts em `.txt` e os guias longos em `Contrato/` e `Material de apoio/`.
    #
    # ⛔ "Como adicionar" NÃO é categoria da biblioteca: ela não entra em
    # `_ARQUIVOS_FOLDER`, não tem item, não se liga em projeto nenhum.
    _COMO_ADICIONAR_EXTENSOES_DE_TEXTO = ('.txt', '.md')

    def listar_como_adicionar(self):
        """Tudo o que a sub-aba Como adicionar mostra e copia, por categoria.

        A pasta É o conteúdo; sem ela a sub-aba diz que a pasta falta.

        Cada subpasta com `categoria.json` vira uma categoria — as outras são
        ignoradas. Os textos vão TODOS de uma vez (inclusive os guias longos):
        a tela copia no clique, e a área de transferência do WebView2 perde o
        gesto do usuário se o texto ainda tiver de vir do backend depois dele.

        Um `categoria.json` inválido não derruba as outras: aquela categoria
        volta com `erro` e a tela mostra o erro na sub-aba dela. A ordem é a do
        campo `ordem`, não a do disco.
        """
        base = obter_prompt_do_como_adicionar()
        if not os.path.isdir(base):
            return {'success': True, 'categorias': [], 'pasta': base}
        categorias = []
        try:
            for pasta in os.listdir(base):
                raiz = os.path.join(base, pasta)
                arquivo_da_categoria = os.path.join(raiz, 'categoria.json')
                if not os.path.isfile(arquivo_da_categoria):
                    continue
                categorias.append(self._como_adicionar_ler_categoria(pasta, raiz))
        except Exception as e:
            return {'success': False, 'categorias': [], 'error': str(e)}

        def _ordem(c):
            ordem = (c.get('categoria') or {}).get('ordem')
            return (ordem if isinstance(ordem, (int, float)) else float('inf'), c['pasta'].lower())
        categorias.sort(key=_ordem)
        return {'success': True, 'categorias': categorias}

    def _como_adicionar_ler_categoria(self, pasta, raiz):
        """Uma subpasta de `prompts/Como adicionar/`: o JSON, a explicação e os textos."""
        saida = {'pasta': pasta, 'categoria': None, 'explicacao': '', 'textos': {}, 'erro': None}
        try:
            with open(os.path.join(raiz, 'categoria.json'), 'r', encoding='utf-8') as f:
                categoria = json.load(f)
            if not isinstance(categoria, dict):
                raise ValueError('o topo precisa ser um objeto {…}')
            saida['categoria'] = categoria
        except Exception as e:
            saida['erro'] = 'categoria.json: %s' % e
        # Todo `.txt`/`.md` da pasta e das subpastas, com o caminho relativo à
        # pasta da categoria (sempre com `/`) como chave — é o que o
        # `categoria.json` cita.
        for atual, _dirs, arquivos in os.walk(raiz):
            for nome in arquivos:
                if not nome.lower().endswith(self._COMO_ADICIONAR_EXTENSOES_DE_TEXTO):
                    continue
                caminho = os.path.join(atual, nome)
                chave = os.path.relpath(caminho, raiz).replace(os.sep, '/')
                try:
                    with open(caminho, 'r', encoding='utf-8', errors='replace') as f:
                        texto = f.read()
                except Exception:
                    continue
                if chave == 'Explicação.md':
                    saida['explicacao'] = texto
                else:
                    saida['textos'][chave] = texto
        return saida
