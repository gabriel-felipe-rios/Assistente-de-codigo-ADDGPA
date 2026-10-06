"""O armazenamento por conteúdo das Versões — cada arquivo guardado UMA vez.

A ideia inteira em três linhas:

* cada arquivo é guardado uma vez, endereçado pelo **hash do conteúdo**;
* uma **Versão** é uma lista de `(caminho relativo → hash)`;
* **reverter** é copiar de volta pela lista.

O ganho de disco não vem de delta por linha — vem de **não recopiar o que não
mudou**. Numa segunda cópia sem alteração nenhuma, `guardar` calcula os hashes,
descobre que todos já existem em `arquivos/` e não escreve um byte de conteúdo:
só nasce mais uma entrada em `versoes.json`.

    Files/backups/{Projeto}/
      arquivos/{aa}/{hash}   ← o conteúdo (os 2 primeiros dígitos viram subpasta)
      versoes.json           ← a lista de Versões

Os dois primeiros dígitos do hash viram subpasta pelo motivo de sempre: um
projeto grande tem dezenas de milhares de arquivos, e o Explorer do Windows
engasga com uma pasta única desse tamanho. 256 subpastas resolvem.

⚠️ NÃO É GIT, e não deve virar. Não há `subprocess`, não há `.git`, não há
biblioteca de versionamento — decisão registrada no briefing "Git na aba de
Backups". O índice já existe (a rotina Hashes) e o diff já existe (`difflib`).
"""

import hashlib

from .constantes import *


def hash_do_conteudo(path):
    """O md5 do conteúdo de um arquivo, ou '' se não der para ler.

    ⚠️ FONTE ÚNICA. `agentes/indexacao/hashes.py::_hs_hash_arquivo` delega a
    esta função. Duas implementações do mesmo md5 é o caminho mais curto para
    a rotina Hashes e o backup discordarem sobre o que mudou.
    """
    try:
        with open(path, 'rb') as f:
            return hashlib.md5(f.read()).hexdigest()
    except Exception:
        return ''


def _caminho_do_conteudo(project_name, hash_):
    return obter_pasta_de_arquivos_das_versoes(project_name, hash_[:2], hash_)


# ── Guardar e restaurar ──────────────────────────────────────────────────────

def guardar(project_name, raiz, rel_paths):
    """Guarda os arquivos de `rel_paths` (relativos a `raiz`) e devolve o mapa.

    Devolve `{caminho relativo: hash}`. Arquivo ilegível fica **fora do mapa**
    em vez de entrar com hash vazio: uma Versão que promete um arquivo e não
    tem o conteúdo dele é pior do que uma Versão que não o promete — na hora de
    reverter, a regra "o que a Versão não guardou, a reversão não toca" já
    cobre o caso certo.
    """
    mapa = {}
    for rel in rel_paths:
        origem = os.path.join(raiz, rel)
        hash_ = hash_do_conteudo(origem)
        if not hash_:
            continue
        destino = _caminho_do_conteudo(project_name, hash_)
        if not os.path.exists(destino):
            os.makedirs(os.path.dirname(destino), exist_ok=True)
            try:
                shutil.copy2(origem, destino)
            except OSError:
                continue
        mapa[rel.replace(os.sep, '/')] = hash_
    return mapa


def restaurar(project_name, mapa, raiz):
    """Escreve de volta, sob `raiz`, os arquivos do mapa. Devolve quantos foram."""
    n = 0
    for rel, hash_ in (mapa or {}).items():
        origem = _caminho_do_conteudo(project_name, hash_)
        if not os.path.exists(origem):
            continue
        destino = os.path.join(raiz, rel.replace('/', os.sep))
        try:
            os.makedirs(os.path.dirname(destino), exist_ok=True)
            shutil.copy2(origem, destino)
            n += 1
        except OSError:
            continue
    return n


def ler(project_name, hash_):
    """O conteúdo bruto de um arquivo guardado — é o que alimenta o `difflib`."""
    if not hash_:
        return b''
    try:
        with open(_caminho_do_conteudo(project_name, hash_), 'rb') as f:
            return f.read()
    except Exception:
        return b''


def ler_texto(project_name, hash_):
    """O mesmo conteúdo, decodificado com folga — o diff é sempre sobre texto."""
    return ler(project_name, hash_).decode('utf-8', errors='replace')


def tamanho_do_conteudo(project_name, hash_):
    try:
        return os.path.getsize(_caminho_do_conteudo(project_name, hash_))
    except OSError:
        return 0


# ── A lista de Versões ───────────────────────────────────────────────────────

def carregar_versoes(project_name):
    """A lista inteira, da mais nova para a mais velha."""
    path = obter_arquivo_das_versoes(project_name)
    try:
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                dados = json.load(f)
            if isinstance(dados, list):
                return sorted(dados, key=lambda v: v.get('id', ''), reverse=True)
    except Exception:
        pass
    return []


def salvar_versoes(project_name, versoes):
    path = obter_arquivo_das_versoes(project_name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(versoes, f, ensure_ascii=False, indent=2)


def carregar_versao(project_name, versao_id):
    for v in carregar_versoes(project_name):
        if v.get('id') == versao_id:
            return v
    return None


def acrescentar_versao(project_name, versao):
    versoes = carregar_versoes(project_name)
    versoes.append(versao)
    salvar_versoes(project_name, versoes)
    return versao


def remover_versao(project_name, versao_id):
    versoes = [v for v in carregar_versoes(project_name) if v.get('id') != versao_id]
    salvar_versoes(project_name, versoes)
    return versoes


def proximo_id(project_name):
    """`AAAA-MM-DD_HH-MM-SS`, com desempate se duas cópias caírem no mesmo segundo."""
    base = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
    existentes = {v.get('id') for v in carregar_versoes(project_name)}
    if base not in existentes:
        return base
    n = 2
    while '%s_%d' % (base, n) in existentes:
        n += 1
    return '%s_%d' % (base, n)


# ── Limpeza ──────────────────────────────────────────────────────────────────

def apagar_orfaos(project_name):
    """Remove de `arquivos/` o conteúdo que nenhuma Versão referencia mais.

    Só faz sentido depois de excluir uma Versão. Como o mesmo hash costuma ser
    referenciado por várias Versões, a conta tem de ser feita sobre TODAS elas
    — apagar pelo que a Versão excluída citava corromperia as outras.
    """
    vivos = set()
    for v in carregar_versoes(project_name):
        vivos.update((v.get('codigo') or {}).values())
        vivos.update((v.get('documentacao') or {}).values())

    raiz = obter_pasta_de_arquivos_das_versoes(project_name)
    apagados = 0
    liberado = 0
    if not os.path.isdir(raiz):
        return {'apagados': 0, 'liberado': 0}
    for sub in os.listdir(raiz):
        pasta = os.path.join(raiz, sub)
        if not os.path.isdir(pasta):
            continue
        for nome in os.listdir(pasta):
            if nome in vivos:
                continue
            alvo = os.path.join(pasta, nome)
            try:
                liberado += os.path.getsize(alvo)
                os.remove(alvo)
                apagados += 1
            except OSError:
                pass
        try:
            if not os.listdir(pasta):
                os.rmdir(pasta)
        except OSError:
            pass
    return {'apagados': apagados, 'liberado': liberado}


def tamanho_no_disco(project_name):
    """Quanto `arquivos/` ocupa de verdade — o número que a Configuração mostra."""
    raiz = obter_pasta_de_arquivos_das_versoes(project_name)
    total = 0
    for root, _dirs, files in os.walk(raiz):
        for nome in files:
            try:
                total += os.path.getsize(os.path.join(root, nome))
            except OSError:
                pass
    return total


def tamanho_da_versao(project_name, versao):
    """O que a Versão ocuparia sozinha, se nada fosse compartilhado."""
    hashes = set((versao.get('codigo') or {}).values())
    hashes.update((versao.get('documentacao') or {}).values())
    return sum(tamanho_do_conteudo(project_name, h) for h in hashes)
