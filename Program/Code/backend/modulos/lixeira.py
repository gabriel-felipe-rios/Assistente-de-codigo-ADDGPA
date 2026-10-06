"""Mandar um arquivo ou pasta para a Lixeira do Windows.

Primitiva do sistema, sem semântica de projeto — como `aparencia_miniatura`. Por
isso é função de módulo e não método do `Api`: quem expõe na ponte é quem tem a
contenção de caminho (`editor_arquivos.py`), e qualquer outra tela pode reusar
daqui sem passar pelo Editor.

⚠️ NÃO USA BIBLIOTECA. `send2trash` faria isto em uma linha e traria uma
dependência para uma chamada só. `SHFileOperationW` é API do Windows desde
sempre e chega por `ctypes`, que já vem no Python.

⚠️ E NÃO TEM PLANO B COM `os.remove`. Se a Lixeira recusar, a resposta é o erro
— nunca apagar de vez por baixo dos panos. A tela prometeu "vai para a Lixeira";
cumprir isso pela metade é pior que falhar.
"""

import ctypes
import os
from ctypes import wintypes


FO_DELETE = 0x0003

FOF_SILENT          = 0x0004
FOF_NOCONFIRMATION  = 0x0010
FOF_ALLOWUNDO       = 0x0040   # ← é ISTO que manda para a Lixeira, e não apaga
FOF_NOERRORUI       = 0x0400
FOF_WANTNUKEWARNING = 0x4000   # ← ver a armadilha 1 abaixo


class SHFILEOPSTRUCTW(ctypes.Structure):
    """A estrutura que a shell espera.

    ⚠️ `fFlags` é WORD (16 bits), não UINT. Declarado como `c_uint`, todos os
    campos seguintes deslocam quatro bytes e a chamada passa a fazer outra
    coisa — sem erro, com resultado imprevisível.
    """

    _fields_ = [
        ('hwnd',                  wintypes.HWND),
        ('wFunc',                 wintypes.UINT),
        ('pFrom',                 wintypes.LPCWSTR),
        ('pTo',                   wintypes.LPCWSTR),
        ('fFlags',                ctypes.c_uint16),
        ('fAnyOperationsAborted', wintypes.BOOL),
        ('hNameMappings',         ctypes.c_void_p),
        ('lpszProgressTitle',     wintypes.LPCWSTR),
    ]


# Em 32 bits a estrutura é empacotada; em 64 o alinhamento natural é o correto.
if ctypes.sizeof(ctypes.c_void_p) == 4:
    SHFILEOPSTRUCTW._pack_ = 1


# O retorno NÃO é código Win32 — é código da shell, e `GetLastError()` não serve
# para traduzi-lo. Só os que aparecem na prática ganham frase; o resto vira o
# número, que é honesto e pesquisável.
_ERROS = {
    0x71:  'O Windows recusou: origem e destino são o mesmo arquivo.',
    0x74:  'O nome do arquivo é longo demais para esta operação.',
    0x78:  'Acesso negado — o arquivo pode estar aberto em outro programa.',
    0x7C:  'Caminho inválido.',
    0x10000: 'Erro inesperado do Windows durante a exclusão.',
    0x402: 'O Windows não encontrou esse caminho.',
}


def _e_removivel_ou_de_rede(caminho):
    """A unidade recicla? Rede e removível costumam apagar direto.

    O aviso da tela promete Lixeira. Se a unidade não tem Lixeira, o usuário
    precisa saber ANTES de confirmar — um aviso que erra sobre reversibilidade é
    pior que nenhum aviso.
    """
    try:
        unidade = os.path.splitdrive(os.path.abspath(caminho))[0]
        if not unidade:
            return True   # caminho UNC (\\servidor\...) — sem letra de unidade
        tipo = ctypes.windll.kernel32.GetDriveTypeW(ctypes.c_wchar_p(unidade + '\\'))
        # 2 = removível, 4 = rede, 5 = CD-ROM, 6 = disco em RAM
        return tipo in (2, 4, 5, 6)
    except Exception:
        return False


def unidade_sem_lixeira(caminho):
    """Para a tela poder avisar antes de confirmar. Não apaga nada."""
    return _e_removivel_ou_de_rede(caminho)


def mandar_para_a_lixeira(caminho):
    """(ok, mensagem de erro). Não levanta."""
    try:
        if os.name != 'nt':
            return False, 'A Lixeira só existe no Windows.'

        alvo = os.path.abspath(os.path.normpath(caminho))
        if not os.path.exists(alvo):
            return False, 'Esse caminho não existe mais.'

        # ⚠️ `SHFileOperationW` NÃO aceita o prefixo `\\?\` de caminho longo.
        # Acima do MAX_PATH a resposta é o erro; tentar `os.remove` como saída
        # transformaria "mandar para a Lixeira" em "apagar de vez" justamente no
        # caso em que o usuário menos espera.
        if len(alvo) >= 260:
            return False, ('O caminho é longo demais para a Lixeira do Windows '
                           f'({len(alvo)} caracteres, limite de 259). Nada foi apagado.')

        op = SHFILEOPSTRUCTW()
        op.hwnd = None
        op.wFunc = FO_DELETE
        # ⚠️ DUPLO NUL: o primeiro termina o caminho, o segundo termina a LISTA
        # de caminhos. Sem o segundo, a shell continua lendo memória adjacente.
        op.pFrom = alvo + '\0\0'
        op.pTo = None
        # ⚠️ ARMADILHA 1, e é a que apaga de vez: `FOF_NOCONFIRMATION` sozinho
        # faz o Windows apagar PERMANENTEMENTE, sem perguntar, um arquivo grande
        # demais para caber na Lixeira. `FOF_WANTNUKEWARNING` obriga a pergunta
        # nesse caso específico — é o que separa "silencioso" de "silencioso e
        # destrutivo".
        op.fFlags = (FOF_ALLOWUNDO | FOF_NOCONFIRMATION
                     | FOF_NOERRORUI | FOF_WANTNUKEWARNING)
        op.fAnyOperationsAborted = False
        op.hNameMappings = None
        op.lpszProgressTitle = None

        # ⚠️ As chamadas da ponte pywebview rodam em thread de trabalho, e a
        # shell precisa de COM inicializado nela. Sem isto a chamada pode falhar
        # ou travar. `RPC_E_CHANGED_MODE` (-2147417850) significa que a thread já
        # tem COM em outro modo — é aceitável e não deve derrubar a operação.
        ole = ctypes.windll.ole32
        iniciamos_com = False
        hr = ole.OleInitialize(None)
        if hr in (0, 1):          # S_OK, S_FALSE
            iniciamos_com = True
        try:
            codigo = ctypes.windll.shell32.SHFileOperationW(ctypes.byref(op))
        finally:
            if iniciamos_com:
                ole.OleUninitialize()

        # ⚠️ Checar OS DOIS. O retorno pode ser 0 com `fAnyOperationsAborted`
        # verdadeiro — é o usuário tendo cancelado no aviso da armadilha 1, e
        # reportar sucesso ali seria mentir que o arquivo foi para a Lixeira.
        if op.fAnyOperationsAborted:
            return False, 'A exclusão foi cancelada.'
        if codigo != 0:
            return False, _ERROS.get(codigo,
                                     f'O Windows recusou a exclusão (código 0x{codigo:X}).')
        return True, ''
    except Exception as e:
        return False, f'{type(e).__name__}: {e}'
