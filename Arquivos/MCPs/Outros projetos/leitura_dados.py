"""Onde os dados moram, e o que o usuário tirou do escopo do projeto consultado.

Uma pergunta só: **de onde sai o dado, e o que dele pode ser lido?** Quem corta e
serve em partes é o irmão, `formato.py`; `leitura.py` é a casca que reexporta os
dois, e é o endereço que os handlers importam.

⛔ **ESTE SERVIDOR NÃO IMPORTA NADA DO PROGRAMA.** Nem `api.py`, nem `modulos/`,
nem `caminhos.py`, nem `catalogo_mcp.py`, nem `comum.py`. Ele lê os ARQUIVOS que
o programa gerou, com código próprio. Importar faria dele um terceiro servidor do
programa — exatamente o que ele existe para não ser: ele é um item da biblioteca,
copiado para dentro do projeto do usuário, e o projeto vai para o Git.

O preço disso está escrito, e é conhecido:

⚠️ **`PASTAS_DAS_ROTINAS` É UMA CÓPIA, e é o ponto de envelhecimento deste MCP.**
No programa quem traduz id da rotina → nome da pasta é `caminhos.py`, e ele não
pode ser importado daqui. Quando um nome de pasta mudar lá, este servidor para de
achar aquele artefato **sem dar erro** — só responde "não gerado". É o preço
aceito da decisão de ser autocontido, e está dito também na `Descrição.md`.

── Onde os dados moram ──
    {pasta_do_programa}/Files/projects/{projeto consultado}/
    ├── Projeto/Workspace.json          root_folder · working_folders ·
    │                                   ignore_list · context_items · main_file
    ├── Análise/Índice de Símbolos.json
    └── Automação/Rotinas/{Pasta da Rotina}/

⚠️ **A FONTE É SEMPRE UM NOME DE PROJETO CADASTRADO, nunca um caminho vindo do
modelo.** O caminho sai do `Workspace.json` daquele projeto. Aceitar caminho
transformaria este MCP num leitor de disco sem cerca — e a cerca é o que faz ele
respeitar o que o usuário tirou do escopo.
"""

import json
import os


# ══════════════════════════════════════════════════ Onde o programa está ══

def _aqui():
    return os.path.dirname(os.path.abspath(__file__))


def _manifesto():
    """O `mcp.json` DESTA cópia. É dele que sai o caminho do programa."""
    try:
        with open(os.path.join(_aqui(), 'mcp.json'), 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


class SemPrograma(Exception):
    """O caminho gravado em `pasta_do_programa` não existe mais.

    ⚠️ A MENSAGEM FAZ PARTE DA ENTREGA. Sem ela o sintoma é "todas as
    ferramentas responderam vazio", e a investigação leva meia hora — porque
    nada no texto liga o vazio a uma pasta que mudou de lugar.
    """


def raiz_do_programa():
    """A pasta onde o Assistente de Código está instalado.

    Vem do `pasta_do_programa` do próprio `mcp.json`, que o programa preencheu
    quando este MCP foi ligado. Ele NÃO procura, não adivinha e não usa variável
    de ambiente: um servidor que sai caçando a instalação acha a errada quando
    existem duas — e existem duas hoje, uma com "- backup" no nome.
    """
    bruto = str(_manifesto().get('pasta_do_programa') or '').strip()
    if not bruto:
        raise SemPrograma(
            'este MCP não sabe onde o Assistente de Código está instalado: o '
            'campo "pasta_do_programa" do mcp.json está vazio. Desligue e '
            'religue este MCP na aba Arquivos → MCPs.')
    if not os.path.isdir(bruto):
        raise SemPrograma(
            'o programa não está mais em "%s"; desligue e religue este MCP na '
            'aba Arquivos → MCPs.' % bruto)
    return bruto


def pasta_de_projetos():
    return os.path.join(raiz_do_programa(), 'Files', 'projects')


def projetos_cadastrados():
    """Os nomes de projeto que existem na instalação. Lista, nunca caminho."""
    base = pasta_de_projetos()
    if not os.path.isdir(base):
        return []
    return sorted([e for e in os.listdir(base)
                   if os.path.isdir(os.path.join(base, e))], key=str.lower)


def pasta_de_dados(projeto, *partes):
    return os.path.join(pasta_de_projetos(), projeto, *partes)


# ══════════════════════════════════════ Os artefatos que as rotinas geram ══

# ⚠️ CÓPIA DO `PASTAS_DAS_ROTINAS` DO PROGRAMA — ver o aviso no topo. São 16
# chaves para 15 pastas: a Documentação Técnica tem DOIS ids em uso
# (`doc-tecnica` e `documentacao-tecnica`), os dois apontando para a mesma pasta.
PASTAS_DAS_ROTINAS = {
    'detector':             'Detector',
    'espelho':              'Espelho Markdown',
    'doc-tecnica':          'Documentação Técnica',
    'documentacao-tecnica': 'Documentação Técnica',
    'resumo-pastas':        'Resumo de Pastas',
    'glossario':            'Glossário',
    'indice-navegacao':     'Índice de Navegação',
    'identificadores':      'Índice de Identificadores',
    'grafo-imports':        'Grafo de Imports',
    'bibliotecas':          'Bibliotecas',
    'comentarios':          'Comentários',
    'pipeline':             'Pipeline',
    'hashes':               'Hashes',
    'embedding':            'Embedding Semântico',
    'sincronia':            'Sincronia',
    'duplicados':           'Duplicados',
}

# Qual rotina gera cada artefato, com o nome que a aba Automação mostra.
# ⚠️ ARTEFATO NÃO GERADO NÃO É ERRO: a resposta diz que falta E qual rotina o
# gera. É a diferença entre o assistente externo desistir da linha de
# investigação e o usuário saber que precisa rodar aquela rotina.
ROTINA_QUE_GERA = {
    'identificadores':      'Índice de Identificadores',
    'indice-navegacao':     'Índice de Navegação',
    'grafo-imports':        'Grafo de Imports',
    'documentacao-tecnica': 'Documentação Técnica',
    'resumo-pastas':        'Resumo de Pastas',
    'glossario':            'Glossário',
    'pipeline':             'Pipeline',
    'bibliotecas':          'Bibliotecas',
    'comentarios':          'Comentários',
    'duplicados':           'Duplicados',
    'embedding':            'Embedding Semântico',
    'espelho':              'Espelho Markdown',
}


class NaoGerado(Exception):
    """Um artefato que a rotina ainda não escreveu neste projeto."""


def falta(id_rotina, projeto):
    nome = ROTINA_QUE_GERA.get(id_rotina, id_rotina)
    return NaoGerado(
        'a rotina "%s" ainda não rodou no projeto "%s", então este artefato não '
        'existe. Peça ao usuário para rodá-la na aba Automação → Rotinas daquele '
        'projeto. Isto NÃO quer dizer que o projeto esteja vazio.' % (nome, projeto))


def pasta_da_rotina(projeto, id_rotina, *partes):
    pasta = PASTAS_DAS_ROTINAS.get(id_rotina)
    if not pasta:
        raise NaoGerado('rotina desconhecida: "%s".' % id_rotina)
    return pasta_de_dados(projeto, 'Automação', 'Rotinas', pasta, *partes)


def ler_texto(caminho):
    with open(caminho, 'r', encoding='utf-8', errors='replace') as f:
        return f.read()


def ler_json(caminho, padrao=None):
    try:
        with open(caminho, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return padrao


def artefato(projeto, id_rotina, arquivo):
    """O texto cru de um artefato. `NaoGerado` com o nome da rotina se faltar."""
    caminho = pasta_da_rotina(projeto, id_rotina, arquivo)
    if not os.path.isfile(caminho):
        raise falta(id_rotina, projeto)
    return ler_texto(caminho)


def arquivos_da_rotina(projeto, id_rotina, extensao='.md'):
    """Os arquivos de CONTEÚDO de uma rotina, em caminho relativo com `/`.

    ⚠️ Arquivo começado com `_` fica de fora: `_resumo.json`, `_hashes.json` e
    `_simbolos.json` são controle interno do programa, não saída da rotina.
    """
    base = pasta_da_rotina(projeto, id_rotina)
    if not os.path.isdir(base):
        return []
    achados = []
    for dirpath, dirs, fnames in os.walk(base):
        dirs.sort()
        for fname in sorted(fnames):
            if fname.startswith('_') or not fname.endswith(extensao):
                continue
            rel = os.path.relpath(os.path.join(dirpath, fname), base)
            achados.append(rel.replace(os.sep, '/'))
    return achados


# ══════════════════════════════════════════════════ O escopo do projeto ══
#
# ⚠️ ESTE BLOCO É A REESCRITA DO FUNIL DO PROGRAMA (`modulos/ignorados.py` +
# `_sub_escopo`/`_sub_ignore_checker`). Ele existe para que `grep`,
# `ler_arquivo` e `listar_pasta` respeitem o que o usuário tirou do escopo NO
# PROJETO CONSULTADO — e não o escopo do projeto onde este MCP está ligado.
#
# ⚠️ O LEITOR É SEMPRE `externo`. Um item da lista "Remover" ou de "Contexto sem
# leitura" pode carregar um `quem_pode_ler` que abre exceção para um dos dois
# leitores do programa; este servidor É o assistente externo, e passar o leitor
# errado aqui não daria erro nenhum — só a lista do outro.

LEITOR = 'externo'


def _pode_ler(item):
    valor = (item or {}).get('quem_pode_ler') or 'ninguem'
    return valor in ('ambos', LEITOR)


class Escopo:
    """O recorte do projeto consultado, lido do `Workspace.json` dele."""

    def __init__(self, projeto):
        self.projeto = projeto
        caminho = pasta_de_dados(projeto, 'Projeto', 'Workspace.json')
        if not os.path.isfile(caminho):
            raise ProjetoInvalido(
                '"%s" não é um projeto cadastrado neste Assistente de Código (não '
                'tem Workspace.json). Chame a ferramenta `projetos` para ver os '
                'nomes que você pode consultar.' % projeto)
        dados = ler_json(caminho, {}) or {}
        self.raiz = os.path.normpath(dados.get('root_folder') or '')
        self.removidos = dados.get('ignore_list') or []
        self.contexto = dados.get('context_items') or []
        self.principal = dados.get('main_file') or ''
        pastas = [os.path.normpath(p) for p in (dados.get('working_folders') or [])
                  if p and os.path.isdir(p)]
        # Projeto sem pasta de trabalho marcada continua funcionando como no
        # programa: a raiz inteira. Só quem escolheu recortar é recortado.
        self.pastas = pastas or ([self.raiz] if self.raiz else [])

    # ── As três perguntas do funil ──
    def removido(self, caminho):
        """O usuário tirou este caminho do escopo (sub-aba Remover)?"""
        caminho = os.path.normpath(caminho)
        for item in self.removidos:
            ip = os.path.normpath(item.get('path') or '')
            if not ip:
                continue
            if item.get('type') == 'file':
                casou = (caminho == ip)
            elif item.get('recursive', True):
                casou = (caminho == ip or caminho.startswith(ip + os.sep))
            else:
                casou = (caminho == ip)
            if casou and not _pode_ler(item):
                return True
        return False

    def descricao_de_contexto(self, caminho):
        """A frase do usuário para um item "contexto sem leitura", ou `None`.

        ⚠️ Sempre recursivo: item de contexto não tem `recursive` para
        consultar, e uma pasta marcada "não leia" vale para tudo dentro dela.
        """
        caminho = os.path.normpath(caminho)
        for item in self.contexto:
            ip = os.path.normpath(item.get('path') or '')
            if not ip:
                continue
            if ((caminho == ip or caminho.startswith(ip + os.sep))
                    and not _pode_ler(item)):
                return item.get('description') or '(sem descrição)'
        return None

    def dentro(self, caminho):
        alvo = os.path.normpath(caminho)
        for pasta in self.pastas:
            if alvo == pasta or alvo.startswith(pasta + os.sep):
                return True
        return False

    # ── Caminhos ──
    def resolver(self, relativo):
        """Um caminho relativo do modelo, resolvido contra a raiz do projeto.

        ⚠️ Caminho ABSOLUTO é recusado, e `..` não escapa: nada fora da raiz do
        projeto consultado pode ser lido, mesmo que o modelo peça.
        """
        if not isinstance(relativo, str) or not relativo.strip():
            raise ErroDeUso('caminho vazio ou inválido.')
        if not self.raiz:
            raise ErroDeUso(
                'o projeto "%s" não tem pasta raiz configurada — o usuário precisa '
                'defini-la na aba Trabalho daquele projeto.' % self.projeto)
        bruto = relativo.strip().replace('/', os.sep)
        if os.path.isabs(bruto):
            raise ErroDeUso(
                'caminho absoluto não é permitido: "%s". Peça o caminho RELATIVO à '
                'raiz do projeto consultado.' % relativo)
        cheio = os.path.normpath(os.path.join(self.raiz, bruto))
        if cheio != self.raiz and not cheio.startswith(self.raiz + os.sep):
            raise ErroDeUso('caminho fora da raiz do projeto "%s": "%s".'
                            % (self.projeto, relativo))
        return cheio

    def relativo(self, caminho):
        try:
            rel = os.path.relpath(caminho, self.raiz).replace(os.sep, '/')
        except Exception:
            return caminho
        return '.' if rel == '.' else rel

    def erro_fora_do_escopo(self, pedido):
        """A mensagem diz o que houve E onde dá para olhar.

        ⚠️ O silêncio — "nenhuma ocorrência" para uma pasta removida — faz o
        modelo concluir que a pasta está vazia, e daí ele afirma coisas sobre
        código que nunca leu.
        """
        nomes = [self.relativo(p) for p in self.pastas] or ['(nenhuma)']
        return ErroDeUso(
            '"%s" está fora do escopo do projeto "%s". As pastas de trabalho dele '
            'são: %s. Não é que o caminho não exista — ele não faz parte do que o '
            'usuário marcou como projeto.' % (pedido, self.projeto, ', '.join(nomes)))

    def caminhar(self):
        """`os.walk` sobre as pastas de trabalho, sem visitar a mesma duas vezes.

        Pastas de trabalho aninhadas são possíveis (`Program` e `Program/Code`);
        sem este controle, todo arquivo da segunda apareceria em dobro.
        """
        vistos = set()
        for base in self.pastas:
            for dirpath, dirs, files in os.walk(base):
                chave = os.path.normcase(os.path.normpath(dirpath))
                if chave in vistos:
                    dirs.clear()
                    continue
                vistos.add(chave)
                yield dirpath, dirs, files


class ErroDeUso(Exception):
    """Erro cuja mensagem foi escrita para o MODELO ler e corrigir a chamada."""


class ProjetoInvalido(ErroDeUso):
    """Nome que não é um projeto cadastrado."""


class ProjetoRecusado(ErroDeUso):
    """Projeto cadastrado, mas que o usuário não marcou como consultável.

    ⚠️ A mensagem NÃO pode ser "não encontrado". Um projeto que existe e não foi
    liberado é uma decisão do usuário, e dizer "não encontrado" faz o modelo
    concluir que o projeto não existe — e desistir em vez de pedir a liberação.
    """



# ══════════════════════════════════════════════════ O carimbo de frescor ══

def carimbo(projeto):
    """Uma linha avisando que a documentação pode estar velha. `''` se em dia.

    ⚠️ **Fala só quando NÃO está em dia.** Silêncio é o normal. Um aviso em toda
    resposta vira ruído que o modelo aprende a ignorar em três chamadas — o
    oposto do que ele existe para fazer.

    ⚠️ **Mais raso que o do programa, e de propósito.** Lá o carimbo também
    pergunta se uma rotina está rodando AGORA, e isso exige a `Api`. Aqui ele lê
    dois arquivos: o `Pendências.json` (o ciclo parou no meio) e a existência da
    linha de base de hashes (o projeto nunca foi indexado).
    """
    try:
        base = pasta_de_dados(projeto, 'Automação', 'Rotinas')
        pend = ler_json(os.path.join(base, 'Pendências.json'), {}) or {}
        pendentes = pend.get('pendentes') or []
        if pendentes and not pend.get('finalizado_em'):
            return ('[desatualizado] O último ciclo de rotinas do projeto "%s" parou '
                    'antes de terminar (%d pendente(s)). Parte da documentação dele é '
                    'de antes da última mudança.' % (projeto, len(pendentes)))
        if not os.path.isfile(os.path.join(base, 'Hashes', 'hashes.json')):
            return ('[desatualizado] O projeto "%s" ainda não tem linha de base de '
                    'hashes: nenhuma rotina rodou nele. O que existir de documentação '
                    'pode estar incompleto ou ausente.' % projeto)
    except Exception:
        # Carimbo que estoura não pode derrubar a ferramenta: o valor dele é
        # marginal, e o da resposta não.
        pass
    return ''
