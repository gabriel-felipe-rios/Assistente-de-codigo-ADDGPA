// ═══ TRABALHOS → Oficina: AS AÇÕES ════════════════════════════════════════
//
// O que o usuário MANDA acontecer: criar, ligar, desligar, agrupar, desagrupar,
// duplicar, excluir — mais a barra contextual e os atalhos de teclado, que são
// as duas portas de entrada dessas mesmas ações.
//
// A divisa com `trabalhos-oficina-edicao.js` é: **aqui se mexe no CONJUNTO, lá
// se mexe no CONTEÚDO de um.** Excluir três nós é ação; renomear um é edição.
//
// ⚠️ QUASE TUDO AQUI VAI AO BACKEND E DEPOIS RECARREGA (`ofiCarregar()`). Não é
// desperdício: o estado da Oficina mora no `Layout.json`, e a tela é um retrato
// dele. Atualizar só o DOM depois de gravar criaria uma segunda verdade, e ela
// discordaria no primeiro erro de gravação — mostrando na tela um nó que o
// disco não tem.
//
// ⚠️ A BARRA CONTEXTUAL É REPINTADA A CADA MUDANÇA DE SELEÇÃO, e por isso ela
// nunca guarda estado próprio. Qualquer coisa que ela precise saber sai de
// `ofiSelecao`, `ofiGrupoSel` ou `ofiLigacaoSel` na hora de pintar.

// ── Ações ───────────────────────────────────────────────────────────────────

async function ofiCriar(tipo, opcoes) {
  // Nasce no meio da área visível, e não numa posição fixa: com o canvas
  // deslocado, um nó em (40,40) do mundo pode nascer fora da tela.
  const canvas = document.getElementById('ofi-canvas').getBoundingClientRect();
  const centro = ofiParaMundo(canvas.left + canvas.width / 2 - 130,
                              canvas.top + canvas.height / 3);
  const o = opcoes || {};
  const r = await window.pywebview.api.criar_no(currentProject, tipo, o.nome || '', '',
                                                o.papel || null, null,
                                                centro.x, centro.y, null,
                                                o.produto || null, o.modo || null);
  if (!r.success) { showToast(r.error, true); return; }
  // ⚠️ O TERMINAL ABRE NA CRIAÇÃO, e não na primeira linha digitada. Foi o
  // pedido, e é o que um terminal faz: *"assim que eu cliquei no botão de novo
  // terminal, já é pra abrir"*. É também quando o modo entra digitado — esperar
  // pela primeira linha deixaria um "Orquestrador" que é só um `cmd.exe` até
  // alguém apertar uma tecla.
  //
  // ⚠️ MAS O DESENHO VEM PRIMEIRO, e a inversão é a correção de um defeito, não
  // uma troca de gosto. Abrindo o processo antes de a tela existir, ele nascia
  // com o tamanho padrão do backend e imprimia o prompt numa grade que não é a
  // do cartão — ver `trShAbrirQuandoMedido`, que explica a conta. Desenhar
  // primeiro custa um quadro; o prompt sai certo já na primeira impressão.
  await ofiCarregar();
  if (tipo === 'terminal' && r.no) {
    const abriu = typeof trShAbrirQuandoMedido === 'function'
      ? await trShAbrirQuandoMedido(r.no.id)
      : await window.pywebview.api.abrir_shell(currentProject, r.no.id);
    if (!abriu.success) showToast(abriu.error, true);
  }
}

// ⚠️ O AGENTE NASCE DE UM PRESET, e não de um menu de papéis cru. O preset é
// onde o usuário já disse nome, papel, prompt fixo e regra de dependência —
// oferecer "orquestrador / subagente" aqui obrigaria a reconfigurar tudo isso
// em cada nó, que é o oposto do que os presets existem para resolver.
//
// ⚠️ E ELE É CONFIGURADO EM CONFIGURAÇÕES › AGENTES, não aqui. Este popover só
// ESCOLHE — é decisão do usuário: *"ali dentro de configurações é só pra
// configurar; os terminais eu coloco na Oficina"*. Um botão de editar preset
// aqui dentro seria a configuração voltando para a tela de uso.
async function ofiFalarCom(id, texto) {
  const r = await window.pywebview.api.enviar_mensagem_ao_terminal(currentProject, id, texto);
  if (!r.success) { showToast(r.error, true); return; }
  ofiCarregar();
}

function ofiAtualizarBarraContextual() {
  const barra = document.getElementById('ofi-barra-ctx');
  if (!barra) return;
  const n = ofiSelecao.size;
  const botoes = ['editar', 'colorir', 'agrupar', 'desagrupar',
                  'conectar', 'desconectar', 'duplicar', 'excluir'];

  // ⚠️ A BARRA TAMBÉM APARECE COM UM FIO SELECIONADO. Antes ela só olhava para
  // `ofiSelecao`, que é de NÓS: clicando numa ligação o usuário a via
  // destacada e não tinha botão nenhum para apagá-la — só a tecla Delete, que
  // ninguém adivinha. Com um fio escolhido só "Excluir" faz sentido: colorir,
  // agrupar e duplicar são gestos de nó.
  // ⚠️ O RAMO DO GRUPO VEM PRIMEIRO, e a ordem importa: as três seleções são
  // exclusivas, mas testar `ofiSelecao` antes esconderia a barra do grupo no
  // instante em que ela deveria aparecer.
  if (!n && ofiGrupoSel) {
    barra.classList.remove('hidden');
    const g = ofiGrupos.find(x => x.id === ofiGrupoSel);
    document.getElementById('ofi-ctx-quantos').textContent =
      `Grupo "${(g && g.rotulo) || 'sem nome'}" — Excluir desfaz só a caixa:`;
    // Renomear, colorir e desfazer. Agrupar, conectar e duplicar são gestos de
    // NÓ: um grupo não se liga a nada nem se duplica, e agrupar um grupo dentro
    // de outro é o que a geometria já resolve — basta arrastar a caixa.
    botoes.forEach(k => {
      document.getElementById('ofi-ctx-' + k).disabled =
        !['editar', 'colorir', 'excluir'].includes(k);
    });
    return;
  }

  if (!n && ofiLigacaoSel) {
    barra.classList.remove('hidden');
    const lig = ofiLigacoes.find(l => l.id === ofiLigacaoSel);
    const tipo = lig ? (ofiTipoDeLigacao(lig.tipo) || {}) : {};
    document.getElementById('ofi-ctx-quantos').textContent =
      'Ligação selecionada' + (tipo.rotulo ? ` (${tipo.rotulo}):` : ':');
    botoes.forEach(k => {
      document.getElementById('ofi-ctx-' + k).disabled = (k !== 'excluir');
    });
    return;
  }

  barra.classList.toggle('hidden', n === 0);
  if (!n) return;
  // O ramo do fio desliga quase tudo; voltando ao caso dos nós, tudo religa
  // antes das regras específicas abaixo.
  botoes.forEach(k => { document.getElementById('ofi-ctx-' + k).disabled = false; });
  document.getElementById('ofi-ctx-quantos').textContent =
    n === 1 ? 'Com 1 selecionado:' : `Com ${n} selecionados:`;
  document.getElementById('ofi-ctx-editar').disabled = n !== 1;

  // ⚠️ CONECTAR EXIGE EXATAMENTE DOIS NÓS. Ele já teve uma segunda forma, com
  // UM nó selecionado: a triangulação, que ligava um nó a uma LIGAÇÃO. Com ela
  // fora, toda ligação liga duas pontas, e um nó sozinho não tem o que ligar.
  document.getElementById('ofi-ctx-conectar').disabled = n !== 2;
  document.getElementById('ofi-ctx-desconectar').disabled =
    !ofiLigacoes.some(l => ofiSelecao.has(l.de) || ofiSelecao.has(l.para));
}

// ⚠️ O BOTÃO "EDITAR" LEVA À EDIÇÃO NO LUGAR, e não a uma caixa de diálogo.
// Era o último `prompt()` de verdade do arquivo, e no WebView2 ele devolve
// `null`: o botão abria o diálogo do navegador e não gravava nada. Levar ao
// mesmo gesto dos dois cliques mantém um caminho só para renomear.
function ofiEditarSelecionado() {
  // Com a caixa selecionada, "Editar" é renomear o grupo — o mesmo que o duplo
  // clique no rótulo faz, pela mesma porta.
  if (ofiGrupoSel) {
    const rot = document.querySelector(`#ofi-grupos [data-grupo="${ofiGrupoSel}"]`);
    if (rot) ofiRenomearGrupo(rot);
    return;
  }
  const id = [...ofiSelecao][0];
  const no = ofiNos.find(n => n.id === id);
  if (!no) return;
  // A nota abre o CORPO, e não o título: é o que se quer editar nela. A
  // assinatura é `ofiEditarNota(idNo)` — ele acha o cartão sozinho.
  if (no.tipo === 'nota') return ofiEditarNota(id);
  const alvo = document.querySelector(`#ofi-nos [data-no="${id}"][data-editar]`);
  if (!alvo) { showToast('Dois cliques no nome do cartão para renomear.'); return; }
  ofiEditarNoLugar(alvo, id, alvo.dataset.editar);
}

let ofiTecladoLigado = false;

function ofiLigarTeclado() {
  if (ofiTecladoLigado) return;
  ofiTecladoLigado = true;
  // ⚠️ O Ctrl+Z SAIU daqui e virou registro (`modulos/teclas.js`, logo abaixo);
  // o Delete FICOU. Os dois moravam neste mesmo listener e não são a mesma
  // coisa: o Delete é tecla de GESTO — depende do que está selecionado no
  // canvas —, e por isso não entra na tela de Teclado nem vira configurável.
  // As guardas abaixo continuam sendo dele.
  document.addEventListener('keydown', e => {
    const painel = document.getElementById('trsub-oficina');
    if (!painel || !painel.classList.contains('active')) return;
    // Digitando num campo ou renomeando um nó, as teclas são do texto.
    const alvo = e.target;
    if (alvo && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName))) return;
    // ⚠️ `:not(.hidden)` NÃO É ZELO — é o que faz o Delete existir. O
    // `index.html` traz uma dúzia de `.modal-overlay hidden` montados de
    // fábrica, então `querySelector('.modal-overlay')` acha um SEMPRE, com ou
    // sem modal aberto: a tecla saía daqui antes de fazer nada, e o sintoma era
    // "Delete não apaga, só o botão Excluir apaga". O mesmo valia para o Ctrl+Z.
    if (document.querySelector('.modal-overlay:not(.hidden)')) return;

    if ((e.key === 'Delete' || e.key === 'Backspace')) {
      if (ofiLigacaoSel) { e.preventDefault(); return ofiApagarLigacaoSelecionada(); }
      if (ofiSelecao.size) { e.preventDefault(); return ofiExcluirSelecionados(); }
      return;
    }
  });

  registrarTecla({
    id: 'oficina.desfazer', rotulo: 'Desfazer', grupo: 'Trabalhos › Oficina',
    onde: 'trsub-oficina', padrao: 'Ctrl+Z', icone: '↶',
    fazer: async () => {
      const r = await window.pywebview.api.desfazer_oficina(currentProject);
      if (!r.success) { showToast(r.error, !r.vazio); return; }
      ofiLigacaoSel = null;
      await ofiCarregar();
      showToast('Desfeito.');
    },
  });
}

async function ofiApagarLigacaoSelecionada() {
  const id = ofiLigacaoSel;
  if (!id) return;
  const r = await window.pywebview.api.desconectar(currentProject, [id]);
  if (!r.success) { showToast(r.error, true); return; }
  ofiLigacaoSel = null;
  await ofiCarregar();
  showToast('Ligação desfeita. Ctrl+Z desfaz.');
}

// ── Ligar e desligar ────────────────────────────────────────────────────────
//
// ⚠️ MODAL, E NÃO `prompt()`. O `prompt()` do WebView2 não tem como mostrar o
// que cada tipo faz, e escolher entre "dependência" e "mão única" sem ler a
// diferença é escolher no escuro — as duas parecem a mesma seta. O modal padrão
// do projeto (`abrirModalPadrao`) é o mesmo de Arquivos, Preparar e Tags.

function ofiConectar() {
  if (ofiSelecao.size === 2) return ofiModalDeLigacao();
}

function ofiModalDeLigacao() {
  const [a, b] = [...ofiSelecao];
  const opcoes = ofiTiposDeLigacao.map(t =>
    `<option value="${escapeHtml(t.id)}">${escapeHtml(t.rotulo)} — ${escapeHtml(t.descricao)}</option>`).join('');

  const overlay = abrirModalPadrao({
    title: 'Ligar dois nós',
    confirmLabel: 'Ligar',
    bodyHtml: `
      <div class="modal-body-text">
        Uma ligação <strong>não é desenho</strong>: ela muda o que acontece com os
        processos dos dois nós.
      </div>
      <label>O que essa ligação faz</label>
      <select class="modal-select" id="ofi-lig-tipo">${opcoes}</select>
      <label>Sentido</label>
      <select class="modal-select" id="ofi-lig-sentido">
        <option value="ab">${escapeHtml(ofiNomeDoNo(a))} → ${escapeHtml(ofiNomeDoNo(b))}</option>
        <option value="ba">${escapeHtml(ofiNomeDoNo(b))} → ${escapeHtml(ofiNomeDoNo(a))}</option>
      </select>
      <div class="modal-dica" id="ofi-lig-dica"></div>`,
    onConfirm: async (ov, showErr) => {
      const tipo = ov.querySelector('#ofi-lig-tipo').value;
      const inverso = ov.querySelector('#ofi-lig-sentido').value === 'ba';
      const r = await window.pywebview.api.conectar_nos(
        currentProject, tipo, inverso ? b : a, inverso ? a : b);
      if (!r.success) { showErr(r.error); return false; }
      ofiSelecao.clear();
      ofiCarregar();
    },
  });

  // A dica muda com o tipo porque "de → para" quer dizer coisas diferentes em
  // cada um: numa é ordem, noutra é quem escreve o arquivo.
  const dicas = {
    'dependencia': 'A origem precisa entregar antes de o destino disparar. O destino fica '
                 + 'em "aguardando dependência" e sai sozinho quando a origem terminar bem.',
    'mao-unica': 'A origem grava o que produziu num arquivo, e o destino recebe o caminho '
               + 'dele na próxima vez que rodar. Não faz o destino começar — para isso, '
               + 'crie também uma dependência.',
    'ida-e-volta': 'Cada lado aciona o outro quando termina, com teto de rodadas '
                 + '(Configuração → Limites). Aqui o sentido só define o desenho: os dois '
                 + 'lados escrevem e leem.',
  };
  const tipoSel = overlay.querySelector('#ofi-lig-tipo');
  const dica = overlay.querySelector('#ofi-lig-dica');
  const pintar = () => { dica.textContent = dicas[tipoSel.value] || ''; };
  tipoSel.addEventListener('change', pintar);
  pintar();
}

async function ofiDesconectar() {
  const ids = [...ofiSelecao];
  const r = await window.pywebview.api.resumo_das_ligacoes_dos_nos(currentProject, ids);
  if (!r.success) { showToast(r.error, true); return; }
  if (!r.ligacoes.length) { showToast('Nada ligado a esta seleção.'); return; }

  // A regra do projeto é que toda remoção diga o que exatamente se perde, com
  // número. Aqui o que some junto é o arquivo de canal — e sem ele o outro lado
  // deixa de receber o que já tinha sido escrito.
  const comCanal = r.ligacoes.filter(l => l.tem_canal).length;
  const lista = r.ligacoes.map(l =>
    `<li><strong>${escapeHtml(l.tipo)}</strong> — ${escapeHtml(l.descricao)}</li>`).join('');

  abrirModalPadrao({
    title: r.ligacoes.length === 1 ? 'Desfazer esta ligação?' : `Desfazer ${r.ligacoes.length} ligações?`,
    confirmLabel: 'Desconectar',
    bodyHtml: `
      <div class="modal-body-text">
        Sai do canvas:
        <ul class="ofi-lista-lig">${lista}</ul>
        ${comCanal
          ? (comCanal === 1
              ? '<strong>1</strong> arquivo de canal é apagado junto — o que já tinha sido escrito nele se perde.'
              : `<strong>${comCanal}</strong> arquivos de canal são apagados junto — o que já tinha sido escrito neles se perde.`)
          : 'Nenhum arquivo de canal é apagado.'}
      </div>`,
    onConfirm: async (ov, showErr) => {
      const res = await window.pywebview.api.desconectar_nos(currentProject, ids);
      if (!res.success) { showErr(res.error); return false; }
      ofiCarregar();
    },
  });
}

// ── Agrupar ─────────────────────────────────────────────────────────────────

// ⚠️ SEM PERGUNTAR O NOME, e por dois motivos independentes.
//
// O primeiro é que o `prompt()` do WebView2 devolve `null` aqui: o diálogo
// aparece, o usuário digita, aperta OK — e a função cai no `return` da linha
// seguinte. O grupo simplesmente não nascia, sem erro nenhum na tela. O
// cabeçalho deste arquivo já dizia "NADA DE `prompt()`"; faltava cumprir.
//
// O segundo é o gesto. Agrupar é um clique, e o nome quase nunca importa na
// hora — quem quiser trocar dá dois cliques no rótulo depois. O backend já
// numera sozinho ("Grupo 1", "Grupo 2"…) quando o rótulo chega vazio, então
// não há regra nova aqui: só se para de atrapalhar a que já existia.
async function ofiAgrupar() {
  const ids = [...ofiSelecao];
  if (ids.length < 2) return;
  // A caixa nasce abraçando os escolhidos, que é o desenho que o gesto promete.
  // Daí em diante ela é DADO: esticar e encolher é com o usuário, e ela não
  // volta a se ajustar sozinha quando um membro se mexe.
  const moldura = ofiMolduraEmVolta(ofiCaixasParaAbracar(ids, ofiCaixasDosNos()));
  const caixa = moldura
    ? {x: moldura.x, y: moldura.y, largura: moldura.w, altura: moldura.h}
    : null;
  const r = await window.pywebview.api.agrupar_nos(currentProject, ids, '', null, caixa);
  if (!r.success) { showToast(r.error, true); return; }
  showToast('Agrupado. Dois cliques no rótulo trocam o nome.');
  ofiCarregar();
}

async function ofiDesfazerGrupoSelecionado() {
  if (!ofiGrupoSel) return;
  const r = await window.pywebview.api.desagrupar(currentProject, [ofiGrupoSel]);
  if (!r.success) { showToast(r.error, true); return; }
  ofiGrupoSel = null;
  showToast('Grupo desfeito.');
  ofiCarregar();
}

async function ofiDesagrupar() {
  const grupos = ofiGruposDaSelecao();
  if (!grupos.length) return;
  // Sem confirmação: desagrupar não apaga nada — os nós ficam onde estão, e o
  // gesto se desfaz com um Agrupar. Confirmar aqui seria atrito sem risco.
  // ⚠️ IDS, E NÃO OS OBJETOS. `ofiGruposDaSelecao` devolve os grupos inteiros,
  // e `desagrupar` faz `set(ids or [])` — um `set` de dicionários levanta
  // `TypeError: unhashable type: 'dict'`, que o `except` do backend engolia e
  // devolvia como erro genérico. Desagrupar nunca funcionou.
  const r = await window.pywebview.api.desagrupar(currentProject, grupos.map(g => g.id));
  if (!r.success) { showToast(r.error, true); return; }
  showToast(grupos.length === 1 ? 'Grupo desfeito.' : `${grupos.length} grupos desfeitos.`);
  ofiCarregar();
}

async function ofiDuplicarSelecionados() {
  for (const id of [...ofiSelecao]) {
    const r = await window.pywebview.api.duplicar_no(currentProject, id);
    if (!r.success) { showToast(r.error, true); return; }
  }
  ofiSelecao.clear();
  ofiCarregar();
}

// ⚠️ NENHUM CAMINHO DAQUI SAI CALADO. A versão anterior devolvia sem dizer
// nada quando a seleção estava vazia, e engolia qualquer falha da ponte: o
// sintoma para o usuário era "aperto Excluir e não acontece nada", sem pista
// nenhuma de por quê. Um botão que não faz E não explica é pior que um botão
// que falha.
// \u26a0\ufe0f EXCLUIR S\u00d3 PERGUNTA COM TERMINAL VIVO, e isto \u00e9 um recorte da exce\u00e7\u00e3o
// "com desfazer, excluir n\u00e3o pergunta" \u2014 n\u00e3o uma contradi\u00e7\u00e3o dela.
//
// Aquela exce\u00e7\u00e3o vale porque o Ctrl+Z traz o n\u00f3 de volta. S\u00f3 que ele traz o
// DESENHO: o processo que morreu junto n\u00e3o volta, e com ele vai a conversa
// inteira que estava rodando l\u00e1 dentro \u2014 que \u00e9 justamente o trabalho longo que
// esses terminais existem para segurar. N\u00f3 parado continua apagando direto, no
// gesto de sempre, porque ali o Ctrl+Z realmente desfaz tudo.
//
// Devolve `true` para seguir com a exclus\u00e3o.
function ofiConfirmarExclusao(ids) {
  const vivos = ids
    .map(id => ofiNos.find(n => n.id === id))
    .filter(n => n && n.aberto);
  if (!vivos.length) return Promise.resolve(true);

  const nomes = vivos.map(n => `<strong>${escapeHtml(n.nome || n.id)}</strong>`).join(', ');
  const um = vivos.length === 1;
  return new Promise(resolve => {
    let confirmou = false;
    const overlay = abrirModalPadrao({
      title: um ? 'Excluir um terminal que est\u00e1 rodando?'
                : 'Excluir terminais que est\u00e3o rodando?',
      confirmLabel: 'Excluir',
      bodyHtml: `<div class="modal-body-text">
        ${um ? 'Este terminal est\u00e1 aberto' : 'Estes terminais est\u00e3o abertos'}: ${nomes}.<br><br>
        O Ctrl+Z traz ${um ? 'o n\u00f3' : 'os n\u00f3s'} de volta, mas
        <strong>n\u00e3o a sess\u00e3o</strong> \u2014 o que estava rodando l\u00e1 dentro se perde,
        e a conversa junto.</div>`,
      onConfirm: () => { confirmou = true; },
    });
    // Os tr\u00eas caminhos de sa\u00edda do modal, como em `chat-lista.js`: resolver s\u00f3
    // no Confirmar deixaria o Cancelar pendurado para sempre.
    new MutationObserver((_m, obs) => {
      if (!overlay.isConnected) { obs.disconnect(); resolve(confirmou); }
    }).observe(document.body, { childList: true });
  });
}

async function ofiExcluirSelecionados() {
  const ids = [...ofiSelecao];
  if (!ids.length) { showToast('Selecione um n\u00f3 antes de excluir.', true); return; }
  if (!await ofiConfirmarExclusao(ids)) return;
  let r;
  try {
    r = await window.pywebview.api.excluir_nos(currentProject, ids);
  } catch (e) {
    showToast('N\u00e3o deu para excluir: ' + (e && e.message ? e.message : e), true);
    return;
  }
  if (!r) { showToast('N\u00e3o deu para excluir: o backend n\u00e3o respondeu.', true); return; }
  if (!r.success) { showToast(r.error || 'Falha desconhecida ao excluir.', true); return; }
  ofiSelecao.clear();
  await ofiCarregar();
  showToast(`${ids.length} n\u00f3(s) exclu\u00eddo(s). Ctrl+Z desfaz.`);
}
