// ═══════════════════════════════════ CANVAS DAS TELAS — O ESTADO ══
// O objeto em memória. Sem DOM, sem ponte — um lugar só para o que as outras
// peças leem.
//   projeto     — o projeto que a aba está mostrando
//   leitura     — a última resposta da ação `ler`
//   filtro      — o texto da busca da lista
//   tamanhos    — largura × altura de cada dispositivo (o ⚙ muda; vai para files/estado.json)
//   tamanho     — o dispositivo atual
//   escala, px, py — o zoom e o deslocamento do mundo
//   posicoes    — id da tela → {x, y} no mundo
//   escolhida   — a tela selecionada;  dentro — a tela em que se entrou, ou null
//   naoGuardar  — apagar o que o site guardou ao sair da aba (D45)
//   servidor    — a resposta de `subir`, ou null com o servidor parado
//   posicoesDe  — id da tela → o último `posicoes` que a página mandou

window.ctEstado = { projeto: null, leitura: null, filtro: '' };

(function () {
  const e = window.ctEstado;
  const prefs = (typeof xtPreferenciasDe === 'function' && xtPreferenciasDe(window.ctSlug)) || {};
  e.TAMANHOS_PADRAO = { celular: [390, 844], tablet: [768, 1024], computador: [1920, 1080] };
  e.tamanhos = JSON.parse(JSON.stringify(e.TAMANHOS_PADRAO));
  e.tamanho = e.TAMANHOS_PADRAO[prefs.tamanho_inicial] ? prefs.tamanho_inicial : 'computador';
  e.escala = 0.6;
  e.px = 40;
  e.py = 60;
  e.posicoes = {};
  e.escolhida = null;
  e.dentro = null;
  e.naoGuardar = true;
  e.servidor = null;
  e.posicoesDe = {};
  e.desenhada = false;
  e.lida = false;
  // O que não é dado, mas precisa de um lugar comum sem virar global nova:
  e.container = null;          // o painel da aba, que o programa entrega
  e.posicoesGravadas = {};     // o `posicoes.json` do projeto: {tamanho: {id: {x, y}}}
  e.erro = '';                 // a mensagem da última ida à ponte que falhou
  // Cada irmão que liga evento num container novo põe aqui a função que liga;
  // `ctIniciar` chama todas a cada desenho.
  e.ligadores = [];
  // Os ouvintes em `document`/`window`: [alvo, tipo, fn, opções]. O
  // `ctEncerrar` tira todos (contrato, parte 2).
  e.ouvintes = [];
})();

// As opções das ligações, com o padrão de fábrica (D12, D15, D22, D23).
Object.assign(ctEstado, {
  modoSetas: 'escolhida', opacidade: 75, cor: '--blue-rgb',
  ganhoLigado: false, ganho: 30, reducaoLigada: false, reducao: 30,
  acesa: null, precisaLer: false,
  // De onde a seta sai: do elemento que se clica, ou da tela inteira (uma
  // seta por par de arquivos). E o desenho da marca sobre o elemento.
  origemSetas: 'elemento', bolinha: 'vazada',
});

ctEstado.gravavel = () => ({ tamanhos: ctEstado.tamanhos, nao_guardar: ctEstado.naoGuardar, modo_setas: ctEstado.modoSetas, opacidade: ctEstado.opacidade, cor: ctEstado.cor, ganho_ligado: ctEstado.ganhoLigado, ganho: ctEstado.ganho, reducao_ligada: ctEstado.reducaoLigada, reducao: ctEstado.reducao, origem_setas: ctEstado.origemSetas, bolinha: ctEstado.bolinha });
