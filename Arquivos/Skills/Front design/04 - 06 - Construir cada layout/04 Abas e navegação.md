# 04 Abas e navegação

Os cinco Estilos de navegação: Abas horizontais, Abas verticais, Navegação inferior, Barra de comando e Rolagem em seções. Cada um tem os mesmos quatro subtítulos: *Quando usar*, *Regiões*, *Como se constrói*, *Cuidados*. Depois vêm as regras de «onde estou» e «voltar», que valem para todos.

## Abas horizontais

**Quando usar.** 2–7 áreas no mesmo nível, alternância frequente, estrutura rasa. É o ponto de partida quando nada indica outra coisa.

**Regiões.** Barra superior → barra de abas → barra lateral esquerda + área central + painel direito (os dois laterais são opcionais).

**Como se constrói.**
- A aba ativa é marcada por **forma** (sublinhado ou fundo) **e** peso — nunca só por cor. *Porquê: quem não distingue cor, ou usa a tela sob sol, perde a aba ativa.*
- Rótulos de 1–2 palavras.
- **Uma só linha** de abas. Se não cabe, simplifique ou mude para Abas verticais. *Porquê: várias linhas de abas destroem a memória espacial — a aba muda de lugar quando é clicada.*
- Ordem estável.
- Trocar de aba **preserva o estado** de cada uma: rolagem, filtro, texto digitado. *Porquê: quem digitou metade de um formulário e olhou outra aba não volta para um formulário vazio.*
- ← → percorrem as abas; Tab entra no conteúdo.
- Contador na aba só se for acionável («Pendências 3»); contador decorativo é ruído.

**Cuidados.** Não use abas no lugar de uma hierarquia de navegação.

## Abas verticais

**Quando usar.** 8 ou mais áreas, estrutura que cresce (20+ itens), nomes que precisam ficar sempre visíveis. Ocupa mais largura, mas a lista vertical se escaneia melhor que uma fileira.

**Regiões.** Trilho de ícones → painel da aba ativa → área central.

**Como se constrói.**
- Cada ícone tem rótulo acessível e tooltip; o tooltip nunca é o único jeito de descobrir o que ele faz. *Porquê: ícone sozinho só é claro para quem já sabe.*
- Trilho estreito, cerca de 48–56 px.
- Itens agrupados por assunto, com separador.
- Configurações e conta no fim do trilho.
- **Só o painel troca** quando o ícone muda; o trilho e a área central não mexem. *Porquê: se tudo troca junto, a pessoa perde a referência de onde está.*
- Painel de 200 a 280 px que pode recolher, deixando só o trilho.
- Ícone ativo marcado por forma.

**Cuidados.** No máximo **dois níveis** (trilho e painel) — nunca sidebar dentro de sidebar.

## Navegação inferior

**Quando usar.** Celular, com 3–5 destinos de topo.

**Regiões.** Coluna estreita → conteúdo rolável → barra de abas fixa embaixo.

**Como se constrói.**
- Rótulo sob cada ícone.
- Alvo de toque de **44×44 pt** (Material: 48 dp). *Porquê: menor que isso, o polegar erra o alvo.*
- Item ativo marcado por forma.
- Só destinos de topo; nunca ação destrutiva.
- Respeita a área segura do aparelho (barra de gestos, entalhe).

**Cuidados.** Mais de 5 destinos: o quinto vira «Mais», ou mude de estrutura. No tablet a barra vira trilho lateral (Abas verticais).

## Barra de comando

**Quando usar.** Ferramenta com muitas ações e uso de teclado.

**Regiões.** Véu sobre a tela → caixa centralizada → resultados.

**Como se constrói.**
- Abre por atalho global (Ctrl/Cmd+K).
- Resultados agrupados por tipo (ações, arquivos, configurações).
- ↑ ↓ navegam, Enter executa, Esc fecha.
- Caixa vazia mostra recentes e sugestões.
- Sem resultado, diz o que tentar («Nenhum comando com “expor”. Tente “exportar”.»).
- O atalho de cada comando aparece ao lado.
- Ao fechar, o foco volta a onde estava. *Porquê: quem perde o foco perde o lugar em que estava digitando.*

**Cuidados.** É **atalho, não a única porta**: toda ação continua tendo um lugar visível ou um menu. *Porquê: a pessoa que nunca abriu a barra não pode ficar sem acesso a nada.*

## Rolagem em seções

**Quando usar.** Página única com assuntos em sequência: site, relatório, configuração longa, formulário longo.

**Regiões.** Cabeçalho fixo → blocos empilhados.

**Como se constrói.**
- Cabeçalho fixo com âncoras para as seções.
- A seção atual é indicada.
- Cada bloco tem título e **um assunto só**.
- Texto com largura contida (→ `09`).

**Cuidados.** Não use em ferramenta de trabalho em que a pessoa compara coisas de seções distintas: ela vai ficar rolando de um lado para o outro.

## Onde estou e como volto

- **Sempre mostre onde a pessoa está**: aba ativa marcada, título da tela, trilha de navegação quando há mais de dois níveis. *Porquê: quem não sabe onde está não sabe como chegar onde quer.*
- **«Voltar» faz exatamente o que o rótulo diz** e devolve à tela anterior **com o estado preservado** — rolagem, seleção, filtro. *Porquê: voltar para o topo de uma lista de 300 itens obriga a rolar tudo de novo.*
- O botão voltar do sistema ou do navegador funciona. *Porquê: é o gesto que a pessoa faz sem pensar.*
- Fechar um detalhe volta à lista **na mesma posição**.
- Nada leva a um lugar surpreendente.

## Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| aba ativa só um pouco mais escura | marcação só por cor | forma + peso |
| ao trocar de aba o formulário zera | estado não preservado | mantenha o estado de cada aba |
| «Voltar» leva à página inicial | volta imprevisível | volta ao ponto anterior, com o estado |
| duas barras laterais empilhadas | cada área ganhou sua navegação | trilho + painel, dois níveis no máximo |
| ícones sem rótulo, só tooltip | rótulo tratado como enfeite | rótulo acessível em todo ícone |
| a única forma de achar «Exportar» é a Barra de comando | atalho virou a única porta | ação também num lugar visível |
