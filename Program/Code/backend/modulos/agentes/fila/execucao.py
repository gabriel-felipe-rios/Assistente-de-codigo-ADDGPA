"""O núcleo da Fila: uma tarefa, do começo ao relatório.

Este arquivo era 1.292 linhas e virou seis, pelo teto de 500 da AMF. O corte
segue a regra dos Backups, do Inspetor e do `arquivos.py`: **cada arquivo
responde uma pergunta diferente**.

| Arquivo | A pergunta que ele responde |
|---|---|
| `execucao.py` | o que acontece DENTRO de uma tarefa |
| `execucao_constantes.py` | os tetos, os avisos e os envelopes |
| `execucao_orquestracao.py` | que tarefa roda agora, e como se cancela |
| `execucao_preparacao.py` | como a Fila fala com o modelo, e como lê a resposta |
| `execucao_verificacao.py` | o Verificador: o freio que olha o conteúdo |
| `execucao_encerramento.py` | como o desfecho é gravado |

`FilaExecucaoMixin` continua sendo o nome único que `api.py` importa: ele COMPÕE
os quatro mixins irmãos, no padrão de `InspetorMixin` (Convenção 5 da
Arquitetura modular). Nenhum tem `__init__` nem `super()`, o que torna a herança
múltipla inerte.

⚠️ ESTE ARQUIVO CONTINUA ACIMA DE 500 LINHAS, E A CAUSA É UMA SÓ:
`_fila_processar_tarefa` é uma máquina de estados de ~600 linhas com **17
saídas**, todas dentro do mesmo laço e todas compartilhando os mesmos oito
contadores locais (`msgs`, `rodadas`, `devolucoes`, `voltas`, `correcoes`,
`ressalvas`, `ultimo_relatorio`, `ultimo_veredito`). Fatiá-la em métodos exige
passar esse estado por um objeto de contexto — mudança de desenho, não de
arrumação —, e cada saída tem um comentário registrando um defeito que já
aconteceu ali. Enquanto essa obra não for decidida, o resto do arquivo foi
tirado do caminho para que ela fique isolada e legível.

⚠️ SÃO 17 SAÍDAS, e é por isso que o `sinal({'t': 'fim'})` está num `finally` e
não numa linha antes de cada `return`: a que esquecesse deixaria a tira "está
pensando…" girando para sempre numa tarefa que já acabou.
"""

from .execucao_constantes import *
from .execucao_constantes import _VERIFICADOR

from .execucao_orquestracao import FilaExecucaoOrquestracaoMixin
from .execucao_preparacao import FilaExecucaoPreparacaoMixin
from .execucao_verificacao import FilaExecucaoVerificacaoMixin
from .execucao_encerramento import FilaExecucaoEncerramentoMixin
from ...llm_geracao import ajustes_da_chamada


class FilaExecucaoMixin(FilaExecucaoOrquestracaoMixin,
                        FilaExecucaoPreparacaoMixin,
                        FilaExecucaoVerificacaoMixin,
                        FilaExecucaoEncerramentoMixin):
    """A Fila: um agente principal que pesquisa uma tarefa com horizonte longo.

    É o mesmo desenho do Chat — o modelo emite `{"chamadas": [...]}`, o
    programa executa os subagentes e devolve os resultados. A diferença é o
    horizonte de tempo: ninguém está esperando, então o teto de rodadas é 30
    em vez de 2 e não há limite de tempo nenhum.

    Quem escolhe o próximo passo é o modelo, não o código. Antes eram quatro
    etapas em ordem fixa (contexto, análise, verificação, relatório) chamadas
    pelo Python; agora é o agente que decide a quem perguntar e quando parar.

    Dois freios diferentes o seguram, e é de propósito que sejam dois: o
    Contador de rodadas impede rodar para sempre, e o Verificador impede
    entregar errado.

    Determinismo: a tabela de arquivo/mudança do relatório vem sempre do JSON
    estruturado que o agente emite, nunca reescrita em prosa — mesma regra já
    aplicada em `documentacao_tecnica.py` (o LLM nunca é a fonte de um fato
    verificável, só de prosa).
    """

    # ── Núcleo: uma tarefa, do começo ao relatório ─────────────────────────────

    def _fila_processar_tarefa(self, project_name, tarefa_id, model, cfg=None):
        cfg = cfg or self._fila_config(None)
        with self._fila_transacao(project_name) as state:
            tarefa = self._fila_find_tarefa(state, tarefa_id)
            if not tarefa:
                return
            tarefa['status'] = FILA_STATUS_PESQUISANDO
            tarefa['iniciado_em'] = datetime.now().isoformat()
            # ⚠️ E `concluido_em` zera JUNTO. Ele ficava com a conclusão da
            # passada ANTERIOR enquanto `iniciado_em` já era de agora: a tela
            # calculava uma duração negativa e mostrava "Levou 0 s" numa tarefa
            # que estava pesquisando na sua frente.
            tarefa['concluido_em'] = None
            # A tarefa manda: os dois campos foram gravados nela quando ela
            # entrou em jogo (ver `iniciar_fila`). Tarefa antiga, salva antes
            # desta mudança, não tem os campos e segue pela configuração atual.
            if tarefa.get('max_rodadas'):
                cfg = dict(cfg, max_rodadas=int(tarefa['max_rodadas']))
            if tarefa.get('devolucoes_permitidas'):
                cfg = dict(cfg, devolucoes=int(tarefa['devolucoes_permitidas']))
            if tarefa.get('max_voltas'):
                cfg = dict(cfg, max_voltas=int(tarefa['max_voltas']))
            # ⚠️ Aqui havia `tarefa['sub_tags'] = []`, e ele apagava as marcas de
            # TODA passada — inclusive a que está apenas continuando de onde
            # caiu. Como `_fila_find_tarefa` devolve a referência viva de dentro
            # do estado, a limpeza chegava também ao `ressalvas = set(...)` lá
            # embaixo, que por isso nascia sempre vazio.
            # Quem limpa agora é `complementar_tarefa_fila`, e só quando a
            # passada anterior ENTREGOU relatório: aí sim começa passada nova.
            tarefa = dict(tarefa)
        self._fila_notify_tarefa(project_name, tarefa)

        # Ferramentas que o Verificador chegou a rodar. Serve de lastro: ele só
        # pode alegar "trecho não encontrado" se de fato tiver feito um grep —
        # mesma regra que já vale para existência de arquivo, onde o LLM nunca
        # é a fonte.
        ferramentas_usadas = set()
        # ⚠️ O TERMO buscado, e não só "houve algum grep". Guardar apenas o nome
        # da ferramenta não resolve: no caso real o Verificador fez greps de
        # OUTROS termos, e qualquer um deles liberaria todos os itens. O lastro
        # é do termo. O termo já vinha no mesmo evento e era descartado.
        termos_grepados = set()

        def sinal(ev):
            """Um sinal AO VIVO para a conversa. Ver `_fila_notify_sinal`."""
            self._fila_notify_sinal(project_name, tarefa_id, ev)

        def log_cb(ev):
            if ev.get('agente') == 'ferramenta' and ev.get('subagente') == _VERIFICADOR:
                ferramentas_usadas.add(ev.get('nome'))
                if ev.get('nome') == 'grep':
                    termo = (ev.get('parametros') or {}).get('termo')
                    if isinstance(termo, str) and termo.strip():
                        termos_grepados.add(termo.strip().lower())
            self._fila_log_evento(project_name, tarefa_id, ev)

        # ⚠️ Nascem ANTES do `try`, e é de propósito. Os cinco só são atribuídos
        # lá dentro, várias linhas depois do `try:` — e o `except` lá embaixo
        # usa os cinco. Exceção levantada antes dessas atribuições fazia o
        # próprio `except` levantar NameError, que SUBSTITUÍA o erro real: a
        # Fila passava a falhar sempre com "name 'msgs' is not defined" e a
        # causa verdadeira sumia de todos os diagnósticos.
        msgs = []
        rodadas = 0
        devolucoes = 0
        voltas = 0
        ressalvas = set()

        try:
            # O complemento NÃO é acrescentado aqui: `complementar_tarefa_fila`
            # já o gravou no histórico no momento em que você apertou Enviar —
            # é o que faz a sua frase aparecer na conversa antes de a pesquisa
            # recomeçar. Repeti-lo aqui mandaria a mesma frase duas vezes.
            msgs = self.carregar_fila_historico(project_name, tarefa_id)
            if not msgs:
                # O prompt fixo entra ENTRE o system e a tarefa: o system diz
                # como a Fila trabalha, o prompt fixo diz o que procurar nesta
                # tarefa, e a tarefa diz onde. `carregar_prompt_fixo` é do
                # ChatPersistenciaMixin, irmão deste na mesma classe `Api` —
                # não precisa de import, e não deve ser duplicada.
                msgs = [{'role': 'system',
                         'content': self._fila_system_prompt(project_name, cfg)}]
                prompt_fixo = tarefa.get('prompt_fixo')
                if prompt_fixo:
                    texto_fixo = self.carregar_prompt_fixo(prompt_fixo, PASTA_FILA)
                    # Pode vir None se o arquivo sumir do disco. Tarefa com prompt
                    # fixo apagado roda como pesquisa comum, sem quebrar.
                    if texto_fixo:
                        msgs.append({'role': 'user', 'content': texto_fixo,
                                     'meta': {'tipo': 'prompt_fixo',
                                              'nome': prompt_fixo}})
                        # 'sistema' de propósito: `subagentes.css` já tem regra de
                        # cor para ele. Com o nome do prompt, o título do grupo
                        # sairia branco — não há token --sub-* para eles.
                        log_cb({'agente': 'sistema',
                                'mensagem': f'Prompt fixo aplicado: {prompt_fixo}'})
                msgs.append({'role': 'user', 'content': tarefa['texto']})

            # Rodadas e devoluções são POR TAREFA e sobrevivem ao complemento:
            # quem já gastou 28 de 30 rodadas não ganha 30 novas por ter
            # recebido uma frase a mais.
            rodadas = tarefa.get('rodadas_usadas') or 0
            devolucoes = tarefa.get('devolucoes') or 0
            # Voltas ao modelo. Mesmo princípio das rodadas: é orçamento POR
            # TAREFA e sobrevive ao complemento — quem já deu 118 de 120 voltas
            # não ganha 120 novas por ter recebido uma frase a mais.
            voltas = tarefa.get('voltas_usadas') or 0
            correcoes = 0
            max_tentativas = self._sub_limite('max_tentativas_correcao')
            # Quantas vezes o agente pediu subagentes DEPOIS de o teto de
            # rodadas ter acabado. Precisa nascer aqui, junto dos outros
            # contadores: dentro do laço, zeraria a cada volta.
            insistencias_apos_teto = 0
            # O último relatório válido que ele chegou a entregar, e o veredito
            # dele. Se o Verificador devolveu e ele voltou a pesquisar, o
            # relatório existe e não pode ser jogado fora no encerramento.
            ultimo_relatorio = None
            ultimo_veredito = None
            # Só as ressalvas de PESQUISA são herdadas. As outras sub-tags
            # explicam por que a passada anterior parou (`lm_studio_offline`,
            # `tarefa_vaga`, …) e não são defeito do relatório — herdá-las faria
            # o próximo relatório abrir com uma ressalva que já não vale.
            ressalvas = set(tarefa.get('sub_tags') or []) & set(FILA_SUBTAGS_RESSALVA)
            # A conta corrente de leitura vale POR TAREFA — aqui, a tarefa da
            # fila inteira, com as suas ate 30 rodadas. Ver rastro_leitura.py.
            rastro = RastroDeLeitura()

            from ...llm_cliente import abrir_cliente_do_lm_studio
            settings = self.load_settings()['settings']
            client = abrir_cliente_do_lm_studio(settings, projeto=project_name)

            # ⚠️ O texto que VOCÊ escreveu entra no Log, como o Chat já fazia
            # (`{'agente': 'usuario', 'mensagem': user_message}`). A Fila
            # registrava sistema, correção, subagente e ferramenta — tudo menos
            # a frase que começou a pesquisa. Dava para ver as 200 chamadas de
            # ferramenta de trinta rodadas e não achar o pedido.
            #
            # `proxima_mensagem_usuario` existe quando esta passada começou por
            # um COMPLEMENTO; é ele que vai ao Log nesse caso, e não o texto
            # inteiro da tarefa (que já traz todos os complementos concatenados,
            # e apareceria repetido a cada passada).
            complemento = tarefa.get('proxima_mensagem_usuario')
            log_cb({'agente': 'usuario',
                    'mensagem': complemento or tarefa.get('texto') or '',
                    'inicio': datetime.now().isoformat()})
            log_cb({'agente': 'fila', 'evento': 'inicio'})

            # O histórico ia para o disco só DEPOIS da primeira resposta do
            # modelo, e até lá a sub-aba Contexto dizia "esta tarefa ainda não
            # foi enviada ao modelo" — enquanto ela já estava sendo enviada. O
            # system, o prompt fixo e a tarefa existem e já foram mandados neste
            # ponto; gravá-los aqui não antecipa nada que não tenha acontecido.
            self._fila_gravar_historico(project_name, tarefa_id, msgs)

            while True:
                # "Cancelar" para TODAS as tarefas em execução, e não só impede
                # a próxima começar. O corte acontece aqui, no fim de uma
                # rodada: ⛔ nada de abortar uma requisição pela metade — o
                # trabalho da rodada já foi pago, e jogá-lo fora seria o oposto
                # do que o cancelamento quer. A tarefa volta para "na fila" com
                # a conversa inteira guardada, e recomeça de onde parou.
                # ⚠️ E o Chat É EXCEÇÃO a este ⛔, de propósito. Lá o "Parar"
                # corta no meio (`parar_chat`, chat_mensagem.py) porque lá há
                # gente na frente da tela esperando: mandar parar e ver a
                # resposta continuar por mais uma rodada inteira foi a queixa
                # que originou o botão. Aqui não há ninguém esperando — uma
                # pesquisa roda por horas —, e o corte no fim da rodada continua
                # sendo o certo.
                # ℹ️ O mecanismo da Obra 14 deixou o Cancelar daqui mais rápido
                # de graça, sem contrariar este ⛔: o porteiro do subagente
                # desiste ANTES de pedir a próxima coisa, nunca no meio de uma
                # requisição já paga.
                # Fechar a aba do projeto entra pela mesma porta do Cancelar: as
                # duas querem dizer "pare de pedir coisas ao LM Studio por causa
                # deste projeto". Ver `agentes/parada_do_projeto.py`.
                if self._fila_cancel_map().get(project_name) or self.projeto_parado(project_name):
                    log_cb({'agente': 'sistema',
                            'mensagem': 'Pesquisa cancelada por você. A conversa está '
                                        'guardada; "Iniciar tarefas" continua de onde parou.'})
                    self._fila_gravar_historico(project_name, tarefa_id, msgs)
                    self._fila_marcar_progresso(project_name, tarefa_id, rodadas,
                                                devolucoes, voltas=voltas)
                    self._fila_despromover(project_name, [tarefa_id],
                                           de=FILA_STATUS_PESQUISANDO)
                    return

                # ⚠️ O cinto de segurança do laço, e ele conta TODA volta — não
                # só as que gastam rodada. As voltas que não gastam rodada
                # (correção de formato, devolução do Verificador, insistência
                # depois do teto) são justamente as que faziam o laço girar sem
                # nunca terminar. Incrementa ANTES da chamada: uma volta que
                # estourou no meio já foi paga.
                voltas += 1
                if voltas > cfg['max_voltas']:
                    log_cb({'agente': 'sistema',
                            'mensagem': f'A pesquisa foi encerrada: bateu o teto de '
                                        f'{cfg["max_voltas"]} voltas ao modelo nesta '
                                        f'tarefa.'})
                    self._fila_gravar_historico(project_name, tarefa_id, msgs)
                    if ultimo_relatorio is not None:
                        return self._fila_encerrar(project_name, tarefa_id,
                                                   ultimo_relatorio, ressalvas,
                                                   rodadas, devolucoes,
                                                   ultimo_veredito, voltas=voltas)
                    return self._fila_marcar_falha(
                        project_name, tarefa_id, 'pesquisa_incompleta',
                        f'bateu o teto de {cfg["max_voltas"]} voltas ao modelo sem '
                        f'entregar relatório',
                        rodadas=rodadas, devolucoes=devolucoes, ressalvas=ressalvas,
                        voltas=voltas)

                # ⏳ O sinal ao vivo. Esta chamada é a parte LONGA da rodada, e
                # era a parte em que a tela não dizia nada.
                sinal({'t': 'preparando'})
                # Sem `timeout`: a pesquisa demora o que precisar. O freio é o
                # Contador de rodadas, logo abaixo, e nada mais.
                #
                # ⚠️ COM ESQUEMA. É gramática léxica: a tarefa que falhou nove
                # vezes falhou com a MESMA resposta byte a byte, porque o modelo
                # escreveu uma aspa não escapada dentro de uma string JSON — e
                # um decodificador restrito nunca oferece a aspa nua ali.
                # `_schema_da_fila` devolve `None` com o "Formato garantido"
                # desligado, e aí `chat_json` cai na chamada normal de sempre.
                try:
                    resp = chat_json(client, model, preparar_mensagens(msgs),
                                     schema=self._schema_da_fila(), name='fila',
                                     **ajustes_da_chamada(self.load_settings()['settings'], 'fila', model))
                except FormatoNaoObedecido as e_gram:
                    # ⚠️ Tratada AQUI, e não deixada subir. Ela subiria ao
                    # `except` genérico lá de fora e MATARIA A TAREFA INTEIRA,
                    # com todas as rodadas já pagas — quando o que ela diz é
                    # "escorreguei nesta geração; a próxima pode sair perfeita".
                    # Entra no orçamento de correções que já existe.
                    correcoes += 1
                    descricao = ('a sua resposta não obedeceu ao formato exigido '
                                 f'({e_gram}). Responda de novo, com um dos três '
                                 'envelopes e nada em volta.')
                    msgs.append({'role': 'user', 'meta': {'tipo': 'correcao'},
                                 'content': self._fila_correcao(descricao, cfg)})
                    if correcoes > max_tentativas:
                        self._fila_gravar_historico(project_name, tarefa_id, msgs)
                        return self._fila_marcar_falha(
                            project_name, tarefa_id, 'formato_invalido',
                            f'não obedeceu ao formato após {max_tentativas} correções',
                            rodadas=rodadas, devolucoes=devolucoes,
                            ressalvas=ressalvas, voltas=voltas)
                    log_cb({'agente': 'correcao', 'alvo': 'fila',
                            'descricao_erro': descricao, 'tentativa': correcoes})
                    sinal({'t': 'aviso',
                           'texto': f'O modelo escorregou no formato '
                                    f'(tentativa {correcoes} de {max_tentativas}). '
                                    f'Pedindo de novo…'})
                    continue
                # ⚠️ CRU no histórico, limpo só para o parse — o mesmo que o
                # subagente faz, e pelo mesmo motivo: o raciocínio da rodada
                # anterior ajuda a seguinte, e reescrever a mensagem quebra o
                # reaproveitamento de cache do servidor.
                raw = resp.choices[0].message.content or ''
                self._fila_somar_uso(resp, log_cb)

                # O envelope é procurado na cópia limpa: um `{"relatorio": …}`
                # rascunhado dentro do `<think>` seria encontrado primeiro no
                # texto cru, e a tarefa terminaria com o rascunho.
                limpo = strip_thinking(raw)
                chave, obj, err = self._fila_envelope(limpo)

                # Toda resposta do agente principal é JSON — chamada, pedido de
                # esclarecimento ou relatório —, e nenhuma é fala para você. A
                # marca diz isso à tela, que então não a transforma em balão,
                # do mesmo jeito que o Chat não mostra o JSON de chamada dele
                # (`chat-mensagens.js`). O que você lê sai do JSON depois de
                # tratado: o motivo, na bolha de alerta, e o relatório, no
                # bloco "Ver relatório". O conteúdo cru continua inteiro no
                # histórico — some da conversa, não do registro.
                # ⚠️ A FALA vai carimbada no `meta`, e não deixada para a tela
                # recortar do texto cru. Isso resolve de graça os dois casos em
                # que o recorte falhava: um `<think>` em volta (a tela recortava
                # o raciocínio junto) e um JSON cortado no meio (o recorte
                # desistia e devolvia a mensagem inteira, que virava balão).
                # Aqui o campo já veio separado pelo próprio decodificador.
                #
                # ⚠️ Antes disto, a frase que o agente escrevia antes do JSON era
                # DESOBEDIÊNCIA: o prompt manda "nada antes, nada depois" e nunca
                # autorizou prosa. O programa se acostumou a colher algo que ele
                # próprio proibia. O campo `fala` transforma essa tolerância
                # acidental em contrato explícito.
                msgs.append({'role': 'assistant', 'content': raw,
                             'meta': {'tipo': 'resposta_json', 'envelope': chave,
                                      'fala': str((obj or {}).get('fala') or '').strip()}})

                # ── formato ilegível ──────────────────────────────────────
                if chave is None:
                    correcoes += 1
                    descricao = self._fila_motivo_do_formato(resp, raw, limpo, err)
                    # ⚠️ A correção entra no histórico ANTES do teste de
                    # desistência, e é isto que conserta o "Continuar" mudo: na
                    # ordem antiga ela era escrita DEPOIS, então na última
                    # tentativa ela nunca chegava ao disco. O histórico salvo
                    # terminava numa fala do próprio modelo, e ao continuar ele
                    # era chamado logo depois de si mesmo — respondia vazio, e
                    # cada clique queimava 1 das 3 chamadas sem sair do lugar.
                    # ⛔ Só ACRESCENTA. Nada do que já foi dito é podado.
                    msgs.append({'role': 'user', 'meta': {'tipo': 'correcao'},
                                 'content': self._fila_correcao(descricao, cfg)})
                    if correcoes > max_tentativas:
                        log_cb({'agente': 'sistema',
                                'mensagem': 'Desisti depois de '
                                            f'{max_tentativas} correções. O pedido de '
                                            'correção fica gravado no histórico: é dele '
                                            'que o "Continuar" parte.'})
                        self._fila_gravar_historico(project_name, tarefa_id, msgs)
                        return self._fila_marcar_falha(
                            project_name, tarefa_id, 'formato_invalido',
                            f'devolveu formato inválido após {max_tentativas} correções',
                            rodadas=rodadas, devolucoes=devolucoes, ressalvas=ressalvas,
                            voltas=voltas)
                    log_cb({'agente': 'correcao', 'alvo': 'fila',
                            'descricao_erro': descricao, 'tentativa': correcoes})
                    # Isto só aparecia no Log, que é outra aba: da conversa, o
                    # que se via era a Fila parada sem explicação nenhuma.
                    sinal({'t': 'aviso',
                           'texto': f'O modelo respondeu fora do formato '
                                    f'(tentativa {correcoes} de {max_tentativas}). '
                                    f'Pedindo de novo…'})
                    continue

                # ── parou para perguntar ──────────────────────────────────
                if chave == 'precisa_de_voce':
                    pedido = obj.get('precisa_de_voce') or {}
                    sub_tag = pedido.get('sub_tag')
                    if sub_tag not in FILA_SUBTAGS_PRECISA_DE_VOCE:
                        sub_tag = 'tarefa_vaga'
                    self._fila_gravar_historico(project_name, tarefa_id, msgs)
                    log_cb({'agente': 'fila', 'evento': 'fim',
                            'resposta': pedido.get('motivo')})
                    self._fila_marcar_status(
                        project_name, tarefa_id, FILA_STATUS_PRECISA_DE_VOCE,
                        sub_tags=[sub_tag], rodadas_usadas=rodadas, devolucoes=devolucoes,
                        voltas_usadas=voltas,
                        motivo_esclarecimento=pedido.get('motivo'),
                        proxima_mensagem_usuario=None)
                    return

                # ── chamou subagentes ─────────────────────────────────────
                if chave == 'chamadas':
                    chamadas, err_ch = validar_chamadas(obj, cfg['ativos'])
                    if err_ch:
                        correcoes += 1
                        # Mesma inversão do ramo de formato ilegível, e pelo
                        # mesmo motivo — ver o ⚠️ lá em cima.
                        msgs.append({'role': 'user', 'meta': {'tipo': 'correcao'},
                                     'content': self._fila_correcao(err_ch, cfg)})
                        if correcoes > max_tentativas:
                            log_cb({'agente': 'sistema',
                                    'mensagem': 'Desisti depois de '
                                                f'{max_tentativas} correções. O pedido de '
                                                'correção fica gravado no histórico: é dele '
                                                'que o "Continuar" parte.'})
                            self._fila_gravar_historico(project_name, tarefa_id, msgs)
                            return self._fila_marcar_falha(
                                project_name, tarefa_id, 'formato_invalido',
                                f'chamada inválida após {max_tentativas} correções',
                                rodadas=rodadas, devolucoes=devolucoes,
                                ressalvas=ressalvas, voltas=voltas)
                        log_cb({'agente': 'correcao', 'alvo': 'fila',
                                'descricao_erro': err_ch, 'tentativa': correcoes})
                        continue

                    if rodadas >= cfg['max_rodadas']:
                        # Bateu o teto e ainda quis pesquisar: a pesquisa ficou
                        # incompleta, e isso vira ressalva no relatório.
                        ressalvas.add('pesquisa_incompleta')
                        insistencias_apos_teto += 1
                        if insistencias_apos_teto == 1:
                            # Este `continue` era o ÚNICO do laço que não gravava
                            # nada e não incrementava nada: gravar aqui é o que
                            # impede a insistência de custar a passada inteira.
                            msgs.append({'role': 'user',
                                         'meta': {'tipo': 'aviso_sistema'},
                                         'content': AVISO_CHAMADAS_RECUSADAS})
                            log_cb({'agente': 'sistema',
                                    'mensagem': AVISO_CHAMADAS_RECUSADAS})
                            # ⛔ Faixa SEM botão: aqui não há o que retomar. Quem
                            # decide continuar é você, pelos botões de continuar,
                            # e só depois que a tarefa termina.
                            sinal({'t': 'faixa',
                                   'texto': 'O teto de rodadas acabou — as chamadas '
                                            'pedidas agora não foram executadas.'})
                            self._fila_gravar_historico(project_name, tarefa_id, msgs)
                            continue
                        # Segunda vez: ele já foi avisado de que as chamadas não
                        # seriam executadas e insistiu assim mesmo. Encerra sem
                        # perguntar de novo — perguntar era o laço infinito.
                        log_cb({'agente': 'sistema',
                                'mensagem': 'A pesquisa foi encerrada: o teto de rodadas '
                                            'acabou e o agente continuou pedindo '
                                            'subagentes em vez de escrever o relatório.'})
                        self._fila_gravar_historico(project_name, tarefa_id, msgs)
                        if ultimo_relatorio is not None:
                            # Entregou relatório em algum momento (foi devolvido
                            # pelo Verificador e ele voltou a pesquisar): o
                            # desfecho é o normal, como já era.
                            return self._fila_encerrar(project_name, tarefa_id,
                                                       ultimo_relatorio, ressalvas,
                                                       rodadas, devolucoes,
                                                       ultimo_veredito, voltas=voltas)
                        return self._fila_marcar_falha(
                            project_name, tarefa_id, 'pesquisa_incompleta',
                            'o teto de rodadas acabou e o agente continuou pedindo '
                            'subagentes em vez de escrever o relatório',
                            rodadas=rodadas, devolucoes=devolucoes, ressalvas=ressalvas,
                            voltas=voltas)

                    correcoes = 0
                    rodadas += 1
                    sinal({'t': 'sub-inicio', 'chamadas': chamadas})
                    # ⚠️ `obter_parada` PASSOU A SER PASSADO, e antes não era.
                    # O porteiro de cada subagente já sabia obedecê-lo
                    # (`subagentes.py`), mas a Fila nunca o entregava — então
                    # uma leva de subagentes disparada por ela ia até o fim,
                    # mesmo com o Cancelar apertado ou com a aba do projeto
                    # fechada. Podiam ser vários minutos de LM Studio ocupado
                    # por um trabalho que ninguém mais queria.
                    #
                    # O estágio 2 é o mesmo do Chat: "pare agora". Vale para as
                    # duas causas — o Cancelar da Fila e o fechar da aba —,
                    # porque as duas querem exatamente isso.
                    def _fila_parada():
                        if self._fila_cancel_map().get(project_name):
                            return 2
                        return 2 if self.projeto_parado(project_name) else 0

                    resultados, bloco = self._executar_chamadas_subagentes(
                        project_name, chamadas, model, log_cb, cfg['max_tokens'],
                        rastro, obter_parada=_fila_parada, origem='Fila')
                    # Só os quatro campos que o cartão desenha. `resultados`
                    # carrega também o `contexto` de cada subagente — a janela
                    # inteira dele —, e isso não pode atravessar o
                    # `evaluate_js` a cada rodada.
                    sinal({'t': 'sub-fim',
                           'resultados': [{'nome': r.get('nome'),
                                           'pergunta': r.get('pergunta'),
                                           'resposta': r.get('resposta'),
                                           'erro': r.get('erro')}
                                          for r in resultados]})
                    # Erro de CAMINHO não conta: o Navegador respondendo "essa
                    # pasta não existe" é exploração dando certo, e chutar
                    # caminho é o trabalho dele. Antes, um único chute errado em
                    # doze rodadas carimbava a tarefa inteira de "subagente
                    # indisponível" — o que fazia a ressalva perder o sentido
                    # justamente por aparecer sempre.
                    # 'parcial' é isento pelo mesmo princípio do 'caminho': a
                    # ENTREGA PARCIAL devolve `erro` preenchido junto com o que
                    # o subagente leu de verdade. Carimbar a tarefa por causa
                    # dela faria a ressalva aparecer sempre — e ela já aparecia
                    # em 4 dos 5 relatórios.
                    if any(r.get('erro')
                           and r.get('erro_tipo') not in ('caminho', 'parcial')
                           for r in resultados):
                        ressalvas.add('subagente_indisponivel')

                    aviso = None
                    if rodadas >= cfg['max_rodadas']:
                        aviso = AVISO_ULTIMA_RODADA_FILA
                    elif cfg['contador']:
                        restantes = cfg['max_rodadas'] - rodadas
                        aviso = (f'[AVISO DO SISTEMA] Você usou {rodadas} de '
                                 f'{cfg["max_rodadas"]} rodada(s) de chamadas de subagentes. '
                                 f'Resta(m) {restantes} rodada(s).')
                    if aviso:
                        bloco += '\n\n' + aviso
                        log_cb({'agente': 'sistema', 'mensagem': aviso})

                    msgs.append({'role': 'user', 'content': bloco,
                                 'meta': {'tipo': 'resultado_subagentes',
                                          'resultados': resultados, 'aviso': aviso}})

                    # Um bloco so, substituido a cada rodada — nunca empilhado.
                    linha_rastro = rastro.bloco()
                    if linha_rastro:
                        msgs[:] = [m for m in msgs
                                   if (m.get('meta') or {}).get('tipo') != META_RASTRO]
                        msgs.append({'role': 'user', 'content': linha_rastro,
                                     'meta': {'tipo': META_RASTRO}})

                    self._fila_gravar_historico(project_name, tarefa_id, msgs)
                    self._fila_marcar_progresso(project_name, tarefa_id, rodadas, devolucoes,
                                                voltas=voltas)
                    continue

                # ── entregou o relatório ──────────────────────────────────
                relatorio, err_rel = validar_relatorio(obj)
                if err_rel:
                    correcoes += 1
                    # O terceiro e último ponto de correção da Fila. Mesma
                    # inversão dos dois de cima — ver o ⚠️ do primeiro.
                    msgs.append({'role': 'user', 'meta': {'tipo': 'correcao'},
                                 'content': self._fila_correcao(err_rel, cfg)})
                    if correcoes > max_tentativas:
                        log_cb({'agente': 'sistema',
                                'mensagem': 'Desisti depois de '
                                            f'{max_tentativas} correções. O pedido de '
                                            'correção fica gravado no histórico: é dele '
                                            'que o "Continuar" parte.'})
                        self._fila_gravar_historico(project_name, tarefa_id, msgs)
                        return self._fila_marcar_falha(
                            project_name, tarefa_id, 'formato_invalido',
                            f'relatório inválido após {max_tentativas} correções',
                            rodadas=rodadas, devolucoes=devolucoes, ressalvas=ressalvas,
                            voltas=voltas)
                    log_cb({'agente': 'correcao', 'alvo': 'fila',
                            'descricao_erro': err_rel, 'tentativa': correcoes})
                    continue

                correcoes = 0
                ultimo_relatorio = relatorio
                log_cb({'agente': 'fila', 'evento': 'fim', 'resposta': relatorio.get('resumo')})

                if not cfg['verificador']:
                    self._fila_gravar_historico(project_name, tarefa_id, msgs)
                    return self._fila_encerrar(project_name, tarefa_id, relatorio,
                                               ressalvas, rodadas, devolucoes, None,
                                               voltas=voltas)

                veredito = self._fila_verificar(project_name, tarefa, relatorio, model,
                                                log_cb, cfg, ferramentas_usadas,
                                                termos_grepados)
                ultimo_veredito = veredito

                if veredito['indisponivel']:
                    # Sem Verificador não há aprovação, mas também não há
                    # devolução: reprovar por defeito do programa faria o
                    # agente refazer trabalho que podia estar bom.
                    ressalvas.add('subagente_indisponivel')
                    self._fila_gravar_historico(project_name, tarefa_id, msgs)
                    return self._fila_encerrar(project_name, tarefa_id, relatorio,
                                               ressalvas, rodadas, devolucoes, veredito,
                                               voltas=voltas)

                if veredito['aprovado']:
                    self._fila_gravar_historico(project_name, tarefa_id, msgs)
                    return self._fila_encerrar(project_name, tarefa_id, relatorio,
                                               ressalvas, rodadas, devolucoes, veredito,
                                               voltas=voltas)

                # ⚠️ O incremento vem DEPOIS da conferência do teto, e é isso
                # que conserta o off-by-one. Antes era `devolucoes += 1` e só
                # então `if devolucoes >= cfg['devolucoes']`: com o padrão 3 o
                # modelo via "1 de 3" e "2 de 3", e na TERCEIRA reprovação o
                # programa desistia sem mandar nada. Ele tinha duas chances, não
                # três, e nunca via "3 de 3". Com o mínimo que a tela permite
                # (`min: 1`), o Verificador não devolvia uma vez sequer.
                #
                # Agora o teto conta DEVOLUÇÕES MANDADAS, que é o que o número
                # na tela promete — e o contador que chega ao relatório para em
                # 3, em vez de escrever "reprovou 4 vez(es)".
                if devolucoes >= cfg['devolucoes']:
                    ressalvas |= set(veredito['sub_tags'])
                    self._fila_gravar_historico(project_name, tarefa_id, msgs)
                    return self._fila_encerrar(project_name, tarefa_id, relatorio,
                                               ressalvas, rodadas, devolucoes, veredito,
                                               voltas=voltas)

                devolucoes += 1
                msgs.append({'role': 'user', 'meta': {'tipo': 'devolucao'},
                             'content': (f'[DEVOLUÇÃO DO VERIFICADOR — {devolucoes} de '
                                         f'{cfg["devolucoes"]}]\n{veredito["motivo"]}\n\n'
                                         'Pesquise o que faltou e reescreva o relatório.')})
                self._fila_gravar_historico(project_name, tarefa_id, msgs)
                self._fila_marcar_progresso(project_name, tarefa_id, rodadas, devolucoes,
                                                voltas=voltas)
                continue

        except Exception as e:
            # A mais provável das 17 saídas do laço (o LM Studio caindo no meio
            # de 30 rodadas) era a ÚNICA que não gravava nada: a conversa da
            # passada inteira e os contadores — rodadas que rodaram de verdade e
            # foram pagas — sumiam da conta. Grava antes de marcar a falha.
            falha_ao_gravar = None
            if msgs:
                try:
                    self._fila_gravar_historico(project_name, tarefa_id, msgs)
                except Exception as e_disco:
                    # Engolir aqui esconderia o segundo defeito atrás do
                    # primeiro. O erro do disco viaja junto do erro real.
                    falha_ao_gravar = str(e_disco)
            sub_tag = 'lm_studio_offline' if self._fila_parece_offline(e) else 'erro_inesperado'
            mensagem = str(e)
            if falha_ao_gravar:
                mensagem += f' (e o histórico não pôde ser gravado: {falha_ao_gravar})'
            self._fila_marcar_falha(project_name, tarefa_id, sub_tag, mensagem,
                                    rodadas=rodadas, devolucoes=devolucoes,
                                    ressalvas=ressalvas, voltas=voltas)
        finally:
            # ⚠️ `finally`, e não uma linha antes de cada `return`: são 17 saídas
            # deste laço, e a que esquecesse deixaria a tira "está pensando…"
            # girando para sempre numa tarefa que já acabou.
            sinal({'t': 'fim'})
