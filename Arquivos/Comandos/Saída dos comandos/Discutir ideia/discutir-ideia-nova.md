---
description: Abre uma discussão sobre algo que você quer acrescentar ou mudar mas ainda não sabe que forma tem — onde ficaria, como interagiria, como seria usado. Conversa com você em várias rodadas e vai registrando o que foi decidido, o que ainda falta e o que ficou proibido, numa pasta Discussão/ criada já na primeira rodada, num HTML de pauta e num HTML-resumo de uma tabela só; quando não sobrar nada em aberto, marca a discussão como «pronta para briefing» — o briefing nasce do /discutir-ideia-gerar-briefing, numa janela limpa. Use quando a dúvida sai como "eu queria que…", não como "o que é X?".
argument-hint: [o que você quer acrescentar ou mudar, do jeito que a ideia existe na sua cabeça]
---

# /discutir-ideia-nova — Discutir uma ideia antes de mandar implementar

> **A família Discutir ideia tem cinco comandos, e cada um funciona sozinho:**
>
> | Comando | Quando |
> |---|---|
> | `/discutir-ideia-nova` | a ideia ainda não tem forma; começa a discussão |
> | `/discutir-ideia-retomar` | janela nova ou `/clear` no meio da discussão; continua decidindo |
> | `/discutir-ideia-gerar-briefing` | a discussão está «pronta para briefing»; numa janela limpa, lê a discussão inteira e escreve `Briefing/` e `Obra.md` |
> | `/discutir-ideia-melhorar-briefing` | opcional; numa janela limpa, completa o briefing até dizer «nada a acrescentar» |
> | `/discutir-ideia-implementar` | existe `Obra.md`; constrói uma fase por vez, continuando sozinho da primeira que falta |

Você vai **discutir** com o usuário algo que ele quer acrescentar ou mudar, mas cuja forma ainda não existe: ele sabe o incômodo, não sabe o que seria, onde ficaria, como interagiria com o resto nem como seria usado.

**O objetivo é ele terminar sabendo exatamente o que vai ser mexido e por quê** — porque mandar implementar sem saber isso quebra as coisas. A discussão só fecha quando não sobrar ponto em aberto. E o que sai dela tem de **aguentar um `/clear`**: o briefing vai ser gerado noutra janela, e tudo o que não estiver escrito no disco se perde.

> **Regra absoluta desta fase: não se escreve código.** Nem exemplo, nem esboço, nem "olha como ficaria", nem teste. Um esboço na mesa antecipa a decisão: a conversa passa a girar em torno dele em vez do problema. Isso vale também para os HTML: neles não entra código.
>
> **Desde a rodada 1, este comando cria a pasta da discussão inteira** — `Discussão.md`, `Pauta.html`, `Resumo.html` e a pasta `Discussão/` com seus seis arquivos (Passo 2). **Este comando não gera briefing:** quando a seção `4 · Em aberto` zera, a discussão fica «pronta para briefing», e o briefing nasce do `/discutir-ideia-gerar-briefing`, numa janela limpa.

## Passo 1 — Entender o terreno antes de perguntar qualquer coisa

Chegue informado. Nunca pergunte ao usuário o que dá para descobrir lendo o projeto.

Use **o que existir** neste projeto, nesta ordem:

1. O arquivo de instruções na raiz (`CLAUDE.md`, `AGENTS.md`) — e as bases de conhecimento ou pastas que ele referenciar.
2. Servidor MCP do projeto, se houver — costuma responder sobre estrutura e relações sem precisar explorar arquivo por arquivo.
3. Onde não houver nada disso, leia o código direto: encontre os arquivos que a ideia tocaria e entenda como funcionam hoje.

**Este comando é genérico — roda em qualquer projeto.** Nunca assuma que existe mapa do projeto, pipeline, glossário, documentação ou qualquer estrutura específica. Se existir, aproveite; se não existir, siga sem — e nunca reclame da ausência.

Cada fato que você levantar agora é um ponto que não vai virar pergunta boba na rodada 4. Anote cada um com o arquivo e o trecho que o sustenta.

## Passo 2 — Criar a discussão

- Pasta de saída: `Saída dos comandos/Discussões/` na **raiz do projeto**. Crie as pastas se não existirem.
- Dentro dela, uma subpasta com o **nome do assunto** em linguagem natural (ex: `Histórico de conversas/`).
- **Antes de criar, verifique se já existe subpasta para esse mesmo assunto.** Se existir, não duplique: leia o cabeçalho do `Discussão.md` de lá e **retome** de onde parou.
- **Na rodada 1 nasce a pasta inteira** — todos os arquivos abaixo marcados «rodada 1», **mesmo vazios**. Não há limiar de tamanho: uma discussão pequena hoje é uma discussão de 100 KB em duas semanas, e ninguém volta para quebrar o arquivo depois.

```
Saída dos comandos/Discussões/{Assunto}/
├── Discussão.md        o ESTADO da conversa · cabeçalho, placar e onde está cada coisa · rodada 1
├── Obra.md             o ESTADO da obra · nasce com o gerar-briefing
├── Pauta.html          o que falta decidir e entender · reescrita e PODADA a cada rodada · rodada 1
├── Resumo.html         uma tabela só: hoje × depois × ganho · rodada 1
├── Consulta.html       o que o usuário precisa lembrar · NUNCA podado, só atualizado · nasce no 1º material de consulta
├── {Explicação}.html   rara · uma explicação grande à parte · apagada quando o usuário entender
├── Discussão/          o registro · rodada 1
│   ├── 1 · O que eu quero/Rodada N.md    o texto do usuário, cru · um arquivo por rodada
│   ├── 2 · Terreno/Rodada N.md           os fatos F do projeto, com arquivo e trecho · um por rodada
│   ├── 2 · Terreno/Arquivos que seriam mexidos.md
│   ├── 3 · Decidido.md                   D1… com o motivo
│   ├── 4 · Em aberto.md                  A1… com opções, recomendação e «Falta:»
│   ├── 5 · Proibido.md                   P1… o que não se faz, e por quê
│   └── 6 · Não entendi.md                o que o usuário disse não ter entendido
└── Briefing/           nasce com o gerar-briefing · é tudo que o implementar lê
    ├── 00 · Leia antes.md
    └── NN · {Fase}.md
```

Os nomes são fixos (sem slug, sem número) — é o que permite aos outros quatro comandos da família encontrarem tudo sem cadastro nenhum. Só `{Assunto}`, `{Fase}` e `{Explicação}` variam.

**Cada arquivo tem um papel e uma regra de ouro. Não misture:**

| Arquivo | Papel | Regra de ouro | Quem lê |
|---|---|---|---|
| `Discussão.md` | o estado da conversa e o índice | **nunca guarda conteúdo** | quem chega, antes de tudo |
| `Discussão/` | o registro completo, arquivo por seção, com os motivos | **nunca perde informação** | quem retoma e quem gera o briefing |
| `Pauta.html` | só o que falta decidir e entender, e o que a última rodada mudou | **nunca acumula** | o usuário, durante a conversa |
| `Resumo.html` | uma tabela só: hoje × depois × ganho | **nunca explica** | o usuário, dias depois |
| `Consulta.html` | o que o usuário precisa lembrar | **nunca é podado** | o usuário, quando precisa rever |
| `{Explicação}.html` | uma explicação grande à parte | **é apagada quando entendida** | o usuário, uma vez |
| `Briefing/` + `Obra.md` | a ordem de serviço e o estado da obra | **nunca discute** | quem implementa — escritos pelo gerar-briefing |

## Passo 3 — Escrever o `Discussão.md` e a pasta `Discussão/`

O `Discussão.md` **só diz o estado**: o cabeçalho fixo, a linha de placar e uma tabela «Onde está cada coisa» apontando para os arquivos de `Discussão/` e para os HTML. **Nenhum conteúdo da discussão mora nele.** O conteúdo mora na pasta `Discussão/`, um arquivo por seção — e os dois nascem na rodada 1.

### O cabeçalho fixo

```markdown
# {Assunto} — em discussão

> **Status:** em discussão. Nada implementado.
> **Última atualização:** {data} · rodada {n}
> **Placar:** {n} decididos · {n} em aberto ({n} 🔴 · {n} 🟡) · {n} proibidos
>
> **Quer implementar?** O `Obra.md`, nesta mesma pasta, diz em que fase está.
> (Enquanto ele não existir, a discussão ainda não virou obra.)
> **Quer discutir?** `Discussão/3 · Decidido.md` é o que **não se rediscute**; `Discussão/4 · Em aberto.md` é onde a conversa recomeça; `Discussão/5 · Proibido.md` é o que não se reabre por engano; `Discussão/6 · Não entendi.md` é o que ainda precisa ser explicado.
>
> ⚠️ **Números de linha aqui são datados.** Nunca edite por número: use o trecho citado
> como texto de busca. Se não encontrar o trecho, **pare e pergunte** — não adivinhe.
> ⚠️ **Nada dentro de um `<details>` é pauta ativa.** É material recolhido, guardado só
> para o raciocínio não se perder.

## Onde está cada coisa

| Arquivo | O que tem |
|---|---|
| `Discussão/1 · O que eu quero/Rodada N.md` | as palavras do usuário, cruas, uma rodada por arquivo |
| `Discussão/2 · Terreno/Rodada N.md` | os fatos F levantados no projeto, com arquivo e trecho |
| `Discussão/2 · Terreno/Arquivos que seriam mexidos.md` | os arquivos e a decisão de que cada um depende |
| `Discussão/3 · Decidido.md` | D1… com o motivo |
| `Discussão/4 · Em aberto.md` | A1… com opções, recomendação e o que falta |
| `Discussão/5 · Proibido.md` | P1… o que não se faz, e por quê |
| `Discussão/6 · Não entendi.md` | o que o usuário ainda não entendeu |
```

**A linha de placar é regravada junto com o `4 · Em aberto.md`, a cada rodada** — nunca "ajustada" à parte.

**A linha `Status:` tem quatro valores, e só estes:**

| Valor | Quem escreve |
|---|---|
| `em discussão. Nada implementado.` | este comando, na rodada 1 |
| `pronta para briefing — rode /discutir-ideia-gerar-briefing numa janela limpa` | este comando ou o retomar, quando o `4 · Em aberto.md` zera (Passo 7) |
| `fechada — obra em \`Obra.md\`` | o gerar-briefing |
| `implementada em {data}` | o implementar, ao terminar a última fase |

A linha de placar sai quando o gerar-briefing fecha — **nunca há dois placares vivos ao mesmo tempo** (o da discussão e o do `Obra.md`), porque é assim que um deles fica velho sem ninguém notar.

### Os cinco símbolos de status — fixos, não se inventa outro

`✅ decidido` · `🟡 falta decidir` · `🔴 bloqueante` · `🧊 congelado` · `❌ cancelado`

**É "falta decidir", não "falta".** A pendência de uma discussão é sempre **uma decisão do usuário**, nunca obra pendente — e é isso que o placar conta. **Só 🟡 e 🔴 contam como pendência.** Item 🧊 ou ❌ fica no arquivo como registro, mas não conta.

### Os arquivos da pasta `Discussão/`

| Arquivo | O que guarda |
|---|---|
| `1 · O que eu quero/Rodada N.md` | as palavras do usuário **cruas** — sem reescrever, sem "melhorar", sem resumir. Um arquivo por rodada; **nunca se apaga um**. |
| `2 · Terreno/Rodada N.md` | os fatos confirmados lendo o projeto, numerados F1, F2… (a numeração continua entre rodadas). Cada um com o arquivo e o trecho que o sustenta. |
| `2 · Terreno/Arquivos que seriam mexidos.md` | os arquivos que seriam criados, alterados ou deletados, com a decisão de que cada um depende — atualizado a cada rodada. |
| `3 · Decidido.md` | D1, D2…, agrupadas por `## Rodada N`, cada uma com título curto e o **motivo** — de preferência nas palavras do usuário. Decisão sem motivo não vale: três dias depois ela parece arbitrária e é revista à toa. Quando um aberto virar decisão, anote o número antigo: «D7 · … — era A2». |
| `4 · Em aberto.md` | A1, A2…, cada um **marcado com um dos cinco símbolos**, com as opções (tabela quando forem mais de duas), a sua recomendação com o porquê, e uma linha final «**Falta:** {o que exatamente falta para decidir}». O que fechou vai para um `<details>` «Recolhido» no fim, dizendo que D cada A virou. |
| `5 · Proibido.md` | cada decisão de NÃO fazer, numerada P1, P2…: «Não faça» · «Por quê» · a D de origem. Nasce na rodada 1, mesmo vazio. É daqui que sai o quadro ⛔ do briefing. |
| `6 · Não entendi.md` | cada coisa que o usuário disse não ter entendido, com a explicação curta; marcada **entendido** quando ele disser. É daqui que sai a aba «Falta entender» da pauta, e é por aqui que o retomar sabe, depois de um `/clear`, o que ainda precisa explicar. |

Por que separar decidido de aberto: é o que permite bater o olho e saber se já dá para gerar o briefing. **Enquanto o `4 · Em aberto.md` tiver item 🟡 ou 🔴, não dá.**

Por que o `5 · Proibido.md` existe desde o começo: uma decisão de "não fazer" solta no meio de dezenas de decisões de "fazer" some — e é assim que alguém a desfaz sem perceber que estava desfazendo algo.

## Passo 4 — Gerar o `Pauta.html`

O Markdown é para você lembrar; **o HTML é para o usuário entender**. Ele é reescrito por inteiro a cada rodada — é sempre a foto do estado atual.

> **A pauta PODA. Ela nunca acumula.**
> Ela é a **pauta da conversa de agora**, não o arquivo da discussão. A cada rodada, **tire dela o que já foi decidido e o que o usuário já entendeu**, e deixe só: (a) o que ainda falta decidir, com a sua recomendação; (b) o que ele ainda não entendeu; (c) o que a última rodada mudou.
> O que sai da pauta **não se perde** — está na pasta `Discussão/`. No máximo, deixe uma tabela compacta do que fechou, para quem chega novo não rediscutir.
> **Material de consulta não se poda — muda de lugar:** tabela de referência, pipeline, termo que o usuário vai querer rever vão para o `Consulta.html` (Passo 5).
> Motivo: numa discussão de dez rodadas, uma pauta que acumula tudo vira ilegível exatamente quando é mais necessária.

- **As abas, sempre nesta ordem:** Placar → O que mudou nesta rodada → Falta decidir (🔴 primeiro) → Falta entender → Já decidido (compacto). Aba sem conteúdo não aparece. Destaque visual claro para **o que ainda está pendente** — é a informação mais importante da página.
- **O que o usuário disse não ter entendido** vai para `Discussão/6 · Não entendi.md` e para a aba «Falta entender». Se ele perguntou, a resposta vira conteúdo da pauta, não só do chat. Explicação grande demais para a pauta vai para um HTML de explicação à parte (Passo 5).
- **Nunca código** — nem exemplo, nem trecho.

### As formas da pauta — obrigatórias

Uma seção nunca é só texto, e a forma não é escolha: **quando o ponto cai numa destas linhas, a forma é obrigatória** — o usuário não deveria precisar pedir o desenho.

| Quando o ponto… | a pauta mostra, obrigatoriamente |
|---|---|
| cria, move, renomeia ou apaga arquivo ou pasta | árvore **antes × depois** (novo em verde, o que sai riscado) |
| muda uma sequência — pipeline, ciclo, ordem de passos | caixas e setas, **hoje × depois** |
| tem dois ou mais caminhos | tabela de opções, com a recomendação marcada |
| descreve uma reformulação | tabela hoje × depois |
| a obra tem ordem e dependência | linha de fases |
| o placar | cartões de número |

**Padrão visual:** siga **exatamente** a seção **🎨 PADRÃO VISUAL** no fim deste arquivo.

## Passo 5 — Gerar o `Resumo.html`, o `Consulta.html` e, quando preciso, a explicação à parte

### `Resumo.html`

Uma página com **uma tabela só** — e mais nada além de um título e a data da rodada. Colunas: `O que é` · `Como está hoje` · `Como vai ficar` · `O que eu ganho` · uma coluna de chips com as decisões e os abertos ligados à linha. Uma linha por assunto da discussão.

- **Sem prosa.** A tabela explica; se precisou de parágrafo, o lugar dele é a pauta.
- Reescrito por inteiro a cada rodada, como a pauta.
- É para o usuário reler **dias depois**, sem abrir a pasta `Discussão/`: o que era, o que ficou decidido, o que ganha.
- Mesmo padrão visual da pauta (mesmos tokens, mesmo vidro), sem barra de abas — é uma seção só.

### `Consulta.html`

O terceiro HTML fixo, na raiz da discussão. **Nasce quando aparece o primeiro material que o usuário vai querer rever** — uma tabela de referência, uma pipeline que vai sendo atualizada, um termo. **Nunca é podado, só atualizado.** Guarda pouco: só o que ele precisa lembrar. Mesmo padrão visual da pauta.

### HTML de explicação

`{Assunto da explicação}.html`, na raiz da discussão — **raro**, de preferência um só, e só quando uma explicação grande incharia a pauta. **Sem pasta nova.** A pauta aponta para ele. É **apagado quando o usuário disser que entendeu**; se parte do conteúdo se mostrar útil para sempre, essa parte vai para o `Consulta.html` antes.

## Passo 6 — Conduzir a conversa

- Pergunte **as dúvidas bloqueantes primeiro**, poucas por vez. Nada de questionário de vinte itens.
- Traga sempre uma **recomendação sua** com o motivo, não só a lista de opções. O usuário está aqui porque não sabe a forma da coisa — devolver só perguntas não ajuda.
- **Leitura dinâmica das respostas:** o usuário não responde item por item. Uma fala solta dele pode resolver cinco pontos de uma vez — perceba isso pelo contexto e mova os cinco. **Nunca cobre "e o A3?" quando o A3 já foi respondido no meio de outra frase.**
- **Não decida no lugar dele.** Só quando ele disser abertamente que não quer responder aquele ponto é que você decide — e aí **a escolha vale como decisão dele**: vai para `3 · Decidido.md` como qualquer D, com o motivo «o usuário pediu para o Claude decidir» e o porquê da escolha. Sem «revisar depois», sem revisão posterior.
- **Ao final de cada resposta sua, enquanto a discussão durar, atualize:** a nova `1 · O que eu quero/Rodada N.md`, crua; `2 · Terreno/Rodada N.md`, se houve fato novo; `3 · Decidido.md`, com o motivo; `4 · Em aberto.md`; `5 · Proibido.md`; `6 · Não entendi.md`; o `Arquivos que seriam mexidos.md`; as linhas `Placar:` e `Última atualização:` do `Discussão.md`; o `Pauta.html` podado; o `Resumo.html`; e o `Consulta.html`, se houve material de consulta.
- Se você errou uma recomendação anterior e mudou de ideia, diga isso e corrija o registro. **Marque a correção como correção — não apague o erro**, senão ele volta.

### Quando o usuário mandar REMOVER um assunto

Ele vai dizer coisas como *"pode deletar esse negócio"*. Apagar tudo perde o motivo; manter tudo contraria o pedido. **Faça os três passos, sempre:**

1. **Apague o bloco grande** — é o que ele pediu.
2. **Guarde a decisão com o motivo** em `3 · Decidido.md`, marcada ❌.
3. **Escreva a proibição em `5 · Proibido.md`** — sem este passo, uma sessão futura lê o problema catalogado em `2 · Terreno/`, não vê decisão contrária por perto, e "conserta" o que foi deliberadamente descartado.

### Decisão de NÃO fazer tem endereço

Tudo que for decidido **não fazer** — porque é arriscado, porque custa caro, porque o usuário não quis — vai para `5 · Proibido.md`, com o motivo junto, na hora. Não espere o fechamento.

## Passo 7 — Quando nada ficar em aberto: «pronta para briefing»

Quando o `4 · Em aberto.md` não tiver mais nenhum item 🟡 nem 🔴 fora do `<details>`:

1. **Não gere briefing.** Escrito aqui, no fim de uma conversa longa e com a janela cheia, ele sai pequeno.
2. O `Status:` do `Discussão.md` vira `pronta para briefing — rode /discutir-ideia-gerar-briefing numa janela limpa`, e o placar mostra zero em aberto.
3. A pauta vira a foto do fechamento: o placar e o que a última rodada mudou.
4. Diga ao usuário, com todas as letras: **«A discussão está pronta. Dê `/clear` (ou abra uma janela nova) e rode `/discutir-ideia-gerar-briefing {nome da pasta}`.»** Sem esse aviso, o comando existe e ninguém sabe.

Este comando nunca cria `Briefing/` nem `Obra.md`. Quem os escreve é o `/discutir-ideia-gerar-briefing` — é lá que moram o molde do briefing e as regras de corte das fases.

---

**Ideia a discutir:** $ARGUMENTS

---

# 🎨 PADRÃO VISUAL — "Glass Dark Aurora"

> **Edite esta seção se quiser mudar o visual.** Ela é a fonte de verdade do estilo deste comando. Vale para a Pauta, o Resumo, o Consulta e a explicação à parte.

Escuro, roxo/violeta, com painéis de vidro fosco (`.glass`) sobre fundo quase-preto com aurora. Tudo inline/autocontido, sem libs/CDN, responsivo, pouco emoji.

## Tokens (copiar para `:root`)

```css
:root{
  --ink:#eef1ff; --body:#b3bad6; --muted:#7d84a8;
  --glass:rgba(255,255,255,.05); --border:rgba(255,255,255,.10);
  --brand:#8b7bff; --brand-soft:rgba(139,123,255,.16); --brand-ink:#b6acff;
  --pos:#3ee0a6; --neg:#ff6b9d;
  --radius:18px;
}
```

## Fundo do `body` (aurora sobre quase-preto)

```css
body{
  background:#080a14;
  background-image:
    radial-gradient(620px 420px at 8% 0%,rgba(139,123,255,.28),transparent 60%),
    radial-gradient(620px 420px at 92% 6%,rgba(255,107,157,.22),transparent 60%),
    radial-gradient(760px 520px at 55% 105%,rgba(62,224,166,.20),transparent 60%);
}
```

## Painel de vidro (cards, tabelas, gráficos, grafos)

```css
.glass{
  background:var(--glass); backdrop-filter:blur(14px);
  border:1px solid var(--border); border-radius:var(--radius);
  box-shadow:0 8px 30px rgba(0,0,0,.35);
}
```

## Cor com significado — pendente vs. resolvido

Neste comando as cores carregam informação. Use `--neg` (rosa) para **ponto em aberto** e `--pos` (verde) para **decidido**, sempre com o rótulo em texto junto — nunca só a cor.

```css
.chip{display:inline-block;font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:3px 9px;border-radius:99px;border:1px solid var(--border)}
.chip.open{color:var(--neg);background:rgba(255,107,157,.13);border-color:rgba(255,107,157,.3)}
.chip.done{color:var(--pos);background:rgba(62,224,166,.12);border-color:rgba(62,224,166,.3)}
```

## Recursos visuais OBRIGATÓRIOS (o usuário aprende visualmente)

Nunca só texto. Use, conforme o conteúdo: **tabelas** (ótimas para comparar opções de um ponto em aberto), **diagramas** (fluxo com caixas+setas, camadas empilhadas), **árvores de pastas** em monoespaçada, **grafos de nós** (SVG `<line>` + retângulos rotulados), além de cards, KPIs, chips e barras de progresso. Cada seção: **título claro + explicação curta + exemplo concreto**.

## Navegação: abas fixas no topo + rolagem (NUNCA "Próximo/Anterior")

Barra de abas fixa no topo, uma por seção. Conteúdo em seções altas roladas verticalmente. Aba ativa via `IntersectionObserver`. Barra de progresso fina no topo. Clique na aba dá scroll suave.

```html
<div class="topbar"><div class="inner">
  <div class="brand"><span class="mark">◆</span> NomeDoAssunto</div>
  <nav class="tabs" id="tabs">
    <button class="tab on" data-to="s1">1 · O que eu quero</button>
    <!-- uma <button class="tab" data-to="ID"> por seção -->
  </nav>
  <div class="progress" id="bar"></div>
</div></div>
<!-- cada seção: <section id="s1" data-sec> ... </section> -->
```

```js
const sections=[...document.querySelectorAll('[data-sec]')];
const tabs=[...document.querySelectorAll('.tab')];
const bar=document.getElementById('bar');
const io=new IntersectionObserver(es=>es.forEach(e=>{
  if(e.isIntersecting) tabs.forEach(t=>t.classList.toggle('on',t.dataset.to===e.target.id));
}),{rootMargin:'-45% 0px -50% 0px'});
sections.forEach(s=>io.observe(s));
tabs.forEach(t=>t.onclick=()=>document.getElementById(t.dataset.to).scrollIntoView({behavior:'smooth'}));
addEventListener('scroll',()=>{const h=document.documentElement;bar.style.width=(h.scrollTop/(h.scrollHeight-h.clientHeight)*100)+'%';},{passive:true});
```

```css
html{scroll-behavior:smooth}
h1,h2,h3{color:var(--ink);letter-spacing:-.02em;margin:0}
.topbar{position:sticky;top:0;z-index:50;background:rgba(8,10,20,.55);backdrop-filter:blur(18px);border-bottom:1px solid var(--border)}
.topbar .inner{max-width:1000px;margin:0 auto;display:flex;align-items:center;gap:18px;padding:12px 24px}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;color:var(--ink);font-size:15px}
.brand .mark{width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#8b7bff,#ff6b9d);color:#fff;display:grid;place-items:center;font-size:14px}
.tabs{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none}.tabs::-webkit-scrollbar{display:none}
.tab{border:0;background:transparent;color:var(--muted);font:inherit;font-size:13.5px;font-weight:600;padding:7px 13px;border-radius:99px;cursor:pointer;white-space:nowrap;transition:.18s}
.tab:hover{color:var(--ink);background:rgba(255,255,255,.06)}
.tab.on{color:var(--brand-ink);background:rgba(255,255,255,.10);box-shadow:inset 0 0 0 1px var(--border)}
.progress{position:absolute;left:0;bottom:-1px;height:2px;background:linear-gradient(90deg,#8b7bff,#ff6b9d);width:0;transition:width .1s linear}
main{max-width:1000px;margin:0 auto;padding:0 24px}
section{min-height:78vh;padding:56px 0;display:flex;flex-direction:column;justify-content:center}
.eyebrow{font-size:12px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--brand-ink);margin-bottom:12px}
```
