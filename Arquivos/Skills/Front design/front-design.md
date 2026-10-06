---
name: front-design
description: "Como construir a interface de um programa (ferramenta, dashboard, chat, editor, cadastro, app de celular ou site) decidindo sozinha o que o usuário não deveria precisar dizer toda vez — qual layout (abas horizontais ou verticais, lista e detalhe, tabela, kanban, canvas, chat…), como mostrar cada informação, estados (vazio, carregando, erro…), densidade, espaçamento, contraste e o que muda no celular, no site e dentro de outro programa. Use SEMPRE antes de criar ou alterar qualquer tela, componente ou layout. A paleta de cores vem do usuário: esta skill não escolhe cor e não cria arquivo."
---

# Front design

## 1 · O que esta skill é

É o **padrão de quando o usuário não disse nada**. Tudo o que ele disser — uma cor, uma aba, uma densidade, um Estilo — vence, sempre. A skill existe para que ele não precise repetir, a cada tela, o espaçamento, o contraste, o que fazer e o que não fazer.

O terreno dela é **ferramenta e dashboard**: programa que a pessoa usa para trabalhar. Site ou marca (página que apresenta algo, com imagem e movimento) pede outra postura, descrita no `10`.

**Como usar:** leia este índice, responda sozinho as duas perguntas do §3, abra o `01` e depois só os arquivos do mapa (§4) que a tarefa pedir. A skill **decide e constrói**: o planejamento é interno e ninguém aprova plano.

**Como os arquivos se citam:** por número — «→ `08`» é o arquivo 08, esteja na pasta que estiver. O prefixo das pastas diz a faixa que cada uma guarda: `01 - 03` decide, `04 - 06` constrói cada layout, `07 - 11` desenha, `12 - 14` confere.

## 2 · As regras que valem sempre

1. **O que o usuário disser vence — em tudo: cor, aba, densidade, Estilo.** A skill só vale onde ele calou. *Porquê: ele pode dizer tudo; a skill existe para o que ele não quer repetir.*
2. **A paleta de cores vem do usuário; esta skill não escolhe cor.** Sem paleta dada: papéis de cor em variáveis, com escala neutra sem matiz, e a linha final avisa (→ `11`). *Porquê: aparência é dele.*
3. **Nunca pergunte e nunca peça aprovação.** Decida o que dá para inferir; quando faltar algo, siga o padrão da skill e conte na linha final. O planejamento é interno. *Porquê: ele não quer ficar aprovando nem respondendo.*
4. **A estrutura da tela reflete a tarefa, não a estética.** Escolha o layout pela tarefa e pelo volume de informação (→ `02`, `03`). *Porquê: layout bonito para a tarefa errada obriga a pessoa a contornar a tela.*
5. **Estados fazem parte do desenho.** Vazio, carregando, erro, parcial, offline, sem permissão — desenhe todos, não só «dados carregados e sucesso» (→ `08`). *Porquê: a tela real passa a maior parte do tempo fora do caminho feliz.*
6. **Em ferramenta, contenção vence.** Cada elemento diz algo ou some (→ `09`, `13`). *Porquê: decoração compete com o dado.*
7. **Tela que abriu responde na hora.** Feedback em cerca de 100 ms; ação reversível executa e oferece «Desfazer» em vez de perguntar «tem certeza?» (→ `08`, `12`). *Porquê: confirmação em tudo ensina a pessoa a clicar «sim» sem ler, e no dia da ação perigosa ela clica igual.*
8. **Olhe o resultado antes de entregar**, quando houver como abrir um navegador (→ `14`). *Porquê: o código pode estar certo e a tela errada — corte, sobreposição, rolagem dupla só aparecem renderizados.*
9. **Esta skill não cria nem grava arquivo** — nem registro de decisões, nem «sistema de design», nada além da interface pedida. Ela lê o que o projeto já tem e faz conforme. *Porquê: quem cuida da consistência entre telas é outra coisa, não esta skill.*
10. **Esta skill funciona sozinha:** tudo de que precisa está nestes arquivos; ela não consulta nem cita outra. *Porquê: dependência escondida faz a skill falhar num projeto que não tem a outra.*

## 3 · As duas perguntas antes de tudo

Responda **por conta própria**, olhando o pedido, os arquivos do projeto e as palavras do usuário.

**Pergunta 1 — onde a tela roda?**

| Camada | É quando… | Sinal que denuncia |
|---|---|---|
| **Computador** (a base) | mouse, teclado, monitor grande | programa que se instala e abre no computador; painel; «janela» |
| **Celular** (tablet incluído) | toque, tela pequena, vertical e horizontal | «app de celular», projeto de app móvel, «no telefone» |
| **Site** | página aberta no navegador por quem visita | «landing page», «site», «institucional», página pública |
| **Encaixado em outro programa** | extensão, plugin, painel dentro de um hospedeiro | manifesto de extensão de navegador, «plugin do Obsidian», «painel lateral do editor» |

Sem sinal nenhum: **Computador**, com o **Full HD (1920×1080)** como tela de referência. As regras de cada camada moram todas no `10`; este índice só pergunta e aponta.

**Pergunta 2 — é ferramenta ou site?**

- **Ferramenta** = a pessoa usa para trabalhar (cadastro, painel, editor, chat, gerenciador). É o terreno desta skill.
- **Site/marca** = a pessoa visita para conhecer ou comprar. Pede outra postura: mais imagem, transição e espaço (→ `10`).

Sem sinal nenhum: **ferramenta**. São eixos diferentes: «Celular/Computador» é o aparelho; «ferramenta/site» é a natureza do produto — um site também abre no celular.

## 4 · O mapa: vai fazer X → abra Y

Sempre `01` primeiro. Caminhos relativos à pasta da skill.

| Vai fazer… | Abra |
|---|---|
| decidir sozinha o que falta e o que fazer quando o pedido é curto | `01 - 03 - Decidir\01 As perguntas antes de desenhar.md` |
| escolher a estrutura da tela (qual Estilo, qual navegação; produto → resultado) | `01 - 03 - Decidir\02 Escolher o layout.md` |
| escolher card, tabela, gráfico, métrica, kanban, linha do tempo… | `01 - 03 - Decidir\03 Escolher como mostrar a informação.md` |
| construir Abas horizontais, Abas verticais, Navegação inferior, Barra de comando, Rolagem em seções; «onde estou» e «voltar» | `04 - 06 - Construir cada layout\04 Abas e navegação.md` |
| construir Lista e detalhe, Painel dividido, Editor com inspetor, Tabela densa, Dashboard em grade, Quadro kanban, Linha do tempo | `04 - 06 - Construir cada layout\05 Listas, dados e edição.md` |
| construir Canvas infinito, Janelas flutuantes, Chat com contexto, Foco único, Assistente em passos, Documentação | `04 - 06 - Construir cada layout\06 Espaço livre, conversa e fluxo.md` |
| botões, tabelas, formulários, diálogos e gavetas, filtros, toolbars; onde fica o botão de um objeto; as frases (botão, erro, tela vazia) | `07 - 11 - Desenhar\07 Componentes — só as decisões.md` |
| vazio, carregando, erro, offline, salvando, sem permissão; resposta rápida, desfazer, avançado escondido | `07 - 11 - Desenhar\08 Estados.md` |
| hierarquia, espaçamento, alinhamento, contraste, tamanhos, densidade; ocupar o espaço, altura da tela e blocos do mesmo tamanho; texto comprido e dado real; estrutura visual como informação | `07 - 11 - Desenhar\09 Hierarquia, espaço, densidade e legibilidade.md` |
| o que muda no Celular, no Site, dentro de outro programa; postura de ferramenta × site | `07 - 11 - Desenhar\10 Plataformas — o que muda.md` |
| aplicar a paleta, a tipografia, as texturas e as animações que o usuário escolheu; o que fazer sem paleta | `07 - 11 - Desenhar\11 Usar o que o usuário escolheu.md` |
| duas regras brigando; a ordem de prioridade | `12 - 14 - Conferir\12 Regras de decisão.md` |
| reconhecer e cortar a «cara de IA» e os anti-padrões | `12 - 14 - Conferir\13 Anti-padrões e «cara de IA».md` |
| conferir antes de entregar | `12 - 14 - Conferir\14 Checklist final.md` |

Ordem natural de uma tela nova: `01` → `02` → `03` → o arquivo do Estilo (`04`–`06`) → `07`–`11` → `12` e `14`.

## 5 · Vocabulário

| Termo | Significa |
|---|---|
| **Estilo** | esqueleto de layout — e só isso |
| **aparência** | a estética: cor, fonte, textura, animação. «Estilo» nunca quer dizer aparência |
| **camada** | as quatro plataformas do §3 |
| **densidade** | denso · equilibrado · espaçoso (→ `09`) |
| **irmãos** | blocos que cumprem o mesmo papel na tela: colunas paralelas, a prévia e a faixa ligada a ela, cards da mesma linha (→ `09`) |
| **estados** | tudo o que a tela mostra além de «dados carregados e sucesso» (→ `08`) |
| **produto → resultado** | a tabela curta «tipo de produto → Estilo, navegação, detalhes» (→ `02`) |
| **cara de IA** | os vícios típicos de tela gerada por IA (→ `13`) |
| **linha final** | a última linha da resposta, com o que foi assumido (→ §6) |

Os **18 Estilos**, em ordem alfabética: Abas horizontais · Abas verticais · Assistente em passos · Barra de comando · Canvas infinito · Chat com contexto · Dashboard em grade · Documentação · Editor com inspetor · Foco único · Janelas flutuantes · Linha do tempo · Lista e detalhe · Navegação inferior · Painel dividido · Quadro kanban · Rolagem em seções · Tabela densa.

São os nomes que o usuário já vê quando escolhe um Estilo; use-os exatamente assim.

## 6 · A linha final

A última linha da resposta: «**Assumi:** …» com o que você decidiu por conta própria e que o usuário poderia querer mudar — plataforma, tipo de produto, densidade, paleta neutra por falta de paleta, «não olhei a tela». Uma linha, sem pergunta, sem esperar resposta. Se nada foi assumido, não escreva.

*Porquê: o usuário corrige na hora, sem que isso vire aprovação.*

## 7 · O que esta skill não faz

- **Não escolhe cor.** A paleta é do usuário (→ `11`).
- **Não cria nem grava arquivo** além da interface pedida.
- **Não pergunta nem pede aprovação.** Decide, constrói e conta o que assumiu.
