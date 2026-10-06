// ═══════════════════════════════════ TINGIR A JANELA — A CASCA ══
// Uma borda colorida em volta da janela, uma por projeto. Serve para saber, de
// relance, em qual projeto se está — sobretudo com duas janelas do programa
// abertas lado a lado.
//
// ⚠️ NÃO É UM TEMA, E NÃO SUBSTITUI O TEMA. O tema escolhido continua valendo
// inteiro; a cor entra POR CIMA, num elemento próprio. É o comando "Peacock"
// do VS Code, e não uma segunda folha de estilo.
//
// ⚠️ AS CORES SÃO NOMES DE TOKEN, NUNCA HEXADECIMAL — e são as SEIS que o
// próprio programa já oferece no "Destacar extensões" (`XT_DESTAQUE_CORES`, em
// `backend/modulos/extensoes/constantes.py`). Mesma lista pelo mesmo motivo: o
// valor real sai do tema em execução, via `rgba(var(--{cor}-rgb), α)`, e fica
// certo nos cinco temas, inclusive no claro. Não invente uma sétima.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug }
  const SLUG = EU.slug;
  const CAMINHO = EU.caminho;

  // As seis, na ordem em que aparecem na modal.
  const TIN_CORES = [
    { valor: 'purple', rotulo: 'Roxo' },
    { valor: 'blue', rotulo: 'Azul' },
    { valor: 'green', rotulo: 'Verde' },
    { valor: 'amber', rotulo: 'Âmbar' },
    { valor: 'red', rotulo: 'Vermelho' },
    { valor: 'teal', rotulo: 'Verde-azulado' },
  ];

  // ⚠️ Os padrões de verdade estão no `config/tela.json`; o PROGRAMA os
  // devolve resolvidos por `preferencias_da_extensao`. Esta cópia só vale
  // até a ponte responder, e anda junto com o `tela.json`.
  window.tinPrefs = { onde: 'borda', espessura: 3, nas_abas: true };
  window.tinCores = TIN_CORES;
  window.tinCaminho = CAMINHO;
  window.tinSlug = SLUG;

  // ⚠️ A FLAG DE MONTADA. `tinAplicar` espera a ponte responder a cor, e o
  // usuário pode desligar a extensão no meio dessa espera. Sem a flag, a
  // continuação criava a moldura DEPOIS de o programa já ter varrido o DOM —
  // e a borda ficava na tela com a extensão desligada, que é o sintoma exato
  // que "desligar devolve a tela ao que era" existe para impedir.
  let montada = false;

  // ⚠️ SÍNCRONA.
  window['xtMontar_' + SLUG] = function () {
    montada = true;
    _montar();
  };

  window['xtDesmontar_' + SLUG] = function () {
    montada = false;
    tinTirar();
    // O `<style>` da moldura o programa remove pelo `data-xt`; o de "tinta"
    // também, porque leva o mesmo atributo. O que sobra são as globais.
    delete window.tinPrefs;
    delete window.tinCores;
    delete window.tinCaminho;
    delete window.tinSlug;
    delete window.tinAplicar;
    delete window.tinTirar;
    delete window.tinAbrirModal;
    delete window.tinCorDoProjeto;
    delete window['xtPreferenciasMudaram_' + SLUG];
  };

  // O "Salvar" da tela de configuração vale NA HORA: o programa chama isto
  // com as opções novas, e a moldura é refeita com elas.
  window['xtPreferenciasMudaram_' + SLUG] = function (prefs) {
    if (!montada) return;
    window.tinPrefs = { ...window.tinPrefs, ...(prefs || {}) };
    if (typeof currentProject !== 'undefined' && currentProject) tinAplicar(currentProject);
    else tinAtualizarAbas();
  };

  async function _montar() {
    _injetarEstiloDaModal();
    // As preferências (ONDE pintar) vêm uma vez, aqui; depois disso quem as
    // atualiza é o gancho `xtPreferenciasMudaram_`, a cada "Salvar".
    try {
      const r = await window.pywebview.api.preferencias_da_extensao(CAMINHO);
      if (montada && r && r.success && r.preferencias) {
        window.tinPrefs = { ...window.tinPrefs, ...r.preferencias };
      }
    } catch (e) {
      console.error('[tin] não deu para ler as preferências:', e);
    }
    if (!montada) return;
    // Ligar com um projeto já aberto tem de tingir agora, sem esperar o
    // próximo `projeto.abriu` — que só vem se o usuário sair e voltar. E as
    // abas dos outros projetos abertos também, mesmo na lista de projetos.
    if (typeof currentProject !== 'undefined' && currentProject) await tinAplicar(currentProject);
    else tinAtualizarAbas();
  }

  // ── Ler e gravar a cor, pela ponte ──────────────────────────────────────

  /** A cor gravada para um projeto, ou `''`. */
  async function tinCorDoProjeto(projeto) {
    if (!projeto) return '';
    try {
      const r = await window.pywebview.api.chamar_extensao(CAMINHO, { acao: 'cor', projeto });
      return (r && r.success && r.cor) || '';
    } catch (e) {
      console.error('[tin] não deu para ler a cor:', e);
      return '';
    }
  }

  // ── Pintar e despintar ──────────────────────────────────────────────────

  /**
   * ⚠️ TUDO NUM ELEMENTO SÓ, pendurado no `<body>`, com `pointer-events: none`.
   * É o que faz a moldura não roubar um clique sequer da janela — e o que faz
   * desligar ser um `.remove()` e nada mais.
   */
  function _tinMoldura() {
    let el = document.querySelector('.tin-moldura');
    if (el) return el;
    el = document.createElement('div');
    el.className = 'tin-moldura';
    el.dataset.xt = SLUG;
    document.body.appendChild(el);
    return el;
  }

  function _tinEstilo(css) {
    let el = document.getElementById('tin-estilo');
    if (!el) {
      el = document.createElement('style');
      el.id = 'tin-estilo';
      // ⚠️ É por `data-xt`, e só por ele, que o programa remove este `<style>`
      // ao desligar. Sem o atributo, as regras continuariam valendo.
      el.dataset.xt = SLUG;
      document.head.appendChild(el);
    }
    el.textContent = css;
    return el;
  }

  /**
   * As ABAS DE PROJETO, na tira do topo: cada projeto aberto ganha, na aba
   * dele, um traço embaixo com a cor dele. É o que faz a cor servir com dois
   * projetos abertos — a moldura mostra o de agora; as abas mostram todos.
   *
   * Uma regra de CSS por projeto, num `<style data-xt>` próprio, mirando
   * `[data-projeto="…"]`: a tira é remontada por `innerHTML` a cada mudança
   * de estado, e uma classe posta no elemento morreria com ele.
   */
  async function tinAtualizarAbas() {
    const prefs = window.tinPrefs || {};
    let el = document.getElementById('tin-abas');
    if (prefs.nas_abas === false) { if (el) el.remove(); return; }
    let cores = {};
    try {
      const r = await window.pywebview.api.chamar_extensao(CAMINHO, { acao: 'cores' });
      cores = (r && r.success && r.cores) || {};
    } catch (e) {
      console.error('[tin] não deu para ler as cores:', e);
      return;
    }
    if (!montada) return;
    if (!el) {
      el = document.createElement('style');
      el.id = 'tin-abas';
      el.dataset.xt = SLUG;   // é por ele que o programa remove ao desligar
      document.head.appendChild(el);
    }
    const validas = new Set(TIN_CORES.map(c => c.valor));
    el.textContent = Object.entries(cores)
      .filter(([, c]) => validas.has(c))
      .map(([projeto, c]) =>
        `.open-project-tab[data-projeto="${CSS.escape(projeto)}"] { box-shadow: inset 0 -3px 0 rgba(var(--${c}-rgb), 0.9); }`)
      .join('\n');
  }

  async function tinAplicar(projeto) {
    tinAtualizarAbas();   // sem await: as abas não seguram a moldura
    const cor = await tinCorDoProjeto(projeto);
    // Desligada enquanto a ponte respondia: nada entra na tela.
    if (!montada) return;
    if (!cor) { tinTirar(); return; }

    const prefs = window.tinPrefs || {};
    const onde = prefs.onde || 'borda';
    const espessuraLida = Number(prefs.espessura);
    const espessura = Math.max(1, Math.min(12, Number.isFinite(espessuraLida) ? espessuraLida : 3));

    // ⚠️ Nada de hexadecimal: `var(--{cor}-rgb)` sai do tema em execução.
    const tinta = `rgba(var(--${cor}-rgb), 0.9)`;

    if (onde === 'tinta') {
      // ⚠️ TINGE SÓ A BARRA DO TOPO, e não o `:root`. As seis cores têm
      // SIGNIFICADO DE ESTADO no programa inteiro (azul = acontecendo agora,
      // verde = terminou, âmbar = faltou pedaço, vermelho = erro); tingir o
      // `:root` mudaria o que o usuário lê em todas as outras abas.
      // Aqui não há moldura: se sobrou uma de "borda"/"faixa", ela sai.
      const sobra = document.querySelector('.tin-moldura');
      if (sobra) sobra.remove();
      _tinEstilo(`.topbar { background: rgba(var(--${cor}-rgb), 0.18) !important; }`);
      return;
    }

    _tinEstilo('');
    const moldura = _tinMoldura();
    moldura.style.cssText = [
      'position: fixed',
      'inset: 0',
      // A moldura fica ACIMA de tudo o que o programa desenha (o maior
      // z-index em uso é 500) e não recebe clique nenhum.
      'z-index: 900',
      'pointer-events: none',
      onde === 'faixa'
        ? `border-top: ${espessura}px solid ${tinta}`
        : `border: ${espessura}px solid ${tinta}`,
    ].join(';');
  }

  function tinTirar() {
    const el = document.querySelector('.tin-moldura');
    if (el) el.remove();
    const estilo = document.getElementById('tin-estilo');
    if (estilo) estilo.remove();
    // As abas NÃO saem aqui: `tinTirar` roda quando o projeto da frente
    // fecha, e os outros continuam abertos na tira, com as cores deles. Quem
    // as tira é o programa, ao desligar, pelo `data-xt`. Só se atualizam —
    // um projeto que saiu da tira deixa de ter regra.
    if (montada) tinAtualizarAbas();
  }

  // ── A modal de escolher a cor ───────────────────────────────────────────

  /**
   * ⛔ `abrirModalPadrao`, e nunca `prompt()` nem `confirm()` — os nativos são
   * do sistema, saem brancos no meio de uma tela escura e travam a janela.
   */
  async function tinAbrirModal() {
    const projeto = (typeof currentProject !== 'undefined' && currentProject) || '';
    if (!projeto) { showToast('Abra um projeto primeiro.', true); return; }

    const atual = await tinCorDoProjeto(projeto);
    const opcoes = [{ valor: '', rotulo: 'Sem cor' }, ...TIN_CORES];
    const linhas = opcoes.map(o => `
      <label class="config-check tin-opcao">
        <input type="radio" name="tin-cor" value="${o.valor}"${o.valor === atual ? ' checked' : ''}>
        <span class="tin-bola" style="${o.valor
          ? `background: rgba(var(--${o.valor}-rgb), 0.9)`
          : 'background: transparent; border: 1px dashed var(--text-muted)'}"></span>
        ${escapeHtml(o.rotulo)}
      </label>`).join('');

    abrirModalPadrao({
      title: 'Tingir a janela',
      bodyHtml: `<div class="modal-body-text">A cor fica gravada com
        <strong>${escapeHtml(projeto)}</strong> e volta sozinha toda vez que
        você abrir este projeto.</div>
        <div class="tin-opcoes">${linhas}</div>`,
      confirmLabel: 'Aplicar',
      onConfirm: async (overlay, mostrarErro) => {
        const marcado = overlay.querySelector('input[name="tin-cor"]:checked');
        const cor = marcado ? marcado.value : '';
        try {
          const r = await window.pywebview.api.chamar_extensao(CAMINHO, {
            acao: 'gravar_cor', projeto, cor,
          });
          if (!r || !r.success) {
            // Devolver `false` mantém a caixa aberta — o usuário não perde a
            // escolha por causa de uma gravação que falhou.
            mostrarErro((r && r.error) || 'não deu para gravar a cor');
            return false;
          }
        } catch (e) {
          mostrarErro('a ponte falhou');
          console.error('[tin]', e);
          return false;
        }
        await tinAplicar(projeto);   // refaz a moldura E as abas
        showToast(cor ? 'Janela tingida.' : 'Cor removida.');
        return true;
      },
    });
  }

  window.tinAplicar = tinAplicar;
  window.tinTirar = tinTirar;
  window.tinAbrirModal = tinAbrirModal;
  window.tinCorDoProjeto = tinCorDoProjeto;

  // O CSS das três classes que a modal usa. Prefixado, como tudo aqui.
  function _injetarEstiloDaModal() {
    // ⚠️ Religar não pode duplicar.
    if (document.getElementById('tin-estilo-modal')) return;
    const el = document.createElement('style');
    el.id = 'tin-estilo-modal';
    el.dataset.xt = SLUG;
    el.textContent = `
      .tin-opcoes { display: grid; gap: 6px; margin-top: 12px; }
      .tin-opcao { display: flex; align-items: center; gap: 8px; }
      .tin-bola { width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; }`;
    document.head.appendChild(el);
  }
})();
