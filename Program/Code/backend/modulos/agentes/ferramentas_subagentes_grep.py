"""A ferramenta `grep`: as linhas que contêm o termo, com arquivo e número.

Arquivo próprio porque ela sozinha tinha 280 linhas — mais que qualquer outra
ferramenta da família — e porque a pergunta dela é diferente de todas as outras:
as demais LEEM UM ALVO que o modelo nomeou; esta VARRE O ESCOPO INTEIRO
procurando. Todo o cuidado com binário, com extensão e com volume de saída existe
por causa dessa varredura, e não faria sentido em nenhum outro arquivo.

⚠️ NÃO HÁ LISTA DE EXTENSÕES PERMITIDAS, e a inversão é deliberada. A lista era
de 23 extensões e tornava invisível todo `.sh`, `.ps1`, `.sql`, `.vue`, `.rb`,
`.kt`… — linguagem nova só passava a funcionar se alguém lembrasse de cadastrar.
A arquitetura modular já garante que dentro da pasta de código só existe código,
então o que precisa ser filtrado é BINÁRIO, não "linguagem desconhecida".

São duas barreiras, e só a segunda é a proteção de verdade:

    1. `BINARY_EXTS` — atalho de desempenho, para não abrir o arquivo só para
       descobrir o que a extensão já dizia. Tem UM furo: a coluna **agentes**
       da tabela de exceções (`_excecao_de`), uma extensão por vez, escrita à
       mão.
    2. `_sub_parece_binario` — o byte zero nos primeiros `GREP_BYTES_SNIFF`
       bytes. Sem furo nenhum.

⚠️ DEFINIÇÃO × USO é a distinção que faz o resultado ser útil. Procurar um nome
devolvia dezenas de linhas em que ele só aparecia citado, e a definição — a
única que o modelo queria — ficava perdida no meio. Ver os rótulos de definição,
em `ferramentas_subagentes_simbolos.py`.
"""

from modulos.agentes.ferramentas_subagentes_constantes import *
# Nome privado, então `import *` não o traria de `_constantes.py`. É o ÚNICO
# furo de `BINARY_EXTS`, e mora junto do teste que o aplica.
from modulos.configuracoes import excecao_de as _excecao_de


class FerramentasSubagentesGrepMixin:

    # ── Ferramentas ───────────────────────────────────────────────────────────
    def _ferr_grep(self, project_name, termo, pasta=None, palavra_inteira=False,
                   diferenciar_maiusculas=False, quem=LEITOR_LM_STUDIO):
        # ⚠️ A POSIÇÃO DOS DOIS INTERRUPTORES IMPORTA. São só dois os chamadores
        # desta função no projeto: o despachante dos subagentes, que chama com
        # TRÊS POSICIONAIS (`project_name`, `termo`, `pasta`), e o `tool_grep` do
        # servidor MCP, que passa `quem=` NOMEADO. Parâmetro nomeado com padrão,
        # nesta posição, não quebra nenhum dos dois — e o despachante ignora em
        # silêncio o parâmetro que não conhece.
        #
        # Os dois são `False` por padrão porque o caminho padrão do grep não
        # muda: ver o bloco "Como uma linha casa", mais abaixo.
        # `quem` é quem está perguntando. O padrão é o LM Studio (subagente do
        # Chat ou da Fila); o servidor MCP passa `'externo'` — e é só isso que
        # faz um arquivo marcado "só o assistente externo" aparecer para ele e
        # continuar sumido para o chat interno.
        if not isinstance(termo, str) or not termo.strip():
            raise ValueError('parâmetro "termo" vazio ou inválido')
        root = self._sub_root_folder(project_name)
        escopo = self._sub_escopo(project_name)
        esta_ignorado = self._sub_ignore_checker(project_name, quem)

        # Sem `pasta`, varre as pastas de trabalho — não a raiz. Com `pasta`,
        # ela precisa estar dentro de uma delas, e o erro diz isso em vez de
        # devolver uma busca vazia.
        if pasta:
            base = self._sub_validar_caminho(root, pasta)
            # ⚠️ A ORDEM é escopo → removidos → existência, a mesma que o
            # `_ferr_ler_arquivo` documenta. Era o inverso aqui, e o defeito era
            # o mesmo: um caminho fora das pastas de trabalho não é "não
            # encontrado", e responder isso ensina o modelo a duvidar de um
            # arquivo que existe.
            if not self._sub_dentro_do_escopo(escopo, base):
                raise self._sub_erro_fora_do_escopo(project_name, pasta, escopo)
            if esta_ignorado(base):
                raise ValueError(f'a pasta "{pasta}" está na lista de removidos deste '
                                 'projeto — o usuário a tirou do escopo de propósito')
            if not os.path.isdir(base):
                # O mesmo helper que o Navegador usa: ele distingue arquivo de
                # pasta, acha o nome sem extensão e lista o que existe ao redor.
                # A frase seca "pasta não encontrada" fazia o subagente concluir
                # que o ARQUIVO não existe — aconteceu com `chat-agentes.js`, que
                # existe, e matou a busca por quem usa `RastroDeLeitura`.
                #
                # O grep NÃO passa a buscar dentro do arquivo: `pasta` continua
                # significando pasta, sempre. Ele manda repetir sem o parâmetro.
                raise ValueError(
                    self._sub_erro_de_pasta(root, escopo, base, pasta, esta_ignorado)
                    + '\nIsto foi o parâmetro "pasta" do grep. Refaça a busca sem ele '
                      '(o escopo passa a ser todas as pastas de trabalho), ou com uma '
                      'pasta de verdade.')
            bases = [base]
        else:
            bases = list(escopo)

        context_descs = self._sub_ctx_descs(project_name, quem)

        # ── Como uma linha casa ──────────────────────────────────────────────
        # ⚠️ MONTADO UMA VEZ SÓ, AQUI FORA. O teste roda por LINHA de cada
        # arquivo do escopo — é o laço mais quente da varredura inteira, e
        # compilar ou decidir lá dentro custaria em todo arquivo do projeto.
        #
        # ⚠️ SEM NENHUM INTERRUPTOR O CASAMENTO NÃO MUDA UM BYTE: continua sendo
        # literalmente `termo_lower in line.lower()`. Este é o caminho padrão, e
        # é por ele que passam os subagentes do LM Studio — o despachante deles
        # nunca manda os dois parâmetros.
        termo_lower = termo.lower()
        if palavra_inteira or diferenciar_maiusculas:
            import re as _re
            # `re.escape` é obrigatório: quem chama passa TEXTO LITERAL, não
            # expressão regular. Um termo com `(`, `*` ou `[` viraria erro de
            # compilação — ou, pior, casamento surpresa.
            _padrao = _re.escape(termo)
            if palavra_inteira:
                # ⚠️ A BORDA TEM DE SER `\w`, E ISSO FOI MEDIDO:
                #     texto: "importancia importante import importar importância"
                #     termo: "import"
                #   com `(?<![A-Za-z0-9_]) … (?![A-Za-z0-9_])` → 2 achados, o
                #     segundo DENTRO de "importância": `â` não está na classe
                #     ASCII, então ela trata o acento como FIM DE PALAVRA e o
                #     termo casa dentro da palavra maior;
                #   com `(?<!\w) … (?!\w)`                     → 1 achado, o certo.
                # Em Python 3, `\w` sobre `str` é Unicode por padrão. Num código
                # com prosa em português, a classe ASCII devolve exatamente o
                # falso positivo que este parâmetro existe para eliminar.
                #
                # ⚠️ E NÃO PODE SER `\b`: um termo como `TODO:` termina em
                # caractere que não é de palavra, e o `\b` ali exigiria um
                # caractere de palavra do outro lado — o casamento NUNCA
                # aconteceria. Por isso a borda entra só no lado em que o PRÓPRIO
                # TERMO começa ou termina com caractere de palavra.
                if _re.match(r'\w', termo):
                    _padrao = r'(?<!\w)' + _padrao
                if _re.search(r'\w$', termo):
                    _padrao = _padrao + r'(?!\w)'
            # ⚠️ `re.IGNORECASE` já dobra acento — medido: `ação` casa `AÇÃO`.
            # Nada além disto é preciso, e nada além disto foi feito: a busca
            # continua NÃO dobrando acento no outro sentido (`funcao` não acha
            # `função`), e a `description` da ferramenta diz isso por escrito.
            _rx = _re.compile(_padrao,
                              0 if diferenciar_maiusculas else _re.IGNORECASE)

            def _casa(line, _rx=_rx):
                return _rx.search(line) is not None
        else:
            def _casa(line, _t=termo_lower):
                return _t in line.lower()

        corte_linha = self._sub_limite_por_leitor(
            'grep_corte_linha_chars', 'mcp_grep_corte_linha_chars', quem)
        max_ocorrencias = self._sub_limite_por_leitor(
            'grep_max_ocorrencias', 'mcp_grep_max_ocorrencias', quem)
        max_arquivos = self._sub_limite_por_leitor(
            'grep_max_arquivos', 'mcp_grep_max_arquivos', quem)
        # ⚠️ Em BYTE, de propósito: a decisão é tomada ANTES de abrir o
        # arquivo (`os.path.getsize`), e contar token exigiria ter aberto —
        # que é exatamente o que este limite existe para evitar.
        max_kb = self._sub_limite('grep_max_kb')
        MAX_SIZE = max_kb * 1024
        # A varredura vai até o fim de propósito. Antes ela abortava o os.walk
        # inteiro ao juntar 50 ocorrências, e o resultado saía enviesado pela
        # ordem alfabética — um canto só do projeto, sem nenhum aviso de que o
        # resto nunca foi olhado. Agora conta-se tudo e trunca-se só a AMOSTRA.
        por_arquivo = {}          # rel -> [(lineno, texto)]
        total_ocorrencias = 0
        pulados_tamanho = 0
        pulados_binario = 0
        pulados_erro = 0
        pulados_removidos = 0

        for dirpath, dirs, files in self._sub_walk_escopo(bases):
            if esta_ignorado(dirpath):
                dirs.clear()
                pulados_removidos += 1
                continue
            antes = len(dirs)
            dirs[:] = [d for d in dirs if not esta_ignorado(os.path.join(dirpath, d))]
            pulados_removidos += antes - len(dirs)
            for fname in sorted(files):
                fpath = os.path.join(dirpath, fname)
                if esta_ignorado(fpath):
                    continue
                if self._get_ctx_desc(fpath, context_descs) is not None:
                    continue
                _ext = os.path.splitext(fname)[1].lower()
                # O furo do piso: só a coluna **agentes** da tabela de exceções
                # libera uma binária, e mesmo assim ela ainda tem de passar pelo
                # `_sub_parece_binario` mais abaixo — que é quem realmente
                # protege. Extensão sem linha na tabela devolve None e continua
                # barrada, que é o comportamento de sempre.
                if _ext in BINARY_EXTS and _excecao_de(_ext, 'agentes') is not True:
                    continue
                try:
                    if os.path.getsize(fpath) > MAX_SIZE:
                        pulados_tamanho += 1
                        continue
                    if self._sub_parece_binario(fpath):
                        pulados_binario += 1
                        continue
                    achados = []
                    with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                        for lineno, line in enumerate(f, 1):
                            if _casa(line):
                                achados.append((lineno, line.strip()[:corte_linha]))
                    if achados:
                        rel = os.path.relpath(fpath, root).replace(os.sep, '/')
                        por_arquivo[rel] = achados
                        total_ocorrencias += len(achados)
                except Exception:
                    pulados_erro += 1

        avisos = []
        if pulados_tamanho:
            # O número vem do limite, e não digitado à mão: com "500 KB" fixo
            # aqui, mudar o campo na tela fazia a frase passar a mentir.
            avisos.append(f'{pulados_tamanho} arquivo(s) ignorado(s) por '
                          f'ultrapassarem {max_kb} KB')
        if pulados_binario:
            avisos.append(f'{pulados_binario} arquivo(s) ignorado(s) por serem binários')
        if pulados_erro:
            avisos.append(f'{pulados_erro} arquivo(s) ignorado(s) por erro de leitura')
        # Dizer que pulou é o que impede o modelo de concluir "essa parte está
        # vazia" a partir de um resultado que nunca a olhou.
        if pulados_removidos:
            avisos.append(f'{pulados_removidos} pasta(s) não foram varridas por estarem '
                          'na lista de removidos do projeto')

        if not por_arquivo:
            saida = (f'Nenhuma ocorrência de "{termo}" encontrada nas pastas de '
                     f'trabalho do projeto.')
            if avisos:
                saida += '\n\n' + '\n'.join(avisos)
            return saida

        # Ordem: quem tem mais ocorrências primeiro (e não a ordem alfabética,
        # que era o viés antigo). Empate desempata pelo caminho, para a saída
        # ser estável entre chamadas iguais.
        ordenados = sorted(por_arquivo.items(), key=lambda kv: (-len(kv[1]), kv[0]))

        # ⚠️ Definição × uso. Procurar `cortar_em_tokens` devolvia nove linhas
        # — uma define, duas importam, seis usam — todas com o mesmo aspecto, e
        # foi assim que o Buscador reportou `subagentes.py:270` para uma função
        # que mora em `tokens.py`. A resposta já estava em disco: o Índice de
        # Identificadores classifica cada ocorrência na geração.
        rotulos, indice_gerado_em = self._sub_rotulos_de_definicao(project_name, termo)

        def _marca(rel, lineno):
            tipo = rotulos.get((rel.rsplit('/', 1)[-1], lineno))
            return '    ← definição' if tipo == 'definicao' else ''

        partes = [f'{total_ocorrencias} ocorrência(s) de "{termo}" '
                  f'em {len(por_arquivo)} arquivo(s).', '']
        for rel, achados in ordenados[:max_arquivos]:
            partes.append(f'  {len(achados):>4} · {rel}')
        se_sobrou = len(ordenados) - max_arquivos
        if se_sobrou > 0:
            partes.append(f'  … mais {se_sobrou} arquivo(s)')
        if avisos:
            partes.append('')
            partes.extend(avisos)

        # A definição vem PRIMEIRO e separada: é o que o Buscador quase sempre
        # está procurando, e enterrá-la no meio da amostra (ordenada por
        # contagem) é o que fazia o arquivo errado parecer a resposta.
        definicoes_achadas = []
        for rel, achados in ordenados:
            for lineno, texto in achados:
                if rotulos.get((rel.rsplit('/', 1)[-1], lineno)) == 'definicao':
                    definicoes_achadas.append(f'{rel}:{lineno}: {texto}')
        if definicoes_achadas:
            partes.append('')
            partes.append(f'DEFINIÇÃO de "{termo}" (pelo Índice de Identificadores'
                          + (f', gerado em {indice_gerado_em}' if indice_gerado_em else '')
                          + '):')
            partes.extend('  ' + d for d in definicoes_achadas)
            # O rótulo vale o que a rotina valer. Sem este aviso, um índice
            # velho vira uma afirmação de fato sobre o código de agora.
            partes.append('  (se o código mudou depois dessa data, a linha pode '
                          'ter andado — confira abrindo o arquivo)')
        elif rotulos:
            # ⚠️ O RAMO DE CIMA JÁ SABIA AVISAR DA DATA; ESTE ESQUECIA — e por
            # isso AFIRMAVA. Ele imprimia "nenhuma das ocorrências abaixo é a
            # definição" logo acima de uma linha que ERA a definição: bastava o
            # índice estar velho e a linha ter andado desde a geração. Agora ele
            # diz o que sabe (o índice conhece o termo, e de quando é o índice) e
            # para de afirmar sobre o que não sabe.
            #
            # ⚠️ A REDAÇÃO É A DO PROMPT DO BUSCADOR, de propósito. Ele já ensina
            # esta ressalva com estas palavras, e esta frase CHEGA TAMBÉM aos
            # subagentes do LM Studio: duas redações para a mesma ressalva é o
            # começo de duas verdades, e o modelo local leria as duas.
            #
            # ⚠️ O `grep` é `fonte: 'vivo'` no catálogo, então não recebe o
            # carimbo `[desatualizado]` — e está certo assim, porque o dado
            # principal dele é varredura ao vivo. Esta frase é o ÚNICO aviso de
            # frescor que ele tem.
            partes.append('')
            partes.append(f'(o Índice de Identificadores conhece "{termo}"'
                          + (f', gerado em {indice_gerado_em}' if indice_gerado_em else '')
                          + ', mas nenhuma das ocorrências abaixo casou com a '
                            'linha que ele registrou)')
            if indice_gerado_em:
                partes.append('  (se o código mudou depois dessa data, a linha pode '
                              'ter andado — confira abrindo o arquivo)')

        linhas = []
        for rel, achados in ordenados:
            for lineno, texto in achados:
                if len(linhas) >= max_ocorrencias:
                    break
                linhas.append(f'{rel}:{lineno}: {texto}{_marca(rel, lineno)}')
            if len(linhas) >= max_ocorrencias:
                break

        partes.append('')
        if len(linhas) < total_ocorrencias:
            partes.append(f'Amostra ({len(linhas)} de {total_ocorrencias}, '
                          'dos arquivos com mais ocorrências):')
        else:
            partes.append('Ocorrências:')
        partes.extend(linhas)
        return '\n'.join(partes)
