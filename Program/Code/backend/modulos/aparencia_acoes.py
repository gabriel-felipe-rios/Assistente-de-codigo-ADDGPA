from .constantes import *
from .aparencia_imagens import APARENCIA_EXTENSOES_IMAGEM

# ═════════════════════════════════════════ APARÊNCIA · AÇÕES: SAIR DA ABA ══
# Os três botões do cartão. Cada um se comporta diferente conforme o achado seja
# CÓDIGO ou IMAGEM, e é o desvio que dá sentido ao botão:
#
#   Copiar para IA        código: caminho + o trecho em volta
#                         imagem: o caminho e a paleta — não há trecho a mostrar
#   Abrir no arquivo      código: o editor, na linha exata
#                         imagem: a pasta, com o arquivo já selecionado
#   Abrir no editor       só imagem: entrega ao programa associado
#
# ⚠️ O relatório de IA continua sendo um RELATÓRIO, e não um "copiar caminho"
# seco. É o contexto em volta que faz a IA entender o que pode mudar — tirá-lo
# transformaria o botão numa cópia de área de transferência com passos a mais.


class AparenciaAcoesMixin:

    def aparencia_ler_trecho(self, project_name, arquivo, linha, contexto=3):
        try:
            caminho = self._aparencia_absoluto(project_name, arquivo)
            if not caminho:
                return {'success': False, 'error': 'Arquivo não encontrado: ' + str(arquivo)}
            linhas = self._aparencia_ler_linhas(caminho) or []
            inicio = max(0, int(linha) - 1 - contexto)
            fim = min(len(linhas), int(linha) + contexto)
            return {
                'success': True,
                'trecho': [{'numero': i + 1, 'texto': linhas[i].rstrip('\n')[:400],
                            'alvo': (i + 1) == int(linha)}
                           for i in range(inicio, fim)],
            }
        except Exception as erro:
            return {'success': False, 'error': str(erro)}

    def _aparencia_absoluto(self, project_name, arquivo):
        """Resolve o caminho de exibição de volta para o caminho real em disco."""
        if os.path.isabs(arquivo) and os.path.exists(arquivo):
            return arquivo
        relativo = arquivo.replace('/', os.sep)
        pastas, _i, _f = self._aparencia_escopo(project_name)
        for pasta in pastas:
            base = os.path.basename(pasta.rstrip(os.sep))
            tentativas = [os.path.join(pasta, relativo)]
            if relativo.startswith(base + os.sep):
                tentativas.append(os.path.join(pasta, relativo[len(base) + 1:]))
            for tentativa in tentativas:
                if os.path.exists(tentativa):
                    return tentativa
        return None

    def aparencia_abrir_no_arquivo(self, project_name, arquivo, linha=1):
        """Código: editor na linha exata. Imagem: a PASTA, com o arquivo selecionado.

        A imagem desvia porque "abrir na linha 1 de um `.png`" não quer dizer
        nada — o que se quer ali é chegar ao arquivo no disco.
        """
        try:
            caminho = self._aparencia_absoluto(project_name, arquivo)
            if not caminho:
                return {'success': False, 'error': 'Arquivo não encontrado: ' + str(arquivo)}
            if os.path.splitext(caminho)[1].lower() in APARENCIA_EXTENSOES_IMAGEM:
                subprocess.Popen(['explorer', '/select,', os.path.normpath(caminho)],
                                 shell=False)
                return {'success': True, 'editor': 'pasta'}
            alvo = '%s:%s' % (caminho, linha)
            for executavel in ('code.cmd', 'code'):
                try:
                    subprocess.Popen([executavel, '-g', alvo], shell=False)
                    return {'success': True, 'editor': 'VS Code'}
                except (FileNotFoundError, OSError):
                    continue
            os.startfile(caminho)
            return {'success': True, 'editor': 'programa padrão'}
        except Exception as erro:
            return {'success': False, 'error': str(erro)}

    def aparencia_abrir_no_editor_de_imagem(self, project_name, arquivo):
        """Entrega a imagem ao programa que o Windows associou a ela."""
        try:
            caminho = self._aparencia_absoluto(project_name, arquivo)
            if not caminho:
                return {'success': False, 'error': 'Arquivo não encontrado: ' + str(arquivo)}
        except Exception as erro:
            return {'success': False, 'error': str(erro)}
        # O verbo `edit` abre o EDITOR associado, e não o visualizador. Nem todo
        # tipo tem um: quando não tem, o Windows recusa e o `open` resolve.
        try:
            os.startfile(caminho, 'edit')
            return {'success': True, 'verbo': 'edit'}
        except Exception:
            pass
        try:
            os.startfile(caminho)
            return {'success': True, 'verbo': 'open'}
        except Exception as erro:
            return {'success': False, 'error': str(erro)}

    def aparencia_montar_relatorio_ia(self, project_name, achado, instrucao):
        """Contexto + contrato 'só aparência' para colar numa IA externa."""
        try:
            achado = achado or {}
            arquivo = achado.get('arquivo', '')
            linha = achado.get('linha', 1)
            eh_imagem = achado.get('fonte') == 'imagem'

            partes = []
            partes.append('Instrução: ' + (instrucao or '').strip())
            partes.append('')
            partes.append('Escopo permitido: apenas o valor visual indicado abaixo.')
            partes.append('Proibido: alterar estrutura, lógica, nomes de função, classe ou identificador.')
            if achado.get('ocorrencias', 1) > 1:
                partes.append('Atenção: este valor aparece em %d lugares do projeto — '
                              'confirme se a mudança vale para todos antes de alterar.'
                              % achado['ocorrencias'])
            partes.append('')
            partes.append('Alvo: %s' % (achado.get('alvo') or '(sem nome)'))
            # O caminho COMPLETO, e não o de exibição: quem cola isso numa IA
            # externa não tem como saber que "frontend/x.css" começa em
            # `Program/Code`.
            caminho = self._aparencia_absoluto(project_name, arquivo) or arquivo
            partes.append('Arquivo: %s' % caminho.replace(os.sep, '/'))
            if not eh_imagem:
                partes.append('Linha: %s' % linha)
            partes.append('Linguagem: %s' % achado.get('linguagem', ''))
            partes.append('Valor encontrado: %s' % achado.get('valor', ''))
            if achado.get('constante'):
                partes.append('Constante: %s' % achado['constante'])

            if eh_imagem:
                partes.append('Dimensões: %sx%s' % (achado.get('largura', '?'),
                                                    achado.get('altura', '?')))
                paleta = achado.get('paleta') or []
                if paleta:
                    partes.append('Paleta: ' + ' · '.join(
                        '%s %s (%s%%)' % (f['rotulo'], f['hex'], f['fatia']) for f in paleta))
                return {'success': True, 'texto': '\n'.join(partes)}

            trecho = self.aparencia_ler_trecho(project_name, arquivo, linha, 4)
            partes.append('')
            partes.append('Trecho:')
            for item in (trecho.get('trecho', []) if trecho.get('success') else []):
                marca = '>' if item['alvo'] else ' '
                partes.append('%s %5d | %s' % (marca, item['numero'], item['texto']))
            return {'success': True, 'texto': '\n'.join(partes)}
        except Exception as erro:
            return {'success': False, 'error': str(erro)}
