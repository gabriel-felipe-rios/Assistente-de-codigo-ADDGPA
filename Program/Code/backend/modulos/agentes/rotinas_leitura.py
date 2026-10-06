"""O que as rotinas perguntam antes de ler um arquivo: esta extensão é lida?
este caminho está ignorado? o usuário descreveu este item de contexto? Morava
no Espelho, que saiu (D33).
"""

from ..constantes import *
from ..ignorados import LEITOR_LM_STUDIO, pode_ler


class RotinasLeituraMixin:

    def _ext_set_da_rotina(self, extensions):
        if not extensions:
            # Sem lista de quem chama, a lista das rotinas — a mesma de
            # Configurações › Arquivos que o programa lê › Quem lê o quê.
            from .rotinas_config import lista_das_rotinas
            extensions = lista_das_rotinas()
        return set(e.lower() if e.startswith('.') else '.' + e.lower() for e in extensions)

    # A regra em si mora em `modulos/ignorados.py` — este método continua
    # existindo porque é chamado por vários módulos como método do mixin
    # (documentacao_tecnica, arquivos_grandes, detector_vigia, as rotinas de
    # indexação). Aqui só delega, para não haver duas cópias da regra.
    # ⚠️ Estes três são FUNIS: ninguém chama `esta_ignorado` / `esta_em_contexto`
    # direto, tudo passa por aqui. É o que fez o marcador "quem pode ler" chegar
    # aos módulos consumidores (Doc Técnica, Resumo de Pastas, Hashes,
    # Identificadores, Comentários, Bibliotecas, Arquivos grandes, Detector) sem
    # editar nenhum deles.
    #
    # ⚠️ O `quem` PADRÃO é o LM Studio, e não `None`: quem passa por estes funis
    # produz os artefatos que alimentam o chat interno. O servidor MCP tem os
    # funis dele (`_sub_*`, em `ferramentas_subagentes.py`) e pede `externo`.
    #
    # ⚠️ "Nunca ler" (global, `fora_do_programa`) vale aqui também desde
    # 23/09/2026, e vem ANTES e SEM `quem`: ele não tem exceção de "quem pode
    # ler" — é "isto não é projeto", não "não leia". Os funis `_sub_*` do MCP
    # não passam por aqui e não mudaram.
    def _caminho_ignorado(self, path, ignore_list, quem=LEITOR_LM_STUDIO):
        from ..ignorados import esta_ignorado, fora_do_programa
        return fora_do_programa(path) or esta_ignorado(path, ignore_list, quem)

    def _build_context_descs(self, context_items, quem=LEITOR_LM_STUDIO):
        """Monta dict path→descrição a partir dos itens de contexto sem leitura.

        Item que `quem` PODE ler fica de fora do dicionário de propósito: para
        esse leitor ele não é "contexto sem leitura", é arquivo normal — e quem
        consulta este dicionário usa a presença da chave como o próprio sinal de
        "não abra este, use a descrição".
        """
        return {
            item['path']: item.get('description', '').strip()
            for item in context_items
            if item.get('description', '').strip() and not pode_ler(item, quem)
        }

    def _get_ctx_desc(self, fpath, context_descs):
        """Retorna a descrição de contexto para fpath (match exato ou pasta-pai)."""
        if fpath in context_descs:
            return context_descs[fpath]
        for ctx_path, desc in context_descs.items():
            if fpath.startswith(ctx_path + os.sep):
                return desc
        return None
