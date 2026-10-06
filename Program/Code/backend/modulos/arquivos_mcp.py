"""Os dois servidores MCP DO PROGRAMA dentro do projeto do usuário.

A categoria `mcps` da biblioteca é a única cujo "ligar" não copia pasta nenhuma:
ele MESCLA uma entrada no arquivo de configuração de MCP do projeto, preservando
o que já estiver lá. É outro verbo, com outro formato e outra forma de desfazer
— e é por isso que ela fica fora de `_ARQUIVOS_COM_PRESET` e tem arquivo próprio
aqui, em vez de um `if` no meio de `arquivos_copia.py`.

O que este arquivo guarda, e por que cada coisa é DERIVADA e não escrita à mão:

    · `_MCP_TOOLS` e `_MCP_SERVIDOR_DA_FERRAMENTA` saem de `catalogo_mcp.py`.
      Era uma lista literal, e foi a armadilha nº 1 desta parte do programa:
      ferramenta que existisse no `TOOLS` do servidor e não na lista SUMIA do
      MCP no instante em que o usuário desligasse qualquer outra — porque é ela
      que monta o `--enabled`, e enquanto tudo está ligado o `--enabled` sai
      vazio e o defeito não aparece.
    · `_MCP_SERVIDORES` diz a chave gravada, o entry point e as ferramentas de
      cada um dos dois. O nome do item na biblioteca (`Arquivos/MCPs/Assistente`)
      é o mesmo texto em minúsculas, e a conversão está em `activate_item`.
    · `_mcp_limite` é o ponto ÚNICO de leitura dos limites, gêmeo de
      `_sub_limite` em `agentes/ferramentas_subagentes.py`.

⚠️ ONDE O ARQUIVO DE MCP FICA NÃO É DECISÃO DAQUI: vem do preset do assistente
externo (`_destino_do_mcp`), porque o Cursor procura em `.cursor/mcp.json` e o
Codex nem usa JSON. Destino `''` quer dizer "este assistente não registra MCP
por arquivo" e é PULADO, não é erro — escrever um JSON com aquele nome daria um
arquivo que ninguém lê.
"""

from .constantes import *


class ArquivosMcpMixin:

    # ── Servidor MCP do programa (registro por projeto + toggles) ─────────────
    # ⚠️ Era uma lista literal, e foi a armadilha nº 1 desta parte do programa:
    # ferramenta que existisse no `TOOLS` do servidor e não aqui SUMIA do MCP no
    # instante em que o usuário desligasse qualquer outra — porque é esta lista
    # que monta o `--enabled` logo abaixo, e enquanto tudo está ligado o
    # `--enabled` sai vazio e o defeito não aparece. Hoje deriva do catálogo
    # único (`modulos/catalogo_mcp.py`), e a divergência deixou de ser possível.
    # Todas as 27, para a tela de ligar/desligar por ferramenta (Configurações
    # → Servidores MCP do programa) — o toggle é por ferramenta, não por
    # servidor, então a tela continua vendo a lista inteira.
    _MCP_TOOLS = list(IDS_DAS_FERRAMENTAS_MCP)

    # Qual servidor expõe cada ferramenta — derivado do catálogo, nunca escrito
    # à mão (mesma razão de `_MCP_TOOLS` ser derivado: ferramenta nova não pode
    # exigir lembrar de um segundo lugar).
    _MCP_SERVIDOR_DA_FERRAMENTA = {f['name']: f['servidor'] for f in CATALOGO_MCP}

    # Os dois servidores do programa: a chave gravada no `.mcp.json`, o
    # caminho do entry point (relativo a `CODE_DIR`) e as ferramentas de cada
    # um. O nome do item na biblioteca (`Arquivos/MCPs/Assistente` ou
    # `.../Trabalhos`) é o mesmo texto em minúsculas — ver `activate_item`/
    # `deactivate_item`, que fazem essa conversão.
    _MCP_SERVIDORES = {
        'assistente': {
            'chave': 'assistente',
            'script_rel': os.path.join('server', 'assistente', 'servidor.py'),
            'tools': [f['name'] for f in CATALOGO_MCP if f['servidor'] == 'assistente'],
        },
        'trabalhos': {
            'chave': 'trabalhos',
            'script_rel': os.path.join('server', 'trabalhos', 'servidor.py'),
            'tools': [f['name'] for f in CATALOGO_MCP if f['servidor'] == 'trabalhos'],
        },
    }

    def _mcp_enabled_csv(self, config, servidor):
        """CSV das ferramentas ligadas DESTE servidor; '' quando todas ele expõe."""
        fns = config.get('mcp_functions') or {}
        tools = self._MCP_SERVIDORES[servidor]['tools']
        enabled = [t for t in tools if fns.get(t, True)]
        if len(enabled) == len(tools):
            return ''
        return ','.join(enabled)

    _MCP_ARQUIVO_PADRAO = '.mcp.json'

    def _mcp_registrar(self, project_name, config, root_folder, destino_rel=None, servidor='assistente'):
        """Escreve/mescla a entrada de UM servidor no .mcp.json do projeto (preserva outras).

        `destino_rel` vem do preset do Preparar: o Cursor procura o arquivo em
        `.cursor/mcp.json`, não na raiz. Sem ele, vale o de sempre.
        """
        info = self._MCP_SERVIDORES[servidor]
        script = os.path.join(CODE_DIR, info['script_rel'])
        entry = {'command': 'python', 'args': [script, '--project', project_name]}
        enabled = self._mcp_enabled_csv(config, servidor)
        if enabled:
            entry['args'] += ['--enabled', enabled]
        path = self._juntar_relativo(root_folder, destino_rel) or os.path.join(
            root_folder, self._MCP_ARQUIVO_PADRAO)
        if not self._dentro_da_raiz(root_folder, path):
            return {'success': False, 'error': 'destino do MCP fora da pasta raiz.'}
        os.makedirs(os.path.dirname(path) or root_folder, exist_ok=True)
        data = {}
        if os.path.isfile(path):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                if not isinstance(data, dict):
                    data = {}
            except Exception:
                data = {}
        servers = data.setdefault('mcpServers', {})
        # Migração: projeto que ligou o MCP antes da divisão em dois servidores
        # tem a chave antiga 'vibe-coding' — ela virava o servidor Assistente
        # (as 19 ferramentas de leitura, que são a maioria das que existiam).
        if servidor == 'assistente':
            servers.pop('vibe-coding', None)
        servers[info['chave']] = entry
        try:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            return {'success': False, 'error': str(e)}
        return {'success': True}

    def _destino_do_mcp(self, config):
        """O caminho do arquivo de MCP, no preset da aba Arquivos deste projeto.

        `''` quer dizer "este assistente não registra MCP por arquivo JSON" — é o
        caso do Codex, que guarda em TOML, e escrever um JSON com aquele nome
        daria um arquivo que ele não lê. `None` quer dizer que não há preset nenhum.
        """
        preset = self._assistente_externo(config.get('assistente_externo'))
        if not preset:
            return None
        return self._categoria_do_assistente(preset, 'mcps')['destino']

    def _mcp_desregistrar(self, root_folder, destino_rel=None, servidor='assistente'):
        """Remove a entrada de UM servidor do .mcp.json (preserva os outros)."""
        path = self._juntar_relativo(root_folder, destino_rel) or os.path.join(
            root_folder, self._MCP_ARQUIVO_PADRAO)
        if not os.path.isfile(path):
            return
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            servers = data.get('mcpServers', {})
            chave = self._MCP_SERVIDORES[servidor]['chave']
            removeu = False
            if chave in servers:
                del servers[chave]
                removeu = True
            # Migração: a chave antiga 'vibe-coding' (servidor único, antes da
            # divisão) só existia para o que hoje é o servidor Assistente.
            if servidor == 'assistente' and 'vibe-coding' in servers:
                del servers['vibe-coding']
                removeu = True
            if removeu:
                if servers:
                    with open(path, 'w', encoding='utf-8') as f:
                        json.dump(data, f, ensure_ascii=False, indent=2)
                else:
                    os.remove(path)
        except Exception:
            pass

    def get_mcp_functions(self, project_name):
        ws = self.load_workspace(project_name)
        config = ws.get('config', {})
        fns = config.get('mcp_functions') or {}
        return {'success': True, 'tools': self._MCP_TOOLS,
                'functions': {t: fns.get(t, True) for t in self._MCP_TOOLS}}

    def _mcp_limite(self, chave):
        """Um limite da categoria "Servidores MCP do programa", de `settings.json`.

        O ponto ÚNICO de leitura, gêmeo de `_sub_limite`
        (`agentes/ferramentas_subagentes.py`). O padrão de fábrica vem de
        `PADROES_DO_MCP`, e valor ausente ou lixo cai nele — nunca num número
        escrito à mão no ponto de uso, que era o estado anterior (o `3` da
        cascata e o `8` da busca semântica, dentro do antigo `ferramentas_mcp.py`).

        ⚠️ Quem chama isto é o PROCESSO DO SERVIDOR MCP, que instancia a `Api`
        inteira (`servidor.py::_bootstrap_api`) e portanto lê o `settings.json`
        sozinho. Os limites NÃO precisam viajar por argumento de linha de
        comando como o `--enabled`.
        """
        padrao = PADROES_DO_MCP[chave]
        try:
            valor = int(self.load_settings()['settings'].get(chave, padrao))
        except (TypeError, ValueError, KeyError):
            return padrao
        return valor if valor >= 1 else padrao

    def padroes_do_mcp(self):
        """Os padrões de fábrica, para a tela mostrar o "Restaurar padrão"."""
        return {'success': True, 'padroes': dict(PADROES_DO_MCP)}

    def catalogo_ferramentas_mcp(self, servidor=None):
        """A tabela da aba Arquivos → MCPs, gerada do catálogo.

        Mesmo desenho de `catalogo_ferramentas` (a tabela dos subagentes): a
        tela não guarda cópia nenhuma da lista, ela pede. Era um array literal
        no `arquivos-preview.js` que precisava concordar, letra por letra, com
        o `TOOLS` do servidor — e não concordava.

        `servidor` ('assistente' ou 'trabalhos') filtra a tabela para só as
        ferramentas daquele servidor — é o que faz o item "Assistente" mostrar
        19 linhas e o item "Trabalhos" mostrar 8, em vez das 27 sempre juntas.
        Sem o parâmetro, devolve as 27 (uso interno/depuração).
        """
        tabela = catalogo_para_tela()
        if servidor in ('assistente', 'trabalhos'):
            tabela = [f for f in tabela if f.get('servidor') == servidor]
        return {'success': True,
                'ferramentas': tabela,
                'familias': FAMILIAS_DAS_FERRAMENTAS_MCP}

    def set_mcp_function(self, project_name, tool, on):
        if tool not in self._MCP_TOOLS:
            return {'success': False, 'error': 'Ferramenta inválida.'}
        ws = self.load_workspace(project_name)
        config = ws.get('config', {})
        config.setdefault('mcp_functions', {})[tool] = bool(on)
        root_folder = config.get('root_folder')
        # Só o servidor DONO desta ferramenta precisa reescrever o `.mcp.json`
        # (e só se ele estiver ativado neste projeto) — mexer no toggle de uma
        # ferramenta de Trabalhos não deve reescrever a entrada do Assistente.
        servidor = self._MCP_SERVIDOR_DA_FERRAMENTA.get(tool)
        ativos = config.get('activated', {}).get('mcps') or []
        if (root_folder and os.path.isdir(root_folder) and servidor
                and self._MCP_SERVIDORES[servidor]['chave'].capitalize() in ativos):
            self._mcp_registrar(project_name, config, root_folder,
                                self._destino_do_mcp(config), servidor)
        self.save_workspace(project_name, config)
        return {'success': True}
