// ══════════════════════════════════ Mapa em níveis · a árvore e as ligações
// Programa → áreas → blocos → cadeias → arquivos (e as funções dentro de cada arquivo).
// Tudo aqui é conta sobre o que o backend mandou: nada desenha, nada guarda
// estado. O estado da tela mora em `_mn` (mapa-niveis.js).

const MN_PALETA_AREA = ['#3498db', '#9b59b6', '#1abc9c', '#e67e22', '#2ecc71', '#e84393', '#f1c40f', '#7aa2f7', '#95a5a6'];
const MN_COR_EXT = { py: '#2563eb', js: '#ca8a04', css: '#7c3aed', html: '#ea580c', json: '#16a34a', md: '#64748b' };
const MN_LARGURA = { area: 280, bloco: 270, cadeia: 260, arquivo: 220, arquivoAberto: 300 };
// A área de mentira que abriga o bloco «Sem ponto de entrada» (B0): cinza,
// para não parecer mais uma área do programa. Hex, e não token, porque o
// minimapa pinta em canvas, que não resolve var().
const MN_COR_SEM_ENTRADA = '#7f8c8d';
const MN_PAD = 16, MN_ROT_FASE = 18, MN_FN_H = 18, MN_FN_MAX = 12;

// Os níveis são os TIPOS da árvore, do macro ao micro. Quantos cartões cada
// um tem vem do `_niveis.json` que a rotina Pipeline gravou.
const MN_NIVEIS = [
  { nome: 'Áreas',    sub: 'o programa em poucas partes' },
  { nome: 'Blocos',   sub: 'os grupos de arquivos onde as cadeias começam' },
  { nome: 'Cadeias',  sub: 'cada fluxo que um gatilho dispara' },
  { nome: 'Arquivos', sub: 'os arquivos, com as chamadas reais' },
  { nome: 'Funções',  sub: 'o que cada arquivo atende e chama' },
];
const MN_TIPO_NOME = { area: 'Área', bloco: 'Bloco', cadeia: 'Cadeia', arquivo: 'Arquivo' };

const mnBase = c => c.split('/').pop();
const mnExt = c => (mnBase(c).split('.').pop() || '').toLowerCase();
const mnPastaCurta = c => { const p = c.replace(/^Program\/Code\//, '').split('/'); p.pop(); return p.join('/') || '·'; };
const mnLado = c => ({ py: 'backend', js: 'tela', css: 'tela', html: 'tela' })[mnExt(c)] || 'outro';
const mnClamp = (v, a, b) => Math.max(a, Math.min(b, v));

function mnMontarArvore(D) {
  const raiz = { id: 'P', tipo: 'programa', nome: D.projeto, prof: 0, filhos: [], pai: null, x: 0, y: 0, w: 0, h: 0 };
  const porId = new Map([['P', raiz]]);
  const setas = [];

  const blocoPorId = new Map(D.blocos.map(b => [b.id, b]));
  const cadeiaPorId = new Map(D.cadeias.map(c => [c.id, c]));

  D.areas.forEach((a, i) => {
    // blocos e cadeias herdam a cor da área; a área A0 («Sem ponto de entrada») é cinza
    const cor = a.sem_entrada ? MN_COR_SEM_ENTRADA : MN_PALETA_AREA[i % MN_PALETA_AREA.length];
    const na = { id: a.id, tipo: 'area', nome: a.nome, descricao: a.descricao, cor, prof: 1, filhos: [], pai: raiz, semEntrada: !!a.sem_entrada };
    raiz.filhos.push(na); porId.set(na.id, na);
    a.blocos.forEach(bid => {
      const b = blocoPorId.get(bid); if (!b) return;
      const nb = { id: b.id, tipo: 'bloco', nome: b.nome, descricao: b.descricao, cor, prof: 2, filhos: [], pai: na, dados: b, semEntrada: !!b.sem_entrada };
      na.filhos.push(nb); porId.set(nb.id, nb);
      b.cadeias.forEach(cid => {
        const c = cadeiaPorId.get(cid); if (!c) return;
        const nc = { id: c.id, tipo: 'cadeia', nome: c.nome, descricao: c.resumo, cor, prof: 3, filhos: [], pai: nb, dados: c };
        nb.filhos.push(nc); porId.set(nc.id, nc);
        const mapa = {};
        c.arquivos.forEach(f => {
          const nf = { id: c.id + '|' + f.arquivo, tipo: 'arquivo', nome: mnBase(f.arquivo), descricao: f.descricao, cor: MN_COR_EXT[mnExt(f.arquivo)] || '#64748b', prof: 4, filhos: [], pai: nc, dados: f, fase: f.fase };
          nc.filhos.push(nf); porId.set(nf.id, nf); mapa[f.arquivo] = nf;
        });
        const pares = {};
        c.passos.forEach(p => {
          if (p.de === p.para) return;
          const k = p.de + '→' + p.para;
          if (!pares[k]) { pares[k] = { tipo: 'chamada', de: mapa[p.de], para: mapa[p.para], passos: [], ponte: mnLado(p.de) !== mnLado(p.para) }; setas.push(pares[k]); }
          pares[k].passos.push(p);
        });
      });
    });
  });

  const areas = raiz.filhos, blocos = areas.flatMap(a => a.filhos), cadeias = blocos.flatMap(b => b.filhos), arquivos = cadeias.flatMap(c => c.filhos);
  const somar = (lista, f) => lista.reduce((s, x) => s + f(x), 0);
  blocos.forEach(b => {
    b.nCad = b.filhos.length;
    b.nArq = somar(b.filhos, c => c.filhos.length);
    b.nPassos = somar(b.filhos, c => c.dados.passos.length);
  });
  areas.forEach(a => {
    a.nBlocos = a.filhos.length;
    a.nCad = somar(a.filhos, b => b.nCad);
    a.nArq = somar(a.filhos, b => b.nArq);
    a.nPassos = somar(a.filhos, b => b.nPassos);
  });

  // Cadeias que dividem hubs ESPECÍFICOS: hub usado por ¼ ou mais das cadeias
  // ligaria todo mundo com todo mundo e não diria nada.
  const hubsDe = new Map(cadeias.map(c => [c, new Set(c.dados.passos.flatMap(p => p.selos || []))]));
  const usoHub = {};
  hubsDe.forEach(s => s.forEach(h => usoHub[h] = (usoHub[h] || 0) + 1));
  for (let i = 0; i < cadeias.length; i++) for (let j = i + 1; j < cadeias.length; j++) {
    const a = cadeias[i], b = cadeias[j];
    const comuns = [...hubsDe.get(a)].filter(h => usoHub[h] < cadeias.length * 0.25 && hubsDe.get(b).has(h));
    if (comuns.length) setas.push({ tipo: 'hub', de: a, para: b, comuns, mesmoBloco: a.pai === b.pai });
  }

  // As duas ligações que levam FRASE, escritas pela rotina Pipeline: entre
  // áreas e entre blocos. Sem frase gravada, o rótulo diz quantas chamadas.
  const ligar = (lista, tipo) => lista.forEach(f => {
    const de = porId.get(f.de), para = porId.get(f.para);
    if (de && para) setas.push({ tipo, de, para, rotulo: f.frase || `${f.chamadas} chamada${f.chamadas === 1 ? '' : 's'}`, chamadas: f.chamadas });
  });
  ligar(D.ligacoes_areas, 'area');
  ligar(D.ligacoes_blocos, 'bloco');
  const comFrase = setas.filter(s => s.tipo === 'area' || s.tipo === 'bloco');
  const chaves = new Set(comFrase.map(s => s.tipo + ':' + s.de.id + '>' + s.para.id));
  comFrase.forEach(s => s.reverso = chaves.has(s.tipo + ':' + s.para.id + '>' + s.de.id));

  return { raiz, porId, setas, areas, blocos, cadeias, arquivos };
}

function mnDentroDe(n, anc) { for (let p = n; p; p = p.pai) if (p === anc) return true; return false; }
