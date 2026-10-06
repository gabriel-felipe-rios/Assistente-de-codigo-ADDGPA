# 23 Agente externo — ferramentas, skills, comandos e MCP

## O que é e quando usar

Três situações em que o modelo **não está dentro do programa** — está num assistente de fora (um agente de código no terminal, por exemplo), e o programa conversa com ele:

1. **O programa oferece ferramentas ao assistente** — o programa é um servidor de ferramentas (MCP, *Model Context Protocol*), e o assistente chama para ler o que o programa calculou.
2. **O programa monta o prompt e o assistente executa** — o programa prepara um texto (um relatório, um contexto, um comando) e o entrega ao assistente, que faz o trabalho.
3. **O programa instala skills, comandos e servidores MCP para o assistente** — e para isso precisa saber **onde** cada assistente os lê, com que nome e formato.

Use quando o usuário já tem um assistente e o programa é uma camada por cima dele. As regras das outras peças continuam valendo — o modelo de fora também não é fonte de fato, e o que ele devolve é dado, não instrução.

## Como se constrói

### 1 · O programa como servidor de ferramentas

- **Catálogo único com metadados.** Cada ferramenta com nome, descrição (o que faz, quando usar, o que devolve, e **se escreve**), esquema dos argumentos, e a que servidor pertence. Um programa expõe dois servidores — um sobre o código, outro sobre o quadro de trabalhos — do mesmo catálogo, filtrado por servidor. Um só catálogo, dois filtros.
- **A descrição é escrita para o modelo, não para o programador.** É o único texto que o assistente lê antes de decidir chamar: diz o que a ferramenta faz, quando é a certa, e o que **não** é ("é um achador, não a resposta final"). Descrição vaga é ferramenta que o assistente chama errado ou nunca chama.
- **Handlers validados na partida.** Uma ferramenta do catálogo sem função que a implemente **não sobe**: o servidor falha ao iniciar com o nome dela. Porquê: descobrir a ferramenta quebrada quando o assistente a chama é descobrir tarde e fora da tela.
- **Erro convertido em texto que o modelo entende.** Uma exceção de validação vira uma frase legível — "o parâmetro `ler` precisa dizer a seção: `sintese`, `simbolos` ou `tudo`" — não um stack trace. O assistente lê a frase e corrige a chamada. Erro que o modelo não entende é erro que ele repete.
- **Artefato grande servido em partes nomeadas.** Uma resposta que não cabe numa chamada (um mapa de 30 mil tokens) é dividida por fronteira natural, e a chamada **sem** o parâmetro `parte` devolve o índice das partes com o tamanho de cada uma — o assistente escolhe uma em vez de puxar tudo. As partes são nomeadas pela fronteira (a pasta, a cadeia), não numeradas.
- **Tetos configuráveis** por ferramenta: itens, tokens, profundidade — para o assistente não derrubar o programa com uma listagem recursiva. E um fundo de poço para recursão em pasta com link circular.
- **A resposta avisa quando o artefato está velho.** As ferramentas que leem algo gerado por uma rotina anterior sabem a data; quando o código mudou depois, a **última linha** da resposta diz isso. Silêncio significa em dia. As que varrem o disco na hora nunca avisam, porque nunca estão velhas. O assistente que lê a skill do programa sabe distinguir os dois tipos.
- **Respeitar o recorte do usuário**: o que ele tirou do escopo do projeto, o servidor recusa com o motivo — não é ausência, é recusa. E as ferramentas de leitura do servidor existem **ao lado** das nativas do assistente, justamente para respeitar o recorte: as nativas são mais rápidas; as do servidor recusam o que está fora.
- **Ferramentas que casam menção de identificador (quem usa X) leem outra base que as de import**, e a skill do programa diz isso: renomear uma função global chamada de outro arquivo não gera erro nenhum, e a tela só fica vazia — é onde mora o perigo real, e uma ferramenta que só lê imports não enxerga.
- **Uma fila alimentada por um agente de fora.** O sentido inverso: o assistente **enfileira** trabalho por MCP (perguntas, tarefas), e o programa consome a fila no ritmo dele. Um programa de conhecimento deixa um assistente externo alimentar a prova assim: a ferramenta grava na fila; o ciclo do programa consome o próximo item quando chega a vez.
- **Sete das oito ferramentas de um servidor podem escrever** no estado que o usuário vê na tela — e aí cada uma diz isso na descrição ("escreve"), porque uma chamada errada muda o que o usuário está olhando. O servidor de leitura e o de escrita são dois, com nomes que dizem qual é qual.
- **Log do servidor de ferramentas: recomendação, não regra.** Quando o programa expõe ferramentas a assistentes de fora, guardar quem chamou o quê, com que argumentos, quanto devolveu e quanto demorou (→ `22`) ajuda a entender o que o assistente fez — **decida por programa**. A prova do que o assistente fez de fato não depende desse log: vem de um registro de fora da conversa (seção 2).

### 2 · O programa monta o prompt; o assistente executa

- **Stack trace → prompt determinístico.** O programa lê a saída de um erro, localiza os arquivos e linhas no índice, e monta um prompt com o trecho de cada um — sempre da mesma forma. O assistente recebe o problema já situado, e o usuário vê o prompt antes de mandar.
- **Relatório de inspeção.** O programa captura um elemento de interface, encontra os candidatos no código e gera um relatório de contexto (código, estilos, relações) para o assistente; um fluxo gravado de cliques vira um relatório passo a passo, com a teia de código de cada passo.
- **Envelope de contexto.** Um botão "copiar contexto" que monta um texto com cabeçalho descritivo e separadores por caminho — o mesmo formato sempre, para o assistente reconhecer. É a exportação pequena (→ `18`).
- **Lançar o assistente num terminal com prompt dinâmico.** O programa constrói a linha de comando (o assistente, os flags, o nome da sessão), valida o arquivo de prompt, grava o prompt e injeta quando o terminal fica em silêncio — e **confere o que o assistente fez pelo log no disco, nunca pela palavra dele**: um arquivo de registro que o próprio ambiente escreve (que arquivo foi tocado, quando) é a fonte; a resposta do assistente é conversa. É a regra "o modelo nunca é fonte de fato" aplicada ao modelo de fora. O registro é **zerado a cada execução** — senão "os arquivos tocados" desta vez incluem os da anterior.
- **Verificação determinística de conflito**: dois assistentes lançados em paralelo tocando o mesmo arquivo é conflito detectado pelo log do disco, não perguntado a nenhum dos dois.
- **Presets por assistente**: como se lança, que flags, que formato de prompt — e qual está ativo é configuração (→ `07`). Um "lançamento rápido" aplica um preset nomeado de uma vez.

### 3 · Onde cada assistente lê skills, comandos e servidores MCP

**Regra geral:** a pasta de origem no programa é **organização**, não destino — o usuário guarda os arquivos dele numa biblioteca (por tema, por assistente, como quiser), e **o destino é decidido por assistente**, por um preset (pasta, nome, formato de cabeçalho). Uma pasta com pelo menos um arquivo solto é um **item** e é copiada inteira, subpastas junto; uma pasta sem arquivo solto é um **grupo**, e o programa desce nela. Não há exigência de extensão nem de nome combinado — qualquer arquivo já basta para ser item, e é isso que dispensa o programa de conhecer o formato de cada categoria.

> ⚠️ **Conferido em 21/09/2026.** Esta tabela envelhece mais rápido que o resto da skill — pastas e formatos mudam a cada versão dos assistentes. **Antes de implementar, confirme na documentação atual de cada um** e atualize a data desta linha.

| Assistente | Skills | Comandos | Servidores MCP | Instruções base | Agentes |
|---|---|---|---|---|---|
| **Claude Code** | pasta por skill com `SKILL.md` (cabeçalho YAML `name` + `description` e instruções em Markdown; arquivos de apoio ao lado, lidos sob demanda — só nome e descrição ficam sempre carregados) em `.claude/skills/` (projeto) ou `~/.claude/skills/` (pessoal) | `.claude/commands/*.md`, **soltos** — subpasta não é descoberta (não vira grupo: simplesmente não aparece); formato mais antigo, para coisa nova prefira skill | `.mcp.json` na raiz (projeto); `~/.claude.json` (pessoal) | `CLAUDE.md` na raiz | `.claude/agents/*.md`, soltos |
| **Cursor** | `.cursor/skills/<nome>/SKILL.md` (desde a versão 2.4) | `.cursor/commands/`, soltos | `.cursor/mcp.json` | `AGENTS.md` na raiz | `.cursor/agents/<nome>.md` (desde a versão 2.4) |
| **Codex** | `.agents/skills/<nome>/SKILL.md` (projeto) ou `~/.agents/skills/` (pessoal) | `.agents/workflows/`, soltos | em **TOML**, no `~/.codex/config.toml` — um programa que registra MCP em JSON deixa este destino **vazio**: um JSON com esse nome seria um arquivo que o Codex não lê | `AGENTS.md` (global e por repositório; o específico sobrescreve o geral) | — não conferido |
| **OpenCode** | `.opencode/skills/<nome>/SKILL.md` | `.opencode/commands/`, **em pasta** — é o único que transforma subpasta em grupo (`/equipe/revisar`); achatar para soltos quebra a organização que ele espera | — não conferido | `AGENTS.md` na raiz | — não conferido |
| **Gemini CLI** | `.gemini/skills/<nome>/SKILL.md` | — não conferido | — não conferido | `AGENTS.md` na raiz | — não conferido |

Regras de instalação que valem para todos:
- **O formato do cabeçalho muda entre assistentes** (YAML com `name`/`description`, TOML com `prompt`, Markdown puro). O preset traduz; o arquivo de origem do usuário fica como ele escreveu.
- **A subpasta da biblioteca não decide o destino.** Um programa organizava agentes em "Agentes/Claude/…" e o usuário achava que isso mandava para a pasta do Claude — não mandava; quem decide é o preset. A subpasta é gaveta temática, e a tela pergunta ao assistente ativo quais caixas mostrar.
- **Instalar é copiar, e desinstalar é apagar o que se copiou** — inclusive o que uma versão antiga do instalador deixou no lugar errado, senão o comando some da tela e continua aparecendo para o assistente.
- **Skill grande com pastas internas** é copiada inteira; o assistente lê caminhos relativos ao `SKILL.md`. A descrição no cabeçalho é o gatilho — é o único texto sempre carregado; o corpo só entra quando dispara.
- **Um servidor MCP registrado precisa de um nome único** por assistente; renomear o servidor exige migrar a configuração antiga (um programa renomeou o seu e migra a chave na leitura do workspace).
- **A cópia não leva lixo**: caches, pastas de dependência, pastas de controle de versão ficam de fora, por lista.
- **Destino que não foi conferido fica vazio**, e a tela diz "não conferido". Um destino de fábrica errado falha na hora de instalar ou de abrir o terminal, sem o usuário saber que o erro veio do programa — o vazio é mais honesto.
- **Soltos × em pasta é por assistente e por categoria** (a tabela acima), e o preset diz qual. **Os nomes são normalizados só no destino**; a origem fica como o usuário escreveu. **Um só caminho de cópia** para todos os assistentes: o preset muda o destino, não o código.
- **Uma skill tem um arquivo principal só.** Quando a pasta tem vários `.md`, uma regra fixa escolhe qual vira o `SKILL.md` — o de nome igual ao da pasta, ou o único com `description:` —, e empate é recusado com aviso, não resolvido no escuro.
- **A cópia perde o que o copiador não entende.** Um copiador que lê o cabeçalho linha a linha, como `chave: valor`, descarta uma `description` de várias linhas (`description: >`) — e a skill é instalada sem gatilho. Leia o cabeçalho com um leitor de YAML de verdade; e **para conferir uma skill ou um prompt, leia a fonte, não a cópia instalada**.
- **Servidor MCP de terceiro:** versão fixa (nunca "a mais recente"), segredo como variável de ambiente (`${VAR}`) e nunca escrito no arquivo, e o comando conferido no PATH antes de registrar. E **um prompt para uma IA de fora fabricar um item no formato do programa** leva o contrato do formato e termina mandando **perguntar antes de escrever**.

### 4 · Assistentes rodando em terminais, e um acionando o outro

- **Processo de agente pago só começa com gesto humano, e sempre tem fim.** Em alguns sistemas o processo filho não morre com o pai: fechar a janela do programa deixava cada assistente vivo indefinidamente, consumindo cota paga. Ao sair, feche a árvore de processos inteira.
- **Prompt para uma ferramenta de linha de comando vai em arquivo, e o que ela lê de fato é medido.** Num programa, o caminho do arquivo foi para a opção de texto, e o assistente "recebia a string do caminho como se fosse a instrução — parecendo funcionar". A linha de comando tem teto (cerca de 32 mil caracteres em alguns sistemas); o cabeçalho de um agente chegava, e o corpo com as regras não. E **nome de agente inexistente mata o terminal**: confira no disco antes de lançar.
- **Nunca mande ao agente caminho de arquivo que não existe ou está vazio, nem uma seção "nenhum".** Ele gasta uma ferramenta para descobrir que não há nada lá — e às vezes conclui que ele é que errou o caminho.
- **O canal de dados entre agentes é sobrescrito, não acumulado**, medido pela janela de quem lê, e corta pelo começo: o que interessa é o fim.
- **Dependência entre agentes é "entregou", não "não está rodando".** Um agente que caiu não está rodando e também não entregou. Ciclo de dependência é recusado na criação; a espera **morre com o programa** (não dispara sozinha na próxima abertura); e, em disparos simultâneos, **retira da fila antes de decidir**, para dois não pegarem o mesmo.
- **Todo laço em que um agente aciona o outro tem teto** — a mensagem do usuário zera; no teto, os dois lados recebem o motivo (→ `02`).
- **Escalar ao humano é uma ferramenta que exige motivo.** Chamar o usuário para cada decisão pequena é tão ruim quanto não chamar. Pedido vago é devolvido, não interpretado.
- **O system vai uma vez por sessão** (→ `11`); **cada arquivo tem um único escritor**, e o agente é avisado de que editar um arquivo gerado some (→ `18`); **a configuração de permissão falha para o lado fechado** (→ `21`).
- **Contexto entregue a uma IA de fora vai em dois níveis, com aviso de corte obrigatório:** o resumo e o detalhe, e o que foi cortado é dito — sem o aviso, o relatório mente por omissão. **A confiança sai de fontes independentes concordando** (o índice e a busca apontando o mesmo arquivo), não de uma fonte repetida.

### Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| o assistente chama uma ferramenta e recebe um stack trace | erro não convertido | frase legível, com o que fazer |
| o servidor sobe e uma ferramenta "não existe" | handler ausente descoberto na chamada | validar na partida |
| o assistente puxa 30 mil tokens de uma vez | artefato sem partes | índice de partes sem `parte` |
| o assistente age sobre documentação velha sem saber | resposta sem idade | última linha avisa |
| o assistente repete a mesma chamada errada | erro que ele não entende | erro escrito para o modelo |
| o programa acredita que o assistente editou o arquivo | conferindo pela resposta | conferir pelo log do disco |
| a skill foi para a pasta errada | subpasta lida como destino | preset por assistente |
| o comando sumiu da tela e continua no assistente | desinstalar não apagou o antigo | apagar o que se copiou, inclusive o de versão antiga |
| duas ferramentas com o mesmo nome em servidores diferentes | catálogo sem filtro | um catálogo, filtro por servidor |
| a tabela de pastas está errada | envelheceu | conferir e datar antes de implementar |
| o assistente continua vivo depois de fechar o programa | processo filho não morre com o pai | fechar a árvore de processos |
| o assistente recebe o caminho do prompt como instrução | o que a linha de comando lê não foi medido | prompt em arquivo; medir o que chega |
| a skill instalou sem gatilho | copiador descartou a `description` de várias linhas | leitor de YAML de verdade; conferir a fonte |
| o assistente espera um outro que caiu, para sempre | dependência = "não está rodando" | dependência = "entregou" |

### Checklist ao construir

- [ ] Um catálogo com descrição escrita para o modelo, incluindo "escreve" onde escreve, filtrado por servidor?
- [ ] Handlers validados na partida; erros convertidos em frases; tetos por ferramenta?
- [ ] Artefatos grandes em partes nomeadas, com índice sem `parte`; a resposta avisa a idade?
- [ ] O servidor respeita o recorte do usuário, e está decidido se ele tem log próprio?
- [ ] O prompt montado pelo programa é determinístico e visível antes de mandar?
- [ ] O que o assistente fez é conferido pelo log do disco, com detecção de conflito?
- [ ] Há preset por assistente, e o destino da instalação vem do preset, não da subpasta?
- [ ] Desinstalar apaga o que foi copiado, inclusive de versões antigas?
- [ ] A tabela de pastas foi conferida hoje, e a data está escrita?
- [ ] Destino não conferido fica vazio, com "não conferido" na tela?
- [ ] Todo processo de agente pago começa por gesto humano e tem fim, inclusive ao fechar o programa?
- [ ] O prompt vai em arquivo, e o que o assistente lê de fato foi medido?
- [ ] Dependência entre agentes é "entregou", e todo laço entre eles tem teto?

## O que a tela mostra

- **A biblioteca** de skills, comandos e servidores MCP do usuário, por categoria, com **ativar / desativar por assistente** e o destino que cada um vai receber.
- **Qual assistente está ativo**, e o preset dele; "lançamento rápido" com os presets nomeados.
- **O estado do servidor MCP do programa**: subiu, quantas ferramentas, tetos; e, se houver, o log das chamadas que recebeu (quem chamou o quê, quanto devolveu).
- **A fila alimentada de fora**, com o que chegou e o que já foi consumido.
- **O terminal** onde o assistente foi lançado, com o prompt injetado visível e o registro de verificação ao lado; o conflito de arquivo, quando houver, com os dois lados.
- **O prompt montado** (stack trace, inspeção, contexto) antes de copiar ou mandar.

## O que fica salvo e configurável

- **Salvo (→ `18`):** a biblioteca do usuário (a origem); o que está ativado em qual assistente; a fila de fora; o log do servidor MCP, se houver; os presets.
- **Configurável (→ `21`):** os presets por assistente (pasta, formato, linha de comando, flags); quais ferramentas o servidor expõe e com que tetos; o assistente ativo; a lista de exclusão da cópia.
