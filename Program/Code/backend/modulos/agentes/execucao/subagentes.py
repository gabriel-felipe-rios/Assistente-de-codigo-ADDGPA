"""Os prompts dos subagentes, e o disparo de uma leva deles em paralelo.

Este arquivo era 732 linhas e virou três, pelo teto de 500 da AMF:

| Arquivo | A pergunta que ele responde |
|---|---|
| `subagentes.py` | o que cada subagente lê antes de começar, e como uma leva é disparada |
| `subagentes_constantes.py` | quem são eles, quantas rodadas têm, e a parada |
| `subagentes_execucao.py` | rodar UM, do prompt à entrega |

`SubagentesMixin` continua sendo o nome único que `api.py` importa: ele COMPÕE o
irmão, no padrão de `InspetorMixin` (Convenção 5 da Arquitetura modular).

⚠️ `import *` DE `subagentes_constantes.py` MANTÉM O ENDEREÇO PÚBLICO:
`from ..execucao.subagentes import SUBAGENTES_FILA` (na Fila) e
`SUBAGENTES_TODOS` (no Chat) continuam funcionando. Não trocar por import
seletivo. `com_subagentes_de_extensoes` chega pelo mesmo `import *`.

⚠️ O PARALELO TEM TETO (`MAX_PARALELO`), e o teto é o LM Studio: ele é um só, e
mais threads pedindo ao mesmo tempo deixa todas mais lentas do que se tivessem
esperado a vez.
"""

from .subagentes_constantes import *
from .subagentes_constantes import ParadaPedida

from .subagentes_execucao import SubagentesExecucaoMixin
from ...extensoes.prompts import acrescimos_de_prompt, aplicar_acrescimos


class SubagentesMixin(SubagentesExecucaoMixin):

    # ── Prompts ───────────────────────────────────────────────────────────────
    def _ler_prompt(self, caminho):
        """Lê um arquivo de prompt, pelo caminho que `caminhos.py` montou.

        Recebe caminho pronto, e não um pedaço de caminho: montar caminho é
        papel de `caminhos.py`. A Fila e o Chat chamam este mesmo leitor — os
        mixins todos vivem no mesmo objeto.
        """
        with open(caminho, 'r', encoding='utf-8') as f:
            return f.read()

    def montar_blocos_subagentes(self, subagentes_ativos):
        """Descrição de cada subagente ativo, na ordem canônica, para colar no
        system prompt de quem os chama. Mora aqui, e não dentro da montagem do
        Chat, porque a Fila chama os mesmos dez e usa os mesmos blocos."""
        return '\n\n'.join(
            self._ler_prompt(obter_bloco_de_subagente(nome)).strip()
            for nome in com_subagentes_de_extensoes(SUBAGENTES_TODOS, subagentes_ativos)
            if nome in subagentes_ativos
        )

    def montar_system_prompt_chat(self, project_name, subagentes_ativos, max_rodadas):
        base = self._ler_prompt(
            obter_prompt_do_assistente(PASTA_CHAT, 'system-prompt.txt'))
        blocos = self.montar_blocos_subagentes(subagentes_ativos)
        texto = (base
                 .replace('{blocos_subagentes}', blocos)
                 .replace('{max_chamadas}', str(max_rodadas))
                 # Quantos subagentes por vez: número fixo do programa, e não
                 # escrito à mão no prompt — divergiria no primeiro ajuste.
                 .replace('{max_chamadas_por_vez}', str(MAX_PARALELO)))
        # O que as extensões ligadas acrescentam ao prompt do Chat (D51, D52):
        # entra no marcador {acrescimos_das_extensoes}, ou o marcador some.
        return aplicar_acrescimos(texto, acrescimos_de_prompt(
            self, 'chat', project_name, subagentes_ativos)).strip()

    # ── Configuração ──────────────────────────────────────────────────────────
    def _sub_timeout_segundos(self):
        settings = self.load_settings()['settings']
        if not settings.get('subagente_timeout_enabled'):
            return None
        try:
            minutos = float(settings.get('subagente_timeout_min', 5))
        except (TypeError, ValueError):
            minutos = 5
        return max(minutos, 0.5) * 60

    # ── Execução de um subagente ──────────────────────────────────────────────
    def _sub_max_tokens_resposta(self, valor=None):
        """Teto da resposta final do subagente, em TOKENS.

        Vem de Configurações › "Ferramentas dos subagentes" — um lugar só. Antes
        vinha das abas Chat e Fila, uma cópia em cada, guardadas no
        `localStorage` do navegador: dois números para a mesma coisa, e nenhum
        deles visível de fora da tela que o escrevia.

        `valor` continua aceito para o caso de uma tarefa antiga da Fila trazer
        o número gravado junto dela — tarefa que já estava na fila não muda de
        regra no meio do caminho.
        """
        if valor is None:
            return self._sub_limite('teto_resposta_subagente_tokens')
        try:
            valor = int(valor)
        except (TypeError, ValueError):
            return self._sub_limite('teto_resposta_subagente_tokens')
        return max(200, min(valor, 15000))


    # ── Execução em paralelo (chamada pelo chat) ──────────────────────────────
    def _executar_chamadas_subagentes(self, project_name, chamadas, model, log_cb=None,
                                      max_tokens=None, rastro=None,
                                      obter_parada=None, origem='Chat'):
        """Executa as chamadas em paralelo. Retorna (resultados, bloco_texto):
        resultados = [{'nome', 'pergunta', 'resposta', 'erro'}] na ordem das chamadas;
        bloco_texto = blocos '[RESULTADO — nome]' para o histórico do chat."""
        resultados = [None] * len(chamadas)
        # Uma instância por lote, compartilhada pelas threads: é ela que faz o
        # paralelismo real ser o que a janela aguenta, e não o número fixo do
        # `max_workers`. Mesmo padrão dos agentes de documentação
        # (documentacao_tecnica.py, resumo_pastas.py).
        limites = self.load_limites()['limites']
        portao = PortaoDeContexto(int(limites.get('janela_contexto', 50000)))
        try:
            paralelo = int(self.load_settings()['settings']
                           .get('max_paralelo_subagentes', MAX_PARALELO))
        except (TypeError, ValueError):
            paralelo = MAX_PARALELO
        paralelo = max(1, min(paralelo, MAX_PARALELO))
        with ThreadPoolExecutor(max_workers=paralelo) as ex:
            futs = {
                # ⚠️ O `obter_parada` desce até aqui e entra em cada thread do
                # pool: é o que faz o Parar do Chat alcançar as quatro chamadas
                # simultâneas em vez de só a que estiver na frente.
                ex.submit(self.executar_subagente, project_name,
                          c['subagente'], c['pergunta'], model, log_cb, max_tokens,
                          portao, rastro, obter_parada, origem=origem): i
                for i, c in enumerate(chamadas)
            }
            for fut in as_completed(futs):
                i = futs[fut]
                c = chamadas[i]
                try:
                    r = fut.result()
                except Exception as e:
                    r = {'nome': c['subagente'], 'pergunta': c['pergunta'],
                         'resposta': None, 'erro': str(e), 'erro_tipo': 'execucao'}
                # `uso` vai junto: é o que a barra de tokens do Log soma. O
                # `contexto` continua de fora — ele é grande e o Log já o recebe
                # pelo evento 'fim'.
                # ⚠️ `erro_tipo` VAI JUNTO. Ele se perdia aqui, nesta
                # remontagem, e quem o lê é a Fila, para decidir se carimba a
                # tarefa de "subagente indisponível". Sem o campo a isenção de
                # lá nunca via nada, e TODA tarefa com qualquer erro saía
                # carimbada — que é o que fazia a ressalva perder o sentido,
                # justamente por aparecer sempre.
                resultados[i] = {'nome': r['nome'], 'pergunta': r['pergunta'],
                                 'resposta': r['resposta'], 'erro': r['erro'],
                                 'erro_tipo': r.get('erro_tipo'),
                                 'uso': r.get('uso') or {'entrada': 0, 'saida': 0}}

        partes = []
        for r in resultados:
            # ⚠️ Era um OU EXCLUSIVO: havendo `erro`, a `resposta` nunca era
            # usada. E é exatamente aí que mora a ENTREGA PARCIAL, que o
            # subagente devolve COM o `erro` preenchido — sem isto ela seria
            # montada e descartada antes de chegar a quem pediu.
            if r['erro'] and r['resposta']:
                corpo = f'ERRO: {r["erro"]}\n\n{r["resposta"]}'
            elif r['erro']:
                corpo = f'ERRO: {r["erro"]}'
            else:
                corpo = r['resposta']
            partes.append(f'[RESULTADO — {r["nome"]}]\n{corpo}')
        return resultados, '\n\n'.join(partes)
