import re
import json

_FENCE_RE = re.compile(r'```[a-zA-Z]*\n?')


def extrair_json_com_chave(texto, chave):
    """Procura o primeiro objeto JSON válido contendo `chave` em qualquer lugar do texto.

    Retorna (obj, erro):
      (dict, None)  → JSON válido com a chave encontrado
      (None, None)  → sem indício de chamada ('"chave"' não aparece) → resposta normal
      (None, str)   → há indício mas nenhum JSON válido → malformado
    """
    if not texto:
        return None, None

    limpo = _FENCE_RE.sub('', texto)

    if f'"{chave}"' not in limpo:
        return None, None

    # ⚠️ O envelope de verdade é o RABO da mensagem. Esta varredura devolvia o
    # PRIMEIRO objeto que casasse, e por isso um `{"chamadas": …}` citado no meio
    # da prosa — num exemplo, num rascunho, numa explicação do que ele ia fazer —
    # vencia o envelope real, que vem no fim. O frontend documenta essa trava há
    # tempos (`_indiceDaChamada`, chat-mensagens.js); quem EXECUTA é o backend, e
    # aqui ela não existia.
    #
    # A regra é "o que termina mais tarde", e não "o último `{`": um objeto que
    # começa cedo pode envolver todos os outros e ser o envelope legítimo.
    # Nada que funcionava para de funcionar — quando há um só candidato, ele
    # continua sendo o escolhido.
    decoder = json.JSONDecoder()
    melhor, melhor_fim = None, -1
    idx = limpo.find('{')
    while idx != -1:
        try:
            obj, fim = decoder.raw_decode(limpo[idx:])
            if isinstance(obj, dict) and chave in obj and idx + fim > melhor_fim:
                melhor, melhor_fim = obj, idx + fim
        except ValueError:
            pass
        idx = limpo.find('{', idx + 1)
    if melhor is not None:
        return melhor, None

    return None, f'A resposta menciona "{chave}" mas não contém um objeto JSON válido com essa chave.'


def envelope_com_chave_errada(texto, chaves_esperadas):
    """A resposta é um JSON inteiro que errou o NOME da chave? Devolve o erro.

    ⚠️ Sem isto, uma chave escrita errado sai como RESPOSTA PRONTA, em silêncio:
    `extrair_json_com_chave` devolve `(None, None)` quando a palavra procurada
    nem aparece no texto, e `(None, None)` significa "isto é prosa, é a resposta
    ao usuário". Um `{"chamada": [...]}` — singular — não menciona "chamadas",
    então nenhuma das três sondagens acha nada, e o envelope torto é entregue
    como se fosse o que o modelo quis dizer.

    A regra é estreita de propósito: só acusa quando o texto inteiro, sem as
    cercas de código, É UM objeto JSON e nenhuma das chaves esperadas está nele.
    Prosa não passa por aqui — prosa não faz `json.loads`. Uma resposta em texto
    que só CITE um JSON também não: ali sobra texto em volta.

    Devolve `None` quando não é o caso (o caminho normal).
    """
    if not texto:
        return None
    limpo = _FENCE_RE.sub('', texto).strip()
    if not (limpo.startswith('{') and limpo.endswith('}')):
        return None
    try:
        obj = json.loads(limpo)
    except ValueError:
        return None
    if not isinstance(obj, dict) or not obj:
        return None
    if any(chave in obj for chave in chaves_esperadas):
        return None
    trouxe = ', '.join(f'"{k}"' for k in list(obj)[:5])
    esperadas = ', '.join(f'"{c}"' for c in chaves_esperadas)
    return (f'A resposta é um JSON, mas a chave de fora está errada: veio '
            f'{trouxe}, e o esperado é uma destas: {esperadas}.')


def validar_chamadas(obj, subagentes_ativos):
    """Valida o objeto {"chamadas": [...]} do chat.

    Retorna (lista, None) ou (None, descricao_erro).
    """
    chamadas = obj.get('chamadas')
    if not isinstance(chamadas, list) or not chamadas:
        return None, 'A chave "chamadas" deve ser uma lista com pelo menos um item.'
    # Import local: `subagentes_constantes` importa este módulo no topo, e o
    # número fixo do programa mora lá — importar aqui em cima seria circular.
    from .execucao.subagentes_constantes import MAX_PARALELO
    if len(chamadas) > MAX_PARALELO:
        return None, (f'Máximo de {MAX_PARALELO} chamadas por vez — você enviou '
                      f'{len(chamadas)}.')

    for i, item in enumerate(chamadas, 1):
        if not isinstance(item, dict):
            return None, f'O item {i} de "chamadas" não é um objeto.'
        # ⚠️ EXIGE as duas, e TOLERA o que vier a mais. Era igualdade exata de
        # conjuntos, e uma única chave inofensiva — um `"motivo"` que o modelo
        # resolveu acrescentar — reprovava a chamada inteira e queimava uma
        # rodada de correção para nada. Exigir é o que importa; proibir não era.
        faltando = [c for c in ('subagente', 'pergunta') if c not in item]
        if faltando:
            return None, (f'O item {i} precisa das chaves "subagente" e "pergunta" — '
                          f'faltou {", ".join(chr(34) + c + chr(34) for c in faltando)}.')
        if not isinstance(item['subagente'], str) or not isinstance(item['pergunta'], str):
            return None, f'No item {i}, "subagente" e "pergunta" devem ser strings.'
        if item['subagente'] not in subagentes_ativos:
            return None, (f'Subagente inválido no item {i}: "{item["subagente"]}". '
                          f'Válidos: {", ".join(subagentes_ativos)}.')
        if not item['pergunta'].strip():
            return None, f'No item {i}, "pergunta" está vazia.'

    return chamadas, None


MAX_FERRAMENTAS_RODADA_PADRAO = 4


def validar_ferramentas(obj, ferramentas_validas, maximo=None):
    """Valida o objeto {"ferramentas": [...]} de um subagente.

    Retorna (lista, None) ou (None, descricao_erro).

    `maximo` vem da aba Configuração. Era o literal 4, aqui e em mais oito
    arquivos de prompt-correção — nove lugares para o mesmo número, e nenhum
    deles visível. Junto com as rodadas de ferramentas, é ele que define o teto
    real de leituras por chamada de subagente: ferramentas por rodada ×
    rodadas por chamada.
    """
    maximo = int(maximo or MAX_FERRAMENTAS_RODADA_PADRAO)
    ferramentas = obj.get('ferramentas')
    if not isinstance(ferramentas, list) or not ferramentas:
        return None, 'A chave "ferramentas" deve ser uma lista com pelo menos um item.'
    if len(ferramentas) > maximo:
        return None, (f'Máximo de {maximo} ferramentas por rodada — '
                      f'você enviou {len(ferramentas)}.')

    for i, item in enumerate(ferramentas, 1):
        if not isinstance(item, dict):
            return None, f'O item {i} de "ferramentas" não é um objeto.'
        # Mesma tolerância de `validar_chamadas`, e pelo mesmo motivo.
        faltando = [c for c in ('nome', 'parametros') if c not in item]
        if faltando:
            return None, (f'O item {i} precisa das chaves "nome" e "parametros" — '
                          f'faltou {", ".join(chr(34) + c + chr(34) for c in faltando)}.')
        if not isinstance(item['nome'], str):
            return None, f'No item {i}, "nome" deve ser uma string.'
        if not isinstance(item['parametros'], dict):
            return None, f'No item {i}, "parametros" deve ser um objeto (use {{}} se não houver parâmetros).'
        if item['nome'] not in ferramentas_validas:
            return None, (f'Ferramenta inválida no item {i}: "{item["nome"]}". '
                          f'Válidas: {", ".join(ferramentas_validas)}.')

    return ferramentas, None


def validar_relatorio(obj):
    """Valida o objeto {"relatorio": {...}} do agente principal da Fila.

    Retorna (relatorio, None) ou (None, descricao_erro).

    A validação é dura em "arquivos" e frouxa no resto de propósito: é a
    lista de arquivos que vira a tabela do relatório final, e é dela que sai
    o que o Verificador confere. Prosa mal escrita é chata; tabela sem
    caminho é um relatório que não serve para nada.
    """
    rel = obj.get('relatorio')
    if not isinstance(rel, dict):
        return None, 'A chave "relatorio" deve ser um objeto.'

    arquivos = rel.get('arquivos')
    if not isinstance(arquivos, list) or not arquivos:
        return None, ('A chave "arquivos" deve ser uma lista com pelo menos um item — '
                      'um relatório sem nenhum arquivo a mexer não é um relatório.')

    for i, item in enumerate(arquivos, 1):
        if not isinstance(item, dict):
            return None, f'O item {i} de "arquivos" não é um objeto.'
        if not isinstance(item.get('arquivo'), str) or not item['arquivo'].strip():
            return None, f'No item {i} de "arquivos", "arquivo" está vazio ou não é uma string.'
        if not isinstance(item.get('mudanca'), str) or not item['mudanca'].strip():
            return None, f'No item {i} de "arquivos", "mudanca" está vazia ou não é uma string.'

    restricoes = rel.get('restricoes')
    if restricoes is None:
        restricoes = []
    if not isinstance(restricoes, list):
        return None, 'A chave "restricoes" deve ser uma lista (use [] se não houver nenhuma).'
    for i, item in enumerate(restricoes, 1):
        if not isinstance(item, dict):
            return None, f'O item {i} de "restricoes" não é um objeto.'

    return {
        'resumo': str(rel.get('resumo') or '').strip(),
        'arquivos': [{'arquivo': str(a.get('arquivo') or '').strip(),
                      'linha': str(a.get('linha') or '').strip(),
                      'mudanca': str(a.get('mudanca') or '').strip(),
                      'evidencia': str(a.get('evidencia') or '').strip()}
                     for a in arquivos],
        'restricoes': [{'decisao': str(r.get('decisao') or '').strip(),
                        'fonte': str(r.get('fonte') or '').strip(),
                        'implicacao': str(r.get('implicacao') or '').strip()}
                       for r in restricoes],
        'observacoes': str(rel.get('observacoes') or '').strip(),
    }, None


def validar_veredito(obj, tipos_validos):
    """Valida o objeto {"aprovado": ...} do Verificador.

    Retorna (veredito, None) ou (None, descricao_erro). Problema com "tipo"
    fora da lista é descartado em silêncio, não vira erro de formato: o
    veredito continua valendo, e só aquele item deixa de gerar sub-tag.
    """
    if 'aprovado' not in obj:
        return None, 'A resposta deve conter a chave "aprovado".'
    if not isinstance(obj['aprovado'], bool):
        return None, '"aprovado" deve ser exatamente true ou false, sem aspas.'
    motivo = obj.get('motivo')
    if not isinstance(motivo, str) or not motivo.strip():
        return None, 'A chave "motivo" é obrigatória e deve ser uma string não vazia.'

    problemas = []
    for item in (obj.get('problemas') or []):
        if not isinstance(item, dict):
            continue
        if item.get('tipo') not in tipos_validos:
            continue
        try:
            numero = int(item.get('item'))
        except (TypeError, ValueError):
            continue
        problemas.append({'item': numero, 'tipo': item['tipo'],
                          'detalhe': str(item.get('detalhe') or '').strip()})

    conferidos = []
    for n in (obj.get('conferidos') or []):
        try:
            conferidos.append(int(n))
        except (TypeError, ValueError):
            continue

    return {'aprovado': obj['aprovado'], 'motivo': motivo.strip(),
            'problemas': problemas, 'conferidos': sorted(set(conferidos))}, None
