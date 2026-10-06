from .constantes import *
from .aparencia_imagens import APARENCIA_EXTENSOES_IMAGEM

# ═════════════════════════ O QUE A BUSCA VISUAL DA APARÊNCIA LÊ ══
# Duas partes de Configurações › Arquivos que o programa lê › Exceções:
# **Busca visual · texto e cor** e **Busca visual · imagem**. Até 23/09/2026
# eram a categoria própria "Aparência: onde procurar", com `aparencia.json`; a
# categoria saiu do trilho (D6) e o arquivo é migrado no boot. Até a fase 06
# da obra «Qualidade da documentação» eram listas próprias de Quem lê o quê;
# hoje cada uma PARTE da lista de fábrica abaixo e guarda só o que o usuário
# acrescentou e retirou (`configuracoes_extensoes_excecoes.py`).
#
# ⛔ NÃO É DA EXTENSÃO "Cor do código" (P3): ela não lê esta lista. Quem lê é
# a aba Aparência, que continua no programa.
#
# Estas duas listas funcionam ao contrário das outras: dizem o que ENTRA. As
# outras respondem "o que não é projeto?", e a resposta certa por omissão é
# "quase nada fica de fora". Estas respondem "onde pode haver cor ou texto de
# interface escrito?", e a resposta certa por omissão é uma lista curta: sem
# um teto explícito, a aba abriria todo arquivo atrás de um `#RRGGBB`.
#
# ⚠️ Esta lista GANHA de "Nunca ler › Extensões"
# (`ignorados.py::extensao_ignorada`). É de propósito: `.png`, `.jpg`, `.ico` e
# `.webp` estão lá, e uma lista que diz "leia isto" vetada em silêncio por
# outra tela é pior que não existir.
#
# O que continua valendo, e não é vetado por esta lista: pasta e arquivo de
# Nunca ler por nome, e tudo que o projeto pôs em Projeto → Remover.

APARENCIA_CONFIG_LISTAS = ('codigo', 'imagens')


def padrao_extensoes_aparencia():
    """O estado de fábrica: exatamente o que a aba lia antes de haver tela.

    `codigo` é `APARENCIA_EXTENSOES_LINGUAGEM`, e `imagens` é o catálogo de
    `aparencia_imagens.py`.
    """
    from .aparencia import APARENCIA_EXTENSOES_LINGUAGEM
    return {
        'codigo': sorted(APARENCIA_EXTENSOES_LINGUAGEM),
        'imagens': sorted(APARENCIA_EXTENSOES_IMAGEM),
    }


def _normalizar_extensoes_aparencia(dados):
    """Completa o que faltar com o padrão e joga fora o que não tem forma válida.

    Extensão passa por `lower()` e ganha o ponto se vier sem: ali a maiúscula não
    significa nada, e `PNG`, `.PNG` e `png` são a mesma coisa para todo mundo.
    """
    padrao = padrao_extensoes_aparencia()
    saida = {}
    for chave in APARENCIA_CONFIG_LISTAS:
        valor = dados.get(chave)
        if not isinstance(valor, list):
            saida[chave] = list(padrao[chave])
            continue
        vistos = []
        for item in valor:
            if not isinstance(item, str):
                continue
            ext = item.strip().lower()
            if not ext:
                continue
            if not ext.startswith('.'):
                ext = '.' + ext
            if ext not in vistos:
                vistos.append(ext)
        saida[chave] = sorted(vistos)

    # ⚠️ Imagem que também está na lista de código sai da de código. As duas
    # leituras são incompatíveis: como código, um `.svg` casa pelo `fill=`
    # escrito no texto, e um traço de 2 pixels pesa igual a um fundo de 2.000.
    # Deixar as duas ligadas devolveria o mesmo arquivo duas vezes, com
    # respostas que se contradizem.
    imagens = set(saida['imagens'])
    saida['codigo'] = [ext for ext in saida['codigo'] if ext not in imagens]
    return saida


def ler_extensoes_aparencia():
    """`{codigo, imagens}` em vigor: a lista de fábrica de cada busca visual
    com as Exceções dela aplicadas, e a regra "imagem sai de código" por cima
    (`_normalizar_extensoes_aparencia`). Nunca levanta.

    Mesmo nome e mesma forma de antes: `aparencia.py` e `aparencia_indice.py`
    não precisaram mudar. O cache é o das vistas de Arquivos que o programa lê.
    """
    try:
        from .configuracoes_extensoes_excecoes import lista_da_parte
        return _normalizar_extensoes_aparencia({
            'codigo': lista_da_parte('busca_visual_codigo'),
            'imagens': lista_da_parte('busca_visual_imagens')})
    except Exception:
        return padrao_extensoes_aparencia()

# ⚠️ `load_/save_/reset_extensoes_aparencia` SAÍRAM em 23/09/2026, junto com a
# categoria. Quem grava as duas partes é `save_arquivos_lidos('excecoes', …)`,
# que também chama `_aparencia_esquecer_indice`.
