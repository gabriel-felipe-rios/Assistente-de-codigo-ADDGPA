"""MCP "Outros projetos" — stdio, Python puro, sem SDK e SEM O PROGRAMA.

O que ele faz: responde, sobre OUTRO projeto cadastrado no Assistente de Código,
as mesmas 19 perguntas que o MCP Assistente responde sobre o projeto atual. É o
caminho inverso do "empacotar e trazer": em vez de você ir até o projeto antigo,
o assistente pergunta daqui.

Uso: python servidor.py [--enabled a,b,c] [--projetos "Um,Outro"]

⛔ **NÃO IMPORTA NADA DO PROGRAMA.** Nem `api.py`, nem `modulos/`, nem
`caminhos.py`, nem `catalogo_mcp.py`, nem `comum.py`. Este arquivo foi escrito
OLHANDO o `Program/Code/server/assistente/servidor.py`, e é a cópia consciente do
desenho dele — nunca uma importação. O motivo: este servidor é um item da
biblioteca, copiado para dentro do projeto do usuário, e o projeto vai para o
Git. Um import do programa faria dele um terceiro servidor do programa.

Três coisas herdadas do original são obrigatórias e fáceis de esquecer:

1. ⚠️ **`reconfigure(encoding='utf-8')` em `stdout` e `stdin`.** O Claude Code
   lança este processo com o stdout no code page do console (cp1252 no Windows),
   que não tem caracteres como "≤" — e as descrições daqui têm "≤", "→" e "⚠️".
   Sem isto **o handshake funciona e o `tools/list` mata o processo**: é o
   defeito mais difícil de diagnosticar desta obra, porque o sintoma é um
   servidor que conecta e some.
2. ⚠️ **Erro de ferramenta volta como TEXTO na resposta**, nunca como exceção
   que escapa do laço. Uma exceção solta derruba o servidor inteiro por causa de
   um nome de arquivo digitado errado.
3. ⚠️ **`protocolVersion` no `initialize`**, e `serverInfo` com nome próprio.

── A cerca ──
⚠️ **`--projetos` é a lista do que pode ser consultado**, e ela vem da tela: o
usuário marca, dentro do projeto onde este MCP está ligado, quais projetos ele
libera. Projeto fora da lista é RECUSADO com mensagem clara — nunca "não
encontrado", que faria o modelo concluir que o projeto não existe e desistir.

⚠️ **Lista vazia libera NADA**, e não tudo. Liberar tudo por omissão daria ao
assistente externo acesso a projetos que o usuário nunca pensou em abrir.
"""

import argparse
import json
import os
import sys

PROTOCOL_VERSION = '2024-11-05'
NOME_DO_SERVIDOR = 'outros-projetos'
VERSAO = '1.0.0'


def main():
    # ⚠️ ISTO VEM ANTES DE TUDO. Ver o item 1 do cabeçalho: sem esta reconfiguração
    # o `tools/list` mata o processo no primeiro caractere fora do cp1252, e o
    # sintoma é um servidor que conecta e some sem mensagem nenhuma.
    for fluxo in (sys.stdout, sys.stdin):
        try:
            fluxo.reconfigure(encoding='utf-8', errors='replace')
        except Exception:
            pass

    ap = argparse.ArgumentParser()
    ap.add_argument('--enabled', default='',
                    help='ferramentas ligadas, separadas por vírgula; vazio = todas')
    ap.add_argument('--projetos', default='',
                    help='projetos que podem ser consultados, separados por vírgula')
    args = ap.parse_args()

    # Os módulos irmãos moram na mesma pasta deste script — que é a CÓPIA dentro
    # do projeto do usuário, não o molde da biblioteca.
    aqui = os.path.dirname(os.path.abspath(__file__))
    if aqui not in sys.path:
        sys.path.insert(0, aqui)

    import leitura as L
    from catalogo import CATALOGO
    import ferramentas_codigo
    import ferramentas_docs
    import ferramentas_nativas

    # O handler de cada ferramenta, casado pelo campo `fn` do catálogo. Uma
    # entrada cujo handler não exista estoura AQUI, na subida, com o nome da
    # ferramenta — e não depois, na primeira chamada, com um KeyError mudo.
    modulos = (ferramentas_codigo, ferramentas_docs, ferramentas_nativas)
    handlers = {}
    for f in CATALOGO:
        for modulo in modulos:
            if hasattr(modulo, f['fn']):
                handlers[f['name']] = getattr(modulo, f['fn'])
                break
        else:
            raise RuntimeError('ferramenta "%s" sem handler "%s" em ferramentas_*.py'
                               % (f['name'], f['fn']))

    liberados = [p.strip() for p in args.projetos.split(',') if p.strip()]
    ligadas = {t.strip() for t in args.enabled.split(',') if t.strip()} or None
    ferramentas = [f for f in CATALOGO if (ligadas is None or f['name'] in ligadas)]
    por_nome = {f['name']: f for f in ferramentas}

    def responder(objeto):
        sys.stdout.write(json.dumps(objeto, ensure_ascii=False) + '\n')
        sys.stdout.flush()

    for bruto in sys.stdin:
        linha = bruto.strip()
        if not linha:
            continue
        try:
            mensagem = json.loads(linha)
        except Exception:
            continue
        mid = mensagem.get('id')
        metodo = mensagem.get('method')

        if metodo == 'initialize':
            responder({'jsonrpc': '2.0', 'id': mid, 'result': {
                'protocolVersion': PROTOCOL_VERSION,
                'capabilities': {'tools': {}},
                'serverInfo': {'name': NOME_DO_SERVIDOR, 'version': VERSAO},
            }})
        elif metodo in ('notifications/initialized', 'initialized'):
            pass  # notificação — sem resposta
        elif metodo == 'ping':
            responder({'jsonrpc': '2.0', 'id': mid, 'result': {}})
        elif metodo == 'tools/list':
            responder({'jsonrpc': '2.0', 'id': mid, 'result': {'tools': [
                {'name': f['name'], 'description': f['description'],
                 'inputSchema': f['schema']}
                for f in ferramentas]}})
        elif metodo == 'tools/call':
            parametros = mensagem.get('params', {}) or {}
            nome = parametros.get('name')
            chamada = parametros.get('arguments', {}) or {}
            ferramenta = por_nome.get(nome)
            if not ferramenta:
                responder({'jsonrpc': '2.0', 'id': mid, 'error': {
                    'code': -32602, 'message': 'Ferramenta desconhecida: %s' % nome}})
                continue
            texto = _executar(L, ferramenta, handlers[nome], chamada, liberados)
            responder({'jsonrpc': '2.0', 'id': mid, 'result': {
                'content': [{'type': 'text', 'text': texto or '(vazio)'}]}})
        elif mid is not None:
            responder({'jsonrpc': '2.0', 'id': mid, 'error': {
                'code': -32601, 'message': 'Método não suportado: %s' % metodo}})


def _executar(L, ferramenta, handler, args, liberados):
    """Roda uma ferramenta e devolve TEXTO — inclusive quando dá errado.

    ⚠️ Nenhuma exceção sobe daqui. As três classes de erro com mensagem escrita
    para o modelo (`ErroDeUso`, `NaoGerado`, `SemPrograma`) voltam com o texto
    delas; qualquer outra volta embrulhada, com o nome da ferramenta. Uma
    exceção que escapasse derrubaria o servidor inteiro.
    """
    nome = ferramenta['name']
    try:
        projeto = _projeto_pedido(L, ferramenta, args, liberados)
        texto = handler(projeto, args, liberados)
        # O carimbo de frescor só vai nas que leem ARTEFATO: o que varre o disco
        # na hora não tem como estar velho, e um aviso em toda resposta vira
        # ruído que o modelo aprende a ignorar.
        if projeto and ferramenta.get('fonte') == 'artefato':
            aviso = L.carimbo(projeto)
            if aviso:
                texto = '%s\n\n%s' % (texto, aviso)
        return texto
    except (L.ErroDeUso, L.NaoGerado, L.SemPrograma) as e:
        return str(e)
    except Exception as e:
        return 'Erro na ferramenta %s: %s' % (nome, e)


def _projeto_pedido(L, ferramenta, args, liberados):
    """O projeto a consultar, já checado contra a lista de liberados.

    ⚠️ **NUNCA ACEITA CAMINHO DE PASTA.** A fonte é sempre um nome de projeto
    cadastrado, e o caminho sai do `Workspace.json` daquele projeto — é isso que
    faz o recorte do usuário ser respeitado. Um caminho aqui transformaria este
    servidor num leitor de disco sem cerca.
    """
    if 'projeto' not in ferramenta['schema'].get('properties', {}):
        return ''       # a ferramenta `projetos`, que não consulta nenhum
    pedido = str(args.get('projeto') or '').strip()
    if not pedido:
        raise L.ErroDeUso(
            'informe o parâmetro "projeto" — o NOME de um projeto cadastrado. Chame '
            'a ferramenta `projetos` para ver os nomes liberados.')
    if os.path.isabs(pedido) or '/' in pedido or '\\' in pedido:
        raise L.ErroDeUso(
            '"%s" parece um caminho de pasta. O parâmetro "projeto" é o NOME do '
            'projeto como ele aparece no Assistente de Código — chame `projetos` '
            'para ver a lista.' % pedido)
    if not liberados:
        raise L.ProjetoRecusado(
            'nenhum projeto foi liberado para consulta. O usuário marca quais podem '
            'ser consultados na aba Arquivos → MCPs → "Outros projetos", dentro do '
            'projeto em que este servidor está ligado.')
    if pedido not in liberados:
        raise L.ProjetoRecusado(
            'o projeto "%s" NÃO está liberado para consulta — isto é uma decisão do '
            'usuário, não um projeto inexistente. Os liberados são: %s. Se você '
            'precisa deste, peça ao usuário para marcá-lo na aba Arquivos → MCPs → '
            '"Outros projetos".' % (pedido, ', '.join(liberados)))
    return pedido


if __name__ == '__main__':
    main()
