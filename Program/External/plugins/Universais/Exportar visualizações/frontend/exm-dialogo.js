(function() {
  window.__exm = window.__exm || {};
  const c = window.__exm.comum;

  function desenharTela(estado) {
    const html = `
<div class="exm-raiz">
  <div>
    <h2 class="exm-titulo">Exportar visualizações</h2>
    <p class="exm-sub">Exporta o resumo, a documentação e os mapas de um projeto num HTML interativo, igual ao das abas do programa, para mandar a quem não tem o programa.</p>
  </div>
  <div class="exm-campo-busca"></div>
  <button class="btn btn-primary exm-btn-exportar" disabled>Exportar</button>
</div>`;

    estado.raiz.innerHTML = html;
    const campoBusca = estado.raiz.querySelector('.exm-campo-busca');
    const btnExportar = estado.raiz.querySelector('.exm-btn-exportar');

    // Montar busca de projeto
    campoBusca.appendChild(window.__exm.busca.montar(estado, () => {
      btnExportar.disabled = !estado.projeto;
    }));

    btnExportar.addEventListener('click', () => abrir(estado));
  }

  function abrir(estado) {
    let coleta = null;
    let avisoMostrado = false;
    let escolhendoPasta = false;

    // As opções ficam dentro de [data-exm-opcoes]: o aviso do que falta a esconde e usa o lugar dela,
    // sem apagar as caixas — a escolha continua lá para o "Exportar mesmo assim" ler.
    const bodyHtml = (() => {
      let html = '<div data-exm-opcoes>';
      html += '<div class="exm-grupo">Projeto</div>';
      html += '<label class="exm-chk"><input type="checkbox" data-exm-resumo checked> Resumo completo</label>';
      html += '<div class="exm-grupo">Documentação</div>';
      for (const fonte of estado.catalogo.fontes_doc || []) {
        html += `<label class="exm-chk"><input type="checkbox" data-exm-fonte="${c.escapar(fonte.id)}" checked> ${c.escapar(fonte.rotulo)}</label>`;
      }
      html += '<div class="exm-grupo">Mapas</div>';
      for (const mapa of estado.catalogo.mapas || []) {
        html += `<label class="exm-chk"><input type="checkbox" data-exm-mapa="${c.escapar(mapa.id)}" checked> ${c.escapar(mapa.rotulo)}</label>`;
      }
      html += `<div class="exm-grupo">Como exportar</div>
<label class="exm-chk"><input type="checkbox" data-exm-unico checked> Arquivo único</label>
<div class="exm-nota" data-exm-nota>Um só arquivo HTML.</div>`;
      html += '</div><div data-exm-avisos class="hidden"></div>';
      return html;
    })();

    const overlay = window.abrirModalPadrao({
      title: 'Exportar visualizações — ' + estado.projeto,
      bodyHtml,
      confirmLabel: 'Exportar',
      onConfirm: async (_overlay, showErr) => {
        if (estado.ocupado) return false;
        estado.ocupado = true;

        try {
          const mapas = Array.from(overlay.querySelectorAll('[data-exm-mapa]:checked'))
            .map(c => c.getAttribute('data-exm-mapa'));
          const fontesDoc = Array.from(overlay.querySelectorAll('[data-exm-fonte]:checked'))
            .map(c => c.getAttribute('data-exm-fonte'));
          const temResumo = overlay.querySelector('[data-exm-resumo]').checked;
          const unico = overlay.querySelector('[data-exm-unico]').checked;
          const modo = unico ? 'unico' : 'varios';

          // Se ainda não coletou, coletar
          if (!coleta) {
            const andar = (txt) => showErr(txt);
            coleta = await window.__exm.coleta.coletar(estado, mapas, andar, temResumo, fontesDoc);
          }

          if(!overlay.isConnected || !estado.raiz.isConnected) return false;

          // Se há falta e não foi mostrado aviso, mostrar
          if (coleta.faltando.length && !avisoMostrado) {
            let aviso = '<p>Falta dado em ' + coleta.faltando.length + ' item(ns). Se exportar assim, o que falta sai sem desenhar:</p>';
            aviso += '<ul class="exm-aviso">';
            for (const f of coleta.faltando) {
              aviso += '<li><b>' + c.escapar(f.rotulo) + '</b> — ' + c.escapar(f.motivo) + '</li>';
            }
            aviso += '</ul>';
            aviso += '<p>Você pode cancelar, gerar o que falta no programa e exportar de novo — ou exportar mesmo assim.</p>';

            overlay.querySelector('[data-exm-opcoes]').classList.add('hidden');
            const areaAviso = overlay.querySelector('[data-exm-avisos]');
            areaAviso.innerHTML = aviso;
            areaAviso.classList.remove('hidden');
            overlay.querySelector('.modal-confirm').textContent = 'Exportar mesmo assim';
            avisoMostrado = true;
            estado.ocupado = false;
            return false;
          }

          // Abrir seletor de pasta
          escolhendoPasta = true;
          const guardaClique = (e) => {
            if (e.target === overlay) e.stopPropagation();
          };
          overlay.addEventListener('click', guardaClique, true);

          let r;
          try {
            r = await window.pywebview.api.browse_path('folder');
          } finally {
            setTimeout(() => {
              overlay.removeEventListener('click', guardaClique, true);
              escolhendoPasta = false;
            }, 500);
          }

          if(!overlay.isConnected || !estado.raiz.isConnected) return false;

          if (!r || !r.success || !r.path) {
            showErr('Nenhuma pasta escolhida — nada foi gravado.');
            estado.ocupado = false;
            return false;
          }

          // Exportar
          const x = await estado.chamar('exportar', {
            destino: r.path,
            modo,
            mapas,
            temResumo,
            fontesDoc,
            documentacao: coleta.documentacao,
            dados: coleta.dados,
            render: coleta.render,
            icones: coleta.icones,
            tema: coleta.tema
          });

          if(!overlay.isConnected || !estado.raiz.isConnected) return false;

          if (!x.success) {
            showErr(x.error);
            estado.ocupado = false;
            return false;
          }

          if(typeof window.showToast === 'function') {
            window.showToast('Exportado em ' + x.caminho);
          }
          estado.ocupado = false;
          return true;
        } catch(e) {
          showErr(e.message);
          estado.ocupado = false;
          return false;
        }
      }
    });

    // A nota viva do modo e o botão: sem nada marcado não há o que exportar. Mudou a escolha,
    // o que já foi coletado deixa de valer.
    const chkUnico = overlay.querySelector('[data-exm-unico]');
    const nota = overlay.querySelector('[data-exm-nota]');
    const btnConfirm = overlay.querySelector('.modal-confirm');
    const marcaveis = overlay.querySelectorAll('[data-exm-mapa], [data-exm-fonte], [data-exm-resumo]');

    chkUnico.addEventListener('change', () => {
      nota.textContent = chkUnico.checked
        ? 'Um só arquivo HTML.'
        : 'Uma pasta nova, com um arquivo por seção e um `index.html` para abrir.';
    });
    marcaveis.forEach(chk => {
      chk.addEventListener('change', () => {
        coleta = null;
        btnConfirm.disabled = !overlay.querySelector('[data-exm-mapa]:checked, [data-exm-fonte]:checked, [data-exm-resumo]:checked');
      });
    });
  }

  window.__exm.dialogo = { abrir, desenharTela };
})();
