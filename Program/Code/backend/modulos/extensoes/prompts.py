"""O que as extensões ligadas acrescentam ao que o modelo lê — os trechos de
prompt e o envelope do subagente.

Pergunta que este arquivo responde: "antes de mandar este prompt (ou esta
pergunta a um subagente), o que as extensões ligadas põem nele?". Quem
pergunta é o núcleo dos subagentes — o Chat, a Fila, o subagente, o prompt
fixo —, sempre com um `alvo` genérico: o núcleo nunca sabe o nome de um
subagente de extensão (P7).

  - **trecho de prompt** (recurso `prompt`): o texto entra no marcador
    `{acrescimos_das_extensoes}` do prompt do programa; sem marcador, no fim.
    Vem do `arquivo` do item ou, sem ele, do backend da extensão (ação
    `xt.prompt`, que recebe os subagentes ligados e decide o que escrever).
  - **envelope** (`"envelope": true` no subagente): blocos `[ROTULO — nome]`
    que vão na mensagem `user`, junto da pergunta (regra «Instrução no system,
    conteúdo no envelope»). Vem do backend (ação `xt.envelope`).

⚠️ NUNCA LANÇA. Uma extensão quebrada não derruba o Chat: o trecho dela fica
de fora e o motivo vai para o console, com o nome dela.
"""

from .agentes import subagentes_de_extensoes, trechos_de_prompt
from .constantes import XT_ACAO_PROMPT, XT_ACAO_ENVELOPE, XT_MARCADOR_ACRESCIMOS
from .ponte import chamar_pelo_programa


def acrescimos_de_prompt(api, alvo, projeto=None, subagentes_ativos=None):
    """O texto que as extensões ligadas acrescentam ao prompt `alvo`, já
    juntado (um trecho por extensão, separados por uma linha em branco) — ou
    `''`. `subagentes_ativos` vai ao backend da extensão; `None` quando quem
    monta o prompt não sabe (um prompt fixo)."""
    partes = []
    for trecho in trechos_de_prompt(alvo):
        if trecho['arquivo']:
            try:
                with open(trecho['arquivo'], 'r', encoding='utf-8') as f:
                    texto = f.read()
            except OSError as e:
                print('[extensoes] o trecho "%s" da extensão "%s" ficou de fora: %s'
                      % (trecho['id'], trecho['extensao'], e))
                continue
        else:
            r = chamar_pelo_programa(api, trecho['caminho_extensao'], {
                'acao': XT_ACAO_PROMPT, 'alvo': alvo, 'projeto': projeto,
                'subagentes_ativos': (list(subagentes_ativos)
                                      if subagentes_ativos is not None else None)})
            if not isinstance(r, dict) or not r.get('success'):
                print('[extensoes] o trecho "%s" da extensão "%s" ficou de fora: %s'
                      % (trecho['id'], trecho['extensao'],
                         (r or {}).get('error') if isinstance(r, dict) else r))
                continue
            texto = r.get('texto') if isinstance(r.get('texto'), str) else ''
        if texto.strip():
            partes.append(texto.strip())
    return '\n\n'.join(partes)


def aplicar_acrescimos(texto, acrescimo):
    """Põe `acrescimo` no marcador `{acrescimos_das_extensoes}` de `texto`.

    Sem acréscimo, o marcador some junto com a quebra de linha dele — o
    prompt do programa sem extensão nenhuma fica como era. Sem marcador, o
    acréscimo vai no fim, depois de uma linha em branco."""
    if XT_MARCADOR_ACRESCIMOS in texto:
        if acrescimo:
            return texto.replace(XT_MARCADOR_ACRESCIMOS, acrescimo)
        return (texto.replace(XT_MARCADOR_ACRESCIMOS + '\n', '')
                .replace(XT_MARCADOR_ACRESCIMOS, ''))
    if acrescimo:
        return texto.rstrip() + '\n\n' + acrescimo
    return texto


def envelope_de_extensao(api, subagente, projeto):
    """Os blocos que o subagente de extensão `subagente` recebe junto da
    pergunta, já formatados (`\\n\\n[ROTULO — nome]\\ntexto` cada um), ou `''`.

    Os ids do programa nunca têm ponto, e voltam `''` sem ler a pasta das
    extensões — o envio de quem não tem extensão não paga nada a mais."""
    if '.' not in (subagente or ''):
        return ''
    for s in subagentes_de_extensoes():
        if s['id'] != subagente or not s['envelope']:
            continue
        r = chamar_pelo_programa(api, s['caminho_extensao'], {
            'acao': XT_ACAO_ENVELOPE, 'subagente': subagente, 'projeto': projeto})
        if not isinstance(r, dict) or not r.get('success'):
            print('[extensoes] o envelope de "%s" ficou de fora: %s'
                  % (subagente, (r or {}).get('error') if isinstance(r, dict) else r))
            return ''
        saida = ''
        for b in r.get('blocos') or []:
            if not isinstance(b, dict) or not isinstance(b.get('texto'), str):
                continue
            if not b['texto'].strip():
                continue
            rotulo = str(b.get('rotulo') or 'CONTEÚDO DA EXTENSÃO').strip().upper()
            nome = str(b.get('nome') or s['nome']).strip()
            saida += '\n\n[%s — %s]\n%s' % (rotulo, nome, b['texto'].strip())
        return saida
    return ''
