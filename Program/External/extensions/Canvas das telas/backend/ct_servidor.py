"""O servidor das telas: serve a pasta do projeto, injeta o script-ponte na
CÓPIA de cada página, e recusa o que seria o backend do site.

⚠️ COPIADO, NÃO IMPORTADO. O desenho é o de `Servidor local com recarga/
backend/svl_servidor.py`; importar de lá faria esta extensão quebrar em
silêncio quando aquela fosse desligada (P2, D41).

Quem o sobe é `ct_acoes.subir`, e quem o derruba é o PROGRAMA: ele nasce como
processo gerenciado, e cai ao desligar a extensão ou fechar a janela.

⚠️ `criar` prende a porta ANTES da thread (`rodar`): o OSError da porta
ocupada tem de voltar a quem pediu, e não morrer dentro de uma thread.
"""

import io
import os
import re
import socket
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from . import ct_caminhos
from . import ct_dados

_PONTE = b'<script src="/__ct/ponte.js"></script>'
_FIM_DO_BODY = re.compile(rb'</body\s*>', re.IGNORECASE)
_RECUSA = 'não disponível — o Canvas das telas não roda o backend do site'.encode('utf-8')

# `/__ct/limpar`: o cabeçalho `Clear-Site-Data` apaga tudo do endereço; o
# script é a garantia para quando o navegador não o obedece (D45).
_LIMPAR = b'''<!doctype html><meta charset="utf-8"><title>limpo</title>
<script>
(function () {
  try { localStorage.clear(); } catch (e) {}
  try { sessionStorage.clear(); } catch (e) {}
  try {
    if (window.indexedDB && indexedDB.databases) {
      indexedDB.databases().then(function (bancos) {
        bancos.forEach(function (b) { if (b.name) indexedDB.deleteDatabase(b.name); });
      });
    }
  } catch (e) {}
  try {
    document.cookie.split(';').forEach(function (c) {
      var nome = c.split('=')[0].trim();
      if (nome) document.cookie = nome + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    });
  } catch (e) {}
})();
</script>'''


class _ServidorExclusivo(ThreadingHTTPServer):
    # ⚠️ PORTA EXCLUSIVA. No Windows, `SO_REUSEADDR` deixa DOIS processos
    # escutarem a mesma porta sem erro nenhum.
    allow_reuse_address = False
    daemon_threads = True

    def server_bind(self):
        if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        ThreadingHTTPServer.server_bind(self)


class _Handler(SimpleHTTPRequestHandler):
    pasta = None

    def translate_path(self, path):
        self.directory = self.pasta
        return SimpleHTTPRequestHandler.translate_path(self, path)

    def log_message(self, formato, *args):
        pass    # uma linha por pedido afogaria o terminal do programa

    def end_headers(self):
        # ⚠️ Em TODA resposta, inclusive as da biblioteca: a tela tem de ver o
        # arquivo como está agora, não o de antes do Ctrl+S.
        self.send_header('Cache-Control', 'no-store')
        SimpleHTTPRequestHandler.end_headers(self)

    def _responder(self, codigo, tipo, corpo, extras=None):
        self.send_response(codigo)
        self.send_header('Content-Type', tipo)
        self.send_header('Content-Length', str(len(corpo)))
        for nome, valor in (extras or {}).items():
            self.send_header(nome, valor)
        self.end_headers()
        if self.command != 'HEAD':
            try:
                self.wfile.write(corpo)
            except OSError:
                pass    # o navegador fechou a conexão no meio

    def _recusar(self):
        """O backend do site não roda: nada é gravado (D46)."""
        self._responder(503, 'text/plain; charset=utf-8', _RECUSA)

    def _existe(self):
        return os.path.exists(self.translate_path(self.path))

    def do_GET(self):
        rota = self.path.split('?', 1)[0]
        if rota == '/__ct/ponte.js':
            try:
                corpo = ct_dados.ler_texto(ct_caminhos.PONTE_DA_PAGINA).encode('utf-8')
            except OSError:
                corpo = b''
            self._responder(200, 'text/javascript; charset=utf-8', corpo)
            return
        if rota == '/__ct/limpar':
            self._responder(200, 'text/html; charset=utf-8', _LIMPAR,
                            {'Clear-Site-Data': '"cache", "cookies", "storage"'})
            return
        if not self._existe():
            self._recusar()
            return
        SimpleHTTPRequestHandler.do_GET(self)

    def do_HEAD(self):
        if not self._existe():
            self._recusar()
            return
        SimpleHTTPRequestHandler.do_HEAD(self)

    def do_POST(self):
        self._recusar()

    do_PUT = do_PATCH = do_DELETE = do_POST

    def send_head(self):
        """Injeta o script-ponte em todo `.html` servido.

        ⚠️ AQUI, e não num `copyfile`: o `Content-Length` tem de contar o
        trecho injetado. ⚠️ O arquivo em disco nunca muda — a injeção é só na
        cópia entregue.
        """
        caminho = self.translate_path(self.path)
        # ⚠️ A RAIZ TAMBÉM. `GET /pasta/` resolve para uma PASTA, e o
        # `send_head` da biblioteca escolheria o `index.html` sem passar por
        # aqui — a página sairia sem a ponte.
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
        m = _FIM_DO_BODY.search(corpo)
        if m:
            corpo = corpo[:m.start()] + _PONTE + corpo[m.start():]
        else:
            corpo += _PONTE
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(corpo)))
        self.end_headers()
        return io.BytesIO(corpo)


def criar(porta, pasta):
    """Prende a porta AGORA (lança OSError se ocupada)."""
    handler = type('_H', (_Handler,), {'pasta': pasta})
    # ⚠️ `127.0.0.1`, NUNCA `0.0.0.0`: é a pasta de código do usuário.
    return _ServidorExclusivo(('127.0.0.1', porta), handler)


def rodar(servidor, parar):
    """O alvo do processo gerenciado: serve até `parar` acender.

    ⚠️ `parar.wait()` e não `time.sleep()`: o `wait` acorda na hora.
    """
    t = threading.Thread(target=servidor.serve_forever, name='ct-http', daemon=True)
    t.start()
    try:
        parar.wait()
    finally:
        servidor.shutdown()
        servidor.server_close()
