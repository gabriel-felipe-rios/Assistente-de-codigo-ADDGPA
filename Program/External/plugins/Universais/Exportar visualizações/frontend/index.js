/**
 * SOMENTE LEITURA — este plugin lê os arquivos reais do programa e os dados do projeto
 * pela API do programa; só escreve uma vez, quando o usuário exporta, gravando o
 * arquivo ou pasta na pasta que escolheu. Não modifica nada do programa e não guarda
 * nada na própria pasta.
 *
 * Tela principal: não se desenha nada especial por projeto; é sempre a mesma lista de
 * projetos e a mesma ação de exportar.
 */

(function() {
  const CAMINHO_PLUGIN = (() => {
    let src = document.currentScript.src;
    let m = src.match(/\/External\/plugins\/(.+?)\/frontend\/index.js/);
    return m ? decodeURIComponent(m[1]) : 'Universais/Exportar visualizações';
  })();

  const BASE = new URL('.', document.currentScript.src).href;
  const MODULOS = ['exm-estilo', 'exm-comum', 'exm-busca-projeto', 'exm-coleta', 'exm-dialogo'];

  let carregando = null;

  function _carregarModulos() {
    return Promise.all(MODULOS.map(nom => {
      return new Promise((res, rej) => {
        const script = document.createElement('script');
        script.src = BASE + nom + '.js?t=' + Date.now();
        script.onload = res;
        script.onerror = () => rej(new Error('Não consegui carregar ' + nom + '.js'));
        document.head.appendChild(script);
      });
    })).then(() => {
      // Remover scripts antigos
      Array.from(document.head.querySelectorAll('script[data-exm-mod]'))
        .forEach(s => s.remove());
    }).catch(e => {
      throw e;
    });
  }

  function chamar(acao, extra) {
    return window.pywebview.api.chamar_plugin(CAMINHO_PLUGIN,
      Object.assign({ acao, projeto: this.projeto }, extra || {}));
  }

  async function _montar(raiz) {
    const estado = {
      raiz,
      projeto: null,
      projetos: [],
      catalogo: {},
      ocupado: false,
      chamar
    };

    try {
      let r;
      try {
        r = await window.pywebview.api.list_projects();
      } catch(e) {
        r = [];
      }
      estado.projetos = r || [];

      if(!raiz.isConnected) return;

      try {
        const c = await chamar.call(estado, 'catalogo');
        if(!c.success) {
          raiz.innerHTML = '<p class="plugins-vazio">Não consegui carregar o catálogo: ' +
            (c.error || 'erro desconhecido') + '</p>';
          return;
        }
        estado.catalogo = c;
      } catch(e) {
        raiz.innerHTML = '<p class="plugins-vazio">Erro ao chamar backend: ' + e.message + '</p>';
        return;
      }

      if(!raiz.isConnected) return;

      raiz.innerHTML = '';
      window.__exm.estilo.injetar();
      window.__exm.dialogo.desenharTela(estado);
    } catch(e) {
      raiz.innerHTML = '<p class="plugins-vazio">Erro: ' + e.message + '</p>';
    }
  }

  window.montarPlugin = function(container, contexto) {
    if(carregando) return;
    container.innerHTML = '<p class="plugins-vazio">Carregando…</p>';

    carregando = _carregarModulos()
      .then(() => {
        if(!container.isConnected) return;
        _montar(container);
      })
      .catch(e => {
        if(container.isConnected) {
          container.innerHTML = '<p class="plugins-vazio">Não consegui carregar o plugin: ' + e.message + '</p>';
        }
        carregando = null;
      })
      .then(() => {
        carregando = null;
      });
  };
})();
