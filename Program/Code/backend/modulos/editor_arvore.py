"""A árvore da aba Editor — um nível por vez, e as duas bolinhas.

⚠️ ESTA ÁRVORE É PREGUIÇOSA, e isso não é otimização prematura: é o que separa
esta aba das outras cinco telas de árvore do programa. As outras leem uma pasta
de saída que o próprio programa gerou (dezenas ou centenas de `.md`) e podem
mandar a lista inteira de caminhos de uma vez para `arvore-pastas.js`. Esta lê a
**pasta raiz do projeto do usuário**, onde mora `node_modules` — dezenas de
milhares de arquivos, que numa listagem única virariam dezenas de milhares de
nós no DOM de uma vez. `editor_listar_pasta` faz UM `os.scandir` e nunca desce.

O aperto que sobra: a bolinha de contagem tem que aparecer SEM expandir a pasta,
e contar exige varrer. Não há saída que dê o número exato de graça. As três
saídas honestas são contagem rasa (mente por omissão — `Program/` mostraria 0),
contagem exata síncrona (trava ao abrir) e contagem exata assíncrona com
orçamento e marca de corte. É a terceira: `editor_contar_pastas` é uma chamada
SEPARADA, a árvore pinta antes dela responder, e o que estourou o orçamento
volta com `parcial: True` — a bolinha vira `20k+`. Número aproximado é mentira;
número com `+` não é.

⚠️ INVARIANTE: a bolinha conta sob exatamente o mesmo filtro que a expansão
revela. Se `editor_listar_pasta` esconde um arquivo que `_ed_contar` somou, o
usuário abre uma pasta marcada `12` e vê `3`.
"""

import os
import time

from .caminhos import *


# Acima disto, um arquivo não abre no editor. É teto de LEITURA, não de exibição:
# o arquivo continua na árvore, acinzentado, porque sumir seria pior — o usuário
# procuraria um arquivo que ele sabe que existe.
_ED_MAX_BYTES_EDITAVEL = 2 * 1024 * 1024


class EditorArvoreMixin:
    """A árvore, as contagens e o cartão da pasta."""

    # ── A raiz e a contenção ─────────────────────────────────────────────────

    def _ed_raiz(self, project_name):
        """A pasta raiz configurada, ou ValueError com a frase da tela.

        ⚠️ É a RAIZ, não as pastas de trabalho. O resto do programa trabalha
        sobre `working_folders` porque a pergunta lá é "o que a IA lê"; aqui a
        pergunta é "o que eu posso abrir", e o usuário pediu a raiz inteira.
        """
        cfg = self.load_workspace(project_name)
        raiz = (cfg.get('config') or {}).get('root_folder') if cfg.get('success') else None
        if not raiz or not os.path.isdir(raiz):
            raise ValueError('A pasta raiz deste projeto não está configurada. '
                             'Configure em Projeto → Workspace.')
        return os.path.normpath(raiz)

    @staticmethod
    def _ed_absoluto(raiz, caminho_relativo):
        """Relativo (com `/`) → absoluto, recusando o que sai da raiz.

        Duas camadas, nesta ordem: recusa caminho absoluto vindo da tela, e
        depois confere que o resultado normalizado ainda está sob a raiz. A
        segunda pega o `..` que a primeira não vê.
        """
        rel = (caminho_relativo or '').replace('/', os.sep).strip(os.sep)
        if os.path.isabs(rel) or (len(rel) > 1 and rel[1] == ':'):
            raise ValueError('Caminho absoluto não é aceito aqui.')
        alvo = os.path.normpath(os.path.join(raiz, rel))
        if alvo != raiz and not alvo.startswith(raiz + os.sep):
            raise ValueError('Esse caminho está fora da pasta raiz do projeto.')
        return alvo

    @staticmethod
    def _ed_relativo(raiz, absoluto):
        """Absoluto → relativo à raiz, sempre com `/`. '' para a própria raiz."""
        rel = os.path.relpath(absoluto, raiz)
        return '' if rel == '.' else rel.replace(os.sep, '/')

    @staticmethod
    def _ed_visivel(caminho, mostrar_ignorados):
        """O filtro único da aba — usado pela listagem, pela contagem e pela busca.

        ⚠️ NÃO FILTRA NADA, e é de propósito (D42 da obra «Qualidade da
        documentação»): o Editor mostra tudo de tudo, como o VS Code — «Esse
        negócio de nunca ler não pode afetar o editor». Nunca aplica Nunca ler
        (Configurações), nem Remover, nem Contexto sem leitura (Projeto): as
        três listas dizem o que o PROGRAMA lê, e não o que o usuário pode abrir
        para editar à mão. É também o único lugar do programa que olha a pasta
        raiz inteira.

        Até esta fase, `mostrar_ignorados=False` escondia o que está em Nunca
        ler; o botão 👁 que mandava isso já tinha saído em 30/08/2026 e o
        frontend manda `true` fixo. `caminho` e `mostrar_ignorados` ficam na
        assinatura porque as chamadas da ponte (`editor_listar_pasta`,
        `editor_contar_pastas`, `editor_cartao_da_pasta`, `editor_buscar_nome`,
        `editor_buscar_conteudo`) passam os dois; esta continua sendo o ponto
        único onde um filtro do Editor moraria — e não deve morar nenhum.
        """
        return True

    # ── Listar um nível ──────────────────────────────────────────────────────

    def editor_listar_pasta(self, project_name, caminho_relativo='', mostrar_ignorados=True):
        """UM nível da árvore. Nunca desce."""
        try:
            raiz = self._ed_raiz(project_name)
            alvo = self._ed_absoluto(raiz, caminho_relativo)
            pastas, arquivos = [], []
            with os.scandir(alvo) as entradas:
                for e in entradas:
                    try:
                        ehdir = e.is_dir(follow_symlinks=False)
                    except OSError:
                        continue
                    if not self._ed_visivel(e.path, mostrar_ignorados):
                        continue
                    rel = self._ed_relativo(raiz, e.path)
                    if ehdir:
                        pastas.append({'nome': e.name, 'caminho': rel,
                                       'vazia': self._ed_vazia(e.path, mostrar_ignorados)})
                    else:
                        try:
                            tam = e.stat(follow_symlinks=False).st_size
                        except OSError:
                            tam = 0
                        # `editavel` e `visualizavel` são coisas diferentes, e
                        # separá-las conserta um caso concreto: um PNG de 3 MB
                        # ficava acinzentado na árvore pelo teto de EDIÇÃO, e
                        # ver não é editar.
                        arquivos.append({
                            'nome': e.name, 'caminho': rel, 'bytes': tam,
                            'editavel': tam <= _ED_MAX_BYTES_EDITAVEL,
                            'visualizavel': self._ed_bin_e_imagem(e.name)})
            chave = lambda d: d['nome'].lower()
            return {'success': True,
                    'caminho': self._ed_relativo(raiz, alvo),
                    'pastas': sorted(pastas, key=chave),
                    'arquivos': sorted(arquivos, key=chave)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    @staticmethod
    def _ed_vazia(caminho, mostrar_ignorados):
        """Tem pelo menos um filho visível? Um `scandir` que para no primeiro.

        Existe para a seta ▸: sem isto toda pasta ganha seta, e clicar numa
        pasta vazia não faz nada — o usuário fica achando que travou.
        """
        # Qualquer filho conta: nada é escondido no Editor (ver `_ed_visivel`).
        try:
            with os.scandir(caminho) as entradas:
                for _ in entradas:
                    return False
        except OSError:
            return True
        return True

    # ── Contar, com orçamento ────────────────────────────────────────────────

    def _ed_cache(self, project_name):
        """O cache das contagens, criado na primeira vez.

        ⚠️ Sem `__init__`: nenhum mixin deste projeto tem, e é isso que torna a
        herança múltipla de `api.py` inerte. Quem precisa de estado o cria
        preguiçosamente, como aqui.
        """
        if not hasattr(self, '_ed_contagens'):
            self._ed_contagens = {}
        return self._ed_contagens.setdefault(project_name, {})

    def _ed_contar(self, caminho, mostrar_ignorados, limite):
        """(total, parcial) — desce até `limite` (segundos) e para onde estiver.

        Devolve o que conseguiu contar mais a marca de corte. Parar e mentir o
        número seria pior que parar e dizer que parou.
        """
        total, parcial, fim = 0, False, time.monotonic() + limite
        pilha = [caminho]
        while pilha:
            if time.monotonic() > fim:
                parcial = True
                break
            atual = pilha.pop()
            try:
                with os.scandir(atual) as entradas:
                    for e in entradas:
                        if not self._ed_visivel(e.path, mostrar_ignorados):
                            continue
                        try:
                            if e.is_dir(follow_symlinks=False):
                                pilha.append(e.path)
                            else:
                                total += 1
                        except OSError:
                            continue
            except OSError:
                continue
        return total, parcial

    def editor_contar_pastas(self, project_name, caminhos, mostrar_ignorados=True,
                             orcamento_ms=1500):
        """As bolinhas de um nível inteiro, numa chamada só.

        ⚠️ UMA chamada para a lista toda, e não uma por pasta: o caro aqui é o
        ida-e-volta da ponte pywebview, não o `os.walk`. E é uma chamada
        SEPARADA de `editor_listar_pasta` porque, junto, abrir uma pasta
        passaria a custar o tempo do filho mais lento dela — exatamente o que a
        preguiça foi comprada para evitar.

        O orçamento de 1500 ms não é chute. Medido neste projeto em 30/08/2026:
        varrer a raiz inteira (7.423 arquivos visíveis) custa **1806 ms na
        primeira vez e 109 ms depois**, porque o cache de disco do Windows
        assume. O primeiro valor é o que precisa caber, e é por pasta, não pelo
        conjunto — as duas maiores daqui levam 551 ms e 1114 ms. Um orçamento
        de 250 ms cortava as duas e mostrava `900+` onde o número exato existe e
        é o ponto da funcionalidade. Como a contagem roda DEPOIS de a árvore já
        estar na tela, um segundo a mais aqui não é um segundo de espera.
        """
        try:
            raiz = self._ed_raiz(project_name)
            cache = self._ed_cache(project_name)
            limite = max(0.02, (orcamento_ms or 1500) / 1000.0)
            contagens = {}
            for rel in (caminhos or []):
                em_cache = cache.get((rel, mostrar_ignorados))
                if em_cache is not None:
                    contagens[rel] = {'arquivos': em_cache[0], 'parcial': em_cache[1]}
                    continue
                total, parcial = self._ed_contar(
                    self._ed_absoluto(raiz, rel), mostrar_ignorados, limite)
                # Contagem parcial não vai para o cache: ela é resultado do
                # relógio, não da pasta. Guardada, congelaria o `20k+` para
                # sempre, mesmo depois de a máquina esfriar.
                if not parcial:
                    cache[(rel, mostrar_ignorados)] = (total, parcial)
                contagens[rel] = {'arquivos': total, 'parcial': parcial}
            return {'success': True, 'contagens': contagens}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def editor_esquecer_contagens(self, project_name, caminhos=None):
        """Joga fora o cache — o botão ↻, e os ancestrais de um arquivo novo.

        Sem lista, esquece o projeto inteiro. Salvar por cima de um arquivo que
        já existia NÃO chama aqui: a contagem não muda.
        """
        try:
            cache = self._ed_cache(project_name)
            if caminhos is None:
                cache.clear()
            else:
                for rel in caminhos:
                    cache.pop((rel, False), None)
                    cache.pop((rel, True), None)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── O cartão da bolinha ⓘ ────────────────────────────────────────────────

    def editor_cartao_da_pasta(self, project_name, caminho_relativo,
                               mostrar_ignorados=True, orcamento_ms=1500):
        """Total, subpastas, tamanho e a divisão por extensão.

        Orçamento seis vezes maior que o da bolinha, e de propósito: aqui o
        usuário clicou e está esperando, ali a árvore estava pintando.
        """
        try:
            raiz = self._ed_raiz(project_name)
            alvo = self._ed_absoluto(raiz, caminho_relativo)
            limite = max(0.05, (orcamento_ms or 1500) / 1000.0)
            fim = time.monotonic() + limite
            arquivos = subpastas = bytes_totais = 0
            parcial = False
            por_extensao = {}
            pilha = [alvo]
            while pilha:
                if time.monotonic() > fim:
                    parcial = True
                    break
                atual = pilha.pop()
                try:
                    with os.scandir(atual) as entradas:
                        for e in entradas:
                            if not self._ed_visivel(e.path, mostrar_ignorados):
                                continue
                            try:
                                if e.is_dir(follow_symlinks=False):
                                    subpastas += 1
                                    pilha.append(e.path)
                                    continue
                                tam = e.stat(follow_symlinks=False).st_size
                            except OSError:
                                continue
                            arquivos += 1
                            bytes_totais += tam
                            # Sem extensão vira '(sem extensão)' em vez de '':
                            # a tabela precisa de um rótulo, e `Makefile` e
                            # `LICENSE` são comuns o bastante para aparecer.
                            ext = os.path.splitext(e.name)[1].lower() or '(sem extensão)'
                            n, b = por_extensao.get(ext, (0, 0))
                            por_extensao[ext] = (n + 1, b + tam)
                except OSError:
                    continue
            lista = sorted(([ext, n, b] for ext, (n, b) in por_extensao.items()),
                           key=lambda t: (-t[1], t[0]))
            return {'success': True, 'caminho': self._ed_relativo(raiz, alvo),
                    'nome': os.path.basename(alvo) or alvo,
                    'arquivos': arquivos, 'subpastas': subpastas,
                    'bytes': bytes_totais, 'extensoes': lista, 'parcial': parcial}
        except Exception as e:
            return {'success': False, 'error': str(e)}
