"""Onde as extensões do programa moram, e os nomes fixos dentro de cada uma.

Uma EXTENSÃO DO PROGRAMA não é um plugin e não é uma extensão de arquivo:

  - **Plugin** (`External/plugins/`) só LÊ o programa e desenha numa aba
    própria. Não muda o comportamento de nada.
  - **Extensão de arquivo** (`.py`, `.js`) é a terminação do nome de um
    arquivo, e a categoria de Configurações que fala dela chama-se
    "Arquivos que o programa lê". Nada a ver com esta.
  - **Extensão do programa** (aqui) MUDA o comportamento do programa: entrega
    tela, encaixa-se em ponto existente, reage a evento, responde a consulta
    ou traz conteúdo (ícones, gramáticas, subagentes) — ver os 4 tipos e os 12 recursos
    abaixo.

⚠️ O prefixo de código desta camada é `xt`, e nunca `ext`: o frontend não tem
escopo de módulo, e `_ext*` já é da tela de extensões de ARQUIVO
(`_extNunca`, `_extCodigo`, `_extDesenharTudo`…). Um `_extAlgo` novo
sobrescreveria o antigo em silêncio, e aquela tela pararia de funcionar sem
erro nenhum.
"""

import os
import re
import hashlib
import unicodedata

from ..constantes import CODE_DIR

# Pasta-raiz das extensões — irmã de `External/plugins/`, mesma exceção de
# arquitetura: é código do próprio usuário num balde de terceiro, porque a
# natureza do recurso (plugável, opcional, isolado do núcleo) pesa mais que o
# critério de autoria. Ver Saída das skills/Arquitetura modular/Exceções.md.
EXTENSOES_DIR = os.path.abspath(os.path.join(CODE_DIR, '..', 'External', 'extensions'))

# Quem está ligado — `{caminho relativo: {"ligado": bool}}`. Só isso: ao
# contrário do plugin, uma extensão não escolhe "onde aparece" (D12), quem
# escolhe é o `tipos` do manifesto dela.
#
# ⚠️ Os três arquivos se chamaram `extensoes-do-programa*.json` até
# 23/09/2026: o nome `extensoes.json` era da lista de ignorados. Ele ficou
# livre quando os ignorados viraram "Nunca ler", e o boot renomeia os três
# (`configuracoes_arquivos.migrar_nomes_de_config`) — só DEPOIS de migrar a
# lista antiga, senão ela seria sobrescrita.
EXTENSOES_CONFIG_FILE = 'extensoes.json'
# A ordem arrastada, por nível — `{pasta pai: [nomes]}`, `''` é a raiz.
EXTENSOES_ORDER_FILE = 'extensoes-ordem.json'
# O "Destacar extensões" (D2) — o interruptor E a aparência dele. Arquivo
# próprio, e não uma chave em `settings.json`, para `reset_extensoes_programa`
# conseguir restaurá-lo junto do resto da categoria sem passar por
# `restaurar_padroes`.
EXTENSOES_DESTAQUE_FILE = 'extensoes-destaque.json'

# As cores oferecidas são NOMES DE TOKEN, nunca hexadecimais: o valor real sai
# do tema em execução (`estilos/tema/tema-*.css`), e um hex gravado aqui
# ficaria errado no primeiro tema claro. O frontend monta
# `rgba(var(--{cor}-rgb), …)` a partir deste nome.
#
# ⚠️ Roxo é o padrão de propósito. O programa já usa azul para "acontecendo
# agora", verde para "terminou" e âmbar para "terminou faltando pedaço"; roxo
# é a cor que sobra sem significado de estado, e por isso não compete com
# nenhuma leitura que o usuário já tem. As outras cinco existem porque a
# escolha é dele — mas o padrão não é arbitrário.
XT_DESTAQUE_CORES = ('purple', 'blue', 'green', 'amber', 'red', 'teal')

# Como o destaque desenha. Quatro formas, da mais discreta à mais gritante —
# quem está caçando uma extensão perdida numa tela cheia quer a gritante, quem
# só quer saber de onde veio aquele painel quer a discreta.
XT_DESTAQUE_TIPOS = ('tracejado', 'solido', 'fundo', 'barra')

XT_DESTAQUE_PADRAO = {'destacar': False, 'cor': 'purple', 'tipo': 'tracejado'}

# É a presença DESTE arquivo que faz uma pasta ser extensão. Sem ele a pasta é
# categoria, e o scanner desce nela. (Mesma regra do Plugin, que também tem
# manifesto, o `plugin.json`.)
XT_MANIFESTO = 'extensao.json'

XT_FRONTEND_ENTRY = os.path.join('frontend', 'index.js')
XT_BACKEND_ENTRY = os.path.join('backend', 'extensao.py')
XT_FUNC_EXECUTAR = 'executar'

# Na RAIZ da extensão, nunca em `backend/` — a presença do arquivo é o único
# sinal de que a extensão roda sozinha. Precisa expor `iniciar()` E `parar()`:
# ao contrário do plugin, aqui o programa desliga de verdade em vez de deixar
# uma thread viva relendo o próprio estado para sempre.
XT_BOOT_ENTRY = 'extensao_boot.py'
XT_FUNC_INICIAR = 'iniciar'
XT_FUNC_PARAR = 'parar'

# `config/` guarda o que o USUÁRIO escolheu; `files/` o que a extensão gera.
# Nunca o contrário — ver o contrato em prompts/Como adicionar/Extensões/Contrato/Como criar extensões.md.
XT_TELA = os.path.join('config', 'tela.json')
XT_PREFERENCIAS = os.path.join('config', 'preferencias.json')

XT_ICONE = 'icone.svg'

# Quantos segundos o programa espera o `parar()` de uma extensão antes de
# seguir em frente. Passado o teto, avisa no `print` e continua: uma extensão
# que não sabe parar não pode impedir o usuário de desligar a próxima.
XT_TETO_PARAR_S = 5

# Quantos segundos o programa espera, NO TOTAL, as extensões pararem quando a
# janela é fechada. É um orçamento único e não `N × XT_TETO_PARAR_S`: o
# usuário fechou a janela e a intenção é parar tudo agora — dez extensões
# teimosas não podem segurar o processo por cinquenta segundos. Ver
# `boot.parar_todas`.
XT_TETO_FECHAR_S = 5

# G12 · Quanto a ponte espera o `executar` de uma extensão. Passado o teto, a
# tela recebe {success: False} com o NOME da extensão; a thread dela não é
# morta (matar deixaria arquivo meio escrito) — só deixa de segurar a tela.
XT_TETO_PONTE_S = 30

# G12 · Quanto o programa espera, NO TOTAL, as extensões importarem ao abrir
# (e cada uma, ao ligar). Quem passar continua carregando em segundo plano —
# thread em Python não se mata; o teto só para de ESPERAR.
XT_TETO_CARGA_S = 5

# Os quatro TIPOS (D43, D45): a CATEGORIA da extensão — o que ela é capaz de
# fazer, informação para a hora de construir. Número EM TEXTO no manifesto
# (P8: o nome só aparece na tela). Uma extensão pode ser mais de um tipo.
XT_TIPOS = {
    '1': 'Tela própria',
    '2': 'Muda uma tela',
    '3': 'Muda um comportamento',
    '4': 'Acrescenta conteúdo',
}
XT_TIPOS_VALIDOS = frozenset(XT_TIPOS)
# O "O que faz" de cada tipo — a mesma frase da tabela dos quatro tipos do
# contrato (`Como criar extensões.md`). A página da extensão a mostra ao pôr
# o mouse sobre o tipo (fase 13).
XT_TIPOS_O_QUE_FAZ = {
    '1': 'ganha uma tela só dela — aba nova, ou sub-aba numa aba que já existe',
    '2': 'acrescenta função numa tela que já existe',
    '3': 'age sem tela: roda sozinha, ou reage ao que o programa faz',
    '4': 'entrega um conteúdo que o programa usa mas não tem',
}

# Os doze RECURSOS (D38, D39, D41; `ferramenta` e `prompt` desde a fase 07 da
# discussão «Qualidade da documentação», D51 e D52): as peças da lista `acrescenta` — cada tela,
# painel, comando, reação… que a extensão põe no programa. `pronto` diz se o
# programa já sabe receber; os outros são recusados POR ITEM, com o nome da
# fase que os traz (`XT_RECURSOS_FASE`), e o resto da extensão liga.
# "Em segundo plano" evita "Rotina" e "Trabalho", que já são outras coisas.
XT_RECURSOS = {
    'tela':          {'nome': 'Tela',               'pronto': True},
    'painel':        {'nome': 'Painel',             'pronto': True},
    'comando':       {'nome': 'Comando',            'pronto': True},
    'marca':         {'nome': 'Marca no código',    'pronto': True},
    'segundo-plano': {'nome': 'Em segundo plano',   'pronto': True},
    'reacao':        {'nome': 'Reação',             'pronto': True},
    'editor':        {'nome': 'Recursos do Editor', 'pronto': True},
    'visual':        {'nome': 'Visual',             'pronto': True},
    'agente':        {'nome': 'Agente',             'pronto': True},
    # Fase 07 (D51): uma ferramenta que o subagente chama e o backend DA
    # EXTENSÃO atende — dela, ou emprestada a um subagente do programa.
    'ferramenta':    {'nome': 'Ferramenta',         'pronto': True},
    # Fase 07 (D52): um texto que entra num prompt do programa enquanto a
    # extensão está ligada. «Trecho de prompt», e não «trecho pronto» (o
    # snippet do Editor, que é outra coisa).
    'prompt':        {'nome': 'Trecho de prompt',   'pronto': True},
    'opcoes':        {'nome': 'Opções',             'pronto': True},
}
XT_RECURSOS_FASE = {'tela': 11, 'agente': 12}

# As partes de Recursos do Editor e de Visual que o programa já recebe. O que
# cada uma vira POR DENTRO (pasta ou arquivo, a consulta, a chave interna de
# `dados`) mora em `validacao.py` e `dados.py`, que são quem usa.
#   cor        — uma PASTA de gramáticas (dado)
#   sugestoes, dica, formatacao — um `arquivo` .js que RESPONDE (consulta)
#   trechos    — um `arquivo` .json (dado, sem código)
XT_EDITOR_PARTES = {'cor': 'cor do código', 'sugestoes': 'sugestões ao digitar',
                    'dica': 'dica ao passar o mouse', 'formatacao': 'formatação',
                    'trechos': 'trechos prontos'}
# ⚠️ Uma parte só, e é AQUI que um visual novo entra (D41): uma linha neste
# catálogo + um consumidor na tela que o leia de `list_dados_de_extensoes`
# (pelo `recurso`/`parte` da entrada). Não invente uma parte sem pedido — a
# extensão existe para o que o programa NÃO tem (P9, D37).
XT_VISUAL_PARTES = {'icones': 'ícones das listas de arquivo'}

# As duas FORMAS do recurso Agente (D39). `oficina` aparece no popover de
# "＋ Terminal" da Oficina; `subagente` é chamado pelo agente do Chat e da
# Fila, como os subagentes do programa (desde 23/09/2026). A conferência de
# cada forma mora em `validacao_agente.py`.
XT_AGENTE_FORMAS = {'oficina': 'agente da Oficina', 'subagente': 'subagente do Chat e da Fila'}
XT_AGENTE_FORMAS_PRONTAS = frozenset({'oficina', 'subagente'})
# O trio que a `pasta` de um subagente de extensão tem — o mesmo que o
# programa tem por subagente (`prompts/Assistente/Subagentes/{Pasta}/` + o
# `Blocos/{id}.txt`), numa pasta só.
XT_SUBAGENTE_ARQUIVOS = ('system-prompt.txt', 'prompt-correcao.txt', 'bloco.txt')
# As fontes que um card de subagente sabe mostrar (`agentes-fontes.js`).
XT_SUBAGENTE_FONTES = ('codigo', 'doc-gerada', 'saida-skills')

# ── O contrato ampliado dos subagentes de extensão (fase 07, D51, D52) ──
# As três ações que o PROGRAMA — e não a tela da extensão — manda à porta
# `executar(payload)` dela. O `xt.` na frente é reservado: uma ação da
# própria extensão nunca começa por ele.
XT_ACAO_FERRAMENTA = 'xt.ferramenta'
XT_ACAO_PROMPT = 'xt.prompt'
XT_ACAO_ENVELOPE = 'xt.envelope'
# Onde o trecho de prompt de uma extensão entra num prompt do programa.
# Sem o marcador no arquivo, o trecho vai no fim; sem trecho, o marcador
# some junto com a linha dele (`extensoes/prompts.aplicar_acrescimos`).
XT_MARCADOR_ACRESCIMOS = '{acrescimos_das_extensoes}'
# O nome de uma ferramenta própria: o que o modelo escreve em `{"nome": …}`,
# do mesmo jeito das do programa (`ler_arquivo`) — minúsculas, dígitos e `_`.
XT_FERRAMENTA_NOME_RE = re.compile(r'^[a-z][a-z0-9_]{2,39}$')
# As cores que um subagente de extensão pode escolher (`"cor"` no item):
# cada uma é o token `--sub-cor-{nome}` dos cinco temas. Fora da lista, a
# cor padrão (`--purple`, a de "acréscimo" no contrato, parte 18).
XT_SUBAGENTE_CORES = ('violeta', 'indigo', 'rosa', 'turquesa')

# O DONO de uma extensão (D40, D42): curto, só letras minúsculas, sem acento.
# ⚠️ Não é o slug (`slug_da_extensao`, derivado do caminho): o slug continua
# sendo a chave de tudo que já existe — ids de DOM, `window.xtMontar_{slug}`,
# a chave de tecla `xt:{slug}:{id}`. O prefixo só serve para conferir conflito.
XT_PREFIXO_RE = re.compile(r'^[a-z]{2,6}$')
XT_PREFIXOS_PROIBIDOS = frozenset({'xt', 'ext', 'pb'})
XT_ID_RE = re.compile(r'^[a-z0-9-]+$')     # a parte depois de "{prefixo}."

# Compatibilidade (D36): o número ANTIGO → o tipo NOVO, para o manifesto sem
# `acrescenta` continuar ligando. `None` = aceito e ignorado (o antigo 2 era
# "Categoria de Configurações", e a página é de toda extensão). Número fora
# daqui e fora dos removidos = erro.
XT_TIPOS_ANTIGOS = {
    '2': None, '4': '3', '7': '2', '8': '2', '9': '3', '11': '4',
    '12': '2', '16': '3', '17': '3', '24': '4', '27': '4',
}
# P9, D37: o programa já configura tema e presets — extensão não os traz mais.
XT_TIPOS_ANTIGOS_REMOVIDOS = {'23': 'Tema', '25': 'Preset de modelo',
                              '26': 'Preset de Acervo'}


def catalogo_de_tipos():
    """`{numero: {nome, faz}}` para os 4 — o frontend recebe isto em vez de
    repetir a tabela em JavaScript."""
    return {n: {'nome': nome, 'faz': XT_TIPOS_O_QUE_FAZ.get(n, '')}
            for n, nome in XT_TIPOS.items()}


def catalogo_de_recursos():
    """`{chave: {nome, pronto}}` para os 10 — mesma razão de
    `catalogo_de_tipos`."""
    return {k: {'nome': v['nome'], 'pronto': v['pronto']} for k, v in XT_RECURSOS.items()}


def caminho_absoluto(caminho_relativo):
    """O caminho em disco de uma extensão, a partir do caminho relativo que
    trafega no JSON e no frontend (sempre com `/`, nunca o separador do SO)."""
    return os.path.join(EXTENSOES_DIR, caminho_relativo.replace('/', os.sep))


def caminho_relativo_e_seguro(caminho_relativo):
    """O caminho que veio do frontend fica DENTRO de `External/extensions/`?

    O frontend manda o caminho relativo em três portas (`chamar_extensao`,
    `save_preferencias_extensao`, `save_config_extensao_programa`), e todas
    passam por `extensao_existe`, que exige um `extensao.json` no destino —
    isso já limita muito o alcance de um `../..`. Mas a defesa ficava
    indireta: um chamador novo que esquecesse o `extensao_existe` abriria a
    travessia. Aqui a regra é explícita, e é a mesma que `validar_encaixes`
    já aplica ao `arquivo` de um encaixe.
    """
    if not isinstance(caminho_relativo, str) or not caminho_relativo:
        return False
    partes = caminho_relativo.replace('\\', '/').split('/')
    return not caminho_relativo.startswith('/') and '..' not in partes and '' not in partes


def eh_pasta_de_extensao(caminho_abs):
    """Folha, para `arvore_externa`: uma PASTA com `extensao.json` na raiz.
    Um arquivo solto em `External/extensions/` é ignorado."""
    return (os.path.isdir(caminho_abs)
            and os.path.isfile(os.path.join(caminho_abs, XT_MANIFESTO)))


def erro_do_arquivo_declarado(caminho_relativo, arquivo, rotulo):
    """Confere um `arquivo` que o manifesto declarou (num encaixe, numa
    assinatura de evento, numa consulta). Devolve a mensagem de erro, ou
    `None` se o arquivo está dentro da pasta da extensão e existe.

    Uma função só para os três validadores: até 05/09/2026 as mesmas quatro
    linhas existiam em `encaixes.py`, `eventos.py` e `consulta.py`, e a
    próxima regra sobre `arquivo` teria de ser escrita três vezes.

    O caminho é relativo à pasta da extensão e sempre com `/`, como todo
    caminho que trafega no manifesto. `..` sairia da pasta dela — e uma
    extensão que carrega arquivo de fora não é mais uma pasta que se pode
    mover, copiar ou apagar inteira.

    Conferido no servidor, e não deixado para o 404 do <script>: um erro de
    carregamento de script aparece só no console do DevTools, que o usuário
    desta camada não tem por que abrir.
    """
    if not arquivo:
        return '%s: falta o `arquivo` que define a função.' % rotulo
    if arquivo.startswith('/') or '..' in arquivo.replace('\\', '/').split('/'):
        return ('%s: `arquivo` precisa ficar dentro da pasta da extensão '
                '(sem `..` e sem barra inicial).' % rotulo)
    raiz = caminho_absoluto(caminho_relativo)
    if not os.path.isfile(os.path.join(raiz, arquivo.replace('/', os.sep))):
        return '%s: o arquivo "%s" não existe na pasta da extensão.' % (rotulo, arquivo)
    return None


def slug_da_extensao(caminho_relativo):
    """O apelido curto que vira ID de DOM (`xt-script-{slug}`,
    `config-secao-xt-{slug}`) e sufixo de função (`window.xtMontar_{slug}`).

    Três exigências, e cada uma explica um pedaço:
      - **Identificador JavaScript válido** — só letra, dígito e `_`, nunca
        `-`, senão `window.xtMontar_{slug}` não seria escrevível como nome.
      - **Estável entre execuções** — daí `md5` e não o `hash()` do Python,
        que muda a cada processo. O frontend guarda o slug em ids de DOM.
      - **Único** — duas extensões chamadas "Ícones" em categorias diferentes
        normalizam para o mesmo texto; o sufixo do caminho inteiro separa.
    """
    base = unicodedata.normalize('NFKD', caminho_relativo)
    base = base.encode('ascii', 'ignore').decode('ascii')
    base = re.sub(r'[^A-Za-z0-9]+', '_', base).strip('_').lower() or 'ext'
    sufixo = hashlib.md5(caminho_relativo.encode('utf-8')).hexdigest()[:6]
    return '%s_%s' % (base, sufixo)
