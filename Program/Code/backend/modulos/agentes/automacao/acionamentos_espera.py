import json
import time
import threading
from datetime import datetime

from ...constantes import *
from ..trava_ia import TRAVA_IA, DONO_ROTINAS


class AcionamentosEsperaMixin:
    """A **Espera** — o freio do ciclo. Só o freio.

    Ela não detecta nada. Quem vê o que mudou é o Detector
    (`detector_vigia.py`), que entrega caminhos; a Espera segura N segundos
    **sem nenhuma mudança nova** e então libera o ciclo definido em
    `acionamentos_pipeline.py`.

    São TRÊS cronômetros, um por grupo de urgência (ver `_AC_GRUPOS_DELAY`).
    Uma mudança rearma os três de uma vez; cada um dispara o seu grupo quando
    vence.

    ⚠️ **O interruptor dela NÃO desliga a detecção.** Desligada, a Espera
    libera na hora — a vigilância continua de pé, e o ciclo passa a rodar assim
    que a mudança chega. A trava de execução já garante um ciclo por vez, então
    "desligada" não produz ciclos empilhados: produz o mais rápido que o
    programa consegue.
    """

    # A varredura e a persistência de hashes vivem em agentes/hashes.py — aqui
    # só se decide o que fazer com o resultado. Um dado, um lugar.

    # Quanto esperar antes de TENTAR DE NOVO um ciclo que não chegou ao fim.
    # Sem este piso, um ciclo que falha com a Espera desligada (delay zero)
    # voltaria a ser disparado no instante seguinte, para sempre.
    _AC_ESPERA_REPETIR = 30

    def _ac_create_hash_baseline(self, project_name):
        arquivos = self._hs_scan(project_name)
        if arquivos is not None:
            self._hs_save(project_name, arquivos)

    def _ac_create_hash_baseline_async(self, project_name):
        threading.Thread(
            target=self._ac_create_hash_baseline,
            args=(project_name,),
            daemon=True
        ).start()

    def _ac_reservar_partida(self, project_name):
        """Reserva a vaga de partida DESTE projeto. `False` = ele já tem uma.

        ⚠️ Uma por PROJETO, e não uma no programa. O que se impede aqui é
        empilhar dois ciclos do MESMO projeto — clicar duas vezes em 'Ativar
        tudo', ou o botão somado à retomada de pendências. Dois projetos
        DIFERENTES podem ter partida reservada ao mesmo tempo: é exatamente o
        que faz a fila existir.
        """
        with self._ac_partidas_lock:
            if project_name in self._ac_partidas:
                return False
            self._ac_partidas.add(project_name)
            return True

    def _ac_liberar_partida(self, project_name):
        with self._ac_partidas_lock:
            self._ac_partidas.discard(project_name)

    def _ac_run_cycle_now(self, project_name, grupos=None, caminhos=None,
                          origem='manual'):
        """Dispara um ciclo completo — agora, ou assim que a vez chegar.

        É o que os botões de partida precisam: num projeto novo não há mudança
        de arquivo para o Detector ver, então alguém tem que dar a partida.

        `grupos` e `caminhos` existem para a retomada de pendências
        (`rotinas_pendencias.py`) refazer exatamente o ciclo que morreu no meio.

        ## ⚠️ ELE ENFILEIRA. Antes ele RECUSAVA, e isso era um defeito grave.

        Com duas abas de projeto abertas, o gesto natural é ligar a automação
        nas duas. Ligar na segunda devolvia *'já existe um ciclo de rotinas
        rodando'* e **não fazia mais nada**: as chaves ficavam ligadas, o
        Detector subia, mas o ciclo de partida daquele projeto simplesmente
        nunca acontecia. E como o Detector só enxerga a PRÓXIMA mudança no
        disco, um projeto parado ficava esperando para sempre — a documentação
        que faltava nunca era gerada.

        O usuário só descobria por não ver nada acontecer, e o conserto era
        lembrar de voltar lá depois e clicar de novo. Era a mesma falha que a
        nota de `trava_ia.py` chama de **enfileirar, nunca descartar**, e a
        exceção de "recusar é honesto quando tem gente na frente da tela" não
        cobre este caso: aqui a pessoa está na frente da tela do projeto B, e
        o que a barra é o projeto A — que ela nem está olhando.

        Agora a thread nasce sempre e ESPERA a vez, nas duas travas, na ordem
        de sempre (`TRAVA_IA` e depois `_ac_run_lock` — a mesma de
        `_ac_espera_liberar`, e é o que garante que não há abraço mortal). Com
        três ou quatro projetos ligados, eles rodam um depois do outro sozinhos.

        O retorno deixou de ser "não começou" e virou **"não começou AGORA"**:
        `None` = está rodando neste instante; texto = está na fila, e o texto
        diz atrás de quem. Quem chama trata os dois como sucesso.
        """
        # A única recusa que sobrou, e ela é sobre o próprio projeto: dois
        # ciclos do MESMO projeto na fila fariam o segundo reprocessar o que o
        # primeiro acabou de gerar.
        if not self._ac_reservar_partida(project_name):
            return 'este projeto já tem um ciclo rodando ou na fila'

        # Quem está com a janela do LM Studio agora. Serve para a MENSAGEM e
        # para a bolinha de "esperando outro projeto" — não para recusar.
        ocupada = TRAVA_IA.estado()
        dono = (ocupada or {}).get('projeto')
        aviso = None
        if ocupada or self._ac_get_run_lock().locked():
            motivo = (ocupada or {}).get('motivo') or 'outro ciclo de rotinas'
            onde = ' (projeto "%s")' % dono if dono and dono != project_name else ''
            aviso = ('na fila: %s%s — este ciclo começa sozinho quando aquele terminar.'
                     % (motivo, onde))
            # Acende o estado `bloqueado` na sub-aba Visualizar e a bolinha
            # índigo na tira de abas, já no clique — sem isto o projeto ficaria
            # com cara de "não tem nada ligado" até a próxima volta do poll.
            self._ac_espera_marcar_trava(
                project_name, 'esperando %s' % motivo, dono_projeto=dono)

        def _run():
            try:
                # `esperar=True`: é aqui que a fila acontece. A thread fica
                # parada nas duas travas até a vez dela chegar.
                with TRAVA_IA.ocupar(DONO_ROTINAS, projeto=project_name, esperar=True), self._ac_get_run_lock():
                    # ⚠️ A ABA PODE TER SIDO FECHADA ENQUANTO ESTA THREAD
                    # ESPERAVA A VEZ, e é aqui que isso é descoberto. Uma
                    # thread parada em `TRAVA_IA.ocupar` não é acordável de
                    # fora (`Condition.wait()` sem timeout, ver trava_ia.py):
                    # ela acorda na vez dela e desiste NESTE ponto. Sem isto, o
                    # ciclo de um projeto que o usuário já fechou começaria do
                    # zero minutos depois, segurando a janela do LM Studio
                    # contra o projeto seguinte da fila.
                    if self.projeto_parado(project_name):
                        return
                    # Chegou a vez: a espera acabou, e a tela precisa saber
                    # disso antes de o ciclo começar a pintar.
                    self._ac_espera_marcar_trava(project_name, None)
                    # ⚠️ As settings são lidas AQUI DENTRO, e não lá em cima:
                    # entre entrar na fila e chegar a vez o usuário pode ter
                    # desligado rotinas, e vale o que está gravado agora.
                    settings = self._ac_load_settings(project_name)
                    completou = self._ac_run_cycle(
                        project_name, settings, require_espera=False,
                        grupos=grupos, caminhos=caminhos, origem=origem)
                # Baseline depois do ciclo: o que acabou de ser processado não
                # deve reaparecer como "mudou" na próxima verificação por hash.
                #
                # ⚠️ SÓ se o ciclo chegou ao fim. Regravar a base depois de um
                # ciclo interrompido apagava a única prova de que aqueles
                # arquivos ainda deviam trabalho: a base passava a dizer "nada
                # mudou" e o `.md` velho ficava para sempre. Era assim que
                # 'faltou um monte de coisa' virava permanente.
                if completou:
                    self._ac_create_hash_baseline(project_name)
            except Exception as e:
                # O ciclo inteiro estava dentro de um `except: pass`: qualquer
                # erro que não fosse CicloInterrompido sumia sem log e sem
                # aviso na tela.
                print('[acionamentos] ciclo de %s falhou: %s: %s'
                      % (project_name, type(e).__name__, e))
            finally:
                # ⚠️ As duas no `finally`, e não só no caminho feliz. Um erro
                # dentro do ciclo (ou uma interrupção) deixaria a marca de
                # espera acesa para sempre — o projeto ficaria com a bolinha de
                # "esperando outro projeto" sem ninguém do outro lado — e a
                # vaga reservada, o que travaria toda partida seguinte deste
                # projeto com "já tem um ciclo na fila".
                self._ac_espera_marcar_trava(project_name, None)
                self._ac_liberar_partida(project_name)
                self._ac_restore_global_status(project_name)

        threading.Thread(target=_run, daemon=True).start()
        return aviso

    # ── Lock e status global ─────────────────────────────────────────────────

    def _ac_get_run_lock(self):
        if not hasattr(self, '_ac_run_lock'):
            self._ac_run_lock = threading.Lock()
        return self._ac_run_lock

    def _ac_restore_global_status(self, project_name):
        if getattr(self, '_ac_esperas', {}).get(project_name, {}).get('active', False):
            self._ac_notify(project_name, 'watching')
        else:
            self._ac_notify(project_name, 'idle')

    def _ac_notify(self, project_name, status, agent=None, motivo=None,
                   bloqueado_por_projeto=None):
        """Avisa a tela do estado do ciclo — e alimenta a aba Pendencias.

        O registro em `_processando` vem ANTES do `evaluate_js`, e de
        proposito: e por aqui que as dez rotinas que nao contam arquivo
        aparecem na aba Pendencias. Antes so tres apareciam, porque so tres
        chamam `_proc_apply` — e a aba dizia 'nenhum agente processando' com
        o Glossario rodando na frente do usuario.

        `motivo` é o texto que explica um "parado" que não é ocioso — hoje só
        a trava do LM Studio o usa ("esperando o Chat terminar"). Sem ele,
        esperar a vez era indistinguível de não ter acontecido nada.

        `project_name` vai também no payload para a tela (`'project'`): com
        vários projetos abertos ao mesmo tempo, o JS que acende a bolinha
        precisa saber de qual projeto é este aviso, para não acender a
        bolinha errada.

        `bloqueado_por_projeto` é o par disso do outro lado: de QUEM é a
        tarefa que está segurando a janela do LM Studio. Quando é outra aba de
        projeto, a tela tem um estado próprio para isso — sem o nome, um ciclo
        na fila de outro projeto é indistinguível de um projeto sem nada
        ligado. Ver `_ac_espera_marcar_trava`.
        """
        if status == 'running' and agent:
            self._proc_marcar_rodando(project_name, agent)
            # O relógio da sub-aba Histórico. É AQUI, e não nos três lugares que
            # chamam este método, porque este é o único ponto por onde toda
            # rotina passa ao começar — o ciclo, a base e o ▶ avulso.
            self._hist_comecou(project_name, agent)
        elif status in ('watching', 'idle'):
            # Fim de ciclo: o que sobrou na lista nao esta mais rodando.
            self._proc_marcar_parado(project_name)
        try:
            payload = json.dumps({'status': status, 'agent': agent,
                                  'motivo': motivo, 'project': project_name,
                                  'bloqueado_por_projeto': bloqueado_por_projeto})
            self.window.evaluate_js(f'acionamentosEsperaStatus({payload})')
        except Exception:
            pass

    # ── Controle da Espera ─────────────────────────────────────────────────

    def _ac_subir_espera(self, project_name):
        """Sobe a vigilância: o vigia do Detector mais o laço do freio.

        Os dois nascem e morrem juntos, e é o `_ac_esperas[projeto]['active']`
        que diz se estão de pé — a mesma chave que `get_espera_status` e o
        ciclo consultam.
        """
        if not hasattr(self, '_ac_esperas'):
            self._ac_esperas = {}
        if self._ac_esperas.get(project_name, {}).get('active'):
            return
        self._ac_esperas[project_name] = {'active': True}
        self._det_subir_vigia(project_name)
        t = threading.Thread(
            target=self._ac_espera_laco,
            args=(project_name,),
            daemon=True
        )
        self._ac_esperas[project_name]['thread'] = t
        t.start()

    def _ac_parar_espera(self, project_name):
        if not hasattr(self, '_ac_esperas'):
            return
        if project_name in self._ac_esperas:
            self._ac_esperas[project_name]['active'] = False
            del self._ac_esperas[project_name]
        self._det_parar_vigia(project_name)
        self._ac_espera_marcar_trava(project_name, None)
        self._ac_notify(project_name, 'idle')

    # ── O motivo de estar parada ───────────────────────────────────────────

    def _ac_espera_marcar_trava(self, project_name, motivo, dono_projeto=None):
        """Registra (ou limpa) o motivo pelo qual a Espera está segurando.

        `TRAVA_IA.ocupar(..., esperar=True)` bloqueia EM SILÊNCIO quando o Chat
        está usando o modelo. De fora, isso é indistinguível de "não aconteceu
        nada": o usuário salva um arquivo, espera, e nada acontece — sem
        nenhuma frase em lugar nenhum do programa dizendo por quê.

        Guardado num campo próprio, e não só empurrado para a tela, porque a
        aba pode estar fechada na hora: `get_espera_status` o devolve a quem
        abrir depois.

        `dono_projeto` é QUEM está com a trava, quando se sabe. Com abas de
        projeto abertas ao mesmo tempo, "esperando as Rotinas" pode querer
        dizer "esperando as Rotinas DE OUTRO PROJETO" — e é uma leitura bem
        diferente: não é este projeto que está lento, é a janela do LM Studio
        que é uma só. A tela pinta esse caso com estado e cor próprios
        (`bloqueado`); sem o nome ela não teria como distinguir os dois.

        ⚠️ **O nome deste método diz "espera", mas o dono do estado na tela é o
        REVEZAMENTO** (`frontend/modulos/agentes/automacao/revezamento.js`), e
        não a Espera. Os dois seguram o ciclo por motivos sem relação: a Espera
        segura enquanto o código muda e TEM CHAVE; isto aqui segura enquanto a
        janela do LM Studio está ocupada e não tem chave nenhuma. Enquanto a
        tela juntava os dois, desligar o freio apagava junto o aviso de "outra
        aba está com o modelo" — e não sobrava nada explicando a parada. O nome
        `_ac_espera_*` ficou por ser o prefixo deste módulo inteiro.
        """
        if not hasattr(self, '_ac_espera_trava'):
            self._ac_espera_trava = {}
        if not hasattr(self, '_ac_espera_trava_dono'):
            self._ac_espera_trava_dono = {}
        if motivo:
            self._ac_espera_trava[project_name] = motivo
            if dono_projeto:
                self._ac_espera_trava_dono[project_name] = dono_projeto
            else:
                self._ac_espera_trava_dono.pop(project_name, None)
            self._ac_notify(project_name, 'aguardando', motivo=motivo,
                            bloqueado_por_projeto=dono_projeto)
        else:
            self._ac_espera_trava.pop(project_name, None)
            self._ac_espera_trava_dono.pop(project_name, None)

    # ── O estado de cada grupo, para a tela ────────────────────────────────

    def _ac_grupos_do_projeto(self, project_name):
        """O estado de cada grupo (T1, T2, T3) do projeto — criado se faltar.

        Existe para a sub-aba Visualizar mostrar, por grupo, quanto falta para
        ele começar e o que o está segurando (`get_espera_status` o entrega).
        Antes o prazo de cada grupo morava só em variáveis locais do laço, e
        nenhuma API o levava à tela.

        `estado` ∈ ocioso · contando · na_fila · rodando · concluido.
        `prazo_em` é hora de relógio (`time.time()`), não monotônica: é a tela
        que desconta, e ela só conhece o relógio de parede.
        """
        if not hasattr(self, '_ac_grupos_estado'):
            self._ac_grupos_estado = {}
        if project_name not in self._ac_grupos_estado:
            self._ac_grupos_estado[project_name] = {
                g: {'estado': 'ocioso', 'prazo_em': None, 'espera_total': None,
                    'segurando': '', 'concluido_em': None}
                for g in self._AC_ORDEM_GRUPOS}
        return self._ac_grupos_estado[project_name]

    # ── O laço do freio ────────────────────────────────────────────────────

    def _ac_espera_laco(self, project_name):
        """Segura os caminhos que o Detector entrega e libera no silêncio.

        ⚠️ **A ORDEM DAS TRÊS ÚLTIMAS LINHAS É O CONSERTO DE UM BUG REAL.**
        Até esta obra o laço fazia, nesta ordem: desarmava o cronômetro,
        esvaziava a lista de caminhos e SÓ ENTÃO rodava o ciclo. Qualquer erro
        no meio caía num `except Exception` mudo — e a mudança não voltava
        nunca mais. Agora a lista só é limpa DEPOIS de o ciclo ter terminado
        bem, que é a mesma regra que a linha de base do Hashes já segue, e pelo
        mesmo motivo.
        """
        grupos = self._ac_grupos_do_projeto(project_name)
        ordem = self._AC_ORDEM_GRUPOS
        ultima_mudanca = {g: None for g in ordem}
        # Caminhos que mudaram desde o último ciclo de CADA grupo. Um por grupo
        # porque os três disparam em momentos diferentes: se fosse uma lista só,
        # o T1 a esvaziaria e o T3 rodaria sem saber o que mudou.
        mudados_pendentes = {g: set() for g in ordem}
        # Piso de espera de um grupo que acabou de falhar — ver `_AC_ESPERA_REPETIR`.
        atraso_da_falha = {g: 0 for g in ordem}

        while self._ac_esperas.get(project_name, {}).get('active', False):
            try:
                settings = self._ac_load_settings(project_name)
                if not self._ac_any_agent_on(settings):
                    time.sleep(5)
                    continue

                # O Detector entrega; a Espera só segura. Toda a varredura, o
                # filtro de ignorados e o evento nativo do Windows ficam do
                # outro lado desta linha.
                novos = self._det_drenar(project_name)
                if novos:
                    agora = time.monotonic()
                    for g in ordem:
                        mudados_pendentes[g] |= novos
                        ultima_mudanca[g] = agora
                    self._ac_notify(project_name, 'aguardando')

                # Espera desligada = libera na hora. Não desliga a detecção:
                # o que some é o silêncio exigido, não a vigilância.
                if self._ac_espera_ligada(settings):
                    delays = self._ac_delays()
                else:
                    delays = {g: 0 for g in ordem}

                for g in ordem:
                    if ultima_mudanca[g] is None:
                        continue
                    espera_do_grupo = max(delays[g], atraso_da_falha[g])
                    if time.monotonic() - ultima_mudanca[g] < espera_do_grupo:
                        grupos[g].update(
                            estado='contando',
                            prazo_em=time.time() + (espera_do_grupo - (time.monotonic() - ultima_mudanca[g])),
                            espera_total=espera_do_grupo,
                            segurando='o disco precisa ficar %d s sem mudança' % espera_do_grupo)
                        continue
                    caminhos = sorted(mudados_pendentes[g])
                    grupos[g].update(estado='na_fila', prazo_em=None,
                                     segurando='Revezamento — esperando a vez do modelo')
                    # Só o T1 roda a base (Detector, Hashes, Sincronia): T2 e T3
                    # vêm depois, na MESMA leva de mudanças, e refazê-la não
                    # acrescenta nada.
                    completou = self._ac_espera_liberar(project_name, settings,
                                                        g, caminhos)
                    if completou:
                        # ⚠️ SÓ AGORA. Ver o aviso na docstring.
                        ultima_mudanca[g] = None
                        atraso_da_falha[g] = 0
                        mudados_pendentes[g].difference_update(caminhos)
                        grupos[g].update(estado='concluido', prazo_em=None,
                                         concluido_em=datetime.now().isoformat(timespec='seconds'),
                                         segurando='')
                    else:
                        # Rearma em vez de desistir: os caminhos continuam na
                        # lista e o grupo tenta de novo mais tarde.
                        ultima_mudanca[g] = time.monotonic()
                        atraso_da_falha[g] = self._AC_ESPERA_REPETIR
                        grupos[g].update(
                            estado='contando',
                            prazo_em=time.time() + self._AC_ESPERA_REPETIR,
                            espera_total=self._AC_ESPERA_REPETIR,
                            segurando='o disco precisa ficar %d s sem mudança' % self._AC_ESPERA_REPETIR)

                time.sleep(1)
            except Exception:
                time.sleep(3)

    def _ac_espera_liberar(self, project_name, settings, grupo, caminhos):
        """Toma as duas travas e roda o ciclo de um grupo. `False` = não completou.

        A trava de cinco pontas, e aqui ela ESPERA a vez em vez de recusar. O
        disparo veio de um evento no disco, não de um clique: recusar perderia
        a atualização em silêncio, e a documentação ficaria velha pelo motivo
        exato que a trava existe para evitar.

        O que ela NÃO pode mais fazer é esperar calada — é para isso que serve
        o `_ac_espera_marcar_trava` em volta.
        """
        ocupada = TRAVA_IA.estado()
        if ocupada:
            self._ac_espera_marcar_trava(
                project_name,
                'esperando %s' % ocupada.get('motivo', 'a outra tarefa de IA terminar'),
                dono_projeto=ocupada.get('projeto'))
            # O que segura o grupo, dito para a linha dele na Situação do
            # Visualizar: outra aba de projeto, ou outra tarefa deste.
            self._ac_grupos_do_projeto(project_name)[grupo]['segurando'] = 'Revezamento — ' + (
                'esperando o projeto "%s"' % ocupada['projeto']
                if ocupada.get('projeto') and ocupada.get('projeto') != project_name
                else 'esperando %s' % ocupada.get('motivo', 'a outra tarefa de IA terminar'))
        try:
            with TRAVA_IA.ocupar(DONO_ROTINAS, projeto=project_name, esperar=True):
                self._ac_espera_marcar_trava(project_name, None)
                with self._ac_get_run_lock():
                    self._ac_grupos_do_projeto(project_name)[grupo].update(
                        estado='rodando', segurando='')
                    return bool(self._ac_run_cycle(
                        project_name, settings, caminhos=caminhos,
                        grupos={grupo}, rodar_hashes=(grupo == 't1'),
                        origem=grupo))
        except Exception as e:
            print('[espera] ciclo %s de %s falhou: %s: %s'
                  % (grupo, project_name, type(e).__name__, e))
            return False
        finally:
            self._ac_espera_marcar_trava(project_name, None)
