"""As configurações do programa: ler, gravar e restaurar ao padrão de fábrica.

⚠️ Desde 23/09/2026 não é mais UM `settings.json`: cada categoria de
Configurações grava o próprio JSON em `Internal/config/`, e o mapa chave →
arquivo mora em `configuracoes_arquivos.py`. Quem lê continua recebendo um
dicionário só — onde este texto diz "`settings.json`", leia "o conjunto".

Este arquivo era 1.063 linhas e virou cinco, pelo teto de 500 da AMF. O corte
segue a regra dos Backups, do Inspetor e do `arquivos.py`: **cada arquivo
responde uma pergunta diferente**.

| Arquivo | A pergunta que ele responde |
|---|---|
| `configuracoes.py` | como se lê, se grava e se restaura o `settings.json` |
| `configuracoes_encerrar.py` | quando o programa pergunta antes de fechar ou excluir |
| `configuracoes_modelo.py` | a política de saída e os tetos em token |
| `configuracoes_interface.py` | a ordem das abas e o desempenho dos mapas |
| `configuracoes_extensoes.py` | que extensões e pastas ficam de fora |

`ConfigsMixin` continua sendo o nome único que `api.py` importa: ele COMPÕE os
quatro, no padrão de `InspetorMixin` (Convenção 5 da Arquitetura modular).
Nenhum tem `__init__` nem `super()`, o que torna a herança múltipla inerte.

⚠️ `ler_extensoes` E `excecao_de` CONTINUAM SAINDO DAQUI. Quatro módulos as
importam por este endereço (`aparencia.py`, `ignorados.py`, `indexacao.py`,
`linguagens.py`, e o grep dos subagentes), e é o `import *` de
`configuracoes_extensoes.py`, logo abaixo, que mantém isso de pé. Não trocar por
import seletivo.

⚠️ `save_settings_parcial`, E QUASE NUNCA `save_settings`. O segundo grava o
arquivo INTEIRO a partir do que recebeu: chamá-lo com duas chaves apaga todas as
outras — tema, ícones, limites e a lista de assistentes de uma vez só. O sintoma
é chave que "some sozinha" do disco, sem erro nenhum. O último ponto do programa
que ainda fazia isso foi corrigido em `arquivos_assistentes.py::save_assistentes`.
"""

from .constantes import *
# ⚠️ `import *`, e não import seletivo: é ele que faz este módulo continuar
# sendo o endereço público de `ler_extensoes` e `excecao_de`.
from .configuracoes_extensoes import *
from .configuracoes_extensoes import ConfigsExtensoesMixin

from .configuracoes_arquivos import (TRAVA_DA_CONFIG, arquivo_da_chave,
                                     arquivos_de_settings, chaves_de_limites,
                                     avisar_configuracao_mudou,
                                     gravar_chaves_no_arquivo,
                                     ler_arquivo_de_config,
                                     ler_chaves_dos_arquivos)
from .arvore_externa import gravar_json_de_config
from .configuracoes_encerrar import ConfigsEncerrarMixin
from .configuracoes_modelo import ConfigsModeloMixin
from .configuracoes_interface import ConfigsInterfaceMixin


class ConfigsMixin(ConfigsEncerrarMixin, ConfigsModeloMixin,
                   ConfigsInterfaceMixin, ConfigsExtensoesMixin):
    # ── Configurações ─────────────────────────────────────────────────────────
    #
    # ⚠️ O padrão de fábrica do `settings.json` mora AQUI, num lugar só. Era um
    # dicionário local dentro do `load_settings`, inalcançável de fora — e por
    # isso o "Restaurar padrão" de cada categoria acabava repetindo os números à
    # mão no JavaScript, uma segunda lista para divergir da primeira no primeiro
    # dia em que alguém mexesse numa delas.
    #
    # Os tetos das ferramentas entram por `**PADROES_DAS_FERRAMENTAS`, e não
    # copiados: eram os MESMOS cinco números escritos duas vezes, aqui e lá
    # (`max_rodadas_ferramentas`, `max_ferramentas_rodada`,
    # `max_paralelo_subagentes`, `teto_ler_arquivo_tokens`, `teto_parte_tokens`).
    #
    # A Fila NÃO tem timeout por tarefa: a pesquisa demora o quanto precisar, e o
    # freio dela é o Contador de rodadas. As chaves `fila_timeout_*` foram
    # removidas junto com o código que as lia — um valor esquecido no
    # `settings.json` do usuário fica inerte.
    _SETTINGS_DEFAULTS = {
        **PADROES_DAS_FERRAMENTAS,
        # Os limites do servidor MCP entram pelo mesmo caminho, e por isso o
        # "Restaurar padrão" da categoria funciona sem nenhum código próprio.
        **PADROES_DO_MCP,
        # O destino da pasta dos MCPs de terceiro. Entra pelo mesmo caminho, e
        # por isso o "Restaurar padrão" da categoria "Servidores MCP" funciona
        # sem nenhum código próprio — como o dos limites logo acima.
        **PADROES_DOS_MCPS,
        'lm_studio_url': ENDERECO_PADRAO_DO_LM_STUDIO,
        # ⚠️ Reserva: a escolha mora na página da extensão Ícones de arquivo
        # desde a fase 13 (23/09/2026, campo "Pacote em uso"); estas duas só
        # valem para quem nunca gravou lá (`icones.js::_iconesPacoteEscolhido`).
        # Não têm mais tela, e não se apagam: são o valor do usuário (D20).
        'icones_customizados': True,
        # QUAL conjunto de ícones — o caminho relativo de uma extensão do tipo
        # 24 dentro de `External/extensions/`, ou vazio para nenhum (emoji).
        # Fica ao lado de `icones_customizados` porque as duas são a mesma
        # pergunta em dois passos: mostrar ícone colorido, e qual.
        # ⚠️ O padrão deixou de ser vazio em 04/09/2026: o Material Icon Theme
        # saiu de `assets/icons/` e virou a extensão "Ícones de arquivo". Vazio
        # hoje significa "nenhum pacote — emoji", que é uma escolha legítima e
        # não mais o padrão de fábrica.
        'pacote_de_icones': 'Ícones de arquivo',
        'subagente_timeout_enabled': False,
        'subagente_timeout_min': 5,
        'formato_garantido': FORMATO_GARANTIDO_PADRAO,
        'resgate_da_resposta': RESGATE_DA_RESPOSTA_PADRAO,
        # O cartão "Modelo e geração": modelo, pensamento por área e ajustes
        # de geração. Mesmo caminho do `**` das ferramentas.
        **PADROES_DO_MODELO_E_GERACAO,
        # As CINCO confirmações da categoria "Encerrar e excluir". Aqui, e não
        # em `limites.json`, pelo mesmo motivo dos dois de cima.
        'confirmar_ao_fechar': CONFIRMAR_AO_FECHAR_PADRAO,
        'confirmar_ao_sair_do_projeto': CONFIRMAR_AO_SAIR_DO_PROJETO_PADRAO,
        'confirmar_ao_fechar_o_projeto': CONFIRMAR_AO_FECHAR_O_PROJETO_PADRAO,
        'confirmar_ao_deletar': CONFIRMAR_AO_DELETAR_PADRAO,
        'confirmar_ao_fechar_arquivo_nao_salvo':
            CONFIRMAR_AO_FECHAR_ARQUIVO_NAO_SALVO_PADRAO,
        'tema': TEMA_PADRAO,
        # Os assistentes externos: como cada um é lançado, para onde cada
        # categoria vai e como chega. Lista ÚNICA desde 2026-09-02 — antes eram
        # `presets_arquivos`, `presets_preparar` e `presets_produto_assistente`,
        # três listas casadas por string que se dessincronizaram sozinhas.
        'assistentes_externos': ASSISTENTES_EXTERNOS,
        'assistente_externo_padrao': ASSISTENTE_EXTERNO_PADRAO,
        # O molde que todo projeto novo recebe: quais itens da biblioteca vão e
        # que pastas nascem junto. Aponta para um assistente; o "para onde vai"
        # sai de lá, e não se repete aqui.
        'inicios_rapidos': INICIOS_RAPIDOS,
        'inicio_rapido_padrao': INICIO_RAPIDO_PADRAO,
        # Os presets do Acervo (Configurações → Acervo): cada um é uma lista
        # nomeada de pastas. Um projeto escolhe um pelo NOME
        # (`acervo_preset_ativo`, no Workspace.json) — nasce sem nenhum
        # escolhido, de propósito.
        'acervo_presets': ACERVO_PRESETS,
        # Onde a notificação aparece, que tamanho tem e o que avisa. Mesmo
        # caminho do MCP: o `**` faz o "Restaurar padrão" da categoria
        # funcionar sem código próprio.
        **PADROES_DAS_NOTIFICACOES,
        # Configurações › Arquivos: qual `.md` é o principal de uma skill, e o
        # que fazer no empate. Mesmo caminho.
        **PADROES_DA_BIBLIOTECA,
        # Aba Editor: botões da barra, métrica do texto, teto da colorização e
        # o Histórico local. Mesmo caminho dos dois de cima.
        **PADROES_DO_EDITOR,
        # A barra de Acesso rápido (onde ela abre, que tamanho tem, que modos
        # tem) e as teclas que o usuário trocou. Dois dicionários porque são
        # duas categorias — ver o comentário em `padroes_de_fabrica.py`.
        **PADROES_DO_ACESSO_RAPIDO,
        **PADROES_DO_TECLADO,
        # O histórico da barra: fora do dicionário da categoria, para o
        # "Restaurar padrão" dela não apagá-lo.
        **PADROES_DO_HISTORICO,
    }

    # As chaves que moravam em `INICIOS_RAPIDOS_FILE_ANTIGO`. Continuam sendo
    # lidas de lá enquanto o boot não o renomeia (`migrar_nomes_de_config`);
    # onde elas moram agora quem diz é o mapa de `configuracoes_arquivos.py`.
    _CHAVES_DOS_INICIOS_RAPIDOS = ('inicios_rapidos', 'inicio_rapido_padrao')

    @staticmethod
    def _ler_json(caminho):
        """O dicionário gravado em `caminho`, ou `{}` se não existe ou não abre."""
        if not os.path.exists(caminho):
            return {}
        try:
            with open(caminho, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return data if isinstance(data, dict) else {}
        except Exception:
            return {}

    def load_settings(self):
        return {'success': True, 'settings': carregar_settings()}

    # ⚠️ `load_mapa_icones` SAIU em 04/09/2026, junto com `MAPA_ICONES_FILE`.
    # O Material Icon Theme morava em `Code/assets/icons/` e era carregado por
    # aqui, no boot; ele virou a extensão **Ícones de arquivo** (tipo 24) e o
    # mapa passa a chegar ao frontend pelo mesmo caminho de qualquer outro dado
    # de M6 — a lista de extensões ligadas. Sem pacote ligado, a tela usa emoji.
    #
    # Quem procurava este método: `xtAplicarIconesEscolhidos`
    # (`frontend/modulos/icones.js`) é hoje o único lugar que decide qual
    # mapa vale.

    def _schema_da_rotina(self, nome_do_arquivo):
        """O esquema de uma rotina, ou `None` se o Formato garantido está desligado.

        Devolver `None` é o que faz `chat_json` cair na chamada normal — o
        mesmo caminho de um servidor sem suporte a `response_format`. Um
        interruptor só, num lugar só.
        """
        if not self._formato_garantido_ligado():
            return None
        from .agentes.llm_estruturado import carregar_schema
        return carregar_schema(nome_do_arquivo)

    def _schema_da_fila(self):
        """O esquema do agente principal da Fila, ou `None` se o interruptor
        está desligado.

        Irmão de `_schema_da_rotina`, e não uma variante dele: o esquema da Fila
        mora em `prompts/Assistente/Fila/`, ao lado do prompt dela, e quem o
        alcança é `carregar_schema_do_assistente`.
        """
        if not self._formato_garantido_ligado():
            return None
        from .agentes.llm_estruturado import carregar_schema_do_assistente
        return carregar_schema_do_assistente(PASTA_FILA, 'system-prompt.json')

    # ── Restaurar padrão, por categoria ──────────────────────────────────
    #
    # Uma tabela só, e um método só. Antes havia TRÊS estratégias diferentes para
    # o mesmo botão — apagar o arquivo (Extensões), mandar os defaults duplicados
    # no JavaScript (Mapas) e gravar `{}` pedindo reinício (Ordem das abas) — e
    # cinco das oito categorias simplesmente não tinham botão.
    #
    # ⚠️ `janela_contexto` NÃO entra em 'modelo', e é o ponto: ela é
    # somente-leitura, escrita por `get_context_window()` a partir do modelo
    # carregado no LM Studio. Não é uma preferência, é uma leitura da máquina —
    # não existe padrão de fábrica para ela. **Restaurar padrão restaura o que
    # você pode DIGITAR.**
    #
    # Ficam de fora as categorias com estado próprio, que já têm método:
    # `extensoes` → `reset_extensoes` (apaga o arquivo, que é o estado de
    # instalação nova), `render` → `save_render_mapas`, `ordem` →
    # `save_tab_order({})`.
    _PADROES_POR_CATEGORIA = {
        'modelo': {
            'limites':  ('teto_entrada_pct', 'teto_saida_pct', 'margem_pct'),
            'settings': ('lm_studio_url', 'formato_garantido', 'resgate_da_resposta') + tuple(PADROES_DO_MODELO_E_GERACAO),
        },
        'tempos': {
            'limites':  ('debounce_t1_segundos', 'debounce_t2_segundos',
                         'debounce_t3_segundos', 'timeout_agente_minutos'),
            'settings': ('subagente_timeout_enabled', 'subagente_timeout_min'),
        },
        'rotinas':     {'limites':  ('paralelas_rotinas', 'ignorar_so_espaco',
                                     'ignorar_so_comentario',
                                     'doc_tecnica_similaridade_pct',
                                     'resumo_pastas_similaridade_pct',
                                     'pipeline_cadeia_refazer_pct',
                                     'pipeline_bloco_refazer_pct',
                                     'pipeline_area_refazer_pct',
                                     'pipeline_cadeia_niveis',
                                     'pedaco_tokens', 'teto_proporcional_base',
                                     'teto_proporcional_fator',
                                     'limite_sintese_chars', 'limite_texto_chars',
                                     'limite_atribuicoes', 'limite_tags',
                                     'limite_termos_por_arquivo',
                                     # D30, D36: Partes e costura · D29: Quem entra no Glossário
                                     'resumo_pastas_tokens_por_arquivo',
                                     'resumo_pastas_margem_estimativa_pct',
                                     'resumo_pastas_max_arquivos_por_parte',
                                     # D21, D28: Partes e costura, um cartão por rotina
                                     'doc_tecnica_teto_entrada_pct', 'doc_tecnica_dividir',
                                     'doc_tecnica_max_kb', 'doc_tecnica_max_linhas',
                                     'doc_tecnica_max_tokens',
                                     'resumo_pastas_teto_entrada_pct', 'resumo_pastas_dividir',
                                     'resumo_pastas_max_arquivos', 'resumo_pastas_max_tokens',
                                     'resumo_pastas_ficha_atribuicoes',
                                     'resumo_pastas_ficha_simbolos',
                                     'resumo_pastas_ficha_frases', 'resumo_pastas_ficha_usa',
                                     'glossario_minimo_modo', 'glossario_minimo_pct',
                                     'glossario_minimo_piso', 'glossario_minimo_fixo')},
        # 'render' tem arquivo próprio (`RENDER_MAPAS_FILE`), então o bucket
        # é outro — mas o botão e o caminho são os mesmos. Os números viviam
        # DUPLICADOS no JavaScript (`config-render.js`), e batiam com estes
        # por sorte.
        'render':      {'render': True},
        'ferramentas': {'settings': tuple(PADROES_DAS_FERRAMENTAS)},
        'mcp':         {'settings': tuple(PADROES_DO_MCP)},
        # ⚠️ `mcp` e `mcps` são DUAS categorias, e a diferença de uma letra é
        # deliberada: `mcp` são os limites dos dois servidores DO PROGRAMA,
        # `mcps` é o que acontece ao ligar um MCP de terceiro. Restaurar uma não
        # pode mexer na outra — são perguntas diferentes, e quem afinou vinte
        # limites não quer perdê-los ao consertar um caminho de pasta.
        'mcps':        {'settings': tuple(PADROES_DOS_MCPS)},
        # ⚠️ 'icones' não tem mais categoria nem "Restaurar padrão" (fase 13),
        # e FICA nesta tabela mesmo assim: desde a fase 02 ela é também o mapa
        # chave → arquivo (`configuracoes_arquivos._montar_mapa`). Tirá-la
        # daqui deixaria `icones-de-arquivos-e-pastas.json` sem leitor, e a
        # reserva do D20 cairia no padrão de fábrica, perdendo a escolha.
        'icones':      {'settings': ('icones_customizados', 'pacote_de_icones')},
        'tema':        {'settings': ('tema',)},
        # Devolve os inícios rápidos de fábrica e o padrão. Passa pelo caminho
        # comum porque são só mais duas chaves do settings.json — não precisam
        # do bucket próprio que `render` e `extensoes` precisaram.
        # ⚠️ Restaurar aqui devolve inícios rápidos cujo campo `assistente`
        # aponta para NOMES DE FÁBRICA. Se o usuário renomeou ou excluiu um
        # assistente, o início rápido restaurado aponta para o vazio — e é por
        # isso que `_inicio_rapido` cai no assistente padrão quando o nome não
        # existe, do mesmo jeito que já fazia com o preset órfão.
        'preparar':    {'settings': ('inicios_rapidos', 'inicio_rapido_padrao')},
        # Os presets do Acervo — volta só à lista de fábrica (o preset
        # "Padrão"). Não mexe em qual preset cada projeto tem ativo
        # (`acervo_preset_ativo` mora no Workspace.json de cada um, fora do
        # alcance de um "Restaurar padrão" que é sobre settings.json).
        'acervo':      {'settings': ('acervo_presets',)},
        # ⚠️ A CHAVE DA CATEGORIA CONTINUA 'arquivos', mesmo a tela agora se
        # chamando "Assistentes externos": ela casa com `_CONFIG_REPINTORES`
        # (config-categorias.js) e com o `data-categoria` do trilho. Três
        # lugares, um nome, zero verificação — renomear a chave apaga a
        # categoria da tela sem erro nenhum.
        # Categoria separada para o "Restaurar padrão" de uma não mexer na outra.
        'arquivos':    {'settings': ('assistentes_externos', 'assistente_externo_padrao')},
        # Volta a notificação ao canto inferior direito, tamanho médio e todas
        # as origens em "Tudo" — o estado de instalação nova.
        'notificacoes': {'settings': tuple(PADROES_DAS_NOTIFICACOES)},
        # ⚠️ `biblioteca`, e não `arquivos` — `arquivos` é "Assistentes externos".
        'biblioteca':   {'settings': tuple(PADROES_DA_BIBLIOTECA)},
        # "Encerrar e excluir": volta a perguntar ao fechar o programa, ao sair
        # do projeto e ao fechar a aba de um projeto só quando há IA rodando, e
        # a confirmar antes de remover.
        #
        # ⛔ O "Restaurar padrão" das outras doze categorias NÃO passa pela
        # confirmação de remover: ele apaga valores de configuração, e isso não
        # é "excluir" no sentido que a categoria promete — chat, tarefa,
        # histórico e relatório. Pôr as duas coisas sob a mesma pergunta
        # esvaziaria o aviso justamente onde ele importa.
        'confirmacoes': {'settings': ('confirmar_ao_fechar',
                                      'confirmar_ao_sair_do_projeto',
                                      'confirmar_ao_fechar_o_projeto',
                                      'confirmar_ao_deletar',
                                      'confirmar_ao_fechar_arquivo_nao_salvo')},
        # Aba Editor. `tuple(PADROES_DO_EDITOR)` e não a lista escrita à mão:
        # acrescentar uma opção lá passa a valer aqui sozinho, e o botão de
        # restaurar nunca fica sabendo de metade das chaves.
        'editor':      {'settings': tuple(PADROES_DO_EDITOR)},
        # As duas categorias da barra de Acesso rápido. Separadas de propósito:
        # restaurar a posição da barra não pode apagar as teclas que o usuário
        # escolheu, nem o contrário.
        #
        # ⚠️ As chaves aqui são as mesmas passadas em `registrarCategoriaConfig`
        # e no `data-categoria` do trilho — 'acesso-rapido' com HÍFEN. Se
        # divergirem, "Restaurar padrão" devolve `success: false` e ninguém
        # descobre até alguém clicar no botão. É o mesmo laço de três pontas de
        # 'arquivos', logo acima.
        'acesso-rapido': {'settings': tuple(PADROES_DO_ACESSO_RAPIDO)},
        'teclado':       {'settings': tuple(PADROES_DO_TECLADO)},
    }

    def restaurar_padroes(self, categoria):
        """Volta uma categoria ao estado de fábrica e DEVOLVE o estado final.

        Devolver o resultado é parte do contrato, não conveniência: a tela
        repinta com o que foi de fato gravado, em vez de adivinhar o que deveria
        ter sido. É o que `reset_extensoes` já fazia — o bom exemplo virou regra.
        """
        try:
            alvo = self._PADROES_POR_CATEGORIA.get(categoria)
            if not alvo:
                return {'success': False,
                        'error': 'categoria sem padrão de fábrica: %s' % categoria}

            if alvo.get('limites'):
                atuais = dict(self.load_limites()['limites'])
                atuais.update({k: self._LIMITES_DEFAULTS[k] for k in alvo['limites']})
                self.save_limites(atuais)

            if alvo.get('settings'):
                self.save_settings_parcial(
                    {k: self._SETTINGS_DEFAULTS[k] for k in alvo['settings']})

            if alvo.get('render'):
                self.save_render_mapas(dict(self._RENDER_DEFAULTS))

            return {'success': True,
                    'limites': self.load_limites()['limites'],
                    'settings': self.load_settings()['settings'],
                    'render': self.load_render_mapas().get('render')}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def padroes_das_ferramentas(self):
        """Os padrões de fábrica da categoria "Ferramentas dos subagentes".

        A tela pede em vez de repetir a lista: dois lugares com o mesmo padrão
        divergem no primeiro dia em que alguém mexe num deles — e aí o campo
        mostra um número e o Python usa outro.
        """
        return {'success': True, 'padroes': dict(PADROES_DAS_FERRAMENTAS)}

    def save_settings_parcial(self, patch):
        """Grava SÓ as chaves do patch, preservando o resto do `settings.json`.

        Existe por causa de um defeito real: `save_settings` grava o dicionário
        inteiro, então quem o chamava tinha que mandar o estado completo. Duas
        telas mandavam `{...appSettings, campo: valor}` e uma terceira relia do
        disco sem atualizar o `appSettings` em memória — e aí a sequência
        "mudar subagentes em paralelo → trocar o tema" REVERTIA a primeira
        mudança, em silêncio, porque o tema regravava o `appSettings` velho por
        cima.

        Com o patch parcial não há estado completo para ficar velho: cada tela
        manda o que mexeu, e o merge acontece aqui, sobre o disco.
        """
        try:
            atual = self.load_settings()['settings']
            atual.update(patch or {})
            return self.save_settings(atual)
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def save_settings(self, settings):
        """Grava o `settings.json` INTEIRO, substituindo o que estava lá.

        ⚠️ QUEM CHAMA É `save_settings_parcial` E `restaurar_padroes`, E MAIS
        NINGUÉM. A ponte do pywebview expõe este método ao JavaScript, e a
        tentação de mandar `{...appSettings, campo: valor}` de uma tela é
        natural — e errada. `appSettings` é carregado UMA vez, no boot; mandar
        essa foto de volta apaga toda chave que outra tela gravou depois dela.
        O defeito real que isso causou está contado no docstring de
        `save_settings_parcial`, logo acima; ele voltou uma segunda vez porque
        duas telas (tema e ícones) não tinham sido migradas na primeira.

        ⛔ NÃO APAGUE ESTE MÉTODO para "forçar" o uso do parcial: ele é o único
        escritor de verdade, e o parcial chama ele.

        Grava UM ARQUIVO POR CATEGORIA (o mapa mora em
        `configuracoes_arquivos.py`), e três regras seguram isso de pé:

        1. **Cada arquivo recebe só as chaves dele**, e uma chave de settings
           que ele tinha e não veio no dicionário SAI — é o que mantém
           `load_settings()` → `pop` → `save_settings()` tirando uma chave
           (`migracao_assistentes.py::_mig_apagar_velhas`). As chaves de
           LIMITES do mesmo arquivo não se tocam: são de `save_limites`.
        2. **Arquivo que não recebeu nenhuma chave não é tocado** — um chamador
           que não as mandou não pode apagá-las.
        3. **O `settings.json` vai por último**, só com as sobras (chave sem
           arquivo). Gravar o novo antes de tirar o velho é o que faz uma queda
           no meio deixar o valor dos dois lados, nunca de nenhum.

        Tudo por `gravar_json_de_config` (temporário + `os.replace`).
        """
        try:
            limites = chaves_de_limites()
            antes = carregar_settings()     # para o `configuracao.mudou`, no fim
            por_arquivo, sobras = {}, {}
            for chave, valor in settings.items():
                if chave in limites:
                    continue            # de `save_limites`, nunca daqui
                nome = arquivo_da_chave(chave)
                if nome:
                    por_arquivo.setdefault(nome, {})[chave] = valor
                else:
                    sobras[chave] = valor

            with TRAVA_DA_CONFIG:
                for nome, chaves in por_arquivo.items():
                    tirar = [k for k in ler_arquivo_de_config(nome)
                             if k not in chaves and k not in limites]
                    gravar_chaves_no_arquivo(nome, chaves, remover=tirar)
                # O arquivo antigo dos inícios rápidos, se o boot ainda não o
                # renomeou: as duas chaves já estão no novo, então saem dele.
                if (os.path.exists(INICIOS_RAPIDOS_FILE_ANTIGO)
                        and os.path.basename(INICIOS_RAPIDOS_FILE) in por_arquivo):
                    gravar_chaves_no_arquivo(
                        os.path.basename(INICIOS_RAPIDOS_FILE_ANTIGO), {},
                        remover=self._CHAVES_DOS_INICIOS_RAPIDOS)
                gravar_json_de_config(os.path.basename(SETTINGS_FILE), sobras)
            # Fora da trava e depois de gravar — ver `avisar_configuracao_mudou`.
            avisar_configuracao_mudou(antes, carregar_settings())
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}


def carregar_settings():
    """O dicionário de settings inteiro: padrão + reservas + um arquivo por categoria.

    Função de módulo, e não só o método, porque `aparencia_elemento.py` lê o
    tema sem ter uma `Api` à mão.

    ⚠️ A ORDEM DO MERGE É A MIGRAÇÃO. Os arquivos novos vêm por último e
    vencem; enquanto um deles não existe, vale o valor que ainda estiver no
    `settings.json` (ou no `inicios-rapidos.json`) antigo. A primeira gravação
    (`save_settings`) cria os novos e tira as chaves dos velhos.

    ⚠️ OS DOIS SERVIDORES MCP CHAMAM ISTO A CADA FERRAMENTA. Nunca levanta:
    arquivo ausente ou corrompido vale `{}`, e a chave cai na reserva ou no
    padrão de fábrica.
    """
    limites = chaves_de_limites()
    antigo = {k: v for k, v in
              ler_arquivo_de_config(os.path.basename(SETTINGS_FILE)).items()
              if k not in limites}
    inicios = {k: v for k, v in
               ler_arquivo_de_config(os.path.basename(INICIOS_RAPIDOS_FILE_ANTIGO)).items()
               if k in ConfigsMixin._CHAVES_DOS_INICIOS_RAPIDOS}
    novos = ler_chaves_dos_arquivos(arquivos_de_settings(), so_limites=False)
    return {**ConfigsMixin._SETTINGS_DEFAULTS, **antigo, **inicios, **novos}

