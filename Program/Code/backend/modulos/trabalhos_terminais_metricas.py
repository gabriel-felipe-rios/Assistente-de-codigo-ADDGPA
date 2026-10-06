"""O que a Linha do tempo e as Métricas leem — e a cota do produto.

⚠️ A COTA VEM DO PRÓPRIO CLI, quando ele a informa (`_ofi_ler_cota`), e não de
uma estimativa nossa. A contagem por `len(texto) // 4` que existe ao lado é
aproximação de saída, para a barra ter o que mostrar enquanto o número absoluto
não chega — não é a mesma coisa, e não deve virar a mesma.

⚠️ O RÓTULO DE UM NÓ SAI DO NÓ, com queda para o id. Um nó sem nome aparecendo
como id cru é feio, mas aparecer em branco é pior: a métrica fica sem dono.
"""

from .trabalhos_terminais_constantes import *


class TrabalhosTerminaisMetricasMixin:

    # ── O que a Linha do tempo e as Métricas leem ────────────────────────────

    def carregar_metricas(self, project_name):
        """Os números por terminal, já rotulados — para as DUAS telas.

        Uma chamada só serve as duas porque elas leem a mesma fonte e diferem
        só na pergunta que fazem. Dois endpoints quase iguais divergiriam no
        primeiro campo novo que uma delas precisasse.
        """
        try:
            from .catalogo_trabalhos import ESTADOS_DE_TERMINAL
            layout = self._trab_carregar_layout(project_name)
            por_no = {n['id']: n for n in self._trab_andar(layout)['nos']}
            metricas = self._ofi_metricas_por_no(project_name)

            terminais = []
            totais = {'chamadas': 0, 'segundos': 0.0,
                      'tokens_entrada': 0, 'tokens_saida': 0}
            arquivos = set()
            for id_no, m in metricas.items():
                no = por_no.get(id_no)
                terminais.append({
                    'id': id_no,
                    # O PAPEL quando o nó tem um; o nome livre quando não tem.
                    'rotulo': self._ofi_rotulo_do_no(no, id_no),
                    'cor': (no or {}).get('cor'),
                    'estado': m['estado'], 'chamadas': m['chamadas'],
                    'segundos': m['segundos'],
                    'tokens_entrada': m['tokens_entrada'],
                    'tokens_saida': m['tokens_saida'],
                })
                totais['chamadas'] += m['chamadas']
                totais['segundos'] += m['segundos']
                totais['tokens_entrada'] += m['tokens_entrada']
                totais['tokens_saida'] += m['tokens_saida']
                arquivos.update(m['arquivos'])

            # Os arquivos tocados vêm do LASTRO, e não do que o agente diz ter
            # tocado — é a mesma prova externa que a conferência sem IA usa.
            try:
                arquivos.update(self._trab_arquivos_com_lastro(project_name))
            except Exception:
                pass
            totais['arquivos'] = len(arquivos)
            totais['segundos'] = round(totais['segundos'], 1)

            terminais.sort(key=lambda t: -(t['tokens_entrada'] + t['tokens_saida']))
            return {'success': True, 'terminais': terminais, 'totais': totais,
                    'legenda': ESTADOS_DE_TERMINAL,
                    'cota': self._ofi_cota_do_produto()}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _ofi_rotulo_do_no(self, no, id_no):
        """O nome da raia/barra: o papel quando há um, o nome livre quando não."""
        if not no:
            return id_no
        if no.get('papel'):
            return no.get('nome') or ROTULO_DO_PAPEL.get(no['papel'], no['papel'])
        return no.get('nome') or id_no

    def _ofi_cota_do_produto(self):
        """Quanto da cota já foi — LIDO do CLI do produto, nunca calculado aqui.

        ⚠️ ESTE DADO VEM DE FORA DO PROGRAMA, e por isso ele pode simplesmente
        não existir. Só o produto sabe quanto ele cobrou; nada do que passa
        pelo cano permite derivar isso.

        Enquanto o produto configurado não declarar um comando de cota, devolve
        `disponivel: False` com o motivo, e a tela mostra o motivo. Inventar
        uma porcentagem plausível numa tela cujo assunto é custo seria o pior
        resultado possível: erraria, e ninguém teria como perceber.
        """
        produto = self._trab_produto_ativo()
        if not produto:
            return {'disponivel': False,
                    'motivo': 'Nenhum produto de assistente configurado.'}
        comando = (produto.get('comando_cota') or '').strip()
        if not comando:
            return {'disponivel': False,
                    'motivo': 'O produto "%s" nao tem um comando de cota configurado.'
                              % produto.get('nome')}
        try:
            saida = subprocess.run(comando, shell=True, capture_output=True,
                                   text=True, encoding='utf-8', errors='replace',
                                   timeout=15, env=self._ofi_ambiente())
            return self._ofi_ler_cota(saida.stdout or '')
        except Exception as e:
            return {'disponivel': False, 'motivo': 'Nao deu para ler a cota: %s' % e}

    _RE_COTA = None

    @staticmethod
    def _ofi_pct(valor):
        return None if valor is None else max(0, min(100, int(valor)))

    def _ofi_ler_cota(self, texto):
        """Extrai duas porcentagens da saída do CLI.

        Deliberadamente tolerante: a saída de um CLI de terceiro muda de versão
        para versão, e um parser rígido quebraria calado. Não achar é resposta
        legítima — devolve indisponível junto com o que o comando respondeu,
        para o usuário ver por que não deu.
        """
        import re
        if self._RE_COTA is None:
            type(self)._RE_COTA = re.compile(
                r'(di[\u00e1a]ri[ao]|daily|week|seman)\D{0,30}?(\d{1,3})\s*%', re.I)
        achados = {}
        for termo, valor in self._RE_COTA.findall(texto or ''):
            chave = 'semanal' if termo.lower().startswith(('week', 'seman')) else 'diaria'
            achados.setdefault(chave, int(valor))
        if achados:
            # ⚠️ O que não foi achado vira `None`, e NÃO zero. Uma saída que só
            # traz a cota diária não está dizendo que a semanal é 0% — e uma
            # barra vazia rotulada "0% usada" é uma afirmação falsa sobre
            # dinheiro. A tela omite o que vier `None`.
            return {'disponivel': True,
                    'diaria': self._ofi_pct(achados.get('diaria')),
                    'semanal': self._ofi_pct(achados.get('semanal'))}
        return {'disponivel': False,
                'motivo': 'O comando de cota respondeu, mas nao achei porcentagem: '
                          + (texto or '').strip()[:200]}


# Nome do papel a partir do id — usado pela Linha do tempo e pelas Métricas
# para rotular a raia de um nó COM papel. Nó sem papel usa o nome livre dele.
ROTULO_DO_PAPEL = {p['id']: p['rotulo'] for p in PAPEIS_DE_TERMINAL}
