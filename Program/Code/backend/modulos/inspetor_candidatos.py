from .constantes import *
from .aparencia_texto import (
    APARENCIA_ETIQUETA_ROTULO, APARENCIA_ETIQUETA_MENSAGEM)

# Teto de candidatos mostrados. Era 30: uma lista longa não é "mais
# informação", é o usuário rolando atrás do que importa — e no relatório
# vira ruído que a IA lê no lugar do código. O que passar disso sai com
# aviso de corte, nunca em silêncio.
INSPETOR_MAXIMO_CANDIDATOS = 5

# Rebaixamento de confiança em um degrau. Usado quando o sinal é indireto:
# o termo veio do elemento PAI, ou o achado de texto veio do leitor lexical
# (extensão sem gramática) em vez da árvore.
_INSP_REBAIXA = {'alta': 'media', 'media': 'baixa', 'baixa': 'baixa'}

# Etiquetas da Aparência que denotam texto que o usuário LÊ na tela — as
# outras ('atributo', 'identificador') são texto de código que por acaso casa.
_INSP_ETIQUETAS_FORTES = (APARENCIA_ETIQUETA_ROTULO, APARENCIA_ETIQUETA_MENSAGEM)


class InspetorCandidatosMixin:
    """Do elemento capturado ao lugar provável no código-fonte.

    Duas fontes independentes: o índice de símbolos (tree-sitter) da aba
    Análise, e o índice de elementos de interface da aba Aparência
    (`aparencia_buscar_texto`). Concordância entre as duas é o sinal mais
    forte que existe.
    """

    # ── Busca de candidatos no código-fonte ─────────────────────────────────
    # Simples e determinística: reaproveita dois índices que já existem, sem
    # reindexar nada aqui. Sem embeddings, sem fuzzy-matching sofisticado —
    # de propósito.
    #
    # 1. **Índice de símbolos** (tree-sitter, aba Análise): funções, classes,
    #    seletores CSS, elementos HTML — coisas com NOME.
    # 2. **Índice de elementos de interface** (aba Aparência,
    #    `aparencia_buscar_texto`): o texto que o usuário LÊ na tela, com
    #    arquivo, linha e etiqueta. É o que enxerga o rótulo de um botão que
    #    não é símbolo nomeado nenhum.
    #
    # Quando as duas apontam pro mesmo arquivo:linha, a confiança sobe pra
    # alta — o mesmo ponto foi achado por dois caminhos independentes.

    def inspetor_buscar_candidatos(self, project_name, captura, limite=None):
        """Candidatos pro elemento capturado, do mais provável pro menos.

        **Nunca devolve `success: False` por falta de material.** Índice de
        símbolos ausente, quebrado, ou captura sem nome nenhum viram `aviso`
        numa resposta bem-sucedida, com a lista que deu pra montar — porque o
        botão de copiar não pode depender de nada disso estar preenchido.

        `limite` é o corte da lista: a tela do Capturar usa o padrão
        (`INSPETOR_MAXIMO_CANDIDATOS`), e a resolução da Gravação pede uma
        lista larga, porque ela reordena com lente de UI DEPOIS e a âncora
        certa precisa ainda estar dentro. A resposta sempre carrega `total` e
        `mostrando`, pra tela e relatório poderem avisar do corte."""
        captura = captura or {}
        uia = captura.get('uia') or {}
        win32 = captura.get('win32') or {}
        modo = captura.get('modo') or 'controle'
        limite = INSPETOR_MAXIMO_CANDIDATOS if limite is None else limite
        avisos = []

        termos = self._inspetor_termos_busca(uia, win32, modo)
        if not termos:
            return {
                'success': True, 'candidatos': [], 'total': 0, 'mostrando': 0,
                'aviso': ('A captura não trouxe nome, texto nem identificador — não '
                          'dá pra procurar no código. Copie assim mesmo: o relatório '
                          'leva o caminho na árvore de UI, e a IA localiza por ele.'),
            }

        # Busca fraca = nenhum termo veio do elemento clicado; todos vieram do
        # pai, do tipo de controle ou da classe Win32. Muda duas coisas: a
        # concordância entre as fontes deixa de promover a "alta" (dois
        # caminhos concordando sobre o nome do PAI não provam nada sobre o
        # filho), e o usuário é avisado de que os candidatos são indiretos.
        busca_fraca = all(termo.get('fraco') for termo in termos)
        if busca_fraca:
            avisos.append('O elemento clicado não tem nome próprio — a busca usou o '
                          'elemento pai e o tipo do controle, então os candidatos '
                          'abaixo são palpites indiretos.')

        # Fonte 1 — índice de símbolos (aba Análise).
        do_indice = []
        idx = self.get_symbol_index(project_name)
        if not idx.get('success'):
            avisos.append(idx.get('error') or 'Falha ao ler o índice de símbolos.')
        elif not idx.get('index'):
            avisos.append('Índice de símbolos não encontrado — só os elementos de '
                          'interface foram consultados. Gere o índice na aba Análise '
                          'pra incluir também os símbolos de código.')
        else:
            do_indice, desatualizado = self._inspetor_rankear(
                project_name, idx['index'].get('symbols', []), termos)
            if desatualizado:
                avisos.append('O índice de símbolos está desatualizado (havia '
                              'candidatos apontando pra arquivos que não existem '
                              'mais). Regenere o índice na aba Análise → Índice de '
                              'Símbolos pra resultados melhores.')

        # Fonte 2 — índice de elementos de interface (aba Aparência).
        da_interface = self._inspetor_candidatos_da_interface(project_name, termos)

        candidatos = self._inspetor_juntar_candidatos(
            do_indice, da_interface, busca_fraca)

        # Terceiro recurso, só se as duas fontes juntas vieram magras: busca
        # textual ao vivo pelo termo mais específico. Lê arquivos do disco,
        # então acha o lugar certo mesmo com os dois índices velhos.
        if len(candidatos) < INSPETOR_MAXIMO_CANDIDATOS:
            self._inspetor_completar_com_usos(project_name, termos, candidatos)

        self._inspetor_ordenar_candidatos(candidatos)
        resposta = {
            'success': True,
            'candidatos': candidatos[:limite],
            'total': len(candidatos),
            'mostrando': min(len(candidatos), limite),
        }
        if avisos:
            resposta['aviso'] = ' '.join(avisos)
        return resposta

    def _inspetor_chave_candidato(self, candidato):
        """Identidade de um candidato pra deduplicação entre fontes: o mesmo
        arquivo:linha achado por dois caminhos é UM candidato, não dois."""
        return ((candidato.get('file') or '').replace('\\', '/').lower(),
                candidato.get('line'))

    def _inspetor_candidatos_da_interface(self, project_name, termos, por_termo=40):
        """Candidatos vindos do índice de elementos de interface da Aparência.

        É a fonte que enxerga o que o índice de símbolos não indexa: o texto
        que o usuário lê na tela. `fonte='codigo'` porque procuramos onde o
        elemento é CRIADO — não que imagem tem nome parecido.
        `ignorar_acentos=True` é o que faz o rótulo «Configurações» casar com
        um identificador `configuracoes`."""
        saida, vistos = [], set()
        for termo in termos:
            valor = (termo.get('valor') or '').strip()
            if len(valor) < 2:   # o mínimo que `aparencia_buscar_texto` aceita
                continue
            try:
                r = self.aparencia_buscar_texto(
                    project_name, valor, ignorar_acentos=True,
                    incluir_traducoes=True, fonte='codigo',
                    incluir_nome_de_imagem=False)
            except Exception:
                continue
            if not r.get('success'):
                continue
            for achado in (r.get('achados') or [])[:por_termo]:
                candidato = self._inspetor_candidato_de_achado(achado, termo, valor)
                chave = self._inspetor_chave_candidato(candidato)
                if chave in vistos:
                    continue
                vistos.add(chave)
                saida.append(candidato)
        return saida

    def _inspetor_candidato_de_achado(self, achado, termo, valor):
        """Converte um achado da Aparência num candidato do Inspetor.

        A confiança sai do próprio achado, sem número inventado: casamento
        exato num texto que o usuário lê (rótulo/mensagem) é alta; exato em
        atributo/identificador é média; substring é baixa. Palpite (extensão
        sem gramática) e termo vindo do elemento pai rebaixam um degrau
        cada."""
        if achado.get('exato'):
            confianca = ('alta' if achado.get('etiqueta') in _INSP_ETIQUETAS_FORTES
                         else 'media')
            motivo = 'texto de interface igual a "%s"' % valor
        else:
            confianca = 'baixa'
            motivo = 'texto de interface contém "%s"' % valor
        if achado.get('palpite'):
            confianca = _INSP_REBAIXA[confianca]
            motivo += ' (leitura lexical: extensão sem gramática)'
        if termo.get('fraco'):
            confianca = _INSP_REBAIXA[confianca]
            motivo += ' — via o elemento pai'
        return {
            'name': achado.get('valor') or valor,
            'type': 'texto de interface (%s)' % (achado.get('etiqueta') or '?'),
            'file': (achado.get('arquivo') or '').replace('\\', '/'),
            'line': achado.get('linha') or 0,
            'snippet': achado.get('trecho') or '',
            'confidence': confianca,
            'motivo': motivo,
            'fonte': 'interface',
            'exato': bool(achado.get('exato')),
            'ocorrencias': achado.get('ocorrencias') or 1,
        }

    def _inspetor_juntar_candidatos(self, do_indice, da_interface, busca_fraca=False):
        """Une as duas fontes por arquivo:linha.

        **Concordância é o sinal mais forte que existe** — o mesmo ponto foi
        achado por dois caminhos independentes, um olhando símbolos e o outro
        olhando texto de tela. É o único caso em que a confiança SOBE.

        `busca_fraca` põe teto nessa subida. Quando todos os termos vieram do
        elemento PAI, duas fontes concordando concordam sobre o nome do pai —
        e isso não é prova nenhuma sobre o filho que foi clicado. Sem o teto, o
        rebaixamento de `_inspetor_pontuar` era desfeito bem no caso em que ele
        mais importa, e um palpite indireto saía marcado "alta confiança"."""
        teto = 'media' if busca_fraca else 'alta'
        juntos = {}
        for candidato in do_indice:
            candidato.setdefault('fonte', 'simbolo')
            juntos[self._inspetor_chave_candidato(candidato)] = candidato

        for candidato in da_interface:
            chave = self._inspetor_chave_candidato(candidato)
            anterior = juntos.get(chave)
            if anterior is None:
                juntos[chave] = candidato
                continue
            anterior['fonte'] = 'ambas'
            anterior['confidence'] = teto
            anterior['motivo'] = '%s + %s' % (anterior.get('motivo') or '',
                                              candidato.get('motivo') or '')
            anterior['exato'] = bool(anterior.get('exato') or candidato.get('exato'))
            anterior['ocorrencias'] = candidato.get('ocorrencias') or 1
            if not (anterior.get('snippet') or '').strip():
                anterior['snippet'] = candidato.get('snippet') or ''
        return list(juntos.values())

    def _inspetor_completar_com_usos(self, project_name, termos, candidatos):
        """Último recurso: busca textual ao vivo pelo termo mais específico,
        pra quando os dois índices juntos não acharam quase nada. Altera
        `candidatos` no lugar."""
        termo_fallback = termos[0]['valor']
        existentes = {self._inspetor_chave_candidato(c) for c in candidatos}
        usos = self.find_symbol_usages(project_name, termo_fallback)
        if not usos.get('success'):
            return
        for u in usos.get('usages', [])[:20]:
            # mesmo formato de caminho dos demais candidatos (com o nome da
            # pasta de trabalho), pra exibição e resolução coerentes
            novo = {
                'name': termo_fallback,
                'type': 'uso no código',
                'file': self._inspetor_caminho_relativo(
                    project_name, u['file']).replace('\\', '/'),
                'line': u['line'],
                'snippet': u.get('snippet', ''),
                'confidence': 'baixa',
                'motivo': 'texto aparece no código, mas não é um símbolo nomeado no índice',
                'fonte': 'uso',
                'exato': False,
                'ocorrencias': 0,
            }
            chave = self._inspetor_chave_candidato(novo)
            if chave in existentes:
                continue
            existentes.add(chave)
            candidatos.append(novo)

    def _inspetor_ordenar_candidatos(self, candidatos):
        """Ordena no lugar. Depois da confiança, o desempate premia o sinal
        independente: achado pelas duas fontes vence achado por uma só, e o da
        interface vence o do índice de símbolos (o usuário clicou num rótulo
        visível — um símbolo homônimo é palpite mais indireto).

        `ocorrencias` entra CRESCENTE de propósito: um texto que aparece 2
        vezes no projeto identifica melhor que um que aparece 40."""
        ordem = {'alta': 0, 'media': 1, 'baixa': 2}
        candidatos.sort(key=lambda c: (
            ordem.get(c.get('confidence'), 3),
            c.get('fonte') != 'ambas',
            c.get('fonte') != 'interface',
            not c.get('exato'),
            c.get('ocorrencias') or 0,
            c.get('file') or '',
            c.get('line') or 0,
        ))
        return candidatos

    def _inspetor_termos_busca(self, uia, win32=None, modo='controle'):
        """Extrai os termos de busca do bloco capturado, cada um com seu campo
        de origem. A ordem vai do mais confiável (AutomationId — é o id real do
        elemento) pro mais genérico (texto visível); o campo importa no
        ranqueamento, não só o valor.

        Três caminhos:

        - **modo `janela`**: o que identifica uma janela é o título e o
          processo, não o rótulo de um controle. Sem isso o modo capturava
          certo e procurava errado.
        - **modo `controle`, com nome/texto/id**: o de sempre.
        - **modo `controle`, com os três vazios**: aproveita o que a captura já
          trazia e o código jogava fora — o caminho na árvore de UI (o pai do
          elemento clicado quase sempre TEM nome), o tipo de controle e a
          classe Win32. Antes, aqui a busca simplesmente desistia."""
        win32 = win32 or {}
        if modo == 'janela':
            return self._inspetor_termos_da_janela(uia, win32)

        termos = []
        vistos = set()
        for campo in ('automation_id', 'name', 'texto'):
            valor = (uia.get(campo) or '').strip()
            chave = valor.lower()
            if valor and chave not in vistos:
                termos.append({'campo': campo, 'valor': valor})
                vistos.add(chave)
        return termos or self._inspetor_termos_do_caminho(uia, win32)

    def _inspetor_termos_da_janela(self, uia, win32):
        """Modo "Janela inteira": título da janela + nome do processo, este sem
        a extensão — o código-fonte fala em `assistente`, não em
        `assistente.exe`."""
        termos, vistos = [], set()
        candidatos = (
            ('titulo_janela', (uia.get('name') or '').strip()),
            ('processo', os.path.splitext((win32.get('processo') or '').strip())[0]),
        )
        for campo, valor in candidatos:
            chave = valor.lower()
            if valor and chave not in vistos:
                termos.append({'campo': campo, 'valor': valor})
                vistos.add(chave)
        return termos

    # Quantos ancestrais viram termo de busca. Além do terceiro nível acima, o
    # nome já é de um contêiner genérico ("Janela", "Painel") e só traz ruído.
    _INSP_MAXIMO_PAIS_COMO_TERMO = 3

    def _inspetor_termos_do_caminho(self, uia, win32):
        """Último recurso do modo "controle": o elemento clicado não tem nome,
        texto nem AutomationId (Pane, Custom, canvas, ícone puro).

        Usa o CAMINHO na árvore de UI, que a captura já montava e ninguém lia.
        Percorre de trás pra frente — o pai imediato é o mais específico —, e
        descarta nome curto demais, que casaria com qualquer coisa.

        Tudo aqui sai marcado `fraco`: descreve o PAI (ou o tipo/classe), não o
        elemento clicado. `_inspetor_pontuar` rebaixa esses casamentos um
        degrau, pra um palpite indireto não se passar por certeza."""
        termos, vistos = [], set()

        def acrescenta(campo, valor):
            valor = (valor or '').strip()
            chave = valor.lower()
            if len(re.sub(r'\W', '', valor)) < 3 or chave in vistos:
                return False
            termos.append({'campo': campo, 'valor': valor, 'fraco': True})
            vistos.add(chave)
            return True

        pais = 0
        for pedaco in reversed((uia.get('caminho') or '').split(' > ')):
            achado = re.search(r'"([^"]+)"', pedaco)
            if achado and acrescenta('pai', achado.group(1)):
                pais += 1
                if pais >= self._INSP_MAXIMO_PAIS_COMO_TERMO:
                    break

        acrescenta('control_type', uia.get('control_type'))
        acrescenta('class_name', win32.get('class_name'))
        return termos

    # Palavras genéricas de UI que, sozinhas, não identificam nada: casar só
    # por elas gera lixo (ex.: "btn" fazia "btn-new-project" casar com
    # ".analise-tab-btn"). Ignoradas no casamento por palavra-em-comum.
    _INSP_STOPWORDS = {
        'btn', 'button', 'tab', 'nav', 'item', 'items', 'list', 'box', 'row',
        'col', 'column', 'div', 'span', 'panel', 'card', 'content', 'active',
        'wrap', 'wrapper', 'container', 'main', 'left', 'right', 'top', 'bottom',
        'icon', 'text', 'title', 'label', 'header', 'footer', 'menu', 'bar',
        'area', 'group', 'block', 'field', 'input', 'link', 'line', 'page',
        'view', 'open', 'close', 'show', 'hide', 'toggle', 'click', 'select',
        'option', 'form', 'body', 'head', 'cell', 'grid', 'flex', 'inner',
        'outer', 'sub', 'new', 'add', 'edit', 'save', 'del', 'delete', 'remove',
    }

    def _inspetor_pontuar(self, nome_lower, termos):
        """Melhor casamento de um símbolo (`nome_lower`) contra os termos
        capturados. Escala de sinal, do mais forte pro mais fraco:

        - **alta**: nome é exatamente o termo; OU o nome contém o **AutomationId**
          como token inteiro (ex.: HTML `button #btn-new-project` contém
          `btn-new-project`) — AutomationId é o id real do elemento, o sinal
          mais confiável que existe.
        - **media**: o texto visível (name/texto) aparece como frase inteira
          dentro do nome do símbolo, ou vice-versa.
        - **baixa**: palavra *significativa* em comum (fora da stoplist e com ≥4
          chars). Palavra genérica ("btn", "tab") nunca casa — era a origem do
          lixo. Retorna `(None, '')` se nada casar.

        Termo marcado `fraco` (veio do elemento PAI, do tipo de controle ou da
        classe Win32) tem o casamento rebaixado um degrau: descreve a
        vizinhança do elemento, não ele.

        Percorre todos os termos e fica com o casamento de maior peso."""
        nome_tokens = set(re.findall(r'\w+', nome_lower))
        melhor = None  # (peso, confianca, motivo) — maior peso vence
        for termo in termos:
            valor = (termo.get('valor') or '').strip()
            vl = valor.lower()
            if not vl:
                continue
            eh_id = termo.get('campo') == 'automation_id'

            if nome_lower == vl:
                cand = (5, 'alta', 'nome do símbolo é exatamente "%s"' % valor)
            elif eh_id and re.search(r'\b%s\b' % re.escape(vl), nome_lower):
                cand = (4, 'alta', 'contém o AutomationId "%s"' % valor)
            elif (not eh_id) and (re.search(r'\b%s\b' % re.escape(vl), nome_lower)
                                  or re.search(r'\b%s\b' % re.escape(nome_lower), vl)):
                cand = (3, 'media', 'contém / está contido em "%s"' % valor)
            else:
                comuns = {t for t in (nome_tokens & set(re.findall(r'\w+', vl)))
                          if len(t) >= 4 and t not in self._INSP_STOPWORDS}
                if comuns:
                    cand = (1, 'baixa', 'palavra significativa em comum com "%s" (%s)'
                            % (valor, ', '.join(sorted(comuns))))
                else:
                    cand = None

            if cand and termo.get('fraco'):
                cand = (cand[0] - 1, _INSP_REBAIXA[cand[1]],
                        cand[2] + ' — via o elemento pai / o tipo do controle')

            if cand and (melhor is None or cand[0] > melhor[0]):
                melhor = cand
        return (melhor[1], melhor[2]) if melhor else (None, '')

    def _inspetor_rankear(self, project_name, symbols, termos):
        """Retorna `(candidatos, indice_desatualizado)`. O segundo valor vira
        `True` se algum símbolo casado apontava pra um arquivo que não existe
        mais no disco — sinal de que o `Índice de Símbolos.json` está velho (ex.:
        arquivo renomeado/movido/quebrado numa refatoração) e precisa ser
        regenerado na aba Análise."""
        candidatos = []
        indice_desatualizado = False
        for sym in symbols:
            nome = sym.get('name') or ''
            nome_lower = nome.lower()
            if not nome_lower:
                continue

            # Defesas contra índice desatualizado que ainda contenha bibliotecas
            # minificadas (índice antigo, gerado antes de `_e_arquivo_minificado`):
            # 1) símbolo de biblioteca minificada não é código endereçável do
            #    usuário; 2) nome com menos de 3 chars alfanuméricos ("a", "$d")
            #    não tem significado e, via `contido em`, casaria com qualquer
            #    termo que contenha aquela letra — a origem exata do lixo de
            #    candidatos. Símbolo real de UI sempre tem nome com significado.
            if self._e_arquivo_minificado(os.path.basename(sym.get('file', ''))):
                continue
            if len(re.sub(r'\W', '', nome_lower)) < 3:
                continue

            confianca, motivo = self._inspetor_pontuar(nome_lower, termos)
            if not confianca:
                continue

            caminho = sym.get('file', '')
            # Nunca oferecer um candidato cujo arquivo não existe mais: era a
            # causa do "arquivo não encontrado no workspace" na hora de ler o
            # trecho, e de snippets vazios. Marca o índice como desatualizado
            # pra avisar o usuário a regenerá-lo.
            if not os.path.isfile(caminho):
                indice_desatualizado = True
                continue

            linha = sym.get('line', 0)
            candidatos.append({
                'name': nome,
                'type': sym.get('type', ''),
                'file': self._inspetor_caminho_relativo(project_name, caminho),
                'line': linha,
                'snippet': self._inspetor_ler_linha(caminho, linha),
                'confidence': confianca,
                'motivo': motivo,
            })
        return candidatos, indice_desatualizado
