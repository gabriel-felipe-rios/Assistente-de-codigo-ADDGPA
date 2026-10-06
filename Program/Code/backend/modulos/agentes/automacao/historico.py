"""O que aconteceu na Automação, na ordem em que aconteceu — `Histórico.jsonl`.

A aba Automação já responde quase tudo. **Acionamentos** diz o que está ligado,
**Rotinas** o que foi gerado, **Visualizar** o que rodou na última passada,
**Pendências** o que ficou faltando, **Erros** o que quebrou e **Referência** a
regra. Faltava a pergunta do tempo: *o que aconteceu, e nesta ordem?*

⚠️ **O motivo de existir: os selos morrem na troca de sub-aba.** "Dispensada" e
"pulada" são pintados por `evaluate_js` e vivem só na sessão da tela. Ao voltar
para a sub-aba, o card relê o `_resumo.json` e mostra "Concluído" de ontem sobre
um ciclo de hoje em que a rotina nem chegou a ser chamada. O usuário disse a
frase exata: *"eu não sei o que foi pulado ou não"*. Aqui fica escrito.

## Quatro tipos de evento, uma linha cada

| `t` | Quando |
|---|---|
| `ciclo`   | ao entrar em `_ac_run_cycle` — com a ORIGEM (que botão, que grupo) |
| `rotina`  | uma por rotina: `concluida` · `com_erros` · `dispensada` · `pulada` · `erro` |
| `arquivo` | uma por arquivo, só nas rotinas que processam arquivo a arquivo |
| `fim`     | ao sair do ciclo, dizendo se ele chegou ao fim |

⚠️ **`dispensada` e `pulada` NÃO são sinônimos**, e o histórico é o lugar onde
essa diferença mais importa — ver `Vocabulário.md`. Dispensada é o Detector não
ter pedido (desfecho NORMAL de um ciclo sobre projeto em dia); pulada é um
pré-requisito não ter terminado (ficou trabalho para a próxima volta).

## Dez rotinas não têm linha de arquivo, e isso não é buraco

Grafo de Imports, Índice de Identificadores, Índice de Navegação, Bibliotecas,
Comentários e as outras **reconstroem o índice inteiro** a cada passada — elas
não processam arquivo a arquivo, e inventar trezentas linhas de "processado"
seria mentir sobre o que elas fazem. A linha de rotina delas já é a verdade
completa. Quem tem linha de arquivo é quem de fato decide arquivo por arquivo:
Detector, Documentação Técnica, Sincronia e Resumo de Pastas (por pasta).

## Por que `.jsonl`, e por que fora das pastas de rotina

Escrito por ACRÉSCIMO, de várias threads ao mesmo tempo (a Doc. Técnica roda em
paralelo). Reler e reescrever um array a cada arquivo processado perderia linha
na primeira corrida. E mora ao lado do `Pendências.json`, fora das quinze pastas
de rotina, porque "Limpar dados gerados" apaga aquelas quinze — e o histórico é
justamente o que se quer ter em mãos DEPOIS de limpar. Ver
`caminhos.obter_arquivo_de_historico_das_rotinas`.
"""

from ...constantes import *


class HistoricoDasRotinasMixin:

    # O arquivo não pode crescer para sempre. Aparado na escrita: passando do
    # teto de LINHAS, sobram os últimos `_HIST_MANTER_CICLOS` ciclos INTEIROS.
    #
    # ⚠️ **A unidade do corte é o CICLO, não a linha**, e a diferença não é
    # estética. Cortando pela linha, o corte cai no meio de um ciclo: o
    # cabeçalho `ciclo` some e as rotinas órfãs viram um grupo falso de
    # "Execução avulsa" — o histórico passa a MENTIR sobre o que era um ciclo,
    # exatamente no arquivo que existe para não mentir. Um ciclo entra inteiro
    # ou não entra.
    _HIST_TETO = 4000
    _HIST_MANTER_CICLOS = 40

    # Quantas linhas de arquivo uma rotina mostra por ciclo. A Doc. Técnica
    # num projeto grande gera trezentas; mandar todas para a tela em cada ciclo de
    # cada leitura faria a resposta pesar megabytes para responder uma pergunta
    # que as primeiras cem já respondem. O que sobra é CONTADO, nunca sumido em
    # silêncio — ver `arquivos_omitidos`.
    _HIST_ARQUIVOS_POR_ROTINA = 120

    # O rótulo de cada origem. Mora aqui, e não no frontend, porque não existe
    # tabela nenhuma de origens em lugar algum — não há o que duplicar, e a
    # regra ("nomes ficam com o frontend") existe para não manter duas listas da
    # mesma coisa, não para proibir a primeira.
    #
    # ⚠️ **'iniciar' e 'inicio-rapido' continuam aqui de propósito, mesmo sem
    # botão que os produza.** Os dois botões saíram em 28/08/2026, mas o
    # `Histórico.jsonl` de quem já usava o programa está cheio de ciclos com
    # essas origens gravadas — tirar as duas linhas daqui não apagaria um
    # registro sequer, só faria a tela mostrar o id cru no lugar do nome.
    _HIST_ORIGENS = {
        'ativar-tudo':      'Ativar tudo',
        'ativar-principal': 'Ativar o principal',
        'limpeza':          'Depois de limpar dados',
        'iniciar':          'Iniciar',
        'inicio-rapido':    'Início rápido',
        'retomada':         'Retomada de pendências',
        't1':               'Espera · T1',
        't2':               'Espera · T2',
        't3':               'Espera · T3',
        'manual':           'Ciclo manual',
    }

    # ── Escrever ────────────────────────────────────────────────────────────

    def _hist_path(self, project_name):
        return obter_arquivo_de_historico_das_rotinas(project_name)

    def _hist_estado(self):
        """Lock e contador de linhas, criados na primeira vez.

        A guarda é o ÚLTIMO campo criado, nunca o primeiro — mesma regra de
        `_proc_state`, e pelo mesmo motivo: guardar pelo primeiro deixa o estado
        nascer pela metade quando alguém cria um dos campos noutro lugar.
        """
        if not hasattr(self, '_hist_linhas'):
            self._hist_locks = {}
            self._hist_relogio = {}
            self._hist_linhas = {}
        return self._hist_linhas

    def _hist_lock(self, project_name):
        self._hist_estado()
        if project_name not in self._hist_locks:
            self._hist_locks[project_name] = threading.Lock()
        return self._hist_locks[project_name]

    def _hist_comecou(self, project_name, agent_id):
        """Marca a hora em que a rotina começou, para a linha dizer quanto durou.

        Chamado de dentro de `_ac_notify(project_name, 'running', agente)`, que
        é o único ponto por onde TODA rotina passa ao começar — o ciclo, a base
        e o ▶ avulso. Pendurar o relógio em cada um dos três seria três lugares
        para esquecer.
        """
        try:
            self._hist_estado()
            # Por (projeto, rotina): com dois projetos ligados, a duração de
            # uma rotina de um saía medida do relógio do outro.
            self._hist_relogio[(project_name, agent_id)] = time.monotonic()
        except Exception:
            pass

    def _hist_duracao(self, project_name, agent_id):
        """Quantos segundos, e tira o relógio da mesa. `None` se não foi marcado.

        `None` acontece de verdade: uma rotina dispensada nunca chega a
        'running', então nunca teve relógio. Zero seria mentira — ela não levou
        zero segundo, ela não rodou.
        """
        try:
            self._hist_estado()
            inicio = self._hist_relogio.pop((project_name, agent_id), None)
            if not inicio:
                return None
            return round(time.monotonic() - inicio, 1)
        except Exception:
            return None

    def _hist_registrar(self, project_name, evento):
        """Acrescenta UMA linha. Falha de escrita é reclamada, não engolida.

        Um histórico que não consegue gravar é um histórico que não existe, e o
        silêncio aqui apagaria exatamente a informação que este arquivo serve
        para guardar. É a mesma regra de `_rp_pend_save`.
        """
        if not project_name:
            return
        try:
            evento.setdefault('quando', datetime.now().isoformat())
            linha = json.dumps(evento, ensure_ascii=False)
            caminho = self._hist_path(project_name)
            with self._hist_lock(project_name):
                os.makedirs(os.path.dirname(caminho), exist_ok=True)
                with open(caminho, 'a', encoding='utf-8') as f:
                    f.write(linha + '\n')
                self._hist_contar_e_aparar(project_name, caminho)
        except Exception as e:
            print('[historico] nao consegui gravar em %s: %s: %s'
                  % (project_name, type(e).__name__, e))

    def _hist_contar_e_aparar(self, project_name, caminho):
        """O teto. Chamado JÁ COM O LOCK NA MÃO por `_hist_registrar`.

        ⚠️ O contador vive em memória de propósito. Contar as linhas do arquivo
        a cada gravação transformaria uma escrita O(1) numa leitura do arquivo
        inteiro por arquivo processado — trezentas leituras de um arquivo de
        quatro mil linhas numa passada da Doc. Técnica. O disco só é relido
        quando o contador ainda não existe (primeira escrita da sessão) ou
        quando o teto estoura.
        """
        linhas = self._hist_estado()
        n = linhas.get(project_name)
        if n is None:
            with open(caminho, 'r', encoding='utf-8') as f:
                n = sum(1 for _ in f)
        else:
            n += 1
        if n > self._HIST_TETO:
            n = self._hist_aparar(caminho)
        linhas[project_name] = n

    def _hist_aparar(self, caminho):
        """Deixa no disco só os últimos `_HIST_MANTER_CICLOS` ciclos INTEIROS.

        Devolve quantas linhas sobraram.

        ⚠️ Nada de `readlines()[-N:]`: o corte tem que cair **numa linha
        `ciclo`**, senão as rotinas que ficaram para trás perdem o cabeçalho
        delas e a leitura as reagrupa como "Execução avulsa".

        Se nem UM cabeçalho de ciclo for encontrado (arquivo só de execuções
        avulsas, ou primeira linha ainda por vir), o arquivo fica como está: um
        corte cego aqui seria pior que crescer um pouco mais, e a próxima
        gravação tenta de novo.
        """
        with open(caminho, 'r', encoding='utf-8') as f:
            todas = f.readlines()
        # ⚠️ Parseado, não procurado por substring: `'"t": "ciclo"' in linha`
        # daria certo hoje e passaria a achar lixo no dia em que um caminho de
        # arquivo contiver esse texto. Custa uns milissegundos, e só acontece
        # uma vez a cada milhares de linhas.
        def e_ciclo(linha):
            try:
                return json.loads(linha).get('t') == 'ciclo'
            except Exception:
                return False

        inicios = [i for i, l in enumerate(todas) if l.strip() and e_ciclo(l)]
        if not inicios:
            return len(todas)
        corte = inicios[-self._HIST_MANTER_CICLOS] if len(inicios) > self._HIST_MANTER_CICLOS else inicios[0]
        if corte == 0:
            return len(todas)
        fim = todas[corte:]
        with open(caminho, 'w', encoding='utf-8') as f:
            f.writelines(fim)
        return len(fim)

    # ── Os quatro atalhos ───────────────────────────────────────────────────

    def _hist_ciclo(self, project_name, origem, grupos=None, caminhos=None):
        self._hist_registrar(project_name, {
            't': 'ciclo', 'origem': origem or 'manual',
            'grupos': sorted(grupos) if grupos else [],
            'caminhos': len(caminhos) if caminhos else 0,
        })

    def _hist_rotina(self, project_name, agent_id, desfecho, motivo=None,
                     requisito=None, saldo=None):
        self._hist_registrar(project_name, {
            't': 'rotina', 'agente': agent_id, 'desfecho': desfecho,
            'motivo': motivo, 'requisito': requisito, 'saldo': saldo,
            'segundos': self._hist_duracao(project_name, agent_id),
        })

    def _hist_arquivo(self, project_name, agent_id, arquivo, desfecho,
                      detalhe=None):
        self._hist_registrar(project_name, {
            't': 'arquivo', 'agente': agent_id, 'arquivo': arquivo,
            'desfecho': desfecho, 'detalhe': detalhe,
        })

    def _hist_fim(self, project_name, completou, parou_em=None):
        self._hist_registrar(project_name, {
            't': 'fim', 'completou': bool(completou), 'parou_em': parou_em,
        })

    # ── Ler ─────────────────────────────────────────────────────────────────

    def _hist_ler(self, project_name):
        """As linhas do disco, na ordem em que foram escritas.

        Linha ilegível é PULADA, não fatal: um `.jsonl` cortado ao meio por
        queda de energia tem uma linha quebrada e três mil boas, e recusar as
        três mil por causa de uma é perder justamente o registro do acidente que
        se está tentando investigar.
        """
        eventos = []
        try:
            with open(self._hist_path(project_name), 'r', encoding='utf-8') as f:
                for linha in f:
                    linha = linha.strip()
                    if not linha:
                        continue
                    try:
                        dado = json.loads(linha)
                    except Exception:
                        continue
                    if isinstance(dado, dict):
                        eventos.append(dado)
        except Exception:
            pass
        return eventos

    def get_historico_da_automacao(self, project_name, limite=30):
        """Os eventos JÁ AGRUPADOS em ciclos, do mais novo para o mais velho.

        ⚠️ Agrupar aqui, e não no JS. A regra de "onde um ciclo começa e termina"
        é uma só e tem que ter um dono só; escrita no frontend, ela viraria a
        segunda cópia — e a segunda cópia é sempre a que fica para trás.

        Uma rotina que aparece SEM cabeçalho de ciclo não é erro: é o ▶ de um
        card, que roda por `_ac_run_single`, fora de ciclo nenhum. Ela cai num
        grupo de origem `avulso`, que a tela mostra como tal.
        """
        try:
            grupos, atual = [], None

            def abrir(origem, quando, grupos_do_ciclo=None, caminhos=0):
                novo = {
                    'origem': origem,
                    'origem_rotulo': self._HIST_ORIGENS.get(
                        origem,
                        'Execução avulsa' if origem == 'avulso' else origem),
                    'quando': quando, 'grupos': grupos_do_ciclo or [],
                    'caminhos': caminhos, 'rotinas': [], 'completou': None,
                    'parou_em': None, 'terminou_em': None,
                }
                grupos.append(novo)
                return novo

            for ev in self._hist_ler(project_name):
                tipo = ev.get('t')
                if tipo == 'ciclo':
                    atual = abrir(ev.get('origem'), ev.get('quando'),
                                  ev.get('grupos'), ev.get('caminhos') or 0)
                elif tipo == 'fim':
                    if atual is not None:
                        atual['completou'] = ev.get('completou')
                        atual['parou_em'] = ev.get('parou_em')
                        atual['terminou_em'] = ev.get('quando')
                    atual = None
                elif tipo == 'rotina':
                    if atual is None:
                        atual = abrir('avulso', ev.get('quando'))
                    self._hist_encaixar_rotina(atual, ev)
                elif tipo == 'arquivo':
                    if atual is None:
                        atual = abrir('avulso', ev.get('quando'))
                    self._hist_encaixar_arquivo(atual, ev)

            for g in grupos:
                self._hist_resumir(g)
            grupos.reverse()
            return {'success': True,
                    'ciclos': grupos[:max(1, int(limite or 30))],
                    'total_ciclos': len(grupos)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    @staticmethod
    def _hist_encaixar_rotina(ciclo, ev):
        """A linha de rotina. Pode já existir, criada pelos arquivos dela.

        ⚠️ **A ordem no arquivo é arquivo-arquivo-arquivo-ROTINA**, e não o
        contrário: as linhas de arquivo são gravadas ENQUANTO a rotina roda, e a
        linha de rotina só quando ela termina. Por isso aqui se PREENCHE uma
        entrada que os arquivos podem ter aberto antes, em vez de acrescentar
        outra — senão a mesma rotina apareceria duas vezes no mesmo ciclo, uma
        com os arquivos e outra com o desfecho.
        """
        agente = ev.get('agente')
        alvo = None
        for r in reversed(ciclo['rotinas']):
            if r['agente'] == agente and r['desfecho'] == 'executando':
                alvo = r
                break
        if alvo is None:
            alvo = {'agente': agente, 'arquivos': [], 'arquivos_omitidos': 0}
            ciclo['rotinas'].append(alvo)
        alvo.update({
            'desfecho': ev.get('desfecho'), 'motivo': ev.get('motivo'),
            'requisito': ev.get('requisito'), 'saldo': ev.get('saldo'),
            'segundos': ev.get('segundos'), 'quando': ev.get('quando'),
        })

    def _hist_encaixar_arquivo(self, ciclo, ev):
        """A linha de arquivo vai na rotina a que ela pertence.

        Procura de trás para a frente e só aceita uma entrada ainda `executando`
        — uma rotina que já tem desfecho terminou, e um arquivo que chegue
        depois pertence a uma passada nova dela, não à que acabou.
        """
        agente = ev.get('agente')
        alvo = None
        for r in reversed(ciclo['rotinas']):
            if r['agente'] == agente and r['desfecho'] == 'executando':
                alvo = r
                break
        if alvo is None:
            alvo = {'agente': agente, 'desfecho': 'executando', 'motivo': None,
                    'requisito': None, 'saldo': None, 'segundos': None,
                    'quando': ev.get('quando'), 'arquivos': [],
                    'arquivos_omitidos': 0}
            ciclo['rotinas'].append(alvo)
        if len(alvo['arquivos']) >= self._HIST_ARQUIVOS_POR_ROTINA:
            alvo['arquivos_omitidos'] += 1
            return
        alvo['arquivos'].append({'arquivo': ev.get('arquivo'),
                                 'desfecho': ev.get('desfecho'),
                                 'detalhe': ev.get('detalhe')})

    @staticmethod
    def _hist_resumir(ciclo):
        """A conta que a trilha mostra no item, antes de alguém abri-lo.

        É a regra do componente Trilha de itens: *o item carrega o tamanho do
        que ele abre*. Sem isto, escolher qual ciclo olhar vira tentativa e erro.
        """
        contas = {}
        for r in ciclo['rotinas']:
            desfecho = r.get('desfecho') or 'executando'
            contas[desfecho] = contas.get(desfecho, 0) + 1
        ciclo['contas'] = contas
        ciclo['quantas'] = len(ciclo['rotinas'])
        ciclo['arquivos'] = sum(len(r['arquivos']) + r['arquivos_omitidos']
                                for r in ciclo['rotinas'])

    def limpar_historico_da_automacao(self, project_name):
        """Apaga o arquivo. Não há confirmação aqui — quem pergunta é a tela."""
        try:
            with self._hist_lock(project_name):
                caminho = self._hist_path(project_name)
                if os.path.isfile(caminho):
                    os.remove(caminho)
                self._hist_estado().pop(project_name, None)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}
