"""Montar o comando, disparar o processo e bombear a saída dele.

⚠️ UMA THREAD BOMBEADORA POR CANAL (stdout e stderr separados), agrupando o que
chegou a cada `INTERVALO_DE_AGRUPAMENTO` para não afogar o `evaluate_js` numa
saída grande. `evaluate_js` é SÍNCRONO: cada travessia para a thread leitora.

⚠️ `taskkill /F /T /PID` MATA A ÁRVORE, e não o processo. Matar só o pai deixa
órfão todo subprocesso que ele abriu, e os órfãos continuam segurando os canos —
o programa fica esperando um EOF que nunca chega.

⚠️ O TERMINAL DE AGENTE É TIRO SÓ: nasce, responde e morre por mensagem. O
terminal do sistema (`trabalhos_shell*.py`) fica vivo esperando linha. Os dois
não viraram um arquivo com um `if` porque ciclo de vida, estado e forma de parar
são diferentes — juntos, cada função teria dois caminhos que nunca se encontram.

⚠️ A DEPENDÊNCIA É CONFERIDA ANTES DE DISPARAR
(`_ofi_disparar_com_dependencia_ok`). Uma ligação da Oficina segura o disparo até
o outro lado terminar — é o efeito das ligações, e ele mora aqui e em
`trabalhos_conexoes.py`, não no desenho.
"""

from .trabalhos_terminais_constantes import *
# M4 · o barramento das extensões. Importado como MÓDULO, e não a função
# solta: `xt_eventos.emitir(...)` diz de onde o aviso sai, e um `emitir`
# nu no meio deste arquivo seria confundido com emissão interna do
# programa na primeira leitura de quem não conhece a camada.
from .extensoes import eventos as xt_eventos



class TrabalhosTerminaisRodarMixin:

    # ── Montar o comando ─────────────────────────────────────────────────────

    def _ofi_montar_comando(self, project_name, no, mensagem):
        """A linha de comando de uma execução.

        ⚠️ O EXECUTÁVEL VEM DO PRESET DE PRODUTO, nunca cravado aqui. É isso que
        faz trocar de produto ser trocar um seletor, sem que nenhum preset de
        agente mude — e é também o que mantém o nome do produto fora do código,
        que é onde ele não pode estar.
        """
        produto = self._trab_produto_ativo()
        if not produto or not (produto.get('comando') or '').strip():
            raise ValueError(
                'Nenhum assistente externo com comando de lançamento. Preencha em '
                'Arquivos › Agentes › Assistentes externos.')

        cmd = [produto['comando'].strip()]
        cmd += [a for a in (produto.get('argumentos') or []) if a]

        # O prompt fixo do papel. Um nó sem papel não recebe prompt de papel
        # nenhum — ele é livre, e é o usuário quem diz o que ele é.
        papel = no.get('papel')
        if papel:
            prompt = self._trab_montar_prompt(project_name, papel)
            caminho = self._ofi_gravar_prompt(project_name, no['id'], prompt)
            # ⚠️ A FLAG DE ARQUIVO, E NÃO A DE TEXTO. Aqui se passa um CAMINHO,
            # e até 2026-09-03 ele ia em `flag_prompt` — que recebe o texto do
            # prompt. O erro não dava sintoma: o assistente recebia a string
            # `C:\...\_no-abc.md` como se fosse a instrução, e rodava sem
            # nenhuma das regras do papel, parecendo funcionar.
            #
            # Sem a flag de arquivo declarada, o prompt não vai: melhor um nó
            # sem papel — que é um estado que já existe e que o usuário
            # reconhece — do que um com o papel errado.
            flag = (produto.get('flag_prompt_arquivo') or '').strip()
            if flag:
                cmd += [flag, caminho]
        # Os canais que este nó tem direito de ler entram como CONTEXTO da
        # mensagem, e não como flag inventada: o produto do usuário não tem por
        # que conhecer um `--canal` nosso. Vem vazio quando não há ligação.
        canais = self._conx_contexto_de_canais(project_name, no['id'])
        if canais:
            mensagem = (canais + '\n\n' + (mensagem or '')).strip()
        if no.get('cartao_origem'):
            # O cartão vai por último a ser prefixado, e por isso aparece
            # PRIMEIRO na leitura: "de que atividade é isto" vem antes de "o que
            # você pode ler sobre ela", que vem antes do pedido em si.
            mensagem = (f'[atividade {no["cartao_origem"]}]\n' + (mensagem or '')).strip()
        cmd.append(mensagem or '')
        return cmd

    def _ofi_ambiente(self):
        """O ambiente do processo filho, com o pedido de UTF-8.

        ⚠️ MEDIDO, não suposto: um filho que escreve na saída usando o code page
        ANSI do Windows (cp1252) devolve `faça` como `fa?a` depois de passar
        pelo cano, porque nós lemos UTF-8 do outro lado. `servidor.py` já
        resolve isso para o processo DELE chamando `reconfigure(encoding=...)`
        — mas aqui o filho é programa de terceiro, e não dá para editar o código
        dele.

        Estas três variáveis são o que se pode pedir de fora, e cobrem os
        interpretadores mais comuns. Não são garantia: um CLI que ignore as três
        ainda pode devolver byte estranho, e é por isso que a leitura continua
        com `errors='replace'` — texto com um caractere trocado é ruim, mas
        derrubar a thread do terminal por causa dele é pior.
        """
        env = dict(os.environ)
        env['PYTHONIOENCODING'] = 'utf-8'
        env['PYTHONUTF8'] = '1'
        env.setdefault('LANG', 'en_US.UTF-8')
        return env

    def _ofi_gravar_prompt(self, project_name, id_no, texto):
        """O system prompt vai em ARQUIVO, não na linha de comando.

        Dois motivos, e os dois são práticos: o Windows tem teto de tamanho de
        linha de comando (~32k) e o prompt montado já passa de vários kB; e um
        prompt com aspas e quebra de linha dentro de um argumento é a receita
        para o shell comer metade dele.
        """
        from .caminhos import obter_pasta_de_trabalhos
        pasta = obter_pasta_de_trabalhos(project_name, 'Oficina', 'Prompts')
        os.makedirs(pasta, exist_ok=True)
        caminho = os.path.join(pasta, f'_{id_no}.md')
        with open(caminho, 'w', encoding='utf-8') as f:
            f.write(texto)
        return caminho

    # ── Rodar ────────────────────────────────────────────────────────────────

    def enviar_mensagem_ao_terminal(self, project_name, id_no, mensagem):
        """Manda uma mensagem para o terminal de um nó — o caminho PRINCIPAL.

        Modo tiro só (D17): cada mensagem é uma execução inteira. Devolve na
        hora; o andamento chega ao JS por `oficinaTerminalSaida`.
        """
        try:
            if self._trab_terminal_rodando(project_name, id_no):
                return {'success': False,
                        'error': 'Este terminal ainda está trabalhando. Espere ele terminar '
                                 'ou use Parar.'}
            andar = self._conx_andar(project_name)
            no = self._trab_achar_no(andar, id_no)
            if no is None:
                return {'success': False, 'error': f'Nó não encontrado: {id_no}'}
            if no.get('tipo') != 'terminal':
                return {'success': False, 'error': 'Este nó não é um terminal.'}

            # Mensagem do USUÁRIO é conversa nova: as idas e voltas deste nó
            # recomeçam a contagem de rodadas. Sem isto, a segunda conversa
            # nasceria já perto do teto, e pararia cedo sem explicação.
            self._conx_zerar_rodadas_do_no(project_name, andar, id_no)

            # ⚠️ O PORTÃO DA DEPENDÊNCIA VEM ANTES DE TUDO QUE CUSTA. Nada de
            # montar comando, gravar prompt ou travar papel para um nó que não
            # vai disparar agora: a mensagem fica guardada e sai sozinha quando
            # a dependência entregar.
            pendentes = self._conx_dependencias_pendentes(project_name, andar, id_no)
            if pendentes:
                motivo = self._conx_texto_da_espera(pendentes)
                self._conx_guardar_espera(project_name, id_no, mensagem, pendentes)
                self._ofi_registrar_linha(project_name, id_no, 'ent', f'> {mensagem}')
                self._ofi_registrar_linha(
                    project_name, id_no, 'err',
                    motivo + ' — a mensagem fica guardada e dispara sozinha.')
                self._ofi_notify(project_name, id_no,
                                 {'status': 'espera', 'estado': 'aguardando', 'motivo': motivo})
                return {'success': True, 'aguardando': True, 'motivo': motivo}

            self._ofi_preparar_e_disparar(project_name, id_no, no, mensagem)
            return {'started': True, 'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _ofi_preparar_e_disparar(self, project_name, id_no, no, mensagem):
        """Trava o papel, monta o comando e dispara. Sem portão de dependência.

        Separado de `enviar_mensagem_ao_terminal` porque há DOIS jeitos de uma
        execução começar, e só um deles passa pelo portão: a mensagem do
        usuário passa, e o disparo automático (dependência cumprida, rodada de
        ida e volta) não — quem chama já conferiu, e conferir de novo faria a
        mensagem liberada voltar para a fila de onde acabou de sair.
        """
        # ⚠️ ÚLTIMA GUARDA CONTRA DOIS PROCESSOS NO MESMO NÓ. Os chamadores já
        # conferem antes, mas entre a conferência deles e esta linha existe uma
        # janela — e dois `Popen` para o mesmo nó deixam o registro só com o
        # segundo, tornando o primeiro impossível de parar pela tela.
        if self._trab_terminal_rodando(project_name, id_no):
            raise ValueError('Este terminal já começou uma execução. Espere ela terminar.')

        # ⚠️ A TRAVA DO PAPEL FECHA AQUI, na 1ª mensagem enviada (D34) — e não
        # ao criar o nó nem ao abrir a tela. Antes da 1ª mensagem o usuário
        # ainda pode trocar o papel; depois dela, só "Parar tudo".
        if no.get('papel') and not no.get('papel_travado'):
            self.travar_papel_do_no(project_name, id_no)

        # Um Orquestrador começando a trabalhar abre um "Fluxo de execução" na
        # barra lateral do Fluxo, se não houver um aberto. Só ele: um Subagente
        # trabalha DENTRO da sessão que o Orquestrador conduz.
        self._flx_garantir_execucao(project_name, no)

        cmd = self._ofi_montar_comando(project_name, no, mensagem)
        # A pasta liberada, e a única: a raiz configurada em Projeto → Trabalho.
        # `_sub_root_folder` é o mesmo ponto que as ferramentas de leitura já
        # usam — dois lugares decidindo isso é como se abre uma exceção sem querer.
        cwd = self._sub_root_folder(project_name)
        self._ofi_disparar(project_name, id_no, cmd, cwd, mensagem)

    def _ofi_disparar_com_dependencia_ok(self, project_name, id_no, mensagem):
        """Disparo automático — dependência cumprida ou rodada de ida e volta.

        Não devolve nada: quem chama é o próprio fim de outra execução, e não
        há ninguém do outro lado esperando resposta. Uma falha aqui vira linha
        no log do nó, que é onde o usuário vai procurar.
        """
        try:
            no = self._trab_achar_no(self._conx_andar(project_name), id_no)
            if no is None or no.get('tipo') != 'terminal':
                return
            self._ofi_preparar_e_disparar(project_name, id_no, no, mensagem)
        except Exception as e:
            self._ofi_falhar(project_name, id_no, str(e))

    def _ofi_disparar(self, project_name, id_no, cmd, cwd, mensagem):
        dado = self._ofi_dado(project_name, id_no)
        dado['comando'] = ' '.join(cmd)
        dado['estado'] = 'fazendo'
        # Marcado AQUI, na thread da interface, e não lá dentro: é o que fecha a
        # janela de corrida descrita em `_trab_terminal_rodando`.
        dado['disparando'] = True
        dado['chamadas'] += 1
        dado['inicio'] = time.time()
        dado['erro'] = None
        self._ofi_registrar_linha(project_name, id_no, 'ent', f'> {mensagem}')

        def bombear(pipe, canal):
            buf, ultimo = [], time.time()
            try:
                for linha in pipe:
                    buf.append(linha)
                    if time.time() - ultimo >= INTERVALO_DE_AGRUPAMENTO:
                        self._ofi_chunk(project_name, id_no, canal, ''.join(buf))
                        buf, ultimo = [], time.time()
            except Exception:
                pass
            if buf:
                self._ofi_chunk(project_name, id_no, canal, ''.join(buf))
            try:
                pipe.close()
            except Exception:
                pass

        def worker():
            try:
                self._ofi_notify(project_name, id_no, {'status': 'running'})
                proc = subprocess.Popen(
                    cmd,
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True, encoding='utf-8', errors='replace', bufsize=1,
                    cwd=cwd,
                    env=self._ofi_ambiente(),
                    # Sem janela de console piscando por terminal aberto. Com N
                    # terminais isso deixaria de ser detalhe.
                    creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
                )
                self._ofi_procs_dict()[self._ofi_chave(project_name, id_no)] = proc

                leitores = [
                    threading.Thread(target=bombear, args=(proc.stdout, 'out'), daemon=True),
                    threading.Thread(target=bombear, args=(proc.stderr, 'err'), daemon=True),
                ]
                for t in leitores:
                    t.start()
                for t in leitores:
                    t.join()
                codigo = proc.wait()

                dado = self._ofi_dado(project_name, id_no)
                if dado['inicio']:
                    dado['segundos'] += time.time() - dado['inicio']
                    dado['inicio'] = None
                dado['saiu_com'] = codigo
                # O exit code é o gatilho, e não o stderr sozinho: muito
                # programa escreve aviso no stderr sem ter dado erro — a mesma
                # lição que `terminal.py` já documenta.
                dado['estado'] = 'entregue' if codigo == 0 else 'falhou'
                self._ofi_notify(project_name, id_no, {
                    'status': 'done', 'exit_code': codigo,
                    'estado': dado['estado'], 'comando': dado['comando']})
            except FileNotFoundError:
                self._ofi_falhar(project_name, id_no,
                    'Não encontrei o programa "%s". Confira o comando do produto em '
                    'Configurações › Agentes.' % cmd[0])
            except Exception as e:
                self._ofi_falhar(project_name, id_no, str(e))
            finally:
                self._ofi_procs_dict().pop(self._ofi_chave(project_name, id_no), None)
                self._ofi_dado(project_name, id_no)['disparando'] = False
            # ⚠️ FORA DO `finally`, E DEPOIS DELE, de propósito. As ligações
            # perguntam "este nó terminou?" — e a resposta seria "não" enquanto
            # `disparando` ainda estivesse de pé. Rodando aqui dentro, um nó que
            # esperava por este nunca seria liberado.
            self._conx_ao_terminar(project_name, id_no)
            # M4 · observador. Depois das ligações, e nunca antes: uma
            # extensão lenta aqui não pode atrasar o nó seguinte da Oficina.
            # `emitir` já tem teto próprio por assinante, mas a ordem é a
            # segunda rede — e a de graça.
            xt_eventos.emitir('terminal.terminou', {
                'projeto': project_name, 'id': id_no,
                'codigo_de_saida': self._ofi_dado(project_name, id_no).get('saiu_com')})

        threading.Thread(target=worker, daemon=True).start()

    def _ofi_falhar(self, project_name, id_no, erro):
        dado = self._ofi_dado(project_name, id_no)
        dado['estado'] = 'falhou'
        dado['erro'] = erro
        if dado['inicio']:
            dado['segundos'] += time.time() - dado['inicio']
            dado['inicio'] = None
        self._ofi_registrar_linha(project_name, id_no, 'err', erro)
        self._ofi_notify(project_name, id_no, {'status': 'error', 'error': erro,
                                               'estado': 'falhou'})

    def _ofi_chunk(self, project_name, id_no, canal, texto):
        self._ofi_registrar_linha(project_name, id_no, canal, texto, bruto=True)
        self._ofi_notify(project_name, id_no,
                         {'status': 'chunk', 'canal': canal, 'texto': texto})

    def _ofi_registrar_linha(self, project_name, id_no, canal, texto, bruto=False):
        dado = self._ofi_dado(project_name, id_no)
        linhas = dado['linhas']
        for parte in (texto.splitlines() if bruto else [texto]):
            linhas.append({'canal': canal, 'texto': parte})
        if len(linhas) > TETO_DE_LINHAS:
            # Corta pelo começo: num log longo, o que interessa é o fim.
            del linhas[:len(linhas) - TETO_DE_LINHAS]
        self._ofi_contar_tokens(dado, texto)

    def _ofi_contar_tokens(self, dado, texto):
        """Estimativa grosseira, e declarada como tal.

        ⚠️ NÃO É A CONTAGEM DO PRODUTO. O programa não tem como saber quantos
        tokens o assistente externo cobrou — quem sabe é o CLI dele. Isto serve
        para a barra comparativa das Métricas ("qual terminal gastou mais"),
        que é uma pergunta relativa, e é honesto para isso. Para o número
        absoluto existe a cota lida do próprio CLI.
        """
        dado['tokens_saida'] += max(1, len(texto) // 4)

