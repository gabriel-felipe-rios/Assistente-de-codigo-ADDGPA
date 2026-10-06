# 04 FPS — que taxa mirar

Recomendações de taxa de quadros. Abra ao decidir se limita, se degrada ou como medir a fluidez.

## A regra que manda

O que importa é **consistência**, não o número. "Um quadro perdido pode passar despercebido, uma sequência não" (web.dev, `smoothness`). Meça a **proporção de quadros perdidos**, não o FPS bruto. Frame pacing pesa mais que a média.

## Não trave em 60

O rAF acompanha o monitor: em 144 Hz a lógica roda a 144. Escreva a animação por delta time (→ `03`) e ela vale em qualquer taxa.

## Limitar quando o alvo é menor que o monitor

Para ambiente ou economia, pule o quadro pelo **timestamp**, nunca por contagem de quadros (serve em 120/144 Hz):

```js
const alvo = 30, passo = 1000 / alvo;
let ultimo = 0;
function quadro(agora) {
  requestAnimationFrame(quadro);
  if (agora - ultimo < passo) return;
  ultimo = agora - ((agora - ultimo) % passo);
  desenhar(); // a lógica continua usando dt real
}
requestAnimationFrame(quadro);
```

## Que taxa mirar *(convenção de ofício — testar no aparelho)*

| Taxa | Quando |
|---|---|
| **30** | ambiente lento e estável |
| **60** | padrão de UI |
| **120** | perceptível sobretudo em rolagem e arrasto |

Não há fonte oficial dizendo quando 30/60/120 bastam: trate como parâmetro.

- Se medir **~33 ms constantes**, assuma 30 fps como teto em vez de tentar "recuperar" 60 (→ `39`).

## Contextos que impõem a taxa

| Contexto | O que acontece |
|---|---|
| OBS Browser Source | vem com 30 fps se ligar "Use custom frame rate" (→ `37`) |
| iOS em Low Power Mode | limita rAF e animações CSS a 30 fps (→ `34`) |
| WKWebView no iOS | fica em 60 Hz (→ `34`) |

## A fluidez vem do que há em cada quadro

Segundo a Apple: deformação elástica e blur reduzem o *strobing*; a 60 fps a velocidade pode ser maior que a 30. Não é só subir o fps.

- **Faça:** delta time; medir quadros perdidos (→ `40`).
- **Não faça:** cravar "60 fps" no código; passo fixo por quadro; perseguir o número em vez da consistência.

*Porquê:* a IA costuma cravar 60 fps e escrever passo fixo por quadro, o que quebra em qualquer monitor diferente.

→ Relacionados: `03`, `39`, `40`
