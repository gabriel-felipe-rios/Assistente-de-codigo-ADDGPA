"""O ÚNICO caminho de cópia da biblioteca para dentro do projeto do usuário.

Este arquivo existe para que continue havendo **um** caminho. Já houve dois: o
botão "ligar" da aba Arquivos passava por aqui, e o Preparar tinha o seu
`_preparar_copiar_flat`, que copiava os `.md` achatados e ignorava `formato` e
`arquivo_de_entrada`. O sintoma era mudo — as skills chegavam soltas em
`.claude/skills/` em vez de uma pasta por item com `SKILL.md` dentro, e o
assistente simplesmente não as via. Dois caminhos para a mesma pergunta divergem
sempre, e aquele divergiu no dia em que o formato virou campo do preset.

Separado de `arquivos_ativacao.py` porque as perguntas são diferentes: lá é
*quando* se copia e o que mais acontece junto (o registro no `Workspace.json`, o
MCP, a pasta de Decisões); aqui é *como* se copia — a normalização do nome, o
frontmatter, a colisão de destino e o passeio pela árvore do item.

⛔ NADA AQUI TOCA A PASTA `Arquivos/`. A biblioteca é do usuário e fica com
acento, espaço e maiúscula, do jeito que ele lê melhor. Toda a normalização
acontece no DESTINO, na hora de copiar — e o motivo de não normalizar na origem
é que o nome exigido MUDA por assistente: `SKILL.md` é o do Claude Code, e o dia
em que outro exigir outro nome, uma biblioteca já renomeada estaria presa ao
primeiro.
"""

from .constantes import *


class ArquivosCopiaMixin:

    # ── Normalização na cópia ─────────────────────────────────────────────
    #
    # ⛔ Nada aqui toca a pasta `Arquivos/`. A biblioteca é do usuário e fica com
    # acento, espaço e maiúscula, do jeito que ele lê melhor — `Arquitetura
    # modular - Desktop` continua com esse nome no disco. Toda a normalização
    # acontece no DESTINO, na hora de copiar.
    #
    # O motivo de não normalizar na origem é que o nome exigido MUDA por
    # assistente: `SKILL.md` é o do Claude Code, e o dia em que outro exigir
    # outro nome, uma biblioteca já renomeada estaria presa ao primeiro.

    _SLUG_ACENTOS = {
        'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'ä': 'a',
        'é': 'e', 'ê': 'e', 'è': 'e', 'ë': 'e',
        'í': 'i', 'î': 'i', 'ì': 'i', 'ï': 'i',
        'ó': 'o', 'ô': 'o', 'õ': 'o', 'ò': 'o', 'ö': 'o',
        'ú': 'u', 'û': 'u', 'ù': 'u', 'ü': 'u',
        'ç': 'c', 'ñ': 'n',
    }

    @classmethod
    def _slug_universal(cls, texto):
        """`Arquitetura modular - Desktop` → `arquitetura-modular-desktop`.

        O alvo é o padrão que todos os assistentes aceitam:
        `^[a-z0-9]+(-[a-z0-9]+)*$` — minúsculas, dígitos e hífen simples.
        """
        bruto = (texto or '').strip().lower()
        saida = []
        for ch in bruto:
            ch = cls._SLUG_ACENTOS.get(ch, ch)
            if ch.isalnum() and ch.isascii():
                saida.append(ch)
            else:
                saida.append('-')
        slug = ''.join(saida)
        while '--' in slug:
            slug = slug.replace('--', '-')
        return slug.strip('-')

    @staticmethod
    def _frontmatter_partes(texto):
        """(dict do frontmatter, corpo). Frontmatter ausente devolve ({}, texto).

        Leitura deliberadamente rasa: só `chave: valor` de primeiro nível, que é
        tudo que o padrão portátil usa (`name` e `description`). Um parser de
        YAML completo aqui traria dependência nova para ler duas linhas.
        """
        if not texto.startswith('---'):
            return {}, texto
        linhas = texto.split('\n')
        fim = None
        for i, linha in enumerate(linhas[1:], start=1):
            if linha.strip() == '---':
                fim = i
                break
        if fim is None:
            return {}, texto
        campos = {}
        chave_em_bloco = None
        for linha in linhas[1:fim]:
            # Valor em bloco (`description: >` ou `|`): as linhas indentadas de
            # baixo SÃO o valor. Sem isto a descrição saía como `>` e o SKILL.md
            # copiado ficava sem descrição nenhuma.
            if chave_em_bloco and (linha.startswith((' ', '\t')) or not linha.strip()):
                if linha.strip():
                    campos[chave_em_bloco] = (campos[chave_em_bloco] + ' ' + linha.strip()).strip()
                continue
            chave_em_bloco = None
            if ':' in linha and not linha.startswith((' ', '\t', '-')):
                chave, valor = linha.split(':', 1)
                chave, valor = chave.strip(), valor.strip()
                if valor in ('>', '|', '>-', '|-', '>+', '|+'):
                    chave_em_bloco, valor = chave, ''
                elif chave in ('name', 'description'):
                    valor = ArquivosCopiaMixin._sem_aspas(valor)
                campos[chave] = valor
        return campos, '\n'.join(linhas[fim + 1:]).lstrip('\n')

    @staticmethod
    def _sem_aspas(valor):
        """`"texto"` ou `'texto'` → texto puro; o resto volta como veio."""
        if len(valor) >= 2 and valor[0] == valor[-1] == '"':
            return valor[1:-1].replace('\\"', '"').replace('\\\\', '\\')
        if len(valor) >= 2 and valor[0] == valor[-1] == "'":
            return valor[1:-1].replace("''", "'")
        return valor

    @staticmethod
    def _valor_seguro(valor):
        """O valor como o cabeçalho aceita: entre aspas só quando precisa.

        Precisa quando o texto tem `: ` ou ` #` no meio, ou começa com um
        caractere que o cabeçalho lê como sintaxe. Sem aspas nesses casos o
        cabeçalho inteiro deixa de ser lido, e a skill some sem nome nem
        descrição — seja qual for o jeito que o usuário escreveu o original.
        """
        precisa = (': ' in valor or ' #' in valor or valor.endswith(':')
                   or valor[:1] in '-?:,[]{}#&*!|>\'"%@`')
        if not valor or not precisa:
            return valor
        return '"%s"' % valor.replace('\\', '\\\\').replace('"', '\\"')

    @classmethod
    def _frontmatter_normalizado(cls, texto, nome, descricao):
        """O texto com `name` batendo com a pasta gerada e `description` presente.

        `name` é sobrescrito sempre: ele TEM que ser igual ao nome da pasta, e a
        pasta acabou de ser gerada por `_slug_universal`. `description` só é
        acrescentada quando falta — a que o autor escreveu vale mais que a do
        `_meta.json`, e é ela que faz o assistente acionar a skill sozinho.
        """
        campos, corpo = cls._frontmatter_partes(texto)
        campos['name'] = nome
        if not campos.get('description'):
            campos['description'] = (descricao or nome).replace('\n', ' ').strip()
        ordenados = ['name', 'description'] + [k for k in campos if k not in ('name', 'description')]
        cabecalho = '\n'.join(
            '%s: %s' % (k, cls._valor_seguro(campos[k]) if k in ('name', 'description') else campos[k])
            for k in ordenados)
        return '---\n%s\n---\n\n%s' % (cabecalho, corpo)

    # Rótulo de cada regra, para a mensagem de erro dizer o que está configurado.
    _ROTULO_DA_REGRA_DO_PRINCIPAL = {
        PRINCIPAL_SKILL_NOME_DA_PASTA: 'o .md com o mesmo nome da pasta',
        PRINCIPAL_SKILL_NOME_FIXO: 'um arquivo com nome fixo',
        PRINCIPAL_SKILL_DESCRIPTION: 'o que tem description: no cabeçalho',
    }

    def _regra_do_principal(self):
        """(regra, nome fixo, empate) de Configurações › Arquivos, com a queda de fábrica."""
        s = self.load_settings()['settings']
        regra = s.get('biblioteca_principal_skill') or PADROES_DA_BIBLIOTECA['biblioteca_principal_skill']
        if regra not in self._ROTULO_DA_REGRA_DO_PRINCIPAL:
            regra = PADROES_DA_BIBLIOTECA['biblioteca_principal_skill']
        nome_fixo = (s.get('biblioteca_nome_fixo') or PADROES_DA_BIBLIOTECA['biblioteca_nome_fixo']).strip()
        empate = s.get('biblioteca_empate') or PADROES_DA_BIBLIOTECA['biblioteca_empate']
        return regra, nome_fixo, empate

    def _arquivo_principal_do_item(self, src):
        """Qual `.md` do item é o ponto de entrada — ou None se a regra não resolver.

        A regra vem de Configurações › Arquivos (`biblioteca_principal_skill`),
        e não mais de uma ordem fixa no código: o `.md` com o mesmo nome da
        pasta (comparado por slug — acento, caixa e hífen no lugar de espaço não
        contam), um arquivo com nome fixo (`biblioteca_nome_fixo`), ou o que tem
        `description:` no cabeçalho. Quando a regra devolve zero ou mais de um,
        `biblioteca_empate` decide: recusar (None — quem chamou AVISA) ou o
        primeiro em ordem alfabética.

        Dois casos não dependem de regra: um item-arquivo (Instruções base) é o
        próprio ponto de entrada, e uma pasta com um `.md` só é ele.
        """
        if os.path.isfile(src):
            return os.path.basename(src)
        try:
            mds = sorted([f for f in os.listdir(src)
                          if f.lower().endswith('.md') and os.path.isfile(os.path.join(src, f))],
                         key=str.lower)
        except Exception:
            return None
        if not mds:
            return None
        if len(mds) == 1:
            return mds[0]

        regra, nome_fixo, empate = self._regra_do_principal()
        if regra == PRINCIPAL_SKILL_NOME_FIXO:
            alvo = nome_fixo.lower()
            candidatos = [f for f in mds if f.lower() == alvo]
        elif regra == PRINCIPAL_SKILL_DESCRIPTION:
            candidatos = []
            for f in mds:
                campos, _ = self._frontmatter_partes(self._ler_texto(os.path.join(src, f)))
                if campos.get('description'):
                    candidatos.append(f)
        else:
            alvo = self._slug_universal(os.path.basename(src))
            candidatos = [f for f in mds if self._slug_universal(f[:-3]) == alvo]

        if len(candidatos) == 1:
            return candidatos[0]
        if empate == EMPATE_SKILL_PRIMEIRO:
            return (candidatos or mds)[0]
        return None

    # As categorias que o preset da aba Arquivos governa — as que o botão de
    # ligar COPIA para dentro do projeto. As outras têm caminho próprio:
    # `regras-instrucoes` vai para a pasta que a aba Decisões edita, `mcps` é
    # registro em .mcp.json e `codigos` tem botão de copiar dele mesmo.
    # ⚠️ `mcps` está em `CATEGORIAS_DO_ASSISTENTE` mas FORA daqui: o preset
    # diz onde fica o arquivo de configuração dela, e não é `_copiar_item_com_preset`
    # que a escreve — é `_mcp_registrar`, que MESCLA um JSON em vez de copiar pasta.
    _ARQUIVOS_COM_PRESET = tuple(k for k, _, so_destino, _ in CATEGORIAS_DO_ASSISTENTE
                                 if not so_destino)

    def _colisao_de_slug(self, folder, item_name, slug):
        """Outro item da MESMA categoria que geraria este mesmo nome de destino.

        Existe porque o agrupamento não sobrevive à cópia: `Front design/Mobile`
        e `Backend/Mobile` são dois itens distintos na biblioteca e viram os dois
        `mobile` no destino. Sem esta checagem, o segundo a ser ligado
        sobrescreveria o primeiro sem uma palavra.
        """
        base = os.path.join(ARQUIVOS_DIR, folder)
        # ⚠️ A MESMA VARREDURA DE `list_arquivos`, com as mesmas extensoes: uma
        # varredura mais estreita aqui deixaria de ver um item-arquivo e
        # aprovaria uma copia que sobrescreve outro item em silencio — que e
        # exatamente o acidente que esta funcao existe para impedir.
        kind = next((k for k, f in self._ARQUIVOS_FOLDER.items() if f == folder), None)
        for rel, _ in self._arquivos_percorrer(
                base, extensoes=self._ARQUIVOS_ITEM_DE_ARQUIVO.get(kind)):
            if rel == item_name:
                continue
            if self._slug_universal(rel.rsplit('/', 1)[-1]) == slug:
                return rel
        return None

    def _copiar_item_com_preset(self, kind, src, item_name, root_folder, preset,
                                sobrescrever=True):
        """Copia um item para o projeto, no destino e no formato do preset.

        ⛔ NUNCA move, e NUNCA toca a origem: o que está em `Arquivos/` é a
        biblioteca do usuário. Toda normalização de nome acontece aqui, no lado
        do destino.

        ⛔ O agrupamento da biblioteca NÃO vai junto. Um item em
        `Skills/Arquitetura modular/Arquitetura modular - Desktop/` sai em
        `<destino>/arquitetura-modular-desktop/`, sem a pasta do grupo no meio:
        nenhum assistente descobre skill em `skills/<categoria>/<skill>/`, e
        `.claude/commands/` não descobre NADA dentro de subpasta.

        ⚠️ `sobrescrever=False` é o modo do PREPARAR (D3): arquivo que já existe
        no destino fica exatamente como está, e é contado em `pulados`. O botão
        "ligar" da aba Arquivos usa o padrão, `True`, porque ali o usuário
        mandou reativar aquele item — são gestos diferentes.

        ⚠️ ESTE É O ÚNICO CAMINHO DE CÓPIA. Havia um segundo, `_preparar_copiar_flat`,
        que o Preparar usava: ele copiava os `.md` achatados e IGNORAVA `formato`
        e `arquivo_de_entrada`. O sintoma era mudo — as skills chegavam como
        `.md` solto em `.claude/skills/` em vez de uma pasta por item com
        `SKILL.md` dentro, e o Claude Code simplesmente não as via. Dois
        caminhos de cópia para a mesma pergunta divergem sempre; agora é um.
        """
        cat = self._categoria_do_assistente(preset, kind)
        destino = cat['destino']
        if not destino and not self._raiz_quando_vazio(kind):
            # Campo vazio é "esta categoria não existe neste assistente" — o
            # mesmo mecanismo que faz o preset do Cursor não ter skills. Não é
            # erro: o item fica marcado como ativo e nada é copiado.
            return {'success': True, 'message': f'"{item_name}" ativado — o preset '
                                                f'"{preset.get("nome")}" não copia esta categoria.'}

        dest_base = os.path.abspath(os.path.join(root_folder, destino.replace('/', os.sep)))
        raiz = os.path.abspath(root_folder)
        if dest_base != raiz and not dest_base.startswith(raiz + os.sep):
            return {'success': False, 'error':
                    'O destino deste assistente sai da pasta raiz do projeto.'}

        rotulo = item_name.rsplit('/', 1)[-1]
        slug = self._slug_universal(rotulo)
        if not slug:
            return {'success': False, 'error': f'"{rotulo}" não tem nenhuma letra ou número no nome.'}

        # Colisão: outro item da biblioteca geraria este mesmo destino. Avisa e
        # NÃO copia — sobrescrever em silêncio faria o usuário perder trabalho
        # sem nunca saber que perdeu.
        outro = self._colisao_de_slug(self._ARQUIVOS_FOLDER[kind], item_name, slug)
        if outro:
            return {'success': False, 'error':
                    f'"{item_name}" e "{outro}" viram os dois "{slug}" no destino — o '
                    f'agrupamento não vai junto na cópia. Renomeie um dos dois na '
                    f'biblioteca antes de ligar.'}

        entrada = cat['arquivo_de_entrada']
        principal = None
        if entrada:
            principal = self._arquivo_principal_do_item(src)
            if principal is None:
                regra, _nome_fixo, _empate = self._regra_do_principal()
                return {'success': False, 'error':
                        f'"{rotulo}" tem mais de um .md e nenhum (ou mais de um) bate com a regra '
                        f'"{self._ROTULO_DA_REGRA_DO_PRINCIPAL[regra]}" — ajuste a pasta, ou troque a '
                        f'regra em Configurações › Arquivos.'}

        descricao = self._descricao_para_o_destino(src, principal, rotulo)

        pulados = 0
        try:
            if cat['formato'] == 'pasta' and not os.path.isfile(src):
                alvo = os.path.join(dest_base, slug)
                os.makedirs(alvo, exist_ok=True)
                copiados, pulados = self._copiar_arvore_do_item(
                    src, alvo, principal, entrada, slug, descricao, sobrescrever)
                onde = f'{destino.rstrip("/")}/{slug}/'
            elif cat['formato'] == 'pasta':
                # Item-arquivo num assistente que pede pasta: a pasta é criada
                # com o arquivo dentro. Não é caso de erro — é o assistente
                # dizendo "aqui cada item mora na própria pasta", e um `.md`
                # solto cabe nisso.
                alvo = os.path.join(dest_base, slug)
                os.makedirs(alvo, exist_ok=True)
                # ⚠️ O nome de entrada vale aqui também: um item-arquivo numa
                # categoria com `arquivo_de_entrada` chega com o nome que o
                # assistente procura, e não com o nome que ele tinha.
                nome_alvo = entrada or os.path.basename(src)
                destino_arq = os.path.join(alvo, nome_alvo)
                if not sobrescrever and os.path.exists(destino_arq):
                    copiados, pulados = 0, 1
                else:
                    shutil.copy2(src, destino_arq)
                    copiados = 1
                onde = f'{destino.rstrip("/")}/{slug}/'
            else:
                os.makedirs(dest_base, exist_ok=True)
                copiados = 0
                for fname, fpath in self._arquivos_arquivos_do_item(src):
                    # ⚠️ SOLTO TAMBÉM RENOMEIA, quando a categoria tem arquivo de
                    # entrada: é o caso de `instrucoes-base`, em que o item da
                    # biblioteca chega na raiz como CLAUDE.md ou AGENTS.md.
                    nome_alvo = entrada if (entrada and fname == principal) else fname
                    destino_arq = os.path.join(dest_base, nome_alvo)
                    if not sobrescrever and os.path.exists(destino_arq):
                        pulados += 1
                        continue
                    shutil.copy2(fpath, destino_arq)
                    copiados += 1
                onde = destino if destino and destino not in ('.', './') else 'raiz do projeto'
        except Exception as e:
            return {'success': False, 'error': str(e)}

        return {'success': True, 'copiados': copiados, 'pulados': pulados,
                'message': f'"{rotulo}" copiado — {copiados} arquivo(s) em {onde}'}

    def _descricao_para_o_destino(self, src, principal, rotulo):
        """O `description` do cabeçalho, quando o autor não escreveu um.

        A ordem é do mais específico para o mais genérico, e a última queda é o
        NOME DE EXIBIÇÃO do item, não o slug: `description` é o que faz o
        assistente decidir sozinho se usa aquela skill, e um slug repetindo o
        nome do arquivo não ajuda ninguém a decidir nada.
        """
        try:
            f = self._arquivos_desc_file(os.listdir(src))
            if f:
                desc = self._descricao_de(self._ler_texto(os.path.join(src, f)))
                if desc:
                    return desc
        except Exception:
            pass
        if principal:
            caminho = src if os.path.isfile(src) else os.path.join(src, principal)
            for linha in self._ler_texto(caminho).splitlines():
                bruto = linha.strip()
                if not bruto or bruto.startswith(('#', '---', '>', '|')):
                    continue
                return bruto[:300]
        return rotulo

    def _copiar_arvore_do_item(self, src, alvo, principal, entrada, slug, descricao,
                               sobrescrever=True):
        """Copia a pasta do item inteira, renomeando só o arquivo de entrada.

        Os outros arquivos e as subpastas (`references/`, `scripts/`, `assets/`)
        vão junto com o nome original: são material de apoio da mesma skill, não
        skills soltas — subpasta DENTRO de um item nunca cria item novo.

        Devolve `(copiados, pulados)`. Com `sobrescrever=False` (o modo do
        Preparar, D3), arquivo que já existe no destino fica como está.
        """
        copiados = pulados = 0
        for raiz, dirs, fnames in os.walk(src):
            dirs.sort()
            rel = os.path.relpath(raiz, src)
            destino_dir = alvo if rel == '.' else os.path.join(alvo, rel)
            os.makedirs(destino_dir, exist_ok=True)
            for fname in sorted(fnames, key=str.lower):
                origem = os.path.join(raiz, fname)
                e_principal = rel == '.' and principal and fname == principal
                nome_alvo = entrada if (e_principal and entrada) else fname
                destino_arq = os.path.join(destino_dir, nome_alvo)
                if not sobrescrever and os.path.exists(destino_arq):
                    pulados += 1
                    continue
                if e_principal and entrada:
                    texto = self._frontmatter_normalizado(
                        self._ler_texto(origem), slug, descricao)
                    with open(destino_arq, 'w', encoding='utf-8') as fh:
                        fh.write(texto)
                else:
                    shutil.copy2(origem, destino_arq)
                copiados += 1
        return copiados, pulados
