"""Arquivos grandes demais para o orçamento de contexto (aba Agentes → Erros).

Determinístico: percorre as pastas de trabalho, mede os tokens de cada arquivo
de código e lista os que não caberiam nem numa chamada com prompt vazio — ou
seja, arquivos que os agentes vão pular por serem grandes demais. A saída serve
de aviso para o usuário refatorar esses arquivos.
"""

import os

from modulos.tokens import contar_tokens, calcular_orcamento


class ArquivosGrandesMixin:

    def get_arquivos_grandes(self, project_name):
        try:
            workspace = self.load_workspace(project_name)
            if not workspace.get('success'):
                return {'success': False, 'error': 'Workspace não carregado.'}
            config = workspace['config']
            folders = config.get('working_folders', []) or []
            ignore_list = config.get('ignore_list', []) or []
            if not folders:
                return {'success': True, 'arquivos': [], 'limite': 0}

            limites = self.load_limites()['limites']
            orc = calcular_orcamento(limites, prompt='', esqueleto='')
            # Teto mais generoso possível (prompt vazio). Um arquivo acima disto
            # não cabe em NENHUMA chamada de agente.
            limite_tokens = orc['sobra_tokens']

            # As extensões moram em `Rotinas/Configuração.json`, não no
            # `Projeto/Workspace.json`.
            # Lendo do workspace, a chave nunca existia e isto caía sempre no
            # padrão de fábrica — a aba nunca examinava o que o usuário ligou.
            rotinas = self.load_rotinas_config(project_name)['config']
            ext_set = self._ext_set_da_rotina(rotinas['doc-tecnica'].get('extensions'))
            grandes = []
            for folder in folders:
                if not os.path.isdir(folder):
                    continue
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
                        if os.path.splitext(fname)[1].lower() not in ext_set:
                            continue
                        try:
                            with open(fpath, 'r', encoding='utf-8', errors='replace') as f:
                                content = f.read()
                        except Exception:
                            continue
                        tks = contar_tokens(content)
                        if tks > limite_tokens:
                            grandes.append({
                                'file': fpath,
                                'nome': fname,
                                'linhas': content.count('\n') + 1,
                                'tokens': tks,
                                'limite': limite_tokens,
                            })

            grandes.sort(key=lambda x: x['tokens'], reverse=True)
            return {
                'success': True,
                'arquivos': grandes,
                'limite': limite_tokens,
                'janela': limites.get('janela_contexto'),
                'exata': orc.get('exata', False),
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}
