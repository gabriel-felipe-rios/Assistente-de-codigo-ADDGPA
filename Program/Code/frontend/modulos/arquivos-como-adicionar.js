// ═══════════════════ ABA ARQUIVOS — "Como adicionar" (aba informativa) ══
//
// A sub-aba da biblioteca que não tem lista: ela explica o formato de cada
// categoria e entrega o prompt que faz uma IA produzir o item já nesse formato.
// Dentro dela, uma sub-aba por categoria — Skills · Comandos · MCPs · Regras e
// instruções · Códigos prontos · Instruções base · Agentes · Estilos e cores ·
// Plugins · Extensões —, cada uma com a tabela dos tipos ou um botão.
//
// O TEXTO NÃO MORA AQUI. Ele mora em `Program/Code/prompts/Como adicionar/`,
// uma pasta por categoria (`categoria.json`, `Explicação.md`, os prompts em
// `.txt`, os guias em `Contrato/` e `Material de apoio/`), e chega inteiro por
// `listar_como_adicionar`. Este arquivo só desenha e copia.
//
// Ela NÃO entra no laço de `GARQ_KINDS` (arquivos-global.js): não tem item.
// `cadMontarPainel` tem chamador fora daqui (`initGlobalArquivosTab`, a cada
// clique na aba Arquivos) — o nome não muda.

// O que está na tela agora, como texto. Remontar a cada abertura com o mesmo
// texto perderia a rolagem de quem estava lendo; NÃO remontar nunca fazia a
// edição de um arquivo da pasta só aparecer ao reiniciar. Remonta quando mudou.
let _cadAssinatura = null;
// A categoria aberta (o nome da pasta) — sobrevive à remontagem.
let _cadAberta = null;
// Os tipos marcados em Extensões, por número. Numa variável do módulo, e não
// no DOM, para uma remontagem (o texto mudou no disco) não apagar o que o
// usuário marcou. Começam desmarcados.
const _cadMarcados = new Set();
// Dois cliques seguidos não montam duas vezes.
let _cadMontando = false;

async function cadMontarPainel() {
  const corpo = document.getElementById('garq-como-adicionar-corpo');
  if (!corpo || _cadMontando) return;
  _cadMontando = true;
  try {
    let r;
    try {
      r = await window.pywebview.api.listar_como_adicionar();
    } catch (e) {
      r = { success: false, error: String(e && e.message || e) };
    }

    // ⚠️ A comparação vem ANTES de limpar: igual ao que está na tela, não toca
    // em nada — é o que mantém a rolagem e as marcas de quem só voltou à aba.
    const assinatura = JSON.stringify(r);
    if (assinatura === _cadAssinatura) return;
    _cadAssinatura = assinatura;

    // Quem rola é o pai (`.garq-subtab-content`, overflow-y: auto), não o corpo.
    const rolador = corpo.parentElement || corpo;
    const rolagem = rolador.scrollTop;
    corpo.innerHTML = '';

    if (!r || !r.success) {
      corpo.appendChild(cadAviso(`Não foi possível ler o Como adicionar: ${(r && r.error) || 'sem resposta do programa'}.`));
    } else if (!(r.categorias || []).length) {
      corpo.appendChild(cadAviso('A pasta <code>Program/Code/prompts/Como adicionar/</code> não foi encontrada, ou não tem nenhuma categoria — é dela que esta sub-aba lê tudo.', true));
    } else {
      cadDesenhar(corpo, r.categorias);
    }
    rolador.scrollTop = rolagem;
  } finally {
    _cadMontando = false;
  }
}

// Também ao trocar de sub-aba DENTRO de Arquivos, e não só ao entrar na aba:
// a barra de sub-abas é ligada em `projetos.js`, e aqui só se escuta o clique
// no botão desta — delegado, porque o botão nasce do template.
document.addEventListener('click', (e) => {
  if (e.target && e.target.closest && e.target.closest('[data-garqsubtab="garq-como-adicionar"]')) {
    cadMontarPainel();
  }
});

function cadAviso(texto, html) {
  const p = document.createElement('p');
  p.className = 'cad-erro';
  if (html) p.innerHTML = texto; else p.textContent = texto;
  return p;
}

function cadMd(texto) {
  return typeof renderMarkdown === 'function' ? renderMarkdown(texto || '') : escapeHtml(texto || '');
}

// ── A barra e as vistas ─────────────────────────────────────────────────────
function cadDesenhar(corpo, categorias) {
  if (!categorias.some(c => c.pasta === _cadAberta)) _cadAberta = categorias[0].pasta;

  const barra = document.createElement('div');
  barra.className = 'cad-abas';
  const vistas = [];
  for (const c of categorias) {
    const aba = document.createElement('button');
    aba.type = 'button';
    aba.className = 'cad-aba' + (c.pasta === _cadAberta ? ' active' : '');
    aba.textContent = (c.categoria && c.categoria.nome) || c.pasta;
    aba.dataset.cadPasta = c.pasta;
    barra.appendChild(aba);

    const vista = cadVista(c);
    vista.dataset.cadPasta = c.pasta;
    if (c.pasta !== _cadAberta) vista.classList.add('hidden');
    vistas.push(vista);
  }
  barra.addEventListener('click', (e) => {
    const aba = e.target.closest('.cad-aba');
    if (!aba) return;
    _cadAberta = aba.dataset.cadPasta;
    barra.querySelectorAll('.cad-aba').forEach(b => b.classList.toggle('active', b === aba));
    vistas.forEach(v => v.classList.toggle('hidden', v.dataset.cadPasta !== _cadAberta));
  });

  corpo.appendChild(barra);
  vistas.forEach(v => corpo.appendChild(v));
}

function cadVista(c) {
  const vista = document.createElement('div');
  vista.className = 'cad-vista';
  const guia = document.createElement('div');
  guia.className = 'cad-guia';
  vista.appendChild(guia);

  const cat = c.categoria;
  if (!cat || c.erro) {
    guia.innerHTML = `<div class="cad-guia-cab"><span class="cad-guia-nome">${escapeHtml(c.pasta)}</span></div>`;
    guia.appendChild(cadAviso(`Esta categoria não pôde ser lida — ${c.erro || 'categoria.json vazio'}. Corrija o arquivo em prompts/Como adicionar/${c.pasta}/.`));
    return vista;
  }

  guia.innerHTML = `
    <div class="cad-guia-cab">
      <span class="cad-guia-ic">${escapeHtml(cat.icone || '')}</span>
      <span class="cad-guia-nome">${escapeHtml(cat.nome || c.pasta)}</span>
      ${cat.destino ? `<code class="cad-secao-caminho">${escapeHtml(cat.destino)}</code>` : ''}
    </div>
    <div class="cad-guia-oque">${cadMd((c.explicacao || '').trim())}</div>`;

  if (cat.tabela) guia.appendChild(cadTabela(c));
  if (cat.montar) guia.appendChild(cadMontar(c));
  if (cat.botao) {
    const fileira = document.createElement('div');
    fileira.className = 'cad-guia-botoes';
    const botao = cadBotao('btn btn-utility btn-sm', cat.botao.rotulo || '📋 Copiar prompt');
    botao.addEventListener('click', () => cadCopiarPrompt(c, cat.botao.prompt, cat.botao.contrato || cat.contrato, cat.nome || c.pasta));
    fileira.appendChild(botao);
    guia.appendChild(fileira);
  }
  if (cat.nota) {
    const nota = document.createElement('p');
    nota.className = 'config-nota';
    nota.innerHTML = cadMd(cat.nota);
    guia.appendChild(nota);
  }
  if (cat.apoio) guia.appendChild(cadApoio(c));
  return vista;
}

function cadBotao(classe, rotulo) {
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = classe;
  botao.textContent = rotulo;
  return botao;
}

// ── A tabela dos tipos ──────────────────────────────────────────────────────
// Com `marcar` (Extensões), a primeira coluna é a caixa de marcar e não há
// botão por linha: o botão é um só, na faixa `.cad-montar` abaixo.
function cadTabela(c) {
  const cat = c.categoria;
  const tab = cat.tabela;
  const marcar = !!tab.marcar;
  const colunas = tab.colunas || [];
  const tabela = document.createElement('table');
  tabela.className = 'ext-tabela cad-tipos';
  tabela.innerHTML = `
    <thead><tr>
      ${marcar ? '<th class="cad-col-marca"></th>' : ''}
      ${colunas.map((col, i) => `<th${i === 0 ? ` style="width:${marcar ? 30 : 32}%"` : ''}>${escapeHtml(col)}</th>`).join('')}
      ${marcar ? '' : '<th class="cad-col-btn"></th>'}
    </tr></thead><tbody></tbody>`;
  const corpo = tabela.querySelector('tbody');

  for (const linha of tab.linhas || []) {
    const tr = document.createElement('tr');
    const pasta = linha.pasta ? ` <span class="cad-tipo-pasta">${escapeHtml(linha.pasta)}</span>` : '';
    const numero = linha.numero ? ` <span class="cad-tipo-pasta">tipo ${escapeHtml(String(linha.numero))}</span>` : '';
    const usa = linha.usa ? `<br><span class="cad-usa">Usa: ${escapeHtml(linha.usa)}</span>` : '';
    tr.innerHTML = `
      ${marcar ? '<td class="cad-col-marca"><input type="checkbox"></td>' : ''}
      <td><b>${escapeHtml(linha.nome || '')}</b>${pasta}${numero}</td>
      <td>${cadMd(linha.texto)}${usa}</td>`;

    if (marcar) {
      const caixa = tr.querySelector('input');
      caixa.checked = _cadMarcados.has(linha.numero);
      caixa.setAttribute('aria-label', `Tipo ${linha.numero} · ${linha.nome || ''}`);
      caixa.addEventListener('change', () => {
        if (caixa.checked) _cadMarcados.add(linha.numero); else _cadMarcados.delete(linha.numero);
        const faixa = tabela.parentElement && tabela.parentElement.querySelector('.cad-montar');
        if (faixa) cadAtualizarMontar(faixa, c);
      });
    } else {
      const td = document.createElement('td');
      td.className = 'cad-col-btn';
      const botao = cadBotao('btn btn-utility btn-xs', '📋 Copiar prompt');
      botao.addEventListener('click', () => cadCopiarPrompt(c, linha.prompt, linha.contrato || cat.contrato, linha.nome));
      td.appendChild(botao);
      tr.appendChild(td);
    }
    corpo.appendChild(tr);
  }
  return tabela;
}

// ── Extensões: a faixa com o botão único ────────────────────────────────────
function cadMontar(c) {
  const faixa = document.createElement('div');
  faixa.className = 'cad-montar';
  faixa.innerHTML = `<span class="cad-montar-txt">${cadMd(c.categoria.montar.texto)}</span>`;
  const botao = cadBotao('btn btn-utility btn-sm', '');
  botao.addEventListener('click', () => cadCopiarExtensao(c));
  faixa.appendChild(botao);
  cadAtualizarMontar(faixa, c);
  return faixa;
}

function cadMarcadosEmOrdem(c) {
  return (c.categoria.tabela.linhas || []).filter(l => _cadMarcados.has(l.numero));
}

function cadRotuloTipos(n) {
  return `${n} ${n === 1 ? 'tipo' : 'tipos'}`;
}

function cadAtualizarMontar(faixa, c) {
  const botao = faixa.querySelector('button');
  const n = cadMarcadosEmOrdem(c).length;
  botao.textContent = `📋 Copiar prompt · ${cadRotuloTipos(n)}`;
  // Apagado sem nada marcado: um prompt de extensão sem tipo nenhum não diz
  // à IA o que ela pode fazer.
  botao.disabled = n === 0;
}

function cadCopiarExtensao(c) {
  const cat = c.categoria;
  const marcados = cadMarcadosEmOrdem(c);
  if (!marcados.length) return;
  const partes = [c.textos[cat.montar.comeco]];
  for (const l of marcados) partes.push(c.textos[l.regras]);
  partes.push(c.textos[cat.montar.fim]);
  if (partes.some(p => typeof p !== 'string')) {
    showToast('Faltam arquivos do prompt de extensão em prompts/Como adicionar/Extensões/.', true);
    return;
  }
  const texto = cadComContrato(c, partes.map(p => p.trim()).join('\n\n'), cat.contrato);
  copiarContexto(texto, `Prompt de extensão (${cadRotuloTipos(marcados.length)}) copiado — cole numa IA.`);
}

// ── Material de apoio ───────────────────────────────────────────────────────
// Linha com `arquivo` ganha «📋 Copiar» (copia o guia inteiro); sem `arquivo`
// é só explicação — é o caso de "Os recursos que uma extensão pode usar".
function cadApoio(c) {
  const apoio = c.categoria.apoio;
  const bloco = document.createElement('div');
  bloco.className = 'cad-apoio';
  bloco.innerHTML = `<div class="cad-apoio-tit">${escapeHtml(apoio.titulo || '')}</div>`;
  const tabela = document.createElement('table');
  tabela.className = 'ext-tabela cad-tipos';
  const corpo = document.createElement('tbody');
  tabela.appendChild(corpo);
  for (const linha of apoio.linhas || []) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td style="width:32%"><b>${escapeHtml(linha.nome || '')}</b></td><td>${cadMd(linha.texto)}</td>`;
    if (linha.arquivo) {
      const td = document.createElement('td');
      td.className = 'cad-col-btn';
      const botao = cadBotao('btn btn-muted btn-xs', '📋 Copiar');
      botao.addEventListener('click', () => {
        const texto = c.textos[linha.arquivo];
        if (typeof texto !== 'string') { showToast(`Arquivo não encontrado: ${linha.arquivo}`, true); return; }
        copiarContexto(texto, `${linha.nome} copiado.`);
      });
      td.appendChild(botao);
      tr.appendChild(td);
    }
    corpo.appendChild(tr);
  }
  bloco.appendChild(tabela);
  return bloco;
}

// ── Copiar ──────────────────────────────────────────────────────────────────
// ⚠️ Tudo já está em memória: o texto veio inteiro na abertura. Buscar no
// backend DEPOIS do clique arriscaria perder o gesto do usuário, e a área de
// transferência do WebView2 falha calada sem ele. `copiarContexto` responde
// por notificação — é o que o botão COM RÓTULO faz (Padrões de interface ›
// Botões › Botão de copiar).
function cadCopiarPrompt(c, arquivo, contrato, nome) {
  const texto = c.textos[arquivo];
  if (typeof texto !== 'string') {
    showToast(`Prompt não encontrado: ${arquivo || '(sem arquivo)'}.`, true);
    return;
  }
  copiarContexto(cadComContrato(c, texto.trim(), contrato), `Prompt de ${nome} copiado — cole numa IA.`);
}

// O pedido + as regras (o arquivo de prompt) + o contrato (o guia longo).
function cadComContrato(c, texto, contrato) {
  if (!contrato) return texto;
  const guia = c.textos[contrato];
  if (typeof guia !== 'string') return texto;
  const nome = contrato.split('/').pop();
  return `${texto}\n\n──────── O CONTRATO — ${nome} ────────\n`
    + 'As regras completas estão abaixo. Elas não são conselho: quebrá-las deixa o\n'
    + 'programa estranho de um jeito difícil de diagnosticar.\n\n'
    + guia;
}
