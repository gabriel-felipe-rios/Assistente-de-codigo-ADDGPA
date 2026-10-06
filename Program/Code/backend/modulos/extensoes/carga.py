"""O registro dos módulos Python das extensões LIGADAS.

⚠️ **Aqui está a diferença de fundo em relação ao Plugin.** `chamar_plugin`
faz `exec_module` a cada chamada: módulo novo, globais zeradas, nada
sobrevive entre duas chamadas. Uma extensão é importada UMA vez, ao ligar, e
o módulo fica guardado aqui até ela ser desligada.

Duas coisas dependem disso:

  - a extensão pode ter **estado** no backend (uma conexão aberta, um cache,
    um contador) — é o que a torna capaz de mudar o comportamento do
    programa, e não só de responder perguntas;
  - `descarregar.py` tem **o que desfazer**. Sem um registro, "desligar" no
    backend não teria significado nenhum: não haveria módulo para largar nem
    `parar()` para chamar.

Este módulo não expõe nada à `Api` — quem o usa é `ponte.py`, `boot.py` e
`descarregar.py`.
"""

import os
import sys
import threading
import importlib.util

from .constantes import (XT_BACKEND_ENTRY, XT_BOOT_ENTRY, caminho_absoluto,
                         slug_da_extensao)

# `{caminho_relativo: modulo}` — o `backend/extensao.py` de cada extensão
# ligada que tem backend. Extensão sem backend simplesmente não entra aqui.
_MODULOS = {}
# `{caminho_relativo: modulo}` — o `extensao_boot.py`, idem.
_BOOTS = {}
# Os caminhos cujo import está EM ANDAMENTO (G12). O `exec_module` corre fora
# da trava, e este conjunto é o que impede uma segunda carga da mesma extensão
# enquanto a primeira ainda não terminou.
_CARREGANDO = set()

# ⚠️ Os dois dicionários são lidos de MAIS DE UMA THREAD. Quem liga e desliga
# roda na thread da ponte do pywebview; quem emite um evento do lado Python
# (`eventos.emitir`) roda no worker de uma rotina ou de um terminal, e
# percorre `caminhos_carregados()` no meio do encerramento de um processo.
# Sem a trava, `set(_MODULOS)` numa thread e `_MODULOS.pop` na outra estouram
# "dictionary changed size during iteration" — dentro de um `emitir` que
# promete nunca lançar. É `RLock` porque `carregar` chama `esta_carregada`.
_TRAVA = threading.RLock()


def _nome_de_modulo(caminho_relativo, sufixo):
    """O nome do módulo sai do slug, e não de `hash()`: dois processos do
    programa geram o mesmo nome, e o nome diz de qual extensão é quando
    aparece num traceback."""
    return 'xt_%s_%s' % (slug_da_extensao(caminho_relativo), sufixo)


def _importar(caminho_relativo, nome_arquivo_relativo, sufixo):
    """Importa UM arquivo .py de dentro da pasta de UMA extensão, pelo
    caminho relativo (inclui a categoria, se ela estiver dentro de uma).
    Devolve None se o arquivo não existir — o caso comum, não um erro.

    ⚠️ **O módulo entra como PACOTE, e é isso que faz `from . import irmao`
    funcionar.** Sem `submodule_search_locations` e sem a entrada em
    `sys.modules`, um `backend/extensao.py` que importasse
    `backend/{pfx}_acoes.py` estouraria com "attempted relative import with no
    known parent package" — e a estrutura de backend em cinco arquivos que o
    contrato prescreve seria impossível de escrever.

    É a diferença mais importante em relação ao Plugin, e a razão de o Plugin
    base ter TUDO num arquivo só: lá a pasta não está no `sys.path` e não há
    pacote, então um segundo `.py` em `backend/` não pode ser importado. Aqui
    pode, e a pasta do arquivo é o lugar onde os irmãos são procurados.
    """
    caminho = os.path.join(caminho_absoluto(caminho_relativo), nome_arquivo_relativo)
    if not os.path.isfile(caminho):
        return None

    nome = _nome_de_modulo(caminho_relativo, sufixo)
    spec = importlib.util.spec_from_file_location(
        nome, caminho, submodule_search_locations=[os.path.dirname(caminho)])
    if not spec or not spec.loader:
        return None

    modulo = importlib.util.module_from_spec(spec)
    # Antes do `exec_module`, e não depois: o import do irmão acontece DURANTE
    # a execução do arquivo, e a máquina de import procura o pai em
    # `sys.modules`. Registrar depois seria tarde.
    sys.modules[nome] = modulo
    try:
        spec.loader.exec_module(modulo)
    except BaseException:
        # Um módulo que não terminou de executar não pode ficar em
        # `sys.modules`: o próximo `import` acharia o meio-módulo e não tentaria
        # de novo — consertar o arquivo e religar não adiantaria nada.
        sys.modules.pop(nome, None)
        raise
    return modulo


def _esquecer_modulos(caminho_relativo, sufixo):
    """Tira de `sys.modules` o módulo da extensão e todos os irmãos que ele
    importou. Sem isto, religar a extensão depois de editar um irmão traria o
    código VELHO — o `import` acharia o de antes ainda registrado."""
    prefixo = _nome_de_modulo(caminho_relativo, sufixo)
    for nome in [n for n in sys.modules
                 if n == prefixo or n.startswith(prefixo + '.')]:
        sys.modules.pop(nome, None)


def carregar(caminho_relativo):
    """Importa o backend e o boot de uma extensão que está sendo LIGADA.

    Devolve `(ok, erro)`. Extensão sem backend e sem boot é `(True, None)`:
    muita extensão é só frontend, ou só dado, e não ter Python não é falha.

    ⚠️ Carregar de novo o que já está carregado é NADA, e não um `exec_module`
    a mais. Sem esta guarda, dois caminhos que chamem `carregar` para a mesma
    extensão trocariam o módulo guardado por um novo — e a thread que a
    primeira carga deixou rodando ficaria segurando o módulo VELHO, cujo
    `parar()` ninguém mais alcança. O mesmo vale para quem chega enquanto a
    primeira carga ainda está importando (`_CARREGANDO`).

    ⚠️ G12 · O `exec_module` corre FORA da trava. Dentro dela, um import lento
    (um `time.sleep` no topo do arquivo) parava a ponte e os eventos de TODAS
    as extensões, porque `obter`, `obter_boot` e `caminhos_carregados` esperam
    a mesma trava. A trava só protege os dicionários: marcar, gravar, desmarcar.
    """
    with _TRAVA:
        if esta_carregada(caminho_relativo) or caminho_relativo in _CARREGANDO:
            return True, None
        _CARREGANDO.add(caminho_relativo)

    try:
        # ⚠️ Os dois arquivos são independentes, e a falha de um NÃO impede o
        # outro de entrar. Antes, um `backend/extensao.py` com erro de sintaxe
        # fazia a função sair antes de tentar o `extensao_boot.py` — e a
        # extensão perdia também o serviço autônomo, que não dependia dele. Os
        # dois erros vão juntos para a tela.
        erros = []
        try:
            modulo = _importar(caminho_relativo, XT_BACKEND_ENTRY, 'backend')
        except Exception as e:
            modulo = None
            erros.append('falha ao carregar %s: %s' % (XT_BACKEND_ENTRY.replace(os.sep, '/'), e))

        try:
            boot = _importar(caminho_relativo, XT_BOOT_ENTRY, 'boot')
        except Exception as e:
            # O backend já entrou; largá-lo aqui deixaria a extensão meio
            # ligada. Ela fica ligada com o backend e sem o boot.
            boot = None
            erros.append('falha ao carregar %s: %s' % (XT_BOOT_ENTRY, e))

        with _TRAVA:
            if modulo is not None:
                _MODULOS[caminho_relativo] = modulo
            if boot is not None:
                _BOOTS[caminho_relativo] = boot
    finally:
        with _TRAVA:
            _CARREGANDO.discard(caminho_relativo)

    if erros:
        return False, '; '.join(erros)
    return True, None


def obter(caminho_relativo):
    """O módulo `backend/extensao.py`, ou None se a extensão não está ligada
    ou não tem backend. `ponte.py` distingue os dois casos."""
    with _TRAVA:
        return _MODULOS.get(caminho_relativo)


def obter_boot(caminho_relativo):
    with _TRAVA:
        return _BOOTS.get(caminho_relativo)


def esta_carregada(caminho_relativo):
    with _TRAVA:
        return caminho_relativo in _MODULOS or caminho_relativo in _BOOTS


def esta_carregando(caminho_relativo):
    """O import desta extensão começou e ainda não terminou (G12)."""
    with _TRAVA:
        return caminho_relativo in _CARREGANDO


def descartar(caminho_relativo):
    """Larga os dois módulos e os irmãos que eles importaram.

    O Python só recolhe o que ninguém mais segura — uma thread que a extensão
    deixou viva mantém o módulo dela de pé, e é exatamente por isso que
    `parar()` é obrigatório no contrato.

    ⚠️ Limpar `sys.modules` é o que faz o ciclo de trabalho funcionar: sem
    isso, editar um `{pfx}_acoes.py` e religar a extensão traria o código
    velho, porque o `import` acharia o módulo de antes ainda registrado — e
    nada explicaria por que a mudança não fez efeito.
    """
    with _TRAVA:
        _MODULOS.pop(caminho_relativo, None)
        _BOOTS.pop(caminho_relativo, None)
        _esquecer_modulos(caminho_relativo, 'backend')
        _esquecer_modulos(caminho_relativo, 'boot')


def caminhos_carregados():
    """Uma CÓPIA ordenada — quem itera não segura a trava, e o registro pode
    mudar debaixo dele sem estourar."""
    with _TRAVA:
        return sorted(set(_MODULOS) | set(_BOOTS))
