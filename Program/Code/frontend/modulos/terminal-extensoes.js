// ══════════════════════════════════════════ TERMINAL › EXTENSÕES ══
// O que a aba Terminal oferece às extensões: os dois pontos de encaixe
// (`terminal.barra` e `terminal.painel`) e o aviso antes do ▶ Executar
// (`terminal.vai_rodar`).
//
// Saiu de `terminal.js` pelo teto de 500 linhas da AMF. O estado continua
// lá (`_termScriptPath`, `_termOrigemManual`) — este arquivo só o lê.

// M2 · os dois pontos das extensões de tipo 7 na aba Terminal, com o MESMO
// contexto. Separada de `initTerminalTab` porque `encaixes.js` a chama também
// quando uma extensão é LIGADA com a aba já aberta — D13: ligar funciona na
// hora, sem trocar de aba e sem reiniciar. ⚠️ O nome é chamado de fora (por
// `encaixes.js` e pela extensão Servidor local com recarga): não renomeie.
// eslint-disable-next-line no-unused-vars
function xtPintarEncaixeDoTerminal() {
  if (typeof xtEncaixe !== 'function') return;
  const contexto = {
    projeto: currentProject,
    caminho: _termScriptPath || '',
    origem: _termOrigemManual ? 'manual' : 'principal',
  };
  const barra = document.getElementById('terminal-encaixe-barra');
  if (barra) xtEncaixe('terminal.barra', barra, contexto);
  const painel = document.getElementById('terminal-encaixe');
  if (painel) xtEncaixe('terminal.painel', painel, contexto);
}

/**
 * G3 · Antes do ▶ Executar. Devolve 'rodar', 'parou' (barrada) ou 'assumida'.
 *
 * Tomar a execução é reescrever o `dado` — o mesmo mecanismo com que o
 * `editor.vai_salvar` troca o texto; `xtEmitir` não sabe de nada disso.
 */
// eslint-disable-next-line no-unused-vars
async function _termPerguntarAsExtensoes(projeto, caminho, origem) {
  if (typeof xtEmitir !== 'function') return 'rodar';
  const aviso = await xtEmitir('terminal.vai_rodar', { projeto, caminho, origem });
  if (aviso.barrado) { showToast(aviso.por ? `${aviso.por}: ${aviso.motivo}` : aviso.motivo, true); return 'parou'; }
  const d = aviso.dado || {};
  if (d.assumido_por) {
    _termMostrarAssumido(String(d.assumido_por), String(d.selo || 'assumido'));
    return 'assumida';
  }
  return 'rodar';
}

// A aba continua sendo do programa; a extensão só disse "é comigo". A saída diz
// quem ficou com a execução, e o selo vai no mesmo lugar do "exit code". O
// botão continua ▶ Executar (não vira ■ Parar): não há processo do Terminal.
function _termMostrarAssumido(quem, selo) {
  const saida = document.getElementById('terminal-output');
  if (saida) {
    saida.innerHTML =
      `<span class="terminal-placeholder">▶ Executar ficou com a extensão «${escapeHtml(quem)}».</span>`;
  }
  const badge = document.getElementById('terminal-exit-badge');
  if (!badge) return;
  badge.textContent = selo;
  badge.className = 'terminal-exit-badge ok';
}
