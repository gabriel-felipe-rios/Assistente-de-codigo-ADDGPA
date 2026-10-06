// ══ CONFIGURAÇÕES → Preparar projeto: validação e eventos ══════════════════
//
// O espelho da validação do backend, e a ligação de todos os campos da tela.
//
// ⚠️ A VALIDAÇÃO DAQUI É CONVENIÊNCIA, NÃO SEGURANÇA. Ela existe para avisar
// ANTES de salvar; quem garante é `validar_inicio_rapido`, no backend. As duas
// aplicam a mesma regra do D36 (relativo à raiz, sem `..`, sem caractere
// proibido) — e é por isso que `CPR_CHARS_PROIBIDOS` está declarado na casca,
// num lugar só, espelhando `_PRESET_CHARS_PROIBIDOS` do Python.
//
// ⚠️ PRESET INVÁLIDO PODE SER SALVO, e isso é decisão. O usuário fica a meio de
// digitar um caminho o tempo todo, e recusar a gravação faria perder o resto do
// formulário. Quem barra o preset quebrado é a hora de USAR.
//
// ⚠️ CAMPO VAZIO É PULADO, NÃO É ERRO. É o mesmo mecanismo que faz o preset do
// Codex não ter MCP sem nenhum código próprio para esse caso.
function _cprPintarErros() {
  const el = document.getElementById('cpr-erros');
  if (!el) return;
  const preset = _cprPreset();
  const erros = preset ? _cprValidar(preset) : [];
  el.classList.toggle('hidden', !erros.length);
  el.innerHTML = erros.length
    ? `⚠️ Este início rápido está <b>indisponível</b> enquanto tiver:<br>` +
      erros.map(e => '• ' + escapeHtml(e)).join('<br>')
    : '';
}

// ── Validação (D36) — o espelho da do backend, para avisar antes de salvar ──
function _cprErroDeCaminho(valor, rotulo) {
  const bruto = (valor || '').trim().replace(/\\/g, '/');
  if (!bruto) return null;              // vazio é PULADO, não é erro
  if (bruto.startsWith('/') || bruto[1] === ':') {
    return `${rotulo}: caminho absoluto não é aceito — escreva a partir da pasta raiz.`;
  }
  for (const seg of bruto.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') return `${rotulo}: ".." sairia da pasta raiz do projeto.`;
  }
  return null;
}

// ⚠️ SOBROU UM. Os quatro destinos saíram daqui em 2026-09-02 — eles são do
// assistente externo, e quem os valida é `validar_assistente`, no backend.
const CPR_CAMPOS = [
  ['pasta_trabalho', 'Pasta de trabalho'],
];

function _cprValidar(preset) {
  const erros = [];
  CPR_CAMPOS.forEach(([chave, rotulo]) => {
    const e = _cprErroDeCaminho(preset[chave], rotulo);
    if (e) erros.push(e);
  });
  [['pastas_raiz', 'Pastas na pasta raiz'], ['pastas_trabalho', 'Pastas na pasta de trabalho']]
    .forEach(([chave, rotulo]) => {
      (preset[chave] || []).forEach(it => {
        const caminho = (it.caminho || '').trim();
        if (!caminho) { erros.push(`${rotulo}: há uma linha sem caminho.`); return; }
        const e = _cprErroDeCaminho(caminho, `${rotulo} › ${caminho}`);
        if (e) erros.push(e);
        if (it.contexto && !(it.descricao || '').trim()) {
          erros.push(`${rotulo} › ${caminho}: "Contexto sem leitura" exige uma descrição.`);
        }
      });
    });
  return erros;
}

// Barra o caractere na DIGITAÇÃO: o campo não deixa nem entrar. É conveniência,
// não segurança — quem garante é o backend, que revalida tudo antes de criar.
function _cprLimpar(texto) {
  return (texto || '').split('').filter(c => !CPR_CHARS_PROIBIDOS.includes(c)).join('');
}

// ── Eventos ────────────────────────────────────────────────────────────────
function _cprLigarEventos() {
  const secao = document.getElementById('config-secao-preparar');
  if (!secao || secao._wired) return;
  secao._wired = true;

  // Delegado na seção: as listas de pasta são repintadas a cada troca de
  // início rápido, e um listener por linha morreria junto com o innerHTML.
  secao.addEventListener('click', e => {
    const pill = e.target.closest('[data-cpr-preset]');
    if (pill) { _cprSelecionado = pill.dataset.cprPreset; _cprPintar(); return; }
    if (e.target.closest('#btn-cpr-novo')) return _cprNovo();
    if (e.target.closest('#btn-cpr-renomear')) return _cprRenomear();
    if (e.target.closest('#btn-cpr-duplicar')) return _cprDuplicar();
    if (e.target.closest('#btn-cpr-excluir')) return _cprExcluir();

    const aba = e.target.closest('[data-cpr-tipo]');
    if (aba) {
      _cprTipoAberto = aba.dataset.cprTipo;
      // Trocar de categoria limpa a busca: o texto era daquela lista, e mantê-lo
      // faria a categoria nova abrir já filtrada por algo que o usuário não
      // digitou ali.
      _cprBusca = '';
      _cprPintarBiblioteca();
      return;
    }

    const origem = e.target.closest('[data-cpr-origem]');
    if (origem) { _cprOrigemAberta = origem.dataset.cprOrigem; _cprPintarBiblioteca(); return; }

    // A dobra de um grupo. ⚠️ `display` e o Set, nunca redesenho da lista: o
    // clique está DENTRO da linha que seria trocada.
    const dobra = e.target.closest('[data-cpr-dobra]');
    if (dobra) {
      const chave = _cprTipoAberto + '/' + dobra.dataset.cprDobra;
      const fechado = _cprGruposFechados.has(chave);
      if (fechado) _cprGruposFechados.delete(chave); else _cprGruposFechados.add(chave);
      dobra.textContent = fechado ? '▾' : '▸';
      dobra.title = fechado ? 'Retrair' : 'Abrir';
      _cprFiltrar();
      return;
    }

    // ⚠️ Os dois botões agem SÓ sobre a origem aberta. Eles moram na fileira das
    // sub-abas "Do programa / Gerais", e um botão ali que mexesse na categoria
    // inteira apagaria em silêncio o que está marcado na aba que não se vê.
    const todos = e.target.closest('[data-cpr-todos]');
    if (todos) {
      const preset = _cprPreset();
      if (!preset) return;
      const nomes = _cprItensDaOrigem(_cprTipoAberto, _cprOrigemAberta).map(i => i.name);
      const marcados = _cprMarcados(preset, _cprTipoAberto);
      nomes.forEach(n => { if (!marcados.includes(n)) marcados.push(n); });
      _cprPintarBiblioteca();
      return;
    }

    const nenhum = e.target.closest('[data-cpr-nenhum]');
    if (nenhum) {
      const preset = _cprPreset();
      if (!preset) return;
      // Preserva os órfãos: "Limpar" fala do que está visível na lista, e não é
      // o botão de faxina — quem tira órfão é o "Tirar do início rápido".
      const nomes = _cprItensDaOrigem(_cprTipoAberto, _cprOrigemAberta).map(i => i.name);
      preset.itens[_cprTipoAberto] = _cprMarcados(preset, _cprTipoAberto)
        .filter(n => !nomes.includes(n));
      _cprPintarBiblioteca();
      return;
    }

    const orfaos = e.target.closest('[data-cpr-limpar-orfaos]');
    if (orfaos) {
      const preset = _cprPreset();
      if (!preset) return;
      const kind = orfaos.dataset.cprLimparOrfaos;
      const existem = new Set((_cprBiblioteca[kind] || []).map(i => i.name));
      preset.itens[kind] = _cprMarcados(preset, kind).filter(n => existem.has(n));
      _cprPintarBiblioteca();
      return;
    }

    const add = e.target.closest('[data-cpr-add]');
    if (add) return _cprAdicionarPasta(add.dataset.cprAdd);

    const del = e.target.closest('[data-cpr-del]');
    if (del) {
      const preset = _cprPreset();
      if (!preset) return;
      const chave = del.dataset.cprDel === 'raiz' ? 'pastas_raiz' : 'pastas_trabalho';
      (preset[chave] || []).splice(Number(del.dataset.cprI), 1);
      _cprPintar();
    }
  });

  secao.addEventListener('input', e => {
    const preset = _cprPreset();
    if (!preset) return;

    // A busca da biblioteca: FILTRA, não repinta.
    if (e.target.id === 'cpr-bib-busca-input') {
      _cprBusca = e.target.value;
      _cprFiltrar();
      return;
    }

    if (e.target.dataset.cprCampo) {
      const limpo = _cprLimpar(e.target.value);
      if (limpo !== e.target.value) e.target.value = limpo;
      preset[e.target.dataset.cprCampo] = limpo;
      if (e.target.dataset.cprCampo === 'pasta_trabalho') {
        const base = document.getElementById('cpr-base-trabalho');
        if (base) base.textContent = limpo.trim() || 'a pasta de trabalho acima';
      }
      _cprPintarErros();
      return;
    }
    if (e.target.dataset.cprProp === 'descricao') {
      const chave = e.target.dataset.cprLista === 'raiz' ? 'pastas_raiz' : 'pastas_trabalho';
      preset[chave][Number(e.target.dataset.cprI)].descricao = e.target.value;
      _cprPintarErros();
    }
  });

  secao.addEventListener('change', e => {
    const preset = _cprPreset();
    if (!preset) return;

    if (e.target.id === 'cpr-assistente') {
      preset.assistente = e.target.value;
      _cprPintarAssistente();
      return;
    }

    if (e.target.dataset.cprItem) {
      const kind = e.target.dataset.cprTipoItem;
      const nome = e.target.dataset.cprItem;
      // ⚠️ ESCOLHA ÚNICA: marcar um DESMARCA o outro. O `radio` já faz isso na
      // tela; o dado precisa acompanhar, senão a lista guardada continua com os
      // dois e o backend corta o segundo sem a tela nunca ter mostrado isso.
      if (_cprTipo(kind).escolha_unica) {
        preset.itens = preset.itens || {};
        preset.itens[kind] = e.target.checked ? [nome] : [];
      } else {
        const marcados = _cprMarcados(preset, kind);
        const i = marcados.indexOf(nome);
        if (e.target.checked && i < 0) marcados.push(nome);
        if (!e.target.checked && i >= 0) marcados.splice(i, 1);
      }
      // Repinta só as abas e as contagens de grupo: a caixa que o usuário
      // acabou de clicar já está no estado certo, e trocar o innerHTML embaixo
      // do clique tira o foco dela.
      _cprPintarContagens();
      _cprPintarContagensDeGrupo();
      return;
    }
    const prop = e.target.dataset.cprProp;
    if (prop === 'remover' || prop === 'contexto') {
      const chave = e.target.dataset.cprLista === 'raiz' ? 'pastas_raiz' : 'pastas_trabalho';
      preset[chave][Number(e.target.dataset.cprI)][prop] = e.target.checked;
      _cprPintar();   // marcar "Contexto" faz nascer o campo de descrição
    }
  });

  const btn = document.getElementById('btn-save-preparar');
  if (btn && !btn._wired) { btn._wired = true; btn.addEventListener('click', salvarConfigPreparar); }
}

