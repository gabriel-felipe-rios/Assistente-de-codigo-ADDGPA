"""Lê o Vocabulário do projeto aberto e devolve duas listas de palavras."""

import os
import re

# O caminho do Vocabulário, relativo à raiz onde ele mora.
_RELATIVO = os.path.join('Saída das skills', 'Terminologia e nomenclatura',
                         'Vocabulário.md')
# Desde 2026-09 o Vocabulário pode ter virado PASTA (`Vocabulário/`, um arquivo
# por tema, ao lado de um `Vocabulário.md` que é só ponteiro). Aí os verbetes
# estão nos temas — e o índice e o histórico da pasta não são verbete.
_PASTA = os.path.join('Saída das skills', 'Terminologia e nomenclatura',
                      'Vocabulário')
_NAO_E_TEMA = ('Índice', 'Histórico')

# Quantos níveis subir procurando pela pasta `Saída das skills`.
#
# ⚠️ A base de conhecimento nem sempre está DENTRO da pasta de código. Num
# projeto cuja pasta de código é `.../MeuApp/src`, ela mora em `.../MeuApp`. Um
# número fixo de níveis não serviria; subir procurando, sim — e três níveis é o
# suficiente para os arranjos que existem, sem sair varrendo o disco.
_NIVEIS = 3

# Só o que está entre crases nessas duas linhas. O resto delas é prosa em
# português, e marcar prosa como "termo do Vocabulário" encheria todo arquivo
# de sublinhado sem dizer nada. As duas grafias: `Nome canônico:` / `Nunca
# usar:` (verbetes antigos) e `Canônico:` / `Nunca:` (o formato de cinco
# linhas, desde 2026-09).
_LINHA_CANONICO = re.compile(r'^(?:Nome )?can[ôo]nico\s*:', re.IGNORECASE)
_LINHA_PROIBIDO = re.compile(r'^Nunca(?: usar)?\s*:', re.IGNORECASE)
_EM_CRASE = re.compile(r'`([^`]+)`')

# Palavra solta demais para virar marca. Um sublinhado em `a` ou em `de` seria
# ruído puro.
_MINIMO = 3


def _achar_vocabulario(raiz):
    """Os arquivos do Vocabulário, subindo a partir da pasta de código.

    Se existir a pasta `Vocabulário/`, são os temas dela (sem o índice e sem
    o histórico); senão, o `Vocabulário.md` sozinho. Lista vazia = não há
    Vocabulário."""
    atual = os.path.abspath(raiz)
    for _ in range(_NIVEIS + 1):
        pasta = os.path.join(atual, _PASTA)
        if os.path.isdir(pasta):
            temas = sorted(os.path.join(pasta, n) for n in os.listdir(pasta)
                           if n.lower().endswith('.md') and not n.startswith(_NAO_E_TEMA))
            if temas:
                return temas
        candidato = os.path.join(atual, _RELATIVO)
        if os.path.isfile(candidato):
            return [candidato]
        pai = os.path.dirname(atual)
        if pai == atual:
            break
        atual = pai
    return []


def _termos_da_linha(linha):
    """As crases da PRIMEIRA oração da linha, e só dela.

    ⚠️ A parte depois do travessão, do ponto-e-vírgula ou do ponto final é
    PROSA, e a prosa cita termos que não são o assunto da linha. Um exemplo
    real, do Vocabulário deste projeto:

        Nunca usar: `os.path.join(PROJECTS_DIR, ...)` montado à mão — era assim
        em 75 pontos e é o que a existência de `caminhos.py` proíbe.

    Sem este corte, `caminhos.py` — que é justamente o jeito CERTO — apareceria
    riscado no código inteiro. Perder um termo legítimo que estava depois do
    corte é o erro barato; riscar o certo é o caro.
    """
    depois = linha.split(':', 1)[1] if ':' in linha else linha
    for fim in (' — ', ' – ', ';', '. '):
        corte = depois.find(fim)
        if corte >= 0:
            depois = depois[:corte]
    return [t.strip() for t in _EM_CRASE.findall(depois) if len(t.strip()) >= _MINIMO]


def _ler(caminhos):
    """`(termos, proibidos, sugestoes)` — `sugestoes` liga cada proibido ao
    nome que a MESMA entrada do Vocabulário manda usar: o `Canônico` dela,
    ou o título. É o que faz a modal poder dizer "não use X, use Y" em vez de
    só riscar. `caminhos` é a lista de arquivos (um, ou um por tema)."""
    termos, proibidos = [], []
    sugestoes = {}
    for caminho in caminhos:
        _ler_um(caminho, termos, proibidos, sugestoes)
    # Um termo que está nas duas listas é PROIBIDO — o "Nunca usar" é a decisão
    # mais forte, e riscar diz mais que sublinhar.
    proibidos_set = set(proibidos)
    termos = [t for t in dict.fromkeys(termos) if t not in proibidos_set]
    return termos, list(dict.fromkeys(proibidos)), sugestoes


def _ler_um(caminho, termos, proibidos, sugestoes):
    """Acrescenta às três listas o que há num arquivo do Vocabulário."""
    # O que a entrada atual manda usar: o primeiro termo do `Nome canônico`,
    # senão o título dela.
    titulo_atual = ''
    canonico_atual = ''
    # `errors='replace'`: um Vocabulário salvo em latin-1 não pode derrubar a
    # leitura inteira com um `UnicodeDecodeError` que a ponte devolveria como
    # "Erro dentro da extensão" — sem dizer que o problema é a codificação.
    # Um termo com um caractere trocado é o erro barato.
    with open(caminho, 'r', encoding='utf-8', errors='replace') as f:
        for linha in f:
            linha = linha.strip()
            if linha.startswith('### '):
                # O título da entrada. Corta no travessão: "Plugin — tipo e
                # pontos de entrada" é UM conceito, e o nome dele é "Plugin".
                # E nos dois-pontos, pelo mesmo motivo: "Plugin: o que é" não
                # é um termo, e entraria na expressão sem casar com nada.
                titulo = linha[4:].split('—')[0].split(' - ')[0].split(':')[0].strip()
                titulo = titulo.split('(')[0].strip()
                titulo_atual, canonico_atual = titulo, ''
                if len(titulo) >= _MINIMO:
                    termos.append(titulo)
            elif _LINHA_CANONICO.match(linha):
                da_linha = _termos_da_linha(linha)
                if da_linha and not canonico_atual:
                    canonico_atual = da_linha[0]
                termos.extend(da_linha)
            elif _LINHA_PROIBIDO.match(linha):
                da_linha = _termos_da_linha(linha)
                use = canonico_atual or titulo_atual
                for p in da_linha:
                    if use and p not in sugestoes:
                        sugestoes[p] = use
                proibidos.extend(da_linha)


def vocabulario(payload):
    raiz = payload.get('pasta_projeto')
    if not raiz or not os.path.isdir(raiz):
        # Projeto sem pasta de código: nada a fazer, e não é erro.
        return {'success': True, 'termos': [], 'proibidos': []}

    caminhos = _achar_vocabulario(raiz)
    if not caminhos:
        # ⚠️ O CASO NORMAL. A maioria dos projetos não tem Vocabulário, e a
        # extensão fica quieta — não avisa, não reclama.
        return {'success': True, 'termos': [], 'proibidos': []}

    try:
        termos, proibidos, sugestoes = _ler(caminhos)
    except OSError as e:
        return {'success': False, 'error': 'não deu para ler o Vocabulário: %s' % e}

    print('[glo] %d termos e %d proibidos em %d arquivo(s) do Vocabulário'
          % (len(termos), len(proibidos), len(caminhos)))
    return {'success': True, 'termos': termos, 'proibidos': proibidos,
            'sugestoes': sugestoes}
