"""
SEGUNDA EXCEÇÃO DE GRAVAÇÃO (maior que Relatório do Projeto).

Condições:
(1) O destino é exatamente a pasta que voltou do seletor do Windows, tem de existir.
(2) Grava-se ou um arquivo só, ou uma pasta nova — nunca nada solto ao lado.
(3) Nunca sobrescreve: vira nome (2), nome (3)…
(4) Diálogo cancelado não chama o backend.
(5) O plugin não guarda nada na própria pasta.
"""

import os
import re


def nome_limpo(nome):
    """Limpa o nome do arquivo/pasta para caracteres válidos no Windows."""
    # Troca caracteres inválidos por hífen
    nome = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '-', nome)

    # Remove espaços/pontos do final
    nome = nome.rstrip('. ')

    # Se estiver vazio, usa padrão
    if not nome:
        return 'visualizacoes'

    # Se a parte antes do primeiro ponto for nome reservado do Windows
    parte_antes = nome.split('.')[0].upper()
    nomes_reservados = {'CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5',
                       'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4',
                       'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'}

    if parte_antes in nomes_reservados:
        nome = '_' + nome

    return nome


def gravar_unico(destino, projeto, html):
    """Grava um arquivo HTML único. Retorna {'caminho': ..., 'arquivos': [nome]}."""
    if not os.path.isdir(destino):
        return {'success': False, 'error': 'Pasta de destino não encontrada.'}

    nome_base = nome_limpo(projeto)
    nome_arquivo = f'{nome_base}.html'

    contador = 2
    caminho = os.path.join(destino, nome_arquivo)

    while os.path.exists(caminho):
        nome_arquivo = f'{nome_base} ({contador}).html'
        caminho = os.path.join(destino, nome_arquivo)
        contador += 1
        if contador > 999:
            return {'success': False, 'error': 'Muitos arquivos com o mesmo nome.'}

    try:
        with open(caminho, 'x', encoding='utf-8') as f:
            f.write(html)
        return {'caminho': caminho, 'arquivos': [nome_arquivo]}
    except Exception as e:
        return {'success': False, 'error': f'Não consegui gravar: {str(e)}'}


def gravar_varios(destino, projeto, paginas, indice_html):
    """Grava uma pasta com index.html e um arquivo por mapa."""
    if not os.path.isdir(destino):
        return {'success': False, 'error': 'Pasta de destino não encontrada.'}

    nome_base = nome_limpo(projeto)
    pasta_nome = nome_base

    contador = 2
    caminho_pasta = os.path.join(destino, pasta_nome)

    while os.path.exists(caminho_pasta):
        pasta_nome = f'{nome_base} ({contador})'
        caminho_pasta = os.path.join(destino, pasta_nome)
        contador += 1
        if contador > 999:
            return {'success': False, 'error': 'Muitas pastas com o mesmo nome.'}

    try:
        os.mkdir(caminho_pasta)
    except Exception as e:
        return {'success': False, 'error': f'Não consegui criar pasta: {str(e)}'}

    arquivos_criados = []

    try:
        # Grava index.html
        caminho_index = os.path.join(caminho_pasta, 'index.html')
        with open(caminho_index, 'x', encoding='utf-8') as f:
            f.write(indice_html)
        arquivos_criados.append('index.html')

        # Grava cada página de mapa
        for nome_arquivo, html in paginas.items():
            caminho_arquivo = os.path.join(caminho_pasta, os.path.basename(nome_arquivo))
            with open(caminho_arquivo, 'x', encoding='utf-8') as f:
                f.write(html)
            arquivos_criados.append(os.path.basename(nome_arquivo))

        return {'caminho': caminho_pasta, 'arquivos': arquivos_criados}

    except Exception as e:
        # Apaga tudo que foi criado
        try:
            for arquivo in arquivos_criados:
                caminho_arquivo = os.path.join(caminho_pasta, arquivo)
                if os.path.exists(caminho_arquivo):
                    os.remove(caminho_arquivo)
            os.rmdir(caminho_pasta)
        except:
            pass

        return {'success': False, 'error': f'Não consegui gravar: {str(e)}'}
