"""O `Estado.json` do Quadro: a transação, o cartão e a composição.

Este arquivo era 523 linhas e virou quatro, pelo teto de 500 da AMF:

| Arquivo | A pergunta que ele responde |
|---|---|
| `trabalhos_estado.py` | a transação, o cartão, e quem compõe |
| `trabalhos_estado_gravacao.py` | a trava entre processos e a gravação atômica |
| `trabalhos_estado_tela.py` | o que o usuário pode fazer pela tela |
| `trabalhos_estado_mcp.py` | o que o Orquestrador pode fazer pelo MCP |

`TrabalhosEstadoMixin` continua sendo o nome único que `api.py` importa: ele
COMPÕE os dois, no padrão de `InspetorMixin` (Convenção 5 da Arquitetura
modular).

⚠️ `import *` DE `trabalhos_estado_gravacao.py` É O QUE MANTÉM O ENDEREÇO
PÚBLICO. Seis módulos fazem `from .trabalhos_estado import gravar_json_atomico`
(ou `travar_entre_processos`, ou `_substituir_teimosamente`), e nenhum precisou
mudar. Não trocar por import seletivo.

⚠️ A TRANSAÇÃO REGENERA O `Quadro.md` NO FIM, e é o único lugar que faz isso.
Ver a convenção "Arquivo gerado para o agente tem exatamente UM escritor": o
`Equipe.md` NÃO pode ser regenerado daqui, porque este código roda também no
processo do servidor MCP, onde o registro de terminais vivos responde "ninguém".
"""

from .trabalhos_estado_gravacao import *
from .trabalhos_estado_gravacao import _substituir_teimosamente, _agora

from .trabalhos_estado_tela import TrabalhosEstadoTelaMixin
from .trabalhos_estado_mcp import TrabalhosEstadoMcpMixin


class TrabalhosEstadoMixin(TrabalhosEstadoTelaMixin, TrabalhosEstadoMcpMixin):
    """Os cartões do Quadro. Só eles.

    ⚠️ Não confundir com o layout do canvas da Oficina, que é arquivo e módulo
    à parte: são estados de natureza diferente, e juntá-los faria mover um nó
    reescrever a lista inteira de atividades.
    """

    # ── O arquivo ────────────────────────────────────────────────────────────

    def _trab_estado_vazio(self):
        # `proximo_numero` mora no estado, e não é derivado de `max(ids)`:
        # derivar reaproveitaria o número de uma atividade excluída, e um id
        # repetido quebra o `depende_de` de quem citava o antigo.
        return {'atividades': [], 'proximo_numero': 1}

    def _trab_carregar(self, project_name):
        """Leitura PURA — sem lock, sem gravar nada.

        Leitura sem lock é aceitável aqui pelo mesmo motivo que na Fila: o
        pior caso é a tela mostrar o Quadro de um instante atrás, e ela relê
        a cada ação. O que não pode acontecer sem lock é MEXER.
        """
        caminho = obter_arquivo_de_estado_dos_trabalhos(project_name)
        if not os.path.isfile(caminho):
            return self._trab_estado_vazio()
        try:
            with open(caminho, 'r', encoding='utf-8') as f:
                estado = json.load(f)
        except Exception:
            # Arquivo ilegível não pode virar Quadro vazio SILENCIOSO: um
            # estado vazio devolvido daqui seria gravado por cima na primeira
            # transação, e o Quadro do usuário sumiria de vez. Guardamos o
            # ilegível ao lado antes de seguir.
            self._trab_guardar_ilegivel(caminho)
            return self._trab_estado_vazio()
        if not isinstance(estado, dict):
            return self._trab_estado_vazio()
        estado.setdefault('atividades', [])
        estado.setdefault('proximo_numero', len(estado['atividades']) + 1)
        return estado

    def _trab_guardar_ilegivel(self, caminho):
        """Renomeia um `Estado.json` que não abre, em vez de deixá-lo ser
        sobrescrito. Falha em silêncio de propósito: se nem renomear der, o
        caminho de recuperação já era, e derrubar a leitura não melhora nada.
        """
        try:
            if os.path.isfile(caminho):
                carimbo = datetime.now().strftime('%Y%m%d-%H%M%S')
                os.replace(caminho, f'{caminho}.ilegivel-{carimbo}')
        except Exception:
            pass

    @contextmanager
    def _trab_transacao(self, project_name):
        """Lê, deixa mexer, grava — tudo sob o lock ENTRE PROCESSOS.

        Toda leitura-modificação-gravação passa por aqui. Leitura pura (a tela
        consultando) usa `_trab_carregar` direto, como na Fila.
        """
        caminho = obter_arquivo_de_estado_dos_trabalhos(project_name)
        with travar_entre_processos(caminho):
            estado = self._trab_carregar(project_name)
            yield estado
            gravar_json_atomico(caminho, estado)
        # ⚠️ FORA DO LOCK, E DE PROPÓSITO. O `Quadro.md` que o agente lê na raiz
        # do projeto é uma cópia deste estado, e este é o ÚNICO ponto por onde
        # passam as onze escritas — pendurá-lo aqui é a diferença entre "sempre
        # em dia" e "em dia nos lugares de que alguém lembrou". Mas ele grava
        # outro arquivo, e segurar o lock do `Estado.json` durante isso faria
        # duas transações concorrentes esperarem por uma escrita que não tem
        # nada a ver com o que elas disputam.
        self._mat_regerar_quadro(project_name)

    # ── O cartão ─────────────────────────────────────────────────────────────

    def _trab_nova_atividade(self, numero, titulo, pasta='', resumo='', briefing='',
                             autoria=AUTORIA_USUARIO):
        return {
            'id': f'A-{numero}',
            'titulo': titulo,
            'pasta': pasta,
            'resumo': resumo,
            'briefing': briefing,
            'coluna': COLUNA_INICIAL,
            'tags': [],
            'autoria': autoria,
            'depende_de': [],
            'arquivos': [],
            # As "tarefas do cartão" — a lista de passos que o Orquestrador
            # escreve ao pegar a atividade. Não se chamam "sub-tarefas": um
            # Pedaço é outra coisa neste vocabulário.
            'tarefas': [],
            'motivo_do_portao': None,
            'gatilho_do_portao': None,
            'tentativas': 0,
            'criado_em': _agora(),
            'atualizado_em': _agora(),
            'iniciado_em': None,
            'concluido_em': None,
        }

    def _trab_achar(self, estado, id_atividade):
        for a in estado.get('atividades', []):
            if a.get('id') == id_atividade:
                return a
        return None


    # ── Atalho de tela ───────────────────────────────────────────────────────

    def abrir_pasta_dos_trabalhos(self, project_name):
        try:
            pasta = obter_pasta_de_trabalhos(project_name)
            os.makedirs(pasta, exist_ok=True)
            os.startfile(pasta)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}
