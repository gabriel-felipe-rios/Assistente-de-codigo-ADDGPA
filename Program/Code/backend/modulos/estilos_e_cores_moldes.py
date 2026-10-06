from .constantes import *

# Os moldes de item novo da biblioteca de aparência — um por dimensão.
#
# Módulo próprio porque é conteúdo, não lógica: junto do CRUD o arquivo passava
# de 400 linhas, e a maior parte delas era texto de molde que ninguém precisa ler
# para entender como criar ou excluir um item.
#
# O equivalente do `_gravar_molde_regra` de `arquivos.py`, com a diferença que
# aqui o molde é sempre UM ARQUIVO, nunca uma pasta.

# Paleta de reserva dos moldes de HTML. É ela que deixa o arquivo legível aberto
# sozinho no navegador — e é ela que a Parte 3 sobrescreve para tingir a
# miniatura com a paleta escolhida. Um molde sem isto nasce impossível de tingir.
RESERVA_DE_CORES = """/* Paleta de reserva — o Designer troca estas variáveis pela paleta escolhida.
   Elas existem para o arquivo continuar legível aberto sozinho no navegador, e
   são CINZAS de propósito: reserva é ausência de decisão de cor, e uma reserva
   colorida faz a biblioteca inteira parecer já ter uma paleta aplicada. Os cinco
   acentos diferem em VALOR para a hierarquia continuar legível. */
:root{
  --fundo:#1B1B1B; --superficie:#272727; --superficie-hover:#323232; --superficie-escura:#141414;
  --texto:#E8E8E8; --texto-secundario:#9B9B9B;
  --primaria:#B8B8B8; --positiva:#A0A0A0; --negativa:#7C7C7C; --especial:#8E8E8E; --utilitaria:#6C6C6C;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--fundo);color:var(--texto);height:100vh;overflow:hidden;
     font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:12px;line-height:1.45}
"""


class MoldesDeEstilosECoresMixin:

    # Os cinco papéis de acento, com o `_hover` de cada um: 6 papéis fixos + 5
    # acentos = 16 chaves, sempre. O molde já nasce no formato de PAPEL para
    # ninguém reintroduzir acento nomeado por cor (`lilas`, `magenta`) — o nome
    # bonito da cor mora no campo `apelido`, ao lado do papel.
    _PAPEIS_DE_ACENTO = (
        ('primaria',   'Ação primária, foco, borda de seleção ativa'),
        ('positiva',   'Confirmação, destaque positivo, badges de sucesso'),
        ('negativa',   'Deletar, rejeitar, erro'),
        ('especial',   'Destaque especial, aba ativa de modo especial'),
        ('utilitaria', 'Exportar, copiar, ações secundárias'),
    )

    # Cinzas, pelo mesmo motivo da reserva: paleta NOVA é paleta ainda não
    # decidida, e um esqueleto colorido faz parecer que a decisão já foi tomada.
    # Os acentos diferem em valor para o arquivo já abrir legível.
    _PAPEIS_FIXOS = (
        ('fundo',             '#1B1B1B', 'Fundo principal da aplicação'),
        ('superficie',        '#272727', 'Cards, painéis, sidebars — elementos sobre o fundo'),
        ('superficie_hover',  '#323232', 'Hover de elementos com cor superficie'),
        ('superficie_escura', '#141414', 'Topbar, barra de abas — tom de contraste para criar hierarquia'),
        ('texto',             '#E8E8E8', 'Todo texto principal'),
        ('texto_secundario',  '#9B9B9B', 'Texto de suporte: datas, metadados, placeholders'),
    )

    # O hexadecimal de partida de cada acento, na ordem de `_PAPEIS_DE_ACENTO`.
    _ACENTOS_DE_PARTIDA = (
        ('#B8B8B8', '#A6A6A6'), ('#A0A0A0', '#8E8E8E'), ('#7C7C7C', '#6A6A6A'),
        ('#8E8E8E', '#7C7C7C'), ('#6C6C6C', '#5A5A5A'),
    )

    @staticmethod
    def _molde_de_estilo(nome, descricao):
        return (
            '<!DOCTYPE html>\n'
            '<!-- Rascunho de estrutura: %s -->\n'
            '<!-- %s -->\n'
            '<html lang="pt-BR"><head><meta charset="UTF-8"><title>%s</title><style>\n'
            '%s'
            '.rot{color:var(--texto-secundario);font-size:9.5px;letter-spacing:.09em;'
            'text-transform:uppercase;font-weight:700}\n'
            'body{display:flex;flex-direction:column;padding:14px;gap:9px}\n'
            '</style></head><body>\n'
            '<div class="rot">Região — troque pelo nome de verdade</div>\n'
            '<div style="font-size:16px;font-weight:700">Título da tela</div>\n'
            '<div style="color:var(--texto-secundario)">Escreva o que cada bloco é. '
            'Retângulo sem rótulo não diz ao modelo se aquilo é barra lateral ou coluna de cards.</div>\n'
            '</body></html>\n'
        ) % (nome, descricao or 'descreva a estrutura em uma linha', nome, RESERVA_DE_CORES)

    @staticmethod
    def _molde_de_animacao(nome, descricao):
        return (
            '<!DOCTYPE html>\n'
            '<!-- Animação: %s -->\n'
            '<!-- %s -->\n'
            '<html lang="pt-BR"><head><meta charset="UTF-8"><title>%s</title><style>\n'
            '%s'
            'body{display:flex;flex-direction:column;gap:10px;padding:12px}\n'
            'h1{font-size:13.5px;font-weight:700}\n'
            '.palco{flex:1;min-height:0;background:var(--superficie-escura);'
            'border:1px solid var(--superficie-hover);border-radius:9px;'
            'display:flex;align-items:center;justify-content:center}\n'
            '.regra{background:var(--superficie);border:1px solid var(--superficie-hover);'
            'border-radius:9px;padding:9px 11px;font-size:11px}\n'
            '/* Acessibilidade: quem pediu menos movimento vê o estado final, sem transição. */\n'
            '@media (prefers-reduced-motion: reduce){\n'
            '  *,*::before,*::after{animation:none !important;transition:none !important}\n'
            '}\n'
            '</style></head><body>\n'
            '<h1>%s</h1>\n'
            '<div class="palco">demonstre o movimento aqui, em laço</div>\n'
            '<div class="regra">Duração: — · Curva: — · O que anima: — · O que nunca anima: —</div>\n'
            '</body></html>\n'
        ) % (nome,
             'A demonstração roda em laço; a regra escrita abaixo dela é o que vai ao modelo.',
             nome, RESERVA_DE_CORES, nome)

    @classmethod
    def _molde_de_paleta(cls, nome, descricao):
        cores = {}
        for chave, hexa, uso in cls._PAPEIS_FIXOS:
            cores[chave] = {'hex': hexa, 'uso': uso}
        for (chave, uso), (hexa, hexa_hover) in zip(cls._PAPEIS_DE_ACENTO, cls._ACENTOS_DE_PARTIDA):
            cores[chave] = {'hex': hexa, 'apelido': 'troque pelo nome da cor', 'uso': uso}
            cores[chave + '_hover'] = {'hex': hexa_hover,
                                       'apelido': 'troque pelo nome da cor (hover)',
                                       'uso': 'Hover de ' + chave}
        return {
            'nome': nome,
            'descricao': descricao or '',
            'instrucao': 'Use estas cores exatamente. Bordas entre seções: '
                         'rgba(255,255,255,0.07). Border-radius padrão: 8px.',
            'cores': cores,
        }

    @staticmethod
    def _molde_de_tipografia(nome, descricao):
        return {
            'nome': nome,
            'descricao': descricao or '',
            'instrucao': 'Aplique só família, peso, proporção da escala e entrelinha. '
                         'O tamanho-base do corpo e a densidade do espaçamento vêm do ESTILO, '
                         'não daqui.',
            'tipografia': {
                'familias': {'titulo': '', 'texto': '', 'mono': ''},
                'pesos': {'titulo': 600, 'texto': 400, 'enfase': 600},
                'escala': {'proporcao': 1.2, 'observacao': ''},
                'entrelinha': {'titulo': 1.25, 'texto': 1.45, 'compacto': 1.3},
            },
        }

    @staticmethod
    def _molde_de_textura(nome, descricao):
        return {
            'nome': nome,
            'descricao': descricao or '',
            'instrucao': 'Material de superfície. Aplique nos elementos listados em '
                         "'aplica_em' e em nenhum outro; as cores continuam vindo da paleta "
                         '— a textura só muda o acabamento.',
            'aplica_em': [],
            'nao_use_em': [],
            'css': '',
        }

    @classmethod
    def _molde_de_estilos_e_cores(cls, chave, nome, descricao):
        """O conteúdo de um item novo, já como texto pronto para gravar."""
        moldes = {
            'estilos':    cls._molde_de_estilo,
            'animacoes':  cls._molde_de_animacao,
            'cores':      cls._molde_de_paleta,
            'tipografia': cls._molde_de_tipografia,
            'texturas':   cls._molde_de_textura,
        }
        conteudo = moldes[chave](nome, descricao)
        if isinstance(conteudo, dict):
            return json.dumps(conteudo, ensure_ascii=False, indent=2) + '\n'
        return conteudo
