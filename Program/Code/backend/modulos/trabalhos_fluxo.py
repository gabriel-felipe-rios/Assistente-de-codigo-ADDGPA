"""A ordem e a dependência entre as ATIVIDADES — e o histórico por execução.

⚠️ ESTA TELA PLANEJA, NÃO OBSERVA, e a diferença é a decisão que a criou. Ela
NÃO desenha telemetria ao vivo: não mostra qual terminal chamou qual, nem quem
está falando com quem agora. O que ela desenha é o que foi combinado — quais
atividades existem, qual espera qual, e em que estado cada uma está no Quadro.
Quem quiser "quanto tempo cada terminal passou trabalhando" tem a Linha do
tempo, que é outra pergunta e outra tela.

⚠️ NÃO CONFUNDIR COM AS LIGAÇÕES DA OFICINA. São dois grafos diferentes, e de
propósito:

    Fluxo (aqui) ....... entre ATIVIDADES do Quadro (`A-1` espera `A-2`),
                         escrito pelo Orquestrador via `trabalhos_anotar`,
                         guardado em `depende_de` no `Estado.json`
    Oficina ............ entre NÓS do canvas (terminais, notas), desenhado pelo
                         usuário à mão, guardado em `Layout.json`

Uma diz o que precisa acontecer antes do quê; a outra, quais processos travam e
o que passa dado entre eles. Juntá-las faria a mesma linha significar duas
coisas dependendo de onde se olha.

⚠️ A PROFUNDIDADE É CALCULADA AQUI, e as coordenadas não. Profundidade e ordem
são semântica de grafo — a mesma para qualquer tela que desenhe isto — enquanto
largura de caixa e espaço entre colunas são decisão de CSS. Devolver pixel daqui
prenderia o desenho a um tamanho de fonte que o backend não conhece.

⚠️ O CÁLCULO SOBREVIVE A CICLO. `trabalhos_anotar` recusa uma atividade que
depende de si mesma, mas NÃO recusa um ciclo indireto (`A-1` → `A-2` → `A-1`):
essa checagem não existe hoje na ferramenta de MCP. Se um ciclo entrar, o
cálculo de profundidade por recursão ingênua rodaria para sempre e a aba
travaria sem mensagem nenhuma. Por isso ele é iterativo, com marcação de
visitados — e ainda avisa quais atividades estão no ciclo, para o usuário poder
desfazer.

## As execuções

D45 pede uma entrada por sessão do Orquestrador na barra lateral. Uma
"execução" aqui começa quando o terminal do Orquestrador dispara e não há
nenhuma aberta, e termina no "Parar tudo" — que já é, desde a Fase 2, o único
caminho de volta depois que um papel trava. Não há outro momento em que o
programa saiba, com certeza, que a sessão anterior acabou.

⚠️ CADA UMA MORA EM ARQUIVO PRÓPRIO, nunca dentro do `Estado.json`. É o mesmo
princípio que separa o histórico da Fila do estado dela: o que cresce a cada
evento não pode dividir arquivo com o que se reescreve inteiro a cada mudança.

⚠️ ENQUANTO ABERTA, A EXECUÇÃO NÃO GUARDA CÓPIA DO GRAFO — ela mostra o Quadro
vivo, lido na hora. Isso não é economia: quem escreve no Quadro é o servidor
MCP, que roda em OUTRO processo do sistema operacional, e o app não tem como
saber que uma atividade mudou para tirar uma foto. Congelar o grafo no
fechamento é o único momento em que o app tem certeza de estar vendo o estado
final daquela sessão.
"""

import os
import re
from datetime import datetime

from .caminhos import obter_pasta_de_trabalhos
from .catalogo_trabalhos import COLUNAS_DO_QUADRO
from .trabalhos_estado import gravar_json_atomico, travar_entre_processos

PASTA_DOS_FLUXOS = 'Fluxos'

# `flx-0007.json` — o número no NOME do arquivo, com zeros à esquerda, para a
# listagem por nome já sair na ordem certa sem abrir arquivo nenhum.
_RE_ARQUIVO = re.compile(r'^flx-(\d{4,})\.json$')
# ⚠️ O padrão é ancorado nos dois lados: sem isso o `_fluxos.lock` e um
# `flx-0001.json.tmp` deixado por uma queda no meio da gravação entrariam na
# lista como se fossem execuções.

COR_DA_COLUNA = {c['id']: c['cor'] for c in COLUNAS_DO_QUADRO}
ROTULO_DA_COLUNA = {c['id']: c['rotulo'] for c in COLUNAS_DO_QUADRO}

# As colunas em que uma atividade já não espera mais ninguém. Serve para dizer
# se uma dependência foi cumprida — a mesma leitura que a Oficina faz com
# "entregue", só que aqui o fato mora na coluna, e não num processo.
COLUNAS_CUMPRIDAS = ('revisar',)


def _agora():
    return datetime.now().isoformat(timespec='seconds')


class TrabalhosFluxoMixin:

    # ── Os arquivos das execuções ────────────────────────────────────────────

    def _flx_pasta(self, project_name):
        return obter_pasta_de_trabalhos(project_name, PASTA_DOS_FLUXOS)

    def _flx_caminho(self, project_name, numero):
        return os.path.join(self._flx_pasta(project_name), 'flx-%04d.json' % numero)

    def _flx_tranca(self, project_name):
        """UM lock para a pasta inteira, e não um por execução.

        `travar_entre_processos` cria um `.lock` irmão que nunca é apagado — de
        propósito, porque apagá-lo é uma corrida em si. Um por execução encheria
        `Trabalhos/Fluxos/` de arquivos de zero byte, e essa é uma pasta que o
        usuário abre (o botão "Abrir a pasta" leva até ela). O prefixo `_` é a
        convenção do projeto para arquivo de controle dentro de pasta de
        conteúdo.

        Um lock só também não custa nada em contenção: quem escreve aqui é
        sempre o app, e sempre uma execução por vez.
        """
        return travar_entre_processos(os.path.join(self._flx_pasta(project_name), '_fluxos'))

    def _flx_arquivos(self, project_name):
        pasta = self._flx_pasta(project_name)
        if not os.path.isdir(pasta):
            return []
        achados = []
        for nome in os.listdir(pasta):
            m = _RE_ARQUIVO.match(nome)
            if m:
                achados.append((int(m.group(1)), os.path.join(pasta, nome)))
        # Mais recente primeiro: é o que a barra lateral mostra em cima, e é
        # quase sempre o que o usuário quer ver.
        return sorted(achados, reverse=True)

    def _flx_ler(self, caminho):
        import json
        try:
            with open(caminho, 'r', encoding='utf-8') as f:
                d = json.load(f)
            return d if isinstance(d, dict) else None
        except Exception:
            # Uma execução ilegível não pode derrubar a lista inteira: o
            # histórico das outras continua válido, e é o que o usuário veio ver.
            return None

    def listar_fluxos_de_execucao(self, project_name):
        """A barra lateral: uma entrada por sessão do Orquestrador."""
        try:
            saida = []
            for numero, caminho in self._flx_arquivos(project_name):
                d = self._flx_ler(caminho)
                if not d:
                    continue
                saida.append({
                    'numero': numero,
                    'rotulo': 'Fluxo de execução %d' % numero,
                    'aberto_em': d.get('aberto_em'),
                    'fechado_em': d.get('fechado_em'),
                    'aberta': not d.get('fechado_em'),
                    'terminal': d.get('nome_do_no'),
                    'atividades': len(((d.get('grafo') or {}).get('atividades')) or []),
                })
            return {'success': True, 'execucoes': saida}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Abrir e fechar ───────────────────────────────────────────────────────

    def _flx_execucao_aberta(self, project_name):
        """A execução ainda sem fechamento, se houver. Só pode haver uma.

        Varre da mais nova para a mais velha e para na primeira fechada: uma
        aberta mais antiga que uma fechada seria estado corrompido, e continuar
        procurando abriria a porta para duas abertas ao mesmo tempo.
        """
        for numero, caminho in self._flx_arquivos(project_name):
            d = self._flx_ler(caminho)
            if not d:
                continue
            if d.get('fechado_em'):
                return None
            return {'numero': numero, 'caminho': caminho, 'dados': d}
        return None

    def _flx_garantir_execucao(self, project_name, no):
        """Abre uma execução se o Orquestrador começou e não havia nenhuma.

        ⚠️ SÓ O ORQUESTRADOR ABRE. Um Subagente disparando não é sessão nova —
        ele trabalha DENTRO da sessão que o Orquestrador conduz, e uma entrada
        por Subagente encheria a barra lateral de linhas que não respondem a
        pergunta nenhuma. Um nó sem papel também não abre: ele não conduz nada.

        Engole a exceção porque isto roda no caminho de disparar um terminal, e
        falhar em registrar histórico não pode impedir o trabalho de começar.
        """
        try:
            if (no or {}).get('papel') != 'orquestrador':
                return
            if self._flx_execucao_aberta(project_name):
                return
            numero = (self._flx_arquivos(project_name) or [(0, None)])[0][0] + 1
            caminho = self._flx_caminho(project_name, numero)
            os.makedirs(os.path.dirname(caminho), exist_ok=True)
            with self._flx_tranca(project_name):
                gravar_json_atomico(caminho, {
                    'numero': numero,
                    'aberto_em': _agora(),
                    'fechado_em': None,
                    'no': no.get('id'),
                    'nome_do_no': no.get('nome'),
                    # Nasce vazio: enquanto aberta, a execução mostra o Quadro
                    # vivo. A foto só é tirada no fechamento — ver o cabeçalho.
                    'grafo': None,
                })
        except Exception:
            pass

    def _flx_fechar_abertos(self, project_name):
        """Congela a execução aberta com o Quadro como ele está agora.

        Chamado pelo "Parar tudo", que é o fim de sessão que o programa
        conhece. Idempotente: sem execução aberta, não faz nada.
        """
        try:
            aberta = self._flx_execucao_aberta(project_name)
            if not aberta:
                return
            dados = aberta['dados']
            dados['fechado_em'] = _agora()
            dados['grafo'] = self._flx_montar_grafo(project_name)
            with self._flx_tranca(project_name):
                gravar_json_atomico(aberta['caminho'], dados)
        except Exception:
            pass

    # ── O grafo ──────────────────────────────────────────────────────────────

    def _flx_profundidades(self, atividades):
        """Em qual coluna do diagrama cada atividade cai, e quais estão em ciclo.

        Profundidade 0 = não espera ninguém. Profundidade N = uma a mais que a
        maior das dependências dela. É o que dá o desenho DETERMINÍSTICO que
        esta tela exige: o mesmo Quadro produz o mesmo desenho duas vezes
        seguidas, sem simulação de força e sem nada aleatório no meio.

        ⚠️ ITERATIVO, E NÃO RECURSIVO, por causa do ciclo. Um `A-1` que espera
        `A-2` que espera `A-1` faria a versão recursiva rodar para sempre — e o
        sintoma seria a aba congelando sem mensagem. Aqui o que está em ciclo é
        DETECTADO e devolvido, para a tela poder dizer quais são.
        """
        por_id = {a['id']: a for a in atividades}
        # Dependência para uma atividade que já não existe é ignorada: o
        # `excluir_atividade` limpa isso, mas um `Estado.json` mexido à mão ou
        # de uma versão antiga pode chegar com id pendurado.
        deps = {a['id']: [d for d in (a.get('depende_de') or []) if d in por_id]
                for a in atividades}

        profundidade = {}
        em_ciclo = set()

        # Kahn: quem não espera ninguém entra na camada 0; cada rodada libera
        # quem teve todas as dependências resolvidas. O que sobrar no fim está
        # num ciclo — é essa sobra que a detecção usa, sem busca extra.
        pendentes = dict(deps)
        camada = 0
        while pendentes:
            prontos = [i for i, ds in pendentes.items()
                       if all(d in profundidade for d in ds)]
            if not prontos:
                em_ciclo = set(pendentes)
                # Empurra o que está em ciclo para uma coluna própria, no fim,
                # em vez de deixá-lo sem posição: um nó sem posição some do
                # desenho, e sumir é a pior forma de avisar que há um problema.
                for i in pendentes:
                    profundidade[i] = camada
                break
            for i in prontos:
                profundidade[i] = (max((profundidade[d] for d in pendentes[i]), default=-1) + 1)
                pendentes.pop(i)
            camada = max(profundidade.values()) + 1
        return profundidade, em_ciclo

    def _flx_montar_grafo(self, project_name, atividades=None):
        """O grafo pronto para desenhar: nós com profundidade, ordem e estado."""
        if atividades is None:
            atividades = self._trab_carregar(project_name)['atividades']
        profundidade, em_ciclo = self._flx_profundidades(atividades)
        por_id = {a['id']: a for a in atividades}

        nos = []
        for a in atividades:
            deps = [d for d in (a.get('depende_de') or []) if d in por_id]
            # "Espera alguém" é fato do QUADRO, não de processo: a dependência
            # está cumprida quando a atividade de que se depende chegou em
            # Revisar. É a mesma leitura que o Quadro já dá ao usuário.
            pendentes = [d for d in deps
                         if por_id[d].get('coluna') not in COLUNAS_CUMPRIDAS]
            nos.append({
                'id': a['id'],
                'titulo': a.get('titulo') or a['id'],
                'coluna': a.get('coluna'),
                'rotulo_da_coluna': ROTULO_DA_COLUNA.get(a.get('coluna'), a.get('coluna')),
                'cor': COR_DA_COLUNA.get(a.get('coluna'), 'neutro'),
                'depende_de': deps,
                'espera': pendentes,
                'em_ciclo': a['id'] in em_ciclo,
                'profundidade': profundidade.get(a['id'], 0),
                'tarefas_feitas': sum(1 for t in (a.get('tarefas') or [])
                                      if t.get('estado') == 'feita'),
                'tarefas': len(a.get('tarefas') or []),
                'autoria': a.get('autoria'),
            })

        # ⚠️ A ORDEM DENTRO DA COLUNA É FIXA, e é o que fecha a promessa de
        # "desenha igual duas vezes". `sorted` por profundidade e por NÚMERO da
        # atividade (não pelo texto do id: `A-10` viria antes de `A-2`).
        nos.sort(key=lambda n: (n['profundidade'], _numero_do_id(n['id']), n['id']))
        for posicao, n in enumerate(nos):
            n['ordem'] = sum(1 for o in nos[:posicao]
                             if o['profundidade'] == n['profundidade'])

        return {'atividades': nos, 'ciclo': sorted(em_ciclo)}

    # ── A porta da tela ──────────────────────────────────────────────────────

    def carregar_fluxo(self, project_name, numero=None):
        """O diagrama, mais a lista da barra lateral.

        Sem `numero`, desenha o Quadro de AGORA. Com `numero`, desenha a foto
        daquela execução — ou o Quadro vivo, se ela ainda estiver aberta, que é
        o que "aberta" quer dizer.
        """
        try:
            lista = self.listar_fluxos_de_execucao(project_name)
            execucoes = lista.get('execucoes', []) if lista.get('success') else []

            escolhida = None
            if numero is not None:
                escolhida = next((e for e in execucoes if e['numero'] == numero), None)
                if escolhida is None:
                    return {'success': False,
                            'error': 'Não achei o fluxo de execução %s.' % numero}

            congelado = None
            if escolhida and not escolhida['aberta']:
                d = self._flx_ler(self._flx_caminho(project_name, numero)) or {}
                congelado = d.get('grafo')

            grafo = congelado or self._flx_montar_grafo(project_name)
            return {'success': True, 'grafo': grafo, 'execucoes': execucoes,
                    'numero': numero, 'ao_vivo': congelado is None,
                    'colunas': COLUNAS_DO_QUADRO}
        except Exception as e:
            return {'success': False, 'error': str(e)}


def _numero_do_id(id_atividade):
    """`A-12` → 12. Ordenar pelo texto poria `A-10` antes de `A-2`."""
    try:
        return int(str(id_atividade).split('-')[-1])
    except Exception:
        return 0
