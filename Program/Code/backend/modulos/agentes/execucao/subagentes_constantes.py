"""Quem são os subagentes, quantas rodadas eles têm, e a exceção da parada.

Arquivo próprio porque `subagentes.py` passou a compor um mixin irmão, e porque
estas listas viajam para fora: `chat_mensagem.py` importa `SUBAGENTES_TODOS`,
`execucao_constantes.py` da Fila importa `SUBAGENTES_FILA`, e `ParadaPedida` é
levantada de dentro do laço e tratada em três lugares.

⚠️ AS QUATRO LISTAS NÃO SÃO A MESMA LISTA REPETIDA. `SUBAGENTES_TODOS` é o
catálogo; `SUBAGENTES_LLM` são os que chamam modelo (o Navegador não chama);
`SUBAGENTES_SO_FILA` é o Verificador, que não aparece no Chat; e
`SUBAGENTES_LLM_VALIDOS` é a soma que a validação usa. Igualar qualquer par faz
um subagente aparecer numa tela onde ele não funciona.

⚠️ OS SUBAGENTES DE EXTENSÃO NÃO ENTRAM EM NENHUMA DAS QUATRO (fase 12). Eles
são somados NA HORA, por `com_subagentes_de_extensoes(lista)`: a extensão liga
e desliga com o programa aberto, e uma constante montada no import ficaria com
a foto do boot. Todo subagente de extensão é LLM e é do Chat E da Fila — por
isso ele é somado a `SUBAGENTES_TODOS`, a `SUBAGENTES_FILA` e a
`SUBAGENTES_LLM_VALIDOS`, e NUNCA a `SUBAGENTES_SO_FILA` nem a `SUBAGENTES_LLM`
(esta última ninguém filtra por ela).

⚠️ O VERIFICADOR TEM MAIS RODADAS QUE OS OUTROS
(`MAX_RODADAS_FERRAMENTAS_VERIFICADOR_PADRAO`), e não é generosidade: conferir
custa mais chamadas que responder, porque ele precisa ir ao disco atrás do
lastro de cada item.

⚠️ `ParadaPedida` NÃO É ERRO. É o usuário mandando cortar no meio, e quem a
trata precisa entregar o PARCIAL — descartar o que já foi lido jogaria fora
rodadas já pagas.
"""

import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import nullcontext
from datetime import datetime

from modulos.caminhos import (
    PASTA_CHAT, obter_prompt_do_assistente, obter_prompt_do_subagente,
    obter_bloco_de_subagente,
)
from modulos.agentes.json_tolerante import extrair_json_com_chave, validar_ferramentas
from modulos.agentes.texto_llm import strip_thinking, limpar_entrega
from modulos.agentes.llm_estruturado import conferir_terminou, RespostaCortada
from modulos.tokens import contar_tokens, cortar_em_tokens, PortaoDeContexto
from modulos.agentes.ferramentas_subagentes import (
    FERRAMENTAS_POR_SUBAGENTE, ferramentas_do_subagente,
)

class ParadaPedida(RuntimeError):
    """Você clicou em "Parar" e mandou cortar no meio.

    ⚠️ Classe PRÓPRIA, e não `TimeoutError` reaproveitado, por causa da
    mensagem: quem lê o `except TimeoutError` escreve "subagente excedeu o
    tempo limite", que aqui seria mentira — e mentira difícil de desconfiar,
    porque a espera de fábrica não tem teto e "estourou o tempo" soa plausível.
    Quem a trata precisa de um `except` próprio ANTES do `except Exception`,
    senão a tela mostra o nome da classe Python no lugar do aviso limpo.
    """


# Os seis do PROGRAMA. Os que dizem o que o projeto já decidiu (lendo as bases
# da raiz) são de EXTENSÃO e entram por `com_subagentes_de_extensoes` — o
# programa base não lê fora da pasta de trabalho (D44).
SUBAGENTES_TODOS = ['buscador', 'navegador', 'leitor', 'arquiteto', 'analista',
                    'semantico']
SUBAGENTES_LLM = ['buscador', 'leitor', 'arquiteto', 'analista', 'semantico']
# Só da Fila. Fora de SUBAGENTES_TODOS de propósito: é essa lista que o Chat
# oferece, filtra e valida, então o que não está nela o Chat não enxerga. O
# Verificador não é um subagente a mais do Chat — é subagente de OUTRO agente
# principal.
VERIFICADOR_DA_FILA = 'fila-verificador'
SUBAGENTES_SO_FILA = [VERIFICADOR_DA_FILA]
# Quem `executar_subagente` aceita rodar. É a união, e não SUBAGENTES_TODOS,
# porque o Navegador não usa LLM e o Verificador não é do Chat.
SUBAGENTES_LLM_VALIDOS = SUBAGENTES_LLM + SUBAGENTES_SO_FILA
# O que o agente principal da Fila pode chamar por {"chamadas": [...]}. São os
# mesmos dez do Chat. O Verificador NÃO entra: quem o aciona é o programa, ao
# ver o relatório pronto — não o modelo.
SUBAGENTES_FILA = list(SUBAGENTES_TODOS)


def com_subagentes_de_extensoes(lista, pedidos=None):
    """`lista` + os ids dos subagentes das extensões LIGADAS, lidos agora.

    `lista` é UMA das três que os aceitam (`SUBAGENTES_TODOS`,
    `SUBAGENTES_FILA`, `SUBAGENTES_LLM_VALIDOS`) — ver o ⚠️ do topo. Devolve
    lista nova; a constante nunca muda.

    `pedidos`, quando vem, é o que a tela pediu: se todos já estão em
    `lista`, não há id de extensão entre eles e a pasta das extensões nem é
    lida — o envio de quem não tem extensão nenhuma não paga nada a mais.

    Nunca lança: uma falha ao ler as extensões deixa só os do programa."""
    if pedidos is not None and all(p in lista for p in pedidos):
        return list(lista)
    try:
        from modulos.extensoes.agentes import subagentes_de_extensoes
        extras = [s['id'] for s in subagentes_de_extensoes()]
    except Exception as e:
        print('[subagentes] falha ao ler os subagentes de extensão:', e)
        extras = []
    return list(lista) + [i for i in extras if i not in lista]
MAX_RODADAS_FERRAMENTAS_PADRAO = 3
# O Verificador tem teto PRÓPRIO, e é o único que pode ter. As listas de
# subagentes do Chat e da Fila são a mesma; ele é o único que existe só na
# Fila, então mexer no teto dele não desalinha os dois. E ele precisa de mais:
# passou a ser obrigado a fazer grep do identificador antes de dar um item por
# conferido, e cada item pode custar uma busca.
MAX_RODADAS_FERRAMENTAS_VERIFICADOR_PADRAO = 5
# Quantas ferramentas cabem numa lista so. Era o literal 4 em nove lugares — um
# no validador e oito em prompt-correcao.txt —, fixo e invisivel. Agora sai da
# aba Configuracao e entra nos prompts pelo marcador
# {max_ferramentas_rodada}, no mesmo molde do {max_rodadas_ferramentas}.
MAX_FERRAMENTAS_RODADA_PADRAO = 4
# ⚠ Uma pergunta ampla pode ocupar o teto inteiro (quatro subagentes de
# extensão de uma vez, por exemplo) e não sobrar espaço para o Buscador na
# mesma rodada. Mantido em 4 por decisão explícita — subir custa mais
# requisições simultâneas ao LM Studio.
MAX_PARALELO = 4
# O teto da resposta final do subagente saiu daqui: agora é
# `teto_resposta_subagente_tokens`, em `PADROES_DAS_FERRAMENTAS`, com tela na
# categoria "Ferramentas dos subagentes". Continua em TOKEN, e não em caractere,
# pelo motivo de sempre: o que ele protege é a janela de quem RECEBE a resposta.
# As tentativas de correção e o teto da resposta saíram daqui: agora vêm da
# categoria "Ferramentas dos subagentes", em Configurações. O padrão de
# fábrica está em `PADROES_DAS_FERRAMENTAS`.
# Rodadas seguidas em que TODAS as ferramentas falharam. Erro não consome o
# orçamento normal de rodadas (era o defeito), mas precisa de um teto próprio
# para o laço não rodar para sempre.
MAX_RODADAS_SO_ERRO = 3

# O mapa id → pasta de prompt saiu daqui e foi para `caminhos.py`, ao lado de
# `PASTAS_DAS_ROTINAS`: traduzir um id em pasta é papel de `caminhos`, e de mais
# nada. Quem quiser o caminho de um prompt de subagente chama
# `obter_prompt_do_subagente(id, arquivo)`.

AVISO_ULTIMA_RODADA_FERRAMENTAS = ('\n\nEstes são os últimos resultados — responda agora '
                                   'com o que você tem.')
