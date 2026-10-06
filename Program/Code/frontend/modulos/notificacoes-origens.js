// ════════════════════════════════════════════ ORIGENS DAS NOTIFICAÇÕES ══
//
// Só dado. Duas tabelas, e nenhuma lógica:
//
//   NOTIFICACAO_ORIGENS            — as quinze origens, na ordem em que a
//                                    categoria "Notificações" as desenha.
//   NOTIFICACAO_ORIGEM_POR_ARQUIVO — de que origem é cada módulo do frontend.
//
// ⚠️ Este arquivo é separado do `notificacoes.js` de propósito: ele muda
// quando um módulo NASCE ou TROCA DE ABA, e o outro muda quando a regra de
// mostrar ou calar muda. São duas vidas diferentes, e juntá-las faria quem
// acrescenta um módulo novo ter de ler a lógica do filtro para achar a linha.
//
// A chave é o caminho a partir de `modulos/`, não o nome do arquivo: existem
// dois `duplicados.js` no projeto (`duplicados.js` e
// `agentes/indexacao/duplicados.js`), e o nome sozinho os confundiria.

// A ordem daqui é a ordem na tela. `tela` vira o subtítulo que agrupa as
// linhas — sem ele, quinze linhas seguidas viram uma parede.
const NOTIFICACAO_ORIGENS = [
  { chave: 'projetos',      rotulo: 'Projetos',            tela: 'Fora do projeto' },
  { chave: 'arquivos',      rotulo: 'Arquivos',            tela: 'Fora do projeto' },
  { chave: 'configuracoes', rotulo: 'Configurações',       tela: 'Fora do projeto' },

  { chave: 'chat',          rotulo: 'Chat',                tela: 'Aba Assistente' },
  { chave: 'fila',          rotulo: 'Fila',                tela: 'Aba Assistente' },
  { chave: 'designer',      rotulo: 'Designer',            tela: 'Aba Assistente' },

  { chave: 'automacao',     rotulo: 'Automação',           tela: 'Abas do projeto' },
  { chave: 'decisoes',      rotulo: 'Acervo',              tela: 'Abas do projeto' },
  { chave: 'documentacao',  rotulo: 'Documentação',        tela: 'Abas do projeto' },
  { chave: 'terminal',      rotulo: 'Terminal',            tela: 'Abas do projeto' },
  { chave: 'backups',       rotulo: 'Backups',             tela: 'Abas do projeto' },
  { chave: 'inspetor',      rotulo: 'Inspetor',            tela: 'Abas do projeto' },
  { chave: 'aparencia',     rotulo: 'Aparência',           tela: 'Abas do projeto' },
  { chave: 'mapas',         rotulo: 'Mapas e Workspace',   tela: 'Abas do projeto' },
  { chave: 'pipeline',      rotulo: 'Mapas › Pipeline',    tela: 'Abas do projeto' },
];

// ⚠️ Módulo que não está aqui NÃO é erro: a notificação dele simplesmente
// aparece sempre, que é o comportamento que o programa sempre teve. Só entra
// nesta tabela o módulo cuja aba é certa — chutar a aba de um arquivo ambíguo
// calaria o aviso errado, e o usuário não teria como descobrir onde.
const NOTIFICACAO_ORIGEM_POR_ARQUIVO = {
  // ── Fora do projeto ─────────────────────────────────────────────────────
  'projetos.js':                                  'projetos',
  'projeto-template.js':                          'projetos',
  'preparar.js':                                  'projetos',
  'preparar-template.js':                         'projetos',
  'drag-drop.js':                                 'projetos',
  'modais.js':                                    'projetos',

  'arquivos.js':                                  'arquivos',
  'arquivos-crud.js':                             'arquivos',
  'arquivos-preview.js':                          'arquivos',
  'arquivos-template.js':                         'arquivos',
  'arquivos-como-adicionar.js':                   'arquivos',
  'estilos-e-cores.js':                           'arquivos',
  'estilos-e-cores-tags.js':                      'arquivos',
  'estilos-e-cores-miniaturas.js':                'arquivos',

  // `limites.js`, `tab-order.js` e `backups-config.js` são telas DA aba
  // Configurações, mesmo sem o prefixo `config-`.
  'config-arquivos-lidos-codigo.js':              'configuracoes',
  'config-arquivos-lidos-nunca.js':               'configuracoes',
  'config-arquivos-lidos-quem.js':                'configuracoes',
  'config-busca.js':                              'configuracoes',
  'config-categorias.js':                         'configuracoes',
  'config-extensoes.js':                          'configuracoes',
  'config-ferramentas.js':                        'configuracoes',
  'config-mcp.js':                                'configuracoes',
  'config-notificacoes.js':                       'configuracoes',
  'config-preparar.js':                           'configuracoes',
  'config-arquivos.js':                           'configuracoes',
  'config-render.js':                             'configuracoes',
  'config-tema.js':                               'configuracoes',
  'config-template.js':                           'configuracoes',
  'limites.js':                                   'configuracoes',
  'tab-order.js':                                 'configuracoes',
  'backups-config.js':                            'configuracoes',

  // ── Aba Assistente ──────────────────────────────────────────────────────
  'chat-lista.js':                                'chat',
  'chat-envio.js':                                'chat',
  'chat-mensagens.js':                            'chat',
  'chat-payload.js':                              'chat',
  'chat-template.js':                             'chat',
  'chat-contexto-inicial.js':                     'chat',
  'chat-prompt-fixo.js':                          'chat',
  'agentes/chat-agentes.js':                      'chat',
  'copiar-contexto.js':                           'chat',
  'assistente.js':                                'chat',

  'agentes/execucao/fila.js':                     'fila',
  'agentes/execucao/fila-lista.js':               'fila',
  'agentes/execucao/fila-chamadas.js':            'fila',
  'agentes/execucao/fila-chat-tab.js':            'fila',
  'agentes/execucao/fila-contexto-tab.js':        'fila',
  'agentes/execucao/fila-log-tab.js':             'fila',
  'agentes/execucao/fila-subagentes-tab.js':      'fila',
  'agentes/execucao/fila-template.js':            'fila',

  'agentes/colaboracao/designer.js':               'designer',
  'agentes/colaboracao/designer-chat.js':          'designer',
  'agentes/colaboracao/designer-chips.js':         'designer',
  'agentes/colaboracao/designer-contexto.js':      'designer',
  'agentes/colaboracao/designer-dimensoes.js':     'designer',
  'agentes/colaboracao/designer-preview-modal.js': 'designer',
  'agentes/colaboracao/designer-rodadas.js':       'designer',
  'agentes/colaboracao/designer-selecao.js':       'designer',
  'agentes/colaboracao/designer-styles.js':        'designer',
  'agentes/colaboracao/designer-template.js':      'designer',
  'agentes/colaboracao/designer-zoom.js':          'designer',

  'mapas-pipeline.js':                            'pipeline',
  'mapas-pipeline-ajuda.js':                      'pipeline',
  'mapas-pipeline-dados.js':                      'pipeline',
  'mapas-pipeline-listas.js':                     'pipeline',
  'mapas-pipeline-markdown.js':                   'pipeline',
  'mapas-pipeline-pecas.js':                      'pipeline',
  'mapas-pipeline-raias.js':                      'pipeline',
  'mapas-pipeline-sequencia.js':                  'pipeline',
  'mapas-pipeline-template.js':                   'pipeline',
  'mapas-pipeline-trilha.js':                     'pipeline',
  'mapas-pipeline-niveis.js':                     'pipeline',
  'mapas-pipeline-niveis-arvore.js':              'pipeline',
  'mapas-pipeline-niveis-camera.js':              'pipeline',
  'mapas-pipeline-niveis-desenho.js':             'pipeline',
  'mapas-pipeline-niveis-geometria.js':           'pipeline',
  'mapas-pipeline-niveis-paineis.js':             'pipeline',
  'mapas-pipeline-niveis-template.js':            'pipeline',

  // ── Abas do projeto ─────────────────────────────────────────────────────
  // A Automação é a aba que mais avisa sozinha: além dos acionamentos, toda
  // rotina de documentação e de indexação termina avisando por aqui.
  'agentes/automacao/acionamentos.js':                     'automacao',
  'agentes/automacao/acionamentos-template.js':            'automacao',
  'agentes/automacao/detector.js':                         'automacao',
  'agentes/automacao/detector-template.js':                'automacao',
  'agentes/automacao/espera.js':                           'automacao',
  'agentes/automacao/espera-template.js':                  'automacao',
  'agentes/automacao/revezamento-template.js':             'automacao',
  'agentes/automacao/revezamento.js':                      'automacao',
  'agentes/automacao/visualizar-acionamentos.js':          'automacao',
  'agentes/automacao/visualizar-acionamentos-desenho.js':  'automacao',
  'agentes/automacao/visualizar-template.js':              'automacao',
  'agentes/documentacao/documentacao-tecnica.js':          'automacao',
  'agentes/documentacao/documentacao-tecnica-template.js': 'automacao',
  'agentes/documentacao/rotinas-comum.js':                 'automacao',
  'agentes/documentacao/resumo-pastas.js':                 'automacao',
  'agentes/documentacao/resumo-pastas-template.js':        'automacao',
  'agentes/indexacao/bibliotecas.js':                      'automacao',
  'agentes/indexacao/comentarios.js':                      'automacao',
  'agentes/indexacao/duplicados.js':                       'automacao',
  'agentes/indexacao/glossario.js':                        'automacao',
  'agentes/indexacao/grafo-imports.js':                    'automacao',
  'agentes/indexacao/hashes.js':                           'automacao',
  'agentes/indexacao/identificadores.js':                  'automacao',
  'agentes/indexacao/indice-simbolos.js':                  'automacao',
  'agentes/indexacao/indice-navegacao.js':                 'automacao',
  'agentes/indexacao/pipeline.js':                         'automacao',
  'agentes/sincronia/sincronia.js':                        'automacao',
  'agentes/embedding.js':                                  'automacao',
  'agentes/execucao/rotinas.js':                           'automacao',

  'regras.js':                                    'decisoes',
  'regras-template.js':                           'decisoes',

  'documentacao.js':                              'documentacao',
  'documentacao-template.js':                     'documentacao',

  'terminal.js':                                  'terminal',
  'terminal-template.js':                         'terminal',

  'backups.js':                                   'backups',
  'backups-modais.js':                            'backups',
  'backups-template.js':                          'backups',
  'backups-mapa.js':                              'backups',
  'backups-mapa-arvore.js':                       'backups',
  'backups-mapa-diff-modal.js':                   'backups',
  'backups-mapa-ligacoes.js':                     'backups',
  'backups-mapa-painel.js':                       'backups',
  'backups-mapa-pipeline.js':                     'backups',
  'backups-mapa-sunburst.js':                     'backups',
  'backups-mapa-treemap.js':                      'backups',
  'backups-mapa-trilha.js':                       'backups',
  'backups-mapa-zoom.js':                         'backups',

  'inspetor.js':                                  'inspetor',
  'inspetor-candidatos.js':                       'inspetor',
  'inspetor-envio.js':                            'inspetor',
  'inspetor-gravacao.js':                         'inspetor',
  'inspetor-gravacao-revisao.js':                 'inspetor',
  'inspetor-template.js':                         'inspetor',

  'aparencia.js':                                 'aparencia',
  'aparencia-cartoes.js':                         'aparencia',
  'aparencia-escopo.js':                          'aparencia',
  'aparencia-seletor-cor.js':                     'aparencia',
  'aparencia-template.js':                        'aparencia',

  'mapaio.js':                                    'mapas',
  'mapas.js':                                     'mapas',
  'mapas-dispersao.js':                           'mapas',
  'mapas-hierarquia.js':                          'mapas',
  'mapas-hotspots.js':                            'mapas',
  'mapas-ligacoes.js':                            'mapas',
  'mapas-ligacoes-desenho.js':                    'mapas',
  'mapas-ligacoes-modos.js':                      'mapas',
  'mapas-matriz.js':                              'mapas',
  'mapas-matriz-io.js':                           'mapas',
  'mapas-painel.js':                              'mapas',
  'mapas-proporcao.js':                           'mapas',
  'mapas-template.js':                            'mapas',
  'navegacao.js':                                 'mapas',
  'workspace.js':                                 'mapas',
  'contexto.js':                                  'mapas',
  'relacoes.js':                                  'mapas',
  'resumo.js':                                    'mapas',
  'resumo-extensoes.js':                          'mapas',
  'simbolos.js':                                  'mapas',
  'arvore-pastas.js':                             'mapas',
  'busca-arvore.js':                              'mapas',
};
