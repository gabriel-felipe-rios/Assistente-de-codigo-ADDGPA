// ═════════ EXTENSÕES DO PROGRAMA — "O QUE ELA ACRESCENTA", NA PÁGINA DA EXTENSÃO ══
// A parte 2 da página de uma extensão (ver o topo de `extensoes/tela.js`):
// o que o manifesto DECLARA, escrito por extenso com o catálogo que o backend
// manda junto de `list_telas_de_extensoes` (`_xtCatalogoDaPagina`, de
// `tela.js`). Saiu de `tela.js` em 23/09/2026 (fase 13) pelo teto de 500
// linhas — a pergunta que este arquivo responde é uma só: "o que esta
// extensão põe no programa?".
//
// Duas linhas mandam na leitura (D41): **Tipos** diz o que ela é capaz de
// fazer (a categoria, 1 a 4); **Recursos** diz com que peças (a lista
// `acrescenta`). As outras linhas detalham as peças que têm hora ou lugar.
//
// ⚠️ Nenhum nome aqui sai de uma lista copiada para o JavaScript: tipo,
// recurso, ponto, evento, consulta, parte e lugar de tela vêm do catálogo do
// backend. Um manifesto antigo (números 2…27) chega com os tipos JÁ
// traduzidos pelo backend (`validacao.py::traduzir_formato_antigo`).

/** Uma linha: rótulo à esquerda, o que for à direita. */
function _xtFichaLinha(rotulo, valorHtml, classe) {
  return `<div class="xt-ficha-rotulo">${escapeHtml(rotulo)}</div>
          <div class="xt-ficha-valor${classe ? ' ' + classe : ''}">${valorHtml}</div>`;
}

/** Os lugares de UM item de `acrescenta`, por extenso — `[]` quando o item
 *  não diz lugar (Em segundo plano). */
function _xtLugaresDoItem(item, cat) {
  const partes = cat.partes || {};
  switch (item.recurso) {
    case 'marca':
    case 'painel':
      return [cat.pontos[item.lugar] || item.lugar];
    case 'comando':
      return (item.lugares || []).map((l) => cat.pontos[l] || l);
    case 'tela':
      return [(cat.lugares_de_tela || {})[item.lugar] || item.lugar];
    case 'reacao':
      return [cat.eventos[item.evento] || item.evento];
    case 'editor':
    case 'visual':
      return [(partes[item.recurso] || {})[item.parte] || item.parte];
    case 'agente':
      return [(partes.agente || {})[item.forma] || item.forma];
    case 'ferramenta':
      return [item.nome];
    case 'prompt':
      return [(cat.alvos_de_prompt || {})[item.alvo] || item.alvo];
    default:
      return [];
  }
}

/**
 * A linha Recursos: os recursos da lista `acrescenta`, sem repetir, na ordem
 * do catálogo (a tabela dos doze), cada um com os lugares entre parênteses —
 * e **Opções sempre por último**, porque toda extensão tem página (D34).
 */
function _xtRecursosHtml(f, cat) {
  const recursos = cat.recursos || {};
  const porRecurso = new Map();
  (f.acrescenta || []).forEach((item) => {
    if (!item || !item.recurso || item.recurso === 'opcoes') return;
    if (!porRecurso.has(item.recurso)) porRecurso.set(item.recurso, []);
    const lugares = porRecurso.get(item.recurso);
    _xtLugaresDoItem(item, cat).forEach((l) => { if (l && !lugares.includes(l)) lugares.push(l); });
  });
  // A ordem do catálogo; um recurso que o catálogo não conhece vai no fim,
  // com o nome cru — visível, nunca sumido.
  const ordem = [...Object.keys(recursos).filter((r) => porRecurso.has(r)),
                 ...[...porRecurso.keys()].filter((r) => !(r in recursos))];
  const nomeDe = (r) => (recursos[r] ? recursos[r].nome : r);
  const itens = ordem.map((r) => {
    const lugares = porRecurso.get(r);
    return escapeHtml(nomeDe(r)) + (lugares.length ? ` (${escapeHtml(lugares.join('; '))})` : '');
  });
  itens.push(escapeHtml(recursos.opcoes ? recursos.opcoes.nome : 'Opções'));
  return itens.join(' · ');
}

/**
 * 2 · O que ela acrescenta ao programa, por extenso.
 *
 * Cada linha cruza o que o manifesto DECLARA (um nome) com o que o catálogo
 * do backend SABE sobre aquele nome (onde fica, quando dispara). Sem o
 * catálogo — a ponte ainda não respondeu — sai só o nome, nunca nada.
 */
function _xtAcrescentaHtml(tela) {
  const f = tela.folha || {};
  const cat = _xtCatalogoDaPagina;
  const linhas = [];
  const codigo = (s) => `<code>${escapeHtml(String(s))}</code>`;
  const comOnde = (nome, onde) => codigo(nome) + (onde ? ` — ${escapeHtml(onde)}` : '');

  // Os 4 tipos (D43, D45): o nome e, no `title`, o "O que faz" do tipo.
  const tipos = (f.tipos || []).map((t) => {
    const info = cat.tipos[t];
    const nome = info ? info.nome : `tipo ${t}`;
    const faz = (info && info.faz) ? info.faz : `tipo ${t}`;
    return `<span class="xt-tipo" title="${escapeHtml(faz)}">${escapeHtml(nome)}
              <span class="xt-tipo-n">${escapeHtml(t)}</span></span>`;
  });
  if (tipos.length) linhas.push(_xtFichaLinha('Tipos', tipos.join(' ')));

  // As peças (D41) — logo abaixo dos tipos.
  linhas.push(_xtFichaLinha('Recursos', _xtRecursosHtml(f, cat)));

  const encaixes = (f.encaixes || []).map((e) => comOnde(e.ponto, cat.pontos[e.ponto]));
  if (encaixes.length) linhas.push(_xtFichaLinha('Encaixa em', encaixes.join('<br />')));

  const eventos = f.eventos || [];
  const observa = eventos.filter((e) => !e.guardia).map((e) => comOnde(e.nome, cat.eventos[e.nome]));
  if (observa.length) linhas.push(_xtFichaLinha('Observa', observa.join('<br />')));
  // A guardiã salta, na cor de alerta: é a única coisa desta camada que pode
  // impedir uma ação do usuário — mesma regra de `_xtPoderesHtml`.
  const guarda = eventos.filter((e) => e.guardia).map((e) => comOnde(e.nome, cat.eventos[e.nome]));
  if (guarda.length) linhas.push(_xtFichaLinha('⚠ Pode barrar', guarda.join('<br />'), 'xt-ficha-guardia'));

  const consultas = (f.consultas || []).map((c) => comOnde(c.nome, cat.consultas[c.nome]));
  if (consultas.length) linhas.push(_xtFichaLinha('Responde', consultas.join('<br />')));

  // O conteúdo que ela entrega sai de `acrescenta` (Recursos do Editor ›
  // cor, Visual › ícones), e nunca da chave interna de `dados` ('11', '24').
  // O rótulo é «Dados», o do preview aprovado (fase 13).
  const dados = (f.acrescenta || [])
    // As partes que RESPONDEM (sugestões, dica, formatação) já saíram em
    // "Responde", pela consulta; aqui só o que é dado (fase 12).
    .filter((i) => (i.recurso === 'visual' || i.recurso === 'editor')
      && (i.pasta || !['sugestoes', 'dica', 'formatacao'].includes(i.parte)))
    .map((i) => {
      const info = (cat.recursos || {})[i.recurso];
      return `${escapeHtml(info ? info.nome : i.recurso)} › ${escapeHtml(i.parte)}: ${codigo(i.pasta || i.arquivo)}`;
    });
  if (dados.length) linhas.push(_xtFichaLinha('Dados', dados.join('<br />')));

  const pecas = [];
  if (f.tem_frontend) pecas.push('tela (' + codigo('frontend/index.js') + ')');
  if (f.tem_backend) pecas.push('backend pela ponte (' + codigo('backend/extensao.py') + ')');
  if (f.tem_boot) pecas.push('roda sozinha, em segundo plano (' + codigo('extensao_boot.py') + ')');
  if (pecas.length) linhas.push(_xtFichaLinha('Peças', pecas.join('<br />')));

  // Fase 07 (D51): as ferramentas que ela atende — e a quem do programa as
  // empresta enquanto está ligada.
  const nomeDoSub = (id) => (typeof _ferrIdentidade === 'function' ? _ferrIdentidade(id).nome : id);
  const ferramentas = (f.acrescenta || []).filter((i) => i.recurso === 'ferramenta').map((i) => {
    const para = (i.subagentes_do_programa || []).map((id) => escapeHtml(nomeDoSub(id)));
    return comOnde(i.nome, i.devolve)
      + (para.length ? ` · também para: ${para.join(', ')}` : '');
  });
  if (ferramentas.length) linhas.push(_xtFichaLinha('Ferramentas', ferramentas.join('<br />')));

  // Fase 07 (D52): onde cada trecho de prompt entra, e de onde vem o texto.
  const trechos = (f.acrescenta || []).filter((i) => i.recurso === 'prompt').map((i) => {
    const onde = (cat.alvos_de_prompt || {})[i.alvo] || i.alvo;
    return escapeHtml(onde) + (i.arquivo ? ` (${codigo(i.arquivo)})` : ' (texto do backend)');
  });
  if (trechos.length) {
    linhas.push(_xtFichaLinha('Trechos de prompt',
      trechos.join('<br />') + '<br /><span class="config-nota">entram só com ela ligada</span>'));
  }

  // Sempre aparece: «nada» também é informação (o preview aprovado mostra).
  const fora = (f.escreve_fora || []).map((x) => codigo(x));
  linhas.push(fora.length
    ? _xtFichaLinha('Escreve fora da pasta', fora.join('<br />'), 'xt-ficha-guardia')
    : _xtFichaLinha('Escreve fora da pasta', 'nada'));
  // Fase 07 (D51): o par do de cima — o que ela LÊ fora da pasta de trabalho
  // do projeto. Em âmbar pelo mesmo motivo: o programa base só lê a pasta de
  // trabalho, e é aqui que se vê quem passa disso.
  const lida = (f.le_fora || []).map((x) => codigo(x));
  linhas.push(lida.length
    ? _xtFichaLinha('Lê fora da pasta de trabalho', lida.join('<br />'), 'xt-ficha-guardia')
    : _xtFichaLinha('Lê fora da pasta de trabalho', 'nada'));

  // Os avisos do manifesto também aqui — a lista do lado Programa já os mostra,
  // mas quem está NESTA página é quem está mexendo na extensão.
  const erros = (f.erros || []).map((x) => escapeHtml(String(x)));
  if (erros.length) linhas.push(_xtFichaLinha('Avisos do manifesto', erros.join('<br />'), 'xt-ficha-erro'));

  return `
    <div class="config-cartao">
      <div class="config-cartao-cabecalho">
        <div class="config-cartao-titulo">O que ela acrescenta ao programa</div>
        <p class="config-cartao-dica">
          Lido do <code>extensao.json</code> dela e escrito por extenso com o
          catálogo do programa: o que ela é, as peças que usa, os lugares em que
          entra, o que observa e o que responde.
        </p>
      </div>
      <div class="xt-ficha">${linhas.join('')}</div>
    </div>`;
}
