"""As ligações entre nós: criar, validar, podar e excluir.

⚠️ AS LIGAÇÕES NÃO SÃO DESENHO. Uma linha entre dois nós muda o que acontece
com os processos deles — segura um disparo, passa um arquivo, reinicia o outro
lado. O efeito mora em `trabalhos_conexoes.py`; aqui fica o que é permitido
existir. Quem acrescentar um quinto tipo que só desenha estará desfazendo a
decisão que criou os quatro.

⚠️ `_trab_dependencia_faria_ciclo` É A VALIDAÇÃO QUE NÃO PODE FALTAR. Uma
dependência circular não dá erro na hora de criar: ela trava os dois nós para
sempre, cada um esperando o outro, e o sintoma é a Oficina parada sem nada na
tela dizendo por quê.

⚠️ A PODA (`_trab_podar_ligacoes`) RODA DEPOIS DE TODA EXCLUSÃO DE NÓ. Ligação
órfã é ligação apontando para o vazio — e o efeito dela continua sendo aplicado.
"""

from .trabalhos_layout_constantes import *


class TrabalhosLayoutLigacoesMixin:

    # ── As ligações (Fase 3) ─────────────────────────────────────────────────
    #
    # A FORMA de uma ligação, e só ela. O efeito está em `trabalhos_conexoes`.
    #
    #   {'id', 'tipo', 'de', 'para'}
    #
    # ⚠️ AS DUAS PONTAS SÃO SEMPRE NÓS. Existiu um quarto tipo (a triangulação)
    # que punha `para` vazio e guardava o id de outra LIGAÇÃO num campo
    # `observado`; ele saiu, e com ele a única forma de ligação que não ligava
    # dois nós. Layouts gravados antes podem ter esse campo — ele é ignorado.

    def _trab_achar_ligacao(self, andar, id_ligacao):
        for l in andar['ligacoes']:
            if l.get('id') == id_ligacao:
                return l
        return None

    def _trab_podar_ligacoes(self, andar):
        """Tira as ligações que perderam uma ponta. Devolve as que saíram.

        ⚠️ UMA PASSADA BASTA agora que toda ligação liga dois NÓS. A segunda
        existia para as triangulações órfãs — elas apontavam para outra
        ligação, e derrubar a ligação espiada tinha de derrubar quem a espiava.
        Sem esse tipo, não há ligação que dependa de outra ligação.

        Uma ligação antiga sem `para` (uma triangulação de um layout gravado
        antes da remoção) cai aqui pela ponta que falta, e some no primeiro
        carregamento — que é o certo: o tipo dela já não existe no catálogo.
        """
        vivos = {n.get('id') for n in andar['nos']}
        saiu = [l for l in andar['ligacoes']
                if l.get('de') not in vivos or l.get('para') not in vivos]
        andar['ligacoes'] = [l for l in andar['ligacoes'] if l not in saiu]
        return saiu

    def _trab_dependencia_faria_ciclo(self, andar, de, para):
        """`para` já depende de `de`, por qualquer caminho?

        ⚠️ CICLO DE DEPENDÊNCIA É IMPASSE PERMANENTE, não um desenho estranho:
        A espera B, B espera A, e os dois ficam em "aguardando" para sempre,
        sem nada na tela explicando por quê. Recusar na hora de criar é o único
        momento em que dá para dizer o motivo com as duas pontas na mão.
        """
        adiante = {}
        for l in andar['ligacoes']:
            if l.get('tipo') == 'dependencia':
                adiante.setdefault(l['de'], []).append(l['para'])
        vistos, pilha = set(), [para]
        while pilha:
            atual = pilha.pop()
            if atual == de:
                return True
            if atual in vistos:
                continue
            vistos.add(atual)
            pilha.extend(adiante.get(atual, []))
        return False

    def _trab_criar_ligacao(self, project_name, tipo, de, para=None, id_andar=None):
        """Grava uma ligação nova, já validada. Devolve `{'success', 'ligacao'}`.

        ⚠️ Método interno de propósito: quem a tela chama é `conectar_nos`, em
        `trabalhos_conexoes.py`, que cria o arquivo de canal junto. Gravar a
        ligação sem o canal daria uma linha desenhada que não passa dado — que
        é exatamente o que foi proibido.
        """
        try:
            if tipo not in IDS_DOS_TIPOS_DE_LIGACAO:
                return {'success': False,
                        'error': f'Tipo de ligação desconhecido: {tipo}. '
                                 f'Existem: {", ".join(IDS_DOS_TIPOS_DE_LIGACAO)}.'}
            with self._trab_transacao_de_layout(project_name, id_andar) as (layout, andar):
                erro = self._trab_validar_ligacao(andar, tipo, de, para)
                if erro:
                    return {'success': False, 'error': erro}
                ligacao = {
                    'id': 'lig-' + uuid.uuid4().hex[:10],
                    'tipo': tipo,
                    'de': de,
                    'para': para,
                }
                andar['ligacoes'].append(ligacao)
            return {'success': True, 'ligacao': ligacao}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _trab_validar_ligacao(self, andar, tipo, de, para):
        """A mensagem de recusa, ou `None` quando pode. Roda DENTRO da transação.

        Validar fora dela seria ler o arquivo, decidir, e gravar sobre um
        estado que já mudou — a corrida clássica que o lock existe para evitar.
        """
        origem = self._trab_achar_no(andar, de)
        if origem is None:
            return f'Nó não encontrado: {de}'

        destino = self._trab_achar_no(andar, para)
        if destino is None:
            return f'Nó não encontrado: {para}'
        if de == para:
            return 'Um nó não se liga a si mesmo.'
        if origem.get('tipo') != 'terminal':
            return 'A origem de uma ligação é sempre um terminal.'
        if tipo == 'dependencia' and destino.get('tipo') != 'terminal':
            return ('Dependência é entre terminais: ela segura o disparo de um processo, '
                    'e uma nota ou um texto não tem processo para segurar.')
        if tipo == 'ida-e-volta' and destino.get('tipo') != 'terminal':
            return 'Ida e volta é entre terminais: os dois lados precisam responder.'
        if tipo == 'mao-unica' and destino.get('tipo') == 'texto':
            return ('Um texto é rótulo solto, não recebe nada. Use uma nota se quiser que '
                    'o terminal escreva ali.')

        for l in andar['ligacoes']:
            if not l.get('para'):
                continue          # sobra de layout antigo, sem as duas pontas
            mesmas_pontas = {l['de'], l['para']} == {de, para}
            if mesmas_pontas and l['tipo'] == tipo:
                return 'Essa ligação já existe entre esses dois nós.'
            # ⚠️ Um par só tem UMA ligação de dado. Duas — mão única de A para B
            # e ida e volta entre os dois — dariam dois arquivos de canal
            # descrevendo a mesma conversa, e o agente leria os dois sem saber
            # qual vale. Ordem (dependência) convive com dado; dado com dado, não.
            if mesmas_pontas and l['tipo'] in ('mao-unica', 'ida-e-volta') \
                    and tipo in ('mao-unica', 'ida-e-volta'):
                return ('Esses dois nós já passam dado entre si. Desconecte antes de trocar '
                        'o tipo de canal.')

        if tipo == 'dependencia' and self._trab_dependencia_faria_ciclo(andar, de, para):
            return ('Isso fecharia um ciclo de dependência: os dois lados ficariam '
                    'esperando um pelo outro para sempre.')
        return None

    def _trab_excluir_ligacoes(self, project_name, ids, id_andar=None):
        """Tira ligações do canvas. Devolve as que saíram, para apagar os canais."""
        ids = set(ids or [])
        with self._trab_transacao_de_layout(project_name, id_andar) as (layout, andar):
            saiu = [l for l in andar['ligacoes'] if l.get('id') in ids]
            andar['ligacoes'] = [l for l in andar['ligacoes'] if l.get('id') not in ids]
            saiu += self._trab_podar_ligacoes(andar)
        return saiu

    def _trab_ligacoes_do_no(self, andar, id_no):
        """Toda ligação que toca este nó, por qualquer uma das duas pontas."""
        return [l for l in andar['ligacoes']
                if l.get('de') == id_no or l.get('para') == id_no]
