// ══════════════════════════════════════════════════════ ABA: APARÊNCIA ══
// Busca visual: acha o ponto da interface pelo que ele parece (cor ou texto),
// em qualquer linguagem — e, agora, também dentro das imagens. O escopo vem
// sempre das pastas de trabalho do projeto (Projeto → Trabalho), descontando o
// que está em Projeto → Remover.
//
// Este arquivo cuida do ESTADO, dos controles e das fichas de filtro. Os
// cartões de achado e os botões deles moram em `aparencia-cartoes.js`.

// ⚠️ SÓ O WIRING. Antes esta flag guardava `initAparenciaTab()` inteira, o que
// significava que a aba se montava uma vez por abertura do programa e nunca
// mais — com abas de projeto, trocar de aba deixava na tela os achados do
// projeto anterior, com os caminhos de arquivo dele. Ver `_aparenciaProjeto`.
let _aparenciaWired = false;
// De qual projeto são os achados na tela. `null` = nenhum ainda.
let _aparenciaProjeto = null;
let _aparenciaModo = 'cor';               // 'cor' | 'texto' | 'auditoria'
let _aparenciaFonte = 'ambos';            // 'codigo' | 'imagens' | 'ambos'
let _aparenciaAchados = [];
let _aparenciaApontamentos = [];
let _aparenciaAberto = -1;

// Contagens do índice INTEIRO, e não da página devolvida. É o que permite a
// ficha `atributo` aparecer com o número certo mesmo quando nenhum atributo
// coube nos 400 achados que a tela recebeu.
let _aparenciaContagens = { etiquetas: {}, fontes: {} };

// Fichas DESLIGADAS, e não ligadas. É a inversão que faz "nada some por
// omissão": uma origem ou linguagem nova aparece ligada sozinha, sem precisar
// ser cadastrada em lugar nenhum. Só as duas etiquetas de código entram aqui de
// fábrica — e continuam contadas na ficha, a um clique de voltar.
let _aparenciaDesligados = new Set();

const APARENCIA_ETIQUETAS_DESLIGADAS = ['etiqueta:atributo', 'etiqueta:identificador'];
const APARENCIA_ETIQUETA_ICONE = {
  'rótulo': '🏷', 'mensagem': '💬', 'atributo': '⚙',
  'identificador': '🔤', 'nome de imagem': '🖼',
};

// Uma busca é sempre de um projeto: os achados carregam caminho de arquivo, e
// mostrar os de outro projeto é pior que mostrar nada. Chamada por
// `initAparenciaTab`, que agora roda a cada abertura da aba.
function _aparenciaConferirProjeto() {
  if (_aparenciaProjeto === currentProject) return;
  _aparenciaProjeto = currentProject;
  _aparenciaAchados = [];
  _aparenciaApontamentos = [];
  _aparenciaContagens = { etiquetas: {}, fontes: {} };
  _aparenciaAberto = -1;
  // As fichas desligadas voltam ao padrão de fábrica: elas são derivadas dos
  // achados (origem, linguagem, etiqueta), e guardar as de um projeto
  // esconderia coisa no outro sem nada na tela dizendo por quê.
  aparenciaRestaurarEtiquetas();
  if (typeof aparenciaRenderizarFichas === 'function') aparenciaRenderizarFichas();
  if (typeof aparenciaRenderizarLista === 'function') aparenciaRenderizarLista();
}

// ⚠️ Roda a CADA abertura da aba. Só o wiring é uma vez por abertura do
// programa (`_aparenciaWired`).
function initAparenciaTab() {
  _aparenciaConferirProjeto();
  if (_aparenciaWired) return;
  _aparenciaWired = true;
  aparenciaRestaurarEtiquetas();

  document.querySelectorAll('#aparencia-seletor .aparencia-seletor-botao').forEach(botao => {
    botao.addEventListener('click', () => {
      _aparenciaModo = botao.dataset.aparenciamodo;
      aparenciaMarcarUnico('#aparencia-seletor', botao);
      ['cor', 'texto', 'auditoria'].forEach(modo => {
        document.getElementById('aparencia-painel-' + modo)
          .classList.toggle('hidden', modo !== _aparenciaModo);
      });
      aparenciaLimparFiltros();
      aparenciaBuscar();
    });
  });

  document.querySelectorAll('#aparencia-fonte .aparencia-seletor-botao').forEach(botao => {
    botao.addEventListener('click', () => {
      _aparenciaFonte = botao.dataset.aparenciafonte;
      aparenciaMarcarUnico('#aparencia-fonte', botao);
      aparenciaAtualizarControlesDeImagem();
      aparenciaLimparFiltros();
      aparenciaBuscar();
    });
  });

  document.getElementById('aparencia-btn-buscar')
    .addEventListener('click', () => aparenciaBuscar());
  document.getElementById('aparencia-btn-revarrer')
    .addEventListener('click', () => aparenciaCarregarEstado(true));

  aparenciaLigarDeslizante('aparencia-tolerancia', '%');
  aparenciaLigarDeslizante('aparencia-presenca', '%');
  aparenciaLigarDeslizante('aparencia-familias', '');

  const campoCor = document.getElementById('aparencia-cor');
  campoCor.addEventListener('change', () => {
    // Digitar ou colar um hexadecimal move os três controles — senão eles
    // ficariam mostrando um estado que não é o da cor procurada.
    aparenciaSincronizarComCampo();
    aparenciaLimparFiltros();
    aparenciaBuscar();
  });

  document.getElementById('aparencia-texto').addEventListener('keydown', evento => {
    if (evento.key === 'Enter') aparenciaBuscar();
  });

  const dobra = document.getElementById('aparencia-escopo-dobra');
  dobra.addEventListener('click', aparenciaAlternarEscopo);
  dobra.addEventListener('keydown', evento => {
    if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault();
      aparenciaAlternarEscopo();
    }
  });

  aparenciaMontarSeletorDeCor();
  aparenciaAtualizarControlesDeImagem();
  aparenciaCarregarEstado(false);
}

function aparenciaMarcarUnico(seletorDaCaixa, escolhido) {
  document.querySelectorAll(seletorDaCaixa + ' .aparencia-seletor-botao')
    .forEach(botao => botao.classList.toggle('active', botao === escolhido));
}

function aparenciaLigarDeslizante(id, sufixo) {
  const campo = document.getElementById(id);
  const rotulo = document.getElementById(id + '-valor');
  campo.addEventListener('input', () => { rotulo.textContent = campo.value + sufixo; });
  campo.addEventListener('change', () => aparenciaBuscar());
}

// Presença e famílias só falam de imagem: com "Onde procurar" em Código eles
// não decidem nada, e um controle que não decide nada confunde.
function aparenciaAtualizarControlesDeImagem() {
  const mostrar = _aparenciaFonte !== 'codigo';
  ['aparencia-bloco-presenca', 'aparencia-bloco-familias'].forEach(id => {
    document.getElementById(id).classList.toggle('hidden', !mostrar);
  });
}

function aparenciaRestaurarEtiquetas() {
  _aparenciaDesligados = new Set(APARENCIA_ETIQUETAS_DESLIGADAS);
}

// Origem e linguagem voltam a ligar a cada busca nova; as etiquetas de fábrica
// voltam ao padrão. Carregar o filtro de uma busca para a seguinte esconderia
// achados sem que ninguém tivesse pedido.
function aparenciaLimparFiltros() {
  aparenciaRestaurarEtiquetas();
  _aparenciaAberto = -1;
}

// ── Escopo e índice ─────────────────────────────────────────────────────────
async function aparenciaCarregarEstado(forcar) {
  const resumo = document.getElementById('aparencia-indice-resumo');
  resumo.textContent = forcar ? 'Revarrendo…' : 'Lendo o projeto…';
  try {
    const resposta = await window.pywebview.api.aparencia_estado(currentProject, !!forcar);
    if (!resposta.success) {
      resumo.textContent = 'Erro ao ler o projeto';
      showToast(resposta.error || 'Erro ao ler o projeto', true);
      return;
    }
    aparenciaDesenharEscopo(resposta.pastas || [], resposta.ignorados || []);

    if (resposta.sem_pastas) {
      document.getElementById('aparencia-escopo-lista').innerHTML =
        '<div class="aparencia-escopo-fonte">Nenhuma pasta de trabalho definida.</div>';
      resumo.textContent = 'Sem pastas de trabalho';
      document.getElementById('aparencia-lista').innerHTML =
        '<div class="aparencia-vazio">Defina as pastas de trabalho em Projeto → Trabalho para usar a busca.</div>';
      return;
    }

    resumo.innerHTML = 'Índice: <strong>' + resposta.quantidade_cores + '</strong> cores · <strong>' +
      resposta.quantidade_textos + '</strong> textos · <strong>' + resposta.quantidade_imagens +
      '</strong> imagens · ' + resposta.quantidade_arquivos + ' arquivos · ' + resposta.gerado_em;

    // Sem a Pillow o índice de imagens fica vazio, e um zero sem explicação
    // parece defeito da aba. O `.svg` continua entrando: aquele é lido por
    // geometria, e não por pixel.
    const aviso = document.getElementById('aparencia-aviso-pillow');
    aviso.classList.toggle('hidden', resposta.pillow !== false);
    if (resposta.pillow === false) {
      aviso.textContent = '⚠️ Imagens em PNG, JPG, ICO e WebP indisponíveis: a biblioteca Pillow ' +
        'não está instalada. Os arquivos .svg continuam sendo lidos normalmente.';
    }

    if (forcar) {
      showToast('Índice de aparência atualizado');
      aparenciaBuscar();
    }
  } catch (erro) {
    resumo.textContent = 'Erro ao ler o projeto';
    showToast(String(erro), true);
  }
}

// ── Busca ───────────────────────────────────────────────────────────────────
async function aparenciaBuscar() {
  const lista = document.getElementById('aparencia-lista');
  lista.innerHTML = '<div class="aparencia-vazio">Procurando…</div>';
  _aparenciaAberto = -1;

  try {
    if (_aparenciaModo === 'cor') {
      const resposta = await window.pywebview.api.aparencia_buscar_cor(
        currentProject,
        document.getElementById('aparencia-cor').value,
        parseInt(document.getElementById('aparencia-tolerancia').value, 10),
        _aparenciaFonte,
        parseInt(document.getElementById('aparencia-presenca').value, 10),
        parseInt(document.getElementById('aparencia-familias').value, 10)
      );
      if (!resposta.success) return aparenciaMostrarErro(resposta.error);
      _aparenciaAchados = resposta.achados || [];
      _aparenciaContagens = { etiquetas: {}, fontes: resposta.contagem_fontes || {} };
      aparenciaRenderizarAchados(resposta.total, aparenciaDetalheDaCor(resposta));

    } else if (_aparenciaModo === 'texto') {
      const procurado = document.getElementById('aparencia-texto').value.trim();
      if (procurado.length < 2) {
        _aparenciaAchados = [];
        lista.innerHTML = '<div class="aparencia-vazio">Digite pelo menos 2 caracteres.</div>';
        aparenciaAtualizarContagem(0, 'achados');
        document.getElementById('aparencia-linguagens').innerHTML = '';
        return;
      }
      const resposta = await window.pywebview.api.aparencia_buscar_texto(
        currentProject, procurado,
        document.getElementById('aparencia-ignorar-acentos').checked,
        document.getElementById('aparencia-incluir-traducoes').checked,
        _aparenciaFonte, aparenciaEtiquetasLigadas(),
        document.getElementById('aparencia-nome-de-imagem').checked
      );
      if (!resposta.success) return aparenciaMostrarErro(resposta.error);
      _aparenciaAchados = resposta.achados || [];
      _aparenciaContagens = {
        etiquetas: resposta.contagem_etiquetas || {},
        fontes: resposta.contagem_fontes || {},
      };
      aparenciaRenderizarAchados(resposta.total);

    } else {
      const resposta = await window.pywebview.api.aparencia_auditoria(currentProject, {
        cores_repetidas: document.getElementById('aparencia-cores-repetidas').checked,
        tons_proximos: document.getElementById('aparencia-tons-proximos').checked,
        textos_duplicados: document.getElementById('aparencia-textos-duplicados').checked,
        icones_iguais: document.getElementById('aparencia-icones-iguais').checked,
        imagens_orfas: document.getElementById('aparencia-imagens-orfas').checked,
      });
      if (!resposta.success) return aparenciaMostrarErro(resposta.error);
      _aparenciaApontamentos = resposta.apontamentos || [];
      aparenciaRenderizarApontamentos(resposta.total);
    }
  } catch (erro) {
    aparenciaMostrarErro(String(erro));
  }
}

function aparenciaDetalheDaCor(resposta) {
  const partes = [document.getElementById('aparencia-cor').value,
                  'tolerância ' + document.getElementById('aparencia-tolerancia').value + '%'];
  if (_aparenciaFonte !== 'codigo') {
    partes.push('presença ≥ ' + document.getElementById('aparencia-presenca').value + '%');
  }
  if (resposta.abaixo_do_corte) partes.push(resposta.abaixo_do_corte + ' abaixo do corte');
  return '· ' + partes.join(' · ');
}

function aparenciaMostrarErro(mensagem) {
  document.getElementById('aparencia-lista').innerHTML =
    '<div class="aparencia-erro">' + aparenciaEscapar(mensagem || 'Erro desconhecido') + '</div>';
  aparenciaAtualizarContagem(0, 'achados');
}

function aparenciaEscapar(texto) {
  return String(texto === undefined || texto === null ? '' : texto)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function aparenciaAtualizarContagem(quantidade, rotulo, detalhe) {
  document.getElementById('aparencia-contagem').innerHTML =
    '<strong>' + quantidade + '</strong> ' + rotulo +
    (detalhe ? ' <span>' + aparenciaEscapar(detalhe) + '</span>' : '');
}

// ── Fichas de filtro: origem, etiqueta e linguagem ──────────────────────────
function aparenciaFichaLigada(chave) {
  return !_aparenciaDesligados.has(chave);
}

function aparenciaAchadoVisivel(achado) {
  if (!aparenciaFichaLigada('fonte:' + (achado.fonte || 'codigo'))) return false;
  if (!aparenciaFichaLigada('lang:' + achado.linguagem)) return false;
  if (_aparenciaModo === 'texto' && achado.etiqueta &&
      !aparenciaFichaLigada('etiqueta:' + achado.etiqueta)) return false;
  return true;
}

function aparenciaEtiquetasLigadas() {
  return Object.keys(APARENCIA_ETIQUETA_ICONE)
    .filter(etiqueta => aparenciaFichaLigada('etiqueta:' + etiqueta));
}

function aparenciaCriarFicha(caixa, chave, rotulo, classeExtra) {
  const botao = document.createElement('button');
  botao.className = 'aparencia-linguagem-filtro' + (classeExtra ? ' ' + classeExtra : '') +
    (aparenciaFichaLigada(chave) ? ' active' : '');
  botao.textContent = rotulo;
  botao.title = aparenciaFichaLigada(chave) ? 'Clique para esconder' : 'Clique para mostrar';
  botao.addEventListener('click', () => {
    if (_aparenciaDesligados.has(chave)) _aparenciaDesligados.delete(chave);
    else _aparenciaDesligados.add(chave);
    _aparenciaAberto = -1;
    // Ligar uma ETIQUETA refaz a busca, e não só o desenho. A ordem do backend
    // manda as etiquetas desligadas para o fim, e com o corte em 400 elas podem
    // nem ter vindo — sem refazer, o clique não traria achado nenhum.
    if (classeExtra === 'etiqueta') {
      aparenciaBuscar();
      return;
    }
    aparenciaRenderizarFichas();
    aparenciaRenderizarLista();
  });
  caixa.appendChild(botao);
}

function aparenciaSeparadorDeFicha(caixa) {
  const traco = document.createElement('div');
  traco.className = 'aparencia-separador-chip';
  caixa.appendChild(traco);
}

// As fichas são toggle MÚLTIPLO, e não escolha única: as três famílias (origem,
// etiqueta, linguagem) respondem a perguntas independentes, e uma escolha única
// obrigaria a desistir de duas para usar a terceira.
function aparenciaRenderizarFichas() {
  const caixa = document.getElementById('aparencia-linguagens');
  caixa.innerHTML = '';
  if (!_aparenciaAchados.length) return;

  // Origem e etiqueta vêm das contagens do índice inteiro; linguagem vem da
  // página, porque é o único filtro que age só sobre o que está na tela.
  const daPagina = (chave, valor) =>
    _aparenciaAchados.filter(a => (a[chave] || '') === valor).length;

  const fontes = _aparenciaContagens.fontes || {};
  if (Object.keys(fontes).length > 1) {
    if (fontes.codigo) {
      aparenciaCriarFicha(caixa, 'fonte:codigo', '⌨ Código ' + fontes.codigo, 'fonte');
    }
    if (fontes.imagem) {
      aparenciaCriarFicha(caixa, 'fonte:imagem', '🖼 Imagens ' + fontes.imagem, 'fonte');
    }
    aparenciaSeparadorDeFicha(caixa);
  }

  if (_aparenciaModo === 'texto') {
    const etiquetas = _aparenciaContagens.etiquetas || {};
    const nomes = Object.keys(APARENCIA_ETIQUETA_ICONE).filter(nome => etiquetas[nome]);
    if (nomes.length) {
      nomes.forEach(etiqueta => {
        aparenciaCriarFicha(caixa, 'etiqueta:' + etiqueta,
          APARENCIA_ETIQUETA_ICONE[etiqueta] + ' ' + etiqueta + ' ' + etiquetas[etiqueta],
          'etiqueta');
      });
      aparenciaSeparadorDeFicha(caixa);
    }
  }

  const linguagens = [...new Set(_aparenciaAchados.map(a => a.linguagem))].filter(Boolean);
  if (linguagens.length > 1) {
    linguagens.forEach(linguagem => {
      aparenciaCriarFicha(caixa, 'lang:' + linguagem,
        linguagem + ' ' + daPagina('linguagem', linguagem));
    });
  }
}

// ── Achados (cor e texto) ───────────────────────────────────────────────────
function aparenciaRenderizarAchados(total, detalhe) {
  aparenciaRenderizarFichas();
  aparenciaRenderizarLista(total, detalhe);
}

function aparenciaRenderizarLista(total, detalhe) {
  const visiveis = _aparenciaAchados.filter(aparenciaAchadoVisivel);
  const partes = [];
  if (detalhe) partes.push(detalhe);
  if (total !== undefined && total > _aparenciaAchados.length) {
    partes.push('mostrando os ' + _aparenciaAchados.length + ' primeiros de ' + total);
  }
  aparenciaAtualizarContagem(visiveis.length, 'achados', partes.join(' · '));

  const lista = document.getElementById('aparencia-lista');
  if (!visiveis.length) {
    lista.innerHTML = '<div class="aparencia-vazio">Nenhum achado. ' +
      (_aparenciaAchados.length
        ? 'Ligue alguma ficha acima para ver os que estão escondidos.'
        : (_aparenciaModo === 'cor' ? 'Tente aumentar a tolerância.' : 'Tente outro texto.')) +
      '</div>';
    return;
  }

  lista.innerHTML = '';
  visiveis.forEach((achado, indice) => {
    lista.appendChild(aparenciaCriarCartao(achado, indice));
  });
}
