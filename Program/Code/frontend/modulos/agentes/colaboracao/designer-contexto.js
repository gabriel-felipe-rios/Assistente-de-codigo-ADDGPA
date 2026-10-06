/* ══════════════════════════════ DESIGNER — a aba Contexto ══ */
//
// Quanto da janela do modelo o pedido vai ocupar, repartido por bloco. Sem ela
// dava para mandar gerar variação atrás de variação sem saber quanto já tinha
// sido usado — e o estouro só aparecia quando o LM Studio matava a geração no
// meio do stream.
//
// É mais simples que a do Chat: o Designer não tem subagente, é um pedido só.
//
// ⚠️ A janela de contexto vem por HTTP do LM Studio (`/api/v0/models`), não de
// leitura local. Por isso ela é buscada UMA vez e guardada em
// `_contextWindowLimit` (o mesmo global que o Chat usa, preenchido por
// `loadModels`): consultar a cada render travaria a interface, e com o LM Studio
// desligado a aba tem de abrir mesmo assim, mostrando só o total de tokens, sem
// porcentagem.

let _dctxDesatualizado = true;

function marcarContextoDesatualizado() {
  _dctxDesatualizado = true;
  // A barra do campo de envio está sempre à vista, então ela não pode esperar a
  // aba Contexto ser aberta para se atualizar.
  atualizarBarraDeContextoDoDesigner();
}

// A barra resumida, ao lado do campo de envio — o mesmo componente e os mesmos
// três estados por cor do Chat e da Fila. Ela só mostra o TOTAL; a repartição por
// bloco é a aba Contexto.
async function atualizarBarraDeContextoDoDesigner() {
  const preenche = document.getElementById('design-usage-fill');
  const texto = document.getElementById('design-usage-text');
  if (!preenche || !texto || !currentProject) return;
  let r;
  try {
    r = await window.pywebview.api.carregar_contexto_do_designer(
      currentProject, currentDesignChatId || null, _dctxRefinando());
  } catch (e) { r = null; }
  if (!r || !r.success) { texto.textContent = '—'; preenche.style.width = '0%'; return; }
  const limite = (typeof _contextWindowLimit !== 'undefined') ? _contextWindowLimit : null;
  const fmt = n => (n || 0).toLocaleString('pt-BR');
  if (limite) {
    const pct = Math.min(100, (r.total / limite) * 100);
    preenche.style.width = pct + '%';
    preenche.className = 'context-usage-fill ' + (pct < 60 ? 'ok' : pct < 85 ? 'warn' : 'full');
    texto.textContent = `${fmt(r.total)} / ${fmt(limite)} tokens`;
  } else {
    // LM Studio desligado: sem a janela do modelo só dá para mostrar o total.
    preenche.style.width = '0%';
    preenche.className = 'context-usage-fill';
    texto.textContent = `${fmt(r.total)} tokens`;
  }
}

// Refinando = há variação-base escolhida. Muda o prompt-base e tira o estilo do
// pedido, então a conta é outra.
function _dctxRefinando() {
  return !!(typeof selectedDesignVariation !== 'undefined' && selectedDesignVariation);
}

async function renderContextoDesign(forcar = false) {
  const corpo = document.getElementById('dctx-corpo');
  if (!corpo || !currentProject) return;
  if (!forcar && !_dctxDesatualizado) return;

  corpo.innerHTML = '<div class="arq-expand-loading">Contando…</div>';
  let r;
  try {
    r = await window.pywebview.api.carregar_contexto_do_designer(
      currentProject, currentDesignChatId || null, _dctxRefinando());
  } catch (e) { r = null; }
  if (!r || !r.success) {
    corpo.innerHTML = '<div class="arq-empty">Não foi possível contar os blocos.</div>';
    return;
  }
  _dctxDesatualizado = false;
  corpo.innerHTML = '';
  corpo.appendChild(_dctxBarra(r));
  if (r.sumiram && r.sumiram.length) corpo.appendChild(_dctxAvisoDeSumico(r.sumiram));
  corpo.appendChild(_dctxLista(r));
}

// A barra reusa as classes `.context-usage*` do Chat — mesmo desenho e os mesmos
// três estados por cor (ok < 60% · warn < 85% · full). Os ids são próprios,
// porque a função do Chat trabalha com ids fixos e as duas telas podem estar
// montadas ao mesmo tempo.
function _dctxBarra(r) {
  const limite = (typeof _contextWindowLimit !== 'undefined') ? _contextWindowLimit : null;
  const fmt = n => (n || 0).toLocaleString('pt-BR');
  const caixa = document.createElement('div');
  caixa.className = 'context-usage dctx-barra';

  const pct = limite ? Math.min(100, (r.total / limite) * 100) : 0;
  const estado = pct < 60 ? 'ok' : pct < 85 ? 'warn' : 'full';
  caixa.innerHTML = `
    <div class="dctx-cab">
      <span class="dctx-titulo">Janela do modelo</span>
      <span class="dctx-modo">${r.refinando ? 'refino' : '1ª rodada'}</span>
    </div>
    <div class="context-usage-bar">
      <div class="context-usage-fill ${limite ? estado : ''}" style="width:${limite ? pct : 0}%"></div>
    </div>
    <div class="context-usage-text">${
      limite ? `${fmt(r.total)} / ${fmt(limite)} tokens` : `${fmt(r.total)} tokens`
    }</div>
    ${limite ? '' : '<div class="dctx-sem-janela">LM Studio desligado — sem a janela do modelo, só dá para mostrar o total.</div>'}
    ${r.exata ? '' : '<div class="dctx-sem-janela">Contagem aproximada: o tokenizador exato não está disponível.</div>'}`;
  return caixa;
}

function _dctxAvisoDeSumico(sumiram) {
  const aviso = document.createElement('div');
  aviso.className = 'dctx-aviso';
  aviso.innerHTML = `<strong>Escolha apontando para arquivo que não existe mais:</strong>
    ${escapeHtml(sumiram.join(', '))}. Abra a aba da dimensão e escolha de novo.`;
  return aviso;
}

// Um bloco por linha, com o selo de enviado ou não enviado. O bloco de uma
// dimensão NÃO escolhida também aparece, com custo zero — é o que deixa visível
// que ele existe e que escolher aquela dimensão tem um preço.
function _dctxLista(r) {
  const lista = document.createElement('div');
  lista.className = 'dctx-lista';
  const maior = Math.max(1, ...r.blocos.map(b => b.tokens));
  for (const b of r.blocos) {
    const linha = document.createElement('div');
    linha.className = 'dctx-bloco' + (b.enviado ? '' : ' fora');
    linha.innerHTML = `
      <span class="dctx-bloco-nome">${escapeHtml(b.rotulo)}${
        b.quantos ? `<span class="dctx-bloco-qtd">${b.quantos}</span>` : ''}</span>
      <span class="dctx-selo ${b.enviado ? 'on' : ''}">${b.enviado ? 'enviado' : 'não enviado'}</span>
      <span class="dctx-bloco-barra"><i style="width:${(b.tokens / maior) * 100}%"></i></span>
      <span class="dctx-bloco-tokens">${b.tokens.toLocaleString('pt-BR')}</span>`;
    lista.appendChild(linha);
  }
  return lista;
}
