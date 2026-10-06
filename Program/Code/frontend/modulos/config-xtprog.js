// ══════════════════ Configurações → Extensões do programa (comportamento) ══
// A árvore de `External/extensions/` com um Interruptor por extensão, os
// erros do manifesto de quem tem, e uma alça de arrastar por linha.
//
// ⚠️ **Este é o ÚNICO lugar que liga e desliga uma extensão** (D12). A tela
// de configuração DELA, do outro lado do trilho, não tem interruptor: dois
// lugares para o mesmo estado é um lugar para ele ficar errado.
//
// O estado vivo mora em `xtArvore` (`extensoes/estado.js`); este arquivo é
// quem primeiro o popula. Toda resposta do backend passa por
// `xtAdotarArvore`, que injeta o frontend do que ligou, remove o do que
// desligou e repinta esta lista — por isso nenhuma função aqui mexe na tela
// por conta própria depois de gravar.
//
// Ligar/desligar e o destaque gravam NO CLIQUE, sem barra de Salvar (regra do
// Interruptor). A ORDEM é diferente: arrastar só reorganiza o DOM, e só o
// botão "Salvar ordem" grava — mesma convenção de Plugins.

async function initConfigXtprog() {
  await carregarExtensoesDoPrograma();

  // Relê a pasta toda vez que a categoria é ABERTA de novo (não só no boot) —
  // mesma razão de `initConfigPlugins`: uma extensão criada com o programa já
  // aberto só apareceria reiniciando, senão.
  const trilhoBtn = document.querySelector(
    '#config-trilho .config-trilho-btn[data-categoria="xtprog"]');
  if (trilhoBtn && !trilhoBtn._wiredRecarga) {
    trilhoBtn._wiredRecarga = true;
    trilhoBtn.addEventListener('click', carregarExtensoesDoPrograma);
  }

  const btnSalvar = document.getElementById('btn-save-xtprog');
  if (btnSalvar && !btnSalvar._wired) {
    btnSalvar._wired = true;
    btnSalvar.addEventListener('click', _xtSalvarOrdem);
  }

  const destaque = document.getElementById('xtprog-destaque');
  if (destaque && !destaque._wired) {
    destaque._wired = true;
    destaque.addEventListener('click', () => {
      const track = destaque.querySelector('.toggle-track');
      xtSalvarDestaque({ destacar: !track.classList.contains('on') });
    });
  }

  // Cor e formato gravam no clique, como o interruptor ao lado deles: os três
  // são a mesma pergunta ("como o destaque aparece"), e um deles esperando um
  // Salvar que os outros dois não esperam seria a mesma tela com duas regras.
  const cores = document.getElementById('xtprog-destaque-cor');
  if (cores && !cores._wired) {
    cores._wired = true;
    // Delegado no container: as amostras são remontadas a cada gravação, e um
    // listener por bolinha morreria junto da bolinha antiga.
    cores.addEventListener('click', e => {
      const btn = e.target.closest('.xtprog-cor');
      if (btn) xtSalvarDestaque({ cor: btn.dataset.cor });
    });
  }

  const tipo = document.getElementById('xtprog-destaque-tipo');
  if (tipo && !tipo._wired) {
    tipo._wired = true;
    tipo.addEventListener('change', () => xtSalvarDestaque({ tipo: tipo.value }));
  }

  // O "Salvar" das categorias do lado Extensões. Delegado na barra inteira, e
  // uma vez só: cada extensão ligada cria o próprio botão, e um listener por
  // botão morreria junto do botão ao desligar a extensão. Mesma razão do
  // "Restaurar padrão" logo ao lado, em `config-categorias.js`.
  const barra = document.getElementById('config-barra-acoes');
  if (barra && !barra._wiredSalvarXt) {
    barra._wiredSalvarXt = true;
    barra.addEventListener('click', e => {
      const btn = e.target.closest('[id^="btn-save-xt-"]');
      if (btn) xtSalvarPreferencias(btn.id.replace('btn-save-', ''));
    });
  }

  const lista = document.getElementById('xtprog-lista');
  if (lista && !lista._wired) {
    lista._wired = true;
    // Delegado no container: a árvore é remontada a cada mudança de estado, e
    // um listener por linha morreria junto da linha antiga.
    lista.addEventListener('click', async (ev) => {
      const item = ev.target.closest('.plugin-item');
      const caminho = item && item.dataset.xtCaminho;
      if (!caminho) return;
      const pill = ev.target.closest('.toggle-pill');
      if (!pill || pill.classList.contains('desabilitado')) return;
      const track = pill.querySelector('.toggle-track');
      await _xtSalvarLigado(caminho, !track.classList.contains('on'));
    });
  }
}

/** Busca a árvore no backend e deixa `xtAdotarArvore` fazer o resto. */
async function carregarExtensoesDoPrograma() {
  try {
    await xtAdotarArvore(await window.pywebview.api.list_extensoes_programa());
  } catch (e) {
    console.error('[extensoes] falha ao listar:', e);
    xtArvore = XT_ARVORE_VAZIA;
    _xtPintarLista();
  }
  return xtArvore;
}

async function _xtSalvarLigado(caminho, ligado) {
  try {
    const r = await window.pywebview.api.save_config_extensao_programa(caminho, { ligado });
    if (!r || !r.success) {
      showToast((r && r.error) || 'Não foi possível gravar a extensão.', true);
      return;
    }
    await xtAdotarArvore(r);
  } catch (e) {
    showToast('Não foi possível gravar a extensão.', true);
    console.error('[extensoes] falha ao gravar:', e);
  }
}

/** Lê a ordem atual do DOM e grava — um `{pasta pai: [nomes]}` por nível,
 * para TODOS os níveis de uma vez (mesma convenção de Plugins). */
function _xtColetarOrdem(elArvore) {
  const ordemPorPasta = {};
  const acumular = (pai, nomes) => {
    ordemPorPasta[pai] = [...(ordemPorPasta[pai] || []), ...nomes];
  };
  elArvore.querySelectorAll('.xtprog-pastas-nivel[data-caminho-pai]').forEach(nivel => {
    acumular(nivel.dataset.caminhoPai, [...nivel.children].map(el => el.dataset.pasta));
  });
  elArvore.querySelectorAll('.xtprog-itens-nivel[data-caminho-pai]').forEach(nivel => {
    acumular(nivel.dataset.caminhoPai, [...nivel.children].map(el => el.dataset.xtNome));
  });
  return ordemPorPasta;
}

async function _xtSalvarOrdem() {
  const lista = document.getElementById('xtprog-lista');
  try {
    const r = await window.pywebview.api.save_extensoes_programa_order(
      lista ? _xtColetarOrdem(lista) : {});
    if (!r || !r.success) {
      showToast((r && r.error) || 'Não foi possível salvar a ordem.', true);
      return;
    }
    await xtAdotarArvore(r);
    showToast('Ordem salva!');
  } catch (e) {
    showToast('Não foi possível salvar a ordem.', true);
    console.error('[extensoes] falha ao salvar a ordem:', e);
  }
}

// ── Desenho ─────────────────────────────────────────────────────────────

/**
 * A legenda de uma linha: a versão e os tipos que ela declarou.
 *
 * O tipo é NÚMERO no manifesto (P8) e NOME aqui ("Muda uma tela · Muda um
 * comportamento"), vindo do catálogo do backend que a página das extensões já
 * guardou (`_xtCatalogoDaPagina`, em `extensoes/tela.js`). Sem o catálogo
 * ainda — a ponte não respondeu —, sai o número. Manifesto antigo chega com
 * os tipos já traduzidos.
 */
function _xtLegenda(e) {
  const partes = [];
  if (e.versao) partes.push(`v${e.versao}`);
  const catTipos = (typeof _xtCatalogoDaPagina !== 'undefined' && _xtCatalogoDaPagina
    && _xtCatalogoDaPagina.tipos) || {};
  if (e.tipos && e.tipos.length) {
    partes.push(e.tipos.every(t => catTipos[t])
      ? e.tipos.map(t => catTipos[t].nome).join(' · ')
      : `tipo ${e.tipos.join(', ')}`);
  }
  if (e.tem_boot) partes.push('roda sozinha');
  return partes.join(' · ');
}

/**
 * O que a extensão FAZ na sua tela — onde ela se encaixa e o que ela observa.
 *
 * ⚠️ **A guardiã é destacada de propósito, e é a razão desta função existir.**
 * Barrar o Ctrl+S é a coisa mais invasiva que uma extensão pode fazer nesta
 * camada, e até aqui ela era invisível: só quem abrisse o `extensao.json`
 * saberia. Um `escreve_fora` já aparece na lista desde a Obra 1 — não faz
 * sentido declarar onde ela grava e esconder que ela pode impedir você de
 * gravar.
 *
 * Sai da árvore que a lista já tem, e não de uma chamada nova: o backend já
 * manda `encaixes` e `eventos` normalizados em cada folha.
 */
function _xtPoderesHtml(e) {
  const linhas = [];

  const encaixes = (e.encaixes || []).map(x => x.ponto);
  if (encaixes.length) {
    linhas.push(`<div class="xtprog-poder" title="Lugares do programa onde esta extensão desenha ou age">
      encaixa em: ${encaixes.map(p => `<code>${escapeHtml(p)}</code>`).join(', ')}</div>`);
  }

  const eventos = e.eventos || [];
  const observa = eventos.filter(x => !x.guardia).map(x => x.nome);
  if (observa.length) {
    linhas.push(`<div class="xtprog-poder" title="Avisos que esta extensão recebe do programa">
      observa: ${observa.map(n => `<code>${escapeHtml(n)}</code>`).join(', ')}</div>`);
  }

  const consultas = (e.consultas || []).map(x => x.nome);
  if (consultas.length) {
    linhas.push(`<div class="xtprog-poder" title="Perguntas do programa que esta extensão responde">
      responde: ${consultas.map(n => `<code>${escapeHtml(n)}</code>`).join(', ')}</div>`);
  }

  const guarda = eventos.filter(x => x.guardia).map(x => x.nome);
  if (guarda.length) {
    // Classe própria, e não a mesma dos outros dois: esta linha precisa
    // saltar. As outras duas descrevem o que a extensão faz; esta descreve o
    // que ela pode impedir VOCÊ de fazer.
    linhas.push(`<div class="xtprog-poder xtprog-poder-guardia"
      title="Esta extensão roda ANTES da ação e pode impedi-la, ou mudar o que vai para o disco">
      ⚠ pode barrar: ${guarda.map(n => `<code>${escapeHtml(n)}</code>`).join(', ')}</div>`);
  }

  return linhas.join('');
}

function _xtLinhaHtml(e) {
  // ⚠️ Uma extensão com o manifesto quebrado APARECE, com o erro e o
  // interruptor desabilitado. Sumir em silêncio é o pior resultado possível:
  // o usuário criou a pasta, não vê nada, e não tem como saber por quê.
  const erros = (e.erros || []).length
    ? `<div class="xtprog-erros">${e.erros.map(x => escapeHtml(x)).join('<br />')}</div>` : '';
  // Os avisos que só a tela vê (estilo fora do prefixo, D42) — em âmbar:
  // aviso, não erro (mesma leitura de `.config-nota-alerta`).
  const avisosDaTela = (e.ligado && typeof _xtAvisosDeTela !== 'undefined'
    && _xtAvisosDeTela.get(e.slug)) || [];
  const avisos = avisosDaTela.length
    ? `<div class="xtprog-erros" style="color: var(--amber); background: rgba(var(--amber-rgb), 0.12)">${
        avisosDaTela.map(x => escapeHtml(x)).join('<br />')}</div>` : '';
  const fora = ((e.escreve_fora || []).length
    ? `<div class="xtprog-fora" title="Caminhos que esta extensão declara gravar fora da pasta dela">
         escreve fora: ${e.escreve_fora.map(x => `<code>${escapeHtml(String(x))}</code>`).join(', ')}
       </div>` : '')
    // Fase 07 (D51): o par do de cima — o que ela lê fora da pasta de trabalho.
    + ((e.le_fora || []).length
    ? `<div class="xtprog-fora" title="Pastas que esta extensão declara ler fora da pasta de trabalho do projeto">
         lê fora: ${e.le_fora.map(x => `<code>${escapeHtml(String(x))}</code>`).join(', ')}
       </div>` : '');
  const icone = e.tem_icone
    ? `<img class="xtprog-icone" src="${xtBaseUrl(e.caminho)}/icone.svg" alt="" />` : '';

  return `
    <div class="plugin-item xtprog-item" data-xt-caminho="${escapeHtml(e.caminho)}"
         data-xt-nome="${escapeHtml(e.nome_da_pasta)}">
      <span class="plugin-handle" title="Arrastar para reordenar">⠿</span>
      ${icone}
      <div class="plugin-info">
        <div class="plugin-nome">${escapeHtml(e.nome)}</div>
        <div class="plugin-tipo">${escapeHtml(_xtLegenda(e))}</div>
        ${e.descricao ? `<div class="xtprog-descricao">${escapeHtml(e.descricao)}</div>` : ''}
        ${_xtPoderesHtml(e)}${fora}${erros}${avisos}
      </div>
      <label class="toggle-pill${e.ok ? '' : ' desabilitado'}"
             title="${e.ok ? 'Ligar ou desligar' : 'Conserte o extensao.json para poder ligar'}">
        <div class="toggle-track${e.ligado ? ' on' : ''}"><div class="toggle-knob"></div></div>
        <span class="toggle-label${e.ligado ? ' on' : ''}">${e.ligado ? 'Ligada' : 'Desligada'}</span>
      </label>
    </div>`;
}

/** Uma categoria — subpasta pura, nunca liga/desliga. Recursiva. */
function _xtPastaHtml(pasta) {
  return `
    <div class="xtprog-pasta" data-pasta="${escapeHtml(pasta.nome)}">
      <div class="xtprog-pasta-titulo">
        <span class="xtprog-pasta-handle" title="Arrastar para reordenar">⠿</span>
        <span class="xtprog-pasta-nome">${escapeHtml(pasta.nome)}</span>
      </div>
      <div class="xtprog-pasta-corpo">${_xtCorpoHtml(pasta)}</div>
    </div>`;
}

function _xtCorpoHtml(no) {
  const pastas = (no.pastas || []).length
    ? `<div class="xtprog-pastas-nivel" data-caminho-pai="${escapeHtml(no.caminho)}">${
        no.pastas.map(_xtPastaHtml).join('')}</div>` : '';
  const itens = (no.extensoes || []).length
    ? `<div class="xtprog-itens-nivel" data-caminho-pai="${escapeHtml(no.caminho)}">${
        no.extensoes.map(_xtLinhaHtml).join('')}</div>` : '';
  return pastas + itens;
}

/** As amostras de cor, o seletor de formato e a prévia. */
function _xtPintarDestaque() {
  const pill = document.getElementById('xtprog-destaque');
  if (pill) {
    // O estado ligado é a classe `.on` no `.toggle-track` E no `.toggle-label`,
    // as duas juntas — senão o rótulo diz uma coisa e o desenho diz outra
    // (Padrões de interface › Componentes › Interruptor).
    pill.querySelector('.toggle-track').classList.toggle('on', xtDestaque.destacar);
    pill.querySelector('.toggle-label').classList.toggle('on', xtDestaque.destacar);
  }

  const cores = document.getElementById('xtprog-destaque-cor');
  if (cores) {
    // ⚠️ A cor de cada bolinha sai do TOKEN do tema (`var(--purple-rgb)`), e
    // nunca de um hexadecimal escrito aqui: trocar de tema tem de repintar as
    // amostras junto, senão elas mentem sobre o que vai aparecer na tela.
    cores.innerHTML = (xtDestaque.cores || []).map(c => {
      const rotulo = XT_DESTAQUE_ROTULO_COR[c] || c;
      return `<button type="button" class="xtprog-cor${c === xtDestaque.cor ? ' ativa' : ''}"
                      data-cor="${escapeHtml(c)}" title="${escapeHtml(rotulo)}"
                      aria-label="${escapeHtml(rotulo)}"
                      style="--amostra-rgb: var(--${escapeHtml(c)}-rgb)"></button>`;
    }).join('');
  }

  const tipo = document.getElementById('xtprog-destaque-tipo');
  if (tipo) {
    tipo.innerHTML = (xtDestaque.tipos || []).map(t => `
      <option value="${escapeHtml(t)}"${t === xtDestaque.tipo ? ' selected' : ''}>${
        escapeHtml(XT_DESTAQUE_ROTULO_TIPO[t] || t)}</option>`).join('');
  }

  // A prévia acende com o formato escolhido mesmo com o destaque DESLIGADO —
  // é o único jeito de escolher cor e formato sem ter de ligar o destaque, ver,
  // e desligar de novo.
  const previa = document.getElementById('xtprog-previa');
  if (previa) previa.dataset.xtTipo = xtDestaque.tipo;
}

/**
 * O catálogo de pontos de encaixe e de eventos — "onde uma extensão pode
 * entrar".
 *
 * ⚠️ **Sai do CATÁLOGO DO BACKEND, e não de uma lista escrita aqui.** É a
 * mesma regra das cores do destaque, e pelo mesmo motivo: duas listas do mesmo
 * conjunto divergem no primeiro dia em que alguém acrescenta um ponto num lado
 * só — e o sintoma seria a tela oferecendo um ponto que não existe, ou
 * escondendo um que existe.
 *
 * ⚠️ Assíncrona e tolerante: a lista de extensões **não pode** deixar de
 * pintar porque o catálogo falhou. Por isso ela não é esperada por
 * `_xtPintarLista` — é disparada e esquecida.
 */
async function _xtPintarCatalogo() {
  const alvo = document.getElementById('xtprog-catalogo');
  if (!alvo) return;

  let pontos = [];
  let eventos = [];
  let consultas = [];
  try {
    const [a, b, c] = await Promise.all([
      window.pywebview.api.list_encaixes_programa(),
      window.pywebview.api.list_eventos_programa(),
      window.pywebview.api.list_consultas_programa(),
    ]);
    pontos = (a && a.success) ? (a.pontos || []) : [];
    eventos = (b && b.success) ? (b.eventos || []) : [];
    consultas = (c && c.success) ? (c.consultas || []) : [];
  } catch (e) {
    console.error('[extensoes] falha ao ler o catálogo:', e);
    alvo.innerHTML = '<p class="config-nota">Não deu para ler o catálogo agora.</p>';
    return;
  }

  // Quem já ocupa o ponto aparece ao lado — é o que responde "esse ponto está
  // ocupado?" sem obrigar a cruzar as duas listas com o olho.
  const quem = (lista, guardia) => {
    if (!lista.length) return '';
    const nomes = lista.map(x => escapeHtml(x.nome)).join(', ');
    return ` <span class="xtprog-cat-quem${guardia ? ' xtprog-cat-guardia' : ''}">· ${nomes}</span>`;
  };

  const linhaPonto = p => `
    <div class="xtprog-cat-linha">
      <span class="xtprog-cat-nome">${escapeHtml(p.ponto)}</span>
      <span class="xtprog-cat-onde">${escapeHtml(p.onde)}${quem(p.encaixados, false)}</span>
    </div>`;

  const linhaEvento = ev => {
    const guardias = (ev.assinantes || []).filter(x => x.guardia);
    const marca = ev.guardia_cabe
      ? ' <span class="xtprog-cat-guardia" title="Uma extensão pode barrar esta ação">⚠ aceita guardiã</span>'
      : '';
    return `
      <div class="xtprog-cat-linha">
        <span class="xtprog-cat-nome">${escapeHtml(ev.nome)}</span>
        <span class="xtprog-cat-onde">${escapeHtml(ev.quando)}${marca}${
          quem(ev.assinantes || [], guardias.length > 0)}</span>
      </div>`;
  };

  alvo.innerHTML = `
    <div>
      <div class="xtprog-cat-grupo-titulo">Pontos de encaixe · a extensão desenha ou age</div>
      ${pontos.map(linhaPonto).join('')}
    </div>
    <div>
      <div class="xtprog-cat-grupo-titulo">Eventos · o programa avisa</div>
      ${eventos.map(linhaEvento).join('')}
    </div>
    <div>
      <div class="xtprog-cat-grupo-titulo">Consultas · o programa pergunta</div>
      ${consultas.map(c => `
        <div class="xtprog-cat-linha">
          <span class="xtprog-cat-nome">${escapeHtml(c.nome)}</span>
          <span class="xtprog-cat-onde">${escapeHtml(c.quando)}${quem(c.respondem || [], false)}</span>
        </div>`).join('')}
    </div>`;
}

function _xtPintarLista() {
  _xtPintarDestaque();
  // Disparado e esquecido, de propósito — ver o aviso em `_xtPintarCatalogo`.
  _xtPintarCatalogo();

  const lista = document.getElementById('xtprog-lista');
  if (!lista) return;

  if (!(xtArvore.pastas || []).length && !(xtArvore.extensoes || []).length) {
    lista.innerHTML = `<p class="plugins-vazio">Nenhuma extensão em
      <code>External/extensions/</code> ainda. Veja
      <b>Arquivos › Como adicionar › Extensões</b>
      para criar a primeira.</p>`;
    return;
  }

  lista.innerHTML = _xtCorpoHtml(xtArvore);
  // Reaproveita o arraste genérico de `config-plugins.js` — mousedown/
  // mousemove/mouseup, e nunca a API nativa de drag-and-drop do HTML5, que
  // não dispara de forma confiável no WebView2.
  if (typeof _pluginsWireDnd === 'function') {
    _pluginsWireDnd(lista, '.xtprog-pastas-nivel',
                    ':scope > .xtprog-pasta-titulo > .xtprog-pasta-handle');
    _pluginsWireDnd(lista, '.xtprog-itens-nivel', ':scope > .plugin-handle');
  }
}
