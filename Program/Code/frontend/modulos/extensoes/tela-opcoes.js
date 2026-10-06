// ═════════════ EXTENSÕES DO PROGRAMA — AS OPÇÕES, NA PÁGINA DA EXTENSÃO ══
// A parte 4 da página de uma extensão (ver o topo de `extensoes/tela.js`):
// os cartões do `config/tela.json`, desenhados pelo PROGRAMA com as classes
// que já existem (`.config-cartao`, `.config-grade`, `.config-field-row`,
// `.config-check`). Saiu de `tela.js` em 23/09/2026 (fase 13) pelo teto de
// 500 linhas. Quem lê os valores de volta e grava continua em `tela.js`
// (`_xtColetarValores`, `_xtGravarPreferencias`).
//
// ── Os campos ───────────────────────────────────────────────────────────
// Quatro tipos na primeira versão. `interruptor` e `caixa` são o MESMO campo:
// o `tela.json` aceita as duas palavras e as duas desenham uma caixa de
// seleção nativa.
//
// ⚠️ E não o componente Interruptor (`.toggle-pill`), de propósito: ele
// promete efeito imediato, e este painel tem barra de "Salvar". Usá-lo atrás
// de um Salvar é mentir sobre o que o clique faz — está escrito em Padrões de
// interface › Componentes › Interruptor, em "Quando não usar".
//
// ── `opcoes_de` (fase 13, D10) ───────────────────────────────────────────
// Um campo `escolha` pode pedir as opções ao PROGRAMA em vez de listá-las:
// `"opcoes_de": "visual.icones"` = os pacotes de ícones que as extensões
// ligadas trazem, mais "Nenhum (emoji)". Qualquer extensão pode usar; hoje só
// a Ícones de arquivo usa (campo "Pacote em uso"). Quem sabe montar a lista
// é o dono do recurso (`icones.js::iconesOpcoesDoCampo`), que devolve também
// a opção a marcar — o valor EFETIVO, e não o cru: com nada gravado, a
// reserva do D20 — e o aviso de quando o valor gravado não está mais nas
// opções (a extensão do pacote foi desligada).

function _xtIdDoCampo(slug, chave) {
  // A `chave` vem do `tela.json` de terceiro. Só letra, dígito, `_` e `-`
  // entram num `id`; qualquer outra coisa (aspas, espaço) quebraria a
  // marcação do painel inteiro. Quem lê o valor usa `data-xt-campo`, que é
  // escapado — o `id` só liga o `<label>` ao campo.
  return `xt-campo-${slug}-${String(chave).replace(/[^\w-]/g, '_')}`;
}

/** `{opcoes, selecionado, aviso}` de um campo com `opcoes_de`, ou `null`
 *  para uma fonte que o programa não conhece (o campo cai nas `opcoes`). */
function _xtOpcoesDe(fonte, valor) {
  if (fonte === 'visual.icones' && typeof iconesOpcoesDoCampo === 'function') {
    return iconesOpcoesDoCampo(valor);
  }
  return null;
}

function _xtCampoHtml(slug, campo, valor) {
  const chave = String(campo.chave || '');
  if (!chave) return '';
  const id = _xtIdDoCampo(slug, chave);
  const tipo = String(campo.tipo || 'texto').toLowerCase();
  const rotulo = escapeHtml(String(campo.rotulo || chave));
  const nota = campo.nota ? `<p class="config-nota">${escapeHtml(String(campo.nota))}</p>` : '';
  const abre = `<div class="config-field-row" data-xt-campo="${escapeHtml(chave)}"
                     data-xt-tipo="${escapeHtml(tipo)}">`;

  if (tipo === 'interruptor' || tipo === 'caixa') {
    return `${abre}
      <label class="config-check">
        <input type="checkbox" id="${id}" ${valor ? 'checked' : ''} /> ${rotulo}
      </label>${nota}</div>`;
  }

  if (tipo === 'escolha') {
    const vinda = campo.opcoes_de ? _xtOpcoesDe(String(campo.opcoes_de), valor) : null;
    const lista = vinda ? vinda.opcoes : (campo.opcoes || []);
    const marcado = vinda ? vinda.selecionado : valor;
    // Uma opção pode vir como texto solto ("Claro") ou como par
    // (`{valor, rotulo}`) — a primeira forma é a que se escreve à mão, a
    // segunda a que se precisa quando o valor gravado não é o texto da tela.
    const opcoes = lista.map(o => {
      const v = (o && typeof o === 'object') ? String(o.valor ?? '') : String(o);
      const r = (o && typeof o === 'object') ? String(o.rotulo ?? o.valor ?? '') : String(o);
      return `<option value="${escapeHtml(v)}"${
        String(marcado ?? '') === v ? ' selected' : ''}>${escapeHtml(r)}</option>`;
    }).join('');
    // O valor que sumiu das opções não some calado: a nota âmbar diz o que o
    // programa está fazendo no lugar dele.
    const aviso = (vinda && vinda.aviso)
      ? `<p class="config-nota config-nota-alerta">${escapeHtml(vinda.aviso)}</p>` : '';
    const foto = vinda ? ` data-xt-opcoes-foto="${escapeHtml(JSON.stringify(vinda))}"` : '';
    return `${abre.replace(/>$/, `${foto}>`)}
      <label for="${id}">${rotulo}</label>
      <select class="xt-campo-select" id="${id}">${opcoes}</select>${aviso}${nota}</div>`;
  }

  if (tipo === 'numero') {
    const limites = [
      campo.min !== undefined ? `min="${escapeHtml(String(campo.min))}"` : '',
      campo.max !== undefined ? `max="${escapeHtml(String(campo.max))}"` : '',
      campo.passo !== undefined ? `step="${escapeHtml(String(campo.passo))}"` : '',
    ].join(' ');
    return `${abre}
      <label for="${id}">${rotulo}</label>
      <input type="number" id="${id}" value="${escapeHtml(String(valor ?? ''))}" ${limites} />
      ${nota}</div>`;
  }

  return `${abre}
    <label for="${id}">${rotulo}</label>
    <input type="text" class="xt-campo-texto" id="${id}"
           value="${escapeHtml(String(valor ?? ''))}" />${nota}</div>`;
}

function _xtCartaoHtml(slug, cartao, preferencias) {
  const campos = (cartao.campos || [])
    .map(c => _xtCampoHtml(slug, c, preferencias[String(c.chave)]))
    .join('');
  const dica = cartao.dica
    ? `<p class="config-cartao-dica">${escapeHtml(String(cartao.dica))}</p>` : '';
  return `
    <div class="config-cartao">
      <div class="config-cartao-cabecalho">
        <div class="config-cartao-titulo">${escapeHtml(String(cartao.titulo || 'Opções'))}</div>
        ${dica}
      </div>
      <div class="config-grade">${campos}</div>
    </div>`;
}

/** 4 · As opções do `tela.json` — só para quem tem. */
function _xtOpcoesHtml(tela) {
  if (!tela.tem_tela) return '';
  // O erro de leitura vai NA TELA, e não só numa notificação que some em 2,5 s:
  // quem escreveu o `tela.json` precisa poder reler a mensagem do parser
  // enquanto conserta o arquivo. Mesma medida de `.config-erro`.
  const erro = tela.erro
    ? `<div class="config-erro">O <code>config/tela.json</code> desta extensão não
        deu para ler: ${escapeHtml(String(tela.erro))}</div>` : '';
  const cartoes = ((tela.tela || {}).cartoes || [])
    .map(c => _xtCartaoHtml(tela.slug, c, tela.preferencias || {})).join('');
  if (!cartoes) {
    return erro + `<p class="config-nota">O <code>config/tela.json</code> desta
      extensão não declara nenhuma opção.</p>`;
  }
  return erro + cartoes;
}

/** Os campos com `opcoes_de` de uma tela: `[{campo, chave}]`. */
function _xtCamposComOpcoesDe(tela, fonte) {
  const saida = [];
  (((tela && tela.tela) || {}).cartoes || []).forEach((cartao) => {
    ((cartao && cartao.campos) || []).forEach((campo) => {
      if (campo && campo.chave && campo.opcoes_de && (!fonte || campo.opcoes_de === fonte)) {
        saida.push({ campo, chave: String(campo.chave) });
      }
    });
  });
  return saida;
}

/**
 * A extensão cujo `tela.json` declara um campo com `opcoes_de: fonte`, e a
 * chave dele — `null` se nenhuma. É por aqui, e NUNCA por um slug fixo (o
 * slug muda quando a extensão é arrastada para uma categoria), que o
 * programa acha a escolha do pacote de ícones (`icones.js`).
 */
// eslint-disable-next-line no-unused-vars
function xtCampoComOpcoesDe(fonte) {
  for (const tela of (typeof xtTelas !== 'undefined' && xtTelas) || []) {
    const achado = _xtCamposComOpcoesDe(tela, fonte)[0];
    if (achado) return { tela, chave: achado.chave };
  }
  return null;
}

/**
 * Repinta as opções dos campos com `opcoes_de` — chamada depois de
 * `xtSincronizarDados` (`extensoes/dados.js`): a página é registrada ANTES de
 * a lista de dados chegar, e o "Pacote em uso" nasceria só com "Nenhum".
 *
 * Só troca a linha cujas opções MUDARAM (a foto em `data-xt-opcoes-foto`):
 * repintar sempre apagaria o que o usuário acabou de escolher sem salvar.
 */
// eslint-disable-next-line no-unused-vars
function xtRepintarOpcoesDe() {
  for (const tela of (typeof xtTelas !== 'undefined' && xtTelas) || []) {
    if (!tela.tem_tela) continue;
    const corpo = document.getElementById(`xt-tela-corpo-${tela.slug}`);
    if (!corpo) continue;
    _xtCamposComOpcoesDe(tela).forEach(({ campo, chave }) => {
      const linha = [...corpo.querySelectorAll('[data-xt-campo]')]
        .find((el) => el.dataset.xtCampo === chave);
      if (!linha) return;
      const html = _xtCampoHtml(tela.slug, campo, (tela.preferencias || {})[chave]);
      const molde = document.createElement('div');
      molde.innerHTML = html.trim();
      const nova = molde.firstElementChild;
      if (nova && nova.dataset.xtOpcoesFoto !== linha.dataset.xtOpcoesFoto) linha.replaceWith(nova);
    });
  }
}
