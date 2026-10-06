"""O item `{"recurso": "prompt"}` de um manifesto — ele vale, e onde entra?

Pergunta que este arquivo responde: "em que prompt do programa um trecho de
extensão pode entrar, e este trecho vale?". Irmã de `validacao_agente.py`
(convenção «Validação de um recurso de extensão que cresce vira irmã de
`validacao.py`»).

Um trecho de prompt entra num prompt do programa SÓ enquanto a extensão está
ligada — é assim que uma extensão acrescenta ao prompt do Chat e da Fila as
linhas que falam dos subagentes dela, sem o núcleo saber o nome deles (P7).
O texto vem de um `arquivo` da extensão ou, sem `arquivo`, do backend dela
(ação `xt.prompt`), que recebe a lista dos subagentes ligados e decide o que
escrever.

⚠️ Import: nunca importe `descoberta` aqui. Os caminhos dos prompts e a lista
dos subagentes vêm por import TARDIO, dentro da função (ver o mesmo aviso em
`validacao_ferramenta.py`).
"""

import os

from .constantes import XT_BACKEND_ENTRY, XT_ACAO_PROMPT, caminho_absoluto, erro_do_arquivo_declarado


def _texto(item, campo):
    v = item.get(campo)
    return v.strip() if isinstance(v, str) else ''


def alvos_de_prompt():
    """`{alvo: onde, por extenso}` — os prompts do programa que aceitam trecho.

    Lido na hora: um prompt fixo novo em `Prompts fixos/` vira alvo sem
    ninguém mexer aqui, e um subagente do programa que saiu deixa de ser."""
    from ..caminhos import (PASTA_CHAT, PASTA_FILA, PASTA_DOS_PROMPTS_FIXOS,
                            obter_prompt_do_assistente)
    from ..agentes.execucao.subagentes_constantes import SUBAGENTES_LLM_VALIDOS
    alvos = {'chat': 'o prompt do agente do Chat',
             'fila': 'o prompt do agente da Fila'}
    for tela, de_quem in ((PASTA_CHAT, 'do Chat'), (PASTA_FILA, 'da Fila')):
        pasta = obter_prompt_do_assistente(tela, PASTA_DOS_PROMPTS_FIXOS)
        try:
            nomes = sorted(os.listdir(pasta))
        except OSError:
            nomes = []
        for n in nomes:
            if n.lower().endswith('.txt'):
                alvos['%s.%s' % (tela.lower(), n[:-4])] = (
                    'o prompt fixo «%s» %s' % (n[:-4], de_quem))
    for sid in SUBAGENTES_LLM_VALIDOS:
        alvos['subagente.' + sid] = 'o prompt do subagente «%s» do programa' % sid
    return alvos


def validar_item_prompt(caminho_relativo, item, rotulo, usados):
    """`(erro, dados, avisos)` do recurso Trecho de prompt."""
    alvo = _texto(item, 'alvo')
    alvos = alvos_de_prompt()
    if alvo not in alvos:
        return ('%s: o alvo "%s" não existe. Os que existem hoje são: %s.'
                % (rotulo, alvo, ', '.join(sorted(alvos)))), None, []
    marca = 'prompt:' + alvo
    if marca in usados['pontos']:
        return ('%s: o alvo "%s" já foi declarado acima. Um trecho por alvo — junte '
                'os dois num arquivo só.' % (rotulo, alvo)), None, []
    arquivo = _texto(item, 'arquivo')
    if arquivo:
        erro = erro_do_arquivo_declarado(caminho_relativo, arquivo, rotulo)
        if erro:
            return erro, None, []
        if not arquivo.lower().endswith(('.txt', '.md')):
            return ('%s: o trecho de prompt é um arquivo `.txt` ou `.md`, e veio "%s".'
                    % (rotulo, arquivo)), None, []
    elif not os.path.isfile(os.path.join(caminho_absoluto(caminho_relativo), XT_BACKEND_ENTRY)):
        return ('%s: sem `arquivo`, o texto vem do `backend/extensao.py` (ação "%s"), e '
                'a extensão não tem esse arquivo.' % (rotulo, XT_ACAO_PROMPT)), None, []
    usados['pontos'].add(marca)
    return None, {'alvo': alvo, 'arquivo': arquivo}, []
