"""Pipeline — os dois níveis de cima no modelo: o bloco e a área, só o que mudou.

A pergunta deste arquivo: «o que vai ao prompt do bloco, e quando?». O MESMO
prompt (`prompts/Rotinas/pipeline-bloco.txt`) serve aos dois níveis (D24,
D58): a entrada é a lista de filhos (as cadeias do bloco, ou os blocos da
área) com nome e resumo, mais as ligações de saída; a saída é
`{nome, resumo, ligacoes: [{numero, frase}]}`.

A régua (D24), a mesma nos dois níveis: nome e resumo são refeitos se o grupo
é novo, se entrou ou saiu filho, ou se a fração de filhos com resumo novo
passou de «Refazer o bloco a partir de» / «Refazer a área a partir de». A
frase de uma ligação é refeita quando a ligação é nova ou quando o conjunto
de chamadas dela mudou. Se só ligações mudaram, a chamada pede só as frases.

A ordem é de baixo para cima (D14): um nível só vai ao modelo depois que o de
baixo terminou. Grupo com filho que nunca teve resumo fica ADIADO nesta
passada — sem chamada, e sem erro próprio: o erro é o do filho, e a passada
seguinte refaz os dois. O B0 («Sem ponto de entrada») nunca vai ao modelo.
"""
import copy
import hashlib
from concurrent.futures import ThreadPoolExecutor, as_completed

from modulos.agentes.llm_estruturado import chat_json, json_da_resposta, mensagens_da_rotina
from modulos.tokens import contar_tokens, calcular_orcamento, PortaoDeContexto
from ...llm_geracao import ajustes_da_chamada
from .pipeline_constantes import _PL_SCHEMA_BLOCO, _PL_CHAMADAS_POR_LIGACAO

# Por nível: onde moram os textos dele, os dos filhos, a chave da régua em
# Configurações e as palavras que vão ao envelope.
_PL_NIVEIS = {
    'bloco': {'textos': 'blocos', 'filhos': 'cadeias', 'limite': 'pipeline_bloco_refazer_pct',
              'nome': 'bloco', 'filhos_nome': 'cadeias', 'outro': 'o bloco das cadeias'},
    'area':  {'textos': 'areas', 'filhos': 'blocos', 'limite': 'pipeline_area_refazer_pct',
              'nome': 'área', 'filhos_nome': 'blocos', 'outro': 'a área dos blocos'},
}


class PipelineBlocosMixin:

    @staticmethod
    def _pl_md5(texto):
        return hashlib.md5((texto or '').encode('utf-8', 'replace')).hexdigest()

    def _pl_assinatura(self, passos):
        """O md5 do conjunto de chamadas de uma ligação: muda quando entra ou
        sai uma chamada, e só então a frase dela é refeita."""
        return self._pl_md5('\n'.join(sorted(self._pl_identidade(p) for p in passos)))

    @staticmethod
    def _pl_grupos_do_nivel(esqueleto, nivel):
        """`[(grupo, [(identidade do filho, filho)])]` — sem o B0.

        A identidade do filho é a cabeça (cadeia) ou o rótulo (bloco): é por
        ela que o `_passos.json` guarda o texto de cada um.
        """
        if nivel == 'bloco':
            return [(b, [(c['cabeca'], c) for c in b['cadeias']])
                    for b in esqueleto['blocos'] if not b.get('sem_entrada')]
        return [(a, [(b['rotulo'], b) for b in a['blocos']]) for a in esqueleto['areas']]

    @staticmethod
    def _pl_regua_do_grupo(velho, chave_filhos, md5s, limite_pct):
        """True = refazer o nome e o resumo do bloco (ou da área)."""
        if not velho or not velho.get('nome') or not velho.get('resumo'):
            return True
        antigo = velho.get(chave_filhos) or {}
        if set(antigo) != set(md5s):
            return True
        mudaram = sum(1 for k, h in md5s.items() if antigo.get(k) != h)
        return mudaram * 100 >= limite_pct * len(md5s)

    def _pl_preparar_nivel(self, esqueleto, nivel, prep, limites):
        """A régua de um nível de cima, sem chamar o modelo.

        Preenche `prep['textos'][blocos|areas]` com o que se reaproveita (e, em
        quem vai ser refeito, o texto antigo, que só fica se a chamada falhar)
        e devolve `[(grupo, filhos, pedir o nome e o resumo?, [ligações sem
        frase])]`. Pode rodar mais de uma vez na mesma passada: tudo o que
        marca no grupo é zerado no começo.
        """
        cfg = _PL_NIVEIS[nivel]
        textos_filhos = prep['textos'][cfg['filhos']]
        textos = prep['textos'][cfg['textos']]
        estado = prep['estado'][cfg['textos']]
        limite = int(limites[cfg['limite']])

        pendentes = []
        for grupo, filhos in self._pl_grupos_do_nivel(esqueleto, nivel):
            grupo['_adiado'], grupo['_refeito'], grupo['_ligacoes_refeitas'] = False, False, set()
            velho = estado.get(grupo['rotulo']) or {}
            velhas = velho.get('ligacoes') or {}
            textos[grupo['rotulo']] = {
                'nome': velho.get('nome', ''), 'resumo': velho.get('resumo', ''),
                'ligacoes': {r: (l.get('frase') or '') for r, l in velhas.items()},
            }
            if any(not (textos_filhos.get(k) or {}).get('resumo') for k, _f in filhos):
                grupo['_adiado'] = True
                continue
            md5s = {k: self._pl_md5(textos_filhos[k]['resumo']) for k, _f in filhos}
            grupo['_filhos_md5'] = md5s
            pedir = self._pl_regua_do_grupo(velho, cfg['filhos'], md5s, limite)
            faltam = []
            for lig in grupo['ligacoes']:
                lig['_assinatura'] = self._pl_assinatura(lig['passos'])
                v = velhas.get(lig['para_rotulo']) or {}
                if not (v.get('frase') and v.get('chamadas') == lig['_assinatura']):
                    faltam.append(lig)
            if pedir or faltam:
                pendentes.append((grupo, filhos, pedir, faltam))
        return pendentes

    @staticmethod
    def _pl_ler_grupo(dados, faltam):
        """→ (nome, resumo, {rótulo do outro lado: frase})."""
        nome = str(dados.get('nome') or '').strip().strip('`*')
        resumo = str(dados.get('resumo') or '').strip()
        frases = {}
        for item in (dados.get('ligacoes') or []):
            if not isinstance(item, dict):
                continue
            try:
                i = int(item.get('numero'))
            except (TypeError, ValueError):
                continue
            frase = str(item.get('frase') or '').strip()
            if 1 <= i <= len(faltam) and frase:
                frases[faltam[i - 1]['para_rotulo']] = frase
        return nome, resumo, frases

    def _pl_schema_do_grupo(self, pedir):
        """O esquema do bloco/área; com `pedir`, nome e resumo não podem vir
        vazios — a mesma trava de `_pl_schema_da_cadeia`, pelo mesmo motivo."""
        schema = self._schema_da_rotina(_PL_SCHEMA_BLOCO)
        if not (schema and pedir):
            return schema
        schema = copy.deepcopy(schema)
        for campo in ('nome', 'resumo'):
            schema['properties'][campo]['minLength'] = 1
        return schema

    def _pl_gerar_nivel(self, project_name, esqueleto, nivel, pendentes, prep, client,
                        modelo, settings, limites, prompt_template):
        """Chama o prompt do bloco para os pendentes de um nível, de N em N.

        Completa `prep['textos']`, marca `_refeito` e `_ligacoes_refeitas` no
        grupo, e devolve `(erros, chamadas)`. Sem retentativa (P3).
        """
        cfg = _PL_NIVEIS[nivel]
        textos_filhos = prep['textos'][cfg['filhos']]
        textos = prep['textos'][cfg['textos']]
        # O outro lado de uma ligação é dito pelo nome de ANTES desta passada
        # (o de agora pode estar sendo escrito em paralelo) ou, sem nome ainda,
        # pelos nomes dos filhos dele — o mesmo texto em qualquer ordem de
        # chegada das respostas.
        grupos = {g['rotulo']: (g, f) for g, f in self._pl_grupos_do_nivel(esqueleto, nivel)}
        nomes_antes = {r: (prep['estado'][cfg['textos']].get(r) or {}).get('nome') for r in grupos}

        def outro_lado(lig):
            if nomes_antes.get(lig['para_rotulo']):
                return '«%s»' % nomes_antes[lig['para_rotulo']]
            _g, filhos = grupos[lig['para_rotulo']]
            nomes = ['«%s»' % ((textos_filhos.get(k) or {}).get('nome') or '?') for k, _f in filhos]
            return '%s %s' % (cfg['outro'], ', '.join(nomes[:3])
                              + (' e mais %d' % (len(nomes) - 3) if len(nomes) > 3 else ''))

        orc = calcular_orcamento(limites, prompt_template)
        portao = PortaoDeContexto(orc['janela'])
        teto_saida = int(limites['teto_saida'])
        t_prompt = contar_tokens(prompt_template)

        def chamar(grupo, filhos, pedir, faltam):
            if self.rotina_parada(project_name, 'pipeline'):
                return None
            atual = textos[grupo['rotulo']]
            pedido = ('escreva o nome, o resumo e a frase de cada ligação' if pedir else
                      'escreva só a frase de cada ligação; o nome e o resumo já existem\n'
                      'Nome: %s\nResumo: %s' % (atual['nome'], atual['resumo']))
            partes = []
            for i, (k, f) in enumerate(filhos, 1):
                t = textos_filhos.get(k) or {}
                rotulo = ('%s %s' % (f.get('emoji') or '', t.get('nome') or '')).strip()
                partes.append('%d. %s — %s' % (i, rotulo or '(sem nome)', t.get('resumo') or ''))
            ligacoes = []
            for i, lig in enumerate(faltam, 1):
                ligacoes.append('%d. para %s — %d chamadas:' % (i, outro_lado(lig), lig['chamadas']))
                for p in lig['passos'][:_PL_CHAMADAS_POR_LIGACAO]:
                    ligacoes.append('   - %s → %s (via `%s`)' % (p['origem'], p['destino'], p['via']))
                if len(lig['passos']) > _PL_CHAMADAS_POR_LIGACAO:
                    ligacoes.append('   - e mais %d' % (len(lig['passos']) - _PL_CHAMADAS_POR_LIGACAO))
            mensagens = mensagens_da_rotina(prompt_template, [
                ('GRUPO', '%s %s' % (cfg['nome'], grupo['id']), 'Pedido: %s' % pedido),
                ('PARTES DO GRUPO', '%d %s' % (len(filhos), cfg['filhos_nome']), '\n'.join(partes)),
                ('LIGAÇÕES DE SAÍDA', '%d' % len(faltam),
                 '\n'.join(ligacoes) or '(nenhuma — a lista de ligações volta vazia)'),
            ])
            custo = t_prompt + contar_tokens(mensagens[1]['content']) + teto_saida
            with portao.reservar(custo):
                resp = chat_json(
                    client, modelo, mensagens,
                    schema=self._pl_schema_do_grupo(pedir), name='pipeline_bloco',
                    max_tokens=teto_saida,
                    **ajustes_da_chamada(settings, 'rotinas', modelo),
                )
            nome, resumo, frases = self._pl_ler_grupo(
                json_da_resposta(resp, self._resgate_ligado()), faltam)
            if pedir and not (nome and resumo):
                return None, frases, 'o modelo não devolveu o nome e o resumo do %s' % cfg['nome']
            return ((nome, resumo) if pedir else None), frases, None

        erros = []
        if not pendentes:
            return erros, 0
        palavra = 'Blocos' if nivel == 'bloco' else 'Áreas'
        self._pl_notify(project_name, {'status': 'running',
                         'etapa': '%s: %d chamadas ao modelo' % (palavra, len(pendentes))})
        with ThreadPoolExecutor(max_workers=self._rotina_paralelas()) as executor:
            futuros = {executor.submit(chamar, *t): t for t in pendentes}
            feitos = 0
            for futuro in as_completed(futuros):
                grupo = futuros[futuro][0]
                feitos += 1
                try:
                    r = futuro.result()
                except Exception as e:
                    erros.append({'file': '%s · %s' % (grupo['id'], grupo['rotulo']),
                                  'reason': str(e)})
                    continue
                if r is None:
                    continue
                texto, frases, erro = r
                if texto:
                    textos[grupo['rotulo']]['nome'], textos[grupo['rotulo']]['resumo'] = texto
                    grupo['_refeito'] = True
                textos[grupo['rotulo']]['ligacoes'].update(frases)
                grupo['_ligacoes_refeitas'] = set(frases)
                if erro:
                    erros.append({'file': '%s · %s' % (grupo['id'], grupo['rotulo']),
                                  'reason': erro})
                self._pl_notify(project_name, {'status': 'running',
                                 'etapa': '%s: %d de %d chamadas' % (palavra, feitos, len(pendentes))})
        return erros, len(pendentes)

    def _pl_estado_do_nivel(self, esqueleto, nivel, prep):
        """A parte `blocos` (ou `areas`) do `_passos.json` desta passada.

        Refeito → o texto novo e o md5 de agora de cada filho; senão, a
        entrada antiga (a régua segue medindo desde o último texto escrito).
        Ligação: a frase nova com a assinatura de agora, ou a entrada antiga.
        Só os rótulos de AGORA: grupo e ligação que sumiram saem.
        """
        cfg = _PL_NIVEIS[nivel]
        estado = prep['estado'][cfg['textos']]
        textos = prep['textos'][cfg['textos']]
        novo = {}
        for grupo, _filhos in self._pl_grupos_do_nivel(esqueleto, nivel):
            velho = estado.get(grupo['rotulo']) or {}
            if grupo.get('_refeito'):
                entrada = {'nome': textos[grupo['rotulo']]['nome'],
                           'resumo': textos[grupo['rotulo']]['resumo'],
                           cfg['filhos']: grupo['_filhos_md5']}
            else:
                entrada = {'nome': velho.get('nome', ''), 'resumo': velho.get('resumo', ''),
                           cfg['filhos']: velho.get(cfg['filhos']) or {}}
            velhas, ligacoes = velho.get('ligacoes') or {}, {}
            for lig in grupo['ligacoes']:
                r = lig['para_rotulo']
                if r in grupo.get('_ligacoes_refeitas', ()):
                    ligacoes[r] = {'frase': textos[grupo['rotulo']]['ligacoes'][r],
                                   'chamadas': lig['_assinatura']}
                elif r in velhas:
                    ligacoes[r] = velhas[r]
            entrada['ligacoes'] = ligacoes
            if entrada['nome'] or ligacoes:
                novo[grupo['rotulo']] = entrada
        return novo
