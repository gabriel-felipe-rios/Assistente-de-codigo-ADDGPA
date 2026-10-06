"""Desfazer, no backend, o que uma extensão fez ao ligar.

⚠️ **Isto não existe no Plugin, e é a peça central do "desligar sem
reiniciar" (D13).** Um plugin nunca precisou disto: ele reimporta o módulo a
cada chamada, então não há nada guardado para largar. Uma extensão fica
carregada enquanto está ligada — e o que fica carregado precisa ser largado.

⚠️ **Desligar não apaga NADA** (D22). Nem a pasta, nem `files/`, nem
`config/`. Quem desliga para testar não pode perder o que a extensão gerou, e
apagar continua sendo o usuário apagando a pasta à mão.

A ordem importa: `parar()` primeiro (a extensão ainda tem o módulo dela de
pé), só então largar o módulo. Na ordem inversa, `parar()` seria chamado num
módulo que ninguém mais segura.
"""

from . import carga
from . import processos
from .boot import parar_uma


def descarregar(caminho_relativo):
    """Devolve a lista de avisos — vazia quando saiu tudo limpo.

    Nunca lança: desligar é uma operação que o usuário pediu, e ela precisa
    terminar mesmo com a extensão em pedaços. Uma extensão que explode no
    `parar()` fica desligada do mesmo jeito.
    """
    avisos = []
    try:
        aviso = parar_uma(caminho_relativo)
        if aviso:
            avisos.append(aviso)
    except Exception as e:
        avisos.append('falha ao parar "%s": %s' % (caminho_relativo, e))

    # G5 · Os processos gerenciados que a extensão pediu (`payload['processos']`)
    # caem aqui: depois do `parar()` e ANTES de largar o módulo — a mesma ordem
    # do cabeçalho, parar enquanto o código dela ainda está de pé.
    try:
        avisos.extend(processos.parar_da_extensao(caminho_relativo))
    except Exception as e:
        avisos.append('falha ao parar os processos de "%s": %s' % (caminho_relativo, e))

    try:
        carga.descartar(caminho_relativo)
    except Exception as e:
        avisos.append('falha ao largar o modulo de "%s": %s' % (caminho_relativo, e))

    return avisos
