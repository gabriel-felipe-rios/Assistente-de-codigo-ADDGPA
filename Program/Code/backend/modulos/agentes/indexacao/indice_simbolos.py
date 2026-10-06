"""A rotina Índice de Símbolos: mantém `Análise/Índice de Símbolos.json` em dia
a cada ciclo, refazendo só os arquivos que mudaram. Sem IA.

O índice existia antes da rotina — `build_symbol_index` (`modulos/indexacao.py`)
—, mas só se refazia quando faltava ou pelo botão da aba Análise, e no projeto
vivo chegou a ficar um mês velho. Identificadores, Duplicados, Pipeline e a
Documentação Técnica partem dele.

Duas passadas:
- **completa** — sem lista do que mudou (▶ do card, primeira vez, sem linha de
  base) ou sem estado anterior no disco: `build_symbol_index` inteiro, e o md5
  de cada arquivo vai para `_hashes.json`;
- **incremental** — com `mudados` (caminhos absolutos que o ciclo já calcula):
  relê só esses e os que não estão em `_hashes.json`, e tira do índice o
  arquivo que sumiu.

A leitura de UM arquivo é `_idx_simbolos_do_arquivo`, a mesma da passada
completa: duas cópias do parse divergiriam no primeiro ajuste.
"""

import hashlib

from ...constantes import *
from ..resumo_de_rotina import gravar_resumo_de_falha


def _normalizar(caminho):
    """O mesmo arquivo escrito de dois jeitos (barra, caixa) é um arquivo só."""
    return os.path.normcase(os.path.normpath(caminho))


def _md5_do_arquivo(fpath):
    try:
        with open(fpath, 'rb') as f:
            return hashlib.md5(f.read()).hexdigest()
    except OSError:
        return None


class IndiceSimbolosMixin:

    # ── Caminhos e aviso para a tela ──────────────────────────────────────

    def _is_dir(self, project_name):
        return obter_pasta_da_rotina(project_name, 'indice-simbolos')

    def _is_notify(self, project_name, payload):
        # Callback PRÓPRIO, como o de Comentários: reusar o de outra rotina
        # faria o fim de uma repintar o card da outra. `project` no payload: o
        # front ignora o evento de um projeto que não é o exibido.
        payload = {**payload, 'project': project_name}
        try:
            self.window.evaluate_js('indiceSimbolosAgentProgress(%s)' % json.dumps(payload))
        except Exception:
            pass

    def _is_ler_json(self, caminho):
        try:
            with open(caminho, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return None

    def _is_gravar_json(self, caminho, dados):
        os.makedirs(os.path.dirname(caminho), exist_ok=True)
        with open(caminho, 'w', encoding='utf-8') as f:
            json.dump(dados, f, ensure_ascii=False)

    # ── A passada ─────────────────────────────────────────────────────────

    def atualizar_indice_de_simbolos(self, project_name, mudados):
        """Completa ou incremental (ver o cabeçalho). Devolve o resumo gravado."""
        pasta = self._is_dir(project_name)
        hashes_path = os.path.join(pasta, '_hashes.json')
        index_path = obter_arquivo_de_indice_de_simbolos(project_name)
        hashes = self._is_ler_json(hashes_path)
        indice = self._is_ler_json(index_path)

        if mudados is None or not isinstance(indice, dict) or not isinstance(hashes, dict):
            r = self.build_symbol_index(project_name)
            if not r.get('success'):
                raise RuntimeError(r.get('error') or 'o Índice de Símbolos não pôde ser montado')
            hashes = {}
            refeitos = 0
            for fpath, _folder, _lang in self._idx_arquivos_elegiveis(project_name):
                md5 = _md5_do_arquivo(fpath)
                if md5:
                    hashes[fpath] = md5
                refeitos += 1
            removidos = 0
            total = r.get('total_symbols', 0)
            modo = 'completo'
        else:
            mudados_norm = {_normalizar(p) for p in mudados}
            elegiveis = {fpath: (folder, lang)
                         for fpath, folder, lang in self._idx_arquivos_elegiveis(project_name)}
            alvo = {f for f in elegiveis
                    if _normalizar(f) in mudados_norm or f not in hashes}
            removidos_set = {f for f in hashes if f not in elegiveis}
            fora = alvo | removidos_set
            simbolos = [s for s in (indice.get('symbols') or []) if s.get('file') not in fora]

            parser_cache = {}
            for fpath in sorted(alvo):
                folder, lang = elegiveis[fpath]
                syms = self._idx_simbolos_do_arquivo(fpath, folder, lang, parser_cache)
                if syms:
                    simbolos.extend(syms)
                md5 = _md5_do_arquivo(fpath)
                if md5:
                    hashes[fpath] = md5
            for f in removidos_set:
                hashes.pop(f, None)

            simbolos.sort(key=lambda s: s['name'].lower())
            self._is_gravar_json(index_path, {
                'built_at': datetime.now().isoformat(),
                'total_files': len(hashes),
                'total_symbols': len(simbolos),
                'symbols': simbolos,
            })
            refeitos = len(alvo)
            removidos = len(removidos_set)
            total = len(simbolos)
            modo = 'incremental'

        self._is_gravar_json(hashes_path, hashes)
        resumo = {
            # O ciclo lê o `finished_at` para saber que a passada terminou.
            'finished_at': datetime.now().isoformat(),
            'modo': modo,
            'refeitos': refeitos,
            'removidos': removidos,
            'total_simbolos': total,
        }
        self._is_gravar_json(os.path.join(pasta, '_resumo.json'), resumo)
        return resumo

    # ── API para a tela e para o ciclo ────────────────────────────────────

    def run_indice_simbolos_agent(self, project_name, mudados_pre=MUDADOS_AUTO):
        def worker():
            try:
                self._is_notify(project_name, {'status': 'running'})
                resumo = self.atualizar_indice_de_simbolos(
                    project_name, None if mudados_pre == MUDADOS_AUTO else mudados_pre)
                self._is_notify(project_name, {'status': 'done', **resumo})
            except Exception as e:
                # Sem `_resumo.json`, o ciclo vê a thread morrer e derruba as
                # rotinas seguintes — o mesmo motivo escrito em `bibliotecas.py`.
                gravar_resumo_de_falha(project_name, 'indice-simbolos', str(e))
                self._is_notify(project_name, {'status': 'error', 'error': str(e)})

        # A referência da thread fica registrada: é o que deixa o ciclo
        # saber que esta rotina continua viva (ver processando.py).
        self._proc_iniciar(project_name, 'indice-simbolos', worker)
        return {'success': True}

    def get_indice_simbolos_status(self, project_name):
        resumo = self._is_ler_json(os.path.join(self._is_dir(project_name), '_resumo.json'))
        if not isinstance(resumo, dict):
            return {'success': True, 'existe': False, 'gerado_em': None,
                    'total_simbolos': 0, 'modo': None}
        return {
            'success': True,
            'existe': True,
            'gerado_em': resumo.get('finished_at'),
            'total_simbolos': resumo.get('total_simbolos', 0),
            'modo': resumo.get('modo'),
            'error': resumo.get('error'),
        }
