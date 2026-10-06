"""Pipeline — os dois níveis de baixo no modelo: a frase do passo e o nome e o
resumo da cadeia, só o que mudou (24/09/2026; em níveis desde a fase 03).

A pergunta deste arquivo: «o que vai ao prompt da cadeia, e o que fica
guardado entre uma passada e outra?». Cada frase fica em `_passos.json` pela
IMPRESSÃO DO CONTEÚDO dos dois arquivos do passo. Consequências:

  · nada mudou → nenhuma chamada;
  · um arquivo mudou → só os passos que passam por ele;
  · arquivo movido ou renomeado SEM mudar → a impressão é a mesma e a frase é
    reaproveitada (ela não cita arquivo — o prompt proíbe);
  · passo que sumiu → sai do `.md` e do estado, sem modelo;
  · um passo que está em duas cadeias tem UMA frase, pedida uma vez só.

O nome e o resumo da cadeia seguem a régua (D24): só são refeitos se a cadeia
é nova, se entrou ou saiu passo, ou se a fração de passos com chave nova
passou de «Refazer o resumo da cadeia a partir de» (Configurações › Rotinas da
Automação). Os blocos e as áreas moram em `pipeline_blocos.py`.

Cada cadeia pendente é uma chamada, com a cadeia inteira de contexto e os
passos já descritos marcados; as chamadas vão de N em N pelo portão da janela
(`tokens.py::PortaoDeContexto`). Cadeia que não cabe numa chamada vai em
fatias. Sem retentativa na mesma passada: quem falha é refeito na seguinte.
"""
import copy
import hashlib
import json
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

from modulos.agentes.llm_estruturado import chat_json, json_da_resposta, mensagens_da_rotina
from modulos.tokens import contar_tokens, calcular_orcamento, PortaoDeContexto
from ...llm_geracao import ajustes_da_chamada
from .pipeline_constantes import _PL_SCHEMA, _PL_TOKENS_POR_PASSO


class PipelinePassosMixin:

    @staticmethod
    def _pl_impressao(caminho_abs, rel):
        """md5 do conteúdo do arquivo, com o espaço em branco colapsado.

        É o CONTEÚDO, e não o caminho, que decide se a frase ainda vale: mover
        ou renomear sem mudar mantém a impressão, e reindentar também — a mesma
        régua da Documentação Técnica.
        """
        try:
            with open(caminho_abs, 'r', encoding='utf-8', errors='replace') as f:
                texto = ' '.join(f.read().split())
        except (OSError, TypeError):
            texto = 'caminho:' + str(rel)
        return hashlib.md5(texto.encode('utf-8', 'replace')).hexdigest()

    @staticmethod
    def _pl_chave(*partes):
        return hashlib.md5('|'.join(str(p) for p in partes).encode('utf-8', 'replace')).hexdigest()

    @staticmethod
    def _pl_identidade(p):
        """`origem|destino|via` — quem o passo é, sem olhar o conteúdo."""
        return '%s|%s|%s' % (p['origem'], p['destino'], p['via'])

    def _pl_load_estado(self, project_name):
        """O `_passos.json` da última passada, no formato em níveis.

        Da forma antiga (`cadeias: {chave: nome}`) só as frases dos passos
        servem — a chave do passo não mudou. Entrada que não é dicionário é
        descartada, e cadeias, blocos e áreas nascem na primeira passada.
        """
        vazio = {'passos': {}, 'cadeias': {}, 'blocos': {}, 'areas': {}}
        try:
            with open(os.path.join(self._pl_dir(project_name), '_passos.json'),
                      'r', encoding='utf-8') as f:
                dados = json.load(f)
        except Exception:
            return vazio
        if not isinstance(dados, dict):
            return vazio

        def so_dicionarios(bruto):
            return {k: v for k, v in (bruto or {}).items() if isinstance(v, dict)}

        return {'passos': {k: v for k, v in (dados.get('passos') or {}).items()
                           if isinstance(v, str)},
                'cadeias': so_dicionarios(dados.get('cadeias')),
                'blocos': so_dicionarios(dados.get('blocos')),
                'areas': so_dicionarios(dados.get('areas'))}

    def _pl_save_estado(self, project_name, estado):
        try:
            with open(os.path.join(self._pl_dir(project_name), '_passos.json'),
                      'w', encoding='utf-8') as f:
                json.dump(estado, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    @staticmethod
    def _pl_regua_da_cadeia(velho, mapa, limite_pct):
        """True = refazer o nome e o resumo da cadeia.

        `mapa` é `{origem|destino|via: chave}` de agora; `velho['passos']` é o
        de quando o resumo foi escrito — e só muda quando ele é refeito, para
        que mudanças pequenas em passadas seguidas SOMEM até a régua.
        """
        if not velho or not velho.get('nome') or not velho.get('resumo'):
            return True
        antigo = velho.get('passos') or {}
        if set(antigo) != set(mapa):
            return True
        mudaram = sum(1 for k, chave in mapa.items() if antigo.get(k) != chave)
        return mudaram * 100 >= limite_pct * len(mapa)

    def _pl_preparar(self, project_name, esqueleto, limites):
        """O que já está descrito e o que falta no passo e na cadeia, sem modelo.

        Marca `_chave` em cada passo e `_mapa` em cada cadeia. Devolve
        `{estado, frases, textos, pendentes, reaproveitados, esqueleto_hash}`:
        `pendentes` é `[(cadeia, [passos a descrever], pedir o nome e o resumo?)]`;
        `textos` é `{'cadeias': {cabeça: {nome, resumo}}, 'blocos': {}, 'areas': {}}`,
        já com o que se reaproveita (e, em quem será refeito, o texto antigo,
        que só fica se a chamada falhar).
        """
        estado = self._pl_load_estado(project_name)
        limite = int(limites['pipeline_cadeia_refazer_pct'])
        impressoes = {}

        def impressao(rel):
            if rel not in impressoes:
                impressoes[rel] = self._pl_impressao(esqueleto['abs'].get(rel), rel)
            return impressoes[rel]

        frases, textos, pendentes = {}, {}, []
        reaproveitados, pedidos = set(), set()
        for c in esqueleto['cadeias']:
            faltam, mapa = [], {}
            for p in c['passos']:
                p['_chave'] = self._pl_chave(p['via'], impressao(p['origem']),
                                             impressao(p['destino']))
                mapa[self._pl_identidade(p)] = p['_chave']
                frase = estado['passos'].get(p['_chave'])
                if frase:
                    frases[p['_chave']] = frase
                    reaproveitados.add(p['_chave'])
                elif p['_chave'] not in pedidos:
                    # Passo em duas cadeias: quem pede é a primeira. Na outra
                    # ele vai de contexto, como «já descrito».
                    pedidos.add(p['_chave'])
                    faltam.append(p)
            c['_mapa'] = mapa
            velho = estado['cadeias'].get(c['cabeca']) or {}
            pedir = self._pl_regua_da_cadeia(velho, mapa, limite)
            textos[c['cabeca']] = {'nome': velho.get('nome', ''),
                                   'resumo': velho.get('resumo', '')}
            if faltam or pedir:
                pendentes.append((c, faltam, pedir))

        # A árvore inteira, sem texto: caminhos, ordem, vias, as impressões,
        # os blocos e as áreas, o nível da cadeia, os hubs e o código morto.
        # Os `.md` só são reescritos se um desses mudou (ou se falta texto).
        linhas = ['niveis|%d' % esqueleto['niveis'],
                  'hubs|' + ','.join(esqueleto['hubs']),
                  'mortas|' + ','.join(esqueleto['mortas'])]
        linhas += ['A|%s|%s' % (a['id'], a['rotulo']) for a in esqueleto['areas']]
        linhas += ['B|%s|%s|%s' % (b['id'], b.get('rotulo') or '', b.get('area') or '')
                   for b in esqueleto['blocos']]
        for c in esqueleto['cadeias']:
            linhas.append('C|%s|%s|%s|%s' % (c['id'], c['cabeca'], c['bloco'], c['tipo']))
            linhas += ['%s|%s|%d|%d' % (self._pl_identidade(p), p['_chave'], p['ordem'], p['fase'])
                       for p in c['passos']]
        esqueleto_hash = hashlib.md5('\n'.join(linhas).encode('utf-8', 'replace')).hexdigest()

        return {'estado': estado, 'frases': frases,
                'textos': {'cadeias': textos, 'blocos': {}, 'areas': {}},
                'pendentes': pendentes, 'reaproveitados': len(reaproveitados),
                'esqueleto_hash': esqueleto_hash}

    @staticmethod
    def _pl_ler(dados):
        """→ ({n: frase do passo}, nome da cadeia, resumo da cadeia).

        Com o esquema, `numero` é inteiro e `frase` é texto: não há o que
        interpretar. A cadeia é uma só por chamada: vale o primeiro item.
        """
        frases, nome, resumo = {}, '', ''
        for item in (dados.get('passos') or []):
            if not isinstance(item, dict):
                continue
            try:
                frases[int(item.get('numero'))] = str(item.get('frase') or '').strip().strip('`*')
            except (TypeError, ValueError):
                pass
        for item in (dados.get('cadeias') or []):
            if isinstance(item, dict):
                nome = str(item.get('nome') or '').strip().strip('`*')
                resumo = str(item.get('resumo') or '').strip()
                break
        return frases, nome, resumo

    def _pl_schema_da_cadeia(self, pedir):
        """O esquema da cadeia; com `pedir`, a lista `cadeias` é obrigada a
        trazer UM item com nome e resumo preenchidos.

        ⚠️ O esquema do arquivo aceita `cadeias: []` (é o caso «já existem»), e
        com o sinal só no rótulo o modelo devolvia a lista vazia em ~40% das
        cadeias (69 de 165 em 25/09/2026) — e os blocos acima delas ficavam
        adiados em cascata. A trava tem que estar na gramática.
        """
        schema = self._schema_da_rotina(_PL_SCHEMA)
        if not (schema and pedir):
            return schema
        schema = copy.deepcopy(schema)
        cadeias = schema['properties']['cadeias']
        cadeias['minItems'] = cadeias['maxItems'] = 1
        for campo in ('nome', 'resumo'):
            cadeias['items']['properties'][campo]['minLength'] = 1
        return schema

    def _pl_gerar_pendentes(self, project_name, prep, client, modelo, settings,
                            limites, prompt_template):
        """Chama o modelo para as cadeias pendentes de `prep`, de N em N.

        Completa `prep['frases']` e `prep['textos']['cadeias']`, marca
        `_refeita = True` na cadeia cujo nome e resumo foram refeitos sem erro
        nenhum, e devolve `(erros, gerados, chamadas)`. Um erro não derruba as
        outras cadeias: a que falhou fica com o texto antigo, entra em `erros`,
        e o ciclo seguinte a refaz (P3: sem retentativa na mesma passada).
        """
        frases = prep['frases']
        textos = prep['textos']['cadeias']
        orc = calcular_orcamento(limites, prompt_template)
        portao = PortaoDeContexto(orc['janela'])
        teto_saida = int(limites['teto_saida'])
        teto_entrada = int(limites['teto_entrada'])
        t_prompt = contar_tokens(prompt_template)

        def chamar(c, fatia, pedir):
            """Uma chamada: a cadeia inteira como contexto, e só os passos de
            `fatia` para descrever. → (frases novas, (nome, resumo) ou None,
            erro ou None), ou None se a rotina foi parada."""
            if self.rotina_parada(project_name, 'pipeline'):
                return None
            numeros = {}
            linhas = ['Cadeia C1 — começa em %s:' % c['cabeca']]
            na_fatia = {id(p) for p in fatia}
            for i, p in enumerate(c['passos'], 1):
                linha = '%d. %s → %s (via `%s`)' % (i, p['origem'], p['destino'], p['via'])
                if id(p) in na_fatia:
                    numeros[i] = p
                else:
                    linha += ' — já descrito: %s' % (frases.get(p['_chave'])
                                                    or '(descrito em outra parte)')
                linhas.append(linha)
            mensagens = mensagens_da_rotina(prompt_template, [
                ('PASSOS DO PIPELINE',
                 'descreva só os números sem «já descrito»'
                 + ('; escreva o nome e o resumo da cadeia' if pedir
                    else '; o nome e o resumo da cadeia já existem'),
                 '\n'.join(linhas))])
            custo = t_prompt + contar_tokens(mensagens[1]['content']) + teto_saida
            with portao.reservar(custo):
                resp = chat_json(
                    client, modelo, mensagens,
                    schema=self._pl_schema_da_cadeia(pedir), name='pipeline',
                    max_tokens=teto_saida,
                    **ajustes_da_chamada(settings, 'rotinas', modelo),
                )
            lidas, nome, resumo = self._pl_ler(json_da_resposta(resp, self._resgate_ligado()))
            novas = {numeros[i]['_chave']: f for i, f in lidas.items() if i in numeros and f}
            if not pedir:
                return novas, None, None
            if not (nome and resumo):
                return novas, None, 'o modelo não devolveu o nome e o resumo da cadeia'
            return novas, (nome, resumo), None

        # Fatias: a cadeia inteira vai de contexto em cada uma, então o que
        # cabe é medido com ela; sobrando pouco, os pendentes vão em lotes.
        tarefas = []
        for c, faltam, pedir in prep['pendentes']:
            contexto = sum(contar_tokens('%s → %s (via `%s`) — já descrito: %s' % (
                p['origem'], p['destino'], p['via'], frases.get(p['_chave'], '')))
                for p in c['passos'])
            livre = teto_entrada - t_prompt - contexto
            por_fatia = max(1, livre // _PL_TOKENS_POR_PASSO) if livre > 0 else 20
            fatias = [faltam[i:i + por_fatia] for i in range(0, len(faltam), por_fatia)] or [[]]
            for k, fatia in enumerate(fatias):
                tarefas.append((c, fatia, pedir and k == 0))

        erros, gerados, texto_novo, falhou = [], 0, {}, set()
        self._pl_notify(project_name, {'status': 'running',
                         'etapa': 'Cadeias: %d chamadas ao modelo · %d passos reaproveitados'
                                  % (len(tarefas), prep['reaproveitados'])})
        with ThreadPoolExecutor(max_workers=self._rotina_paralelas()) as executor:
            futuros = {executor.submit(chamar, *t): t for t in tarefas}
            feitos = 0
            for futuro in as_completed(futuros):
                c, _fatia, _pedir = futuros[futuro]
                feitos += 1
                try:
                    r = futuro.result()
                except Exception as e:
                    falhou.add(c['cabeca'])
                    erros.append({'file': '%s · %s' % (c['id'], c['cabeca']), 'reason': str(e)})
                    continue
                if r is None:
                    continue
                novas, texto, erro = r
                frases.update(novas)
                gerados += len(novas)
                if texto:
                    texto_novo[c['cabeca']] = texto
                if erro:
                    falhou.add(c['cabeca'])
                    erros.append({'file': '%s · %s' % (c['id'], c['cabeca']), 'reason': erro})
                self._pl_notify(project_name, {'status': 'running',
                                 'etapa': 'Cadeias: %d de %d chamadas' % (feitos, len(tarefas))})

        for c, _faltam, _pedir in prep['pendentes']:
            if c['cabeca'] in texto_novo:
                nome, resumo = texto_novo[c['cabeca']]
                textos[c['cabeca']] = {'nome': nome, 'resumo': resumo}
                c['_refeita'] = c['cabeca'] not in falhou
        return erros, gerados, len(tarefas)

    def _pl_novo_estado(self, esqueleto, prep):
        """O `_passos.json` desta passada — só as chaves de AGORA.

        Passo que sumiu sai junto. Cadeia refeita grava o `_mapa` de agora;
        a que não foi refeita (ou falhou) fica com a entrada antiga, para a
        régua continuar medindo desde o último resumo escrito.
        """
        passos, cadeias = {}, {}
        for c in esqueleto['cadeias']:
            for p in c['passos']:
                frase = prep['frases'].get(p['_chave'])
                if frase:
                    passos[p['_chave']] = frase
            velho = prep['estado']['cadeias'].get(c['cabeca'])
            if c.get('_refeita'):
                texto = prep['textos']['cadeias'][c['cabeca']]
                cadeias[c['cabeca']] = {'nome': texto['nome'], 'resumo': texto['resumo'],
                                        'passos': c['_mapa']}
            elif velho:
                cadeias[c['cabeca']] = velho
        return {'passos': passos, 'cadeias': cadeias,
                'blocos': self._pl_estado_do_nivel(esqueleto, 'bloco', prep),
                'areas': self._pl_estado_do_nivel(esqueleto, 'area', prep)}
