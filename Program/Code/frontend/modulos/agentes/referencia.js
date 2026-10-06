// ══════════════════════ SUB-ABA: Automação › Explicações (informativa) ══
// Monta as duas tabelas da sub-aba (id interno `asubtab-referencia`, mantido
// pela ordem salva das abas): "O que cada rotina faz", a partir de
// `explicacoes-dados.js`, e "que modificação manda atualizar o quê", a partir
// do backend. O markup mora em `referencia-template.js`.
//
// ⚠️ MONTADA NO DOM, e não por innerHTML: os nomes de classe e de rotina vêm do
// backend, e concatenar HTML com dado de fora é como se escreve o próximo bug
// de escape. Mesma escolha de `_detectorTabela` em `automacao/detector.js`.

// Como cada resposta aparece na célula. A cor é a informação — e a legenda logo
// acima da tabela é o que a torna legível (selo sem legenda é decoração).
const REF_MARCAS = {
  roda:   { texto: '✓',     classe: 'ref-sim' },
  nao:    { texto: '✗',     classe: 'ref-nao' },
  regua:  { texto: '%',     classe: 'ref-regua-marca' },
  copia:  { texto: 'cópia', classe: 'ref-copia' },
};

async function initReferenciaTab() {
  let r;
  try {
    r = await window.pywebview.api.get_tabela_do_detector();
  } catch (e) {
    return;   // projeto pode ainda não estar carregado
  }
  if (!r || !r.success) return;

  _expTabelaRotinas(r);
  _refLegenda(r.limiares);
  _refCabecalho(r.caras);
  _refCorpo(r);
}

// ── O que cada rotina faz ──────────────────────────────────────────────────
// Uma linha de grupo e, embaixo, as rotinas dele, na ordem de
// `EXPLICACOES_ROTINAS`.
//
// ⚠️ SÓ AS QUE O BACKEND CONHECE (`sempre` + `caras`, mais a Espera e o
// Revezamento, que não são rotinas do ciclo mas são caixas do desenho). Uma
// rotina retirada do programa e esquecida em `explicacoes-dados.js` não pode
// continuar aparecendo aqui como se existisse.
function _expTabelaRotinas(r) {
  const corpo = document.getElementById('exp-tabela-corpo');
  if (!corpo || typeof EXPLICACOES_ROTINAS === 'undefined') return;
  corpo.innerHTML = '';
  const conhecidas = new Set([...(r.sempre || []), ...(r.caras || []), 'espera', 'revezamento']);
  EXPLICACOES_GRUPOS.forEach(g => {
    const ids = Object.keys(EXPLICACOES_ROTINAS)
      .filter(id => EXPLICACOES_ROTINAS[id].grupo === g.id && conhecidas.has(id));
    if (!ids.length) return;
    const trg = document.createElement('tr');
    trg.className = 'exp-grupo';
    const tdg = document.createElement('td');
    tdg.colSpan = 5;
    tdg.textContent = g.titulo;
    trg.appendChild(tdg);
    corpo.appendChild(trg);
    ids.forEach(id => {
      const e = EXPLICACOES_ROTINAS[id];
      const tr = document.createElement('tr');
      const celula = texto => {
        const td = document.createElement('td');
        td.textContent = texto;
        tr.appendChild(td);
        return td;
      };
      celula(`${e.icone} ${e.nome}`).className = 'exp-col-rotina';
      celula(e.oQueFaz);
      // «Como roda»: o tipo como etiqueta pequena, a nota ao lado.
      const como = celula('');
      (e.comoRoda || []).forEach((c, i) => {
        if (i) como.appendChild(document.createElement('br'));
        const tipo = document.createElement('span');
        tipo.className = `exp-tipo exp-tipo-${c.tipo}`;
        tipo.textContent = EXPLICACOES_TIPOS[c.tipo] || c.tipo;
        como.appendChild(tipo);
        if (c.nota) {
          const nota = document.createElement('span');
          nota.className = 'exp-nota';
          nota.textContent = c.nota;
          como.appendChild(nota);
        }
      });
      celula(e.le);
      celula(e.quandoRefaz);
      corpo.appendChild(tr);
    });
  });
}

// ── Que modificação manda atualizar o quê ─────────────────────────────────

// O `%` diz o limiar configurado. Os dois limiares (Documentação Técnica e
// Resumo de Pastas) costumam ser iguais; quando não são, a legenda diz os dois.
function _refLegenda(limiares) {
  const el = document.getElementById('ref-legenda');
  if (!el) return;
  el.innerHTML = '';
  const l = limiares || {};
  const doc = l['doc-tecnica'], pas = l['resumo-pastas'];
  let limiar = '';
  if (doc != null && pas != null && doc !== pas) {
    limiar = ` (Documentação Técnica ${doc}%, Resumo de Pastas ${pas}%)`;
  } else if (doc != null || pas != null) {
    limiar = ` (${doc != null ? doc : pas}%)`;
  }
  const itens = [
    ['ref-sim', '✓', 'roda'],
    ['ref-nao', '✗', 'não roda'],
    ['ref-regua-marca', '%', 'só se passar do limiar de similaridade' + limiar],
    ['ref-copia', 'cópia', 'copia a saída do arquivo gêmeo, sem IA.'],
  ];
  itens.forEach(([cls, marca, texto]) => {
    const span = document.createElement('span');
    span.className = 'ref-legenda-item';
    const m = document.createElement('strong');
    m.className = cls;
    m.textContent = marca;
    span.appendChild(m);
    span.appendChild(document.createTextNode(' ' + texto));
    el.appendChild(span);
  });
}

function _refCabecalho(caras) {
  const cab = document.getElementById('ref-tabela-cab');
  if (!cab) return;
  cab.innerHTML = '';
  const tr = document.createElement('tr');
  ['O que aconteceu', 'Régua'].forEach(t => {
    const th = document.createElement('th');
    th.textContent = t;
    tr.appendChild(th);
  });
  (caras || []).forEach(id => {
    const th = document.createElement('th');
    th.className = 'ref-col-rotina';
    th.textContent = (typeof AC_NOMES_AGENTES !== 'undefined' && AC_NOMES_AGENTES[id]) || id;
    tr.appendChild(th);
  });
  cab.appendChild(tr);
}

function _refCorpo(r) {
  const corpo = document.getElementById('ref-tabela-corpo');
  if (!corpo) return;
  corpo.innerHTML = '';
  (r.classes || []).forEach(linha => {
    const tr = document.createElement('tr');

    const nome = document.createElement('td');
    nome.className = 'ref-col-classe';
    nome.textContent = (typeof DET_NOMES_CLASSES !== 'undefined'
                        && DET_NOMES_CLASSES[linha.classe]) || linha.classe;
    tr.appendChild(nome);

    const regua = document.createElement('td');
    regua.className = 'ref-col-regua';
    regua.textContent = linha.regua;
    tr.appendChild(regua);

    const acorda = linha.acorda || [];
    (r.caras || []).forEach(id => {
      const td = document.createElement('td');
      td.className = 'ref-marca';
      // ⚠️ Três respostas, não duas. O gêmeo ENTRA nas duas rotinas de
      // documentação, mas copiando a saída do irmão em vez de gerar — mostrar
      // um ✓ ali faria a tabela parecer contradizer a economia que ela existe
      // para provar. E o `%` não é "roda" nem "não roda": é "depende de quanto
      // mudou", que é a segunda régua.
      let marca;
      if (!acorda.includes(id)) {
        marca = REF_MARCAS.nao;
      } else if (linha.classe === 'gemeo') {
        marca = REF_MARCAS.copia;
      } else if (linha.regua === 'o quanto' || id === 'resumo-pastas') {
        marca = REF_MARCAS.regua;
      } else {
        marca = REF_MARCAS.roda;
      }
      td.textContent = marca.texto;
      td.classList.add(marca.classe);
      tr.appendChild(td);
    });
    corpo.appendChild(tr);
  });
}
