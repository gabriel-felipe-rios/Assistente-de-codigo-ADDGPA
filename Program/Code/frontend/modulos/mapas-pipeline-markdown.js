// ══════════════════ VISUALIZAR PIPELINE — LEITURA "MARKDOWN" ══
// A sexta leitura: o `pipeline.md` como está no disco. É a origem das outras
// cinco, e é por isso que ela continua existindo mesmo depois de a tela ficar
// gráfica — quando o desenho não bate com o que se esperava, o arquivo é onde
// se confere.
//
// Era um `<pre>` cru. Ganhou a barra com o caminho e o tamanho, a numeração de
// linha e o botão de copiar. O realce é mínimo de propósito: título, citação
// (os avisos do agente), caminho de arquivo e o "por onde". Não é um
// renderizador de Markdown — é o arquivo cru, legível.

function vpMontarMarkdown() {
  const linhas = String(_vpDados.markdown || '').split('\n');
  document.getElementById('vp-md-caminho').textContent =
    'Automação/Rotinas/Pipeline/pipeline.md';
  document.getElementById('vp-md-tamanho').textContent =
    `${_vpDados.passos} passos · ${linhas.length} linhas`;
  document.getElementById('vp-md-gutter').innerHTML = linhas.map((_, i) => i + 1).join('<br>');
  document.getElementById('vp-md-texto').innerHTML = linhas.map(vpRealcarLinha).join('\n');
}

// Realce mínimo: título, citação (os avisos do agente), caminho de arquivo e o
// "por onde". Não é um renderizador de Markdown — é o arquivo cru, legível.
function vpRealcarLinha(linha) {
  let texto = escapeHtml(linha)
    .replace(/`([^`]*)`/g, '<span class="vp-md-arq">`$1`</span>')
    .replace(/\*\*via\*\*/g, '<span class="vp-md-via">**via**</span>');
  if (linha.startsWith('#')) return `<span class="vp-md-h">${texto}</span>`;
  if (linha.startsWith('&gt;') || linha.startsWith('>')) return `<span class="vp-md-cmt">${texto}</span>`;
  return texto || '&nbsp;';
}

function vpCopiarMarkdown() {
  if (!_vpDados) return;
  navigator.clipboard.writeText(_vpDados.markdown)
    .then(() => showToast('pipeline.md copiado.'));
}
