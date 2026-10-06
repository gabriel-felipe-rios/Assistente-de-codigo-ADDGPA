"""Mapa da mudança → Ligações — os três modos, sobre o `grafo.json` de cada Versão.

O grafo de imports **já é um artefato guardado**: a rotina Grafo de Imports
escreve `Automação/Rotinas/Grafo de Imports/grafo.json`, e toda Versão leva uma
cópia dele porque essa rotina está na metade Documentação. Comparar duas
Versões aqui é, literalmente, ler os dois `grafo.json` — sem reprocessar código,
sem chamar o modelo, sem depender do disco de agora.

É por isso que o Grafo de Imports **trava a cópia** no modal "Fazer cópia": uma
Versão sem ele nasce sem este formato, e não há como recuperá-lo depois.

Ligações **não tem metade "documentação"** — o grafo é sempre do código.
Escolher *Documentação* aqui cai em *Código*, de propósito: um formato que
existe em três variantes não deveria desaparecer porque o seletor de assunto
está na outra posição.

⚠️ Duas leituras foram desenhadas, mostradas e RECUSADAS — *Sobreposto* e *Só o
que mudou*. Não recriar: as duas eram recomendação forte, e a recusa veio com
motivo. O que ficou são os três modos abaixo.
"""

from .constantes import *
from . import versoes
from . import backups_diff


CAMINHO_DO_GRAFO = '%s/%s/Grafo de Imports/grafo.json' % (PASTA_AUTOMACAO, PASTA_ROTINAS)


class BackupsMapaLigacoesMixin:
    """Lado a lado · Matriz · Por arquivo."""

    # ── Carregar o grafo de um lado ──────────────────────────────────────────

    def _bl_grafo(self, project_name, versao_id):
        """O `grafo.json` daquele momento, ou `None` se a Versão não o guardou.

        `None` não é erro: é informação que a tela precisa dar por escrito
        ("esta Versão foi feita antes de o Grafo de Imports existir"). Desenhar
        um grafo vazio no lugar seria dizer que o projeto não tinha ligação
        nenhuma, que é uma afirmação diferente e falsa.
        """
        if versao_id == backups_diff.VERSAO_ATUAL:
            caminho = obter_pasta_da_rotina(project_name, 'grafo-imports', 'grafo.json')
            try:
                if os.path.exists(caminho):
                    with open(caminho, encoding='utf-8') as f:
                        return json.load(f)
            except Exception:
                return None
            return None

        versao = versoes.carregar_versao(project_name, versao_id) or {}
        hash_ = (versao.get('documentacao') or {}).get(CAMINHO_DO_GRAFO)
        if not hash_:
            return None
        try:
            return json.loads(versoes.ler_texto(project_name, hash_))
        except Exception:
            return None

    def _bl_arestas(self, grafo):
        return {(e.get('source'), e.get('target'))
                for e in ((grafo or {}).get('edges') or [])
                if e.get('source') and e.get('target')}

    def _bl_nos(self, grafo):
        return {n.get('id'): n for n in ((grafo or {}).get('nodes') or [])
                if n.get('id')}

    # ── O endpoint ───────────────────────────────────────────────────────────

    def mapa_ligacoes(self, project_name, versao_de, versao_ate,
                      variante='lado-a-lado', modo='arquivo'):
        try:
            antes = self._bl_grafo(project_name, versao_de)
            agora = self._bl_grafo(project_name, versao_ate)
            faltando = [rotulo for rotulo, g in (('antes', antes), ('agora', agora))
                        if g is None]

            if variante == 'matriz':
                dados = self._bl_matriz(antes, agora, modo)
            elif variante == 'por-arquivo':
                dados = self._bl_por_arquivo(antes, agora)
            else:
                dados = self._bl_lado_a_lado(antes, agora)

            return {'success': True, 'variante': variante, 'faltando': faltando,
                    **dados}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── 1 · Lado a lado ──────────────────────────────────────────────────────

    def _bl_lado_a_lado(self, antes, agora):
        """Um grafo por Versão, com os nós **na mesma posição** nos dois.

        A posição sai daqui, não do JS: a lista de nós é a UNIÃO das duas
        Versões, ordenada de um jeito determinístico, e os dois desenhos usam a
        mesma. Se cada lado se organizasse sozinho, um arquivo novo empurraria
        todos os outros e o desenho inteiro pareceria ter mudado.

        Nó que só existe de um lado continua nos dois, com `ausente` — é a
        moldura tracejada guardando o lugar. A seta colorida, essa sim, só
        existe do lado em que a ligação existe.
        """
        nos_antes = self._bl_nos(antes)
        nos_agora = self._bl_nos(agora)
        ordem = sorted(set(nos_antes) | set(nos_agora))

        arestas_antes = self._bl_arestas(antes)
        arestas_agora = self._bl_arestas(agora)

        def montar(nos_do_lado, arestas_do_lado, outras):
            return {
                'nos': [{
                    'id': i,
                    'rotulo': (nos_do_lado.get(i) or nos_antes.get(i)
                               or nos_agora.get(i) or {}).get('label',
                                                             i.rsplit('/', 1)[-1]),
                    'linguagem': (nos_do_lado.get(i) or {}).get('language', ''),
                    'ausente': i not in nos_do_lado,
                } for i in ordem],
                'arestas': [{'origem': o, 'destino': d,
                             'situacao': 'igual' if (o, d) in outras else 'so-deste-lado'}
                            for o, d in sorted(arestas_do_lado)],
            }

        return {
            'ordem': ordem,
            'antes': montar(nos_antes, arestas_antes, arestas_agora),
            'agora': montar(nos_agora, arestas_agora, arestas_antes),
            'resumo': {
                'criadas': len(arestas_agora - arestas_antes),
                'removidas': len(arestas_antes - arestas_agora),
                'mantidas': len(arestas_antes & arestas_agora),
            },
        }

    # ── 2 · Matriz ───────────────────────────────────────────────────────────

    def _bl_matriz(self, antes, agora, modo):
        """Linha importa coluna. Nos dois modos: por arquivo e por pasta.

        Por pasta, a célula traz **quantas ligações passam** — agregar sem
        dizer quantas transformaria "uma pasta chama a outra 40 vezes" e "chama
        uma vez" na mesma célula preta.
        """
        def chave(no):
            if modo != 'pasta':
                return no
            return no.rsplit('/', 1)[0] if '/' in no else '.'

        arestas_antes = self._bl_arestas(antes)
        arestas_agora = self._bl_arestas(agora)

        def contar(arestas):
            celulas = {}
            for origem, destino in arestas:
                par = (chave(origem), chave(destino))
                if modo == 'pasta' and par[0] == par[1]:
                    continue
                celulas[par] = celulas.get(par, 0) + 1
            return celulas

        celulas_antes = contar(arestas_antes)
        celulas_agora = contar(arestas_agora)

        # ⚠️ O EIXO SÓ TEM QUEM PARTICIPA DE ALGUMA LIGAÇÃO. Ele já foi a
        # união dos nós dos dois grafos, e isso é caro de um jeito que não se
        # percebe lendo o código: 336 arquivos viram 336 × 336 = **112.896
        # células** de tabela, quase todas vazias, e a tela trava. A Matriz de
        # Dependências da aba Mapas filtra do mesmo jeito, e pelo mesmo motivo:
        # uma linha inteira vazia não diz nada que a ausência dela já não diga.
        usados = set()
        for de, para in set(celulas_antes) | set(celulas_agora):
            usados.add(de)
            usados.add(para)
        eixo = sorted(usados)

        celulas = []
        for par in sorted(set(celulas_antes) | set(celulas_agora)):
            de, para = par
            n_antes = celulas_antes.get(par, 0)
            n_agora = celulas_agora.get(par, 0)
            celulas.append({
                'linha': de, 'coluna': para,
                'antes': n_antes, 'agora': n_agora,
                'situacao': ('criado' if not n_antes else
                             'removido' if not n_agora else
                             'igual' if n_antes == n_agora else 'alterado'),
            })
        return {'modo': modo, 'eixo': eixo, 'celulas': celulas}

    # ── 3 · Por arquivo ──────────────────────────────────────────────────────

    def _bl_por_arquivo(self, antes, agora):
        """Cartões: "é chamado por" e "chama", em cada Versão.

        É a leitura que responde a pergunta que as outras duas não respondem —
        *este arquivo aqui, o que mudou em volta dele?* — sem obrigar a
        procurar um ponto no meio de um grafo inteiro.
        """
        arestas_antes = self._bl_arestas(antes)
        arestas_agora = self._bl_arestas(agora)
        nos = sorted(set(self._bl_nos(antes)) | set(self._bl_nos(agora)))

        def vizinhos(arestas, no):
            return {
                'chama': sorted(d for o, d in arestas if o == no),
                'chamado_por': sorted(o for o, d in arestas if d == no),
            }

        cartoes = []
        for no in nos:
            v_antes = vizinhos(arestas_antes, no)
            v_agora = vizinhos(arestas_agora, no)
            mudou = v_antes != v_agora
            cartoes.append({
                'id': no,
                'rotulo': no.rsplit('/', 1)[-1],
                'antes': v_antes,
                'agora': v_agora,
                'mudou': mudou,
            })
        # Quem mudou vem primeiro: num projeto grande, a lista inteira em ordem
        # alfabética esconde as poucas linhas que interessam.
        cartoes.sort(key=lambda c: (not c['mudou'], c['id']))
        return {'cartoes': cartoes,
                'mudaram': sum(1 for c in cartoes if c['mudou'])}
