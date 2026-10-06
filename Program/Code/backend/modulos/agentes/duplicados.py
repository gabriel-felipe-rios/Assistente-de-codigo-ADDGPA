"""A rotina Duplicados: acha função repetida — inclusive a copiada e editada.

Reaproveita duas peças que já existem:
  - o índice de símbolos (tree-sitter), para saber onde começa cada função;
  - o fatiador `_dt_montar_simbolos` (DocumentacaoTecnicaRenderMixin), que
    delimita o corpo de cada símbolo.

⚠️ **Aqui não há mais embedding.** Até 22/08/2026 o corpo de cada função era
vetorizado com o modelo ONNX (`_emb_embed_text`, uma inferência por função, em
lote de tamanho 1) e a busca era um produto matriz·matriz de cosseno. Levava
minutos e achava "parecido em sentido". Hoje o motor é determinístico e mora em
`duplicados_impressoes.py` — hash da sequência normalizada (clone Tipo-1 e
Tipo-2) mais impressões digitais por winnowing (Tipo-3, o copiado-e-editado).

⚠️ **A `busca_semantica` NÃO foi tocada.** Eram dois usos separados do mesmo
motor de embedding: aqui se embedava CORPO DE FUNÇÃO; a busca semântica embeda
os `.md` das rotinas de documentação, e continua exatamente como estava.

⚠️ **A tabela `code_symbols` continua existindo.** O agente Sincronia chama
`rename_code_file` e `delete_code_file` nela — apagá-la quebraria um agente que
hoje funciona. O que mudou foi só o que vai dentro: colunas `hash_norm` e
`impressoes` no lugar do vetor.
"""

import os
import json
from datetime import datetime

from ..caminhos import obter_pasta_da_rotina
from ..constantes import MUDADOS_AUTO
from .resumo_de_rotina import gravar_resumo_de_falha
# As duas metades do banco: o esquema e os documentos em `embedding_store`, a
# tabela `code_symbols` — que é a desta rotina — na irmã. ⚠️ `code_symbols` NÃO
# mudou no índice fatiado da Etapa 3, de propósito.
from . import embedding_store_codigo as _store
from . import duplicados_impressoes as _imp

# Ignora funções triviais (getters de 1 linha etc.) que gerariam ruído.
_MIN_CHARS_CORPO = 120
# Teto de segurança. Continua existindo, mas por outro motivo: a comparação
# deixou de ser n×n (era ela que crescia ao quadrado e justificava o número) e
# passou a ser por índice invertido. O que ele protege agora é a MEMÓRIA de
# carregar todas as impressões de uma vez.
_MAX_SIMBOLOS = 6000


class DuplicadosMixin:

    # ── Caminhos e aviso para a tela ──────────────────────────────────────────

    def _dup_dir(self, project_name):
        return obter_pasta_da_rotina(project_name, 'duplicados')

    def _dup_resumo_path(self, project_name):
        # O `_` inicial esconde o arquivo da árvore da aba Documentação —
        # `_is_agent_content_file` filtra por ele.
        return os.path.join(self._dup_dir(project_name), '_resumo.json')

    def _dup_notify(self, project_name, payload):
        # ⚠️ Callback PRÓPRIO, como o de cada rotina. Reusar o de outra faria o
        # fim desta recarregar a sub-aba da outra.
        # `project` no payload é o que o front usa para ignorar o evento
        # quando este projeto não é o exibido no momento (várias abas abertas).
        payload = {**payload, 'project': project_name}
        try:
            self.window.evaluate_js('duplicadosAgentProgress(%s)' % json.dumps(payload))
        except Exception:
            pass

    # ── A varredura ───────────────────────────────────────────────────────────

    def build_duplicados(self, project_name, mudados=None):
        """Calcula a impressão do corpo de cada símbolo e grava (incremental por hash).

        `mudados` (caminhos absolutos que o ciclo já calculou): o arquivo fora
        da lista nem é ABERTO — os símbolos dele continuam como estão no banco.
        Sem a lista, ou sem `_resumo.json` anterior, relê todos (o pulo por
        `corpo_hash` continua valendo lá dentro).

        ⚠️ O incremental por `corpo_hash` foi preservado, e é o que faz a
        segunda rodada custar quase nada: símbolo cujo corpo não mudou nem é
        reprocessado. O que ele pula agora é barato (tokenizar e hashear) em vez
        de caríssimo (uma inferência ONNX), mas pular continua valendo — num
        projeto grande são milhares de símbolos.
        """
        idx = self.get_symbol_index(project_name)
        if not idx.get('success') or not idx.get('index'):
            # O Índice de Símbolos é rotina do T1 e roda antes; construir aqui é
            # só a rede para quando ele está desligado ou nunca rodou.
            self.build_symbol_index(project_name)
            idx = self.get_symbol_index(project_name)
        symbols = (idx.get('index') or {}).get('symbols', [])

        syms_by_file = {}
        file_id_de = {}
        for sym in symbols:
            fpath = sym.get('file')
            if not fpath:
                continue
            syms_by_file.setdefault(fpath, []).append(sym)
            if fpath not in file_id_de:
                folder = sym.get('folder', '')
                rel = sym.get('relative') or os.path.basename(fpath)
                file_id_de[fpath] = ('%s/%s' % (folder, rel)) if folder else rel

        processed = skipped = ignorados = 0
        vistos = []
        total_arquivos = len(syms_by_file)
        # Os hashes já gravados, de UMA vez. Perguntar de um em um abria uma
        # conexão SQLite por símbolo — dez segundos numa rodada em que nada
        # mudou, que é justamente a rodada que o incremental existe para
        # tornar barata.
        hashes_gravados = _store.load_code_hashes(project_name)
        if mudados is not None and not os.path.exists(self._dup_resumo_path(project_name)):
            mudados = None
        mudados_norm = {os.path.normcase(os.path.normpath(m)) for m in (mudados or ())}
        chaves_por_arquivo = {}
        for k in hashes_gravados:
            chaves_por_arquivo.setdefault(k[0], []).append(k)

        for numero, (fpath, file_syms) in enumerate(syms_by_file.items(), start=1):
            file_id = file_id_de[fpath]
            if (mudados is not None
                    and os.path.normcase(os.path.normpath(fpath)) not in mudados_norm):
                # Não mudou: nem abre o arquivo. Os símbolos gravados continuam
                # "vistos", senão a poda do fim os apagaria.
                gravados = chaves_por_arquivo.get(file_id, [])
                vistos.extend(gravados)
                skipped += len(gravados)
                continue
            try:
                with open(fpath, 'r', encoding='utf-8', errors='replace') as f:
                    lines = f.read().splitlines()
            except Exception:
                continue

            simbolos = self._dt_montar_simbolos(file_syms, lines)
            ordenados = sorted(file_syms, key=lambda s: s['line'])

            # UMA parse por arquivo, e não uma por função: era a inversão
            # disso — uma inferência por função — que fazia a rotina antiga
            # levar minutos.
            tokens = None

            for i, s in enumerate(simbolos):
                inicio = s['linha']
                fim = ordenados[i + 1]['line'] - 1 if i + 1 < len(ordenados) else len(lines)
                fim = max(inicio, fim)
                corpo = '\n'.join(l.rstrip() for l in lines[inicio - 1:fim])
                if len(corpo.strip()) < _MIN_CHARS_CORPO:
                    continue

                chave = s['chave']
                vistos.append((file_id, chave))

                if hashes_gravados.get((file_id, chave)) == s['corpo_hash']:
                    skipped += 1
                    continue

                if tokens is None:
                    tokens = _imp.tokens_do_arquivo(
                        fpath, lines, os.path.splitext(fpath)[1])

                hash_norm, impressoes = _imp.impressao_do_corpo(tokens, inicio, fim)
                if not hash_norm:
                    # Corpo incomparável — curto demais, ou a gramática não leu
                    # o arquivo. Não é erro: é símbolo sobre o qual não dá para
                    # afirmar nada. Gravá-lo assim mesmo o faria casar com todos
                    # os outros incomparáveis, a 100%.
                    ignorados += 1
                    continue
                _store.upsert_code(project_name, file_id, chave, s['nome'], s['tipo'],
                                   s['linha'], s['corpo_hash'], corpo.strip()[:200],
                                   hash_norm, _imp.empacotar(impressoes))
                processed += 1

            if numero % 25 == 0 or numero == total_arquivos:
                self._dup_notify(project_name, {'status': 'running', 'arquivo': numero,
                                  'total': total_arquivos})

        # Poda símbolos que não existem mais.
        _store.delete_missing_code(project_name, vistos)

        resumo = {
            # Acionamentos leem o `finished_at` para saber que a rodada
            # terminou — sem este arquivo, `_ac_wait_done` espera até estourar
            # o tempo limite e a rotina "nunca acaba".
            'finished_at': datetime.now().isoformat(),
            'simbolos': len(vistos),
            'processados': processed,
            'pulados': skipped,
            'ignorados': ignorados,
        }
        os.makedirs(self._dup_dir(project_name), exist_ok=True)
        with open(self._dup_resumo_path(project_name), 'w', encoding='utf-8') as f:
            json.dump(resumo, f, ensure_ascii=False, indent=2)
        return resumo

    # ── API para a tela ───────────────────────────────────────────────────────

    def run_duplicados_agent(self, project_name, mudados_pre=MUDADOS_AUTO):
        """Dispara a rotina numa thread e devolve na hora.

        ⚠️ Era SÍNCRONA e não gravava nada em pasta de saída — o que servia
        enquanto ela só existia atrás de um botão da aba Análise. Como rotina do
        ciclo não serviria: `_ac_run_single` sobe o lock, chama isto e espera
        o `_resumo.json` aparecer.
        """
        def worker():
            try:
                self._dup_notify(project_name, {'status': 'running'})
                resumo = self.build_duplicados(
                    project_name, None if mudados_pre == MUDADOS_AUTO else mudados_pre)
                self._dup_notify(project_name, {'status': 'done',
                                  'simbolos': resumo['simbolos'],
                                  'processados': resumo['processados'],
                                  'ignorados': resumo['ignorados']})
            except Exception as e:
                # Sem `_resumo.json`, o ciclo vê a thread morrer e derruba as
                # rotinas seguintes — o mesmo motivo escrito em `bibliotecas.py`.
                gravar_resumo_de_falha(project_name, 'duplicados', str(e), simbolos=0,
                                       processados=0, pulados=0, ignorados=0)
                self._dup_notify(project_name, {'status': 'error', 'error': str(e)})

        # A referência da thread fica registrada: é o que deixa o ciclo saber
        # que esta rotina continua viva (ver processando.py).
        self._proc_iniciar(project_name, 'duplicados', worker)
        return {'success': True}

    def get_duplicados_status(self, project_name):
        """O que o card da sub-aba Rotinas mostra sem ter rodado nada."""
        try:
            with open(self._dup_resumo_path(project_name), 'r', encoding='utf-8') as f:
                resumo = json.load(f)
        except Exception:
            return {'success': True, 'existe': False, 'gerado_em': None,
                    'simbolos': 0, 'processados': 0, 'ignorados': 0}
        return {
            'success': True,
            'existe': True,
            'gerado_em': resumo.get('finished_at'),
            'simbolos': resumo.get('simbolos', 0),
            'processados': resumo.get('processados', 0),
            'ignorados': resumo.get('ignorados', 0),
        }

    def get_duplicados(self, project_name, threshold=0.85, max_pares=200):
        """Os pares de funções acima do limiar. Só LÊ — quem atualiza é o ciclo.

        ⚠️ Não reindexa. A aba Análise chamava `run_duplicados_agent` antes de
        chamar esta, e por isso abrir a tela custava a rodada inteira. Agora a
        tela lê o que a rotina deixou pronto, como todas as outras.
        """
        try:
            simbolos = _store.load_code_impressoes(project_name)
            n = len(simbolos)
            if n < 2:
                return {'success': True, 'pares': [], 'total_simbolos': n,
                        'threshold': threshold}
            if n > _MAX_SIMBOLOS:
                return {'success': False,
                        'error': f'Muitos símbolos ({n}) para comparar de uma vez. '
                                 f'Limite atual: {_MAX_SIMBOLOS}.'}
            pares = _imp.comparar(simbolos, limiar=float(threshold),
                                  max_pares=int(max_pares))
            return {'success': True, 'pares': pares, 'total_simbolos': n,
                    'threshold': threshold}
        except Exception as e:
            return {'success': False, 'error': str(e)}
