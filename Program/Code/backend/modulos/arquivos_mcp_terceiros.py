"""Instalar um MCP de terceiro num projeto: a cópia da pasta e a entrada.

Uma pergunta só: **o que acontece quando o usuário clica em ligar?** Quem lê e
valida o `mcp.json` é o irmão, `arquivos_mcp_manifesto.py` — e é de lá que vêm
as constantes e a derivação da entrada.

⛔ **Os dois do programa não passam por aqui, e não podem passar.** `activate_item`
só chega neste módulo quando `origem != 'programa'`. Uniformizar os dois caminhos
mexeria em código que funciona sem ninguém ter pedido — e os dois do programa não
têm manifesto, não têm cópia e registram por `_MCP_SERVIDORES`.

── A ordem do ligar, e por que ela é essa ──
Validar → copiar → carimbar → montar → mesclar. O registro é o ÚLTIMO passo, e
qualquer falha antes dele desfaz a cópia: assim nunca sobra apontador para uma
pasta que não existe, nem cópia órfã sem apontador.

⚠️ **MESCLAR, NUNCA SOBRESCREVER.** O arquivo de registro é compartilhado com o
Assistente e o Trabalhos daquele projeto. Reescrevê-lo inteiro apagaria os dois.

⚠️ **DESLIGAR APAGA A CÓPIA** — o contrário do que o verbete "Molde e cópia" do
`Vocabulário.md` estabelece para regra e instrução. A exceção está registrada em
`Saída das skills/Terminologia e nomenclatura/Exceções.md`, e vem com o
mitigador: cópia DIFERENTE do molde não é apagada sem confirmação do usuário.
"""

from .constantes import *
# As constantes e a leitura do manifesto moram no irmão, e são importadas dele
# pelo nome: `MCP_MANIFESTO` e `MCP_NAO_COPIAR` começam sem `_`, mas um
# `import *` aqui traria de volta tudo que `constantes` já trouxe.
from .arquivos_mcp_manifesto import MCP_MANIFESTO, MCP_NAO_COPIAR

import filecmp
import shutil as _shutil


class ArquivosMcpTerceirosMixin:

    # ── A cópia da pasta ─────────────────────────────────────────────────────

    def _mcp3_destino_da_pasta(self):
        """A pasta, dentro do projeto, onde a cópia é feita. De Configurações."""
        try:
            bruto = self.load_settings()['settings'].get('mcps_destino_da_pasta')
        except Exception:
            bruto = None
        bruto = str(bruto or '').strip().replace('\\', '/').strip('/')
        return bruto or PADROES_DOS_MCPS['mcps_destino_da_pasta']

    def _mcp3_pasta_da_copia(self, root_folder, item_name):
        """`{raiz}/{destino}/{Nome do item}` — o nome do item COMO ESTÁ.

        ⚠️ Aqui NÃO se normaliza o nome, e é a diferença que impede reusar o
        `_copiar_item_com_preset` cru: skill e comando viram slug porque o
        assistente os DESCOBRE por nome de pasta. O MCP não é descoberto — o
        apontador guarda o caminho por extenso —, então `Outros projetos`
        continua `Outros projetos`, com espaço e maiúscula.
        """
        rotulo = item_name.rsplit('/', 1)[-1]
        destino = self._mcp3_destino_da_pasta()
        return os.path.normpath(os.path.join(
            root_folder, *destino.split('/'), rotulo))

    @staticmethod
    def _mcp3_ignorar(_dir, nomes):
        return [n for n in nomes if n in MCP_NAO_COPIAR or n.endswith('.pyc')]

    def _mcp3_copiar(self, src, alvo):
        """A pasta do molde para dentro do projeto. Devolve o erro, ou `None`.

        ⛔ NUNCA move, e NUNCA toca a origem: o que está em `Arquivos/` é a
        biblioteca do usuário. Ligar usa sobrescrita, como o botão de ligar das
        outras categorias — o gesto do usuário é "reativar este item".
        """
        try:
            if os.path.isdir(alvo):
                _shutil.rmtree(alvo)
            os.makedirs(os.path.dirname(alvo) or alvo, exist_ok=True)
            _shutil.copytree(src, alvo, ignore=self._mcp3_ignorar)
        except Exception as e:
            return str(e)
        return None

    def _mcp3_carimbar_pasta_do_programa(self, alvo):
        """Escreve `pasta_do_programa` no `mcp.json` DA CÓPIA.

        ⚠️ É por este campo que um servidor autocontido acha os dados que o
        programa gerou. Ele nasce `""` no molde e só ganha valor aqui: o molde
        vai para o Git do usuário, e um caminho de máquina escrito nele quebra
        na primeira vez que a pasta do programa muda de lugar — e há duas
        pastas deste programa hoje, uma com "- backup" no nome.
        """
        path = os.path.join(alvo, MCP_MANIFESTO)
        try:
            with open(path, 'r', encoding='utf-8') as f:
                dados = json.load(f)
            dados['pasta_do_programa'] = os.path.abspath(
                os.path.join(CODE_DIR, '..', '..'))
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(dados, f, ensure_ascii=False, indent=2)
        except Exception as e:
            return str(e)
        return None

    def _mcp3_copia_foi_editada(self, src, alvo):
        """A cópia difere do molde? — o mitigador do "desligar apaga".

        ⚠️ O `mcp.json` fica FORA da comparação de propósito: o programa mesmo o
        reescreve na cópia (o `pasta_do_programa`), então ele SEMPRE difere. Sem
        esta exceção, desligar qualquer MCP pediria confirmação sempre, e a
        pergunta viraria ruído que o usuário aprende a confirmar sem ler.
        """
        if not os.path.isdir(alvo) or not os.path.isdir(src):
            return False
        return self._mcp3_arvores_diferem(src, alvo)

    def _mcp3_arvores_diferem(self, a, b):
        cmp = filecmp.dircmp(a, b, ignore=list(MCP_NAO_COPIAR) + [MCP_MANIFESTO])
        if cmp.left_only or cmp.right_only or cmp.funny_files:
            return True
        _iguais, diferentes, erros = filecmp.cmpfiles(
            a, b, cmp.common_files, shallow=False)
        if diferentes or erros:
            return True
        for sub in cmp.common_dirs:
            if self._mcp3_arvores_diferem(os.path.join(a, sub), os.path.join(b, sub)):
                return True
        return False

    # ── O registro: mesclar e desmesclar ─────────────────────────────────────

    def _mcp3_caminho_do_registro(self, root_folder, destino_rel):
        path = self._juntar_relativo(root_folder, destino_rel) or os.path.join(
            root_folder, self._MCP_ARQUIVO_PADRAO)
        if not self._dentro_da_raiz(root_folder, path):
            return None
        return path

    def _mcp3_gravar(self, chave, entry, root_folder, destino_rel):
        """MESCLA a entrada no arquivo de registro, preservando as outras.

        ⚠️ Reescrever o arquivo inteiro apagaria o Assistente e o Trabalhos
        daquele projeto — eles moram no mesmo JSON, sob outras chaves.
        """
        path = self._mcp3_caminho_do_registro(root_folder, destino_rel)
        if not path:
            return 'destino do MCP fora da pasta raiz.'
        try:
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
            data.setdefault('mcpServers', {})[chave] = entry
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            return str(e)
        return None

    def _mcp3_apagar_do_registro(self, chave, root_folder, destino_rel):
        """Tira SÓ esta chave. O arquivo só some quando não sobra servidor nenhum."""
        path = self._mcp3_caminho_do_registro(root_folder, destino_rel)
        if not path or not os.path.isfile(path):
            return
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            servers = data.get('mcpServers', {})
            if chave not in servers:
                return
            del servers[chave]
            if servers:
                with open(path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
            else:
                os.remove(path)
        except Exception:
            pass

    # ── Ligar e desligar, na ordem que não deixa sobra ───────────────────────

    def _mcp3_ligar(self, project_name, config, item_name, src, root_folder):
        """O caminho inteiro do "ligar" de um MCP de terceiro.

        A ordem é o contrato: validar → copiar → carimbar → montar → mesclar.
        Falha depois da cópia DESFAZ a cópia, para nunca sobrar pasta órfã; e
        como o registro é o último passo, nunca sobra apontador para o vazio.
        """
        dados, erro = self._mcp3_ler_manifesto(src)
        if erro:
            return {'success': False, 'error': erro}
        erro = self._mcp3_validar(dados, item_name, src)
        if erro:
            return {'success': False, 'error': erro}

        destino_rel = self._destino_do_mcp(config)
        if destino_rel is None:
            return {'success': False, 'error':
                    'Nenhum preset de arquivos configurado. Vá em Configurações > '
                    'Arquivos e crie um antes de ligar.'}
        if not destino_rel:
            return {'success': False, 'error':
                    'O preset deste projeto não registra MCP por arquivo — '
                    'este assistente guarda a configuração de MCP em outro formato.'}

        alvo = self._mcp3_pasta_da_copia(root_folder, item_name)
        if not self._dentro_da_raiz(root_folder, alvo):
            return {'success': False, 'error':
                    'O destino da pasta dos MCPs sai da raiz do projeto. Confira '
                    'Configurações → Servidores MCP.'}

        erro = self._mcp3_copiar(src, alvo)
        if erro:
            return {'success': False, 'error': 'Não deu para copiar a pasta: %s' % erro}

        def _desfazer():
            try:
                _shutil.rmtree(alvo)
            except Exception:
                pass

        erro = self._mcp3_carimbar_pasta_do_programa(alvo)
        if erro:
            _desfazer()
            return {'success': False,
                    'error': 'Não deu para preencher o %s da cópia: %s'
                             % (MCP_MANIFESTO, erro)}

        entry, erro = self._mcp3_entrada(
            dados, alvo.replace('\\', '/'),
            self._mcp3_extras(dados, config, item_name))
        if erro:
            _desfazer()
            return {'success': False, 'error': erro}

        erro = self._mcp3_gravar(self._mcp3_chave(item_name), entry,
                                 root_folder, destino_rel)
        if erro:
            _desfazer()
            return {'success': False, 'error': erro}

        return {'success': True,
                'message': 'MCP "%s" instalado em %s e registrado em %s (chave "%s"). '
                           'Vale na próxima sessão do assistente externo.'
                           % (item_name.rsplit('/', 1)[-1],
                              os.path.relpath(alvo, root_folder).replace(os.sep, '/'),
                              destino_rel, self._mcp3_chave(item_name))}

    def _mcp3_desligar(self, config, item_name, src, root_folder, confirmado=False):
        """Tira a entrada e APAGA a cópia — nessa ordem.

        ⚠️ A ordem é inversa à do ligar pelo mesmo motivo: se apagar a pasta
        falhar, não sobra apontador para o vazio.

        ⚠️ **APAGAR A CÓPIA CONTRARIA O VERBETE "Molde e cópia"**, e é decisão
        do usuário: a cópia de um servidor é código gerado, não texto que ele
        edita. O mitigador é este `confirmado`: cópia DIFERENTE do molde não é
        apagada sem ele. Sem isso, uma edição do usuário sumiria sem aviso — o
        dano exato que o verbete existe para impedir.
        """
        self._mcp3_apagar_do_registro(self._mcp3_chave(item_name), root_folder,
                                      self._destino_do_mcp(config))
        alvo = self._mcp3_pasta_da_copia(root_folder, item_name)
        if not os.path.isdir(alvo):
            return {'success': True}
        if not confirmado and src and self._mcp3_copia_foi_editada(src, alvo):
            return {'success': False, 'precisa_confirmar': True,
                    'pasta': os.path.relpath(alvo, root_folder).replace(os.sep, '/'),
                    'error': 'A cópia deste MCP dentro do projeto está DIFERENTE do '
                             'molde da biblioteca — alguém a editou. Desligar apaga '
                             'a pasta e essas mudanças somem. Confirme para apagar '
                             'mesmo assim, ou copie o que interessa antes.'}
        try:
            _shutil.rmtree(alvo)
        except Exception as e:
            return {'success': False, 'error': 'A entrada foi removida do registro, '
                                               'mas a pasta não deu para apagar: %s' % e}
        return {'success': True}

    # ── A fronteira com a tela ───────────────────────────────────────────────

    def mcp_manifesto(self, item_name):
        """O que a aba Arquivos → MCPs precisa para desenhar a tela deste item.

        ⚠️ `tem_configuracao: False` NÃO é erro — é o item que só liga e desliga,
        que é o caso da maioria dos MCPs de internet.
        """
        src = self._arquivos_caminho_do_item('mcps', item_name)
        if not src:
            return {'success': False, 'error': 'Item não encontrado.'}
        dados, erro = self._mcp3_ler_manifesto(src)
        if erro:
            return {'success': False, 'error': erro}
        campos = self._mcp3_campos(dados)
        for campo in campos:
            campo['opcoes'] = self._mcp3_opcoes_do_campo(campo)
        ferramentas = self._mcp3_ferramentas_declaradas(dados)
        return {
            'success': True,
            'nome': dados.get('nome'),
            'versao': dados.get('versao'),
            'descricao': dados.get('descricao'),
            'tipo': str(dados.get('tipo') or '').lower(),
            'chave': self._mcp3_chave(item_name),
            'ferramentas': ferramentas,
            # ⚠️ É ISTO que a tela lê para decidir se desenha as caixinhas.
            # Servidor que não sabe receber a lista mostra as ferramentas SEM
            # elas — marcar ali não teria para onde ir.
            'pode_marcar_ferramentas': bool(ferramentas
                                            and self._mcp3_como_recebe_ligadas(dados)),
            'campos': campos,
            'tem_configuracao': bool(ferramentas or campos),
        }

    def get_mcp_terceiro_config(self, project_name, item_name):
        """Os valores deste item NESTE projeto: campos e ferramentas ligadas."""
        config = self.load_workspace(project_name).get('config', {})
        return {'success': True,
                'valores': self._mcp3_valores(config, item_name),
                'ferramentas': self._mcp3_ligadas(config, item_name)}

    def set_mcp_terceiro_config(self, project_name, item_name, chave, valor):
        """Grava um campo e RE-REGISTRA, se o item estiver ligado neste projeto."""
        ws = self.load_workspace(project_name)
        config = ws.get('config', {})
        config.setdefault('mcps_config', {}).setdefault(item_name, {})[chave] = valor
        r = self._mcp3_reaplicar(project_name, config, item_name)
        self.save_workspace(project_name, config)
        return r

    def set_mcp_terceiro_ferramenta(self, project_name, item_name, ferramenta, on):
        ws = self.load_workspace(project_name)
        config = ws.get('config', {})
        (config.setdefault('mcps_ferramentas', {})
               .setdefault(item_name, {})[ferramenta]) = bool(on)
        r = self._mcp3_reaplicar(project_name, config, item_name)
        self.save_workspace(project_name, config)
        return r

    def _mcp3_reaplicar(self, project_name, config, item_name):
        """Reescreve a entrada do registro depois de mudar a configuração.

        ⚠️ Só mexe se o item estiver LIGADO neste projeto: mudar um campo de um
        MCP desligado grava a escolha e não cria entrada nenhuma — ligar depois
        é que a leva junto.
        """
        ativos = (config.get('activated', {}) or {}).get('mcps') or []
        if item_name not in ativos:
            return {'success': True}
        root_folder = config.get('root_folder')
        src = self._arquivos_caminho_do_item('mcps', item_name)
        if not (root_folder and os.path.isdir(root_folder) and src):
            return {'success': True}
        dados, erro = self._mcp3_ler_manifesto(src)
        if erro:
            return {'success': False, 'error': erro}
        alvo = self._mcp3_pasta_da_copia(root_folder, item_name)
        entry, erro = self._mcp3_entrada(
            dados, alvo.replace('\\', '/'),
            self._mcp3_extras(dados, config, item_name))
        if erro:
            return {'success': False, 'error': erro}
        erro = self._mcp3_gravar(self._mcp3_chave(item_name), entry, root_folder,
                                 self._destino_do_mcp(config))
        return {'success': True} if not erro else {'success': False, 'error': erro}

    def padroes_dos_mcps(self):
        """Os padrões de fábrica da categoria Configurações → Servidores MCP."""
        return {'success': True, 'padroes': dict(PADROES_DOS_MCPS)}
