"""A porta única entre o frontend de uma extensão e o backend dela.

Mesmo desenho de `chamar_plugin`: o frontend manda `{acao, …}`, o
`backend/extensao.py` recebe em `executar(payload)` e devolve o que quiser.
E o mesmo enriquecimento — se vier `projeto`, o payload ganha
`pasta_projeto`, `grafo_imports` e `pipeline` (`payload_de_projeto.py`, a
peça comum aos dois).

⚠️ **A diferença é de onde vem o módulo.** `chamar_plugin` importa a cada
chamada; aqui o módulo é o que `carga.py` guardou quando a extensão foi
LIGADA. Uma extensão desligada devolve erro e nunca importa por conta
própria: importar sozinha faria "desligado" deixar de significar alguma
coisa.
"""

import threading

from ..payload_de_projeto import enriquecer as enriquecer_payload
from . import carga
from .constantes import XT_FUNC_EXECUTAR, XT_TETO_PONTE_S
from .descoberta import extensao_existe, ler_config
from .processos import XtProcessos
from .tela import preferencias_resolvidas


def _nome_da_extensao(caminho):
    """A última parte do caminho relativo — o nome da pasta, que é o nome
    que o usuário vê na tela. É o que vai nas mensagens de erro: "qual
    extensão foi" tem de estar escrito, não deduzido."""
    partes = [p for p in str(caminho or '').replace('\\', '/').split('/') if p]
    return partes[-1] if partes else str(caminho)


def _funcao_da_porta(caminho, nome):
    """`(executar, None)` da extensão LIGADA, ou `(None, {'success': False,
    'error': …})` com o motivo por extenso. As mesmas quatro mensagens de
    sempre — separadas por um motivo cada (ver os comentários)."""
    if not extensao_existe(caminho):
        return None, {'success': False, 'error': 'Extensão não encontrada.'}
    # A meio caminho entre "ligada" e "carregada" (G12: o import corre fora
    # da trava e pode passar do teto). Sem este teste, a ponte diria
    # "Extensão sem backend/extensao.py." para quem só não terminou.
    if carga.esta_carregando(caminho):
        return None, {'success': False,
                      'error': 'A extensão "%s" ainda está carregando.' % nome}
    modulo = carga.obter(caminho)
    if modulo is None:
        # Dois casos diferentes, e a mensagem precisa separá-los: quem
        # esqueceu de ligar procura o interruptor; quem esqueceu o
        # arquivo procura a pasta. ⚠️ Pela CONFIG, e não por
        # `esta_carregada`: uma extensão ligada sem nenhum arquivo Python
        # não entra em registro nenhum, e "Extensão desligada." mandava o
        # autor procurar um interruptor que já estava ligado.
        if ler_config().get(caminho, {}).get('ligado'):
            return None, {'success': False, 'error': 'Extensão sem backend/extensao.py.'}
        return None, {'success': False, 'error': 'Extensão desligada.'}
    funcao = getattr(modulo, XT_FUNC_EXECUTAR, None)
    if not callable(funcao):
        return None, {'success': False,
                      'error': 'backend/extensao.py não define %s().' % XT_FUNC_EXECUTAR}
    return funcao, None


def _correr_com_teto(caminho, nome, funcao, payload):
    """Roda `funcao(payload)` numa thread `daemon` e espera no máximo
    `XT_TETO_PONTE_S` (G12).

    ⚠️ A thread estourada CONTINUA RODANDO — thread em Python não se mata,
    e matar deixaria arquivo meio escrito. É o mesmo desenho de
    `eventos.emitir`: parar de esperar, não matar. Não "conserte" isto com
    `ctypes`. Ação longa de verdade devolve logo e trabalha num processo
    gerenciado (`payload['processos']`)."""
    resultado = {}

    def _correr():
        try:
            resultado['r'] = funcao(payload)
        except Exception as e:
            resultado['e'] = e

    t = threading.Thread(target=_correr, name='xt-ponte-%s' % caminho, daemon=True)
    t.start()
    t.join(timeout=XT_TETO_PONTE_S)
    if t.is_alive():
        print('[extensoes] "%s" nao respondeu a acao %r em %s s'
              % (nome, (payload or {}).get('acao'), XT_TETO_PONTE_S))
        return {'success': False,
                'error': 'A extensão "%s" não respondeu em %s s.' % (nome, XT_TETO_PONTE_S)}
    if 'e' in resultado:
        return {'success': False,
                'error': 'Erro dentro da extensão "%s": %s' % (nome, resultado['e'])}
    return resultado.get('r')


def chamar_pelo_programa(api, caminho, payload):
    """O PROGRAMA — e não a tela da extensão — chamando a porta
    `executar(payload)` dela: as ações `xt.ferramenta`, `xt.prompt` e
    `xt.envelope` (fase 07, D51, D52).

    Mesma porta, mesmo teto e mesmas mensagens de `chamar_extensao`. A
    diferença é o que o payload ganha: só `pasta_projeto` (quando vem
    `projeto`), `preferencias` e `processos`. O grafo de imports e o
    pipeline ficam de fora — uma ferramenta roda dezenas de vezes numa
    tarefa, e ler o `grafo.json` a cada chamada seria tempo jogado fora.

    ⚠️ O PROGRAMA NÃO LÊ nada aqui: só diz à extensão onde fica a raiz. Quem
    abre arquivo fora da pasta de trabalho é a extensão, e ela o declara em
    `le_fora` (P7)."""
    nome = _nome_da_extensao(caminho)
    funcao, erro = _funcao_da_porta(caminho, nome)
    if erro:
        return erro
    payload = dict(payload or {})
    try:
        if payload.get('projeto'):
            try:
                config = api.load_workspace(payload['projeto']).get('config') or {}
                payload['pasta_projeto'] = config.get('root_folder')
            except Exception:
                payload['pasta_projeto'] = None
        payload['preferencias'] = preferencias_resolvidas(caminho)
        payload['processos'] = XtProcessos(caminho)
    except Exception as e:
        return {'success': False, 'error': 'Erro dentro da extensão "%s": %s' % (nome, e)}
    return _correr_com_teto(caminho, nome, funcao, payload)


class XtPonteMixin:
    def chamar_extensao(self, caminho, payload=None):
        """Despacha para `executar(payload)` do `backend/extensao.py` de UMA
        extensão ligada.

        `caminho` é o caminho relativo dentro de `External/extensions/`
        (inclui a categoria, se a extensão estiver dentro de uma). O frontend
        da extensão o tira de `document.currentScript.src`, nunca escrito à
        mão — o usuário pode mover a pasta para dentro de uma categoria a
        qualquer momento.

        Além de `pasta_projeto`, `grafo_imports` e `pipeline` (quando vem
        `projeto`), o payload ganha **`preferencias`**: o que o usuário
        escolheu na tela de configuração da extensão, já resolvido com os
        `padrao` do `config/tela.json`. Uma extensão que só precisa das
        próprias opções não abre arquivo nenhum — e não repete a leitura de
        `preferencias.json` que quatro extensões tinham copiado umas das
        outras. `None` quando a extensão não tem `config/tela.json`.
        """
        nome = _nome_da_extensao(caminho)
        funcao, erro = _funcao_da_porta(caminho, nome)
        if erro:
            return erro

        try:
            payload = enriquecer_payload(self, payload)
            payload['preferencias'] = preferencias_resolvidas(caminho)
            # G5 · O processo gerenciado chega pela mesma porta que
            # `preferencias`: a extensão não importa nada do programa. O objeto
            # fica no Python — só o RETORNO do `executar` atravessa para o JS.
            payload['processos'] = XtProcessos(caminho)
        except Exception as e:
            return {'success': False, 'error': 'Erro dentro da extensão "%s": %s' % (nome, e)}

        # G12 · O `executar` roda numa thread `daemon`, e a ponte espera no
        # máximo `XT_TETO_PONTE_S` — ver `_correr_com_teto`.
        return _correr_com_teto(caminho, nome, funcao, payload)
