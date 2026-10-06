// ══════════════════════════════════════════════════════ ROTINA: ESPERA ══
// O freio, e só o freio. Não roda sob demanda — não é "processada", é um
// estado que já existe (o laço em
// backend/modulos/agentes/automacao/acionamentos_espera.py).
//
// Este card só torna esse estado visível: ligada/desligada e quantos segundos
// de silêncio ela exige. Liga/desliga fica na sub-aba Acionamentos, no toggle
// data-agent="espera".
//
// ⚠️ "A janela do LM Studio está ocupada" NÃO é assunto deste card, e desde
// 28/08/2026 não aparece mais aqui: quem responde por isso é o Revezamento
// (`revezamento.js`), que fica na base e não tem chave. Enquanto as duas coisas
// dividiam este card, DESLIGAR o freio — o gesto de quem quer que o ciclo comece
// logo — escondia junto a única frase que explicava "a outra aba de projeto está
// com o modelo". Ficava tudo parado e sem nada na tela dizendo por quê.

async function initEsperaCard() {
  _initSimpleAgentCard('espera');
  await _refreshEsperaStatus();

  const irBtn = document.getElementById('btn-espera-ir-acionamentos');
  if (irBtn && !irBtn._wired) {
    irBtn._wired = true;
    irBtn.addEventListener('click', () => {
      const alvo = document.querySelector('.agentes-subtab-btn[data-asubtab="asubtab-acionamentos"]');
      if (alvo) alvo.click();
    });
  }
}

async function _refreshEsperaStatus(status) {
  const r = status || await window.pywebview.api.get_espera_status(currentProject);
  if (!r.success) return;

  _setSimpleAgentBadge('espera', r.ativo ? 'done' : 'idle');
  const badge = document.getElementById('espera-badge');
  if (badge) badge.textContent = r.ativo ? 'Ativada' : 'Desativada';

  const d = r.debounces || {};
  const trio = `${d.t1 ?? r.debounce_segundos}s / ${d.t2 ?? '—'}s / ${d.t3 ?? '—'}s`;
  const sum = document.getElementById('espera-summary');
  if (sum) sum.textContent = `${trio} de silêncio`;

  const area = document.getElementById('espera-result-summary');
  if (area) {
    // Três causas diferentes para o mesmo "parada", e elas não se misturam.
    // A quarta — a janela do LM Studio ocupada — saiu daqui: ela é do card do
    // Revezamento, e repeti-la nos dois faria a mesma frase aparecer duas
    // vezes na mesma tela, com um dos dois cards podendo estar desligado.
    if (r.ativo) {
      area.textContent = 'O Detector avisa, e ela segura até o código parar de mudar. '
        + `Depois do silêncio, libera em três tempos: ${d.t1}s os determinísticos, `
        + `${d.t2}s os índices para agente externo, ${d.t3}s o que é feito para você ler.`;
    } else if (!r.espera_ligada) {
      area.textContent = 'Espera desligada — o ciclo é liberado assim que a mudança chega, '
        + 'sem segurar nada. A detecção continua de pé.';
    } else if (!r.algum_agente_ligado) {
      area.textContent = 'Nenhuma rotina ligada em Acionamentos — não há o que liberar.';
    } else {
      area.textContent = 'O Detector não está de pé — use "Ativar tudo" em Acionamentos '
        + 'para o programa passar a vigiar o disco.';
    }
  }
}

// Chamado pelos eventos que já existem de Acionamentos, para refletir sem
// precisar reabrir a aba. Aceita o status já consultado, para não pedir a
// mesma coisa duas vezes ao backend.
function esperaAtualizarEstado(status) {
  if (document.getElementById('agente-espera')) _refreshEsperaStatus(status);
}
