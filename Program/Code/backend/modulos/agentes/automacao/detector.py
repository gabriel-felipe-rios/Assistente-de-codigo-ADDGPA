"""O **Detector** — vê o que mudou e decide quais rotinas isso merece.

É o **gatilho** do ciclo, não uma etapa dele. A metade que fica acordada
esperando o disco se mexer mora em `detector_vigia.py`; aqui está o que ela
alimenta: classificar cada mudança e escrever a decisão.

Duas saídas, as duas em `Automação/Rotinas/Detector/`: o `mudanças.json` (o
que mudou, em que classe caiu e quem isso acorda), que **sobrevive ao programa
fechar** e é o que conserta o "ele nasce cego"; e o `_resumo.json`, obrigatório
como em toda rotina — é por ele que o ciclo sabe que ela terminou.

⚠️ **Ele roda ANTES do Hashes**, e a ordem não é negociável: é o Hashes que
regrava a linha de base, e depois dela não há mais como saber o que sumiu nem
para onde foi.

⚠️ **A lista de mover/renomear/apagar mudou de dono.** Morava em
`Pendências.json` e agora mora no `mudanças.json`, na chave `sincronia`. Havia
duas listas da mesma coisa; agora é um dado, um lugar. Quem consome continua
sendo o agente Sincronia, por `_rp_pend_tomar_sincronia`.

⚠️ **A classificação mora em `detector_classes.py` e a memória de comparação em
`detector_impressoes.py`.** Aqui ficou o que este arquivo sempre fez: levantar o
que mudou, encomendar a classe e gravar. São três arquivos porque cada um
responde uma pergunta diferente — *o que mudou?*, *em que classe isso cai?* e
*como este arquivo estava da última vez?*.

⚠️ **`acorda_pendente` é uma DÍVIDA, não um retrato da última passada.** O
Detector só roda no T1, e o `mudanças.json` é reescrito inteiro a cada passada:
sem acumular, uma segunda mudança sobrescreveria o arquivo antes de o T3 rodar e
a rotina que ele devia acordar simplesmente não rodaria, sem nada avisar. Quem
risca a dívida é `_det_riscar`, e só depois de a rotina TERMINAR.
"""

from ...constantes import *
from ...versoes import hash_do_conteudo


class DetectorMixin:
    """A metade do Detector que decide — a que vigia está em `detector_vigia.py`."""

    # As QUATRO rotinas caras, as únicas cuja execução a classificação decide.
    # As outras dez custam segundos e rodam sempre: pular o Grafo de Imports
    # para poupar dois segundos só produz um grafo desatualizado.
    _DET_ROTINAS_CARAS = ('doc-tecnica', 'resumo-pastas', 'glossario', 'pipeline')

    # A tabela das doze classes mora em `detector_classes.py`, junto da árvore
    # de decisão que a preenche — aqui ela seria dado solto longe de quem o usa.

    def _det_dir(self, project_name):
        return obter_pasta_da_rotina(project_name, 'detector')

    def _det_notify(self, project_name, payload):
        # `project` no payload: o front ignora o evento quando este projeto
        # não é o exibido no momento (várias abas de projeto abertas).
        payload = {**payload, 'project': project_name}
        try:
            self.window.evaluate_js('detectorAgentProgress(%s)' % json.dumps(payload))
        except Exception:
            pass

    # ── A decisão ───────────────────────────────────────────────────────────

    def _det_classificar(self, project_name, caminho, acao,
                         antes=None, agora=None, gemeo=False):
        """Em que classe esta mudança cai — a árvore está em
        `detector_classes.py`, que é o arquivo que responde a essa pergunta."""
        return self._det_classe_de(caminho, acao, antes, agora, gemeo)

    # ── A detecção ──────────────────────────────────────────────────────────

    def _det_hash(self, caminho):
        try:
            return hash_do_conteudo(caminho)
        except Exception:
            return None
    def _det_levantar(self, project_name, caminhos):
        """Devolve `(mudancas, sincronia, impressoes)` a partir do disco.

        `caminhos` são os absolutos que a Espera acumulou; sem eles (o ▶
        Executar do card), compara-se contra a linha de base inteira.

        A ordem interna importa: **mover e apagar primeiro**. Um arquivo que
        mudou de lugar aparece nas duas listas — como caminho que sumiu e como
        caminho que nasceu —, e classificá-lo como "criado" faria a Documentação
        Técnica gerar com LLM o que a Sincronia ia só mover.
        """
        salvos = self._hs_load(project_name)['arquivos']

        # ⚠️ UMA varredura, não duas. `detectar_sincronia` chamava `_hs_scan` por
        # dentro e jogava o resultado fora; o Detector precisa do mesmo dado para
        # achar os gêmeos. Num projeto grande a varredura repetida era o passo
        # mais caro de uma rotina que deveria ser instantânea.
        try:
            atuais = self._hs_scan(project_name) or {}
        except Exception:
            atuais = {}

        # 1. Mover, renomear e apagar. Quem pareia "sumiu aqui + nasceu ali" é
        #    o hash de conteúdo, e quem já sabe fazer isso é a Sincronia — o
        #    Detector não reimplementa o pareamento, só o encomenda.
        try:
            operacoes = self.detectar_sincronia(project_name, atuais=atuais)
        except Exception:
            operacoes = []

        # As duas leituras que valem para a passada inteira. Ler por arquivo
        # abriria o `limites.json` centenas de vezes.
        impressoes = self._det_impressoes_ler(project_name)
        prefs = self._det_preferencias()

        mudancas, sincronia, ja_vistos = [], [], set()
        for op in operacoes:
            movido = op.get('op') == 'mover'
            de_abs = self._hs_abs_path(project_name, op['de'])
            para_abs = self._hs_abs_path(project_name, op['para']) if movido else None
            acao = 'movido' if movido else 'apagado'
            alvo = para_abs or de_abs
            if alvo:
                ja_vistos.add(os.path.normcase(os.path.abspath(alvo)))
            if de_abs:
                ja_vistos.add(os.path.normcase(os.path.abspath(de_abs)))
            classe = 'movido' if movido else 'apagado'
            mudancas.append({
                'caminho': (alvo or de_abs or op['de']).replace('\\', '/'),
                # A chave RELATIVA, para quem só quer mostrar o arquivo.
                # Aqui ela sai de graça: `op['de']` e `op['para']` já são chaves.
                'rel': op.get('para') or op.get('de'),
                'acao': acao,
                'classe': classe,
                'hash': self._det_hash(alvo) if movido else None,
                'acorda': self._det_acorda(classe, alvo, prefs),
                'de': (de_abs or op['de']).replace('\\', '/') if movido else None,
                'gemeo_de': None,
            })
            # A forma gravada é a do contrato do `mudanças.json`, não a que a
            # Sincronia consome — a tradução mora em `_det_tomar_sincronia`.
            sincronia.append({'acao': acao, 'de': op['de'],
                              'para': op.get('para')})

        # 2. O que foi criado ou alterado.
        if caminhos is None:
            diff = self.get_arquivos_mudados(project_name)
            caminhos = list(diff.get('mudados') or []) if diff.get('success') else []
        conhecidos = self._det_conhecidos(project_name, salvos)
        gemeos = self._det_pares_gemeos(project_name, salvos, atuais)
        # A régua do que não é código compara o arquivo-fonte com ele mesmo de quando a
        # saída foi gerada, e para isso precisa da chave relativa dele.
        chaves = self._det_mapa_de_chaves(project_name, atuais)
        for caminho in caminhos:
            chave = os.path.normcase(os.path.abspath(caminho))
            if chave in ja_vistos:
                continue
            ja_vistos.add(chave)
            # Sumiu sem par: viria como 'apagado' acima se a linha de base o
            # conhecesse. Sem base, não há o que afirmar.
            if not os.path.isfile(caminho):
                continue
            acao = 'alterado' if chave in conhecidos else 'criado'
            agora = self._det_impressao(caminho)
            gemeo_de = gemeos.get(chave)
            classe = self._det_classificar(project_name, caminho, acao,
                                           impressoes.get(chave), agora,
                                           gemeo=bool(gemeo_de))
            acorda = self._det_acorda(classe, caminho, prefs)
            # ── A RÉGUA DO QUE NÃO É CÓDIGO ─────────────────────────────────
            # Aqui a pergunta deixa de ser "o quê mudou" e passa a ser "o
            # quanto". Trocar um ponto final por exclamação num prompt fica em
            # ~99% de similaridade e não regera nada; reescrever metade dele
            # cai bem abaixo do limiar e regera.
            #
            # ⚠️ Em toda dúvida ela devolve "regera" — arquivo novo, índice
            # vazio, modelo de embedding fora do ar. Errar para mais custa uma
            # chamada de LLM; errar para menos deixa a documentação velha para
            # sempre, e sem aviso.
            if classe == 'nao-codigo' and acorda:
                rel_fonte = chaves.get(chave)
                if rel_fonte:
                    self._det_indexar_fonte(project_name, caminho, rel_fonte)
                    if not self._det_vale_regerar_nao_codigo(project_name, rel_fonte):
                        acorda = []
            mudancas.append({
                'caminho': caminho.replace('\\', '/'),
                # ⚠️ Campo ADITIVO, e o `caminho` absoluto continua sendo o
                # contrato: `_det_gemeos` e as impressões casam por caminho
                # absoluto normalizado, e trocar isso quebraria as duas.
                # `rel` existe só para a TELA — o caminho absoluto tem 150
                # caracteres e estoura a coluna da sub-aba Histórico, enquanto
                # todas as outras rotinas registram a chave relativa.
                'rel': chaves.get(chave),
                'acao': acao,
                'classe': classe,
                'hash': self._det_hash(caminho),
                'acorda': acorda,
                'de': None,
                'gemeo_de': gemeo_de,
            })
            if agora is not None:
                impressoes[chave] = agora
        # A memória segue só dos que continuam vivos: guardar impressão de
        # arquivo apagado faria o `impressões.json` crescer para sempre.
        vivos = self._det_conhecidos(project_name, atuais)
        impressoes = {k: v for k, v in impressoes.items() if k in vivos}
        return mudancas, sincronia, impressoes

    def _det_pares_gemeos(self, project_name, salvos, atuais):
        """`{caminho absoluto do gêmeo: caminho relativo da origem}`.

        Gêmeo é **dois caminhos vivos ao mesmo tempo** com o mesmo conteúdo —
        diferente de *movido*, que é um caminho que sumiu e outro que nasceu.

        ⚠️ `detectar_sincronia` NÃO serve aqui: ela sai cedo com
        `if not removidos: return []`. Copiar um arquivo não remove nada, então
        o gêmeo nunca chegaria lá. O pareamento é próprio, e é curto.

        A ORIGEM é a que a linha de base já conhece — ou seja, a que já tem
        documentação gerada. Se as duas forem novas, a primeira em ordem
        alfabética, para a escolha ser estável entre passadas.
        """
        por_hash = {}
        for chave, info in atuais.items():
            h = info.get('hash')
            if h:
                por_hash.setdefault(h, []).append(chave)
        pares = {}
        for _h, chaves in por_hash.items():
            if len(chaves) < 2:
                continue
            chaves = sorted(chaves)
            origem = next((c for c in chaves if c in salvos), chaves[0])
            for c in chaves:
                if c == origem:
                    continue
                abs_c = self._hs_abs_path(project_name, c)
                if abs_c:
                    pares[os.path.normcase(os.path.abspath(abs_c))] = origem
        return pares

    def _det_mapa_de_chaves(self, project_name, arquivos):
        """`{caminho absoluto: chave relativa}` — o inverso de `_hs_abs_path`.

        Montado UMA vez, pelo mesmo motivo de `_det_conhecidos`: `_hs_abs_path`
        recarrega o workspace a cada chamada, e perguntar por arquivo tornava a
        passada quadrática num projeto grande.
        """
        try:
            pastas = self.load_workspace(project_name)['config'].get('working_folders', [])
        except Exception:
            return {}
        raizes = [(os.path.basename(p.rstrip(os.sep)) or p, p) for p in pastas]
        mapa = {}
        for chave in arquivos:
            for raiz, pasta in raizes:
                if chave.startswith(raiz + '/'):
                    caminho = os.path.join(pasta, chave[len(raiz) + 1:].replace('/', os.sep))
                    mapa[os.path.normcase(os.path.abspath(caminho))] = chave
                    break
        return mapa

    def _det_conhecidos(self, project_name, salvos):
        """Os caminhos absolutos que a linha de base já conhece — um conjunto
        montado UMA vez. `_hs_abs_path` recarrega o workspace a cada chamada, e
        perguntar por arquivo tornava a distinção entre "criado" e "alterado"
        quadrática num projeto grande."""
        try:
            pastas = self.load_workspace(project_name)['config'].get('working_folders', [])
        except Exception:
            return set()
        raizes = [(os.path.basename(p.rstrip(os.sep)) or p, p) for p in pastas]
        conhecidos = set()
        for chave in salvos:
            for raiz, pasta in raizes:
                if chave.startswith(raiz + '/'):
                    caminho = os.path.join(pasta, chave[len(raiz) + 1:].replace('/', os.sep))
                    conhecidos.add(os.path.normcase(os.path.abspath(caminho)))
                    break
        return conhecidos

    # ── Persistência ────────────────────────────────────────────────────────

    def _det_gravar(self, project_name, mudancas, sincronia, vistos,
                    impressoes=None):
        """Escreve as duas saídas. O `_resumo.json` é o que destrava o ciclo.

        ⚠️ `finished_at` em ISO é o ÚNICO campo obrigatório: `_ac_get_resumo_time`
        lê exatamente `data.get('finished_at', '')` e faz `fromisoformat`.
        Outro nome, ou formato que não seja ISO, devolve `None` — e o ciclo
        conclui que a rotina nunca rodou.
        """
        agora = datetime.now().isoformat()
        pasta = self._det_dir(project_name)
        os.makedirs(pasta, exist_ok=True)

        # ⚠️ A DÍVIDA SE SOMA À ANTERIOR, e é isso que impede o buraco silencioso
        # do T1/T3: o Detector só roda no T1 e reescreve este arquivo inteiro.
        # Uma segunda mudança, chegando antes de o T3 rodar, apagaria o que o T3
        # ainda devia — e a rotina não rodaria, sem nada avisar. Quem tira um id
        # daqui é `_det_riscar`, depois de a rotina TERMINAR.
        pendente = set(self._det_ler(project_name).get('acorda_pendente') or [])
        for m in mudancas:
            pendente.update(m.get('acorda') or [])
        pendente &= set(self._DET_ROTINAS_CARAS)

        with open(obter_arquivo_de_mudancas(project_name), 'w', encoding='utf-8') as f:
            json.dump({'gerado_em': agora, 'mudancas': mudancas,
                       'sincronia': sincronia,
                       'acorda_pendente': sorted(pendente)},
                      f, ensure_ascii=False, indent=2)
        if impressoes is not None:
            self._det_impressoes_gravar(project_name, impressoes)
        classificados = len([m for m in mudancas if m['acorda']])
        gemeos = len([m for m in mudancas if m.get('classe') == 'gemeo'])
        with open(os.path.join(pasta, '_resumo.json'), 'w', encoding='utf-8') as f:
            json.dump({'finished_at': agora, 'vistos': vistos,
                       'classificados': classificados,
                       'gemeos': gemeos, 'erros': []},
                      f, ensure_ascii=False, indent=2)
        # ── A linha por arquivo, para a sub-aba Histórico ────────────────
        #
        # É AQUI que a pergunta "e este arquivo, foi processado ou pulado?" tem
        # a resposta mais completa do programa inteiro: o Detector é quem olha
        # arquivo por arquivo e decide. As rotinas caras só recebem o veredito.
        #
        # ⚠️ Um arquivo que MUDOU e não acorda ninguém (`espaco-em-branco`,
        # `vazio`) é justamente o caso mais difícil de entender olhando a tela —
        # o ciclo passa por ele e não acontece nada. A linha diz "reconhecido,
        # e de propósito não acordou ninguém", que é diferente de silêncio.
        for m in mudancas:
            acorda = m.get('acorda') or []
            self._hist_arquivo(
                project_name, 'detector',
                # A relativa quando existe. Arquivo apagado que nunca esteve na
                # linha de base não tem chave — aí o absoluto é tudo o que há, e
                # mostrá-lo é melhor que não mostrar nada.
                m.get('rel') or m.get('caminho'),
                m.get('classe') or 'codigo',
                detalhe=('acorda ' + ', '.join(acorda)) if acorda
                        else 'não acorda ninguém')

        return {'gerado_em': agora, 'vistos': vistos,
                'classificados': classificados, 'gemeos': gemeos}

    def _det_ler(self, project_name):
        try:
            with open(obter_arquivo_de_mudancas(project_name), 'r', encoding='utf-8') as f:
                dados = json.load(f)
            if isinstance(dados, dict):
                dados.setdefault('mudancas', [])
                dados.setdefault('sincronia', [])
                return dados
        except Exception:
            pass
        return {'gerado_em': None, 'mudancas': [], 'sincronia': []}

    def _det_tomar_sincronia(self, project_name):
        """Retira as operações de mover/apagar e as devolve **no formato que o
        agente Sincronia consome**.

        A tradução acontece aqui, e só aqui: o arquivo guarda o vocabulário do
        contrato (`movido`/`apagado`) e a Sincronia continua falando o dela
        (`mover`/`apagar`), sem que nenhuma ponta saiba da outra.
        """
        dados = self._det_ler(project_name)
        pendentes = dados.get('sincronia') or []
        if not pendentes:
            return []
        dados['sincronia'] = []
        try:
            with open(obter_arquivo_de_mudancas(project_name), 'w', encoding='utf-8') as f:
                json.dump(dados, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
        traduz = {'movido': 'mover', 'apagado': 'apagar'}
        ops = []
        for item in pendentes:
            op = {'op': traduz.get(item.get('acao'), 'apagar'), 'de': item.get('de')}
            if op['op'] == 'mover':
                op['para'] = item.get('para')
            ops.append(op)
        return ops

    # ── API pública ─────────────────────────────────────────────────────────

    def run_detector_agent(self, project_name, caminhos=None):
        """Detecta, classifica e grava. É o que o ciclo e o ▶ Executar chamam.

        `caminhos` (absolutos) é a lista que a Espera acumulou; sem ela,
        compara-se contra a linha de base inteira — o caso do botão do card."""
        def worker():
            try:
                self._det_notify(project_name, {'status': 'running'})
                salvos = self._hs_load(project_name)['arquivos']
                mudancas, sincronia, impressoes = self._det_levantar(
                    project_name, caminhos)
                resumo = self._det_gravar(project_name, mudancas, sincronia,
                                          len(salvos), impressoes)
                self._det_notify(project_name, {'status': 'done', **resumo})
            except Exception as e:
                # Mesmo em erro, grava o `_resumo.json`: é o `finished_at` que
                # o ciclo espera para não travar a cadeia inteira atrás dele.
                try:
                    os.makedirs(self._det_dir(project_name), exist_ok=True)
                    with open(os.path.join(self._det_dir(project_name), '_resumo.json'),
                              'w', encoding='utf-8') as f:
                        json.dump({'finished_at': datetime.now().isoformat(),
                                   'erros': [str(e)]}, f, ensure_ascii=False, indent=2)
                except Exception:
                    pass
                self._det_notify(project_name, {'status': 'error', 'error': str(e)})

        # A referência da thread fica registrada: é o que deixa o ciclo saber
        # que esta rotina continua viva (ver processando.py).
        self._proc_iniciar(project_name, 'detector', worker)
        return {'success': True}

    def get_detector_mudancas(self, project_name):
        """O que o Detector decidiu na última passada — é o que o card lê.

        Devolve a contagem por CLASSE, e não a lista crua: a pergunta que o
        card responde é "ele está decidindo certo?", e cem linhas de caminho
        não respondem isso."""
        try:
            dados = self._det_ler(project_name)
            mudancas = dados.get('mudancas') or []
            por_classe = {}
            for m in mudancas:
                classe = m.get('classe') or 'codigo'
                linha = por_classe.setdefault(
                    classe, {'classe': classe, 'arquivos': 0, 'acorda': []})
                linha['arquivos'] += 1
                # ⚠️ UNIÃO, e não o `acorda` do primeiro registro da classe: os
                # dois interruptores de Configurações fazem a mesma classe
                # acordar coisas diferentes, e mostrar só o primeiro faria a
                # tabela mentir sobre metade dos arquivos.
                for a in (m.get('acorda') or []):
                    if a not in linha['acorda']:
                        linha['acorda'].append(a)
            for linha in por_classe.values():
                linha['acorda'].sort()
            # ── A decisão vista PELA ROTINA, e não pela classe ───────────
            #
            # A tabela por classe responde "ele está decidindo certo?". Esta
            # conta responde outra pergunta, que é a que se faz olhando a lista
            # de Acionamentos: **"quantos arquivos sobraram para ESTA rotina?"**
            #
            # `vistos` vem do `_resumo.json` da última passada — é o total de
            # arquivos da linha de base. A diferença entre ele e o número de
            # mudanças é o que foi pulado por hash igual, que costuma ser a
            # esmagadora maioria e é justamente o que a tela nunca mostrou.
            por_rotina = {}
            for m in mudancas:
                for a in (m.get('acorda') or []):
                    por_rotina[a] = por_rotina.get(a, 0) + 1

            vistos = 0
            try:
                with open(os.path.join(self._det_dir(project_name), '_resumo.json'),
                          'r', encoding='utf-8') as f:
                    vistos = int(json.load(f).get('vistos') or 0)
            except Exception:
                pass

            return {'success': True, 'existe': bool(dados.get('gerado_em')),
                    'gerado_em': dados.get('gerado_em'),
                    'total': len(mudancas),
                    'sincronia': len(dados.get('sincronia') or []),
                    'pendente': list(dados.get('acorda_pendente') or []),
                    'por_rotina': por_rotina,
                    'motivos': {
                        'vistos': vistos,
                        'mudaram': len(mudancas),
                        # ⚠️ Nunca negativo: `vistos` é da última passada do
                        # Detector e as mudanças podem ser de uma posterior.
                        'hash_igual': max(0, vistos - len(mudancas)),
                        'por_classe': {c: l['arquivos']
                                       for c, l in por_classe.items()},
                    },
                    'classes': sorted(por_classe.values(),
                                      key=lambda l: -l['arquivos'])}
        except Exception as e:
            return {'success': False, 'error': str(e)}
