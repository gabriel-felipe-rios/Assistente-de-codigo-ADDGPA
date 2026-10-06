// ══════ SERVIDOR LOCAL COM RECARGA — os comandos no Acesso rápido ══
// Os dois botões da linha do servidor que se usam sem olhar para ela: abrir a
// página no navegador e copiar o endereço. O endereço é o MESMO da linha — o
// do último arquivo aberto pelo ▶ Executar, ou a raiz do servidor.

(function () {
  // ⚠️ NUNCA escreva o slug nem o ponto à mão — os dois vêm do dataset da tag
  // <script> que o programa injetou, a partir do manifesto.
  const EU = document.currentScript.dataset;   // { caminho, slug, ponto }

  const url = () => window.svlUltimaUrl || (window.svlEstado && window.svlEstado.url_base) || '';
  const noAr = () => !!(window.svlEstado && window.svlEstado.rodando);
  const MOTIVO = 'o servidor não está no ar — escolha Servidor local na aba Terminal e aperte ▶ Executar';

  xtRegistrarEncaixe(EU.slug, EU.ponto, () => {
    if (typeof window.svlAbrir !== 'function') return [];   // casca desmontada
    return [
      {
        id: 'abrir-no-navegador',
        icone: '↗',
        rotulo: 'Abrir a página no navegador',
        ativo: noAr,
        motivo: MOTIVO,
        fazer: () => { if (typeof window.svlAbrir === 'function') window.svlAbrir(url()); },
      },
      {
        id: 'copiar-endereco',
        icone: '⧉',
        rotulo: 'Copiar o endereço do servidor',
        ativo: noAr,
        motivo: MOTIVO,
        fazer: () => copiarContexto(url(), 'Endereço copiado: ' + url()),
      },
    ];
  });
})();
