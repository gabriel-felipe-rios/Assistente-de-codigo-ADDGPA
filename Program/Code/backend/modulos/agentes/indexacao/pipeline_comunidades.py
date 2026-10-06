"""Pipeline — quem mora junto: as comunidades (blocos) e os grupos de blocos (áreas).

A pergunta deste arquivo: «que arquivos se chamam tanto entre si que formam um
bairro?». A resposta é a propagação de rótulos sobre o grafo de chamadas SEM os
hubs — nada de embedding, nada de modelo (D20, D59). O modelo só dá nome e
resumo depois, no prompt do bloco.

  · bloco = a comunidade do arquivo onde a cadeia começa;
  · área  = a mesma propagação, rodada sobre os blocos;
  · ligação = os passos que saem de um grupo e chegam noutro (só a saída).

Determinístico: a mesma entrada dá sempre os mesmos grupos. É o que deixa o
`_passos.json` reaproveitar o nome de um bloco pelo rótulo dele.
"""
from .pipeline_constantes import _PL_VOLTAS_DE_ROTULO


class PipelineComunidadesMixin:

    @staticmethod
    def _pl_propagar_rotulos(nos, pesos):
        """`{nó: rótulo}` — a propagação de rótulos, determinística.

        Cada nó começa com o próprio nome como rótulo. Em cada volta os nós são
        visitados em ordem alfabética, e cada um adota o rótulo de MAIOR peso
        somado entre os vizinhos, na hora (a mudança de um vale para o próximo
        da mesma volta). Empate: o rótulo alfabeticamente MAIOR — é o que
        reproduz as medições do projeto Assistente (79 comunidades, 63 blocos,
        14 áreas; o bairro de `trabalhos-fluxo.js`). Sem vizinho: fica o seu.
        """
        rotulo = {n: n for n in nos}
        ordem = sorted(nos)
        for _volta in range(_PL_VOLTAS_DE_ROTULO):
            for n in ordem:
                vizinhos = pesos.get(n)
                if not vizinhos:
                    continue
                soma = {}
                for v, peso in vizinhos.items():
                    soma[rotulo[v]] = soma.get(rotulo[v], 0) + peso
                rotulo[n] = max(soma, key=lambda r: (soma[r], r))
        return rotulo

    @staticmethod
    def _pl_somar_pesos(pares):
        """`[(a, b)]` → `{a: {b: peso}}`, não dirigido. Peso = quantos pares
        ligam os dois (quantos passos, no grafo de arquivos). Par de um nó com
        ele mesmo não conta."""
        pesos = {}
        for a, b in pares:
            if a == b:
                continue
            pesos.setdefault(a, {})
            pesos.setdefault(b, {})
            pesos[a][b] = pesos[a].get(b, 0) + 1
            pesos[b][a] = pesos[b].get(a, 0) + 1
        return pesos

    @staticmethod
    def _pl_ligacoes(passos, dono):
        """`{grupo de origem: {grupo de destino: [passos]}}` — só a direção de
        saída. `dono` diz de que grupo é cada arquivo; arquivo sem dono (de uma
        comunidade sem cadeia) não liga ninguém."""
        ligacoes = {}
        for p in passos:
            de, para = dono.get(p['origem']), dono.get(p['destino'])
            if de is None or para is None or de == para:
                continue
            ligacoes.setdefault(de, {}).setdefault(para, []).append(p)
        return ligacoes

    def _pl_agrupar(self, passos, cadeias):
        """→ `(blocos, areas)`, ainda sem id nem ordem (quem numera é o esqueleto).

        Bloco: `{rotulo, arquivos, cadeias, ligacoes_por_rotulo}` — `rotulo` é o
        arquivo que a propagação deu à comunidade, e é a identidade do bloco no
        `_passos.json`. Área: `{rotulo, blocos, ligacoes_por_rotulo}`. Só vira
        bloco a comunidade onde começa pelo menos uma cadeia.
        """
        arquivos = sorted({p['origem'] for p in passos} | {p['destino'] for p in passos})
        comunidade = self._pl_propagar_rotulos(
            arquivos, self._pl_somar_pesos((p['origem'], p['destino']) for p in passos))
        membros = {}
        for a in arquivos:
            membros.setdefault(comunidade[a], []).append(a)

        blocos = {}
        for c in cadeias:
            r = comunidade[c['cabeca']]
            bloco = blocos.setdefault(r, {'rotulo': r, 'arquivos': sorted(membros[r]),
                                          'cadeias': []})
            bloco['cadeias'].append(c)

        dono_bloco = {a: comunidade[a] for a in arquivos if comunidade[a] in blocos}
        por_bloco = self._pl_ligacoes(passos, dono_bloco)
        for r, bloco in blocos.items():
            bloco['ligacoes_por_rotulo'] = por_bloco.get(r, {})

        # A área é a mesma propagação, com o bloco no lugar do arquivo e o
        # peso = quantos passos cruzam de um bloco para o outro. Bloco sem
        # ligação nenhuma forma uma área sozinho.
        pares = [(dono_bloco[p['origem']], dono_bloco[p['destino']]) for p in passos
                 if p['origem'] in dono_bloco and p['destino'] in dono_bloco]
        grupo = self._pl_propagar_rotulos(list(blocos), self._pl_somar_pesos(pares))
        areas = {}
        for r in sorted(blocos):
            areas.setdefault(grupo[r], {'rotulo': grupo[r], 'blocos': []})['blocos'].append(blocos[r])
        dono_area = {a: grupo[r] for a, r in dono_bloco.items()}
        por_area = self._pl_ligacoes(passos, dono_area)
        for r, area in areas.items():
            area['ligacoes_por_rotulo'] = por_area.get(r, {})

        return list(blocos.values()), list(areas.values())
