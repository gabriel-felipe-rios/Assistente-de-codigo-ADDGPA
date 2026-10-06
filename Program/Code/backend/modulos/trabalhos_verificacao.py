"""A conferência do programa, sem IA — e o lastro que a sustenta.

Duas peças que só valem juntas:

    a CAMADA 1 confere, sem gastar chamada de modelo nenhuma, o que dá para
      conferir deterministicamente: os arquivos que a atividade diz ter tocado
      existem? um comando da lista de bloqueio foi tentado? dois pedaços
      paralelos pegaram o mesmo arquivo?

    o LASTRO é o que dá material para a camada 1 conferir. Sem ele, "quais
      arquivos foram tocados" é o que o agente DIZ ter tocado — e a conferência
      vira uma pergunta que a própria resposta responde. O lastro vem de fora
      da conversa: um hook `PostToolUse` do assistente externo, que o programa
      grava no `.claude/settings.json` do projeto e que registra cada uso de
      ferramenta num arquivo, independentemente do que o agente conta depois.

Três lições vieram do molde (`_fila_verificacao_camada1`) e continuam valendo
aqui — as três já foram defeito real neste projeto:

 1. Resolver pela CHAVE DO ÍNDICE, nunca comparar string crua de caminho. A
    mesma pasta tem prefixos diferentes conforme de onde a chamada partiu, e
    comparar cru reprova todo arquivo sempre que a pasta de trabalho não é a
    raiz — a pior falha possível, porque o resultado é plausível.
 2. A extensão que conta é a que o ÍNDICE de fato cobre, não uma lista fixa.
    Senão um `.md`/`.json`/`.txt` citado é reprovado por "não existe" sem
    chance nenhuma de conserto, porque nunca esteve no índice mesmo.
 3. Nunca engolir exceção em silêncio. Vira aprovação fantasma, e ainda
    descarta os problemas já achados nos itens anteriores.

⚠️ O ÚNICO PONTO EM QUE ESTE MÓDULO CHAMA CÓDIGO DA VIZINHANÇA DOS AGENTES
LOCAIS, e vale saber por quê. `_sub_chaves_do_indice` e
`_sub_resolver_chave_identificadores` moram em `agentes/ferramentas_subagentes.py`,
mas **não são o sistema de agentes locais**: são leitores puros do Índice de
Identificadores, sem LM Studio, sem Fila, sem `trava_ia.py`. A fronteira que a
discussão desenhou é sobre a MÁQUINA de agentes (os dez subagentes, a Fila, o
`fila-verificador`), e nenhuma delas é tocada aqui.

Reescrever esses dois em vez de reusá-los seria pior, e a lição 1 acima diz
exatamente por quê: um resolvedor próprio é a chance de comparar string crua e
reprovar todo arquivo em silêncio. Se um dia a fronteira precisar ser literal,
o certo é MOVER os dois para um módulo neutro de leitura de índice — não
duplicá-los aqui.
"""

import json
import os

from .caminhos import obter_pasta_de_trabalhos
from .trabalhos_estado import gravar_json_atomico, travar_entre_processos

# O arquivo que o hook escreve. `.jsonl`, e não `.json`, pelo mesmo motivo do
# `Histórico.jsonl` das rotinas: é escrito por ACRÉSCIMO, de fora do app, uma
# linha por uso de ferramenta. Reler e reescrever um array inteiro a cada
# evento perderia linha na primeira corrida entre dois terminais.
ARQUIVO_DE_LASTRO = 'Lastro.jsonl'

# O prefixo `_` é obrigatório e não é estética: `arquivos.py::_is_agent_content_file`
# lista todo `.json`/`.md` sem `_` como conteúdo de agente, e um arquivo de
# controle solto apareceria na tela como se fosse artefato gerado.
ARQUIVO_DO_HOOK = '_hook-lastro.py'


class TrabalhosVerificacaoMixin:

    # ── O lastro ─────────────────────────────────────────────────────────────

    def _trab_caminho_do_lastro(self, project_name):
        return obter_pasta_de_trabalhos(project_name, ARQUIVO_DE_LASTRO)

    def _trab_ler_lastro(self, project_name):
        """As linhas que o hook escreveu. Linha corrompida é PULADA, não fatal:
        o arquivo é escrito por outro processo e pode ser lido no meio de uma
        gravação — descartar a linha do meio é certo, desistir do arquivo
        inteiro por causa dela não.
        """
        caminho = self._trab_caminho_do_lastro(project_name)
        if not os.path.isfile(caminho):
            return []
        eventos = []
        try:
            with open(caminho, 'r', encoding='utf-8', errors='replace') as f:
                for linha in f:
                    linha = linha.strip()
                    if not linha:
                        continue
                    try:
                        eventos.append(json.loads(linha))
                    except Exception:
                        continue
        except Exception:
            return []
        return eventos

    def _trab_arquivos_com_lastro(self, project_name, id_atividade=None):
        """Os arquivos que o hook VIU serem escritos — não os que o agente diz."""
        tocados = []
        for e in self._trab_ler_lastro(project_name):
            if id_atividade and e.get('atividade') != id_atividade:
                continue
            caminho = (e.get('arquivo') or '').strip()
            if caminho and caminho not in tocados:
                tocados.append(caminho)
        return tocados

    def limpar_lastro_dos_trabalhos(self, project_name):
        """Zera o registro. Chamado antes de uma rodada nova: lastro de uma
        execução anterior contando como prova da seguinte é exatamente o que a
        regra existe para impedir.
        """
        try:
            caminho = self._trab_caminho_do_lastro(project_name)
            with travar_entre_processos(caminho):
                if os.path.isfile(caminho):
                    os.remove(caminho)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── A camada 1 ───────────────────────────────────────────────────────────

    def _trab_verificacao_camada1(self, project_name, atividade):
        """Confere o que dá para conferir sem modelo nenhum.

        Devolve `(ok, problemas, conferidos)` — mesma forma do molde da Fila,
        para o consumidor não precisar aprender um formato novo.
        """
        problemas, conferidos = [], []

        arquivos = atividade.get('arquivos') or []
        if not arquivos:
            return False, [(1, 'a atividade não apontou nenhum arquivo tocado')], []

        # Lição 2: a extensão que conta é a que o índice cobre de verdade.
        try:
            extensoes_cobertas = {os.path.splitext(k)[1].lower()
                                  for k in self._sub_chaves_do_indice(project_name)}
        except Exception:
            extensoes_cobertas = set()

        for n, caminho in enumerate(arquivos, 1):
            caminho = (caminho or '').strip()
            if not caminho:
                problemas.append((n, 'item sem caminho de arquivo'))
                continue
            if extensoes_cobertas:
                ext = os.path.splitext(caminho)[1].lower()
                if ext not in extensoes_cobertas:
                    # Fora do alcance do índice: não é conferido nem reprovado.
                    continue
            try:
                # Lição 1: pelo resolvedor de chave, nunca por comparação crua.
                self._sub_resolver_chave_identificadores(project_name, caminho)
                conferidos.append(n)
            except ValueError as e:
                mensagem = str(e)
                if 'não gerado' in mensagem:
                    # Sem índice não há o que conferir, e isso não é defeito da
                    # atividade. Sai sem marcar item nenhum.
                    return True, [], []
                if ('mais de um arquivo do índice' in mensagem
                        or 'Arquivos com esse nome' in mensagem):
                    problemas.append((n, mensagem))
                else:
                    problemas.append((n, f'arquivo citado não existe no índice: "{caminho}"'))
            except Exception as e:
                # Lição 3: nunca engolir. Devolve o que já achou junto do erro.
                problemas.append((n, f'não deu para conferir "{caminho}": {e}'))

        # A regra dura que sobreviveu a tudo: dois pedaços paralelos nunca
        # escrevem no mesmo arquivo.
        for caminho, quem in self._trab_conflitos_de_arquivo(project_name, atividade).items():
            problemas.append((0, f'"{caminho}" está sendo mexido por mais de um pedaço: '
                                 + ', '.join(quem)))

        # E a que não desliga: um comando da lista de bloqueio foi tentado.
        for tentativa in self._trab_bloqueios_tentados(project_name, atividade.get('id')):
            problemas.append((0, f'comando da lista de bloqueio tentado: "{tentativa}"'))

        return (not problemas), problemas, conferidos

    def _trab_conflitos_de_arquivo(self, project_name, atividade):
        """Arquivo que aparece em mais de um pedaço ao mesmo tempo.

        Olha para o lastro, e não para o que cada pedaço declarou: a declaração
        é a versão do agente, e é justamente ela que esta regra existe para não
        precisar acreditar.
        """
        por_arquivo = {}
        for e in self._trab_ler_lastro(project_name):
            if e.get('atividade') != atividade.get('id'):
                continue
            if not e.get('escreveu'):
                continue
            caminho = (e.get('arquivo') or '').strip()
            pedaco = (e.get('pedaco') or '').strip()
            if not caminho or not pedaco:
                continue
            por_arquivo.setdefault(caminho, set()).add(pedaco)
        return {c: sorted(p) for c, p in por_arquivo.items() if len(p) > 1}

    def _trab_bloqueios_tentados(self, project_name, id_atividade):
        """Comandos recusados que o hook registrou.

        ⚠️ A lista de comandos vem de `_trab_comandos_bloqueados`, e não de uma
        cópia local. É a mesma fonte que a tela desenha e que o system prompt
        anuncia — três cópias divergindo é o defeito que este projeto já teve
        com a lista de ferramentas do MCP.
        """
        bloqueados = [c.lower() for c in self._trab_comandos_bloqueados(project_name)]
        tentados = []
        for e in self._trab_ler_lastro(project_name):
            if id_atividade and e.get('atividade') != id_atividade:
                continue
            comando = (e.get('comando') or '').strip()
            if not comando:
                continue
            baixo = comando.lower()
            if any(baixo.startswith(b) or f' {b}' in baixo for b in bloqueados):
                if comando not in tentados:
                    tentados.append(comando)
        return tentados

    def verificar_atividade(self, project_name, id_atividade):
        """A porta da tela. Roda a camada 1 e devolve o veredito legível."""
        try:
            estado = self._trab_carregar(project_name)
            atividade = self._trab_achar(estado, id_atividade)
            if atividade is None:
                return {'success': False, 'error': f'Atividade não encontrada: {id_atividade}'}
            ok, problemas, conferidos = self._trab_verificacao_camada1(project_name, atividade)
            return {'success': True, 'aprovado': ok, 'conferidos': conferidos,
                    'problemas': [{'item': n, 'detalhe': t} for n, t in problemas]}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── O hook `PostToolUse` ─────────────────────────────────────────────────

    def _trab_escrever_script_do_hook(self, project_name):
        """O script que o hook chama. Mora em `Trabalhos/`, com prefixo `_`.

        Ele recebe o evento do assistente externo pelo stdin e acrescenta uma
        linha ao `Lastro.jsonl`. É deliberadamente burro: não decide nada, não
        recusa nada, só registra. Quem julga é a camada 1, do lado do programa
        — um hook que julga é um hook que precisa da lista de bloqueio
        duplicada dentro dele.
        """
        pasta = obter_pasta_de_trabalhos(project_name)
        os.makedirs(pasta, exist_ok=True)
        caminho = os.path.join(pasta, ARQUIVO_DO_HOOK)
        script = '''"""Gerado pelo programa — não edite à mão.

Acrescenta uma linha ao `Lastro.jsonl` a cada uso de ferramenta do assistente
externo. Roda como processo separado, disparado pelo hook `PostToolUse`.

Falha SEMPRE em silêncio, com codigo 0: um hook que quebra atrapalha a sessao
do assistente, e perder uma linha de lastro custa menos que derrubar o trabalho
em curso. A camada 1 trata lastro faltando como "nao conferido", nunca como
"aprovado".
"""
import json, os, sys
from datetime import datetime

try:
    evento = json.load(sys.stdin)
except Exception:
    sys.exit(0)

try:
    entrada = evento.get('tool_input') or {}
    linha = {
        'quando': datetime.now().isoformat(),
        'ferramenta': evento.get('tool_name') or '',
        'arquivo': entrada.get('file_path') or entrada.get('path') or '',
        'comando': entrada.get('command') or '',
        'escreveu': (evento.get('tool_name') or '') in ('Write', 'Edit', 'NotebookEdit'),
        'atividade': os.environ.get('VIBE_TRABALHOS_ATIVIDADE', ''),
        'pedaco': os.environ.get('VIBE_TRABALHOS_PEDACO', ''),
    }
    destino = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Lastro.jsonl')
    with open(destino, 'a', encoding='utf-8') as f:
        f.write(json.dumps(linha, ensure_ascii=False) + '\\n')
except Exception:
    pass
sys.exit(0)
'''
        with open(caminho, 'w', encoding='utf-8') as f:
            f.write(script)
        return caminho

    def registrar_hook_dos_trabalhos(self, project_name, root_folder, destino_rel=None):
        """Mescla o hook no arquivo de configuração do assistente externo.

        ⚠️ MESCLA, nunca sobrescreve — molde de `_mcp_registrar`. O arquivo é do
        USUÁRIO: ele pode já ter hooks próprios ali, e apagá-los seria destruir
        configuração que o programa não escreveu.

        ⚠️ O DESTINO VARIA POR PRODUTO, e é por isso que `destino_rel` existe —
        a mesma razão que fez `_mcp_registrar` ganhar esse parâmetro: o Cursor
        procura a configuração dele em outro lugar. Uma raiz fixa aqui quebraria
        em silêncio para todo produto que não seja o padrão.
        """
        try:
            if not root_folder or not os.path.isdir(root_folder):
                return {'success': False,
                        'error': 'Configure a pasta raiz do projeto na aba Trabalho primeiro.'}
            script = self._trab_escrever_script_do_hook(project_name)
            destino = self._juntar_relativo(root_folder, destino_rel) or os.path.join(
                root_folder, '.claude', 'settings.json')
            if not self._dentro_da_raiz(root_folder, destino):
                return {'success': False, 'error': 'destino do hook fora da pasta raiz.'}
            os.makedirs(os.path.dirname(destino), exist_ok=True)

            dados = {}
            if os.path.isfile(destino):
                try:
                    with open(destino, 'r', encoding='utf-8') as f:
                        dados = json.load(f)
                    if not isinstance(dados, dict):
                        dados = {}
                except Exception:
                    dados = {}

            hooks = dados.setdefault('hooks', {})
            entradas = hooks.setdefault('PostToolUse', [])
            if not isinstance(entradas, list):
                entradas = []
                hooks['PostToolUse'] = entradas
            comando = f'python "{script}"'
            # Só a NOSSA entrada sai e volta. As de outro hook do usuário ficam
            # exatamente onde estavam, na ordem em que estavam.
            entradas[:] = [e for e in entradas if not self._trab_e_nosso_hook(e, project_name)]
            entradas.append({
                'matcher': '*',
                'hooks': [{'type': 'command', 'command': comando}],
            })
            gravar_json_atomico(destino, dados)
            return {'success': True, 'arquivo': destino}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _trab_e_nosso_hook(self, entrada, project_name):
        """Reconhece a entrada que ESTE programa escreveu, e só ela.

        Casa pelo nome do script, que carrega o prefixo `_` e vive dentro da
        pasta `Trabalhos/` do projeto — um hook do usuário que por acaso chame
        `python` não é confundido com o nosso.
        """
        try:
            for h in (entrada.get('hooks') or []):
                if ARQUIVO_DO_HOOK in (h.get('command') or ''):
                    return True
        except Exception:
            pass
        return False

    def desregistrar_hook_dos_trabalhos(self, project_name, root_folder, destino_rel=None):
        """Tira só a nossa entrada. Se o `PostToolUse` ficar vazio, a chave sai
        junto — deixar um array vazio pendurado no arquivo do usuário é sujeira
        que ele não escreveu.
        """
        try:
            destino = self._juntar_relativo(root_folder, destino_rel) or os.path.join(
                root_folder, '.claude', 'settings.json')
            if not os.path.isfile(destino):
                return {'success': True}
            with open(destino, 'r', encoding='utf-8') as f:
                dados = json.load(f)
            if not isinstance(dados, dict):
                return {'success': True}
            hooks = dados.get('hooks') or {}
            entradas = hooks.get('PostToolUse')
            if isinstance(entradas, list):
                hooks['PostToolUse'] = [e for e in entradas
                                        if not self._trab_e_nosso_hook(e, project_name)]
                if not hooks['PostToolUse']:
                    hooks.pop('PostToolUse')
                if not hooks:
                    dados.pop('hooks', None)
            gravar_json_atomico(destino, dados)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}
