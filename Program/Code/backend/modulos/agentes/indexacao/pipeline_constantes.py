"""Pipeline — as constantes de módulo dos seis arquivos da rotina Pipeline.

Moram aqui, e não na casca (`pipeline_indice.py`), pela regra da AMF para
Python dividido: constante na casca cria ciclo de `import`. Todas começam com
`_`, então não viajam por `import *` — quem usa importa pelo nome.

Os números AJUSTÁVEIS (a régua e a profundidade da cadeia) não estão aqui:
moram em Configurações › Rotinas da Automação › «A régua do Pipeline»
(`_LIMITES_DEFAULTS` em `configuracoes_modelo.py`).
"""

# Os prompts e os esquemas de saída, irmãos em `prompts/Rotinas/`.
_PL_PROMPT_BLOCO = 'pipeline-bloco'
_PL_SCHEMA = 'pipeline.json'
_PL_SCHEMA_BLOCO = 'pipeline-bloco.json'

# Tokens estimados por passo pedido numa fatia (a linha do passo e a frase que
# volta). Só serve para partir uma cadeia grande demais; a conta de verdade é
# a do portão.
_PL_TOKENS_POR_PASSO = 60

# Voltas da propagação de rótulos. Medido no projeto Assistente (25/09/2026):
# 5, 10 e 20 voltas dão as mesmas 79 comunidades — a partir da 5ª nada muda.
_PL_VOLTAS_DE_ROTULO = 5

# Quantas chamadas de UMA ligação vão ao prompt do bloco; o resto vira
# «e mais N». É contexto para a frase, não inventário.
_PL_CHAMADAS_POR_LIGACAO = 12

# O bloco da sobra: id, nome e frase fixos, sem modelo (contrato do Pipeline
# em níveis). Ele fica fora de qualquer área, no fim da árvore.
_PL_ID_SEM_ENTRADA = 'B0'
_PL_NOME_SEM_ENTRADA = 'Sem ponto de entrada'
_PL_RESUMO_SEM_ENTRADA = ('Código que nenhum clique, ponte ou abertura alcança: '
                          'chamado só por arquivos que todo mundo usa, ou que '
                          'ninguém chama mais.')

# As três pastas de nós, dentro da pasta da rotina (contrato).
_PL_PASTAS_DE_NOS = ('areas', 'blocos', 'cadeias')
