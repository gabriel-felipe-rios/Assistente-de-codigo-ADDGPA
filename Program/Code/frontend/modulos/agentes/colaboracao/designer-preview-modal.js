// ══════════════════════════════════════════════════════ DESIGNER — MODAL DE PREVIEW DE ESTILO ══

function openStylePreviewModal(html, title) {
  const overlay = document.getElementById('modal-style-preview');
  const frame   = document.getElementById('style-preview-frame');
  const titleEl = document.getElementById('style-preview-title');
  const container = document.getElementById('style-preview-container');
  const viewport  = document.getElementById('style-preview-viewport');

  frame.srcdoc = html;
  titleEl.textContent = title || '';
  overlay.classList.remove('hidden');

  let scale = 1, tx = 0, ty = 0, dragging = false, sx = 0, sy = 0;

  function applyTransform() {
    container.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
  }

  viewport._onwheel = e => {
    e.preventDefault();
    scale = Math.min(4, Math.max(0.2, scale * (1 - e.deltaY * 0.001)));
    applyTransform();
  };
  viewport._onmousedown = e => { dragging = true; sx = e.clientX - tx; sy = e.clientY - ty; viewport.style.cursor = 'grabbing'; };
  viewport._onmousemove = e => { if (!dragging) return; tx = e.clientX - sx; ty = e.clientY - sy; applyTransform(); };
  viewport._onmouseup   = () => { dragging = false; viewport.style.cursor = 'grab'; };

  viewport.addEventListener('wheel', viewport._onwheel, { passive: false });
  viewport.addEventListener('mousedown', viewport._onmousedown);
  viewport.addEventListener('mousemove', viewport._onmousemove);
  viewport.addEventListener('mouseup',   viewport._onmouseup);
  viewport.addEventListener('mouseleave', viewport._onmouseup);
}

// Monta uma página HTML mostrando a paleta em tela cheia: cada cor vira um
// bloco com nome, hexadecimal e o uso previsto. A página usa as próprias cores
// da paleta como fundo e texto, então dá para ver o conjunto funcionando junto.
function montarPreviewPaleta(dados) {
  const cores = dados.cores || {};
  const fundo    = (cores.fundo || {}).hex || '#1a1a1a';
  const superf   = (cores.superficie || {}).hex || '#252525';
  const texto    = (cores.texto || {}).hex || '#ffffff';
  const textoSec = (cores.texto_secundario || {}).hex || '#999999';
  // O papel, não o nome da cor: desde a migração de 2026-08-25 todo acento se
  // chama pelo que faz. A reserva cobre paleta de fora, gravada à mão.
  const superfHover = (cores.superficie_hover || {}).hex || superf;
  const primaria   = (cores.primaria   || {}).hex || texto;
  const utilitaria = (cores.utilitaria || {}).hex || textoSec;

  const blocos = Object.entries(cores).map(([chave, v]) => `
    <div class="sw" style="background:${v.hex}">
      <div class="sw-meta">
        <span class="sw-key">${escapeHtml(chave)}</span>
        <span class="sw-hex">${escapeHtml(v.hex)}</span>
      </div>
    </div>
    <div class="uso"><strong>${escapeHtml(chave)}</strong> — ${escapeHtml(v.uso || '')}</div>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:${fundo};color:${texto};font-family:system-ui,-apple-system,'Segoe UI',sans-serif;padding:36px 44px}
h1{font-size:30px;margin-bottom:6px}
.desc{color:${textoSec};font-size:14px;max-width:720px;line-height:1.6}
.instr{margin:20px 0 28px;background:${superf};border-radius:8px;padding:14px 16px;font-size:13px;color:${textoSec};line-height:1.6;max-width:720px}
.grid{display:grid;grid-template-columns:190px 1fr;gap:10px 18px;align-items:center;max-width:900px}
.sw{height:58px;border-radius:8px;display:flex;align-items:flex-end;padding:7px 10px;box-shadow:inset 0 0 0 1px rgba(128,128,128,0.35)}
.sw-meta{display:flex;justify-content:space-between;width:100%;font-size:10px;font-weight:700;font-family:ui-monospace,Consolas,monospace;mix-blend-mode:difference;color:#fff}
.uso{font-size:13px;color:${textoSec};line-height:1.5}
.uso strong{color:${texto};font-family:ui-monospace,Consolas,monospace;font-size:12px}
.uso-card{max-width:900px;margin:0 0 26px}
.uso-rot{font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:${textoSec};font-weight:700;margin-bottom:7px}
.uso-caixa{background:${superf};border:1px solid ${superfHover};border-radius:10px;padding:14px 16px}
.uso-titulo{color:${texto};font-size:15px;font-weight:600}
.uso-sec{color:${textoSec};font-size:12.5px;margin:4px 0 12px}
.uso-linha{display:flex;gap:9px;align-items:center}
.uso-btn{background:${primaria};color:${fundo};border-radius:6px;padding:5px 13px;font-size:12.5px;font-weight:600}
.uso-btn2{border:1px solid ${utilitaria};color:${utilitaria};border-radius:6px;padding:5px 13px;font-size:12.5px}
.uso-hover{background:${superfHover};color:${texto};border-radius:6px;padding:5px 13px;font-size:12.5px}
</style></head><body>
<h1>${escapeHtml(dados.nome || '')}</h1>
<div class="desc">${escapeHtml(dados.descricao || '')}</div>
${dados.instrucao ? `<div class="instr">${escapeHtml(dados.instrucao)}</div>` : '<div style="height:24px"></div>'}
<div class="uso-card">
  <div class="uso-rot">Exemplo em uso</div>
  <div class="uso-caixa">
    <div class="uso-titulo">Título sobre a superfície</div>
    <div class="uso-sec">texto secundário sobre superfície — datas, metadados, placeholders</div>
    <div class="uso-linha">
      <span class="uso-btn">Ação</span>
      <span class="uso-btn2">Secundária</span>
      <span class="uso-hover">hover</span>
    </div>
  </div>
</div>
<div class="grid">${blocos}</div>
</body></html>`;
}

function closeStylePreviewModal() {
  const overlay  = document.getElementById('modal-style-preview');
  const frame    = document.getElementById('style-preview-frame');
  const container = document.getElementById('style-preview-container');
  const viewport  = document.getElementById('style-preview-viewport');

  overlay.classList.add('hidden');
  frame.srcdoc = '';
  container.style.transform = '';

  if (viewport._onwheel)     viewport.removeEventListener('wheel', viewport._onwheel);
  if (viewport._onmousedown) viewport.removeEventListener('mousedown', viewport._onmousedown);
  if (viewport._onmousemove) viewport.removeEventListener('mousemove', viewport._onmousemove);
  if (viewport._onmouseup)   { viewport.removeEventListener('mouseup', viewport._onmouseup); viewport.removeEventListener('mouseleave', viewport._onmouseup); }
  viewport._onwheel = viewport._onmousedown = viewport._onmousemove = viewport._onmouseup = null;
}
