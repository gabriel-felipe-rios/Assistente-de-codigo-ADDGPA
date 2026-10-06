// ═══ BACKUPS → sub-aba Configuração ════════════════════════════════════════
//
// ⚠️ REGRA QUE VALE PARA A TELA TODA: **só existe interruptor onde o usuário
// escolhe.** Os blocos "Código", "O que acontece quando você reverte" e "Onde
// as Versões ficam" são informativos e não têm nenhum controle — o que a cópia
// leva de código é consequência do Workspace, e o que a reversão faz depende da
// natureza do arquivo, não de preferência.
//
// ⚠️ Esta tela NÃO mexe em nada da aba Projeto. A lista "Ignorar no backup" é
// só do backup: não mexe no contexto, na análise nem nos mapas. A lista
// "Remover" e o "Contexto sem leitura" continuam exatamente onde estavam,
// fazendo exatamente o que faziam.

let bcConfiguracao = null;
let bcPartes = [];

async function initBackupsConfig() {
  const painel = document.getElementById('bksub-config');
  if (!painel || !currentProject) return;
  painel.innerHTML = '<div class="screen-body"><div class="bk-carregando">Carregando…</div></div>';
  try {
    const r = await window.pywebview.api.carregar_configuracao_do_backup(currentProject);
    bcConfiguracao = r.configuracao;
    bcPartes = r.partes;
    painel.innerHTML = `<div class="screen-body">${bcMarcacao()}</div>`;
    bcLigarEventos();
    await bcMontarBlocosDinamicos();
  } catch (e) {
    painel.innerHTML = `<div class="screen-body"><div class="bk-warn">${escapeHtml(String(e))}</div></div>`;
  }
}

function bcMarcacao() {
  return `
    <div class="bc-corpo">

      <div class="bc-bloco">
        <div class="bc-bloco-h">Código — o que a cópia leva</div>
        <div class="bc-info" id="bc-codigo-info">…</div>
        <div class="bc-nota">
          A pasta de trabalho vai <b>inteira</b>. A raiz do projeto fica de fora.
          Não há interruptor aqui: quais são as pastas de trabalho se decide na
          aba Projeto, e repetir a escolha em dois lugares é o jeito de as duas
          discordarem.
        </div>
      </div>

      <div class="bc-bloco">
        <div class="bc-bloco-h">Ignorar no backup</div>
        <div class="bc-nota destaque">
          Esta lista é <b>só do backup</b> — não mexe no contexto, na análise
          nem nos mapas. A lista “Remover” da aba Projeto não tem efeito nenhum
          aqui. Ela vale para as <b>duas metades</b>: o código e a documentação.
        </div>
        <div class="bc-solta drop-section" id="bc-solta">
          <div class="bc-solta-texto">Arraste pastas ou arquivos aqui</div>
          <button class="btn btn-muted btn-sm" id="bc-escolher">＋ Escolher</button>
        </div>
        <div class="bc-lista" id="bc-lista"></div>
        <div class="bc-rodape" id="bc-rodape">…</div>
      </div>

      <div class="bc-bloco">
        <div class="bc-bloco-h">Documentação — o que entra na Versão</div>
        <div class="bc-nota">
          Tudo nasce ligado. As marcadas com <span class="bc-losango">◆</span>
          alimentam o <b>Mapa da mudança</b> — desligá-las apaga formatos do mapa
          nas Versões criadas daí em diante.
        </div>
        <div class="bc-interruptores" id="bc-interruptores"></div>
      </div>

      <div class="bc-bloco">
        <div class="bc-bloco-h">Arquivos grandes no Mapa</div>
        <div class="bc-nota">
          Um arquivo muito maior que os outros vira um bloco que engole o
          desenho inteiro e não informa nada — foi o que aconteceu com o banco
          do Embedding Semântico, de quase 10 MB.
        </div>
        <div class="bc-grandes-linha">
          <span>Considerar grande a partir de</span>
          <input type="number" class="bc-num" id="bc-limiar" min="0" step="1">
          <span>MB</span>
        </div>
        <div class="bc-grandes-linha">
          <label class="bc-interruptor">
            <input type="radio" name="bc-modo-grande" value="teto">
            <span>Entra no desenho, mas <b>limitado</b> a</span>
          </label>
          <input type="number" class="bc-num" id="bc-teto" min="1" max="100" step="1">
          <span>% da área</span>
        </div>
        <div class="bc-grandes-linha">
          <label class="bc-interruptor">
            <input type="radio" name="bc-modo-grande" value="fora">
            <span><b>Não é representado</b> — some do desenho, e o rodapé diz quantos ficaram de fora</span>
          </label>
        </div>
        <div class="bc-grandes-lista" id="bc-grandes-lista"></div>
        <div class="bc-aviso-firme">
          Isto <b>não muda o que a cópia guarda</b>. A cópia leva tudo, sempre —
          aqui só se decide como o arquivo grande <i>aparece</i> no Mapa da mudança.
        </div>
      </div>

      <div class="bc-bloco">
        <div class="bc-bloco-h">O que acontece quando você reverte</div>
        <div class="bc-nota">
          Só informação — não se configura porque depende da natureza da coisa,
          não de preferência.
        </div>
        <div id="bc-naturezas"></div>
      </div>

      <div class="bc-bloco">
        <div class="bc-bloco-h">Onde as Versões ficam</div>
        <div id="bc-onde">…</div>
      </div>

    </div>`;
}

// ── Os blocos que vêm do back-end ────────────────────────────────────────────

async function bcMontarBlocosDinamicos() {
  bcDesenharLista();
  bcDesenharInterruptores();
  bcDesenharGrandes();
  bcDesenharListaDeGrandes();

  const naturezas = await window.pywebview.api.naturezas_da_reversao(currentProject);
  const acoes = {
    'volta': ['volta', 'ok'],
    'nao-volta': ['não volta', 'neutro'],
    'nao-volta-nem-apaga': ['não volta, e nada é apagado', 'neutro'],
    'zera': ['zera', 'aviso'],
  };
  document.getElementById('bc-naturezas').innerHTML =
    naturezas.naturezas.map(n => {
      const [texto, classe] = acoes[n.acao] || [n.acao, 'neutro'];
      return `
        <div class="bk-natureza">
          <span class="bk-natureza-nome">${escapeHtml(n.rotulo)}</span>
          <span class="bk-natureza-acao ${classe}">${texto}</span>
          <span class="bk-natureza-porque">
            ${escapeHtml(n.explicacao)}<br>
            <span class="bc-caminhos">${n.caminhos.map(escapeHtml).join(' · ')}</span>
          </span>
        </div>`;
    }).join('') + `
      <div class="bk-natureza generica">
        <span class="bk-natureza-porque">${escapeHtml(naturezas.regra_generica)}</span>
      </div>`;

  const onde = await window.pywebview.api.onde_as_versoes_ficam(currentProject);
  document.getElementById('bc-onde').innerHTML = `
    <pre class="bc-arvore">${escapeHtml(onde.pasta)}
  arquivos\\{aa}\\{hash}   ← cada arquivo, uma vez só, pelo hash do conteúdo
  versoes.json            ← a lista de Versões
  configuracao.json       ← esta tela</pre>
    <div class="bc-numeros">
      <span><b>${onde.versoes}</b> Versões</span>
      <span><b>${bkFormatarTamanho(onde.no_disco)}</b> no disco</span>
      <span><b>${bkFormatarTamanho(onde.economizado)}</b> economizados por não recopiar</span>
    </div>`;

  bcPedirNumeros();
}

// Os números vêm do mesmo resumo que o modal usa, e ele agora é ASSÍNCRONO —
// varrer o projeto e hashear mil arquivos não pode segurar a tela.
function bcPedirNumeros() {
  const info = document.getElementById('bc-codigo-info');
  if (info) info.textContent = 'medindo…';
  window.pywebview.api.resumo_para_copiar(currentProject);
}

function bcAplicarNumeros(r) {
  if (!r || !r.success) return;
  const info = document.getElementById('bc-codigo-info');
  const rodape = document.getElementById('bc-rodape');
  if (info) {
    info.textContent =
      `${bkFormatarTamanho(r.tamanhos.com_a_lista)} entram na cópia · ` +
      `${bkFormatarTamanho(r.tamanhos.fora_da_copia)} ficam de fora pela lista abaixo`;
  }
  if (rodape && bcConfiguracao) {
    rodape.innerHTML =
      `<span><b>${bcConfiguracao.exclusoes.length}</b> itens na lista</span>` +
      `<span><b>${bkFormatarTamanho(r.tamanhos.fora_da_copia)}</b> fora de cada cópia</span>` +
      `<span><b>${bkFormatarTamanho(r.tamanhos.com_a_lista)}</b> o que a cópia leva</span>`;
  }
}

function bcDesenharLista() {
  const alvo = document.getElementById('bc-lista');
  if (!alvo) return;
  if (!bcConfiguracao.exclusoes.length) {
    alvo.innerHTML = '<div class="bc-vazio">Nada excluído — a cópia leva as pastas de trabalho inteiras.</div>';
    return;
  }
  alvo.innerHTML = bcConfiguracao.exclusoes.map((item, i) => `
    <div class="bc-item">
      <span class="bc-item-caminho">${escapeHtml(item.path || item)}</span>
      <button class="bk-icon-btn danger" data-i="${i}" title="Tirar da lista">✕</button>
    </div>`).join('');
  alvo.querySelectorAll('button[data-i]').forEach(b => {
    b.addEventListener('click', () => {
      bcConfiguracao.exclusoes.splice(Number(b.dataset.i), 1);
      bcSalvar();
    });
  });
}

function bcDesenharInterruptores() {
  const alvo = document.getElementById('bc-interruptores');
  if (!alvo) return;
  alvo.innerHTML = bcPartes.map(p => `
    <label class="bc-interruptor">
      <input type="checkbox" data-parte="${p.id}"
        ${bcConfiguracao.documentacao[p.id] !== false ? 'checked' : ''}>
      <span>${escapeHtml(p.rotulo)}</span>
      ${p.mapa ? '<span class="bc-losango" title="alimenta o Mapa da mudança">◆</span>' : ''}
    </label>`).join('');

  alvo.querySelectorAll('input[data-parte]').forEach(el => {
    el.addEventListener('change', () => {
      bcConfiguracao.documentacao[el.dataset.parte] = el.checked;
      bcSalvar(false);
    });
  });
}

function bcDesenharGrandes() {
  const g = bcConfiguracao.grandes || {};
  const limiar = document.getElementById('bc-limiar');
  const teto = document.getElementById('bc-teto');
  if (!limiar || !teto) return;
  limiar.value = g.limiar_mb ?? 2;
  teto.value = g.teto_por_cento ?? 12;
  document.querySelectorAll('input[name="bc-modo-grande"]').forEach(el => {
    el.checked = el.value === (g.modo || 'teto');
  });
}

// A lista do que hoje conta como grande — caminho, tamanho e **metade**.
//
// ⚠️ A METADE É O DADO QUE FALTAVA. Sem ela a regra era invisível: no projeto
// de teste os dois arquivos acima do limiar estão os dois em Documentação, e
// quem estivesse olhando a metade Código no Mapa mexia no teto, no limiar, e
// continuava não vendo nada — porque não havia nada para ver ali. Uma
// configuração cujo efeito não se consegue conferir é uma configuração que
// parece quebrada.
async function bcDesenharListaDeGrandes() {
  const alvo = document.getElementById('bc-grandes-lista');
  if (!alvo) return;
  alvo.innerHTML = '<div class="bc-vazio">Conferindo…</div>';
  let r;
  try {
    r = await window.pywebview.api.listar_arquivos_grandes(currentProject);
  } catch (e) { r = null; }

  if (!r || !r.success) { alvo.innerHTML = ''; return; }
  if (!r.grandes.length) {
    alvo.innerHTML = `<div class="bc-vazio">Nenhum arquivo passa de ${r.limiar_mb} MB hoje —
      esta configuração não está mudando nada no desenho.</div>`;
    return;
  }
  alvo.innerHTML = `
    <div class="bc-grandes-h">${r.grandes.length} arquivo(s) acima de ${r.limiar_mb} MB agora:</div>
    ${r.grandes.map(g => `
      <div class="bc-grande-item">
        <span class="bc-grande-tam">${(g.bytes / 1048576).toFixed(1).replace('.', ',')} MB</span>
        <span class="bc-grande-metade">${g.metade === 'codigo' ? 'Código' : 'Documentação'}</span>
        <span class="bc-item-caminho" title="${escapeHtml(g.caminho)}">${escapeHtml(g.caminho)}</span>
      </div>`).join('')}`;
}

// ── Arrastar e soltar ────────────────────────────────────────────────────────

function bcLigarEventos() {
  const solta = document.getElementById('bc-solta');
  if (!solta) return;

  // ⚠️ `setupDropZoneMulti`, e NÃO um handler próprio. A versão anterior lia
  // `ev.dataTransfer.files[].path`, que é `undefined` no WebView2 — arrastar
  // uma pasta não fazia nada, em silêncio. O `drag-drop.js` tem a cascata dos
  // cinco métodos (WebView2 nativo → `file.path` → `uri-list` → `text/plain` →
  // seleção do Explorer via PowerShell) justamente porque só ela funciona aqui.
  setupDropZoneMulti(solta, async (itens) => {
    bcAcrescentar((itens || []).map(i => i.path).filter(Boolean));
  });

  document.getElementById('bc-escolher').addEventListener('click', async () => {
    try {
      const r = await window.pywebview.api.browse_path('folder');
      if (r && r.success && r.path) bcAcrescentar([r.path]);
    } catch (e) { showToast('Não foi possível abrir o seletor.', true); }
  });

  const mudou = () => {
    bcConfiguracao.grandes = {
      limiar_mb: Number(document.getElementById('bc-limiar').value) || 0,
      teto_por_cento: Number(document.getElementById('bc-teto').value) || 12,
      modo: (document.querySelector('input[name="bc-modo-grande"]:checked') || {}).value || 'teto',
    };
    bcSalvar(false);
  };
  ['bc-limiar', 'bc-teto'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', mudou);
  });
  document.querySelectorAll('input[name="bc-modo-grande"]')
    .forEach(el => el.addEventListener('change', mudou));
}

function bcAcrescentar(caminhos) {
  const jaTem = new Set(bcConfiguracao.exclusoes.map(i => i.path || i));
  let novos = 0;
  caminhos.forEach(c => {
    if (!c || jaTem.has(c)) return;
    bcConfiguracao.exclusoes.push({ path: c });
    jaTem.add(c);
    novos++;
  });
  if (novos) {
    showToast(novos === 1 ? '1 item acrescentado à lista.' : `${novos} itens acrescentados.`);
    bcSalvar();
  }
}

async function bcSalvar(redesenhar = true) {
  try {
    await window.pywebview.api.salvar_configuracao_do_backup(currentProject, bcConfiguracao);
    // `bcMontarBlocosDinamicos` redesenha a lista, os interruptores e os
    // números — que mudam sempre que a lista muda.
    if (redesenhar) await bcMontarBlocosDinamicos();
    else bcPedirNumeros();
    // O limiar muda quem entra na lista, então ela é refeita a cada gravada.
    bcDesenharListaDeGrandes();
  } catch (e) {
    showToast('Não foi possível salvar a configuração do backup.', true);
  }
}
