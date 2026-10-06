from ...constantes import *
from ..resumo_de_rotina import gravar_resumo_de_falha
from modulos.agentes.llm_estruturado import (
    carregar_schema, chat_json, formato_garantido_indisponivel, json_da_resposta,
    mensagens_da_rotina,
)
from concurrent.futures import ThreadPoolExecutor, as_completed
import math
import unicodedata

from modulos.tokens import contar_tokens, calcular_orcamento, PortaoDeContexto
from ...llm_geracao import ajustes_da_chamada


# O esquema de saída, irmão do prompt em `prompts/Rotinas/`.
_GL_SCHEMA = 'glossario.json'

# Os oito tópicos do Glossário, nesta ordem (D28, D36). Fixos e genéricos —
# «tópico livre vira bagunça», e a lista tem de servir a qualquer programa.
_GL_TOPICOS = ('Tela', 'Processo', 'Peça do código', 'Dado', 'Estado',
               'Configuração', 'Integração', 'Conceito')


class GlossarioIndiceMixin:
    """Agente Glossário — os termos deste projeto, definidos pelo modelo.

    Veio do antigo par Pipeline/Índice. A metade do Índice que afirmava fatos
    (funções, classes, pontos de extensão) saiu daqui e virou o Índice de
    Navegação, determinístico. O que sobrou — o glossário de termos — é
    conhecimento sobre o projeto, não é derivável de estrutura, e continua
    sendo escrito pelo modelo.

    Os termos vêm da Documentação Técnica (o campo `termos` de cada arquivo,
    D13): o programa junta a lista, e o modelo só escreve a definição e escolhe
    o tópico. Sem teto (D40): quem segura o tamanho é o critério do que é termo.
    """

    # ── Fontes ────────────────────────────────────────────────────────────────

    def _collect_resumo_pastas_content(self, project_name):
        """Concatena os resumos de pasta gerados pelo agente Resumo de Pastas."""
        base = obter_pasta_da_rotina(project_name, 'resumo-pastas')
        if not os.path.isdir(base):
            return None, 'Nenhum Resumo de Pastas encontrado. Execute o agente Resumo de Pastas primeiro.'
        parts = []
        for root, dirs, fnames in os.walk(base):
            dirs.sort()
            for fname in sorted(fnames):
                if not fname.endswith('.md'):
                    continue
                fpath = os.path.join(root, fname)
                rel = os.path.relpath(fpath, base).replace('\\', '/')
                try:
                    with open(fpath, 'r', encoding='utf-8', errors='replace') as f:
                        content = f.read()
                    parts.append('--- %s ---\n%s' % (rel, content))
                except Exception:
                    pass
        if not parts:
            return None, 'Nenhum arquivo .md encontrado em agentes/resumo-pastas/.'
        return '\n\n'.join(parts), None

    def _truncate_content_to_limit(self, content, limite_tokens):
        """Corta por seção inteira, preservando entradas completas.

        Truncar é sempre ruim — o modelo passa a responder sobre o projeto
        vendo metade dele. Só existe como último recurso; o caminho certo é o
        agente não depender de uma fonte que cresce sem teto.
        """
        if contar_tokens(content) <= limite_tokens:
            return content, False

        sections = content.split('\n\n')
        resultado, usado = [], 0
        for section in sections:
            custo = contar_tokens(section) + 1
            if usado + custo > limite_tokens:
                break
            resultado.append(section)
            usado += custo

        aviso = (
            '\n\n[AVISO: conteúdo truncado — %d de %d seções incluídas. '
            'Aumente a janela de contexto em Configurações ou reduza o escopo '
            'das pastas de trabalho.]' % (len(resultado), len(sections))
        )
        return '\n\n'.join(resultado) + aviso, True

    # ── Glossário ─────────────────────────────────────────────────────────────

    def _gl_dir(self, project_name):
        return obter_pasta_da_rotina(project_name, 'glossario')

    def _gl_notify(self, project_name, payload):
        # Pendências PRIMEIRO, e sempre: é registro em memória, não pode ficar
        # refém de um `evaluate_js` que falha com a janela fechada. Mesma ordem
        # da Doc Técnica (ver `_dt_notify`).
        #
        # O Glossário conta termo a termo, então entra em Pendências como quem
        # conta (`conta: True`) e não como quem só está "em execução" — o
        # registro pobre que `_proc_iniciar` deixa vale para as rotinas que não
        # têm o que contar.
        self._proc_apply(project_name, 'glossario', payload)
        # `project` no payload: o front ignora o evento quando este projeto
        # não é o exibido no momento (várias abas de projeto abertas).
        payload = {**payload, 'project': project_name}
        try:
            self.window.evaluate_js('glossarioAgentProgress(%s)' % json.dumps(payload))
        except Exception:
            pass

    # A fonte do Glossário é a Documentação Técnica (dado atômico), não mais o
    # Resumo de Pastas (prosa sobre prosa, que era o defeito que fazia o antigo
    # Índice alucinar). O fluxo tem 4 passos: juntar os termos que a Doc Técnica
    # achou em cada arquivo → montar um dossiê determinístico por termo → pedir
    # ao modelo UMA definição e UM tópico por termo → salvar por termo com hash
    # do dossiê (incremental).

    def _gl_termos_da_documentacao(self, project_name):
        """Os termos do projeto e as evidências, lidos do estado da
        Documentação Técnica (`Documentação Técnica/_simbolos.json`).

        Devolve `((termos, entradas, documentados), None)` ou `(None, erro)`.
        `termos` é `{termo exibido: [chaves dos arquivos que o citam]}`, em
        ordem alfabética; `documentados` é quantos arquivos têm registro no
        estado — a base do mínimo proporcional (D29).

        ⚠️ CAIXA E ACENTO NÃO SEPARAM TERMO (D12, D23). `Aparencia`,
        `Aparência` e `aparência` são um termo só (`_dt_chave_do_termo`), e
        cada arquivo conta UMA vez, por mais que escreva o termo de jeitos
        diferentes. O termo exibido sai de `_gl_termo_exibido`.

        `entradas` são `[{rel, assinatura, frase, busca}]`: a síntese de cada
        arquivo (assinatura vazia) e cada símbolo com frase; `busca` é a
        chave do texto, para o dossiê achar o termo sem olhar acento.
        """
        estado = self._dt_load_estado(project_name)
        grafias, arquivos, entradas = {}, {}, []
        for chave in sorted(estado or {}):
            doc = estado.get(chave) or {}
            grafias_do_arquivo = set()
            for termo in doc.get('termos') or []:
                termo = ' '.join(str(termo or '').split())
                k = self._dt_chave_do_termo(termo)
                if not k:
                    continue
                if chave not in arquivos.setdefault(k, []):
                    arquivos[k].append(chave)
                if termo not in grafias_do_arquivo:
                    grafias_do_arquivo.add(termo)
                    uso = grafias.setdefault(k, {})
                    uso[termo] = uso.get(termo, 0) + 1
            sintese = (doc.get('sintese') or '').strip()
            if sintese:
                entradas.append({'rel': chave, 'assinatura': '', 'frase': sintese,
                                 'busca': self._dt_chave_do_termo(sintese)})
            for sim in doc.get('simbolos') or []:
                frase = (sim.get('frase') or '').strip()
                if frase:
                    assinatura = sim.get('assinatura') or sim.get('nome', '')
                    entradas.append({'rel': chave, 'assinatura': assinatura, 'frase': frase,
                                     'busca': self._dt_chave_do_termo(frase + ' ' + assinatura)})
        if not arquivos:
            return None, ('A Documentação Técnica ainda não tem termos. '
                          'Rode a Documentação Técnica primeiro.')
        termos = {self._gl_termo_exibido(grafias[k]): arquivos[k] for k in arquivos}
        termos = dict(sorted(termos.items(), key=lambda kv: kv[0]))
        return (termos, entradas, len(estado)), None

    @staticmethod
    def _gl_termo_exibido(uso):
        """Como o Glossário mostra um termo (D12), a partir de `{grafia:
        arquivos que a usam}`: a grafia COM acento mais usada — sem nenhuma
        com acento, a mais usada —, toda em minúsculas. Empate: a primeira
        em ordem alfabética. `Aparencia` ×3 e `Aparência` ×1 → `aparência`."""
        com_acento = {g: n for g, n in uso.items()
                      if any(unicodedata.combining(c)
                             for c in unicodedata.normalize('NFD', g))}
        candidatas = com_acento or uso
        return sorted(candidatas.items(), key=lambda kv: (-kv[1], kv[0]))[0][0].lower()

    @staticmethod
    def _gl_minimo_de_arquivos(limites, documentados):
        """Em quantos arquivos DIFERENTES um termo precisa aparecer para
        entrar no Glossário (D29). Não é teto de quantidade (P2): é critério
        de relevância — termo de um arquivo só já está explicado na
        Documentação Técnica dele.

        - `proporcional`: o maior entre o piso e `%` × arquivos documentados,
          arredondado para cima (795 arquivos, 1 %, piso 3 → 8; 15 → 3).
        - `fixo`: o número de Configurações, como está.
        """
        if limites.get('glossario_minimo_modo') == 'fixo':
            return max(1, int(limites['glossario_minimo_fixo']))
        proporcional = math.ceil(documentados * float(limites['glossario_minimo_pct']) / 100)
        return max(1, int(limites['glossario_minimo_piso']), proporcional)

    def contar_arquivos_documentados(self, project_name):
        """Quantos arquivos têm Documentação Técnica — a base do mínimo
        proporcional (D29). Serve o exemplo do cartão «Quem entra no
        Glossário» (Configurações › Rotinas da Automação)."""
        try:
            return {'success': True,
                    'arquivos': len(self._dt_load_estado(project_name) or {})}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _gl_dossie(self, termo, arquivos, entradas, limite_entradas=40):
        """As evidências de um termo: primeiro a síntese de cada arquivo que o
        listou; depois os símbolos cuja frase ou assinatura o contém (sem
        diferenciar caixa nem acento). No máximo `limite_entradas` linhas."""
        alvo = self._dt_chave_do_termo(termo)
        sinteses = [e for e in entradas if not e['assinatura'] and e['rel'] in arquivos]
        simbolos = [e for e in entradas if e['assinatura'] and alvo in e['busca']]
        linhas = []
        for e in (sinteses + simbolos)[:limite_entradas]:
            if e['assinatura']:
                linhas.append(f"- {e['rel']} · `{e['assinatura']}` — {e['frase']}")
            else:
                linhas.append(f"- {e['rel']} — {e['frase']}")
        return '\n'.join(linhas)

    def _gl_load_termos(self, out_dir):
        try:
            with open(os.path.join(out_dir, '_termos.json'), 'r', encoding='utf-8') as f:
                data = json.load(f)
            return data.get('termos', {}) if isinstance(data, dict) else {}
        except Exception:
            return {}

    def _gl_save_termos(self, out_dir, termos):
        try:
            with open(os.path.join(out_dir, '_termos.json'), 'w', encoding='utf-8') as f:
                json.dump({'gerado_em': datetime.now().isoformat(), 'termos': termos},
                          f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    @staticmethod
    def _gl_montar_md(termos, definicoes, topicos):
        """`## Glossário` e uma seção `### Tópico` por tópico que tenha termo,
        na ordem fixa; dentro, a tabela em ordem alfabética. Termo sem tópico
        válido cai em «Conceito»."""
        por_topico = {}
        for t in termos:
            d = (definicoes.get(t) or '').replace('|', '/').strip()
            if not d:
                continue
            topico = topicos.get(t) if topicos.get(t) in _GL_TOPICOS else 'Conceito'
            por_topico.setdefault(topico, []).append((t, d))
        linhas = ['## Glossário']
        for topico in _GL_TOPICOS:
            if topico not in por_topico:
                continue
            linhas += ['', '### %s' % topico, '', '| Termo | Definição |', '| :--- | :--- |']
            for t, d in sorted(por_topico[topico], key=lambda x: x[0].lower()):
                linhas.append(f'| `{t}` | {d} |')
        return '\n'.join(linhas) + '\n'

    def run_glossario_agent(self, project_name, model=None):
        """Ver `executar_agente_documentacao_tecnica` sobre `model`."""
        model = model or self._ac_get_current_model()

        def worker():
            try:
                from ...llm_cliente import abrir_cliente_do_lm_studio
                import hashlib
                settings = self.load_settings()['settings']
                client = abrir_cliente_do_lm_studio(settings, projeto=project_name, dono='glossario')

                prompt_template = self._load_prompt_template('glossario')
                if not prompt_template:
                    raise ValueError('Prompt template "glossario" não encontrado.')

                dados, err = self._gl_termos_da_documentacao(project_name)
                if err:
                    raise ValueError(err)
                # Sem teto de quantidade (D40, P2). O critério é outro (D29):
                # o termo entra quando aparece em arquivos DIFERENTES o
                # bastante. O que fica abaixo do mínimo continua na
                # Documentação Técnica do arquivo dele — «termo de um arquivo
                # só já está explicado na documentação dele».
                termos_arquivos, entradas, documentados = dados
                limites = self.load_limites()['limites']
                minimo = self._gl_minimo_de_arquivos(limites, documentados)
                termos = [t for t, arquivos_do_termo in termos_arquivos.items()
                          if len(arquivos_do_termo) >= minimo]
                abaixo_do_minimo = len(termos_arquivos) - len(termos)

                orc = calcular_orcamento(limites, prompt_template)

                out_dir = self._gl_dir(project_name)
                os.makedirs(out_dir, exist_ok=True)
                estado = self._gl_load_termos(out_dir)
                novo_estado, definicoes, topicos = {}, {}, {}
                total = len(termos)
                gerados = reaproveitados = 0
                # Um termo que falha não derruba mais o glossário inteiro: ele
                # entra aqui, a definição ANTERIOR dele é preservada, e o
                # resumo diz quantos ficaram para trás. Antes, uma resposta
                # cortada no termo 12 de 20 abortava a rotina toda.
                erros = []

                # `gerados`/`reaproveitados` vão no progresso, e não só no
                # fim: sem eles a barra andava de 0 a 20 numa passada em que 19
                # termos vieram do cache, e parecia que o Glossário tinha
                # refeito tudo. A pergunta "ele está trabalhando ou está
                # relendo?" não tinha resposta na tela.
                #
                # ⚠️ FASE 1 — montar o dossiê e o hash de TODOS os termos antes
                # de gerar qualquer um. Isso responde a pergunta que faltava:
                # **quantos vão mesmo precisar do modelo?**
                #
                # `total` é quantos termos EXISTEM, e a barra usava esse número.
                # Numa passada em que 19 de 20 vinham do cache, ela ia de 0 a 20
                # em segundos e prometia um trabalho que não existia — o mesmo
                # defeito que `documentacao_tecnica.py` tinha, e pelo mesmo
                # motivo: a decisão de reaproveitar acontecia DEPOIS de o
                # denominador estar fixado.
                #
                # ⚠️ Não custa uma passada a mais: o dossiê e o hash ficam
                # guardados aqui e a fase 2 os reaproveita. O trabalho caro é o
                # `chat_json`, e esse continua acontecendo uma vez só, na fase 2.
                preparados = []
                for termo in termos:
                    dossie = self._gl_dossie(termo, termos_arquivos[termo], entradas)
                    dossie, _ = self._truncate_content_to_limit(dossie, orc['sobra_tokens'])
                    h = hashlib.md5((termo + '\n' + dossie).encode('utf-8', 'replace')).hexdigest()
                    anterior = estado.get(termo)
                    # Sem `topico` é estado de antes dos tópicos: redefine uma vez.
                    reusa = bool(anterior and anterior.get('hash') == h
                                 and anterior.get('definicao') and anterior.get('topico'))
                    preparados.append((termo, dossie, h, anterior, reusa))

                a_processar = sum(1 for p in preparados if not p[4])
                reaproveitaveis = total - a_processar

                self._gl_notify(project_name, {'status': 'running', 'processed': 0, 'total': total,
                                 'a_processar': a_processar,
                                 'reaproveitaveis': reaproveitaveis,
                                 'current': '', 'gerados': 0, 'reaproveitados': 0})

                # ── FASE 2: gerar só quem precisa ──
                # Os reaproveitados entram na hora; os outros vão para até
                # `parallel` chamadas ao mesmo tempo — o número de Configurações
                # › Rotinas da Automação, o mesmo da Documentação Técnica e do
                # Resumo de Pastas. Até 24/09/2026 era um termo por vez, e uma
                # primeira geração com dezenas de termos esperava cada um.
                #
                # ⚠️ O PORTÃO conta tokens, não chamadas (ver
                # tokens.py::PortaoDeContexto): a janela do LM Studio é uma só
                # para as chamadas em voo. Os dossiês são curtos e passam de N
                # em N; um dossiê grande passa sozinho.
                #
                # Quem mexe em `definicoes`, `erros` e nos contadores é só esta
                # thread (o laço do `as_completed`): os trabalhadores só chamam
                # o modelo e devolvem o resultado.
                parallel = self._rotina_paralelas()
                portao = PortaoDeContexto(orc['janela'])
                teto_saida = int(limites['teto_saida'])
                visitados = 0

                def progresso(termo):
                    self._gl_notify(project_name, {'status': 'running', 'processed': visitados,
                                     'total': total, 'current': termo,
                                     'a_processar': a_processar,
                                     'reaproveitaveis': reaproveitaveis,
                                     'gerados': gerados,
                                     'reaproveitados': reaproveitados,
                                     'falhas': len(erros)})

                def gerar(termo, dossie):
                    # A aba do projeto foi fechada ou a rotina desligada: não
                    # começa chamada nova (as que já estão em voo terminam).
                    if self.rotina_parada(project_name, 'glossario'):
                        return None, None, 'parado'
                    blocos = [('TERMO', termo, termo),
                              ('EVIDÊNCIAS', str(len(dossie.splitlines())), dossie)]
                    mensagens = mensagens_da_rotina(prompt_template, blocos)
                    custo = contar_tokens(prompt_template) + contar_tokens(mensagens[1]['content']) + teto_saida
                    try:
                        with portao.reservar(custo):
                            resp = chat_json(
                                client, model, mensagens,
                                schema=self._schema_da_rotina(_GL_SCHEMA), name='glossario',
                                max_tokens=teto_saida,
                                **ajustes_da_chamada(settings, 'rotinas', model),
                            )
                        resposta = json_da_resposta(resp, self._resgate_ligado())
                    except Exception as e:
                        return None, None, str(e)
                    topico = resposta.get('topico')
                    return (resposta.get('definicao') or ''), (topico if topico in _GL_TOPICOS else 'Conceito'), None

                pendentes = {}
                for termo, dossie, h, anterior, reusa in preparados:
                    if reusa:
                        definicoes[termo] = anterior['definicao']
                        topicos[termo] = anterior['topico']
                        novo_estado[termo] = dict(anterior, arquivos=termos_arquivos[termo])
                        reaproveitados += 1
                        visitados += 1
                    else:
                        pendentes[termo] = (dossie, h, anterior)
                if reaproveitados:
                    progresso('')

                with ThreadPoolExecutor(max_workers=parallel) as executor:
                    futuros = {executor.submit(gerar, termo, dados_t[0]): termo
                               for termo, dados_t in pendentes.items()}
                    for futuro in as_completed(futuros):
                        termo = futuros[futuro]
                        dossie, h, anterior = pendentes[termo]
                        bruto, topico, erro = futuro.result()
                        visitados += 1
                        if erro == 'parado':
                            continue
                        if erro is not None:
                            # Preserva o que já havia: definição anterior vale
                            # mais que nenhuma, e o hash NÃO é atualizado, então
                            # a próxima passada tenta este termo de novo.
                            erros.append({'termo': termo, 'reason': erro})
                            if anterior and anterior.get('definicao'):
                                definicoes[termo] = anterior['definicao']
                                topicos[termo] = anterior.get('topico') or 'Conceito'
                                novo_estado[termo] = dict(anterior, arquivos=termos_arquivos[termo])
                            progresso(termo)
                            continue
                        definicao = ' '.join(str(bruto).split()).strip()
                        definicao = definicao.strip('`"\'' ).strip()
                        definicoes[termo] = definicao
                        topicos[termo] = topico
                        # Termo que não está mais em `termos` não entra aqui: é
                        # assim que o termo sem nenhum arquivo sai sozinho.
                        novo_estado[termo] = {'hash': h, 'definicao': definicao,
                                              'topico': topico,
                                              'arquivos': termos_arquivos[termo]}
                        gerados += 1
                        progresso(termo)

                indisponivel = formato_garantido_indisponivel()
                if indisponivel:
                    erros.append({'termo': '(todos)',
                                  'reason': 'Formato garantido indisponível — %s.'
                                            % indisponivel})

                self._gl_save_termos(out_dir, novo_estado)
                texto = self._gl_montar_md(termos, definicoes, topicos)
                with open(os.path.join(out_dir, 'glossario.md'), 'w', encoding='utf-8') as f:
                    f.write(texto)
                with open(os.path.join(out_dir, '_resumo.json'), 'w', encoding='utf-8') as f:
                    json.dump({'finished_at': datetime.now().isoformat(),
                               'termos': total, 'gerados': gerados, 'reaproveitados': reaproveitados,
                               'chars': len(texto), 'erros': erros,
                               'arquivos_documentados': documentados, 'minimo': minimo,
                               'abaixo_do_minimo': abaixo_do_minimo},
                              f, ensure_ascii=False, indent=2)

                self._gl_notify(project_name, {'status': 'done', 'termos': total, 'gerados': gerados,
                                 'reaproveitados': reaproveitados, 'chars': len(texto),
                                 'erros': erros})
            except Exception as e:
                gravar_resumo_de_falha(project_name, 'glossario', str(e))
                self._gl_notify(project_name, {'status': 'error', 'error': str(e)})

        # A referência da thread fica registrada: é o que deixa o ciclo
        # saber que esta rotina continua viva (ver processando.py).
        self._proc_iniciar(project_name, 'glossario', worker)
        return {'success': True}

    def get_glossario_status(self, project_name):
        """Existe glossário gerado, e o que falhou na última passada.

        Os erros vão junto. Eles já eram gravados no `_resumo.json`, mas este
        método os ignorava: a lista só chegava à tela pelo evento ao vivo do
        progresso, então fechar e reabrir o programa apagava da vista tudo o
        que tinha falhado — sem que nada tivesse sido consertado.

        ⚠️ O Glossário grava a lista com o nome `erros` e o campo `termo`,
        e não `errors`/`file` como as outras. `_erros_de_uma_rotina` já
        normaliza os dois formatos — o disco antigo continua legível.
        """
        path = os.path.join(self._gl_dir(project_name), 'glossario.md')
        erros, _ = self._erros_de_uma_rotina(project_name, 'glossario')
        return {'success': True, 'exists': os.path.isfile(path), 'errors': erros}
