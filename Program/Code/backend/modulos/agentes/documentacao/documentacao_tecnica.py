from ...constantes import *
from ..resumo_de_rotina import gravar_resumo_de_falha
from modulos.agentes.llm_estruturado import formato_garantido_indisponivel
from modulos.tokens import contar_tokens, calcular_orcamento, PortaoDeContexto
from .documentacao_tecnica_agente import DocumentacaoTecnicaAgenteMixin


# Este arquivo era 592 linhas e virou dois, pelo teto de 500 da AMF:
#
#   documentacao_tecnica.py         a prévia, o estado incremental e o status
#   documentacao_tecnica_agente.py  a rotina rodando
class DocumentacaoTecnicaMixin(DocumentacaoTecnicaAgenteMixin):
    """A documentação de cada arquivo: síntese, atribuições, metadados, termos e
    cada símbolo com assinatura, linha e frase.

    Regra central do projeto, aplicada aqui de forma estrita: **o programa monta
    o `.md`; o LLM só escreve as frases**. Nome, tipo e número de linha vêm do
    tree-sitter e nunca passam pela resposta do modelo — por isso não há como ele
    inventar um símbolo ou errar uma linha.

    Disso saem três consequências:
      * o formato do arquivo é sempre válido, sem deriva;
      * o incremental fica trivial — quando só a linha mudou, o programa
        reescreve o número sem chamar o modelo;
      * o conferente vira rede de segurança em vez de defesa principal.
    """

    # Um prompt só (D32): arquivo sem símbolos é o caso da lista vazia. O da
    # costura junta as partes do arquivo que não coube numa chamada.
    _DT_PROMPT = 'documentacao-tecnica'
    _DT_PROMPT_COSTURA = 'documentacao-tecnica-costura'

    # ── Preview ───────────────────────────────────────────────────────────────

    def preview_documentacao_tecnica_agent(self, project_name, extensions=None):
        try:
            workspace = self.load_workspace(project_name)
            if not workspace['success']:
                return {'success': False, 'error': 'Workspace não carregado.'}
            config = workspace['config']
            working_folders = config.get('working_folders', [])
            ignore_list = config.get('ignore_list', [])
            ext_set = self._ext_set_da_rotina(extensions)

            out_base = self._dt_out_base(project_name)
            files = []
            ignored = []
            for folder in working_folders:
                if not os.path.isdir(folder): continue
                folder_name = os.path.basename(folder.rstrip(os.sep)) or folder
                for root, dirs, fnames in os.walk(folder):
                    if self._caminho_ignorado(root, ignore_list):
                        ignored.append({'path': os.path.relpath(root, folder), 'folder': folder_name, 'kind': 'folder', 'reason': 'ignored'})
                        dirs.clear()
                        continue
                    dirs[:] = [d for d in dirs if not self._caminho_ignorado(os.path.join(root, d), ignore_list)]
                    for fname in sorted(fnames):
                        fpath = os.path.join(root, fname)
                        rel = os.path.relpath(fpath, folder)
                        if self._caminho_ignorado(fpath, ignore_list):
                            ignored.append({'path': rel, 'folder': folder_name, 'kind': 'file', 'reason': 'ignored'})
                            continue
                        ext = os.path.splitext(fname)[1].lower()
                        if ext not in ext_set:
                            ignored.append({'path': rel, 'folder': folder_name, 'kind': 'file', 'reason': 'ext'})
                            continue
                        try:
                            with open(fpath, 'r', encoding='utf-8', errors='replace') as f:
                                raw = f.read()
                            lines_count = raw.count('\n') + (1 if raw and not raw.endswith('\n') else 0)
                            tokens_est = contar_tokens(raw)
                        except Exception:
                            lines_count = 0
                            tokens_est = 0
                        # Pelo caminho relativo, não pelo nome: dois arquivos de
                        # mesmo nome em subpastas diferentes têm .md diferentes.
                        md_path = os.path.join(out_base, folder_name, rel + '.md')
                        processed = os.path.isfile(md_path)
                        files.append({'path': rel, 'folder': folder_name, 'lines': lines_count, 'tokens': tokens_est, 'processed': processed})
            return {'success': True, 'files': files, 'ignored': ignored}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Estado incremental (hash do corpo de cada símbolo) ────────────────────

    def _dt_out_base(self, project_name):
        return obter_pasta_da_rotina(project_name, 'documentacao-tecnica')

    def _dt_estado_path(self, project_name):
        return os.path.join(self._dt_out_base(project_name), '_simbolos.json')

    def _dt_load_estado(self, project_name):
        try:
            path = self._dt_estado_path(project_name)
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                if isinstance(data, dict):
                    return data
        except Exception:
            pass
        return {}

    def _dt_save_estado(self, project_name, estado):
        try:
            path = self._dt_estado_path(project_name)
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(estado, f, ensure_ascii=False)
        except Exception:
            pass

    # ── Execução ──────────────────────────────────────────────────────────────

    def _dt_notify(self, project_name, payload):
        # A batida vem PRIMEIRO: e ela que segura o ciclo de pe.
        self._proc_apply(project_name, 'doc-tecnica', payload)
        # `project` no payload: o front ignora o evento quando este projeto
        # não é o exibido no momento (várias abas de projeto abertas).
        payload = {**payload, 'project': project_name}
        try:
            self.window.evaluate_js('documentacaoTecnicaAgentProgress(%s)' % json.dumps(payload))
        except Exception:
            pass

    def _dt_falhou(self, project_name, motivo):
        """Avisa a tela E grava o `_resumo.json` da falha — ver resumo_de_rotina.py."""
        gravar_resumo_de_falha(project_name, 'doc-tecnica', motivo)
        self._dt_notify(project_name, {'status': 'error', 'error': motivo})


    # ── Status ────────────────────────────────────────────────────────────────

    def get_documentacao_tecnica_status(self, project_name):
        base = self._dt_out_base(project_name)
        if not os.path.isdir(base):
            return {'success': True, 'exists': False}
        resumo = {}
        try:
            with open(os.path.join(base, '_resumo.json'), 'r', encoding='utf-8') as f:
                resumo = json.load(f)
        except Exception:
            pass
        for root, dirs, files in os.walk(base):
            for f in files:
                if f.endswith('.md'):
                    return {'success': True, 'exists': True, 'resumo': resumo}
        return {'success': True, 'exists': False}
