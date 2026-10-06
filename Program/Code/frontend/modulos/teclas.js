// ═══════════════════════════════════════════ REGISTRO DE TECLAS ══
// O ouvinte ÚNICO de tecla do programa, e a lista de quem responde a cada uma.
//
// Antes daqui existir eram oito `keydown` de `document` espalhados, cada um com
// a sua guarda escrita à mão — e as guardas NÃO eram iguais entre si. O sintoma
// clássico era a tecla que "às vezes não funciona": um handler saía cedo por uma
// guarda que o vizinho não tinha, e não havia um lugar só onde descobrir isso.
//
// ⚠️ TECLA, e não "atalho". `atalho` já é o termo interno dos Launchers
// (`atalhos_externos.py`, `AtalhosExternosMixin`), e é decisão registrada no
// Vocabulário. O vocabulário daqui é: uma TECLA (a combinação) responde por um
// COMANDO (o que ela faz), identificado por um `id`.
//
// ⚠️ O `id` É A CHAVE DO `settings.teclas`. Trocar um `id` depois de publicado
// faz o usuário perder a tecla que escolheu — sem aviso e sem erro nenhum.
// Escolha o `id` pensando que ele é para sempre.
//
// ⚠️ O QUE NÃO PASSA POR AQUI, e é de propósito: `Esc`, `Enter` e `Tab` são
// teclas de TEXTO e continuam onde estão (o `Esc` fecha modal em quatro
// arquivos, um deles em captura, para um campo de dentro do modal não engolir a
// saída de emergência); o `Espaço` da Oficina e o `Delete` são teclas de GESTO —
// dependem de onde o ponteiro está. Nenhuma das cinco é configurável.
//
// ⚠️ Sem `import`/`export`, como todo o frontend: as funções abaixo são globais,
// e a tag `<script>` no `index.html` é a ordem de execução.

// ── O registro ───────────────────────────────────────────────────────────────
//
// `Map` e não objeto: a ordem de inserção é a ordem em que a tela de Teclado
// mostra os comandos, e também quem responde primeiro quando dois comandos
// dividem a mesma tecla no mesmo alcance.
const _TECLAS = new Map();

/**
 * Põe um comando no registro. Chamar de novo com o mesmo `id` substitui.
 *
 * - `id`      estável; é a chave do `settings.teclas` e nunca muda
 * - `rotulo`  o que a barra e a tela de Teclado mostram
 * - `grupo`   forma o "Editor: Salvar o arquivo" da barra
 * - `onde`    o id do painel dono, ou 'global' — ver `_painelValendo`
 * - `padrao`  a tecla de fábrica, ou `null` (comando sem tecla é legítimo)
 * - `ativo`   função opcional; falso = o comando aparece cinza, com o `motivo`
 * - `motivo`  por que está indisponível, em texto de tela
 * - `icone`   um GLIFO à esquerda da linha na barra — nunca emoji (ver abaixo)
 * - `fazer`   o que a tecla executa
 * - `slug`    de que extensão veio, quando veio de uma (vazio = do programa)
 * - `emCampo` verdadeiro = a tecla dispara MESMO com o foco num campo de texto
 *             (o `<textarea>` do Editor, o campo do Chat). Ver o ouvinte
 *             abaixo: sem isto, o Ctrl+P do Acesso rápido não abria com o
 *             cursor dentro do código, que é onde o usuário passa o dia
 *
 * ⚠️ `icone` é GLIFO, e não emoji: a linha selecionada da barra muda de cor ao
 * navegar com as setas, e emoji não obedece a `color` — ficaria aceso enquanto
 * os vizinhos apagam. O menu de contexto tem emojis e NÃO serve de modelo: ele
 * pinta o fundo no hover, não a cor do texto, que é a saída que a convenção
 * prevê para o outro caso.
 */
function registrarTecla(comando) {
  if (!comando || !comando.id) return;
  _TECLAS.set(comando.id, {
    id: comando.id,
    rotulo: comando.rotulo || comando.id,
    grupo: comando.grupo || '',
    onde: comando.onde || 'global',
    padrao: comando.padrao ?? null,
    ativo: typeof comando.ativo === 'function' ? comando.ativo : null,
    motivo: comando.motivo || '',
    icone: comando.icone || '',
    fazer: comando.fazer,
    slug: comando.slug || '',
    emCampo: !!comando.emCampo,
  });
}

// Tira um comando do registro. A tecla que o usuário escolheu para ele CONTINUA
// gravada no `settings.teclas` — desligar uma extensão e religá-la não pode
// custar a configuração de quem a religou.
// eslint-disable-next-line no-unused-vars
function desregistrarTecla(id) {
  _TECLAS.delete(id);
}

// Todas as de uma extensão de uma vez, para o descarregamento não precisar
// saber os `id` que ela registrou.
// eslint-disable-next-line no-unused-vars
function desregistrarTeclasDe(slug) {
  if (!slug) return;
  [..._TECLAS.values()].forEach((comando) => {
    if (comando.slug === slug) _TECLAS.delete(comando.id);
  });
}

// A lista, na ordem de registro, com a tecla efetiva de cada um já resolvida.
// É daqui que saem a linha da barra e a grade da tela de Teclado — nenhuma das
// duas escreve a sua própria lista, que é o ponto inteiro de haver um registro.
// Cópia rasa: quem desenha a tela não mexe no registro por descuido.
// eslint-disable-next-line no-unused-vars
function obterTeclas() {
  return [..._TECLAS.values()].map((comando) => ({
    ...comando,
    tecla: textoDaTecla(comando.id),
  }));
}

// ── A tecla efetiva ──────────────────────────────────────────────────────────

// A tecla que vale agora para um comando: a que o usuário trocou, ou a de
// fábrica.
//
// ⚠️ Lê de `appSettings`, NUNCA de `window.pywebview.api.*`. A ponte
// Python↔WebView é assíncrona e não se consulta durante um gesto — e um
// `keydown` é um gesto. O valor chega ao global no boot.
//
// ⚠️ `??` e não `||`: tecla gravada como string vazia quer dizer "o usuário
// TIROU a tecla deste comando", e não "volte para a de fábrica".
//
// ⚠️ `settings.teclas` guarda SÓ o que o usuário trocou, e nasce `{}`. Gravar
// ali a tabela inteira congelaria o padrão: mudar uma tecla de fábrica numa
// versão futura não chegaria a quem já abriu a tela de Teclado uma vez.
function _teclaEfetiva(id) {
  const comando = _TECLAS.get(id);
  if (!comando) return null;
  const trocadas = (typeof appSettings !== 'undefined' && appSettings.teclas) || {};
  return trocadas[id] ?? comando.padrao;
}

// ── O texto canônico ─────────────────────────────────────────────────────────
//
// A mesma combinação precisa sair IGUAL em três lugares — a linha da barra, o
// rótulo do menu de contexto e a grade da tela de Teclado —, então a
// normalização mora aqui e em mais lugar nenhum. Se cada tela normalizar do seu
// jeito, a tecla gravada não casa com a tecla que dispara, e o sintoma é
// "gravei e não funcionou".
//
// A forma canônica é `Ctrl+Shift+P`: modificadores nesta ordem, `+` sem espaço,
// letra em maiúscula, e o nome das teclas especiais por extenso.

// A ordem é FIXA, e é ela que faz `Shift+Ctrl+P` e `Ctrl+Shift+P` casarem como
// a mesma tecla.
const _TECLAS_MODIFICADORES = ['Ctrl', 'Alt', 'Shift'];

// Como cada modificador pode vir escrito, no que o navegador entrega e no que
// alguém possa ter gravado à mão no `settings.json`.
const _TECLAS_APELIDOS = {
  ctrl: 'Ctrl', control: 'Ctrl', cmd: 'Ctrl', command: 'Ctrl', meta: 'Ctrl',
  alt: 'Alt', option: 'Alt',
  shift: 'Shift',
};

// Os nomes por extenso das teclas que não são letra. Minúsculo → forma canônica.
const _TECLAS_NOMES = {
  espaco: 'Espaço', 'espaço': 'Espaço', space: 'Espaço',
  delete: 'Delete', del: 'Delete',
  backspace: 'Backspace',
  enter: 'Enter', escape: 'Escape', esc: 'Escape', tab: 'Tab',
  arrowup: 'ArrowUp', arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft', arrowright: 'ArrowRight',
  home: 'Home', end: 'End', pageup: 'PageUp', pagedown: 'PageDown',
};

function _nomeCanonicoDaTecla(bruto) {
  const texto = String(bruto || '').trim();
  if (!texto) return '';
  if (texto.length === 1) return texto.toUpperCase();
  const minuscula = texto.toLowerCase();
  if (_TECLAS_NOMES[minuscula]) return _TECLAS_NOMES[minuscula];
  if (/^f([1-9]|1[0-2])$/.test(minuscula)) return minuscula.toUpperCase();
  // Nome que este registro não conhece volta com a inicial maiúscula: é melhor
  // mostrar `Insert` do que engolir a tecla porque a tabela acima não a previu.
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Normaliza uma combinação escrita — a de fábrica, ou a que veio do
// `settings.json`. Devolve '' quando não há tecla nenhuma.
function textoDaCombinacao(tecla) {
  if (!tecla) return '';
  const partes = String(tecla).trim().split('+');
  // ⚠️ O `+` é uma tecla como outra, e o separador é o MESMO caractere: `Ctrl++`
  // sai da divisão como ['Ctrl', '', '']. O pedaço vazio do fim é a tecla.
  //
  // ⚠️ E cada pedaço vai APARADO. Uma combinação escrita à mão no
  // `settings.json` como `Ctrl + P` chega com espaço colado no modificador, e
  // sem o `trim` de cada pedaço o `Ctrl ` não é reconhecido como modificador:
  // ele vira a tecla base, e a tecla base de verdade sobrescreve — o resultado
  // era um `P` solto, que não casa com nada.
  const pedacos = [];
  partes.forEach((parte, i) => {
    const limpo = parte.trim();
    if (limpo !== '') pedacos.push(limpo);
    else if (parte === '' && i > 0 && i === partes.length - 1) pedacos.push('+');
  });

  const modificadores = [];
  let base = '';
  pedacos.forEach((parte) => {
    const apelido = _TECLAS_APELIDOS[parte.toLowerCase()];
    if (apelido) {
      if (!modificadores.includes(apelido)) modificadores.push(apelido);
    } else {
      base = _nomeCanonicoDaTecla(parte);
    }
  });
  if (!base) return '';
  return [..._TECLAS_MODIFICADORES.filter((m) => modificadores.includes(m)), base].join('+');
}

// O texto da tecla de UM COMANDO, pelo `id` — o que a barra mostra à direita da
// linha, o que o menu de contexto escreve no rótulo e o que a grade de Teclado
// põe na coluna "Tecla". Vazio quando o comando não tem tecla, e também quando
// o `id` não está registrado (comando de extensão desligada, por exemplo).
function textoDaTecla(id) {
  return textoDaCombinacao(_teclaEfetiva(id));
}

// Um `keydown` virado texto canônico. É o que a tela de Teclado usa para
// capturar a combinação que o usuário aperta, e é o mesmo caminho que o ouvinte
// abaixo percorre — capturar e disparar pela MESMA função é o que garante que a
// tecla gravada seja a tecla que funciona.
function teclaDoEvento(e) {
  if (!e) return '';
  const partes = [];
  if (e.ctrlKey || e.metaKey) partes.push('Ctrl');
  if (e.altKey) partes.push('Alt');
  if (e.shiftKey) partes.push('Shift');
  const base = _baseDoEvento(e);
  if (!base) return '';
  partes.push(base);
  return partes.join('+');
}

function _baseDoEvento(e) {
  // ⚠️ `e.code` para o Espaço, `e.key` para o resto. O `e.key` do espaço é ' ',
  // um caractere invisível que some no meio de um `Ctrl+ `; e o `e.code` de uma
  // letra é a POSIÇÃO dela no teclado, que muda de layout para layout. Misturar
  // os dois dá uma tecla que funciona num teclado e não no outro.
  // `trabalhos-oficina-palco.js` já usa `e.code !== 'Space'` de propósito.
  if (e.code === 'Space') return 'Espaço';
  const bruto = e.key;
  if (!bruto) return '';
  // Só o modificador apertado ainda não é combinação nenhuma.
  if (bruto === 'Control' || bruto === 'Alt' || bruto === 'Shift' || bruto === 'Meta') return '';
  // ⚠️ A letra vem em minúscula ou maiúscula CONFORME O SHIFT. Sem normalizar,
  // `Ctrl+Shift+F` nunca casaria com o que está gravado.
  return _nomeCanonicoDaTecla(bruto);
}

// ── Onde a tecla vale ────────────────────────────────────────────────────────

// Um painel está valendo se está no DOM, não tem `.hidden`, e — sendo um
// sub-painel — é ele o que tem `.active`.
//
// ⚠️ O projeto tem DUAS convenções opostas para a mesma pergunta, e as duas
// estavam certas onde nasceram: `editor.js` perguntava se o painel NÃO tem
// `.hidden`, e `trabalhos-oficina-acoes.js` se ele TEM `.active`. As duas andam
// juntas — `navegacao.js` e `_wireSubtabBar` põem `.active` e tiram `.hidden`
// no mesmo gesto —, e a regra abaixo cobre as duas de uma vez. Escrita aqui, e
// nunca mais em módulo nenhum.
//
// ⚠️ NÃO copiar a terceira guarda que `editor.js` tinha
// (`painelDaAba.contains(e.target)`): ela impedia o Ctrl+P de disparar com o
// foco dentro da própria caixa da abertura rápida, porque aquele overlay é
// filho de `<body>`. Com a guarda de campo de texto no lugar, ela deixa de ser
// proteção e vira armadilha — qualquer widget aberto fora do painel dono
// pararia de receber tecla.
function _painelValendo(onde) {
  // 'global' não tem dono: vale em qualquer aba, e também na tela de projetos.
  if (!onde || onde === 'global') return true;
  const painel = document.getElementById(onde);
  if (!painel) return false;

  const pai = painel.parentElement;
  if (pai) {
    const irmaoAceso = [...pai.children]
      .some((filho) => filho !== painel && filho.classList.contains('active'));
    if (irmaoAceso && !painel.classList.contains('active')) return false;
  }

  // ⚠️ E os ANCESTRAIS também. `trsub-oficina` continua sem `.hidden` e com
  // `.active` depois que a aba Trabalhos fecha — quem ganha `.hidden` é
  // `tab-trabalhos`, acima dele. Sem esta subida, a tecla de uma sub-aba
  // dispararia com a aba dela fechada.
  for (let no = painel; no && no !== document.body; no = no.parentElement) {
    if (no.classList && no.classList.contains('hidden')) return false;
  }
  return true;
}

// ── A trava de captura ───────────────────────────────────────────────────────
//
// ⚠️ ENQUANTO A TELA DE TECLADO CAPTURA UMA COMBINAÇÃO, O REGISTRO FICA MUDO.
// Sem isto, apertar `Ctrl+S` para gravá-lo como tecla nova SALVARIA UM ARQUIVO
// no mesmo toque — e o campo de captura não é `INPUT`, então a guarda de campo
// de texto lá embaixo não o cobre. A trava é explícita e ligada só durante o
// gesto, e não uma guarda a mais no ouvinte: quem captura sabe quando começa e
// quando acaba; o ouvinte não teria como adivinhar.
let _teclasEmPausa = false;

// eslint-disable-next-line no-unused-vars
function pausarTeclas(pausado) {
  _teclasEmPausa = !!pausado;
}

// ── O ouvinte único ──────────────────────────────────────────────────────────
//
// ⚠️ FASE DE BORBULHA, sem `capture`. É o que faz o `stopPropagation` do
// `<textarea>` de `editor-superficie.js` continuar valendo: de dentro do código,
// o Ctrl+S e o Ctrl+F são tratados lá e param lá. Medido em 31/08/2026 — sem
// isso o Ctrl+F abria e fechava o achador no mesmo golpe.
document.addEventListener('keydown', (e) => {
  // 0 · Alguém está capturando uma combinação. Ver a trava, acima.
  if (_teclasEmPausa) return;

  // 1 · O foco está num campo: as teclas são do texto — SALVO para o comando
  // que declarou `emCampo`.
  //
  // ⚠️ Esta é a forma completa, a de `ofiLigarTeclado`, e não a de
  // `editor-arvore.js`, que olhava `document.activeElement` e só cobria
  // INPUT/TEXTAREA. `isContentEditable` é o que protege a renomeação no lugar.
  //
  // ⚠️ A guarda NÃO é mais um `return` seco, e isso é a correção de um defeito
  // real (06/09/2026): com o cursor dentro do código do Editor — um
  // `<textarea>` —, o Ctrl+P do Acesso rápido não fazia nada, e o usuário
  // tinha de clicar fora do arquivo para a barra abrir. A regra "campo de
  // texto fica com as teclas" continua valendo para o resto: um F2, um Delete,
  // um Ctrl+Z da Oficina não podem roubar a tecla de quem está digitando. O
  // que muda é que um comando pode dizer, ao se registrar, que vale em campo
  // também — e só ele passa. Não é regra por modificador ("Ctrl+ vale
  // sempre"): o Ctrl+Z da Oficina dentro de uma Nota é exatamente o caso em
  // que o campo tem de ganhar.
  const alvo = e.target;
  const emCampo = !!(alvo && (alvo.isContentEditable
    || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)));

  // 2 · Um modal aberto é uma pergunta bloqueante.
  //
  // ⚠️ O `:not(.hidden)` NÃO É ZELO. O `index.html` traz uma dúzia de
  // `.modal-overlay hidden` montados de fábrica, então
  // `querySelector('.modal-overlay')` acha um SEMPRE, com ou sem modal aberto:
  // a tecla saía daqui antes de fazer nada, e o sintoma era "Delete não apaga,
  // só o botão Excluir apaga". O mesmo valia para o Ctrl+Z.
  if (document.querySelector('.modal-overlay:not(.hidden)')) return;

  const tecla = teclaDoEvento(e);
  if (!tecla) return;

  // 3 · Quem responde. O primeiro do registro que casa a tecla, está no painel
  // dono e não está indisponível — e só ele. Dois comandos podem dividir a
  // mesma tecla (a tela de Teclado avisa com o selo âmbar e deixa gravar), mas
  // disparar os dois no mesmo toque seria pior do que o aviso.
  for (const comando of _TECLAS.values()) {
    if (typeof comando.fazer !== 'function') continue;
    if (emCampo && !comando.emCampo) continue;
    if (textoDaTecla(comando.id) !== tecla) continue;
    if (!_painelValendo(comando.onde)) continue;
    // Indisponível não bloqueia a fila: um comando cinza deixa a tecla passar
    // para o próximo que a queira.
    if (comando.ativo && !comando.ativo()) continue;
    e.preventDefault();
    comando.fazer(e);
    return;
  }
});
