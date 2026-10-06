---
description: Explora o projeto e gera um relatório HTML com o que FUGIU do que o projeto já decidiu — cor fora dos tokens, componente diferente do registrado, tela sem arquivo na base, nome fora do vocabulário, arquivo fora do lugar da arquitetura, regra desobedecida — lendo as bases em "Saída das skills/" e comparando com o código. Use quando "tem hora que vejo diferenças" ou quando quiser saber o que passou pelas skills sem ser visto.
argument-hint: [foco opcional: ex. "só a aba Fila", "só nomes", "só visual" ou vazio para o projeto todo]
---

# /projeto-sugestao-desvios — O que fugiu do que já foi decidido

Você vai **ler o que este projeto já decidiu** — as bases em `Saída das skills/`, na raiz do projeto — e **comparar com o código**, montando um **relatório em HTML** (padrão visual no fim deste arquivo) com cada desvio: onde o código contraria uma decisão escrita, e o que fazer.

As bases dizem o que o projeto decidiu; nada confere depois se o código obedeceu. Este comando é esse "depois".

## Passo 1 — Ler as bases

Em `Saída das skills/`, na raiz do projeto, o que existir:

| Base | O que ler | O que ela decide |
|---|---|---|
| `Arquitetura modular/` | `Convenções.md`, `Exceções.md` (ou as pastas com índice, se viraram pasta) | onde cada arquivo e pasta mora |
| `Padrões de interface/` | `Índice geral.md` e o que ele apontar: `Identidade visual.md`, `Convenções.md`, `Exceções.md`, `Componentes/`, `Estrutura das telas/`, `Comportamentos/` | como as telas parecem e se comportam |
| `Terminologia e nomenclatura/` | `Vocabulário.md` (ou `Vocabulário/Índice - Vocabulário.md` e os temas), `Convenções.md`, `Exceções.md` | como as coisas se chamam, e como não |
| `Regras e instruções/` | `Índice.md` e as regras | o que vale sempre |

**Base que não existe: diga que não existe e siga com as outras.** Nunca invente regra: só se compara contra o que está escrito. Se o usuário passou um **foco** em `$ARGUMENTS`, restrinja a leitura e a comparação a ele.

## Passo 2 — Comparar com o código

Para cada base, o que procurar — sempre com `arquivo:linha`:

- **Arquitetura:** arquivo em pasta que a base não prevê; arquivo fora do balde (mídia em `Code/`, cache em `Code/`, configuração do usuário em `constants/`); nome de arquivo fora da convenção; arquivo acima do tamanho combinado; exceção registrada que o código não respeita.
- **Interface:** cor, fonte, espaçamento ou raio fixo onde deveria ser token; componente reimplementado, ou diferente do arquivo dele em `Componentes/`; tela ou componente **sem arquivo na base** (é desvio da base, não do código); comportamento (loading, erro, confirmação) diferente do registrado; exceção aplicada fora da tela em que vale.
- **Nomes:** identificador ou texto de tela que usa sinônimo de um nome canônico ("nunca usar"); nome que contraria uma convenção (verbo em nome de aba, caixa alta, abreviação); a mesma palavra nomeando duas coisas.
- **Regras:** regra do índice desobedecida em código novo; receita existente que não foi seguida (a segunda coisa do mesmo tipo feita diferente da primeira).

Baseie-se **no código de verdade**. Nada de inventar, nada de "provavelmente".

## Passo 3 — Gerar o relatório

Pasta de saída: `Saída dos comandos/Melhorias a se fazer/` na **raiz do projeto** (crie as pastas se não existirem). Salve como `Saída dos comandos/Melhorias a se fazer/sugestao-desvios-<slug>.html`. Não sobrescreva um relatório anterior sem avisar.

Seções (viram abas no topo):

1. **Capa** — nome do projeto + uma linha: quantos desvios, em quantas bases.
2. **Panorama** — uma tabela: base · desvios encontrados · os três mais graves.
3. **Uma aba por base** — cada desvio com: **a regra escrita** (citada, com o arquivo da base) · **onde o código a contraria** (`arquivo:linha`, trecho) · **como corrigir** (uma frase) · gravidade.
4. **Priorização** — tabela impacto × esforço.
5. **O que a base não cobre** — padrão que se repete no código sem regra escrita (três botões iguais sem `Componentes/Botão.md`; um nome usado em cinco lugares sem verbete). É candidato a registrar — diga isso, não registre.

Cada desvio: **título claro + a regra + o trecho + o conserto**. Use tabelas, cards e diagramas — bem visual.

## Objetivo

Ao final, o usuário deve saber **o que passou pelas bases sem ser visto**, e por onde começar a corrigir. Responda o essencial no chat também e aponte o caminho do HTML gerado, oferecendo abrir. **Este comando não corrige nada e não escreve nas bases** — ele aponta.

---

**Foco (opcional):** $ARGUMENTS

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
