from ...constantes import *
from .designer_dimensoes import (DIMENSOES_DO_DESIGNER, BLOCO_DAS_REGRAS_INVIOLAVEIS,
                                 PREFERENCIAS_VAZIAS)

# O custo em tokens de cada bloco do prompt, para a aba Contexto do Designer.
#
# Existe porque dava para mandar gerar variação atrás de variação sem saber quanto
# da janela do modelo já tinha sido usada — e o estouro só aparecia quando o
# LM Studio matava a geração no meio do stream.
#
# ⚠️ Não escreve contagem nova. Usa `contar_tokens_textos` (`configuracoes.py`),
# que é a mesma contagem do tiktoken que o resto do projeto usa. Estimar token
# dividindo caracteres por quatro é justamente o que aquela função existe para
# aposentar.


class DesignerContextoMixin:

    def carregar_contexto_do_designer(self, project_name, chat_id=None, refinando=False):
        """A repartição da janela: um bloco por linha, com selo de enviado.

        O bloco de uma dimensão NÃO escolhida também aparece na lista, marcado
        como não enviado e com custo zero — é o que deixa visível que ele existe e
        que escolher aquela dimensão tem um preço.
        """
        # As escolhas DA SESSÃO — as mesmas que a geração vai usar. Ler o padrão
        # do projeto aqui faria a aba anunciar um custo que não é o do pedido.
        # Sem sessão aberta (a aba pode ser aberta antes), a conta é a do vazio.
        prefs = (self.carregar_escolhas_da_sessao(project_name, chat_id)['escolhas']
                 if chat_id else dict(PREFERENCIAS_VAZIAS))
        escolhas, sumiram = self._escolhas_do_designer(prefs)

        base_nome = 'refino.txt' if refinando else 'system-prompt.txt'
        blocos = [{
            'chave': 'base',
            'rotulo': 'Prompt base · %s' % base_nome,
            'enviado': True,
            'texto': self._ler_prompt(obter_prompt_do_assistente(PASTA_DESIGNER, base_nome)),
        }, {
            'chave': 'regras',
            'rotulo': 'Regras invioláveis',
            'enviado': True,
            'texto': self._ler_prompt(obter_bloco_do_designer(BLOCO_DAS_REGRAS_INVIOLAVEIS)),
        }]

        for d in DIMENSOES_DO_DESIGNER:
            desta = [(item, comentario) for linha, item, comentario in escolhas
                     if linha['campo'] == d['campo']]
            # No refino o estilo não é reenviado (já está materializado na
            # variação-base) e a paleta vai achatada — a aba tem de dizer isso,
            # senão o número não bate com o que o modelo recebeu.
            enviado = bool(desta) and not (refinando and d['campo'] == 'estilo')
            texto = ''
            if enviado:
                texto = self._ler_prompt(obter_bloco_do_designer(d['bloco']))
                for item, comentario in desta:
                    texto += '\n' + self._corpo_do_item_escolhido(d, item, comentario)
            blocos.append({
                'chave': d['campo'],
                'rotulo': 'Bloco · %s' % d['rotulo'],
                'enviado': enviado,
                'quantos': len(desta),
                'texto': texto,
            })

        contagem = self.contar_tokens_textos([b['texto'] for b in blocos])
        for bloco in blocos:
            bloco['tokens'] = self.contar_tokens_textos([bloco['texto']])['tokens']
            # O texto em si não volta para a tela: são dezenas de KB de HTML e
            # JSON, e a aba só mostra rótulo, selo e número.
            del bloco['texto']

        return {
            'success': True,
            'blocos': blocos,
            'total': contagem['tokens'],
            'exata': contagem['exata'],
            'refinando': bool(refinando),
            # Escolha que aponta para arquivo que não existe mais. A tela avisa em
            # vez de deixar o usuário descobrir pelo HTML gerado sem paleta.
            'sumiram': sumiram,
        }
