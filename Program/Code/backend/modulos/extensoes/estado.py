"""Quem está ligado, em que ordem, e com o destaque aceso ou não.

Este é o módulo que GRAVA — e é por ele que "ligar" e "desligar" passam a
significar alguma coisa no backend: ligar carrega o módulo e dispara o boot;
desligar chama `parar()` e larga o módulo. Tudo na mesma chamada, para a
extensão passar a funcionar (ou parar) **sem reiniciar o programa** (D13).

⚠️ Todo método devolve a árvore inteira, no formato de
`list_extensoes_programa`. É o contrato já registrado das outras categorias
que listam pasta: a tela repinta com o que foi de fato gravado, nunca com o
que deveria ter sido.
"""

import threading

from ..arvore_externa import gravar_json_de_config
from . import carga
from .constantes import (EXTENSOES_CONFIG_FILE, EXTENSOES_ORDER_FILE,
                         EXTENSOES_DESTAQUE_FILE, XT_DESTAQUE_PADRAO,
                         XT_DESTAQUE_CORES, XT_DESTAQUE_TIPOS, XT_TETO_CARGA_S)
from .boot import iniciar_uma
from .descarregar import descarregar
from .descoberta import (XtDescobertaMixin, ler_config, ler_destaque, extensao_existe,
                         listar_extensoes_recursivo, montar_arvore, achar_folha,
                         todas_as_folhas)


class XtEstadoMixin:
    def save_config_extensao_programa(self, caminho, patch):
        """Liga ou desliga UMA extensão, pelo caminho relativo dela.

        Efeito imediato — mesma regra do Interruptor, sem barra de Salvar. A
        gravação vem ANTES da carga: se `iniciar()` explodir, o estado no
        disco já é o que o usuário pediu, e reabrir o programa não desfaz o
        clique dele.
        """
        if not extensao_existe(caminho):
            return {'success': False, 'error': 'Extensão não encontrada.'}

        patch = dict(patch or {})
        # ⚠️ O arquivo guarda SÓ `{"ligado": bool}` (ver `constantes.py`), e
        # o patch vem da tela sem filtro: qualquer outra chave entraria no
        # JSON e nunca mais sairia. E um patch sem `ligado` mantém o estado
        # de agora — até 05/09/2026 ele caía em `False` e DESLIGAVA a extensão
        # sem gravar isso, então ela voltava ligada na próxima abertura.
        config = ler_config()
        estado = dict(config.get(caminho, {}))
        ligar = bool(patch.get('ligado', estado.get('ligado', False)))

        # Uma extensão com manifesto quebrado não pode ser ligada — o
        # interruptor dela já vem desabilitado na tela, mas a checagem
        # também mora aqui: a tela não é a fonte da verdade.
        arvore = montar_arvore()
        folha = achar_folha(arvore, caminho)
        if ligar and folha and not folha.get('ok'):
            return {'success': False,
                    'error': 'O extensao.json desta extensão tem erro: %s'
                             % '; '.join(folha.get('erros') or ['motivo desconhecido'])}

        # D42 · O prefixo é o DONO, e dois donos iguais não ligam juntos. A
        # checagem vem antes de gravar: sem ela o clique gravaria `ligado:
        # true`, a listagem a desligaria em seguida, e o interruptor "pularia"
        # sem explicação.
        prefixo = (folha or {}).get('prefixo')
        if ligar and prefixo:
            dona = next((f for f in todas_as_folhas(arvore)
                         if f['ligado'] and f['caminho'] != caminho
                         and f.get('prefixo') == prefixo), None)
            if dona:
                return {'success': False,
                        'error': 'O prefixo "%s" já é da extensão "%s", que está ligada. '
                                 'Desligue-a ou troque o prefixo.' % (prefixo, dona['nome'])}

        config[caminho] = {'ligado': ligar}
        try:
            gravar_json_de_config(EXTENSOES_CONFIG_FILE, config)
        except OSError as e:
            return {'success': False, 'error': str(e)}

        avisos = []
        if ligar:
            # G12 · A carga corre numa thread, e o interruptor espera no máximo
            # `XT_TETO_CARGA_S`: uma extensão de import lento não pode prender
            # a tela. Quem passa do teto continua carregando (thread não se
            # mata) e liga sozinha quando terminar.
            erros_da_carga = []

            def _carregar_e_iniciar():
                try:
                    ok, erro = carga.carregar(caminho)
                    if not ok:
                        erros_da_carga.append(erro)
                    # Mesmo com erro: `carregar` guarda o que conseguiu
                    # importar, e o boot que entrou tem de iniciar (silencioso
                    # quando não há boot).
                    iniciar_uma(caminho)
                    # ⚠️ A carga que termina DEPOIS de o usuário desligar tem
                    # de se desfazer: sem reler a config aqui, a extensão
                    # ficaria carregada, com o boot rodando e o interruptor
                    # desligado.
                    if not ler_config().get(caminho, {}).get('ligado'):
                        descarregar(caminho)
                except Exception as e:
                    erros_da_carga.append('falha ao ligar: %s' % e)

            t = threading.Thread(target=_carregar_e_iniciar,
                                 name='xt-carga-%s' % caminho, daemon=True)
            t.start()
            t.join(timeout=XT_TETO_CARGA_S)
            # `carga.esta_carregando`: religar enquanto a carga ANTERIOR ainda
            # corre volta na hora (a guarda contra carga dupla), e o aviso vale
            # do mesmo jeito.
            if t.is_alive() or carga.esta_carregando(caminho):
                avisos.append('A extensão "%s" ainda está carregando (passou de %s s). '
                              'Ela liga sozinha quando terminar.'
                              % (folha.get('nome') if folha else caminho, XT_TETO_CARGA_S))
            else:
                avisos.extend(erros_da_carga)
        else:
            avisos.extend(descarregar(caminho))

        resposta = self.list_extensoes_programa()
        if avisos:
            resposta['avisos'] = avisos + resposta.get('avisos', [])
        return resposta

    def save_extensoes_programa_order(self, ordem_por_pasta):
        """Grava, de uma vez, a ordem arrastada — um `{pasta pai: [nomes]}`
        para TODOS os níveis que estavam na tela, como em Plugins (e ao
        contrário de Launchers, que grava a cada pasta solta)."""
        try:
            gravar_json_de_config(EXTENSOES_ORDER_FILE, dict(ordem_por_pasta or {}))
        except OSError as e:
            return {'success': False, 'error': str(e)}
        return self.list_extensoes_programa()

    def save_extensoes_programa_destaque(self, patch):
        """O "Destacar extensões" (D2): liga/desliga, cor e tipo.

        ⚠️ Recebe um PATCH, e não os três valores. Os três mudam em momentos
        diferentes — o interruptor num clique, a cor noutro —, e mandar os três
        a cada mudança faria a tela ter de conhecer os outros dois: no dia em
        que ela lesse um deles de uma foto velha, o clique no interruptor
        devolveria a cor antiga sem ninguém pedir.

        Grava no clique, sem barra de Salvar — o efeito é visual e imediato.
        Valor desconhecido é ignorado em silêncio, e o campo fica como estava:
        recusar a gravação inteira por causa de uma cor errada deixaria o
        interruptor sem funcionar.
        """
        patch = dict(patch or {})
        atual = ler_destaque()
        novo = {
            'destacar': bool(patch.get('destacar', atual['destacar'])),
            'cor': atual['cor'],
            'tipo': atual['tipo'],
        }
        if str(patch.get('cor', '')) in XT_DESTAQUE_CORES:
            novo['cor'] = str(patch['cor'])
        if str(patch.get('tipo', '')) in XT_DESTAQUE_TIPOS:
            novo['tipo'] = str(patch['tipo'])

        try:
            gravar_json_de_config(EXTENSOES_DESTAQUE_FILE, novo)
        except OSError as e:
            return {'success': False, 'error': str(e)}
        return self.list_extensoes_programa()

    def reset_extensoes_programa(self):
        """Padrão de fábrica: toda extensão desligada e o destaque apagado.

        ⚠️ **Não apaga arquivo nenhum** (D22). Nem a pasta da extensão, nem o
        `files/` que ela gerou, nem o `config/preferencias.json` que o usuário
        preencheu. Restaurar o padrão desta categoria devolve o ESTADO ao de
        fábrica; o que a extensão produziu é do usuário.
        """
        avisos = []
        for caminho in carga.caminhos_carregados():
            avisos.extend(descarregar(caminho))

        config = {caminho: {'ligado': False} for caminho in listar_extensoes_recursivo()}
        try:
            gravar_json_de_config(EXTENSOES_CONFIG_FILE, config)
            gravar_json_de_config(EXTENSOES_DESTAQUE_FILE, dict(XT_DESTAQUE_PADRAO))
        except OSError as e:
            return {'success': False, 'error': str(e)}

        resposta = self.list_extensoes_programa()
        if avisos:
            resposta['avisos'] = avisos + resposta.get('avisos', [])
        return resposta


# Reexportado para `api.py` compor os dois Mixins numa linha só — quem lê e
# quem grava o mesmo estado andam juntos.
__all__ = ['XtEstadoMixin', 'XtDescobertaMixin']
