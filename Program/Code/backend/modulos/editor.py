"""Ler e gravar arquivo de código pela aba Editor.

⚠️ ESTE É O PRIMEIRO LUGAR DO PROGRAMA QUE ESCREVE NO CÓDIGO DO USUÁRIO fora
dos agentes. Já existiu um `voltar_arquivo` em `backups_reverter.py` e ele foi
RETIRADO por decisão do usuário — "uma escrita pontual no disco, sem rede de
segurança, a um clique de distância, **dentro de uma tela cuja função é
olhar**". O aviso continua lá, e não está sendo contrariado: a diferença é a
última parte. Aqui a função da tela é editar, o usuário autorizou, e a rede é
outra — o Histórico local (`editor_historico.py`) guarda o conteúdo anterior a
cada gravação.

Duas armadilhas que fazem esta escrita ser diferente de qualquer outra do
projeto, e que valem os cuidados abaixo:

1. **Codificação e fim de linha.** `ler_arquivo_de_codigo` (documentacao.py) lê
   com `errors='replace'`, e está certo — é caminho de leitura pura. Aqui o
   texto volta ao disco: `replace` gravaria U+FFFD dentro do código, e um
   `open(..., 'w')` com `newline=None` traduziria `\\n` para `\\r\\n` no Windows.
   O efeito do segundo é o pior: abrir um arquivo LF e salvar SEM EDITAR NADA
   reescreveria todas as linhas, e o Detector, a rotina Hashes e todo diff da
   aba Backups veriam o arquivo inteiro como mudado. Por isso lemos bytes,
   decodificamos em utf-8 estrito, e devolvemos `fim_de_linha` e `bom` para
   regravar exatamente o que estava lá.

2. **Não somos o único que escreve.** A Fila, o Chat e as rotinas mexem nos
   mesmos arquivos. Abrir `app.js`, deixar a aba aberta, mandar a Fila
   trabalhar e dar Ctrl+S apagaria o trabalho dela em silêncio. Daí o
   `hash_esperado`: a gravação recusa quando o disco divergiu do que foi lido.

⚠️ NÃO avisa o Detector depois de gravar. `_det_anotar` observa as
`working_folders`, não a raiz: dentro da pasta de trabalho o vigia nativo já vê
a gravação sozinho e anotar duplicaria; fora dela, anotaria num vigia que não
cobre o caminho; com o vigia desligado é no-op silencioso. O Editor grava como
qualquer editor externo gravaria, e o Detector reage pelo mecanismo normal.
"""

import hashlib
import os
import re

from .caminhos import *
from . import ignorados
from . import versoes


# Espelha o teto de `editor_arvore._ED_MAX_BYTES_EDITAVEL`. Duplicado de
# propósito? Não: importado de lá seria ciclo. É o mesmo número com um nome só
# — quem mudar um muda o outro, e o teste da fatia 4 pega.
_ED_MAX_BYTES = 2 * 1024 * 1024

# Extensão → nome de gramática do Prism. Só o que diverge do óbvio precisa
# entrar: para o resto, `.xyz` → `xyz` acerta (`.py` é a exceção mais comum, e
# `.js`/`.css`/`.json` acertam sozinhos).
_ED_LINGUAGENS = {
    '.py': 'python', '.pyw': 'python', '.js': 'javascript', '.mjs': 'javascript',
    '.cjs': 'javascript', '.jsx': 'jsx', '.ts': 'typescript', '.tsx': 'tsx',
    '.mts': 'typescript', '.cts': 'typescript',
    '.md': 'markdown', '.html': 'markup', '.htm': 'markup', '.xml': 'markup',
    '.svg': 'markup', '.vue': 'markup', '.yml': 'yaml', '.sh': 'bash',
    '.bat': 'batch', '.ps1': 'powershell', '.rb': 'ruby', '.rs': 'rust',
    '.kt': 'kotlin', '.cs': 'csharp', '.h': 'c', '.hpp': 'cpp', '.cc': 'cpp',
    '.txt': 'none', '.cfg': 'ini', '.conf': 'ini', '.toml': 'toml',
}


class EditorMixin:
    """Leitura, gravação, resolução de documento e busca por conteúdo."""

    # ── Ler ──────────────────────────────────────────────────────────────────

    @staticmethod
    def _ed_fim_de_linha(texto):
        """Qual quebra domina o arquivo. Empate vai para LF.

        Conta `\\r\\n` antes de `\\n` sozinho, senão todo CRLF contaria duas
        vezes — como CRLF e como LF — e arquivo CRLF puro voltaria 'lf'.
        """
        crlf = texto.count('\r\n')
        lf   = texto.count('\n') - crlf
        cr   = texto.count('\r') - crlf
        if crlf >= lf and crlf >= cr and crlf:
            return 'crlf'
        if cr > lf:
            return 'cr'
        return 'lf'

    @staticmethod
    def _ed_linguagem(caminho):
        ext = os.path.splitext(caminho)[1].lower()
        if ext in _ED_LINGUAGENS:
            return _ED_LINGUAGENS[ext]
        return ext[1:] if ext else 'none'

    def editor_ler_arquivo(self, project_name, caminho_relativo):
        """O conteúdo com `\\n`, mais o que é preciso para devolvê-lo igual."""
        try:
            raiz = self._ed_raiz(project_name)
            alvo = self._ed_absoluto(raiz, caminho_relativo)
            if not os.path.isfile(alvo):
                return {'success': False, 'error': 'Esse arquivo não existe mais no disco.'}
            tamanho = os.path.getsize(alvo)
            with open(alvo, 'rb') as f:
                # ⚠️ Só a CABEÇA primeiro. Ler o arquivo inteiro para depois
                # descobrir que não é texto significa carregar 170 MB de um
                # `.rar` na memória para responder "isto é binário".
                cabeca = f.read(4096)
                # Um 0x00 nos primeiros 4 KB é binário — a mesma heurística de
                # `analise.py::search_code_content`, e pelo mesmo motivo: não
                # existe jeito barato e certo de saber, e este erra pouco. A
                # extensão de imagem entra junto porque SVG é TEXTO e mesmo
                # assim tem que abrir como imagem, não como código.
                if 0 in cabeca or self._ed_bin_e_imagem(alvo):
                    # ⚠️ `success: True` com `tipo: 'binario'`, e NÃO erro. Ver
                    # não é editar: o painel troca a superfície pelo visualizador
                    # e chama `editor_prever_binario`. Devolver erro aqui, como
                    # era até 30/08/2026, é o que fazia clicar num PNG não
                    # mostrar nada. O teto de tamanho também fica DEPOIS disto,
                    # senão uma imagem de 3 MB voltaria a ser recusada por um
                    # limite que só existe para texto.
                    return {'success': True, 'tipo': 'binario', 'bytes': tamanho,
                            'somente_leitura': True, 'linguagem': 'none'}
                if tamanho > _ED_MAX_BYTES:
                    return {'success': False,
                            'error': f'Arquivo de texto grande demais para o editor '
                                     f'({tamanho // 1024} KB, teto de {_ED_MAX_BYTES // 1024} KB).'}
                cru = cabeca + f.read()
            bom = cru.startswith(b'\xef\xbb\xbf')
            try:
                texto = cru.decode('utf-8-sig' if bom else 'utf-8')
            except UnicodeDecodeError:
                # Degrada com aviso em vez de gravar U+FFFD por cima do código:
                # abre para ler, recusa o Ctrl+S.
                return {'success': True, 'tipo': 'texto', 'somente_leitura': True,
                        'conteudo': cru.decode('utf-8', errors='replace'),
                        'hash': versoes.hash_do_conteudo(alvo),
                        'fim_de_linha': 'lf', 'bom': bom, 'bytes': tamanho,
                        'linguagem': self._ed_linguagem(alvo), 'linhas': 0,
                        'aviso': 'Este arquivo não é UTF-8. Aberto só para leitura, '
                                 'porque salvar trocaria os caracteres que não deram para ler.'}
            fim = self._ed_fim_de_linha(texto)
            # O editor trabalha só com `\n`; o original volta na gravação.
            normalizado = texto.replace('\r\n', '\n').replace('\r', '\n')
            return {'success': True, 'tipo': 'texto', 'somente_leitura': False,
                    'conteudo': normalizado,
                    'hash': versoes.hash_do_conteudo(alvo),
                    'fim_de_linha': fim, 'bom': bom, 'bytes': tamanho,
                    'linguagem': self._ed_linguagem(alvo),
                    'linhas': normalizado.count('\n') + 1}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Gravar ───────────────────────────────────────────────────────────────

    def editor_gravar_arquivo(self, project_name, caminho_relativo, conteudo,
                              hash_esperado=None, fim_de_linha='lf', bom=False,
                              forcar=False):
        """Grava, com o fim de linha e a codificação de quando foi lido.

        `hash_esperado` é a proteção contra a Fila (ver o cabeçalho). Com
        `forcar=True` a tela já perguntou e o usuário escolheu sobrescrever.
        """
        try:
            raiz = self._ed_raiz(project_name)
            alvo = self._ed_absoluto(raiz, caminho_relativo)
            existia = os.path.isfile(alvo)

            hash_do_disco = versoes.hash_do_conteudo(alvo) if existia else None
            if existia and hash_esperado and not forcar:
                if hash_do_disco != hash_esperado:
                    return {'success': False, 'motivo': 'mudou_no_disco',
                            'error': 'Este arquivo mudou no disco depois que você o abriu.'}

            texto = (conteudo or '').replace('\r\n', '\n').replace('\r', '\n')
            if fim_de_linha == 'crlf':
                texto = texto.replace('\n', '\r\n')
            elif fim_de_linha == 'cr':
                texto = texto.replace('\n', '\r')
            cru = texto.encode('utf-8-sig' if bom else 'utf-8')

            # ⚠️ SALVAR O QUE JÁ ESTÁ NO DISCO NÃO É SALVAR. Sem esta saída, o
            # Ctrl+S por hábito (o dedo que salva a cada dois minutos sem ter
            # digitado nada) reescreveria o arquivo — mexendo no mtime, que é o
            # que o Detector e a rotina Hashes olham — e criaria uma entrada de
            # histórico idêntica à anterior a cada vez, empurrando as boas para
            # fora do teto de entradas. A tela também barra este caso pelo
            # marcador de sujo, mas a regra não pode depender só dela.
            if existia and hashlib.md5(cru).hexdigest() == hash_do_disco:
                return {'success': True, 'hash': hash_do_disco, 'sem_mudanca': True}

            # A ordem importa, e é a rede de segurança inteira: a cópia do
            # conteúdo ANTERIOR sai primeiro; só depois o arquivo do usuário é
            # tocado. Invertido, uma queda no meio deixaria o arquivo truncado
            # e nada guardado.
            if existia:
                self._ed_guardar_no_historico(project_name, caminho_relativo, alvo)

            # `newline=''` é o que impede a tradução automática de `\n` para
            # `\r\n` no Windows. Sem ele, o `fim_de_linha` acima seria desfeito
            # pelo próprio Python. Escrever BYTES já resolveria isso sozinho, e
            # é o que fazemos — o `newline` fica documentado aqui porque a
            # tentação de voltar para `open(..., 'w')` é permanente.
            os.makedirs(os.path.dirname(alvo), exist_ok=True)
            temporario = alvo + '.editor.tmp'
            with open(temporario, 'wb') as f:
                f.write(cru)
            os.replace(temporario, alvo)

            if not existia:
                # Arquivo novo muda a contagem de todos os ancestrais. Salvar
                # por cima de um que já existia não muda nada.
                self.editor_esquecer_contagens(project_name, self._ed_ancestrais(caminho_relativo))
            return {'success': True, 'hash': versoes.hash_do_conteudo(alvo)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    @staticmethod
    def _ed_ancestrais(caminho_relativo):
        """['a/b', 'a', ''] para 'a/b/c.js' — as pastas cuja contagem mudou."""
        partes = (caminho_relativo or '').split('/')[:-1]
        return ['/'.join(partes[:i]) for i in range(len(partes), -1, -1)]

    # ── Do resultado semântico ao arquivo de código ──────────────────────────

    def editor_resolver_documento(self, project_name, doc_path):
        """`Program/Code/x.js.md` (chave da Documentação Técnica) → `Program/Code/x.js`.

        ⚠️ NÃO é só tirar o `.md`. A Documentação Técnica espelha as **pastas de
        trabalho** e põe o `basename` da pasta na frente da chave; a árvore do
        Editor é relativa à **raiz**. Os dois só coincidem quando a pasta de
        trabalho é filha direta da raiz — verdade neste projeto, e não no caso
        geral. Com `working_folders = ['C:/proj/src/app']` a chave é `app/x.js`
        e o caminho de verdade é `src/app/x.js`: sem esta função o clique no
        resultado semântico abriria nada, sem erro nenhum.
        """
        try:
            raiz = self._ed_raiz(project_name)
            rel = (doc_path or '').replace('\\', '/').strip('/')
            if rel.lower().endswith('.md'):
                rel = rel[:-3]
            if not rel:
                return {'success': False, 'error': 'Documento sem caminho.'}

            cfg = self.load_workspace(project_name)
            pastas = (cfg.get('config') or {}).get('working_folders') or []
            topo, resto = (rel.split('/', 1) + [''])[:2]
            for pasta in pastas:
                pasta = os.path.normpath(pasta)
                # A chave pode vir com o nome da pasta de trabalho na frente ou
                # sem — `_inspetor_resolver_absoluto` tolera os dois casos pela
                # mesma razão, e o formato depende de quem gerou o documento.
                for tentativa in ((resto if os.path.basename(pasta) == topo else None), rel):
                    if tentativa is None:
                        continue
                    absoluto = os.path.normpath(os.path.join(pasta, tentativa.replace('/', os.sep)))
                    if os.path.isfile(absoluto):
                        return {'success': True,
                                'caminho': self._ed_relativo(raiz, absoluto)}
            # Sem pasta de trabalho, ou nenhuma casou: tenta contra a raiz.
            if os.path.isfile(os.path.join(raiz, rel.replace('/', os.sep))):
                return {'success': True, 'caminho': rel}
            return {'success': False,
                    'error': 'Não achei o arquivo de código deste documento na pasta raiz.'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def editor_documento_do_arquivo(self, project_name, caminho_relativo):
        """O INVERSO de `editor_resolver_documento`: código → chave do documento.

        A chave que a Documentação Técnica usa leva o `basename` da
        pasta de trabalho na frente e `.md` no fim. Aqui o caminho chega relativo
        à RAIZ, então é preciso descobrir sob qual pasta de trabalho ele está e
        recortar por ali — as duas referências só coincidem quando a pasta de
        trabalho é filha direta da raiz, que é o caso deste projeto e não o do
        geral. Mesmo motivo, e mesma armadilha, de `editor_resolver_documento`.
        """
        try:
            raiz = self._ed_raiz(project_name)
            alvo = self._ed_absoluto(raiz, caminho_relativo)
            cfg = self.load_workspace(project_name)
            pastas = (cfg.get('config') or {}).get('working_folders') or []
            for pasta in pastas:
                pasta = os.path.normpath(pasta)
                if alvo == pasta or alvo.startswith(pasta + os.sep):
                    dentro = os.path.relpath(alvo, pasta).replace(os.sep, '/')
                    topo = os.path.basename(pasta)
                    return {'success': True, 'chave': f'{topo}/{dentro}.md'}
            return {'success': False,
                    'error': 'Este arquivo está fora das pastas de trabalho — '
                             'os agentes de documentação não passam por ele.'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def editor_chaves_do_resumo_da_pasta(self, project_name, caminho_relativo):
        """Pasta → chave(s) do agente `resumo-pastas` (menu "Copiar caminho +
        resumo da pasta"). Mesma ideia de `editor_documento_do_arquivo`, mas
        para pasta: a chave leva o `basename` da pasta de trabalho na frente,
        sem nome de arquivo no fim.

        `run_resumo_pastas_agent` (resumo_pastas.py) pode dividir uma pasta
        grande em "Pasta (parte N).md" — por isso devolve uma LISTA de chaves
        (uma só, no caso comum), lendo o disco em vez de supor que há uma
        parte só.
        """
        try:
            raiz = self._ed_raiz(project_name)
            alvo = self._ed_absoluto(raiz, caminho_relativo)
            cfg = self.load_workspace(project_name)
            pastas = (cfg.get('config') or {}).get('working_folders') or []
            for pasta in pastas:
                pasta = os.path.normpath(pasta)
                if alvo != pasta and not alvo.startswith(pasta + os.sep):
                    continue
                dentro = os.path.relpath(alvo, pasta).replace(os.sep, '/')
                topo = os.path.basename(pasta)
                rel_folder = topo if dentro == '.' else f'{topo}/{dentro}'

                base_out = obter_pasta_da_rotina(project_name, 'resumo-pastas')
                pasta_pai = os.path.join(base_out, *rel_folder.split('/')[:-1]) if '/' in rel_folder else base_out
                nome_base = rel_folder.split('/')[-1]
                if not os.path.isdir(pasta_pai):
                    return {'success': False, 'error': 'Este projeto ainda não gerou o Resumo de pastas.'}
                padrao_unico = f'{nome_base}.md'
                padrao_parte = re.compile(re.escape(nome_base) + r' \(parte \d+\)\.md$')
                achadas = sorted(
                    f for f in os.listdir(pasta_pai)
                    if f == padrao_unico or padrao_parte.match(f))
                if not achadas:
                    return {'success': False,
                            'error': 'Esta pasta ainda não tem Resumo de pastas gerado.'}
                sub = rel_folder.rsplit('/', 1)[0] if '/' in rel_folder else ''
                chaves = [f'{sub}/{f}' if sub else f for f in achadas]
                return {'success': True, 'chaves': chaves}
            return {'success': False,
                    'error': 'Esta pasta está fora das pastas de trabalho — '
                             'os agentes de documentação não passam por ela.'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def editor_erros_de_sintaxe(self, project_name, caminho_relativo, conteudo):
        """Sublinhado ondulado de erro de sintaxe (Obra 12) — usa o MESMO
        Tree-sitter que já alimenta a sub-aba Tree-sitter da aba Análise, sem
        dependência nova. Cobre só erro de SINTAXE (nó `ERROR`/`MISSING`);
        nunca semântica — Tree-sitter não sabe se uma variável existe.

        `conteudo` vem da TELA (não relê o disco): é o texto ainda não salvo
        que o usuário está editando agora, que é justamente o que precisa do
        aviso — o do disco já passou pela varredura da aba Análise.
        """
        try:
            from .treesitter import EXT_LANG, make_parser, extrair_erros_de_sintaxe
            ext = os.path.splitext(caminho_relativo)[1].lower()
            lang_name = EXT_LANG.get(ext)
            if not lang_name:
                return {'success': True, 'erros': []}
            parser = make_parser(lang_name)
            if not parser:
                return {'success': True, 'erros': []}
            tree = parser.parse(conteudo.encode('utf-8', 'replace'))
            return {'success': True, 'erros': extrair_erros_de_sintaxe(tree)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Busca por conteúdo ───────────────────────────────────────────────────

    def editor_buscar_nome(self, project_name, termo, mostrar_ignorados=True,
                           max_resultados=300):
        """Caminhos, relativos à raiz, cujo NOME DE ARQUIVO contém `termo`.

        ⚠️ Isto é uma busca no disco, e não um filtro sobre a árvore que está na
        tela — a distinção importa porque a árvore do Editor é preguiçosa. Um
        filtro só alcança o que já foi expandido, então "Por nome" escondia os
        arquivos das pastas abertas e deixava as fechadas intactas: abrir uma
        pasta durante o filtro mostrava "Pasta vazia" mesmo com arquivos dentro.
        Relatado pelo usuário em 30/08/2026.
        """
        try:
            alvo = (termo or '').strip().lower()
            if not alvo:
                return {'success': True, 'caminhos': [], 'truncado': False}
            raiz = self._ed_raiz(project_name)
            achados, truncado = [], False
            for pasta, subpastas, arquivos in os.walk(raiz):
                subpastas[:] = [d for d in sorted(subpastas)
                                if self._ed_visivel(os.path.join(pasta, d), mostrar_ignorados)]
                for nome in sorted(arquivos):
                    caminho = os.path.join(pasta, nome)
                    if not self._ed_visivel(caminho, mostrar_ignorados):
                        continue
                    if alvo not in nome.lower():
                        continue
                    if len(achados) >= max_resultados:
                        truncado = True
                        break
                    achados.append(self._ed_relativo(raiz, caminho))
                if truncado:
                    break
            return {'success': True, 'caminhos': self._ed_ordenar(achados, alvo),
                    'truncado': truncado}
        except Exception as e:
            return {'success': False, 'error': str(e), 'caminhos': []}

    @staticmethod
    def _ed_ordenar(caminhos, termo):
        """Nome exato primeiro, depois o mais raso, depois alfabético.

        A ordem do `os.walk` é a ordem do disco, e num projeto auto-hospedado
        (este) ela põe as saídas geradas na frente do código: buscar `api.py`
        devolvia três `.md` gerados de `Files/projects/…` antes do
        `Program/Code/backend/api.py` de verdade. Profundidade é o critério
        certo e é neutro — não sabe o que é "gerado", só que o que está mais
        perto da raiz é mais provável de ser o que se procura.
        """
        def chave(c):
            nome = c.rsplit('/', 1)[-1].lower()
            return (0 if nome == termo else 1, c.count('/'), c.lower())
        return sorted(caminhos, key=chave)

    def editor_buscar_conteudo(self, project_name, termo, mostrar_ignorados=True,
                               max_resultados=300):
        """Caminhos, relativos à RAIZ, dos arquivos que contêm `termo`.

        Espelha `analise.py::search_code_content`, inclusive a heurística de
        binário — mas contido na **raiz**, não nas pastas de trabalho. Buscar
        só nas pastas de trabalho cobriria menos do que a árvore mostra, sem
        dizer que estava cobrindo menos.
        """
        try:
            alvo = (termo or '').strip().lower()
            if not alvo:
                return {'success': True, 'caminhos': [], 'truncado': False}
            raiz = self._ed_raiz(project_name)
            achados, truncado = [], False
            for pasta, subpastas, arquivos in os.walk(raiz):
                subpastas[:] = [d for d in sorted(subpastas)
                                if self._ed_visivel(os.path.join(pasta, d), mostrar_ignorados)]
                for nome in sorted(arquivos):
                    if len(achados) >= max_resultados:
                        truncado = True
                        break
                    caminho = os.path.join(pasta, nome)
                    if not self._ed_visivel(caminho, mostrar_ignorados):
                        continue
                    try:
                        if os.path.getsize(caminho) > _ED_MAX_BYTES:
                            continue
                        with open(caminho, 'rb') as f:
                            cabeca = f.read(4096)
                            if 0 in cabeca:
                                continue
                            cru = cabeca + f.read()
                    except Exception:
                        continue
                    if alvo in cru.decode('utf-8', errors='replace').lower():
                        achados.append(self._ed_relativo(raiz, caminho))
                if truncado:
                    break
            return {'success': True, 'caminhos': self._ed_ordenar(achados, alvo),
                    'truncado': truncado}
        except Exception as e:
            return {'success': False, 'error': str(e), 'caminhos': []}
