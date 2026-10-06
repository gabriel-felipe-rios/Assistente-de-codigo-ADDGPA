"""Como a forma ANTIGA de "Arquivos que o programa lê" vira as três vistas.

Irmão de `configuracoes_extensoes.py`, separado pelo teto de 500 linhas da AMF
e porque responde outra pergunta: aquele lê e grava as três vistas; este sabe
ler o `extensoes.json` de antes de 23/09/2026 (um arquivo só, com `contadas`,
`extras`, os ignorados e a tabela de exceções) e o `aparencia.json`, e montar
as três vistas a partir deles — pela tabela de mapeamento da fase 03 da obra.

Quem chama: `configuracoes_extensoes._vistas` (migração NA MEMÓRIA, quando o
arquivo de uma vista não existe) e `configuracoes_arquivos.migrar_nomes_de_config`
(a gravação de verdade, no boot).
"""

from .constantes import *
from .configuracoes_extensoes import (NUNCA_LER_LISTAS, _ext, _lista_de_ext,
                                      _lista_de_nomes, padrao_nunca_ler,
                                      padrao_o_que_e_codigo,
                                      _normalizar_nunca_ler,
                                      _normalizar_o_que_e_codigo)
from .configuracoes_extensoes_excecoes import _normalizar_excecoes, padrao_excecoes

# As chaves do arquivo antigo. Basta uma delas para ele ter "forma de
# ignorados" — o `extensoes.json` de hoje é o estado das extensões do programa
# (`{"Cor do código": {"ligado": true}}`), e não pode ser lido como lista.
_CHAVES_DA_FORMA_ANTIGA = ('contadas', 'extras', *NUNCA_LER_LISTAS, 'excecoes')


def _ler_json_solto(caminho):
    try:
        with open(caminho, 'r', encoding='utf-8') as f:
            dado = json.load(f)
        return dado if isinstance(dado, dict) else None
    except (OSError, ValueError):
        return None


def tem_forma_de_ignorados(dado):
    """O `extensoes.json` é a lista de ignorados antiga? (e não o estado das
    extensões do programa, que é o dono do nome desde a fase 03)."""
    return isinstance(dado, dict) and any(c in dado for c in _CHAVES_DA_FORMA_ANTIGA)


def migrar_da_forma_antiga(ignorados, aparencia):
    """As três vistas gravadas montadas a partir dos arquivos antigos, pela
    tabela de mapeamento da fase 03. `ignorados`/`aparencia` podem ser `None`.

    Desde a fase 06 da obra «Qualidade da documentação» a terceira é
    Exceções: as listas das buscas visuais viram a diferença para a lista de
    fábrica (`_normalizar_excecoes` faz a conta), e a coluna `usos` vira a
    parte Busca de usos."""
    from modulos.linguagens import todas_extensoes
    from .configuracoes_aparencia import padrao_extensoes_aparencia
    nunca = padrao_nunca_ler()
    codigo = padrao_o_que_e_codigo()
    visual = padrao_extensoes_aparencia()
    visual_codigo, visual_imagens = list(visual['codigo']), list(visual['imagens'])
    usos = {'acrescentar': [], 'retirar': []}
    liberados = []
    excecoes = {}

    if tem_forma_de_ignorados(ignorados):
        for chave in NUNCA_LER_LISTAS:
            ler = _lista_de_ext if chave == 'extensoes_ignoradas' else _lista_de_nomes
            valor = ler(ignorados.get(chave))
            if valor is not None:
                nunca[chave] = valor

        nas_listas = ({e for l in codigo['linguagens'] for e in l['extensoes']}
                      | set(codigo['formatos_especiais']))
        contadas = _lista_de_ext(ignorados.get('contadas'))
        if contadas is not None:
            # O catálogo ANTIGO — sem `.mts`/`.cts` nem o que a fase 06 da obra
            # «Qualidade da documentação» acrescentou (D41), que não existiam:
            # uma extensão nova nunca nasce desmarcada pela migração.
            antigo = ((set(todas_extensoes())
                       - {'.mts', '.cts', '.pyi', '.vue', '.svelte', '.astro',
                          '.dart', '.lua', '.jsonc'})
                      | {'.toml', '.ini', '.txt'})
            codigo['desmarcadas'] = sorted(antigo - set(contadas))

        def trazer_de_volta(ext):
            if ext in nas_listas:
                if ext in codigo['desmarcadas']:
                    codigo['desmarcadas'].remove(ext)
            elif ext not in codigo['extensoes_soltas']:
                codigo['extensoes_soltas'].append(ext)

        for ext in _lista_de_ext(ignorados.get('extras')) or []:
            trazer_de_volta(ext)

        brutas = ignorados.get('excecoes')
        for ext, cols in (brutas.items() if isinstance(brutas, dict) else []):
            ext = _ext(ext)
            if ext and isinstance(cols, dict):
                excecoes[ext] = cols
        for ext, cols in excecoes.items():
            if 'codigo' in cols:
                if cols['codigo']:
                    trazer_de_volta(ext)
                elif ext in nas_listas and ext not in codigo['desmarcadas']:
                    codigo['desmarcadas'].append(ext)

    if isinstance(aparencia, dict):
        if isinstance(aparencia.get('codigo'), list):
            visual_codigo = list(aparencia['codigo'])
        if isinstance(aparencia.get('imagens'), list):
            visual_imagens = list(aparencia['imagens'])

    # A coluna `cores` vale DEPOIS do `aparencia.json`, como valia antes.
    for ext, cols in excecoes.items():
        if 'cores' in cols:
            if cols['cores'] and ext not in visual_codigo:
                visual_codigo.append(ext)
            elif not cols['cores'] and ext in visual_codigo:
                visual_codigo.remove(ext)
        if 'usos' in cols:
            usos['acrescentar' if cols['usos'] else 'retirar'].append(ext)
        if cols.get('agentes'):
            liberados.append(ext)

    codigo = _normalizar_o_que_e_codigo(codigo)
    # As buscas visuais vão na forma de lista própria (`extensoes`): o
    # normalizador tira a diferença para a lista de fábrica. A Documentação
    # Técnica nunca teve lista na forma antiga: vai com as exceções de
    # fábrica (as que reproduzem a lista própria de antes — `.env`, `.psm1`…).
    return {'nunca_ler': _normalizar_nunca_ler(nunca),
            'o_que_e_codigo': codigo,
            'excecoes': _normalizar_excecoes({
                'documentacao_tecnica': padrao_excecoes()['documentacao_tecnica'],
                'busca_visual_codigo': {'extensoes': visual_codigo},
                'busca_visual_imagens': {'extensoes': visual_imagens},
                'busca_de_usos': usos,
                'agentes': {'binarios_liberados': liberados}}, codigo)}
