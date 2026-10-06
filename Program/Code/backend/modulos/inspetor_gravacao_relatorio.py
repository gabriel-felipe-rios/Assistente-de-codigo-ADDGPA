from .constantes import *


# Teto de passos no relatório do fluxo: uma gravação longa vira um texto que
# nenhuma IA lê inteiro, e o começo do fluxo é o que importa. O que passar
# disso sai com aviso de corte — nunca em silêncio.
INSPETOR_MAXIMO_PASSOS = 20


class InspetorGravacaoRelatorioMixin:
    """O texto do fluxo gravado que vai pra área de transferência e daí pra
    uma IA externa. Separado de `inspetor_gravacao_teia.py` pela AMF."""

    def inspetor_montar_relatorio_gravacao(self, project_name, passos, instrucao):
        """Um texto com o fluxo inteiro: cada passo com elemento, âncora, teia
        e relações do arquivo. Enxuto por passo de propósito.

        A instrução é **opcional** — sem ela o relatório sai só com o contexto
        do fluxo, e copiar não depende de escrever nada. O que não é opcional é
        o aviso de corte: um fluxo maior que `INSPETOR_MAXIMO_PASSOS` sai
        truncado, e omitir isso faria o relatório mentir sobre o tamanho do que
        foi gravado."""
        try:
            passos = passos or []
            if not passos:
                return {'success': False, 'error': 'Nenhum passo pra montar o relatório.'}
            partes = []
            instrucao = (instrucao or '').strip()
            if instrucao:
                partes.append('Instrução: %s' % instrucao)
                partes.append('')
            partes.append('Contexto — fluxo gravado no Inspetor. Cada passo é uma ação; abaixo '
                          'dela, o que aquele elemento dispara no código, quem o aciona e as '
                          'relações do arquivo (reconstruído estaticamente do projeto).')
            partes.append('')
            mostrados = passos[:INSPETOR_MAXIMO_PASSOS]
            for i, p in enumerate(mostrados, 1):
                self._insp_grav_relatorio_passo(partes, i, p)
            if len(passos) > len(mostrados):
                partes.append('(Fluxo cortado: mostrando os %d primeiros de %d passos '
                              'gravados. Remova na tela os passos que não interessam '
                              'pra encaixar os que faltam.)'
                              % (len(mostrados), len(passos)))
                partes.append('')
            texto = '\n'.join(partes).rstrip() + '\n'
            return {'success': True, 'texto': texto}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _insp_grav_relatorio_passo(self, partes, i, p):
        elem = p.get('elemento') or {}
        marca = ' [sem nome]' if p.get('sem_nome') else ''
        partes.append('── Passo %d: %s%s' % (i, p.get('rotulo') or '', marca))
        if elem.get('name'):
            partes.append('   Elemento: %s (%s)' % (elem.get('name'), elem.get('control_type') or '—'))
        anchor = p.get('anchor')
        if anchor:
            partes.append('   Âncora no código: %s:%s — %s (%s)' % (
                anchor.get('file'), anchor.get('line'), anchor.get('name', ''), anchor.get('type', '')))
        else:
            partes.append('   Âncora no código: (não localizado — a IA localiza pelo nome acima)')
        teia = p.get('teia') or {}
        rel = teia.get('relacoes') or {}

        # → Quem eu uso: símbolos que o handler chama + arquivos que o arquivo usa.
        dispara = teia.get('dispara') or []
        usa = rel.get('usa') or []
        if dispara or usa:
            partes.append('   → Quem eu uso (o que este código aciona):')
            for d in dispara:
                partes.append('       - %s — %s:%s' % (d.get('name'), d.get('file'), d.get('line')))
            for u in usa:
                partes.append('       - arquivo %s (%s)' % (u.get('arquivo'), ', '.join(u.get('via', [])[:4])))

        # ← Quem me usa: símbolos que chamam o âncora + arquivos que usam o arquivo.
        acionado = teia.get('acionado_por') or []
        usado = rel.get('usado_por') or []
        if acionado or usado:
            partes.append('   ← Quem me usa (quem aciona este código):')
            for a in acionado:
                partes.append('       - %s:%s — %s' % (a.get('file'), a.get('line'), a.get('snippet', '')))
            for u in usado:
                partes.append('       - arquivo %s (%s)' % (u.get('arquivo'), ', '.join(u.get('via', [])[:4])))
        partes.append('')
