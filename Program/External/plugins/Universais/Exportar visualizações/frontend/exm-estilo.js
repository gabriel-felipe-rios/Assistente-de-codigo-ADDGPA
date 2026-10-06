(function() {
  window.__exm = window.__exm || {};
  const ID = 'exm-estilo';

  const CSS = `
.exm-raiz { flex: 1; display: flex; flex-direction: column; gap: 14px;
            padding: 20px 24px; min-height: 0; }
.exm-titulo { font-size: 16px; font-weight: 700; margin: 0; }
.exm-sub { font-size: 13px; color: var(--text-muted); margin: 0; line-height: 1.5; }
.exm-campo { display: flex; flex-direction: column; gap: 8px; }
.exm-campo label { font-size: 12.5px; font-weight: 600; color: var(--text); }

/* ── Seletor de projeto ─────────────────────────────────────────────────────── */
.exm-busca { position: relative; }
.exm-busca-campo { display: flex; align-items: center; gap: 8px;
                   background: var(--surface-dark); border: 1px solid rgba(var(--white-rgb),0.12);
                   border-radius: 6px; padding: 6px 10px; min-width: 240px; cursor: text; }
.exm-busca-campo:focus-within { border-color: var(--blue); }
.exm-busca-campo .exm-lupa { opacity: 0.55; font-size: 13px; }
.exm-busca-campo input { background: transparent; border: none; outline: none;
                         color: var(--text); font-family: inherit; font-size: 13px;
                         flex: 1; min-width: 0; }
.exm-busca-lista { position: absolute; top: calc(100% + 5px); left: 0; width: 300px;
                   z-index: 40; background: var(--surface);
                   border: 1px solid rgba(var(--white-rgb),0.12); border-radius: var(--radius);
                   box-shadow: 0 12px 32px rgba(var(--black-rgb),0.5); padding: 5px;
                   max-height: 260px; overflow-y: auto; display: none; }
.exm-busca.aberta .exm-busca-lista { display: block; }
.exm-busca-item { display: flex; align-items: center; justify-content: space-between;
                  gap: 10px; padding: 7px 10px; border-radius: 5px; font-size: 13px;
                  color: var(--text-muted); cursor: pointer; }
.exm-busca-item.marcado { background: rgba(var(--white-rgb),0.07); color: var(--text); }
.exm-busca-item.atual { color: var(--blue); }
.exm-busca-vazio { padding: 9px 10px; font-size: 12px; color: var(--text-muted); opacity: 0.7; }

/* ── Modal: grupos e caixas ────────────────────────────────────────────────── */
.exm-grupo { font-size: 12.5px; font-weight: 600; color: var(--text);
             margin-bottom: 12px; margin-top: 16px; }
.exm-grupo:first-child { margin-top: 0; }
/* Com Projeto, Documentação e Mapas a lista passa de 18 caixas: rola em vez de estourar a janela. */
/* Flex em coluna com o mesmo gap do .modal: sem ele, o margin-bottom negativo de .modal label empilha as caixas umas sobre as outras. */
[data-exm-opcoes] { display: flex; flex-direction: column; gap: 14px;
                    max-height: 58vh; overflow-y: auto; padding-right: 6px; }
.exm-chk { display: flex; align-items: center; gap: 7px; font-size: 13px;
           color: var(--text-muted); cursor: pointer; user-select: none; }
.exm-chk input { accent-color: var(--blue); width: 14px; height: 14px; cursor: pointer; }
.exm-nota { font-size: 11.5px; color: var(--text-muted); margin-top: 6px; margin-left: 21px;
            opacity: 0.85; }

/* ── Aviso do que falta ────────────────────────────────────────────────────── */
.exm-aviso { font-size: 13px; color: var(--text-muted); line-height: 1.6;
             background: var(--surface); border: 1px dashed rgba(var(--white-rgb),0.12);
             border-radius: var(--radius); padding: 14px 16px; margin: 12px 0; }
.exm-aviso ul { margin: 8px 0 0; padding-left: 20px; }
.exm-aviso li { margin-top: 4px; }
.exm-aviso b { color: var(--text); font-weight: 600; }
`;

  function injetar() {
    if (document.getElementById(ID)) return;
    const style = document.createElement('style');
    style.id = ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  window.__exm.estilo = { injetar };
})();
