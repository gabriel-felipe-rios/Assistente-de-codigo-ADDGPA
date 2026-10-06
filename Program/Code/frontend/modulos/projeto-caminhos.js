// ═══════════ COMPONENTE: LISTA DE CAMINHOS DO PROJETO — Remover e Contexto sem leitura ══
// As duas sub-abas de Projeto são o MESMO componente (D46, D47): à esquerda a
// Estrutura das pastas de trabalho, à direita a lista com um item por caminho.
// Até a fase 06 da obra «Qualidade da documentação» eram duas telas
// diferentes — o Remover com a árvore só dos itens e a lista `.path-item`, o
// Contexto com lista clicável à esquerda e o detalhe de um item à direita.
//
// O que é de cada lista (onde mora no `workspaceConfig`, se tem escopo, se tem
// descrição) é registrado por `remover.js` e `contexto.js` com
// `registrarListaDeCaminhos`. O markup nasce em `projeto-template.js`
// (`_caminhosPainel`); o CSS é `estilos/projeto-caminhos.css` (`.pcam-*`).
//
// A Estrutura:
//   · é só a prévia do que já está na lista (`cfg.itens()`) — a estrutura de
//     CADA item adicionado, não a pasta de trabalho inteira («essa estrutura
//     é a estrutura da pasta que eu adicionei, que eu fiz o drag and drop
//     aqui»; mostrar tudo confundia com a Estrutura de Trabalho). O conteúdo
//     de cada item vem do Resumo completo (`_resumoEstado.completo`,
//     resumo.js), sem o segmento da pasta de trabalho na frente — o item
//     aparece como raiz da própria árvore, não pendurado debaixo dela. Não
//     faz varredura própria — `loadSummary` a redesenha no fim, inclusive
//     depois de cada mudança na lista (`depoisDeMudar`);
//   · vem RETRAÍDA («eu quero que ele venha retraído tudo por padrão»), com
//     ⊞ e ⊟ e SEM ↻: ela se atualiza sozinha a cada carga do Resumo;
//   · não se arrasta — os itens já estão na lista. Quem acrescenta é o
//     «＋ Adicionar ▾» ou o arrasto do Explorer do Windows.
//
// O mesmo caminho pode estar nas duas listas; quando está, o Contexto sem
// leitura vence (`ignorados.py`).

const _pcamListas = {};    // chave ('remover' | 'contexto') → cfg registrada
const _pcamArvores = {};   // chave → instância de `criarArvorePastas`

// Como a tela diz cada tipo — o usuário gostou da legenda «pasta com subpasta,
// só a pasta ou o arquivo».
const PCAM_ESCOPO = { arvore: 'com subpastas', pasta: 'só a pasta', arquivo: 'arquivo' };

// cfg: { chave, titulo, itens() → o array do workspaceConfig,
//        novoItem(path, ehPasta), comEscopo, comDescricao, sempreComSubpastas,
//        vazio, depoisDeMudar() }
function registrarListaDeCaminhos(cfg) {
  _pcamListas[cfg.chave] = cfg;
}

// O tipo do item. O Remover grava `type` + `recursive` (sem `recursive` =
// com subpastas, como em `ignorados.esta_ignorado`). O Contexto sem leitura é
// sempre com subpastas e, em item antigo sem `type`, adivinha pelo nome — a
// mesma heurística da tela antiga: extensão de até 5 letras = arquivo.
function _pcamTipo(item, sempreComSubpastas) {
  let ehArquivo;
  if (item.type === 'file') ehArquivo = true;
  else if (item.type === 'folder') ehArquivo = false;
  else {
    const nome = (item.path || '').split(/[/\\]/).pop() || '';
    const ext = nome.includes('.') ? nome.split('.').pop() : '';
    ehArquivo = !!(ext && ext.length <= 5 && ext !== nome);
  }
  if (ehArquivo) return 'arquivo';
  if (sempreComSubpastas) return 'arvore';
  return item.recursive === false ? 'pasta' : 'arvore';
}

// A Estrutura mostra caminhos no formato do Resumo — `pasta-de-trabalho/resto`,
// com o último segmento da pasta de trabalho na frente (convenção de
// `scan_workspace`). As listas guardam caminho ABSOLUTO, que é o que
// `ignorados.py` compara; a tradução é aqui.
function _pcamAbsoluto(relativo) {
  const partes = String(relativo || '').split('/').filter(Boolean);
  const base = partes.shift();
  const pasta = (workspaceConfig.working_folders || []).find(p =>
    p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() === base);
  if (!pasta) return null;
  const raiz = pasta.replace(/[\\/]+$/, '');
  const sep = raiz.includes('\\') ? '\\' : '/';
  return partes.length ? raiz + sep + partes.join(sep) : raiz;
}

// Inverso de `_pcamAbsoluto`: caminho absoluto → formato do Resumo
// (`pasta-de-trabalho/resto`). `null` se não estiver em nenhuma pasta de
// trabalho — mesma checagem de `_pcamDentroDoTrabalho`.
function _pcamParaRelativo(absoluto) {
  const alvo = String(absoluto || '').replace(/[\\/]+$/, '');
  for (const p of (workspaceConfig.working_folders || [])) {
    const raiz = p.replace(/[\\/]+$/, '');
    const base = raiz.split(/[\\/]/).pop();
    if (alvo === raiz) return base;
    if (alvo.startsWith(raiz + '\\') || alvo.startsWith(raiz + '/')) {
      return base + '/' + alvo.slice(raiz.length + 1).replace(/\\/g, '/');
    }
  }
  return null;
}

// A Estrutura de cada lista: só o que está em `cfg.itens()`, expandido para a
// própria árvore de cada item (via `st`, o Resumo completo), sem o segmento
// da pasta de trabalho na frente — por isso o `.slice(base.length + 1)`.
function _pcamEstruturaDosItens(cfg, st) {
  const caminhos = [];
  const pastas = [];
  for (const item of cfg.itens()) {
    const relPasta = _pcamParaRelativo(item.path); // ex.: "Code/assets"
    if (!relPasta) continue;
    const base = relPasta.split('/')[0];
    const semRaiz = relPasta.slice(base.length + 1); // "assets"
    if (_pcamTipo(item, cfg.sempreComSubpastas) === 'arquivo') {
      caminhos.push(semRaiz || relPasta);
      continue;
    }
    pastas.push(semRaiz || relPasta);
    const prefixo = relPasta + '/';
    for (const c of st.caminhos || []) {
      if (c === relPasta || c.startsWith(prefixo)) caminhos.push(c.slice(base.length + 1));
    }
    for (const p of st.pastas || []) {
      if (p === relPasta || p.startsWith(prefixo)) pastas.push(p.slice(base.length + 1));
    }
  }
  return { caminhos, pastas };
}

// Chamada no fim de `loadSummary` (resumo.js) — inclusive depois de cada
// mudança na lista, via `depoisDeMudar`. Cria as árvores na primeira vez;
// depois só redesenha — o que estava aberto continua aberto.
function pcamRedesenharEstruturas() {
  const st = (_resumoEstado && _resumoEstado.completo) || { caminhos: [], pastas: [] };
  for (const chave of Object.keys(_pcamListas)) {
    const alvo = document.getElementById(`pcam-${chave}-estrutura`);
    if (!alvo) continue;
    const cfg = _pcamListas[chave];
    const { caminhos, pastas } = _pcamEstruturaDosItens(cfg, st);
    if (_pcamArvores[chave]) {
      _pcamArvores[chave].redesenhar(caminhos, pastas);
      continue;
    }
    _pcamArvores[chave] = criarArvorePastas({
      container: alvo,
      caminhos, pastas,
      expandido: false,
      contarArquivos: false,
      arrastavel: false,
      vazio: cfg.vazio,
    });
    ligarBotoesArvore(() => _pcamArvores[chave], {
      expandir: `btn-pcam-${chave}-expand-all`,
      retrair: `btn-pcam-${chave}-collapse-all`,
    });
  }
}

// A zona de soltar é o painel da direita inteiro. Liga uma vez só.
function _pcamLigar(chave) {
  const zona = document.getElementById(`pcam-${chave}-principal`);
  const aviso = document.getElementById(`pcam-${chave}-soltar`);
  if (!zona || zona._pcamLigada) return;
  zona._pcamLigada = true;
  const daArvore = e => [...e.dataTransfer.types].includes(ARVP_TIPO_ARRASTO);
  zona.addEventListener('dragover', e => {
    if (!daArvore(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    aviso.classList.add('sobre');
  });
  zona.addEventListener('dragleave', e => {
    if (!zona.contains(e.relatedTarget)) aviso.classList.remove('sobre');
  });
  // ⚠️ LIGADO ANTES do `setupDropZoneMulti` e com `stopImmediatePropagation`.
  // O ouvinte de `drop` dele roda para QUALQUER soltura, e sem arquivo do
  // sistema cai na seleção do Explorer (`get_explorer_selection`) — soltar
  // uma linha da Estrutura acrescentaria o que estivesse selecionado lá.
  zona.addEventListener('drop', async e => {
    aviso.classList.remove('sobre');
    if (!daArvore(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    let dado;
    try { dado = JSON.parse(e.dataTransfer.getData(ARVP_TIPO_ARRASTO)); } catch (_) { return; }
    const absoluto = _pcamAbsoluto(dado.caminho);
    if (!absoluto) { showToast('Não achei a pasta de trabalho desse caminho.', true); return; }
    await acrescentarCaminhos(chave, [{ path: absoluto, isDirectory: !!dado.pasta }]);
  });
  // Do Explorer do Windows: o mesmo caminho de sempre (`drag-drop.js`).
  setupDropZoneMulti(zona, itens => acrescentarCaminhos(chave, itens));
}

// Só entra o que está DENTRO de uma pasta de trabalho — e não a pasta de
// trabalho em si, que é a raiz do projeto, não um item de Remover/Contexto.
// («a pasta de trabalho não é pra aparecer aqui»). Vale para as três portas de
// entrada: arrasto da Estrutura (a raiz vem sem sobra em `_pcamAbsoluto`), o
// Explorer do Windows (caminho solto sem checagem nenhuma) e o botão
// «＋ Adicionar ▾» (diálogo nativo, que deixa escolher qualquer pasta do disco).
function _pcamDentroDoTrabalho(caminho) {
  const alvo = String(caminho || '').replace(/[\\/]+$/, '');
  return (workspaceConfig.working_folders || []).some(p => {
    const raiz = p.replace(/[\\/]+$/, '');
    if (alvo === raiz) return false;
    return alvo.startsWith(raiz + '\\') || alvo.startsWith(raiz + '/');
  });
}

// `itens` = [{ path (absoluto), isDirectory }]. Usada pelo arrasto (Estrutura
// e Explorer) e pelos botões «＋ Adicionar ▾» (remover.js, contexto.js).
// Pasta entra com subpastas; o tipo se muda no item (✏ escopo).
async function acrescentarCaminhos(chave, itens) {
  const cfg = _pcamListas[chave];
  const lista = cfg.itens();
  let n = 0;
  let foraDoTrabalho = 0;
  for (const { path, isDirectory } of itens) {
    if (!path) continue;
    if (!_pcamDentroDoTrabalho(path)) { foraDoTrabalho++; continue; }
    if (lista.some(i => i.path === path)) continue;
    lista.push(cfg.novoItem(path, !!isDirectory));
    n++;
  }
  if (!n) {
    if (foraDoTrabalho) {
      showToast(foraDoTrabalho === 1
        ? 'Esse caminho não está dentro de uma pasta de trabalho.'
        : 'Esses caminhos não estão dentro de uma pasta de trabalho.', true);
    } else {
      showToast(itens.length === 1 ? `Esse caminho já está em ${cfg.titulo}.`
                                   : `Esses caminhos já estão em ${cfg.titulo}.`);
    }
    return;
  }
  await _pcamMudou(cfg);
  showToast(n === 1 ? `Acrescentado a ${cfg.titulo}.` : `${n} caminhos acrescentados a ${cfg.titulo}.`);
  // No Contexto sem leitura o próximo passo é escrever a descrição.
  if (cfg.comDescricao) {
    const campos = document.querySelectorAll(`#pcam-${chave}-lista .pcam-desc`);
    const ultimo = campos[campos.length - 1];
    if (ultimo) ultimo.focus();
  }
}

async function _pcamMudou(cfg) {
  await saveWorkspace();
  pintarListaDeCaminhos(cfg.chave);
  if (cfg.depoisDeMudar) cfg.depoisDeMudar();
}

function pintarListaDeCaminhos(chave) {
  const cfg = _pcamListas[chave];
  if (!cfg) return;
  _pcamLigar(chave);
  const alvo = document.getElementById(`pcam-${chave}-lista`);
  if (!alvo) return;
  alvo.innerHTML = '';
  const itens = cfg.itens();
  if (!itens.length) {
    alvo.innerHTML = `<p class="pcam-vazio">${escapeHtml(cfg.vazio)}</p>`;
    return;
  }
  itens.forEach((item, i) => alvo.appendChild(_pcamItem(cfg, item, i)));
}

function _pcamItem(cfg, item, i) {
  const tipo = _pcamTipo(item, cfg.sempreComSubpastas);
  const div = document.createElement('div');
  div.className = `pcam-item pcam-item--${tipo}`;
  div.innerHTML = `
    <div class="pcam-linha">
      <span class="pcam-caminho" title="${escapeHtml(item.path)}">${escapeHtml(item.path)}</span>
      <span class="pcam-escopo">${PCAM_ESCOPO[tipo]}</span>
      <div class="pcam-acoes"></div>
    </div>`;
  const acoes = div.querySelector('.pcam-acoes');

  // «Mesmo assim, pode ler» em CADA item das duas listas (D45, D47).
  acoes.appendChild(montarQuemPodeLer(item, async valor => {
    item.quem_pode_ler = valor;
    await _pcamMudou(cfg);
  }));

  if (cfg.comEscopo && tipo !== 'arquivo') {
    const escopo = document.createElement('button');
    escopo.type = 'button';
    escopo.className = 'pcam-btn';
    escopo.textContent = '✏ escopo';
    escopo.title = 'Alternar entre com subpastas e só a pasta';
    escopo.addEventListener('click', async () => {
      item.recursive = item.recursive === false;
      await _pcamMudou(cfg);
    });
    acoes.appendChild(escopo);
  }

  const tirar = document.createElement('button');
  tirar.type = 'button';
  tirar.className = 'pcam-btn pcam-btn--tirar';
  tirar.textContent = '✕';
  tirar.title = `Tirar de ${cfg.titulo}`;
  tirar.addEventListener('click', async () => {
    cfg.itens().splice(i, 1);
    await _pcamMudou(cfg);
  });
  acoes.appendChild(tirar);

  // Só o Contexto sem leitura tem a descrição (D47). Grava ao sair do campo,
  // nunca a cada tecla.
  if (cfg.comDescricao) {
    const rotulo = document.createElement('span');
    rotulo.className = 'pcam-desc-rot';
    rotulo.textContent = 'Descrição que a IA recebe';
    const campo = document.createElement('textarea');
    campo.className = 'pcam-desc';
    campo.placeholder = 'Descreva o que este arquivo/pasta representa...';
    campo.value = item.description || '';
    campo.addEventListener('blur', async () => {
      if (campo.value === (item.description || '')) return;
      item.description = campo.value;
      await saveWorkspace();
    });
    div.appendChild(rotulo);
    div.appendChild(campo);
  }
  return div;
}
