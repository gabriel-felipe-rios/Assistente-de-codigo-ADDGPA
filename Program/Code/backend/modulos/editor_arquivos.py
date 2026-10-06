"""As operações de disco do menu de contexto da aba Editor.

⚠️ TODA validação de caminho passa por `_ed_absoluto` (`editor_arvore.py`), que
recusa caminho absoluto vindo da tela e qualquer `..` que saia da pasta raiz. É
a mesma porta que a leitura e a gravação usam, e não há uma segunda: um caminho
montado à mão aqui seria o furo por onde o programa criaria ou apagaria coisa
fora do projeto.

⚠️ O NOME que a tela manda é tratado como hostil. `_ed_nome_valido` recusa
separador de caminho, os caracteres que o Windows proíbe e os nomes reservados
do DOS (`CON`, `PRN`, `LPT1`…), que existem em toda pasta e não dão erro de
"nome inválido" — dão comportamento estranho.

⚠️ Excluir vai para a **Lixeira** (`lixeira.py`) e não tem plano B com
`os.remove`. A tela promete Lixeira; se o Windows recusar, a resposta é o erro.
"""

import os
import shutil
import subprocess

from .caminhos import *
from . import lixeira


# Os caracteres que o Windows proíbe em nome de arquivo, mais os separadores.
_ED_PROIBIDOS = '<>:"/\\|?*'

# Nomes de dispositivo do DOS. Continuam reservados em qualquer pasta do
# Windows, com ou sem extensão — `CON.txt` também.
_ED_RESERVADOS = {
    'CON', 'PRN', 'AUX', 'NUL',
    *(f'COM{i}' for i in range(1, 10)),
    *(f'LPT{i}' for i in range(1, 10)),
}


class EditorArquivosMixin:
    """Criar, renomear, excluir, copiar e revelar — pela aba Editor."""

    # ── Validação do nome ────────────────────────────────────────────────────

    @staticmethod
    def _ed_nome_valido(nome):
        """(ok, motivo). O motivo vai direto para a tela, então é em português."""
        n = (nome or '').strip()
        if not n:
            return False, 'O nome não pode ficar em branco.'
        if any(c in n for c in _ED_PROIBIDOS):
            return False, f'O nome não pode ter nenhum destes: {_ED_PROIBIDOS}'
        if n in ('.', '..'):
            return False, 'Esse nome é reservado pelo sistema.'
        if n.split('.')[0].upper() in _ED_RESERVADOS:
            return False, f'"{n.split(".")[0]}" é um nome reservado pelo Windows.'
        # O Windows corta espaço e ponto do fim do nome em silêncio, e aí o
        # arquivo criado tem outro nome que o pedido. Melhor recusar.
        if n[-1] in (' ', '.'):
            return False, 'O nome não pode terminar com espaço nem com ponto.'
        return True, ''

    # ── Criar ────────────────────────────────────────────────────────────────

    def _ed_criar(self, project_name, caminho_da_pasta, nome, pasta):
        raiz = self._ed_raiz(project_name)
        ok, motivo = self._ed_nome_valido(nome)
        if not ok:
            return {'success': False, 'error': motivo}
        destino_pai = self._ed_absoluto(raiz, caminho_da_pasta or '')
        if not os.path.isdir(destino_pai):
            return {'success': False, 'error': 'Essa pasta não existe mais.'}
        alvo = os.path.join(destino_pai, nome.strip())
        # ⚠️ Confere de novo DEPOIS de juntar: o nome já foi validado, mas é o
        # resultado final que precisa estar dentro da raiz.
        self._ed_absoluto(raiz, self._ed_relativo(raiz, alvo))
        if os.path.exists(alvo):
            return {'success': False, 'error': 'Já existe algo com esse nome aqui.'}
        try:
            if pasta:
                os.makedirs(alvo)
            else:
                # 'x' falha se alguém criou o arquivo entre o `exists` acima e
                # esta linha — nunca sobrescreve.
                with open(alvo, 'x', encoding='utf-8'):
                    pass
        except OSError as e:
            return {'success': False, 'error': str(e)}
        self.editor_esquecer_contagens(project_name, None)
        return {'success': True, 'caminho': self._ed_relativo(raiz, alvo)}

    def editor_criar_arquivo(self, project_name, caminho_da_pasta, nome):
        try:
            return self._ed_criar(project_name, caminho_da_pasta, nome, False)
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def editor_criar_pasta(self, project_name, caminho_da_pasta, nome):
        try:
            return self._ed_criar(project_name, caminho_da_pasta, nome, True)
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Renomear ─────────────────────────────────────────────────────────────

    def editor_renomear(self, project_name, caminho_relativo, novo_nome):
        try:
            raiz = self._ed_raiz(project_name)
            alvo = self._ed_absoluto(raiz, caminho_relativo)
            if alvo == raiz:
                return {'success': False, 'error': 'A pasta raiz do projeto não se renomeia por aqui.'}
            if not os.path.exists(alvo):
                return {'success': False, 'error': 'Esse caminho não existe mais.'}
            ok, motivo = self._ed_nome_valido(novo_nome)
            if not ok:
                return {'success': False, 'error': motivo}
            destino = os.path.join(os.path.dirname(alvo), novo_nome.strip())
            if destino == alvo:
                return {'success': True, 'caminho': self._ed_relativo(raiz, alvo)}
            # ⚠️ TROCAR SÓ A CAIXA É UM RENOMEAR DE VERDADE, e quase virou um
            # no-op silencioso aqui. `os.path.exists` é insensível a caixa no
            # Windows: `api.py` → `Api.py` cairia no "já existe" abaixo, contra
            # o próprio arquivo. Comparar por `normcase` e sair mais cedo
            # resolveria isso e criaria coisa pior — reportar sucesso sem ter
            # renomeado nada. O certo é reconhecer o caso e deixar passar: o
            # `os.rename` do Windows aceita a troca de caixa no mesmo volume.
            so_a_caixa = os.path.normcase(destino) == os.path.normcase(alvo)
            if not so_a_caixa and os.path.exists(destino):
                return {'success': False, 'error': 'Já existe algo com esse nome aqui.'}
            os.rename(alvo, destino)
            return {'success': True, 'caminho': self._ed_relativo(raiz, destino)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Excluir ──────────────────────────────────────────────────────────────

    def editor_pode_reciclar(self, project_name, caminho_relativo):
        """A tela pergunta ANTES de confirmar, para o aviso não mentir.

        Unidade de rede e removível não têm Lixeira: lá o Windows apaga direto.
        Prometer "vai para a Lixeira" nesse caso é o pior tipo de erro de aviso.
        """
        try:
            raiz = self._ed_raiz(project_name)
            alvo = self._ed_absoluto(raiz, caminho_relativo)
            return {'success': True, 'recicla': not lixeira.unidade_sem_lixeira(alvo)}
        except Exception as e:
            return {'success': False, 'error': str(e), 'recicla': False}

    def editor_excluir(self, project_name, caminho_relativo):
        try:
            raiz = self._ed_raiz(project_name)
            alvo = self._ed_absoluto(raiz, caminho_relativo)
            if alvo == raiz:
                return {'success': False, 'error': 'A pasta raiz do projeto não se exclui por aqui.'}
            ok, erro = lixeira.mandar_para_a_lixeira(alvo)
            if not ok:
                return {'success': False, 'error': erro}
            self.editor_esquecer_contagens(project_name, None)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Copiar e colar ───────────────────────────────────────────────────────

    @staticmethod
    def _ed_nome_sem_conflito(destino_pai, nome_base):
        """Nome repetido ganha ` (2)`, ` (3)`… como o Explorador faz —
        sobrescrever em silêncio numa operação de menu/arraste é perda de
        trabalho sem aviso. Compartilhado por `editor_colar` (Recortar/Copiar
        de dentro do projeto) e `editor_importar_arquivo_externo` (arrastar de
        fora — Obra 7.2), pra não ter a mesma régua em dois lugares."""
        nome, ext = os.path.splitext(nome_base)
        destino = os.path.join(destino_pai, nome_base)
        n = 2
        while os.path.exists(destino):
            destino = os.path.join(destino_pai, f'{nome} ({n}){ext}')
            n += 1
        return destino

    def editor_colar(self, project_name, caminho_origem, caminho_da_pasta, mover=False):
        """Copia (ou move) um caminho para dentro de uma pasta, sem sobrescrever."""
        try:
            raiz = self._ed_raiz(project_name)
            origem = self._ed_absoluto(raiz, caminho_origem)
            destino_pai = self._ed_absoluto(raiz, caminho_da_pasta or '')
            if not os.path.exists(origem):
                return {'success': False, 'error': 'A origem não existe mais.'}
            if not os.path.isdir(destino_pai):
                return {'success': False, 'error': 'O destino não é uma pasta.'}
            # Colar uma pasta dentro dela mesma faria uma cópia infinita.
            if os.path.isdir(origem) and (destino_pai == origem
                                          or destino_pai.startswith(origem + os.sep)):
                return {'success': False, 'error': 'Não dá para colar uma pasta dentro dela mesma.'}

            destino = self._ed_nome_sem_conflito(destino_pai, os.path.basename(origem))

            if mover:
                shutil.move(origem, destino)
            elif os.path.isdir(origem):
                shutil.copytree(origem, destino)
            else:
                shutil.copy2(origem, destino)
            self.editor_esquecer_contagens(project_name, None)
            return {'success': True, 'caminho': self._ed_relativo(raiz, destino)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def editor_importar_arquivo_externo(self, project_name, caminho_absoluto_externo,
                                        pasta_destino_relativa):
        """Arrastar arquivo/pasta de FORA do programa e soltar na árvore
        (Obra 7.2) — SEMPRE copia, nunca move. A origem fica fora do projeto e
        de fora da jurisdição deste endpoint; só `editor_colar` (que opera
        DENTRO do projeto) tem permissão para mover.
        """
        try:
            raiz = self._ed_raiz(project_name)
            origem = os.path.normpath(caminho_absoluto_externo)
            if not os.path.exists(origem):
                return {'success': False, 'error': 'A origem não existe mais.'}
            destino_pai = self._ed_absoluto(raiz, pasta_destino_relativa or '')
            if not os.path.isdir(destino_pai):
                return {'success': False, 'error': 'O destino não é uma pasta.'}

            destino = self._ed_nome_sem_conflito(destino_pai, os.path.basename(origem))
            if os.path.isdir(origem):
                shutil.copytree(origem, destino)
            else:
                shutil.copy2(origem, destino)
            self.editor_esquecer_contagens(project_name, None)
            return {'success': True, 'caminho': self._ed_relativo(raiz, destino)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Abrir fora do programa ───────────────────────────────────────────────

    def editor_caminho_absoluto(self, project_name, caminho_relativo):
        """Para o "Copiar caminho" — a cópia em si é do frontend."""
        try:
            raiz = self._ed_raiz(project_name)
            return {'success': True,
                    'caminho': self._ed_absoluto(raiz, caminho_relativo)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def editor_revelar(self, project_name, caminho_relativo):
        """Abre o Explorador com o item já selecionado.

        `explorer /select,` no molde de `aparencia_acoes.py:65`. Sem `shell=True`
        e com o caminho normalizado: o `/select` só entende `\\`, e com `/` ele
        abre a pasta Documentos sem dizer nada.

        ⚠️ O `explorer.exe` devolve código 1 mesmo quando dá certo. Por isso
        `Popen` e não `run(check=True)` — conferir o retorno reportaria erro em
        toda chamada bem-sucedida.
        """
        try:
            raiz = self._ed_raiz(project_name)
            alvo = self._ed_absoluto(raiz, caminho_relativo)
            if not os.path.exists(alvo):
                return {'success': False, 'error': 'Esse caminho não existe mais.'}
            subprocess.Popen(['explorer', '/select,', os.path.normpath(alvo)], shell=False)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def editor_abrir_com_o_programa_padrao(self, project_name, caminho_relativo):
        """`os.startfile` — o mesmo duplo clique do Explorador."""
        try:
            raiz = self._ed_raiz(project_name)
            alvo = self._ed_absoluto(raiz, caminho_relativo)
            if not os.path.exists(alvo):
                return {'success': False, 'error': 'Esse caminho não existe mais.'}
            os.startfile(alvo)  # noqa: S606 — é a intenção: abrir no programa do usuário
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}
