// ══════════════════════ SUB-ABA: Automação › Histórico ══
// Lê `get_historico_da_automacao` e desenha a trilha de ciclos + o detalhe do
// ciclo escolhido. O markup mora em `historico-template.js`.
//
// ⚠️ MONTADO NO DOM, e não por innerHTML: caminho de arquivo e motivo de erro
// vêm do disco, e concatenar HTML com dado de fora é como se escreve o próximo
// bug de escape. Mesma escolha de `referencia.js` e de `_detectorTabela`.
//
// ⚠️ LEITURA AO ABRIR — igual a Erros e Pendências. Quem mostra o AGORA é a
// sub-aba Visualizar; esta mostra o DEPOIS, e um painel que se repintasse o
// tempo todo competiria com aquele sem responder melhor a nada.
//
// A ÚNICA exceção é o ciclo do topo ainda sem linha `fim`: aí a leitura se
// repete a cada 2s e **se desarma sozinha** quando ele fecha (`_histAgendar`).
// Não é "ao vivo": é não deixar um "0 rotinas" mentiroso parado na tela.

// Desfecho → como aparece. A cor é a informação, e a legenda logo abaixo é o
// que a torna legível (selo sem legenda é decoração).
//
// ⚠️ **Dispensada é TEAL, nunca âmbar.** Âmbar quer dizer "faltou alguma coisa"
// no programa inteiro; uma rotina dispensada é o contrário disso — o ciclo
// olhou, viu que não havia o que fazer e poupou uma chamada de LLM. Pintá-la de
// âmbar faria um ciclo perfeito parecer um ciclo cheio de pendências.
const HIST_DESFECHOS = {
  'concluida':  { rotulo: 'Concluída',  classe: 'hist-ok' },
  // Âmbar, e não o cinza de `hist-parcial` (que é o "Sem desfecho"): terminou,
  // mas faltou alguma coisa — o vocabulário é "Concluído com N erros".
  'com_erros':  { rotulo: 'Concluída com erros', classe: 'hist-com-erros' },
  'dispensada': { rotulo: 'Dispensada', classe: 'hist-dispensada' },
  'pulada':     { rotulo: 'Pulada',     classe: 'hist-pulada' },
  'erro':       { rotulo: 'Erro',       classe: 'hist-erro' },
  'executando': { rotulo: 'Sem desfecho', classe: 'hist-parcial' },
};

// Um ciclo sem linha `fim` ainda esta rodando (ou morreu no meio). Ate hoje o
// painel o desenhava IGUAL a um ciclo vazio: "0 rotinas", sem uma palavra —
// bastava abrir a sub-aba nos dois segundos entre o clique em "Ativar tudo" e a
// primeira rotina terminar para a tela parecer quebrada.
function _histRodando(c) {
  return !!c && c.completou === null;
}

// Desfecho de ARQUIVO. Os que representam trabalho feito ficam neutros; os que
// representam trabalho POUPADO ficam teal, pela mesma regra de cima.
const HIST_ARQ_CLASSES = {
  'gerado':           'hist-arq-feito',
  'regerada':         'hist-arq-feito',
  'movido':           'hist-arq-feito',
  'apagado':          'hist-arq-feito',
  'reaproveitado':    'hist-arq-poupado',
  'reaproveitada':    'hist-arq-poupado',
  'copiado do gêmeo': 'hist-arq-poupado',
  'grande demais':    'hist-arq-pulado',
  'erro':             'hist-arq-erro',
};

let _histCiclos = [];
let _histEscolhido = 0;
let _histFiltro = 'tudo';
let _histBound = false;
let _histRelogio = null;
// De qual projeto é a trilha na tela. `null` = nenhum ainda.
let _histProjeto = null;

function initHistoricoTab() {
  // `runHistorico()` recarrega os ciclos, mas o ciclo ESCOLHIDO e o filtro são
  // índice e estado de tela: com abas de projeto, o ciclo 3 de um projeto
  // virava o ciclo 3 do outro, e o filtro de rotina escolhido num escondia
  // linhas no outro sem nada dizendo por quê.
  if (_histProjeto !== currentProject) {
    _histProjeto = currentProject;
    _histCiclos = [];
    _histEscolhido = 0;
    _histFiltro = 'tudo';
  }
  if (!_histBound) {
    _histBound = true;
    const btn = document.getElementById('btn-run-historico');
    if (btn) btn.addEventListener('click', runHistorico);
    const limpar = document.getElementById('btn-limpar-historico');
    if (limpar) limpar.addEventListener('click', _histLimpar);
    if (typeof _wireToggle === 'function') {
      _wireToggle('hist-filtro', 'filtro', v => { _histFiltro = v; _histDesenharDetalhe(); });
    }
    // Delegação obrigatória: a trilha é remontada a cada leitura, e ligar um
    // listener por item empilharia listeners a cada troca (regra registrada no
    // componente Trilha de itens).
    const trilha = document.getElementById('hist-trilha');
    if (trilha) {
      trilha.addEventListener('click', ev => {
        const item = ev.target.closest('.hist-trilha-item');
        if (!item) return;
        _histEscolhido = Number(item.dataset.i) || 0;
        _histDesenharTrilha();
        _histDesenharDetalhe();
      });
    }
  }
  runHistorico();
}

async function runHistorico() {
  const alvo = document.getElementById('hist-detalhe');
  if (!alvo) return;
  const btn = document.getElementById('btn-run-historico');
  if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }
  try {
    const r = await window.pywebview.api.get_historico_da_automacao(currentProject);
    if (!r || !r.success) {
      alvo.textContent = (r && r.error) || 'Falha ao ler o histórico.';
      alvo.className = 'hist-detalhe tree-error';
      return;
    }
    // Preserva a escolha entre releituras: sem isto, a cada 2 segundos o
    // painel pularia de volta para o ciclo do topo e ninguem conseguiria ler o
    // detalhe de um ciclo antigo enquanto outro roda.
    const antes = _histCiclos[_histEscolhido];
    _histCiclos = r.ciclos || [];
    const mesmo = _histCiclos.findIndex(c => antes && c.quando === antes.quando);
    _histEscolhido = mesmo >= 0 ? mesmo : 0;
    _histDesenharTrilha();
    _histDesenharDetalhe();
    _histAgendar();
  } catch (e) {
    alvo.textContent = String(e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '↻ Verificar'; }
  }
}

// ⚠️ **Isto NAO transforma o painel num Visualizar.** Quem mostra o agora
// continua sendo aquela sub-aba; aqui a releitura existe so para nao deixar uma
// linha visivelmente errada na tela enquanto o ciclo corre — e ela se desarma
// sozinha assim que o ciclo do topo ganha a linha `fim`.
function _histAgendar() {
  if (_histRelogio) { clearTimeout(_histRelogio); _histRelogio = null; }
  if (!_histRodando(_histCiclos[0])) return;
  const painel = document.getElementById('asubtab-historico');
  if (!painel || painel.classList.contains('hidden')) return;
  _histRelogio = setTimeout(runHistorico, 2000);
}

// ⚠️ Era `confirm()` nativo — caixa branca do WebView2 no meio da tela escura.
// O corpo agora DIZ O QUE SE PERDE, em vez de perguntar "tem certeza?": é a
// regra do Modal padrão, e aqui ela importa porque o que some não é óbvio de
// fora (some o registro de TODAS as rotinas, não o da que está à vista).
async function _histLimpar() {
  const ok = await perguntarNaModal({
    title: 'Apagar o histórico da Automação?',
    confirmLabel: 'Apagar histórico',
    bodyHtml: `<div class="modal-body-text">Isto apaga o registro de execução de
      <strong>todas</strong> as rotinas deste projeto — quando cada uma rodou, o
      que gerou e o que falhou.<br><br>O que as rotinas produziram
      (documentação, índices, resumos) <strong>não</strong> é tocado.<br><br>
      <strong>Não dá pra desfazer.</strong></div>`,
  });
  if (!ok) return;
  try {
    await window.pywebview.api.limpar_historico_da_automacao(currentProject);
  } catch (e) { /* a releitura logo abaixo mostra o que sobrou */ }
  runHistorico();
}

// ── A trilha ────────────────────────────────────────────────────────────────

function _histDesenharTrilha() {
  const el = document.getElementById('hist-trilha');
  if (!el) return;
  el.innerHTML = '';
  const titulo = document.createElement('div');
  titulo.className = 'hist-trilha-titulo';
  titulo.textContent = 'Ciclos';
  el.appendChild(titulo);

  if (!_histCiclos.length) {
    const vazio = document.createElement('p');
    vazio.className = 'agente-viewer-empty';
    vazio.textContent = 'Nada ainda.';
    el.appendChild(vazio);
    return;
  }

  _histCiclos.forEach((c, i) => {
    const item = document.createElement('button');
    item.className = 'hist-trilha-item' + (i === _histEscolhido ? ' ativo' : '');
    item.dataset.i = i;
    if (c.completou === false) item.classList.add('travou');
    if (_histRodando(c)) item.classList.add('rodando');

    const l1 = document.createElement('div');
    l1.className = 'hist-trilha-l1';
    l1.textContent = c.origem_rotulo || c.origem || '—';
    item.appendChild(l1);

    const l2 = document.createElement('div');
    l2.className = 'hist-trilha-l2';
    l2.textContent = _histHora(c.quando);
    item.appendChild(l2);

    // A regra do componente: **o item carrega o tamanho do que ele abre.** Sem
    // isto, escolher qual ciclo olhar vira tentativa e erro.
    const l3 = document.createElement('div');
    l3.className = 'hist-trilha-l3';
    const contas = c.contas || {};
    // ⚠️ "em andamento" ANTES da contagem, e não depois: `0 rotinas` sozinho é
    // exatamente a linha que fez o painel parecer quebrado.
    if (_histRodando(c)) _histPedaco(l3, 'em andamento', 'hist-rodando');
    _histPedaco(l3, `${c.quantas || 0} rotinas`, null);
    if (contas.dispensada) _histPedaco(l3, `${contas.dispensada} dispensadas`, 'hist-dispensada');
    if (contas.pulada) _histPedaco(l3, `${contas.pulada} puladas`, 'hist-pulada');
    if (contas.erro) _histPedaco(l3, `${contas.erro} com erro`, 'hist-erro');
    if (c.arquivos) _histPedaco(l3, `${c.arquivos} arquivos`, null);
    item.appendChild(l3);
    el.appendChild(item);
  });
}

function _histPedaco(pai, texto, classe) {
  if (pai.childNodes.length) pai.appendChild(document.createTextNode(' · '));
  const s = document.createElement('span');
  if (classe) s.className = classe;
  s.textContent = texto;
  pai.appendChild(s);
}

// ── O detalhe ───────────────────────────────────────────────────────────────

function _histDesenharDetalhe() {
  const el = document.getElementById('hist-detalhe');
  if (!el) return;
  el.className = 'hist-detalhe';
  el.innerHTML = '';

  const c = _histCiclos[_histEscolhido];
  if (!c) {
    const vazio = document.createElement('p');
    vazio.className = 'agente-viewer-empty';
    vazio.textContent = 'Nenhum ciclo registrado ainda. Rode a Automação e volte aqui.';
    el.appendChild(vazio);
    return;
  }

  el.appendChild(_histCabecalho(c));
  el.appendChild(_histLegenda());

  const rotinas = (c.rotinas || []).filter(_histPassaNoFiltro);
  if (!rotinas.length) {
    const vazio = document.createElement('p');
    vazio.className = 'agente-viewer-empty';
    vazio.textContent = _histFiltro === 'erro'
      ? '✓ Nenhuma rotina deu erro neste ciclo.'
      : '✓ Neste ciclo todas as rotinas previstas rodaram.';
    el.appendChild(vazio);
    return;
  }
  rotinas.forEach(r => el.appendChild(_histLinhaDeRotina(r)));
}

function _histPassaNoFiltro(r) {
  if (_histFiltro === 'erro') return r.desfecho === 'erro' || r.desfecho === 'com_erros';
  if (_histFiltro === 'parado') return r.desfecho !== 'concluida';
  return true;
}

function _histCabecalho(c) {
  const box = document.createElement('div');
  box.className = 'hist-detalhe-cab';

  const t = document.createElement('div');
  t.className = 'hist-detalhe-titulo';
  t.textContent = c.origem_rotulo || c.origem || '—';
  box.appendChild(t);

  const linha = document.createElement('div');
  linha.className = 'hist-detalhe-sub';
  const partes = [_histQuando(c.quando)];
  if (c.grupos && c.grupos.length) partes.push('grupos ' + c.grupos.join(', '));
  if (c.caminhos) partes.push(`${c.caminhos} arquivo(s) na lista de mudanças`);
  if (c.completou === true) partes.push('chegou ao fim');
  if (c.completou === false) {
    partes.push('INTERROMPIDO' + (c.parou_em ? ' em ' + _histNome(c.parou_em) : ''));
  }
  if (_histRodando(c)) partes.push('EM ANDAMENTO — esta lista se completa sozinha');
  linha.textContent = partes.join(' · ');
  if (c.completou === false) linha.classList.add('hist-erro');
  if (_histRodando(c)) linha.classList.add('hist-rodando');
  box.appendChild(linha);

  // A frase que responde "por que Grafo de Imports e Índice de Identificadores
  // regeram de novo se eu não mudei nada?". Fica no ciclo, e não numa nota de
  // rodapé, porque é a dúvida que se tem OLHANDO esta lista.
  const nota = document.createElement('p');
  nota.className = 'hist-nota';
  nota.textContent = 'Só as rotinas que custam LLM podem ser dispensadas. '
    + 'As outras, sem IA, são determinísticas, custam segundos e reconstroem o índice '
    + 'inteiro toda vez — por isso não têm lista de arquivos aqui, e por isso '
    + 'aparecem rodando mesmo quando nada mudou. Ver a sub-aba Explicações.';
  box.appendChild(nota);
  return box;
}

function _histLegenda() {
  const bar = document.createElement('div');
  bar.className = 'hist-legenda-bar';
  ['concluida', 'com_erros', 'dispensada', 'pulada', 'erro'].forEach(k => {
    const d = HIST_DESFECHOS[k];
    const item = document.createElement('span');
    item.className = 'hist-legenda-item';
    const ponto = document.createElement('i');
    ponto.className = 'hist-ponto ' + d.classe;
    item.appendChild(ponto);
    item.appendChild(document.createTextNode(' ' + d.rotulo));
    bar.appendChild(item);
  });
  const dica = document.createElement('span');
  dica.className = 'hist-legenda-dica';
  dica.textContent = 'Dispensada = o Detector não pediu (normal). '
    + 'Pulada = um pré-requisito não terminou (ficou trabalho).';
  bar.appendChild(dica);
  return bar;
}

function _histLinhaDeRotina(r) {
  const d = HIST_DESFECHOS[r.desfecho] || HIST_DESFECHOS['executando'];
  const box = document.createElement('details');
  box.className = 'hist-rotina ' + d.classe;

  const cab = document.createElement('summary');
  cab.className = 'hist-rotina-cab';

  const nome = document.createElement('span');
  nome.className = 'hist-rotina-nome';
  nome.textContent = _histNome(r.agente);
  cab.appendChild(nome);

  const selo = document.createElement('span');
  selo.className = 'hist-selo ' + d.classe;
  selo.textContent = d.rotulo;
  cab.appendChild(selo);

  const meta = document.createElement('span');
  meta.className = 'hist-rotina-meta';
  meta.textContent = _histResumoDaRotina(r);
  // ⚠️ Dez rotinas seguidas marcando exatamente "2.0s" parece número inventado,
  // e não é: `_ac_wait_done` confere o fim de cada uma a cada 2 segundos
  // (`time.sleep(2)`), então esse é o PISO do que dá para medir daqui. O número
  // é honesto como "quanto o ciclo esperou por ela" — e é isto que o título diz,
  // para parar de parecer defeito.
  meta.title = 'Tempo que o ciclo esperou por esta rotina. Ele confere o fim de '
    + 'cada uma a cada 2 segundos, então 2,0s é o mínimo que aparece aqui.';
  cab.appendChild(meta);

  box.appendChild(cab);

  const corpo = document.createElement('div');
  corpo.className = 'hist-rotina-corpo';
  if (r.motivo || r.requisito) {
    const p = document.createElement('p');
    p.className = 'hist-motivo';
    p.textContent = r.requisito
      ? 'Estava esperando ' + _histNome(r.requisito) + ' terminar.'
      : r.motivo;
    corpo.appendChild(p);
  }
  if ((r.arquivos || []).length) {
    corpo.appendChild(_histListaDeArquivos(r));
  } else if (r.desfecho === 'concluida') {
    const p = document.createElement('p');
    p.className = 'hist-motivo';
    // Duas razões diferentes para uma rotina concluída não ter lista, e dizer a
    // errada é pior que não dizer nada.
    p.textContent = (r.saldo && r.saldo.reaproveitados)
      ? `Nenhum arquivo precisou ser gerado: os ${r.saldo.reaproveitados} `
        + 'foram reaproveitados porque não mudaram. A lista completa está no '
        + 'card desta rotina, na sub-aba Rotinas.'
      : 'Esta rotina não processa arquivo a arquivo — ela reconstrói o índice '
        + 'inteiro numa passada só.';
    corpo.appendChild(p);
  }
  box.appendChild(corpo);
  return box;
}

function _histResumoDaRotina(r) {
  const partes = [];
  const s = r.saldo || {};
  if (s.processados != null && s.total != null) {
    partes.push(`${s.processados} de ${s.total}`);
  } else if (s.processados != null) {
    partes.push(`${s.processados} processados`);
  }
  // ⚠️ O reaproveitado é CONTAGEM, nunca uma linha por arquivo. Eram 90% do
  // `Histórico.jsonl` — 762 linhas de 843 dizendo "este arquivo não mudou",
  // enterrando as cinco que importavam e estourando o teto em cinco ciclos.
  // Quem quiser a lista completa a tem no card da própria rotina.
  if (s.reaproveitados) partes.push(`${s.reaproveitados} reaproveitados`);
  if (s.erros) partes.push(`${s.erros} erro(s)`);
  const n = (r.arquivos || []).length + (r.arquivos_omitidos || 0);
  if (n) partes.push(`${n} arquivo(s)`);
  if (r.segundos != null) partes.push(`${r.segundos}s`);
  return partes.join(' · ');
}

function _histListaDeArquivos(r) {
  const lista = document.createElement('div');
  lista.className = 'hist-arquivos';
  (r.arquivos || []).forEach(a => {
    const linha = document.createElement('div');
    linha.className = 'hist-arq';

    const marca = document.createElement('span');
    marca.className = 'hist-arq-marca ' + (HIST_ARQ_CLASSES[a.desfecho] || 'hist-arq-outro');
    marca.textContent = a.desfecho || '';
    linha.appendChild(marca);

    const nome = document.createElement('code');
    nome.className = 'hist-arq-nome';
    nome.textContent = a.arquivo || '';
    linha.appendChild(nome);

    if (a.detalhe) {
      const det = document.createElement('span');
      det.className = 'hist-arq-detalhe';
      det.textContent = a.detalhe;
      linha.appendChild(det);
    }
    lista.appendChild(linha);
  });

  // ⚠️ Corte CONTADO, nunca silencioso. Uma lista truncada sem aviso se lê como
  // "foi só isto" — e a conta de cima diria outro número.
  if (r.arquivos_omitidos) {
    const mais = document.createElement('div');
    mais.className = 'hist-arq-mais';
    mais.textContent = `+ ${r.arquivos_omitidos} arquivo(s) não listados aqui.`;
    lista.appendChild(mais);
  }
  return lista;
}

// ── Miudezas ────────────────────────────────────────────────────────────────

function _histNome(id) {
  return (typeof AC_NOMES_AGENTES !== 'undefined' && AC_NOMES_AGENTES[id]) || id || '—';
}

function _histHora(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit',
                                           second: '2-digit' });
  } catch (e) { return iso; }
}

function _histQuando(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString('pt-BR'); } catch (e) { return iso; }
}
