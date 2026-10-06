"""A conta corrente de leitura de uma tarefa, mantida PELO PROGRAMA.

Por que existe: sem ela o sistema não termina. O subagente é stateless entre
chamadas — lê a parte 1, não acha, lê a 2, não acha, acaba o orçamento de
rodadas, volta ao orquestrador, é mandado de novo, e relê a 1 e a 2. Com 40
partes no resumo de pastas contra 12 chamadas de ferramenta no melhor caso, o
artefato é grande demais para uma chamada só, SEMPRE. Sem memória entre as
chamadas, o laço não fecha.

Nada disto depende de o subagente relatar coisa alguma. A resposta dele é texto
livre e não precisa ser confiável: quem serve a parte é o programa, então quem
sabe qual parte foi servida é o programa.

O que entra, e só isto:
  1. leitura de artefato DIVIDIDO — qual parte, de quantas (é o anti-laço);
  2. erro, com o motivo curto — errar custa ~5x acertar;
  3. nada mais. Leitura completa e bem-sucedida não gera linha: não sobrou o
     que ler, e o achado já está na resposta do subagente.

Critério único: entra o que o orquestrador precisa PARA DECIDIR A PRÓXIMA
CHAMADA.

⚠️ O bloco é ACUMULADO E SUBSTITUÍDO, nunca empilhado: um bloco só, de tamanho
constante na rodada 3 ou na 30. E a conta já vem feita ("faltam 36", não a
lista crua) — o orquestrador também é um modelo de linguagem, e a regra é não
dar conta de cabeça para a peça que pode errar.
"""

META_TIPO = 'rastro_leitura'

CABECALHO = '[LEITURA DA TAREFA — acumulado pelo programa]'

# Quantas linhas de erro cabem no bloco. O resto vira uma linha de contagem: o
# bloco existe para o orquestrador saber onde NÃO insistir, e para isso os oito
# caminhos mais repetidos bastam — a lista inteira só o faria crescer sem fim.
MAX_LINHAS_ERRO = 8

# Um ícone por artefato, para o orquestrador distinguir as linhas de relance.
ICONES = {
    'índice de navegação': '🧭',
    'pipeline': '🔀',
    'grafo de imports': '🕸️',
    'resumo de pastas': '📂',
}


class RastroDeLeitura:
    """Uma instância por TAREFA — não por rodada, não por subagente.

    No Chat a tarefa é a mensagem do usuário sendo respondida, com todas as
    rodadas dela; na Fila é a tarefa da fila. É esse recorte que faz a conta
    fazer sentido: "faltam 36" só significa alguma coisa dentro de uma pergunta.
    """

    def __init__(self):
        # artefato -> {'total': n, 'lidas': [índices, na ordem em que vieram]}
        self._lidas = {}
        # (ferramenta, alvo, motivo) -> quantas vezes
        self._erros = {}

    # ── Registro ─────────────────────────────────────────────────────────────
    def registrar_parte(self, artefato, indice, total):
        """Uma parte servida. `indice` é 1-based, `total` é quantas existem."""
        entrada = self._lidas.setdefault(artefato, {'total': total, 'lidas': []})
        entrada['total'] = total
        if indice not in entrada['lidas']:
            entrada['lidas'].append(indice)

    def registrar_erro(self, ferramenta, alvo, motivo):
        """Um erro de ferramenta. Repetição vira contagem, não linha nova."""
        # Só a primeira linha, e sem o prefixo "ERRO:" — o bloco inteiro já é
        # uma lista de erros, e o texto longo com a lista de sugestões dentro
        # dele é para o SUBAGENTE se corrigir, não para o orquestrador. Aqui
        # basta saber que aquele caminho não vai dar certo.
        motivo = (motivo or '').strip().split('\n')[0]
        for prefixo in ('ERRO inesperado em ', 'ERRO: '):
            if motivo.startswith(prefixo):
                motivo = motivo[len(prefixo):]
                break
        if len(motivo) > 80:
            motivo = motivo[:77] + '...'
        # `str(alvo or '')`: o alvo vem de um parâmetro que o MODELO escreveu, e
        # nada garante que seja string — `{"parte": 3}` é plausível. Um int aqui
        # levantava AttributeError no `.strip()`, de dentro de um `except`, e
        # matava a chamada inteira do subagente. Quem chama já converte, mas a
        # trava fica também aqui: esta função é chamada de mais de um lugar, e o
        # próximo chamador não tem como saber disso.
        chave = (ferramenta, str(alvo or '').strip(), motivo)
        self._erros[chave] = self._erros.get(chave, 0) + 1


    # ── Ida e volta do estado (a retomada) ───────────────────────────────────
    # ⚠️ Uma instância vive em MEMÓRIA e morre quando o envio acaba. O que fica
    # gravado no histórico é o texto do bloco — e o bloco é SUBSTITUÍDO a cada
    # rodada. Sem estes dois métodos, retomar uma conversa começa com a conta
    # zerada: na primeira parte lida depois de retomar, o bloco novo (que só tem
    # essa leitura) come o acumulado, o orquestrador volta a achar que não leu
    # nada e manda reler as partes 1, 2, 3, 4 — gastando exatamente as rodadas
    # que o usuário acabou de conceder, que é o laço que esta classe existe para
    # evitar.
    #
    # O estado viaja no `meta` da mensagem, em NÚMERO CRU. Reconstruí-lo
    # interpretando o texto do bloco foi avaliado e descartado: o formato já
    # mudou uma vez (quando ganhou o limite de linhas de erro), e um leitor de
    # texto quebraria em silêncio na próxima.
    def dados(self):
        """Os números crus, prontos para virar JSON no `meta` da mensagem."""
        return {
            'lidas': {artefato: {'total': d['total'], 'lidas': list(d['lidas'])}
                      for artefato, d in self._lidas.items()},
            # As chaves de `_erros` são tuplas, que não sobrevivem a JSON como
            # chave de dicionário. Viram par [chave, contagem].
            'erros': [[list(chave), vezes] for chave, vezes in self._erros.items()],
        }

    @classmethod
    def de_meta(cls, dados):
        """Uma conta corrente reidratada do que ficou gravado no `meta`.

        Tolerante de propósito: histórico antigo não tem estes campos, e um
        rastro vazio é degradação aceitável — o que não é aceitável é estourar.
        """
        rastro = cls()
        if not isinstance(dados, dict):
            return rastro
        for artefato, d in (dados.get('lidas') or {}).items():
            if not isinstance(d, dict):
                continue
            lidas = [i for i in (d.get('lidas') or []) if isinstance(i, int)]
            rastro._lidas[artefato] = {'total': int(d.get('total') or 0),
                                       'lidas': lidas}
        for par in (dados.get('erros') or []):
            try:
                chave, vezes = par
                ferramenta, alvo, motivo = chave
            except (TypeError, ValueError):
                continue
            rastro._erros[(ferramenta, alvo, motivo)] = int(vezes or 1)
        return rastro

    # ── Saída ────────────────────────────────────────────────────────────────
    def vazio(self):
        return not self._lidas and not self._erros

    def bloco(self):
        """O bloco pronto para o histórico, ou None se não há o que contar."""
        if self.vazio():
            return None
        linhas = [CABECALHO]

        largura = max((len(a) for a in self._lidas), default=0)
        for artefato in sorted(self._lidas):
            dados = self._lidas[artefato]
            total = dados['total']
            lidas = dados['lidas']
            faltam = max(total - len(lidas), 0)
            icone = ICONES.get(artefato, '📄')
            rotulo = artefato.ljust(largura)
            numeros = ', '.join(str(i) for i in lidas)
            # ⚠️ Os dois pontos depois de "lidas" não são enfeite. Sem eles,
            # uma parte só saía como `lidas 5 de 40`, e as duas leituras são
            # possíveis: "li a parte 5" ou "li cinco partes". Quem lê é o
            # modelo que decide a próxima chamada; entendendo errado, ele pula
            # partes ou repete. `lidas: 5` não tem como virar "cinco lidas".
            linhas.append(f'  {icone} {rotulo}  lidas: {numeros}'
                          f'    faltam {faltam} de {total}')

        # As linhas de artefato já são limitadas por natureza — um artefato, uma
        # linha. As de erro não eram: cada caminho novo errado abria uma linha, e
        # num teste real passaram de doze. Isso desmontava a promessa do bloco,
        # que é ter o MESMO tamanho na rodada 3 e na 30. As mais repetidas vêm
        # primeiro porque são as que o modelo está insistindo em errar.
        erros = sorted(self._erros.items(), key=lambda kv: (-kv[1], kv[0]))
        for (ferramenta, alvo, motivo), vezes in erros[:MAX_LINHAS_ERRO]:
            repeticao = f' ({vezes}×)' if vezes > 1 else ''
            alvo_txt = f' "{alvo}"' if alvo else ''
            linhas.append(f'  ✗ {ferramenta}{alvo_txt} — {motivo}{repeticao}')

        sobra = len(erros) - MAX_LINHAS_ERRO
        if sobra > 0:
            linhas.append(f'  ✗ … e mais {sobra} caminho(s) que não deram certo.')

        return '\n'.join(linhas)
