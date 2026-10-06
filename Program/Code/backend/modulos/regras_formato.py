"""A forma da base de Regras e instruções — os nomes que três módulos leem.

`regras.py` (a leitura), `regras_indice.py` (o índice e a escrita) e
`arquivos.py` (os moldes da biblioteca) precisam dos mesmos nomes de arquivo e
de seção. Eles moram aqui, e só aqui, porque um mixin não herda o namespace do
arquivo que o compõe: cada método procura o nome nos globais do MÓDULO em que
foi escrito, e uma constante declarada em `regras.py` é invisível para o método
de `regras_indice.py` que a usa.
"""

# Regra e instrução são as duas PASTAS COM O NOME DO ITEM, direto na base —
# a mesma gramática do resto da biblioteca (pasta com arquivo dentro é um
# item; pasta vazia ou só com subpastas não é nada). O tipo é a FORMA, e não um
# metadado nem uma subpasta: pasta com UM `.md` é uma regra; pasta com o
# principal mais apoio (`Como aplicar.md`, `Exceções.md`) é uma instrução.
#
# Até 2026-09-21 a base tinha as subpastas `Regras/` e `Instruções/`, e a
# instrução usava `Resumo.md` como principal. A reforma dos moldes (discussão
# "Reforma dos comandos e skills") trocou pela forma acima, que é a que a skill
# `regras-e-instrucoes` escreve; o programa passou a ler a mesma forma, e os
# projetos que tinham `Regras/` foram migrados junto.
ARQUIVO_INDICE = 'Índice.md'
ARQUIVO_COMO_APLICAR = 'Como aplicar.md'
# `Histórico 2026-09.md` e afins: o texto integral de antes de a base ser
# condensada. Fica no disco para nada se perder, e fora de toda listagem.
PREFIXO_HISTORICO = 'Histórico'

SECAO_DESCRICAO = 'Descrição'
SECAO_QUANDO = 'Quando se aplica'
SECAO_REGRA = 'Regra'
SECAO_COBRE = 'O que esta receita cobre'
SECAO_ARQUIVOS = 'Arquivos'

