from .constantes import *


class InspetorTrechosMixin:
    """Caminhos e leitura de trechos de arquivo pro Inspetor: converte o
    caminho absoluto de um candidato no caminho de exibição (e de volta), e lê
    as linhas em volta de uma linha-alvo."""

    def _inspetor_caminho_relativo(self, project_name, caminho):
        """Caminho de exibição do candidato. **Inclui o nome da pasta de
        trabalho** (ex.: `Program/Code/frontend/index.html`, não `frontend/index.html`):
        a IA externa (Claude Code) costuma rodar na RAIZ do projeto, um nível
        acima da pasta de trabalho, então o caminho precisa do nome dela pra ser
        colável direto, sem o usuário ter que adicionar a subpasta na mão.
        `_inspetor_resolver_absoluto` tolera as duas formas ao ler de volta."""
        try:
            workspace = self.load_workspace(project_name)
            if workspace.get('success'):
                for folder in workspace['config'].get('working_folders', []):
                    if os.path.normcase(caminho).startswith(os.path.normcase(folder)):
                        rel = os.path.relpath(caminho, folder)
                        return os.path.join(os.path.basename(folder.rstrip('\\/')), rel).replace('\\', '/')
        except Exception:
            pass
        return caminho

    def _inspetor_ler_linha(self, caminho, linha):
        try:
            with open(caminho, 'r', encoding='utf-8', errors='ignore') as f:
                for i, texto in enumerate(f, 1):
                    if i == linha:
                        return texto.strip()
        except Exception:
            pass
        return ''

    def _inspetor_resolver_absoluto(self, project_name, caminho):
        """Resolve o caminho de um candidato de volta pro absoluto no disco.
        Tolera relativo com ou sem o nome da pasta de trabalho no início
        (`Program/Code/frontend/x` ou `frontend/x`), com `/` ou `\\`, e caminho já
        absoluto. Retorna None se não achar em nenhuma working_folder."""
        try:
            if os.path.isabs(caminho) and os.path.isfile(caminho):
                return caminho
            workspace = self.load_workspace(project_name)
            if not workspace.get('success'):
                return None
            rel = caminho.replace('/', os.sep).replace('\\', os.sep).lstrip(os.sep)
            partes = rel.split(os.sep)
            sem_topo = os.sep.join(partes[1:]) if len(partes) > 1 else rel
            for folder in workspace['config'].get('working_folders', []):
                for tentativa in (
                    os.path.join(folder, rel),                      # folder + "frontend/x"
                    os.path.join(os.path.dirname(folder), rel),     # pai + "Program/Code/frontend/x"
                    os.path.join(folder, sem_topo),                 # folder + "frontend/x" (rel tinha o topo)
                ):
                    if os.path.isfile(tentativa):
                        return tentativa
        except Exception:
            pass
        return None

    def inspetor_ler_trecho(self, project_name, caminho_relativo, linha, contexto=4):
        """Lê algumas linhas em volta de `linha` pra exibição expandível na
        aba Inspetor — sob demanda (só quando o usuário expande o candidato
        na sub-aba Enviar para IA), não pré-carregado pra cada candidato."""
        try:
            caminho_absoluto = self._inspetor_resolver_absoluto(project_name, caminho_relativo)
            if not caminho_absoluto:
                return {'success': False, 'error': (
                    'Arquivo não encontrado no workspace — o índice pode estar '
                    'desatualizado. Regenere-o na aba Análise → Índice de Símbolos.')}

            with open(caminho_absoluto, 'r', encoding='utf-8', errors='ignore') as f:
                linhas = f.readlines()

            inicio = max(1, linha - contexto)
            fim = min(len(linhas), linha + contexto)
            trecho = [
                {'numero': i, 'texto': linhas[i - 1].rstrip('\n')}
                for i in range(inicio, fim + 1)
            ]
            return {'success': True, 'trecho': trecho, 'linha_alvo': linha}
        except Exception as e:
            return {'success': False, 'error': str(e)}
