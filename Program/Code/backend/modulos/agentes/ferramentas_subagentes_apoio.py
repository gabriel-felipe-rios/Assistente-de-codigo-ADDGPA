"""O chão comum das ferramentas: escopo, tetos, corte e artefato em partes.

Nada aqui é ferramenta. É o que TODA ferramenta precisa antes de responder: a
raiz do projeto, se o caminho pedido está dentro do escopo, quanto cabe na
janela do leitor, e como um artefato grande é servido em pedaço com nome.

⚠️ `_sub_root_folder` É A ORIGEM ÚNICA DA RAIZ DO PROJETO DO USUÁRIO, e não só
para as ferramentas: é a MESMA que o terminal da Oficina usa para escolher o
`cwd` (ver a convenção "A pasta que o AGENTE lê fica na raiz do projeto"). Dois
lugares decidindo a raiz é o terminal abrindo num lugar e o agente procurando
noutro, sem erro nenhum.

⚠️ OS TETOS SÃO EM TOKEN, NUNCA EM LINHA OU CARACTERE. O que eles protegem é a
janela do modelo, e janela se mede em token: 400 linhas de CSS e 400 linhas de
Python denso não custam a mesma coisa. `_sub_limite` é o ponto ÚNICO de leitura
deles, gêmeo de `_mcp_limite` (`modulos/arquivos_mcp.py`).

⚠️ `quem` NÃO É ENFEITE. O padrão é o LM Studio (subagente do Chat ou da Fila);
o servidor MCP passa `LEITOR_ASSISTENTE_EXTERNO`, e os tetos dele são outros —
um assistente externo tem janela muito maior que a do modelo local. É por isso
que quase toda função daqui carrega o parâmetro até o fim.

⚠️ CORTAR SEMPRE AVISA (`_sub_cortar_avisando`). Entregar meio arquivo em
silêncio é pior que recusar: o modelo conclui sobre o que não leu, e ninguém
descobre. O corte existe como FUSÍVEL — 219 dos 220 arquivos deste projeto
cabem no teto —, não como política de leitura.
"""

from modulos.agentes.ferramentas_subagentes_constantes import *
# Nome privado, então `import *` não o traria de `_constantes.py`: ele mora aqui,
# que é o único arquivo da família que o usa.
from modulos.ignorados import esta_ignorado as _esta_ignorado


class FerramentasSubagentesApoioMixin:

    # ── Helpers de caminho ────────────────────────────────────────────────────
    def _sub_root_folder(self, project_name):
        config = self.load_workspace(project_name)['config']
        root = config.get('root_folder')
        if not root or not os.path.isdir(root):
            raise ValueError('pasta raiz do projeto não configurada — peça ao usuário '
                             'para configurá-la na aba Trabalho')
        return root

    def _sub_validar_caminho(self, root, caminho):
        if not isinstance(caminho, str) or not caminho.strip():
            raise ValueError('caminho vazio ou inválido')
        caminho = caminho.strip().replace('/', os.sep)
        if os.path.isabs(caminho):
            raise ValueError(f'caminho absoluto não é permitido: {caminho}')
        full = os.path.normpath(os.path.join(root, caminho))
        root_norm = os.path.normpath(root)
        if full != root_norm and not full.startswith(root_norm + os.sep):
            raise ValueError(f'caminho fora da raiz do projeto: {caminho}')
        return full

    # ── Escopo: as pastas de trabalho ─────────────────────────────────────────
    # Confina `grep`, `ler_arquivo` e `listar_pasta` às pastas que você marcou
    # na aba Trabalho. Antes as três varriam a partir da RAIZ e filtravam só a
    # lista "Remover" — com `working_folders = ['Program']`, um grep de "color"
    # trazia 118 ocorrências de `Explicações/assets/estilo.css`. O Chat parecia
    # certo porque recebe de brinde o índice e a documentação, que já vêm filtrados;
    # a Fila, que descobre tudo pesquisando, saía do escopo na primeira busca.
    #
    # ⚠ Nenhuma ferramenta do programa lê fora da pasta de trabalho (P7, D43).
    # Quem precisa ler uma pasta da raiz é uma EXTENSÃO, com a ferramenta dela
    # (`_ferr_de_extensao`) e a pasta declarada no `le_fora` do manifesto. As
    # ferramentas de documentação ficam de fora do escopo: leem a pasta de
    # dados do programa, não o código do usuário.

    def _sub_escopo(self, project_name):
        """As pastas de trabalho em caminho absoluto, ou a raiz se não houver.

        Projeto sem pasta de trabalho configurada continua funcionando como
        antes — a raiz inteira. Só quem escolheu recortar é recortado."""
        config = self.load_workspace(project_name)['config']
        pastas = [os.path.normpath(p) for p in (config.get('working_folders') or [])
                  if p and os.path.isdir(p)]
        return pastas or [os.path.normpath(self._sub_root_folder(project_name))]

    @staticmethod
    def _sub_dentro_do_escopo(escopo, caminho):
        alvo = os.path.normpath(caminho)
        for pasta in escopo:
            if alvo == pasta or alvo.startswith(pasta + os.sep):
                return True
        return False

    def _sub_erro_fora_do_escopo(self, project_name, caminho, escopo):
        """A mensagem que o subagente recebe ao pedir algo fora do escopo.

        Diz o que houve E onde ele PODE olhar. O silêncio de antes — "nenhuma
        ocorrência encontrada" para uma pasta removida — fazia o modelo concluir
        que a pasta estava vazia: foi assim que um relatório citou
        `Internal/config/settings.json`, um arquivo que nunca existiu, e o
        Verificador o reprovou como arquivo inexistente."""
        root = self._sub_root_folder(project_name)
        nomes = []
        for pasta in escopo:
            try:
                rel = os.path.relpath(pasta, root).replace(os.sep, '/')
            except Exception:
                rel = pasta
            nomes.append('.' if rel == '.' else rel)
        return ValueError(
            f'"{caminho}" está fora do escopo deste projeto. As pastas de trabalho '
            f'são: {", ".join(nomes)}. Não é que o caminho não exista — ele não '
            f'faz parte do que o usuário marcou como projeto.')

    # ⚠️ Os dois funis do lado das ferramentas. O `quem` PADRÃO é o LM Studio
    # porque quem chama daqui, normalmente, é um subagente do Chat ou da Fila.
    # O servidor MCP passa `LEITOR_ASSISTENTE_EXTERNO` explicitamente — ver os
    # três `_ferr_*` nativos (`grep`, `ler_arquivo`, `listar_pasta`), que são os
    # únicos que recebem `quem` de fora.
    def _sub_ignore_checker(self, project_name, quem=LEITOR_LM_STUDIO):
        config = self.load_workspace(project_name)['config']
        ignore_list = config.get('ignore_list', [])

        def esta_ignorado(path):
            return _esta_ignorado(path, ignore_list, quem)
        return esta_ignorado

    def _sub_ctx_descs(self, project_name, quem=LEITOR_LM_STUDIO):
        config = self.load_workspace(project_name)['config']
        return self._build_context_descs(config.get('context_items', []), quem)

    # ── Os tetos configuráveis ────────────────────────────────────────────────
    def _sub_limite(self, chave):
        """Um limite da categoria "Ferramentas dos subagentes", de `settings.json`.

        O ponto ÚNICO de leitura. O padrão de fábrica vem de
        `PADROES_DAS_FERRAMENTAS`, e valor ausente ou lixo cai nele — nunca em
        número escrito à mão aqui, que era o estado anterior.

        O piso é 1, e não 500: `grep_max_arquivos` vale 20 e
        `max_ferramentas_rodada` vale 4. O piso de 500 que existia aqui só fazia
        sentido para os tetos em token, e teria estragado todos os outros.
        """
        padrao = PADROES_DAS_FERRAMENTAS[chave]
        try:
            valor = int(self.load_settings()['settings'].get(chave, padrao))
        except (TypeError, ValueError, KeyError):
            return padrao
        return max(1, valor)

    def _sub_teto_ler_arquivo(self, quem=LEITOR_LM_STUDIO):
        """⚠️ Este teto governa TODA ferramenta que lê arquivo — o `ler_arquivo`
        e as ferramentas de extensão (`_ferr_de_extensao`, D53).

        Mexer nele muda, no mesmo gesto, quanto de um arquivo de código o
        subagente enxerga E quanto qualquer ferramenta de extensão devolve. O
        rótulo na tela diz isso sem citar ferramenta pelo nome.

        ⚠️ **O teto depende de QUEM pergunta**, e isso não é refinamento: o
        número da categoria "Ferramentas dos subagentes" foi dimensionado para a
        janela do LM STUDIO LOCAL. Quando o servidor MCP passou a reaproveitar
        estas mesmas funções, o assistente externo — que tem uma janela muito
        maior — começou a receber arquivo cortado no teto do chat local, sem
        motivo nenhum e sem ninguém notar. Cada leitor tem o teto dele.
        """
        if quem == LEITOR_ASSISTENTE_EXTERNO:
            return self._mcp_limite('mcp_teto_ler_arquivo_tokens')
        return self._sub_limite('teto_ler_arquivo_tokens')

    def _sub_teto_parte(self, quem=LEITOR_LM_STUDIO):
        """Idem: a parte servida ao assistente externo tem teto próprio."""
        if quem == LEITOR_ASSISTENTE_EXTERNO:
            return self._mcp_limite('mcp_teto_parte_tokens')
        return self._sub_limite('teto_parte_tokens')

    def _sub_limite_por_leitor(self, chave_sub, chave_mcp, quem=LEITOR_LM_STUDIO):
        """O mesmo limite, lido na categoria de QUEM está perguntando.

        Irmão dos dois tetos acima, para os limites em CONTAGEM e em CARACTERE.
        O motivo é idêntico: os números da categoria "Ferramentas dos subagentes"
        foram dimensionados para a janela do LM STUDIO LOCAL, e quando o servidor
        MCP passou a reaproveitar estas mesmas funções o assistente externo — que
        tem uma janela muito maior — começou a receber amostra apertada sem
        motivo nenhum. `_ferr_grep` e `_ferr_listar_pasta` já RECEBIAM o `quem`;
        só não o usavam nestes cinco pontos.

        Um `if` copiado em cada um dos cinco era o caminho óbvio, e é o que este
        helper existe para evitar: cinco cópias da mesma condição divergem no
        primeiro dia em que alguém mexe numa delas.

        ⚠️ NÃO VALE PARA `grep_max_kb`, e isso é decisão, não esquecimento: ele
        protege a MÁQUINA, não a janela — decide se vale abrir o arquivo antes
        de ler um byte (`os.path.getsize`). Quem pergunta não muda o custo de
        abrir 600 KB.
        """
        if quem == LEITOR_ASSISTENTE_EXTERNO:
            return self._mcp_limite(chave_mcp)
        return self._sub_limite(chave_sub)

    @staticmethod
    def _sub_cortar_avisando(texto, teto, sufixo=''):
        """Corta no teto de tokens e DIZ quanto ficou de fora. Nunca corta calado.

        O corte mudo era o pior dos dois mundos: o subagente recebia um pedaço
        achando que era o todo, e concluía com confiança sobre o que não leu.
        """
        tk = contar_tokens(texto)
        if tk <= teto:
            return texto
        return (cortar_em_tokens(texto, teto) +
                f'\n\n(cortado no teto de {teto} tokens — ficaram de fora '
                f'{tk - teto} tokens, cerca de {round(100 * (tk - teto) / tk)}% '
                f'do conteúdo{sufixo})')

    # ── Artefato em partes com nome ───────────────────────────────────────────
    def _sub_servir_partes(self, artefato, partes, parte=None, filtro=None,
                           rastro=None, quem=LEITOR_LM_STUDIO, dica_arquivo=None):
        """Serve um artefato dividido, seguindo a regra automática por tamanho.

        Ver `partes_artefato` para o porquê da divisão e do casamento tolerante.
        Só a leitura de uma PARTE gera linha de rastro: quando o artefato coube
        inteiro não sobrou o que ler, então não há o que lembrar.

        ⚠️ `dica_arquivo` é OPCIONAL de propósito. Esta função é compartilhada
        pelas DUAS ferramentas de artefato em partes — índice e grafo. O pipeline
        saiu daqui (é lido por nível, em `pipeline_niveis_leitura.py`), e o resumo
        de pastas também (é lido por seção, em `ferramentas_subagentes_secoes.py`).
        Só o índice passa dica, porque só nele o modelo confunde pasta com
        arquivo; o grafo não passa nada.
        """
        if filtro:
            partes = partes_artefato.filtrar_partes(partes, filtro)
        if not partes:
            raise ValueError(f'{artefato}: não há nada para ler.')

        teto = self._sub_teto_parte(quem)
        inteiro = '\n\n'.join(f'--- {nome} ---\n{corpo}' for nome, corpo in partes)

        if not (isinstance(parte, str) and parte.strip()):
            if contar_tokens(inteiro) <= teto:
                return inteiro
            return partes_artefato.indice_das_partes(artefato, partes)

        try:
            indice = partes_artefato.casar_parte(partes, parte)
        except ValueError as e:
            # A dica só sai quando o pedido PARECE ARQUIVO (tem extensão). Para
            # um caminho de pasta errado a lista de sugestões já é a resposta
            # certa, e acrescentar "chame ler_doc_tecnica" ali só confundiria.
            if dica_arquivo and os.path.splitext(parte.strip())[1]:
                raise ValueError(f'{e} — {dica_arquivo}')
            raise
        nome, corpo = partes[indice]
        if rastro is not None:
            rastro.registrar_parte(artefato, indice + 1, len(partes))
        cabecalho = f'--- {nome} --- (parte {indice + 1} de {len(partes)})\n'
        return self._sub_cortar_avisando(cabecalho + corpo, teto)

    def _sub_conteudo_agente(self, project_name, id_rotina, arquivo, nome_agente):
        """O texto cru de um artefato de rotina. Erro claro se não foi gerado.

        `id_rotina` e `arquivo` vêm separados de propósito. Eram uma string só
        (`'pipeline/pipeline.md'`), que misturava o nome da PASTA — decidido em
        `caminhos.py` — com o nome do ARQUIVO, que é do agente. Quando a pasta
        mudou de nome, essas strings foram os únicos caminhos que não puderam
        ser trocados por uma chamada.
        """
        path = obter_pasta_da_rotina(project_name, id_rotina, arquivo)
        if not os.path.isfile(path):
            raise ValueError(f'{nome_agente} não gerado — peça ao usuário para rodar '
                             f'o agente na aba Agentes')
        with open(path, 'r', encoding='utf-8', errors='replace') as f:
            return f.read()

    def _sub_parece_binario(self, fpath):
        """Byte zero nos primeiros bytes é o sinal clássico de binário."""
        try:
            with open(fpath, 'rb') as f:
                return b'\x00' in f.read(GREP_BYTES_SNIFF)
        except Exception:
            return True

    @staticmethod
    def _sub_walk_escopo(bases):
        """os.walk sobre várias pastas, sem visitar a mesma duas vezes.

        Pastas de trabalho aninhadas são possíveis — o usuário pode ter marcado
        `Program` e `Program/Code`. Sem este controle, todo arquivo da segunda
        apareceria em dobro no resultado."""
        vistos = set()
        for base in bases:
            for dirpath, dirs, files in os.walk(base):
                chave = os.path.normcase(os.path.normpath(dirpath))
                if chave in vistos:
                    dirs.clear()
                    continue
                vistos.add(chave)
                yield dirpath, dirs, files
