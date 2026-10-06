import os
import shutil

# `ACERVO_PRESETS` (o preset de fábrica) — mesmo caminho de importação que
# `arquivos.py` usa para `INICIOS_RAPIDOS`.
from .constantes import *  # noqa: F401,F403

# A base normativa mora DENTRO do projeto do usuário, não dentro do Assistente.
# É o que permite o chat do LM Studio e o assistente externo lerem o MESMO
# arquivo: antes a regra ficava em Files/projects/{proj}/regras/, que só o chat
# enxergava. Duas cópias em dois lugares dessincronizam na primeira edição.

# A forma da base (o que é regra, o que é instrução, os nomes fixos) mora em
# `regras_formato.py`, e é REEXPORTADA daqui. Não é gosto: `regras_indice.py`
# e `arquivos.py` também leem esses nomes, e um mixin não herda o namespace do
# arquivo que o compõe — `gerar_indice_regras` levantava `NameError` em
# `ARQUIVO_INDICE` por esse exato motivo (o mesmo defeito descrito abaixo para
# o Acervo), e a ponte do pywebview engolia o erro.
from .regras_formato import *  # noqa: F401,F403

# A aba Acervo (ex-"Decisões") não tem mais fontes fixas — as pastas vêm do
# PRESET escolhido pelo projeto (`acervo_preset_ativo` no Workspace.json,
# resolvido contra os presets de `settings.json` — ver `_acervo_pastas` mais
# abaixo). Um projeto sem preset escolhido mostra a aba vazia.
# ⚠️ `PASTA_BASE_REGRAS`, `EXTENSOES_DECISOES`, `_normalizar_caminho_pasta` e
# `_e_pasta_de_regras_e_instrucoes` MORAVAM AQUI, e quem os usa é
# `regras_acervo.py` — oito chamadas lá, nenhuma aqui. Um mixin NÃO herda o
# namespace do arquivo que o compõe: cada método procura o nome nos globais do
# MÓDULO em que foi escrito. O resultado era `NameError` em toda chamada do
# Acervo que tocasse num caminho — `save_acervo_presets`,
# `listar_arvore_decisoes`, `ler_arquivo_decisoes`, `salvar_arquivo_livre_acervo`
# e `deletar_arquivo_livre_acervo`.
#
# Nada disso aparecia: a ponte do pywebview transforma a exceção em promessa
# rejeitada, o `await` da tela estoura sem `catch`, e o usuário via o Salvar
# "funcionar" sem notificação nenhuma e sem gravar. A aba Acervo ficava vazia
# pelo mesmo motivo.
#
# Eles desceram para `regras_acervo.py`, e a casca os REEXPORTA — `PASTA_BASE_REGRAS`
# continua saindo daqui para `arquivos_preparar.py`, como o ⚠️ abaixo promete.
from .regras_acervo import (RegrasAcervoMixin, PASTA_BASE_REGRAS,
                            EXTENSOES_DECISOES, _normalizar_caminho_pasta,
                            _e_pasta_de_regras_e_instrucoes)
from .regras_indice import RegrasIndiceMixin


# Este arquivo era 626 linhas e virou três, pelo teto de 500 da AMF:
#
#   regras.py         onde as regras ficam, como se lê uma, e as estatísticas
#   regras_acervo.py  os presets do Acervo e as pastas genéricas
#   regras_indice.py  o índice para o assistente externo, e a escrita
#
# ⚠️ `PASTA_BASE_REGRAS` CONTINUA SAINDO DAQUI. `arquivos_preparar.py` a importa
# por este endereço, e o destino das Regras e instruções não é campo de preset
# nenhum: é a mesma pasta que a aba Acervo edita e que os subagentes leem.
class RegrasMixin(RegrasAcervoMixin, RegrasIndiceMixin):
    # ------------------------------------------------------------------
    # Caminhos
    # ------------------------------------------------------------------

    def _regras_dir(self, project_name, obrigatorio=False):
        """Pasta da base normativa dentro do projeto do usuário.

        Sem pasta raiz configurada não existe base nenhuma. Os chamadores de
        tela e de contagem passam obrigatorio=False e recebem '' (a aba mostra
        vazio em vez de estourar); as ferramentas de subagente passam
        obrigatorio=True porque o modelo precisa receber o motivo do erro.
        """
        try:
            raiz = self._sub_root_folder(project_name)
        except Exception:
            if obrigatorio:
                raise
            return ''
        return os.path.join(raiz, PASTA_BASE_REGRAS)

    def _regras_base(self, project_name, criar=False, obrigatorio=False):
        """A pasta da base — os itens moram direto nela, um por pasta."""
        base = self._regras_dir(project_name, obrigatorio=obrigatorio)
        if base and criar:
            os.makedirs(base, exist_ok=True)
        return base

    @staticmethod
    def _regras_nome_principal(nome):
        """O principal tem o nome da pasta: `{Nome}/{Nome}.md`."""
        return f'{nome}.md'

    @classmethod
    def _regras_arquivos_do_item(cls, pasta, nome):
        """Os `.md` de um item, com o principal sempre primeiro — ou [] se a
        pasta não é um item (nenhum `.md` direto nela).

        O principal é o que tem o nome da pasta. Um item jogado na mão sem
        ele ainda aparece: cai no primeiro `.md` em ordem alfabética, porque
        sumir da lista em silêncio é pior que mostrar com o nome errado.
        """
        try:
            nomes = sorted((n for n in os.listdir(pasta)
                            if n.lower().endswith('.md')
                            and not n.startswith(PREFIXO_HISTORICO)
                            and os.path.isfile(os.path.join(pasta, n))),
                           key=str.lower)
        except Exception:
            return []
        if not nomes:
            return []
        principal = cls._regras_nome_principal(nome)
        if principal not in nomes:
            principal = nomes[0]
        return [principal] + [n for n in nomes if n != principal]

    @staticmethod
    def _regras_tipo(arquivos):
        """Um arquivo só é regra; o principal mais apoio é instrução."""
        return 'instrucao' if len(arquivos) > 1 else 'regra'

    def _regras_itens_no_disco(self, base):
        """(nome, pasta, arquivos) de cada item da base, em ordem de nome."""
        itens = []
        try:
            nomes = sorted(os.listdir(base), key=str.lower)
        except Exception:
            return itens
        for nome in nomes:
            pasta = os.path.join(base, nome)
            if not os.path.isdir(pasta):
                continue
            arquivos = self._regras_arquivos_do_item(pasta, nome)
            if arquivos:
                itens.append((nome, pasta, arquivos))
        return itens

    # ------------------------------------------------------------------
    # Formato dos arquivos
    # ------------------------------------------------------------------

    @staticmethod
    def _ler_texto(caminho):
        try:
            with open(caminho, 'r', encoding='utf-8', errors='replace') as f:
                return f.read()
        except Exception:
            return ''

    @staticmethod
    def _extrair_secoes(texto):
        """Quebra o markdown nas seções de nível 2 (`## Título`).

        O principal de regra e de instrução começa pelas mesmas duas seções —
        Descrição e Quando se aplica; a regra segue com Regra, a instrução com
        O que esta receita cobre e Arquivos. Esta é a única função que sabe
        disso: o índice, a listagem e a cópia derivam todos daqui, para o
        formato não acabar reimplementado em três lugares que divergem.
        """
        secoes = {}
        titulo_atual = None
        linhas_atuais = []
        for linha in (texto or '').splitlines():
            if linha.startswith('## '):
                if titulo_atual is not None:
                    secoes[titulo_atual] = '\n'.join(linhas_atuais).strip()
                titulo_atual = linha[3:].strip()
                linhas_atuais = []
            elif titulo_atual is not None:
                linhas_atuais.append(linha)
        if titulo_atual is not None:
            secoes[titulo_atual] = '\n'.join(linhas_atuais).strip()
        return secoes

    @classmethod
    def _quando_se_aplica(cls, texto):
        """A frase de gatilho — uma frase, não um parágrafo."""
        quando = cls._extrair_secoes(texto).get(SECAO_QUANDO, '').strip()
        return ' '.join(quando.split())

    @classmethod
    def _descricao_de(cls, texto):
        descricao = cls._extrair_secoes(texto).get(SECAO_DESCRICAO, '').strip()
        return ' '.join(descricao.split())

    @staticmethod
    def montar_regra_markdown(nome, descricao='', quando='', corpo=''):
        """Monta o `.md` de uma regra nas três seções fixas, nesta ordem."""
        return (
            f'# {nome}\n\n'
            f'## {SECAO_DESCRICAO}\n{(descricao or "").strip()}\n\n'
            f'## {SECAO_QUANDO}\n{(quando or "").strip()}\n\n'
            f'## {SECAO_REGRA}\n{(corpo or "").strip()}\n'
        )

    @staticmethod
    def montar_instrucao_markdown(nome, descricao='', quando='', corpo=''):
        """Monta o principal de uma instrução (receita) — a parte indexada.

        O passo a passo não mora aqui: mora em `Como aplicar.md`, que é o que
        faz a pasta ter dois arquivos e, portanto, ser uma instrução.
        """
        texto = (
            f'# {nome}\n\n'
            f'## {SECAO_DESCRICAO}\n{(descricao or "").strip()}\n\n'
            f'## {SECAO_QUANDO}\n{(quando or "").strip()}\n'
        )
        corpo = (corpo or '').strip()
        if corpo:
            texto += f'\n## {SECAO_COBRE}\n{corpo}\n'
        texto += f'\n## {SECAO_ARQUIVOS}\n- `{ARQUIVO_COMO_APLICAR}` — o passo a passo\n'
        return texto

    @staticmethod
    def montar_como_aplicar_markdown(nome):
        """O esqueleto do `Como aplicar.md`: as quatro partes que toda receita tem."""
        return (
            f'# {nome} — como aplicar\n\n'
            '## De onde copiar\n\n'
            '## O que trocar\n\n'
            '## Onde registrar\n\n'
            '## Como conferir\n'
        )

    # ------------------------------------------------------------------
    # Leitura
    # ------------------------------------------------------------------

    def list_regras(self, project_name):
        """Os dois tipos numa lista só — a mesma pasta no disco, o tipo pela forma.

        ⚠️ `pasta_existe` NÃO É DECORAÇÃO. Sem ele, "esta pasta não existe neste
        projeto" e "esta pasta existe e está vazia" chegavam à tela como a mesma
        lista vazia, e a aba dizia "Nenhuma regra ou instrução criada ainda" nos
        dois casos. Como a PRIMEIRA pasta do preset de fábrica é
        `Saída das skills/Regras e instruções`, um projeto que não a tenha abria
        o Acervo numa sub-aba vazia — indistinguível de "escolher o preset não
        funcionou", que foi exatamente como o defeito chegou.
        """
        base = self._regras_base(project_name)
        if not base or not os.path.isdir(base):
            return {'success': True, 'regras': [], 'pasta_existe': False}

        itens = []
        for nome, pasta, arquivos in self._regras_itens_no_disco(base):
            lidos = [{'name': fname, 'content': self._ler_texto(os.path.join(pasta, fname))}
                     for fname in arquivos]
            principal = lidos[0]['content']
            item = {
                'tipo': self._regras_tipo(arquivos),
                'name': nome,
                'principal': arquivos[0],
                'content': principal,
                'descricao': self._descricao_de(principal),
                'quando': self._quando_se_aplica(principal),
            }
            # A regra é um arquivo só e viaja como `content`; a instrução vai
            # com todos os arquivos, porque o chat manda um bloco por arquivo.
            if item['tipo'] == 'instrucao':
                item['arquivos'] = lidos
            itens.append(item)

        return {'success': True, 'regras': itens, 'pasta_existe': True}

    def get_regras_abs_paths(self, project_name):
        """Todos os arquivos da base, para o checkbox do Contexto inicial.

        O `Índice.md` fica de fora de propósito: ele é um resumo do que já vai
        junto, e mandá-lo duplicaria nome e descrição de cada item. O histórico
        fica de fora pelo motivo dele (`PREFIXO_HISTORICO`).
        """
        base = self._regras_base(project_name)
        if not base:
            return {'success': True, 'paths': []}
        paths = []
        for _nome, pasta, arquivos in self._regras_itens_no_disco(base):
            paths += [os.path.join(pasta, f) for f in arquivos]
        return {'success': True, 'paths': paths}

    def get_regras_stats(self, project_name):
        """Tokens estimados, linhas e arquivos — regras E instruções.

        Contar só as regras faria o número mentir justamente onde o usuário
        olha para decidir se marca o checkbox: instrução é o que pesa.
        """
        from modulos.tokens import contar_tokens
        paths = self.get_regras_abs_paths(project_name).get('paths', [])
        total_tokens = 0
        total_lines = 0
        total_files = 0
        for caminho in paths:
            conteudo = self._ler_texto(caminho)
            if not conteudo:
                continue
            # tiktoken, não chars//4 — mesmo padrão de `get_agent_stats`.
            total_tokens += contar_tokens(conteudo)
            total_lines += conteudo.count('\n') + (0 if conteudo.endswith('\n') else 1)
            total_files += 1
        return {'success': True, 'tokens': total_tokens, 'lines': total_lines, 'files': total_files}

    def search_regras_content(self, project_name, query, max_results=20):
        """Busca literal, em todos os arquivos de cada item."""
        if not (query or '').strip():
            return {'success': True, 'results': []}
        q = query.lower()
        results = []
        for item in self.list_regras(project_name).get('regras', []):
            if item['tipo'] == 'regra':
                candidatos = [(item['name'], None, item['content'])]
            else:
                candidatos = [(item['name'], a['name'], a['content']) for a in item['arquivos']]
            for nome, arquivo, conteudo in candidatos:
                idx = conteudo.lower().find(q)
                if idx == -1:
                    continue
                inicio = max(0, idx - 80)
                fim = min(len(conteudo), idx + len(q) + 80)
                results.append({
                    'name': nome,
                    'tipo': item['tipo'],
                    'arquivo': arquivo,
                    'snippet': conteudo[inicio:fim].replace('\n', ' '),
                    'match_pos': idx,
                })
                if len(results) >= max_results:
                    return {'success': True, 'results': results}
        return {'success': True, 'results': results}

    # ------------------------------------------------------------------
    # As pastas do Acervo (genérico — substitui as fontes fixas de antes)
    # ------------------------------------------------------------------

