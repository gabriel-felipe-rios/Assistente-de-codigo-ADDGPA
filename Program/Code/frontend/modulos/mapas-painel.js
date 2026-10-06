// Painel — cobertura dos agentes: quanto do projeto cada agente já cobriu.
//
// Deixou de ser "saúde geral do projeto". A regra de quem entra, enunciada pelo
// usuário: entra quem produz dado POR ARQUIVO; fica de fora quem produz um
// documento só. Por isso Glossário, Pipeline e Índice de navegação não estão
// aqui — "50% de um documento" não quer dizer nada.
//
// Saíram também "Arquivos grandes" e "Acoplamento alto": a aba Hotspots e a
// Matriz de Dependências já mostram as duas coisas, com mais detalhe.
//
// Tolerante a falha, como antes: um medidor sem dado aparece como "—", nunca
// como 0% — zero por falta de dado e zero de verdade não são a mesma coisa.

// Uma cor por agente, na ordem em que aparecem. Ler o painel de relance é
// reconhecer a posição e a cor, não o rótulo.
const PAINEL_CORES = {
  'doc-tecnica':      'var(--blue)',
  'resumo-pastas':    'var(--teal)',
  'hashes':           'var(--purple)',
  'identificadores':  'var(--amber)',
  'grafo-imports':    'var(--coral)',
  'embedding':        'var(--yellow)',
};

async function renderPainel() {
  const container = document.getElementById('painel-container');
  container.innerHTML = '<div class="mapa-loading">Carregando…</div>';

  // A cobertura GRAVADA (`Automação/Rotinas/Cobertura.json`), e não a
  // varredura: quem a regrava é o fim de cada rotina que mexe num medidor.
  // Antes era `get_cobertura_agentes`, que varria o projeto a cada clique.
  const [cobertura] = await Promise.allSettled([
    window.pywebview.api.ler_cobertura_agentes(currentProject),
  ]);

  if (cobertura.status !== 'fulfilled' || !cobertura.value.success) {
    container.innerHTML = '<div class="mapa-loading">Não foi possível ler a cobertura.</div>';
    document.getElementById('painel-stat').textContent = 'Cobertura dos agentes';
    return;
  }

  const medidores = (cobertura.value.medidores || []).map(m =>
    // total 0 = sem dado (o agente nunca rodou, ou o universo está vazio).
    _medidor(m.rotulo,
             m.total > 0 ? _pct(m.feitos, m.total) : null,
             PAINEL_CORES[m.id] || 'var(--text-muted)',
             m.total > 0 ? `${m.feitos} de ${m.total}` : 'sem dado')
  );

  container.innerHTML = `<div class="gauge-row">${medidores.join('')}</div>`;
  document.getElementById('painel-stat').textContent =
    'Cobertura dos agentes' + _painelQuando(cobertura.value.gravado_em);
}

// "· gravada em 25/09 14:03" — de quando é o que se vê. O Painel não varre
// mais, então dizer a hora é o que impede um número velho de passar por atual.
function _painelQuando(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d)) return '';
  const p = n => String(n).padStart(2, '0');
  return ` · gravada em ${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function _pct(parte, total) {
  if (!total) return 0;
  return (parte / total) * 100;
}

// Monta o HTML de um medidor radial. valor null => estado "sem dado" (—).
function _medidor(rotulo, valor, cor, detalhe) {
  const sub = detalhe ? `<div class="gauge-sub">${escapeHtml(detalhe)}</div>` : '';
  if (valor === null) {
    return `
      <div class="gauge-item">
        <div class="gauge gauge--vazio" style="--gp:0; --gc:${cor}"><b>—</b></div>
        <div class="gauge-label">${escapeHtml(rotulo)}</div>
        ${sub}
      </div>`;
  }
  const arred = Math.round(valor);
  return `
    <div class="gauge-item">
      <div class="gauge" style="--gp:${valor.toFixed(1)}; --gc:${cor}"><b>${arred}%</b></div>
      <div class="gauge-label">${escapeHtml(rotulo)}</div>
      ${sub}
    </div>`;
}
