"""Ler um alvo nomeado: o arquivo do usuário, e os artefatos que as rotinas geram.

`ler_arquivo` lê o código; as outras quatro leem o que uma rotina do programa já
escreveu — o índice de navegação, o pipeline, o grafo de imports e o glossário.
Ficam juntas porque todas respondem a mesma
pergunta com o mesmo mecanismo: **um alvo com nome, servido em partes quando não
cabe**, com sugestão de nome parecido quando o modelo erra o alvo.

A documentação técnica e o resumo de pastas saíram daqui em 2026-09: são lidos
POR SEÇÃO, de vários alvos numa chamada, em `ferramentas_subagentes_secoes.py`.

⚠️ ARTEFATO GRANDE NÃO É CORTADO: É SERVIDO EM PARTES COM NOME
(`_sub_servir_partes`, em `_apoio.py`). Sem parte, a resposta é o ÍNDICE das
partes; com parte errada, cinco nomes parecidos. Cortar um índice de navegação
ao meio daria ao modelo uma árvore que ele acha completa.

⚠️ O PIPELINE É A EXCEÇÃO: é lido POR NÍVEL (Visão geral → área → bloco →
cadeia), não em partes — a leitura inteira mora em `pipeline_niveis_leitura.py`.

⚠️ ARTEFATO QUE NÃO EXISTE DIZ QUAL AGENTE O GERA. É a diferença entre o modelo
desistir da linha de investigação e o usuário receber "peça para rodar o agente
X na aba Automação".
"""

from modulos.agentes.ferramentas_subagentes_constantes import *
from modulos.agentes import pipeline_niveis_leitura


class FerramentasSubagentesLeituraMixin:

    def _ferr_ler_arquivo(self, project_name, caminho, linhas=None, quem=LEITOR_LM_STUDIO):
        # `quem` é quem está perguntando. O padrão é o LM Studio (subagente do
        # Chat ou da Fila); o servidor MCP passa `'externo'` — e é só isso que
        # faz um arquivo marcado "só o assistente externo" aparecer para ele e
        # continuar sumido para o chat interno.
        root = self._sub_root_folder(project_name)
        full = self._sub_validar_caminho(root, caminho)
        escopo = self._sub_escopo(project_name)
        # O escopo vem ANTES da existência: um caminho fora das pastas de
        # trabalho não é "não encontrado", e responder isso ensinaria o modelo
        # a duvidar de um arquivo que existe.
        if not self._sub_dentro_do_escopo(escopo, full):
            raise self._sub_erro_fora_do_escopo(project_name, caminho, escopo)
        # "Removido" também vem antes de "não encontrado", e pelo mesmo motivo:
        # a lista casa por prefixo de caminho, exista o arquivo ou não. Foi
        # esta ordem invertida que respondeu "arquivo não encontrado" para
        # `Program/Internal/config/settings.json` e deixou o modelo concluir
        # que a pasta estava vazia.
        # ⚠️ A descrição vem ANTES do "removidos", e a ordem é a regra: havendo
        # "contexto sem leitura", é a frase do usuário que sai — esteja o caminho
        # também na lista de removidos ou não. É exatamente para isso que ela
        # existe. Antes o `raise` de removidos vinha primeiro e comia a descrição
        # de `Program/Internal`, que está nas duas listas — e a frase gravada no
        # Workspace.json não chegava ao modelo por caminho nenhum.
        desc = self._get_ctx_desc(full, self._sub_ctx_descs(project_name, quem))
        if desc:
            return (f'Arquivo marcado como "contexto sem leitura" — o conteúdo não deve ser lido. '
                    f'Descrição fornecida pelo usuário:\n{desc}')
        if self._sub_ignore_checker(project_name, quem)(full):
            raise ValueError(f'"{caminho}" está na lista de removidos deste projeto — '
                             'o usuário tirou essa pasta do escopo de propósito, então '
                             'não dá para afirmar nada sobre o que há nela')
        if not os.path.isfile(full):
            raise ValueError(f'arquivo não encontrado: {caminho}')
        with open(full, 'r', encoding='utf-8', errors='replace') as f:
            todas = f.read().splitlines()
        total = len(todas)

        # ⚠️ O teto vale para OS DOIS caminhos, e é essa a correção. Antes ele
        # existia só enquanto o modelo não pedia nada: o ramo do parâmetro
        # `linhas` devolvia o intervalo sem conferir tamanho nenhum, e
        # "linhas": "1-99999" trazia o arquivo inteiro. Pior, a mensagem de
        # truncamento do outro ramo ensinava o modelo a usar o parâmetro. O
        # teto estava invertido: apertava no caso normal e soltava no perigoso.
        teto = self._sub_teto_ler_arquivo(quem)

        if linhas:
            import re as _re
            m = _re.fullmatch(r'\s*(\d+)\s*-\s*(\d+)\s*', str(linhas))
            if not m:
                raise ValueError(f'parâmetro "linhas" inválido: "{linhas}" — use o formato "100-300"')
            ini, fim = int(m.group(1)), int(m.group(2))
            if ini < 1 or fim < ini:
                raise ValueError(f'intervalo de linhas inválido: "{linhas}"')
            selecao = todas[ini - 1:fim]
            # ⚠️ Faixa INTEIRAMENTE fora do arquivo. Sem isto a função devolvia
            # `(vazio)`: três tokens que não dizem nada e não dão pista nenhuma
            # do que fazer a seguir. O rodapé "(arquivo tem N linhas no total)"
            # logo abaixo só aparece quando há ALGUMA linha para mostrar — justo
            # o caso em que ele não faz falta.
            if not selecao:
                return (f'a faixa {ini}-{fim} está fora do intervalo: o arquivo '
                        f'tem {total} linhas')
            aviso = '' if fim >= total else f'\n\n(arquivo tem {total} linhas no total)'
            corpo = '\n'.join(f'{n}: {l}' for n, l in enumerate(selecao, ini))
            return self._sub_cortar_avisando(corpo + aviso, teto,
                                             ' — peça um intervalo menor em "linhas"')

        corpo = '\n'.join(f'{n}: {l}' for n, l in enumerate(todas, 1))
        return self._sub_cortar_avisando(
            corpo, teto, f' — o arquivo tem {total} linhas; use o parâmetro '
                         '"linhas", ex. "1-200", para ler por partes')

    def _ferr_ler_indice(self, project_name, parte=None, filtro=None, rastro=None,
                         quem=LEITOR_LM_STUDIO):
        # ⚠️ Era a ÚNICA das quatro irmãs sem `quem` — `_ferr_ler_pipeline`,
        # `_ferr_ler_grafo_imports` e `_ferr_ler_resumo_pastas` já o tinham. Era
        # sobra da propagação, não escolha de desenho, e era o que fazia o índice
        # de navegação ser servido ao assistente externo pelo teto do chat local.
        # Parâmetro com padrão no fim: o despachante dos subagentes continua
        # chamando com quatro posicionais, sem mudança nenhuma.
        conteudo = self._sub_conteudo_agente(project_name, 'indice-navegacao',
                                             'indice-navegacao.md',
                                             'índice de navegação')
        partes = partes_artefato.dividir_por_cabecalho(conteudo)
        # O Buscador pediu três vezes seguidas caminhos de ARQUIVO
        # (`chat_persistencia.py`, `chat_mensagem.py`) e não deduziu a regra a
        # partir das sugestões, que são todas pastas. Agora a regra vem escrita.
        # ⚠️ O `quem` VAI POR PALAVRA-CHAVE. Esta chamada já PULA a posição dele
        # para chegar no `dica_arquivo`; mandá-lo posicional trocaria o argumento
        # de lugar, em silêncio.
        return self._sub_servir_partes('índice de navegação', partes,
                                       parte, filtro, rastro, quem=quem,
                                       dica_arquivo='o índice é por PASTA (uma linha '
                                       'por arquivo dela). Para um arquivo, chame '
                                       '`ler_doc_tecnica` (no MCP, `doc_tecnica`) com '
                                       '{"ler": {"<este caminho>": "sintese"}}.')

    def _ferr_ler_pipeline(self, project_name, parte=None, filtro=None, rastro=None,
                           quem=LEITOR_LM_STUDIO):
        # O Pipeline em níveis — sem `parte` a Visão geral; "A1"/"B1"/"C1" o
        # nível; "C1:2" a página 2; `filtro` = um arquivo → as cadeias dele.
        # É a leitura ÚNICA do subagente (`ler_pipeline`) e do MCP (`pipeline`):
        # entre os dois muda só o teto, que vem de QUEM pergunta.
        pasta = obter_pasta_da_rotina(project_name, 'pipeline')
        texto, lida = pipeline_niveis_leitura.servir(pasta, parte, filtro,
                                                     self._sub_teto_parte(quem))
        # Só a leitura de um NÍVEL entra no rastro, como antes só a de uma parte.
        if lida and rastro is not None:
            rastro.registrar_parte('pipeline', *lida)
        return texto

    def _ferr_ler_grafo_imports(self, project_name, parte=None, rastro=None,
                                quem=LEITOR_LM_STUDIO):
        conteudo = self._sub_conteudo_agente(project_name, 'grafo-imports',
                                             'grafo.json', 'grafo de imports')
        try:
            dados = json.loads(conteudo)
        except Exception:
            # Grafo ilegível não é motivo para não devolver nada: serve o texto
            # cru dentro do teto, que ainda é melhor que um erro seco.
            return self._sub_cortar_avisando(conteudo, self._sub_teto_parte(quem))
        partes = partes_artefato.dividir_grafo_por_pasta(dados)
        return self._sub_servir_partes('grafo de imports', partes, parte,
                                       rastro=rastro, quem=quem)

    def _ferr_ler_glossario(self, project_name, termo=None, topico=None):
        """O glossário em pedaços: a linha de um termo, um tópico inteiro, ou o
        índice dos tópicos — nunca o glossário inteiro de uma vez (D40).

        É a leitura única do subagente (`ler_glossario`) e do MCP `glossario`:
        um glossário grande não enche a janela de quem pergunta.
        """
        caminho = obter_pasta_da_rotina(project_name, 'glossario', 'glossario.md')
        if not os.path.isfile(caminho):
            raise ValueError('glossário não gerado — peça ao usuário para rodar o '
                             'Glossário na aba Automação')
        with open(caminho, 'r', encoding='utf-8', errors='replace') as f:
            texto = f.read()

        # As seções `### Tópico`, cada uma com o cabeçalho da tabela e as linhas.
        secoes = []
        for linha in texto.splitlines():
            if linha.startswith('### '):
                secoes.append({'titulo': linha[4:].strip(), 'cabecalho': [], 'linhas': []})
            elif secoes and linha.startswith('|'):
                if len(secoes[-1]['cabecalho']) < 2:
                    secoes[-1]['cabecalho'].append(linha)
                else:
                    secoes[-1]['linhas'].append(linha)

        def celula_do_termo(linha):
            return linha.strip('|').split('|', 1)[0].strip().strip('`').strip()

        indice = ', '.join('%s (%d)' % (s['titulo'], len(s['linhas'])) for s in secoes)
        if termo:
            # Caixa e acento não separam termo (D12, D23): «Aparencia» acha
            # «aparência». A chave é a MESMA com que a Documentação Técnica e o
            # Glossário juntam os termos — `_dt_chave_do_termo`, criada pela
            # fase 01 em `documentacao_tecnica_render.py`; chega aqui por
            # `self.` porque os dois mixins compõem a mesma classe `Api`.
            alvo = self._dt_chave_do_termo(termo)
            achados = []
            for s in secoes:
                linhas = [l for l in s['linhas']
                          if self._dt_chave_do_termo(celula_do_termo(l)) == alvo]
                if linhas:
                    achados.append('\n'.join(['### ' + s['titulo']] + s['cabecalho'] + linhas))
            if not achados:
                return f'Termo "{termo}" não está no glossário. Tópicos: {indice}'
            return '\n\n'.join(achados)
        if topico:
            # O tópico também: «Peca do codigo» acha «Peça do código».
            alvo = self._dt_chave_do_termo(topico)
            for s in secoes:
                if self._dt_chave_do_termo(s['titulo']) == alvo:
                    return '\n'.join(['### ' + s['titulo']] + s['cabecalho'] + s['linhas'])
            return f'Tópico "{topico}" não está no glossário. Tópicos: {indice}'
        return '\n'.join(['Tópicos do glossário:']
                         + ['- %s: %d termo(s)' % (s['titulo'], len(s['linhas'])) for s in secoes]
                         + ['', 'Passe "termo" para a linha de um termo, ou "topico" para um tópico inteiro.'])
