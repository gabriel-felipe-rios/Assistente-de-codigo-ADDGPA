from .constantes import *
from .aparencia_cor import APARENCIA_RE_TOKEN_DEFINICAO, aparencia_para_hex
from .aparencia_elemento import (
    aparencia_cores_da_linha, aparencia_coletar_tokens, aparencia_montar_elementos)
from .aparencia_texto import (
    AparenciaLeitorDeTexto, aparencia_sem_acento, APARENCIA_ARQUIVOS_TRADUCAO)
from .aparencia_imagens import (
    aparencia_pillow_disponivel, aparencia_ficha_de_imagem)

# ═══════════════════════════════════════════ APARÊNCIA · ÍNDICE: A VARREDURA ══
# Uma passagem pelo escopo produz DOIS índices que convivem no mesmo dicionário:
# o de código (cores e textos, com arquivo e linha) e o de imagens (famílias
# dominantes com fatia de área). Eles são separados porque as perguntas são
# diferentes — "em que linha está escrito?" e "de que cor é esse desenho?" — e
# juntos porque a invalidação é a mesma: se um arquivo do escopo mudou de data,
# a rodada inteira é refeita.

APARENCIA_RE_SELETOR = re.compile(r'^([^@\s][^{}]*?)\s*\{\s*$')
# A regra escrita numa linha só — `.btn-positive { background: var(--green); }`
# — não casa com a de cima, que exige a linha TERMINAR na chave. Sem esta, o
# alvo do achado saía errado (`.btn` em vez de `.btn-positive`) e as cores da
# regra não se juntavam num elemento.
APARENCIA_RE_SELETOR_NA_LINHA = re.compile(r'^([^@\s][^{}]*?)\s*\{.*\}')
APARENCIA_RE_ALVO = re.compile(r'([A-Za-z_][\w.\-]*)\s*[:=]')
APARENCIA_RE_CHAMADA = re.compile(r'([A-Za-z_][\w.]*)\s*\(')
# Toda citação de arquivo de imagem no código. Alimenta o apontamento "Imagem
# que ninguém usa" — sem esta coleta não haveria como saber quem é órfão.
APARENCIA_RE_CITACAO_IMAGEM = re.compile(
    r'[\w\-. ]+\.(?:svg|png|jpe?g|ico|webp)\b', re.IGNORECASE)

APARENCIA_EXTENSOES_ESTILO = ('.css', '.scss', '.sass', '.less', '.qss')


class AparenciaIndiceMixin:
    """Construção e validade do índice. A casca (`aparencia.py`) fornece o escopo."""

    def _aparencia_indices(self):
        if not hasattr(self, '_aparencia_cache'):
            self._aparencia_cache = {}
        return self._aparencia_cache

    def _aparencia_esquecer_indice(self, project_name=None):
        """Joga o índice fora porque a PERGUNTA mudou, não o disco.

        A invalidação normal compara data de modificação, e não perceberia nada
        aqui: nenhum arquivo mudou quando o usuário troca a lista de extensões
        da aba ou religa temporariamente uma pasta removida. Sem isto, a tela
        continuaria mostrando a resposta da pergunta anterior.
        """
        try:
            if project_name is None:
                self._aparencia_indices().clear()
            else:
                self._aparencia_indices().pop(project_name, None)
        except Exception:
            pass

    def _aparencia_alvo(self, linha, seletor_atual, extensao):
        if extensao in APARENCIA_EXTENSOES_ESTILO and seletor_atual:
            return seletor_atual
        achado = APARENCIA_RE_ALVO.search(linha)
        if achado:
            return achado.group(1)
        achado = APARENCIA_RE_CHAMADA.search(linha)
        if achado:
            return achado.group(1)
        return ''

    # ── A rodada ──────────────────────────────────────────────────────────────
    def _aparencia_construir(self, project_name):
        from .aparencia import aparencia_extensoes_em_vigor
        arquivos, arquivos_imagem = self._aparencia_listar_arquivos(project_name)
        tokens = aparencia_coletar_tokens(self._aparencia_ler_linhas, arquivos)
        pastas, _ignorados, _filtro = self._aparencia_escopo(project_name)
        extensoes = aparencia_extensoes_em_vigor()
        # Um leitor por rodada: ele guarda o cache de parser, inclusive o `None`
        # de binding ausente, e assim uma linguagem sem gramática é tentada uma
        # vez só, e não a cada arquivo.
        leitor = AparenciaLeitorDeTexto()

        ocorrencias = []
        assinatura = {}
        referencias_imagem = set()
        lidos = 0

        for caminho in arquivos:
            linhas = self._aparencia_ler_linhas(caminho)
            if linhas is None:
                continue
            lidos += 1
            try:
                assinatura[caminho] = os.path.getmtime(caminho)
            except OSError:
                pass

            extensao = os.path.splitext(caminho)[1].lower()
            linguagem = extensoes.get(extensao, extensao.lstrip('.').upper())
            relativo = self._aparencia_relativo(project_name, caminho, pastas)
            ocorrencias += self._aparencia_cores_do_arquivo(
                caminho, linhas, extensao, linguagem, relativo, tokens, referencias_imagem)
            ocorrencias += self._aparencia_textos_do_arquivo(
                leitor, caminho, linhas, extensao, linguagem, relativo)

        elementos = aparencia_montar_elementos(ocorrencias)
        imagens = self._aparencia_imagens_do_escopo(
            project_name, arquivos_imagem, pastas, assinatura)

        indice = {
            'ocorrencias': ocorrencias,
            'imagens': imagens,
            'elementos': elementos,
            'tokens': {nome: aparencia_para_hex(rgb) for nome, rgb in tokens.items()},
            'assinatura': assinatura,
            'referencias_imagem': sorted(referencias_imagem),
            'pillow': aparencia_pillow_disponivel(),
            'quantidade_arquivos': lidos,
            'quantidade_cores': sum(1 for o in ocorrencias if o['tipo'] == 'cor'),
            'quantidade_textos': sum(1 for o in ocorrencias if o['tipo'] == 'texto'),
            'quantidade_imagens': len(imagens),
            'gerado_em': datetime.now().strftime('%H:%M'),
        }
        self._aparencia_indices()[project_name] = indice
        return indice

    # ── Cor ───────────────────────────────────────────────────────────────────
    def _aparencia_cores_do_arquivo(self, caminho, linhas, extensao, linguagem,
                                    relativo, tokens, referencias_imagem):
        achados = []
        seletor_atual = ''
        for numero, linha in enumerate(linhas, start=1):
            cortada = linha.rstrip('\n')
            enxuta = cortada.strip()
            if not enxuta:
                continue

            for citacao in APARENCIA_RE_CITACAO_IMAGEM.findall(enxuta):
                referencias_imagem.add(citacao.strip().lower())

            seletor_da_linha = seletor_atual
            if extensao in APARENCIA_EXTENSOES_ESTILO:
                seletor = APARENCIA_RE_SELETOR.match(enxuta)
                if seletor:
                    seletor_atual = seletor.group(1).strip()
                    seletor_da_linha = seletor_atual
                else:
                    numa_linha = APARENCIA_RE_SELETOR_NA_LINHA.match(enxuta)
                    if numa_linha:
                        # Vale só para ESTA linha: a regra abriu e fechou aqui, e
                        # deixá-la em `seletor_atual` roubaria o nome das linhas
                        # seguintes, que pertencem ao bloco de fora.
                        seletor_da_linha = numa_linha.group(1).strip()

            alvo = self._aparencia_alvo(enxuta, seletor_da_linha, extensao)
            definicao = APARENCIA_RE_TOKEN_DEFINICAO.search(enxuta)
            # A chave do elemento é o que amarra as cores que pintam a mesma
            # coisa. Em folha de estilo é o seletor; fora dela, o alvo da linha —
            # e, na falta dos dois, a própria linha, que ao menos mantém junto o
            # que foi escrito junto.
            elemento = seletor_da_linha if extensao in APARENCIA_EXTENSOES_ESTILO else alvo
            chave = '%s#%s' % (relativo, elemento or ('linha %d' % numero))

            for cor in aparencia_cores_da_linha(cortada, tokens):
                achados.append({
                    'tipo': 'cor',
                    'fonte': 'codigo',
                    'arquivo': relativo,
                    'absoluto': caminho,
                    'linha': numero,
                    'linguagem': linguagem,
                    'valor': aparencia_para_hex(cor['rgb']),
                    'rgb': list(cor['rgb']),
                    'bruto': cor['bruto'],
                    'trecho': enxuta[:200],
                    'alvo': alvo,
                    'constante': definicao.group(1) if definicao else (cor['via_token'] or ''),
                    'via_token': bool(cor['via_token']),
                    'eh_definicao': bool(definicao),
                    'propriedade': cor['propriedade'],
                    'peso': cor['peso'],
                    'elemento': elemento,
                    'elemento_chave': chave,
                })
        return achados

    # ── Texto ─────────────────────────────────────────────────────────────────
    def _aparencia_textos_do_arquivo(self, leitor, caminho, linhas, extensao,
                                     linguagem, relativo):
        achados = []
        for texto in leitor.ler(caminho, extensao, linhas):
            numero = texto['linha']
            bruta = (linhas[numero - 1] if 0 < numero <= len(linhas) else '').strip()
            achados.append({
                'tipo': 'texto',
                'fonte': 'codigo',
                'arquivo': relativo,
                'absoluto': caminho,
                'linha': numero,
                'linguagem': linguagem,
                'valor': texto['valor'],
                'comparavel': aparencia_sem_acento(texto['valor']),
                'trecho': bruta[:200],
                'alvo': self._aparencia_alvo(bruta, '', extensao),
                'eh_traducao': extensao in APARENCIA_ARQUIVOS_TRADUCAO,
                'etiqueta': texto['etiqueta'],
                'palpite': texto['palpite'],
            })
        return achados

    # ── Imagem ────────────────────────────────────────────────────────────────
    def _aparencia_imagens_do_escopo(self, project_name, arquivos, pastas, assinatura):
        """A ficha de cada imagem, com TODAS as famílias.

        O corte por "Famílias por imagem" é feito na BUSCA, não aqui: guardando
        tudo, mexer no controle da tela não obriga a revarrer o disco.
        """
        fichas = []
        for caminho in arquivos:
            relativo = self._aparencia_relativo(project_name, caminho, pastas)
            ficha = aparencia_ficha_de_imagem(caminho, relativo)
            if not ficha:
                continue
            try:
                assinatura[caminho] = os.path.getmtime(caminho)
            except OSError:
                pass
            # Em imagem, "texto" é o nome do arquivo — e só ele. Nada de OCR.
            ficha['comparavel'] = aparencia_sem_acento(ficha['nome'])
            fichas.append(ficha)
        return fichas

    # ── Validade ──────────────────────────────────────────────────────────────
    def _aparencia_desatualizado(self, indice, project_name):
        codigo, imagens = self._aparencia_listar_arquivos(project_name)
        atual = codigo + imagens
        antiga = indice.get('assinatura', {})
        if len(atual) != len(antiga):
            return True
        for caminho in atual:
            try:
                if abs(os.path.getmtime(caminho) - antiga.get(caminho, -1)) > 0.001:
                    return True
            except OSError:
                return True
        return False

    def _aparencia_obter(self, project_name, forcar=False):
        indice = self._aparencia_indices().get(project_name)
        if indice is None or forcar or self._aparencia_desatualizado(indice, project_name):
            indice = self._aparencia_construir(project_name)
        return indice
