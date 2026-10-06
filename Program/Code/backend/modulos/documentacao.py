import os
import json

from .caminhos import obter_pasta_da_rotina


class DocumentacaoMixin:

    def _doc_build_tree(self, root, base):
        nodes = []
        try:
            entries = sorted(os.scandir(root), key=lambda e: (not e.is_dir(), e.name.lower()))
            for entry in entries:
                # O `_` só protege na raiz da rotina (D33).
                if entry.name.startswith('_') and root == base:
                    continue
                rel = os.path.relpath(entry.path, base)
                if entry.is_dir():
                    children = self._doc_build_tree(entry.path, base)
                    if children:
                        nodes.append({'type': 'folder', 'name': entry.name, 'path': rel, 'children': children})
                elif entry.name.endswith('.md'):
                    nodes.append({'type': 'file', 'name': entry.name, 'path': rel})
        except Exception:
            pass
        return nodes

    def ler_arquivo_de_codigo(self, project_name, caminho_relativo):
        """Conteúdo cru do arquivo de código que originou um documento.

        Serve o botão "Caminho + código" da barra do viewer: o usuário abre a
        documentação de um arquivo e leva pro chat o arquivo de verdade, não o
        resumo dele.

        `caminho_relativo` chega da tela na forma que a Doc. Técnica grava
        (`Program/Code/frontend/x.js`, com o nome da pasta de trabalho na
        frente). Quem resolve isso pro caminho absoluto é
        `_inspetor_resolver_absoluto` — que também é a contenção: só devolve
        caminho de dentro de uma pasta de trabalho, então `..` não escapa.
        """
        try:
            caminho = self._inspetor_resolver_absoluto(project_name, caminho_relativo)
            if not caminho:
                return {'success': False,
                        'error': 'Arquivo não encontrado nas pastas de trabalho.'}
            with open(caminho, 'r', encoding='utf-8', errors='replace') as f:
                return {'success': True, 'content': f.read()}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # As oito rotinas que a aba Documentação sabe exibir e buscar — oito das
    # quinze que existem. ⚠️ O Duplicados fica de fora de propósito: a saída
    # dele é um índice em SQLite, não uma árvore de `.md` para navegar. Quem o
    # mostra é a aba Análise → Duplicados.
    #
    # ⚠️ Isto NÃO é mais uma allowlist de segurança: quem contém o `escopo` é o
    # mapa de `caminhos.py`, que só produz caminho para id conhecido. O papel
    # daqui é outro — dizer QUAIS fontes esta aba oferece. Sem ela, pedir
    # `escopo='hashes'` seria aceito e devolveria lista vazia sem erro.
    #
    # Já foi allowlist, e antes disso nem isso: qualquer escopo diferente de
    # 'resumo-pastas' era colapsado em 'espelho', o que fazia a busca devolver
    # o resultado do Espelho (retirado em 2026-09) fingindo ser o da fonte
    # pedida.
    _DOC_FONTES = ('resumo-pastas', 'documentacao-tecnica',
                   'glossario', 'indice-navegacao', 'pipeline', 'bibliotecas',
                   'comentarios')

    def search_doc_content(self, project_name, query, escopo='documentacao-tecnica', max_results=20):
        """Busca literal no conteúdo dos .md de uma das fontes de `_DOC_FONTES`."""
        try:
            if escopo not in self._DOC_FONTES:
                return {'success': False,
                        'error': f'Fonte de documentação desconhecida: {escopo}'}
            base_dir = obter_pasta_da_rotina(project_name, escopo)
            if not os.path.isdir(base_dir):
                return {'success': True, 'results': []}
            q = query.lower()
            results = []
            for root, dirs, files in os.walk(base_dir):
                dirs[:] = [d for d in dirs if not (d.startswith('_') and root == base_dir)]
                for fname in files:
                    if not fname.endswith('.md'):
                        continue
                    fpath = os.path.join(root, fname)
                    rel   = os.path.relpath(fpath, base_dir).replace('\\', '/')
                    try:
                        with open(fpath, 'r', encoding='utf-8') as f:
                            content = f.read()
                        idx = content.lower().find(q)
                        if idx == -1:
                            continue
                        start   = max(0, idx - 80)
                        end     = min(len(content), idx + len(query) + 80)
                        excerpt = ('...' if start > 0 else '') + content[start:end].strip() + ('...' if end < len(content) else '')
                        results.append({'doc_path': rel,
                                        'tipo': escopo, 'excerpt': excerpt})
                    except Exception:
                        pass
            return {'success': True, 'results': results[:max_results]}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def search_embeddings(self, project_name, query, tipo='documentacao-tecnica', top_k=8):
        try:
            import numpy as np
            from .agentes import embedding_store as _store
            from .agentes import embedding_store_migracao as _migracao
            if tipo not in ('documentacao-tecnica', 'resumo-pastas'):
                return {'success': False, 'error': f'Tipo de busca inválido: {tipo}'}
            _migracao.migrate_json_tree(project_name)
            rotulo = {'documentacao-tecnica': 'por arquivo',
                      'resumo-pastas': 'por pasta'}.get(tipo, tipo)

            matriz, meta = _store.load_matrix(project_name, tipo)
            if matriz.shape[0] == 0:
                return {
                    'success': True,
                    'results': [],
                    'message': f'Nenhum embedding ({rotulo}) encontrado. Execute o agente Embedding Semântico primeiro.'
                }

            query_vec, emb_err = self._emb_embed_text(query)
            if query_vec is None:
                return {'success': False, 'error': emb_err or 'Erro ao gerar embedding da query.'}

            qvec = np.asarray(query_vec, dtype=np.float32)
            qn = np.linalg.norm(qvec)
            if qn > 1e-9:
                qvec = qvec / qn

            scores = matriz @ qvec  # matriz já vem normalizada do store
            # ⚠️ DEDUPLICA POR ARQUIVO, e DEPOIS de pontuar. Com o índice
            # fatiado são N linhas por arquivo: um `.md` de quatro pedaços
            # viraria quatro resultados iguais na tela. Pontuar primeiro é o que
            # faz sobrar o MELHOR pedaço de cada arquivo — e é daí que vem o
            # brinde da etapa: o trecho mostrado passa a ser o que casou com a
            # busca, não os primeiros 500 caracteres do arquivo.
            #
            # O corte é `top_k` DEPOIS da dedup: cortar antes deixaria oito
            # pedaços de dois arquivos no lugar de oito arquivos.
            order = np.argsort(-scores)
            results = []
            vistos = set()
            for i in order:
                m = meta[int(i)]
                rel = m['source_file']  # caminho .md relativo à fonte (com '/')
                if rel in vistos:
                    continue
                vistos.add(rel)
                results.append({
                    'doc_path': rel,
                    'tipo': tipo,
                    'score': float(scores[int(i)]),
                    'excerpt': m.get('excerpt', ''),
                    'pedaco': m.get('pedaco', ''),
                    'source_file': rel,
                })
                if len(results) >= top_k:
                    break
            return {'success': True, 'tipo': tipo, 'results': results}
        except Exception as e:
            return {'success': False, 'error': str(e)}
