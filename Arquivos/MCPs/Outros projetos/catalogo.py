"""As ferramentas deste servidor: nome, descrição e schema. A lista, e só ela.

⛔ **NÃO IMPORTA O `catalogo_mcp.py` DO PROGRAMA.** Este arquivo é a cópia
consciente dele, e a duplicação é o preço da decisão de o servidor ser
autocontido. O que NÃO se pode fazer é apagar a diferença: veja abaixo.

── O nome é o mesmo, a descrição é que muda ──
As 19 ferramentas têm **os mesmos nomes** das do MCP Assistente. A separação é
pelo endereço: `mcp__outros-projetos__ler_arquivo` × `mcp__assistente__ler_arquivo`.

⚠️ **TODA DESCRIÇÃO COMEÇA COM "No projeto consultado, …", e isso não é
decoração.** É a descrição que o modelo lê para escolher entre duas ferramentas
de mesmo nome — o nome sozinho não desempata. Uma descrição idêntica à do
Assistente faria o modelo perguntar sobre o projeto errado, e a resposta pareceria
certa: mesmo formato, mesmo tipo de conteúdo, projeto errado.

⚠️ **TODA FERRAMENTA PEDE `projeto`, e o valor é um NOME CADASTRADO — nunca um
caminho de pasta.** É a cerca deste servidor: o caminho sai do `Workspace.json`
daquele projeto, e é isso que faz o escopo do usuário ser respeitado. Chame
`projetos` para ver os nomes liberados.

── As três que justificam este MCP existir ──
`me_usam`, `eu_uso` e `bibliotecas`. Elas dizem **o que mais tem de vir junto**
para uma peça funcionar no projeto de destino — que é a pergunta real de quem
está reaproveitando código, e a que um `grep` não responde.
"""

# ⚠️ O `projeto` é o mesmo em todas: escrito uma vez, para as vinte entradas
# não divergirem no texto. Uma delas com a redação de antes ensinaria o modelo
# a mandar caminho de pasta.
_PROJETO = {'type': 'string',
            'description': 'o NOME do projeto cadastrado a consultar (não um '
                           'caminho de pasta). Veja os nomes com a ferramenta '
                           '`projetos`.'}


def _schema(props=None, obrigatorios=()):
    campos = {'projeto': _PROJETO}
    campos.update(props or {})
    return {'type': 'object', 'properties': campos,
            'required': ['projeto'] + list(obrigatorios)}


# `fonte`: 'artefato' pode estar velho e recebe o carimbo de frescor; 'vivo'
# varre o disco na hora e NUNCA carimba.
#
# ⚠️ A classificação não é intuição. `onde_esta` é 'artefato' embora pareça
# viva — ela só ABRE o Índice de Símbolos. `io` e `arquivos_grandes` são 'vivo'
# embora pareçam artefato — as duas varrem o disco a cada chamada.
CATALOGO = [
    # ── Determinísticas: saem de índice ──────────────────────────────────────
    {'name': 'projetos', 'fn': 'tool_projetos', 'fonte': 'vivo',
     'description': 'Os projetos que você PODE consultar por este servidor — os que '
                    'o usuário marcou na configuração deste MCP. Chame esta primeiro: '
                    'todas as outras ferramentas pedem um nome desta lista.',
     'schema': {'type': 'object', 'properties': {}}},

    {'name': 'onde_esta', 'fn': 'tool_onde_esta', 'fonte': 'artefato',
     'description': 'No projeto consultado, onde um símbolo (função/classe/método/'
                    'seletor) é definido: arquivo + linha.',
     'schema': _schema({'nome': {'type': 'string', 'description': 'nome do símbolo'}},
                       ['nome'])},

    {'name': 'eu_uso', 'fn': 'tool_eu_uso', 'fonte': 'artefato',
     'description': 'No projeto consultado, quem este arquivo usa — as dependências '
                    'diretas dele, inclusive as pontes que não são import. É uma das '
                    'três que dizem O QUE MAIS TEM DE VIR JUNTO para reaproveitar '
                    'esta peça em outro projeto.',
     'schema': _schema({'arquivo': {'type': 'string'}}, ['arquivo'])},

    {'name': 'me_usam', 'fn': 'tool_me_usam', 'fonte': 'artefato',
     'description': 'No projeto consultado, quem usa este arquivo — quem quebra se '
                    'você mudar a interface dele. É uma das três que dizem O QUE MAIS '
                    'TEM DE VIR JUNTO para reaproveitar esta peça em outro projeto.',
     'schema': _schema({'arquivo': {'type': 'string'}}, ['arquivo'])},

    {'name': 'relacoes_uso', 'fn': 'tool_relacoes_uso', 'fonte': 'artefato',
     'description': 'No projeto consultado, a cascata de impacto transitiva: só o que '
                    'quebra ao mudar este arquivo.',
     'schema': _schema({'arquivo': {'type': 'string'}}, ['arquivo'])},

    {'name': 'indice_navegacao', 'fn': 'tool_indice_navegacao', 'fonte': 'artefato',
     'description': 'No projeto consultado, o mapa dele: árvore de pastas e arquivos '
                    'com uma frase por arquivo, em partes por pasta. Sem o parâmetro '
                    '"parte" devolve o índice das partes disponíveis.',
     'schema': _schema({'parte': {'type': 'string',
                                  'description': 'a parte a abrir; sem ela vem o '
                                                 'índice das partes'}})},

    {'name': 'grafo_imports', 'fn': 'tool_grafo_imports', 'fonte': 'artefato',
     'description': 'No projeto consultado, quem importa quem, em partes por pasta. '
                    'Sem o parâmetro "parte" devolve o índice das partes.',
     'schema': _schema({'parte': {'type': 'string',
                                  'description': 'a parte a abrir; sem ela vem o '
                                                 'índice das partes'}})},

    {'name': 'comentarios', 'fn': 'tool_comentarios', 'fonte': 'artefato',
     'description': 'No projeto consultado, os comentários e docstrings que O AUTOR '
                    'escreveu dentro de um arquivo, na ordem em que aparecem. É a '
                    'prosa humana do código — nunca texto gerado por IA. Para a '
                    'descrição que o modelo escreveu, a ferramenta é doc_tecnica.',
     'schema': _schema({'arquivo': {'type': 'string'}}, ['arquivo'])},

    {'name': 'bibliotecas', 'fn': 'tool_bibliotecas', 'fonte': 'artefato',
     'description': 'No projeto consultado, as bibliotecas de terceiros que ele usa; '
                    'com "nome", a ficha de uma. É uma das três que dizem O QUE MAIS '
                    'TEM DE VIR JUNTO: uma peça copiada de lá pode depender de uma '
                    'biblioteca que o projeto de destino não tem.',
     'schema': _schema({'nome': {'type': 'string',
                                 'description': 'a biblioteca a abrir; sem ela vem '
                                                'a lista'}})},

    # ── Documentação: o artefato passou por um modelo ────────────────────────
    {'name': 'doc_tecnica', 'fn': 'tool_doc_tecnica', 'fonte': 'artefato',
     'description': 'No projeto consultado, a documentação técnica de um arquivo: '
                    'símbolos com assinatura, linha e descrição.',
     'schema': _schema({'arquivo': {'type': 'string'}}, ['arquivo'])},

    {'name': 'resumo_pastas', 'fn': 'tool_resumo_pastas', 'fonte': 'artefato',
     'description': 'No projeto consultado, o que cada pasta faz — uma parte por '
                    'pasta. Sem o parâmetro "parte" devolve o índice das partes.',
     'schema': _schema({'parte': {'type': 'string',
                                  'description': 'a pasta a abrir; sem ela vem o '
                                                 'índice das partes'}})},

    {'name': 'pipeline', 'fn': 'tool_pipeline', 'fonte': 'artefato',
     'description': 'No projeto consultado, a sequência de execução dele, em partes '
                    'por cadeia. Sem o parâmetro "parte" devolve o índice das partes.',
     'schema': _schema({'parte': {'type': 'string',
                                  'description': 'a cadeia a abrir; sem ela vem o '
                                                 'índice das partes'},
                        'filtro': {'type': 'string',
                                   'description': 'opcional — recorta a parte por termo'}})},

    {'name': 'busca_semantica', 'fn': 'tool_busca_semantica', 'fonte': 'artefato',
     'description': 'No projeto consultado, acha candidatos por descrição (quando não '
                    'se sabe o nome). É um achador, não a resposta final: confirme o '
                    'candidato antes de agir. ⚠️ Aqui a busca é LITERAL sobre a '
                    'documentação gerada — a busca por embedding exige o modelo local '
                    'do programa, que este servidor não invoca.',
     'schema': _schema({'descricao': {'type': 'string'},
                        'tipo': {'type': 'string',
                                 'description': 'onde procurar: documentacao-tecnica '
                                                '(padrão), espelho ou resumo-pastas'}},
                       ['descricao'])},

    # ── Contexto ─────────────────────────────────────────────────────────────
    {'name': 'glossario', 'fn': 'tool_glossario', 'fonte': 'artefato',
     'description': 'No projeto consultado, a definição de um termo próprio dele (ou o '
                    'glossário inteiro, sem o parâmetro).',
     'schema': _schema({'termo': {'type': 'string'}})},

    # ── Análise ──────────────────────────────────────────────────────────────
    {'name': 'duplicados', 'fn': 'tool_duplicados', 'fonte': 'artefato',
     'description': 'No projeto consultado, pares de funções duplicadas ou quase '
                    'iguais — inclusive código copiado e depois editado. Comparação '
                    'determinística, sem IA.',
     'schema': _schema({'limiar': {'type': 'number',
                                   'description': 'similaridade mínima, de 0 a 1 '
                                                  '(padrão 0.85)'}})},

    {'name': 'arquivos_grandes', 'fn': 'tool_arquivos_grandes', 'fonte': 'vivo',
     'description': 'No projeto consultado, os arquivos grandes demais para caber numa '
                    'leitura só. Varre o disco na hora, então o dado nunca está velho.',
     'schema': _schema({'teto': {'type': 'number',
                                 'description': 'o teto em tokens (padrão 15000)'}})},

    {'name': 'io', 'fn': 'tool_io', 'fonte': 'vivo',
     'description': 'No projeto consultado, o que um arquivo lê e escreve em disco, '
                    'por linha. ⚠️ Aqui a extração é por expressão regular — mais '
                    'grossa que a do MCP Assistente, que usa gramática.',
     'schema': _schema({'arquivo': {'type': 'string'}}, ['arquivo'])},

    # ── Leitura crua, com o escopo do projeto consultado ─────────────────────
    # ⚠️ A descrição de cada uma PRECISA dizer que a nativa do assistente NÃO
    # serve aqui. Não é questão de velocidade, como no MCP Assistente: as
    # ferramentas nativas do assistente leem a pasta em que ele está aberto, e o
    # projeto consultado é OUTRO. Sem esta frase o modelo tenta o Read e recebe
    # "arquivo não encontrado" sobre um arquivo que existe.
    {'name': 'grep', 'fn': 'tool_grep', 'fonte': 'vivo',
     'description': 'Busca um termo NO CÓDIGO DO PROJETO CONSULTADO. A sua ferramenta '
                    'Grep não serve aqui: ela busca na pasta em que você está aberto, '
                    'e o projeto consultado é outro. Esta respeita o recorte que o '
                    'usuário fez naquele projeto. ⚠️ A busca NÃO dobra acento: '
                    '"funcao" não acha "função".',
     'schema': _schema({'termo': {'type': 'string'},
                        'pasta': {'type': 'string',
                                  'description': 'opcional — restringe a busca a esta pasta'},
                        'palavra_inteira': {'type': 'boolean',
                                            'description': 'opcional, padrão falso. Casa só a '
                                                           'palavra sozinha: "todo" deixa de '
                                                           'achar "todos" e "metodo"'},
                        'diferenciar_maiusculas': {'type': 'boolean',
                                                   'description': 'opcional, padrão falso'}},
                       ['termo'])},

    {'name': 'ler_arquivo', 'fn': 'tool_ler_arquivo', 'fonte': 'vivo',
     'description': 'Lê um arquivo DO PROJETO CONSULTADO, numerado por linha. A sua '
                    'ferramenta Read não serve aqui: ela lê a pasta em que você está '
                    'aberto, e o projeto consultado é outro. Esta recusa o que o '
                    'usuário tirou do escopo naquele projeto.',
     'schema': _schema({'caminho': {'type': 'string'},
                        'linhas': {'type': 'string',
                                   'description': 'opcional — faixa de linhas, ex.: "40-120"'}},
                       ['caminho'])},

    {'name': 'listar_pasta', 'fn': 'tool_listar_pasta', 'fonte': 'vivo',
     'description': 'Lista o que existe numa pasta DO PROJETO CONSULTADO, sem '
                    'recursão. A sua ferramenta Glob não serve aqui: ela olha a pasta '
                    'em que você está aberto, e o projeto consultado é outro. Passe '
                    '"." para ver as pastas de trabalho daquele projeto.',
     'schema': _schema({'caminho': {'type': 'string'}}, ['caminho'])},
]
