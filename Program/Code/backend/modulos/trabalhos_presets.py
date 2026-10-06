"""A área "Agentes" — produto, presets de agente e lançamento rápido.

GLOBAL, e não por projeto: é o que o usuário pediu explicitamente, e é o mesmo
princípio dos presets de Preparar Projeto, que já moram no `settings.json` do
programa. Configurar o mesmo agente de novo em cada projeto seria o oposto do
que a área existe para resolver.

Três listas, três chaves novas no mesmo `settings.json`:

    presets_produto_assistente   qual programa roda    {nome, comando, argumentos}
    combinacoes_lancamento_rapido  quantos abrir de uma vez

⚠️ `presets_agentes` FICOU ÓRFÃ NO DISCO, e é para ficar. Ela guardava os
"modos de terminal" — nome, papel e um prompt fixo, colados na linha de comando
com `--append-system-prompt`. A biblioteca de agentes (`Arquivos/Agentes/`) os
substituiu por arquivos `.md` que o próprio assistente externo lê, e nesse
caminho o campo `tools:` LIMITA de verdade, coisa que o prompt colado nunca fez.
Migrar não era honesto: um modo é papel + prompt, um agente é um `.md` com uma
`description` que o produto usa para se acionar sozinho — e inventar essa
descrição é o que `arquivos.py` proíbe em outro lugar. A chave fica no
`settings.json` de quem já a tem, e ninguém mais a lê.

⚠️ **NENHUM PRESET GANHA "ABRIR TERMINAL", e não há campo que conceda isso.**
Não é uma checagem que se possa esquecer de fazer: a capacidade não existe em
lugar nenhum do modelo de dados. Quantos terminais existem é sempre o usuário
que decide, na tela — inclusive quando ele usa um lançamento rápido, que abre
vários de uma vez porque ele clicou, não porque um agente pediu.

⚠️ **O TIPO é do programa, e não se edita.** São dois (Orquestrador e
Subagente), vêm de `catalogo_trabalhos.py`, e é o tipo que decide quais
ferramentas do Quadro o preset recebe: as oito para o Orquestrador, NENHUMA
direta para o Subagente. O usuário edita o nome e o prompt; a base é do
programa, e um preset "Subagente com as oito ferramentas" não é configuração
possível.

⚠️ O NOME DO PRODUTO É DADO DO USUÁRIO, não rótulo de tela. É a mesma situação
dos presets de Preparar Projeto, que já trazem "Claude Code", "Cursor" e
"Codex / Antigravity" de fábrica: o texto aparece porque é o nome de um item de
uma lista que o usuário gerencia, e não porque a interface do programa fala de
um produto específico. Nenhum rótulo escrito no código cita produto nenhum.
"""

from .catalogo_trabalhos import IDS_DOS_PAPEIS, PAPEIS_DE_TERMINAL
# A lista unica de assistentes externos: a fabrica de lancamento deste modulo
# passou a ser um apelido dela em 2026-09-02.
from .padroes_de_fabrica import ASSISTENTES_EXTERNOS

# ⚠️ `presets_produto_assistente` e `preset_produto_padrao` SUMIRAM em
# 2026-09-02. Eram a terceira metade do assistente externo — "como ele é
# lançado" — e agora moram na lista única, junto do "para onde vai" e do "como
# chega". Os três acessadores abaixo continuam existindo e continuam sendo a
# única porta: quem lê lançamento (a Oficina, a execução de agente, a barra de
# cota) não precisou mudar uma linha.
CHAVE_ASSISTENTES = 'assistentes_externos'
CHAVE_ASSISTENTE_ATIVO = 'assistente_externo_padrao'
CHAVE_AGENTES    = 'presets_agentes'
CHAVE_COMBINACOES = 'combinacoes_lancamento_rapido'


def presets_de_produto_de_fabrica():
    """A fábrica de lançamento — hoje só um apelido de `ASSISTENTES_EXTERNOS`.

    ⚠️ Esta lista era PRÓPRIA, com dois produtos escritos aqui, e foi ela que
    perdeu o OpenCode: `salvar_assistentes_externos` espelhava os nomes de
    `presets_arquivos` por cima dela, e o que não tinha preset de mesmo nome
    simplesmente sumia do disco. Agora a fábrica é uma só.

    ⚠️ SEM `-p` em nenhum comando. O assistente é digitado DENTRO de um terminal
    vivo, e `-p` é o modo de uma tacada só, que responde e encerra — no terminal
    ele fecharia a sessão logo depois da primeira resposta.
    """
    return [dict(a) for a in ASSISTENTES_EXTERNOS]


def combinacoes_de_fabrica():
    """Só PAPÉIS, e quantos de cada — nunca posição, cor ou ligação.

    É o que separa esta lista dos Fluxos salvos da Oficina (Fase 5), que
    guardam o arranjo inteiro. As duas convivem: esta é rápida e burra, aquela
    é rica. Confundi-las faria uma das duas não ter razão de existir.
    """
    return [
        {'nome': '1 Orquestrador + 3 Subagentes',
         'papeis': ['orquestrador', 'subagente', 'subagente', 'subagente']},
        {'nome': '1 Orquestrador + 1 Subagente',
         'papeis': ['orquestrador', 'subagente']},
    ]


class TrabalhosPresetsMixin:

    # ── Leitura ──────────────────────────────────────────────────────────────

    def _trab_settings(self):
        try:
            return self.load_settings().get('settings', {}) or {}
        except Exception:
            return {}

    # ⚠️ LISTA VAZIA É ESCOLHA, E NÃO "AINDA NÃO CONFIGURADO". A versão anterior
    # caía na lista de fábrica sempre que a salva estivesse VAZIA — e o defeito
    # que isso produzia era assombroso de depurar: o usuário apagava o penúltimo
    # item, sobrava um, apagava o último, e os DOIS de fábrica voltavam. Parecia
    # que o botão de excluir estava restaurando em vez de excluir.
    #
    # A distinção certa é entre a chave AUSENTE (instalação nova: mostra a
    # fábrica) e a chave presente com lista vazia (o usuário apagou tudo, e
    # apagado é para ficar apagado). O "Restaurar padrão" continua sendo o
    # caminho de volta.
    def _trab_produtos(self):
        # ⚠️ Uma lista só desde 2026-09-02: é a MESMA que Configurações ›
        # Assistentes externos edita e a mesma que diz para onde os arquivos
        # vão. `_lista_de_assistentes` já passa cada um por
        # `_assistente_completo`, então categoria nova nunca chega em branco.
        # ⛔ SEM QUEDA PARA A FÁBRICA QUANDO A LISTA ESTÁ VAZIA. A chave
        # `assistentes_externos` agora está em `_SETTINGS_DEFAULTS`, então
        # `load_settings` SEMPRE a devolve: instalação nova já recebe a fábrica
        # por ali. Cair na fábrica aqui também faria a lista vazia — que é
        # escolha do usuário — ressuscitar os cinco de fábrica, que é
        # exatamente o defeito descrito acima.
        return self._lista_de_assistentes()

    def _trab_assistente(self, nome):
        """O cadastro de lançamento de um assistente externo, PELO NOME.

        ⚠️ A FÁBRICA FICA ATRÁS DO DISCO: um assistente que o usuário nunca
        editou resolve para o cadastro de fábrica de mesmo nome — com
        `comando: claude` — em vez de não resolver para nada e o terminal abrir
        limpo dizendo que o produto não existe.

        ⚠️ DEVOLVER `None` É PARTE DO CONTRATO, e não descuido: o `produto` de
        cada nó do `Layout.json` da Oficina é um NOME gravado no disco, e um
        assistente renomeado ou excluído deixa nós órfãos. Quem trata isso é
        `trabalhos_shell.py`, que conta com o `None` para abrir o terminal
        limpo em vez de abrir com o assistente errado.
        """
        if not nome:
            return None
        for p in self._trab_produtos():
            if p.get('nome') == nome:
                return p
        for p in presets_de_produto_de_fabrica():
            if p['nome'] == nome:
                return p
        return None

    def _trab_produto_ativo(self):
        """O assistente escolhido, ou o primeiro que sabe lançar alguma coisa.

        Cair em outro em vez de falhar é deliberado: uma instalação nova não tem
        escolhido nenhum, e obrigar o usuário a abrir a tela antes do primeiro
        terminal seria atrito à toa.

        ⚠️ O DESEMPATE PREFERE QUEM TEM COMANDO. Antes era "o primeiro da
        lista", e bastava um cartão em branco no topo — o botão "＋ Novo" cria
        um — para toda execução de agente e toda barra de cota apontarem para um
        cadastro que não lança nada. Um rascunho é legítimo de guardar e péssimo
        de escolher sozinho.
        """
        escolhido = self._trab_assistente(self._trab_settings().get(CHAVE_ASSISTENTE_ATIVO))
        if escolhido:
            return escolhido
        produtos = self._trab_produtos()
        com_comando = [p for p in produtos if (p.get('comando') or '').strip()]
        if com_comando:
            return com_comando[0]
        for p in presets_de_produto_de_fabrica():
            if (p.get('comando') or '').strip():
                return p
        return produtos[0] if produtos else None

    def _trab_combinacoes(self):
        salvos = self._trab_settings().get(CHAVE_COMBINACOES)
        return salvos if isinstance(salvos, list) and salvos else combinacoes_de_fabrica()

    def _trab_semear_produtos(self):
        """Grava a lista de fábrica no disco na primeira vez que a tela abre.

        ⚠️ AUSÊNCIA DA CHAVE NÃO É LISTA VAZIA, e essa diferença era invisível
        para o usuário. `_trab_produtos` devolve a fábrica enquanto
        `CHAVE_PRODUTOS` não existe no `settings.json` — o que está certo para
        uma instalação nova, e virava assombração quando a chave DESAPARECIA
        depois de gravada. Era o que acontecia: duas telas regravavam o
        `settings.json` inteiro a partir da foto do boot, e a chave sumia (ver
        o ⚠️ de `save_settings`, em `configuracoes.py`). O sintoma era "apago o
        produto, salvo, e ele volta".

        Aquele buraco foi tapado na origem. Este semeador é a segunda tranca:
        depois da primeira abertura da tela a chave EXISTE no disco, então
        mesmo que alguém reabra o buraco, "lista vazia" passa a ser uma
        resposta que o programa sabe dar.

        ⚠️ SEMEIA NA TELA, NUNCA EM `_trab_produtos`. Aquele é chamado por
        `_sh_comando_do_modo` na abertura de cada terminal, e gravar
        configuração no meio disso seria escrever em disco na pior hora
        possível — com o usuário esperando o prompt aparecer.
        """
        try:
            # ⚠️ APOSENTADO em 2026-09-02, e de propósito não apagado: a chave
            # `assistentes_externos` entrou em `_SETTINGS_DEFAULTS`, então ela
            # nunca mais está ausente da leitura — a distinção que este
            # semeador existia para criar já vem de graça. Semear aqui gravaria
            # a fábrica por cima da escolha de quem apagou tudo.
            return
        except Exception:
            # Semear é conveniência, não requisito: a tela abre igual sem isso,
            # com a lista de fábrica em memória. Derrubar `carregar_agentes` por
            # causa da semeadura deixaria a área inteira em branco.
            pass

    def carregar_agentes(self, project_name=None):
        """Tudo que a área Agentes desenha, numa chamada.

        `project_name` é aceito e ignorado de propósito: a área é GLOBAL, e a
        assinatura o recebe só para a tela poder chamá-la do mesmo jeito que
        chama as outras. Usá-lo para filtrar seria o primeiro passo para ela
        virar por projeto sem ninguém decidir isso.
        """
        try:
            self._trab_semear_produtos()
            return {
                'success': True,
                'produtos': self._trab_produtos(),
                'produto_ativo': (self._trab_produto_ativo() or {}).get('nome'),
                'combinacoes': self._trab_combinacoes(),
                'papeis': PAPEIS_DE_TERMINAL,
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Gravação ─────────────────────────────────────────────────────────────

    def _trab_validar_produto(self, p):
        nome = (p.get('nome') or '').strip()
        comando = (p.get('comando') or '').strip()
        if not nome:
            raise ValueError('Todo produto precisa de um nome.')
        # ⚠️ COMANDO VAZIO É RASCUNHO, E NÃO ERRO. Esta linha recusava, e o
        # sintoma era o botão "＋ Novo produto" dar erro em cima do próprio
        # clique: a tela cria o cartão vazio para o usuário preencher, e a
        # gravação o rejeitava antes de ele digitar qualquer coisa.
        #
        # Recusar aqui também não protegia nada: quem USA o produto já trata a
        # falta — `_sh_comando_do_modo` devolve o motivo e abre o terminal
        # limpo. É a mesma regra que já deixou apagar todos os produtos: o
        # estado incompleto é do usuário, e a tela o marca como incompleto em
        # vez de impedi-lo.
        args = p.get('argumentos') or []
        if not isinstance(args, list):
            raise ValueError(f'Os argumentos de "{nome}" precisam ser uma lista.')
        return {'nome': nome, 'comando': comando,
                'argumentos': [str(a) for a in args if str(a).strip()],
                'flag_prompt': (p.get('flag_prompt') or '').strip() or '--append-system-prompt',
                # Vazio é legítimo: produto que não sabe nomear a sessão
                # simplesmente não recebe a flag, em vez de receber uma inventada.
                'flag_nome': (p.get('flag_nome') or '').strip(),
                # Idem para as duas do papel — e aqui o vazio não tem padrão de
                # fábrica de propósito: chutar `--agent` num produto que não o
                # tem faria o terminal recusar a linha inteira.
                'flag_prompt_arquivo': (p.get('flag_prompt_arquivo') or '').strip(),
                'flag_agente': (p.get('flag_agente') or '').strip(),
                # Opcional, vazio de fábrica: o comando que o CLI do produto
                # oferece para dizer quanto da cota já foi. Sem ele, as barras de
                # cota das Métricas ficam vazias COM o motivo escrito — que é o
                # certo, porque esse número o programa não tem como inventar.
                'comando_cota': (p.get('comando_cota') or '').strip()}

    def _trab_validar_combinacao(self, c):
        nome = (c.get('nome') or '').strip()
        papeis = c.get('papeis') or []
        if not nome:
            raise ValueError('Toda combinação precisa de um nome.')
        if not isinstance(papeis, list) or not papeis:
            raise ValueError(f'A combinação "{nome}" precisa de pelo menos um papel.')
        for p in papeis:
            if p not in IDS_DOS_PAPEIS:
                raise ValueError(f'Papel desconhecido em "{nome}": {p}')
        return {'nome': nome, 'papeis': list(papeis)}

    def salvar_agentes(self, dados):
        """Grava as três listas de uma vez, no `settings.json` global."""
        try:
            patch = {}
            if 'produtos' in dados:
                # ⚠️ MESCLA, não substitui. `_trab_validar_produto` devolve só
                # os campos de LANÇAMENTO — gravar o retorno dele cru apagaria
                # o `categorias` de cada assistente, e com ele todos os
                # destinos. O registro é um só desde a fusão: cada metade grava
                # a sua parte por cima do que já está lá.
                atuais = {a.get('nome'): a for a in self._lista_de_assistentes()}
                novos = []
                for p in (dados['produtos'] or []):
                    lancamento = self._trab_validar_produto(p)
                    base = dict(atuais.get(lancamento['nome']) or {})
                    if 'categorias' in p:
                        base['categorias'] = p['categorias']
                    base.update(lancamento)
                    base.setdefault('categorias', {})
                    novos.append(base)
                patch[CHAVE_ASSISTENTES] = novos
            if 'produto_ativo' in dados:
                patch[CHAVE_ASSISTENTE_ATIVO] = (dados['produto_ativo'] or '').strip()
            if 'combinacoes' in dados:
                patch[CHAVE_COMBINACOES] = [self._trab_validar_combinacao(c)
                                            for c in (dados['combinacoes'] or [])]
            if not patch:
                return {'success': True}
            # Parcial, nunca `save_settings`: gravar o dicionário inteiro daqui
            # reverteria em silêncio o que outra tela mudou desde a leitura.
            r = self.save_settings_parcial(patch)
            if not r.get('success'):
                return r
            return {'success': True, **self.carregar_agentes()}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def restaurar_agentes_de_fabrica(self):
        try:
            # ⚠️ `CHAVE_AGENTES` NÃO ENTRA AQUI, nem para ser zerada: restaurar
            # o padrão de uma área não é hora de mexer em chave que a área já
            # não usa. Ela fica no disco como está.
            return self.save_settings_parcial({
                CHAVE_ASSISTENTES: presets_de_produto_de_fabrica(),
                CHAVE_ASSISTENTE_ATIVO: '',
                CHAVE_COMBINACOES: combinacoes_de_fabrica(),
            })
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── O assistente externo, numa lista só ──────────────────────────────────
    #
    # ⚠️ ERA UM CONCEITO SÓ, PARTIDO EM DUAS CHAVES por história, não por
    # desenho — e desde 2026-09-02 não é mais. `assistentes_externos` guarda as
    # três metades juntas: como é lançado, para onde vai e como chega.
    #
    # Estes dois métodos SOBRARAM COMO PONTE, e de propósito: a Oficina, a
    # execução de agente e a barra de cota chamam por aqui, e mudar a forma
    # deles obrigaria a mexer nos três de uma vez. Hoje não costuram nada — só
    # recortam da lista única o que cada consumidor espera.

    def assistentes_externos(self):
        """Os assistentes externos, com lançamento e destino de agente juntos."""
        try:
            presets = (self.load_assistentes_config() or {}).get('presets') or []
            fabrica = {p['nome']: p for p in presets_de_produto_de_fabrica()}
            itens = []
            for preset in presets:
                nome = preset.get('nome') or ''
                # O lançamento vem do PRÓPRIO registro agora. A fábrica fica
                # atrás só para o assistente que o usuário nunca editou; em
                # branco é rascunho legítimo — quem trata a falta é
                # `_sh_comando_do_modo`, com aviso na tela.
                base = preset if (preset.get('comando') or '').strip() else (
                    fabrica.get(nome) or preset)
                cat = self._categoria_do_assistente(preset, 'agentes')
                itens.append({
                    'nome': nome,
                    'comando': base.get('comando', ''),
                    'argumentos': base.get('argumentos', []),
                    'flag_prompt': base.get('flag_prompt', '--append-system-prompt'),
                    'flag_prompt_arquivo': base.get('flag_prompt_arquivo', ''),
                    'flag_agente': base.get('flag_agente', ''),
                    'flag_nome': base.get('flag_nome', ''),
                    'comando_cota': base.get('comando_cota', ''),
                    'destino': cat.get('destino', ''),
                    'formato': cat.get('formato', 'solto'),
                })
            return {'success': True, 'itens': itens,
                    'ativo': (self._trab_produto_ativo() or {}).get('nome') or ''}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def salvar_assistentes_externos(self, itens, ativo=None):
        """Grava as duas metades. O destino vai para o preset, o resto para cá.

        ⚠️ O DESTINO É GRAVADO NO PRESET DE ARQUIVOS, e não numa cópia local —
        senão a mesma pergunta teria duas respostas, e a de Configurações ›
        Arquivos continuaria valendo na hora de copiar.
        """
        try:
            itens = itens or []
            presets = (self.load_assistentes_config() or {}).get('presets') or []
            por_nome = {i.get('nome'): i for i in itens}
            for preset in presets:
                mudou = por_nome.get(preset.get('nome'))
                if not mudou:
                    continue
                cat = dict(self._categoria_do_assistente(preset, 'agentes'))
                cat['destino'] = (mudou.get('destino') or '').strip()
                cat['formato'] = mudou.get('formato') or 'solto'
                preset.setdefault('categorias', {})['agentes'] = cat
            r = self.save_assistentes(presets)
            if not r.get('success'):
                return r

            dados = {'produtos': [{k: v for k, v in i.items()
                                   if k not in ('destino', 'formato')} for i in itens]}
            if ativo is not None:
                dados['produto_ativo'] = ativo
            r = self.salvar_agentes(dados)
            if not r.get('success'):
                return r
            return self.assistentes_externos()
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Lançamento rápido — SEM ENTRADA NA INTERFACE ─────────────────
    #
    # ⚠ O botão que chamava isto saiu quando a área Agentes foi para
    # Configurações: aquela tela só CONFIGURA, e abrir terminal é ação de uso.
    # Quem abre vários nós de uma vez hoje é o Fluxo salvo da Oficina, que
    # guarda o arranjo inteiro em vez de só os papéis.
    #
    # O código ficou por um motivo só: apagar `combinacoes` reescreveria o
    # `settings.json` do usuário. Não é ponto de extensão — se um dia a
    # combinação voltar, ela volta na OFICINA, não em Configurações.

    def lancar_combinacao(self, project_name, nome_da_combinacao):
        """Abre os nós de uma combinação de uma vez.

        ⚠️ ABRE OS NÓS, NÃO OS PROCESSOS. Cada terminal só começa a trabalhar
        quando o usuário lhe manda a primeira mensagem. Um botão que disparasse
        quatro processos de uma vez seria o programa decidindo gastar cota — e
        a decisão de quando trabalhar é dele, não nossa.

        ⚠️ E é o USUÁRIO quem clica. Isto não é alcançável pelo servidor MCP:
        nenhum agente chega aqui, nem indiretamente.
        """
        try:
            combinacao = next((c for c in self._trab_combinacoes()
                               if c['nome'] == nome_da_combinacao), None)
            if combinacao is None:
                return {'success': False,
                        'error': f'Combinação não encontrada: {nome_da_combinacao}'}
            criados = []
            for papel in combinacao['papeis']:
                r = self.criar_no(project_name, 'terminal', papel=papel)
                if not r.get('success'):
                    return r
                criados.append(r['no'])
            return {'success': True, 'nos': criados}
        except Exception as e:
            return {'success': False, 'error': str(e)}
