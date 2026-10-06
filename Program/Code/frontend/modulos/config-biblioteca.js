// ═══════════════════════════════════ Configurações → Arquivos ══
// Qual `.md` é o principal de uma skill, e o que fazer quando a regra não
// resolve. Markup em `config-biblioteca-template.js`; quem OBEDECE é o backend
// (`arquivos_copia.py::_arquivo_principal_do_item`), na hora de ligar um item.
//
// As três chaves moram no `settings.json` (global), e não no workspace do
// projeto: são sobre como o programa lê a BIBLIOTECA, que é uma só para todos
// os projetos — mesmo critério de `assistentes_externos`.
//
// ⚠️ Grava NO BOTÃO, e não no clique, ao contrário de Notificações: há um campo
// de texto (o nome fixo), e gravar a cada tecla atravessaria a ponte dezenas de
// vezes por palavra. O Salvar lê os dois radios e o campo de uma vez.

// Espelho de `PADROES_DA_BIBLIOTECA` (`padroes_de_fabrica.py`) — a queda
// quando o `settings.json` foi gravado antes de a categoria existir.
const BIBLIOTECA_PRINCIPAL_PADRAO = 'nome-da-pasta';
const BIBLIOTECA_NOME_FIXO_PADRAO = 'SKILL.md';
const BIBLIOTECA_EMPATE_PADRAO = 'recusar';

function initConfigBiblioteca() {
  _cfbPintar();
  const btn = document.getElementById('btn-save-biblioteca');
  if (btn && !btn._wired) {
    btn._wired = true;
    btn.addEventListener('click', salvarConfigBiblioteca);
  }
}

async function salvarConfigBiblioteca() {
  const principal = document.querySelector('#cfb-principal input:checked');
  const empate = document.querySelector('#cfb-empate input:checked');
  const campo = document.getElementById('cfb-nome-fixo');
  const patch = {
    biblioteca_principal_skill: principal ? principal.value : BIBLIOTECA_PRINCIPAL_PADRAO,
    // Vazio cai no padrão em vez de gravar "": a regra "nome fixo" com nome
    // vazio recusaria toda skill da biblioteca sem dizer por quê.
    biblioteca_nome_fixo: ((campo && campo.value) || '').trim() || BIBLIOTECA_NOME_FIXO_PADRAO,
    biblioteca_empate: empate ? empate.value : BIBLIOTECA_EMPATE_PADRAO,
  };
  const r = await window.pywebview.api.save_settings_parcial(patch);
  if (!r || !r.success) { showToast('Não foi possível gravar a configuração de arquivos.', true); return; }
  // Reatribuir o global é parte da gravação: a próxima tela a gravar leria o
  // valor velho daqui e o mandaria de volta.
  appSettings = Object.assign({}, appSettings, patch);
  _cfbPintar();
  showToast('Configuração de arquivos salva!');
}

function _cfbPintar() {
  const s = appSettings || {};
  const principal = s.biblioteca_principal_skill || BIBLIOTECA_PRINCIPAL_PADRAO;
  const empate = s.biblioteca_empate || BIBLIOTECA_EMPATE_PADRAO;
  document.querySelectorAll('#cfb-principal input').forEach(i => { i.checked = i.value === principal; });
  document.querySelectorAll('#cfb-empate input').forEach(i => { i.checked = i.value === empate; });
  const campo = document.getElementById('cfb-nome-fixo');
  if (campo) campo.value = s.biblioteca_nome_fixo || BIBLIOTECA_NOME_FIXO_PADRAO;
}
