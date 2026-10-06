import hashlib

from ...constantes import *
from modulos.agentes.llm_estruturado import (
    carregar_schema, chat_json, formato_garantido_indisponivel, json_da_resposta,
)
from modulos.tokens import contar_tokens, calcular_orcamento, PortaoDeContexto


from .resumo_pastas_estado import ResumoPastasEstadoMixin
from .resumo_pastas_agente import ResumoPastasAgenteMixin


# Este arquivo era 661 linhas e virou três, pelo teto de 500 da AMF:
#
#   resumo_pastas.py          quais pastas podem ser resumidas, e o status
#   resumo_pastas_estado.py   o hash por saída, os lotes e a limpeza
#   resumo_pastas_agente.py   a rotina rodando
#
# ⚠️ "PASTA COMPLETA" É A REGRA QUE MORA AQUI, e é ela que decide se a pasta
# entra no trabalho: pasta com Documentação Técnica faltando produziria um resumo
# que fala de metade do código como se fosse o todo, e ninguém, lendo, saberia
# que faltou. Arquivo DISPENSADO não conta como faltando — dispensar é uma
# decisão, não uma ausência.
class ResumoPastasMixin(ResumoPastasEstadoMixin, ResumoPastasAgenteMixin):

    # ── Agente: Resumo de Pastas ──────────────────────────────────────────────
    #
    # Fonte = Documentação Técnica (a ficha de cada arquivo). Artefato 100%
    # humano: serve para você abrir uma pasta e saber o que tem dentro dela, sem
    # ler o código.
    #
    # Duas garantias de custo:
    #  1. Incremental por hash: cada arquivo de saída guarda o md5 do conteúdo que
    #     o gerou (em _hashes.json). Rodar de novo sem mexer em nada não refaz nada.
    #  2. Pasta que não cabe numa chamada vira partes e costura (D20) — o
    #     resultado é sempre UM `.md` por pasta.

    def _rp_collect_items(self, rel_folder, estado, relacoes, partes=None):
        """As fichas dos arquivos que estão DIRETAMENTE em `rel_folder` (não
        desce em subpastas): `[(nome, ficha, tokens)]`, em ordem de nome.

        A ficha vem da Documentação Técnica (D26): Síntese, Atribuições, os
        símbolos com a linha e a frase, e "Usa" (as Conexões, feitas pelo
        programa). `estado` e `relacoes` chegam já carregados — quem chama os lê
        uma vez por passada, e não uma vez por pasta.

        `partes` diz o que entra ALÉM da Síntese, que vai sempre (D20, D24,
        D25): `{'atribuicoes', 'simbolos', 'frases', 'usa'}` → bool, lido de
        Configurações › «Partes e costura · Resumo de Pastas». A frase só entra
        com os símbolos. Sem `partes`, entra tudo — o comportamento de antes.
        """
        partes = partes or {'atribuicoes': True, 'simbolos': True,
                            'frases': True, 'usa': True}
        items = []
        for chave in sorted(estado):
            if '/' not in chave or chave.rsplit('/', 1)[0] != rel_folder:
                continue
            doc = estado.get(chave) or {}
            nome = chave.rsplit('/', 1)[1]
            linhas = ['--- %s ---' % nome,
                      'Síntese: %s' % (doc.get('sintese') or '').strip()]
            if partes.get('atribuicoes'):
                linhas.append('Atribuições: %s' % '; '.join(doc.get('atribuicoes') or []))
            simbolos = (doc.get('simbolos') or []) if partes.get('simbolos') else []
            if simbolos:
                linhas.append('Símbolos:')
                for sim in simbolos:
                    # Seletor de `.css` não tem frase (D25): a linha acaba no número.
                    # E sem «a frase de cada símbolo» marcada, nenhuma tem.
                    frase = ((sim.get('frase') or '').strip()
                             if partes.get('frases') else '')
                    linhas.append('- %s (%s) — linha %s%s' % (
                        sim.get('nome', ''), sim.get('tipo', ''), sim.get('linha', ''),
                        ' — ' + frase if frase else ''))
            usa = (relacoes.get(chave) or ([], []))[0] if partes.get('usa') else []
            if usa:
                linhas.append('Usa: %s' % ', '.join(usa))
            ficha = '\n'.join(linhas)
            items.append((nome, ficha, contar_tokens(ficha)))
        return items

    @staticmethod
    def _rp_rotulo_das_partes(partes):
        """As partes que a ficha leva, por extenso, para o bloco
        `[PARTES DA FICHA — n]` da mensagem: é por ele que o modelo sabe qual
        seção do resumo fica vazia (F36). Devolve `(quantidade, texto)`."""
        nomes = ['Síntese']
        if partes.get('atribuicoes'):
            nomes.append('Atribuições')
        if partes.get('simbolos'):
            nomes.append('Símbolos (nome, tipo e linha)')
            if partes.get('frases'):
                nomes.append('a frase de cada símbolo')
        if partes.get('usa'):
            nomes.append('Usa')
        return str(len(nomes)), ', '.join(nomes)

    # ── Pasta completa: a regra que decide se a pasta pode ser resumida ───────
    #
    # O Resumo lê a Documentação Técnica, nunca o código. Resumir uma pasta com
    # 3 de 8 arquivos documentados produzia um resumo incompleto marcado como sucesso — e,
    # pior, com o hash calculado sobre o texto parcial, o que congelava o erro:
    # ele nunca mais seria refeito.
    #
    # Regra: só processa a pasta quando TODOS os arquivos elegíveis dela já têm
    # Documentação Técnica. Elegível exclui extensão fora da configuração da
    # Documentação Técnica e arquivo que ela pulou por ser grande demais de verdade.
    #
    # ⛔ Sem botão de ignorar e sem dispensa automática: os erros da Documentação Técnica são
    # quase sempre transitórios (LM Studio caído, timeout). Mostrar o arquivo
    # culpado resolve o caso real; dispensar esconderia o problema para sempre.

    def _rp_doc_dispensados(self, project_name):
        """Arquivos que a Documentação Técnica pulou por serem grandes de verdade.

        Devolve {chave: motivo}, com a chave no mesmo formato do estado dela
        (`pasta-de-trabalho/caminho/relativo`). Esses NÃO travam a pasta — a
        documentação deles nunca vai existir, e esperar seria esperar para sempre.
        """
        caminho = obter_pasta_da_rotina(project_name, 'documentacao-tecnica', '_resumo.json')
        try:
            with open(caminho, 'r', encoding='utf-8') as f:
                resumo = json.load(f)
        except Exception:
            return {}
        return {i.get('file'): i.get('reason') for i in (resumo.get('skipped') or [])
                if i.get('file')}

    def _rp_doc_erros(self, project_name):
        """Arquivos em que a Documentação Técnica falhou → {chave: motivo}. Esses
        TRAVAM a pasta, e o motivo é justamente o que o card precisa mostrar."""
        caminho = obter_pasta_da_rotina(project_name, 'documentacao-tecnica', '_resumo.json')
        try:
            with open(caminho, 'r', encoding='utf-8') as f:
                resumo = json.load(f)
        except Exception:
            return {}
        return {i.get('file'): i.get('reason') for i in (resumo.get('errors') or [])
                if i.get('file')}

    def _rp_pastas_do_codigo(self, project_name):
        """Todas as pastas do CÓDIGO que deveriam ter resumo, e o que falta em
        cada uma.

        Enumera a partir das pastas de trabalho, não da árvore da Documentação
        Técnica: uma pasta sem nenhum arquivo documentado não aparece na árvore, e antes sumia num
        `skip` silencioso em vez de ser reportada como travada.

        Devolve {rel_folder: {'elegiveis': n, 'faltando': [{file, reason}]}}.
        """
        workspace = self.load_workspace(project_name)
        if not workspace.get('success'):
            return {}
        config = workspace['config']
        ignore_list = config.get('ignore_list', [])
        ext_set = self._ext_set_da_rotina(
            self.load_rotinas_config(project_name)['config']['doc-tecnica'].get('extensions'))

        doc_base = obter_pasta_da_rotina(project_name, 'documentacao-tecnica')
        dispensados = self._rp_doc_dispensados(project_name)
        erros = self._rp_doc_erros(project_name)
        # A ficha sai do ESTADO da Documentação Técnica, e não do `.md`: um
        # `.md` de antes da fusão (sem Síntese no estado) daria "nenhuma ficha
        # lida" com a pasta dita completa. Até a Documentação Técnica rodar de
        # novo nele, o arquivo trava a pasta, com o motivo.
        estado = self._dt_load_estado(project_name)

        pastas = {}
        for folder in config.get('working_folders', []):
            if not os.path.isdir(folder):
                continue
            folder_name = os.path.basename(folder.rstrip(os.sep)) or folder
            for root, dirs, fnames in os.walk(folder):
                if self._caminho_ignorado(root, ignore_list):
                    dirs.clear()
                    continue
                dirs[:] = [d for d in dirs
                           if not self._caminho_ignorado(os.path.join(root, d), ignore_list)]

                sub = os.path.relpath(root, folder).replace('\\', '/')
                rel_folder = folder_name if sub == '.' else f'{folder_name}/{sub}'

                elegiveis = 0
                faltando = []
                for fname in sorted(fnames):
                    fpath = os.path.join(root, fname)
                    if self._caminho_ignorado(fpath, ignore_list):
                        continue
                    if os.path.splitext(fname)[1].lower() not in ext_set:
                        continue
                    chave = f'{rel_folder}/{fname}'
                    if chave in dispensados:
                        # Grande demais de verdade: nunca vai ter documentação.
                        continue
                    elegiveis += 1
                    md_path = os.path.join(doc_base, *rel_folder.split('/'), fname + '.md')
                    if not os.path.isfile(md_path):
                        faltando.append({
                            'file': chave,
                            'path': fpath,
                            'reason': erros.get(chave) or 'documentação técnica ainda não gerada',
                        })
                    elif not (estado.get(chave) or {}).get('sintese'):
                        faltando.append({
                            'file': chave,
                            'path': fpath,
                            'reason': erros.get(chave) or ('documentação técnica no formato '
                                                           'antigo — rode a Documentação Técnica'),
                        })
                if elegiveis:
                    pastas[rel_folder] = {'elegiveis': elegiveis, 'faltando': faltando}
        return pastas


    def get_resumo_pastas_status(self, project_name):
        """Existe resumo gerado? É o que decide o selo do card entre 'Pronto' e
        'Concluído'.

        ⚠️ A busca é RECURSIVA. Ela já foi um `os.listdir` da raiz, e ficou
        errada quando as saídas passaram a espelhar a árvore do código: hoje a
        raiz de `resumo-pastas/` tem só a pasta `Program/` e os dois `.json`
        internos, nenhum `.md`. O card voltava para 'Pronto' a cada abertura,
        mesmo com as 40 pastas resumidas — e só mostrava 'Concluído' porque a
        execução manual escreve o selo direto, sem passar por aqui.

        Os erros vão junto. Eles já eram gravados no `_resumo.json`, mas este
        método os ignorava: a lista só chegava à tela pelo evento ao vivo do
        progresso, então fechar e reabrir o programa apagava da vista tudo o
        que tinha falhado — sem que nada tivesse sido consertado.
        """
        base = obter_pasta_da_rotina(project_name, 'resumo-pastas')
        erros, _ = self._erros_de_uma_rotina(project_name, 'resumo-pastas')
        if not os.path.isdir(base):
            return {'success': True, 'exists': False, 'errors': erros}
        for _, _, fnames in os.walk(base):
            if any(f.endswith('.md') for f in fnames):
                return {'success': True, 'exists': True, 'errors': erros}
        return {'success': True, 'exists': False, 'errors': erros}
