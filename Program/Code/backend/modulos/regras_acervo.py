"""Os presets do Acervo, e as pastas genéricas que eles apontam.

⚠️ AS FONTES DO ACERVO NÃO SÃO TRÊS PASTAS FIXAS. Elas vêm do PRESET escolhido
para o projeto, e um projeto pode ter outras — foi o que substituiu a lista
cravada no código. Mesmo desenho de `arquivos_inicio_rapido.py`: uma lista de
presets em `settings.json`, um padrão global e uma escolha por projeto.

⚠️ `Saída das skills/Regras e instruções` É A ÚNICA PASTA COM GRAMÁTICA PRÓPRIA.
Todas as outras do preset são árvore de arquivo livre; ela é uma lista
estruturada de itens com tipo. `_e_pasta_de_regras_e_instrucoes` (na casca) é
quem decide, e é ele que as duas telas perguntam.

⚠️ ARQUIVO LIVRE SÓ SE GRAVA DENTRO DA PASTA EDITÁVEL DO PRESET, e o caminho é
conferido contra a raiz — `caminho_pasta` chega da tela, e a ponte pywebview
expõe estes métodos ao JavaScript.
"""

from .constantes import *


# ⚠️ ESTES QUATRO NOMES MORAM AQUI, E NÃO NA CASCA `regras.py`. Eles estavam lá,
# e como um mixin não herda o namespace do arquivo que o compõe, TODA chamada
# do Acervo que tocasse num caminho levantava `NameError` — silenciosamente, que
# é o pior de tudo: a ponte do pywebview vira promessa rejeitada, e a tela mostra
# um Salvar sem notificação e um Acervo sem pastas. `regras.py` os reexporta,
# para `from .regras import PASTA_BASE_REGRAS` (em `arquivos_preparar.py`)
# continuar valendo.
PASTA_BASE_REGRAS = os.path.join('Saída das skills', 'Regras e instruções')

EXTENSOES_DECISOES = ('.md', '.html', '.txt', '.json')


def _normalizar_caminho_pasta(caminho):
    """Barra normal, sem barra no fim — a forma canônica para comparar o
    `caminho` de uma pasta de um preset do Acervo com outro caminho
    (`PASTA_BASE_REGRAS`, ou o de outra pasta do mesmo preset)."""
    return (caminho or '').strip().replace('\\', '/').strip('/')


def _e_pasta_de_regras_e_instrucoes(caminho):
    """"Regras e instruções" é identificada pelo CAMINHO registrado, nunca
    pelo título — o usuário pode renomear o título de exibição da sub-aba,
    mas não o lugar onde `save_regra`/`list_regras`/etc. de fato leem e
    escrevem. Só essa pasta usa o editor estruturado; qualquer outra editável
    usa o editor de arquivo livre."""
    return _normalizar_caminho_pasta(caminho) == _normalizar_caminho_pasta(PASTA_BASE_REGRAS)


class RegrasAcervoMixin:

    # ── Presets do Acervo (Configurações → Acervo) ─────────────────────
    # Mesmo desenho de `arquivos.py::_inicios_rapidos`/`_inicio_rapido`: os
    # presets são GLOBAIS (settings.json, um por nome), e cada projeto guarda
    # só QUAL NOME está ativo (`acervo_preset_ativo`, no Workspace.json) — e
    # não uma cópia da lista de pastas, que dessincronizaria assim que o
    # preset fosse editado em Configurações.
    #
    # ⚠️ Ao contrário do início rápido, um projeto NASCE SEM preset — não há
    # `acervo_preset_padrao` nem fallback para "o primeiro da lista". Decisão
    # explícita: a aba Acervo aparece vazia até o usuário escolher, em vez de
    # herdar um preset que ele não pediu.

    def _acervo_presets(self, incluir_extensoes=False):
        """Os presets do Acervo, tal como `settings.json` os guarda.

        ⚠️ `incluir_extensoes` ficou SEM EFEITO em 23/09/2026: preset de Acervo
        vindo de extensão saiu (P9, D37 — o programa já configura presets, e a
        extensão serve para acrescentar o que ele não tem). O parâmetro fica
        porque Configurações → Acervo ainda o passa (`load_acervo_config(null,
        false)`); tirá-lo quebraria a chamada.
        """
        presets = self.load_settings()['settings'].get('acervo_presets')
        if not isinstance(presets, list):
            presets = ACERVO_PRESETS
        return [p for p in presets
                if isinstance(p, dict) and (p.get('nome') or '').strip()]

    def _acervo_preset(self, nome):
        """O preset daquele nome, ou None — nunca cai num "padrão" (ver acima)."""
        if not nome:
            return None
        for p in self._acervo_presets(incluir_extensoes=True):
            if p.get('nome') == nome:
                return p
        return None

    def _acervo_pastas(self, project_name):
        """A lista `[{titulo, caminho, editavel}]` do preset ATIVO deste projeto.

        `[]` quando o projeto não escolheu preset nenhum, ou quando o preset
        escolhido foi apagado de Configurações → Acervo depois — os dois casos
        se comportam como "Acervo vazio, escolha um preset".
        """
        cfg = self.load_workspace(project_name).get('config') or {}
        preset = self._acervo_preset(cfg.get('acervo_preset_ativo'))
        pastas = (preset or {}).get('pastas')
        return pastas if isinstance(pastas, list) else []

    def load_acervo_config(self, project_name=None, incluir_extensoes=True):
        """Os presets do Acervo e qual está ativo neste projeto — para a tela.

        `incluir_extensoes` não tem mais efeito (ver `_acervo_presets`).
        """
        presets = self._acervo_presets(incluir_extensoes=incluir_extensoes)
        escolhido = None
        if project_name:
            cfg = self.load_workspace(project_name).get('config') or {}
            nome = cfg.get('acervo_preset_ativo')
            if nome and any(p.get('nome') == nome for p in presets):
                escolhido = nome
        return {'success': True, 'presets': presets, 'escolhido': escolhido}

    def save_acervo_presets(self, presets):
        """Grava a lista inteira de presets do Acervo (Configurações → Acervo).

        Mesmo contrato de `arquivos.py::save_inicios_rapidos`: preset com
        caminho vazio é descartado na normalização, mas a gravação em si não
        recusa um preset "incompleto" — quem barra é a hora de usar.
        """
        if not isinstance(presets, list):
            return {'success': False, 'error': 'Formato inválido.'}
        limpos = []
        for p in presets:
            if not isinstance(p, dict):
                continue
            nome = (p.get('nome') or '').strip()
            if not nome:
                continue
            pastas = []
            for it in (p.get('pastas') or []):
                if not isinstance(it, dict):
                    continue
                caminho = _normalizar_caminho_pasta(it.get('caminho'))
                if not caminho:
                    continue
                pastas.append({
                    'titulo': (it.get('titulo') or caminho.rsplit('/', 1)[-1]).strip(),
                    'caminho': caminho,
                    'editavel': bool(it.get('editavel')),
                })
            limpos.append({'nome': nome, 'pastas': pastas})
        nomes = [p['nome'] for p in limpos]
        if len(set(nomes)) != len(nomes):
            return {'success': False, 'error': 'Há dois presets do Acervo com o mesmo nome.'}
        return self.save_settings_parcial({'acervo_presets': limpos})

    def set_acervo_preset_do_projeto(self, project_name, nome):
        """Grava no Workspace.json qual preset do Acervo este projeto usa.

        `nome=None` (ou vazio) desativa — o projeto volta a não ter preset
        nenhum escolhido, e a aba Acervo volta a aparecer vazia.
        """
        ws = self.load_workspace(project_name)
        config = ws.get('config', {})
        config['acervo_preset_ativo'] = (nome or None)
        return self.save_workspace(project_name, config)

    def listar_arvore_decisoes(self, project_name, caminho_pasta):
        """Os arquivos de uma pasta do preset ativo do Acervo, em modo leitura.

        `caminho_pasta` é o `caminho` de uma pasta do PRESET escolhido por
        este projeto — não é mais uma chave de um dicionário fixo de 2
        entradas. Devolve também `tem_subpastas`: o sinal que a tela usa para
        decidir se mostra ⊞/⊟/↻ (só faz sentido numa pasta com estrutura).
        """
        pasta = _normalizar_caminho_pasta(caminho_pasta)
        if not pasta:
            return {'success': False, 'error': 'Pasta inválida.', 'arquivos': []}
        try:
            raiz = self._sub_root_folder(project_name)
        except Exception as e:
            return {'success': False, 'error': str(e), 'arquivos': []}
        base = os.path.join(raiz, pasta.replace('/', os.sep))
        if not os.path.isdir(base):
            # Mesmo motivo do `pasta_existe` de `list_regras`: pasta ausente e
            # pasta vazia não podem chegar iguais à tela.
            return {'success': True, 'arquivos': [], 'base': base,
                    'tem_subpastas': False, 'pasta_existe': False}

        # Uma pasta registrada que mora DENTRO desta (ex.: "Regras e
        # instruções" dentro de "Saída das skills") já tem sub-aba própria —
        # listá-la aqui de novo mostraria os mesmos arquivos em dois lugares.
        aninhadas = []
        for outra in self._acervo_pastas(project_name):
            caminho_outra = _normalizar_caminho_pasta(outra.get('caminho'))
            if caminho_outra and caminho_outra != pasta and caminho_outra.startswith(pasta + '/'):
                aninhadas.append(caminho_outra[len(pasta) + 1:])

        arquivos = []
        # ⚠️ PASTA SEM ARQUIVO PRECISA VIAJAR SEPARADA. O componente de árvore
        # monta a hierarquia a partir de caminhos de ARQUIVO, então uma pasta
        # recém-criada (vazia, por definição) não apareceria na tela — e o
        # usuário criaria de novo achando que não funcionou. É o mesmo
        # parâmetro `pastas` que as telas de Resumo já usam.
        pastas_vazias = []
        tem_subpastas = False
        for atual, subpastas, nomes in os.walk(base):
            rel_atual = os.path.relpath(atual, base).replace('\\', '/')
            rel_atual = '' if rel_atual == '.' else rel_atual
            subpastas[:] = sorted(
                s for s in subpastas
                if (f'{rel_atual}/{s}' if rel_atual else s) not in aninhadas
            )
            if subpastas:
                tem_subpastas = True
            if rel_atual:
                pastas_vazias.append(rel_atual)
            for nome in sorted(nomes):
                if nome.lower().endswith(EXTENSOES_DECISOES):
                    rel = os.path.relpath(os.path.join(atual, nome), base).replace('\\', '/')
                    arquivos.append(rel)
        return {'success': True, 'arquivos': arquivos, 'base': base,
                'pastas': pastas_vazias,
                'tem_subpastas': tem_subpastas, 'pasta_existe': True}

    def ler_arquivo_decisoes(self, project_name, caminho_pasta, caminho):
        """Lê um arquivo de uma pasta registrada, com contenção de caminho."""
        pasta = _normalizar_caminho_pasta(caminho_pasta)
        if not pasta:
            return {'success': False, 'error': 'Pasta inválida.'}
        try:
            raiz = self._sub_root_folder(project_name)
            base = os.path.join(raiz, pasta.replace('/', os.sep))
            alvo = self._sub_validar_caminho(base, caminho)
        except Exception as e:
            return {'success': False, 'error': str(e)}
        if not os.path.isfile(alvo):
            return {'success': False, 'error': 'Arquivo não encontrado.'}
        return {'success': True, 'content': self._ler_texto(alvo)}

    def salvar_arquivo_livre_acervo(self, project_name, caminho_pasta, nome_arquivo, conteudo):
        """Cria/sobrescreve um arquivo simples direto numa pasta EDITÁVEL do
        Acervo que não é "Regras e instruções" — sem seções, sem frontmatter,
        sem preset e sem perguntar destino (⛔ do briefing: a criação no
        Acervo é sempre só um arquivo, direto na pasta registrada).
        """
        pasta = _normalizar_caminho_pasta(caminho_pasta)
        if not pasta:
            return {'success': False, 'error': 'Pasta inválida.'}
        nome = (nome_arquivo or '').strip()
        if not nome:
            return {'success': False, 'error': 'nome de arquivo vazio'}
        try:
            raiz = self._sub_root_folder(project_name)
            base = os.path.join(raiz, pasta.replace('/', os.sep))
            os.makedirs(base, exist_ok=True)
            alvo = self._sub_validar_caminho(base, nome)
            # A pasta-mãe do ALVO, e não só a base: desde que a criação passou a
            # ser pelo menu da pasta, `nome` chega como subcaminho
            # ("Componentes/Botões.md"). Só `makedirs(base)` deixava isso
            # estourar em `FileNotFoundError` na hora de abrir o arquivo.
            os.makedirs(os.path.dirname(alvo), exist_ok=True)
        except Exception as e:
            return {'success': False, 'error': str(e)}
        with open(alvo, 'w', encoding='utf-8') as f:
            f.write(conteudo or '')
        return {'success': True}

    def deletar_arquivo_livre_acervo(self, project_name, caminho_pasta, caminho):
        """Remove um arquivo de uma pasta editável do Acervo (não "Regras e
        instruções", que continua removida por `deletar_regra`)."""
        pasta = _normalizar_caminho_pasta(caminho_pasta)
        if not pasta:
            return {'success': False, 'error': 'Pasta inválida.'}
        try:
            raiz = self._sub_root_folder(project_name)
            base = os.path.join(raiz, pasta.replace('/', os.sep))
            alvo = self._sub_validar_caminho(base, caminho)
        except Exception as e:
            return {'success': False, 'error': str(e)}
        if os.path.isfile(alvo):
            os.remove(alvo)
        return {'success': True}

    # ------------------------------------------------------------------

    # ------------------------------------------------------------------
    # Criar, renomear, apagar, vigiar e buscar
    #
    # ⚠️ TUDO AQUI PASSA POR `_sub_validar_caminho`, e não é formalidade: o
    # caminho chega da TELA, e a contenção contra a raiz da pasta registrada é
    # o que impede um "../.." de escrever em qualquer lugar do disco.
    # ------------------------------------------------------------------

    def _acervo_base(self, project_name, caminho_pasta):
        """A pasta registrada no disco, ou uma exceção.

        Existe para as cinco funções abaixo não repetirem as mesmas quatro
        linhas de resolução de caminho — que é justamente onde um deslize
        silencioso sairia caro.
        """
        pasta = _normalizar_caminho_pasta(caminho_pasta)
        if not pasta:
            raise ValueError('Pasta inválida.')
        raiz = self._sub_root_folder(project_name)
        return os.path.join(raiz, pasta.replace('/', os.sep))

    def criar_pasta_acervo(self, project_name, caminho_pasta, caminho_novo):
        """Cria uma pasta vazia dentro de uma pasta registrada do Acervo.

        Não existia até 04/09/2026: dava para criar arquivo, nunca pasta.
        `caminho_novo` é relativo à pasta registrada e pode ter níveis.
        """
        try:
            base = self._acervo_base(project_name, caminho_pasta)
            nome = (caminho_novo or '').strip().strip('/').strip('\\')
            if not nome:
                return {'success': False, 'error': 'Informe um nome de pasta.'}
            alvo = self._sub_validar_caminho(base, nome)
        except Exception as e:
            return {'success': False, 'error': str(e)}
        if os.path.exists(alvo):
            return {'success': False,
                    'error': 'Já existe uma pasta ou arquivo com esse nome.'}
        try:
            os.makedirs(alvo)
        except Exception as e:
            return {'success': False, 'error': str(e)}
        return {'success': True, 'caminho': nome.replace(os.sep, '/')}

    def renomear_no_acervo(self, project_name, caminho_pasta, caminho, novo_nome):
        """Renomeia um arquivo OU uma pasta, no lugar onde ele já está.

        Renomear não existia no Acervo em forma nenhuma: para trocar o nome de
        um arquivo, o usuário criava outro e apagava o antigo. Um único método
        serve aos dois porque `os.rename` não distingue — e distinguir aqui
        seria duplicar a contenção de caminho para nada.

        ⚠️ SÓ O NOME MUDA, NUNCA O LUGAR: o novo nome não pode ter barra.
        Aceitar subcaminho transformaria "renomear" em "mover" sem o usuário ter
        pedido, e sem a tela ter como mostrar para onde a coisa foi.
        """
        novo = (novo_nome or '').strip()
        if not novo:
            return {'success': False, 'error': 'Informe um nome.'}
        if '/' in novo or '\\' in novo:
            return {'success': False,
                    'error': 'O nome não pode ter barra — renomear não move de pasta.'}
        try:
            base = self._acervo_base(project_name, caminho_pasta)
            alvo = self._sub_validar_caminho(base, caminho)
            destino = self._sub_validar_caminho(os.path.dirname(alvo), novo)
        except Exception as e:
            return {'success': False, 'error': str(e)}
        if not os.path.exists(alvo):
            return {'success': False, 'error': 'O item não existe mais.'}
        # ⚠️ Windows compara nome sem caixa: trocar "Botoes.md" por "botoes.md" é
        # renomear legítimo, e `os.path.exists(destino)` diria que já existe.
        # Sem esta ressalva, corrigir a caixa de um nome era impossível.
        if os.path.exists(destino) and os.path.normcase(destino) != os.path.normcase(alvo):
            return {'success': False, 'error': 'Já existe algo com esse nome aqui.'}
        try:
            os.rename(alvo, destino)
        except Exception as e:
            return {'success': False, 'error': str(e)}
        return {'success': True,
                'caminho': os.path.relpath(destino, base).replace('\\', '/')}

    def deletar_pasta_acervo(self, project_name, caminho_pasta, caminho):
        """Apaga uma pasta do Acervo e tudo que houver dentro dela.

        ⚠️ NÃO HÁ LIXEIRA no Acervo — por isso quem chama é obrigado a passar
        por um modal que diga quantos arquivos vão junto (ver
        `contar_na_pasta_acervo`).
        """
        try:
            base = self._acervo_base(project_name, caminho_pasta)
            alvo = self._sub_validar_caminho(base, caminho)
        except Exception as e:
            return {'success': False, 'error': str(e)}
        # A pasta registrada do preset não se apaga por aqui: ela é a própria
        # sub-aba, e some da tela junto — quem a tira é Configurações.
        if os.path.normcase(alvo) == os.path.normcase(base):
            return {'success': False,
                    'error': 'Esta é a pasta registrada do preset — remova-a em Configurações → Acervo.'}
        if not os.path.isdir(alvo):
            return {'success': False, 'error': 'A pasta não existe mais.'}
        try:
            shutil.rmtree(alvo)
        except Exception as e:
            return {'success': False, 'error': str(e)}
        return {'success': True}

    def contar_na_pasta_acervo(self, project_name, caminho_pasta, caminho):
        """Quantos arquivos há dentro de uma pasta.

        É o número que o modal de exclusão mostra: "apagar a pasta" e "apagar a
        pasta com 40 arquivos dentro" são decisões diferentes, e só a segunda é
        honesta com quem está clicando.
        """
        try:
            base = self._acervo_base(project_name, caminho_pasta)
            alvo = self._sub_validar_caminho(base, caminho)
        except Exception as e:
            return {'success': False, 'error': str(e)}
        if not os.path.isdir(alvo):
            return {'success': True, 'arquivos': 0}
        return {'success': True,
                'arquivos': sum(len(nomes) for _, _, nomes in os.walk(alvo))}

    def carimbo_do_acervo(self, project_name, caminho_pasta):
        """Um número que muda quando a pasta muda no disco. Barato de propósito.

        É o que substituiu o botão ↻ "Recarregar do disco": a tela pergunta este
        carimbo de tempos em tempos e só recarrega quando ele muda. Mesmo molde
        de `trabalhos_layout.py::carimbo_das_anotacoes` — **nenhum arquivo é
        aberto**, só `os.walk` com `st_mtime` e contagem.

        ⚠️ O TAMANHO ENTRA NA CONTA junto do mtime. O Windows carimba mtime com
        granularidade grossa, e trocar um caractere por outro dentro do mesmo
        segundo não mexeria no carimbo. O `stat` já foi feito — somar os bytes
        não custa nada e fecha essa fresta.
        """
        try:
            base = self._acervo_base(project_name, caminho_pasta)
        except Exception as e:
            return {'success': False, 'error': str(e)}
        if not os.path.isdir(base):
            return {'success': True, 'carimbo': 'ausente'}
        arquivos = pastas = 0
        soma = 0.0
        for atual, subpastas, nomes in os.walk(base):
            pastas += len(subpastas)
            for nome in nomes:
                if not nome.lower().endswith(EXTENSOES_DECISOES):
                    continue
                try:
                    st = os.stat(os.path.join(atual, nome))
                except OSError:
                    continue
                arquivos += 1
                soma += st.st_mtime + st.st_size
        return {'success': True, 'carimbo': '%d:%d:%.3f' % (arquivos, pastas, soma)}

    def buscar_conteudo_acervo(self, project_name, caminho_pasta, query,
                               max_results=20):
        """Busca literal no CONTEÚDO dos arquivos de uma pasta do Acervo.

        Existe porque a busca "Por conteúdo" valia numa sub-aba só: ela chamava
        `search_regras_content`, que é da gramática estruturada (itens com tipo)
        e não sabe responder sobre uma pasta qualquer — nas outras, o botão
        Buscar respondia com uma recusa. Esta devolve CAMINHO DE ARQUIVO, que é
        o que a árvore sabe abrir.

        `search_regras_content` continua intocada: quem a usa é o chat.
        """
        q = (query or '').strip()
        if not q:
            return {'success': True, 'results': []}
        try:
            base = self._acervo_base(project_name, caminho_pasta)
        except Exception as e:
            return {'success': False, 'error': str(e)}
        if not os.path.isdir(base):
            return {'success': True, 'results': []}
        alvo = q.lower()
        results = []
        for atual, subpastas, nomes in os.walk(base):
            subpastas[:] = sorted(subpastas)
            for nome in sorted(nomes):
                if not nome.lower().endswith(EXTENSOES_DECISOES):
                    continue
                caminho = os.path.join(atual, nome)
                try:
                    conteudo = self._ler_texto(caminho)
                except Exception:
                    continue
                idx = (conteudo or '').lower().find(alvo)
                if idx == -1:
                    continue
                ini = max(0, idx - 80)
                fim = min(len(conteudo), idx + len(q) + 80)
                results.append({
                    'caminho': os.path.relpath(caminho, base).replace('\\', '/'),
                    'snippet': conteudo[ini:fim].replace('\n', ' '),
                })
                if len(results) >= max_results:
                    return {'success': True, 'results': results}
        return {'success': True, 'results': results}
