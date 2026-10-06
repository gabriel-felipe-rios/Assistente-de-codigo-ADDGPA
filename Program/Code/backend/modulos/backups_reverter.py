"""Reverter uma Versão — e as quatro naturezas que decidem o que volta.

Reverter deixou de ser "troca tudo pelo que estava lá". O que a reversão faz
com um arquivo depende da **natureza** dele, não de preferência do usuário — e
é por isso que a sub-aba Configuração mostra esta tabela como **informação, sem
nenhum interruptor**:

| Natureza | O que a reversão faz |
|---|---|
| Documentação gerada | **volta** |
| Configuração | **não volta** |
| Trabalho | **não volta, e nada é apagado** |
| Estado transitório | **zera** |

Mais a regra que vale acima de todas:

⚠️ **O QUE A VERSÃO NÃO GUARDOU, A REVERSÃO NÃO TOCA.** É genérica de
propósito, e não é sobre `.venv`: se uma pasta ficou fora da cópia — porque
estava na lista de exclusões, porque não existia ainda, porque deu erro de
leitura —, a reversão passa ao largo dela. Apagar o que nunca se prometeu
guardar é a forma mais rápida de um backup destruir trabalho.

Não é preciso invalidar os hashes depois de reverter: a Doc. Técnica compara o hash
do arquivo *atual* com o guardado, então qualquer reversão já faz os dois
deixarem de bater, e a rotina regera sozinha.
"""

from .constantes import *
from . import versoes
from . import backups_diff
from .agentes.trava_ia import TRAVA_IA, TravaOcupada, DONO_BACKUP


# ── As quatro naturezas ──────────────────────────────────────────────────────
# Os caminhos são relativos a `Files/projects/{Projeto}/`, com `/`. Pasta
# termina em `/` e vale para tudo abaixo dela.
#
# `zera` significa apagar o arquivo, não restaurá-lo: o estado transitório da
# Fila e as pendências das Rotinas descrevem uma execução que já não existe —
# restaurar seria mandar o programa retomar um trabalho de outro momento.
NATUREZAS = [
    {
        'id': 'documentacao-gerada',
        'rotulo': 'Documentação gerada',
        'acao': 'volta',
        'explicacao': 'É o retrato do código naquele momento — tem de acompanhar o código.',
        'caminhos': ['Automação/Rotinas/', 'Análise/Índice de Símbolos.json'],
    },
    {
        'id': 'configuracao',
        'rotulo': 'Configuração',
        'acao': 'nao-volta',
        'explicacao': 'É escolha sua, não estado do código. Voltar desfaria ajustes que você fez depois.',
        'caminhos': ['Projeto/Workspace.json', 'Automação/Acionamentos.json',
                     'Automação/Rotinas/Configuração.json',
                     'Assistente/Designer/Preferências.json'],
    },
    {
        'id': 'trabalho',
        'rotulo': 'Trabalho',
        'acao': 'nao-volta-nem-apaga',
        'explicacao': 'Conversa é histórico, não estado. Nada aqui volta, e nada aqui é apagado.',
        'caminhos': ['Assistente/Chat/', 'Assistente/Designer/Conversas/',
                     'Assistente/Fila/Histórico/', 'Assistente/Fila/Log/',
                     'Assistente/Fila/Relatórios/'],
    },
    {
        'id': 'estado-transitorio',
        'rotulo': 'Estado transitório',
        'acao': 'zera',
        'explicacao': 'Descreve uma execução que já não existe. Restaurar mandaria o programa retomar trabalho de outro momento.',
        'caminhos': ['Assistente/Fila/Estado.json', 'Automação/Rotinas/Pendências.json'],
    },
]

REGRA_GENERICA = ('O que a Versão não guardou, a reversão não toca — '
                  'nem restaura, nem apaga.')

# A tabela é lida de baixo para cima: `Automação/Rotinas/Configuração.json` é
# configuração, mesmo estando dentro de `Automação/Rotinas/`, que é documentação
# gerada. O casamento mais ESPECÍFICO vence, e por isso a ordenação é por
# comprimento do caminho, não pela ordem da lista.
_REGRAS = sorted(
    [(c, n['acao']) for n in NATUREZAS for c in n['caminhos']],
    key=lambda par: len(par[0]), reverse=True)


def natureza_de(caminho):
    """A ação que a reversão faz com este caminho relativo.

    O que não casa com nenhuma regra volta — é o caso de um artefato novo que
    ainda não entrou na tabela, e documentação gerada é o padrão da metade.
    """
    for prefixo, acao in _REGRAS:
        if prefixo.endswith('/'):
            if caminho.startswith(prefixo):
                return acao
        elif caminho == prefixo:
            return acao
    return 'volta'


class BackupsReverterMixin:
    """Reverter a Versão inteira, ou um arquivo só."""

    # ── A tabela que a tela repete ───────────────────────────────────────────

    def naturezas_da_reversao(self, project_name=None):
        """A tabela informativa. Sem interruptor — depende da natureza, não de gosto."""
        return {'success': True, 'naturezas': NATUREZAS,
                'regra_generica': REGRA_GENERICA}

    # ── Reverter ─────────────────────────────────────────────────────────────

    def reverter_versao(self, project_name, versao_id, escopo='tudo',
                        restaurar_configuracao=False, rede_de_seguranca=True):
        """Assíncrono. Avisa por `bkAoTerminarReversao` ou `bkAoFalhar`."""
        def worker():
            r = self._reverter_versao_sync(project_name, versao_id, escopo,
                                           restaurar_configuracao, rede_de_seguranca)
            # `project` no payload/argumento: o front ignora o evento quando
            # este projeto não é o exibido no momento (várias abas abertas).
            if r.get('success'):
                self.window.evaluate_js('bkAoTerminarReversao(%s)' % json.dumps({
                    'project': project_name,
                    'rede': r.get('rede'),
                    'codigo': r.get('codigo', 0),
                    'documentacao': r.get('documentacao', 0),
                    'zerados': r.get('zerados', 0),
                }))
            else:
                self.window.evaluate_js('bkAoFalhar(%s, %s)'
                                        % (json.dumps(project_name), json.dumps(r.get('error', 'erro'))))
        threading.Thread(target=worker, daemon=True).start()
        return {'started': True}

    def _reverter_versao_sync(self, project_name, versao_id, escopo='tudo',
                              restaurar_configuracao=False, rede_de_seguranca=True):
        versao = versoes.carregar_versao(project_name, versao_id)
        if not versao:
            return {'success': False, 'error': 'Versão não encontrada.'}
        try:
            with TRAVA_IA.ocupar(DONO_BACKUP, projeto=project_name, esperar=False):
                # A rede de segurança fotografa o estado atual ANTES de qualquer
                # escrita. Se ela falhar, nada é revertido — reverter sem rede é
                # exatamente o momento em que a rede faria falta.
                # `_bk_montar_versao` e não `_criar_versao_sync`: a trava já
                # está na mão, e `ocupar(esperar=False)` reentrante recusaria a
                # si mesmo. Quem toma a trava é o método público de cada lado.
                rede = None
                if rede_de_seguranca:
                    r = self._bk_montar_versao(
                        project_name,
                        'Estado salvo automaticamente antes de reverter para %s'
                        % versao_id,
                        'seguranca', False)
                    if not r.get('success'):
                        return {'success': False,
                                'error': 'Falha ao criar a rede de segurança: %s'
                                         % r.get('error', '')}
                    rede = r.get('versao')

                feitos = {'codigo': 0, 'documentacao': 0, 'zerados': 0}
                if escopo in ('tudo', 'codigo'):
                    feitos['codigo'] = self._bk_reverter_codigo(project_name, versao)
                if escopo in ('tudo', 'documentacao'):
                    doc = self._bk_reverter_documentacao(
                        project_name, versao, restaurar_configuracao)
                    feitos['documentacao'] = doc['restaurados']
                    feitos['zerados'] = doc['zerados']

                return {'success': True, 'rede': rede, **feitos}
        except TravaOcupada as ocupada:
            return {'success': False, 'ocupado': True,
                    'error': (ocupada.estado or {}).get('motivo', 'há tarefa rodando')}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Código ───────────────────────────────────────────────────────────────

    def _bk_reverter_codigo(self, project_name, versao):
        """Devolve cada pasta de trabalho ao estado da Versão.

        Além de reescrever o que a Versão guardou, apaga o que **surgiu depois**
        dentro do território que ela cobre — senão um arquivo criado após a
        cópia sobreviveria à reversão e o resultado não seria o estado daquele
        momento.

        O "território que ela cobre" é a parte importante: só se apaga dentro
        de uma pasta que a Versão de fato visitou. Pasta que ficou de fora da
        cópia não é varrida, pela regra genérica lá do topo.
        """
        codigo = versao.get('codigo') or {}
        raizes = {rotulo: raiz
                  for rotulo, raiz in self._bk_raizes_de_codigo(project_name)}
        total = 0
        for rotulo, raiz in raizes.items():
            prefixo = rotulo + '/'
            mapa = {c[len(prefixo):]: h for c, h in codigo.items()
                    if c.startswith(prefixo)}
            if not mapa:
                continue
            self._bk_apagar_surgidos(raiz, mapa)
            total += versoes.restaurar(project_name, mapa, raiz)
        return total

    def _bk_apagar_surgidos(self, raiz, mapa):
        """Apaga, dentro das pastas que a Versão cobriu, o que ela não tem."""
        cobertas = {os.path.dirname(rel.replace('/', os.sep)) for rel in mapa}
        guardados = {rel.replace('/', os.sep) for rel in mapa}
        for sub in sorted(cobertas):
            pasta = os.path.join(raiz, sub) if sub else raiz
            if not os.path.isdir(pasta):
                continue
            for nome in os.listdir(pasta):
                caminho = os.path.join(pasta, nome)
                if not os.path.isfile(caminho):
                    continue
                rel = os.path.relpath(caminho, raiz)
                if rel not in guardados:
                    try:
                        os.remove(caminho)
                    except OSError:
                        pass

    # ── Documentação ─────────────────────────────────────────────────────────

    def _bk_reverter_documentacao(self, project_name, versao, restaurar_configuracao):
        """Aplica as quatro naturezas, arquivo por arquivo."""
        base = obter_pasta_de_dados(project_name)
        documentacao = versao.get('documentacao') or {}

        a_restaurar = {}
        for caminho, hash_ in documentacao.items():
            acao = natureza_de(caminho)
            if acao == 'volta':
                a_restaurar[caminho] = hash_
            elif acao == 'nao-volta':
                # Configuração só volta se o usuário marcar o checkbox à parte,
                # que nasce DESMARCADO e diz o que desfaz.
                if restaurar_configuracao:
                    a_restaurar[caminho] = hash_
            # 'nao-volta-nem-apaga' (Trabalho) não faz nada, de propósito.

        restaurados = versoes.restaurar(project_name, a_restaurar, base)

        # Estado transitório: zera o que a Versão guardou — e SÓ o que ela
        # guardou, pela regra genérica.
        zerados = 0
        for caminho in documentacao:
            if natureza_de(caminho) != 'zera':
                continue
            alvo = os.path.join(base, caminho.replace('/', os.sep))
            if os.path.isfile(alvo):
                try:
                    os.remove(alvo)
                    zerados += 1
                except OSError:
                    pass
        return {'restaurados': restaurados, 'zerados': zerados}

    # ── Um arquivo só ────────────────────────────────────────────────────────

    # ⚠️ AQUI HAVIA `voltar_arquivo`, e ele foi RETIRADO por decisão do
    # usuário — não esquecido. Era o back-end do botão "↩ Voltar só este
    # arquivo" da Árvore do Mapa da mudança: uma escrita pontual no disco,
    # **sem rede de segurança**, a um clique de distância, dentro de uma tela
    # cuja função é *olhar*. Reverter mora na sub-aba Versões, que pede
    # confirmação, mostra o que vai mexer e sabe das naturezas. Não recriar.
    #
    # `_bk_destino` ficou: quem usa é a reversão inteira.

    def _bk_destino(self, project_name, caminho, metade):
        """Onde um caminho da Versão aterrissa no disco de agora."""
        if metade == 'documentacao':
            return obter_pasta_de_dados(project_name), caminho
        for rotulo, raiz in self._bk_raizes_de_codigo(project_name):
            prefixo = rotulo + '/'
            if caminho.startswith(prefixo):
                return raiz, caminho[len(prefixo):]
        return None, caminho

    # ── O trecho que a Árvore abre ───────────────────────────────────────────

    def diff_do_arquivo(self, project_name, versao_de, versao_ate, caminho,
                        metade='codigo'):
        """O diff unificado de um arquivo entre duas Versões (ou contra o disco).

        ⚠️ Binário e arquivo grande demais **não** vão ao `difflib` — o motivo
        é devolvido por escrito e a tela o mostra no lugar do trecho. Ver
        `backups_diff.comparavel`: um `.db` de 9,6 MB virava 152 mil fatias e
        segurava a interface por minutos.

        ⚠️ **MOVIDO E RENOMEADO PRECISAM DOS DOIS MAPAS INTEIROS.** Olhando um
        caminho só, `backups_diff.situacao` não tem como saber que o arquivo
        que sumiu daqui reapareceu ali: ela devolveria `criado` ou `removido`,
        e a tela mostraria um diff do arquivo inteiro contra o vazio para algo
        que não mudou uma linha. Por isso o cruzamento de `parear_movidos` é
        refeito aqui, com os mesmos mapas que o Mapa da mudança desenhou.
        """
        try:
            self._bm_comecar()
            mapa_antes, _ = self._bm_lado(project_name, versao_de, metade)
            mapa_agora, absolutos = self._bm_lado(project_name, versao_ate, metade)
            hash_antes = mapa_antes.get(caminho)
            hash_agora = mapa_agora.get(caminho)

            if versao_ate == backups_diff.VERSAO_ATUAL:
                absoluto = absolutos.get(caminho)
                dados_agora = backups_diff.carregar_bytes(project_name, None, absoluto)
            else:
                dados_agora = backups_diff.carregar_bytes(project_name, hash_agora)

            dados_antes = backups_diff.carregar_bytes(project_name, hash_antes)

            # Mudou de lugar e não de conteúdo: não há diff nenhum para mostrar,
            # e um trecho vazio seria lido como "não mudou nada". O que mudou
            # está no CAMINHO, e é isso que a tela diz.
            pares = backups_diff.parear_movidos(mapa_antes, mapa_agora)
            achado = pares.get(caminho)
            if achado:
                est, par = achado
                indo = caminho in mapa_agora
                return {'success': True, 'caminho': caminho, 'situacao': est,
                        'par': par, 'contagem': {'mais': 0, 'menos': 0},
                        'binario': False, 'trecho': [],
                        'motivo': '%s — o conteúdo é idêntico, só o caminho mudou.\n%s'
                                  % (est.capitalize(),
                                     ('veio de %s' % par) if indo else ('foi para %s' % par))}

            situacao = backups_diff.situacao(hash_antes, hash_agora)

            pode, motivo = backups_diff.comparavel(dados_antes, dados_agora)
            if not pode:
                return {'success': True, 'caminho': caminho, 'situacao': situacao,
                        'par': '', 'contagem': {'mais': 0, 'menos': 0},
                        'binario': True, 'motivo': motivo, 'trecho': []}

            antes = dados_antes.decode('utf-8', errors='replace')
            agora = dados_agora.decode('utf-8', errors='replace')
            return {'success': True,
                    'caminho': caminho,
                    'situacao': situacao,
                    'par': '',
                    'binario': False, 'motivo': '',
                    'contagem': backups_diff.contar(antes, agora),
                    'trecho': backups_diff.trecho(antes, agora)}
        except Exception as e:
            return {'success': False, 'error': str(e)}
