// ══════════════════════════════════ CONFIGURAÇÕES: Assistentes externos (lógica)
// Carregar, editar e salvar a lista única de assistentes externos: como cada um
// é lançado no terminal, para onde cada categoria da biblioteca vai, e como ela
// chega lá.
//
// ⚠️ ERAM TRÊS LISTAS até 2026-09-02 — `presets_arquivos`, `presets_preparar` e
// `presets_produto_assistente` —, casadas pelo campo `nome`, por string, sem
// verificação nenhuma. Este arquivo editava a primeira; a terceira morava em
// `arquivos-assistentes.js`, que foi apagado.
//
// ⛔ Não confundir com `config-preparar.js`. As duas telas têm o mesmo desenho
// de propósito — pílulas, "editando o X", salvar explícito —, mas respondem
// perguntas diferentes: aquela diz QUAIS itens vão, esta diz PARA ONDE.
//
// A edição é toda em memória (`_cfaPresets`), e só o botão Salvar escreve —
// trocar de pílula não pode gravar meio assistente, e o usuário fica a meio de
// digitar um caminho o tempo todo.

// ⚠️ Gêmeo de `_PRESET_CHARS_PROIBIDOS` no backend. `/` e `\` ficam de fora de
// propósito: aqui são separador, não conteúdo. Quem GARANTE é o backend.
const CFA_CHARS_PROIBIDOS = ':*?"<>|';

// Os dois formatos possíveis de chegada. É a diferença que existe porque skill
// é igual em todo assistente, mas comando não é: o Claude Code exige .md solto
// em `.claude/commands/` e não descobre nada dentro de subpasta; o OpenCode
// aceita subpasta e a transforma em namespace.
const CFA_FORMATOS = [
  ['pasta', 'Uma pasta por item'],
  ['solto', 'Arquivos soltos'],
];

// Os campos de lançamento, na ordem da tela. Lista aqui, e não no template,
// porque o cartão é pintado a cada troca de pílula.
const CFA_CAMPOS_LANCAMENTO = [
  ['comando', 'Comando', 'o executável, como você digitaria no terminal', 'ex.: claude'],
  ['argumentos', 'Argumentos fixos', 'separados por espaço; pode ficar vazio', ''],
  ['flag_nome', 'Flag do nome da sessão',
   'é ela que deixa um terminal endereçar o outro pelo nome; vazio = este assistente não sabe fazer isso',
   'ex.: --name'],
  ['flag_prompt', 'Flag do prompt', 'recebe o TEXTO do prompt', 'ex.: --append-system-prompt'],
  // ⚠️ Esta recebe o CAMINHO, e a outra o TEXTO — trocar as duas não dá erro:
  // o assistente recebe a string do caminho como se fosse a instrução e roda
  // sem as regras que deveria ter.
  ['flag_prompt_arquivo', 'Flag do prompt por arquivo',
   'recebe o CAMINHO de um arquivo com o prompt; vazio = este assistente nao sabe fazer isso',
   'ex.: --append-system-prompt-file'],
  ['flag_agente', 'Flag do agente',
   'faz a sessao SER o agente escolhido; vazio = este assistente nao tem essa nocao',
   'ex.: --agent'],
  ['comando_cota', 'Comando de cota', 'opcional — o que informa quanto da cota já foi', ''],
];

let _cfaPresets = [];
let _cfaPadrao = null;
let _cfaSelecionado = null;
// As categorias governadas pelo assistente vêm do BACKEND, e não são escritas
// aqui: a lista é curta e as ausências dela são deliberadas (Regras e
// instruções tem pasta própria, que a aba Decisões edita; Códigos prontos tem
// botão próprio de copiar). Duas cópias divergiriam na primeira categoria nova.
// Cada entrada traz `so_destino` e `raiz_quando_vazio`.
let _cfaCategorias = [];
// ⚠️ `{nome de origem: nome atual}`. O Renomear é só em memória, como todo o
// resto desta tela — mas o nome do assistente está gravado em TRÊS lugares no
// disco (início rápido, Workspace.json e o `produto` de cada nó da Oficina), e
// é o Salvar que manda a cascata. Sem este mapa o backend não teria como saber
// que "Claude Code 2" é o antigo "Claude Code" e não um assistente novo.
let _cfaRenomeados = {};

async function initConfigArquivos() {
  if (!document.getElementById('cfa-pills')) return;
  const r = await window.pywebview.api.load_assistentes_config();
  if (!r || !r.success) return;
  _cfaPresets = r.presets || [];
  _cfaPadrao = r.padrao;
  _cfaCategorias = r.categorias || [];
  _cfaRenomeados = {};
  // Depois de "Restaurar padrão" o assistente selecionado pode não existir mais.
  if (!_cfaPresets.some(p => p.nome === _cfaSelecionado)) {
    _cfaSelecionado = (_cfaPresets[0] || {}).nome || null;
  }
  _cfaLigarEventos();
  _cfaPintar();
}

function _cfaPreset() {
  return _cfaPresets.find(p => p.nome === _cfaSelecionado) || null;
}

function _cfaCategoria(preset, kind) {
  preset.categorias = preset.categorias || {};
  const atual = preset.categorias[kind] || {};
  preset.categorias[kind] = {
    destino: atual.destino || '',
    arquivo_de_entrada: atual.arquivo_de_entrada || '',
    formato: atual.formato || 'pasta',
  };
  return preset.categorias[kind];
}

function _cfaLimpar(valor) {
  return [...(valor || '')].filter(c => !CFA_CHARS_PROIBIDOS.includes(c)).join('');
}

// ── Pintura ─────────────────────────────────────────────────────────────────
function _cfaPintar() {
  const pills = document.getElementById('cfa-pills');
  if (pills) {
    pills.innerHTML = _cfaPresets.map(p => `
      <button type="button" class="cpr-pill${p.nome === _cfaSelecionado ? ' sel' : ''}"
              data-cfa-preset="${escapeHtml(p.nome)}">${escapeHtml(p.nome)}${
                p.nome === _cfaPadrao ? ' <span class="cpr-pill-padrao">padrão</span>' : ''}</button>`).join('')
      + `<button type="button" class="cpr-pill cpr-pill-novo" id="btn-cfa-novo">+ Novo assistente</button>`;
  }

  const preset = _cfaPreset();
  const nomeEl = document.getElementById('cfa-editando-nome');
  if (nomeEl) {
    // Pode ter virado <input> pelo Renomear: devolve o <b> antes de escrever.
    if (nomeEl.tagName === 'INPUT') {
      const b = document.createElement('b');
      b.id = 'cfa-editando-nome';
      nomeEl.replaceWith(b);
    }
    document.getElementById('cfa-editando-nome').textContent = preset ? preset.nome : '—';
  }
  _cfaPintarLancamento();
  _cfaPintarGrade();
}

function _cfaPintarLancamento() {
  const casa = document.getElementById('cfa-lancamento');
  if (!casa) return;
  const preset = _cfaPreset();
  if (!preset) { casa.innerHTML = '<p class="config-nota">Nenhum assistente.</p>'; return; }

  // ⛔ A MESMA ESTRUTURA da grade de destinos — `.cfa-linha` > `.cfa-linha-nome`
  // + `.cfa-linha-campos-simples` > `.cfa-campo-largo` —, e por isso este
  // cartão não precisou de UMA LINHA de CSS nova. Convenção *"Não escrever CSS
  // para um cartão novo"*: se parecesse que precisa, seria sinal de que está
  // sendo montado errado.
  casa.innerHTML = CFA_CAMPOS_LANCAMENTO.map(([chave, rotulo, dica, ph]) => {
    // `argumentos` é lista no dado e texto na tela — a junção por espaço é a
    // mesma que o backend desfaz. Os outros são string dos dois lados.
    const valor = chave === 'argumentos'
      ? (preset.argumentos || []).join(' ')
      : (preset[chave] || '');
    return `
      <div class="cfa-linha">
        <div class="cfa-linha-nome">${escapeHtml(rotulo)}</div>
        <div class="cfa-linha-campos cfa-linha-campos-simples">
          <label class="cfa-campo-largo">
            <span>${escapeHtml(dica)}</span>
            <input type="text" data-cfa-lanc="${escapeHtml(chave)}"
                   placeholder="${escapeHtml(ph)}" value="${escapeHtml(valor)}">
          </label>
        </div>
      </div>`;
  }).join('');
}

function _cfaPintarGrade() {
  const grade = document.getElementById('cfa-grade');
  if (!grade) return;
  const preset = _cfaPreset();
  if (!preset) { grade.innerHTML = '<p class="config-nota">Nenhum assistente.</p>'; return; }

  grade.innerHTML = _cfaCategorias.map(({ kind, rotulo, so_destino, raiz_quando_vazio }) => {
    const cat = _cfaCategoria(preset, kind);
    // `so_destino`: a categoria só tem "para onde". Hoje é o Servidor MCP — o
    // destino dele é um ARQUIVO de configuração que o programa MESCLA, não uma
    // pasta de itens que ele copia, então "arquivo de entrada" e "como chega"
    // não querem dizer nada ali. O campo que não se aplica SAI da tela em vez
    // de ficar cinza: campo desabilitado ainda parece pergunta sem resposta.
    const campos = so_destino ? `
          <label class="cfa-campo-largo">
            <span>Arquivo de configuração</span>
            <input type="text" data-cfa-campo="destino"
                   placeholder="este assistente não registra MCP por arquivo"
                   value="${escapeHtml(cat.destino)}">
          </label>
          <p class="cfa-campo-nota">
            O programa mescla a entrada dele neste arquivo e preserva os outros servidores
            que já estiverem lá. Em branco = este assistente guarda MCP em outro formato
            (o Codex usa TOML).
          </p>` : `
          <label>
            <span>Destino</span>
            <input type="text" data-cfa-campo="destino"
                   placeholder="${raiz_quando_vazio ? 'a raiz do projeto' : 'não copia esta categoria'}"
                   value="${escapeHtml(cat.destino)}">
          </label>
          <label>
            <span>Arquivo de entrada <i>(renomeia na cópia)</i></span>
            <input type="text" data-cfa-campo="arquivo_de_entrada"
                   placeholder="vazio = mantém o nome que o arquivo tem"
                   value="${escapeHtml(cat.arquivo_de_entrada)}">
          </label>
          <label>
            <span>Como chega</span>
            <select data-cfa-campo="formato">
              ${CFA_FORMATOS.map(([v, r]) =>
                `<option value="${v}"${cat.formato === v ? ' selected' : ''}>${r}</option>`).join('')}
            </select>
          </label>`;
    return `
      <div class="cfa-linha" data-cfa-kind="${escapeHtml(kind)}">
        <div class="cfa-linha-nome">${escapeHtml(rotulo)}</div>
        <div class="cfa-linha-campos${so_destino ? ' cfa-linha-campos-simples' : ''}">${campos}</div>
      </div>`;
  }).join('');

  _cfaPintarErros();
}

function _cfaPintarErros() {
  const erros = document.getElementById('cfa-erros');
  if (!erros) return;
  const preset = _cfaPreset();
  // Os erros são recalculados na tela para o aviso aparecer enquanto se
  // digita — quem BARRA de verdade é o backend, na hora de copiar.
  const lista = preset ? _cfaErrosLocais(preset) : [];
  erros.classList.toggle('hidden', lista.length === 0);
  erros.textContent = lista.join(' · ');
}

/** Espelho enxuto de `validar_assistente` no backend: só o que dá para ver
 *  sem tocar o disco. Não substitui a validação de lá. */
function _cfaErrosLocais(preset) {
  const erros = [];
  for (const { kind, rotulo, so_destino } of _cfaCategorias) {
    const cat = _cfaCategoria(preset, kind);
    const destino = (cat.destino || '').replace(/\\/g, '/').trim();
    if (destino.startsWith('/') || /^[A-Za-z]:/.test(destino)) {
      erros.push(`${rotulo}: caminho absoluto não é aceito.`);
    } else if (destino.split('/').includes('..')) {
      erros.push(`${rotulo}: ".." sairia da pasta raiz.`);
    }
    if (so_destino) continue;
    const entrada = (cat.arquivo_de_entrada || '').trim();
    if (entrada.includes('/') || entrada.includes('\\')) {
      erros.push(`${rotulo}: o arquivo de entrada é um nome, não um caminho.`);
    }
  }
  return erros;
}

// ── Eventos ─────────────────────────────────────────────────────────────────
function _cfaLigarEventos() {
  const secao = document.getElementById('config-secao-arquivos');
  if (!secao || secao._wired) return;
  secao._wired = true;

  // Delegado na seção: a grade é repintada a cada troca de assistente, e um
  // listener por campo morreria junto com o innerHTML.
  secao.addEventListener('click', e => {
    const pill = e.target.closest('[data-cfa-preset]');
    if (pill) { _cfaSelecionado = pill.dataset.cfaPreset; _cfaPintar(); return; }
    if (e.target.closest('#btn-cfa-novo')) return _cfaNovo();
    if (e.target.closest('#btn-cfa-renomear')) return _cfaRenomear();
    if (e.target.closest('#btn-cfa-duplicar')) return _cfaDuplicar();
    if (e.target.closest('#btn-cfa-padrao')) return _cfaDefinirPadrao();
    if (e.target.closest('#btn-cfa-excluir')) return _cfaExcluir();
  });

  // ⚠️ Dois cliques no nome abrem a edição no lugar, e o `stopPropagation` no
  // `mousedown` com `e.detail > 1` existe porque sem ele o segundo clique
  // começa a selecionar/arrastar em vez de editar. Convenção *"Renomear é no
  // lugar, com dois cliques"*.
  secao.addEventListener('mousedown', e => {
    if (e.detail > 1 && e.target.closest('#cfa-editando-nome')) e.stopPropagation();
  });
  secao.addEventListener('dblclick', e => {
    if (e.target.closest('#cfa-editando-nome')) _cfaRenomear();
  });

  const gravar = e => {
    const preset = _cfaPreset();
    if (!preset) return;

    // Os campos de lançamento: um nível acima, direto no assistente.
    const lanc = e.target.closest('[data-cfa-lanc]');
    if (lanc) {
      const chave = lanc.dataset.cfaLanc;
      // ⛔ SEM `_cfaLimpar` aqui: `:` e `"` são legítimos numa linha de comando
      // (`C:\...\claude.exe`, um argumento entre aspas). Aquele filtro existe
      // para CAMINHO DE PASTA, e aplicá-lo ao comando comeria o que o usuário
      // digitou, sem dizer por quê.
      preset[chave] = chave === 'argumentos'
        ? lanc.value.split(/\s+/).filter(Boolean)
        : lanc.value;
      return;
    }

    const campo = e.target.closest('[data-cfa-campo]');
    const linha = campo && campo.closest('[data-cfa-kind]');
    if (!campo || !linha) return;
    const cat = _cfaCategoria(preset, linha.dataset.cfaKind);
    const chave = campo.dataset.cfaCampo;
    if (campo.tagName === 'SELECT') {
      cat[chave] = campo.value;
      return;
    }
    const limpo = _cfaLimpar(campo.value);
    if (limpo !== campo.value) campo.value = limpo;
    cat[chave] = limpo;
    _cfaPintarErros();
  };
  secao.addEventListener('input', gravar);
  secao.addEventListener('change', gravar);

  const btn = document.getElementById('btn-save-arquivos');
  if (btn && !btn._wired) { btn._wired = true; btn.addEventListener('click', salvarConfigArquivos); }
}

function _cfaNomeLivre(base) {
  let nome = base, n = 2;
  while (_cfaPresets.some(p => p.nome === nome)) nome = `${base} ${n++}`;
  return nome;
}

function _cfaNovo() {
  const nome = _cfaNomeLivre('Novo assistente');
  // Nasce com tudo em branco de propósito: assistente novo não copia nada até
  // o usuário dizer para onde. Destino vazio é "esta categoria não existe
  // aqui", e comando vazio é rascunho — o terminal dele abre limpo, com aviso.
  const categorias = {};
  for (const { kind } of _cfaCategorias) {
    categorias[kind] = { destino: '', arquivo_de_entrada: '', formato: 'pasta' };
  }
  _cfaPresets.push({
    nome, categorias,
    comando: '', argumentos: [], flag_nome: '',
    flag_prompt: '--append-system-prompt',
    flag_prompt_arquivo: '', flag_agente: '', comando_cota: '',
  });
  _cfaSelecionado = nome;
  _cfaPintar();
}

function _cfaDuplicar() {
  const preset = _cfaPreset();
  if (!preset) return;
  const nome = _cfaNomeLivre(`${preset.nome} (cópia)`);
  _cfaPresets.push(JSON.parse(JSON.stringify({ ...preset, nome })));
  _cfaSelecionado = nome;
  _cfaPintar();
}

function _cfaDefinirPadrao() {
  const preset = _cfaPreset();
  if (!preset) return;
  _cfaPadrao = preset.nome;
  _cfaPintar();
  showToast(`"${preset.nome}" será o padrão ao salvar.`);
}

async function _cfaExcluir() {
  const preset = _cfaPreset();
  if (!preset) return;
  if (_cfaPresets.length === 1) {
    // Sem assistente nenhum o botão de ligar bloqueia — e o usuário descobriria
    // isso só na hora de ligar um item, longe daqui.
    showToast('É o último assistente. Crie outro antes de excluir este.', true);
    return;
  }

  // ⚠️ CONTA ANTES DE PERGUNTAR. Convenção *"Toda lixeira confirma antes"*:
  // quando a remoção atinge outras coisas além do alvo, o modal DIZ QUANTAS.
  // Aqui são os inícios rápidos que apontam para ele e os projetos que o usam —
  // os dois voltam para o padrão, e sem o número o usuário não tem como saber
  // o tamanho do estrago.
  let uso = { inicios_rapidos: 0, projetos: 0 };
  try {
    uso = (await window.pywebview.api.contar_uso_do_assistente(preset.nome)) || uso;
  } catch (e) { /* contar é conveniência; a exclusão continua valendo */ }

  const partes = [];
  if (uso.inicios_rapidos) {
    partes.push(`<b>${uso.inicios_rapidos}</b> início${uso.inicios_rapidos > 1 ? 's' : ''} rápido${uso.inicios_rapidos > 1 ? 's' : ''}`);
  }
  if (uso.projetos) {
    partes.push(`<b>${uso.projetos}</b> projeto${uso.projetos > 1 ? 's' : ''}`);
  }
  const atinge = partes.length
    ? `<div class="modal-body-text">Ele está em uso por ${partes.join(' e ')} — ${partes.length > 1 ? 'todos voltam' : 'volta'} para o padrão.</div>`
    : '';

  abrirModalPadrao({
    title: 'Excluir assistente?',
    confirmLabel: 'Excluir',
    bodyHtml: `<div class="modal-body-text">O assistente <strong>${escapeHtml(preset.nome)}</strong> some da lista.</div>${atinge}`,
    onConfirm: () => {
      _cfaPresets = _cfaPresets.filter(p => p.nome !== preset.nome);
      delete _cfaRenomeados[preset.nome];
      if (_cfaPadrao === preset.nome) _cfaPadrao = (_cfaPresets[0] || {}).nome || null;
      _cfaSelecionado = (_cfaPresets[0] || {}).nome || null;
      _cfaPintar();
      return true;
    },
  });
}

function _cfaRenomear() {
  const preset = _cfaPreset();
  const linha = document.getElementById('cfa-editando-nome');
  if (!preset || !linha || linha.tagName === 'INPUT') return;

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'cfa-editando-nome';
  input.className = 'cpr-nome-input';
  input.value = preset.nome;
  linha.replaceWith(input);
  input.focus();
  input.select();

  // ⚠️ IDEMPOTENTE. O Enter grava direto e o `blur` também dispara logo depois;
  // sem esta trava a gravação roda duas vezes e a segunda vê o nome já trocado.
  let fechado = false;
  const confirmar = () => {
    if (fechado) return;
    fechado = true;
    const nome = _cfaLimpar(input.value).trim();
    if (nome && nome !== preset.nome) {
      if (_cfaPresets.some(p => p.nome === nome)) {
        showToast('Já existe um assistente com esse nome.', true);
      } else {
        // O mapa guarda o nome DE ORIGEM: renomear duas vezes seguidas tem de
        // mandar para o backend o nome que está no disco, não o intermediário.
        const origem = Object.keys(_cfaRenomeados)
          .find(k => _cfaRenomeados[k] === preset.nome) || preset.nome;
        _cfaRenomeados[origem] = nome;
        if (_cfaPadrao === preset.nome) _cfaPadrao = nome;
        preset.nome = nome;
        _cfaSelecionado = nome;
      }
    }
    _cfaPintar();
  };
  // ⚠️ O Enter grava DIRETO, e não por `input.blur()`: o blur é um efeito
  // colateral, e depender dele deixa o Enter sem gravar sempre que o campo já
  // tiver perdido o foco por outro caminho.
  input.addEventListener('blur', confirmar);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); confirmar(); }
    if (e.key === 'Escape') { fechado = true; _cfaPintar(); }
  });
}

async function salvarConfigArquivos() {
  const r = await window.pywebview.api.save_assistentes(
    _cfaPresets, _cfaPadrao || _cfaSelecionado, _cfaRenomeados);
  if (r && r.success) {
    showToast('Assistentes externos salvos.');
    _cfaRenomeados = {};
    initConfigArquivos();
    // O seletor "Assistente externo" do projeto lê a mesma lista. Sem isto ele
    // continua mostrando o nome antigo até a próxima troca de aba.
    if (typeof prepPintarDestinos === 'function') prepPintarDestinos();
  } else {
    showToast((r && r.error) || 'Erro ao salvar.', true);
  }
}
