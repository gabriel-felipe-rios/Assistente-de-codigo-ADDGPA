/* ═════════════════════════ DESIGNER — as cinco dimensões: estado e escolhas ══ */
//
// O estado da escolha e as preferências por projeto. As TELAS das cinco
// dimensões moram em `designer-dimensoes.js`; a aba Seleção em
// `designer-selecao.js`; a aba Contexto em `designer-contexto.js`.
//
// As dimensões são buscadas do backend UMA vez e ficam em cache — uma chamada
// por dimensão, já com nome + conteúdo + tags de todos os itens. A versão antiga
// desta tela buscava o conteúdo de CADA item numa chamada separada: com as cinco
// dimensões populadas isso viraria 70+ idas e voltas pela ponte pywebview a cada
// abertura da aba, e a janela congelava no meio.

let escolhasDoDesigner = {
  estilo: null, cor: null, tipografia: null,
  texturas: [], animacoes: [], comentarios: {},
};
let _designDimensoes = null; // { estilos: {...}, cores: {...}, ... }
let _designOrdem     = [];   // a tabela das cinco, na ordem canônica, vinda do backend

function dimensaoPorCampo(campo) {
  return _designOrdem.find(d => d.campo === campo) || null;
}

// A chave de escolha de um item. É o nome do arquivo nas quatro dimensões de
// tag e `Pasta/Arquivo` em Animações — uma animação só se identifica junto do
// evento em que roda, senão "Esmaecer" de Trocar de aba e "Esmaecer" de outra
// pasta seriam a mesma escolha.
function chaveDoItem(item) {
  return item.pasta ? `${item.pasta}/${item.arquivo}` : item.arquivo;
}

function itensDaDimensao(chaveDimensao) {
  const dados = (_designDimensoes || {})[chaveDimensao];
  if (!dados) return [];
  if (dados.por_pasta) return dados.grupos.flatMap(g => g.itens);
  return dados.itens;
}

function itemPelaChave(chaveDimensao, chave) {
  return itensDaDimensao(chaveDimensao).find(i => chaveDoItem(i) === chave) || null;
}

async function carregarDimensoesDoDesigner(recarregar = false) {
  if (!recarregar && _designDimensoes) return true;
  const r = await window.pywebview.api.carregar_dimensoes_do_designer();
  if (!r || !r.success) { showToast((r && r.error) || 'Erro ao ler a biblioteca.', true); return false; }
  _designDimensoes = r.dimensoes;
  _designOrdem = r.ordem;
  return true;
}

// ── Escolher ─────────────────────────────────────────────────────────────────

function estaEscolhido(campo, chave) {
  const d = dimensaoPorCampo(campo);
  if (!d) return false;
  return d.unica ? escolhasDoDesigner[campo] === chave
                 : (escolhasDoDesigner[campo] || []).includes(chave);
}

function alternarEscolha(campo, chave) {
  const d = dimensaoPorCampo(campo);
  if (!d) return;
  const estava = estaEscolhido(campo, chave);
  if (d.unica) {
    // Clicar no que já está escolhido desmarca: é o que permite mandar um
    // pedido sem aquela dimensão, e mandar sem nenhuma tem de continuar valendo.
    escolhasDoDesigner[campo] = escolhasDoDesigner[campo] === chave ? null : chave;
  } else {
    const lista = escolhasDoDesigner[campo] || [];
    escolhasDoDesigner[campo] = lista.includes(chave)
      ? lista.filter(c => c !== chave)
      : [...lista, chave];
  }
  // Desmarcar leva o comentário junto: ele pertence àquele item DENTRO desta
  // seleção. Mantido, ele volta sozinho se o item for reescolhido, e viaja no
  // prompt sem ninguém ter pedido.
  if (estava) _esquecerComentario(d, chave);
  aoMudarEscolhaDoDesigner(campo);
}

function _esquecerComentario(d, chave) {
  const item = itemPelaChave(d.dimensao, chave);
  if (item) delete escolhasDoDesigner.comentarios[item.caminho];
}

function limparDimensao(campo) {
  const d = dimensaoPorCampo(campo);
  const antigas = d && !d.unica ? (escolhasDoDesigner[campo] || [])
                                : (escolhasDoDesigner[campo] ? [escolhasDoDesigner[campo]] : []);
  escolhasDoDesigner[campo] = (d && !d.unica) ? [] : null;
  if (d) antigas.forEach(chave => _esquecerComentario(d, chave));
  aoMudarEscolhaDoDesigner(campo);
}

// Uma mudança de escolha repinta TRÊS telas: os cards da dimensão, os chips da
// barra de modo e a aba Seleção. Centralizar aqui é o que impede uma delas de
// ficar para trás — foi assim que o chip já anunciou um estilo que nenhum card
// mostrava como ativo.
//
// ⚠️ A dimensão aberta é atualizada PONTUALMENTE, não remontada. Remontar
// destrói e recria os 18 iframes das miniaturas, e é isso que fazia a tela
// piscar a cada clique. As OUTRAS dimensões ficam marcadas como sujas e se
// repintam ao serem abertas — que é quando a re-tingidura pela paleta nova
// importa, e aí o custo já está pago pela troca de aba.
function aoMudarEscolhaDoDesigner(campoMudado) {
  atualizarMarcasDaDimensao(campoMudado);
  if (campoMudado === 'cor') marcarDimensoesSujas('cor');
  updateDesignChips();
  if (typeof renderSelecaoDesign === 'function') renderSelecaoDesign();
  if (typeof marcarContextoDesatualizado === 'function') marcarContextoDesatualizado();
  salvarEscolhasDaSessao();
}

// ── As escolhas da SESSÃO ────────────────────────────────────────────────────
// Gravadas a cada clique dentro do arquivo da própria sessão. É por sessão, e não
// por projeto, para duas sessões poderem experimentar combinações diferentes ao
// mesmo tempo — e para uma **sessão nova nascer limpa** em vez de herdar a
// escolha da anterior.
//
// O `Preferências.json` do projeto continua existindo como PADRÃO guardado: só
// entra na sessão quando se pede, e só é gravado quando se pede.

// ⚠️ O id da sessão é CAPTURADO por quem chama, nunca lido aqui dentro. A gravação
// atravessa a ponte pywebview e não é esperada: se a sessão trocar nesse meio, ler
// `currentDesignChatId` só na hora do envio grava as escolhas de uma sessão dentro
// do arquivo da outra. O caso real é o `blur` de um comentário disparado JUSTAMENTE
// porque o usuário clicou noutra sessão — ele roda depois da troca.
async function salvarEscolhasDaSessao(chatId = currentDesignChatId) {
  if (!currentProject || !chatId) return;
  const escolhas = JSON.parse(JSON.stringify(escolhasDoDesigner));
  try {
    await window.pywebview.api.salvar_escolhas_da_sessao(currentProject, chatId, escolhas);
  } catch (e) { console.error('salvar_escolhas_da_sessao:', e); }
}

// Descarta escolha que aponta para arquivo apagado da biblioteca — senão o chip
// anunciaria um item que nenhum card mostra como ativo. O backend também avisa na
// hora de gerar (A8); aqui é só não mentir na tela.
//
// ⚠️ SÓ DESCARTA COM O CATÁLOGO NA MÃO. `itemPelaChave` devolve o mesmo `null`
// para duas coisas opostas: "o arquivo foi apagado do disco" e "o catálogo ainda
// não carregou". Tratar as duas igual apaga escolhas boas — e como o próximo
// clique grava o estado inteiro, o vazio vai para o disco por cima do que estava
// lá. Sem catálogo, nada é filtrado.
//
// ⚠️ E o que é descartado de verdade SAI AVISADO. Escolha sumindo em silêncio da
// tela é indistinguível de bug — foi assim que este mesmo ponto passou despercebido.
function _aplicarEscolhas(vindas) {
  vindas = vindas || {};
  const temCatalogo = !!_designDimensoes && _designOrdem.length > 0;
  const perdidas = [];

  for (const d of _designOrdem) {
    const existe = chave => {
      if (!chave) return false;
      if (!temCatalogo || itemPelaChave(d.dimensao, chave)) return true;
      perdidas.push(`${d.rotulo} → ${chave}`);
      return false;
    };
    escolhasDoDesigner[d.campo] = d.unica
      ? (existe(vindas[d.campo]) ? vindas[d.campo] : null)
      : (vindas[d.campo] || []).filter(existe);
  }
  escolhasDoDesigner.comentarios = temCatalogo
    ? _comentariosDosEscolhidos(vindas.comentarios || {})
    : (vindas.comentarios || {});
  marcarDimensoesSujas();

  if (perdidas.length) {
    showToast('Escolha apontando para arquivo que não existe mais: ' +
              perdidas.join(', ') + '. Escolha de novo na aba da dimensão.', true);
  }
}

// O comentário pertence ao ITEM escolhido, e sai junto quando ele sai da seleção.
// Guardar comentário de item que não está mais escolhido é o que fazia texto antigo
// reaparecer sozinho ao reescolher o item — e um comentário invisível que volta é
// pior que nenhum, porque ele viaja no prompt sem ninguém ter pedido.
function _comentariosDosEscolhidos(comentarios) {
  const vivos = {};
  for (const d of _designOrdem) {
    const chaves = d.unica
      ? (escolhasDoDesigner[d.campo] ? [escolhasDoDesigner[d.campo]] : [])
      : (escolhasDoDesigner[d.campo] || []);
    for (const chave of chaves) {
      const item = itemPelaChave(d.dimensao, chave);
      if (item && comentarios[item.caminho]) vivos[item.caminho] = comentarios[item.caminho];
    }
  }
  return vivos;
}

async function carregarEscolhasDaSessao() {
  if (!currentProject || !currentDesignChatId) { _aplicarEscolhas({}); return; }
  try {
    const r = await window.pywebview.api.carregar_escolhas_da_sessao(
      currentProject, currentDesignChatId);
    _aplicarEscolhas((r && r.escolhas) || {});
  } catch (e) { console.error('carregar_escolhas_da_sessao:', e); _aplicarEscolhas({}); }
}

// ⚠️ "Salvar como padrão do projeto" e "Usar o padrão do projeto" SAÍRAM em
// 2026-08-25 a pedido do usuário: a aba Seleção ficou com um botão só, o de copiar
// o prompt. `load_design_prefs` / `save_design_prefs` continuam no backend, sem
// tela que os alcance.

// ── A paleta escolhida, que tinge as miniaturas ──────────────────────────────

function paletaEscolhida() {
  return escolhasDoDesigner.cor ? itemPelaChave('cores', escolhasDoDesigner.cor) : null;
}

function dadosDaPaleta(item) {
  try { return JSON.parse(item.conteudo); } catch (e) { return null; }
}

function hexesDaPaleta(item) {
  const dados = dadosDaPaleta(item);
  if (!dados) return [];
  return Object.values(dados.cores || {}).filter(c => c && c.hex).map(c => c.hex);
}

// O `:root` que sobrescreve a paleta de reserva de dentro do arquivo do estilo.
// Só funciona porque os estilos foram reescritos com variável CSS em vez de
// hexadecimal fixo — sem isso a miniatura ignoraria a paleta escolhida, que é
// exatamente o que ela fazia antes.
function cssDaPaletaEscolhida() {
  const paleta = paletaEscolhida();
  const dados = paleta && dadosDaPaleta(paleta);
  if (!dados) return '';
  const mapa = {
    fundo: '--fundo', superficie: '--superficie', superficie_hover: '--superficie-hover',
    superficie_escura: '--superficie-escura', texto: '--texto', texto_secundario: '--texto-secundario',
    primaria: '--primaria', positiva: '--positiva', negativa: '--negativa',
    especial: '--especial', utilitaria: '--utilitaria',
  };
  const regras = Object.entries(mapa)
    .filter(([chave]) => (dados.cores || {})[chave])
    .map(([chave, variavel]) => `${variavel}:${dados.cores[chave].hex}`)
    .join(';');
  return regras ? `<style>:root{${regras}}</style>` : '';
}

function criarBotaoOlho(titulo, aoClicar) {
  const btn = document.createElement('button');
  btn.className = 'dst-eye-btn';
  btn.title = titulo;
  btn.textContent = '👁';
  btn.addEventListener('click', e => { e.stopPropagation(); aoClicar(); });
  return btn;
}
