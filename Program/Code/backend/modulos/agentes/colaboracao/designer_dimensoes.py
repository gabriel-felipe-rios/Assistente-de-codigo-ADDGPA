from ...constantes import *

# As cinco dimensões dentro do Designer, e as preferências que gravam a escolha.
#
# Não reabre pasta nenhuma: a leitura da biblioteca já existe em
# `modulos/estilos_e_cores.py` (Parte 2), e ela devolve nome + conteúdo + tags de
# todos os itens numa chamada por dimensão. Duplicar a leitura aqui daria dois
# caminhos para o mesmo disco, e eles divergiriam na primeira mudança de formato.
#
# Módulo próprio porque `designer.py` já estava no limite da AMF — este é o
# mesmo corte que separou `estilos_e_cores.py` de `arquivos.py`.

# As chaves das escolhas nas preferências, na ORDEM CANÔNICA. `unica` diz se a
# dimensão aceita uma escolha ou várias — é o que a tela usa para decidir entre
# trocar e alternar, e o que a montagem do prompt usa para iterar.
DIMENSOES_DO_DESIGNER = (
    {'dimensao': 'estilos',    'campo': 'estilo',     'bloco': 'estilo',     'rotulo': 'Estilos',              'unica': True},
    {'dimensao': 'cores',      'campo': 'cor',        'bloco': 'cor',        'rotulo': 'Cores',                'unica': True},
    {'dimensao': 'tipografia', 'campo': 'tipografia', 'bloco': 'tipografia', 'rotulo': 'Tipografia',           'unica': True},
    {'dimensao': 'texturas',   'campo': 'texturas',   'bloco': 'textura',    'rotulo': 'Texturas e materiais', 'unica': False},
    {'dimensao': 'animacoes',  'campo': 'animacoes',  'bloco': 'animacao',   'rotulo': 'Animações',            'unica': False},
)

# O bloco que entra em TODO pedido, tenha ou não dimensão escolhida.
BLOCO_DAS_REGRAS_INVIOLAVEIS = 'regras-invioláveis'

# O esqueleto de preferências. Projeto gravado antes desta obra tem só `estilo` e
# `cor`; a leitura completa o resto em vez de estourar.
PREFERENCIAS_VAZIAS = {
    'estilo': None, 'cor': None, 'tipografia': None,
    'texturas': [], 'animacoes': [], 'comentarios': {},
}


class DesignerDimensoesMixin:

    # ── Leitura das cinco dimensões ───────────────────────────────────────────

    def carregar_dimensoes_do_designer(self):
        """As cinco dimensões inteiras, uma chamada por dimensão.

        ⚠️ É uma chamada por DIMENSÃO, não por item. A versão antiga desta aba
        listava os arquivos e depois buscava o conteúdo de cada um separadamente:
        com as cinco dimensões populadas isso viraria 70+ idas e voltas pela ponte
        pywebview a cada abertura, e a janela congelava no meio.
        """
        saida = {}
        for d in DIMENSOES_DO_DESIGNER:
            r = self.carregar_estilos_e_cores(d['dimensao'])
            if not r.get('success'):
                return {'success': False, 'error': r.get('error', 'Erro ao ler a biblioteca.')}
            saida[d['dimensao']] = r
        return {'success': True, 'dimensoes': saida,
                'ordem': [dict(d) for d in DIMENSOES_DO_DESIGNER]}

    # ── Preferências por projeto ──────────────────────────────────────────────

    def _caminho_das_preferencias_do_designer(self, project_name):
        return obter_arquivo_de_preferencias_do_designer(project_name)

    @staticmethod
    def _normalizar_escolhas(gravado):
        """Sempre os seis campos, no tipo certo.

        ⚠️ Lê com `.get()` e completa a partir do esqueleto: projeto ou sessão
        gravados antes desta obra não têm os campos novos, e têm de abrir **sem
        erro**, com as dimensões novas vazias.
        """
        if not isinstance(gravado, dict):
            gravado = {}
        limpas = {}
        for campo, padrao in PREFERENCIAS_VAZIAS.items():
            valor = gravado.get(campo, padrao)
            if isinstance(padrao, list):
                limpas[campo] = [v for v in (valor or []) if isinstance(v, str) and v]
            elif isinstance(padrao, dict):
                limpas[campo] = {k: v for k, v in (valor or {}).items()
                                 if isinstance(k, str) and isinstance(v, str) and v.strip()}
            else:
                limpas[campo] = valor or None
        return limpas

    # ── O PADRÃO DO PROJETO ───────────────────────────────────────────────────
    #
    # ⚠️ Isto NÃO é o que a sessão aberta está usando. Desde 2026-08-25 as escolhas
    # que valem para uma geração são as **da sessão** — sessão nova nasce limpa.
    #
    # ⚠️ E, desde a 2ª rodada de correções do mesmo dia, **nenhuma tela chama estes
    # dois métodos**: os botões "Salvar como padrão do projeto" e "Usar o padrão do
    # projeto" saíram da aba Seleção a pedido do usuário — um padrão guardado que
    # compete com o estado da sessão obriga a saber qual dos dois está valendo.
    # Ficam aqui porque o `Preferências.json` de projetos existentes continua no
    # disco e legível; são dívida registrada, não descuido.

    def load_design_prefs(self, project_name):
        """O padrão do projeto, sempre com os seis campos preenchidos."""
        try:
            with open(self._caminho_das_preferencias_do_designer(project_name),
                      'r', encoding='utf-8') as f:
                gravado = json.load(f)
        except Exception:
            gravado = {}
        return {'success': True, 'prefs': self._normalizar_escolhas(gravado)}

    def save_design_prefs(self, project_name, prefs=None):
        """Grava o padrão do projeto: cinco dimensões e os comentários por item.

        Recebe o dicionário inteiro, e não um argumento por dimensão: com cinco
        delas mais os comentários a assinatura viraria ilegível, e acrescentar uma
        sexta obrigaria a mexer em todos os chamadores.
        """
        limpas = self._normalizar_escolhas(prefs)
        try:
            os.makedirs(obter_pasta_do_designer(project_name), exist_ok=True)
            with open(self._caminho_das_preferencias_do_designer(project_name),
                      'w', encoding='utf-8') as f:
                json.dump(limpas, f, ensure_ascii=False, indent=2)
        except Exception as e:
            return {'success': False, 'error': str(e)}
        return {'success': True, 'prefs': limpas}

    # ── AS ESCOLHAS DA SESSÃO ─────────────────────────────────────────────────
    #
    # São estas que a geração usa. Moram num campo `escolhas` dentro do arquivo da
    # própria sessão: assim duas sessões do mesmo projeto podem estar
    # experimentando combinações diferentes ao mesmo tempo, e uma **sessão nova
    # nasce limpa** em vez de herdar a escolha da anterior.

    def carregar_escolhas_da_sessao(self, project_name, chat_id):
        try:
            with open(self._design_chat_path(project_name, chat_id), 'r', encoding='utf-8') as f:
                dados = json.load(f)
        except Exception:
            dados = {}
        return {'success': True, 'escolhas': self._normalizar_escolhas(dados.get('escolhas'))}

    def salvar_escolhas_da_sessao(self, project_name, chat_id, escolhas=None):
        """Grava as escolhas DENTRO do arquivo da sessão, sem tocar nas mensagens."""
        caminho = self._design_chat_path(project_name, chat_id)
        limpas = self._normalizar_escolhas(escolhas)
        try:
            with open(caminho, 'r', encoding='utf-8') as f:
                dados = json.load(f)
            dados['escolhas'] = limpas
            with open(caminho, 'w', encoding='utf-8') as f:
                json.dump(dados, f, ensure_ascii=False, indent=2)
        except Exception as e:
            return {'success': False, 'error': str(e)}
        return {'success': True, 'escolhas': limpas}

    # ── Os itens escolhidos, já com conteúdo ──────────────────────────────────

    def _escolhas_do_designer(self, prefs):
        """[(linha da dimensão, item, comentário)] das escolhas que existem no disco.

        O item que sumiu da biblioteca depois de escolhido **não** entra em
        silêncio: sai na lista `sumiram`, e é o que faz o aviso da A8 acontecer em
        vez de o Designer gerar com cores inventadas sem dizer nada.
        """
        escolhidos, sumiram = [], []
        comentarios = prefs.get('comentarios') or {}
        for d in DIMENSOES_DO_DESIGNER:
            valor = prefs.get(d['campo'])
            alvos = [valor] if d['unica'] else list(valor or [])
            alvos = [a for a in alvos if a]
            if not alvos:
                continue
            catalogo = self._catalogo_da_dimensao(d['dimensao'])
            for alvo in alvos:
                item = catalogo.get(alvo)
                if item is None:
                    sumiram.append('%s → %s' % (d['dimensao'], alvo))
                    continue
                escolhidos.append((d, item, (comentarios.get(item['caminho']) or '').strip()))
        return escolhidos, sumiram

    def _catalogo_da_dimensao(self, dimensao):
        """Índice do que existe na dimensão, por chave de escolha.

        A chave é o `arquivo` nas quatro dimensões de tag e `Pasta/Arquivo` em
        Animações — uma animação só se identifica junto do evento em que roda.
        """
        r = self.carregar_estilos_e_cores(dimensao)
        catalogo = {}
        if not r.get('success'):
            return catalogo
        for item in r.get('itens') or []:
            catalogo[item['arquivo']] = item
        for grupo in r.get('grupos') or []:
            for item in grupo['itens']:
                catalogo['%s/%s' % (grupo['pasta'], item['arquivo'])] = dict(item, explicacao=grupo['explicacao'])
        return catalogo
