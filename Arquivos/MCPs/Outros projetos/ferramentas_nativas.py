"""As três de leitura crua: `grep`, `ler_arquivo` e `listar_pasta`.

⚠️ **AS TRÊS PASSAM PELO ESCOPO DO PROJETO CONSULTADO** (`leitura.Escopo`), e é
por isso que elas existem: as ferramentas nativas do assistente leem a pasta em
que ELE está aberto, e o projeto consultado é outro. Além do endereço, elas
respeitam o que o usuário tirou do escopo lá — as pastas de trabalho, a lista
"Remover" e o "Contexto sem leitura".

⚠️ **A ORDEM DAS CHECAGENS É ESCOPO → CONTEXTO → REMOVIDOS → EXISTÊNCIA**, e ela
não é arbitrária. Um caminho fora das pastas de trabalho NÃO é "não encontrado":
responder isso ensina o modelo a duvidar de um arquivo que existe. E a descrição
do "contexto sem leitura" vem antes de "removidos" porque é justamente a frase
que o usuário escreveu para ser lida no lugar do conteúdo — um caminho nas duas
listas tem de devolver a frase, não a recusa.

⚠️ **NÃO HÁ LISTA DE EXTENSÕES PERMITIDAS no `grep`**, e a inversão é
deliberada: uma lista de permitidas torna invisível todo `.sh`, `.ps1`, `.sql`,
`.vue`… O que precisa ser filtrado é BINÁRIO, e a barreira que de fato protege é
o byte zero, não a extensão.
"""

import os
import re

import leitura as L


BYTES_BINARIOS = 0


def _parece_binario(caminho):
    """Byte zero nos primeiros bytes — o sinal clássico de binário."""
    try:
        with open(caminho, 'rb') as f:
            return b'\x00' in f.read(L.GREP_BYTES_SNIFF)
    except Exception:
        return True


def tool_grep(projeto, args, _liberados):
    termo = (args.get('termo') or '').strip()
    if not termo:
        return 'Informe o parâmetro "termo".'
    escopo = L.Escopo(projeto)

    if args.get('pasta'):
        base = escopo.resolver(args['pasta'])
        if not escopo.dentro(base):
            raise escopo.erro_fora_do_escopo(args['pasta'])
        if escopo.removido(base):
            raise L.ErroDeUso(
                'a pasta "%s" está na lista de removidos do projeto "%s" — o usuário '
                'a tirou do escopo de propósito.' % (args['pasta'], projeto))
        if not os.path.isdir(base):
            raise L.ErroDeUso(
                'pasta não encontrada no projeto "%s": "%s". Refaça a busca sem o '
                'parâmetro "pasta" (o escopo passa a ser todas as pastas de trabalho), '
                'ou com uma pasta de verdade.' % (projeto, args['pasta']))
        bases = [base]
    else:
        bases = None

    # ⚠️ O CASAMENTO É MONTADO UMA VEZ, AQUI FORA. O teste roda por LINHA de
    # cada arquivo do escopo — é o laço mais quente da varredura inteira.
    #
    # ⚠️ SEM NENHUM DOS DOIS INTERRUPTORES O CASAMENTO É `termo in linha`, em
    # minúsculas. Este é o caminho padrão, e ele não muda um byte.
    palavra_inteira = bool(args.get('palavra_inteira'))
    diferenciar = bool(args.get('diferenciar_maiusculas'))
    if palavra_inteira or diferenciar:
        padrao = re.escape(termo)
        if palavra_inteira:
            # ⚠️ A BORDA TEM DE SER `\w` (Unicode), e não `[A-Za-z0-9_]`: com a
            # classe ASCII, o acento conta como fim de palavra e "import" casa
            # DENTRO de "importância". E não pode ser `\b`: um termo como
            # "TODO:" termina em caractere que não é de palavra, e o `\b` ali
            # exigiria um caractere de palavra do outro lado — nunca casaria.
            if re.match(r'\w', termo):
                padrao = r'(?<!\w)' + padrao
            if re.search(r'\w$', termo):
                padrao = padrao + r'(?!\w)'
        compilado = re.compile(padrao, 0 if diferenciar else re.IGNORECASE)

        def casa(linha):
            return compilado.search(linha) is not None
    else:
        baixo = termo.lower()

        def casa(linha):
            return baixo in linha.lower()

    # A varredura vai até o fim de propósito: abortar ao juntar N ocorrências
    # enviesaria o resultado pela ordem alfabética — um canto só do projeto, sem
    # nenhum aviso de que o resto nunca foi olhado. Conta-se tudo, trunca-se só
    # a amostra.
    por_arquivo = {}
    total = 0
    pulados = 0
    tamanho_maximo = L.GREP_MAX_KB * 1024

    caminhada = (((b, d, f) for base in bases
                  for b, d, f in os.walk(base)) if bases else escopo.caminhar())
    for dirpath, dirs, files in caminhada:
        if escopo.removido(dirpath):
            dirs.clear()
            continue
        dirs[:] = [d for d in dirs if not escopo.removido(os.path.join(dirpath, d))]
        for fname in sorted(files):
            caminho = os.path.join(dirpath, fname)
            if escopo.removido(caminho) or escopo.descricao_de_contexto(caminho):
                continue
            try:
                if os.path.getsize(caminho) > tamanho_maximo or _parece_binario(caminho):
                    pulados += 1
                    continue
                achados = []
                with open(caminho, 'r', encoding='utf-8', errors='ignore') as f:
                    for numero, linha in enumerate(f, 1):
                        if casa(linha):
                            achados.append((numero, linha.rstrip()[:L.GREP_CORTE_LINHA]))
            except Exception:
                pulados += 1
                continue
            if achados:
                por_arquivo[escopo.relativo(caminho)] = achados
                total += len(achados)

    if not por_arquivo:
        return ('Nenhuma ocorrência de "%s" no escopo do projeto "%s"%s.'
                % (termo, projeto,
                   ' (%d arquivo(s) pulados por tamanho ou por serem binários)' % pulados
                   if pulados else ''))

    saida = ['%d ocorrência(s) de "%s" em %d arquivo(s) do projeto "%s":'
             % (total, termo, len(por_arquivo), projeto)]
    mostrados = 0
    for rel in sorted(por_arquivo)[:L.MAX_GREP_ARQUIVOS]:
        saida.append('\n%s:' % rel)
        for numero, texto in por_arquivo[rel]:
            if mostrados >= L.MAX_GREP_OCORRENCIAS:
                break
            saida.append('  %d: %s' % (numero, texto))
            mostrados += 1
    # O corte nunca é mudo: sem estas linhas o modelo recebe uma parte achando
    # que são todas, e conclui sobre o que não leu.
    if len(por_arquivo) > L.MAX_GREP_ARQUIVOS:
        saida.append('\n... +%d arquivo(s) com ocorrência não listados.'
                     % (len(por_arquivo) - L.MAX_GREP_ARQUIVOS))
    if total > mostrados:
        saida.append('... +%d ocorrência(s) não mostradas.' % (total - mostrados))
    return '\n'.join(saida)


def tool_ler_arquivo(projeto, args, _liberados):
    caminho_pedido = (args.get('caminho') or args.get('arquivo') or '').strip()
    if not caminho_pedido:
        return 'Informe o parâmetro "caminho".'
    escopo = L.Escopo(projeto)
    cheio = escopo.resolver(caminho_pedido)
    if not escopo.dentro(cheio):
        raise escopo.erro_fora_do_escopo(caminho_pedido)
    descricao = escopo.descricao_de_contexto(cheio)
    if descricao:
        return ('Arquivo marcado como "contexto sem leitura" no projeto "%s" — o '
                'conteúdo não deve ser lido. Descrição fornecida pelo usuário:\n%s'
                % (projeto, descricao))
    if escopo.removido(cheio):
        raise L.ErroDeUso(
            '"%s" está na lista de removidos do projeto "%s" — o usuário tirou isso '
            'do escopo de propósito, então não dá para afirmar nada sobre o que há '
            'nele.' % (caminho_pedido, projeto))
    if not os.path.isfile(cheio):
        raise L.ErroDeUso('arquivo não encontrado no projeto "%s": %s'
                          % (projeto, caminho_pedido))

    todas = L.ler_texto(cheio).splitlines()
    total = len(todas)
    faixa = args.get('linhas')
    if faixa:
        casou = re.fullmatch(r'\s*(\d+)\s*-\s*(\d+)\s*', str(faixa))
        if not casou:
            raise L.ErroDeUso('parâmetro "linhas" inválido: "%s" — use o formato '
                              '"100-300".' % faixa)
        inicio, fim = int(casou.group(1)), int(casou.group(2))
        if inicio < 1 or fim < inicio:
            raise L.ErroDeUso('intervalo de linhas inválido: "%s".' % faixa)
        selecao = todas[inicio - 1:fim]
        if not selecao:
            return ('a faixa %d-%d está fora do intervalo: o arquivo tem %d linhas.'
                    % (inicio, fim, total))
        corpo = '\n'.join('%d: %s' % (n, l) for n, l in enumerate(selecao, inicio))
        aviso = '' if fim >= total else '\n\n(arquivo tem %d linhas no total)' % total
        return L.cortar(corpo + aviso, L.TETO_LER_ARQUIVO)

    # ⚠️ O teto vale para OS DOIS caminhos. Deixá-lo só no caminho sem `linhas`
    # convidaria o modelo a pedir "1-99999" e trazer o arquivo inteiro — e a
    # mensagem de truncamento do outro ramo é justamente o que o ensina a usar
    # o parâmetro.
    corpo = '\n'.join('%d: %s' % (n, l) for n, l in enumerate(todas, 1))
    return L.cortar(corpo, L.TETO_LER_ARQUIVO)


def tool_listar_pasta(projeto, args, _liberados):
    escopo = L.Escopo(projeto)
    pedido = (args.get('caminho') or '').strip()

    # Pedir a raiz devolve as PASTAS DE TRABALHO, não o conteúdo da raiz.
    # Listar a raiz inteira é a porta de entrada para o modelo sair pesquisando
    # fora do que o usuário marcou como projeto.
    if pedido in ('', '.', './'):
        if len(escopo.pastas) == 1 and escopo.pastas[0] == escopo.raiz:
            cheio = escopo.raiz
        else:
            linhas = []
            for pasta in sorted(escopo.pastas, key=escopo.relativo):
                base = escopo.relativo(pasta)
                linhas.append(base + '/')
                try:
                    filhas = sorted(e.name for e in os.scandir(pasta)
                                    if e.is_dir() and not escopo.removido(e.path))
                except OSError:
                    filhas = []
                linhas.extend('  %s/%s/' % (base, n)
                              for n in filhas[:L.MAX_LISTAR_PRIMEIRO_NIVEL])
                sobra = len(filhas) - L.MAX_LISTAR_PRIMEIRO_NIVEL
                if sobra > 0:
                    linhas.append('  (e mais %d pasta(s) — liste "%s")' % (sobra, base))
            return ('Pastas de trabalho do projeto "%s" (é só isto que faz parte do '
                    'escopo dele):\n' % projeto + '\n'.join(linhas))
    else:
        cheio = escopo.resolver(pedido)
        if not escopo.dentro(cheio):
            raise escopo.erro_fora_do_escopo(pedido)

    if not os.path.isdir(cheio):
        raise L.ErroDeUso('pasta não encontrada no projeto "%s": %s' % (projeto, pedido))

    # "Contexto sem leitura" vence a listagem, e é para isso que ele existe: o
    # usuário escreveu a frase JUSTAMENTE para o conteúdo não ser lido.
    descricao = escopo.descricao_de_contexto(cheio)
    if descricao:
        return ('Pasta marcada como "contexto sem leitura" no projeto "%s" — o '
                'conteúdo não deve ser lido, e por isso não foi listado. Descrição '
                'fornecida pelo usuário:\n%s' % (projeto, descricao))

    pastas, arquivos, removidos = [], [], 0
    for entrada in sorted(os.scandir(cheio),
                          key=lambda e: (not e.is_dir(), e.name.lower())):
        if escopo.removido(entrada.path):
            removidos += 1
            continue
        (pastas if entrada.is_dir() else arquivos).append(
            entrada.name + ('/' if entrada.is_dir() else ''))

    itens = pastas + arquivos
    corpo = '\n'.join(itens[:L.MAX_LISTAR_ITENS]) or '(pasta vazia)'
    sobra = len(itens) - L.MAX_LISTAR_ITENS
    if sobra > 0:
        # Diz o que sobrou E o que fazer com isso: sem a segunda parte o modelo
        # repete a mesma listagem esperando resposta diferente.
        corpo += ('\n… mais %d item(ns) nesta pasta. Liste uma subpasta, ou use o '
                  '`grep` se souber o que procura.' % sobra)
    saida = 'Conteúdo de %s (projeto "%s"):\n%s' % (escopo.relativo(cheio), projeto, corpo)
    if removidos:
        saida += ('\n\n(%d item(ns) não aparecem por estarem na lista de removidos '
                  'daquele projeto)' % removidos)
    return saida
