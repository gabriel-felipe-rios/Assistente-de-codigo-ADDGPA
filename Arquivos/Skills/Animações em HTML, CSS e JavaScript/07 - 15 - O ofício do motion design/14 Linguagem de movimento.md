# 14 Linguagem de movimento

Coerência entre as animações de um mesmo produto. Abra ao criar a segunda animação de um projeto, ou ao definir o estilo dele.

## Tokens de duração e de curva

Defina uma vez e reutilize. Easing e razões de duração parecidos parecem harmônicos.

```css
:root {
  --dur-rapida: 150ms;  --dur-media: 300ms;  --dur-lenta: 500ms;   /* exemplo: escolha os do projeto */
  --ease-entra: cubic-bezier(0.05, 0.7, 0.1, 1);
  --ease-sai:   cubic-bezier(0.3, 0, 0.8, 0.15);
  --ease-move:  cubic-bezier(0.2, 0, 0, 1);
}
```

Durações 200/300/400 ms são exemplos de tokens (autores de sistemas de design); as curvas são as do Material 3.

## Curvas próprias

Não só as do CSS: a "*motion equity*" liga o movimento à marca (Val Head/Smashing).

## Documente

O porquê em alto nível e o como (tokens e exemplos).

## Consistência × variação

**Varie a intensidade pela frequência de uso, não a linguagem.**

| Fonte | Como separa |
|---|---|
| Material | tokens *spatial* × *effects*; esquemas Standard (funcional) × Expressive (*hero moments*) |
| Atlassian | componentes fundamentais rápidos e sutis; expressivo só em momentos de baixa frequência |

## Transições padrão de tela (Material 3)

*Container transform*, *shared axis*, *fade through* → `25`.

## Vocabulário: 12 princípios de UX em movimento (Willenskomer)

Easing, offset & delay, parenting, transformation, value change, masking, overlay, cloning, parallax, obscuration, dimensionality, dolly & zoom. Use como lista de vocabulário.

- **Não faça:** uma curva nova por componente; duração que não vem de token; variar a linguagem entre telas do mesmo produto.

*Porquê:* animação boa isolada não faz produto coerente.

→ Relacionados: `02`, `08`, `10`, `25`
