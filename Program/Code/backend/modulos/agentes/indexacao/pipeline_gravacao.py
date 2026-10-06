"""Pipeline — o que vai para o disco: o `_niveis.json` e os `.md` de cada nível.

A pergunta deste arquivo: «como a árvore vira arquivo?». Tudo é montado pelo
programa: nomes de arquivo, ordem e agrupamento nunca vêm do modelo — só os
nomes, os resumos e as frases. A Visão geral (`pipeline.md`) é montada sem
modelo nenhum (D24).

  pipeline.md        a Visão geral: as áreas com a frase de cada uma, e o B0
  areas/A1.md        uma área: os blocos dela e as ligações
  blocos/B1.md       um bloco: os arquivos da comunidade, as cadeias e as ligações
  cadeias/C1.md      uma cadeia: «começa em» e os passos, na linha de sempre
  _niveis.json       a estrutura inteira (contrato do Pipeline em níveis)

`_pl_md_legado` monta, do `_niveis.json`, o texto no formato de antes (todas as
cadeias com as linhas de passo): é o que a leitura «Markdown» de Visualizar
pipeline mostra. Ele mora aqui, ao lado de quem escreve a linha do passo, para
os dois nunca divergirem.
"""
import json
import os
from datetime import datetime

from .pipeline_constantes import (
    _PL_NOME_SEM_ENTRADA, _PL_RESUMO_SEM_ENTRADA, _PL_PASTAS_DE_NOS,
)


class PipelineGravacaoMixin:

    # ── A estrutura ──────────────────────────────────────────────────────────

    def _pl_montar_niveis(self, esqueleto, prep):
        """O `_niveis.json`, com as chaves e a ordem do contrato."""
        textos, frases = prep['textos'], prep['frases']
        cadeias = []
        for c in esqueleto['cadeias']:
            t = textos['cadeias'].get(c['cabeca']) or {}
            cadeias.append({
                'id': c['id'], 'nome': t.get('nome', ''), 'resumo': t.get('resumo', ''),
                'bloco': c['bloco'], 'cabeca': c['cabeca'], 'tipo': c['tipo'],
                'emoji': c['emoji'],
                'passos': [{'ordem': p['ordem'], 'fase': p['fase'], 'origem': p['origem'],
                            'destino': p['destino'], 'via': p['via'],
                            'frase': frases.get(p['_chave'], ''), 'selos': p['selos']}
                           for p in c['passos']],
            })

        def ligacoes(grupo, t):
            return [{'para': l['para'], 'chamadas': l['chamadas'],
                     'frase': (t.get('ligacoes') or {}).get(l['para_rotulo'], '')}
                    for l in grupo['ligacoes']]

        blocos = []
        for b in esqueleto['blocos']:
            ids = [c['id'] for c in b['cadeias']]
            if b.get('sem_entrada'):
                blocos.append({'id': b['id'], 'nome': _PL_NOME_SEM_ENTRADA,
                               'resumo': _PL_RESUMO_SEM_ENTRADA, 'area': None,
                               'arquivos': [], 'cadeias': ids, 'ligacoes': [],
                               'sem_entrada': True})
                continue
            t = textos['blocos'].get(b['rotulo']) or {}
            blocos.append({'id': b['id'], 'nome': t.get('nome', ''), 'resumo': t.get('resumo', ''),
                           'area': b['area'], 'arquivos': b['arquivos'], 'cadeias': ids,
                           'ligacoes': ligacoes(b, t)})
        areas = []
        for a in esqueleto['areas']:
            t = textos['areas'].get(a['rotulo']) or {}
            areas.append({'id': a['id'], 'nome': t.get('nome', ''), 'resumo': t.get('resumo', ''),
                          'blocos': [b['id'] for b in a['blocos']], 'ligacoes': ligacoes(a, t)})

        unicos = {(p['origem'], p['destino'], p['via'])
                  for c in esqueleto['cadeias'] for p in c['passos']}
        return {
            'gerado_em': datetime.now().strftime('%d/%m/%Y %H:%M'),
            'contagem': {'areas': len(areas), 'blocos': len(blocos), 'cadeias': len(cadeias),
                         'passos': len(unicos), 'total_bruto': esqueleto['total_bruto']},
            'hubs': esqueleto['hubs'],
            'mortas': esqueleto['mortas'],
            'areas': areas,
            'blocos': blocos,
            'cadeias': cadeias,
        }

    # ── Pedaços de texto ─────────────────────────────────────────────────────

    @staticmethod
    def _pl_lista(itens, teto=8):
        """Lista curta que diz quanto ficou de fora dela mesma — nem a lista
        resume em silêncio."""
        visiveis = ', '.join('`%s`' % i for i in itens[:teto])
        sobra = len(itens) - teto
        return visiveis + (' e mais %d' % sobra if sobra > 0 else '')

    @staticmethod
    def _pl_contar(n, singular, plural):
        return '%d %s' % (n, singular if n == 1 else plural)

    @staticmethod
    def _pl_nome(no, palavra):
        """O nome do nó, ou «Bloco 7» enquanto o modelo não deu um."""
        return (no.get('nome') or '').strip() or '%s %s' % (palavra, no['id'][1:])

    def _pl_rotulo_da_cadeia(self, c):
        return ('%s %s' % (c.get('emoji') or '', self._pl_nome(c, 'Cadeia'))).strip()

    @staticmethod
    def _pl_linha_do_passo(p):
        """A linha de passo de sempre — é o formato que os leitores conhecem."""
        frase = (p.get('frase') or '').strip() or '(sem descrição)'
        selo = ''
        if p.get('selos'):
            selo = ' · **selos:** %s' % ', '.join('`+%s`' % s for s in p['selos'])
        return '- **%d** · fase %d · `%s` → `%s` **via** `%s` — %s%s' % (
            p['ordem'], p['fase'], p['origem'], p['destino'], p['via'], frase, selo)

    def _pl_avisos(self, niveis):
        """Todo corte aparece — esconder sem avisar é o pecado da versão antiga."""
        linhas = []
        if niveis['hubs']:
            linhas += ['', '> ⚠️ **%d hubs fora do fluxo** (viram selo `+nome`, não seta): %s'
                       % (len(niveis['hubs']), self._pl_lista(niveis['hubs']))]
        if niveis['mortas']:
            linhas += ['', '> ⚠️ **%d ilhas descartadas** por serem código morto (menos de '
                       '2 passos e nenhum rastro de execução): %s'
                       % (len(niveis['mortas']), self._pl_lista(niveis['mortas']))]
        return linhas

    def _pl_linhas_de_ligacao(self, grupo, nomes, palavra_vazia):
        if not grupo['ligacoes']:
            return ['_%s_' % palavra_vazia]
        return ['- → **%s · %s** · %s — %s' % (
                    l['para'], nomes.get(l['para'], l['para']),
                    self._pl_contar(l['chamadas'], 'chamada', 'chamadas'),
                    (l.get('frase') or '').strip() or '(sem frase)')
                for l in grupo['ligacoes']]

    # ── Os quatro documentos ─────────────────────────────────────────────────

    def _pl_md_visao_geral(self, niveis):
        k = niveis['contagem']
        blocos = {b['id']: b for b in niveis['blocos']}
        linhas = ['# Pipeline de execução — Visão geral', '',
                  '> O fluxo do projeto em quatro níveis: áreas → blocos → cadeias → passos.',
                  '> Os agrupamentos saem do grafo de chamadas, sem IA; os nomes, os resumos e',
                  '> as frases foram escritos por um modelo local. Esta página é montada pelo',
                  '> programa, sem modelo.',
                  '',
                  '_%s · %s · %s · %s · gerado em %s_' % (
                      self._pl_contar(k['areas'], 'área', 'áreas'),
                      self._pl_contar(k['blocos'], 'bloco', 'blocos'),
                      self._pl_contar(k['cadeias'], 'cadeia', 'cadeias'),
                      self._pl_contar(k['passos'], 'passo', 'passos'), niveis['gerado_em'])]
        linhas += self._pl_avisos(niveis)
        for a in niveis['areas']:
            n_cadeias = sum(len(blocos[i]['cadeias']) for i in a['blocos'])
            linhas += ['', '## %s · %s' % (a['id'], self._pl_nome(a, 'Área')), '',
                       (a.get('resumo') or '').strip() or '(sem resumo)', '',
                       '_%s · %s · detalhe em `areas/%s.md`_' % (
                           self._pl_contar(len(a['blocos']), 'bloco', 'blocos'),
                           self._pl_contar(n_cadeias, 'cadeia', 'cadeias'), a['id']), '']
            linhas += ['- **%s** · %s — %s' % (i, self._pl_nome(blocos[i], 'Bloco'),
                                               self._pl_contar(len(blocos[i]['cadeias']),
                                                               'cadeia', 'cadeias'))
                       for i in a['blocos']]
        for b in niveis['blocos']:
            if b.get('sem_entrada'):
                linhas += ['', '## %s · %s' % (b['id'], b['nome']), '', b['resumo'], '',
                           '_%s · detalhe em `blocos/%s.md`_' % (
                               self._pl_contar(len(b['cadeias']), 'cadeia', 'cadeias'), b['id'])]
        return '\n'.join(linhas) + '\n'

    def _pl_md_area(self, niveis, a):
        blocos = {b['id']: b for b in niveis['blocos']}
        nomes = {x['id']: self._pl_nome(x, 'Área') for x in niveis['areas']}
        n_cadeias = sum(len(blocos[i]['cadeias']) for i in a['blocos'])
        linhas = ['# %s · %s' % (a['id'], self._pl_nome(a, 'Área')), '',
                  (a.get('resumo') or '').strip() or '(sem resumo)', '',
                  '_%s · %s_' % (self._pl_contar(len(a['blocos']), 'bloco', 'blocos'),
                                 self._pl_contar(n_cadeias, 'cadeia', 'cadeias')),
                  '', '## Blocos']
        for i in a['blocos']:
            b = blocos[i]
            linhas += ['', '### %s · %s' % (b['id'], self._pl_nome(b, 'Bloco')), '',
                       (b.get('resumo') or '').strip() or '(sem resumo)', '',
                       '_%s · detalhe em `blocos/%s.md`_' % (
                           self._pl_contar(len(b['cadeias']), 'cadeia', 'cadeias'), b['id'])]
        linhas += ['', '## Ligações', '']
        linhas += self._pl_linhas_de_ligacao(a, nomes, 'Nenhuma ligação com outra área.')
        return '\n'.join(linhas) + '\n'

    def _pl_md_bloco(self, niveis, b):
        cadeias = {c['id']: c for c in niveis['cadeias']}
        areas = {a['id']: a for a in niveis['areas']}
        nomes = {x['id']: self._pl_nome(x, 'Bloco') for x in niveis['blocos']}
        onde = ('_Fora de qualquer área — o fim da árvore._' if b.get('sem_entrada') else
                '_Área %s · %s_' % (b['area'], self._pl_nome(areas[b['area']], 'Área')))
        contagem = self._pl_contar(len(b['cadeias']), 'cadeia', 'cadeias')
        if b['arquivos']:
            contagem += ' · ' + self._pl_contar(len(b['arquivos']), 'arquivo', 'arquivos')
        linhas = ['# %s · %s' % (b['id'], self._pl_nome(b, 'Bloco')), '', onde, '',
                  (b.get('resumo') or '').strip() or '(sem resumo)', '', '_%s_' % contagem]
        if b['arquivos']:
            linhas += ['', '## Arquivos', ''] + ['- `%s`' % f for f in b['arquivos']]
        linhas += ['', '## Cadeias']
        for i in b['cadeias']:
            c = cadeias[i]
            linhas += ['', '### %s · %s' % (c['id'], self._pl_rotulo_da_cadeia(c)), '',
                       (c.get('resumo') or '').strip() or '(sem resumo)', '',
                       '_começa em `%s`%s · %s · detalhe em `cadeias/%s.md`_' % (
                           c['cabeca'], ' · %s' % c['tipo'] if c['tipo'] else '',
                           self._pl_contar(len(c['passos']), 'passo', 'passos'), c['id'])]
        if not b.get('sem_entrada'):
            linhas += ['', '## Ligações', '']
            linhas += self._pl_linhas_de_ligacao(b, nomes, 'Nenhuma ligação com outro bloco.')
        return '\n'.join(linhas) + '\n'

    def _pl_md_cadeia(self, niveis, c):
        blocos = {b['id']: b for b in niveis['blocos']}
        areas = {a['id']: a for a in niveis['areas']}
        b = blocos[c['bloco']]
        onde = '_Bloco %s · %s' % (b['id'], self._pl_nome(b, 'Bloco'))
        if b.get('area'):
            onde += ' · Área %s · %s' % (b['area'], self._pl_nome(areas[b['area']], 'Área'))
        n_fases = len({p['fase'] for p in c['passos']})
        linhas = ['# %s · %s' % (c['id'], self._pl_rotulo_da_cadeia(c)), '', onde + '_', '',
                  (c.get('resumo') or '').strip() or '(sem resumo)', '',
                  '_começa em `%s`%s · %s · %s_' % (
                      c['cabeca'], ' · %s' % c['tipo'] if c['tipo'] else '',
                      self._pl_contar(len(c['passos']), 'passo', 'passos'),
                      self._pl_contar(n_fases, 'fase', 'fases')), '']
        linhas += [self._pl_linha_do_passo(p) for p in c['passos']]
        return '\n'.join(linhas) + '\n'

    def _pl_md_legado(self, niveis):
        """Todas as cadeias com as linhas de passo, no formato de antes da obra.

        Não vai para o disco: é o texto da leitura «Markdown» de Visualizar
        pipeline e o `markdown` que os plugins recebem. `N passos · N fases`
        fica sempre no plural, como era — quem lê o formato antigo casa isso.
        """
        cadeias = niveis['cadeias']
        total = sum(len(c['passos']) for c in cadeias)
        linhas = ['# Pipeline de execução', '',
                  '> Cadeias extraídas do grafo de chamadas: cada uma começa num arquivo com',
                  '> rastro e segue as chamadas até outro começo ou até o nível configurado.',
                  '> As descrições foram escritas por um modelo local; os nomes, a ordem e o',
                  '> agrupamento, não.',
                  '',
                  '_%d passos · %d cadeias · gerado em %s_' % (total, len(cadeias),
                                                              niveis['gerado_em'])]
        linhas += self._pl_avisos(niveis)
        for c in cadeias:
            n_fases = len({p['fase'] for p in c['passos']})
            linhas += ['', '## %s · %s' % (c['id'], self._pl_rotulo_da_cadeia(c)), '',
                       '_começa em `%s`%s · %d passos · %d fases_' % (
                           c['cabeca'], ' · %s' % c['tipo'] if c['tipo'] else '',
                           len(c['passos']), n_fases),
                       '']
            linhas += [self._pl_linha_do_passo(p) for p in c['passos']]
        return '\n'.join(linhas) + '\n'

    # ── A gravação ───────────────────────────────────────────────────────────

    @staticmethod
    def _pl_escrever(caminho, texto):
        """Escreve por cima sem deixar arquivo pela metade: `.tmp` + troca."""
        temporario = caminho + '.tmp'
        with open(temporario, 'w', encoding='utf-8') as f:
            f.write(texto)
        os.replace(temporario, caminho)

    def _pl_gravar(self, project_name, niveis):
        """Grava tudo no fim da passada e apaga os nós que sumiram. → caracteres
        dos `.md` gravados.

        O `_niveis.json` vai POR ÚLTIMO: quem o lê nunca vê uma estrutura que
        aponta para um `.md` ainda não escrito.
        """
        pasta = self._pl_dir(project_name)
        for sub in _PL_PASTAS_DE_NOS:
            os.makedirs(os.path.join(pasta, sub), exist_ok=True)
        arquivos = {'pipeline.md': self._pl_md_visao_geral(niveis)}
        for a in niveis['areas']:
            arquivos['areas/%s.md' % a['id']] = self._pl_md_area(niveis, a)
        for b in niveis['blocos']:
            arquivos['blocos/%s.md' % b['id']] = self._pl_md_bloco(niveis, b)
        for c in niveis['cadeias']:
            arquivos['cadeias/%s.md' % c['id']] = self._pl_md_cadeia(niveis, c)
        arquivos['_niveis.json'] = json.dumps(niveis, ensure_ascii=False, indent=2)

        for rel, texto in arquivos.items():
            self._pl_escrever(os.path.join(pasta, *rel.split('/')), texto)
        for sub in _PL_PASTAS_DE_NOS:
            for nome in os.listdir(os.path.join(pasta, sub)):
                if '%s/%s' % (sub, nome) not in arquivos:
                    try:
                        os.remove(os.path.join(pasta, sub, nome))
                    except OSError:
                        pass
        return sum(len(t) for rel, t in arquivos.items() if rel.endswith('.md'))
