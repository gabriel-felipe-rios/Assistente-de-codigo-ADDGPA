"""Plugin base — o laço de captura periódica.

`iniciar()` é chamado UMA VEZ no boot do programa (ver
`Program/Code/backend/modulos/plugins.py::_iniciar_plugins_ativos`), só
porque este arquivo existe na raiz do plugin e o plugin está ligado. Daqui
para frente o laço se auto-agenda com `threading.Timer` — a cada ciclo relê
o próprio estado (ligado + configuração) ANTES de fazer qualquer coisa, para
que desligar o plugin ou mudar a configuração pela tela faça efeito no
próximo ciclo, sem reiniciar o programa (D12/F19/F20 do briefing).

⚠️ O laço **sempre se reagenda**, inclusive com o plugin desligado — só
*pula a captura*. Isso é de propósito: `save_config_plugin`
(`modulos/plugins.py`) só grava o JSON de estado, e `_iniciar_plugins_ativos`
só roda no boot do programa. Se o `_ciclo` parasse de se reagendar ao ser
desligado, religar o plugin pela tela não ressuscitaria nada até o programa
reiniciar — que era o comportamento antigo, e ninguém percebia.

Regra central de todo plugin (`Como criar plugins.md`): só leitura fora da
própria pasta. Este arquivo lê `Workspace.json`, `Histórico.jsonl`,
`Estado.json` e `conversa.json` de cada projeto — artefatos que o próprio
programa já gerou — e grava só dentro de `files/` e `config/`, aqui dentro.

## O que mudou no formato (versão 2)

A versão 1 guardava um `calendario` que era **reconstruído do zero a cada
captura**, a partir do `mtime` dos arquivos que existiam naquele instante.
A soma dele batia sempre com o total de arquivos do projeto — porque não era
um histórico, era uma fatia do presente por data. Editar hoje um arquivo que
você mexeu dia 20 tirava um do dia 20; apagar um arquivo encolhia o dia dele,
retroativamente. **O passado era reescrito a cada 15 minutos.**

A versão 2 grava um log de mudanças **por dia**, que só cresce. O diff sai da
comparação entre a varredura nova e o baseline da anterior — comparação que a
versão 1 já fazia (para reaproveitar contagem de linha) e jogava fora.
"""

import os
import json
import glob
import time
import types
import threading
import importlib.util
from datetime import datetime


VERSAO_FORMATO = 2


# ── Onde as coisas ficam ─────────────────────────────────────────────────────

def _raiz_do_app():
    # Acha "Program/External/plugins/" no próprio caminho absoluto e sobe até
    # a raiz do app — funciona em qualquer profundidade dentro de plugins/ (o
    # plugin pode estar direto na raiz ou dentro de uma ou mais categorias
    # que o usuário criar), ao contrário de contar um número fixo de "..",
    # que quebraria assim que este plugin for movido pra dentro de uma.
    # Nunca um caminho absoluto escrito à mão.
    aqui = os.path.abspath(__file__)
    marcador = os.path.join('Program', 'External', 'plugins') + os.sep
    idx = aqui.find(marcador)
    if idx == -1:
        raise RuntimeError('plugin fora de Program/External/plugins/')
    return aqui[:idx]


def _pasta_do_plugin(*partes):
    raiz = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(raiz, *partes)


def _pasta_projetos():
    return os.path.join(_raiz_do_app(), 'Files', 'projects')


def _nome_seguro(projeto):
    """O nome literal da pasta do projeto, sem nenhum componente de caminho —
    é o que vira o nome da pasta de dados dentro de `files/`."""
    return os.path.basename(str(projeto or '').strip()) or 'projeto'


def _pasta_dados(projeto):
    return _pasta_do_plugin('files', _nome_seguro(projeto))


def _caminho_atual(projeto):
    return os.path.join(_pasta_dados(projeto), 'atual.json')


def _caminho_arquivos(projeto):
    return os.path.join(_pasta_dados(projeto), 'arquivos.json')


def _caminho_dia(projeto, dia):
    return os.path.join(_pasta_dados(projeto), 'dias', dia + '.json')


def _dias_capturados(projeto):
    """Os dias que já têm arquivo, em ordem. Só nomes — não abre nada."""
    pasta = os.path.join(_pasta_dados(projeto), 'dias')
    try:
        nomes = os.listdir(pasta)
    except OSError:
        return []
    return sorted(n[:-5] for n in nomes if n.endswith('.json'))


def _carregar_json(caminho, padrao=None):
    try:
        with open(caminho, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return padrao


def _gravar_json_atomico(caminho, dado):
    """`.tmp` + `os.replace()` — nunca `json.dump` direto no arquivo final,
    porque outro plugin pode estar lendo esse mesmo arquivo do disco a
    qualquer momento (D10 corrigido, Obra 4).

    ⚠️ No Windows o `os.replace` levanta `PermissionError` quando outro
    processo (antivírus, indexador, outro plugin lendo) tem o alvo aberto
    naquele instante — é transitório e some em milissegundos, então três
    tentativas curtas eliminam praticamente todos os casos. Sem o retry, uma
    varredura inteira era perdida por causa de um arquivo travado por 20 ms.
    """
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    tmp = caminho + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(dado, f, ensure_ascii=False, indent=2)
    ultimo_erro = None
    for _ in range(3):
        try:
            os.replace(tmp, caminho)
            return
        except PermissionError as e:
            ultimo_erro = e
            time.sleep(0.05)
    try:
        os.remove(tmp)
    except OSError:
        pass
    raise ultimo_erro


def _caminho_deste_plugin():
    """O caminho relativo deste plugin dentro de External/plugins/ (inclui
    categoria, se o usuário tiver organizado o plugin numa) — derivado da
    própria posição em disco, nunca escrito à mão: o nome/caminho da pasta
    pode mudar se o usuário reorganizar, e não há como o arquivo saber
    disso de outro jeito."""
    aqui = os.path.abspath(__file__)
    marcador = os.path.join('Program', 'External', 'plugins') + os.sep
    idx = aqui.find(marcador)
    if idx == -1:
        return None
    resto = aqui[idx + len(marcador):]
    return os.path.dirname(resto).replace(os.sep, '/')  # tira o "/plugin_boot.py"


CATEGORIAS_PADRAO = {
    'arquivos_e_linhas': True,
    'lista_de_arquivos': True,
    'mudancas_por_dia': True,
    'tempo_rotinas': True,
    'tempo_fila': True,
    'tempo_chat': True,
}
INTERVALO_PADRAO_MINUTOS = 15

# Mesmas pastas técnicas que "Animação do código" já ignora — ruído puro,
# nunca "código escrito por alguém".
_IGNORAR_TECNICAS = {'.git', 'node_modules', '__pycache__', '.venv', 'venv', 'dist', 'build'}


# ── Estado: ligado? e configuração própria ───────────────────────────────────

def _ligado():
    caminho = os.path.join(_raiz_do_app(), 'Program', 'Internal', 'config', 'plugins.json')
    config = _carregar_json(caminho, {}) or {}
    return bool((config.get(_caminho_deste_plugin()) or {}).get('ligado'))


def _caminho_config():
    return _pasta_do_plugin('config', 'configuracao.json')


def carregar_config():
    """Lê `config/configuracao.json`; se não existir ainda, grava o padrão
    de fábrica (15 min, todas as categorias ligadas) e devolve ele."""
    dado = _carregar_json(_caminho_config())
    if not isinstance(dado, dict):
        dado = {'intervalo_minutos': INTERVALO_PADRAO_MINUTOS,
                'categorias': dict(CATEGORIAS_PADRAO)}
        _gravar_json_atomico(_caminho_config(), dado)
        return dado
    dado.setdefault('intervalo_minutos', INTERVALO_PADRAO_MINUTOS)
    categorias = dict(CATEGORIAS_PADRAO)
    categorias.update(dado.get('categorias') or {})
    dado['categorias'] = categorias
    return dado


# ── O escopo do projeto (`Como criar plugins.md` › "pasta_projeto NÃO é o
# escopo do projeto") — copiado literalmente, nunca `ignorados.py`. ──────────

def _normalizar(caminho):
    return os.path.normcase(os.path.abspath(str(caminho)))


def _dentro_de(caminho, pasta):
    c, p = _normalizar(caminho), _normalizar(pasta)
    return c == p or c.startswith(p + os.sep)


def esconder(caminho, ignore_list, context_items):
    for item in (ignore_list or []):                    # aba "Remover"
        alvo = item.get('path') if isinstance(item, dict) else item
        if not alvo:
            continue
        tipo = item.get('type', 'folder') if isinstance(item, dict) else 'folder'
        recursivo = item.get('recursive', True) if isinstance(item, dict) else True
        if tipo == 'file':
            if _normalizar(caminho) == _normalizar(alvo):
                return True
        elif recursivo:
            if _dentro_de(caminho, alvo):
                return True
        elif _normalizar(os.path.dirname(caminho)) == _normalizar(alvo):
            return True
    for item in (context_items or []):                  # "Contexto sem leitura"
        alvo = item.get('path') if isinstance(item, dict) else None
        if alvo and _dentro_de(caminho, alvo):           # sempre recursivo
            return True
    return False


# ── Descobrir projetos e ler o workspace de cada um ──────────────────────────

def listar_projetos():
    padrao = os.path.join(_pasta_projetos(), '*', 'Projeto', 'Workspace.json')
    nomes = []
    for caminho in glob.glob(padrao):
        # .../Files/projects/{Projeto}/Projeto/Workspace.json
        nome = os.path.basename(os.path.dirname(os.path.dirname(caminho)))
        if nome:
            nomes.append(nome)
    return sorted(nomes)


def _carregar_workspace(projeto):
    caminho = os.path.join(_pasta_projetos(), projeto, 'Projeto', 'Workspace.json')
    dado = _carregar_json(caminho, {})
    return dado if isinstance(dado, dict) else {}


def _bases_de_varredura(workspace):
    """Só `working_folders`, nunca `root_folder` (D13). Descarta pasta
    aninhada em outra da lista, senão os arquivos dela entrariam duas vezes."""
    pastas = [p for p in (workspace.get('working_folders') or []) if os.path.isdir(p)]
    bases = []
    for p in sorted(pastas, key=len):
        if not any(_dentro_de(p, b) for b in bases):
            bases.append(p)
    return bases


def _prefixos_das_bases(bases):
    """O prefixo que abre o caminho relativo de cada base.

    ⚠️ **Sempre presente, mesmo com uma base só.** A versão 1 só prefixava
    quando havia mais de uma `working_folder` — o que significa que, no dia
    em que o usuário acrescentasse a segunda, TODA chave de TODO arquivo
    mudaria de uma vez (`x.py` viraria `Program/x.py`). Com o log de
    mudanças isso não é cosmético: o diff seguinte leria o projeto inteiro
    como apagado e recriado — centenas de "apagado" e "criado" num dia de
    zero trabalho. Prefixar sempre custa alguns caracteres por chave e
    elimina a classe de problema.

    Duas bases podem terminar no mesmo nome (`api/src` e `web/src`): aí a
    chave relativa colidiria e um arquivo sobrescreveria o outro em
    silêncio, alternando "apagado/criado" a cada captura. Quem colide ganha
    o nome da pasta-mãe junto; se ainda assim colidir, um contador.
    """
    contagem = {}
    for base in bases:
        nome = os.path.basename(base.rstrip(os.sep)) or 'raiz'
        contagem[nome] = contagem.get(nome, 0) + 1

    prefixos, usados = [], set()
    for base in bases:
        limpo = base.rstrip(os.sep)
        nome = os.path.basename(limpo) or 'raiz'
        if contagem.get(nome, 0) > 1:
            mae = os.path.basename(os.path.dirname(limpo))
            if mae:
                nome = mae + '/' + nome
        candidato, n = nome, 1
        while candidato in usados:
            n += 1
            candidato = '%s (%d)' % (nome, n)
        usados.add(candidato)
        prefixos.append(candidato)
    return prefixos


# ── A varredura: arquivos + linhas, reaproveitando o que não mudou (D12) ─────

def _medir_arquivo(caminho):
    """Devolve `(linhas, binario)` — uma leitura só, não duas.

    Contar "linhas" de um .png ou de um .lnk devolve um número que não
    significa nada, e pior: ele entraria na conta de linhas ganhas/perdidas
    do dia como se fosse código. Mas a peneira precisa de duas perguntas, não
    de uma.

    ⚠️ **Byte zero sozinho NÃO quer dizer binário.** Este projeto tem código
    que usa `'\\x00'` como separador de propósito — `const BM_SEP = '\\x00'`
    em `frontend/modulos/backups-mapa-ligacoes.js`, justamente por ser o único
    caractere que não pode aparecer num caminho de arquivo. Uma peneira só de
    byte zero marcava esses `.js` como binários: as linhas deles sumiam da
    contagem, e qualquer edição futura neles viraria um evento que não soma
    nada — invisível para quem lê o histórico.

    Então: se os primeiros 8 KB decodificam como UTF-8, é texto, byte zero ou
    não. Só é binário o que falha o UTF-8 **e** tem byte zero. O que falha o
    UTF-8 sem byte zero (texto em latin-1, por exemplo) segue como texto e é
    contado com `errors='replace'`, como sempre foi.
    """
    try:
        with open(caminho, 'rb') as f:
            amostra = f.read(8192)
    except OSError:
        return None, False

    try:
        amostra.decode('utf-8')
        binario = False
    except UnicodeDecodeError:
        # Um corte no meio de um caractere multibyte também levanta o erro; o
        # que separa disso é o byte zero, que texto de verdade não espalha.
        binario = b'\0' in amostra

    if binario:
        return None, True
    try:
        with open(caminho, 'r', encoding='utf-8', errors='replace') as f:
            return sum(1 for _ in f), False
    except OSError:
        return None, False


def _varrer_projeto(workspace, arquivos_anteriores):
    """Devolve {caminho_relativo: {'modificado', 'criado', 'linhas', 'binario'}}.

    Recontagem de linhas só para arquivo cujo `modificado` mudou desde a
    última captura — o resto reaproveita o valor salvo (D12)."""
    bases = _bases_de_varredura(workspace)
    prefixos = _prefixos_das_bases(bases)
    ignore_list = workspace.get('ignore_list')
    context_items = workspace.get('context_items')
    arquivos = {}
    vistos = set()
    for base, prefixo in zip(bases, prefixos):
        for raiz, subpastas, nomes in os.walk(base):
            subpastas[:] = [p for p in subpastas
                            if p not in _IGNORAR_TECNICAS and not p.startswith('.')
                            and not esconder(os.path.join(raiz, p), ignore_list, context_items)]
            for nome in nomes:
                caminho = os.path.join(raiz, nome)
                if esconder(caminho, ignore_list, context_items):
                    continue
                chave = _normalizar(caminho)
                if chave in vistos:
                    continue
                vistos.add(chave)
                try:
                    st = os.stat(caminho)
                except OSError:
                    continue
                modificado = st.st_mtime
                # No Windows (Python 3.11) `st_ctime` é a data de CRIAÇÃO de
                # verdade — não a de mudança de inode, como no Unix. O
                # `st_birthtime` só existe em alguns sistemas, então é ele
                # quando houver, `st_ctime` como reserva. Sai do mesmo
                # `os.stat` que a varredura já fazia: dado de graça.
                criado = getattr(st, 'st_birthtime', None) or st.st_ctime
                rel = prefixo + '/' + os.path.relpath(caminho, base).replace(os.sep, '/')
                anterior = arquivos_anteriores.get(rel)
                if anterior and anterior.get('modificado') == modificado:
                    linhas = anterior.get('linhas')
                    binario = bool(anterior.get('binario'))
                else:
                    linhas, binario = _medir_arquivo(caminho)
                registro = {'modificado': modificado, 'criado': criado, 'linhas': linhas}
                if binario:
                    registro['binario'] = True
                arquivos[rel] = registro
    return arquivos


# ── O diff: o que mudou entre a captura anterior e esta ──────────────────────

def _para_datahora(texto):
    try:
        return datetime.fromisoformat(str(texto))
    except (TypeError, ValueError):
        return None


def _datar(carimbo, inicio_janela, agora):
    """Em que dia o evento cai, e o quanto se pode confiar nisso.

    ⚠️ **O clamp na janela não é enfeite.** Datar pelo `mtime` do arquivo é o
    que faz o programa fechado por três dias registrar as mudanças nos dias
    certos, retroativamente — é o ganho principal. Só que `mtime` é
    preservado por cópia, `unzip`, `robocopy`, restauração de backup e por
    qualquer sync (OneDrive/Dropbox). Sem limite, despejar uma pasta antiga
    dentro de uma `working_folder` faria nascer `dias/2019-04-12.json` — dias
    inventados, e o log deixaria de ser "o que aconteceu" para virar "o que
    os metadados alegam".

    Dentro da janela `[captura anterior, agora]` o `mtime` é confiável, e o
    evento cai no dia dele. Fora dela — antigo demais, ou no futuro, que
    acontece quando o relógio do sistema anda para trás — o honesto é dizer
    "só sei que apareceu agora": dia da captura, `origem: "captura"`.
    """
    hoje = agora.date().isoformat()
    if carimbo is None:
        return hoje, 'captura'
    try:
        quando = datetime.fromtimestamp(carimbo)
    except (OSError, OverflowError, ValueError):
        return hoje, 'captura'
    if inicio_janela is not None and inicio_janela <= quando <= agora:
        return quando.date().isoformat(), 'mtime'
    return hoje, 'captura'


def _comparar(antes, depois, inicio_janela, agora):
    """A lista de mudanças entre dois retratos. Cada mudança já vem com o dia
    em que vai ser arquivada.

    Cada evento carrega DOIS tempos, e a diferença entre eles importa:

    - `quando` — o carimbo do próprio arquivo (`criado` = ctime, `editado` e
      `movido` = mtime). É o que o sistema de arquivos alega. `null` para
      `apagado`, que não tem o que alegar: o arquivo sumiu.
    - `visto_em` — a hora da captura que percebeu a mudança. Sempre presente.

    `origem` diz de qual dos dois saiu o dia em que o evento foi arquivado.

    ⚠️ `quando` NUNCA é substituído pela hora da captura, mesmo quando o
    clamp recusa o carimbo. Além de ser mais honesto (jogar fora o que o
    arquivo alega não melhora nada — `origem` já avisa que não se confia
    nele), é o que torna a **chave do dedupe estável**: se `quando` mudasse
    conforme a janela, a mesma edição reemitida com uma janela diferente
    geraria uma chave diferente e viraria evento duplicado em vez de ser
    absorvida.
    """
    agora_iso = agora.isoformat()
    mudancas = []

    for caminho, info in depois.items():
        anterior = antes.get(caminho)
        if anterior is None:
            dia, origem = _datar(info.get('criado'), inicio_janela, agora)
            evento = {'_dia': dia, 'tipo': 'criado', 'caminho': caminho,
                      'linhas': info.get('linhas'),
                      'quando': _iso_do_carimbo(info.get('criado')),
                      'visto_em': agora_iso, 'origem': origem,
                      '_modificado': info.get('modificado')}
            if info.get('binario'):
                evento['binario'] = True
            mudancas.append(evento)
        elif anterior.get('modificado') != info.get('modificado'):
            dia, origem = _datar(info.get('modificado'), inicio_janela, agora)
            evento = {'_dia': dia, 'tipo': 'editado', 'caminho': caminho,
                      'linhas': info.get('linhas'),
                      'linhas_antes': anterior.get('linhas'),
                      'quando': _iso_do_carimbo(info.get('modificado')),
                      'visto_em': agora_iso, 'origem': origem}
            if info.get('binario') or anterior.get('binario'):
                evento['binario'] = True
            mudancas.append(evento)

    for caminho, anterior in antes.items():
        if caminho in depois:
            continue
        # Arquivo apagado não tem carimbo nenhum para consultar — ele sumiu.
        # A única data honesta é a da captura que percebeu a ausência.
        evento = {'_dia': agora.date().isoformat(), 'tipo': 'apagado',
                  'caminho': caminho, 'linhas_antes': anterior.get('linhas'),
                  'quando': None, 'visto_em': agora_iso, 'origem': 'captura',
                  '_modificado': anterior.get('modificado')}
        if anterior.get('binario'):
            evento['binario'] = True
        mudancas.append(evento)

    return _parear_movidos(mudancas)


def _iso_do_carimbo(carimbo):
    if carimbo is None:
        return None
    try:
        return datetime.fromtimestamp(carimbo).isoformat()
    except (OSError, OverflowError, ValueError):
        return None


def _parear_movidos(mudancas):
    """Um "apagado" e um "criado" da MESMA captura, com mesmo nome de arquivo,
    mesmo tamanho em linhas e mesmo `modificado`, são o mesmo arquivo que
    mudou de pasta.

    Sem isso, reorganizar pastas vira o pior dia do gráfico: um projeto de
    8.000 linhas movido de lugar apareceria como −8.000 e +8.000 num dia em
    que ninguém escreveu uma linha. Três campos idênticos ao mesmo tempo é
    coincidência que não acontece na prática.
    """
    apagados = [m for m in mudancas if m['tipo'] == 'apagado']
    criados = [m for m in mudancas if m['tipo'] == 'criado']
    if not apagados or not criados:
        return mudancas

    def assinatura(m):
        return (os.path.basename(m['caminho']),
                m.get('linhas_antes') if m['tipo'] == 'apagado' else m.get('linhas'),
                m.get('_modificado'))

    por_assinatura = {}
    for m in apagados:
        chave = assinatura(m)
        if chave[1] is None or chave[2] is None:
            continue          # sem linhas ou sem mtime não dá para afirmar nada
        por_assinatura.setdefault(chave, []).append(m)

    pareados, movidos = set(), []
    for criado in criados:
        chave = assinatura(criado)
        candidatos = por_assinatura.get(chave)
        if not candidatos:
            continue
        apagado = candidatos.pop(0)
        pareados.add(id(criado))
        pareados.add(id(apagado))
        evento = {'_dia': criado['_dia'], 'tipo': 'movido',
                  'de': apagado['caminho'], 'para': criado['caminho'],
                  'linhas': criado.get('linhas'), 'quando': criado.get('quando'),
                  'visto_em': criado.get('visto_em'), 'origem': criado['origem']}
        if criado.get('binario'):
            evento['binario'] = True
        movidos.append(evento)

    return [m for m in mudancas if id(m) not in pareados] + movidos


# ── Arquivar as mudanças nos dias ────────────────────────────────────────────

def _chave_do_evento(ev):
    """A identidade de um evento, para não gravar o mesmo duas vezes.

    ⚠️ O dedupe não é enfeite do append: é o que torna segura a ordem de
    escrita (dias primeiro, baseline por último). Se o programa morrer entre
    as duas, a captura seguinte compara contra o MESMO baseline antigo e
    reemite exatamente os mesmos eventos — e é aqui que eles são absorvidos.
    Nada se perde, nada duplica.

    `apagado` e `movido` não entram com o `quando`: o carimbo deles é a hora
    da captura, que muda a cada tentativa, e usá-lo faria o replay virar
    duplicata em vez de ser absorvido.
    """
    tipo = ev.get('tipo')
    if tipo in ('movido', 'projeto_renomeado'):
        return (tipo, ev.get('de'), ev.get('para'))
    if tipo == 'apagado':
        return (tipo, ev.get('caminho'))
    return (tipo, ev.get('caminho'), ev.get('quando'))


def _limpar_evento(mudanca):
    """Tira os campos de trabalho (`_dia`, `_modificado`) — eles são da
    mecânica do diff, não fazem parte do contrato público. `binario` NÃO é um
    deles: ele precisa sobreviver no disco, senão o recálculo do fechamento
    (que relê os eventos já gravados) voltaria a somar as "linhas" de um .png."""
    return {chave: valor for chave, valor in mudanca.items() if not chave.startswith('_')}


def _delta_de_linhas(ev):
    """(ganhas, perdidas, desconhecido) de um evento.

    `linhas: null` NUNCA vira zero: um arquivo que ficou ilegível por um
    instante geraria um "−1.200 linhas" fantasma. Vira `desconhecido`, que a
    tela mostra como tal. Binário não conta em canto nenhum — o número de
    "linhas" de um .png não quer dizer nada, e não é ignorância nossa, então
    também não entra em `desconhecido`."""
    if ev.get('binario'):
        return 0, 0, False
    tipo = ev.get('tipo')
    if tipo == 'movido':
        return 0, 0, False            # mesmo arquivo noutro lugar: saldo zero
    if tipo == 'projeto_renomeado':
        return 0, 0, False
    if tipo == 'criado':
        linhas = ev.get('linhas')
        return (linhas, 0, False) if isinstance(linhas, int) else (0, 0, True)
    if tipo == 'apagado':
        antes = ev.get('linhas_antes')
        return (0, antes, False) if isinstance(antes, int) else (0, 0, True)
    if tipo == 'editado':
        antes, depois = ev.get('linhas_antes'), ev.get('linhas')
        if not isinstance(antes, int) or not isinstance(depois, int):
            return 0, 0, True
        delta = depois - antes
        return (delta, 0, False) if delta >= 0 else (0, -delta, False)
    return 0, 0, False


def _contar_do_dia(eventos):
    """Os derivados do fechamento, SEMPRE recalculados da lista inteira de
    eventos do dia — nunca incrementados.

    ⚠️ Incrementar quebraria justamente o caso que o dedupe existe para
    cobrir: no replay pós-crash os eventos são absorvidos, mas um contador
    incrementado já teria contado duas vezes, e nada o traria de volta.
    Recalcular custa O(eventos do dia), que é dezenas."""
    contas = {'linhas_ganhas': 0, 'linhas_perdidas': 0, 'linhas_desconhecidas': 0,
              'arquivos_criados': 0, 'arquivos_editados': 0,
              'arquivos_apagados': 0, 'arquivos_movidos': 0}
    por_tipo = {'criado': 'arquivos_criados', 'editado': 'arquivos_editados',
                'apagado': 'arquivos_apagados', 'movido': 'arquivos_movidos'}
    for ev in eventos:
        chave = por_tipo.get(ev.get('tipo'))
        if chave:
            contas[chave] += 1
        ganhas, perdidas, desconhecido = _delta_de_linhas(ev)
        contas['linhas_ganhas'] += ganhas
        contas['linhas_perdidas'] += perdidas
        if desconhecido:
            contas['linhas_desconhecidas'] += 1
    return contas


def _arquivar(projeto, mudancas, agora, retrato_de_hoje, eh_primeira):
    """Grava as mudanças nos arquivos de dia. Devolve os dias tocados.

    Um dia PASSADO só recebe eventos e tem os contadores recalculados — o
    retrato dele (`arquivos`/`linhas`/`tempos`) fica como estava, porque não
    há como recontar as linhas de ontem hoje. É por isso que `fechamento` é
    definido como "o retrato mais recente capturado NAQUELE dia", e não "o
    estado no fim do dia": sem isso, quem consome somaria deltas de
    fechamento achando que a conta fecha.
    """
    hoje = agora.date().isoformat()
    por_dia = {}
    for mudanca in mudancas:
        por_dia.setdefault(mudanca['_dia'], []).append(mudanca)
    por_dia.setdefault(hoje, [])          # o dia da captura sempre é escrito

    for dia, mudancas_do_dia in sorted(por_dia.items()):
        caminho = _caminho_dia(projeto, dia)
        arquivo = _carregar_json(caminho)
        if not isinstance(arquivo, dict):
            arquivo = {'versao': VERSAO_FORMATO, 'dia': dia,
                       'primeira_captura': eh_primeira and dia == hoje,
                       'eventos': [], 'fechamento': None}
        eventos = list(arquivo.get('eventos') or [])
        conhecidos = {_chave_do_evento(ev) for ev in eventos}
        for mudanca in mudancas_do_dia:
            evento = _limpar_evento(mudanca)
            chave = _chave_do_evento(evento)
            if chave in conhecidos:
                continue
            conhecidos.add(chave)
            eventos.append(evento)
        eventos.sort(key=lambda ev: str(ev.get('quando') or ev.get('visto_em') or ''))
        arquivo['eventos'] = eventos

        fechamento = dict(arquivo.get('fechamento') or {})
        fechamento.update(_contar_do_dia(eventos))
        if dia == hoje:
            fechamento.update(retrato_de_hoje)
            fechamento['capturas'] = int(fechamento.get('capturas') or 0) + 1
            fechamento.setdefault('primeira_captura_em', agora.isoformat())
            fechamento['ultima_captura_em'] = agora.isoformat()
        arquivo['fechamento'] = fechamento
        arquivo['versao'] = VERSAO_FORMATO
        _gravar_json_atomico(caminho, arquivo)

    return sorted(por_dia)


def _tempos_do_dia_anterior(projeto, hoje):
    """Os `tempos` acumulados do dia com fechamento mais recente ANTES de
    hoje — a base para calcular quanto tempo foi gasto só hoje."""
    for dia in reversed(_dias_capturados(projeto)):
        if dia >= hoje:
            continue
        arquivo = _carregar_json(_caminho_dia(projeto, dia)) or {}
        fechamento = arquivo.get('fechamento') or {}
        tempos = fechamento.get('tempos')
        if isinstance(tempos, dict) and tempos:
            return tempos
    return {}


# ── Tempo em rotinas, fila e chat ────────────────────────────────────────────

def _tempo_rotinas_segundos(projeto):
    """Soma a duração de cada ciclo COMPLETO de `Automação/Rotinas/
    Histórico.jsonl`: a diferença entre o `quando` do evento `fim` e o
    `quando` do `ciclo` que o abriu (ver `historico.py`)."""
    caminho = os.path.join(_pasta_projetos(), projeto, 'Automação', 'Rotinas', 'Histórico.jsonl')
    total = 0.0
    inicio_aberto = None
    try:
        with open(caminho, 'r', encoding='utf-8') as f:
            for linha in f:
                linha = linha.strip()
                if not linha:
                    continue
                try:
                    ev = json.loads(linha)
                except ValueError:
                    continue
                quando = ev.get('quando')
                if ev.get('t') == 'ciclo' and quando:
                    inicio_aberto = quando
                elif ev.get('t') == 'fim' and quando and inicio_aberto:
                    try:
                        d1 = datetime.fromisoformat(inicio_aberto)
                        d2 = datetime.fromisoformat(quando)
                        total += max(0.0, (d2 - d1).total_seconds())
                    except ValueError:
                        pass
                    inicio_aberto = None
    except OSError:
        return 0.0
    return total


def _tempo_fila_segundos(projeto):
    caminho = os.path.join(_pasta_projetos(), projeto, 'Assistente', 'Fila', 'Estado.json')
    estado = _carregar_json(caminho, {}) or {}
    total = 0.0
    for tarefa in (estado.get('tarefas') or []):
        iniciado, concluido = tarefa.get('iniciado_em'), tarefa.get('concluido_em')
        if not (iniciado and concluido):
            continue
        try:
            d1 = datetime.fromisoformat(iniciado)
            d2 = datetime.fromisoformat(concluido)
            total += max(0.0, (d2 - d1).total_seconds())
        except ValueError:
            continue
    return total


def _tempo_chat_segundos(projeto):
    """Aproximado (F12): `created_at` do chat até a hora de modificação do
    próprio `conversa.json` — não é a duração exata da conversa."""
    padrao = os.path.join(_pasta_projetos(), projeto, 'Assistente', 'Chat', '*', 'conversa.json')
    total = 0.0
    for caminho in glob.glob(padrao):
        dado = _carregar_json(caminho, {}) or {}
        criado = dado.get('created_at')
        if not criado:
            continue
        try:
            d1 = datetime.fromisoformat(criado)
            d2 = datetime.fromtimestamp(os.stat(caminho).st_mtime)
            total += max(0.0, (d2 - d1).total_seconds())
        except (ValueError, OSError):
            continue
    return total


# ── Readoção de projeto renomeado ────────────────────────────────────────────
# A lógica mora em `backend/readocao.py` (a pergunta dele: "esta órfã é o
# mesmo projeto renomeado, e como se costura o histórico?"). Este arquivo é
# carregado por caminho, sem pacote, então o irmão é importado do mesmo jeito
# — e recebe daqui as ferramentas de que precisa, em vez de importar de volta.

_readocao = None


def _modulo_readocao():
    global _readocao
    if _readocao is None:
        caminho = _pasta_do_plugin('backend', 'readocao.py')
        spec = importlib.util.spec_from_file_location('plugin_base_readocao', caminho)
        modulo = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(modulo)
        _readocao = modulo
    return _readocao


def _ferramentas_de_readocao():
    return types.SimpleNamespace(
        pasta_do_plugin=_pasta_do_plugin, pasta_dados=_pasta_dados,
        caminho_atual=_caminho_atual, caminho_dia=_caminho_dia,
        carregar_workspace=_carregar_workspace, carregar_json=_carregar_json,
        gravar_json_atomico=_gravar_json_atomico, normalizar=_normalizar,
        chave_do_evento=_chave_do_evento, contar_do_dia=_contar_do_dia,
        versao_formato=VERSAO_FORMATO,
    )


def _readotar(projeto, workspace, projetos_vivos):
    """Devolve o nome da órfã adotada (destino sem dado) ou costurada
    (destino com dado), ou None. Falha aqui nunca derruba a captura."""
    try:
        r = _modulo_readocao()
        f = _ferramentas_de_readocao()
        if os.path.isfile(_caminho_atual(projeto)):
            return r.costurar(projeto, workspace, projetos_vivos, f)
        return r.adotar(projeto, workspace, projetos_vivos, f)
    except Exception as e:
        print('[Plugin base] readoção de "%s" falhou: %s' % (projeto, e))
        return None


# ── Capturar um projeto ──────────────────────────────────────────────────────

def _capturar_projeto(projeto, categorias, projetos_vivos):
    agora = datetime.now()
    hoje = agora.date().isoformat()
    workspace = _carregar_workspace(projeto)

    # Tentada em TODO ciclo, e não só quando o projeto ainda não tem dado: a
    # versão anterior só olhava na primeira captura, e uma órfã sem relação
    # nenhuma (de um projeto apagado) fechava a janela para sempre. Sem órfã
    # em `files/` isto custa um `os.listdir`.
    adotado = _readotar(projeto, workspace, projetos_vivos)

    atual_anterior = _carregar_json(_caminho_atual(projeto))
    eh_primeira = not isinstance(atual_anterior, dict)
    atual_anterior = atual_anterior if isinstance(atual_anterior, dict) else {}
    arquivos_anteriores = _carregar_json(_caminho_arquivos(projeto), {}) or {}

    # ⚠️ A varredura roda SEMPRE, independente das categorias ligadas. Ela é
    # o baseline do diff: sem ela não existe "o que mudou", e a versão 1
    # zerava a lista quando a categoria estava desligada — o que, além de
    # fazer recontar todo arquivo a cada ciclo, aqui apagaria o histórico.
    # Categoria decide o que a TELA mostra, nunca se a captura acontece.
    arquivos = _varrer_projeto(workspace, arquivos_anteriores)

    inicio_janela = _para_datahora(atual_anterior.get('atualizado_em')) if not eh_primeira else None
    if eh_primeira:
        # Sem baseline anterior, TODO arquivo existente pareceria recém-criado
        # — centenas de "criado" falsos no primeiro dia, e um pico no gráfico
        # que nunca aconteceu. O começo do histórico é marcado, não inventado.
        mudancas = []
    else:
        mudancas = _comparar(arquivos_anteriores, arquivos, inicio_janela, agora)

    if adotado:
        mudancas.append({'_dia': hoje, 'tipo': 'projeto_renomeado',
                         'de': adotado, 'para': projeto, 'quando': None,
                         'visto_em': agora.isoformat(), 'origem': 'captura'})

    linhas_total = sum(info.get('linhas') or 0 for info in arquivos.values())
    totais = {'arquivos': len(arquivos), 'linhas': linhas_total}

    tempos = dict(atual_anterior.get('tempos') or {})
    if categorias.get('tempo_rotinas'):
        tempos['rotinas_segundos'] = _tempo_rotinas_segundos(projeto)
    if categorias.get('tempo_fila'):
        tempos['fila_segundos'] = _tempo_fila_segundos(projeto)
    if categorias.get('tempo_chat'):
        tempos['chat_segundos'] = _tempo_chat_segundos(projeto)
        tempos['chat_aproximado'] = True

    # `tempos` é acumulado desde sempre; o consumidor que quisesse "quanto
    # rodou hoje" tinha que subtrair ontem de hoje — e isso quebrava em todo
    # dia sem captura. Calculado aqui, uma vez.
    #
    # ⚠️ Fica VAZIO quando não há dia anterior com que comparar (a primeira
    # captura de um projeto). Preencher com o acumulado ali diria "7428s
    # gastos hoje" para um número que é de sempre — e o dia 1 do histórico
    # nasceria com um pico que nunca existiu.
    base = _tempos_do_dia_anterior(projeto, hoje)
    tempos_no_dia = {}
    if base:
        for chave in ('rotinas_segundos', 'fila_segundos', 'chat_segundos'):
            if chave in tempos:
                tempos_no_dia[chave] = max(0.0, (tempos.get(chave) or 0.0) - (base.get(chave) or 0.0))

    retrato = {'arquivos': totais['arquivos'] if categorias.get('arquivos_e_linhas') else None,
               'linhas': totais['linhas'] if categorias.get('arquivos_e_linhas') else None,
               'tempos': tempos, 'tempos_no_dia': tempos_no_dia}

    # ⚠️ ORDEM DE ESCRITA: dias primeiro, baseline por último. Não existe
    # atomicidade entre arquivos, e não vale inventar uma. `atual.json` é o
    # marco do diff: enquanto ele não avança, a captura seguinte recalcula o
    # mesmo diff e reemite os mesmos eventos, que o dedupe absorve. Na ordem
    # inversa, um crash no meio perderia os eventos para sempre.
    if categorias.get('mudancas_por_dia') or eh_primeira:
        _arquivar(projeto, mudancas, agora, retrato, eh_primeira)

    _gravar_json_atomico(_caminho_arquivos(projeto), arquivos)
    _gravar_json_atomico(_caminho_atual(projeto), {
        'versao': VERSAO_FORMATO,
        'projeto': projeto,
        'root_folder': workspace.get('root_folder'),
        'working_folders': list(workspace.get('working_folders') or []),
        'atualizado_em': agora.isoformat(),
        'historico_desde': atual_anterior.get('historico_desde') or hoje,
        'totais': totais if categorias.get('arquivos_e_linhas') else {},
        'tempos': tempos,
    })


# ── O laço ────────────────────────────────────────────────────────────────

_timer = None


def capturar_todos_agora():
    """Um ciclo de captura, sobre todos os projetos, AGORA — usado tanto
    pelo laço periódico quanto pelo botão "Capturar agora" da tela (chamado
    via `backend/plugin.py`). Falha isolada por projeto (D12): uma pasta
    sumida ou um `Workspace.json` corrompido não derruba os outros."""
    config = carregar_config()
    categorias = config.get('categorias') or CATEGORIAS_PADRAO
    projetos = listar_projetos()
    falhas = []
    for projeto in projetos:
        try:
            _capturar_projeto(projeto, categorias, projetos)
        except Exception as e:
            falhas.append(projeto)
            print('[Plugin base] falha ao capturar "%s": %s' % (projeto, e))
    return {'quantos': len(projetos), 'falhas': falhas}


def _reagendar():
    global _timer
    try:
        intervalo = max(1, int(carregar_config().get('intervalo_minutos')
                               or INTERVALO_PADRAO_MINUTOS))
    except (TypeError, ValueError, OSError):
        intervalo = INTERVALO_PADRAO_MINUTOS
    _timer = threading.Timer(intervalo * 60, _ciclo)
    _timer.daemon = True
    _timer.start()


def _ciclo():
    """⚠️ Reagenda SEMPRE, no `finally`. Duas coisas dependem disso:

    - Religar o plugin pela tela volta a capturar sem reiniciar o programa.
      `save_config_plugin` só grava o JSON de estado, e ninguém chama
      `iniciar()` de novo fora do boot — se o laço parasse ao ser desligado,
      não haveria quem o ressuscitasse.
    - Uma exceção em `carregar_config()` ou na varredura não mata a captura
      em silêncio até o próximo reinício, que era o que acontecia antes.
    """
    try:
        if _ligado():
            capturar_todos_agora()
    except Exception as e:
        print('[Plugin base] falha no ciclo de captura: %s' % e)
    finally:
        _reagendar()


def iniciar():
    """Chamada UMA VEZ no boot, só se o plugin estiver ligado. O primeiro
    ciclo roda logo, e daí em diante o próprio `_ciclo` se reagenda."""
    global _timer
    _timer = threading.Timer(5, _ciclo)
    _timer.daemon = True
    _timer.start()
