"""A tela de configuração que o PROGRAMA desenha para a extensão.

Uma extensão não escreve a própria tela de configuração: ela declara, em
`config/tela.json`, quais opções quer expor, e o programa desenha com as
classes que já existem (`.config-cartao`, `.config-grade`,
`.config-field-row`, `.config-check`). É o que faz vinte extensões diferentes
terem exatamente a mesma cara das vinte categorias do programa.

Duas pastas, dois papéis, e trocá-los é o erro clássico:

| arquivo | quem escreve | o que é |
|---|---|---|
| `config/tela.json` | a EXTENSÃO | QUAIS opções existem, e o padrão de cada |
| `config/preferencias.json` | o PROGRAMA | os VALORES que o usuário escolheu |

⚠️ **TODA extensão tem página, ligada ou não** (D47, 23/09/2026; até
06/09/2026 só quem tinha `config/tela.json` aparecia, e até 23/09/2026 só as
ligadas). A página é o que o programa sabe dela pelo manifesto — o que ela
faz, onde se encaixa, os comandos que pôs na barra de Acesso rápido — e,
embaixo, as opções do `tela.json`, para quem tem. Quem não tem opção nenhuma
tem página do mesmo jeito: uma extensão de dado puro (ícones, gramáticas)
precisa de um lugar que diga o que ela é — e a desligada também, porque o que
ela É não muda por estar parada. A desligada leva o aviso e o botão para o
interruptor; o interruptor continua SÓ em Programa › Extensões.
"""

import os
import json

from .constantes import (XT_TELA, XT_PREFERENCIAS, caminho_absoluto, catalogo_de_tipos,
                         catalogo_de_recursos, XT_EDITOR_PARTES, XT_VISUAL_PARTES,
                         XT_AGENTE_FORMAS)
from .descoberta import (montar_arvore, todas_as_folhas, extensao_existe)
from .encaixes import XT_PONTOS, XT_LUGARES_DE_TELA
from .eventos import XT_EVENTOS, emitir
from .consulta import XT_CONSULTAS
from .validacao_prompt import alvos_de_prompt


def catalogo_para_a_pagina():
    """O que a página de uma extensão precisa para escrever POR EXTENSO o que
    o manifesto declara por nome: onde fica cada ponto, quando dispara cada
    evento, quando é feita cada consulta, e como se chama cada tipo e cada
    recurso.

    ⚠️ Sai dos catálogos do backend, e não de uma lista no JavaScript — a
    mesma regra de `list_encaixes_programa`: duas listas do mesmo conjunto
    divergem no primeiro dia em que alguém acrescenta um ponto num lado só.
    """
    return {
        'tipos': catalogo_de_tipos(),
        'recursos': catalogo_de_recursos(),
        'pontos': {p['ponto']: p['onde'] for p in XT_PONTOS},
        'eventos': {e['nome']: e['quando'] for e in XT_EVENTOS},
        'consultas': {c['nome']: c['quando'] for c in XT_CONSULTAS},
        # O nome por extenso da `parte` (Recursos do Editor, Visual) e da
        # `forma` (Agente) — o "(ícones das listas de arquivo)" da linha
        # Recursos da página (fase 13).
        'lugares_de_tela': {l['lugar']: l['onde'] for l in XT_LUGARES_DE_TELA},
        'partes': {'editor': dict(XT_EDITOR_PARTES), 'visual': dict(XT_VISUAL_PARTES),
                   'agente': dict(XT_AGENTE_FORMAS)},
        # Fase 07 (D52): onde cada trecho de prompt entra, por extenso.
        'alvos_de_prompt': alvos_de_prompt(),
    }


def _ler_json(caminho_abs, padrao):
    try:
        with open(caminho_abs, 'r', encoding='utf-8') as f:
            return json.load(f), None
    except FileNotFoundError:
        return padrao, None
    except json.JSONDecodeError as e:
        return padrao, str(e)
    except OSError as e:
        return padrao, str(e)


def _padroes_do_tela(tela):
    """Os valores de fábrica, tirados do próprio `tela.json` — é o que
    "Restaurar padrão" devolve, e o que preenche um campo que o usuário nunca
    tocou. A extensão declara o padrão uma vez; o programa não inventa."""
    padroes = {}
    if not isinstance(tela, dict):
        return padroes
    for cartao in (tela.get('cartoes') or []):
        if not isinstance(cartao, dict):
            continue
        for campo in (cartao.get('campos') or []):
            if not isinstance(campo, dict):
                continue
            chave = campo.get('chave')
            if chave:
                padroes[str(chave)] = campo.get('padrao')
    return padroes


def _ler_tela_e_preferencias(caminho_relativo):
    """`(tela, erro_da_tela, padroes, preferencias_gravadas)` de UMA extensão,
    lidos do disco agora. Uma função só para as três leituras (a lista do
    lado Extensões, a ponte, e `preferencias_da_extensao`) não divergirem."""
    base = caminho_absoluto(caminho_relativo)
    tela, erro_tela = _ler_json(os.path.join(base, XT_TELA), {})
    prefs, _ = _ler_json(os.path.join(base, XT_PREFERENCIAS), {})
    padroes = _padroes_do_tela(tela)
    return tela, erro_tela, padroes, (prefs if isinstance(prefs, dict) else {})


def preferencias_resolvidas(caminho_relativo):
    """O que o usuário escolheu, já por cima dos `padrao` do `tela.json` —
    ou `None` se a extensão não tem `config/tela.json`.

    É o que a ponte põe em `payload['preferencias']` e o que
    `preferencias_da_extensao` devolve ao frontend. A extensão nunca precisa
    abrir `preferencias.json` por conta própria — e nem deveria: os padrões
    morariam em dois lugares (o `tela.json` e o Python dela) e divergiriam.
    """
    if not os.path.isfile(os.path.join(caminho_absoluto(caminho_relativo), XT_TELA)):
        return None
    _, _, padroes, prefs = _ler_tela_e_preferencias(caminho_relativo)
    return {**padroes, **prefs}


class XtTelaMixin:
    def list_telas_de_extensoes(self):
        """Uma entrada por extensão — TODA, ligada ou não (D47, 23/09/2026):
        a desligada tem página com o aviso e o botão para o interruptor. Na
        ordem em que elas aparecem na árvore, para o lado Extensões do trilho
        seguir a ordem que o usuário arrastou do lado Programa.

        `ligado` vai no topo da entrada (a `folha` já leva, mas o frontend não
        precisa cavar). ⚠️ Manifesto quebrado conta como desligada — é o
        `ligado` de `montar_folha` —, e os erros continuam na ficha.

        Cada entrada leva a `folha` inteira (o manifesto lido, os erros, o
        que a pasta tem), porque a página é desenhada a partir dela; e
        `tem_tela` diz se há opções embaixo. As preferências vêm vazias para
        quem não tem `tela.json` — `preferencias_resolvidas` continua
        devolvendo `None` nesse caso, e é ela que a ponte usa.
        """
        telas = []
        for folha in todas_as_folhas(montar_arvore()):
            tela, erro_tela, padroes, prefs = _ler_tela_e_preferencias(folha['caminho'])
            telas.append({
                'caminho': folha['caminho'],
                'slug': folha['slug'],
                'nome': folha['nome'],
                'ligado': bool(folha['ligado']),
                'tem_tela': bool(folha['tem_tela']),
                'folha': folha,
                'tela': tela,
                'padroes': padroes,
                # O valor efetivo já resolvido: o que o usuário gravou, ou o
                # padrão. Sem isto cada campo da tela repetiria o mesmo `??`,
                # e o dia em que um deles esquecesse mostraria vazio.
                'preferencias': {**padroes, **prefs},
                # O `preferencias.json` como está no disco, sem os padrões por
                # cima: é o que distingue "nunca escolheu na página" de
                # "escolheu Nenhum" — a reserva do D20 dos ícones (`icones.js`).
                'preferencias_gravadas': prefs,
                'erro': erro_tela,
            })
        catalogo = catalogo_para_a_pagina()
        # Os limites GERAIS dos subagentes (D53): a página de uma extensão
        # que traz subagente só os MOSTRA — quem grava é Configurações ›
        # Programa › Ferramentas dos subagentes. Lidos agora, pelo leitor
        # único (`_sub_limite`, na mesma `Api`).
        try:
            catalogo['limites_dos_subagentes'] = self._sub_limites_gerais()
        except Exception as e:
            print('[extensoes] falha ao ler os limites dos subagentes:', e)
            catalogo['limites_dos_subagentes'] = []
        return {'success': True, 'telas': telas, 'catalogo': catalogo}

    def preferencias_da_extensao(self, caminho):
        """As opções de UMA extensão, resolvidas — para o FRONTEND dela.

        Uma extensão que só precisa das próprias opções (ler o recuo, saber
        se uma caixa está marcada) não precisa de `backend/extensao.py` para
        isso: ela pergunta aqui. `preferencias` vem `None` quando não há
        `config/tela.json`.
        """
        if not extensao_existe(caminho):
            return {'success': False, 'error': 'Extensão não encontrada.'}
        return {'success': True, 'preferencias': preferencias_resolvidas(caminho)}

    def save_preferencias_extensao(self, caminho, preferencias):
        """Grava `config/preferencias.json` — o "Salvar" da barra de ações da
        categoria daquela extensão.

        Grava DENTRO da pasta da extensão, e não em `Internal/config/`: uma
        extensão é uma pasta inteira, removível com um delete só, e a
        preferência dela some junto quando ela some. É a mesma exceção de
        arquitetura já registrada para o plugin.

        ⚠️ Só as chaves que o `tela.json` declara entram no arquivo. O que
        vier a mais (uma tela com defeito, uma chamada errada da ponte) seria
        gravado para sempre dentro da pasta da extensão e devolvido em toda
        listagem — lixo que ninguém apagaria porque ninguém saberia de onde
        veio. Sem `tela.json` legível não há o que filtrar, e grava-se tudo.
        """
        if not extensao_existe(caminho):
            return {'success': False, 'error': 'Extensão não encontrada.'}
        if not isinstance(preferencias, dict):
            return {'success': False, 'error': 'As preferências precisam ser um objeto.'}
        _, erro_tela, padroes, gravadas = _ler_tela_e_preferencias(caminho)
        if padroes and not erro_tela:
            preferencias = {k: v for k, v in preferencias.items() if k in padroes}
        destino = os.path.join(caminho_absoluto(caminho), XT_PREFERENCIAS)
        try:
            os.makedirs(os.path.dirname(destino), exist_ok=True)
            with open(destino, 'w', encoding='utf-8') as f:
                json.dump(preferencias, f, ensure_ascii=False, indent=2)
        except OSError as e:
            return {'success': False, 'error': str(e)}
        # `configuracao.mudou` — lado BACKEND (decidido em 23/09/2026): é o que
        # o `backend/extensao.py` e o boot de uma extensão não tinham como
        # saber. O frontend dela já sabe por `xtPreferenciasMudaram_{slug}`.
        # Só as chaves que mudaram de VALOR (efetivo: padrão + gravado); um
        # Salvar sem mudança nenhuma não avisa.
        antes, depois = {**padroes, **gravadas}, {**padroes, **preferencias}
        chaves = sorted(k for k in set(antes) | set(depois) if antes.get(k) != depois.get(k))
        if chaves:
            emitir('configuracao.mudou',
                   {'origem': 'extensao', 'extensao': caminho, 'chaves': chaves})
        return self.list_telas_de_extensoes()
