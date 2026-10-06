# A lista de mapas e de módulos é de propósito fixa; todo mapa leva todos os módulos,
# e só a barra e os painéis mudam.

MAPAS = [
    {'id': 'mapa-pipeline', 'rotulo': 'Pipeline', 'slug': 'pipeline', 'metodos': ('get_visualizar_pipeline_status', 'get_visualizar_pipeline_result', 'get_mapa_niveis_result')},
    {'id': 'mapa-matriz', 'rotulo': 'Matriz de Dependências', 'slug': 'matriz-dependencias', 'metodos': ('analyze_imports',)},
    {'id': 'mapa-matriz-io', 'rotulo': 'Matriz de I/O', 'slug': 'matriz-io', 'metodos': ('scan_file_io',)},
    {'id': 'mapa-proporcao', 'rotulo': 'Proporção', 'slug': 'proporcao', 'metodos': ('get_file_tree_metrics',)},
    {'id': 'mapa-treemap', 'rotulo': 'Treemap', 'slug': 'treemap', 'metodos': ('get_file_tree_metrics', 'get_complexidade')},
    {'id': 'mapa-sunburst', 'rotulo': 'Sunburst', 'slug': 'sunburst', 'metodos': ('get_file_tree_metrics',)},
]

MODULOS = (
    'mapas-template',
    'mapas-pipeline-template',
    'mapas-pipeline-niveis-template',
    'utils',
    'constantes',
    'mapaio',
    'mapas',
    'mapas-matriz',
    'mapas-matriz-io',
    'mapas-proporcao',
    'mapas-hierarquia',
    'mapas-pipeline-dados',
    'mapas-pipeline-pecas',
    'mapas-pipeline-trilha',
    'mapas-pipeline-raias',
    'mapas-pipeline-sequencia',
    'mapas-pipeline-listas',
    'mapas-pipeline-markdown',
    'mapas-pipeline-ajuda',
    'mapas-pipeline-niveis-arvore',
    'mapas-pipeline-niveis-geometria',
    'mapas-pipeline-niveis-desenho',
    'mapas-pipeline-niveis-camera',
    'mapas-pipeline-niveis-paineis',
    'mapas-pipeline-niveis-esboco',
    'mapas-pipeline-niveis',
    'mapas-pipeline',
)

# As fontes da aba Documentação, na ordem das sub-abas dela (_DOC_FONTES, em
# documentacao.js). `id` é o nome da pasta da rotina — a chave que list_agent_files
# e read_agent_file aceitam. A busca semântica de propósito não vai: ela depende
# do banco de embeddings, que não viaja num HTML.
FONTES_DOC = [
    {'id': 'documentacao-tecnica', 'rotulo': 'Documentação técnica', 'agente': 'Documentação Técnica'},
    {'id': 'resumo-pastas', 'rotulo': 'Resumo de pastas', 'agente': 'Resumo de Pastas'},
    {'id': 'glossario', 'rotulo': 'Glossário', 'agente': 'Glossário'},
    {'id': 'indice-navegacao', 'rotulo': 'Índice de navegação', 'agente': 'Índice de Navegação'},
    {'id': 'pipeline', 'rotulo': 'Pipeline', 'agente': 'Pipeline'},
    {'id': 'bibliotecas', 'rotulo': 'Bibliotecas', 'agente': 'Bibliotecas'},
    {'id': 'comentarios', 'rotulo': 'Comentários', 'agente': 'Comentários'},
]
