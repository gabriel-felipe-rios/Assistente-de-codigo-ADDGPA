// ═══════════════════════════════ ABA: INSPETOR — copiar para a IA ══
// Monta e copia o relatório da captura. Separado de `inspetor.js` pelo teto
// de linhas da AMF. Backend: inspetor_relatorio.py.
//
// O botão final COPIA o texto — não manda pro Chat interno. É pra colar numa
// sessão de IA externa (ex.: Claude Code) que tenha acesso ao seu projeto.
//
// ⚠️ Copiar não depende de nada estar preenchido: nem de instrução escrita,
// nem de candidato escolhido, nem de os índices existirem. Basta ter havido
// uma captura.

function _inspRenderEnvio() {
  const envio = document.getElementById('insp-envio');
  const nota = document.getElementById('insp-envio-nota');

  if (!_inspUltimaCaptura) {
    envio.classList.add('hidden');
    return;
  }
  envio.classList.remove('hidden');

  // Diz o que vai no texto copiado — a diferença entre os dois níveis do
  // relatório é grande, e o usuário não tem como adivinhar qual vai sair.
  if (_inspCandidatoSelecionado) {
    const c = _inspCandidatoSelecionado;
    nota.innerHTML = `Vai copiar: o elemento capturado + o trecho de <span class="insp-candidate-path">${_inspEsc(c.file)}:${_inspEsc(c.line)}</span>, as regras de CSS e as outras referências.`;
  } else if (_inspCandidatos.length) {
    nota.textContent = `Vai copiar: o elemento capturado + ${_inspCandidatos.length} candidato(s) em uma linha cada. Escolha um acima pra receber também o código.`;
  } else {
    nota.textContent = 'Vai copiar: o elemento capturado, pra IA localizar sozinha no código.';
  }
}

async function inspCopiarParaIA() {
  if (!_inspUltimaCaptura && !_inspCandidatoSelecionado) {
    showToast('Capture um elemento primeiro, na sub-aba Capturar.', true);
    return;
  }
  const instrucao = document.getElementById('insp-instrucao').value.trim();

  // O relatório rico (identidade do elemento + local no código + trecho real
  // + referências) é montado no backend, que tem acesso ao disco pra ler o
  // código — o frontend só copia o texto pronto.
  const btn = document.getElementById('insp-btn-copiar');
  btn.disabled = true;
  const r = await window.pywebview.api.inspetor_montar_relatorio_ia(
    currentProject, _inspCandidatoSelecionado || null, instrucao,
    _inspUltimaCaptura || null, _inspCandidatos, _inspTotalCandidatos);
  btn.disabled = false;

  if (!r || !r.success) {
    showToast((r && r.error) || 'Não foi possível montar o relatório.', true);
    return;
  }

  try {
    await navigator.clipboard.writeText(r.texto);
    const original = btn.textContent;
    btn.textContent = '✓ Copiado!';
    setTimeout(() => { btn.textContent = original; }, 1500);
  } catch (e) {
    showToast('Não foi possível copiar automaticamente — selecione o texto manualmente.', true);
  }
}
