/* ══════════════════════════════════════════════════════════
   ── Este arquivo era 730 linhas, e virou três ──────────────

   Pelo teto de 500 da AMF. Cada um responde uma pergunta:

     chat-mensagens.js          desenhar uma mensagem já existente
     chat-mensagens-stream.js   o dono do streaming, e o desenho ao vivo
     chat-mensagens-ponte.js    as chamadas que o Python faz na tela

   São scripts clássicos, não módulos: as funções e os `let` do topo continuam
   globais, e o `index.html` carrega os três na ordem acima.
   ══════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════
   A FALA QUE VEM ANTES DA CHAMADA

   O modelo quase sempre escreve uma frase antes do JSON de chamada — "vou
   verificar quem usa essas constantes antes de propor a unificação". Essa frase
   é resposta dele para você, e sumia da conversa: a mensagem inteira era
   escondida por causa do envelope grudado no fim dela. Ficava um buraco entre a
   sua pergunta e os cartõezinhos dos subagentes.

   Aqui a mensagem é cortada em duas: o que ele DISSE fica como balão; o
   envelope sai, porque ele já vira os cartões logo abaixo e a íntegra está na
   aba Contexto e no Log.

   Nada disso mexe no que é enviado ao modelo nem no que é gravado — é corte de
   tela, feito na hora de desenhar.
══════════════════════════════════════════════════════════ */

// Onde começa o envelope de chamada dentro do texto cru, ou -1.
//
// `exigirFechamento` é a trava contra o falso positivo: o envelope de verdade é
// sempre o RABO da mensagem. Uma resposta que apenas CITA um JSON com
// "chamadas" no meio da explicação — coisa perfeitamente possível num programa
// que fala sobre si mesmo — continua inteira. Durante o streaming a trava fica
// solta, porque ali o JSON ainda não terminou de chegar.
function _indiceDaChamada(raw, exigirFechamento) {
  const chave = raw.search(/"chamadas"\s*:/);
  if (chave < 0) return -1;
  let ini = raw.lastIndexOf('{', chave);
  if (ini < 0) return -1;
  // A cerca de código, quando existe, faz parte do envelope: cortar só no `{`
  // deixaria um ```json órfão no fim do balão.
  const antes = raw.slice(0, ini);
  const cerca = antes.lastIndexOf('```');
  if (cerca >= 0 && /^[a-zA-Z]*\s*$/.test(antes.slice(cerca + 3))) ini = cerca;
  if (exigirFechamento) {
    const resto = raw.slice(ini).trimEnd().replace(/```$/, '').trimEnd();
    if (!resto.endsWith('}')) return -1;
  }
  return ini;
}

// `exigirFechamento` só é dispensado por quem JÁ SABE que ali há um envelope —
// hoje, a mensagem marcada como `chamada_invalida`. Ver o porquê em
// `renderMessages`.
function separarChamadaDoTexto(bruto, exigirFechamento = true) {
  const raw = bruto || '';
  const i = _indiceDaChamada(raw, exigirFechamento);
  if (i < 0) return { texto: raw, chamada: false };
  return { texto: raw.slice(0, i).trim(), chamada: true };
}

// A etiqueta de uma rodada de subagentes. É a conta que a Fila já mostrava no
// dropdown "Chamadas" — "Rodada 2 de 3" —, agora também na conversa: sem ela,
// duas fileiras de cartões parecidas não diziam onde uma acabou e a outra
// começou, nem quanto ainda cabe antes de o teto ser atingido.
//
// ⚠ O total é o que está configurado AGORA. Numa conversa antiga, que rodou com
// outro teto, o número da direita pode não ser o que valeu na época — o teto não
// é gravado junto da mensagem.
//
// ⚠ E o total pode ficar MENOR que a rodada, de propósito: retomar concede
// rodadas só naquela conversa, sem tocar no teto configurado — com teto 2 e uma
// retomada, a 3ª rodada existe de verdade. Passando do teto, o número da direita
// não significa mais nada e some ("Rodada 3", não "Rodada 3 de 2"): é melhor não
// dizer do que dizer errado.
function rotuloDaRodada(rodada, quantos, total) {
  const alvo = (total && rodada <= total)
    ? `Rodada ${rodada} de ${total}` : `Rodada ${rodada}`;
  const gente = quantos === 1 ? '1 subagente' : `${quantos} subagentes`;
  return `${alvo} · ${gente}`;
}

// O texto da faixa mora num lugar só. Ele era escrito duas vezes — no
// redesenho da conversa e no fim do streaming —, e duas cópias de uma frase
// divergem no primeiro conserto.
const NOTA_TETO_ESTOUROU =
  '⚠ O Chat pediu mais uma rodada de subagentes, mas o teto de rodadas '
  + 'desta conversa já tinha acabado — a chamada não foi executada.';

// As duas faixas do "Parar", uma por estágio. Mesmo lugar único da de cima, e
// pelo mesmo motivo.
//
// ⚠️ O estágio 1 PRECISA da faixa dele. Sem ela a conversa termina numa fileira
// de cartões de subagente, sem resposta e sem explicação nenhuma — o que parece
// defeito do programa, e não uma parada que você mandou.
//
// ⛔ As duas são SEM BOTÃO. A retomada recusa este tipo de mensagem por
// desenho, e é bom que recuse: ela faz `messages.pop()` e reexecutaria um JSON
// truncado.
const NOTA_PARADA = {
  1: '⚠ Você parou aqui. A rodada em curso terminou e nada mais foi pedido ao modelo.',
  2: '⚠ Você parou aqui. A resposta ficou pela metade.',
};

function _chatMaxRodadas() {
  return (typeof getMaxRodadasSubagentes === 'function') ? getMaxRodadasSubagentes() : null;
}

// A nota do programa dentro da conversa: não é fala de ninguém, é o programa
// explicando por que aquela mensagem termina onde termina.
// `comBotao` é opcional: a nota só INFORMA por padrão, e passa a informar E
// OFERECER quando quem a desenha sabe que há o que fazer a respeito. Segue o
// componente "Faixa de aviso com ação" dos Padrões de interface — texto à
// esquerda, botão ao lado, ação só no clique.
function _notaDoPrograma(container, texto, comBotao) {
  const nota = document.createElement('div');
  nota.className = 'chat-nota-programa';
  if (!comBotao) {
    nota.textContent = texto;
    container.appendChild(nota);
    return nota;
  }
  nota.classList.add('tem-acao');
  const fala = document.createElement('span');
  fala.textContent = texto;
  nota.appendChild(fala);
  const rodadas = _chatMaxRodadas() || 1;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-special btn-sm';
  // ⚠️ `data-trava-ia` é o que faz `aplicarTravaIA` alcançar este botão. Sem
  // ele, com as Rotinas ou a Fila segurando a janela do LM Studio o botão
  // continuava aceso, e o clique virava um balão vermelho — o backend recusava,
  // e a tela só descobria depois. Ele é criado em tempo de execução, então
  // precisa da marca aqui e de uma passada da trava logo abaixo.
  btn.dataset.travaIa = 'chat';
  btn.textContent = `Retomar com mais ${rodadas} rodada${rodadas !== 1 ? 's' : ''}`;
  btn.title = 'executa a chamada que ficou barrada e segue de onde parou, '
    + 'sem refazer o que já rodou; vale só nesta conversa';
  btn.addEventListener('click', () => {
    btn.disabled = true;
    retomarRodadasDoChat(nota, btn);
  });
  nota.appendChild(btn);
  container.appendChild(nota);
  // O botão acabou de nascer: a trava já pode estar tomada, e ninguém vai
  // reaplicá-la até a próxima pulsação de 4 s. Aplica agora, com o último
  // estado conhecido.
  if (typeof reaplicarTravaIA === 'function') reaplicarTravaIA();
  return nota;
}

/**
 * Troca o botão "Retomar" pelo selo "mais N rodadas concedidas".
 *
 * ⚠️ Existe porque o botão continuava aparecendo DEPOIS de já ter sido usado.
 * Enquanto a retomada roda, o que está gravado em disco ainda é a chamada
 * barrada — sair do chat e voltar redesenhava a faixa do zero e oferecia de
 * novo o que já estava em andamento. Quem carimba a marca é o backend
 * (`retomar_rodadas_chat`, meta `rodadas_concedidas`), e ela é gravada antes de
 * o worker subir, justo para que este redesenho a encontre.
 *
 * O que fica é um SELO, e não o silêncio: o teto ter estourado aconteceu de
 * verdade e continua explicando por que a resposta parou ali. O selo registra
 * uma decisão SUA sobre aquele item — o mesmo caso de `.fila-selo-continuar`,
 * na Fila (Padrões de interface › Componentes › Selo).
 */
function _chatSeloConcedidas(nota, rodadas) {
  if (!nota || !rodadas) return;
  const btn = nota.querySelector('button');
  if (btn) btn.remove();
  if (nota.querySelector('.chat-selo-concedidas')) return;
  nota.classList.add('tem-acao');
  const selo = document.createElement('span');
  selo.className = 'chat-selo-concedidas';
  selo.textContent = `+${rodadas} rodada${rodadas !== 1 ? 's' : ''} concedida${rodadas !== 1 ? 's' : ''}`;
  selo.title = 'Você já mandou retomar esta chamada. Não há o que clicar de novo aqui.';
  nota.appendChild(selo);
}

// Renderização de mensagens e streaming da conversa.
function renderMessages(messages) {
  const container = document.getElementById('chat-messages');
  container.innerHTML = '';
  const total = _chatMaxRodadas();
  let rodada = 0;
  messages.forEach((m, i) => {
    if (m.role === 'system') return; // system prompts só aparecem na aba Contexto
    const tipo = m.meta && m.meta.tipo;
    if (tipo === 'correcao' || tipo === 'prompt_fixo' ||
        tipo === 'contexto_regras' || tipo === 'rastro_leitura' ||
        tipo === 'aviso_parada') {
      // Maquinaria pura: correções, prompt fixo colado, regras injetadas, o
      // bloco de leitura da tarefa e o recado ao modelo de que o turno foi
      // cortado. Nada disso é fala de ninguém, então não vira balão — só
      // aparece na aba Contexto e no Log.
      return;
    }
    if (tipo === 'resposta_parada') {
      // O pedaço que o "Parar" interrompeu: fica a fala, e a faixa por baixo
      // explica por que ela termina onde termina.
      //
      // ⚠️ Este ramo é o que impede o parcial de virar um balão de resposta
      // NORMAL — que é o oposto do objetivo, e não daria erro nenhum para
      // desconfiar. No estágio 1 não há fala nenhuma, e só a faixa aparece.
      if (m.content) appendMessage('assistant', m.content, false);
      _notaDoPrograma(container, NOTA_PARADA[(m.meta && m.meta.estagio) >= 2 ? 2 : 1]);
      return;
    }
    if (tipo === 'chamada_subagentes' || tipo === 'chamada_invalida') {
      // Aqui está a fala que se perdia: o envelope some, o que ele disse fica.
      //
      // ⚠️ `chamada_invalida` é, POR DEFINIÇÃO, JSON quebrado — e o corte exigia
      // o fecho `}`. Sem ele, `separarChamadaDoTexto` desistia e devolvia a
      // mensagem inteira: ao reabrir o chat, o envelope cru virava o balão da
      // resposta, exatamente o que o backend evita na hora
      // (`discardStreaming()`) confiando que a tela o esconde depois.
      // Para ela o fecho não é exigido: a MARCA já afirma que ali há envelope.
      const { texto } = separarChamadaDoTexto(m.content, tipo !== 'chamada_invalida');
      if (texto) appendMessage('assistant', texto, false);
      return;
    }
    if (tipo === 'resultado_subagentes') {
      const resultados = m.meta.resultados || [];
      if (resultados.length) {
        rodada += 1;
        container.appendChild(_makeSubagentRound(
          resultados, rotuloDaRodada(rodada, resultados.length, total)));
      }
      return;
    }
    if (tipo === 'chamada_barrada') {
      // Fica a fala, sai o JSON — e a faixa explica o corte.
      const { texto } = separarChamadaDoTexto(m.content);
      if (texto) appendMessage('assistant', texto, false);
      // ⚠️ A FAIXA aparece em todas as chamadas barradas da conversa: aquilo
      // aconteceu mesmo, e esconder seria mentir sobre o histórico. O BOTÃO,
      // não: ele só existe enquanto a chamada barrada for a ÚLTIMA mensagem.
      // Retomar uma pesquisa que você já abandonou executaria chamadas do
      // assunto velho e enfiaria os resultados no fim da conversa de agora.
      //
      // ⚠️ E ele também não existe quando a retomada JÁ FOI PEDIDA — no lugar
      // dele vai o selo. Ver `_chatSeloConcedidas`.
      const concedidas = (m.meta && m.meta.rodadas_concedidas) || 0;
      const faixa = _notaDoPrograma(container, NOTA_TETO_ESTOUROU,
                                    !concedidas && i === messages.length - 1);
      if (concedidas) _chatSeloConcedidas(faixa, concedidas);
      return;
    }
    // Sobra a conversa de verdade. Uma resposta do agente com envelope no fim e
    // SEM marca nenhuma é uma chamada barrada de ANTES de a marca existir:
    // histórico antigo, que continua desenhando a faixa — mas sem botão, porque
    // a retomada precisa do contador de rodadas que só a marca carrega.
    const { texto, chamada } = separarChamadaDoTexto(
      m.role === 'assistant' ? m.content : '');
    if (m.role === 'assistant' && chamada) {
      if (texto) appendMessage('assistant', texto, false);
      _notaDoPrograma(container, NOTA_TETO_ESTOUROU);
      return;
    }
    appendMessage(m.role, m.content, false);
  });
  rolarAoFimAgora(container);
}

// ── Subagentes: blocos na conversa ───────────────────────────────────────────
// O mapa de emojis que morava aqui saiu: emoji e nome agora vêm os dois de
// AGENTES_DEFINICOES, via `agenteRotulo` (chat-agentes.js). Antes o balão
// mostrava o id cru — "semantico", minúsculo e sem acento — enquanto o card
// da aba Subagentes mostrava "Semântico". Eram duas respostas para o mesmo
// agente, e a errada era a que aparecia na conversa.

// `rotulo` é opcional e só a Fila passa. Uma pesquisa de doze rodadas vira uma
// sequência longa de blocos iguais, e sem marca nenhuma não dá para saber onde
// uma rodada acabou e a outra começou. O Chat não passa nada e continua sem
// cabeçalho: lá são duas ou três rodadas, e a linha seria ruído.
function _makeSubagentRound(resultados, rotulo) {
  const round = document.createElement('div');
  round.className = 'subagent-round';
  if (rotulo) {
    const cab = document.createElement('div');
    cab.className = 'subagent-round-cabecalho';
    cab.textContent = rotulo;
    round.appendChild(cab);
  }
  resultados.forEach(r => {
    const det = document.createElement('details');
    det.className = 'subagent-block' + (r.erro ? ' subagent-block-erro' : '');
    const sum = document.createElement('summary');
    sum.textContent = `${agenteRotulo(r.nome)} — ${(r.pergunta || '').slice(0, 90)}${(r.pergunta || '').length > 90 ? '…' : ''}`;
    const pre = document.createElement('pre');
    pre.className = 'subagent-block-body';
    // Erro E resposta, não erro OU resposta: quando o subagente se esgota sem
    // responder, o backend manda os dois — o motivo e a entrega parcial (o que
    // ele chegou a ler). O ou-exclusivo daqui jogava a entrega parcial fora,
    // que é justamente o conteúdo que ela existe para salvar.
    if (r.erro && r.resposta) {
      pre.textContent = `ERRO: ${r.erro}\n\n${r.resposta}`;
    } else {
      pre.textContent = r.erro ? `ERRO: ${r.erro}` : (r.resposta || '(vazio)');
    }
    det.appendChild(sum);
    det.appendChild(pre);
    round.appendChild(det);
  });
  return round;
}

// ── Copiar uma mensagem ──────────────────────────────────────────────────────
// Vale para os DOIS lados da conversa — a dele e a sua. Selecionar com o mouse
// já funcionava, mas numa resposta longa a seleção sobe além da tela, e o que
// se copiava vinha com o texto do balão seguinte junto.
//
// ⚠️ O que é copiado é o MARKDOWN CRU (`content`), e não o que está desenhado.
// Copiar do DOM traria a lista virando texto solto, o bloco de código sem as
// cercas e as tabelas desmontadas — e é justamente para colar em outro lugar
// que a pessoa copia. O texto vai no `dataset` porque o balão é redesenhado
// mais de uma vez (a bolha de streaming vira resposta no fim).
function _chatAcoesDaMensagem(div, texto) {
  if (!div || !texto) return;
  div.dataset.texto = texto;
  if (div.querySelector('.message-acoes')) return;
  const barra = document.createElement('div');
  barra.className = 'message-acoes';
  const btn = document.createElement('button');
  btn.type = 'button';
  // ⚠️ Não é `.btn-icon`. O `.btn-icon` é uma CAIXA COM BORDA, boa numa barra
  // de ferramentas e errada encostada num balão de conversa — foi assim que
  // este botão nasceu, e ficou parecendo um controle de outra tela colado ali.
  // O irmão certo mora no mesmo arquivo CSS: `.btn-copy-payload`, o 📋 do
  // rodapé do Chat — sem borda, sem fundo, só o glifo apagado. Mesma tela,
  // mesmo trabalho, mesmo desenho.
  btn.className = 'message-copiar';
  btn.textContent = '📋';
  btn.title = 'Copiar esta mensagem';
  // ⚠️ Lê `div.dataset.texto` NO CLIQUE, e não a variável do fechamento: a
  // bolha de streaming instala o botão e SÓ DEPOIS recebe o texto final sem o
  // envelope de chamada. Preso no fechamento, ele copiaria a versão de antes.
  btn.addEventListener('click', () => copiarPeloBotao(btn, div.dataset.texto || '', '📋'));
  barra.appendChild(btn);
  div.appendChild(barra);
}

function appendMessage(role, content, scroll = true) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `message message-${role}`;
  const inner = document.createElement('div');
  inner.className = 'message-content';
  inner.innerHTML = renderMarkdown(content);
  div.appendChild(inner);
  _chatAcoesDaMensagem(div, content);
  container.appendChild(div);
  if (scroll) rolarAoFimAgora(container);
  return div;
}

// Rolagem inteligente: segue o fundo durante o streaming, solta se você subiu
// para reler. A regra mora em utils.js (`rolarAoFimSePresa`) porque não é só
// desta conversa — o Log e a Fila crescem sozinhos do mesmo jeito.
function _chatScrollToBottom() {
  rolarAoFimSePresa(document.getElementById('chat-messages'));
}

