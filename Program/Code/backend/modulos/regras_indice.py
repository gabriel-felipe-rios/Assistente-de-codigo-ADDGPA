"""O índice das regras, e a escrita de um item estruturado.

⚠️ O ÍNDICE EXISTE PARA O ASSISTENTE EXTERNO, que não roda o programa e só sabe
ler arquivo. A API a monta na hora com `montar_indice_regras`; o arquivo
gerado por `gerar_indice_regras` é a versão que fica no disco para quem não tem
como perguntar.

⚠️ O TIPO DE UM ITEM É A FORMA, e não um metadado. Cada item é uma pasta com o
nome dele; um `.md` só é regra, o principal mais apoio (`Como aplicar.md`) é
instrução. Um `_meta.json` paralelo ao conteúdo é exatamente o que
dessincroniza na primeira edição — o mesmo motivo que o tirou das regras.

⚠️ O FORMATO DO ÍNDICE É O DA SKILL `regras-e-instrucoes`, palavra por
palavra: a skill regenera o mesmo arquivo do lado do assistente externo, e dois
geradores com texto diferente fariam o índice oscilar a cada gravação.

⚠️ O ÍNDICE É REGERADO A CADA ESCRITA. Um índice desatualizado é pior que índice
nenhum: ele aponta o assistente para uma regra que já não existe, e ele obedece.
"""

from .constantes import *
# Os nomes de arquivo da base — ver o aviso no topo de `regras_formato.py`.
from .regras_formato import *  # noqa: F401,F403


class RegrasIndiceMixin:

    # Índice
    # ------------------------------------------------------------------

    def montar_indice_regras(self, project_name):
        """Índice compacto das regras e instruções — aberto a plugin pela API.

        Nunca inclui o corpo. Veio do Interceptador, que montava exatamente
        esta lista para decidir sozinho o que injetar.
        """
        itens = self.list_regras(project_name).get('regras', [])
        regras = [i for i in itens if i['tipo'] == 'regra']
        instrucoes = [i for i in itens if i['tipo'] == 'instrucao']
        if not regras and not instrucoes:
            return ''
        linhas = []
        if regras:
            linhas.append('Regras (valem sempre):')
            for item in regras:
                quando = item['quando'] or item['descricao']
                linhas.append(f'- {item["name"]}' + (f' — {quando}' if quando else ''))
        if instrucoes:
            if linhas:
                linhas.append('')
            linhas.append('Instruções (valem na hora certa):')
            for item in instrucoes:
                quando = item['quando'] or item['descricao']
                arquivos = ' · '.join(a['name'] for a in item.get('arquivos') or [])
                linha = f'- {item["name"]}' + (f' — {quando}' if quando else '')
                if arquivos:
                    linha += f'\n  arquivos: {arquivos}'
                linhas.append(linha)
        return '\n'.join(linhas)

    def gerar_indice_regras(self, project_name):
        """Reescreve o `Índice.md` inteiro. Chamado em TODA escrita.

        Ele existe principalmente para o assistente externo, que não roda o
        programa e só sabe ler arquivo — o chat monta a lista na hora. Por isso
        é regenerado por quem escreve: índice errado é pior que índice nenhum,
        porque o assistente confia nele e não abre o arquivo certo.
        """
        base = self._regras_base(project_name)
        if not base:
            return {'success': False, 'error': 'pasta raiz do projeto não configurada'}
        itens = self.list_regras(project_name).get('regras', [])
        regras = [i for i in itens if i['tipo'] == 'regra']
        instrucoes = [i for i in itens if i['tipo'] == 'instrucao']

        linhas = [
            '# Regras e instruções deste projeto',
            '',
            '> Gerado automaticamente. Não edite à mão — a skill regenera este arquivo a cada gravação.',
            '',
            '## Regras',
            'Valem sempre. São curtas: leia todas antes de escrever código.',
            '',
        ]
        if regras:
            for item in regras:
                quando = item['quando'] or item['descricao']
                linhas.append(f'- **{item["name"]}**' + (f' — {quando}' if quando else ''))
        else:
            linhas.append('*Nenhuma regra cadastrada.*')

        linhas += [
            '',
            '## Instruções',
            'Valem na hora certa. Leia o principal primeiro; abra `Como aplicar.md` quando for construir.',
            '',
        ]
        if instrucoes:
            for item in instrucoes:
                quando = item['quando'] or item['descricao']
                linhas.append(f'- **{item["name"]}**' + (f' — {quando}' if quando else ''))
                arquivos = ' · '.join(f'`{a["name"]}`' for a in item.get('arquivos') or [])
                if arquivos:
                    linhas.append(f'  · {arquivos}')
        else:
            linhas.append('*Nenhuma instrução cadastrada.*')

        os.makedirs(base, exist_ok=True)
        with open(os.path.join(base, ARQUIVO_INDICE), 'w', encoding='utf-8') as f:
            f.write('\n'.join(linhas) + '\n')
        return {'success': True}

    # ------------------------------------------------------------------
    # Escrita
    # ------------------------------------------------------------------

    def save_regra(self, project_name, name, content, tipo='regra', arquivo=None):
        """Grava um arquivo de um item — o principal, ou um apoio (`arquivo`).

        `tipo` ficou na assinatura pela ponte do pywebview, mas não decide nada:
        o tipo é a forma da pasta. Gravar só o principal dá uma regra; gravar
        também um `Como aplicar.md` faz da mesma pasta uma instrução.
        """
        base = self._regras_base(project_name, criar=True, obrigatorio=False)
        if not base:
            return {'success': False, 'error': 'pasta raiz do projeto não configurada — configure na aba Trabalho'}
        if not (name or '').strip():
            return {'success': False, 'error': 'nome vazio'}
        name = name.strip()

        pasta = os.path.join(base, name)
        os.makedirs(pasta, exist_ok=True)
        nome_arquivo = (arquivo or '').strip() or self._regras_nome_principal(name)
        if not nome_arquivo.endswith('.md'):
            nome_arquivo += '.md'
        caminho = os.path.join(pasta, nome_arquivo)

        with open(caminho, 'w', encoding='utf-8') as f:
            f.write(content or '')
        self.gerar_indice_regras(project_name)
        return {'success': True}

    def deletar_regra(self, project_name, name, tipo='regra', arquivo=None):
        """Remove um item inteiro, ou um arquivo de apoio dele (`arquivo`)."""
        base = self._regras_base(project_name)
        if not base:
            return {'success': False, 'error': 'pasta raiz do projeto não configurada'}

        pasta = os.path.join(base, name)
        if arquivo:
            if arquivo == self._regras_nome_principal(name):
                return {'success': False, 'error': f'o {arquivo} é o principal — remova o item inteiro'}
            caminho = os.path.join(pasta, arquivo)
            if os.path.isfile(caminho):
                os.remove(caminho)
        elif os.path.isdir(pasta):
            shutil.rmtree(pasta, ignore_errors=True)

        self.gerar_indice_regras(project_name)
        return {'success': True}
