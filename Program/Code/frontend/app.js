window.addEventListener('pywebviewready', init);

// ── Estado global ─────────────────────────────────────────────────────────────
let currentProject = null;
// Projetos abertos ao mesmo tempo, em abas — `currentProject` é sempre um dos
// nomes desta lista (o que está exibido agora). A ordem é a ordem das abas na
// tela. Ver `modulos/projetos-abertos.js`.
let openProjects = [];
// Qual aba PRINCIPAL (Projeto/Assistente/Automação/…) estava ativa em cada
// projeto aberto — `projeto → data-tab`. Sem isto, voltar para uma aba de
// projeto já aberta sempre caía em "Projeto", mesmo que o usuário estivesse
// em Automação. Só a aba principal é lembrada; sub-abas aninhadas sempre
// voltam para a primeira (ver `enterProject`, navegacao.js).
let _projAbaAtiva = {};
// Qual SUB-aba estava aberta em cada barra, por projeto:
// `projeto → { grupo: valor-de-navegação-do-botão }`.
//
// ⚠️ Só a aba principal era lembrada, e as sub-abas não eram apenas esquecidas
// — elas VAZAVAM entre projetos, porque o DOM é um só e `_resetSubAbas` nem
// cobre todas as famílias de barra. Abrir Assistente › Designer no projeto B
// fazia o projeto A também abrir no Designer ao voltar. Era o "é só entre
// sub-abas".
//
// A chave é o `data-taborder-group` da barra — a mesma que a aba Configurações
// › Ordem das abas já usa para descobrir as barras sozinha (ver tab-order.js).
// Assim uma barra nova é lembrada sem ninguém editar nada aqui.
let _projAbasAtivas = {};
let currentChatId  = null;
let isStreaming     = false;
let activeModel    = '';
let workspaceConfig = { root_folder: null, working_folders: [], ignore_list: [], context_items: [], main_file: null };
let appSettings     = { lm_studio_url: ENDERECO_PADRAO_DO_LM_STUDIO };
// Desempenho do desenho dos mapas. Consultado a cada gesto, entao vive aqui em
// vez de atravessar a ponte Python<->WebView na hora do uso.
let renderMapas     = { mov_resolucao: 0.5, mov_sem_rotulos: true, mov_sem_setas: true,
                        mov_sem_contorno: true, mov_sem_ligacoes: false, mov_sem_cor: false,
                        mov_sem_destaque: true, lod_limite: 0.65, margem: 0.5,
                        impacto_hub_max_ligacoes: 30, niveis_cartoes: 120 };
// Mapa extensao->icone e pasta->icone, do pacote de icones ligado (a extensao
// "Icones de arquivo", tipo 24). Consultado uma vez por linha de lista
// desenhada, entao fica aqui em vez de atravessar a ponte a cada consulta.
// `null` ate o init() -- e `null` para sempre, se nao houver pacote ligado:
// sem mapa, icones.js usa os emojis.
let mapaIcones     = null;

// Modais de projeto
let pendingDeleteName = null;
let pendingRenameName = null;

// ══════════════════════════════════════════════════════════════════════ INIT ══
async function init() {
  // Cada etapa isolada em try/catch: uma falha em qualquer uma (ex.: dado de
  // projeto corrompido) não pode impedir as etapas seguintes de rodar — em
  // especial loadAndApplyTabOrder()/initConfigTab(), que ficavam silenciosamente
  // sem executar quando uma etapa anterior lançava exceção.
  try { const r = await window.pywebview.api.load_settings(); if (r.success) appSettings = r.settings; } catch (e) { console.error(e); }
  // Logo depois das configurações e antes de qualquer tela: o tema tem que
  // valer na primeira pintura, senão o programa pisca no Ardósia antes de
  // trocar. Não espera a aba Configurações, que só monta quando o usuário
  // entra nela. Sem tema gravado, `aplicarTemaGravado` cai no Ardósia.
  try { aplicarTemaGravado(); } catch (e) { console.error(e); }
  try { const r = await window.pywebview.api.load_render_mapas(); if (r.success) renderMapas = r.render; } catch (e) { console.error(e); }
  // As EXTENSÕES DO PROGRAMA ligadas, aqui e não só quando a aba Configurações
  // abre: uma extensão que decora o Editor ou reage a um evento precisa estar
  // de pé desde a primeira tela. `xtAdotarArvore` injeta o frontend de cada
  // uma, registra a tela de configuração dela e aplica o que ela traz de M6.
  //
  // ⚠️ É AQUI QUE OS ÍCONES CHEGAM. Até 04/09/2026 havia um `load_mapa_icones`
  // logo acima, com o Material Icon Theme que morava dentro do programa; ele
  // virou a extensão "Ícones de arquivo" e o mapa passa a vir por esta linha,
  // como qualquer outro dado de M6. Sem extensão de ícones ligada, `mapaIcones`
  // fica nulo e a tela usa emoji.
  //
  // O tema de extensão só se aplica a partir daqui — quem abre com um deles vê
  // um piscar do Ardósia, porque `aplicarTemaGravado` roda lá em cima e a lista
  // de extensões ainda não existia. O contrário seria abrir sem folha de estilo
  // nenhuma.
  try { await carregarExtensoesDoPrograma(); } catch (e) { console.error(e); }
  try { await loadProjects(); } catch (e) { console.error(e); }
  try { bindProjectsScreen(); } catch (e) { console.error(e); }
  try { bindProjectScreen(); } catch (e) { console.error(e); }
  try { bindModals(); } catch (e) { console.error(e); }
  try { await loadAndApplyTabOrder(); } catch (e) { console.error(e); }
  try { initConfigTab(); } catch (e) { console.error(e); }
  try { initChatAgentes(); } catch (e) { console.error(e); }
}

// Fecha todos os dropdowns ao clicar fora deles
document.addEventListener('click', () => {
  document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.add('hidden'));
});

function setupDropdown(toggleId, menuId) {
  const toggle = document.getElementById(toggleId);
  const menu   = document.getElementById(menuId);
  toggle.addEventListener('click', e => {
    e.stopPropagation();
    const wasHidden = menu.classList.contains('hidden');
    document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.add('hidden'));
    if (wasHidden) menu.classList.remove('hidden');
  });
  menu.querySelectorAll('.dropdown-opt').forEach(opt => {
    opt.addEventListener('click', () => menu.classList.add('hidden'));
  });
}
