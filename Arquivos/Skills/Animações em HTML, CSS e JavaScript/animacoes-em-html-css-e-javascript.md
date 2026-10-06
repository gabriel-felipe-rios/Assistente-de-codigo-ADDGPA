---
name: animacoes-em-html-css-e-javascript
description: "Como construir animações em HTML, CSS e JavaScript — de UI a momentos autorais ricos — decidindo sozinha o que o pedido não disse: que técnica usar (CSS, Web Animations, rAF, SVG, Canvas), o nível certo entre animação básica e detalhada, curvas, molas, duração, ritmo, hierarquia e riqueza (fundo, partículas, luz), e onde a animação roda (janela com fundo transparente, sempre no topo, monitor inteiro, dentro de um programa, site, iframe, mobile, OBS). Também é uma skill de motion design: combate o «AI slop» de animação seca. Use SEMPRE antes de criar ou alterar qualquer animação em HTML/CSS/JavaScript."
---

# Animações em HTML, CSS e JavaScript

## 1 · O que esta skill é

Ensina a fazer animação bonita em HTML+CSS+JavaScript, com **teto alto**: não fica no básico. É também uma skill de **motion design**: curvas, tempo, ritmo, hierarquia e riqueza (fundo e partícula fazem muita diferença).

É **genérica quanto ao hospedeiro**: janela própria, janela integrada a um programa, site, iframe, app mobile, overlay. Os runtimes citados (Electron, Tauri, WebView2…) são exemplos; o eixo é o contrato do `28`.

**Como usar:** leia este índice, responda sozinho as duas perguntas do §3, abra o `07` e depois só os arquivos do mapa (§4) que a tarefa pedir.

**Como os arquivos se citam:** por número. "→ `08`" é o arquivo 08, esteja na pasta que estiver. O prefixo das pastas diz a faixa: `01 - 06` decidir e base · `07 - 15` ofício do motion design · `16 - 27` construir · `28 - 37` onde a animação roda · `38 - 41` desempenho e acessibilidade · `42 - 44` conferir.

## 2 · As regras que valem sempre

1. **Nunca pergunte e nunca peça aprovação.** Decida o que dá para inferir; construa; feche com "**Assumi:** …". *Porquê: o usuário corrige na hora, sem aprovar plano.*
2. **Antes do código, escreva o script de tempo** (curva, duração e atraso por elemento) e responda: o que comunica? quem é o herói? qual é a ação secundária ou o ambiente? (→ `07`). *Porquê: o que falta à animação de IA é pensar como ela acontece.*
3. **O papel decide o nível:** UI funcional → básica e contida; momento autoral → detalhada e rica; ambiente → lenta e discreta (→ `02`). *Porquê: demais fica ruim, de menos também.*
4. **Cada camada de riqueza precisa de um papel:** profundidade, foco, ritmo ou marca; sem papel, corta (→ `13`). *Porquê: riqueza sem papel vira ruído.*
5. **Fuja do AI slop:** fade-up em tudo, `ease` de 300 ms em tudo, stagger de 50 ms fixo, sem hierarquia, sem fundo (→ `15`). *Porquê: é o que a IA repete quando ninguém dirige.*
6. **Nativo primeiro.** CSS/WAAPI/rAF antes de biblioteca; biblioteca só quando vale, com **cópia local** (→ `01`, `06`). *Porquê: a IA puxa biblioteca até para um botão.*
7. **Anime só `transform` e `opacity`; tempo por delta time, nunca por quadro** (→ `03`, `05`). *Porquê: é o que roda no compositor e em qualquer taxa de monitor.*
8. **Detecte recurso, degrade, e nunca dependa só do que é novo** (→ `39`). *Porquê: o hospedeiro é imprevisível.*
9. **Respeite `prefers-reduced-motion`: troque por dissolver, não só desligue** (→ `41`). *Porquê: é obrigatório e é acessibilidade.*
10. **Número de ofício é parâmetro, não lei:** os sem fonte forte vêm rotulados "*convenção de ofício*"; onde a pesquisa não confirmou, a skill diz "**testar na sua versão**" em vez de afirmar. *Porquê: as fontes divergem.*
11. **Esta skill funciona sozinha:** tudo de que precisa está nestes arquivos; ela não consulta nem cita outra skill. *Porquê: dependência escondida falha num projeto que só tem uma das duas.*
12. **Olhe o resultado antes de entregar**, quando houver como abrir um navegador (→ `44`). *Porquê: o código pode estar certo e a animação errada.*

## 3 · As duas perguntas antes de tudo

Responda sozinha. São eixos diferentes: uma animação de UI funcional pode rodar numa janela transparente, e um momento autoral pode rodar num site.

**Pergunta 1 — que papel tem esta animação?** (nível em `02`)

| Papel | Sinal |
|---|---|
| **UI funcional** | acontece muitas vezes: hover, botão, formulário, lista |
| **momento autoral** | poucas vezes: entrada, herói, celebração, transição |
| **ambiente** | sempre ligado: fundo vivo, deriva |

**Pergunta 2 — onde ela roda?**

| Hospedeiro | Sinal | Abra |
|---|---|---|
| **janela própria** | "widget", "overlay", fundo transparente, sempre no topo, monitor inteiro | `29`–`31` |
| **encaixada num programa** | "dentro do programa", webview | `32` |
| **site ou iframe** | página web, embed | `33` |
| **mobile** | app de celular, webview mobile | `34`, `35` |
| **overlay de transmissão** | OBS, stream | `37` |

Sem sinal nenhum: **UI funcional** e **janela do navegador** (contida e sem suposição de fundo).

## 4 · O mapa: vai fazer X → abra Y

**Sempre `07` primeiro** (e `02` para o nível). Caminhos relativos à pasta da skill.

| Vai fazer… | Abra |
|---|---|
| decidir o que animar, o propósito, o script de tempo | `07 - 15 - O ofício do motion design\07 Antes de animar.md` |
| decidir o nível: básica × detalhada | `01 - 06 - Decidir e base\02 Básico ou detalhado — o nível certo.md` |
| escolher CSS × Web Animations × rAF × SVG × Canvas; suporte de recursos novos | `01 - 06 - Decidir e base\01 Que animação e que técnica.md` |
| laço de animação, delta time, aba oculta | `01 - 06 - Decidir e base\03 O tempo no navegador.md` |
| escolher a taxa de quadros, limitar FPS | `01 - 06 - Decidir e base\04 FPS — que taxa mirar.md` |
| saber o que é barato e o que é caro de animar | `01 - 06 - Decidir e base\05 O que o navegador anima barato.md` |
| considerar GSAP, Motion, Lottie, Rive, Three… | `01 - 06 - Decidir e base\06 Bibliotecas — quando trazer.md` |
| escolher curva de easing | `07 - 15 - O ofício do motion design\08 Curvas e easing.md` |
| molas, overshoot, bounce | `07 - 15 - O ofício do motion design\09 Molas e overshoot.md` |
| escolher duração; decidir se anima | `07 - 15 - O ofício do motion design\10 Duração e frequência de uso.md` |
| ritmo, stagger, sobreposição, tempo para bater | `07 - 15 - O ofício do motion design\11 Ritmo, sobreposição e batida.md` |
| hierarquia, quanta coisa se mexe junto | `07 - 15 - O ofício do motion design\12 Hierarquia e densidade.md` |
| animação "seca", falta de riqueza | `07 - 15 - O ofício do motion design\13 Riqueza — camadas, ação secundária e profundidade.md` |
| tokens de duração e curva, coerência | `07 - 15 - O ofício do motion design\14 Linguagem de movimento.md` |
| reconhecer a cara de IA | `07 - 15 - O ofício do motion design\15 Anti-AI-slop.md` |
| hover, botão, formulário, lista, painel | `16 - 27 - Construir\16 Interface e microinterações.md` |
| modal, toast, entrada/saída, reordenar lista | `16 - 27 - Construir\17 Entrada, saída e reordenação.md` |
| ilustração, traçado, morph, SVG | `16 - 27 - Construir\18 Cena e ilustração com SVG.md` |
| spritesheet, personagem, Canvas 2D | `16 - 27 - Construir\19 Sprites e personagem em Canvas.md` |
| fundo vivo, gradiente animado, grão | `16 - 27 - Construir\20 Fundo vivo.md` |
| partículas, confete, faíscas | `16 - 27 - Construir\21 Partículas.md` |
| glow, sombra, blur, brilho | `16 - 27 - Construir\22 Luz, brilho, sombra e blur.md` |
| rastro, motion blur | `16 - 27 - Construir\23 Rastros e motion blur.md` |
| parallax, scroll-driven | `16 - 27 - Construir\24 Parallax e scroll-driven.md` |
| transição entre telas e páginas | `16 - 27 - Construir\25 Transição entre telas e páginas.md` |
| entrada de página, herói, celebração | `16 - 27 - Construir\26 Momentos autorais — entrada, herói, celebração.md` |
| animação ligada a áudio | `16 - 27 - Construir\27 Sincronizar com áudio.md` |
| o que ler do hospedeiro; visão geral | `28 - 37 - Onde a animação roda\28 O contrato com o hospedeiro.md` |
| fundo transparente / janela sem moldura | `28 - 37 - Onde a animação roda\29 Fundo transparente e janela sem moldura.md` |
| sempre no topo, jogo, foco | `28 - 37 - Onde a animação roda\30 Sempre no topo, jogo e foco.md` |
| preencher o monitor, DPI, click-through | `28 - 37 - Onde a animação roda\31 Preencher o monitor, DPI e click-through.md` |
| dentro de um programa (webview) | `28 - 37 - Onde a animação roda\32 Dentro de um programa — webview embutida.md` |
| dentro de site ou iframe | `28 - 37 - Onde a animação roda\33 Dentro de um site ou iframe.md` |
| mobile: taxa de quadros, energia | `28 - 37 - Onde a animação roda\34 Mobile — webview e taxa de quadros.md` |
| mobile: layout, área segura, toque | `28 - 37 - Onde a animação roda\35 Mobile — layout, área segura e toque.md` |
| vídeo/imagem com transparência | `28 - 37 - Onde a animação roda\36 Ativos com transparência.md` |
| OBS, overlay de transmissão | `28 - 37 - Onde a animação roda\37 OBS e overlays de transmissão.md` |
| a animação trava | `38 - 41 - Desempenho e acessibilidade\38 Fluidez — o que trava e por quê.md` |
| qualidade adaptativa, aparelho fraco, reserva | `38 - 41 - Desempenho e acessibilidade\39 Qualidade adaptativa e degradar.md` |
| medir FPS e quadros perdidos | `38 - 41 - Desempenho e acessibilidade\40 Como medir.md` |
| reduzir movimento, WCAG | `38 - 41 - Desempenho e acessibilidade\41 Acessibilidade e reduzir movimento.md` |
| diagnosticar "robótico, plano, brusco, distrativo" | `42 - 44 - Conferir\42 Diagnóstico — sintoma → correção.md` |
| revisar código de animação | `42 - 44 - Conferir\43 Erros técnicos comuns.md` |
| conferir antes de entregar | `42 - 44 - Conferir\44 Checklist final.md` |

**Ordem natural de uma animação nova:** `07` → `02` → `01` → o arquivo da receita (`16`–`27`) → onde roda (`28`–`37`, se precisar) → `38`–`41` → `15`, `42` e `44`.

## 5 · Vocabulário

| Termo | Sentido |
|---|---|
| **papel** | UI funcional, momento autoral ou ambiente: decide o nível (→ `02`) |
| **herói** | o elemento que lidera o momento |
| **apoio** | o que acompanha o herói, mais discreto |
| **ambiente** | o que fica sempre ligado ao fundo, lento e discreto |
| **momento autoral** | poucas vezes, rico e orquestrado (→ `26`) |
| **script de tempo** | tabela de curva, duração e atraso por elemento, escrita antes do código (→ `07`) |
| **AI slop** | o trabalho preguiçoso de IA: animação seca, sem detalhe, curva sem suavizar, sem hierarquia (→ `15`) |
| **hospedeiro** | onde a animação roda (janela, programa, site, mobile, OBS) |
| **contrato com o hospedeiro** | o que a animação lê e nunca assume (→ `28`) |
| **tempo para bater / pousar na batida** | o movimento cair no tempo certo, alinhado à batida (→ `11`) |
| **convenção de ofício** | número sem fonte forte, ajustável |
| **testar na sua versão** | o que a pesquisa não confirmou: instrução de teste, não fato |
| **linha final** | a linha "Assumi: …" (→ §6) |

## 6 · A linha final

A última linha da resposta: "**Assumi:** …" com o que foi decidido sozinho e o usuário poderia querer mudar: papel, hospedeiro, técnica, nível de riqueza, "não medi no aparelho", "não olhei o resultado". Uma linha, sem pergunta, sem esperar resposta. Se nada foi assumido, não escreva.

*Porquê: o usuário corrige na hora, sem que isso vire aprovação.*

## 7 · O que esta skill não faz

- Não escolhe um programa ou hospedeiro específico (o eixo é o contrato, → `28`).
- Não ensina WebGL/WebGPU/3D; só cita quando vale (→ `01`).
- Não pergunta nem pede aprovação de plano.
- Não afirma o que a pesquisa não confirmou.
