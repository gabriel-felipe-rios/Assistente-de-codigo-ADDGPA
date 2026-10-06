import json
import os
import shutil
import threading

from ...constantes import *
from ..trava_ia import TRAVA_IA
from .acionamentos_config_api import AcionamentosConfigApiMixin


# Este arquivo era 551 linhas e virou dois, pelo teto de 500 da AMF:
#
#   acionamentos_config.py      a base, a persistência e as decisões
#   acionamentos_config_api.py  ligar, desligar, limpar e perguntar o estado
#
# ⚠️ AS TRÊS DA BASE NÃO SE ESCOLHEM, e é isso que a seção do topo declara.
# Tratá-las como rotina opcional faria o usuário desligar o chão em que as
# outras pisam — e nenhuma delas avisaria por quê.
class AcionamentosConfigMixin(AcionamentosConfigApiMixin):
    """CRUD de configuração de acionamentos e as decisões que dependem só dela.

    A execução em si (a Espera, o ciclo, o dispatch) vive em
    `acionamentos_espera.py` e `acionamentos_pipeline.py`; quem VÊ o que mudou
    é o Detector, em `detector.py` e `detector_vigia.py`.
    """

    # O antigo `_AC_AGENT_DIRS` (id -> nome da pasta) virou
    # `caminhos.PASTAS_DAS_ROTINAS`, e quem precisa só da LISTA de rotinas usa
    # `caminhos.IDS_DAS_ROTINAS`. Ele era o único mapa central de nomes de
    # pasta que existia, mas cerca de quarenta outros pontos do backend
    # montavam o caminho na mão e o ignoravam.

    # ── A BASE: as três que não se escolhem ──────────────────────────────
    #
    # Detector, Hashes e Sincronia são a fundação do ciclo, não etapas dele.
    # Rodam sempre que QUALQUER outra rotina estiver ligada, e por isso NUNCA
    # ganham chave ligada em `Acionamentos.json` — são rodadas por fora, na
    # ordem Detector → Espera → Hashes → Sincronia → o resto (ver
    # `_ac_run_cycle`).
    #
    # ⛔ Dar chave ligada a qualquer uma das três é o erro que esta declaração
    # existe para impedir: `_ac_grupo_do_agente` devolve `'t1'` para id que não
    # acha, então elas cairiam na fila comum do T1 — e o Detector passaria a
    # esperar o debounce para rodar justamente quem ARMA o debounce.
    _AC_BASE = ('detector', 'hashes', 'sincronia')

    # Rotinas que NÃO entram em `_ac_ligar_agentes`, e por quê: são A BASE.
    # Nenhuma das três tem toggle, porque nenhuma é etapa que se escolhe —
    # `_ac_run_cycle` roda as três por fora do dispatch sempre que qualquer
    # outra rotina estiver ligada. Ligá-las aqui escreveria chave que ninguém
    # lê, e pior: a chave ligada as jogaria na fila comum do T1 (ver `_AC_BASE`, logo acima).
    _AC_LIGAR_FORA = _AC_BASE
    # ⚠️ Fica AQUI, e não no arquivo da API, porque `_AC_BASE` é atributo de
    # classe: uma referência a ele no corpo da classe irmã não enxerga a base.

    # Estado inicial de cada chave: tudo desligado. Os dezesseis ids de rotina saem
    # de `caminhos.IDS_DAS_ROTINAS`, a lista canônica — este dicionário era a
    # terceira cópia deles no projeto, e uma rotina nova acrescentada lá e
    # esquecida aqui simplesmente não aparecia na aba Acionamentos.
    #
    # ⚠️ `espera` continua declarada à mão, e isso NÃO é descuido: ela não é
    # uma rotina, é o FREIO do ciclo — segura N segundos sem nenhuma mudança
    # nova antes de liberar. Por isso fica fora de `IDS_DAS_ROTINAS` e fora de
    # `_ac_any_agent_on` (ver `_AC_NAO_AGENTES`, logo abaixo). Somando, são 17
    # chaves para 16 rotinas — a diferença é intencional e a conta tem que
    # continuar fechando.
    #
    # Havia uma segunda, `hash-check` ("Verificação por hash ao abrir"), que
    # foi removida em 2026-08-21: `_ac_hash_check_and_run` não tinha um único
    # chamador em todo o programa, então o interruptor prometia detectar
    # mudanças feitas com o app fechado e não detectava nada. Ligá-lo de
    # verdade também não servia: ele roda o ciclo, o ciclo chama o LM Studio,
    # e está decidido que nada que chame o modelo recomeça sozinho — quem
    # religa é o usuário. É para isso que existem 'Ativar tudo' e 'Ativar o
    # principal'.
    _AC_DEFAULTS = {
        **{id_rotina: 'off' for id_rotina in IDS_DAS_ROTINAS},
        'espera':          'off',
    }

    # As QUATRO rotinas que 'Ativar o principal' deixa de fora — e só elas: o
    # botão liga todo o resto, exatamente como 'Ativar tudo'.
    #
    # ⚠️ **Escrito como a EXCEÇÃO, e não como a lista do que entra.** Foi assim
    # que o antigo `_AC_INICIO_RAPIDO` (uma lista literal do que LIGAR) deixou
    # o Duplicados para trás quando ele nasceu: quem acrescenta uma rotina nova
    # não tem motivo para lembrar de um dicionário de partida. Aqui uma rotina
    # nova entra no botão sozinha, e ficar de fora é que exige escrever o nome.
    #
    # ⛔ NÃO chamar este conjunto de "essenciais", "core" nem "obrigatórias":
    # essas três palavras estão reservadas — e proibidas — pelo verbete "A base"
    # do Vocabulário, que é outro conjunto (Detector, Hashes e Sincronia).
    #
    # Por que estas três: o Resumo de Pastas é caro em chamadas de LLM, e
    # escreve texto para o usuário LER. Comentários e
    # Duplicados são baratos, mas produzem relatório de leitura, não índice de
    # que o resto do programa dependa — nenhuma outra rotina os tem como
    # pré-requisito.
    _AC_FORA_DO_PRINCIPAL = ('resumo-pastas', 'comentarios', 'duplicados')

    # Chaves que não contam como "tem agente ligado":
    #
    #   · `espera` não é agente nenhum — é o freio;
    #   · a base (Detector, Hashes, Sincronia) não se escolhe. Se uma delas
    #     contasse aqui, "ligar só o Detector" seria lido como "há trabalho a
    #     fazer" e o programa passaria a rodar um ciclo que não gera nada.
    _AC_NAO_AGENTES = {'espera', *_AC_BASE}

    # Agentes que não dependem do LM Studio — rodam mesmo sem modelo carregado.
    # ⚠️ Ficar de fora daqui faz `executar()` devolver False quando não há modelo
    # selecionado, e o agente nunca roda.
    # ⚠️ O Detector abre esta lista de propósito: ele é quem VÊ a mudança, e
    # ficar de fora daqui o faria nunca rodar quando não houvesse modelo
    # carregado — em silêncio, e justamente no momento em que o programa mais
    # precisa continuar sabendo o que mudou.
    _AC_SEM_MODELO = {'detector', 'hashes', 'indice-simbolos', 'identificadores', 'grafo-imports',
                      'indice-navegacao', 'embedding', 'bibliotecas',
                      'comentarios', 'sincronia', 'duplicados'}


    # ── Helpers de persistência ────────────────────────────────────────────

    def _ac_settings_path(self, project_name):
        return obter_arquivo_de_acionamentos(project_name)

    # ⚠️ CHAVE RENOMEADA — sem isto, TODO projeto que já existe amanhece com o
    # freio desligado, e sem nenhum aviso.
    #
    # `Acionamentos.json` já gravado contém `"watcher": "on"`. O código novo
    # procura `espera`, não acha, cai no padrão `off` — e a Espera some. Não dá
    # erro, não aparece na tela: o programa só passa a disparar o ciclo a cada
    # arquivo salvo, como se o usuário tivesse desligado o freio.
    #
    # É o irmão do `_LIMITES_RENOMEADOS` de `configuracoes.py`, que já resolveu
    # exatamente este caso para `debounce_segundos → debounce_t1_segundos`.
    # Mesma forma, mesmo lugar (dentro do `load`), mesmo motivo.
    _AC_CHAVES_RENOMEADAS = {'watcher': 'espera'}

    def _ac_load_settings(self, project_name):
        path = self._ac_settings_path(project_name)
        s = dict(self._AC_DEFAULTS)
        try:
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    salvos = json.load(f)
                # A chave velha só vale enquanto a nova não existir: depois de
                # o usuário mexer no interruptor uma vez, quem manda é a nova.
                for antiga, nova in self._AC_CHAVES_RENOMEADAS.items():
                    if antiga in salvos and nova not in salvos:
                        s[nova] = salvos[antiga]
                # Chave de rotina que não existe mais (como `espelho`) é
                # ignorada: senão um "on" antigo contaria como rotina ligada.
                s.update({k: v for k, v in salvos.items()
                          if k not in self._AC_CHAVES_RENOMEADAS and k in self._AC_DEFAULTS})
                # Projeto que já existia antes da rotina nascer: quem usa os
                # símbolos já estava ligado, então ela nasce ligada — senão o
                # índice continuaria velho sem ninguém ver.
                if 'indice-simbolos' not in salvos and any(
                        salvos.get(k, 'off') != 'off'
                        for k in ('identificadores', 'duplicados', 'doc-tecnica', 'pipeline')):
                    s['indice-simbolos'] = 'file_change'
        except Exception:
            pass
        return s

    def _ac_save_settings(self, project_name, settings):
        path = self._ac_settings_path(project_name)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(settings, f, ensure_ascii=False, indent=2)

    # ── Decisões que dependem só da config ──────────────────────────────────

    def _ac_any_agent_on(self, settings):
        return any(v != 'off' for k, v in settings.items()
                   if k not in self._AC_NAO_AGENTES)

    def _ac_espera_ligada(self, settings):
        """O FREIO está ligado? Não confundir com "o Detector está de pé"."""
        return settings.get('espera', 'off') != 'off'

    def _ac_deve_vigiar(self, settings):
        """O Detector só faz sentido se houver alguma rotina para ele acordar.

        ⚠️ NÃO consulta a Espera, e é de propósito. A Espera é o freio: com ela
        desligada a vigilância continua, e o que muda é que o ciclo é liberado
        na hora. Enquanto esta função cobrava a chave do antigo Watcher,
        desligar o freio matava a detecção inteira — e era isso que fazia o
        interruptor parecer o gatilho.
        """
        return self._ac_any_agent_on(settings)
