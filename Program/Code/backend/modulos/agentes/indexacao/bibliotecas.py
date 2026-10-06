"""Bibliotecas — o inventário do que o projeto importa de fora, sem LLM.

Lê **somente** os arquivos das pastas de trabalho do usuário. Nunca abre
`site-packages/`, `node_modules/`, `~/.cargo/`, `requirements.txt` ou
`package.json`: o que vale é o que o código escreve, não o que o ambiente tem
instalado nem o que o manifesto promete. A pergunta "quais bibliotecas eu uso"
é respondida pela linha de `import`, que é texto do próprio usuário — as pastas
externas responderiam outras perguntas (qual versão, se está instalada), e essas
ficaram de fora por decisão explícita.

Duas caixas na saída: **terceiros** e **biblioteca padrão**. O que não é nem um
nem outro — caminho relativo, módulo do próprio usuário — some em silêncio. Não
existe uma terceira caixa de "não identificados": o usuário pediu a aba
exclusivamente sobre bibliotecas, e mostrar o resíduo seria devolver ruído para
ele resolver.

HTML e CSS ficam de fora de propósito: lá não existe biblioteca instalada,
existe arquivo carregado por URL, e tirar o nome da biblioteca de uma URL
(`d3.min.js` → `d3`) seria palpite. Numa lista informativa, uma linha adivinhada
contamina todas as outras — quem lê deixa de saber quais são fato.

Discussão completa (13 decisões) em
`Saída dos comandos/Discussões/Bibliotecas — lista das dependências que o código importa/`.
"""
import re as _re
import sys

from ...constantes import *
# As gramáticas de import, por linguagem. `import *` para os nomes continuarem
# alcançáveis por este módulo como antes da divisão.
from ..resumo_de_rotina import gravar_resumo_de_falha
from .bibliotecas_gramaticas import *
# ⚠️ NOME COM `_` NÃO VEM NO `import *` — TEM QUE ESTAR NESTA LISTA. Foi assim
# que a rotina quebrou em 04/09/2026: a divisão em dois arquivos levou as quatro
# constantes abaixo para o irmão e a lista explícita ficou só com as funções.
# `_bib_scan` estourava `NameError` na primeira linha, o `except` do worker
# engolia, `_resumo.json` não era escrito, e o ciclo lia isso como "sem sinal de
# vida" e interrompia TODAS as rotinas seguintes. Acrescentou gramática nova?
# Confira se o nome dela entrou nesta lista.
from .bibliotecas_gramaticas import (
    _BIB_LINGUAGENS, _BIB_EXT_LANG, _BIB_ILEGAL, _BIB_RESERVADOS,
    _bib_sem_comentarios, _canon_py, _canon_js, _canon_go, _canon_rust,
    _canon_c, _canon_jvm, _canon_cs, _canon_php, _canon_rb, _canon_direto,
    _brutos_go, _bib_apagar,
)


# Este arquivo era 634 linhas e virou dois, pelo teto de 500 da AMF:
#
#   bibliotecas.py             o que varrer, e o que mostrar
#   bibliotecas_gramaticas.py  como se lê um `import` em cada linguagem
#
# ⚠️ NENHUMA FUNÇÃO DE GRAMÁTICA SABE DO PROJETO, e nenhuma função daqui parseia
# texto. É esse o corte, e é ele que permite acrescentar uma linguagem mexendo
# num arquivo só.

class BibliotecasMixin:
    """Agente ⚡ determinístico — a lista de bibliotecas que o projeto importa."""

    # Bundle minificado não tem import legível e enche a memória à toa.
    _BIB_MAX_SIZE = 2 * 1024 * 1024

    # ── Caminhos ─────────────────────────────────────────────────────────────

    def _bib_dir(self, project_name):
        return obter_pasta_da_rotina(project_name, 'bibliotecas')

    def _bib_resumo_path(self, project_name):
        return os.path.join(self._bib_dir(project_name), '_resumo.json')

    def _bib_notify(self, project_name, payload):
        # `project` no payload: o front ignora o evento quando este projeto
        # não é o exibido no momento (várias abas de projeto abertas).
        payload = {**payload, 'project': project_name}
        try:
            self.window.evaluate_js('bibliotecasAgentProgress(%s)' % json.dumps(payload))
        except Exception:
            pass

    # ── Classificação ────────────────────────────────────────────────────────

    @staticmethod
    def _bib_eh_padrao(canon, cfg):
        if cfg['modo'] == 'prefixo':
            return any(canon == p.rstrip('.') or canon.startswith(p) for p in cfg['std'])
        if cfg['modo'] == 'go':
            return canon.split('/')[0] in cfg['std']
        return canon in cfg['std']

    @staticmethod
    def _bib_eh_local(canon, cfg, lang, locais):
        """É código do próprio usuário, e não biblioteca."""
        # Go: caminho de módulo sem domínio no primeiro segmento e fora da
        # stdlib é sempre o módulo do próprio projeto — nenhum pacote público
        # do Go é publicado sem host.
        if cfg['modo'] == 'go' and '.' not in canon.split('/')[0]:
            return True
        return canon.casefold() in locais.get(lang, ())

    def _bib_extrair(self, lang, texto):
        """Texto do arquivo → nomes canônicos. Já sem caminhos nem internos."""
        cfg = _BIB_LINGUAGENS[lang]
        texto = _bib_sem_comentarios(texto, cfg['com'])
        crus = []
        for rx in cfg['rx']:
            crus.extend(rx.findall(texto))
        if cfg.get('brutos'):
            crus.extend(cfg['brutos'](texto))
        nomes = []
        for cru in crus:
            nomes.extend(cfg['canon'](cru))
        return nomes

    # ── Varredura ────────────────────────────────────────────────────────────

    def _bib_scan(self, project_name, mudados=None, cache=None):
        """Uma passada só no disco. Acumula durante, classifica no fim.

        A classificação não pode acontecer dentro do laço: saber se `utils` é
        biblioteca depende de existir um `utils.py` em QUALQUER pasta de
        trabalho, e isso só se sabe quando o walk termina.

        `mudados` + `cache` (D8): o walk e os nomes continuam vistos inteiros a
        cada volta — é deles que sai o que é local —, mas o arquivo que não
        mudou não é ABERTO: os imports dele vêm de `cache[rel]`. O `cache`
        devolvido só tem os `rel` vistos nesta passada, então arquivo apagado
        cai sozinho.
        """
        workspace = self.load_workspace(project_name)
        if not workspace.get('success'):
            return None
        config = workspace['config']
        ignore_list = config.get('ignore_list', [])
        context_descs = self._build_context_descs(config.get('context_items', []))

        brutos = []                                        # [(lang, canon, rel)]
        locais = {lang: set() for lang in _BIB_LINGUAGENS}  # módulos do usuário
        pastas = set()                                     # valem p/ toda linguagem
        total_arquivos = 0
        lidos = 0
        novo_cache = {}                                    # rel → [[lang, canon], ...]
        mudados_norm = {os.path.normcase(os.path.normpath(m)) for m in (mudados or ())}

        for folder in config.get('working_folders', []):
            if not os.path.isdir(folder):
                continue
            raiz = os.path.basename(folder.rstrip(os.sep)) or folder
            for root, dirs, files in os.walk(folder):
                if self._caminho_ignorado(root, ignore_list):
                    dirs.clear()
                    continue
                dirs[:] = [d for d in dirs
                           if not self._caminho_ignorado(os.path.join(root, d), ignore_list)]

                for d in dirs:
                    pastas.add(d.casefold())

                for fname in sorted(files):
                    fpath = os.path.join(root, fname)
                    if self._caminho_ignorado(fpath, ignore_list):
                        continue
                    stem, ext = os.path.splitext(fname)
                    lang = _BIB_EXT_LANG.get(ext.lower())
                    if not lang:
                        continue
                    if self._get_ctx_desc(fpath, context_descs) is not None:
                        continue
                    # O nome do arquivo é módulo local DAQUELA linguagem —
                    # `utils.py` não torna `utils` local para o JavaScript.
                    locais[lang].add(stem.casefold())
                    rel = f'{raiz}/' + os.path.relpath(fpath, folder).replace('\\', '/')
                    try:
                        if os.path.getsize(fpath) > self._BIB_MAX_SIZE:
                            continue
                        if (mudados is not None and cache and rel in cache
                                and os.path.normcase(os.path.normpath(fpath)) not in mudados_norm):
                            extraidos = [tuple(par) for par in cache[rel]]
                        else:
                            with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                                texto = f.read()
                            extraidos = [(lang, canon) for canon in self._bib_extrair(lang, texto)]
                            lidos += 1
                    except Exception:
                        continue
                    total_arquivos += 1
                    novo_cache[rel] = [list(par) for par in extraidos]
                    for lg, canon in extraidos:
                        brutos.append((lg, canon, rel))

        # Pasta conta como pacote local para qualquer linguagem.
        for lang in locais:
            locais[lang] |= pastas

        caixas = {'terceiros': {}, 'padrao': {}}
        for lang, canon, rel in brutos:
            cfg = _BIB_LINGUAGENS[lang]
            if self._bib_eh_padrao(canon, cfg):
                caixa = 'padrao'
            elif self._bib_eh_local(canon, cfg, lang, locais):
                continue                                   # descarta em silêncio
            else:
                caixa = 'terceiros'
            item = caixas[caixa].setdefault(
                (lang, canon), {'linguagem': lang, 'nome': canon, 'arquivos': []})
            if rel not in item['arquivos']:
                item['arquivos'].append(rel)

        ordenar = lambda d: sorted(d.values(), key=lambda i: (i['linguagem'], i['nome'].casefold()))
        return {
            'gerado_em': datetime.now().isoformat(),
            'arquivos_lidos': total_arquivos,
            'lidos_nesta_passada': lidos,
            'cache': novo_cache,
            'terceiros': ordenar(caixas['terceiros']),
            'padrao': ordenar(caixas['padrao']),
        }

    # ── Nomes de arquivo ─────────────────────────────────────────────────────

    @staticmethod
    def _bib_slug(nome):
        """Nome de biblioteca → nome de arquivo seguro no Windows.

        A barra é o único caso que acontece de verdade (Go: `net/http`; npm com
        escopo: `@scope/pkg`), e vira **U+2215 DIVISION SLASH** — desenhada igual
        à barra e legal em nome de arquivo. Assim o rótulo na árvore continua
        sendo o nome de verdade da biblioteca, em vez de uma versão mutilada.
        O resto é rede de segurança: nada nas 13 linguagens produz esses
        caracteres depois da canonização.
        """
        s = nome.replace('/', '∕').replace('\\', '∕')
        s = _BIB_ILEGAL.sub('_', s).strip().rstrip('.')
        if s.lower() in _BIB_RESERVADOS:
            s += '_'
        return s or '_'

    @staticmethod
    def _bib_rotulo(nome, n):
        """`openai` + 13 → `openai (13)`.

        A contagem entra no NOME porque é ele que a árvore da aba exibe — o
        renderizador é compartilhado com as outras fontes e não recebe metadado
        por fora. `documentacao.js::_docSepararContagem` separa o ` (N)` final e
        o entrega ao componente de árvore como selo discreto.
        """
        return f'{nome} ({n})'

    # ── Markdown de uma biblioteca ───────────────────────────────────────────

    @staticmethod
    def _bib_markdown(item, grupo_rotulo):
        n = len(item['arquivos'])
        plural = 'arquivo' if n == 1 else 'arquivos'
        linhas = [
            f"# {item['nome']}",
            '',
            f"**{item['linguagem']}** · {grupo_rotulo} · **{n} {plural}**",
            '',
            '## Importada em',
            '',
        ]
        linhas += [f'- `{c}`' for c in sorted(item['arquivos'])]
        return '\n'.join(linhas).rstrip() + '\n'

    # ── Execução ─────────────────────────────────────────────────────────────

    # (pasta no disco, rótulo dentro do .md). Os dois nomes de pasta existem
    # nesta forma por um motivo: a árvore da aba ordena alfabeticamente, e
    # **B**ibliotecas < **P**adrão põe as de terceiros em cima, que é onde o
    # interesse está. Renomear um deles reordena a tela.
    _BIB_GRUPOS = (
        ('terceiros', 'Bibliotecas de terceiros', 'biblioteca de terceiro'),
        ('padrao',    'Padrão da linguagem',      'biblioteca padrão'),
    )

    def build_bibliotecas(self, project_name, mudados=None):
        """Varre, classifica e grava a árvore. Síncrono — devolve o resumo.

        Um `.md` por biblioteca, em `{grupo}/{linguagem}/{nome}.md`. É esse
        formato de caminho que faz a aba montar a árvore colapsável sozinha
        (componente `frontend/modulos/arvore-pastas.js`), sem renderizador próprio.
        """
        # O cache dos imports por arquivo, da passada anterior. Ausente, a
        # passada lê tudo — é o que acontece na primeira vez e no ▶ do card.
        cache_path = os.path.join(self._bib_dir(project_name), '_imports.json')
        cache = None
        if mudados is not None:
            try:
                with open(cache_path, 'r', encoding='utf-8') as f:
                    cache = json.load(f)
            except Exception:
                cache = None
        dados = self._bib_scan(project_name, mudados, cache)
        if dados is None:
            raise RuntimeError('Workspace não carregado.')

        # A varredura inteira termina ANTES de qualquer escrita, então uma falha
        # ali deixa os dados antigos intactos. A limpeza é o que impede
        # biblioteca removida do código de ficar para sempre na árvore.
        out_dir = self._bib_dir(project_name)
        shutil.rmtree(out_dir, ignore_errors=True)
        os.makedirs(out_dir, exist_ok=True)

        for chave, pasta_grupo, rotulo in self._BIB_GRUPOS:
            itens = dados[chave]
            if not itens:
                continue
            por_lang = {}
            for item in itens:
                por_lang.setdefault(item['linguagem'], []).append(item)
            base_grupo = os.path.join(out_dir, self._bib_rotulo(pasta_grupo, len(itens)))
            for lang, libs in por_lang.items():
                pasta = os.path.join(base_grupo, self._bib_rotulo(self._bib_slug(lang), len(libs)))
                os.makedirs(pasta, exist_ok=True)
                for item in libs:
                    nome_arq = self._bib_rotulo(self._bib_slug(item['nome']),
                                                len(item['arquivos'])) + '.md'
                    with open(os.path.join(pasta, nome_arq), 'w', encoding='utf-8') as f:
                        f.write(self._bib_markdown(item, rotulo))

        # Depois do `rmtree`: o cache mora na pasta da rotina, e a árvore é
        # regravada inteira a cada volta (a classificação é inteira e barata).
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(dados['cache'], f, ensure_ascii=False)

        # `_resumo.json` no mesmo padrão dos outros agentes: é dele que os
        # Acionamentos leem o `finished_at` para saber que a rodada terminou.
        resumo = {
            'finished_at': dados['gerado_em'],
            'terceiros': len(dados['terceiros']),
            'padrao': len(dados['padrao']),
            'arquivos_lidos': dados['arquivos_lidos'],
            'lidos_nesta_passada': dados['lidos_nesta_passada'],
        }
        with open(self._bib_resumo_path(project_name), 'w', encoding='utf-8') as f:
            json.dump(resumo, f, ensure_ascii=False, indent=2)
        return resumo

    def run_bibliotecas_agent(self, project_name, mudados_pre=MUDADOS_AUTO):
        def worker():
            try:
                self._bib_notify(project_name, {'status': 'running'})
                resumo = self.build_bibliotecas(
                    project_name, None if mudados_pre == MUDADOS_AUTO else mudados_pre)
                self._bib_notify(project_name, {'status': 'done',
                                  'terceiros': resumo['terceiros'],
                                  'padrao': resumo['padrao']})
            except Exception as e:
                # ⚠️ A TELA E O DISCO. Avisar só a tela era o que transformava
                # uma falha desta rotina em "sem sinal de vida" para o ciclo
                # INTEIRO: sem `_resumo.json` novo, `_ac_wait_done` vê a thread
                # morrer sem prova de término, levanta `CicloInterrompido`, e
                # todas as rotinas seguintes saem como "pulada" — inclusive as
                # que não dependem desta em nada (`_AC_REQUISITOS['bibliotecas']`
                # é vazio). Com o resumo gravado o ciclo segue em frente, e a aba
                # Erros mostra o motivo em vez de "sem sinal de vida".
                gravar_resumo_de_falha(project_name, 'bibliotecas', str(e),
                                       terceiros=0, padrao=0, arquivos_lidos=0)
                self._bib_notify(project_name, {'status': 'error', 'error': str(e)})

        # A referência da thread fica registrada: é o que deixa o ciclo
        # saber que esta rotina continua viva (ver processando.py).
        self._proc_iniciar(project_name, 'bibliotecas', worker)
        return {'success': True}

    def get_bibliotecas_status(self, project_name):
        # A saída é uma árvore, não um arquivo — o `_resumo.json` é o que diz se
        # a rodada terminou de verdade.
        try:
            with open(self._bib_resumo_path(project_name), 'r', encoding='utf-8') as f:
                resumo = json.load(f)
        except Exception:
            return {'success': True, 'existe': False, 'gerado_em': None,
                    'terceiros': 0, 'padrao': 0}
        return {
            'success': True,
            'existe': True,
            'gerado_em': resumo.get('finished_at'),
            'terceiros': resumo.get('terceiros', 0),
            'padrao': resumo.get('padrao', 0),
        }
