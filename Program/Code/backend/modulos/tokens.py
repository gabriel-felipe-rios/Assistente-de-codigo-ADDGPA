"""Contagem de tokens, cálculo de limites derivados e admissão por janela.

Regra do projeto: o limite de conteúdo enviado ao LM Studio não é um número
chutado em config — é calculado por arquivo, descontando o que já se sabe que
vai ocupar espaço (prompt fixo, esqueleto, teto de saída, margem).

A contagem usa tiktoken quando disponível. Sem ele, cai numa estimativa por
caracteres. Precisão de ±10% basta: o uso é "não estourar a janela", não
auditoria de custo.

⚠️ O orçamento é POR REQUISIÇÃO, mas a janela do LM Studio é UMA SÓ, dividida
entre todas as requisições em voo. Quem dispara em paralelo precisa passar pelo
`PortaoDeContexto` — ver a explicação lá embaixo.
"""

import threading
from contextlib import contextmanager

from .padroes_de_fabrica import TETO_DE_SAIDA_PADRAO

# Código é mais denso que prosa: parênteses, pontos, indentação e underscores
# viram tokens próprios. ~3,5 chars/token para código, ~4 para texto corrido.
CHARS_POR_TOKEN = 3.5

_ENCODER = None
_ENCODER_TENTADO = False


def _get_encoder():
    """Carrega o tiktoken uma vez só. Devolve None se não estiver instalado."""
    global _ENCODER, _ENCODER_TENTADO
    if _ENCODER_TENTADO:
        return _ENCODER
    _ENCODER_TENTADO = True
    try:
        import tiktoken
        _ENCODER = tiktoken.get_encoding('cl100k_base')
    except Exception:
        _ENCODER = None
    return _ENCODER


def contar_tokens(texto):
    """Número de tokens de um texto. Exato com tiktoken, estimado sem ele."""
    if not texto:
        return 0
    enc = _get_encoder()
    if enc is not None:
        try:
            return len(enc.encode(texto, disallowed_special=()))
        except Exception:
            pass
    return int(len(texto) / CHARS_POR_TOKEN)


def contagem_exata():
    """True quando o tiktoken está disponível (contagem real, não estimativa)."""
    return _get_encoder() is not None


def cortar_em_tokens(texto, teto):
    """Corta um texto no teto de TOKENS, e devolve texto de volta.

    Com tiktoken o corte e exato: fatia a lista de tokens e decodifica. Sem
    ele, cai na estimativa por caractere — a mesma regra de `contar_tokens`,
    para que os dois nunca discordem sobre o que cabe.
    """
    if not texto or teto <= 0:
        return ''
    enc = _get_encoder()
    if enc is not None:
        try:
            ids = enc.encode(texto, disallowed_special=())
            if len(ids) <= teto:
                return texto
            return enc.decode(ids[:teto])
        except Exception:
            pass
    return texto[:tokens_para_chars(teto)]


def tokens_para_chars(tokens):
    """Converte um orçamento de tokens para caracteres."""
    return int(max(0, tokens) * CHARS_POR_TOKEN)


def calcular_orcamento(limites, prompt='', esqueleto=''):
    """Quanto sobra, em tokens e em caracteres, para o conteúdo do arquivo.

    `prompt` e `esqueleto` são medidos na hora — não estimados. O teto de saída
    é imposto via max_tokens na chamada, então é garantido e não esperança.

    Devolve um dict com o detalhamento, para a UI poder mostrar a conta.
    """
    janela = int(limites.get('janela_contexto', 50000))
    saida = int(limites.get('teto_saida', TETO_DE_SAIDA_PADRAO))
    margem_pct = int(limites.get('margem_pct', 20))

    t_prompt = contar_tokens(prompt)
    t_esqueleto = contar_tokens(esqueleto)
    t_margem = int(janela * margem_pct / 100)

    sobra = janela - t_prompt - t_esqueleto - saida - t_margem
    # Piso: abaixo disso não vale a pena tentar — o arquivo é grande demais para
    # a janela configurada e deve ser reportado como pulado.
    sobra = max(0, sobra)

    return {
        'janela': janela,
        'prompt': t_prompt,
        'esqueleto': t_esqueleto,
        'saida': saida,
        'margem': t_margem,
        'sobra_tokens': sobra,
        'sobra_chars': tokens_para_chars(sobra),
        'exata': contagem_exata(),
    }


class PortaoDeContexto:
    """Admissão por tokens: quantas requisições cabem NA JANELA ao mesmo tempo.

    O erro que isto conserta: `calcular_orcamento` dimensiona **uma** requisição
    para caber na janela inteira. Os agentes então disparam quatro dessas de uma
    vez, num ThreadPoolExecutor. Só que o LM Studio não tem quatro janelas — tem
    uma, e o KV cache das requisições simultâneas divide o mesmo espaço. Quatro
    prompts de 30k numa janela de 50k não entram, e o servidor responde
    `Context size has been exceeded` — inclusive para a requisição pequena que
    só teve o azar de estar em voo junto com as grandes.

    Por isso o portão conta tokens, e não requisições: um lote grande atravessa
    sozinho, enquanto vários pequenos passam juntos. É o paralelismo que o
    hardware realmente aguenta, em vez do número fixo que o usuário escolheu.

    O custo é limitado à capacidade: uma requisição maior que a janela inteira
    passaria a esperar para sempre por um espaço que nunca existe. Ela vai
    falhar no servidor de qualquer jeito — melhor falhar do que travar o agente.
    """

    def __init__(self, capacidade):
        self._capacidade = max(1, int(capacidade))
        self._em_voo = 0
        self._condicao = threading.Condition()

    @contextmanager
    def reservar(self, tokens):
        custo = max(1, min(int(tokens or 1), self._capacidade))
        with self._condicao:
            while self._em_voo and self._em_voo + custo > self._capacidade:
                self._condicao.wait()
            self._em_voo += custo
        try:
            yield
        finally:
            with self._condicao:
                self._em_voo -= custo
                self._condicao.notify_all()
