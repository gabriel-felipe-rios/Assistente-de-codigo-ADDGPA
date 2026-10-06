// ═══════════════════════════════════════ TAXONOMIA DE PROJETOS (dados) ══
// Camada de dados pura, sem DOM — cache local de grupos/subgrupos/tags e da
// atribuição de cada projeto, mais a descrição de cada um (arquivo à parte no
// backend, ver `projetos_descricoes.py`). Quem desenha (Kanban, modais) só lê
// daqui — nenhum módulo de tela chama a API do backend diretamente para isto.

let _taxCache = null;
let _descCache = null;

async function taxCarregar(forcar) {
  if (_taxCache && !forcar) return _taxCache;
  const r = await window.pywebview.api.carregar_taxonomia_de_projetos();
  _taxCache = (r && r.success) ? r : { grupos: [], tags: [], atribuicoes: {} };
  return _taxCache;
}

// Toda mutação de grupo/subgrupo/tag/atribuição já devolve a taxonomia
// inteira recarregada (mesmo padrão de `save_config_plugin` devolvendo
// `list_plugins()`) — quem chama passa a resposta direto pra cá em vez de
// pedir `taxCarregar(true)` de novo, um round-trip a menos.
function taxAtualizarCache(resposta) {
  if (resposta && resposta.success) _taxCache = resposta;
  return resposta;
}

async function taxCarregarDescricoes(forcar) {
  if (_descCache && !forcar) return _descCache;
  const r = await window.pywebview.api.carregar_todas_descricoes();
  _descCache = (r && r.success) ? r.descricoes : {};
  return _descCache;
}

function taxDescricaoCache(nomeProjeto, texto) {
  if (!_descCache) _descCache = {};
  if (texto) _descCache[nomeProjeto] = texto;
  else delete _descCache[nomeProjeto];
}

// ── Lookups (assumem que `taxCarregar()` já rodou pelo menos uma vez) ──────
function taxGrupos() { return (_taxCache && _taxCache.grupos) || []; }
function taxTags() { return (_taxCache && _taxCache.tags) || []; }
function taxGrupo(id) { return taxGrupos().find(g => g.id === id) || null; }
function taxTag(id) { return taxTags().find(t => t.id === id) || null; }
function taxSubgrupo(grupoId, subgrupoId) {
  const g = taxGrupo(grupoId);
  return g ? (g.subgrupos || []).find(s => s.id === subgrupoId) || null : null;
}
function taxAtribuicaoDe(nomeProjeto) {
  const a = (_taxCache && _taxCache.atribuicoes) || {};
  return a[nomeProjeto] || { grupo_id: null, subgrupo_id: null, tags: [] };
}
function taxNomeDoGrupo(id) { const g = taxGrupo(id); return g ? g.nome : ''; }
function taxCorDoGrupo(id) { const g = taxGrupo(id); return g ? g.cor : null; }
function taxCorDoSubgrupo(grupoId, subgrupoId) { const s = taxSubgrupo(grupoId, subgrupoId); return s ? s.cor : null; }
function taxNomeDaTag(id) { const t = taxTag(id); return t ? t.nome : ''; }
function taxCorDaTag(id) { const t = taxTag(id); return t ? t.cor : null; }

// "#3498db" → "52,152,219". Usado onde uma cor de grupo/tag vira transparência
// via `rgba(var(--x-rgb), α)` — CSS não converte hex pra RGB sozinho.
function hexParaRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  return m ? `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}` : '255,255,255';
}

// Monta o `style` de um `.tag-pill` (ver `projetos-kanban.css`): a cor em si
// e o triplet RGB dela, já que o CSS de lá precisa dos dois.
function tagPillStyle(cor) {
  return `--tag-cor:${escapeHtml(cor || '')}; --tag-cor-rgb:${hexParaRgb(cor)}`;
}
