// ═══════════════════════════════════════════════════ BUSCA DE PROJETOS ══
// Campo de texto + 4 checkboxes (Nome/Descrição/Tags/Grupo-Subgrupo), todos
// desmarcados por padrão. Filtra ao vivo, sem chamada ao backend a cada
// tecla (só a descrição precisa de uma busca em lote pré-carregada — ver
// `taxCarregarDescricoes`, cacheada). Mesmo espírito do modo "por nome" de
// `busca-arvore.js`: filtra o que já está desenhado, nunca redesenha.

function ligarBuscaDeProjetos() {
  const input = document.getElementById('pb-texto');
  if (!input || input._wired) return;
  input._wired = true;

  const disparar = () => reaplicarFiltroDeBusca();
  input.addEventListener('input', disparar);
  ['pb-nome', 'pb-descricao', 'pb-tags', 'pb-grupo'].forEach(id => {
    document.getElementById(id).addEventListener('change', disparar);
  });
}

async function reaplicarFiltroDeBusca() {
  const input = document.getElementById('pb-texto');
  if (!input) return;
  const texto = input.value.trim().toLowerCase();
  if (!texto) { filtrarKanban(null); return; }

  const marcados = {
    nome: document.getElementById('pb-nome').checked,
    descricao: document.getElementById('pb-descricao').checked,
    tags: document.getElementById('pb-tags').checked,
    grupo: document.getElementById('pb-grupo').checked,
  };
  // Nenhum campo marcado cai no padrão de buscar só por nome — "marcar nada"
  // não pode significar "não acha nada", seria contraintuitivo.
  const nenhumMarcado = !marcados.nome && !marcados.descricao && !marcados.tags && !marcados.grupo;
  const descricoes = marcados.descricao ? await taxCarregarDescricoes() : {};

  filtrarKanban(nome => {
    if ((nenhumMarcado || marcados.nome) && nome.toLowerCase().includes(texto)) return true;
    if (marcados.descricao && (descricoes[nome] || '').toLowerCase().includes(texto)) return true;
    if (marcados.tags) {
      const nomesTags = (taxAtribuicaoDe(nome).tags || []).map(taxNomeDaTag).join(' ').toLowerCase();
      if (nomesTags.includes(texto)) return true;
    }
    if (marcados.grupo) {
      const atrib = taxAtribuicaoDe(nome);
      const sub = atrib.subgrupo_id ? taxSubgrupo(atrib.grupo_id, atrib.subgrupo_id) : null;
      const alvo = (taxNomeDoGrupo(atrib.grupo_id) + ' ' + (sub ? sub.nome : '')).toLowerCase();
      if (alvo.includes(texto)) return true;
    }
    return false;
  });
}
