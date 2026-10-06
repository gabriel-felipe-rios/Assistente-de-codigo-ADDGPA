# 14 Checklist final

Este é o **único checklist** da skill. Percorra-o antes de entregar; cada item é de sim ou não, e um «não» é uma correção a fazer.

## O checklist

**Estrutura**
- [ ] A navegação corresponde à arquitetura do produto?
- [ ] O Estilo foi escolhido pela tarefa (→ `02`)?
- [ ] Só existe uma navegação global?
- [ ] Há hierarquia clara?
- [ ] As abas irmãs do mesmo produto seguem a mesma estrutura (→ `09`)?

**Informação**
- [ ] Cada dado tem a forma da pergunta que responde (→ `03`)?
- [ ] O que é importante está visível — nada só em tooltip?
- [ ] Há algo competindo com o dado?

**Estados e interação**
- [ ] Vazio, carregando, erro, parcial, offline e sem permissão foram desenhados (→ `08`)?
- [ ] Todo clique responde em cerca de 100 ms?
- [ ] Ação reversível tem «Desfazer»?
- [ ] Há só uma ação primária por região?
- [ ] Cada controle está encostado no objeto que afeta (→ `07`)?
- [ ] Nenhuma prévia ou controle repetido que um seletor resolveria?

**Visual**
- [ ] Hierarquia por tamanho e peso?
- [ ] Espaço em múltiplos de 4 px e uma densidade só (→ `09`)?
- [ ] Sobrou bloco vazio ao lado de conteúdo (→ `09`)?
- [ ] Blocos do mesmo papel têm o mesmo tamanho, e controles da mesma linha a mesma altura?
- [ ] A tela de trabalho cabe na altura da janela, com rolagem só nas regiões internas?
- [ ] Nenhum texto cortado com espaço livre ao lado?
- [ ] Contraste de 4,5 : 1 no texto?
- [ ] Alvos de 32×32 (mouse) ou 44×44 (toque)?
- [ ] Números alinhados à direita?
- [ ] Nada decorativo sem função (→ `13`)?

**Textos**
- [ ] O botão diz o que vai acontecer?
- [ ] O erro diz o que houve e como corrigir?
- [ ] A tela vazia convida a agir (→ `07`)?

**Plataforma**
- [ ] As regras da camada certa foram aplicadas (→ `10`)?
- [ ] Sobrevive a uma largura estreita?
- [ ] Nada essencial fica só no hover?

**Conteúdo real**
- [ ] Testei com nome de 60 caracteres, item sem valor, muitos itens e nenhum?
- [ ] O significado nunca vai só na cor?
- [ ] A animação é interrompível e respeita reduzir movimento?

**Aparência**
- [ ] Paleta, tipografia, textura e animação são as do usuário, e não as minhas (→ `11`)?
- [ ] Sem paleta, os papéis estão em escala neutra?

## Olhar o resultado antes de entregar

Quando você tem como abrir um navegador:

1. abra a tela e **capture**;
2. teste em **Full HD (1920×1080)**, a referência do Computador, e em **1366×768**; teste também **estreita** (uns 375 px) só se a camada for Celular ou Site;
3. teste com dado longo, com dado vazio e navegando por teclado — o Tab mostra o foco?;
4. faça a **conferência de espaço e tamanho** olhando a captura:
   - sobrou bloco vazio ao lado de conteúdo?
   - blocos do mesmo papel têm o mesmo tamanho?
   - o botão está encostado no objeto que afeta?
   - há texto cortado com espaço livre ao lado?
   - a tela cabe na altura, ou a página rola por pilha de blocos?
5. **aperte os olhos** (ou desfoque a captura): o foco principal continua claro e o que é do mesmo grupo parece do mesmo grupo?
6. se puder medir no navegador, compare a largura e a altura dos blocos irmãos e a altura dos controles da mesma linha (diferença acima de 1 px é sinal para olhar), e veja se algum bloco vaza do contêiner;
7. corrija o que aparecer e olhe de novo.

**Sem como abrir um navegador:** confira lendo o código contra os itens acima — larguras fixas pequenas, blocos que empilham em vez de ficar lado a lado, `max-width` que deixa a coluna sozinha — e escreva na linha final que a tela não foi vista.

*Porquê: quem não vê o que fez não avalia o próprio trabalho — corte, sobreposição e rolagem dupla só aparecem renderizados.*

## Antes de responder

Feche com a **linha final** «**Assumi:** …» (→ `front-design.md` §6): só o que foi assumido, sem pergunta.

## Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| entregou sem abrir a tela | sem verificação | o passo «Olhar o resultado antes de entregar» |
| só conferiu em 1280 px e a tela de 1920 tem metade vazia | testou numa largura que não é a da pessoa | Full HD é a referência |
| a linha final termina com pergunta | confundiu informar com pedir aprovação | ela só informa |
| a IA marcou o checklist inteiro «sim» sem conferir | percorreu por hábito | cada «sim» é uma coisa que você olhou |
