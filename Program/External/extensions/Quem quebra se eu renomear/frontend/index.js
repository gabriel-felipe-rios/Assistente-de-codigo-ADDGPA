// ═══════════════ QUEM QUEBRA SE EU RENOMEAR — A CASCA ══
// O nome de cada função definida NESTE arquivo que é usada por OUTROS aparece
// com fundo âmbar. Renomeou um deles e salvou: um aviso diz quem quebrou.
//
// ⚠️ A FONTE É O ÍNDICE DE IDENTIFICADORES, e não um `grep`. `get_relacoes`
// casa MENÇÃO DE IDENTIFICADOR entre arquivos — função global chamada de outro
// arquivo, ponte `window.pywebview.api.X` ↔ `def X`, id declarado no HTML e
// lido no JS. É exatamente onde mora o perigo: renomear qualquer um desses não
// gera erro nenhum, e a tela só fica vazia.
//
// ⚠️ E o índice só guarda nome usado em MAIS DE UM arquivo — que é justamente
// o que interessa aqui.

(function () {
  const EU = document.currentScript.dataset;   // { caminho, slug }
  const SLUG = EU.slug;

  // `{ caminho, usados: Set<nome>, porNome: {nome: [arquivos]}, ok, quando }`
  //
  // ⚠️ O GANCHO NUNCA VAI AO PYTHON. Ele roda depois de cada pintura, com
  // 150 ms de teto. Quem vai é o laço abaixo, fora do gancho.
  window.renCache = { caminho: null, usados: new Set(), porNome: {}, ok: false, quando: 0 };

  // O que o observador de `editor.vai_salvar` compara: as definições que o
  // gancho viu da última vez, por caminho.
  //
  // ⚠️ LIMITADO. Uma entrada por arquivo já aberto, cada uma com todas as
  // definições dele — sem teto, uma sessão longa com centenas de arquivos
  // crescia sem parar. Guarda os últimos `REN_TETO_ARQUIVOS`; o salvamento
  // só precisa do arquivo que está sendo salvo, que é sempre recente.
  window.renDefinicoes = {};
  const REN_TETO_ARQUIVOS = 20;

  // Se o índice não existia (a aba Análise nunca foi aberta), tenta de novo
  // depois deste tempo — e não "nunca mais para este arquivo", que era o que
  // acontecia: construir o índice depois não fazia as marcas aparecerem até
  // trocar de arquivo e voltar.
  const REN_NOVA_TENTATIVA_MS = 30000;

  let pedindo = false;
  // ⚠️ A FLAG DE MONTADA: a resposta de `get_relacoes` chega depois de um
  // `await`, e o usuário pode ter desligado a extensão no meio.
  let montada = false;

  window['xtMontar_' + SLUG] = function () {
    montada = true;
    _injetarEstilo();
  };

  window['xtDesmontar_' + SLUG] = function () {
    montada = false;
    delete window.renCache;
    delete window.renDefinicoes;
    delete window.renTalvezPedir;
    delete window.renDefinicoesDoTexto;
    delete window.renGuardarDefinicoes;
    delete window.renPrefs;
    delete window.renAbrirModal;
    delete window['xtPreferenciasMudaram_' + SLUG];
  };

  /**
   * "Quem usa as definições deste arquivo…": cada função ou classe definida
   * aqui que outro arquivo usa, e QUAIS arquivos — com "ir para a linha" da
   * definição e "abrir" cada arquivo que a usa. É o que a marca âmbar não
   * consegue dizer (o `title` dela não aparece no mouse).
   */
  function renAbrirModal(caminho) {
    const cache = window.renCache || {};
    const alvo = (typeof edArquivoAberto === 'function') ? edArquivoAberto(caminho) : null;
    if (!alvo) { showToast('Abra o arquivo no Editor primeiro.'); return; }
    if (cache.caminho !== caminho || !cache.ok) {
      showToast('Este arquivo ainda não foi conferido — traga-o para a frente e espere um instante.');
      return;
    }
    if (!cache.usados || !cache.usados.size) {
      showToast('Nenhuma definição deste arquivo é usada por outro — ou o Índice de Identificadores ainda não foi construído (aba Análise).');
      return;
    }
    const definicoes = renDefinicoesDoTexto(alvo.texto.split('\n'))
      .filter((d) => cache.usados.has(d.nome));
    if (!definicoes.length) { showToast('Nenhuma definição deste arquivo é usada por outro.'); return; }

    const itens = definicoes.map((d) => {
      const arquivos = (cache.porNome[d.nome] || []);
      const lista = arquivos.slice(0, 12).map((a) => {
        const rel = String(a).replace(/\\/g, '/');
        return `<button type="button" class="btn btn-muted btn-sm ren-arquivo" data-ren-abrir="${escapeHtml(rel)}" title="Abrir no Editor">${escapeHtml(rel)}</button>`;
      }).join('') + (arquivos.length > 12 ? `<span class="ren-mais">e mais ${arquivos.length - 12}</span>` : '');
      return `<div class="ren-item">
        <div class="ren-cab">
          <button type="button" class="btn btn-muted btn-sm" data-ren-ir="${d.linha}">linha ${d.linha}</button>
          <code>${escapeHtml(d.nome)}</code>
          <span class="ren-vezes">usada por ${arquivos.length} arquivo(s)</span>
        </div>
        <div class="ren-usos">${lista}</div>
      </div>`;
    }).join('');

    const overlay = abrirModalPadrao({
      title: 'Quem usa as definições deste arquivo',
      bodyHtml: `<div class="modal-body-text">Em <strong>${escapeHtml(caminho)}</strong>,
        pelo Índice de Identificadores. Renomear ou apagar um destes nomes quebra os
        arquivos listados — sem erro nenhum na hora.</div>
        <div class="ren-lista">${itens}</div>`,
      confirmLabel: 'Fechar',
      semCancelar: true,
      onConfirm: () => true,
    });
    overlay.addEventListener('click', async (ev) => {
      const ir = ev.target.closest('[data-ren-ir]');
      if (ir) { overlay.remove(); await alvo.irParaLinha(Number(ir.dataset.renIr)); return; }
      const abrir = ev.target.closest('[data-ren-abrir]');
      if (abrir && typeof _edAbrirArquivo === 'function') {
        overlay.remove();
        try { await _edAbrirArquivo(abrir.dataset.renAbrir); }
        catch (e) { showToast('Não deu para abrir esse arquivo.', true); console.error('[ren]', e); }
      }
    });
  }

  window.renAbrirModal = renAbrirModal;

  // Os padrões de fábrica — os mesmos do `config/tela.json`, de onde o
  // programa lê o que o usuário escolheu (`xtPreferenciasDe`).
  const REN_PADRAO = { marcar_no_codigo: true, avisar_ao_salvar: true, cor: 'amber', intensidade: 12 };
  const REN_CORES = ['amber', 'purple', 'blue', 'teal', 'red', 'green'];

  function renPrefs() {
    const lidas = (typeof xtPreferenciasDe === 'function' && xtPreferenciasDe(SLUG)) || {};
    return { ...REN_PADRAO, ...lidas };
  }
  window.renPrefs = renPrefs;

  // O "Salvar" vale NA HORA: a cor mora no `<style>`, e o resto o encaixe e
  // o observador leem a cada vez.
  window['xtPreferenciasMudaram_' + SLUG] = function () {
    if (!montada) return;
    _injetarEstilo();
    if (typeof xtPedirDecoracao === 'function') xtPedirDecoracao();
  };

  /** Guarda as definições de um arquivo, esquecendo as mais antigas. */
  function renGuardarDefinicoes(caminho, definicoes) {
    const tabela = window.renDefinicoes;
    if (!tabela) return;
    delete tabela[caminho];            // reinsere no fim: a ordem das chaves é a idade
    tabela[caminho] = definicoes;
    const chaves = Object.keys(tabela);
    for (let i = 0; i < chaves.length - REN_TETO_ARQUIVOS; i++) delete tabela[chaves[i]];
  }

  window.renGuardarDefinicoes = renGuardarDefinicoes;

  /**
   * As funções e classes DEFINIDAS neste texto, como `{nome: linha e coluna}`.
   *
   * ⚠️ Regex, e não AST. A versão 1 pega definição no formato mais comum de
   * cada linguagem; um `const x = useMemo(() => …)` de três níveis de
   * aninhamento passa batido. Uma AST por linguagem seria outro projeto — e o
   * custo apareceria dentro do gancho, que tem 150 ms.
   */
  function renDefinicoesDoTexto(linhas) {
    const achadas = [];
    const padroes = [
      // Python: def X( · class X( · class X:
      /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/,
      /^\s*class\s+([A-Za-z_]\w*)\s*[(:]/,
      // JavaScript: function X( · async function X(
      /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/,
      // JavaScript: const X = ( · let X = function · const X = async (
      /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\(|[A-Za-z_$][\w$]*\s*=>)/,
    ];
    for (let n = 0; n < linhas.length; n++) {
      const linha = linhas[n];
      // Corte barato antes das regex: a esmagadora maioria das linhas de um
      // arquivo não define nada, e o gancho não pode pagar quatro expressões
      // por linha num arquivo de 3.000.
      if (!/\b(?:def|class|function|const|let|var)\b/.test(linha)) continue;
      for (const padrao of padroes) {
        const achado = padrao.exec(linha);
        if (!achado) continue;
        const nome = achado[1];
        const coluna = linha.indexOf(nome, achado.index);
        if (coluna < 0) continue;   // este padrão não serviu; o próximo pode servir
        achadas.push({ nome, linha: n + 1, coluna });
        break;   // uma definição por linha basta
      }
    }
    return achadas;
  }

  window.renDefinicoesDoTexto = renDefinicoesDoTexto;

  /**
   * Pede as relações do arquivo ao Python, FORA do gancho, quando o arquivo
   * mudou.
   *
   * ⚠️ Só quando o CAMINHO muda, e não a cada tecla: o índice de
   * identificadores é do que está no disco, e digitar não o muda. É o que
   * torna esta extensão barata mesmo com um índice caro por trás.
   */
  function renTalvezPedir(contexto) {
    const cache = window.renCache;
    if (!cache || !montada || pedindo) return;
    if (cache.caminho === contexto.caminho) {
      // Mesmo arquivo: só pede de novo se a última ida falhou (sem índice) e
      // já passou tempo suficiente para o índice poder existir agora.
      if (cache.ok || Date.now() - cache.quando < REN_NOVA_TENTATIVA_MS) return;
    }
    pedindo = true;
    const caminho = contexto.caminho;

    (async () => {
      let porNome = {};
      let ok = false;
      try {
        const r = await window.pywebview.api.get_relacoes(contexto.projeto, caminho);
        // ⚠️ Índice nunca construído devolve `success: false` ou lista vazia —
        // e isso é o estado NORMAL de quem nunca abriu a aba Análise. A
        // extensão fica quieta, e tenta de novo daqui a pouco.
        ok = !!(r && r.success);
        for (const uso of ((ok && r.usado_por) || [])) {
          for (const nome of (uso.via || [])) {
            (porNome[nome] = porNome[nome] || []).push(uso.arquivo);
          }
        }
      } catch (e) {
        console.error('[ren]', e);
        porNome = {};
      }
      pedindo = false;
      if (!montada) return;
      window.renCache = {
        caminho, usados: new Set(Object.keys(porNome)), porNome, ok, quando: Date.now(),
      };
      if (typeof xtPedirDecoracao === 'function') xtPedirDecoracao();
    })();
  }

  window.renTalvezPedir = renTalvezPedir;

  function _injetarEstilo() {
    // Religar não duplica; o "Salvar" reescreve o mesmo `<style>`.
    let estilo = document.getElementById('ren-estilo');
    if (!estilo) {
      estilo = document.createElement('style');
      estilo.id = 'ren-estilo';
      estilo.dataset.xt = SLUG;
      document.head.appendChild(estilo);
    }
    const prefs = renPrefs();
    const cor = REN_CORES.includes(prefs.cor) ? prefs.cor : REN_PADRAO.cor;
    const lida = Number(prefs.intensidade);
    const intensidade = Math.max(4, Math.min(40, Number.isFinite(lida) ? lida : REN_PADRAO.intensidade));
    // ⚠️ Só fundo. A marca do decorador não pode mudar largura nem altura.
    // Âmbar por padrão, por ser a cor de "cuidado" no programa, e fraca (12%)
    // porque isto aparece no nome de quase toda função de um arquivo
    // compartilhado. Token do tema, nunca hexadecimal.
    estilo.textContent = `
      .ren-usada { background: rgba(var(--${cor}-rgb), ${(intensidade / 100).toFixed(2)}); }
      /* A modal — fora do <pre>, então pode ter medida. */
      .ren-lista { display: grid; gap: 10px; margin-top: 12px; max-height: 50vh; overflow-y: auto; }
      .ren-cab { display: flex; align-items: center; gap: 10px; }
      .ren-vezes { font-size: 12px; color: var(--text-muted); }
      .ren-usos { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 0 8px; }
      .ren-arquivo { font-family: monospace; font-size: 11px; }
      .ren-mais { font-size: 12px; color: var(--text-muted); align-self: center; }`;
  }
})();
