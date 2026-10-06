// ═══════════════════════════════════════ Configurações → Temas ══
// Troca e grava o tema da interface. Markup em `config-tema-template.js`.
//
// A chave mora no `settings.json` (global), e não no workspace do projeto: o
// tema é sobre como o usuário quer VER o programa, não sobre um projeto. É o
// oposto das Preferências do Designer,
// que descrevem a cara de um projeto e por isso ficam com ele.
//
// ⚠️ Sem botão "Salvar", ao contrário das outras categorias do trilho. Um tema
// não se julga por um botão de rádio marcado: só se julga vendo. O clique
// aplica e grava na mesma hora, e desfazer é um clique no tema anterior.
// Registrado em `Saída das skills/Padrões de interface/Exceções.md`.

const TEMA_PADRAO = 'ardosia';
const TEMAS_VALIDOS = ['ardosia', 'carvao', 'papel', 'dracula', 'obsidiana'];

// ⚠️ Tema vindo de EXTENSÃO SAIU (P9, D37: o programa já tem temas, e a
// extensão serve para acrescentar o que ele não tem). Até 23/09/2026 ele era
// gravado como `ext:{caminho da extensão}`. Quem ainda tiver essa chave em
// `settings` não pode ficar sem folha de estilo (D20): cai no padrão, a
// escolha é regravada UMA vez, e um toast diz o que aconteceu.
const _TEMA_ANTIGO_DE_EXTENSAO = 'ext:';
let _temaDeExtensaoRegravado = false;

function _temaDeExtensaoSaiu() {
  if (_temaDeExtensaoRegravado) return;
  _temaDeExtensaoRegravado = true;
  appSettings = { ...appSettings, tema: TEMA_PADRAO };
  Promise.resolve()
    .then(() => window.pywebview.api.save_settings_parcial({ tema: TEMA_PADRAO }))
    .catch(e => console.error('[tema] não deu para regravar o tema padrão:', e));
  if (typeof showToast === 'function') {
    showToast('O tema escolhido vinha de uma extensão e saiu; voltou ao padrão.', true);
  }
}

// O <link> que o index.html deixa pronto. Trocar o href dele é tudo o que a
// troca de tema faz — o navegador baixa a nova folha e repinta sozinho, porque
// os 33 arquivos de estilo consomem tudo por `var(--…)` e nenhum deles sabe
// que temas existem.
function aplicarTema(chave) {
  const link = document.getElementById('tema-css');
  if (typeof chave === 'string' && chave.startsWith(_TEMA_ANTIGO_DE_EXTENSAO)) {
    _temaDeExtensaoSaiu();
  }
  const tema = TEMAS_VALIDOS.includes(chave) ? chave : TEMA_PADRAO;
  if (link) link.href = `estilos/tema/tema-${tema}.css`;
  return tema;
}

// Chamado na abertura do programa, antes de a aba Configurações existir.
// Separado do `init` de propósito: o tema tem que valer na primeira pintura,
// e a aba Configurações só monta quando o usuário entra nela.
function aplicarTemaGravado() {
  aplicarTema(appSettings.tema || TEMA_PADRAO);
}

async function initConfigTema() {
  const atual = aplicarTema(appSettings.tema || TEMA_PADRAO);

  const marcado = document.getElementById(`cfg-tema-${atual}`);
  if (marcado) marcado.checked = true;

  // Clique delegado na lista, e não rádio a rádio: mesmo motivo do trilho de
  // categorias — os cartões vêm do template e um listener por elemento se
  // perderia se a lista mudasse.
  const lista = document.querySelector('.config-tema-lista');
  if (lista && !lista._wired) {
    lista._wired = true;
    lista.addEventListener('change', async (ev) => {
      const radio = ev.target.closest('input[name="cfg-tema"]');
      if (radio) await salvarConfigTema(radio.value);
    });
  }

  const btnSalvar = document.getElementById('btn-save-tema');
  if (btnSalvar && !btnSalvar._wired) {
    btnSalvar._wired = true;
    btnSalvar.addEventListener('click', salvarConfigTemaPeloBotao);
  }
}

// ⚠️ O clique no cartão JÁ gravou — este botão nunca tem nada pendente. Ele
// existe para a barra de ações desta categoria ficar igual à das outras, e o que
// faz é regravar a escolha atual e confirmar em voz alta. É também a segunda
// chance de quem viu a gravação falhar no clique.
async function salvarConfigTemaPeloBotao() {
  const marcado = document.querySelector('input[name="cfg-tema"]:checked');
  const chave = (marcado && marcado.value) || appSettings.tema || TEMA_PADRAO;
  if (await salvarConfigTema(chave)) showToast('Tema salvo!');
}

async function salvarConfigTema(chave) {
  const tema = aplicarTema(chave);   // aplica primeiro: o feedback é instantâneo
  // ⚠️ `aplicarTema` devolve a chave EFETIVA — um nome inválido vira o padrão,
  // e é essa correção que precisa ir para o disco.

  // ⚠️ PATCH PARCIAL, E NUNCA `save_settings` COM O `appSettings` INTEIRO.
  // O comentário que estava aqui dizia o contrário, e era ele que trazia o
  // defeito de volta: `appSettings` é carregado UMA vez, no boot (`app.js`), e
  // `save_settings` grava o dicionário inteiro. Mandar a foto do boot com uma
  // chave trocada APAGA tudo que outra tela gravou depois dele — e o sintoma
  // não parece ter nada a ver com tema: o usuário apagava um produto em
  // Configurações > Trabalhos, trocava o tema, e os produtos de fábrica
  // voltavam sozinhos.
  //
  // O `save_settings_parcial` existe exatamente para isso, e o docstring dele
  // (em `configuracoes.py`) já contava esta história — faltava esta tela e a
  // dos ícones terem sido migradas.
  const r = await window.pywebview.api.save_settings_parcial({ tema });
  if (!r.success) {
    showToast('Tema aplicado, mas não foi possível gravar a escolha.', true);
    return false;
  }
  appSettings = { ...appSettings, tema };
  // Devolve se gravou: quem chamou pelo botão precisa saber se pode confirmar,
  // e sem isso a tela diria "salvo" logo depois de dizer que não salvou.
  return true;
}
