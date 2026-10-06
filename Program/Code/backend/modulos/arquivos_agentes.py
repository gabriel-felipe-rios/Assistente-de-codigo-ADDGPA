"""Criar e editar um AGENTE da biblioteca — o `.md` que o assistente externo lê.

Arquivo próprio, e não um pedaço de `arquivos.py`, pela regra que já separou
`estilos_e_cores_crud.py` do irmão: **cada arquivo responde uma pergunta**. Lá a
pergunta é *o que a biblioteca tem e como ela chega ao projeto*; aqui é *como se
escreve um agente*. (E `arquivos.py` já passa de duas mil linhas.)

⚠️ ISTO NÃO USA `create_arquivo_item` NEM `format_arquivo_item`, e a recusa é
por quatro motivos independentes — qualquer um deles bastaria:

  1. Os dois gravam um `Descrição.md` ao lado do conteúdo. Um agente NÃO tem e
     não deve ter: a descrição dele mora no `description:` do frontmatter,
     porque é ESSE campo que o assistente externo lê para decidir sozinho se
     aciona o agente. Dois lugares dizendo a mesma coisa divergem, e quem
     obedece é o frontmatter — não o nosso arquivo.
  2. `_NOME_INVALIDO` deles barra `/`, e o nome de um item daqui é
     `Claude/Orquestrador` — o grupo faz parte da identidade.
  3. Nenhum dos dois sabe o que é frontmatter.
  4. `create_arquivo_item` está QUEBRADO desde antes desta obra: a linha que
     grava a descrição usa `item_name_curto`, um nome que não existe em lugar
     nenhum do projeto. Todo `kind` que não seja `regras-instrucoes` levanta
     `NameError`, e o `except Exception` de lá devolve isso como mensagem de
     erro. Ninguém notou porque o frontend parou de chamá-lo.

⚠️ A PASTA DO ASSISTENTE É ORGANIZAÇÃO, E NÃO DESTINO. `Agentes/Claude/…` não
faz o agente ir para `.claude/agents/`: quem decide o destino é o PRESET do
projeto (ver `_copiar_item_com_preset`, em `arquivos.py`). A subpasta serve para
o usuário separar o que ele escreveu para um assistente do que escreveu para
outro — porque a gramática do arquivo muda entre eles, mesmo quando o destino
não muda. Tratar essa pasta como destino criaria uma segunda verdade sobre para
onde as coisas vão, e a primeira já existe.
"""

import os
import shutil
import tempfile

from .constantes import ARQUIVOS_DIR
from .catalogo_ferramentas_de_agente import ferramentas_para_a_tela
from .extensoes.agentes import agentes_da_oficina_de_extensoes, agente_de_extensao

# A pasta da categoria. Espelha `_ARQUIVOS_FOLDER['agentes']` em `arquivos.py`;
# está repetida aqui porque importar aquele dicionário só por uma string criaria
# dependência de módulo para nada. Se aquele mudar, este quebra alto — o
# `_arquivos_item_path` devolve None e todo método daqui recusa com mensagem.
PASTA_DA_CATEGORIA = 'Agentes'

# ⚠️ A ORDEM É A ORDEM EM QUE AS CHAVES SÃO ESCRITAS no arquivo, e ela importa
# para leitura humana: `name` e `description` são o que se lê primeiro num
# arquivo aberto à mão. Campo que o usuário tenha escrito fora desta lista
# (`color`, por exemplo) é PRESERVADO e vai depois — este editor não é dono do
# arquivo inteiro, só dos quatro campos que ele mostra.
CAMPOS_GOVERNADOS = ('name', 'description', 'tools', 'model')

# O que não pode aparecer num nome de pasta no Windows. Não inclui `/` de
# propósito: aqui o `/` já foi separado antes de chegar (grupo e item vêm em
# campos distintos), então um `/` no campo é erro do chamador, e é barrado.
CARACTERES_PROIBIDOS = set('\\/:*?"<>|')


class ArquivosAgentesMixin:

    # ── Os grupos: as subpastas de `Agentes/` ────────────────────────────────

    def grupos_de_agente(self):
        """As subpastas que existem dentro de `Agentes/`, para organizar a lista.

        ⚠️ SUBPASTA É ORGANIZAÇÃO, E NÃO DESTINO — e este método já se chamou
        `listar_assistentes_de_agente`, o que dizia o contrário. A biblioteca
        chegou a ser separada por assistente externo (`Agentes/Claude/…`), e a
        pasta nunca mandou em nada: quem decide para onde o `.md` vai é o preset
        do projeto. A pasta por assistente só obrigava o usuário a manter uma
        cópia por produto do mesmo agente.
        """
        try:
            base = os.path.join(ARQUIVOS_DIR, PASTA_DA_CATEGORIA)
            os.makedirs(base, exist_ok=True)
            existentes = [nome for nome in sorted(os.listdir(base), key=str.lower)
                          if os.path.isdir(os.path.join(base, nome))]
            return {'success': True, 'existentes': existentes}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    @staticmethod
    def _ag_nome_de_pasta(texto):
        """Um nome de pasta seguro, preservando acento e espaço.

        Não é o `_slug_universal`: o nome do GRUPO é o que o usuário lê na tela,
        e `Codex / Antigravity` virar `codex-antigravity` seria trocar o nome
        dele por um identificador. Aqui só o que o Windows recusa é trocado.
        """
        limpo = ''.join(' ' if c in CARACTERES_PROIBIDOS else c for c in (texto or ''))
        return ' '.join(limpo.split()).strip(' .')

    def ferramentas_de_agente(self, assistente=None):
        """As caixas de seleção do campo `tools`, e se há lista para este assistente.

        Fina de propósito: quem sabe do assunto é
        `catalogo_ferramentas_de_agente.py`, e este método só existe porque a
        ponte do pywebview alcança método de mixin, não função de módulo.

        ⚠️ SEM ASSISTENTE, CAI NO QUE ESTÁ EM USO. O editor perguntava pela
        PASTA em que o agente estava (`Agentes/Claude/…`), e essa pasta deixou
        de existir — a subpasta de hoje é uma gaveta temática, e "Backend" não é
        um produto com lista de ferramentas própria. Perguntando ao assistente
        externo ativo, as caixas voltam a ser as de quem realmente vai ler o
        arquivo; sem nenhum ativo, sobra o campo livre, que é o certo.
        """
        try:
            if not assistente:
                assistente = (self._trab_produto_ativo() or {}).get('nome')
            return dict(ferramentas_para_a_tela(assistente), success=True)
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def agentes_para_o_terminal(self, project_name):
        """A lista que o popover de "＋ Terminal" da Oficina mostra.

        Numa ida só, como `carregar_agentes` já faz para os produtos: o popover
        abre no clique, e duas viagens de ponte aí são duas esperas visíveis.

        `ja_no_projeto` existe para a tela poder dizer o que vai acontecer antes
        de acontecer — escolher um agente que ainda não está ligado COPIA o `.md`
        para dentro do projeto, e isso é uma mudança em disco que o usuário
        merece ver vindo.

        ⚠️ E ELE PERGUNTA AO DISCO, NÃO À LISTA `activated`. Aqui se lia só o
        `activated` do `Workspace.json`, e o resultado era um agente que NUNCA
        mais era copiado: o popover via "já está no projeto", pulava o
        `activate_item` inteiro, e criava o nó — sem erro, sem aviso, sem log.
        O terminal então subia com `--agent` apontando para um arquivo que não
        existia, e o Claude Code recusava a sessão na abertura.

        O estado se cria sozinho e é permanente. O caminho mais fácil: ligar o
        agente com um assistente externo cujo `destino` de agentes é vazio
        (Codex, OpenCode e Gemini são assim de fábrica) — a cópia não
        acontece, mas `activate_item` grava em `activated` do mesmo jeito. Ao
        trocar depois para o Claude Code, nada reavalia. Foi assim que um
        projeto ficou com cinco agentes "ativados" e a `.claude/agents/` vazia.

        Duas verdades sobre a mesma coisa é o defeito que este projeto já
        catalogou em três lugares. A que vale é o disco: é ele que o assistente
        externo lê.
        """
        try:
            r = self.list_arquivos('agentes')
            if not r.get('success'):
                return r
            itens = []
            for it in r.get('items') or []:
                itens.append(dict(it, ja_no_projeto=self._ag_esta_no_projeto(
                    project_name, it['name'])))
            itens.extend(self._ag_itens_de_extensoes(project_name))
            return {'success': True, 'itens': itens}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Os agentes que as extensões acrescentam (recurso Agente, D39) ────────
    #
    # ⚠️ ACRESCENTAM à lista, e nunca substituem nem editam um agente da
    # biblioteca (P9). O `name` de cada um é o `id` do item no manifesto
    # (`rev.revisor`) — único entre as extensões ligadas (o prefixo é o dono).
    #
    # ⚠️ DESLIGAR A EXTENSÃO TIRA O AGENTE DA LISTA; o `.md` que já foi copiado
    # para a pasta de agentes do projeto FICA — é a regra "isto copia e nada
    # nunca remove" do popover (`trabalhos-oficina-popovers.js`).

    def _ag_itens_de_extensoes(self, project_name):
        """Os agentes das extensões ligadas, no MESMO formato dos da biblioteca
        (`name`, `rotulo`, `description`, `ferramentas`, `ja_no_projeto`…) mais
        `de_extensao`, `extensao`, `caminho_extensao` e `caminho` (o `.md`)."""
        itens = []
        for a in agentes_da_oficina_de_extensoes():
            campos, _corpo = self._frontmatter_partes(self._ler_texto(a['caminho']))
            itens.append({
                'name': a['id'], 'rotulo': a['id'], 'grupo': '',
                'description': campos.get('description', '')[:400],
                'agente_nome': a['id'],
                'ferramentas': campos.get('tools', ''),
                'modelo': campos.get('model', ''),
                'origem': 'extensao',
                'ja_no_projeto': self._ag_extensao_no_projeto(project_name, a['id']),
                'de_extensao': True, 'extensao': a['extensao'],
                'caminho_extensao': a['caminho_extensao'], 'caminho': a['caminho'],
            })
        return itens

    def _ag_extensao_no_projeto(self, project_name, id_):
        """O `{id}.md` está na pasta de agentes do projeto? A irmã de
        `_ag_esta_no_projeto` para o agente de extensão, que não tem item na
        biblioteca — e a mesma resposta segura: `False` em toda dúvida."""
        try:
            config = (self.load_workspace(project_name) or {}).get('config') or {}
            raiz = config.get('root_folder')
            if not raiz or not os.path.isdir(raiz):
                return False
            preset = self._assistente_externo(config.get('assistente_externo'))
            destino = ((preset or {}).get('categorias') or {}).get('agentes') or {}
            if not destino.get('destino'):
                return False
            return os.path.isfile(os.path.join(raiz, destino['destino'], id_ + '.md'))
        except Exception:
            return False

    def activate_agente_de_extensao(self, project_name, caminho_extensao, id_):
        """Copia o agente de uma extensão para a pasta de agentes do projeto,
        no destino DO PRESET — o mesmo gesto de `activate_item` para os da
        biblioteca, pela mesma cópia (`_copiar_item_com_preset`).

        O `.md` sai com o nome `{id}.md` e com `name: {id}` no cabeçalho, seja
        qual for o nome do arquivo na pasta da extensão: é por esse nome que o
        nó da Oficina acha o arquivo (`_sh_agente_do_no`) e que o assistente
        externo acha o agente (`--agent`). A cópia é montada numa pasta
        temporária — o arquivo da extensão nunca é tocado.

        Não grava nada em `activated` do `Workspace.json`: aquilo é a lista da
        BIBLIOTECA, e o agente de extensão não tem item lá.
        """
        try:
            agente = agente_de_extensao(caminho_extensao, id_)
            if not agente:
                return {'success': False, 'error':
                        'Este agente não está mais disponível — a extensão que o traz foi desligada?'}
            config = (self.load_workspace(project_name) or {}).get('config') or {}
            root_folder = config.get('root_folder')
            if not root_folder or not os.path.isdir(root_folder):
                return {'success': False, 'error': 'Configure a pasta raiz do projeto na aba Trabalho primeiro.'}
            preset = self._assistente_externo(config.get('assistente_externo'))
            if not preset:
                return {'success': False, 'error':
                        'Nenhum assistente externo configurado. Vá em Configurações > '
                        'Assistentes externos e crie um antes de ligar.'}
            erros = self.validar_assistente(preset)
            if erros:
                return {'success': False, 'error':
                        'O assistente "%s" tem erro: %s' % (preset.get('nome'), erros[0])}
            texto = self._ler_texto(agente['caminho'])
            campos, _corpo = self._frontmatter_partes(texto)
            texto = self._frontmatter_normalizado(texto, id_, campos.get('description'))
            temporaria = tempfile.mkdtemp(prefix='xt-agente-')
            try:
                src = os.path.join(temporaria, id_ + '.md')
                with open(src, 'w', encoding='utf-8', newline='') as f:
                    f.write(texto)
                return self._copiar_item_com_preset('agentes', src, id_, root_folder, preset)
            finally:
                shutil.rmtree(temporaria, ignore_errors=True)
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _ag_esta_no_projeto(self, project_name, item_name):
        """O `.md` deste agente está mesmo na pasta de agentes do projeto?

        Devolve `False` em toda dúvida — projeto sem raiz, sem preset, preset
        cujo `destino` de agentes é vazio. É a resposta segura: no pior caso o
        programa copia de novo por cima de um arquivo que já estava certo, o
        que não custa nada. A resposta errada no outro sentido custa um
        terminal que não abre.
        """
        try:
            config = (self.load_workspace(project_name) or {}).get('config') or {}
            raiz = config.get('root_folder')
            if not raiz or not os.path.isdir(raiz):
                return False
            preset = self._assistente_externo(config.get('assistente_externo'))
            destino = ((preset or {}).get('categorias') or {}).get('agentes') or {}
            if not destino.get('destino'):
                # Assistente que não tem pasta de agentes: nada é copiado, e
                # dizer "já está lá" seria mentira das antigas.
                return False
            pasta = os.path.join(raiz, destino['destino'])
            src = self._arquivos_caminho_do_item('agentes', item_name)
            if not src:
                return False
            # Os mesmos nomes de arquivo que `_copiar_item_com_preset` grava —
            # e por isso a pergunta vem DELE, e não de uma segunda montagem de
            # nome aqui, que era como as duas versões divergiriam.
            nomes = [n for n, _ in self._arquivos_arquivos_do_item(src)]
            return bool(nomes) and all(
                os.path.isfile(os.path.join(pasta, n)) for n in nomes)
        except Exception:
            return False

    # ── Ler ──────────────────────────────────────────────────────────────────

    def ler_agente(self, item_name):
        """Os campos de um agente, para a tela preencher o editor."""
        try:
            # Pasta OU `.md` solto — `_arquivos_caminho_do_item` resolve os dois.
            caminho = self._arquivos_caminho_do_item('agentes', item_name)
            if not caminho:
                return {'success': False, 'error': 'Este agente não existe mais na biblioteca.'}
            arquivo = self._agente_arquivo_do_item(caminho)
            if not arquivo:
                return {'success': False, 'error':
                        'A pasta deste agente não tem nenhum arquivo .md dentro.'}
            campos, corpo = self._frontmatter_partes(self._ler_texto(arquivo))
            extras = {k: v for k, v in campos.items() if k not in CAMPOS_GOVERNADOS}
            return {
                'success': True,
                'item': item_name,
                # O grupo é TUDO que vem antes da última barra, em qualquer
                # profundidade: `Backend/Revisão/revisor` tem grupo
                # `Backend/Revisão`. Antes isto se chamava `assistente` e valia
                # um nível só.
                'grupo': item_name.rsplit('/', 1)[0] if '/' in item_name else '',
                'rotulo': item_name.rsplit('/', 1)[-1],
                'arquivo': os.path.basename(arquivo),
                'name': campos.get('name', ''),
                'description': campos.get('description', ''),
                'tools': campos.get('tools', ''),
                'model': campos.get('model', ''),
                'corpo': corpo,
                # Os campos que este editor não governa, para a tela poder dizer
                # que eles existem em vez de o usuário descobrir que "sumiram"
                # (eles não somem — ver `_ag_montar_texto`).
                'outros_campos': extras,
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Gravar ───────────────────────────────────────────────────────────────

    def salvar_agente(self, dados, item_original=None):
        """Cria ou edita um agente. Devolve o `item` para a tela recarregar.

        ⚠️ O NOME TRAVA DEPOIS DE CRIADO, e isso não é preguiça. A identidade de
        um item da biblioteca é o CAMINHO relativo dele, e esse caminho está
        gravado na lista `activated` do `Workspace.json` de todo projeto que
        ligou este agente. Renomear a pasta sem varrer todos os projetos deixaria
        essas entradas apontando para nada — e a varredura é outra obra. Até lá,
        renomear é criar de novo e apagar o antigo, que ao menos é um gesto que
        o usuário vê acontecendo.
        """
        try:
            dados = dados or {}
            # ⚠️ GRUPO É OPCIONAL, e antes era obrigatório sob o nome
            # `assistente`. Um agente sem grupo mora direto em `Agentes/`, que é
            # onde o Claude Code guarda os dele — obrigar uma pasta por cima
            # inventava uma camada que o produto não tem.
            grupo = '/'.join(p for p in (
                self._ag_nome_de_pasta(parte)
                for parte in (dados.get('grupo') or '').split('/')) if p)
            rotulo = self._ag_nome_de_pasta(dados.get('nome') or '')
            if not rotulo:
                return {'success': False, 'error': 'O agente precisa de um nome.'}

            slug = self._slug_universal(rotulo)
            if not slug:
                return {'success': False, 'error':
                        '"%s" não tem nenhuma letra ou número — o nome do arquivo sai vazio.' % rotulo}

            item_name = ('%s/%s' % (grupo, rotulo)) if grupo else rotulo

            if item_original and item_original != item_name:
                return {'success': False, 'error':
                        'Não dá para renomear um agente por aqui: o nome dele está gravado na '
                        'lista de ativados de cada projeto. Crie um novo e apague este.'}

            base = self._arquivos_item_path(PASTA_DA_CATEGORIA, item_name)
            if not base:
                return {'success': False, 'error': 'Nome de agente inválido.'}

            existente = self._arquivos_caminho_do_item('agentes', item_name)
            if not item_original and existente:
                return {'success': False, 'error':
                        'Já existe um agente "%s"%s.'
                        % (rotulo, ' em "%s"' % grupo if grupo else ' na raiz de Agentes')}

            outro = self._colisao_de_slug(PASTA_DA_CATEGORIA, item_name, slug)
            if outro:
                return {'success': False, 'error':
                        '"%s" e "%s" viram os dois "%s.md" no projeto, e o agrupamento não vai '
                        'junto na cópia. Escolha outro nome.' % (item_name, outro, slug)}

            texto = self._ag_montar_texto(dados, slug)

            # ⚠️ O NOME DO ARQUIVO GUARDA A CAIXA E O ACENTO do que o usuário
            # digitou, e o `name:` do frontmatter é que leva o slug. São duas
            # perguntas diferentes: o arquivo é o que ele lê na lista da tela,
            # o `name:` é o que o Claude Code usa para acionar o agente. Antes o
            # nome bonito vivia na PASTA do item; sem pasta, ele vive aqui.
            os.makedirs(os.path.dirname(base), exist_ok=True)
            destino = base + '.md'

            with open(destino, 'w', encoding='utf-8', newline='\n') as fh:
                fh.write(texto)

            return {'success': True, 'item': item_name,
                    'arquivo': os.path.basename(destino)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _ag_montar_texto(self, dados, slug):
        """O `.md` inteiro: frontmatter + corpo.

        ⚠️ `tools` VAZIO REMOVE A CHAVE — não escreve `tools:` em branco. No
        Claude Code, OMITIR `tools` significa **herdar todas as ferramentas**, e
        um `tools:` vazio é outra coisa (nenhuma, ou erro de leitura, conforme a
        versão). A diferença entre as duas é a permissão inteira do agente, e
        ela não pode depender de um espaço em branco.

        ⚠️ A DESCRIÇÃO VIRA UMA LINHA SÓ. O leitor de frontmatter deste projeto
        (`_frontmatter_partes`) é raso de propósito: `chave: valor`, uma linha.
        Dois-pontos no meio do valor ele aguenta (`split(':', 1)`) — testado —,
        mas uma quebra de linha ele não: a segunda linha viraria outra chave, ou
        lixo. Trocar por espaço é a perda menor, e é o mesmo que
        `_frontmatter_normalizado` já faz do outro lado.
        """
        def uma_linha(v):
            return ' '.join(str(v or '').split())

        campos = []
        campos.append(('name', slug))
        campos.append(('description', uma_linha(dados.get('description'))))

        ferramentas = uma_linha(dados.get('tools'))
        if ferramentas:
            campos.append(('tools', ferramentas))

        modelo = uma_linha(dados.get('model'))
        if modelo:
            campos.append(('model', modelo))

        # O que o usuário escreveu à mão e este editor não conhece continua ali.
        for chave, valor in (dados.get('outros_campos') or {}).items():
            if chave in CAMPOS_GOVERNADOS:
                continue
            campos.append((chave, uma_linha(valor)))

        cabecalho = '\n'.join('%s: %s' % (k, v) for k, v in campos)
        corpo = (dados.get('corpo') or '').strip('\n')
        return '---\n%s\n---\n\n%s\n' % (cabecalho, corpo)
