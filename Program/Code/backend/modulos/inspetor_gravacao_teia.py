from .constantes import *
from .inspetor_gravacao_relatorio import InspetorGravacaoRelatorioMixin


class InspetorGravacaoTeiaMixin(InspetorGravacaoRelatorioMixin):
    """Análise estática por trás da sub-aba Gravação: a "teia" de código de um
    elemento clicado. Três camadas, da mais específica pra mais ampla:

    - **dispara**  (símbolo, 1 nível): o que o handler âncora chama.
    - **acionado_por** (símbolo): onde o nome do âncora é usado no projeto.
    - **relacoes** (arquivo): quais arquivos o arquivo do âncora usa / é usado
      por — robusto mesmo quando o âncora é fraco (ex.: um "uso no código"),
      caso em que dispara costuma vir vazio mas as relações do arquivo não.

    Reusa captura/candidatos do InspetorMixin e os índices (símbolos +
    identificadores). Separado de InspetorGravacaoMixin só pelo limite da AMF;
    o texto do relatório mora em `inspetor_gravacao_relatorio.py`, pelo mesmo
    motivo.
    """

    def inspetor_gravacao_teia(self, project_name, candidato):
        """Recalcula a teia pra um âncora trocado manualmente na revisão."""
        try:
            return {'success': True, 'teia': self._insp_grav_teia(project_name, candidato)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Âncora certeira: reordena os candidatos com lente de UI ──────────────
    # Um clique de interface quase sempre mora no FRONTEND (markup/JS/CSS), num
    # elemento de verdade — não numa string solta de um dict do backend que por
    # acaso tem o mesmo texto (era o que fazia a âncora cair errada). Reordena e
    # o 1º vira o âncora. Só afeta a Gravação; o Capturar mostra a lista inteira.
    # Sinais AGNÓSTICOS DE LINGUAGEM (não penalizar .py etc.): o que vale é o
    # PAPEL da linha — símbolo real e declaração de elemento de UI ganham;
    # comentário, docstring e string de dados/prosa perdem (só mencionam o texto).
    _INSP_GRAV_UI_RE = re.compile(
        r'<[a-z][\w-]*\b|data-|\bid\s*=|addeventlistener|onclick|on:click|@click|\.clicked|command\s*=|connect\s*\(')
    _INSP_GRAV_LITERAL_RE = re.compile(r'''['"][^'"]{0,60}['"]\s*[:,]''')
    _INSP_GRAV_COMENT_PREFIXOS = ('#', '//', '/*', '*', '<!--', '--')

    def _insp_grav_reordenar_candidatos(self, candidatos, rotulo=''):
        if not candidatos:
            return candidatos
        rl = (rotulo or '').strip().lower()
        return sorted(candidatos, key=lambda c: self._insp_grav_score(c, rl), reverse=True)

    def _insp_grav_score(self, c, rotulo_low=''):
        snip = (c.get('snippet') or c.get('name') or '')
        low = snip.lower()
        tipo = c.get('type', '')
        s = 0
        if tipo and tipo not in ('uso no código', 'elemento', 'seletor'):
            s += 4   # símbolo nomeado real (índice tree-sitter) — vale em qualquer linguagem
        elif tipo in ('elemento', 'seletor'):
            s += 3   # elemento/seletor de UI localizado
        if self._INSP_GRAV_UI_RE.search(low):
            s += 3   # a linha declara/liga um elemento de UI
        # O rótulo clicado é o TEXTO VISÍVEL do elemento (entre >...<), não só um
        # atributo (title/aria) — sinal forte de que é ESTE o elemento clicado.
        if rotulo_low and re.search(r'>\s*[^<]*' + re.escape(rotulo_low) + r'[^<]*<', low):
            s += 3
        if self._insp_grav_eh_comentario(snip):
            s -= 4   # comentário/docstring: menciona o texto, não é o elemento
        if self._INSP_GRAV_LITERAL_RE.search(snip):
            s -= 2   # string-literal em dict/objeto de dados
        s += {'alta': 2, 'media': 1}.get(c.get('confidence', ''), 0)
        return s

    def _insp_grav_eh_comentario(self, snip):
        s = (snip or '').strip()
        return bool(s) and (s.startswith(self._INSP_GRAV_COMENT_PREFIXOS) or '"""' in s or "'''" in s)

    def _insp_grav_eh_prosa_string(self, snip):
        """Linha que é essencialmente uma frase entre aspas (mensagem/texto), não
        uma referência de código ao elemento."""
        s = (snip or '').strip()
        return bool(s) and s[:1] in ('"', "'") and len(s.split()) >= 4

    def _insp_grav_ruido(self, snip):
        return self._insp_grav_eh_comentario(snip) or self._insp_grav_eh_prosa_string(snip)

    def _insp_grav_teia(self, project_name, anchor):
        if not anchor:
            return {'dispara': [], 'acionado_por': [], 'relacoes': {}}
        return {
            'dispara': self._insp_grav_dispara(project_name, anchor),
            'acionado_por': self._insp_grav_acionado_por(project_name, anchor),
            'relacoes': self._insp_grav_relacoes(project_name, anchor),
        }

    # ── Relações do arquivo (nível arquivo) ─────────────────────────────────
    def _insp_grav_relacoes(self, project_name, anchor, limite=8):
        """Quais arquivos o arquivo do âncora usa / é usado por, via índice de
        identificadores (mesma fonte da aba Relações). Precisa do caminho no
        formato do índice (relativo à working_folder, SEM o nome dela) — a
        âncora vem com o nome da pasta, então converte pelo caminho absoluto."""
        rel = self._insp_grav_caminho_indice(project_name, anchor.get('file') or '')
        if not rel or not hasattr(self, 'get_relacoes'):
            return {}
        try:
            r = self.get_relacoes(project_name, rel)
        except Exception:
            return {}
        if not r.get('success'):
            return {}
        return {
            'arquivo': rel,
            'usa': r.get('usa', [])[:limite],
            'usado_por': r.get('usado_por', [])[:limite],
        }

    def _insp_grav_caminho_indice(self, project_name, caminho_rel):
        """Converte o caminho de exibição da âncora (com o nome da pasta de
        trabalho) pro formato do índice de identificadores (relpath da working
        folder, com `/`). Retorna None se não resolver dentro de nenhuma pasta."""
        abs_path = self._inspetor_resolver_absoluto(project_name, caminho_rel)
        if not abs_path:
            return None
        ws = self.load_workspace(project_name)
        if not ws.get('success'):
            return None
        for folder in ws['config'].get('working_folders', []):
            if os.path.normcase(abs_path).startswith(os.path.normcase(folder)):
                return os.path.relpath(abs_path, folder).replace('\\', '/')
        return None

    def _insp_grav_token_busca(self, anchor):
        """Melhor token pro "quem me usa": um identificador de CÓDIGO tirado do
        snippet do âncora (`id="x"` ou `data-y="x"`) — específico do elemento —
        de preferência ao rótulo em prosa, que casaria o texto em qualquer lugar
        (comentários, títulos, mensagens). Sem id no snippet, cai no rótulo."""
        snip = anchor.get('snippet') or ''
        m = re.search(r'\bid\s*=\s*["\']([\w-]+)["\']', snip)
        if m:
            return m.group(1)
        m = re.search(r'\bdata-[\w-]+\s*=\s*["\']([\w-]+)["\']', snip)
        if m:
            return m.group(1)
        return self._inspetor_token_referencia(anchor)

    # ── Pra trás (símbolo): onde o âncora é usado ───────────────────────────
    def _insp_grav_acionado_por(self, project_name, anchor, limite=8):
        token = self._insp_grav_token_busca(anchor)
        if not token or len(token) < 3:
            return []
        usos = self.find_symbol_usages(project_name, token)
        if not usos.get('success'):
            return []
        alvo = (anchor.get('file') or '').replace('\\', '/')
        linha_alvo = anchor.get('line')
        vistos, saida = set(), []
        for u in usos.get('usages', []):
            if self._insp_grav_ruido(u.get('snippet') or ''):
                continue  # comentário/docstring/prosa só menciona o texto, não é uso real
            rel = self._inspetor_caminho_relativo(project_name, u['file']).replace('\\', '/')
            if rel == alvo and u.get('line') == linha_alvo:
                continue  # não repetir a definição do próprio âncora
            chave = (rel, u.get('line'))
            if chave in vistos:
                continue
            vistos.add(chave)
            saida.append({'file': rel, 'line': u.get('line'), 'snippet': (u.get('snippet') or '').strip()})
            if len(saida) >= limite:
                break
        return saida

    # ── Pra frente (símbolo): o que o handler dispara ───────────────────────
    def _insp_grav_dispara(self, project_name, anchor, limite=12):
        """Nomes definidos no projeto que aparecem no corpo do handler âncora (da
        linha dele até o próximo símbolo do arquivo, via índice), cruzados com os
        nomes de símbolo — cada acerto é uma chamada provável, resolvida pra
        file:line da definição."""
        idx = self.get_symbol_index(project_name)
        symbols = (idx.get('index') or {}).get('symbols', []) if idx.get('success') else []
        if not symbols:
            return []

        caminho_abs = self._inspetor_resolver_absoluto(project_name, anchor.get('file') or '')
        if not caminho_abs:
            return []
        linha_ini = anchor.get('line') or 0

        # Fim do corpo = próximo símbolo do mesmo arquivo (aprox. p/ "1 nível").
        norm = os.path.normcase(os.path.abspath(caminho_abs))
        linhas_no_arquivo = sorted(
            s['line'] for s in symbols
            if os.path.normcase(os.path.abspath(s.get('file', ''))) == norm and s.get('line', 0) > linha_ini)
        linha_fim = linhas_no_arquivo[0] - 1 if linhas_no_arquivo else linha_ini + 60

        try:
            with open(caminho_abs, 'r', encoding='utf-8', errors='ignore') as f:
                todas = f.readlines()
        except Exception:
            return []
        corpo = ''.join(todas[max(0, linha_ini):linha_fim])
        tokens_corpo = set(re.findall(r'\w+', corpo.lower()))

        # Mapa nome->definição (o 1º que aparecer), ignorando lixo de índice.
        defs = {}
        for s in symbols:
            nome = (s.get('name') or '').strip()
            nl = nome.lower()
            if not nl or len(re.sub(r'\W', '', nl)) < 4 or nl in self._INSP_STOPWORDS:
                continue
            if self._e_arquivo_minificado(os.path.basename(s.get('file', ''))):
                continue
            if nl not in defs:
                defs[nl] = s

        token_anchor = (self._inspetor_token_referencia(anchor) or '').lower()
        saida = []
        for nl, s in defs.items():
            if nl == token_anchor or nl not in tokens_corpo:
                continue
            saida.append({
                'name': s.get('name'),
                'type': s.get('type', ''),
                'file': self._inspetor_caminho_relativo(project_name, s.get('file', '')).replace('\\', '/'),
                'line': s.get('line', 0),
            })
            if len(saida) >= limite:
                break
        return saida
