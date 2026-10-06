// ══ CONFIGURAÇÕES → Preparar projeto: a biblioteca e a busca ═══════════════
//
// "O que este início rápido copia da biblioteca": a lista por categoria, a
// árvore de grupos, as contagens e o campo de busca que filtra tudo isso.
//
// ⚠️ O QUE O PRESET GUARDA É `name`, O CAMINHO INTEIRO — nunca o rótulo. Dois
// itens de mesmo nome em grupos diferentes (`Front design/Mobile` e
// `Backend/Mobile`) são dois itens distintos, e guardar só a folha faria o
// segundo marcado desmarcar o primeiro. O rótulo e o grupo vêm prontos do
// backend só para a tela desenhar a árvore, e não são identidade.
//
// ⚠️ ÓRFÃO NÃO DERRUBA O PRESET. Item renomeado ou apagado da biblioteca some
// da seleção sem invalidar nada — tirar o preset inteiro do ar por causa de uma
// pasta que o próprio usuário renomeou seria pior que o aviso. Quem avisa é
// `_cprOrfaos`, aqui na tela.
//
// ⚠️ A MARCA `Do programa` NÃO FILTRA MAIS NADA AQUI. Ela ficou como PISTA
// visual, e só existe nas quatro categorias que a têm; nas outras duas vem
// `null`, e a fileira Favoritos/Gerais não é desenhada.
// ── "O que este início rápido copia da biblioteca" ──────────────────────────
// A lista de nomes que o início rápido guarda, por categoria. Nasce vazia e é
// criada na hora: um início rápido novo tem as seis chaves, mas um vindo de
// fora pode não ter — e marcar o primeiro item não pode explodir por isso.
function _cprMarcados(preset, kind) {
  preset.itens = preset.itens || {};
  if (!Array.isArray(preset.itens[kind])) preset.itens[kind] = [];
  return preset.itens[kind];
}

// Nomes que o início rápido guarda mas que não existem mais na biblioteca — a
// pasta foi renomeada ou apagada depois. O backend ignora esses nomes na hora de
// copiar (é uma interseção); o que não pode é isso acontecer em silêncio.
function _cprOrfaos(preset, kind) {
  const existem = new Set((_cprBiblioteca[kind] || []).map(i => i.name));
  return _cprMarcados(preset, kind).filter(n => !existem.has(n));
}

// Os itens de uma categoria numa das duas origens. `'programa'` é o valor
// escrito no metadado; tudo que não é ele conta como geral — o mesmo critério
// de `_arqRenderList` em `arquivos.js`, e por isso a mesma divisão.
//
// ⚠️ Categoria SEM marca de origem devolve tudo (D11): `instrucoes-base` e
// `agentes` entraram na seleção sem entrar na marca, e filtrá-las por uma
// origem que elas não têm deixaria as duas sempre vazias.
function _cprItensDaOrigem(kind, origem) {
  const itens = _cprBiblioteca[kind] || [];
  if (!_cprTipo(kind).tem_origem) return itens;
  // Os fixos saem das outras duas antes de qualquer coisa: sem esta linha eles
  // apareceriam DUAS vezes, aqui e em "Favoritos".
  if (origem === 'fixos') return itens.filter(i => _cprEhFixo(kind, i));
  return itens.filter(i => !_cprEhFixo(kind, i)
    && (i.origem === 'programa') === (origem === 'programa'));
}

// As origens que ESTA categoria tem. Só `mcps` tem a terceira.
function _cprOrigensDe(kind) {
  return kind === 'mcps' ? ['programa', 'geral', 'fixos'] : ['programa', 'geral'];
}

// Quantos itens daquele conjunto o início rápido marcou. Conta só o que EXISTE:
// órfão marcado não é item que vai ser copiado, e "5/4" seria a pior forma
// possível de contar isso.
function _cprContar(preset, kind, itens) {
  const marcados = _cprMarcados(preset, kind);
  return itens.filter(i => marcados.includes(i.name)).length;
}

// As DUAS barras de aba, e só elas. Separadas do corpo porque marcar uma caixa
// muda as contagens mas NÃO muda a lista aberta — e repintar a lista embaixo do
// clique tiraria o foco da caixa que o usuário acabou de marcar.
function _cprPintarContagens() {
  const preset = _cprPreset();
  const abas = document.getElementById('cpr-bib-abas');
  const barra = document.getElementById('cpr-bib-barra');
  if (!preset || !abas || !barra) return;

  // Nível 1 — a categoria. A contagem fica na aba, e não só na lista aberta: o
  // cartão mostra UMA categoria por vez, e sem ela não dá para saber que sobrou
  // coisa marcada numa aba fechada — que é o que o Preparar vai copiar.
  abas.innerHTML = _cprTipos.map(({ kind, rotulo }) => {
    const biblioteca = _cprBiblioteca[kind] || [];
    const n = _cprContar(preset, kind, biblioteca);
    return `
      <button type="button" class="cpr-bib-aba${kind === _cprTipoAberto ? ' active' : ''}"
              data-cpr-tipo="${kind}">${escapeHtml(rotulo)}
        <span class="cpr-bib-cnt${n ? ' on' : ''}">${n}/${biblioteca.length}</span>
      </button>`;
  }).join('');

  // Nível 2 — a origem, mais os dois botões. Categoria vazia não ganha barra:
  // não há origem para escolher nem nada para marcar.
  const kind = _cprTipoAberto;
  const tipo = _cprTipo(kind);
  if (!(_cprBiblioteca[kind] || []).length) { barra.innerHTML = ''; return; }

  // ⚠️ A fileira de origem só existe nas quatro categorias que TÊM a marca
  // (D11) — e em `mcps` ela tem três abas, não duas. Nas outras duas sobram só
  // os dois botões — e em `instrucoes-base`
  // nem eles: "Marcar todos" numa escolha única não quer dizer nada.
  const abasOrigem = tipo.tem_origem ? `
    <div class="arq-inner-tabs">
      ${_cprOrigensDe(kind).map(origem => {
        const itens = _cprItensDaOrigem(kind, origem);
        return `
      <button type="button" class="arq-inner-tab${origem === _cprOrigemAberta ? ' active' : ''}"
              data-cpr-origem="${origem}">${CPR_ORIGENS[origem]}
        <span class="arq-inner-cnt">${_cprContar(preset, kind, itens)}/${itens.length}</span>
      </button>`;
      }).join('')}
    </div>` : '<div></div>';

  const acoes = tipo.escolha_unica ? '' : `
    <div class="cpr-bib-acoes">
      <button type="button" class="btn btn-muted btn-sm" data-cpr-todos="1">Marcar todos</button>
      <button type="button" class="btn btn-muted btn-sm" data-cpr-nenhum="1">Limpar</button>
    </div>`;
  barra.innerHTML = abasOrigem + acoes;
}

// Agrupa os itens visíveis pelo campo `grupo` que o backend manda, preservando a
// ordem da biblioteca. Item sem grupo vem primeiro, solto.
function _cprAgrupar(itens) {
  const soltos = [];
  const grupos = new Map();
  for (const it of itens) {
    if (!it.grupo) { soltos.push(it); continue; }
    if (!grupos.has(it.grupo)) grupos.set(it.grupo, []);
    grupos.get(it.grupo).push(it);
  }
  return { soltos, grupos };
}

function _cprPintarBiblioteca() {
  const corpo = document.getElementById('cpr-bib');
  const preset = _cprPreset();
  if (!corpo || !preset) return;
  // ⚠️ ANTES de qualquer leitura da origem aberta: "Do programa" só existe em
  // `mcps`, e sair dessa categoria com ela aberta listaria zero item numa aba
  // que a fileira nem desenhou.
  if (!_cprOrigensDe(_cprTipoAberto).includes(_cprOrigemAberta)) _cprOrigemAberta = 'programa';
  _cprPintarContagens();
  _cprPintarBusca();

  const kind = _cprTipoAberto;
  const tipo = _cprTipo(kind);
  const marcados = _cprMarcados(preset, kind);
  const orfaos = _cprOrfaos(preset, kind);

  let lista;
  if (!(_cprBiblioteca[kind] || []).length) {
    lista = `<p class="config-nota">Esta categoria está vazia na biblioteca — não há nada
             para marcar. Adicione itens na aba <b>Arquivos</b>.</p>`;
  } else {
    const itens = _cprItensDaOrigem(kind, _cprOrigemAberta);
    if (!itens.length) {
      lista = `<p class="config-nota">Nenhum item em
                 <b>${escapeHtml(CPR_ORIGENS[_cprOrigemAberta] || _cprOrigemAberta)}</b>
                 nesta categoria.</p>`;
    } else {
      // ⚠️ `radio` em `instrucoes-base`, e `checkbox` no resto — decidido pelo
      // campo `escolha_unica` que o backend manda, NUNCA por um `if` no nome da
      // categoria. O motivo é físico: o destino de Instruções base é a raiz do
      // projeto, e dois itens marcados copiariam para o mesmo caminho, o
      // segundo por cima do primeiro, sem uma linha de aviso.
      const tipoInput = tipo.escolha_unica ? 'radio' : 'checkbox';
      const grupoRadio = tipo.escolha_unica ? ` name="cpr-unico-${escapeHtml(kind)}"` : '';

      // ⛔ A LINHA DO GRUPO NÃO TEM CAIXA, e não é economia de tela: **grupo é
      // uma PASTA, não um item**. `Skills/Arquitetura modular/` não é uma skill
      // — é só a gaveta onde oito delas estão guardadas, e ela não existe no
      // destino: a cópia achata o agrupamento. Marcar a pasta prometia copiar
      // uma coisa que não é copiável, e marcar as oito de uma vez era um efeito
      // colateral que ninguém pediu ao clicar num nome de pasta.
      //
      // O grupo continua sendo uma linha: ele DOBRA, e mostra quantos dos
      // filhos estão marcados — que é a única coisa que ele tem a dizer quando
      // está fechado.
      const linhaItem = (it, dentroDeGrupo) => `
        <label class="config-check cpr-bib-item${dentroDeGrupo ? ' cpr-bib-item-filho' : ''}"
               data-cpr-linha="${escapeHtml(it.name)}"
               data-cpr-busca="${escapeHtml(_cprSemAcento(it.rotulo + ' ' + (it.grupo || '')))}">
          <input type="${tipoInput}"${grupoRadio} data-cpr-item="${escapeHtml(it.name)}"
                 data-cpr-tipo-item="${escapeHtml(kind)}"
                 ${marcados.includes(it.name) ? 'checked' : ''}>
          <span>${escapeHtml(it.rotulo || it.name)}</span>
          ${dentroDeGrupo ? `<span class="cpr-bib-de-grupo">${escapeHtml(it.grupo)}</span>` : ''}
        </label>`;

      const { soltos, grupos } = _cprAgrupar(itens);
      const partes = soltos.map(it => linhaItem(it, false));

      for (const [grupo, filhos] of grupos) {
        const marcadosNoGrupo = filhos.filter(f => marcados.includes(f.name)).length;
        const fechado = _cprGruposFechados.has(kind + '/' + grupo);
        partes.push(`
          <div class="cpr-bib-grupo" data-cpr-grupo-bloco="${escapeHtml(grupo)}">
            <div class="cpr-bib-grupo-l"
                 data-cpr-busca="${escapeHtml(_cprSemAcento(grupo))}">
              <button type="button" class="cpr-bib-dobra" data-cpr-dobra="${escapeHtml(grupo)}"
                      title="${fechado ? 'Abrir' : 'Retrair'}">${fechado ? '▸' : '▾'}</button>
              <span class="cpr-bib-grupo-nome">${escapeHtml(grupo)}</span>
              <span class="cpr-bib-cnt${marcadosNoGrupo ? ' on' : ''}">${marcadosNoGrupo}/${filhos.length}</span>
            </div>
            <div class="cpr-bib-filhos${fechado ? ' hidden' : ''}">
              ${filhos.map(it => linhaItem(it, true)).join('')}
            </div>
          </div>`);
      }
      lista = partes.join('');
    }
  }

  // O aviso de órfão é da CATEGORIA, e não de uma das origens: o item não existe
  // mais, então não tem origem para pertencer a uma aba ou à outra.
  const aviso = orfaos.length ? `
    <p class="config-nota config-nota-alerta">
      ⚠️ ${orfaos.length === 1 ? 'Este item está marcado mas não existe mais' : 'Estes itens estão marcados mas não existem mais'}
      na biblioteca: ${orfaos.map(n => `<b>${escapeHtml(n)}</b>`).join(', ')}.
      ${orfaos.length === 1 ? 'Ele é ignorado' : 'Eles são ignorados'} na hora de preparar.
      <button type="button" class="btn btn-muted btn-sm" data-cpr-limpar-orfaos="${escapeHtml(_cprTipoAberto)}">Tirar do início rápido</button>
    </p>` : '';

  corpo.innerHTML = `<div class="cpr-bib-lista">${lista}</div>`
    + `<p class="config-nota hidden" id="cpr-busca-aviso"></p>` + aviso;
  _cprFiltrar();
}

// A contagem de cada grupo, refeita a cada marca. ⚠️ Só o número muda — a
// lista NÃO é redesenhada, senão o clique perderia o foco da caixa que acabou
// de ser marcada.
//
// ⚠️ Não há estado `indeterminate` para reger: a linha de grupo não tem caixa.
// Quem diz que o grupo está pela metade é esta contagem.
function _cprPintarContagensDeGrupo() {
  const preset = _cprPreset();
  if (!preset) return;
  const marcados = _cprMarcados(preset, _cprTipoAberto);
  document.querySelectorAll('#cpr-bib [data-cpr-grupo-bloco]').forEach(bloco => {
    const filhos = [...bloco.querySelectorAll('[data-cpr-item]')];
    const n = filhos.filter(f => marcados.includes(f.dataset.cprItem)).length;
    const cnt = bloco.querySelector('.cpr-bib-cnt');
    if (!cnt) return;
    cnt.textContent = `${n}/${filhos.length}`;
    cnt.classList.toggle('on', n > 0);
  });
}

// ── A busca da biblioteca ───────────────────────────────────────────────────
// ⛔ REUSA `.bsa-*` de `estilos/busca-arvore.css`. O componente é ÚNICO no
// programa, e a regra existe porque *"igual garantido por cópia dura duas
// semanas"* — a quinta barra de busca copiada seria a que começaria a divergir.
function _cprPintarBusca() {
  const casa = document.getElementById('cpr-bib-busca');
  if (!casa) return;
  if (!(_cprBiblioteca[_cprTipoAberto] || []).length) { casa.innerHTML = ''; return; }
  // ⚠️ ESCOPADO. A aba escondida continua montada no DOM, e um
  // `querySelectorAll('.bsa-input')` sem escopo alcança as outras barras que já
  // existem no programa. O id próprio é o que mantém esta busca só aqui.
  if (!document.getElementById('cpr-bib-busca-input')) {
    casa.innerHTML = `
      <div class="bsa-barra">
        <div class="bsa-linha">
          <input type="text" class="bsa-input" id="cpr-bib-busca-input"
                 placeholder="filtrar por nome — ignora acento e acha dentro de grupo fechado">
        </div>
      </div>`;
  }
  const input = document.getElementById('cpr-bib-busca-input');
  if (input && input.value !== _cprBusca) input.value = _cprBusca;
}

// 🔴 FILTRAR É `display: none/''`, NUNCA REDESENHO. Convenção *"Filtrar não
// redesenha"*: redesenhar perderia a dobra dos grupos a cada tecla. É o mesmo
// que `filtrarArvorePorCaminho` (`arvore-pastas.js`) faz com a árvore de pastas.
//
// ⚠️ A BUSCA FURA O GRUPO: um item que casa aparece mesmo com o grupo retraído,
// e a etiqueta ao lado dele diz de que grupo é — senão o resultado apareceria
// sem contexto, e fechar a busca o faria "sumir" de novo.
function _cprFiltrar() {
  const corpo = document.getElementById('cpr-bib');
  if (!corpo) return;
  const alvo = _cprSemAcento(_cprBusca).trim();
  const linhas = corpo.querySelectorAll('[data-cpr-busca]');
  let visiveis = 0;

  linhas.forEach(l => {
    const casa = !alvo || (l.dataset.cprBusca || '').includes(alvo);
    l.classList.toggle('hidden', !casa);
    if (casa && l.hasAttribute('data-cpr-linha')) visiveis++;
  });

  corpo.querySelectorAll('[data-cpr-grupo-bloco]').forEach(bloco => {
    const filhos = bloco.querySelector('.cpr-bib-filhos');
    const cabecalho = bloco.querySelector('.cpr-bib-grupo-l');
    const algumFilho = [...bloco.querySelectorAll('[data-cpr-linha]')]
      .some(f => !f.classList.contains('hidden'));
    // Grupo sem nenhum filho visível some inteiro — a pasta é regida pelos
    // filhos, igual à árvore de pastas.
    bloco.classList.toggle('hidden', !!alvo && !algumFilho && cabecalho.classList.contains('hidden'));
    if (!filhos) return;
    // Buscando, o grupo abre para o resultado aparecer; sem busca, ele volta
    // para a dobra que o usuário escolheu — que nunca foi perdida.
    const fechado = _cprGruposFechados.has(_cprTipoAberto + '/' + bloco.dataset.cprGrupoBloco);
    filhos.classList.toggle('hidden', alvo ? !algumFilho : fechado);
  });

  // ⚠️ A CONTAGEM É A DA TELA, e não a que o backend devolveu: dizer "42 itens"
  // com 7 à vista manda o usuário procurar 35 linhas que nunca estiveram ali.
  const aviso = document.getElementById('cpr-busca-aviso');
  if (aviso) {
    aviso.classList.toggle('hidden', !alvo);
    aviso.textContent = alvo ? `${visiveis} item(ns) à vista com "${_cprBusca.trim()}".` : '';
  }
}

function _cprPintarPastas(lista, itens) {
  const container = document.getElementById('cpr-pastas-' + lista);
  if (!container) return;
  if (!itens.length) {
    container.innerHTML = `<p class="config-nota">Nenhuma pasta — este início rápido não cria nada aqui.</p>`;
    return;
  }

  // ⛔ REUSA `criarArvorePastas` (`arvore-pastas.js`). Convenção *"Árvore de
  // pastas é UMA só"*: ela já traz os ícones, a indentação por nível e o estado
  // de aberto que sobrevive ao redesenho, e a última implementação própria foi
  // a SEXTA — acabou trocada por esta mesma.
  //
  // `pastas` (e não `caminhos`) porque aqui TODO segmento é pasta: não há
  // arquivo no fim. É exatamente o parâmetro que existe para "pasta que só
  // contém subpastas" — o nó intermediário que o usuário não cadastrou.
  //
  // A decoração entra DEPOIS do desenho, sobre o `data-caminho` de cada linha —
  // assim o componente não ganha parâmetro novo e as outras telas não correm
  // risco.
  const caminhos = itens.map(it => (it.caminho || '').trim()).filter(Boolean);
  container.innerHTML = '';
  criarArvorePastas({
    container,
    caminhos: [],
    pastas: caminhos,
    contarArquivos: false,
    expandido: true,
    vazio: 'Nenhuma pasta.',
  });

  const porCaminho = new Map();
  itens.forEach((it, i) => porCaminho.set((it.caminho || '').trim(), { it, i }));

  container.querySelectorAll('.arvp-pasta').forEach(no => {
    const caminho = no.dataset.caminho || '';
    const linha = no.querySelector('.arvp-linha-pasta');
    if (!linha) return;
    const reg = porCaminho.get(caminho);
    if (!reg) {
      // ⚠️ NÓ INTERMEDIÁRIO, criado só para conter as de dentro (D28). Ele NÃO
      // vira linha de verdade: cadastrar `backend/modulos` continua cadastrando
      // UMA pasta, e dar marcas e × a este nó faria o `backend` virar uma
      // segunda linha que o usuário nunca pediu.
      linha.classList.add('cpr-pasta-fantasma');
      const nota = document.createElement('span');
      nota.className = 'cpr-pasta-nota';
      nota.textContent = 'criada só para conter as de dentro';
      linha.appendChild(nota);
      return;
    }
    const { it, i } = reg;
    const extras = document.createElement('span');
    extras.className = 'cpr-pasta-extras';
    extras.innerHTML = `
      <label class="cpr-rm"><input type="checkbox" data-cpr-lista="${lista}" data-cpr-i="${i}"
             data-cpr-prop="remover"${it.remover ? ' checked' : ''}> Remover</label>
      <label class="cpr-ctx"><input type="checkbox" data-cpr-lista="${lista}" data-cpr-i="${i}"
             data-cpr-prop="contexto"${it.contexto ? ' checked' : ''}> Contexto sem leitura</label>
      <button type="button" data-cpr-del="${lista}" data-cpr-i="${i}" title="Remover linha">×</button>`;
    linha.appendChild(extras);

    // A descrição só aparece quando "Contexto sem leitura" está marcado: ela É o
    // conteúdo do item de contexto, e por isso é obrigatória nesse caso.
    if (it.contexto) {
      const desc = document.createElement('input');
      desc.className = 'cpr-desc';
      desc.type = 'text';
      desc.placeholder = 'descrição — obrigatória';
      desc.dataset.cprLista = lista;
      desc.dataset.cprI = String(i);
      desc.dataset.cprProp = 'descricao';
      desc.value = it.descricao || '';
      no.insertBefore(desc, linha.nextSibling);
    }
  });
}

