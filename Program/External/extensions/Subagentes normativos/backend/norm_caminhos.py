"""Só monta caminho — nunca lê nem escreve. E guarda as quatro bases.

As bases que esta extensão lê moram em `Saída das skills/`, na pasta RAIZ do
projeto aberto — fora da pasta de trabalho, e é por isso que o manifesto as
declara em `le_fora`. A raiz chega do programa no payload (`pasta_projeto`);
nunca é montada à mão, nem a partir de `__file__`.
"""

import os

PASTA_DAS_BASES = 'Saída das skills'

# {id do subagente: (pasta da base, o que ela decide, nome de exibição)}. A
# descrição entra em prosa no prompt do Chat e da Fila e completa "O que este
# projeto decidiu sobre ___". Acrescentar uma base é acrescentar uma linha
# aqui, um item `agente` no `extensao.json` e a pasta do subagente em
# `subagentes/`.
BASES = {
    'norm.instrutor':    ('Regras e instruções', 'as regras e instruções dele', 'Instrutor'),
    'norm.enderecador':  ('Arquitetura modular', 'onde cada arquivo deve morar', 'Endereçador'),
    'norm.padronizador': ('Padrões de interface', 'a aparência e o comportamento das telas',
                          'Padronizador'),
    'norm.terminologo':  ('Terminologia e nomenclatura', 'como as coisas se chamam',
                          'Terminólogo'),
}

# A base do Instrutor tem índice próprio (regra × instrução, com o "quando se
# aplica"); as outras três são só a lista dos arquivos.
SUBAGENTE_DAS_REGRAS = 'norm.instrutor'

# `Histórico …` é o texto integral de antes de a base ser condensada: existe
# para nada se perder, e fica fora de toda lista.
PREFIXO_HISTORICO = 'Histórico'
SECAO_QUANDO = 'Quando se aplica'
SECAO_DESCRICAO = 'Descrição'


def raiz_do_projeto(payload):
    """A pasta raiz do projeto aberto, que o PROGRAMA pôs no payload."""
    raiz = (payload or {}).get('pasta_projeto')
    if not raiz or not os.path.isdir(raiz):
        raise ValueError('pasta raiz do projeto não configurada — peça ao usuário '
                         'para configurá-la na aba Trabalho')
    return raiz


def pasta_da_base(raiz, nome_da_base):
    return os.path.join(raiz, PASTA_DAS_BASES, nome_da_base)


def dentro_da_base(base, relativo):
    """O caminho absoluto de `relativo` dentro de `base` — ou `ValueError` se
    ele sair dela (`..`, caminho absoluto). A contenção é daqui, e não do
    programa: é a extensão que lê fora da pasta de trabalho."""
    if os.path.isabs(relativo):
        raise ValueError('caminho absoluto não é permitido: %s' % relativo)
    alvo = os.path.normpath(os.path.join(base, relativo.replace('/', os.sep)))
    base_normal = os.path.normpath(base)
    if alvo != base_normal and not alvo.startswith(base_normal + os.sep):
        raise ValueError('caminho fora da base: %s' % relativo)
    return alvo
