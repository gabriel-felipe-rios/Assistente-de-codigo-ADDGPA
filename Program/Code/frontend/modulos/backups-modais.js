// ═══ BACKUPS → os três modais ══════════════════════════════════════════════
//
// Saiu de `backups.js` pela AMF: os dois juntos passavam de 500 linhas. Aqui
// mora só o MARKUP dos três modais e a fiação dos botões; a lógica de cada um
// continua em `backups.js`.
//
// ⚠️ O modal "Fazer cópia" NÃO tem "Copiar assim mesmo". O único botão de ação
// é "▶ Gerar o que falta e copiar" — os três pré-requisitos são parser puro e
// nenhum chama o modelo, então faltar não é impasse.

// ── Modais ───────────────────────────────────────────────────────────────────

function bkInjetarModais() {
  if (bkModaisInjetados) return;
  bkModaisInjetados = true;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="modal-overlay hidden" id="bk-modal-create">
      <div class="modal modal-largo">
        <h3>📸 Fazer cópia</h3>
        <label>Nome (automático — data e hora)</label>
        <div class="bk-auto-name" id="bk-auto-name"></div>
        <label>Anotação <span style="opacity:.6">(opcional)</span></label>
        <textarea rows="2" class="bk-note-input" id="bk-note-input"
          placeholder="ex.: antes de deixar a IA mexer no chat"></textarea>
        <div id="bk-create-body"></div>
        <div class="modal-actions">
          <!-- ⚠️ data-trava-ia e data-trava-ia-motivo são as DUAS CAMADAS DE
               TELA que faltavam ao Backup. Ele é a quinta ponta da trava desde
               que ela nasceu, mas isso só existia no motor: o botão ficava
               aceso durante uma Fila ou uma regeneração de documentação, e o
               clique só falhava DEPOIS — copiar arquivo enquanto as Rotinas os
               reescrevem guarda documentação a meio caminho, metade velha e
               metade nova, e nada avisa.
               A terceira camada (a pergunta no clique) está em bkFazerCopia.
               ⚠ Nada de crase neste comentário: o markup inteiro é um template
               literal, e uma crase aqui fecha a string no meio. -->
          <span class="bk-status hidden" id="bk-create-trava"
                data-trava-ia-motivo="backup"></span>
          <button class="btn btn-muted btn-sm" id="bk-create-cancel">Cancelar</button>
          <button class="btn btn-positive btn-sm" id="bk-create-ok"
                  data-trava-ia="backup">Fazer cópia</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay hidden" id="bk-modal-revert">
      <div class="modal modal-largo">
        <h3>↩ Reverter para esta Versão</h3>
        <p class="modal-body-text">Você vai voltar para a Versão
          <span class="bk-revert-target" id="bk-revert-target"></span>.</p>

        <div class="bk-bloco">
          <div class="bk-bloco-h">O que reverter</div>
          <label class="bk-escopo"><input type="radio" name="bk-escopo" id="bk-escopo-tudo" value="tudo" checked>
            <span>O projeto todo</span></label>
          <label class="bk-escopo"><input type="radio" name="bk-escopo" value="codigo">
            <span>Só o código</span></label>
          <label class="bk-escopo"><input type="radio" name="bk-escopo" value="documentacao">
            <span>Só a documentação gerada</span></label>
        </div>

        <div class="bk-bloco">
          <div class="bk-bloco-h">O que acontece com cada coisa</div>
          <div id="bk-naturezas"></div>
        </div>

        <label class="bk-safety-check">
          <input type="checkbox" id="bk-config-chk">
          <span>Restaurar também a <b>configuração</b> desta Versão — desfaz o
            Workspace, os Acionamentos, a configuração das Rotinas e as
            Preferências do Designer que você mudou depois.</span>
        </label>
        <label class="bk-safety-check">
          <input type="checkbox" id="bk-safety-chk" checked>
          <span>Antes de reverter, salvar uma <b>cópia de segurança do estado atual</b>
            (recomendado — é a sua rede pra desfazer).</span>
        </label>

        <div class="modal-actions">
          <button class="btn btn-muted btn-sm" id="bk-revert-cancel">Cancelar</button>
          <button class="btn btn-negative btn-sm" id="bk-revert-ok">Reverter</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay hidden" id="bk-modal-delete">
      <div class="modal">
        <h3>🗑 Excluir Versão</h3>
        <p class="modal-body-text">Excluir a Versão
          <span class="bk-revert-target" id="bk-del-target"></span>? Esta ação não pode ser desfeita.
          O conteúdo que nenhuma outra Versão usar sai do disco junto.</p>
        <div class="modal-actions">
          <button class="btn btn-muted btn-sm" id="bk-del-cancel">Cancelar</button>
          <button class="btn btn-negative btn-sm" id="bk-del-ok">Excluir</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  document.getElementById('bk-create-cancel').addEventListener('click', () => {
    bkResumoEhDoModal = false;
    bkEsconder('bk-modal-create');
  });
  document.getElementById('bk-create-ok').addEventListener('click', bkFazerCopia);
  document.getElementById('bk-revert-cancel').addEventListener('click', () => bkEsconder('bk-modal-revert'));
  document.getElementById('bk-revert-ok').addEventListener('click', bkReverter);
  document.getElementById('bk-del-cancel').addEventListener('click', () => bkEsconder('bk-modal-delete'));
  document.getElementById('bk-del-ok').addEventListener('click', bkExcluir);
}
