// ═══════════════════ RODAR O QUE ESTÁ SELECIONADO — A CASCA ══
// Executa o arquivo aberto, ou só o trecho que você marcou, e mostra a saída
// na aba Terminal.
//
// ⚠️ A SAÍDA VAI PARA A ABA TERMINAL, e não para um painel dentro do Editor.
// Reusar `run_script` do programa dá de graça a saída ao vivo, o botão Parar e
// o "Explicar este erro"; um painel novo no Editor teria de reconstruir os
// três, e painel novo no Editor não é ponto de encaixe — é funcionalidade do
// programa, que é outra conversa.
//
// ⚠️ O TRECHO É GRAVADO COM A EXTENSÃO DO ARQUIVO ORIGINAL (`trecho.py`,
// `trecho.js`), e isso não é cosmético: `_term_resolver_comando`
// (`backend/modulos/terminal.py`) descobre o interpretador pela ASSOCIAÇÃO DO
// WINDOWS à extensão, e sem fallback, por desenho. Um `trecho.tmp` não tem
// programa associado e o Terminal recusa — corretamente.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug }
  const SLUG = EU.slug;
  const CAMINHO = EU.caminho;

  window['xtMontar_' + SLUG] = function () {
    // Nada a montar: os dois encaixes se registram sozinhos, e não há tela
    // nem estilo. A função existe porque o programa a espera.
  };

  window['xtDesmontar_' + SLUG] = function () {
    delete window.rodTextoSelecionado;
    delete window.rodLinhaDoCursor;
    delete window.rodRodarTrecho;
    delete window.rodRodarArquivo;
    delete window.rodIrParaOTerminal;
  };

  // ── Achar a seleção ─────────────────────────────────────────────────────

  /**
   * O texto marcado no arquivo aberto, ou `''`.
   *
   * ⚠️ O contexto de `editor.aba.menu` é `{ caminho, fixado }` e NÃO traz a
   * seleção — nem poderia: o ponto existe para o menu da aba, não para o
   * conteúdo. A seleção vem pela porta que o Editor empresta às extensões
   * (`edArquivoAberto`), e nunca cutucando `_edPaineis`, que é interno.
   */
  function rodTextoSelecionado(caminho) {
    const aberto = (typeof edArquivoAberto === 'function') ? edArquivoAberto(caminho) : null;
    return aberto ? aberto.selecao : '';
  }

  /** A linha onde o cursor está, sem o recuo, ou `''` — para "rodar a linha". */
  function rodLinhaDoCursor(caminho) {
    const aberto = (typeof edArquivoAberto === 'function') ? edArquivoAberto(caminho) : null;
    if (!aberto || !aberto.naFrente) return '';
    return aberto.linhaAtual.trim() ? aberto.linhaAtual : '';
  }

  // ── Ir para a aba Terminal ──────────────────────────────────────────────

  /**
   * ⚠️ CLICA NO BOTÃO DE ABA DO PROGRAMA, e não mexe em `classList` à mão. O
   * caminho de troca de aba (`navegacao.js`) faz mais coisas que trocar as
   * classes: ele lembra a aba ativa do projeto e chama o `init` da aba. Fazer
   * "na mão" acertaria a aparência e deixaria a aba Terminal sem inicializar.
   */
  function rodIrParaOTerminal() {
    const btn = document.querySelector('.tab-btn[data-tab="tab-terminal"]');
    if (btn) { btn.click(); return; }
    // O seletor é do programa, e pode mudar. Sem esta linha, o script
    // rodaria e a saída ficaria numa aba que o usuário não vê — sem erro.
    console.error('[rod] não achei o botão da aba Terminal (`.tab-btn[data-tab="tab-terminal"]`).');
    showToast('Rodou — veja a saída na aba Terminal.');
  }

  /**
   * ⚠️ `try` e não só `await`: um erro do lado Python REJEITA a promessa da
   * ponte, e um `await` solto morreria calado — é o que este próprio arquivo
   * explica em `_rodChamar`, e as duas chamadas que importavam não seguiam.
   */
  async function _rodRodar(caminhoAbsoluto) {
    // A opção vem da tela de configuração, do que está em memória.
    const prefs = (typeof xtPreferenciasDe === 'function' && xtPreferenciasDe(SLUG)) || {};
    if (prefs.ir_para_terminal !== false) rodIrParaOTerminal();
    try {
      const r = await window.pywebview.api.run_script(currentProject, caminhoAbsoluto);
      if (r && r.success === false) showToast(r.error || 'Não deu para rodar.', true);
    } catch (e) {
      showToast('Não deu para rodar: a ponte falhou.', true);
      console.error('[rod]', e);
    }
  }

  // ── Rodar ───────────────────────────────────────────────────────────────

  async function _rodChamar(payload) {
    try {
      const r = await window.pywebview.api.chamar_extensao(CAMINHO, payload);
      if (!r || !r.success) {
        showToast((r && r.error) || 'a extensão não respondeu', true);
        return null;
      }
      return r;
    } catch (e) {
      // ⚠️ `try` e não só `if (!r.success)`: um erro do lado Python rejeita a
      // promessa da ponte, e sem o catch esta função morreria calada.
      showToast('a ponte falhou', true);
      console.error('[rod]', e);
      return null;
    }
  }

  /**
   * Roda a seleção — ou, sem seleção, a linha do cursor (`soLinha`). Rodar a
   * linha é o gesto mais comum de quem testa uma expressão: sem ele, seria
   * preciso selecionar a linha inteira à mão antes de cada clique.
   */
  async function rodRodarTrecho(caminho, soLinha) {
    const texto = rodTextoSelecionado(caminho) || (soLinha ? rodLinhaDoCursor(caminho) : '');
    if (!texto) { showToast('Selecione um trecho primeiro.', true); return; }

    const r = await _rodChamar({
      acao: 'gravar_trecho', projeto: currentProject, arquivo: caminho, texto,
    });
    if (!r) return;
    await _rodRodar(r.caminho_absoluto);
  }

  async function rodRodarArquivo(caminho) {
    const r = await _rodChamar({
      acao: 'caminho_absoluto', projeto: currentProject, arquivo: caminho,
    });
    if (!r) return;
    await _rodRodar(r.caminho_absoluto);
  }

  window.rodTextoSelecionado = rodTextoSelecionado;
  window.rodLinhaDoCursor = rodLinhaDoCursor;
  window.rodRodarTrecho = rodRodarTrecho;
  window.rodRodarArquivo = rodRodarArquivo;
  window.rodIrParaOTerminal = rodIrParaOTerminal;
})();
