"""Cobertura dos agentes — quanto do projeto cada agente já cobriu.

Alimenta o Painel da aba Mapas. A regra de quem entra, enunciada pelo usuário:
**entra quem produz dado por arquivo; fica de fora quem produz um documento só.**

Por isso Glossário, Pipeline e Índice de navegação NÃO aparecem — os três geram
um documento único, e "50% de um documento" não quer dizer nada.

Cada medidor é um par feitos/total. Um agente cujo dado não puder ser calculado
devolve `total = 0`, e o painel mostra `—` em vez de fingir 0%: um medidor zerado
por falta de dado e um medidor zerado de verdade não são a mesma coisa.
"""

from ..constantes import *
# O gravador por substituição (`.tmp` + `os.replace`): o Painel pode ler no
# mesmo instante em que uma rotina regrava, e nunca pode ver meio arquivo.
from ..trabalhos_estado_gravacao import gravar_json_atomico


class CoberturaMixin:

    # Denominadores por agente. Cada um tem o seu porque cada agente varre um
    # conjunto diferente de extensões — usar um universo comum faria o Grafo de
    # imports parecer eternamente incompleto por causa dos .md e .json.
    # ⚠️ NÃO UNIFICAR com `CODE_EXTS` (analise.py) nem com `TEXT_EXTS`
    # (indexacao.py). São quatro conjuntos parecidos e DIFERENTES, com um núcleo
    # comum de 14 extensões; cada um acrescenta o que o cálculo dele precisa:
    #
    #   _COB_EXT_GRAFO           núcleo         o que o Grafo de Imports parseia
    #   _COB_EXT_IDENTIFICADORES núcleo +4      + .pyw .html .css .json
    #   CODE_EXTS (analise)      núcleo +3      + .rb .php .swift — "é código?"
    #   TEXT_EXTS (indexacao)    núcleo +2      + .html .css — onde um símbolo aparece
    #
    # Igualar qualquer par faz um agente reportar cobertura sobre arquivo que o
    # outro não consegue processar. Conferido em 20/08/2026, obra "Constantes e
    # código repetido".
    _COB_EXT_GRAFO = {'.py', '.js', '.jsx', '.ts', '.tsx', '.mts', '.cts', '.cs', '.java',
                      '.go', '.rs', '.c', '.cpp', '.cc', '.h', '.hpp'}
    _COB_EXT_IDENTIFICADORES = {'.py', '.pyw', '.js', '.jsx', '.ts', '.tsx', '.mts', '.cts',
                                '.cs', '.java', '.go', '.rs', '.c', '.cpp',
                                '.cc', '.h', '.hpp', '.html', '.css', '.json'}

    def _cob_universo(self, project_name):
        """Todos os arquivos das pastas de trabalho, pela chave do Hashes.

        Reaproveita `_hs_scan` de propósito: é a mesma varredura que decide o
        que o ciclo enxerga, então os denominadores daqui não podem divergir
        dela sem que um dos dois esteja mentindo.
        """
        return self._hs_scan(project_name) or {}

    @staticmethod
    def _cob_par(feitos, total):
        return {'feitos': int(feitos), 'total': int(total)}

    def _cob_doc_tecnica(self, project_name):
        r = self.preview_documentacao_tecnica_agent(project_name)
        if not r.get('success'):
            return self._cob_par(0, 0)
        files = r.get('files') or []
        return self._cob_par(sum(1 for f in files if f.get('processed')), len(files))

    def _cob_resumo_pastas(self, project_name):
        """Pastas com resumo gerado sobre pastas que deveriam ter um.

        O denominador vem de `_rp_pastas_do_codigo` — as pastas do código com
        arquivo elegível —, não da árvore da Documentação Técnica: uma pasta
        sem nenhuma documentação ainda conta como pasta descoberta.
        """
        pastas = self._rp_pastas_do_codigo(project_name)
        if not pastas:
            return self._cob_par(0, 0)
        out_dir = obter_pasta_da_rotina(project_name, 'resumo-pastas')
        feitos = 0
        for rel in pastas:
            base = os.path.join(out_dir, *rel.split('/'))
            # A pasta pode ter virado 'Pasta.md' ou 'Pasta (parte N).md'.
            if os.path.isfile(base + '.md'):
                feitos += 1
                continue
            pai = os.path.dirname(base)
            nome = os.path.basename(base)
            try:
                if any(f.startswith(nome + ' (parte ') and f.endswith('.md')
                       for f in os.listdir(pai)):
                    feitos += 1
            except Exception:
                pass
        return self._cob_par(feitos, len(pastas))

    def _cob_hashes(self, project_name, universo):
        salvos = self._hs_load(project_name)['arquivos']
        if not universo:
            return self._cob_par(0, 0)
        return self._cob_par(len(set(salvos) & set(universo)), len(universo))

    def _cob_por_extensao(self, universo, exts):
        return [k for k in universo if os.path.splitext(k)[1].lower() in exts]

    def _cob_identificadores(self, project_name, universo):
        alvo = self._cob_por_extensao(universo, self._COB_EXT_IDENTIFICADORES)
        if not alvo:
            return self._cob_par(0, 0)
        # Arquivos LIDOS, não arquivos presentes no índice: o índice só guarda
        # nome que aparece em mais de um arquivo, então um arquivo isolado é
        # lido e não deixa rastro nele. Medir pelo índice travava o medidor
        # abaixo de 100% para sempre. `list_arquivos_indexados` continua sendo
        # o certo para a aba Relações, que quer justamente as arestas.
        dados = self._id_load(project_name)
        lidos = set(dados.get('arquivos_escaneados') or [])
        if not lidos:
            # Índice antigo, gravado antes deste campo existir: cai no
            # comportamento anterior em vez de mostrar 0%.
            lidos = set(self.list_arquivos_indexados(project_name).get('arquivos') or [])
        # O índice guarda o caminho relativo à pasta de trabalho, sem a raiz;
        # a chave do universo tem a raiz na frente. Compara pelo sufixo.
        feitos = sum(1 for k in alvo
                     if k in lidos or k.split('/', 1)[-1] in lidos)
        return self._cob_par(feitos, len(alvo))

    def _cob_grafo_imports(self, project_name, universo):
        alvo = self._cob_por_extensao(universo, self._COB_EXT_GRAFO)
        if not alvo:
            return self._cob_par(0, 0)
        r = self.get_grafo_imports_status(project_name)
        if not r.get('exists'):
            return self._cob_par(0, len(alvo))
        # O grafo pode ter nós de arquivos que já sumiram; o teto é o universo.
        return self._cob_par(min(r.get('total_files', 0), len(alvo)), len(alvo))

    def _cob_embeddings(self, project_name):
        """Soma os DOIS índices semânticos (doc técnica, resumo).

        São bancos separados, mas para o painel são um agente só: o usuário
        quer saber se a busca semântica está em dia, não qual das duas fontes
        ficou para trás.
        """
        feitos = total = 0
        for tipo in ('documentacao-tecnica', 'resumo-pastas'):
            r = self.preview_embedding_agent(project_name, tipo)
            if not r.get('success'):
                continue
            t = r.get('total', 0)
            total += t
            feitos += max(0, t - r.get('to_process', 0))
        return self._cob_par(feitos, total)

    def get_cobertura_agentes(self, project_name):
        """Os seis medidores do Painel, numa chamada só.

        Cada agente é calculado dentro do seu próprio try: um agente que falhe
        vira `—` no painel sem derrubar os outros cinco.
        """
        universo = {}
        try:
            universo = self._cob_universo(project_name)
        except Exception:
            pass

        # ⚠️ NÃO DERIVAR de `IDS_DAS_ROTINAS`: são 6 dos 15 ids, de propósito.
        # Só entra rotina cuja cobertura dá para MEDIR contra um universo de
        # arquivos. Glossário, Índice de Navegação, Pipeline, Bibliotecas e
        # Sincronia produzem um artefato único do projeto inteiro — não há
        # "quantos dos N arquivos foram cobertos" para calcular.
        calculos = [
            ('doc-tecnica',      'Documentação Técnica',    lambda: self._cob_doc_tecnica(project_name)),
            ('resumo-pastas',    'Resumo de pastas',        lambda: self._cob_resumo_pastas(project_name)),
            ('hashes',           'Hashes',                  lambda: self._cob_hashes(project_name, universo)),
            ('identificadores',  'Índice de identificadores', lambda: self._cob_identificadores(project_name, universo)),
            ('grafo-imports',    'Grafo de imports',        lambda: self._cob_grafo_imports(project_name, universo)),
            ('embedding',        'Embeddings',              lambda: self._cob_embeddings(project_name)),
        ]

        medidores = []
        for agent_id, rotulo, calcular in calculos:
            try:
                par = calcular()
            except Exception:
                par = self._cob_par(0, 0)
            medidores.append({'id': agent_id, 'rotulo': rotulo, **par})

        return {'success': True, 'medidores': medidores}

    # ── A cobertura GRAVADA (Mapas › Painel abre na hora) ──────────────────────
    # `get_cobertura_agentes` varre o disco (`_hs_scan`) e abre cinco artefatos.
    # Era chamada a CADA clique no Painel. Agora ela roda quando o número pode
    # ter mudado — no fim de uma rotina que mexe num medidor — e o Painel lê o
    # que ficou gravado.

    # As rotinas cujo fim pode mudar um dos seis medidores. Só depois delas a
    # cobertura é regravada: as outras nove não mexem em nenhum.
    _COB_ROTINAS = ('doc-tecnica', 'resumo-pastas', 'hashes', 'identificadores',
                    'grafo-imports', 'embedding')

    def gravar_cobertura_agentes(self, project_name):
        """Calcula os seis medidores e grava em `Automação/Rotinas/Cobertura.json`.

        Devolve o que gravou: `{'gravado_em': iso, 'medidores': [...]}`.
        """
        r = self.get_cobertura_agentes(project_name)
        dados = {'gravado_em': datetime.now().isoformat(timespec='seconds'),
                 'medidores': r.get('medidores') or []}
        gravar_json_atomico(obter_arquivo_de_cobertura_das_rotinas(project_name), dados)
        return dados

    def ler_cobertura_agentes(self, project_name):
        """O que o Painel de Mapas lê: a cobertura GRAVADA, sem varrer nada.

        ⚠️ Só na primeira vez de um projeto — o arquivo ainda não existe — ela
        calcula e grava. Depois quem regrava é o fim de cada rotina que mexe
        num medidor (`_cob_gravar_em_segundo_plano`) e o "Limpar dados gerados".
        """
        caminho = obter_arquivo_de_cobertura_das_rotinas(project_name)
        try:
            with open(caminho, 'r', encoding='utf-8') as f:
                dados = json.load(f)
            if isinstance(dados, dict) and isinstance(dados.get('medidores'), list):
                return {'success': True, **dados}
        except Exception:
            pass
        try:
            return {'success': True, **self.gravar_cobertura_agentes(project_name)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _cob_gravar_em_segundo_plano(self, project_name, agent_id=None):
        """Regrava a cobertura numa thread à parte, sem segurar quem chamou.

        `agent_id` = a rotina que acabou de terminar; fora de `_COB_ROTINAS`
        não há o que regravar. `None` = regrave sempre (o "Limpar dados gerados").
        """
        if agent_id is not None and agent_id not in self._COB_ROTINAS:
            return

        def _gravar():
            try:
                self.gravar_cobertura_agentes(project_name)
            except Exception:
                pass
        threading.Thread(target=_gravar, daemon=True,
                         name=f'cobertura-{project_name}').start()
