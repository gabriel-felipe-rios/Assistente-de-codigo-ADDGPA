from .constantes import *
from .estilos_e_cores_moldes import RESERVA_DE_CORES

# CRUD da biblioteca de aparência: itens (arquivos soltos) e tags.
#
# Separado de `estilos_e_cores.py` porque aquele é LEITURA — e a leitura tem dois
# consumidores (a biblioteca global e, na Parte 3, o Designer), enquanto a escrita
# tem um só. Os moldes de item novo moram no terceiro módulo, `..._moldes.py`.
#
# ⚠️ Nada aqui usa `shutil.rmtree`, e é de propósito: um item desta biblioteca é
# um ARQUIVO. Excluir é `os.remove`, e um item que por acaso fosse pasta é
# recusado em vez de apagado com a árvore inteira.


class EstilosECoresCrudMixin:

    # ── Caminho de um item ────────────────────────────────────────────────────

    def _estilos_e_cores_caminho(self, chave, arquivo, pasta=''):
        """(caminho absoluto, dimensão, erro). O erro é uma string ou None."""
        dimensao = self._estilos_e_cores_dimensao(chave)
        if not dimensao:
            return None, None, 'Dimensão inválida.'
        if not self._estilos_e_cores_nome_seguro(arquivo):
            return None, None, 'Nome de arquivo inválido.'
        base = self._estilos_e_cores_pasta(dimensao)
        if dimensao['por_pasta']:
            if not self._estilos_e_cores_nome_seguro(pasta):
                return None, None, 'Escolha a pasta de evento.'
            base = os.path.join(base, pasta)
        elif pasta:
            return None, None, 'Esta dimensão não tem pastas.'
        return os.path.join(base, arquivo), dimensao, None

    def _relativo_de_estilos_e_cores(self, chave, arquivo, pasta=''):
        """A chave do item no `tags.json`: `Cores/Roxo.json`."""
        dimensao = self._estilos_e_cores_dimensao(chave)
        if not dimensao:
            return ''
        return '/'.join(p for p in (dimensao['pasta'], pasta, arquivo) if p)

    # ── CRUD de item ──────────────────────────────────────────────────────────

    def criar_item_de_estilos_e_cores(self, chave, nome, descricao='', pasta=''):
        """Cria um item novo — um ARQUIVO, nunca uma pasta (A3)."""
        nome = (nome or '').strip()
        if not self._estilos_e_cores_nome_seguro(nome):
            return {'success': False, 'error': 'Nome inválido (evite \\ / : * ? " < > |).'}
        dimensao = self._estilos_e_cores_dimensao(chave)
        if not dimensao:
            return {'success': False, 'error': 'Dimensão inválida.'}
        arquivo = nome + dimensao['extensao']
        caminho, dimensao, erro = self._estilos_e_cores_caminho(chave, arquivo, pasta)
        if erro:
            return {'success': False, 'error': erro}
        if os.path.exists(caminho):
            return {'success': False, 'error': 'Já existe um item com esse nome.'}
        try:
            os.makedirs(os.path.dirname(caminho), exist_ok=True)
            with open(caminho, 'w', encoding='utf-8') as f:
                f.write(self._molde_de_estilos_e_cores(chave, nome, (descricao or '').strip()))
        except Exception as e:
            return {'success': False, 'error': str(e)}
        return {'success': True, 'arquivo': arquivo}

    def formatar_item_de_estilos_e_cores(self, chave, arquivo, descricao='', pasta=''):
        """Adota um arquivo que você jogou na pasta na mão, pondo nele o que falta.

        O equivalente do "formatar" das outras categorias, com a diferença de que
        lá o alvo é uma pasta sem `Descrição.md` e aqui é um arquivo solto sem os
        campos que a biblioteca lê. Nunca sobrescreve o que já está preenchido —
        só completa.
        """
        caminho, dimensao, erro = self._estilos_e_cores_caminho(chave, arquivo, pasta)
        if erro:
            return {'success': False, 'error': erro}
        if not os.path.isfile(caminho):
            return {'success': False, 'error': 'Item não encontrado.'}
        nome = arquivo[:-len(dimensao['extensao'])] if arquivo.endswith(dimensao['extensao']) else arquivo
        descricao = (descricao or '').strip()
        try:
            conteudo = self._estilos_e_cores_ler(caminho)
            if dimensao['extensao'] == '.json':
                novo = self._formatar_json_de_estilos_e_cores(conteudo, nome, descricao, chave)
            else:
                novo = self._formatar_html_de_estilos_e_cores(conteudo, nome, descricao)
            with open(caminho, 'w', encoding='utf-8') as f:
                f.write(novo)
        except Exception as e:
            return {'success': False, 'error': str(e)}
        return {'success': True}

    def _formatar_json_de_estilos_e_cores(self, conteudo, nome, descricao, chave):
        try:
            dados = json.loads(conteudo)
        except Exception:
            dados = {}
        if not isinstance(dados, dict):
            dados = {}
        molde = json.loads(self._molde_de_estilos_e_cores(chave, nome, descricao))
        for campo, valor in molde.items():
            if campo not in dados or dados[campo] in ('', None, {}, []):
                dados[campo] = valor
        dados['nome'] = dados.get('nome') or nome
        if descricao:
            dados['descricao'] = descricao
        return json.dumps(dados, ensure_ascii=False, indent=2) + '\n'

    @staticmethod
    def _formatar_html_de_estilos_e_cores(conteudo, nome, descricao):
        """Garante o comentário de estrutura no topo e a paleta de reserva.

        Sem o `:root` de reserva o arquivo abre ilegível fora do programa e a
        miniatura não tem o que tingir; sem o comentário de estrutura o card fica
        sem descrição nenhuma.
        """
        texto = conteudo or ''
        tem_cabecalho = 'Rascunho de estrutura' in texto or 'Animação:' in texto
        if not tem_cabecalho:
            cabecalho = '<!-- Rascunho de estrutura: %s -->\n<!-- %s -->\n' % (
                nome, descricao or 'descreva a estrutura em uma linha')
            if texto.lstrip().lower().startswith('<!doctype'):
                corte = texto.index('\n') + 1 if '\n' in texto else len(texto)
                texto = texto[:corte] + cabecalho + texto[corte:]
            else:
                texto = '<!DOCTYPE html>\n' + cabecalho + texto
        elif descricao:
            linhas = texto.splitlines(True)
            for i, linha in enumerate(linhas[:6]):
                if linha.strip().startswith('<!--') and 'Rascunho de estrutura' not in linha \
                        and 'Animação:' not in linha:
                    linhas[i] = '<!-- %s -->\n' % descricao
                    break
            texto = ''.join(linhas)
        if ':root{' not in texto and ':root {' not in texto:
            if '<style>' in texto:
                texto = texto.replace('<style>', '<style>\n' + RESERVA_DE_CORES, 1)
            else:
                texto = texto.replace('</head>', '<style>\n%s</style>\n</head>' % RESERVA_DE_CORES, 1)
        return texto

    def deletar_item_de_estilos_e_cores(self, chave, arquivo, pasta=''):
        """Remove o ARQUIVO do item. Nunca uma árvore de pastas (A3)."""
        caminho, _dimensao, erro = self._estilos_e_cores_caminho(chave, arquivo, pasta)
        if erro:
            return {'success': False, 'error': erro}
        if os.path.isdir(caminho):
            return {'success': False, 'error': 'Isto é uma pasta, não um item. Não vou apagar.'}
        if not os.path.isfile(caminho):
            return {'success': False, 'error': 'Item não encontrado.'}
        try:
            os.remove(caminho)
        except Exception as e:
            return {'success': False, 'error': str(e)}
        # A tag do item morre junto: ela mora no índice central, e entrada órfã
        # apontando para arquivo que não existe mais contaria errado na barra.
        indice = self._estilos_e_cores_tags()
        relativo = self._relativo_de_estilos_e_cores(chave, arquivo, pasta)
        if relativo in indice['itens']:
            del indice['itens'][relativo]
            self._gravar_tags_de_estilos_e_cores(indice)
        return {'success': True}

    # ── CRUD de tag ───────────────────────────────────────────────────────────
    #
    # Tudo aqui mexe SÓ no `tags.json`. A tag nunca é gravada dentro do arquivo do
    # item: nada de campo `tags` no JSON da paleta, nada de `<meta>` no HTML do
    # estilo. É o índice central que responde "quem tem esta tag", e é ele que
    # permite renomear uma tag numa edição só.

    def _gravar_tags_de_estilos_e_cores(self, indice):
        caminho = self._estilos_e_cores_caminho_das_tags()
        os.makedirs(os.path.dirname(caminho), exist_ok=True)
        dados = {
            'tags': [{'nome': n} for n in indice['tags']],
            'itens': {k: v for k, v in sorted(indice['itens'].items()) if v},
        }
        with open(caminho, 'w', encoding='utf-8') as f:
            json.dump(dados, f, ensure_ascii=False, indent=2)
            f.write('\n')

    @staticmethod
    def _tag_de_estilos_e_cores_valida(nome):
        nome = (nome or '').strip()
        if not nome or len(nome) > 40:
            return ''
        return nome

    def criar_tag_de_estilos_e_cores(self, nome):
        """Cria a tag sem item nenhum. É por isso que `tags` é um bloco próprio."""
        nome = self._tag_de_estilos_e_cores_valida(nome)
        if not nome:
            return {'success': False, 'error': 'Informe um nome de até 40 caracteres.'}
        indice = self._estilos_e_cores_tags()
        if nome in indice['tags']:
            return {'success': False, 'error': 'Essa tag já existe.'}
        indice['tags'].append(nome)
        indice['tags'].sort(key=str.lower)
        try:
            self._gravar_tags_de_estilos_e_cores(indice)
        except Exception as e:
            return {'success': False, 'error': str(e)}
        return {'success': True}

    def renomear_tag_de_estilos_e_cores(self, nome_antigo, nome_novo):
        """Renomeia em UMA edição — no índice e em todo item que a usava."""
        nome_novo = self._tag_de_estilos_e_cores_valida(nome_novo)
        if not nome_novo:
            return {'success': False, 'error': 'Informe um nome de até 40 caracteres.'}
        indice = self._estilos_e_cores_tags()
        if nome_antigo not in indice['tags']:
            return {'success': False, 'error': 'Tag não encontrada.'}
        if nome_novo != nome_antigo and nome_novo in indice['tags']:
            return {'success': False, 'error': 'Já existe uma tag com esse nome.'}
        indice['tags'] = sorted(
            [nome_novo if t == nome_antigo else t for t in indice['tags']], key=str.lower)
        for caminho, tags in indice['itens'].items():
            indice['itens'][caminho] = [nome_novo if t == nome_antigo else t for t in tags]
        try:
            self._gravar_tags_de_estilos_e_cores(indice)
        except Exception as e:
            return {'success': False, 'error': str(e)}
        return {'success': True}

    def deletar_tag_de_estilos_e_cores(self, nome):
        """Apaga a tag e a tira de todo item. Nenhum arquivo de item é tocado."""
        indice = self._estilos_e_cores_tags()
        if nome not in indice['tags']:
            return {'success': False, 'error': 'Tag não encontrada.'}
        indice['tags'] = [t for t in indice['tags'] if t != nome]
        for caminho, tags in indice['itens'].items():
            indice['itens'][caminho] = [t for t in tags if t != nome]
        try:
            self._gravar_tags_de_estilos_e_cores(indice)
        except Exception as e:
            return {'success': False, 'error': str(e)}
        return {'success': True}

    def definir_tags_do_item_de_estilos_e_cores(self, caminho, tags):
        """Atribui e remove numa operação só: a lista recebida passa a ser a do item.

        Uma tag que ainda não existia no bloco `tags` é criada junto — marcar um
        item com uma tag que a barra de filtros não conhece seria estado
        impossível de explicar na tela.
        """
        caminho = (caminho or '').strip()
        if not caminho or '..' in caminho.split('/'):
            return {'success': False, 'error': 'Item inválido.'}
        # Animações não leva tag: ela se organiza por pasta de evento, e só.
        if caminho.startswith('Animações/'):
            return {'success': False, 'error': 'Animações se organiza por pasta, não por tag.'}
        indice = self._estilos_e_cores_tags()
        limpas = []
        for t in (tags or []):
            t = self._tag_de_estilos_e_cores_valida(t)
            if t and t not in limpas:
                limpas.append(t)
        for t in limpas:
            if t not in indice['tags']:
                indice['tags'].append(t)
        indice['tags'].sort(key=str.lower)
        indice['itens'][caminho] = limpas
        try:
            self._gravar_tags_de_estilos_e_cores(indice)
        except Exception as e:
            return {'success': False, 'error': str(e)}
        return {'success': True, 'tags': limpas}
