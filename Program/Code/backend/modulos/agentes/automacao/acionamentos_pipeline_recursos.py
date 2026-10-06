"""Quanto se pode rodar ao mesmo tempo, e com que modelo.

As duas perguntas que o ciclo faz ANTES de disparar qualquer coisa, e que não
dependem de agente nenhum: *quantas em paralelo cabem* e *qual modelo está
carregado agora*.

⚠️ O PARALELISMO REAL NÃO É O CONFIGURADO. O número da tela é um teto; o real
depende do que já está rodando e da trava de cinco pontas. Usar o configurado
direto faria o ciclo disparar rotinas que ficariam paradas na fila da trava,
com a tela dizendo que estão executando.

⚠️ O MODELO É PERGUNTADO AO LM STUDIO, e não guardado. Ele muda quando o usuário
troca de modelo por fora do programa, e um valor gravado envelhece em silêncio —
o ciclo passaria a pedir a um modelo que não está mais carregado.
"""

import json
import time
from datetime import datetime

from ...constantes import *
from ..trava_ia import TRAVA_IA, DONO_ROTINAS


class AcionamentosPipelineRecursosMixin:

    def _rotina_paralelas(self):
        """Quantas em paralelo, de Configurações › Rotinas da Automação.

        Um número só para as três rotinas que processam arquivo a arquivo. O
        teto não é estético: cada linha de paralelismo é uma chamada
        simultânea ao LM Studio.
        """
        try:
            bruto = self.load_limites()['limites']['paralelas_rotinas']
        except Exception:
            bruto = PARALELISMO_PADRAO
        return max(PARALELISMO_MINIMO, min(PARALELISMO_MAXIMO,
                                          int(bruto or PARALELISMO_PADRAO)))

    def get_paralelismo_real(self, project_name=None):
        """Quantas vagas o usuário abriu × quantas cabem NA JANELA de verdade.

        São duas perguntas diferentes, e a tela mostrava só a primeira. O campo
        de Configurações abre N vagas, mas quem admite é o `PortaoDeContexto`
        (`modulos/tokens.py`), e ele conta **tokens**: um lote que ocupa mais de
        1/N da janela atravessa sozinho. Com "3 em paralelo" na tela e um
        arquivo de cada vez na prática, o número parecia mentira — e não era,
        era resposta de outra pergunta.

        `cabendo` é o PIOR CASO, de propósito: um lote que usa o orçamento de
        conteúdo inteiro. É esse que decide se o paralelismo configurado vai se
        realizar ou não; um lote pequeno passa junto com outros de qualquer
        forma, e não é dele que vem a surpresa.
        """
        try:
            from modulos.tokens import calcular_orcamento
            limites = self.load_limites()['limites']
            orcamento = calcular_orcamento(limites)
            configurados = self._rotina_paralelas()
            janela = max(1, int(orcamento['janela']))
            # O que um lote cheio ocupa: tudo menos a folga de segurança.
            custo = max(1, janela - int(orcamento['margem']))
            cabendo = max(1, min(configurados, janela // custo))
            return {
                'success': True,
                'configurados': configurados,
                'cabendo': cabendo,
                'janela': janela,
                'custo_do_lote': custo,
                'explicacao': (
                    'A janela do LM Studio tem %d tokens e um lote cheio ocupa '
                    'até %d. Por isso passam %d de cada vez, mesmo com %d '
                    'configurado(s) em Configurações › Rotinas da Automação.'
                    % (janela, custo, cabendo, configurados)),
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _ac_get_current_model(self):
        """O modelo que as rotinas vão usar: o que está CARREGADO no LM Studio.

        Desde 21/08/2026 é a única resposta — os cards deixaram de perguntar. Por
        isso ela precisa estar certa, e a ordem das duas fontes importa:

        1. **`/api/v0/models`**, a API nativa do LM Studio, que informa o
           `state` de cada modelo. É a única que distingue **carregado** de
           **baixado**;
        2. `list_models()[0]`, a rota compatível com a OpenAI, como reserva.

        ⚠️ A reserva sozinha não bastava. Com o carregamento sob demanda ligado,
        `/v1/models` lista o que está no disco, não o que está na memória — e o
        primeiro da lista podia ser um modelo que o usuário nunca pediu. Quem
        tirou o seletor da tela precisa entregar o modelo certo.

        Modelo de embeddings fica de fora: ele não responde chat.

        Com a caixa "Usar as configurações deste programa" marcada e um modelo
        escolhido em Modelo e geração, vale o escolhido — o LM Studio o carrega
        sob demanda. O resto da função é o caminho da caixa desmarcada.
        """
        from ...llm_geracao import modelo_escolhido
        escolhido = modelo_escolhido(self.load_settings()['settings'])
        if escolhido:
            return escolhido
        try:
            import urllib.request
            from ...llm_cliente import obter_endereco_do_lm_studio
            url = obter_endereco_do_lm_studio(
                self.load_settings()['settings']) + '/api/v0/models'
            with urllib.request.urlopen(url, timeout=3) as resp:
                data = json.loads(resp.read().decode('utf-8'))
            for m in data.get('data', []):
                if m.get('state') == 'loaded' and m.get('type') != 'embeddings':
                    if m.get('id'):
                        return m['id']
        except Exception:
            pass
        try:
            r = self.list_models()
            if r.get('success') and r.get('models'):
                return r['models'][0]
        except Exception:
            pass
        return None

    def _ac_motivo_sem_modelo(self):
        """Por que `_ac_get_current_model` voltou vazio — as duas causas são outras.

        ⚠️ "Nenhum modelo carregado" com o SERVIDOR DESLIGADO manda o usuário
        procurar no lugar errado: o LM Studio aberto, com modelo na memória, e a
        tela jurando que não há modelo. Foi assim que "salvei e não gerou nada"
        (23/09/2026) ficou sem explicação — nada escutava na porta 1234.

        Qualquer resposta HTTP, mesmo de erro, prova que o servidor está de pé.
        """
        import urllib.request
        import urllib.error
        from ...llm_cliente import obter_endereco_do_lm_studio
        try:
            raiz = obter_endereco_do_lm_studio(self.load_settings()['settings'])
        except Exception:
            raiz = ENDERECO_PADRAO_DO_LM_STUDIO
        try:
            with urllib.request.urlopen(raiz + '/v1/models', timeout=3):
                pass
        except urllib.error.HTTPError:
            pass
        except Exception:
            return ('o servidor do LM Studio não responde em %s — ligue-o na '
                    'aba Developer do LM Studio' % raiz)
        return 'nenhum modelo carregado no LM Studio'
