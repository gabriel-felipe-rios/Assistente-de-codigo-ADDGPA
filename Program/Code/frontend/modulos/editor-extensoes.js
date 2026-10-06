// ═══════════════════════ EDITOR: O QUE ELE EMPRESTA ÀS EXTENSÕES ══
// A porta pela qual uma extensão pergunta ao Editor sobre um arquivo aberto —
// o texto como está agora, a seleção, a linha do cursor, e "leve-me até a
// linha N" — sem tocar em `_edPaineis`, `painel.atual` nem `superficie.ta`.
//
// ⚠️ Esses três são INTERNOS do Editor e mudam sem aviso. Até 05/09/2026 três
// extensões os cutucavam, cada uma do seu jeito (`Rodar o que está
// selecionado`, `Prévia de imagem`, `Servidor local com recarga`), e a próxima
// reorganização do painel quebraria as três de uma vez, sem erro nenhum. O
// contrato proíbe mexer no DOM do programa; o estado interno é a mesma coisa
// por outro nome. Esta é a porta — o que ela devolve é contrato, o que está
// atrás dela não é.
//
// Arquivo próprio, e não um bloco em `editor.js`, pela regra já registrada
// para `editor-arrasto.js` e irmãos: comportamento que não precisa do
// fechamento da fábrica vira irmão que recebe a instância.

/** O painel que está mostrando `caminho` NA FRENTE, ou null. */
function _edPainelNaFrente(caminho) {
  for (const painel of [_edPaineis.a, _edPaineis.b]) {
    if (painel && painel.atual && painel.atual.caminho === caminho) return painel;
  }
  return null;
}

/**
 * O que o Editor sabe de UM arquivo aberto, em qualquer dos dois painéis.
 * `null` se ele não está aberto.
 *
 * `texto` e `selecao` são lidos na hora (getters): a extensão pode guardar o
 * objeto e perguntar de novo depois.
 */
// eslint-disable-next-line no-unused-vars
function edArquivoAberto(caminho) {
  if (typeof _edPaineis === 'undefined' || !_edPaineis || !caminho) return null;
  for (const painel of [_edPaineis.a, _edPaineis.b]) {
    if (!painel || typeof painel.temArquivo !== 'function' || !painel.temArquivo(caminho)) continue;
    const arq = (painel.abertos || []).find((a) => a.caminho === caminho);
    if (!arq) continue;
    const ta = () => {
      const naFrente = painel.atual === arq && painel.superficie;
      return naFrente ? painel.superficie.ta : null;
    };
    return {
      caminho,
      linguagem: arq.linguagem || 'none',
      binario: arq.tipo === 'binario',
      get naFrente() { return painel.atual === arq; },
      // Como está AGORA: a superfície, se o arquivo está na frente; senão o
      // rascunho (a edição não salva) ou o conteúdo lido do disco.
      get texto() {
        const t = ta();
        if (t) return t.value;
        return arq.rascunho !== undefined ? arq.rascunho : (arq.conteudo || '');
      },
      // A seleção viva, ou '' — só existe para o arquivo na frente.
      get selecao() {
        const t = ta();
        return t ? t.value.slice(t.selectionStart, t.selectionEnd) : '';
      },
      // A linha do cursor, 1-based, ou 0 se o arquivo não está na frente.
      get linhaDoCursor() {
        const t = ta();
        return t ? t.value.slice(0, t.selectionStart).split('\n').length : 0;
      },
      // O texto da linha onde o cursor está, ou ''.
      get linhaAtual() {
        const t = ta();
        if (!t) return '';
        const linhas = t.value.split('\n');
        return linhas[t.value.slice(0, t.selectionStart).split('\n').length - 1] || '';
      },
      // Troca o texto INTEIRO do arquivo, se ele está na frente. Passa pelo
      // mesmo caminho da digitação (`execCommand('insertText')`), e é por
      // isso que o Ctrl+Z desfaz, o arquivo fica sujo e a pintura roda — nada
      // do que `superficie.abrir(texto)` faria. Devolve `false` quando o
      // arquivo não está na frente: sem o `<textarea>` não há o que trocar.
      // É o que "Formatar ao salvar" usa para formatar sem gravar.
      substituirTexto(novo) {
        const t = ta();
        if (!t || typeof novo !== 'string') return false;
        if (t.value === novo) return true;
        const inicio = t.selectionStart;
        t.focus();
        t.setSelectionRange(0, t.value.length);
        if (!document.execCommand('insertText', false, novo)) {
          t.value = novo;
          t.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const pos = Math.min(inicio, t.value.length);
        t.setSelectionRange(pos, pos);
        return true;
      },
      // Traz o arquivo para a frente (se não estiver) e rola até a linha,
      // 1-based, deixando-a perto do topo. É o mesmo caminho do "Ctrl+clique
      // vai para a definição".
      async irParaLinha(n) {
        if (painel.atual !== arq && typeof _edAbrirArquivo === 'function') await _edAbrirArquivo(caminho);
        const naFrente = _edPainelNaFrente(caminho) || painel;
        naFrente.irParaLinha(Math.max(1, Number(n) || 1));
      },
    };
  }
  return null;
}

/**
 * Recursos do Editor › formatação (fase 12): pergunta às extensões e põe o
 * texto formatado NA TELA, sem gravar.
 *
 * ⚠️ Resposta ÚNICA (`xtConsultarUma`): a primeira extensão, na ordem da lista,
 * que devolver `{ texto }` para a linguagem do arquivo. Formatação não se soma.
 *
 * O texto entra por `substituirTexto` — o caminho da digitação
 * (`execCommand('insertText')`): o Ctrl+Z desfaz, a aba fica suja, a pintura
 * roda. Nunca `superficie.abrir`, que apagaria a pilha de desfazer.
 */
// eslint-disable-next-line no-unused-vars
async function edFormatarArquivoAberto() {
  const caminho = (typeof _edAtivo !== 'undefined' && _edAtivo && _edAtivo.atual) ? _edAtivo.atual.caminho : '';
  const aberto = edArquivoAberto(caminho);
  if (!aberto || aberto.binario) { showToast('Abra um arquivo de texto no Editor primeiro.', true); return; }
  if (typeof xtConsultarUma !== 'function') return;
  const texto = aberto.texto;
  const r = await xtConsultarUma('editor.formatar',
    { projeto: (typeof currentProject !== 'undefined' && currentProject) || null,
      arquivo: caminho, linguagem: aberto.linguagem, texto },
    aberto.linguagem);
  if (!r || typeof r.texto !== 'string') {
    showToast('Nenhuma extensão formatou este arquivo — ele já está formatado, ou não deu para formatar.');
    return;
  }
  // O usuário pode ter digitado enquanto a extensão formatava: trocar o texto
  // agora apagaria o que ele escreveu nesse meio-tempo.
  if (aberto.texto !== texto) { showToast('O arquivo mudou enquanto formatava — peça de novo.', true); return; }
  if (r.texto === texto) { showToast('Nada a formatar.'); return; }
  if (!aberto.substituirTexto(r.texto)) { showToast('Traga o arquivo para a frente do Editor.', true); return; }
  showToast('Formatado. Ctrl+S para gravar.');
}

/** Os caminhos abertos nos dois painéis, sem repetição, o da frente do painel ativo primeiro. */
// eslint-disable-next-line no-unused-vars
function edArquivosAbertos() {
  if (typeof _edPaineis === 'undefined' || !_edPaineis) return [];
  const vistos = new Set();
  const lista = [];
  const primeiro = (typeof _edAtivo !== 'undefined' && _edAtivo && _edAtivo.atual) ? _edAtivo.atual.caminho : null;
  if (primeiro) { vistos.add(primeiro); lista.push(primeiro); }
  for (const painel of [_edPaineis.a, _edPaineis.b]) {
    for (const a of ((painel && painel.abertos) || [])) {
      if (!vistos.has(a.caminho)) { vistos.add(a.caminho); lista.push(a.caminho); }
    }
  }
  return lista;
}

// ── Os dois pontos de encaixe do Editor (fase 11) ─────────────────────────
//
// `editor.rodape` (um texto curto no rodapé) e `editor.painel` (um bloco acima
// dele). Os dois são pintados a partir de `_edPintarStatus` (editor.js), que
// roda a CADA movimento do cursor — e por isso só o rodapé repinta sempre (ele
// leva linha e coluna). O painel grande repinta só quando o arquivo em foco
// muda: repintá-lo a cada tecla faria o Editor engasgar.
//
// Aqui, e não em `editor.js`, pela regra dos irmãos do Editor: o que não
// precisa do fechamento da fábrica vira arquivo irmão.

// `{projeto}|{caminho}` do último `editor.painel` pintado. Zerado por
// `_edRepintarEncaixes` quando uma extensão liga.
let _edXtUltimoArquivo = null;

// eslint-disable-next-line no-unused-vars
function _edPintarEncaixes(arq, p) {
  if (typeof xtEncaixe !== 'function') return;
  const projeto = (typeof currentProject !== 'undefined' && currentProject) || null;
  const caminho = arq ? arq.caminho : '';
  const binario = !!(arq && arq.tipo === 'binario');
  const linguagem = !arq ? '' : (binario ? 'binario' : arq.linguagem);
  // O rodapé é sobre o CURSOR: sem arquivo de texto em foco (nenhum, ou um
  // binário), `arquivo` vem vazio — senão ele continuaria mostrando o anterior.
  xtEncaixe('editor.rodape', document.getElementById('ed-status-xt'), {
    projeto, arquivo: binario ? '' : caminho, linguagem,
    linha: p ? p.linha : null, coluna: p ? p.coluna : null,
  });
  const chave = `${projeto}|${caminho}`;
  if (chave === _edXtUltimoArquivo) return;
  _edXtUltimoArquivo = chave;
  xtEncaixe('editor.painel', document.getElementById('ed-encaixe'),
    { projeto, arquivo: caminho, linguagem });
}

/** Repinta os dois pontos já — quem chama é `xtRepintarPontosAbertos`, quando
 *  uma extensão liga com o Editor aberto. */
// eslint-disable-next-line no-unused-vars
function _edRepintarEncaixes() {
  _edXtUltimoArquivo = null;
  if (typeof _edPintarStatus !== 'function' || !document.getElementById('ed-status-pos')) return;
  _edPintarStatus(typeof _edAtivo !== 'undefined' ? _edAtivo : null);
}
