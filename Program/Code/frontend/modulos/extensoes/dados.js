// ═════════════════════════ EXTENSÕES DO PROGRAMA — A ENTREGA DE CONTEÚDO ══
// O conteúdo que não precisa de código nenhum: Visual › ícones e Recursos do
// Editor › cor (as gramáticas). A extensão declara o item em `acrescenta`, e
// pronto. ⚠️ Por dentro eles ainda chegam com a chave de antes — '24' e '11'
// —, que é o que `xtDadosDoTipo` filtra até a fase 13 trocá-la. Tema, preset
// de modelo e preset de Acervo SAÍRAM (P9, D37): o programa já os configura.
//
// ⚠️ **A extensão NUNCA substitui o embutido.** Cada consumidor LISTA o que as
// extensões ligadas trazem AO LADO do que o programa já tem, e quem escolhe é
// o usuário. Ligar uma extensão de ícones não troca os ícones sozinha — ela
// só passa a aparecer como opção no "Pacote em uso" da página da Ícones de
// arquivo (fase 13).
//
// ⚠️ O tipo 24 (ícones) é o caso em que "o embutido" deixou de ser um pacote.
// Em 04/09/2026 o Material Icon Theme saiu de `Code/assets/icons/` e virou a
// extensão **Ícones de arquivo**; o primeiro item da lista passou a ser
// "Nenhum (emoji)". A regra não mudou — o que mudou é que o programa não tem
// mais pacote próprio para ser substituído. Ver `icones.js`.
//
// Este arquivo é a ponta comum: guarda a lista e aplica o que estiver
// escolhido. Quem desenha a opção na tela é cada categoria consumidora.

let xtDados = [];

// Recursos do Editor › trechos prontos (fase 12): `[{prefixo, descricao, corpo,
// linguagens}]`, achatado de todas as extensões ligadas a cada sincronização —
// o autocomplete pergunta por ele A CADA TECLA, e por isso a pergunta
// "há algum?" é um `length`, e não um filtro sobre `xtDados`.
let _xtTrechos = [];

/** Há trecho pronto de alguma extensão ligada? — a primeira pergunta do
 *  autocomplete, junto de `xtAlguemResponde`. */
// eslint-disable-next-line no-unused-vars
function xtHaTrechos() { return _xtTrechos.length > 0; }

/** Os trechos que valem para uma linguagem do Editor (`arq.linguagem`), de
 *  todas as extensões ligadas — os de várias se SOMAM (fase 12). */
// eslint-disable-next-line no-unused-vars
function xtTrechosDaLinguagem(linguagem) {
  return _xtTrechos.filter(t => t.linguagens.includes('*') || t.linguagens.includes(linguagem));
}

/** O que as extensões ligadas trazem de um tipo — `[]` é o normal. */
function xtDadosDoTipo(tipo) {
  return xtDados.filter(d => d.tipo === String(tipo) && !d.erro);
}

/** A entrada de um tipo cujo `caminho` bate — `null` se a extensão foi
 *  desligada ou apagada desde que a escolha foi gravada.
 *
 *  ⚠️ Casa também pelo NOME DA PASTA (o último segmento do caminho). A
 *  escolha gravada é o caminho relativo, e ele muda quando o usuário arrasta a
 *  extensão para dentro de uma categoria: `pacote_de_icones` continuava
 *  "Ícones de arquivo" enquanto a extensão virava "Meus/Ícones de arquivo",
 *  e todos os ícones do programa viravam emoji sem aviso. O caminho inteiro
 *  vence quando bate; o nome da pasta é a volta. */
function xtDadoEscolhido(tipo, caminho) {
  if (!caminho) return null;
  const doTipo = xtDadosDoTipo(tipo);
  const nomeDaPasta = String(caminho).split('/').pop();
  return doTipo.find(d => d.caminho === caminho)
      || doTipo.find(d => String(d.caminho).split('/').pop() === nomeDaPasta)
      || null;
}

/**
 * Relê o que as extensões trazem e reaplica o que estiver escolhido.
 *
 * Chamada de `xtAdotarArvore`, ou seja, a cada ligar/desligar: uma extensão
 * de ícones que acabou de ser desligada precisa devolver o que estava antes
 * na hora, e não na próxima abertura do programa.
 */
async function xtSincronizarDados() {
  try {
    const r = await window.pywebview.api.list_dados_de_extensoes();
    xtDados = (r && r.success) ? (r.dados || []) : [];
  } catch (e) {
    console.error('[extensoes] falha ao listar os dados:', e);
    xtDados = [];
  }

  // Um erro de leitura não pode sumir com a opção: o usuário precisa saber
  // que a extensão está ligada e o arquivo dela está quebrado.
  xtDados.filter(d => d.erro)
         .forEach(d => console.warn(`[extensoes] "${d.nome}": ${d.erro}`));
  xtDados.filter(d => d.aviso)
         .forEach(d => console.warn(`[extensoes] "${d.nome}": ${d.aviso}`));

  _xtTrechos = [];
  xtDados.filter(d => d.parte === 'trechos' && !d.erro && Array.isArray(d.dados)).forEach((d) => {
    const linguagens = (d.linguagens && d.linguagens.length) ? d.linguagens : ['*'];
    d.dados.forEach(t => _xtTrechos.push({ ...t, linguagens, extensao: d.nome }));
  });

  if (typeof xtAplicarIconesEscolhidos === 'function') xtAplicarIconesEscolhidos();
  // Recursos do Editor › cor: as gramáticas do Prism. Diferente dos outros, este consumidor não
  // tem tela — não há o que escolher, a primeira extensão ligada vale.
  if (typeof xtAplicarGramaticasEscolhidas === 'function') xtAplicarGramaticasEscolhidas();
  // Os campos com `opcoes_de` (o "Pacote em uso" dos ícones) repintam as
  // opções: a página foi registrada ANTES de esta lista chegar.
  if (typeof xtRepintarOpcoesDe === 'function') xtRepintarOpcoesDe();
}
