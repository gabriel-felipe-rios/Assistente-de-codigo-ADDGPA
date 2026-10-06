def preparar_mensagens(messages):
    """Prepara as mensagens para o LM Studio.

    Três coisas: tira os campos extras (meta), mescla os system do início em
    um só, e funde mensagens vizinhas de mesmo papel. As duas últimas
    existem pelo mesmo motivo — vários templates Jinja de modelo local
    exigem um único system na primeira posição e papéis alternados; o prompt
    fixo e as regras entram como `user` na cauda, junto da mensagem do
    usuário, e sem a fusão isso vira três `user` seguidos.

    Mora aqui, e não dentro do mixin do Chat, porque a Fila monta as
    mensagens do mesmo jeito: aviso do Contador, devolução do Verificador e
    complemento do usuário também produzem `user` seguidos."""
    out = [{'role': m['role'], 'content': m['content']} for m in messages]
    systems = []
    i = 0
    while i < len(out) and out[i]['role'] == 'system':
        systems.append(out[i]['content'])
        i += 1
    if len(systems) > 1:
        out = [{'role': 'system', 'content': '\n\n---\n\n'.join(systems)}] + out[i:]

    fundido = []
    for m in out:
        if fundido and fundido[-1]['role'] == m['role']:
            fundido[-1]['content'] += '\n\n' + m['content']
        else:
            fundido.append(dict(m))
    return fundido
