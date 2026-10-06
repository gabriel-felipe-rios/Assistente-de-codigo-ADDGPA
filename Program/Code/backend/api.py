import threading

from modulos.constantes import *
from modulos.projetos import ProjetosMixin
from modulos.configuracoes import ConfigsMixin
from modulos.explorer import ExplorerMixin
from modulos.workspace import WorkspaceMixin
from modulos.arquivos import ArquivosMixin
from modulos.migracao_assistentes import MigracaoAssistentesMixin
from modulos.arquivos_agentes import ArquivosAgentesMixin
from modulos.estilos_e_cores import EstilosECoresMixin
from modulos.estilos_e_cores_crud import EstilosECoresCrudMixin
from modulos.estilos_e_cores_moldes import MoldesDeEstilosECoresMixin
from modulos.chat_persistencia import ChatPersistenciaMixin
from modulos.chat_mensagem import ChatMensagemMixin
from modulos.contexto import ContextoMixin
from modulos.analise import AnaliseMixin
from modulos.indexacao import IndexacaoMixin
from modulos.analise_grafo import AnáliseGrafoMixin
from modulos.complexidade import ComplexidadeMixin
from modulos.agentes.rotinas_leitura import RotinasLeituraMixin
from modulos.agentes.indexacao.hashes import HashesMixin
from modulos.agentes.indexacao.identificadores import IdentificadoresMixin
from modulos.agentes.indexacao.indice_navegacao import IndiceNavegacaoMixin
from modulos.agentes.indexacao.bibliotecas import BibliotecasMixin
from modulos.agentes.indexacao.comentarios import ComentariosMixin
from modulos.agentes.indexacao.indice_simbolos import IndiceSimbolosMixin
from modulos.agentes.indexacao.glossario_indice import GlossarioIndiceMixin
from modulos.agentes.indexacao.pipeline_indice import PipelineIndiceMixin
from modulos.agentes.colaboracao.designer import DesignerMixin
from modulos.agentes.colaboracao.designer_dimensoes import DesignerDimensoesMixin
from modulos.agentes.colaboracao.designer_prompt import DesignerPromptMixin
from modulos.agentes.colaboracao.designer_contexto import DesignerContextoMixin
from modulos.mapas_pipeline import VisualizarPipelineMixin
from modulos.mapas_pipeline_niveis import MapaNiveisMixin
from modulos.agentes.documentacao.resumo_pastas import ResumoPastasMixin
from modulos.agentes.documentacao.documentacao_tecnica_render import DocumentacaoTecnicaRenderMixin
from modulos.agentes.documentacao.documentacao_tecnica_llm import DocumentacaoTecnicaLlmMixin
from modulos.agentes.documentacao.documentacao_tecnica import DocumentacaoTecnicaMixin
from modulos.agentes.embedding import EmbeddingMixin
from modulos.agentes.duplicados import DuplicadosMixin
from modulos.agentes.arquivos_grandes import ArquivosGrandesMixin
from modulos.agentes.erros_das_rotinas import ErrosDasRotinasMixin
from modulos.agentes.cobertura import CoberturaMixin
from modulos.agentes.processando import ProcessandoMixin
from modulos.agentes.automacao.detector import DetectorMixin
from modulos.agentes.automacao.detector_vigia import DetectorVigiaMixin
from modulos.agentes.automacao.detector_classes import DetectorClassesMixin
from modulos.agentes.automacao.detector_impressoes import DetectorImpressoesMixin
from modulos.agentes.automacao.detector_pedacos import DetectorPedacosMixin
from modulos.agentes.automacao.detector_reguas import DetectorReguasMixin
from modulos.agentes.automacao.acionamentos_config import AcionamentosConfigMixin
from modulos.agentes.automacao.rotinas_clique import RotinasCliqueMixin
from modulos.agentes.automacao.acionamentos_espera import AcionamentosEsperaMixin
from modulos.agentes.automacao.acionamentos_pipeline import AcionamentosPipelineMixin
from modulos.agentes.automacao.rotinas_pendencias import RotinasPendenciasMixin
from modulos.agentes.automacao.historico import HistoricoDasRotinasMixin
from modulos.agentes.sincronia.sincronia import SincroniaMixin
from modulos.agentes.rotinas_config import RotinasConfigMixin
from modulos.agentes.trava_ia import TravaIAMixin
from modulos.agentes.parada_do_projeto import ParadaDoProjetoMixin
from modulos.agentes.execucao.subagentes import SubagentesMixin
from modulos.agentes.ferramentas_subagentes import FerramentasSubagentesMixin
from modulos.agentes.fila.estado import FilaEstadoMixin
from modulos.agentes.fila.execucao import FilaExecucaoMixin
from modulos.agentes.fila.relatorio import FilaRelatorioMixin
from modulos.documentacao import DocumentacaoMixin
# Aba Editor. `editor_arvore` traz `_ed_raiz`/`_ed_absoluto`/`_ed_visivel`, que
# os outros dois usam — a ordem dos imports não importa (herança múltipla
# resolve na classe), mas a leitura fica mais fácil com a base primeiro.
from modulos.editor_arvore import EditorArvoreMixin
from modulos.editor import EditorMixin
from modulos.editor_historico import EditorHistoricoMixin
from modulos.editor_arquivos import EditorArquivosMixin
from modulos.editor_binarios import EditorBinariosMixin
from modulos.regras import RegrasMixin
from modulos.terminal import TerminalMixin
from modulos.trabalhos_estado import TrabalhosEstadoMixin
from modulos.trabalhos_config import TrabalhosConfigMixin
from modulos.trabalhos_verificacao import TrabalhosVerificacaoMixin
from modulos.trabalhos_layout import TrabalhosLayoutMixin
from modulos.trabalhos_terminais import TrabalhosTerminaisMixin
from modulos.trabalhos_shell import TrabalhosShellMixin
from modulos.trabalhos_conexoes import TrabalhosConexoesMixin
from modulos.trabalhos_material import TrabalhosMaterialMixin
from modulos.trabalhos_fluxo import TrabalhosFluxoMixin
from modulos.trabalhos_fluxos_salvos import TrabalhosFluxosSalvosMixin
from modulos.trabalhos_presets import TrabalhosPresetsMixin
from modulos.inspetor import InspetorMixin
from modulos.inspetor_gravacao import InspetorGravacaoMixin
from modulos.inspetor_gravacao_teia import InspetorGravacaoTeiaMixin
from modulos.aparencia import AparenciaMixin
# `ConfigsAparenciaMixin` saiu em 23/09/2026 com a categoria "Aparência: onde
# procurar" — as duas listas dela são linhas de Arquivos que o programa lê.
from modulos.backups import BackupsMixin
from modulos.backups_reverter import BackupsReverterMixin
from modulos.backups_mapa import BackupsMapaMixin
from modulos.backups_mapa_ligacoes import BackupsMapaLigacoesMixin
from modulos.backups_mapa_pipeline import BackupsMapaPipelineMixin
from modulos.plugins import PluginsMixin
from modulos.projetos_grupos import ProjetosGruposMixin
from modulos.projetos_descricoes import ProjetosDescricoesMixin
from modulos.atalhos_externos import AtalhosExternosMixin
# G4 · abrir endereço no navegador, com tamanho — serviço para toda extensão.
from modulos.navegador import NavegadorMixin
# Extensões do programa — a camada que deixa uma pasta de
# `External/extensions/` MUDAR o comportamento do programa (ao contrário do
# plugin, que só lê). Um arquivo por assunto, como em `modulos/agentes/`.
from modulos.extensoes.descoberta import XtDescobertaMixin
from modulos.extensoes.estado import XtEstadoMixin
from modulos.extensoes.ponte import XtPonteMixin
from modulos.extensoes.boot import XtBootMixin
from modulos.extensoes.tela import XtTelaMixin
from modulos.extensoes.dados import XtDadosMixin
from modulos.extensoes.encaixes import XtEncaixesMixin
from modulos.extensoes.eventos import XtEventosMixin
from modulos.extensoes.consulta import XtConsultaMixin


class Api(
    ProjetosMixin, ConfigsMixin, ExplorerMixin, WorkspaceMixin,
    ArquivosMixin, ArquivosAgentesMixin, EstilosECoresMixin, EstilosECoresCrudMixin, MoldesDeEstilosECoresMixin,
    ChatPersistenciaMixin, ChatMensagemMixin, ContextoMixin, AnaliseMixin,
    IndexacaoMixin, AnáliseGrafoMixin, ComplexidadeMixin, RotinasLeituraMixin, GlossarioIndiceMixin, PipelineIndiceMixin,
    HashesMixin, IdentificadoresMixin, IndiceNavegacaoMixin, BibliotecasMixin, ComentariosMixin, IndiceSimbolosMixin,
    DesignerMixin, DesignerDimensoesMixin, DesignerPromptMixin, DesignerContextoMixin,
    VisualizarPipelineMixin, MapaNiveisMixin, ResumoPastasMixin,
    DocumentacaoTecnicaRenderMixin, DocumentacaoTecnicaLlmMixin, DocumentacaoTecnicaMixin,
    EmbeddingMixin, DuplicadosMixin, ArquivosGrandesMixin, ErrosDasRotinasMixin, CoberturaMixin, ProcessandoMixin, DetectorMixin, DetectorVigiaMixin,
    DetectorClassesMixin, DetectorImpressoesMixin,
    DetectorPedacosMixin, DetectorReguasMixin,
    AcionamentosConfigMixin, AcionamentosEsperaMixin, AcionamentosPipelineMixin,
    RotinasCliqueMixin,
    RotinasConfigMixin, RotinasPendenciasMixin, HistoricoDasRotinasMixin, SincroniaMixin, DocumentacaoMixin, RegrasMixin,
    EditorArvoreMixin, EditorMixin, EditorHistoricoMixin,
    EditorArquivosMixin, EditorBinariosMixin,
    SubagentesMixin, FerramentasSubagentesMixin, FilaEstadoMixin, FilaExecucaoMixin, FilaRelatorioMixin, TerminalMixin,
    TrabalhosEstadoMixin, TrabalhosConfigMixin, TrabalhosVerificacaoMixin,
    TrabalhosLayoutMixin, TrabalhosTerminaisMixin,
    TrabalhosShellMixin, TrabalhosConexoesMixin, TrabalhosPresetsMixin,
    TrabalhosMaterialMixin,
    TrabalhosFluxoMixin, TrabalhosFluxosSalvosMixin,
    InspetorMixin, InspetorGravacaoMixin, InspetorGravacaoTeiaMixin, AparenciaMixin, BackupsMixin, BackupsReverterMixin,
    BackupsMapaMixin, BackupsMapaLigacoesMixin, BackupsMapaPipelineMixin,
    TravaIAMixin, ParadaDoProjetoMixin, PluginsMixin, AtalhosExternosMixin, NavegadorMixin,
    XtDescobertaMixin, XtEstadoMixin, XtPonteMixin, XtBootMixin, XtTelaMixin, XtDadosMixin,
    XtEncaixesMixin, XtEventosMixin, XtConsultaMixin,
    ProjetosGruposMixin, ProjetosDescricoesMixin,
    MigracaoAssistentesMixin
):
    def __init__(self, ligar_extensoes=True):
        self.window = None
        self._drag_paths = []
        self._drag_cursor = None
        self._drag_lock  = threading.Lock()
        self._ac_esperas = {}
        # Os campos de `processando.py` nascem juntos ou nao nascem. Criar so
        # alguns aqui foi o que matou o sinal de vida das rotinas: a
        # inicializacao preguicosa via `_processando` ja existindo e pulava,
        # `_proc_sinal` nunca era criado, e o ciclo desistia de cada rotina
        # lenta aos 5 minutos.
        #
        # ⚠️ Aqui e so o TOPO (indexado por projeto) — nao ha `project_name`
        # ainda neste ponto do `__init__`, antes de qualquer projeto ser
        # aberto. `_proc_state(project_name)` cria a entrada de CADA projeto,
        # sob demanda, na mesma guarda.
        self._processando = {}
        self._proc_sinal = {}
        self._proc_fila = {}
        self._proc_threads = {}
        self._proc_lock = threading.Lock()
        # A fila de partidas de ciclo, por projeto. Nasce aqui, e não por
        # `hasattr` preguiçoso lá dentro, porque quem a lê são threads de
        # projetos diferentes ao mesmo tempo — duas criações concorrentes
        # dariam dois conjuntos, e a guarda de "um ciclo por projeto" deixaria
        # de valer justamente no caso que ela existe para cobrir.
        # Ver `_ac_reservar_partida`, em agentes/automacao/acionamentos_espera.py.
        self._ac_partidas = set()
        self._ac_partidas_lock = threading.Lock()
        self._start_drag_monitor()
        # Plugins ATIVOS (D5) carregam sozinhos aqui — uma vez, no boot, só
        # os que estiverem ligados. Nunca pode derrubar a abertura do
        # programa: qualquer falha de um plugin fica isolada dentro do
        # próprio método.
        # A migracao das tres chaves velhas para a lista unica de assistentes
        # externos. Roda UMA vez — o marcador e a presenca das chaves velhas —
        # e, como o carregamento de plugins, nunca pode derrubar a abertura do
        # programa: uma falha aqui deixa o `settings.json` como estava.
        #
        # Antes dela, os arquivos de configuração que só mudaram de nome com a
        # divisão por categoria (23/09/2026). Calada de propósito: este
        # construtor roda também dentro dos servidores MCP, cujo stdout é o
        # canal do protocolo.
        try:
            from modulos.configuracoes_arquivos import migrar_nomes_de_config
            migrar_nomes_de_config()
        except Exception:
            pass
        try:
            r = self.migrar_assistentes_externos()
            if r.get('migrado'):
                print('[migracao] assistentes externos:', r.get('assistentes'))
                for aviso in (r.get('avisos') or []):
                    print('[migracao]  aviso:', aviso)
            elif not r.get('success'):
                print('[migracao] NAO migrou:', r.get('error'))
        except Exception as e:
            print('[migracao] falha ao migrar assistentes externos:', e)

        try:
            self._iniciar_plugins_ativos()
        except Exception as e:
            print('[plugins] falha ao iniciar plugins ativos:', e)

        # As extensões ATIVAS carregam aqui, logo depois dos plugins e com o
        # mesmo isolamento. A diferença: `iniciar()` de uma extensão roda em
        # THREAD (ver `extensoes/boot.py`), então nada aqui pode atrasar a
        # abertura da janela — nem uma extensão que dorme trinta segundos.
        #
        # G11 · Dentro dos MCPs Assistente e Trabalhos as extensões NÃO
        # ligam: cada MCP subia uma cópia de toda extensão ligada (um
        # segundo servidor na mesma porta, `print` no canal JSON-RPC).
        # O programa (`.pyw`) chama `Api()` e continua ligando. O sinal não
        # vira atributo público: o pywebview varre os públicos do `js_api`.
        if ligar_extensoes:
            try:
                self._iniciar_extensoes_ativas()
            except Exception as e:
                print('[extensoes] falha ao iniciar extensoes ativas:', e)
