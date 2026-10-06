// ═══════════════════════════════════════════════ MODAL PADRÃO ══
// O construtor único do modal de confirmação do projeto — o desenho registrado
// em `Padrões de interface/Estrutura das telas/Modal padrão.md`.
//
// ⚠️ Ele morava dentro de `arquivos-crud.js`, com o nome `_arqModal`, e já tinha
// CINCO donos: a biblioteca de Arquivos, o Preparar projeto, as Tags, os
// Estilos e cores e as Regras. A regra do projeto é explícita — "componente com
// dois donos vira compartilhado, senão as duas cópias divergem em medida e em
// cor sem ninguém perceber" —, e o prefixo `_arq` tinha ficado estreito: quem
// abre o modal do Preparar projeto não está mexendo em arquivo nenhum.
//
// Acoplamento zero de propósito: usa só `document` e as classes de `modais.css`.
// Por isso a ordem dos <script> não o afeta — todas as chamadas são de dentro
// de funções, e o global já existe quando qualquer uma delas roda.
//
// Devolve o `overlay` já no DOM. Quem chama pode usá-lo para achar os campos
// que injetou em `bodyHtml`.
//
// `onConfirm(overlay, showErr)` roda no clique do confirmar:
//   · devolver `false`  → o modal FICA aberto (é assim que se mostra um erro);
//   · qualquer outra coisa → o modal fecha.
//
// `semCancelar: true` tira o botão "Cancelar" — para modal SÓ DE LEITURA
// (nada a confirmar nem a cancelar, ex.: "Ver a documentação"), onde os dois
// botões perguntando a mesma coisa ("Fechar" e "Cancelar") é que confunde.
// A confirmação que DEVOLVE a resposta, para quem precisa de um `true`/`false`
// no meio de um fluxo — e não de um `onConfirm` que segue sozinho.
//
// ⚠️ RESOLVE NOS TRÊS CAMINHOS DE SAÍDA — Confirmar, Cancelar e clique fora.
// `abrirModalPadrao` não devolve promessa, e quem resolve só no Confirmar deixa
// o gesto pendurado para sempre quando o usuário cancela.
//
// ⚠️ ESTA FUNÇÃO SUBSTITUI O `confirm()` NATIVO, e é por isso que ela existe: o
// `confirm` do WebView2 é do sistema, sai branco no meio da tela escura e não
// alcança token de tema nenhum. Não há uso legítimo dele no front — nem de
// `alert()` (é `showToast`) nem de `prompt()` (é campo inline).
//
// O molde nasceu triplicado — `chat-lista.js::_chatConfirmarRemocao`, o
// descarte do Editor e a substituição de fluxo da Oficina —, e a regra do
// projeto é a mesma dos selos e do Interruptor: componente com dois donos vira
// compartilhado, senão as cópias divergem sem ninguém perceber.
// eslint-disable-next-line no-unused-vars
function perguntarNaModal({ title, bodyHtml, confirmLabel, classe }) {
  return new Promise((resolve) => {
    let confirmou = false;
    const overlay = abrirModalPadrao({
      title, bodyHtml, confirmLabel, classe,
      onConfirm: () => { confirmou = true; },
    });
    new MutationObserver((_m, obs) => {
      if (!overlay.isConnected) { obs.disconnect(); resolve(confirmou); }
    }).observe(document.body, { childList: true });
  });
}

function abrirModalPadrao({ title, bodyHtml, confirmLabel, onConfirm, classe, semCancelar }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal${classe ? ` ${classe}` : ''}">
      <h3>${title}</h3>
      ${bodyHtml}
      <div class="modal-error hidden"></div>
      <div class="modal-actions">
        ${semCancelar ? '' : '<button type="button" class="btn btn-muted modal-cancel">Cancelar</button>'}
        <button type="button" class="btn btn-special modal-confirm">${confirmLabel || 'Confirmar'}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  // ⚠️ ESC FECHA, e a falta disso já deixou um usuário sem saída: um modal em
  // que o Cancelar não responde é um programa travado, e a única alternativa
  // que sobrava era fechar o programa inteiro. Esc é a saída que não depende de
  // acertar nenhum botão com o mouse — e o ouvinte se remove no fechamento, em
  // qualquer um dos três caminhos, porque `close` é um só.
  const noEsc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  const close = () => {
    document.removeEventListener('keydown', noEsc, true);
    overlay.remove();
  };
  // Na fase de CAPTURA: um campo dentro do corpo do modal pode parar o Escape
  // antes de ele subir, e aí a saída de emergência não sairia.
  document.addEventListener('keydown', noEsc, true);
  const errBox = overlay.querySelector('.modal-error');
  const showErr = (m) => { errBox.textContent = m; errBox.classList.remove('hidden'); };
  const btnCancelar = overlay.querySelector('.modal-cancel');
  if (btnCancelar) btnCancelar.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('.modal-confirm').addEventListener('click', async () => {
    const ok = await onConfirm(overlay, showErr);
    if (ok !== false) close();
  });
  return overlay;
}
