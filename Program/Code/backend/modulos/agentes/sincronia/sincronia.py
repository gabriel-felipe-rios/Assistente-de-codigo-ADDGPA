"""Agente Sincronia — mantém as saídas em dia com o código.

É o único agente do programa que **não produz nada**. Ele não escreve
documentação, não indexa: ele acompanha o que aconteceu com os arquivos
e mexe no que os outros já geraram.

Três divergências, uma vez por ciclo:

| Evento              | O que faz                                          |
|---------------------|----------------------------------------------------|
| Arquivo deletado    | apaga toda saída derivada dele e marca a pasta-mãe |
| Arquivo movido      | **move** as saídas, **sem chamar LLM**             |
| Arquivo renomeado   | **renomeia** as saídas, **sem chamar LLM**         |

⛔ Não descreva este agente como "limpa órfãos": apagar é a MENOS frequente das
três operações. O caso comum é mover uma pasta inteira de lugar — e, sem ele,
isso reprocessa o projeto todo com LLM.

**Por que só dois agentes sofrem disso:** Índice de navegação, Glossário,
Pipeline, Grafo e Identificadores são refeitos inteiros a cada ciclo e se
corrigem sozinhos. O problema existe só em Documentação Técnica e
Resumo de pastas — os que gravam uma saída por entrada.

**Como "movido" é detectado:** um caminho que sumiu (`removidos`) e cujo hash
bate com um caminho novo é o mesmo arquivo em outro lugar. A noção não existia
no programa; sem ela, mover uma pasta faz tudo ser reprocessado com LLM.

⚠️ A detecção roda ANTES do Hashes do ciclo, e o resultado vai para a fila
persistida (`rotinas_pendencias.py`). Tem que ser antes: o Hashes regrava a
linha de base, e depois disso não há mais como saber o que sumiu.
"""

from ...constantes import *


class SincroniaMixin:

    # Agentes que gravam UMA SAÍDA POR ENTRADA — os únicos que precisam ser
    # acompanhados. id da rotina → sufixo do arquivo de saída.
    #
    # Havia aqui um segundo campo com o nome da pasta, cópia literal da chave.
    # Quem traduz id → pasta é `caminhos.obter_pasta_da_rotina`, e em lugar
    # nenhum mais.
    _SINC_SAIDAS_POR_ARQUIVO = {
        'documentacao-tecnica': '.md',
    }

    def _sinc_dir(self, project_name):
        return obter_pasta_da_rotina(project_name, 'sincronia')

    def _sinc_notify(self, project_name, payload):
        # `project` no payload: o front ignora o evento quando este projeto
        # não é o exibido no momento (várias abas de projeto abertas).
        payload = {**payload, 'project': project_name}
        try:
            self.window.evaluate_js('sincroniaAgentProgress(%s)' % json.dumps(payload))
        except Exception:
            pass

    # ── Detecção ─────────────────────────────────────────────────────────────

    def detectar_sincronia(self, project_name, atuais=None):
        """Compara a linha de base do Hashes com o disco e devolve as operações.

        Devolve uma lista de dicts:
          {'op': 'mover',  'de': chave, 'para': chave}
          {'op': 'apagar', 'de': chave}

        Chamada ANTES do Hashes do ciclo — ver o aviso no topo do módulo.

        `atuais` é a varredura do disco JÁ FEITA, quando quem chama já a tem em
        mãos. É o caso do Detector: ele precisa da mesma varredura para achar os
        gêmeos, e sem este parâmetro o projeto era percorrido duas vezes por
        ciclo — o passo mais caro de uma rotina que deveria ser instantânea.
        Omitido, o comportamento é o de sempre.
        """
        salvos = self._hs_load(project_name)['arquivos']
        if not salvos:
            return []
        if atuais is None:
            atuais = self._hs_scan(project_name)
        if atuais is None:
            return []

        removidos = [k for k in salvos if k not in atuais]
        if not removidos:
            return []
        novos = [k for k in atuais if k not in salvos]

        # Hash → caminhos novos com aquele conteúdo. Um hash pode ter mais de um
        # caminho (arquivo copiado); casa na ordem e sobra vira apagado, que é
        # o comportamento seguro — nunca move a saída para o lugar errado.
        por_hash = {}
        for k in novos:
            por_hash.setdefault(atuais[k]['hash'], []).append(k)

        operacoes = []
        for antigo in sorted(removidos):
            h = salvos[antigo].get('hash')
            candidatos = por_hash.get(h) if h else None
            if candidatos:
                operacoes.append({'op': 'mover', 'de': antigo, 'para': candidatos.pop(0)})
            else:
                operacoes.append({'op': 'apagar', 'de': antigo})
        return operacoes

    # ── Aplicação ────────────────────────────────────────────────────────────

    def _sinc_mover_arquivo(self, origem, destino):
        if not os.path.isfile(origem):
            return False
        try:
            os.makedirs(os.path.dirname(destino), exist_ok=True)
            if os.path.isfile(destino):
                os.remove(destino)
            os.replace(origem, destino)
            return True
        except Exception:
            return False

    def _sinc_apagar_arquivo(self, caminho):
        try:
            if os.path.isfile(caminho):
                os.remove(caminho)
                return True
        except Exception:
            pass
        return False

    def _sinc_aplicar_saidas_por_arquivo(self, project_name, operacoes, contadores):
        """Move ou apaga o .md da Documentação Técnica."""
        from .. import embedding_store as _store
        from .. import embedding_store_codigo as _store_codigo

        for op in operacoes:
            de = op['de']
            para = op.get('para')
            for agente_id, sufixo in self._SINC_SAIDAS_POR_ARQUIVO.items():
                pasta  = obter_pasta_da_rotina(project_name, agente_id)
                origem = os.path.join(pasta, *(de + sufixo).split('/'))
                if op['op'] == 'mover':
                    destino = os.path.join(pasta, *(para + sufixo).split('/'))
                    if self._sinc_mover_arquivo(origem, destino):
                        contadores['movidos'] += 1
                    # O índice semântico guarda o caminho relativo à pasta do
                    # agente — mover o vetor é um UPDATE, não um reembedding.
                    _store.rename_source(project_name, de + sufixo, para + sufixo)
                else:
                    if self._sinc_apagar_arquivo(origem):
                        contadores['apagados'] += 1
                    _store.delete_source(project_name, de + sufixo)

            # Símbolos de código do detector de Duplicados.
            if op['op'] == 'mover':
                _store_codigo.rename_code_file(project_name, de, para)
            else:
                _store_codigo.delete_code_file(project_name, de)

    def _sinc_aplicar_resumo_pastas(self, project_name, operacoes, contadores):
        """Acompanha o Resumo de pastas, que é por PASTA e não por arquivo.

        Pasta inteira movida → move o .md e a assinatura junto, sem LLM. Pasta
        que só perdeu ou ganhou arquivos → invalida a assinatura, para o resumo
        ser refeito no próximo ciclo. É o "marca a pasta-mãe para refazer".
        """
        out_dir = obter_pasta_da_rotina(project_name, 'resumo-pastas')
        if not os.path.isdir(out_dir):
            return
        hashes = self._rp_load_hashes(out_dir)
        atuais = self._hs_scan(project_name) or {}
        pastas_atuais = {k.rsplit('/', 1)[0] for k in atuais if '/' in k}

        # Pares de pasta (de → para) vindos dos arquivos movidos.
        mudou_pasta = {}
        invalidar = set()
        for op in operacoes:
            pasta_de = op['de'].rsplit('/', 1)[0] if '/' in op['de'] else ''
            invalidar.add(pasta_de)
            if op['op'] == 'mover':
                pasta_para = op['para'].rsplit('/', 1)[0] if '/' in op['para'] else ''
                invalidar.add(pasta_para)
                if pasta_de != pasta_para:
                    mudou_pasta.setdefault(pasta_de, set()).add(pasta_para)

        for pasta_de, destinos in mudou_pasta.items():
            # Só é "pasta movida" se todos os arquivos foram para o MESMO lugar
            # e a pasta de origem não existe mais.
            if len(destinos) != 1 or pasta_de in pastas_atuais:
                continue
            pasta_para = next(iter(destinos))
            origem = os.path.join(out_dir, *pasta_de.split('/')) + '.md'
            destino = os.path.join(out_dir, *pasta_para.split('/')) + '.md'
            if self._sinc_mover_arquivo(origem, destino):
                contadores['movidos'] += 1
                # A assinatura acompanha, senão o resumo seria refeito com LLM
                # apesar de o conteúdo ser exatamente o mesmo.
                rel_de = pasta_de + '.md'
                rel_para = pasta_para + '.md'
                if rel_de in hashes:
                    hashes[rel_para] = hashes.pop(rel_de)
                invalidar.discard(pasta_de)
                invalidar.discard(pasta_para)

        # O que sobrou muda de conteúdo: fora a assinatura, para regenerar.
        for pasta in invalidar:
            if not pasta:
                continue
            rel = pasta + '.md'
            hashes.pop(rel, None)
            if pasta not in pastas_atuais:
                # A pasta sumiu de vez: o resumo dela também sai.
                if self._sinc_apagar_arquivo(os.path.join(out_dir, *pasta.split('/')) + '.md'):
                    contadores['apagados'] += 1
            else:
                contadores['pastas_marcadas'] += 1

        self._rp_save_hashes(out_dir, hashes)

    # ── API pública ──────────────────────────────────────────────────────────

    def run_sincronia_agent(self, project_name, operacoes=None):
        """Aplica as operações pendentes de mover/renomear/apagar.

        Sem `operacoes`, consome a fila persistida — é assim que o ciclo chama.
        Com `operacoes`, aplica só elas (botão manual do card).
        """
        def worker():
            contadores = {'movidos': 0, 'apagados': 0, 'pastas_marcadas': 0}
            try:
                self._sinc_notify(project_name, {'status': 'running'})
                ops = operacoes
                if ops is None:
                    ops = self._rp_pend_tomar_sincronia(project_name)
                    if not ops:
                        # Nada na fila: detecta na hora. É o caso do botão
                        # manual e da abertura do projeto.
                        ops = self.detectar_sincronia(project_name)
                if ops:
                    self._sinc_aplicar_saidas_por_arquivo(project_name, ops, contadores)
                    self._sinc_aplicar_resumo_pastas(project_name, ops, contadores)
                # ── A linha por arquivo, para a sub-aba Histórico ──────────
                #
                # ⚠️ ESCRITA DEPOIS de aplicar, e sobre `ops`, que é uma cópia
                # já retirada da fila. A Sincronia é a rotina que mais some da
                # tela: ela não chama LLM, termina em milissegundos, e o card
                # dela só mostra contadores. Quando ela quebrou (o
                # `delete_code_file` que ficou no arquivo errado), o único
                # rastro foi a aba Erros — não havia como saber QUAL arquivo
                # tinha sido apagado quando o erro aconteceu.
                for op in (ops or []):
                    self._hist_arquivo(
                        project_name, 'sincronia',
                        op.get('de'),
                        'movido' if op.get('op') == 'mover' else 'apagado',
                        detalhe=('para ' + op['para']) if op.get('para') else None)

                resumo = {
                    'finished_at': datetime.now().isoformat(),
                    'operacoes': len(ops or []),
                    **contadores,
                }
                os.makedirs(self._sinc_dir(project_name), exist_ok=True)
                with open(os.path.join(self._sinc_dir(project_name), '_resumo.json'),
                          'w', encoding='utf-8') as f:
                    json.dump(resumo, f, ensure_ascii=False, indent=2)
                self._sinc_notify(project_name, {'status': 'done', **resumo})
            except Exception as e:
                # Mesmo em erro, grava o _resumo.json: é o `finished_at` que o
                # ciclo espera para não travar a cadeia inteira atrás dele.
                try:
                    os.makedirs(self._sinc_dir(project_name), exist_ok=True)
                    with open(os.path.join(self._sinc_dir(project_name), '_resumo.json'),
                              'w', encoding='utf-8') as f:
                        json.dump({'finished_at': datetime.now().isoformat(),
                                   'error': str(e)}, f, ensure_ascii=False, indent=2)
                except Exception:
                    pass
                self._sinc_notify(project_name, {'status': 'error', 'error': str(e)})

        # A referência da thread fica registrada: é o que deixa o ciclo
        # saber que esta rotina continua viva (ver processando.py).
        self._proc_iniciar(project_name, 'sincronia', worker)
        return {'success': True}

    def get_sincronia_status(self, project_name):
        caminho = os.path.join(self._sinc_dir(project_name), '_resumo.json')
        if not os.path.isfile(caminho):
            return {'success': True, 'exists': False}
        try:
            with open(caminho, 'r', encoding='utf-8') as f:
                resumo = json.load(f)
        except Exception:
            return {'success': True, 'exists': False}
        return {'success': True, 'exists': True, 'resumo': resumo}

    def preview_sincronia(self, project_name):
        """O que o Sincronia faria agora, sem fazer. Alimenta o card."""
        try:
            return {'success': True, 'operacoes': self.detectar_sincronia(project_name)}
        except Exception as e:
            return {'success': False, 'error': str(e)}
