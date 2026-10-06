// O que o arquivo exportado precisa antes de rodar os módulos.

const EXM = JSON.parse(document.getElementById('exm-dados').textContent);

window.currentProject = EXM.projeto;
window.renderMapas = EXM.render || {};

// O Resumo completo (resumo.js, do próprio programa) lê estes dois globais.
window.workspaceConfig = { root_folder: null, working_folders: ['.'], ignore_list: [], context_items: [], main_file: null };
window.appSettings = {};

// Reproduz o pintarNotificacao que showToast do utils.js chama.
window.pintarNotificacao = function (msg, ehErro) {
  if (!document.getElementById('app-toast-ancora')) {
    const ancora = document.createElement('div');
    ancora.id = 'app-toast-ancora';
    ancora.className = 'app-toast-ancora app-toast-ancora--inferior-direita';

    const toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.setAttribute('role', 'status');

    ancora.appendChild(toast);
    document.body.appendChild(ancora);
  }

  const toast = document.getElementById('app-toast');
  toast.textContent = msg;
  toast.className = 'app-toast app-toast--media ' + (ehErro ? 'app-toast-error' : 'app-toast-ok');

  if (window._toastTimer) {
    clearTimeout(window._toastTimer);
  }

  window._toastTimer = setTimeout(() => {
    toast.classList.add('app-toast-hidden');
  }, 2500);
};

// O mock da API do programa.
window.pywebview = {
  api: new Proxy({}, {
    get(_, nome) {
      if (nome === 'then') {
        return undefined;
      }

      return async function(...args) {
        // A aba Documentação lê as fontes pelo mesmo trio de métodos do programa; aqui eles
        // respondem com o texto que foi embutido na exportação (EXM.documentacao).
        const doc = EXM.documentacao || {};

        if (nome === 'list_agent_files') {
          const arquivos = doc[args[1]] || {};
          return {
            success: true,
            files: Object.keys(arquivos).filter(f => !(f.startsWith('_') && !f.includes('/')))
          };
        }

        if (nome === 'read_agent_file') {
          const arquivos = doc[args[1]] || {};
          return Object.prototype.hasOwnProperty.call(arquivos, args[2])
            ? { success: true, content: arquivos[args[2]] }
            : { success: false, error: 'Arquivo não encontrado.' };
        }

        // A busca por conteúdo é a literal do programa (documentacao.py::search_doc_content).
        if (nome === 'search_doc_content') {
          const consulta = String(args[1] || '');
          const escopo = args[2];
          const arquivos = doc[escopo] || {};
          const q = consulta.toLowerCase();
          const resultados = [];
          for (const rel of Object.keys(arquivos)) {
            if (!rel.endsWith('.md') || rel.split('/')[0].startsWith('_')) continue;
            const conteudo = arquivos[rel];
            const idx = conteudo.toLowerCase().indexOf(q);
            if (idx === -1) continue;
            const ini = Math.max(0, idx - 80);
            const fim = Math.min(conteudo.length, idx + consulta.length + 80);
            resultados.push({
              doc_path: rel,
              tipo: escopo,
              excerpt: (ini > 0 ? '...' : '') + conteudo.slice(ini, fim).trim() + (fim < conteudo.length ? '...' : '')
            });
            if (resultados.length >= 20) break;
          }
          return { success: true, results: resultados };
        }

        // Métodos de mapa
        const metodosMapas = [
          'get_visualizar_pipeline_status',
          'get_visualizar_pipeline_result',
          'get_mapa_niveis_result',
          'analyze_imports',
          'scan_file_io',
          'get_file_tree_metrics',
          'get_complexidade',
          'scan_workspace'
        ];

        if (metodosMapas.includes(nome)) {
          if (EXM.dados[nome] !== undefined) {
            return EXM.dados[nome];
          }
          return { success: false, error: 'Este mapa não foi incluído na exportação.' };
        }

        return { success: false, error: 'Indisponível no arquivo exportado.' };
      };
    }
  })
};

// Os no-ops dos mapas que ficam de fora.
// Não levamos os arquivos desses mapas; estes no-ops só impedem ReferenceError em mapas.js.
var _hotspotsModo = 'linhas';
var _hotspotsTopo = 15;
var _dispersaoModo = 'dependencias';
var _ligDados = null;
var _ligTransform = null;

function initLigacoes() {}
function renderHotspots() {}
function renderDispersao() {}
function renderPainel() {}
function _ligAbrir() {}
