"""O arranjo do canvas da Oficina — onde cada nó está, e de que cor.

Arquivo próprio (`Trabalhos/Oficina/Layout.json`), e NÃO dentro do
`Estado.json`. O motivo é o mesmo que separa o histórico da Fila do estado
dela: são coisas de natureza e de ritmo diferentes. Arrastar um nó pelo canvas
grava dezenas de vezes por segundo; a lista de atividades do Quadro muda umas
poucas vezes por hora. Juntos, mover um nó reescreveria o Quadro inteiro a cada
quadro de animação — e a primeira corrida entre o arraste e uma ferramenta de
MCP perderia um cartão.

⚠️ MESMO LOCK ENTRE PROCESSOS DO `Estado.json`, e pela mesma razão exata: quem
grava posição é o app (o usuário arrastando), mas quem lê e escreve o estado
de processo dos terminais roda fora dele. As duas metades — o lock de arquivo e
a escrita atômica — vêm de `trabalhos_estado.py`, que é onde elas moram.

⚠️ ESTA É A FASE 3 DO SCHEMA, e ele foi desenhado para crescer sem migração:
`grupos` e a lista de andares seguem como campos vazios até a Fase 5. A Fase 2
preencheu `nos`; esta preenche `ligacoes`. Ler um `Layout.json` de hoje numa
versão futura funciona, e o contrário também — o que não se reconhece fica
quieto em vez de estourar.

⚠️ AQUI SÓ MORA A PERSISTÊNCIA DA LIGAÇÃO — a forma dela, a validação e a
gravação. O EFEITO (segurar o disparo de um processo, gravar canal, reiniciar
por rodada) mora em `trabalhos_conexoes.py`, e a separação não é arrumação: o
que persiste sobrevive ao programa fechar, o que é efeito morre junto com o
processo. Misturar os dois é como um PID acabaria salvo em disco.

O que o BACKEND sabe de um nó é só o que persiste: id, tipo, nome, posição,
cor, papel e cartão de origem. **Processo é outra coisa**, vive em
`trabalhos_terminais.py`, e morre junto com o programa — um nó continua no
canvas depois de fechar o app; o processo dele, não.

Este arquivo era 991 linhas e virou cinco, pelo teto de 500 da AMF. O corte
segue a regra dos Backups, do Inspetor e do `arquivos.py`: **cada arquivo
responde uma pergunta diferente**.

| Arquivo | A pergunta que ele responde |
|---|---|
| `trabalhos_layout.py` | o arquivo, a transação, o Desfazer e a porta da tela |
| `trabalhos_layout_constantes.py` | os nomes de arquivo e os números fixos |
| `trabalhos_layout_nos.py` | criar, mover, editar, duplicar e excluir um nó |
| `trabalhos_layout_ligacoes.py` | o que é permitido ligar a quê |
| `trabalhos_layout_grupos.py` | a caixa em volta, e quem está dentro dela |

`TrabalhosLayoutMixin` continua sendo o nome único que `api.py` importa: ele
COMPÕE os três, no padrão de `InspetorMixin` (Convenção 5 da Arquitetura
modular). Nenhum tem `__init__` nem `super()`, o que torna a herança múltipla
inerte.

⚠️ A TRANSAÇÃO FICOU AQUI, e é o motivo de este arquivo ser a casca e não mais
um irmão. `_trab_transacao_de_layout` segura a trava entre processos, guarda o
estado para o Desfazer e grava atomicamente — e TODA escrita dos outros três
passa por ela. Um caminho de escrita fora dela perde a corrida com uma
ferramenta de MCP mexendo no mesmo arquivo, e o sintoma é um nó que some
sozinho.
"""

from .trabalhos_layout_constantes import *

from .trabalhos_layout_nos import TrabalhosLayoutNosMixin
from .trabalhos_layout_ligacoes import TrabalhosLayoutLigacoesMixin
from .trabalhos_layout_grupos import TrabalhosLayoutGruposMixin


class TrabalhosLayoutMixin(TrabalhosLayoutNosMixin,
                           TrabalhosLayoutLigacoesMixin,
                           TrabalhosLayoutGruposMixin):

    # ── O arquivo ────────────────────────────────────────────────────────────

    def _trab_caminho_do_layout(self, project_name):
        return obter_pasta_de_trabalhos(project_name, PASTA_DA_OFICINA, ARQUIVO_DE_LAYOUT)

    def _trab_layout_vazio(self):
        return {
            'andares': [{'id': ANDAR_PADRAO, 'nome': 'principal',
                         'nos': [], 'grupos': [], 'ligacoes': []}],
            'fluxos_salvos': [],
        }

    def _trab_carregar_layout(self, project_name):
        """Leitura pura, sem lock — o pior caso é a tela desenhar o canvas de um
        instante atrás, e ela relê a cada ação. O que não pode sem lock é MEXER.
        """
        import json
        caminho = self._trab_caminho_do_layout(project_name)
        if not os.path.isfile(caminho):
            return self._trab_layout_vazio()
        try:
            with open(caminho, 'r', encoding='utf-8') as f:
                layout = json.load(f)
        except Exception:
            # Mesmo cuidado do `Estado.json`: guardar o ilegível em vez de
            # devolver vazio, que seria gravado por cima e apagaria o arranjo.
            self._trab_guardar_ilegivel(caminho)
            return self._trab_layout_vazio()
        if not isinstance(layout, dict) or not layout.get('andares'):
            return self._trab_layout_vazio()
        for andar in layout['andares']:
            andar.setdefault('nos', [])
            andar.setdefault('grupos', [])
            andar.setdefault('ligacoes', [])
            # ⚠️ TIPO APOSENTADO VIRA O ATUAL NA LEITURA, e não numa migração
            # que reescreve o arquivo. O schema deste arquivo foi desenhado para
            # crescer sem migração, e reescrever o `Layout.json` de todo projeto
            # só para trocar uma palavra criaria a janela em que uma queda no
            # meio deixa metade dos nós ilegíveis. Traduzir na leitura custa
            # nada e não tem como falhar pela metade.
            for no in andar['nos']:
                no['tipo'] = TIPO_APOSENTADO.get(no.get('tipo'), no.get('tipo'))
        layout.setdefault('fluxos_salvos', [])
        return layout

    def _trab_andar(self, layout, id_andar=None):
        andares = layout['andares']
        if id_andar:
            for a in andares:
                if a['id'] == id_andar:
                    return a
            raise ValueError(f'Andar não encontrado: {id_andar}')
        return andares[0]

    # ── Desfazer ─────────────────────────────────────────────────────────────
    #
    # ⚠️ A PILHA GUARDA O ANDAR INTEIRO, e não o que mudou. Um "diff" por
    # operação exigiria uma operação inversa para cada uma das dez que mexem no
    # canvas — e a primeira que alguém esquecesse de inverter desfaria errado,
    # em silêncio. O andar inteiro é alguns kB de JSON; guardar a foto é barato
    # e não tem como estar errada.
    #
    # ⚠️ VIVE EM MEMÓRIA E MORRE COM O PROGRAMA, como a espera e as rodadas.
    # Desfazer o que se fez na sessão passada, depois de fechar e reabrir, não é
    # desfazer — é reverter um estado que o usuário já tomou como definitivo.
    #
    # ⚠️ NÃO DESFAZ PROCESSO. O que a pilha devolve é o desenho: posição, cor,
    # ligação, grupo. Um terminal que já rodou não "des-roda", e um nó apagado
    # que volta volta PARADO. Prometer o contrário seria mentira.

    _trab_desfazer = None
    TETO_DA_PILHA = 40

    def _trab_pilha(self, project_name):
        if self._trab_desfazer is None:
            self._trab_desfazer = {}
        return self._trab_desfazer.setdefault(project_name, [])

    def _trab_guardar_para_desfazer(self, project_name, andar):
        import copy
        pilha = self._trab_pilha(project_name)
        pilha.append(copy.deepcopy(andar))
        if len(pilha) > self.TETO_DA_PILHA:
            del pilha[:len(pilha) - self.TETO_DA_PILHA]

    def desfazer_oficina(self, project_name, id_andar=None):
        """Volta o canvas ao estado anterior à última mudança.

        Recusa enquanto houver terminal rodando no que seria desfeito: voltar o
        desenho com processo vivo deixaria um processo sem nó na tela — o mesmo
        terminal fantasma que `excluir_nos` já impede.
        """
        try:
            pilha = self._trab_pilha(project_name)
            if not pilha:
                return {'success': False, 'vazio': True,
                        'error': 'Nada para desfazer nesta sessão.'}
            anterior = pilha.pop()
            with self._trab_transacao_de_layout(project_name, id_andar,
                                                desfazivel=False) as (layout, andar):
                vivos = [n['id'] for n in andar['nos']
                         if self._trab_terminal_rodando(project_name, n['id'])]
                # O nó que está trabalhando precisa existir no estado de volta.
                somem = [i for i in vivos
                         if not any(n['id'] == i for n in anterior.get('nos', []))]
                if somem:
                    pilha.append(anterior)   # devolve: nada foi desfeito
                    return {'success': False,
                            'error': 'Pare o terminal antes de desfazer: '
                                     + ', '.join(sorted(somem))}
                andar['nos'] = anterior.get('nos', [])
                andar['ligacoes'] = anterior.get('ligacoes', [])
                andar['grupos'] = anterior.get('grupos', [])
            return {'success': True, 'restam': len(pilha)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _trab_transacao_de_layout(self, project_name, id_andar=None, desfazivel=True):
        """Lê, deixa mexer, grava — sob o lock entre processos.

        Não é reentrante, pelo mesmo motivo de `_trab_transacao`: o lock do
        Windows é por handle, e reentrar trava até estourar o tempo.
        """
        from contextlib import contextmanager

        @contextmanager
        def _ctx():
            caminho = self._trab_caminho_do_layout(project_name)
            with travar_entre_processos(caminho):
                layout = self._trab_carregar_layout(project_name)
                andar = self._trab_andar(layout, id_andar)
                # A foto é tirada ANTES de deixar mexer, e é isso que faz o
                # desfazer valer para toda operação de uma vez — nenhuma precisa
                # se lembrar de guardar a sua.
                if desfazivel:
                    self._trab_guardar_para_desfazer(project_name, andar)
                yield layout, andar
                gravar_json_atomico(caminho, layout)

        return _ctx()


    # ── A porta da tela ──────────────────────────────────────────────────────

    def carregar_oficina(self, project_name):
        """O canvas inteiro, já com o estado de processo de cada terminal.

        Junta as duas metades numa chamada só — o layout, que vem do disco, e o
        estado vivo, que vem da memória deste processo. A tela precisa das duas
        ao mesmo tempo e pedi-las separado só criaria a janela em que uma chega
        sem a outra.
        """
        try:
            layout = self._trab_carregar_layout(project_name)
            andar = self._trab_andar(layout)
            nos = []
            for n in andar['nos']:
                vivo = dict(n)
                # O terminal do sistema não tem os seis estados do agente
                # (`fazendo`, `entregue`, `aguardando`…): ele está aberto ou
                # fechado, e forçá-lo na legenda do agente faria a bolinha
                # prometer uma máquina de estados que não existe do lado dele.
                if n.get('tipo') == 'terminal':
                    vivo['aberto'] = self._sh_vivo(project_name, n['id'])
                    # As anotações vêm JUNTO, e não numa segunda chamada da
                    # tela: pedi-las separado criaria de volta exatamente a
                    # janela que a docstring acima descreve. Só o nó de terminal
                    # as tem — `Anotações/<nó>/` é a pasta do agente, e nó de
                    # nota não tem agente nenhum escrevendo por ele.
                    #
                    # ⚠️ É A LISTA, e não só a mais recente: o nó de anotações
                    # do canvas tem combo box, e trocar de opção não pode custar
                    # uma ida ao backend.
                    vivo['anotacoes'] = self._mat_anotacoes(project_name, n)
                vivo['estado'] = self._trab_estado_do_terminal(project_name, n['id'])
                # Um nó parado por dependência sem o motivo à vista parece
                # defeito: "aguardando" não diz aguardando o quê.
                espera = self._conx_espera_de(project_name, n['id'])
                vivo['motivo'] = espera['motivo'] if espera else None
                nos.append(vivo)
            return {'success': True, 'andar': andar['id'], 'nos': nos,
                    'ligacoes': andar['ligacoes'], 'grupos': andar['grupos'],
                    # O catálogo viaja junto: a tela desenha o traço e monta o
                    # menu de tipos a partir DELE, nunca de uma lista própria.
                    # Uma segunda lista no JS é como as duas divergem.
                    'tipos_de_ligacao': TIPOS_DE_LIGACAO,
                    # O carimbo viaja junto pelo mesmo motivo que a anotação: é
                    # ele que o vigia da tela compara depois, e nascer da MESMA
                    # chamada que pintou o canvas é o que garante que os dois
                    # descrevem o mesmo instante. Tirado daqui, sobra a janela
                    # entre pintar e carimbar — e uma anotação escrita dentro
                    # dela entraria no carimbo sem entrar na tela, ficando
                    # invisível até a próxima escrita.
                    'carimbo': self._mat_carimbo_das_anotacoes(
                        project_name,
                        [n for n in andar['nos'] if n.get('tipo') == 'terminal'])}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def carimbo_das_anotacoes(self, project_name):
        """O estado das anotações em poucos bytes — o que o verificador da
        Oficina pergunta de segundos em segundos para saber se vale redesenhar.

        Irmã pobre de `carregar_oficina`, e de propósito: aquela monta o canvas
        inteiro e LÊ cada anotação; esta só conta arquivo e olha data. É a
        diferença entre um confortinho e um laço de leitura rodando sozinho a
        vida toda num projeto que o usuário nem está olhando.

        ⚠️ SÓ OS NÓS DE TERMINAL, pela mesma razão de `carregar_oficina`:
        `Anotações/<nó>/` é a pasta do agente, e nó de nota não tem agente.
        """
        try:
            layout = self._trab_carregar_layout(project_name)
            andar = self._trab_andar(layout)
            nos = [n for n in andar['nos'] if n.get('tipo') == 'terminal']
            return {'success': True,
                    'carimbo': self._mat_carimbo_das_anotacoes(project_name, nos)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def travar_papel_do_no(self, project_name, id_no, id_andar=None):
        """Fecha a trava do papel. Chamado na 1ª mensagem enviada (D34).

        Idempotente: travar o que já está travado não é erro, e um nó SEM papel
        simplesmente não trava — não há o que proteger nele.
        """
        try:
            with self._trab_transacao_de_layout(project_name, id_andar) as (layout, andar):
                no = self._trab_achar_no(andar, id_no)
                if no is None:
                    return {'success': False, 'error': f'Nó não encontrado: {id_no}'}
                if no.get('papel'):
                    no['papel_travado'] = True
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def destravar_papeis(self, project_name, id_andar=None):
        """Reabre TODOS os papéis. É o que "Parar tudo" faz, e o único caminho.

        Não existe destravar um nó sozinho de propósito: a trava existe para o
        papel não mudar no meio de uma atividade, e abrir exceção para um nó
        devolveria exatamente o problema que ela evita.
        """
        try:
            with self._trab_transacao_de_layout(project_name, id_andar) as (layout, andar):
                for no in andar['nos']:
                    no['papel_travado'] = False
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}
