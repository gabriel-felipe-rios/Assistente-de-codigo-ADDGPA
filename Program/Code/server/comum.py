"""O que os dois servidores MCP (assistente e trabalhos) compartilham.

Só duas coisas atravessam a divisão: o embrulho de erro dos handlers que
chamam método `_ferr_*`/`_trab_*` da `Api`, e a montagem da lista `TOOLS` a
partir do catálogo. Tudo o mais (`_limite`, `_cortar`, os helpers de match de
arquivo) é específico do lado Assistente — ver `assistente/ferramentas.py`.
"""


def erro_util(fn):
    """Roda `fn()` e devolve a frase do `ValueError` em vez de deixá-la escapar.

    As mensagens dos `_ferr_*`/`_trab_*` são escritas para o modelo saber o que
    fazer a seguir — "não é que o caminho não exista, ele não faz parte do que
    o usuário marcou como projeto". Deixá-las virar `Erro na ferramenta X: …`
    no `servidor.py` troca uma instrução por um rótulo.
    """
    try:
        return fn()
    except ValueError as e:
        return str(e)


def montar_tools(catalogo, namespace):
    """Monta a lista `TOOLS` a partir de um catálogo já filtrado para um servidor.

    `catalogo` é a fatia de `CATALOGO_MCP` deste servidor (filtrada pelo campo
    `servidor`). `namespace` é o `globals()` do módulo `ferramentas.py` que tem
    os handlers `tool_*`. Uma entrada cujo `fn_name` não exista aí estoura NA
    IMPORTAÇÃO, com o nome da ferramenta na mensagem — e não depois, na
    primeira chamada, com um `KeyError` mudo.
    """
    tools = []
    for f in catalogo:
        fn = namespace.get(f['fn_name'])
        if fn is None:
            raise RuntimeError(
                'A ferramenta "%s" está no catálogo (catalogo_mcp.py) mas o handler '
                '"%s" não existe.' % (f['name'], f['fn_name']))
        tools.append({'name': f['name'], 'fn': fn,
                      'description': f['description'], 'schema': f['schema'],
                      'layer': f['layer'], 'fonte': f['fonte'],
                      'retorna': f['retorna'], 'usar': f['usar'],
                      'base': f['base'], 'nao': f['nao']})
    return tools
