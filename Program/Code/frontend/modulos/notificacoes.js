// ══════════════════════════════════════════════════ NOTIFICAÇÕES ══
//
// A mensagem passageira que aparece num canto da tela. Quem a dispara é o
// `showToast` do `utils.js`; aqui ficam as três perguntas que ele faz antes de
// pintar: de onde veio, se pode aparecer, e onde e de que tamanho.
//
// Carrega ANTES do `utils.js` no `index.html` — são scripts clássicos, sem
// módulos, então a ordem das tags é a ordem de definição.

const NOTIFICACAO_POSICAO_PADRAO = 'inferior-direita';
const NOTIFICACAO_TAMANHO_PADRAO = 'media';
const NOTIFICACAO_DURACAO_MS = 2500;

// As nove posições, na ordem de leitura da grade 3x3 da categoria
// "Notificações". A chave é `<vertical>-<horizontal>` nas nove, inclusive no
// centro da tela: um nome irregular no meio obrigaria um `if` especial em toda
// leitura, e a classe CSS sai da chave por concatenação.
const NOTIFICACAO_POSICOES = [
  { chave: 'superior-esquerda', rotulo: 'Canto superior esquerdo' },
  { chave: 'superior-centro',   rotulo: 'Topo, ao centro' },
  { chave: 'superior-direita',  rotulo: 'Canto superior direito' },
  { chave: 'meio-esquerda',     rotulo: 'Meio da tela, à esquerda' },
  { chave: 'meio-centro',       rotulo: 'Centro da tela' },
  { chave: 'meio-direita',      rotulo: 'Meio da tela, à direita' },
  { chave: 'inferior-esquerda', rotulo: 'Canto inferior esquerdo' },
  { chave: 'inferior-centro',   rotulo: 'Rodapé, ao centro' },
  { chave: 'inferior-direita',  rotulo: 'Canto inferior direito' },
];

const NOTIFICACAO_TAMANHOS = [
  { chave: 'pequena', rotulo: 'Pequena' },
  { chave: 'media',   rotulo: 'Média' },
  { chave: 'grande',  rotulo: 'Grande' },
];

// ⚠️ Arquivos que NÃO respondem pela origem, mesmo aparecendo no topo do
// stack. São helpers chamados de várias abas: se parassem a varredura, toda
// notificação que passa por eles seria classificada como sendo deles.
//
// `trava-ia.js` é o caso mais claro: o "Aguarde: ..." dele nasce de quem
// tentou usar a IA — o Chat, a Fila, o Designer —, e é essa aba que o usuário
// tem em mente quando decide calar ou não o aviso.
const NOTIFICACAO_ARQUIVOS_IGNORADOS = [
  'utils.js',
  'notificacoes.js',
  'trava-ia.js',
];

// Lê o `appSettings` sem confiar que ele já exista: `notificacoes.js` carrega
// antes do `app.js`, e uma notificação disparada cedo demais não pode derrubar
// a tela por causa de uma variável que ainda não nasceu.
function _notificacaoConfig() {
  try {
    return (typeof appSettings === 'object' && appSettings) ? appSettings : {};
  } catch (e) {
    return {};
  }
}

// ══════════════════════════════════════════════════ DE ONDE VEIO ══
//
// ⚠️ A origem NÃO é passada pelas ~170 chamadas de `showToast` espalhadas pelo
// programa: ela é descoberta aqui, pelo arquivo que chamou, lendo o stack.
//
// Isso só funciona porque os scripts são clássicos, sem empacotador e sem
// source map — o nome do arquivo no stack É o nome do módulo. Num projeto com
// bundler, isto seria inútil e a origem teria de virar parâmetro.
//
// O que se ganha não é economizar 170 edições hoje: é a chamada nº 171,
// escrita daqui a um mês, entrar classificada sozinha em vez de alguém ter de
// lembrar de passar a origem.
//
// Arquivo que não está no mapa devolve `null`, e `null` MOSTRA. O pior caso
// desta descoberta é o comportamento que o programa sempre teve — uma
// notificação a mais é ruído, uma a menos é um erro engolido em silêncio.
function descobrirOrigemDaNotificacao() {
  try {
    const quadros = String(new Error().stack || '').split('\n');
    for (const quadro of quadros) {
      // Primeiro o caminho a partir de `modulos/`, que distingue os dois
      // `duplicados.js`; só depois o nome solto, para quem mora fora de lá.
      const comPasta = quadro.match(/\/modulos\/(.+?\.js):\d+:\d+/);
      const soNome   = quadro.match(/\/([a-zA-Z0-9._-]+\.js):\d+:\d+/);
      const nome = soNome ? soNome[1] : null;
      if (nome && NOTIFICACAO_ARQUIVOS_IGNORADOS.includes(nome)) continue;
      if (comPasta && NOTIFICACAO_ORIGEM_POR_ARQUIVO[comPasta[1]]) {
        return NOTIFICACAO_ORIGEM_POR_ARQUIVO[comPasta[1]];
      }
      if (nome && NOTIFICACAO_ORIGEM_POR_ARQUIVO[nome]) {
        return NOTIFICACAO_ORIGEM_POR_ARQUIVO[nome];
      }
    }
  } catch (e) {
    // Stack indisponível: cai no `null`, que mostra.
  }
  return null;
}

// ══════════════════════════════════════════════════ PODE APARECER? ══
//
// Três estados por origem: `tudo`, `erros` e `nada`. `erros` é o estado que
// justifica os três existirem — cala a confirmação ("Salvo!", "Copiado!") sem
// deixar o usuário cego para a falha da mesma aba.
function notificacaoPermitida(origem, ehErro) {
  if (!origem) return true;                     // não mapeado: mostra sempre
  const origens = _notificacaoConfig().notificacoes_origens || {};
  // ⚠️ Origem ausente vale `tudo`: o merge do `load_settings` é raso, então um
  // `settings.json` gravado antes de uma origem nova existir vem sem ela.
  const estado = origens[origem] || 'tudo';
  if (estado === 'nada')  return false;
  if (estado === 'erros') return !!ehErro;
  return true;
}

// ══════════════════════════════════════════════════ PINTAR ══
//
// ⚠️ Pinta sem perguntar nada a ninguém — o filtro fica com quem chama. É por
// aqui que a prévia da categoria "Notificações" passa, e ela tem de aparecer
// mesmo com "Configurações → Nada": o usuário está olhando para o controle, e
// uma prévia que não aparece parece defeito.
//
// São DOIS elementos, e não um: a âncora posiciona e a notificação se veste.
// As posições centralizadas precisam de `transform: translate(...)`, que
// colidiria com qualquer `transform` de animação na própria notificação — o
// conflito se resolve por estrutura, não por combinado entre quem escreve CSS.
function pintarNotificacao(msg, ehErro) {
  let ancora = document.getElementById('app-toast-ancora');
  let toast  = document.getElementById('app-toast');
  if (!ancora || !toast) {
    ancora = document.createElement('div');
    ancora.id = 'app-toast-ancora';
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.setAttribute('role', 'status');
    ancora.appendChild(toast);
    document.body.appendChild(ancora);
  }

  const cfg = _notificacaoConfig();
  const posicao = cfg.notificacoes_posicao || NOTIFICACAO_POSICAO_PADRAO;
  const tamanho = cfg.notificacoes_tamanho || NOTIFICACAO_TAMANHO_PADRAO;

  ancora.className = 'app-toast-ancora app-toast-ancora--' + posicao;

  clearTimeout(toast._timer);
  toast.textContent = msg;
  toast.className = 'app-toast app-toast--' + tamanho
                  + (ehErro ? ' app-toast-error' : ' app-toast-ok');
  toast._timer = setTimeout(() => {
    toast.classList.add('app-toast-hidden');
  }, NOTIFICACAO_DURACAO_MS);
}
