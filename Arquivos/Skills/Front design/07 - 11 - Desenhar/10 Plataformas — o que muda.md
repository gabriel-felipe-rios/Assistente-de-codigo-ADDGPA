# 10 Plataformas — o que muda

## O que é e quando abrir

Depois de responder as duas perguntas do índice (onde roda? ferramenta ou site? → `front-design.md` §3). **Este é o único arquivo com as regras de cada camada**; os outros dizem «no Celular…» só quando a regra é de uma peça específica.

Duas coisas diferentes: *Celular/Computador* é o **aparelho**; *ferramenta/site* é a **natureza** do produto. Um site também abre no celular, e uma ferramenta também pode ser um app de celular.

**Projete a partir do conteúdo e do espaço disponível, não só do nome do aparelho:** teste em largura estreita, média e larga.

## Computador — a base

Mouse, teclado e monitor grande.

- Cabe mais informação: a largura que sobra mostra **mais coisas ao mesmo tempo**, sem inflar fonte nem controle (→ `09`, «Ocupar o espaço»).
- **Tela de referência: Full HD (1920×1080)**, que dá uns 1920×950 úteis. Confira também em 1366×768 (notebook).
- Hover, atalhos de teclado e vários painéis fazem sentido.
- A interface tende a ser mais simples que a de um site.
- Densidade densa ou equilibrada (→ `09`).
- Alvo de clique 32×32 px.
- A janela pode ser redimensionada: projete de uns 900 px a larguras grandes.
- **Nada essencial fica só no hover.** *Porquê: quem usa teclado ou toque nunca chega lá.*

## Celular (tablet incluído)

A tela é pior de ver e o dedo é impreciso.

- **Texto e botões maiores**: corpo 16 px, entrelinha 1,5; alvo de toque **44×44 pt** (no Material, 48 dp). *Porquê: menor que isso, o polegar erra.*
- **Uma coluna.**
- Sem hover: nada existe só no hover.
- Gesto e polegar: as ações principais ficam ao alcance, embaixo.
- Pense em **vertical e horizontal**.
- O teclado virtual cobre metade da tela: o campo em uso precisa continuar visível.
- Respeite as áreas seguras do aparelho.
- Tabelas viram lista de cards ou rolagem horizontal com a primeira coluna fixa (→ `05`).
- Modal vira folha que sobe de baixo.
- Densidade equilibrada a espaçosa.
- Estilos que combinam: Navegação inferior, Lista e detalhe (em duas telas empilhadas), Foco único, Assistente em passos, Linha do tempo, Rolagem em seções. Janelas flutuantes não se usam.

**Tablet** fica no meio: pode ter Lista e detalhe lado a lado e trilho lateral, mas o toque continua sendo 44×44.

## Site

Mais recurso visual: imagem, transição, elemento gráfico. O **terreno desta skill é ferramenta e dashboard**, então site pede **outra postura**:

- densidade espaçosa;
- mais contraste de tamanho na tipografia;
- seções com respiro;
- imagem com propósito — mostra o produto ou a pessoa, não enfeita;
- movimento só onde ajuda a entender, interrompível e respeitando a preferência de reduzir movimento;
- estrutura em Rolagem em seções, com cabeçalho fixo;
- responsivo desde o início.

As regras de estados (→ `08`) e de legibilidade (→ `09`) valem do mesmo jeito; o que muda é a densidade e a dose de imagem e movimento.

*Porquê: quem visita um site está decidindo se fica; quem usa uma ferramenta já ficou e quer trabalhar.*

## Encaixado em outro programa

Extensão de navegador, plugin, painel dentro de outro programa. O espaço é pequeno e **não é seu**: painel lateral estreito, popup de tamanho fixo.

- **Herde o visual do programa hospedeiro** — cor, fonte, componentes — em vez de impor o seu. *Porquê: um corpo estranho dentro do hospedeiro parece quebrado e ignora o tema que a pessoa escolheu.*
- Uma coluna.
- Sem navegação global pesada: abas curtas ou uma lista simples.
- Respeite tema claro/escuro e os atalhos do hospedeiro.
- Rolagem dentro do painel.
- Ações raras em menu.
- Nunca abra janela por cima do hospedeiro sem necessidade.

## Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| botão de 24 px no celular | regra do computador aplicada | 44×44 |
| menu que só aparece no hover | hover não existe no toque | sempre acessível por clique ou toque |
| extensão com barra lateral própria de 250 px | impôs o layout | uma coluna que herda o hospedeiro |
| site com a densidade de um painel de controle | tratou site como ferramenta | postura de site: espaçosa, com respiro |
| tela do celular que é o layout do computador encolhido | projetou pelo nome do aparelho | teste em largura estreita e refaça pela estrutura |
