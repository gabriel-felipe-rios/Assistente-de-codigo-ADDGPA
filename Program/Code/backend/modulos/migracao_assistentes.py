# -*- coding: utf-8 -*-
"""A migração das três chaves velhas para a lista única de assistentes externos.

⚠️ ISTO RODA UMA VEZ, no boot, e depois nunca mais. O marcador não é um número
de versão — este projeto não tem `schema_version` — e sim a PRESENÇA das chaves
velhas no `settings.json`. Sumiram, migrou; ainda estão lá, não migrou.

O que existia antes:

    presets_arquivos            + preset_arquivos_padrao       → para onde vai, como chega
    presets_preparar            + preset_preparar_padrao       → quais itens vão, e o CLAUDE.md
    presets_produto_assistente  + preset_produto_padrao        → como é lançado

As três falavam do MESMO assistente e casavam pelo campo `nome`, por string,
sem verificação nenhuma. É esse casamento que perdeu o OpenCode sozinho.

O que passa a existir:

    assistentes_externos  + assistente_externo_padrao
    inicios_rapidos       + inicio_rapido_padrao

⚠️ E A ORDEM IMPORTA. As chaves novas são gravadas e CONFERIDAS primeiro; só
depois as velhas são apagadas. Fazer as duas coisas na mesma gravação deixaria a
janela em que uma falha perde os dois lados.

⚠️ Apagar chave do `settings.json` NÃO é `save_settings_parcial`. Aquele só faz
`update`, e `load_settings` faz merge raso (`{**default, **data}`) — uma chave
que só existe no disco SOBREVIVE à leitura e é REGRAVADA a cada gravação
parcial. O único caminho que remove de verdade é
`load_settings()` → `pop` → `save_settings()`, e é por isso que este módulo é o
terceiro (e último) chamador legítimo de `save_settings`.
"""
import os
import shutil

from .constantes import ARQUIVOS_DIR, ASSISTENTES_EXTERNOS, ASSISTENTE_EXTERNO_PADRAO
from .constantes import INICIO_RAPIDO_PADRAO, CATEGORIAS_DO_ASSISTENTE
from .constantes import CATEGORIAS_DO_INICIO_RAPIDO


class MigracaoAssistentesMixin:

    _MIG_CHAVES_VELHAS = (
        'presets_arquivos', 'preset_arquivos_padrao',
        'presets_preparar', 'preset_preparar_padrao',
        'presets_produto_assistente', 'preset_produto_padrao',
    )

    # A pasta da biblioteca onde o texto do CLAUDE.md passa a morar.
    _MIG_PASTA_INSTRUCOES = 'Instruções base'

    # ── O passo público ───────────────────────────────────────────────────
    def migrar_assistentes_externos(self):
        """Migra, se houver o que migrar. Devolve um relatório do que fez."""
        s = self.load_settings().get('settings', {}) or {}
        velhas = [k for k in self._MIG_CHAVES_VELHAS if k in s]
        if not velhas:
            return {'success': True, 'migrado': False, 'motivo': 'nada a migrar'}

        rel = {'success': True, 'migrado': True, 'chaves_apagadas': [],
               'assistentes': [], 'inicios_rapidos': [], 'itens_criados': [],
               'projetos': [], 'avisos': []}

        arquivos = _lista(s.get('presets_arquivos'))
        preparar = _lista(s.get('presets_preparar'))
        produtos = _lista(s.get('presets_produto_assistente'))

        # 1 ── Os itens de biblioteca, ANTES dos inícios rápidos: é o passo 4
        #      que dá o nome do item que o passo 6 vai marcar.
        itens_por_assistente = self._mig_criar_instrucoes_base(preparar, rel)

        # 2 ── A lista única.
        assistentes = self._mig_montar_assistentes(arquivos, preparar, produtos, rel)

        # 3 ── Os inícios rápidos.
        inicios = self._mig_montar_inicios(preparar, assistentes,
                                           itens_por_assistente, rel)

        # 4 ── Gravar o novo. Parcial, para não tocar em mais nada do arquivo.
        padrao_assist = (s.get('preset_arquivos_padrao')
                         or s.get('preset_produto_padrao')
                         or ASSISTENTE_EXTERNO_PADRAO)
        padrao_inicio = s.get('preset_preparar_padrao') or INICIO_RAPIDO_PADRAO
        nomes_assist = [a['nome'] for a in assistentes]
        nomes_inicio = [i['nome'] for i in inicios]
        r = self.save_settings_parcial({
            'assistentes_externos': assistentes,
            'assistente_externo_padrao': (padrao_assist if padrao_assist in nomes_assist
                                          else (nomes_assist[0] if nomes_assist else '')),
            'inicios_rapidos': inicios,
            'inicio_rapido_padrao': (padrao_inicio if padrao_inicio in nomes_inicio
                                     else (nomes_inicio[0] if nomes_inicio else '')),
        })
        if not r.get('success'):
            return {'success': False, 'error': 'falha ao gravar as chaves novas: %s'
                                               % r.get('error')}

        # 5 ── CONFERIR antes de apagar. Se o disco não voltou com as duas
        #      chaves novas, as velhas ficam onde estão — perder os dois lados
        #      é o único desfecho que não tem volta.
        conf = self.load_settings().get('settings', {}) or {}
        if not isinstance(conf.get('assistentes_externos'), list) \
                or not isinstance(conf.get('inicios_rapidos'), list):
            return {'success': False,
                    'error': 'as chaves novas não voltaram do disco; nada foi apagado'}

        # 6 ── Os projetos.
        self._mig_projetos(assistentes, inicios, padrao_assist, padrao_inicio, rel)

        # 7 ── Só agora as velhas somem, pelo único caminho que remove.
        rel['chaves_apagadas'] = self._mig_apagar_velhas()

        rel['assistentes'] = nomes_assist
        rel['inicios_rapidos'] = nomes_inicio
        return rel

    # ── Os pedaços ────────────────────────────────────────────────────────
    def _mig_criar_instrucoes_base(self, preparar, rel):
        """`conteudo_regras` de cada preset vira um item da biblioteca (D12).

        ⚠️ Um item por assistente, com o nome de pasta vindo de
        `_slug_universal` — `Codex / Antigravity` tem `/`, que é SEPARADOR DE
        GRUPO em todas as camadas e proibido em nome de item.

        ⛔ Um `.md` SOLTO por assistente, com o nome do item (`claude-code.md`),
        e nada em volta: desde 2026-09-21 a categoria é de item-arquivo
        (`_ARQUIVOS_ITEM_DE_ARQUIVO`), e uma pasta aqui viraria gaveta — o
        item sumiria da lista. O nome que o arquivo ganha na raiz do projeto
        (CLAUDE.md / AGENTS.md) vem do preset na hora da cópia, não daqui.

        ⛔ NÃO DEDUPLICAR. Os textos parecem iguais e não são: o do Codex não
        tem a seção do MCP, de propósito, e cada um aponta para um caminho de
        skills diferente.
        """
        base = os.path.join(ARQUIVOS_DIR, self._MIG_PASTA_INSTRUCOES)
        out = {}
        for p in preparar:
            nome = (p.get('nome') or '').strip()
            texto = p.get('conteudo_regras') or ''
            if not nome or not texto.strip():
                continue
            slug = self._slug_universal(nome)
            if not slug:
                rel['avisos'].append('"%s" não vira nome de pasta; instrução base não migrada.'
                                     % nome)
                continue
            alvo = os.path.join(base, f'{slug}.md')
            try:
                os.makedirs(base, exist_ok=True)
                # Nunca sobrescreve: se o item já existe, ele é do usuário.
                if not os.path.isfile(alvo):
                    with open(alvo, 'w', encoding='utf-8') as f:
                        f.write(texto)
                    rel['itens_criados'].append('%s.md' % slug)
            except Exception as e:
                rel['avisos'].append('não deu para criar a instrução base de "%s": %s'
                                     % (nome, e))
                continue
            out[nome] = slug
        return out

    def _mig_montar_assistentes(self, arquivos, preparar, produtos, rel):
        """As três listas viram uma, casadas pelo `nome`.

        ⚠️ D14: ONDE OS DESTINOS DIVERGIREM, `presets_arquivos` VENCE. No disco
        conferido os nove pares batiam exatamente — a guarda fica escrita para
        o dia em que não baterem, e avisa em vez de escolher em silêncio.
        """
        por_nome_arq = {(p.get('nome') or '').strip(): p for p in arquivos}
        por_nome_prep = {(p.get('nome') or '').strip(): p for p in preparar}
        por_nome_prod = {(p.get('nome') or '').strip(): p for p in produtos}
        fabrica = {a['nome']: a for a in ASSISTENTES_EXTERNOS}

        # A ordem é a de `presets_arquivos` (quem mandava na lista), e o que só
        # existia nas outras duas entra no fim, sem se perder.
        ordem = [n for n in por_nome_arq if n]
        for n in list(por_nome_prep) + list(por_nome_prod):
            if n and n not in ordem:
                ordem.append(n)

        saida = []
        for nome in ordem:
            arq = por_nome_arq.get(nome) or {}
            prep = por_nome_prep.get(nome) or {}
            prod = por_nome_prod.get(nome) or {}
            fab = fabrica.get(nome) or {}

            categorias = {}
            for kind, rotulo, _so_destino, _raiz in CATEGORIAS_DO_ASSISTENTE:
                cat = dict(((arq.get('categorias') or {}).get(kind))
                           or ((fab.get('categorias') or {}).get(kind))
                           or {'destino': '', 'arquivo_de_entrada': '', 'formato': 'pasta'})
                # O destino que o Preparar guardava para a mesma categoria.
                velho = {'skills': 'destino_skills',
                         'comandos': 'destino_comandos',
                         'mcps': 'destino_mcp'}.get(kind)
                if velho and velho in prep:
                    do_preparar = (prep.get(velho) or '').strip()
                    do_arquivos = (cat.get('destino') or '').strip()
                    if do_preparar != do_arquivos and nome in por_nome_arq:
                        rel['avisos'].append(
                            '"%s" › %s: o Preparar dizia "%s" e a aba Arquivos dizia "%s". '
                            'Ficou o da aba Arquivos (D14).'
                            % (nome, rotulo, do_preparar, do_arquivos))
                    elif nome not in por_nome_arq:
                        cat['destino'] = do_preparar
                categorias[kind] = cat

            # `arquivo_regras` vira o `arquivo_de_entrada` de Instruções base.
            ar = (prep.get('arquivo_regras') or '').strip()
            if ar:
                categorias['instrucoes-base'] = dict(categorias.get('instrucoes-base') or {})
                categorias['instrucoes-base']['arquivo_de_entrada'] = ar

            base_lanc = prod or fab
            saida.append({
                'nome': nome,
                'comando': (base_lanc.get('comando') or '').strip(),
                'argumentos': list(base_lanc.get('argumentos') or []),
                'flag_nome': (base_lanc.get('flag_nome') or '').strip(),
                'flag_prompt': (base_lanc.get('flag_prompt') or '').strip()
                               or '--append-system-prompt',
                'comando_cota': (base_lanc.get('comando_cota') or '').strip(),
                'categorias': categorias,
            })

        # ⚠️ O OpenCode (e qualquer outro de fábrica) que o espelhamento antigo
        # apagou volta aqui — sem sobrescrever nada que o usuário tenha.
        for a in ASSISTENTES_EXTERNOS:
            if a['nome'] not in ordem:
                saida.append({k: (dict(v) if isinstance(v, dict) else
                                  list(v) if isinstance(v, list) else v)
                              for k, v in a.items()})
                rel['avisos'].append('"%s" foi recuperado da fábrica.' % a['nome'])
        return saida

    def _mig_montar_inicios(self, preparar, assistentes, itens_por_assistente, rel):
        """`presets_preparar` vira `inicios_rapidos`, com `assistente` (D6)."""
        nomes_assist = [a['nome'] for a in assistentes]
        saida = []
        for p in preparar:
            nome = (p.get('nome') or '').strip()
            if not nome:
                continue
            # O início rápido e o assistente eram listas paralelas, casadas pelo
            # nome. Nome que não casa cai no padrão — não levanta.
            assistente = nome if nome in nomes_assist else (
                ASSISTENTE_EXTERNO_PADRAO if ASSISTENTE_EXTERNO_PADRAO in nomes_assist
                else (nomes_assist[0] if nomes_assist else ''))

            # `itens` explícito, com as SEIS chaves. Deixar a chave ausente faria
            # `_inicio_rapido_normalizar` semear de novo no próximo boot — e a
            # semente não conhece `instrucoes-base`, que ficaria vazia: o
            # Preparar pararia de escrever o CLAUDE.md, sem erro nenhum.
            bruto = p.get('itens') if isinstance(p.get('itens'), dict) else None
            itens = {}
            for kind, _rotulo, escolha_unica in CATEGORIAS_DO_INICIO_RAPIDO:
                if bruto is not None:
                    lista = [n for n in (bruto.get(kind) or []) if isinstance(n, str)]
                elif kind in getattr(self, '_ARQUIVOS_COM_ORIGEM', ()):
                    # É o que `_inicio_rapido_normalizar` faria, e é exatamente
                    # o que este preset copiava antes.
                    lista = self._itens_do_programa(kind)
                else:
                    lista = []
                if escolha_unica:
                    lista = lista[:1]
                itens[kind] = lista

            # A instrução base recém-criada já nasce marcada (passo 6).
            slug = itens_por_assistente.get(nome)
            if slug and not itens.get('instrucoes-base'):
                itens['instrucoes-base'] = [slug]

            saida.append({
                'nome': nome,
                'assistente': assistente,
                'itens': itens,
                'pastas_raiz': list(p.get('pastas_raiz') or []),
                'pasta_trabalho': (p.get('pasta_trabalho') or '').strip(),
                'pastas_trabalho': list(p.get('pastas_trabalho') or []),
            })
        return saida

    def _mig_projetos(self, assistentes, inicios, padrao_assist, padrao_inicio, rel):
        """`preset_arquivos` → `assistente_externo`, `preset_preparar` → `inicio_rapido`.

        ⚠️ LOOKUP TOLERANTE, e não é hipótese: um projeto do disco tem
        `preset_preparar: "Claude Code - Desktop"`, que não existe em lista
        nenhuma, e outro NÃO TEM a chave `preset_arquivos`. Nenhum dos dois pode
        levantar — os dois caem no padrão, que é o que `load_preparar_config` já
        fazia com o órfão.

        Herança: `assistente_externo = preset_arquivos or preset_preparar`,
        nessa ordem, porque é `preset_preparar` que carrega o órfão.
        """
        nomes_assist = [a['nome'] for a in assistentes]
        nomes_inicio = [i['nome'] for i in inicios]
        try:
            # ⚠️ Devolve uma LISTA DE STRINGS, não um dicionário com 'projects'.
            projetos = self.list_projects() or []
        except Exception as e:
            rel['avisos'].append('não deu para listar os projetos: %s' % e)
            return
        for proj in projetos:
            nome_proj = proj if isinstance(proj, str) else (
                proj.get('name') or proj.get('nome') or '')
            if not nome_proj:
                continue
            try:
                config = self.load_workspace(nome_proj).get('config', {}) or {}
            except Exception as e:
                rel['avisos'].append('%s: workspace ilegível (%s)' % (nome_proj, e))
                continue
            if 'assistente_externo' in config and 'inicio_rapido' in config:
                continue
            velho_arq = (config.get('preset_arquivos') or '').strip()
            velho_prep = (config.get('preset_preparar') or '').strip()

            assistente = velho_arq or velho_prep
            if assistente not in nomes_assist:
                if assistente:
                    rel['avisos'].append('%s: assistente "%s" não existe; caiu no padrão.'
                                         % (nome_proj, assistente))
                assistente = padrao_assist if padrao_assist in nomes_assist else (
                    nomes_assist[0] if nomes_assist else '')

            inicio = velho_prep
            if inicio not in nomes_inicio:
                if inicio:
                    rel['avisos'].append('%s: início rápido "%s" não existe; caiu no padrão.'
                                         % (nome_proj, inicio))
                inicio = padrao_inicio if padrao_inicio in nomes_inicio else (
                    nomes_inicio[0] if nomes_inicio else '')

            config['assistente_externo'] = assistente
            config['inicio_rapido'] = inicio
            config.pop('preset_arquivos', None)
            config.pop('preset_preparar', None)
            try:
                self.save_workspace(nome_proj, config)
                rel['projetos'].append({'projeto': nome_proj,
                                        'assistente_externo': assistente,
                                        'inicio_rapido': inicio})
            except Exception as e:
                rel['avisos'].append('%s: não deu para gravar o workspace (%s)'
                                     % (nome_proj, e))

    def _mig_apagar_velhas(self):
        """O ÚNICO caminho que remove chave do `settings.json`.

        `save_settings_parcial` só faz `update`, e `load_settings` faz merge
        raso: chave que só existe no disco sobrevive à leitura e volta a ser
        gravada. Sem este passo o `settings.json` ficaria com AS DUAS GERAÇÕES —
        a nova e as três velhas —, e o dia em que alguém lesse a velha por
        engano o usuário perderia a configuração da tela sem um erro sequer.
        """
        atual = self.load_settings().get('settings', {}) or {}
        apagadas = [k for k in self._MIG_CHAVES_VELHAS if k in atual]
        for k in apagadas:
            atual.pop(k, None)
        if apagadas:
            self.save_settings(atual)
        return apagadas


def _lista(v):
    return [p for p in v if isinstance(p, dict)] if isinstance(v, list) else []
