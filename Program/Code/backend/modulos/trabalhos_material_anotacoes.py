"""Ler o que o AGENTE escreveu em `Anotações/<nó>/`.

O único material desta pasta que o programa LÊ em vez de escrever — e por isso
um arquivo próprio: os outros dois respondem "o que o agente precisa saber",
este responde "o que ele contou".

⚠️ O CARIMBO EXISTE PARA A TELA NÃO RELER TUDO. `_mat_carimbo_das_anotacoes`
devolve, por nó, quantas notas há e quão recente é a mais nova — o vigia da
Oficina compara dois carimbos e só busca o conteúdo quando algo mudou. Sem ele,
a tela releria a pasta inteira a cada poucos segundos, por nó.

⚠️ PASTA VAZIA NÃO É ERRO. Um nó cujo agente ainda não anotou nada devolve lista
vazia, e o cartão de anotações simplesmente não aparece.
"""

from .constantes import *


class TrabalhosMaterialAnotacoesMixin:

    # ── Ler o que o AGENTE escreveu ──────────────────────────────────────────

    # Quanto de uma anotação vai para a tela. O precedente é `_conx_saida_do_no`,
    # que corta a saída de um nó pelo mesmo motivo: a tira do canvas é um
    # relance, não um leitor de arquivo, e mandar 200 KB de markdown num laço
    # que roda a cada redesenho da Oficina custa em quem só queria ver o canvas.
    LIMITE_DA_ANOTACAO_NA_TELA = 4000

    # Quantos arquivos da pasta chegam à tela. Sem teto, uma pasta com 200
    # anotações vira 200 leituras A CADA redesenho da Oficina — e são onze os
    # gestos que redesenham. O que não cabe aqui é a LISTA DA COMBO BOX; o
    # arquivo continua no disco, inteiro, onde o agente o deixou.
    TETO_DE_ANOTACOES_NA_TELA = 20

    def _mat_anotacoes(self, project_name, no):
        """As anotações deste nó, da mais recente para a mais antiga. SÓ LÊ.

        ⚠️ ESTE MÓDULO NÃO ESCREVE EM `Anotações/`, E ESTA FUNÇÃO MENOS AINDA.
        O escritor de lá é o agente, com as ferramentas de arquivo dele, e é a
        invariante que o topo deste arquivo declara: um arquivo, um escritor.

        ⚠️ A PASTA É A MESMA QUE O PROMPT ANUNCIA — `_sh_slug(nome do nó)`, o
        mesmo cálculo de `_sh_gravar_prompt_do_papel`. Se a tela procurasse
        noutra pasta, nada apareceria e não haveria erro nenhum para investigar.

        ⚠️ DEVOLVE A LISTA, E NÃO SÓ A MAIS RECENTE. O nó de anotações do
        canvas tem uma combo box, e ela precisa das opções TODAS de uma vez:
        pedi-las uma a uma criaria uma segunda chamada por troca de opção, para
        um texto que já coube inteiro na primeira.

        Cada item traz `nome`, `quando` (mtime) e `texto`. Lista vazia é o caso
        NORMAL — a maioria dos nós nunca ganha uma anotação.
        """
        base = self._mat_caminho(project_name, PASTA_ANOTACOES_DOS_TRABALHOS,
                                 self._sh_slug(no.get('nome')))
        if not base:
            return []
        try:
            nomes = [n for n in os.listdir(base)
                     if os.path.isfile(os.path.join(base, n))]
            # A ordem é por MTIME, e não por nome: o agente escolhe o nome do
            # arquivo, e nada o obriga a ser ordenavel. A combo box abre na
            # primeira opção, então a primeira tem de ser a mais recente.
            nomes.sort(key=lambda n: os.path.getmtime(os.path.join(base, n)),
                       reverse=True)
        except Exception:
            # Pasta que não existe é o caso NORMAL: a maioria dos nós nunca
            # ganha uma anotação. Silêncio, não exceção — como no módulo todo.
            return []
        saida = []
        for nome in nomes[:self.TETO_DE_ANOTACOES_NA_TELA]:
            caminho = os.path.join(base, nome)
            try:
                quando = os.path.getmtime(caminho)
                with open(caminho, 'r', encoding='utf-8', errors='replace') as f:
                    texto = f.read()
            except Exception:
                # Um arquivo ilegível não derruba os outros: o agente pode estar
                # gravando ESTE neste instante, e perder a lista inteira por
                # causa dele faria o nó piscar para fora da tela.
                continue
            if len(texto) > self.LIMITE_DA_ANOTACAO_NA_TELA:
                # Corta pelo FIM, como `_conx_saida_do_no`: o que o agente escreveu
                # por último é o que interessa, e um corte mudo faria o usuário ler
                # metade achando que era o arquivo inteiro.
                texto = ('_(o começo foi cortado — o arquivo é maior do que cabe aqui)_\n\n'
                         + texto[-self.LIMITE_DA_ANOTACAO_NA_TELA:])
            saida.append({'nome': nome, 'quando': quando, 'texto': texto})
        return saida

    def _mat_carimbo_das_anotacoes(self, project_name, nos):
        """Um retrato BARATO das anotações: por nó, quantos arquivos e o mtime
        mais recente. É o que a tela compara para saber se vale redesenhar.

        ⚠️ ELA NÃO ABRE ARQUIVO NENHUM — só `listdir` e `getmtime`. É isso que a
        torna barata o bastante para rodar de segundos em segundos; no dia em
        que ela ler conteúdo, o conforto de "a anotação aparece sozinha" vira um
        problema de desempenho, e ninguém vai ligar as duas coisas.

        Nó sem pasta ou sem arquivo NÃO ENTRA no carimbo. É de propósito: assim
        a primeira anotação que o agente escrever já conta como mudança.
        """
        carimbo = {}
        for no in (nos or []):
            base = self._mat_caminho(project_name, PASTA_ANOTACOES_DOS_TRABALHOS,
                                     self._sh_slug(no.get('nome')))
            if not base:
                continue
            try:
                nomes = [n for n in os.listdir(base)
                         if os.path.isfile(os.path.join(base, n))]
                if not nomes:
                    continue
                recente = max(os.path.getmtime(os.path.join(base, n)) for n in nomes)
            except Exception:
                continue
            # Arredondado: o mtime volta com casas que o sistema de arquivos nem
            # garante, e uma diferença de microssegundo faria a tela se redesenhar
            # sozinha achando que algo mudou.
            carimbo[no.get('id')] = [len(nomes), round(recente, 3)]
        return carimbo
