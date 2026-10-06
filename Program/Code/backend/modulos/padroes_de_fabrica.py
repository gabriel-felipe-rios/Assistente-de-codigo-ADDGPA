"""Os valores que o programa usa quando o usuário ainda não escolheu outro.

"Padrão de fábrica" é o número ou endereço que vale enquanto ninguém mexeu na
configuração. Antes daqui existir, cada um deles estava escrito à mão no ponto
de uso: `'http://localhost:1234'` aparecia em doze arquivos do backend e em
mais três da tela, e o `4` do paralelismo em seis. Mudar um padrão era caçar
todas as cópias e torcer para não esquecer nenhuma.

Mora num módulo irmão de `constantes.py`, e não dentro dele, pelo mesmo motivo
que `caminhos.py`: `constantes.py` guarda ONDE as coisas do programa ficam, e
isto aqui é outro assunto — QUANTO/QUAL valor elas assumem por padrão. O
reexport lá (`from .padroes_de_fabrica import *`) é o que mantém
`from .constantes import *` funcionando em todo o backend sem alteração
nenhuma nos consumidores.

⚠️ Padrão de fábrica NÃO é o valor em uso. Quem lê o valor em uso lê a
configuração (`settings.json`, `limites.json`) e cai AQUI só quando não há nada
gravado. Trocar um número daqui não muda a escolha de quem já configurou.

⚠️ A tela tem a cópia dela em `frontend/modulos/constantes.js`. Os dois lados
não conversam em tempo de execução — o frontend não importa Python —, então os
valores que aparecem nos dois estão marcados lá com o nome do irmão daqui. Ao
mudar um deles, mude os dois.
"""

# ── LM Studio ────────────────────────────────────────────────────────────────
# O endereço onde o LM Studio escuta na instalação padrão dele. O usuário pode
# trocar em Configurações; isto é só o ponto de partida.
ENDERECO_PADRAO_DO_LM_STUDIO = 'http://localhost:1234'

# O SDK da OpenAI exige uma chave de API, e o LM Studio (que fala o mesmo
# protocolo) aceita qualquer uma e a ignora. Este valor fixo é o que o próprio
# LM Studio sugere na documentação dele — não é segredo e não sai da máquina.
CHAVE_DA_API_DO_LM_STUDIO = 'lm-studio'

# O sufixo que transforma o endereço do LM Studio na URL da API compatível com
# a OpenAI. Quem monta cliente não escreve isto: chama `llm_cliente.py`.
SUFIXO_DA_API_COMPATIVEL = '/v1'


# ── Paralelismo das rotinas com modelo ───────────────────────────────────────
# Quantas chamadas a Documentação Técnica, o Resumo de Pastas, o Glossário e a
# Pipeline fazem ao mesmo tempo. O teto não é estético: cada linha de paralelismo é
# uma chamada simultânea ao LM Studio, e passar do que a máquina aguenta faz as
# respostas degradarem em vez de acelerarem.
PARALELISMO_PADRAO  = 4
PARALELISMO_MAXIMO  = 8
PARALELISMO_MINIMO  = 1


# ── Limites em tokens ────────────────────────────────────────────────────────
# Quanto o modelo pode devolver numa chamada — vira o `max_tokens` da
# requisição. É o padrão de fábrica do campo `teto_saida` de `limites.json`.
TETO_DE_SAIDA_PADRAO = 8000


# ── Ferramentas dos subagentes ───────────────────────────────────────────────
# Os tetos de cada ferramenta. Eram dezoito literais espalhados por
# `ferramentas_subagentes.py`, `embedding.py`, `glossario_indice.py`,
# `subagentes.py` e `fila/execucao.py` — invisíveis, sem tela nenhuma.
#
# ⚠️ A REGRA DA UNIDADE, e ela não é decorativa:
#
#   **byte** para o limite que protege a MÁQUINA — o que decide se vale a pena
#   abrir o arquivo. Não dá para converter em token: contar token exige ter
#   aberto o arquivo, que é exatamente o que se quer evitar.
#
#   **token** para o limite que protege a JANELA DE CONTEXTO — o que recorta o
#   que vai ao modelo. Janela se mede em token, e caractere não diz quanto de
#   janela custa: 400 linhas de CSS e 400 de Python denso não custam o mesmo.
#
#   **caractere** só onde o corte é de APRESENTAÇÃO, não de orçamento — a linha
#   do grep, que é uma amostra para o modelo se localizar.
# ── Servidor MCP ─────────────────────────────────────────────────────────────
# Os limites da categoria Configurações → "Servidor MCP". São do PROGRAMA e não
# do projeto — por isso moram em `settings.json` e não no `Workspace.json`; o
# que é por projeto (quais ferramentas estão ligadas) continua na aba
# Arquivos → MCPs.
#
# ⚠️ A REGRA DA UNIDADE vale igual à de baixo: token protege a janela de quem
# recebe, caractere só onde o corte é de apresentação. `mcp_cascata_nivel` e
# `mcp_duplicados_max_pares` não são nem um nem outro — são CONTAGEM de itens,
# e a unidade deles é o próprio item.
#
# ⚠️ Todos são lidos por `_mcp_limite`, e por mais ninguém. O ponto único
# existe pelo mesmo motivo do `_sub_limite`: valor ausente ou lixo cai no padrão
# de fábrica, nunca num número escrito à mão no ponto de uso.
PADROES_DO_MCP = {
    # ── Em TOKEN: protegem a janela do assistente externo ──
    #
    # ⚠️ ESTES DOIS SÃO O MOTIVO DE A CATEGORIA EXISTIR. Até 22/08/2026 o
    # servidor MCP pegava carona nos tetos de `PADROES_DAS_FERRAMENTAS`, que
    # foram dimensionados para o LM STUDIO LOCAL — uma janela de 8k a 32k. O
    # assistente externo tem uma janela muito maior, e recebia arquivo cortado
    # em 15 000 tokens sem nenhum motivo. Um teto do chat local não tem por que
    # governar quem nem passa pelo chat.
    #
    # ⚠️ O TETO DO `ler_arquivo` É MEDIDO SOBRE O TEXTO JÁ NUMERADO. O
    # `_ferr_ler_arquivo` monta `f'{n}: {linha}'` ANTES de cortar, e a numeração
    # custa ~+16% de tokens sobre o arquivo cru — `ferramentas_subagentes.py`
    # tem 19.632 crus e 22.827 numerados. Quem comparar este número com o
    # tamanho cru do arquivo erra por essa margem.
    #
    # ⚠️ 15 000 PARECE BAIXO, E É DE PROPÓSITO. O cliente MCP tem um teto
    # próprio, e ele foi cercado por medição: `indice_navegacao()` a 15.832
    # tokens CHEGOU inteira, e `pipeline()` a 19.369 foi RECUSADA. O teto do
    # programa precisa bater ANTES disso — senão o corte deixa de ser nosso,
    # que diz quanto ficou de fora e ensina a paginar com o parâmetro `linhas`,
    # e vira recusa seca do cliente, sem conteúdo nenhum. Seis dos 432 arquivos
    # deste projeto voltam cortados, e os seis dizem como ler o resto.
    'mcp_teto_ler_arquivo_tokens':    15000,
    # ⚠️ É ESTA LINHA QUE CONSERTA O `pipeline()` — e nada dentro do `pipeline`
    # foi tocado. `_sub_servir_partes` só devolve o índice das partes quando o
    # artefato INTEIRO passa do teto; com 20 000, o pipeline inteiro (19.369)
    # cabia, ia inteiro, e quem cortava era o cliente — contrariando a descrição
    # da própria ferramenta, que promete o índice das partes.
    #
    # ⚠️ Governa QUATRO ferramentas, não três: `pipeline`, `grafo_imports`,
    # `resumo_pastas` e `indice_navegacao` — esta última desde que o handler
    # dela deixou de ler o `.md` cru. Quem quiser a árvore inteira do índice de
    # navegação numa chamada só põe 16000 aqui: fica acima dos 15.497 tokens do
    # índice e ainda abaixo dos 19.369 do pipeline, que continua paginado.
    'mcp_teto_parte_tokens':          12000,
    # Quanto de um termo do glossário vai na resposta.
    # ⚠️ Era `mcp_glossario_chars`, em CARACTERE, e estava errado: a regra da
    # unidade diz que caractere só vale onde o corte é de APRESENTAÇÃO — a linha
    # do grep, que é amostra. Aqui o corte é de ORÇAMENTO: o que se recorta é o
    # que vai para dentro da janela de quem pergunta.
    'mcp_glossario_tokens':            2000,
    # O trecho de cada candidato da busca semântica. Era `[:120]` em caractere,
    # e pelo mesmo motivo virou token — é o gêmeo de
    # `busca_semantica_excerpt_tokens`, na categoria dos subagentes.
    #
    # ⚠️ NÃO CONFUNDIR COM OS DOIS 512 DO PROJETO — são três coisas diferentes,
    # e os outros dois lados já trazem esta ressalva; faltava a terceira:
    #   `pedaco_tokens` (Configurações → Rotinas, 512) — de que tamanho o texto
    #       é cortado ANTES de ir ao modelo de embedding;
    #   `embedding_truncar_tokens` (Ferramentas dos subagentes, 512) — quanto o
    #       modelo chega a VER de um texto que já chegou nele;
    #   este (Configurações → Servidor MCP) — quanto do pedaço aparece no
    #       PREVIEW da resposta do MCP.
    # Era 50, e o preview vinha cortado no meio da frase. A amostra existe para
    # o assistente decidir se vale abrir o candidato, e meia frase não decide.
    'mcp_busca_semantica_excerpt_tokens': 150,

    # ── Em CONTAGEM DE ITENS: a unidade é o próprio item ──
    # Quão fundo a cascata do `relacoes_uso` desce. Era `3` cravado dentro do
    # antigo `ferramentas_mcp.py` (hoje `server/assistente/ferramentas.py`),
    # sem tela nenhuma.
    'mcp_cascata_nivel':              3,
    # Quantos candidatos a `busca_semantica` traz. Era `8`, cravado na mesma
    # linha em que a fonte também estava cravada.
    'mcp_busca_semantica_candidatos': 8,
    # Quantos pares o `duplicados` devolve numa resposta.
    'mcp_duplicados_max_pares':      50,
    # Quantos símbolos o `onde_esta` lista. Era `[:40]`.
    'mcp_onde_esta_max_simbolos':    40,
    # Quantos arquivos o `arquivos_grandes` lista. Era `[:40]`.
    'mcp_arquivos_grandes_max':      40,
    # O `io` corta em dois eixos, e os dois eram cravados: `files[:20]` e
    # `entries[:30]`. Um arquivo de I/O denso estoura os dois.
    'mcp_io_max_arquivos':           20,
    'mcp_io_max_operacoes':          30,
    #
    # ⚠️ MESMO MOTIVO DOS DOIS TETOS EM TOKEN LÁ DE CIMA. O `grep` e o
    # `listar_pasta` do MCP pegavam carona nos limites da categoria "Ferramentas
    # dos subagentes", dimensionados para a janela do LM STUDIO LOCAL, e o
    # assistente externo recebia amostra apertada sem motivo nenhum. Cada leitor
    # tem o limite dele: `_sub_limite` para o chat local, `_mcp_limite` aqui.
    #
    # Dimensionamento: `grep("TODO")` deu 110 ocorrências em 38 arquivos — com
    # 150/40 aquele resultado cabe inteiro. No pior caso, 150 linhas × 200
    # caracteres ≈ 9.000 tokens, com folga contra o teto medido do cliente.
    'mcp_grep_max_ocorrencias':     150,
    'mcp_grep_max_arquivos':         40,
    # ⚠️ Este corta SÓ a listagem da raiz, que no MCP são as pastas de trabalho
    # do projeto — três itens neste aqui. Ele praticamente nunca bate: entra por
    # simetria com o de baixo, não por necessidade. Não vale calibrar.
    'mcp_listar_pasta_primeiro_nivel': 40,
    'mcp_listar_pasta_max_itens':   200,

    # ── Em CARACTERE: corte de apresentação ──
    # A regra da unidade, a mesma que `PADROES_DAS_FERRAMENTAS` repete: caractere
    # só vale onde o corte é de APRESENTAÇÃO, nunca de orçamento de janela. A
    # linha casada do grep é amostra para o modelo se localizar — não é texto que
    # ele precise ler inteiro. Por isso o glossário e o preview da busca
    # semântica, que são orçamento, ficam em TOKEN lá em cima, e só este mora
    # aqui. Gêmeo de `grep_corte_linha_chars` (120), na categoria dos subagentes.
    'mcp_grep_corte_linha_chars':   200,
}


# ── Categoria "Servidores MCP" (os de terceiro) ──────────────────────────────
# Separada de `PADROES_DO_MCP` de propósito, e as duas NÃO se juntam: aquela são
# os limites dos DOIS servidores DO PROGRAMA (quanto cada ferramenta devolve);
# esta é o que o programa faz ao LIGAR um MCP que veio de fora. Um "Restaurar
# padrão" comum devolveria vinte números calibrados junto com um caminho de
# pasta, e o usuário só queria um dos dois.
#
# ⚠️ A GRAFIA `MCPs` É OBRIGATÓRIA — M, C, P maiúsculos, s minúsculo. É o mesmo
# texto do nome da categoria na biblioteca (`Arquivos/MCPs/`) e do rótulo da
# sub-aba, e uma terceira grafia aqui faria o usuário procurar a pasta errada.
#
# ⚠️ Isto é o destino da PASTA, e não o do arquivo de registro. O do registro
# continua vindo do preset do assistente externo (`_destino_do_mcp`), porque ele
# varia: `.mcp.json` no Claude Code, `.cursor/mcp.json` no Cursor. Onde a pasta
# do servidor fica NÃO varia — o apontador guarda caminho absoluto, e nenhum
# assistente exige nada sobre isso.
PADROES_DOS_MCPS = {
    'mcps_destino_da_pasta': 'MCPs',
}


PADROES_DAS_FERRAMENTAS = {
    # Quantos subagentes e quantas rodadas
    'max_paralelo_subagentes':        4,
    'max_rodadas_ferramentas':        3,
    # Só do Verificador da Fila, e ele é o único que pode ter chave própria: as
    # listas de subagentes do Chat e da Fila são a mesma, e ele é o único que
    # existe só na Fila. Precisa de mais rodadas que os outros porque passou a
    # ser obrigado a fazer grep do identificador antes de dar um item por
    # conferido — uma busca por item, no pior caso.
    'max_rodadas_ferramentas_verificador': 5,
    'max_ferramentas_rodada':         4,
    # Quantas vezes o programa pede ao modelo que conserte o formato antes de
    # desistir. NUNCA teve tela — e é a única coisa aqui que custa uma chamada
    # a mais ao LM Studio, então é justamente a que o usuário devia poder ver.
    'max_tentativas_correcao':        2,

    # ── Em TOKEN: protegem a janela ──
    # Governa TODA ferramenta que lê arquivo: `ler_arquivo` e as de extensão (D53).
    'teto_ler_arquivo_tokens':    15000,
    # É também o teto de `ler_doc_tecnica` e `ler_resumo_pastas`, que leem por
    # seção e enchem a resposta até aqui. O teto próprio da documentação técnica
    # saiu em 2026-09: a leitura por seção não pagina mais por caractere.
    'teto_parte_tokens':           6000,
    # Era 200 caracteres, pelo mesmo motivo.
    'busca_semantica_excerpt_tokens': 50,
    # O teto da resposta que o subagente devolve ao agente principal. Vinha das
    # abas Chat e Fila, uma cópia em cada, guardado só no `localStorage`.
    'teto_resposta_subagente_tokens': 2000,
    # A truncagem do indexador de embeddings. Nunca teve tela — e é ela que
    # decide quanto de cada trecho o modelo de embedding chega a ver.
    'embedding_truncar_tokens':     512,

    # ── Em BYTE: protege a máquina ──
    # O grep não abre arquivo maior que isto. Fica em KB porque a decisão é
    # tomada ANTES de abrir — `os.path.getsize`, sem ler nada.
    'grep_max_kb':                  500,

    # ── Em CARACTERE: corte de apresentação ──
    # Quanto de cada linha casada o grep mostra. É amostra para o modelo se
    # localizar, não orçamento de janela.
    'grep_corte_linha_chars':       120,

    # ── Contagens ──
    'grep_max_ocorrencias':          50,
    'grep_max_arquivos':             20,
    'busca_semantica_top_k':          8,
    'relacoes_max_itens':            40,
    'listar_pasta_primeiro_nivel':   20,
    # Itens por listagem de pasta comum. Era a ÚNICA ferramenta de listagem sem
    # teto: `listar_pasta_primeiro_nivel` só cortava a listagem da RAIZ, e uma
    # pasta com milhares de entradas não ignoradas entrava inteira no histórico
    # do agente principal. Maior que os irmãos de propósito — uma listagem
    # truncada cedo demais faz o modelo pedir a mesma pasta de novo.
    'listar_pasta_max_itens':       100,
}


# ── A política de saída das rotinas ──────────────────────────────────────────
# Os dois interruptores de Configurações › "Modelo e contexto". Ligados de
# fábrica: são eles que consertam os arquivos estragados, e desligá-los é
# escolha consciente de quem sabe o que está fazendo.
#
# ⚠️ NÃO existe um terceiro interruptor de "retentar". Nunca vai existir: uma
# retentativa é uma CHAMADA A MAIS ao modelo, e isso está descartado desde a
# primeira rodada da discussão. Uma resposta que não serve vira erro na aba
# Erros da rotina — não uma segunda tentativa.
FORMATO_GARANTIDO_PADRAO = True
RESGATE_DA_RESPOSTA_PADRAO = True

# O cartão "Modelo e geração" de Configurações › Modelo e contexto. Com
# `usar_config_do_programa` desligado — o de fábrica — nada daqui vai na
# chamada e vale o que estiver no LM Studio. `None` nos `geracao_*` = "vale o
# do LM Studio".
PADROES_DO_MODELO_E_GERACAO = {
    'usar_config_do_programa': False,
    'modelo_escolhido': '',
    'pensamento_rotinas': False,
    'pensamento_chat': True,
    'pensamento_fila': True,
    'pensamento_subagentes': True,
    'pensamento_designer': False,
    'geracao_temperatura': None,
    'geracao_top_p': None,
    'geracao_top_k': None,
    'geracao_min_p': None,
    'geracao_repeat_penalty': None,
}


# ── Encerrar e excluir: as confirmações ─────────────────────────────────────────────
# A categoria "Encerrar e excluir" de Configurações (chave `confirmacoes`).
# Os gêmeos estão em `frontend/modulos/constantes.js`, com os mesmos nomes —
# os dois lados NÃO conversam em runtime, então mudar aqui exige mudar lá.
#
# ⚠️ Moram em `settings.json`, e NUNCA em `limites.json`: `save_limites` faz
# `max(1, int(valor))`, que transformaria `False` em `1` e a string `'nunca'`
# em erro. É a mesma armadilha dos dois interruptores acima.
#
# QUANDO perguntar: TRÊS valores, não dois — por isso é string e não booleano.
# O padrão é o do meio: perguntar só quando há trabalho de IA em curso, que é
# quando abandonar custa alguma coisa. Perguntar sempre irrita quem fecha o
# programa vinte vezes por dia; nunca perguntar joga fora a pesquisa que estava
# rodando há vinte minutos.
#
# ⚠️ Os NOMES são neutros (`QUANDO_PERGUNTAR_*`) porque a lista é UMA e serve
# a TRÊS configurações: fechar o programa, sair do projeto e fechar a aba de um
# projeto. Chamá-los de `CONFIRMAR_AO_FECHAR_*`, como nasceram, obrigaria cada
# nova a inventar a própria cópia dos mesmos três valores — e a primeira
# divergência entre as listas não daria erro nenhum, só um `settings.json` que
# a tela lê torto.
QUANDO_PERGUNTAR_NUNCA   = 'nunca'
QUANDO_PERGUNTAR_RODANDO = 'rodando'
QUANDO_PERGUNTAR_SEMPRE  = 'sempre'
QUANDO_PERGUNTAR_VALIDOS = (QUANDO_PERGUNTAR_NUNCA,
                            QUANDO_PERGUNTAR_RODANDO,
                            QUANDO_PERGUNTAR_SEMPRE)

# Os três padrões são independentes de propósito: são gestos diferentes, e um
# dia um deles pode querer outro padrão sem arrastar os outros junto.
CONFIRMAR_AO_FECHAR_PADRAO = QUANDO_PERGUNTAR_RODANDO

# Sair do projeto (o "← Projetos") com uma tarefa da Fila no meio. ⚠️ É só
# AVISO: o "Sim" sai e o "Não" fica, e nada é interrompido nos dois casos — a
# pesquisa continua rodando em segundo plano de qualquer jeito. Confundir isto
# com o fechamento do programa é o erro fácil: lá, sair mata o trabalho.
CONFIRMAR_AO_SAIR_DO_PROJETO_PADRAO = QUANDO_PERGUNTAR_RODANDO

# Fechar a ABA de um projeto (o × da tira do topbar). ⚠️ É o gesto FORTE dos
# três: diferente de "← Projetos", que só esconde a tela, fechar a aba para a
# vigilância do Detector daquele projeto e corta o que ele estiver usando da IA.
#
# ⚠️ O valor `rodando` daqui pergunta por ESTE projeto especificamente — nunca
# por causa de outra aba ocupada. Ver `fechar_projeto` em `configuracoes.py`:
# ele não passa por `_decidir_pergunta`, que olha a TRAVA_IA inteira. Fechar uma
# aba ociosa não pode perguntar só porque a aba do lado está trabalhando.
CONFIRMAR_AO_FECHAR_O_PROJETO_PADRAO = QUANDO_PERGUNTAR_RODANDO

# Uma pergunta só, e ela nasce LIGADA: o que estes botões apagam — uma conversa
# inteira, o histórico de uma pesquisa — não tem desfazer.
#
# ⚠️ A chave diz `deletar` e a TELA diz "remover". Não é descuido: a convenção
# do projeto é `deletar` no código (é o verbo de `deletar_chat` e
# `deletar_tarefa_fila`, que é o que esta configuração guarda) e "Remover" no
# texto visível. Ver `Terminologia e nomenclatura/Convenções.md`.
CONFIRMAR_AO_DELETAR_PADRAO = True

# Fechar no Editor uma aba com edição que ainda não foi para o disco. Nasce
# LIGADA pelo mesmo motivo da de cima: o que se perde não tem desfazer, e aqui
# é trabalho que a pessoa acabou de digitar.
#
# ⚠️ É booleano, e não um `quando_perguntar` de três valores. Os outros três
# olham "tem IA rodando?" para decidir; este não tem o que olhar — ou o arquivo
# tem mudança não salva, e aí perguntar é a única coisa que faz sentido, ou não
# tem, e aí não se pergunta nunca. Um "rodando" aqui não significaria nada.
CONFIRMAR_AO_FECHAR_ARQUIVO_NAO_SALVO_PADRAO = True


# ── Tema ─────────────────────────────────────────────────────────────────────
# O tema que o programa nasce usando. O gêmeo está em
# `frontend/modulos/config-tema.js` (`TEMA_PADRAO`), junto de `TEMAS_VALIDOS` —
# quem valida a escolha é a tela, quem restaura o padrão é o backend.
TEMA_PADRAO = 'ardosia'


# ── Assistentes externos: a lista única de fábrica ───────────────────────────
#
# Um ASSISTENTE EXTERNO é o programa que roda o código por fora deste aqui —
# Claude Code, Cursor, Codex/Antigravity, OpenCode, Gemini CLI. Ele responde
# três perguntas de uma vez só:
#
#   COMO É LANÇADO   `comando`, `argumentos`, `flag_nome`, `flag_prompt`,
#                    `comando_cota` — o terminal da Oficina e a barra de cota;
#   PARA ONDE VAI    o `destino` de cada categoria;
#   COMO CHEGA       `arquivo_de_entrada` e `formato` de cada categoria.
#
# ⚠️ ISTO ERA TRÊS LISTAS, e virou uma em 2026-09-02.
#
# Havia `PRESETS_PREPARAR` (para onde vai + o texto do CLAUDE.md),
# `PRESETS_ARQUIVOS` (para onde vai + como chega) e, em `trabalhos_presets.py`,
# `presets_de_produto_de_fabrica()` (como é lançado). As três casavam pelo campo
# `nome`, por string, sem verificação nenhuma — e existia aqui um comentário
# dizendo que NÃO deviam ser fundidas.
#
# Ele foi apagado junto com a separação, e o motivo é concreto: as três listas
# se dessincronizaram sozinhas. `salvar_assistentes_externos` espelhava os nomes
# de `presets_arquivos` por cima da lista de produtos, e com isso o OpenCode —
# que existia na fábrica de `trabalhos_presets.py` — SUMIU do disco do usuário,
# sobrando três cadastros de lançamento com `comando` vazio. Ninguém apagou o
# OpenCode: ele foi perdido pelo casamento por string. Recuperá-lo aqui fecha
# esse buraco, e a lista única impede que ele se abra de novo.
#
# ⛔ NENHUM `if assistente == 'X'` deve nascer daqui. Campo vazio é PULADO, não
# é erro: é isso que faz o Codex não ter MCP e o Gemini CLI não ter comandos,
# sem uma linha de código sobre nenhum dos dois.
#
# ⚠️ O destino de "Regras e instruções" NÃO é campo do assistente: ele já é fixo
# em `regras.py` (`PASTA_BASE_REGRAS`), porque a mesma pasta é lida pela aba
# Decisões e pelas ferramentas dos subagentes. Um destino por assistente criaria
# uma segunda verdade.
# ⛔ "Códigos prontos" também não tem: ela tem botão próprio de copiar.
#
# ⚠️ O TEXTO do CLAUDE.md NÃO MORA MAIS AQUI. Ele era `CONTEUDO_REGRAS_*`, três
# constantes montadas por concatenação neste módulo, e virou item da biblioteca,
# em `Arquivos/Instruções base/`. O assistente guarda só o NOME do arquivo, em
# `categorias['instrucoes-base']['arquivo_de_entrada']` — que é o que
# `arquivo_regras` era. Texto é conteúdo do usuário; código não é lugar de
# conteúdo editável.

# As categorias que um assistente externo governa. Escrita à mão, e não
# derivada de `_ARQUIVOS_FOLDER`, porque as exclusões acima são deliberadas —
# derivar faria uma categoria nova entrar aqui sozinha, sem ninguém decidir.
# Os dois campos depois do rótulo:
#   `so_destino`        — a categoria só tem "para onde", sem "com que nome" nem
#                         "como chega". Hoje só MCPs, cujo destino é um arquivo
#                         JSON de configuração, não uma pasta de itens.
#   `raiz_quando_vazio` — destino vazio quer dizer A RAIZ do projeto, e não "não
#                         copia". Hoje só Instruções base: todo assistente lê um
#                         arquivo de instruções na raiz, só muda o nome, e a
#                         alternativa era o usuário escrever `./` no campo.
CATEGORIAS_DO_ASSISTENTE = (
    #  chave              rótulo              só destino   vazio = raiz
    ('skills',          'Skills',            False,        False),
    ('comandos',        'Comandos',          False,        False),
    ('mcps',            'Servidor MCP',      True,         False),
    ('instrucoes-base', 'Instruções base',   False,        True),
    ('agentes',         'Agentes',           False,        False),
)


def _assistente(nome, skills, comandos, mcps, instrucoes_base, agentes,
                comando='', argumentos=(), flag_nome='',
                flag_prompt='--append-system-prompt', comando_cota='',
                flag_agente='', flag_prompt_arquivo=''):
    """Monta um assistente externo, para as cinco entradas abaixo ficarem
    legíveis lado a lado em vez de 60 linhas de dicionário repetido.

    ⚠️ Não confundir com `ArquivosMixin._preset_arquivos` (`arquivos.py`), que é
    outra coisa: aquele ESCOLHE um assistente pelo nome; este CONSTRÓI um. Eram
    homônimos até 2026-09-02, e um find/replace global corrompia os dois.
    """
    return {
        'nome': nome,
        # Como é lançado (o terminal da Oficina, a execução de agente, a cota).
        'comando': comando,
        'argumentos': list(argumentos),
        'flag_nome': flag_nome,
        'flag_prompt': flag_prompt,
        # ⚠️ SÃO DUAS FLAGS DE PROMPT, E ELAS NÃO SÃO INTERCAMBIÁVEIS.
        # `flag_prompt` recebe o TEXTO do prompt; `flag_prompt_arquivo` recebe
        # o CAMINHO de um arquivo com ele. Dar um caminho para a primeira não
        # dá erro nenhum — o assistente recebe a string do caminho como se
        # fosse a instrução, e roda sem as regras que deveria ter.
        #
        # No Claude Code a segunda é `--append-system-prompt-file`, que É
        # ACEITA mas NÃO APARECE no `--help` (verificado na CLI 2.1.258: com um
        # caminho inexistente ela responde `Append system prompt file not
        # found`). Produto que não tiver a dela deixa vazio, e aí o terminal
        # abre sem o prompt de papel em vez de abrir com um lixo dentro.
        'flag_prompt_arquivo': flag_prompt_arquivo,
        # A flag que faz a SESSÃO SER o agente — no Claude Code, `--agent`.
        # ⚠️ E ela é tranca de verdade: medido na CLI 2.1.258, uma sessão
        # lançada com um agente que declara `tools: [Read, Grep]` responde ter
        # exatamente essas duas ferramentas. O `tools:` do `.md` limita a
        # sessão do terminal, e não só o subagente interno.
        'flag_agente': flag_agente,
        'comando_cota': comando_cota,
        # Para onde vai, e como chega.
        'categorias': {
            'skills':          skills,
            'comandos':        comandos,
            'mcps':            mcps,
            'instrucoes-base': instrucoes_base,
            'agentes':         agentes,
        },
    }


def _cat(destino, arquivo_de_entrada='', formato='pasta'):
    return {'destino': destino, 'arquivo_de_entrada': arquivo_de_entrada, 'formato': formato}


ASSISTENTES_EXTERNOS = [
    _assistente(
        'Claude Code',
        comando='claude', flag_nome='--name', flag_prompt='--append-system-prompt',
        flag_prompt_arquivo='--append-system-prompt-file', flag_agente='--agent',
        skills=_cat('.claude/skills/', 'SKILL.md', 'pasta'),
        # Solto, e não pasta: `.claude/commands/` não descobre NADA dentro de
        # subpasta — não vira namespace, simplesmente não aparece.
        comandos=_cat('.claude/commands/', '', 'solto'),
        mcps=_cat('.mcp.json'),
        # Destino vazio = A RAIZ do projeto (`raiz_quando_vazio` na tabela
        # acima). O que muda de assistente para assistente é o NOME do arquivo,
        # e é ele que mora em `arquivo_de_entrada`.
        instrucoes_base=_cat('', 'CLAUDE.md', 'solto'),
        agentes=_cat('.claude/agents/', '', 'solto'),
    ),
    _assistente(
        'Cursor',
        # `comando` vazio é RASCUNHO LEGÍTIMO, não erro: o assistente aparece na
        # lista e governa a cópia de arquivos, mas não abre terminal enquanto o
        # usuário não disser com que comando. Ver `_trab_validar_produto`.
        # Skills e subagentes chegaram no Cursor 2.4 (conferido na
        # documentação em 2026-09-21: `.cursor/skills/<nome>/SKILL.md` e
        # `.cursor/agents/<nome>.md`). Até então os dois campos ficavam vazios.
        skills=_cat('.cursor/skills/', 'SKILL.md', 'pasta'),
        comandos=_cat('.cursor/commands/', '', 'solto'),
        mcps=_cat('.cursor/mcp.json'),
        instrucoes_base=_cat('', 'AGENTS.md', 'solto'),
        agentes=_cat('.cursor/agents/', '', 'solto'),
    ),
    _assistente(
        'Codex / Antigravity',
        skills=_cat('.agents/skills/', 'SKILL.md', 'pasta'),
        comandos=_cat('.agents/workflows/', '', 'solto'),
        # Vazio, e não `.codex/config.toml`: o registro que este programa faz é
        # em JSON, e o Codex guarda MCP em TOML. Escrever um JSON com esse nome
        # daria um arquivo que o Codex não lê — pior que não escrever nada.
        mcps=_cat(''),
        instrucoes_base=_cat('', 'AGENTS.md', 'solto'),
        agentes=_cat('', '', 'solto'),
    ),
    _assistente(
        'OpenCode',
        comando='opencode', flag_nome='', flag_prompt='--system-prompt',
        skills=_cat('.opencode/skills/', 'SKILL.md', 'pasta'),
        # ⚠️ O ÚNICO com comandos em `pasta`, e não é engano: o OpenCode
        # transforma subpasta em namespace (`/team/review`). "Corrigir" para
        # solto achataria a organização que ele espera.
        comandos=_cat('.opencode/commands/', '', 'pasta'),
        mcps=_cat(''),
        instrucoes_base=_cat('', 'AGENTS.md', 'solto'),
        agentes=_cat('', '', 'solto'),
    ),
    _assistente(
        'Gemini CLI',
        # `comando` vazio de propósito: as flags de prompt e de nome do Gemini
        # CLI não foram conferidas contra a versão que o usuário tem instalada,
        # e um comando de fábrica errado falha na hora de abrir o terminal, sem
        # o usuário saber que o errado veio daqui. Rascunho é mais honesto.
        skills=_cat('.gemini/skills/', 'SKILL.md', 'pasta'),
        comandos=_cat('', '', 'solto'),
        mcps=_cat(''),
        instrucoes_base=_cat('', 'AGENTS.md', 'solto'),
        agentes=_cat('', '', 'solto'),
    ),
]

ASSISTENTE_EXTERNO_PADRAO = 'Claude Code'


# ── Inícios rápidos de fábrica ───────────────────────────────────────────────
#
# Um INÍCIO RÁPIDO é o molde que um projeto novo recebe de uma vez: QUAIS itens
# da biblioteca vão, e QUE PASTAS nascem junto, já marcadas. Ele aponta para um
# assistente externo, e é de lá que sai o "para onde vai" — o início rápido não
# repete destino nenhum.
#
# ⚠️ Isto era `PRESETS_PREPARAR`, e a palavra "preset" saiu da tela inteira: o
# objeto se chama Início rápido, aqui e no `Vocabulário.md`.
#
# ⚠️ NENHUM deles traz `itens`, e isso é de propósito. `itens` é a lista do que
# o início rápido copia da biblioteca, item por item — e a biblioteca é do
# usuário: escrever nomes de pasta aqui apodreceria na primeira vez que ele
# renomeasse uma skill. Início rápido sem `itens` é preenchido uma vez por
# `_preparar_normalizar` (arquivos.py) com tudo que estiver marcado
# **Do programa**, que é como estes sempre se comportaram. A partir daí a lista
# é do usuário, e a marca não manda mais nela.
#
# Início rápido NOVO, criado pelo botão da tela, é outra história: nasce com as
# seis listas vazias — nada marcado — porque ali o usuário monta o molde dele.
# As categorias que um INICIO RAPIDO copia. SEIS, e nao as cinco do assistente:
# aqui entra tambem "Regras e instrucoes", que o assistente externo nao governa
# (o destino dela e fixo em `regras.py`) mas que o inicio rapido escolhe item a
# item, como as outras.
#
# ⚠️ ISTO NAO E `_ARQUIVOS_COM_ORIGEM`, que continua com QUATRO. Aquela diz quem
# tem a marca Do programa / Gerais; esta diz o que o inicio rapido copia. Sao
# duas perguntas diferentes, e `instrucoes-base` e `agentes` entraram na segunda
# sem entrar na primeira (D11).
#
# O terceiro campo:
#   `escolha_unica` — a categoria aceita UM item, nao varios. Hoje so Instrucoes
#                     base: o destino dela e a raiz do projeto, e dois itens
#                     marcados copiariam para o mesmo caminho, o segundo por
#                     cima do primeiro, sem aviso. E o campo que faz a tela
#                     desenhar radio em vez de checkbox, sem nenhum `if` por
#                     nome de categoria.
CATEGORIAS_DO_INICIO_RAPIDO = (
    #  chave                rotulo                   escolha unica
    ('skills',            'Skills',                  False),
    ('comandos',          'Comandos',                False),
    ('mcps',              'Servidores MCP',          False),
    ('regras-instrucoes', 'Regras e instrucoes',     False),
    ('instrucoes-base',   'Instrucoes base',         True),
    ('agentes',           'Agentes',                 False),
)


INICIOS_RAPIDOS = [
    {'nome': 'Claude Code',         'assistente': 'Claude Code',
     'pastas_raiz': [], 'pasta_trabalho': '', 'pastas_trabalho': []},
    {'nome': 'Cursor',              'assistente': 'Cursor',
     'pastas_raiz': [], 'pasta_trabalho': '', 'pastas_trabalho': []},
    {'nome': 'Codex / Antigravity', 'assistente': 'Codex / Antigravity',
     'pastas_raiz': [], 'pasta_trabalho': '', 'pastas_trabalho': []},
    {'nome': 'OpenCode',            'assistente': 'OpenCode',
     'pastas_raiz': [], 'pasta_trabalho': '', 'pastas_trabalho': []},
    {'nome': 'Gemini CLI',          'assistente': 'Gemini CLI',
     'pastas_raiz': [], 'pasta_trabalho': '', 'pastas_trabalho': []},
]

INICIO_RAPIDO_PADRAO = 'Claude Code'


# O preset de fábrica da aba Acervo (Configurações → Acervo): as 3 pastas que
# a aba sempre mostrou, antes da Obra 6 trocar por presets nomeados. Um
# projeto NASCE SEM preset escolhido (D-Acervo, discussão "Nome do programa e
# os dois servidores MCP" retomada) — isto só existe para o usuário ter algo
# pronto pra escolher, e para o "Restaurar padrão" da categoria.
ACERVO_PRESETS = [
    {'nome': 'Padrão', 'pastas': [
        {'titulo': 'Regras e instruções', 'caminho': 'Saída das skills/Regras e instruções', 'editavel': True},
        {'titulo': 'Saída das skills', 'caminho': 'Saída das skills', 'editavel': False},
        {'titulo': 'Saída dos comandos', 'caminho': 'Saída dos comandos', 'editavel': False},
    ]},
]


# O teto de contexto que o Antigravity dá ao arquivo de regras. Passar disto só
# gera AVISO na pré-visualização — nunca corte. Cortar mutilaria as regras do
# usuário em silêncio, que é pior do que um arquivo grande demais (D37).
TETO_AVISO_ARQUIVO_REGRAS = 12000


# ── Notificações ──────────────────────────────────────────────────────────────
#
# As três preferências da categoria "Notificações" da aba Configurações. Entram
# no `_SETTINGS_DEFAULTS` por `**PADROES_DAS_NOTIFICACOES`, pelo mesmo caminho
# de `PADROES_DO_MCP` — é isso que faz o "Restaurar padrão" da categoria
# funcionar sem uma linha de código própria.
#
# A posição segue o sistema `<vertical>-<horizontal>` nos NOVE casos, inclusive
# o centro da tela (`meio-centro`). O rótulo na tela é "Centro da tela", mas a
# chave não abre exceção: um nome irregular no meio de nove obrigaria um `if`
# especial em toda leitura, e a classe CSS sai da chave por concatenação
# (`.app-toast-ancora--` + posição).
#
# Tudo ligado de fábrica. É o comportamento que o programa sempre teve, e uma
# instalação nova não pode calar um aviso que o usuário nunca pediu para calar.
PADROES_DAS_NOTIFICACOES = {
    'notificacoes_posicao': 'inferior-direita',
    'notificacoes_tamanho': 'media',
    # origem → 'tudo' | 'erros' | 'nada'. Dicionário, e não lista de objetos,
    # porque a leitura em tempo de execução é uma consulta por notificação
    # (`origens[origem]`) — ver `frontend/modulos/notificacoes.js`.
    'notificacoes_origens': {
        'projetos': 'tudo',
        'arquivos': 'tudo',
        'configuracoes': 'tudo',
        'chat': 'tudo',
        'fila': 'tudo',
        'designer': 'tudo',
        'pipeline': 'tudo',
        'automacao': 'tudo',
        'decisoes': 'tudo',
        'documentacao': 'tudo',
        'terminal': 'tudo',
        'backups': 'tudo',
        'inspetor': 'tudo',
        'aparencia': 'tudo',
        'mapas': 'tudo',
    },
}


# ── Configurações › Arquivos (chave `biblioteca`) ─────────────────────────────
#
# Como o programa reconhece o PRINCIPAL de uma skill — o `.md` que vira
# `SKILL.md` na cópia. Era regra fixa em `_arquivo_principal_do_item` (pelo
# `description:` do cabeçalho), e virou escolha do usuário em 2026-09-21
# ("depende da pessoa que for mexer"). Só de Skills: as outras categorias têm
# forma fixa (comando é arquivo solto, regra tem o nome da pasta, agente e
# instrução base são o próprio arquivo).
#
# Mesmo caminho de `PADROES_DAS_NOTIFICACOES`: `**` em `_SETTINGS_DEFAULTS` e
# `tuple(...)` em `_PADROES_POR_CATEGORIA` fazem o "Restaurar padrão" funcionar
# sem código próprio.
#
# ⚠️ A chave da categoria é `biblioteca`, e NÃO `arquivos`: `arquivos` é a
# chave de "Assistentes externos" em três lugares sem verificação.
PRINCIPAL_SKILL_NOME_DA_PASTA = 'nome-da-pasta'   # o .md cujo slug é o da pasta
PRINCIPAL_SKILL_NOME_FIXO = 'nome-fixo'           # o .md chamado `biblioteca_nome_fixo`
PRINCIPAL_SKILL_DESCRIPTION = 'description'       # o único com `description:`
EMPATE_SKILL_RECUSAR = 'recusar'                  # não copia e avisa
EMPATE_SKILL_PRIMEIRO = 'primeiro'                # o primeiro em ordem alfabética

PADROES_DA_BIBLIOTECA = {
    'biblioteca_principal_skill': PRINCIPAL_SKILL_NOME_DA_PASTA,
    'biblioteca_nome_fixo': 'SKILL.md',
    'biblioteca_empate': EMPATE_SKILL_RECUSAR,
}


# ── Aba Editor ───────────────────────────────────────────────────────────────
# O que a categoria "Editor" de Configurações mexe. Um dicionário só, pelo mesmo
# motivo de `PADROES_DAS_NOTIFICACOES`: o `**` em `_SETTINGS_DEFAULTS` e o
# `tuple(...)` em `_PADROES_POR_CATEGORIA` fazem o "Restaurar padrão" funcionar
# sem código próprio, e acrescentar uma opção nova vira uma linha aqui.
#
# ⚠️ As cinco chaves `editor_hist_*` moram AQUI, no settings.json global, e não
# no `Editor/Configuração.json` de cada projeto — onde nasceram. A mudança é de
# 30/08/2026, por decisão do usuário: uma categoria de Configurações com um
# "Salvar" gravando em dois lugares, e um "Restaurar padrão" que só enxerga
# metade, confunde mais do que a flexibilidade de afinar projeto a projeto
# valia. O arquivo por projeto deixou de ser lido; se existir, é ignorado.
#
# ⚠️ Os três números de métrica (fonte, entrelinha, tabulação) TÊM GÊMEO no
# frontend, em `modulos/editor-metricas.js` (`_EDM_LIMITES`) — lá eles são o
# grampo contra um settings.json corrompido, aqui são o valor de fábrica.
# Mudar um sem o outro deixa a tela aceitando o que o backend não devolve.
PADROES_DO_EDITOR = {
    # Quais botões aparecem na barra de cada painel. Todos ligados: é o
    # comportamento que a aba sempre teve, e uma instalação nova não pode
    # esconder um botão que o usuário nunca pediu para esconder.
    'editor_botao_salvar':    True,
    'editor_botao_historico': True,
    'editor_botao_buscar':    True,
    'editor_botao_desfazer':  True,

    # Métrica do texto. `editor_fonte_px` é float de propósito — 12.5 é o valor
    # que a superfície sempre teve, e arredondar para 12 ou 13 mudaria o
    # espaçamento de quem nunca mexeu na configuração.
    'editor_fonte_px':   12.5,
    'editor_entrelinha': 1.65,
    'editor_tabulacao':  4,
    'editor_quebrar_linha': False,

    # Acima disto o arquivo abre sem cor. Ver `editor-pintura.js`: Prism é
    # tokenizador por regex e não tem modo incremental.
    'editor_teto_linhas_cor': 3000,

    # Histórico local — a cópia do conteúdo anterior a cada Ctrl+S.
    'editor_hist_ligado':      True,
    'editor_hist_entradas':    20,
    'editor_hist_dias':        30,
    'editor_hist_mb':          100,
    'editor_hist_so_se_mudou': True,
    'editor_hist_diff':        True,

    # Ajudas visuais no código (Obra 10-13 da discussão "Aba do editor").
    # Todas ligadas: mesmo critério das quatro primeiras acima — nada some
    # numa instalação nova que o usuário não pediu pra esconder.
    'editor_minimapa':      True,
    'editor_breadcrumb':    True,
    'editor_caminho_barra': True,
    'editor_lint_sintaxe':  True,
}


# ── Acesso rápido ────────────────────────────────────────────────────────────
#
# As preferências da categoria "Acesso rápido" de Configurações — a barra
# que abre por tecla em qualquer aba. Entram no `_SETTINGS_DEFAULTS` por
# `**PADROES_DO_ACESSO_RAPIDO`, pelo mesmo caminho de `PADROES_DAS_NOTIFICACOES`
# — é isso que faz o "Restaurar padrão" da categoria funcionar sem uma linha de
# código própria.
#
# ⚠️ São DOIS dicionários, e não um, porque são DUAS categorias na tela. Um só
# faria o "Restaurar padrão" do Acesso rápido apagar, de quebra, as teclas que o
# usuário escolheu na categoria Teclado.
PADROES_DO_ACESSO_RAPIDO = {
    # Os cinco modos de busca da barra, na ordem em que aparecem. Lista de
    # OBJETOS, e não uma lista só dos modos ligados, porque a ordem é do
    # usuário: um modo desligado continua na lista, no lugar em que estava. Com
    # a lista curta, desligar um modo o apagaria da ordem e religá-lo o jogaria
    # para o fim — o usuário perderia uma arrumação que fez à mão sem ter pedido
    # nada disso.
    #
    # Todos ligados de fábrica, pelo mesmo critério das notificações: uma
    # instalação nova não esconde um modo que ninguém pediu para esconder.
    'acesso_rapido_modos': [
        {'chave': 'comando',   'ligado': True},
        {'chave': 'aba',       'ligado': True},
        {'chave': 'nome',      'ligado': True},
        {'chave': 'conteudo',  'ligado': True},
        {'chave': 'semantico', 'ligado': True},
    ],

    # Onde a barra aparece e que tamanho tem. Mesmo vocabulário das
    # notificações — `<vertical>-<horizontal>` nos nove casos, e os mesmos três
    # tamanhos —, porque é a mesma pergunta feita duas vezes no programa; a tela
    # REUSA as listas de `frontend/modulos/notificacoes.js` em vez de copiá-las.
    'acesso_rapido_posicao': 'superior-centro',
    'acesso_rapido_tamanho': 'media',

    # Quantos resultados a barra mostra por modo.
    'acesso_rapido_resultados': 20,

    # Esconder a fila de botões de modo enquanto nada foi digitado.
    'acesso_rapido_esconder_modos': True,

    # Como o VS Code escreve "Python: Run file": o dono na frente do item.
    # Três interruptores, pedidos pelo usuário em 06/09/2026 — "qualquer coisa
    # eu ligo e desligo o que eu não gostar" —, todos ligados de fábrica.
    #   - um comando vindo de extensão sai "Nome da extensão: comando";
    #   - uma sub-aba sai "Trabalhos: Oficina", com a aba de cima na frente;
    #   - no menu de contexto, um título com o nome da extensão acima dos
    #     itens dela (a chave é do menu, mas mora nesta categoria porque é o
    #     mesmo assunto: de quem é cada item).
    'acesso_rapido_prefixo_extensao': True,
    'acesso_rapido_prefixo_aba': True,
    'menu_contexto_titulo_extensao': True,
}

# Os últimos itens escolhidos, que a barra de Acesso rápido mostra antes da
# primeira letra. Nasce vazia porque é histórico de uso, não preferência: não
# há "valor de fábrica" para o que o usuário ainda não fez.
#
# ⚠️ Dicionário À PARTE, e não dentro de `PADROES_DO_ACESSO_RAPIDO`: o
# "Restaurar padrão" da categoria restaura TODA chave daquele dicionário, e
# até 23/09/2026 apagava o histórico junto com a posição da barra. Mora em
# `acesso-rapido-recentes.json`.
PADROES_DO_HISTORICO = {
    'acesso_rapido_recentes': [],
}


# ── Teclado ──────────────────────────────────────────────────────────────────
# A categoria "Teclado" de Configurações, onde se troca a tecla de um comando.
# Dicionário próprio, e não uma chave dentro do de cima, pelo motivo explicado
# lá: são duas categorias, e cada "Restaurar padrão" tem que parar na sua.
PADROES_DO_TECLADO = {
    # SÓ o que o usuário trocou — nunca a tabela inteira. Gravar aqui as teclas
    # de fábrica congelaria o padrão: mudá-lo numa versão futura não chegaria a
    # quem já abriu a tela uma vez, porque o `settings.json` dele sobrescreveria
    # o novo valor. Quem sabe a tecla de fábrica de cada comando é o registro
    # central do frontend (`modulos/teclas.js`); isto aqui é a camada de cima, e
    # vazio quer dizer "nada foi trocado".
    'teclas': {},
}
