"""Os handlers das 8 ferramentas do servidor MCP Trabalhos (o Quadro).

Cada ferramenta é uma função `handler(api, project, args) -> str`. Os nomes de
função Python continuam com o prefixo `tool_trabalhos_*` (é só ligação
interna); o `name` exposto ao assistente externo, sem prefixo
(`quadro`, `criar`, `mover`, `tarefas`, `marcar`, `anotar`, `tag`, `chamar`),
vem do catálogo — ver `backend/modulos/catalogo_mcp.py`.

⚠️ **A LISTA não mora aqui.** Nome, descrição, schema e metadados de cada
ferramenta estão em `catalogo_mcp.py`, que é a fonte única. Aqui ficam só as
FUNÇÕES, e o `TOOLS` do fim do arquivo casa uma coisa na outra pelo campo
`fn_name`.

# ⚠️ AS PRIMEIRAS FERRAMENTAS DE ESCRITA DO PROGRAMA. O que muda no cuidado:
#
#  1. CONFINAMENTO. Nenhuma delas aceita caminho vindo do `args`. O que elas
#     escrevem é sempre `Trabalhos/Estado.json` do `project` com que o servidor
#     subiu — um caminho que o `caminhos.py` monta, e que o modelo não tem como
#     influenciar. Escrever código-fonte do usuário não é possível por aqui.
#
#  2. O `project` É O DO PROCESSO, não um parâmetro. O servidor recebe
#     `--project` na linha de comando e passa o mesmo valor a todo handler; não
#     existe argumento de projeto no schema de nenhuma das oito, então um
#     terminal aberto no projeto A não alcança o Quadro do projeto B.
#
#  3. RECUSA COM A LISTA JUNTO. Coluna, tag e gatilho são vocabulário fechado.
#     Quando o modelo erra o valor, a mensagem traz os valores aceitos — errar
#     de novo por não saber quais eram é rodada queimada à toa.
#
# ⚠️ Os métodos `_trab_*` da `Api` levantam `ValueError` com a mensagem escrita
# para o modelo ler, exatamente como os `_ferr_*`. Por isso passam pelo mesmo
# `erro_util` — sem ele o `servidor.py` os embrulharia num "Erro na ferramenta
# X: …", trocando uma instrução por um rótulo.
#
# ⚠️ Este servidor NÃO importa `carimbo_frescor`: todas as oito são
# `fonte: 'vivo'` no catálogo — leem e gravam o `Estado.json` na hora, então
# nunca há artefato velho a carimbar.
"""

import os
import sys

_SERVER_DIR = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
if _SERVER_DIR not in sys.path:
    sys.path.insert(0, _SERVER_DIR)

_BACKEND = os.path.normpath(os.path.join(_SERVER_DIR, '..', 'backend'))
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

from comum import erro_util, montar_tools  # noqa: E402
from modulos.catalogo_mcp import CATALOGO_MCP  # noqa: E402


def _trab_linha_da_atividade(a):
    """Uma atividade em uma linha, com o que decide a próxima ação."""
    partes = ['%s · %s' % (a.get('id'), a.get('titulo') or '(sem nome)')]
    if a.get('pasta'):
        partes.append('pasta: %s' % a['pasta'])
    if a.get('tags'):
        partes.append('tags: %s' % ', '.join(a['tags']))
    if a.get('depende_de'):
        partes.append('depende de: %s' % ', '.join(a['depende_de']))
    tarefas = a.get('tarefas') or []
    if tarefas:
        feitas = sum(1 for t in tarefas if t.get('estado') == 'feita')
        partes.append('tarefas: %d/%d' % (feitas, len(tarefas)))
    if a.get('motivo_do_portao'):
        partes.append('parou para perguntar: %s' % a['motivo_do_portao'])
    return ' | '.join(partes)


def _trab_detalhe_da_atividade(a):
    """A atividade inteira, para a resposta de quem acabou de mexer nela.

    Devolver o estado que ficou (e não um "ok") é o que evita a chamada
    seguinte só para reler o que a anterior já sabia.
    """
    linhas = [_trab_linha_da_atividade(a), 'coluna: %s' % a.get('coluna')]
    if a.get('resumo'):
        linhas.append('resumo: %s' % a['resumo'])
    for i, t in enumerate(a.get('tarefas') or []):
        linhas.append('  [%d] %s — %s' % (i, t.get('texto'), t.get('estado')))
    if a.get('arquivos'):
        linhas.append('arquivos: %s' % ', '.join(a['arquivos']))
    return '\n'.join(linhas)


def tool_trabalhos_quadro(api, project, args):
    from modulos.catalogo_trabalhos import COLUNAS_DO_QUADRO, IDS_DAS_COLUNAS
    filtro = (args.get('coluna') or '').strip()
    if filtro and filtro not in IDS_DAS_COLUNAS:
        return ('A coluna "%s" não existe. As que existem são: %s.'
                % (filtro, ', '.join(IDS_DAS_COLUNAS)))

    def montar():
        estado = api._trab_carregar(project)
        atividades = estado.get('atividades') or []
        if not atividades:
            return ('O Quadro está vazio. Use `criar` para registrar a '
                    'primeira atividade.')
        blocos = []
        for coluna in COLUNAS_DO_QUADRO:
            if filtro and coluna['id'] != filtro:
                continue
            desta = [a for a in atividades if a.get('coluna') == coluna['id']]
            if not desta:
                continue
            blocos.append('## %s (%s) — %d'
                          % (coluna['rotulo'], coluna['id'], len(desta)))
            blocos.extend('  ' + _trab_linha_da_atividade(a) for a in desta)
        if not blocos:
            return 'Nenhuma atividade nessa coluna.'
        return '\n'.join(blocos)

    return erro_util(montar)


def tool_trabalhos_criar(api, project, args):
    titulo = (args.get('titulo') or '').strip()
    if not titulo:
        return 'Informe o parâmetro "titulo".'
    return erro_util(lambda: 'Criada: ' + _trab_detalhe_da_atividade(
        api._trab_criar_pelo_orquestrador(
            project, titulo,
            pasta=(args.get('pasta') or ''),
            resumo=(args.get('resumo') or ''),
            briefing=(args.get('briefing') or ''))))


def tool_trabalhos_mover(api, project, args):
    from modulos.catalogo_trabalhos import COLUNA_DO_PORTAO, IDS_DAS_COLUNAS
    atividade = (args.get('atividade') or '').strip()
    coluna = (args.get('coluna') or '').strip()
    if not atividade:
        return 'Informe o parâmetro "atividade" (o id, ex. A-101).'
    if coluna == COLUNA_DO_PORTAO:
        # Mandar para o Portão sem motivo escrito deixaria o usuário obrigado a
        # reabrir o terminal para descobrir o que houve. A ferramenta certa
        # exige o motivo, então esta recusa e aponta para ela.
        return ('Para parar e chamar o usuário use `chamar`: ela exige o '
                'motivo, e um cartão em "Precisa de você" sem motivo não diz nada '
                'a quem for atendê-lo.')
    if coluna not in IDS_DAS_COLUNAS:
        return ('A coluna "%s" não existe. As que você pode usar aqui são: %s.'
                % (coluna, ', '.join(c for c in IDS_DAS_COLUNAS if c != COLUNA_DO_PORTAO)))
    return erro_util(lambda: 'Movida: ' + _trab_detalhe_da_atividade(
        api._trab_mover_pelo_orquestrador(project, atividade, coluna)))


def tool_trabalhos_tarefas(api, project, args):
    atividade = (args.get('atividade') or '').strip()
    tarefas = args.get('tarefas')
    if not atividade:
        return 'Informe o parâmetro "atividade" (o id, ex. A-101).'
    if not isinstance(tarefas, list):
        return 'O parâmetro "tarefas" precisa ser uma lista de textos.'
    return erro_util(lambda: 'Tarefas definidas: ' + _trab_detalhe_da_atividade(
        api._trab_definir_tarefas(project, atividade, tarefas)))


def tool_trabalhos_marcar(api, project, args):
    atividade = (args.get('atividade') or '').strip()
    if not atividade:
        return 'Informe o parâmetro "atividade" (o id, ex. A-101).'
    indice = args.get('tarefa')
    # ⚠️ `True` é `int` em Python, e `isinstance(True, int)` passa. Sem esta
    # linha, `{"tarefa": true}` viraria a tarefa de índice 1 em silêncio.
    if isinstance(indice, bool) or not isinstance(indice, int):
        return 'O parâmetro "tarefa" é a posição na lista, começando em 0.'
    estado = (args.get('estado') or '').strip()
    return erro_util(lambda: 'Marcada: ' + _trab_detalhe_da_atividade(
        api._trab_marcar_tarefa(project, atividade, indice, estado)))


def tool_trabalhos_anotar(api, project, args):
    atividade = (args.get('atividade') or '').strip()
    if not atividade:
        return 'Informe o parâmetro "atividade" (o id, ex. A-101).'
    arquivos = args.get('arquivos')
    depende_de = args.get('depende_de')
    if arquivos is not None and not isinstance(arquivos, list):
        return 'O parâmetro "arquivos" precisa ser uma lista de caminhos.'
    if depende_de is not None and not isinstance(depende_de, list):
        return 'O parâmetro "depende_de" precisa ser uma lista de ids de atividade.'
    return erro_util(lambda: 'Anotada: ' + _trab_detalhe_da_atividade(
        api._trab_anotar(project, atividade, resumo=args.get('resumo'),
                         arquivos=arquivos, depende_de=depende_de)))


def tool_trabalhos_tag(api, project, args):
    atividade = (args.get('atividade') or '').strip()
    tag = (args.get('tag') or '').strip()
    if not atividade:
        return 'Informe o parâmetro "atividade" (o id, ex. A-101).'
    if not tag:
        return 'Informe o parâmetro "tag".'
    # Ausência vira `True`: a ação natural é MARCAR, e quem quer desmarcar diz.
    ligar = args.get('ligar')
    ligar = True if ligar is None else bool(ligar)
    return erro_util(lambda: 'Tags: ' + _trab_detalhe_da_atividade(
        api._trab_marcar_tag(project, atividade, tag, ligar)))


def tool_trabalhos_chamar(api, project, args):
    atividade = (args.get('atividade') or '').strip()
    gatilho = (args.get('gatilho') or '').strip()
    motivo = (args.get('motivo') or '').strip()
    if not atividade:
        return 'Informe o parâmetro "atividade" (o id, ex. A-101).'
    if not gatilho:
        return 'Informe o parâmetro "gatilho".'
    if not motivo:
        return ('Informe o parâmetro "motivo": um cartão em "Precisa de você" sem '
                'motivo escrito obriga o usuário a reabrir o terminal para descobrir '
                'o que houve.')
    return erro_util(lambda: (
        'Parado, esperando o usuário. Não siga adiante nesta atividade.\n'
        + _trab_detalhe_da_atividade(
            api._trab_abrir_portao(project, atividade, gatilho, motivo))))


# ══════════════════════════════════════════════════════════ A montagem final ══
_CATALOGO_TRABALHOS = [f for f in CATALOGO_MCP if f['servidor'] == 'trabalhos']
TOOLS = montar_tools(_CATALOGO_TRABALHOS, globals())
