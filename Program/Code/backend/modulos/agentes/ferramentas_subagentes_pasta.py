"""A ferramenta `listar_pasta`: só os nomes do que existe, sem recursão.

Um arquivo para uma ferramenta só porque metade dele é a MENSAGEM DE ERRO, e ela
é o motivo de a ferramenta existir. `_sub_erro_de_pasta` responde a pergunta que
o modelo não sabe fazer: *por que não deu?* — e as respostas são diferentes entre
si a ponto de mudar o que ele tenta em seguida:

    · a pasta não existe          → é outro caminho que ele precisa procurar
    · existe, mas fora do escopo  → o usuário é que precisa mexer na configuração
    · existe, mas está ignorada   → idem, e num lugar diferente da tela
    · é arquivo, não pasta        → a ferramenta certa é outra

Um "não deu" genérico faria o modelo repetir a mesma chamada com variações do
nome, gastando rodada atrás de rodada num problema que não era de nome.

⚠️ SEM RECURSÃO, e é decisão: a ferramenta é orientação, não catálogo. O
suficiente para o modelo saber por onde entrar, sem transformar a primeira
chamada do Navegador num despejo da árvore inteira.
"""

from modulos.agentes.ferramentas_subagentes_constantes import *


class FerramentasSubagentesPastaMixin:

    def _sub_erro_de_pasta(self, root, escopo, full, caminho, esta_ignorado):
        """A mensagem para quando `caminho` não é uma pasta que dá para listar.

        Existia uma frase só, "pasta não encontrada", para três situações
        diferentes, e ela era falsa em duas delas. Pedir
        `backend/modulos/configuracoes` — que existe, como arquivo — respondia
        que não foi encontrado, ensinando ao modelo que o arquivo não existe. E
        um caminho chutado devolvia o erro seco, sem dizer o que existe ali
        perto, então o chute seguinte era tão às cegas quanto o primeiro: foi
        assim que uma tarefa juntou sete tentativas de Navegador em sequência.
        """
        if os.path.isfile(full):
            return (f'"{caminho}" é um arquivo, não uma pasta. Para ver o conteúdo '
                    'dele, chame o Leitor (📖) com este mesmo caminho.')

        # O caso que mais aconteceu no uso real: o modelo pede
        # `backend/modulos/configuracoes` porque viu o nome num índice, e o que
        # existe é `configuracoes.py`. Sem extensão não é `isfile`, e a resposta
        # antiga — "pasta não encontrada" — dizia justamente o contrário do que
        # é verdade. Procurar pelo nome sem extensão custa um `scandir` e
        # devolve o caminho certo de primeira.
        alvo = os.path.basename(caminho.rstrip('/\\'))
        pasta_pai = os.path.dirname(full)
        if alvo and os.path.isdir(pasta_pai):
            alvo_norm = partes_artefato.normalizar(alvo)
            try:
                irmaos = [e for e in os.scandir(pasta_pai) if e.is_file()]
            except OSError:
                irmaos = []
            for e in irmaos:
                if partes_artefato.normalizar(os.path.splitext(e.name)[0]) == alvo_norm:
                    rel = os.path.relpath(e.path, root).replace(os.sep, '/')
                    return (f'"{caminho}" não é uma pasta — o que existe aí é o '
                            f'arquivo "{rel}". Para lê-lo, chame o Leitor (📖).')

        # Sobe até o ancestral que existe de verdade e mostra o que há nele. É a
        # única resposta que permite acertar na tentativa seguinte.
        pai = os.path.dirname(full)
        limite = os.path.normpath(root)
        while (pai and os.path.normpath(pai) != limite
               and not os.path.isdir(pai)
               and self._sub_dentro_do_escopo(escopo, pai)):
            pai = os.path.dirname(pai)

        if not os.path.isdir(pai) or not self._sub_dentro_do_escopo(escopo, pai):
            return f'pasta não encontrada: {caminho}'

        try:
            filhas = sorted(e.name + '/' for e in os.scandir(pai)
                            if e.is_dir() and not esta_ignorado(e.path))
        except OSError:
            filhas = []
        rel_pai = os.path.relpath(pai, root).replace(os.sep, '/')
        if not filhas:
            return (f'pasta não encontrada: {caminho} — e "{rel_pai}" não tem '
                    'nenhuma subpasta.')

        lista = partes_artefato.sugestoes(
            filhas, alvo, rotulo=f'Dentro de "{rel_pai}", as pastas',
            como_ver_todas=f'liste "{rel_pai}"')
        return f'pasta não encontrada: {caminho}\n{lista}'

    def _ferr_listar_pasta(self, project_name, caminho, quem=LEITOR_LM_STUDIO):
        # `quem` é quem está perguntando. O padrão é o LM Studio (subagente do
        # Chat ou da Fila); o servidor MCP passa `'externo'` — e é só isso que
        # faz um arquivo marcado "só o assistente externo" aparecer para ele e
        # continuar sumido para o chat interno.
        root = self._sub_root_folder(project_name)
        escopo = self._sub_escopo(project_name)
        caminho = (caminho or '').strip()
        esta_ignorado = self._sub_ignore_checker(project_name, quem)

        def _rel(p):
            r = os.path.relpath(p, root).replace(os.sep, '/')
            return '.' if r == '.' else r

        # Pedir a raiz devolve as PASTAS DE TRABALHO, não o conteúdo da raiz.
        # Listar a raiz inteira era a porta de entrada para o modelo achar
        # `Explicações/` e `Saída dos comandos/` e sair pesquisando fora do
        # projeto. Quando a pasta de trabalho é a própria raiz, isto recai no
        # comportamento antigo sozinho.
        if caminho in ('', '.', './'):
            if len(escopo) == 1 and os.path.normpath(escopo[0]) == os.path.normpath(root):
                full = root
            else:
                # Com uma linha por pasta de trabalho — normalmente UMA —, a
                # resposta ao "." era "Program/" e nada mais, e o modelo tinha
                # que adivinhar a árvore descendo um degrau por chamada. O
                # primeiro nível já dá o mapa e economiza a rodada seguinte.
                linhas = []
                for p in sorted(escopo, key=_rel):
                    base = _rel(p)
                    linhas.append(base + '/')
                    try:
                        filhas = sorted(e.name for e in os.scandir(p)
                                        if e.is_dir() and not esta_ignorado(e.path))
                    except OSError:
                        filhas = []
                    primeiro_nivel = self._sub_limite_por_leitor(
                        'listar_pasta_primeiro_nivel',
                        'mcp_listar_pasta_primeiro_nivel', quem)
                    linhas.extend(f'  {base}/{n}/' for n in filhas[:primeiro_nivel])
                    sobra = len(filhas) - primeiro_nivel
                    if sobra > 0:
                        linhas.append(f'  (e mais {sobra} pasta(s) — liste "{base}")')
                return ('Pastas de trabalho deste projeto (é só isto que faz parte '
                        'do escopo):\n' + '\n'.join(linhas))
        else:
            full = self._sub_validar_caminho(root, caminho)
            if not self._sub_dentro_do_escopo(escopo, full):
                raise self._sub_erro_fora_do_escopo(project_name, caminho, escopo)

        if not os.path.isdir(full):
            raise ValueError(self._sub_erro_de_pasta(
                root, escopo, full, caminho, esta_ignorado))

        # "Contexto sem leitura" vence a listagem, e é para isso que ele existe:
        # o usuário escreveu uma frase dizendo o que há ali JUSTAMENTE para o
        # conteúdo não ser lido. O Navegador nunca consultava essa frase, então
        # `Program/Internal` — que está nas duas listas — saía como
        # "(pasta vazia)" e a descrição gravada no Workspace.json não chegava ao
        # modelo por caminho nenhum. Foi assim que o Chat afirmou ao usuário que
        # a configuração mora em `Code/`.
        desc = self._get_ctx_desc(full, self._sub_ctx_descs(project_name, quem))
        if desc:
            return (f'Pasta marcada como "contexto sem leitura" — o conteúdo não deve '
                    f'ser lido, e por isso não foi listado. Descrição fornecida pelo '
                    f'usuário:\n{desc}')

        pastas, arquivos = [], []
        removidas = 0
        for entry in sorted(os.scandir(full), key=lambda e: (not e.is_dir(), e.name.lower())):
            if esta_ignorado(entry.path):
                removidas += 1
                continue
            if entry.is_dir():
                pastas.append(entry.name + '/')
            else:
                arquivos.append(entry.name)
        rel = _rel(full)
        titulo = 'raiz do projeto' if rel == '.' else rel
        # ⚠️ Teto de itens. Esta era a única ferramenta de listagem sem corte —
        # o grep tem `grep_max_arquivos` e `grep_max_ocorrencias`, `ler_relacoes`
        # tem `relacoes_max_itens`, e o `listar_pasta_primeiro_nivel` acima só
        # corta a listagem da RAIZ. Uma pasta com milhares de entradas não
        # ignoradas entrava inteira no histórico do agente principal.
        itens = pastas + arquivos
        max_itens = self._sub_limite_por_leitor(
            'listar_pasta_max_itens', 'mcp_listar_pasta_max_itens', quem)
        sobra_itens = len(itens) - max_itens
        corpo = '\n'.join(itens[:max_itens]) or '(pasta vazia)'
        if sobra_itens > 0:
            # Diz o que sobrou E o que fazer com isso: sem a segunda parte o
            # modelo repete a mesma listagem esperando resposta diferente.
            corpo += (f'\n… mais {sobra_itens} item(ns) nesta pasta. Liste uma '
                      'subpasta, ou use o `grep` se souber o que procura.')
        saida = f'Conteúdo de {titulo}:\n{corpo}'
        if removidas:
            saida += (f'\n\n({removidas} item(ns) não aparecem por estarem na lista '
                      'de removidos do projeto)')
        return saida
