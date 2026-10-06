"""Mapas › Pipeline › Mapa em níveis — o `_niveis.json` da rotina Pipeline, pronto para desenhar.

«Aqui se gera, lá desenha» (D56): quem ESCREVE áreas, blocos, cadeias,
passos e as frases das ligações é a rotina Pipeline, em Automação ›
Rotinas, que grava tudo em `_niveis.json`. Este arquivo só LÊ e arruma para
a tela. Nenhum modelo, nenhuma geração (D58) — o protótipo tinha aqui
`gerar_mapa_niveis` e as 5 passadas; saíram de vez.

Os cinco níveis, do macro ao micro: 1 Áreas · 2 Blocos · 3 Cadeias ·
4 Arquivos · 5 Funções. Os níveis 4 e 5 saem dos passos de cada cadeia, sem
modelo. A frase de cada arquivo é a Síntese da Documentação Técnica dele (a
primeira frase no cartão, a Síntese inteira no painel); arquivo sem Síntese
ganha uma frase por molde, montada aqui (`_mn_frase_automatica`).

Não há cálculo de «velho»: o `pipeline.md` e o `_niveis.json` saem da
mesma gravação da rotina.
"""

import json as _json

from .constantes import *


# A área de mentira que abriga o bloco «Sem ponto de entrada» (B0), que a
# rotina grava sem área. No mapa ele precisa de um pai no nível 1.
_MN_AREA_SEM_ENTRADA = 'A0'


class MapaNiveisMixin:
    """A sub-aba `Mapas › Pipeline › Mapa em níveis`."""

    # ── Leitura ───────────────────────────────────────────────────────────────

    def _mn_niveis_path(self, project_name):
        return obter_pasta_da_rotina(project_name, 'pipeline', '_niveis.json')

    def _mn_ler_niveis(self, project_name):
        path = self._mn_niveis_path(project_name)
        if not os.path.isfile(path):
            return None
        try:
            with open(path, 'r', encoding='utf-8') as f:
                dados = _json.load(f)
        except Exception:
            return None
        return dados if isinstance(dados, dict) else None

    @staticmethod
    def _mn_sintese(estado, arquivo):
        """(primeira frase, Síntese inteira) da Documentação Técnica do
        arquivo, ou ('', '') se ele ainda não tem Síntese. A primeira frase
        sai pela mesma regra do Índice de navegação."""
        texto = ((estado.get(arquivo) or {}).get('sintese') or '').strip()
        if not texto or texto == '(sem síntese)':
            return '', ''
        return texto.split('. ')[0].strip(' .') + '.', texto

    @staticmethod
    def _mn_cadeia(c):
        """A cadeia do `_niveis.json` no formato que o mapa usa."""
        emoji = c.get('emoji') or ''
        nome = (c.get('nome') or c['id']).strip()
        if emoji and nome.startswith(emoji):
            nome = nome[len(emoji):].strip()
        passos = [{'n': p['ordem'], 'fase': p['fase'], 'de': p['origem'], 'para': p['destino'],
                   'via': p['via'], 'descricao': p.get('frase') or '', 'selos': p.get('selos') or []}
                  for p in c.get('passos') or []]
        return {'id': c['id'], 'icone': emoji, 'gatilho': c.get('tipo') or '',
                'comeca_em': c.get('cabeca') or '', 'nome': nome,
                'resumo': c.get('resumo') or '', 'bloco': c.get('bloco'), 'passos': passos}

    @staticmethod
    def _mn_arquivos(cadeia, estado):
        """Níveis 4 e 5: os arquivos da cadeia, a fase de cada um e as funções
        que ele atende e chama. Tudo vem dos passos — nenhuma chamada ao
        modelo. A frase do arquivo é a Síntese da Documentação Técnica."""
        arquivos = {}
        for p in cadeia['passos']:
            for lado in ('de', 'para'):
                arquivos.setdefault(p[lado], {'arquivo': p[lado], 'recebe': [], 'chama': []})
            arquivos[p['de']]['chama'].append(p)
            if p['para'] != p['de']:
                arquivos[p['para']]['recebe'].append(p)

        saida = []
        for a in arquivos.values():
            # a fase é a primeira em que o arquivo chama; quem só recebe fica
            # uma fase depois de quem o chamou por último
            fases_chama = [p['fase'] for p in a['chama']]
            fase = min(fases_chama) if fases_chama else max(p['fase'] for p in a['recebe']) + 1
            funcoes, vistas = [], set()
            for p in a['recebe']:
                if ('r', p['via']) in vistas:
                    continue
                vistas.add(('r', p['via']))
                funcoes.append({'dir': 'recebe', 'nome': p['via'], 'outro': p['de'],
                                'descricao': p['descricao'], 'n': p['n']})
            for p in a['chama']:
                if ('c', p['via'], p['para']) in vistas:
                    continue
                vistas.add(('c', p['via'], p['para']))
                funcoes.append({'dir': 'chama', 'nome': p['via'], 'outro': p['para'],
                                'descricao': p['descricao'], 'n': p['n']})
            primeiro = min([p['n'] for p in a['chama']] + [p['n'] + 0.5 for p in a['recebe']])
            frase, sintese = MapaNiveisMixin._mn_sintese(estado, a['arquivo'])
            saida.append({'arquivo': a['arquivo'], 'fase': fase, 'primeiro': primeiro,
                          'descricao': frase or MapaNiveisMixin._mn_frase_automatica(a['recebe'], a['chama']),
                          'sintese': sintese, 'descricao_da_documentacao': bool(frase),
                          'funcoes': funcoes})
        return sorted(saida, key=lambda x: (x['fase'], x['primeiro']))

    @staticmethod
    def _mn_frase_automatica(recebe, chama):
        """A frase do arquivo montada por molde, sem modelo. É o que aparece
        quando o arquivo ainda não tem Síntese na Documentação Técnica."""
        base = lambda c: c.rsplit('/', 1)[-1]

        def curta(itens, maximo=3):
            itens = list(dict.fromkeys(itens))
            if len(itens) <= maximo:
                return ', '.join(itens)
            return ', '.join(itens[:maximo]) + f' e mais {len(itens) - maximo}'

        vias_r = [p['via'] for p in recebe]
        vias_c = [p['via'] for p in chama]
        alvos = [base(p['para']) for p in chama]
        if recebe and chama:
            return f'Atende {curta(vias_r, 2)} e em seguida chama {curta(vias_c, 2)} em {curta(alvos, 2)}.'
        if chama:
            return f'Dispara {curta(vias_c)} em {curta(alvos, 2)}.'
        return f"Atende {curta(vias_r)}, pedido por {curta([base(p['de']) for p in recebe], 2)}."

    @staticmethod
    def _mn_ligacoes(itens):
        """As ligações de saída de cada área (ou bloco), achatadas em
        `{de, para, chamadas, frase}` — a frase é a que a rotina escreveu."""
        return [{'de': x['id'], 'para': lig['para'], 'chamadas': lig.get('chamadas', 0),
                 'frase': lig.get('frase') or ''}
                for x in itens for lig in x.get('ligacoes') or []]

    def get_mapa_niveis_result(self, project_name):
        """O `_niveis.json` em 5 níveis, pronto para a tela desenhar.

        Sem `_niveis.json` (a rotina Pipeline nunca rodou neste projeto, ou
        rodou numa versão de antes dos níveis), devolve `success: False` com
        `sem_pipeline: True` e o texto que a tela mostra.
        """
        niveis = self._mn_ler_niveis(project_name)
        if not niveis or not niveis.get('cadeias'):
            return {'success': False, 'sem_pipeline': True,
                    'error': 'O Pipeline deste projeto ainda não foi gerado. Quem gera é a '
                             'rotina Pipeline, em Automação › Rotinas — rode-a e volte aqui.'}

        estado = self._dt_load_estado(project_name)
        cadeias = []
        for c in niveis['cadeias']:
            cadeia = self._mn_cadeia(c)
            cadeia['arquivos'] = self._mn_arquivos(cadeia, estado)
            cadeias.append(cadeia)

        blocos = [{'id': b['id'], 'nome': b.get('nome') or b['id'],
                   'descricao': b.get('resumo') or '', 'area': b.get('area'),
                   'arquivos': b.get('arquivos') or [], 'cadeias': b.get('cadeias') or [],
                   'sem_entrada': bool(b.get('sem_entrada'))}
                  for b in niveis.get('blocos') or []]
        areas = [{'id': a['id'], 'nome': a.get('nome') or a['id'],
                  'descricao': a.get('resumo') or '', 'blocos': a.get('blocos') or [],
                  'sem_entrada': False}
                 for a in niveis.get('areas') or []]

        # O B0 («Sem ponto de entrada») não tem área: ganha a área A0, no fim,
        # com o nome e a frase dele — que são fixos, escritos pelo programa.
        soltos = [b for b in blocos if not b['area']]
        if soltos:
            for b in soltos:
                b['area'] = _MN_AREA_SEM_ENTRADA
            areas.append({'id': _MN_AREA_SEM_ENTRADA, 'nome': 'Sem ponto de entrada',
                          'descricao': soltos[0]['descricao'],
                          'blocos': [b['id'] for b in soltos], 'sem_entrada': True})

        contagem = niveis.get('contagem') or {}
        resumo = {'passos': contagem.get('passos') or sum(len(c['passos']) for c in cadeias),
                  'cadeias': len(cadeias), 'gerado_em': niveis.get('gerado_em') or ''}

        return {'success': True, 'projeto': project_name, 'resumo': resumo,
                'areas': areas, 'blocos': blocos, 'cadeias': cadeias,
                'ligacoes_areas': self._mn_ligacoes(niveis.get('areas') or []),
                'ligacoes_blocos': self._mn_ligacoes(niveis.get('blocos') or []),
                'hubs': niveis.get('hubs') or []}
