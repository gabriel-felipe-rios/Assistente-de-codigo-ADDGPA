# 08 Conferir

*Abra este arquivo no passo 6, ao terminar: prova que funcionou, lista os erros comuns e diz o que relatar ao usuário.*

## Roteiro de conferência

1. `python Workshop/observar/analisador.py --json` roda sem erro e lista os fluxos esperados.
2. `python Workshop/observar/analisador.py --conferir` — resolva o que ele listar:
   - `marcas_sem_ponto`: renomeie o `ponto=` da marca para o id que aparece em `--json`;
   - `pontos_sem_marca`: marque o ponto ou aceite que ele não apareça nos Logs;
   - `modelo_fora_de_fluxo` e `fluxos_sem_descricao`: escreva a descrição que falta (arquivo 06).
3. Rode o programa uma vez, em desenvolvimento, com `OBSERVAR_TEXTO=1`, exercitando cada fluxo marcado.
4. Abra o painel: `python Observar.pyw` (abre o navegador; o processo **encerra sozinho** quando a aba é fechada). Para escolher a porta: `--porta N`; para não abrir o navegador: `--sem-navegador`.
5. Na aba **Pipeline**: todos os fluxos aparecem e os tipos batem com a realidade (senão, use `correcoes`).
6. Na aba **Logs**: existe uma execução por vez que o fluxo rodou, com tokens; abra uma chamada e veja Enviado e Resposta.
7. Ligue **Ao vivo** e dispare um fluxo: o ponto pisca.

## Erros comuns

| Sintoma | Causa | O que fazer |
|---|---|---|
| «Nenhum fluxo encontrado» | não há descrições, ou a `entrada` está errada | ver os avisos na própria tela; conferir `entrada` (arquivo 06) |
| Logs vazios | sem marcas, ou o programa não rodou, ou o caminho do rastro difere entre o emissor e o `Observar.pyw` | conferir `CAMINHO_RASTRO` (ou `OBSERVAR_RASTRO`) e `RASTRO` |
| ponto aparece como «outro» | o rastro tem um `ponto` que o desenho não conhece | o `id` da marca não bate com o `id` do desenho |
| execuções misturadas | falta `tipo="gatilho"` na entrada | acrescentar na marca da função de entrada |
| «texto não foi gravado» | faltou o interruptor | rodar com `OBSERVAR_TEXTO=1` |
| tokens com selo «local» | a resposta do modelo não traz `usage` | é normal; pode plugar um contador com `definir_contador` |
| porta ocupada | outra coisa usa a porta pedida | sem `--porta`, o `Observar.pyw` usa a primeira livre; veja a URL aberta |

## O relatório final ao usuário

Escreva curto, com:

1. **Arquivos criados** e **arquivos existentes alterados** — só os que tiveram marca, uma linha cada, com quantas linhas foram acrescentadas.
2. O aviso de que a **raiz** ganhou um segundo arquivo de arranque (`Observar.pyw`), que ele pode querer registrar onde o projeto guarda suas exceções.
3. Como abrir o painel.
4. Como ligar o texto (`OBSERVAR_TEXTO=1`).
5. Como remover tudo (arquivo 07).

**Nenhum outro arquivo do projeto deve constar como alterado.** Se constar, algo saiu do combinado: reverta.
