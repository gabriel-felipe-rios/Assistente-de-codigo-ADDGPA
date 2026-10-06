// ══════════════════════════════════════════════════ ABA: ASSISTENTE ══
//
// Aba que agrupa tudo com que o usuário CONVERSA: Chat, Fila e Designer.
// Antes, o Chat era aba de topo solta e os outros eram sub-abas de Agentes,
// misturados com o maquinário automático (acionamentos, rotinas,
// pendências, erros) — que agora ficou sozinho na aba Automação. A
// Visualizar pipeline morou aqui até 2026-09: como ela só desenha o que a
// rotina Pipeline grava, virou o mapa Pipeline, em Mapas (D57).
//
// Este arquivo é só o despacho de navegação. Nenhum dos três painéis mudou
// por dentro: os templates continuam achando seus containers pelos mesmos ids
// (`tab-chat`, `asubtab-fila`, `asubtab-designer`), e as funções de init são
// as mesmas de antes.

// Init lazy de cada sub-aba de Assistente.
function _dispatchAssistente(id) {
  if (id === 'tab-chat') loadChatList();
  if (id === 'asubtab-fila') initFilaTab();
  if (id === 'asubtab-designer') initDesignerTab();
}

function initAssistenteTab() {
  const escopo = document.getElementById('tab-assistente');

  // A fiação vem PRIMEIRO e sem nenhum `return` antecipado antes dela — é a
  // mesma invariante que initAgentesTab() respeita. Se um erro mais abaixo
  // impedisse a fiação, a aba abriria com os botões mortos.
  // `_wireSubtabBar` vive em modulos/agentes/execucao/rotinas.js e escopa as
  // queries a este container: as duas barras do app usam as mesmas classes, e
  // sem escopo uma apagaria o estado da outra.
  _wireSubtabBar(escopo, _dispatchAssistente);

  // Despacha o init da sub-aba que estiver aberta, em vez de assumir o Chat.
  // Assim, voltar para Assistente com a Fila aberta reinicializa a Fila,
  // e não recarrega a lista de chats à toa.
  const ativa = escopo && escopo.querySelector('.agentes-subtab-btn.active');
  _dispatchAssistente(ativa ? ativa.dataset.asubtab : 'tab-chat');
}
