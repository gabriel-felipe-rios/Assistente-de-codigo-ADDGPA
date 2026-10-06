"""O único arquivo desta extensão que abre arquivo: listar e ler as bases."""

import os

from . import norm_caminhos as c


def base_existe(base):
    return os.path.isdir(base)


def listar_arquivos(base):
    """Os `.md` da base, em caminho relativo com `/`, em ordem, sem o
    histórico. `[]` se a pasta não existe."""
    if not os.path.isdir(base):
        return []
    arquivos = []
    for atual, subpastas, nomes in os.walk(base):
        subpastas[:] = sorted(subpastas)
        for nome in sorted(nomes):
            if nome.startswith(c.PREFIXO_HISTORICO) or not nome.lower().endswith('.md'):
                continue
            arquivos.append(os.path.relpath(os.path.join(atual, nome), base).replace('\\', '/'))
    return arquivos


def ler_texto(caminho):
    with open(caminho, 'r', encoding='utf-8', errors='replace') as f:
        return f.read()


def _secao(texto, titulo):
    """O corpo da seção `## {titulo}`, numa linha só — '' se não há."""
    dentro, linhas = False, []
    for linha in (texto or '').splitlines():
        if linha.startswith('## '):
            if dentro:
                break
            dentro = linha[3:].strip() == titulo
            continue
        if dentro:
            linhas.append(linha)
    return ' '.join(' '.join(linhas).split())


def indice_das_regras(base):
    """O índice da base Regras e instruções, no MESMO formato que o programa
    montava (`regras_indice.montar_indice_regras`): «Regras (valem sempre):» e
    «Instruções (valem na hora certa):», uma linha por item com o "quando se
    aplica" (ou a descrição) e, na instrução, os arquivos dela.

    Cada item é uma pasta com o nome dele; o principal tem o nome da pasta
    (senão, o primeiro `.md` em ordem). Um `.md` só é regra; o principal mais
    apoio é instrução. '' se a base não existe ou está vazia."""
    if not os.path.isdir(base):
        return ''
    regras, instrucoes = [], []
    for nome in sorted(os.listdir(base), key=str.lower):
        pasta = os.path.join(base, nome)
        if not os.path.isdir(pasta):
            continue
        mds = sorted((n for n in os.listdir(pasta)
                      if n.lower().endswith('.md') and not n.startswith(c.PREFIXO_HISTORICO)
                      and os.path.isfile(os.path.join(pasta, n))), key=str.lower)
        if not mds:
            continue
        principal = nome + '.md' if (nome + '.md') in mds else mds[0]
        try:
            texto = ler_texto(os.path.join(pasta, principal))
        except OSError:
            texto = ''
        quando = _secao(texto, c.SECAO_QUANDO) or _secao(texto, c.SECAO_DESCRICAO)
        linha = '- %s' % nome + (' — %s' % quando if quando else '')
        if len(mds) > 1:
            arquivos = [principal] + [n for n in mds if n != principal]
            instrucoes.append(linha + '\n  arquivos: ' + ' · '.join(arquivos))
        else:
            regras.append(linha)
    partes = []
    if regras:
        partes.append('Regras (valem sempre):\n' + '\n'.join(regras))
    if instrucoes:
        partes.append('Instruções (valem na hora certa):\n' + '\n'.join(instrucoes))
    return '\n\n'.join(partes)
