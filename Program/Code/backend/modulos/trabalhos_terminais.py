"""Os terminais da Oficina — N processos ao mesmo tempo, sem grade e sem teto.

Generalização de `terminal.py`, e vale saber exatamente o que foi aproveitado e
o que é novo, porque a diferença é maior do que parece.

APROVEITADO, quase intacto: o desenho de streaming. Uma thread bombeadora POR
CANAL (stdout e stderr separados), agrupando o que chegou a cada ~120 ms para
não afogar o `evaluate_js` numa saída grande; `taskkill /F /T /PID` para matar a
ÁRVORE do processo, porque matar só o pai deixa órfão todo subprocesso que ele
abriu e eles continuam segurando os canos.

NOVO, sem precedente no projeto:

  **N instâncias simultâneas.** O `terminal.py` indexa por projeto
    (`_term_procs[project_name]`) — um processo por projeto, porque a aba
    Terminal é uma só. Aqui a chave é o NÓ (`_ofi_procs[(projeto, no)]`): o
    canvas tem quantos terminais o usuário quiser, e não há teto — o custo real
    de cada um é o freio, não uma regra do programa.

  **Entrada.** O `terminal.py` só lê. Aqui o usuário digita.

⚠️ O QUE O PROTÓTIPO DE STDIN MOSTROU, e que decidiu o desenho desta classe.
Medido antes de escrever qualquer linha daqui:

    filho que dá flush na saída ....... `subprocess.PIPE` funciona
    filho que NÃO dá flush ............ TRAVA — nada chega, nunca
    o mesmo filho com `-u` ............ volta a funcionar
    `isatty()` no filho ............... **False** nos dois canais

Ou seja: um pipe não é um terminal, e um programa que bufferiza em bloco quando
não está num TTY simplesmente não responde. Por isso o modo NORMAL daqui é o
**tiro só** (D17): cada mensagem é uma execução completa, com o prompt indo na
linha de comando e a saída lida até o processo encerrar. Nesse modo o problema
não existe, porque não há ninguém esperando resposta no meio.

`enviar_entrada` escreve no stdin de um processo VIVO e serve para um CLI que
dê flush — mas não é o caminho principal, e não vira PTY por insistência.
Trazer uma biblioteca de PTY (`pywinpty`) é decisão do usuário, não desta
implementação: nenhuma existe no projeto hoje, e dependência nova não se adota
por conta própria.

⚠️ NENHUM AGENTE ABRE TERMINAL. Não há método aqui alcançável pelo servidor
MCP, e isso é proposital: quantos terminais existem é sempre decisão do
usuário, na tela, à mão. Um preset de lançamento rápido abre vários de uma vez
— mas quem clica continua sendo ele.

Este arquivo era 726 linhas e virou cinco, pelo teto de 500 da AMF:

| Arquivo | A pergunta que ele responde |
|---|---|
| `trabalhos_terminais.py` | quem está vivo, e o que a tela lê |
| `trabalhos_terminais_constantes.py` | os dois números |
| `trabalhos_terminais_rodar.py` | montar o comando, disparar e bombear |
| `trabalhos_terminais_controle.py` | mandar entrada, e parar |
| `trabalhos_terminais_metricas.py` | o que a Linha do tempo e as Métricas leem |

`TrabalhosTerminaisMixin` continua sendo o nome único que `api.py` importa: ele
COMPÕE os três, no padrão de `InspetorMixin` (Convenção 5 da Arquitetura
modular).

⚠️ O REGISTRO DOS PROCESSOS VIVOS FICOU AQUI, e é de memória, do processo do
PROGRAMA. Do processo do servidor MCP ele responde "ninguém" para todo mundo.
"""

from .trabalhos_terminais_constantes import *

from .trabalhos_terminais_rodar import TrabalhosTerminaisRodarMixin
from .trabalhos_terminais_controle import TrabalhosTerminaisControleMixin
from .trabalhos_terminais_metricas import TrabalhosTerminaisMetricasMixin


class TrabalhosTerminaisMixin(TrabalhosTerminaisRodarMixin,
                              TrabalhosTerminaisControleMixin,
                              TrabalhosTerminaisMetricasMixin):

    # ── O registro dos processos vivos ───────────────────────────────────────
    #
    # Vive em memória e morre com o programa, de propósito: um nó continua no
    # canvas depois de fechar o app (isso é `Layout.json`), mas o processo dele
    # não sobrevive — e fingir que sobreviveu, guardando um PID em disco, daria
    # um botão "Parar" apontando para um processo que já não existe, ou pior,
    # para um PID reciclado pelo sistema.

    _ofi_procs = None
    _ofi_dados = None
    # O `evaluate_js` do pywebview não é reentrante: duas threads bombeadoras
    # chamando ao mesmo tempo podem se atropelar e uma se perder. Com N
    # terminais são 2N threads, então isto importa muito mais aqui do que na
    # aba Terminal, que tinha duas.
    _ofi_notify_lock = threading.Lock()

    def _ofi_procs_dict(self):
        if self._ofi_procs is None:
            self._ofi_procs = {}
        return self._ofi_procs

    def _ofi_dados_dict(self):
        """Por terminal: linhas, estado, contadores das Métricas."""
        if self._ofi_dados is None:
            self._ofi_dados = {}
        return self._ofi_dados

    def _ofi_chave(self, project_name, id_no):
        return (project_name, id_no)

    def _ofi_dado_se_existe(self, project_name, id_no):
        """O registro de um terminal, ou `None` — SEM criar.

        Existe porque `_ofi_dado` cria sob demanda, e ler o estado de um nó
        (coisa que a tela faz a cada desenho do canvas) passava a inventar um
        registro de métrica para todo nó que nunca rodou. As Métricas então
        listavam vinte terminais com zero chamada, e a pergunta que elas
        respondem — quem gastou mais — sumia no meio.
        """
        return self._ofi_dados_dict().get(self._ofi_chave(project_name, id_no))

    def _ofi_dado(self, project_name, id_no):
        d = self._ofi_dados_dict()
        chave = self._ofi_chave(project_name, id_no)
        if chave not in d:
            d[chave] = {
                'estado': 'parado', 'disparando': False, 'linhas': [], 'comando': '',
                'chamadas': 0, 'segundos': 0.0, 'inicio': None,
                'tokens_entrada': 0, 'tokens_saida': 0, 'arquivos': [],
                'saiu_com': None, 'erro': None,
            }
        return d[chave]

    def _ofi_notify(self, project_name, id_no, payload):
        try:
            payload = dict(payload)
            payload['project'] = project_name
            payload['no'] = id_no
            with self._ofi_notify_lock:
                # ⚠️ ESTA FUNÇÃO JÁ NÃO EXISTE NO JS. `trabalhos-terminal.js` foi
                # apagado quando o nó de agente em "tiro só" deixou de existir —
                # hoje o agente roda DENTRO do terminal, e quem fala com a tela
                # é `trabalhos_shell.py`. Nada aqui dispara mais: o único caminho
                # até este ponto era `_ofi_disparar`, sem chamador.
                #
                # O `evaluate_js` fica porque a chamada é inofensiva (um erro no
                # console de um caminho morto) e apagá-la exigiria desmontar o
                # mixin inteiro, que ainda serve o "Fechar tudo" e as Métricas.
                self.window.evaluate_js('oficinaTerminalSaida(%s)' % json.dumps(payload))
        except Exception:
            # A ponte pode não existir (servidor MCP, teste headless). Perder a
            # notificação é aceitável; derrubar a thread do terminal não é.
            pass

    def _trab_terminal_rodando(self, project_name, id_no):
        """Há trabalho em curso neste nó?

        ⚠️ NÃO BASTA OLHAR O PROCESSO. Entre `enviar_mensagem_ao_terminal`
        devolver e a thread de fato chamar `Popen`, existe uma janela em que
        não há processo nenhum registrado — e responder "não está rodando" ali
        deixava `excluir_nos` apagar o nó de um terminal que ia começar a
        trabalhar no instante seguinte, deixando o processo órfão, sem nada na
        tela para pará-lo. Por isso o `disparando`, marcado ANTES da thread
        começar e limpo no `finally` dela.
        """
        chave = self._ofi_chave(project_name, id_no)
        proc = self._ofi_procs_dict().get(chave)
        if proc is not None and proc.poll() is None:
            return True
        dado = self._ofi_dado_se_existe(project_name, id_no)
        return bool(dado and dado.get('disparando'))

    def _trab_estado_do_terminal(self, project_name, id_no):
        if self._trab_terminal_rodando(project_name, id_no):
            return 'fazendo'
        # Uma mensagem guardada por dependência é um estado próprio, e não
        # "parado": parado é quem não tem nada para fazer, e este tem — só não
        # pode ainda. A legenda já reservava `aguardando` desde a Fase 2.
        if self._conx_espera_de(project_name, id_no):
            return 'aguardando'
        dado = self._ofi_dado_se_existe(project_name, id_no)
        # Nó que nunca rodou não ganha registro só por ter sido desenhado.
        return dado['estado'] if dado else 'parado'


    # ── O que a tela lê ──────────────────────────────────────────────────────

    def carregar_terminal(self, project_name, id_no):
        """O log acumulado de um terminal — para reabrir o nó sem perder nada."""
        try:
            dado = self._ofi_dado(project_name, id_no)
            return {'success': True, 'linhas': dado['linhas'],
                    'comando': dado['comando'], 'erro': dado['erro'],
                    'estado': self._trab_estado_do_terminal(project_name, id_no),
                    'rodando': self._trab_terminal_rodando(project_name, id_no)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _ofi_metricas_por_no(self, project_name):
        """Os números de cada terminal, para a Linha do tempo e as Métricas."""
        saida = {}
        for (proj, id_no), dado in self._ofi_dados_dict().items():
            if proj != project_name:
                continue
            # Terminal que nunca foi acionado não entra: uma barra de zero por
            # nó desenhado esconderia as barras que importam.
            if not dado['chamadas']:
                continue
            segundos = dado['segundos']
            if dado['inicio']:
                segundos += time.time() - dado['inicio']
            saida[id_no] = {
                'estado': self._trab_estado_do_terminal(project_name, id_no),
                'chamadas': dado['chamadas'], 'segundos': round(segundos, 1),
                'tokens_entrada': dado['tokens_entrada'],
                'tokens_saida': dado['tokens_saida'],
                'arquivos': dado['arquivos'], 'saiu_com': dado['saiu_com'],
            }
        return saida

