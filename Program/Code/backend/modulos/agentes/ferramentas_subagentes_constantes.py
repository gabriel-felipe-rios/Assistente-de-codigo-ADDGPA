"""As tabelas das ferramentas de subagente: quem tem qual, e o que cada uma faz.

Arquivo próprio porque estas tabelas são lidas por gente que NÃO é a mixin:
`execucao/subagentes_constantes.py` importa `FERRAMENTAS_POR_SUBAGENTE`, e
`configuracoes.py` importa `BINARY_EXTS`. Com elas dentro
de `ferramentas_subagentes.py`, que hoje compõe oito mixins, qualquer um desses
importadores puxaria a família inteira só para ler um dicionário — e a casca não
poderia importar as partes sem fechar um ciclo.

⚠️ `ferramentas_subagentes.py` REEXPORTA tudo daqui (`import *`), então
`from modulos.agentes.ferramentas_subagentes import BINARY_EXTS` continua
funcionando exatamente como antes. Nenhum importador precisou mudar, e nenhum
deve mudar: o endereço público das tabelas continua sendo aquele.

⚠️ NENHUMA FERRAMENTA DAQUI LÊ FORA DA PASTA DE TRABALHO (P7). Uma ferramenta
que precisa ler a raiz do projeto é de EXTENSÃO, e o programa só a despacha —
ver `ferramentas_subagentes_extensao.py`.

⚠️ AS DUAS IMPORTAÇÕES COM `_` NA FRENTE NÃO ESTÃO AQUI, e a ausência é
proposital: `esta_ignorado` e `excecao_de` são importadas com nome privado
(`_esta_ignorado`, `_excecao_de`), e `import *` não leva nome que começa com
`_`. Elas moram no arquivo que as usa — `_apoio.py` e `_grep.py` —, que é onde
alguém vai procurá-las de qualquer forma.
"""

import os
import json

from modulos.caminhos import obter_pasta_da_rotina
from modulos.padroes_de_fabrica import PADROES_DAS_FERRAMENTAS
from modulos.tokens import contar_tokens, cortar_em_tokens
from modulos.agentes import partes_artefato
from modulos.ignorados import LEITOR_LM_STUDIO, LEITOR_ASSISTENTE_EXTERNO

# Os tetos das ferramentas moram em `padroes_de_fabrica.py::PADROES_DAS_FERRAMENTAS`
# e são lidos de `settings.json` por `_sub_limite`. Aqui ficou só o que NÃO é
# configurável: os bytes de sondagem de binário e a lista de extensões binárias.

# ── Tetos em TOKENS ──────────────────────────────────────────────────────────
# Eram em linha e em caractere, e a unidade estava errada: o que estes tetos
# protegem é a janela do LM Studio, e janela se mede em token. 400 linhas de CSS
# e 400 linhas de Python denso não custam a mesma coisa.
#
# ⚠️ O teto do ler_arquivo é FUSÍVEL, não política de leitura. Medido nos 220
# arquivos de código deste projeto: 97% cabem em 10.000 tokens e 99% em 15.000.
# O maior escrito à mão tem 11.410; o único acima do teto é uma biblioteca
# minificada, com ~79.916. Ele não encosta em 219 dos 220 arquivos — existe para
# que o monstro esquecido corte e avise, em vez de matar a chamada inteira com um
# 400 que levaria junto todo o trabalho já feito nela.
# Acima disto, o artefato com fronteira natural passa a ser servido em partes.
# A maior parte medida tem 3.455 tokens, então nenhuma precisa de sub-divisão.
# Quantas subpastas o "." mostra por pasta de trabalho. É orientação, não
# catálogo: o suficiente para o modelo saber por onde entrar, sem transformar a
# primeira chamada do Navegador num despejo da árvore inteira.

# O grep NÃO tem lista de extensões permitidas. A lista era de 23 extensões e
# tornava invisível todo arquivo .sh, .ps1, .sql, .vue, .rb, .kt… — e linguagem
# nova só passava a funcionar se alguém lembrasse de cadastrar aqui.
# A arquitetura modular já garante que dentro da pasta de código só existe
# código, então o que precisa ser filtrado é binário, não "linguagem
# desconhecida". Daí a inversão: bloqueia-se o que é sabidamente binário e
# confere-se byte zero no começo do arquivo; o resto passa.
#
# Desde 21/08/2026 esta constante tem TRÊS papéis, e nenhum deles substitui os
# outros:
#
#   1. SEMENTE — a lista de fábrica de `extensoes_ignoradas` (a tela
#      Configurações → "Arquivos que o programa lê › Nunca ler") nasce daqui, para o
#      usuário VER quais são. Antes elas eram invisíveis, só existiam neste
#      arquivo, e ninguém de fora do código sabia o que o grep pulava.
#   2. PISO — a constante continua barrando, por si. Nada que o usuário faça
#      nas listas da tela faz o grep tentar ler um `.exe`: esvaziar
#      `extensoes_ignoradas` não desarma isto aqui.
#   3. FURO — o ÚNICO jeito de liberar uma delas é a coluna **agentes** da
#      tabela de exceções, testada no grep logo abaixo. É deliberadamente o
#      caminho estreito: uma extensão por vez, escrita à mão.
#
# ⚠️ A segunda barreira — `_sub_parece_binario`, o byte zero nos primeiros
# `GREP_BYTES_SNIFF` bytes — não tem furo nenhum e é ela a proteção de verdade.
# Esta lista é atalho de desempenho: evita abrir o arquivo para descobrir o que
# a extensão já dizia.
BINARY_EXTS = {
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.icns', '.webp', '.tiff',
    '.svgz', '.pdf', '.zip', '.gz', '.tar', '.rar', '.7z', '.bz2', '.xz',
    '.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o', '.a', '.lib',
    '.pyc', '.pyo', '.pyd', '.class', '.jar', '.wasm',
    '.db', '.sqlite', '.sqlite3', '.mdb', '.onnx', '.pt', '.pth', '.safetensors',
    '.woff', '.woff2', '.ttf', '.otf', '.eot',
    '.mp3', '.wav', '.ogg', '.flac', '.mp4', '.avi', '.mov', '.mkv', '.webm',
    '.psd', '.ai', '.blend', '.fbx', '.lock',
}
GREP_BYTES_SNIFF = 1024

BUSCA_SEMANTICA_TIPOS = ('documentacao-tecnica', 'resumo-pastas')

# ── A leitura POR SEÇÃO (Documentação técnica e Resumo de pastas) ──
# A chave de cada seção é o que o modelo escreve em `ler`; o valor é o título
# `## …` exato do `.md` que a rotina grava (`documentacao_tecnica_render.py`,
# `resumo_pastas_estado.py`). A ORDEM é a do `.md`, e é a ordem de `tudo`.
# Sem acento e minúsculas de propósito: é o que o modelo digita sem errar.
# Os nomes são SEMPRE estes; a seção que um arquivo não tem não é erro.
SECOES_DOC_TECNICA = {
    'sintese':     'Síntese',
    'atribuicoes': 'Atribuições',
    'metadados':   'Metadados',
    'termos':      'Termos do projeto',
    'simbolos':    'Símbolos',
    'conexoes':    'Conexões',
}
SECOES_RESUMO_PASTAS = {
    'papel':    'Papel da pasta',
    'arquivos': 'Arquivos e responsabilidades',
    'simbolos': 'Símbolos exportados principais',
    'internas': 'Conexões internas',
    'externas': 'Conexões externas',
}
SECAO_TUDO = 'tudo'
# O exemplo que volta no erro de quem pede sem dizer a seção. O prompt e a
# descrição do MCP têm o deles; este é o do erro, e por isso é curto.
EXEMPLO_LER_DOC_TECNICA = (
    '"ler": {"Program/Code/backend/modulos/chat.py": "sintese", '
    '"Program/Code/frontend/app.js": "sintese,simbolos", '
    '"Program/Code/server/assistente/servidor.py": "tudo"}')
EXEMPLO_LER_RESUMO_PASTAS = (
    '"ler": {".": "papel", "Program/Code/backend/modulos/agentes": "arquivos"}')

FERRAMENTAS_POR_SUBAGENTE = {
    'buscador':  ['grep', 'ler_indice', 'ler_doc_tecnica', 'ler_glossario'],
    'leitor':    ['ler_arquivo', 'ler_doc_tecnica'],
    'arquiteto': ['ler_pipeline', 'ler_resumo_pastas', 'ler_arquivo'],
    'analista':  ['grep', 'ler_grafo_imports', 'ler_indice', 'ler_doc_tecnica',
                  'ler_arquivo', 'ler_relacoes'],
    'semantico': ['busca_semantica', 'ler_doc_tecnica'],
    # ── Fila (Assistente/Fila/) ──
    # O agente principal da Fila não aparece aqui: ele chama SUBAGENTES, não
    # ferramentas. Quem tem ferramenta é o Verificador, e são só as duas de
    # CONFERIR pelo código. Uma extensão ligada pode lhe emprestar mais uma
    # (`subagentes_do_programa`, fase 07) — é como ele volta a conferir as
    # decisões do projeto. As de descobrir (busca_semantica, ler_indice,
    # ler_pipeline, ler_resumo_pastas, ler_grafo_imports, ler_doc_tecnica,
    # ler_relacoes) ficam fora de propósito: com elas ele vira um segundo
    # pesquisador, e voltam dois agentes discutindo entre si.
    'fila-verificador': ['ler_arquivo', 'grep'],
}

# ── Subagente de EXTENSÃO (fase 12, D39; ampliado na fase 07, D51) ──
# Desde a fase 07 o item do manifesto PODE declarar `ferramentas`: as do
# programa e as que a própria extensão atende (recurso `ferramenta`). Sem a
# lista, recebe as do ANALISTA, como antes: é o conjunto de leitura mais
# largo que não depende do id. Todas são de LEITURA — nenhuma ferramenta de
# subagente escreve.
SUBAGENTE_MODELO_DE_EXTENSAO = 'analista'


def eh_subagente_de_extensao(nome):
    """O id tem a forma `{prefixo}.{nome}` do manifesto das extensões. Os do
    programa nunca têm ponto — é o que deixa esta conferência ser só texto,
    sem ler o disco a cada ferramenta."""
    return isinstance(nome, str) and '.' in nome


def ferramentas_do_subagente(nome):
    """A lista de ferramentas que `nome` pode chamar.

    - id do programa: a linha de `FERRAMENTAS_POR_SUBAGENTE`, MAIS as que uma
      extensão ligada lhe empresta (`subagentes_do_programa` no item
      `ferramenta`, fase 07 — é assim que o Verificador da Fila ganha uma
      ferramenta de extensão sem o núcleo saber qual);
    - id de extensão: as que o item declara em `ferramentas`, ou as do
      Analista.

    ⚠️ O subagente de extensão não é conferido aqui como LIGADO: quem conferiu
    foi `executar_subagente`, antes de ele começar. Desligar a extensão no
    meio de uma chamada não a derruba — a próxima é que não começa."""
    if nome in FERRAMENTAS_POR_SUBAGENTE:
        proprias = list(FERRAMENTAS_POR_SUBAGENTE[nome])
        return proprias + [f for f in _emprestadas_a(nome) if f not in proprias]
    if eh_subagente_de_extensao(nome):
        declaradas = _declaradas_por(nome)
        if declaradas:
            return declaradas
        return list(FERRAMENTAS_POR_SUBAGENTE[SUBAGENTE_MODELO_DE_EXTENSAO])
    return []


def _emprestadas_a(nome):
    """Os nomes das ferramentas de extensão LIGADA emprestadas ao subagente do
    programa `nome`. Import tardio (a camada de extensões lê este arquivo) e
    nunca lança: falhar ao ler as extensões é não ter empréstimo."""
    try:
        from modulos.extensoes.agentes import ferramentas_de_extensoes
        return [f['nome'] for f in ferramentas_de_extensoes()
                if nome in f['subagentes_do_programa']]
    except Exception as e:
        print('[subagentes] falha ao ler as ferramentas de extensão:', e)
        return []


def _declaradas_por(nome):
    """A lista `ferramentas` do subagente de extensão `nome`, ou `None` se
    nenhuma extensão ligada o declara."""
    try:
        from modulos.extensoes.agentes import subagentes_de_extensoes
        for s in subagentes_de_extensoes():
            if s['id'] == nome:
                return list(s['ferramentas'])
    except Exception as e:
        print('[subagentes] falha ao ler os subagentes de extensão:', e)
    return None

# O texto da aba Ferramentas, para o usuário — não é prompt, o modelo nunca lê
# isto. A tabela da tela é GERADA daqui e de FERRAMENTAS_POR_SUBAGENTE, nunca
# digitada: uma tabela escrita à mão envelhece no primeiro dia em que alguém
# mexe no dicionário acima e esquece da tela.
# Sem coluna de custo de propósito: custo varia com projeto e com modelo, e
# número que envelhece numa tela informativa é pior que número nenhum.
# O "se errar" é escrito em forma de seta — *o que deu errado* → *o que volta* —
# porque numa tabela ele é lido de relance, não em prosa. Frase inteira aqui vira
# um parágrafo dentro de uma célula estreita.
FERRAMENTAS_DESCRICAO = {
    'grep': ('Linhas que contêm o termo, com arquivo e número',
             'termo vazio → o aviso; nada encontrado → diz onde procurou'),
    'ler_arquivo': ('O arquivo, numerado por linha',
                    'fora do escopo ou removido → diz qual dos dois; '
                    'grande demais → corta e avisa quanto ficou de fora'),
    'ler_indice': ('O índice de navegação, em partes por pasta',
                   'sem parte → lista as partes; parte errada → 5 parecidas'),
    'ler_pipeline': ('O Pipeline em níveis: Visão geral → área → bloco → cadeia, '
                     'ou as cadeias que passam por um arquivo',
                     'sem parte → a Visão geral; id errado → os ids do nível; '
                     'nível grande → em páginas'),
    'ler_grafo_imports': ('Quem importa quem, em partes por pasta',
                          'sem parte → lista as partes; parte errada → 5 parecidas'),
    'ler_resumo_pastas': ('O que cada pasta faz, por seção (papel, arquivos, símbolos, '
                          'conexões internas e externas) — de várias pastas numa chamada',
                          'sem "ler" → o exemplo e a lista das pastas; seção que a pasta '
                          'não tem → diz que não existe; não coube → o "ler" do resto'),
    'ler_doc_tecnica': ('A documentação de arquivos, por seção (síntese, atribuições, '
                        'metadados, termos, símbolos com a linha, conexões) — de vários '
                        'arquivos numa chamada',
                        'sem "ler" ou sem seção → o erro com o exemplo; caminho '
                        'inexistente → 5 parecidos; não coube → o "ler" do resto'),
    'ler_glossario': ('Os termos próprios do projeto: a linha de um termo, ou um tópico inteiro',
                      'termo fora do glossário → diz isso e lista os tópicos'),
    'ler_relacoes': ('Quem chama e quem é chamado por um arquivo',
                     'fora do grafo → diz isso, listando os candidatos'),
    'busca_semantica': ('Os trechos mais próximos em sentido, com a origem',
                        'embedding não gerado → diz qual agente gera'),
    'listar_pasta': ('Só os nomes do que existe numa pasta, sem recursão',
                     'pasta inexistente ou fora do escopo → diz qual dos dois'),
}

