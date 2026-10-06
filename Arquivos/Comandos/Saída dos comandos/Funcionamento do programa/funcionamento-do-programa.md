---
description: Lê o código-fonte do programa e monta uma apresentação em slides (HTML) explicando como ele funciona — arquitetura, fluxo e peças principais — para você entender o projeto rapidamente.
argument-hint: [foco opcional: ex. "só o fluxo de login" ou vazio para o programa todo]
---

# /funcionamento-do-programa — Apresentação de como o programa funciona

Você vai **analisar o código-fonte** do projeto atual e montar uma **apresentação em slides** (HTML navegável) que explique como o programa funciona: a arquitetura, o fluxo de ponta a ponta e as peças principais. O foco é o usuário **entender o funcionamento** rápido, sem ler o código inteiro.

## Passo 1 — Investigar o código

- Mapeie a estrutura: pontos de entrada, módulos principais, camadas (UI, lógica, dados), integrações externas.
- Siga o fluxo real: o que acontece do início (ação do usuário / evento) até o fim (resultado).
- Se o usuário passou um **foco** em `$ARGUMENTS`, concentre-se nele; senão, cubra o programa todo em alto nível.
- Baseie-se **no código de verdade** — nomes de arquivos, funções e módulos reais. Nada de inventar.

## Passo 2 — Montar os slides

Pasta de saída: `Saída dos comandos/Explicações/` na **raiz do projeto**. Crie as pastas se não existirem. Salve como `Saída dos comandos/Explicações/funcionamento-<slug>.html`.

Slides sugeridos (ajuste conforme o projeto):

1. **Capa** — nome do programa + resumo em uma linha do que ele faz.
2. **Visão geral** — o problema que resolve e as peças principais.
3. **Arquitetura** — um diagrama simples (caixas e setas) das camadas/módulos.
4. **Fluxo principal** — passo a passo do caminho mais importante (entrada → processamento → saída), citando os arquivos envolvidos.
5. **Componentes-chave** — 1 slide por módulo importante: o que faz, arquivos, dependências.
6. **Dados** — onde e como as informações são guardadas/trafegadas.
7. **Integrações externas** — APIs, libs, serviços.
8. **Pontos de atenção** — partes frágeis, dívidas técnicas, o que estudar antes de mexer.
9. **Resumo / mapa mental** — visão consolidada.

## Passo 3 — Requisitos do HTML

**Navegação (IMPORTANTE — não use botão "Próximo/Anterior"):**

- Barra de **abas fixa no topo** (uma aba por seção), com a marca do app à esquerda.
- Conteúdo em **rolagem vertical**: cada seção é um bloco alto (`min-height:~80vh`), e o usuário desce a página lendo.
- Clicar numa aba faz **scroll suave** até a seção; a aba ativa **acende sozinha** conforme a rolagem (use `IntersectionObserver`).
- Uma **barra de progresso** fininha no topo mostra o quanto já rolou.
- Autocontido (CSS/JS inline), diagramas em HTML/CSS puro (caixas, setas), sem libs externas.
- Cite `arquivo:linha` quando ajudar a localizar no código.

**Recursos visuais (OBRIGATÓRIO — o usuário aprende visualmente):** o deck não pode ser só texto. Cada seção tem **título claro**, explicação curta e, sempre que couber, **recursos gráficos**: tabelas/planilhas, gráficos (barras, linha, pizza), diagramas (fluxo, camadas) e **grafos de nós** (dependências/relações), além de cards, KPIs e exemplos concretos (dado fictício, `arquivo:linha`). Varie os tipos ao longo do deck.

**Padrão visual:** siga **exatamente** a seção **🎨 PADRÃO VISUAL** no fim deste arquivo — o padrão oficial "Glass Dark Aurora" (escuro, roxo/violeta, painéis de vidro sobre fundo com aurora). Tokens, fundo, componentes e o script de abas+rolagem estão todos lá, prontos para copiar. Para mudar o visual no futuro, edite aquela seção.

## Objetivo

Ao final, o usuário deve conseguir explicar, olhando os slides, **como o programa funciona e por onde a informação passa**. Informe o caminho do arquivo e ofereça abrir.

---

**Foco da apresentação (opcional):** $ARGUMENTS

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
