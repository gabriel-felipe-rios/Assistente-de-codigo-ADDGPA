// ════════════════════════════ ABA: INSPETOR — candidatos no código-fonte ══
// Do elemento capturado à lista de lugares prováveis no código. Separado de
// `inspetor.js` pelo teto de linhas da AMF. Backend: inspetor_candidatos.py.
//
// Fica dentro de um bloco recolhido ("▸ Restringir a um trecho") na própria
// tela de Capturar, e não numa sub-aba: escolher um candidato é OPCIONAL —
// sem escolher nenhum, o relatório sai com os candidatos em uma linha cada.
// Por isso nenhum vem pré-selecionado: a seleção automática do primeiro fazia
// o relatório cair sempre no nível pesado.

let _inspRestringirAberto = false;
let _inspTrechosAbertos = {};

function inspToggleRestringir() {
  _inspRestringirAberto = !_inspRestringirAberto;
  document.getElementById('insp-candidatos-list')
    .classList.toggle('hidden', !_inspRestringirAberto);
  _inspAtualizarCabecalhoRestringir();
}

function _inspAtualizarCabecalhoRestringir(texto) {
  const seta = _inspRestringirAberto ? '▾' : '▸';
  document.getElementById('insp-restringir-rotulo').textContent =
    `${seta} Restringir a um trecho`;
  const corte = document.getElementById('insp-corte');
  if (texto !== undefined) { corte.textContent = texto; return; }
  if (_inspTotalCandidatos > _inspCandidatos.length) {
    // Sem este aviso o relatório mente por omissão: parece que os candidatos
    // mostrados são os únicos que existem.
    corte.textContent = `(mostrando ${_inspCandidatos.length} de ${_inspTotalCandidatos})`;
  } else if (_inspCandidatos.length) {
    corte.textContent = `(${_inspCandidatos.length})`;
  } else {
    corte.textContent = '— nenhum candidato';
  }
}

async function inspBuscarCandidatos() {
  if (!_inspUltimaCaptura) return;

  const bloco = document.getElementById('insp-restringir');
  bloco.classList.remove('hidden');
  _inspAtualizarCabecalhoRestringir('— procurando candidatos…');

  const r = await window.pywebview.api.inspetor_buscar_candidatos(
    currentProject, _inspUltimaCaptura);

  if (!r || !r.success) {
    // Erro de verdade (exceção no backend). Falta de índice ou de nome não
    // chega mais aqui: vira aviso numa resposta bem-sucedida.
    _inspCandidatos = [];
    _inspTotalCandidatos = 0;
    _inspRenderCandidatos((r && r.error) || 'Não foi possível buscar candidatos.');
    return;
  }

  _inspCandidatos = r.candidatos || [];
  _inspTotalCandidatos = r.total || _inspCandidatos.length;
  _inspCandidatoSelecionado = null;
  _inspTrechosAbertos = {};
  _inspRenderCandidatos(r.aviso);
  _inspRenderEnvio();
}

function _inspRotuloConfianca(c) {
  if (c === 'alta') return 'Alta confiança';
  if (c === 'media') return 'Média confiança';
  return 'Baixa confiança';
}

function _inspRotuloFonte(f) {
  if (f === 'ambas') return 'símbolo + texto de interface';
  if (f === 'interface') return 'texto de interface';
  if (f === 'simbolo') return 'índice de símbolos';
  return 'uso no código';
}

function _inspRenderCandidatos(aviso) {
  const lista = document.getElementById('insp-candidatos-list');
  const nota = aviso ? `<div class="insp-aviso">${_inspEsc(aviso)}</div>` : '';

  if (!_inspCandidatos.length) {
    lista.innerHTML = nota +
      '<div class="insp-empty">Nenhum candidato encontrado pra esse elemento — copie assim mesmo: a IA localiza pelo relatório da captura.</div>';
    _inspAtualizarCabecalhoRestringir();
    return;
  }

  lista.innerHTML = nota + _inspCandidatos.map((c, i) => `
    <div class="insp-candidate-card" data-idx="${i}">
      <div class="insp-candidate-head">
        <span class="insp-candidate-path">${_inspEsc(c.file)}:${_inspEsc(c.line)}</span>
        <span class="insp-confidence ${c.confidence}">${_inspRotuloConfianca(c.confidence)}</span>
      </div>
      <div class="insp-candidate-snippet">${_inspEsc(c.snippet || c.name)}</div>
      <div class="insp-candidate-motivo">${_inspRotuloFonte(c.fonte)} · ${_inspEsc(c.motivo || '')}</div>
      <div class="insp-candidate-actions">
        <button class="btn btn-primary btn-sm" onclick="inspSelecionarCandidato(${i})">Selecionar este</button>
        <button class="insp-expand-toggle" onclick="inspToggleTrecho(${i})" id="insp-trecho-btn-${i}">▸ ver o trecho</button>
      </div>
      <div class="ts-code-lines insp-expand-code hidden" id="insp-trecho-${i}"></div>
    </div>
  `).join('');

  _inspAtualizarCabecalhoRestringir();
}

// Seleção com alternância: clicar no já selecionado desmarca e o relatório
// volta ao nível enxuto. Nenhum vem marcado de fábrica.
function inspSelecionarCandidato(idx) {
  const mesmo = _inspCandidatoSelecionado === _inspCandidatos[idx];
  _inspCandidatoSelecionado = mesmo ? null : _inspCandidatos[idx];

  document.querySelectorAll('#insp-candidatos-list .insp-candidate-card').forEach((el, i) => {
    const selecionado = !mesmo && i === idx;
    el.classList.toggle('selected', selecionado);
    const botao = el.querySelector('.btn');
    if (botao) botao.textContent = selecionado ? 'Selecionado ✓' : 'Selecionar este';
  });
  _inspRenderEnvio();
}

// Expande/recolhe o trecho de código de um candidato — carrega sob demanda
// (só quando o usuário clica), não pré-carrega nada.
async function inspToggleTrecho(idx) {
  const c = _inspCandidatos[idx];
  if (!c) return;
  const btn = document.getElementById(`insp-trecho-btn-${idx}`);
  const code = document.getElementById(`insp-trecho-${idx}`);
  _inspTrechosAbertos[idx] = !_inspTrechosAbertos[idx];

  if (!_inspTrechosAbertos[idx]) {
    code.classList.add('hidden');
    btn.textContent = '▸ ver o trecho';
    return;
  }
  btn.textContent = '▾ ver o trecho';
  code.classList.remove('hidden');

  if (code.dataset.loaded === '1') return;
  code.innerHTML = '<div class="tree-loading">Carregando...</div>';
  const r = await window.pywebview.api.inspetor_ler_trecho(currentProject, c.file, c.line);
  if (!r.success) {
    code.textContent = 'Não foi possível carregar: ' + (r.error || '');
    return;
  }
  // Reusa o componente de código das abas Análise (Tree-sitter/Símbolos): cada
  // linha é uma `.ts-code-line`; a linha encontrada recebe `.highlight` (fundo
  // e borda em azul, texto em cor plena; o resto fica em `--text-muted`).
  code.innerHTML = '';
  for (const l of r.trecho) {
    const row = document.createElement('div');
    row.className = 'ts-code-line' + (l.numero === r.linha_alvo ? ' highlight' : '');
    const num = document.createElement('span');
    num.className = 'ts-code-linenum';
    num.textContent = l.numero;
    const txt = document.createElement('span');
    txt.className = 'ts-code-text';
    txt.textContent = l.texto;
    row.appendChild(num);
    row.appendChild(txt);
    code.appendChild(row);
  }
  code.dataset.loaded = '1';
}
