from .constantes import *


class InspetorRelatorioMixin:
    """Monta o texto que vai pra área de transferência e daí pra uma IA
    externa (ex.: Claude Code)."""

    # ── Relatório rico pra colar numa IA externa (ex.: Claude Code) ──────────
    # Antes o frontend montava só uma linha "candidato: arquivo:linha". Isso é
    # pobre: a IA recebe o caminho mas não o código, e tem que ir ler tudo de
    # novo. Aqui montamos um relatório com: identidade do elemento de UI, o
    # local no código, o TRECHO real de código em volta da linha, e outras
    # referências ao mesmo identificador no projeto — que é o que dá pra IA
    # tudo que ela precisa pra agir sem adivinhar.
    def _inspetor_token_referencia(self, candidato):
        """Identificador buscável pra "outras referências". Pra seletor CSS,
        extrai a 1ª classe/id (sem `.`/`#`); pra elemento HTML, o id/atributo;
        pra símbolo de código, o próprio nome."""
        nome = (candidato.get('name') or '').strip()
        tipo = candidato.get('type', '')
        if tipo == 'seletor':
            m = re.search(r'[.#]([A-Za-z_][\w-]+)', nome)
            return m.group(1) if m else ''
        if tipo == 'elemento':
            # Valor ESPECÍFICO de [attr="valor"] (ex.: ptab-arquivos) — não o nome
            # do atributo (data-ptab), que casaria todos os irmãos que o usam.
            m = re.search(r'\[[\w:-]+\s*[~|^$*]?=\s*["\']([^"\']+)["\']', nome)
            if m:
                return m.group(1)
            m = re.search(r'#([\w-]+)', nome)          # #id específico
            if m:
                return m.group(1)
            m = re.search(r'\[([\w-]+)', nome)          # último caso: nome do atributo
            if m:
                return m.group(1)
            return nome.split()[0] if nome else ''
        return nome

    def _inspetor_estilos_do_elemento(self, project_name, candidato):
        """A partir da linha de código do candidato (quando é um elemento HTML
        com class/id), acha as **regras CSS** que o estilizam e conta em quantos
        lugares cada classe é usada. É o que dá pra IA mudar a aparência (cor,
        etc.) no lugar certo — e saber quando uma classe é **compartilhada**
        (mexer nela afeta todos os outros elementos que a usam). Retorna
        `{'id', 'regras': [...], 'compartilhadas': {classe: n}}` ou `{}` se não
        for aplicável (candidato sem class/id na linha)."""
        linha = candidato.get('snippet') or ''
        id_elem = ''
        tokens = []  # (prefixo, nome)
        m = re.search(r'\bid\s*=\s*["\']([\w-]+)["\']', linha)
        if m:
            id_elem = m.group(1)
            tokens.append(('#', id_elem))
        m = re.search(r'\bclass\s*=\s*["\']([^"\']+)["\']', linha)
        if m:
            for cls in m.group(1).split():
                if cls and ('.', cls) not in tokens:
                    tokens.append(('.', cls))
        if not tokens:
            return {}

        workspace = self.load_workspace(project_name)
        if not workspace.get('success'):
            return {}
        folders = workspace['config'].get('working_folders', [])

        # Classes genéricas de estado: suas regras (`.active {}`) são ruído
        # (ex.: casam dentro de `:not(.active)` de outros componentes). Não geram
        # listagem de regra CSS — mas continuam contando pro aviso de classe
        # compartilhada. Regra específica (`.screen.active`) ainda aparece via o
        # token da classe específica (`.screen`).
        GENERICAS = self._INSP_STOPWORDS | {
            'active', 'hidden', 'disabled', 'selected', 'open', 'show', 'hide',
            'collapsed', 'expanded', 'loading', 'error', 'success', 'current',
        }
        # Seletor no início de uma regra: precedido de espaço/combinador e
        # seguido de espaço, vírgula, '{', ':', '.', '[' — assim `.btn` não casa
        # dentro de `.btn-positive`. Ids sempre entram; classes genéricas não.
        regra_pats = {(p, n): re.compile(
            r'(^|[\s,>+~(])' + re.escape(p + n) + r'([\s,{:.\[)]|$)')
            for (p, n) in tokens if p == '#' or n.lower() not in GENERICAS}
        uso_pats = {n: re.compile(r'\b' + re.escape(n) + r'\b') for (p, n) in tokens if p == '.'}

        regras, vistos = [], set()
        compartilhadas = {n: 0 for n in uso_pats}
        MAX = 500 * 1024
        for folder in folders:
            if not os.path.isdir(folder):
                continue
            for root, dirs, files in os.walk(folder):
                for f in sorted(files):
                    nome_lower = f.lower()
                    ext = os.path.splitext(nome_lower)[1]
                    if ext not in ('.css', '.html', '.htm', '.js'):
                        continue
                    if nome_lower.endswith('.min.css') or nome_lower.endswith('.min.js'):
                        continue
                    p = os.path.join(root, f)
                    try:
                        if os.path.getsize(p) > MAX:
                            continue
                        with open(p, 'r', encoding='utf-8', errors='ignore') as fh:
                            conteudo = fh.readlines()
                    except Exception:
                        continue
                    rel = self._inspetor_caminho_relativo(project_name, p)
                    for i, l in enumerate(conteudo, 1):
                        if ext == '.css':
                            for chave, pat in regra_pats.items():
                                if pat.search(l) and (rel, i) not in vistos:
                                    vistos.add((rel, i))
                                    regras.append({'selector': chave[0] + chave[1],
                                                   'file': rel, 'line': i,
                                                   'snippet': l.strip()[:160]})
                        else:  # html/js: conta uso das classes (aviso de compartilhamento)
                            if 'class' in l or 'classList' in l:
                                for n, up in uso_pats.items():
                                    if up.search(l):
                                        compartilhadas[n] += 1

        compartilhadas = {n: c for n, c in compartilhadas.items() if c > 1}
        return {'id': id_elem, 'regras': regras, 'compartilhadas': compartilhadas}

    def inspetor_montar_relatorio_ia(self, project_name, candidato, instrucao,
                                     captura, candidatos=None, total_candidatos=0):
        """Monta o texto que vai pra área de transferência, em DOIS níveis:

        - **sem candidato escolhido**: identidade do elemento + os candidatos
          prováveis, uma linha cada, com o aviso de corte. Nada de trecho, CSS
          ou referências — a IA ainda não sabe qual é o lugar certo.
        - **com candidato escolhido**: o pacote completo — trecho de código,
          regras de CSS e outras referências.

        A instrução é opcional: copiar nunca depende de escrever nada."""
        try:
            partes = []
            instrucao = (instrucao or '').strip()
            if instrucao:
                # A instrução vem PRIMEIRO (é o que a IA tem que fazer), seguida
                # de uma linha em branco e depois todo o contexto capturado. Sem
                # instrução, o relatório abre direto no contexto.
                partes.append('Instrução: %s' % instrucao)
                partes.append('')
            partes.append('Contexto — elemento de interface capturado pelo Inspetor '
                          'e já localizado no código-fonte:')
            partes.append('')
            uia = ((captura or {}).get('uia')) or {}

            partes.append('Elemento capturado:')
            partes.append('- Nome (rótulo visível): %s' % (uia.get('name') or '—'))
            if uia.get('automation_id'):
                partes.append('- AutomationId: %s' % uia['automation_id'])
            partes.append('- Tipo de controle: %s' % (uia.get('control_type') or '—'))
            if uia.get('texto') and uia.get('texto') != uia.get('name'):
                partes.append('- Texto visível: %s' % uia['texto'])
            if uia.get('caminho'):
                partes.append('- Caminho na árvore de UI: %s' % uia['caminho'])
            partes.append('')

            if candidato:
                arquivo = candidato.get('file', '')
                linha = candidato.get('line', 0)
                partes.append('Local provável no código:')
                partes.append('- Arquivo: %s' % arquivo)
                partes.append('- Linha: %s' % linha)
                partes.append('- Símbolo: %s (%s)' % (
                    candidato.get('name', ''), candidato.get('type', '')))
                partes.append('')

                trecho = self.inspetor_ler_trecho(project_name, arquivo, linha, contexto=6)
                if trecho.get('success'):
                    partes.append('Trecho de %s:' % arquivo)
                    partes.append('```')
                    for l in trecho['trecho']:
                        marca = '>' if l['numero'] == trecho['linha_alvo'] else ' '
                        partes.append('%s %s| %s' % (
                            str(l['numero']).rjust(5), marca, l['texto']))
                    partes.append('```')
                    partes.append('')
                else:
                    partes.append('(Não foi possível ler o trecho: %s)' % trecho.get('error', ''))
                    partes.append('')

                # Regras CSS que estilizam o elemento — essencial pra mudanças de
                # aparência (cor, tamanho…): diz onde a cor mora e avisa quando a
                # classe é compartilhada (mexer nela afeta os outros elementos).
                estilos = self._inspetor_estilos_do_elemento(project_name, candidato)
                regras = (estilos or {}).get('regras') or []
                if regras:
                    partes.append('Regras de estilo (CSS) que afetam este elemento:')
                    for r in regras[:12]:
                        partes.append('- %s:%s — %s' % (r['file'], r['line'], r['snippet']))
                    comp = estilos.get('compartilhadas') or {}
                    if comp:
                        lista = ', '.join('.%s (usada em ~%d lugares)' % (n, c)
                                          for n, c in sorted(comp.items()))
                        id_elem = estilos.get('id')
                        sugestao = ('crie/edite uma regra específica pelo id #%s' % id_elem
                                    if id_elem else 'crie uma regra específica só para este elemento')
                        partes.append('  ⚠ Classe(s) compartilhada(s): %s. Pra mudar SÓ este '
                                      'elemento, %s em vez de alterar a classe compartilhada.'
                                      % (lista, sugestao))
                    partes.append('')

                token = self._inspetor_token_referencia(candidato)
                if token:
                    usos = self.find_symbol_usages(project_name, token)
                    refs = usos.get('usages', []) if usos.get('success') else []
                    alvo = arquivo.replace('\\', '/')
                    vistos, filtradas = set(), []
                    for u in refs:
                        rel = (u.get('relative') or u.get('file', '')).replace('\\', '/')
                        if rel == alvo and u.get('line') == linha:
                            continue  # não repetir a própria linha do candidato
                        chave = (rel, u.get('line'))
                        if chave in vistos:
                            continue
                        vistos.add(chave)
                        filtradas.append((rel, u.get('line'), (u.get('snippet') or '').strip()))
                        if len(filtradas) >= 8:
                            break
                    if filtradas:
                        partes.append('Outras referências a "%s" no projeto:' % token)
                        for rel, ln, snip in filtradas:
                            partes.append('- %s:%s — %s' % (rel, ln, snip))
                        partes.append('')
            else:
                self._inspetor_relatorio_enxuto(partes, candidatos, total_candidatos)

            texto = '\n'.join(partes).rstrip() + '\n'
            return {'success': True, 'texto': texto}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _inspetor_relatorio_enxuto(self, partes, candidatos, total_candidatos):
        """Nível 1: nenhum candidato escolhido — uma linha por candidato e mais
        nada. Sem trecho, sem CSS, sem referências.

        É a diferença entre "olha aqui os lugares prováveis" e "aqui está o
        código pra você mudar". Misturar os dois faz a IA gastar atenção em
        cinco arquivos quando devia olhar um.

        O aviso de corte é obrigatório: sem ele o relatório mente por omissão,
        dando a entender que aqueles são os únicos lugares que existem."""
        candidatos = candidatos or []
        if not candidatos:
            partes.append('(Nenhum candidato de código foi escolhido — '
                          'localize pelo nome/texto acima.)')
            partes.append('')
            return

        cabecalho = 'Candidatos prováveis no código'
        if total_candidatos > len(candidatos):
            cabecalho += ' (mostrando %d de %d)' % (len(candidatos), total_candidatos)
        partes.append('%s — escolha um na aba Inspetor pra receber o trecho de '
                      'código, as regras de CSS e as outras referências:' % cabecalho)
        for c in candidatos:
            partes.append('- %s:%s — %s   [%s · %s]' % (
                c.get('file', ''), c.get('line', ''),
                (c.get('snippet') or c.get('name') or '').strip()[:160],
                c.get('confidence') or '?', c.get('fonte') or '?'))
        partes.append('')
