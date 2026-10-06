"""O único lugar que sabe abrir a conexão com o LM Studio.

Eram quatro passos, sempre na mesma ordem, repetidos em **onze** pontos do
backend: ler `lm_studio_url` das configurações, cair no endereço de fábrica
quando não havia nada gravado, colar `/v1` no fim e abrir o cliente com a chave
fixa. Dez das onze cópias eram byte-a-byte idênticas. Trocar qualquer coisa no
jeito de conectar — um cabeçalho, um tempo de espera, o sufixo da API — era
editar onze arquivos e descobrir o esquecido em produção.

Não é um wrapper do SDK: o objeto devolvido é o `OpenAI` de sempre, e todo o
resto do código continua chamando `client.chat.completions.create(...)` igual.
O que este módulo concentra é só a **montagem**.

⚠️ O import do `openai` é local, dentro da função, e isso é de propósito: era
assim nos onze pontos originais. O SDK é pesado e nem todo caminho do programa
precisa dele — a aba Mapas, o Grafo de Imports e os outros agentes
determinísticos rodam sem LM Studio nenhum. Subir o import para o topo deste
módulo o tornaria obrigatório em qualquer `from .constantes import *`.
"""

from .padroes_de_fabrica import (
    ENDERECO_PADRAO_DO_LM_STUDIO,
    CHAVE_DA_API_DO_LM_STUDIO,
    SUFIXO_DA_API_COMPATIVEL,
)


def obter_endereco_do_lm_studio(settings):
    """O endereço escolhido pelo usuário, ou o de fábrica se não houver nenhum.

    Só a raiz (`http://localhost:1234`), sem sufixo de API — é o que a tela de
    Configurações usa para montar `/api/v0/models`, que não é a API compatível
    com a OpenAI e por isso não passa por `abrir_cliente_do_lm_studio`.
    """
    return (settings or {}).get('lm_studio_url', ENDERECO_PADRAO_DO_LM_STUDIO)


def abrir_cliente_do_lm_studio(settings, projeto=None, dono=None, **ajustes):
    """O cliente pronto para conversar com o LM Studio.

    `settings` é o dicionário devolvido por `load_settings()['settings']`.

    `projeto` é EM NOME DE QUEM esta conexão vai falar. Com ele, o cliente fica
    anotado em `PARADA_DO_PROJETO` e é **fechado** quando o usuário fecha a aba
    daquele projeto — é o que faz o LM Studio parar de gerar na hora, em vez de
    só na próxima fronteira do laço. Ver o cabeçalho de
    `agentes/parada_do_projeto.py`.

    ⚠️ Sem `projeto`, o cliente é anônimo e ninguém o fecha. É o certo para a
    sondagem de "o LM Studio está ligado?" (`chat_persistencia.py`), que não
    trabalha para projeto nenhum — e é o errado para qualquer chamada que gere
    conteúdo. Se você está abrindo cliente para uma rotina, um subagente ou o
    Designer, passe o projeto.

    `dono` é o id da rotina que abre o cliente — é por ele que "Desativar"
    acha a requisição dela e só ela.

    `**ajustes` vai direto para o construtor do SDK. Existe por causa de um
    caso real, e não por precaução: `chat_persistencia.py` precisa de
    `timeout=2.0, max_retries=0` para perguntar "o LM Studio está ligado?" sem
    travar a interface quando ele não está. Ver o comentário lá.
    """
    from openai import OpenAI

    base_url = obter_endereco_do_lm_studio(settings) + SUFIXO_DA_API_COMPATIVEL
    cliente = OpenAI(base_url=base_url, api_key=CHAVE_DA_API_DO_LM_STUDIO, **ajustes)
    if projeto:
        # Import local pelo mesmo motivo do `openai` acima: este módulo é
        # alcançado por caminhos que não têm nada a ver com projeto nenhum.
        from .agentes.parada_do_projeto import PARADA_DO_PROJETO
        PARADA_DO_PROJETO.registrar_cliente(projeto, cliente, dono)
    return cliente
