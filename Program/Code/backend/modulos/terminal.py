import re as _re
import shlex
import subprocess
import winreg

from .constantes import *


class TerminalMixin:
    """Aba Terminal: roda um script e explica o erro sem chamar LLM nenhum.

    Não é um terminal de verdade e não quer ser: é um executor de script com a
    saída ao vivo. Quem decide *qual programa* roda o arquivo é a associação do
    Windows — o mesmo caminho do duplo-clique —, não um palpite por extensão.

    O gatilho é o **exit code**, não o stderr sozinho — muito programa escreve
    aviso no stderr sem ter dado erro de fato. stdout e stderr são capturados
    separados porque respondem perguntas diferentes: o stack (stderr) diz
    *onde* estourou, o stdout diz *o que estava acontecendo* antes disso — e é
    aí que geralmente está a causa real.

    "Explicar este erro" é montagem de prompt, não uma chamada ao modelo: extrai
    arquivo:linha do stack, usa o índice de símbolos (tree-sitter) para achar a
    função que contém aquela linha, e o índice de identificadores para achar
    quem chama essa função. Tudo determinístico.
    """

    # `File "caminho", line N` — Python. Outros interpretadores podem ser
    # acrescentados aqui conforme o uso pedir.
    _TERM_STACK_PY = _re.compile(r'File "([^"]+)", line (\d+)')

    # Placeholders do template de `shell\open\command` no registro do Windows.
    _TERM_PH_ALVO = ('%1', '%l', '%L')
    _TERM_PH_LIXO = ('%*', '%2')

    # Processo em andamento, por projeto — é o que o Parar mata. Era um único
    # `_term_proc` de classe, certo enquanto só existia um projeto aberto por
    # vez; com abas de projeto simultâneas, "Parar" no projeto errado mataria
    # (ou perderia) o processo de outro projeto.
    _term_procs = None

    def _term_procs_dict(self):
        if self._term_procs is None:
            self._term_procs = {}
        return self._term_procs

    # As duas threads leitoras chamam `_term_notify` ao mesmo tempo, e o
    # `evaluate_js` do pywebview não é reentrante: duas chamadas simultâneas
    # podem se atropelar e uma delas se perder — quase sempre a do stderr, que
    # é a mais curta. Por isso a fila é serializada aqui.
    _term_notify_lock = threading.Lock()

    def _term_notify(self, project_name, payload):
        try:
            payload = dict(payload)
            payload['project'] = project_name
            with self._term_notify_lock:
                self.window.evaluate_js('terminalOutput(%s)' % json.dumps(payload))
        except Exception:
            pass

    def browse_script(self):
        """Reusa o diálogo nativo de arquivo já usado pelo Explorer."""
        return self.browse_path('file')

    # ── Resolver o programa pela associação do Windows ─────────────────────────

    def _term_progid(self, ext):
        """ProgId da extensão. O UserChoice ("Abrir com…") vence o padrão do HKCR."""
        try:
            chave = r'SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\FileExts\%s\UserChoice' % ext
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, chave) as k:
                progid = winreg.QueryValueEx(k, 'ProgId')[0]
                if progid:
                    return progid
        except OSError:
            pass
        try:
            with winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, ext) as k:
                return winreg.QueryValueEx(k, '')[0] or None
        except OSError:
            return None

    def _term_resolver_comando(self, caminho):
        """Comando que o Windows usaria no duplo-clique, ou None se não houver.

        Sem associação **não** há fallback: adivinhar o interpretador pela
        extensão é justamente o que escondia o problema — o usuário prefere ver
        a falha a rodar outra coisa sem saber.
        """
        ext = os.path.splitext(caminho)[1].lower()
        if not ext:
            return None
        progid = self._term_progid(ext)
        if not progid:
            return None
        try:
            with winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, r'%s\shell\open\command' % progid) as k:
                template = winreg.QueryValueEx(k, '')[0]
        except OSError:
            return None
        if not template:
            return None
        try:
            partes = shlex.split(template, posix=False)
        except ValueError:
            return None

        cmd, usou_alvo = [], False
        for p in partes:
            if p in self._TERM_PH_LIXO:
                continue
            if any(ph in p for ph in self._TERM_PH_ALVO):
                cmd.append(caminho)
                usou_alvo = True
                continue
            cmd.append(p.strip('"'))
        if not cmd:
            return None
        if not usou_alvo:  # template sem placeholder — o alvo vai no fim
            cmd.append(caminho)
        return cmd

    # ── Execução ───────────────────────────────────────────────────────────────

    def run_script(self, project_name, caminho):
        """Executa o script em thread, transmitindo stdout/stderr ao vivo.

        Sem timeout: script demorado é caso de uso, não travamento. Quem
        interrompe é o usuário, pelo botão Parar (`stop_script`).

        `project_name` existe porque a aba Terminal é por projeto: com mais de
        um projeto aberto ao mesmo tempo, o processo de cada um precisa ficar
        isolado — senão "Parar" no projeto errado mata o processo alheio.
        """
        def bombear(pipe, canal):
            """Lê um cano até o fim, agrupando o que chegou a cada ~120 ms.

            Uma notificação por linha afogaria o `evaluate_js` num log grande.
            """
            buf, ultimo = [], time.time()
            try:
                for linha in pipe:
                    buf.append(linha)
                    if time.time() - ultimo >= 0.12:
                        self._term_notify(project_name, {'status': 'chunk', 'canal': canal, 'texto': ''.join(buf)})
                        buf, ultimo = [], time.time()
            except Exception:
                pass
            if buf:
                self._term_notify(project_name, {'status': 'chunk', 'canal': canal, 'texto': ''.join(buf)})
            try:
                pipe.close()
            except Exception:
                pass

        def worker():
            # O aviso às extensões sai DEPOIS do `finally` (ver o fim desta
            # função); aqui só se guarda o que ele vai levar.
            fim = None
            try:
                self._term_notify(project_name, {'status': 'running'})
                cmd = self._term_resolver_comando(caminho)
                if not cmd:
                    ext = os.path.splitext(caminho)[1].lower() or '(sem extensão)'
                    self._term_notify(project_name, {'status': 'error', 'error':
                        'O Windows não tem programa associado a arquivos %s, então não há '
                        'como executar "%s". Associe a extensão a um interpretador e tente '
                        'de novo.' % (ext, os.path.basename(caminho))})
                    return

                proc = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    encoding='utf-8',
                    errors='replace',   # saída de outras linguagens nem sempre é UTF-8 limpa
                    bufsize=1,
                    cwd=os.path.dirname(caminho) or None,
                )
                self._term_procs_dict()[project_name] = proc

                # Um leitor por canal: stdout e stderr precisam continuar
                # separados — é disso que dependem as sub-abas e o explain_error.
                leitores = [
                    threading.Thread(target=bombear, args=(proc.stdout, 'out'), daemon=True),
                    threading.Thread(target=bombear, args=(proc.stderr, 'err'), daemon=True),
                ]
                for t in leitores:
                    t.start()
                for t in leitores:
                    t.join()

                codigo = proc.wait()
                self._term_notify(project_name, {
                    'status': 'done',
                    'comando': ' '.join(cmd),
                    'exit_code': codigo,
                })
                fim = {'projeto': project_name, 'caminho': caminho,
                       'codigo_de_saida': codigo,
                       'como': 'parado' if getattr(proc, 'parado_pelo_usuario', False)
                               else 'terminou'}
            except Exception as e:
                self._term_notify(project_name, {'status': 'error', 'error': str(e)})
            finally:
                self._term_procs_dict().pop(project_name, None)
            # `terminal.rodou` — DEPOIS de avisar a tela e de soltar o processo:
            # `emitir` espera as extensões até 2 s, e segurar o `pop` esse tempo
            # deixaria um ▶ Executar novo nesse intervalo ter o processo dele
            # tirado da lista por este `finally` (e o ⏹ não o acharia).
            # Guardiã que barrou ou TOMOU a execução não chega aqui: nesses casos
            # o frontend nem chama `run_script` (`terminal-extensoes.js`).
            if fim is not None:
                from .extensoes import eventos as xt_eventos
                xt_eventos.emitir('terminal.rodou', fim)

        threading.Thread(target=worker, daemon=True).start()
        return {'success': True}

    def stop_script(self, project_name):
        """Mata a **árvore** do processo em andamento daquele projeto, se houver.

        Matar só o pai deixaria órfão todo subprocesso que o script abriu, e eles
        continuariam segurando os canos. Seguro de chamar sem nada rodando.
        """
        proc = self._term_procs_dict().get(project_name)
        if not proc or proc.poll() is not None:
            return {'success': True, 'rodando': False}
        # Marca no próprio processo, para o `worker` dizer `como: "parado"` no
        # `terminal.rodou` — o código de saída sozinho não distingue um script
        # morto pelo taskkill de um que terminou com erro.
        proc.parado_pelo_usuario = True
        try:
            subprocess.run(['taskkill', '/F', '/T', '/PID', str(proc.pid)],
                           capture_output=True, timeout=10)
        except Exception as e:
            return {'success': False, 'error': str(e)}
        return {'success': True, 'rodando': True}

    # ── Explicar erro (determinístico, sem LLM) ────────────────────────────────

    def _term_extrair_local(self, stderr):
        """Último `arquivo:linha` do stack — é o ponto onde estourou de fato."""
        ocorrencias = self._TERM_STACK_PY.findall(stderr or '')
        if not ocorrencias:
            return None, None
        caminho, linha = ocorrencias[-1]
        try:
            return caminho, int(linha)
        except ValueError:
            return None, None

    def _term_funcao_na_linha(self, project_name, caminho, linha):
        """Símbolo (função/método) cujo corpo contém a linha, via índice de símbolos."""
        idx = self.get_symbol_index(project_name)
        if not idx.get('success') or not idx.get('index'):
            return None
        symbols = [s for s in idx['index'].get('symbols', [])
                   if os.path.normcase(os.path.abspath(s['file'])) == os.path.normcase(os.path.abspath(caminho))]
        if not symbols:
            return None
        symbols.sort(key=lambda s: s['line'])
        candidato = None
        for s in symbols:
            if s['line'] <= linha:
                candidato = s
            else:
                break
        return candidato

    def explain_error(self, project_name, comando, stdout, stderr, exit_code):
        """Monta o prompt determinístico para colar no Claude Code. Sem LLM."""
        try:
            caminho, linha = self._term_extrair_local(stderr)
            partes = [
                'Comando: %s' % comando,
                'Exit code: %s' % exit_code,
                '',
            ]

            funcao_info = ''
            chamadores_info = ''
            if caminho and linha:
                rel = caminho
                workspace = self.load_workspace(project_name)
                if workspace.get('success'):
                    for folder in workspace['config'].get('working_folders', []):
                        if os.path.normcase(caminho).startswith(os.path.normcase(folder)):
                            rel = os.path.relpath(caminho, folder).replace('\\', '/')
                            break

                partes.append('Stack aponta para: %s:%s' % (rel, linha))

                sym = self._term_funcao_na_linha(project_name, caminho, linha)
                if sym:
                    funcao_info = sym['name']
                    partes.append('Função que contém a linha (via tree-sitter): %s()' % sym['name'])

                    rel_ident = None
                    if hasattr(self, 'get_relacoes'):
                        try:
                            r = self.get_relacoes(project_name, rel)
                            if r.get('success') and r.get('usado_por'):
                                chamadores_info = ', '.join(
                                    '%s:%s' % (u['arquivo'], ', '.join(u['via'][:2]))
                                    for u in r['usado_por'][:5])
                                partes.append('')
                                partes.append('Chamada por (via índice de identificadores):')
                                for u in r['usado_por'][:5]:
                                    partes.append('  %s — %s' % (u['arquivo'], ', '.join(u['via'][:3])))
                        except Exception:
                            pass
            else:
                partes.append('Stack não identificou arquivo:linha (interprete manualmente).')

            ultimas_stdout = [l for l in (stdout or '').splitlines() if l.strip()][-5:]
            if ultimas_stdout:
                partes.append('')
                partes.append('Últimas linhas do stdout antes do erro:')
                for l in ultimas_stdout:
                    partes.append('  %s' % l)

            if stderr:
                partes.append('')
                partes.append('Erro:')
                partes.append(stderr.strip()[-1500:])

            return {'success': True, 'prompt': '\n'.join(partes),
                   'arquivo': caminho, 'linha': linha, 'funcao': funcao_info}
        except Exception as e:
            return {'success': False, 'error': str(e)}
