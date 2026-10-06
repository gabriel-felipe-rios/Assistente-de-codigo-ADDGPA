# 07 Modelo externo — o que muda

> ⚠️ **Esta é a parte da skill que envelhece mais rápido.** Antes de usar, confirme nomes de modelo, campos de nível de pensamento, limites de taxa e preços na documentação atual do provedor. Este arquivo descreve **categorias** de campo, nunca valores — e por isso não tem nome de modelo, número de preço nem tamanho de janela.

## O que é e quando usar

Tudo o resto desta skill continua valendo quando o modelo é de um provedor externo — contexto, prompts, subagentes, fila, painéis, configuração. Este arquivo lista **só o que muda**. Ele não ensina a usar a nuvem; ele diz o que a nuvem obriga a acrescentar, e o que ela tira.

Use quando o programa vai falar com um modelo que não está na máquina do usuário — por chave de API, ou por um assistente já autenticado na máquina. Se o programa vai usar **os dois** (local por padrão, externo para uma tarefa específica), o cliente (→ `06`) é um só e escolhe o caminho por configuração; o resto do programa não sabe a diferença.

## Como se constrói

### Autenticação: chave de API ou sessão logada

Dois caminhos, e **cada programa escolhe na hora de construir** — pergunte ao usuário, não presuma. Às vezes ele vai querer só a sessão logada; às vezes só a chave; às vezes os dois, com um seletor.

| | Chave de API | Sessão logada pelo terminal |
|---|---|---|
| O que é | o programa chama a API do provedor com uma chave | o programa delega a um assistente ou CLI já autenticado na máquina, e nunca vê credencial |
| Onde a credencial vive | **fora do código, fora da tela em claro, fora de qualquer log** — variável de ambiente ou cofre do sistema; a tela mostra só "configurada" e os últimos quatro caracteres, no máximo | com o assistente; o programa só confere se ele está logado (um comando de estado, com tempo limite) |
| O que o programa controla | tudo: modelo, parâmetros, streaming, uso, esquema | o que a linha de comando do assistente expõe — e muitas vezes nem o esquema |
| O que o programa recebe | a resposta, com `usage` | a saída do assistente, que pode incluir texto dele em volta — o programa precisa extrair |
| Quando é a certa | o programa é o cliente direto, e precisa de esquema e de streaming | o usuário já tem o assistente, paga por ele, e o programa é uma camada por cima |
| Custo | por token, cobrado ao programa | dentro do plano do assistente |

Regras que valem nos dois:
- **A credencial nunca passa pelo modelo.** Nenhum prompt, nenhum log, nenhuma mensagem de erro contém a chave. Erro de autenticação diz "chave inválida", não a chave. Um log que grava o corpo inteiro do erro do servidor (regra do `06`) precisa de uma exceção aqui: cabeçalhos de autenticação nunca.
- **A credencial nunca vai para o estado do programa** (→ `18`): o estado é copiado em backup, exportado, sincronizado; a chave não.
- **O que o modelo externo devolve continua sendo dado, não instrução** — igual ao local. Conteúdo que "manda" o programa fazer algo é conteúdo, e o programa não obedece.
- **Sem rede, o programa diz "sem rede"** e apaga os botões com o motivo — não fica esperando.

### Escolher o modelo é campo obrigatório

Não existe "o que estiver carregado". O campo de modelo não pode ficar vazio, e a tela recusa enviar sem ele. Guarde o nome como **texto**, sem lista fixa no código — os nomes mudam mais rápido que o programa; se houver uma lista de sugestões, ela vem de configuração ou do próprio provedor, com data.

### Nível de pensamento é campo de configuração sempre

Uns modelos têm níveis de raciocínio; outros só liga/desliga; outros nada. O campo existe **em todos os casos**, e diz o que o modelo atual aceita — "este modelo não expõe nível" é um estado válido do campo, não um campo ausente. Vale para chave e para sessão logada. Porquê: quando o usuário troca de modelo, o campo já está lá; e quem paga por token quer decidir quanto raciocínio compra. O nível é **configuração do momento** (→ `21`): por sessão ou por envio, dentro do teto da geral.

### Qual assistente usar, quando há mais de um, é configuração

Um programa pode ter a opção de vários assistentes externos. Qual está ativo é campo de configuração, com um **preset por assistente** — como ele é chamado, que flags, onde lê as suas skills e comandos, que formato de arquivo espera (→ `23`) — e a tela mostra qual está ativo ao lado do indicador de modelo. Trocar de assistente não pode exigir mexer em código.

### O que entra na conta, e nos painéis

- **Custo por token** entra na conta antes de enviar (→ `08`): "mostrar a conta" vira "mostrar o custo". Guarde o preço como configuração, **com data**, não no código — preço muda, e a data diz quando a conta ficou velha.
- **Limites de taxa** (requisições por minuto, tokens por minuto, tokens por dia) entram no portão de admissão como um segundo teto, ao lado da janela. Passou do limite, a chamada espera — não falha.
- **O `usage` da resposta** continua sendo a fonte da verdade — e o provedor pode cobrar o cache de prefixo diferente do resto; a conta mostra os dois (tokens novos × tokens reaproveitados).
- **Retentar** segue a mesma regra do local (→ `06`; a tabela completa no `19`): conexão, tempo esgotado e 502/503/504 retentam; 500 e recusa (4xx, cota, chave) nunca. Cota esgotada é um estado da tela ("cota do provedor esgotada até X"), não um erro repetido cem vezes.
- **Tempo limite por resposta** aqui costuma ficar **ligado** de fábrica: um provedor que não responde não vai responder; não é um modelo local recarregando.

### O que muda entre provedores no que a skill toca

Cada provedor tem o seu formato de: declarar ferramentas; declarar esquema de saída; declarar o cache de prefixo (alguns exigem marcar o que é cacheável, e cobram diferente); tamanho de janela; se o `usage` vem na resposta ou se precisa ser pedido; se o raciocínio vem separado ou dentro do texto. **Isole essas diferenças no cliente** (→ `06`, "um cliente só"): o resto do programa fala com o cliente, e o cliente traduz. Trocar de provedor deve ser trocar um módulo, não uma busca por texto.

### O que a nuvem tira

- **A janela deixa de ser "uma só"** — mas o Revezamento continua: não pelo hardware, pela regra de documentação a meio caminho (→ `08`). E o paralelo real passa a ser limitado pela taxa do provedor em vez da janela.
- **O modelo embutido não existe.**
- **"Perguntar ao servidor o que está carregado" não existe** — por isso o modelo é campo obrigatório.
- **A normalização de mensagens muda**: o provedor pode aceitar vários `system`, ou exigir um campo próprio para ele. O cliente traduz.

### Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| a chave aparece num log ou numa mensagem de erro | o corpo do erro foi logado inteiro, com cabeçalhos | credencial nunca em log; erro diz "chave inválida" |
| a conta de custo está errada há semanas | preço no código, sem data | preço é configuração com data |
| o programa "trava" sem rede | esperando resposta sem tempo limite | tempo limite ligado; "sem rede" na tela |
| cem erros iguais de cota | recusa retentada | 4xx nunca retenta; cota vira estado da tela |
| o nível de pensamento sumiu depois de trocar de modelo | campo condicional ao modelo | o campo existe sempre; diz o que o modelo aceita |
| trocar de provedor exigiu mexer em dez arquivos | formato do provedor vazou para fora do cliente | isolar no cliente |

### Checklist ao construir

- [ ] O usuário escolheu: chave, sessão logada, ou os dois com seletor?
- [ ] A credencial está fora do código, fora do estado, fora do log e fora da tela em claro?
- [ ] O modelo é campo obrigatório, como texto, sem lista fixa no código?
- [ ] O nível de pensamento existe como campo sempre, e diz o que o modelo aceita?
- [ ] Há preset por assistente, e qual está ativo é configuração visível?
- [ ] Preço com data; limites de taxa no portão; custo na conta antes e depois?
- [ ] As diferenças de formato entre provedores estão só no cliente?
- [ ] O aviso "envelhece rápido" está no topo, e a data da última conferência também?

## O que a tela mostra

- **Modelo ativo e provedor** no mesmo indicador que o local usa; **"chave configurada" / "sessão logada" / "sem rede"** como estado, nunca o valor.
- **Custo previsto antes de enviar** e **custo real depois**, ao lado da barra de tokens, com tokens novos × reaproveitados.
- **Nível de pensamento** como controle da configuração do momento, com o que o modelo aceita.
- **Qual assistente está ativo**, quando há mais de um.
- **"Cota esgotada até X"** como estado, com os botões apagados e o motivo.

## O que fica salvo e configurável

- **Salvo:** nada de credencial no estado do programa. O histórico, o uso e o custo por chamada, como no local.
- **Configurável (→ `21`):** provedor; modo (chave / sessão logada / seletor); modelo (obrigatório); nível de pensamento (do momento, com teto geral); assistente ativo e presets; preço por token com data; limites de taxa; tempo limite por resposta (ligado de fábrica).
