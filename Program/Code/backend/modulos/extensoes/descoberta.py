"""A árvore de `External/extensions/` — o que o programa mostra em
Configurações › Programa › Extensões.

Mesma forma da árvore de Plugins e de Launchers (`arvore_externa.py` faz a
varredura, a recursão e a ordem), com uma diferença de conteúdo: aqui cada
folha carrega o MANIFESTO já lido e validado, com os erros dele.

⚠️ A árvore sai no mesmo formato de `list_plugins` — `{nome, caminho, pastas,
extensoes}` — de propósito: `trilho-de-pastas.js` já sabe navegar essa forma,
e passa a servir extensões de graça, sem uma linha nova.
"""

import os

from ..arvore_externa import ler_json_de_config, montar_no, listar_folhas_recursivo
from .constantes import (EXTENSOES_DIR, EXTENSOES_CONFIG_FILE, EXTENSOES_ORDER_FILE,
                         EXTENSOES_DESTAQUE_FILE, XT_DESTAQUE_PADRAO,
                         XT_DESTAQUE_CORES, XT_DESTAQUE_TIPOS,
                         XT_FRONTEND_ENTRY, XT_BACKEND_ENTRY,
                         XT_BOOT_ENTRY, XT_TELA, XT_ICONE,
                         caminho_absoluto, caminho_relativo_e_seguro,
                         eh_pasta_de_extensao, slug_da_extensao)
from .manifesto import ler_manifesto
from .validacao import derivar_campos_da_tela
from .encaixes import XT_LUGARES_DE_TELA
from . import carga


def ler_config():
    return ler_json_de_config(EXTENSOES_CONFIG_FILE)


def ler_ordem():
    return ler_json_de_config(EXTENSOES_ORDER_FILE, exigir_dicionario=True)


def ler_destaque():
    """O "Destacar extensões" (D2): se está ligado, com que cor e de que jeito.

    Desligado é o padrão de fábrica: o destaque é uma ferramenta de quem está
    desenvolvendo uma extensão, não a aparência normal do programa.

    ⚠️ **Valor desconhecido cai no padrão, e não quebra a tela.** O arquivo é
    editável à mão e sobrevive a versões do programa: uma cor que deixou de
    existir, ou um `tipo` escrito errado, viraria um seletor de CSS que não
    casa com nada — o usuário ligaria o destaque e não veria diferença
    nenhuma, sem uma pista do porquê.
    """
    bruto = ler_json_de_config(EXTENSOES_DESTAQUE_FILE)
    cor = str(bruto.get('cor', '')).strip()
    tipo = str(bruto.get('tipo', '')).strip()
    return {
        'destacar': bool(bruto.get('destacar', False)),
        'cor': cor if cor in XT_DESTAQUE_CORES else XT_DESTAQUE_PADRAO['cor'],
        'tipo': tipo if tipo in XT_DESTAQUE_TIPOS else XT_DESTAQUE_PADRAO['tipo'],
        # A tela desenha as opções a partir DESTA lista, e não de uma cópia
        # dela em JavaScript: duas listas do mesmo conjunto divergem no
        # primeiro dia em que alguém acrescenta uma cor num lado só.
        'cores': list(XT_DESTAQUE_CORES),
        'tipos': list(XT_DESTAQUE_TIPOS),
    }


def listar_extensoes_recursivo(caminho_rel=''):
    """Caminho relativo de TODA extensão, em qualquer profundidade — para o
    boot e para o Restaurar padrão, que precisam da lista sem a árvore."""
    return listar_folhas_recursivo(EXTENSOES_DIR, eh_pasta_de_extensao,
                                   caminho_rel, str.casefold)


def extensao_existe(caminho_relativo):
    """A porta por onde todo caminho vindo do frontend passa. Um `..` é
    recusado antes de tocar o disco — ver `caminho_relativo_e_seguro`."""
    return (caminho_relativo_e_seguro(caminho_relativo)
            and eh_pasta_de_extensao(caminho_absoluto(caminho_relativo)))


def _tem(caminho_relativo, relativo_interno):
    return os.path.isfile(os.path.join(caminho_absoluto(caminho_relativo), relativo_interno))


def montar_folha(caminho_item, nome_da_pasta, config):
    """UMA extensão, do jeito que a tela precisa dela.

    `ligado` sai da config do usuário; todo o resto sai do disco na hora. O
    manifesto é lido A CADA listagem, e não guardado: o usuário edita o
    `extensao.json` com o programa aberto, e reabrir a categoria tem de
    mostrar o que ele acabou de escrever — inclusive o erro de vírgula.
    """
    leitura = ler_manifesto(caminho_item)
    m = leitura['manifesto']
    return {
        'caminho': caminho_item,
        'nome': m['nome'] or nome_da_pasta,
        'nome_da_pasta': nome_da_pasta,
        'slug': slug_da_extensao(caminho_item),
        'versao': m['versao'],
        'descricao': m['descricao'],
        'tipos': m['tipos'],
        # O formato novo (D42): o dono e as peças — `acrescenta` já validado
        # item a item. Os quatro campos abaixo continuam, DERIVADOS dele: são
        # o contrato com o frontend de hoje (`carga.js`, `dados.js`…).
        'prefixo': m['prefixo'],
        'formato': m['formato'],
        'acrescenta': m['acrescenta'],
        'encaixes': m['encaixes'],
        'eventos': m['eventos'],
        'consultas': m['consultas'],
        'telas': m['telas'],
        'trechos': m['trechos'],
        'escreve_fora': m['escreve_fora'],
        'le_fora': m['le_fora'],
        'dados': m['dados'],
        # `ok` False desabilita o interruptor na tela. Uma extensão que o
        # programa não sabe carregar não pode ser ligada — mas continua
        # aparecendo, com os erros, senão o usuário não teria como saber.
        'ok': leitura['ok'],
        'erros': leitura['erros'],
        'ligado': bool(config.get(caminho_item, {}).get('ligado', False)) and leitura['ok'],
        'tem_frontend': _tem(caminho_item, XT_FRONTEND_ENTRY),
        'tem_backend': _tem(caminho_item, XT_BACKEND_ENTRY),
        'tem_boot': _tem(caminho_item, XT_BOOT_ENTRY),
        'tem_tela': _tem(caminho_item, XT_TELA),
        'tem_icone': _tem(caminho_item, XT_ICONE),
    }


def montar_arvore():
    config = ler_config()
    arvore = montar_no(EXTENSOES_DIR, '', eh_pasta_de_extensao,
                       lambda caminho, nome: montar_folha(caminho, nome, config),
                       ler_ordem(), chave_folhas='extensoes',
                       ordenar_folhas=True, chave_ordenacao=str.casefold)
    _conferir_conflitos(arvore)
    return arvore


def folhas_na_ordem_da_lista(no):
    """As extensões na MESMA ordem em que Programa › Extensões as desenha:
    em cada nível, as subpastas (recursivas) antes das extensões soltas — é o
    que `config-xtprog.js::_xtCorpoHtml` faz. `todas_as_folhas` segue outra
    ordem (soltas primeiro) e não serve para decidir quem vem antes."""
    folhas = []
    for pasta in no.get('pastas', []):
        folhas.extend(folhas_na_ordem_da_lista(pasta))
    folhas.extend(no.get('extensoes', []))
    return folhas


def _conferir_conflitos(arvore):
    """Prefixo e `id` repetidos ENTRE extensões ligadas (D40, D42), e a
    disputa por uma escolha única.

    Quem vem DEPOIS na ordem de Programa › Extensões perde: com o prefixo de
    outra, fica desligada NESTA listagem, com o erro dizendo com quem
    conflitou; com um `id` de outra, perde só aquele item. Não grava nada — é
    a listagem que decide, igual a `ligado = config E ok` —, e
    `reconciliar_carregadas` descarrega do backend quem perdeu.

    ⚠️ Os `id` do formato antigo começam por `#` e são gerados, locais a cada
    extensão: não se comparam entre extensões.
    """
    donos, ids, disputas = {}, {}, []
    for f in folhas_na_ordem_da_lista(arvore):
        if not f['ligado']:
            continue
        p = f.get('prefixo')
        if p and p in donos:
            f['erros'].append('o prefixo "%s" já é da extensão "%s", que vem antes na '
                              'lista. Troque o prefixo de uma das duas.' % (p, donos[p]))
            f['ligado'] = False
            continue
        if p:
            donos[p] = f['nome']

        ficam = []
        for item in f.get('acrescenta', []):
            if item['id'].startswith('#'):
                ficam.append(item)
            elif item['id'] in ids:
                f['erros'].append('o id "%s" já existe em "%s": este item não carregou.'
                                  % (item['id'], ids[item['id']]))
            else:
                ids[item['id']] = f['nome']
                ficam.append(item)
        if len(ficam) != len(f.get('acrescenta', [])):
            f['acrescenta'] = ficam
            f.update(derivar_campos_da_tela(ficam))

        for item in f['acrescenta']:
            _anotar_disputa(disputas, f, item)


# O que é ESCOLHA ÚNICA (D42): o pacote de ícones (o usuário já escolhe em
# Configurações › Ícones de arquivos e pastas) e os Recursos do Editor por
# (parte, linguagem). Onde o usuário escolhe, para o Editor, ainda não foi
# decidido: por enquanto a cor e a formatação valem a primeira na ordem da
# lista (`consulta.js::xtConsultarUma`), e as sugestões se SOMAM
# (`consulta.js::xtConsultar`) — o aviso diz isso. Dica e trechos também se
# somam, e sem aviso: duas dicas no mesmo balão não brigam (fase 12).
_ESCOLHA_UNICA = {('visual', 'icones'): 'ícones das listas de arquivo',
                  ('editor', 'cor'): 'cor do código',
                  ('editor', 'sugestoes'): 'sugestões ao digitar',
                  ('editor', 'formatacao'): 'formatação'}


def _anotar_disputa(disputas, folha, item):
    """Duas extensões ligadas no mesmo par (parte, linguagem) → AVISO nas
    duas. Nada é desligado: a regra aprovada é "o usuário escolhe"."""
    chave = (item['recurso'], item.get('parte'))
    if chave not in _ESCOLHA_UNICA:
        return
    langs = set(item.get('linguagens') or ['*'])
    for outra, chave_o, langs_o in disputas:
        if outra is folha or chave_o != chave:
            continue
        comum = langs & langs_o
        if not ('*' in langs or '*' in langs_o or comum):
            continue
        texto = _ESCOLHA_UNICA[chave]
        if chave == ('visual', 'icones'):
            dica = 'escolha qual vale em Configurações › Ícones de arquivos e pastas.'
        else:
            especificas = ((langs | langs_o) - {'*'}) if '*' in langs | langs_o else comum
            texto += ' em %s' % (', '.join(sorted(especificas)) or 'todas as linguagens')
            dica = ('por enquanto as respostas das duas se somam.' if chave[1] == 'sugestoes'
                    else 'por enquanto vale a que vem antes na lista.')
        folha['erros'].append('aviso: disputa "%s" com "%s" — %s' % (texto, outra['nome'], dica))
        outra['erros'].append('aviso: disputa "%s" com "%s" — %s' % (texto, folha['nome'], dica))
    disputas.append((folha, chave, langs))


def achar_folha(no, caminho_relativo):
    """A folha de um caminho, dentro de uma árvore já montada — `None` se a
    pasta sumiu entre a listagem e o clique."""
    for e in no.get('extensoes', []):
        if e['caminho'] == caminho_relativo:
            return e
    for pasta in no.get('pastas', []):
        achado = achar_folha(pasta, caminho_relativo)
        if achado:
            return achado
    return None


def todas_as_folhas(no):
    folhas = list(no.get('extensoes', []))
    for pasta in no.get('pastas', []):
        folhas.extend(todas_as_folhas(pasta))
    return folhas


def reconciliar_carregadas(arvore):
    """Descarrega, no backend, o que está CARREGADO mas não está mais LIGADO
    na árvore. Devolve os avisos.

    Duas situações chegam aqui, e as duas eram silenciosas até 05/09/2026:

      - o usuário edita o `extensao.json` de uma extensão ligada e erra uma
        vírgula. A árvore passa a dizer `ligado: False` (é `config E ok`), a
        tela descarrega o lado dela — e o Python continuava com o módulo, a
        thread do `iniciar()` e a assinatura de evento de pé. Uma extensão
        que a lista mostrava desligada seguia rodando;
      - o usuário move a pasta para dentro de uma categoria com o programa
        aberto. A chave de tudo é o caminho relativo, então o módulo ficava
        registrado sob um caminho que não existe mais, sem ninguém para
        descarregá-lo.

    Import tardio: `descarregar` importa `boot`, que importa este módulo — no
    topo o ciclo fecharia.
    """
    from .descarregar import descarregar
    ligadas = {f['caminho'] for f in todas_as_folhas(arvore) if f['ligado']}
    avisos = []
    for caminho in carga.caminhos_carregados():
        if caminho in ligadas:
            continue
        avisos.append('a extensão "%s" foi descarregada: não está mais ligada '
                      '(manifesto com erro, ou pasta movida).' % caminho)
        avisos.extend(descarregar(caminho))
    return avisos


class XtDescobertaMixin:
    def list_extensoes_programa(self):
        """Varre `External/extensions/` e devolve a árvore inteira mais o
        estado do interruptor global de destaque.

        Uma pasta é EXTENSÃO se tiver `extensao.json` na raiz; sem isso é
        CATEGORIA, e o scanner desce nela. Profundidade livre, pasta vazia
        aparece como categoria vazia (D14 — mesma regra do Plugin).

        ⚠️ Toda listagem RECONCILIA o backend com a árvore: o que está
        carregado e deixou de estar ligado é descarregado aqui. É o único
        ponto por onde toda mudança de estado passa (todo método de
        `estado.py` devolve esta lista), então é o lugar certo para a
        garantia "o que a tela mostra desligado não está rodando".
        """
        try:
            arvore = montar_arvore()
            # `lugares_de_tela`: o catálogo do recurso Tela, com as classes e a
            # barra de cada lugar — a tela (`extensoes/telas.js`) encaixa a
            # partir DESTA lista, como já faz com as cores do destaque, e não
            # de uma cópia dela em JavaScript (ver `encaixes.py`).
            resposta = {'success': True, 'arvore': arvore, 'destaque': ler_destaque(),
                        'lugares_de_tela': [dict(l) for l in XT_LUGARES_DE_TELA]}
            avisos = reconciliar_carregadas(arvore)
            if avisos:
                resposta['avisos'] = avisos
            return resposta
        except Exception as e:
            # A lista não pintar é um sintoma silencioso: a categoria fica
            # vazia e parece que não há extensão nenhuma instalada.
            print('[extensoes] falha ao montar a arvore:', e)
            return {'success': False, 'error': str(e),
                    'arvore': {'nome': '', 'caminho': '', 'pastas': [], 'extensoes': []},
                    'destaque': ler_destaque(),
                    'lugares_de_tela': [dict(l) for l in XT_LUGARES_DE_TELA]}
