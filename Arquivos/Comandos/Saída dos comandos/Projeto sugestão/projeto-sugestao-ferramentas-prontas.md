---
description: Pesquisa na internet ferramentas e tecnologias externas prontas (libs, serviços, programas) que dá para acrescentar ao projeto, e gera um relatório HTML comparando as opções.
argument-hint: [necessidade opcional: ex. "algo pra gerar PDF" ou vazio para o projeto todo]
---

# /projeto-sugestao-ferramentas-prontas — Ferramentas externas prontas para usar

Você vai **entender o projeto atual**, **pesquisar na internet** e montar um **relatório em HTML** (padrão visual no fim deste arquivo) com **ferramentas e tecnologias externas prontas** — bibliotecas, serviços, APIs, programas — que dá para acrescentar em vez de reinventar. A ideia é: "isso aqui já existe pronto, é só integrar".

## Passo 1 — Entender a necessidade

- Veja o que o projeto faz e onde uma ferramenta pronta economizaria trabalho (ex.: gerar PDF, gráficos, auth, OCR, embeddings, fila, cache).
- Se o usuário passou uma **necessidade** em `$ARGUMENTS`, foque nela; senão, levante as 3–5 frentes onde uma ferramenta pronta ajudaria mais.
- Note a stack real do projeto (linguagem, framework) para sugerir só o que é compatível.

## Passo 2 — Pesquisar na internet

- Use **WebSearch/WebFetch** para achar opções reais, atuais e mantidas. Não invente nomes nem versões.
- Para cada candidata, colete: o que faz, licença/custo, se é mantida (última atualização), como se integra na stack do projeto, e o **link oficial**.
- Prefira opções populares e bem mantidas; registre também 1 alternativa por frente.

## Passo 3 — Gerar o relatório

Pasta de saída: `Saída dos comandos/Melhorias a se fazer/` na **raiz do projeto** (crie as pastas se não existirem). Salve como `Saída dos comandos/Melhorias a se fazer/sugestao-ferramentas-<slug>.html`. Não sobrescreva um relatório anterior sem avisar.

Seções sugeridas (viram abas no topo):

1. **Capa** — projeto + o que estamos procurando.
2. **Necessidades** — as frentes onde uma ferramenta pronta ajudaria.
3. **Ferramentas encontradas** — uma **tabela** por frente: ferramenta · o que faz · licença/custo · mantida? · como integra · **link**.
4. **Comparação** — para as frentes principais, prós/contras das top 2 (tabela ou cards).
5. **Recomendação** — a escolha sugerida por frente e o primeiro passo de integração.

Cada ferramenta: **nome + link oficial + o que resolve + como entra no projeto (`arquivo:linha`/módulo) + custo/licença**. Use tabelas comparativas e badges — bem visual. **Sempre cite a fonte (link)** de cada informação.

## Objetivo

Ao final, o usuário deve ter **uma lista curada de ferramentas prontas**, comparadas e com links, para decidir o que integrar. Responda o essencial no chat também e aponte o caminho do HTML gerado, oferecendo abrir.

---

**Necessidade (opcional):** $ARGUMENTS

---

# 🎨 PADRÃO VISUAL — "Glass Dark Aurora"

> **Edite esta seção se quiser mudar o visual.** Ela é a fonte de verdade do estilo deste comando.

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

## Recursos visuais OBRIGATÓRIOS (o usuário aprende visualmente)

Nunca só texto. Use, conforme o conteúdo: **tabelas/planilhas**, **gráficos** (barras CSS, linha/área via SVG `<polyline>`/`<polygon>`, pizza), **diagramas** (fluxo com caixas+setas, camadas empilhadas), **grafos de nós** (SVG `<line>` + retângulos rotulados), além de cards, KPIs, chips e barras de progresso. Cada seção: **título claro + explicação curta + exemplo concreto** (dado fictício, `arquivo:linha`).

## Navegação: abas fixas no topo + rolagem (NUNCA "Próximo/Anterior")

Barra de abas fixa no topo (uma por seção). Conteúdo em seções altas (`min-height:~78vh`) roladas verticalmente. Aba ativa via `IntersectionObserver`. Barra de progresso fina no topo. Clique na aba dá scroll suave.

```html
<div class="topbar"><div class="inner">
  <div class="brand"><span class="mark">◆</span> NomeApp</div>
  <nav class="tabs" id="tabs">
    <button class="tab on" data-to="s1">Seção 1</button>
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
