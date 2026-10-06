"""O Histórico local do Editor — o que estava no arquivo antes do último save.

É o espelho do "Local History" do VS Code, e existe porque o Ctrl+S grava por
cima sem criar Versão nos Backups (decisão do usuário). A divisão de trabalho é
a mesma do VS Code, e as duas metades não se confundem:

  Ctrl+Z  → pilha do navegador, em memória, por arquivo aberto. Sobrevive ao
            salvar, morre ao fechar o arquivo. Não passa por aqui.
  aqui    → uma cópia em disco do conteúdo ANTERIOR, a cada gravação. Sobrevive
            a fechar o programa.

⚠️ ISTO NÃO É BACKUP, E NÃO PODE VIRAR. `versoes.py::guardar` grava em
`Files/backups/{Projeto}/arquivos/{aa}/{hash}` — o armazém das Versões. Uma
cópia do Editor lá dentro seria indistinguível do conteúdo de uma Versão, seria
varrida por quem limpa aquele armazém, e faria o Editor virar produtor da aba
Backups. Daqui só se usa `versoes.hash_do_conteudo`, que o próprio arquivo
declara ser fonte única de md5.

O endereçamento por conteúdo das Versões também é a forma ERRADA aqui: o valor
do histórico local é **ordinal** ("o que estava antes do último save"), não
deduplicado. Duas entradas idênticas em momentos diferentes são dois fatos.

⚠️ A pasta é PLANA — `Histórico local/{md5[:12]}/`, não a árvore do usuário
espelhada. O motivo está em `caminhos.py`, na seção Aba Editor: espelhar seria
o terceiro caminho longo do projeto, e os dois que já existem estão a 8
caracteres do MAX_PATH.
"""

import hashlib
import json
import os
import shutil
import time
from datetime import datetime, timedelta

from .caminhos import *


# ⚠️ A CONFIGURAÇÃO MORA NO `settings.json` GLOBAL, não mais num arquivo por
# projeto. Ela nasceu em `Editor/Configuração.json` e mudou em 30/08/2026, por
# decisão do usuário: a categoria Editor de Configurações precisava de um
# "Salvar" só e de um "Restaurar padrão" que enxergasse tudo, e gravar em dois
# lugares confundia mais do que a flexibilidade por projeto valia.
#
# O `Editor/Configuração.json` antigo deixou de ser lido. Não há migração: ele
# nunca chegou a ser preenchido em uso real, e ler um arquivo órfão "por via das
# dúvidas" é como duas fontes de verdade voltam.
#
# Os valores de fábrica estão em `padroes_de_fabrica.py::PADROES_DO_EDITOR`, e
# chegam aqui por `load_settings()`, que já devolve `{**defaults, **gravado}` —
# então toda chave existe e nenhum `.get` com padrão é preciso.
_ED_HIST_CHAVES = {
    'ligado':                 'editor_hist_ligado',
    'entradas_por_arquivo':   'editor_hist_entradas',
    'dias_de_retencao':       'editor_hist_dias',
    'tamanho_maximo_mb':      'editor_hist_mb',
    'guardar_apenas_se_mudou': 'editor_hist_so_se_mudou',
}


class EditorHistoricoMixin:
    """Guardar, listar, pré-visualizar e podar o Histórico local."""

    # ── Configuração ─────────────────────────────────────────────────────────

    def _ed_hist_config(self):
        """As cinco chaves do Histórico, traduzidas do settings global.

        Não é rota: quem configura é a categoria Editor de Configurações, pelo
        `save_settings_parcial` que todas as outras categorias já usam. Uma
        rota própria aqui seria um segundo caminho de gravação para a mesma
        chave.
        """
        try:
            s = self.load_settings().get('settings') or {}
        except Exception:
            s = {}
        return {nosso: s.get(chave) for nosso, chave in _ED_HIST_CHAVES.items()}

    # ── O índice ─────────────────────────────────────────────────────────────

    @staticmethod
    def _ed_hist_id(caminho_relativo):
        """12 dígitos do md5 do caminho — o nome da subpasta daquele arquivo."""
        return hashlib.md5((caminho_relativo or '').encode('utf-8')).hexdigest()[:12]

    def _ed_hist_indice(self, project_name):
        try:
            caminho = obter_arquivo_de_indice_do_historico_local(project_name)
            if os.path.isfile(caminho):
                with open(caminho, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception:
            pass
        return {}

    def _ed_hist_gravar_indice(self, project_name, indice):
        caminho = obter_arquivo_de_indice_do_historico_local(project_name)
        os.makedirs(os.path.dirname(caminho), exist_ok=True)
        with open(caminho, 'w', encoding='utf-8') as f:
            json.dump(indice, f, ensure_ascii=False, indent=2)

    # ── Guardar ──────────────────────────────────────────────────────────────

    def _ed_guardar_no_historico(self, project_name, caminho_relativo, absoluto):
        """Copia o conteúdo ATUAL do disco para o histórico, antes de sobrescrever.

        Chamado por `editor_gravar_arquivo`, e nunca falha para fora: histórico
        que não pôde ser escrito não é motivo para o usuário perder o Ctrl+S.
        """
        try:
            config = self._ed_hist_config()
            if not config.get('ligado', True):
                return
            from . import versoes
            atual = versoes.hash_do_conteudo(absoluto)
            indice = self._ed_hist_indice(project_name)
            registro = indice.get(caminho_relativo) or {
                'id': self._ed_hist_id(caminho_relativo), 'entradas': []}
            entradas = registro['entradas']

            if config.get('guardar_apenas_se_mudou', True) and entradas:
                if entradas[-1].get('hash') == atual:
                    return

            pasta = obter_pasta_de_historico_local(project_name, registro['id'])
            os.makedirs(pasta, exist_ok=True)
            # ISO com `-` no lugar de `:` (proibido em nome de arquivo no
            # Windows) e milissegundo, para dois saves no mesmo segundo não
            # colidirem. A extensão original fica: é ela que permite
            # pré-visualizar a entrada colorida pelo mesmo caminho do Prism.
            carimbo = datetime.now().strftime('%Y-%m-%dT%H-%M-%S-') + f'{int(time.time() * 1000) % 1000:03d}'
            nome = carimbo + os.path.splitext(caminho_relativo)[1]
            shutil.copy2(absoluto, os.path.join(pasta, nome))

            entradas.append({'arquivo': nome, 'quando': datetime.now().isoformat(timespec='seconds'),
                             'bytes': os.path.getsize(absoluto), 'hash': atual})
            registro['entradas'] = entradas
            indice[caminho_relativo] = registro
            self._ed_hist_podar(project_name, indice, config)
            self._ed_hist_gravar_indice(project_name, indice)
        except Exception:
            pass

    # ── Podar ────────────────────────────────────────────────────────────────

    def _ed_hist_podar(self, project_name, indice, config):
        """As três políticas, nesta ordem: por arquivo, por prazo, por tamanho.

        Por arquivo e por prazo primeiro porque são baratas e localizadas; o
        teto de tamanho é global e só faz sentido sobre o que sobrou das duas.
        """
        teto = int(config.get('entradas_por_arquivo') or 0)
        dias = int(config.get('dias_de_retencao') or 0)
        limite_data = (datetime.now() - timedelta(days=dias)).isoformat() if dias > 0 else None

        for rel, registro in list(indice.items()):
            entradas = registro.get('entradas') or []
            if limite_data:
                entradas = [e for e in entradas if e.get('quando', '') >= limite_data]
            if teto > 0 and len(entradas) > teto:
                entradas = entradas[-teto:]
            self._ed_hist_apagar_sobras(project_name, registro, entradas)
            registro['entradas'] = entradas
            if not entradas:
                indice.pop(rel, None)

        mb = int(config.get('tamanho_maximo_mb') or 0)
        if mb > 0:
            self._ed_hist_podar_por_tamanho(project_name, indice, mb * 1024 * 1024)

    def _ed_hist_apagar_sobras(self, project_name, registro, ficam):
        """Some do disco o que saiu do índice — senão a pasta cresce para sempre."""
        nomes = {e['arquivo'] for e in ficam}
        pasta = obter_pasta_de_historico_local(project_name, registro['id'])
        for e in registro.get('entradas') or []:
            if e['arquivo'] in nomes:
                continue
            try:
                os.remove(os.path.join(pasta, e['arquivo']))
            except OSError:
                pass

    def _ed_hist_podar_por_tamanho(self, project_name, indice, teto_bytes):
        """Apaga as mais antigas de TODOS os arquivos até caber no teto."""
        todas = [(e.get('quando', ''), rel, e)
                 for rel, r in indice.items() for e in (r.get('entradas') or [])]
        total = sum(e.get('bytes', 0) for _, _, e in todas)
        if total <= teto_bytes:
            return
        for _, rel, entrada in sorted(todas):
            if total <= teto_bytes:
                break
            registro = indice.get(rel)
            if not registro:
                continue
            try:
                os.remove(os.path.join(
                    obter_pasta_de_historico_local(project_name, registro['id']),
                    entrada['arquivo']))
            except OSError:
                pass
            registro['entradas'] = [e for e in registro['entradas']
                                    if e['arquivo'] != entrada['arquivo']]
            total -= entrada.get('bytes', 0)
            if not registro['entradas']:
                indice.pop(rel, None)

    # ── Ler de volta ─────────────────────────────────────────────────────────

    def editor_listar_historico(self, project_name, caminho_relativo):
        """As entradas de um arquivo, da mais nova para a mais velha."""
        try:
            registro = self._ed_hist_indice(project_name).get(caminho_relativo)
            entradas = list(reversed((registro or {}).get('entradas') or []))
            return {'success': True, 'entradas': entradas}
        except Exception as e:
            return {'success': False, 'error': str(e), 'entradas': []}

    def editor_ler_entrada_do_historico(self, project_name, caminho_relativo, arquivo):
        """O conteúdo de uma entrada, para pré-visualizar antes de restaurar."""
        try:
            registro = self._ed_hist_indice(project_name).get(caminho_relativo)
            if not registro:
                return {'success': False, 'error': 'Esse arquivo não tem histórico.'}
            # `basename` porque `arquivo` vem da tela: sem ele, um `..` no nome
            # leria qualquer coisa do disco.
            alvo = os.path.join(obter_pasta_de_historico_local(project_name, registro['id']),
                                os.path.basename(arquivo))
            if not os.path.isfile(alvo):
                return {'success': False, 'error': 'Essa entrada não existe mais.'}
            with open(alvo, 'rb') as f:
                cru = f.read()
            return {'success': True, 'conteudo': cru.decode('utf-8', errors='replace')}
        except Exception as e:
            return {'success': False, 'error': str(e)}
