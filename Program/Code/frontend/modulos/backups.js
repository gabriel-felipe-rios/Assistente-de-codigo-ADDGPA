// ═══ ABA: BACKUPS (tab-git) — sub-aba Versões e os modais ═══════════════════
//
// O back-end vive em backend/modulos/backups.py (criar) e backups_reverter.py
// (reverter). Aqui só a interface: listar as Versões, fazer cópia, reverter,
// excluir, e o despacho das três sub-abas.
//
// Uma **Versão** é uma lista de (caminho → hash), em duas metades: Código e
// Documentação. O cartão mostra as duas em linhas separadas — quantos arquivos
// em quantas pastas — porque a pergunta "o que esta cópia guardou?" quase nunca
// tem a mesma resposta dos dois lados.
//
// ⚠️ NÃO É GIT: sem `.git`, sem commit, sem branch. O id `tab-git` é herdado.

let bkModaisInjetados = false;
let bkOcupado = false;
let bkVersaoPendenteDeReversao = null;
let bkVersaoPendenteDeExclusao = null;
let bkResumoDaCopia = null;

// ── Despacho das sub-abas ────────────────────────────────────────────────────

function bkDespachar(id) {
  if (id === 'bksub-versoes') bkCarregarLista();
  if (id === 'bksub-mapa' && typeof initBackupsMapa === 'function') initBackupsMapa();
  if (id === 'bksub-config' && typeof initBackupsConfig === 'function') initBackupsConfig();
}

// De qual projeto é o que está na tela de Backups. `null` = nenhum ainda.
let bkProjeto = null;

// As Versões, o diff, a árvore do Mapa da mudança e a configuração são todos
// DE UM PROJETO — e nada disso tinha noção de projeto. Com abas, trocar de
// projeto deixava na tela a lista de Versões e o Mapa do outro, com os
// caminhos de arquivo dele.
//
// ⚠️ `bkOcupado` fica de fora de propósito: ele diz que uma cópia ou reversão
// está em curso NO PROGRAMA (a `TRAVA_IA` é global — ver trava_ia.py), e zerar
// aqui reabriria o botão no meio do trabalho de outra aba.
function bkLimparEstadoDeProjeto() {
  if (bkProjeto === currentProject) return;
  bkProjeto = currentProject;
  bkVersaoPendenteDeReversao = null;
  bkVersaoPendenteDeExclusao = null;
  bkResumoDaCopia = null;
  // Mapa da mudança: as duas pontas do diff, a lista de Versões e os caches de
  // desenho. Sem isto, o seletor "de/até" apontava para Versões que não
  // existem no projeto novo.
  if (typeof bmVersoes !== 'undefined') {
    bmDe = null;
    bmAte = 'atual';
    bmVersoes = [];
    bmGrandes = null;
  }
  if (typeof bmPastaAberta !== 'undefined') {
    bmPastaAberta = '';
    bmNosDeLigacoes = [];
    bmFocoDeLigacoes = '';
  }
  if (typeof bmArvores !== 'undefined') {
    Object.keys(bmArvores).forEach(k => { delete bmArvores[k]; });
  }
  // Configuração da aba (o que entra na cópia) — é por projeto.
  if (typeof bcConfiguracao !== 'undefined') {
    bcConfiguracao = null;
    bcPartes = [];
  }
}

function initBackupsTab() {
  if (!currentProject) return;
  bkLimparEstadoDeProjeto();
  const escopo = document.getElementById('tab-git');
  if (typeof _wireSubtabBar === 'function') _wireSubtabBar(escopo, bkDespachar);

  bkInjetarModais();
  const btn = document.getElementById('bk-btn-create');
  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = '1';
    btn.addEventListener('click', bkAbrirModalDeCopia);
  }
  const ativa = escopo && escopo.querySelector('.agentes-subtab-btn.active');
  bkDespachar(ativa ? ativa.dataset.asubtab : 'bksub-versoes');
}

// ── A lista ──────────────────────────────────────────────────────────────────

async function bkCarregarLista() {
  const lista = document.getElementById('bk-list');
  const vazio = document.getElementById('bk-empty');
  if (!lista) return;
  try {
    const r = await window.pywebview.api.listar_versoes(currentProject);
    const versoes = (r && r.success) ? r.versoes : [];
    document.getElementById('bk-count').textContent = versoes.length;
    lista.innerHTML = '';
    if (!versoes.length) { vazio.classList.remove('hidden'); return; }
    vazio.classList.add('hidden');
    versoes.forEach(v => lista.appendChild(bkCartao(v)));
  } catch (e) {
    console.error(e);
    showToast('Erro ao carregar as Versões.', true);
  }
}

function bkCartao(v) {
  const el = document.createElement('div');
  el.className = 'bk-card' + (v.tipo === 'seguranca' ? ' safety' : '');

  // Quando nenhuma rotina rodou, a linha da documentação DIZ isso. Um "0
  // arquivos" seco parece defeito da cópia, e não é: é o projeto que ainda não
  // gerou documentação nenhuma.
  const doc = v.documentacao.arquivos
    ? `${v.documentacao.arquivos} arquivos em ${v.documentacao.pastas} pastas` +
      (v.documentacao.rotinas.length
        ? ` · ${escapeHtml(v.documentacao.rotinas.join(', '))}`
        : '')
    : 'nenhuma rotina tinha rodado ainda';

  el.innerHTML = `
    <div class="bk-icon">${v.tipo === 'seguranca' ? '🛟' : '📦'}</div>
    <div class="bk-main">
      <div class="bk-date">
        ${bkFormatarData(v.criada_em, v.id)}
        ${v.tipo === 'seguranca' ? '<span class="bk-tag-safety">auto · antes de reverter</span>' : ''}
        ${v.completa ? '<span class="bk-tag-completa">cópia completa</span>' : ''}
      </div>
      <div class="bk-note${v.anotacao ? '' : ' empty'}">
        ${v.anotacao ? escapeHtml(v.anotacao) : '— sem anotação —'}
      </div>
      <div class="bk-metade">
        <span class="bk-metade-nome">Código</span>
        <span class="bk-metade-dado">${v.codigo.arquivos} arquivos em ${v.codigo.pastas} pastas</span>
      </div>
      <div class="bk-metade">
        <span class="bk-metade-nome">Documentação</span>
        <span class="bk-metade-dado">${doc}</span>
      </div>
      <div class="bk-meta">💾 ${bkFormatarTamanho(v.tamanho)} nesta Versão</div>
    </div>
    <div class="bk-card-actions">
      <button class="bk-icon-btn" title="Reverter para esta Versão">↩</button>
      <button class="bk-icon-btn" title="Abrir no Mapa da mudança">🗺</button>
      <button class="bk-icon-btn" title="Abrir a pasta das Versões">📂</button>
      <button class="bk-icon-btn danger" title="Excluir esta Versão">🗑</button>
    </div>`;

  const [reverter, mapa, pasta, excluir] = el.querySelectorAll('.bk-icon-btn');
  reverter.addEventListener('click', () => bkAbrirModalDeReversao(v));
  mapa.addEventListener('click', () => bkIrParaOMapa(v.id));
  pasta.addEventListener('click', () => window.pywebview.api.abrir_pasta_das_versoes(currentProject));
  excluir.addEventListener('click', () => bkAbrirModalDeExclusao(v));
  return el;
}

function bkIrParaOMapa(versaoId) {
  const btn = document.querySelector('#tab-git .agentes-subtab-btn[data-asubtab="bksub-mapa"]');
  if (btn) btn.click();
  if (typeof bmAbrirVersao === 'function') bmAbrirVersao(versaoId);
}

// ── Modal "Fazer cópia" ──────────────────────────────────────────────────────

// ⚠️ O MODAL ABRE NA HORA. Antes ele esperava o back-end varrer o projeto e
// calcular o md5 de mil arquivos, e por isso "aparecia a interface e depois
// aparecia o resto". Agora o esqueleto entra imediatamente e o conteúdo chega
// por `bkAoResumoPronto`, chamado do Python.
let bkResumoEhDoModal = false;

function bkAbrirModalDeCopia() {
  bkMostrar('bk-modal-create');
  document.getElementById('bk-auto-name').textContent = bkAgora();
  document.getElementById('bk-note-input').value = '';
  bkResumoDaCopia = null;
  bkResumoEhDoModal = true;

  // O botão nasce desabilitado: sem o resumo não dá para saber se ele é
  // "Fazer cópia" ou "Gerar o que falta e copiar", e um botão que muda de
  // rótulo debaixo do dedo é pior do que um botão que espera.
  const botao = document.getElementById('bk-create-ok');
  botao.disabled = true;
  botao.textContent = 'Fazer cópia';
  botao.dataset.gerar = '';

  const corpo = document.getElementById('bk-create-body');
  // O checkbox "Cópia completa" mora DENTRO do corpo — ele nasce desmarcado a
  // cada abertura, junto do corpo novo.
  corpo.innerHTML = '<div class="bk-carregando">Conferindo o que mudou…</div>';

  try {
    window.pywebview.api.resumo_para_copiar(currentProject);
  } catch (e) {
    corpo.innerHTML = `<div class="bk-warn">${escapeHtml(String(e))}</div>`;
  }
}

// Chamado pelo Python por `evaluate_js`. Serve às duas telas que pedem o
// resumo: o modal e a sub-aba Configuração.
function bkAoResumoPronto(r) {
  // Várias abas de projeto abertas: evento de outro projeto não pinta aqui.
  if (r && r.project && r.project !== currentProject) return;
  if (typeof bcAplicarNumeros === 'function') bcAplicarNumeros(r);
  if (!bkResumoEhDoModal) return;
  const corpo = document.getElementById('bk-create-body');
  if (!corpo) return;
  if (!r || !r.success) {
    corpo.innerHTML = `<div class="bk-warn">${escapeHtml((r && r.error) || 'falhou')}</div>`;
    return;
  }
  bkResumoDaCopia = r;
  corpo.innerHTML = bkCorpoDaCopia(r);
  bkAtualizarBotaoDeCopia();
}

function bkCorpoDaCopia(r) {
  const linha = (rotulo, d) => `
    <div class="bk-resumo-linha">
      <span class="bk-resumo-nome">${rotulo}</span>
      <span class="bk-resumo-dado">${d.arquivos} arquivos em ${d.pastas} pastas</span>
      <span class="bk-mais">+${d.mais}</span><span class="bk-menos">−${d.menos}</span>
    </div>`;

  // Os três que travam a cópia são PARSER PURO — nenhum chama o modelo. É por
  // isso que faltar não é impasse, e por isso o único botão de ação é "Gerar o
  // que falta e copiar". Não existe "copiar assim mesmo": a Versão sem eles
  // nasce cega, sem Mapa e sem saber o que mudou para a próxima.
  const pre = r.pre_requisitos.map(p => `
    <div class="bk-pre ${p.esta_pronto ? 'pronto' : 'falta'}">
      <span class="bk-pre-marca">${p.esta_pronto ? '✔' : '!'}</span>
      <span>${escapeHtml(p.rotulo)}</span>
    </div>`).join('');

  return `
    <div class="bk-bloco">
      <div class="bk-bloco-h">O que mudou desde a última cópia</div>
      ${linha('Código', r.codigo)}
      ${linha('Documentação', r.documentacao)}
    </div>

    <div class="bk-bloco">
      <div class="bk-bloco-h">Precisa estar pronto</div>
      ${pre}
      <div class="bk-bloco-nota">
        Os três são parser puro — nenhum deles chama o modelo, então dá para
        gerar na hora. <b>Não travam a cópia:</b> Pipeline,
        Documentação Técnica, Glossário, Resumo de Pastas, Índice de Navegação,
        Índice de Identificadores, Bibliotecas e Embedding Semântico.
      </div>
    </div>

    <div class="bk-bloco">
      <label class="bk-safety-check">
        <input type="checkbox" id="bk-completa-chk">
        <span><b>Cópia completa</b> — ignora a lista “Ignorar no backup” e leva tudo.</span>
      </label>
      <div class="bk-tamanhos">
        <span>com a lista: <b>${bkFormatarTamanho(r.tamanhos.com_a_lista)}</b></span>
        <span>completa: <b>${bkFormatarTamanho(r.tamanhos.completa)}</b></span>
      </div>
    </div>`;
}

function bkAtualizarBotaoDeCopia() {
  const btn = document.getElementById('bk-create-ok');
  if (!btn || !bkResumoDaCopia) return;
  const falta = bkResumoDaCopia.pre_requisitos.some(p => !p.esta_pronto);
  btn.textContent = falta ? '▶ Gerar o que falta e copiar' : 'Fazer cópia';
  btn.dataset.gerar = falta ? '1' : '';

  // Trava da IA: o botão fica desabilitado COM O MOTIVO escrito ao lado. Botão
  // apagado sem explicação parece defeito.
  //
  // ⚠️ Quem pinta é `aplicarTravaIA`, e não este arquivo, embora o estado venha
  // do resumo que o backend acabou de mandar. Duas mãos escrevendo no mesmo
  // botão brigariam: a pulsação de 4 s reescreve `#bk-create-ok` e
  // `#bk-create-trava` a cada volta, e reabriria o que fosse apagado aqui à
  // mão. Passando pelo mecanismo único, o valor de agora entra e as pulsações
  // seguintes continuam de onde ele parou — que é o que faz o botão voltar a
  // acender SOZINHO quando a outra ponta termina.
  if (typeof aplicarTravaIA === 'function') {
    aplicarTravaIA(bkResumoDaCopia.trava || null);
  }
}

async function bkFazerCopia() {
  if (!bkResumoDaCopia) return;   // o botão só habilita com o resumo pronto
  // A terceira camada da trava: perguntar AGORA, no clique. É a única que fecha
  // a janela de até 4 s entre outra ponta começar e a tela saber — e o backup
  // demora, então começar um em cima de uma regeneração de documentação copia
  // arquivos a meio caminho.
  if (typeof travaIALiberado === 'function' && !await travaIALiberado('backup')) return;
  const btn = document.getElementById('bk-create-ok');
  const anotacao = document.getElementById('bk-note-input').value.trim();
  const completa = document.getElementById('bk-completa-chk').checked;

  if (btn && btn.dataset.gerar) {
    bkOcupar(true, 'Gerando o que falta…');
    const ok = await bkGerarPreRequisitos();
    if (!ok) { bkOcupar(false); return; }
  }

  bkResumoEhDoModal = false;
  bkEsconder('bk-modal-create');
  bkOcupar(true, 'Copiando…');
  try {
    await window.pywebview.api.criar_versao(currentProject, anotacao, 'manual', completa);
  } catch (e) {
    bkOcupar(false);
    showToast('Erro ao fazer a cópia.', true);
  }
}

async function bkGerarPreRequisitos() {
  // Os três são determinísticos e têm cada um o seu endpoint já existente.
  const acoes = {
    'hashes': () => window.pywebview.api.run_hashes_agent(currentProject),
    'grafo-imports': () => window.pywebview.api.run_grafo_imports_agent(currentProject),
    'indice-de-simbolos': () => window.pywebview.api.build_symbol_index(currentProject),
  };
  try {
    for (const p of bkResumoDaCopia.pre_requisitos) {
      if (p.esta_pronto || !acoes[p.id]) continue;
      await acoes[p.id]();
    }
    return true;
  } catch (e) {
    showToast('Não foi possível gerar o que falta: ' + e, true);
    return false;
  }
}

function bkAoTerminarCopia(versao) {
  // Várias abas de projeto abertas: evento de outro projeto não pinta aqui.
  if (versao && versao.project && versao.project !== currentProject) return;
  bkOcupar(false);
  showToast('Versão criada.');
  bkCarregarLista();
}

// ── Modal "Reverter" ─────────────────────────────────────────────────────────

async function bkAbrirModalDeReversao(v) {
  bkVersaoPendenteDeReversao = v.id;
  document.getElementById('bk-revert-target').textContent = bkFormatarData(v.criada_em, v.id);
  document.getElementById('bk-escopo-tudo').checked = true;
  document.getElementById('bk-config-chk').checked = false;
  document.getElementById('bk-safety-chk').checked = true;
  bkMostrar('bk-modal-revert');

  // A tabela das naturezas é repetida LINHA A LINHA antes de confirmar. Ela é
  // informativa: o que volta depende da natureza da coisa, não de preferência.
  const alvo = document.getElementById('bk-naturezas');
  alvo.innerHTML = '<div class="bk-carregando">…</div>';
  try {
    const r = await window.pywebview.api.naturezas_da_reversao(currentProject);
    const acoes = {
      'volta': ['volta', 'ok'],
      'nao-volta': ['não volta', 'neutro'],
      'nao-volta-nem-apaga': ['não volta, e nada é apagado', 'neutro'],
      'zera': ['zera', 'aviso'],
    };
    alvo.innerHTML = r.naturezas.map(n => {
      const [texto, classe] = acoes[n.acao] || [n.acao, 'neutro'];
      return `
        <div class="bk-natureza">
          <span class="bk-natureza-nome">${escapeHtml(n.rotulo)}</span>
          <span class="bk-natureza-acao ${classe}">${texto}</span>
          <span class="bk-natureza-porque">${escapeHtml(n.explicacao)}</span>
        </div>`;
    }).join('') + `
      <div class="bk-natureza generica">
        <span class="bk-natureza-porque">${escapeHtml(r.regra_generica)}</span>
      </div>`;
  } catch (e) {
    alvo.innerHTML = `<div class="bk-warn">${escapeHtml(String(e))}</div>`;
  }
}

async function bkReverter() {
  const escopo = document.querySelector('input[name="bk-escopo"]:checked').value;
  const configuracao = document.getElementById('bk-config-chk').checked;
  const rede = document.getElementById('bk-safety-chk').checked;
  bkEsconder('bk-modal-revert');
  bkOcupar(true, 'Revertendo…');
  try {
    await window.pywebview.api.reverter_versao(
      currentProject, bkVersaoPendenteDeReversao, escopo, configuracao, rede);
  } catch (e) {
    bkOcupar(false);
    showToast('Erro ao reverter.', true);
  }
}

function bkAoTerminarReversao(info) {
  // Várias abas de projeto abertas: evento de outro projeto não pinta aqui.
  if (info && info.project && info.project !== currentProject) return;
  bkOcupar(false);
  showToast(`Revertido — ${info.codigo} arquivos de código, ` +
            `${info.documentacao} de documentação` +
            (info.zerados ? `, ${info.zerados} zerados` : '') +
            (info.rede ? ' (rede de segurança criada)' : ''));
  bkCarregarLista();
}

// ── Excluir ──────────────────────────────────────────────────────────────────

function bkAbrirModalDeExclusao(v) {
  bkVersaoPendenteDeExclusao = v.id;
  document.getElementById('bk-del-target').textContent = bkFormatarData(v.criada_em, v.id);
  bkMostrar('bk-modal-delete');
}

async function bkExcluir() {
  bkEsconder('bk-modal-delete');
  try {
    const r = await window.pywebview.api.excluir_versao(currentProject, bkVersaoPendenteDeExclusao);
    if (r && r.success) {
      const l = r.limpeza || {};
      showToast(l.apagados
        ? `Versão excluída · ${l.apagados} arquivos sem dono removidos`
        : 'Versão excluída.');
      bkCarregarLista();
    } else {
      showToast((r && r.error) || 'Erro ao excluir.', true);
    }
  } catch (e) { showToast('Erro ao excluir.', true); }
}

// ── Erro e estado ────────────────────────────────────────────────────────────

function bkAoFalhar(project, msg) {
  // Várias abas de projeto abertas: evento de outro projeto não pinta aqui.
  if (project && project !== currentProject) return;
  bkOcupar(false);
  showToast(msg, true);
}

function bkOcupar(ligado, msg) {
  bkOcupado = ligado;
  const btn = document.getElementById('bk-btn-create');
  const st = document.getElementById('bk-status');
  if (btn) btn.disabled = ligado;
  if (st) st.textContent = ligado ? (msg || '') : '';
}

// ── Ajudantes ────────────────────────────────────────────────────────────────

function bkFormatarData(iso, alternativa) {
  const d = new Date(iso || '');
  if (isNaN(d)) return alternativa || '';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function bkFormatarTamanho(bytes) {
  const b = bytes || 0;
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1024 * 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB';
  return (b / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

function bkAgora() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_` +
         `${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

function bkMostrar(id) { document.getElementById(id).classList.remove('hidden'); }
function bkEsconder(id) { document.getElementById(id).classList.add('hidden'); }
