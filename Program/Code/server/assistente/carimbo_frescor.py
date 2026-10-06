"""O carimbo de frescor: uma linha avisando que a resposta pode estar velha.

**Não é ferramenta.** É uma linha acrescentada ao fim da resposta de algumas
ferramentas do servidor Assistente — as que leem um ARTEFATO que uma rotina
gerou antes (`fonte: 'artefato'` no catálogo). As que varrem o disco na hora
(`fonte: 'vivo'`) nunca carimbam: o dado delas não tem como estar velho. Por
isso o servidor Trabalhos (as 8 ferramentas do Quadro, todas `fonte: 'vivo'`)
não importa este módulo.

⚠️ **Fala só quando NÃO está em dia.** Silêncio é o normal, e significa "em
dia". Um aviso em toda resposta viraria ruído que o modelo aprende a ignorar em
três chamadas — que é exatamente o oposto do que este carimbo existe para
fazer.

Dois estados, e só:

    atualizando    uma rotina está rodando ou na fila do ciclo AGORA
    desatualizado  arquivo mudou desde a última passada, ou o ciclo parou no
                   meio, ou o projeto nunca foi indexado

⚠️ **`baseline: False` significa "processar tudo", e não "nada mudou".** Está
escrito no docstring de `get_arquivos_mudados`, e é a armadilha silenciosa
desta parte: lido como "nada mudou", o carimbo diria "em dia" sobre um projeto
que nunca rodou rotina nenhuma — o caso em que o aviso mais importa.

⚠️ **Não confundir os dois "Pendências".** A aba Pendências (`processando.py`)
mostra o que roda agora; o `Pendências.json` (`rotinas_pendencias.py`) é a fila
do ciclo. A colisão de termo é conhecida e aceita no projeto — não "consertar".
"""

import time

# Segundos que o resultado vale dentro deste processo. `get_arquivos_mudados`
# chama `_hs_scan`, que VARRE O DISCO inteiro; sem cache, uma sessão que use
# quinze ferramentas pagaria quinze varreduras.
#
# ⚠️ O número é curto de propósito, e não é arbitrário: o ciclo de acionamentos
# leva de dezenas de segundos a minutos, então nada que aconteça dentro de uma
# janela de 15 segundos mudaria a resposta. O carimbo continua honesto.
_VALIDADE_SEGUNDOS = 15

# {project_name: (instante, texto_do_carimbo)}
_CACHE = {}


def _calcular(api, project_name):
    """O texto do carimbo, ou `''` quando está tudo em dia."""
    # 1. Rodando agora? É a resposta mais útil das duas — se uma rotina está no
    # ar, "desatualizado" é verdade mas o usuário não tem nada a fazer.
    try:
        proc = api.get_processando(project_name)
        if proc.get('success'):
            rodando = proc.get('processando') or []
            esperando = proc.get('esperando') or []
            if rodando or esperando:
                quantas = len(rodando) + len(esperando)
                return ('[atualizando] O programa está reindexando este projeto agora '
                        '(%d rotina%s). O que você acabou de ler pode mudar em instantes.'
                        % (quantas, 's' if quantas != 1 else ''))
    except Exception:
        # Carimbo que estoura não pode derrubar a ferramenta: o valor dele é
        # marginal, e o da resposta não.
        pass

    # 2. Ciclo parou no meio?
    try:
        pend = api.get_rotinas_pendencias(project_name)
        if pend.get('success') and pend.get('tem_pendencia'):
            return ('[desatualizado] O último ciclo de rotinas parou antes de terminar '
                    '(%d pendente%s). Parte da documentação deste projeto é de antes '
                    'da última mudança.'
                    % (pend.get('quantos', 0), 's' if pend.get('quantos', 0) != 1 else ''))
    except Exception:
        pass

    # 3. Arquivo mudou desde a última passada?
    try:
        mud = api.get_arquivos_mudados(project_name)
        if mud.get('success'):
            # ⚠️ AQUI. `baseline: False` = nunca houve linha de base, ou seja
            # "tudo por processar" — e `mudados` vem VAZIO nesse caso. Ler o
            # `mudados` vazio como "nada mudou" faria o carimbo silenciar
            # justamente no projeto que nunca foi indexado.
            if not mud.get('baseline'):
                return ('[desatualizado] Este projeto ainda não tem linha de base de '
                        'hashes: nenhuma rotina rodou nele. O que existir de '
                        'documentação pode estar incompleto ou ausente.')
            quantos = len(mud.get('mudados') or []) + len(mud.get('removidos') or [])
            if quantos:
                return ('[desatualizado] %d arquivo%s desde a última passada das '
                        'rotinas. A documentação deste projeto pode não refletir o '
                        'código atual — confira no próprio arquivo antes de decidir.'
                        % (quantos, 's mudaram' if quantos != 1 else ' mudou'))
    except Exception:
        pass

    return ''


def carimbo(api, project_name):
    """O carimbo, com cache curto. `''` quando está em dia."""
    agora = time.monotonic()
    guardado = _CACHE.get(project_name)
    if guardado and (agora - guardado[0]) < _VALIDADE_SEGUNDOS:
        return guardado[1]
    texto = _calcular(api, project_name)
    _CACHE[project_name] = (agora, texto)
    return texto


def aplicar(api, project_name, texto, carimba):
    """Devolve a resposta com o carimbo colado no fim, se houver o que avisar.

    `carimba` vem do campo `fonte` do catálogo: `True` para `'artefato'`,
    `False` para `'vivo'`. A decisão não é tomada aqui de propósito — está no
    catálogo, ferramenta por ferramenta, onde dá para conferir a lista inteira
    de uma vez.
    """
    if not carimba or not texto:
        return texto
    aviso = carimbo(api, project_name)
    if not aviso:
        return texto
    return '%s\n\n%s' % (texto, aviso)
