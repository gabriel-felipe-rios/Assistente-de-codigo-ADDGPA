"""**Em que classe esta mudança cai, e quem isso merece.**

O coração da Etapa 2. A Etapa 1 deixou o encanamento pronto — quem chama, quem
grava e quem lê já existiam — e marcava toda mudança como `codigo`, que acorda
tudo. Aqui a decisão passa a ser de verdade.

**Só as cinco rotinas que custam LLM decidem.** As outras dez custam segundos e
rodam sempre: pular o Grafo de Imports para poupar dois segundos só produz um
grafo desatualizado.

⚠️ **O `acorda` é uma DÍVIDA, não um retrato** — ver `_det_filtro_do_ciclo`. É a
armadilha mais fácil de não enxergar desta etapa, e ela some sem deixar rastro.

⚠️ **Gêmeo não é duplicado.** "Duplicados" já é o nome de outra rotina, que acha
função repetida. Gêmeo é outra coisa: dois caminhos VIVOS AO MESMO TEMPO com o
mesmo conteúdo. Confundir os dois é o jeito mais rápido de tornar isto ilegível.
"""

from ...constantes import *
from ..rotinas_config import EXTENSOES_NAO_CODIGO


class DetectorClassesMixin:
    """A árvore de decisão, os dois interruptores e o filtro do ciclo."""

    # ── A tabela ────────────────────────────────────────────────────────────
    #
    # Classe da mudança → ids de rotina que ela merece. Sai da tabela de doze
    # linhas do briefing. As notas que não são detalhe:
    #
    #  · Em `movido` e `apagado` quem faz trabalho de verdade é a SINCRONIA; as
    #    outras só reindexam, o que custa segundos.
    #  · Em `cosmetico` a DOC. TÉCNICA acorda, e não é engano: a Síntese
    #    dela nasce da docstring (D18). Em `constante` e `nao-codigo` também:
    #    a Documentação Técnica passou a descrever o arquivo inteiro, e não só os símbolos.
    #  · O PIPELINE acorda em `so-imports`, `movido`, `apagado` e `import`
    #    porque ele desenha o FLUXO DE EXECUÇÃO: arquivo que nasce, some, muda
    #    de lugar ou muda de import muda o desenho. Mudar o corpo de uma função,
    #    não. ⚠️ É esta linha que conserta o "cliquei em Ativar tudo com nada
    #    alterado e ele mandou o Pipeline para o LM Studio de novo".
    #  · O GLOSSÁRIO só acorda em `estrutura` — é quando o vocabulário do
    #    projeto muda.
    #  · `gemeo` acorda a Doc. Técnica, mas ela COPIA a saída do
    #    gêmeo em vez de gerar — ver `_det_gemeos_copiar`.
    _DET_ACORDA = {
        'vazio':            (),
        'so-imports':       ('pipeline',),
        'movido':           ('sincronia', 'pipeline'),
        'apagado':          ('sincronia', 'pipeline'),
        'cosmetico':        ('doc-tecnica', 'resumo-pastas'),
        'espaco-em-branco': (),
        'codigo':           ('doc-tecnica', 'resumo-pastas'),
        'estrutura':        ('doc-tecnica', 'resumo-pastas', 'glossario'),
        'import':           ('doc-tecnica', 'resumo-pastas', 'pipeline'),
        'constante':        ('doc-tecnica', 'resumo-pastas'),
        'nao-codigo':       ('doc-tecnica', 'resumo-pastas'),
        'gemeo':            ('doc-tecnica',),
    }

    # Qual régua decide cada classe — é o que a coluna "Régua" da tela de
    # Referência mostra, e o que dá sentido ao `%`:
    #   · "nenhuma"  — não se pergunta nada, a classe já decide sozinha;
    #   · "o quê"    — a tabela acima, para código;
    #   · "o quanto" — similaridade de sentido, para o que não é código;
    #   · "hash"     — dois caminhos vivos com o mesmo conteúdo.
    _DET_REGUA_DA_CLASSE = {
        'vazio': 'nenhuma', 'movido': 'nenhuma', 'apagado': 'nenhuma',
        'nao-codigo': 'o quanto', 'gemeo': 'hash',
    }

    # ── Os dois interruptores ───────────────────────────────────────────────

    def _det_preferencias(self):
        """Os dois campos de Configurações › Rotinas da Automação.

        Lidos UMA vez por passada, e só aqui: se o ciclo também os lesse, seriam
        dois donos da mesma decisão. Ela fica gravada no `mudanças.json`, o que
        a torna conferível na tabela do card.
        """
        try:
            lim = self.load_limites()['limites']
            return {'espaco': bool(lim.get('ignorar_so_espaco', True)),
                    'comentario': bool(lim.get('ignorar_so_comentario', False))}
        except Exception:
            return {'espaco': True, 'comentario': False}

    def _det_acorda(self, classe, caminho=None, prefs=None):
        """Classe → a lista de ids de rotina que ela merece."""
        if prefs is None:
            prefs = self._det_preferencias()
        if classe == 'espaco-em-branco' and not prefs['espaco']:
            # Interruptor desligado: reindentar volta a valer como alteração.
            return list(self._DET_ACORDA['codigo'])
        if classe == 'cosmetico' and prefs['comentario']:
            return []
        return list(self._DET_ACORDA.get(classe, self._DET_ROTINAS_CARAS))

    # ── A árvore de decisão ─────────────────────────────────────────────────

    def _det_classe_de(self, caminho, acao, antes, agora, gemeo=False):
        """Em qual das doze classes esta mudança cai.

        `antes` é a impressão da passada anterior e `agora` a de agora — ver
        `detector_impressoes.py`. Tudo determinístico, zero LLM.

        ⚠️ **Sem impressão anterior o resultado é `codigo`**, que acorda tudo. É
        o único fallback seguro, e a assimetria é de propósito: errar para mais
        custa uma chamada de LLM; errar para menos deixa a documentação velha
        para sempre, e em silêncio.
        """
        if acao in ('movido', 'renomeado'):
            return 'movido'
        if acao == 'apagado':
            return 'apagado'
        if gemeo:
            return 'gemeo'

        if not agora:
            return 'codigo'

        # ⚠️ A ORDEM DAQUI PARA BAIXO NÃO É ARBITRÁRIA, e ela já esteve errada
        # de duas maneiras — cada uma quebrando um teste do briefing em silêncio.
        #
        # A regra que organiza tudo: **primeiro o que se decide olhando só o
        # estado de AGORA**, depois o que precisa da impressão anterior. Um
        # arquivo vazio é vazio sem que ninguém precise saber como ele estava
        # ontem; um arquivo que "mudou só o comentário", não.
        #
        #   1. TAMANHO ZERO vem antes da extensão. Com a extensão na frente, um
        #      `.md` de zero byte virava `nao-codigo`, ia para a régua, não tinha
        #      pedaço nenhum com que comparar, a régua respondia "não sei" — e o
        #      Espelho (retirado em 2026-09) rodava. A linha 1 da tabela diz
        #      "régua nenhuma".
        #
        #   2. A EXTENSÃO vem antes dos símbolos. Um `.md` não tem gramática no
        #      tree-sitter, então `tem_simbolos` é falso para ele SEMPRE: com os
        #      símbolos na frente, todo markdown com texto viraria `vazio`.
        #
        #   3. OS SÍMBOLOS vêm antes do fallback `if not antes`. Com o fallback
        #      na frente, um arquivo NOVO só com `import` caía em `codigo` e
        #      acordava Doc. Técnica e Resumo de Pastas — a linha 2 diz
        #      que só o Pipeline acorda.
        if not agora.get('tamanho'):
            return 'vazio'

        if agora.get('grande'):
            # Não foi parseado: não há o que afirmar sobre o miolo dele.
            return 'codigo'

        ext = os.path.splitext(caminho or '')[1].lower()
        if ext in EXTENSOES_NAO_CODIGO:
            # Daqui em diante a régua é "o quanto" (similaridade), e quem a
            # aplica é `_det_levantar`, por `_det_vale_regerar_nao_codigo`.
            return 'nao-codigo'

        # Arquivo de código sem símbolo nenhum: ou está vazio de conteúdo real,
        # ou só tem import. O tree-sitter é quem responde — "só com imports" não
        # tem função nem classe para indexar.
        #
        # ⚠️ `antes` pode ser None aqui (arquivo recém-criado), e é de propósito
        # que nada deste ramo o consulte: `_det_mudou` faria `.get` em None, e
        # mais importante — é exatamente o arquivo novo que o teste do briefing
        # cria.
        if not agora.get('tem_simbolos'):
            return 'so-imports' if self._det_tem_import(agora) else 'vazio'

        if not antes or antes.get('grande'):
            return 'codigo'

        # Comentário e espaço, nesta ordem: os dois são "não mexeu no código",
        # e o que os separa é se a PROSA mudou junto.
        if not self._det_mudou(antes, agora, 'sem_comentario'):
            if self._det_mudou(antes, agora, 'comentarios'):
                return 'cosmetico'
            return 'espaco-em-branco'

        if self._det_mudou(antes, agora, 'imports'):
            return 'import'
        if self._det_mudou(antes, agora, 'simbolos'):
            return 'estrutura'

        if self._det_corpo_mudou(antes, agora):
            # ⚠️ CSS e HTML não têm corpo de função: o "símbolo" deles é o
            # seletor e o elemento. Mudança dentro de uma regra é, por
            # definição, VALOR — é isto que faz "mudei só uma cor" acordar a
            # Doc. Técnica e o Resumo de Pastas, e mais ninguém.
            return 'codigo' if agora.get('tem_corpo') else 'constante'

        # Mudou fora de todo corpo de símbolo: constante de módulo, texto de
        # interface, tabela no topo do arquivo.
        return 'constante'

    @staticmethod
    def _det_mudou(antes, agora, campo):
        """⚠️ Campo AUSENTE conta como mudou.

        Uma impressão antiga, gravada antes de o campo existir, não pode ser
        lida como "igual" — isso afirmaria uma coisa que ninguém mediu. Errar
        para mais aqui custa uma passada a mais; errar para menos cala a rotina
        para sempre.
        """
        a, b = antes.get(campo), agora.get(campo)
        if a is None or b is None:
            return True
        return a != b

    @staticmethod
    def _det_tem_import(imp):
        """Tem import de verdade? O hash de lista vazia é sempre o mesmo."""
        import hashlib
        vazio = hashlib.md5(b'').hexdigest()
        return bool(imp.get('imports')) and imp['imports'] != vazio

    @staticmethod
    def _det_corpo_mudou(antes, agora):
        a = antes.get('corpos') or {}
        b = agora.get('corpos') or {}
        if not a and not b:
            return False
        return any(a.get(k) != v for k, v in b.items())

    # ── O filtro do ciclo ───────────────────────────────────────────────────

    def _det_filtro_do_ciclo(self, project_name, mudados_pre):
        """Os ids que o Detector NÃO quer neste ciclo — ou `None`, "não filtre".

        ⚠️ **A REGRA DE QUANDO NÃO FILTRAR É A MESMA QUE O CICLO JÁ USA PARA
        `mudados_pre`, e não é coincidência:** as duas respondem a mesma
        pergunta — *"existe uma lista confiável do que mudou?"*.

        `mudados_pre is None` significa "processa tudo", e acontece num projeto
        SEM linha de base. Nesse caso `get_arquivos_mudados` devolve
        `baseline: False, mudados: []`, o Detector grava zero mudanças e o
        `acorda_pendente` sai vazio — filtrar aí faria o "Iniciar" de um projeto
        novo pular as cinco rotinas caras, **não gerar absolutamente nada e
        ainda assim dizer que concluiu**. É a falha número um desta etapa.

        Também não filtra quando o `mudanças.json` não existe, está ilegível ou
        é de antes desta etapa (sem a chave). Em toda dúvida, o comportamento é
        o de antes: roda.
        """
        if mudados_pre is None:
            return None
        try:
            dados = self._det_ler(project_name)
        except Exception:
            return None
        if not dados.get('gerado_em'):
            return None
        pendente = dados.get('acorda_pendente')
        if pendente is None:      # ⚠️ `[]` é "nada a fazer"; ausente é "não sei"
            return None
        return (set(self._DET_ROTINAS_CARAS) - set(pendente)
                - self._det_com_trabalho_pendente(project_name))

    def _det_com_trabalho_pendente(self, project_name):
        """As rotinas caras que devem trabalho, mudando o código ou não:
        as que NUNCA geraram saída (sem `_resumo.json`) e as cuja última
        passada terminou com erros.

        ⚠️ **SEM SAÍDA NÃO SE DISPENSA (24/09/2026).** Quem apaga a pasta das
        rotinas à mão (para gerar tudo de novo) não muda nada no código, e a
        linha de base do Hashes continua lá: o Detector não via mudança
        nenhuma, e Documentação Técnica, Resumo de Pastas, Glossário e Pipeline
        eram dispensadas em todo ciclo — num projeto sem pasta de
        Documentação Técnica, o Índice de Navegação ainda quebrava por falta
        dela.

        ⚠️ **ELAS NUNCA SÃO DISPENSADAS, e é o conserto de um defeito real
        (24/09/2026).** A dívida (`acorda_pendente`) é riscada quando a rotina
        TERMINA — e terminar com erros também é terminar. O LM Studio caiu no
        meio de uma Documentação Técnica e 297 arquivos saíram com "Connection
        error"; a dívida foi paga, e todo "Ativar tudo" seguinte dispensava a
        rotina com "o Detector não viu nada que peça esta rotina". Os 297
        ficavam sem documentação para sempre, até alguém mudar cada arquivo.

        Rodar de novo é barato: a rotina é incremental e só chama o modelo para
        o que ficou sem saída (o arquivo com erro não tem `.md` nem Síntese).
        Não é retentativa — é o ciclo seguinte fazendo o que o anterior não fez.
        """
        devendo = set()
        for agent_id in self._DET_ROTINAS_CARAS:
            try:
                if self._ac_get_resumo_time(project_name, agent_id) is None:
                    devendo.add(agent_id)
                    continue
                saldo = self._ac_saldo_da_rotina(project_name, agent_id) or {}
            except Exception:
                continue
            if saldo.get('erros'):
                devendo.add(agent_id)
        return devendo

    def _det_devendo(self, project_name, agent_ids):
        """O INVERSO de `_det_riscar`: anota que estas rotinas devem trabalho.

        Existe para o "Limpar dados gerados" parcial, e conserta um buraco real:
        apagar a pasta do Glossário num projeto em que nada mais mudou deixava
        `mudados_pre` vazio e `acorda_pendente` vazio, e o filtro logo acima
        dispensava as cinco rotinas caras — inclusive a que acabou de perder a
        pasta. O ciclo dizia "concluído" e o Glossário não voltava. Era preciso
        desligar tudo e ligar de novo para forçar.

        ⚠️ Só as CARAS entram, porque só elas passam pelo filtro: as outras dez
        rodam sempre, e uma delas na dívida seria uma chave que ninguém lê —
        `_det_gravar` faz a mesma interseção logo depois de escrever.

        ⚠️ A dívida SE SOMA à que já estava lá, como em `_det_gravar`. Escrever
        por cima apagaria o que uma leva de mudanças ainda devia.

        Silencioso em qualquer falha, e de propósito: não conseguir anotar a
        dívida faz o ciclo rodar A MAIS (o filtro cai no "não sei, roda"), que é
        o lado seguro de errar.
        """
        try:
            alvos = set(agent_ids) & set(self._DET_ROTINAS_CARAS)
            if not alvos:
                return
            caminho = obter_arquivo_de_mudancas(project_name)
            if not os.path.exists(caminho):
                # Sem o arquivo, `_det_filtro_do_ciclo` já devolve `None` —
                # "não filtre nada". Criar um só para gravar a dívida diria ao
                # ciclo seguinte MENOS do que o silêncio já diz.
                return
            dados = self._det_ler(project_name)
            pendente = set(dados.get('acorda_pendente') or []) | alvos
            dados['acorda_pendente'] = sorted(pendente)
            with open(caminho, 'w', encoding='utf-8') as f:
                json.dump(dados, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    def _det_riscar(self, project_name, agent_id):
        """Paga a dívida de uma rotina que TERMINOU.

        ⚠️ Chamado depois de o ciclo confirmar o fim, nunca antes — mesma regra
        que a linha de base do Hashes e a lista de caminhos da Espera seguem, e
        pelo mesmo motivo: ciclo interrompido no meio tem que deixar a dívida no
        disco para a próxima volta pagar. Riscar na entrada faria a mudança
        desaparecer sem nunca ter sido processada.
        """
        try:
            dados = self._det_ler(project_name)
            pendente = dados.get('acorda_pendente')
            if pendente is None or agent_id not in pendente:
                return
            dados['acorda_pendente'] = [a for a in pendente if a != agent_id]
            with open(obter_arquivo_de_mudancas(project_name), 'w', encoding='utf-8') as f:
                json.dump(dados, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    # ── Os gêmeos ───────────────────────────────────────────────────────────

    def _det_gemeos(self, project_name):
        """`{caminho absoluto do gêmeo: caminho absoluto da origem}`.

        Lido pela Doc. Técnica para saber o que copiar em vez de gerar. Ela
        recebe só isto — não precisa saber que o Detector existe.
        """
        pares = {}
        for m in (self._det_ler(project_name).get('mudancas') or []):
            if m.get('classe') == 'gemeo' and m.get('gemeo_de'):
                pares[os.path.normcase(os.path.abspath(m['caminho']))] = m['gemeo_de']
        return pares

    def _det_gemeo_cabecalho(self, origem_rel):
        """A linha que vai no topo da CÓPIA.

        ⚠️ Só na cópia, nunca na origem. O briefing pede as duas coisas — "cada
        `.md` ganha a linha" e "editou um, a linha some, **sem caso especial**"
        —, e elas não cabem juntas: com a linha também na origem, editar o gêmeo
        deixaria a origem mentindo até alguém regerá-la, e desfazer isso exigiria
        exatamente o caso especial que a segunda frase diz não existir.
        """
        return ('> 🧬 **Gêmeo de** `%s` — conteúdo idêntico; a documentação foi '
                'gerada uma vez só.\n' % origem_rel)

    def _det_gemeo_gravar(self, origem_chave, out_path, titulo, saida_base):
        """Copia o `.md` da origem para o do gêmeo. `True` se copiou.

        Devolve `False` quando a origem ainda não tem `.md` — e aí o gêmeo é
        gerado normalmente, porque copiar de nada não é economia, é perda. Na
        passada seguinte os papéis se acertam sozinhos.

        A chave da origem tem a forma `pasta-de-trabalho/caminho/relativo`, que é
        exatamente o que `saida_base` + chave + `.md` monta — as duas rotinas que
        chamam isto gravam a saída nesse mesmo formato.
        """
        try:
            origem_md = os.path.join(saida_base,
                                     origem_chave.replace('/', os.sep) + '.md')
            if not os.path.isfile(origem_md):
                return False
            with open(origem_md, 'r', encoding='utf-8', errors='replace') as f:
                bruto = f.read()
            # Fora o título da origem: o arquivo é outro, e manter o nome dela no
            # topo do `.md` do gêmeo é o tipo de erro que ninguém percebe até
            # abrir a aba Documentação e ver dois arquivos com o mesmo nome.
            linhas = bruto.split('\n')
            if linhas and linhas[0].startswith('# '):
                corpo = '\n'.join(linhas[1:]).lstrip('\n')
            else:
                corpo = bruto
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            with open(out_path, 'w', encoding='utf-8') as f:
                f.write('# %s\n\n%s\n%s'
                        % (titulo, self._det_gemeo_cabecalho(origem_chave), corpo))
            return True
        except Exception:
            return False

    # ── A tabela, para a tela de Referência ─────────────────────────────────

    def get_tabela_do_detector(self):
        """A tabela inteira: as 12 classes, o que cada uma acorda, e as réguas.

        ⚠️ **Gerada do código, nunca digitada.** É a mesma doutrina da tabela de
        Ferramentas dos subagentes: digitá-la à mão seria criar um segundo lugar
        para a verdade, e o segundo lugar é sempre o que fica desatualizado.

        ⚠️ E é `self._det_acorda(classe)` que responde, **não** `_DET_ACORDA`
        cru. Os dois interruptores de Configurações › Rotinas mudam o resultado
        de `cosmetico` e `espaco-em-branco`: lendo o dicionário direto, a tela
        mostraria uma coisa e o programa faria outra justamente para quem mexeu
        nas configurações — que é exatamente a pessoa que foi conferir a tabela.
        """
        prefs = self._det_preferencias()
        classes = []
        for classe in self._DET_ACORDA:
            classes.append({
                'classe': classe,
                'acorda': self._det_acorda(classe, None, prefs),
                # A régua que decide esta linha. É o que dá sentido ao `%` da
                # tabela: sem ela, "não-código" parece só mais uma classe.
                'regua': self._DET_REGUA_DA_CLASSE.get(classe, 'o quê'),
            })
        return {
            'success': True,
            'classes': classes,
            'caras': list(self._DET_ROTINAS_CARAS),
            # As dez que rodam sempre — a resposta para "por que o Grafo de
            # Imports regerou de novo se eu não mudei nada?".
            'sempre': [a for a in IDS_DAS_ROTINAS
                       if a not in self._DET_ROTINAS_CARAS],
            'preferencias': {
                'ignorar_so_espaco': prefs['espaco'],
                'ignorar_so_comentario': prefs['comentario'],
            },
            'limiares': {
                'doc-tecnica': int(round(self._det_limiar('doc-tecnica') * 100)),
                'resumo-pastas': int(round(self._det_limiar('resumo-pastas') * 100)),
            },
        }
