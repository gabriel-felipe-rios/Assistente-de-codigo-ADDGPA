"""Mapa da mudança — os dois lados, mais Árvore, Treemap e Sunburst.

Um endpoint por formato, todos com a mesma assinatura
`(project_name, versao_de, versao_ate, metade)`, todos devolvendo **JSON pronto
para desenhar**. `versao_ate` aceita o valor especial `atual`: é o disco de
agora, não uma Versão.

⚠️ **NENHUM MAPA CHAMA O MODELO.** Os oito desenhos leem artefatos que já
existem — as duas listas de `(caminho → hash)`, o `grafo.json` de cada Versão,
o Índice de Símbolos de cada Versão — e fazem conta. Se um desenho um dia
precisar de uma frase que só o modelo sabe escrever, ele sai sem a frase; não
sai com uma chamada.

⚠️ **A REGRA DO EIXO:** o par esquerda/direita é **sempre ANTES → AGORA**. O
seletor de metade escolhe o *assunto* (Código · Documentação · Os dois), nunca
o lado. A Árvore é a exceção natural: ela já é o diff, e por isso não tem dois
lados para trocar.

Os irmãos: `backups_mapa_ligacoes.py` (os 3 modos de Ligações) e
`backups_mapa_pipeline.py` (os 5 de Pipeline). Estão separados porque a AMF
manda dividir acima de 500 linhas, e os oito juntos passam disso com folga.
"""

from .constantes import *
from . import versoes
from . import backups_diff


class BackupsMapaMixin:
    """Os dois lados de uma comparação, e os três formatos hierárquicos."""

    # ── Os dois lados ────────────────────────────────────────────────────────

    def _bm_metades(self, metade):
        """`ambos` vira os quatro quadrantes — duas metades, dois lados cada."""
        if metade == 'ambos':
            return ['codigo', 'documentacao']
        return [metade if metade in ('codigo', 'documentacao') else 'codigo']

    def _bm_mapa_atual(self, project_name, metade):
        """O `{caminho: hash}` do disco de agora, calculado na hora.

        Usa exatamente as mesmas regras da criação de uma Versão — a lista de
        exclusões do backup, e nunca a lista "Remover" da aba Projeto. Se
        usasse regras diferentes, o lado "agora" mostraria arquivos que a
        próxima cópia não guardaria, e o mapa mentiria sobre o que vai mudar.

        Devolve `(mapa, absolutos)`: o segundo é `{caminho: caminho absoluto}`,
        porque o conteúdo do lado "agora" ainda não está em `arquivos/` e a
        leitura tem de cair no arquivo real — e no Código cada caminho pende de
        uma pasta de trabalho diferente.
        """
        config = self.carregar_configuracao_do_backup(project_name)['configuracao']
        exclusoes = config['exclusoes']
        mapa, absolutos = {}, {}
        if metade == 'codigo':
            for rotulo, raiz in self._bk_raizes_de_codigo(project_name):
                for rel in self._bk_listar(raiz, exclusoes):
                    absoluto = os.path.join(raiz, rel)
                    chave = self._bk_chave(rotulo, rel)
                    mapa[chave] = versoes.hash_do_conteudo(absoluto)
                    absolutos[chave] = absoluto
        else:
            base = obter_pasta_de_dados(project_name)
            for rel in self._bk_listar_documentacao(project_name,
                                                    config['documentacao'],
                                                    exclusoes):
                absoluto = os.path.join(base, rel)
                chave = rel.replace(os.sep, '/')
                mapa[chave] = versoes.hash_do_conteudo(absoluto)
                absolutos[chave] = absoluto
        return mapa, absolutos

    def _bm_lado(self, project_name, versao_id, metade):
        """`(mapa, absolutos)` de um dos lados. `absolutos` só existe no `atual`.

        O lado `atual` é MEMOIZADO por chamada de endpoint: montá-lo custa uma
        varredura do disco mais o md5 de cada arquivo, e o Treemap pedia o mesmo
        lado três vezes (uma na comparação, duas para montar os blocos).
        """
        if versao_id == backups_diff.VERSAO_ATUAL:
            chave = (project_name, metade)
            if chave not in self._bm_cache:
                self._bm_cache[chave] = self._bm_mapa_atual(project_name, metade)
            return self._bm_cache[chave]
        versao = versoes.carregar_versao(project_name, versao_id) or {}
        return (versao.get(metade) or {}), {}

    # O cache do lado `atual`. É esvaziado no começo de cada endpoint: dentro de
    # uma chamada o disco não muda, entre chamadas muda — e um cache que
    # sobrevive à chamada mostraria um "agora" que já passou.
    _bm_cache = {}

    def _bm_comecar(self):
        self._bm_cache = {}

    def _bm_linhas(self, project_name, versao_de, versao_ate, metade,
                   com_contagem=True, com_linhas=True):
        """As linhas comparadas de UMA metade — a base dos três formatos.

        `com_linhas=False` dispensa a contagem de linhas do arquivo IGUAL, que
        é a única parte cara: ela lê o conteúdo. A Árvore não precisa dela (só
        mostra o que mudou) e o Treemap por bytes também não.
        """
        antes, _ = self._bm_lado(project_name, versao_de, metade)
        agora, absolutos = self._bm_lado(project_name, versao_ate, metade)
        linhas = backups_diff.comparar_mapas(project_name, antes, agora,
                                             com_contagem=com_contagem,
                                             absolutos=absolutos,
                                             com_linhas=com_linhas)
        return self._bm_aplicar_grandes(project_name, linhas)

    # ── Arquivos grandes: como aparecem, não o que a cópia guarda ────────────

    def _bm_aplicar_grandes(self, project_name, linhas):
        """Marca (e, se for o caso, tira do desenho) o arquivo grande demais.

        ⚠️ ISTO NÃO MUDA O QUE A CÓPIA GUARDA. A cópia leva tudo, sempre — é a
        representação no Mapa que se configura. Nasceu do `index.db` do
        Embedding Semântico: 9,6 MB medidos como qualquer outro arquivo viram
        um bloco que engole o desenho inteiro e não informa nada.
        """
        config = self.carregar_configuracao_do_backup(project_name)['configuracao']
        grandes = config.get('grandes') or {}
        limiar = max(0, int(grandes.get('limiar_mb', 2))) * 1024 * 1024
        modo = grandes.get('modo', 'teto')
        if not limiar:
            return linhas
        for item in linhas:
            if item.get('bytes', 0) > limiar:
                item['grande'] = True
                item['fora_do_desenho'] = (modo == 'fora')
        return linhas

    # ── O cabeçalho, comum a todos os formatos ───────────────────────────────

    def mapa_cabecalho(self, project_name, versao_de, versao_ate, metade='codigo'):
        """Os totais que a `.mapa-stat` mostra, sem montar desenho nenhum."""
        self._bm_comecar()
        try:
            saida = {}
            for m in self._bm_metades(metade):
                saida[m] = backups_diff.resumir(
                    self._bm_linhas(project_name, versao_de, versao_ate, m,
                                    com_linhas=False))
            return {'success': True, 'resumo': saida}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Árvore ───────────────────────────────────────────────────────────────

    def mapa_arvore(self, project_name, versao_de, versao_ate, metade='codigo'):
        """Pasta por pasta, seguindo a estrutura real de cada metade.

        A Árvore **não tem dois lados**: ela já É o diff. Cada pasta soma o que
        mudou dentro dela — é a barra verde/vermelha —, e uma pasta em que nada
        mudou colapsa numa linha só, para a rotina que ficou parada não ocupar
        meia tela dizendo que ficou parada.
        """
        self._bm_comecar()
        try:
            saida = {}
            for m in self._bm_metades(metade):
                linhas = self._bm_linhas(project_name, versao_de, versao_ate, m,
                                         com_linhas=False)
                saida[m] = {'raiz': self._bm_montar_arvore(linhas),
                            'resumo': backups_diff.resumir(linhas),
                            'fora': self._bm_fora(linhas)}
            return {'success': True, 'metades': saida}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _bm_montar_arvore(self, linhas):
        raiz = {'nome': '', 'caminho': '', 'pastas': {}, 'arquivos': [],
                'mais': 0, 'menos': 0, 'mudados': 0, 'total': 0}
        for item in linhas:
            partes = item['caminho'].split('/')
            no = raiz
            percorrido = []
            for parte in partes[:-1]:
                percorrido.append(parte)
                if parte not in no['pastas']:
                    no['pastas'][parte] = {
                        'nome': parte, 'caminho': '/'.join(percorrido),
                        'pastas': {}, 'arquivos': [],
                        'mais': 0, 'menos': 0, 'mudados': 0, 'total': 0}
                no = no['pastas'][parte]
            no['arquivos'].append({'nome': partes[-1], **item})

        def somar(no):
            for filho in no['pastas'].values():
                somar(filho)
                for chave in ('mais', 'menos', 'mudados', 'total'):
                    no[chave] += filho[chave]
            for arquivo in no['arquivos']:
                no['total'] += 1
                no['mais'] += arquivo['mais']
                no['menos'] += arquivo['menos']
                if arquivo['situacao'] != 'igual':
                    no['mudados'] += 1
            # `parada` é o que faz a pasta colapsar numa linha só na tela.
            no['parada'] = no['mudados'] == 0
            no['pastas'] = sorted(no['pastas'].values(), key=lambda p: p['nome'])
            no['arquivos'].sort(key=lambda a: a['nome'])
            return no

        return somar(raiz)

    # ── Treemap ──────────────────────────────────────────────────────────────

    def mapa_treemap(self, project_name, versao_de, versao_ate, metade='codigo',
                     unidade='linhas'):
        """Um bloco por arquivo: tamanho = a grandeza escolhida, cor = situação.

        `unidade` é `linhas` ou `bytes` — o alternador do painel do canto.
        Binário **sempre** conta por bytes: ele não tem linhas, e medi-lo como
        se tivesse foi o que produziu o quadrado gigante do teste.

        Os dois lados usam **a mesma escala** — a mesma área por unidade —,
        senão um projeto que dobrou de tamanho desenharia igual dos dois lados e
        a comparação não diria nada. O `total_maximo` vai junto para o JS
        dimensionar os dois pelo maior.
        """
        self._bm_comecar()
        try:
            saida = {}
            for m in self._bm_metades(metade):
                linhas = self._bm_linhas(project_name, versao_de, versao_ate, m,
                                         com_linhas=(unidade == 'linhas'))
                antes, _ = self._bm_lado(project_name, versao_de, m)
                agora, _ = self._bm_lado(project_name, versao_ate, m)
                lado_antes = self._bm_blocos(project_name, linhas, antes, 'antes', unidade)
                lado_agora = self._bm_blocos(project_name, linhas, agora, 'agora', unidade)
                saida[m] = {
                    'antes': lado_antes,
                    'agora': lado_agora,
                    'total_maximo': max(sum(b['valor'] for b in lado_antes),
                                        sum(b['valor'] for b in lado_agora), 1),
                    'resumo': backups_diff.resumir(linhas),
                    'fora': self._bm_fora(linhas),
                }
            # O teto de área vai junto porque a LEGENDA o escreve: "limitado no
            # desenho" sem o número não diz limitado a quê.
            return {'success': True, 'metades': saida,
                    'teto_por_cento': self._bm_teto_por_cento(project_name)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _bm_blocos(self, project_name, linhas, mapa_do_lado, lado, unidade='linhas'):
        """Um bloco por arquivo daquele lado.

        Arquivo que existe de um lado e não do outro **continua na lista**, com
        `ausente=True`: é a moldura tracejada guardando o lugar. Sem ela, os
        dois desenhos se reorganizam inteiros e o olho perde a referência.

        Arquivo marcado `fora_do_desenho` sai daqui — mas volta na conta de
        `_bm_fora`, para o rodapé dizer quantos ficaram de fora. Sumir em
        silêncio seria dizer que o arquivo não existe.
        """
        blocos = []
        for item in linhas:
            if item.get('fora_do_desenho'):
                continue
            existe = item['caminho'] in mapa_do_lado
            if not existe and item['situacao'] == 'igual':
                continue
            blocos.append({
                'caminho': item['caminho'],
                'nome': item['caminho'].rsplit('/', 1)[-1],
                'pasta': item['caminho'].rsplit('/', 1)[0] if '/' in item['caminho'] else '',
                'valor': self._bm_valor(item, unidade, lado) if existe else 0,
                'situacao': item['situacao'],
                # O outro lado de um movido/renomeado. É o que deixa o bloco
                # dizer "veio de" / "foi para" em vez de só mudar de cor.
                'par': item.get('par', ''),
                'par_lado': item.get('par_lado', ''),
                'mais': item['mais'], 'menos': item['menos'],
                'binario': bool(item.get('binario')),
                'grande': bool(item.get('grande')),
                'motivo': item.get('motivo', ''),
                'ausente': not existe,
                'lado': lado,
            })
        return self._bm_limitar_grandes(project_name, blocos)

    def _bm_valor(self, item, unidade, lado='agora'):
        """A grandeza do bloco, na unidade escolhida — e **do lado certo**.

        ⚠️ NUNCA MISTURAR UNIDADES. Binário não tem linhas; devolver os bytes
        dele num desenho medido em linhas põe 10 milhões ao lado de 300, e o
        bloco engole a tela — foi exatamente o defeito do teste. No modo
        `linhas`, binário devolve 0 e ganha um tamanho nominal em
        `_bm_limitar_grandes`, marcado como tal.

        ⚠️ **O LADO IMPORTA.** Isto media sempre o lado *agora* e usava o mesmo
        número nos dois painéis: um arquivo que dobrou de tamanho desenhava
        igual dos dois lados, e a comparação — que é a razão de a tela existir —
        não dizia nada. Ver `_fechar`, em `backups_diff.py`.
        """
        sufixo = '_antes' if lado == 'antes' else '_agora'
        if unidade == 'bytes':
            return max(item.get('bytes' + sufixo, 0), 1)
        if item.get('binario'):
            return 0
        return max(item.get('linhas' + sufixo, 0), 1)

    def _bm_teto_por_cento(self, project_name):
        """O teto de área do arquivo grande, em %.

        Sai daqui e não de dentro de `_bm_limitar_grandes` porque a LEGENDA
        precisa do mesmo número: "tamanho limitado no desenho" não dizia
        limitado a quê, e um teto que só o servidor conhece não tem como ser
        escrito na tela.
        """
        config = self.carregar_configuracao_do_backup(project_name)['configuracao']
        grandes = config.get('grandes') or {}
        return max(1, min(100, int(grandes.get('teto_por_cento', 12))))

    def _bm_limitar_grandes(self, project_name, blocos):
        """O teto: o arquivo grande entra no desenho, mas não o engole.

        O teto é uma fatia do total dos blocos **normais**, e não do total
        geral — se fosse do geral, um bloco que sozinho vale 90% continuaria
        gigante, porque 12% de um total que ele mesmo domina ainda é enorme.
        """
        por_cento = self._bm_teto_por_cento(project_name)

        normais = sorted(b['valor'] for b in blocos
                         if not b.get('grande') and not b.get('binario'))
        base = sum(normais) or len(blocos) or 1
        teto = max(1.0, base * por_cento / 100.0)
        # O binário comum — um ícone, um `.pyc` — não é grande coisa nenhuma:
        # ele só não tem linhas. Dar o teto a cada um deles fazia 66 arquivinhos
        # ocuparem 89% do desenho. O tamanho nominal é a MEDIANA dos normais:
        # ele aparece, do tamanho de um arquivo comum, que é o que ele é.
        mediana = normais[len(normais) // 2] if normais else 1

        for b in blocos:
            if b.get('grande'):
                # Grande de verdade: entra com teto, e a hachura diz que o
                # tamanho real é outro.
                if b['valor'] > teto or b['valor'] == 0:
                    b['valor_real'] = b['valor']
                    b['valor'] = teto
                    b['limitado'] = True
            elif b.get('binario') and b['valor'] == 0:
                b['valor'] = mediana
                b['limitado'] = True
        return blocos

    def listar_arquivos_grandes(self, project_name):
        """Quais arquivos contam hoje como "grande", e **em qual metade**.

        Existe porque a regra era invisível. No projeto de teste os dois
        arquivos acima do limiar — o `index.db` do Embedding Semântico, com
        9,6 MB, e o `identificadores.json`, com 3,7 MB — estão **os dois em
        Documentação**, e em Código não há nenhum. Quem olhasse a metade Código
        não via arquivo grande nenhum, mexia no teto, e continuava não vendo —
        sem nada na tela explicando que estava procurando no lugar errado.

        ⚠️ ISTO NÃO MUDA O QUE A CÓPIA GUARDA. A cópia leva tudo, sempre.
        """
        self._bm_comecar()
        try:
            config = self.carregar_configuracao_do_backup(project_name)['configuracao']
            grandes = config.get('grandes') or {}
            limiar = max(0, int(grandes.get('limiar_mb', 2))) * 1024 * 1024
            achados = []
            if limiar:
                for metade in ('codigo', 'documentacao'):
                    mapa, absolutos = self._bm_lado(
                        project_name, backups_diff.VERSAO_ATUAL, metade)
                    for caminho, hash_ in mapa.items():
                        tamanho = backups_diff.tamanho_do_lado(
                            project_name, hash_, absolutos.get(caminho))
                        if tamanho > limiar:
                            achados.append({'caminho': caminho, 'bytes': tamanho,
                                            'metade': metade})
            achados.sort(key=lambda a: -a['bytes'])
            return {'success': True, 'grandes': achados,
                    'limiar_mb': limiar // (1024 * 1024),
                    'modo': grandes.get('modo', 'teto')}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _bm_fora(self, linhas):
        """Quem ficou de fora do desenho, para o rodapé poder dizer."""
        fora = [l for l in linhas if l.get('fora_do_desenho')]
        return {'quantos': len(fora),
                'caminhos': [l['caminho'] for l in fora[:12]],
                'bytes': sum(l.get('bytes', 0) for l in fora)}

    # ── Sunburst ─────────────────────────────────────────────────────────────

    def mapa_sunburst(self, project_name, versao_de, versao_ate, metade='codigo',
                      unidade='linhas'):
        """Anéis: pasta → arquivo, um sol por lado.

        O raio cresce com a **raiz** do total, e não com o total: área é
        proporcional ao quadrado do raio, então crescer o raio linearmente faz
        um projeto 4× maior parecer 16× maior.
        """
        self._bm_comecar()
        try:
            saida = {}
            for m in self._bm_metades(metade):
                linhas = self._bm_linhas(project_name, versao_de, versao_ate, m,
                                         com_linhas=(unidade == 'linhas'))
                antes, _ = self._bm_lado(project_name, versao_de, m)
                agora, _ = self._bm_lado(project_name, versao_ate, m)
                lado_antes = self._bm_blocos(project_name, linhas, antes, 'antes', unidade)
                lado_agora = self._bm_blocos(project_name, linhas, agora, 'agora', unidade)
                total_antes = sum(b['valor'] for b in lado_antes)
                total_agora = sum(b['valor'] for b in lado_agora)
                maior = max(total_antes, total_agora, 1)
                saida[m] = {
                    'antes': {'raiz': self._bm_aneis(lado_antes),
                              'total': total_antes,
                              'raio_relativo': self._bm_raio(total_antes, maior)},
                    'agora': {'raiz': self._bm_aneis(lado_agora),
                              'total': total_agora,
                              'raio_relativo': self._bm_raio(total_agora, maior)},
                    'resumo': backups_diff.resumir(linhas),
                    'fora': self._bm_fora(linhas),
                }
            # O teto de área vai junto porque a LEGENDA o escreve: "limitado no
            # desenho" sem o número não diz limitado a quê.
            return {'success': True, 'metades': saida,
                    'teto_por_cento': self._bm_teto_por_cento(project_name)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # O piso existe porque o raio é comparativo, não absoluto: sem ele, um lado
    # com 1% do outro vira um ponto ilegível, e a comparação some junto com o
    # desenho. 45% do raio ainda deixa claro qual é o menor.
    _PISO_DO_RAIO = 0.45

    def _bm_raio(self, total, maior):
        if not maior:
            return 1.0
        return max(self._PISO_DO_RAIO, (total / maior) ** 0.5)

    def _bm_aneis(self, blocos):
        """A hierarquia pasta → arquivo que o D3 consome."""
        raiz = {'nome': '', 'caminho': '', 'filhos': {}, 'arquivos': []}
        for bloco in blocos:
            no = raiz
            percorrido = []
            for parte in (bloco['pasta'].split('/') if bloco['pasta'] else []):
                percorrido.append(parte)
                no = no['filhos'].setdefault(parte, {
                    'nome': parte, 'caminho': '/'.join(percorrido),
                    'filhos': {}, 'arquivos': []})
            no['arquivos'].append(bloco)

        def achatar(no):
            filhos = [achatar(f) for f in
                      sorted(no['filhos'].values(), key=lambda f: f['nome'])]
            filhos.extend(sorted(no['arquivos'], key=lambda a: a['nome']))
            return {'nome': no['nome'], 'caminho': no['caminho'],
                    'filhos': filhos,
                    'valor': sum(f.get('valor', 0) for f in filhos)}

        return achatar(raiz)
