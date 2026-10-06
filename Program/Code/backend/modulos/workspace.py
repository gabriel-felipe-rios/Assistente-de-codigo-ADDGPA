from .constantes import *


class WorkspaceMixin:

    # ── Workspace ─────────────────────────────────────────────────────────────
    def load_workspace(self, project_name):
        path = obter_arquivo_de_workspace(project_name)
        default = {
            'root_folder': None,
            'working_folders': [],
            'ignore_list': [],
            'context_items': [],
            'main_file': None,
            # Qual preset do Acervo (Configurações → Acervo) este projeto usa —
            # ver `regras.py::_acervo_pastas`. `None` = nenhum escolhido ainda,
            # e a aba Acervo aparece vazia até o usuário escolher um. Não há
            # migração de projeto antigo aqui: quem já tinha as 3 pastas fixas
            # de antes da Obra 6 as encontra de volta no preset "Padrão", em
            # Configurações → Acervo, e escolhe ele explicitamente.
            'acervo_preset_ativo': None,
        }
        if not os.path.exists(path):
            return {'success': True, 'config': default}
        try:
            with open(path, 'r', encoding='utf-8') as f:
                config = json.load(f)
            # Migra formato antigo (strings) para objetos
            normalized = []
            for item in config.get('ignore_list', []):
                if isinstance(item, str):
                    normalized.append({'path': item, 'type': 'folder', 'recursive': True})
                else:
                    normalized.append(item)
            config['ignore_list'] = normalized
            # Migra o nome antigo do MCP único ("MCP do Vibe-Coding") para o
            # novo nome do servidor Assistente — a divisão em dois servidores
            # (Assistente/Trabalhos) renomeou o item na biblioteca. Sem isto,
            # todo projeto que já tinha o MCP ligado perderia a ativação em
            # silêncio (o item antigo não existe mais em `Arquivos/MCPs/`).
            mcps = config.get('activated', {}).get('mcps')
            if isinstance(mcps, list) and 'MCP do Vibe-Coding' in mcps:
                mcps[:] = ['Assistente' if m == 'MCP do Vibe-Coding' else m for m in mcps]
            return {'success': True, 'config': config}
        except Exception as e:
            return {'success': False, 'error': str(e), 'config': default}

    def save_workspace(self, project_name, config):
        """Grava o Workspace.json MESCLANDO sobre o que já está no disco.

        ⚠️ MESCLA, E NÃO SUBSTITUI — é o mesmo defeito, e a mesma cura, de
        `configuracoes.py::save_settings_parcial`. O frontend guarda UMA cópia
        global do workspace (`workspaceConfig`, carregada no `loadWorkspace()`
        de quando o projeto abriu) e a manda de volta inteira em cada uma das
        27 chamadas de `saveWorkspace()`. Toda chave que o BACKEND gravou
        depois disso — `acervo_preset_ativo`, `inicio_rapido`,
        `assistente_externo` — não está nessa cópia, e a substituição a apagava
        em silêncio: bastava marcar o arquivo principal depois de escolher um
        preset do Acervo para a escolha sumir do disco, e a aba Acervo voltava
        a aparecer vazia sem erro nenhum.

        Mesclar é seguro porque nenhuma tela REMOVE chave do workspace — as
        cinco que o frontend edita (`root_folder`, `working_folders`,
        `ignore_list`, `context_items`, `main_file`) sempre chegam com valor, e
        "desligar" é `None`/`[]`, não a ausência da chave.
        """
        path = obter_arquivo_de_workspace(project_name)
        try:
            # A pasta `Projeto/` pode nao existir ainda: um projeto recem-criado
            # nasce com a pasta raiz vazia, e este e' o primeiro a gravar nela.
            os.makedirs(os.path.dirname(path), exist_ok=True)
            atual = {}
            if os.path.exists(path):
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        lido = json.load(f)
                    if isinstance(lido, dict):
                        atual = lido
                except Exception:
                    # Arquivo corrompido não pode impedir a gravação: segue como
                    # se estivesse vazio, e o que chegou agora vira o conteúdo.
                    atual = {}
            atual.update(config or {})
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(atual, f, ensure_ascii=False, indent=2)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}
