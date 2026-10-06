import json
import re
import sys
import os

# Para imports de módulos irmãos
_pasta_plugin = os.path.dirname(__file__)
if _pasta_plugin not in sys.path:
    sys.path.insert(0, _pasta_plugin)

import exm_catalogo
import exm_leitura
import exm_icones


def preparar(tema, tem_resumo=False, tem_doc=False):
    """Prepara o contexto lendo tudo do disco uma vez."""
    # A árvore e os ícones servem ao Resumo e à Documentação; vêm uma vez só, antes dos dois.
    extras = []
    if tem_resumo or tem_doc:
        extras += exm_leitura.ler_modulos(exm_leitura.MODULOS_ARVORE)
    if tem_resumo:
        extras += exm_leitura.ler_modulos(exm_leitura.MODULOS_RESUMO)
    if tem_doc:
        extras += exm_leitura.ler_modulos(exm_leitura.MODULOS_DOC)
    return {
        'modulos_extras': extras,
        'marked': exm_leitura.marked() if tem_doc else '',
        'painel_resumo': exm_leitura.painel_do_resumo() if tem_resumo else '',
        'css': exm_leitura.css_do_programa(tema),
        'd3': exm_leitura.d3(),
        'modulos': exm_leitura.modulos_na_ordem(),
        'estaticos': exm_leitura.ler_estaticos(),
    }


def escape_para_script(texto):
    """Escapa </script como <\/script."""
    return texto.replace('</script', '<\\/script')


def escape_json(valor):
    """Escapa < como < no JSON."""
    json_str = json.dumps(valor, ensure_ascii=False)
    json_str = json_str.replace('<', '\\u003c')
    json_str = json_str.replace(' ', '\\u2028')
    json_str = json_str.replace(' ', '\\u2029')
    return json_str


def pagina(ctx, projeto, ids, dados, render, sem_barra, titulo, tem_resumo=False, icones=None, fontes_doc=None, documentacao=None):
    """Monta uma página exportada: as seções Projeto, Documentação e Mapas que tiverem conteúdo."""
    fontes_doc = list(fontes_doc or [])

    # Filtra dados para apenas os métodos necessários
    metodos_necessarios = set()
    for mapa_id in ids:
        for mapa in exm_catalogo.MAPAS:
            if mapa['id'] == mapa_id:
                metodos_necessarios.update(mapa['metodos'])

    dados_filtrados = {k: v for k, v in dados.items() if k in metodos_necessarios}

    # Monta o JSON dos dados
    json_dados = {
        'projeto': projeto,
        'mapas': ids,
        'semBarra': sem_barra,
        'render': render or {},
        'dados': dados_filtrados,
        'temResumo': tem_resumo,
        'fontesDoc': fontes_doc,
    }

    # Só as fontes marcadas levam o texto — o resto da documentação não sai junto.
    if fontes_doc:
        json_dados['documentacao'] = {f: (documentacao or {}).get(f) or {} for f in fontes_doc}

    # O Resumo só leva o conjunto completo (o indexado não é exportado).
    if tem_resumo:
        scan = dados.get('scan_workspace') or {}
        completo = scan.get('completo') if isinstance(scan, dict) else None
        if isinstance(completo, dict):
            json_dados['dados']['scan_workspace'] = {'success': True, 'completo': completo}
            json_dados['icones'] = exm_icones.montar(icones, completo)
        else:
            json_dados['temResumo'] = False
            tem_resumo = False

    tem_doc = bool(fontes_doc)
    secoes = []
    if tem_resumo:
        secoes.append(('projeto', 'Projeto'))
    if tem_doc:
        secoes.append(('documentacao', 'Documentação'))
    if ids:
        secoes.append(('mapas', 'Mapas'))

    html = '<!DOCTYPE html>\n'
    html += '<html lang="pt-BR">\n'
    html += '<head>\n'
    html += '  <meta charset="utf-8">\n'
    html += '  <meta name="viewport" content="width=device-width, initial-scale=1">\n'
    titulo_escapado = escape_json(titulo).strip('"')
    html += f'  <title>{titulo_escapado}</title>\n'
    html += '  <style>\n'
    html += ctx['css'] + '\n'
    html += ctx['estaticos']['exportado.css'] + '\n'
    html += '  </style>\n'
    html += '</head>\n'
    html += '<body>\n'
    html += '<div id="exm-raiz">\n'
    if len(secoes) > 1:
        html += '  <div class="tabs-bar" id="exm-abas">\n'
        for i, (nome, rotulo) in enumerate(secoes):
            ativa = ' active' if i == 0 else ''
            html += f'    <button class="tab-btn{ativa}" data-exm-aba="{nome}">{rotulo}</button>\n'
        html += '  </div>\n'
    if tem_resumo:
        html += '  <div class="tab-content active" id="tab-projeto"></div>\n'
    if tem_doc:
        html += '  <div class="tab-content" id="tab-documentacao"></div>\n'
    # O #tab-mapas existe sempre: o mapas-template.js escreve nele já no carregamento.
    html += '  <div class="tab-content" id="tab-mapas"></div>\n'
    html += '</div>\n'
    html += '<script>' + ctx['d3'] + '</script>\n'
    if tem_doc:
        html += '<script>' + escape_para_script(ctx['marked']) + '</script>\n'
    html += '<script type="application/json" id="exm-dados">' + escape_json(json_dados) + '</script>\n'
    html += '<script>' + escape_para_script(ctx['estaticos']['exportado-antes.js']) + '</script>\n'

    # Os 27 módulos dos mapas (e, conforme o marcado, os da árvore, do Resumo e da Documentação)
    for nome, conteudo in ctx['modulos'] + ctx['modulos_extras']:
        html += '<script>' + escape_para_script(conteudo) + '</script>\n'

    if tem_resumo:
        html += '<script>' + escape_para_script(ctx['painel_resumo']) + '</script>\n'
    html += '<script>' + escape_para_script(ctx['estaticos']['exportado-depois.js']) + '</script>\n'
    html += '</body>\n'
    html += '</html>\n'

    return html


def indice(ctx, projeto, paginas):
    """Monta o index.html para o modo vários arquivos."""
    titulo = f'Visualizações — {projeto}'

    # Monta os botões das abas
    abas_html = ''
    for rotulo, arquivo in paginas:
        abas_html += f'<button class="mapas-tab-btn" data-arquivo="{arquivo}">{rotulo}</button>\n'

    primeiro_arquivo = paginas[0][1] if paginas else 'index.html'

    html = ctx['estaticos']['exportado-indice.html']
    html = html.replace('@@TITULO@@', titulo)
    html = html.replace('@@CSS@@', ctx['css'] + '\n' + ctx['estaticos']['exportado.css'])
    html = html.replace('@@ABAS@@', abas_html)
    html = html.replace('@@PRIMEIRO@@', primeiro_arquivo)

    return html


def montar_tudo(ctx, projeto, ids, dados, render, modo, tem_resumo=False, icones=None, fontes_doc=None, documentacao=None):
    """Monta todas as páginas conforme o modo."""
    fontes_doc = list(fontes_doc or [])

    if modo == 'unico':
        html = pagina(ctx, projeto, ids, dados, render, False, f'Visualizações — {projeto}',
                      tem_resumo, icones, fontes_doc, documentacao)
        return {'unico': html}

    elif modo == 'varios':
        paginas = {}
        paginas_lista = []

        # O Resumo vira a primeira página, sem mapa nenhum.
        if tem_resumo:
            paginas['projeto.html'] = pagina(ctx, projeto, [], dados, render, True,
                                             f'Projeto — {projeto}', True, icones)
            paginas_lista.append(('Projeto', 'projeto.html'))

        # A Documentação vira uma página só, com as fontes marcadas como sub-abas dela.
        if fontes_doc:
            paginas['documentacao.html'] = pagina(ctx, projeto, [], dados, render, True,
                                                  f'Documentação — {projeto}', False, None,
                                                  fontes_doc, documentacao)
            paginas_lista.append(('Documentação', 'documentacao.html'))

        for mapa_id in ids:
            mapa = None
            for m in exm_catalogo.MAPAS:
                if m['id'] == mapa_id:
                    mapa = m
                    break

            if not mapa:
                continue

            arquivo = f"{mapa['slug']}.html"
            html = pagina(ctx, projeto, [mapa_id], dados, render, True, f"{mapa['rotulo']} — {projeto}")
            paginas[arquivo] = html
            paginas_lista.append((mapa['rotulo'], arquivo))

        indice_html = indice(ctx, projeto, paginas_lista)
        return {'paginas': paginas, 'indice': indice_html}

    else:
        raise ValueError(f'Modo desconhecido: {modo}')
