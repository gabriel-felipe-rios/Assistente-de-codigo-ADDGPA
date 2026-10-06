import sys
import os
import json
import threading
from pathlib import Path

# Garante que o backend seja importável independente de onde o script for chamado
ROOT = os.path.dirname(os.path.abspath(__file__))
PROGRAM = os.path.join(ROOT, 'Program')
# O cache compilado do Python (`__pycache__`) NÃO fica ao lado do código: a AMF
# manda cache de ferramenta para `Internal/cache/<ferramenta>/`. Tem de vir
# ANTES do primeiro import do backend — o prefixo só vale para o que ainda não
# foi importado. Os dois servidores MCP são processos próprios e têm a mesma
# linha cada um (`Program/Code/server/*/servidor.py`).
sys.pycache_prefix = os.path.join(PROGRAM, 'Internal', 'cache', 'pycache')
sys.path.insert(0, os.path.join(PROGRAM, 'Code', 'backend'))
# AMF § 9.6: o que o pip instalou (hoje só o Tree-sitter) vem primeiro; vazia ou ausente, não muda nada.
sys.path.insert(0, os.path.join(PROGRAM, 'Dependencies'))

import webview
from api import Api

# URI file:// faz o WebView2 carregar o arquivo diretamente, sem servidor HTTP interno.
# Isso evita conflito de porta (o servidor usaria porta fixa 42001) e acelera o startup.
FRONTEND_URI = Path(PROGRAM, 'Code', 'frontend', 'index.html').as_uri()

if __name__ == '__main__':
    api = Api()
    window = webview.create_window(
        title='Assistente de código',
        url=FRONTEND_URI,
        js_api=api,
        width=1100,
        height=700,
        min_size=(800, 540),
        background_color='#2C3E50',
    )
    # O pywebview varre recursivamente os atributos públicos do js_api para montar
    # a ponte JS. Sem esta marca ele entraria em api.window -> window.native (o Form
    # do WinForms) e percorreria objetos .NET infinitamente (Bounds.Empty.Empty...),
    # estourando o limite de recursão e poluindo o terminal de erros.
    window._serializable = False
    api.window = window

    # Fechar a janela NÃO mata o processo sozinho: Espelho, Doc Técnica e
    # Resumo de Pastas rodam em `ThreadPoolExecutor`, e as threads dele não são
    # daemon — o Python (via `atexit`, em concurrent.futures.thread) espera
    # elas terminarem antes de encerrar de verdade. Com um ciclo grande em
    # andamento, o processo ficava vivo escondido, sem janela, ainda mandando
    # requisição pro LM Studio minutos depois de "fechado".
    # `os._exit` pula esse atexit e qualquer cleanup do interpretador — é
    # bruto de propósito: o usuário fechou a janela, a intenção é parar tudo
    # AGORA, não esperar o lote em voo acabar.
    def ao_fechar():
        # ⚠️ OS TERMINAIS MORREM ANTES DO PROGRAMA, e esta linha é a correção de
        # um vazamento caro. No Windows filho não morre com o pai: fechar a
        # janela deixava cada `cmd.exe` da Oficina vivo — e, dentro dele, o
        # assistente externo, consumindo cota paga por tempo indeterminado. O
        # usuário via a sessão continuar de pé no aplicativo do produto depois
        # de ter fechado tudo aqui.
        #
        # Reabrir o programa não resolvia: o registro de processos é de MEMÓRIA
        # (é o que `trabalhos_shell.py` explica no topo), então o PID ia embora
        # junto com a janela e não sobrava a quem pedir a morte.
        #
        # Vem ANTES do `os._exit` de propósito, e é a única coisa que vem: cada
        # `taskkill` tem teto de 10 s, e o `try` garante que um terminal teimoso
        # não impeça o programa de fechar.
        try:
            api.fechar_todos_os_shells()
        except Exception:
            pass
        # As extensões que rodam sozinhas (`extensao_boot.py`) param de
        # verdade: o contrato promete que `parar()` roda ao desligar, e fechar
        # o programa é o desligar de todas. Um orçamento só para o conjunto
        # (`XT_TETO_FECHAR_S`), e o `try` pelo mesmo motivo dos terminais.
        try:
            api.parar_extensoes_ao_fechar()
        except Exception:
            pass
        os._exit(0)

    window.events.closed += ao_fechar

    # ── O ponto de veto: perguntar antes de encerrar ─────────────────────────
    # `closed` acima roda DEPOIS de a janela fechar — não dá para desistir dali.
    # `closing` é o único ponto em que ainda dá: devolver `False` cancela o
    # fechamento e devolve a janela ao laço de mensagens, viva e clicável.
    #
    # ⛔ NUNCA chamar `evaluate_js` de dentro deste handler. Ele roda na thread
    # da UI, e `evaluate_js` espera essa MESMA thread responder: a janela
    # congela sem saída, e só o Gerenciador de Tarefas resolve. Por isso o modal
    # é aberto de uma Thread, e o handler devolve `False` na hora — a pergunta
    # aparece milissegundos depois, com a janela já de volta ao normal.
    #
    # ℹ️ Rede de segurança que já existe: um handler que ESTOURA não trava nada
    # — a janela fecha normalmente. Só o que BLOQUEIA trava. Por isso o `try`
    # cobre tudo e o caminho de erro deixa fechar.
    def ao_tentar_fechar():
        if getattr(api, '_encerramento_confirmado', False):
            return  # o "Sim" já foi dado: deixa fechar, e não pergunta de novo
        try:
            decisao = api.deve_confirmar_encerramento()
            if not decisao.get('perguntar'):
                # ⚠️ Mesmo sem perguntar, o pedaço de resposta que já foi pago
                # vai para o disco antes de o processo morrer — senão a config
                # "Nunca" apagaria o trabalho E a pergunta.
                api.gravar_parciais_antes_de_encerrar()
                return
            threading.Thread(
                target=lambda: window.evaluate_js(
                    'confirmarEncerramento(%s)' % json.dumps(decisao.get('motivo') or '')),
                daemon=True).start()
            return False
        except Exception:
            return  # nunca impedir o programa de fechar por causa daqui

    window.events.closing += ao_tentar_fechar

    webview.start(debug=False)
