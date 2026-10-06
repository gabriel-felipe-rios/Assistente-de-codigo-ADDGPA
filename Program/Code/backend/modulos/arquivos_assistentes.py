"""O cadastro do ASSISTENTE EXTERNO: quem é ele e PARA ONDE cada categoria vai.

Arquivo próprio porque responde uma pergunta que nenhum outro daqui responde. A
biblioteca (`arquivos.py`) diz o que existe; o início rápido
(`arquivos_inicio_rapido.py`) diz QUAIS itens vão; este diz PARA ONDE eles vão,
e com que nome de arquivo chegam. Foram duas metades da mesma pergunta em duas
listas diferentes até 2026-09-02, e a fusão daquele dia é justamente o que
tornou os três eixos separáveis.

O que mora aqui:

    · a lista de presets, sempre completada com as categorias e os campos de
      lançamento que nasceram depois de o preset ter sido gravado
      (`_assistente_completo`) — ausente ≠ vazio, e a diferença é a decisão do
      usuário;
    · a validação de cada preset (`validar_assistente`), que é o que barra um
      destino quebrado na hora de USAR, nunca na de salvar;
    · a gravação, e a CASCATA do renomear.

⚠️ A CASCATA É O PONTO PERIGOSO DESTE ARQUIVO. O casamento entre as listas é por
NOME, não por id: o mesmo texto está gravado em `inicios_rapidos[].assistente`
(global), em `assistente_externo` (por projeto) e no `produto` de cada nó do
`Layout.json` da Oficina. Renomear sem passar pelos três não dá erro nenhum — só
deixa início rápido apontando para o vazio e nó órfão, e a Oficina abre o
terminal limpo. É por isso que `gravar_json_atomico` é importado aqui: o Layout
é o único dos três que este módulo escreve por fora do caminho normal.
"""

from .constantes import *
# A gravação atômica do `Layout.json` da Oficina, usada só pela cascata do
# rename de assistente: o nome dele está gravado no campo `produto` de cada nó,
# e renomear sem passar por lá deixa a Oficina com nós órfãos, sem erro nenhum.
from .trabalhos_estado import gravar_json_atomico


class ArquivosAssistentesMixin:

    # ── Assistentes externos ──────────────────────────────────────────────
    #
    # ⚠️ Havia aqui um aviso dizendo que esta lista e a do Preparar NÃO deviam
    # ser fundidas. Elas foram, em 2026-09-02: eram o mesmo objeto partido em
    # duas chaves por história, e o casamento por string entre elas perdeu um
    # assistente inteiro sozinho (o OpenCode). O motivo está escrito por extenso
    # em `padroes_de_fabrica.py`, na seção "Assistentes externos".
    #
    # O que sobrou separado é o INÍCIO RÁPIDO, e por outro motivo: ele responde
    # QUAIS itens da biblioteca vão e QUE PASTAS nascem — perguntas por projeto,
    # não por assistente.

    def _lista_de_assistentes(self):
        presets = self.load_settings()['settings'].get('assistentes_externos')
        if not isinstance(presets, list):
            return []
        return [self._assistente_completo(p) for p in presets if isinstance(p, dict)]

    def _assistente_completo(self, preset):
        """O preset com TODAS as categorias de hoje, mesmo as que não existiam
        quando ele foi gravado.

        Sem isto, quem já usava o programa antes de uma categoria nascer ficaria
        com o campo dela em branco para sempre — e "em branco" quer dizer "este
        assistente não usa a categoria", que é justamente a resposta errada. A
        queda é o preset DE FÁBRICA DE MESMO NOME: se o usuário nunca mexeu no
        "Claude Code", ele ganha o destino de fábrica da categoria nova; se
        mexeu, só a categoria que faltava é preenchida, e o resto fica como ele
        deixou. Preset com nome próprio (que não existe de fábrica) recebe o
        campo vazio, porque aí não há de onde adivinhar.
        """
        de_fabrica = next((f for f in ASSISTENTES_EXTERNOS
                           if f.get('nome') == preset.get('nome')), None)
        cheio = dict(preset)
        cheio['categorias'] = dict(preset.get('categorias') or {})
        # `./` e `.` foram como a raiz do projeto se escrevia antes de o campo
        # vazio passar a querer dizer isso. Ficaria funcionando, mas o usuário
        # veria no campo uma string que ele não escreveu e que a tela já não
        # explica mais — some na leitura, e o Salvar seguinte grava sem ela.
        for kind, conf in list(cheio['categorias'].items()):
            if self._raiz_quando_vazio(kind) and (conf or {}).get('destino') in ('.', './', '/'):
                conf = dict(conf)
                conf['destino'] = ''
                cheio['categorias'][kind] = conf
        for kind, _, _, _ in CATEGORIAS_DO_ASSISTENTE:
            if kind in cheio['categorias']:
                continue
            padrao = ((de_fabrica or {}).get('categorias') or {}).get(kind)
            cheio['categorias'][kind] = dict(padrao) if padrao else {
                'destino': '', 'arquivo_de_entrada': '', 'formato': 'pasta'}
        # ⚠️ CAMPO DE LANÇAMENTO NOVO SEGUE A MESMA REGRA DAS CATEGORIAS, e a
        # falta disto fez a obra da Orquestração nascer MUDA. `flag_agente` e
        # `flag_prompt_arquivo` entraram em 2026-09-03; todo `settings.json`
        # gravado antes disso simplesmente não tem as chaves, e a leitura caía
        # em vazio — que quer dizer "este assistente não sabe fazer isso". O
        # resultado foi um terminal que abria sem `--agent` e sem o prompt do
        # papel, sem erro nenhum na tela: exatamente o defeito que a obra
        # existia para consertar, agora causado pela própria obra.
        #
        # ⚠️ AUSENTE ≠ VAZIO, e a diferença é a decisão do usuário. Chave que
        # não existe é um campo que nasceu depois dele: cai na fábrica. Chave
        # presente e vazia foi ele quem limpou, e continua vazia — senão o
        # campo que ele apagou "voltaria sozinho" no próximo lançamento.
        for campo in ('flag_agente', 'flag_prompt_arquivo'):
            if campo not in cheio:
                cheio[campo] = (de_fabrica or {}).get(campo, '')
        return cheio

    def _assistente_externo(self, nome=None):
        """O preset pedido; senão o padrão; senão o primeiro. Nunca inventa um.

        Devolver None é o caso em que o usuário apagou todos os presets — e é o
        único caso em que o botão de copiar bloqueia. Adivinhar um destino aqui
        é como o `activate_item` errava antes: mandava tudo para a mesma pasta.
        """
        presets = self._lista_de_assistentes()
        if not presets:
            return None
        if nome:
            for p in presets:
                if p.get('nome') == nome:
                    return p
        padrao = self.load_settings()['settings'].get('assistente_externo_padrao')
        for p in presets:
            if p.get('nome') == padrao:
                return p
        return presets[0]

    @staticmethod
    def _raiz_quando_vazio(kind):
        """A categoria cujo destino VAZIO quer dizer "a raiz do projeto".

        Hoje só Instruções base: o arquivo que o assistente lê primeiro mora na
        raiz em todos eles, e "não copiar" não é um caso real ali. A alternativa
        era obrigar o usuário a escrever `./` no campo — string que ninguém
        adivinha, e que ele apontou como estranha assim que a viu.
        """
        return any(k == kind and raiz for k, _, _, raiz in CATEGORIAS_DO_ASSISTENTE)

    @staticmethod
    def _categoria_do_assistente(preset, kind):
        """A configuração de uma categoria dentro do preset, sempre completa."""
        cat = ((preset or {}).get('categorias') or {}).get(kind) or {}
        return {
            'destino': (cat.get('destino') or '').strip(),
            'arquivo_de_entrada': (cat.get('arquivo_de_entrada') or '').strip(),
            'formato': cat.get('formato') or 'pasta',
        }

    def validar_assistente(self, preset):
        """Todos os erros do preset. Lista vazia = pode ser usado.

        Reaproveita `_erro_de_caminho` do Preparar — a regra de caminho é a
        mesma (relativo à raiz, sem '..', sem caractere proibido), e duplicá-la
        aqui é garantir que as duas divirjam na primeira correção.
        """
        erros = []
        if not isinstance(preset, dict):
            return ['Preset inválido.']
        for kind, rotulo, so_destino, _raiz in CATEGORIAS_DO_ASSISTENTE:
            cat = self._categoria_do_assistente(preset, kind)
            erro = self._erro_de_caminho(cat['destino'], 'Destino de %s' % rotulo)
            if erro:
                erros.append(erro)
            if so_destino:
                # Só "para onde": os outros dois campos não se aplicam, e validar
                # o que a tela nem mostra viraria erro que ninguém consegue tirar.
                continue
            entrada = cat['arquivo_de_entrada']
            if entrada and ('/' in entrada or '\\' in entrada):
                erros.append('%s: o arquivo de entrada é um nome de arquivo, não um caminho.' % rotulo)
            if cat['formato'] not in ('pasta', 'solto'):
                erros.append('%s: formato deve ser "pasta" ou "solto".' % rotulo)
        return erros

    def load_assistentes_config(self, project_name=None):
        """Os presets da aba Arquivos, quais servem, e qual vale neste projeto."""
        presets = self._lista_de_assistentes()
        s = self.load_settings()['settings']
        nomes = [p.get('nome') for p in presets]
        escolhido = None
        if project_name:
            escolhido = (self.load_workspace(project_name).get('config', {})
                         .get('assistente_externo'))
        if escolhido not in nomes:
            escolhido = s.get('assistente_externo_padrao')
        if escolhido not in nomes:
            escolhido = nomes[0] if nomes else None
        return {
            'success': True,
            'presets': presets,
            'padrao': s.get('assistente_externo_padrao'),
            'escolhido': escolhido,
            'categorias': [{'kind': k, 'rotulo': r, 'so_destino': d, 'raiz_quando_vazio': z}
                           for k, r, d, z in CATEGORIAS_DO_ASSISTENTE],
            'erros': {p.get('nome'): self.validar_assistente(p) for p in presets},
        }

    def save_assistentes(self, presets, padrao=None, renomeados=None):
        """Grava a lista inteira. Preset inválido PODE ser gravado.

        Mesma escolha do Preparar, e pelo mesmo motivo: o usuário fica a meio de
        digitar um caminho o tempo todo, e recusar a gravação faria perder o
        resto do formulário. Quem barra o preset quebrado é a hora de USAR.
        """
        if not isinstance(presets, list):
            return {'success': False, 'error': 'Formato inválido.'}
        limpos = []
        for p in presets:
            if not isinstance(p, dict) or not (p.get('nome') or '').strip():
                continue
            limpos.append({
                'nome': p['nome'].strip(),
                # ⚠️ OS CAMPOS DE LANÇAMENTO VÊM JUNTO. Eles moram no MESMO
                # registro desde a fusão de 2026-09-02; gravar só `categorias`
                # apagaria o comando de todo assistente a cada Salvar da tela
                # de destinos — sem erro, e sem ninguém ligando uma coisa à
                # outra depois.
                'comando': (p.get('comando') or '').strip(),
                'argumentos': [str(a) for a in (p.get('argumentos') or []) if str(a).strip()],
                'flag_nome': (p.get('flag_nome') or '').strip(),
                'flag_prompt': (p.get('flag_prompt') or '').strip() or '--append-system-prompt',
                # As duas do papel. Vazias são legítimas: produto que não sabe
                # receber prompt por arquivo, ou não tem noção de agente, abre
                # o terminal sem elas — ver `_sh_comando_do_modo`.
                'flag_prompt_arquivo': (p.get('flag_prompt_arquivo') or '').strip(),
                'flag_agente': (p.get('flag_agente') or '').strip(),
                'comando_cota': (p.get('comando_cota') or '').strip(),
                # Sempre as quatro chaves, sempre completas: uma chave faltando
                # faria a leitura cair no padrão silenciosamente e o usuário
                # veria o campo que ele esvaziou "voltar sozinho".
                'categorias': {k: self._categoria_do_assistente(p, k)
                               for k, _, _, _ in CATEGORIAS_DO_ASSISTENTE},
            })
        # ⚠️ A CASCATA VEM ANTES da gravação da lista. `renomeados` é
        # `{nome antigo: nome novo}`, montado pela tela — o Renomear de lá é só
        # em memória, e é aqui que ele encosta no disco. Vindo antes, um erro na
        # cascata não deixa a lista já renomeada com os três lugares para trás.
        for antigo, novo in (renomeados or {}).items():
            self._cascata_de_rename(antigo, novo)

        patch = {'assistentes_externos': limpos}
        nomes = [p['nome'] for p in limpos]
        if padrao in nomes:
            patch['assistente_externo_padrao'] = padrao
        elif nomes:
            atual = self.load_settings()['settings'].get('assistente_externo_padrao')
            if atual not in nomes:
                patch['assistente_externo_padrao'] = nomes[0]
        # ⚠️ `save_settings_parcial`, E NUNCA `save_settings`. Este era o último
        # `save_settings` direto do programa, e ele gravava o `settings.json`
        # com DUAS chaves — apagando todas as outras. Salvar um preset de
        # arquivos zerava tema, ícones, limites e a lista de produtos de uma vez
        # só; o sintoma era chave que "some sozinha" do disco, sem erro nenhum.
        # O aviso disso está escrito no docstring de `save_settings`, em
        # `configuracoes.py`, e valia para cá também.
        return self.save_settings_parcial(patch)

    def contar_uso_do_assistente(self, nome):
        """Quantos inícios rápidos e quantos projetos usam este assistente.

        É o que a lixeira precisa para DIZER QUANTOS antes de apagar. Convenção
        *"Toda lixeira confirma antes"*: quando a remoção atinge outras coisas
        além do alvo, o modal diz quantas — senão o usuário só descobre o
        estrago depois, e sem como saber o que era.
        """
        nome = (nome or '').strip()
        out = {'success': True, 'inicios_rapidos': 0, 'projetos': 0, 'nos_oficina': 0}
        if not nome:
            return out
        try:
            out['inicios_rapidos'] = sum(
                1 for i in self._inicios_rapidos() if i.get('assistente') == nome)
        except Exception:
            pass
        for projeto in (self.list_projects() or []):
            try:
                config = self.load_workspace(projeto).get('config', {}) or {}
            except Exception:
                continue
            if config.get('assistente_externo') == nome:
                out['projetos'] += 1
            # O `produto` de cada nó da Oficina é o MESMO nome, gravado noutro
            # arquivo. Ele não aparece no aviso de exclusão (excluir não mexe
            # em Layout), mas o rename precisa dele.
            try:
                for andar in (self._trab_carregar_layout(projeto).get('andares') or []):
                    for no in (andar.get('nos') or []):
                        if no.get('produto') == nome:
                            out['nos_oficina'] += 1
            except Exception:
                continue
        return out

    def _cascata_de_rename(self, antigo, novo):
        """O nome do assistente está gravado em TRÊS lugares fora da lista.

        ⚠️ O casamento entre as listas é por NOME (string), e não por id. Isto
        aqui é o preço de ter liberado o Renomear: sem os três, renomear deixa
        início rápido apontando para o vazio e nó da Oficina órfão — e nada
        disso dá erro, a Oficina só abre o terminal limpo.

            1. `inicios_rapidos[].assistente`   (settings.json, global)
            2. `assistente_externo`             (Workspace.json, por projeto)
            3. `produto` de cada nó             (Layout.json da Oficina)
        """
        antigo = (antigo or '').strip()
        novo = (novo or '').strip()
        if not antigo or not novo or antigo == novo:
            return {'inicios_rapidos': 0, 'projetos': 0, 'nos_oficina': 0}
        feito = {'inicios_rapidos': 0, 'projetos': 0, 'nos_oficina': 0}

        # 1 ── Os inícios rápidos.
        try:
            inicios = self.load_settings()['settings'].get('inicios_rapidos')
            if isinstance(inicios, list):
                mudou = False
                for i in inicios:
                    if isinstance(i, dict) and i.get('assistente') == antigo:
                        i['assistente'] = novo
                        feito['inicios_rapidos'] += 1
                        mudou = True
                if mudou:
                    self.save_settings_parcial({'inicios_rapidos': inicios})
        except Exception:
            pass

        # 2 e 3 ── Cada projeto: o Workspace e o Layout da Oficina.
        for projeto in (self.list_projects() or []):
            try:
                config = self.load_workspace(projeto).get('config', {}) or {}
                if config.get('assistente_externo') == antigo:
                    config['assistente_externo'] = novo
                    self.save_workspace(projeto, config)
                    feito['projetos'] += 1
            except Exception:
                pass
            try:
                caminho = self._trab_caminho_do_layout(projeto)
                if not os.path.isfile(caminho):
                    continue
                layout = self._trab_carregar_layout(projeto)
                mudou = 0
                for andar in (layout.get('andares') or []):
                    for no in (andar.get('nos') or []):
                        if no.get('produto') == antigo:
                            no['produto'] = novo
                            mudou += 1
                if mudou:
                    gravar_json_atomico(caminho, layout)
                    feito['nos_oficina'] += mudou
            except Exception:
                pass
        return feito

    def escolher_assistente_do_projeto(self, project_name, nome):
        """Marca no projeto qual preset o botão de copiar vai usar."""
        ws = self.load_workspace(project_name)
        config = ws.get('config', {})
        config['assistente_externo'] = nome
        self.save_workspace(project_name, config)
        return {'success': True}
