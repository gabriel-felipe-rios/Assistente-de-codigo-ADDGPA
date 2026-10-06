# 21 Configuração

## O que é e quando usar

O que o usuário pode mudar sem mexer no código — e **onde** cada coisa mora. Todo programa com LLM tem mais campos do que parece (modelo, janela, tetos, tempos, ferramentas por subagente, extensões), e a diferença entre um painel utilizável e uma lista de cinquenta campos é ter **categorias**, **busca** e a distinção entre o que é **geral** e o que é **do momento**.

E é a peça em que os erros mais silenciosos moram: um booleano que religa sozinho, uma chave renomeada que ninguém migrou, um teto lido como promessa. Nenhum deles dá erro; todos mudam o comportamento do programa sem o usuário saber.

## Como se constrói

### Dois níveis

| | Configuração geral | Configuração do momento |
|---|---|---|
| Onde | o painel de configurações | na própria tela da peça: um checkbox, um seletor ao lado do botão de enviar |
| Vale para | o programa (ou o projeto) inteiro | esta sessão, esta tarefa, este envio |
| Exemplos | modelo, janela, tetos, tempos, ferramentas por subagente, extensões, tempos da Espera | quais subagentes ligados nesta sessão; qual prompt fixo; o modelo deste envio; o nível de pensamento; o paralelo deste lote |
| Quem vence | é o teto | vence dentro do teto — a sessão pode ligar menos subagentes que a geral permite, nunca mais |
| Quando é lida | ao salvar, e **ao chegar a vez** de rodar — não ao entrar na fila | ao iniciar a sessão ou o envio, e trava (→ `11`) |

Regra: **a do momento fica salva com a sessão** (→ `18`) **e trava quando a sessão começa**; a geral muda quando o usuário quiser, e vale para a próxima sessão — e para o ciclo que estava esperando a vez (entre entrar na fila e chegar a vez, o usuário pode ter desligado rotinas, e vale o que está gravado agora).

### O painel

- **Categorias que cada módulo registra.** A casca do painel é uma; cada área do programa registra a sua categoria (nome, ícone, uma frase de resumo, e a função que desenha os campos). Porquê: com um painel monolítico, toda peça nova mexe no mesmo arquivo, e ele vira o maior do programa. A ordem das categorias é configurável e a visibilidade de cada uma depende do contexto (sem projeto aberto, as de projeto somem).
- **Busca que rola até o campo.** O usuário digita "paralelo" e o painel abre a categoria certa e rola até o campo, com destaque. Cinquenta campos sem busca é cinquenta campos que ninguém acha.
- **Cada campo tem uma frase de ajuda** ao lado — o que ele limita e o que acontece se passar. E o campo que é teto diz que é teto.
- **Valores de fábrica num arquivo só.** A tela nunca inventa um padrão; ela lê o de fábrica e mostra o que o usuário mudou. O campo "modelo" de fábrica é **vazio**, de propósito, para não sobrescrever a escolha feita no servidor.
- **Salvar por categoria, com validação**: limites em token dentro da janela; teto de rodadas maior que zero; tempos não negativos; lista de extensões sem duplicata. Valor inválido não grava e diz por quê, no campo.
- **"Modificado" ao lado do que difere do de fábrica** — o usuário precisa saber o que mexeu. **Restaurar é por categoria, com confirmação que lista o que vai mudar**, e devolve o estado gravado depois — a tela relê do disco, não supõe. Um clique sem pergunta já custou vinte valores calibrados. A repintura depois de restaurar é isolada por passo: um passo que falha não deixa os outros sem pintar.
- **Um dado, um lugar.** A tabela de ferramentas por subagente é a mesma que o painel de subagentes mostra; a lista de extensões é a mesma que a ingestão usa; a lista de ignorados de fábrica aparece marcada e não se apaga. Duas cópias divergem.

### O que tem que ser configurável

| Campo | Onde vive | O que limita / o que é |
|---|---|---|
| endereço do servidor · **modo do modelo** (o carregado · escolher · carregar pelo programa) · modelo (vazio = o carregado) · janela (só leitura, do servidor) e a de reserva · **parâmetros de geração, com a chave "quem manda: o programa ou o servidor"** (vazio = o do servidor) · pensamento por área, só para modelo que pensa · pasta dos pesos (embutido) | Modelo | → `06` |
| provedor · chave ou sessão logada · modelo (obrigatório) · **nível de pensamento** · **qual assistente** · preço com data · limites de taxa | Modelo externo | → `07`; o nível de pensamento existe sempre, e diz o que o modelo aceita |
| **os dois relógios** — sem sinal de vida (renova) e duração total (interrompe; a fila não tem) · desistir de esperar sem sinal de vida · esperas e número de retentativas de conexão · teto de espera de disco · N de falhas até pausar | Tempos e ciclos | → `06`, `14`, `19` |
| limites de contexto **em % da janela** — entrada, saída, margem, por etapa · teto de saída proporcional · teto de itens de lista · teto de atenção · piso · **máximo em paralelo, exato e global** | Modelo e contexto | → `08`; ao lado do paralelo: "teto — o real depende da janela e da trava" |
| políticas de saída: Formato garantido · Resgate da resposta · N de correções — **o único campo que custa chamada, e diz isso** | Modelo e contexto | → `10` |
| dividir ligado ou desligado · o máximo, mesmo dividindo · itens por parte | Dividir e costurar | → `09` |
| ferramentas por papel · rodadas e ferramentas por rodada · tetos de leitura por consumidor · tetos de busca · teto de resposta do subagente | Ferramentas | → `04` |
| teto do laço entre agentes | Agentes | → `02` |
| ferramentas permitidas por subagente · teto de rodadas · teto de voltas · teto do Verificador · teto de rodadas só-erro · tetos por ferramenta | Subagentes | → `03`; a tabela é a mesma que o painel de subagentes mostra |
| tempos da Espera por grupo · piso para retentar · quais rotinas ligadas | Automação | → `14` |
| teto de devoluções · prompts fixos da fila | Fila | → `13` |
| N de tentativas por papel · leituras independentes · itens por leva · limiar de certeza | Ciclos | → `15` |
| similaridade e tentativas da geração · K em paralelo · teto de itens por ficha | Geração em lote | → `01` |
| tetos do servidor de ferramentas · quais ferramentas expostas · presets por assistente · assistente ativo | Agente externo | → `23` |
| modelo de embedding · tamanho do pedaço · limiares · reconhecimento e classificação, com fallback | Modelos complementares | → `17` |
| extensões reconhecidas · pastas, arquivos e extensões ignorados, com permissão de leitura · limites de bytes e de linha · conversores · se o modelo tem visão | Ingestão | → `16` |
| prompts fixos do chat · regra de corte do título | Chat | → `12` |
| pasta raiz dos dados · rotação do histórico · quantos resolvidos mostrar · pasta de exportação · pasta da IA · exclusões do backup | Estado | → `18` |
| intervalo de consulta · linhas de log · quais tipos de evento por padrão · qualidade dos mapas · tema · ícones · ordem das abas | Interface | → `20`, `22` |

### Valor exato × % da janela

- **% da janela para o que depende do modelo:** tetos de entrada, de saída e margem acompanham qualquer modelo carregado; o número em tokens é derivado na hora, nunca gravado (→ `08`).
- **Valor exato para o que é da máquina, ou foi medido sobre o conteúdo:** quantos pedidos em paralelo (a máquina aguenta N, qualquer que seja o modelo); tetos por ferramenta (medidos sobre os arquivos: "97 % cabem em 10 000 tokens"); tamanho do pedaço de embedding (medido: 512 tokens em 166 ms; 8 192 em 17 s).
- **Ao lado de cada %, o equivalente em tokens** para o modelo carregado agora, e a conta da folga, que fica vermelha em "Não cabe". Sem tokenizador, a prévia diz "±10 %".
- **A janela é campo só de leitura**, lido do servidor, com o motivo escrito ("vem do modelo carregado").

### Cada campo com a falha que o fez campo

O painel de um programa, para calibrar o seu — cada campo existe porque, sem ele, algo deu errado:

- janela, só leitura, com a de reserva para quando o servidor está fora;
- tetos de entrada, saída e margem em % da janela (45 / 17 / 20);
- paralelo **global, não por projeto** (4, até 8) — "paralelo demais degrada em vez de acelerar";
- **o máximo que a tela aceita é o que o código faz:** a tela deixava escolher 8 subagentes em paralelo, e o código fazia `mínimo(x, 4)` em silêncio;
- rodadas e ferramentas por rodada, com teto próprio para quem confere;
- tentativas de correção, **marcadas como o único campo que custa chamada**;
- formato garantido e resgate, cada interruptor com "Afeta / Não afeta" escrito ao lado;
- a chave "quem manda nos parâmetros de geração: o programa ou o servidor"; o pensamento por área;
- os dois relógios — sem sinal de vida (renova) × duração total (interrompe) —, com a frase "não é o mesmo relógio";
- a espera por grupo de custo (10 / 30 / 90 s);
- as travas contra repetição; dividir e costurar; as réguas de "vale chamar de novo?";
- pedaço e profundidade com valores medidos;
- tetos de leitura **por consumidor** (modelo local × assistente de fora), cercados por medição.

E como o painel apresenta: **exemplo vivo com a mesma conta do backend**; **uma tabela "onde cada limite vale"** — nasceu porque quem aumentava o teto de saída esperando mudança no chat não via nada, porque aquele teto era de outra etapa; **campo que não desliga aparece apagado, com o motivo**; e **a tela diz o passado do campo** quando ele mudou de sentido ("era 200 caracteres; agora é em tokens").

### O que fica fora da configuração, de propósito

- **Retentar item** — nunca vai existir: é uma chamada a mais (→ `19`).
- **A janela no Restaurar** — é leitura da máquina, não preferência.
- **Chave para as rotinas da base** — rodam sempre.
- **Religar sozinho ao abrir** — quem religa é o usuário.
- **Tempo limite da fila** — a pesquisa demora o que precisar; o freio é o contador.
- **Modelo por tarefa** — um botão manual rodava com modelo diferente do ciclo.
- **Paralelo por projeto** — a janela é uma só.

Regra: **o campo que não existe de propósito é registrado com o motivo**, para ninguém "consertar" a falta.

### Os cuidados de gravação

- **Booleano com ramo próprio no save.** Um programa gravava todos os campos como `max(1, int(valor))` — e `int(False)` é 0, `max(1, 0)` é 1: o interruptor desligado religava sozinho. Booleano não passa pela conta dos números. Idem para texto vazio ("modelo vazio = o carregado" não pode virar "0").
- **Salvar por patch parcial sobre o disco, nunca pela foto inteira da tela.** A tela manda só os campos que mudaram, e o backend aplica sobre o que está gravado. Com a foto inteira, trocar o tema **revertia**, em silêncio, a mudança que outra categoria tinha gravado um segundo antes — e o defeito voltou duas vezes.
- **Converter chave a chave**, cada uma no seu `try`. Um valor inválido dentro de um `try` único jogava fora todos os outros; e ler número de um checkbox dá `NaN` e trava o Salvar da categoria inteira.
- **Três naturezas de campo:** **preferência** (o usuário escolhe; o Restaurar devolve o de fábrica), **leitura da máquina** (a janela, o modelo carregado: só leitura; o Restaurar não toca) e **uso** (histórico, métricas: fora do Restaurar).
- **Configuração em arquivos por categoria**, com o mapa derivado da mesma tabela que o Restaurar usa. Ao mover um campo de arquivo, **grava no novo antes de tirar do velho**. O leitor **nunca levanta** — vários processos leem, e um que quebra derruba os outros —, e o aviso de "mudou" só sai se mudou, fora da trava.
- **Configuração de permissão falha para o lado fechado.** Ilegível, cai no padrão — e o padrão é o mais preso: o pior caso de um arquivo corrompido é o agente ficar mais preso, nunca mais solto. Chave desconhecida é recusada, não ignorada.
- **Limites em token, nunca em caractere** — e a tela diz "tokens" no rótulo.
- **O valor da tela é teto, não promessa** — e a tela diz isso nos campos em que é verdade (paralelo, tetos de rodada).
- **Chave renomeada tem migração** (→ `18`): a leitura converte o nome antigo; sem isso, todo projeto existente amanhece com o freio desligado e sem aviso. E um nome antigo que ficou no código por custo (o backend diz "espera", a tela diz "Revezamento") é registrado como tal, para ninguém "consertar".
- **Mudança que exige reinício diz que exige** — e o que pode ser aplicado na hora é aplicado na hora (tema, ícones, intervalo do poll).
- **Configuração do projeto e do programa são dois arquivos**, e a do projeto migra formatos antigos ao abrir (inclusive renomear um servidor que mudou de nome).
- **O painel de subagentes é configuração, não só visualização:** quantos existem, o fluxo entre eles, as ferramentas de cada um — a mesma tabela que a tela mostra é a que o usuário edita (→ `20`).
- **Presets** para o que se repete: um conjunto nomeado de escolhas (quais assistentes, quais rotinas, quais subagentes) que o usuário aplica de uma vez, com um "lançamento rápido"; os presets são validados antes de gravar.
- **Configuração que o modelo lê** (o teto de rodadas entra no system) muda o prefixo quando muda — é aceito, mas o campo diz "muda o contexto das próximas sessões".

### Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| o interruptor desligado religa sozinho | booleano na conta dos números | ramo próprio |
| o projeto antigo abre com o freio desligado | chave renomeada sem migração | migração na leitura |
| o usuário configurou 4 em paralelo e rodam 2 | teto lido como promessa | a tela diz "teto" |
| a tela de subagentes e a configuração discordam | duas tabelas | um dado, um lugar |
| o ciclo rodou com rotinas que o usuário tinha desligado | configuração lida ao entrar na fila | ler ao chegar a vez |
| ninguém acha o campo | painel sem busca | busca que rola até o campo |
| o painel é o maior arquivo do programa | monolítico | categorias registradas por módulo |
| o modelo de fábrica sobrescreveu a escolha do servidor | fábrica não vazia | modelo de fábrica vazio |
| o usuário não sabe o que mexeu | sem marca de modificado | "modificado" + restaurar por categoria, com confirmação |
| trocar o tema desfez outra configuração | salvar a foto inteira da tela | patch parcial sobre o disco |
| um valor inválido apagou todos os outros da categoria | conversão num `try` só | chave a chave |
| a tela deixa escolher 8 e rodam 4 | máximo da tela ≠ trava do código | o máximo da tela é o do código |
| o teto em tokens valia para o modelo de ontem | número em tokens gravado | % da janela, derivado na hora |

### Checklist ao construir

- [ ] Há dois níveis — geral e do momento — com a regra de qual vence, e a do momento trava com a sessão?
- [ ] A geral é lida ao chegar a vez, não ao entrar na fila?
- [ ] O painel tem categorias registradas por módulo, busca que rola até o campo, ajuda por campo, "modificado" e "restaurar" por categoria com confirmação?
- [ ] Os valores de fábrica estão num arquivo só, com o modelo vazio?
- [ ] Todo campo é validado ao salvar, com o motivo no campo; booleano e texto vazio têm ramo próprio?
- [ ] Limites em token; tetos dizem que são tetos?
- [ ] Toda chave renomeada tem migração, e o que ficou com nome antigo no código está registrado?
- [ ] A tabela de subagentes é uma só entre painel e configuração?
- [ ] Todos os campos da tabela "o que tem que ser configurável" que a peça usa existem?
- [ ] Cada teto está em % se depende do modelo, e exato se é da máquina ou medido — com o equivalente em tokens ao lado?
- [ ] Salvar é por patch parcial, convertendo chave a chave, e as três naturezas de campo estão separadas?
- [ ] O que fica fora de propósito está registrado com o motivo, e a permissão falha para o lado fechado?

## O que a tela mostra

- **O painel**, com categorias na lateral, busca no topo, e uma frase de ajuda por campo.
- **"Modificado"** ao lado do que difere do de fábrica, e **"Restaurar" por categoria**, com a confirmação que lista o que vai mudar.
- **Ao lado de cada %, o equivalente em tokens**, e a conta da folga em vermelho quando não cabe.
- **Validação inline**: o campo inválido fica marcado, com o motivo, e o salvar fica apagado.
- **"Exige reinício"** onde for o caso.
- **Na tela da peça**, a configuração do momento com a frase "trava depois da primeira mensagem" onde for o caso.

## O que fica salvo e configurável

- **Salvo (→ `18`):** a configuração geral do programa; a do projeto (workspace); a do momento, dentro de cada sessão; os presets. Cada uma com versão e migração.
- **Configurável:** esta peça é a das configurações — e a lista acima é o mínimo, não o máximo.
