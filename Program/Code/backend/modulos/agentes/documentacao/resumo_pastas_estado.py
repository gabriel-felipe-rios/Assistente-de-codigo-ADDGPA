"""O estado incremental do Resumo de Pastas: hash por arquivo de saída.

⚠️ O HASH É DO ARQUIVO DE SAÍDA, e não da entrada. É o que faz a rotina pular a
pasta cujo resumo já está em dia sem reler as fichas dela — e é por isso que
apagar o arquivo de hashes é seguro: no pior caso, tudo é regerado.

⚠️ `_rp_pack_batches` MONTA LOTES POR ORÇAMENTO DE TOKEN, não por quantidade de
arquivos. Dez fichas curtas e duas longas não custam a mesma coisa, e um lote
por contagem estoura a janela justamente nas pastas grandes — que são as que
mais precisam do resumo.

⚠️ `_rp_cleanup_stale` APAGA RESUMO DE PASTA QUE NÃO EXISTE MAIS. Sem ele, a aba
Documentação continua listando pasta apagada, e o índice aponta para o vazio.
"""

# `hashlib` não vem de `constantes`, e `_rp_hash_text` é daqui — sem esta linha
# TODAS as pastas falham com `NameError`, uma a uma, e a rotina ainda assim se
# declara concluída (o `except` é por pasta, não do laço inteiro).
import hashlib

from ...constantes import *
from modulos.tokens import contar_tokens, calcular_orcamento, PortaoDeContexto


class ResumoPastasEstadoMixin:

    # ── Estado incremental (hash por arquivo de saída) ────────────────────────
    # ── Estado incremental (hash por arquivo de saída) ────────────────────────

    # O esquema de saída, irmão do prompt em `prompts/Rotinas/`.
    _RP_SCHEMA = 'resumo-de-pastas.json'

    @staticmethod
    def _rp_montar_md(dados):
        """O `.md` do resumo a partir do JSON que o modelo devolveu.

        As cinco seções são as mesmas de sempre — quem lê o resumo depois (o
        Pipeline e o Glossário) continua achando o que sempre achou. O que mudou
        é quem monta: agora o Python. Seção fora de ordem, título repetido e
        texto que começa no meio da frase deixam de ser possíveis.

        Seção sem conteúdo é OMITIDA, e não escrita vazia — é a mesma regra que
        o prompt sempre pediu ("se faltar informação, omita a seção inteira").
        """
        linhas = []

        papel = (dados.get('papel_da_pasta') or '').strip()
        if papel:
            linhas += ['## Papel da pasta', '', papel, '']

        arquivos = [a for a in (dados.get('arquivos') or []) if isinstance(a, dict)]
        if arquivos:
            linhas += ['## Arquivos e responsabilidades', '']
            for a in arquivos:
                nome = str(a.get('nome') or '').strip()
                resp = str(a.get('responsabilidade') or '').strip()
                if nome and resp:
                    linhas.append('`%s` — %s' % (nome, resp))
            linhas.append('')

        simbolos = [x for x in (dados.get('simbolos') or []) if isinstance(x, dict)]
        if simbolos:
            linhas += ['## Símbolos exportados principais', '']
            for x in simbolos:
                nome = str(x.get('nome') or '').strip()
                origem = str(x.get('origem') or '').strip()
                desc = str(x.get('descricao') or '').strip()
                if not nome:
                    continue
                onde = ' (%s)' % origem if origem else ''
                linhas.append('- `%s`%s%s' % (nome, onde, ' — ' + desc if desc else ''))
            linhas.append('')

        for titulo, chave in (('## Conexões internas', 'conexoes_internas'),
                              ('## Conexões externas', 'conexoes_externas')):
            itens = [str(i).strip() for i in (dados.get(chave) or []) if str(i).strip()]
            if itens:
                linhas += [titulo, '']
                linhas += ['- %s' % i for i in itens]
                linhas.append('')

        return chr(10).join(linhas).strip() + chr(10)

    def _rp_hashes_path(self, out_dir):
        return os.path.join(out_dir, '_hashes.json')

    def _rp_load_hashes(self, out_dir):
        try:
            with open(self._rp_hashes_path(out_dir), 'r', encoding='utf-8') as f:
                data = json.load(f)
            return data.get('arquivos', {}) if isinstance(data, dict) else {}
        except Exception:
            return {}

    def _rp_save_hashes(self, out_dir, arquivos):
        try:
            with open(self._rp_hashes_path(out_dir), 'w', encoding='utf-8') as f:
                json.dump({'gerado_em': datetime.now().isoformat(), 'arquivos': arquivos},
                          f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    @staticmethod
    def _rp_hash_text(text):
        return hashlib.md5(text.encode('utf-8', 'replace')).hexdigest()

    @staticmethod
    def _rp_resposta_por_arquivo(limites):
        """Os tokens de resposta que cada arquivo da pasta custa (D30, D36): a
        «Resposta estimada por arquivo da pasta» com a «Margem da estimativa»
        por cima, arredondado para cima. De fábrica, 60 × 1,2 = 72."""
        base = int(limites['resumo_pastas_tokens_por_arquivo'])
        margem = int(limites['resumo_pastas_margem_estimativa_pct'])
        return max(1, (base * (100 + margem) + 99) // 100)

    @staticmethod
    def _rp_arquivos_por_parte(arquivos, por_arquivo, teto_saida, maximo):
        """Quantas fichas vão numa parte para a RESPOSTA caber no teto de
        saída (D30) e não passar de `maximo` fichas. As partes saem do mesmo
        tamanho — 206 arquivos com 165 cabendo por parte viram 103 + 103, e
        não 165 + 41 —, para nenhuma encostar no teto."""
        cabem = max(1, min(teto_saida // max(1, por_arquivo), maximo))
        partes = -(-arquivos // cabem)
        return max(1, -(-arquivos // max(1, partes)))

    @staticmethod
    def _rp_pack_batches(items, budget_tokens, max_por_lote=None):
        """Empacota as fichas de uma pasta em lotes que cabem no orçamento.
        Enche cada lote até a próxima ficha estourar o orçamento de ENTRADA
        ou o lote chegar a `max_por_lote` fichas — o limite da SAÍDA (D30,
        ver `_rp_arquivos_por_parte`). Uma ficha maior que o orçamento
        inteiro sozinha não cabe em lote nenhum e vira 'oversized'.
        Devolve (batches, oversized), batches = lista de listas de (fname, bloco)."""
        batches = []
        oversized = []
        cur = []
        cur_tok = 0
        for fname, bloco, tok in items:
            if tok > budget_tokens:
                oversized.append((fname, tok))
                continue
            if cur and (cur_tok + tok > budget_tokens
                        or (max_por_lote and len(cur) >= max_por_lote)):
                batches.append(cur)
                cur = []
                cur_tok = 0
            cur.append((fname, bloco))
            cur_tok += tok
        if cur:
            batches.append(cur)
        return batches, oversized

    @staticmethod
    def _rp_cleanup_stale(base, expected):
        """Remove saídas antigas daquela pasta que não estão mais no conjunto
        esperado (ex.: a pasta encolheu de 3 partes para 2, ou deixou de ser
        dividida)."""
        d = os.path.dirname(base)
        name = os.path.basename(base)
        if not os.path.isdir(d):
            return
        padrao = re.compile(re.escape(name) + r'(?: \(parte \d+\))?\.md$')
        for f in os.listdir(d):
            full = os.path.join(d, f)
            if not os.path.isfile(full):
                continue
            if padrao.match(f) and full not in expected:
                try:
                    os.remove(full)
                except Exception:
                    pass
