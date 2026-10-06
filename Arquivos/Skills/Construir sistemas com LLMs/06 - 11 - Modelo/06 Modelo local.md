# 06 Modelo local

## O que é e quando usar

A ligação entre o programa e o modelo que roda na máquina do usuário. Tudo o que encosta no modelo passa por aqui — e por **um** lugar só. É a peça que se constrói primeiro e se mexe menos; quando ela está certa, as outras não precisam saber onde o modelo mora nem como ele fala. E é a peça em que os erros são mais silenciosos: uma resposta cortada gravada como inteira, um stream que continua gerando depois do Parar, um `usage` descartado — nada disso dá erro na tela.

Há **dois caminhos**, e a skill não escolhe por você nem nomeia runtime:

| Caminho | O que é | O que muda |
|---|---|---|
| **Servidor local** | um programa à parte serve o modelo por uma API compatível com a de chat mais comum (endereço, porta, chave de fábrica) | o programa **pergunta** ao servidor o que está carregado; o servidor gerencia janela, cache e fila de requisições |
| **Modelo embutido** | os pesos do modelo ficam numa pasta do programa e um runtime os carrega dentro do processo | não há a quem perguntar: o programa **é** o servidor — janela, cache, fila e a própria conta de tokens são responsabilidade dele |

Exemplo do segundo: um programa que embute quatro modelos pequenos (embedding, reconhecimento de entidades, classificação, descoberta de tópicos) numa pasta própria de binários externos, e os carrega uma vez só, quando são pedidos — o carregamento leva segundos, e o programa mostra isso. O modelo de linguagem grande fica no servidor local; os pequenos, embutidos — é a combinação mais comum, e cada um segue o caminho dele.

## Como se constrói

### O cliente

- **Um cliente só, com endereço e chave de fábrica num lugar só.** Nenhum módulo monta a URL do servidor à mão, e nenhum faz a chamada de rede por fora do cliente. Porquê: com o endereço espalhado, trocar a porta ou o servidor vira caça a texto, e um módulo esquecido fala com um servidor que não existe mais. Um programa descobriu, ao concentrar, que tinha uma segunda chamada "simples" solta — sem orçamento, sem log, sem `usage` e sem retentativa.
- **Perguntar ao servidor qual modelo está carregado e qual a janela de contexto.** O valor salvo em configuração é **reserva**, para quando o servidor está fora. Porquê: o usuário troca o modelo no servidor sem avisar o programa; um orçamento calculado para a janela do modelo anterior estoura no atual. A API nativa do servidor distingue "carregado" de "baixado" — só o carregado conta.
- **O campo "modelo" pode ficar vazio, e vazio significa "o que estiver carregado".** Porquê: um valor de fábrica não deve sobrescrever a escolha que o usuário fez no servidor.
- **Três modos de ter o modelo, e cada um custa uma coisa.** Decida qual o programa oferece — pode ser mais de um, com uma chave:

  | Modo | O que o programa faz | O que custa |
  |---|---|---|
  | **usar o que está carregado** | pergunta ao servidor e usa | nada a configurar; o usuário troca de modelo no servidor e o programa segue — por isso o modelo é **perguntado a cada ciclo, não guardado** |
  | **escolher no programa** | manda o nome do modelo no pedido; o servidor carrega sob demanda, se souber fazer isso | o programa precisa listar o que existe; o nome escolhido pode não estar baixado; uma chave "quem manda" liga e desliga a escolha |
  | **carregar pelo programa** | manda carregar e descarregar pela API do servidor, com os parâmetros de carga (janela, camadas) | o programa vira dono da memória da máquina: espera o carregamento, mostra o tempo, e não descarrega o que outro programa está usando |

  O padrão é o primeiro; os outros são opção. Em qualquer modo, **a janela e a capacidade de pensar são lidas do servidor**, não deduzidas do nome do modelo.
- **A janela é relida quando o modelo muda**, não só quando a tela de configuração abre. Um programa fixava o modelo no envio e só atualizava a janela gravada ao abrir a configuração: o portão passava a usar a janela de um modelo anterior e deixava passar o que não cabia — ou segurava o que caberia.
- **A conexão é anotada com o dono** (a sessão, o projeto, a tarefa). Fechar a aba dona derruba a conexão junto — inclusive a chamada que ainda não chegou ao primeiro pedaço e por isso não passa pelo laço cooperativo de parada.
- **Modelo local fora do ar: nada roda, e a tela diz isso com clareza.** Não troque de servidor nem de provedor sozinho: um programa local que cai para a nuvem sem perguntar manda o conteúdo do usuário para fora. E **"o servidor não responde" e "servidor de pé, nenhum modelo carregado" são duas frases diferentes** — um programa dizia "nenhum modelo carregado" quando, na verdade, nada escutava na porta, e o usuário procurava no lugar errado. As conferências antes de cada chamada, na ordem: → `19`.

### A chamada

- **Parâmetros de geração: quem manda é uma chave.** Temperatura, amostragem, penalidade de repetição — ou o servidor decide (o programa **não manda** nenhum, e vale o que o usuário configurou lá), ou o programa decide (manda os dele). **Campo vazio = vale o do servidor**, também campo a campo. Porquê: mandar sempre os de fábrica do programa passa por cima do que o usuário calibrou no servidor, sem ele saber. O programa não precisa ler os do servidor — basta deixar de mandar os dele.
- **O nível de pensamento só vai a modelo que pensa.** A capacidade é lida do servidor; mandar o parâmetro a um modelo que não pensa dá recusa, ou é ignorado em silêncio. E o nível é **por área**: o chat pode querer mais pensamento que uma rotina de lote.
- **Streaming com uso real.** A resposta chega em pedaços, e o **último pedaço traz a contagem real de tokens** de entrada e saída — peça-o explicitamente. Porquê: depois do envio esse número vale mais que qualquer conta; um programa descartava esse pedaço sem olhar, e mostrava barra de tokens inventada. Cuidado de implementação: o pedaço de uso chega com a lista de escolhas vazia — sem uma guarda, o acesso ao primeiro item derruba a resposta já pronta.
- **O que já chegou fica acessível de fora enquanto o stream roda.** É o que a gravação de emergência do fechamento precisa para não perder o pedaço já pago (→ `18`). Custo: uma atribuição por pedaço.
- **Parar fecha o stream.** Sair do laço de leitura não basta: sem fechar a conexão, o servidor continua gerando do outro lado e a janela fica ocupada com um texto que ninguém vai ler — que é exatamente o que "Parar" existe para evitar. O que já chegou é devolvido e gravado como parcial, com a marca de parcial; sem a marca, o pedaço vira balão de resposta normal ao reabrir, e a conversa passa a afirmar que o modelo respondeu aquilo por inteiro.
- **Parar tem dois estágios, e cada forma escolhe o padrão.** O primeiro termina a rodada em voo e não pede a próxima; o segundo corta agora. Com gente esperando a resposta (o chat), cortar no meio é aceitável; numa pesquisa longa (a fila), o primeiro clique nunca joga fora uma rodada já paga.
- **Erro não é descartar.** O texto que já chegou antes de uma falha foi pago: fica na tela e no histórico, marcado como parcial, com o aviso do erro embaixo.
- **O cancelamento é um sinal que chega a todas as chamadas em voo.** Um agente principal dispara quatro subagentes de uma vez; o Parar que só alcança o da frente deixa três rodando. Com chamadas por HTTP, um sinal de aborto faz a requisição rejeitar e o servidor larga a geração em vez de terminá-la para ninguém.
- **A bandeira de parada zera na largada de cada envio** — um Parar clicado no envio anterior mataria este antes de ele começar — **e limpa em qualquer saída**, inclusive erro.
- **Retentar só o que vale retentar.** **Conexão recusada, tempo esgotado e servidor ocupado ou fora (502, 503, 504)** retentam, com espera crescente e teto — duas tentativas a mais, com 8 s e 16 s de espera, é a referência; a espera confere a parada a cada segundo, e a tela diz "tentativa 2 de 3 · de novo em 8 s". **Erro interno do servidor (500) e recusa (4xx) nunca**: o mesmo pedido volta com o mesmo erro, e repetir só queima chamada; idem estouro de entrada e parada do usuário. E a retentativa cobre a **chamada**: um programa tinha retentativa só em volta do parse do JSON, e a falha de rede estourava na primeira. A tabela completa — de quem é a culpa, se retenta, para onde vai — está no `19`.
- **A retentativa escondida da biblioteca cliente fica desligada.** Muitas bibliotecas de cliente repetem sozinhas, em silêncio. Com a do programa por cima, cada "tentativa" que a tela mostra esconde três, e o tempo até desistir triplica sem explicação. Retentativa, uma só: a do programa.
- **"O modelo nem respondeu" é evento diferente de "o modelo errou".** Um se resolve ligando o servidor; o outro, mexendo no prompt. O log precisa distinguir, e o tempo até desistir vai junto — é ele que diz se foi recusa imediata ou espera longa. O corpo do erro do servidor vai inteiro para o log: num 4xx ele é o motivo.
- **Dois relógios, e eles não se confundem.** (1) **Sem sinal de vida:** quanto tempo sem chegar nenhum pedaço da resposta até desistir — **renova a cada pedaço**. É o que pega o servidor que trava no meio de uma geração (um parou em 244 tokens e não saiu dali; sem relógio nenhum, a fila ficou parada para sempre). (2) **Duração total:** quanto uma resposta pode durar ao todo — **interrompe** quando vence, mesmo com pedaços chegando. São perguntas diferentes: um modelo lento que continua escrevendo passa pelo primeiro e pode estourar o segundo. O estouro de qualquer um é erro **daquele item**, sem retentar — a segunda travaria igual. **Tarefa longa não tem limite de duração:** uma pesquisa demora o que precisar, e o freio é o contador de rodadas e voltas (→ `13`). Não confundir com a espera por rotina, que é pelo sinal de vida da rotina (→ `14`).
- **Falhas seguidas pausam a fila sozinha.** N falhas de chamada em sequência (conexão, HTTP, estouro de entrada — não JSON ruim, que tem o próprio tratamento) e a fila para com o motivo no contador. Uma fila que continua com o servidor fechado queima a lista inteira em erro sem ninguém ver.

### O que volta

- **Limpeza do raciocínio só na entrega, nunca no histórico.** Modelos locais devolvem o raciocínio junto com a resposta, em várias formas: uma tag de abertura e fechamento (com nome que varia por família de modelo — há pelo menos sete grafias em uso), canais separados no texto, ou um campo próprio na resposta. A limpeza vale para o arquivo gravado e para a resposta mostrada ao usuário; **o histórico guarda o texto cru**. Porquê: o pensamento da rodada anterior ajuda a rodada seguinte, e reescrever a mensagem quebra o reaproveitamento de cache do servidor, que casa prefixo por prefixo (→ `11`).
- **O parse roda sobre uma cópia limpa; o histórico guarda o cru.** Procurar o JSON no texto cru acha primeiro o rascunho que o modelo escreveu dentro do próprio raciocínio.
- **Resgate da resposta: a última ocorrência, não a primeira.** O modelo rascunha o formato pedido dentro do próprio raciocínio, se corrige, e entrega a versão boa — as duas saem grudadas. Ficar com a primeira entrega o rascunho. Se nenhuma âncora for encontrada, devolva o texto como está: é melhor entregar com sobra que apagar uma resposta boa que não casou com o padrão.
- **Raciocínio aberto e nunca fechado devolve vazio na limpeza.** Confira isso **antes** de tratar vazio como "sem resposta": um programa devolvia `[RESULTADO] ` seguido de nada, apresentado como sucesso, e a entrega parcial — que tinha o conteúdo real — nem chegava a ser chamada.
- **Normalizar as mensagens para o template do modelo local.** Um único `system`, na primeira posição; papéis alternados; mensagens vizinhas de mesmo papel fundidas numa só; campos extras (metadados do programa) tirados antes de enviar. Porquê: os templates de conversa dos modelos locais exigem isso, e o prompt fixo, as regras e a mensagem do usuário entram todos como `user` — sem a fusão, viram três `user` seguidos e o servidor recusa ou o modelo se perde. Faça isso **num lugar só**, para o chat e para a fila montarem as mensagens do mesmo jeito (a fila também produz `user` seguidos: aviso do contador, devolução do Verificador, complemento do usuário).
- **O caso comum é a marca de fechamento órfã.** Muitos templates já abrem o raciocínio antes de o modelo escrever, e a resposta chega só com a marca de fechamento. A limpeza trata "fechamento sem abertura" como "tudo antes dele é raciocínio". Em modelos que escrevem em canais, fique com o **último** canal final. E raciocínio que vem num campo separado pode estar num campo extra do objeto que a biblioteca devolve — procure-o lá antes de concluir que não houve raciocínio.

### O modelo embutido

- **Carregar uma vez, quando pedido, e manter em memória** — com um cache de processo que zera se o arquivo do modelo mudar.
- **A pasta dos pesos é configuração**, e o programa mostra o caminho e o tamanho.
- **O fallback quando o modelo não está instalado** é obrigatório para modelos complementares (→ `17`) e não faz sentido para o modelo de linguagem principal — sem ele, o programa diz "sem modelo" e apaga os botões com o motivo.
- **A conta de tokens é do programa**: não há `usage` de servidor; o tokenizador do próprio modelo conta.

### Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| a barra de tokens não bate com a do servidor | o `usage` do último pedaço é descartado | pedir e ler o pedaço de uso |
| o programa "travou" depois do Parar, e o próximo envio demora | o stream não foi fechado; o servidor continua gerando | Parar fecha o stream |
| três subagentes continuam depois do Parar | o sinal só alcançou o da frente | cancelamento chega a todas as chamadas em voo |
| a resposta aparece inteira na conversa, mas acabou no meio | parcial gravado sem marca | gravar o parcial com a marca de parcial |
| o modelo responde como se um pedaço do contexto não existisse | um bloco falhou ao montar e o erro foi engolido | nunca `except: pass` na montagem; o modelo e o log sabem que o bloco não foi |
| a janela de contexto "diminuiu" sozinha | o usuário trocou o modelo no servidor | perguntar ao servidor, não confiar no salvo |
| o servidor recusa com "papéis alternados" | dois `user` seguidos | fundir vizinhos de mesmo papel num lugar só |
| o mesmo defeito reaparece depois de consertado | dois blocos de código idênticos para a mesma coisa (envio e retomada) | um cliente, uma função por operação |

### Checklist ao construir

- [ ] Existe **um** módulo por onde passa toda chamada ao modelo, e nenhum `fetch`/requisição fora dele?
- [ ] O programa pergunta ao servidor o modelo e a janela, e usa o salvo só como reserva?
- [ ] O streaming pede o `usage`, guarda o que já chegou, e o Parar fecha o stream?
- [ ] O sinal de parada alcança todas as chamadas em voo, zera na largada e limpa em qualquer saída?
- [ ] Retentativa só em conexão, tempo esgotado e 502/503/504, com espera crescente e teto; 500, 4xx e parada nunca; e a da biblioteca desligada?
- [ ] "Nem respondeu" e "errou" são eventos diferentes no log?
- [ ] A limpeza do raciocínio vale só na entrega; o histórico é cru; o parse usa uma cópia limpa?
- [ ] As mensagens são normalizadas (um `system`, papéis alternados, fusão) num lugar só?
- [ ] Os dois relógios — sem sinal de vida (renova) e duração total (interrompe) — existem separados, e o estouro vira erro do item?
- [ ] Está decidido qual dos três modos de modelo o programa oferece, e quem manda nos parâmetros de geração?

## O que a tela mostra

- **Indicador do modelo carregado**, sempre visível, e "servidor fora" quando for o caso — com a janela de contexto ao lado. No embutido, "carregado em N s" e o caminho.
- **A barra de tokens** alimentada pelo uso real depois de cada envio (→ `20`).
- **Parar** onde houver geração em andamento, e o que já chegou continua na tela depois de parar, marcado como parcial.
- **"Sem resposta do servidor" ≠ "resposta inválida"** — duas frases diferentes na lista de erros.

## O que fica salvo e configurável

- **Salvo:** nada próprio desta peça — o que se grava é o histórico das conversas, e isso é de cada forma de agente (→ `18`).
- **Configurável (→ `21`):** endereço do servidor; o modo do modelo (o carregado · escolher · carregar pelo programa); modelo (vazio = o carregado); janela de contexto de reserva; os parâmetros de geração, com a chave "quem manda: o programa ou o servidor" (vazio = o do servidor); o nível de pensamento por área; os dois relógios (sem sinal de vida; duração total, 0 = sem limite); N de falhas seguidas até pausar; as esperas entre retentativas; o interruptor "Resgate da resposta". Para o modelo embutido: a pasta dos pesos e qual modelo carregar, com um botão de "carregar" que mostra o tempo que levou.
