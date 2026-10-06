"""O que o `mcp.json` de um MCP de terceiro diz — ler, validar e derivar.

Uma pergunta só: **o manifesto está de pé, e o que ele manda escrever?** Quem
COPIA a pasta e MEXE no arquivo de registro é o irmão, `arquivos_mcp_terceiros.py`;
quem registra os dois servidores DO PROGRAMA é `arquivos_mcp.py`, que não tem
manifesto nenhum e não passa por aqui.

── O que uma pasta precisa ter para SER um MCP ──
`mcp.json` na raiz, e só. É a mesma regra do `extensao.json` das extensões e do
`plugin.json` dos plugins — não uma terceira invenção.

⚠️ **O FORMATO DO REGISTRO É DERIVADO DO `tipo`, nunca escrito no manifesto.**
`local` e `comando` viram `{command, args, env}`; `remoto` vira
`{type, url, headers}`. Deixar o autor do manifesto escrever `command`/`url` à
mão criaria um segundo formato para o programa ter de entender — e um manifesto
que diz `remoto` e escreve `command` não teria como ser recusado com sentido.

⚠️ **A DIFERENÇA ENTRE `local` E `comando` É QUEM TEM O CÓDIGO**, e ela existe
só para VALIDAR: no `local` o servidor está na pasta e vai junto na cópia; no
`comando` a pasta só tem o manifesto e a descrição, e o servidor é baixado na
hora pelo `npx`/`docker`. Para o registro os dois são idênticos.

⚠️ **O MOLDE NUNCA GUARDA SENHA.** Só `${NOME_DA_VARIAVEL}`, resolvido pela
variável de ambiente de mesmo nome na hora de gravar o registro. O molde é
copiado para dentro de todo projeto onde for ligado, e projeto vai para o Git —
um token escrito no manifesto vaza para todos eles de uma vez. Por isso um valor
literal num cabeçalho de autenticação é RECUSADO, e não apenas desaconselhado.

⚠️ **`${PASTA}` existe porque o manifesto não pode ter caminho de máquina
escrito dentro.** Há duas pastas deste programa hoje, uma com "- backup" no
nome, e o molde precisa sobreviver a isso. Ele resolve para a pasta da CÓPIA
dentro do projeto — nunca a do molde.

⚠️ **AS CONSTANTES MORAM AQUI**, e o irmão as importa deste endereço. Uma
segunda cópia de `MCP_MANIFESTO` ou de `MCP_NAO_COPIAR` divergiria no primeiro
dia em que alguém mexesse numa delas, e o sintoma seria uma pasta que a
validação enxerga e a cópia ignora.
"""

from .constantes import *

import shutil as _shutil


# O nome do manifesto. Uma pasta em `Arquivos/MCPs/` É um MCP se tiver este
# arquivo na raiz — mesma gramática do `extensao.json`.
MCP_MANIFESTO = 'mcp.json'

# Os três tipos, e só eles. Um quarto exigiria um quarto formato de registro,
# que é justamente o que a derivação por tipo existe para impedir.
MCP_TIPOS = ('local', 'comando', 'remoto')

# Os transportes do tipo `remoto`, como os assistentes os nomeiam no registro.
MCP_TRANSPORTES = ('http', 'sse')

# Cabeçalhos em que um valor literal é senha até prova em contrário. A lista é
# por SUBSTRING e em minúsculas: `X-Api-Key`, `Authorization` e `Proxy-Token`
# caem nos três primeiros sem precisar de entrada própria.
MCP_CABECALHOS_DE_SEGREDO = ('authorization', 'api-key', 'apikey', 'token',
                             'secret', 'password', 'senha', 'bearer')

# O que nunca vai junto na cópia: lixo de execução, não conteúdo do item.
MCP_NAO_COPIAR = ('__pycache__', '.git', '.svn', 'node_modules', '.venv',
                  '.pytest_cache', '.mypy_cache')

# Os tipos de campo que o bloco opcional de configuração aceita. `varios` é o
# que a Obra 2 usa para escolher quais projetos podem ser consultados.
MCP_TIPOS_DE_CAMPO = ('texto', 'numero', 'marcar', 'escolher', 'varios')

# As fontes de opção que o PROGRAMA preenche. Hoje uma só: a lista de projetos
# cadastrados. Um campo com `opcoes` escrito à mão não usa nada disto.
MCP_OPCOES_DINAMICAS = ('projetos',)


class ArquivosMcpManifestoMixin:

    # ── O manifesto ──────────────────────────────────────────────────────────

    def _mcp3_manifesto_path(self, src):
        return os.path.join(src, MCP_MANIFESTO)

    def _mcp3_ler_manifesto(self, src):
        """`(dados, erro)`. O erro já vem escrito para o usuário ler na tela."""
        path = self._mcp3_manifesto_path(src)
        if not os.path.isfile(path):
            return None, ('"%s" não tem o arquivo %s na raiz, então não é um MCP. '
                          'Veja Arquivos → Como adicionar → MCPs.'
                          % (os.path.basename(src), MCP_MANIFESTO))
        try:
            with open(path, 'r', encoding='utf-8') as f:
                dados = json.load(f)
        except Exception as e:
            return None, 'O %s de "%s" não é um JSON válido: %s' % (
                MCP_MANIFESTO, os.path.basename(src), e)
        if not isinstance(dados, dict):
            return None, 'O %s precisa ser um objeto JSON.' % MCP_MANIFESTO
        return dados, None

    def _mcp3_validar(self, dados, item_name, src):
        """A mensagem de erro, ou `None` quando o manifesto está de pé.

        ⚠️ O erro SEMPRE diz qual campo está errado. "Manifesto inválido" manda
        o usuário abrir o arquivo e comparar com a documentação linha a linha —
        e o campo faltando costuma ser o que ele acabou de digitar errado.
        """
        rotulo = item_name.rsplit('/', 1)[-1]
        for campo in ('nome', 'versao', 'descricao', 'tipo'):
            if not str(dados.get(campo) or '').strip():
                return 'O %s de "%s" está sem o campo obrigatório "%s".' % (
                    MCP_MANIFESTO, rotulo, campo)

        if str(dados['nome']).strip() != rotulo:
            return ('O campo "nome" do %s diz "%s", mas a pasta se chama "%s". '
                    'Os dois precisam bater.' % (MCP_MANIFESTO,
                                                 str(dados['nome']).strip(), rotulo))

        tipo = str(dados['tipo']).strip().lower()
        if tipo not in MCP_TIPOS:
            return ('O campo "tipo" do %s de "%s" diz "%s". Os tipos aceitos são: '
                    '%s.' % (MCP_MANIFESTO, rotulo, dados['tipo'],
                             ', '.join(MCP_TIPOS)))

        if tipo in ('local', 'comando'):
            return self._mcp3_validar_processo(dados, tipo, rotulo, src)
        return self._mcp3_validar_remoto(dados, rotulo)

    def _mcp3_validar_processo(self, dados, tipo, rotulo, src):
        """`local` e `comando`: os dois viram um processo, e mudam só na prova."""
        comando = str(dados.get('comando') or '').strip()
        if not comando:
            return ('O %s de "%s" é do tipo "%s" e está sem o campo "comando" — '
                    'o executável que lança o servidor.' % (MCP_MANIFESTO, rotulo, tipo))
        args = dados.get('args')
        if args is not None and not isinstance(args, list):
            return 'O campo "args" do %s de "%s" precisa ser uma lista.' % (
                MCP_MANIFESTO, rotulo)
        env = dados.get('env')
        if env is not None and not isinstance(env, dict):
            return 'O campo "env" do %s de "%s" precisa ser um objeto.' % (
                MCP_MANIFESTO, rotulo)

        if tipo == 'comando':
            # ⚠️ A PROVA DO `comando` É O PATH, e o erro tem de dizer o que
            # instalar. "comando não encontrado" manda o usuário procurar no
            # Google o que já se sabe aqui: falta o Node, ou o Docker.
            if not _shutil.which(comando):
                return ('O comando "%s" não está no PATH desta máquina. %s'
                        % (comando, self._mcp3_dica_de_instalacao(comando)))
            return None

        # `local`: o código está NA PASTA, então o arquivo apontado tem de
        # existir lá dentro. Sem isto o MCP é copiado e registrado, e a falha só
        # aparece na sessão seguinte do assistente, como um servidor que não sobe.
        alvos = [a for a in (args or []) if isinstance(a, str) and '${PASTA}' in a]
        if not alvos:
            return ('O %s de "%s" é do tipo "local", mas nenhum item de "args" '
                    'aponta para dentro da pasta com ${PASTA}. Num MCP local o '
                    'código mora na pasta do item; se ele é baixado na hora, o '
                    'tipo é "comando".' % (MCP_MANIFESTO, rotulo))
        for alvo in alvos:
            rel = alvo.replace('${PASTA}', '').strip().lstrip('/\\')
            if not rel:
                continue
            if not os.path.exists(os.path.join(src, *rel.split('/'))):
                return ('O %s de "%s" aponta para "%s", que não existe dentro da '
                        'pasta do item.' % (MCP_MANIFESTO, rotulo, rel))
        return None

    @staticmethod
    def _mcp3_dica_de_instalacao(comando):
        """O que instalar, quando dá para saber pelo nome do executável."""
        c = os.path.splitext(os.path.basename(comando))[0].lower()
        dicas = {
            'npx': 'Instale o Node.js — é ele que traz o npx.',
            'node': 'Instale o Node.js.',
            'npm': 'Instale o Node.js — é ele que traz o npm.',
            'bunx': 'Instale o Bun.',
            'uvx': 'Instale o uv (`pip install uv`).',
            'uv': 'Instale o uv (`pip install uv`).',
            'docker': 'Instale o Docker Desktop.',
            'python': 'Instale o Python e deixe-o no PATH.',
            'py': 'Instale o Python e deixe-o no PATH.',
            'deno': 'Instale o Deno.',
        }
        return dicas.get(c, 'Instale o programa que fornece esse comando, ou '
                            'escreva o caminho completo dele no manifesto.')

    def _mcp3_validar_remoto(self, dados, rotulo):
        transporte = str(dados.get('transporte') or '').strip().lower()
        if transporte not in MCP_TRANSPORTES:
            return ('O %s de "%s" é do tipo "remoto" e o campo "transporte" diz '
                    '"%s". Os aceitos são: %s.'
                    % (MCP_MANIFESTO, rotulo, dados.get('transporte') or '',
                       ', '.join(MCP_TRANSPORTES)))
        url = str(dados.get('url') or '').strip()
        if not url:
            return ('O %s de "%s" é do tipo "remoto" e está sem o campo "url".'
                    % (MCP_MANIFESTO, rotulo))
        headers = dados.get('headers')
        if headers is not None and not isinstance(headers, dict):
            return 'O campo "headers" do %s de "%s" precisa ser um objeto.' % (
                MCP_MANIFESTO, rotulo)
        for chave, valor in (headers or {}).items():
            if not self._mcp3_parece_segredo_literal(chave, valor):
                continue
            return ('O cabeçalho "%s" do %s de "%s" tem o valor escrito por '
                    'extenso. Isso vaza a senha para dentro de todo projeto onde '
                    'este MCP for ligado. Escreva ${NOME_DA_VARIAVEL} e guarde o '
                    'valor numa variável de ambiente do Windows.'
                    % (chave, MCP_MANIFESTO, rotulo))
        return None

    @staticmethod
    def _mcp3_parece_segredo_literal(chave, valor):
        """Um cabeçalho de autenticação cujo valor NÃO é um espaço reservado.

        ⚠️ A checagem é pelo NOME do cabeçalho, e não por parecer-com-senha: um
        token é uma sequência de caracteres como qualquer outra, e nenhuma
        heurística sobre o valor distingue um segredo de um id público. O nome
        do cabeçalho, esse, diz para que ele serve.
        """
        if not isinstance(valor, str):
            return False
        nome = str(chave or '').lower()
        if not any(marca in nome for marca in MCP_CABECALHOS_DE_SEGREDO):
            return False
        bruto = valor.strip()
        if not bruto:
            return False
        # `Bearer ${TOKEN}` é legítimo: o que não pode é sobrar caractere que
        # não venha de um espaço reservado nem de um prefixo de esquema.
        import re as _re
        resto = _re.sub(r'\$\{[A-Za-z_][A-Za-z0-9_]*\}', '', bruto)
        resto = _re.sub(r'(?i)^\s*(bearer|basic|token)\s*', '', resto).strip()
        return bool(resto)

    # ── Os espaços reservados ────────────────────────────────────────────────

    def _mcp3_resolver(self, valor, pasta):
        """`(resolvido, faltando)` — `${PASTA}` e as variáveis de ambiente.

        `faltando` é a lista de variáveis que o manifesto pede e a máquina não
        tem. Ela sobe até o `activate_item`: registrar um servidor com o
        `${TOKEN}` cru dentro faria o assistente externo falhar na sessão
        seguinte, com uma mensagem que não menciona variável nenhuma.
        """
        import re as _re
        if not isinstance(valor, str):
            return valor, []
        faltando = []
        texto = valor.replace('${PASTA}', pasta)

        def _trocar(m):
            nome = m.group(1)
            if nome == 'PASTA':
                return pasta
            bruto = os.environ.get(nome)
            if bruto is None:
                faltando.append(nome)
                return m.group(0)
            return bruto

        return _re.sub(r'\$\{([A-Za-z_][A-Za-z0-9_]*)\}', _trocar, texto), faltando

    def _mcp3_resolver_lista(self, valores, pasta):
        saida, faltando = [], []
        for v in valores or []:
            r, f = self._mcp3_resolver(v, pasta)
            saida.append(r)
            faltando.extend(f)
        return saida, faltando

    def _mcp3_resolver_mapa(self, mapa, pasta):
        saida, faltando = {}, []
        for k, v in (mapa or {}).items():
            r, f = self._mcp3_resolver(v, pasta)
            saida[k] = r
            faltando.extend(f)
        return saida, faltando

    # ── A entrada gravada no registro ────────────────────────────────────────

    def _mcp3_chave(self, item_name):
        """A chave do servidor no arquivo de registro: minúscula, com hífen.

        `Outros projetos` → `outros-projetos`. É ela que aparece no endereço da
        ferramenta para o assistente externo (`mcp__outros-projetos__ler_arquivo`),
        então mudá-la depois quebra todo prompt que a citava.

        Mesmo `_slug_universal` das skills e dos comandos: o alvo é o padrão que
        todos os assistentes aceitam, e uma segunda regra de slug aqui divergiria
        da primeira no primeiro nome com acento.
        """
        return self._slug_universal(item_name.rsplit('/', 1)[-1])

    def _mcp3_entrada(self, dados, pasta, extras):
        """`(entry, erro)` — o formato do registro, DERIVADO do tipo.

        `extras` são os argumentos que o bloco de configuração acrescenta (a
        lista de ferramentas ligadas e os campos). Eles só existem para os dois
        tipos de processo: um servidor remoto não recebe linha de comando.
        """
        tipo = str(dados.get('tipo') or '').strip().lower()
        if tipo == 'remoto':
            url, f1 = self._mcp3_resolver(str(dados.get('url') or ''), pasta)
            headers, f2 = self._mcp3_resolver_mapa(dados.get('headers'), pasta)
            faltando = f1 + f2
            entry = {'type': str(dados.get('transporte') or '').strip().lower(),
                     'url': url}
            if headers:
                entry['headers'] = headers
        else:
            comando, f1 = self._mcp3_resolver(str(dados.get('comando') or ''), pasta)
            args, f2 = self._mcp3_resolver_lista(dados.get('args'), pasta)
            env, f3 = self._mcp3_resolver_mapa(dados.get('env'), pasta)
            faltando = f1 + f2 + f3
            entry = {'command': comando, 'args': args + list(extras or [])}
            if env:
                entry['env'] = env
        if faltando:
            return None, ('Este MCP pede variáveis de ambiente que esta máquina '
                          'não tem: %s. Crie-as no Windows (Variáveis de Ambiente '
                          'do Usuário) e ligue de novo — o valor delas nunca é '
                          'gravado no molde.' % ', '.join(sorted(set(faltando))))
        return entry, None

    # ── O bloco opcional de configuração ─────────────────────────────────────

    @staticmethod
    def _mcp3_configuracao(dados):
        """O bloco `configuracao` do manifesto, ou `{}` quando ele não existe.

        ⚠️ **AUSÊNCIA É O NORMAL, não erro.** A maioria dos MCPs de internet só
        liga e desliga, e um item sem este bloco tem de ligar sem tela nenhuma e
        sem uma palavra de aviso.
        """
        bloco = dados.get('configuracao')
        return bloco if isinstance(bloco, dict) else {}

    @classmethod
    def _mcp3_ferramentas_declaradas(cls, dados):
        """A lista de ferramentas que o servidor diz expor. `[]` se não declarar."""
        lista = cls._mcp3_configuracao(dados).get('ferramentas')
        if not isinstance(lista, list):
            return []
        saida = []
        for f in lista:
            if isinstance(f, str):
                saida.append({'nome': f, 'descricao': ''})
            elif isinstance(f, dict) and f.get('nome'):
                saida.append({'nome': str(f['nome']),
                              'descricao': str(f.get('descricao') or '')})
        return saida

    @classmethod
    def _mcp3_como_recebe_ligadas(cls, dados):
        """Como o servidor recebe a lista de ferramentas ligadas, ou `None`.

        ⚠️ **SEM ISTO A TELA MOSTRA AS FERRAMENTAS SEM AS CAIXINHAS**, e isso é
        a resposta certa, não uma limitação a contornar. O `--enabled` é
        invenção deste programa, não do protocolo MCP: mandá-lo a um servidor
        de fora faz o processo morrer no argumento desconhecido, e o sintoma é
        um MCP que "some" da sessão sem erro nenhum.
        """
        bloco = cls._mcp3_configuracao(dados).get('lista_de_ligadas')
        if not isinstance(bloco, dict):
            return None
        if str(bloco.get('como') or '').strip().lower() != 'argumento':
            return None
        nome = str(bloco.get('nome') or '').strip()
        return nome or None

    @classmethod
    def _mcp3_campos(cls, dados):
        """Os campos de configuração declarados, já normalizados."""
        lista = cls._mcp3_configuracao(dados).get('campos')
        if not isinstance(lista, list):
            return []
        campos = []
        for bruto in lista:
            if not isinstance(bruto, dict) or not bruto.get('chave'):
                continue
            tipo = str(bruto.get('tipo') or 'texto').strip().lower()
            if tipo not in MCP_TIPOS_DE_CAMPO:
                continue
            chave = str(bruto['chave']).strip()
            campos.append({
                'chave': chave,
                'tipo': tipo,
                'rotulo': str(bruto.get('rotulo') or chave),
                'ajuda': str(bruto.get('ajuda') or ''),
                'opcoes': [str(o) for o in (bruto.get('opcoes') or [])
                           if isinstance(o, (str, int, float))],
                'opcoes_de': (str(bruto.get('opcoes_de') or '').strip().lower()
                              if str(bruto.get('opcoes_de') or '').strip().lower()
                              in MCP_OPCOES_DINAMICAS else ''),
                'padrao': bruto.get('padrao'),
                # O nome do argumento que leva o valor ao servidor. Sem ele o
                # campo seria guardado e nunca chegaria a lugar nenhum.
                'argumento': str(bruto.get('argumento') or ('--' + chave)),
            })
        return campos

    def _mcp3_opcoes_do_campo(self, campo):
        """As opções de um campo, com as dinâmicas já preenchidas."""
        if campo.get('opcoes_de') == 'projetos':
            # `list_projects` devolve uma LISTA de nomes, não um envelope
            # `{'success': ...}` como a maioria das fronteiras. Ler `.get` aqui
            # daria uma lista vazia em silêncio.
            try:
                return [p for p in (self.list_projects() or []) if isinstance(p, str)]
            except Exception:
                return []
        return campo.get('opcoes') or []

    # ── Os valores que o usuário escolheu, por projeto ───────────────────────
    #
    # ⚠️ POR PROJETO, e não globais: no projeto B você marca uns projetos
    # consultáveis, no projeto C outros. É a mesma escolha que `mcp_functions`
    # já fazia para os dois do programa, e pelo mesmo motivo.

    @staticmethod
    def _mcp3_valores(config, item_name):
        return (config.get('mcps_config') or {}).get(item_name) or {}

    @staticmethod
    def _mcp3_ligadas(config, item_name):
        return (config.get('mcps_ferramentas') or {}).get(item_name) or {}

    def _mcp3_extras(self, dados, config, item_name):
        """Os argumentos que o bloco de configuração acrescenta ao `args`."""
        if str(dados.get('tipo') or '').lower() == 'remoto':
            return []
        extras = []

        ferramentas = self._mcp3_ferramentas_declaradas(dados)
        flag = self._mcp3_como_recebe_ligadas(dados)
        if ferramentas and flag:
            estado = self._mcp3_ligadas(config, item_name)
            ligadas = [f['nome'] for f in ferramentas if estado.get(f['nome'], True)]
            # Todas ligadas manda lista VAZIA — é o mesmo contrato do
            # `_mcp_enabled_csv` dos dois do programa: ausência quer dizer
            # "todas", e é o que faz uma ferramenta nova aparecer sozinha.
            if len(ligadas) != len(ferramentas):
                extras += [flag, ','.join(ligadas)]

        valores = self._mcp3_valores(config, item_name)
        for campo in self._mcp3_campos(dados):
            if campo['chave'] not in valores:
                continue
            valor = valores[campo['chave']]
            if campo['tipo'] == 'marcar':
                extras += [campo['argumento'], 'true' if valor else 'false']
            elif campo['tipo'] == 'varios':
                lista = [str(v) for v in (valor or [])]
                extras += [campo['argumento'], ','.join(lista)]
            elif valor not in (None, ''):
                extras += [campo['argumento'], str(valor)]
        return extras
