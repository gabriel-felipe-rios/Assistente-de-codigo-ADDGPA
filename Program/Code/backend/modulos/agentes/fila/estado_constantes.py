"""O vocabulário fechado da Fila: os status, as sub-tags e as continuações.

Arquivo próprio porque `estado.py` passou a compor um mixin irmão, e porque
estes nomes viajam para fora da Fila inteira — `execucao_constantes.py` importa
oito deles, e a tela desenha cada um com uma cor.

⚠️ SÃO VOCABULÁRIO FECHADO, e não texto livre. Um status ou uma sub-tag que a
tela não conhece aparece sem cor e sem rótulo, e o cartão fica mudo sobre o que
aconteceu. Acrescentar um valor aqui é acrescentar a cor e o rótulo do lado do
JavaScript, sempre.

⚠️ AS SUB-TAGS SE DIVIDEM EM TRÊS FAMÍLIAS QUE NÃO SE MISTURAM:
`FILA_SUBTAGS_PRECISA_DE_VOCE` (o agente parou para perguntar),
`FILA_SUBTAGS_RESSALVA` (o relatório saiu, com defeito conhecido) e
`FILA_SUBTAGS_FALHA` (não saiu relatório nenhum). Só as de RESSALVA são
herdadas de uma passada para a seguinte — as outras explicam por que a passada
anterior parou, e herdá-las faria o próximo relatório abrir com uma ressalva que
já não vale.

⚠️ `_FILA_MIGRACAO_STATUS` COMEÇA COM `_` e não é levado por `import *`: ele é
detalhe da leitura de arquivo antigo, e quem o usa é `_fila_load_state`.
"""

from contextlib import contextmanager

from ...constantes import *

# Os sete estados de uma tarefa. Os dois primeiros são os dois neutros e se
# distinguem na tela pela FORMA (vazado x cheio), não por cor nova: "na fila"
# é o que você escreveu e ainda não mandou rodar; "aguardando a vez" é o que
# já está em jogo, esperando a tarefa da frente terminar.
FILA_STATUS_NA_FILA = 'na_fila'
FILA_STATUS_AGUARDANDO_VEZ = 'aguardando_vez'
FILA_STATUS_PESQUISANDO = 'pesquisando'
FILA_STATUS_PRECISA_DE_VOCE = 'precisa_de_voce'
FILA_STATUS_PRONTO = 'pronto'
FILA_STATUS_PRONTO_COM_RESSALVA = 'pronto_com_ressalva'
FILA_STATUS_FALHOU = 'falhou'

# Sub-tags. Só três estados carregam alguma; os outros quatro não têm nenhuma.
# "precisa_de_voce" e "falhou" carregam uma só; "pronto_com_ressalva" pode
# carregar várias ao mesmo tempo — um relatório pode ter mais de um defeito.
FILA_SUBTAGS_PRECISA_DE_VOCE = ('tarefa_vaga', 'falta_decisao')
FILA_SUBTAGS_RESSALVA = ('arquivo_inexistente', 'trecho_nao_encontrado',
                         'contraria_decisao', 'sem_lastro',
                         'pesquisa_incompleta', 'subagente_indisponivel')
FILA_SUBTAGS_FALHA = ('lm_studio_offline', 'modelo_sem_resposta',
                      'formato_invalido', 'erro_inesperado')

# A marca "vai continuar": qual dos dois botões o usuário clicou numa tarefa que
# já terminou. ⚠️ É um CAMPO da tarefa (`proxima_continuacao`), e não um status
# novo — de propósito. O frontend compara status por string literal em vários
# lugares, e um oitavo estado custaria uma varredura textual inteira, além de
# esbarrar na proibição de mexer nos sete que existem. A tarefa continua no
# desfecho em que está; ela só GANHA a marca.
#
# Ela é consumida ao ser promovida (ver `iniciar_fila`): se sobrevivesse, a
# tarefa voltaria a ser promovida sozinha em toda leva seguinte, para sempre.
FILA_CONTINUAR_ATE_O_TETO = 'ate_o_teto'
FILA_CONTINUAR_TETO_CHEIO = 'teto_cheio'
FILA_CONTINUACOES = (FILA_CONTINUAR_ATE_O_TETO, FILA_CONTINUAR_TETO_CHEIO)

# Onde os dois botões de continuar aparecem. São os três desfechos em que a
# tarefa parou e ainda há de onde seguir: formato inválido e teto de rodadas
# (ambos `falhou`), e relatório entregue.
# ⚠️ `precisa_de_voce` fica FORA: lá a tarefa parou para perguntar, e continuar
# sem responder é justamente o que não faz sentido. Ali você escreve.
FILA_STATUS_CONTINUAVEL = (FILA_STATUS_PRONTO, FILA_STATUS_PRONTO_COM_RESSALVA,
                           FILA_STATUS_FALHOU)

# Das seis ressalvas, estas três são as únicas que o LLM tem direito de emitir.
# As outras (arquivo_inexistente, pesquisa_incompleta, subagente_indisponivel)
# são fato conferido pelo programa, e o LLM nunca é fonte de fato verificável.
FILA_SUBTAGS_RESSALVA_DO_LLM = ('trecho_nao_encontrado', 'contraria_decisao',
                                'sem_lastro')

# Nomes antigos, gravados em disco antes de a Fila virar agente principal.
# "inconclusivo" saiu porque mentia: dizia que nada saiu, quando o relatório
# existe e é aproveitável em parte.
_FILA_MIGRACAO_STATUS = {
    'pendente': FILA_STATUS_NA_FILA,
    'precisa_esclarecimento': FILA_STATUS_PRECISA_DE_VOCE,
    'concluido': FILA_STATUS_PRONTO,
    'inconclusivo': FILA_STATUS_PRONTO_COM_RESSALVA,
    'erro': FILA_STATUS_FALHOU,
}

