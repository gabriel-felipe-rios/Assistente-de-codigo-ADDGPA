"""Observar — o arranque do painel e o servidor local que o alimenta.

O que faz: sobe um servidor SÓ neste computador (127.0.0.1), abre o painel no
navegador e responde a três perguntas dele: o desenho dos fluxos
(`/api/pipeline`), os eventos novos do rastro (`/api/rastro`) e se o servidor
segue vivo (`/api/ping`).

O que NÃO faz: só responde a `GET`. Não escreve, não corrige e não reexecuta
nada do programa observado. Encerra sozinho quando o painel é fechado.

Uso:
    pythonw Observar.pyw               (ou dois cliques) abre o painel
    python Observar.pyw --porta 8765   porta fixa
    python Observar.pyw --sem-navegador
"""

import sys

sys.dont_write_bytecode = True

import argparse
import importlib.util
import json
import os
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

# --- AJUSTES DO PROJETO ---
VERSAO = "1.0"
RAIZ = Path(__file__).resolve().parent
PASTA_DO_PAINEL = RAIZ / "Workshop" / "observar"
RASTRO = RAIZ / "Program" / "Internal" / "logs" / "rastro.jsonl"
JANELA_TOKENS = None      # tamanho da janela do modelo, se o assistente souber (ex.: 32768); None esconde o «% da janela»
# --- FIM DOS AJUSTES ---

ESPERA_DEPOIS_DO_ULTIMO_PEDIDO_S = 180
ESPERA_SEM_NENHUM_PEDIDO_S = 300

_estado = {"primeiro": None, "ultimo": None, "inicio": time.time()}


def _log(*partes):
    try:
        print(*partes, flush=True)
    except Exception:
        pass


def _carregar_analisador():
    caminho = PASTA_DO_PAINEL / "analisador.py"
    especificacao = importlib.util.spec_from_file_location("analisador_do_painel", str(caminho))
    modulo = importlib.util.module_from_spec(especificacao)
    especificacao.loader.exec_module(modulo)
    return modulo


def _pipeline():
    try:
        dados = _carregar_analisador().analisar(RAIZ)
    except Exception as erro:
        dados = {"fluxos": [], "cruzamentos": [], "avisos": ["Falha ao ler o código: %s" % erro]}
    dados["projeto"] = RAIZ.name
    try:
        dados["rastro"] = RASTRO.relative_to(RAIZ).as_posix()
    except ValueError:
        dados["rastro"] = RASTRO.as_posix()
    dados["janela"] = JANELA_TOKENS
    dados.setdefault("avisos", [])
    return dados


def _rastro(desde):
    """Linhas completas do rastro a partir do byte `desde`."""
    if not RASTRO.is_file():
        return {"proximo": 0, "reiniciou": False, "eventos": []}
    reiniciou = False
    tamanho = RASTRO.stat().st_size
    if desde > tamanho:
        desde, reiniciou = 0, True
    with open(RASTRO, "rb") as arquivo:
        arquivo.seek(desde)
        bruto = arquivo.read()
    corte = bruto.rfind(b"\n")
    if corte < 0:
        return {"proximo": desde, "reiniciou": reiniciou, "eventos": []}
    bruto = bruto[:corte + 1]
    eventos = []
    for linha in bruto.split(b"\n"):
        if not linha.strip():
            continue
        try:
            eventos.append(json.loads(linha.decode("utf-8")))
        except Exception:
            continue
    return {"proximo": desde + len(bruto), "reiniciou": reiniciou, "eventos": eventos}


class Atendente(BaseHTTPRequestHandler):
    server_version = "Observar/" + VERSAO

    def log_message(self, *argumentos):
        pass

    def _responder(self, codigo, corpo, tipo):
        if isinstance(corpo, str):
            corpo = corpo.encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(corpo)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(corpo)

    def _json(self, dados):
        self._responder(200, json.dumps(dados, ensure_ascii=False), "application/json; charset=utf-8")

    def do_GET(self):
        agora = time.time()
        _estado["ultimo"] = agora
        if _estado["primeiro"] is None:
            _estado["primeiro"] = agora
        url = urlparse(self.path)
        if url.path in ("/", "/index.html"):
            painel = PASTA_DO_PAINEL / "painel.html"
            if painel.is_file():
                self._responder(200, painel.read_bytes(), "text/html; charset=utf-8")
            else:
                self._responder(200, "O painel ainda não foi copiado.\nCopie painel.html para:\n%s\n" % painel,
                                "text/plain; charset=utf-8")
        elif url.path == "/api/pipeline":
            self._json(_pipeline())
        elif url.path == "/api/rastro":
            try:
                desde = max(0, int(parse_qs(url.query).get("desde", ["0"])[0]))
            except ValueError:
                desde = 0
            self._json(_rastro(desde))
        elif url.path == "/api/ping":
            self._json({"ok": True})
        else:
            self._responder(404, "Não encontrado.", "text/plain; charset=utf-8")

    def _recusar(self):
        self._responder(405, "Só leitura: este servidor responde apenas a GET.", "text/plain; charset=utf-8")

    do_POST = do_PUT = do_DELETE = do_PATCH = do_HEAD = do_OPTIONS = _recusar


def _vigiar():
    """Encerra o programa quando o painel some (o .pyw não tem console para fechar)."""
    while True:
        time.sleep(5)
        agora = time.time()
        if _estado["primeiro"] is None:
            if agora - _estado["inicio"] > ESPERA_SEM_NENHUM_PEDIDO_S:
                os._exit(0)
        elif agora - _estado["ultimo"] > ESPERA_DEPOIS_DO_ULTIMO_PEDIDO_S:
            os._exit(0)


def _principal():
    parser = argparse.ArgumentParser(description="Painel local para observar o sistema com LLM.")
    parser.add_argument("--porta", type=int, default=0, help="porta (padrão: a primeira livre)")
    parser.add_argument("--sem-navegador", action="store_true", help="não abre o navegador")
    argumentos = parser.parse_args()
    servidor = ThreadingHTTPServer(("127.0.0.1", argumentos.porta), Atendente)
    porta = servidor.server_address[1]
    endereco = "http://127.0.0.1:%d/" % porta
    _log("Painel em", endereco)
    threading.Thread(target=_vigiar, daemon=True).start()
    if not argumentos.sem_navegador:
        try:
            webbrowser.open(endereco)
        except Exception:
            pass
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    _principal()
