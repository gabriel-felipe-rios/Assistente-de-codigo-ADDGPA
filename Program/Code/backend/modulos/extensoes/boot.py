"""As extensões que rodam sozinhas: `iniciar()` no arranque, `parar()` ao
desligar.

⚠️ **`iniciar()` nunca roda na thread do boot.** `_iniciar_plugins_ativos`
roda em `api.py`, na thread principal, antes de a janela existir: um
`iniciar()` lento atrasaria a abertura do programa, e um travado travaria tudo
— o usuário veria o programa não abrir, sem nenhuma pista de qual extensão
foi. Cada extensão ganha a própria `Thread`, e este módulo retorna na hora.

⚠️ **`parar()` é obrigatório, e o Plugin resolve isso de outro jeito.** O
Plugin base deixa o laço se reagendar para sempre e reler o próprio estado a
cada ciclo, pulando o trabalho quando está desligado — funciona, mas deixa uma
thread viva até o programa fechar. Aqui o programa chama `parar()` e a
extensão para de verdade. Se ela não responder em `XT_TETO_PARAR_S`, o
programa avisa no `print` e segue: uma extensão que não sabe parar não pode
impedir o usuário de desligar a próxima.
"""

import time
import threading

from . import carga
from . import processos
from .constantes import (XT_BOOT_ENTRY, XT_FUNC_INICIAR, XT_FUNC_PARAR,
                         XT_TETO_PARAR_S, XT_TETO_FECHAR_S, XT_TETO_CARGA_S)
from .descoberta import ler_config, montar_arvore, todas_as_folhas

# `{caminho_relativo: Thread}` — só para saber, no desligar, se ainda há algo
# rodando depois de `parar()` ter sido chamado.
_THREADS = {}


def iniciar_uma(caminho_relativo):
    """Dispara `iniciar()` da extensão numa thread e volta na hora. Silencioso
    quando a extensão não tem boot — é o caso comum."""
    modulo = carga.obter_boot(caminho_relativo)
    if modulo is None:
        return
    # Já rodando: não começa outra. Duas threads no mesmo `iniciar()` seriam
    # dois laços concorrentes, e o `parar()` pararia só um deles.
    anterior = _THREADS.get(caminho_relativo)
    if anterior is not None and anterior.is_alive():
        return
    iniciar = getattr(modulo, XT_FUNC_INICIAR, None)
    if not callable(iniciar):
        print('[extensoes] "%s" tem %s mas nao define %s().'
              % (caminho_relativo, XT_BOOT_ENTRY, XT_FUNC_INICIAR))
        return

    def alvo():
        try:
            iniciar()
        except Exception as e:
            print('[extensoes] "%s" falhou em %s(): %s'
                  % (caminho_relativo, XT_FUNC_INICIAR, e))

    # `daemon=True`: uma extensão que ignorou o contrato e deixou um laço
    # infinito não pode impedir o programa de FECHAR. Desligar ela é o
    # `parar()`; fechar o programa é o sistema operacional.
    t = threading.Thread(target=alvo, name='xt-boot-%s' % caminho_relativo, daemon=True)
    _THREADS[caminho_relativo] = t
    t.start()


def _chamar_parar(caminho_relativo):
    """Só chama o `parar()` — não espera. É a metade barata de `parar_uma`,
    separada para `parar_todas` avisar todas as extensões ANTES de esperar
    qualquer uma: assim dez extensões param em paralelo, e não em fila."""
    modulo = carga.obter_boot(caminho_relativo)
    if modulo is None:
        return
    parar = getattr(modulo, XT_FUNC_PARAR, None)
    if callable(parar):
        try:
            parar()
        except Exception as e:
            print('[extensoes] "%s" falhou em %s(): %s'
                  % (caminho_relativo, XT_FUNC_PARAR, e))
    else:
        print('[extensoes] "%s" tem %s e nao define %s() — '
              'o que ela iniciou continua rodando.'
              % (caminho_relativo, XT_BOOT_ENTRY, XT_FUNC_PARAR))


def parar_uma(caminho_relativo):
    """Chama `parar()` e espera o teto. Devolve o aviso, ou None se parou
    limpo — quem chamou decide se mostra ao usuário."""
    thread = _THREADS.pop(caminho_relativo, None)
    _chamar_parar(caminho_relativo)

    if thread is not None and thread.is_alive():
        thread.join(timeout=XT_TETO_PARAR_S)
        if thread.is_alive():
            aviso = ('a extensao "%s" nao parou em %s s; o que ela iniciou pode '
                     'continuar rodando ate o programa fechar.'
                     % (caminho_relativo, XT_TETO_PARAR_S))
            print('[extensoes]', aviso)
            return aviso
    return None


def parar_todas():
    """O `parar()` de TODA extensão carregada, para o fechamento do programa.

    ⚠️ Até 05/09/2026 isto não existia: fechar a janela matava as threads
    `daemon` com `os._exit`, e o `parar()` — que o contrato chama de
    obrigatório — nunca rodava no fechamento. A extensão "Servidor local com
    recarga" deixava o socket e o `files/estado.json` dizendo que o servidor
    estava no ar. O docstring deste módulo prometia "`parar()` ao desligar", e
    fechar o programa é o desligar de todas.

    Avisa todas primeiro e só depois espera, com UM orçamento
    (`XT_TETO_FECHAR_S`) para o conjunto: a intenção de quem fechou a janela
    é parar tudo agora, e nenhuma extensão teimosa pode segurar o processo.
    Devolve os caminhos de quem não parou a tempo.
    """
    caminhos = carga.caminhos_carregados()
    for caminho in caminhos:
        try:
            _chamar_parar(caminho)
        except Exception as e:
            print('[extensoes] falha ao parar "%s": %s' % (caminho, e))

    limite = time.monotonic() + XT_TETO_FECHAR_S
    teimosas = []
    for caminho in caminhos:
        thread = _THREADS.pop(caminho, None)
        if thread is None or not thread.is_alive():
            continue
        thread.join(timeout=max(0.0, limite - time.monotonic()))
        if thread.is_alive():
            teimosas.append(caminho)
    if teimosas:
        print('[extensoes] nao pararam em %s s ao fechar: %s'
              % (XT_TETO_FECHAR_S, ', '.join(teimosas)))
    return teimosas


class XtBootMixin:
    def _iniciar_extensoes_ativas(self):
        """Carrega e inicia, uma vez, cada extensão LIGADA — chamado de
        `api.py` logo depois de `_iniciar_plugins_ativos()`.

        Nunca deixa a falha de uma extensão impedir a próxima de ligar nem o
        programa de abrir: cada passo fica dentro do próprio `try/except`, e o
        `print` nomeia a extensão. Mesma regra de `_iniciar_plugins_ativos`.

        ⚠️ Quem decide "ligada" é a ÁRVORE, e não a config crua. `ligado` de
        uma folha já é "o usuário ligou E o manifesto está ok" — a mesma
        conta que a tela usa. Lendo só a config, uma extensão com o manifesto
        quebrado era carregada e iniciada no boot enquanto a lista a mostrava
        desabilitada: dois caminhos discordando sobre o que está rodando.

        ⚠️ G12 · O import de cada extensão corre numa thread `daemon` própria,
        e o programa espera todas com UM orçamento (`XT_TETO_CARGA_S`) — mesmo
        desenho de `parar_todas`. Antes, o `carga.carregar` rodava aqui, na
        thread principal: um `time.sleep(30)` no topo de um `extensao.py`
        atrasava a abertura da janela em 30 s, sem pista de qual foi. Quem
        passa do teto NÃO é morto (thread não se mata): continua carregando e
        faz o próprio `iniciar_uma` quando terminar, na thread dela.
        """
        threads = []
        for folha in todas_as_folhas(montar_arvore()):
            if not folha['ligado']:
                continue
            caminho = folha['caminho']

            def _carregar_e_iniciar(caminho=caminho):
                try:
                    ok, erro = carga.carregar(caminho)
                    if not ok:
                        print('[extensoes] "%s": %s' % (caminho, erro))
                    # Mesmo com erro: `carregar` guarda o que conseguiu
                    # importar, e um boot que entrou tem de iniciar.
                    # `iniciar_uma` é silenciosa quando não há boot.
                    iniciar_uma(caminho)
                    # O usuário pode ter desligado enquanto o import corria —
                    # a mesma releitura de `estado.save_config_extensao_programa`.
                    # Import local: `descarregar` importa este módulo.
                    if not ler_config().get(caminho, {}).get('ligado'):
                        from .descarregar import descarregar
                        descarregar(caminho)
                except Exception as e:
                    print('[extensoes] falha ao iniciar "%s": %s' % (caminho, e))

            t = threading.Thread(target=_carregar_e_iniciar,
                                 name='xt-carga-%s' % caminho, daemon=True)
            t.start()
            threads.append((caminho, t))

        limite = time.monotonic() + XT_TETO_CARGA_S
        for caminho, t in threads:
            t.join(timeout=max(0.0, limite - time.monotonic()))
            if t.is_alive():
                print('[extensoes] "%s" ainda carregando depois de %s s — o '
                      'programa abriu sem esperar.' % (caminho, XT_TETO_CARGA_S))

    def parar_extensoes_ao_fechar(self):
        """Chamado pelo `.pyw` no fechamento da janela, antes do `os._exit`.
        Nunca lança: nada daqui pode impedir o programa de fechar."""
        try:
            nao_pararam = parar_todas()
            # G5 · Fechar é "o desligar de todas" — e isso inclui o que as
            # extensões pediram para rodar como processo gerenciado.
            avisos_processos = processos.parar_todos()
            return {'success': True, 'nao_pararam': nao_pararam,
                    'avisos_processos': avisos_processos}
        except Exception as e:
            print('[extensoes] falha ao parar as extensoes ao fechar:', e)
            return {'success': False, 'error': str(e)}
