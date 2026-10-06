// ═══ TRABALHOS → Oficina: DESENHAR UM NÓ ═══════════════════════════════════
//
// A cor, o tamanho, as pegas, as alças, o HTML do nó — e as anotações que o
// agente escreve, que são um segundo nó colado no primeiro.
//
// Arquivo próprio pela mesma regra que dividiu `arquivos.py` e o Inspetor:
// **cada arquivo responde uma pergunta**. A casca (`trabalhos-oficina.js`)
// responde *o que está no palco*; este responde *que forma cada coisa tem*.
//
// ⚠️ TUDO AQUI É EMISSÃO DE HTML, e nada aqui liga evento. Quem liga é
// `trabalhos-oficina-arraste.js` e `trabalhos-oficina-edicao.js`, depois de o
// `innerHTML` já estar no lugar. Misturar os dois foi o que já fez um handler
// ser registrado duas vezes no mesmo nó.
//
// ⚠️ AS ANOTAÇÕES NÃO SÃO PARTE DO NÓ. Elas são um nó próprio, posicionado por
// geometria em cima do dono — ver `ofiTopoDaAnotacao`. É o que permite arrastar
// o terminal sem arrastar o histórico dele.

// ── A cor de um nó ──────────────────────────────────────────────────────────

function ofiCorCss(cor) {
  if (!cor) return 'var(--gray)';
  return cor.startsWith('--') ? `var(${cor})` : cor;
}

// ⚠️ A COR PADRÃO É POR TIPO DE NÓ, e não uma só para todos. `--gray` serve
// para o terminal, cujo cinza é a borda de um nó sem papel; num TEXTO solto a
// mesma regra pintava a letra de cinza sobre fundo escuro, e o usuário não
// tinha pedido cor nenhuma — só escreveu. Texto nasce BRANCO. Nota nasce
// âmbar, que é o amarelo de bloco de notas que ela sempre teve.
const OFI_COR_PADRAO = { texto: '--text', nota: '--amber' };

function ofiCorDoNo(no) {
  return ofiCorCss(no.cor || OFI_COR_PADRAO[no.tipo] || null);
}

// ⚠️ O PASTEL É CALCULADO, E NÃO UMA SEGUNDA PALETA. Escrever oito tokens
// `--x-pastel` obrigaria a inventar o pastel de um HEX escolhido no seletor
// nativo — que é metade das cores possíveis — e a manter as duas listas em dia
// nos três temas. `color-mix` resolve QUALQUER cor, token ou hex, na hora de
// pintar, e por isso continua acompanhando a troca de tema.
//
// ⚠️ DEVOLVE DUAS DECLARAÇÕES, de propósito. A primeira é o amarelo de sempre;
// a segunda só vale se o motor entender `color-mix`. Num WebView2 antigo a
// nota fica amarela em vez de ficar TRANSPARENTE, que é o que uma declaração
// só daria.
const OFI_PASTEL_FORCA = 22;

function ofiPastel(cor) {
  return `background: var(--yellow-soft); background: color-mix(in srgb, ${cor} ${OFI_PASTEL_FORCA}%, white);`;
}

// ── O tamanho escolhido à mão ───────────────────────────────────────────────
//
// ⚠️ NOTA E TEXTO GUARDAM COISAS DIFERENTES, e por isso não há um campo só.
// Na nota o usuário arrasta a CAIXA, e o que se grava é largura e altura. No
// texto ele arrasta o CORPO DA LETRA — a caixa é derivada da fonte, e gravar
// largura nele deixaria a letra grande dentro de uma caixa pequena, cortada.
// Nó sem nada gravado não recebe estilo nenhum e fica com o tamanho do CSS.
function ofiTamanho(no) {
  if (no.tipo === 'texto') return no.fonte ? `font-size:${no.fonte}px;` : '';
  return (no.largura ? `width:${no.largura}px;` : '')
       + (no.altura ? `height:${no.altura}px;` : '');
}

// ── A pega de redimensionar ─────────────────────────────────────────────────
//
// O canto inferior direito. No nó de texto ela muda o corpo da letra, e não a
// caixa — o `data-pega-tipo` é o que `ofiLigarPegas` lê para saber qual das
// duas coisas o arraste está mexendo, e o CSS usa para trocar o cursor.
function ofiPega(id, tipo) {
  const eTexto = tipo === 'texto';
  return `<div class="ofi-pega" data-pega="${escapeHtml(id)}"
               data-pega-tipo="${eTexto ? 'texto' : 'caixa'}"
               title="${eTexto ? 'Arraste para mudar o tamanho da letra'
                               : 'Arraste para redimensionar'}"></div>`;
}

// ── As alças de ligação ─────────────────────────────────────────────────────
//
// Os quatro pontos que nascem nas bordas do nó e de onde se puxa um fio.
// ⚠️ O TERMINAL NÃO RECEBE ALÇAS — ver o comentário dentro de `ofiDesenharNo`.
function ofiAlcas(id) {
  // ⚠️ OS NOMES DOS LADOS SÃO EM PORTUGUÊS, e isso NÃO é preferiência: são as
  // classes que o CSS posiciona (`.ofi-alca-dir`, `-esq`, `-cima`, `-baixo`, em
  // `trabalhos.css`). Com `-t/-r/-b/-l` nenhuma regra casa, as quatro caem na
  // posição padrão e viram UMA bolinha azul empilhada no canto de cima — que
  // foi exatamente o defeito relatado.
  return ['cima', 'dir', 'baixo', 'esq'].map(lado =>
    `<span class="ofi-alca ofi-alca-${lado}" data-alca="${escapeHtml(id)}"
           data-lado="${lado}" title="Arraste até outro nó para ligar"></span>`
  ).join('');
}

// ── Desenhar um nó ──────────────────────────────────────────────────────────

function ofiDesenharNo(no) {
  const sel = ofiSelecao.has(no.id) ? ' selecionado' : '';
  // Token acompanha a troca de tema; hex, não — e é por isso que os atalhos da
  // paleta são todos token.
  const cor = ofiCorDoNo(no);
  const pos = `left:${no.x}px; top:${no.y}px;${ofiTamanho(no)}`;

  // ⚠️ TODO NÓ TEM PONTO DE COR, inclusive nota e texto. Eles não tinham, e o
  // botão "Colorir" da barra contextual funcionava neles — ou seja, a cor
  // existia e só o caminho curto faltava. Um nó em que se pode trocar a cor por
  // um lugar e não por outro é pior que um nó sem cor nenhuma.
  const ponto = (id, rotulo) =>
    `<span class="ofi-ponto-cor ofi-ponto-solto" style="background:${cor}"
           data-cor-de="${escapeHtml(id)}" title="${rotulo}"></span>`;

  if (no.tipo === 'texto') {
    return `<div class="ofi-no ofi-texto${sel}" data-id="${escapeHtml(no.id)}" style="${pos}">
              ${ponto(no.id, 'Clique para trocar a cor do texto')}
              <span class="ofi-editavel" data-editar="nome" data-no="${escapeHtml(no.id)}"
                    style="color:${cor}"
                    title="Dois cliques para editar">${escapeHtml(no.nome)}</span>
              ${ofiPega(no.id, 'texto')}
            </div>`;
  }
  if (no.tipo === 'nota') {
    // ⚠️ O QUE SE VÊ É MARKDOWN RENDERIZADO; o que se EDITA é o texto cru.
    // É o desenho de um bloco de notas de verdade, e foi o pedido: a nota mostra
    // o resultado, e só no duplo clique ela vira o texto de origem. Por isso o
    // corpo NÃO é `ofi-editavel` — a edição troca o conteúdo dele por um
    // `<textarea>` (ver `ofiEditarNota`), em vez de deixar o usuário digitar
    // markdown por cima de HTML já renderizado.
    const corpo = (no.texto || '').trim()
      ? ofiMarkdown(no.texto)
      : '<span class="ofi-nota-vazia">Dois cliques para escrever…</span>';
    // ⚠️ A COR ESCOLHIDA PINTA A NOTA, e não só a lombada dela. Antes o corpo
    // era um `--yellow-soft` fixo e a cor ia para os 3 px da borda esquerda:
    // escolher "azul" devolvia uma nota amarela com um traço azul, que não é o
    // que ninguém entende por "a cor da nota". O fundo é o PASTEL da cor — um
    // Post-it é claro, e o token cru sobre texto escuro não se lê — e a lombada
    // fica com a cor cheia, que é o que dá a ela um contorno.
    return `<div class="ofi-no ofi-nota${sel}" data-id="${escapeHtml(no.id)}"
                 data-nota="${escapeHtml(no.id)}"
                 style="${pos} ${ofiPastel(cor)} border-left-color:${cor}">
              <div class="ofi-nota-cab">
                ${ponto(no.id, 'Clique para trocar a cor da nota')}
                <div class="ofi-nota-t ofi-editavel" data-editar="nome" data-no="${escapeHtml(no.id)}"
                     title="Dois cliques para renomear">${escapeHtml(no.nome)}</div>
              </div>
              <div class="ofi-nota-c" data-nota-corpo="${escapeHtml(no.id)}"
                   title="Dois cliques para editar">${corpo}</div>
              ${ofiPega(no.id, 'nota')}
            </div>`;
  }

  // ── O terminal ───────────────────────────────────────────────────────────
  //
  // ⚠️ UM SÓ TIPO DE NÓ QUE RODA COISA, e a unificação foi ordem do usuário:
  // *"agente e terminal é uma coisa só, não sei por que você separou"*. O nó é
  // sempre o terminal do sistema, aberto na pasta raiz; ser agente é um MODO
  // dele — hoje, o agente da biblioteca que foi copiado para `.claude/agents/`.
  // Quem criar um segundo tipo de nó para agente estará desfazendo isto.
  //
  // ⚠️ SEM ALÇAS DE LIGAÇÃO. As setas da Oficina viraram DESENHO: quem liga um
  // agente ao outro é o próprio produto, pelo NOME da sessão (`--name` na
  // abertura, `@nome` dentro da conversa). Desenhar alça aqui prometeria uma
  // ligação de execução que não existe mais.
  //
  // ⚠️ SEM CAMPO "FALAR COM ELE" E SEM BOTÃO "PARAR" no rodapé. Um terminal em
  // que se fala por uma caixa separada não é um terminal; digita-se na própria
  // tela preta.
  const luz = no.aberto ? ' ofi-sh-on' : '';
  // `no.modo` guarda o CAMINHO do item na biblioteca (`Claude/Sub-agente`); a
  // etiqueta mostra só o último pedaço, senão o grupo ocupa o cartão inteiro.
  const marca = no.modo
    ? `<span class="tr-tag ofi-tag-modo" title="${escapeHtml(no.modo + ' — copiado para .claude/agents/ deste projeto')}">${escapeHtml(no.modo.split('/').pop())}</span>`
    : '';
  const cartao = no.cartao_origem
    ? `<span class="tr-tag tr-tag-briefing">#${escapeHtml(no.cartao_origem)}</span>` : '';
  return `
    <div class="ofi-no ofi-shell${sel}" data-id="${escapeHtml(no.id)}"
         style="${pos} border-color:${cor}">
      <div class="ofi-term-cab">
        <span class="ofi-bolinha ofi-sh-luz${luz}"
              title="${no.aberto ? 'Aberto' : 'Fechado — digite uma linha para reabrir'}"></span>
        <span class="ofi-avatar ofi-ponto-cor" style="background:${cor}"
              data-cor-de="${escapeHtml(no.id)}"
              title="Clique para trocar a cor">${escapeHtml((no.nome || '?')[0])}</span>
        <b class="ofi-term-nome ofi-editavel" data-editar="nome" data-no="${escapeHtml(no.id)}"
           title="Dois cliques para renomear">${escapeHtml(no.nome)}</b>
        ${marca}${cartao}
        ${no.aberto
          ? `<span class="ofi-sh-botoes">
               <button class="ofi-sh-x" data-sh-parar="${escapeHtml(no.id)}"
                       title="Interromper o que está rodando — o mesmo que Ctrl+C">⏹</button>
               <button class="ofi-sh-x" data-sh-fechar="${escapeHtml(no.id)}"
                       title="Excluir este nó — fecha o terminal junto">✕</button>
             </span>`
          : ''}
      </div>
      <div class="ofi-sh-tela" data-sh-tela="${escapeHtml(no.id)}"></div>
      ${ofiAlcas(no.id)}${ofiPega(no.id, 'terminal')}
    </div>`;
}

// ── As anotações do agente, num nó próprio do canvas ─────────────────
//
// ⚠️ SÓ LEITURA, E É O PONTO DA OBRA. `Anotações/<nó>/` tem um escritor só — o
// agente, com as ferramentas de arquivo dele —, e um campo editável aqui daria
// dois donos ao mesmo arquivo. Não existe `ofiEditarAnotacao`, e não deve.
//
// ⚠️ ESTE NÓ É DERIVADO DA PASTA, e não mora no `Layout.json`. Por isso ele não
// tem botão de excluir — apagado, voltaria no redesenho seguinte, e um excluir
// que não exclui é pior que nenhum —, não tem posição própria (pende do agente e
// anda com ele), e NADA que se faça com ele na tela apaga o arquivo. O nó é
// vista; o dado está no disco.
//
// ⚠️ E ELE NÃO PODE TER A CLASSE `.ofi-no`, NEM ENTRAR EM `ofiNos`. `ofiLigarNos`
// pendura o arraste em todo `.ofi-no`, e `ofiIniciarArrasteDeNo` procura o id em
// `ofiNos` para mover. Com aquela classe ele viraria arrastável, selecionável
// pelo retângulo e apareceria na barra contextual — que oferece Excluir,
// Conectar e Agrupar, três coisas que ele não pode ter. É o erro mais fácil de
// cometer aqui, e ele não dá mensagem nenhuma.
//
// ⚠️ UM NÓ POR AGENTE, e não um por arquivo. Seis anotações são uma combo box,
// não seis cartões: um nó por arquivo faz o canvas crescer sozinho.

function ofiQuandoDaAnotacao(quando) {
  if (!quando) return '';
  const d = new Date(quando * 1000);
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ⚠️ ESPELHO DA ALTURA DE `.ofi-shell` EM `trabalhos.css`, e é o preço de
// pendurar um nó embaixo de outro antes de o navegador medir qualquer coisa:
// `ofiTamanho` só emite `height` quando o usuário arrastou a pega, e sem isso a
// altura do terminal existe só na folha de estilo. Quem mudar lá, muda aqui —
// senão o nó de anotações descola do agente e ninguém sabe por quê.
const OFI_ALTURA_PADRAO_DO_SHELL = 300;
const OFI_RESPIRO_DA_ANOTACAO = 18;
// ⚠️ A BORDA DO TERMINAL CONTA, e é fácil esquecer: `.ofi-shell` é content-box,
// então a `height` dele não inclui o 1px de borda de cima nem o de baixo. Sem
// somar estes dois pixels, o vão fica maior que a linha tracejada que o CSS
// desenha, e sobra um pedaço de nada entre a linha e o cartão.
const OFI_BORDA_DO_SHELL = 2;

function ofiTopoDaAnotacao(no) {
  return no.y + (no.altura || OFI_ALTURA_PADRAO_DO_SHELL)
       + OFI_BORDA_DO_SHELL + OFI_RESPIRO_DA_ANOTACAO;
}

// Qual anotação deste nó está à vista. Cai na mais recente quando a escolhida
// sumiu: o agente pode ter renomeado ou apagado o arquivo entre dois redesenhos,
// e uma combo box apontando para nada mostraria corpo vazio sem dizer por quê.
function ofiAnotacaoDoNo(no) {
  const lista = no.anotacoes || [];
  if (!lista.length) return null;
  const nome = ofiAnotacaoEscolhida[no.id];
  return lista.find(a => a.nome === nome) || lista[0];
}

// Nó sem anotação nenhuma NÃO GANHA NÓ — nem vazio, nem com "sem anotações". A
// maioria dos nós nunca terá uma, e um cartão vazio por agente é ruído no canvas.
// Devolve string vazia também para nota e texto: `anotacoes` só chega no nó de
// terminal, que é o único com pasta de agente.
function ofiNoDeAnotacoes(no) {
  const lista = no.anotacoes || [];
  if (!lista.length) return '';
  const escolhida = ofiAnotacaoDoNo(no);
  const cor = ofiCorDoNo(no);
  // A largura acompanha a do terminal: arrastada, ela está em `no.largura`;
  // intocada, o CSS usa a mesma `--ofi-shell-w` que o terminal usa. O `+ 2` é a
  // borda do `.ofi-shell`, pela mesma razão de `OFI_BORDA_DO_SHELL` — aqui este
  // cartão é border-box e aquele não é.
  const largura = no.largura ? `width:${no.largura + OFI_BORDA_DO_SHELL}px;` : '';
  const pos = `left:${no.x}px; top:${ofiTopoDaAnotacao(no)}px;${largura}`;
  const opcoes = lista.map(a =>
    `<option value="${escapeHtml(a.nome)}"${
      a.nome === escolhida.nome ? ' selected' : ''}>${escapeHtml(a.nome)}</option>`).join('');
  return `
    <div class="ofi-anotno" data-anot-de="${escapeHtml(no.id)}"
         style="${pos} border-color:${cor}">
      <div class="ofi-anotno-cab">
        <span class="ofi-bolinha" style="background:${cor}"></span>
        <span class="ofi-anotno-t">Anotações de ${escapeHtml(no.nome)}</span>
        <span class="ofi-cadeado"
              title="Só leitura — quem escreve aqui é o agente, na pasta de anotações dele">🔒</span>
      </div>
      <select class="ofi-anotno-sel" data-anot-sel="${escapeHtml(no.id)}"
              title="Escolha qual anotação ver">${opcoes}</select>
      <div class="ofi-anotno-c">${ofiMarkdown(escolhida.texto)}</div>
      <div class="ofi-anotno-pe">escrito pelo agente · ${
        escapeHtml(ofiQuandoDaAnotacao(escolhida.quando))}</div>
    </div>`;
}

// ⚠️ RELIGADA A CADA REDESENHO, como todo ouvinte dos nós — ver o comentado de
// `ofiDesenhar`. O `innerHTML` de lá apaga este `change` junto com o resto, e o
// sintoma seria a combo box parar de trocar o texto, sem erro nenhum.
function ofiLigarAnotacoes() {
  document.querySelectorAll('#ofi-nos [data-anot-sel]').forEach(sel => {
    sel.addEventListener('change', () => {
      const id = sel.dataset.anotSel;
      ofiAnotacaoEscolhida[id] = sel.value;
      // ⚠️ SEM `ofiDesenhar()` AQUI. O redesenho refaz o `innerHTML` de todos os
      // nós, e com ele a tela preta de cada terminal aberto — remontar um xterm
      // para trocar um texto de leitura seria caro e visível. Só duas coisas
      // mudam neste cartão, e são dois elementos: o corpo e o pé.
      const cartao = sel.closest('.ofi-anotno');
      const no = ofiNos.find(n => n.id === id);
      const a = no && ofiAnotacaoDoNo(no);
      if (!cartao || !a) return;
      cartao.querySelector('.ofi-anotno-c').innerHTML = ofiMarkdown(a.texto);
      cartao.querySelector('.ofi-anotno-pe').textContent =
        'escrito pelo agente · ' + ofiQuandoDaAnotacao(a.quando);
    });
  });
}

// ── Markdown da nota ────────────────────────────────────────────────────────
//
// ⚠️ REESCRITO NA RECUPERAÇÃO — o original usava a mesma função, mas o corpo
// dela não foi recuperado. Este é um subconjunto deliberado: negrito, itálico,
// código, título, lista e link. Markdown completo numa nota de canvas seria
// biblioteca nova para um caso que cabe em vinte linhas.
function ofiMarkdown(texto) {
  const esc = escapeHtml(texto || '');
  const linhas = esc.split('\n');
  const saida = [];
  let lista = null;
  const fechar = () => { if (lista) { saida.push(`</${lista}>`); lista = null; } };
  const inline = t => t
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\W)\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');
  for (const l of linhas) {
    const t = l.trim();
    if (!t) { fechar(); continue; }
    const h = t.match(/^(#{1,3})\s+(.*)$/);
    if (h) { fechar(); saida.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue; }
    const ul = t.match(/^[-*]\s+(.*)$/);
    const ol = t.match(/^\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      const querida = ul ? 'ul' : 'ol';
      if (lista !== querida) { fechar(); saida.push(`<${querida}>`); lista = querida; }
      saida.push(`<li>${inline((ul || ol)[1])}</li>`);
      continue;
    }
    if (t.startsWith('&gt;')) { fechar(); saida.push(`<blockquote>${inline(t.slice(4).trim())}</blockquote>`); continue; }
    fechar();
    saida.push(`<p>${inline(t)}</p>`);
  }
  fechar();
  return saida.join('');
}
