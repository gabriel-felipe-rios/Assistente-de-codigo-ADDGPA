"""O MODO: a string que o programa digita dentro do terminal recém-aberto.

⚠️ O AGENTE NÃO É OUTRO TIPO DE NÓ — É UMA LINHA DIGITADA NESTE. Foi decisão do
usuário depois de testar à mão, e é ela que explica o arquivo inteiro: aqui não
se abre processo nenhum, só se MONTA TEXTO. Nada daqui toca o sistema
operacional.

Quatro peças, e o corte entre elas é o que cada uma sabe:

    · `_sh_comando_do_modo`  — a linha de comando, montada a partir do preset
      do assistente externo (as flags `--agent`, `--append-system-prompt`…)
    · `_sh_agente_do_no`     — qual agente da biblioteca este nó usa
    · `_sh_gravar_prompt_do_papel` — o prompt do papel, gravado em arquivo
    · `_sh_bloco_das_notas_ligadas` — o que os nós vizinhos anotaram

⚠️ FLAG VAZIA É LEGÍTIMA, e não é erro. Um produto que não sabe receber prompt
por arquivo, ou que não tem noção de agente, abre o terminal sem elas. É a
mesma regra de "campo vazio é pulado" que vale nos destinos do preset.

⚠️ QUANDO O PRESET NÃO SERVE, A MENSAGEM APONTA `ONDE_SE_CONFIGURA` — uma
constante, e não texto escrito à mão. O caminho da tela já mudou duas vezes, e
das duas as mensagens ficaram apontando para uma tela que não existia mais.
"""

from .trabalhos_shell_constantes import *


class TrabalhosShellModoMixin:

    # ── O modo: a string que o programa digita dentro do terminal ────────────
    #
    # ⚠️ O AGENTE NÃO É OUTRO TIPO DE NÓ — É UMA LINHA DIGITADA NESTE. Foi
    # decisão do usuário depois de testar à mão: *"na hora que eu quiser
    # transformar ele em orquestrador, ele só vai injetar uma string nesse
    # terminal"*. É literalmente o que ele fez sozinho — abriu dois terminais na
    # mesma pasta e rodou o CLI nos dois.
    #
    # ⚠️ O NOME DA SESSÃO É O NOME DO NÓ, e essa é a peça que faz um terminal
    # enxergar o outro. No Claude Code, `--name` batiza a sessão e `@nome`
    # endereça ela de dentro de outra (mensagem entre sessões, ligada por
    # padrão). Ou seja: quem liga agente a subagente é o PRODUTO, pelo nome —
    # não as setas do nosso canvas. É por isso que as setas viraram desenho.
    #
    # ⚠️ SLUG, E NÃO O NOME CRU. Um nome com espaço obriga a escrever
    # `@"Terminal 1"` com aspas para endereçar; `terminal-1` se digita direto.

    # Teto de segurança da linha de comando do `cmd.exe`. Passar disso não dá
    # erro claro: o Windows corta a linha, e o agente sobe com metade do system
    # prompt sem ninguém perceber.
    TETO_DA_LINHA = 7800

    def _sh_slug(self, texto):
        # O acento é TIRADO, e não trocado por hífen: "Orquestrador padrão"
        # vira `orquestrador-padrao`, e não `orquestrador-padr-o`. É um nome que
        # o usuário vai digitar depois de um `@`, então ele precisa ser
        # pronunciável — não só válido.
        plano = unicodedata.normalize('NFKD', texto or '')
        limpo = []
        for c in plano:
            if unicodedata.combining(c):
                continue
            limpo.append(c if (c.isalnum() and c.isascii()) else '-')
        slug = '-'.join(p for p in ''.join(limpo).split('-') if p).lower()
        return slug or 'terminal'

    def _sh_comando_do_modo(self, project_name, no):
        """A linha a digitar, ou `None` se o nó não tem modo nenhum.

        Devolve `(linha, aviso)`. `aviso` vem preenchido quando o modo foi
        pedido mas não deu para montar — e nesse caso o terminal abre limpo, com
        o motivo escrito na tela. Abrir sem o modo E sem dizer nada seria o pior
        dos dois: um "orquestrador" que é só um `cmd.exe`.
        """
        nome_do_produto = no.get('produto')
        if not nome_do_produto:
            return None, None
        produto = self._trab_assistente(nome_do_produto)
        if produto is None:
            return None, ('O assistente externo "%s" não existe mais em %s. '
                          'O terminal abriu sem ele.' % (nome_do_produto, ONDE_SE_CONFIGURA))
        comando = (produto.get('comando') or '').strip()
        if not comando:
            return None, ('O assistente externo "%s" não tem comando de lançamento. '
                          'Preencha em %s — o terminal abriu limpo.'
                          % (nome_do_produto, ONDE_SE_CONFIGURA))

        partes = [comando] + [a for a in (produto.get('argumentos') or []) if a]

        # O nome da sessão, quando o produto sabe receber um.
        flag_nome = (produto.get('flag_nome') or '').strip()
        if flag_nome:
            partes += [flag_nome, self._sh_slug(no.get('nome'))]

        # ⚠️ O AGENTE ENTRA NA LINHA DE COMANDO — E ANTES NÃO ENTRAVA.
        #
        # Aqui havia um aviso dizendo o contrário, com o título "O AGENTE NÃO
        # ENTRA NA LINHA DE COMANDO, E ISSO É O DESENHO". Ele está reescrito, e
        # não apagado, porque metade dele continua sendo verdade e a outra
        # metade explica por que a decisão mudou.
        #
        # O que ele dizia, e continua valendo:
        #   1. `modo` guarda o nome de um `.md` da biblioteca
        #      (`Arquivos/Agentes/`), e a lista antiga de "modos de terminal"
        #      das settings nunca casava com ele — aquele bloco era código
        #      morto que fingia estar vivo, e foi bem removido;
        #   2. escolher um agente no popover COPIA o `.md` para
        #      `.claude/agents/` do projeto, e quem o lê é o assistente
        #      externo. Isso não mudou, e continua sendo o caminho do arquivo.
        #
        # O que ele dizia e ERA FALSO: que por isso o agente não podia entrar
        # na linha. O sintoma foi o usuário perguntar ao nó "Orquestrador" se
        # ele via subagentes, e ele responder *"não, é só eu, sessão
        # principal"*. Ele SABIA o nome do papel (o `description:` do `.md`
        # chega até ele), mas não tinha as REGRAS — o corpo do arquivo só é
        # lido quando aquele agente é acionado como ajudante interno, numa
        # sessão nova. O `.md` copiado governava tudo, menos a sessão em que o
        # usuário estava digitando.
        #
        # ⚠️ E O `tools:` DO `.md` LIMITA A SESSÃO DE VERDADE — MEDIDO, não
        # suposto. Na CLI 2.1.258, uma sessão lançada com um agente que declara
        # `tools: [Read, Grep]` responde ter exatamente essas duas ferramentas.
        # Ou seja: o `orquestrador.md`, que declara `Read, Grep, Glob,
        # TodoWrite`, vira tranca real contra o orquestrador editar código —
        # que é a primeira regra dele.
        #
        # ⚠️ O QUE FICOU DE FORA, DE PROPÓSITO: `--allowed-tools`,
        # `--strict-mcp-config` e `--settings` por nó. O aparelho existe e está
        # decidido, mas entra em obra separada — tudo de uma vez impede saber
        # qual peça quebrou.
        # ⚠️ O NOME DO AGENTE É CONFERIDO NO DISCO — ver `_sh_agente_do_no`, e
        # não passe daqui sem ler o porquê: um `--agent` com nome que não
        # existe MATA o terminal na abertura.
        flag_agente = (produto.get('flag_agente') or '').strip()
        agente = self._sh_agente_do_no(project_name, no) if flag_agente else None
        if agente:
            partes += [flag_agente, agente]

        # ⚠️ A FLAG DE ARQUIVO, E NUNCA A DE TEXTO. `flag_prompt` recebe o
        # PROMPT; esta recebe o CAMINHO de um arquivo com ele. Passar um caminho
        # para a primeira não dá erro nenhum — o assistente toma a string do
        # caminho como instrução e roda sem as regras.
        #
        # ⚠️ E ELE VAI PARA TODO NÓ COM ASSISTENTE, COM PAPEL OU SEM. O que
        # varia é o CONTEÚDO: com papel entram as regras do papel mais o recado
        # da pasta; sem papel, só o recado. E isso não é "inventar papel para
        # quem não tem" — o recado não diz quem o agente é, diz onde estão o
        # Quadro, as notas e o `Equipe.md`. Sem ele a pasta que a Obra 1 criou
        # ficaria ali sem ninguém saber que existe, que é o defeito que a obra
        # inteira existe para consertar.
        flag_arquivo = (produto.get('flag_prompt_arquivo') or '').strip()
        if flag_arquivo:
            caminho = self._sh_gravar_prompt_do_papel(project_name, no)
            if caminho:
                partes += [flag_arquivo, '"%s"' % caminho]

        linha = ' '.join(partes)
        if len(linha) > self.TETO_DA_LINHA:
            return None, (
                'A linha de lançamento tem %d caracteres e o Windows não passa de %d. '
                'O terminal abriu limpo — encurte os argumentos em %s.'
                % (len(linha), self.TETO_DA_LINHA, ONDE_SE_CONFIGURA))
        return linha, None

    def _sh_agente_do_no(self, project_name, no):
        """O nome a passar em `--agent`, ou `None`. **Conferido no disco.**

        ⚠️ `--agent` COM NOME QUE NÃO EXISTE MATA O TERMINAL NA ABERTURA, e foi
        medido: a CLI responde `--agent 'X' not found. Available agents: ...` e
        encerra. Sem a conferência abaixo, um nó cujo `.md` não tivesse sido
        copiado abriria, cuspiria esse erro e morreria — e o usuário veria um
        terminal que "não abre mais", sem ligar isso a nada.

        ⚠️ SÃO DUAS ORIGENS DE NOME, e elas não são a mesma coisa:

          · `modo`  — o `.md` escolhido no popover ＋Agente. Esse arquivo É
            copiado para a pasta de agentes do projeto no instante da escolha
            (`activate_item`), então é o caso em que `--agent` funciona por
            construção. É também o caso comum: o popover cria o nó com
            `papel: null` de propósito.
          · `papel` — 'orquestrador' ou 'subagente', e só vem de CARTÃO DO
            QUADRO. Aqui nada copia `.md` nenhum: o papel governa o prompt, não
            o arquivo. Só entra em `--agent` se por acaso houver um `.md` de
            mesmo nome ligado no projeto.

        Nos dois casos a resposta é `None` quando o arquivo não está lá, e o
        terminal abre sem `--agent` — que é exatamente como ele abria antes
        desta obra.
        """
        candidato = (no.get('modo') or '').strip() or (no.get('papel') or '').strip()
        if not candidato:
            return None
        # `modo` pode vir com grupo (`Orquestração/revisor`); o que vira nome de
        # agente é a última parte, que é o nome do arquivo.
        candidato = candidato.rsplit('/', 1)[-1]
        try:
            config = self.load_workspace(project_name)['config']
            raiz = config.get('root_folder')
            preset = self._assistente_externo(config.get('assistente_externo'))
            destino = ((preset or {}).get('categorias') or {}).get('agentes') or {}
            pasta = os.path.join(raiz, destino.get('destino') or '')
            if not os.path.isdir(pasta):
                return None
            alvo = candidato.lower()
            for nome in os.listdir(pasta):
                if nome.lower().endswith('.md') and nome[:-3].lower() == alvo:
                    return candidato
        except Exception:
            return None
        return None

    def _sh_gravar_prompt_do_papel(self, project_name, no):
        """O prompt do papel MAIS o recado da pasta. Devolve o caminho, ou `None`.

        ⚠️ REUSA `_trab_montar_prompt`, NÃO REESCREVE. Aquela função já faz o
        trabalho pesado: lê o molde de `prompts/Trabalhos/{papel}.md`, TIRA o
        comentário HTML de manutenção (que é recado para quem edita o arquivo,
        não para o modelo) e preenche `{{BLOQUEIOS}}`, `{{GATILHOS}}` e
        `{{LIMITES}}` com a configuração DAQUELE projeto. Uma segunda montagem
        aqui nasceria sem os bloqueios do projeto, e um terminal que não
        anuncia bloqueio nenhum ao agente é pior que um sem prompt.

        ⚠️ O RECADO DA PASTA É CURTO DE PROPÓSITO. Ele diz quatro coisas que o
        agente não tem como descobrir sozinho: onde a pasta está, que só se
        escreve em `Anotações/`, QUAL É O NOME DESTE NÓ (sem isso ele não sabe
        qual seção do `Equipe.md` é a dele), e que o `Equipe.md` muda — quem
        está aberto agora não é quem estava aberto quando a sessão começou.
        """
        # ⚠️ NÓ SEM PAPEL NÃO GANHA PAPEL AQUI. `papel` só vem de cartão do
        # Quadro, e um nó criado pela barra de ferramentas ou pelo popover tem
        # `papel = None` para sempre — inventar um seria dar-lhe regras que o
        # usuário nunca escolheu. Ele recebe só o recado da pasta, abaixo.
        prompt = ''
        if no.get('papel'):
            try:
                prompt = self._trab_montar_prompt(project_name, no['papel'])
            except Exception:
                # Molde ausente: melhor o recado da pasta sozinho do que meio
                # prompt de papel.
                prompt = ''
        slug = self._sh_slug(no.get('nome'))
        pasta = self._mat_caminho(project_name) or ''
        if not pasta:
            # Sem raiz configurada não há pasta a anunciar, e um prompt de papel
            # sozinho já vale — ele é o que o agente não tinha antes desta obra.
            if not prompt:
                return None
            return self._ofi_gravar_prompt(project_name, 'shell-' + no['id'], prompt)
        prompt += (
                '\n\n---\n\n'
                '# Onde fica o material desta Oficina\n\n'
                'Tudo o que a Oficina escreve para você está em `%s`, **dentro da\n'
                'pasta em que este terminal abriu** — você alcança sem pedir permissão\n'
                'para ler fora do diretório de trabalho.\n\n'
                '| Arquivo | O que é |\n'
                '|---|---|\n'
                '| `Quadro.md` | os cartões, como estão agora |\n'
                '| `Equipe.md` | **quem está com terminal aberto agora** |\n'
                '| `Notas/` | as notas do canvas |\n'
                '| `LEIA-ME.md` | quem escreve o quê |\n\n'
                '**Você é o nó `%s`.** A sua seção do `Equipe.md` é a de mesmo nome, e\n'
                'só com quem estiver listado nela você pode falar diretamente.\n\n'
                '⚠️ **Releia o `Equipe.md` antes de delegar.** Ele muda toda vez que um\n'
                'terminal abre ou fecha, e a lista que você leu no começo da sessão\n'
                'pode já não valer — mandar mensagem para uma sessão que fechou é\n'
                'esperar resposta de ninguém.\n\n'
                '⚠️ **Você só escreve em `Anotações/%s/`.** Os outros arquivos são\n'
                'gerados pelo programa e a sua edição se perde na próxima geração, sem\n'
                'aviso. Para mexer no Quadro, use as ações de Trabalhos do MCP — são as\n'
                'únicas que gravam sob trava e não se atropelam com outro terminal.\n'
                % (pasta, slug, slug))
        prompt += self._sh_bloco_das_notas_ligadas(project_name, no, slug)
        # Mesmo escritor de prompt do caminho de tiro só, com id próprio: os
        # dois podem existir para o MESMO nó (a caixa de mensagem e o terminal
        # vivo), e um nome só faria um sobrescrever o outro.
        return self._ofi_gravar_prompt(project_name, 'shell-' + no['id'], prompt)

    def _sh_bloco_das_notas_ligadas(self, project_name, no, slug):
        """As notas do canvas ligadas a este nó, para o recado da pasta.

        Sem esta lista, ligar uma nota num agente é gesto decorativo: a seta é
        desenhada, o programa a guarda, e o agente nunca fica sabendo.

        ⚠️ SEM NOTA LIGADA, SEM SEÇÃO. Um bloco que diz "nenhuma nota" é ruído
        num prompt que já tem tamanho.

        ⚠️ E A FRASE DO FIM NÃO É ENFEITE. Sem ela um agente prestativo edita a
        nota, o programa apaga na geração seguinte, e ninguém é avisado.
        """
        try:
            andar = self._conx_andar(project_name)
            notas = self._conx_notas_legiveis(project_name, andar, no['id'])
        except Exception:
            # O recado da pasta vale sozinho; derrubar a abertura de um terminal
            # por causa de uma lista de leitura seria trocar um incômodo por uma
            # parede. Mesma regra do módulo do material.
            return ''
        if not notas:
            return ''
        linhas = ['\n\n## As notas ligadas a você\n',
                  'Estas notas do canvas apontam para o seu nó, e é para você lê-las:\n']
        for n in notas:
            linhas.append('- **%s** — `%s`' % (n['autor'], n['caminho']))
        linhas.append(
            '\n⚠️ **Elas são do usuário.** Ele as escreve na tela, e o programa as\n'
            'regera a partir do canvas — a sua edição nelas se perde na geração\n'
            'seguinte, sem aviso. Para registrar qualquer coisa, use `Anotações/%s/`.\n'
            % slug)
        return '\n'.join(linhas)
