"""A trava de cinco pontas: Chat · Fila · Rotinas · Designer · Backup.

A pergunta que ela responde é *"há tarefa de IA rodando?"* — não "há tarefa de
Fila rodando?". Ela é GLOBAL AO PROGRAMA, não por projeto: a janela do LM Studio
é uma só, e não faz diferença nenhuma que dois projetos sejam diferentes.

Dois motivos para existir, e o segundo é o pior:

1. **Janela.** Sem ela, dois campos "máximo em paralelo: 4" somam 8 requisições
   simultâneas na mesma janela, e o `PortaoDeContexto` de cada ponta não enxerga
   a outra — cada um acha que a janela inteira é dele.

2. **Documentação a meio caminho.** Conversar no Chat enquanto as Rotinas
   reescrevem a documentação é conversar em cima de um índice meio velho e meio
   novo, e o subagente não tem como saber qual metade leu. Este motivo é MAIS
   GRAVE que o da janela, porque a janela dá erro visível e este dá resposta
   errada com cara de certa.

O **backup** é a ponta que não chama o modelo, e mesmo assim entra: ele não
disputa a janela do LM Studio, mas **copia arquivos enquanto as Rotinas os estão
escrevendo**. É exatamente o motivo 2 acima — uma Versão tirada no meio de uma
regeneração guarda documentação a meio caminho, metade velha e metade nova, e
nada avisa. Copiar é ler; ler documentação em movimento dá o mesmo resultado
errado com cara de certo.

O **Designer** entra pelo motivo 1: ele chama o modelo e escreve as conversas
dele, como o Chat.

⚠️ ENFILEIRAR, NUNCA DESCARTAR. O Detector dispara por evento, não por
clique. Se a trava recusar em vez de esperar a vez, a atualização se perde em
silêncio — e a documentação fica velha pelo motivo exato que a trava existe para
evitar. Por isso `ocupar(esperar=True)` é o padrão, e só as duas pontas com
gente na frente da tela (o envio do Chat e o início da Fila) usam
`esperar=False`, onde recusar é honesto: o usuário vê o botão desabilitado com o
motivo escrito ao lado.
"""

import threading
from contextlib import contextmanager
from datetime import datetime

# Os cinco donos possíveis. O rótulo é o que a tela mostra ao lado do botão
# desabilitado — precisa dizer o que está rodando, para o usuário poder ir até
# lá em vez de achar que o programa quebrou.
DONO_CHAT = 'chat'
DONO_FILA = 'fila'
DONO_ROTINAS = 'rotinas'
DONO_DESIGNER = 'designer'
DONO_BACKUP = 'backup'

#
# ⚠️ CURTOS DE PROPÓSITO. Eles são escritos AO LADO DE UM BOTÃO, num espaço de
# uma linha, e com abas de projeto ainda ganham o nome do projeto no fim. O
# rótulo antigo das Rotinas ('as Rotinas estão atualizando a documentação')
# virava, na tela, 'Aguarde: as Rotinas estão atualizando a documentação
# (projeto "Teste").' — uma frase que não cabia em lugar nenhum e empurrava o
# resto do controle. Duas palavras respondem a mesma pergunta: o que está
# rodando, para o usuário poder ir até lá.
ROTULOS = {
    DONO_CHAT: 'Chat respondendo',
    DONO_FILA: 'Fila pesquisando',
    DONO_ROTINAS: 'Rotinas rodando',
    DONO_DESIGNER: 'Designer desenhando',
    DONO_BACKUP: 'Backup copiando',
}


class TravaOcupada(Exception):
    """Levantada por `ocupar(esperar=False)` quando outra ponta está rodando."""

    def __init__(self, estado):
        self.estado = estado
        super().__init__(estado.get('motivo') if estado else 'há tarefa de IA rodando')


class TravaIA:
    """Quem está usando a janela do LM Studio agora. Uma instância por processo."""

    def __init__(self):
        self._cond = threading.Condition()
        self._dono = None

    def estado(self):
        """O dono atual, ou None. É o que a tela consulta para escrever o motivo."""
        with self._cond:
            return dict(self._dono) if self._dono else None

    @contextmanager
    def ocupar(self, quem, projeto=None, detalhe=None, esperar=True):
        """Toma a trava. Ver a nota sobre enfileirar-nunca-descartar lá em cima.

        `projeto` é o nome do projeto dono da ponta que está tomando a trava —
        com múltiplas abas de projeto abertas ao mesmo tempo, é o que permite
        a tela de um projeto dizer "ocupado por causa do projeto X" em vez de
        um motivo sem endereço.
        """
        motivo = ROTULOS.get(quem, f'{quem} está rodando')
        if detalhe:
            motivo = f'{motivo} ({detalhe})'
        with self._cond:
            if not esperar and self._dono is not None:
                raise TravaOcupada(dict(self._dono))
            while self._dono is not None:
                self._cond.wait()
            self._dono = {'quem': quem, 'motivo': motivo, 'projeto': projeto,
                          'desde': datetime.now().isoformat()}
        try:
            yield
        finally:
            with self._cond:
                self._dono = None
                self._cond.notify_all()


# Global do processo de propósito: é o espelho da janela única do LM Studio.
TRAVA_IA = TravaIA()


class TravaIAMixin:
    """O que a tela chama para saber se pode habilitar os botões."""

    def estado_trava_ia(self):
        """Quem está usando a IA agora, ou nada.

        A tela desabilita o botão E ESCREVE O MOTIVO ao lado. Botão apagado sem
        explicação parece defeito; com o motivo, o usuário sabe inclusive para
        onde ir — é a Fila, é a documentação atualizando, é o próprio Chat.
        """
        estado = TRAVA_IA.estado()
        return {'success': True, 'ocupado': estado is not None, 'trava': estado}
