"""O servidor HTTP: servir uma pasta, injetar a recarga, prender a porta só
para si.

Quem o sobe é `svl_acoes.subir`, e quem o derruba é o PROGRAMA: o servidor
nasce como processo gerenciado (`payload['processos'].ligar`), e o programa o
para ao desligar a extensão ou fechar a janela. Até 23/09/2026 ele morava no
arquivo de boot da extensão e subia ao ligar, com a pasta lida do disco a cada
requisição; agora sobe no ▶ Executar, com a pasta fixa.

⚠️ `criar` prende a porta ANTES da thread (`rodar`). Se o bind acontecesse
dentro do alvo do processo, o OSError da porta ocupada morreria na thread e
ninguém o veria.
"""

import io
import os
import socket
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

# O trecho que faz a página recarregar sozinha. Oito linhas, injetadas antes do
# `</body>` de todo `.html` servido.
#
# ⚠️ Uma consulta por segundo a um endpoint que devolve um número — e não um
# WebSocket. O `http.server` da biblioteca padrão não fala WebSocket, e trazer
# uma biblioteca para isso seria trocar a coisa mais simples que funciona por
# uma dependência.
_RECARGA = b'''
<script>
(function () {
  var atual = null;
  setInterval(function () {
    fetch('/__svl/versao', { cache: 'no-store' })
      .then(function (r) { return r.text(); })
      .then(function (v) {
        if (atual === null) { atual = v; return; }
        if (v !== atual) location.reload();
      })
      .catch(function () { /* servidor caiu: nada a fazer */ });
  }, 1000);
})();
</script>
</body>'''

# O relógio da recarga, em memória (era o `mtime` de um arquivo em `files/`).
# A página só compara texto: qualquer valor que mude serve.
_versao = 0
_trava = threading.Lock()


def tocar_versao():
    """Um arquivo foi salvo: a página recarrega na próxima consulta."""
    global _versao
    with _trava:
        _versao += 1


def versao():
    with _trava:
        return _versao


class _ServidorExclusivo(ThreadingHTTPServer):
    # ⚠️ PORTA EXCLUSIVA (D21). O `HTTPServer` liga `allow_reuse_address`, e no
    # Windows `SO_REUSEADDR` deixa DOIS processos escutarem a mesma porta sem
    # erro nenhum — foi assim que um processo MCP respondia no lugar do programa.
    allow_reuse_address = False
    daemon_threads = True

    def server_bind(self):
        # ⚠️ `SO_EXCLUSIVEADDRUSE` só existe no Windows — o `hasattr` é o que
        # deixa este arquivo rodar em outro sistema.
        if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        ThreadingHTTPServer.server_bind(self)


class _Handler(SimpleHTTPRequestHandler):
    # A pasta servida. Fixa por servidor: `criar` faz uma subclasse com ela.
    pasta = None

    def translate_path(self, path):
        self.directory = self.pasta
        return SimpleHTTPRequestHandler.translate_path(self, path)

    def log_message(self, formato, *args):
        # O `http.server` escreve no stderr por padrão, uma linha por
        # requisição — e com a recarga consultando a cada segundo isso afogaria
        # o terminal do programa. Silêncio.
        pass

    def do_GET(self):
        if self.path.startswith('/__svl/versao'):
            self._responder(200, b'text/plain; charset=utf-8', str(versao()).encode('utf-8'))
            return
        SimpleHTTPRequestHandler.do_GET(self)

    def _responder(self, codigo, tipo, corpo):
        self.send_response(codigo)
        self.send_header('Content-Type', tipo.decode('ascii'))
        self.send_header('Content-Length', str(len(corpo)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        try:
            self.wfile.write(corpo)
        except OSError:
            pass   # o navegador fechou a conexão no meio: acontece, e não é erro

    def send_head(self):
        """Injeta o trecho de recarga em todo `.html` servido.

        ⚠️ AQUI, e não num `copyfile`: o `Content-Length` tem de contar o
        trecho injetado. Injetando depois do cabeçalho, o navegador cortaria a
        página no tamanho que o arquivo tem em disco — e o sintoma seria uma
        página que "às vezes" carrega incompleta.
        ⚠️ E aqui, e não num `<script>` que o usuário teria de pôr na página
        dele: a recarga é da ferramenta, não do projeto.
        """
        caminho = self.translate_path(self.path)
        # ⚠️ A RAIZ TAMBÉM. `GET /` (e `GET /pasta/`) resolve para uma PASTA, e
        # o `send_head` da biblioteca é quem escolhe o `index.html` de dentro
        # dela — sem passar por aqui. Até 05/09/2026 quem abria
        # `http://127.0.0.1:5500/` recebia a página sem o trecho de recarga. Se
        # a requisição termina em `/` (sem a barra a biblioteca redireciona, e
        # o redirecionamento fica com ela), o índice é resolvido aqui.
        if os.path.isdir(caminho) and self.path.split('?', 1)[0].endswith('/'):
            for indice in ('index.html', 'index.htm'):
                candidato = os.path.join(caminho, indice)
                if os.path.isfile(candidato):
                    caminho = candidato
                    break
        if not (os.path.isfile(caminho) and caminho.lower().endswith(('.html', '.htm'))):
            return SimpleHTTPRequestHandler.send_head(self)
        try:
            with open(caminho, 'rb') as f:
                corpo = f.read()
        except OSError:
            return SimpleHTTPRequestHandler.send_head(self)
        if b'</body>' in corpo:
            corpo = corpo.replace(b'</body>', _RECARGA, 1)
        else:
            corpo += _RECARGA.replace(b'</body>', b'')
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(corpo)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        return io.BytesIO(corpo)


def criar(porta, pasta):
    """Prende a porta AGORA (lança OSError se ocupada) — para o erro voltar
    a quem pediu, e não sumir dentro de uma thread."""
    handler = type('_H', (_Handler,), {'pasta': pasta})
    # ⚠️ `127.0.0.1`, NUNCA `0.0.0.0`. Este servidor serve a pasta de código do
    # usuário, e o programa é local por princípio.
    return _ServidorExclusivo(('127.0.0.1', porta), handler)


def rodar(servidor, parar):
    """O alvo do processo gerenciado: serve até `parar` acender.

    ⚠️ `parar.wait()` e não `time.sleep()`: o `wait` acorda na hora em que o
    programa acende o evento. Com `sleep`, o programa desistiria de esperar e
    a porta ficaria presa.
    """
    t = threading.Thread(target=servidor.serve_forever, name='svl-http', daemon=True)
    t.start()
    try:
        parar.wait()
    finally:
        servidor.shutdown()
        servidor.server_close()
