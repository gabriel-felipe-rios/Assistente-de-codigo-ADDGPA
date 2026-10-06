// ═══ BACKUPS → Mapa da mudança → Árvore ════════════════════════════════════
//
// Pasta por pasta, nas duas metades. Clicar num arquivo abre o trecho do diff
// mais o botão "↩ Voltar só este arquivo".
//
// ⚠️ ESTA ÁRVORE É A **DO PROJETO**, não uma sexta. `criarArvorePastas`
// (`arvore-pastas.js`) já é a árvore de Documentação, Mapa de I/O,
// Tree-sitter, Relações, Decisões e Resumo indexado — e traz de graça o que
// faltava aqui: os ícones por extensão (`pintarIcone`, de `icones.js`), o
// estado de aberto que sobrevive ao redesenho, e ⊞ expandir tudo / ⊟ retrair
// tudo por `ligarBotoesArvore`. O desenho próprio que estava aqui destoava do
// resto do programa justamente por ser próprio.
//
// ⚠️ A COR DA SITUAÇÃO ENTRA POR FORA. O componente compartilhado não sabe de
// criado/alterado/removido, e não deve saber — isso é assunto de Backups. Como
// cada linha carrega `data-caminho`, a decoração é uma passada no DOM depois do
// desenho. Assim o componente não ganha nenhum parâmetro novo, e as outras seis
// telas não correm risco nenhum.
//
// ⚠️ A Árvore é a ÚNICA que não muda com a regra do eixo, e o motivo é que ela
// não tem dois lados: ela já É o diff. Pôr um "antes" e um "agora" aqui seria
// desenhar duas vezes a mesma árvore para o olho procurar a diferença que o
// programa já sabe qual é. Pela mesma razão ela lista **só o que mudou** — não
// a estrutura do projeto.

// Uma instância por metade, viva entre desenhos: é ela que os botões ⊞/⊟
// comandam, e é ela que guarda o que está aberto.
const bmArvores = {};

async function bmDesenharArvore(area) {
  const r = await window.pywebview.api.mapa_arvore(
    currentProject, bmDe, bmAte, bmMetadeEfetiva());
  if (!r.success) throw new Error(r.error);

  const metades = bmMetadesAMostrar(r.metades);
  const total = { arquivos: 0, pastas: 0, mais: 0, menos: 0 };
  metades.forEach(m => {
    const s = r.metades[m].resumo;
    total.arquivos += s.arquivos; total.pastas += s.pastas;
    total.mais += s.mais; total.menos += s.menos;
  });
  bmEstatistica(bmResumoEmTexto(total));

  area.innerHTML = `
    <div class="bm-arvores">
      ${metades.map(m => `
        <div class="bm-arvore-col">
          <div class="bm-arvore-barra">
            <span class="bm-lado-h">${bmNomeDaMetade(m)}</span>
            <span class="bm-lado-marca">${bmResumoEmTexto(r.metades[m].resumo)}</span>
            <span class="bm-arvore-botoes">
              <button class="btn-icon" id="bm-arv-${m}-expandir" title="Expandir tudo">⊞</button>
              <button class="btn-icon" id="bm-arv-${m}-retrair" title="Retrair tudo">⊟</button>
            </span>
          </div>
          <div class="bm-arvore" id="bm-arvore-${m}"></div>
        </div>`).join('')}
    </div>`;

  bmAvisos(area, metades.map(m => r.metades[m].resumo));
  bmRedesenharNoResize = null;

  metades.forEach(m => bmMontarArvore(m, bmAchatar(r.metades[m].raiz)));
}

// O back-end manda a árvore montada; o componente compartilhado quer uma lista
// plana de caminhos. Achatar aqui é mais barato do que um formato novo no
// back-end — e mantém `mapa_arvore` servindo aos dois desenhos.
function bmAchatar(no, prefixo = '') {
  const itens = [];
  (no.arquivos || []).forEach(a => {
    if (a.situacao === 'igual') return;   // a Árvore é o diff
    itens.push({ ...a, caminho: a.caminho || (prefixo ? prefixo + '/' + a.nome : a.nome) });
  });
  (no.pastas || []).forEach(p => {
    const caminho = prefixo ? prefixo + '/' + p.nome : p.nome;
    itens.push(...bmAchatar(p, caminho));
  });
  return itens;
}

function bmMontarArvore(metade, itens) {
  const container = document.getElementById(`bm-arvore-${metade}`);
  if (!container) return;
  const porCaminho = new Map(itens.map(i => [i.caminho, i]));

  const arvore = criarArvorePastas({
    container,
    caminhos: itens.map(i => i.caminho),
    // Nasce RETRAÍDA: com tudo aberto de uma vez a tela abre numa parede, e
    // era essa a queixa. Quem quer tudo aberto tem o ⊞ ao lado do título.
    expandido: false,
    contarArquivos: true,
    seloArquivo: (caminho) => {
      const i = porCaminho.get(caminho);
      if (!i) return '';
      // Movido/renomeado não tem `+0 −0` para mostrar — o conteúdo é idêntico.
      // O que mudou é o CAMINHO, e é ele que o selo diz.
      if (i.par) return `${bmSetaDoPar(i)} ${i.par}`;
      if (i.binario) return 'binário';
      return `+${i.mais} −${i.menos}`;
    },
    aoSelecionar: (caminho) => bmAbrirTrecho(container, caminho, metade),
    vazio: 'Nada mudou nesta metade entre as duas Versões.',
  });

  // O envelope existe por um motivo só: `redesenhar`, `expandirTudo` e
  // `retrairTudo` refazem o DOM, e com ele some a decoração de cor. Reaplicar
  // depois de cada um é o que mantém as duas coisas em pé sem tocar no
  // componente compartilhado.
  const decorado = {
    expandirTudo: () => { arvore.expandirTudo(); bmPintarSituacoes(container, porCaminho); },
    retrairTudo: () => { arvore.retrairTudo(); bmPintarSituacoes(container, porCaminho); },
  };
  bmArvores[metade] = decorado;
  bmPintarSituacoes(container, porCaminho);

  ligarBotoesArvore(() => bmArvores[metade], {
    expandir: `bm-arv-${metade}-expandir`,
    retrair: `bm-arv-${metade}-retrair`,
  });
}

// A decoração: cor da situação na borda de cada linha de arquivo, e a classe
// do selo. Uma passada só, sobre `data-caminho`.
function bmPintarSituacoes(container, porCaminho) {
  container.querySelectorAll('.arvp-linha-arquivo').forEach(linha => {
    const i = porCaminho.get(linha.dataset.caminho);
    if (!i) return;
    linha.classList.add('bm-arv-linha', bmClasseDaSituacao(i.situacao));
    linha.title = `${linha.dataset.caminho}\n${i.situacao}${
      i.par ? ` ${bmSetaDoPar(i)} ${i.par}` : ''}`;
    const selo = linha.querySelector('.arvp-selo');
    if (selo) selo.classList.toggle('bm-selo-binario', !!i.binario);
  });
}

// ── O trecho, e o "voltar só este arquivo" ──────────────────────────────────

async function bmAbrirTrecho(container, caminho, metade) {
  const linha = container.querySelector(`.arvp-linha-arquivo[data-caminho="${CSS.escape(caminho)}"]`);
  if (!linha) return;
  const jaAberto = linha.nextElementSibling &&
                   linha.nextElementSibling.classList.contains('bm-trecho');
  if (jaAberto) { linha.nextElementSibling.remove(); return; }
  // Um trecho por vez: dois diffs abertos numa árvore estreita viram rolagem
  // sem fim, e o segundo empurra o primeiro para fora da tela.
  container.querySelectorAll('.bm-trecho').forEach(el => el.remove());

  const caixa = document.createElement('div');
  caixa.className = 'bm-trecho';
  caixa.innerHTML = '<div class="bk-carregando">Lendo…</div>';
  linha.after(caixa);

  try {
    const r = await window.pywebview.api.diff_do_arquivo(
      currentProject, bmDe, bmAte, caminho, metade);
    if (!r.success) throw new Error(r.error);
    // ⚠️ NÃO RECRIAR O BOTÃO "↩ Voltar só este arquivo". Ele existiu aqui e foi
    // RETIRADO por decisão do usuário: sobrescrever um arquivo do disco a um
    // clique, dentro de uma tela cuja função é *olhar*, é perigoso demais para
    // o pouco que economiza. A reversão mora na sub-aba Versões, que pede
    // confirmação e mostra o que vai mexer.
    const barra = `
      <div class="bm-trecho-barra">
        <span class="mapa-caminho">${escapeHtml(caminho)}</span>
      </div>`;
    // ⚠️ A MARCAÇÃO DO DIFF É UMA SÓ, e mora em `backups-mapa-diff-modal.js`.
    // Ela nasceu aqui dentro; quando o Treemap e o Sunburst ganharam o modal
    // seriam duas cópias da mesma coisa, e a primeira classe nova entraria só
    // numa delas. É ela também que sabe dizer por escrito o caso do binário e
    // o do arquivo que só mudou de lugar.
    caixa.innerHTML = barra + bmMarcacaoDoDiff(r);
  } catch (e) {
    caixa.innerHTML = `<div class="bk-warn">${escapeHtml(String(e))}</div>`;
  }
}
