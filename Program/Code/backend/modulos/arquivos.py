"""A biblioteca da aba Arquivos: o que ela TEM, e onde cada item está.

Este arquivo era 2.604 linhas e virou nove, pelo teto de 500 da AMF — que é
obrigatório. O corte segue a regra que já dividiu os Backups e o Inspetor:
**cada arquivo responde uma pergunta diferente**, e não "um pedaço de cima, um
pedaço de baixo".

| Arquivo | A pergunta que ele responde |
|---|---|
| `arquivos.py` | o que a biblioteca tem, e onde cada item está |
| `arquivos_crud.py` | como se mexe num item (criar, formatar, apagar, ler) |
| `arquivos_assistentes.py` | quem é o assistente externo, e PARA ONDE cada categoria vai |
| `arquivos_copia.py` | COMO um item é copiado para dentro do projeto |
| `arquivos_ativacao.py` | o que acontece ao ligar e ao desligar um item |
| `arquivos_mcp.py` | como os dois servidores MCP do programa entram no projeto |
| `arquivos_inicio_rapido.py` | QUAIS itens vão, e que pastas nascem |
| `arquivos_preparar.py` | o que acontece quando o início rápido roda |
| `arquivos_rotinas.py` | os arquivos que uma rotina gerou |

`ArquivosMixin` continua sendo o nome único que `api.py` importa: ele COMPÕE os
oito, no mesmo padrão de `InspetorMixin` (Convenção 5 da Arquitetura modular).
Nenhum dos nove tem `__init__` nem `super()`, o que torna a herança múltipla
inerte — e é isso que deixa os métodos se chamarem por `self` atravessando
arquivo, como sempre fizeram.

⚠️ AS CONSTANTES DE CATEGORIA FICAM AQUI, e só aqui. `_ARQUIVOS_FOLDER`,
`_ARQUIVOS_COM_ORIGEM`, `_ARQUIVOS_SEM_CRUD_GENERICO`, `_MCPS_DO_PROGRAMA`,
`_ARQUIVOS_ITEM_DE_ARQUIVO` — os outros oito as leem por `self`. Uma segunda
cópia em qualquer um deles divergiria na primeira categoria nova, e o sintoma
seria uma categoria que a listagem mostra e a cópia ignora, sem erro nenhum.

O que sobrou neste arquivo é a GRAMÁTICA da biblioteca: o que é item e o que é
grupo, como um caminho vira identidade, onde o metadado mora — e a listagem, que
é a única leitora de tudo isso ao mesmo tempo.
"""

from .constantes import *
# A pasta da 6ª categoria vem do módulo que é dono dela, não de uma segunda
# cópia da string aqui — duas cópias divergem na primeira renomeação.
from .estilos_e_cores import PASTA_DE_ESTILOS_E_CORES
# O nome do apoio que faz um molde ser instrução — ver `regras_formato.py`.
from .regras_formato import ARQUIVO_COMO_APLICAR

from .arquivos_crud import ArquivosCrudMixin
from .arquivos_assistentes import ArquivosAssistentesMixin
from .arquivos_copia import ArquivosCopiaMixin
from .arquivos_ativacao import ArquivosAtivacaoMixin
from .arquivos_mcp import ArquivosMcpMixin
# Os MCPs de TERCEIRO são DOIS arquivos, e nenhum deles é `arquivos_mcp.py`: a
# pergunta é outra, e cada peça responde uma. `_manifesto` diz o que o `mcp.json`
# manda; `_terceiros` diz o que acontece ao ligar (a cópia da pasta e a entrada
# no registro). Juntar os três passaria do teto de 500 linhas da AMF.
from .arquivos_mcp_manifesto import ArquivosMcpManifestoMixin
from .arquivos_mcp_terceiros import ArquivosMcpTerceirosMixin
from .arquivos_inicio_rapido import ArquivosInicioRapidoMixin
from .arquivos_preparar import ArquivosPrepararMixin
from .arquivos_rotinas import ArquivosRotinasMixin


class ArquivosMixin(ArquivosCrudMixin, ArquivosAssistentesMixin,
                    ArquivosCopiaMixin, ArquivosAtivacaoMixin,
                    ArquivosMcpMixin, ArquivosMcpManifestoMixin,
                    ArquivosMcpTerceirosMixin,
                    ArquivosInicioRapidoMixin,
                    ArquivosPrepararMixin, ArquivosRotinasMixin):

    # ── Arquivos (Skills / Comandos / MCPs / Códigos prontos /
    #    Regras e instruções) ───────────────────────────────────────────────
    # "Regras prontas" e "Instruções" eram duas categorias quase iguais lado a
    # lado; viraram uma só, com o tipo dentro. Mesmo nome da pasta de saída, da
    # sub-aba e do comando — é o que torna tudo fácil de encontrar.
    _ARQUIVOS_FOLDER = {
        'skills': 'Skills',
        'comandos': 'Comandos',
        'mcps': 'MCPs',
        'codigos': 'Códigos prontos',
        'regras-instrucoes': 'Regras e instruções',
        # As duas categorias novas. "Instruções base" é o arquivo que o
        # assistente lê PRIMEIRO (o CLAUDE.md / AGENTS.md da raiz); "Agentes"
        # são os subagentes. As duas seguem a mesma mecânica das de cima: um
        # item é uma pasta, e pasta sem arquivo solto dentro é grupo.
        'instrucoes-base': 'Instruções base',
        'agentes': 'Agentes',
        # ⚠️ Só a PASTA entra aqui. Toda a listagem, o CRUD e as tags de
        # "Estilos e cores" moram em `estilos_e_cores*.py`, porque os itens dela
        # são ARQUIVOS SOLTOS e todo o caminho genérico deste módulo pressupõe
        # pasta — `list_arquivos` pula quem não passa em `isdir`,
        # `create_arquivo_item` faz `os.makedirs` e `delete_arquivo_item` chama
        # `shutil.rmtree`. Ela também NÃO entra em `_ARQUIVOS_COM_ORIGEM`: não
        # tem o par Do programa / Geral, e é isso que a mantém fora do
        # "Preparar projeto".
        'estilos-e-cores': PASTA_DE_ESTILOS_E_CORES,
    }

    # O tipo do molde não fica em metadado nenhum: é a FORMA que diz qual é.
    # Um `.md` só é regra; o principal mais apoio (`Como aplicar.md`) é
    # instrução — a mesma leitura que `regras.py` faz da base do projeto. Um
    # _meta.json paralelo ao conteúdo é exatamente o que dessincroniza na
    # primeira edição — o mesmo motivo que tirou o _meta.json das regras.

    # Categorias que separam itens "do programa" (que o chat pode consultar) de
    # itens "gerais". A origem de cada item fica num _meta.json por categoria.
    _ARQUIVOS_COM_ORIGEM = ('skills', 'comandos', 'mcps', 'regras-instrucoes')

    # Categorias cujos itens NÃO são pastas, e que por isso não passam pelo CRUD
    # genérico deste módulo. A guarda não é teórica: `list_arquivos` devolveria as
    # cinco pastas de DIMENSÃO como se fossem itens, `create_arquivo_item` criaria
    # uma pasta vazia dentro de `Cores/`, e `delete_arquivo_item` chamaria
    # `shutil.rmtree` numa dimensão inteira — apagando a biblioteca sem confirmação.
    # A tela nunca chama estes métodos com esta chave, mas a ponte pywebview expõe
    # todos eles ao JavaScript, e um engano ali é irreversível.
    _ARQUIVOS_SEM_CRUD_GENERICO = ('estilos-e-cores',)

    # Os dois itens de `mcps` que o programa traz prontos (Assistente e
    # Trabalhos, os dois servidores MCP — ver `_MCP_SERVIDORES`). Não são
    # favoritáveis, deletáveis nem configuráveis pela estrela: é um FATO sobre
    # o item, não uma escolha do usuário (D7 da discussão que os criou).
    _MCPS_DO_PROGRAMA = ('Assistente', 'Trabalhos')

    # Nome do arquivo de descrição de um item. O canônico é o acentuado — é ele
    # que o /codigo-pronto-extrair gera e é ele que criamos aqui. Os outros três
    # ficam como tolerância para itens que chegaram de fora.
    # Comparado contra f.lower(), então as entradas são minúsculas: .lower() põe
    # em minúsculas mas NÃO tira acento, e 'descrição' != 'descricao'.
    _ARQUIVOS_DESC_CANONICO = 'Descrição.md'
    _ARQUIVOS_DESC_FILES = ('descrição.md', 'descricao.md', 'readme.md', 'description.md')

    # Onde mora a origem de cada item. Até 2026-09-02 era um `_meta.json`
    # DENTRO da pasta da categoria, e por isso toda varredura precisava de uma
    # guarda para não confundi-lo com conteúdo do usuário. Agora as categorias
    # só têm o que o usuário põe lá, e os metadados moram juntos, num arquivo
    # por categoria: `Arquivos/Metadados/skills-meta.json`, `comandos-meta.json`,
    # `mcps-meta.json`, e assim por diante. Sem `_` na frente (D26).
    _ARQUIVOS_META_DIR = 'Metadados'

    def _arquivos_meta_path(self, kind):
        base = os.path.join(ARQUIVOS_DIR, self._ARQUIVOS_META_DIR)
        os.makedirs(base, exist_ok=True)
        return os.path.join(base, '%s-meta.json' % kind)

    def _arquivos_meta_load(self, kind):
        try:
            path = self._arquivos_meta_path(kind)
            if os.path.isfile(path):
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                if isinstance(data, dict):
                    return data
        except Exception:
            pass
        return {}

    # ── Grupo × item, e o caminho como identidade ─────────────────────────
    #
    # A regra é a mais simples que existe, e foi escolhida por isso: uma pasta
    # com PELO MENOS UM arquivo solto direto dentro é um ITEM; uma pasta sem
    # nenhum é um GRUPO, e o programa desce nas subpastas dela. Não há exigência
    # de extensão nem de arquivo com nome combinado — qualquer arquivo já basta.
    # Assim o programa não precisa conhecer o formato de item de cada categoria,
    # e o usuário organiza a biblioteca arrastando pasta, sem cadastrar nada.
    #
    # (Até 2026-09-02 havia aqui uma exceção para o `_meta.json`, que morava na
    # raiz da categoria e faria a raiz inteira virar "item". Com os metadados
    # fora, em `Arquivos/Metadados/`, a regra vale sozinha.)

    # ⚠️ AS CATEGORIAS EM QUE UM ARQUIVO SOLTO TAMBÉM É UM ITEM, e não uma
    # exceção genérica: é um mapa, categoria por categoria, porque a resposta
    # muda com a categoria. Em Skills um `.md` largado na raiz é lixo — a skill
    # é uma pasta com `SKILL.md` e os anexos dela. Em Agentes é o contrário: um
    # subagente do Claude Code É um `.md` só, e obrigar uma pasta em volta
    # inventaria uma camada que o produto não tem e que o usuário teria de
    # manter à mão.
    #
    # ⚠️ E NUMA CATEGORIA DESSAS A PASTA É SEMPRE GRUPO, nunca item. As duas
    # gramáticas NÃO podem conviver: `Agentes/Backend/revisor.md` é uma pasta
    # com arquivo solto dentro, e pela regra clássica ela seria o ITEM — o
    # `revisor.md` nunca apareceria, e o usuário teria criado um grupo que
    # engole os agentes dele. Ou a pasta é item, ou o arquivo é; em Agentes,
    # escolhemos o arquivo, e a pasta passa a ser só a gaveta.
    #
    # Instruções base entrou aqui em 2026-09-21, pelo mesmo motivo de Agentes:
    # o item É o `CLAUDE.md`/`AGENTS.md` que vai para a raiz do projeto, e a
    # pasta em volta só existia porque a categoria não aceitava arquivo solto.
    _ARQUIVOS_ITEM_DE_ARQUIVO = {'agentes': ('.md',), 'instrucoes-base': ('.md',)}

    # Fundo do poço da recursão. Não é limite de projeto: é o que impede uma
    # pasta com link circular de rodar para sempre.
    _ARQUIVOS_PROFUNDIDADE_MAXIMA = 12

    @classmethod
    def _arquivos_e_grupo(cls, pasta):
        """(tem_arquivo_solto, subpastas, arquivos) de uma pasta.

        Devolve os três de uma vez porque quem pergunta uma coisa sempre precisa
        das outras logo em seguida, e é um `listdir` só no mesmo lugar.

        ⚠️ O TERCEIRO VALOR SÓ INTERESSA A QUEM ACEITA ITEM-ARQUIVO (hoje só
        Agentes). Quem faz a checagem clássica de grupo continua olhando apenas
        os dois primeiros, e nada muda para ele.
        """
        tem_arquivo = False
        subpastas = []
        arquivos = []
        try:
            for nome in sorted(os.listdir(pasta), key=str.lower):
                caminho = os.path.join(pasta, nome)
                if os.path.isdir(caminho):
                    subpastas.append(nome)
                else:
                    tem_arquivo = True
                    arquivos.append(nome)
        except Exception:
            pass
        return tem_arquivo, subpastas, arquivos

    def _arquivos_percorrer(self, base, prefixo='', nivel=0, extensoes=None):
        """Os itens de uma categoria, como (caminho_relativo, caminho_absoluto).

        O caminho relativo usa SEMPRE '/' como separador, inclusive no Windows:
        ele viaja para o JavaScript, entra em `_meta.json` e vira chave da lista
        de ativados do projeto. Um separador que muda com o sistema operacional
        faria a mesma biblioteca ler diferente em máquinas diferentes.

        ⚠️ `extensoes` LIGA O ITEM-ARQUIVO, e quem passa é `list_arquivos`, a
        partir de `_ARQUIVOS_ITEM_DE_ARQUIVO`. Com ele, um arquivo com uma
        dessas extensões vira item — e o `rel` dele é o nome SEM A EXTENSÃO.
        Isso não é cosmético: `rel` é a identidade do item em todo o programa
        (a chave do `_meta.json`, a entrada da lista de ativados do projeto), e
        `revisor.md` como identidade faria o cartão, o grupo e a colisão de slug
        carregarem um `.md` no meio do nome para sempre.
        """
        if nivel > self._ARQUIVOS_PROFUNDIDADE_MAXIMA:
            return []
        achados = []
        _, subpastas, arquivos = self._arquivos_e_grupo(base)

        # Os arquivos vêm antes das subpastas só para a lista sair estável; a
        # ordenação final é de quem mostra.
        for nome in (arquivos if extensoes else []):
            if not nome.lower().endswith(tuple(e.lower() for e in extensoes)):
                continue
            sem_ext = os.path.splitext(nome)[0]
            if not sem_ext:
                continue
            achados.append((f'{prefixo}{sem_ext}', os.path.join(base, nome)))

        for nome in subpastas:
            caminho = os.path.join(base, nome)
            rel = f'{prefixo}{nome}'
            # ⚠️ COM `extensoes`, A PASTA NUNCA É ITEM — desce sempre. Ver o
            # aviso de `_ARQUIVOS_ITEM_DE_ARQUIVO`: numa categoria em que o
            # arquivo é o item, uma pasta com arquivos dentro é a GAVETA deles.
            if extensoes:
                achados.extend(self._arquivos_percorrer(
                    caminho, rel + '/', nivel + 1, extensoes))
                continue
            tem_arquivo, _, _ = self._arquivos_e_grupo(caminho)
            if tem_arquivo:
                achados.append((rel, caminho))
            else:
                achados.extend(self._arquivos_percorrer(caminho, rel + '/', nivel + 1))
        return achados

    def _arquivos_item_path(self, folder, item):
        """O caminho absoluto de um item, ou None se ele sair da categoria.

        A validação não é teórica: `item` chega do JavaScript, e a ponte
        pywebview expõe todos estes métodos. Sem ela, um '..' no nome do item
        alcançaria qualquer pasta do disco.
        """
        base = os.path.abspath(os.path.join(ARQUIVOS_DIR, folder))
        alvo = os.path.abspath(os.path.join(base, (item or '').replace('/', os.sep)))
        if alvo != base and not alvo.startswith(base + os.sep):
            return None
        return alvo

    def _arquivos_caminho_do_item(self, kind, item_name):
        """O caminho de um item, seja ele pasta ou arquivo solto.

        ⚠️ EXISTE PORQUE `item_name` NÃO CARREGA A EXTENSÃO. `_arquivos_item_path`
        devolve `<categoria>/<item>`, que é a pasta quando o item é pasta e um
        caminho inexistente quando ele é um `.md` solto. Todo mundo que só tinha
        `isdir` na mão recusava o item-arquivo com "Item não encontrado".

        ⚠️ Numa categoria com `_ARQUIVOS_ITEM_DE_ARQUIVO` a resposta é SEMPRE um
        arquivo, e nunca uma pasta — é a mesma gramática única de
        `_arquivos_percorrer`. Aceitar pasta aqui daria um item que a listagem
        não mostra: o botão de desligar apagaria algo que a tela nunca listou.
        """
        folder = self._ARQUIVOS_FOLDER.get(kind)
        if not folder:
            return None
        base = self._arquivos_item_path(folder, item_name)
        if not base:
            return None
        extensoes = self._ARQUIVOS_ITEM_DE_ARQUIVO.get(kind)
        if extensoes:
            for ext in extensoes:
                if os.path.isfile(base + ext):
                    return base + ext
            return None
        return base if os.path.isdir(base) else None

    @classmethod
    def _arquivos_arquivos_do_item(cls, src):
        """Os arquivos que compõem o item, como (nome, caminho absoluto).

        Um item-arquivo tem um só, e é ele mesmo; um item-pasta tem os arquivos
        soltos da raiz dele. Quem copia e quem desativa precisam dos dois casos,
        e sem este ajudante os dois repetiriam o mesmo `if isfile` — que é onde
        um deles acabaria esquecido.
        """
        if os.path.isfile(src):
            return [(os.path.basename(src), src)]
        try:
            nomes = sorted(os.listdir(src), key=str.lower)
        except Exception:
            return []
        return [(n, os.path.join(src, n)) for n in nomes
                if os.path.isfile(os.path.join(src, n))]

    def _arquivos_meta_de(self, meta, caminho):
        """A entrada do `_meta.json` de um item, aceitando a chave antiga.

        A chave passou a ser o CAMINHO relativo (`Front design/Mobile`) porque
        só o nome colidia: dois itens de mesmo nome em grupos diferentes
        dividiam a mesma entrada e a descrição de um aparecia no outro. A queda
        para o nome sozinho mantém legível o `_meta.json` de quem já existia
        antes dos grupos — a gravação já sai no formato novo.
        """
        return meta.get(caminho) or meta.get(caminho.rsplit('/', 1)[-1]) or {}

    def _arquivos_desc_file(self, fnames):
        """Acha o arquivo de descrição de um item, na ordem de preferência de
        _ARQUIVOS_DESC_FILES — não na ordem em que o SO devolveu a pasta. Um item
        que tenha o nome novo e o antigo lado a lado usa o novo, sempre."""
        por_lower = {f.lower(): f for f in fnames}
        for nome in self._ARQUIVOS_DESC_FILES:
            if nome in por_lower:
                return por_lower[nome]
        return None

    def _gravar_molde_regra(self, dest, item_name, description, extra):
        """Grava o molde no MESMO formato que a pasta do projeto usa.

        A cópia para a biblioteca é manual (Ctrl+C/Ctrl+V), então formato certo
        na origem = zero trabalho depois de arrastar a pasta: o que sai daqui é
        exatamente o que `activate_item` copia para dentro do projeto.
        """
        extra = extra or {}
        quando = (extra.get('quando') or '').strip()
        corpo = (extra.get('regra') or extra.get('texto') or '').strip()
        nome_curto = item_name.rsplit('/', 1)[-1]
        principal = os.path.join(dest, self._regras_nome_principal(nome_curto))
        if (extra.get('tipo') or 'regra') == 'instrucao':
            texto = self.montar_instrucao_markdown(nome_curto, description, quando, corpo)
            # É o segundo arquivo que faz a pasta ser uma instrução. Só nasce
            # se não existir: reformatar não pode apagar uma receita escrita.
            como_aplicar = os.path.join(dest, ARQUIVO_COMO_APLICAR)
            if not os.path.isfile(como_aplicar):
                with open(como_aplicar, 'w', encoding='utf-8') as f:
                    f.write(self.montar_como_aplicar_markdown(nome_curto))
        else:
            texto = self.montar_regra_markdown(nome_curto, description, quando, corpo)
        with open(principal, 'w', encoding='utf-8') as f:
            f.write(texto)

    def _regras_item_tipo(self, item_path):
        """'instrucao' se o molde tem mais de um `.md`; 'regra' se tem um só."""
        nome = os.path.basename(item_path)
        return self._regras_tipo(self._regras_arquivos_do_item(item_path, nome))

    def _regras_item_principal(self, item_path, item_name):
        """O arquivo do molde de onde saem a descrição e o 'quando se aplica'."""
        arquivos = self._regras_arquivos_do_item(item_path, item_name.rsplit('/', 1)[-1])
        return os.path.join(item_path, arquivos[0] if arquivos else f'{item_name}.md')

    def _agente_arquivo_do_item(self, item_path):
        """O `.md` de um agente, ou None.

        ⚠️ NÃO reaproveita `_arquivo_principal_do_item`: aquele DESISTE quando
        há mais de um `.md` sem um claramente principal, porque lá a escolha
        errada COPIA o arquivo errado para dentro do projeto. Aqui o pior caso é
        um cartão mostrar a descrição do irmão — e ficar sem descrição nenhuma
        é pior que isso. Por isso este cai no primeiro em ordem alfabética,
        depois de preferir o que tem o nome da pasta.
        """
        # O item-arquivo já É o `.md`: não há o que escolher.
        if os.path.isfile(item_path):
            return item_path
        try:
            mds = sorted((f for f in os.listdir(item_path) if f.lower().endswith('.md')),
                         key=str.lower)
        except Exception:
            return None
        if not mds:
            return None
        alvo = self._slug_universal(os.path.basename(item_path))
        for f in mds:
            if self._slug_universal(os.path.splitext(f)[0]) == alvo:
                return os.path.join(item_path, f)
        return os.path.join(item_path, mds[0])

    def list_arquivos(self, kind):
        if kind in self._ARQUIVOS_SEM_CRUD_GENERICO:
            return {'success': False, 'items': [], 'error': 'Categoria com caminho próprio.'}
        folder = self._ARQUIVOS_FOLDER.get(kind)
        if not folder:
            return {'success': False, 'items': [], 'error': 'Tipo inválido.'}
        base = os.path.join(ARQUIVOS_DIR, folder)
        os.makedirs(base, exist_ok=True)
        meta = self._arquivos_meta_load(kind)
        items = []
        try:
            # A varredura é recursiva: `name` é o CAMINHO relativo à categoria
            # ("Arquitetura modular/Arquitetura modular - Desktop"), e é ele que
            # identifica o item daqui para a frente — na ativação, no
            # `_meta.json` e na lista de ativados do projeto. `rotulo` é só a
            # última parte, para o cartão não mostrar o caminho inteiro; e
            # `grupo` é o que sobra, que a tela usa para desenhar a árvore.
            for name, item_path in self._arquivos_percorrer(
                    base, extensoes=self._ARQUIVOS_ITEM_DE_ARQUIVO.get(kind)):
                rotulo = name.rsplit('/', 1)[-1]
                grupo = name.rsplit('/', 1)[0] if '/' in name else ''
                info = self._arquivos_meta_de(meta, name)

                # Regras e instruções não têm Descrição.md: a descrição é uma
                # seção dentro do próprio arquivo (D38), então a leitura é outra.
                if kind == 'regras-instrucoes':
                    tipo = self._regras_item_tipo(item_path)
                    principal = self._ler_texto(self._regras_item_principal(item_path, rotulo))
                    try:
                        file_count = len([f for f in os.listdir(item_path) if f.endswith('.md')])
                    except Exception:
                        file_count = 0
                    items.append({
                        'name': name,
                        'rotulo': rotulo,
                        'grupo': grupo,
                        'description': self._descricao_de(principal),
                        'quando': self._quando_se_aplica(principal),
                        'tipo': tipo,
                        'file_count': file_count,
                        'origem': info.get('origem', 'geral'),
                    })
                    continue

                # ⚠️ O AGENTE NÃO TEM `Descrição.md`, E NÃO DEVE TER. A descrição
                # dele mora no `description:` do frontmatter, e não por gosto: é
                # esse campo que o Claude Code lê para decidir sozinho se aciona
                # aquele subagente. Um segundo arquivo repetindo a mesma frase
                # criaria duas verdades — e a que o assistente obedece é a do
                # frontmatter, não a nossa.
                #
                # `ferramentas` sai do `tools:` do mesmo cabeçalho, e vazio ali
                # NÃO quer dizer "nenhuma": quer dizer "herda todas", que é o
                # padrão do produto. Quem desenhar a tela precisa dizer isso com
                # palavra, e não deixar um campo em branco insinuar o contrário.
                if kind == 'agentes':
                    principal = self._agente_arquivo_do_item(item_path)
                    campos, _corpo = self._frontmatter_partes(
                        self._ler_texto(principal) if principal else '')
                    file_count = len(self._arquivos_arquivos_do_item(item_path))
                    items.append({
                        'name': name,
                        'rotulo': rotulo,
                        'grupo': grupo,
                        'description': campos.get('description', '')[:400],
                        'agente_nome': campos.get('name', ''),
                        'ferramentas': campos.get('tools', ''),
                        'modelo': campos.get('model', ''),
                        'file_count': file_count,
                        'origem': info.get('origem', 'geral'),
                    })
                    continue

                desc = ''
                file_count = 0
                try:
                    # Item-arquivo (Instruções base): não há `Descrição.md` ao
                    # lado — a descrição é a primeira linha de texto do próprio
                    # arquivo, lida pela mesma regra do bloco abaixo.
                    if os.path.isfile(item_path):
                        fnames, f, pasta = [item_path], item_path, ''
                    else:
                        fnames = os.listdir(item_path)
                        f, pasta = self._arquivos_desc_file(fnames), item_path
                    file_count = len(fnames)
                    if f:
                        with open(os.path.join(pasta, f), 'r', encoding='utf-8') as fh:
                            for line in fh:
                                raw = line.strip()
                                if not raw:
                                    continue
                                # A 1ª linha costuma ser o título (= nome do item),
                                # que o card já mostra em cima. Pular, senão o
                                # resumo repete o nome e a descrição some.
                                if raw.startswith('#'):
                                    continue
                                desc = raw[:200]
                                break
                except Exception:
                    pass
                items.append({'name': name, 'rotulo': rotulo, 'grupo': grupo,
                              'description': desc, 'file_count': file_count,
                              'origem': info.get('origem', 'geral')})
        except Exception as e:
            return {'success': False, 'items': [], 'error': str(e)}
        return {'success': True, 'items': items}
