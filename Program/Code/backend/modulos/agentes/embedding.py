import os
import json
import hashlib
import numpy as np

from datetime import datetime

from ..caminhos import obter_pasta_da_rotina

_EMB_CACHE = {}  # {'tokenizer': ..., 'session': ...}

_MODEL_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'External', 'ai-models', 'embeddings', 'nomic-embed-text-v1')
)

# Dois índices de embedding, cada um sobre uma fonte:
#  - documentacao-tecnica: você buscar por ARQUIVO na aba Documentação
#  - resumo-pastas:        você buscar por PASTA na aba Documentação
# `secao` é o cabeçalho de onde tirar o trecho representativo de cada fonte.
#
# A chave é o id da rotina de origem — quem traduz isso para nome de pasta é
# `caminhos.obter_pasta_da_rotina`. Havia aqui um campo `src` com o nome da
# pasta, mas ele era cópia literal da chave: um segundo lugar para manter em
# dia, sem nenhuma informação a mais.
_EMB_TIPOS = {
    'documentacao-tecnica': {'secao': '## Síntese'},
    'resumo-pastas':        {'secao': '## Papel da pasta'},
}
_EMB_ORDER = ['documentacao-tecnica', 'resumo-pastas']


class EmbeddingMixin:

    def preview_embedding_agent(self, project_name, tipo='documentacao-tecnica'):
        try:
            from . import embedding_store as _store
            from . import embedding_store_migracao as _migracao
            cfg = _EMB_TIPOS.get(tipo)
            if not cfg:
                return {'success': False, 'error': f'Tipo de embedding inválido: {tipo}'}
            _migracao.migrate_json_tree(project_name)
            src_dir = obter_pasta_da_rotina(project_name, tipo)
            if not os.path.isdir(src_dir):
                return {'success': True, 'tipo': tipo, 'total': 0, 'to_process': 0}
            total = 0
            to_process = 0
            for root, dirs, files in os.walk(src_dir):
                dirs[:] = [d for d in dirs if not (d.startswith('_') and root == src_dir)]
                for fname in files:
                    if not fname.endswith('.md'):
                        continue
                    total += 1
                    md_path = os.path.join(root, fname)
                    rel     = os.path.relpath(md_path, src_dir).replace('\\', '/')
                    if _store.get_hash(project_name, tipo, rel) != self._emb_hash_file(md_path):
                        to_process += 1
            return {'success': True, 'tipo': tipo, 'total': total, 'to_process': to_process}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── O progresso ─────────────────────────────────────────────────────
    #
    # ⚠️ Esta rotina era a ÚNICA sem sinal de progresso nenhum: nem um
    # `evaluate_js` no arquivo inteiro. Ela é síncrona, roda os dois índices em
    # série e só falava no fim — o card ficava minutos com "Gerando
    # embeddings...", e os números do preview só mudavam se a pessoa saísse e
    # voltasse. Com o índice fatiado da Etapa 3 a passada ficou bem mais longa,
    # e uma tela parada por minutos é indistinguível de uma tela travada.
    #
    # Continua SÍNCRONA de propósito: `_proc_thread_viva` trata o Embedding como
    # o caso que não registra thread, e o ciclo conta com isso. O que mudou foi
    # só ela deixar de ser muda.
    def _emb_push_progress(self, project_name, payload):
        """Avisa a tela E o `get_processando`, como a Doc. Técnica faz.

        O `_proc_apply` é o que faz a caixa do Embedding na sub-aba Visualizar
        mostrar "N de M" em vez de só "Processando", e o que alimenta a aba
        Pendências — as três telas passam a ler o MESMO par de números.
        """
        try:
            self._proc_apply(project_name, 'embedding', payload)
        except Exception:
            pass
        # `project` no payload: o front ignora o evento quando este projeto
        # não é o exibido no momento (várias abas de projeto abertas).
        payload = {**payload, 'project': project_name}
        try:
            self.window.evaluate_js('embeddingAgentProgress(%s)' % json.dumps(payload))
        except Exception:
            pass

    def _emb_contar(self, project_name):
        """`(total, a_processar)` somando os DOIS índices.

        ⚠️ Soma os dois porque `run_embedding_agent` os roda em série numa
        passada só. Contando um de cada vez, a barra encheria e reiniciaria duas
        vezes — o mesmo defeito de barra que o Espelho (retirado em 2026-09)
        já teve, por outro caminho.

        É a mesma varredura de `preview_embedding_agent`, e é barata: só
        `os.walk` + uma consulta de hash por arquivo, sem ler conteúdo nem
        chamar o modelo.
        """
        from . import embedding_store as _store
        total = a_processar = 0
        for t in _EMB_ORDER:
            src_dir = obter_pasta_da_rotina(project_name, t)
            if not os.path.isdir(src_dir):
                continue
            for root, dirs, files in os.walk(src_dir):
                dirs[:] = [d for d in dirs if not (d.startswith('_') and root == src_dir)]
                for fname in files:
                    if not fname.endswith('.md'):
                        continue
                    total += 1
                    md_path = os.path.join(root, fname)
                    rel = os.path.relpath(md_path, src_dir).replace('\\', '/')
                    if _store.get_hash(project_name, t, rel) != self._emb_hash_file(md_path):
                        a_processar += 1
        return total, a_processar

    def run_embedding_agent(self, project_name, tipo=None):
        # Sem tipo (chamada do ciclo de Acionamentos) → gera os dois índices.
        if tipo is None:
            agg = {'success': True, 'per_tipo': {}, 'processed': 0, 'skipped': 0, 'errors': 0}
            # O denominador sai antes do laço — sem ele a barra fica parada em
            # 0% (`_pintarProgressoDuplo` devolve `null` com `a_processar` nulo).
            total, a_processar = self._emb_contar(project_name)
            andamento = {'total': total, 'a_processar': a_processar,
                         'processed': 0, 'reaproveitados': 0,
                         'reaproveitaveis': max(0, total - a_processar)}
            self._emb_push_progress(project_name, dict(
                andamento, status='running', current='',
                etapa='Vendo o que mudou...'))
            for t in _EMB_ORDER:
                r = self._emb_run_one(project_name, t, andamento)
                agg['per_tipo'][t] = r
            # Sem `_resumo.json` o Embedding era o único que a sub-aba
            # Visualizar não tinha como enxergar: o card dizia "Concluído" (ele
            # tem status próprio) e o desenho dizia "Parado", sobre a mesma
            # passada. `get_agent_last_runs` lê o `finished_at` daqui.
                if r.get('success'):
                    agg['processed'] += r.get('processed', 0)
                    agg['skipped']   += r.get('skipped', 0)
                    agg['errors']    += r.get('errors', 0)
                    if r.get('error_detail'):
                        agg['error_detail'] = r['error_detail']
                else:
                    agg['errors'] += 1
                    agg['error_detail'] = r.get('error')
            self._emb_gravar_resumo(project_name, agg)
            self._emb_push_progress(project_name, dict(
                andamento, status='done', current='', etapa='Concluído'))
            return agg
        return self._emb_run_one(project_name, tipo)

    def _emb_run_one(self, project_name, tipo, andamento=None):
        try:
            from . import embedding_store as _store
            from . import embedding_store_migracao as _migracao
            cfg = _EMB_TIPOS.get(tipo)
            if not cfg:
                return {'success': False, 'error': f'Tipo de embedding inválido: {tipo}'}
            _migracao.migrate_json_tree(project_name)
            src_dir = obter_pasta_da_rotina(project_name, tipo)
            secao   = cfg['secao']
            if not os.path.isdir(src_dir):
                # Fonte sumiu: limpa os embeddings órfãos deste tipo.
                _store.delete_missing(project_name, tipo, [])
                return {'success': True, 'tipo': tipo, 'processed': 0, 'skipped': 0, 'errors': 0}

            processed = skipped = errors = 0
            last_error = None
            vistos = []

            for root, dirs, files in os.walk(src_dir):
                dirs[:] = [d for d in dirs if not (d.startswith('_') and root == src_dir)]
                for fname in files:
                    if not fname.endswith('.md'):
                        continue
                    md_path = os.path.join(root, fname)
                    rel     = os.path.relpath(md_path, src_dir).replace('\\', '/')
                    md_hash = self._emb_hash_file(md_path)
                    vistos.append(rel)

                    if _store.get_hash(project_name, tipo, rel) == md_hash:
                        skipped += 1
                        if andamento is not None:
                            andamento['reaproveitados'] += 1
                            self._emb_push_progress(project_name, dict(
                                andamento, status='running', current=rel,
                                etapa='Reaproveitando o que não mudou...'))
                        continue

                    if andamento is not None:
                        # ⚠️ Conta ARQUIVOS, e não pedaços. É o mesmo par
                        # `processed`/`a_processar` que as outras três rotinas
                        # usam, e misturar as duas unidades é o defeito já
                        # documentado em `processando.py` — o pedaço aparece na
                        # linha do "arquivo atual", que é onde ele informa sem
                        # estragar a conta.
                        self._emb_push_progress(project_name, dict(
                            andamento, status='running', current=rel,
                            etapa='Fatiando e gerando vetores...'))

                    try:
                        with open(md_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                        p, e = self._emb_indexar_pedacos(
                            project_name, tipo, rel, content, md_path, md_hash)
                        processed += p
                        errors += e
                    except Exception as ex:
                        errors += 1
                        last_error = last_error or str(ex)
                    if andamento is not None:
                        andamento['processed'] += 1
                        self._emb_push_progress(project_name, dict(
                            andamento, status='running', current=rel))

            # Poda embeddings de .md que não existem mais.
            _store.delete_missing(project_name, tipo, vistos)

            result = {'success': True, 'tipo': tipo, 'processed': processed, 'skipped': skipped, 'errors': errors}
            if last_error:
                result['error_detail'] = last_error
            return result
        except Exception as e:
            return {'success': False, 'tipo': tipo, 'error': str(e)}

    def _emb_indexar_pedacos(self, project_name, tipo, rel, content, caminho,
                             md_hash):
        """Um documento vira N linhas no índice — uma por fronteira natural.

        Devolve `(embedados, erros)`. Três economias, nesta ordem:

        1. **Pedaço com o mesmo hash não é reembedado.** Inserir uma função no
           meio de um arquivo passa a custar um embedding, não o arquivo inteiro.
        2. **Bloco gêmeo:** pedaço já embedado em qualquer lugar do projeto
           reaproveita o vetor. A chave do cache é o hash do CONTEÚDO, não
           `(arquivo, pedaço)`.
        3. O que sobrou de uma seção apagada sai do índice — senão ela
           continuaria aparecendo na busca, apontando para um texto que não
           existe mais.
        """
        from . import embedding_store as _store
        pedacos = self._ped_fatiar(content, caminho)
        if not pedacos:
            return 0, 0

        gravados = self._emb_pedacos_gravados(project_name, tipo, rel)
        embedados = erros = 0
        nomes = []
        for nome, corpo, linhas in pedacos:
            nomes.append(nome)
            h = self._emb_hash_texto(corpo)
            antigo = gravados.get(nome)
            if antigo and antigo.get('hash_pedaco') == h:
                continue
            vetor = _store.vetor_por_conteudo(project_name, h)
            if vetor is None:
                vetor, err = self._emb_embed_text(corpo)
                if vetor is None:
                    erros += 1
                    continue
                embedados += 1
            # ⚠️ `mover_referencia` só para o pedaço que NASCE agora. Sem
            # referência anterior não há diferença a acumular, e deixá-lo em
            # branco faria a régua lê-lo como "sem par" — similaridade zero —
            # em toda passada, para sempre.
            _store.upsert(project_name, tipo, rel, nome, md_hash,
                          corpo.strip()[:200], vetor, linhas=linhas,
                          mover_referencia=(antigo is None), hash_pedaco=h)
        # Os que não mudaram precisam do carimbo novo do arquivo, senão o portão
        # por arquivo diria "mudou" de novo na passada seguinte, sem fim.
        _store.atualizar_md_hash(project_name, tipo, rel, md_hash)
        _store.delete_pedacos_sobrando(project_name, tipo, rel, nomes)
        return embedados, erros

    @staticmethod
    def _emb_pedacos_gravados(project_name, tipo, rel):
        from . import embedding_store as _store
        return _store.load_pedacos(project_name, tipo, rel)

    @staticmethod
    def _emb_hash_texto(texto):
        return hashlib.md5((texto or '').encode('utf-8', 'replace')).hexdigest()

    # ── Helpers compartilhados (usados também por DocumentacaoMixin) ──────────

    def _emb_load(self):
        if 'session' in _EMB_CACHE:
            return _EMB_CACHE['tokenizer'], _EMB_CACHE['session']
        from tokenizers import Tokenizer
        import onnxruntime as ort

        tok = Tokenizer.from_file(os.path.join(_MODEL_DIR, 'tokenizer.json'))
        # Quanto de cada trecho o modelo de embedding chega a ver. Nunca teve
        # tela: agora vem da categoria "Ferramentas dos subagentes".
        tok.enable_truncation(max_length=self._sub_limite('embedding_truncar_tokens'))

        onnx_path = os.path.join(_MODEL_DIR, 'onnx', 'model_quantized.onnx')
        sess = ort.InferenceSession(onnx_path, providers=['CPUExecutionProvider'])

        _EMB_CACHE['tokenizer'] = tok
        _EMB_CACHE['session']   = sess
        return tok, sess

    def _emb_embed_text(self, text):
        try:
            tok, sess = self._emb_load()

            enc          = tok.encode(text)
            input_ids    = np.array([enc.ids],             dtype=np.int64)
            attn_mask    = np.array([enc.attention_mask],  dtype=np.int64)

            input_names = {inp.name for inp in sess.get_inputs()}
            feeds = {'input_ids': input_ids, 'attention_mask': attn_mask}
            if 'token_type_ids' in input_names:
                feeds['token_type_ids'] = np.zeros_like(input_ids)

            outputs = sess.run(None, feeds)
            emb = outputs[0].astype(np.float32)

            if emb.ndim == 3:
                # mean pooling sobre tokens não-padding
                mask = attn_mask[:, :, np.newaxis].astype(np.float32)
                emb  = (emb * mask).sum(axis=1) / (mask.sum(axis=1) + 1e-9)

            emb = emb[0]
            norm = np.linalg.norm(emb)
            if norm > 0:
                emb = emb / norm

            return emb.tolist(), None
        except Exception as e:
            _EMB_CACHE.clear()
            return None, str(e)

    def _emb_hash_file(self, path):
        try:
            with open(path, 'rb') as f:
                return hashlib.md5(f.read()).hexdigest()
        except Exception:
            return ''

    def _emb_extract_excerpt(self, content, secao='## Explicação'):
        """Trecho representativo da fonte: o conteúdo da seção `secao` até o
        próximo `## `. Cada fonte tem a sua (Doc Técnica → '## Síntese',
        Resumo de Pastas → '## Papel da pasta')."""
        lines  = content.split('\n')
        in_sec = False
        result = []
        for line in lines:
            if line.strip().startswith(secao):
                in_sec = True
                continue
            if in_sec:
                if line.strip().startswith('## ') and result:
                    break
                result.append(line)
        text = '\n'.join(result).strip()
        return text[:500] if text else None

    def _emb_gravar_resumo(self, project_name, agg):
        """O `_resumo.json` do Embedding — o carimbo que a sub-aba Visualizar lê.

        Ele é a única rotina que não gerava um: o estado dela vinha só do
        `index.db`, que o card sabe ler e o desenho não. Duas telas, duas
        respostas diferentes sobre a mesma passada.
        """
        try:
            pasta = obter_pasta_da_rotina(project_name, 'embedding')
            os.makedirs(pasta, exist_ok=True)
            with open(os.path.join(pasta, '_resumo.json'), 'w', encoding='utf-8') as f:
                json.dump({
                    'finished_at': datetime.now().isoformat(),
                    'total': (agg.get('processed', 0) or 0) + (agg.get('skipped', 0) or 0),
                    'processed': agg.get('processed', 0) or 0,
                    'skipped_count': agg.get('skipped', 0) or 0,
                    'errors': [],
                    'per_tipo': agg.get('per_tipo', {}),
                }, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
