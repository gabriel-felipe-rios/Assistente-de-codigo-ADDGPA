// ══════════════════════════════════════════ TEMPLATE: Sub-aba Visualizar
// Casca da sub-aba "Automação › Visualizar": o desenho à esquerda e, à
// direita, o painel com dois cards lado a lado — «Situação» e «Legenda» —, com
// o mesmo fundo e texto branco (D11, D12). O desenho em si é montado por
// `visualizar-acionamentos-desenho.js` dentro de `#vis-desenho`.
//
// Morava dentro de `execucao/rotinas-template.js` — era a única sub-aba de
// Automação cujo markup ficava em outra pasta que não a do seu comportamento.
//
// A Situação nasce com travessões: os números só existem depois que o backend
// responde, e escrever "0 de 12" antes disso seria afirmar algo falso sobre o
// projeto durante o carregamento.
//
// ⚠️ A antiga métrica «Espera», de uma palavra, saiu: a espera virou uma linha
// por grupo (T1, T2, T3), com a contagem regressiva até ele começar e o que o
// está segurando. Quem a pinta é `_visResumoGrupos` (sincronia).
document.getElementById('asubtab-visualizar').innerHTML = `
  <div class="vis-layout">
  <!-- O PALCO leva o desenho e o painel juntos, e é ele que escala (zoom) para
       caber na largura — ver _visCaber. Escalar só o desenho deixava o
       painel do mesmo tamanho numa janela estreita. -->
  <div class="vis-palco" id="vis-palco">

    <div class="vis-scroll" id="vis-scroll">
      <div class="vis-desenho" id="vis-desenho"></div>
    </div>

    <aside class="vis-painel">
      <div class="vis-situacao" id="vis-situacao">
        <span class="vis-painel-tit">Situação</span>
        <div class="vis-metrica vis-metrica-ok">
          <span class="vis-metrica-num" id="vis-num-ligados">—</span>
          <span class="vis-metrica-rot">Rotinas ligadas</span>
        </div>
        <div class="vis-metrica">
          <span class="vis-metrica-rot">Espera de cada grupo</span>
          ${['t1', 't2', 't3'].map(g => `
          <div class="vis-esp" id="vis-esp-${g}">
            <span class="vis-esp-tag">${g.toUpperCase()}</span>
            <div class="vis-esp-txt">
              <span class="vis-esp-est" id="vis-esp-${g}-est">—</span>
              <span class="vis-esp-motivo" id="vis-esp-${g}-motivo"></span>
            </div>
            <span class="vis-esp-tempo" id="vis-esp-${g}-tempo">—</span>
            <span class="vis-esp-barra"><i id="vis-esp-${g}-barra"></i></span>
          </div>`).join('')}
        </div>
        <!-- A vez na janela do LM Studio: pergunta à parte da espera de cada
             grupo. O grupo pode estar "Parado" (nada mudou no disco) com a vez
             em "Aguardando <projeto>", e o contrário também. -->
        <div class="vis-metrica vis-metrica-vez">
          <span class="vis-metrica-num" id="vis-num-vez">—</span>
          <span class="vis-metrica-rot">A vez</span>
        </div>
        <div class="vis-metrica">
          <span class="vis-metrica-num" id="vis-num-rodada">—</span>
          <span class="vis-metrica-rot">Última rodada</span>
        </div>
        <div class="vis-acoes">
          <button class="vis-chip" id="vis-chip-ligados"
                  title="esconde as rotinas desligadas e as setas que levam a elas">Só os ligados</button>
        </div>
      </div>

      <!-- Leituras independentes, e é preciso ler todas: a CHAVE diz se a
           rotina vai rodar, o ESTADO diz o que aconteceu na última passagem.
           Uma rotina desligada pode estar concluída. Os estados são os mesmos
           da legenda de Acionamentos, na mesma ordem e com as mesmas cores. -->
      <div class="vis-legenda" id="vis-legenda">
        <span class="vis-painel-tit">Legenda</span>
        <span class="vis-legenda-grupo">
          <span class="vis-legenda-lbl">Chave</span>
          <span class="vis-legenda-item"><span class="vis-amostra"></span> ligada</span>
          <span class="vis-legenda-item"><span class="vis-amostra off"></span> desligada</span>
        </span>
        <span class="vis-legenda-grupo">
          <span class="vis-legenda-lbl">Estado</span>
          <span class="vis-legenda-item"><span class="vis-dot"></span> parado</span>
          <span class="vis-legenda-item"><span class="vis-dot esperando"></span> esperando</span>
          <span class="vis-legenda-item"><span class="vis-dot bloqueado"></span> esperando outro projeto</span>
          <span class="vis-legenda-item"><span class="vis-dot run"></span> processando</span>
          <span class="vis-legenda-item"><span class="vis-dot dispensado"></span> dispensada</span>
          <span class="vis-legenda-item"><span class="vis-dot done"></span> concluído</span>
          <span class="vis-legenda-item"><span class="vis-dot parcial"></span> faltou pedaço</span>
          <span class="vis-legenda-item"><span class="vis-dot erro"></span> erro</span>
        </span>
        <span class="vis-legenda-grupo">
          <span class="vis-legenda-lbl">Seta</span>
          <span class="vis-legenda-item"><span class="vis-traco"></span> só começa quando o de trás termina</span>
          <span class="vis-legenda-item"><span class="vis-amostra grp"></span> saindo da caixa: espera o grupo inteiro</span>
        </span>
        <span class="vis-legenda-grupo">
          <span class="vis-legenda-lbl">Mouse num card</span>
          <span class="vis-legenda-item"><span class="vis-cor-antes"></span> ele espera por</span>
          <span class="vis-legenda-item"><span class="vis-cor-depois"></span> esperam por ele</span>
        </span>
        <span class="vis-legenda-grupo">
          <span class="vis-legenda-lbl">Etapas</span>
          <span class="vis-legenda-item"><span class="vis-etapas">1</span> roda de uma vez</span>
          <span class="vis-legenda-item"><span class="vis-etapas">2</span> em partes, e depois a costura</span>
        </span>
      </div>
    </aside>

  </div>
  </div>
`;
