"""O que uma ligação da Oficina FAZ — a peça tecnicamente nova da obra.

Contra a recomendação original da discussão, o usuário decidiu que as quatro
ligações do canvas travam e fluem de verdade. Uma linha desenhada entre dois
terminais muda o que acontece com os processos deles; ela não é enfeite.

⚠️ NENHUM TRANSPORTE NOVO FOI INVENTADO, e isso é o centro do desenho. Não há
socket, porta, fila de mensagens nem protocolo entre os processos. O que existe
é o mesmo canal de ARQUIVO que o programa já usa para falar com o assistente
externo — o programa escreve um `.md`, e o caminho dele entra no contexto de
quem tem permissão de ler. Um transporte novo exigiria que o CLI de terceiro
soubesse falar com a gente, e ele não sabe.

As quatro, e o que cada uma custa:

  **Dependência (A espera B)** — a mais barata das quatro, e a única que não
    precisa de comunicação nenhuma. É controle de ORDEM DE LANÇAMENTO, 100% do
    lado do programa: antes de chamar `Popen` para A, o programa olha se B já
    entregou. Se não, a mensagem de A fica guardada e o nó mostra "aguardando
    dependência" até poder disparar. Ninguém fala com ninguém.

  **Mão única (A → B)** — quando A termina, o programa grava o que ele produziu
    num arquivo dedicado à ligação, e o caminho desse arquivo entra no contexto
    da PRÓXIMA execução de B. Unidirecional por construção: só A escreve nele.
    ⚠️ Ela NÃO dispara B — passar dado e mandar começar são coisas diferentes,
    e quem manda começar é a dependência. Querer as duas é comum, e é só criar
    as duas: uma diz "só depois dele", a outra diz "com o que ele produziu".

  **Ida e volta (A ↔ B)** — dois arquivos, um por sentido, e o programa
    REINICIA o outro lado a cada vez que um lado termina, passando o caminho do
    que acabou de ser escrito. Na prática é "ida e volta por rodada", e não
    conversa fluida: as sessões rodam em tiro só, cada mensagem é uma execução
    inteira. É a mais cara das quatro e a de maior risco — ver o aviso abaixo.

⚠️ O TETO DE RODADAS DA IDA E VOLTA NÃO É PREFERÊNCIA DE GOSTO. Sem ele, A
termina e aciona B, B termina e aciona A, e o pingue-pongue não para sozinho —
gastando cota paga do usuário a cada volta, sem que nada na tela diga que vai
continuar. O teto está em `LIMITES_EDITAVEIS` (catálogo único), tem padrão de
fábrica e é configurável; ao bater nele, os dois lados param e o motivo aparece
escrito no log de ambos, e não só no de quem parou.

⚠️ CICLO DE DEPENDÊNCIA É RECUSADO NA CRIAÇÃO, em `trabalhos_layout.py`. Aqui
o motivo prático: um ciclo não daria erro nenhum — daria dois nós parados para
sempre em "aguardando", e a única pista seria a ausência de qualquer coisa
acontecendo. Recusar quando as duas pontas ainda estão na mão é o único momento
em que dá para explicar.

⚠️ O QUE VIVE EM MEMÓRIA E O QUE VIVE EM DISCO. A ligação é layout e persiste
(`Layout.json`). A ESPERA — a mensagem guardada de um nó que não pôde disparar
— e a contagem de rodadas morrem com o programa, de propósito: as duas só fazem
sentido para um processo que existe, e nenhum processo sobrevive ao fechar.
"""

import os
import threading
import time
from datetime import datetime

from .caminhos import obter_pasta_de_trabalhos, PASTA_NOTAS_DOS_TRABALHOS
from .catalogo_trabalhos import (
    IDS_DAS_LIGACOES_COM_CANAL,
    TIPOS_DE_LIGACAO,
)

PASTA_DOS_CANAIS = 'Canais'

# Quanto de saída cabe num arquivo de canal. Ele vira contexto de prompt do
# outro lado, então o teto não é sobre disco — é sobre o que o outro lado
# consegue ler sem estourar a janela dele. Corta pelo COMEÇO: numa saída longa
# o que interessa é o fim, que é onde está a conclusão.
TETO_DO_CANAL = 24000

ROTULO_DO_TIPO = {l['id']: l['rotulo'] for l in TIPOS_DE_LIGACAO}
TIPO_TEM_CANAL = {l['id']: l['canal'] for l in TIPOS_DE_LIGACAO}
TIPO_E_DUPLO = {l['id']: l['duplo'] for l in TIPOS_DE_LIGACAO}

from .trabalhos_conexoes_contexto import TrabalhosConexoesContextoMixin
from .trabalhos_conexoes_gancho import TrabalhosConexoesGanchoMixin


# Este arquivo era 634 linhas e virou três, pelo teto de 500 da AMF:
#
#   trabalhos_conexoes.py            os canais, a espera e a porta da tela
#   trabalhos_conexoes_contexto.py   o que um nó LÊ quando começa
#   trabalhos_conexoes_gancho.py     o que acontece quando um nó TERMINA
#
# ⚠️ O ESTADO DAS ESPERAS E DAS RODADAS MORRE COM O PROGRAMA, de propósito, e
# fica aqui. Uma espera gravada em disco sobreviveria a um fechamento e
# dispararia um terminal na abertura seguinte, sem ninguém ter pedido.
class TrabalhosConexoesMixin(TrabalhosConexoesContextoMixin,
                             TrabalhosConexoesGanchoMixin):

    # ── O estado que morre com o programa ────────────────────────────────────

    # {(projeto, no): {'mensagem', 'motivo', 'desde'}} — quem não pôde disparar.
    _conx_esperas = None
    # {(projeto, ligacao): int} — quantas rodadas de ida e volta já correram.
    _conx_rodadas = None

    # ⚠️ AQUI UM LOCK EM MEMÓRIA É O CERTO, e não o engano que os outros módulos
    # de Trabalhos avisam contra. O `Estado.json` e o `Layout.json` precisam de
    # lock ENTRE PROCESSOS porque o servidor MCP roda fora do app; estes dois
    # dicionários existem só dentro deste processo e ninguém de fora os enxerga.
    #
    # O que ele protege é uma corrida real, e não teórica: dois terminais que
    # encerram no mesmo instante rodam duas threads que fazem "olhar a espera,
    # conferir a dependência, disparar". Sem serializar isso, as duas veem a
    # mesma espera cumprida e disparam o MESMO nó duas vezes — dois processos
    # no lugar de um, e o registro só guarda o segundo, deixando o primeiro sem
    # ninguém que consiga pará-lo.
    #
    # `RLock` e não `Lock` porque `_conx_ao_terminar` já o segura quando chama
    # `_conx_liberar`, que o pega de novo.
    _conx_lock = threading.RLock()

    def _conx_esperas_dict(self):
        if self._conx_esperas is None:
            self._conx_esperas = {}
        return self._conx_esperas

    def _conx_rodadas_dict(self):
        if self._conx_rodadas is None:
            self._conx_rodadas = {}
        return self._conx_rodadas

    # ── Os arquivos de canal ─────────────────────────────────────────────────

    def _conx_pasta_dos_canais(self, project_name):
        return obter_pasta_de_trabalhos(project_name, 'Oficina', PASTA_DOS_CANAIS)

    def _conx_caminho_do_canal(self, project_name, id_ligacao, id_origem):
        """O arquivo que UM lado escreve numa ligação.

        O nome carrega a ligação E quem escreve (`lig-x__no-y.md`) porque a ida
        e volta tem dois arquivos, um por sentido. Um nome só por ligação daria
        os dois lados escrevendo no mesmo arquivo — e aí a "ida e volta" viraria
        um dos dois apagando o outro.
        """
        return os.path.join(self._conx_pasta_dos_canais(project_name),
                            f'{id_ligacao}__{id_origem}.md')

    def _conx_canais_de(self, project_name, ligacao):
        """Os caminhos possíveis de uma ligação: um, ou dois se for duplo."""
        if not TIPO_TEM_CANAL.get(ligacao.get('tipo')):
            return []
        caminhos = [self._conx_caminho_do_canal(project_name, ligacao['id'], ligacao['de'])]
        if TIPO_E_DUPLO.get(ligacao['tipo']) and ligacao.get('para'):
            caminhos.append(
                self._conx_caminho_do_canal(project_name, ligacao['id'], ligacao['para']))
        return caminhos

    def _conx_apagar_canais(self, project_name, ligacoes):
        """Some com os arquivos de ligações que deixaram de existir.

        ⚠️ Chamado SEMPRE fora da transação de layout. O lock entre processos
        não é reentrante, e apagar arquivo não precisa dele: o canal só é lido
        por quem tem a ligação, e a ligação já não existe mais.
        """
        for ligacao in (ligacoes or []):
            for caminho in self._conx_canais_de(project_name, ligacao):
                try:
                    if os.path.isfile(caminho):
                        os.remove(caminho)
                except Exception:
                    # Arquivo preso por outro processo não pode derrubar a
                    # exclusão do nó, que já aconteceu. Fica como resíduo.
                    pass

    def _conx_ao_excluir_nos(self, project_name, ids, orfas):
        """Limpeza depois de apagar nós: canais órfãos e esperas guardadas."""
        self._conx_apagar_canais(project_name, orfas)
        for id_no in (ids or []):
            self._conx_esperas_dict().pop((project_name, id_no), None)

    # ── Ler o andar sem transação ────────────────────────────────────────────

    def _conx_andar(self, project_name):
        """O andar corrente, só para leitura. Sem lock, como `carregar_oficina`."""
        layout = self._trab_carregar_layout(project_name)
        return self._trab_andar(layout)

    def _conx_nome(self, andar, id_no):
        no = self._trab_achar_no(andar, id_no)
        return (no or {}).get('nome') or id_no

    # ── Dependência: quem segura o disparo ───────────────────────────────────

    def _conx_dependencias_pendentes(self, project_name, andar, id_no):
        """As dependências deste nó que ainda não foram cumpridas.

        ⚠️ CUMPRIDA É "ENTREGOU", não "não está rodando". Um nó que nunca rodou
        também não está rodando, e liberar o dependente nesse caso faria a
        dependência não significar nada — a ordem que ela promete só existe se
        esperar de verdade.

        ⚠️ DEPENDÊNCIA QUE FALHOU CONTINUA PENDENTE, e é decisão, não descuido:
        seguir adiante sobre um pré-requisito que deu errado é justamente o que
        a ligação existe para impedir. O caminho de volta é rodar a origem de
        novo (a espera destrava sozinha) ou desconectar.
        """
        pendentes = []
        for l in andar['ligacoes']:
            if l.get('tipo') != 'dependencia' or l.get('para') != id_no:
                continue
            origem = l['de']
            estado = self._trab_estado_do_terminal(project_name, origem)
            if estado == 'entregue':
                continue
            motivos = {
                'fazendo': 'ainda está trabalhando',
                'aguardando': 'também está esperando uma dependência',
                'falhou': 'falhou — rode ele de novo ou desconecte',
                'parado': 'ainda não rodou',
                'perguntou': 'parou para perguntar',
            }
            pendentes.append({'id': origem, 'nome': self._conx_nome(andar, origem),
                              'motivo': motivos.get(estado, estado)})
        return pendentes

    def _conx_texto_da_espera(self, pendentes):
        partes = [f'{p["nome"]} ({p["motivo"]})' for p in pendentes]
        return 'Aguardando: ' + ', '.join(partes)

    def _conx_guardar_espera(self, project_name, id_no, mensagem, pendentes):
        self._conx_esperas_dict()[(project_name, id_no)] = {
            'mensagem': mensagem,
            'motivo': self._conx_texto_da_espera(pendentes),
            'desde': time.time(),
        }

    def _conx_espera_de(self, project_name, id_no):
        return self._conx_esperas_dict().get((project_name, id_no))

    def cancelar_espera(self, project_name, id_no):
        """Desiste da mensagem guardada de um nó que está aguardando.

        Existe porque a espera pode ser longa — uma dependência que falhou
        segura o dependente até alguém agir —, e sem esta porta o único jeito
        de soltar o nó seria "Parar tudo", que destrava os papéis de todo mundo
        junto.
        """
        try:
            saiu = self._conx_esperas_dict().pop((project_name, id_no), None)
            if saiu:
                self._ofi_registrar_linha(project_name, id_no, 'err',
                                          'Espera cancelada — a mensagem guardada foi descartada.')
                self._ofi_notify(project_name, id_no, {'status': 'espera', 'estado': 'parado'})
            return {'success': True, 'cancelada': bool(saiu)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _conx_liberar(self, project_name):
        """Dispara quem estava esperando e já pode ir.

        Roda depois de todo término. Uma passada por todos os que esperam, e
        não só pelos dependentes de quem acabou, porque um nó pode depender de
        vários: quem acabou pode ter sido o último de três, e é a passada
        inteira que descobre isso sem precisar montar o grafo ao contrário.
        """
        with self._conx_lock:
            esperando = [(p, n) for (p, n) in list(self._conx_esperas_dict().keys())
                         if p == project_name]
            if not esperando:
                return
            andar = self._conx_andar(project_name)
            for (_, id_no) in esperando:
                # ⚠️ TIRA DO DICIONÁRIO ANTES DE DECIDIR, e devolve se não for a
                # hora. É o que faz a espera ser reivindicada por uma thread só:
                # decidir primeiro e tirar depois deixa a janela em que duas
                # threads leem a mesma espera cumprida e disparam o mesmo nó.
                espera = self._conx_esperas_dict().pop((project_name, id_no), None)
                if not espera:
                    continue
                pendentes = self._conx_dependencias_pendentes(project_name, andar, id_no)
                if pendentes:
                    # Continua esperando, mas o motivo pode ter mudado — mostrar
                    # o motivo velho seria pior que não mostrar nenhum.
                    espera['motivo'] = self._conx_texto_da_espera(pendentes)
                    self._conx_esperas_dict()[(project_name, id_no)] = espera
                    continue
                self._ofi_registrar_linha(project_name, id_no, 'ent',
                                          'Dependência cumprida — começando.')
                self._ofi_disparar_com_dependencia_ok(project_name, id_no, espera['mensagem'])


    # ── A porta da tela: criar e desfazer ligação ────────────────────────────

    def conectar_nos(self, project_name, tipo, de, para=None):
        """Cria uma ligação — a persistência e o canal, juntos.

        Juntos porque separá-los daria a janela em que a ligação existe e o
        canal não: o outro lado leria um caminho que não existe, e concluiria
        que não recebeu nada em vez de que ainda não foi escrito.
        """
        try:
            r = self._trab_criar_ligacao(project_name, tipo, de, para)
            if not r.get('success'):
                return r
            if TIPO_TEM_CANAL.get(tipo):
                os.makedirs(self._conx_pasta_dos_canais(project_name), exist_ok=True)
            return r
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def desconectar(self, project_name, ids_das_ligacoes):
        """Apaga ligações e os arquivos de canal delas."""
        try:
            saiu = self._trab_excluir_ligacoes(project_name, ids_das_ligacoes)
            self._conx_apagar_canais(project_name, saiu)
            for l in saiu:
                self._conx_rodadas_dict().pop((project_name, l['id']), None)
            return {'success': True, 'removidas': len(saiu)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def desconectar_nos(self, project_name, ids_dos_nos):
        """Tira TODA ligação que toca os nós selecionados.

        É o botão "Desconectar" da barra contextual: quem selecionou dois nós
        quer soltar os dois, e não escolher ligação por ligação numa lista.
        """
        try:
            andar = self._conx_andar(project_name)
            ids = set(ids_dos_nos or [])
            alvos = [l['id'] for l in andar['ligacoes']
                     if l.get('de') in ids or l.get('para') in ids]
            if not alvos:
                return {'success': True, 'removidas': 0}
            return self.desconectar(project_name, alvos)
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def resumo_das_ligacoes_dos_nos(self, project_name, ids_dos_nos):
        """O que exatamente se perde ao desconectar — para o modal dizer.

        Existe porque "Desconectar" apaga arquivo de canal junto, e a regra do
        projeto é que a confirmação diga o que se perde, com número. Sem isto o
        modal perguntaria "tem certeza?" sobre uma quantidade que ninguém sabe.
        """
        try:
            andar = self._conx_andar(project_name)
            ids = set(ids_dos_nos or [])
            saida = []
            for l in andar['ligacoes']:
                if l.get('de') not in ids and l.get('para') not in ids:
                    continue
                descricao = (f'{self._conx_nome(andar, l["de"])} → '
                             f'{self._conx_nome(andar, l["para"])}')
                saida.append({
                    'id': l['id'],
                    'tipo': ROTULO_DO_TIPO.get(l['tipo'], l['tipo']),
                    'descricao': descricao,
                    'tem_canal': bool(TIPO_TEM_CANAL.get(l['tipo'])),
                })
            return {'success': True, 'ligacoes': saida}
        except Exception as e:
            return {'success': False, 'error': str(e)}
