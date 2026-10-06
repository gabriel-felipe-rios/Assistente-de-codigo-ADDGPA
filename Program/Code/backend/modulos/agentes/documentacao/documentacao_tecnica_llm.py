import hashlib

from ...constantes import *
from modulos.agentes.llm_estruturado import (
    arquivo_esta_vazio, chat_json, com_retentativa, json_da_resposta,
    mensagens_da_rotina, teto_de_saida_da_chamada, schema_com_limites,
)
from modulos.tokens import contar_tokens, calcular_orcamento
from ..costura import costurar, partir_em_linhas, texto_da_rodada
from ...llm_geracao import ajustes_da_chamada

# Os esquemas de saída, irmãos dos prompts em `prompts/Rotinas/`.
_SCHEMA = 'documentacao-tecnica.json'
_SCHEMA_COSTURA = 'documentacao-tecnica-costura.json'

# O que o `.md` diz de um arquivo literalmente vazio. Não custa chamada: não há
# o que descrever num arquivo de zero byte.
#
# ⚠️ Arquivo **só com comentários NÃO é vazio** e não passa por aqui. Neste
# projeto um prompt É um arquivo só de texto, e um bloco de comentário pode ser
# conteúdo usado na interface — esses continuam recebendo descrição do modelo.
DESCRICAO_DE_ARQUIVO_VAZIO = ('Arquivo vazio: não tem conteúdo nenhum. Existe no '
                              'projeto, mas não há o que documentar até que alguém '
                              'escreva algo nele.')


class ArquivoGrandeDemais(Exception):
    """O arquivo vai para "Arquivos muito grandes": nem o prompt cabe na janela,
    ele passou de «O máximo aceito, mesmo dividindo» (D1, D15), ou não cabe
    numa chamada com «Dividir e costurar» desligado (D9, D14). A mensagem é
    o motivo que a sub-aba mostra."""


# As partes da documentação de um arquivo que a IA escreve, e que o estado
# guarda por arquivo (D25). As frases moram nos símbolos.
_DT_CAMPOS = ('sintese', 'atribuicoes', 'categoria', 'tipo', 'tags', 'termos')


class DocumentacaoTecnicaLlmMixin:
    """Chamadas ao LLM e leitura da resposta para a Documentação Técnica.

    O LLM escreve a prosa — Síntese, Atribuições, Metadados, Termos (o que era
    do Espelho, retirado em 2026-09 — D18) e a frase de cada símbolo. Nome,
    tipo e linha de cada símbolo vêm do tree-sitter (ver
    documentacao_tecnica_render.py) e nunca passam por aqui.

    As chamadas aceitam um `portao` (tokens.py::PortaoDeContexto) porque o
    agente dispara `parallel` arquivos ao mesmo tempo contra uma janela só. E
    conferem o `finish_reason`: resposta cortada levanta `RespostaCortada`, que
    o `process_file` transforma em entrada da aba Erros — sem sobrescrever o
    `.md` bom que já estava lá.
    """

    def _dt_chamar(self, client, portao, prompt, blocos, schema, name, limites, model,
                   tokens_do_trecho, fase=None, parado=None):
        """Uma chamada: prompt no `system`, blocos no `user`, travas de tamanho.

        Segura o espaço de janela que ela vai ocupar (`portao`), com o teto de
        saída proporcional ao trecho (D19), e devolve o dicionário já lido —
        `json_da_resposta` confere o `finish_reason` antes, com a mensagem que
        distingue repetição de falta de teto (D7).
        Falha passageira é tentada de novo (D4, `com_retentativa`); `fase` põe a tentativa na tela e `parado` é a parada do projeto.
        """
        mensagens = mensagens_da_rotina(prompt, blocos)
        teto = teto_de_saida_da_chamada(limites, tokens_do_trecho)
        custo = contar_tokens(prompt) + contar_tokens(mensagens[1]['content']) + teto
        chamada = lambda: chat_json(
            client, model, mensagens,
            schema=schema_com_limites(self._schema_da_rotina(schema), limites),
            name=name, max_tokens=teto,
            **ajustes_da_chamada(self.load_settings()['settings'], 'rotinas', model),
        )
        def reservar_e_chamar():
            # A reserva é POR TENTATIVA: esperar para tentar de novo não pode
            # segurar espaço da janela que as outras chamadas querem.
            if portao is None:
                return chamada()
            with portao.reservar(custo):
                return chamada()

        avisar = None
        if fase:
            avisar = lambda n, total, espera: fase('tentativa %d de %d' % (n, total),
                                                   True, espera)
        resp = com_retentativa(reservar_e_chamar, avisar, parado)
        return json_da_resposta(resp, self._resgate_ligado(), teto_usado=teto,
                                teto_configurado=int(limites['teto_saida']),
                                tokens_do_arquivo=tokens_do_trecho)

    @staticmethod
    def _dt_textos(valor):
        """Lista de textos limpos, sem vazios e sem repetição, na ordem."""
        saida = []
        for item in (valor if isinstance(valor, list) else []):
            texto = str(item or '').strip().strip('`*').strip()
            if texto and texto not in saida:
                saida.append(texto)
        return saida

    def _dt_pedir_documentacao(self, client, model, prompt, rel, alvo, trecho,
                               rotulo_codigo, limites, portao=None, fase=None,
                               parado=None):
        """Síntese, atribuições, metadados, termos e as frases de `alvo`.

        `alvo` são os símbolos a descrever nesta chamada — pode vir vazio: é o
        arquivo sem símbolos e o "só mudou um comentário". `frases` volta como
        `{numero: frase}`, numerado como `alvo`.

        A leitura das frases era uma regex frouxa que aceitava qualquer linha
        começando por número — inclusive texto do raciocínio do modelo. Com o
        esquema, `numero` é inteiro e `frase` é texto: não há o que interpretar.
        """
        blocos = [
            ('ARQUIVO', rel, rel),
            ('SÍMBOLOS A DESCREVER', str(len(alvo)),
             self._dt_esqueleto(alvo) if alvo else 'nenhum — descreva só o arquivo'),
            ('CÓDIGO', rotulo_codigo, '```\n' + trecho + '\n```'),
        ]
        dados = self._dt_chamar(client, portao, prompt, blocos, _SCHEMA,
                                'documentacao_tecnica', limites, model,
                                contar_tokens(trecho), fase, parado)
        frases = {}
        for item in (dados.get('frases') or []):
            if not isinstance(item, dict):
                continue
            try:
                numero = int(item.get('numero'))
            except (TypeError, ValueError):
                continue
            frase = str(item.get('frase') or '').strip().strip('`*')
            if frase:
                frases[numero] = frase
        return {
            'sintese': str(dados.get('sintese') or '').strip(),
            'atribuicoes': self._dt_textos(dados.get('atribuicoes')),
            'categoria': str(dados.get('categoria') or 'outro').strip() or 'outro',
            'tipo': str(dados.get('tipo') or 'outro').strip() or 'outro',
            'tags': self._dt_textos(dados.get('tags')),
            'termos': self._dt_textos(dados.get('termos')),
            'frases': frases,
        }

    def _dt_costurar(self, client, model, prompt_costura, rel, partes, limites, portao=None,
                     fase=None, parado=None):
        """Síntese, atribuições, metadados e termos do arquivo INTEIRO, a partir
        das partes — `[(inicio, fim, dados), ...]`. Ver `agentes/costura.py`."""

        def formatar(item, n, total):
            return '[PARTE %d de %d — linhas %s–%s]\n%s' % (
                n, total, item.get('_inicio'), item.get('_fim'), '\n'.join([
                    'síntese: %s' % item.get('sintese', ''),
                    'atribuições: %s' % '; '.join(item.get('atribuicoes') or []),
                    'categoria: %s' % item.get('categoria', ''),
                    'tipo: %s' % item.get('tipo', ''),
                    'tags: %s' % ', '.join(item.get('tags') or []),
                    'termos: %s' % ', '.join(item.get('termos') or []),
                ]))

        def chamar(textos):
            # Cada texto é o bloco que `formatar` escreveu: a primeira linha é o
            # rótulo `[PARTE n de N — linhas a–b]`, que volta a ser o par
            # (tipo, nome) do envelope — um formato de rótulo só no programa.
            blocos = [('ARQUIVO', rel, rel)]
            for texto in textos:
                cabeca, corpo = texto.split('\n', 1)
                tipo, nome = cabeca.strip('[]').split(' — ', 1)
                blocos.append((tipo, nome, corpo))
            dados = self._dt_chamar(client, portao, prompt_costura, blocos,
                                    _SCHEMA_COSTURA, 'documentacao_tecnica_costura',
                                    limites, model, sum(contar_tokens(t) for t in textos),
                                    fase, parado)
            return {
                'sintese': str(dados.get('sintese') or '').strip(),
                'atribuicoes': self._dt_textos(dados.get('atribuicoes')),
                'categoria': str(dados.get('categoria') or 'outro').strip() or 'outro',
                'tipo': str(dados.get('tipo') or 'outro').strip() or 'outro',
                'tags': self._dt_textos(dados.get('tags')),
                'termos': self._dt_textos(dados.get('termos')),
            }

        itens = [dict(d, _inicio=ini, _fim=fim) for ini, fim, d in partes]
        limite = int(limites['teto_entrada']) - contar_tokens(prompt_costura)
        # D7: «costurando», «costurando · rodada N» — ver `costura.texto_da_rodada`.
        rodada = (lambda n, final: fase(texto_da_rodada(n, final))) if fase else None
        junto = costurar(itens, chamar, formatar, limite, rodada)
        return {k: junto.get(k) for k in ('sintese', 'atribuicoes', 'categoria',
                                          'tipo', 'tags', 'termos')}

    def _dt_gerar_um_arquivo(self, client, model, prompts, rel, file_content,
                             syms_do_arquivo, anterior_do_estado, limites, portao=None,
                             nomes_css=frozenset(), fase=None, parado=None):
        """A documentação de UM arquivo: o que é refeito, e quando (D25).

        Devolve `(registro_novo_do_estado, simbolos, chamou_o_modelo)`. Levanta
        `ArquivoGrandeDemais` quando nem o prompt cabe na janela. É o caminho da
        rotina e o do script de comparação — um só.

        - **Zero modelo**: nenhum símbolo novo ou alterado, Síntese já existe e
          o conteúdo (espaço em branco colapsado) é o mesmo — só as linhas
          mudaram (reindentar, linha em branco). Herda tudo.
        - **Arquivo vazio**: sem chamada.
        - **O modelo**: com os símbolos a descrever (lista vazia é válida: é o
          "só comentário" e o arquivo sem símbolos). Cabendo numa chamada, uma;
          não cabendo, partes + costura (D21-5) — o modelo vê o arquivo
          inteiro, e não só o começo.

        `fase(texto, tentativa=False, espera=None)` põe na tela em que passo o
        arquivo está — «parte 2 de 3», «costurando», «tentativa 2 de 3» (D7);
        `parado()` é a parada do projeto, que corta a retentativa (D4). Os dois
        são opcionais: sem eles, a geração roda como antes, sem fase na tela.
        """
        prompt, prompt_costura = prompts
        anterior_do_estado = anterior_do_estado or {}
        lines = file_content.splitlines()
        simbolos = self._dt_montar_simbolos(syms_do_arquivo, lines)
        anterior = {s['chave']: s for s in anterior_do_estado.get('simbolos', [])}

        def mudou(s):
            # O hash sem espaço em branco manda quando o estado já o tem: é o
            # que faz reindentar não contar como mudança. Estado antigo, sem
            # ele, compara pelo `corpo_hash` de sempre.
            ant = anterior[s['chave']]
            if ant.get('corpo_ws'):
                return ant['corpo_ws'] != s['corpo_ws']
            return ant.get('corpo_hash') != s['corpo_hash']

        novos = [s for s in simbolos if s['chave'] not in anterior]
        alterados = [s for s in simbolos if s['chave'] in anterior and mudou(s)]
        pendentes = novos + alterados
        chaves_pendentes = {s['chave'] for s in pendentes}

        # Num `.css` não há frase por seletor (D25): nada a herdar, nada a
        # pedir — o modelo descreve só o arquivo.
        sem_frase = not self._dt_tem_frase_por_simbolo(rel)
        # Herda as frases que continuam valendo — é o que evita regerar 30
        # frases idênticas quando só a linha mudou.
        for s in simbolos:
            ant = anterior.get(s['chave'])
            if sem_frase:
                s['frase'] = ''
            elif ant and s['chave'] not in chaves_pendentes:
                s['frase'] = ant.get('frase', '')

        conteudo_hash = hashlib.md5(
            ' '.join(file_content.split()).encode('utf-8', 'replace')).hexdigest()
        registro = {k: anterior_do_estado.get(k) for k in _DT_CAMPOS}
        chamou = False

        if (not pendentes and anterior_do_estado.get('sintese')
                and anterior_do_estado.get('conteudo_hash') == conteudo_hash):
            pass   # Só as linhas mudaram. Zero modelo.
        elif arquivo_esta_vazio(file_content):
            registro = {'sintese': DESCRICAO_DE_ARQUIVO_VAZIO, 'atribuicoes': [],
                        'categoria': 'outro', 'tipo': 'outro', 'tags': [], 'termos': []}
        else:
            # D1, P2: «O máximo aceito, mesmo dividindo», do mais barato ao mais
            # caro — as linhas antes dos tokens. O tamanho em KB já foi medido
            # no disco, antes de abrir (`documentacao_tecnica_agente.py`). Só
            # com «Dividir e costurar» ligado (D9, D14).
            dividir = bool(limites['doc_tecnica_dividir'])
            if dividir and len(lines) > int(limites['doc_tecnica_max_linhas']):
                raise ArquivoGrandeDemais(
                    'passa do máximo aceito: %d linhas, limite %d'
                    % (len(lines), int(limites['doc_tecnica_max_linhas'])))
            alvo = [] if sem_frase else (pendentes if anterior else simbolos)
            esqueleto = self._dt_esqueleto(alvo)
            orc = calcular_orcamento(limites, prompt, esqueleto)
            if orc['sobra_tokens'] <= 0:
                raise ArquivoGrandeDemais('janela de contexto pequena demais para este arquivo')
            t_prompt, t_esqueleto = contar_tokens(prompt), contar_tokens(esqueleto)
            t_arquivo = contar_tokens(file_content)
            if dividir and t_arquivo > int(limites['doc_tecnica_max_tokens']):
                raise ArquivoGrandeDemais(
                    'passa do máximo aceito: %d tokens, limite %d'
                    % (t_arquivo, int(limites['doc_tecnica_max_tokens'])))
            cabe = (t_arquivo <= orc['sobra_tokens']
                    and t_prompt + t_esqueleto + t_arquivo <= int(limites['teto_entrada']))
            if cabe:
                dados = self._dt_pedir_documentacao(client, model, prompt, rel, alvo,
                                                    file_content, rel, limites, portao,
                                                    fase, parado)
                for i, s in enumerate(alvo, 1):
                    if i in dados['frases']:
                        s['frase'] = dados['frases'][i]
            else:
                # D9, D14: «Dividir e costurar» desligado — o arquivo que não
                # cabe numa chamada fica de fora, em «Arquivos muito grandes».
                if not dividir:
                    raise ArquivoGrandeDemais(
                        'não cabe numa chamada (%d tokens, até %d por chamada), e '
                        '«Dividir e costurar o arquivo» está desligado'
                        % (t_arquivo, int(limites['teto_entrada'])))
                limite = int(limites['teto_entrada']) - t_prompt - t_esqueleto
                if limite <= 0:
                    raise ArquivoGrandeDemais('janela de contexto pequena demais para este arquivo')
                partes = partir_em_linhas(lines, limite,
                                          cortes_preferidos=[s['linha'] for s in simbolos])
                resultados = []
                for n, (inicio, fim) in enumerate(partes, 1):
                    if fase:
                        fase('parte %d de %d' % (n, len(partes)))
                    # Os símbolos desta parte, renumerados de 1: o número local
                    # é o que o modelo devolve, e o mapa o traz de volta.
                    locais = [s for s in alvo if inicio <= s['linha'] <= fim]
                    trecho = '\n'.join(lines[inicio - 1:fim])
                    rotulo = '%s, parte %d de %d, linhas %d–%d' % (rel, n, len(partes), inicio, fim)
                    dados = self._dt_pedir_documentacao(client, model, prompt, rel, locais,
                                                        trecho, rotulo, limites, portao,
                                                        fase, parado)
                    for i, s in enumerate(locais, 1):
                        if i in dados['frases']:
                            s['frase'] = dados['frases'][i]
                    resultados.append((inicio, fim, dados))
                dados = self._dt_costurar(client, model, prompt_costura, rel,
                                          resultados, limites, portao, fase, parado)
            registro = {k: dados.get(k) for k in _DT_CAMPOS}
            chamou = True
            for s in alvo:
                if not s.get('frase'):
                    s['frase'] = ''

        # Vale também para o que foi herdado do estado: é assim que um arquivo
        # antigo perde os identificadores que o prompt de antes deixava passar.
        registro['termos'] = self._dt_filtrar_termos(
            registro.get('termos'), [s.get('nome') for s in simbolos], nomes_css)
        registro['conteudo_hash'] = conteudo_hash
        registro['simbolos'] = [{k: s.get(k) for k in
                                 ('chave', 'nome', 'tipo', 'linha', 'assinatura',
                                  'corpo_hash', 'corpo_ws', 'frase')} for s in simbolos]
        return registro, simbolos, chamou

    # Família de linguagem por extensão: uma ligação ENTRE famílias só vale por
    # um nome com cara de identificador (ver `_dt_aresta_vale`).
    _DT_FAMILIAS = {'.py': 'py', '.pyw': 'py',
                    '.js': 'web', '.mjs': 'web', '.ts': 'web', '.jsx': 'web',
                    '.tsx': 'web', '.html': 'web', '.htm': 'web',
                    '.css': 'css', '.scss': 'css'}

    @classmethod
    def _dt_aresta_vale(cls, origem, destino, nomes):
        """A ligação `origem usa destino` (pelos `nomes`) entra nas Conexões?

        ⚠️ **PALAVRA COMUM NÃO LIGA LINGUAGENS DIFERENTES (24/09/2026).** O
        Índice de Identificadores casa nome, e em código escrito em português
        os comentários estão cheios de palavras que também são classe de CSS ou
        variável de JS: `detector_classes.py` "usava" `aparencia.css` por
        «fora», «grande», «desligado», e `chat.css` por «erro». As Conexões de
        cada arquivo saíam com dezenas de ligações falsas, a ficha do Resumo de
        Pastas inchava para 20 mil tokens e o modelo entrava em repetição
        listando esses nomes.

        Entre famílias diferentes (py × web × css), a ligação só vale se algum
        nome tiver cara de identificador — maiúscula, `_`, `-` ou dígito
        (`acionamentosEsperaStatus`, `vis-no`, `get_espera_status`). Dentro da
        mesma família, fica como está. O índice em si não muda: esta é só a
        leitura dele que vai para a Documentação Técnica e o Resumo de Pastas.
        """
        import os, re
        fam = lambda c: cls._DT_FAMILIAS.get(os.path.splitext(c)[1].lower())
        fo, fd = fam(origem), fam(destino)
        if not fo or not fd or fo == fd:
            return True
        return any(not re.fullmatch(r'[a-zà-ÿ]+', n or '') for n in nomes)

    def _dt_relacoes_map(self, project_name):
        """{chave_arquivo: (usa, usado_por)} a partir do índice de identificadores."""
        try:
            arestas = self._id_arestas(project_name)
        except Exception:
            return {}
        mapa = {}
        for origem, destinos in arestas.items():
            destinos = {d: n for d, n in destinos.items()
                        if self._dt_aresta_vale(origem, d, n)}
            usa = sorted(destinos)
            mapa.setdefault(origem, [[], []])[0] = usa
            for destino in destinos:
                mapa.setdefault(destino, [[], []])[1].append(origem)
        return {k: (v[0], sorted(set(v[1]))) for k, v in mapa.items()}
