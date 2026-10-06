// ══════ FORMATAR AO SALVAR — o comando no Acesso rápido ══
// "Formatar o arquivo aberto agora": o mesmo formatador da guardiã, aplicado
// NA TELA, sem gravar. Serve para ver o resultado antes do Ctrl+S — e para
// formatar um arquivo que se quer olhar sem salvar.
//
// ⚠️ O texto entra pela porta do Editor (`substituirTexto`), que passa pelo
// mesmo caminho da digitação: o Ctrl+Z desfaz, o arquivo fica sujo, a pintura
// roda. Nunca `superficie.abrir`, que é interno e não marca nada.

(function () {
  // ⚠️ NUNCA escreva o slug nem o ponto à mão — os dois vêm do dataset da tag
  // <script> que o programa injetou, a partir do manifesto.
  const EU = document.currentScript.dataset;   // { caminho, slug, ponto }

  // O arquivo na frente do painel ativo do Editor, NA HORA do clique ou da
  // tecla — e não o `contexto.arquivo` de quando a lista foi pedida: o usuário
  // abre a barra, e o arquivo é o que está aberto agora. Pela porta que o
  // Editor empresta (`edArquivosAbertos`), nunca cutucando `_edPaineis`.
  const arquivo = () => ((typeof edArquivosAbertos === 'function') ? edArquivosAbertos() : [])[0] || '';

  xtRegistrarEncaixe(EU.slug, EU.ponto, () => {
    if (typeof window.fmtFormatar !== 'function') return [];   // casca já desmontada
    return [{
      id: 'formatar-agora',
      icone: '≡',
      rotulo: 'Formatar o arquivo aberto agora',
      atalho: 'Ctrl+Alt+F',
      emCampo: true,
      onde: 'tab-editor',
      ativo: () => !!arquivo() && !!window.fmtPronta,
      motivo: 'nenhum arquivo aberto no Editor — ou a extensão ainda está carregando a biblioteca',
      fazer: () => {
        const c = arquivo();
        const aberto = (typeof edArquivoAberto === 'function') ? edArquivoAberto(c) : null;
        if (!aberto || aberto.binario) { showToast('Abra um arquivo de texto no Editor primeiro.', true); return; }
        let novo;
        try {
          novo = window.fmtFormatar(c, aberto.texto);
        } catch (e) {
          // Um `.json` inválido faz o `parse` lançar — a guardiã deixa passar
          // calada, mas quem PEDIU para formatar precisa saber por que não deu.
          showToast('Não deu para formatar: ' + (e && e.message ? e.message : e), true);
          return;
        }
        if (novo === null) { showToast('Nada a formatar: o arquivo já está como a extensão o deixaria.'); return; }
        if (!aberto.substituirTexto(novo)) { showToast('Traga o arquivo para a frente do Editor.', true); return; }
        showToast('Formatado. Ctrl+S para gravar.');
      },
    }];
  });
})();
