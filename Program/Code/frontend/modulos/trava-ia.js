// ═══════════════════════════════ Um por vez: quem está usando a IA agora ══
// A `TRAVA_IA` do backend (backend/modulos/agentes/trava_ia.py) é de CINCO
// pontas — Chat · Fila · Rotinas · Designer · Backup — e vale para o programa
// inteiro, porque a janela do LM Studio é uma só. Este arquivo é o lado da tela
// dessa trava: enquanto uma ponta roda, as outras quatro ficam apagadas com o
// motivo escrito ao lado.
//
// ⚠️ ARQUIVO PRÓPRIO, e não um pedaço de `subagentes-config-tab.js` (onde isto
// morava): são QUATRO telas de duas abas de cima diferentes chamando as mesmas
// funções — o Chat, a Fila, o Designer e os botões de Automação. Mesma regra
// que pôs `abas-processando.js` num arquivo só dele.
//
// São TRÊS camadas, e nenhuma das três sozinha resolve:
//
//  1. `aplicarTravaIA` apaga os botões marcados com `data-trava-ia`. É o aviso.
//  2. O poll de 4 s refaz a camada 1 sem clique nenhum — as Rotinas tomam a
//     trava por evento no disco, não por botão.
//  3. `travaIALiberado` pergunta AGORA, no clique, antes de agir. É a única
//     camada que fecha a janela de até 4 s entre uma ponta começar e a tela
//     saber — e a única que pega o Enter no campo de texto, que nunca passou
//     pelo botão apagado.
//
// Quem dispara trabalho de IA precisa das três. Só a 1 e a 2 é o bug que existia
// aqui: o botão do Chat apagava, mas o Enter continuava mandando.

// Último estado conhecido, para quem precisar consultar sem ir ao backend.
let _travaIAUltimo = null;

// Com múltiplos projetos abertos ao mesmo tempo, quem toma a trava pode ser um
// projeto DIFERENTE do que está na tela agora — a trava sempre foi global ao
// processo (é a mesma janela do LM Studio), então o bloqueio em si já
// funciona sem mudança nenhuma. O que faltava era o MOTIVO dizer de qual
// projeto: sem isso, ver o Chat apagado sem nunca ter mexido naquele projeto
// pareceria bug, em vez de "é a fila do LM Studio".
// ⚠️ CURTO. Isto vai numa linha ao lado de um botão, e a forma antiga
// (`<motivo> (projeto "<nome>")`) somada ao rótulo longo do backend produzia
// frases como `Aguarde: as Rotinas estão atualizando a documentação (projeto
// "Teste").` — que não cabia. O `·` faz o mesmo trabalho dos parênteses e da
// palavra "projeto": separar duas informações que já se leem pelo que são.
function _travaIAMotivo(estado) {
  if (!estado) return '';
  if (estado.projeto && estado.projeto !== currentProject) {
    return `${estado.motivo} · ${estado.projeto}`;
  }
  return estado.motivo;
}

// ── Camada 1: a tela ────────────────────────────────────────────────────────
// `data-trava-ia="<dono>"` num botão = "este botão pertence a esta ponta".
// Ele apaga quando a trava está com QUALQUER OUTRA ponta. Quando está com a
// ponta dele, quem apaga é a tela local (ver `travaIAOcupadoLocal` abaixo).
function aplicarTravaIA(estado) {
  _travaIAUltimo = estado || null;
  // Botão apagado sem explicação parece defeito. Com o motivo ao lado, o
  // usuário sabe inclusive para onde ir — é a Fila, é a documentação
  // atualizando, é o próprio Chat.
  document.querySelectorAll('[data-trava-ia]').forEach(el => {
    const dono = el.dataset.travaIa;
    // ⚠️ O modo "QUALQUER DONO BLOQUEIA" (`data-trava-ia-qualquer-dono`).
    //
    // A regra normal é "apaga quando a trava está com OUTRA ponta", e ela está
    // certa para o botão que É o dono: o Enviar do Chat não pode apagar durante
    // a resposta do próprio Chat — quem manda ali é a tela local.
    //
    // Os 14 ▶ das Rotinas são a exceção, e não é detalhe: eles pertencem à
    // ponta `rotinas`, que é A MESMA que o ciclo automático toma. Pela regra
    // normal, eles continuariam ACESOS e clicáveis durante o ciclo — recriando
    // em quatorze botões exatamente o defeito que a trava existe para impedir.
    // Com a marca, qualquer dono os apaga, o próprio ciclo incluído.
    const soDeOutraPonta = estado && estado.quem !== dono;
    const bloqueado = !!estado
      && (el.dataset.travaIaQualquerDono !== undefined || soDeOutraPonta);
    // A tela pode ter uma razão PRÓPRIA para o botão estar apagado — o Chat
    // respondendo, por exemplo (`setChatInputEnabled`). Sem esta consulta, a
    // pulsação de 4 em 4 segundos reabria o botão no meio da resposta, porque
    // dali a trava está tomada pelo próprio Chat e "não bloqueia" o Chat.
    el.disabled = bloqueado || el.dataset.ocupadoLocal === '1';
    el.classList.toggle('trava-bloqueado', bloqueado);
    // O title vira o motivo enquanto bloqueado — botão apagado é justamente o
    // que não dá para clicar para descobrir por quê. O original volta depois,
    // e alguns destes botões têm titles longos que explicam o que eles fazem.
    if (bloqueado) {
      if (el.dataset.tituloOriginal === undefined) el.dataset.tituloOriginal = el.title || '';
      el.title = `Aguarde: ${_travaIAMotivo(estado)}.`;
    } else if (el.dataset.tituloOriginal !== undefined) {
      if (el.dataset.tituloOriginal) el.title = el.dataset.tituloOriginal;
      else el.removeAttribute('title');
      delete el.dataset.tituloOriginal;
    }
  });
  document.querySelectorAll('[data-trava-ia-motivo]').forEach(el => {
    const dono = el.dataset.travaIaMotivo;
    if (estado && estado.quem !== dono) {
      // Sem o "Aguarde:" e sem o ponto final: este é o texto do ESPAÇO CURTO,
      // ao lado do botão. O botão já está apagado — que o usuário aguarde é o
      // que ele está vendo; o que falta dizer é o quê. O `title` e o toast,
      // que têm espaço, continuam com a frase inteira.
      el.textContent = _travaIAMotivo(estado);
      el.classList.remove('hidden');
    } else {
      el.textContent = '';
      el.classList.add('hidden');
    }
  });
  // A mesma resposta serve à bolinha da aba Assistente: Fila e Designer rodam
  // em thread no backend, sem sinal nenhum na tela quando começam, e é a trava
  // que sabe que eles estão rodando. Entregar aqui evita um poll novo — mesma
  // regra do `_abasDistribuir` em `abas-processando.js`.
  if (typeof marcarAssistenteTrava === 'function') marcarAssistenteTrava(estado);
}

// Reaplica o ÚLTIMO estado conhecido da trava, sem ir ao backend. Serve para
// botão que nasce depois da última pulsação — o "Retomar" da faixa é criado em
// tempo de execução, e sem isto ele ficaria aceso até os próximos 4 segundos,
// que é tempo de sobra para o clique acontecer e virar um balão vermelho.
function reaplicarTravaIA() {
  aplicarTravaIA(_travaIAUltimo);
}

// O botão está apagado por razão da PRÓPRIA ponta (envio em curso), e não pela
// trava. A marca diz ao poll para não reabri-lo — ver o comentário acima.
function travaIAOcupadoLocal(el, ocupado) {
  if (!el) return;
  el.dataset.ocupadoLocal = ocupado ? '1' : '';
  el.disabled = !!ocupado || el.classList.contains('trava-bloqueado');
}

// ── Camada 2: o poll ────────────────────────────────────────────────────────
async function _travaIABuscar() {
  const r = await window.pywebview.api.estado_trava_ia();
  return (r && r.ocupado) ? r.trava : null;
}

async function atualizarTravaIA() {
  let estado;
  try { estado = await _travaIABuscar(); } catch (e) { return; }
  aplicarTravaIA(estado);
}

// ── Camada 3: a pergunta no clique ──────────────────────────────────────────
// Chamada por quem VAI disparar trabalho de IA, antes de mexer em qualquer
// estado de tela. Devolve `true` se pode seguir; se não, já avisa e já repinta
// os botões, sem esperar a volta do poll.
//
// ⚠️ Falha de comunicação com o backend devolve `true`, não `false`: inventar
// uma trava que não existe trancaria o programa inteiro por um erro de rede
// local. O backend recusa de novo do lado dele se for o caso — esta camada é
// para o usuário ver o motivo antes, não é o guarda final.
// `qualquerDono` é a mesma variante da camada 1, para quem precisa dela também
// no clique: os 14 ▶ das Rotinas pertencem à ponta que o ciclo automático toma,
// e sem isto a pergunta no clique responderia "pode" durante o próprio ciclo.
async function travaIALiberado(dono, qualquerDono) {
  let estado;
  try { estado = await _travaIABuscar(); } catch (e) { return true; }
  aplicarTravaIA(estado);
  if (estado && (qualquerDono || estado.quem !== dono)) {
    if (typeof showToast === 'function') showToast(`Aguarde: ${_travaIAMotivo(estado)}.`, true);
    return false;
  }
  return true;
}

// A recusa que veio DO BACKEND, depois do clique. Ela existe porque a camada 3
// pergunta e o backend age: entre uma coisa e outra, outra ponta pode ter
// tomado a janela. Repinta os botões com o estado que veio junto da recusa, em
// vez de esperar até 4 s pela próxima pulsação, e devolve `false` para quem
// chamou poder desfazer o que já tinha ligado na tela.
//
// ⚠️ Ler o retorno NÃO era opcional e não era feito: os 14 cards ligavam a flag
// e o `disabled` ANTES da chamada e descartavam a resposta. Uma recusa deixava
// o ▶ apagado até sair e voltar da aba — e sem nada dizendo por quê.
function travaIARecusou(r) {
  if (r && r.success) return false;
  if (r && r.trava) aplicarTravaIA(r.trava);
  if (typeof showToast === 'function') {
    showToast((r && r.error) || 'Não deu para rodar agora.', true);
  }
  return true;
}

// As Rotinas tomam a trava sozinhas, por evento no disco — não há clique para
// avisar a tela. Sem esta pulsação, o botão do Chat continuaria aceso enquanto
// a documentação é reescrita, e o clique só falharia depois. É uma leitura de
// dicionário em memória, sem I/O.
setInterval(() => {
  if (window.pywebview && window.pywebview.api) atualizarTravaIA();
}, 4000);
