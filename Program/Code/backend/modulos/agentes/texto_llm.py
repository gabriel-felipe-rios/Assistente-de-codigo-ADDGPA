"""A camada de limpeza da resposta do modelo — o que sai do LM Studio antes de
virar `.md`, JSON ou HTML.

São três problemas diferentes, e cada um tem uma função:

1. **O raciocínio vem misturado no texto.** Modelo reasoning emite
   `<think>…</think>` (e mais seis variações) no meio da resposta.
   → `strip_thinking`.
2. **O raciocínio vem num campo separado.** O LM Studio devolve
   `reasoning_content` fora do `content`, e o SDK da OpenAI guarda campo
   desconhecido em `model_extra`. → `extrair_raciocinio`.
3. **A resposta começa no meio.** Mesmo sem tag nenhuma, o modelo rascunha o
   formato pedido dentro do próprio raciocínio e só depois entrega a versão
   boa — as duas saem grudadas. → `resgate_da_resposta`.

⚠️ Nada aqui roda dentro do laço de ferramentas do Chat, da Fila ou dos
subagentes, nem no histórico que eles salvam. Isso é decisão registrada: o
pensamento ajuda a rodada seguinte e preserva o reaproveitamento de cache do
servidor. O corte vale na ENTREGA — o `.md` que a rotina grava, a resposta que
o subagente devolve ao agente principal.
"""

import re

# ── 1. As famílias de tag ────────────────────────────────────────────────────
# Sete famílias, e não uma. Cada modelo escolhe a sua, e o programa não escolhe
# o modelo: quem roda no LM Studio é o que o usuário carregou.
#
#   <think>      Qwen, DeepSeek-R1, a maioria
#   <thinking>   Claude-like, alguns finetunes
#   <reason>     Granite
#   <reasoning>  variantes de Nemotron
#   <analysis>   alguns modelos de raciocínio da Microsoft
#   ◁think▷      Kimi / Moonshot — usa caractere de bloco, não `<>`
#   [THINK]      alguns GGUF convertidos à mão
#
# `<think` com atributo (`<think type="x">`) e com CRLF logo depois da tag
# também entram: o `(?:\s[^>]*)?` e o `re.DOTALL` cuidam disso.
_NOMES_DE_TAG = 'think|thinking|reason|reasoning|analysis'

# Bloco completo, com abertura e fechamento. Sai inteiro.
_BLOCO_COMPLETO = re.compile(
    r'<(?:%s)(?:\s[^>]*)?>.*?</(?:%s)\s*>' % (_NOMES_DE_TAG, _NOMES_DE_TAG),
    re.DOTALL | re.IGNORECASE)

# Abertura sem fechamento: a resposta foi cortada no meio do raciocínio. Some
# da tag até o fim — não sobrou resposta nenhuma depois.
_ABERTURA_ORFA = re.compile(
    r'<(?:%s)(?:\s[^>]*)?>.*' % _NOMES_DE_TAG, re.DOTALL | re.IGNORECASE)

# Fechamento sem abertura — o caso MAIS COMUM, e o que estava invertido aqui.
#
# Muitos templates de chat já deixam o `<think>` preenchido no fim do prompt,
# então o modelo só emite o FECHAMENTO. O código antigo apagava a tag e
# preservava tudo: o raciocínio inteiro ia para o `.md`. É o contrário — o que
# vem ANTES da tag órfã é o raciocínio, e o que vem DEPOIS é a resposta.
#
# `[\s\S]*` e não `.*`: precisa atravessar quebra de linha. Guloso de
# propósito, para pegar a ÚLTIMA tag órfã quando houver mais de uma.
_FECHAMENTO_ORFAO = re.compile(
    r'[\s\S]*</(?:%s)\s*>' % _NOMES_DE_TAG, re.IGNORECASE)

# ── Kimi / Moonshot: ◁think▷ … ◁/think▷ ──
_KIMI_COMPLETO = re.compile(r'◁think▷.*?◁/think▷', re.DOTALL)
_KIMI_ABERTURA_ORFA = re.compile(r'◁think▷.*', re.DOTALL)
_KIMI_FECHAMENTO_ORFAO = re.compile(r'[\s\S]*◁/think▷')

# ── [THINK] … [/THINK] ──
_COLCHETE_COMPLETO = re.compile(r'\[THINK\].*?\[/THINK\]', re.DOTALL | re.IGNORECASE)
_COLCHETE_ABERTURA_ORFA = re.compile(r'\[THINK\].*', re.DOTALL | re.IGNORECASE)
_COLCHETE_FECHAMENTO_ORFAO = re.compile(r'[\s\S]*\[/THINK\]', re.IGNORECASE)

# ── harmony (gpt-oss) ──
# O gpt-oss não usa tag: ele emite CANAIS, e a resposta é o canal `final`.
#
#   <|channel|>analysis<|message|>…raciocínio…<|end|>
#   <|channel|>final<|message|>…a resposta…
#
# A regra é "fique com o que vem depois do ÚLTIMO `final`" — pode haver mais de
# um canal `final` numa resposta longa, e o que vale é o último. O `<|return|>`
# / `<|end|>` que fecha o último canal também sai.
_HARMONY_FINAL = re.compile(r'[\s\S]*<\|channel\|>\s*final\s*<\|message\|>')
_HARMONY_SOBRAS = re.compile(r'<\|(?:return|end|endoftext|start|channel|message)\|>.*', re.DOTALL)


def strip_thinking(texto):
    """Tira o raciocínio que veio misturado no corpo da resposta.

    Trata as sete famílias de tag, nos três estados em que cada uma aparece
    (bloco completo, abertura órfã, fechamento órfão) e o formato harmony do
    gpt-oss. Texto sem nenhuma delas volta como entrou, só com as pontas
    aparadas.
    """
    if not texto:
        return texto

    limpo = texto

    # harmony primeiro: ele delimita a resposta inteira, então rodar antes
    # evita que o raciocínio dos canais anteriores seja varrido tag por tag.
    if '<|channel|>' in limpo and _HARMONY_FINAL.search(limpo):
        limpo = _HARMONY_FINAL.sub('', limpo, count=1)
        limpo = _HARMONY_SOBRAS.sub('', limpo)

    for completo, abertura_orfa, fechamento_orfao in (
        (_BLOCO_COMPLETO, _ABERTURA_ORFA, _FECHAMENTO_ORFAO),
        (_KIMI_COMPLETO, _KIMI_ABERTURA_ORFA, _KIMI_FECHAMENTO_ORFAO),
        (_COLCHETE_COMPLETO, _COLCHETE_ABERTURA_ORFA, _COLCHETE_FECHAMENTO_ORFAO),
    ):
        # 1. Blocos fechados saem inteiros.
        limpo = completo.sub('', limpo)
        # 2. Fechamento que sobrou é órfão: o raciocínio é o que veio ANTES.
        #    Roda antes da abertura órfã de propósito — se o texto tiver os
        #    dois, quem manda é o fechamento, que delimita onde a resposta
        #    de verdade começa.
        limpo = fechamento_orfao.sub('', limpo, count=1)
        # 3. Abertura sem fechamento: cortada no meio do raciocínio, não
        #    sobrou resposta.
        limpo = abertura_orfa.sub('', limpo)

    return limpo.strip()


# ── 2. O raciocínio que vem em campo separado ────────────────────────────────
# O LM Studio devolve o raciocínio FORA do `content` quando o modelo declara
# suporte: `message.reasoning_content` (o nome que o LM Studio usa) ou
# `message.reasoning` (o nome que outros servidores usam).
#
# ⚠️ O SDK da OpenAI é tipado: campo que não está no schema dele NÃO vira
# atributo — vai para `model_extra`, um dicionário. Por isso as três tentativas,
# nesta ordem. Antes desta função o programa nunca lia nenhum dos três, então um
# modelo que separasse o raciocínio direito era tratado como se não separasse.
_CAMPOS_DE_RACIOCINIO = ('reasoning_content', 'reasoning')


def extrair_raciocinio(message):
    """O raciocínio que o servidor mandou em campo próprio, ou `''`.

    Serve para o Log — que mostra tudo, por decisão registrada — e para saber
    que o modelo separou o raciocínio sozinho, caso em que o `content` já vem
    limpo e o `strip_thinking` não tem o que fazer.
    """
    if message is None:
        return ''
    for campo in _CAMPOS_DE_RACIOCINIO:
        valor = getattr(message, campo, None)
        if isinstance(valor, str) and valor.strip():
            return valor.strip()
    extra = getattr(message, 'model_extra', None) or {}
    if isinstance(extra, dict):
        for campo in _CAMPOS_DE_RACIOCINIO:
            valor = extra.get(campo)
            if isinstance(valor, str) and valor.strip():
                return valor.strip()
    return ''


def conteudo_limpo(message):
    """O `content` de uma resposta, sem raciocínio — os dois casos de uma vez.

    Junta os dois primeiros problemas do módulo: se o servidor separou o
    raciocínio em campo próprio, o `content` já vem limpo; se misturou no corpo,
    `strip_thinking` tira. Chamar isto é o certo em quem grava a resposta.
    """
    if message is None:
        return ''
    return strip_thinking(getattr(message, 'content', '') or '')


# ── 3. O Resgate da resposta ─────────────────────────────────────────────────

def resgate_da_resposta(texto, ancoras):
    """Corta tudo antes da ÚLTIMA ocorrência de uma das âncoras.

    A rede de segurança de quando não há tag nenhuma para cortar. O modelo
    rascunha o formato pedido dentro do próprio raciocínio — escreve o título,
    se corrige, escreve de novo — e as duas versões saem grudadas. Ficar com a
    primeira entrega o rascunho.

    **A última, e não a primeira.** É a decisão que faz a função funcionar: a
    versão boa é sempre a que o modelo escreveu por último.

    `ancoras` é a lista de começos possíveis (`'# '`, `'## O que este arquivo
    faz'`). Nenhuma encontrada → devolve o texto como está: é melhor entregar
    texto com sobra que apagar uma resposta boa que não casou com o padrão.
    """
    if not texto or not ancoras:
        return texto
    corte = -1
    for ancora in ancoras:
        if not ancora:
            continue
        pos = texto.rfind(ancora)
        # `> corte` e não `>=`: entre duas âncoras diferentes fica a que
        # aparece MAIS TARDE no texto, que é a da entrega final.
        if pos > corte:
            corte = pos
    if corte <= 0:
        return texto.strip()
    return texto[corte:].strip()


def limpar_entrega(texto, ligado=True, ancoras=None):
    """A limpeza que vale na ENTREGA — o `.md` gravado, a resposta devolvida.

    É o que o interruptor "Resgate da resposta" liga e desliga. Desligado,
    devolve o texto exatamente como o modelo mandou: quem desliga está pedindo
    para ver o que chegou, sem o programa adivinhar nada.

    ⚠️ Não confundir com a limpeza do PARSE. Dentro do laço de ferramentas o
    texto continua sendo limpo para o JSON de chamada ser encontrado — sem
    isso nada funciona, e não é disso que o interruptor trata.
    """
    if not ligado or not texto:
        return texto
    limpo = strip_thinking(texto)
    if ancoras:
        limpo = resgate_da_resposta(limpo, ancoras)
    return limpo
