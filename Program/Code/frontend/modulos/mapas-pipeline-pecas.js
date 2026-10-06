// ═══════════════ VISUALIZAR PIPELINE — PEÇAS COMUNS ÀS LEITURAS ══
// O nó de arquivo, as etiquetas de "por onde" e de selo, o cabeçalho do
// desenho e o "foco". Ficam fora das leituras porque são as MESMAS peças nas
// seis: se cada leitura tivesse a sua, o nó de arquivo teria seis aparências
// diferentes para a mesma coisa — que foi exatamente o que aconteceu antes,
// quando `.vp-passo-arq`, `.vp-vagao-arq` e `.vp-cartao-arq` eram três regras
// para o mesmo nome de arquivo.

function vpNo(arquivo) {
  return `<span class="vp-no ${vpClasseDeCamada(arquivo)}" data-arquivo="${escapeHtml(arquivo)}"
    title="${escapeHtml(arquivo)}">${escapeHtml(vpNomeBase(arquivo))}</span>`;
}

function vpChipsDeVia(vias, teto) {
  const mostradas = vias.slice(0, teto);
  return `<span class="vp-vias">${mostradas.map(v => `<span class="vp-via">${escapeHtml(v)}</span>`).join('')}${
    vias.length > teto ? `<span class="vp-via mais" title="${escapeHtml(vias.slice(teto).join(', '))}">+${vias.length - teto}</span>` : ''}</span>`;
}

function vpChipsDeSelo(ligacao, comuns) {
  const proprios = vpSelosProprios(ligacao, comuns);
  if (!proprios.length) return '';
  return `<span class="vp-vias">${proprios.map(s =>
    `<span class="vp-via mais" title="${escapeHtml(s)}">+${escapeHtml(vpNomeBase(s))}</span>`).join('')}</span>`;
}

function vpTituloDoDesenho(foco) {
  const cadeia = foco.cadeia;
  const emoji = vpEmojiDaCadeia(cadeia);
  const doModelo = vpNomeDoModelo(cadeia);
  const arquivos = vpArquivosDosPassos(foco.passos).length;
  return `
    <div class="vp-titulo-cadeia">
      <span class="vp-pino">C${cadeia.n}</span>
      <span class="vp-titulo-nome">${emoji ? emoji + ' ' : ''}${escapeHtml(vpRotuloDaCadeia(cadeia))}</span>
      <span class="vp-titulo-meta">${escapeHtml(cadeia.cabeca || '—')}${cadeia.tipo ? ' · ' + escapeHtml(cadeia.tipo) : ''}${doModelo ? ' · ' + escapeHtml(doModelo) : ''}</span>
      <span class="vp-tags">
        ${_vpFase ? `<span class="vp-tag">recorte: fase ${_vpFase}</span>` : ''}
        <span class="vp-tag">${foco.passos.length} passos</span>
        <span class="vp-tag">${foco.ligacoes.length} ligações</span>
        <span class="vp-tag">${arquivos} arquivos</span>
        <span class="vp-tag travessia">${vpContarTravessias(foco.passos)} travessias</span>
        ${foco.comuns.length ? `<span class="vp-tag selo" title="Aparece em todos os passos desta cadeia">selo comum: +${escapeHtml(foco.comuns.map(vpNomeBase).join(' +'))}</span>` : ''}
      </span>
    </div>`;
}

// O "foco" é o recorte que a leitura recebe pronto: os passos em cena, já
// agrupados (ou não) e com os selos comuns separados. Assim nenhuma leitura
// precisa saber se o interruptor está ligado nem se há recorte de fase.
// `agrupar` nasce com o global de hoje — a sub-aba continua idêntica. O Mapa
// da mudança passa o valor dele, porque lá não existe o toggle "Agrupar
// repetidos".
function vpMontarFoco(cadeia, passos, agrupar = (typeof _vpAgrupar !== 'undefined' ? _vpAgrupar : true)) {
  return {
    cadeia, passos,
    ligacoes: agrupar ? vpLigacoes(passos) : vpPassosComoLigacoes(passos),
    comuns: vpSelosComuns(passos),
  };
}
