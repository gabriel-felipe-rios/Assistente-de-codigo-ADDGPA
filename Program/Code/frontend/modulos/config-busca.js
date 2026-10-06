// ═══════════════════════════ ABA: CONFIGURAÇÕES — BUSCA ══
// Acha um campo pelo nome e leva até ele, atravessando as categorias.
//
// O trilho resolveu o problema de "onde eu clico", mas criou o de "em qual das
// nove está aquele número". Com nove categorias e algumas dezenas de campos,
// lembrar a divisão certa passou a ser trabalho.
//
// ⚠️ Isto só funciona por causa de uma decisão registrada do Trilho de
// categorias: **a categoria fechada é escondida com `.hidden`, nunca
// desmontada**. Os campos das nove estão todos no DOM o tempo todo, então uma
// varredura enxerga tudo de uma vez, sem abrir nada.

const CONFIG_BUSCA_MAX = 8;

// O que conta como "um lugar para onde ir". `.config-field-row` é a unidade da
// maioria das categorias; Extensões e Temas não a usam, e para elas o alvo é o
// cartão inteiro — daí a segunda entrada.
const _CONFIG_BUSCA_ALVOS = '.config-field-row, .config-cartao[data-config-busca]';

function _configBuscaTexto(el) {
  // O `data-config-busca` é para os cartões que não têm rótulo de campo (o
  // usuário procura "extensão", e a palavra não aparece em lugar nenhum do
  // markup daquele cartão).
  const extra = el.dataset.configBusca || '';
  return `${extra} ${el.textContent || ''}`.toLowerCase();
}

function _configBuscaTitulo(el) {
  const label = el.querySelector('label, .config-cartao-titulo');
  const bruto = (label ? label.textContent : el.textContent) || '';
  // O rótulo pode trazer a unidade entre parênteses e a nota de ajuda inteira;
  // aqui vale a primeira linha, que é o nome da coisa.
  return bruto.trim().split('\n')[0].trim().slice(0, 70);
}

function initConfigBusca() {
  const campo = document.getElementById('config-busca');
  if (!campo || campo._wired) return;
  campo._wired = true;
  campo.addEventListener('input', () => _configBuscar(campo.value));
  campo.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    campo.value = '';
    _configBuscar('');
    campo.blur();
  });
}

function _configBuscar(termo) {
  const lista = document.getElementById('config-busca-achados');
  if (!lista) return;
  const alvo = (termo || '').trim().toLowerCase();
  if (alvo.length < 2) {
    lista.innerHTML = '';
    lista.classList.add('hidden');
    return;
  }

  const achados = [];
  document.querySelectorAll('#config-rolagem .config-secao').forEach(secao => {
    const categoria = secao.dataset.categoria;
    const nomeCat = (secao.querySelector('h2') || {}).textContent || categoria;
    secao.querySelectorAll(_CONFIG_BUSCA_ALVOS).forEach(el => {
      if (achados.length >= CONFIG_BUSCA_MAX) return;
      if (!_configBuscaTexto(el).includes(alvo)) return;
      achados.push({ categoria, nomeCat, el, titulo: _configBuscaTitulo(el) });
    });
  });

  if (!achados.length) {
    lista.innerHTML = '<p class="config-busca-vazio">nada com esse nome</p>';
    lista.classList.remove('hidden');
    return;
  }

  lista.innerHTML = achados.map((a, i) => `
    <button class="config-busca-achado" data-i="${i}">
      <span class="config-busca-cat">${escapeHtml(a.nomeCat)}</span>
      <span class="config-busca-campo">${escapeHtml(a.titulo)}</span>
    </button>`).join('');
  lista.classList.remove('hidden');

  lista.querySelectorAll('.config-busca-achado').forEach(btn => {
    btn.addEventListener('click', () => _configIrPara(achados[+btn.dataset.i]));
  });
}

function _configIrPara(achado) {
  abrirCategoriaConfig(achado.categoria);

  // Rolagem por aritmética, e não `scrollIntoView`: o painel de Configurações
  // não é a janela, e o `scrollIntoView` mexe em todos os ancestrais roláveis —
  // é a mesma regra já registrada na Barra de âncoras.
  const rolagem = document.getElementById('config-rolagem');
  if (rolagem) {
    rolagem.scrollTop += achado.el.getBoundingClientRect().top
                       - rolagem.getBoundingClientRect().top - 12;
  }

  // O destaque some sozinho: ele responde "é esta aqui", e depois disso vira
  // ruído em cima de um campo que o usuário já está editando.
  document.querySelectorAll('.config-achado-aceso')
          .forEach(el => el.classList.remove('config-achado-aceso'));
  achado.el.classList.add('config-achado-aceso');
  setTimeout(() => achado.el.classList.remove('config-achado-aceso'), 2200);

  const entrada = achado.el.querySelector('input, select, textarea');
  if (entrada && !entrada.disabled) entrada.focus();
}
