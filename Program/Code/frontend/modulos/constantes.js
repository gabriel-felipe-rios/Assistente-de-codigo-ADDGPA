// ═══════════════════════════════════════════════════════════ CONSTANTES ══
// Os valores fixos da tela — o espelho de `backend/modulos/padroes_de_fabrica.py`.
//
// Este arquivo não existia, e por isso o endereço do LM Studio estava escrito
// à mão em quatro pontos do frontend e o `4` do paralelismo em cinco. A regra
// que passa a valer: valor de fábrica que a tela precisa conhecer mora aqui, e
// os módulos leem daqui.
//
// ⚠️ OS DOIS LADOS NÃO CONVERSAM. O frontend não importa Python, então cada
// valor abaixo tem um gêmeo em `padroes_de_fabrica.py` que precisa ser mudado
// junto. O nome do gêmeo está anotado em cada linha, de propósito: é o que
// permite achar o par sem procurar.
//
// ⚠️ Sem ES modules, como todo o frontend deste projeto: as constantes são
// declaradas no escopo global e o arquivo é carregado por <script> em
// `index.html`, logo depois de `utils.js` e antes de todos os módulos que as
// consomem. Trocar a ordem de carga quebra quem lê no topo do arquivo.

// ── LM Studio ────────────────────────────────────────────────────────────────
// Gêmeo: ENDERECO_PADRAO_DO_LM_STUDIO
const ENDERECO_PADRAO_DO_LM_STUDIO = 'http://localhost:1234';

// ── Paralelismo dos agentes de documentação ──────────────────────────────────
// Gêmeos: PARALELISMO_PADRAO / PARALELISMO_MAXIMO / PARALELISMO_MINIMO
// Alimentam os campos numéricos de Documentação Técnica e Resumo de Pastas
// — tanto o `value` do HTML quanto o fallback de quem lê o campo.
const PARALELISMO_PADRAO = 4;
const PARALELISMO_MAXIMO = 8;
const PARALELISMO_MINIMO = 1;

// ── Encerrar e excluir: as confirmações ────────────────────────────────
// Gêmeos: QUANDO_PERGUNTAR_* / CONFIRMAR_AO_*_PADRAO
// A categoria "Encerrar e excluir" de Configurações. Os valores viajam como
// string no `settings.json`, então a tela precisa dos mesmos três nomes que o
// Python usa — escrevê-los à mão no markup criaria a segunda lista de sempre.
//
// ⚠️ Os NOMES dos valores são neutros porque a lista é UMA e serve a TRÊS
// configurações: fechar o programa, sair do projeto e fechar a aba de um
// projeto. Ver o comentário longo em `padroes_de_fabrica.py`, que é o gêmeo
// deste bloco.
//
// ⚠️ A chave diz `deletar` e o texto na tela diz "remover": convenção do
// projeto (código `deletar`, interface "Remover"). Não uniformizar.
const QUANDO_PERGUNTAR_NUNCA   = 'nunca';
const QUANDO_PERGUNTAR_RODANDO = 'rodando';
const QUANDO_PERGUNTAR_SEMPRE  = 'sempre';
const CONFIRMAR_AO_FECHAR_PADRAO          = QUANDO_PERGUNTAR_RODANDO;
const CONFIRMAR_AO_SAIR_DO_PROJETO_PADRAO = QUANDO_PERGUNTAR_RODANDO;
// Fechar a ABA de um projeto (o × da tira do topbar) — o gesto FORTE dos três:
// para a vigilância daquele projeto e corta o que ele estiver usando da IA.
// Não confundir com o de cima, que só esconde a tela.
const CONFIRMAR_AO_FECHAR_O_PROJETO_PADRAO = QUANDO_PERGUNTAR_RODANDO;
const CONFIRMAR_AO_DELETAR_PADRAO         = true;
// Fechar no Editor uma aba com edição que ainda não foi para o disco. Booleano,
// e não um `quando_perguntar` de três valores: não há o que "rodando" queira
// dizer aqui — ou o arquivo tem mudança não salva, ou não tem.
const CONFIRMAR_AO_FECHAR_ARQUIVO_NAO_SALVO_PADRAO = true;

// ── Acesso rápido ────────────────────────────────────────────────────────────
// A barra que abre por tecla em qualquer aba, e a categoria de Configurações
// que a ajusta. A tela lê `appSettings.acesso_rapido_*` e cai nestes valores
// quando o usuário nunca mexeu — o `??` de cada leitura precisa de um lado
// direito, e é este.
//
// ⚠️ Padrão de fábrica NÃO é o valor em uso. Quem quer saber onde a barra está
// agora lê `appSettings`, nunca as constantes abaixo.

// Gêmeo: PADROES_DO_ACESSO_RAPIDO['acesso_rapido_modos']
// Os cinco modos, na ordem em que aparecem. Lista de objetos, e não uma lista
// só dos ligados, porque a ordem é do usuário: um modo desligado continua no
// lugar em que estava, e religá-lo não o joga para o fim da fila.
const ACESSO_RAPIDO_MODOS_PADRAO = [
  { chave: 'comando',   ligado: true },
  { chave: 'aba',       ligado: true },
  { chave: 'nome',      ligado: true },
  { chave: 'conteudo',  ligado: true },
  { chave: 'semantico', ligado: true },
];

// Gêmeo: PADROES_DO_ACESSO_RAPIDO['acesso_rapido_posicao']
// Mesmo sistema `<vertical>-<horizontal>` das notificações, nos nove casos.
// ⚠️ A lista das nove posições e a dos três tamanhos NÃO se copiam para cá:
// elas moram em `modulos/notificacoes.js` (`NOTIFICACAO_POSICOES` e
// `NOTIFICACAO_TAMANHOS`) e a tela de Acesso rápido as reusa de lá. O que mora
// aqui é o valor de fábrica, não o vocabulário.
const ACESSO_RAPIDO_POSICAO_PADRAO = 'superior-centro';

// Gêmeo: PADROES_DO_ACESSO_RAPIDO['acesso_rapido_tamanho']
const ACESSO_RAPIDO_TAMANHO_PADRAO = 'media';

// Gêmeo: PADROES_DO_ACESSO_RAPIDO['acesso_rapido_resultados']
// Quantos resultados a barra mostra por modo.
const ACESSO_RAPIDO_RESULTADOS_PADRAO = 20;

// Gêmeo: PADROES_DO_ACESSO_RAPIDO['acesso_rapido_esconder_modos']
// Esconder a fila de botões de modo enquanto nada foi digitado.
const ACESSO_RAPIDO_ESCONDER_MODOS_PADRAO = true;

// Gêmeos: PADROES_DO_ACESSO_RAPIDO['acesso_rapido_prefixo_extensao'],
// ['acesso_rapido_prefixo_aba'] e ['menu_contexto_titulo_extensao'].
// O dono na frente do item, como o "Python: Run file" do VS Code — um comando
// de extensão sai "Nome da extensão: comando", uma sub-aba sai "Trabalhos:
// Oficina", e o menu de contexto ganha um título com o nome da extensão acima
// dos itens dela. Três interruptores em Configurações › Acesso rápido.
const ACESSO_RAPIDO_PREFIXO_EXTENSAO_PADRAO = true;
const ACESSO_RAPIDO_PREFIXO_ABA_PADRAO = true;
const MENU_CONTEXTO_TITULO_EXTENSAO_PADRAO = true;

// Gêmeo: PADROES_DO_HISTORICO['acesso_rapido_recentes']
// Os últimos itens escolhidos, mostrados antes da primeira letra. Nasce vazia
// porque é histórico de uso, não preferência.
const ACESSO_RAPIDO_RECENTES_PADRAO = [];

// ── Teclado ──────────────────────────────────────────────────────────────────
// Gêmeo: PADROES_DO_TECLADO['teclas']
// SÓ o que o usuário trocou — nunca a tabela inteira. Gravar as teclas de
// fábrica no `settings.json` congelaria o padrão: mudá-lo numa versão futura
// não chegaria a quem já abriu a tela uma vez. Quem sabe a tecla de fábrica de
// cada comando é o registro central de teclas do frontend; isto é a camada de
// cima, e vazio quer dizer "nada foi trocado".
const TECLAS_PADRAO = {};

// ── Cores que não vêm do CSS ─────────────────────────────────────────────────
// Regra do projeto: nenhuma cor de interface fica escrita em JavaScript. Quem
// precisa de uma cor em JS (canvas, D3, SVG gerado em código) lê o token do
// CSS por aqui, e o tema continua mandando na cor.
//
// ⚠️ Só funciona depois que o CSS carregou. Chamar no topo do arquivo, antes
// do `DOMContentLoaded`, devolve string vazia.
function lerTokenDeCor(nomeDoToken) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(nomeDoToken)
    .trim();
}
