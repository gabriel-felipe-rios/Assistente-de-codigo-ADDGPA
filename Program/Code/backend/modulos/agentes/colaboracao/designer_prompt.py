from ...constantes import *
from .designer_dimensoes import DIMENSOES_DO_DESIGNER, BLOCO_DAS_REGRAS_INVIOLAVEIS

# A montagem modular do system prompt do Designer.
#
# Espelha `montar_blocos_subagentes` (agentes/execucao/subagentes.py): uma pasta
# `Blocos/` com um `.txt` por item, e a montagem junta SÓ os escolhidos, na ordem
# canônica, trocando um `{blocos_dimensoes}` no prompt-base. A diferença é que lá
# o item é um subagente ativo e aqui é uma dimensão escolhida.
#
# ⚠️ Bloco de dimensão NÃO escolhida nunca chega ao modelo. É o ponto central de
# o prompt ser modular: cinco dimensões somam no mesmo pedido, e quem paga a conta
# é o cheque de janela do `_erro_de_janela`.
#
# ⚠️ Sem prompt de reserva escrito em Python, aqui também. Arquivo de bloco
# faltando ESTOURA — a mesma decisão que tirou o prompt de quatro linhas de dentro
# do `_design_gerar`. Falha silenciosa em prompt só se descobre olhando o HTML
# gerado, e aí já foram quatro variações.


class DesignerPromptMixin:

    def montar_blocos_do_designer(self, escolhas):
        """Os blocos das dimensões escolhidas, na ordem canônica.

        `escolhas` é o que `_escolhas_do_designer` devolve: uma lista de
        (linha da dimensão, item, comentário). O bloco de cada dimensão aparece
        UMA vez, seguido dos itens escolhidos dela — com duas texturas, o texto
        explicativo não se repete.
        """
        partes = [self._ler_prompt(obter_bloco_do_designer(BLOCO_DAS_REGRAS_INVIOLAVEIS)).strip()]
        for d in DIMENSOES_DO_DESIGNER:
            desta = [(item, comentario) for linha, item, comentario in escolhas
                     if linha['campo'] == d['campo']]
            if not desta:
                continue
            partes.append(self._ler_prompt(obter_bloco_do_designer(d['bloco'])).strip())
            for item, comentario in desta:
                partes.append(self._corpo_do_item_escolhido(d, item, comentario))
        return '\n\n'.join(p for p in partes if p)

    @staticmethod
    def _corpo_do_item_escolhido(dimensao, item, comentario):
        """O conteúdo do item escolhido, pronto para colar embaixo do bloco."""
        linhas = ['· %s' % item['nome']]
        # A explicação da pasta acompanha a animação e delimita ONDE aquele
        # movimento se aplica. Sem ela o modelo pega a animação de troca de aba e
        # espalha pela interface inteira.
        if item.get('explicacao'):
            linhas.append('Onde este movimento se aplica:')
            linhas.append(item['explicacao'].strip())
        cerca = 'html' if dimensao['dimensao'] in ('estilos', 'animacoes') else 'json'
        linhas.append('```%s\n%s\n```' % (cerca, (item.get('conteudo') or '').strip()))
        # O comentário do usuário vem por ÚLTIMO, de propósito: ele sobrepõe a
        # regra padrão do bloco para aquele item ("essa textura só no botão
        # principal"), e o que vem depois é o que o modelo lê como mais recente.
        if comentario:
            linhas.append('Instrução do usuário para este item (vence a regra padrão acima): %s' % comentario)
        return '\n'.join(linhas)

    def montar_system_prompt_do_designer(self, base_prompt, escolhas):
        """O prompt-base com o `{blocos_dimensoes}` trocado pelos blocos."""
        return base_prompt.replace('{blocos_dimensoes}',
                                   self.montar_blocos_do_designer(escolhas)).strip()

    def montar_pedido_do_designer(self, project_name, chat_id, user_msg='',
                                  variacao_base_html=''):
        """O pedido INTEIRO que iria ao LM Studio, em texto, para copiar.

        Existe porque o arquivo da sessão é JSON com o HTML das variações dentro:
        dá para abrir, mas não dá para ler nem para colar noutro modelo. Com este
        texto na mão o usuário compara o mesmo pedido em outro agente e descobre se
        o resultado fraco é do prompt ou do modelo de 9B.

        ⚠️ Monta pelo MESMO caminho da geração (`_partes_do_prompt_do_designer`, e
        as escolhas DA SESSÃO). Escrever uma segunda montagem "só para copiar" daria
        dois textos que divergem na primeira mudança de bloco — e aí o que se cola
        noutro modelo deixa de ser o que este programa manda.
        """
        prefs = self.carregar_escolhas_da_sessao(project_name, chat_id)['escolhas']
        escolhas, sumiram = self._escolhas_do_designer(prefs)

        # Mesma regra do `_design_gerar`: com variação-base escolhida o prompt-base
        # é outro, e o estilo sai do pedido. Sem `try` de reserva — arquivo de prompt
        # faltando é erro, e aqui ele volta como erro para a tela.
        nome_do_prompt = 'refino.txt' if variacao_base_html else 'system-prompt.txt'
        try:
            with open(obter_prompt_do_assistente(PASTA_DESIGNER, nome_do_prompt),
                      'r', encoding='utf-8') as f:
                base_prompt = f.read()
        except Exception as e:
            return {'success': False, 'error': str(e)}

        paleta = next((item for linha, item, _c in escolhas if linha['campo'] == 'cor'), None)
        system_msg, user_content = self._partes_do_prompt_do_designer(
            base_prompt, escolhas, user_msg or '', variacao_base_html or '',
            self._resumo_paleta(paleta['conteudo']) if paleta else '')

        # Os dois papéis saem SEPARADOS e rotulados: colado num agente que só tem
        # uma caixa de texto, um bloco único faria as regras do sistema virarem
        # pedido do usuário.
        partes = []
        if sumiram:
            partes.append('(Escolha apontando para arquivo que não existe mais, e por '
                          'isso fora deste pedido: %s)\n' % ', '.join(sumiram))
        partes += ['=== SYSTEM ===', system_msg.strip(),
                   '', '=== USUÁRIO ===', user_content.strip()]
        return {'success': True, 'texto': '\n'.join(partes).strip() + '\n',
                'sumiram': sumiram, 'refinando': bool(variacao_base_html)}

    def _partes_do_prompt_do_designer(self, base_prompt, escolhas, user_msg,
                                      selected_variation_html, resumo_da_paleta):
        """(system, user) para as duas montagens — a 1ª rodada e o refino.

        Saiu de dentro do `_design_gerar` porque aquele arquivo já estava no limite
        da AMF, e porque a montagem é o que esta obra mais mexeu.

        As duas montagens, e por que são diferentes:

        1ª rodada → system: system-prompt.txt + os blocos das dimensões escolhidas
                    user:   o pedido
        refino    → system: refino.txt + os blocos + a paleta achatada numa linha
                    user:   o HTML da variação-base + o pedido

        No refino o ESTILO de referência não é reenviado: o layout dele já está
        materializado dentro da variação-base, e mandar os dois somava ~4 KB de
        HTML por chamada em cima dos ~14 KB da variação — era isso, com a paleta em
        JSON completo, que estourava a janela do modelo.
        """
        if selected_variation_html:
            # No refino entram todas as dimensões MENOS estilo (já materializado)
            # e cor (vai achatada em uma linha, logo abaixo).
            magras = [e for e in escolhas if e[0]['campo'] not in ('estilo', 'cor')]
            system_parts = [self.montar_system_prompt_do_designer(base_prompt, magras)]
            if resumo_da_paleta:
                system_parts.append('\n[PALETA OBRIGATÓRIA] Use EXATAMENTE estes hexadecimais, sem alterar:')
                system_parts.append(resumo_da_paleta)
            user_parts = [
                '[VARIAÇÃO SELECIONADA] Use como base e aplique os refinamentos solicitados:',
                '```html\n%s\n```' % selected_variation_html,
                '\n[REFINAMENTOS]',
                user_msg,
            ]
        else:
            system_parts = [self.montar_system_prompt_do_designer(base_prompt, escolhas)]
            user_parts = [user_msg]
        return '\n'.join(system_parts), '\n'.join(user_parts)
