"""As ferramentas dos subagentes: a casca que compõe as oito, e o dispatcher.

Este arquivo era 1.490 linhas e virou oito, pelo teto de 500 da AMF — que é
obrigatório. O corte segue a regra que já dividiu os Backups, o Inspetor e o
`arquivos.py`: **cada arquivo responde uma pergunta diferente**.

| Arquivo | A pergunta que ele responde |
|---|---|
| `ferramentas_subagentes.py` | quem tem qual ferramenta, e quem executa qual chamada |
| `_constantes.py` | as tabelas: quem tem qual, o que cada uma faz, o que é binário |
| `_apoio.py` | escopo, tetos, corte e artefato em partes — o chão de todas |
| `_grep.py` | varrer o escopo procurando um termo |
| `_leitura.py` | ler um alvo nomeado: o arquivo, e os artefatos das rotinas |
| `_secoes.py` | ler a Documentação técnica e o Resumo de pastas POR SEÇÃO, de vários alvos numa chamada |
| `_pasta.py` | listar uma pasta — e dizer POR QUE não deu, quando não dá |
| `_simbolos.py` | o que o índice de símbolos e os embeddings respondem |
| `_extensao.py` | a ferramenta que uma extensão ligada atende, e os limites gerais |

`FerramentasSubagentesMixin` continua sendo o nome único que `api.py` importa:
ele COMPÕE as oito, no padrão de `InspetorMixin` (Convenção 5 da Arquitetura
modular). Nenhuma tem `__init__` nem `super()`, o que torna a herança múltipla
inerte — e é isso que deixa os métodos se chamarem por `self` atravessando
arquivo, como sempre fizeram.

⚠️ AS TABELAS SÃO REEXPORTADAS DAQUI. `from modulos.agentes.ferramentas_subagentes
import FERRAMENTAS_POR_SUBAGENTE` (em `execucao/subagentes_constantes.py`)
e `import BINARY_EXTS` (em `configuracoes.py`) continuam funcionando: o
`import *` de `_constantes.py`, logo abaixo, é o que mantém esse endereço
público de pé. Não trocar por import seletivo.

⚠️ O DISPATCHER É A ÚNICA PORTA. Toda ferramenta entra por
`executar_ferramenta`, e é por isso que a conferência de permissão
(`FERRAMENTAS_POR_SUBAGENTE`) e o registro no rastro de leitura moram aqui, e
não dentro de cada `_ferr_*`. Uma segunda porta seria uma ferramenta rodando sem
passar pela permissão nem aparecer no rastro.
"""

# ⚠️ `import *`, e não import seletivo: é ele que faz este módulo continuar
# sendo o endereço público das tabelas para quem já as importava daqui.
from modulos.agentes.ferramentas_subagentes_constantes import *

from modulos.agentes.ferramentas_subagentes_apoio import FerramentasSubagentesApoioMixin
from modulos.agentes.ferramentas_subagentes_grep import FerramentasSubagentesGrepMixin
from modulos.agentes.ferramentas_subagentes_leitura import FerramentasSubagentesLeituraMixin
from modulos.agentes.ferramentas_subagentes_secoes import FerramentasSubagentesSecoesMixin
from modulos.agentes.ferramentas_subagentes_pasta import FerramentasSubagentesPastaMixin
from modulos.agentes.ferramentas_subagentes_simbolos import FerramentasSubagentesSimbolosMixin
from modulos.agentes.ferramentas_subagentes_extensao import (
    FerramentasSubagentesExtensaoMixin, descricao_de_ferramenta_de_extensao,
    ferramenta_de_extensao_ligada)


class FerramentasSubagentesMixin(FerramentasSubagentesApoioMixin,
                                 FerramentasSubagentesGrepMixin,
                                 FerramentasSubagentesLeituraMixin,
                                 FerramentasSubagentesSecoesMixin,
                                 FerramentasSubagentesPastaMixin,
                                 FerramentasSubagentesSimbolosMixin,
                                 FerramentasSubagentesExtensaoMixin):
    # ── Catálogo para a aba Ferramentas ───────────────────────────────────────
    def catalogo_ferramentas(self, escopo='chat'):
        """A tabela da sub-aba Ferramentas, gerada do código.

        `escopo` é 'chat' ou 'fila'. Não é a mesma tabela nos dois: a Fila tem o
        Verificador, que não existe no Chat — por isso a aba mora dentro de cada
        tela, e não em Configurações do programa.
        """
        # Os dois padrões que vinham juntos daqui saíram: os tetos agora são
        # lidos por `_sub_limite`, que já conhece o padrão de fábrica.
        from modulos.agentes.execucao.subagentes import (
            SUBAGENTES_TODOS, SUBAGENTES_SO_FILA, com_subagentes_de_extensoes)

        # O grupo diz QUEM CHAMA aquele subagente, e é o que separa a tabela em
        # seções: os do programa são chamados pelo agente principal da tela; o
        # Verificador é acionado pelo PROGRAMA, ao ver o relatório pronto — não
        # pelo modelo. Sem essa separação, ele parece mais um subagente da
        # Fila, que é justamente o que ele não é.
        agente = 'Chat' if escopo != 'fila' else 'Fila'
        grupos = [{'id': 'subagentes',
                   'titulo': f'Os subagentes do programa — chamados pelo agente {agente}'}]
        pares = [(sub, 'subagentes') for sub in SUBAGENTES_TODOS]
        # Os de extensão num grupo PRÓPRIO: "os do programa" continua dizendo a verdade,
        # e a linha deles mostra as ferramentas que recebem (as que o item
        # declara em `ferramentas`, ou as do Analista — fase 07, D51).
        de_extensoes = com_subagentes_de_extensoes([])
        if de_extensoes:
            grupos.append({'id': 'extensoes',
                           'titulo': f'De extensões — chamados pelo agente {agente}'})
            pares += [(sub, 'extensoes') for sub in de_extensoes]
        if escopo == 'fila':
            grupos.append({'id': 'programa',
                           'titulo': 'Acionado pelo programa — não pelo agente Fila'})
            pares += [(sub, 'programa') for sub in SUBAGENTES_SO_FILA]

        linhas = []
        for sub, grupo in pares:
            for ferr in ferramentas_do_subagente(sub):
                # A de extensão traz o `devolve` e o `se_errar` do manifesto.
                devolve, se_errar = (FERRAMENTAS_DESCRICAO.get(ferr)
                                     or descricao_de_ferramenta_de_extensao(ferr)
                                     or ('—', '—'))
                linhas.append({'subagente': sub, 'grupo': grupo, 'ferramenta': ferr,
                               'devolve': devolve, 'se_errar': se_errar})
            # O Navegador não passa pelo dispatcher: ele não usa LLM, e a pasta
            # que ele lista vem da pergunta. Some da tabela se não for listado
            # à parte, e some justamente do lugar onde alguém iria procurá-lo.
            if sub == 'navegador':
                devolve, se_errar = FERRAMENTAS_DESCRICAO['listar_pasta']
                linhas.append({'subagente': sub, 'grupo': grupo,
                               'ferramenta': 'listar_pasta',
                               'devolve': devolve, 'se_errar': se_errar})

        settings = self.load_settings()['settings']
        return {
            'success': True,
            'grupos': grupos,
            'linhas': linhas,
            'tetos': {
                'rodadas_ferramentas': self._sub_limite('max_rodadas_ferramentas'),
                # ⚠️ O Verificador NÃO roda pelo teto geral. Ele tem uma chave
                # só dele — ver `MAX_RODADAS_FERRAMENTAS_VERIFICADOR_PADRAO`, em
                # `execucao/subagentes.py` —, e a tela dizia o número errado na
                # linha dele: 3 onde o programa usa 5.
                'rodadas_ferramentas_verificador':
                    self._sub_limite('max_rodadas_ferramentas_verificador'),
                'ferramentas_rodada': self._sub_limite('max_ferramentas_rodada'),
                # Pelo leitor único, e não por `settings.get` com o padrão na
                # mão: as duas constantes que estavam aqui deixaram de existir
                # quando os tetos viraram configuração, e a referência morta só
                # aparecia em RUNTIME — derrubando a aba Ferramentas inteira do
                # Chat e da Fila, com o `catch` do JS engolindo o motivo.
                'teto_ler_arquivo': self._sub_limite('teto_ler_arquivo_tokens'),
                'teto_parte': self._sub_limite('teto_parte_tokens'),
            },
        }

    # ── Dispatcher ────────────────────────────────────────────────────────────
    def executar_ferramenta(self, project_name, subagente, nome, parametros, rastro=None):
        """Executa uma ferramenta de subagente. Sempre retorna str (erros viram 'ERRO: ...').

        `rastro` é a conta corrente de leitura da tarefa (ver
        `agentes/rastro_leitura.py`). Quem serve a parte é esta função, então é
        aqui que se sabe o que foi servido — e é aqui que o erro é anotado, com
        o alvo que o modelo pediu.
        """
        parametros = parametros or {}

        def _erro(mensagem):
            if rastro is not None:
                alvo = (parametros.get('caminho') or parametros.get('parte')
                        or parametros.get('termo') or parametros.get('descricao')
                        or parametros.get('ler') or '')
                # ⚠️ `str(...)`, e não o valor cru. `validar_ferramentas` confere
                # que `parametros` é um dict, NUNCA o tipo dos valores — e o
                # modelo mandar `{"parte": 3}` é plausível, porque as partes são
                # apresentadas a ele como "parte 3 de 40". Com um int aqui, o
                # `.strip()` lá dentro de `registrar_erro` levantava
                # AttributeError DE DENTRO do `except ValueError`: a exceção
                # escapava dos dois tratadores, subia até o laço do subagente e
                # matava a chamada inteira com `resposta=None` e sem entrega
                # parcial — em vez de virar uma linha `ERRO:` como qualquer
                # outro parâmetro ruim.
                rastro.registrar_erro(nome, str(alvo), mensagem)
            return mensagem

        # ⚠️ A conferência vem DEPOIS de `_erro` de propósito. Este era o único
        # erro da função que não passava por ele, e por isso não entrava no
        # rastro de leitura: o orquestrador repetia a mesma ferramenta indevida
        # rodada após rodada sem nada lembrá-lo.
        # Para os ids do programa é o `.get(subagente, [])` de sempre; um id de
        # extensão recebe as do Analista (`ferramentas_do_subagente`).
        validas = ferramentas_do_subagente(subagente)
        if nome not in validas:
            return _erro(f'ERRO: ferramenta "{nome}" não disponível para o '
                         f'subagente {subagente}.')

        try:
            if nome == 'grep':
                return self._ferr_grep(project_name, parametros.get('termo'),
                                       parametros.get('pasta'))
            if nome == 'ler_arquivo':
                return self._ferr_ler_arquivo(project_name, parametros.get('caminho'),
                                              parametros.get('linhas'))
            if nome == 'ler_indice':
                return self._ferr_ler_indice(project_name, parametros.get('parte'),
                                             parametros.get('filtro'), rastro)
            if nome == 'ler_pipeline':
                return self._ferr_ler_pipeline(project_name, parametros.get('parte'),
                                               parametros.get('filtro'), rastro)
            if nome == 'ler_resumo_pastas':
                return self._ferr_ler_resumo_pastas(project_name, parametros.get('ler'))
            if nome == 'ler_grafo_imports':
                return self._ferr_ler_grafo_imports(project_name, parametros.get('parte'),
                                                    rastro)
            if nome == 'ler_glossario':
                return self._ferr_ler_glossario(project_name, parametros.get('termo'),
                                                parametros.get('topico'))
            if nome == 'ler_doc_tecnica':
                return self._ferr_ler_doc_tecnica(project_name, parametros.get('ler'))
            if nome == 'ler_relacoes':
                return self._ferr_ler_relacoes(project_name, parametros.get('caminho'))
            if nome == 'busca_semantica':
                return self._ferr_busca_semantica(project_name, parametros.get('descricao'),
                                                  parametros.get('tipo'))
            # Fase 07 (D51): uma ferramenta que uma extensão LIGADA declara. A
            # permissão já foi conferida acima (`ferramentas_do_subagente`
            # inclui as da extensão), e o erro dela passa pelo mesmo `_erro`.
            de_extensao = ferramenta_de_extensao_ligada(nome)
            if de_extensao is not None:
                return self._ferr_de_extensao(project_name, subagente, de_extensao,
                                              parametros)
            return _erro(f'ERRO: ferramenta desconhecida: {nome}')
        except ValueError as e:
            return _erro(f'ERRO: {e}')
        except Exception as e:
            return _erro(f'ERRO inesperado em {nome}: {e}')
