/* ── Sub-abas Configuração e Ferramentas (Chat e Fila) ─────────────────────
 *
 * As duas sub-abas novas são as MESMAS nas duas telas, então o markup e a
 * fiação moram aqui, uma vez só. O que difere é o escopo: a Fila tem o
 * Verificador, que não existe no Chat — por isso a tabela de Ferramentas é
 * pedida ao backend com 'chat' ou 'fila', e não copiada de uma tela para a
 * outra.
 *
 * A aba Ferramentas é SÓ LEITURA e a tabela dela é GERADA DO CÓDIGO
 * (`catalogo_ferramentas` no backend). Digitá-la à mão seria criar um segundo
 * lugar para a verdade, que envelhece no primeiro dia em que alguém mexe em
 * FERRAMENTAS_POR_SUBAGENTE.
 *
 * Sem coluna de custo: custo varia com projeto e com modelo, e número que
 * envelhece numa tela informativa é pior que número nenhum.
 */

// Os cinco campos que viviam aqui — subagentes em paralelo, rodadas de
// ferramentas, ferramentas por rodada, teto do ler_arquivo e teto de uma parte —
// FORAM EMBORA para Configurações › "Ferramentas dos subagentes". Eles valiam
// para o programa inteiro e apareciam repetidos em duas telas (Chat e Fila),
// então mexer num deles pela aba do Chat mudava, sem dizer, o comportamento da
// Fila e das Rotinas.
//
// Com eles foi embora o bug que revertia configuração em silêncio: esta tela
// gravava com `save_settings`, relendo do disco e mandando o dicionário
// inteiro, mas NÃO atualizava o `appSettings` em memória. `config-tema.js` e
// o antigo `config-icones.js` gravavam `{...appSettings, campo}` — então a sequência
// "mudar subagentes em paralelo aqui → trocar o tema" regravava o `appSettings`
// velho por cima e desfazia a primeira mudança. Quem grava agora é
// `config-ferramentas.js`, por `save_settings_parcial`, atualizando as duas
// coisas juntas.
//
// O que sobrou nesta sub-aba é o que é DA TELA: no Chat, as rodadas de
// subagente por mensagem; na Fila, as rodadas por tarefa e as devoluções do
// Verificador.

function subagentesConfigMarkup(prefixo) {
  return `
      <div class="subagentes-config-grupo">
        <p class="subagentes-config-nota">
          Os tetos de contexto de cada ferramenta — quanto o <code>grep</code> abre,
          quanto o <code>ler_arquivo</code> devolve, quantos subagentes rodam ao mesmo
          tempo — moram em <strong>Configurações › Ferramentas dos subagentes</strong>.
          Eles valem para o programa inteiro, e não para esta tela.
        </p>
      </div>`;
}

function subagentesFerramentasMarkup(prefixo) {
  return `
      <div class="ferramentas-cabecalho">
        <input type="text" id="${prefixo}-ferr-filtro" class="ferramentas-filtro"
               placeholder="Filtrar por subagente ou ferramenta…" />
        <span class="ferramentas-chip" id="${prefixo}-ferr-contagem"></span>
        <span class="ferramentas-chip">gerado do código</span>
      </div>
      <p class="ferramentas-tetos" id="${prefixo}-ferr-tetos"></p>
      <div class="ferramentas-tabela-wrap">
        <table class="ferramentas-tabela">
          <thead>
            <tr>
              <th class="col-subagente">Subagente</th>
              <th class="col-ferramenta">Ferramenta</th>
              <th class="col-devolve">O que devolve</th>
              <th>Se errar</th>
            </tr>
          </thead>
          <tbody id="${prefixo}-ferr-corpo"></tbody>
        </table>
      </div>`;
}

/* O nome, o emoji e a descrição de cada subagente vêm das definições que a
 * sub-aba Subagentes já usa — `AGENTES_DEFINICOES` no Chat e
 * `FILA_AGENTES_PROPRIOS` na Fila. Repetir aqui seria um segundo lugar para o
 * mesmo nome divergir, e é exatamente o que a base de terminologia proíbe.
 * A cor é o token `--sub-{id}` de `base.css`, o mesmo dos cards e do Log. */
function _ferrIdentidade(id) {
  const fontes = []
    .concat(typeof AGENTES_DEFINICOES !== 'undefined' ? AGENTES_DEFINICOES : [])
    .concat(typeof FILA_AGENTES_PROPRIOS !== 'undefined' ? FILA_AGENTES_PROPRIOS : []);
  const def = fontes.find(a => a.id === id);
  // Só a PRIMEIRA frase da descrição: a do card é escrita para ser lida com
  // calma, e aqui ela mora numa célula estreita ao lado de três colunas de
  // texto. Cortar aqui evita reescrever o mesmo texto num segundo lugar.
  const inteira = (def && def.descricao) || '';
  const ponto = inteira.indexOf('. ');
  return {
    icone: (def && def.icone) || '🤖',
    nome: (def && def.nome) || id,
    descricao: ponto > 0 ? inteira.slice(0, ponto + 1) : inteira,
  };
}

/* A leitura e a gravação da configuração global saíram daqui junto com os
 * campos. Quem faz isso agora é `config-ferramentas.js`. `wireSubagentesConfigGlobal`
 * continua existindo, sem corpo, porque as duas telas a chamam ao montar — e um
 * `undefined is not a function` no meio da montagem da aba derruba o resto dela. */
function wireSubagentesConfigGlobal(prefixo) { /* nada a ligar: ver acima */ }

/* ── Tabela de ferramentas ────────────────────────────────────────────────── */
let _ferramentasCache = {};

// Chamada por quem grava os tetos (config-ferramentas.js): a tabela é
// "gerada na hora de abrir" (navegacao.js, fila.js), e o cache não pode
// segurar o número velho depois de um Salvar.
function esquecerCatalogoDeFerramentas() { _ferramentasCache = {}; }

async function renderSubagentesFerramentas(prefixo, escopo) {
  const corpo = document.getElementById(`${prefixo}-ferr-corpo`);
  if (!corpo) return;
  let dados = _ferramentasCache[escopo];
  if (!dados) {
    try {
      dados = await window.pywebview.api.catalogo_ferramentas(escopo);
      _ferramentasCache[escopo] = dados;
    } catch (e) { return; }
  }
  const tetos = dados.tetos || {};
  const elTetos = document.getElementById(`${prefixo}-ferr-tetos`);
  if (elTetos) {
    // ⚠️ A frase valia para todas as linhas da tabela, e não vale: o Verificador
    // roda com um teto próprio (`max_rodadas_ferramentas_verificador`). Na Fila
    // a tabela tem a linha dele, e ela dizia 3 onde o programa usa 5.
    const teroVerificador = tetos.rodadas_ferramentas_verificador;
    const excecao = (escopo === 'fila' && teroVerificador
                     && teroVerificador !== tetos.rodadas_ferramentas)
      ? ` O Verificador é a exceção: ele roda com ${teroVerificador} rodadas.`
      : '';
    elTetos.textContent =
      `Até ${tetos.ferramentas_rodada} ferramentas por rodada × ${tetos.rodadas_ferramentas} ` +
      `rodadas por chamada. Toda leitura de arquivo corta em ${tetos.teto_ler_arquivo} tokens; ` +
      `uma parte, em ${tetos.teto_parte}.` + excecao;
  }

  const filtroEl = document.getElementById(`${prefixo}-ferr-filtro`);
  const filtro = (filtroEl ? filtroEl.value : '').trim().toLowerCase();
  const linhas = (dados.linhas || []).filter(l => {
    if (!filtro) return true;
    return l.ferramenta.includes(filtro)
        || _ferrIdentidade(l.subagente).nome.toLowerCase().includes(filtro);
  });

  const elContagem = document.getElementById(`${prefixo}-ferr-contagem`);
  if (elContagem) {
    const subs = new Set(linhas.map(l => l.subagente)).size;
    const ferrs = new Set(linhas.map(l => l.ferramenta)).size;
    elContagem.textContent = `${subs} subagentes · ${ferrs} ferramentas`;
  }

  // Uma linha por ferramenta, mas o subagente ocupa uma célula só, com rowspan
  // — é o que impede a coluna da esquerda de virar uma lista de nomes repetidos.
  // A descrição dele mora nessa célula justamente porque o rowspan abre a altura.
  const html = [];
  (dados.grupos || [{ id: null, titulo: '' }]).forEach(grupo => {
    const doGrupo = linhas.filter(l => !grupo.id || l.grupo === grupo.id);
    if (!doGrupo.length) return;
    if (grupo.titulo) {
      html.push(`<tr class="ferr-grupo"><td colspan="4">${grupo.titulo}</td></tr>`);
    }
    let atual = null;
    doGrupo.forEach(l => {
      const primeira = l.subagente !== atual;
      atual = l.subagente;
      const celula = primeira
        ? (() => {
            const quantas = doGrupo.filter(x => x.subagente === l.subagente).length;
            const { icone, nome, descricao } = _ferrIdentidade(l.subagente);
            return `<td class="ferr-ag" rowspan="${quantas}"
                        style="--ferr-cor: ${agenteCorVar(l.subagente)}">
                      <span class="ferr-ag-nome">${icone} ${nome}</span>
                      <span class="ferr-ag-desc">${descricao}</span>
                    </td>`;
          })()
        : '';
      html.push(`<tr>${celula}
        <td><code>${l.ferramenta}</code></td>
        <td>${l.devolve}</td>
        <td class="ferr-erro">${l.se_errar}</td>
      </tr>`);
    });
  });
  corpo.innerHTML = html.join('') ||
    '<tr><td colspan="4" class="ferr-vazio">Nada casa esse filtro.</td></tr>';
}

function wireSubagentesFerramentas(prefixo, escopo) {
  const filtroEl = document.getElementById(`${prefixo}-ferr-filtro`);
  if (filtroEl) filtroEl.addEventListener('input', () => renderSubagentesFerramentas(prefixo, escopo));
}

/* ── Trava de cinco pontas ────────────────────────────────────────────────
   `atualizarTravaIA` e companhia moram em `modulos/trava-ia.js`: eram quatro
   telas de duas abas de cima diferentes chamando o que estava aqui dentro, e
   nada disso é configuração de subagente. */
