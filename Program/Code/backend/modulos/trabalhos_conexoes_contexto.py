"""O que um nó LÊ quando começa: os canais e as notas dos vizinhos.

⚠️ QUEM GRAVA NOS CANAIS É O PROGRAMA, e o texto entregue diz isso ao agente.
Sem essa frase, um agente que recebe o canal como contexto tenta escrever nele —
e o arquivo é reescrito pelo lado que produz, então o que ele escrevesse sumiria
na próxima gravação, sem erro nenhum.

⚠️ O CONTEXTO É MONTADO NA HORA, e não guardado. Ele depende de quais ligações
existem AGORA e do que o outro lado produziu na última execução: um contexto
gravado envelhece na primeira mudança de fio.
"""

from .constantes import *


class TrabalhosConexoesContextoMixin:

    # ── O contexto que chega em quem lê ──────────────────────────────────────

    def _conx_canais_legiveis(self, project_name, andar, id_no):
        """Os arquivos que ESTE nó tem direito de ler, e por qual ligação.

        Duas origens, e as duas dão o mesmo tipo de acesso — leitura de um
        arquivo que outro escreveu:

          · mão única em que ele é o destino;
          · ida e volta em que ele é qualquer uma das pontas (lê o que a OUTRA
            ponta escreveu, nunca o próprio).

        ⚠️ EXISTIU UMA TERCEIRA, a triangulação: um nó que espiava o canal de
        uma ligação alheia sem que as pontas soubessem. Ela saiu junto com o
        tipo. Quem quiser um terceiro leitor liga esse terceiro à mesma origem,
        com uma mão única — a diferença é que agora a origem sabe.
        """
        legiveis = []

        for l in andar['ligacoes']:
            tipo = l.get('tipo')
            if tipo not in IDS_DAS_LIGACOES_COM_CANAL:
                continue
            autor = None
            if l.get('para') == id_no:
                autor = l['de']
            elif TIPO_E_DUPLO.get(tipo) and l.get('de') == id_no:
                autor = l.get('para')
            if not autor:
                continue
            legiveis.append({
                'caminho': self._conx_caminho_do_canal(project_name, l['id'], autor),
                'autor': self._conx_nome(andar, autor),
                'como': ROTULO_DO_TIPO.get(tipo, tipo).lower(),
            })

        # Canal que ainda não foi escrito não entra: mandar o caminho de um
        # arquivo inexistente faz o agente gastar uma ferramenta para descobrir
        # que não há nada lá, e às vezes concluir que ele é que errou o caminho.
        return [c for c in legiveis if os.path.isfile(c['caminho'])]

    def _conx_notas_legiveis(self, project_name, andar, id_no):
        """As notas do canvas que ESTE nó tem direito de ler. Irmã da de cima.

        O filtro é mais estreito que o dos canais: ligação de **mão única** em
        que a ORIGEM é um nó `tipo: 'nota'` e o destino é este nó.

        ⚠️ `nota → agente` QUER DIZER QUE O AGENTE LÊ A NOTA. O catálogo diz da
        mão única: *"A origem grava o que produziu num arquivo que o destino
        lê."* Já se propôs por aqui que mão única fosse "só lê" — está errado, e
        fica escrito para não voltar como ideia nova.

        ⚠️ ESTE CAMINHO SÓ LÊ, e nada aqui grava numa nota. A nota é gerada pelo
        programa em `Notas/` a partir do canvas; um agente escrevendo de volta
        daria dois donos ao mesmo texto, e a geração seguinte apagaria sem
        aviso. O lugar de o agente registrar coisa é `Anotações/<nó>/`.
        """
        base = self._mat_caminho(project_name, PASTA_NOTAS_DOS_TRABALHOS)
        if not base:
            return []
        # O MESMO cálculo que gerou os arquivos, e não uma segunda conta: é ele
        # que sabe do desempate entre duas notas que sanitizam igual.
        nomes = self._mat_nomes_das_notas(andar)
        legiveis = []
        for l in andar['ligacoes']:
            if l.get('tipo') != 'mao-unica' or l.get('para') != id_no:
                continue
            origem = self._trab_achar_no(andar, l.get('de'))
            if not origem or origem.get('tipo') != 'nota':
                continue
            # Nota vazia não entra, pela mesma razão que canal não escrito não
            # entra: o agente gasta uma ferramenta para descobrir que não há
            # nada lá, e às vezes conclui que ele é que errou o caminho.
            if not (origem.get('texto') or '').strip():
                continue
            nome = nomes.get(origem.get('id'))
            if not nome:
                continue
            legiveis.append({
                'caminho': os.path.join(base, nome),
                'autor': origem.get('nome') or origem.get('id'),
                'como': 'nota do usuário',
            })
        # Arquivo que ainda não foi gerado não entra — mesma regra de ouro da
        # irmã acima.
        return [n for n in legiveis if os.path.isfile(n['caminho'])]

    def _conx_contexto_de_canais(self, project_name, id_no):
        """O bloco de texto que entra na mensagem de quem tem canal para ler.

        ⚠️ VAI NA MENSAGEM, não numa flag inventada. O produto de assistente
        que o usuário escolheu não tem por que conhecer um `--canal` nosso — é
        a mesma razão pela qual o cartão do Quadro também entra como contexto.
        """
        try:
            andar = self._conx_andar(project_name)
        except Exception:
            return ''
        legiveis = self._conx_canais_legiveis(project_name, andar, id_no)
        if not legiveis:
            return ''
        linhas = ['[canais que você pode ler]']
        for c in legiveis:
            linhas.append(f'- {c["autor"]} ({c["como"]}): {c["caminho"]}')
        linhas.append('Leia o que for útil antes de começar. Não escreva nesses arquivos: '
                      'quem grava neles é o programa.')
        return '\n'.join(linhas)

