from .constantes import *
from .constantes import _validate_name


class ProjetosMixin:

    # ── Projetos ──────────────────────────────────────────────────────────────
    def list_projects(self):
        os.makedirs(PROJECTS_DIR, exist_ok=True)
        return sorted(
            [e for e in os.listdir(PROJECTS_DIR)
             if os.path.isdir(os.path.join(PROJECTS_DIR, e))],
            key=str.lower
        )

    def create_project(self, name):
        try:
            if not name:
                return {'success': False, 'error': 'Nome não pode ser vazio.'}
            name = name.strip()
            err = _validate_name(name)
            if err:
                return {'success': False, 'error': err}
            os.makedirs(PROJECTS_DIR, exist_ok=True)
            path = os.path.join(PROJECTS_DIR, name)
            if os.path.exists(path):
                return {'success': False, 'error': 'Já existe um projeto com esse nome.'}
            os.makedirs(path)
            if not os.path.isdir(path):
                return {'success': False, 'error': f'Pasta não foi criada: {path}'}
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def importar_pasta_como_projeto(self, folder_path, preset_nome=None, preparar=False):
        """Cria o projeto E grava a pasta raiz num passo só.

        Existe porque `create_project` só cria a pasta em `Files/projects/`: a
        raiz era gravada depois, pelo frontend, mutando o `workspaceConfig` e
        chamando `save_workspace`. Arrastar uma pasta precisa das duas coisas
        juntas — e, se a segunda falhasse, sobraria um projeto vazio apontando
        para lugar nenhum.

        `nome_livre` no erro de colisão é o que deixa a tela reabrir o modal de
        Novo Projeto já preenchido, em vez de só recusar (D8).
        """
        folder_path = (folder_path or '').strip()
        if not folder_path or not os.path.isdir(folder_path):
            return {'success': False, 'error': 'Isso não é uma pasta.'}

        name = os.path.basename(os.path.normpath(folder_path))
        err = _validate_name(name)
        if err:
            return {'success': False, 'error': err, 'nome_sugerido': name, 'corrigir': True}
        if os.path.isdir(os.path.join(PROJECTS_DIR, name)):
            return {'success': False, 'error': 'Já existe um projeto com esse nome.',
                    'nome_sugerido': name, 'corrigir': True}

        r = self.create_project(name)
        if not r.get('success'):
            return dict(r, nome_sugerido=name, corrigir=True)

        config = self.load_workspace(name).get('config', {})
        config['root_folder'] = folder_path
        if preset_nome:
            config['preset_preparar'] = preset_nome
        rw = self.save_workspace(name, config)
        if not rw.get('success'):
            # Projeto sem raiz é pior do que projeto nenhum: a tela inteira
            # depende dela. Desfaz a pasta recém-criada e devolve o erro.
            try:
                shutil.rmtree(os.path.join(PROJECTS_DIR, name))
            except Exception:
                pass
            return {'success': False, 'error': rw.get('error') or 'Não deu para gravar a pasta raiz.'}

        res = {'success': True, 'name': name, 'root_folder': folder_path}
        if preparar:
            res['preparar'] = self.preparar_projeto(name, preset_nome)
        return res

    def rename_project(self, old_name, new_name):
        new_name = new_name.strip()
        err = _validate_name(new_name)
        if err:
            return {'success': False, 'error': err}
        src = os.path.join(PROJECTS_DIR, old_name)
        dst = os.path.join(PROJECTS_DIR, new_name)
        if not os.path.isdir(src):
            return {'success': False, 'error': 'Projeto não encontrado.'}
        if os.path.exists(dst):
            return {'success': False, 'error': 'Já existe um projeto com esse nome.'}
        try:
            os.rename(src, dst)
            # Melhor esforço, de propósito: os dois JSONs de
            # grupos/tags/descrição são chaveados pelo nome da pasta, e o
            # rename já aconteceu — uma falha aqui não pode desfazer o rename
            # nem impedir a tela de seguir em frente (mesma regra de
            # `goBackToProjects`: nada que só sincroniza metadado tem o
            # direito de travar a ação principal).
            self._renomear_projeto_na_taxonomia(old_name, new_name)
            self._renomear_descricao_projeto(old_name, new_name)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def deletar_projeto(self, name):
        path = os.path.join(PROJECTS_DIR, name)
        if not os.path.isdir(path):
            return {'success': False, 'error': 'Projeto não encontrado.'}
        try:
            shutil.rmtree(path)
            self._remover_projeto_da_taxonomia(name)
            self._remover_descricao_projeto(name)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}
