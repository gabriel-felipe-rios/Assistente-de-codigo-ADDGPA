"""As duas **réguas** de similaridade — "o quanto" mudou.

Código decide pela TABELA (o *quê* mudou) — isso é `detector_classes.py`. O que
**não é código** — prompt, `.md`, `.txt` — não tem tabela: mexer numa palavra e
reescrever o parágrafo inteiro são a mesma "alteração de texto". Aqui a pergunta
vira *o quanto* mudou, medida por **similaridade de sentido**.

⛔ **Porcentagem de texto não serve, e é proibida.** Ela mede bytes, não sentido:
dez palavras trocadas podem ser menos de 0,5% de um arquivo e derrubar a
documentação inteira.

## As duas réguas, e por que são duas contas diferentes

**Dentro de um ARQUIVO — a MENOR.** A similaridade de um arquivo é a **menor**
entre os pedaços dele. A pergunta que ela responde é *"tem alguma parte deste
arquivo que ficou realmente diferente?"*.
⛔ **A média está proibida aqui**, e pelo mesmo motivo da porcentagem: ela dilui
a mudança pequena e crítica no meio de dez pedaços intocados.

**Dentro de uma PASTA — a MÉDIA PONDERADA pelo tamanho.**

```
similaridade da pasta = Σ (linhas × similaridade) ÷ Σ (linhas)

  arquivo que não mudou            → 1,00
  pedaço SEM PAR (nasceu ou sumiu) → 0, com o peso do tamanho dele
```

Confere com os casos que fecharam a discussão:

| Caso | Conta | Dá |
|---|---|---|
| 10 arquivos iguais, 1 mudou | 9 ÷ 10 | 90% |
| 10 iguais, 2 mudaram | 8 ÷ 10 | 80% |
| um de 10 linhas + um de 1, muda o **pequeno** | 10 ÷ 11 | 91% |
| um de 10 linhas + um de 1, muda o **grande** | 1 ÷ 11 | 9% |

## ⚠️ As duas bases de comparação se movem em momentos diferentes

| Pergunta | Base | Quando anda |
|---|---|---|
| "esta documentação técnica foi regerada?" | `md_hash` | toda vez que a **Documentação Técnica** regenera |
| "quanto mudou desde o último resumo da pasta?" | `vector_ref` | **só** quando o **Resumo de Pastas** regenera |

Se as duas andassem juntas, **vinte mudanças de 1% nunca somariam 20%**: cada
uma seria medida contra a anterior, sempre daria "quase igual", e a pasta
envelheceria em silêncio, uma fatia por vez. Quem move a segunda é
`embedding_store.marcar_referencia`, e só quem regerou a chama.

⚠️ **O Resumo de Pastas compara a DOCUMENTAÇÃO TÉCNICA da pasta, não as fontes:
é ela a entrada dele.** Ele nunca lê código. Por isso "pasta misturada" não é
uma pergunta que exista aqui, e o caso da docstring se resolve sozinho: a
documentação é regerada, mas fica ~99% igual à velha, e a pasta nem se mexe.
"""

from ...constantes import *

import numpy as np

# Sem par não é "parecido zero", é "não dá para comparar" — e as duas réguas
# tratam isso como diferença máxima, de propósito: uma seção que nasceu ou sumiu
# é exatamente o tipo de mudança que a documentação precisa refletir.
_DET_SEM_PAR = 0.0


class DetectorReguasMixin:
    """As duas contas, e os dois limiares que Configurações expõe."""

    # ── Os limiares ─────────────────────────────────────────────────────────

    def _det_limiar(self, qual):
        """`doc-tecnica` ou `resumo-pastas`, em fração (0,95), não em porcentagem.

        A tela pede o número em % porque é assim que se pensa nele; a conta usa
        fração. A conversão mora aqui, e só aqui.
        """
        chave = ('doc_tecnica_similaridade_pct' if qual == 'doc-tecnica'
                 else 'resumo_pastas_similaridade_pct')
        try:
            return max(1, min(100, int(self.load_limites()['limites'][chave]))) / 100.0
        except Exception:
            return 0.95

    # ── A conta base ────────────────────────────────────────────────────────

    @staticmethod
    def _det_cosseno(a, b):
        """Produto escalar simples — os vetores já saem normalizados.

        `_emb_embed_text` termina com `emb = emb / norm`, então não é preciso
        biblioteca nenhuma nem renormalizar aqui. Só o cinto: um vetor de norma
        zero (texto vazio que escapou) daria NaN.
        """
        if a is None or b is None:
            return _DET_SEM_PAR
        try:
            va, vb = np.asarray(a, dtype=np.float32), np.asarray(b, dtype=np.float32)
            if va.shape != vb.shape or not va.size:
                return _DET_SEM_PAR
            na, nb = np.linalg.norm(va), np.linalg.norm(vb)
            if na < 1e-9 or nb < 1e-9:
                return _DET_SEM_PAR
            return float(np.clip(np.dot(va / na, vb / nb), -1.0, 1.0))
        except Exception:
            return _DET_SEM_PAR

    # ── Régua 1 · dentro de um arquivo — a MENOR ────────────────────────────

    def _det_similaridade_do_arquivo(self, project_name, tipo, source_file):
        """A **menor** similaridade entre os pedaços deste arquivo.

        Devolve `None` quando não há com o que comparar — arquivo que nunca foi
        indexado, ou pedaço nenhum com `vector_ref`. ⚠️ `None` NÃO é zero: quem
        chama tem que tratá-lo como "não sei" e deixar a rotina rodar. Confundir
        os dois faria um arquivo novo nunca ser documentado, em silêncio.
        """
        from .. import embedding_store as _store
        pedacos = _store.load_pedacos(project_name, tipo, source_file)
        if not pedacos:
            return None
        comparaveis = [p for p in pedacos.values() if p.get('vector_ref') is not None]
        if not comparaveis:
            return None
        # Pedaço que nasceu depois da última geração entra como SEM PAR, e por
        # ser a menor ele decide sozinho — que é o comportamento certo: seção
        # nova é justamente o que a documentação ainda não conta.
        menor = 1.0
        for p in pedacos.values():
            s = (_DET_SEM_PAR if p.get('vector_ref') is None
                 else self._det_cosseno(p.get('vector'), p.get('vector_ref')))
            menor = min(menor, s)
        return menor

    # ── Régua 2 · dentro de uma pasta — a MÉDIA PONDERADA ───────────────────

    def _det_similaridade_da_pasta(self, project_name, prefixo, tipo='documentacao-tecnica'):
        """`Σ(linhas × similaridade) ÷ Σ(linhas)` sobre os pedaços da pasta.

        `prefixo` é o caminho da pasta dentro da saída da Documentação Técnica — a pasta é um
        prefixo de caminho, e é assim que ela é consultada no índice.

        Devolve `None` quando a pasta não tem nada comparável. Como na régua do
        arquivo, `None` é "não sei", não "mudou tudo".
        """
        from .. import embedding_store as _store
        arquivos = _store.load_arquivos(project_name, tipo, prefixo)
        if not arquivos:
            return None
        soma = peso_total = 0.0
        vistos = 0
        for f in arquivos:
            for p in _store.load_pedacos(project_name, tipo, f).values():
                peso = float(p.get('linhas') or 1)
                if p.get('vector_ref') is None:
                    # Nasceu depois do último resumo: zero, COM o peso dele.
                    # Ignorá-lo faria acrescentar uma seção inteira não mexer na
                    # conta — o oposto do que deve acontecer.
                    s = _DET_SEM_PAR
                else:
                    s = self._det_cosseno(p.get('vector'), p.get('vector_ref'))
                    vistos += 1
                soma += peso * s
                peso_total += peso
        if peso_total <= 0 or not vistos:
            return None
        return soma / peso_total

    # ── O índice das fontes ─────────────────────────────────────────────────

    def _det_indexar_fonte(self, project_name, caminho, rel):
        """Fatia e embeda o ARQUIVO-FONTE, no tipo `fonte` do mesmo índice.

        ⛔ **Não é um segundo índice.** É a mesma tabela, com outro `tipo` — a
        proibição da obra é criar um banco à parte só para a comparação, e dois
        índices sobre o mesmo material seriam dois donos de um dado só.

        Por que a fonte, e não a saída: a pergunta desta régua é *"o texto que
        eu documentei mudou o bastante para eu documentar de novo?"*. Comparar
        saídas responderia outra coisa — e a saída só existe depois de rodar
        o LLM, que é justamente o que se quer evitar.

        Só é chamada para o que **não é código**, e só quando o arquivo mudou.
        """
        try:
            with open(caminho, 'r', encoding='utf-8', errors='replace') as f:
                conteudo = f.read()
        except Exception:
            return False
        try:
            return bool(self._emb_indexar_pedacos(
                project_name, 'fonte', rel, conteudo, caminho,
                self._emb_hash_texto(conteudo)) is not None)
        except Exception:
            # Modelo de embedding ausente ou quebrado não pode travar o ciclo.
            # Sem índice a régua devolve "não sei", e "não sei" é rodar.
            return False

    # ── As duas perguntas que as rotinas fazem ──────────────────────────────

    def _det_vale_regerar_nao_codigo(self, project_name, source_file):
        """Este arquivo NÃO-CÓDIGO mudou o bastante para refazer a documentação dele?

        `True` também em toda dúvida — arquivo novo, índice vazio, erro na
        conta. A assimetria é a mesma do resto do Detector: errar para mais
        custa uma chamada de LLM; errar para menos deixa a documentação velha
        para sempre, e sem aviso.
        """
        try:
            s = self._det_similaridade_do_arquivo(project_name, 'fonte', source_file)
        except Exception:
            return True
        if s is None:
            return True
        return s < self._det_limiar('doc-tecnica')

    def _det_vale_regerar_pasta(self, project_name, prefixo):
        """Esta pasta mudou o bastante para refazer o resumo dela?"""
        try:
            s = self._det_similaridade_da_pasta(project_name, prefixo, tipo='documentacao-tecnica')
        except Exception:
            return True
        if s is None:
            return True
        return s < self._det_limiar('resumo-pastas')
