(function() {
  window.__exm = window.__exm || {};
  const c = window.__exm.comum;

  // Quantos arquivos da Documentação se leem ao mesmo tempo. A fonte maior (a Documentação
  // técnica) tem um .md por arquivo de código — um a um, a coleta levaria minutos.
  const LEITURAS_JUNTAS = 8;

  // Lê as fontes marcadas da aba Documentação com o MESMO par de métodos que a aba usa
  // (list_agent_files e read_agent_file). Devolve { fonte: { 'caminho.md': texto } }.
  async function coletarDocumentacao(estado, fontes, andar, faltando) {
    const documentacao = {};

    for (const fonteId of fontes) {
      const info = (estado.catalogo.fontes_doc || []).find(f => f.id === fonteId) || { rotulo: fonteId, agente: fonteId };
      andar('Lendo: ' + info.rotulo);

      const arquivos = {};
      documentacao[fonteId] = arquivos;

      let lista;
      try {
        const r = await window.pywebview.api.list_agent_files(estado.projeto, fonteId);
        if (!r || !r.success) throw new Error((r && r.error) || 'erro desconhecido');
        lista = (r.files || []).filter(f => f.endsWith('.md'));
      } catch(e) {
        faltando.push({ rotulo: info.rotulo, motivo: e.message });
        continue;
      }
      if(!estado.raiz.isConnected) return null;

      if (!lista.length) {
        faltando.push({
          rotulo: info.rotulo,
          motivo: 'nada gerado ainda — rode a rotina ' + info.agente + ' (Automação › Rotinas)'
        });
        continue;
      }

      // O Pipeline se lê pelo _niveis.json, que não vem na lista (começa com `_`).
      if (fonteId === 'pipeline') lista.push('_niveis.json');

      const textos = new Array(lista.length).fill(null);
      let proximo = 0;
      let feitos = 0;
      const trabalhador = async () => {
        while (proximo < lista.length) {
          const i = proximo++;
          try {
            const r = await window.pywebview.api.read_agent_file(estado.projeto, fonteId, lista[i]);
            if (r && r.success) textos[i] = r.content;
          } catch(e) { /* o arquivo que não leu fica de fora */ }
          feitos++;
          andar('Lendo: ' + info.rotulo + ' (' + feitos + '/' + lista.length + ')');
        }
      };
      await Promise.all(Array.from({ length: Math.min(LEITURAS_JUNTAS, lista.length) }, trabalhador));
      if(!estado.raiz.isConnected) return null;

      lista.forEach((caminho, i) => {
        if (textos[i] !== null) arquivos[caminho] = textos[i];
      });
    }

    return documentacao;
  }

  async function coletar(estado, ids, andar, temResumo, fontesDoc) {
    const dados = {};
    const faltando = [];
    let documentacao = {};

    // Se Resumo completo foi marcado, coletar seus dados
    if (temResumo) {
      andar('Lendo: scan_workspace');
      try {
        dados.scan_workspace = await window.pywebview.api.scan_workspace(estado.projeto);
      } catch(e) {
        dados.scan_workspace = { success: false, error: e.message };
      }
      if(!estado.raiz.isConnected) return null;
    }

    // Fontes da Documentação marcadas
    if (fontesDoc && fontesDoc.length) {
      documentacao = await coletarDocumentacao(estado, fontesDoc, andar, faltando);
      if (documentacao === null) return null;
    }

    // Reunir os métodos únicos dos mapas marcados
    const metodos = new Set();
    for (const mapaid of ids) {
      const mapa = c.mapaPorId(estado.catalogo, mapaid);
      if (mapa && mapa.metodos) {
        for (const met of mapa.metodos) {
          metodos.add(met);
        }
      }
    }

    // Chamar cada método em sequência
    for (const met of metodos) {
      andar('Lendo: ' + met);
      try {
        dados[met] = await window.pywebview.api[met](estado.projeto);
      } catch(e) {
        dados[met] = { success: false, error: e.message };
      }
      if(!estado.raiz.isConnected) return null;
    }

    // Levantar Desempenho
    let render = {};
    try {
      const r = await window.pywebview.api.load_render_mapas();
      if (r && r.success && r.render) {
        render = r.render;
      }
    } catch(e) {
      // Falha na leitura do Desempenho não impede exportação
    }
    if(!estado.raiz.isConnected) return null;

    // Tema
    const tema = c.nomeDoTema();

    // Calcular faltando (só para os mapas marcados)
    for (const mapaid of ids) {
      const mapa = c.mapaPorId(estado.catalogo, mapaid);
      if (!mapa) continue;

      if (mapaid === 'mapa-pipeline') {
        const pipeline = dados['get_visualizar_pipeline_status'] || {};
        const niveis = dados['get_mapa_niveis_result'] || {};
        if (pipeline.pipeline_exists === false || (niveis.success === false && niveis.sem_pipeline)) {
          faltando.push({
            rotulo: mapa.rotulo,
            motivo: 'a rotina Pipeline ainda não rodou neste projeto (Automação › Rotinas)'
          });
        } else if (niveis.success === false && niveis.error) {
          faltando.push({ rotulo: mapa.rotulo, motivo: niveis.error });
        } else if (pipeline.success === false && pipeline.error) {
          faltando.push({ rotulo: mapa.rotulo, motivo: pipeline.error });
        }
      } else if (mapaid === 'mapa-matriz') {
        const imp = dados['analyze_imports'] || {};
        if (imp.success !== true) {
          faltando.push({ rotulo: mapa.rotulo, motivo: imp.error || 'erro desconhecido' });
        } else if (!imp.nodes || imp.nodes.length === 0) {
          faltando.push({
            rotulo: mapa.rotulo,
            motivo: 'nenhum arquivo analisado — a pasta de trabalho do projeto está vazia?'
          });
        }
      } else if (mapaid === 'mapa-matriz-io') {
        const io = dados['scan_file_io'] || {};
        if (io.success !== true) {
          faltando.push({ rotulo: mapa.rotulo, motivo: io.error || 'erro desconhecido' });
        } else if (io.total_files === 0) {
          faltando.push({
            rotulo: mapa.rotulo,
            motivo: 'nenhum arquivo de código na pasta de trabalho'
          });
        }
      } else if (['mapa-proporcao', 'mapa-treemap', 'mapa-sunburst'].includes(mapaid)) {
        const met = dados['get_file_tree_metrics'] || {};
        if (met.success !== true || !met.root) {
          faltando.push({
            rotulo: mapa.rotulo,
            motivo: met.error || 'nenhum arquivo encontrado'
          });
        }
        if (mapaid === 'mapa-treemap') {
          const cx = dados['get_complexidade'] || {};
          if (cx.success !== true) {
            faltando.push({
              rotulo: mapa.rotulo + ' (Complexidade)',
              motivo: 'o modo Complexidade sai sem cor'
            });
          }
        }
      }
    }

    // Pacote de ícones em uso: o programa guarda o mapa e a pasta nestes dois globais.
    let icones = null;
    try {
      if (typeof mapaIcones === 'object' && mapaIcones && typeof iconesBase === 'string' && iconesBase) {
        icones = { mapa: mapaIcones, base: iconesBase };
      }
    } catch(e) {}

    return { dados, render, tema, faltando, icones, documentacao };
  }

  window.__exm.coleta = { coletar };
})();
