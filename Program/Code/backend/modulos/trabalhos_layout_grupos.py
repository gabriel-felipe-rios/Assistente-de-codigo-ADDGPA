"""Os grupos: a caixa com rótulo em volta de alguns nós.

⚠️ AGRUPAR NÃO AFETA EXECUÇÃO NENHUMA. Um grupo não cria ligação, não cria
dependência e não faz um nó esperar pelo outro. Grupo e ligação são conceitos
independentes, e um nó pode estar num grupo sem ligação nenhuma com os
vizinhos. É por isso que este arquivo e `_ligacoes.py` são dois.

⚠️ A FILIAÇÃO É POR GEOMETRIA, E RECALCULADA (`_trab_refiliar`). Quem está
dentro de que caixa não é uma lista que o usuário mantém: é o resultado de onde
as coisas estão. Guardar a filiação como verdade independente faria um nó
arrastado para dentro da caixa continuar oficialmente fora dela.

⚠️ A PODA (`_trab_podar_grupos`) TIRA GRUPO SEM MEMBRO. Uma caixa vazia
sobrevivendo à exclusão dos nós dela fica na tela como moldura de nada.
"""

from .trabalhos_layout_constantes import *


class TrabalhosLayoutGruposMixin:

    # ── Os grupos (Fase 5) ───────────────────────────────────────────────────
    #
    # ⚠️ AGRUPAR É ESTADO DE TELA, E NÃO AFETA EXECUÇÃO NENHUMA. Um grupo é uma
    # caixa com rótulo em volta de alguns nós, e só. Ele NÃO cria ligação, não
    # cria dependência, não faz um nó esperar pelo outro — grupo e ligação são
    # conceitos independentes, e um nó pode estar num grupo sem ter ligação
    # nenhuma com os vizinhos dele. Quem fizer o grupo passar a travar disparo
    # estará inventando uma quinta ligação por baixo do pano.
    #
    # ⚠️ UM NÓ ESTÁ EM UM GRUPO, NO MÁXIMO. É por isso que a filiação mora em
    # dois lugares de leitura oposta e complementar: `no['grupo']` (o nó diz de
    # quem é) e `grupo['nos']` (o grupo diz quem tem). Os dois são mantidos
    # juntos, sempre na mesma transação — e `_trab_podar_grupos` é quem conserta
    # se algum caminho os deixar em desacordo.
    #
    # ⚠️ A CAIXA É O DADO, E A LISTA DE MEMBROS É QUE É DERIVADA — e isto é o
    # INVERSO do que valeu até 2026-09-03. Antes o grupo guardava só `nos`, e a
    # moldura era calculada como a união das caixas dos membros mais uma folga;
    # o grupo não tinha tamanho próprio, e por isso não havia o que redimensionar.
    # Agora ele guarda `x`, `y`, `largura` e `altura`, e quem está dentro sai da
    # GEOMETRIA: solto dentro da caixa, o nó entra; arrastado para fora, sai.
    # É o modelo do canvas do Obsidian, e foi pedido com esse nome.
    #
    # ⚠️ REDIMENSIONAR A CAIXA NÃO MEXE NOS NÓS; MOVER A CAIXA MEXE. São gestos
    # de sentido oposto de propósito: esticar a moldura é mudar o que ela
    # ABRAÇA, e arrastá-la é levar junto o que ela já abraçava.
    #
    # ⚠️ GRUPO SEM MEMBRO CONTINUA EXISTINDO, e antes não continuava. Com a
    # caixa virando dado, uma caixa vazia é uma coisa que o usuário desenhou e
    # ainda vai encher — apagá-la sozinha seria apagar trabalho dele. Quem quiser
    # que ela suma usa Desagrupar.

    def _trab_achar_grupo(self, andar, id_grupo):
        for g in andar['grupos']:
            if g.get('id') == id_grupo:
                return g
        return None

    def _trab_podar_grupos(self, andar):
        """Põe os dois lados da filiação de acordo. SÓ ISSO.

        ⚠️ ELA NÃO APAGA MAIS GRUPO POR ESTAR VAZIO, e apagava até 2026-09-03:
        um grupo com menos de dois nós sumia sozinho. Fazia sentido enquanto a
        caixa era derivada dos membros — sem membros não havia caixa que
        desenhar. Agora a caixa é o dado: ela tem posição e tamanho que o usuário
        deu, e esvaziá-la arrastando o último nó para fora é um passo NORMAL de
        quem está reorganizando o canvas. Sumir ali seria apagar trabalho dele
        no meio do gesto.
        """
        vivos = {n['id'] for n in andar['nos']}
        sobrando = []
        for g in andar['grupos']:
            g['nos'] = [i for i in g.get('nos', []) if i in vivos]
            sobrando.append(g)
        andar['grupos'] = sobrando

        # O grupo do NÓ é reescrito a partir de quem sobrou, e não corrigido caso
        # a caso: um id de grupo que sumiu não pode ficar pendurado no nó, senão
        # a próxima leitura o desenharia dentro de uma caixa que não existe.
        por_no = {}
        for g in sobrando:
            for i in g['nos']:
                por_no[i] = g['id']
        for no in andar['nos']:
            no['grupo'] = por_no.get(no['id'])

    def _trab_rotulo_de_grupo(self, andar):
        return 'Grupo %d' % (len(andar['grupos']) + 1)

    # Uma caixa menor que isto não dá para pegar de novo: as alças das quatro
    # bordas se encostariam, e o rótulo não caberia. É o piso do redimensionar.
    LADO_MINIMO_DO_GRUPO = 80

    def _trab_caixa_valida(self, campos, grupo=None):
        """Os quatro números da caixa, saneados. Campo ausente mantém o que havia.

        ⚠️ O PISO NÃO É ENFEITE. Sem ele, um arraste rápido de alça passa do
        outro lado e a caixa vira largura negativa — que o CSS desenha como
        largura zero, e o grupo desaparece sem nenhum erro para investigar.
        """
        campos = campos or {}
        base = grupo or {}
        saida = {}
        for chave, reserva in (('x', 0), ('y', 0),
                               ('largura', self.LADO_MINIMO_DO_GRUPO),
                               ('altura', self.LADO_MINIMO_DO_GRUPO)):
            try:
                valor = int(campos.get(chave, base.get(chave, reserva)))
            except (TypeError, ValueError):
                valor = int(base.get(chave, reserva))
            saida[chave] = valor
        for lado in ('largura', 'altura'):
            saida[lado] = max(self.LADO_MINIMO_DO_GRUPO, saida[lado])
        return saida

    def _trab_refiliar(self, andar, filiacao):
        """Reescreve quem pertence a que grupo, a partir de `{id do nó: id do grupo}`.

        ⚠️ QUEM DECIDE É A TELA, e é ela que tem como decidir: a pertinência
        passou a sair da GEOMETRIA — o nó está dentro da caixa ou não está —, e
        a caixa de um nó desenhado só existe no navegador. Aqui a regra é outra,
        e menor: manter os dois lados da filiação de acordo.

        Nó que não aparece no mapa fica como estava. É o que permite mandar só
        os que o arraste tocou, em vez do canvas inteiro a cada gesto.
        """
        for id_no, id_grupo in (filiacao or {}).items():
            no = self._trab_achar_no(andar, id_no)
            if no is None:
                continue
            no['grupo'] = id_grupo or None
        por_grupo = {}
        for no in andar['nos']:
            if no.get('grupo'):
                por_grupo.setdefault(no['grupo'], []).append(no['id'])
        for g in andar['grupos']:
            g['nos'] = por_grupo.get(g['id'], [])

    def mover_grupo(self, project_name, id_grupo, caixa, movimentos=None,
                    id_andar=None, filiacao=None):
        """Arrasta a caixa E o que ela abraça, numa transação só.

        ⚠️ AS DUAS GRAVAÇÕES SÃO UMA. Gravar a caixa por uma porta e os nós por
        outra abriria a janela em que a moldura já andou e os cartões ainda não
        — e se a segunda chamada falhasse, o grupo ficaria desenhado longe dos
        membros dele, sem nada dizendo por quê. É a mesma razão de `mover_nos`
        receber uma lista em vez de um nó por chamada.
        """
        try:
            with self._trab_transacao_de_layout(project_name, id_andar) as (layout, andar):
                grupo = self._trab_achar_grupo(andar, id_grupo)
                if grupo is None:
                    return {'success': False, 'error': 'Grupo não encontrado: ' + str(id_grupo)}
                grupo.update(self._trab_caixa_valida(caixa, grupo))
                for m in (movimentos or []):
                    no = self._trab_achar_no(andar, m.get('id'))
                    if no is None:
                        continue  # nó apagado por outra via: ignorar é o certo
                    no['x'] = int(m.get('x', no['x']))
                    no['y'] = int(m.get('y', no['y']))
                if filiacao:
                    self._trab_refiliar(andar, filiacao)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def agrupar_nos(self, project_name, ids, rotulo='', id_andar=None, caixa=None):
        """Põe os nós escolhidos numa caixa com rótulo.

        Nó que já estava em outro grupo TROCA de grupo, sem aviso: é o que o
        gesto quer dizer. Perguntar "tem certeza?" a cada agrupamento seria
        atrito num gesto que se desfaz com um clique em Desagrupar.
        """
        try:
            ids = [i for i in dict.fromkeys(ids or [])]
            if len(ids) < 2:
                return {'success': False,
                        'error': 'Escolha pelo menos dois nós — uma caixa em volta de um '
                                 'cartão só não diz nada.'}
            with self._trab_transacao_de_layout(project_name, id_andar) as (layout, andar):
                faltando = [i for i in ids if self._trab_achar_no(andar, i) is None]
                if faltando:
                    return {'success': False,
                            'error': 'Nó não encontrado: ' + ', '.join(faltando)}
                grupo = {
                    'id': 'grupo-' + uuid.uuid4().hex[:10],
                    'rotulo': (rotulo or '').strip() or self._trab_rotulo_de_grupo(andar),
                    'nos': ids,
                    # Nasce sem cor: a moldura vale o que o CSS disser enquanto
                    # o usuário não escolher — mesmo desenho do `cor` do nó.
                    'cor': None,
                }
                # ⚠️ A CAIXA VEM DA TELA, e não é calculada aqui. Quem sabe a
                # LARGURA e a ALTURA de um nó desenhado é o navegador: o
                # `Layout.json` guarda tamanho só quando o usuário arrastou a
                # pega, e para todo o resto a medida está na folha de estilo.
                # Calculando daqui, um grupo de nota e terminal nasceria com a
                # moldura cortando os dois.
                grupo.update(self._trab_caixa_valida(caixa))
                # Tira os escolhidos dos grupos antigos ANTES de acrescentar o
                # novo — senão um nó apareceria em dois `grupos[].nos` ao mesmo
                # tempo, e a caixa antiga continuaria desenhada em volta dele.
                for g in andar['grupos']:
                    g['nos'] = [i for i in g['nos'] if i not in ids]
                andar['grupos'].append(grupo)
                for i in ids:
                    self._trab_achar_no(andar, i)['grupo'] = grupo['id']
                self._trab_podar_grupos(andar)
            return {'success': True, 'grupo': grupo}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def desagrupar(self, project_name, ids_dos_grupos, id_andar=None):
        """Desfaz a caixa. Os nós ficam onde estão — só a moldura some."""
        try:
            alvos = set(ids_dos_grupos or [])
            with self._trab_transacao_de_layout(project_name, id_andar) as (layout, andar):
                andar['grupos'] = [g for g in andar['grupos'] if g['id'] not in alvos]
                for no in andar['nos']:
                    if no.get('grupo') in alvos:
                        no['grupo'] = None
                self._trab_podar_grupos(andar)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def renomear_grupo(self, project_name, id_grupo, rotulo, id_andar=None):
        """Só o rótulo. Continua existindo porque é a porta que a tela usa no
        duplo clique — `editar_grupo` é a porta geral, e as duas gravam pelo
        mesmo caminho para não divergirem."""
        return self.editar_grupo(project_name, id_grupo, {'rotulo': rotulo}, id_andar)

    def editar_grupo(self, project_name, id_grupo, campos, id_andar=None,
                     filiacao=None):
        """Rótulo e cor da caixa de grupo.

        ⚠️ A COR DO GRUPO NÃO TEM NADA A VER COM A COR DOS NÓS DENTRO DELE. Ela
        pinta a moldura e o rótulo, e existe para separar duas caixas vizinhas
        de longe; pintar os membros junto apagaria a cor de papel de um
        Orquestrador agrupado, que é a leitura que a cor do nó existe para dar.

        Como no nó, a cor é um TOKEN do tema (`--sky`) ou um hex do seletor
        nativo — e só o token acompanha a troca de tema.
        """
        try:
            with self._trab_transacao_de_layout(project_name, id_andar) as (layout, andar):
                grupo = self._trab_achar_grupo(andar, id_grupo)
                if grupo is None:
                    return {'success': False, 'error': f'Grupo não encontrado: {id_grupo}'}
                campos = campos or {}
                if 'rotulo' in campos:
                    grupo['rotulo'] = (campos['rotulo'] or '').strip() or grupo['rotulo']
                if 'cor' in campos:
                    grupo['cor'] = campos['cor'] or None
                # A caixa entra por aqui quando o gesto foi REDIMENSIONAR, que
                # não mexe em nó nenhum. Mover a caixa tem porta própria
                # (`mover_grupo`), porque ali os nós andam junto e as duas
                # gravações têm de cair na mesma transação.
                if any(c in campos for c in ('x', 'y', 'largura', 'altura')):
                    grupo.update(self._trab_caixa_valida(campos, grupo))
                # Esticar a moldura por cima de um nó é o gesto que o adota, e
                # tirá-la de cima é o que o solta: por isso a filiação chega
                # junto do tamanho, e não numa segunda chamada.
                if filiacao:
                    self._trab_refiliar(andar, filiacao)
            return {'success': True, 'grupo': grupo}
        except Exception as e:
            return {'success': False, 'error': str(e)}
