from .constantes import *

# A biblioteca de aparência: cinco dimensões dentro de `Arquivos/Estilos e cores/`.
#
# Por que este módulo existe em vez de a categoria entrar em `arquivos.py`:
# os itens daqui são ARQUIVOS SOLTOS (`Roxo.json`, `Abas horizontais.html`), e
# todo o caminho genérico de Arquivos pressupõe PASTA — `list_arquivos` pula o
# que não passa em `os.path.isdir`, `create_arquivo_item` faz `os.makedirs` e
# `delete_arquivo_item` chama `shutil.rmtree`. Ligar a categoria nova àquele
# caminho geraria pasta vazia dentro de `Cores/` no botão de criar e
# "Item não encontrado" para sempre no de excluir.
#
# O CRUD (de item e de tag) mora no módulo irmão `estilos_e_cores_crud.py`.
# Aqui fica só a LEITURA — que é o que o Designer também consome.

PASTA_DE_ESTILOS_E_CORES = 'Estilos e cores'
ARQUIVO_DE_TAGS = 'tags.json'


class EstilosECoresMixin:

    _ESTILOS_E_CORES_DIR = os.path.join(ARQUIVOS_DIR, PASTA_DE_ESTILOS_E_CORES)

    # A ORDEM CANÔNICA das cinco dimensões. Vale em todo lugar sem exceção:
    # pílulas da biblioteca, sub-abas do Designer, linhas da aba Seleção e ordem
    # dos blocos no prompt. Animações é a última porque é a única que se organiza
    # por PASTA de evento — as quatro de tag ficam juntas, a diferente isolada.
    _ESTILOS_E_CORES_DIMENSOES = (
        {'chave': 'estilos',    'pasta': 'Estilos',              'extensao': '.html',
         'rotulo': 'Estilos',              'singular': 'estilo',    'tem_tag': True,  'por_pasta': False, 'quantas': 'uma'},
        {'chave': 'cores',      'pasta': 'Cores',                'extensao': '.json',
         'rotulo': 'Cores',                'singular': 'paleta',    'tem_tag': True,  'por_pasta': False, 'quantas': 'uma'},
        {'chave': 'tipografia', 'pasta': 'Tipografia',           'extensao': '.json',
         'rotulo': 'Tipografia',           'singular': 'tipografia', 'tem_tag': True, 'por_pasta': False, 'quantas': 'uma'},
        {'chave': 'texturas',   'pasta': 'Texturas e materiais', 'extensao': '.json',
         'rotulo': 'Texturas e materiais', 'singular': 'textura',   'tem_tag': True,  'por_pasta': False, 'quantas': 'varias'},
        {'chave': 'animacoes',  'pasta': 'Animações',            'extensao': '.html',
         'rotulo': 'Animações',            'singular': 'animação',  'tem_tag': False, 'por_pasta': True,  'quantas': 'varias'},
    )

    # O arquivo que cada pasta de evento de Animações carrega dizendo ONDE aquele
    # movimento se aplica. Vai ao modelo junto da animação escolhida.
    _ESTILOS_E_CORES_EXPLICACAO = 'Explicação.md'

    # ── Helpers compartilhados com o módulo de CRUD ───────────────────────────

    @classmethod
    def _estilos_e_cores_dimensao(cls, chave):
        """A linha da tabela, ou None se a chave não é de dimensão nenhuma."""
        for d in cls._ESTILOS_E_CORES_DIMENSOES:
            if d['chave'] == chave:
                return d
        return None

    @classmethod
    def _estilos_e_cores_pasta(cls, dimensao):
        return os.path.join(cls._ESTILOS_E_CORES_DIR, dimensao['pasta'])

    @staticmethod
    def _estilos_e_cores_nome_seguro(nome):
        """True se o nome pode virar arquivo dentro da biblioteca.

        Vale tanto para nome vindo da tela quanto para nome vindo do disco: a
        checagem existe para que nenhum caminho montado aqui escape da pasta da
        dimensão, e `..` sozinho passaria em qualquer teste de caractere.
        """
        nome = (nome or '').strip()
        if not nome or nome in ('.', '..'):
            return False
        if any(c in nome for c in '\\/:*?"<>|'):
            return False
        return True

    @staticmethod
    def _estilos_e_cores_ler(caminho):
        try:
            with open(caminho, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception:
            return ''

    @classmethod
    def _estilos_e_cores_caminho_das_tags(cls):
        return os.path.join(cls._ESTILOS_E_CORES_DIR, ARQUIVO_DE_TAGS)

    @classmethod
    def _estilos_e_cores_tags(cls):
        """O `tags.json` inteiro, sempre nos dois blocos e sempre navegável.

        Devolve o esqueleto vazio quando o arquivo não existe ou está corrompido,
        em vez de estourar: a biblioteca precisa abrir mesmo sem tag nenhuma, e
        um JSON quebrado não pode derrubar a listagem das cinco dimensões.
        """
        dados = {}
        caminho = cls._estilos_e_cores_caminho_das_tags()
        if os.path.isfile(caminho):
            try:
                with open(caminho, 'r', encoding='utf-8') as f:
                    dados = json.load(f)
            except Exception:
                dados = {}
        if not isinstance(dados, dict):
            dados = {}
        tags = dados.get('tags')
        itens = dados.get('itens')
        if not isinstance(tags, list):
            tags = []
        if not isinstance(itens, dict):
            itens = {}
        # Normaliza para uma lista de nomes: o bloco `tags` é uma lista de
        # objetos `{"nome": ...}` justamente para poder crescer, mas quem lê só
        # quer os nomes.
        nomes = []
        for t in tags:
            nome = t.get('nome') if isinstance(t, dict) else t
            if isinstance(nome, str) and nome.strip() and nome not in nomes:
                nomes.append(nome.strip())
        limpos = {}
        for caminho_do_item, lista in itens.items():
            if not isinstance(lista, list):
                continue
            limpos[caminho_do_item] = [t for t in lista if isinstance(t, str) and t.strip()]
        return {'tags': nomes, 'itens': limpos}

    @staticmethod
    def _estilos_e_cores_descricao(dimensao, conteudo):
        """Uma linha do que o item é, tirada do próprio arquivo.

        JSON traz `descricao`; HTML traz o comentário de estrutura na segunda
        linha do topo. Não há metadado paralelo em lugar nenhum — a tag é a única
        coisa que mora fora do item, e mora só no `tags.json`.
        """
        if dimensao['extensao'] == '.json':
            try:
                dados = json.loads(conteudo)
            except Exception:
                return ''
            return (dados.get('descricao') or '').strip() if isinstance(dados, dict) else ''
        for linha in (conteudo or '').splitlines()[:6]:
            linha = linha.strip()
            if linha.startswith('<!--') and 'Rascunho de estrutura' not in linha and 'Animação:' not in linha:
                return linha[4:].replace('-->', '').strip()
        return ''

    @classmethod
    def _estilos_e_cores_item(cls, dimensao, base, arquivo, tags_por_item, subpasta=''):
        """Um item pronto para a tela: nome, conteúdo, descrição e tags."""
        caminho_no_disco = os.path.join(base, arquivo)
        conteudo = cls._estilos_e_cores_ler(caminho_no_disco)
        relativo = '/'.join(p for p in (dimensao['pasta'], subpasta, arquivo) if p)
        return {
            'arquivo': arquivo,
            'nome': arquivo[:-len(dimensao['extensao'])] if arquivo.endswith(dimensao['extensao']) else arquivo,
            'caminho': relativo,
            'pasta': subpasta,
            'conteudo': conteudo,
            'descricao': cls._estilos_e_cores_descricao(dimensao, conteudo),
            'tags': tags_por_item.get(relativo, []),
        }

    # ── Leitura ───────────────────────────────────────────────────────────────

    def carregar_estilos_e_cores(self, chave):
        """Uma dimensão inteira numa chamada só: nome + conteúdo + tags de cada item.

        ⚠️ É de propósito que o conteúdo venha junto da listagem. A versão antiga
        do Designer listava os arquivos e depois buscava o conteúdo de CADA um
        numa chamada separada — com as cinco dimensões populadas isso viraria 70+
        idas e voltas pela ponte pywebview a cada abertura de aba, e a janela
        congelava no meio. Uma chamada por dimensão, e mais nenhuma.

        A Parte 3 (as abas de dimensão do Designer) reusa este mesmo leitor.
        """
        dimensao = self._estilos_e_cores_dimensao(chave)
        if not dimensao:
            return {'success': False, 'error': 'Dimensão inválida.', 'itens': [], 'grupos': []}

        base = self._estilos_e_cores_pasta(dimensao)
        os.makedirs(base, exist_ok=True)
        indice = self._estilos_e_cores_tags()
        por_item = indice['itens']

        resposta = {
            'success': True,
            'dimensao': chave,
            'rotulo': dimensao['rotulo'],
            'singular': dimensao['singular'],
            'extensao': dimensao['extensao'],
            'tem_tag': dimensao['tem_tag'],
            'por_pasta': dimensao['por_pasta'],
            'quantas': dimensao['quantas'],
            'tags': indice['tags'],
            'itens': [],
            'grupos': [],
        }

        try:
            if dimensao['por_pasta']:
                resposta['grupos'] = self._estilos_e_cores_grupos(dimensao, base, por_item)
            else:
                for arquivo in sorted(os.listdir(base), key=str.lower):
                    # O `tags.json` mora na RAIZ da biblioteca, não dentro de uma
                    # dimensão — mas a guarda fica porque item e índice não podem
                    # se confundir nem se alguém copiar o arquivo para cá.
                    if arquivo == ARQUIVO_DE_TAGS or not arquivo.endswith(dimensao['extensao']):
                        continue
                    if not os.path.isfile(os.path.join(base, arquivo)):
                        continue
                    resposta['itens'].append(
                        self._estilos_e_cores_item(dimensao, base, arquivo, por_item))
        except Exception as e:
            return {'success': False, 'error': str(e), 'itens': [], 'grupos': []}

        return resposta

    @classmethod
    def _estilos_e_cores_grupos(cls, dimensao, base, por_item):
        """Animações: uma pasta por evento, cada uma com o seu `Explicação.md`."""
        grupos = []
        for pasta in sorted(os.listdir(base), key=str.lower):
            caminho_da_pasta = os.path.join(base, pasta)
            if not os.path.isdir(caminho_da_pasta):
                continue
            explicacao = cls._estilos_e_cores_ler(
                os.path.join(caminho_da_pasta, cls._ESTILOS_E_CORES_EXPLICACAO))
            itens = []
            for arquivo in sorted(os.listdir(caminho_da_pasta), key=str.lower):
                if not arquivo.endswith(dimensao['extensao']):
                    continue
                itens.append(cls._estilos_e_cores_item(
                    dimensao, caminho_da_pasta, arquivo, por_item, subpasta=pasta))
            grupos.append({'pasta': pasta, 'explicacao': explicacao, 'itens': itens})
        return grupos

    def carregar_dimensoes_de_estilos_e_cores(self):
        """A tabela das cinco dimensões, sem tocar no disco.

        A tela monta as pílulas a partir daqui em vez de repetir a lista no
        JavaScript: duas cópias da ordem canônica divergiriam na primeira vez que
        uma dimensão mudasse de rótulo.
        """
        return {'success': True, 'dimensoes': [dict(d) for d in self._ESTILOS_E_CORES_DIMENSOES]}

    def carregar_tags_de_estilos_e_cores(self):
        """O `tags.json` inteiro: as tags que existem e as de cada item."""
        return dict(self._estilos_e_cores_tags(), success=True)
