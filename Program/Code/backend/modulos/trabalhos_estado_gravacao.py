"""A trava entre processos e a gravação atômica — o chão de tudo em Trabalhos.

Arquivo próprio porque SEIS módulos importam estas duas funções, e nenhum deles
quer o mixin: `arquivos_assistentes.py` (a cascata do rename), `trabalhos_config`,
`trabalhos_fluxo`, `trabalhos_layout_constantes`, `trabalhos_material` e
`trabalhos_verificacao`. Com elas dentro de `trabalhos_estado.py`, que passou a
compor dois mixins irmãos, qualquer um deles fecharia um ciclo.

⚠️ A TRAVA É ENTRE PROCESSOS, e não entre threads. O programa e o servidor MCP
são dois processos que escrevem os MESMOS arquivos — uma trava de thread não os
vê, e a corrida some do teste e volta em produção.

⚠️ GRAVAR É EM DOIS TEMPOS: escrever num temporário e trocar. Escrever direto no
arquivo final deixa um JSON truncado quando o programa cai no meio, e o Quadro
inteiro fica ilegível. `_substituir_teimosamente` existe porque no Windows a
troca falha se alguém estiver com o arquivo aberto — inclusive um antivírus.

⚠️ `trabalhos_estado.py` REEXPORTA tudo daqui. `from .trabalhos_estado import
gravar_json_atomico` continua funcionando nos seis; nenhum precisou mudar.
"""

"""Os cartões do Quadro — leitura, gravação e o lock que atravessa processos.

O desenho é o da Fila (`agentes/fila/estado.py`): uma lista de atividades com
status dentro de um `Estado.json`, mexida sempre por uma transação de
leitura-modificação-gravação. O que muda é a TRAVA, e a diferença não é de
estilo — é o que decide se o arquivo sobrevive.

⚠️ POR QUE O LOCK DA FILA NÃO SERVE AQUI. `_fila_state_lock` é um
`threading.RLock` em memória, e funciona porque a Fila tem UM escritor
possível: o processo do app. Trabalhos não tem essa garantia. O servidor MCP
Trabalhos (`server/trabalhos/servidor.py`) é lançado pelo CLI do assistente externo como processo
do SISTEMA OPERACIONAL separado — um por terminal aberto, e não há teto de
terminais. Um lock em memória do app não enxerga esses processos, e não
protege contra dois deles gravando no mesmo `Estado.json` ao mesmo tempo.

⚠️ ESTE É O PRIMEIRO LOCK ENTRE PROCESSOS DO PROJETO. Não havia molde para
copiar: os 78 usos de "lock" do código são todos `threading.*` em memória. O
que já existia era só a metade da escrita atômica — `editor.py` grava em
`.tmp` e chama `os.replace()`, e é de lá que sai a segunda metade daqui.

As duas metades resolvem problemas DIFERENTES, e uma sem a outra não basta:

    o lock       impede dois processos de MEXER ao mesmo tempo
                 (sem ele: um lê, o outro lê, os dois gravam, um sumiu)
    o `.replace` impede que uma queda no meio deixe arquivo truncado
                 (sem ele: o programa cai com o JSON meio escrito, e o
                  Quadro inteiro vira "arquivo inválido" na próxima leitura)

⚠️ A TRANSAÇÃO NÃO É REENTRANTE, ao contrário da Fila. O lock do Windows é por
handle, e cada entrada abre um handle novo: chamar `_trab_transacao` de dentro
de outro `_trab_transacao` na mesma thread trava até estourar o tempo. Se
precisar de duas mudanças juntas, faça as duas dentro do MESMO bloco.
"""

import json
import os
import time
from contextlib import contextmanager
from datetime import datetime

from .caminhos import (
    obter_arquivo_de_estado_dos_trabalhos,
    obter_pasta_de_trabalhos,
)
from .catalogo_trabalhos import (
    AUTORIA_ORQUESTRADOR,
    AUTORIA_USUARIO,
    COLUNA_DO_PORTAO,
    COLUNA_INICIAL,
    IDS_DAS_AUTORIAS,
    IDS_DAS_COLUNAS,
    IDS_DAS_TAGS,
)

# O programa é Windows-only (é o que permite `taskkill /F /T` em `terminal.py`
# e o que este módulo assume ao usar `msvcrt`). O import defensivo não é para
# suportar outro sistema: é para o arquivo continuar IMPORTÁVEL fora dele, e o
# erro aparecer na hora de travar, com nome, em vez de na carga do módulo.
try:
    import msvcrt
except ImportError:  # pragma: no cover — só fora do Windows
    msvcrt = None

# Quanto tempo esperar pela vez. Generoso de propósito: quem está do outro lado
# é uma transação curtíssima (ler, mexer numa lista, gravar), então 15 s só é
# atingido quando algo travou de verdade — e aí falhar é melhor que esperar
# para sempre, porque quem chama é uma ferramenta de MCP com o modelo parado
# esperando resposta.
ESPERA_MAXIMA_PELO_LOCK = 15.0
INTERVALO_ENTRE_TENTATIVAS = 0.05


class TrabalhosOcupado(RuntimeError):
    """Não deu para pegar o lock do `Estado.json` dentro do tempo.

    Levantada, e não engolida: um `Estado.json` que não pôde ser travado é um
    Quadro que não pode ser mexido, e responder "feito" seria a pior saída —
    o agente seguiria adiante achando que moveu o cartão.
    """


@contextmanager
def travar_entre_processos(caminho_do_arquivo, espera=ESPERA_MAXIMA_PELO_LOCK):
    """Segura o direito de mexer em `caminho_do_arquivo`, para TODO processo.

    A trava não é no arquivo em si — é num `.lock` irmão. Travar o próprio
    arquivo impediria o `os.replace()` da gravação atômica, que substitui o
    arquivo inteiro e invalidaria o handle travado no meio da operação.

    O `.lock` nasce vazio e nunca é apagado: apagá-lo é uma corrida em si (o
    processo A apaga entre o `open` e o `locking` do processo B, e os dois
    passam a travar arquivos diferentes com o mesmo nome). Um arquivo de zero
    byte por projeto é preço barato demais para valer a corrida.
    """
    if msvcrt is None:
        raise TrabalhosOcupado(
            'lock entre processos indisponível: `msvcrt` só existe no Windows.')

    caminho_do_lock = caminho_do_arquivo + '.lock'
    os.makedirs(os.path.dirname(caminho_do_lock), exist_ok=True)
    # 'a+b' cria se não existir e NÃO trunca se existir — 'w' apagaria o
    # arquivo de outro processo que já o está segurando.
    handle = open(caminho_do_lock, 'a+b')
    try:
        inicio = time.monotonic()
        while True:
            try:
                handle.seek(0)
                # LK_NBLCK devolve na hora em vez de esperar. O LK_LOCK do
                # próprio msvcrt já tenta 10 vezes sozinho, mas com intervalo
                # fixo de 1 s e teto de 10 s que não dá para configurar —
                # esperar na mão é o que deixa o tempo ser nosso.
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
                break
            except OSError:
                if time.monotonic() - inicio > espera:
                    raise TrabalhosOcupado(
                        'o Quadro está sendo gravado por outro processo há mais de '
                        f'{espera:.0f}s. Tente de novo em instantes.')
                time.sleep(INTERVALO_ENTRE_TENTATIVAS)
        try:
            yield
        finally:
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
    finally:
        handle.close()


def gravar_json_atomico(caminho, dados):
    """Grava por substituição: `.tmp` primeiro, `os.replace()` depois.

    Mesmo molde de `editor.py`, e pelo mesmo motivo declarado lá: uma queda no
    meio da escrita não pode deixar o arquivo truncado. `os.replace()` é
    atômico no mesmo volume — ou o arquivo é o velho inteiro, ou o novo
    inteiro, nunca metade de cada.
    """
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    temporario = caminho + '.tmp'
    with open(temporario, 'w', encoding='utf-8') as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)
    _substituir_teimosamente(temporario, caminho)


# Quanto se insiste no `os.replace()`, e de quanto em quanto.
TENTATIVAS_DE_SUBSTITUICAO = 12
INTERVALO_ENTRE_SUBSTITUICOES = 0.04


def _substituir_teimosamente(temporario, caminho):
    """`os.replace()` que insiste enquanto o Windows disser "acesso negado".

    ⚠️ NÃO É CONCORRÊNCIA DE ESCRITA — essa o `.lock` já resolve. É LEITURA.
    No Windows, `os.replace()` falha com `WinError 5` enquanto QUALQUER handle
    do destino estiver aberto, e o `open()` do Python não pede
    `FILE_SHARE_DELETE`. As leituras puras (`_trab_carregar_layout`,
    `_trab_carregar`) são de propósito sem lock, e a tela recarrega sozinha a
    cada ação — então uma dessas leituras cai em cima da gravação de vez em
    quando. O sintoma era exatamente esse: excluir um nó da Oficina falhava com
    `[WinError 5] Acesso negado: 'Layout.json.tmp' -> 'Layout.json'`, e só ÀS
    VEZES — assinatura de corrida, não de permissão.

    A janela dessas leituras é de milissegundos; meio segundo de insistência
    cobre com folga. Passado o teto, o erro sobe igual: engolir a falha aqui
    deixaria a gravação silenciosamente perdida, que é pior que o aviso.
    """
    for tentativa in range(TENTATIVAS_DE_SUBSTITUICAO):
        try:
            os.replace(temporario, caminho)
            return
        except PermissionError:
            if tentativa == TENTATIVAS_DE_SUBSTITUICAO - 1:
                raise
            time.sleep(INTERVALO_ENTRE_SUBSTITUICOES)


def _agora():
    return datetime.now().isoformat()
