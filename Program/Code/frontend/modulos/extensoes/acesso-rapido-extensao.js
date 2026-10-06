// ══════════════════ EXTENSÕES → os comandos da barra de Acesso rápido ══
// O ponto `acesso-rapido.comandos` (tipo 9): uma extensão devolve uma lista de
// comandos, e eles entram na barra, no modo Comando, sob um grupo com o nome
// dela.
//
// ⚠️ O CATÁLOGO DOS PONTOS VIVE SÓ NO PYTHON (`backend/.../encaixes.py`). Este
// arquivo não repete a declaração: ele só CHAMA o ponto. Duas listas do mesmo
// conjunto divergem no primeiro dia em que alguém acrescenta um ponto num lado
// só.
//
// ⚠️ `XT_FORMA_ITENS` quer dizer uma coisa precisa: o programa pede uma LISTA e
// desenha ele mesmo. A função da extensão recebe `(contexto)` e devolve
// `[{ id, rotulo, icone, atalho, ativo, motivo, emCampo, fazer }]` — ela não
// recebe elemento nenhum.
//
// ── O caminho que um comando de extensão percorre ───────────────────────────
//
// 1. a extensão LIGA e os encaixes dela carregam — `carga.js` chama
//    `xtRegistrarComandosAgora()` na hora, e a tecla sugerida já dispara;
// 2. a barra abre no modo Comando, a tela de Teclado pinta, a página da
//    extensão em Configurações pinta — cada uma chama de novo, para pegar o
//    que mudou (o `ativo` de um item, um `contexto` novo);
// 3. daí para a frente o comando é um comando como outro qualquer: aparece na
//    barra, aparece na tela de Teclado, e pode receber uma tecla;
// 4. ao desligar a extensão, `xtDesregistrarComandos(slug)` tira os dela.
//
// ⚠️ O passo 1 é a correção de um defeito real (06/09/2026): o registro só
// acontecia quando a barra abria, então a tecla sugerida por uma extensão
// (o `Ctrl+Alt+T` do gabarito) não fazia NADA até o usuário abrir o Ctrl+P uma
// vez — e a tela de Teclado, que nunca chamava o registro, não listava
// comando de extensão nenhum.

/**
 * Pergunta ao ponto e põe os comandos das extensões no registro de teclas.
 *
 * Chamada quando a barra vai listar comandos e quando a tela de Teclado pinta.
 * Registrar de novo o mesmo `id` substitui, então chamar várias vezes é
 * inofensivo — e é o que mantém a lista viva quando uma extensão liga.
 */
// eslint-disable-next-line no-unused-vars
function xtRegistrarComandos(contexto) {
  if (typeof xtEncaixeItens !== 'function') return;
  const itens = xtEncaixeItens('acesso-rapido.comandos', contexto || {});

  // ⚠️ O que a extensão DEIXOU de devolver sai do registro. Um item que só
  // existe com um arquivo aberto (a lista de imagens dele) não pode ficar na
  // barra depois que o arquivo fechou, apontando para um `fazer` que já não
  // faz sentido. O `id` carrega o slug, então dá para saber de quem é cada um.
  const vivos = new Set();
  itens.forEach((item, i) => {
    if (!item || !item.rotulo || typeof item.fazer !== 'function') return;
    const slug = item._xtDe || '';
    // ⚠️ O `id` CARREGA O SLUG. Sem isso, duas extensões com um comando chamado
    // `formatar` gravariam na mesma chave de `settings.teclas`, e a tecla de uma
    // viraria a da outra. O sufixo é o `id` que a extensão deu, ou a posição
    // dela na lista quando ela não deu nenhum — o que importa é ser ESTÁVEL
    // entre desligar e religar, para a tecla escolhida voltar a valer.
    const id = `xt:${slug}:${item.id || item.rotulo}`;
    vivos.add(id);

    // `ativo` pode vir como função (o que se quer: é conferida a cada tecla e
    // a cada pintura) ou como booleano, que é o que um item de menu já usa.
    // Com `ativo: false` o `motivo` é obrigatório — igual ao item de menu.
    const ativo = typeof item.ativo === 'function' ? item.ativo
      : (item.ativo === false ? () => false : null);

    registrarTecla({
      id,
      rotulo: item.rotulo,
      // O nome da extensão vira o título de grupo na barra e na tela de
      // Teclado — o `nome` do manifesto, o mesmo da lista de Configurações;
      // o slug só quando a extensão sumiu da árvore antes de o item sair.
      grupo: _xtNomeDaExtensao(slug),
      // `onde` é o id do painel em que a TECLA vale (`tab-editor`), ou
      // 'global'. Na barra o comando aparece de qualquer jeito; é a tecla que
      // obedece — um Ctrl+Enter de "rodar o trecho" não pode disparar no
      // campo do Chat.
      onde: item.onde || 'global',
      icone: item.icone || '',
      slug,
      ativo,
      motivo: item.motivo || '',
      // ⚠️ `emCampo` é da extensão decidir: um comando que age sobre a
      // SELEÇÃO do Editor ("rodar o trecho") só faz sentido com o cursor
      // dentro do código, e sem isto a tecla dele nunca dispararia de lá.
      // Ver a guarda de campo em `teclas.js`.
      emCampo: !!item.emCampo,
      // ⚠️ A EXTENSÃO SUGERE A TECLA; QUEM GRAVA É O PROGRAMA. O campo `atalho`
      // do item — que nos menus é só texto decorativo — vale aqui como tecla
      // SUGERIDA, e ela só entra SE ESTIVER LIVRE.
      //
      // Duas extensões pedindo `Ctrl+K` não quebram nada: a primeira fica com
      // ela, a segunda entra sem tecla, e o selo "mesma tecla" aparece na tela
      // de Teclado. Nunca se rouba a tecla de ninguém, e nunca se recusa a
      // extensão por causa da tecla.
      //
      // D42 "Tecla": a sugestão do MANIFESTO vem primeiro (`teclas` do item
      // `comando` em `acrescenta`) — é o que a página da extensão pode mostrar
      // sem rodar o código —, e o `atalho` do item é a volta. ⚠️ A chave do
      // registro continua `xt:{slug}:{id}`, nunca `{prefixo}.{id}`: é a chave
      // de `settings.teclas`, e trocá-la apagaria a tecla escolhida (D20).
      padrao: (() => {
        const sugestao = _xtTeclaDoManifesto(slug, item.id) || item.atalho;
        return _xtTeclaLivre(sugestao, id) ? textoDaCombinacao(sugestao) : null;
      })(),
      // ⚠️ CÓDIGO DE TERCEIRO RODA PROTEGIDO, com o nome da extensão no erro.
      // Uma extensão que lança não pode derrubar a barra.
      fazer: () => {
        try {
          const r = item.fazer();
          if (r && typeof r.catch === 'function') {
            r.catch((e) => console.error(`[extensoes] o comando "${item.rotulo}" de ${slug} falhou:`, e));
          }
        } catch (e) {
          console.error(`[extensoes] o comando "${item.rotulo}" de ${slug} falhou:`, e);
        }
      },
    });
  });

  obterTeclas().forEach((c) => {
    if (c.slug && c.id.startsWith('xt:') && !vivos.has(c.id)) desregistrarTecla(c.id);
  });
}

// O `nome` do manifesto de uma extensão, pelo slug — para o grupo da barra.
function _xtNomeDaExtensao(slug) {
  const folha = (typeof xtLigadas === 'function')
    ? xtLigadas().find((f) => f.slug === slug) : null;
  return (folha && folha.nome) || slug;
}

/**
 * A lista do registro de teclas com os comandos de extensão NA ORDEM DA LISTA
 * de Programa › Extensões (D42 "Ordem"), para o modo Comando da barra.
 *
 * ⚠️ O registro é um `Map` em ordem de INSERÇÃO: uma extensão desligada e
 * religada teria os comandos no fim. Os comandos do programa (sem `slug`)
 * ficam onde estão, na ordem deles; os de extensão viram um bloco só, na casa
 * do primeiro deles, ordenado pela lista — e os de uma mesma extensão mantêm
 * a ordem em que ela os devolveu (sort estável). Bloco, e não casa por casa:
 * um comando do programa registrado tarde não parte os de uma extensão ao meio.
 */
// eslint-disable-next-line no-unused-vars
function xtComandosNaOrdemDaLista(comandos) {
  if (typeof xtPosicaoNaLista !== 'function') return comandos;
  const inicio = comandos.findIndex((c) => c.slug);
  if (inicio < 0) return comandos;
  const deExtensao = comandos.filter((c) => c.slug)
    .sort((a, b) => xtPosicaoNaLista(a.slug) - xtPosicaoNaLista(b.slug));
  const doPrograma = comandos.filter((c) => !c.slug);
  return [...doPrograma.slice(0, inicio), ...deExtensao, ...doPrograma.slice(inicio)];
}

/**
 * O contexto do ponto — `{ projeto, aba, arquivo }` —, montado do que está na
 * tela agora. Num lugar só: a barra, a tela de Teclado, a página da extensão
 * e a carga precisam do mesmo, e quatro cópias divergiriam.
 */
// eslint-disable-next-line no-unused-vars
function xtContextoDosComandos() {
  return {
    projeto: (typeof currentProject !== 'undefined' && currentProject) || null,
    aba: (document.querySelector('.tab-btn.active') || {}).dataset || {},
    arquivo: (typeof _edAtivo !== 'undefined' && _edAtivo && _edAtivo.atual)
      ? _edAtivo.atual.caminho : '',
  };
}

/** `xtRegistrarComandos` com o contexto de agora — o atalho que todos chamam. */
// eslint-disable-next-line no-unused-vars
function xtRegistrarComandosAgora() {
  xtRegistrarComandos(xtContextoDosComandos());
}

// A tecla que o manifesto sugere para um comando do Acesso rápido — `''` se
// não sugere. Sai de `folha.acrescenta` (o item `comando` cujo lugar é
// `acesso-rapido.comandos`, campo `teclas[id do comando]`).
function _xtTeclaDoManifesto(slug, idDoComando) {
  if (!idDoComando || typeof xtLigadas !== 'function') return '';
  const folha = xtLigadas().find((f) => f.slug === slug);
  const item = ((folha && folha.acrescenta) || []).find((i) => i.recurso === 'comando'
    && (i.lugares || []).includes('acesso-rapido.comandos') && i.teclas && i.teclas[idDoComando]);
  return item ? item.teclas[idDoComando] : '';
}

// A sugestão só entra se nenhum outro comando já responder por ela. Compara
// pelo texto canônico, e não pela string crua: `Shift+Ctrl+K` e `Ctrl+Shift+K`
// são a mesma tecla.
function _xtTeclaLivre(sugestao, meuId) {
  if (!sugestao) return false;
  const alvo = textoDaCombinacao(sugestao);
  if (!alvo) return false;
  return !obterTeclas().some((c) => c.id !== meuId && c.tecla === alvo);
}

/**
 * Tira do registro todos os comandos de uma extensão.
 *
 * ⚠️ A TECLA QUE O USUÁRIO ESCOLHEU FICA GRAVADA. O contrato promete, em caixa
 * alta, que desligar não apaga nada: o comando sai do registro, a linha de
 * `settings.teclas` permanece, e volta a valer quando a extensão religar. É por
 * isso que o `id` tem de ser estável — ver o aviso do slug, acima.
 */
// eslint-disable-next-line no-unused-vars
function xtDesregistrarComandos(slug) {
  if (typeof desregistrarTeclasDe === 'function') desregistrarTeclasDe(slug);
}
