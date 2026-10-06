"""Arranjos da Oficina guardados para reaplicar — em qualquer projeto.

Um **Fluxo salvo** é a forma de um canvas sem o conteúdo dele: quantos nós, de
que tipo, com que nome e cor, ligados como, agrupados como. Você monta o
arranjo uma vez num projeto e o aplica em outro sem remontar nó por nó.

⚠️ SÃO GLOBAIS, e é essa a razão de existirem. Ficam no `settings.json` do
programa, ao lado dos presets de agente — nunca dentro do `Layout.json` de um
projeto. Um arranjo guardado dentro do projeto onde nasceu não serviria para o
próximo projeto, que é justamente quando ele faz falta.

⚠️ NÃO GUARDAM POSIÇÃO ABSOLUTA, e não é economia de bytes: o `x`/`y` de um nó
só quer dizer alguma coisa em relação aos outros nós daquele canvas. Aplicado
noutro projeto, com o canvas já ocupado, um `x` antigo cairia por cima do que
já estava lá. O que se guarda é o deslocamento em relação ao canto superior
esquerdo do arranjo; ao aplicar, esse canto é reancorado num espaço livre.

⚠️ NÃO GUARDAM PAPEL NEM CARTÃO DE ORIGEM. Papel só existe quando o nó nasce de
um cartão do Quadro, e cartão é de um projeto específico — reaplicar num outro
criaria um terminal "Orquestrador da atividade A-7" onde não existe A-7 nenhum.
Nó aplicado nasce sempre livre, do jeito que um nó criado à mão nasce.

⚠️ ESTE É O ÚNICO JEITO DE ABRIR VÁRIOS NÓS DE UMA VEZ. Havia um segundo — o
"Lançamento rápido" de Configuração › Agentes, que guardava só papéis ("um
Orquestrador e dois Subagentes") — e ele saiu da interface quando a área
Agentes foi para Configurações: lá só se configura, e abrir terminal é ação de
uso. O fluxo salvo faz tudo que ele fazia e mais: guarda o ARRANJO INTEIRO —
nós, ligações e grupos — e mora onde os nós de fato nascem.

⚠️ `lancar_combinacao` e as `combinacoes` do `settings.json` continuam
existindo em `trabalhos_presets.py`, mas SEM ENTRADA NA INTERFACE. Ficaram por
um motivo só: apagá-las reescreveria o `settings.json` do usuário. Quem for
mexer ali — e quem for procurar por que aquilo não aparece em tela nenhuma —
deve ler isto primeiro.
"""

import uuid

CHAVE_FLUXOS = 'fluxos_salvos_oficina'

# O que um nó leva para o arranjo salvo. Deliberadamente curto: o que não está
# aqui é ou de um projeto só (papel, cartão) ou efêmero (processo, log).
CAMPOS_DO_NO = ('tipo', 'nome', 'texto', 'cor')

# Onde o arranjo aplicado é ancorado quando o canvas já tem coisa. Fica ABAIXO
# do que existe, e não por cima: aparecer sobreposto ao que o usuário já tinha
# montado faria a aplicação parecer que apagou o canvas.
FOLGA_DA_ANCORA = 60


class TrabalhosFluxosSalvosMixin:

    # ── A lista global ───────────────────────────────────────────────────────

    def _flsv_lista(self):
        salvos = self._trab_settings().get(CHAVE_FLUXOS)
        return salvos if isinstance(salvos, list) else []

    def carregar_fluxos_salvos(self, project_name=None):
        """A gaveta. `project_name` é aceito e ignorado — a lista é global.

        Recebe o parâmetro para a tela poder chamá-la como chama as outras;
        usá-lo para filtrar seria o primeiro passo para a lista deixar de ser
        global, que é a única coisa que a torna útil.
        """
        try:
            return {'success': True, 'fluxos': [
                {'nome': f.get('nome'),
                 'descricao': f.get('descricao') or '',
                 'nos': len(f.get('nos') or []),
                 'ligacoes': len(f.get('ligacoes') or []),
                 'grupos': len(f.get('grupos') or [])}
                for f in self._flsv_lista()]}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Salvar o que está no canvas ──────────────────────────────────────────

    def salvar_fluxo_da_oficina(self, project_name, nome, descricao='', substituir=False):
        """Guarda o arranjo do canvas atual sob um nome.

        ⚠️ SÓ A FORMA VAI JUNTO — nada do que um terminal produziu. Nem log, nem
        processo, nem canal de ligação: o arquivo de canal é conversa de um
        trabalho que aconteceu, e levá-lo para outro projeto seria entregar ao
        agente de lá o contexto de um projeto que não é o dele.
        """
        try:
            nome = (nome or '').strip()
            if not nome:
                return {'success': False, 'error': 'Dê um nome ao fluxo.'}

            lista = self._flsv_lista()
            if any(f.get('nome') == nome for f in lista) and not substituir:
                return {'success': False, 'existe': True,
                        'error': f'Já existe um fluxo salvo chamado "{nome}".'}

            andar = self._trab_andar(self._trab_carregar_layout(project_name))
            nos = andar['nos']
            if not nos:
                return {'success': False,
                        'error': 'O canvas está vazio — não há arranjo para guardar.'}

            # A âncora é o canto superior esquerdo do que existe hoje. Todo `x`/
            # `y` guardado é distância até ela, e é isso que faz o arranjo poder
            # nascer em qualquer lugar de qualquer outro canvas.
            ax = min(n['x'] for n in nos)
            ay = min(n['y'] for n in nos)

            # Os ids viram apelidos locais (`n0`, `n1`…) porque o id real é do
            # canvas de origem: reaplicar carregando `no-a1b2c3` colidiria com o
            # nó de mesmo id se o arranjo fosse aplicado duas vezes no mesmo
            # canvas — e o segundo sobrescreveria as ligações do primeiro.
            apelido = {n['id']: 'n%d' % i for i, n in enumerate(nos)}

            fluxo = {
                'nome': nome,
                'descricao': (descricao or '').strip(),
                'nos': [dict({c: n.get(c) for c in CAMPOS_DO_NO},
                             ref=apelido[n['id']],
                             dx=n['x'] - ax, dy=n['y'] - ay) for n in nos],
                'ligacoes': self._flsv_ligacoes(andar, apelido),
                'grupos': [{'rotulo': g.get('rotulo') or '',
                            'nos': [apelido[i] for i in g['nos'] if i in apelido]}
                           for g in andar['grupos']],
            }
            lista = [f for f in lista if f.get('nome') != nome] + [fluxo]
            r = self.save_settings_parcial({CHAVE_FLUXOS: lista})
            if not r.get('success'):
                return r
            return {'success': True, 'fluxo': fluxo}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _flsv_ligacoes(self, andar, apelido):
        """As ligações em apelidos — as duas pontas, sempre.

        ⚠️ A CHAVE `observa` SAIU DA GRAVAÇÃO, mas fluxos guardados antes ainda
        a têm no disco. Ver `_flsv_recriar_ligacoes`: lá ela é ignorada em
        silêncio, e é por isso que aqui basta parar de escrever.
        """
        saida = []
        for l in andar['ligacoes']:
            if l['de'] not in apelido or l.get('para') not in apelido:
                continue
            saida.append({'tipo': l['tipo'], 'de': apelido[l['de']],
                          'para': apelido[l['para']]})
        return saida

    # ── Aplicar no canvas ────────────────────────────────────────────────────

    def aplicar_fluxo_salvo(self, project_name, nome):
        """Monta o arranjo no canvas atual, SEM apagar o que já está lá.

        ⚠️ ACRESCENTA, NUNCA SUBSTITUI. Aplicar um fluxo sobre um canvas com
        trabalho em andamento não pode varrer terminais que estão rodando — e
        "substituir" seria uma exclusão em massa disfarçada de aplicação, sem
        nem a confirmação que uma exclusão pediria.
        """
        try:
            fluxo = next((f for f in self._flsv_lista() if f.get('nome') == nome), None)
            if fluxo is None:
                return {'success': False, 'error': f'Fluxo salvo não encontrado: {nome}'}

            ancora = self._flsv_ancora(project_name)
            criados = {}
            for n in (fluxo.get('nos') or []):
                r = self.criar_no(
                    project_name, n.get('tipo') or 'terminal',
                    nome=n.get('nome') or '', texto=n.get('texto') or '',
                    # Sem papel e sem cartão: um nó aplicado nasce livre.
                    papel=None, cartao_origem=None,
                    x=ancora[0] + int(n.get('dx') or 0),
                    y=ancora[1] + int(n.get('dy') or 0))
                if not r.get('success'):
                    return r
                criados[n.get('ref')] = r['no']['id']
                if n.get('cor'):
                    self.editar_no(project_name, r['no']['id'], {'cor': n['cor']})

            ligacoes = self._flsv_recriar_ligacoes(project_name, fluxo, criados)
            grupos = self._flsv_recriar_grupos(project_name, fluxo, criados)
            return {'success': True, 'nos': len(criados),
                    'ligacoes': ligacoes, 'grupos': grupos}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _flsv_ancora(self, project_name):
        """Um canto livre, abaixo do que já existe. Canvas vazio começa no topo."""
        andar = self._trab_andar(self._trab_carregar_layout(project_name))
        if not andar['nos']:
            return (40, 40)
        return (min(n['x'] for n in andar['nos']),
                max(n['y'] for n in andar['nos']) + 220 + FOLGA_DA_ANCORA)

    def _flsv_recriar_ligacoes(self, project_name, fluxo, criados):
        """Recria as ligações na ordem em que foram guardadas.

        Ligação recusada (por ciclo, por duplicidade) é PULADA, não derruba a
        aplicação inteira: o canvas de destino pode já ter algo entre os mesmos
        dois nós, e perder uma seta é melhor que perder o arranjo todo.

        ⚠️ ARQUIVO ANTIGO COM TRIANGULAÇÃO CARREGA SEM ERRO, e sem ela. Fluxos
        gravados antes da remoção têm entradas com `para: null` e um índice em
        `observa`; elas caem no `continue` do `para` que não existe, e o resto do
        arranjo é montado normalmente. Perder uma seta é melhor que recusar o
        arquivo inteiro — que é a mesma regra do parágrafo acima.
        """
        feitas = 0
        for l in (fluxo.get('ligacoes') or []):
            de = criados.get(l.get('de'))
            para = criados.get(l.get('para'))
            if not de or not para:
                continue
            if self.conectar_nos(project_name, l['tipo'], de, para).get('success'):
                feitas += 1
        return feitas

    def _flsv_recriar_grupos(self, project_name, fluxo, criados):
        feitos = 0
        for g in (fluxo.get('grupos') or []):
            ids = [criados[r] for r in (g.get('nos') or []) if r in criados]
            if len(ids) < 2:
                continue
            if self.agrupar_nos(project_name, ids, g.get('rotulo') or '').get('success'):
                feitos += 1
        return feitos

    # ── Apagar ───────────────────────────────────────────────────────────────

    def excluir_fluxo_salvo(self, nome):
        """Tira um fluxo da gaveta. Não toca em canvas nenhum.

        ⚠️ É GLOBAL: some para todos os projetos, e não só para o que está
        aberto. Quem chama precisa dizer isso na confirmação.
        """
        try:
            lista = self._flsv_lista()
            nova = [f for f in lista if f.get('nome') != nome]
            if len(nova) == len(lista):
                return {'success': False, 'error': f'Fluxo salvo não encontrado: {nome}'}
            return self.save_settings_parcial({CHAVE_FLUXOS: nova})
        except Exception as e:
            return {'success': False, 'error': str(e)}
