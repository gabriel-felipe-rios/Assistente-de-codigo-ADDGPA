"""Comentários — a prosa que o AUTOR escreveu dentro do código, sem LLM.

Extrai de cada arquivo do workspace **tudo que não é código**: comentários em
todas as linguagens que têm gramática, mais docstrings em Python. Grava um `.md`
por arquivo, em árvore espelhando as pastas de trabalho.

⛔ A fonte é **o arquivo de código real**, sempre. Nunca a Documentação Técnica:
são dois textos de origens diferentes — a frase de lá o LLM escreveu lendo o
corpo do código; a prosa daqui o autor escreveu. Derivar uma da outra destrói
exatamente o que esta rotina existe para mostrar.

⛔ A extração é por **gramática**, não por caractere. Um filtro de `#` e `//`
erra em `cor = "#ff6b9d"  # a cor do chip` (leva a cor junto) e em qualquer `//`
dentro de uma URL. O `_bib_sem_comentarios` de `bibliotecas.py` é desse tipo, e
serve lá porque o alvo é estreito — achar linha de `import`. Aqui o comentário
**é** o produto, e o tree-sitter é a razão de a ideia ter saído do papel.

⛔ Nada aqui amarra comentário ao símbolo que ele documenta. Foi deliberadamente
descartado: era o que fazia 6 das 11 linguagens dependerem de convenção e 2 de
palpite. A saída é **por arquivo, na ordem do arquivo**.

⚠️ O nome é impreciso de propósito: docstring não é comentário, e entra assim
mesmo. Foi escolha explícita do usuário — um rótulo que se entende sem
explicação valeu mais que a precisão do termo. Não "conserte" o escopo.

Quem decide o que ENTRA é o `EXT_LANG` de `modulos/treesitter.py`. `.json`,
`.txt` e `.md` caem fora por não estarem lá — não existe, nem deve existir,
regra escrita para excluí-los.

Discussão completa (13 decisões) em
`Saída dos comandos/Discussões/Docstrings — ver só a prosa do código/`.
"""

from ...constantes import *
from ...treesitter import EXT_LANG, make_parser, tree_sitter_instalado
from ..resumo_de_rotina import gravar_resumo_de_falha


# Os três nós cujo corpo pode começar com docstring. É a ÚNICA regra específica
# de linguagem do arquivo inteiro — e é exata, não heurística: a gramática do
# Python diz onde o corpo começa, e docstring é, por definição, a primeira
# expressão dele.
_COM_CORPOS_DOCSTRING = ('module', 'class_definition', 'function_definition')

_COM_COMENTARIO = 'comentário'
_COM_DOCSTRING = 'docstring'


def _com_cerca(texto):
    """A menor cerca de crase que consegue conter este texto.

    Comentário pode conter uma cerca de markdown — é comum em README embutido e
    em exemplo de sintaxe dentro do código. Cerca de tamanho fixo partiria o
    `.md` ao meio exatamente nesses casos.
    """
    maior = 0
    corrida = 0
    for ch in texto:
        corrida = corrida + 1 if ch == '`' else 0
        if corrida > maior:
            maior = corrida
    return '`' * max(3, maior + 1)


class ComentariosMixin:

    # Mesmo teto de `parse_treesitter`: acima disso o arquivo é gerado, não
    # escrito, e a prosa dele não é de ninguém.
    _COM_MAX_SIZE = 500 * 1024

    # ── Caminhos e aviso para a tela ──────────────────────────────────────

    def _com_dir(self, project_name):
        return obter_pasta_da_rotina(project_name, 'comentarios')

    def _com_resumo_path(self, project_name):
        # O `_` inicial esconde o arquivo da árvore da aba Documentação —
        # `_is_agent_content_file` filtra por ele.
        return os.path.join(self._com_dir(project_name), '_resumo.json')

    def _com_notify(self, project_name, payload):
        # ⚠️ Callback PRÓPRIO. Reusar `bibliotecasAgentProgress` faria o fim de
        # uma rotina recarregar a sub-aba da outra.
        # `project` no payload: o front ignora o evento quando este projeto
        # não é o exibido no momento (várias abas de projeto abertas).
        payload = {**payload, 'project': project_name}
        try:
            self.window.evaluate_js('comentariosAgentProgress(%s)' % json.dumps(payload))
        except Exception:
            pass

    # ── Extração ──────────────────────────────────────────────────────────

    def _com_no_docstring(self, corpo):
        """O nó `string` que encabeça este corpo, ou `None`.

        No tree-sitter do Python a docstring não é um nó `string` solto: é um
        `expression_statement` cujo primeiro filho nomeado é a string. Pular
        esse degrau é o erro que faz a rotina achar que não há docstring
        nenhuma no projeto inteiro.
        """
        if corpo is None or not corpo.named_children:
            return None
        primeiro = corpo.named_children[0]
        if primeiro.type == 'string':
            return primeiro
        if primeiro.type == 'expression_statement' and primeiro.named_children:
            candidato = primeiro.named_children[0]
            if candidato.type == 'string':
                return candidato
        return None

    def _com_extrair(self, raiz, lang):
        """Os blocos de prosa do arquivo, na ordem em que aparecem nele.

        Iterativo de propósito: arquivo grande com aninhamento profundo estoura
        o limite de recursão do Python, e um `RecursionError` aqui derrubaria a
        rodada inteira por causa de um arquivo só.
        """
        blocos = []
        pilha = [raiz]
        while pilha:
            node = pilha.pop()

            if node.type == 'comment':
                blocos.append(self._com_bloco(node, _COM_COMENTARIO))
                # Comentário não tem filho que interesse.
                continue

            if lang == 'Python' and node.type in _COM_CORPOS_DOCSTRING:
                corpo = node if node.type == 'module' else node.child_by_field_name('body')
                alvo = self._com_no_docstring(corpo)
                if alvo is not None:
                    blocos.append(self._com_bloco(alvo, _COM_DOCSTRING))

            pilha.extend(node.children)

        # A pilha visita fora de ordem; o byte inicial devolve a ordem do
        # arquivo, que é a única ordem que esta rotina promete.
        blocos.sort(key=lambda b: b['byte'])
        return blocos

    def _com_bloco(self, node, rotulo):
        # ⚠️ `fim` é aditivo e o Markdown daqui o ignora. Ele existe para o
        # DETECTOR: com o começo e o fim de cada bloco de prosa dá para recortar
        # os comentários da fonte e perguntar "sobrou a mesma coisa?" — que é
        # como se distingue "mexeu só num comentário" de "mexeu no código".
        # Sem o fim, o recorte teria que adivinhar onde o comentário acaba.
        return {
            'byte': node.start_byte,
            'fim': node.end_byte,
            'linha': node.start_point[0] + 1,
            'rotulo': rotulo,
            'texto': node.text.decode('utf-8', errors='replace').strip(),
        }

    # ── Escrita ───────────────────────────────────────────────────────────

    def _com_markdown(self, folder_name, rel, lang, blocos):
        comentarios = sum(1 for b in blocos if b['rotulo'] == _COM_COMENTARIO)
        docstrings = len(blocos) - comentarios

        rel_barra = rel.replace(os.sep, '/')
        partes = ['# ' + folder_name + '/' + rel_barra, '']

        contagem = [lang]
        if comentarios:
            plural = 's' if comentarios != 1 else ''
            contagem.append(str(comentarios) + ' comentário' + plural)
        if docstrings:
            plural = 's' if docstrings != 1 else ''
            contagem.append(str(docstrings) + ' docstring' + plural)
        partes.append('*' + ' · '.join(contagem) + '*')
        partes.append('')

        for bloco in blocos:
            cerca = _com_cerca(bloco['texto'])
            partes.append('**Linha ' + str(bloco['linha']) + ' · ' + bloco['rotulo'] + '**')
            partes.append('')
            partes.append(cerca)
            partes.append(bloco['texto'])
            partes.append(cerca)
            partes.append('')

        return '\n'.join(partes)

    def build_comentarios(self, project_name, mudados=None):
        """Varre, extrai e grava a árvore. Síncrono — devolve o resumo.

        `mudados` (caminhos absolutos que o ciclo já calculou) faz a passada
        INCREMENTAL: o laço continua percorrendo as pastas — é barato, não lê
        arquivo —, mas só lê e regrava quem está na lista. `None`, ou sem saída
        anterior no disco, faz a varredura completa de sempre.
        """
        if not tree_sitter_instalado():
            raise RuntimeError('tree-sitter não instalado.')
        workspace = self.load_workspace(project_name)
        if not workspace.get('success'):
            raise RuntimeError('Workspace não carregado.')
        config = workspace['config']
        ignore_list = config.get('ignore_list', [])
        context_descs = self._build_context_descs(config.get('context_items', []))

        out_dir = self._com_dir(project_name)
        # As contagens por `.md` — é delas que saem os totais do `_resumo.json`
        # quando a passada não relê tudo.
        contagens_path = os.path.join(out_dir, '_contagens.json')
        contagens = None
        if mudados is not None and os.path.exists(self._com_resumo_path(project_name)):
            try:
                with open(contagens_path, 'r', encoding='utf-8') as f:
                    contagens = json.load(f)
            except Exception:
                contagens = None
        completo = not isinstance(contagens, dict)
        if completo:
            # Apagar antes: sem isso, arquivo de código deletado deixa um `.md`
            # órfão na árvore para sempre. Na passada incremental, quem limpa o
            # órfão é a varredura de sobras, no fim.
            shutil.rmtree(out_dir, ignore_errors=True)
            contagens = {}
        os.makedirs(out_dir, exist_ok=True)
        mudados_norm = {os.path.normcase(os.path.normpath(m)) for m in (mudados or ())}
        # Os `.md` que continuam valendo nesta passada — o resto é sobra.
        vistos = set()

        parser_cache = {}   # guarda `None` também: binding ausente é pulado uma vez só
        arquivos_lidos = 0

        for folder in config.get('working_folders', []):
            if not os.path.isdir(folder):
                continue
            folder_name = os.path.basename(folder.rstrip(os.sep)) or folder
            for root, dirs, fnames in os.walk(folder):
                if self._caminho_ignorado(root, ignore_list):
                    dirs.clear()
                    continue
                dirs[:] = [d for d in dirs
                           if not self._caminho_ignorado(os.path.join(root, d), ignore_list)]

                for fname in sorted(fnames):
                    fpath = os.path.join(root, fname)
                    if self._caminho_ignorado(fpath, ignore_list):
                        continue
                    if self._get_ctx_desc(fpath, context_descs) is not None:
                        continue
                    lang = EXT_LANG.get(os.path.splitext(fname)[1].lower())
                    if not lang:
                        continue
                    try:
                        if os.path.getsize(fpath) > self._COM_MAX_SIZE:
                            continue
                    except OSError:
                        continue

                    rel = os.path.relpath(fpath, folder)
                    md_path = os.path.join(out_dir, folder_name, rel + '.md')
                    chave = os.path.relpath(md_path, out_dir)
                    if (not completo and os.path.normcase(os.path.normpath(fpath))
                            not in mudados_norm):
                        # Não mudou: o `.md` de antes continua valendo.
                        vistos.add(os.path.normcase(md_path))
                        continue

                    if lang not in parser_cache:
                        parser_cache[lang] = make_parser(lang)
                    parser = parser_cache.get(lang)
                    if not parser:
                        continue
                    try:
                        with open(fpath, 'rb') as f:
                            conteudo = f.read()
                        blocos = self._com_extrair(parser.parse(conteudo).root_node, lang)
                    except Exception:
                        # Não deu para ler agora: o `.md` anterior fica.
                        vistos.add(os.path.normcase(md_path))
                        continue

                    arquivos_lidos += 1
                    # Arquivo sem prosa nenhuma não vira página. Uma árvore com
                    # dez folhas vazias é pior que uma com dez folhas a menos.
                    if not blocos:
                        if os.path.exists(md_path):
                            os.remove(md_path)
                        contagens.pop(chave, None)
                        continue

                    try:
                        os.makedirs(os.path.dirname(md_path), exist_ok=True)
                        with open(md_path, 'w', encoding='utf-8') as f:
                            f.write(self._com_markdown(folder_name, rel, lang, blocos))
                    except OSError:
                        # Caminho longo demais para o Windows, disco cheio: um
                        # arquivo a menos não justifica derrubar a rodada.
                        continue

                    vistos.add(os.path.normcase(md_path))
                    comentarios = sum(1 for b in blocos if b['rotulo'] == _COM_COMENTARIO)
                    contagens[chave] = [comentarios, len(blocos) - comentarios]

        if not completo:
            # A varredura de sobras: o `.md` de arquivo apagado (ou que saiu do
            # escopo) não foi visto nesta passada.
            # ⚠️ O `_` só protege na RAIZ da pasta, onde moram os arquivos da
            # própria rotina: lá dentro, `__init__.py.md` é conteúdo como
            # qualquer outro, e pulá-lo deixaria o órfão dele para sempre.
            for base, _dirs, nomes in os.walk(out_dir):
                for nome in nomes:
                    if not nome.endswith('.md') or (nome.startswith('_') and base == out_dir):
                        continue
                    caminho = os.path.join(base, nome)
                    if os.path.normcase(caminho) not in vistos:
                        try:
                            os.remove(caminho)
                        except OSError:
                            pass
                        contagens.pop(os.path.relpath(caminho, out_dir), None)

        with open(contagens_path, 'w', encoding='utf-8') as f:
            json.dump(contagens, f, ensure_ascii=False)
        resumo = {
            # Acionamentos leem o `finished_at` para saber que a rodada terminou.
            'finished_at': datetime.now().isoformat(),
            'modo': 'completo' if completo else 'incremental',
            # Só os lidos NESTA passada; na incremental, os que mudaram.
            'arquivos_lidos': arquivos_lidos,
            'arquivos': len(contagens),
            'comentarios': sum(c[0] for c in contagens.values()),
            'docstrings': sum(c[1] for c in contagens.values()),
        }
        with open(self._com_resumo_path(project_name), 'w', encoding='utf-8') as f:
            json.dump(resumo, f, ensure_ascii=False, indent=2)
        return resumo

    # ── API para a tela ───────────────────────────────────────────────────

    def run_comentarios_agent(self, project_name, mudados_pre=MUDADOS_AUTO):
        def worker():
            try:
                self._com_notify(project_name, {'status': 'running'})
                resumo = self.build_comentarios(
                    project_name, None if mudados_pre == MUDADOS_AUTO else mudados_pre)
                self._com_notify(project_name, {'status': 'done',
                                  'arquivos': resumo['arquivos'],
                                  'comentarios': resumo['comentarios'],
                                  'docstrings': resumo['docstrings']})
            except Exception as e:
                # Sem `_resumo.json`, o ciclo vê a thread morrer e derruba as
                # rotinas seguintes — o mesmo motivo escrito em `bibliotecas.py`.
                gravar_resumo_de_falha(project_name, 'comentarios', str(e),
                                       arquivos=0, comentarios=0, docstrings=0)
                self._com_notify(project_name, {'status': 'error', 'error': str(e)})

        # A referência da thread fica registrada: é o que deixa o ciclo
        # saber que esta rotina continua viva (ver processando.py).
        self._proc_iniciar(project_name, 'comentarios', worker)
        return {'success': True}

    def get_comentarios_status(self, project_name):
        # A saída é uma árvore, não um arquivo — o `_resumo.json` é o que diz se
        # a rodada terminou de verdade.
        try:
            with open(self._com_resumo_path(project_name), 'r', encoding='utf-8') as f:
                resumo = json.load(f)
        except Exception:
            return {'success': True, 'existe': False, 'gerado_em': None,
                    'arquivos': 0, 'comentarios': 0, 'docstrings': 0}
        return {
            'success': True,
            'existe': True,
            'gerado_em': resumo.get('finished_at'),
            'arquivos': resumo.get('arquivos', 0),
            'comentarios': resumo.get('comentarios', 0),
            'docstrings': resumo.get('docstrings', 0),
        }
