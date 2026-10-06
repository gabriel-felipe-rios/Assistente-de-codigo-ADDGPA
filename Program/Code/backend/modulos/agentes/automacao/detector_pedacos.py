"""O **fatiador** — um arquivo em pedaços delimitados por fronteira natural.

Um **pedaço** é uma fatia de arquivo cortada onde o próprio arquivo já se corta:
um cabeçalho de markdown, uma função, um bloco separado por linha em branco.

⚠️ **A CHAVE DO PEDAÇO É O NOME DA FRONTEIRA, NUNCA O NÚMERO DE ORDEM.** Com o
número, inserir uma função no meio de um arquivo mudaria a chave de todas as
seguintes: o programa concluiria que tudo mudou e reembedaria o arquivo inteiro
à toa, sem nada dar errado na tela. É a mesma regra que `partes_artefato.py` já
segue, e pelo mesmo motivo.

## Por que fatiar, e não subir o limite do modelo

Medido nesta máquina, por arquivo:

| Limite | Tempo |
|---|---|
| 512 tokens | **166 ms** |
| 1 024 | 478 ms |
| 2 048 | 1 466 ms |
| 4 096 | 4 878 ms |
| 8 192 | **17 055 ms** |

Atenção é O(n²): dobrar a janela custa quatro vezes mais. Um arquivo de 8 192
tokens numa passada só custa 17 s; em 16 pedaços de 512, 2,7 s; e com só um
pedaço alterado, 166 ms. **Fatiar é mais rápido e mais correto ao mesmo tempo.**

De brinde, a busca semântica passa a achar o trecho certo: até aqui cada `.md`
virava um vetor de meia página de uma seção só, e nada que estivesse no meio de
um arquivo longo era encontrado.
"""

from ...constantes import *
from ...tokens import contar_tokens
from ...treesitter import EXT_LANG, LINGUAGENS_SEM_CORPO, make_parser
from ..partes_artefato import dividir_por_cabecalho

# Fronteira sem nome próprio — o texto antes do primeiro cabeçalho, o miolo
# solto de um arquivo de configuração. Um nome fixo, e não um número, para não
# reintroduzir a ordem por outra porta.
_PED_PREAMBULO = '(início)'

# Extensões cujo corte é por bloco separado por linha em branco: não têm
# gramática no tree-sitter nem cabeçalho de markdown.
_PED_POR_BLOCO = ('.txt', '.json', '.yml', '.yaml', '.toml', '.ini', '.env')


class DetectorPedacosMixin:
    """Corta um texto em pedaços, e cada pedaço leva o nome da fronteira."""

    def _ped_limite(self):
        """Quantos tokens cabem num pedaço, de Configurações › Rotinas.

        ⚠️ **Não confundir com `embedding_truncar_tokens`**, de "Ferramentas dos
        subagentes": aquele é quanto o MODELO chega a ver de um texto que já
        chegou nele; este é de que tamanho o texto é cortado antes. Duas caixas
        para o mesmo número seria o erro que o projeto já consertou com o
        `parallel` — são perguntas diferentes.
        """
        try:
            return max(64, int(self.load_limites()['limites']['pedaco_tokens']))
        except Exception:
            return 512

    # ── A porta de entrada ──────────────────────────────────────────────────

    def _ped_fatiar(self, texto, caminho=''):
        """`[(nome, corpo, linhas)]` — o arquivo em pedaços.

        Nunca devolve lista vazia para texto não vazio: um arquivo sem fronteira
        nenhuma é um pedaço só, chamado `(início)`. Devolver vazio faria o
        arquivo sumir do índice sem nenhum aviso.
        """
        texto = texto or ''
        if not texto.strip():
            return []
        ext = os.path.splitext(caminho or '')[1].lower()

        if ext == '.md' or (not ext and texto.lstrip().startswith('#')):
            brutos = self._ped_por_cabecalho(texto)
        elif ext in _PED_POR_BLOCO:
            brutos = self._ped_por_bloco(texto)
        else:
            brutos = self._ped_por_simbolo(texto, ext) or self._ped_por_bloco(texto)

        limite = self._ped_limite()
        finais = []
        for nome, corpo in brutos:
            finais.extend(self._ped_partir_grande(nome, corpo, limite))
        # Nome repetido acontece — duas seções `## Notas` no mesmo arquivo, duas
        # funções de mesmo nome em classes diferentes. A chave tem que ser única
        # ou uma sobrescreve a outra em silêncio; o sufixo mantém o NOME como
        # raiz, que é o que importa para inserir no meio não deslocar nada.
        return self._ped_desambiguar(finais)

    # ── Os três cortes ──────────────────────────────────────────────────────

    @staticmethod
    def _ped_por_cabecalho(texto):
        """Markdown, por `## `. Reaproveita `dividir_por_cabecalho`, que já é
        o corte do Índice de Navegação e do Pipeline — um corte só, um lugar."""
        return list(dividir_por_cabecalho(texto, '## '))

    def _ped_por_simbolo(self, texto, ext):
        """Código, por função/classe. `[]` quando não há gramática ou símbolo.

        O que fica **fora** de qualquer símbolo — imports, constantes de módulo,
        a docstring do topo — vira o pedaço `(início)`. Sem isso, mudar uma
        constante de módulo não mudaria pedaço nenhum e a alteração seria
        invisível para a régua.
        """
        lang = EXT_LANG.get(ext)
        if not lang or lang in LINGUAGENS_SEM_CORPO:
            return []
        try:
            parser = self._det_parser(lang)
            if parser is None:
                return []
            raiz = parser.parse(texto.encode('utf-8', errors='replace')).root_node
        except Exception:
            return []

        from ...treesitter import linguagem_tem_simbolos, simbolo_do_no
        if not linguagem_tem_simbolos(lang):
            return []

        linhas = texto.split('\n')
        marcos = []
        pilha = [raiz]
        while pilha:
            node = pilha.pop()
            achado = simbolo_do_no(node, lang)
            if achado is not None:
                tipo, nome = achado
                if nome:
                    marcos.append((node.start_point[0], node.end_point[0],
                                   '%s::%s' % (tipo, nome)))
            pilha.extend(node.children)
        if not marcos:
            return []

        # Só os símbolos de topo: uma classe e seus métodos se sobrepõem, e
        # embedar os dois seria contar o mesmo texto duas vezes.
        marcos.sort(key=lambda m: (m[0], -m[1]))
        topo, fim_anterior = [], -1
        for ini, fim, nome in marcos:
            if ini > fim_anterior:
                topo.append((ini, fim, nome))
                fim_anterior = fim

        partes, cursor = [], 0
        for ini, fim, nome in topo:
            if ini > cursor:
                sobra = '\n'.join(linhas[cursor:ini]).strip()
                if sobra:
                    partes.append((_PED_PREAMBULO if not partes else
                                   'entre::' + nome, sobra))
            partes.append((nome, '\n'.join(linhas[ini:fim + 1])))
            cursor = fim + 1
        sobra = '\n'.join(linhas[cursor:]).strip()
        if sobra:
            partes.append(('(fim)', sobra))
        return partes

    @staticmethod
    def _ped_por_bloco(texto):
        """Qualquer outra coisa, por bloco separado por linha em branco.

        O nome do bloco é a **primeira linha não vazia dele**, aparada. É o mais
        perto de "fronteira com nome" que um `.txt` ou um `.ini` oferece — e
        continua sendo estável quando um bloco nasce no meio, que é o ponto.
        """
        partes, buffer = [], []

        def fecha():
            corpo = '\n'.join(buffer).strip()
            if corpo:
                cabeca = corpo.split('\n', 1)[0].strip()[:80] or _PED_PREAMBULO
                partes.append((cabeca, corpo))
            buffer.clear()

        for linha in texto.split('\n'):
            if not linha.strip():
                fecha()
            else:
                buffer.append(linha)
        fecha()
        return partes or [(_PED_PREAMBULO, texto.strip())]

    # ── O degrau que impede pedaço gigante ──────────────────────────────────

    @staticmethod
    def _ped_partir_grande(nome, corpo, limite):
        """Uma fronteira maior que o limite vira `nome`, `nome ·2`, `nome ·3`…

        O corte é **no fim de linha mais próximo**, nunca no meio de uma. E o
        sufixo carrega o nome da fronteira, então acrescentar texto no fim de
        uma seção longa não renomeia o começo dela.
        """
        linhas = corpo.split('\n')
        if contar_tokens(corpo) <= limite:
            return [(nome, corpo, len(linhas))]
        partes, atual, custo, n = [], [], 0, 1
        for linha in linhas:
            c = contar_tokens(linha) + 1
            if atual and custo + c > limite:
                bloco = '\n'.join(atual)
                partes.append((nome if n == 1 else '%s ·%d' % (nome, n),
                               bloco, len(atual)))
                n += 1
                atual, custo = [], 0
            atual.append(linha)
            custo += c
        if atual:
            partes.append((nome if n == 1 else '%s ·%d' % (nome, n),
                           '\n'.join(atual), len(atual)))
        return partes

    @staticmethod
    def _ped_desambiguar(pedacos):
        """Nome repetido ganha `#2`, `#3`… mantendo o nome como raiz."""
        vistos, saida = {}, []
        for nome, corpo, linhas in pedacos:
            vistos[nome] = vistos.get(nome, 0) + 1
            chave = nome if vistos[nome] == 1 else '%s #%d' % (nome, vistos[nome])
            saida.append((chave, corpo, linhas))
        return saida
