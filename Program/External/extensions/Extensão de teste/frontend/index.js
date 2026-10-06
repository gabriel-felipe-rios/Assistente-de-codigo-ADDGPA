// ═══════════════════════════════════ EXTENSÃO DE TESTE — A CASCA ══
// O GABARITO. É a extensão mais simples que exercita a camada inteira: injeta
// um estilo, tem uma Tela (a sub-aba dela em Configurações, desenhada por
// `frontend/telas/gabarito.js`), fala com o próprio backend pela ponte, tem
// `config/tela.json` e um encaixe — e desfaz tudo ao ser desligada.
//
// Copie a pasta e comece daqui. O contrato inteiro está em
// `Program/Code/prompts/Como adicionar/Extensões/Contrato/Como criar extensões.md`.
//
// ⚠️ O prefixo desta extensão é `tst`, e ele está em TUDO: id de elemento,
// classe de CSS, nome de função global, chave de categoria. O frontend do
// programa não tem escopo de módulo — um `function desenhar()` de nível zero
// aqui sobrescreveria o `desenhar()` de outro arquivo em silêncio.

(function () {
  // ⚠️ NUNCA escreva o caminho nem o slug à mão. O programa os põe no dataset
  // da tag <script> que carregou este arquivo, e o slug leva um resumo do
  // caminho inteiro da pasta — que muda quando a extensão entra numa
  // categoria.
  const EU = document.currentScript.dataset;   // { caminho, slug }
  const SLUG = EU.slug;
  const CAMINHO = EU.caminho;

  // ⚠️ SÍNCRONA. O programa chama `window.xtMontar_{slug}` logo depois de o
  // script carregar; uma definição dentro de um `await` não estaria lá ainda.
  // ⚠️ A CATEGORIA SAIU DAQUI (fase 11). Ela era registrada por
  // `registrarCategoriaConfig` e desfeita no `xtDesmontar`; hoje é o item
  // `tst.gabarito` do manifesto (recurso Tela, `configuracoes.subaba`): o
  // programa cria o botão e o painel, e os tira ao desligar. O que vai dentro
  // está em `frontend/telas/gabarito.js`, que chama `tstPerguntarAoBackend`
  // quando a tela é desenhada.
  window['xtMontar_' + SLUG] = function () {
    tstInjetarEstilo();
  };

  window['xtDesmontar_' + SLUG] = function () {
    // O <style> o programa remove pelo `data-xt`. As marcas do decorador ele
    // desembrulha sozinho, e a tela ele tira sozinho (ver `descarregar.js`).
    // Sobram as globais:
    delete window.tstInjetarEstilo;
    delete window.tstPerguntarAoBackend;
  };

  function tstInjetarEstilo() {
    // ⚠️ Religar não pode duplicar: sem esta guarda, ligar e desligar vinte
    // vezes deixaria vinte <style> no <head>.
    if (document.getElementById('tst-estilo')) return;
    const estilo = document.createElement('style');
    estilo.id = 'tst-estilo';
    // ⚠️ É por `data-xt`, e SÓ por ele, que o programa acha o que remover ao
    // desligar. Sem o atributo, as regras continuariam valendo com a extensão
    // desligada — e o sintoma seria "eu desliguei e a tela continua estranha".
    estilo.dataset.xt = SLUG;
    // ⚠️ Nada de hexadecimal: o programa tem cinco temas, um deles claro.
    // Transparência sai da variante `-rgb` do token.
    estilo.textContent = `
      .tst-linha { font-size: 13px; color: var(--text-muted); line-height: 1.6; }
      .tst-linha strong { color: var(--purple); }
      /* A marca do decorador. O programa só põe a classe; a aparência é daqui.
         ⚠️ Só cor e fundo: largura e altura desalinhariam o <pre> do textarea. */
      .tst-marca { background: rgba(var(--purple-rgb), 0.25); }`;
    document.head.appendChild(estilo);
  }

  async function tstPerguntarAoBackend() {
    try {
      // ⚠️ `projeto` VAI NO PAYLOAD. É ele que faz o programa acrescentar
      // `pasta_projeto`, `grafo_imports` e `pipeline` antes de entregar ao
      // backend (parte 11 do contrato). Sem ele, o backend nunca sabe qual
      // projeto está aberto — e o gabarito mostrava "(nenhum projeto aberto)"
      // com um projeto aberto.
      const projeto = (typeof currentProject !== 'undefined' && currentProject) || null;
      const r = await window.pywebview.api.chamar_extensao(CAMINHO, { acao: 'ola', projeto });
      const alvo = document.getElementById('tst-resposta');
      if (!alvo) return;   // desligada, ou a tela saiu, enquanto a ponte respondia
      if (!r || !r.success) { alvo.textContent = (r && r.error) || 'o backend não respondeu'; return; }
      alvo.innerHTML = `<strong>${escapeHtml(String(r.mensagem || ''))}</strong>`;
    } catch (e) {
      // ⚠️ `try` E NÃO SÓ `if (!r.success)`. Um erro do lado Python não volta
      // como `{success:false}` — a ponte do pywebview REJEITA a promessa.
      console.error('[tst] a ponte falhou:', e);
    }
  }

  // Os irmãos precisam ser alcançáveis do `xtDesmontar` acima, que roda fora
  // deste escopo — daí as globais prefixadas, e o `delete` de cada uma lá.
  window.tstInjetarEstilo = tstInjetarEstilo;
  window.tstPerguntarAoBackend = tstPerguntarAoBackend;
})();
