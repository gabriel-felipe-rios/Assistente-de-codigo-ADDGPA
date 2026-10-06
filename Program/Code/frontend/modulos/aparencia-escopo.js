// ══════════════════════════════ ABA: APARÊNCIA — O BLOCO "ONDE PROCURA" ══
// A lista de pastas do escopo, e o único lugar da aba onde ela pode ser mexida.
//
// O bloco nasce RETRAÍDO: é informação de conferência, não controle de uso
// diário, e a coluna de filtros já está cheia. O resumo no título ("2 pastas ·
// 1 removida · 1 religada") diz o essencial sem precisar abrir.
//
// ⚠️ Religar um item de Projeto → Remover vale SÓ NESTA SESSÃO, e some quando o
// programa fecha. É de propósito: a decisão de escopo continua morando em
// Projeto → Remover, e gravar o religamento aqui criaria um segundo escopo,
// invisível daquela tela. Aqui é "só desta vez, para eu procurar".
//
// Depende de `aparencia.js` (`aparenciaCarregarEstado`, `aparenciaBuscar`).

// ── Escopo: bloco recolhível e religamento temporário ──────────────────────
function aparenciaAlternarEscopo() {
  const caixa = document.getElementById('aparencia-escopo');
  const dobra = document.getElementById('aparencia-escopo-dobra');
  const aberto = caixa.classList.toggle('hidden') === false;
  dobra.setAttribute('aria-expanded', String(aberto));
  dobra.querySelector('.aparencia-dobra-seta').textContent = aberto ? '▾' : '▸';
}

// O resumo existe para o bloco poder ficar fechado sem esconder o que importa:
// quantas pastas entram, quantas foram removidas e quantas estão religadas.
function aparenciaResumoDoEscopo(pastas, ignorados) {
  const partes = [pastas.length + (pastas.length === 1 ? ' pasta' : ' pastas')];
  if (ignorados.length) partes.push(ignorados.length + ' removida' + (ignorados.length === 1 ? '' : 's'));
  const religadas = ignorados.filter(i => i.religado).length;
  if (religadas) partes.push(religadas + ' religada' + (religadas === 1 ? '' : 's'));
  return partes.join(' · ');
}

function aparenciaDesenharEscopo(pastas, ignorados) {
  const lista = document.getElementById('aparencia-escopo-lista');
  lista.innerHTML = '';
  pastas.forEach(pasta => {
    const linha = document.createElement('div');
    linha.className = 'aparencia-escopo-pasta';
    linha.textContent = pasta;
    linha.title = pasta;
    lista.appendChild(linha);
  });
  ignorados.forEach(item => {
    const linha = document.createElement('div');
    linha.className = 'aparencia-escopo-pasta fora' + (item.religado ? ' religado' : '');
    linha.textContent = item.caminho;
    linha.title = item.religado
      ? item.caminho + ' — religado só nesta sessão. Clique para tirar de novo.'
      : item.caminho + ' — ignorado (Projeto → Remover). Clique para religar só nesta sessão.';
    linha.addEventListener('click', () => aparenciaAlternarIgnorado(item.caminho));
    lista.appendChild(linha);
  });
  document.getElementById('aparencia-escopo-resumo').textContent =
    aparenciaResumoDoEscopo(pastas, ignorados);
}

// Religar é SÓ desta sessão, e não mexe em Projeto → Remover: a decisão de
// escopo continua morando lá. Aqui é "só desta vez, para eu procurar".
async function aparenciaAlternarIgnorado(caminho) {
  try {
    const resposta = await window.pywebview.api.aparencia_alternar_ignorado(currentProject, caminho);
    if (!resposta.success) return showToast(resposta.error || 'Não deu para religar', true);
    showToast(resposta.religado
      ? 'Religado só nesta sessão — revarrendo…'
      : 'Removido de novo — revarrendo…');
    await aparenciaCarregarEstado(false);
    aparenciaBuscar();
  } catch (erro) {
    showToast(String(erro), true);
  }
}
