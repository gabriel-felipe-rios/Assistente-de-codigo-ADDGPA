import hashlib
import re
import unicodedata

from ...constantes import *


class DocumentacaoTecnicaRenderMixin:
    """Processamento determinístico de símbolos e montagem do `.md` da Documentação Técnica.

    Nada aqui chama o LLM — nome, tipo, linha e hash de corpo vêm do tree-sitter
    ou de comparação de texto, e o `.md` é montado só com o que o programa já sabe.
    """

    @staticmethod
    def _dt_chave(sym):
        """Identidade de um símbolo entre gerações — nome + tipo, nunca linha.

        A linha muda toda vez que alguém insere código acima; se ela entrasse na
        chave, qualquer inserção invalidaria o arquivo inteiro.
        """
        return '%s::%s' % (sym.get('type', ''), sym.get('name', ''))

    @staticmethod
    def _dt_corpo_hash(lines, inicio, fim):
        trecho = '\n'.join(l.rstrip() for l in lines[inicio - 1:fim])
        return hashlib.md5(trecho.encode('utf-8', 'replace')).hexdigest()

    @staticmethod
    def _dt_corpo_ws(lines, inicio, fim):
        """O hash do corpo com TODO espaço em branco colapsado.

        Irmão de `_dt_corpo_hash`, e não substituto: aquele continua valendo
        para o Duplicados e para o estado antigo. Este é o que faz reindentar
        não chamar o modelo na Documentação Técnica (D25) — trocar o outro
        invalidaria todo símbolo de todo projeto de uma vez.
        """
        trecho = ' '.join(' '.join(lines[inicio - 1:fim]).split())
        return hashlib.md5(trecho.encode('utf-8', 'replace')).hexdigest()

    def _dt_montar_simbolos(self, file_syms, lines):
        """[{chave, nome, tipo, linha, assinatura, corpo_hash}] ordenado por linha.

        O corpo de um símbolo vai da linha dele até a linha anterior ao próximo.
        É aproximado (não respeita aninhamento), mas é estável: o que importa é
        detectar mudança, não delimitar escopo com precisão.
        """
        ordenados = sorted(file_syms, key=lambda s: s['line'])
        saida = []
        for i, sym in enumerate(ordenados):
            inicio = sym['line']
            fim = ordenados[i + 1]['line'] - 1 if i + 1 < len(ordenados) else len(lines)
            fim = max(inicio, fim)
            idx = inicio - 1
            assinatura = lines[idx].strip() if 0 <= idx < len(lines) else ''
            saida.append({
                'chave': self._dt_chave(sym),
                'nome': sym.get('name', ''),
                'tipo': sym.get('type', ''),
                'linha': inicio,
                'assinatura': assinatura,
                'corpo_hash': self._dt_corpo_hash(lines, inicio, fim),
                'corpo_ws': self._dt_corpo_ws(lines, inicio, fim),
            })
        return saida

    # ── Montagem do .md (sempre pelo programa) ────────────────────────────────

    @classmethod
    def _dt_render_md(cls, rel, simbolos, doc):
        """O `.md` do arquivo: a prosa e os símbolos. A prosa era do Espelho
        (retirado em 2026-09) até a D18.

        `doc` é o registro do arquivo no estado (`sintese`, `atribuicoes`,
        `categoria`, `tipo`, `tags`, `termos`). Os Metadados não repetem a
        função nem as atribuições, como o Espelho repetia (F84).

        Num `.css` (D25) cada seletor sai com a linha e SEM frase — nem o
        «(sem descrição)»: ali a falta de frase é a regra, não um defeito.
        """
        sem_frase = not cls._dt_tem_frase_por_simbolo(rel)
        doc = doc or {}
        partes = ['# %s' % rel, '', '## Síntese',
                  (doc.get('sintese') or '').strip() or '(sem síntese)', '',
                  '## Atribuições']
        atribuicoes = doc.get('atribuicoes') or []
        partes.extend(['- %s' % a for a in atribuicoes] or ['(nenhuma)'])
        tags = doc.get('tags') or []
        partes.extend(['', '## Metadados',
                       '- categoria: %s · tipo: %s' % (doc.get('categoria') or 'outro',
                                                       doc.get('tipo') or 'outro'),
                       '- tags: %s' % (', '.join(tags) if tags else '(nenhuma)'),
                       '', '## Termos do projeto'])
        termos = doc.get('termos') or []
        partes.append('- %s' % ', '.join(termos) if termos else '(nenhum)')
        partes.extend(['', '## Símbolos'])
        if simbolos:
            for s in simbolos:
                assinatura = s['assinatura'] or s['nome']
                if sem_frase:
                    partes.append('- `%s` — linha %d' % (assinatura, s['linha']))
                    continue
                frase = (s.get('frase') or '').strip() or '(sem descrição)'
                partes.append('- `%s` — linha %d — %s' % (assinatura, s['linha'], frase))
        else:
            partes.append('(nenhum símbolo identificado)')
        return '\n'.join(partes) + '\n'

    @staticmethod
    def _dt_render_conexoes(usa, usado_por):
        partes = ['', '## Conexões']
        partes.append('- usa: %s' % (', '.join(usa) if usa else '(nenhuma identificada)'))
        partes.append('- usado por: %s' % (', '.join(usado_por) if usado_por else '(nenhum identificado)'))
        return '\n'.join(partes) + '\n'

    # Cara de identificador: `_`, camelCase (minúscula seguida de maiúscula),
    # parênteses, barra, crase, `#`, extensão de arquivo no fim (`.py`,
    # `.json`), ou palavras minúsculas ligadas por PONTO, sem espaço — o
    # jeito de escrever um nome pontuado do código (`acesso-rapido.comandos`,
    # `editor.decorador`).
    #
    # ⚠️ O HÍFEN SAIU DAQUI (D35). «Palavras minúsculas ligadas por hífen»
    # derrubava `sub-aba`, `tree-sitter` e `pre-requisito`, que são termos. O
    # termo com hífen agora só cai se um pedaço dele for de fato uma classe
    # ou um id de CSS do projeto — ver `_dt_nomes_css` e `_dt_filtrar_termos`.
    _DT_TERMO_IDENTIFICADOR = re.compile(
        r'_|[a-zà-ÿ][A-ZÀ-Ý]|[()`/\\{}\[\]=<>#]|\.[A-Za-z0-9]{1,5}$'
        r'|^[a-z0-9-]+(\.[a-z0-9-]+)+$')
    # Classe (`.x`) e id (`#x`) dentro do nome de um seletor ou elemento.
    _DT_CLASSE_OU_ID = re.compile(r'[.#]([A-Za-z_][\w-]*)')
    # D25: numa folha de estilo cada seletor é um símbolo — sem frase.
    _DT_SEM_FRASE_POR_SIMBOLO = ('.css', '.scss')

    @classmethod
    def _dt_tem_frase_por_simbolo(cls, rel):
        """O modelo escreve uma frase por símbolo deste arquivo? Não num
        `.css`/`.scss` (D25): a lista de seletores fica, cada um com a linha,
        e o modelo descreve só o arquivo."""
        return not str(rel or '').lower().endswith(cls._DT_SEM_FRASE_POR_SIMBOLO)

    @staticmethod
    def _dt_chave_do_termo(termo):
        """A identidade de um termo: sem caixa, sem acento e com um espaço só
        entre as palavras (D12, D23). `Aparencia`, `Aparência` e `aparência`
        dão a mesma chave. Uma regra só para o corte de cada arquivo e para a
        conta do Glossário."""
        texto = ' '.join(str(termo or '').split()).casefold()
        return ''.join(c for c in unicodedata.normalize('NFD', texto)
                       if not unicodedata.combining(c))

    @classmethod
    def _dt_nomes_css(cls, indice):
        """As classes e os ids de CSS do projeto, em minúsculas, lidos do
        Índice de Símbolos (`indice` = o `index` de `get_symbol_index`): os
        nomes dos símbolos `seletor` (`.css`) e `elemento` (`.html`). É o que
        decide se um termo com hífen é CSS (D35) — `cad-tipos` é, `sub-aba`
        não."""
        nomes = set()
        for sym in (indice or {}).get('symbols', []):
            if sym.get('type') in ('seletor', 'elemento'):
                nomes.update(n.casefold()
                             for n in cls._DT_CLASSE_OU_ID.findall(sym.get('name') or ''))
        return frozenset(nomes)

    # Nome próprio simples: «Detector», «Espera». Um termo que é o nome exato
    # de um símbolo do arquivo só fica se tiver esta cara — a constante
    # `ERRO` e a função `estado` caem; a classe `Detector` fica.
    _DT_TERMO_PALAVRA = re.compile(r'[A-ZÀ-Ý][a-zà-ÿ]+')

    @classmethod
    def _dt_filtrar_termos(cls, termos, nomes_dos_simbolos=(), nomes_css=frozenset()):
        """Os termos do projeto sem os identificadores do código.

        ⚠️ **TERMO É O NOME QUE O PROJETO DÁ À COISA, NÃO O IDENTIFICADOR
        (24/09/2026).** O prompt dizia que «uma peça do código» é termo, e o
        modelo anotava toda classe e função (`DetectorClassesMixin`,
        `_det_ler`): o Glossário do projeto chegou a 2 800 termos, uma chamada
        ao modelo cada. O prompt foi corrigido; este corte pega o que ainda
        escapar, e limpa o estado já gravado sem chamar o modelo.

        Cai: o que tem cara de identificador (`_DT_TERMO_IDENTIFICADOR`); o
        que é o nome exato de um símbolo do arquivo — a não ser que seja uma
        palavra simples («Detector», «AMF»), que o projeto pode usar como nome;
        e o termo com hífen em que um pedaço é uma classe ou um id de CSS do
        projeto (`nomes_css`, D35): `.cad-tipos` cai, `sub-aba` e
        `tree-sitter` ficam. Palavra comum não é cortada aqui: quem a segura é
        o prompt (D18).

        Repetidos ficam uma vez só, sem diferenciar caixa nem acento
        (`_dt_chave_do_termo`, D12).
        """
        simbolos = {str(n) for n in (nomes_dos_simbolos or ()) if n}
        vistos, saida = set(), []
        for t in termos or []:
            t = ' '.join(str(t or '').split())
            chave = cls._dt_chave_do_termo(t)
            if not chave or chave in vistos:
                continue
            if cls._DT_TERMO_IDENTIFICADOR.search(t):
                continue
            if t in simbolos and not cls._DT_TERMO_PALAVRA.fullmatch(t):
                continue
            if '-' in t and any('-' in pedaco and pedaco.casefold() in nomes_css
                                for pedaco in re.findall(r'[\w-]+', t)):
                continue
            vistos.add(chave)
            saida.append(t)
        return saida

    @staticmethod
    def _dt_atualizar_termos(out_path, termos):
        """Reescreve SÓ a linha de «Termos do projeto» de um `.md` que não vai
        ser regerado (ver `_dt_filtrar_termos`). Sem modelo; grava só se mudou."""
        try:
            with open(out_path, 'r', encoding='utf-8') as f:
                md = f.read()
            cab = '## Termos do projeto\n'
            i = md.find(cab)
            if i < 0:
                return
            j = md.find('\n', i + len(cab))
            linha = '- %s' % ', '.join(termos) if termos else '(nenhum)'
            novo = md[:i + len(cab)] + linha + (md[j:] if j >= 0 else '\n')
            if novo != md:
                with open(out_path, 'w', encoding='utf-8') as f:
                    f.write(novo)
        except OSError:
            pass

    def _dt_css_sem_frase(self, out_path, rel, registro, usa, usado_por):
        """Tira as frases dos seletores de um `.css` que NÃO vai ser regerado
        (D25) e regrava o `.md` dele — sem modelo, uma vez: depois disso não
        sobra frase nenhuma e isto não grava mais nada.

        `registro` é o do estado (mexe nele: as frases somem do
        `_simbolos.json` na gravação do fim da passada).
        """
        if self._dt_tem_frase_por_simbolo(rel):
            return
        simbolos = (registro or {}).get('simbolos') or []
        if not any(s.get('frase') for s in simbolos):
            return
        for s in simbolos:
            s['frase'] = ''
        md = self._dt_render_md(rel, simbolos, registro)
        md += self._dt_render_conexoes(usa, usado_por)
        try:
            with open(out_path, 'w', encoding='utf-8') as f:
                f.write(md)
        except OSError:
            pass

    @classmethod
    def _dt_atualizar_conexoes(cls, out_path, usa, usado_por):
        """Reescreve SÓ a seção Conexões de um `.md` que não vai ser regerado.

        As Conexões são medidas pelo programa, não escritas pelo modelo: quando
        elas mudam (outro arquivo passou a usar este, ou a leitura do índice
        ficou mais rigorosa), o arquivo inalterado não pode ficar com as velhas
        até alguém mexer nele. Sem chamada ao modelo; grava só se mudou.
        """
        try:
            with open(out_path, 'r', encoding='utf-8') as f:
                md = f.read()
            i = md.find(cls._dt_render_conexoes([], [])[:14])
            base = md[:i] if i >= 0 else md.rstrip('\n') + '\n'
            novo = base + cls._dt_render_conexoes(usa, usado_por)
            if novo != md:
                with open(out_path, 'w', encoding='utf-8') as f:
                    f.write(novo)
        except OSError:
            pass

    # ── Conferente ────────────────────────────────────────────────────────────

    def _dt_conferir(self, simbolos, lines):
        """Confere que cada linha citada existe e contém o símbolo alegado.

        Com o programa montando o `.md`, isto quase não tem o que pegar — é rede
        de segurança contra regressão futura, não a defesa principal.
        """
        problemas = []
        for s in simbolos:
            linha = s['linha']
            if linha < 1 or linha > len(lines):
                problemas.append('%s: linha %d fora do arquivo (%d linhas)'
                                 % (s['nome'], linha, len(lines)))
                continue
            conteudo = lines[linha - 1]
            nome = s['nome'].lstrip('.#').split()[0] if s['nome'] else ''
            if nome and nome not in conteudo:
                problemas.append('%s: não aparece na linha %d' % (s['nome'], linha))
        return problemas

    # ── Helpers de prompt ─────────────────────────────────────────────────────

    @staticmethod
    def _dt_esqueleto(simbolos):
        if not simbolos:
            return '(nenhum símbolo)'
        return '\n'.join(
            '%d. %s: %s — linha %d\n   %s' % (i, s['tipo'], s['nome'], s['linha'], s['assinatura'])
            for i, s in enumerate(simbolos, 1))
