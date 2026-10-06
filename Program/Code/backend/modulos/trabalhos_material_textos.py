"""Os arquivos em Markdown que o programa escreve PARA O AGENTE ler.

`Equipe.md` (quem está aberto agora e quem é vizinho de quem), `Quadro.md` (as
atividades e o estado de cada uma) e `Notas/` (uma nota por nó).

⚠️ CADA ARQUIVO TEM EXATAMENTE UM ESCRITOR, e o gatilho de regeração é POR
ARQUIVO. Juntá-los num regerador único quebra em silêncio: as ações do Quadro
rodam no processo do **servidor MCP**, e o registro de terminais vivos é de
memória, do processo do **programa** — de lá, "quem está aberto" responde
"ninguém" para todo mundo. Um regerador único chamado do fim de cada transação
reescreveria o `Equipe.md` como vazio toda vez que um agente movesse um cartão.

    Quadro.md  → o fim de cada transação do estado (qualquer processo)
    Equipe.md  → abrir e fechar terminal (só o programa)
    Notas/     → a gravação da nota, e a abertura de um terminal

⚠️ O AGENTE NÃO ESCREVE NENHUM DESTES. Ele escreve em `Anotações/<nó>/`, e em
lugar nenhum mais — o Quadro já tem um caminho de escrita que resolve
concorrência (as oito ações de MCP, sob trava entre processos), e um segundo
caminho perderia escrita sem ninguém notar.
"""

from .constantes import *


# O cabeçalho que todo .md gerado carrega. Mora AQUI, e não em
# `trabalhos_material.py`, porque os três usos são deste arquivo: lá ela era
# invisível para cá — `_` não vem no `import *` — e as três chamadas estouravam
# `NameError`. Quem quiser o nome no módulo pai o reimporta daqui.
_AVISO_DE_GERADO = (
    '<!-- Escrito pelo programa. Não edite: a próxima geração sobrescreve.\n'
    '     Para registrar algo que o usuário deva ver, use `Anotações/`. -->'
)


class TrabalhosMaterialTextosMixin:

    # ── Obra 2 · Equipe.md ───────────────────────────────────────────────────

    def _mat_nome_de_arquivo(self, nome, reserva=''):
        """O nome da nota como nome de arquivo, mexendo o MENOS possível.

        Tira só o que o Windows recusa (`\\ / : * ? " < > |` e os caracteres de
        controle) e o espaço ou ponto do fim, que ele engole em silêncio.
        Acento, maiúscula e espaço no meio ficam — eles são o nome que o
        usuário escolheu.
        """
        limpo = ''.join(' ' if ord(c) < 32 else c
                        for c in (nome or '') if c not in '\\/:*?"<>|')
        limpo = ' '.join(limpo.split()).rstrip(' .')
        return limpo or (reserva or 'nota')

    def _mat_papel_rotulo(self, no):
        """O que se diz do papel de um nó no `Equipe.md`.

        ⚠️ NEM TODO NÓ COM AGENTE TEM PAPEL, e escrever "sem papel" para eles
        era enganoso: o `papel` só vem de cartão do Quadro, enquanto o nó
        criado pelo popover ＋Agente guarda o `.md` escolhido em `modo` e nasce
        com `papel = None` de propósito. Dizer "sem papel" ali escondia do
        vizinho justamente o que ele precisa saber para decidir o que pedir.
        """
        for p in PAPEIS_DE_TERMINAL:
            if p['id'] == no.get('papel'):
                return p['rotulo']
        modo = (no.get('modo') or '').strip()
        if modo:
            return 'agente `%s`' % modo.rsplit('/', 1)[-1]
        return None

    def _mat_vizinhos_abertos(self, project_name, andar, id_no):
        """Os vizinhos LIGADOS POR SETA a este nó que estão com terminal aberto.

        ⚠️ A SETA SIGNIFICA "VOCÊ PODE TRABALHAR COM ESTE", e quem decide o que
        isso quer dizer é o estado do vizinho. Aberto entra aqui, endereçável
        pelo nome da sessão. Fechado NÃO entra, e não é esquecimento: o produto
        já o oferece como ajudante interno a partir de `.claude/agents/`, e
        listá-lo aqui seria oferecer duas vezes a mesma coisa por dois caminhos
        que se comportam diferente.

        ⚠️ A LIGAÇÃO DE DEPENDÊNCIA FICA DE FORA. Ela é ordem de lançamento, do
        lado do programa, e não conversa entre agentes — pôr o vizinho de
        dependência aqui convidaria o agente a "adiantar" o que a dependência
        existe justamente para segurar.
        """
        vizinhos = []
        vistos = set()
        for l in andar.get('ligacoes') or []:
            if l.get('tipo') == 'dependencia':
                continue
            if l.get('de') == id_no:
                outro = l.get('para')
            elif l.get('para') == id_no:
                outro = l.get('de')
            else:
                continue
            if not outro or outro in vistos:
                continue
            vistos.add(outro)
            if not self._sh_vivo(project_name, outro):
                continue
            no = self._trab_achar_no(andar, outro)
            if no:
                vizinhos.append(no)
        return vizinhos

    def _mat_texto_da_equipe(self, project_name, andar):
        abertos = [n for n in (andar.get('nos') or [])
                   if self._sh_vivo(project_name, n.get('id'))]

        linhas = ['# Equipe — quem está aberto agora', '', _AVISO_DE_GERADO, '',
                  'Cada seção abaixo é um terminal ABERTO neste projeto. **Ache a',
                  'seção com o seu nome** — o seu prompt diz qual é — e fale só com',
                  'quem está listado nela.', '',
                  'Terminal fechado não aparece aqui de propósito: para esses, use o',
                  'mecanismo de subagente do próprio produto, que já lê',
                  '`.claude/agents/`.', '']

        if not abertos:
            linhas += ['---', '', '**Nenhum terminal aberto neste momento.**', '']
            return '\n'.join(linhas)

        for no in abertos:
            slug = self._sh_slug(no.get('nome'))
            papel = self._mat_papel_rotulo(no)
            linhas.append('---')
            linhas.append('')
            linhas.append(f'## {slug}')
            linhas.append('')
            linhas.append(f'- Nome na tela: **{no.get("nome") or slug}**')
            linhas.append(f'- Papel: **{papel or "sem papel"}**')
            vizinhos = self._mat_vizinhos_abertos(project_name, andar, no.get('id'))
            if not vizinhos:
                linhas.append('- Pode falar com: **ninguém** — este nó não tem seta '
                              'para nenhum terminal aberto.')
                linhas.append('')
                continue
            linhas.append('- Pode falar com:')
            linhas.append('')
            linhas.append('  | Sessão | Papel | Como chamar |')
            linhas.append('  |---|---|---|')
            for v in vizinhos:
                vslug = self._sh_slug(v.get('nome'))
                vpapel = self._mat_papel_rotulo(v) or '—'
                linhas.append(f'  | `{vslug}` | {vpapel} | mande uma mensagem '
                              f'para a sessão `{vslug}` |')
            linhas.append('')
        return '\n'.join(linhas)

    # ── Obra 5 · Quadro.md ───────────────────────────────────────────────────

    def _mat_texto_do_quadro(self, project_name):
        """O Quadro em Markdown, montado A PARTIR DO CATÁLOGO.

        ⚠️ NENHUM NOME DE COLUNA OU DE TAG ESCRITO À MÃO AQUI. As duas listas
        saem de `catalogo_trabalhos`, e a ordem das colunas é a ordem de lá —
        que é a mesma da tela. Escrever "Precisa de você" nesta função seria a
        cópia à mão contra a qual aquele arquivo inteiro foi criado para
        avisar, e o sintoma seria o de sempre: a tela renomeia a coluna, este
        arquivo não, e ninguém tem como notar.
        """
        try:
            estado = self._trab_carregar(project_name)
        except Exception:
            estado = {'atividades': []}
        atividades = estado.get('atividades') or []
        rotulo_da_tag = {t['id']: t['rotulo'] for t in TAGS_DAS_ATIVIDADES}

        linhas = ['# Quadro', '', _AVISO_DE_GERADO, '',
                  'Este arquivo é uma FOTOGRAFIA, só para leitura. Para mexer num',
                  'cartão, use as ações de Trabalhos do MCP — elas gravam sob trava e',
                  'são o único caminho que não se atropela com outro terminal.', '']

        if not atividades:
            linhas += ['**O Quadro está vazio.**', '']
            return '\n'.join(linhas)

        for coluna in COLUNAS_DO_QUADRO:
            desta = [a for a in atividades if a.get('coluna') == coluna['id']]
            linhas.append(f'## {coluna["rotulo"]} ({len(desta)})')
            linhas.append('')
            if not desta:
                linhas.append('_vazia_')
                linhas.append('')
                continue
            for a in desta:
                linhas.append(f'### {a.get("id")} · {a.get("titulo") or "sem título"}')
                linhas.append('')
                tags = [rotulo_da_tag.get(t, t) for t in (a.get('tags') or [])]
                if tags:
                    linhas.append('- Tags: ' + ', '.join(f'`{t}`' for t in tags))
                if a.get('pasta'):
                    linhas.append(f'- Pasta: `{a["pasta"]}`')
                if a.get('depende_de'):
                    linhas.append('- Depende de: ' + ', '.join(a['depende_de']))
                if a.get('arquivos'):
                    linhas.append('- Arquivos: ' + ', '.join(f'`{x}`' for x in a['arquivos']))
                if a.get('motivo_do_portao'):
                    linhas.append(f'- No portão porque: {a["motivo_do_portao"]}')
                if a.get('resumo'):
                    linhas.append('')
                    linhas.append(a['resumo'])
                tarefas = a.get('tarefas') or []
                if tarefas:
                    linhas.append('')
                    linhas.append('Tarefas:')
                    for t in tarefas:
                        # ⚠️ SÃO TRÊS ESTADOS, e não um booleano: `pendente`,
                        # `fazendo` e `feita` (ver `_trab_marcar_tarefa`).
                        # Espremer o `fazendo` numa caixinha vazia esconderia
                        # justamente a tarefa que alguém está tocando agora.
                        estado_da_tarefa = t.get('estado') or 'pendente'
                        marca = {'feita': '[x]', 'fazendo': '[~]'}.get(
                            estado_da_tarefa, '[ ]')
                        linhas.append(f'- {marca} {t.get("texto") or ""}')
                linhas.append('')
        return '\n'.join(linhas)

    # ── Obra 5 · Notas/ ──────────────────────────────────────────────────────

    def _mat_nomes_das_notas(self, andar):
        """O nome de arquivo de CADA nota do andar, por id de nó.

        ⚠️ UM CÁLCULO SÓ, e é por isso que ele mora aqui em vez de em quem
        chama: o desempate abaixo precisa ver TODAS as notas juntas. Quem
        recalculasse o nome de uma nota isolada acertaria o caso comum e citaria
        o arquivo errado exatamente no caso em que o usuário mais precisa de
        precisão.

        ⚠️ O ARQUIVO LEVA O NOME DA NOTA, e não um slug. Aqui se usava
        `_sh_slug`, e o resultado era `Nota 1` virar `nota-1.md`: o usuário
        renomeia a nota na tela e não reconhece o arquivo. O slug existe para
        outra coisa — virar NOME DE SESSÃO, onde espaço e acento atrapalham de
        verdade —, e emprestá-lo aqui trouxe junto uma feiura que não resolvia
        problema nenhum.

        O que se tira é só o que o Windows não aceita em nome de arquivo, mais
        espaço e ponto no fim (que ele engole em silêncio). Acento e maiúscula
        ficam.
        """
        nomes = {}
        vistos = set()
        for no in (andar.get('nos') or []):
            if no.get('tipo') != 'nota':
                continue
            nome = self._mat_nome_de_arquivo(no.get('nome'), no.get('id')) + '.md'
            # Duas notas que sanitizam para o mesmo nome se atropelariam. Os
            # nomes de nó já são únicos (`_trab_nome_unico`), mas a limpeza
            # acima pode juntar dois — e perder uma nota em silêncio seria pior
            # que um nome feio.
            if nome in vistos:
                nome = '%s (%s).md' % (nome[:-3], no.get('id', '')[-4:])
            vistos.add(nome)
            nomes[no.get('id')] = nome
        return nomes

    def _mat_gerar_notas(self, project_name, andar):
        """Uma nota do canvas vira um `.md` de mesmo número.

        ⚠️ A NOTA NÃO ESTÁ NO `Estado.json`. Ela é NÓ do canvas (`tipo` ==
        `'nota'`, texto no campo `texto`), e mora no `Layout.json` — quem for
        procurá-la entre as atividades não acha.
        """
        base = self._mat_caminho(project_name, PASTA_NOTAS_DOS_TRABALHOS)
        if not base:
            return
        try:
            os.makedirs(base, exist_ok=True)
        except Exception:
            return
        nomes = self._mat_nomes_das_notas(andar)
        vivos = set(nomes.values())
        for no in (andar.get('nos') or []):
            if no.get('tipo') != 'nota':
                continue
            nome = nomes[no.get('id')]
            titulo = no.get('nome') or 'Nota'
            self._mat_escrever(os.path.join(base, nome),
                               f'# {titulo}\n\n{_AVISO_DE_GERADO}\n\n'
                               f'{no.get("texto") or ""}\n')
        # Nota apagada no canvas não pode continuar aqui: um arquivo que
        # sobrevive ao que ele descreve é pior que arquivo nenhum — o agente lê
        # e age sobre algo que já não existe.
        try:
            for nome in os.listdir(base):
                if nome.endswith('.md') and nome not in vivos:
                    os.remove(os.path.join(base, nome))
        except Exception:
            pass
