# 02 Escolher o layout

## O que é e quando abrir

Quando você já respondeu os oito eixos (→ `01`) e precisa dizer **qual Estilo** — qual esqueleto de layout — usar. A escolha é pela **tarefa**, nunca pela estética. Os nomes são os dos 18 Estilos (→ `front-design.md` §5); use-os exatamente assim.

*Porquê: o esqueleto errado obriga a pessoa a contornar a tela a cada uso, e nenhum acabamento conserta isso.*

## A árvore de decisão

A pergunta é: **o que a pessoa faz principalmente?**

- **Navega entre áreas**
  - poucas áreas (até 5–7) → **Abas horizontais**
  - muitas áreas (8 ou mais) ou estrutura que cresce (20+ itens) → **Abas verticais**
  - subáreas do mesmo contexto → Abas horizontais dentro da área
  - muitas ações e uso de teclado → **Barra de comando**, *além* da navegação (nunca no lugar dela)
  - Celular com 3–5 destinos → **Navegação inferior**
- **Trabalha com uma coleção de coisas**
  - precisa ver o detalhe de cada uma → **Lista e detalhe**
  - precisa comparar valores → **Tabela densa**
  - precisa organizar por estado → **Quadro kanban**
  - precisa ver dois conteúdos lado a lado, com controle da largura → **Painel dividido**
- **Acompanha muitos indicadores** → **Dashboard em grade**
- **Segue um processo em sequência**
  - várias telas, uma por etapa, com revisão no fim → **Assistente em passos**
  - uma pergunta por vez, leve, no celular → **Foco único**
- **Trabalha com espaço e objetos**
  - superfície sem limite para posicionar coisas → **Canvas infinito**
  - vários painéis de ferramenta que a pessoa arruma como quiser → **Janelas flutuantes**
  - um objeto com propriedades editáveis ao lado → **Editor com inspetor**
- **Conversa com um assistente** → **Chat com contexto**
- **Lê**
  - texto longo com capítulos → **Documentação**
  - página única com blocos → **Rolagem em seções**
  - eventos ao longo do tempo → **Linha do tempo**
- **Configura algo complexo**
  - poucas categorias → Abas horizontais
  - muitas → Abas verticais
  - passo a passo → Assistente em passos

## Produto → resultado

Sete tipos de produto e o ponto de partida de cada um.

| Tipo | Estilo principal | Navegação | Detalhe e filtros | Densidade |
|---|---|---|---|---|
| **Ferramenta com painéis** (gerenciador, ambiente de trabalho) | Abas verticais (trilho + painel) ou Abas horizontais | centro em Painel dividido ou Editor com inspetor; Barra de comando para as ações | detalhe no próprio painel, filtros no topo da lista | densa |
| **Dashboard / monitoramento** | Dashboard em grade | métricas no topo; período e filtros numa barra única | detalhe por aprofundamento (gaveta ou Lista e detalhe); tabela complementa, gráfico não é o protagonista; cabe numa tela de notebook | equilibrada para densa |
| **Chat / agente** | Chat com contexto | sessões à esquerda, contexto à direita, campo de envio fixo embaixo | mensagem em largura total, não bolhas de mensageiro | equilibrada |
| **Editor / canvas** | Editor com inspetor ou Canvas infinito | trilho de ferramentas, propriedades ao lado, barra contextual | atalhos, desfazer e refazer sempre à mão | densa |
| **Cadastro / admin** | Abas verticais para os módulos | Tabela densa com filtros e ações em lote | detalhe em gaveta ou Lista e detalhe; Quadro kanban se houver estados de fluxo | equilibrada |
| **Site** | Rolagem em seções | cabeçalho fixo | postura de site (→ `10`) | espaçosa |
| **App de celular** | Navegação inferior | Lista e detalhe em duas telas empilhadas | Foco único ou Assistente em passos para fluxos | equilibrada para espaçosa |

Isto é um ponto de partida curto, não uma tela pronta: **nunca copie o resultado ao pé da letra** — ajuste aos oito eixos (→ `01`). Um cadastro de 12 registros não precisa de Tabela densa; uma ferramenta com 3 áreas não precisa de Abas verticais.

## Combinar Estilos

Uma tela real mistura: Abas verticais para os módulos, Painel dividido no centro, Tabela densa dentro de um dos lados. A regra:

- **um Estilo manda na estrutura; os outros moram dentro de uma região dele;**
- a navegação global é **uma só** — não introduza nova navegação quando a estrutura existente já comporta o conteúdo.

*Porquê: dois Estilos disputando a estrutura da mesma tela dão duas maneiras de se locomover, e a pessoa nunca sabe qual está valendo.*

## Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| sidebar dentro de sidebar dentro de sidebar | cada área ganhou a sua navegação | uma navegação global, dois níveis no máximo (→ `04`) |
| tudo virou dashboard de cards | o eixo *comparar* foi ignorado | tabela quando o dado se compara (→ `03`) |
| abas usadas como se fossem menu hierárquico: 12 abas na mesma barra | o Estilo não acompanhou o crescimento | 8 ou mais áreas → Abas verticais |
| Barra de comando como única porta para as ações | atalho tratado como navegação | ela vem *além* da navegação, nunca no lugar |
