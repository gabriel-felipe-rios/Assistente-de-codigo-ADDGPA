# Outros projetos

Servidor MCP que responde, sobre **outro projeto cadastrado** no Assistente de
Código, as mesmas perguntas que o MCP **Assistente** responde sobre o projeto em
que você está: onde está a função, quem a usa, de que ela depende, o que o autor
escreveu ali e o código em si.

É o **caminho inverso** do "ir até o projeto antigo, empacotar a peça e trazer o
pacote": aqui você fica onde está e o assistente pergunta.

> **Ligar copia esta pasta** para dentro do projeto (por padrão em `MCPs/`) e
> escreve o apontador no arquivo de registro do assistente externo. As
> ferramentas aparecem numa sessão **nova** — reabrir a mesma sessão não
> reconecta. **Desligar tira o apontador e apaga a cópia**; se ela tiver sido
> editada, o programa pergunta antes.

## Só projeto cadastrado, e só o que você marcar

A fonte é sempre um **nome de projeto cadastrado**, nunca um caminho de pasta que
o modelo invente — o caminho sai do `Workspace.json` daquele projeto, e é isso
que faz o servidor respeitar o recorte que você fez lá: as pastas de trabalho, a
lista **Remover** e o **Contexto sem leitura**.

Na aba **Arquivos → MCPs → "Outros projetos"**, dentro do projeto onde ele está
ligado, você marca **quais projetos podem ser consultados**. A escolha vale só
naquele projeto: no projeto B você marca uns, no C outros.

⚠️ **Nada marcado libera nada** — e é o padrão certo. Liberar tudo por omissão
daria ao assistente externo acesso a projetos que você nunca pensou em abrir.

Projeto que existe mas não foi marcado é **recusado com essa palavra**, nunca com
"não encontrado": a diferença importa, porque "não encontrado" faria o assistente
concluir que o projeto não existe e desistir, em vez de pedir a liberação.

## As três que justificam este MCP existir

`me_usam`, `eu_uso` e `bibliotecas`. Elas respondem à pergunta real de quem está
reaproveitando código — **o que mais tem de vir junto** para a peça funcionar no
projeto de destino. Um `grep` não responde isso: as duas primeiras casam menção
de identificador (função global chamada de outro arquivo, ponte entre o back e o
front, ID declarado no HTML e lido no JS), e a terceira diz de que bibliotecas de
terceiros aquela peça depende.

## Ele é autocontido, e isso tem preço

⛔ **Este servidor não importa uma linha do programa** — nem `api.py`, nem
`modulos/`, nem `caminhos.py`. Ele lê os **arquivos** que o programa gerou, com
código próprio. O motivo: ele é um item da biblioteca, copiado para dentro do seu
projeto, e o projeto vai para o Git. Importar o programa faria dele um terceiro
servidor do programa — exatamente o que ele não é.

Três consequências, todas conhecidas e aceitas:

**1 · O ponto de envelhecimento.** A tabela que traduz *id da rotina → nome da
pasta* é uma **cópia** da tabela do programa (`caminhos.py`). Quando um nome de
pasta mudar lá, este servidor **para de achar aquele artefato sem dar erro** — só
responde "não gerado". Se uma ferramenta começar a dizer que a rotina nunca rodou
num projeto que você sabe que está indexado, é aqui que se olha:
`leitura.py::PASTAS_DAS_ROTINAS`.

**2 · `busca_semantica` faz busca literal.** A busca por sentido exige gerar o
vetor da pergunta no modelo local que o programa hospeda, e este servidor não
invoca o programa. Ela casa o texto como você escreveu. "Nada encontrado" aqui
não quer dizer "não existe" — quer dizer "não casou a palavra".

**3 · `io` extrai por expressão regular.** O MCP Assistente usa gramática
(tree-sitter) e acerta qual argumento é o caminho; aqui o alvo vem marcado como
**aproximado**, porque em `open(f, 'r', encoding='utf-8')` o regex captura `'r'`.
A chamada, que é a informação boa, vem sempre.

E uma que não é preço, é limite dos dois: **nenhum dos motores descobre o caminho
real no disco**. Ele não está no código — é montado quando o programa roda.

## Artefato não gerado não é erro

Se a rotina que produz um artefato ainda não rodou no projeto consultado, a
resposta diz isso **e diz qual rotina o gera**, para você mandar rodá-la na aba
Automação → Rotinas daquele projeto. Uma resposta seca faria o assistente
desistir da linha de investigação achando que o projeto está vazio.

Quando a documentação do projeto consultado estiver atrasada — o ciclo parou no
meio, ou nenhuma rotina rodou lá —, as ferramentas que leem artefato carregam uma
linha avisando. Silêncio significa em dia.

## Se ele parar de responder

O servidor lê o campo `pasta_do_programa` do próprio `mcp.json` para saber onde o
Assistente de Código está instalado. Esse campo é preenchido **na cópia**, quando
você liga o MCP. Se você mover a pasta do programa depois disso, todas as
ferramentas devolvem uma mensagem dizendo qual era o caminho antigo e mandando
**desligar e religar** este MCP na aba Arquivos → MCPs.

## Nenhuma ferramenta escreve

As vinte só leem: artefatos que as rotinas geraram, o `Workspace.json` do projeto
consultado e os arquivos de código dele. Nenhuma cria, altera ou apaga nada.

## Desinstalar

Apagar `Arquivos/MCPs/Outros projetos/` tira o item da biblioteca. As cópias que
já foram feitas dentro de projetos continuam funcionando até você desligá-lo em
cada um — o apontador guarda o caminho da cópia, não o do molde.
