"""O INÍCIO RÁPIDO: quais itens da biblioteca vão, e que pastas nascem.

⚠️ ELE NÃO DIZ PARA ONDE AS COISAS VÃO. Isso é do assistente externo
(`arquivos_assistentes.py`), e o início rápido só aponta para um. Até
2026-09-02 dizia — e as duas respostas divergiam, com um assistente inteiro se
perdendo no casamento por string entre as duas listas. Este arquivo e aquele são
os dois eixos que sobraram da separação, e é por isso que são dois arquivos:
*quais* itens é pergunta POR PROJETO, *para onde* é pergunta POR ASSISTENTE.

Aqui moram o preset (ler, normalizar, validar, gravar) e a **biblioteca que a
tela dele mostra** — a lista de itens por categoria, com rótulo, grupo e a marca
`Do programa`. Quem EXECUTA o preset é `arquivos_preparar.py`; este arquivo só
responde o que ele diz.

⚠️ `_itens_do_programa` SOBROU COMO SEMENTE DA MIGRAÇÃO, e só isso. Não voltar a
usá-la para decidir o que o Preparar copia: quem decide é a lista `itens` do
preset. A marca `Do programa` continua valendo apenas para a cópia manual da aba
Arquivos, que é outro caminho.

⚠️ `_erro_de_caminho` mora aqui e é usada TAMBÉM por `validar_assistente`, do
outro arquivo. Não é acaso: a regra de caminho é a mesma dos dois lados
(relativo à raiz, sem `..`, sem caractere proibido), e duplicá-la é garantir que
as duas divirjam na primeira correção.
"""

from .constantes import *


class ArquivosInicioRapidoMixin:

    # ── Preparar projeto: o preset ────────────────────────────────────────────
    # Caracteres que o Windows recusa DENTRO de um segmento de caminho. `/` e
    # `\` ficam de fora de propósito: aqui eles são separador, não conteúdo.
    # O gêmeo da tela está em `config-preparar.js`, que barra a digitação — mas
    # quem garante é este lado: a tela é conveniência, não segurança.
    _PRESET_CHARS_PROIBIDOS = ':*?"<>|'

    def _inicios_rapidos(self):
        inicios = self.load_settings()['settings'].get('inicios_rapidos')
        if not isinstance(inicios, list):
            inicios = INICIOS_RAPIDOS
        return [self._inicio_rapido_normalizar(p) for p in inicios
                if isinstance(p, dict) and (p.get('nome') or '').strip()]

    def _inicio_rapido_normalizar(self, preset):
        """Devolve o preset com `itens` — a lista, por categoria, do que ele copia.

        ⚠️ MIGRAÇÃO. Até 2026-08-25 o preset tinha `copia`, quatro booleanos, e
        *quais* itens vinham da marca `Do programa` da biblioteca — igual para
        todos os presets. Agora quem escolhe item por item é o preset, e a marca
        deixou de filtrar (ela continua valendo para a cópia manual da aba
        Arquivos, que é outro caminho).

        Preset sem `itens` é preset velho (ou de fábrica): ele é preenchido com
        tudo que está marcado `Do programa`, que é EXATAMENTE o que ele copiava
        antes. Assim ninguém acorda com um preset que virou vazio.

        `itens` presente — mesmo com todas as listas vazias — é escolha explícita
        do usuário e não se mexe. É o que faz preset novo nascer todo desmarcado
        sem precisar de outro sinalizador.

        Devolve uma CÓPIA rasa: esta lista também sai por
        `load_inicio_rapido_config` para a tela, e `INICIOS_RAPIDOS` é constante
        de módulo — normalizar por cima do original contaminaria o padrão de
        fábrica do processo inteiro.

        ⚠️ A semente sai de `_ARQUIVOS_COM_ORIGEM`, que são QUATRO, e não das
        seis de `CATEGORIAS_DO_INICIO_RAPIDO`: só essas quatro têm a marca
        `Do programa`. `instrucoes-base` e `agentes` entraram na seleção sem a
        marca (D11), então nascem desmarcadas — que é o certo, porque não há
        de onde deduzir qual delas o usuário quer.
        """
        if isinstance(preset.get('itens'), dict):
            return preset
        copia = preset.get('copia') or {}
        preset = dict(preset)
        preset['itens'] = {
            kind: (self._itens_do_programa(kind)
                   if (kind in self._ARQUIVOS_COM_ORIGEM and copia.get(kind, True))
                   else [])
            for kind, _, _ in CATEGORIAS_DO_INICIO_RAPIDO
        }
        preset.pop('copia', None)
        return preset

    def _inicio_rapido(self, nome=None):
        """O início rápido pedido; senão o padrão; senão o primeiro.

        ⚠️ LOOKUP TOLERANTE: um projeto pode ter gravado um nome que não existe
        mais (há um assim no disco, `"Claude Code - Desktop"`) ou não ter chave
        nenhuma. Nenhum dos dois pode levantar — cair no padrão é o certo.
        """
        presets = self._inicios_rapidos()
        if not presets:
            return None
        if nome:
            for p in presets:
                if p.get('nome') == nome:
                    return p
        padrao = self.load_settings()['settings'].get('inicio_rapido_padrao')
        for p in presets:
            if p.get('nome') == padrao:
                return p
        return presets[0]

    @classmethod
    def _erro_de_caminho(cls, valor, rotulo):
        """A mensagem de erro do caminho, ou None se ele serve (D36).

        Campo VAZIO devolve None: vazio é pulado, não é erro — é o que faz o
        preset do Cursor não ter skills sem código próprio para esse caso.
        """
        bruto = (valor or '').strip().replace('\\', '/')
        if not bruto:
            return None
        if bruto.startswith('/') or (len(bruto) > 1 and bruto[1] == ':'):
            return '%s: caminho absoluto não é aceito — escreva a partir da pasta raiz.' % rotulo
        for seg in bruto.split('/'):
            if seg in ('', '.'):
                continue
            if seg == '..':
                return '%s: ".." sairia da pasta raiz do projeto.' % rotulo
            for c in seg:
                if c in cls._PRESET_CHARS_PROIBIDOS:
                    return '%s: o caractere %s não é aceito em nome de pasta.' % (rotulo, c)
        return None

    # ⚠️ Sobrou UM campo. `arquivo_regras`, `destino_skills`, `destino_comandos`
    # e `destino_mcp` eram campos do início rápido e viraram campos do
    # ASSISTENTE EXTERNO — o início rápido responde QUAIS itens vão, nunca para
    # onde. Quem valida os destinos agora é `validar_assistente`.
    _INICIO_RAPIDO_CAMPOS_DE_CAMINHO = (
        ('pasta_trabalho',   'Pasta de trabalho'),
    )

    def validar_inicio_rapido(self, preset):
        """Todos os erros do preset. Lista vazia = pode ser usado.

        Enquanto houver um erro o preset não aparece como opção na sub-aba
        Preparar — em vez de falhar no meio da execução, com metade das pastas
        já criadas.
        """
        erros = []
        if not isinstance(preset, dict):
            return ['Preset inválido.']
        for chave, rotulo in self._INICIO_RAPIDO_CAMPOS_DE_CAMINHO:
            erro = self._erro_de_caminho(preset.get(chave), rotulo)
            if erro:
                erros.append(erro)
        for chave, rotulo in (('pastas_raiz', 'Pastas na pasta raiz'),
                              ('pastas_trabalho', 'Pastas na pasta de trabalho')):
            for item in (preset.get(chave) or []):
                if not isinstance(item, dict):
                    continue
                caminho = (item.get('caminho') or '').strip()
                if not caminho:
                    erros.append('%s: há uma linha sem caminho.' % rotulo)
                    continue
                erro = self._erro_de_caminho(caminho, '%s > %s' % (rotulo, caminho))
                if erro:
                    erros.append(erro)
                if item.get('contexto') and not (item.get('descricao') or '').strip():
                    erros.append('%s > %s: "Contexto sem leitura" exige uma descrição.'
                                 % (rotulo, caminho))
        return erros

    def load_inicio_rapido_config(self, project_name=None):
        """Os inícios rápidos, quais servem, e qual vale neste projeto."""
        inicios = self._inicios_rapidos()
        s = self.load_settings()['settings']
        escolhido = None
        if project_name:
            escolhido = (self.load_workspace(project_name).get('config', {})
                         .get('inicio_rapido'))
        nomes = [p.get('nome') for p in inicios]
        if escolhido not in nomes:
            escolhido = s.get('inicio_rapido_padrao')
        if escolhido not in nomes:
            escolhido = nomes[0] if nomes else None
        return {
            'success': True,
            'presets': inicios,
            'padrao': s.get('inicio_rapido_padrao'),
            'escolhido': escolhido,
            'erros': {p.get('nome'): self.validar_inicio_rapido(p) for p in inicios},
            # As seis categorias que o início rápido copia, com o rótulo e a
            # marca de escolha única. Vai para a tela em vez de ser reescrita
            # lá: duas listas de categoria divergem na primeira mudança.
            'categorias': [{'kind': k, 'rotulo': r, 'escolha_unica': u,
                            'tem_origem': k in self._ARQUIVOS_COM_ORIGEM}
                           for k, r, u in CATEGORIAS_DO_INICIO_RAPIDO],
            # A lista de assistentes, para o seletor e para o espelho só-leitura
            # dos destinos. Sem isto a tela precisaria de uma segunda chamada.
            'assistentes': [{'nome': a.get('nome'),
                             'categorias': {k: self._categoria_do_assistente(a, k)
                                            for k, _, _, _ in CATEGORIAS_DO_ASSISTENTE}}
                            for a in self._lista_de_assistentes()],
            # Vai junto para a tela de Configurações não precisar de uma segunda
            # chamada só para pintar as abas de itens. A sub-aba Preparar ignora.
            'biblioteca': self.listar_biblioteca_do_inicio_rapido(),
        }

    def save_inicios_rapidos(self, presets, padrao=None):
        """Grava a lista inteira de presets. Preset inválido PODE ser gravado.

        De propósito: o usuário fica a meio de digitar um caminho o tempo todo,
        e recusar a gravação faria perder o resto do formulário. Quem barra o
        preset quebrado é a hora de USAR, não a de salvar.
        """
        if not isinstance(presets, list):
            return {'success': False, 'error': 'Formato inválido.'}
        limpos = [p for p in presets if isinstance(p, dict) and (p.get('nome') or '').strip()]
        for p in limpos:
            # `itens` sempre gravado com as SEIS chaves e só com nomes: é ele
            # que faz o início rápido ser explícito, e uma chave faltando
            # reativaria a migração de `_inicio_rapido_normalizar` no próximo
            # carregamento — ele voltaria a copiar tudo que é "Do programa".
            bruto = p.get('itens') if isinstance(p.get('itens'), dict) else {}
            itens = {}
            for kind, _rotulo, escolha_unica in CATEGORIAS_DO_INICIO_RAPIDO:
                lista = [n for n in (bruto.get(kind) or [])
                         if isinstance(n, str) and n.strip()]
                # ⚠️ ESCOLHA ÚNICA (instrucoes-base): um projeto tem UM arquivo
                # de instrução base. Dois itens marcados copiariam para o MESMO
                # caminho na raiz — o destino é vazio, que ali quer dizer a raiz
                # —, e `_colisao_de_slug` não pega, porque ele compara slug de
                # ITEM, não nome de ARQUIVO: o segundo sobrescreveria o primeiro
                # sem uma linha de aviso. O corte é aqui, e não só na tela.
                if escolha_unica:
                    lista = lista[:1]
                itens[kind] = lista
            p['itens'] = itens
            p.pop('copia', None)
            # O assistente é do início rápido desde 2026-09-02 (D6). Nome que
            # não existe mais cai no padrão na hora de usar, como o órfão.
            p['assistente'] = (p.get('assistente') or '').strip()
        nomes = [p['nome'].strip() for p in limpos]
        if len(set(nomes)) != len(nomes):
            return {'success': False, 'error': 'Há dois inícios rápidos com o mesmo nome.'}
        patch = {'inicios_rapidos': limpos}
        if padrao is not None:
            patch['inicio_rapido_padrao'] = padrao
        return self.save_settings_parcial(patch)

    def set_inicio_rapido_do_projeto(self, project_name, nome):
        """Grava no Workspace.json qual início rápido este projeto usa (D34)."""
        ws = self.load_workspace(project_name)
        config = ws.get('config', {})
        config['inicio_rapido'] = nome
        return self.save_workspace(project_name, config)

    # ── A biblioteca, como a tela do início rápido a mostra ───────────────
    def _itens_da_biblioteca(self, kind):
        """Todos os itens de uma categoria da biblioteca, na ordem da tela.

        Sem filtro de origem: quem escolhe o que o Preparar copia é o preset, e
        o usuário pode querer levar junto algo marcado `Geral` — um molde que ele
        sabe que vai usar naquele projeto.
        """
        folder = self._ARQUIVOS_FOLDER.get(kind)
        base = os.path.join(ARQUIVOS_DIR, folder) if folder else None
        if not base or not os.path.isdir(base):
            return []
        # Recursiva pelo mesmo motivo que `list_arquivos` é: desde que a
        # biblioteca ganhou grupos, uma pasta de 1º nível pode não ser um item.
        # Sem descer, o Preparar listaria o GRUPO como se fosse item e copiaria
        # zero arquivo dele — grupo não tem arquivo solto dentro, por definição.
        # `extensoes` pelo mesmo motivo que `list_arquivos` passa: sem ele o
        # Preparar nao enxergaria nenhum agente, agora que um agente pode ser um
        # `.md` solto — e a lista do preset ficaria vazia sem dizer por que.
        return [rel for rel, _ in self._arquivos_percorrer(
            base, extensoes=self._ARQUIVOS_ITEM_DE_ARQUIVO.get(kind))]

    def _itens_do_programa(self, kind):
        """Só os marcados `Do programa`.

        ⚠️ Sobrou como SEMENTE DA MIGRAÇÃO (`_inicio_rapido_normalizar`), e só isso.
        Não voltar a usá-la para decidir o que o Preparar copia — quem decide
        agora é a lista `itens` do preset.
        """
        if kind not in self._ARQUIVOS_FOLDER:
            return []
        meta = self._arquivos_meta_load(kind)
        return [name for name in self._itens_da_biblioteca(kind)
                if self._arquivos_meta_de(meta, name).get('origem') == 'programa']

    def _itens_do_inicio_rapido(self, preset, kind):
        """O que ESTE preset copia daquela categoria, na ordem da biblioteca.

        É uma interseção, e não a lista crua do preset: item renomeado ou
        apagado da biblioteca simplesmente não entra. Órfão não derruba o preset
        (isso tiraria o preset inteiro do ar por causa de uma pasta que o próprio
        usuário renomeou) — quem avisa é a tela de Configurações.
        """
        escolhidos = set((preset.get('itens') or {}).get(kind) or [])
        return [name for name in self._itens_da_biblioteca(kind) if name in escolhidos]

    def listar_biblioteca_do_inicio_rapido(self):
        """As SEIS categorias que o início rápido copia, item por item.

        `origem` vai junto só como PISTA visual: ela não filtra mais nada aqui,
        e só existe nas quatro de `_ARQUIVOS_COM_ORIGEM` (D11) — nas outras duas
        vem `None`, e a tela não desenha a fileira Do programa / Gerais.

        `rotulo` e `grupo` vêm junto para a tela desenhar a árvore de grupos sem
        reimplementar a quebra por `/`. ⚠️ `name` continua sendo a IDENTIDADE
        gravada em `itens` — só a exibição usa o rótulo.
        """
        out = {}
        for kind, _rotulo, _unica in CATEGORIAS_DO_INICIO_RAPIDO:
            meta = self._arquivos_meta_load(kind)
            # ⚠️ `_arquivos_meta_de`, NÃO `meta.get(name)` cru: `name` chega como
            # caminho ("Arquitetura modular/Arquitetura modular - MCP") e o
            # arquivo pode guardar a chave curta, de quando os grupos não
            # existiam. Sem a queda, as 8 skills de `Arquitetura modular`
            # apareciam como `geral` AQUI e como `programa` na aba Arquivos, que
            # já usa esta função (`list_arquivos`).
            tem_origem = kind in self._ARQUIVOS_COM_ORIGEM
            out[kind] = [{
                'name': name,
                # A MESMA quebra de `list_arquivos`: o rótulo é a folha, o grupo
                # é o que sobra. Duas quebras divergem na primeira mudança.
                'rotulo': name.rsplit('/', 1)[-1],
                'grupo': name.rsplit('/', 1)[0] if '/' in name else '',
                'origem': (self._arquivos_meta_de(meta, name).get('origem', 'geral')
                           if tem_origem else None),
            } for name in self._itens_da_biblioteca(kind)]
        return out
