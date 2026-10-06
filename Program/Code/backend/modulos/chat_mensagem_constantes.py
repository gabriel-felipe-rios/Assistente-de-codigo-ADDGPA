"""As marcas de `meta` e os dois avisos de parada do Chat.

Arquivo próprio porque `chat_mensagem.py` passou a COMPOR quatro mixins irmãos,
e três deles precisam destas constantes — importá-las de lá fecharia um ciclo.
Mesma solução de `execucao_constantes.py` e `trabalhos_shell_constantes.py`.

⚠️ AS MARCAS DE `meta` SÃO CONTRATO COM A TELA. `chat-mensagens.js` decide o que
vira balão a partir delas: uma mensagem carimbada `chamada_barrada` ou
`aviso_parada` é registro, não fala. Renomear qualquer uma aqui sem renomear lá
faz a conversa mostrar JSON cru, sem erro nenhum.

⚠️ OS DOIS AVISOS DE PARADA NÃO SÃO O MESMO TEXTO, e a diferença é o estágio.
`AVISO_PARADA_AGORA` corta no meio; `AVISO_PARADA_FIM_DA_RODADA` deixa a rodada
terminar. O Chat É EXCEÇÃO à regra da Fila, que nunca corta no meio: aqui há
gente na frente da tela esperando, e mandar parar e ver a resposta continuar por
mais uma rodada inteira foi a queixa que originou o botão.
"""

from .constantes import *
from .agentes.execucao.subagentes import SUBAGENTES_TODOS, com_subagentes_de_extensoes
from .agentes.mensagens_llm import preparar_mensagens
from .agentes.rastro_leitura import RastroDeLeitura, META_TIPO as META_RASTRO
from .agentes.trava_ia import TRAVA_IA, DONO_CHAT, TravaOcupada

# A marca da chamada que o teto de rodadas barrou. ⚠️ É uma marca EXPLÍCITA de
# propósito: antes essa mensagem se distinguia pela AUSÊNCIA de `meta`, e tanto
# o desenho da faixa quanto a retomada se apoiavam nessa ausência — qualquer
# `meta` novo em qualquer outro ponto quebraria os dois em silêncio.
META_CHAMADA_BARRADA = 'chamada_barrada'

# ⚠️ As DUAS marcas do "Parar", e são duas coisas diferentes:
#
#   `resposta_parada`  — a fala do modelo que o clique interrompeu. Fica na
#                        conversa, com a faixa por baixo dizendo que ficou pela
#                        metade. O `meta.estagio` diz QUAL das duas paradas foi.
#   `aviso_parada`     — o recado ao MODELO de que aquele turno foi cortado.
#
# ⚠️ A segunda existe porque o `meta` NÃO CHEGA ao modelo: `preparar_mensagens`
# copia só `role` e `content`. Sem uma mensagem de verdade no fim, a conversa
# seguinte continuaria de um turno pela metade como se ele estivesse inteiro —
# e o modelo não teria como saber. É o mesmo molde do AVISO_CHAMADAS_RECUSADAS
# da Fila, e pelo mesmo motivo.
#
# ⚠️ E a marca é EXPLÍCITA, como a `chamada_barrada` logo acima: sem ela o
# parcial desenharia a faixa de teto estourado, que é a mensagem errada — o
# código já registra que marca implícita quebrou dois caminhos em silêncio uma
# vez.
META_RESPOSTA_PARADA = 'resposta_parada'
META_AVISO_PARADA = 'aviso_parada'

AVISO_PARADA_AGORA = ('[AVISO DO SISTEMA] O usuário mandou PARAR no meio desta '
                      'resposta. O texto acima ficou pela metade — não continue '
                      'de onde ele parou, e espere a próxima mensagem dele.')
AVISO_PARADA_FIM_DA_RODADA = ('[AVISO DO SISTEMA] O usuário mandou PARAR. A rodada '
                              'que estava em curso terminou e nada mais foi pedido '
                              'a você neste turno. Espere a próxima mensagem dele.')

