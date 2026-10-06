"""Os tetos, os avisos e os envelopes da Fila — e o bloco de imports da família.

Arquivo próprio pelo mesmo motivo de `ferramentas_subagentes_constantes.py`:
`execucao.py` passou a COMPOR os quatro mixins irmãos, e um deles importando uma
constante de lá fecharia um ciclo. Aqui elas ficam num lugar que ninguém importa
de volta.

⚠️ OS DOIS AVISOS NÃO SÃO O MESMO TEXTO, e a diferença é a razão de o laço parar
de girar. `AVISO_ULTIMA_RODADA_FILA` diz "escreva o relatório"; o outro diz o que
ACONTECEU — que as chamadas foram recusadas. Repetir o primeiro era o defeito: o
modelo pedia subagentes, a Fila não executava, respondia com a mesma frase que
ele acabara de ler, e ele pedia de novo, para sempre.

⚠️ `_FILA_ENVELOPES` E `_VERIFICADOR` COMEÇAM COM `_`, então `import *` não os
leva: quem precisa deles os importa pelo nome. Não tirar o `_` para "facilitar" —
ele marca que são detalhe interno da Fila, não vocabulário do programa.
"""

from ...constantes import *
from ..json_tolerante import (extrair_json_com_chave, validar_chamadas,
                              validar_relatorio, validar_veredito,
                              envelope_com_chave_errada)
from ..texto_llm import strip_thinking
from ..mensagens_llm import preparar_mensagens
from ..llm_estruturado import (chat_json, conferir_terminou, RespostaCortada,
                               MOTIVO_CORTADA, FormatoNaoObedecido)
from ..execucao.subagentes import SUBAGENTES_FILA, com_subagentes_de_extensoes
from ..rastro_leitura import RastroDeLeitura, META_TIPO as META_RASTRO
from ..trava_ia import TRAVA_IA, DONO_FILA, TravaOcupada
from .estado import (
    FILA_STATUS_NA_FILA, FILA_STATUS_AGUARDANDO_VEZ, FILA_STATUS_PESQUISANDO,
    FILA_STATUS_PRECISA_DE_VOCE, FILA_STATUS_PRONTO, FILA_STATUS_PRONTO_COM_RESSALVA,
    FILA_SUBTAGS_PRECISA_DE_VOCE, FILA_SUBTAGS_RESSALVA_DO_LLM,
    FILA_SUBTAGS_RESSALVA, FILA_CONTINUAR_TETO_CHEIO,
)

# Teto de rodadas de chamadas de subagentes, POR TAREFA. No Chat o padrão é 2,
# porque alguém está esperando a resposta; aqui é 30, porque ninguém está. É o
# único freio da pesquisa: não existe limite de tempo por tarefa.
MAX_RODADAS_FILA_PADRAO = 30
# Cinto de segurança do laço: quantas vezes, no máximo, a Fila fala com o modelo
# numa tarefa. Conta QUALQUER volta — chamada de subagentes, correção de
# formato, devolução do Verificador. ⚠️ Não é tempo: uma tarefa que demora três
# horas e faz 40 voltas passa. O número é folgado de propósito — ele existe para
# pegar laço que não termina, não para apertar pesquisa longa.
MAX_VOLTAS_FILA_PADRAO = 120
# Quantas vezes o Verificador pode devolver o relatório antes de o programa
# desistir e entregar assim mesmo, com ressalva.
MAX_DEVOLUCOES_PADRAO = 3
# As tentativas de correção vêm da categoria "Ferramentas dos subagentes",
# em Configurações — o mesmo campo que o Chat usa. O padrão de fábrica está
# em `PADROES_DAS_FERRAMENTAS`, e quem lê é `_sub_limite`.

AVISO_ULTIMA_RODADA_FILA = ('[AVISO DO SISTEMA] Estes são os últimos resultados — '
                            'escreva o relatório agora.')

# ⚠️ NÃO é o mesmo aviso acima, e a diferença é a razão de o laço parar de
# girar. Aquele diz "escreva o relatório"; este diz o que ACONTECEU — que as
# chamadas foram recusadas. Repetir o primeiro era o defeito: o modelo pedia
# subagentes, a Fila não executava, respondia com a mesma frase que ele acabara
# de ler, e ele pedia de novo, para sempre. Ele não tinha como saber que a
# chamada havia sido recusada.
AVISO_CHAMADAS_RECUSADAS = ('[AVISO DO SISTEMA] As chamadas que você pediu NÃO foram '
                            'executadas, porque as rodadas acabaram. Responda apenas '
                            'com o relatório.')

# As três respostas possíveis do agente principal, na ordem em que são
# sondadas. "chamadas" vem primeiro porque é o caso comum e porque sondar
# "relatorio" antes daria falso positivo quando uma pergunta a subagente
# menciona a palavra: haveria indício sem objeto, e uma resposta perfeita
# gastaria uma rodada de correção.
_FILA_ENVELOPES = ('chamadas', 'relatorio', 'precisa_de_voce')

_VERIFICADOR = 'fila-verificador'
