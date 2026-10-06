"""Arquivos que o programa lê — global, valendo para todos os projetos.

Quatro vistas; UM ARQUIVO POR VISTA QUE GRAVA (D12), para dar para editar à mão:

| Vista | Arquivo | Responde |
|---|---|---|
| Nunca ler | `NUNCA_LER_FILE` | o que o programa nem enxerga — pasta, arquivo, extensão |
| O que é código | `O_QUE_E_CODIGO_FILE` | linguagens (com as extensões delas), formatos especiais, extensões soltas |
| Exceções | `EXCECOES_FILE` | de que lista cada parte parte, e o que ela acrescenta e retira (ver `configuracoes_extensoes_excecoes.py`) |
| Quem lê o quê | — | só leitura: a tabela é escrita pela tela, não há dado |

Até a fase 06 da obra «Qualidade da documentação» (2026-09) a terceira vista
era Quem lê o quê, com listas próprias, em `QUEM_LE_O_QUE_FILE`. Sem o
arquivo de Exceções, `_vistas()` lê aquele, e `_normalizar_excecoes` converte.

⚠️ METADE DESTE ARQUIVO FICA FORA DA CLASSE, e isso é a razão de ele existir
separado. `linguagens.py` e `ignorados.py` precisam destes valores e NÃO têm
instância do Mixin — são módulos puros, chamados de dentro de laços de
varredura.

⚠️ `ler_extensoes()` E `excecao_de()` CONTINUAM DEVOLVENDO A FORMA ANTIGA
(`contadas`, `extras`, as três listas de ignorados, `excecoes`), montada a
partir das três vistas. `ignorados.py`, `linguagens.py`, `indexacao.py`,
`aparencia.py` e o grep dos subagentes os importam de `modulos.configuracoes`
(reexportado por `import *`) — mudar o CONTEÚDO é seguro, mudar a FORMA os
quebra calados.

⚠️ O CACHE NÃO É OTIMIZAÇÃO PREMATURA. `fora_do_programa` pergunta três vezes
por pasta e `conta_como_codigo` duas por arquivo, num projeto inteiro. O disco
é conferido no máximo a cada `_INTERVALO_DE_CONFERENCIA` segundos; quem grava
pela tela chama `_invalidar_cache_extensoes` e vale na hora. Um JSON editado à
mão vale na conferência seguinte.

⚠️ MIGRAÇÃO NA MEMÓRIA. Vista cujo arquivo não existe sai dos arquivos antigos
(`extensoes.json` com forma de ignorados + `aparencia.json`), pelo irmão
`configuracoes_extensoes_migracao.py`; sem eles, do padrão de fábrica. A
gravação de verdade da migração é no boot
(`configuracoes_arquivos.migrar_nomes_de_config`).
"""

import time

from .constantes import *
from .arvore_externa import gravar_json_de_config
# No topo, e é seguro: o irmão das Exceções só importa daqui DENTRO das
# funções (ver o aviso no cabeçalho dele).
from .configuracoes_extensoes_excecoes import (padrao_excecoes, bases_das_excecoes,
                                               _normalizar_excecoes)

# As três listas de "Nunca ler". São as mesmas chaves do `extensoes.json`
# antigo — os quatro plugins que leem a lista pelo caminho só trocaram o nome
# do arquivo.
NUNCA_LER_LISTAS = ('pastas_ignoradas', 'arquivos_ignorados', 'extensoes_ignoradas')

_INTERVALO_DE_CONFERENCIA = 0.5   # segundos entre duas idas ao disco

_CACHE = {'assinatura': None, 'dados': None, 'visto': 0.0}


def _invalidar_cache_extensoes():
    """Descarta o cache — quem grava ou apaga um dos arquivos chama isto."""
    _CACHE['assinatura'] = None
    _CACHE['dados'] = None
    _CACHE['visto'] = 0.0


# ═════════════════ Normalização — extensão sempre `lower()` e com ponto

def _ext(item):
    """`'PNG'`, `'.png'` e `' png '` viram `'.png'`; lixo vira `None`."""
    if not isinstance(item, str):
        return None
    item = item.strip().lower()
    if not item:
        return None
    return item if item.startswith('.') else '.' + item


def _lista_de_ext(valor):
    """Lista de extensões normalizada e sem repetição, ou `None` se não é lista."""
    if not isinstance(valor, list):
        return None
    saida = []
    for item in valor:
        ext = _ext(item)
        if ext and ext not in saida:
            saida.append(ext)
    return saida


def _lista_de_nomes(valor):
    """Nome de pasta ou arquivo: `strip()`, e a CAIXA INTOCADA.

    ⚠️ A comparação em `ignorados.py` é sensível a maiúsculas de propósito: o
    usuário quis poder deixar uma variação de fora. Quem gera as variações é a
    tela, uma entrada por vez.
    """
    if not isinstance(valor, list):
        return None
    saida = []
    for item in valor:
        if isinstance(item, str) and item.strip() and item.strip() not in saida:
            saida.append(item.strip())
    return saida


# ═════════════════ Padrões de fábrica — os números de antes da fase, mais .mts/.cts

def padrao_nunca_ler():
    """⚠️ A semente de extensões é `BINARY_EXTS` INTEIRA, imagem e mídia
    inclusive — decisão do usuário em 21/08/2026, já sabendo que `.png` e
    `.mp4` somem do número "Arquivos". A busca visual ganha desta lista (ver
    `configuracoes_aparencia.py`)."""
    from modulos.agentes.ferramentas_subagentes import BINARY_EXTS
    return {
        # As oito de sempre, e desde a fase 06 da obra «Qualidade da
        # documentação» (D40) mais três grupos: cache e ferramentas, editores,
        # saída de build. `target`, `bin`, `obj` e `out` ficam de FORA de
        # propósito — são nomes comuns demais para pasta de código de verdade.
        'pastas_ignoradas': ['node_modules', '.git', '__pycache__', '.venv',
                             'venv', 'dist', 'build', '.next',
                             # cache e ferramentas
                             '.pytest_cache', '.mypy_cache', '.ruff_cache', '.tox',
                             '.cache', '.turbo', '.parcel-cache', '.gradle',
                             '.dart_tool',
                             # editores
                             '.idea', '.vscode',
                             # saída de build
                             '.svelte-kit', '.nuxt', 'coverage', 'htmlcov'],
        'arquivos_ignorados': ['package-lock.json', 'yarn.lock'],
        'extensoes_ignoradas': sorted(BINARY_EXTS),
    }


def padrao_o_que_e_codigo():
    """Os grupos de `linguagens.py`, separados em linguagens e formatos.

    A lista de código de fábrica é a de sempre (`todas_extensoes()` mais
    `.toml`, `.ini`, `.txt`, que já estão nos formatos) — para quem nunca abriu
    a tela, o que muda é o que entrou depois: `.mts`/`.cts` (D50 da obra de
    23/09/2026) e, desde a fase 06 da obra «Qualidade da documentação»,
    `.pyi`, Vue, Svelte, Astro, Dart, Lua e `.jsonc` (D41).
    """
    from modulos.linguagens import LANGUAGE_GROUPS, GRUPO_DOS_FORMATOS
    linguagens, formatos = [], []
    for grupo in LANGUAGE_GROUPS:
        if grupo['label'] == GRUPO_DOS_FORMATOS:
            formatos.extend(grupo['exts'])
        else:
            linguagens.append({'nome': grupo['label'], 'extensoes': list(grupo['exts'])})
    return {'linguagens': linguagens, 'formatos_especiais': formatos,
            'extensoes_soltas': [], 'desmarcadas': []}


def _normalizar_nunca_ler(dados):
    dados = dados if isinstance(dados, dict) else {}
    padrao = padrao_nunca_ler()
    saida = {}
    for chave in NUNCA_LER_LISTAS:
        ler = _lista_de_ext if chave == 'extensoes_ignoradas' else _lista_de_nomes
        valor = ler(dados.get(chave))
        saida[chave] = valor if valor is not None else padrao[chave]
    return saida


def _normalizar_o_que_e_codigo(dados):
    """Uma extensão mora num lugar só: a primeira ocorrência vence, na ordem
    linguagens → formatos → soltas. Nome de linguagem repetido (sem diferenciar
    caixa) junta as extensões na primeira."""
    dados = dados if isinstance(dados, dict) else {}
    padrao = padrao_o_que_e_codigo()
    vistas = set()

    def so_novas(lista):
        saida = []
        for ext in lista or []:
            if ext not in vistas:
                vistas.add(ext)
                saida.append(ext)
        return saida

    linguagens = []
    brutas = dados.get('linguagens')
    if not isinstance(brutas, list):
        brutas = padrao['linguagens']
    por_nome = {}
    for item in brutas:
        if not isinstance(item, dict) or not isinstance(item.get('nome'), str):
            continue
        nome = item['nome'].strip()
        if not nome:
            continue
        exts = so_novas(_lista_de_ext(item.get('extensoes')) or [])
        if nome.lower() in por_nome:
            por_nome[nome.lower()]['extensoes'].extend(exts)
            continue
        linguagem = {'nome': nome, 'extensoes': exts}
        por_nome[nome.lower()] = linguagem
        linguagens.append(linguagem)

    formatos = _lista_de_ext(dados.get('formatos_especiais'))
    formatos = so_novas(formatos if formatos is not None else padrao['formatos_especiais'])
    soltas = so_novas(_lista_de_ext(dados.get('extensoes_soltas')) or [])
    desmarcadas = [e for e in (_lista_de_ext(dados.get('desmarcadas')) or []) if e in vistas]
    return {'linguagens': linguagens, 'formatos_especiais': formatos,
            'extensoes_soltas': soltas, 'desmarcadas': desmarcadas}


# ⚠️ A ORDEM IMPORTA: `_vistas()` percorre `_ARQUIVOS_DAS_VISTAS` em ordem, e
# Exceções precisa de O que é código já lida (a base da Documentação Técnica
# é a lista de código).
_NORMALIZADORES = {
    'nunca_ler': _normalizar_nunca_ler,
    'o_que_e_codigo': _normalizar_o_que_e_codigo,
    'excecoes': _normalizar_excecoes,
}
_ARQUIVOS_DAS_VISTAS = {
    'nunca_ler': NUNCA_LER_FILE,
    'o_que_e_codigo': O_QUE_E_CODIGO_FILE,
    'excecoes': EXCECOES_FILE,
}


# ═════════════════ Leitura — nível de módulo

def _assinatura():
    marcas = []
    for caminho in (NUNCA_LER_FILE, O_QUE_E_CODIGO_FILE, EXCECOES_FILE,
                    QUEM_LE_O_QUE_FILE, EXTENSOES_IGNORADOS_ANTIGO_FILE,
                    APARENCIA_ANTIGO_FILE):
        try:
            st = os.stat(caminho)
            marcas.append((st.st_mtime_ns, st.st_size))
        except OSError:
            marcas.append(None)
    return tuple(marcas)


def _vistas():
    """As três vistas, mais a forma antiga montada delas. Nunca levanta."""
    agora = time.monotonic()
    if (_CACHE['dados'] is not None
            and agora - _CACHE['visto'] < _INTERVALO_DE_CONFERENCIA):
        return _CACHE['dados']
    assinatura = _assinatura()
    if _CACHE['dados'] is not None and _CACHE['assinatura'] == assinatura:
        _CACHE['visto'] = agora
        return _CACHE['dados']

    # Preguiçoso: o irmão da migração importa daqui (os padrões e os normalizadores).
    from .configuracoes_extensoes_migracao import _ler_json_solto, migrar_da_forma_antiga
    vistas, migradas = {}, None
    for vista, caminho in _ARQUIVOS_DAS_VISTAS.items():
        dado = _ler_json_solto(caminho) if os.path.exists(caminho) else None
        if dado is None and vista == 'excecoes' and os.path.exists(QUEM_LE_O_QUE_FILE):
            # Até a fase 06 esta vista era Quem lê o quê, noutro arquivo e com
            # listas próprias — `_normalizar_excecoes` entende as duas formas.
            dado = _ler_json_solto(QUEM_LE_O_QUE_FILE)
        if dado is not None:
            # Exceções recebe O que é código JÁ LIDA (a ordem do dicionário
            # garante que ela veio antes): ler de novo daqui seria recursão.
            vistas[vista] = (_normalizar_excecoes(dado, vistas['o_que_e_codigo'])
                             if vista == 'excecoes' else _NORMALIZADORES[vista](dado))
            continue
        if migradas is None:
            migradas = migrar_da_forma_antiga(
                _ler_json_solto(EXTENSOES_IGNORADOS_ANTIGO_FILE),
                _ler_json_solto(APARENCIA_ANTIGO_FILE))
        vistas[vista] = migradas[vista]
    vistas['forma_antiga'] = _montar_forma_antiga(vistas)

    _CACHE.update(assinatura=assinatura, dados=vistas, visto=agora)
    return vistas


def lista_de_codigo(codigo=None):
    """O que conta como código: linguagens + formatos + soltas − desmarcadas."""
    codigo = codigo or ler_o_que_e_codigo()
    todas = ([e for l in codigo['linguagens'] for e in l['extensoes']]
             + codigo['formatos_especiais'] + codigo['extensoes_soltas'])
    fora = set(codigo['desmarcadas'])
    return [e for e in todas if e not in fora]


def _montar_forma_antiga(vistas):
    # Só a coluna `agentes` sobrou: a `usos` deixou de existir na fase 06 da
    # obra «Qualidade da documentação» — `indexacao.find_symbol_usages` lê a
    # parte Busca de usos das Exceções (`lista_da_parte`).
    excecoes = {}
    for ext in vistas['excecoes']['agentes']['binarios_liberados']:
        excecoes.setdefault(ext, {})['agentes'] = True
    return {'contadas': sorted(lista_de_codigo(vistas['o_que_e_codigo'])),
            'extras': [],
            **{c: list(vistas['nunca_ler'][c]) for c in NUNCA_LER_LISTAS},
            'excecoes': excecoes}


def ler_nunca_ler():
    return _vistas()['nunca_ler']


def ler_o_que_e_codigo():
    return _vistas()['o_que_e_codigo']


def ler_excecoes():
    return _vistas()['excecoes']


def ler_extensoes():
    """A configuração em vigor NA FORMA ANTIGA. Nunca levanta.

    `contadas` é a lista de código, `extras` vem vazio (as soltas já estão em
    `contadas`), e `excecoes` só traz a coluna `agentes` — `codigo` virou O que
    é código, e `cores` e `usos` viraram partes das Exceções.
    """
    return _vistas()['forma_antiga']


def excecao_de(ext, coluna):
    """`True`/`False` se a extensão tem resposta própria naquela coluna, ou
    `None` se herda o geral. `'codigo'`, `'cores'` e `'usos'` respondem sempre
    `None`."""
    linha = ler_extensoes()['excecoes'].get((ext or '').lower())
    if not isinstance(linha, dict):
        return None
    return linha.get(coluna)


def gravar_vista(vista, dados):
    """Normaliza e grava UMA vista (atômico). Devolve o que foi gravado."""
    valores = _NORMALIZADORES[vista](dados)
    gravar_json_de_config(os.path.basename(_ARQUIVOS_DAS_VISTAS[vista]), valores)
    _invalidar_cache_extensoes()
    return valores


class ConfigsExtensoesMixin:

    # ── Arquivos que o programa lê (global, vale para todos os projetos) ──
    #
    # Até 23/09/2026 era a categoria "Extensões e pastas ignoradas", com um
    # arquivo só e uma tabela de exceções de quatro colunas. As colunas viraram
    # linhas de Quem lê o quê; "Aparência: onde procurar" também. Desde a fase
    # 06 da obra «Qualidade da documentação», as linhas que se editavam são as
    # partes das Exceções (Acrescentar e Retirar), e Quem lê o quê é só leitura.
    #
    # O padrão de fábrica é o de antes: quem nunca abrir a tela vê os mesmos
    # números.

    def load_arquivos_lidos(self):
        """As três vistas que gravam, as bases das Exceções (o "Parte de" de
        cada parte) e os padrões (a tela marca o chip de fábrica com tracejado
        sem repetir a lista em JS). Quem lê o quê não tem dado: a tela escreve."""
        try:
            vistas = _vistas()
            return {'success': True,
                    'nunca_ler': vistas['nunca_ler'],
                    'o_que_e_codigo': vistas['o_que_e_codigo'],
                    'excecoes': vistas['excecoes'],
                    'lista_de_codigo': lista_de_codigo(vistas['o_que_e_codigo']),
                    'bases': bases_das_excecoes(vistas['o_que_e_codigo']),
                    'padrao': {'nunca_ler': padrao_nunca_ler(),
                               'o_que_e_codigo': padrao_o_que_e_codigo(),
                               'excecoes': padrao_excecoes()}}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def save_arquivos_lidos(self, vista, dados):
        """Grava SÓ o arquivo daquela vista e devolve o estado gravado."""
        try:
            if vista not in _NORMALIZADORES:
                return {'success': False, 'error': 'vista desconhecida: %s' % vista}
            valores = gravar_vista(vista, dados or {})
            if vista == 'excecoes':
                # Mudar a lista muda o que a varredura da Aparência lê, e a
                # invalidação por data não perceberia — nenhum arquivo mudou.
                self._aparencia_esquecer_indice()
            return {'success': True, 'vista': vista, 'dados': valores,
                    'lista_de_codigo': lista_de_codigo()}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def reset_arquivos_lidos(self):
        """Restaurar padrão da categoria: as TRÊS vistas voltam à fábrica
        (decisão do usuário em 23/09/2026 — o botão é da categoria)."""
        try:
            gravar_vista('nunca_ler', padrao_nunca_ler())
            gravar_vista('o_que_e_codigo', padrao_o_que_e_codigo())
            gravar_vista('excecoes', padrao_excecoes())
            self._aparencia_esquecer_indice()
            return self.load_arquivos_lidos()
        except Exception as e:
            return {'success': False, 'error': str(e)}
