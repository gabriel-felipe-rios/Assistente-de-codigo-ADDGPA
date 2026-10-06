"""O manifesto ANTIGO (sem `acrescenta`) traduzido para a forma nova.

Pergunta que este arquivo responde: "um `extensao.json` do formato antigo —
com `encaixes`, `eventos`, `consultas`, `dados` e os números de 1 a 27 em
`tipos` — vira que itens de `acrescenta`?". Saiu de `validacao.py` na fase
07 da discussão «Qualidade da documentação» pelo teto de 500 linhas da AMF:
`validacao.py` ganhou os recursos `ferramenta` e `prompt` e já tinha 509.
Quem chama é `manifesto.ler_manifesto`.

⚠️ Os números antigos e novos SE SOBREPÕEM ("2" antigo é Categoria de
Configurações, "2" novo é Muda uma tela). É a chave `acrescenta` que diz o
formato — nunca o número.
"""

from .constantes import XT_TIPOS_ANTIGOS, XT_TIPOS_ANTIGOS_REMOVIDOS
from .encaixes import XT_PONTOS_POR_NOME, validar_encaixes
from .eventos import validar_eventos
from .consulta import XT_CONSULTAS_POR_NOME, validar_consultas
from .validacao import (_lista, _ler_tipos, tipos_deduzidos, _DADOS_DE_VOLTA,
                        DADOS_EM_PASTA)


def _erro_de_removido(numero):
    nome = XT_TIPOS_ANTIGOS_REMOVIDOS[numero]
    return ('o tipo %s (%s) foi removido: o programa já tem %s, e a extensão '
            'serve para acrescentar o que ele não tem.'
            % (numero, nome, {'23': 'temas', '25': 'presets de modelo',
                              '26': 'presets de Acervo'}[numero]))


def _tipo_antigo(chave):
    if chave in XT_TIPOS_ANTIGOS:
        return XT_TIPOS_ANTIGOS[chave], None
    if chave in XT_TIPOS_ANTIGOS_REMOVIDOS:
        return None, _erro_de_removido(chave)
    return None, 'tipo antigo sem equivalente: "%s".' % chave


def traduzir_formato_antigo(caminho_relativo, bruto):
    """`(erros, tipos, acrescenta)` do manifesto sem `acrescenta`.

    Os três validadores de sempre rodam como estão; cada resultado vira um
    item com `id` gerado (`#encaixe-0`, `#evento-1`…) — local, sem prefixo, e
    por isso nunca comparado entre extensões."""
    erros = []
    dados = bruto.get('dados')
    if dados is not None and not isinstance(dados, dict):
        erros.append('`dados` precisa ser um objeto `{tipo: arquivo}`.')
        dados = {}
    dados = {str(k): v for k, v in (dados or {}).items()}

    def traduzir(chave):
        # Tipo de dado sem a entrada em `dados` não entrega nada — e o sintoma
        # seria a extensão ligada sem efeito nenhum. Sai da lista (regra de antes).
        if chave in _DADOS_DE_VOLTA and not isinstance(dados.get(chave), str):
            return None, ('o tipo %s precisa de uma entrada em `dados` dizendo qual '
                          'arquivo traz o dado. Sem ela o tipo não vale.' % chave)
        return _tipo_antigo(chave)

    erros_t, tipos = _ler_tipos(bruto.get('tipos'), traduzir)
    erros.extend(erros_t)
    declarados = ({str(t).strip() for t in bruto['tipos']}
                  if isinstance(bruto.get('tipos'), list) else set())

    acrescenta = []
    listas = {}
    for campo in ('encaixes', 'eventos', 'consultas'):
        erro_l, listas[campo] = _lista(bruto.get(campo), campo)
        erros.extend(erro_l)

    erros_e, encaixes = validar_encaixes(caminho_relativo, listas['encaixes'])
    erros.extend(erros_e)
    for i, e in enumerate(encaixes):
        recurso = XT_PONTOS_POR_NOME[e['ponto']]['recursos'][0]
        item = {'recurso': recurso, 'id': '#encaixe-%d' % i, 'arquivo': e['arquivo']}
        if recurso == 'comando':
            item.update(lugares=[e['ponto']], teclas={})
        else:
            item['lugar'] = e['ponto']
        acrescenta.append(item)

    erros_v, eventos = validar_eventos(caminho_relativo, listas['eventos'])
    erros.extend(erros_v)
    for i, e in enumerate(eventos):
        acrescenta.append({'recurso': 'reacao', 'id': '#evento-%d' % i, 'evento': e['nome'],
                           'pode_barrar': e['guardia'], 'arquivo': e['arquivo'],
                           'lado': e['lado']})

    erros_c, consultas = validar_consultas(caminho_relativo, listas['consultas'])
    erros.extend(erros_c)
    for i, c in enumerate(consultas):
        acrescenta.append({'recurso': 'editor', 'id': '#consulta-%d' % i,
                           'parte': XT_CONSULTAS_POR_NOME[c['nome']]['parte'],
                           'linguagens': ['*'], 'arquivo': c['arquivo']})

    for k, v in dados.items():
        if k in XT_TIPOS_ANTIGOS_REMOVIDOS:
            if k not in declarados:     # o erro já saiu uma vez, pelo `tipos`
                erros.append(_erro_de_removido(k))
            continue
        if k not in _DADOS_DE_VOLTA:
            erros.append('`dados["%s"]`: tipo antigo sem equivalente.' % k)
            continue
        if not isinstance(v, str) or not v.strip():
            erros.append('`dados["%s"]` precisa ser o nome de um arquivo, e veio %s.'
                         % (k, type(v).__name__))
            continue
        if k not in declarados:
            continue                    # como antes: dado sem o tipo não era lido
        recurso, parte = _DADOS_DE_VOLTA[k]
        item = {'recurso': recurso, 'id': '#dados-%s' % k, 'parte': parte}
        if recurso == 'editor':
            item['linguagens'] = ['*']
        item['pasta' if k in DADOS_EM_PASTA else 'arquivo'] = v.strip()
        acrescenta.append(item)

    # O "2" antigo some sem erro. Se ele era tudo o que sobrou, os tipos saem
    # dos recursos traduzidos; sem recurso nenhum (a antiga "categoria de
    # Configurações" feita só por código), a extensão liga com `["2"]` —
    # resposta do usuário ao "Pergunte antes" 4 da fase 10 (23/09/2026).
    if not tipos and acrescenta:
        tipos = tipos_deduzidos(acrescenta)
    elif not tipos and not erros_t and declarados:
        tipos = ['2']
    return erros, tipos, acrescenta
