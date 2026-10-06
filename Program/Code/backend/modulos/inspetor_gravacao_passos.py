import queue
from .constantes import *

# Verbo de cada ação no rótulo do passo. O rótulo é a única coisa que o
# usuário lê na lista ao vivo, então ele diz O QUE aconteceu, não o código
# interno da ação.
_INSP_GRAV_VERBO = {
    'clique': 'Clicou em',
    'clique_duplo': 'Clicou duas vezes em',
    'clique_direito': 'Clicou com o botão direito em',
    'clique_meio': 'Clicou com o botão do meio em',
}

# Como a ação aparece quando não deu pra nomear o elemento.
_INSP_GRAV_ACAO_LEGIVEL = {
    'clique': 'clique', 'clique_duplo': 'clique duplo',
    'clique_direito': 'clique direito', 'clique_meio': 'clique do meio',
    'rolagem': 'rolagem', 'tecla': 'tecla',
}


class InspetorGravacaoPassosMixin:
    """Do evento enfileirado pelo hook ao passo mostrado ao vivo na tela.

    É aqui que roda a consulta de UI Automation, que é cara — de propósito
    fora da thread do hook, que não pode atrasar (um hook de baixo nível lento
    engasga a entrada do Windows inteiro).

    Nenhum evento é descartado em silêncio. Clique que não dá pra nomear vira
    um passo **marcado**, não um passo que some: descartar calado era a causa
    exata da sensação de "cliquei e não aconteceu nada".
    """

    def _insp_grav_loop_resolver(self):
        """Consome a fila, captura o elemento e transmite o passo pro front ao
        vivo.

        A condição de parada inclui o hook e a fila: o "Parar" fecha a rolagem
        ou digitação que estava em aberto, e esses últimos eventos entram na
        fila DEPOIS de `_insp_grav_rodando` já ter virado `False`. Sair no
        primeiro `False` perderia justamente o fim do fluxo."""
        while (self._insp_grav_rodando or self._insp_grav_hook_vivo
               or not self._insp_grav_fila.empty()):
            try:
                evento = self._insp_grav_fila.get(timeout=0.2)
            except queue.Empty:
                continue

            x, y = evento.get('x', 0), evento.get('y', 0)
            try:
                relatorio = self._inspetor_capturar_elemento(x, y)
            except Exception as erro:
                falha = {'success': False, 'error': str(erro)}
                relatorio = {'uia': dict(falha), 'win32': dict(falha),
                             'ponto': {'x': x, 'y': y}, 'modo': 'controle'}

            uia = relatorio.get('uia') or {}
            tem_elemento = bool(uia.get('success') and (
                uia.get('name') or uia.get('texto') or uia.get('automation_id')))
            sem_nome = not (tem_elemento or evento.get('titulo'))

            # Duplo clique substitui o passo do clique simples que veio antes,
            # em vez de somar mais um: quem clica duas vezes fez UMA ação.
            if evento.get('substitui') and self._insp_grav_seq > 0:
                numero = self._insp_grav_seq
            else:
                self._insp_grav_seq += 1
                numero = self._insp_grav_seq

            passo = {
                'n': numero,
                'acao': evento.get('acao') or 'clique',
                'relatorio': relatorio,
                'rotulo': self._insp_grav_rotulo(evento, relatorio),
                'sem_nome': sem_nome,
            }
            self._insp_grav_notify({'tipo': 'passo', 'passo': passo,
                                    'substitui': bool(evento.get('substitui'))})

    def _insp_grav_rotulo(self, evento, relatorio):
        acao = evento.get('acao') or 'clique'
        uia = (relatorio or {}).get('uia') or {}
        win32 = (relatorio or {}).get('win32') or {}

        nome = (uia.get('name') or uia.get('texto') or '').strip()
        if not nome:
            # Reserva do teclado: quando o controle em foco não se deixa
            # identificar, o título da janela ainda diz onde a ação aconteceu.
            nome = (evento.get('titulo') or '').strip()
        if not nome:
            return self._insp_grav_rotulo_sem_nome(evento, uia)

        if acao == 'rolagem':
            return 'Rolou %s em «%s»' % (evento.get('detalhe') or 'a lista', nome)
        if acao == 'tecla':
            detalhe = evento.get('detalhe') or ''
            if detalhe == 'digitou':
                return 'Digitou em «%s»' % nome
            if '+' in detalhe:      # atalho: o nome do comando já é a frase
                return '%s em «%s»' % (detalhe, nome)
            return 'Apertou %s em «%s»' % (detalhe, nome)

        processo = win32.get('processo') or ''
        return '%s «%s»%s' % (_INSP_GRAV_VERBO.get(acao, 'Agiu em'), nome,
                              (' — %s' % processo) if processo else '')

    def _insp_grav_rotulo_sem_nome(self, evento, uia):
        """Rótulo do passo que não deu pra nomear.

        O passo entra na lista assim mesmo, marcado, e o usuário decide se
        remove. Continua sendo informação: as coordenadas e o tipo de controle
        dizem onde foi, e a IA consegue trabalhar com isso."""
        x, y = evento.get('x', 0), evento.get('y', 0)
        acao = _INSP_GRAV_ACAO_LEGIVEL.get(evento.get('acao'), 'ação')
        tipo = (uia.get('control_type') or '').strip()
        if tipo:
            return 'elemento sem nome — %s em (%d, %d) sobre %s' % (acao, x, y, tipo)
        return 'elemento não identificado — %s em (%d, %d)' % (acao, x, y)
