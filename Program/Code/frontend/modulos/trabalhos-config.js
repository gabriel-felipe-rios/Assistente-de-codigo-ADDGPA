// ═══ TRABALHOS → sub-aba Configuração ══════════════════════════════════════
//
// Três painéis: o que eles nunca podem fazer (Bloqueio), onde podem mexer, e
// quando param para te chamar (Portão) — mais os limites.
//
// ⚠️ NENHUMA LISTA É ESCRITA AQUI. Bloqueios, gatilhos e limites chegam do
// backend, que os lê de `catalogo_trabalhos.py`. É a mesma fonte que monta o
// system prompt do agente e que a conferência consulta para recusar comando.
// Escrever a lista neste arquivo criaria a cópia que diverge — e o sintoma
// seria a tela prometendo uma regra que o programa não aplica.
//
// ⚠️ NÃO EXISTE "ABRIR EXCEÇÃO" DE PASTA, e a ausência é a decisão. A pasta
// liberada é a do projeto ativo, e só ela — sem interruptor, sem exceção
// configurável. É a única trava 100% dura do desenho; um botão aqui a
// desfaria inteira.
//
// ⚠️ O PRIMEIRO GATILHO NÃO DESLIGA. "Tentou um comando da lista de bloqueio"
// vem com cadeado no lugar do interruptor. Não é preferência do usuário: é a
// trava, e o backend a reafirma mesmo que o arquivo de configuração diga o
// contrário.

let trConfig = null;

async function initTrabalhosConfig() {
  const painel = document.getElementById('trsub-config');
  if (!painel || !currentProject) return;
  painel.innerHTML = '<div class="screen-body"><div class="tr-carregando">Carregando…</div></div>';
  try {
    const r = await window.pywebview.api.carregar_config_dos_trabalhos(currentProject);
    if (!r.success) { painel.innerHTML = `<div class="screen-body"><div class="tr-erro">${escapeHtml(r.error)}</div></div>`; return; }
    trConfig = r;
    painel.innerHTML = `<div class="screen-body">${tcMarcacao(r)}</div>`;
    tcLigarEventos();
  } catch (e) {
    painel.innerHTML = `<div class="screen-body"><div class="tr-erro">${escapeHtml(String(e))}</div></div>`;
  }
}

function tcComandos(lista) {
  if (!lista || !lista.length) return '';
  return `<span class="tr-cmd">${lista.map(escapeHtml).join(' · ')}</span>`;
}

function tcMarcacao(r) {
  const { valores, catalogo } = r;

  const duros = catalogo.bloqueios_duros.map(b => `
    <div class="tr-proib">
      <span>${escapeHtml(b.rotulo)} ${tcComandos(b.comandos)}</span>
      <span class="tr-selo-bloq">bloqueado</span>
    </div>`).join('');

  const comInterruptor = catalogo.bloqueios_com_interruptor.map(b => `
    <div class="tr-proib">
      <span>${escapeHtml(b.rotulo)} ${tcComandos(b.comandos)}</span>
      <input type="checkbox" class="tr-sw" data-chave="trabalhos_bloqueio_${escapeHtml(b.id)}"
             ${valores['trabalhos_bloqueio_' + b.id] ? 'checked' : ''}>
    </div>`).join('');

  const gatilhos = catalogo.gatilhos.map(g => {
    const chave = 'trabalhos_portao_' + g.id;
    const controle = g.fixo
      ? '<span class="tr-selo-trava" title="Não desliga — é a trava, não uma preferência">🔒</span>'
      : `<input type="checkbox" class="tr-sw" data-chave="${escapeHtml(chave)}" ${valores[chave] ? 'checked' : ''}>`;
    return `<div class="tr-linha"><span>${escapeHtml(g.rotulo)}</span>${controle}</div>`;
  }).join('');

  const editaveis = catalogo.limites_editaveis.map(l => `
    <div class="tr-linha">
      <span>${escapeHtml(l.rotulo)} <span class="tr-dica">de ${l.minimo} a ${l.maximo}</span></span>
      <input type="number" class="tr-num" min="${l.minimo}" max="${l.maximo}"
             data-chave="trabalhos_limite_${escapeHtml(l.id)}"
             value="${valores['trabalhos_limite_' + l.id]}">
    </div>`).join('');

  const fixos = catalogo.limites_fixos.map(l => `
    <div class="tr-linha">
      <span>${escapeHtml(l.rotulo)}</span>
      <span class="${l.grave ? 'tr-grave' : 'tr-dim'}">${escapeHtml(l.valor)}</span>
    </div>`).join('');

  return `
    <div class="tr-cabecalho">
      <div>
        <h2>Configuração</h2>
        <div class="tr-sub">O que eles nunca podem fazer, e os limites dos Trabalhos</div>
      </div>
      <div class="tr-cab-botoes">
        <button class="btn btn-muted btn-sm" id="tc-btn-global"
                title="Grava os valores atuais como padrão de todo projeto">Valer para todo projeto</button>
        <button class="btn btn-muted btn-sm" id="tc-btn-restaurar">Restaurar padrão</button>
      </div>
    </div>

    <p class="tr-nota">
      Tudo nesta tela entra no <b>system prompt</b> uma única vez, no começo da sessão de
      cada terminal — não é reenviado a cada mensagem. É o que preserva o cache e evita
      gastar cota repetindo o mesmo aviso.
    </p>

    <div class="tr-paineis">
      <div class="tr-painel tr-painel-perigo">
        <h3 class="tr-h3-perigo">Sempre bloqueado
          <span class="tr-dica">sem interruptor — só o que dá pra recusar sem julgar intenção</span></h3>
        ${duros}
        <p class="tr-nota">
          Bloqueio <b>vence permissão</b>: mesmo no modo em que o assistente não pergunta
          nada, um comando desta lista é recusado. Quem recusa é o programa — o comando não
          chega a rodar, e a atividade vira cartão em “Precisa de você”.
        </p>
        <p class="tr-nota">
          <b>Apagar em massa e rodar script fora do briefing não estão aqui</b> — não dá para
          recusar isso deterministicamente (é refactor legítimo, ou é desastre?). Fica com o
          julgamento do agente, cercado pela pasta restrita e pelo backup manual.
        </p>
      </div>

      <div class="tr-painel">
        <h3>Bloqueado por padrão
          <span class="tr-dica">com interruptor, por projeto — todos desligados de fábrica</span></h3>
        ${comInterruptor}
        <p class="tr-nota">
          Desligado = recusado, igual ao painel ao lado. O interruptor <b>libera</b>; ele não
          avisa. “Mexer no próprio programa” não entra na lista: já está coberto por onde
          eles podem mexer.
        </p>
      </div>
    </div>

    <div class="tr-painel">
      <h3>Onde eles podem mexer</h3>
      <div class="tr-linha"><span>A pasta raiz configurada em Projeto → Trabalho</span><span class="tr-dim">ler e escrever</span></div>
      <div class="tr-linha"><span>Qualquer coisa fora dela</span><span class="tr-grave">nenhum acesso</span></div>
      <div class="tr-linha"><span class="tr-mono">Trabalhos/</span><span class="tr-dim">ler e escrever</span></div>
      <div class="tr-linha"><span>Pastas ignoradas do projeto</span><span class="tr-dim">invisíveis</span></div>
      <p class="tr-nota">
        Não há lista para montar, e <b>não há exceção para abrir</b>: é a pasta do projeto em
        que você está, e só ela. Esta é a única trava do desenho que não tem interruptor
        nenhum — nem aqui, nem em outro lugar.
      </p>
    </div>

    <div class="tr-paineis">
      <div class="tr-painel">
        <h3>Quando me chamar <span class="tr-dica">tudo que não estiver aqui, ele resolve</span></h3>
        ${gatilhos}
        <p class="tr-nota">A primeira linha é fixa e não desliga — é a trava, não uma preferência.</p>
      </div>

      <div class="tr-painel">
        <h3>Limites dos Trabalhos</h3>
        ${editaveis}
        ${fixos}
        <p class="tr-nota">
          Backup não é automático — é você quem roda, pela aba Backups, antes de deixar os
          terminais trabalhando. Se algo sair errado, é o caminho de volta.
        </p>
      </div>
    </div>

    <div class="tr-painel">
      <h3>Agentes <span class="tr-dica">mudou de lugar</span></h3>
      <p class="tr-nota">
        O assistente externo — qual é, com que comando ele abre e para onde os agentes
        dele são copiados — se configura na aba <b>Arquivos</b>, em
        <b>Agentes › Assistentes externos</b>. É <b>global</b>: vale para todo projeto.
      </p>
      <p class="tr-nota">
        Os <b>modos de terminal</b> deixaram de existir. Quem faz aquele papel hoje é o
        arquivo <code>.md</code> do agente, que o assistente externo lê de dentro do
        projeto — e é só por esse caminho que o campo <code>tools</code> dele limita
        alguma coisa de verdade.
      </p>
    </div>`;
}

function tcLigarEventos() {
  const painel = document.getElementById('trsub-config');
  if (!painel) return;

  painel.querySelectorAll('.tr-sw').forEach(sw => {
    sw.addEventListener('change', () => tcGravar({ [sw.dataset.chave]: sw.checked }));
  });
  painel.querySelectorAll('.tr-num').forEach(campo => {
    campo.addEventListener('change', () => tcGravar({ [campo.dataset.chave]: campo.value }));
  });

  document.getElementById('tc-btn-restaurar').addEventListener('click', async () => {
    const r = await window.pywebview.api.restaurar_config_dos_trabalhos(currentProject);
    if (!r.success) { showToast(r.error, true); return; }
    showToast('Configuração deste projeto voltou ao padrão.');
    initTrabalhosConfig();
  });

  document.getElementById('tc-btn-global').addEventListener('click', async () => {
    const r = await window.pywebview.api.salvar_padrao_dos_trabalhos(tcValoresDaTela());
    if (!r.success) { showToast(r.error, true); return; }
    showToast('Estes valores passam a ser o padrão de todo projeto.');
  });
}

// O que está na tela agora, pronto para virar padrão global. Lê do DOM, e não
// de `trConfig`, porque o usuário pode ter mexido em vários interruptores
// desde a carga — e o global tem que gravar o que ele está vendo.
function tcValoresDaTela() {
  const painel = document.getElementById('trsub-config');
  const valores = {};
  painel.querySelectorAll('.tr-sw').forEach(sw => { valores[sw.dataset.chave] = sw.checked; });
  painel.querySelectorAll('.tr-num').forEach(c => { valores[c.dataset.chave] = c.value; });
  return valores;
}

async function tcGravar(patch) {
  const r = await window.pywebview.api.salvar_config_dos_trabalhos(currentProject, patch);
  if (!r.success) {
    showToast(r.error, true);
    // A gravação falhou, então a tela está mostrando um estado que o disco não
    // tem. Recarregar é o que impede o usuário de sair achando que ligou algo
    // que continua desligado.
    initTrabalhosConfig();
    return;
  }
  trConfig.valores = r.valores;
}
