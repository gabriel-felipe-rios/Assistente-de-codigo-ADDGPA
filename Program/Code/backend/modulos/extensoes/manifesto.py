"""Ler e validar o `extensao.json` de uma extensão do programa.

⚠️ **Silêncio aqui é o pior resultado possível.** O usuário criou a pasta,
escreveu o manifesto e espera ver a extensão na lista. Se um erro de vírgula
fizesse a pasta sumir, ele não teria como saber por quê — nem sequer saberia
que o programa chegou a olhar.

Por isso este módulo nunca lança e nunca esconde: devolve sempre
`{ok, manifesto, erros}`, e uma pasta com `extensao.json` continua sendo
extensão mesmo com o manifesto quebrado. Ela aparece na lista com os erros em
vermelho e o interruptor desabilitado.

Função de módulo, sem Mixin: quem precisa disto é `descoberta.py`, não a
`Api`. O frontend nunca pede um manifesto solto — ele recebe a árvore inteira
já validada.
"""

import os
import json

from .constantes import XT_MANIFESTO, caminho_absoluto
from .validacao import ler_formato_novo, derivar_campos_da_tela
from .validacao_antigo import traduzir_formato_antigo


def _lista_de_textos(bruto, campo):
    """`escreve_fora` é lista — e a lista errada quebraria mais adiante, longe
    daqui, num lugar sem contexto."""
    if bruto is None:
        return [], []
    if not isinstance(bruto, list):
        return ['`%s` precisa ser uma lista, e veio %s.' % (campo, type(bruto).__name__)], []
    return [], bruto


def ler_manifesto(caminho_relativo):
    """Lê e normaliza o `extensao.json` de UMA extensão.

    Devolve `{'ok': bool, 'manifesto': {...}, 'erros': [str]}`. `manifesto`
    vem sempre preenchido — com os padrões, se o arquivo não deu para ler —
    para quem consome nunca precisar checar se a chave existe.

    `ok` é False quando falta o que impede de LIGAR (o arquivo ilegível,
    `tipos` ausente/vazio/todo inválido, ou — no formato novo — o `prefixo`). Erro em campo opcional entra em
    `erros` e aparece na tela, mas não desabilita o interruptor: a extensão
    roda, só sem aquele pedaço.
    """
    padrao = {
        'nome': os.path.basename(caminho_relativo),
        'versao': '',
        'descricao': '',
        'tipos': [],
        # O formato novo (D36, D40, D42): o dono e as peças. `formato` diz de
        # qual dos dois o manifesto veio — `acrescenta` é a lista de itens já
        # normalizada, nos dois casos.
        'prefixo': '',
        'formato': 'antigo',
        'acrescenta': [],
        # Os quatro campos que o FRONTEND de hoje lê — derivados de
        # `acrescenta`, nunca escritos à mão no formato novo.
        'encaixes': [],
        'eventos': [],
        'consultas': [],
        # O recurso Tela (fase 11): `[{id, lugar, rotulo, icone, arquivo}]`,
        # também derivado de `acrescenta` — e fora de `encaixes` de propósito.
        'telas': [],
        # Recursos do Editor › trechos prontos (fase 12): `[{arquivo, linguagens}]`,
        # derivado de `acrescenta` — é dado, lido por `dados.py`.
        'trechos': [],
        'escreve_fora': [],
        # Fase 07 (D51): o par do `escreve_fora` — cada pasta que a extensão
        # LÊ fora da pasta de trabalho do projeto. Declaração, como o outro.
        'le_fora': [],
        'dados': {},
    }
    caminho = os.path.join(caminho_absoluto(caminho_relativo), XT_MANIFESTO)

    try:
        with open(caminho, 'r', encoding='utf-8') as f:
            bruto = json.load(f)
    except json.JSONDecodeError as e:
        # A mensagem do parser, inteira e na tela: "Expecting ',' delimiter:
        # line 4 column 3" é exatamente o que o usuário precisa para achar a
        # vírgula. Resumi-la para "manifesto inválido" seria jogar fora a
        # única informação útil que existe.
        return {'ok': False, 'manifesto': padrao,
                'erros': ['%s não é um JSON válido — %s' % (XT_MANIFESTO, e)]}
    except OSError as e:
        return {'ok': False, 'manifesto': padrao,
                'erros': ['não deu para ler o %s: %s' % (XT_MANIFESTO, e)]}

    if not isinstance(bruto, dict):
        return {'ok': False, 'manifesto': padrao,
                'erros': ['%s precisa ter um objeto no topo (as chaves entre '
                          '`{` e `}`), e tem %s.' % (XT_MANIFESTO, type(bruto).__name__)]}

    erros = []
    manifesto = dict(padrao)

    nome = bruto.get('nome')
    if isinstance(nome, str) and nome.strip():
        manifesto['nome'] = nome.strip()

    versao = bruto.get('versao')
    if versao is not None:
        # Só rótulo — nada é comparado (D21). O programa não tem número de
        # versão em lugar nenhum, então não haveria com o que comparar.
        manifesto['versao'] = str(versao)

    # O que a extensão FAZ, numa frase ou duas — é o que a página dela em
    # Configurações › Extensões mostra em cima das opções. Quem não escreveu
    # ganha o primeiro parágrafo do `LEIA-ME.md`, que toda extensão que vem
    # com o programa tem; quem não tem nenhum dos dois aparece com o aviso na
    # página, e não some.
    descricao = bruto.get('descricao')
    if isinstance(descricao, str) and descricao.strip():
        manifesto['descricao'] = ' '.join(descricao.split())
    elif descricao is not None:
        erros.append('`descricao` precisa ser um texto, e veio %s.' % type(descricao).__name__)
    if not manifesto['descricao']:
        manifesto['descricao'] = _descricao_do_leia_me(caminho_relativo)

    erro_campo, manifesto['escreve_fora'] = _lista_de_textos(bruto.get('escreve_fora'),
                                                             'escreve_fora')
    erros.extend(erro_campo)
    erro_campo, manifesto['le_fora'] = _lista_de_textos(bruto.get('le_fora'), 'le_fora')
    erros.extend(erro_campo)

    # Os dois formatos, uma forma só por dentro. ⚠️ É a CHAVE `acrescenta` que
    # decide, e nunca os números: "2" e "4" existem nos dois, com sentidos
    # diferentes. Cada item de `acrescenta` já passou pelo catálogo (lugar,
    # evento, parte) e pelo disco (arquivo); o que falhou não entrou, e o erro
    # diz qual — erro de item NÃO desabilita a extensão, o resto dela liga.
    if 'acrescenta' in bruto:
        erros_n, tipos, prefixo, acrescenta = ler_formato_novo(caminho_relativo, bruto)
        manifesto['formato'] = 'novo'
    else:
        erros_n, tipos, acrescenta = traduzir_formato_antigo(caminho_relativo, bruto)
        prefixo = ''
    erros.extend(erros_n)
    manifesto.update(tipos=tipos, prefixo=prefixo, acrescenta=acrescenta)
    manifesto.update(derivar_campos_da_tela(acrescenta))

    ok = bool(tipos) and (manifesto['formato'] == 'antigo' or bool(prefixo))
    return {'ok': ok, 'manifesto': manifesto, 'erros': erros}


def _descricao_do_leia_me(caminho_relativo):
    """O primeiro parágrafo de prosa do `LEIA-ME.md` — depois do título, e
    pulando citações, tabelas e títulos de seção. Vazio se não há LEIA-ME.

    É reserva, não fonte: o `descricao` do manifesto sempre vence. Existe
    porque as treze extensões que vêm com o programa já abrem o LEIA-ME com
    uma frase que diz o que elas fazem, e obrigar a copiá-la para o manifesto
    seria pedir o mesmo texto em dois lugares.
    """
    caminho = os.path.join(caminho_absoluto(caminho_relativo), 'LEIA-ME.md')
    try:
        with open(caminho, 'r', encoding='utf-8') as f:
            texto = f.read()
    except OSError:
        return ''
    paragrafo = []
    for linha in texto.splitlines():
        limpa = linha.strip()
        if not limpa:
            if paragrafo:
                break
            continue
        if limpa.startswith(('#', '>', '|', '```', '- ', '* ', '1. ')):
            if paragrafo:
                break
            continue
        paragrafo.append(limpa)
    frase = ' '.join(paragrafo)
    # Sem a marcação do Markdown: negrito, itálico e crase não são texto.
    for marca in ('**', '__', '`'):
        frase = frase.replace(marca, '')
    return frase[:400]
