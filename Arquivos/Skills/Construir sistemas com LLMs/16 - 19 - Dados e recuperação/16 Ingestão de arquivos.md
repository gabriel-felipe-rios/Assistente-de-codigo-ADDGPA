# 16 Ingestão de arquivos

## O que é e quando usar

O caminho de um arquivo (ou de qualquer dado) até o modelo — e da resposta até o disco. Toda vez que o programa vai "mandar arquivos ao modelo", passa por aqui: pode entrar? cabe? o modelo lê isto? precisa de preparo? e a resposta, se salva?

Não é só sobre arquivos de código. É sobre a **cadeia**: ler → filtrar → preparar → montar o prompt → enviar → conferir → gravar. Cada botão da tela que dispara essa cadeia dispara a cadeia inteira, por um único ponto (→ `14`). E cada elo da cadeia tem um dono — o programa nas pontas, o modelo no meio (→ `01`, quem dá o resultado).

## Como se constrói

### Os cinco portões

| Portão | Pergunta | O que acontece se não passa |
|---|---|---|
| 1 · Pode entrar? | extensão reconhecida? está na lista de ignorados? está no escopo? | nem abre — e diz por quê |
| 2 · Cabe? | bytes antes de abrir; tokens antes de enviar | é dividido e costurado (→ `09`); o que nem assim cabe vira aviso na lista de "grande demais" — nunca silêncio |
| 3 · O modelo lê isto? | texto, binário, imagem, vídeo, PDF… | vira ficha, passa por conversor, ou não entra |
| 4 · Precisa de preparo? | fatiar, resumir, extrair, pré-consultar | o que chega ao modelo é o que cabe e o que importa |
| 5 · E a resposta? | descartável, gravada, gravada e indexada | cada peça decide, e o parcial nunca se grava como inteiro |

### 1 · Pode entrar — nunca "qualquer arquivo"

- **Fonte única de extensões reconhecidas**, com o que cada uma é (código de qual linguagem, texto, imagem, dado). Nenhum módulo tem a sua própria lista. Porquê: com duas listas, um tipo de arquivo entra no índice e não entra no espelho, e ninguém sabe por quê. Um programa tinha uma lista para "o que conta como código" e outra para "o que tem gramática para analisar" — e as duas são coisas diferentes de propósito, mas cada uma mora num lugar só e uma cita a outra.
- **Lista de ignorados por pasta, arquivo e extensão** — dependências, caches, builds, o que o usuário tirou de propósito — com **permissão de leitura** (o que pode ser lido pelo modelo mas não indexado, e vice-versa). Configurável na tela (→ `21`), com os ignorados de fábrica visíveis e não apagáveis.
- **O recorte tem destinatário:** o que o usuário tirou pode estar tirado de ninguém, só do modelo local, só do assistente de fora, ou dos dois — e cada leitor respeita o seu (→ `04`).
- **O que está fora do escopo é recusado com o motivo**, não pulado em silêncio: "fora do escopo do projeto" é resposta; nada é ausência. Vale para o modelo também: uma ferramenta que recusa diz "recusado: fora do escopo", e o modelo não tenta outro caminho para o mesmo arquivo.
- **Lista de ignorados e escopo são do projeto, não do programa**: dois projetos abertos têm listas diferentes, e a cadeia lê a do projeto certo — a do **contexto** da chamada, não a da aba que está na tela (a fila continua rodando depois de o usuário trocar de aba).

### 2 · Cabe — tamanho antes de injetar

- **Bytes antes de abrir.** Um limite por tipo, conferido no sistema de arquivos antes de ler o conteúdo — abrir um arquivo de 200 MB para descobrir que não cabe é o erro mais caro e mais evitável. Imagem tem o seu próprio limite de bytes.
- **Tokens antes de enviar**, com a conta do `08`: o que passa do orçamento não vai pela metade — é **dividido e costurado** (→ `09`). Só o que nem dividindo cabe vira entrada na lista de "grande demais", lida na abertura do projeto, **com o tamanho e o quanto passa**, para o usuário saber se é refatorar ou aumentar a janela.
- **Arquivo vazio de verdade** (só espaço em branco) não precisa de modelo — e **arquivo só com comentários não é vazio**: pode ser conteúdo usado na interface, um prompt, uma nota. A distinção é do projeto; a regra é não gastar chamada em zero byte.
- **Linhas longas demais são um caso à parte**: um arquivo pequeno em bytes com uma linha de 50 mil caracteres (um minificado, um dado embutido) estoura a conta de tokens e a gramática. Limite de tamanho de linha entra no portão 2.

### 3 · O modelo lê isto

| Tipo | O que fazer |
|---|---|
| **texto** (código, markdown, dados legíveis) | vai direto, depois do portão 4 |
| **binário** | nunca vai; entra no índice pelo nome e pelo tamanho, se entrar |
| **imagem** | **só se o modelo tem visão** — e mesmo aí conta tokens, e muito; sem visão, vira **ficha de metadados**: um programa descreve cada imagem por cores dominantes (em famílias), dimensões e bytes, com limite de bytes e **sem OCR** — "buscar texto numa imagem é buscar pelo nome do arquivo"; o SVG vai inteiro, porque é texto e é pequeno |
| **vídeo, áudio** | não vai; passa por um conversor (transcrição, quadros) que é peça configurável, ou fica de fora |
| **PDF, planilha, documento de escritório** | um **conversor** na frente (texto, tabela), e o conversor é configurável — o modelo nunca vê o binário |
| **dado estruturado** (JSON, CSV grande) | não vai inteiro: o programa extrai o recorte (o esquema, as primeiras linhas, a coluna pedida) |

Regra: **o programa decide se manda o arquivo, a ficha ou nada** — e diz na tela qual foi, por item.

### 4 · Precisa de preparo

- **Fatiar por fronteira natural** — cabeçalho, função, bloco em branco — e a chave do pedaço é o **nome** da fronteira, nunca o número de ordem (→ `08`). O tamanho do pedaço é configuração, e é o mesmo para o modelo e para o embedding (→ `17`).
- **Resumir ou extrair** antes de mandar, quando o que importa é uma parte: os símbolos de um arquivo, a estrutura de uma pasta, o cabeçalho de um documento, as assinaturas sem os corpos. O modelo não precisa ler 4 mil linhas para responder onde uma função é definida.
- **O que entra no contexto se escolhe por seção, conforme a janela** — a síntese sempre; os símbolos se couberem; o corpo se sobrar. **O essencial não desliga**: um painel que deixa desligar todas as seções deixa o programa mandar nada ao modelo, e quebrar.
- **Pré-consulta:** antes de responder, o modelo (ou o programa) pergunta a um índice — busca por nome, busca semântica (→ `17`), grafo de usos, "quem usa X" — e só então lê o que a consulta apontou. A busca é achador; a leitura confirma. E o índice diz **a idade dele**: uma consulta a um índice velho avisa que está velho.
- **Preparar uma vez, reaproveitar depois**: o que não mudou (pelo hash) não se prepara de novo — nem se fatia, nem se resume, nem se vetoriza. A sincronia move a preparação junto quando o arquivo é movido.
- **Os tipos de RAG** (*retrieval-augmented generation* — recuperar antes de gerar), e quando cada um serve:

| Por | Recupera | Serve para |
|---|---|---|
| **trecho** | pedaços de texto parecidos com a pergunta | prosa, documentação, conversas |
| **arquivo** | arquivos inteiros relevantes | código pequeno, configuração, itens de um acervo |
| **símbolo** | funções, classes, entidades por nome ou uso | código grande, "onde X é usado", "o que chama Y" |
| **grafo** | vizinhos de um nó (dependências, pré-requisitos) | "o que quebra se eu mudar X", "o que estudar antes de Y" |

Combine: símbolo para achar, trecho para ler; grafo para saber o que mais olhar. Não mande o arquivo inteiro quando o símbolo basta.

### 5 · E a resposta

| Destino | Quando | Regra |
|---|---|---|
| **descartável** | resposta de tela, tiro único | mostra e esquece; nada vai ao disco |
| **gravada** | o produto de uma rotina, um relatório | grava só se **terminou** (→ `10`); o anterior fica intacto até o novo estar inteiro |
| **gravada e indexada** | o que vai servir à próxima pré-consulta | grava e atualiza o índice na mesma operação, ou marca "índice pendente" |

- **O que a resposta importa** decide o quanto se confere: descartável passa pelo parse; gravada passa pelo "terminou?"; gravada e indexada passa pelo Verificador.
- **Gravar o parcial como parcial, nunca como inteiro** (→ `18`).
- **A gravação vem antes do "OK" na tela**: um item marcado como pronto quando só a resposta do modelo chegou não tem como mostrar uma gravação que falhou depois (→ `01`, gerador em lote).
- **A saída derivada segue o arquivo de origem**: apagado → apaga; movido → move; e a saída é gravada sob a peça que a escreveu, com o nome que a tela usa (→ `18`).

### A cadeia, e os botões

- **Um botão dispara a cadeia inteira**, e a mesma cadeia que o ciclo automático dispara (→ `14`, "um único ponto de disparo").
- **Dados processados até chegar ao modelo**: a cadeia pode ter passos sem modelo antes do passo com modelo — contar, filtrar, fatiar, consultar o índice — e passos sem modelo depois — validar contra o conjunto real, gravar, indexar. É o caso (b) do `01`: o modelo no meio, o programa nas pontas.
- **A cadeia carrega o contexto** (projeto, categoria, sessão) do começo ao fim, e não o lê da tela no meio — a tela pode ter mudado.

### Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| um tipo de arquivo aparece no índice e não no espelho | duas listas de extensões | fonte única |
| o programa abre um arquivo de 200 MB | bytes conferidos depois de ler | bytes antes de abrir |
| um arquivo pequeno estoura a janela | linha de 50 mil caracteres | limite de linha no portão 2 |
| a imagem "não foi lida" e ninguém sabe se era para ser | decisão implícita | a tela diz: arquivo, ficha ou nada |
| o modelo responde sobre metade do arquivo | corte mudo para caber | dividir e costurar (→ `09`); o que nem assim cabe vira aviso |
| o erro de um projeto entra no log de outro | categoria/projeto lidos da tela no meio da cadeia | a cadeia carrega o contexto |
| "OK" na tela e nada no disco | OK antes de gravar | gravar, depois OK |
| a resposta sobre um arquivo velho | índice sem idade | o índice diz quando foi gerado; a ferramenta avisa |

### Checklist ao construir

- [ ] Há uma fonte única de extensões, e a lista de ignorados é por projeto, com permissão de leitura e os de fábrica visíveis?
- [ ] O que está fora do escopo é recusado com o motivo, para o usuário e para o modelo?
- [ ] Bytes antes de abrir, tokens antes de enviar, limite de linha — e a lista de grandes demais com o quanto passa?
- [ ] Para cada tipo está decidido: direto, ficha, conversor, recorte ou nada — e a tela diz qual?
- [ ] O fatiador usa a fronteira como chave, e a preparação é reaproveitada pelo hash?
- [ ] A pré-consulta é achador, e o índice diz a idade?
- [ ] Para cada resposta está decidido: descartável, gravada, ou gravada e indexada — com a conferência correspondente?
- [ ] A cadeia é uma só, disparada por um ponto, e carrega o contexto?

## O que a tela mostra

- **A lista de arquivos grandes demais**, com tamanho e o quanto passa, lida na abertura.
- **O que foi enviado, por item**: arquivo inteiro, ficha, recorte, ou nada — com o motivo.
- **Extensões e ignorados** como chips editáveis, com os de fábrica marcados (→ `21`).
- **A conta antes de enviar** (→ `08`).
- **A lista de erros por item**, quando a cadeia falha num arquivo: o nome, o portão em que parou, o motivo.
- **A idade do índice** onde houver pré-consulta.

## O que fica salvo e configurável

- **Salvo (→ `18`):** o índice (extensões, tamanhos, símbolos, fichas de imagem, a data); a lista de grandes demais; o que já foi preparado, por hash, para não repetir.
- **Configurável (→ `21`):** extensões reconhecidas por tipo; pastas, arquivos e extensões ignorados, com permissão de leitura; limites de bytes por tipo e de tamanho de linha; qual conversor para PDF, planilha, áudio; se o modelo tem visão; tamanho do pedaço ao fatiar; quantas famílias de cor por imagem.
