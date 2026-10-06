from .constantes import *

# Quantos candidatos a resolução pede por passo. É de propósito MUITO mais que
# o limite da tela do Capturar (5): a reordenação por lente de UI acontece
# aqui, depois do corte do backend, então a âncora certa precisa ainda estar
# dentro da lista quando ela chegar.
_INSP_GRAV_CANDIDATOS_POR_PASSO = 30


class InspetorGravacaoResolucaoMixin:
    """Resolver a teia: pra cada passo gravado, achar a âncora no código e
    montar a teia de relações.

    É a etapa cara da Gravação — uma busca de candidatos por passo, cada uma
    varrendo os índices inteiros. Por isso deixou de ser algo que o "Parar"
    disparava por conta própria: virou uma ação separada, que **reporta
    progresso** e **pode ser abandonada**. Antes, parar uma gravação de 40
    passos travava a interface sem dizer nada e sem volta.
    """

    def inspetor_gravacao_resolver(self, project_name, passos):
        """Dispara a resolução em thread separada. Retorna na hora com o total;
        o progresso e o resultado chegam por `_insp_grav_notify` ->
        `inspetorGravacaoEvento` no JS, nos tipos `resolvendo`, `resolvido` e
        `resolucao_cancelada`."""
        passos = passos or []
        if not passos:
            return {'success': False, 'error': 'Nenhum passo pra resolver.'}
        if getattr(self, '_insp_grav_resolvendo', False):
            return {'success': False, 'error': 'Já existe uma resolução em andamento.'}
        self._insp_grav_resolvendo = True

        def worker():
            try:
                self._insp_grav_loop_resolucao(project_name, passos)
            except Exception as e:
                self._insp_grav_notify({'tipo': 'erro', 'erro': str(e)})
            finally:
                self._insp_grav_resolvendo = False

        threading.Thread(target=worker, daemon=True).start()
        return {'success': True, 'total': len(passos)}

    def inspetor_gravacao_cancelar_resolucao(self):
        """Desistir no meio. O que já foi resolvido não é jogado fora: volta
        pela mesma porta, no evento `resolucao_cancelada`."""
        self._insp_grav_resolvendo = False
        return {'success': True}

    def _insp_grav_loop_resolucao(self, project_name, passos):
        resolvidos = []
        total = len(passos)
        for i, passo in enumerate(passos, 1):
            if not self._insp_grav_resolvendo:
                self._insp_grav_notify(
                    {'tipo': 'resolucao_cancelada', 'passos': resolvidos})
                return
            self._insp_grav_notify({'tipo': 'resolvendo', 'feito': i, 'total': total})
            resolvidos.append(self._insp_grav_resolver_passo(project_name, passo))
        self._insp_grav_notify({'tipo': 'resolvido', 'passos': resolvidos})

    def _insp_grav_resolver_passo(self, project_name, passo):
        captura = passo.get('relatorio') or {}
        busca = self.inspetor_buscar_candidatos(
            project_name, captura, limite=_INSP_GRAV_CANDIDATOS_POR_PASSO)
        candidatos = busca.get('candidatos', []) if busca.get('success') else []

        # Reordena com lente de UI pra âncora automática cair certeira:
        # elemento real cujo TEXTO visível bate com o rótulo clicado ganha de
        # um casamento textual solto ou de um atributo.
        uia = captura.get('uia') or {}
        rotulo = uia.get('name') or uia.get('texto') or ''
        candidatos = self._insp_grav_reordenar_candidatos(candidatos, rotulo)
        anchor = candidatos[0] if candidatos else None

        return {
            'n': passo.get('n'),
            'acao': passo.get('acao') or 'clique',
            'sem_nome': bool(passo.get('sem_nome')),
            'rotulo': passo.get('rotulo') or '',
            'elemento': uia,
            'candidatos': candidatos,
            'anchor': anchor,
            'teia': self._insp_grav_teia(project_name, anchor),
        }
