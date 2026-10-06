# Configuração inicial — os arquivos que a skill cria quando a base não existe

Apoio da skill Padrões de interface. Só é lido quando `Saída das skills/Padrões de interface/` ainda não existe no projeto. Crie os 8 arquivos abaixo exatamente com este conteúdo e nestes caminhos, e avise o usuário que a estrutura foi criada.

Quando a pasta `Saída das skills/Padrões de interface/` não existir, crie os 8 arquivos abaixo, exatamente com este conteúdo e nestes caminhos:

### `Saída das skills/Padrões de interface/Índice geral.md`

```markdown
# Índice geral — Padrões de interface

Leia este arquivo primeiro, sempre. A partir dos resumos abaixo, decida quais documentos abrir — não leia tudo.

Ordem de prioridade ao aplicar regras: Exceções → Convenções → Componentes → Estrutura das telas → Comportamentos → Identidade visual.

### Identidade visual.md
Resumo: cores, tipografia, espaçamentos, raios, sombras, ícones e animações do projeto — a fonte única da verdade da aparência.
Palavras-chave: cor, cores, fonte, tipografia, espaçamento, padding, margem, raio, borda, sombra, ícone, animação, tema, token, variável.
Quando consultar: sempre que for definir ou aplicar qualquer valor visual no código.

### Estrutura das telas/Índice - Estrutura das telas.md
Resumo: o esqueleto de cada tela do projeto — cabeçalho, conteúdo, rodapé, modais.
Palavras-chave: tela, layout, modal, cabeçalho, rodapé, organização, esqueleto, aba, nova tela.
Quando consultar: sempre que for criar uma nova tela, aba ou modal.

### Componentes/Índice - Componentes.md
Resumo: define os padrões visuais e comportamentais de cada componente reutilizável.
Palavras-chave: botão, campo de texto, card, tabela, menu, componente.
Quando consultar: sempre que for criar ou alterar um componente de UI.

### Comportamentos/Índice - Comportamentos.md
Resumo: define como a interface reage — loading, notificações, confirmações, erros, navegação.
Palavras-chave: loading, carregamento, notificação, erro, confirmação, navegação, tempo real.
Quando consultar: sempre que for implementar uma interação ou reação da interface.

### Convenções.md
Resumo: regras gerais que valem para o projeto inteiro — o manual de estilo do time.
Palavras-chave: regra, sempre, nunca, padrão geral, convenção.
Quando consultar: sempre, antes de qualquer alteração de UI.

### Exceções.md
Resumo: regras que substituem as convenções gerais em telas ou funcionalidades específicas.
Palavras-chave: exceção, caso especial, diferente do padrão.
Quando consultar: sempre, antes de aplicar uma convenção geral — a exceção tem prioridade.
```

### `Saída das skills/Padrões de interface/Identidade visual.md`

```markdown
# Identidade visual

Fonte única da verdade da aparência do projeto. Todo valor visual usado no código deve vir de um token definido aqui — nunca use cor, fonte, espaçamento ou raio "hardcoded".

## Cores

### primary
Uso: botões principais, links, ícones ativos, destaques importantes.
Nunca usar em: fundo, texto comum.
Valor: `#___`

### secondary
Uso: ações secundárias, destaques de menor hierarquia.
Nunca usar em: fundo principal.
Valor: `#___`

### background
Uso: fundo principal da aplicação.
Nunca usar em: cards, botões.
Valor: `#___`

### surface
Uso: cards, painéis, modais, sidebars.
Valor: `#___`

### textPrimary
Uso: títulos, texto principal.
Valor: `#___`

### textSecondary
Uso: legendas, texto de apoio.
Valor: `#___`

### error / warning / success
Uso: estados de feedback (erro, alerta, sucesso).
Valores: `#___` / `#___` / `#___`

## Tipografia
(família de fonte, tamanhos por hierarquia — título, subtítulo, corpo, legenda — e pesos)

## Espaçamentos
(escala de espaçamento usada em toda a interface, ex: 4/8/16/24/32px)

## Raios de borda
(raio padrão para botões, cards, inputs)

## Sombras
(níveis de elevação/sombra disponíveis e onde usar cada um)

## Ícones
(biblioteca de ícones usada, tamanho padrão, cor padrão)

## Animações
(duração e easing padrão para transições)
```

### `Saída das skills/Padrões de interface/Convenções.md`

```markdown
# Convenções

Regras gerais que valem para o projeto inteiro. É aqui que entram as coisas que você vive repetindo para a IA.

- Nunca usar cores, fontes ou espaçamentos fixos — sempre usar os tokens de `Identidade visual.md`.
- Sempre reutilizar componentes existentes antes de criar um novo.
- Toda nova tela/aba deve seguir os mesmos padrões visuais das telas existentes (ver `Estrutura das telas/`).

<!-- Adicione novas convenções abaixo, uma por vez. Antes de adicionar, verifique se algo parecido já existe. -->
```

### `Saída das skills/Padrões de interface/Exceções.md`

```markdown
# Exceções

Regras que substituem uma convenção geral em uma tela ou funcionalidade específica. Se existe uma exceção aqui, ela sempre vence a convenção geral correspondente.

<!-- Formato sugerido:

## [Nome da tela/funcionalidade]
Exceção: o que é diferente do padrão geral.
Motivo: por que essa exceção existe.

-->
```

### `Saída das skills/Padrões de interface/Estrutura das telas/Índice - Estrutura das telas.md`

```markdown
# Índice - Estrutura das telas

Cada tela (ou tipo de skeleton, como "modal padrão") tem seu próprio arquivo nesta pasta. Ao criar uma nova, adicione uma entrada aqui.

Checklist geral para qualquer tela/aba nova, mesmo antes de existir um arquivo específico para ela:
- Reutilizar o mesmo componente-base de tela já existente.
- Manter o mesmo fundo (token `background`/`surface`, ver `Identidade visual.md`).
- Manter as mesmas margens e espaçamentos.
- Manter o mesmo header/título.

### Modal padrão.md
Resumo: estrutura padrão de um modal do projeto.
Palavras-chave: modal, popup, diálogo, confirmação, janela.
Quando consultar: sempre que for criar um modal novo.

<!-- Formato por item:

### NomeDaTela.md
Resumo: como essa tela é organizada.
Palavras-chave: termos relacionados que ajudam a achar esse arquivo.
Quando consultar: em que situação abrir este arquivo.

-->
```

### `Saída das skills/Padrões de interface/Estrutura das telas/Modal padrão.md`

```markdown
# Modal padrão

Resumo: estrutura padrão de um modal do projeto.
Palavras-chave: modal, popup, diálogo, confirmação, janela.
Quando consultar: sempre que for criar um modal novo.

## Estrutura
(título, corpo, rodapé com ações — descreva o padrão do projeto)

## Ações
(onde ficam os botões primário/secundário dentro do modal)
```

### `Saída das skills/Padrões de interface/Componentes/Índice - Componentes.md`

```markdown
# Índice - Componentes

Cada componente reutilizável tem seu próprio arquivo nesta pasta. Ao criar um novo, adicione uma entrada aqui.

<!-- Formato por item:

### NomeDoComponente.md
Resumo: o que o componente é e para que serve.
Palavras-chave: termos relacionados que ajudam a achar esse componente.
Quando consultar: em que situação abrir este arquivo.

-->
```

### `Saída das skills/Padrões de interface/Comportamentos/Índice - Comportamentos.md`

```markdown
# Índice - Comportamentos

Cada comportamento reutilizável (loading, notificações, erros, navegação etc.) tem seu próprio arquivo nesta pasta. Ao criar um novo, adicione uma entrada aqui.

<!-- Formato por item:

### NomeDoComportamento.md
Resumo: o que esse comportamento define.
Palavras-chave: termos relacionados que ajudam a achar esse arquivo.
Quando consultar: em que situação abrir este arquivo.

-->
```
