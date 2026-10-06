"""Pipeline — a casca da rotina: o ciclo de uma passada, de baixo para cima.

O Pipeline tem quatro níveis (D14, D58, D59): áreas → blocos → cadeias →
passos, e a Visão geral por cima. A fonte é o grafo de chamadas, não prosa: o
programa monta a árvore inteira sem IA, e o modelo escreve só os textos —
nunca uma etapa, um arquivo ou um agrupamento.

| Arquivo                    | A pergunta que ele responde                              |
|----------------------------|------------------------------------------------------------|
| `pipeline_indice.py`       | a casca: o ciclo de uma passada e o status               |
| `pipeline_esqueleto.py`    | quais são as cadeias, e em que ordem (sem IA)            |
| `pipeline_comunidades.py`  | quem mora junto: blocos e áreas (sem IA)                 |
| `pipeline_passos.py`       | o prompt da cadeia: frase do passo, nome e resumo         |
| `pipeline_blocos.py`       | o prompt do bloco: nome, resumo e ligações (bloco e área) |
| `pipeline_gravacao.py`     | o `_niveis.json` e os `.md` de cada nível                 |
| `pipeline_constantes.py`   | as constantes de módulo dos seis                          |

Mixins compostos por herança, sem `__init__` nem `super()` — a casca é o que
`api.py` importa, e o endereço dela não muda.
"""
from ...constantes import *

from ..resumo_de_rotina import gravar_resumo_de_falha
from modulos.agentes.llm_estruturado import formato_garantido_indisponivel
from .pipeline_constantes import _PL_PROMPT_BLOCO
from .pipeline_esqueleto import PipelineEsqueletoMixin
from .pipeline_comunidades import PipelineComunidadesMixin
from .pipeline_passos import PipelinePassosMixin
from .pipeline_blocos import PipelineBlocosMixin
from .pipeline_gravacao import PipelineGravacaoMixin


class PipelineIndiceMixin(PipelineEsqueletoMixin, PipelineComunidadesMixin,
                          PipelinePassosMixin, PipelineBlocosMixin, PipelineGravacaoMixin):
    """Rotina Pipeline — o fluxo de execução do projeto, em níveis."""

    # O rastro NÃO conta as cadeias sozinho — ele diz QUE arquivo é um começo e
    # de que tipo. A ordem da lista é a ordem de prioridade: a primeira marca
    # que casar vence, porque um `.pyw` com `__main__` também tem `subprocess.`.
    _PL_RASTROS = [
        ('abertura',          '🚀', ('__main__', 'webview.start')),
        ('vigia',             '👁️', ('while True',)),
        ('processo externo',  '▶️', ('subprocess.',)),
        ('segundo plano',     '⚙️', ('threading.Thread(target=',)),
        ('clique do usuário', '🖱️', ("addEventListener('click'", 'addEventListener("click"')),
        ('tela → backend',    '🌉', ('pywebview.api.',)),
    ]

    def _pl_dir(self, project_name):
        return obter_pasta_da_rotina(project_name, 'pipeline')

    def _pl_notify(self, project_name, payload):
        # `project` no payload: o front ignora o evento quando este projeto
        # não é o exibido no momento (várias abas de projeto abertas).
        payload = {**payload, 'project': project_name}
        try:
            self.window.evaluate_js('pipelineAgentProgress(%s)' % json.dumps(payload))
        except Exception:
            pass

    def _pl_igual_ao_gerado(self, project_name, esqueleto_hash):
        """A árvore está igual à da última geração?

        Exige as TRÊS coisas: o hash bater, o `_niveis.json` existir e o
        `pipeline.md` existir. Só o hash não basta — quem apagou os dados
        gerados tem `_resumo.json` velho e nenhum `.md`, e pular ali deixaria
        o projeto sem pipeline para sempre.
        """
        try:
            pasta = self._pl_dir(project_name)
            for nome in ('_niveis.json', 'pipeline.md'):
                if not os.path.isfile(os.path.join(pasta, nome)):
                    return False
            with open(os.path.join(pasta, '_resumo.json'), 'r', encoding='utf-8') as f:
                return json.load(f).get('esqueleto_hash') == esqueleto_hash
        except Exception:
            return False

    def _pl_carimbar(self, project_name, esqueleto_hash):
        """Renova o `finished_at` sem regerar nada.

        ⚠️ Obrigatório ao pular. `_ac_get_resumo_time` lê exatamente
        `finished_at`, e `_ac_wait_done` conclui "rotina travada" quando o
        carimbo não anda — o ciclo pararia aqui e **tudo o que vem depois seria
        interrompido**, por causa de uma rotina que fez a coisa certa.
        """
        try:
            caminho = os.path.join(self._pl_dir(project_name), '_resumo.json')
            with open(caminho, 'r', encoding='utf-8') as f:
                dados = json.load(f)
            dados['finished_at'] = datetime.now().isoformat()
            dados['esqueleto_hash'] = esqueleto_hash
            dados['inalterado'] = True
            with open(caminho, 'w', encoding='utf-8') as f:
                json.dump(dados, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    def _pl_nada_a_fazer(self, project_name, esqueleto, prep, limites):
        """Nenhum nível tem o que mandar ao modelo, e a árvore é a mesma?"""
        if prep['pendentes']:
            return False
        for nivel in ('bloco', 'area'):
            if self._pl_preparar_nivel(esqueleto, nivel, prep, limites):
                return False
        return self._pl_igual_ao_gerado(project_name, prep['esqueleto_hash'])

    def run_pipeline_agent(self, project_name, model=None):
        """Uma passada da rotina Pipeline, numa thread.

        `model=None` é o único caminho desde 21/08/2026: o worker usa o modelo
        aberto no LM Studio (`_ac_get_current_model()`).

        A ordem é de baixo para cima (D14): passos e cadeias, depois blocos,
        depois áreas — um nível só vai ao modelo depois que o de baixo
        terminou. Tudo é gravado no fim; parada no meio não grava nada.
        """
        def worker():
            try:
                from ...llm_cliente import abrir_cliente_do_lm_studio
                escolhido = model or self._ac_get_current_model()
                if not escolhido:
                    raise ValueError('Nenhum modelo aberto no LM Studio.')
                settings = self.load_settings()['settings']
                client = abrir_cliente_do_lm_studio(settings, projeto=project_name, dono='pipeline')

                prompt_cadeia = self._load_prompt_template('pipeline')
                prompt_bloco = self._load_prompt_template(_PL_PROMPT_BLOCO)
                if not prompt_cadeia or not prompt_bloco:
                    raise ValueError('Prompt template "pipeline" ou "%s" não encontrado.'
                                     % _PL_PROMPT_BLOCO)
                limites = self.load_limites()['limites']

                # As etapas são anunciadas uma a uma: o grafo de chamadas pode
                # levar segundos (e o índice de símbolos, minutos, se precisar
                # ser construído), e tela muda durante esse tempo parece travada.
                self._pl_notify(project_name, {'status': 'running', 'etapa': 'Lendo o grafo de chamadas...'})
                esqueleto = self._pl_esqueleto(project_name,
                                               niveis=limites['pipeline_cadeia_niveis'])
                cadeias = esqueleto['cadeias']
                self._pl_notify(project_name, {'status': 'running',
                                 'etapa': '%d cadeias em %d blocos e %d áreas. Conferindo o que mudou...'
                                          % (len(cadeias), len(esqueleto['blocos']),
                                             len(esqueleto['areas']))})

                # ── SÓ O QUE MUDOU VAI AO MODELO ─────────────────────────────
                prep = self._pl_preparar(project_name, esqueleto, limites)
                esqueleto_hash = prep['esqueleto_hash']
                n = len({(p['origem'], p['destino'], p['via']) for c in cadeias for p in c['passos']})
                if self._pl_nada_a_fazer(project_name, esqueleto, prep, limites):
                    self._pl_carimbar(project_name, esqueleto_hash)
                    self._pl_notify(project_name, {'status': 'done', 'passos': n,
                                     'cadeias': len(cadeias), 'chars': 0,
                                     'inalterado': True})
                    return

                erros, gerados, chamadas = self._pl_gerar_pendentes(
                    project_name, prep, client, escolhido, settings, limites, prompt_cadeia)
                if self.rotina_parada(project_name, 'pipeline'):
                    return
                for nivel in ('bloco', 'area'):
                    pendentes = self._pl_preparar_nivel(esqueleto, nivel, prep, limites)
                    e, k = self._pl_gerar_nivel(project_name, esqueleto, nivel, pendentes, prep,
                                                client, escolhido, settings, limites, prompt_bloco)
                    erros += e
                    chamadas += k
                    if self.rotina_parada(project_name, 'pipeline'):
                        return

                niveis = self._pl_montar_niveis(esqueleto, prep)
                out_dir = self._pl_dir(project_name)
                os.makedirs(out_dir, exist_ok=True)
                chars = self._pl_gravar(project_name, niveis)
                self._pl_save_estado(project_name, self._pl_novo_estado(esqueleto, prep))
                contagem = niveis['contagem']
                with open(os.path.join(out_dir, '_resumo.json'), 'w', encoding='utf-8') as f:
                    json.dump({'finished_at': datetime.now().isoformat(),
                               'areas': contagem['areas'], 'blocos': contagem['blocos'],
                               'cadeias': contagem['cadeias'], 'passos': contagem['passos'],
                               'chars': chars,
                               # Com erro, o hash NÃO é gravado: a próxima
                               # passada não pode achar que está tudo em dia.
                               'esqueleto_hash': None if erros else esqueleto_hash,
                               'gerados': gerados, 'reaproveitados': prep['reaproveitados'],
                               'chamadas': chamadas, 'erros': erros,
                               'hubs': esqueleto['hubs'],
                               'codigo_morto': esqueleto['mortas']},
                              f, ensure_ascii=False, indent=2)

                self._pl_notify(project_name, {'status': 'done', 'passos': contagem['passos'],
                                 'cadeias': contagem['cadeias'], 'chars': chars,
                                 'gerados': gerados, 'reaproveitados': prep['reaproveitados'],
                                 'erros': erros,
                                 'aviso': formato_garantido_indisponivel()})
            except Exception as e:
                gravar_resumo_de_falha(project_name, 'pipeline', str(e))
                self._pl_notify(project_name, {'status': 'error', 'error': str(e)})

        # A referência da thread fica registrada: é o que deixa o ciclo
        # saber que esta rotina continua viva (ver processando.py).
        self._proc_iniciar(project_name, 'pipeline', worker)
        return {'success': True}

    def get_pipeline_status(self, project_name):
        """Existe pipeline gerado, e o que falhou na última passada.

        Os erros vão junto: a lista gravada no `_resumo.json` é a superfície
        da rotina, e fechar e reabrir o programa não pode apagar da vista o
        que falhou (ver `resumo_de_rotina.py`).
        """
        path = os.path.join(self._pl_dir(project_name), 'pipeline.md')
        erros, _ = self._erros_de_uma_rotina(project_name, 'pipeline')
        return {'success': True, 'exists': os.path.isfile(path), 'errors': erros}
