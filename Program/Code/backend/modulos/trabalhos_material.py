"""TRABALHOS → o material que o AGENTE lê, na raiz do projeto do usuário.

O defeito que este módulo existe para consertar, nas palavras do sintoma: o
usuário pediu ao orquestrador para achar uma nota, e ele respondeu pedindo
permissão para ler **fora do diretório de trabalho**. Não era teimosia — tudo
que a Oficina escreve morava em `Files/projects/{Projeto}/Trabalhos/`, que é a
pasta do PROGRAMA, e o terminal abre na raiz do PROJETO. Entre os dois não
havia ponte.

A ponte é uma pasta `Trabalhos/` **dentro da raiz de código do usuário**, com
o material em Markdown. Ela nasce AO LADO do estado interno e nunca no lugar
dele: `Layout.json`, `Estado.json` e `Canais/` continuam onde estavam, e
`obter_pasta_de_trabalhos` não mudou uma linha.

⚠️ CADA ARQUIVO TEM EXATAMENTE UM ESCRITOR, e é a invariante que segura tudo
aqui. Este módulo escreve o `LEIA-ME.md`, o `Quadro.md`, o `Equipe.md` e as
`Notas/`; o agente escreve em `Anotações/<nó>/`, e em lugar nenhum mais. Dois
donos no mesmo arquivo é como se perde uma escrita sem ninguém notar — e o
Quadro já tem o caminho certo de escrita para o agente, que são as oito ações
de MCP, as únicas do sistema que gravam sob trava entre processos.

⚠️ O `Equipe.md` NÃO É A LISTA DOS AGENTES QUE EXISTEM. Essa o produto já
entrega sozinho, a partir de `.claude/agents/`. Escrevê-la de novo criaria uma
segunda verdade, que é exatamente o defeito contra o qual `catalogo_trabalhos`
avisa no topo dele: "a tela mostra uma regra que o hook não aplica, e ninguém
tem como notar". Aqui vai só **quem está ABERTO agora**, que é o que o
programa sabe e o produto não.

⚠️ NADA AQUI LEVANTA PARA CIMA. Um projeto sem raiz configurada simplesmente
não ganha a pasta, e o terminal abre como sempre abriu. Derrubar a abertura de
um terminal porque um arquivo de leitura não pôde ser escrito seria trocar um
incômodo por uma parede.
"""

import os
import time
from datetime import datetime

from .caminhos import (
    obter_pasta_de_trabalhos_no_projeto,
    ARQUIVO_LEIA_ME_DOS_TRABALHOS,
    ARQUIVO_QUADRO_DOS_TRABALHOS,
    ARQUIVO_EQUIPE_DOS_TRABALHOS,
    PASTA_NOTAS_DOS_TRABALHOS,
    PASTA_ANOTACOES_DOS_TRABALHOS,
    PASTA_ANEXOS_DOS_TRABALHOS,
)
from .catalogo_trabalhos import (
    COLUNAS_DO_QUADRO,
    TAGS_DAS_ATIVIDADES,
    PAPEIS_DE_TERMINAL,
)
from .trabalhos_estado import _substituir_teimosamente

# Quantos dias um print colado sobrevive em `Anexos/`.
#
# ⚠️ A PASTA ACUMULA PARA SEMPRE SE NINGUÉM APAGAR, e ficar sem decisão é a
# própria decisão de deixar crescer. Ela é descartável por definição: o print
# foi lido pelo assistente no instante em que foi colado, e o que importava
# dali já está na conversa. Trinta dias é folga larga para quem quiser voltar
# a um print antigo, e teto para quem cola dez por dia.
DIAS_DE_VIDA_DO_ANEXO = 30

from .trabalhos_material_textos import (
    TrabalhosMaterialTextosMixin, _AVISO_DE_GERADO,
)
from .trabalhos_material_anotacoes import TrabalhosMaterialAnotacoesMixin


# Este arquivo era 638 linhas e virou três, pelo teto de 500 da AMF:
#
#   trabalhos_material.py             onde a pasta fica, e quem manda regerar
#   trabalhos_material_textos.py      Equipe.md, Quadro.md e Notas/
#   trabalhos_material_anotacoes.py   ler o que o agente escreveu
#
# ⚠️ O PONTO ÚNICO DE REGERAÇÃO FICOU AQUI, e é ele que sabe QUEM tem a verdade
# sobre cada arquivo. Ver o aviso em `trabalhos_material_textos.py`: um
# regerador único chamado do fim de cada transação apagaria o `Equipe.md` toda
# vez que um agente movesse um cartão pelo MCP.
class TrabalhosMaterialMixin(TrabalhosMaterialTextosMixin,
                             TrabalhosMaterialAnotacoesMixin):

    # ── Onde ─────────────────────────────────────────────────────────────────

    def _mat_raiz(self, project_name):
        """A raiz de código do projeto, ou `None` se não houver.

        ⚠️ A MESMA ORIGEM QUE O TERMINAL USA (`_sub_root_folder`), e não uma
        segunda descoberta. O terminal abre o `cwd` por ali; se este módulo
        resolvesse a raiz por conta própria, bastaria um projeto configurado de
        um jeito estranho para o terminal abrir num lugar e o material ser
        escrito noutro — sem erro nenhum na tela, com o agente simplesmente não
        achando nada.
        """
        try:
            return self._sub_root_folder(project_name)
        except Exception:
            # Raiz não configurada é estado normal de um projeto novo, e não
            # falha: quem avisa sobre isso é a aba Trabalho, no momento certo.
            return None

    def _mat_caminho(self, project_name, *partes):
        raiz = self._mat_raiz(project_name)
        if not raiz:
            return None
        return obter_pasta_de_trabalhos_no_projeto(raiz, *partes)

    def _mat_pasta_de_anexos(self, project_name):
        return self._mat_caminho(project_name, PASTA_ANEXOS_DOS_TRABALHOS)

    # ── Escrever ─────────────────────────────────────────────────────────────

    def _mat_escrever(self, caminho, texto):
        """Grava por substituição, como `gravar_json_atomico` faz com os `.json`.

        O motivo é o mesmo dali, e aqui ele é ainda mais direto: do outro lado
        há um agente lendo o arquivo a qualquer instante. Meio arquivo é pior
        que arquivo velho — o velho pelo menos é coerente.
        """
        if not caminho:
            return False
        try:
            os.makedirs(os.path.dirname(caminho), exist_ok=True)
            temporario = caminho + '.tmp'
            with open(temporario, 'w', encoding='utf-8') as f:
                f.write(texto)
            _substituir_teimosamente(temporario, caminho)
            return True
        except Exception:
            return False

    # ── Obra 1 · a pasta ─────────────────────────────────────────────────────

    def _mat_garantir(self, project_name):
        """Cria a árvore e (re)escreve o `LEIA-ME.md`. Devolve a base, ou `None`.

        ⚠️ PASTA QUE JÁ EXISTE NÃO É SOBRESCRITA CALADA. `makedirs` com
        `exist_ok` não apaga nada, e os únicos arquivos regravados são os
        quatro que este módulo declara serem dele. Qualquer outra coisa que
        alguém tenha posto aí dentro fica exatamente onde está — inclusive uma
        `Trabalhos/` que já existia no projeto por outro motivo. O `LEIA-ME.md`
        diz isso em voz alta, para quem abrir a pasta e estranhar.
        """
        base = self._mat_caminho(project_name)
        if not base:
            return None
        try:
            for sub in ('', PASTA_NOTAS_DOS_TRABALHOS,
                        PASTA_ANOTACOES_DOS_TRABALHOS, PASTA_ANEXOS_DOS_TRABALHOS):
                os.makedirs(os.path.join(base, sub) if sub else base, exist_ok=True)
        except Exception:
            return None
        self._mat_escrever(os.path.join(base, ARQUIVO_LEIA_ME_DOS_TRABALHOS),
                           self._mat_texto_do_leia_me())
        return base

    def _mat_texto_do_leia_me(self):
        return f"""# Trabalhos — o material da Oficina

Esta pasta é escrita pelo programa para que o assistente que roda neste projeto
alcance o Quadro, as notas e a lista de quem está aberto **sem precisar ler
fora do diretório de trabalho**.

## Quem escreve o quê

| Arquivo | Escritor | Regerado quando |
|---|---|---|
| `{ARQUIVO_LEIA_ME_DOS_TRABALHOS}` | o programa | a pasta é criada ou conferida |
| `{ARQUIVO_QUADRO_DOS_TRABALHOS}` | o programa | um cartão muda, e ao abrir um terminal |
| `{ARQUIVO_EQUIPE_DOS_TRABALHOS}` | o programa | um terminal abre **ou** fecha |
| `{PASTA_NOTAS_DOS_TRABALHOS}/` | o programa | a nota é gravada, e ao abrir um terminal |
| `{PASTA_ANOTACOES_DOS_TRABALHOS}/` | **o agente** | quando ele quiser |
| `{PASTA_ANEXOS_DOS_TRABALHOS}/` | o programa | um print é colado num terminal |

## A regra, em uma linha

**O agente só escreve em `{PASTA_ANOTACOES_DOS_TRABALHOS}/<nome do nó>/`.**

Todo o resto é gerado, e uma edição à mão se perde na próxima geração sem
aviso. Para mudar o Quadro, o caminho é o outro: as ações de Trabalhos do MCP
(`trabalhos_criar`, `trabalhos_mover`, `trabalhos_marcar`…), que são as únicas
que gravam sob trava e não se atropelam quando dois terminais escrevem ao
mesmo tempo.

## Se você já tinha uma pasta `Trabalhos/` aqui

O programa **não apaga nada**. Ele cria as subpastas que faltam e regrava só os
arquivos da tabela acima. O que era seu continua seu — mas se algum tiver
exatamente um desses nomes, ele passa a ser sobrescrito, e o jeito de manter é
renomear.

`{PASTA_ANEXOS_DOS_TRABALHOS}/` é limpa sozinha: print com mais de
{DIAS_DE_VIDA_DO_ANEXO} dias é apagado.
"""


    # ── O ponto único de regeração ───────────────────────────────────────────

    # ⚠️ SÃO TRÊS GATILHOS SEPARADOS, E JUNTÁ-LOS QUEBRA O `Equipe.md` EM
    # SILÊNCIO. As oito ações do Quadro rodam no processo do SERVIDOR MCP, e o
    # registro de terminais vivos (`_sh_procs`) é de MEMÓRIA, do processo do
    # programa — de lá, `_sh_vivo` responde "fechado" para todo mundo, sempre.
    # Um `_mat_regerar` único chamado do fim de cada transação reescreveria o
    # `Equipe.md` como "nenhum terminal aberto" toda vez que um agente movesse
    # um cartão, e o sintoma seria o pior tipo: os terminais continuariam
    # abertos e conversando, e o arquivo que diz quem está aberto diria que não
    # há ninguém.
    #
    # Então cada arquivo é regerado por quem tem a verdade sobre ele:
    #   · `Quadro.md`  → o fim de cada transação do estado (qualquer processo)
    #   · `Equipe.md`  → abrir e fechar terminal (só o processo do programa)
    #   · `Notas/`     → a gravação da nota, e a abertura de um terminal
    #
    # ⚠️ E NENHUM DELES LEVANTA. São chamados de dentro de `abrir_shell` e do
    # fim de cada transação do Quadro; uma exceção aqui derrubaria a abertura
    # de um terminal ou a gravação de um cartão por causa de um arquivo que é
    # só leitura.

    def _mat_regerar_quadro(self, project_name):
        try:
            if not self._mat_garantir(project_name):
                return
            self._mat_escrever(
                self._mat_caminho(project_name, ARQUIVO_QUADRO_DOS_TRABALHOS),
                self._mat_texto_do_quadro(project_name))
        except Exception:
            pass

    def _mat_regerar_equipe(self, project_name):
        try:
            if not self._mat_garantir(project_name):
                return
            andar = self._conx_andar(project_name)
            self._mat_escrever(
                self._mat_caminho(project_name, ARQUIVO_EQUIPE_DOS_TRABALHOS),
                self._mat_texto_da_equipe(project_name, andar))
        except Exception:
            pass

    def _mat_regerar_notas(self, project_name):
        try:
            if not self._mat_garantir(project_name):
                return
            self._mat_gerar_notas(project_name, self._conx_andar(project_name))
        except Exception:
            pass

    def _mat_regerar_tudo(self, project_name):
        """Os três de uma vez — o que a abertura de um terminal precisa.

        Regerar a cada tecla digitada numa nota é desperdício; regerar só na
        abertura deixa o agente lendo coisa velha a sessão inteira. O meio é
        regerar nos EVENTOS, e a abertura de um terminal é o evento em que
        todos os três importam ao mesmo tempo: o agente vai ler os três nos
        primeiros segundos de vida.
        """
        self._mat_regerar_quadro(project_name)
        self._mat_regerar_equipe(project_name)
        self._mat_regerar_notas(project_name)

    # ── Obra 6 · a faxina de `Anexos/` ───────────────────────────────────────

    def _mat_limpar_anexos_velhos(self, project_name):
        """Apaga print com mais de `DIAS_DE_VIDA_DO_ANEXO` dias."""
        pasta = self._mat_pasta_de_anexos(project_name)
        if not pasta or not os.path.isdir(pasta):
            return
        limite = time.time() - DIAS_DE_VIDA_DO_ANEXO * 86400
        try:
            for nome in os.listdir(pasta):
                caminho = os.path.join(pasta, nome)
                try:
                    if os.path.isfile(caminho) and os.path.getmtime(caminho) < limite:
                        os.remove(caminho)
                except Exception:
                    pass
        except Exception:
            pass

    def _mat_novo_anexo(self, project_name, extensao):
        """O caminho de um print que acabou de ser colado, sem gravar nada.

        ⚠️ NOME COM DATA E HORA, e não `imagem(1).png`. Quem abre a pasta um
        mês depois precisa saber qual print é qual, e o contador não diz nada.
        O sufixo de milissegundos existe porque dois Ctrl+V no mesmo segundo
        são um gesto comum, não um caso raro.
        """
        pasta = self._mat_pasta_de_anexos(project_name)
        if not pasta:
            return None
        try:
            os.makedirs(pasta, exist_ok=True)
        except Exception:
            return None
        carimbo = datetime.now().strftime('%Y%m%d-%H%M%S-%f')[:-3]
        return os.path.join(pasta, f'print-{carimbo}.{extensao}')
