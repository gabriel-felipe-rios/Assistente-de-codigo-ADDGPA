"""Esperar um agente terminar — e saber a diferença entre lento e morto.

⚠️ O SINAL DE VIDA É O CORAÇÃO DESTE ARQUIVO. Uma rotina que demora dez minutos
e uma rotina travada são indistinguíveis pelo relógio; o que as separa é o
agente continuar dizendo que está vivo. `_ac_wait_done` espera pelo SINAL, não
pelo tempo — e é por isso que um tempo limite generoso não conserta nada quando
falta o sinal, e um curto não quebra nada quando ele existe.

⚠️ `_ac_resumo_mudou` COMPARA O ARQUIVO, e não confia no que o agente disse. O
LLM nunca é a fonte de um fato verificável: se o resumo não mudou no disco, a
rotina não produziu nada, independentemente do que ela tenha respondido.

⚠️ `_ac_saldo_da_rotina` EXISTE PARA A TELA NÃO MENTIR sobre quanto falta. Ele é
o que transforma "está rodando" em "está rodando, e faltam N".

⚠️ NÃO CONFUNDIR COM `acionamentos_espera.py`, que é irmão deste na pasta e
responde outra coisa: lá é *quanto tempo de silêncio antes de disparar*; aqui é
*quanto esperar depois de ter disparado*.
"""

import json
import time
from datetime import datetime

from ...constantes import *
from ..trava_ia import TRAVA_IA, DONO_ROTINAS


class AcionamentosPipelineEsperaMixin:

    def _ac_get_resumo_time(self, project_name, agent_id):
        # Sem fallback para o próprio id: antes, um id que não estivesse no mapa
        # virava nome de pasta e a função respondia "nunca rodou" sobre uma pasta
        # que nunca existiu. Agora `obter_pasta_da_rotina` levanta, e o `except`
        # abaixo devolve None — que é a resposta honesta para um id que não é uma
        # rotina, e não derruba a thread do ciclo.
        try:
            path = obter_pasta_da_rotina(project_name, agent_id, '_resumo.json')
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                ts = data.get('finished_at', '')
                if ts:
                    return datetime.fromisoformat(ts)
        except Exception:
            pass
        return None

    def _ac_resumo_mudou(self, project_name, agent_id, antes):
        """O `_resumo.json` desta rotina é mais novo do que era antes de ela
        começar? É a pergunta "ela terminou?".

        ⚠️ `antes` é o carimbo do resumo ANTERIOR, e não a hora em que o ciclo
        disparou a rotina. A diferença parece cosmética e não é: no Windows a
        hora de parede anda de ~15 ms em ~15 ms, e uma rotina rápida grava o
        resumo DENTRO do mesmo tique em que o ciclo anotaria o `now()`. O
        `t > agora` dava falso para sempre, e a rotina que terminou em 3
        milissegundos era dada como travada.

        `antes is None` (nunca rodou) → qualquer resumo serve.
        """
        t = self._ac_get_resumo_time(project_name, agent_id)
        if t is None:
            return False
        return antes is None or t > antes

    def _ac_saldo_da_rotina(self, project_name, agent_id):
        """`{processados, total, erros, reaproveitados}` da última passada.

        Vai para o `Pendências.json` junto com o risco: é o que permite a
        faixa de retomada dizer 'a Doc. Técnica terminou com 4 erros' em vez de
        só 'terminou'. Terminar e ter feito tudo não são a mesma coisa.

        ⚠️ `reaproveitados` existe porque a sub-aba Histórico **deixou de
        registrar uma linha por arquivo reaproveitado** — eram 90% do arquivo
        inteiro, todas dizendo a mesma coisa. A conta vem para cá, que é onde
        ela cabe; a lista completa continua no `_resumo.json` da própria rotina,
        no campo `inalterados`, que o card da sub-aba Rotinas já mostra.
        """
        try:
            caminho = obter_pasta_da_rotina(project_name, agent_id, '_resumo.json')
            if not os.path.exists(caminho):
                return None
            with open(caminho, 'r', encoding='utf-8') as f:
                dados = json.load(f)
            return {
                'processados': dados.get('processed'),
                'total': dados.get('total'),
                'erros': len(dados.get('errors') or dados.get('erros') or []),
                # ⚠️ **DOIS nomes para a mesma conta, e ler só um dava ZERO
                # FALSO.** A Doc. Técnica grava a LISTA `inalterados`;
                # o Embedding grava o NÚMERO `skipped_count`. O histórico dizia
                # "0 de 802 · 0 reaproveitados" para uma passada que reaproveitou
                # as 802 — e zero falso é pior que campo ausente, porque parece
                # resposta.
                #
                # ⚠️ `skipped_count`, nunca `skipped`: na Doc. Técnica `skipped` são
                # os arquivos GRANDES DEMAIS, que é outra coisa inteiramente.
                #
                # As dez determinísticas não têm nenhum dos dois, e zero é a
                # resposta certa para elas: não reaproveitam nada, refazem o
                # índice inteiro.
                'reaproveitados': (len(dados.get('inalterados') or [])
                                   or int(dados.get('skipped_count') or 0)),
            }
        except Exception:
            return None

    def _ac_falha_do_resumo(self, project_name, agent_id):
        """O motivo gravado por `gravar_resumo_de_falha` (campo `error`), ou `None`.

        É o que separa "a rotina rodou e terminou" de "a rotina nem chegou a
        rodar" quando os dois deixaram um `_resumo.json` novo.
        """
        try:
            caminho = obter_pasta_da_rotina(project_name, agent_id, '_resumo.json')
            with open(caminho, 'r', encoding='utf-8') as f:
                dados = json.load(f)
            return dados.get('error') or None
        except Exception:
            return None

    def _ac_sinal_de_vida(self, project_name, agent_id):
        """Prova de que o agente ainda está trabalhando, ou None se não houver.

        Duas fontes, porque os agentes são de dois tipos:

          · quem processa arquivo a arquivo (Doc. Técnica, Resumo de
            Pastas) bate o ponto em `_proc_apply` a cada arquivo — é o sinal
            mais barato e mais preciso que existe;
          · o resto não empurra progresso nenhum, então o que sobra é o arquivo
            mais recente da pasta de saída da rotina.

        O valor devolvido só serve para ser comparado com o devolvido ANTES
        para o mesmo agente ("mudou?"). Não misturar as duas fontes na mesma
        espera: uma é `time.monotonic`, a outra é hora de arquivo.
        """
        if agent_id in self._AC_COM_CONTAGEM:
            return self._proc_ultimo_sinal(project_name, agent_id)
        try:
            base = obter_pasta_da_rotina(project_name, agent_id)
        except Exception:
            return None
        recente = None
        try:
            for raiz, _dirs, arquivos in os.walk(base):
                for nome in arquivos:
                    try:
                        m = os.path.getmtime(os.path.join(raiz, nome))
                    except Exception:
                        continue
                    if recente is None or m > recente:
                        recente = m
        except Exception:
            pass
        return recente

    def _ac_wait_done(self, project_name, agent_id, since, timeout=None, require_espera=True):
        """Espera a rotina terminar. `True` terminou, `False` desistimos dela.

        `since` é o carimbo do `_resumo.json` de ANTES de a rotina começar
        (`None` se ela nunca rodou), e não a hora do disparo — ver
        `_ac_resumo_mudou` para o porquê.

        A pergunta certa é "a thread ainda está viva?", e a resposta estava à
        mão o tempo todo — o ciclo é que jogava a referência fora e passava a
        adivinhar por efeito colateral (`_resumo.json` mais recente, mtime da
        pasta de saída, batida de progresso). Adivinhar errado abortava o ciclo
        inteiro com a rotina ainda trabalhando.

        A ordem de prioridade:

          1. `_resumo.json` com `finished_at > since` → **terminou**;
          2. thread da rotina **viva** → continua esperando, sem prazo. Uma
             Doc. Técnica de quatro horas sobre um projeto inteiro roda até o fim,
             que é exatamente o caso de uso;
          3. thread registrada e **morta** sem `_resumo.json` → a rotina caiu de
             verdade (exceção fora do `try`, processo do modelo derrubado).
             Devolve `False` na hora, sem gastar o prazo;
          4. **sem thread registrada** — rotina síncrona (Embedding) ou
             disparada por outro caminho → cai na regra antiga, de inatividade.

        `timeout=None` usa "Desistir de esperar uma rotina parada", de
        Configurações. Ele deixou de ser o mecanismo principal e virou o que o
        rótulo sempre prometeu: a rede para quando não há thread a quem
        perguntar.
        """
        if timeout is None:
            timeout = self.load_limites()['limites']['timeout_agente_minutos'] * 60

        usa_batida = agent_id in self._AC_COM_CONTAGEM
        agora = time.monotonic()
        limite = agora + timeout       # prazo corrente, adiado a cada sinal
        ultimo_sinal = None            # a última prova de vida já contabilizada
        proxima_varredura = agora      # só para a fonte cara (mtime)

        while True:
            # A aba deste projeto foi fechada: pare de esperar por ele.
            #
            # ⚠️ SEM `require_espera`, ao contrário da linha seguinte. Aquela
            # pergunta "a vigilância caiu?", e só vale para ciclo disparado
            # pela Espera — um ciclo de botão (`require_espera=False`) a
            # ignorava por completo, que é o caso mais comum de todos. Esta
            # pergunta é outra: "este projeto ainda existe na tela?".
            if self.projeto_parado(project_name):
                return False
            if require_espera and not getattr(self, '_ac_esperas', {}).get(project_name, {}).get('active', False):
                return False

            if self._ac_resumo_mudou(project_name, agent_id, since):
                return True

            viva = self._proc_thread_viva(project_name, agent_id)
            if viva is False:
                # Morreu sem gravar. Uma última olhada antes de dar como caída:
                # a thread termina logo depois de gravar o `_resumo.json`, e há
                # uma fresta entre a gravação e o fim dela.
                time.sleep(1)
                return self._ac_resumo_mudou(project_name, agent_id, since)
            if viva is True:
                # Viva é viva. O prazo de inatividade não se aplica — ele existe
                # para quando não há ninguém a quem perguntar.
                time.sleep(2)
                continue

            # Daqui para baixo: `viva is None`, ninguém a quem perguntar.
            if time.monotonic() >= limite:
                return False
            agora = time.monotonic()
            if usa_batida:
                sinal = self._proc_ultimo_sinal(project_name, agent_id)
            elif agora >= proxima_varredura:
                proxima_varredura = agora + self._AC_INTERVALO_MTIME
                sinal = self._ac_sinal_de_vida(project_name, agent_id)
            else:
                sinal = None
            if sinal is not None and (ultimo_sinal is None or sinal > ultimo_sinal):
                ultimo_sinal = sinal
                limite = agora + timeout

            time.sleep(2)

    def _ac_rodar_da_base(self, project_name, agent_id, caminhos, require_espera):
        """Roda UMA das três da base e espera ela terminar. `False` = travou.

        As três (Detector, Hashes, Sincronia) rodam por fora do laço do ciclo e
        sem chave em `Acionamentos.json` — ver `_AC_BASE`. O tratamento é
        idêntico ao de qualquer outra rotina (avisa a tela, espera o
        `_resumo.json`, risca da fila), e a única diferença é que ninguém
        pergunta se ela está ligada.

        Travar aqui interrompe o ciclo inteiro, e é a resposta certa: sem o
        Detector ninguém sabe o que mudou, sem o Hashes ninguém consegue pular
        o inalterado, e sem a Sincronia a Doc. Técnica regera com LLM o que era só
        para ser movido.
        """
        chamadas = {
            # Os dois recebem a lista de caminhos que a Espera acumulou: o
            # Detector para classificar só o que mudou, o Hashes para reler só
            # esses do disco em vez do projeto inteiro.
            'detector': lambda: self.run_detector_agent(project_name,
                                                        caminhos=caminhos),
            'hashes':   lambda: self.run_hashes_agent(project_name,
                                                      caminhos=caminhos),
            # A Sincronia consome a fila que o Detector acabou de gravar em
            # `mudanças.json` — por isso não recebe caminho nenhum.
            'sincronia': lambda: self.run_sincronia_agent(project_name),
        }
        # O carimbo de ANTES, não a hora de agora — ver `_ac_resumo_mudou`.
        inicio = self._ac_get_resumo_time(project_name, agent_id)
        self._ac_notify(project_name, 'running', agent_id)
        chamadas[agent_id]()
        if not self._ac_wait_done(project_name, agent_id, inicio,
                                  require_espera=require_espera):
            self._ac_notify_agent_done(
                project_name, agent_id, None,
                'Sem sinal de vida — ciclo interrompido')
            self._rp_pend_travou(project_name, agent_id,
                                 'parou de dar sinal de vida')
            return False
        t = self._ac_get_resumo_time(project_name, agent_id)
        self._ac_notify_agent_done(project_name, agent_id,
                                   t.isoformat() if t else None, None)
        self._proc_fila_riscar(project_name, agent_id)
        self._proc_marcar_parado(project_name, agent_id)
        self._rp_pend_riscar(project_name, agent_id,
                             self._ac_saldo_da_rotina(project_name, agent_id))
        return True
