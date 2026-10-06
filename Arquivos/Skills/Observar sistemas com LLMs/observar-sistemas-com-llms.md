---
name: observar-sistemas-com-llms
description: "Instala num projeto Python que usa um modelo de linguagem um painel local que mostra os fluxos do sistema (tiro único, cadeia, ciclo, agente), onde há chamada ao modelo, os ciclos e o que rodou (execuções, erros, tokens, contagens, prompt e resposta), para o desenvolvedor entender o sistema por imagem em vez de ler código, e carrega o código pronto (emissor, painel, analisador, arranque); use quando o usuário pedir para ver, entender, depurar, observar ou visualizar o fluxo, os ciclos, as chamadas de IA, os tokens ou os logs de um sistema com LLM, em qualquer projeto, local ou por API; não use para construir o sistema com LLM em si."
---

# Observar sistemas com LLMs

## 1. O que esta skill é

Um painel local, aberto no navegador, que mostra como um sistema com LLM funciona (aba **Pipeline**) e o que ele fez quando rodou (aba **Logs**). Você, o assistente, **instala o painel copiando arquivos prontos** que estão nesta pasta. O painel desenha o fluxo sozinho lendo o código Python e mostra o que rodou lendo um arquivo de eventos (o **rastro**). Você escreve o mínimo: uma frase curta por fluxo e por ponto, e uma linha de marca por ponto que o usuário quer ver nos Logs.

| | Hoje | Depois |
|---|---|---|
| Entender o fluxo | ler código puro | ver o desenho, com os tipos de ponto e as ligações |
| Saber o que rodou | adivinhar | Logs com prompt, resposta, tokens, tempos e erros |
| Trabalho do assistente | — | copiar 4 arquivos, escrever 1 frase por fluxo/ponto, pôr 1 linha de marca por ponto |

## 2. As regras que valem sempre

1. **Copie, nunca edite a skill.** Ela é a fonte; o que vai para o projeto é cópia, e só a cópia se adapta. Assim a skill continua boa para o próximo projeto.
2. **Só estes arquivos mudam no projeto:** os novos (cópias e descrições) e as marcas mínimas dos Logs. **Nenhum outro arquivo do projeto se edita** — nem para «melhorar», nem para «registrar», nem para arrumar `.gitignore`. Detalhe no arquivo 05.
3. **Você não desenha o fluxo.** O painel lê o código e desenha; você escreve frases curtas e corrige o que a leitura errou. Gastar token desenhando é desperdício.
4. **As marcas só acrescentam** linhas; apagá-las devolve o programa ao que era. O Pipeline não precisa delas; só os Logs.
5. **Tudo local, nada de nuvem, nada de biblioteca obrigatória.** O painel não usa CDN nem internet; o código usa só a biblioteca padrão do Python.
6. **Só Python na versão atual.** Projeto em outra linguagem: diga ao usuário que não é suportado; não improvise.
7. **O painel só olha.** Não edita código, não reexecuta, não escreve nada.
8. **O texto do prompt e da resposta só é gravado com o interruptor `OBSERVAR_TEXTO=1`** (desenvolvimento), porque prompt pode conter dado do usuário.
9. **Não há servidor MCP nem programa à parte:** esta pasta leva tudo o que você precisa.

## 3. O mapa «vai fazer X → abra Y»

| Vai fazer… | Abra |
|---|---|
| instalar o painel num projeto | `05`, depois `06`, `07` e `08` |
| entender o que o painel mostra | `01` |
| saber de onde vem cada dado | `02` |
| o painel mostrou um tipo estranho (ou «outro») | `03` |
| mudar o painel ou a skill | `04` |
| conferir se funcionou e relatar ao usuário | `08` |

## 4. Os arquivos desta skill

```
Observar sistemas com LLMs/
├── observar-sistemas-com-llms.md                    este arquivo: regras e mapa
├── 01 - 04 - Como a skill funciona e se mantém/
│   ├── 01 O que o painel mostra.md                  o painel, aba por aba
│   ├── 02 De onde vem cada informação.md            código, rastro e assistente; formato do rastro
│   ├── 03 Tipos de fluxo e de ponto.md              o vocabulário fechado e as regras de inferência
│   └── 04 Como manter a skill atualizada.md         para quem mantém a skill
├── 05 - 08 - Como aplicar no projeto/
│   ├── 05 Para onde vai cada arquivo.md             destinos e o que NÃO se pode editar
│   ├── 06 Escrever as descrições.md                 a frase por fluxo e por ponto
│   ├── 07 Colocar as marcas dos Logs.md             as três marcas e o interruptor do texto
│   └── 08 Conferir.md                               roteiro, erros comuns e relatório final
└── 09 - 13 - Arquivos para copiar/
    ├── emissor.py                                   roda com o programa e grava o rastro
    ├── analisador.py                                lê o código e monta o desenho (só lê)
    ├── Observar.pyw                                 arranque e servidor local (só GET)
    ├── painel.html                                  o painel
    └── exemplo-de-descricao.json                    modelo da descrição de um fluxo
```
