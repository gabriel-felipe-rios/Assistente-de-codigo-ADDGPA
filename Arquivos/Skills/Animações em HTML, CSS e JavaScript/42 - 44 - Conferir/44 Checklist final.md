# 44 Checklist final

O **único checklist** da skill. Percorra antes de entregar: cada item é sim/não, e um "não" é correção.

## Antes

- [ ] O script de tempo foi escrito antes do código? (→ `07`)
- [ ] Respondi o que comunica, quem é o herói e qual é o secundário/ambiente? (→ `07`)
- [ ] O papel (UI funcional / autoral / ambiente) decidiu o nível? (→ `02`)
- [ ] A técnica é a mais simples que resolve, nativo antes de biblioteca? (→ `01`, `06`)

## Movimento

- [ ] Curvas: entrada ease-out, saída ease-in, tela ease-in-out, nada em `ease` padrão? (→ `08`)
- [ ] Durações vêm de tokens e batem com o papel? (→ `10`, `14`)
- [ ] Stagger irregular, total < 500 ms? (→ `11`)
- [ ] Há hierarquia: um herói, o resto apoia? (→ `12`)
- [ ] Há *anticipation*/*follow-through*/*settle* onde o papel pede? (→ `11`)
- [ ] Cada camada de riqueza tem papel; sem papel, cortei? (→ `13`)
- [ ] Nada de `transition: all`, layout animado, `scale(0)`? (→ `43`)

## Riqueza

- [ ] O momento autoral tem fundo, luz/partículas e ambiente? (→ `20`, `21`, `22`, `26`)
- [ ] Nada de blur/sombra com raio animado? (→ `22`)
- [ ] Nenhum dos 16 sinais de slop sobrou? (→ `15`)

## Tempo e desempenho

- [ ] Movimento por delta time, não por quadro? (→ `03`)
- [ ] Só `transform`/`opacity` no compositor? (→ `05`)
- [ ] Pausa fora da tela e em aba oculta? (→ `33`)
- [ ] Testei/medi no aparelho alvo? (→ `40`)
- [ ] Há reserva para recurso novo e degradação por qualidade? (→ `01`, `39`)

## Hospedeiro

- [ ] Li tamanho, dpr, visibilidade e preferências do hospedeiro; não assumi janela inteira, fundo opaco nem `:hover`? (→ `28`)
- [ ] Se transparente: `html, body` transparentes e o host configurado? (→ `29`)
- [ ] Se overlay: topo, monitor e click-through testados? (→ `30`, `31`)
- [ ] Se mobile: safe-area, dvh, `hover: none`, FPS possível? (→ `34`, `35`)

## Acessibilidade

- [ ] **Respeita `prefers-reduced-motion`**: troca por dissolver/estático e mantém o feedback? (→ `41`)
- [ ] Nada pisca mais de 3×/s? (→ `41`)
- [ ] Animação automática com mais de 5 s pode ser pausada? (→ `41`)

## Fechamento

- [ ] Onde a pesquisa não confirmou, escrevi "testar na sua versão"? (→ índice)
- [ ] A linha final "**Assumi:** …" está lá? (→ índice)

## Olhar o resultado

Quando houver como abrir um navegador, abra, dispare a animação e confira:

- o herói é legível;
- nada corta nem pisca;
- a versão "reduzir movimento" funciona.

*Porquê:* o código pode estar certo e a animação errada; só olhar mostra.

→ Relacionados: `07`, `15`, `42`, `43`
