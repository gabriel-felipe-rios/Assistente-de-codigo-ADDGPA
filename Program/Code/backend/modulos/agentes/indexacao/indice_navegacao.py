import re as _re

from ...constantes import *


class IndiceNavegacaoMixin:
    """Índice de navegação — o índice de livro, e sem nenhuma chamada de LLM.

    Substitui a metade do antigo agente Índice que alucinava. O defeito de lá
    não era o prompt: ele pedia "funções e métodos principais" recebendo o
    resumo-de-pastas, que é prosa e não contém nenhum nome de função. Sem ter de
    onde tirar, o modelo preenchia com plausível — foi assim que nasceram
    `AnaliseMixin.apply()` e `ChatMixin.session()`, que não existem no código.

    Aqui não há o que inventar: a descrição de cada arquivo já foi escrita pela
    Documentação Técnica, e este agente só a recolhe e organiza em árvore.
    Instantâneo, sempre correto, e atualiza junto com a doc técnica — que é
    incremental.
    """

    # `# caminho/arquivo.py` na primeira linha do .md da doc técnica.
    _IN_TITULO = _re.compile(r'^#\s+(.+?)\s*$')

    def _in_dir(self, project_name):
        return obter_pasta_da_rotina(project_name, 'indice-navegacao')

    def _in_doc_base(self, project_name):
        return obter_pasta_da_rotina(project_name, 'documentacao-tecnica')

    def _in_notify(self, project_name, payload):
        # `project` no payload: o front ignora o evento quando este projeto
        # não é o exibido no momento (várias abas de projeto abertas).
        payload = {**payload, 'project': project_name}
        try:
            self.window.evaluate_js('indiceNavegacaoAgentProgress(%s)' % json.dumps(payload))
        except Exception:
            pass

    @staticmethod
    def _in_extrair_descricao(texto):
        """Primeira frase útil do .md da doc técnica.

        Prefere a primeira frase da `## Síntese` (D18). Documento antigo, sem
        Síntese: a descrição geral (arquivos sem símbolo) e, não havendo, a
        descrição do primeiro símbolo, que é o melhor resumo disponível.
        """
        linhas = texto.splitlines()
        if '## Síntese' in linhas:
            j = linhas.index('## Síntese') + 1
            sintese = []
            while j < len(linhas) and not linhas[j].startswith('## '):
                if linhas[j].strip():
                    sintese.append(linhas[j].strip())
                j += 1
            texto_sintese = ' '.join(sintese)
            if texto_sintese and texto_sintese != '(sem síntese)':
                return texto_sintese.split('. ')[0].strip(' .') + '.'
        i = 0
        # Pula o título e linhas vazias.
        while i < len(linhas) and (not linhas[i].strip() or linhas[i].startswith('# ')):
            i += 1
        # Descrição geral: texto corrido antes de qualquer '## '.
        geral = []
        while i < len(linhas) and not linhas[i].startswith('## '):
            if linhas[i].strip():
                geral.append(linhas[i].strip())
            i += 1
        if geral:
            return ' '.join(geral).split('. ')[0].strip(' .') + '.'
        # Sem descrição geral: primeira frase da lista de símbolos.
        for linha in linhas[i:]:
            if linha.startswith('- ') and '—' in linha:
                partes = linha.split('—')
                if len(partes) >= 3:
                    frase = partes[-1].strip()
                    if frase and frase != '(sem descrição)':
                        return frase
        return ''

    def build_indice_navegacao(self, project_name):
        """Monta o índice a partir dos .md da documentação técnica."""
        doc_base = self._in_doc_base(project_name)
        if not os.path.isdir(doc_base):
            raise ValueError('Documentação Técnica ainda não foi gerada. '
                             'Rode aquele agente primeiro.')

        entradas = []
        for root, dirs, files in os.walk(doc_base):
            dirs.sort()
            for fname in sorted(files):
                # O `_` só protege na RAIZ (D33), onde moram os arquivos da
                # rotina; lá dentro `__init__.py.md` é conteúdo como qualquer outro.
                if not fname.endswith('.md') or (fname.startswith('_') and root == doc_base):
                    continue
                fpath = os.path.join(root, fname)
                rel_doc = os.path.relpath(fpath, doc_base).replace('\\', '/')
                # Tira o '.md' que a doc técnica acrescenta ao nome original.
                rel_codigo = rel_doc[:-3] if rel_doc.endswith('.md') else rel_doc
                try:
                    with open(fpath, 'r', encoding='utf-8', errors='replace') as f:
                        texto = f.read()
                except Exception:
                    continue
                entradas.append({
                    'caminho': rel_codigo,
                    'descricao': self._in_extrair_descricao(texto),
                })

        if not entradas:
            raise ValueError('Nenhum arquivo encontrado em agentes/documentacao-tecnica/.')

        # Agrupa por pasta preservando a ordem alfabética dos caminhos.
        por_pasta = {}
        for e in sorted(entradas, key=lambda x: x['caminho']):
            pasta = os.path.dirname(e['caminho']) or '.'
            por_pasta.setdefault(pasta, []).append(e)

        linhas = ['# Índice de navegação', '',
                  '> Gerado deterministicamente a partir da Documentação Técnica.',
                  '> Nenhum modelo de linguagem participa — os nomes e caminhos vêm do disco.',
                  '',
                  '_%d arquivos · gerado em %s_' % (len(entradas),
                                                    datetime.now().strftime('%d/%m/%Y %H:%M')),
                  '']
        for pasta in sorted(por_pasta):
            linhas.append('## %s' % ('(raiz)' if pasta == '.' else pasta))
            linhas.append('')
            for e in por_pasta[pasta]:
                nome = os.path.basename(e['caminho'])
                desc = e['descricao'] or '—'
                linhas.append('- `%s` — %s' % (nome, desc))
            linhas.append('')

        conteudo = '\n'.join(linhas)
        out_dir = self._in_dir(project_name)
        os.makedirs(out_dir, exist_ok=True)
        with open(os.path.join(out_dir, 'indice-navegacao.md'), 'w', encoding='utf-8') as f:
            f.write(conteudo)
        resumo = {'finished_at': datetime.now().isoformat(),
                  'arquivos': len(entradas), 'chars': len(conteudo)}
        with open(os.path.join(out_dir, '_resumo.json'), 'w', encoding='utf-8') as f:
            json.dump(resumo, f, ensure_ascii=False, indent=2)
        return resumo

    def run_indice_navegacao_agent(self, project_name):
        def worker():
            try:
                self._in_notify(project_name, {'status': 'running'})
                resumo = self.build_indice_navegacao(project_name)
                self._in_notify(project_name, {'status': 'done', 'arquivos': resumo['arquivos']})
            except Exception as e:
                self._in_notify(project_name, {'status': 'error', 'error': str(e)})

        # A referência da thread fica registrada: é o que deixa o ciclo
        # saber que esta rotina continua viva (ver processando.py).
        self._proc_iniciar(project_name, 'indice-navegacao', worker)
        return {'success': True}

    def get_indice_navegacao_status(self, project_name):
        path = os.path.join(self._in_dir(project_name), 'indice-navegacao.md')
        return {'success': True, 'exists': os.path.isfile(path)}
