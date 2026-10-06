# 22 Métricas, logs e histórico

## O que é e quando usar

O que o programa registra sobre o próprio trabalho com o modelo: **quanto** (tokens, tempo, custo), **o quê** (cada chamada, cada evento), e **o que aconteceu ao longo do tempo** (o histórico). Sem isso, um programa com LLM é uma caixa que às vezes responde; com isso, o usuário sabe onde foi o tempo, o que falhou e por quê, e o que custa continuar.

Três coisas diferentes, três destinos: **métricas** somam; **logs** listam eventos; **histórico** guarda ciclos inteiros. E uma regra comum: **registrar nunca atrasa nem derruba o trabalho que está sendo registrado**.

## Como se constrói

### Métricas — o que se soma

- **Uso real de tokens por chamada** — entrada e saída, do `usage` que o servidor devolve (→ `06`) — somado por chamada, por tarefa, por sessão, por aba. É a contagem do tokenizador daquele modelo; não há como discordar dela. Um programa descartava o pedaço de `usage` sem olhar — "antes ele era descartado sem ninguém olhar".
- **Resposta sem `usage` não vira zero.** O acumulador conta prompt e resposta com o tokenizador local e **marca a chamada como contada localmente**; a tela diz quantas chamadas cada fonte cobriu. Zero falso é pior que campo ausente, porque parece resposta.
- **A conta antes de enviar** (→ `08`) fica registrada junto com o uso real depois — a diferença entre as duas é a medida de quanto a previsão acerta.
- **Tempo por chamada e por tarefa**, e um **cronômetro em tempo real** dos processos ativos na tela de métricas: o usuário vê "rodando há 4 min 12 s", não só "rodando". O cronômetro pergunta "tem alguma coisa rodando?" ao registro único de "está rodando" (→ `20`).
- **Por aba**: cada área do programa acumula as suas (entrada, saída, tempo, chamadas), e a tela de métricas mostra a tabela por aba — é onde se descobre que uma rotina gasta mais que o chat. Quem chama sem informar a aba continua funcionando; só não contribui com a contagem medida.
- **Cobertura por agente**: do total de itens, quantos cada rotina já processou, quantos reaproveitou, quantos falharam. "Terminar e ter feito tudo não são a mesma coisa."
- **A falha conta no progresso e na cobertura:** o item que falhou é um item processado, com erro. Sem contá-lo, a barra trava antes do fim e a cobertura nunca chega a 100 %.
- **Número que o programa não sabe fica declarado** — como estimativa ("~") ou vazio, com o motivo ("sem uso do servidor nesta chamada"). Uma linha adivinhada contamina todas as outras da mesma soma.
- **A contagem roda em segundo plano**; nunca atrasa a resposta.
- **Zerar com confirmação**, e a tela diz o que vai ser zerado — e zerar métricas não zera dados (são pastas diferentes, → `18`).

### Logs — o que se lista

- **Log por tipo de evento**, com uma lista fechada de tipos — gravou, reaproveitou, duplicata, JSON ruim, cortada, sem resposta, estourou a entrada, parado, pausou sozinha — e, para cada tipo, **ícone, cor e mensagem padrão** num dicionário só. A tela filtra por tipo, e o usuário lê "12 cortadas" sem ler 12 linhas. Tipo fora da lista é erro de programação, não linha sem cor.
- **O envio do log é assíncrono e não bloqueia o fluxo se falhar.** Um log que não conseguiu gravar não pode derrubar a chamada que ele estava registrando; falha de log é engolida (e contada, num contador próprio).
- **Uma linha por item que se perdeu, não por tentativa.** Com três tentativas de correção, o log conta o mesmo fracasso três vezes e a noite inteira vira só isso. Loga-se **quando as tentativas acabam**, uma vez, com o começo da resposta junto — senão não dá para ver o que veio. O evento fica pendurado no erro e quem loga é quem desiste.
- **"O modelo nem respondeu" e "o modelo errou" são eventos diferentes** — um se resolve ligando o servidor, o outro mexendo no prompt — e o tempo até desistir vai junto, porque é ele que diz se foi recusa imediata ou espera longa.
- **"Cortada" e "JSON inválido" são eventos diferentes** (→ `10`): se aparecerem com a mesma mensagem, quem investiga vai atrás do prompt errado.
- **Parada pedida pelo usuário não é falha do modelo, e não vira linha de log de erro.**
- **Log de chamadas ao modelo agrupado por rodada**: cada rodada com as chamadas dela, para o usuário abrir uma e ver o que foi perguntado, o que voltou, quantos tokens, quanto tempo, qual fonte (local ou externa).
- **Log incremental na tela**: chega conforme acontece, sem recarregar; a tela mantém o histórico da sessão e o **limite de exibição** é configurável — o resto está no arquivo. O log só pinta na tela se a sessão aberta for a dona do evento (→ `12`).
- **Log com o raciocínio inteiro.** O que se limpa na entrega (→ `06`) se guarda no log; é lá que se descobre por que o modelo respondeu o que respondeu.
- **Erro por item, nunca por lote.** Um arquivo que falhou aparece com o nome; "3 erros" sem nome não ajuda ninguém. E **erros de todas as rotinas normalizados num lugar só**: uma lista, um formato, com o tipo e a frase certa por tipo (→ `10`), e a distinção entre "um item falhou" e "a garantia caiu para todos".
- **O corpo do erro do servidor vai inteiro para o log** (o corte curto é para a tela). Num erro de recusa, o corpo é o motivo. Exceção: cabeçalhos de autenticação nunca (→ `07`).
- **A mensagem do usuário aparece primeiro no log da sessão**, antes da resposta — a ordem do log é a ordem do que aconteceu.

### Histórico — o que se guarda no tempo

- **Um evento por linha, em arquivo de linhas (JSONL), com rotação por ciclos inteiros.** Um ciclo de automação é uma linha: quando, o que rodou, quantos processou, quantos reaproveitou, quantos erros. A rotação guarda os últimos N ciclos **inteiros**: cortar por tamanho parte um ciclo ao meio, e o histórico passa a **mentir** — um ciclo que parece ter rodado três rotinas rodou doze. O histórico mora **fora das pastas que o "Limpar" apaga**.
- **Cada ciclo mostra as contagens no próprio item da lista** — "12 rotinas · 3 dispensadas · 1 com erro" —, e o ciclo que não terminou tem tarja diferente.
- **Não registrar uma linha por item reaproveitado.** Um programa fazia isso; eram 90 % do arquivo, todas dizendo a mesma coisa. A conta ("802 reaproveitados") vai para o resumo do ciclo; a lista completa fica no resumo da rotina, onde cabe.
- **O relógio do histórico bate num ponto só** — o único por onde toda rotina passa ao começar (o ciclo, a base, o botão avulso) — e não nos três lugares que chamam esse ponto.
- **O histórico de cada tarefa fica com a tarefa** (→ `13`); o histórico de cada sessão fica com a sessão (→ `12`). O histórico geral só liga os pontos.
- **Histórico em rodadas** para o gerador criativo: cada rodada com o pedido, as variações e a escolha, navegável (→ `01`).
- **O ciclo manual de revisão grava o seu registro** ("revisado em X, mudou Y") — é histórico, não log (→ `15`).
- **O histórico de análises de duplicatas** é o que explica "por que estes dois foram fundidos" (→ `17`).

### O que não se registra

- **Credencial, nunca** (→ `07`).
- **O conteúdo do usuário em log de erro** além do necessário para reproduzir — o log é para diagnosticar, não para arquivar conversas (isso é a sessão).
- **Uma linha por tentativa, uma linha por item reaproveitado, uma linha por poll** — ruído que enterra o que importa.

### Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| a barra de tokens não bate com o servidor | `usage` descartado | uso real da resposta |
| "0 tokens" numa chamada que rodou | resposta sem `usage` virou zero | contar localmente e marcar |
| o log de uma noite é só "sem resposta" | uma linha por tentativa | uma linha ao desistir |
| quem investiga mexe no prompt quando o problema era tamanho | cortada e inválida com a mesma mensagem | eventos diferentes |
| o log de uma sessão mostra a resposta de outra | evento sem dono | pinta só se a sessão for a dona |
| o histórico tem 90 % de linhas iguais | uma por item reaproveitado | a conta no resumo |
| "0 reaproveitados" numa passada que reaproveitou tudo | dois nomes para a conta | um nome |
| uma linha vermelha quando o usuário parou | parada logada como erro | parada não é erro |
| a chamada demorou por causa do log | log síncrono | assíncrono, sem bloquear |
| o log derrubou a chamada | exceção do log propagada | engolir e contar |

### Checklist ao construir

- [ ] Toda chamada registra tokens reais do `usage`, e a que não tem `usage` é contada localmente e marcada?
- [ ] Há métricas por aba, cobertura por agente, e cronômetro dos processos ativos, tudo em segundo plano?
- [ ] O log tem lista fechada de tipos, com ícone, cor e mensagem num dicionário só?
- [ ] O envio do log é assíncrono, engole falha e conta?
- [ ] Uma linha por item perdido (ao desistir), com o começo da resposta; "nem respondeu" ≠ "errou" ≠ "cortada"?
- [ ] O log de chamadas é agrupado por rodada, incremental, e só pinta na sessão dona?
- [ ] Erros de todas as rotinas estão num lugar só, por item, com a frase por tipo?
- [ ] O histórico é JSONL com rotação por ciclos inteiros, um evento por ciclo, com as contagens no item, sem linha por item reaproveitado, com o relógio num ponto só?
- [ ] Nada de credencial, nada de conteúdo do usuário além do necessário?

## O que a tela mostra

- **Tela de métricas:** tabela por aba (entrada, saída, tempo, chamadas — e quantas com uso real × contado localmente); o cronômetro dos processos ativos; cobertura por agente; zerar com confirmação, dizendo o que zera.
- **Log** com filtro por tipo, os ícones e cores por tipo, o limite de exibição e "ver tudo"; o log de chamadas agrupado por rodada, cada uma abrindo o detalhe; a mensagem do usuário primeiro.
- **Erros** num lugar só, por item, com tipo e frase — e um link para o item.
- **Histórico** de ciclos, uma linha por ciclo, com "quantos reaproveitou" ao lado de "quantos processou".
- **Na barra de tokens**, o uso real depois do envio (→ `08`).

## O que fica salvo e configurável

- **Salvo (→ `18`):** as métricas acumuladas por aba; o log por sessão e por tarefa; o histórico em linhas com rotação; os erros normalizados; o contador de falhas de log.
- **Configurável (→ `21`):** o limite de exibição do log; quantos ciclos o histórico guarda; quais tipos de evento aparecem por padrão; zerar métricas (com confirmação).
