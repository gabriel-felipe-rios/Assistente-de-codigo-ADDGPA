// ═════════════════════════ EXTENSÕES DO PROGRAMA — DESCARREGAR ══
// Desfaz, na tela, o que uma extensão fez ao ligar.
//
// ⚠️ **Isto não existe no sistema de Plugins**, e com D18 (sem sandbox) é a
// ÚNICA rede que vai existir. O `<style>` que um plugin injeta no
// `document.head` nunca é removido — o Plugin base põe `<style id="pb-estilo">`
// e só evita duplicar. Aqui, desligar tem de devolver a tela ao que era.
//
// O que o PROGRAMA remove:
//   - todo `<style>` e `<link>` com `data-xt="{slug}"`;
//   - o `<script id="xt-script-{slug}">`;
//   - as duas funções globais (`xtMontar_{slug}`, `xtDesmontar_{slug}`).
//
// ⚠️ A página NÃO sai — desde a D47 (23/09/2026) a desligada continua com
// página no lado Extensões de Configurações; quem tira é `xtSincronizarTelas`,
// quando a pasta some do disco.
//
// O que é da EXTENSÃO desfazer, dentro de `window.xtDesmontar_{slug}`:
// qualquer outro global que ela criou, listener no `document`, `setInterval`,
// `MutationObserver`. O programa não tem como adivinhar esses.
//
// ⚠️ É por isso que o contrato exige `data-xt="{slug}"` em todo `<style>` da
// extensão: é por esse atributo, e só por ele, que o programa acha o que
// remover.
//
// ⚠️ **Nada é APAGADO do disco** (D22). Descarregar é da tela; a pasta da
// extensão, o `files/` que ela gerou e o `config/` dela continuam inteiros.

async function xtDescarregarFrontend(slug) {
  // ⚠️ OS REGISTROS SAEM PRIMEIRO, ANTES DO `xtDesmontar`. Encaixes,
  // assinaturas e consultas são o programa CHAMANDO a extensão; o
  // `xtDesmontar` é a extensão apagando as próprias globais. Na ordem
  // inversa havia uma janela — entre o `delete window.pfxFuncao` do
  // `xtDesmontar` e o `xtDesregistrarEncaixes` — em que uma pintura do
  // Editor, um Ctrl+S ou um `projeto.abriu` ainda chamavam o arquivo de
  // encaixe da extensão, e ele tropeçava numa global que já não existia
  // (`TypeError: window.pfxFuncao is not a function`). Onze pontos das
  // extensões que vêm com o programa caíam nessa janela. Tirando do registro
  // antes, o programa para de chamar a extensão ANTES de ela se desmontar.
  //
  // ⚠️ AS MARCAS DO DECORADOR SAEM ANTES DE O REGISTRO SAIR. Uma vez fora de
  // `_xtEncaixes`, ninguém mais sabe quais `<span>` do `<pre>` eram desta
  // extensão a não ser pelo `data-xt` — e é justamente por ele que o
  // desembrulho os acha. E é DESEMBRULHO, nunca `.remove()`: o `<span>` da
  // marca envolve texto do código (ver `extensoes/decorador.js`).
  //
  // Todas por `typeof`: a ordem fica escrita mesmo onde o mecanismo não
  // carregou.
  const respondia = typeof xtSlugResponde === 'function' && xtSlugResponde(slug);
  if (typeof xtDesdecorarTudo === 'function') xtDesdecorarTudo(slug);
  if (typeof xtDesregistrarEncaixes === 'function') xtDesregistrarEncaixes(slug);
  // O recurso Tela: aqui só o REGISTRO sai (o programa para de chamar a
  // extensão); o botão e o painel saem lá embaixo, DEPOIS do `xtDesmontar` —
  // a extensão pode precisar do painel dela de pé para desfazer o que pôs
  // dentro dele. Ver `extensoes/telas.js::xtDesregistrarTelas`.
  if (typeof xtDesregistrarTelas === 'function') xtDesregistrarTelas(slug);
  if (typeof xtDesregistrarAssinantes === 'function') xtDesregistrarAssinantes(slug);
  if (typeof xtDesregistrarConsultas === 'function') xtDesregistrarConsultas(slug);
  // ⚠️ AQUI, no bloco de cima, e NÃO lá no fim, depois do `xtDesmontar`.
  // Um comando que ficasse na barra depois de a extensão ser desligada seria um
  // item que, ao ser clicado, chama uma função que já não existe — e o sintoma
  // não aparece em nenhum teste de "liga e funciona".
  if (typeof xtDesregistrarComandos === 'function') xtDesregistrarComandos(slug);
  // Uma extensão de tipo 27 saindo precisa fechar o popup que pode estar
  // aberto AGORA — senão ele fica na tela até o próximo clique, com
  // sugestões de uma extensão que já não existe. Só quem respondia: desligar
  // uma extensão de tema não tem por que fechar o autocomplete de outra.
  if (respondia && typeof edAutocompleteFechar === 'function') edAutocompleteFechar();
  // O balão da dica, pelo mesmo motivo (fase 12).
  if (respondia && typeof edDicaFechar === 'function') edDicaFechar();

  // O `xtDesmontar` da extensão vem com o mundo dela ainda de pé: ela pode
  // precisar do próprio `<style>` ou do próprio módulo para desfazer o que
  // fez.
  const desmontar = window[`xtDesmontar_${slug}`];
  if (typeof desmontar === 'function') {
    try {
      await desmontar();
    } catch (e) {
      console.error(`[extensoes] xtDesmontar_${slug} falhou:`, e);
    }
  }

  // ⚠️ `script` entrou junto na Obra 2: os arquivos de encaixe são injetados
  // um por tag, todas com `data-xt`. O <script id="xt-script-{slug}"> do
  // `index.js` NÃO tem esse atributo e sai logo abaixo, pelo id — são duas
  // baixas diferentes de propósito, porque só uma delas é plural.
  document.querySelectorAll(
    `style[data-xt="${slug}"], link[data-xt="${slug}"], script[data-xt="${slug}"]`)
          .forEach(el => el.remove());

  const script = document.getElementById(`xt-script-${slug}`);
  if (script) script.remove();

  // Remover a tag não desfaz o que o script já executou: as duas globais
  // continuariam de pé, e um religar acharia a função VELHA antes de o
  // script novo terminar de carregar.
  delete window[`xtMontar_${slug}`];
  delete window[`xtDesmontar_${slug}`];

  // As telas do recurso Tela (aba nova, sub-aba) — o DOM, agora que o
  // `xtDesmontar` já rodou. Não confundir com a PÁGINA da extensão em
  // Configurações: essa fica (D47 — ver o topo).
  if (typeof xtRemoverTelasDoDom === 'function') xtRemoverTelasDoDom(slug);

  _xtMontadas.delete(slug);
}
