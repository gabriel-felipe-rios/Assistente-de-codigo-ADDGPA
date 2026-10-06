(function() {
  window.__exm = window.__exm || {};
  const c = window.__exm.comum;

  function montar(estado, aoEscolher) {
    const div = document.createElement('div');
    div.className = 'exm-campo';
    div.innerHTML = `<label>Exportar qual projeto?</label>
<div class="exm-busca">
  <div class="exm-busca-campo">
    <span class="exm-lupa">🔍</span>
    <input type="text" placeholder="Buscar projeto…" class="exm-busca-input">
  </div>
  <div class="exm-busca-lista"></div>
</div>`;

    const campo = div.querySelector('input');
    const buscaDiv = div.querySelector('.exm-busca');
    const listDiv = div.querySelector('.exm-busca-lista');

    let aberta = false;
    let marcado = -1;
    let filtrado = [];

    function desenharLista(termo) {
      filtrado = [];
      if (termo === '') {
        filtrado = estado.projetos || [];
      } else {
        const chTermo = c.chave(termo);
        for (const proj of (estado.projetos || [])) {
          if (c.chave(proj).includes(chTermo)) {
            filtrado.push(proj);
          }
        }
      }

      listDiv.innerHTML = '';
      if (filtrado.length === 0) {
        listDiv.innerHTML = '<div class="exm-busca-vazio">Nenhum projeto com esse nome.</div>';
      } else {
        for (let i = 0; i < filtrado.length; i++) {
          const item = document.createElement('div');
          item.className = 'exm-busca-item';
          item.innerHTML = c.escapar(filtrado[i]);
          if (i === marcado) item.classList.add('marcado');
          if (filtrado[i] === estado.projeto) item.classList.add('atual');
          item.addEventListener('mousedown', e => {
            e.preventDefault();
            escolherProjeto(filtrado[i]);
          });
          listDiv.appendChild(item);
        }
      }
      marcado = -1;
    }

    function escolherProjeto(nome) {
      if (nome === estado.projeto) {
        fecharLista();
        return;
      }
      estado.projeto = nome;
      campo.value = nome;
      fecharLista();
      aoEscolher();
    }

    function abrirLista() {
      if (aberta) return;
      aberta = true;
      buscaDiv.classList.add('aberta');
      campo.select();
      desenharLista(campo.value);
    }

    function fecharLista() {
      if (!aberta) return;
      aberta = false;
      buscaDiv.classList.remove('aberta');
      campo.value = estado.projeto || '';
    }

    function navegar(delta) {
      if (!aberta || filtrado.length === 0) return;
      marcado += delta;
      if (marcado < 0) marcado = filtrado.length - 1;
      if (marcado >= filtrado.length) marcado = 0;
      atualizarMarcado();
    }

    function atualizarMarcado() {
      const items = listDiv.querySelectorAll('.exm-busca-item');
      items.forEach((it, i) => {
        it.classList.toggle('marcado', i === marcado);
      });
    }

    campo.addEventListener('focus', () => abrirLista());
    campo.addEventListener('blur', () => {
      setTimeout(() => fecharLista(), 100);
    });
    campo.addEventListener('input', () => {
      if (!aberta) abrirLista();
      else desenharLista(campo.value);
    });
    campo.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp') { e.preventDefault(); navegar(-1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); navegar(1); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (marcado >= 0 && marcado < filtrado.length) {
          escolherProjeto(filtrado[marcado]);
        }
      }
      else if (e.key === 'Escape') {
        e.preventDefault();
        fecharLista();
      }
    });

    return div;
  }

  window.__exm.busca = { montar };
})();
