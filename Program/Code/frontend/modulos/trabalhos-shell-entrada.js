// ══ TRABALHOS → terminal: o que entra e o que volta ═══════════════════════
//
// O cursor atravessando o reflow, a reidratação ao voltar para a sub-aba, o
// colar de texto, o colar de print e o interromper.
//
// ⚠️ O CURSOR PRECISA SER RECOLOCADO DEPOIS DE UM REFLOW. Redimensionar o nó
// reflui as linhas, e o xterm devolve o cursor para onde ele estaria numa
// tela de outra largura — o que, no meio de um comando meio digitado, come
// caracteres. Guardar o deslocamento em relação ao início da linha LÓGICA (e
// não da linha visual) é o que sobrevive à mudança de largura.
//
// ⚠️ REIDRATAR NÃO É REEXECUTAR. O que volta é o que já saiu, guardado em bytes
// pelo backend e aparado — as sequências de posicionamento de cursor são
// tiradas antes, senão o xterm redesenha o histórico por cima de si mesmo.
//
// ⚠️ COLAR UM PRINT ESCREVE UM ARQUIVO e digita o caminho dele: o terminal não
// tem como receber imagem, e o assistente externo lê arquivo. É a única saída
// que funciona nos dois lados.
// ── O cursor através do reflow ──────────────────────────────────────────────
//
// ⚠️ ISTO EXISTE PORQUE O ConPTY NÃO MANDA NADA AO REDIMENSIONAR. Medido com um
// script à parte, com um leitor que não bufferiza: encolher, crescer, voltar ao
// mesmo tamanho — zero byte em todos os casos. Ou seja, ninguém do outro lado
// vai corrigir a tela; o reflow é inteiramente do xterm, e o pedaço que ele não
// faz é este.
//
// Só vale no buffer NORMAL. Num programa de tela cheia (buffer alternativo) não
// há linha lógica que atravesse quebras — e ali quem repinta é o programa, que
// recebe o tamanho novo pelo pseudoterminal.

// ⚠️ `getLine` recebe índice ABSOLUTO (contando o histórico de rolagem) e
// `cursorY` é relativo ao topo da JANELA. `baseY` faz a ponte, e trocar um pelo
// outro só quebra quando há histórico — ou seja, sempre, num terminal em uso.
function trShInicioDaLinhaLogica(b, absoluto) {
  let i = absoluto;
  while (i > 0) {
    const l = b.getLine(i);
    if (!l || !l.isWrapped) break;
    i--;
  }
  return i;
}

function trShDeslocamentoDoCursor(term) {
  try {
    const b = term.buffer.active;
    if (b.type !== 'normal') return null;
    const abs = b.baseY + b.cursorY;
    return (abs - trShInicioDaLinhaLogica(b, abs)) * term.cols + b.cursorX;
  } catch (e) {
    return null;
  }
}

function trShRecolocarCursor(term, desloc) {
  if (desloc === null || desloc === undefined) return;
  try {
    const b = term.buffer.active;
    if (b.type !== 'normal') return;
    const abs = b.baseY + b.cursorY;
    const alvo = trShInicioDaLinhaLogica(b, abs) + Math.floor(desloc / term.cols);
    const x = desloc % term.cols;
    const y = alvo - b.baseY;
    if (y === b.cursorY && x === b.cursorX) return;
    // Fora da janela não há para onde mandar o cursor por `ESC[linha;colunaH`,
    // que é sempre relativo a ela. Deixar como está é melhor que colocá-lo
    // numa linha visível que não é a dele.
    if (y < 0 || y >= term.rows) return;
    term.write('\x1b[' + (y + 1) + ';' + (x + 1) + 'H');
  } catch (e) {
    /* buffer em transição — a próxima medida acerta */
  }
}

// ── Reidratar ───────────────────────────────────────────────────────────────
//
// Com a adoção de subárvore, trocar de sub-aba e voltar não perde nada — o
// terminal continua vivo, destacado, recebendo saída. Isto aqui cobre os casos
// FRIOS: a primeira montagem do nó na sessão, a volta de outro projeto, e a
// recarga da página.

async function trShReidratar(id) {
  const t = trShTerms[id];
  if (!t) return;
  const r = await window.pywebview.api.carregar_shell(currentProject, id);
  if (!r || !r.success || !trShTerms[id]) return;
  const bytes = trShDeB64(r.b64);
  if (!bytes.length) return;
  // O porteiro fica fechado do `reset` até o xterm terminar de digerir o
  // replay. O `write` do xterm é assíncrono e avisa por callback; o
  // `setTimeout` é só a rede de segurança para o callback que não vier — um
  // porteiro que trava fechado calaria o teclado do usuário, e isso seria pior
  // que o defeito que ele conserta.
  t.reidratando = true;
  const abrir = () => { if (trShTerms[id]) trShTerms[id].reidratando = false; };
  t.term.reset();
  try {
    t.term.write(bytes, abrir);
  } catch (e) {
    t.term.write(bytes);
    abrir();
  }
  setTimeout(abrir, 2000);
}

// ── Colar ───────────────────────────────────────────────────────────────────
//
// ⚠️ O Ctrl+V NÃO CHEGAVA AQUI, E A CULPA NÃO ERA DO WEBVIEW. Medido: colar
// funciona em todo campo do programa e só morria no terminal. A razão está
// dentro do xterm.js, e é ele se comportando como TERMINAL: com Ctrl pressionado
// ele mapeia a letra para o código de controle correspondente, e `V` é 0x16 —
// o "literal next" dos terminais Unix. Ele cancelava o evento e mandava 0x16
// para o PTY. O Claude Code ignora esse byte, e o sintoma era "Ctrl+V não faz
// nada": nem colava, nem escrevia, nem dava erro.
//
// ⚠️ AQUI O Ctrl+V COLA, e é decisão contra a convenção do terminal. A
// convenção manda usar Ctrl+Shift+V, e o 0x16 quase nunca serve a quem usa um
// assistente. O usuário pediu o gesto que ele já tem no dedo:
// *"eu queria clicar ali e apertar Ctrl+V, um print que eu tirei"*.
// Ctrl+Shift+V também cola, para quem tem o outro costume.
//
// ⚠️ E A COLAGEM PASSA POR UM CAMPO DE VERDADE, sem pedir permissão de área de
// transferência. `navigator.clipboard.read()` exigiria uma permissão que este
// WebView não concede, e falharia calada. Em vez disso, o Ctrl+V move o foco
// para um `<textarea>` escondido e deixa o navegador colar NELE — que é
// exatamente o caminho que já funciona no resto do programa. O que cai lá é
// lido do evento e encaminhado; o foco volta para o terminal em seguida.

// ⚠️ O CONSERTO É NÃO FAZER NADA — e isto foi CONFERIDO no código do xterm
// desta pasta, não deduzido. Em `_keyDown`, a primeira linha é:
//
//     if (this._customKeyEventHandler && false === this._customKeyEventHandler(e)) return false;
//
// O `return` acontece ANTES de qualquer `preventDefault` (o `cancel(e)` vem
// bem depois, no caminho normal). Ou seja: devolver `false` faz o xterm
// ignorar a tecla E deixar o evento intacto — e então o navegador executa a
// colagem nativa dele em cima do `<textarea>` do próprio xterm, que já tem
// ouvinte de `paste` registrado (em `textarea` E em `element`).
//
// Quem trata o texto passa a ser o xterm, e é o certo: ele embrulha a colagem
// no modo entre colchetes (`ESC[200~`), que é o que faz um trecho de dez
// linhas chegar como UM bloco em vez de dez Enters. A imagem continua nossa,
// pelo ouvinte de captura logo abaixo, que roda antes do dele.
//
// (Houve aqui uma versão com `<textarea>` escondido e dança de foco, para
// contornar uma permissão de área de transferência que nunca foi o problema.
// Foi jogada fora: o problema era só o 0x16.)

// ── Colar um print ──────────────────────────────────────────────────────────
//
// O arquivo vai em base64 porque a ponte do pywebview troca JSON, e byte cru
// não atravessa JSON. É o mesmo caminho que a saída do terminal já faz na
// direção contrária (`trShParaB64`), só que aqui o volume é outro — um print
// de tela cheia passa de 1 MB —, e por isso a leitura é do `FileReader` e não
// de um laço nosso sobre os bytes.
async function trShColarImagem(id, arquivo) {
  try {
    const b64 = await new Promise((resolve, reject) => {
      const leitor = new FileReader();
      // `readAsDataURL` devolve `data:image/png;base64,XXXX` — o que interessa
      // é o depois da vírgula.
      leitor.onload = () => resolve(String(leitor.result).split(',')[1] || '');
      leitor.onerror = () => reject(leitor.error);
      leitor.readAsDataURL(arquivo);
    });
    if (!b64) return;
    const r = await window.pywebview.api.colar_imagem_no_shell(
      currentProject, id, b64, arquivo.type || '');
    if (!r || !r.success) {
      showToast((r && r.error) || 'Não deu para colar a imagem.', true);
      return;
    }
    const t = trShTerms[id];
    if (t) t.term.focus();
  } catch (err) {
    showToast('Não deu para ler a imagem colada: '
      + (err && err.message ? err.message : err), true);
  }
}

// O Ctrl+C do botão do cabeçalho. A tecla não passa por aqui: o xterm manda o
// byte 0x03 sozinho, como qualquer outra.
async function trShInterromper(id) {
  const r = await window.pywebview.api.enviar_sinal_ao_shell(currentProject, id);
  // `r &&`: a ponte pode devolver `undefined` num terminal que acabou de
  // fechar, e um `r.success` ali derrubava o handler antes do aviso.
  if (!r || !r.success) showToast((r && r.error) || 'Não deu para interromper.', true);
  const t = trShTerms[id];
  if (t) t.term.focus();
}
