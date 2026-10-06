"""A rotina Documentação Técnica rodando: os lotes, o modelo e a gravação.

⚠️ O PROGRAMA MONTA O `.md`; O LLM SÓ ESCREVE A PROSA. Nome, tipo e número de
linha vêm do tree-sitter e nunca passam pela resposta do modelo — por isso não há
como ele inventar um símbolo ou errar uma linha. Qualquer atalho que peça ao
modelo para "devolver o arquivo pronto" quebra as três consequências disso: o
formato deixa de ser sempre válido, o incremental deixa de ser trivial, e o
conferente vira defesa principal em vez de rede de segurança.

⚠️ QUANDO SÓ A LINHA MUDOU, O PROGRAMA REESCREVE O NÚMERO SEM CHAMAR O MODELO. É
o que torna a rotina barata num projeto que só cresceu — e é por isso que o
estado incremental guarda o hash do CORPO de cada símbolo, e não do arquivo.

⚠️ A FALHA É GRAVADA COMO RESUMO (`gravar_resumo_de_falha`), e não só logada: é
dele que o card da aba Rotinas tira o que aconteceu.
"""

from ...constantes import *
from ..resumo_de_rotina import gravar_resumo_de_falha
from modulos.agentes.llm_estruturado import formato_garantido_indisponivel
from modulos.tokens import contar_tokens, calcular_orcamento, PortaoDeContexto
from .documentacao_tecnica_llm import ArquivoGrandeDemais


class DocumentacaoTecnicaAgenteMixin:

    def executar_agente_documentacao_tecnica(self, project_name, model=None, extensions=None, parallel=None,
                                       apenas_mudados=True, mudados_pre=MUDADOS_AUTO):
        """Gera a documentação técnica de cada arquivo.

        `model=None` e `parallel=None` são o caminho normal desde 21/08/2026:
        o modelo é o que está carregado no LM Studio, e o paralelismo vem de
        Configurações. Os dois eram campos no card, e o do modelo deixava o
        botão manual rodar com um modelo diferente do que o ciclo usava.
        """
        model = model or self._ac_get_current_model()
        parallel = self._rotina_paralelas() if parallel is None else max(
            PARALELISMO_MINIMO, min(PARALELISMO_MAXIMO, int(parallel)))

        def worker():
            try:
                from ...llm_cliente import abrir_cliente_do_lm_studio

                settings = self.load_settings()['settings']
                # `max_retries=0` (D4): a retentativa é a do programa, que a tela
                # mostra (`com_retentativa`). A do SDK repetia em silêncio.
                client = abrir_cliente_do_lm_studio(settings, projeto=project_name,
                                                    dono='doc-tecnica', max_retries=0)

                prompt = self._load_prompt_template(self._DT_PROMPT)
                prompt_costura = self._load_prompt_template(self._DT_PROMPT_COSTURA)
                for nome, texto in ((self._DT_PROMPT, prompt),
                                    (self._DT_PROMPT_COSTURA, prompt_costura)):
                    if not texto:
                        raise ValueError('Prompt template "%s" não encontrado.' % nome)

                workspace = self.load_workspace(project_name)
                if not workspace['success']:
                    self._dt_falhou(project_name, 'Workspace não carregado.')
                    return

                config = workspace['config']
                working_folders = config.get('working_folders', [])
                ignore_list = config.get('ignore_list', [])
                context_descs = self._build_context_descs(config.get('context_items', []))
                limites = self.load_limites()['limites']
                # D28: a Documentação Técnica tem o próprio «% da janela» (o
                # cartão «Partes e costura · Documentação Técnica»). Daqui para
                # baixo `teto_entrada` é o dela — o global fica para o resto.
                limites = {**limites, 'teto_entrada': limites['doc_tecnica_teto_entrada']}

                if not working_folders:
                    self._dt_falhou(project_name, 'Nenhuma pasta de trabalho configurada.')
                    return

                # Índice de símbolos: a fonte determinística de nome/tipo/linha.
                idx = self.get_symbol_index(project_name)
                if not idx['success'] or not idx.get('index'):
                    self.build_symbol_index(project_name)
                    idx = self.get_symbol_index(project_name)
                syms_by_file = {}
                for sym in (idx.get('index') or {}).get('symbols', []):
                    syms_by_file.setdefault(sym['file'], []).append(sym)
                # D35: as classes e os ids de CSS do projeto — um termo com
                # hífen só cai no corte se for um deles.
                nomes_css = self._dt_nomes_css(idx.get('index') or {})

                # Relações vindas do índice de identificadores (o grafo de
                # imports é cego neste app — ver identificadores.py).
                relacoes_por_rel = self._dt_relacoes_map(project_name)

                # Arquivos que mudaram desde a última passada de hashes.
                #
                # ⚠️ Ver `_ac_run_cycle`: dentro do ciclo de
                # acionamentos, `mudados_pre` já vem calculado de ANTES do
                # Hashes regravar a linha de base — perguntar aqui, depois,
                # compararia a linha de base com ela mesma e nunca acharia
                # nada mudado.
                if mudados_pre != MUDADOS_AUTO:
                    mudados = mudados_pre
                else:
                    mudados = None
                    if apenas_mudados:
                        r = self.get_arquivos_mudados(project_name)
                        if r.get('success') and r.get('baseline'):
                            mudados = set(r.get('mudados') or [])

                ext_set = self._ext_set_da_rotina(extensions)
                files_to_process = []
                for folder in working_folders:
                    if not os.path.isdir(folder):
                        continue
                    folder_name = os.path.basename(folder.rstrip(os.sep)) or folder
                    for root, dirs, files in os.walk(folder):
                        if self._caminho_ignorado(root, ignore_list):
                            dirs.clear()
                            continue
                        dirs[:] = [d for d in dirs if not self._caminho_ignorado(os.path.join(root, d), ignore_list)]
                        for fname in sorted(files):
                            fpath = os.path.join(root, fname)
                            if self._caminho_ignorado(fpath, ignore_list):
                                continue
                            if os.path.splitext(fname)[1].lower() not in ext_set:
                                continue
                            rel = os.path.relpath(fpath, folder).replace('\\', '/')
                            files_to_process.append((fpath, fname, folder_name, rel))

                total = len(files_to_process)
                if total == 0:
                    self._dt_falhou(project_name, 'Nenhum arquivo de código encontrado nas pastas de trabalho.')
                    return

                out_base = self._dt_out_base(project_name)
                os.makedirs(out_base, exist_ok=True)
                estado = self._dt_load_estado(project_name)

                # ⚠️ O DENOMINADOR REAL — e a razão de ele existir.
                #
                # `total` é quantos arquivos EXISTEM. A barra usava esse número,
                # mas a maioria costuma ser pulada por hash igual, e essa decisão
                # acontecia lá dentro de `process_file`, DEPOIS de o denominador
                # já estar fixado. Como o contador subia para qualquer arquivo
                # que voltasse — inclusive o pulado — o número andava aos saltos
                # (113, 121, 122) e a tela prometia um trabalho muito maior do
                # que existia: "faltam 255" quando faltavam 34.
                #
                # A condição aqui é a MESMA de `process_file`, na mesma ordem:
                # quem tem descrição de contexto sempre processa (a descrição do
                # usuário manda, e é checada antes do hash lá dentro). Duas
                # cópias da mesma regra é o risco deste trecho — se uma mudar, a
                # barra passa do fim ou nunca chega nele.
                #
                # O par `total` + `a_processar` não é vocabulário novo: é o mesmo
                # de `embedding.py`, a única rotina que já fazia isso certo, e que
                # `cobertura.py` e `embedding.js` já sabem ler.
                # Os gêmeos da última passada do Detector: caminho absoluto →
                # chave da origem. Lido UMA vez; `process_file` roda em várias
                # threads e abriria o `mudanças.json` por arquivo.
                try:
                    gemeos = self._det_gemeos(project_name)
                except Exception:
                    gemeos = {}

                a_processar = 0
                for _fp, _fn, _folder, _rel in files_to_process:
                    _out = os.path.join(out_base, _folder, _rel + '.md')
                    if (mudados is not None and _fp not in mudados
                            and os.path.isfile(_out)
                            and estado.get('%s/%s' % (_folder, _rel), {}).get('sintese')
                            and not self._get_ctx_desc(_fp, context_descs)):
                        continue
                    # Gêmeo também não conta: ele é COPIADO, não gerado, e
                    # prometer trabalho que não vem faz a barra passar do fim.
                    if os.path.normcase(os.path.abspath(_fp)) in gemeos:
                        continue
                    a_processar += 1
                reaproveitaveis = total - a_processar

                self._dt_notify(project_name, {'status': 'running', 'total': total,
                                 'a_processar': a_processar, 'processed': 0,
                                 'reaproveitados': 0, 'reaproveitaveis': reaproveitaveis,
                                 'current': '', 'in_progress': [], 'skipped': [], 'errors': []})

                # Três listas separadas, no modelo do resumo_pastas.py: juntá-las
                # fazia a aba "Arquivos muito grandes" mostrar os inalterados.
                errors, grandes, inalterados, divergencias = [], [], [], []
                sem_llm = [0]
                # `parallel` arquivos em voo dividem UMA janela — o orçamento por
                # arquivo não enxerga os vizinhos. Ver tokens.py::PortaoDeContexto.
                portao = PortaoDeContexto(int(limites.get('janela_contexto', 50000)))
                lock = threading.Lock()
                # ⚠️ `processed_count` conta só quem REALMENTE trabalhou (gerou,
                # falhou ou era grande demais). O arquivo pulado por hash igual
                # vai para `reaproveitados_count`, e é essa separação que faz a
                # barra andar de um em um em vez de saltar.
                processed_count = [0]
                reaproveitados_count = [0]
                gerados = [0]        # só os que produziram `.md` de verdade
                in_progress = set()
                # D7: a fase de cada arquivo em andamento — «parte 2 de 3»,
                # «costurando», «tentativa 2 de 3». Vai em todo evento de
                # progresso; o arquivo sai daqui quando termina.
                fases = {}

                def process_file(fpath, fname, folder_name, rel):
                    # `chave_arquivo` identifica o arquivo em toda a função: pelo
                    # caminho, nunca pelo nome — senão sete __init__.py viram um.
                    chave_arquivo = '%s/%s' % (folder_name, rel)
                    # A aba do projeto foi fechada: volta de mãos vazias, antes de
                    # anunciar o arquivo e antes de qualquer chamada ao modelo.
                    # Ver `agentes/parada_do_projeto.py`.
                    if self.rotina_parada(project_name, 'doc-tecnica'):
                        return 'parado', chave_arquivo, None, fpath
                    with lock:
                        in_progress.add(chave_arquivo)
                        snap = (sorted(in_progress), processed_count[0], list(grandes),
                                list(errors), reaproveitados_count[0])
                    self._dt_notify(project_name, {'status': 'running', 'total': total,
                                     'a_processar': a_processar, 'processed': snap[1],
                                     'reaproveitados': snap[4], 'reaproveitaveis': reaproveitaveis,
                                     'current': chave_arquivo, 'in_progress': snap[0],
                                     'skipped': snap[2], 'errors': snap[3]})

                    def fase(texto, tentativa=False, espera=None):
                        # D7: a fase DESTE arquivo, na tela. Cada mudança manda
                        # um evento — é o que faz o card dizer que o arquivo
                        # grande está na parte 3 de 5, e não parado.
                        with lock:
                            fases[chave_arquivo] = {'texto': texto, 'tentativa': tentativa,
                                                    'espera': espera}
                            snap_f = (sorted(in_progress), processed_count[0], list(grandes),
                                      list(errors), reaproveitados_count[0], dict(fases))
                        self._dt_notify(project_name, {'status': 'running', 'total': total,
                                         'a_processar': a_processar, 'processed': snap_f[1],
                                         'reaproveitados': snap_f[4],
                                         'reaproveitaveis': reaproveitaveis,
                                         'current': chave_arquivo, 'in_progress': snap_f[0],
                                         'skipped': snap_f[2], 'errors': snap_f[3],
                                         'fases': snap_f[5]})

                    def parado():
                        return self.rotina_parada(project_name, 'doc-tecnica')

                    out_dir = os.path.join(out_base, folder_name)
                    out_path = os.path.join(out_dir, rel + '.md')
                    out_sub = os.path.dirname(out_path)

                    try:
                        # Contexto sem leitura: a descrição do usuário manda.
                        ctx_desc = self._get_ctx_desc(fpath, context_descs)
                        if ctx_desc:
                            os.makedirs(out_sub, exist_ok=True)
                            with open(out_path, 'w', encoding='utf-8') as fout:
                                fout.write('# %s\n\n%s\n' % (rel, ctx_desc))
                            return 'ok', chave_arquivo, None, fpath

                        # ── O GÊMEO ──────────────────────────────────────
                        # Dois caminhos vivos ao mesmo tempo com o mesmo
                        # conteúdo. Gerar o segundo com LLM seria pagar duas
                        # vezes pela mesma resposta. Conta como REAPROVEITADO
                        # porque foi isso que houve: nenhuma requisição saiu.
                        #
                        # ⚠️ O título aqui é `rel`, não o nome do arquivo — é o
                        # que `_dt_render_md` grava, e o `.md` do gêmeo tem que
                        # sair no mesmo formato dos outros desta rotina.
                        origem = gemeos.get(os.path.normcase(os.path.abspath(fpath)))
                        if origem and self._det_gemeo_gravar(
                                origem, out_path, rel, out_base):
                            # O registro vai junto: o gêmeo tem Síntese e Termos
                            # no estado, que é de onde o Glossário lê.
                            with lock:
                                estado[chave_arquivo] = dict(estado.get(origem, {}))
                            return ('inalterado', chave_arquivo,
                                    'gêmeo de %s — copiado, sem LLM' % origem, fpath)

                        # A Síntese na condição é a migração (D18): arquivo que
                        # ainda não tem Síntese é processado mesmo sem ter mudado
                        # — a primeira passada depois da fusão preenche todos, uma
                        # vez.
                        if (mudados is not None and fpath not in mudados
                                and os.path.isfile(out_path)
                                and estado.get(chave_arquivo, {}).get('sintese')):
                            # Não chama o modelo, mas as Conexões (do programa)
                            # podem ter mudado — ver `_dt_atualizar_conexoes`.
                            usa, usado_por = relacoes_por_rel.get(chave_arquivo, ([], []))
                            self._dt_atualizar_conexoes(out_path, usa, usado_por)
                            # Os termos também: o corte de identificadores
                            # (`_dt_filtrar_termos`) limpa o estado e o `.md`
                            # já gravados, sem chamar o modelo.
                            with lock:
                                reg = estado.get(chave_arquivo) or {}
                                antes = reg.get('termos') or []
                                depois = self._dt_filtrar_termos(
                                    antes, [s.get('nome') for s in reg.get('simbolos') or []],
                                    nomes_css)
                                if depois != antes:
                                    reg['termos'] = depois
                            if depois != antes:
                                self._dt_atualizar_termos(out_path, depois)
                            # D25: o `.css` de antes perde as frases por seletor, sem modelo.
                            self._dt_css_sem_frase(out_path, rel, reg, usa, usado_por)
                            return 'inalterado', chave_arquivo, 'inalterado (hash igual)', fpath

                        # D1, P2: «O máximo aceito, mesmo dividindo», do mais
                        # barato ao mais caro. O tamanho vem do disco, SEM abrir
                        # o arquivo — é o que descarta o binário gigante sem ler
                        # nada. As linhas e os tokens vêm depois, em
                        # `_dt_gerar_um_arquivo`. Só com «Dividir e costurar»
                        # ligado (D9, D14): desligado não há máximo, só «cabe
                        # numa chamada ou não».
                        if limites['doc_tecnica_dividir']:
                            kb = -(-os.path.getsize(fpath) // 1024)
                            if kb > int(limites['doc_tecnica_max_kb']):
                                return ('grande', chave_arquivo,
                                        'passa do máximo aceito: %d KB, limite %d KB'
                                        % (kb, int(limites['doc_tecnica_max_kb'])), fpath)

                        with open(fpath, 'r', encoding='utf-8', errors='replace') as f:
                            file_content = f.read()
                        lines = file_content.splitlines()

                        with lock:
                            anterior_do_estado = dict(estado.get(chave_arquivo, {}))
                        # O que se refaz, e quando (D25), mora num método: é o
                        # mesmo caminho do script que a comparou com o Espelho
                        # (retirado em 2026-09).
                        try:
                            registro, simbolos, chamou = self._dt_gerar_um_arquivo(
                                client, model, (prompt, prompt_costura), rel, file_content,
                                syms_by_file.get(fpath, []), anterior_do_estado,
                                limites, portao, nomes_css, fase, parado)
                        except ArquivoGrandeDemais as e:
                            return 'grande', chave_arquivo, str(e), fpath
                        if not chamou:
                            with lock:
                                sem_llm[0] += 1

                        problemas = self._dt_conferir(simbolos, lines)

                        usa, usado_por = relacoes_por_rel.get(chave_arquivo, ([], []))
                        md = self._dt_render_md(rel, simbolos, registro)
                        md += self._dt_render_conexoes(usa, usado_por)

                        os.makedirs(out_sub, exist_ok=True)
                        with open(out_path, 'w', encoding='utf-8') as fout:
                            fout.write(md)

                        with lock:
                            estado[chave_arquivo] = registro
                            if problemas:
                                divergencias.append({'file': chave_arquivo, 'problemas': problemas})

                        return 'ok', chave_arquivo, None, fpath
                    except Exception as e:
                        # ⚠️ Fechar a aba fecha o
                        # cliente do LM Studio, e a requisição em voo levanta
                        # aqui. Uma parada pedida não é um erro do arquivo.
                        if self.rotina_parada(project_name, 'doc-tecnica'):
                            return 'parado', chave_arquivo, None, fpath
                        return 'error', chave_arquivo, str(e), fpath

                with ThreadPoolExecutor(max_workers=parallel) as executor:
                    future_map = {executor.submit(process_file, *args): args for args in files_to_process}
                    for future in as_completed(future_map):
                        result_type, chave, reason, fpath_res = future.result()
                        # 'parado' não conta e não lista: o arquivo não foi olhado.
                        if result_type == 'parado':
                            with lock:
                                in_progress.discard(chave)
                                fases.pop(chave, None)
                            continue
                        entrada = {'file': chave, 'path': fpath_res, 'reason': reason}
                        with lock:
                            # ⚠️ AS DUAS CONTAS SÃO SEPARADAS. Somar o inalterado
                            # em `processed` era o salto que a tela mostrava: o
                            # cache devolve dezenas de arquivos em milissegundos e
                            # a barra pulava 113 → 121 sem nada ter sido feito.
                            if result_type == 'inalterado':
                                reaproveitados_count[0] += 1
                            else:
                                processed_count[0] += 1
                            if result_type == 'ok':
                                gerados[0] += 1
                            count = processed_count[0]
                            reaprov = reaproveitados_count[0]
                            in_progress.discard(chave)
                            fases.pop(chave, None)
                            if result_type == 'error':
                                errors.append(entrada)
                            elif result_type == 'grande':
                                grandes.append(entrada)
                            elif result_type == 'inalterado':
                                inalterados.append(entrada)
                            payload = {'status': 'running', 'total': total,
                                       'a_processar': a_processar, 'processed': count,
                                       'reaproveitados': reaprov,
                                       'reaproveitaveis': reaproveitaveis,
                                       'current': chave, 'in_progress': sorted(in_progress),
                                       'skipped': list(grandes), 'inalterados': list(inalterados),
                                       'errors': list(errors), 'fases': dict(fases)}
                        # ── A linha por arquivo, para a sub-aba Histórico ──
                        #
                        # ⚠️ FORA do `with lock`, e de propósito: escrever no
                        # disco segurando o lock que todas as threads do pool
                        # disputam serializaria a rotina inteira num arquivo de
                        # log. O `_hist_registrar` tem lock próprio, e cada
                        # linha é independente das outras.
                        #
                        # ⚠️ "pulado" NÃO é palavra deste nível. Ela já
                        # significa duas coisas na aba (pulada × dispensada, ver
                        # Vocabulário.md), e um terceiro sentido no nível do
                        # arquivo a tornaria inútil.
                        #
                        # ⚠️ **`reaproveitado` NÃO vira linha, vira CONTAGEM.**
                        # No projeto real ele era 90% do arquivo inteiro — 762 de
                        # 843 linhas dizendo "este arquivo não mudou", com as
                        # cinco que importavam enterradas no meio, e o teto do
                        # `Histórico.jsonl` durando cinco ciclos.
                        #
                        # E a linha não carregava informação: `inalterado` só
                        # acontece no ramo `mudados is not None and fpath not in
                        # mudados`, então "reaproveitado APESAR de ter mudado" é
                        # estruturalmente impossível — ela sempre diz a mesma
                        # coisa. A lista completa, quem quiser, já está no
                        # `_resumo.json` desta rotina, no campo `inalterados`.
                        #
                        # A conta chega à tela pelo `saldo` da linha da rotina
                        # (ver `_ac_saldo_da_rotina`).
                        if result_type != 'inalterado' or (reason or '').startswith('gêmeo'):
                            self._hist_arquivo(
                                project_name, 'doc-tecnica', chave,
                                # ⚠️ O GÊMEO tem desfecho próprio, e não some
                                # dentro de "reaproveitado". Ele é a resposta visível
                                # a "dupliquei um arquivo, o que o programa fez?" —
                                # e a resposta certa é "copiou a saída do irmão, sem
                                # gastar uma chamada de LLM". Escondido entre os
                                # reaproveitados, esse trabalho fica invisível.
                                ('copiado do gêmeo'
                                 if (reason or '').startswith('gêmeo')
                                 else {'ok': 'gerado',
                                       'inalterado': 'reaproveitado',
                                       'grande': 'grande demais',
                                       'error': 'erro'}.get(result_type, result_type)),
                                detalhe=reason)
                        self._dt_notify(project_name, payload)

                self._dt_save_estado(project_name, estado)

                # ⚠️ CONTADO, não deduzido. `total - grandes - inalterados -
                # errors` supõe que as quatro listas particionam o total, e
                # elas não particionam: a linha-sentinela do aviso de Formato
                # garantido entra em `errors` sem ser arquivo nenhum. A tela
                # chegou a mostrar `-1 / 332`.
                #
                # E são dois números com o mesmo nome: durante a passada,
                # `processed` é o ANDAMENTO (quantos já voltaram, de qualquer
                # tipo); no resumo final, é quantos foram GERADOS. Por isso o
                # número caía no fim — não era bug de arredondamento, eram
                # duas perguntas diferentes na mesma etiqueta.
                final_processed = gerados[0]

                # Formato garantido desligado no meio do caminho: o servidor
                # recusou o esquema. Sem este aviso a rotina volta a produzir
                # texto solto EM SILÊNCIO — o estado de onde esta obra partiu.
                indisponivel = formato_garantido_indisponivel()
                if indisponivel:
                    errors.append({
                        'file': '(todos os arquivos)', 'path': '',
                        'reason': 'Formato garantido indisponível — %s. As respostas '
                                  'foram aceitas sem a garantia de formato.' % indisponivel,
                    })
                conferidos = sum(len(v.get('simbolos', [])) for v in estado.values())
                summary = {
                    'finished_at': datetime.now().isoformat(),
                    'total': total,
                    'processed': final_processed,
                    'sem_llm': sem_llm[0],
                    'conferidos': conferidos,
                    'divergencias': divergencias,
                    # `skipped` carrega SÓ os grandes — é o que a aba "Arquivos
                    # muito grandes" lê. Os inalterados têm lista própria.
                    'skipped': grandes,
                    'inalterados': inalterados,
                    'errors': errors,
                }
                with open(os.path.join(out_base, '_resumo.json'), 'w', encoding='utf-8') as f:
                    json.dump(summary, f, ensure_ascii=False, indent=2)

                # ⚠️ `processed` aqui é o MESMO contador da passada, e não
                # `final_processed`. Era esta troca de significado que fazia o
                # número CAIR no último instante — durante a execução `processed`
                # queria dizer *quantos já voltaram*, e no fim virava *quantos
                # foram gerados*. Duas perguntas com a mesma etiqueta.
                #
                # Quem quer "quantos geraram .md" agora pede `gerados`, que diz
                # isso no próprio nome. O `_resumo.json` acima não muda: lá
                # `processed` sempre significou o total gerado, e é o que a tela
                # de resultado e `_ac_saldo_da_rotina` leem há muito tempo.
                self._dt_notify(project_name, {'status': 'done', 'total': total,
                                 'a_processar': a_processar,
                                 'processed': processed_count[0],
                                 'gerados': final_processed,
                                 'reaproveitados': reaproveitados_count[0],
                                 'reaproveitaveis': reaproveitaveis,
                                 'sem_llm': sem_llm[0], 'conferidos': conferidos,
                                 'divergencias': divergencias, 'skipped': grandes,
                                 'inalterados': inalterados, 'errors': errors})

            except Exception as e:
                self._dt_falhou(project_name, str(e))

        # A referência da thread fica registrada: é o que deixa o ciclo
        # saber que esta rotina continua viva (ver processando.py).
        self._proc_iniciar(project_name, 'doc-tecnica', worker)
        return {'success': True}

