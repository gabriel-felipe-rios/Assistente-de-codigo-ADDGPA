# 25 Transição entre telas e páginas

Transição entre telas ou páginas. Abra ao trocar de tela, rota ou estado grande do DOM.

## View Transitions, mesmo documento

Baseline "newly available" em 14/10/2025.

```js
if (document.startViewTransition) document.startViewTransition(() => atualizarDOM());
else atualizarDOM();
```

```css
::view-transition-old(root), ::view-transition-new(root) { animation-duration: 300ms; }
```

Use `view-transition-name` em elementos que persistem (compartilhados).

## Entre documentos (páginas)

Chrome/Edge 126+, Safari 18.2+; **Firefox não**. Opt-in por CSS: `@view-transition { navigation: auto }` *(sintaxe do autor; não pesquisada nesta rodada — testar na sua versão)*. Reserva: navegação normal.

## Compartilhe só o que importa

Em transições, só "os elementos mais importantes" são compartilhados (Material, Atlassian): um herói por transição.

## Padrões do Material 3

| Padrão | Quando |
|---|---|
| **container transform** | um elemento vira a tela seguinte |
| **shared axis** | mesma relação espacial (x, y ou z) |
| **fade through** | sem relação entre as telas: sai, depois entra |

Escolha pelo tipo de relação entre as telas.

## Duração

Troca de tela 200–300 ms (NN/g); transições expressivas 300–700 ms com curva *emphasized* (M3); curva de entrada em `08`. Direção coerente com a navegação: avançar entra pela direita, voltar pelo lado oposto *(convenção)*.

## Reduzir movimento

Troque deslize por dissolver (→ `41`).

- **Não faça:** transição longa que bloqueia a navegação; animar layout entre telas; nada compartilhado (a tela "pula").

*Porquê:* transição entre telas é um dos tipos de animação cobertos pela skill.

→ Relacionados: `01`, `08`, `14`, `41`
