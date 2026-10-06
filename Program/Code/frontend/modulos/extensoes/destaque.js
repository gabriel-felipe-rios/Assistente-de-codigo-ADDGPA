// ═════════════════════════ EXTENSÕES DO PROGRAMA — DESTACAR ══
// O "Destacar extensões" (D2): mostra, em qualquer aba, o que na tela veio de
// extensão e o que é do programa — na cor e no formato que o usuário escolher.
//
// É barato porque não há isolamento de CSS a vencer (F14): uma extensão
// desenha no mesmo DOM que o programa. Dois atributos no `<body>`, quatro
// regras em `extensoes-do-programa.css`, e acabou.
//
// ⚠️ **Quem põe `data-origem="extensao"` é o PROGRAMA, nunca a extensão.** Se
// a marca dependesse da extensão, a que esquecesse ficaria invisível
// justamente para quem ligou o destaque para achá-la.
//
// Onde ela é posta hoje, e por quem:
//
//   | O que aparece na tela            | Quem marca                          |
//   |----------------------------------|-------------------------------------|
//   | o `<div>` de um ponto 'painel'   | `extensoes/encaixes.js`             |
//   | um ITEM de menu de contexto      | `menu-contexto.js`, pelo `_xtDe`    |
//   | uma linha da barra de Acesso rápido | `acesso-rapido.js`, pelo `slug`  |
//   | o popup do autocomplete          | `editor-autocomplete.js`            |
//   | o tema e o preset de modelo      | `config-tema.js`, `config-template.js`|
//
// ⚠️ **A página de cada extensão em Configurações › Extensões NÃO é marcada**
// (mudado em 06/09/2026; até então a seção inteira era). Ela é desenhada pelo
// PROGRAMA, num lado do trilho que já se chama "Extensões": a pergunta que o
// destaque responde — "o que aqui não é do programa?" — já está respondida
// pelo lugar, e a moldura em volta da página toda só sujava a tela. O
// destaque é para o que uma extensão põe NO MEIO de uma tela do programa.
//
// ⚠️ **O item de menu entrou tarde, e a falta dele era o buraco visível.** Num
// ponto 'painel' há um `<div>` do programa para marcar; num ponto 'itens' não
// há elemento nenhum — a extensão devolve dados e quem desenha é o componente.
// Enquanto ninguém marcava ali, ligar o destaque não acendia NADA de uma
// extensão que só acrescenta item de menu, que é o caso da maioria delas.
//
// ⚠️ **Duas coisas continuam fora, e não por esquecimento.** A marca do
// `editor.decorador` não pode receber contorno nem barra: ela vive dentro do
// `<pre>` do Editor, que é o espelho caractere a caractere do `<textarea>`, e
// qualquer coisa que mude a métrica desalinha o cursor (Padrões de interface ›
// Comportamentos › Decorar o código do Editor). E o que vem dos tipos de dado
// (tema, ícones, gramáticas) não é marcável por seletor: o efeito deles É a
// aparência da tela inteira, não um pedaço dela.

// O rótulo de cada opção, em português. ⚠️ Só o RÓTULO mora aqui: a lista de
// quais existem vem do backend (`xtDestaque.cores` / `.tipos`), e é ela que
// manda. Uma cor nova lá aparece aqui mesmo sem rótulo — com o nome cru, que é
// feio mas visível, e não sumindo em silêncio.
const XT_DESTAQUE_ROTULO_COR = {
  purple: 'Roxo', blue: 'Azul', green: 'Verde',
  amber: 'Âmbar', red: 'Vermelho', teal: 'Turquesa',
};

const XT_DESTAQUE_ROTULO_TIPO = {
  tracejado: 'Contorno tracejado',
  solido: 'Contorno sólido',
  fundo: 'Só o fundo',
  barra: 'Barra na lateral',
};

/**
 * Põe (ou tira) os dois atributos que o CSS lê.
 *
 * ⚠️ O TIPO vai como VALOR do atributo (`data-xt-destaque="barra"`), e não
 * como uma classe: assim `body[data-xt-destaque]` continua significando
 * "ligado" para quem só quer saber disso, e cada formato ganha o próprio
 * seletor sem uma classe a mais para limpar.
 *
 * A COR vai numa variável CSS com o nome do TOKEN, nunca com o valor dele:
 * `--xt-destaque-rgb: var(--purple-rgb)`. O valor real sai do tema em
 * execução, então trocar de tema repinta o destaque junto — um `rgb()`
 * resolvido aqui ficaria com a cor do tema anterior.
 */
function xtAplicarDestaque() {
  const corpo = document.body;
  // ⚠️ Cor e formato conferidos contra as listas que o backend mandou. O
  // backend já cai no padrão ao LER o arquivo, mas um valor que chegue aqui
  // fora da lista viraria `rgba(, 0.06)` — regra descartada pelo parser — ou
  // um `data-xt-destaque` que nenhum seletor casa: destaque "ligado" e
  // invisível, sem erro em lugar nenhum.
  const cores = xtDestaque.cores || [];
  const tipos = xtDestaque.tipos || [];
  const cor = cores.includes(xtDestaque.cor) ? xtDestaque.cor : (cores[0] || XT_DESTAQUE_VAZIO.cor);
  const tipo = tipos.includes(xtDestaque.tipo) ? xtDestaque.tipo : (tipos[0] || XT_DESTAQUE_VAZIO.tipo);
  corpo.style.setProperty('--xt-destaque-rgb', `var(--${cor}-rgb)`);
  if (xtDestaque.destacar) corpo.setAttribute('data-xt-destaque', tipo);
  else corpo.removeAttribute('data-xt-destaque');
}

/**
 * Grava no clique, sem barra de Salvar — mesma regra do Interruptor.
 *
 * Recebe um PATCH (`{destacar}`, `{cor}` ou `{tipo}`), e não os três: os três
 * mudam em momentos diferentes, e mandar os três a cada mudança faria esta
 * tela ter de conhecer os outros dois.
 *
 * ⚠️ NÃO passa por `xtAdotarArvore`. O destaque é cor e formato no `<body>`;
 * nada ligou nem desligou. Adotar a árvore inteira aqui custava cinco idas à
 * ponte e uma repintura do Quadro (que redesenha todos os cartões e religa o
 * arraste de cada um) para trocar a cor de um contorno — e, pior, reescrevia
 * o painel de configuração das extensões, apagando o que o usuário estava
 * digitando nele. Só o destaque e a lista desta categoria repintam.
 */
async function xtSalvarDestaque(patch) {
  try {
    const r = await window.pywebview.api.save_extensoes_programa_destaque(patch);
    if (!r || !r.success) {
      showToast((r && r.error) || 'Não foi possível gravar o destaque.', true);
      return;
    }
    xtDestaque = r.destaque || XT_DESTAQUE_VAZIO;
    xtAplicarDestaque();
    if (typeof _xtPintarDestaque === 'function') _xtPintarDestaque();
  } catch (e) {
    showToast('Não foi possível gravar o destaque.', true);
    console.error('[extensoes] falha ao gravar o destaque:', e);
  }
}
