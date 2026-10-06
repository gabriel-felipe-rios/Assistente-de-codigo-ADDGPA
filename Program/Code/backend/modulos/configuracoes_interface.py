"""Duas escolhas que só mexem no que a tela faz: a ordem das abas e os mapas.

Nenhuma das duas muda o que o programa CALCULA — mudam o que ele DESENHA e em
que ordem. É esse o corte com `configuracoes_modelo.py`, onde toda chave altera
o que sai ou entra no modelo.

⚠️ A ORDEM DAS ABAS MORA EM ARQUIVO PRÓPRIO (`TAB_ORDER_FILE`), e não em
`settings.json`. Ela é uma lista que a tela reordena por arrasto, e gravá-la
junto do resto faria cada arrasto reescrever o arquivo inteiro de configuração.

⚠️ O DESEMPENHO DOS MAPAS É "QUANTO O DESENHO PODE PERDER DE QUALIDADE ENQUANTO
O USUÁRIO ARRASTA", e não uma qualidade fixa. O que se degrada é o quadro
intermediário; o desenho parado continua o mesmo.
"""

from .constantes import *


class ConfigsInterfaceMixin:

    def load_tab_order(self):
        if not os.path.exists(TAB_ORDER_FILE):
            return {'success': True, 'order': None}
        try:
            with open(TAB_ORDER_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return {'success': True, 'order': data}
        except Exception:
            return {'success': True, 'order': None}

    def save_tab_order(self, order):
        try:
            os.makedirs(CONFIGS_DIR, exist_ok=True)
            with open(TAB_ORDER_FILE, 'w', encoding='utf-8') as f:
                json.dump(order, f, ensure_ascii=False, indent=2)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}


    # ── Desempenho dos mapas ─────────────────────────────────────────────────
    # Quanto o desenho pode perder de qualidade ENQUANTO o usuario arrasta ou
    # amplia, para o gesto continuar liso. Isso e gosto e e maquina: o certo
    # depende do tamanho do projeto e do computador, entao quem regula e o
    # usuario, na aba Configuracoes — nao um numero chutado no codigo.
    #
    # Nao cabe em `_LIMITES_DEFAULTS`: `save_limites` faz `max(1, int(valor))`,
    # que destroi fracionario (0,5) e booleano (True vira 1, False vira 1).
    _RENDER_DEFAULTS = {
        'mov_resolucao':    0.5,    # resolucao com que pinta durante o movimento
        'mov_sem_rotulos':  True,   # some o nome dos arquivos
        'mov_sem_setas':    True,   # some a ponta de seta das ligacoes
        'mov_sem_contorno': True,   # some o contorno das caixas
        'mov_sem_ligacoes': False,  # some as proprias linhas
        'mov_sem_cor':      False,  # as caixas viram cinza
        # O destaque da selecao (ligacoes acesas, o resto escurecido) some
        # durante o gesto e volta ao soltar. Pedido em 26/09/2026: "tem
        # bastante coisa desenhada e eu arrasto, essas coisas continuam".
        'mov_sem_destaque': True,
        'lod_limite':       0.65,   # abaixo deste zoom, simplifica mesmo parado
        'margem':           0.5,    # quanto desenhar alem da tela, por lado
        # Com quantas ligacoes um arquivo vira hub escondido ao ABRIR o Impacto
        # das Ligacoes (D62: "tenho que ir diminuindo bastante ali no ocultar
        # hub"). O controle "Ocultar hub" da tela continua mudando na hora.
        'impacto_hub_max_ligacoes': 30,
        # Mapa em niveis: com quantos cartoes na tela o gesto passa a ser
        # pintado no esboco (canvas) em vez do DOM. 0 = sempre esboco.
        'niveis_cartoes': 120,
    }

    # Faixa aceita de cada numero. Um valor fora daqui nao e erro do usuario —
    # e slider adulterado ou arquivo editado a mao —, entao grampeia em vez de
    # recusar: resolucao 0 apagaria a tela, e margem 50 travaria tudo.
    _RENDER_FAIXAS = {
        'mov_resolucao': (0.25, 1.0),
        'lod_limite':    (0.30, 1.0),
        'margem':        (0.20, 1.5),
        # A faixa do controle "Ocultar hub" (5 a 120, onde 120 = desligado).
        'impacto_hub_max_ligacoes': (5, 115),
        'niveis_cartoes': (0, 2000),
    }

    def load_render_mapas(self):
        valores = dict(self._RENDER_DEFAULTS)
        try:
            if os.path.exists(RENDER_MAPAS_FILE):
                with open(RENDER_MAPAS_FILE, 'r', encoding='utf-8') as f:
                    salvos = json.load(f)
                for chave, padrao in self._RENDER_DEFAULTS.items():
                    if chave not in salvos:
                        continue
                    if isinstance(padrao, bool):
                        valores[chave] = bool(salvos[chave])
                    else:
                        lo, hi = self._RENDER_FAIXAS[chave]
                        valores[chave] = min(hi, max(lo, float(salvos[chave])))
        except Exception:
            pass
        return {'success': True, 'render': valores}

    def save_render_mapas(self, patch):
        try:
            valores = self.load_render_mapas()['render']
            for chave, valor in (patch or {}).items():
                padrao = self._RENDER_DEFAULTS.get(chave)
                if padrao is None and chave not in self._RENDER_DEFAULTS:
                    continue
                if isinstance(padrao, bool):
                    valores[chave] = bool(valor)
                else:
                    lo, hi = self._RENDER_FAIXAS[chave]
                    valores[chave] = min(hi, max(lo, float(valor)))
            os.makedirs(CONFIGS_DIR, exist_ok=True)
            with open(RENDER_MAPAS_FILE, 'w', encoding='utf-8') as f:
                json.dump(valores, f, ensure_ascii=False, indent=2)
            return {'success': True, 'render': valores}
        except Exception as e:
            return {'success': False, 'error': str(e)}

