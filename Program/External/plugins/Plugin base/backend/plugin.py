"""Plugin base — consulta, configuração e exclusão (`executar`).

Único ponto de entrada chamado pelo programa (convenção de todo plugin — ver
`Como criar plugins.md`), e só o próprio `frontend/index.js` deste plugin o
chama (nunca outro plugin: a API do programa não expõe isso — ver "O que NÃO
fazer" em `A API do programa.md`). Quem precisar dos dados de um projeto lê
`files/{projeto}/` direto do disco — o formato está documentado em
`Como usar o Plugin base.md` e resumido em `Como criar plugins.md`, seção
"Consultar dados que outro plugin já capturou".

A captura em si não mora aqui: é `plugin_boot.py`, na raiz do plugin, quem
varre os projetos periodicamente (D14). Este arquivo só responde ao que o
frontend pede — e, para não manter duas fontes de verdade, importa dele os
caminhos, a configuração e a gravação atômica em vez de recopiá-los.

⚠️ **Este módulo não guarda estado entre chamadas.** `chamar_plugin` roda
`exec_module` sobre este arquivo a cada chamada (ver
`modulos/plugins.py::_importar_modulo_do_plugin`), então cada ação recebe um
objeto de módulo novo, com as globais zeradas. É por isso que
`capturar_agora` é síncrona: uma captura em thread não teria onde publicar o
progresso para uma chamada seguinte ler, e o botão diria "pronto" com a
varredura ainda rodando.
"""

import os
import shutil
import importlib.util


DIAS_NO_RESUMO_PADRAO = 60


def _importar_boot():
    # plugin_boot.py é irmão de backend/ — mesmo plugin, não é "chamar outro
    # plugin" (essa regra é sobre invocar código de FORA da própria pasta).
    caminho = _pasta_do_plugin('plugin_boot.py')
    spec = importlib.util.spec_from_file_location('plugin_base_boot', caminho)
    if not spec or not spec.loader:
        raise RuntimeError('plugin_boot.py não encontrado.')
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def _pasta_do_plugin(*partes):
    # Este arquivo está em backend/plugin.py — sobe um nível e desce onde for
    # pedido, sempre DENTRO da pasta do plugin. Nunca fora dela.
    raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(raiz, *partes)


def executar(payload):
    acao = payload.get('acao')
    try:
        boot = _importar_boot()
    except Exception as e:
        return {'success': False, 'error': 'Falha ao carregar a captura: %s' % e}

    if acao == 'listar':
        return _listar(boot)
    if acao == 'carregar_config':
        return {'success': True, 'config': boot.carregar_config()}
    if acao == 'salvar_config':
        return _salvar_config(boot, payload.get('config'))
    if acao == 'deletar':
        return _deletar(boot, payload.get('projeto'))
    if acao == 'capturar_agora':
        return _capturar_agora(boot)
    if acao == 'carregar_dados':
        return _carregar_dados(boot, payload.get('projeto'), payload.get('dias'))
    if acao == 'carregar_arquivos':
        return _carregar_arquivos(boot, payload.get('projeto'))
    if acao == 'carregar_dia':
        return _carregar_dia(boot, payload.get('projeto'), payload.get('dia'))
    return {'success': False, 'error': 'Ação desconhecida: %s' % acao}


# ── 'listar': quem tem dado capturado, e o que sobrou de projeto que sumiu ──

def _pastas_com_dado():
    pasta = _pasta_do_plugin('files')
    try:
        nomes = os.listdir(pasta)
    except OSError:
        return []
    return sorted(n for n in nomes if os.path.isfile(os.path.join(pasta, n, 'atual.json')))


def _listar(boot):
    """⚠️ Não abre JSON nenhum. A versão 1 lia o arquivo COMPLETO de cada
    projeto (com o mapa de centenas de arquivos dentro) só para montar a
    combo — e devolvia `totais`/`tempos`/`resumo_diario` que o frontend nunca
    leu. Aqui é `os.listdir` e mais nada; quem quer o dado de um projeto pede
    `carregar_dados` daquele projeto, um de cada vez."""
    try:
        com_dado = _pastas_com_dado()
        vivos = set(boot.listar_projetos())
    except Exception as e:
        return {'success': False, 'error': str(e)}
    return {'success': True,
            'projetos': [n for n in com_dado if n in vivos],
            'orfas': [n for n in com_dado if n not in vivos]}


# ── configuração (intervalo + categorias) ──────────────────────────────────

def _salvar_config(boot, novo):
    """⚠️ Grava sobre o que já está no arquivo em vez de montar um dicionário
    do zero. A versão 1 devolvia `{'intervalo_minutos': ..., 'categorias': ...}`
    e nada mais — qualquer outra chave que passasse a existir em
    `configuracao.json` era apagada no primeiro clique em Salvar, em silêncio."""
    if not isinstance(novo, dict):
        return {'success': False, 'error': 'Configuração inválida.'}

    dado = dict(boot.carregar_config())

    if 'intervalo_minutos' in novo:
        try:
            intervalo = int(novo.get('intervalo_minutos'))
        except (TypeError, ValueError):
            return {'success': False, 'error': 'Intervalo precisa ser um número de minutos.'}
        if intervalo < 1:
            return {'success': False, 'error': 'Intervalo precisa ser de pelo menos 1 minuto.'}
        dado['intervalo_minutos'] = intervalo

    categorias = dict(boot.CATEGORIAS_PADRAO)
    categorias.update(dado.get('categorias') or {})
    for chave in boot.CATEGORIAS_PADRAO:
        if chave in (novo.get('categorias') or {}):
            categorias[chave] = bool(novo['categorias'][chave])
    dado['categorias'] = categorias

    try:
        boot._gravar_json_atomico(boot._caminho_config(), dado)
    except OSError as e:
        return {'success': False, 'error': str(e)}
    return {'success': True, 'config': dado}


# ── deletar os dados de um projeto ──────────────────────────────────────────

def _deletar(boot, projeto):
    """⚠️ O alvo agora é uma PASTA, e o apagar é `shutil.rmtree`. Enquanto era
    um arquivo `.json` solto, `os.path.basename` bastava como sanitização; com
    `rmtree` no meio, um nome mal-intencionado ou só malformado passa a valer
    uma árvore inteira, então o alvo é conferido contra `files/` com
    `commonpath` antes de qualquer coisa."""
    nome = os.path.basename(str(projeto or '').strip())
    if not nome:
        return {'success': False, 'error': 'Nome de projeto vazio.'}

    raiz = os.path.abspath(_pasta_do_plugin('files'))
    alvo = os.path.abspath(os.path.join(raiz, nome))
    try:
        if os.path.commonpath([raiz, alvo]) != raiz or alvo == raiz:
            return {'success': False, 'error': 'Caminho fora da pasta de dados do plugin.'}
    except ValueError:
        return {'success': False, 'error': 'Caminho inválido.'}
    if not os.path.isdir(alvo):
        return {'success': False, 'error': 'Este projeto não tem dado capturado.'}
    try:
        shutil.rmtree(alvo)
    except OSError as e:
        return {'success': False, 'error': str(e)}
    return {'success': True}


# ── capturar agora (botão manual) ────────────────────────────────────────

def _capturar_agora(boot):
    try:
        resultado = boot.capturar_todos_agora()
    except Exception as e:
        return {'success': False, 'error': str(e)}
    return {'success': True, 'quantos': resultado.get('quantos', 0),
            'falhas': resultado.get('falhas', [])}


# ── os dados de um projeto ──────────────────────────────────────────────────

def _validar_projeto(boot, projeto):
    nome = os.path.basename(str(projeto or '').strip())
    if not nome:
        return None, {'success': False, 'error': 'Nome de projeto vazio.'}
    if not os.path.isfile(boot._caminho_atual(nome)):
        return None, {'success': False, 'error': 'Este projeto não tem dado capturado.'}
    return nome, None


def _carregar_dados(boot, projeto, limite_dias):
    """`atual.json` + o FECHAMENTO de cada dia — sem os eventos.

    Os eventos de um dia podem ser centenas; a tela de gráficos só precisa
    dos números do fechamento. Quem quiser a lista de um dia pede
    `carregar_dia` daquele dia."""
    nome, erro = _validar_projeto(boot, projeto)
    if erro:
        return erro
    try:
        limite = int(limite_dias)
    except (TypeError, ValueError):
        limite = DIAS_NO_RESUMO_PADRAO
    limite = max(1, min(limite, 3650))

    atual = boot._carregar_json(boot._caminho_atual(nome)) or {}
    dias = []
    for dia in boot._dias_capturados(nome)[-limite:]:
        arquivo = boot._carregar_json(boot._caminho_dia(nome, dia)) or {}
        dias.append({'dia': dia,
                     'fechamento': arquivo.get('fechamento'),
                     'primeira_captura': bool(arquivo.get('primeira_captura')),
                     'quantidade_eventos': len(arquivo.get('eventos') or [])})
    return {'success': True, 'dado': {'atual': atual, 'dias': dias}}


def _carregar_arquivos(boot, projeto):
    """O mapa de arquivos — a parte pesada, pedida só quando o painel abre."""
    nome, erro = _validar_projeto(boot, projeto)
    if erro:
        return erro
    return {'success': True, 'arquivos': boot._carregar_json(boot._caminho_arquivos(nome), {}) or {}}


def _carregar_dia(boot, projeto, dia):
    nome, erro = _validar_projeto(boot, projeto)
    if erro:
        return erro
    dia_limpo = os.path.basename(str(dia or '').strip())
    if not dia_limpo:
        return {'success': False, 'error': 'Dia vazio.'}
    arquivo = boot._carregar_json(boot._caminho_dia(nome, dia_limpo))
    if not isinstance(arquivo, dict):
        return {'success': False, 'error': 'Nada capturado neste dia.'}
    return {'success': True, 'dia': arquivo}
