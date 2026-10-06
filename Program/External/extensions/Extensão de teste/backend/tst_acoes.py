"""O que cada ação faz. Não monta caminho e não abre arquivo — isso é dos
irmãos `tst_caminhos.py` e `tst_dados.py`, que esta extensão não precisa ter
porque ela não grava nada.
"""

# ⚠️ O módulo é importado UMA vez, ao ligar, e fica de pé até desligar. É o
# contrário do plugin, que reimporta a cada chamada — e é o que permite ter
# estado. A outra face disso: editar este arquivo não tem efeito nenhum
# enquanto a extensão está ligada. Desligue e religue.
_chamadas = 0


def ola(payload):
    global _chamadas
    _chamadas += 1

    # ⚠️ AS PREFERÊNCIAS VÊM NO PAYLOAD, já resolvidas: o PROGRAMA lê
    # `config/preferencias.json` por cima dos `padrao` do `config/tela.json`
    # e entrega em `payload['preferencias']` (parte 11 do contrato). A
    # extensão não abre esse arquivo, e os padrões moram num lugar só — o
    # `tela.json`. Até 05/09/2026 cada extensão repetia a mesma leitura num
    # `{pfx}_config.py` próprio, com os padrões copiados.
    prefs = payload.get('preferencias') or {}
    quem = prefs.get('saudacao') or 'Olá'
    # `pasta_projeto` também é do programa — acrescentada porque o payload
    # trouxe `projeto`. Não se monta este caminho à mão.
    projeto = payload.get('projeto') or '(nenhum projeto aberto)'
    pasta = payload.get('pasta_projeto') or '(sem pasta de código)'

    # `print` é o log do backend — sai no terminal de onde o programa foi
    # lançado. Prefixado, senão a linha aparece no meio de dezenas sem dono.
    print('[tst] ola() chamada pela %dª vez' % _chamadas)

    return {
        'success': True,
        'mensagem': '%s — %s (%s). Chamada nº %d desde que a extensão ligou.'
                    % (quem, projeto, pasta, _chamadas),
    }
