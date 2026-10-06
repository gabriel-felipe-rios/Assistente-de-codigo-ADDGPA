"""As ferramentas que se pode marcar no `tools:` de um agente.

Segue a convenção dos outros `catalogo_*.py`: a lista mora num lugar só, e quem
a mostra na tela não a redigita. A lição já custou defeito real neste projeto —
está contada em `arquivos.py::_mcp_registrar`, onde uma lista de ferramentas
literal em dois lugares fazia ferramenta SUMIR do MCP em silêncio.

⚠️ AS DUAS METADES DESTE ARQUIVO TÊM NATUREZAS DIFERENTES, e misturá-las é o
erro a evitar:

  · As de MCP são **derivadas** de `catalogo_mcp.py`, em tempo de execução.
    Ferramenta nova no servidor aparece aqui sozinha, e nunca há o que
    sincronizar.

  · As embutidas do assistente externo são **declaradas**, porque não existe
    fonte para elas dentro deste programa — nem poderia: são de um produto de
    terceiros. Isso significa que ELAS ENVELHECEM, e envelhecem em silêncio.

⚠️ POR ISSO O CAMPO LIVRE NÃO É OPCIONAL. A tela oferece as caixas E um campo
onde se digita qualquer outro nome. Se a lista declarada aqui ficar velha, o
usuário não fica preso: ele digita. Uma tela só com caixas transformaria este
arquivo desatualizado numa permissão que não dá para conceder.

⚠️ E "NENHUMA MARCADA" NÃO É "NENHUMA FERRAMENTA". Omitir `tools:` do
frontmatter faz o agente HERDAR TODAS. Quem escreve o arquivo é
`arquivos_agentes.py::_ag_montar_texto`, e ele remove a chave quando a lista sai
vazia — é lá que essa regra é aplicada; aqui ela só está registrada.
"""

from .catalogo_mcp import CATALOGO_MCP

# As chaves com que este programa registra os dois servidores no `.mcp.json`
# do projeto. São as mesmas strings de `arquivos.py::_mcp_registrar` — se
# mudar lá, muda aqui, e o teto do estrago é o prefixo errado numa sugestão de
# caixa de seleção.
NOME_SERVIDOR_ASSISTENTE = 'assistente'
NOME_SERVIDOR_TRABALHOS = 'trabalhos'


# ⚠️ LISTA DECLARADA, COPIADA DA DOCUMENTAÇÃO DO CLAUDE CODE — não é derivada de
# nada deste programa, e não há como este programa verificar se ela ainda está
# certa. Conferida em 1 de setembro de 2026, contra o Claude Code v2.1.x.
# Quem for atualizar: acrescente, não reordene — a ordem é a que a tela mostra,
# e ela agrupa por parentesco (ler, escrever, rodar, rede, fluxo).
FERRAMENTAS_DO_CLAUDE_CODE = (
    ('Read',         'Ler arquivo'),
    ('Glob',         'Achar arquivo por padrão de nome'),
    ('Grep',         'Buscar dentro dos arquivos'),
    ('Edit',         'Alterar trecho de arquivo'),
    ('Write',        'Escrever arquivo inteiro'),
    ('NotebookEdit', 'Alterar célula de notebook'),
    ('Bash',         'Rodar comando no terminal'),
    ('BashOutput',   'Ler a saída de um comando em segundo plano'),
    ('KillShell',    'Encerrar um comando em segundo plano'),
    ('WebFetch',     'Abrir uma URL'),
    ('WebSearch',    'Buscar na internet'),
    ('TodoWrite',    'Manter a lista de tarefas da sessão'),
    ('Task',         'Chamar outro subagente'),
    ('SlashCommand', 'Executar um comando de barra'),
)

# ⚠️ ASSISTENTE QUE NÃO ESTÁ AQUI RECEBE SÓ O CAMPO LIVRE, e a tela diz isso com
# palavra. Inventar uma lista para o Cursor seria pior que não ter lista: o
# usuário marcaria caixas achando que está limitando alguma coisa.
FERRAMENTAS_POR_ASSISTENTE = {
    'claude': FERRAMENTAS_DO_CLAUDE_CODE,
}


def _slug_do_assistente(nome):
    """`Claude Code` e `Claude` caem os dois em `claude`.

    A pasta do usuário se chama `Claude` e o preset se chama `Claude Code`; as
    duas falam do mesmo produto. Casar pelo primeiro pedaço é o suficiente, e o
    pior caso de errar é o assistente cair no campo livre.
    """
    bruto = (nome or '').strip().lower()
    for ch in ('/', '\\', '-', ' '):
        bruto = bruto.split(ch)[0] if ch in bruto else bruto
    return bruto


_NOME_DO_SERVIDOR = {
    'assistente': NOME_SERVIDOR_ASSISTENTE,
    'trabalhos': NOME_SERVIDOR_TRABALHOS,
}


def ferramentas_de_mcp(servidor=None):
    """As ferramentas deste programa, no formato que o `tools:` aceita.

    Derivadas, nunca digitadas — ver o ⚠️ do topo. O prefixo é o que o Claude
    Code usa para endereçar ferramenta de servidor MCP. Sem `servidor`, devolve
    as dos dois; com `servidor` ('assistente' ou 'trabalhos'), só as dele.
    """
    catalogo = CATALOGO_MCP if servidor is None else [
        f for f in CATALOGO_MCP if f['servidor'] == servidor]
    return tuple(
        ('mcp__%s__%s' % (_NOME_DO_SERVIDOR[f['servidor']], f['name']),
         (f.get('descricao') or f.get('description') or '').split('.')[0])
        for f in catalogo
    )


def ferramentas_para_a_tela(assistente=None):
    """Os dois grupos de caixas, mais o aviso quando não há lista declarada.

    Devolve sempre a mesma forma, com ou sem lista — a tela não precisa de dois
    caminhos, e o `declarada: False` é o que faz ela escrever a frase honesta.
    """
    chave = _slug_do_assistente(assistente)
    embutidas = FERRAMENTAS_POR_ASSISTENTE.get(chave)
    return {
        'declarada': embutidas is not None,
        'assistente': assistente or '',
        'grupos': [
            {'titulo': 'Do assistente',
             'itens': [{'id': i, 'rotulo': d} for i, d in (embutidas or ())]},
            {'titulo': 'Deste programa — servidor Assistente (MCP)',
             'itens': [{'id': i, 'rotulo': d}
                       for i, d in ferramentas_de_mcp('assistente')]},
            {'titulo': 'Deste programa — servidor Trabalhos (MCP)',
             'itens': [{'id': i, 'rotulo': d}
                       for i, d in ferramentas_de_mcp('trabalhos')]},
        ],
    }
