"""Preparar projeto: um clique executa o início rápido inteiro.

`arquivos_inicio_rapido.py` responde o que o preset DIZ; este arquivo responde o
que acontece quando ele RODA. São duas perguntas, e a segunda é a que escreve no
disco do usuário — daí os dois arquivos.

A ordem dos passos é fixa e ela importa: a pasta de trabalho precisa existir
antes das pastas de dentro dela, e as marcas (`remover`, `contexto`) só podem
ser aplicadas depois de as pastas terem caminho no disco.

    1 ── copia da biblioteca os itens marcados, pelo caminho de
         `arquivos_copia.py`, com `sobrescrever=False`
    2 ── escreve o arquivo de instrução base da raiz — nome do assistente,
         texto do item da biblioteca
    3 ── cria as pastas do plano
    4 ── aplica as marcas

⚠️ O D3 É A REGRA QUE ATRAVESSA O ARQUIVO INTEIRO: **preparar duas vezes não
pode desfazer edição nenhuma do usuário.** É ela que explica `sobrescrever=False`
na cópia, o `_preparar_copiar_regra` que é gêmeo do de ativar mas NÃO sobrescreve,
e o `_criar_arquivo_regras` que não reescreve, não apenda e não pergunta. O
Preparar é um ato de partida, não uma sincronização contínua.

⚠️ NÃO PASSA POR `activate_item` de propósito. Aquele caminho é o do botão
"ligar", que sobrescreve porque o usuário mandou reativar aquele item — o
contrário do que o D3 pede aqui.

⚠️ A PRÉVIA E A EXECUÇÃO LEEM O MESMO PLANO (`_preparar_plano_de_pastas`), e é
isso que garante que a tela mostra literalmente o que o passo seguinte vai
fazer. Duas listas divergiriam na primeira mudança.
"""

from .constantes import *
# O destino das Regras e instruções NÃO é campo do preset do Preparar: é a mesma
# pasta que a aba Decisões edita e que as ferramentas dos subagentes leem, e quem
# a define é `regras.py`. Import explícito porque ela não passa por `constantes`.
from .regras import PASTA_BASE_REGRAS


class ArquivosPrepararMixin:

    @staticmethod
    def _dentro_da_raiz(root_folder, caminho):
        """Cinto e suspensório do D36: nada é criado fora da raiz, nunca.

        A validação do preset já barra `..` e caminho absoluto; esta confere o
        resultado JÁ RESOLVIDO, que é o que de fato vai para o `makedirs`.
        """
        raiz = os.path.normcase(os.path.abspath(root_folder))
        alvo = os.path.normcase(os.path.abspath(caminho))
        return alvo == raiz or alvo.startswith(raiz + os.sep)

    @staticmethod
    def _juntar_relativo(base, rel):
        """Resolve um caminho do preset contra uma base. None se vazio."""
        rel = (rel or '').strip().replace('\\', '/').strip('/')
        partes = [s for s in rel.split('/') if s and s != '.']
        if not partes:
            return None
        return os.path.normpath(os.path.join(base, *partes))

    def _preparar_plano_de_pastas(self, preset, root_folder):
        """As pastas do preset, já resolvidas, na ordem de criação.

        Uma lista só, usada pela prévia E pela execução: é o que garante que a
        tela mostra literalmente o que o passo seguinte vai fazer.
        """
        plano = []

        def _acrescentar(destino, base, item, e_pasta_de_trabalho=False):
            caminho = self._juntar_relativo(base, item.get('caminho'))
            if not caminho or not self._dentro_da_raiz(root_folder, caminho):
                return
            plano.append({
                'destino': destino,
                'rel': (item.get('caminho') or '').strip(),
                'path': caminho,
                'existe': os.path.isdir(caminho),
                'remover': bool(item.get('remover')),
                'contexto': bool(item.get('contexto')),
                'descricao': (item.get('descricao') or '').strip(),
                'pasta_de_trabalho': e_pasta_de_trabalho,
            })

        for item in (preset.get('pastas_raiz') or []):
            if isinstance(item, dict):
                _acrescentar('raiz', root_folder, item)

        trabalho_rel = (preset.get('pasta_trabalho') or '').strip()
        trabalho_abs = self._juntar_relativo(root_folder, trabalho_rel) if trabalho_rel else None
        if trabalho_abs and self._dentro_da_raiz(root_folder, trabalho_abs):
            _acrescentar('trabalho', root_folder, {'caminho': trabalho_rel}, e_pasta_de_trabalho=True)
            for item in (preset.get('pastas_trabalho') or []):
                if isinstance(item, dict):
                    _acrescentar('trabalho', trabalho_abs, item)
        return plano

    def _assistente_do_inicio_rapido(self, inicio):
        """O assistente externo que este início rápido usa.

        ⚠️ LOOKUP TOLERANTE, de propósito. O nome do assistente é uma string
        gravada no disco do usuário, e ele pode ter renomeado ou excluído o
        assistente depois — e o "Restaurar padrão" de Preparar projeto devolve
        inícios rápidos apontando para NOMES DE FÁBRICA, que podem não existir
        mais. Nome que não casa cai no padrão, exatamente como o início rápido
        órfão já caía. Levantar aqui deixaria o Preparar inutilizável por causa
        de um rename.
        """
        return self._assistente_externo((inicio or {}).get('assistente'))

    def _preparar_grupos(self, inicio, assistente=None):
        """O que cada categoria copia e para onde.

        ⚠️ O DESTINO NÃO É MAIS CAMPO DO INÍCIO RÁPIDO: ele vem do assistente
        externo. O início rápido responde QUAIS itens vão; o assistente responde
        PARA ONDE. Eram as duas metades da mesma pergunta em duas listas
        diferentes, e é isso que a fusão de 2026-09-02 desfez.

        Três maneiras de uma categoria ser pulada, e as três são "campo vazio é
        pulado, não é erro": **nenhum item marcado**, **destino em branco** no
        assistente, ou **assistente nenhum configurado**.
        """
        if assistente is None:
            assistente = self._assistente_do_inicio_rapido(inicio)
        grupos = []
        for kind, rotulo, _unica in CATEGORIAS_DO_INICIO_RAPIDO:
            itens = self._itens_do_inicio_rapido(inicio, kind)
            if not itens:
                continue
            if kind == 'regras-instrucoes':
                # O destino das regras não é campo de ninguém: é fixo em
                # regras.py, porque a mesma pasta é lida pela aba Decisões e
                # pelos subagentes. Barra normal e barra final porque o que a
                # tela mostra é caminho de exibição, e `os.path.join` traz a
                # barra invertida do Windows.
                destino = PASTA_BASE_REGRAS.replace(os.sep, '/').rstrip('/') + '/'
            else:
                if not assistente:
                    continue
                cat = self._categoria_do_assistente(assistente, kind)
                destino = cat['destino']
                if not destino and not self._raiz_quando_vazio(kind):
                    continue
            grupos.append({'kind': kind, 'rotulo': rotulo,
                           # Vazio quer dizer a raiz do projeto, e a tela precisa
                           # de uma palavra, não de uma string vazia.
                           'destino': destino or 'raiz do projeto',
                           'itens': itens})
        return grupos

    def _instrucao_base_do_inicio_rapido(self, inicio, assistente=None):
        """O par (nome do arquivo, texto) da instrução base deste início rápido.

        O NOME vem do assistente (`arquivo_de_entrada`: CLAUDE.md, AGENTS.md).
        O TEXTO vem do ITEM DA BIBLIOTECA marcado — é conteúdo do usuário, e
        deixou de ser o campo `conteudo_regras` do preset em 2026-09-02.

        Texto vazio (nenhum item marcado, ou item sem arquivo legível) é PULADO,
        não é erro: a mesma regra de campo vazio dos destinos (D36).
        """
        if assistente is None:
            assistente = self._assistente_do_inicio_rapido(inicio)
        cat = self._categoria_do_assistente(assistente, 'instrucoes-base') if assistente else {}
        nome_arquivo = (cat.get('arquivo_de_entrada') or '').strip() or self._ARQUIVO_REGRAS_PADRAO
        itens = self._itens_do_inicio_rapido(inicio, 'instrucoes-base')
        if not itens:
            return nome_arquivo, ''
        # ESCOLHA ÚNICA: `save_inicios_rapidos` já corta a lista em um, e aqui
        # só o primeiro é lido. Dois itens copiariam para o mesmo caminho.
        src = self._arquivos_caminho_do_item('instrucoes-base', itens[0])
        if not src:
            return nome_arquivo, ''
        for _nome, caminho in self._arquivos_arquivos_do_item(src):
            try:
                return nome_arquivo, self._ler_texto(caminho)
            except Exception:
                break
        return nome_arquivo, ''

    def _preparar_item_ja_esta(self, project_name, kind, name, root_folder, assistente,
                               destino, arquivo_regras):
        """O item já está no projeto? True / False, ou None quando não dá para saber.

        Responde a pergunta da prévia item a item — a tela pinta de verde o que
        já chegou e de vermelho o que falta. Espelha o DESTINO que a cópia usa
        (`_copiar_item_com_preset`, `_preparar_copiar_regra`, `_mcp_registrar`)
        sem escrever nada: é só leitura.

        ⚠️ MUDOU O DESTINO LÁ, MUDE AQUI. Esta função não copia, então não é um
        segundo caminho de cópia — mas se o formato de destino mudar do lado da
        cópia e não daqui, a tela passa a mentir sobre o que já existe.
        """
        try:
            if kind == 'instrucoes-base':
                return os.path.isfile(os.path.join(root_folder, arquivo_regras))
            if kind == 'regras-instrucoes':
                base = self._regras_base(project_name)
                return bool(base) and os.path.isdir(os.path.join(base, name.rsplit('/', 1)[-1]))
            if kind == 'mcps':
                info = self._MCP_SERVIDORES.get(name.strip().lower())
                if not info:
                    return None
                path = self._juntar_relativo(root_folder, destino) or os.path.join(
                    root_folder, self._MCP_ARQUIVO_PADRAO)
                if not os.path.isfile(path):
                    return False
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                return info['chave'] in ((data or {}).get('mcpServers') or {})
            if not assistente:
                return None
            cat = self._categoria_do_assistente(assistente, kind)
            dest_base = os.path.join(root_folder, (cat['destino'] or '').replace('/', os.sep))
            src = os.path.join(ARQUIVOS_DIR, self._ARQUIVOS_FOLDER[kind], name)
            slug = self._slug_universal(name.rsplit('/', 1)[-1])
            entrada = cat['arquivo_de_entrada']
            if cat['formato'] == 'pasta':
                alvo = os.path.join(dest_base, slug)
                return os.path.isfile(os.path.join(alvo, entrada)) if entrada else os.path.isdir(alvo)
            # Solto: o item só "está" quando TODOS os arquivos dele chegaram — um
            # comando-pasta com três `.md` e só dois no destino ainda falta.
            principal = self._arquivo_principal_do_item(src) if entrada else None
            arquivos = list(self._arquivos_arquivos_do_item(src))
            if not arquivos:
                return None
            return all(os.path.isfile(os.path.join(
                dest_base, entrada if (entrada and fname == principal) else fname))
                for fname, _ in arquivos)
        except Exception:
            return None

    def preparar_projeto_preview(self, project_name, preset_nome=None):
        """Prévia do que o Preparar vai fazer. Não escreve nada."""
        ws = self.load_workspace(project_name)
        config = ws.get('config', {})
        root_folder = config.get('root_folder')
        preset = self._inicio_rapido(preset_nome or config.get('inicio_rapido'))
        if not preset:
            return {'success': False,
                    'error': 'Nenhum início rápido configurado. Crie um em '
                             'Configurações > Preparar projeto, ou use "Restaurar '
                             'padrão" para trazer os de fábrica de volta.'}

        erros_preset = self.validar_inicio_rapido(preset)
        assistente = self._assistente_do_inicio_rapido(preset)
        arquivo_regras, texto_instrucao_base = self._instrucao_base_do_inicio_rapido(
            preset, assistente)
        regras_existe = bool(root_folder) and os.path.isfile(os.path.join(root_folder, arquivo_regras))

        # Aviso do teto (D37): SÓ avisa. Cortar mutilaria as regras em silêncio.
        # O tamanho sai do ITEM DA BIBLIOTECA que o usuário marcou, e não de uma
        # constante do código — é ele quem pode estourar o teto.
        aviso_teto = ''
        if arquivo_regras != self._ARQUIVO_REGRAS_PADRAO and not regras_existe:
            tamanho = len(texto_instrucao_base)
            if tamanho > TETO_AVISO_ARQUIVO_REGRAS:
                aviso_teto = ('O %s vai com %d caracteres, acima do teto de %d que o Antigravity '
                              'costuma ler. Nada será cortado — confira do lado dele se o arquivo '
                              'inteiro foi aproveitado.'
                              % (arquivo_regras, tamanho, TETO_AVISO_ARQUIVO_REGRAS))

        plano = self._preparar_plano_de_pastas(preset, root_folder) if root_folder else []
        grupos = self._preparar_grupos(preset, assistente)
        # `ja_esta` vai SÓ na prévia, numa chave à parte: `itens` continua lista
        # de nomes porque é ela que a execução percorre.
        if root_folder and os.path.isdir(root_folder):
            for g in grupos:
                g['ja_esta'] = {n: self._preparar_item_ja_esta(
                    project_name, g['kind'], n, root_folder, assistente,
                    g['destino'], arquivo_regras) for n in g['itens']}
        return {
            'success': True,
            'root_folder': root_folder or '',
            'root_ok': bool(root_folder) and os.path.isdir(root_folder),
            'preset': preset.get('nome'),
            'preset_erros': erros_preset,
            # O assistente vai junto: a prévia diz para onde as coisas vão, e
            # quem responde isso agora é ele, não o início rápido.
            'assistente': (assistente or {}).get('nome') or '',
            'grupos': grupos,
            'arquivo_regras': arquivo_regras,
            'arquivo_regras_existe': regras_existe,
            # Campo vazio é pulado, não é erro (D36): a prévia precisa dizer que
            # nada será escrito, senão o cartão promete um arquivo que não vem.
            'arquivo_regras_vazio': not texto_instrucao_base.strip(),
            'aviso_teto': aviso_teto,
            'pastas': plano,
        }

    # ⛔ Aqui vivia `_preparar_copiar_flat`, o SEGUNDO caminho de cópia. Ele
    # copiava os `.md` do item achatados e ignorava `formato` e
    # `arquivo_de_entrada` — e a justificativa escrita nele ("achatado é o
    # formato que o assistente espera") só valia para COMANDOS. Para skills o
    # Claude Code quer uma PASTA por item com um `SKILL.md` dentro, e elas
    # chegavam soltas: nada dava erro, e o assistente simplesmente não as via.
    #
    # O Preparar passou a usar `_copiar_item_com_preset`, com
    # `sobrescrever=False`. Um caminho só — dois respondendo a mesma pergunta
    # divergem sempre, e este divergiu no dia em que o formato virou campo.

    def _preparar_copiar_regra(self, project_name, src, item_name):
        """Gêmeo de `_ativar_regra_ou_instrucao`, mas que NÃO sobrescreve.

        O de ativar substitui de propósito (o usuário mandou reativar aquele
        item). Aqui vale o D3: preparar duas vezes não pode desfazer edição
        nenhuma do usuário, então o que já existe fica exatamente como está.
        """
        base = self._regras_base(project_name, criar=True, obrigatorio=False)
        if not base:
            return {'success': False, 'error': 'pasta raiz do projeto não configurada'}
        tipo = self._regras_item_tipo(src)
        nome = item_name.rsplit('/', 1)[-1]
        if not self._regras_arquivos_do_item(src, nome):
            return {'success': False, 'error': 'o molde não tem nenhum arquivo .md'}
        try:
            dest = os.path.join(base, nome)
            if os.path.isdir(dest):
                return {'success': True, 'ja_existia': True, 'tipo': tipo}
            shutil.copytree(src, dest)
        except Exception as e:
            return {'success': False, 'error': str(e)}
        return {'success': True, 'ja_existia': False, 'tipo': tipo}

    def preparar_projeto(self, project_name, preset_nome=None):
        """Um clique: copia a biblioteca, cria as pastas do preset e as marca.

        Ordem fixa, e ela importa: a pasta de trabalho precisa existir antes das
        pastas de dentro dela, e as marcas só podem ser aplicadas depois de as
        pastas terem caminho no disco.

        NÃO passa por `activate_item` de propósito: aquele caminho sobrescreve o
        destino e manda skills e comandos para a MESMA pasta. Os dois são o
        contrário do que o preset e o D3 pedem.
        """
        ws = self.load_workspace(project_name)
        config = ws.get('config', {})
        root_folder = config.get('root_folder')
        if not root_folder or not os.path.isdir(root_folder):
            return {'success': False,
                    'error': 'Configure a pasta raiz do projeto na aba Trabalho primeiro.'}

        preset = self._inicio_rapido(preset_nome or config.get('inicio_rapido'))
        if not preset:
            return {'success': False,
                    'error': 'Nenhum início rápido configurado. Crie um em '
                             'Configurações > Preparar projeto, ou use "Restaurar '
                             'padrão" para trazer os de fábrica de volta.'}
        erros_preset = self.validar_inicio_rapido(preset)
        if erros_preset:
            return {'success': False,
                    'error': 'O início rápido "%s" está incompleto: %s'
                             % (preset.get('nome'), erros_preset[0])}

        res = {'success': True, 'preset': preset.get('nome'), 'grupos': [],
               'arquivo_regras': None, 'pastas': [], 'marcas': [], 'erros': []}
        activated = config.setdefault('activated', {})

        assistente = self._assistente_do_inicio_rapido(preset)
        res['assistente'] = (assistente or {}).get('nome') or ''

        # 1 ── Copiar da biblioteca (só os itens marcados no início rápido)
        for grupo in self._preparar_grupos(preset, assistente):
            kind, destino = grupo['kind'], grupo['destino']
            if kind == 'instrucoes-base':
                # Tratada no passo 2, e só lá: ela é UM arquivo na raiz, com o
                # nome que o assistente pede, e passa pela regra de "nunca
                # sobrescreve" que protege o CLAUDE.md que o usuário editou.
                continue
            copiados, ja_existiam = [], []
            for name in grupo['itens']:
                src = os.path.join(ARQUIVOS_DIR, self._ARQUIVOS_FOLDER[kind], name)
                if not os.path.isdir(src):
                    continue
                if kind == 'regras-instrucoes':
                    r = self._preparar_copiar_regra(project_name, src, name)
                    if not r.get('success'):
                        res['erros'].append('%s: %s' % (name, r.get('error')))
                        continue
                    (ja_existiam if r.get('ja_existia') else copiados).append(name)
                elif kind == 'mcps':
                    servidor = name.strip().lower()
                    if servidor not in self._MCP_SERVIDORES:
                        res['erros'].append('%s: MCP do programa desconhecido.' % name)
                        continue
                    r = self._mcp_registrar(project_name, config, root_folder, destino, servidor)
                    if not r.get('success'):
                        res['erros'].append('%s: %s' % (name, r.get('error')))
                        continue
                    copiados.append(name)
                else:
                    # 🔴 O MESMO CAMINHO DO BOTÃO "LIGAR", e é isso que faz a
                    # skill chegar como `<destino>/<slug>/SKILL.md` em vez de um
                    # `.md` solto. `sobrescrever=False` é a diferença: o Preparar
                    # nunca toca em arquivo que já existe (D3).
                    r = self._copiar_item_com_preset(
                        kind, src, name, root_folder, assistente, sobrescrever=False)
                    if not r.get('success'):
                        res['erros'].append('%s: %s' % (name, r.get('error')))
                        continue
                    (copiados if r.get('copiados') else ja_existiam).append(name)
                lst = activated.setdefault(kind, [])
                if name not in lst:
                    lst.append(name)
            res['grupos'].append({'kind': kind, 'rotulo': grupo['rotulo'], 'destino': destino,
                                  'copiados': copiados, 'ja_existiam': ja_existiam})

        # 2 ── O arquivo de instrução base da raiz: o NOME vem do assistente,
        #      o TEXTO vem do item da biblioteca que o início rápido marcou.
        arquivo_regras, texto_instrucao_base = self._instrucao_base_do_inicio_rapido(
            preset, assistente)
        r = self._criar_arquivo_regras(project_name, arquivo_regras, texto_instrucao_base)
        if r.get('success'):
            res['arquivo_regras'] = {
                'nome': arquivo_regras,
                'acao': {'criado': 'criado',
                         'vazio': 'nada escrito — o preset não tem conteúdo'}.get(
                             r.get('acao'), 'já existia — mantido como está'),
            }
        else:
            res['erros'].append('%s: %s' % (arquivo_regras, r.get('error')))

        # 3, 4 e 5 ── As pastas, na ordem do plano (a de trabalho antes das de dentro)
        ignore_list = config.setdefault('ignore_list', [])
        context_items = config.setdefault('context_items', [])
        working = config.setdefault('working_folders', [])
        for item in self._preparar_plano_de_pastas(preset, root_folder):
            criada = False
            if not os.path.isdir(item['path']):
                try:
                    os.makedirs(item['path'], exist_ok=True)
                    criada = True
                except Exception as e:
                    res['erros'].append('%s: %s' % (item['rel'], e))
                    continue
            res['pastas'].append({'rel': item['rel'], 'destino': item['destino'],
                                  'path': item['path'], 'criada': criada})

            if item.get('pasta_de_trabalho') and item['path'] not in working:
                working.append(item['path'])

            # 6 ── As marcas. Independentes: as duas marcadas entram nas duas
            #      listas. Item cujo `path` já esteja lá não é duplicado.
            if item['remover'] and not any(i.get('path') == item['path'] for i in ignore_list):
                ignore_list.append({'path': item['path'], 'type': 'folder', 'recursive': True})
                res['marcas'].append({'rel': item['rel'], 'marca': 'remover'})
            if item['contexto'] and not any(i.get('path') == item['path'] for i in context_items):
                context_items.append({'path': item['path'], 'description': item['descricao']})
                res['marcas'].append({'rel': item['rel'], 'marca': 'contexto'})

        config['inicio_rapido'] = preset.get('nome')
        # D10: o assistente do início rápido vira o do PROJETO. É ele que a aba
        # Arquivos usa para ligar item a item daqui em diante — sem isto, o
        # usuário prepara com o Cursor e o botão de copiar continua mandando
        # para `.claude/`, sem nenhum aviso de que discordam.
        if assistente:
            config['assistente_externo'] = assistente.get('nome')
        self.save_workspace(project_name, config)
        return res

    # Nome de fábrica do arquivo de regras da raiz. Só vale quando o preset não
    # diz nada; o Preparar sempre passa o nome do preset, que pode ser AGENTS.md.
    _ARQUIVO_REGRAS_PADRAO = 'CLAUDE.md'

    def _criar_arquivo_regras(self, project_name, nome_arquivo, conteudo):
        """Cria o arquivo de regras da raiz com o texto do preset. Só isso.

        Três saídas, e a regra inteira cabe numa frase: **tem texto e o arquivo
        não existe → cria; qualquer outra coisa → não faz nada.**

            'vazio'      o início rápido não marcou nenhum item de Instruções
                         base — pulado, não é erro, a mesma regra de campo
                         vazio dos destinos (D36)
            'ja_existia' o arquivo está lá e fica EXATAMENTE como está
            'criado'     escreveu

        ⚠️ NÃO reescreve, NÃO apenda, NÃO pergunta. O Preparar é um ato de
        partida, não uma sincronização contínua — o usuário roda uma vez por
        projeto e edita o arquivo à mão dali em diante (D4). Qualquer coisa que
        toque um arquivo existente apagaria edição dele em silêncio.

        ⚠️ O TEXTO NÃO MORA AQUI, e já mudou de casa duas vezes. Era uma
        constante deste módulo (`_claude_md_base`), igual para os três presets;
        virou o campo `conteudo_regras` do preset (D1/D7); e desde 2026-09-02 é
        um ITEM DA BIBLIOTECA, em `Arquivos/Instruções base/`, escolhido pelo
        início rápido. Texto é conteúdo do usuário, e conteúdo do usuário mora
        na biblioteca — nem no código, nem dentro de uma chave de configuração.
        Nada neste método monta, completa ou corrige o que ele escreveu.
        """
        if not (conteudo or '').strip():
            return {'success': True, 'acao': 'vazio'}
        nome_arquivo = (nome_arquivo or '').strip() or self._ARQUIVO_REGRAS_PADRAO
        try:
            root_folder = self.load_workspace(project_name).get('config', {}).get('root_folder')
        except Exception:
            return {'success': False, 'error': 'workspace indisponível'}
        if not root_folder or not os.path.isdir(root_folder):
            return {'success': False, 'error': 'pasta raiz do projeto não configurada'}
        caminho = os.path.join(root_folder, nome_arquivo)
        if os.path.isfile(caminho):
            return {'success': True, 'acao': 'ja_existia'}
        try:
            os.makedirs(os.path.dirname(caminho) or root_folder, exist_ok=True)
            with open(caminho, 'w', encoding='utf-8') as f:
                f.write(conteudo)
        except Exception as e:
            return {'success': False, 'error': str(e)}
        return {'success': True, 'acao': 'criado'}
