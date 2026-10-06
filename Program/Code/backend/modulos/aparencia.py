from .constantes import *
from .aparencia_cor import (
    aparencia_interpretar_cor, aparencia_distancia, aparencia_rotulo_familia)
from .aparencia_texto import (
    aparencia_sem_acento, APARENCIA_ETIQUETAS, APARENCIA_ETIQUETAS_LIGADAS,
    APARENCIA_ETIQUETA_IMAGEM)
from .aparencia_imagens import (
    APARENCIA_EXTENSOES_IMAGEM, APARENCIA_FAMILIAS_POR_IMAGEM,
    APARENCIA_PRESENCA_MINIMA, aparencia_casar_imagem, aparencia_miniatura)
from .aparencia_auditoria import aparencia_montar_auditoria
from .aparencia_indice import AparenciaIndiceMixin
from .aparencia_acoes import AparenciaAcoesMixin

# ══════════════════════════════════════════════════════════ ABA: APARÊNCIA ══
# Busca visual: encontra pontos da interface pelo que eles PARECEM (cor, texto)
# em vez de por onde estão no código.
#
# Este arquivo é a CASCA: o escopo, a listagem de arquivos e as três buscas que
# a tela chama. Quem sabe alguma coisa sobre cor, texto ou imagem mora nos
# irmãos:
#
#   aparencia_cor.py        régua perceptual (CIEDE2000) e famílias de cor
#   aparencia_elemento.py   quais cores pintam a mesma coisa, e em que fatia
#   aparencia_texto.py      leitura por árvore sintática, etiquetas, reserva
#   aparencia_imagens.py    índice de imagens: famílias dominantes e presença
#   aparencia_auditoria.py  as cinco espécies de apontamento
#   aparencia_indice.py     a varredura e a validade do índice
#   aparencia_acoes.py      os três botões do cartão
#
# O escopo NUNCA é escolhido aqui: são sempre as pastas de trabalho do projeto
# (Projeto → Trabalho), descontando o que está em Projeto → Remover.

APARENCIA_LIMITE_BYTES = 2_000_000
APARENCIA_LIMITE_LINHA = 3000          # linha maior que isso = arquivo minificado
APARENCIA_LIMITE_RESULTADOS = 400

APARENCIA_EXTENSOES_LINGUAGEM = {
    '.css': 'CSS', '.scss': 'SCSS', '.sass': 'SASS', '.less': 'LESS',
    '.qss': 'Qt QSS', '.html': 'HTML', '.htm': 'HTML', '.xml': 'XML',
    '.xaml': 'XAML', '.axaml': 'XAML', '.ui': 'Qt UI', '.svg': 'SVG',
    '.js': 'JavaScript', '.jsx': 'JavaScript', '.ts': 'TypeScript', '.tsx': 'TypeScript',
    '.mts': 'TypeScript', '.cts': 'TypeScript',
    '.vue': 'Vue', '.svelte': 'Svelte',
    '.py': 'Python', '.pyw': 'Python', '.rb': 'Ruby', '.php': 'PHP',
    '.cs': 'C#', '.vb': 'Visual Basic', '.java': 'Java', '.kt': 'Kotlin',
    '.swift': 'Swift', '.dart': 'Dart', '.go': 'Go', '.rs': 'Rust',
    '.c': 'C', '.h': 'C', '.cpp': 'C++', '.hpp': 'C++', '.cc': 'C++', '.m': 'Objective-C',
    '.lua': 'Lua', '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML',
    '.toml': 'TOML', '.ini': 'INI', '.cfg': 'INI', '.resx': 'RESX',
}

APARENCIA_FONTES = ('codigo', 'imagens', 'ambos')


def aparencia_extensoes_em_vigor():
    """O que a aba lê como CÓDIGO.

    ⚠️ A lista acima NÃO virou a mesma do Resumo, dos Mapas ou da busca de usos,
    e não deve virar: aqui a pergunta é "onde pode haver cor ou texto de
    interface escrito?", e por isso ela tem `.xaml` e `.resx`, que não são
    código em lugar nenhum. Ver o "NÃO UNIFICAR" em `agentes/cobertura.py`.

    Quem decide é a linha **Busca visual · texto e cor** de Configurações ›
    Arquivos que o programa lê › Quem lê o quê (`configuracoes_aparencia`), e
    ela diz o que ENTRA. Até 23/09/2026 havia por cima a coluna "cores" de uma
    tabela de exceções; a tabela saiu e o que ela dizia foi migrado para a
    própria linha.
    """
    try:
        from .configuracoes_aparencia import ler_extensoes_aparencia
        escolhidas = ler_extensoes_aparencia()['codigo']
    except Exception:
        escolhidas = sorted(APARENCIA_EXTENSOES_LINGUAGEM)
    return {ext: APARENCIA_EXTENSOES_LINGUAGEM.get(ext, ext.lstrip('.').upper())
            for ext in escolhidas}


def aparencia_extensoes_de_imagem_em_vigor():
    """O que a aba lê como IMAGEM — a linha Busca visual · imagem de Quem lê o quê."""
    try:
        from .configuracoes_aparencia import ler_extensoes_aparencia
        escolhidas = ler_extensoes_aparencia()['imagens']
    except Exception:
        escolhidas = sorted(APARENCIA_EXTENSOES_IMAGEM)
    return {ext: APARENCIA_EXTENSOES_IMAGEM.get(ext, ext.lstrip('.').upper())
            for ext in escolhidas}


class AparenciaMixin(AparenciaIndiceMixin, AparenciaAcoesMixin):

    # ── Escopo e listagem ─────────────────────────────────────────────────────
    def _aparencia_religados(self, project_name):
        """Os itens de Projeto → Remover que o usuário religou NESTA sessão.

        ⚠️ Vive só em memória, e some quando o programa fecha. É de propósito:
        religar aqui é "só desta vez, para eu procurar" — quem quiser mudar o
        escopo de verdade muda em Projeto → Remover, que é onde a decisão mora.
        Gravar isto em disco criaria um segundo escopo, invisível daquela tela.
        """
        if not hasattr(self, '_aparencia_religados_cache'):
            self._aparencia_religados_cache = {}
        return self._aparencia_religados_cache.setdefault(project_name, set())

    def _aparencia_escopo(self, project_name):
        """Pastas de trabalho menos o que está em Projeto → Remover.

        O que foi religado temporariamente continua na lista `ignorados` — a tela
        precisa mostrá-lo, marcado — mas deixa de contar no filtro.
        """
        workspace = self.load_workspace(project_name)
        config = workspace.get('config', {})
        pastas = config.get('working_folders', [])
        ignorados = config.get('ignore_list', [])
        religados = self._aparencia_religados(project_name)

        def esta_ignorado(caminho):
            for item in ignorados:
                alvo = item.get('path', '')
                if alvo in religados:
                    continue
                if item.get('type') == 'file':
                    if caminho == alvo:
                        return True
                elif item.get('recursive', True):
                    if caminho == alvo or caminho.startswith(alvo + os.sep):
                        return True
                else:
                    if caminho == alvo:
                        return True
            return False

        return pastas, ignorados, esta_ignorado

    def aparencia_alternar_ignorado(self, project_name, caminho):
        """Liga ou desliga, só nesta sessão, um item de Projeto → Remover.

        Refaz o índice na hora: nenhum arquivo mudou de data, então a
        invalidação normal não perceberia que a pergunta é outra.
        """
        try:
            caminho = (caminho or '').replace('/', os.sep)
            religados = self._aparencia_religados(project_name)
            _pastas, ignorados, _f = self._aparencia_escopo(project_name)
            conhecidos = {i.get('path', '') for i in ignorados}
            if caminho not in conhecidos:
                return {'success': False,
                        'error': 'Não está em Projeto → Remover: ' + str(caminho)}
            if caminho in religados:
                religados.discard(caminho)
            else:
                religados.add(caminho)
            self._aparencia_esquecer_indice(project_name)
            return {'success': True, 'religado': caminho in religados}
        except Exception as erro:
            return {'success': False, 'error': str(erro)}

    def _aparencia_listar_arquivos(self, project_name):
        """→ (arquivos_de_codigo, arquivos_de_imagem).

        ⚠️ O `.svg` está nas duas listas de extensão e sai pela SEGUNDA. Foi de
        propósito: lido como código, ele casa pelo `fill="#3498DB"` escrito no
        texto, e um traço de 2 pixels pesa igual a um fundo de 2.000. Como
        imagem, ele casa pela área pintada. A constante compartilhada continua
        intacta — quem decide é este desvio, não uma edição da lista.
        """
        pastas, _ignorados, esta_ignorado = self._aparencia_escopo(project_name)
        from modulos.ignorados import pasta_ignorada_por_nome, arquivo_ignorado_por_nome
        # ⚠️ Só DUAS das três peneiras globais de `ignorados.py` valem aqui — de
        # propósito, e a terceira ficou de fora por um conflito real: `.png`,
        # `.jpg`, `.ico` e `.webp` estão na lista global de extensões ignoradas,
        # o que estava certo enquanto nenhuma aba tinha o que fazer com imagem, e
        # por causa dela nenhuma imagem entrava neste índice. Quem decide a
        # extensão aqui é a lista própria da aba (Configurações → Aparência):
        # uma tela que diz "leia isto" e é vetada em silêncio por outra é pior
        # que não existir. Pasta e arquivo ignorados por NOME continuam valendo —
        # aqueles dois dizem "isto não é projeto", e isso não mudou.
        def fora_do_programa(caminho):
            return pasta_ignorada_por_nome(caminho) or arquivo_ignorado_por_nome(caminho)

        extensoes_validas = aparencia_extensoes_em_vigor()
        extensoes_imagem = aparencia_extensoes_de_imagem_em_vigor()
        codigo, imagens = [], []
        for pasta in pastas:
            if not os.path.isdir(pasta):
                continue
            for raiz, subpastas, nomes in os.walk(pasta):
                if esta_ignorado(raiz) or fora_do_programa(raiz):
                    subpastas[:] = []
                    continue
                # A tupla curta continua aqui como piso, e não foi trocada pela
                # lista global: ela vale mesmo com `extensoes.json` ausente ou
                # esvaziado, e esta aba nunca teve por que abrir `node_modules`.
                # A lista global SOMA a ela — não a substitui.
                subpastas[:] = [s for s in subpastas
                                if not s.startswith('.')
                                and s not in ('node_modules', '__pycache__', 'venv', 'dist', 'build')
                                and not esta_ignorado(os.path.join(raiz, s))
                                and not fora_do_programa(os.path.join(raiz, s))]
                for nome in nomes:
                    extensao = os.path.splitext(nome)[1].lower()
                    eh_imagem = extensao in extensoes_imagem
                    if not eh_imagem and extensao not in extensoes_validas:
                        continue
                    if nome.endswith(('.min.js', '.min.css')):
                        continue
                    caminho = os.path.join(raiz, nome)
                    if esta_ignorado(caminho) or fora_do_programa(caminho):
                        continue
                    try:
                        if not eh_imagem and os.path.getsize(caminho) > APARENCIA_LIMITE_BYTES:
                            continue
                    except OSError:
                        continue
                    (imagens if eh_imagem else codigo).append(caminho)
        return codigo, imagens

    def _aparencia_relativo(self, project_name, caminho, pastas=None):
        if pastas is None:
            pastas, _i, _f = self._aparencia_escopo(project_name)
        for pasta in pastas:
            if caminho.startswith(pasta):
                base = os.path.basename(pasta.rstrip(os.sep))
                resto = caminho[len(pasta):].lstrip(os.sep)
                return (base + '/' + resto).replace(os.sep, '/')
        return caminho.replace(os.sep, '/')

    def _aparencia_ler_linhas(self, caminho):
        try:
            with open(caminho, 'r', encoding='utf-8', errors='ignore') as arquivo:
                linhas = arquivo.readlines()
        except OSError:
            return None
        if linhas and max(len(linha) for linha in linhas) > APARENCIA_LIMITE_LINHA:
            return None      # minificado disfarçado
        return linhas

    def _aparencia_entregar(self, achados):
        """A página que vai para a tela, já com as miniaturas.

        ⚠️ A miniatura é gerada AQUI, e não durante a coleta: ela é uma imagem
        embutida em base64, e montá-la para os milhares de achados que a busca
        descarta custaria segundos e megabytes que ninguém veria. Aqui são no
        máximo os 400 que a tela mostra.
        """
        pagina = achados[:APARENCIA_LIMITE_RESULTADOS]
        for achado in pagina:
            caminho = achado.pop('absoluto', None)
            if achado.get('fonte') == 'imagem':
                achado['miniatura'] = aparencia_miniatura(caminho) if caminho else ''
        for achado in achados[len(pagina):]:
            achado.pop('absoluto', None)
        return pagina

    def _aparencia_contar(self, ocorrencias, chave):
        contagem = {}
        for ocorrencia in ocorrencias:
            contagem[ocorrencia.get(chave, '')] = contagem.get(ocorrencia.get(chave, ''), 0) + 1
        return contagem

    # ── API pública ───────────────────────────────────────────────────────────
    def aparencia_estado(self, project_name, forcar=False):
        """Escopo + números do índice — alimenta o bloco 'Onde procura' e a linha do índice."""
        try:
            pastas, ignorados, _f = self._aparencia_escopo(project_name)
            religados = self._aparencia_religados(project_name)
            if not pastas:
                return {'success': True, 'sem_pastas': True, 'pastas': [], 'ignorados': []}
            indice = self._aparencia_obter(project_name, forcar)
            return {
                'success': True,
                'sem_pastas': False,
                'pastas': [p.replace(os.sep, '/') for p in pastas],
                'ignorados': [{'caminho': i.get('path', '').replace(os.sep, '/'),
                               'tipo': i.get('type', 'folder'),
                               'religado': i.get('path', '') in religados}
                              for i in ignorados],
                'quantidade_arquivos': indice['quantidade_arquivos'],
                'quantidade_cores': indice['quantidade_cores'],
                'quantidade_textos': indice['quantidade_textos'],
                'quantidade_imagens': indice['quantidade_imagens'],
                'quantidade_tokens': len(indice['tokens']),
                # A tela avisa quando a Pillow não está lá: sem ela o índice de
                # imagens fica vazio, e um zero sem explicação parece defeito.
                'pillow': indice['pillow'],
                'etiquetas': list(APARENCIA_ETIQUETAS),
                'etiquetas_ligadas': list(APARENCIA_ETIQUETAS_LIGADAS),
                'gerado_em': indice['gerado_em'],
            }
        except Exception as erro:
            return {'success': False, 'error': str(erro)}

    # ── Busca por cor ─────────────────────────────────────────────────────────
    def aparencia_buscar_cor(self, project_name, cor, tolerancia=8, fonte='ambos',
                             presenca_minima=APARENCIA_PRESENCA_MINIMA,
                             familias_por_imagem=APARENCIA_FAMILIAS_POR_IMAGEM):
        """Tolerância e presença mínima são eixos DIFERENTES.

        Tolerância responde "é esse verde?" — distância até a cor procurada.
        Presença responde "esse verde manda na imagem?" — fatia da área. Uma não
        substitui a outra, e por isso são dois controles, e não um.
        """
        try:
            alvo = aparencia_interpretar_cor(cor)
            if not alvo:
                return {'success': False, 'error': 'Cor inválida: ' + str(cor)}
            indice = self._aparencia_obter(project_name)
            achados = []
            if fonte in ('codigo', 'ambos'):
                achados += self._aparencia_cores_de_codigo(indice, alvo, tolerancia)
            if fonte in ('imagens', 'ambos'):
                achados += self._aparencia_cores_de_imagem(
                    indice, alvo, tolerancia, presenca_minima, familias_por_imagem)

            # Achado abaixo do corte de presença DESCE, mas não some: sumir seria
            # o usuário não ter como saber que a cor está lá, em 6%.
            achados.sort(key=lambda a: (a.get('abaixo_do_corte', False), a['distancia'],
                                        -a.get('ocorrencias', 1)))
            return {
                'success': True,
                'total': len(achados),
                'abaixo_do_corte': sum(1 for a in achados if a.get('abaixo_do_corte')),
                'contagem_fontes': self._aparencia_contar(achados, 'fonte'),
                'achados': self._aparencia_entregar(achados),
                'gerado_em': indice['gerado_em'],
            }
        except Exception as erro:
            return {'success': False, 'error': str(erro)}

    def _aparencia_cores_de_codigo(self, indice, alvo, tolerancia):
        cores = [o for o in indice['ocorrencias'] if o['tipo'] == 'cor']
        contagem = self._aparencia_contar(cores, 'valor')
        elementos = indice.get('elementos', {})
        achados = []
        for ocorrencia in cores:
            distancia = aparencia_distancia(alvo, tuple(ocorrencia['rgb']))
            if distancia > float(tolerancia):
                continue
            copia = dict(ocorrencia)
            copia.pop('absoluto', None)
            copia['distancia'] = round(distancia, 1)
            copia['ocorrencias'] = contagem.get(ocorrencia['valor'], 1)
            copia['literal_solto'] = not ocorrencia['via_token'] and not ocorrencia['eh_definicao']
            copia['familia_rotulo'] = aparencia_rotulo_familia(ocorrencia.get('familia'))
            elemento = elementos.get(ocorrencia.get('elemento_chave')) or {}
            copia['paleta'] = elemento.get('familias', [])
            copia['cores_do_elemento'] = elemento.get('cores', [])
            achados.append(copia)
        return achados

    def _aparencia_cores_de_imagem(self, indice, alvo, tolerancia,
                                   presenca_minima, familias_por_imagem):
        maximo = max(2, min(8, int(familias_por_imagem or APARENCIA_FAMILIAS_POR_IMAGEM)))
        achados = []
        for ficha in indice.get('imagens', []):
            recorte = dict(ficha)
            recorte['familias'] = ficha.get('familias', [])[:maximo]
            casada = aparencia_casar_imagem(recorte, alvo, tolerancia, presenca_minima)
            if not casada:
                continue
            copia = dict(recorte)
            copia.update({
                'fonte': 'imagem', 'linha': 1,
                'linguagem': ficha.get('formato', ''),
                'valor': casada['hex'], 'rgb': casada['cor'],
                'distancia': casada['distancia'], 'fatia': casada['fatia'],
                'familia': casada['familia'], 'familia_rotulo': casada['rotulo'],
                'abaixo_do_corte': casada['abaixo'], 'ocorrencias': 1,
                'alvo': ficha.get('nome', ''), 'paleta': recorte['familias'],
            })
            achados.append(copia)
        return achados

    # ── Busca por texto ───────────────────────────────────────────────────────
    def aparencia_buscar_texto(self, project_name, texto, ignorar_acentos=True,
                               incluir_traducoes=True, fonte='ambos',
                               etiquetas=None, incluir_nome_de_imagem=True):
        """Busca por substring. Nada é reprovado — o que não convence só desce.

        ⚠️ Em imagem, texto é o NOME DO ARQUIVO. Não há OCR aqui, e não deve
        haver: ler o texto desenhado dentro de um `.png` foi recusado.
        """
        try:
            procurado = (texto or '').strip()
            if len(procurado) < 2:
                return {'success': True, 'total': 0, 'achados': []}
            indice = self._aparencia_obter(project_name)
            agulha = aparencia_sem_acento(procurado) if ignorar_acentos else procurado
            ligadas = set(etiquetas) if etiquetas else set(APARENCIA_ETIQUETAS_LIGADAS)

            achados = []
            if fonte in ('codigo', 'ambos'):
                achados += self._aparencia_textos_de_codigo(
                    indice, agulha, ignorar_acentos, incluir_traducoes)
            if fonte in ('imagens', 'ambos') and incluir_nome_de_imagem:
                achados += self._aparencia_textos_de_imagem(indice, agulha, ignorar_acentos)

            # A etiqueta desligada NÃO tira o achado da lista: ela o manda para o
            # fim. A tela mostra a contagem de cada uma e liga com um clique.
            achados.sort(key=lambda a: (a.get('etiqueta') not in ligadas,
                                        a.get('palpite', False),
                                        not a['exato'], -a['ocorrencias'], a['arquivo']))
            return {
                'success': True,
                'total': len(achados),
                'contagem_etiquetas': self._aparencia_contar(achados, 'etiqueta'),
                'contagem_fontes': self._aparencia_contar(achados, 'fonte'),
                'achados': self._aparencia_entregar(achados),
                'gerado_em': indice['gerado_em'],
            }
        except Exception as erro:
            return {'success': False, 'error': str(erro)}

    def _aparencia_textos_de_codigo(self, indice, agulha, ignorar_acentos, incluir_traducoes):
        textos = [o for o in indice['ocorrencias'] if o['tipo'] == 'texto']
        contagem = self._aparencia_contar(textos, 'comparavel')
        achados = []
        for ocorrencia in textos:
            if not incluir_traducoes and ocorrencia.get('eh_traducao'):
                continue
            palheiro = ocorrencia['comparavel'] if ignorar_acentos else ocorrencia['valor']
            if agulha not in palheiro:
                continue
            copia = dict(ocorrencia)
            copia.pop('absoluto', None)
            copia['ocorrencias'] = contagem.get(ocorrencia['comparavel'], 1)
            copia['exato'] = palheiro == agulha
            achados.append(copia)
        return achados

    def _aparencia_textos_de_imagem(self, indice, agulha, ignorar_acentos):
        achados = []
        for ficha in indice.get('imagens', []):
            palheiro = ficha['comparavel'] if ignorar_acentos else ficha['nome']
            if agulha not in palheiro:
                continue
            copia = dict(ficha)
            copia.update({
                'fonte': 'imagem', 'linha': 1,
                'linguagem': ficha.get('formato', ''),
                'valor': ficha['nome'], 'alvo': ficha['nome'],
                'etiqueta': APARENCIA_ETIQUETA_IMAGEM, 'palpite': False,
                'exato': palheiro == agulha, 'ocorrencias': 1,
                'paleta': ficha.get('familias', []),
            })
            achados.append(copia)
        return achados

    # ── Auditoria ─────────────────────────────────────────────────────────────
    def aparencia_auditoria(self, project_name, opcoes=None):
        """Cor, texto e imagem — o que está repetido, solto, quase duplicado ou órfão."""
        try:
            indice = self._aparencia_obter(project_name)
            apontamentos = aparencia_montar_auditoria(
                indice, opcoes, APARENCIA_LIMITE_RESULTADOS)
            return {
                'success': True,
                'apontamentos': apontamentos,
                'total': len(apontamentos),
                'gerado_em': indice['gerado_em'],
            }
        except Exception as erro:
            return {'success': False, 'error': str(erro)}
