// ══════════════════════════════════════════ FONTES DE SUBAGENTE ══
// De ONDE cada subagente lê. É o segundo eixo da taxonomia: o primeiro é o
// TIPO (acionado pelo programa · chamado pelo chat · prompt fixo), que já era o
// separador de grupo na lista; este é a borda colorida e o selo.
//
// Mora num arquivo próprio, e não dentro de chat-agentes.js, porque a Fila
// reaproveita os mesmos subagentes — uma legenda nascida dentro da tela do
// Chat viraria duas legendas divergentes.
//
// ⚠ A fonte de um subagente tem que bater com FERRAMENTAS_POR_SUBAGENTE no
// backend. Uma legenda que mente é pior que legenda nenhuma: ela promete uma
// capacidade que o agente não tem.

const AGENTES_FONTES = {
  codigo: {
    rotulo: 'Código do projeto',
    selo: 'CÓDIGO',
    cor: 'var(--green)',
    dica: 'Lê os arquivos de código na pasta raiz do projeto.',
  },
  'doc-gerada': {
    rotulo: 'Documentação gerada',
    selo: 'DOC. GERADA',
    cor: 'var(--blue)',
    dica: 'Lê o que os agentes de automação produziram: documentação técnica, índice, pipeline, resumo de pastas.',
  },
  'saida-skills': {
    rotulo: 'Saída das skills',
    selo: 'SAÍDA DAS SKILLS',
    cor: 'var(--amber)',
    dica: 'Lê as bases normativas — o que este projeto decidiu sobre como o trabalho deve ser.',
  },
  nenhuma: {
    rotulo: 'Não lê nada',
    selo: 'SEM FONTE',
    cor: 'var(--cinza)',
    dica: 'Não consulta arquivo nenhum: age só sobre o texto da conversa.',
  },
};

// A ordem em que as fontes aparecem na legenda — do mais concreto (o código)
// para o mais abstrato (as decisões), terminando em quem não lê nada.
const AGENTES_FONTES_ORDEM = ['codigo', 'doc-gerada', 'saida-skills', 'nenhuma'];

function _agenteFontesDe(agente) {
  const proprias = (agente && agente.fontes) || [];
  // A fonte que uma extensão ligada empresta junto da ferramenta (fase 07):
  // o Verificador que ganha uma ferramenta de extensão ganha o selo dela.
  const emprestadas = (agente && typeof SUBAGENTES_FONTES_DE_EXTENSOES !== 'undefined'
    && SUBAGENTES_FONTES_DE_EXTENSOES[agente.id]) || [];
  const fontes = proprias.concat(emprestadas.filter(f => !proprias.includes(f)));
  return fontes.length ? fontes : ['nenhuma'];
}

// A cor da borda esquerda do card. Com mais de uma fonte, vale a primeira —
// o selo é quem conta a história completa.
function agenteFonteCor(agente) {
  const primeira = _agenteFontesDe(agente)[0];
  return (AGENTES_FONTES[primeira] || AGENTES_FONTES.nenhuma).cor;
}

// Os selos de um agente, ao lado do nome. O Analista leva dois — ele lê código
// e documentação gerada, e esconder uma das duas seria informação errada.
function agenteFonteSelosMarkup(agente) {
  return _agenteFontesDe(agente).map((id, i) => {
    const fonte = AGENTES_FONTES[id] || AGENTES_FONTES.nenhuma;
    // O primeiro selo pode ter texto próprio: o `selo_fonte` de um
    // subagente de extensão (fase 07) — o nome da base que ele lê, por
    // exemplo.
    const texto = (i === 0 && agente.seloFonte) ? agente.seloFonte : fonte.selo;
    return `<span class="agente-fonte-selo" style="color:${fonte.cor};border-color:${fonte.cor};background:color-mix(in srgb, ${fonte.cor} 12%, transparent)" title="${escapeHtml(fonte.dica)}">${escapeHtml(texto)}</span>`;
  }).join('');
}

// O bloco de legenda no topo da lista. Sem ele a borda colorida é decoração:
// o usuário vê que os cards diferem, mas não sabe em quê.
function agenteFonteLegendaMarkup() {
  const tiras = AGENTES_FONTES_ORDEM.map(id => {
    const fonte = AGENTES_FONTES[id];
    return `<span class="agente-fonte-legenda-item" title="${escapeHtml(fonte.dica)}">
      <span class="agente-fonte-tira" style="background:${fonte.cor}"></span>${escapeHtml(fonte.rotulo)}
    </span>`;
  }).join('');
  return `
    <div class="agente-fonte-legenda">
      <div class="agente-fonte-legenda-titulo">O que cada agente consegue ler</div>
      <div class="agente-fonte-legenda-tiras">${tiras}</div>
    </div>`;
}
