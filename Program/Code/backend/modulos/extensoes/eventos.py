"""M4 — o BARRAMENTO DE EVENTOS, lado servidor.

Até a Obra 2, toda conversa entre o programa e o que se pluga nele era sob
demanda: o usuário clica, a tela pergunta, a extensão responde. Aqui o
programa toma a iniciativa — ele **avisa**, e a extensão reage ou **barra**.

Este módulo tem duas metades, e elas fazem coisas diferentes:

  - **o catálogo** (`XT_EVENTOS`) e a validação do que o manifesto declarou,
    exatamente como `encaixes.py` faz para os pontos;
  - **o barramento do lado Python** (`emitir`), para os eventos cuja ação
    acontece no backend — uma rotina que terminou, um cartão que mudou de
    coluna. Emitir isso do frontend seria mentira: a tela pode nem estar
    aberta quando acontece.

⚠️ **Os dois barramentos NÃO se espelham.** Um evento de frontend não chega
ao Python, e vice-versa. Espelhar exigiria uma ponte permanente nos dois
sentidos e faria toda extensão pagar o custo de eventos que ela não assinou.
Uma extensão que quer os dois lados assina os dois — e o catálogo diz de que
lado cada evento vive, para ela não assinar o lado errado e ficar esperando
um aviso que nunca vem.
"""

import os
import copy
import time
import threading

from .constantes import XT_MANIFESTO, caminho_absoluto, erro_do_arquivo_declarado
from . import carga

# De que lado a ação acontece — e, portanto, de onde o aviso sai.
XT_LADO_FRONTEND = 'frontend'
XT_LADO_BACKEND = 'backend'

# O papel do assinante. É o manifesto que o declara, e não o código da
# extensão: quem lê o `extensao.json` precisa conseguir ver que aquela
# extensão pode BARRAR o salvamento sem abrir o JavaScript dela.
#
#   observador — roda depois, o programa não espera, não pode impedir nada.
#   guardiã    — roda antes, o programa espera, pode devolver
#                `{barrar: True, motivo}` e a ação não acontece.
XT_PAPEL_OBSERVADOR = 'observador'
XT_PAPEL_GUARDIA = 'guardia'

# Os eventos da primeira versão. Cada um é uma chamada de emissão onde a ação
# JÁ acontece — nenhum inventou passo novo no programa.
#
# ⚠️ `guardia_cabe` não é decoração. Onde ele é falso, não existe "antes" em
# que barrar faça sentido: uma rotina que terminou já terminou, e uma guardiã
# ali só poderia atrasar o aviso. Declarar guardiã num evento desses é erro de
# manifesto, e aparece como tal.
XT_EVENTOS = (
    {
        'nome': 'editor.vai_salvar',
        'lado': XT_LADO_FRONTEND,
        'guardia_cabe': True,
        'quando': 'antes de o Editor gravar um arquivo no disco',
        'dado': '{ projeto, arquivo, texto }',
        'nota': 'a guardiã pode devolver `{dado: {…, texto}}` para gravar OUTRO '
                'texto — é assim que "formatar ao salvar" funciona',
    },
    {
        'nome': 'editor.salvou',
        'lado': XT_LADO_FRONTEND,
        'guardia_cabe': False,
        'quando': 'depois de o arquivo ter sido gravado com sucesso',
        'dado': '{ projeto, arquivo, texto }',
        'nota': '',
    },
    {
        'nome': 'terminal.vai_rodar',
        'lado': XT_LADO_FRONTEND,
        'guardia_cabe': True,
        'quando': 'antes de a aba Terminal rodar o script do ▶ Executar',
        'dado': '{ projeto, caminho, origem }',
        'nota': 'a guardiã pode devolver `{barrar: true, motivo}` (o Terminal não '
                'roda e mostra o motivo) ou TOMAR a execução devolvendo '
                '`{dado: {…, assumido_por: "Nome", selo: "texto curto"}}` — o '
                'Terminal não roda, não acusa erro e mostra quem assumiu',
    },
    {
        'nome': 'projeto.abriu',
        'lado': XT_LADO_FRONTEND,
        'guardia_cabe': False,
        'quando': 'o usuário entrou num projeto',
        'dado': '{ projeto }',
        'nota': '',
    },
    {
        'nome': 'projeto.fechou',
        'lado': XT_LADO_FRONTEND,
        'guardia_cabe': False,
        'quando': 'o usuário voltou para a lista de projetos',
        'dado': '{ projeto }',
        'nota': 'vem com o projeto que ESTAVA aberto, não com o novo',
    },
    {
        'nome': 'trabalhos.cartao_moveu',
        'lado': XT_LADO_BACKEND,
        'guardia_cabe': False,
        'quando': 'um cartão do Quadro mudou de coluna',
        'dado': '{ projeto, id, de, para }',
        'nota': 'emitido DEPOIS de gravar — o Quadro é a fonte da verdade do '
                'andamento, e um cartão que não se move porque uma extensão '
                'disse não seria pior que qualquer coisa que a guardiã evitasse',
    },
    {
        'nome': 'rotina.terminou',
        'lado': XT_LADO_BACKEND,
        'guardia_cabe': False,
        'quando': 'uma rotina da Automação terminou — pelo ciclo, pela base '
                  'ou pelo ▶ avulso',
        'dado': '{ projeto, rotina, erro, terminou_em }',
        'nota': 'sai TAMBÉM quando a rotina falhou, e aí `erro` vem preenchido. '
                'Uma extensão que só quer o sucesso testa `erro`',
    },
    {
        'nome': 'terminal.terminou',
        'lado': XT_LADO_BACKEND,
        'guardia_cabe': False,
        'quando': 'um terminal da Oficina terminou de rodar',
        'dado': '{ projeto, id, codigo_de_saida }',
        'nota': 'é o nó da Oficina. O fim do ▶ Executar da aba Terminal é '
                '`terminal.rodou`',
    },
    # ⚠️ NOME PRÓPRIO, e não `terminal.terminou`: esse já é da Oficina, e o
    # catálogo é um dicionário por nome — uma extensão que assinasse um
    # receberia os dois sem distinguir (decidido em 23/09/2026, fase 08).
    {
        'nome': 'terminal.rodou',
        'lado': XT_LADO_BACKEND,
        'guardia_cabe': False,
        'quando': 'o script que o ▶ Executar da aba Terminal rodou terminou — '
                  'sozinho ou parado pelo ⏹',
        'dado': '{ projeto, caminho, codigo_de_saida, como }',
        'nota': '`como` é "terminou" ou "parado" (o ⏹ matou o processo). Não sai '
                'quando uma guardiã de `terminal.vai_rodar` barrou ou TOMOU a '
                'execução — aí o Terminal não rodou nada — nem quando o Windows '
                'não tem programa associado ao arquivo',
    },
    # ── Os eventos do D46 (fase 12) ──
    # ⚠️ Os de ARQUIVO são do lado frontend (resposta ao "Pergunte antes" 2 da
    # fase 12): saem do Editor, onde o gesto acontece — é o que deixa uma
    # extensão de tela ouvir. Quem mexe no disco por outro caminho (a Fila, o
    # Chat, uma rotina) NÃO os dispara.
    {
        'nome': 'arquivo.criado',
        'lado': XT_LADO_FRONTEND,
        'guardia_cabe': False,
        'quando': 'um arquivo ou pasta nasceu no projeto, pelo Editor — criado, '
                  'colado como cópia ou solto de fora na árvore',
        'dado': '{ projeto, caminho, pasta }',
        'nota': '`pasta` vem `false` ao colar uma cópia (o Editor não guarda se '
                'o copiado era pasta) e `null` ao soltar de fora sem a informação',
    },
    {
        'nome': 'arquivo.renomeado',
        'lado': XT_LADO_FRONTEND,
        'guardia_cabe': False,
        'quando': 'um arquivo ou pasta do projeto mudou de nome ou de lugar, pelo Editor',
        'dado': '{ projeto, de, para }',
        'nota': 'mover (recortar e colar, arrastar na árvore) também conta: o caminho mudou',
    },
    {
        'nome': 'arquivo.apagado',
        'lado': XT_LADO_FRONTEND,
        'guardia_cabe': False,
        'quando': 'um arquivo ou pasta do projeto foi excluído pelo Editor',
        'dado': '{ projeto, caminho }',
        'nota': 'sai também quando foi para a Lixeira — um evento por item excluído',
    },
    {
        'nome': 'aba.abriu',
        'lado': XT_LADO_FRONTEND,
        'guardia_cabe': False,
        'quando': 'uma aba principal ficou visível — dentro do projeto ou na tela de Projetos',
        'dado': '{ projeto, aba, barra }',
        'nota': 'sub-aba não dispara. Sai TAMBÉM quando o programa restaura a aba '
                'ao entrar num projeto — a tela mudou de verdade. `projeto` é `null` '
                'na tela de Projetos',
    },
    {
        'nome': 'chat.mensagem_enviada',
        'lado': XT_LADO_FRONTEND,
        'guardia_cabe': False,
        'quando': 'o usuário enviou uma mensagem no Chat',
        'dado': '{ projeto, chat, texto }',
        'nota': 'é "a mensagem saiu", e não "a resposta chegou" — sai antes da '
                'resposta. Retomar as rodadas não é mensagem nova',
    },
    {
        'nome': 'fila.tarefa_terminou',
        'lado': XT_LADO_BACKEND,
        'guardia_cabe': False,
        'quando': 'uma tarefa da Fila terminou — pronta, pronta com ressalva ou falhou',
        'dado': '{ projeto, id, status, erro, relatorio }',
        'nota': 'emitido DEPOIS de gravar e de avisar a tela. `relatorio` é o nome '
                'do `.md` do relatório (vazio quando falhou)',
    },
    # ⚠️ Lado BACKEND (decidido em 23/09/2026): o frontend da extensão já sabe
    # das PRÓPRIAS opções por `xtPreferenciasMudaram_{slug}`; quem não sabia
    # era o `backend/extensao.py` e o boot. Sai dos dois gravadores de
    # Configurações (`configuracoes_arquivos.avisar_configuracao_mudou`) e do
    # Salvar da página da extensão (`tela.py::save_preferencias_extensao`).
    {
        'nome': 'configuracao.mudou',
        'lado': XT_LADO_BACKEND,
        'guardia_cabe': False,
        'quando': 'uma configuração foi gravada — uma categoria de Configurações '
                  '› Programa, ou as opções da página de uma extensão',
        'dado': '{ origem: "programa", categoria, chaves } ou '
                '{ origem: "extensao", extensao, chaves }',
        'nota': 'um aviso por categoria, e só com as chaves que mudaram de valor '
                '(Salvar sem mudança não avisa). `categoria` é a chave interna '
                '("editor", "tema"…); `extensao` é o caminho da extensão. As '
                'categorias com arquivo próprio (ordem das abas, Launchers, '
                'Extensões, Arquivos que o programa lê…) não avisam. Reler o '
                'valor continua sendo da extensão',
    },
)

XT_EVENTOS_POR_NOME = {e['nome']: e for e in XT_EVENTOS}

# Como o `backend/extensao.py` de uma extensão recebe um evento do lado Python.
# Uma função só, e o `nome` chega como argumento — mesmo desenho do `executar`
# da ponte, que também roteia por argumento em vez de exigir uma função por
# ação. Duas convenções diferentes na mesma pasta seriam duas para lembrar.
XT_FUNC_EVENTO = 'ao_evento'

# Quanto o programa espera cada assinante do lado Python. Menor que o teto da
# guardiã do frontend porque aqui NÃO HÁ guardiã: tudo é observador, e
# observador que demora está atrasando quem emitiu sem poder mudar nada.
XT_TETO_EVENTO_S = 2.0


def validar_eventos(caminho_relativo, declarados):
    """Confere o que o manifesto declarou em `eventos` contra o catálogo.

    Devolve `(erros, normalizados)`. Erro aqui não impede a extensão de ligar,
    pela mesma razão dos encaixes: quem assinou cinco eventos e errou um
    continua funcionando nos outros quatro.
    """
    erros, normalizados = [], []

    for i, bruto in enumerate(declarados or []):
        rotulo = 'eventos[%d]' % i

        if not isinstance(bruto, dict):
            erros.append('%s precisa ser um objeto `{"nome": …, "arquivo": …}`, '
                         'e veio %s.' % (rotulo, type(bruto).__name__))
            continue

        nome = str(bruto.get('nome', '')).strip()
        arquivo = str(bruto.get('arquivo', '')).strip()
        guardia = bool(bruto.get('guardia', False))

        if not nome:
            erros.append('%s não disse que evento assina.' % rotulo)
            continue
        catalogo = XT_EVENTOS_POR_NOME.get(nome)
        if catalogo is None:
            erros.append('%s: evento desconhecido "%s". Os que existem hoje são: %s.'
                         % (rotulo, nome, ', '.join(sorted(XT_EVENTOS_POR_NOME))))
            continue
        # ⚠️ Um evento do lado BACKEND não tem `arquivo`: quem o recebe é o
        # `ao_evento` de `backend/extensao.py`. Exigir um `.js` aqui
        # obrigaria a extensão a criar um arquivo que nunca seria carregado.
        if catalogo['lado'] == 'backend':
            if arquivo:
                erro_arquivo = erro_do_arquivo_declarado(caminho_relativo, arquivo, rotulo)
                if erro_arquivo:
                    erros.append(erro_arquivo)
                    continue
        else:
            erro_arquivo = erro_do_arquivo_declarado(caminho_relativo, arquivo, rotulo)
            if erro_arquivo:
                erros.append(erro_arquivo)
                continue

        # ⚠️ Guardiã onde não cabe é REBAIXADA a observador, e não recusada. A
        # assinatura continua valendo — a extensão passa a ser avisada, só não
        # pode barrar. Recusar faria o autor perder também o aviso, que é a
        # parte que ele com certeza queria.
        if guardia and not catalogo['guardia_cabe']:
            erros.append('%s: "%s" não aceita guardiã (não há um "antes" em que '
                         'barrar faça sentido). A assinatura vale como '
                         'observador.' % (rotulo, nome))
            guardia = False

        # ⚠️ Mesmo motivo do encaixe duplicado, e aqui é pior: o caso natural
        # de errar é assinar o mesmo evento duas vezes, uma como observador e
        # outra como guardiã. O registro guarda uma por extensão, então a
        # segunda apagaria a primeira — e "eu assinei como guardiã e ela não
        # barra" não teria explicação visível em lugar nenhum.
        if any(n['nome'] == nome for n in normalizados):
            erros.append('%s: o evento "%s" já foi assinado acima. Uma assinatura '
                         'por extensão — a função pode ser guardiã OU observadora, '
                         'não as duas.' % (rotulo, nome))
            continue

        normalizados.append({'nome': nome, 'arquivo': arquivo, 'guardia': guardia,
                             'lado': catalogo['lado']})

    return erros, normalizados


# `{caminho_relativo: (mtime do extensao.json, {nomes assinados})}` — ver
# `_assinou`.
_ASSINATURAS = {}


def _assinou(caminho_relativo, nome):
    """A extensão declarou `nome` no `eventos` do manifesto dela?

    ⚠️ O manifesto NÃO é guardado para sempre — é relido quando o arquivo
    muda. É o mesmo motivo de `descoberta.montar_folha` relê-lo a cada
    listagem: o usuário edita o `extensao.json` com o programa aberto, e
    acrescentar uma assinatura tem de passar a valer sem religar a extensão.

    Mas reler A CADA emissão era caro no lugar errado: `ler_manifesto` abre o
    JSON e roda os três validadores, cada um com um `isfile` por arquivo
    declarado — e isto roda no encerramento de um terminal, no fim de uma
    rotina, uma vez por extensão carregada. O `mtime` do arquivo é a chave:
    se ele não mudou, a resposta de antes vale.

    Import tardio, e aqui dentro: `manifesto.py` importa ESTE módulo para
    validar. No topo, o ciclo fecharia e o programa não subiria.
    """
    caminho = os.path.join(caminho_absoluto(caminho_relativo), XT_MANIFESTO)
    try:
        mtime = os.path.getmtime(caminho)
    except OSError:
        mtime = None
    guardado = _ASSINATURAS.get(caminho_relativo)
    if guardado is not None and guardado[0] == mtime:
        return nome in guardado[1]

    from .manifesto import ler_manifesto
    try:
        assinaturas = ler_manifesto(caminho_relativo)['manifesto']['eventos']
    except Exception as e:
        print('[extensoes] nao deu para reler o manifesto de "%s": %s'
              % (caminho_relativo, e))
        return False
    nomes = {a['nome'] for a in assinaturas}
    _ASSINATURAS[caminho_relativo] = (mtime, nomes)
    return nome in nomes


def _assinantes_do_lado_python(nome):
    """As extensões LIGADAS que assinaram `nome` do lado backend.

    Quem está ligado sai do que `carga.py` guardou: extensão desligada não tem
    módulo guardado, e por isso não é avisada — sem precisar de uma segunda
    lista de "quem está ligado" que poderia divergir desta.

    ⚠️ **Ter `ao_evento` NÃO basta.** A extensão precisa ter declarado o evento
    no manifesto. Sem esta conferência, quem escrevesse um `ao_evento` para um
    único evento receberia todos os outros também — e o `eventos` do manifesto
    não significaria nada deste lado, ao contrário do que o contrato promete.
    """
    achados = []
    for caminho in carga.caminhos_carregados():
        modulo = carga.obter(caminho)
        if modulo is None:
            continue
        funcao = getattr(modulo, XT_FUNC_EVENTO, None)
        if callable(funcao) and _assinou(caminho, nome):
            achados.append((caminho, funcao))
    return achados


def emitir(nome, dado=None):
    """O programa avisa, do lado Python. Não devolve nada e nunca lança.

    ⚠️ **Todo assinante do lado Python é OBSERVADOR.** Não há guardiã aqui, e
    a razão é o lugar de onde estes eventos saem: uma rotina que terminou já
    terminou, um terminal que fechou já fechou. Não existe um "antes" em que
    barrar signifique alguma coisa — e uma guardiã que só pudesse atrasar o
    aviso seria um jeito caro de não fazer nada.

    ⚠️ **Cada assinante roda na PRÓPRIA thread, e o teto é UM para todos.**
    Quem emite é, com frequência, o fim de um ciclo de rotina ou o
    encerramento de um processo — lugares que não podem esperar por código de
    terceiro. Sem o teto, uma extensão travada seguraria a rotina do usuário
    para sempre. E o teto é do conjunto, não de cada uma: as threads são
    disparadas todas antes de esperar qualquer uma, senão N assinantes lentos
    custariam N × 2 s a quem emitiu — dentro do encerramento de um processo.
    """
    if nome not in XT_EVENTOS_POR_NOME:
        # Erro de quem CHAMOU, não da extensão. Um nome fora do catálogo é um
        # aviso que nunca chegaria a assinante nenhum, e o sintoma seria uma
        # extensão correta que simplesmente não reage.
        print('[extensoes] evento fora do catalogo: %r' % (nome,))
        return

    try:
        assinantes = _assinantes_do_lado_python(nome)
    except Exception as e:
        # Promete nunca lançar — e quem emite está fora de qualquer `try`.
        print('[extensoes] falha ao achar os assinantes de "%s": %s' % (nome, e))
        return

    threads = []
    for caminho, funcao in assinantes:
        def _correr(caminho=caminho, funcao=funcao):
            try:
                # Cópia FUNDA: os assinantes rodam ao mesmo tempo, e um que
                # mexesse numa lista aninhada mudaria o que o outro está lendo.
                funcao(nome, copy.deepcopy(dado) if dado else {})
            except Exception as e:
                print('[extensoes] "%s" falhou no evento "%s": %s' % (caminho, nome, e))

        t = threading.Thread(target=_correr, name='xt-evento-%s' % nome, daemon=True)
        threads.append((caminho, t))
        t.start()

    limite = time.monotonic() + XT_TETO_EVENTO_S
    for caminho, t in threads:
        t.join(timeout=max(0.0, limite - time.monotonic()))
        if t.is_alive():
            # A thread continua rodando — `join` só desiste de esperar, não
            # mata. É o comportamento certo: matar thread no meio deixaria a
            # extensão com um arquivo meio escrito. `daemon=True` garante que
            # ela não segure o fechamento do programa.
            print('[extensoes] "%s" nao respondeu ao evento "%s" em %.0fs — '
                  'o programa seguiu sem ela.' % (caminho, nome, XT_TETO_EVENTO_S))


class XtEventosMixin:
    def list_eventos_programa(self):
        """O catálogo de eventos, e quem assinou cada um.

        A tela usa isto para mostrar, na lista de Configurações, o que cada
        extensão observa — e, principalmente, **o que ela pode barrar**. Uma
        guardiã do salvamento é a coisa mais invasiva que uma extensão pode
        ser nesta camada, e o usuário tem de conseguir ver isso sem abrir o
        manifesto.
        """
        try:
            resposta = self.list_extensoes_programa()
            if not resposta.get('success'):
                return {'success': False, 'error': resposta.get('error', ''), 'eventos': []}
            folhas = [f for f in _todas_as_folhas(resposta['arvore']) if f['ligado']]
        except Exception as e:
            print('[extensoes] falha ao listar os eventos:', e)
            return {'success': False, 'error': str(e), 'eventos': []}

        eventos = []
        for ev in XT_EVENTOS:
            assinantes = [
                {'caminho': f['caminho'], 'slug': f['slug'], 'nome': f['nome'],
                 'guardia': a['guardia']}
                for f in folhas for a in f['eventos'] if a['nome'] == ev['nome']
            ]
            eventos.append(dict(ev, assinantes=assinantes))

        return {'success': True, 'eventos': eventos}


def _todas_as_folhas(no):
    """Cópia local, pelo mesmo motivo de `encaixes.py`: importar `descoberta`
    aqui fecharia o ciclo `descoberta → manifesto → eventos → descoberta`."""
    folhas = list(no.get('extensoes', []))
    for pasta in no.get('pastas', []):
        folhas.extend(_todas_as_folhas(pasta))
    return folhas
