/* ══════════════════════════════════════════════════════════
   ── Este arquivo era 600 linhas, e virou três ──────────────

   Pelo teto de 500 da AMF. Cada um responde uma pergunta:

     fila-chat-tab.js          o prompt fixo e o desenho da conversa
     fila-chat-tab-sinais.js   o que a tela mostra enquanto a tarefa roda
     fila-chat-tab-blocos.js   os blocos de ação, e o envio de um complemento

   São scripts clássicos, não módulos: as funções e os `const` do topo continuam
   globais, e o `index.html` carrega os três na ordem acima.

   ── O original continua abaixo ─────────────────────────────
   FILA — sub-aba "Fila": a pesquisa como conversa.

   É a conversa do Chat, com a mesma fonte e as mesmas regras: desenha o
   HISTÓRICO da tarefa, esconde a maquinaria e colapsa cada resposta de
   subagente num bloco que só abre no clique — reusando o `_makeSubagentRound`
   do próprio Chat (`chat-mensagens.js`).

   Antes tudo vinha aberto, e uma pesquisa de doze rodadas virava uma parede de
   texto. O conteúdo inteiro não se perde: ele está na sub-aba Contexto (o que
   foi mandado ao modelo) e na sub-aba Log (o que cada subagente respondeu, com
   as ferramentas que ele usou).
══════════════════════════════════════════════════════════ */

// Mensagens que NÃO viram balão. Mesma ideia de `renderMessages`: nada disso é
// fala — é o protocolo entre o programa e o modelo, e já tem duas abas próprias.
// `prompt_fixo` entra aqui pelo mesmo motivo: sem ele, as ~30 linhas do texto
// pronto viravam um balão "👤 Tarefa" no topo de toda tarefa — esta função monta
// balão para toda mensagem sem `meta` conhecida. O Chat esconde igual; quem quiser
// ver o texto que foi mandado tem a sub-aba Contexto.
// `rastro_leitura` entrou pelo mesmo caminho e pelo mesmo motivo: o bloco
// "[LEITURA DA TAREFA]" é conta que o PROGRAMA faz para o modelo, e aparecia
// como se você tivesse escrito aquilo.
// `resposta_json` NÃO está mais aqui: a resposta do agente principal traz, antes
// do envelope, a frase em que ele diz o que vai fazer — e essa frase é dele para
// você. Ela é tratada caso a caso lá embaixo, pelo envelope: só a chamada de
// subagentes rende balão; relatório e esclarecimento continuam fora da conversa,
// porque já viram o bloco de desfecho no rodapé.
// `aviso_parada` entra aqui por antecipação: hoje a Fila não grava parcial, mas
// ela e o Chat compartilham `_makeSubagentRound` e o formato do histórico, e um
// tipo desconhecido cai no ramo final desta função e aparece como se VOCÊ
// tivesse escrito aquilo. Uma linha agora custa menos que o defeito depois.
const FILA_TIPOS_OCULTOS = ['correcao', 'aviso_sistema', 'devolucao',
                            'prompt_fixo', 'rastro_leitura', 'aviso_parada'];

// ── Prompt fixo da Fila ──────────────────────────────────────────────────────
// Um texto pronto que acompanha o envio — o equivalente a colar o mesmo trecho
// toda vez. Espelha `chat-prompt-fixo.js`, com nomes e ids próprios: os do Chat
// são procurados por id, e os dois painéis brigariam se dividissem os mesmos.
// A lista de opções também é própria: as do Chat são feitas para conversa curta.
let _filaPromptFixoSelecionado = '';
const FILA_PROMPT_FIXO_ROTULOS = {
  '': 'Nenhum',
  'seguranca': 'Segurança',
  'melhorias': 'Melhorias',
};

function _filaSetPromptFixo(nome) {
  _filaPromptFixoSelecionado = nome || '';
  const btn = document.getElementById('btn-fila-prompt-fixo');
  if (btn) {
    const rotulo = FILA_PROMPT_FIXO_ROTULOS[_filaPromptFixoSelecionado] || _filaPromptFixoSelecionado;
    btn.textContent = `${rotulo} ▾`;
  }
  document.querySelectorAll('#fila-prompt-fixo-panel .prompt-fixo-option').forEach(opt => {
    opt.classList.toggle('ativo', (opt.dataset.promptFixo || '') === _filaPromptFixoSelecionado);
  });
}

function _initFilaPromptFixoPanel() {
  const btn = document.getElementById('btn-fila-prompt-fixo');
  const panel = document.getElementById('fila-prompt-fixo-panel');
  // A trava `_wired` é a mesma do Chat: sem ela, cada render refiava o painel e
  // os handlers se acumulavam.
  if (!btn || !panel || btn._wired) return;
  btn._wired = true;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('hidden');
  });
  panel.querySelectorAll('.prompt-fixo-option').forEach(opt => {
    opt.addEventListener('click', () => {
      _filaSetPromptFixo(opt.dataset.promptFixo || '');
      panel.classList.add('hidden');
    });
  });
  document.addEventListener('click', (e) => {
    if (!panel.classList.contains('hidden') && !panel.contains(e.target) && e.target !== btn) {
      panel.classList.add('hidden');
    }
  });
}

// O teto que valeu para ESTA tarefa. Ele é carimbado nela quando entra em jogo,
// então uma tarefa antiga não passa a mostrar o teto que você configurou hoje —
// diferente do Chat, onde só existe o valor atual.
function _filaMaxRodadasDaTarefa(tarefa) {
  return (tarefa && tarefa.max_rodadas)
    || (typeof _filaConfigValorPorChave === 'function'
        ? _filaConfigValorPorChave('max_rodadas') : null);
}

function _filaBolha(titulo, corpo, cls) {
  const div = document.createElement('div');
  div.className = `chat-message ${cls || ''}`;
  const head = document.createElement('div');
  head.className = 'chat-message-header';
  head.textContent = titulo;
  const body = document.createElement('div');
  body.className = 'chat-message-content';
  body.textContent = corpo || '(sem conteúdo)';
  div.appendChild(head);
  div.appendChild(body);
  return div;
}

async function _filaRenderChatTab() {
  const empty = document.getElementById('fila-empty');
  const msgs = document.getElementById('fila-chat-messages');
  const tarefa = _filaTarefas.find(t => t.id === _filaSelecionadaId);

  const mostrarVazio = html => {
    empty.innerHTML = html;
    empty.classList.remove('hidden');
    msgs.classList.add('hidden');
    msgs.dataset.assinatura = '';
  };

  if (!tarefa) {
    mostrarVazio('<p>Nenhuma tarefa selecionada.</p><p>Crie uma nova tarefa para começar.</p>');
    return;
  }

  // Tarefa recém-criada: ainda não há conversa nenhuma, e o que falta é você
  // dizer o que quer. O estado vazio explica isso em vez de mostrar uma bolha
  // em branco.
  if (!(tarefa.texto || '').trim()) {
    mostrarVazio('<p>Tarefa nova.</p><p>Escreva no campo abaixo o que você quer pesquisar.</p>');
    return;
  }

  empty.classList.add('hidden');
  msgs.classList.remove('hidden');

  // O histórico é a mesma fonte da sub-aba Contexto. Enquanto a tarefa não
  // rodou pela primeira vez ele ainda não existe, e a tarefa que você escreveu
  // é toda a conversa que há.
  let mensagens = [];
  try {
    mensagens = await window.pywebview.api.carregar_fila_historico(
      currentProject, tarefa.id) || [];
  } catch (e) { mensagens = []; }
  // ⚠️ Guarda de corrida. A tarefa foi capturada ANTES do `await`, e o clique
  // noutra é síncrono: clicando rápido entre duas, a conversa da primeira
  // chegava depois e era desenhada com a SEGUNDA selecionada na lista. O padrão
  // é o de `_filaAtualizarUsoJanelaDaTarefa`, em `fila-contexto-tab.js`.
  if (_filaSelecionadaId !== tarefa.id) return;

  /* Só redesenha quando mudou de verdade. O polling volta a cada 4 segundos, e
     remontar a conversa à toa fechava todo bloco de subagente que você tivesse
     aberto — um `<details>` recém-criado nasce fechado — e ainda piscava.
     Entram na assinatura também os campos que decidem o desfecho no rodapé
     (aviso, erro, botão de relatório), porque eles mudam sem a conversa mudar. */
  const ultima = mensagens[mensagens.length - 1] || {};
  // ⚠️ `proxima_continuacao` entra aqui pelo mesmo motivo que entra na
  // assinatura da lista: marcar uma tarefa não muda status, nem mensagem, nem
  // relatório — nada do que já estava nesta linha. Sem ela, o ✓ do botão
  // marcado só apareceria quando outra coisa qualquer mudasse.
  // ⚠️ A FALA do agente entra na assinatura. Ela é um campo do `meta`, e a
  // assinatura só olhava o tamanho do `content`: uma fala nova podia chegar sem
  // mudar nada do que está listado aqui, e então ela ficava certa no disco e a
  // tela nunca mudava — sem erro nenhum para desconfiar.
  const assinatura = [tarefa.id, mensagens.length, (ultima.content || '').length,
                      ((ultima.meta || {}).fala || '').length,
                      tarefa.status, tarefa.relatorio_path || '',
                      tarefa.motivo_esclarecimento || '', tarefa.erro || '',
                      tarefa.proxima_continuacao || ''].join('|');
  if (msgs.dataset.assinatura === assinatura) return;
  const trocouTarefa = (msgs.dataset.tarefa !== tarefa.id);
  msgs.dataset.assinatura = assinatura;
  msgs.dataset.tarefa = tarefa.id;
  msgs.innerHTML = '';

  if (!mensagens.length) {
    msgs.appendChild(_filaBolha('👤 Tarefa', tarefa.texto_original || tarefa.texto, 'user'));
  } else {
    // A rodada não vem carimbada na mensagem: ela É a ordem em que os blocos de
    // resultado aparecem. Contar aqui evita um campo novo no histórico que só a
    // tela usaria — e que ficaria vazio em toda tarefa já gravada em disco.
    let rodada = 0;
    mensagens.forEach((m, i) => {
      if (m.role === 'system') return;
      const tipo = (m.meta && m.meta.tipo) || m.role;
      if (FILA_TIPOS_OCULTOS.includes(tipo)) return;

      if (tipo === 'resposta_json') {
        // ⛔ Este `if` FICA. Só a chamada de subagentes vira balão: o relatório
        // e o pedido de esclarecimento já aparecem inteiros no rodapé, com o
        // tratamento que cada um merece, e repeti-los em prosa seria ruído.
        //
        // É igual ao Chat: quando o modelo FALA, aparece; quando aquilo não é
        // fala e sim uma instrução de chamar subagente, não aparece. O system
        // prompt diz isso ao modelo, senão ele gasta tokens escrevendo no
        // escuro numa frase que ninguém vai ler.
        if (!m.meta || m.meta.envelope !== 'chamadas') return;
        // A fala vem CARIMBADA no meta desde a obra do esquema — o backend já a
        // recebeu separada do envelope. O recorte no texto cru fica de reserva
        // para as tarefas gravadas antes disso, e é justamente ele que falhava
        // com `<think>` em volta ou com o JSON cortado no meio.
        const texto = (m.meta.fala || '').trim()
          || separarChamadaDoTexto(m.content).texto;
        if (texto) {
          msgs.appendChild(_filaBolha(
            `${FILA_AGENTE_PRINCIPAL.icone} ${FILA_AGENTE_PRINCIPAL.nome}`,
            texto, 'assistant'));
        }
        return;
      }

      if (tipo === 'resultado_subagentes') {
        const resultados = (m.meta && m.meta.resultados) || [];
        if (resultados.length) {
          rodada += 1;
          msgs.appendChild(_makeSubagentRound(resultados, rotuloDaRodada(
            rodada, resultados.length, _filaMaxRodadasDaTarefa(tarefa))));
        }
        return;
      }
      // Sobram as suas mensagens. Depois do filtro acima, a tarefa é a única
      // sem marca — o complemento sempre carrega a dele, posta por
      // `complementar_tarefa_fila` no momento em que você aperta Enviar.
      // Todo tipo novo que o backend criar precisa entrar em FILA_TIPOS_OCULTOS
      // ou vai cair aqui e aparecer como se você tivesse escrito.
      const titulo = (tipo === 'complemento_usuario') ? '👤 Complemento seu' : '👤 Tarefa';
      msgs.appendChild(_filaBolha(titulo, m.content, 'user'));
    });
  }

  // ⚠️ O REPLAY vem AQUI: depois do `msgs.innerHTML = ''` e do histórico em
  // disco, dentro do ramo de redesenho. É o que devolve os cartões da rodada em
  // curso a quem saiu da tarefa e voltou no meio — o disco só recebe no fim da
  // rodada, então sem isto essa parte da conversa simplesmente não existe.
  // Terminada a tarefa, a lista é esvaziada e este trecho não faz nada.
  if (tarefa.status === 'pesquisando') _filaRepintarSinais(msgs, tarefa.id);
  else _filaEsquecerSinais(tarefa.id);

  // O desfecho não sai da conversa: ele sai do estado da tarefa, já tratado.
  // O JSON cru que o modelo devolveu está no Contexto e no Log.
  if (tarefa.status === 'precisa_de_voce' && tarefa.motivo_esclarecimento) {
    msgs.appendChild(_filaBolha('⚠ Precisa de você', tarefa.motivo_esclarecimento,
                                'assistant fila-bolha-alerta'));
  }
  if (tarefa.status === 'falhou' && tarefa.erro) {
    msgs.appendChild(_filaBolha('⚠ Falhou', tarefa.erro, 'assistant fila-bolha-erro'));
  }
  if (tarefa.status === 'pesquisando') {
    msgs.appendChild(_filaBlocoDestravar(tarefa));
  }
  if (FILA_STATUS_COM_RELATORIO.includes(tarefa.status) && tarefa.relatorio_path) {
    msgs.appendChild(_filaBlocoRelatorio(tarefa));
  }
  if (FILA_STATUS_CONTINUAVEL.includes(tarefa.status)) {
    msgs.appendChild(_filaBlocoContinuar(tarefa));
  }

  // Trocou de tarefa: mostra o fim. Chegou conteúdo sozinho: só desce se você
  // já estava embaixo — senão lê-se um parágrafo e se é arrastado para o rodapé.
  if (trocouTarefa) rolarAoFimAgora(msgs);
  else rolarAoFimSePresa(msgs);
}
