"""Os nós do canvas: criar, mover, editar, duplicar e excluir.

⚠️ TODA ESCRITA PASSA POR `_trab_transacao_de_layout`, e nenhuma abre o arquivo
por conta própria. É a transação que segura a trava entre processos, guarda o
estado para o Desfazer e grava atomicamente. Um caminho de escrita fora dela
perde a corrida com uma ferramenta de MCP mexendo no mesmo arquivo — e o
sintoma é um nó que "some sozinho".

⚠️ O NOME DE UM NÓ É ÚNICO DENTRO DO ANDAR (`_trab_nome_unico`), e não por
capricho: o nome é o que aparece no `Equipe.md` e o que o agente usa para
endereçar um vizinho. Dois nós homônimos fazem uma nota chegar ao terminal
errado.

⚠️ EXCLUIR UM NÓ PODA AS LIGAÇÕES E OS GRUPOS DELE. A poda mora nos arquivos
irmãos (`_ligacoes.py` e `_grupos.py`) e é chamada daqui — deixar uma ligação
apontando para um nó que não existe faz o desenho quebrar em silêncio, e o
efeito da ligação continuar valendo para um processo que não existe mais.
"""

from .trabalhos_layout_constantes import *


class TrabalhosLayoutNosMixin:

    # ── Os nós ───────────────────────────────────────────────────────────────

    def _trab_achar_no(self, andar, id_no):
        for n in andar['nos']:
            if n.get('id') == id_no:
                return n
        return None

    def _trab_proxima_posicao(self, andar):
        n = len(andar['nos'])
        return (NASCIMENTO_X + (n % 8) * NASCIMENTO_PASSO,
                NASCIMENTO_Y + (n % 8) * NASCIMENTO_PASSO)

    def _trab_cor_do_papel(self, papel, andar):
        """A cor de um nó COM papel. Nunca é escolha do usuário.

        O Orquestrador tem uma cor fixa. Os Subagentes se revezam entre três,
        para que dois abertos ao mesmo tempo não fiquem idênticos de longe —
        que é a única coisa que a cor precisa resolver aqui.
        """
        if papel == 'orquestrador':
            return next(p['cor'] for p in PAPEIS_DE_TERMINAL if p['id'] == 'orquestrador')
        quantos = sum(1 for n in andar['nos'] if n.get('papel') == 'subagente')
        return CORES_DOS_SUBAGENTES[quantos % len(CORES_DOS_SUBAGENTES)]

    def criar_no(self, project_name, tipo, nome='', texto='', papel=None,
                 cartao_origem=None, x=None, y=None, id_andar=None,
                 produto=None, modo=None):
        """Cria um nó no canvas.

        ⚠️ `papel` só vem preenchido quando o nó nasce de um CARTÃO DO QUADRO.
        Um nó criado pela barra de ferramentas passa `papel=None` e nunca ganha
        um depois — nome e cor ficam livres, do jeito que o usuário quiser.
        """
        try:
            if tipo not in IDS_DOS_TIPOS_DE_NO:
                return {'success': False,
                        'error': f'Tipo de nó desconhecido: {tipo}. '
                                 f'Existem: {", ".join(IDS_DOS_TIPOS_DE_NO)}.'}
            if papel is not None and papel not in IDS_DOS_PAPEIS:
                return {'success': False, 'error': f'Papel desconhecido: {papel}'}
            if papel is not None and tipo != 'terminal':
                return {'success': False,
                        'error': 'Só um nó do tipo terminal pode ter papel.'}
            with self._trab_transacao_de_layout(project_name, id_andar) as (layout, andar):
                px, py = self._trab_proxima_posicao(andar)
                no = {
                    'id': 'no-' + uuid.uuid4().hex[:10],
                    'tipo': tipo,
                    # ⚠️ NOME DIGITADO PASSA PELA NUMERAÇÃO; nome automático
                    # não precisa — `_trab_nome_padrao` já conta por tipo e por
                    # papel, e nasce único.
                    'nome': (self._trab_nome_unico(andar, nome)
                             or self._trab_nome_padrao(tipo, papel, andar)),
                    'texto': (texto or '').strip(),
                    'x': int(x) if x is not None else px,
                    'y': int(y) if y is not None else py,
                    'cor': self._trab_cor_do_papel(papel, andar) if papel else None,
                    'papel': papel,
                    'cartao_origem': cartao_origem,
                    # ⚠️ Trava do papel (D34). Nasce aberta e fecha na 1ª
                    # mensagem enviada; só "Parar tudo" reabre. Um nó sem papel
                    # nasce travado por vaziez — não há papel a proteger.
                    'papel_travado': False,
                    'grupo': None,
                    # ⚠️ O QUE O TERMINAL VAI RODAR, escolhido na CRIAÇÃO e
                    # gravado no nó — não é uma preferência global. Dois
                    # terminais lado a lado podem rodar produtos diferentes, e
                    # era isso que um "produto ativo" único impedia.
                    #
                    #   `produto` = o nome de um produto configurado, ou None
                    #   `modo`    = o nome de um preset de agente, ou None
                    #
                    # Os dois vazios é o caso comum: um terminal do sistema, sem
                    # nada digitado dentro dele.
                    'produto': (produto or '').strip() or None,
                    'modo': (modo or '').strip() or None,
                }
                andar['nos'].append(no)
            return {'success': True, 'no': no}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _trab_nome_unico(self, andar, nome, ignorar_id=None):
        """Numera um nome que já existe, em vez de recusá-lo.

        ⚠️ O QUE PRECISA SER ÚNICO É O SLUG, e não o nome bonito. O slug vira
        NOME DE SESSÃO do assistente externo (`_sh_slug`, em
        `trabalhos_shell.py`), e é por ele que um terminal endereça o outro —
        dois nós com o mesmo slug fazem a mensagem chegar a um deles, sempre o
        mesmo, sem erro nenhum e sem jeito de perceber. E o slug colide mais
        que o nome: `Revisor A` e `Revisor-a` são o mesmo `revisor-a`.

        ⚠️ NUMERA, NÃO RECUSA — mesma escolha que `_trab_nome_padrao` já fazia
        para os nomes automáticos (`Subagente 1`, `Subagente 2`…). Recusar
        obrigaria o usuário a inventar um nome diferente para uma coisa que o
        programa sabe resolver sozinho, e o aviso apareceria num popover que
        ele fecha antes de ler.
        """
        nome = (nome or '').strip()
        if not nome:
            return nome
        tomados = {self._sh_slug(n.get('nome')) for n in andar['nos']
                   if n.get('id') != ignorar_id}
        if self._sh_slug(nome) not in tomados:
            return nome
        n = 2
        while self._sh_slug(f'{nome} {n}') in tomados:
            n += 1
        return f'{nome} {n}'

    def _trab_nome_padrao(self, tipo, papel, andar):
        if papel == 'orquestrador':
            return 'Orquestrador'
        if papel == 'subagente':
            n = sum(1 for x in andar['nos'] if x.get('papel') == 'subagente') + 1
            return f'Subagente {n}'
        rotulos = {'terminal': 'Terminal', 'nota': 'Nota', 'texto': 'Texto'}
        n = sum(1 for x in andar['nos'] if x.get('tipo') == tipo) + 1
        return f'{rotulos.get(tipo, "Nó")} {n}'

    def mover_nos(self, project_name, movimentos, id_andar=None, desfazivel=True,
                  filiacao=None):
        """Grava a posição de um ou vários nós de uma vez.

        Recebe uma LISTA, e não um nó por chamada, porque arrastar uma seleção
        move todos juntos: uma transação por nó tomaria e soltaria o lock N
        vezes para uma única ação do usuário, e deixaria o arquivo num estado
        intermediário que ninguém pediu.

        `filiacao` é `{ id do nó: id do grupo ou None }`, e chega JUNTO pela
        mesma razão: desde que a caixa do grupo virou o dado, soltar um nó
        dentro dela é que decide se ele entrou. Posição e filiação são o mesmo
        gesto — gravá-las em duas chamadas deixaria o nó desenhado dentro de
        uma caixa de que ele ainda não é, até a segunda chegar.
        """
        try:
            with self._trab_transacao_de_layout(project_name, id_andar,
                                                desfazivel) as (layout, andar):
                for m in (movimentos or []):
                    no = self._trab_achar_no(andar, m.get('id'))
                    if no is None:
                        continue  # nó apagado por outra via: ignorar é o certo
                    no['x'] = int(m.get('x', no['x']))
                    no['y'] = int(m.get('y', no['y']))
                if filiacao:
                    self._trab_refiliar(andar, filiacao)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def editar_no(self, project_name, id_no, campos, id_andar=None):
        """Nome, texto, cor e tamanho. Posição tem porta própria; papel não se edita."""
        try:
            with self._trab_transacao_de_layout(project_name, id_andar) as (layout, andar):
                no = self._trab_achar_no(andar, id_no)
                if no is None:
                    return {'success': False, 'error': f'Nó não encontrado: {id_no}'}
                campos = campos or {}
                if 'nome' in campos:
                    # ⚠️ `ignorar_id` É O PRÓPRIO NÓ, senão renomear sem mudar
                    # o nome viraria "Terminal 1" → "Terminal 1 2": ele
                    # colidiria consigo mesmo.
                    pedido = self._trab_nome_unico(andar, campos['nome'], no['id'])
                    no['nome'] = pedido or no['nome']
                if 'texto' in campos:
                    no['texto'] = campos['texto'] or ''
                # Tamanho escolhido pelo usuário, arrastando a pega do canto. É
                # opcional: sem ele, o nó vale o que o CSS disser — que é o
                # certo enquanto ninguém pediu outra coisa.
                for medida in ('largura', 'altura'):
                    if medida in campos:
                        valor = campos[medida]
                        no[medida] = max(40, int(valor)) if valor else None
                # ⚠️ O CORPO DA LETRA É DO NÓ DE TEXTO, e não uma terceira
                # medida da caixa. Num nó de texto a caixa não é vista — a
                # pega dele mexe aqui, e largura/altura ficam sem uso. Os
                # limites repetem os da tela de propósito: o backend não confia
                # no que a interface mandou.
                if 'fonte' in campos:
                    valor = campos['fonte']
                    no['fonte'] = min(160, max(9, int(valor))) if valor else None
                if 'cor' in campos:
                    # ⚠️ A COR DE PAPEL NÃO SE SOBRESCREVE. É ela que diz, de
                    # longe, quem é o Orquestrador e quem é cada Subagente;
                    # deixar o usuário pintar um deles de outra cor apaga a
                    # única leitura que a cor existe para dar.
                    if no.get('papel'):
                        return {'success': False,
                                'error': 'Este nó veio de um cartão do Quadro: a cor dele é a '
                                         'do papel e não muda. Só nós soltos aceitam cor livre.'}
                    no['cor'] = campos['cor'] or None
            # ⚠️ A NOTA VIRA ARQUIVO NA GRAVAÇÃO, e não a cada tecla. Este
            # ponto é o fim da edição (a tela grava ao sair do editor), que é
            # exatamente o instante em que o texto passou a valer alguma coisa
            # para quem vai lê-lo. Pendurado no `oninput` seriam dezenas de
            # escritas por nota; pendurado só na abertura do terminal, o agente
            # leria a nota de ontem a sessão inteira.
            if no.get('tipo') == 'nota':
                self._mat_regerar_notas(project_name)
            return {'success': True, 'no': no}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def excluir_nos(self, project_name, ids, id_andar=None):
        """Tira nós do canvas.

        ⚠️ ESTE DOCSTRING DIZIA "Recusa nó com processo VIVO", E JÁ NÃO ERA
        VERDADE. Ele descrevia a versão anterior; o corpo abaixo FECHA o
        terminal e segue (ver o ⚠️ lá dentro, que registra a troca). Ficou aqui
        reescrito em vez de apagado porque a razão antiga continua valendo para
        o nó de AGENTE, que é a única coisa que ainda recusa — e um leitor que
        encontrasse só a recusa no meio do código, sem explicação, a trataria
        como sobra.

        Resumindo o que vale hoje:
          · nó de TERMINAL vivo  → o terminal é fechado, e o nó sai;
          · nó de AGENTE rodando → recusa, porque ele pode estar no meio de
            escrever arquivo.
        """
        try:
            ids = set(ids or [])
            # ⚠️ EXCLUIR FECHA O TERMINAL, e não recusa. Antes recusava, com a
            # razão certa (um processo vivo sem nó na tela é um fantasma que
            # ninguém consegue parar) e a conclusão errada: o usuário apertava
            # Delete no PRÓPRIO nó dele e nada acontecia, com um aviso que ele
            # nem via. Apertar Delete num terminal É o gesto de fechá-lo — o
            # programa faz as duas coisas em vez de exigir a ordem certa.
            for i in ids:
                if self._sh_vivo(project_name, i):
                    self.fechar_shell(project_name, i)
            # O nó de AGENTE (execução em tiro só) continua recusando: ali o
            # processo pode estar no meio de escrever arquivo, e interrompê-lo
            # por um Delete é outra conversa.
            vivos = [i for i in ids if self._trab_terminal_rodando(project_name, i)]
            if vivos:
                return {'success': False,
                        'error': 'Pare o terminal antes de excluir o nó: '
                                 + ', '.join(sorted(vivos))}
            orfas = []
            with self._trab_transacao_de_layout(project_name, id_andar) as (layout, andar):
                andar['nos'] = [n for n in andar['nos'] if n.get('id') not in ids]
                orfas = self._trab_podar_ligacoes(andar)
                # O grupo que ficou com um nó só (ou nenhum) some junto: uma
                # caixa em volta de um cartão sozinho não diz nada.
                self._trab_podar_grupos(andar)
            # O canal de uma ligação que deixou de existir vira lixo em disco —
            # e lixo com nome de id, que ninguém sabe mais a quem pertencia. A
            # espera guardada do nó vai junto, pela mesma razão.
            self._conx_ao_excluir_nos(project_name, ids, orfas)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def duplicar_no(self, project_name, id_no, id_andar=None):
        """Copia um nó ao lado do original.

        A cópia NUNCA herda papel nem cartão de origem, mesmo copiando um nó que
        tem os dois: papel vem de um cartão do Quadro, e duplicar um desenho não
        cria um segundo terminal responsável pela mesma atividade.
        """
        try:
            with self._trab_transacao_de_layout(project_name, id_andar) as (layout, andar):
                orig = self._trab_achar_no(andar, id_no)
                if orig is None:
                    return {'success': False, 'error': f'Nó não encontrado: {id_no}'}
                copia = dict(orig)
                copia.update({
                    'id': 'no-' + uuid.uuid4().hex[:10],
                    'x': orig['x'] + 28, 'y': orig['y'] + 28,
                    'papel': None, 'cartao_origem': None, 'papel_travado': False,
                    'cor': None if orig.get('papel') else orig.get('cor'),
                    'nome': orig['nome'] + ' (cópia)',
                    'grupo': None,
                })
                andar['nos'].append(copia)
            return {'success': True, 'no': copia}
        except Exception as e:
            return {'success': False, 'error': str(e)}
