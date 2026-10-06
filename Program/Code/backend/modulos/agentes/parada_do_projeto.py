"""A parada de um projeto: "pare de pedir coisas ao LM Studio para ele".

Ligada quando o usuário FECHA A ABA de um projeto, e desligada quando ele o
abre de novo. Entre uma coisa e outra, todo laço que ia chamar o modelo em nome
daquele projeto desiste na próxima fronteira segura.

## Por que ela existe

Com abas de projeto, fechar uma aba enquanto ela gerava documentação deixava o
ciclo rodando até o fim — segurando a `TRAVA_IA`, que é global. O projeto
seguinte da fila ficava parado esperando um trabalho que ninguém mais queria.
O modal de fechar já PROMETIA o contrário ("Fechar interrompe isso"); era a
tela dizendo uma coisa e o motor fazendo outra.

## Por que não dá para simplesmente matar a thread

O "encerrar o programa" não serve de modelo: ele não interrompe nada. O
launcher faz `window.events.closed += lambda: os._exit(0)` e mata o processo
inteiro — não existe `os._exit` de um projeto só, e um `Thread` de Python não
tem cancelamento de fora.

O modelo replicável é o do **Chat**, que já existia e já funcionava:
`_chat_paradas` (`chat_persistencia.py`) mais um `obter_parada` que desce por
argumento até o laço de chunks e até o porteiro dos subagentes. Este módulo é a
mesma ideia com granularidade de PROJETO, para as pontas que não tinham nada:
o ciclo de rotinas, as três rotinas pesadas e o Designer.

## ⚠️ Cooperativa nas FRONTEIRAS, e à força no que já está em voo

São duas metades, e sozinha nenhuma das duas resolve.

A cooperativa: nada é cortado no meio de uma escrita. Os pontos de checagem
ficam entre arquivos, entre rotinas, e antes da próxima chamada ao modelo. O
que ficou por fazer continua registrado em `Pendências.json`
(`rotinas_pendencias.py`) e nos `_resumo.json`, então reabrir o projeto
reencontra o que faltou e o botão "Retomar" dá conta.

⚠️ **Ela não bastava, e o usuário viu.** Fechar a aba com o Espelho (retirado
em 2026-09) no meio de um arquivo grande deixava o LM Studio gerando por
minutos: a checagem seguinte só chega DEPOIS que a requisição em voo responde,
e uma chamada sem streaming não tem fronteira nenhuma por dentro. Do lado de
fora, "fechei e não parou" — e o modal continuava prometendo que parava.

Por isso a segunda metade: o **registro de clientes** logo abaixo. Todo cliente
do LM Studio aberto em nome de um projeto se anota aqui, e `parar()` fecha os
que estiverem abertos. Fechar o cliente derruba o pool de conexões do `httpx`
por baixo do SDK; a requisição em voo levanta na thread dela, e o LM Studio vê
o cliente sumir e para de gerar. É o mesmo efeito que o "encerrar o programa"
tem por acidente (o `os._exit` leva o socket junto) — só que de um projeto só.

⚠️ Uma requisição em STREAMING continua sendo cortada pelo caminho educado:
`stream.close()` e `break` (ver `chat_mensagem.py`). Ele é mais limpo que
derrubar o pool, e chega primeiro.

## ⚠️ Desligar ao reabrir é obrigatório

Um projeto que ficasse parado para sempre nunca mais rodaria nada, e nada na
tela diria por quê. Quem desliga é `restore_acionamentos_espera`
(`acionamentos_config.py`), que já é o "este projeto está sendo aberto" do
backend.
"""

import threading
import weakref


class ParadaDoProjeto:
    """Quais projetos estão parados agora. Uma instância por processo."""

    def __init__(self):
        self._lock = threading.Lock()
        self._parados = set()
        # projeto → clientes do LM Studio abertos em nome dele, AGORA.
        #
        # ⚠️ `WeakSet`, e não `set`: quem abre o cliente é uma função que o
        # descarta ao terminar, e ninguém se lembraria de vir aqui dar baixa em
        # cada um dos nove pontos que abrem cliente. Com referência fraca, o
        # cliente sai daqui sozinho quando o Python o coleta — um `set` normal
        # seguraria vivo todo cliente já aberto na sessão, e `parar()` passaria
        # a fechar centenas de objetos mortos.
        self._clientes = {}
        # A parada das ROTINAS de um projeto, sem tocar no Chat e na Fila:
        # "Desativar" é sobre a Automação, fechar a aba é sobre o projeto
        # inteiro. `_donos`: cliente → id da rotina que o abriu (fraco, pelo
        # mesmo motivo do `WeakSet`). `_rotinas_paradas`: projeto → ids parados,
        # e `'*'` = todas.
        self._donos = weakref.WeakKeyDictionary()
        self._rotinas_paradas = {}

    def registrar_cliente(self, project_name, cliente, dono=None):
        """Anota um cliente do LM Studio como sendo deste projeto.

        Chamado por `abrir_cliente_do_lm_studio(..., projeto=...)`, que é o
        único lugar do programa que abre cliente — ver `llm_cliente.py`.

        ⚠️ Se o projeto JÁ está parado, o cliente nasce fechado. Sem isto havia
        uma janela real: a thread lê `projeto_parado()` como False, o usuário
        fecha a aba, e só então a thread abre o cliente e dispara a requisição
        — que o `parar()` já passou e não vai fechar.

        `dono` é o id da rotina que abre o cliente. Rotina já parada (o
        "Desativar" chegou antes) faz o cliente nascer fechado, pelo mesmo
        motivo.
        """
        if not project_name or cliente is None:
            return cliente
        with self._lock:
            paradas = self._rotinas_paradas.get(project_name, ())
            if project_name in self._parados or (
                    dono and (dono in paradas or '*' in paradas)):
                self._fechar(cliente)
                return cliente
            if dono:
                try:
                    self._donos[cliente] = dono
                except TypeError:
                    pass
            alvo = self._clientes.get(project_name)
            if alvo is None:
                alvo = self._clientes[project_name] = weakref.WeakSet()
            try:
                alvo.add(cliente)
            except TypeError:
                pass   # cliente sem suporte a referência fraca: só não é anotado
        return cliente

    @staticmethod
    def _fechar(cliente):
        """Fecha um cliente sem nunca levantar.

        Quem chama está no meio de fechar uma aba de projeto: um erro aqui
        deixaria o resto do fechamento (parar a vigilância, cancelar a Fila) sem
        acontecer, por causa de uma conexão que talvez já estivesse morta.
        """
        try:
            cliente.close()
        except Exception:
            pass

    def parar(self, project_name):
        if not project_name:
            return
        with self._lock:
            self._parados.add(project_name)
            # `list(...)` porque é um WeakSet e fechar pode disparar coleta.
            clientes = list(self._clientes.pop(project_name, ()))
        # Fora do lock: `close()` espera o pool de conexões fechar, e segurar o
        # lock aqui prenderia toda pergunta de `parado()` das outras threads —
        # que são exatamente as que precisam responder depressa agora.
        for cliente in clientes:
            self._fechar(cliente)

    def retomar(self, project_name):
        if not project_name:
            return
        with self._lock:
            self._parados.discard(project_name)
            self._clientes.pop(project_name, None)

    def parado(self, project_name):
        if not project_name:
            return False
        with self._lock:
            return project_name in self._parados

    # ── A parada só das rotinas ("Desativar", na aba Automação) ─────────────

    def parar_rotinas(self, project_name, agent_id='*'):
        """Para uma rotina (ou todas, com `'*'`) e fecha a requisição dela.

        Fecha só os clientes cujo dono é a rotina — com `'*'`, os de qualquer
        rotina. O cliente do Chat e da Fila não tem dono de rotina e fica.
        """
        if not project_name:
            return
        # Import local: `caminhos` não tem nada a ver com a parada, e este
        # módulo é alcançado cedo, por `llm_cliente.py`.
        from ..caminhos import IDS_DAS_ROTINAS
        with self._lock:
            self._rotinas_paradas.setdefault(project_name, set()).add(agent_id)
            clientes = []
            for cliente in list(self._clientes.get(project_name, ())):
                dono = self._donos.get(cliente)
                if dono and (dono == agent_id
                             or (agent_id == '*' and dono in IDS_DAS_ROTINAS)):
                    clientes.append(cliente)
        # Fora do lock, pelo mesmo motivo de `parar()`.
        for cliente in clientes:
            self._fechar(cliente)

    def retomar_rotinas(self, project_name, agent_id='*'):
        """Religou: com `'*'` limpa tudo; com um id, tira ele e o `'*'`."""
        if not project_name:
            return
        with self._lock:
            if agent_id == '*':
                self._rotinas_paradas.pop(project_name, None)
            else:
                conjunto = self._rotinas_paradas.get(project_name)
                if conjunto:
                    conjunto.discard(agent_id)
                    conjunto.discard('*')

    def rotina_parada(self, project_name, agent_id):
        """A aba foi fechada, ou esta rotina (ou todas) foi desativada."""
        if not project_name:
            return False
        with self._lock:
            conjunto = self._rotinas_paradas.get(project_name, ())
            return (project_name in self._parados or '*' in conjunto
                    or agent_id in conjunto)


# Global do processo, como a `TRAVA_IA`: quem pergunta são threads de vários
# projetos ao mesmo tempo, e o conteúdo é indexado por projeto.
PARADA_DO_PROJETO = ParadaDoProjeto()


class ParadaDoProjetoMixin:
    """O que o resto do backend chama."""

    def projeto_parar(self, project_name):
        """Fechou a aba: pare de pedir coisas ao modelo para este projeto.

        Levanta a flag E fecha as conexões abertas com o LM Studio em nome dele
        — as duas coisas, ver o cabeçalho do módulo.
        """
        PARADA_DO_PROJETO.parar(project_name)

    def projeto_retomar(self, project_name):
        """Abriu o projeto de novo: pode voltar a trabalhar."""
        PARADA_DO_PROJETO.retomar(project_name)

    def projeto_parado(self, project_name):
        """O laço pergunta isto antes de pedir a próxima coisa ao modelo."""
        return PARADA_DO_PROJETO.parado(project_name)

    def projeto_parar_rotinas(self, project_name, agent_id='*'):
        """"Desativar": para a rotina (ou todas) e a requisição dela."""
        PARADA_DO_PROJETO.parar_rotinas(project_name, agent_id)

    def projeto_retomar_rotinas(self, project_name, agent_id='*'):
        """Ativou de novo (ou clicou para rodar): pode voltar a trabalhar."""
        PARADA_DO_PROJETO.retomar_rotinas(project_name, agent_id)

    def rotina_parada(self, project_name, agent_id):
        """O worker da rotina pergunta isto no lugar de `projeto_parado`."""
        return PARADA_DO_PROJETO.rotina_parada(project_name, agent_id)
