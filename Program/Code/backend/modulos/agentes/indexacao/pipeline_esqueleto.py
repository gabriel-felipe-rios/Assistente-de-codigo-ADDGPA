"""Pipeline — o esqueleto: começos, cadeias, a sobra e a árvore numerada.

A pergunta deste arquivo: «quais são as cadeias, de que bloco e de que área, e
em que ordem?». Nada aqui chama o modelo — é a fonte determinística que a
rotina Pipeline e o Mapa da mudança (Versões antigas) comem igual.

  · começo  = arquivo cuja leitura dá um rastro (`_PL_RASTROS`, na casca);
  · cadeia  = a partir do começo, segue as chamadas em largura até chegar
              noutro começo ou até o nível N (Configurações › Rotinas da
              Automação › «A cadeia segue as chamadas até»); um passo pode
              estar em várias cadeias;
  · sobra   = o que nenhum começo alcança → o bloco «Sem ponto de entrada»
              (B0), montado como antes desta obra: cada componente conexo é
              uma cadeia, e ilha minúscula sem rastro é código morto.

Não há teto de passos (D13): o `_PL_MAX_PASSOS = 200` e o corte «mantendo os
RAROS» saíram — o documento cresce, e fica organizado pelos níveis.
"""
from .pipeline_constantes import _PL_ID_SEM_ENTRADA


class PipelineEsqueletoMixin:

    def _pl_rastro(self, caminho_abs, texto=None):
        """Assinatura sintática de um arquivo → (tipo, emoji). Vazio se nenhuma.

        `texto` vem quando o conteúdo NÃO é o do disco (uma Versão antiga do
        Mapa da mudança): aí o disco não é lido, nem se o caminho existir.
        """
        if texto is not None:
            conteudo = texto[:200 * 1024]
        else:
            if not caminho_abs:
                return ('', '')
            try:
                with open(caminho_abs, 'r', encoding='utf-8', errors='ignore') as f:
                    conteudo = f.read(200 * 1024)
            except Exception:
                return ('', '')
        for tipo, emoji, marcas in self._PL_RASTROS:
            for marca in marcas:
                if marca not in conteudo:
                    continue
                # Vigia é `while True` COM espera — laço sem sleep é outra coisa.
                # ⚠️ 'vigia' aqui é um TIPO DE CADEIA do documento gerado, não a
                # rotina Detector: qualquer laço que fica acordado cai nele.
                if tipo == 'vigia' and 'time.sleep' not in conteudo:
                    continue
                return (tipo, emoji)
        return ('', '')

    def _pl_ordem_topologica(self, nos, saidas):
        """Ordem de execução dentro da cadeia, e a fase (camada) de cada nó.

        Kahn com desempate alfabético — o grafo tem ciclos, e sem desempate fixo
        o `.md` mudaria de ordem a cada geração sem o código ter mudado. Ciclo
        remanescente entra pelo nó de menor grau de entrada: alguém precisa ser o
        começo, e o documento não pode simplesmente perder o resto da cadeia.
        """
        entrada = {n: 0 for n in nos}
        for origem in nos:
            for destino in saidas.get(origem, ()):
                if destino in entrada:
                    entrada[destino] += 1

        ordem, fase, restantes = [], {}, set(nos)
        while restantes:
            prontos = sorted(n for n in restantes if entrada[n] == 0)
            if not prontos:
                # Só sobrou ciclo: quebra no de menor grau de entrada.
                prontos = [min(restantes, key=lambda n: (entrada[n], n))]
            for n in prontos:
                if n not in restantes:
                    continue
                nivel = 0
                for origem in nos:
                    if n in saidas.get(origem, ()) and origem in fase:
                        nivel = max(nivel, fase[origem] + 1)
                fase[n] = nivel
                ordem.append(n)
                restantes.discard(n)
                for destino in saidas.get(n, ()):
                    if destino in entrada and entrada[destino] > 0:
                        entrada[destino] -= 1
        return ordem, fase

    @staticmethod
    def _pl_tirar_hubs(passos):
        """→ `(passos sem hubs, hubs, selos)`.

        Nó muito acima da média cola todas as cadeias numa só (era o `showToast`
        ligando o projeto inteiro). Ele sai do grafo de passos e vira SELO no nó
        de origem, não seta. 1,5× a média, com piso de 8 para projeto pequeno:
        a 3× sobra UM hub e o grafo continua uma bola só; abaixo de 1,25×
        começa a picotar cadeia legítima.
        """
        grau = {}
        for p in passos:
            grau[p['origem']] = grau.get(p['origem'], 0) + 1
            grau[p['destino']] = grau.get(p['destino'], 0) + 1
        media = (2.0 * len(passos) / len(grau)) if grau else 0.0
        limiar = max(8.0, media * 1.5)
        hubs = {n for n, g in grau.items() if g > limiar}

        selos, sobraram = {}, []
        for p in passos:
            if p['destino'] in hubs:
                selos.setdefault(p['origem'], set()).add(p['destino'])
                continue
            if p['origem'] in hubs:
                continue
            sobraram.append(p)
        return sobraram, sorted(hubs, key=lambda n: (-grau[n], n)), selos

    @staticmethod
    def _pl_seguir_chamadas(cabeca, saidas, comecos, niveis):
        """Os passos da cadeia que começa em `cabeca` — busca em largura.

        Nível 1 = os passos que saem do começo; nível 2 = os que saem dos
        destinos do nível 1; e assim até `niveis`. Um passo que chega NOUTRO
        começo entra, mas a cadeia não continua dali; o mesmo no último nível.
        Arquivo já visitado não é expandido de novo (o grafo tem ciclos).
        """
        vistos, fila, meus = {cabeca}, [(cabeca, 0)], []
        while fila:
            no, profundidade = fila.pop(0)
            for p in saidas.get(no, ()):
                meus.append(p)
                destino = p['destino']
                if destino in vistos:
                    continue
                vistos.add(destino)
                if destino in comecos or profundidade + 1 >= niveis:
                    continue
                fila.append((destino, profundidade + 1))
        return meus

    def _pl_montar_cadeia(self, cabeca, meus, tipo, emoji, prioridade):
        """Uma cadeia com os passos em ordem topológica.

        Os passos são COPIADOS: um passo pode estar em várias cadeias, e cada
        uma dá a ele ordem e fase próprias. A frase continua uma só — ela é
        guardada pela chave do passo, não pela cópia.
        """
        nos, saidas = {cabeca}, {}
        for p in meus:
            nos.add(p['origem'])
            nos.add(p['destino'])
            saidas.setdefault(p['origem'], set()).add(p['destino'])
        ordem, fase = self._pl_ordem_topologica(nos, saidas)
        pos = {n: i for i, n in enumerate(ordem)}
        passos = sorted((dict(p) for p in meus),
                        key=lambda p: (pos[p['origem']], pos.get(p['destino'], 0), p['via']))
        return {
            'cabeca': cabeca,
            'tipo': tipo,
            'emoji': emoji,
            'passos': passos,
            'fases': fase,
            'prioridade': prioridade,
            # Profundidade de pasta é DESEMPATE, nunca critério: os começos
            # deste projeto estão nos níveis 0, 3, 4 e 6.
            'profundidade': cabeca.count('/'),
        }

    def _pl_sobra(self, passos, cobertos, rastros, prioridade):
        """As cadeias do bloco «Sem ponto de entrada» e o código morto.

        Os passos que nenhum começo alcança são montados como antes desta obra:
        cada componente conexo é uma cadeia, em ordem topológica, e a cabeça é
        o primeiro da ordem. Ilha com menos de 2 passos e sem rastro é código
        morto: sai do pipeline, mas fica registrada.
        """
        resto = [p for p in passos if (p['origem'], p['destino'], p['via']) not in cobertos]
        saidas, vizinhos = {}, {}
        for p in resto:
            saidas.setdefault(p['origem'], set()).add(p['destino'])
            vizinhos.setdefault(p['origem'], set()).add(p['destino'])
            vizinhos.setdefault(p['destino'], set()).add(p['origem'])

        vistos, componentes = set(), []
        for inicio in sorted(vizinhos):
            if inicio in vistos:
                continue
            fila, grupo = [inicio], set()
            vistos.add(inicio)
            while fila:
                atual = fila.pop()
                grupo.add(atual)
                for viz in vizinhos.get(atual, ()):
                    if viz not in vistos:
                        vistos.add(viz)
                        fila.append(viz)
            componentes.append(grupo)

        cadeias, mortas = [], []
        for grupo in componentes:
            ordem, _fase = self._pl_ordem_topologica(grupo, saidas)
            cabeca = ordem[0]
            meus = [p for p in resto if p['origem'] in grupo]
            tipo, emoji = rastros.get(cabeca, ('', ''))
            if len(meus) < 2 and not tipo:
                mortas.append(cabeca)
                continue
            cadeias.append(self._pl_montar_cadeia(
                cabeca, meus, tipo, emoji, prioridade.get(tipo, len(prioridade))))
        return cadeias, sorted(mortas)

    @staticmethod
    def _pl_ordem_da_cadeia(c):
        return (c['prioridade'], c['profundidade'], c['cabeca'])

    def _pl_numerar(self, blocos, areas, sobra, selos):
        """Ordena e dá os ids da árvore (contrato do Pipeline em níveis).

        Áreas pelo número de cadeias (decrescente), desempate pelo rótulo;
        blocos na ordem das áreas e, dentro da área, pelo mesmo critério; o B0
        por último. Cadeias numeradas na ordem da árvore e, dentro do bloco,
        pela prioridade do rastro, a profundidade de pasta e o caminho da
        cabeça. → `(blocos em ordem, cadeias em ordem)`.
        """
        for bloco in blocos:
            bloco['cadeias'].sort(key=self._pl_ordem_da_cadeia)
        for area in areas:
            area['blocos'].sort(key=lambda b: (-len(b['cadeias']), b['rotulo']))
            area['_n'] = sum(len(b['cadeias']) for b in area['blocos'])
        areas.sort(key=lambda a: (-a['_n'], a['rotulo']))

        em_ordem = []
        for i, area in enumerate(areas, 1):
            area['id'] = 'A%d' % i
            for bloco in area['blocos']:
                bloco['id'] = 'B%d' % (len(em_ordem) + 1)
                bloco['area'] = area['id']
                em_ordem.append(bloco)
        if sobra:
            em_ordem.append({'id': _PL_ID_SEM_ENTRADA, 'rotulo': None, 'area': None,
                             'arquivos': [], 'cadeias': sorted(sobra, key=self._pl_ordem_da_cadeia),
                             'ligacoes_por_rotulo': {}, 'sem_entrada': True})

        cadeias = []
        for bloco in em_ordem:
            for c in bloco['cadeias']:
                cadeias.append(c)
                c['n'] = len(cadeias)
                c['id'] = 'C%d' % c['n']
                c['bloco'] = bloco['id']
                for j, p in enumerate(c['passos'], 1):
                    p['ordem'] = j
                    p['cadeia'] = c['n']
                    p['fase'] = c['fases'].get(p['origem'], 0) + 1
                    p['selos'] = sorted(selos.get(p['origem'], ()))

        # Ligação: a lista de saída, na ordem do número do outro lado.
        for grupos in (em_ordem, areas):
            por_rotulo = {g['rotulo']: g['id'] for g in grupos if g.get('rotulo')}
            for g in grupos:
                g['ligacoes'] = sorted(
                    ({'para': por_rotulo[r], 'para_rotulo': r, 'chamadas': len(ps), 'passos': ps}
                     for r, ps in g.pop('ligacoes_por_rotulo', {}).items()),
                    key=lambda l: int(l['para'][1:]))
        return em_ordem, cadeias

    def _pl_esqueleto(self, project_name, grafo=None, textos=None, niveis=None):
        """A árvore do Pipeline — a fonte determinística.

        Tira os hubs, acha os começos pelo rastro, segue as chamadas de cada
        começo (a cadeia), junta o que ninguém alcança no B0, agrupa as cadeias
        em blocos e áreas pela propagação de rótulos, e numera tudo na ordem da
        árvore.

        `grafo` pronto entra quando o esqueleto não é o de agora: o Mapa da
        mudança precisa das cadeias de uma Versão antiga, e o grafo daquele
        momento é montado por `build_call_graph` a partir do Índice de Símbolos
        e do código guardados nela. `textos` (`{caminho: conteúdo}`) vem junto
        nesse caso: o rastro é lido DELE, e não do disco de agora. `niveis`
        sem valor = o de Configurações («A cadeia segue as chamadas até»).
        """
        if grafo is None:
            grafo = self.build_call_graph(project_name)
        if not grafo.get('success'):
            raise ValueError(grafo.get('error') or 'Não foi possível construir o grafo de chamadas.')
        edges = grafo.get('edges') or []
        if not edges:
            raise ValueError('Nenhuma chamada entre arquivos foi encontrada. '
                             'Rode o Índice de Símbolos primeiro.')
        if niveis is None:
            niveis = self.load_limites()['limites']['pipeline_cadeia_niveis']
        niveis = max(1, int(niveis))

        brutos = sorted({(e['source'], e['target'], e['label']) for e in edges})
        passos = [{'origem': o, 'destino': d, 'via': v} for o, d, v in brutos]
        total_bruto = len(passos)
        passos, hubs, selos = self._pl_tirar_hubs(passos)
        if not passos:
            raise ValueError('Depois de tirar os hubs não sobrou nenhuma chamada — o '
                             'grafo de chamadas deste projeto é uma bola só.')

        # O caminho absoluto vem do próprio grafo: `build_call_graph` acabou de
        # andar nesses arquivos. É de onde sai o rastro e a impressão do
        # conteúdo que decide o que vai ao modelo (`pipeline_passos.py`).
        mapa_abs = {n['id']: n.get('abs') for n in (grafo.get('nodes') or [])}
        prioridade = {tipo: i for i, (tipo, _e, _m) in enumerate(self._PL_RASTROS)}
        arquivos = sorted({p['origem'] for p in passos} | {p['destino'] for p in passos})
        rastros = {a: self._pl_rastro(mapa_abs.get(a),
                                      None if textos is None else textos.get(a, ''))
                   for a in arquivos}
        comecos = {a for a in arquivos if rastros[a][0]}

        # `passos` já vem ordenado por (origem, destino, via): as saídas de
        # cada arquivo ficam em ordem fixa, e a busca em largura também.
        saidas = {}
        for p in passos:
            saidas.setdefault(p['origem'], []).append(p)

        cadeias, cobertos = [], set()
        for cabeca in sorted(comecos):
            meus = self._pl_seguir_chamadas(cabeca, saidas, comecos, niveis)
            if not meus:
                continue
            tipo, emoji = rastros[cabeca]
            cadeias.append(self._pl_montar_cadeia(cabeca, meus, tipo, emoji, prioridade[tipo]))
            cobertos.update((p['origem'], p['destino'], p['via']) for p in meus)

        sobra, mortas = self._pl_sobra(passos, cobertos, rastros, prioridade)
        if not cadeias and not sobra:
            raise ValueError('Nenhuma cadeia de execução sobrou depois dos descartes.')

        blocos, areas = self._pl_agrupar(passos, cadeias)
        blocos, cadeias = self._pl_numerar(blocos, areas, sobra, selos)

        return {
            'cadeias': cadeias,
            'blocos': blocos,
            'areas': areas,
            'hubs': hubs,
            'mortas': mortas,
            'total_bruto': total_bruto,
            'niveis': niveis,
            'abs': mapa_abs,
        }
