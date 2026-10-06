"""Ler a Documentação técnica e o Resumo de pastas POR SEÇÃO, de vários alvos numa chamada.

A pergunta que este arquivo responde: «destes arquivos (ou pastas), quais
seções?». É a leitura ÚNICA das duas ferramentas — o subagente
(`ler_doc_tecnica`, `ler_resumo_pastas`) e o servidor MCP (`doc_tecnica`,
`resumo_pastas`) chamam as mesmas duas funções; só o teto muda, por `quem`.

O pedido é um parâmetro só, `ler`, que liga cada alvo às seções:

    {"Program/Code/backend/api.py": "sintese",
     "Program/Code/server": "tudo",
     "Program/Code/frontend/app.js": "sintese,simbolos"}

⚠️ A SEÇÃO É OBRIGATÓRIA. Sem ela a resposta é o erro com o exemplo de como
pedir — nunca o documento inteiro por padrão. O documento inteiro é `tudo`,
pedido de propósito. Motivo: a média é ~1.060 tokens por arquivo, e só a
Síntese ~68; 50 arquivos inteiros são ~53.000 tokens, só a Síntese ~3.400.

⚠️ SEÇÃO QUE O ARQUIVO NÃO TEM NÃO É ERRO. Os nomes são sempre os mesmos
(`SECOES_DOC_TECNICA`, `SECOES_RESUMO_PASTAS`); a que falta naquele arquivo sai
como uma linha dizendo que não existe ali, e o resto segue. Nome de seção que
não existe em lista nenhuma, esse sim é erro — é digitação, e a resposta traz a
lista certa.

⚠️ O QUE NÃO COUBE NUNCA É CORTADO EM SILÊNCIO. A resposta enche até o teto da
parte (`_sub_teto_parte(quem)`), na ordem pedida, e termina com o `ler` exato
do que ficou de fora — pronto para colar na chamada seguinte. Para esse resto
caber em poucas chaves existe a forma `caminho+` («deste item até o fim da
pasta dele»), que quem escreve é a própria ferramenta.
"""

import re

from modulos.agentes.ferramentas_subagentes_constantes import *

# `secao` ou `secao:2` — a página de uma seção maior que o teto.
_RE_SECAO = re.compile(r'^(.+?)(?::(\d+))?$')


class FerramentasSubagentesSecoesMixin:

    # ── As duas ferramentas ───────────────────────────────────────────────────
    def _ferr_ler_doc_tecnica(self, project_name, ler=None, quem=LEITOR_LM_STUDIO):
        entradas = self._sub_entradas_md(
            obter_pasta_da_rotina(project_name, 'documentacao-tecnica'))
        if not entradas:
            raise ValueError('documentação técnica não gerada — peça ao usuário para '
                             'rodar a rotina Documentação Técnica na aba Automação')
        return self._sub_ler_por_secao('documentação técnica', entradas, ler,
                                       SECOES_DOC_TECNICA, EXEMPLO_LER_DOC_TECNICA,
                                       por_pasta=False, quem=quem)

    def _ferr_ler_resumo_pastas(self, project_name, ler=None, quem=LEITOR_LM_STUDIO):
        entradas = self._sub_entradas_md(
            obter_pasta_da_rotina(project_name, 'resumo-pastas'))
        if not entradas:
            raise ValueError('resumo de pastas não gerado — peça ao usuário para '
                             'rodar a rotina Resumo de Pastas na aba Automação')
        return self._sub_ler_por_secao('resumo de pastas', entradas, ler,
                                       SECOES_RESUMO_PASTAS, EXEMPLO_LER_RESUMO_PASTAS,
                                       por_pasta=True, quem=quem)

    # ── O que existe no disco ─────────────────────────────────────────────────
    @staticmethod
    def _sub_entradas_md(base):
        """{caminho sem `.md`: caminho no disco}.

        ⚠️ O `_` só protege na RAIZ da rotina, onde moram os arquivos dela
        (D33); lá dentro `__init__.py.md` é a documentação de um `__init__.py`
        como outra qualquer.
        """
        entradas = {}
        if not os.path.isdir(base):
            return entradas
        for dirpath, _dirs, fnames in os.walk(base):
            for fname in fnames:
                if fname.endswith('.md') and not (fname.startswith('_') and dirpath == base):
                    full = os.path.join(dirpath, fname)
                    entradas[os.path.relpath(full, base).replace(os.sep, '/')[:-3]] = full
        return entradas

    @staticmethod
    def _sub_ordem(rel, por_pasta):
        """A chave de ordenação: a ordem em que os itens são servidos.

        Documentação técnica: os ARQUIVOS de uma pasta antes das subpastas
        dela, em profundidade. Resumo de pastas: a pasta, depois as subpastas.
        Nos dois, tudo o que vem depois de um item DENTRO da pasta dele é um
        pedaço contínuo — é o que a forma `caminho+` descreve.
        """
        partes = rel.split('/')
        if por_pasta:
            return [(1, p) for p in partes]
        return [(1, p) for p in partes[:-1]] + [(0, partes[-1])]

    # ── O pedido ──────────────────────────────────────────────────────────────
    @staticmethod
    def _sub_erro_de_pedido(artefato, exemplo, secoes, motivo, extra=''):
        return ValueError(f'{artefato}: {motivo}\n\nComo pedir:\n{exemplo}\n\n'
                          f'Seções: {", ".join(secoes)}. "{SECAO_TUDO}" = o arquivo '
                          f'inteiro. Várias seções no mesmo alvo vão separadas por '
                          f'vírgula.{extra}')

    def _sub_pedido(self, artefato, ler, secoes, exemplo, extra):
        """`ler` validado: [(alvo, [(secao, pagina)])], na ordem do pedido."""
        # O modelo às vezes manda o objeto como texto JSON.
        if isinstance(ler, str) and ler.strip().startswith('{'):
            try:
                ler = json.loads(ler)
            except Exception:
                pass
        if not isinstance(ler, dict) or not ler:
            raise self._sub_erro_de_pedido(
                artefato, exemplo, secoes,
                'diga o que ler no parâmetro "ler" — um objeto que liga cada alvo '
                'às seções que você quer.', extra)
        # A seção aceita a chave (`sintese`) ou o título inteiro (`Síntese`,
        # `Termos do projeto`), sem acento nem caixa.
        por_nome = {}
        for chave, titulo in secoes.items():
            por_nome[chave] = chave
            por_nome[partes_artefato.normalizar(titulo)] = chave
        pedido = []
        for alvo, valor in ler.items():
            if isinstance(valor, list):
                valor = ','.join(str(v) for v in valor)
            if not isinstance(valor, str) or not valor.strip():
                raise self._sub_erro_de_pedido(
                    artefato, exemplo, secoes, f'faltou dizer as seções de "{alvo}".')
            escolhidas = []
            for pedaco in valor.split(','):
                nome_pedido = partes_artefato.normalizar(pedaco)
                if not nome_pedido:
                    continue
                m = _RE_SECAO.match(nome_pedido)
                nome, pagina = m.group(1).strip(), int(m.group(2) or 1)
                if nome == SECAO_TUDO:
                    novas = [(c, 1) for c in secoes]
                elif nome in por_nome:
                    novas = [(por_nome[nome], max(1, pagina))]
                else:
                    raise self._sub_erro_de_pedido(
                        artefato, exemplo, secoes,
                        f'a seção "{pedaco.strip()}" (em "{alvo}") não existe.')
                escolhidas += [s for s in novas if s not in escolhidas]
            if not escolhidas:
                raise self._sub_erro_de_pedido(
                    artefato, exemplo, secoes, f'faltou dizer as seções de "{alvo}".')
            pedido.append((str(alvo), escolhidas))
        return pedido

    @classmethod
    def _sub_resolver_alvo(cls, alvo, nomes, por_pasta):
        """(base, [itens em ordem]) de UM alvo, ou (None, aviso).

        Documentação técnica: o alvo é um arquivo, ou uma pasta — que vale por
        todos os arquivos dela, em qualquer profundidade. Resumo de pastas: o
        alvo é a pasta, e só o resumo DELA; uma pasta sem resumo próprio vale
        pelos resumos das pastas de dentro. Nos dois, `.` é o projeto inteiro e
        `caminho+` é o item e tudo o que vem depois dele na pasta dele (a forma
        que a própria ferramenta escreve no fim de uma resposta cortada).
        Aceita o fim do caminho e ignora acento, caixa, `\\` e `.md`. Dois
        caminhos diferentes que casam com o mesmo fim não se escolhem: vira
        aviso com os candidatos.
        """
        ordem = lambda n: cls._sub_ordem(n, por_pasta)  # noqa: E731
        mais = alvo.strip().endswith('+')
        k = partes_artefato.normalizar(alvo.strip().rstrip('+'))
        if k in ('', '.') and not mais:
            return '.', sorted(nomes, key=ordem)

        def casam(so_o_item):
            achadas = set()
            for n in nomes:
                partes = n.split('/')
                for i in range(len(partes) if so_o_item else 1, len(partes) + 1):
                    prefixo = '/'.join(partes[:i])
                    p = partes_artefato.normalizar(prefixo)
                    if p == k or p.endswith('/' + k):
                        achadas.add(prefixo)
            return achadas

        # Com `+`, e no resumo, o item em si vem primeiro: lá a pasta que tem
        # resumo É o item. Só depois vale a pasta acima dos itens.
        bases = casam(True) if (mais or por_pasta) else set()
        if not bases and not mais:
            bases = casam(False)
        if not bases:
            return None, (f'"{alvo}": nada com esse caminho. '
                          + partes_artefato.sugestoes(
                              nomes, k, rotulo='Caminhos',
                              como_ver_todas='veja o índice de navegação'))
        if len(bases) > 1:
            lista = sorted(bases)
            resto = f'\n(e mais {len(lista) - 5})' if len(lista) > 5 else ''
            return None, (f'"{alvo}" casa {len(lista)} caminhos diferentes — passe o '
                          'caminho inteiro de um deles:\n'
                          + '\n'.join(f'- {b}' for b in lista[:5]) + resto)
        base = bases.pop()
        if not mais:
            if por_pasta and base in nomes:
                return base, [base]
            return base, sorted([n for n in nomes if n == base or n.startswith(base + '/')],
                                key=ordem)
        pai = base.rsplit('/', 1)[0] if '/' in base else ''
        da_pasta = sorted([n for n in nomes if not pai or n.startswith(pai + '/')], key=ordem)
        return pai or '.', da_pasta[da_pasta.index(base):]

    # ── A leitura ─────────────────────────────────────────────────────────────
    def _sub_unidades(self, rel, caminho, escolhidas, secoes, teto_pagina):
        """As seções pedidas de UM item, prontas: [((secao, pagina), texto)].

        Seção maior que a página vira páginas de linhas inteiras; pedir a
        seção traz da página pedida até a última. A primeira unidade leva o
        cabeçalho do item.
        """
        with open(caminho, 'r', encoding='utf-8', errors='replace') as f:
            partes = partes_artefato.dividir_por_cabecalho(f.read())
        corpo_de = {partes_artefato.normalizar(n): c for n, c in partes}
        unidades = []
        for secao, pagina in escolhidas:
            titulo = secoes[secao]
            corpo = corpo_de.get(partes_artefato.normalizar(titulo))
            if corpo is None:
                unidades.append(((secao, pagina),
                                 f'## {titulo}\n(esta seção não existe neste arquivo)'))
                continue
            paginas = self._sub_paginas(corpo, teto_pagina)
            if len(paginas) == 1:
                unidades.append(((secao, pagina), f'## {titulo}\n{corpo}'))
            elif pagina > len(paginas):
                unidades.append(((secao, pagina),
                                 f'## {titulo}\n(esta seção tem {len(paginas)} '
                                 f'páginas — a página {pagina} não existe)'))
            else:
                for p in range(pagina, len(paginas) + 1):
                    if (secao, p) not in [u[0] for u in unidades]:
                        unidades.append(((secao, p), f'## {titulo} (página {p} de '
                                                     f'{len(paginas)})\n{paginas[p - 1]}'))
        if unidades:
            chave, texto = unidades[0]
            unidades[0] = (chave, f'=== {rel} ===\n{texto}')
        return unidades

    def _sub_ler_por_secao(self, artefato, entradas, ler, secoes, exemplo,
                           por_pasta=False, quem=LEITOR_LM_STUDIO):
        nomes = sorted(entradas)
        if por_pasta:
            extra = (f'\n\nPastas com resumo ({len(nomes)}):\n'
                     + '\n'.join(f'- {n}' for n in nomes))
        else:
            extra = ('\n\nOs caminhos dos arquivos estão no índice de navegação; '
                     'uma pasta vale por todos os arquivos dela.')
        pedido = self._sub_pedido(artefato, ler, secoes, exemplo, extra)
        teto = self._sub_teto_parte(quem)
        # O conteúdo deixa ~500 tokens para os avisos e o rodapé do que não
        # coube; a página de uma seção grande, ~600 (o cabeçalho do item também).
        teto_conteudo = max(200, teto - 500)
        teto_pagina = max(500, teto - 600)

        # Os itens, na ordem do pedido. Um item pedido duas vezes (por ele e
        # pela pasta dele) sai uma vez só, com as seções dos dois pedidos.
        avisos, itens, vistos = [], [], {}
        for alvo, escolhidas in pedido:
            base, achados = self._sub_resolver_alvo(alvo, nomes, por_pasta)
            if base is None:
                avisos.append(achados)
                continue
            for rel in achados:
                if rel in vistos:
                    vistos[rel].extend(s for s in escolhidas if s not in vistos[rel])
                    continue
                vistos[rel] = list(escolhidas)
                itens.append((rel, vistos[rel]))

        # Enche até o teto, unidade por unidade, na ordem. A primeira unidade
        # sempre entra (a página garante que ela cabe).
        blocos, usados, restante = [], 0, []
        for pos, (rel, escolhidas) in enumerate(itens):
            unidades = self._sub_unidades(rel, entradas[rel], escolhidas, secoes,
                                          teto_pagina)
            for n, (chave, texto) in enumerate(unidades):
                tk = contar_tokens(texto)
                if blocos and usados + tk > teto_conteudo:
                    restante.append((rel, [c for c, _t in unidades[n:]], n == 0))
                    restante += [(r, e, True) for r, e in itens[pos + 1:]]
                    break
                blocos.append(texto)
                usados += tk
            if restante:
                break

        resposta = []
        if avisos:
            resposta.append('\n'.join(f'⚠️ {a}' for a in avisos))
        if blocos:
            resposta.append('\n\n'.join(blocos))
        elif not avisos:
            resposta.append(f'{artefato}: não há nada para ler.')
        if restante:
            resto = self._sub_compactar_resto(restante, nomes, por_pasta)
            resposta.append(
                f'(não coube no teto de {teto} tokens — ficaram {len(restante)} '
                f'{"pasta(s)" if por_pasta else "arquivo(s)"} por ler. Para o resto, '
                f'chame de novo com este "ler", copiado como está:\n'
                f'{json.dumps(resto, ensure_ascii=False)})')
        return '\n\n'.join(resposta)

    @staticmethod
    def _sub_paginas(corpo, teto):
        """Uma seção em páginas de linhas inteiras, cada uma dentro do teto."""
        if contar_tokens(corpo) <= teto:
            return [corpo]
        paginas, atual, tk_atual = [], [], 0
        for linha in corpo.split('\n'):
            tk = contar_tokens(linha) + 1
            if tk > teto:
                linha, tk = cortar_em_tokens(linha, teto - 1), teto
            if atual and tk_atual + tk > teto:
                paginas.append('\n'.join(atual))
                atual, tk_atual = [], 0
            atual.append(linha)
            tk_atual += tk
        if atual:
            paginas.append('\n'.join(atual))
        return paginas

    @classmethod
    def _sub_compactar_resto(cls, restante, nomes, por_pasta):
        """O `ler` do que ficou de fora, o mais curto que diga exatamente isso.

        `restante` é [(item, [(secao, pagina)], inteiro)], na ordem. O item que
        ficou pela metade vai sozinho, com as seções que faltam. Cada item que
        ficou inteiro de fora vira a pasta mais alta cujos itens — TODOS os do
        projeto, e não só os pedidos — ficaram de fora com as mesmas seções; se
        nem a pasta dele serve, vira `item+` (ele e o que vem depois dele na
        pasta dele), e só em último caso ele mesmo. Assim 900 arquivos de `.`
        voltam como meia dúzia de chaves, e não 900.
        """
        def texto(escolhidas):
            # `simbolos:2` já traz a 3 e as seguintes: elas não se repetem.
            return ','.join(s if p == 1 else f'{s}:{p}' for s, p in escolhidas
                            if p == 1 or (s, p - 1) not in escolhidas)

        em_ordem = sorted(nomes, key=lambda n: cls._sub_ordem(n, por_pasta))
        posicao = {n: i for i, n in enumerate(em_ordem)}
        debaixo = {}

        def sob(pasta):
            if pasta not in debaixo:
                debaixo[pasta] = [n for n in em_ordem
                                  if not pasta or n == pasta or n.startswith(pasta + '/')]
            return debaixo[pasta]

        fora = {rel: texto(e) for rel, e, inteiro in restante if inteiro}
        resto, cobertos = {}, set()
        for rel, escolhidas, inteiro in restante:
            if rel in cobertos:
                continue
            chave, cobre = rel, [rel]
            if inteiro:
                meu = fora[rel]
                partes = rel.split('/')
                # No resumo a pasta com resumo próprio vale só por ele: "a pasta
                # inteira" não se diz com o nome dela — fica o `+`.
                for i in (range(len(partes) - 1, 0, -1) if not por_pasta else ()):
                    pasta = '/'.join(partes[:i])
                    if all(fora.get(n) == meu for n in sob(pasta)):
                        chave, cobre = pasta, sob(pasta)
                    else:
                        break
                if chave == rel:
                    pai = rel.rsplit('/', 1)[0] if '/' in rel else ''
                    seguintes = [n for n in sob(pai) if posicao[n] >= posicao[rel]]
                    if len(seguintes) > 1 and all(fora.get(n) == meu for n in seguintes):
                        chave, cobre = rel + '+', seguintes
            cobertos.update(cobre)
            resto[chave] = texto(escolhidas)
        return resto
