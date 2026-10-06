"""
Exportador de visualizações (Projeto, Documentação e Mapas) — plugin manual, somente leitura.

Lê os arquivos reais do programa, na hora de exportar (Program/Code/frontend/…, o d3 e o marked),
e os dados do projeto pela API do programa (só métodos de leitura). Escreve uma vez:
o arquivo (ou a pasta) exportado, na pasta que voltou do seletor do Windows.
"""

import importlib.util
import json


def _irmao(nome):
    """Carrega um módulo irmão do mesmo diretório."""
    import os
    import sys
    pasta = os.path.dirname(__file__)
    caminho = os.path.join(pasta, f'exm_{nome}.py')

    # Adiciona a pasta ao path para permitir imports relativos
    if pasta not in sys.path:
        sys.path.insert(0, pasta)

    spec = importlib.util.spec_from_file_location(f'exm_{nome}', caminho)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def _mods():
    """Carrega todos os módulos necessários."""
    return {
        'catalogo': _irmao('catalogo'),
        'caminhos': _irmao('caminhos'),
        'leitura': _irmao('leitura'),
        'dados': _irmao('dados'),
        'icones': _irmao('icones'),
        'montagem': _irmao('montagem'),
        'saida': _irmao('saida'),
    }


def executar(payload):
    """Despacha a ação conforme payload['acao']."""
    try:
        mods = _mods()
        acao = payload.get('acao')

        if acao == 'catalogo':
            return {
                'success': True,
                'mapas': [
                    {
                        'id': m['id'],
                        'rotulo': m['rotulo'],
                        'slug': m['slug'],
                        'metodos': list(m['metodos'])
                    }
                    for m in mods['catalogo'].MAPAS
                ],
                'fontes_doc': [dict(f) for f in mods['catalogo'].FONTES_DOC],
            }

        elif acao == 'exportar':
            projeto = payload.get('projeto')
            pasta_projeto = payload.get('pasta_projeto')
            destino = payload.get('destino')
            modo = payload.get('modo')
            mapas_ids = payload.get('mapas', [])
            dados = payload.get('dados', {})
            render = payload.get('render', {})
            tema = payload.get('tema')
            tem_resumo = payload.get('temResumo', False)
            icones = payload.get('icones')
            fontes_doc_ids = payload.get('fontesDoc', [])
            documentacao = payload.get('documentacao', {})

            # Validações
            if not projeto:
                return {'success': False, 'error': 'Nenhum projeto escolhido.'}

            if not pasta_projeto:
                return {'success': False, 'error': 'O programa não informou a pasta do projeto — confira a raiz em Projeto.'}

            if not mapas_ids and not tem_resumo and not fontes_doc_ids:
                return {'success': False, 'error': 'Nada marcado para exportar.'}

            # Valida mapas
            mapas_validos = {m['id'] for m in mods['catalogo'].MAPAS}
            for mapa_id in mapas_ids:
                if mapa_id not in mapas_validos:
                    return {'success': False, 'error': f'Mapa desconhecido: {mapa_id}'}

            # Valida as fontes da Documentação
            fontes_validas = {f['id'] for f in mods['catalogo'].FONTES_DOC}
            for fonte_id in fontes_doc_ids:
                if fonte_id not in fontes_validas:
                    return {'success': False, 'error': f'Fonte de documentação desconhecida: {fonte_id}'}

            if not isinstance(documentacao, dict):
                return {'success': False, 'error': 'Dados da documentação ausentes.'}

            if modo not in ['unico', 'varios']:
                return {'success': False, 'error': f'Modo de exportação desconhecido: {modo}'}

            if not destino:
                return {'success': False, 'error': 'Pasta de destino não encontrada.'}

            if not isinstance(dados, dict):
                return {'success': False, 'error': 'Dados dos mapas ausentes.'}

            # Processa
            try:
                dados = mods['dados'].relativizar(dados, pasta_projeto)
            except ValueError as e:
                return {'success': False, 'error': str(e)}

            try:
                documentacao = mods['dados'].relativizar(documentacao, pasta_projeto)
            except ValueError as e:
                return {'success': False, 'error': str(e)}

            ctx = mods['montagem'].preparar(tema, tem_resumo, bool(fontes_doc_ids))

            # Ordena os IDs conforme o catálogo
            ids_na_ordem = [m['id'] for m in mods['catalogo'].MAPAS if m['id'] in mapas_ids]

            fontes_na_ordem = [f['id'] for f in mods['catalogo'].FONTES_DOC if f['id'] in fontes_doc_ids]

            saida = mods['montagem'].montar_tudo(ctx, projeto, ids_na_ordem, dados, render, modo,
                                                 tem_resumo, icones, fontes_na_ordem, documentacao)

            if modo == 'unico':
                resultado = mods['saida'].gravar_unico(destino, projeto, saida['unico'])
            else:
                resultado = mods['saida'].gravar_varios(destino, projeto, saida['paginas'], saida['indice'])

            if 'success' in resultado and not resultado['success']:
                return resultado

            return {
                'success': True,
                'modo': modo,
                'caminho': resultado['caminho'],
                'arquivos': resultado['arquivos']
            }

        else:
            return {'success': False, 'error': f'Ação desconhecida: {acao}'}

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {'success': False, 'error': f'{type(e).__name__}: {str(e)}'}
