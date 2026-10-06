// ══════════════════════════════════ ABA: APARÊNCIA — CARTÕES E AÇÕES ══
// O cartão de um achado, e os botões dele. Saiu de `aparencia.js` quando a aba
// ganhou o cartão de imagem: são dois desenhos irmãos, com as mesmas partes em
// papéis diferentes.
//
//   pastilha de cor  ↔  miniatura da imagem
//   trecho de código ↔  barra de paleta
//   linha do arquivo ↔  dimensões
//
// Os cartões da AUDITORIA moram aqui pelo mesmo motivo: são cartão, e o
// arquivo de estado já estava no teto de tamanho.
//
// Depende de `aparencia.js` (estado, `aparenciaEscapar`, `_aparenciaAberto`).

// ── Cartão ──────────────────────────────────────────────────────────────────
function aparenciaCriarCartao(achado, indice) {
  const ehImagem = achado.fonte === 'imagem';
  const ehCor = achado.tipo === 'cor' || (ehImagem && achado.rgb);
  const cor = ehCor ? achado.valor : '';

  const cartao = document.createElement('div');
  cartao.className = 'aparencia-achado' +
    (ehImagem ? ' imagem' : '') +
    (achado.abaixo_do_corte ? ' abaixo' : '') +
    (indice === _aparenciaAberto ? ' aberto' : '');
  cartao.innerHTML =
    aparenciaCabecalhoDoCartao(achado, ehImagem, ehCor, cor) +
    aparenciaCorpoDoCartao(achado, indice, ehImagem, ehCor, cor);

  cartao.querySelector('.aparencia-achado-cabecalho')
    .addEventListener('click', () => aparenciaAlternarAchado(indice, achado));
  cartao.querySelectorAll('[data-aparenciaacao]').forEach(botao => {
    botao.addEventListener('click', evento => {
      evento.stopPropagation();
      const acao = botao.dataset.aparenciaacao;
      if (acao === 'copiar') aparenciaCopiarParaIA(achado);
      else if (acao === 'abrir') aparenciaAbrirNoArquivo(achado);
      else if (acao === 'editor') aparenciaAbrirNoEditorDeImagem(achado);
    });
  });
  return cartao;
}

function aparenciaMarcadoresDoCartao(achado, ehImagem, ehCor) {
  const marcadores = [];
  marcadores.push('<span class="aparencia-marcador ' + (ehImagem ? 'fonte-imagem">🖼 imagem' : 'fonte-codigo">⌨ código') + '</span>');

  if (achado.etiqueta) {
    const classe = achado.etiqueta === 'mensagem' ? ' msg' : '';
    marcadores.push('<span class="aparencia-etiqueta' + classe + '">' +
      aparenciaEscapar(achado.etiqueta) + '</span>');
  }
  // ⚠️ "palpite" é só de TEXTO. Cor é lexical em qualquer linguagem, e marcá-la
  // de palpite seria mentir sobre a confiança do achado.
  if (achado.palpite) marcadores.push('<span class="aparencia-marcador alerta" ' +
    'title="Extensão sem gramática: a leitura foi lexical, não pela árvore do arquivo">palpite</span>');

  if (achado.eh_definicao) marcadores.push('<span class="aparencia-marcador token">definição</span>');
  if (achado.via_token) marcadores.push('<span class="aparencia-marcador token">via ' +
    aparenciaEscapar(achado.constante) + '</span>');
  if (achado.literal_solto) marcadores.push('<span class="aparencia-marcador alerta">literal solto</span>');
  if (achado.eh_traducao) marcadores.push('<span class="aparencia-marcador token">tradução</span>');
  if (achado.ocorrencias > 1) marcadores.push('<span class="aparencia-marcador alerta">' +
    achado.ocorrencias + ' ocorrências</span>');
  if (ehCor && achado.distancia > 0) marcadores.push('<span class="aparencia-marcador">Δ ' +
    achado.distancia + '%</span>');

  if (ehImagem) {
    if (achado.fatia !== undefined) {
      marcadores.push('<span class="aparencia-marcador">' +
        aparenciaEscapar(achado.familia_rotulo || 'cor') + ' · ' + achado.fatia + '% da área</span>');
    }
    if (achado.abaixo_do_corte) {
      marcadores.push('<span class="aparencia-marcador alerta">só ' + achado.fatia +
        '% — abaixo do corte</span>');
    }
    if (achado.largura) marcadores.push('<span class="aparencia-marcador">' +
      achado.largura + ' × ' + achado.altura + '</span>');
  }
  return marcadores.join('');
}

function aparenciaCabecalhoDoCartao(achado, ehImagem, ehCor, cor) {
  const identidade = ehImagem
    ? aparenciaMiniatura(achado)
    : (ehCor ? '<span class="aparencia-pastilha" style="background:' + aparenciaEscapar(cor) + '"></span>' : '');
  const detalhe = ehImagem
    ? aparenciaEscapar(achado.arquivo)
    : aparenciaEscapar(achado.arquivo) + ':' + achado.linha;

  return `
    <div class="aparencia-achado-cabecalho">
      <div class="aparencia-achado-identidade">
        ${identidade}
        <span class="aparencia-alvo">${aparenciaEscapar(achado.alvo || achado.valor)}</span>
        <span class="aparencia-linguagem">${aparenciaEscapar(achado.linguagem)}</span>
      </div>
      <div class="aparencia-achado-detalhe">
        <span class="aparencia-achado-arquivo">${detalhe}</span>
        <span>${aparenciaEscapar(ehImagem ? achado.valor : (ehCor ? achado.bruto : '“' + achado.valor + '”'))}</span>
        ${aparenciaMarcadoresDoCartao(achado, ehImagem, ehCor)}
      </div>
      ${ehImagem ? aparenciaBarraDePaleta(achado.paleta) : ''}
    </div>`;
}

function aparenciaMiniatura(achado, grande) {
  const classe = 'aparencia-miniatura' + (grande ? ' grande' : '');
  if (!achado.miniatura) return '<span class="' + classe + '"></span>';
  return '<span class="' + classe + '"><img src="' + aparenciaEscapar(achado.miniatura) +
    '" alt="" /></span>';
}

// A barra é a resposta visual a "de que cor é essa imagem?": cada faixa é uma
// família, e a largura É a fatia da área que ela ocupa.
function aparenciaBarraDePaleta(paleta) {
  if (!paleta || !paleta.length) return '';
  return '<div class="aparencia-paleta">' + paleta.map(familia =>
    '<div class="aparencia-paleta-faixa" style="background:' + aparenciaEscapar(familia.hex) +
    ';width:' + familia.fatia + '%" title="' + aparenciaEscapar(familia.rotulo) + ' ' +
    familia.fatia + '%"></div>').join('') + '</div>';
}

function aparenciaListaDePaleta(paleta, presencaMinima) {
  if (!paleta || !paleta.length) return '';
  return '<div class="aparencia-paleta-lista">' + paleta.map(familia => {
    const abaixo = presencaMinima !== undefined && familia.fatia < presencaMinima;
    return '<div class="aparencia-paleta-item' + (abaixo ? ' abaixo' : '') + '">' +
      '<span class="aparencia-pastilha" style="background:' + aparenciaEscapar(familia.hex) + '"></span>' +
      '<b>' + aparenciaEscapar(familia.rotulo) + '</b>' +
      '<span>' + aparenciaEscapar(familia.hex) + '</span>' +
      '<span class="pct">' + familia.fatia + '%</span></div>';
  }).join('') + '</div>';
}

function aparenciaCorpoDoCartao(achado, indice, ehImagem, ehCor, cor) {
  const presenca = parseInt(document.getElementById('aparencia-presenca').value, 10);
  const propriedades = ehImagem
    ? `<dt>Arquivo</dt><dd>${aparenciaEscapar(achado.arquivo)}</dd>
       <dt>Formato</dt><dd>${aparenciaEscapar(achado.linguagem)}</dd>
       <dt>Cor casada</dt><dd>${aparenciaEscapar(achado.valor)}</dd>
       <dt>Família</dt><dd>${aparenciaEscapar(achado.familia_rotulo || '—')}</dd>
       <dt>Fatia da área</dt><dd>${achado.fatia === undefined ? '—' : achado.fatia + '%'}</dd>
       <dt>Dimensões</dt><dd>${achado.largura || '?'} × ${achado.altura || '?'}</dd>`
    : `<dt>Arquivo</dt><dd>${aparenciaEscapar(achado.arquivo)}:${achado.linha}</dd>
       <dt>Linguagem</dt><dd>${aparenciaEscapar(achado.linguagem)}</dd>
       <dt>Valor</dt><dd>${aparenciaEscapar(achado.valor)}</dd>
       <dt>Constante</dt><dd>${aparenciaEscapar(achado.constante || '— (literal solto)')}</dd>
       <dt>Ocorrências</dt><dd>${achado.ocorrencias || 1}</dd>`;

  // No cartão de imagem a lista de paleta ocupa o lugar do trecho de código:
  // não há linha nenhuma a mostrar, e a paleta é o que responde à pergunta.
  const miolo = ehImagem
    ? aparenciaListaDePaleta(achado.paleta, presenca)
    : `<div class="aparencia-trecho" id="aparencia-trecho-${indice}">
         <div class="aparencia-trecho-linha">carregando…</div>
       </div>` + aparenciaCoresDoElemento(achado);

  const palco = ehImagem
    ? aparenciaMiniatura(achado, true)
    : `<span class="aparencia-previa-amostra" style="background:${ehCor ? aparenciaEscapar(cor) : 'transparent'}">
         ${aparenciaEscapar(ehCor ? (achado.alvo || 'Amostra').slice(0, 18) : String(achado.valor).slice(0, 24))}
       </span>`;

  return `
    <div class="aparencia-achado-corpo">
      <div class="aparencia-achado-grade">
        <div>
          <dl class="aparencia-propriedades">${propriedades}</dl>
          ${miolo}
          <div class="aparencia-acoes">${aparenciaBotoesDoCartao(ehImagem)}</div>
        </div>
        <div class="aparencia-previa">
          <div class="aparencia-previa-titulo">Prévia</div>
          <div class="aparencia-previa-palco">${palco}</div>
          <div class="aparencia-previa-valor">${aparenciaEscapar(achado.valor)}</div>
        </div>
      </div>
    </div>`;
}

// Cor que pinta o MESMO elemento. Sem isto, um `linear-gradient(#3498DB,
// #2ECC71)` aparece como dois achados soltos, e o cartão não tem como dizer que
// os dois são o mesmo botão.
function aparenciaCoresDoElemento(achado) {
  const cores = achado.cores_do_elemento;
  if (!cores || cores.length < 2) return '';
  return '<div class="aparencia-paleta-lista">' +
    '<div class="aparencia-paleta-item"><b>Mesmo elemento</b>' +
    '<span>' + aparenciaEscapar(achado.elemento || '') + '</span></div>' +
    cores.map(item =>
      '<div class="aparencia-paleta-item">' +
      '<span class="aparencia-pastilha" style="background:' + aparenciaEscapar(item.hex) + '"></span>' +
      '<span>' + aparenciaEscapar(item.hex) + '</span>' +
      '<span class="pct">' + item.fatia + '%</span></div>').join('') + '</div>';
}

// "Abrir no arquivo" é o mesmo botão nos dois cartões, e faz coisas diferentes:
// em código, o editor na linha; em imagem, a pasta com o arquivo selecionado.
// Quem decide é o backend, que sabe a extensão — o rótulo não muda porque a
// intenção do usuário é a mesma: chegar ao arquivo.
function aparenciaBotoesDoCartao(ehImagem) {
  const abrir = '<button class="btn btn-primary btn-sm" data-aparenciaacao="abrir">' +
    '📂 Abrir no arquivo</button>';
  const editor = ehImagem
    ? '<button class="btn btn-utility btn-sm" data-aparenciaacao="editor">🖌 Abrir no editor de imagem</button>'
    : '';
  const copiar = '<button class="btn btn-special btn-sm" data-aparenciaacao="copiar">🤖 Copiar para IA</button>';
  return abrir + editor + copiar;
}

// ── Ações ───────────────────────────────────────────────────────────────────
async function aparenciaAlternarAchado(indice, achado) {
  _aparenciaAberto = (_aparenciaAberto === indice ? -1 : indice);
  aparenciaRenderizarLista();
  if (_aparenciaAberto !== indice) return;
  if (achado.fonte === 'imagem') return;      // imagem não tem trecho a carregar

  const caixa = document.getElementById('aparencia-trecho-' + indice);
  if (!caixa) return;
  try {
    const resposta = await window.pywebview.api.aparencia_ler_trecho(
      currentProject, achado.arquivo, achado.linha, 3);
    if (!resposta.success) {
      caixa.innerHTML = '<div class="aparencia-trecho-linha">' +
        aparenciaEscapar(resposta.error) + '</div>';
      return;
    }
    caixa.innerHTML = resposta.trecho.map(linha =>
      '<div class="aparencia-trecho-linha' + (linha.alvo ? ' alvo' : '') + '">' +
      '<span class="aparencia-trecho-numero">' + linha.numero + '</span>' +
      aparenciaEscapar(linha.texto) + '</div>').join('');
  } catch (erro) {
    caixa.innerHTML = '<div class="aparencia-trecho-linha">' + aparenciaEscapar(erro) + '</div>';
  }
}

async function aparenciaAbrirNoArquivo(achado) {
  try {
    const resposta = await window.pywebview.api.aparencia_abrir_no_arquivo(
      currentProject, achado.arquivo, achado.linha);
    if (resposta.success) {
      showToast(resposta.editor === 'pasta'
        ? 'Abrindo a pasta com o arquivo selecionado'
        : 'Abrindo no ' + resposta.editor);
    } else {
      showToast(resposta.error || 'Não foi possível abrir', true);
    }
  } catch (erro) {
    showToast(String(erro), true);
  }
}

async function aparenciaAbrirNoEditorDeImagem(achado) {
  try {
    const resposta = await window.pywebview.api.aparencia_abrir_no_editor_de_imagem(
      currentProject, achado.arquivo);
    if (resposta.success) showToast('Abrindo no editor de imagem');
    else showToast(resposta.error || 'Não foi possível abrir', true);
  } catch (erro) {
    showToast(String(erro), true);
  }
}

async function aparenciaCopiarParaIA(achado) {
  try {
    const resposta = await window.pywebview.api.aparencia_montar_relatorio_ia(
      currentProject, achado, '(descreva aqui a mudança visual desejada)');
    if (!resposta.success) return showToast(resposta.error || 'Erro ao montar o relatório', true);
    await navigator.clipboard.writeText(resposta.texto);
    showToast('Contexto copiado');
  } catch (erro) {
    showToast(String(erro), true);
  }
}

// ── Auditoria ───────────────────────────────────────────────────────────────
function aparenciaRenderizarApontamentos(total) {
  document.getElementById('aparencia-linguagens').innerHTML = '';
  const cortado = total > _aparenciaApontamentos.length
    ? 'mostrando os ' + _aparenciaApontamentos.length + ' primeiros de ' + total : '';
  aparenciaAtualizarContagem(_aparenciaApontamentos.length, 'apontamentos', cortado);

  const lista = document.getElementById('aparencia-lista');
  if (!_aparenciaApontamentos.length) {
    lista.innerHTML = '<div class="aparencia-vazio">Nada repetido ou fora do lugar. 🎉</div>';
    return;
  }

  lista.innerHTML = '';
  _aparenciaApontamentos.forEach(apontamento => {
    const cartao = document.createElement('div');
    cartao.className = 'aparencia-apontamento';
    cartao.innerHTML = `
      <div class="aparencia-apontamento-titulo">
        ${apontamento.cor ? '<span class="aparencia-pastilha" style="background:' +
          aparenciaEscapar(apontamento.cor) + '"></span>' : ''}
        <span class="aparencia-apontamento-especie">${aparenciaEscapar(apontamento.especie)}</span>
        <span>${aparenciaEscapar(apontamento.valor)}</span>
      </div>
      <div class="aparencia-apontamento-resumo">
        ${aparenciaEscapar(apontamento.resumo)} · ${aparenciaEscapar(apontamento.linguagens.join(', '))}
      </div>
      <div class="aparencia-apontamento-lugares"></div>`;

    const caixaLugares = cartao.querySelector('.aparencia-apontamento-lugares');
    apontamento.lugares.forEach(lugar => {
      const linha = document.createElement('div');
      linha.className = 'aparencia-apontamento-lugar';
      linha.textContent = lugar.arquivo + ':' + lugar.linha + '  ' + lugar.trecho;
      linha.title = 'Abrir no arquivo';
      linha.addEventListener('click', () => aparenciaAbrirNoArquivo(lugar));
      caixaLugares.appendChild(linha);
    });

    lista.appendChild(cartao);
  });
}
