"""Antes e depois da chamada ao modelo: montar o prompt, e ler o que voltou.

Duas metades da mesma pergunta — *como a Fila fala com o modelo* —, e é por isso
que estão no mesmo arquivo: a configuração da rodada (`_fila_config`), o system
prompt, o pedido de correção, e a leitura do envelope que voltou.

⚠️ O ENVELOPE É PROCURADO NA ORDEM DE `_FILA_ENVELOPES`, e a ordem não é
alfabética nem histórica. "chamadas" vem primeiro porque é o caso comum e porque
sondar "relatorio" antes daria falso positivo quando uma pergunta a subagente
menciona a palavra: haveria indício sem objeto, e uma resposta perfeita gastaria
uma rodada de correção.

⚠️ `_fila_motivo_do_formato` EXISTE PARA O PEDIDO DE CORREÇÃO SER ESPECÍFICO.
"Formato inválido" faz o modelo repetir o mesmo erro; "você fechou o JSON no
meio" e "você usou uma chave que não existe" fazem ele acertar na volta
seguinte. É a diferença entre gastar as três correções e não gastar nenhuma.
"""

from .execucao_constantes import *
from .execucao_constantes import _FILA_ENVELOPES
from ..execucao.subagentes_constantes import MAX_PARALELO
from ...extensoes.prompts import acrescimos_de_prompt, aplicar_acrescimos


class FilaExecucaoPreparacaoMixin:

    # ── Configuração da pesquisa ───────────────────────────────────────────────

    def _fila_config(self, subagentes_config):
        """O que a sub-aba Subagentes da Fila mandou, com os padrões dela."""
        cfg = subagentes_config or {}
        pedidos = cfg.get('ativos')
        # Os subagentes de extensão LIGADA entram na hora, somados à lista
        # da Fila (`com_subagentes_de_extensoes` — nunca ao Verificador).
        if pedidos is None:
            ativos = com_subagentes_de_extensoes(SUBAGENTES_FILA)
        else:
            ativos = [s for s in com_subagentes_de_extensoes(SUBAGENTES_FILA, pedidos)
                      if s in pedidos]

        def _inteiro(chave, padrao, minimo=1):
            try:
                return max(int(cfg.get(chave) or padrao), minimo)
            except (TypeError, ValueError):
                return padrao

        return {
            'ativos': ativos,
            'max_rodadas': _inteiro('max_rodadas', MAX_RODADAS_FILA_PADRAO),
            'max_tokens': cfg.get('max_tokens'),
            'devolucoes': _inteiro('devolucoes', MAX_DEVOLUCOES_PADRAO),
            'max_voltas': _inteiro('max_voltas', MAX_VOLTAS_FILA_PADRAO, minimo=10),
            'contador': bool(cfg.get('contador', True)),
            'verificador': bool(cfg.get('verificador', True)),
        }

    def _fila_prompt(self, *partes):
        """Um prompt da Fila. `('Verificador', 'system-prompt.txt')` também."""
        return self._ler_prompt(obter_prompt_do_assistente(PASTA_FILA, *partes))

    def _fila_system_prompt(self, project_name, cfg):
        """O prompt fixo da Fila, montado como o do Chat.

        Reaproveita os mesmos blocos de descrição de subagente e os mesmos
        trechos de prompt das extensões: são os mesmos subagentes, e manter duas
        descrições para cada um seria dois lugares para divergir.
        """
        texto = (self._fila_prompt('system-prompt.txt')
                 .replace('{blocos_subagentes}', self.montar_blocos_subagentes(cfg['ativos']))
                 .replace('{max_chamadas}', str(cfg['max_rodadas']))
                 .replace('{max_chamadas_por_vez}', str(MAX_PARALELO)))
        # O que as extensões ligadas acrescentam ao prompt da Fila (D51, D52).
        return aplicar_acrescimos(texto, acrescimos_de_prompt(
            self, 'fila', project_name, cfg['ativos'])).strip()

    def _fila_envelope(self, raw):
        """Qual das três respostas o agente deu. Retorna (chave, obj, erro).

        (None, None, None) é prosa solta — nem indício de JSON. O erro de uma
        sondagem só vira correção quando NENHUMA das três achou objeto: um
        indício de "relatorio" dentro de uma pergunta a subagente não pode
        invalidar uma chamada perfeitamente formada.

        ⚠️ O erro devolvido é o de TODAS as sondagens que acharam indício, e não
        só o da primeira. Devolvendo `erros[0]`, a correção podia falar de um
        envelope que o modelo nem tentou usar: ele mandava um relatório torto, a
        sondagem de "chamadas" achava a palavra citada dentro dele, e a mensagem
        de correção mandava consertar as chamadas. O modelo então consertava o
        que não estava errado, e a tarefa girava.
        """
        erros = []
        for chave in _FILA_ENVELOPES:
            obj, err = extrair_json_com_chave(raw, chave)
            if obj is not None:
                return chave, obj, None
            if err:
                erros.append(err)
        if not erros:
            return None, None, None
        if len(erros) == 1:
            return None, None, erros[0]
        return None, None, (
            'A resposta menciona mais de um dos envelopes e nenhum deles está '
            'num JSON válido. ' + ' '.join(erros))

    def _fila_motivo_do_formato(self, resp, raw, limpo, err):
        """POR QUE a resposta não serviu — a frase que vai para a correção.

        As quatro razões são muito diferentes, e a Fila dizia "formato inválido"
        para as quatro. O subagente já sabia distinguir as duas primeiras; a
        Fila não, e era ela que rodava por horas.

        ⚠️ A nº1 continua valendo mesmo com o Formato garantido ligado: o
        esquema garante a GRAMÁTICA, não garante que a resposta TERMINE. Uma
        resposta cortada no teto é um JSON perfeitamente formado até o ponto em
        que o orçamento acabou.
        """
        # 1. Cortada pelo teto de saída. O JSON truncado seria acusado de
        #    "formato inválido", e o modelo tentaria de novo o mesmo texto
        #    longo — que seria cortado de novo, no mesmo lugar.
        try:
            conferir_terminou(resp)
        except RespostaCortada:
            return ('a sua resposta foi CORTADA por falta de orçamento de saída '
                    '(' + MOTIVO_CORTADA + '). Responda de novo, mais curto: menos '
                    'chamadas por vez, ou um relatório com menos itens.')
        # 2. Só raciocínio. Um `<think>` que o modelo nunca fecha faz
        #    `strip_thinking` devolver string VAZIA — e vazio não tem JSON, então
        #    caía no ramo genérico com uma descrição que não descrevia nada.
        if (raw or '').strip() and not (limpo or '').strip():
            return ('a sua resposta veio só com o bloco de raciocínio e nada fora '
                    'dele — e o bloco nem chegou a ser fechado. Escreva o JSON em '
                    'si, fora de qualquer bloco de raciocínio.')
        # 3. É um JSON inteiro, com o nome da chave de fora errado.
        errada = envelope_com_chave_errada(limpo, _FILA_ENVELOPES)
        if errada:
            return errada
        # 4. O resto, com o que as sondagens acharem.
        return err or ('a resposta não trouxe nenhum dos três JSON esperados '
                       '("chamadas", "precisa_de_voce" ou "relatorio")')

    def _fila_correcao(self, descricao_erro, cfg):
        return (self._fila_prompt('prompt-correcao.txt')
                .replace('{descricao_erro}', descricao_erro)
                .replace('{subagentes_ativos}', ', '.join(cfg['ativos']))
                .replace('{max_chamadas_por_vez}', str(MAX_PARALELO)))
