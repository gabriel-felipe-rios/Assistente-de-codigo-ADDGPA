"""Plugin base — readoção do dado de um projeto renomeado.

A pergunta deste arquivo: **esta pasta de dados órfã em `files/` é o mesmo
projeto, renomeado — e como se costura o histórico dela no projeto novo?**

Renomear um projeto no programa é um `os.rename` da pasta em
`Files/projects/` (ver `modulos/projetos.py::rename_project`) — o
`Workspace.json` não é tocado, então `root_folder` e `working_folders`
sobrevivem intactos. É o suficiente para reconhecer que a pasta de dados órfã
e o projeto novo são a mesma coisa (o contrato público diz isso em
`Como usar o Plugin base.md`: "servem para reconhecer que um projeto renomeado
é o mesmo de antes").

## O que deu errado na primeira versão, e por que este arquivo existe

A guarda exigia **exatamente uma órfã em `files/` inteira** — e o usuário
tinha, além da órfã do projeto renomeado, a órfã de um projeto apagado dias
antes, com `root_folder` em outro disco. Duas órfãs, adoção recusada, o
histórico de seis dias recomeçou do zero. E como a adoção só era tentada
enquanto o destino ainda não tinha `atual.json`, a janela fechava no primeiro
ciclo: uma órfã sem relação nenhuma transformava um falso-negativo em perda
permanente.

Agora a guarda é **por candidata**: só entra quem tem `root_folder` e
`working_folders` idênticos aos do projeto; entre as que casam, tem de haver
exatamente uma; e nenhum OUTRO projeto vivo sem dado pode apontar para os
mesmos caminhos (dois projetos novos para a mesma pasta é ambíguo de verdade).
Um enxerto errado continua sendo pior do que perder o histórico — na dúvida,
não adota.

E quando o destino JÁ tem dado (a janela fechou antes desta versão), a
`costurar` funde as duas pastas — desde que o histórico novo tenha começado
depois de a órfã parar, ou seja, que sejam duas metades da mesma linha.

⚠️ Carregado por `plugin_boot.py` por caminho (`spec_from_file_location`, o
mesmo padrão dos outros plugins), sem pacote. Por isso ele não importa nada do
boot: recebe as ferramentas por parâmetro (`f`), um namespace com os caminhos,
a leitura e a gravação atômica, o dedupe e a contagem do dia. Uma cópia só de
cada.
"""

import os
import shutil


def _pastas_de_dados(f):
    pasta = f.pasta_do_plugin('files')
    try:
        nomes = os.listdir(pasta)
    except OSError:
        return []
    return sorted(n for n in nomes if os.path.isfile(os.path.join(pasta, n, 'atual.json')))


def _mesmo_escopo(anterior, workspace, f):
    """`root_folder` idêntico E `working_folders` idênticas (normalizados,
    sem ordem). É a identidade do projeto — a única coisa que o rename não
    toca."""
    if not anterior.get('root_folder') or not workspace.get('root_folder'):
        return False
    if f.normalizar(anterior.get('root_folder')) != f.normalizar(workspace.get('root_folder')):
        return False
    antes = sorted(f.normalizar(p) for p in (anterior.get('working_folders') or []))
    agora = sorted(f.normalizar(p) for p in (workspace.get('working_folders') or []))
    return antes == agora


def candidata(projeto, workspace, projetos_vivos, f):
    """A única órfã que é este projeto — ou None.

    Três condições, todas necessárias: exatamente UMA órfã com o mesmo escopo
    (com duas não dá para saber qual é qual); nenhum outro projeto vivo SEM
    dado com esse mesmo escopo (dois projetos novos para a mesma pasta — a
    órfã poderia ser qualquer um); e a órfã não pode ser um projeto vivo (aí
    não é órfã)."""
    if not workspace.get('root_folder'):
        return None
    vivos = set(projetos_vivos or [])
    casam = []
    for nome in _pastas_de_dados(f):
        if nome in vivos:
            continue
        anterior = f.carregar_json(os.path.join(f.pasta_do_plugin('files'), nome, 'atual.json')) or {}
        if _mesmo_escopo(anterior, workspace, f):
            casam.append(nome)
    if len(casam) != 1:
        return None
    for outro in vivos:
        if outro == projeto or os.path.isfile(f.caminho_atual(outro)):
            continue
        if _mesmo_escopo(f.carregar_workspace(outro), workspace, f):
            return None
    return casam[0]


def adotar(projeto, workspace, projetos_vivos, f):
    """Destino ainda SEM dado: renomeia a pasta da órfã. É o caso normal — o
    primeiro ciclo depois do rename. Devolve o nome antigo, ou None."""
    orfa = candidata(projeto, workspace, projetos_vivos, f)
    if not orfa:
        return None
    try:
        os.rename(os.path.join(f.pasta_do_plugin('files'), orfa), f.pasta_dados(projeto))
    except OSError:
        return None
    return orfa


def _dia_de(iso):
    return str(iso or '')[:10]


def _mesclar_dia(velho, novo, f):
    """Os dois arquivos do mesmo dia viram um. Eventos deduplicados pela chave
    de sempre (`_chave_do_evento` — é o mesmo dedupe que absorve o replay
    pós-crash), contadores RECALCULADOS da lista inteira (nunca somados), e o
    retrato (`arquivos`/`linhas`/`tempos`) é o do NOVO, que é o mais recente.
    `capturas` soma; `primeira_captura_em` é a menor; `primeira_captura` cai,
    porque o dia já não é o primeiro de nada."""
    eventos = list(velho.get('eventos') or [])
    conhecidos = {f.chave_do_evento(ev) for ev in eventos}
    for ev in (novo.get('eventos') or []):
        chave = f.chave_do_evento(ev)
        if chave in conhecidos:
            continue
        conhecidos.add(chave)
        eventos.append(ev)
    eventos.sort(key=lambda ev: str(ev.get('quando') or ev.get('visto_em') or ''))

    fechamento = dict(velho.get('fechamento') or {})
    fechamento.update(novo.get('fechamento') or {})
    fechamento.update(f.contar_do_dia(eventos))
    fv, fn = (velho.get('fechamento') or {}), (novo.get('fechamento') or {})
    fechamento['capturas'] = int(fv.get('capturas') or 0) + int(fn.get('capturas') or 0)
    primeiras = [p for p in (fv.get('primeira_captura_em'), fn.get('primeira_captura_em')) if p]
    if primeiras:
        fechamento['primeira_captura_em'] = min(primeiras)
    ultimas = [p for p in (fv.get('ultima_captura_em'), fn.get('ultima_captura_em')) if p]
    if ultimas:
        fechamento['ultima_captura_em'] = max(ultimas)

    saida = dict(novo)
    saida['versao'] = f.versao_formato
    saida['eventos'] = eventos
    saida['fechamento'] = fechamento
    saida['primeira_captura'] = bool(velho.get('primeira_captura'))
    return saida


def costurar(projeto, workspace, projetos_vivos, f):
    """Destino JÁ com dado: funde o histórico da órfã no dele. Só quando o
    histórico do destino começou no dia em que a órfã parou, ou depois — duas
    metades da mesma linha. Sobreposição maior que isso não é rename, é outra
    coisa, e não se adivinha.

    Ordem: grava TODOS os dias no destino (o de fronteira mesclado, os outros
    copiados), depois corrige `historico_desde`, e só então remove a órfã.
    Qualquer falha antes da remoção deixa as duas pastas como estavam — o
    ciclo seguinte tenta de novo, e o dedupe absorve o que já foi gravado.

    Devolve o nome da órfã costurada, ou None."""
    orfa = candidata(projeto, workspace, projetos_vivos, f)
    if not orfa:
        return None
    pasta_orfa = os.path.join(f.pasta_do_plugin('files'), orfa)
    anterior = f.carregar_json(os.path.join(pasta_orfa, 'atual.json')) or {}
    atual = f.carregar_json(f.caminho_atual(projeto)) or {}
    parou_em = _dia_de(anterior.get('atualizado_em'))
    comecou_em = _dia_de(atual.get('historico_desde'))
    if not parou_em or not comecou_em or comecou_em < parou_em:
        return None

    try:
        dias_da_orfa = sorted(n[:-5] for n in os.listdir(os.path.join(pasta_orfa, 'dias'))
                              if n.endswith('.json'))
    except OSError:
        dias_da_orfa = []

    try:
        for dia in dias_da_orfa:
            velho = f.carregar_json(os.path.join(pasta_orfa, 'dias', dia + '.json'))
            if not isinstance(velho, dict):
                continue
            destino = f.caminho_dia(projeto, dia)
            novo = f.carregar_json(destino)
            if isinstance(novo, dict):
                f.gravar_json_atomico(destino, _mesclar_dia(velho, novo, f))
            else:
                f.gravar_json_atomico(destino, velho)

        desde = [d for d in (anterior.get('historico_desde'), atual.get('historico_desde')) if d]
        if desde:
            atual['historico_desde'] = min(desde)
            f.gravar_json_atomico(f.caminho_atual(projeto), atual)

        shutil.rmtree(pasta_orfa)
    except OSError as e:
        print('[Plugin base] costura de "%s" em "%s" interrompida: %s' % (orfa, projeto, e))
        return None
    return orfa
