# Subagentes normativos

Quatro subagentes que leem as bases de `Saída das skills/` do projeto aberto e dizem o que ele já decidiu: o **Instrutor** (Regras e instruções), o **Endereçador** (Arquitetura modular), o **Padronizador** (Padrões de interface) e o **Terminólogo** (Terminologia e nomenclatura).

## O que ela acrescenta

| Peça | O quê |
|---|---|
| 4 subagentes | no grupo «De extensões» das sub-abas Subagentes do Chat e da Fila; cada um liga e desliga ali, e o bloco dele entra no prompt só com ele ligado |
| a ferramenta `ler_base` | lê um arquivo de uma base; os quatro a usam, e ela é **emprestada ao Verificador da Fila** enquanto a extensão está ligada |
| trechos de prompt | no Chat e na Fila (quando chamar cada um, e o índice de cada base), no Verificador (como usar a `ler_base`) e nos prompts fixos Revisar, Segurança e Melhorias |
| envelope | cada subagente recebe, junto da pergunta, `[ARQUIVOS DA BASE — …]` |

Os limites (paralelo, rodadas, ferramentas por rodada, teto de leitura, teto da resposta) são os de todo subagente, em Configurações › Programa › Ferramentas dos subagentes. A página desta extensão só os mostra.

## O que ela lê fora da pasta de trabalho

`Saída das skills/`, na pasta **raiz** do projeto aberto — só leitura (`le_fora` no manifesto). O programa base, sem ela, só lê a pasta de trabalho.

## Desligada, ou apagada

O Chat, a Fila e o Verificador funcionam do mesmo jeito, sem os quatro e sem citar as bases; o Verificador confere só pelo código.

## Os ids

`norm.instrutor` (era `orientador`), `norm.enderecador` (era `organizador`), `norm.padronizador` e `norm.terminologo`. O liga/desliga que você tinha salvo com os ids antigos passa para os novos na primeira vez que a tela vê a extensão ligada (`antes` no manifesto).
