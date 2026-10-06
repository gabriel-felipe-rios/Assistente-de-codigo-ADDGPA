"""A extensão que é só DADO — Recursos do Editor › cor e › trechos prontos,
e Visual › ícones.

Não precisam de código nenhum: a extensão tem `extensao.json`, declara o item
em `acrescenta` (`{"recurso": "visual", "parte": "icones", "arquivo":
"mapa.json"}`), e pronto — sem `frontend/`, sem `backend/`.

⚠️ Por dentro, as duas partes ainda andam com a chave numérica de antes —
`'11'` (gramáticas) e `'24'` (ícones) — em `folha['dados']`, derivado de
`acrescenta` por `validacao.derivar_campos_da_tela`. É a chave que o frontend
filtra (`xtDadosDoTipo('11'|'24')`) até a fase 13 trocá-la; ela nunca aparece
no manifesto novo nem na tela. Tema, preset de modelo e preset de Acervo
SAÍRAM (P9, D37): o programa já os configura.

Regra comum aos consumidores: o programa **LISTA** o que as extensões ligadas
trazem, ao lado do que já tem embutido. A extensão nunca substitui o embutido
— quem escolhe é o usuário. E tudo que vem de extensão leva
`data-origem="extensao"` na tela, para o "Destacar extensões" (D2) pegar.

⚠️ Dois formatos de entrega, e a diferença é de custo:

  - **Gramáticas (11) é uma PASTA**, e nem o caminho de um arquivo. São 297
    `.js` que o autoloader do Prism pede um a um, sob demanda: o programa só
    lhe diz onde procurar (`Prism.plugins.autoloader.languages_path`).
  - **Ícones (24) é o JSON já lido**, porque o consumidor precisa do conteúdo
    (o mapa de ícones).

`base_url` vem junto sempre: uma extensão de ícones traz SVGs ao lado do
`mapa.json`, e o frontend precisa saber de onde puxá-los.

Cada entrada diz também o que é pelo NOME do catálogo — `recurso` e `parte`
(`visual`/`icones`, `editor`/`cor`, `editor`/`trechos`) —, além da chave
interna `tipo` de hoje. É por aí que um consumidor novo (um visual novo, D41)
se acha sem inventar número.

Os **trechos prontos** (fase 12) são o terceiro dado: um `.json` com
`[{ prefixo, descricao, corpo }]` — o subconjunto do formato de snippets do VS
Code (`$1`, `${1:texto}`, `$0`). Não têm chave interna numérica (`tipo` vem
vazio): o frontend os acha por `parte`.
"""

import os
import json
from urllib.parse import quote

from .constantes import caminho_absoluto
from .descoberta import montar_arvore, todas_as_folhas
from .validacao import DADOS_INTERNOS

# O caminho de `External/extensions/` visto de dentro de `Code/frontend/`, que
# é de onde o `index.html` resolve tudo. Escrito uma vez aqui em vez de
# remontado em cada arquivo do frontend.
_BASE_URL_FRONTEND = '../../External/extensions'

# A chave interna → (assunto, aponta uma PASTA?). Só as duas que sobraram
# depois do P9; a origem delas é `validacao.DADOS_INTERNOS`.
_DADOS = {'11': ('gramaticas', True), '24': ('icones', False)}
# A chave interna → (recurso, parte) do catálogo, para a entrada dizer o que é.
_RECURSO_DO_TIPO = {v: k for k, v in DADOS_INTERNOS.items()}
# O filtro de `list_dados_de_extensoes` para pedir só os trechos.
DADOS_TRECHOS = 'trechos'


def _base_url(caminho_relativo):
    # ⚠️ Já sai CODIFICADA. O nome de uma pasta de extensão é livre — tem
    # espaço, acento, e pode ter `#` ou `?`, que num endereço significam
    # outra coisa e cortariam o caminho ao meio. `safe='/'` preserva as
    # barras, que aqui são separador de verdade.
    return '%s/%s' % (_BASE_URL_FRONTEND, quote(caminho_relativo, safe='/'))


class XtDadosMixin:
    def list_dados_de_extensoes(self, tipo=None):
        """O que as extensões LIGADAS trazem, de uma chave interna (`'11'`,
        `'24'`) — ou de todas, se `tipo` vier vazio.

        Cada entrada é `{caminho, slug, nome, tipo, assunto, arquivo, url,
        base_url, dados, erro}`. `dados` é `None` para as gramáticas (que são
        pasta, não conteúdo) e para quem falhou ao ler — e nesse caso `erro`
        diz o quê, para a categoria consumidora mostrar em vez de sumir com a
        opção.
        """
        alvos = [str(tipo)] if tipo else list(_DADOS) + [DADOS_TRECHOS]
        resultado = []

        # Mesma rede dos outros métodos públicos desta camada: a lista de
        # dados não pintar seria um sintoma silencioso — os ícones e as
        # gramáticas sumiriam de uma vez, sem uma linha no terminal.
        try:
            folhas = todas_as_folhas(montar_arvore())
        except Exception as e:
            print('[extensoes] falha ao listar os dados:', e)
            return {'success': False, 'error': str(e), 'dados': []}

        for folha in folhas:
            if not folha['ligado']:
                continue
            # ⚠️ Percorre `dados` (derivado de `acrescenta`), e não mais os
            # `tipos`: o tipo novo diz a CATEGORIA da extensão, não o dado.
            for t, arquivo in (folha['dados'] or {}).items():
                if t not in alvos or t not in _DADOS or not arquivo:
                    continue

                recurso, parte = _RECURSO_DO_TIPO.get(t, ('', ''))
                entrada = {
                    'caminho': folha['caminho'],
                    'slug': folha['slug'],
                    'nome': folha['nome'],
                    'tipo': t,
                    'recurso': recurso,
                    'parte': parte,
                    'assunto': _DADOS[t][0],
                    'arquivo': arquivo,
                    'base_url': _base_url(folha['caminho']),
                    'url': '%s/%s' % (_base_url(folha['caminho']),
                                  quote(arquivo.replace(os.sep, '/'), safe='/')),
                    'dados': None,
                    'erro': None,
                }

                caminho_abs = os.path.join(caminho_absoluto(folha['caminho']),
                                           arquivo.replace('/', os.sep))

                # ⚠️ As gramáticas apontam uma PASTA, não um arquivo. Não há
                # conteúdo a ler nem a mandar pela ponte: quem consome é o
                # autoloader do Prism, que pede um `.js` por linguagem, sob
                # demanda, a partir da `url`. O que o programa confere é o que
                # ele consegue conferir aqui — que a pasta existe e tem
                # gramática dentro.
                if _DADOS[t][1]:
                    try:
                        nomes = os.listdir(caminho_abs) if os.path.isdir(caminho_abs) else None
                    except OSError as e:
                        nomes = []
                        entrada['erro'] = 'não deu para ler a pasta "%s": %s' % (arquivo, e)
                    if nomes is None:
                        entrada['erro'] = ('a pasta "%s" não existe na pasta da extensão.'
                                           % arquivo)
                    elif not entrada['erro'] and not any(
                            n.startswith('prism-') and n.endswith('.js') for n in nomes):
                        entrada['erro'] = ('a pasta "%s" não tem nenhuma gramática '
                                           '(`prism-*.js`) dentro.' % arquivo)
                    resultado.append(entrada)
                    continue

                if not os.path.isfile(caminho_abs):
                    entrada['erro'] = 'o arquivo "%s" não existe na pasta da extensão.' % arquivo
                else:
                    try:
                        with open(caminho_abs, 'r', encoding='utf-8') as f:
                            entrada['dados'] = json.load(f)
                    except json.JSONDecodeError as e:
                        entrada['erro'] = '"%s" não é um JSON válido — %s' % (arquivo, e)
                    except OSError as e:
                        entrada['erro'] = 'não deu para ler "%s": %s' % (arquivo, e)

                resultado.append(entrada)

            if DADOS_TRECHOS in alvos:
                resultado.extend(_entradas_de_trechos(folha))

        return {'success': True, 'dados': resultado}


def _entradas_de_trechos(folha):
    """Uma entrada por item `{"recurso": "editor", "parte": "trechos"}` da
    extensão, com os trechos JÁ LIDOS e conferidos. Um arquivo quebrado vira
    `erro` na entrada (e o aviso no console da tela), nunca exceção — e os
    trechos bons de um arquivo com um trecho torto continuam valendo."""
    saida = []
    for item in folha.get('trechos') or []:
        arquivo = item.get('arquivo') or ''
        entrada = {
            'caminho': folha['caminho'], 'slug': folha['slug'], 'nome': folha['nome'],
            'tipo': '', 'recurso': 'editor', 'parte': 'trechos', 'assunto': 'trechos',
            'arquivo': arquivo, 'linguagens': list(item.get('linguagens') or ['*']),
            'base_url': _base_url(folha['caminho']), 'url': '', 'dados': None, 'erro': None,
        }
        caminho_abs = os.path.join(caminho_absoluto(folha['caminho']), arquivo.replace('/', os.sep))
        try:
            with open(caminho_abs, 'r', encoding='utf-8') as f:
                brutos = json.load(f)
        except FileNotFoundError:
            entrada['erro'] = 'o arquivo "%s" não existe na pasta da extensão.' % arquivo
            saida.append(entrada)
            continue
        except json.JSONDecodeError as e:
            entrada['erro'] = '"%s" não é um JSON válido — %s' % (arquivo, e)
            saida.append(entrada)
            continue
        except OSError as e:
            entrada['erro'] = 'não deu para ler "%s": %s' % (arquivo, e)
            saida.append(entrada)
            continue
        if not isinstance(brutos, list):
            entrada['erro'] = ('"%s" precisa ser uma lista `[{ "prefixo", "descricao", '
                               '"corpo" }]`.' % arquivo)
            saida.append(entrada)
            continue
        trechos, ruins = [], 0
        for t in brutos:
            corpo = t.get('corpo') if isinstance(t, dict) else None
            # O corpo pode vir em linhas (lista), como no formato do VS Code.
            if isinstance(corpo, list) and all(isinstance(l, str) for l in corpo):
                corpo = '\n'.join(corpo)
            prefixo = t.get('prefixo') if isinstance(t, dict) else None
            if not (isinstance(prefixo, str) and prefixo.strip() and isinstance(corpo, str)):
                ruins += 1
                continue
            descricao = t.get('descricao')
            trechos.append({'prefixo': prefixo.strip(), 'corpo': corpo,
                            'descricao': descricao if isinstance(descricao, str) else ''})
        entrada['dados'] = trechos
        if ruins:
            # Aviso, e não erro: os bons valem. `erro` sumiria com a entrada.
            entrada['aviso'] = ('%d trecho(s) de "%s" sem `prefixo` ou `corpo` foram '
                                'ignorados.' % (ruins, arquivo))
        saida.append(entrada)
    return saida
