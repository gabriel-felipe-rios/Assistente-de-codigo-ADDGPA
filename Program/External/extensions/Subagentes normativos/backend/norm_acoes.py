"""O que cada ação da porta faz: a ferramenta `ler_base`, o texto que entra no
prompt do Chat e da Fila, e o envelope de cada subagente.

Nada aqui abre arquivo (é `norm_dados`) nem monta caminho à mão (é
`norm_caminhos`). Toda falha vira `{'success': False, 'error': …}`: o programa
a entrega ao modelo como `ERRO: …`, e o texto do erro é escrito para ele
acertar na rodada seguinte.
"""

import unicodedata

from . import norm_caminhos as c
from . import norm_dados as d

# Quantos nomes parecidos o erro de caminho sugere — o mesmo corte do programa:
# devolver a lista inteira custava cinco vezes mais que um acerto.
MAX_SUGESTOES = 5

# As bases que já avisaram no console que ficaram fora do prompt — uma vez por
# (projeto, base, motivo), senão o aviso sairia a cada envio.
_AVISADAS = set()

# Para a Fila: quem responde "onde a coisa nova mora", na ordem do relatório.
_PAPEIS_NO_RELATORIO = (
    ('norm.enderecador', 'ao Endereçador (arquitetura modular — em que pasta)'),
    ('norm.terminologo', 'ao Terminólogo (como se chama)'),
    ('norm.padronizador', 'ao Padronizador (com que cara, se for tela)'),
)


def _ok(**campos):
    return dict(success=True, **campos)


def _erro(mensagem):
    return {'success': False, 'error': mensagem}


def _normalizar(texto):
    """Forma de comparação: sem acento, sem caixa, sem `\\`, sem `.md`."""
    t = (texto or '').strip().replace('\\', '/').strip('/')
    if t.lower().endswith('.md'):
        t = t[:-3]
    t = unicodedata.normalize('NFD', t)
    return ''.join(ch for ch in t if unicodedata.category(ch) != 'Mn').lower()


def _sugestoes(disponiveis, pedido, pasta_nome):
    """Até MAX_SUGESTOES nomes, os mais parecidos com `pedido` primeiro."""
    nomes = sorted(disponiveis)
    if pedido:
        pedacos = [p for p in pedido.split('/') if p]
        nomes.sort(key=lambda n: (-sum(1 for p in pedacos if p in _normalizar(n)), len(n)))
    escolhidas = nomes[:MAX_SUGESTOES]
    resto = len(nomes) - len(escolhidas)
    rodape = ('\n(e mais %d — chame `ler_base` sem o "caminho" para ver todas)' % resto
              if resto > 0 else '')
    return 'Arquivos da base "%s" mais parecidas:\n%s%s' % (
        pasta_nome, '\n'.join('- ' + n for n in escolhidas), rodape)


def _nome_da_base(subagente, base_pedida):
    """A pasta da base a ler. Os quatro desta extensão não escolhem: a base vem
    do id deles. Quem recebeu a `ler_base` emprestada (o Verificador da Fila)
    escolhe pelo parâmetro "base", restrito às quatro — parâmetro livre aqui
    seria ler pasta arbitrária."""
    if subagente in c.BASES:
        return c.BASES[subagente][0]
    registradas = [b[0] for b in c.BASES.values()]
    lista = ' · '.join('"%s"' % b for b in registradas)
    if not isinstance(base_pedida, str) or not base_pedida.strip():
        raise ValueError('parâmetro "base" vazio. Bases disponíveis: %s' % lista)
    if base_pedida.strip() not in registradas:
        raise ValueError('base "%s" não existe. Bases disponíveis: %s'
                         % (base_pedida.strip(), lista))
    return base_pedida.strip()


def _ler_base(payload, subagente, caminho, base_pedida):
    pasta_nome = _nome_da_base(subagente, base_pedida)
    base = c.pasta_da_base(c.raiz_do_projeto(payload), pasta_nome)
    if not d.base_existe(base):
        raise ValueError('este projeto não tem a pasta "%s" em "%s" — não há nada '
                         'decidido sobre isso ainda' % (pasta_nome, c.PASTA_DAS_BASES))
    disponiveis = d.listar_arquivos(base)
    if not disponiveis:
        raise ValueError('a base "%s" está vazia — não há nada decidido sobre isso ainda'
                         % pasta_nome)
    if not isinstance(caminho, str) or not caminho.strip():
        raise ValueError('parâmetro "caminho" vazio. ' + _sugestoes(disponiveis, '', pasta_nome))
    limpo = caminho.strip().replace('\\', '/')
    if not limpo.lower().endswith('.md'):
        limpo += '.md'
    if limpo not in disponiveis:
        raise ValueError('arquivo "%s" não existe nesta base. ' % caminho
                         + _sugestoes(disponiveis, _normalizar(limpo), pasta_nome))
    conteudo = d.ler_texto(c.dentro_da_base(base, limpo)).strip()
    # O teto de leitura NÃO é daqui: o programa corta o que esta função devolve
    # no teto de toda ferramenta que lê (D53) e avisa quanto ficou de fora.
    return '--- %s ---\n%s' % (limpo, conteudo)


def ferramenta(payload):
    """`xt.ferramenta`: a `ler_base`."""
    if payload.get('ferramenta') != 'ler_base':
        return _erro('a extensão Subagentes normativos não atende a ferramenta "%s"'
                     % payload.get('ferramenta'))
    parametros = payload.get('parametros') or {}
    try:
        return _ok(texto=_ler_base(payload, payload.get('subagente'),
                                   parametros.get('caminho'), parametros.get('base')))
    except (ValueError, OSError) as e:
        return _erro(str(e))


def _indice(payload, subagente, pasta):
    """O índice de uma base (Regras: regra × instrução; as outras: a lista dos
    arquivos), ou '' — com o aviso no console, uma vez, se a base não pôde ser
    lida: uma base que some calada faz o modelo responder como se o projeto
    não tivesse decidido nada."""
    try:
        base = c.pasta_da_base(c.raiz_do_projeto(payload), pasta)
        if subagente == c.SUBAGENTE_DAS_REGRAS:
            return d.indice_das_regras(base)
        return '\n'.join('- ' + a for a in d.listar_arquivos(base))
    except (ValueError, OSError) as e:
        chave = (payload.get('projeto'), pasta, str(e))
        if chave not in _AVISADAS:
            _AVISADAS.add(chave)
            print('[norm] a base "%s" (subagente %s) ficou fora do prompt: %s'
                  % (pasta, subagente, e))
        return ''


def envelope(payload):
    """`xt.envelope`: a lista dos arquivos da base, junto da pergunta — o
    `[ARQUIVOS DA BASE — {pasta}]` de sempre (D37, item 6)."""
    sid = payload.get('subagente')
    if sid not in c.BASES:
        return _ok(blocos=[])
    pasta = c.BASES[sid][0]
    lista = _indice(payload, sid, pasta)
    if not lista:
        return _ok(blocos=[])
    return _ok(blocos=[{'rotulo': 'ARQUIVOS DA BASE', 'nome': pasta, 'texto': lista}])


def prompt(payload):
    """`xt.prompt`: o texto que entra no fim do prompt do Chat e da Fila — só
    sobre os subagentes desta extensão que estão LIGADOS nesta conversa (o
    bloco variável, D52). Sem nenhum ligado, nada entra."""
    alvo = payload.get('alvo')
    ativos = payload.get('subagentes_ativos')
    ativos = ativos if isinstance(ativos, list) else list(c.BASES)
    meus = [sid for sid in c.BASES if sid in ativos]
    if alvo not in ('chat', 'fila') or not meus:
        return _ok(texto='')

    quem = ', '.join('%s (`%s`)' % (c.BASES[sid][2], sid) for sid in meus)
    partes = ['---', 'O QUE ESTE PROJETO JÁ DECIDIU',
              'Para saber COMO ESTE PROJETO FAZ as coisas, pergunte a quem guarda a '
              'decisão ANTES de propor: %s.' % quem]
    if alvo == 'fila':
        partes.append('No relatório, "restricoes" existe porque este projeto já '
                      'decidiu muita coisa — nomes, onde cada arquivo mora, como as '
                      'telas se parecem, o que é proibido. Antes de entregar, pergunte '
                      'a %s o que já foi decidido sobre o que você está propondo. Uma '
                      'solução que contraria uma decisão do projeto é uma solução '
                      'errada, por melhor que pareça.' % quem)
        papeis = [texto for sid, texto in _PAPEIS_NO_RELATORIO if sid in meus]
        if papeis:
            partes.append('Quando a mudança é criar algo novo, diga ONDE a coisa nova '
                          'deve morar: pergunte %s. O lugar sugerido é resultado dessas '
                          'respostas, e a decisão correspondente entra em "restricoes" '
                          'com a fonte.' % ', '.join(papeis))
    blocos = []
    for sid in meus:
        pasta, descricao, _nome = c.BASES[sid]
        indice = _indice(payload, sid, pasta)
        if not indice:
            continue
        blocos.append('%s\n\nO que este projeto decidiu sobre %s. Você está vendo só '
                      'o nome e quando cada coisa se aplica — o texto completo não '
                      'está aqui.\n\n%s\n\nSe algo desta lista tiver relação com o que '
                      'foi pedido, chame o subagente "%s" para ler o conteúdo ANTES de '
                      'responder.' % (pasta.upper(), descricao, indice, sid))
    if blocos:
        partes.append('\n\n---\n\n'.join(blocos))
    partes.append('Nunca suponha o conteúdo de uma regra, convenção ou padrão a partir '
                  'do nome dela.')
    return _ok(texto='\n\n'.join(partes))
