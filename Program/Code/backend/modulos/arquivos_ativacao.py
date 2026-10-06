"""Ligar e desligar um item da biblioteca num projeto.

O que este arquivo responde é *o que acontece quando o usuário clica no botão*,
e a resposta muda inteira com a categoria — é essa ramificação, e não o tamanho,
que o separa de `arquivos_copia.py` (que sabe COMO copiar) e de `arquivos.py`
(que sabe o que existe):

| Categoria | Ligar faz | Desligar faz |
|---|---|---|
| skills, comandos, agentes | copia para o destino do preset | apaga a cópia |
| `instrucoes-base` | copia para a raiz | **nada** — ver abaixo |
| `regras-instrucoes` | copia o molde para a pasta de Decisões | **nada** |
| `mcps` do programa | mescla a entrada no `.mcp.json` | tira a entrada |
| `mcps` de terceiro | COPIA a pasta **e** mescla a entrada | tira a entrada **e apaga a cópia** |
| `codigos` | só marca disponível | só desmarca |

⚠️ AS DUAS QUE NÃO APAGAM NÃO SÃO ESQUECIMENTO. O arquivo de instrução base
(CLAUDE.md / AGENTS.md) e a cópia de uma regra são EDITADOS pelo usuário depois
de copiados: a partir da ativação eles são do projeto, não da biblioteca.
Apagá-los ao desligar jogaria fora trabalho dele sem uma palavra. Quem remove a
regra é a aba Decisões; o arquivo da raiz, ele mesmo.

⚠️ O MCP DE TERCEIRO É O ÚNICO QUE APAGA A CÓPIA, e isso contraria o verbete
"Molde e cópia" que governa as duas linhas acima. Não é descuido: foi decisão do
usuário, porque a cópia de um servidor é código gerado e não texto que ele
edita, e está registrada como exceção em `Saída das skills/Terminologia e
nomenclatura/Exceções.md`. O freio é o `confirmado`: cópia diferente do molde
não some sem o usuário dizer que pode.

⚠️ E há um trecho de COMPATIBILIDADE em `deactivate_item` que parece sobra e não
é: o ativar ANTIGO tinha destino fixo em `.claude/commands/`, e sem essa limpeza
o comando some da tela mas continua aparecendo para o assistente externo.
"""

from .constantes import *


class ArquivosAtivacaoMixin:

    def activate_item(self, project_name, kind, item_name):
        if kind in self._ARQUIVOS_SEM_CRUD_GENERICO:
            return {'success': False, 'error': 'Categoria com caminho próprio.'}
        folder = self._ARQUIVOS_FOLDER.get(kind)
        if not folder:
            return {'success': False, 'error': 'Tipo inválido.'}
        ws = self.load_workspace(project_name)
        config = ws.get('config', {})
        # Pasta OU arquivo solto — ver `_arquivos_caminho_do_item`.
        src = self._arquivos_caminho_do_item(kind, item_name)
        if not src:
            return {'success': False, 'error': 'Item não encontrado.'}

        message = f'"{item_name}" ativado.'
        if kind in self._ARQUIVOS_COM_PRESET:
            root_folder = config.get('root_folder')
            if not root_folder or not os.path.isdir(root_folder):
                return {'success': False, 'error': 'Configure a pasta raiz do projeto na aba Trabalho primeiro.'}
            # O destino vem do preset da aba ARQUIVOS — não do Preparar projeto,
            # que responde outra pergunta. Antes daqui o caminho era fixo em
            # `.claude/commands/`, e por isso skill e comando saíam os dois na
            # mesma pasta, em qualquer assistente.
            preset = self._assistente_externo(config.get('assistente_externo'))
            if not preset:
                return {'success': False, 'error':
                        'Nenhum assistente externo configurado. Vá em Configurações > '
                        'Assistentes externos e crie um antes de ligar.'}
            erros = self.validar_assistente(preset)
            if erros:
                return {'success': False, 'error':
                        'O assistente "%s" tem erro: %s' % (preset.get('nome'), erros[0])}
            r = self._copiar_item_com_preset(kind, src, item_name, root_folder, preset)
            if not r['success']:
                return r
            message = r['message']
        elif kind == 'regras-instrucoes':
            r = self._ativar_regra_ou_instrucao(project_name, src, item_name)
            if not r['success']:
                return r
            rotulo = 'Instrução' if r['tipo'] == 'instrucao' else 'Regra'
            message = f'{rotulo} "{item_name}" copiada para a pasta do projeto e listada na aba Decisões.'
        elif kind == 'mcps':
            origem = self._arquivos_meta_de(
                self._arquivos_meta_load(kind), item_name).get('origem', 'geral')
            if origem == 'programa':
                # Os dois itens do programa (Assistente/Trabalhos) casam com a
                # chave do servidor por nome, em minúsculas — ver `_MCP_SERVIDORES`.
                servidor = item_name.strip().lower()
                if servidor not in self._MCP_SERVIDORES:
                    return {'success': False,
                            'error': 'MCP do programa desconhecido: "%s".' % item_name}
                root_folder = config.get('root_folder')
                if not root_folder or not os.path.isdir(root_folder):
                    return {'success': False, 'error': 'Configure a pasta raiz do projeto na aba Trabalho primeiro.'}
                # Onde fica o arquivo de configuração vem do preset da aba
                # Arquivos: o Cursor procura em `.cursor/mcp.json`, não na raiz.
                destino = self._destino_do_mcp(config)
                if destino is None:
                    return {'success': False, 'error':
                            'Nenhum preset de arquivos configurado. Vá em Configurações > '
                            'Arquivos e crie um antes de ligar.'}
                if not destino:
                    return {'success': False, 'error':
                            'O preset deste projeto não registra MCP por arquivo — '
                            'este assistente guarda a configuração de MCP em outro formato.'}
                r = self._mcp_registrar(project_name, config, root_folder, destino, servidor)
                if not r['success']:
                    return r
                message = 'Servidor "%s" registrado no projeto (%s).' % (item_name, destino)
            else:
                # ⚠️ ESTE RAMO ERA UM BURACO. Até ele existir, ligar um MCP de
                # terceiro NÃO FAZIA NADA: a execução escapava do `elif` e caía
                # direto no `activated[kind].append`, então o item ficava
                # marcado como ativo sem uma linha escrita em lugar nenhum. A
                # prova está no disco — o `Workspace.json` do projeto "Achar
                # elmentos na tela e clicar neles" lista um "MCP do Vibe-Coding"
                # que não existe mais em canto nenhum.
                #
                # ⛔ E ele trata SÓ `origem == 'geral'`. O ramo de cima, dos dois
                # do programa, continua exatamente como estava: sem manifesto,
                # sem cópia, registrando por `_MCP_SERVIDORES`.
                root_folder = config.get('root_folder')
                if not root_folder or not os.path.isdir(root_folder):
                    return {'success': False, 'error': 'Configure a pasta raiz do projeto na aba Trabalho primeiro.'}
                r = self._mcp3_ligar(project_name, config, item_name, src, root_folder)
                if not r['success']:
                    return r
                message = r['message']
        # codigos → só registra a ativação (marca disponível).

        activated = config.setdefault('activated', {})
        lst = activated.setdefault(kind, [])
        if item_name not in lst:
            lst.append(item_name)
        self.save_workspace(project_name, config)
        return {'success': True, 'message': message}

    def listar_ativos_no_disco(self, project_name):
        """Quais itens das seis categorias com destino de assistente JÁ ESTÃO
        fisicamente copiados no projeto — independente de terem sido "ligados"
        pelo programa (`config['activated']`, o que `activate_item` grava).

        Existe para o projeto importado, cujas skills/comandos já chegaram
        copiados de fora do programa: sem isto, a aba Arquivos os mostra como
        Inativo mesmo com o arquivo presente no disco («tá tudo inativo sendo
        que tá ligado»). Mesma checagem que a prévia do Preparar projeto usa
        para pintar de verde (`_preparar_item_ja_esta`), só que pelo preset da
        aba Arquivos (`assistente_externo`), não pelo início rápido — são
        presets diferentes, e o card do projeto lê o primeiro.
        """
        ws = self.load_workspace(project_name)
        config = ws.get('config', {})
        root_folder = config.get('root_folder')
        ativos = {}
        if not root_folder or not os.path.isdir(root_folder):
            return {'success': True, 'ativos': ativos}
        assistente = self._assistente_externo(config.get('assistente_externo'))
        arquivo_regras = self._ARQUIVO_REGRAS_PADRAO
        if assistente:
            cat_regras = self._categoria_do_assistente(assistente, 'instrucoes-base')
            arquivo_regras = (cat_regras.get('arquivo_de_entrada') or '').strip() \
                or self._ARQUIVO_REGRAS_PADRAO
        destino_mcp = self._destino_do_mcp(config)
        for kind, _rotulo, _unica in CATEGORIAS_DO_INICIO_RAPIDO:
            destino = destino_mcp if kind == 'mcps' else None
            ativos[kind] = {
                nome: bool(self._preparar_item_ja_esta(
                    project_name, kind, nome, root_folder, assistente, destino, arquivo_regras))
                for nome in self._itens_da_biblioteca(kind)
            }
        return {'success': True, 'ativos': ativos}

    def _ativar_regra_ou_instrucao(self, project_name, src, item_name):
        """Copia o molde da biblioteca para dentro do projeto.

        Molde e cópia, não original e atalho: a partir daqui a cópia é do
        projeto e pode ser editada. Por isso desativar não a apaga.
        Regra e instrução são as duas a pasta inteira, com o nome do item.
        """
        base = self._regras_base(project_name, criar=True, obrigatorio=False)
        if not base:
            return {'success': False, 'error': 'Configure a pasta raiz do projeto na aba Trabalho primeiro.'}

        tipo = self._regras_item_tipo(src)
        nome = item_name.rsplit('/', 1)[-1]
        if not self._regras_arquivos_do_item(src, nome):
            return {'success': False, 'error': 'O molde não tem nenhum arquivo .md.'}
        try:
            dest = os.path.join(base, nome)
            if os.path.isdir(dest):
                shutil.rmtree(dest)
            shutil.copytree(src, dest)
        except Exception as e:
            return {'success': False, 'error': str(e)}

        self.gerar_indice_regras(project_name)
        # ⚠️ Ativar uma regra NÃO mexe mais no arquivo de regras da raiz (D11).
        # Havia aqui um `_garantir_secao_regras_claude_md`, que apendava a seção
        # "Regras e instruções deste projeto" no CLAUDE.md a partir de um texto
        # cravado neste módulo. O texto saiu do código (D1/D7) e este caminho não
        # tem preset em jogo — não há de onde tirar conteúdo.
        # Quem aponta a base normativa agora é o ITEM DE INSTRUÇÕES BASE que o
        # início rápido marcou, escrito uma vez pelo Preparar. Num projeto cujo
        # arquivo de regras não
        # cite `Saída das skills/Regras e instruções/`, a pasta fica invisível
        # para o assistente externo até o usuário acrescentar a linha à mão.
        return {'success': True, 'tipo': tipo}

    # ── Órfãos: entrada "ligado" cujo item não existe mais na biblioteca ──
    # Nascem quando o item é apagado ou renomeado na biblioteca: o registro do
    # projeto continua apontando para o nome antigo. Não quebram nada — a aba só
    # mostra "Ativo" em item que a listagem devolve — mas voltam a valer no dia
    # em que uma pasta com o mesmo caminho renasce.
    #
    # ⛔ NUNCA se limpam sozinhos. Uma pasta renomeada por engano perderia o
    # "ligado" antes de o usuário desfazer o rename. Quem limpa é o botão da aba
    # Arquivos, e só o que ele lista (P3 da discussão "Pendências da reforma").

    def listar_ativados_orfaos(self, project_name):
        """`{kind: [item, …]}` — as entradas de `activated` sem item na biblioteca."""
        ws = self.load_workspace(project_name)
        activated = (ws.get('config') or {}).get('activated') or {}
        orfaos = {}
        for kind in self._ARQUIVOS_FOLDER:
            if kind in self._ARQUIVOS_SEM_CRUD_GENERICO:
                continue
            ligados = activated.get(kind) or []
            if not ligados:
                continue
            existentes = {i['name'] for i in self.list_arquivos(kind).get('items') or []}
            sobra = [n for n in ligados if n not in existentes]
            if sobra:
                orfaos[kind] = sobra
        return {'success': True, 'orfaos': orfaos}

    def limpar_ativados_orfaos(self, project_name, kind):
        """Tira do registro as entradas órfãs de UMA categoria. Só o registro:
        nada de `rmtree` nem `os.remove` — o slug de um órfão pode coincidir com
        o de uma cópia viva, e `deactivate_item` apagaria essa cópia."""
        sobra = self.listar_ativados_orfaos(project_name).get('orfaos', {}).get(kind) or []
        if not sobra:
            return {'success': True, 'removidos': []}
        ws = self.load_workspace(project_name)
        config = ws.get('config', {})
        lst = config.setdefault('activated', {}).setdefault(kind, [])
        for n in sobra:
            if n in lst:
                lst.remove(n)
        self.save_workspace(project_name, config)
        return {'success': True, 'removidos': sobra}

    def deactivate_item(self, project_name, kind, item_name, confirmado=False):
        """Desliga um item. `confirmado` só é lido pela categoria `mcps`.

        ⚠️ Parâmetro com padrão NO FIM, e não no meio: a tela chama esta
        fronteira com três posicionais em todas as outras categorias, e um
        quarto obrigatório quebraria as seis de uma vez. Ele responde uma
        pergunta que só os MCPs de terceiro fazem — "apago a cópia mesmo tendo
        sido editada?" — e para todo o resto passa despercebido.
        """
        ws = self.load_workspace(project_name)
        config = ws.get('config', {})
        # ⛔ `instrucoes-base` fica FORA daqui de propósito: o destino dela é a
        # raiz do projeto, e o arquivo que mora lá (CLAUDE.md / AGENTS.md) é
        # editado pelo usuário depois de copiado. Apagá-lo ao desligar jogaria
        # fora trabalho dele — é o mesmo motivo pelo qual `regras-instrucoes`
        # nunca apagou a cópia do projeto.
        if kind in self._ARQUIVOS_COM_PRESET and kind != 'instrucoes-base':
            root_folder = config.get('root_folder')
            src = self._arquivos_caminho_do_item(kind, item_name)
            preset = self._assistente_externo(config.get('assistente_externo'))
            if root_folder and os.path.isdir(root_folder) and src and preset:
                cat = self._categoria_do_assistente(preset, kind)
                destino = cat['destino']
                if destino:
                    dest_base = os.path.abspath(os.path.join(root_folder, destino.replace('/', os.sep)))
                    raiz = os.path.abspath(root_folder)
                    if dest_base == raiz or dest_base.startswith(raiz + os.sep):
                        slug = self._slug_universal(item_name.rsplit('/', 1)[-1])
                        if cat['formato'] == 'pasta' and slug:
                            alvo = os.path.join(dest_base, slug)
                            if os.path.isdir(alvo):
                                try:
                                    shutil.rmtree(alvo)
                                except Exception:
                                    pass
                        else:
                            # Formato solto: só os arquivos que esta cópia levou.
                            # `_arquivos_arquivos_do_item` cobre o item-arquivo,
                            # que aqui é um `.md` só, com o nome dele.
                            for fname, _fp in self._arquivos_arquivos_do_item(src):
                                fp = os.path.join(dest_base, fname)
                                if os.path.isfile(fp):
                                    try:
                                        os.remove(fp)
                                    except Exception:
                                        pass
            # compat: limpa o que o ativar ANTIGO (com o destino fixo) deixou em
            # `.claude/commands/` — os .md soltos e a subpasta que a versão com
            # bug chegou a criar. Sem isto, o comando some da tela mas continua
            # aparecendo para o assistente.
            if root_folder and os.path.isdir(root_folder):
                cmd_dir = os.path.join(root_folder, '.claude', 'commands')
                if src:
                    for fname, _fp in self._arquivos_arquivos_do_item(src):
                        if fname.lower().endswith('.md'):
                            fp = os.path.join(cmd_dir, fname)
                            if os.path.isfile(fp):
                                try:
                                    os.remove(fp)
                                except Exception:
                                    pass
                old = os.path.join(cmd_dir, item_name.rsplit('/', 1)[-1])
                if os.path.isdir(old):
                    try:
                        shutil.rmtree(old)
                    except Exception:
                        pass
        if kind == 'mcps':
            root_folder = config.get('root_folder')
            origem = self._arquivos_meta_de(
                self._arquivos_meta_load(kind), item_name).get('origem', 'geral')
            servidor = item_name.strip().lower()
            if origem == 'programa':
                if root_folder and os.path.isdir(root_folder) and servidor in self._MCP_SERVIDORES:
                    # O MESMO destino que a ativação usou — desregistrar sempre na
                    # raiz deixaria a entrada de pé em `.cursor/mcp.json`.
                    self._mcp_desregistrar(root_folder, self._destino_do_mcp(config), servidor)
            elif root_folder and os.path.isdir(root_folder):
                # O molde, para comparar com a cópia. `mcps` não entra em
                # `_ARQUIVOS_COM_PRESET`, então o `src` do bloco de cima não
                # chega aqui — e sem ele a comparação diria "não editada" para
                # tudo, calando justamente o aviso que ela existe para dar.
                src = self._arquivos_caminho_do_item(kind, item_name)
                # ⚠️ AQUI O DESLIGAR APAGA A CÓPIA, ao contrário de todas as
                # outras categorias — decisão do usuário, registrada como
                # exceção em `Terminologia e nomenclatura/Exceções.md`: a cópia
                # de um servidor é código gerado, não texto que ele edita.
                #
                # ⚠️ E ele PARA quando a cópia foi editada, devolvendo
                # `precisa_confirmar`. Sem esse freio a exceção viraria o dano
                # que o verbete "Molde e cópia" existe para impedir: trabalho do
                # usuário apagado sem uma palavra.
                r = self._mcp3_desligar(config, item_name, src, root_folder, confirmado)
                if not r.get('success'):
                    return r
        # regras-instrucoes: NÃO apaga a cópia do projeto ao desativar — ela é do
        # projeto a partir da ativação e pode ter sido editada; apagá-la aqui
        # destruiria trabalho do usuário. Ele a remove pela aba Decisões.
        activated = config.setdefault('activated', {})
        lst = activated.setdefault(kind, [])
        if item_name in lst:
            lst.remove(item_name)
        self.save_workspace(project_name, config)
        return {'success': True}
