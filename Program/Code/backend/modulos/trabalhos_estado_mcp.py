"""A API do servidor MCP — só o Orquestrador chega aqui.

⚠️ RODA EM OUTRO PROCESSO. É essa a razão de o arquivo existir separado do da
tela: as mesmas oito ações, chamadas de fora do programa, sob a trava entre
processos. O que é de memória (quais terminais estão vivos, por exemplo) NÃO
existe deste lado — daqui, "quem está aberto" responde "ninguém" para todo mundo.

⚠️ É O ÚNICO CAMINHO DE ESCRITA DO AGENTE NO QUADRO, e é por isso que o agente
não escreve `Quadro.md` à mão: este caminho resolve concorrência, e um segundo
perderia escrita sem ninguém notar.

⚠️ O PORTÃO (`_trab_abrir_portao`) GUARDA O MOTIVO. Um cartão parado sem o porquê
visível é um cartão que ninguém sabe destravar — e o motivo é o que a tela põe
em destaque.
"""

from .trabalhos_estado_gravacao import *
# `_agora` começa com `_` e o `import *` acima não a traz — mesmo molde de
# `trabalhos_estado.py`.
from .trabalhos_estado_gravacao import _agora


class TrabalhosEstadoMcpMixin:

    # ── A API do servidor MCP (só o Orquestrador chega aqui) ─────────────────
    #
    # Estes são "puros": não tocam `self.window`, porque quem os chama é outro
    # processo, sem janela nenhuma. Devolvem dict; quem transforma em texto
    # para o modelo ler é o handler em `server/ferramentas_mcp.py`.

    def _trab_definir_tarefas(self, project_name, id_atividade, tarefas):
        with self._trab_transacao(project_name) as estado:
            atividade = self._trab_achar(estado, id_atividade)
            if atividade is None:
                raise ValueError(f'Atividade não encontrada: {id_atividade}')
            atividade['tarefas'] = [
                {'texto': str(t).strip(), 'estado': 'pendente'}
                for t in (tarefas or []) if str(t).strip()
            ]
            atividade['atualizado_em'] = _agora()
            return dict(atividade)

    def _trab_marcar_tarefa(self, project_name, id_atividade, indice, estado_da_tarefa):
        if estado_da_tarefa not in ('pendente', 'fazendo', 'feita'):
            raise ValueError('Estado de tarefa inválido: use pendente, fazendo ou feita.')
        with self._trab_transacao(project_name) as estado:
            atividade = self._trab_achar(estado, id_atividade)
            if atividade is None:
                raise ValueError(f'Atividade não encontrada: {id_atividade}')
            tarefas = atividade.get('tarefas') or []
            if not isinstance(indice, int) or not (0 <= indice < len(tarefas)):
                raise ValueError(
                    f'A atividade {id_atividade} tem {len(tarefas)} tarefa(s); '
                    f'não existe a de número {indice}.')
            tarefas[indice]['estado'] = estado_da_tarefa
            atividade['atualizado_em'] = _agora()
            return dict(atividade)

    def _trab_anotar(self, project_name, id_atividade, resumo=None, arquivos=None,
                     depende_de=None):
        with self._trab_transacao(project_name) as estado:
            atividade = self._trab_achar(estado, id_atividade)
            if atividade is None:
                raise ValueError(f'Atividade não encontrada: {id_atividade}')
            if resumo is not None:
                atividade['resumo'] = str(resumo).strip()
            if arquivos is not None:
                atividade['arquivos'] = [str(a).strip() for a in arquivos if str(a).strip()]
                # Tag automática: o programa a deriva de um fato que ele já
                # conhece. O agente não a marca à mão, e não pode desmarcá-la.
                if atividade['arquivos'] and 'arquivos' not in atividade['tags']:
                    atividade['tags'].append('arquivos')
            if depende_de is not None:
                ids = {a['id'] for a in estado['atividades']}
                pedidos = [str(d).strip() for d in depende_de if str(d).strip()]
                desconhecidos = [d for d in pedidos if d not in ids]
                if desconhecidos:
                    raise ValueError(
                        'Estas atividades não existem no Quadro: '
                        + ', '.join(desconhecidos))
                if id_atividade in pedidos:
                    raise ValueError('Uma atividade não pode depender de si mesma.')
                atividade['depende_de'] = pedidos
                if pedidos and 'dependencia' not in atividade['tags']:
                    atividade['tags'].append('dependencia')
                if not pedidos and 'dependencia' in atividade['tags']:
                    atividade['tags'].remove('dependencia')
            atividade['atualizado_em'] = _agora()
            return dict(atividade)

    def _trab_marcar_tag(self, project_name, id_atividade, tag, ligar=True):
        # ⚠️ Vocabulário FECHADO. Tag fora da lista é recusada com a lista
        # inteira na mensagem — ignorar em silêncio deixaria o agente achando
        # que marcou o cartão, e o cartão sem marca nenhuma.
        from .catalogo_trabalhos import IDS_DAS_TAGS_MANUAIS
        if tag not in IDS_DAS_TAGS_MANUAIS:
            automaticas = [t for t in IDS_DAS_TAGS if t not in IDS_DAS_TAGS_MANUAIS]
            raise ValueError(
                f'A tag "{tag}" não existe. As que você pode marcar são: '
                + ', '.join(IDS_DAS_TAGS_MANUAIS)
                + '. Estas o programa marca sozinho e você não mexe: '
                + ', '.join(automaticas) + '.')
        with self._trab_transacao(project_name) as estado:
            atividade = self._trab_achar(estado, id_atividade)
            if atividade is None:
                raise ValueError(f'Atividade não encontrada: {id_atividade}')
            if ligar and tag not in atividade['tags']:
                atividade['tags'].append(tag)
            if not ligar and tag in atividade['tags']:
                atividade['tags'].remove(tag)
            atividade['atualizado_em'] = _agora()
            return dict(atividade)

    def _trab_abrir_portao(self, project_name, id_atividade, gatilho, motivo):
        """O cartão para e chama o usuário. É a única saída para "não sei o que
        fazer" — o agente não decide sozinho o que estava fora do combinado.
        """
        from .catalogo_trabalhos import IDS_DOS_GATILHOS
        if gatilho not in IDS_DOS_GATILHOS:
            raise ValueError(
                f'Gatilho desconhecido: "{gatilho}". Os que existem são: '
                + ', '.join(IDS_DOS_GATILHOS) + '.')
        motivo = (motivo or '').strip()
        if not motivo:
            raise ValueError(
                'Diga o motivo. Um cartão em "Precisa de você" sem motivo escrito '
                'obriga o usuário a reabrir o terminal para descobrir o que houve.')
        with self._trab_transacao(project_name) as estado:
            atividade = self._trab_achar(estado, id_atividade)
            if atividade is None:
                raise ValueError(f'Atividade não encontrada: {id_atividade}')
            atividade['coluna'] = COLUNA_DO_PORTAO
            atividade['gatilho_do_portao'] = gatilho
            atividade['motivo_do_portao'] = motivo
            atividade['atualizado_em'] = _agora()
            return dict(atividade)

    def _trab_criar_pelo_orquestrador(self, project_name, titulo, pasta='', resumo='',
                                      briefing=''):
        r = self.criar_atividade(project_name, titulo, pasta, resumo, briefing,
                                 autoria=AUTORIA_ORQUESTRADOR)
        if not r.get('success'):
            raise ValueError(r.get('error') or 'não deu para criar a atividade')
        return r['atividade']

    def _trab_mover_pelo_orquestrador(self, project_name, id_atividade, coluna):
        r = self.mover_atividade(project_name, id_atividade, coluna)
        if not r.get('success'):
            raise ValueError(r.get('error') or 'não deu para mover a atividade')
        return r['atividade']

