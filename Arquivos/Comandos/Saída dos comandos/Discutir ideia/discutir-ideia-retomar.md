---
description: Voltar a CONVERSAR sobre uma discussão já aberta com /discutir-ideia-nova — continuar decidindo o que ainda está em aberto. Lista as discussões existentes com o estado de cada uma (em discussão / pronta para briefing / pronta para implementar / em obra / implementada) lendo só o cabeçalho de cada uma, e retoma de onde parou. Não gera briefing: quando nada fica em aberto, marca «pronta para briefing» e aponta o /discutir-ideia-gerar-briefing. Use numa janela nova ou depois de um /clear, quando o contexto da conversa anterior se perdeu. Não escreve código: para CONSTRUIR o que já foi decidido, o comando é /discutir-ideia-implementar.
argument-hint: (não recebe argumento — ele lista as discussões e pergunta qual continuar)
---

# /discutir-ideia-retomar — Voltar a uma discussão já aberta

> **A família Discutir ideia tem cinco comandos, e cada um funciona sozinho:**
>
> | Comando | Quando |
> |---|---|
> | `/discutir-ideia-nova` | a ideia ainda não tem forma; começa a discussão |
> | `/discutir-ideia-retomar` | janela nova ou `/clear` no meio da discussão; continua decidindo |
> | `/discutir-ideia-gerar-briefing` | a discussão está «pronta para briefing»; numa janela limpa, lê a discussão inteira e escreve `Briefing/` e `Obra.md` |
> | `/discutir-ideia-melhorar-briefing` | opcional; numa janela limpa, completa o briefing até dizer «nada a acrescentar» |
> | `/discutir-ideia-implementar` | existe `Obra.md`; constrói uma fase por vez, continuando sozinho da primeira que falta |

Uma discussão aberta vale enquanto durar a janela de contexto. Fechou a janela ou deu `/clear`, o contexto se perde — mas os arquivos continuam no disco. **Este comando é a ponte de volta.**

Na mesma janela, com a conversa em andamento, você não precisa dele: basta falar. Ele existe para o caso em que o assistente não sabe que existe discussão aberta — e em que o usuário também não lembra o nome exato da subpasta.

> **Regra absoluta: não se escreve código.** Este comando lê, reabre e atualiza os arquivos da discussão — nada mais. Nem nos HTML entra código.
>
> **Ele não gera briefing.** Quando o `4 · Em aberto.md` zera, marca a discussão como «pronta para briefing» e aponta o `/discutir-ideia-gerar-briefing` (Passo 5). Arquivo novo, só os da discussão: a `Rodada N.md` de cada rodada, o `Consulta.html` quando surgir material de consulta, e um HTML de explicação quando for preciso.
>
> **Se a intenção for construir o que já foi decidido, este comando é o errado** — é o `/discutir-ideia-implementar`.

## Os arquivos que ele lê

```
Saída dos comandos/Discussões/{Assunto}/
├── Discussão.md        ← Passo 1 lê SÓ as linhas Status e Placar · é o índice
├── Obra.md             ← não abre · só olha se existe e o estado das fases (Passo 2)
├── Pauta.html · Resumo.html · Consulta.html   ← regenerados por este comando
├── Discussão/          ← Passo 3 lê a última rodada, 4, 5 e 6 · o resto sob demanda
│   ├── 1 · O que eu quero/Rodada N.md
│   ├── 2 · Terreno/Rodada N.md · Arquivos que seriam mexidos.md
│   ├── 3 · Decidido.md
│   ├── 4 · Em aberto.md
│   ├── 5 · Proibido.md
│   └── 6 · Não entendi.md
└── Briefing/           ← este comando NÃO abre
```

## Passo 1 — Listar, lendo SÓ o cabeçalho

Procure por `Saída dos comandos/Discussões/*/Discussão.md` na raiz do projeto.

Se não houver nenhuma, diga isso e aponte o `/discutir-ideia-nova` para começar uma. Fim.

> **Leia APENAS o cabeçalho de cada `Discussão.md`** — as linhas `Status:` e `Placar:`. Não abra a pasta `Discussão/` para montar a lista: numa discussão grande, o registro completo é justamente o que não cabe.
>
> **Item 🧊 congelado ou ❌ cancelado não é pendência.**

## Passo 2 — Mostrar a lista com o estado de cada uma

O **estado** vale mais que o número, porque "zero pontos" sozinho é ambíguo — pode ser fechada, pode ser abandonada:

| Estado | Como detectar | Comando |
|---|---|---|
| **em discussão** | `Status:` «em discussão» | este — continue |
| **pronta para briefing** | `Status:` «pronta para briefing» | `/discutir-ideia-gerar-briefing` |
| **pronta para implementar** | existe `Obra.md` sem nenhuma fase ✅ | `/discutir-ideia-implementar` (ou, antes, o `/discutir-ideia-melhorar-briefing`) |
| **em obra** | `Obra.md` com fases ✅ e ⬜ misturadas | `/discutir-ideia-implementar` |
| **implementada** | `Status:` «implementada em {data}» | — |

Monte a tabela no chat:

| Discussão | Estado | Em aberto | Última atualização |
|---|---|---|---|
| {nome da subpasta} | {estado} | {n} pontos | {data do cabeçalho} |

Ordene pela que tem mais pontos em aberto primeiro. **Em toda linha que não seja *em discussão*, diga o comando da coluna ao lado.** Ela não precisa de mais conversa.

Pergunte qual continuar.

## Passo 3 — Voltar ao ponto exato

Depois que o usuário escolher, leia **nesta ordem, e só isto**:

| Ordem | O quê | Para quê |
|---|---|---|
| 1 | o **último** `Discussão/1 · O que eu quero/Rodada N.md` | o norte da conversa, nas palavras dele |
| 2 | `Discussão/4 · Em aberto.md` inteiro | é a pauta |
| 3 | `Discussão/5 · Proibido.md` | o que não se pode reabrir por engano |
| 4 | `Discussão/6 · Não entendi.md` | o que ainda precisa ser explicado |

**Sob demanda, e só sob demanda:** `Discussão/2 · Terreno/` (quando precisar de um fato) e `Discussão/3 · Decidido.md` (quando precisar do porquê de uma decisão). Não leia o `3 · Decidido.md` por padrão: você retoma sabendo *o que falta* sem carregar *por que* o resto foi decidido — e quando precisar do porquê, vai buscar, pelo número da D.

**Confira o placar contra o `4 · Em aberto.md`.** Se a contagem discordar, refaça a linha de placar e diga isso ao usuário.

**Respeite o cabeçalho:** número de linha citado ali é datado, e nada dentro de um `<details>` é pauta ativa.

Depois de ler:

1. **Resuma no chat, em poucas linhas:** o que é a discussão, quantas decisões já fechou (pelo placar, não pelo conteúdo), **quais pontos ainda faltam** e o que ainda está em "não entendi".
2. **Retome pelo ponto mais bloqueante**, com uma recomendação sua e o motivo.

## Passo 4 — Continuar registrando

Daqui em diante, os mesmos deveres de quem abriu a discussão — escritos aqui por inteiro:

- **Ao final de cada resposta sua, atualize:** a nova `Discussão/1 · O que eu quero/Rodada N.md`, com a fala do usuário **crua**, sem reescrever; `2 · Terreno/Rodada N.md`, se houve fato novo; `3 · Decidido.md`, **com o motivo** e o número antigo (`D7 · … — era A2`); `4 · Em aberto.md` (cada item com símbolo, opções, recomendação e `**Falta:**`; o que fechou vai para o `<details>` «Recolhido»); `5 · Proibido.md` (cada "não fazer", com o motivo e a D de origem); `6 · Não entendi.md`; o `Arquivos que seriam mexidos.md`; as linhas `Placar:` e `Última atualização:` do `Discussão.md`; o `Pauta.html`; o `Resumo.html`; e o `Consulta.html`, se houve material de consulta.
- **Os cinco símbolos, e só eles:** `✅ decidido` · `🟡 falta decidir` · `🔴 bloqueante` · `🧊 congelado` · `❌ cancelado`. Só 🟡 e 🔴 contam.
- **A pauta poda.** Tire dela o que já foi decidido e o que o usuário já entendeu. **As abas, sempre nesta ordem:** Placar → O que mudou nesta rodada → Falta decidir (🔴 primeiro) → Falta entender → Já decidido (compacto); aba sem conteúdo não aparece. **Material de consulta não se poda — muda de lugar**, para o `Consulta.html`.
- **As formas da pauta são obrigatórias** — o usuário não deveria precisar pedir o desenho:

  | Quando o ponto… | a pauta mostra, obrigatoriamente |
  |---|---|
  | cria, move, renomeia ou apaga arquivo ou pasta | árvore **antes × depois** (novo em verde, o que sai riscado) |
  | muda uma sequência — pipeline, ciclo, ordem de passos | caixas e setas, **hoje × depois** |
  | tem dois ou mais caminhos | tabela de opções, com a recomendação marcada |
  | descreve uma reformulação | tabela hoje × depois |
  | a obra tem ordem e dependência | linha de fases |
  | o placar | cartões de número |

- **O `Resumo.html` é uma tabela só** — `O que é · Como está hoje · Como vai ficar · O que eu ganho` (+ chips das D/A) —, sem prosa, reescrito por inteiro.
- **O `Consulta.html`** é o terceiro HTML fixo, na raiz da discussão: nasce no primeiro material que o usuário vai querer rever (tabela de referência, pipeline, termo), **nunca é podado, só atualizado**, e guarda pouco.
- **HTML de explicação** — `{Assunto da explicação}.html` na raiz, raro, de preferência um só, sem pasta nova, só quando uma explicação grande incharia a pauta. **Apagado quando o usuário disser que entendeu**; o que for útil para sempre vai antes para o `Consulta.html`.
- **O que o usuário disse não ter entendido** vai para `6 · Não entendi.md` e para a aba «Falta entender»; marque **entendido** quando ele disser.
- **Leitura dinâmica:** uma fala solta do usuário pode resolver vários pontos de uma vez — mova todos, e nunca cobre um ponto que já foi respondido no meio de outra frase.
- **Não decida no lugar dele.** Só se ele disser abertamente que não quer responder aquele ponto — e aí **a escolha vale como decisão dele**: vai para `3 · Decidido.md` como qualquer D, com o motivo «o usuário pediu para o Claude decidir» e o porquê da escolha. Sem «revisar depois», sem revisão posterior.
- **Remover um assunto** são três passos: apagar o bloco grande; guardar a decisão com o motivo em `3 · Decidido.md`, marcada ❌; escrever a proibição em `5 · Proibido.md`.
- **Correção de recomendação anterior:** diga, corrija o registro, e marque como correção — não apague o erro.

## Passo 5 — Quando o último 🟡/🔴 sumir: «pronta para briefing»

1. **Não gere briefing.** Escrito aqui, no fim de uma conversa longa e com a janela cheia, ele sai pequeno.
2. O `Status:` do `Discussão.md` vira `pronta para briefing — rode /discutir-ideia-gerar-briefing numa janela limpa`, e o placar mostra zero em aberto.
3. A pauta vira a foto do fechamento: o placar e o que a última rodada mudou.
4. Diga ao usuário, com todas as letras: **«A discussão está pronta. Dê `/clear` (ou abra uma janela nova) e rode `/discutir-ideia-gerar-briefing {nome da pasta}`.»**

Este comando nunca cria `Briefing/` nem `Obra.md`. Quem os escreve é o `/discutir-ideia-gerar-briefing` — é lá que moram o molde do briefing e as regras de corte das fases.

## Ao regenerar os HTML

**Leia o `Pauta.html` que já está lá e reaproveite o CSS e a estrutura** — no `Resumo.html` e no `Consulta.html` também. O padrão visual não muda no meio de uma discussão. Mantenha o mesmo estilo, mude só o conteúdo: as abas, o texto e o destaque do que continua pendente.

Se por algum motivo o HTML não existir ou estiver ilegível, gere um novo seguindo a seção **🎨 PADRÃO VISUAL** no fim **deste** arquivo.

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
