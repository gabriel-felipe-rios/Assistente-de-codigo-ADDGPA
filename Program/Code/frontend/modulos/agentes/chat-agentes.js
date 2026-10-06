// ── Chat Agentes — sub-aba Agentes do chat ───────────────────────────────────
//
// ── Este arquivo era 728 linhas, e virou dois ─────────────────────────────
//
// Pelo teto de 500 da AMF:
//
//   chat-agentes.js       quem existe, quem está ligado, e a tela deles
//   chat-agentes-log.js   o que eles fizeram, e quanto custou
//
// São scripts clássicos, não módulos: as funções e os `const` do topo continuam
// globais, e o `index.html` carrega os dois na ordem acima.
//
// ⚠️ `AGENTES_DEFINICOES` FICA AQUI, e é a única fonte do nome de exibição de
// cada agente. O log lê daqui; escrever o nome à mão lá faria os dois divergirem
// na primeira renomeação.

const AGENTES_ESTADO_KEY = 'agentes_estado';

// Os grupos da lista, na ordem em que aparecem. O `grupo` é declarado em
// cada item — antes o separador era deduzido por vizinhança (item anterior é
// especial e este não é), e isso quebrava calado quando a ordem do array mudava.
const AGENTES_GRUPOS = [
  {
    id: 'principal',
    titulo: 'Agente principal',
    dica: 'Quem conversa com você. Não liga nem desliga: sem ele não há chat.',
  },
  {
    id: 'programa',
    titulo: 'Acionado pelo programa',
    dica: 'Não é o modelo que decide chamar: o programa injeta sozinho, a cada rodada.',
  },
  {
    id: 'chat',
    titulo: 'Subagentes chamados pelo chat',
    dica: 'O modelo escolhe na hora quem chamar, e pode chamar até 4 em paralelo.',
  },
  {
    // Os cards deste grupo NÃO estão escritos abaixo: `subagentes-de-extensoes.js`
    // os põe em AGENTES_DEFINICOES a cada vez que a lista de extensões muda.
    id: 'extensoes',
    titulo: 'De extensões',
    dica: 'Subagentes que uma extensão ligada acrescentou. O modelo os chama como aos de cima; desligar a extensão tira o card.',
  },
  {
    id: 'prompt-fixo',
    titulo: 'Prompts fixos',
    dica: 'Textos prontos que acompanham a sua mensagem. Você escolhe no seletor ao lado da caixa de envio — por isso não têm liga/desliga aqui.',
  },
];

const AGENTES_DEFINICOES = [
  {
    id: 'chat',
    icone: '💬',
    nome: 'Chat',
    descricao: 'Recebe a sua mensagem, decide quais subagentes chamar e escreve a resposta. É quem conversa com você.',
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
    descricao: 'Determinístico, sem LLM. Após cada rodada, avisa o modelo quantas rodadas de chamadas de subagentes ainda restam.',
    grupo: 'programa',
    especial: true,
    fontes: [],
  },
  {
    // Sem toggle porque não há chave para desligá-lo — ao contrário do Contador,
    // que tem `cfg.contador`. O card existe para você saber que ele existe: sem
    // ele, o bloco "[LEITURA DA TAREFA]" aparecia na aba Contexto sem que nada
    // na tela dissesse de onde vinha.
    id: 'rastro',
    icone: '📖',
    nome: 'Leitura da tarefa',
    descricao: 'Determinístico, sem LLM. A cada rodada, refaz a conta de quais partes de cada artefato já foram lidas e quais caminhos já deram erro. É um bloco só, que substitui o anterior em vez de empilhar.',
    grupo: 'programa',
    especial: true,
    semToggle: true,
    selo: 'Fixo',
    fontes: [],
  },
  {
    id: 'buscador',
    icone: '🔍',
    nome: 'Buscador',
    descricao: 'Encontra onde algo existe no código: função, classe, variável ou texto. Devolve caminho, linha e trecho.',
    grupo: 'chat',
    fontes: ['codigo'],
  },
  {
    id: 'navegador',
    icone: '📁',
    nome: 'Navegador',
    descricao: 'Lista arquivos e subpastas de uma pasta do projeto. Sem LLM — resposta direta.',
    grupo: 'chat',
    fontes: ['codigo'],
  },
  {
    id: 'leitor',
    icone: '📖',
    nome: 'Leitor',
    descricao: 'Lê um arquivo específico e responde uma pergunta precisa sobre ele.',
    grupo: 'chat',
    fontes: ['codigo'],
  },
  {
    id: 'arquiteto',
    icone: '🏛️',
    nome: 'Arquiteto',
    descricao: 'Explica fluxos, organização e estrutura geral do projeto com base na documentação gerada.',
    grupo: 'chat',
    // Dois selos: além do pipeline e do resumo de pastas, ele tem ler_arquivo.
    fontes: ['doc-gerada', 'codigo'],
  },
  {
    id: 'analista',
    icone: '🧩',
    nome: 'Analista',
    descricao: 'Avalia o impacto de uma mudança planejada: quais arquivos e funções serão afetados e por quê. Lê o índice de identificadores para mapear quem usa quem.',
    grupo: 'chat',
    fontes: ['doc-gerada', 'codigo'],
  },
  {
    id: 'semantico',
    icone: '🧠',
    nome: 'Semântico',
    descricao: 'Acha por significado, não por texto literal. Usa o banco de embeddings do projeto — precisa do agente Embedding Semântico gerado.',
    grupo: 'chat',
    fontes: ['doc-gerada'],
  },
  // Os prompts fixos entram aqui só para você ver o que cada um faz sem precisar
  // selecionar e conferir na aba Contexto. `semToggle` porque não há o que ligar:
  // um prompt fixo só age na mensagem em que você o escolhe, no seletor de envio.
  // O `id` é a chave do arquivo em prompts/Prompts fixos/.
  {
    id: 'estruturar',
    icone: '📝',
    nome: 'Estruturar',
    descricao: 'Reescreve o seu pedido em seções com tags XML: tarefa principal, subtarefas, restrições e contexto. Usa os nomes reais de arquivo e função quando há documentação no contexto.',
    grupo: 'prompt-fixo',
    semToggle: true,
    fontes: [],
  },
  {
    id: 'estruturar-e-quebrar-tarefa',
    icone: '✂️',
    nome: 'Estruturar e quebrar tarefa',
    descricao: 'Além de estruturar, divide o pedido em 2 a 5 subtarefas independentes, que possam ser feitas separadamente.',
    grupo: 'prompt-fixo',
    semToggle: true,
    fontes: [],
  },
  {
    id: 'revisar',
    icone: '🧐',
    nome: 'Revisar',
    descricao: 'Relê a conversa inteira procurando afirmação que não se sustente no código, conferindo cada ponto com os subagentes. Para usar quando você duvidar, antes de levar o resultado para fora.',
    grupo: 'prompt-fixo',
    semToggle: true,
    fontes: [],
  },
];

// ⚠ Duplicata à mão de SUBAGENTES_TODOS (backend). Se um id não estiver nas
// duas listas, o frontend manda e o backend descarta em silêncio.
const SUBAGENTES_IDS = ['buscador', 'navegador', 'leitor', 'arquiteto', 'analista',
                        'semantico'];
const SUBAGENTES_MAX_RODADAS_KEY = 'subagentes_max_rodadas';

// O campo numérico da caixa de configuração: valor global em localStorage,
// override por chat quando há chat aberto. Era uma lista de dois — o teto de
// tokens da resposta saiu para Configurações › Ferramentas dos subagentes.
const SUBAGENTES_CAMPOS = [
  { elId: 'subagentes-max-rodadas', chave: 'max_rodadas',
    storageKey: SUBAGENTES_MAX_RODADAS_KEY, min: 1, max: 9, padrao: 2 },
  // O teto de tokens da resposta do subagente saiu daqui: ele vale para o
  // programa inteiro e agora mora em Configurações › Ferramentas dos
  // subagentes, num lugar só em vez de uma cópia no Chat e outra na Fila.
];

function getSubagentesAtivos() {
  // Os de extensão entram pelo grupo, lidos na hora: a lista muda sem reiniciar.
  const deExtensoes = AGENTES_DEFINICOES.filter(a => a.grupo === 'extensoes').map(a => a.id);
  return SUBAGENTES_IDS.concat(deExtensoes).filter(isAgenteAtivo);
}

function _valorCampoSubagentes(campo) {
  const input = document.getElementById(campo.elId);
  const v = parseInt(input ? input.value : '', 10);
  return (v >= campo.min && v <= campo.max) ? v : campo.padrao;
}

function getMaxRodadasSubagentes() {
  return _valorCampoSubagentes(SUBAGENTES_CAMPOS[0]);
}

function _initCamposSubagentes() {
  SUBAGENTES_CAMPOS.forEach(campo => {
    const input = document.getElementById(campo.elId);
    if (!input || input._wired) return;
    input._wired = true;
    const salvo = parseInt(localStorage.getItem(campo.storageKey) || '', 10);
    if (salvo >= campo.min && salvo <= campo.max) input.value = salvo;
    input.addEventListener('change', () => {
      const v = _valorCampoSubagentes(campo);
      if (!_chatSubagentesOverride && (typeof currentChatId !== 'undefined') && currentChatId) {
        _chatSubagentesOverride = {
          estado: _snapshotEstadoAgentes(),
          max_rodadas: getMaxRodadasSubagentes(),
        };
      }
      if (_chatSubagentesOverride) {
        _chatSubagentesOverride[campo.chave] = v;
        _persistChatSubagentes();
      } else {
        localStorage.setItem(campo.storageKey, String(v));
      }
    });
  });
}

function _loadAgentesEstado() {
  try {
    return JSON.parse(localStorage.getItem(AGENTES_ESTADO_KEY) || '{}');
  } catch {
    return {};
  }
}

function _saveAgentesEstado(estado) {
  localStorage.setItem(AGENTES_ESTADO_KEY, JSON.stringify(estado));
}

// Estado por chat: quando um chat tem subagentes.json salvo, ele vence o estado global
let _chatSubagentesOverride = null; // {estado: {...}, max_rodadas: N} | null

function setChatSubagentesOverride(data) {
  _chatSubagentesOverride = (data && data.estado) ? data : null;
  // O `subagentes.json` deste chat pode guardar o id ANTIGO de um subagente
  // que uma extensão renomeou (`antes` no manifesto, fase 07, D55): o valor
  // passa para o id novo e o chat grava na hora.
  if (_chatSubagentesOverride && typeof subagentesMigrarEstado === 'function'
      && subagentesMigrarEstado(_chatSubagentesOverride.estado)) {
    _persistChatSubagentes();
  }
  renderChatAgentes();
  SUBAGENTES_CAMPOS.forEach(campo => {
    const input = document.getElementById(campo.elId);
    if (!input) return;
    const doChat = _chatSubagentesOverride && _chatSubagentesOverride[campo.chave];
    if (doChat) {
      input.value = doChat;
      return;
    }
    const salvo = parseInt(localStorage.getItem(campo.storageKey) || '', 10);
    input.value = (salvo >= campo.min && salvo <= campo.max) ? salvo : campo.padrao;
  });
}

function _persistChatSubagentes() {
  if (typeof currentProject === 'undefined' || typeof currentChatId === 'undefined') return;
  if (!currentProject || !currentChatId || !_chatSubagentesOverride) return;
  window.pywebview.api.save_chat_subagentes(
    currentProject, currentChatId,
    _chatSubagentesOverride.estado, _chatSubagentesOverride.max_rodadas,
    _chatSubagentesOverride.max_tokens
  );
}

function isAgenteAtivo(id) {
  if (_chatSubagentesOverride && id in _chatSubagentesOverride.estado) {
    return _chatSubagentesOverride.estado[id] === true;
  }
  // Sem estado salvo ainda: ativo por padrão.
  const estado = _loadAgentesEstado();
  return id in estado ? estado[id] === true : true;
}

// Só os cards que têm liga/desliga entram no estado salvo. Os prompts fixos
// aparecem na lista, mas não têm estado — gravá-los sujaria o subagentes.json
// de cada chat com chaves que ninguém lê.
function _agentesComToggle() {
  return AGENTES_DEFINICOES.filter(a => !a.semToggle);
}

function _snapshotEstadoAgentes() {
  const snapshot = {};
  _agentesComToggle().forEach(a => { snapshot[a.id] = isAgenteAtivo(a.id); });
  return snapshot;
}

function _setTodosAgentes(ativo) {
  const chatAberto = (typeof currentChatId !== 'undefined') && currentChatId;

  if (chatAberto) {
    if (!_chatSubagentesOverride) {
      _chatSubagentesOverride = {
        estado: _snapshotEstadoAgentes(),
        max_rodadas: getMaxRodadasSubagentes(),
      };
    }
    _agentesComToggle().forEach(a => { _chatSubagentesOverride.estado[a.id] = ativo; });
    _persistChatSubagentes();
  } else {
    const estado = _loadAgentesEstado();
    _agentesComToggle().forEach(a => { estado[a.id] = ativo; });
    _saveAgentesEstado(estado);
  }
  renderChatAgentes();
}

function _initBulkButtons() {
  const btnOn = document.getElementById('btn-agentes-ativar-todos');
  const btnOff = document.getElementById('btn-agentes-desativar-todos');
  if (btnOn && !btnOn._wired) {
    btnOn._wired = true;
    btnOn.addEventListener('click', () => _setTodosAgentes(true));
  }
  if (btnOff && !btnOff._wired) {
    btnOff._wired = true;
    btnOff.addEventListener('click', () => _setTodosAgentes(false));
  }
}

function initChatAgentes() {
  renderChatAgentes();
  _initCamposSubagentes();
  _initBulkButtons();
}

function renderChatAgentes() {
  const container = document.getElementById('chat-agentes-list');
  if (!container) return;

  // A legenda de FONTE vem antes do primeiro separador de grupo. São dois
  // eixos convivendo na mesma lista: o grupo (separador) diz QUEM aciona o
  // agente; a borda e o selo dizem O QUE ele consegue ler.
  container.innerHTML = agenteFonteLegendaMarkup();

  AGENTES_GRUPOS.forEach(grupo => {
    const doGrupo = AGENTES_DEFINICOES.filter(a => a.grupo === grupo.id);
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
      item.className = 'chat-agente-item'
        + (agente.especial ? ' chat-agente-especial' : '')
        + (agente.semToggle ? ' chat-agente-sem-toggle' : '');
      // A borda esquerda passa a ser a FONTE, não mais uma marca solta de
      // "especial" e "sem toggle" que nenhuma legenda explicava. A cor vem do
      // registry, então a Fila reaproveita a mesma regra.
      item.style.borderLeftColor = agenteFonteCor(agente);

      if (agente.semToggle) {
        // Sem liga/desliga, mas com um selo no lugar do botão para a coluna da
        // esquerda não ficar vazia e os cards não parecerem desalinhados.
        const selo = document.createElement('span');
        selo.className = 'chat-agente-selo';
        selo.textContent = agente.selo || 'No envio';
        item.appendChild(selo);
      } else {
        const ativo = isAgenteAtivo(agente.id);
        const btn = document.createElement('button');
        btn.className = 'chat-agente-toggle ' + (ativo ? 'ativo' : 'inativo');
        btn.textContent = ativo ? 'Ativado' : 'Desativado';
        btn.dataset.agenteId = agente.id;
        btn.addEventListener('click', () => _toggleAgente(agente.id));
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

function _toggleAgente(id) {
  const novo = !isAgenteAtivo(id);
  const chatAberto = (typeof currentChatId !== 'undefined') && currentChatId;

  if (chatAberto) {
    // Salva por chat (subagentes.json na pasta do chat)
    if (!_chatSubagentesOverride) {
      _chatSubagentesOverride = {
        estado: _snapshotEstadoAgentes(),
        max_rodadas: getMaxRodadasSubagentes(),
      };
    }
    _chatSubagentesOverride.estado[id] = novo;
    _persistChatSubagentes();
  } else {
    // Sem chat aberto: muda o padrão global
    const estado = _loadAgentesEstado();
    estado[id] = novo;
    _saveAgentesEstado(estado);
  }
  renderChatAgentes();
}

