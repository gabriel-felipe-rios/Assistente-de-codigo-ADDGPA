"""O que a extensão pediu para rodar, e como o programa o derruba (G5).

Antes deste arquivo, o único gancho de parada de uma extensão era o `parar()`
do `extensao_boot.py`: uma thread aberta por uma chamada da ponte
(`backend/extensao.py`) não era parada por ninguém ao desligar, e o contrato
chegava a ensinar a extensão a pôr o serviço no boot por causa disso.

Agora a extensão PEDE ao programa para rodar — uma thread (`ligar`) ou um
comando do sistema (`ligar_comando`) — e o programa guarda o que foi pedido,
em nome de qual extensão. Desligar a extensão (`descarregar.py`) e fechar o
programa (`boot.parar_extensoes_ao_fechar`) derrubam o que é dela.

O serviço chega pela mesma porta que `preferencias`: `payload['processos']`,
um `XtProcessos` preso a UMA extensão. A extensão não importa nada do programa
(o § 4 do contrato proíbe `from modulos… import`).

⚠️ **Thread não se mata em Python.** Parar uma thread é acender o `Event` que
ela recebeu e esperar que ela saia. Se o alvo não sair em `XT_TETO_PARAR_S`, o
programa avisa (com o nome da extensão e do processo) e segue — nunca
"conserte" isto com `ctypes`. Um comando, sim, se derruba: `taskkill /F /T`
na árvore inteira, como o `stop_script` da aba Terminal.

⚠️ Nada aqui grava em disco (P6): o registro vive só na memória do processo.
"""

import subprocess
import threading
import time

from .constantes import XT_TETO_FECHAR_S, XT_TETO_PARAR_S, slug_da_extensao

# {caminho_relativo: {nome: {'tipo': 'thread'|'comando', 'parar': Event|None,
#                            'thread': Thread|None, 'proc': Popen|None}}}
_REGISTRO = {}
_TRAVA = threading.Lock()

# Sem janela de console: o programa é um `.pyw`, e cada comando abriria uma.
_SEM_JANELA = getattr(subprocess, 'CREATE_NO_WINDOW', 0)


def _vivo(entrada):
    if entrada['tipo'] == 'thread':
        return entrada['thread'] is not None and entrada['thread'].is_alive()
    return entrada['proc'] is not None and entrada['proc'].poll() is None


def _sinalizar(entrada):
    """Só pede para parar — não espera. Separado de `_esperar` para quem para
    várias de uma vez avisar todas ANTES de esperar qualquer uma (mesmo
    desenho de `boot.parar_todas`)."""
    if entrada['tipo'] == 'thread':
        entrada['parar'].set()
        return
    proc = entrada['proc']
    if proc is None or proc.poll() is not None:
        return
    try:
        # A ÁRVORE, e não só o pai: um comando costuma abrir filhos, e matar só
        # o pai os deixaria órfãos segurando porta e arquivo.
        subprocess.run(['taskkill', '/F', '/T', '/PID', str(proc.pid)],
                       capture_output=True, timeout=10, creationflags=_SEM_JANELA)
    except Exception as e:
        print('[extensoes] falha ao derrubar o comando pid %s: %s' % (proc.pid, e))


def _esperar(entrada, teto):
    """Espera até `teto` segundos. Devolve True se parou."""
    teto = max(0.0, teto)
    if entrada['tipo'] == 'thread':
        entrada['thread'].join(timeout=teto)
        return not entrada['thread'].is_alive()
    try:
        entrada['proc'].wait(timeout=teto)
    except subprocess.TimeoutExpired:
        pass
    return entrada['proc'].poll() is not None


def _aviso(caminho_relativo, nome, teto):
    aviso = ('a extensao "%s" nao parou o processo "%s" em %s s; ele pode '
             'continuar rodando ate o programa fechar.' % (caminho_relativo, nome, teto))
    print('[extensoes]', aviso)
    return aviso


def _parar_entradas(pares, teto_total):
    """`pares` = [(caminho, nome, entrada)]. Sinaliza todas, depois espera
    com UM orçamento. Devolve a lista de avisos (vazia = limpo)."""
    for _, _, entrada in pares:
        _sinalizar(entrada)
    limite = time.monotonic() + teto_total
    avisos = []
    for caminho, nome, entrada in pares:
        if not _esperar(entrada, limite - time.monotonic()):
            avisos.append(_aviso(caminho, nome, teto_total))
    return avisos


class XtProcessos:
    """O que chega em `payload['processos']` — preso a UMA extensão.
    Todo método devolve {'success': bool, ...}, como o resto do contrato."""

    def __init__(self, caminho_relativo):
        self._caminho = caminho_relativo

    def _nome_valido(self, nome):
        return isinstance(nome, str) and nome.strip() != ''

    def _ocupado(self, nome):
        """Sob a trava. Um nome cujo processo já terminou sozinho é liberado."""
        entrada = _REGISTRO.get(self._caminho, {}).get(nome)
        if entrada is None:
            return False
        if _vivo(entrada):
            return True
        _REGISTRO[self._caminho].pop(nome, None)
        return False

    def _registrar(self, nome, entrada):
        _REGISTRO.setdefault(self._caminho, {})[nome] = entrada

    def ligar(self, nome, alvo):
        """Roda `alvo(parar)` numa thread daemon 'xt-proc-<slug>-<nome>'.
        `parar` é um threading.Event: o alvo tem de sair quando ele acender
        (use `parar.wait()`, nunca `time.sleep`). Nome já rodando → erro."""
        if not self._nome_valido(nome):
            return {'success': False, 'error': 'nome de processo vazio.'}
        if not callable(alvo):
            return {'success': False, 'error': 'o alvo do processo "%s" não é uma função.' % nome}
        with _TRAVA:
            if self._ocupado(nome):
                return {'success': False, 'error': 'o processo "%s" já está rodando.' % nome}
            parar = threading.Event()
            caminho = self._caminho

            def _correr():
                try:
                    alvo(parar)
                except Exception as e:
                    print('[extensoes] "%s": o processo "%s" falhou: %s' % (caminho, nome, e))

            t = threading.Thread(
                target=_correr, daemon=True,
                name='xt-proc-%s-%s' % (slug_da_extensao(self._caminho), nome))
            self._registrar(nome, {'tipo': 'thread', 'parar': parar, 'thread': t, 'proc': None})
            t.start()
        return {'success': True}

    def ligar_comando(self, nome, comando, pasta=None):
        """subprocess.Popen(comando, cwd=pasta, creationflags=CREATE_NO_WINDOW,
        stdout/stderr=DEVNULL). Parar = taskkill /F /T /PID (como stop_script)."""
        if not self._nome_valido(nome):
            return {'success': False, 'error': 'nome de processo vazio.'}
        with _TRAVA:
            if self._ocupado(nome):
                return {'success': False, 'error': 'o processo "%s" já está rodando.' % nome}
            try:
                proc = subprocess.Popen(
                    comando, cwd=pasta or None, creationflags=_SEM_JANELA,
                    stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL)
            except Exception as e:
                return {'success': False, 'error': 'não consegui rodar o processo "%s": %s' % (nome, e)}
            self._registrar(nome, {'tipo': 'comando', 'parar': None, 'thread': None, 'proc': proc})
        return {'success': True, 'pid': proc.pid}

    def parar(self, nome):
        """Acende o `Event` (thread) ou derruba a árvore (comando) e espera
        `XT_TETO_PARAR_S`. Nome que não está rodando → sucesso, `parou` True."""
        with _TRAVA:
            entrada = _REGISTRO.get(self._caminho, {}).pop(nome, None)
        if entrada is None:
            return {'success': True, 'parou': True}
        avisos = _parar_entradas([(self._caminho, nome, entrada)], XT_TETO_PARAR_S)
        if avisos:
            return {'success': False, 'parou': False, 'error': avisos[0]}
        return {'success': True, 'parou': True}

    def rodando(self, nome):
        with _TRAVA:
            return {'success': True, 'rodando': self._ocupado(nome)}


def parar_da_extensao(caminho_relativo):
    """Derruba tudo o que UMA extensão pediu. Chamado ao desligar
    (`descarregar.py`). Devolve a lista de avisos — vazia quando saiu limpo."""
    with _TRAVA:
        dela = _REGISTRO.pop(caminho_relativo, {})
    pares = [(caminho_relativo, nome, entrada) for nome, entrada in dela.items()]
    return _parar_entradas(pares, XT_TETO_PARAR_S)


def parar_todos():
    """Derruba o que TODAS as extensões pediram, com um orçamento único
    (`XT_TETO_FECHAR_S`) — o fechamento do programa. Devolve os avisos."""
    with _TRAVA:
        tudo = dict(_REGISTRO)
        _REGISTRO.clear()
    pares = [(caminho, nome, entrada)
             for caminho, dela in tudo.items() for nome, entrada in dela.items()]
    return _parar_entradas(pares, XT_TETO_FECHAR_S)
