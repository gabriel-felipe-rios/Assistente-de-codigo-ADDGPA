// ═══════════════════════ Linha do tempo — o CSS da tela ══
// Módulo irmão de index.js. Registra em `window.__ltempo.estilo`.
//
// ⚠️ Nenhuma cor, raio ou espaçamento hardcoded: tudo sai dos tokens de
// `Program/Code/frontend/estilos/tema/` (o usuário troca de tema, e um hex
// escrito aqui não trocaria junto).
// ⚠️ Nada de crase aqui dentro: o CSS inteiro é um template literal.

(function () {
  window.__ltempo = window.__ltempo || {};

  const CSS = `
    /* ⚠️ O container do plugin no programa é '.agentes-subtab-content', que já é
       um flex em coluna com 'overflow: hidden' (estilos/agentes-base-config.css).
       Isso quer dizer que a rolagem é RESPONSABILIDADE DO PLUGIN: sem o
       'flex:1 + min-height:0' aqui e o 'overflow:auto' no palco, o conteúdo que
       passa da altura da tela simplesmente não rola — foi o que aconteceu no
       modo Feed, com 30 cartões. Os dois zeros também impedem uma trilha larga
       de esticar a caixa e empurrar o resto da tela para fora. */
    .ltempo-raiz {
      flex: 1; min-height: 0; min-width: 0;
      overflow-x: hidden; overflow-y: hidden;
      padding: 20px 24px; display: flex; flex-direction: column; gap: 14px;
    }
    /* Só o palco rola: a barra de controles fica parada no topo, senão trocar de
       modo ou de janela exigiria rolar de volta para cima.
       Os eixos vêm separados de propósito, nunca pela abreviação 'overflow:' —
       além de ser mais preciso, a forma curta não é expandida por toda
       ferramenta que lê estilo computado, e um teste de rolagem passaria a
       mentir. */
    .ltempo-palco {
      flex: 1; min-height: 0; min-width: 0;
      overflow-x: auto; overflow-y: auto; padding-bottom: 4px;
    }
    .ltempo-msg { color: var(--text-muted); font-size: 13px; }
    .ltempo-fraco { color: var(--text-muted); opacity: .75; font-size: 11px; }
    .ltempo-ganhas { color: var(--green); }
    .ltempo-perdidas { color: var(--red); }
    .ltempo-mono {
      font-family: 'Cascadia Code','Consolas',monospace; font-size: 11.5px; word-break: break-all;
    }

    /* ── Barra de controles ── */
    .ltempo-topo { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .ltempo-titulo { font-size: 15px; font-weight: 600; color: var(--text); margin: 0; }
    .ltempo-selo { font-size: 11.5px; color: var(--text-muted); }
    .ltempo-ctrl { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .ltempo-combo { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--text-muted); }
    .ltempo-combo select, .ltempo-busca {
      background: var(--surface-dark); border: 1px solid rgba(var(--white-rgb),.1);
      border-radius: var(--radius); color: var(--text); padding: 6px 10px; font-size: 13px;
      font-family: inherit;
    }
    .ltempo-busca { min-width: 190px; }

    /* Toggle segmentado — mesmo desenho de .mapa-toggle (Padrões de interface ›
       Componentes › Toggle segmentado): são MODOS da mesma tela, não navegação. */
    .ltempo-pill { display: flex; gap: 2px; }
    .ltempo-pill button {
      background: transparent; border: 1px solid rgba(var(--white-rgb),.08); color: var(--text-muted);
      font-family: inherit; font-size: 11.5px; font-weight: 500; padding: 4px 12px;
      border-radius: 20px; cursor: pointer;
    }
    .ltempo-pill button:hover { color: var(--text); }
    .ltempo-pill button.ativo {
      color: var(--teal); border-color: rgba(var(--teal-rgb),.4); background: rgba(var(--teal-rgb),.1);
    }
    .ltempo-opcoes {
      background: var(--surface-dark); border: 1px solid rgba(var(--white-rgb),.1);
      border-radius: var(--radius); padding: 12px 16px; display: flex; gap: 18px;
      align-items: center; flex-wrap: wrap;
    }
    .ltempo-escondido { display: none !important; }

    /* ── Vazio ── */
    .ltempo-vazio {
      background: var(--surface-dark); border: 1px solid rgba(var(--white-rgb),.08);
      border-radius: var(--radius); padding: 26px 28px; text-align: center;
    }
    .ltempo-vazio h4 { margin: 0 0 8px; font-size: 14px; color: var(--text); }
    .ltempo-vazio p { margin: 0 auto; font-size: 12.5px; color: var(--text-muted); max-width: 52ch; line-height: 1.6; }

    /* ── Tags de tipo de evento ── */
    .ltempo-tag {
      font-size: 10px; padding: 1px 7px; border-radius: 10px; flex-shrink: 0; white-space: nowrap;
      background: rgba(var(--white-rgb),.08); color: var(--text-muted);
    }
    .ltempo-tag-criado  { background: rgba(var(--green-rgb),.16);  color: var(--green); }
    .ltempo-tag-editado { background: rgba(var(--teal-rgb),.16);   color: var(--teal); }
    .ltempo-tag-apagado { background: rgba(var(--red-rgb),.16);    color: var(--red); }
    .ltempo-tag-movido  { background: rgba(var(--purple-rgb),.16); color: var(--purple); }

    /* ── Modo editor: trilhas por pasta ── */
    .ltempo-editor { display: grid; grid-template-columns: 1fr 300px; gap: 14px; align-items: start; }
    .ltempo-pista {
      display: grid; grid-template-columns: 200px 1fr; background: var(--surface-dark);
      border: 1px solid rgba(var(--white-rgb),.08); border-radius: var(--radius); overflow: hidden;
    }
    .ltempo-cabecas { border-right: 1px solid rgba(var(--white-rgb),.1); }
    .ltempo-cabeca-regua {
      height: 30px; border-bottom: 1px solid rgba(var(--white-rgb),.1); display: flex;
      align-items: center; padding: 0 12px; font-size: 10.5px; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: .07em;
    }
    .ltempo-cabeca {
      height: 38px; display: flex; align-items: center; gap: 8px; padding: 0 12px;
      border-bottom: 1px solid rgba(var(--white-rgb),.05);
    }
    .ltempo-cabeca .cor { width: 3px; height: 19px; border-radius: 2px; flex-shrink: 0; }
    .ltempo-cabeca .nm {
      font-size: 11.5px; color: var(--text); overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap; direction: rtl; text-align: left;
    }
    .ltempo-cabeca .qt { margin-left: auto; font-size: 10px; color: var(--text-muted); }
    .ltempo-rolo { overflow-x: auto; overflow-y: hidden; position: relative; }
    .ltempo-regua { height: 30px; position: relative; border-bottom: 1px solid rgba(var(--white-rgb),.1); cursor: pointer; }
    .ltempo-tick {
      position: absolute; top: 0; height: 100%; border-left: 1px solid rgba(var(--white-rgb),.07);
      font-size: 9.5px; color: var(--text-muted); padding: 3px 0 0 4px; white-space: nowrap;
      pointer-events: none;
    }
    .ltempo-tick.mes { border-left-color: rgba(var(--white-rgb),.22); color: var(--text); font-weight: 600; }
    .ltempo-trilha { height: 38px; position: relative; border-bottom: 1px solid rgba(var(--white-rgb),.05); }
    .ltempo-vao {
      position: absolute; top: 0; bottom: 0;
      background: repeating-linear-gradient(45deg, transparent 0, transparent 4px,
                  rgba(var(--white-rgb),.05) 4px, rgba(var(--white-rgb),.05) 5px);
    }
    .ltempo-bloco {
      position: absolute; top: 5px; height: 28px; border-radius: 4px; cursor: pointer;
      display: flex; align-items: center; padding: 0 7px; overflow: hidden;
      border: 1px solid rgba(var(--black-rgb),.35);
    }
    .ltempo-bloco span {
      font-size: 10.5px; font-weight: 600; white-space: nowrap; overflow: hidden;
      text-overflow: ellipsis; color: var(--surface-dark);
    }
    .ltempo-bloco.sel { outline: 2px solid var(--text); outline-offset: -2px; }
    /* A agulha: começa em "agora", mas ARRASTA — Padrões de interface ›
       Componentes › Barra de tempo proíbe trilho de tempo decorativo. */
    .ltempo-agulha { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--red); z-index: 6; }
    .ltempo-agulha::before {
      content: ''; position: absolute; top: 0; left: -6px; width: 14px; height: 11px;
      background: var(--red); border-radius: 2px 2px 6px 6px;
    }
    /* Área de pega maior que os 2px da linha — trilho fino é impossível de acertar. */
    .ltempo-agulha::after {
      content: ''; position: absolute; top: 0; bottom: 0; left: -7px; right: -7px; cursor: ew-resize;
    }
    .ltempo-legenda {
      display: flex; gap: 16px; font-size: 11.5px; color: var(--text-muted);
      margin-top: 9px; align-items: center; flex-wrap: wrap;
    }
    .ltempo-btn-agora {
      background: transparent; border: 1px solid rgba(var(--white-rgb),.14); color: var(--text-muted);
      font-family: inherit; font-size: 11px; padding: 3px 10px; border-radius: 20px; cursor: pointer;
    }
    .ltempo-btn-agora:hover { color: var(--text); background: var(--surface-hover); }

    /* ── Painel da direita ── */
    .ltempo-painel {
      background: var(--surface); border: 1px solid rgba(var(--white-rgb),.08);
      border-radius: var(--radius); overflow: hidden;
    }
    .ltempo-painel-cab { padding: 11px 14px; border-bottom: 1px solid rgba(var(--white-rgb),.06); }
    .ltempo-painel-cab b { font-size: 12px; color: var(--text); }
    .ltempo-painel-sub { font-size: 11px; color: var(--text-muted); margin-top: 3px; }
    .ltempo-painel ul {
      list-style: none; margin: 0; padding: 9px 14px 14px; display: flex;
      flex-direction: column; gap: 7px; max-height: 52vh; overflow-y: auto;
    }
    .ltempo-painel li { display: flex; flex-direction: column; gap: 2px; }
    .ltempo-painel li .linha1 { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }

    /* ── Modo feed ── */
    .ltempo-feed-grade { display: grid; grid-template-columns: 190px 1fr; gap: 18px; align-items: start; }
    .ltempo-rail { position: sticky; top: 0; display: flex; flex-direction: column; gap: 12px; }
    .ltempo-mes {
      background: var(--surface); border: 1px solid rgba(var(--white-rgb),.08);
      border-radius: var(--radius); padding: 10px 12px;
    }
    .ltempo-mes-nome { font-size: 11.5px; font-weight: 600; color: var(--text-muted); margin-bottom: 7px; }
    .ltempo-grade { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
    .ltempo-quad { aspect-ratio: 1; border-radius: 2px; background: var(--teal); }
    .ltempo-quad.vazio { background: transparent; border: 1px dashed rgba(var(--white-rgb),.22); }
    .ltempo-quad.zero { background: rgba(var(--white-rgb),.07); }
    .ltempo-feed { display: flex; flex-direction: column; gap: 10px; }
    .ltempo-dia {
      background: var(--surface); border: 1px solid rgba(var(--white-rgb),.08);
      border-radius: var(--radius); overflow: hidden;
    }
    .ltempo-dia.vazia { opacity: .55; border-style: dashed; }
    .ltempo-dia-cab {
      display: flex; align-items: center; gap: 12px; padding: 11px 14px; flex-wrap: wrap;
    }
    .ltempo-dia-cab.tem-lista { border-bottom: 1px solid rgba(var(--white-rgb),.06); }
    .ltempo-dia-data { font-size: 13.5px; font-weight: 600; color: var(--text); }
    .ltempo-dia-dow { font-size: 11.5px; color: var(--text-muted); }
    .ltempo-dia-stats { margin-left: auto; display: flex; gap: 12px; align-items: center; font-size: 12px; }
    .ltempo-barrinha {
      height: 5px; border-radius: 3px; display: flex; overflow: hidden; width: 100px;
      background: rgba(var(--white-rgb),.08);
    }
    .ltempo-barrinha i { display: block; height: 100%; }
    .ltempo-eventos { list-style: none; margin: 0; padding: 9px 14px 12px; display: flex; flex-direction: column; gap: 5px; }
    .ltempo-eventos li { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; font-size: 12px; }
    .ltempo-marco {
      background: rgba(var(--amber-rgb),.1); border: 1px solid rgba(var(--amber-rgb),.3);
      border-radius: var(--radius); padding: 9px 14px; font-size: 12px; color: var(--text-muted);
    }

    /* ── Modo faixa ── */
    .ltempo-faixa {
      background: var(--surface); border: 1px solid rgba(var(--white-rgb),.08);
      border-radius: var(--radius); padding: 14px 16px;
    }
    .ltempo-rolagem { overflow-x: auto; padding-bottom: 2px; }
    .ltempo-svg { display: block; }
    .ltempo-eixo {
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      font-size: 10.5px; color: var(--text-muted); margin-top: 4px; flex-wrap: wrap;
    }
    .ltempo-col { cursor: pointer; }
  `;

  window.__ltempo.estilo = {
    injetar() {
      const antigo = document.getElementById('ltempo-estilo');
      if (antigo) antigo.remove();
      const style = document.createElement('style');
      style.id = 'ltempo-estilo';
      style.textContent = CSS;
      document.head.appendChild(style);
    },
  };
})();
