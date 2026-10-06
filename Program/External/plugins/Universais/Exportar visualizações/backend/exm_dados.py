import re


def relativizar(valor, raiz):
    """Remove caminhos absolutos dos dados, deixando apenas caminhos relativos."""
    if not raiz:
        raise ValueError('sem pasta do projeto')

    def processar_valor(v):
        if isinstance(v, dict):
            return {processar_valor(k): processar_valor(val) for k, val in v.items()}
        elif isinstance(v, (list, tuple)):
            tipo = type(v)
            return tipo(processar_valor(item) for item in v)
        elif isinstance(v, str):
            return remover_caminho(v, raiz)
        else:
            return v

    return processar_valor(valor)


def remover_caminho(texto, raiz):
    """Remove raiz de um texto, se estiver presente."""
    if not isinstance(texto, str):
        return texto

    # Normaliza para comparação
    raiz_norm = raiz.replace('\\', '/').rstrip('/').lower()
    texto_norm = texto.replace('\\', '/').lower()

    # Se é exatamente a raiz
    if texto_norm == raiz_norm:
        return '.'

    # Se começa com raiz + /
    if texto_norm.startswith(raiz_norm + '/'):
        resto = texto[len(raiz) + 1:]  # pega com a barra certa
        return resto.replace('\\', '/')

    # Se raiz aparece dentro do texto (texto corrido)
    raiz_pattern = re.escape(raiz.replace('\\', '/').rstrip('/'))
    match = re.search(raiz_pattern, texto_norm)
    if match:
        inicio = match.start()
        fim = match.end()
        antes = texto[:inicio]
        depois_char = texto[fim:fim+1]

        if depois_char in ['/', '\\']:
            depois = texto[fim+1:]
        else:
            depois = texto[fim:]

        resultado = (antes + depois).replace('\\', '/')

        # Verifica se o resultado começa com unidade de disco
        if re.match(r'^[A-Za-z]:[\\/]', resultado):
            partes = resultado.split('/')
            partes = [p for p in partes if p and p not in ('C:', 'D:', 'E:', 'F:')]
            if len(partes) >= 2:
                resultado = '/'.join(partes[-2:])

        return resultado

    # Se começa com unidade de disco ou UNC
    if re.match(r'^[A-Za-z]:[\\/]', texto) or re.match(r'^\\\\', texto):
        partes = texto.replace('\\', '/').split('/')
        partes = [p for p in partes if p and not re.match(r'^[A-Za-z]:$', p) and p != '']
        if len(partes) >= 2:
            return '/'.join(partes[-2:])
        return texto

    return texto
