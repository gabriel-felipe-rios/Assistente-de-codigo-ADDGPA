"""Um terminal acabou: gravar o canal, liberar quem esperava, e a ida e volta.

É o gancho que dá EFEITO às ligações — sem ele, um fio é desenho. Arquivo
próprio porque é a metade que ESCREVE: `trabalhos_conexoes.py` guarda o estado e
`_contexto.py` só lê.

⚠️ A IDA E VOLTA TEM TETO DE RODADAS, e o teto não é conforto: dois nós ligados
um ao outro se disparam mutuamente para sempre. O contador é por nó e é zerado
quando o usuário começa de novo.

⚠️ O TRECHO TRAVADO (`_conx_ao_terminar_travado`) EXISTE PORQUE DOIS TERMINAIS
PODEM TERMINAR AO MESMO TEMPO. Sem a trava, os dois leem o mesmo andar, os dois
decidem liberar o mesmo terceiro, e ele é disparado duas vezes.
"""

from .constantes import *


class TrabalhosConexoesGanchoMixin:

    # ── Gravar o canal quando um lado termina ────────────────────────────────

    def _conx_saida_do_no(self, project_name, id_no):
        """O que o nó produziu na última execução, pronto para virar canal."""
        dado = self._ofi_dado_se_existe(project_name, id_no)
        if not dado:
            return ''
        texto = '\n'.join(l['texto'] for l in dado['linhas'] if l['canal'] != 'ent')
        if len(texto) > TETO_DO_CANAL:
            texto = ('_(o começo foi cortado — o canal guarda os últimos '
                     f'{TETO_DO_CANAL} caracteres)_\n\n' + texto[-TETO_DO_CANAL:])
        return texto

    def _conx_gravar_canal(self, project_name, ligacao, id_origem, andar):
        """Escreve o que a origem produziu no arquivo daquele sentido.

        Sobrescreve em vez de acrescentar: o canal é "o que ele acabou de
        produzir", e um arquivo que só cresce faria cada rodada de uma ida e
        volta chegar com todas as anteriores coladas na frente — a janela do
        outro lado acabaria antes da conversa.
        """
        caminho = self._conx_caminho_do_canal(project_name, ligacao['id'], id_origem)
        os.makedirs(os.path.dirname(caminho), exist_ok=True)
        dado = self._ofi_dado_se_existe(project_name, id_origem)
        cabecalho = [
            f'# Canal — {self._conx_nome(andar, id_origem)}',
            '',
            f'- Ligação: {ROTULO_DO_TIPO.get(ligacao["tipo"], ligacao["tipo"])}',
            f'- Gravado em: {datetime.now().isoformat(timespec="seconds")}',
            f'- Terminou com: {(dado or {}).get("saiu_com")}',
            '',
            '---',
            '',
        ]
        with open(caminho, 'w', encoding='utf-8') as f:
            f.write('\n'.join(cabecalho) + self._conx_saida_do_no(project_name, id_origem))
        return caminho

    # ── O gancho principal: um terminal acabou ───────────────────────────────

    def _conx_ao_terminar(self, project_name, id_no):
        """Tudo que uma ligação faz quando um lado termina.

        ⚠️ CHAMADO DEPOIS QUE `disparando` JÁ CAIU, e a ordem importa: as
        dependências perguntam "este nó terminou?", e a resposta seria "não" se
        isto rodasse ainda dentro da execução que acabou de encerrar. Um nó que
        esperava por ele nunca seria liberado.

        Engole a própria exceção de propósito: isto roda no fim da thread de um
        terminal, e uma falha aqui não pode derrubar o encerramento normal dele
        nem esconder o resultado que ele já entregou.
        """
        try:
            with self._conx_lock:
                self._conx_ao_terminar_travado(project_name, id_no)
        except Exception:
            pass

    def _conx_ao_terminar_travado(self, project_name, id_no):
        """O corpo de `_conx_ao_terminar`, já sob o lock. Ver o aviso dele."""
        andar = self._conx_andar(project_name)
        entregou = self._trab_estado_do_terminal(project_name, id_no) == 'entregue'
        notas = []

        for l in andar['ligacoes']:
            tipo = l.get('tipo')
            if tipo not in IDS_DAS_LIGACOES_COM_CANAL:
                continue
            sou_origem = (l.get('de') == id_no
                          or (TIPO_E_DUPLO.get(tipo) and l.get('para') == id_no))
            if not sou_origem:
                continue
            self._conx_gravar_canal(project_name, l, id_no, andar)
            # Mão única para uma NOTA escreve dentro dela: é o que a nota
            # promete desde a Fase 2 ("um terminal ligado a ela pode escrever
            # nela"), e é o único caso em que o canal também vira coisa visível
            # no canvas.
            if tipo == 'mao-unica':
                destino = self._trab_achar_no(andar, l.get('para'))
                if destino is not None and destino.get('tipo') == 'nota':
                    notas.append((destino['id'], self._conx_saida_do_no(project_name, id_no)))

        if notas:
            self._conx_escrever_nas_notas(project_name, notas)

        if entregou:
            self._conx_rodar_ida_e_volta(project_name, andar, id_no)

        self._conx_liberar(project_name)

    def _conx_escrever_nas_notas(self, project_name, notas):
        """Uma transação para todas as notas de uma vez — nunca uma por nota.

        ⚠️ ESTA ESCRITA NÃO PASSOU A VALER PARA O TERMINAL VIVO, e a omissão é
        deliberada. A ligação "mão única" escreve o resultado do nó de agente
        dentro da nota de destino; quando a seta ganhou sentido para o terminal
        vivo (ele entra no `Equipe.md` do vizinho), a pergunta natural foi se um
        terminal também deveria escrever aqui. Não deve.

        O motivo é a invariante de um escritor por arquivo: as notas passaram a
        ser GERADAS pelo programa em `Trabalhos/Notas/`, para o agente ler. Um
        terminal escrevendo de volta na nota daria dois donos ao mesmo texto —
        o gerador e ele —, e a próxima geração apagaria o que ele escreveu sem
        aviso nenhum. O lugar de o agente registrar algo é `Anotações/<nó>/`,
        que é dele e só dele.

        O caminho de tiro só continua escrevendo aqui como sempre escreveu: ele
        não é um terminal vivo, e a nota é o resultado dele.
        """
        with self._trab_transacao_de_layout(project_name) as (layout, andar):
            for id_nota, texto in notas:
                nota = self._trab_achar_no(andar, id_nota)
                if nota is not None:
                    nota['texto'] = texto

    # ── Ida e volta: a rodada ────────────────────────────────────────────────

    def _conx_teto_de_rodadas(self, project_name):
        config = self._trab_config_efetiva(project_name)
        return int(config.get('trabalhos_limite_rodadas_ida_e_volta', 4))

    def _conx_rodar_ida_e_volta(self, project_name, andar, id_no):
        """Aciona o outro lado, se ainda houver rodada.

        ⚠️ ESTE É O PONTO DE MAIOR RISCO DA OBRA INTEIRA, e o teto é o que o
        torna aceitável: sem ele isto é um laço que gasta cota paga até alguém
        perceber e apertar "Parar tudo". Ao bater no teto, os DOIS lados
        recebem a linha explicando — quem parou e quem estava esperando a vez.
        """
        teto = self._conx_teto_de_rodadas(project_name)
        for l in andar['ligacoes']:
            if l.get('tipo') != 'ida-e-volta':
                continue
            if id_no not in (l.get('de'), l.get('para')):
                continue
            outro = l['para'] if l['de'] == id_no else l['de']
            if self._trab_terminal_rodando(project_name, outro):
                # O outro lado já está trabalhando: acionar de novo empilharia
                # duas execuções sobre o mesmo terminal, e a segunda seria
                # recusada de qualquer forma.
                continue

            chave = (project_name, l['id'])
            rodada = self._conx_rodadas_dict().get(chave, 0) + 1
            if rodada > teto:
                aviso = (f'Ida e volta parada: bateu o teto de {teto} rodadas. '
                         'Mude o limite em Trabalhos → Configuração, ou mande uma '
                         'mensagem nova para recomeçar a contagem.')
                for ponta in (id_no, outro):
                    self._ofi_registrar_linha(project_name, ponta, 'err', aviso)
                    self._ofi_notify(project_name, ponta, {'status': 'espera', 'estado': 'parado'})
                continue

            self._conx_rodadas_dict()[chave] = rodada
            caminho = self._conx_caminho_do_canal(project_name, l['id'], id_no)
            mensagem = (
                f'[ida e volta · rodada {rodada} de {teto}]\n'
                f'{self._conx_nome(andar, id_no)} acabou de responder. A resposta está em: '
                f'{caminho}\n'
                'Leia, responda, e termine — o que você produzir volta para ele na '
                'próxima rodada.')
            self._ofi_disparar_com_dependencia_ok(project_name, outro, mensagem)

    def _conx_zerar_rodadas_do_no(self, project_name, andar, id_no):
        """Uma mensagem do USUÁRIO recomeça a contagem das idas e voltas do nó.

        É o gesto que diz "outra conversa": manter a contagem antiga faria a
        segunda conversa nascer já perto do teto, sem que nada explicasse por
        que ela parou tão cedo.
        """
        for l in andar['ligacoes']:
            if l.get('tipo') == 'ida-e-volta' and id_no in (l.get('de'), l.get('para')):
                self._conx_rodadas_dict().pop((project_name, l['id']), None)

    def _conx_esquecer_projeto(self, project_name):
        """Some com esperas e rodadas do projeto. É o que "Parar tudo" faz."""
        for chave in list(self._conx_esperas_dict().keys()):
            if chave[0] == project_name:
                self._conx_esperas_dict().pop(chave, None)
        for chave in list(self._conx_rodadas_dict().keys()):
            if chave[0] == project_name:
                self._conx_rodadas_dict().pop(chave, None)

