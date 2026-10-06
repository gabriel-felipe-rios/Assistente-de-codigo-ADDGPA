// ═══ TRABALHOS → o corpo de um nó de TERMINAL ══════════════════════════════
//
// ── Este arquivo era 802 linhas, e virou três ─────────────────────────────
//
// Pelo teto de 500 da AMF. Cada um responde uma pergunta:
//
//   trabalhos-shell.js           a ponte, montar o terminal e sobreviver ao
//                                redesenho do canvas
//   trabalhos-shell-medidas.js   o tema, e quantas colunas e linhas cabem
//   trabalhos-shell-entrada.js   cursor, reidratar, colar, print, interromper
//
// ⚠️ SÃO SCRIPTS CLÁSSICOS, NÃO MÓDULOS: as funções e os `const` do topo
// continuam globais. O `index.html` carrega os três na ordem acima, e
// `oficinaShellSaida` — que é quem o BACKEND chama — precisa continuar sendo
// global, definido neste arquivo.
//
// ⚠️ O ESTADO MORA TODO AQUI: `trShTerms`, `trShComFoco` e as constantes
// `TR_SH_*`. Os outros dois leem e escrevem neles.
//
// Este arquivo era um pintor de log: recebia linhas, montava um `<div>` por
// linha e coloria com `ansi_up`. Agora ele é o **dono das instâncias de
// xterm.js** — uma por nó de terminal do canvas.
//
// ⚠️ POR QUE UM EMULADOR DE VERDADE. O log antigo empilhava linhas, e a
// interface do Claude Code não escreve linhas: ela POSICIONA O CURSOR e
// redesenha por cima. Num empilhador de linhas aquilo sai como uma cascata de
// lixo. O que se ganhou não é bonito — é a diferença entre rodar e não rodar.
//
// ⚠️ RENDERIZADOR DOM, E NENHUM ADDON. Os addons de canvas e WebGL do xterm.js
// são mais rápidos e estão FORA daqui de propósito, por duas razões
// independentes, cada uma já suficiente:
//   · eles rasterizam, e dentro do `transform: scale()` do canvas da Oficina um
//     raster BORRA. O renderizador DOM é texto, e reescala nítido em 0,15× ou
//     em 6×;
//   · o navegador tem teto de contextos WebGL vivos (uns 16), e "N terminais
//     sem teto" fura esse teto — o WebView2 então mata contextos em silêncio.
// O `addon-fit` também ficou fora: ver `trShDimensionar`, abaixo.

// Uma instância viva por nó. Ela NUNCA é destruída por um redesenho do canvas.
//   { term, host }
const trShTerms = {};

// Quem tinha o foco antes do último redesenho, para devolvê-lo depois.
let trShComFoco = null;

// A fonte tem de bater com o CSS de `.ofi-sh-tela`, e o corpo é INTEIRO de
// propósito: 11,5px faz a largura da célula cair numa fração, e a grade do
// terminal desalinha do próprio cursor.
const TR_SH_FONTE = "'Consolas', monospace";
const TR_SH_CORPO = 12;
const TR_SH_ALTURA = 1.25;
// Com N terminais abertos, o padrão do xterm (5000) pesa sem servir para nada:
// quem quer o histórico longo rola o log do próprio programa.
const TR_SH_ROLAGEM = 1500;

// ── A ponte: o backend chama isto ───────────────────────────────────────────
//
// Nome global e fixo, porque quem chama é `evaluate_js` do outro lado.

function oficinaShellSaida(dados) {
  if (!dados || dados.project !== currentProject) return;
  if (dados.status === 'dados') {
    const t = trShTerms[dados.no];
    // Nó de uma sub-aba que nunca foi aberta: não há terminal para escrever, e
    // o backend guardou os bytes — a reidratação pega tudo quando ele nascer.
    if (t) t.term.write(trShDeB64(dados.b64));
    return;
  }
  // `aberto` e `fim` mudam a luz do cabeçalho, e quem sabe se o terminal está
  // vivo é o backend — recarregar é mais barato que espelhar isso aqui e
  // arriscar as duas versões discordarem.
  if (typeof ofiCarregar === 'function') ofiCarregar();
}

// ⚠️ `Uint8Array`, E NÃO STRING. É por aqui que o decodificador incremental de
// UTF-8 do xterm.js entra em jogo: um pedaço pode terminar no meio de um `é`, e
// entregar bytes deixa o problema com quem sabe resolvê-lo. Foi por isso que o
// transporte virou base64 no backend.
function trShDeB64(b64) {
  const bin = atob(b64 || '');
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

// ⚠️ `btoa` SÓ ACEITA LATIN-1, e o que o usuário cola pode ter acento. O
// `TextEncoder` vem antes para o base64 receber bytes, não caracteres.
function trShParaB64(s) {
  const b = new TextEncoder().encode(s);
  let bin = '';
  for (const x of b) bin += String.fromCharCode(x);
  return btoa(bin);
}

// ── Montar, e sobreviver ao redesenho do canvas ─────────────────────────────
//
// ⚠️ ESTE É O PONTO QUE DECIDE SE O TERMINAL FUNCIONA. `ofiDesenhar()` refaz o
// `innerHTML` da camada de nós inteira, e é chamado em onze lugares — trocar a
// seleção, dar zoom, arrastar um nó. Recriar o xterm a cada um desses seria
// perder o conteúdo a cada clique.
//
// A saída é ADOÇÃO DE SUBÁRVORE: `ofiDesenharNo` emite o encaixe VAZIO, e aqui
// o `host` de cada terminal é devolvido para dentro dele. `appendChild` de um
// nó que já existe no documento MOVE, não copia — o buffer, os ouvintes, a
// seleção e a posição de rolagem atravessam o `innerHTML` intactos, porque o
// host só saiu do documento por um instante.

function ofiLigarShells() {
  // Antes de qualquer host entrar na tela: a largura padrão é uma variável de
  // CSS, e um cartão desenhado antes dela nasceria com os 380px de reserva e
  // pularia para a largura certa no quadro seguinte.
  trShPublicarLarguraPadrao();
  const vistos = new Set();
  document.querySelectorAll('#ofi-nos [data-sh-tela]').forEach(encaixe => {
    const id = encaixe.dataset.shTela;
    vistos.add(id);
    // ⚠️ O ENCAIXE VAI JUNTO NA CRIAÇÃO, e a ordem é o conserto de um defeito.
    // Antes o terminal nascia com o host FORA do documento: sem caixa, o xterm
    // assumia os 80×24 dele, o prompt era escrito nessas 80 colunas, e só
    // depois vinha a medida de verdade. O texto refluía — mas o CURSOR ficava
    // na coluna em que estava antes do reflow, e o sintoma era o bloco piscando
    // no meio do caminho em vez de no fim do prompt.
    const t = trShTerms[id] || trShCriarTerminal(id, encaixe);
    if (!t) return;
    if (t.host.parentNode !== encaixe) encaixe.appendChild(t.host);   // adoção
    // `clientWidth` só existe depois de o elemento estar na tela; medir agora
    // devolveria zero.
    requestAnimationFrame(() => trShDimensionar(id));
  });

  // O nó sumiu do canvas (excluído, ou o projeto trocou): agora sim o terminal
  // se desfaz. É um dos três únicos lugares em que isso acontece.
  Object.keys(trShTerms).forEach(id => {
    if (vistos.has(id)) return;
    if (typeof ofiNos !== 'undefined' && ofiNos.some(n => n.id === id)) return;
    trShDescartar(id);
  });

  trShLigarBotoes();
  if (trShComFoco && trShTerms[trShComFoco]) trShTerms[trShComFoco].term.focus();
}

// Os dois botões do cabeçalho do cartão. Eles são refeitos a cada redesenho
// (fazem parte do `innerHTML`), então religá-los aqui é o certo — ao contrário
// do `host` do terminal, que atravessa.
function trShLigarBotoes() {
  document.querySelectorAll('#ofi-nos [data-sh-parar]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      trShInterromper(btn.dataset.shParar);
    });
  });
  // ⚠️ O ✕ EXCLUI O NÓ, e não só mata o processo — foi decisão do usuário, e
  // ela conserta uma ambiguidade real. Fechar sem excluir deixava um cartão
  // idêntico no lugar, com a luz apagada: o gesto parecia não ter feito nada, e
  // o próprio usuário descreveu o botão como "não fecha". Agora o ✕ do cartão e
  // o Excluir da barra contextual são o MESMO gesto — e `excluir_nos` já fecha
  // o terminal antes de tirar o nó, então nada fica órfão.
  //
  // Quem quer só interromper o que roda tem o ⏹ ao lado, que manda Ctrl+C.
  document.querySelectorAll('#ofi-nos [data-sh-fechar]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const id = btn.dataset.shFechar;
      // ⚠️ A MESMA PERGUNTA QUE A BARRA CONTEXTUAL FAZ, e não uma segunda
      // versão dela: o ✕ e o Excluir são o MESMO gesto (ver o ⚠️ acima), então
      // pular a confirmação aqui daria dois caminhos com riscos diferentes
      // para a mesma ação — e o usuário aprenderia a confiar no errado.
      if (typeof ofiConfirmarExclusao === 'function'
          && !await ofiConfirmarExclusao([id])) return;
      let r;
      try {
        r = await window.pywebview.api.excluir_nos(currentProject, [id]);
      } catch (err) {
        showToast('N\u00e3o deu para excluir: ' + (err && err.message ? err.message : err), true);
        return;
      }
      if (!r || !r.success) {
        showToast((r && r.error) || 'N\u00e3o deu para excluir este terminal.', true);
        return;
      }
      if (typeof ofiSelecao !== 'undefined') ofiSelecao.delete(id);
      ofiCarregar();
    });
  });
  // Clicar em qualquer canto da tela preta põe o cursor no terminal — é o gesto
  // de um terminal. Só não rouba o foco enquanto há texto selecionado, senão a
  // seleção se desfaz no `mouseup`.
  document.querySelectorAll('#ofi-nos [data-sh-tela]').forEach(tela => {
    tela.addEventListener('mouseup', e => {
      if (e.target.closest('button')) return;
      const sel = document.getSelection();
      if (sel && String(sel).length) return;
      const t = trShTerms[tela.dataset.shTela];
      if (t) t.term.focus();
    });
  });
}

function trShDescartar(id) {
  const t = trShTerms[id];
  if (!t) return;
  try { t.term.dispose(); } catch (e) { /* já morto */ }
  if (t.host.parentNode) t.host.parentNode.removeChild(t.host);
  delete trShTerms[id];
  if (trShComFoco === id) trShComFoco = null;
}

// Chamado na troca de projeto: os terminais do projeto anterior não têm mais nó.
function trShDescartarTudo() {
  Object.keys(trShTerms).forEach(trShDescartar);
}

function trShCriarTerminal(id, encaixe) {
  if (typeof Terminal === 'undefined') {
    console.error('[oficina] xterm.js não carregou — o terminal não abre.');
    return null;
  }
  const host = document.createElement('div');
  host.className = 'ofi-sh-xterm';
  // O host entra no documento AGORA, e não depois: `term.open()` num elemento
  // solto não tem caixa para medir, e tudo o que vier a seguir parte do
  // tamanho errado. Quem chama sem encaixe (ninguém, hoje) ainda funciona —
  // só volta a nascer com o padrão do xterm.
  if (encaixe) encaixe.appendChild(host);

  const term = new Terminal({
    fontFamily: TR_SH_FONTE,
    fontSize: TR_SH_CORPO,
    lineHeight: TR_SH_ALTURA,
    scrollback: TR_SH_ROLAGEM,
    cursorBlink: true,
    // ⚠️ SEM FOCO, CURSOR NENHUM. O padrão do xterm é `outline` — um contorno
    // vazado, que num canvas com vários terminais vira meia dúzia de marcas
    // dizendo "estou vivo aqui" ao mesmo tempo. Aqui o quadradinho é o sinal de
    // ONDE o teclado vai cair, e ele só faz sentido no terminal que tem o
    // teclado. (Isto só passou a ser visível quando o `blur` abaixo voltou a
    // funcionar: com o foco preso, o cursor nunca chegava ao estado inativo.)
    cursorInactiveStyle: 'none',
    convertEol: false,          // um PTY já manda o fim de linha de verdade
    // ⚠️ SEM ISTO O TERMINAL NÃO REFLUI AO SER REENQUADRADO, e o defeito
    // parecia não ter causa: `term.resize()` era chamado, `term.cols` MUDAVA
    // de 57 para 147, e o texto continuava quebrado nos mesmos 57.
    //
    // O xterm reflui o buffer sozinho, mas por padrão PÕE A LINHA DO CURSOR
    // FORA disso — e num terminal parado no prompt, a linha do cursor é
    // exatamente a linha que se quer refluir. O resultado é o pior caso: a
    // única linha visível é a única que não reflui.
    //
    // MEDIDO no xterm.js 6.0.0 desta pasta, prompt longo a 40 colunas
    // alargado para 120:
    //   sem  → ['C:\_G\Fluxo...\Apagar', ' depois\...\backup>']  (2 linhas)
    //   com  → ['C:\_G\Fluxo...\Apagar depois\...\backup>']       (1 linha)
    reflowCursorLine: true,
    theme: trShTema(),
  });
  term.open(host);

  // ⚠️ CADA BYTE VAI CRU PARA O PTY, e é isso que faz o terminal ser um
  // terminal. Enter, setas, Tab, Ctrl+C, Ctrl+R, colagem — o xterm já codifica
  // tudo do jeito certo, e é por isso que o histórico com ↑↓ e a interrupção
  // com Ctrl+C deixaram de ser problema nosso: eles nunca foram nossos.
  //
  // ⚠️ MAS NADA SAI DAQUI ENQUANTO A TELA ESTÁ SENDO REIDRATADA — e esse
  // porteiro é a correção de um laço que fazia o terminal se reabrir sozinho
  // para sempre. Nem todo byte que o xterm emite é tecla do usuário: `ESC[c`,
  // `ESC[6n` e parentes são PERGUNTAS, e o emulador RESPONDE a elas por
  // `onData`. Na abertura isso é certo (quem perguntou foi o conhost, e ele
  // consome a resposta). Na reidratação é desastre: a pergunta gravada no
  // buffer é reexecutada, ninguém mais espera a resposta, e ela chega ao
  // `cmd.exe` como TEXTO DIGITADO — o `^[[?1;2c` que aparecia na tela. Pior:
  // digitar num terminal morto o reabre, o terminal novo pergunta de novo, e o
  // laço não fecha mais.
  const calado = () => !!(trShTerms[id] && trShTerms[id].reidratando);
  term.onData(d => {
    if (calado()) return;
    window.pywebview.api.escrever_no_shell(currentProject, id, trShParaB64(d));
  });
  // Por onde vêm os bytes de modo mouse e de colagem entre colchetes. Aqui a
  // string já é binária (um byte por caractere), então `btoa` direto.
  term.onBinary(d => {
    if (calado()) return;
    window.pywebview.api.escrever_no_shell(currentProject, id, btoa(d));
  });

  // ⚠️ O Ctrl+V É INTERCEPTADO ANTES DE O XTERM O TRANSFORMAR EM 0x16 — ver o
  // bloco de comentário de `trShColador`, que é onde o porquê está escrito.
  // O manipulador roda ANTES do processamento de teclas do xterm, e o `false`
  // faz ele não processar a tecla nem cancelar o evento: assim a colagem
  // nativa do navegador acontece, e cai no campo escondido que acabamos de
  // focar.
  term.attachCustomKeyEventHandler(ev => {
    if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && (ev.key === 'v' || ev.key === 'V')) {
      return false;
    }
    return true;
  });

  // ⚠️ A COLAGEM DE IMAGEM É INTERCEPTADA NA CAPTURA, E A FASE É O CONSERTO.
  // O xterm escuta `paste` no `<textarea>` escondido dele, que é DESCENDENTE
  // do host: na fase de borbulha nós chegaríamos depois, com o xterm já tendo
  // decidido o que fazer. Na captura chegamos antes, e um `stopPropagation`
  // resolve — sem isso, um print com legenda (o Windows põe texto E imagem na
  // área de transferência ao copiar de alguns programas) colaria a legenda no
  // prompt junto com o caminho do arquivo.
  //
  // ⚠️ SÓ IMAGEM PASSA POR AQUI. Colagem de texto sai intacta pelo caminho de
  // sempre — não se toca nela, e é por isso que o `return` vem antes de
  // qualquer `preventDefault`.
  host.addEventListener('paste', e => {
    const itens = (e.clipboardData && e.clipboardData.items) || [];
    let arquivo = null;
    for (let i = 0; i < itens.length; i++) {
      if (itens[i].kind === 'file' && (itens[i].type || '').startsWith('image/')) {
        arquivo = itens[i].getAsFile();
        break;
      }
    }
    if (!arquivo) return;                       // texto: o caminho de hoje segue
    e.preventDefault();
    e.stopPropagation();
    trShColarImagem(id, arquivo);
  }, { capture: true });

  host.addEventListener('focusin', () => { trShComFoco = id; });

  // ⚠️ QUEM CLICA FORA DA TELA PRETA DEIXA DE SER O DONO DAS TECLAS, e sem
  // isto o Delete da Oficina simplesmente não funcionava. O xterm captura o
  // teclado num `<textarea>` escondido; `ofiLigarShells` devolve o foco a ele
  // depois de CADA redesenho (e selecionar um nó já é um redesenho). Resultado:
  // o usuário selecionava o cartão, apertava Delete, e a tecla ia para o
  // terminal — onde apagar um caractere é o certo, e apagar o nó seria errado.
  // Por isso a decisão é pelo GESTO: clicou na tela preta, o terminal manda;
  // clicou em qualquer outro lugar, o canvas manda.
  document.addEventListener('mousedown', e => {
    if (trShComFoco !== id) return;
    if (e.target.closest && e.target.closest('[data-sh-tela]')) return;
    trShComFoco = null;
    // ⚠️ `term`, E NÃO `t.term`. Esta linha nasceu errada e o erro era INVISÍVEL:
    // não existe `t` neste escopo, então cada clique fora levantava um
    // `ReferenceError` que o `catch` engolia. O terminal nunca perdia o foco —
    // o `<textarea>` escondido do xterm seguia sendo o `activeElement` —, e por
    // isso o bloco do cursor continuava cheio e piscando num cartão que o
    // usuário nem tinha selecionado.
    try { term.blur(); } catch (err) { /* já morto */ }
  });

  // ⚠️ O PRÓPRIO HOST VIGIA O TAMANHO DELE, e isso não é redundância com a
  // pega de redimensionar. A pega é UM dos jeitos de a caixa mudar; os outros
  // são a janela do programa mudando de largura, a barra lateral abrindo, o
  // cartão voltando de uma sub-aba com outro tamanho. Sem o observador, o PTY
  // ficava com o número de colunas de antes — e como o ConPTY posiciona por
  // COLUNA ABSOLUTA, a saída passava a ser escrita na coluna errada.
  // `contentRect` é medida de LAYOUT: o `scale()` do canvas não entra nela,
  // pela mesma razão que `trShDimensionar` usa `clientWidth`.
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => trShDimensionar(id)).observe(host);
  }

  // `avisado`: último tamanho CONFIRMADO pelo backend — ver `trShDimensionar`.
  // `reidratando`: porteiro do `onData` acima.
  // `seq`: o bilhete que faz a última medida vencer as respostas atrasadas.
  trShTerms[id] = { term, host, avisado: null, reidratando: false, seq: 0 };
  // ⚠️ DIMENSIONAR VEM ANTES DE REIDRATAR, E O `await` NÃO É ENFEITE. De nada
  // adianta o host estar no documento se o replay entrar antes de a medida
  // chegar ao backend: o `reset()` da reidratação correria contra o despejo de
  // tela que o ConPTY faz ao receber o tamanho novo, e as duas escritas se
  // sobrepõem. Encadeado, o terminal já está do tamanho certo — e o backend
  // sabe disso — quando o replay começa.
  trShDimensionar(id).then(() => trShReidratar(id));
  return trShTerms[id];
}

