/* ══════════════════════════════════════════════════════════
   FILA — sub-aba Subagentes: quem a Fila pode chamar.

   Cards no padrão do Chat, em quatro grupos. Os dez subagentes são LITERALMENTE
   os mesmos do Chat — a definição de cada um vem de AGENTES_DEFINICOES
   (chat-agentes.js), e não de uma cópia daqui: duas descrições para o mesmo
   agente seriam dois lugares para divergir, e a que ficasse velha mentiria
   sobre o que ele consegue ler.
══════════════════════════════════════════════════════════ */

const FILA_AGENTES_ESTADO_KEY = 'fila_agentes_estado';
const FILA_MAX_RODADAS_KEY = 'fila_max_rodadas';
const FILA_DEVOLUCOES_KEY = 'fila_devolucoes';
const FILA_MAX_VOLTAS_KEY = 'fila_max_voltas';

const FILA_CONFIG_CAMPOS = [
  { elId: 'fila-max-rodadas', chave: 'max_rodadas', storageKey: FILA_MAX_RODADAS_KEY, min: 1, max: 99, padrao: 30 },
  // O teto de tokens da resposta do subagente saiu daqui: vale para o
  // programa inteiro e mora em Configurações › Ferramentas dos subagentes.
  { elId: 'fila-devolucoes', chave: 'devolucoes', storageKey: FILA_DEVOLUCOES_KEY, min: 1, max: 9, padrao: 3 },
  // ⚠️ VOLTA não é RODADA. Rodada conta só quando o modelo pede subagentes e
  // eles rodam; volta conta QUALQUER ida ao modelo — inclusive as que não
  // gastam rodada (correção de formato, devolução do Verificador, insistência
  // depois do teto). É o cinto de segurança do laço, e por isso o número é
  // bem maior que o de rodadas.
  { elId: 'fila-max-voltas', chave: 'max_voltas', storageKey: FILA_MAX_VOLTAS_KEY, min: 10, max: 999, padrao: 120 },
];

// Os quatro grupos, na ordem em que aparecem.
const FILA_AGENTES_GRUPOS = [
  {
    id: 'principal',
    titulo: 'Agente principal',
    dica: 'Quem recebe a tarefa, decide a quem perguntar e escreve o relatório. Não liga nem desliga.',
  },
  {
    id: 'programa',
    titulo: 'Acionado pelo programa',
    dica: 'Não é o modelo que decide chamar: o programa injeta sozinho, a cada rodada.',
  },
  {
    id: 'fila',
    titulo: 'Subagentes chamados pela fila',
    dica: 'O modelo escolhe na hora quem chamar, e pode chamar até 4 em paralelo.',
  },
  {
    // Os mesmos do grupo "De extensões" do Chat — vêm de AGENTES_DEFINICOES.
    id: 'fila-extensoes',
    titulo: 'De extensões',
    dica: 'Subagentes que uma extensão ligada acrescentou. A Fila os chama como aos de cima; desligar a extensão tira o card.',
  },
  {
    id: 'so-fila',
    titulo: 'Só da Fila',
    dica: 'Não existe no Chat: entra depois que o relatório fica pronto, antes de ele chegar a você.',
  },
  {
    id: 'prompt-fixo',
    titulo: 'Prompts fixos',
    dica: 'Texto pronto que acompanha o envio. Não é subagente: não tem ferramenta nem contrato. Volta para "Nenhum" depois de cada envio.',
  },
];

// Cards que são só da Fila. Os dez do meio vêm de AGENTES_DEFINICOES.
const FILA_AGENTES_PROPRIOS = [
  {
    id: 'fila',
    icone: '💬',
    nome: 'Fila',
    descricao: 'Recebe a tarefa, decide quem chamar e escreve o relatório final. Tem prompt fixo próprio, voltado a pesquisar por muito tempo sem escrever código.',
    grupo: 'principal',
    especial: true,
    semToggle: true,
    selo: 'Fixo',
    fontes: [],
  },
  {
    id: 'contador',
    icone: '🔢',
    nome: 'Contador de rodadas',
    descricao: 'Determinístico, sem LLM. Após cada rodada, avisa a Fila quantas rodadas de chamadas de subagentes ainda restam. Na última, manda entregar o relatório com o que tem.',
    grupo: 'programa',
    especial: true,
    fontes: [],
  },
  {
    // O segundo acionado pelo programa. Sem toggle: não há chave no backend
    // para desligá-lo, e o card está aqui para você saber que ele existe — o
    // bloco "[LEITURA DA TAREFA]" da aba Contexto sai daqui.
    id: 'rastro',
    icone: '📖',
    nome: 'Leitura da tarefa',
    descricao: 'Determinístico, sem LLM. A cada rodada, refaz a conta de quais partes de cada artefato já foram lidas e quais caminhos já deram erro. É um bloco só, que substitui o anterior em vez de empilhar — numa tarefa de 30 rodadas ele não cresce.',
    grupo: 'programa',
    especial: true,
    semToggle: true,
    selo: 'Fixo',
    fontes: [],
  },
  {
    id: 'fila-verificador',
    icone: '✅',
    nome: 'Verificador',
    descricao: 'Confere o relatório antes de entregar, em duas camadas: primeiro sem IA, conferindo no índice se cada arquivo citado existe mesmo; depois com IA, lendo o código, se o relatório se sustenta — e, se uma extensão lhe der uma ferramenta que lê as decisões do projeto, se nada as contraria. Reprovando, devolve com o motivo e a Fila volta a pesquisar.',
    grupo: 'so-fila',
    // `saida-skills` entra só enquanto uma extensão lhe empresta a ferramenta
    // (SUBAGENTES_FONTES_DE_EXTENSOES, fase 07).
    fontes: ['codigo'],
  },
  // Estes dois NÃO são subagentes: são os prompts fixos da Fila, listados aqui
  // porque é onde se olha para saber o que entra na pesquisa. `semToggle` porque
  // prompt fixo não liga nem desliga — escolhe-se no envio; `fontes: []` porque
  // não lê nada, e é o que dá a borda cinza sem token de cor novo.
  {
    id: 'seguranca',
    icone: '🛡️',
    nome: 'Segurança',
    descricao: 'Manda a Fila procurar risco de segurança: caminho sem contenção, argumento cru, segredo no código, permissão ampla demais.',
    grupo: 'prompt-fixo',
    semToggle: true,
    selo: 'No envio',
    fontes: [],
  },
  {
    id: 'melhorias',
    icone: '✨',
    nome: 'Melhorias',
    descricao: 'Manda a Fila procurar hard coding, duplicação, inconsistência de nome e coisas que já têm token ou função pronta e não estão usando.',
    grupo: 'prompt-fixo',
    semToggle: true,
    selo: 'No envio',
    fontes: [],
  },
];

function _filaAgentesDefinicoes() {
  const doChat = (typeof AGENTES_DEFINICOES !== 'undefined')
    ? AGENTES_DEFINICOES.filter(a => a.grupo === 'chat').map(a => ({ ...a, grupo: 'fila' }))
    : [];
  const deExtensoes = (typeof AGENTES_DEFINICOES !== 'undefined')
    ? AGENTES_DEFINICOES.filter(a => a.grupo === 'extensoes').map(a => ({ ...a, grupo: 'fila-extensoes' }))
    : [];
  return FILA_AGENTES_PROPRIOS.filter(a => a.grupo !== 'so-fila')
    .concat(doChat)
    .concat(deExtensoes)
    .concat(FILA_AGENTES_PROPRIOS.filter(a => a.grupo === 'so-fila'));
}

// ── Estado ligado/desligado ──────────────────────────────────────────────────

function _filaEstadoAgentes() {
  try {
    return JSON.parse(localStorage.getItem(FILA_AGENTES_ESTADO_KEY) || '{}');
  } catch (e) {
    return {};
  }
}

// Ligado por padrão: quem não foi desligado de propósito entra na pesquisa.
function _filaAgenteAtivo(id) {
  const estado = _filaEstadoAgentes();
  return estado[id] !== false;
}

function _filaToggleAgente(id) {
  const estado = _filaEstadoAgentes();
  estado[id] = !_filaAgenteAtivo(id);
  localStorage.setItem(FILA_AGENTES_ESTADO_KEY, JSON.stringify(estado));
  _filaRenderSubagentesTab();
}

function _filaConfigValor(campo) {
  const bruto = parseInt(localStorage.getItem(campo.storageKey), 10);
  if (isNaN(bruto)) return campo.padrao;
  return Math.max(campo.min, Math.min(bruto, campo.max));
}

// Pela chave, e não pela posição: esta lista já perdeu um item no meio, e quem
// lia por índice passou a receber `undefined` sem avisar.
function _filaConfigValorPorChave(chave) {
  const campo = FILA_CONFIG_CAMPOS.find(c => c.chave === chave);
  return campo ? _filaConfigValor(campo) : null;
}

// O que vai ao backend em `iniciar_fila`. Os ids dos dez são os mesmos do
// Chat, então o backend filtra contra SUBAGENTES_FILA sem tradução nenhuma.
function _filaSubagentesConfig() {
  const cfg = {};
  FILA_CONFIG_CAMPOS.forEach(c => { cfg[c.chave] = _filaConfigValor(c); });
  cfg.ativos = _filaAgentesDefinicoes()
    .filter(a => (a.grupo === 'fila' || a.grupo === 'fila-extensoes') && _filaAgenteAtivo(a.id))
    .map(a => a.id);
  cfg.contador = _filaAgenteAtivo('contador');
  cfg.verificador = _filaAgenteAtivo('fila-verificador');
  return cfg;
}

function _filaInitSubagentesConfig() {
  FILA_CONFIG_CAMPOS.forEach(campo => {
    const el = document.getElementById(campo.elId);
    if (!el) return;
    el.value = _filaConfigValor(campo);
    el.addEventListener('change', () => {
      const v = Math.max(campo.min, Math.min(parseInt(el.value, 10) || campo.padrao, campo.max));
      el.value = v;
      localStorage.setItem(campo.storageKey, String(v));
    });
  });
  const ativar = document.getElementById('btn-fila-agentes-ativar-todos');
  const desativar = document.getElementById('btn-fila-agentes-desativar-todos');
  if (ativar) ativar.addEventListener('click', () => _filaDefinirTodos(true));
  if (desativar) desativar.addEventListener('click', () => _filaDefinirTodos(false));
}

function _filaDefinirTodos(valor) {
  const estado = _filaEstadoAgentes();
  _filaAgentesDefinicoes().filter(a => !a.semToggle).forEach(a => { estado[a.id] = valor; });
  localStorage.setItem(FILA_AGENTES_ESTADO_KEY, JSON.stringify(estado));
  _filaRenderSubagentesTab();
}

// ── Render ───────────────────────────────────────────────────────────────────

// Estes cards são CONFIGURAÇÃO, e por isso não mostram mais quantas vezes cada
// subagente foi chamado: aquilo é histórico da tarefa, e mora agora no dropdown
// "Chamadas" da área de envio (`fila-chamadas.js`). Sem o contador, o card daqui
// volta a ser idêntico ao mesmo card no Chat — ele era o único filho a mais, e
// deixava cada item desta lista ~23px mais alto que o do Chat.
function _filaRenderSubagentesTab() {
  const container = document.getElementById('fila-agentes-list');
  if (!container) return;

  const definicoes = _filaAgentesDefinicoes();

  // O polling redesenha esta aba de 4 em 4 segundos. Nada aqui muda sozinho —
  // só por clique seu —, então remontar à toa era piscada pura.
  const assinatura = definicoes.map(a => `${a.id}:${_filaAgenteAtivo(a.id) ? 1 : 0}`).join(',');
  if (container.dataset.assinatura === assinatura) return;
  container.dataset.assinatura = assinatura;

  container.innerHTML = agenteFonteLegendaMarkup();

  FILA_AGENTES_GRUPOS.forEach(grupo => {
    const doGrupo = definicoes.filter(a => a.grupo === grupo.id);
    if (!doGrupo.length) return;

    const sep = document.createElement('div');
    sep.className = 'chat-agentes-separador';
    sep.textContent = grupo.titulo;
    container.appendChild(sep);

    if (grupo.dica) {
      const dica = document.createElement('p');
      dica.className = 'chat-agentes-grupo-dica';
      dica.textContent = grupo.dica;
      container.appendChild(dica);
    }

    doGrupo.forEach(agente => {
      const item = document.createElement('div');
      item.className = 'chat-agente-item' + (agente.especial ? ' chat-agente-especial' : '')
        + (agente.semToggle ? ' chat-agente-sem-toggle' : '');
      item.style.borderLeftColor = agenteFonteCor(agente);

      if (agente.semToggle) {
        const selo = document.createElement('span');
        selo.className = 'chat-agente-selo';
        selo.textContent = agente.selo || 'No envio';
        item.appendChild(selo);
      } else {
        const ativo = _filaAgenteAtivo(agente.id);
        const btn = document.createElement('button');
        btn.className = 'chat-agente-toggle ' + (ativo ? 'ativo' : 'inativo');
        btn.textContent = ativo ? 'Ativado' : 'Desativado';
        btn.dataset.agenteId = agente.id;
        btn.addEventListener('click', () => _filaToggleAgente(agente.id));
        item.appendChild(btn);
      }

      const info = document.createElement('div');
      info.className = 'chat-agente-info';

      const nome = document.createElement('span');
      nome.className = 'chat-agente-nome';
      // O emoji vem da definição, não de um mapa à parte: é o mesmo que
      // aparece na conversa e no Log, e um card sem ele obrigava a decorar
      // qual bolinha era qual.
      nome.innerHTML = escapeHtml(agenteRotuloDoCard(agente)) + agenteFonteSelosMarkup(agente);

      const desc = document.createElement('span');
      desc.className = 'chat-agente-desc';
      desc.textContent = agente.descricao;

      info.appendChild(nome);
      info.appendChild(desc);
      item.appendChild(info);
      container.appendChild(item);
    });
  });
}
