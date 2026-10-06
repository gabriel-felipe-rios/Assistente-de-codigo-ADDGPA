"""A cadeia de dependência entre as rotinas da Automação, como DADO.

Este arquivo era 1.019 linhas e virou cinco, pelo teto de 500 da AMF. O corte
segue a regra dos Backups, do Inspetor e do `arquivos.py`: **cada arquivo
responde uma pergunta diferente**.

| Arquivo | A pergunta que ele responde |
|---|---|
| `acionamentos_pipeline.py` | quem depende de quem, e quanto silêncio cada grupo espera |
| `acionamentos_pipeline_disparo.py` | como cada agente é executado, e o que a tela sabe |
| `acionamentos_pipeline_recursos.py` | quantas em paralelo, e com que modelo |
| `acionamentos_pipeline_espera.py` | esperar terminar, e distinguir lento de morto |
| `acionamentos_pipeline_ciclo.py` | o ciclo inteiro, na ordem que a cadeia impõe |

`AcionamentosPipelineMixin` continua sendo o nome único que `api.py` importa:
ele COMPÕE os quatro, no padrão de `InspetorMixin` (Convenção 5 da Arquitetura
modular). Nenhum tem `__init__` nem `super()`, o que torna a herança múltipla
inerte.

⚠️ A CADEIA É DADO, E É POR ISSO QUE ELA MORA AQUI SOZINHA. Ela não é lida só
pelo ciclo: `get_dependencias_acionamentos` a entrega à sub-aba Visualizar sem
rodar nada. Uma cadeia declarada dentro do executor obrigaria a tela a instanciar
o motor para desenhar um diagrama.

⚠️ OS TRÊS GRUPOS DE URGÊNCIA NÃO SÃO NÍVEIS DE PRIORIDADE — são custos. T1 é
determinístico e custa milissegundos; T2 escreve para um agente externo ler; T3
gera prosa cara para o usuário ler. É o custo que define o tempo de silêncio, e
por isso os três esperam coisas diferentes.

⚠️ `CicloInterrompido` VEM DE `_ciclo.py` e é reexportada aqui para quem a
importava por este endereço continuar achando-a.
"""

import json
import time
from datetime import datetime

from ...constantes import *
from ..trava_ia import TRAVA_IA, DONO_ROTINAS

from .acionamentos_pipeline_ciclo import CicloInterrompido, AcionamentosPipelineCicloMixin
from .acionamentos_pipeline_disparo import AcionamentosPipelineDisparoMixin
from .acionamentos_pipeline_recursos import AcionamentosPipelineRecursosMixin
from .acionamentos_pipeline_espera import AcionamentosPipelineEsperaMixin


class AcionamentosPipelineMixin(AcionamentosPipelineDisparoMixin,
                                AcionamentosPipelineRecursosMixin,
                                AcionamentosPipelineEsperaMixin,
                                AcionamentosPipelineCicloMixin):
    """Motor de dependências entre agentes: dispatch, execução manual de um
    agente e o ciclo completo (hashes → independentes → dependentes)."""

    # ── Grupos de urgência (T1/T2/T3) ────────────────────────────────────────
    #
    # Cada grupo tem o próprio tempo de silêncio antes de disparar, porque não
    # têm a mesma urgência nem o mesmo custo:
    #
    #  T1 · determinístico — não chama LLM, custa milissegundos. Espera curta.
    #  T2 · para agente externo — o Claude Code lê. Espera intermediária.
    #  T3 · para o usuário ler — prosa cara de gerar. Espera longa.
    #
    # O Embedding roda no FIM do T3 (D17): lê a Documentação Técnica e o Resumo
    # de Pastas, e só assim sai em dia na mesma volta. No fim ninguém
    # espera por ele, então rodar por último não segura ninguém.
    # ⚠️ NÃO DERIVAR de `IDS_DAS_ROTINAS`. Isto cobre todos os ids, mas não é
    # uma lista deles: é uma PARTIÇÃO, e o grupo de cada um é a informação que o
    # dicionário carrega. Uma compreensão sobre a lista canônica só saberia
    # repetir o mesmo grupo para todos.
    # ⚠️ A partição precisa continuar COMPLETA: `_ac_grupo_do_agente` devolve
    # 't1' para id que não achar, então uma rotina nova esquecida aqui não dá
    # erro — passa a usar o delay mais curto em silêncio.
    #
    # ⛔ O **Detector** fica de fora de propósito, e é a única exceção: ele roda
    # ANTES da Espera, porque é ele quem arma o cronômetro. Pô-lo aqui o faria
    # esperar o próprio debounce para rodar, e o ciclo nunca começaria. A
    # Sincronia continua no T1 porque, embora rodada por fora, é o T1 que a
    # leva junto (ver `_ac_run_cycle`).
    _AC_GRUPOS_DELAY = {
        't1': ['hashes', 'sincronia', 'indice-simbolos', 'grafo-imports',
               'identificadores', 'bibliotecas', 'comentarios', 'duplicados'],
        't2': ['doc-tecnica', 'indice-navegacao', 'glossario', 'pipeline'],
        't3': ['resumo-pastas', 'embedding'],
    }

    _AC_ORDEM_GRUPOS = ('t1', 't2', 't3')

    # ── A cadeia de dependência do ciclo ─────────────────────────────────────
    #
    # id → os ids de que ele depende. É a MESMA informação que `_ac_run_cycle`
    # respeita lá embaixo, e agora está escrita UMA vez: antes os
    # `requisitos=(...)` viviam soltos nas chamadas de `executar`, e a sub-aba
    # Visualizar mantinha uma segunda cópia, à mão, no frontend. As duas
    # divergiram — o desenho mostrava `Doc. Técnica → Índice → Glossário`, uma
    # fila que o ciclo nunca executou (os dois são irmãos: pedem a Doc. Técnica
    # e mais nada), e o Embedding aparecia no fim de uma sequência, quando na
    # verdade ele é a confluência de três fontes.
    #
    # ⚠️ `hashes` não está aqui de propósito: roda ANTES de tudo, fora do laço
    # e sem toggle próprio — ver o passo "2. O Hashes".
    #
    # ⚠️ `detector` e `sincronia` ESTÃO aqui, e mesmo assim são rodados por
    # fora. Não é contradição: esta tabela é o que a sub-aba Visualizar desenha
    # e o que `_ac_ligar_agentes` consulta para saber se uma rotina é
    # independente ou encadeada. As duas precisam aparecer no desenho; o que
    # nenhuma das duas tem é chave em `Acionamentos.json`, e por isso o
    # `executar()` do laço passa por elas sem fazer nada.
    # ⚠️ A ORDEM DAS CHAVES É a ordem de execução, e não é decorativa. Sincronia
    # primeiro, porque acerta as saídas que já existem antes de alguém escrever
    # por cima; Embedding por último, porque é o mais caro dos dependentes e não
    # faz sentido segurar os outros quatro atrás dele.
    # ⚠️ NÃO DERIVAR de `IDS_DAS_ROTINAS`: aquilo é a lista dos ids, isto é o
    # que cada um espera. Uma compreensão sobre a lista canônica não teria de
    # onde tirar os requisitos.
    _AC_REQUISITOS = {
        # A base, na ordem em que roda. Ver `_AC_BASE`, em
        # `acionamentos_config.py`, para por que nenhuma das duas tem chave.
        'detector':         (),
        'sincronia':        (),
        'indice-simbolos':  (),
        'grafo-imports':    (),
        'identificadores':  ('indice-simbolos',),
        'bibliotecas':      (),
        'comentarios':      (),
        # O Duplicados lê o Índice de Símbolos, que agora é rotina do T1.
        'duplicados':       ('indice-simbolos',),
        'doc-tecnica':      (),
        'resumo-pastas':    ('doc-tecnica',),
        'indice-navegacao': ('doc-tecnica',),
        'glossario':        ('doc-tecnica',),
        # O Pipeline lê o Índice de Símbolos e o código — nunca o `grafo.json`.
        'pipeline':         ('indice-simbolos',),
        # Embedding lê DUAS fontes (ver _EMB_ORDER em embedding.py), então só
        # roda depois que todas as que estão ligadas terminarem.
        'embedding':        ('doc-tecnica', 'resumo-pastas'),
    }

    # Quem cobra só os requisitos LIGADOS, em vez de todos. O Embedding: ele
    # trabalha com as fontes que existirem, e exigir uma que o usuário desligou
    # o travaria para sempre num setup de, por exemplo, só Doc. Técnica + Embedding.
    # Identificadores, Duplicados e Pipeline também: se o Índice de Símbolos
    # estiver desligado, eles o constroem sozinhos quando falta — exigir a
    # rotina os travaria.
    _AC_REQUISITOS_SO_LIGADOS = {'embedding', 'identificadores', 'duplicados', 'pipeline'}

    def get_dependencias_acionamentos(self):
        """A cadeia de dependência do ciclo, como dado — para a sub-aba Visualizar.

        Não recebe projeto porque não depende de nenhum: a cadeia é a mesma para
        todos. O que varia por projeto — quem está ligado, quem já rodou — já vem
        de `get_acionamentos` e `get_agent_last_runs`.

        A divisão com a tela é essa: ícone, nome e posição de cada caixa são
        dela; **quem depende de quem é daqui**. Era a duplicação dessa segunda
        metade no frontend que fazia o desenho divergir do ciclo.
        """
        try:
            return {
                'success': True,
                'ordem': list(self._AC_REQUISITOS),
                'requisitos': {k: list(v) for k, v in self._AC_REQUISITOS.items()},
                'so_ligados': sorted(self._AC_REQUISITOS_SO_LIGADOS),
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Sinal de vida (ver `_ac_wait_done`) ──────────────────────────────────
    #
    # id do agente → rótulo com que ele se anuncia em `_proc_apply`
    # (agentes/processando.py). Só os três agentes que processam ARQUIVO A
    # ARQUIVO empurram progresso; os outros terminam rápido demais para valer
    # a pena, e para eles o sinal de vida é o mtime da pasta de saída.
    #
    # ⚠️ NÃO DERIVAR de `IDS_DAS_ROTINAS`: isto é uma CORRESPONDÊNCIA entre dois
    # vocabulários (id da rotina ↔ rótulo do painel Pendências), não um recorte
    # da lista canônica. O rótulo é escrito à mão nos agentes e precisa bater
    # com a string exata que eles passam — uma compreensão sobre a lista não
    # teria de onde tirá-lo.
    # As rotinas que processam arquivo a arquivo e batem o ponto a cada um,
    # por `_proc_apply`. Para elas o sinal de vida e exato e de graca; para o
    # resto so sobra o mtime da pasta de saida, que custa uma varredura.
    #
    # ⚠️ Era um dicionario id->rotulo que precisava concordar, letra por
    # letra, com o primeiro argumento de `_proc_apply` la dentro de cada
    # rotina. Duas listas de texto solto que ninguem cruzava: virou conjunto
    # de ids, e o nome bonito saiu de `PASTAS_DAS_ROTINAS`.
    # `embedding` entrou em 2026-08-26, quando a rotina deixou de ser muda e
    # passou a bater `_proc_apply` por arquivo. Antes o sinal de vida dela era
    # varredura de mtime de pasta, que e o degrau grosseiro para quem nao
    # informa nada; agora e a batida exata, como as outras tres.
    _AC_COM_CONTAGEM = frozenset(('doc-tecnica', 'resumo-pastas', 'embedding'))

    # Segundos entre duas varreduras de mtime. O sinal por batida e de graca e
    # pode ser lido a cada volta; o mtime custa uma varredura de pasta, entao
    # espaca-se. Fica bem abaixo do menor tempo limite possivel (1 minuto).
    _AC_INTERVALO_MTIME = 30

    def _ac_grupo_do_agente(self, agent_id):
        for grupo, agentes in self._AC_GRUPOS_DELAY.items():
            if agent_id in agentes:
                return grupo
        return 't1'

    def _ac_delays(self):
        """Segundos de silêncio de cada grupo, na ordem T1 → T2 → T3."""
        limites = self.load_limites()['limites']
        return {g: int(limites[f'debounce_{g}_segundos']) for g in self._AC_ORDEM_GRUPOS}
