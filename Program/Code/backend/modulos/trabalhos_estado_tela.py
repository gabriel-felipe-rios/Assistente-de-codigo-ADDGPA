"""A API que a TELA chama (pywebview): criar, mover, excluir, editar atividade.

Separado da API do MCP (`trabalhos_estado_mcp.py`) porque quem chama é outro, e
o que se pode fazer é outro: aqui é o usuário na frente da tela, lá é o
Orquestrador rodando num segundo processo.

⚠️ TODA ESCRITA PASSA POR `_trab_transacao` (na casca). Ela segura a trava entre
processos, recarrega do disco, entrega para mexer e grava atomicamente — e
regenera o `Quadro.md` no fim. Um caminho de escrita fora dela perde a corrida
com o servidor MCP, e o sintoma é um cartão que "volta sozinho".
"""

from .trabalhos_estado_gravacao import *
# `_agora` começa com `_` e o `import *` acima não a traz — mesmo molde de
# `trabalhos_estado.py`.
from .trabalhos_estado_gravacao import _agora
# M4 · o barramento das extensões. Importado como MÓDULO, e não a função
# solta: `xt_eventos.emitir(...)` diz de onde o aviso sai, e um `emitir`
# nu no meio deste arquivo seria confundido com emissão interna do
# programa na primeira leitura de quem não conhece a camada.
from .extensoes import eventos as xt_eventos



class TrabalhosEstadoTelaMixin:

    # ── A API da tela (pywebview) ────────────────────────────────────────────

    def carregar_trabalhos(self, project_name):
        try:
            estado = self._trab_carregar(project_name)
            return {'success': True, 'atividades': estado['atividades']}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def criar_atividade(self, project_name, titulo, pasta='', resumo='', briefing='',
                        autoria=AUTORIA_USUARIO):
        """Cria um cartão. SEMPRE em "Na fila" — não há como nascer em outra
        coluna, nem pela tela nem pelo MCP.
        """
        try:
            titulo = (titulo or '').strip()
            if not titulo:
                return {'success': False, 'error': 'A atividade precisa de um nome.'}
            if autoria not in IDS_DAS_AUTORIAS:
                autoria = AUTORIA_USUARIO
            with self._trab_transacao(project_name) as estado:
                atividade = self._trab_nova_atividade(
                    estado['proximo_numero'], titulo, (pasta or '').strip(),
                    (resumo or '').strip(), (briefing or '').strip(), autoria)
                if atividade['briefing']:
                    atividade['tags'].append('briefing')
                estado['proximo_numero'] += 1
                estado['atividades'].append(atividade)
            return {'success': True, 'atividade': atividade}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def mover_atividade(self, project_name, id_atividade, coluna):
        try:
            if coluna not in IDS_DAS_COLUNAS:
                return {'success': False, 'error': f'Coluna desconhecida: {coluna}'}
            with self._trab_transacao(project_name) as estado:
                atividade = self._trab_achar(estado, id_atividade)
                if atividade is None:
                    return {'success': False, 'error': f'Atividade não encontrada: {id_atividade}'}
                # Guardado ANTES da troca: é a metade da informação que o
                # evento M4 carrega, e depois desta linha ela não existe mais.
                coluna_de_onde = atividade['coluna']
                atividade['coluna'] = coluna
                atividade['atualizado_em'] = _agora()
                if coluna == 'fazendo' and not atividade['iniciado_em']:
                    atividade['iniciado_em'] = _agora()
                if coluna in ('revisar', 'desistido'):
                    atividade['concluido_em'] = _agora()
                # Sair do Portão limpa o motivo: um motivo velho pendurado num
                # cartão que já voltou a andar é pior que nenhum — a tela o
                # mostraria como se ele ainda estivesse parado esperando.
                if coluna != COLUNA_DO_PORTAO:
                    atividade['motivo_do_portao'] = None
                    atividade['gatilho_do_portao'] = None
            # M4 · observador, e FORA da transação: gravado primeiro, avisado
            # depois. Emitir lá dentro faria a extensão ser avisada de um
            # movimento que uma exceção posterior ainda poderia desfazer.
            # Passo único de emissão — o caminho do Orquestrador
            # (`_trab_mover_pelo_orquestrador`) chama este mesmo método.
            if coluna_de_onde != coluna:
                xt_eventos.emitir('trabalhos.cartao_moveu', {
                    'projeto': project_name, 'id': id_atividade,
                    'de': coluna_de_onde, 'para': coluna})
            return {'success': True, 'atividade': atividade}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def excluir_atividade(self, project_name, id_atividade):
        try:
            with self._trab_transacao(project_name) as estado:
                antes = len(estado['atividades'])
                estado['atividades'] = [a for a in estado['atividades']
                                        if a.get('id') != id_atividade]
                if len(estado['atividades']) == antes:
                    return {'success': False, 'error': f'Atividade não encontrada: {id_atividade}'}
                # Quem dependia dela para de depender. Deixar o id pendurado
                # faria a atividade órfã esperar para sempre por algo que não
                # existe mais — e nada no programa avisaria.
                for a in estado['atividades']:
                    if id_atividade in a.get('depende_de', []):
                        a['depende_de'].remove(id_atividade)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def editar_atividade(self, project_name, id_atividade, campos):
        """Edição pela TELA. Só os campos que o usuário escreve — coluna, tags
        automáticas e carimbos de tempo não entram por aqui.
        """
        try:
            permitidos = ('titulo', 'pasta', 'resumo', 'briefing')
            with self._trab_transacao(project_name) as estado:
                atividade = self._trab_achar(estado, id_atividade)
                if atividade is None:
                    return {'success': False, 'error': f'Atividade não encontrada: {id_atividade}'}
                for chave, valor in (campos or {}).items():
                    if chave in permitidos:
                        atividade[chave] = (valor or '').strip()
                if atividade['briefing'] and 'briefing' not in atividade['tags']:
                    atividade['tags'].append('briefing')
                if not atividade['briefing'] and 'briefing' in atividade['tags']:
                    atividade['tags'].remove('briefing')
                atividade['autoria'] = AUTORIA_USUARIO
                atividade['atualizado_em'] = _agora()
            return {'success': True, 'atividade': atividade}
        except Exception as e:
            return {'success': False, 'error': str(e)}
