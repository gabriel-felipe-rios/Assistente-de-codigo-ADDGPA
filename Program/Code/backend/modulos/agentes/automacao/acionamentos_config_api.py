"""A API da sub-aba Automação: ligar, desligar, limpar e perguntar o estado.

⚠️ "LIGAR TUDO" NÃO É UM LAÇO DE `set_acionamento`. `_ac_ligar_e_vigiar` liga o
conjunto E acorda o vigia numa transação só: ligar uma a uma gravaria o arquivo
N vezes e deixaria o vigia sem saber que passou a ter o que vigiar — o sintoma é
tudo ligado na tela e nada acontecendo no disco.

⚠️ `limpar_dados_agentes` SÓ APAGA O QUE O PROGRAMA REFAZ. Tudo que ele oferece é
artefato de rotina; nada do usuário entra nessa lista, e nada que o usuário
escreveu pode ser acrescentado a ela.

⚠️ `get_espera_status` É QUEM SABE SE O VIGIA ESTÁ DE PÉ, e não as settings. O
Detector é uma thread; a chave da Espera diz o que o usuário escolheu, não o que
está acontecendo. Ler a chave em vez de perguntar fazia a tela dizer
"monitoramento desligado" com o programa vigiando o disco normalmente.
"""

import json
import os
import shutil
import threading
import time

from ...constantes import *
from ..trava_ia import TRAVA_IA


class AcionamentosConfigApiMixin:

    # ── API pública ────────────────────────────────────────────────────────

    def get_acionamentos(self, project_name):
        try:
            return {'success': True, 'settings': self._ac_load_settings(project_name)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def set_acionamento(self, project_name, agent_id, trigger):
        try:
            settings = self._ac_load_settings(project_name)
            settings[agent_id] = trigger
            self._ac_save_settings(project_name, settings)
            # Desligar a rotina que está rodando a para de verdade, e só ela;
            # religar a solta de novo (D15).
            if trigger == 'off':
                self.projeto_parar_rotinas(project_name, agent_id)
            else:
                self.projeto_retomar_rotinas(project_name, agent_id)

            if self._ac_deve_vigiar(settings):
                self._ac_subir_espera(project_name)
            else:
                self._ac_parar_espera(project_name)

            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}


    def _ac_ligar_agentes(self, settings):
        """Liga o conjunto padrão de agentes: file_change para os independentes,
        chain para os dependentes — os mesmos triggers que cada toggle usa
        individualmente. Seguro ligar tudo de uma vez porque _ac_run_cycle já
        resolve a ordem sozinho (a base primeiro, depois independentes, depois
        dependentes checando requisitos).

        ⚠️ A BASE FICA DE FORA, e não é esquecimento: Detector, Hashes e
        Sincronia não têm chave (ver `_AC_LIGAR_FORA`). O antigo parâmetro
        `incluir_sincronia` sumiu junto — ele existia para o antigo 'Iniciar' não ligar
        a Sincronia num projeto sem linha de base, e agora nenhum botão liga a
        Sincronia, porque ela não é mais uma etapa que se escolhe.

        ⚠️ **A LISTA É DERIVADA, e isso é o conserto de um bug real.** Até
        22/08/2026 eram doze ids escritos à mão aqui, e a lista canônica tinha
        quatorze: o **Duplicados nunca foi ligado** por 'Ativar tudo' nem pelo
        antigo 'Iniciar', embora o tooltip dos dois prometesse "TODAS as
        rotinas". Pior, o antigo 'Início rápido' — que ligava um subconjunto
        MENOR, de propósito — o ligava, porque a lista dele foi escrita depois
        e não esqueceu. O botão que ligava menos coisa fazia mais que o que
        ligava tudo.

        Foi a terceira lista literal por rotina a ficar para trás quando nasceu
        uma rotina nova. Então ela deixou de ser literal: `_AC_DEFAULTS`, vinte
        linhas acima, já deriva de `IDS_DAS_ROTINAS`, e é o mesmo remédio.

        O trigger sai de `_AC_REQUISITOS`, que já carrega exatamente essa
        distinção: **quem não tem pré-requisito é independente** (`file_change`,
        dispara sozinho ao mudar arquivo) e **quem tem depende de outra**
        (`chain`, encadeia depois dela). Não é um critério novo inventado aqui
        — é o mesmo que o ciclo usa para ordenar a fila.
        """
        for agent_id in IDS_DAS_ROTINAS:
            if agent_id in self._AC_LIGAR_FORA:
                continue
            # ⚠️ A trava. Derivar resolve o esquecimento de LIGAR a rotina, mas
            # abre um segundo buraco, mais quieto: uma rotina nova que ninguém
            # declarou em `_AC_REQUISITOS` cairia no `else` e viraria
            # 'file_change' — ou seja, seria ligada como independente mesmo
            # dependendo de outra, e rodaria antes do que precisa. Aqui isso
            # vira um erro que aparece, em vez de uma fila silenciosamente
            # fora de ordem.
            if agent_id not in self._AC_REQUISITOS:
                raise KeyError(
                    "Rotina '%s' está em IDS_DAS_ROTINAS mas não em _AC_REQUISITOS: "
                    "declare os pré-requisitos dela (tupla vazia se não tiver nenhum) "
                    "em acionamentos_pipeline.py, ou acrescente-a a _AC_LIGAR_FORA se "
                    "ela não deve ter toggle." % agent_id)
            settings[agent_id] = 'chain' if self._AC_REQUISITOS[agent_id] else 'file_change'
        return settings

    def _ac_ligar_e_vigiar(self, project_name, fora=(), origem='ativar-tudo'):
        """Tronco comum de 'Ativar tudo' e 'Ativar o principal'.

        Os dois fazem A MESMA coisa e só diferem em `fora`, a lista do que fica
        desligado: liga as rotinas, liga a Espera, SOBE O DETECTOR e gera agora.

        ⚠️ **Os dois sobem o Detector.** Até 28/08/2026 havia mais dois botões
        aqui — 'Início rápido' e 'Iniciar' — que geravam uma vez e NÃO subiam a
        vigilância. Eles existiam porque 'Ativar tudo' só ligava e ficava
        esperando uma próxima mudança que, num projeto já gerado, nunca vinha:
        era preciso um botão separado só para dar a partida. Desde que 'Ativar
        tudo' passou a gerar o que falta na hora, os dois viraram um caminho a
        mais para o mesmo lugar — e a tela ficou com quatro botões para duas
        decisões. Ver `set_acionamentos_principais`.

        A base (Detector, Hashes, Sincronia) roda junto de qualquer jeito, sem
        chave — ver `_AC_BASE`.
        """
        settings = self._ac_ligar_agentes(self._ac_load_settings(project_name))
        # Depois de ligar tudo, e não em vez de: `_ac_ligar_agentes` deriva a
        # lista de `IDS_DAS_ROTINAS`, e é ela que faz uma rotina nova entrar
        # sozinha nos dois botões. Desligar aqui é a exceção declarada.
        for agent_id in fora:
            settings[agent_id] = 'off'
        # A Espera nasce LIGADA junto — sem o freio, uma sessão do Claude Code
        # dispararia um ciclo por arquivo salvo.
        settings['espera'] = 'on'
        self._ac_save_settings(project_name, settings)
        # Um "Desativar tudo" anterior deixou as rotinas paradas: soltar ANTES
        # de subir a Espera, senão o ciclo que ela dispara desiste na hora.
        self.projeto_retomar_rotinas(project_name)
        self._ac_subir_espera(project_name)
        # `aviso` = os acionamentos foram gravados e o ciclo não começou AGORA:
        # está na fila, atrás de outro projeto ou de outra ponta da IA, e
        # começa sozinho quando a vez chegar.
        #
        # ⚠️ Não é mais "o ciclo NÃO começou". `_ac_run_cycle_now` passou a
        # ENFILEIRAR em vez de recusar — antes, ligar a automação num segundo
        # projeto com o primeiro rodando gravava as chaves, subia o Detector e
        # nunca gerava nada, porque o Detector só enxerga a PRÓXIMA mudança no
        # disco. Ver a docstring dele.
        aviso = self._ac_run_cycle_now(project_name, origem=origem)
        return {'success': True, 'settings': settings, 'aviso': aviso}

    def set_acionamentos_todos(self, project_name):
        """'Ativar tudo': liga TODAS as rotinas, sobe o Detector e gera agora.

        Antes ele só ligava e subia a vigilância, sem gerar nada — e ainda
        gravava a linha de base do Hashes, o que fazia o programa concluir que
        nada tinha mudado. Num projeto com documentação faltando, o botão ligava
        tudo e não produzia um arquivo, esperando para sempre por uma próxima
        edição.

        Agora ele gera o que falta agora E passa a vigiar daqui para frente. A
        linha de base sai do caminho — quem a regrava é o fim do ciclo, e só se
        ele chegar ao fim (ver `_ac_run_cycle_now`).
        """
        try:
            return self._ac_ligar_e_vigiar(project_name, origem='ativar-tudo')
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def set_acionamentos_principais(self, project_name):
        """'Ativar o principal': o mesmo 'Ativar tudo', menos três rotinas.

        Fora ficam as de `_AC_FORA_DO_PRINCIPAL` — Resumo de Pastas,
        Comentários e Duplicados. Tudo o mais é idêntico, inclusive
        subir o Detector: é 'Ativar tudo' com um recorte, não um modo de
        partida à parte.

        ⚠️ **Não confundir com o antigo 'Início rápido'**, que ele substitui só
        em parte. Aquele ligava um subconjunto CURADO, escrito à mão, e NÃO
        subia a vigilância; este desliga três nomes declarados e vigia como o
        irmão. O 'Início rápido' também ligava Comentários e Duplicados, que
        aqui saem de propósito.

        ⛔ O nome do conjunto é "o principal". Nunca "essenciais" — ver
        `_AC_FORA_DO_PRINCIPAL`.
        """
        try:
            return self._ac_ligar_e_vigiar(project_name,
                                           fora=self._AC_FORA_DO_PRINCIPAL,
                                           origem='ativar-principal')
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def set_acionamentos_nenhum(self, project_name):
        """'Desativar tudo': zera todos os acionamentos e para o Detector.

        Inclusive a base: sem nenhuma rotina ligada não há ciclo, e sem ciclo
        não há o que o Detector, o Hashes ou a Sincronia façam.
        """
        try:
            settings = {k: 'off' for k in self._AC_DEFAULTS}
            self._ac_save_settings(project_name, settings)
            self._ac_parar_espera(project_name)
            # E para a rotina que está rodando, com a requisição dela (D15). O
            # Chat e a Fila não são tocados: o cliente deles não tem dono de
            # rotina.
            self.projeto_parar_rotinas(project_name)
            return {'success': True, 'settings': settings}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def limpar_dados_agentes(self, project_name, ids=None):
        """Botão "Limpar dados gerados": apaga o que as rotinas ESCOLHIDAS já
        produziram, e só elas.

        `ids` é a lista de ids de rotina marcados na tela. `None` (ou lista
        vazia) continua querendo dizer TODAS — é o contrato antigo desta função,
        de quando ela não tinha escolha nenhuma, e mantê-lo é o que impede uma
        chamada velha de virar um no-op silencioso.

        ⚠️ **NÃO desliga mais os acionamentos.** Ela desligava todos ao terminar,
        e isso era o bug que a escolha veio junto para consertar: quem apagava a
        documentação para refazê-la ficava com tudo desligado e sem regeneração
        nenhuma, e a única saída conhecida era clicar em 'Desativar tudo' e
        'Ativar tudo' de novo. Apagar dado é apagar dado; o que estava ligado
        continua ligado, como se a pasta tivesse sido apagada na mão.

        E, se havia rotina ligada, um ciclo começa AGORA — é o que "apaguei para
        refazer" quer dizer. O Detector sozinho não daria conta: ele vê mudança
        no CÓDIGO do usuário, e apagar uma pasta de saída não é mudança nenhuma
        para ele.

        ⚠️ **A dívida do Detector é anotada ANTES do ciclo** (`_det_devendo`).
        Sem isso, apagar só o Glossário num projeto sem nada mudado deixava o
        filtro do Detector dispensar as cinco rotinas caras — inclusive a que
        acabou de perder a pasta — e o ciclo "concluía" sem regenerar. Ver o
        docstring de `_det_devendo`.

        Recusa durante um ciclo em andamento pelo mesmo motivo que
        `run_agent_once` recusa: apagar uma pasta que está sendo escrita nesse
        instante deixaria o agente em execução gravando em uma pasta que já
        não existe mais.
        """
        try:
            if self._ac_get_run_lock().locked():
                return {'success': False, 'error': 'Há uma execução em andamento — espere terminar antes de limpar.'}

            escolhidos = [i for i in (ids or IDS_DAS_ROTINAS)
                          if i in PASTAS_DAS_ROTINAS]
            if not escolhidos:
                return {'success': False,
                        'error': 'Nenhuma rotina conhecida foi marcada.'}

            # Só as pastas das rotinas. `Configuração.json` e `Pendências.json`
            # são irmãos delas, não filhos, e sobrevivem de propósito: limpar o
            # que foi GERADO não é jogar fora o que foi CONFIGURADO.
            #
            # ⚠️ Passa por um `set` de NOMES DE PASTA, e não pelos ids: a
            # Documentação Técnica tem dois ids apontando para a mesma pasta
            # (ver `PASTAS_DAS_ROTINAS`), e apagar duas vezes o mesmo caminho é
            # inofensivo só por causa do `ignore_errors`.
            base = obter_pasta_das_rotinas(project_name)
            for nome_da_pasta in {PASTAS_DAS_ROTINAS[i] for i in escolhidos}:
                shutil.rmtree(os.path.join(base, nome_da_pasta), ignore_errors=True)

            # A dívida vai ANTES do ciclo: quem a lê é o filtro, lá dentro dele.
            self._det_devendo(project_name, escolhidos)
            # O Painel de Mapas lê a cobertura gravada; sem isto ele mostraria o
            # 100% de antes da limpeza até a próxima rotina terminar.
            self._cob_gravar_em_segundo_plano(project_name)

            settings = self._ac_load_settings(project_name)
            aviso = None
            if self._ac_any_agent_on(settings):
                aviso = self._ac_run_cycle_now(project_name, origem='limpeza')
            return {'success': True, 'settings': settings, 'aviso': aviso,
                    'limpou': escolhidos}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def restore_acionamentos_espera(self, project_name):
        """Chamada UMA VEZ por abertura de projeto (troca de projeto ou o
        programa reabrindo do zero — ver `_acLastProject` em acionamentos.js).

        ⚠️ Até 20/08/2026 esta função fazia o oposto: LIA o que tinha ficado
        ligado e retomava sozinha — religava a vigilância, retomava pendência de
        `Pendências.json`, disparava verificação por hash. Era assim que o
        programa continuava mandando requisição pro LM Studio minutos depois
        de fechado e reaberto, ou depois de trocar de projeto, sem o usuário
        ter clicado em nada. Isso é uma questão de segurança: nada que chama
        LLM ou mexe em arquivo pode retomar sozinho — quem liga de novo é o
        usuário, clicando em 'Ativar tudo' ou 'Ativar o principal'.
        Por isso ela agora faz o inverso: ZERA os acionamentos e para o
        Detector, sempre, e devolve o novo estado para a tela desenhar os
        toggles todos apagados — sem religar nada e sem tocar em
        `Pendências.json` (ela continua no disco; só não é retomada sozinha).

        ⚠️ **É AQUI QUE A PARADA DO PROJETO É DESLIGADA**, e isso não é
        detalhe: fechar a aba liga uma flag que faz todo laço daquele projeto
        desistir de chamar o LM Studio (ver `agentes/parada_do_projeto.py`).
        Sem desligá-la na reabertura, um projeto fechado e reaberto nunca mais
        rodaria nada — e nada na tela diria por quê. Este é o ponto certo
        porque ele já É o "este projeto está sendo aberto" do backend.
        """
        try:
            self.projeto_retomar(project_name)
            r = self.set_acionamentos_nenhum(project_name)
            return r
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def get_espera_status(self, project_name):
        """Estado da Espera — o freio, não a detecção.

        Três informações que a tela precisa manter separadas, porque são causas
        diferentes do mesmo "parado":

          · `vigiando`      — o Detector está de pé? (é ele que vê o disco);
          · `espera_ligada` — o freio está ligado? Desligado, o ciclo é
                              liberado na hora em vez de esperar o silêncio;
          · `algum_agente_ligado` — há trabalho a fazer?

        `ativo` é a Espera efetivamente em serviço: ligada, com agente para
        rodar e com o Detector de pé.

        ⚠️ `vigiando` NÃO depende de `espera_ligada`. Desligar o freio não
        desliga a vigilância — é justamente o contrário: o ciclo passa a rodar
        assim que a mudança chega. Amarrar os dois foi o que fez a Espera
        parecer o gatilho durante todo o tempo em que ela se chamava Watcher.
        """
        try:
            settings = self._ac_load_settings(project_name)
            espera_ligada       = self._ac_espera_ligada(settings)
            algum_agente_ligado = self._ac_any_agent_on(settings)
            vigiando = getattr(self, '_ac_esperas', {}).get(
                project_name, {}).get('active', False)
            delays = self._ac_delays()
            return {'success': True,
                    'ativo': espera_ligada and algum_agente_ligado and vigiando,
                    'vigiando': vigiando,
                    'espera_ligada': espera_ligada,
                    'algum_agente_ligado': algum_agente_ligado,
                    'debounces': delays,
                    # O T1 é o primeiro a disparar — é ele que responde à
                    # pergunta "quanto tempo até alguma coisa acontecer?".
                    'debounce_segundos': delays['t1'],
                    # Por que a Espera está parada AGORA, quando quem a segura é
                    # a trava do LM Studio. Sem isto, "o Chat está usando o
                    # modelo" era indistinguível de "não aconteceu nada" — ver
                    # `_ac_espera_laco`.
                    'aguardando_trava': getattr(self, '_ac_espera_trava', {}).get(
                        project_name),
                    # De QUEM é a tarefa que está segurando. Quando é outra aba
                    # de projeto, a tela pinta um estado próprio — ver
                    # `_ac_espera_marcar_trava` e `visualizarEsperaEstado`.
                    'bloqueado_por_projeto': getattr(
                        self, '_ac_espera_trava_dono', {}).get(project_name),
                    # O estado de cada grupo — a linha de cada um na Situação
                    # do Visualizar (ver `_ac_grupos_do_projeto`). Cópia rasa:
                    # o laço da Espera continua mexendo no original.
                    'grupos': {g: dict(v) for g, v in
                               self._ac_grupos_do_projeto(project_name).items()},
                    'grupos_ordem': list(self._AC_ORDEM_GRUPOS),
                    # O relógio daqui, para a tela descontar a diferença do dela
                    # ao fazer a contagem regressiva de `prazo_em`.
                    'agora': time.time()}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def get_agent_last_runs(self, project_name):
        """Quando cada rotina terminou pela última vez — e COMO.

        ⚠️ `finished_at` sozinho não distingue "terminou" de "deu certo", e
        desde que rotina que falha também grava `_resumo.json` (para o ciclo
        parar de esperar por ela), olhar só a hora pintava de verde quem
        tinha quebrado: o Glossário estourou um `UnboundLocalError` e a
        sub-aba Visualizar mostrou "Concluído".

        `last_runs` continua sendo `{id: hora}` para quem já lia assim, e
        `desfechos` traz `{id: {quando, erros, falhou}}` ao lado.
        """
        try:
            last_runs, desfechos = {}, {}
            for agent_id in IDS_DAS_ROTINAS:
                t = self._ac_get_resumo_time(project_name, agent_id)
                quando = t.isoformat() if t else None
                last_runs[agent_id] = quando
                if not quando:
                    continue
                erros, _ = self._erros_de_uma_rotina(project_name, agent_id)
                saldo = self._ac_saldo_da_rotina(project_name, agent_id) or {}
                desfechos[agent_id] = {
                    'quando': quando,
                    'erros': len(erros),
                    # Falhou de vez: terminou sem gerar UMA linha sequer.
                    'falhou': bool(erros) and not (saldo.get('processados') or 0),
                }
            return {'success': True, 'last_runs': last_runs, 'desfechos': desfechos}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def run_agent_once(self, project_name, agent_id):
        try:
            if agent_id not in IDS_DAS_ROTINAS:
                return {'success': False, 'error': f'Agente desconhecido: {agent_id}'}
            # ⚠️ A TRAVA VEM PRIMEIRO, e a ordem não é arbitrária: as duas
            # recusas abaixo são para o mesmo clique, e a menos informativa
            # estava na frente. "Já há uma execução em andamento" não diz QUAL
            # nem ONDE olhar; "não dá para rodar agora: a Fila está pesquisando"
            # diz as duas coisas, e ainda para onde ir. Com o ciclo rodando as
            # duas são verdadeiras ao mesmo tempo — e ganhava a pior.
            #
            # A trava de cinco pontas. Este é o caminho do CLIQUE — tem gente na
            # frente da tela —, então recusar com o motivo é a resposta certa,
            # e não enfileirar em silêncio. Mesma regra do botão Iniciar em
            # `acionamentos_espera.py`.
            ocupada = TRAVA_IA.estado()
            if ocupada:
                return {'success': False, 'trava': ocupada,
                        'error': 'não dá para rodar agora: %s'
                                 % ocupada.get('motivo', 'há tarefa de IA rodando')}
            if self._ac_get_run_lock().locked():
                return {'success': False, 'error': 'Já há uma execução em andamento'}
            # Clicou para rodar: se um "Desativar" anterior a deixou parada, ela
            # nasceria com o cliente fechado. Ver `rotinas_clique._rotina_solta`.
            self.projeto_retomar_rotinas(project_name, agent_id)
            threading.Thread(
                target=self._ac_run_single,
                args=(project_name, agent_id),
                daemon=True
            ).start()
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

