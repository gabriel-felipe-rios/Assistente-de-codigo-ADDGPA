// ═══════════════════════════════ COMPONENTE: BUSCA DE ÁRVORE (aba Análise) ══
//
// Liga a barra `.bsa-*` de uma tela às linhas da árvore daquela tela. Dois
// modos:
//
//   'nome'     — filtra no ato, a cada tecla, sobre os caminhos já desenhados.
//                Não vai ao backend: a árvore inteira já está no DOM.
//   'conteudo' — pergunta ao backend quais arquivos contêm o termo
//                (`search_code_content`) e filtra a árvore por essa lista.
//                Só dispara no Enter/botão Buscar — é uma varredura de disco,
//                não pode acontecer a cada tecla.
//
// O RESULTADO DOS DOIS MODOS É O MESMO: a árvore filtrada. Não há painel de
// resultados, e é de propósito — a Documentação abre uma lista de trechos
// porque lá o alvo é o texto do documento; aqui o alvo é o arquivo, e o que se
// faz com ele em seguida (ver operações de I/O, símbolos, relações) já mora nos
// painéis à direita. Trocar a árvore por uma lista tiraria justamente o gesto
// seguinte.
//
// ⚠️ Este arquivo NÃO serve a aba Documentação. Lá a busca tem três modos, um
// painel de resultados e um índice de embeddings; o que as duas compartilham é
// a aparência (`busca-arvore.css`), não o comportamento.

// `cfg`: { input, botao, modos, aviso, container, arvore }
//   input/botao/modos/aviso/container — ids de elementos do template
//   arvore — () => instância de arvore-pastas.js (pode ainda não existir no
//            momento do wiring; por isso é função, e não o objeto)
function ligarBuscaArvore(cfg) {
  const input  = document.getElementById(cfg.input);
  const botao  = document.getElementById(cfg.botao);
  const modos  = document.getElementById(cfg.modos);
  const aviso  = document.getElementById(cfg.aviso);
  if (!input || input._bsaWired) return;
  input._bsaWired = true;

  let modo = 'nome';

  const alvo = () => document.getElementById(cfg.container);

  const dizer = (texto, erro = false) => {
    if (!aviso) return;
    aviso.textContent = texto || '';
    aviso.classList.toggle('bsa-aviso--erro', !!erro);
  };

  const limpar = () => { filtrarArvorePorCaminho(alvo(), null); dizer(''); };

  function filtrarPorNome() {
    const q = input.value.trim().toLowerCase();
    if (!q) return limpar();
    filtrarArvorePorCaminho(alvo(), caminho => caminho.toLowerCase().includes(q));
    dizer('');
  }

  async function filtrarPorConteudo() {
    const q = input.value.trim();
    if (!q) return limpar();
    dizer('Procurando…');
    const r = await window.pywebview.api.search_code_content(currentProject, q);
    if (!r.success) {
      dizer(`Erro na busca: ${r.error}`, true);
      return;
    }
    const encontrados = new Set(r.paths || []);
    filtrarArvorePorCaminho(alvo(), caminho => encontrados.has(caminho));
    // A contagem é a dos ARQUIVOS QUE SOBRARAM na árvore, não a do backend: a
    // varredura cobre todos os arquivos de texto das pastas de trabalho, e cada
    // tela lista só um recorte deles. Dizer "42 arquivos" quando a árvore mostra
    // 7 faria o usuário procurar 35 linhas que nunca estiveram ali.
    const visiveis = [...(alvo()?.querySelectorAll('.arvp-linha-arquivo') || [])]
      .filter(el => el.style.display !== 'none').length;
    dizer(visiveis
      ? `${visiveis} arquivo${visiveis !== 1 ? 's' : ''} nesta tela contêm "${q}".${r.truncated ? ' A varredura foi cortada no limite.' : ''}`
      : `Nenhum arquivo desta tela contém "${q}".`);
  }

  const buscar = () => (modo === 'conteudo' ? filtrarPorConteudo() : filtrarPorNome());

  // Por nome filtra enquanto se digita; por conteúdo, não (ver cabeçalho).
  // Apagar o campo limpa o filtro nos dois modos — senão a árvore ficaria
  // presa no último resultado com o campo vazio.
  input.addEventListener('input', () => {
    if (modo === 'nome') filtrarPorNome();
    else if (!input.value.trim()) limpar();
  });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') buscar(); });
  botao?.addEventListener('click', buscar);

  modos?.querySelectorAll('.bsa-modo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modos.querySelectorAll('.bsa-modo-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      modo = btn.dataset.mode;
      // Trocar de modo com texto no campo re-executa a busca no modo novo. A
      // alternativa (manter o filtro antigo) deixaria o botão aceso mentindo
      // sobre o que está na tela.
      if (input.value.trim()) buscar(); else limpar();
    });
  });
}
