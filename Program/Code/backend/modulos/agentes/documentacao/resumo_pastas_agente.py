"""A rotina Resumo de Pastas rodando: o laço, as partes e a gravação.

⚠️ UMA PASTA, UM RESUMO. O orçamento é medido antes: cabendo, uma chamada; não
cabendo, lotes do tamanho do teto de entrada e uma costura curta do papel da
pasta (em rodadas, se preciso — ver `agentes/costura.py`).

⚠️ SÓ PASTA COMPLETA É RESUMIDA. A regra mora na casca
(`resumo_pastas.py::_rp_pastas_do_codigo`): pasta com Documentação Técnica faltando produziria
um resumo que fala de metade do código como se fosse o todo — e ninguém, lendo,
saberia que faltou. Melhor não resumir do que resumir errado.

⚠️ O PORTÃO DE CONTEXTO CORTA ANTES DE ESTOURAR, e o corte avisa. Ver o mesmo
mecanismo em `subagentes_execucao.py`.
"""

from ...constantes import *
from modulos.agentes.llm_estruturado import (
    chat_json, com_retentativa, conferir_terminou, RespostaCortada, MOTIVO_CORTADA,
    FormatoNaoObedecido, formato_garantido_indisponivel, json_da_resposta,
    mensagens_da_rotina,
)
from modulos.tokens import contar_tokens, calcular_orcamento, PortaoDeContexto
from ..costura import costurar, texto_da_rodada
from ...llm_geracao import ajustes_da_chamada

# O esquema da costura, irmão do prompt `resumo-de-pastas-costura.txt`.
_RP_SCHEMA_COSTURA = 'resumo-de-pastas-costura.json'

# As listas que o programa junta sozinho quando a pasta vira partes: só o papel
# da pasta passa pela costura do modelo.
_RP_LISTAS = ('arquivos', 'simbolos', 'conexoes_internas', 'conexoes_externas')


class ResumoPastasAgenteMixin:

    def _rp_vetores_de_agora(self, project_name, rel_folder, nomes):
        """Deixa em dia os vetores da Documentação Técnica desta pasta, ANTES da
        régua (D41).

        O Embedding roda depois do Resumo; sem isto a régua comparava a
        referência com o que ele deixou na volta anterior. Só o pedaço que
        mudou é reembedado. Levanta em erro — quem chama trata como "não sei".
        """
        doc_base = obter_pasta_da_rotina(project_name, 'documentacao-tecnica')
        for nome in nomes:
            caminho = os.path.join(doc_base, *rel_folder.split('/'), nome + '.md')
            if not os.path.isfile(caminho):
                continue
            with open(caminho, 'r', encoding='utf-8') as f:
                conteudo = f.read()
            self._emb_indexar_pedacos(
                project_name, 'documentacao-tecnica', '%s/%s.md' % (rel_folder, nome),
                conteudo, caminho, self._emb_hash_file(caminho))

    @staticmethod
    def _rp_unir(listas):
        """A união das listas das partes, na ordem, sem repetir item igual."""
        saida = []
        for lista in listas:
            for item in (lista or []):
                if item not in saida:
                    saida.append(item)
        return saida

    def run_resumo_pastas_agent(self, project_name, model=None, parallel=None):
        """Ver `executar_agente_documentacao_tecnica` sobre `model`/`parallel`."""
        model = model or self._ac_get_current_model()
        parallel = self._rotina_paralelas() if parallel is None else max(
            PARALELISMO_MINIMO, min(PARALELISMO_MAXIMO, int(parallel)))
        out_dir = obter_pasta_da_rotina(project_name, 'resumo-pastas')

        def _emit(payload):
            # A batida vem PRIMEIRO, e o `evaluate_js` protegido — ver
            # `documentacao_tecnica.py::_dt_notify`.
            self._proc_apply(project_name, 'resumo-pastas', payload)
            # `project` no payload: o front ignora o evento quando este
            # projeto não é o exibido no momento (várias abas abertas).
            payload_evt = {**payload, 'project': project_name}
            try:
                self.window.evaluate_js(f'resumoPastasAgentProgress({json.dumps(payload_evt)})')
            except Exception:
                pass

        def _finalize(summary):
            os.makedirs(out_dir, exist_ok=True)
            with open(os.path.join(out_dir, '_resumo.json'), 'w', encoding='utf-8') as f:
                json.dump(summary, f, ensure_ascii=False, indent=2)

        def worker():
            try:
                from ...llm_cliente import abrir_cliente_do_lm_studio
                from concurrent.futures import ThreadPoolExecutor, as_completed

                settings = self.load_settings()['settings']

                prompt_template = self._load_prompt_template('resumo-de-pastas')
                if not prompt_template:
                    raise ValueError('Prompt template "resumo-de-pastas" não encontrado.')
                prompt_costura = self._load_prompt_template('resumo-de-pastas-costura')
                if not prompt_costura:
                    raise ValueError('Prompt template "resumo-de-pastas-costura" não encontrado.')

                workspace = self.load_workspace(project_name)
                if not workspace['success']:
                    _finalize({'finished_at': datetime.now().isoformat(), 'folders': 0, 'error': 'Workspace não carregado.'})
                    _emit({"status": "error", "error": "Workspace não carregado."})
                    return

                if not workspace['config'].get('working_folders', []):
                    _finalize({'finished_at': datetime.now().isoformat(), 'folders': 0, 'error': 'Nenhuma pasta de trabalho configurada.'})
                    _emit({"status": "error", "error": "Nenhuma pasta de trabalho configurada."})
                    return

                # Pastas reais = as pastas do CÓDIGO com ao menos 1 arquivo
                # elegível direto. Enumeradas a partir das pastas de trabalho,
                # não da árvore da Documentação Técnica: pasta sem nenhum
                # arquivo documentado também precisa aparecer, como travada, em
                # vez de sumir calada.
                pastas = self._rp_pastas_do_codigo(project_name)
                if not pastas:
                    _finalize({'finished_at': datetime.now().isoformat(), 'folders': 0,
                               'error': 'Nenhum arquivo elegível nas pastas de trabalho.'})
                    _emit({"status": "error", "error": "Nenhum arquivo elegível nas pastas de trabalho."})
                    return

                # Pasta incompleta NÃO gera resumo — e não some: vai para
                # `bloqueadas`, com o arquivo culpado e o motivo, que é o que o
                # card mostra. O botão manual espera, não ignora.
                bloqueadas = []
                rel_folders = []
                for rel in sorted(pastas):
                    if pastas[rel]['faltando']:
                        bloqueadas.extend(pastas[rel]['faltando'])
                    else:
                        rel_folders.append(rel)
                total = len(rel_folders)

                if total == 0:
                    erro = ('Nenhuma pasta está com a Documentação Técnica completa. '
                            'Rode a Documentação Técnica primeiro.')
                    _finalize({'finished_at': datetime.now().isoformat(), 'folders': 0,
                               'bloqueadas': bloqueadas, 'error': erro})
                    _emit({"status": "error", "error": erro, "bloqueadas": bloqueadas})
                    return

                os.makedirs(out_dir, exist_ok=True)

                limites = self.load_limites()['limites']
                # D28: o Resumo de Pastas tem o próprio «% da janela» (o cartão
                # «Partes e costura · Resumo de Pastas»). Daqui para baixo
                # `teto_entrada` é o dele — o global fica para o resto.
                limites = {**limites, 'teto_entrada': limites['resumo_pastas_teto_entrada']}
                orc = calcular_orcamento(limites, prompt_template)
                budget = orc['sobra_tokens']
                if budget <= 0:
                    _finalize({'finished_at': datetime.now().isoformat(), 'folders': 0,
                               'error': 'Janela de contexto pequena demais para o prompt do Resumo de Pastas.'})
                    _emit({"status": "error", "error": "Janela de contexto pequena demais — aumente a janela em Configurações."})
                    return

                # A janela é uma só para as `parallel` requisições em voo. Sem
                # este portão, quatro lotes dimensionados para a janela inteira
                # saíam juntos e o LM Studio recusava todos — inclusive os
                # pequenos. Ver tokens.py::PortaoDeContexto.
                portao = PortaoDeContexto(orc['janela'])

                hashes = self._rp_load_hashes(out_dir)

                # A fonte das fichas, lida UMA vez por passada (D26): o estado
                # da Documentação Técnica e as Conexões do programa.
                estado_dt = self._dt_load_estado(project_name)
                relacoes = self._dt_relacoes_map(project_name)
                teto_entrada = int(limites['teto_entrada'])
                teto_saida = int(limites['teto_saida'])
                # D30, D36: quantos tokens de resposta cada arquivo da pasta
                # custa, com a margem — o que decide dividir pela SAÍDA.
                por_arquivo = self._rp_resposta_por_arquivo(limites)
                max_por_parte = max(1, int(limites['resumo_pastas_max_arquivos_por_parte']))
                # D20, D24, D25: o que vai na ficha. A Síntese vai sempre.
                partes_da_ficha = {p: bool(limites['resumo_pastas_ficha_' + p])
                                   for p in ('atribuicoes', 'simbolos', 'frases', 'usa')}
                rotulo_das_partes = self._rp_rotulo_das_partes(partes_da_ficha)
                # D26, D29, D30: dividir a pasta que não cabe numa chamada, e
                # «O máximo aceito, mesmo dividindo».
                dividir_pasta = bool(limites['resumo_pastas_dividir'])
                max_arquivos_pasta = int(limites['resumo_pastas_max_arquivos'])
                max_tokens_pasta = int(limites['resumo_pastas_max_tokens'])

                _emit({"status": "running", "total": total, "processed": 0, "current": "",
                       "in_progress": [], "skipped": [], "errors": [],
                       "bloqueadas": bloqueadas})

                errors = []     # erros de verdade (exceção) → sub-aba "Erros"
                grandes = []     # ficha grande demais p/ 1 lote → sub-aba "Arquivos muito grandes"
                counters = {'generated': 0, 'unchanged': 0}
                lock = threading.Lock()
                processed_count = [0]
                in_progress = set()
                # D7: a fase de cada pasta em andamento — «lote 2 de 4»,
                # «costurando», «tentativa 2 de 3». Vai em todo evento de
                # progresso; a pasta sai daqui quando termina.
                fases = {}

                def process_folder(rel_folder):
                    # A aba do projeto foi fechada: volta de mãos vazias, antes
                    # de anunciar a pasta e antes de abrir o cliente do LM
                    # Studio. Mesmo corte da Doc. Técnica — ver
                    # `agentes/parada_do_projeto.py`.
                    if self.rotina_parada(project_name, 'resumo-pastas'):
                        return 'parado'
                    with lock:
                        in_progress.add(rel_folder)
                        snap = sorted(in_progress)
                        snap_p = processed_count[0]
                    _emit({"status": "running", "total": total, "processed": snap_p,
                           "current": rel_folder, "in_progress": snap,
                           "skipped": list(grandes), "errors": list(errors)})

                    def fase(texto, tentativa=False, espera=None):
                        # D7: a fase DESTA pasta, na tela. Cada mudança manda um
                        # evento — é o que faz o card dizer que a pasta está no
                        # lote 2 de 4, e não parada.
                        with lock:
                            fases[rel_folder] = {'texto': texto, 'tentativa': tentativa,
                                                 'espera': espera}
                            payload_f = {"status": "running", "total": total,
                                         "processed": processed_count[0],
                                         "current": rel_folder,
                                         "in_progress": sorted(in_progress),
                                         "skipped": list(grandes), "errors": list(errors),
                                         "bloqueadas": bloqueadas, "fases": dict(fases)}
                        _emit(payload_f)

                    try:
                        # `max_retries=0` (D4): a retentativa é a do programa, que
                        # a tela mostra (`com_retentativa`). A do SDK era silenciosa.
                        client = abrir_cliente_do_lm_studio(settings, projeto=project_name,
                                                            dono='resumo-pastas', max_retries=0)
                        items = self._rp_collect_items(rel_folder, estado_dt, relacoes, partes_da_ficha)
                        if not items:
                            # Não deveria acontecer: `_rp_pastas_do_codigo` já
                            # garantiu que toda a documentação técnica existe. Se
                            # acontecer, é erro de verdade — não um skip mudo.
                            with lock:
                                errors.append({'file': rel_folder,
                                               'reason': 'nenhuma ficha lida, apesar de toda a Documentação Técnica existir'})
                            return 'error'

                        def chamar(prompt, blocos, schema, name):
                            # D2: o prompt no `system`, as fichas uma vez só no
                            # `user`, com o rótulo da casa.
                            mensagens = mensagens_da_rotina(prompt, blocos)
                            custo = (contar_tokens(prompt)
                                     + contar_tokens(mensagens[1]['content']) + teto_saida)

                            def reservar_e_chamar():
                                # A reserva é POR TENTATIVA: esperar para tentar
                                # de novo não segura espaço da janela.
                                with portao.reservar(custo):
                                    return chat_json(
                                        client, model, mensagens,
                                        schema=self._schema_da_rotina(schema),
                                        name=name, max_tokens=teto_saida,
                                        **ajustes_da_chamada(settings, 'rotinas', model),
                                    )

                            # D4: falha passageira tenta de novo, e a tela diz em
                            # que tentativa está. Aba fechada corta na hora.
                            response = com_retentativa(
                                reservar_e_chamar,
                                lambda n, total_t, espera: fase(
                                    'tentativa %d de %d' % (n, total_t), True, espera),
                                lambda: self.rotina_parada(project_name, 'resumo-pastas'))
                            # Confere o `finish_reason` antes do parse. Cortada,
                            # levanta — e o `except` lá embaixo põe a pasta na aba
                            # Erros SEM gravar por cima do `.md` bom e SEM marcar
                            # o hash, então a próxima passada tenta de novo.
                            return json_da_resposta(response, self._resgate_ligado())

                        base = os.path.join(out_dir, *rel_folder.split('/'))
                        os.makedirs(os.path.dirname(base), exist_ok=True)
                        texto = '\n\n'.join(ficha for _, ficha, _ in items)
                        out_path = base + '.md'
                        # Um `.md` por pasta: os `(parte N).md` de antes somem.
                        self._rp_cleanup_stale(base, {out_path})
                        outrel = os.path.relpath(out_path, out_dir).replace('\\', '/')
                        h = self._rp_hash_text(texto)
                        regerou = False
                        detalhe_partes = None
                        with lock:
                            ja_igual = hashes.get(outrel) == h
                        if ja_igual and os.path.isfile(out_path):
                            with lock:
                                counters['unchanged'] += 1
                        else:
                            # ── A RÉGUA DA PASTA ────────────────────────────
                            # O hash acima só sabe dizer "idêntico ou não". Mas
                            # uma pasta de cem arquivos em que UM ganhou duas
                            # linhas não é uma pasta diferente — e refazê-la
                            # inteira é a conta mais cara desta rotina.
                            #
                            # A média é PONDERADA PELO TAMANHO: dez arquivos
                            # iguais e um alterado dá 90%; se o alterado for o
                            # maior de dois, dá 9%. Pedaço que nasceu ou sumiu
                            # entra como zero, com o peso dele — acrescentar
                            # uma seção inteira tem que mexer na conta.
                            #
                            # Os vetores de AGORA são calculados antes (D41):
                            # erro aqui não para a pasta — é "não sei", e "não
                            # sei" é rodar.
                            vale = True
                            if os.path.isfile(out_path):
                                try:
                                    self._rp_vetores_de_agora(
                                        project_name, rel_folder, [n for n, _, _ in items])
                                    vale = self._det_vale_regerar_pasta(
                                        project_name, rel_folder + '/')
                                except Exception:
                                    vale = True
                            if not vale:
                                with lock:
                                    hashes[outrel] = h
                                    counters['unchanged'] += 1
                            else:
                                # ⚠️ A SAÍDA TAMBÉM DIVIDE (D30). A entrada de
                                # `frontend/modulos` (206 arquivos) cabia, mas a
                                # resposta — um item por arquivo, mais símbolos e
                                # conexões — passava do teto de saída e era
                                # cortada. A estimativa é medida ANTES.
                                estimada = len(items) * por_arquivo
                                if (estimada <= teto_saida
                                        and len(items) <= max_por_parte
                                        and contar_tokens(texto) <= budget
                                        and contar_tokens(prompt_template)
                                        + contar_tokens(texto) <= teto_entrada):
                                    # Cabe: uma chamada, sem partes nem costura.
                                    dados = chamar(prompt_template, [
                                        ('PASTA', rel_folder, rel_folder),
                                        ('PARTES DA FICHA',) + rotulo_das_partes,
                                        ('FICHAS DOS ARQUIVOS', str(len(items)), texto),
                                    ], self._RP_SCHEMA, 'resumo_de_pastas')
                                else:
                                    # ── Não cabe numa chamada ──────────────
                                    # D30: «Dividir e costurar a pasta»
                                    # desligado, a pasta não é resumida. D22,
                                    # D29: ligado, vale «O máximo aceito,
                                    # mesmo dividindo» — sobre a PASTA
                                    # inteira, do mais barato ao mais caro:
                                    # contar os arquivos não lê nada; a soma
                                    # dos tokens já veio com as fichas.
                                    # Passou: «Arquivos muito grandes», com o
                                    # motivo. O `.md` bom que já existia fica,
                                    # e o hash não anda.
                                    soma = sum(tok for _, _, tok in items)
                                    motivo = None
                                    if not dividir_pasta:
                                        motivo = ('não cabe numa chamada, e «Dividir e '
                                                  'costurar a pasta» está desligado')
                                    elif len(items) > max_arquivos_pasta:
                                        motivo = ('passa do máximo aceito: %d arquivos '
                                                  'direto na pasta, limite %d'
                                                  % (len(items), max_arquivos_pasta))
                                    elif soma > max_tokens_pasta:
                                        motivo = ('passa do máximo aceito: as fichas somam '
                                                  '%d tokens, limite %d' % (soma, max_tokens_pasta))
                                    if motivo:
                                        with lock:
                                            grandes.append({'file': rel_folder + '/',
                                                            'reason': motivo})
                                        self._hist_arquivo(project_name, 'resumo-pastas',
                                                           rel_folder + '/', 'grande demais',
                                                           detalhe=motivo)
                                        return 'grande'
                                    # Não cabe: lotes do tamanho do teto de
                                    # entrada, e a costura do papel da pasta.
                                    orcamento = teto_entrada - contar_tokens(prompt_template)
                                    lotes, grandes_demais = self._rp_pack_batches(
                                        items, orcamento,
                                        self._rp_arquivos_por_parte(len(items), por_arquivo,
                                                                    teto_saida, max_por_parte))
                                    detalhe_partes = (
                                        'em %d partes — resposta estimada de %d tokens, teto de saída %d'
                                        % (len(lotes), estimada, teto_saida)
                                        if estimada > teto_saida else
                                        'em %d partes — %d arquivos, até %d por parte'
                                        % (len(lotes), len(items), max_por_parte)
                                        if len(items) > max_por_parte else
                                        'em %d partes — a entrada passa do teto de entrada' % len(lotes))
                                    for fname, tok in grandes_demais:
                                        with lock:
                                            grandes.append({'file': f'{rel_folder}/{fname}',
                                                            'reason': f'ficha grande demais ({tok:,} tokens, orçamento {orcamento:,})'})
                                    partes = []
                                    for n, lote in enumerate(lotes, 1):
                                        fase('lote %d de %d' % (n, len(lotes)))
                                        parte = chamar(prompt_template, [
                                            ('PASTA', rel_folder, rel_folder),
                                            ('PARTES DA FICHA',) + rotulo_das_partes,
                                            ('FICHAS DOS ARQUIVOS', 'parte %d de %d' % (n, len(lotes)),
                                             '\n\n'.join(b for _, b in lote)),
                                        ], self._RP_SCHEMA, 'resumo_de_pastas')
                                        parte['_nomes'] = [nome for nome, _ in lote]
                                        partes.append(parte)
                                    if not partes:
                                        raise ValueError('nenhuma ficha desta pasta cabe numa chamada')

                                    def formatar(item, n, total):
                                        return '[PARTE %d de %d]\npapel: %s\narquivos: %s' % (
                                            n, total, item.get('papel_da_pasta', ''),
                                            ', '.join(item.get('_nomes') or []))

                                    def chamar_costura(textos):
                                        # A primeira linha de cada texto é o
                                        # rótulo `[PARTE n de N]`: volta a ser o
                                        # par (tipo, nome) do envelope.
                                        blocos = [('PASTA', rel_folder, rel_folder)]
                                        for t in textos:
                                            cabeca, corpo = t.split('\n', 1)
                                            tipo, nome = cabeca.strip('[]').split(' ', 1)
                                            blocos.append((tipo, nome, corpo))
                                        junto = chamar(prompt_costura, blocos,
                                                       _RP_SCHEMA_COSTURA,
                                                       'resumo_de_pastas_costura')
                                        nomes = []
                                        for t in textos:
                                            linha = t.rsplit('\narquivos: ', 1)[-1]
                                            nomes += [x for x in linha.split(', ') if x]
                                        return {'papel_da_pasta': junto.get('papel_da_pasta', ''),
                                                '_nomes': nomes}

                                    junto = costurar(
                                        [{'papel_da_pasta': p.get('papel_da_pasta', ''),
                                          '_nomes': p['_nomes']} for p in partes],
                                        chamar_costura, formatar,
                                        teto_entrada - contar_tokens(prompt_costura),
                                        lambda n, final: fase(texto_da_rodada(n, final)))
                                    dados = {'papel_da_pasta': junto.get('papel_da_pasta', '')}
                                    for chave in _RP_LISTAS:
                                        dados[chave] = self._rp_unir(p.get(chave) for p in partes)

                                if not (dados.get('papel_da_pasta') or '').strip():
                                    # Levanta antes de gravar: o `.md` bom fica e
                                    # a próxima passada tenta de novo.
                                    raise ValueError('o modelo não devolveu o papel da pasta')
                                result_text = self._rp_montar_md(dados)
                                with open(out_path, 'w', encoding='utf-8') as f:
                                    f.write(result_text)
                                with lock:
                                    hashes[outrel] = h
                                    counters['generated'] += 1
                                regerou = True

                        # ⚠️ A BASE DE COMPARAÇÃO DA PASTA ANDA AQUI, E SÓ AQUI.
                        #
                        # `vector_ref` é o vetor de cada pedaço da Documentação
                        # Técnica de QUANDO O RESUMO FOI GERADO. Movê-lo em
                        # qualquer outro momento — a cada reindexação, por
                        # exemplo — faria vinte mudanças de 1% nunca somarem
                        # 20%: cada uma seria medida contra a anterior, sempre
                        # daria "quase igual", e a pasta envelheceria em
                        # silêncio, uma fatia por vez.
                        #
                        # E o vetor de AGORA é calculado aqui, antes da régua:
                        # o Embedding roda depois do Resumo, e comparar com o
                        # que ele deixou era comparar com a volta anterior — era
                        # assim que a mudança pequena se perdia.
                        #
                        # Fora do `try` de cada chamada, mas dentro do da pasta:
                        # resumo que falhou não move base nenhuma, e a próxima
                        # passada tenta de novo.
                        if regerou:
                            try:
                                from ..embedding_store import (load_arquivos,
                                                               marcar_referencia)
                                marcar_referencia(
                                    project_name, 'documentacao-tecnica',
                                    load_arquivos(project_name, 'documentacao-tecnica',
                                                  rel_folder + '/'))
                            except Exception:
                                pass
                        # ── A linha da PASTA, para a sub-aba Histórico ────
                        #
                        # ⚠️ Esta rotina é a única cuja unidade é a PASTA, e não
                        # o arquivo. Emitir uma linha por arquivo aqui daria a
                        # impressão errada de que ela decide arquivo a arquivo —
                        # quem decide é a régua da pasta, a média ponderada logo
                        # acima. A linha diz o que de fato aconteceu com a pasta.
                        self._hist_arquivo(
                            project_name, 'resumo-pastas', rel_folder + '/',
                            'regerada' if regerou else 'reaproveitada',
                            detalhe=detalhe_partes if regerou
                                    else 'a régua da pasta disse que mudou pouco')
                        return 'ok'
                    except Exception as e:
                        # ⚠️ Mesma pergunta da Doc. Técnica: fechar a aba fecha o
                        # cliente do LM Studio, e a requisição em voo levanta
                        # aqui. Uma parada pedida não é um erro da pasta — e
                        # aqui ela também não pode entrar no Histórico, que é
                        # onde o usuário vai procurar o que deu errado.
                        if self.rotina_parada(project_name, 'resumo-pastas'):
                            return 'parado'
                        with lock:
                            errors.append({'file': rel_folder, 'reason': str(e)})
                        self._hist_arquivo(project_name, 'resumo-pastas',
                                           rel_folder + '/', 'erro',
                                           detalhe=str(e))
                        return 'error'

                with ThreadPoolExecutor(max_workers=parallel) as executor:
                    future_map = {executor.submit(process_folder, rel): rel for rel in rel_folders}
                    for future in as_completed(future_map):
                        rel = future_map[future]
                        # ⚠️ O RETORNO PASSOU A SER LIDO. Ele era descartado, e
                        # a conta subia para toda pasta — inclusive as que a
                        # parada do projeto fez voltar sem olhar. A barra
                        # chegaria a 100% sem nada ter sido gerado.
                        if future.result() == 'parado':
                            with lock:
                                in_progress.discard(rel)
                                fases.pop(rel, None)
                            continue
                        with lock:
                            processed_count[0] += 1
                            count = processed_count[0]
                            in_progress.discard(rel)
                            fases.pop(rel, None)
                            payload = {
                                "status": "running", "total": total, "processed": count,
                                "current": rel, "in_progress": sorted(in_progress),
                                "skipped": list(grandes), "errors": list(errors),
                                "bloqueadas": bloqueadas, "fases": dict(fases),
                            }
                        _emit(payload)

                self._rp_save_hashes(out_dir, hashes)

                # Formato garantido desligado no meio do caminho.
                indisponivel = formato_garantido_indisponivel()
                if indisponivel:
                    errors.append({
                        'file': '(todas as pastas)',
                        'reason': 'Formato garantido indisponível — %s. As respostas '
                                  'foram aceitas sem a garantia de formato.' % indisponivel,
                    })

                summary = {
                    'finished_at': datetime.now().isoformat(),
                    'folders': processed_count[0],
                    'generated': counters['generated'],
                    'unchanged': counters['unchanged'],
                    'skipped': grandes,
                    'errors': errors,
                    'bloqueadas': bloqueadas,
                }
                _finalize(summary)

                _emit({"status": "done", "total": total, "processed": processed_count[0],
                       "generated": counters['generated'], "unchanged": counters['unchanged'],
                       "skipped": grandes, "errors": errors, "bloqueadas": bloqueadas})

            except Exception as e:
                try:
                    _finalize({'finished_at': datetime.now().isoformat(), 'folders': 0, 'error': str(e)})
                except Exception:
                    pass
                _emit({"status": "error", "error": str(e)})

        # A referência da thread fica registrada: é o que deixa o ciclo
        # saber que esta rotina continua viva (ver processando.py).
        self._proc_iniciar(project_name, 'resumo-pastas', worker)
        return {'success': True}

