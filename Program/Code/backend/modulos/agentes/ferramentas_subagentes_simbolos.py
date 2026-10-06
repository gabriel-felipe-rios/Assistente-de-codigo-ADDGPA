"""O que o índice de símbolos e os embeddings respondem: relações e sentido.

Duas ferramentas — `ler_relacoes` e `busca_semantica` — mais o que as duas
precisam para casar o que o modelo pediu com o que está gravado.

Separadas de `_leitura.py` porque a fonte é outra, e a diferença importa na hora
de investigar: lá se lê um artefato de TEXTO, escrito por uma rotina, e a falha
típica é o arquivo não ter sido gerado; aqui se consulta um ÍNDICE por chave, e
a falha típica é a chave não casar — daí `_sub_resolver_chave_identificadores` e
`_sub_rotulos_de_definicao`, que não teriam paralelo do outro lado.

⚠️ RELAÇÃO NÃO É IMPORT. `ler_relacoes` casa MENÇÃO DE IDENTIFICADOR: função
global chamada de outro arquivo, ponte entre o back e o front, id declarado no
HTML e lido no JS. É onde mora o perigo real — renomear qualquer um desses não
gera erro nenhum, e a tela só fica vazia. Quem quer `import` usa
`ler_grafo_imports`, que lê outra base.

⚠️ BUSCA SEM BANCO DE EMBEDDING DIZ QUAL AGENTE O GERA, em vez de devolver
"nada encontrado" — que o modelo leria como "não existe", e não como "ninguém
indexou ainda".
"""

from modulos.agentes.ferramentas_subagentes_constantes import *


class FerramentasSubagentesSimbolosMixin:

    def _ferr_ler_relacoes(self, project_name, caminho):
        """Quem usa este arquivo e o que ele usa, pelo índice de identificadores."""
        if not isinstance(caminho, str) or not caminho.strip():
            raise ValueError('parâmetro "caminho" vazio ou inválido')
        chave = self._sub_resolver_chave_identificadores(project_name, caminho)
        r = self.get_relacoes(project_name, chave)
        if not r.get('success'):
            raise ValueError(r.get('error') or 'falha ao ler as relações')

        usa = r.get('usa', [])
        usado_por = r.get('usado_por', [])
        partes = [f'Relações de {chave}:']
        if chave.replace('\\', '/') != caminho.strip().replace('\\', '/'):
            partes.append(f'(o caminho "{caminho}" foi resolvido para "{chave}" no índice)')

        for titulo, itens in (('USA', usa), ('USADO POR', usado_por)):
            partes.append('')
            if not itens:
                partes.append(f'{titulo}: nenhum arquivo.')
                continue
            partes.append(f'{titulo} ({len(itens)}):')
            max_relacoes = self._sub_limite('relacoes_max_itens')
            for item in itens[:max_relacoes]:
                via = ', '.join(item.get('via', [])[:6])
                partes.append(f'- {item["arquivo"]}' + (f' — via: {via}' if via else ''))
            if len(itens) > max_relacoes:
                partes.append(f'  … mais {len(itens) - max_relacoes} arquivo(s)')
        return '\n'.join(partes)

    def _sub_rotulos_de_definicao(self, project_name, termo):
        """Onde `termo` é DEFINIDO, segundo o Índice de Identificadores.

        Devolve `(rotulos, gerado_em)`, com `rotulos` mapeando
        `(nome do arquivo, linha) -> 'definicao'|'uso'`. Vazio quando o termo
        não é um identificador indexado — uma busca por texto livre não recebe
        rótulo nenhum, e a saída do grep fica igual à de antes.

        ⚠️ A chave é **(nome do arquivo, linha)**, e não o caminho. O índice
        indexa por `{pasta de trabalho}/{relativo}` e o grep devolve caminho
        relativo à RAIZ — os dois não falam o mesmo dialeto, e é o mesmo
        desencontro que `_sub_resolver_chave_identificadores` existe para
        resolver. Aqui não dá para usar o resolvedor (ele levanta, e seria uma
        chamada por arquivo), e casar o caminho cru marcaria tudo como "uso".
        Dois arquivos de mesmo nome, com o MESMO identificador definido na MESMA
        linha, é o único falso positivo possível — e nesse caso o rótulo estaria
        certo nos dois.
        """
        alvo = (termo or '').strip()
        if not alvo:
            return {}, None
        dados = self._id_load(project_name)
        nomes = dados.get('nomes') or {}
        ocorrencias = nomes.get(alvo)
        if ocorrencias is None:
            # O grep é tolerante a caixa; o índice guarda o identificador como
            # ele foi escrito. Uma varredura só, e só quando o exato falhou.
            for nome, ocs in nomes.items():
                if nome.lower() == alvo.lower():
                    ocorrencias = ocs
                    break
        if not ocorrencias:
            return {}, None
        rotulos = {}
        for oc in ocorrencias:
            arq = (oc.get('arquivo') or '').replace(os.sep, '/')
            base = arq.rsplit('/', 1)[-1]
            linha = oc.get('linha')
            if not base or not isinstance(linha, int):
                continue
            # `definicao` vence: se as duas versões existirem para a mesma
            # (arquivo, linha), a que informa é a definição.
            if rotulos.get((base, linha)) != 'definicao':
                rotulos[(base, linha)] = oc.get('tipo') or 'uso'
        return rotulos, dados.get('gerado_em')

    def _sub_chaves_do_indice(self, project_name):
        """Os caminhos de arquivo que o índice de identificadores conhece.

        ⚠️ Saem de `dados['nomes']`, então o índice cobre só **arquivos com
        identificador indexado** — código. Um `.md`, um `.json` ou um `.txt`
        nunca vai estar aqui, e a ausência deles NÃO significa que não existem.
        Quem usa isto para julgar existência precisa levar isso em conta.
        """
        dados = self._id_load(project_name)
        chaves = set()
        for ocorrencias in (dados.get('nomes') or {}).values():
            for oc in ocorrencias:
                if oc.get('arquivo'):
                    chaves.add(oc['arquivo'])
        return chaves

    def _sub_resolver_chave_identificadores(self, project_name, caminho):
        """Traduz um caminho do projeto para a chave usada no índice de identificadores.

        Os dois não falam o mesmo dialeto: o índice indexa por
        `{nome da pasta de trabalho}/{relativo}`, e todas as outras ferramentas
        (grep, ler_arquivo) devolvem caminho relativo à raiz do projeto. Sem
        traduzir, o analista passa um caminho vindo do grep e recebe "nenhuma
        relação" — resposta plausível e errada, que é o pior tipo de falha.
        """
        alvo = caminho.strip().replace('\\', '/').lstrip('/')
        while alvo.startswith('./'):
            alvo = alvo[2:]

        chaves = self._sub_chaves_do_indice(project_name)
        if not chaves:
            raise ValueError('índice de identificadores não gerado — peça ao usuário '
                             'para rodar o agente Identificadores na aba Automação')

        if alvo in chaves:
            return alvo
        candidatos = sorted(k for k in chaves
                            if k.endswith('/' + alvo) or alvo.endswith('/' + k))
        if len(candidatos) == 1:
            return candidatos[0]
        if len(candidatos) > 1:
            lista = '\n'.join(f'- {c}' for c in candidatos[:20])
            raise ValueError(f'"{caminho}" casa com mais de um arquivo do índice. '
                             f'Use o caminho completo:\n{lista}')

        base = alvo.rsplit('/', 1)[-1]
        parecidos = sorted(k for k in chaves if k.rsplit('/', 1)[-1] == base)
        if len(parecidos) == 1:
            return parecidos[0]
        if parecidos:
            lista = '\n'.join(f'- {c}' for c in parecidos[:20])
            raise ValueError(f'"{caminho}" não está no índice. Arquivos com esse nome:\n{lista}')
        lista = '\n'.join(f'- {c}' for c in sorted(chaves)[:60])
        raise ValueError(f'"{caminho}" não está no índice de identificadores. '
                         f'Arquivos indexados:\n{lista}')

    def _ferr_busca_semantica(self, project_name, descricao, tipo=None):
        """Busca por significado no banco de embeddings, com queda para busca literal."""
        if not isinstance(descricao, str) or not descricao.strip():
            raise ValueError('parâmetro "descricao" vazio ou inválido')
        tipo = (tipo or 'documentacao-tecnica').strip()
        if tipo not in BUSCA_SEMANTICA_TIPOS:
            raise ValueError(f'tipo "{tipo}" inválido — use um destes: '
                             + ', '.join(BUSCA_SEMANTICA_TIPOS))

        erro_embedding = None
        # Era 200 CARACTERES. Vira token porque o que este recorte protege é a
        # janela de quem recebe o trecho, e janela se mede em token.
        excerto_tokens = self._sub_limite('busca_semantica_excerpt_tokens')
        try:
            r = self.search_embeddings(project_name, descricao.strip(), tipo,
                                       self._sub_limite('busca_semantica_top_k'))
            if r.get('success') and r.get('results'):
                linhas = [f'Candidatos (busca semântica — {tipo}):']
                for x in r['results']:
                    fonte = x.get('source_file') or x.get('doc_path') or '?'
                    score = float(x.get('score') or 0)
                    trecho = (x.get('excerpt') or '').strip().replace('\n', ' ')
                    trecho = cortar_em_tokens(trecho, excerto_tokens)
                    linhas.append(f'- {fonte} (score {score:.2f}): {trecho}')
                return '\n'.join(linhas)
            if not r.get('success'):
                erro_embedding = r.get('error')
        except Exception as e:
            erro_embedding = str(e)

        # Índice vazio não é erro: é sucesso com lista vazia, e o caminho certo
        # é cair para a busca literal na mesma fonte antes de desistir.
        try:
            r = self.search_doc_content(project_name, descricao.strip(), tipo)
            resultados = r.get('results', []) if isinstance(r, dict) else []
            if resultados:
                linhas = [f'Candidatos (busca literal — embedding indisponível, {tipo}):']
                for x in resultados[:10]:
                    fonte = x.get('source_file') or x.get('doc_path') or x
                    trecho = (x.get('excerpt') or '').strip().replace('\n', ' ')
                    linhas.append(f'- {fonte}: {cortar_em_tokens(trecho, excerto_tokens)}')
                return '\n'.join(linhas)
        except Exception:
            pass

        if erro_embedding:
            raise ValueError(f'busca semântica indisponível: {erro_embedding}')
        raise ValueError(f'nada encontrado para "{descricao.strip()}" em {tipo}. '
                         'Se o banco de embeddings ainda não foi gerado, peça ao '
                         'usuário para rodar o agente Embedding Semântico na aba Automação')
