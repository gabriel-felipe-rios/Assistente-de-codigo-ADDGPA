"""Mapa da mudança → Pipeline — o esqueleto de cada Versão, calculado.

⚠️ **O ESQUELETO É CALCULADO, NUNCA LIDO DO MODELO.** `PipelineIndiceMixin` já
separa as duas coisas: *o programa monta as cadeias e pede ao modelo apenas a
frase de cada passo e o nome de cada cadeia; nomes de arquivo, ordem e
agrupamento vêm do parser*. Aqui só a metade determinística é usada. Se o
`pipeline.md` daquela Versão existir, as frases entram como rótulo; se não
existir, o desenho sai igual, só sem elas.

Como o esqueleto de uma Versão antiga é obtido, já que o código daquele momento
não está mais no disco:

1. o `Análise/Índice de Símbolos.json` **guardado na Versão** vira o `indice`;
2. o código **guardado na Versão** (em `arquivos/`, pelo hash) vira as `fontes`;
3. `build_call_graph(project_name, indice, fontes)` monta o grafo de chamadas
   daquele momento;
4. `_pl_esqueleto(project_name, grafo)` transforma o grafo em cadeias.

Nenhum dos quatro passos chama o modelo, e nenhum lê o disco de agora. É por
isso que o Índice de Símbolos **trava a cópia**: sem ele, a Versão nasce sem
este formato e não há como recuperá-lo depois.

Os cinco modos (Fases · Raias · Sequência · Tabela · Fita) comem o MESMO
payload — o que muda entre eles é o desenho, não o dado. A camada de cada
arquivo (`cam-backend`, `cam-markup`, …) é decidida no front por
`vpCamadaDoArquivo`, que já existe; repeti-la aqui seria uma segunda fonte da
verdade para a mesma pergunta.

⚠️ Três leituras foram desenhadas e RECUSADAS — *Trilho pareado*, *Cadeias* e
*Narrativa*. Não recriar.
"""

import re

from .constantes import *
from . import versoes
from . import backups_diff


CAMINHO_DO_INDICE = '%s/%s' % (PASTA_ANALISE, ARQUIVO_INDICE_DE_SIMBOLOS)
CAMINHO_DO_PIPELINE = '%s/%s/Pipeline/pipeline.md' % (PASTA_AUTOMACAO, PASTA_ROTINAS)
# Desde o Pipeline em níveis, as frases e os nomes moram aqui; o `pipeline.md`
# virou a Visão geral e só serve para as Versões feitas antes da obra.
CAMINHO_DOS_NIVEIS = '%s/%s/Pipeline/_niveis.json' % (PASTA_AUTOMACAO, PASTA_ROTINAS)

# Extensões que o grafo de chamadas entende. Arquivo fora da lista não vira
# fonte — mandá-lo ao parser só gastaria tempo para não produzir aresta nenhuma.
EXTENSOES_DE_CODIGO = ('.py', '.pyw', '.js', '.jsx', '.ts', '.tsx', '.mts', '.cts', '.mjs',
                       '.cs', '.java', '.go', '.rs', '.c', '.cpp', '.cc',
                       '.h', '.hpp')

# O formato de ANTES do Pipeline em níveis — o `pipeline.md` das Versões antigas.
# `- **12** · fase 3 · `a.py` → `b.py` **via** `f` — a frase`
_LINHA_DO_PASSO = re.compile(
    r'^-\s+\*\*\d+\*\*\s+·\s+fase\s+\d+\s+·\s+`([^`]+)`\s+→\s+`([^`]+)`'
    r'\s+\*\*via\*\*\s+`([^`]+)`\s+—\s+(.*?)(?:\s+·\s+\*\*selos:\*\*.*)?$')
_LINHA_DA_CADEIA = re.compile(r'^##\s+C(\d+)\s+·\s+(.*)$')
_LINHA_DA_CABECA = re.compile(r'^_começa em `(.+?)`')


class BackupsMapaPipelineMixin:
    """O esqueleto dos dois lados, e o que mudou entre eles."""

    # ── Um lado ──────────────────────────────────────────────────────────────

    def _bp_esqueleto(self, project_name, versao_id):
        """`(esqueleto, motivo)`. Um dos dois é sempre `None`.

        O motivo vai por escrito para a tela. Desenhar um pipeline vazio no
        lugar diria "este projeto não tinha fluxo nenhum", que é uma afirmação
        diferente — e falsa — de "esta Versão não guardou o que era preciso".
        """
        try:
            if versao_id == backups_diff.VERSAO_ATUAL:
                return self._pl_esqueleto(project_name), None

            versao = versoes.carregar_versao(project_name, versao_id)
            if not versao:
                return None, 'Versão não encontrada.'

            documentacao = versao.get('documentacao') or {}
            hash_indice = documentacao.get(CAMINHO_DO_INDICE)
            if not hash_indice:
                return None, ('Esta Versão foi feita sem o Índice de Símbolos — '
                              'o esqueleto do Pipeline não pode ser recalculado.')
            indice = json.loads(versoes.ler_texto(project_name, hash_indice))

            fontes = list(self._bp_fontes(project_name, versao))
            if not fontes:
                return None, 'Esta Versão não guardou código para analisar.'

            grafo = self.build_call_graph(project_name, indice=indice, fontes=fontes)
            # O rastro (quem é começo de cadeia) é lido do código DA VERSÃO,
            # não do disco de agora — sem isto, as cadeias de uma Versão antiga
            # nasceriam dos arquivos de hoje.
            return self._pl_esqueleto(project_name, grafo=grafo, textos=dict(fontes)), None
        except ValueError as e:
            return None, str(e)
        except Exception as e:
            return None, str(e)

    def _bp_fontes(self, project_name, versao):
        """`(caminho relativo à pasta de trabalho, texto)` do código da Versão.

        O rótulo da pasta de trabalho sai do caminho: o Índice de Símbolos
        guarda `relative` já relativo à pasta de trabalho, e as duas pontas
        precisam falar do mesmo caminho para as arestas casarem.
        """
        codigo = versao.get('codigo') or {}
        rotulos = {rotulo for rotulo, _raiz in self._bk_raizes_de_codigo(project_name)}
        for caminho, hash_ in codigo.items():
            if not caminho.lower().endswith(EXTENSOES_DE_CODIGO):
                continue
            relativo = caminho
            for rotulo in rotulos:
                if caminho.startswith(rotulo + '/'):
                    relativo = caminho[len(rotulo) + 1:]
                    break
            else:
                # Pasta de trabalho que já não existe: o primeiro segmento
                # ainda é o rótulo dela, e tirá-lo mantém os caminhos
                # comparáveis com os do Índice de Símbolos.
                if '/' in caminho:
                    relativo = caminho.split('/', 1)[1]
            yield relativo, versoes.ler_texto(project_name, hash_)

    # ── As frases, quando existem ────────────────────────────────────────────

    def _bp_frases(self, project_name, versao_id):
        """`({(origem, destino, via): frase}, {cabeça: nome da cadeia})` daquele momento.

        A chave é QUEM o passo é, e não o número dele: com o Pipeline em níveis
        um passo pode estar em várias cadeias, e a numeração de uma Versão não
        é a de outra. Lê o `_niveis.json`; sem ele (Versão feita antes da
        obra), o `pipeline.md` no formato antigo. Tudo vazio quando nenhum dos
        dois existe — e é por isso que a rotina Pipeline **não trava a cópia**:
        ela só acrescenta rótulo.
        """
        niveis, texto = None, ''
        try:
            if versao_id == backups_diff.VERSAO_ATUAL:
                pasta = obter_pasta_da_rotina(project_name, 'pipeline')
                caminho = os.path.join(pasta, '_niveis.json')
                if os.path.exists(caminho):
                    with open(caminho, encoding='utf-8') as f:
                        niveis = json.load(f)
                else:
                    caminho = os.path.join(pasta, 'pipeline.md')
                    if os.path.exists(caminho):
                        with open(caminho, encoding='utf-8') as f:
                            texto = f.read()
            else:
                versao = versoes.carregar_versao(project_name, versao_id) or {}
                documentacao = versao.get('documentacao') or {}
                if documentacao.get(CAMINHO_DOS_NIVEIS):
                    niveis = json.loads(versoes.ler_texto(project_name,
                                                          documentacao[CAMINHO_DOS_NIVEIS]))
                elif documentacao.get(CAMINHO_DO_PIPELINE):
                    texto = versoes.ler_texto(project_name, documentacao[CAMINHO_DO_PIPELINE])
        except Exception:
            return {}, {}

        frases, nomes = {}, {}
        if niveis is not None:
            for c in niveis.get('cadeias') or []:
                if c.get('nome'):
                    nomes[c.get('cabeca')] = ('%s %s' % (c.get('emoji') or '', c['nome'])).strip()
                for p in c.get('passos') or []:
                    if p.get('frase'):
                        frases[(p.get('origem'), p.get('destino'), p.get('via'))] = p['frase']
            return frases, nomes

        nome_pendente = None
        for linha in texto.splitlines():
            m = _LINHA_DO_PASSO.match(linha)
            if m:
                frase = m.group(4).strip()
                if frase and frase != '(sem descrição)':
                    frases[(m.group(1), m.group(2), m.group(3))] = frase
                continue
            m = _LINHA_DA_CADEIA.match(linha)
            if m:
                nome_pendente = m.group(2).strip()
                continue
            m = _LINHA_DA_CABECA.match(linha)
            if m and nome_pendente:
                nomes[m.group(1)] = nome_pendente
                nome_pendente = None
        return frases, nomes

    # ── Montagem ─────────────────────────────────────────────────────────────

    def _bp_lado(self, project_name, versao_id):
        esqueleto, motivo = self._bp_esqueleto(project_name, versao_id)
        if esqueleto is None:
            return {'disponivel': False, 'motivo': motivo, 'cadeias': [],
                    'passos': []}
        frases, nomes = self._bp_frases(project_name, versao_id)

        cadeias, passos = [], []
        for c in esqueleto.get('cadeias') or []:
            n = c.get('n')
            lista = []
            for p in c.get('passos') or []:
                passo = {
                    'ordem': p.get('ordem'),
                    'fase': p.get('fase'),
                    'origem': p.get('origem'),
                    'destino': p.get('destino'),
                    'via': p.get('via'),
                    'selos': p.get('selos') or [],
                    'cadeia': n,
                    'frase': frases.get((p.get('origem'), p.get('destino'), p.get('via')), ''),
                }
                lista.append(passo)
                passos.append(passo)
            cadeias.append({
                'n': n,
                'nome': nomes.get(c.get('cabeca')) or 'Cadeia %s' % n,
                'emoji': c.get('emoji', ''),
                'tipo': c.get('tipo', ''),
                'cabeca': c.get('cabeca', ''),
                'profundidade': c.get('profundidade', 0),
                'fases': c.get('fases', 0),
                'passos': lista,
            })
        return {
            'disponivel': True,
            'motivo': None,
            'cadeias': cadeias,
            'passos': passos,
            'hubs': esqueleto.get('hubs') or [],
            'mortas': esqueleto.get('mortas') or [],
            'cortados': esqueleto.get('cortados', 0),
            'tem_frases': bool(frases),
        }

    def _bp_marcar(self, antes, agora):
        """Marca cada passo com `criado`, `removido` ou `igual`.

        A identidade de um passo é a trinca `(origem, destino, via)`, e não a
        ordem: a ordem é consequência da topologia e muda quando qualquer coisa
        antes dele muda. Comparar por ordem faria o fluxo inteiro parecer
        reescrito por causa de um arquivo novo no começo.
        """
        def trincas(lado):
            return {(p['origem'], p['destino'], p['via']) for p in lado['passos']}

        so_antes = trincas(antes) - trincas(agora)
        so_agora = trincas(agora) - trincas(antes)
        for lado, exclusivos, rotulo in ((antes, so_antes, 'removido'),
                                         (agora, so_agora, 'criado')):
            for passo in lado['passos']:
                trinca = (passo['origem'], passo['destino'], passo['via'])
                passo['situacao'] = rotulo if trinca in exclusivos else 'igual'
        return {'criados': len(so_agora), 'removidos': len(so_antes),
                'mantidos': len(trincas(antes) & trincas(agora))}

    # ── O endpoint ───────────────────────────────────────────────────────────

    def mapa_pipeline(self, project_name, versao_de, versao_ate, variante='fases'):
        """Os cinco modos comem este mesmo payload — o que muda é o desenho.

        `variante` viaja só para a tela lembrar em que modo estava; o backend
        devolve tudo, e cada modo usa a parte que lhe interessa. Recalcular o
        esqueleto uma vez por modo seria pagar quatro vezes pelo mesmo grafo.
        """
        try:
            antes = self._bp_lado(project_name, versao_de)
            agora = self._bp_lado(project_name, versao_ate)
            resumo = ({'criados': 0, 'removidos': 0, 'mantidos': 0}
                      if not (antes['disponivel'] and agora['disponivel'])
                      else self._bp_marcar(antes, agora))
            return {'success': True, 'variante': variante,
                    'antes': antes, 'agora': agora, 'resumo': resumo}
        except Exception as e:
            return {'success': False, 'error': str(e)}
