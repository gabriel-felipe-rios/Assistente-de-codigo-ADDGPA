"""O Verificador: o segundo freio da Fila, e o único que olha o CONTEÚDO.

São dois freios, e é de propósito que sejam dois — o Contador de rodadas impede
rodar para sempre, o Verificador impede entregar errado. Arquivo próprio porque
ele é um agente com prompt, ferramentas e veredito próprios: quem vem investigar
"por que este relatório foi devolvido" não precisa atravessar o laço do núcleo
para chegar até aqui.

⚠️ O LASTRO É A REGRA CENTRAL DESTE ARQUIVO. O Verificador só pode alegar
"trecho não encontrado" se de fato tiver rodado um grep — mesma regra que já
vale para existência de arquivo, onde o LLM nunca é a fonte de um fato
verificável.

⚠️ E O LASTRO É DO TERMO, não da ferramenta. Guardar apenas "houve algum grep"
não resolve: no caso real o Verificador fez greps de OUTROS termos, e qualquer
um deles liberaria todos os itens. O termo já vinha no mesmo evento e era
descartado — ver `termos_grepados`, montado pelo `log_cb` do núcleo.

⚠️ A CAMADA 1 É DETERMINÍSTICA e roda ANTES do modelo. O que dá para conferir
lendo o disco não se pergunta a um LLM: ele erra, e erra com confiança.
"""

from .execucao_constantes import *
from .execucao_constantes import _VERIFICADOR


class FilaExecucaoVerificacaoMixin:

    # ── O Verificador ─────────────────────────────────────────────────────────

    def _fila_verificar(self, project_name, tarefa, relatorio, model, log_cb, cfg,
                        ferramentas_usadas, termos_grepados):
        """Confere o relatório em duas camadas, nesta ordem.

        Camada 1 é determinística e roda primeiro: se um arquivo citado não
        existe no índice, reprova sem gastar chamada de LLM nenhuma. Camada 2
        é o subagente Verificador, que julga o resto com três ferramentas de
        conferir.

        Retorna {'aprovado', 'motivo', 'sub_tags', 'problemas', 'conferidos',
        'indisponivel'}.
        """
        ok1, problemas1, conferidos1 = self._fila_verificacao_camada1(
            project_name, relatorio, log_cb)
        if not ok1:
            motivo = '; '.join(f'item {n}: {texto}' for n, texto in problemas1)
            log_cb({'agente': 'verificador-camada1', 'evento': 'reprovado', 'motivo': motivo})
            return {'aprovado': False, 'motivo': motivo,
                    'sub_tags': ['arquivo_inexistente'],
                    'problemas': [{'item': n, 'tipo': 'arquivo_inexistente', 'detalhe': texto}
                                  for n, texto in problemas1],
                    'conferidos': conferidos1, 'indisponivel': False}

        # Os dois zeram antes de cada verificação: grep de uma devolução
        # anterior não deve contar como lastro na seguinte.
        ferramentas_usadas.clear()
        termos_grepados.clear()
        resultado = self.executar_subagente(
            project_name, _VERIFICADOR,
            self._fila_pergunta_verificador(tarefa, relatorio, conferidos1),
            model, log_cb, cfg['max_tokens'],
            origem='Fila', rotulo='TAREFA E RELATÓRIO A CONFERIR')

        if resultado.get('erro') or not resultado.get('resposta'):
            return {'aprovado': False, 'motivo': resultado.get('erro') or 'sem resposta',
                    'sub_tags': [], 'problemas': [], 'conferidos': conferidos1,
                    'indisponivel': True}

        obj, _err = extrair_json_com_chave(resultado['resposta'], 'aprovado')
        if obj is None:
            # Prosa em vez de veredito. Não conta devolução: o defeito é do
            # Verificador, e o relatório do agente pode estar perfeito.
            return {'aprovado': False, 'motivo': 'o Verificador não devolveu um veredito legível',
                    'sub_tags': [], 'problemas': [], 'conferidos': conferidos1,
                    'indisponivel': True}

        veredito, err = validar_veredito(obj, FILA_SUBTAGS_RESSALVA_DO_LLM)
        if err:
            return {'aprovado': False, 'motivo': err, 'sub_tags': [], 'problemas': [],
                    'conferidos': conferidos1, 'indisponivel': True}

        # Lastro: alegar que um trecho não existe exige ter feito um grep. Sem
        # ele, a alegação continua valendo como desconfiança — vira "sem
        # lastro", que é exatamente o que ela é.
        problemas = []
        for p in veredito['problemas']:
            tipo = p['tipo']
            if tipo == 'trecho_nao_encontrado' and 'grep' not in ferramentas_usadas:
                tipo = 'sem_lastro'
            problemas.append({**p, 'tipo': tipo})

        conferidos = self._fila_conferidos_com_lastro(
            relatorio, sorted(set(conferidos1) | set(veredito['conferidos'])),
            termos_grepados)
        return {'aprovado': veredito['aprovado'], 'motivo': veredito['motivo'],
                'sub_tags': sorted({p['tipo'] for p in problemas}),
                'problemas': problemas, 'conferidos': conferidos, 'indisponivel': False}

    # ⚠️ DELIBERADAMENTE ESTREITO. Casar caminho de arquivo (`settings.json`,
    # `Program/Code/…`) ou palavra comum obrigaria o Verificador a gastar rodada
    # com grep inútil, e o preço de deixar passar um item que devia ser
    # conferido é menor que o de queimar o orçamento dele. Por isso ficaram de
    # fora o snake_case e o CamelCase soltos: `chat_mensagem` e `Program` moram
    # dentro de caminhos, e casariam sempre.
    #
    # Sobram três formas em que "isto é código" é o que o texto diz:
    #   1. nome entre crases          -> `MAX_PARALELO`
    #   2. nome seguido de parênteses -> initFilaTab(
    #   3. CONSTANTE_EM_CAIXA_ALTA    -> PADROES_MAXIMO
    # A terceira é a forma exata do caso real: o relatório mandou usar
    # `PADROES_MAXIMO`, que não existe em lugar nenhum, e o Verificador marcou o
    # item como conferido sem ter feito o grep.
    _RE_IDENT_CITADO = re.compile(
        r'`([A-Za-z_][A-Za-z0-9_]*)`'
        r'|\b([A-Za-z_][A-Za-z0-9_]*)\('
        r'|\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\b'
    )

    def _fila_conferidos_com_lastro(self, relatorio, conferidos, termos_grepados):
        """Tira de `conferidos` o item de ARQUIVO que cita um identificador sem
        que o Verificador tenha feito grep dele nesta execução.

        O programa já desconfiava dele quando REPROVAVA sem prova (a regra do
        `sem_lastro`, logo acima). Passa a desconfiar também quando APROVA sem
        prova, que é o lado que faltava e o que aconteceu de verdade.

        ⚠️ Só itens de `arquivo`. Item de `restricao` cita fonte de base
        normativa, não identificador, e exigir grep dele seria sempre inútil. O
        tipo vem pronto de `_fila_itens_numerados`, na mesma numeração que o
        Verificador cita — nada é reclassificado aqui.
        """
        if not conferidos:
            return conferidos
        itens = {n: (tipo, alvo, texto, extra) for n, (tipo, alvo, texto, extra)
                 in enumerate(self._fila_itens_numerados(relatorio), 1)}
        com_lastro = []
        for n in conferidos:
            item = itens.get(n)
            if not item or item[0] != 'arquivo':
                com_lastro.append(n)
                continue
            citados = set()
            for grupo in self._RE_IDENT_CITADO.findall(' '.join(item[2:])):
                citados.update(g for g in grupo if g)
            # Nenhum identificador citado: não há o que exigir. Na dúvida, o
            # item FICA — a regra só tira o que ela consegue provar sem lastro.
            if not citados:
                com_lastro.append(n)
                continue
            if any(self._fila_termo_foi_grepado(ident, termos_grepados)
                   for ident in citados):
                com_lastro.append(n)
        return com_lastro

    @staticmethod
    def _fila_termo_foi_grepado(identificador, termos_grepados):
        """Se algum grep desta execução cobre este identificador.

        Tolerante a caixa porque o `grep` da ferramenta já é. Vale nos dois
        sentidos: buscar `def montar_relatorio` cobre `montar_relatorio`, e
        buscar `montar_relatorio` cobre a citação. O piso de 4 caracteres no
        segundo sentido evita que um grep curto ("api") libere tudo.
        """
        alvo = identificador.lower()
        return any(alvo in t or (len(t) >= 4 and t in alvo)
                   for t in termos_grepados)

    def _fila_itens_numerados(self, relatorio):
        """Os itens do relatório numerados de 1 a N: primeiro os arquivos, depois
        as restrições. É essa numeração que o Verificador cita e que a ressalva
        no topo do relatório reaproveita."""
        itens = []
        for a in relatorio.get('arquivos') or []:
            alvo = a['arquivo'] + (f':{a["linha"]}' if a.get('linha') else '')
            itens.append(('arquivo', alvo, a.get('mudanca') or '', a.get('evidencia') or ''))
        for r in relatorio.get('restricoes') or []:
            itens.append(('restricao', r.get('decisao') or '', r.get('implicacao') or '',
                          r.get('fonte') or ''))
        return itens

    def _fila_verificacao_camada1(self, project_name, relatorio, log_cb=None):
        """Confere no índice se cada arquivo citado pelo relatório existe de fato
        — a mesma fonte de verdade que os subagentes já leem, sem reabrir
        arquivo nenhum. Reprova sem gastar chamada de LLM se algo não bater.

        A conferência passa pelo resolvedor de chave do índice, e não por uma
        comparação de string: o índice indexa por `{pasta de trabalho}/{relativo}`
        e as ferramentas devolvem caminho relativo à raiz. Comparar cru faria
        todo arquivo parecer inexistente sempre que a pasta de trabalho não
        fosse a própria raiz — a pior falha possível aqui, porque o resultado
        é plausível.

        Retorna (ok, [(numero, texto)], [numeros_conferidos]).
        """
        arquivos = relatorio.get('arquivos') or []
        if not arquivos:
            return False, [(1, 'o relatório não apontou nenhum arquivo a mexer')], []

        # ⚠️ O índice é feito de CÓDIGO — as chaves saem de `dados['nomes']`, ou
        # seja, só arquivos com identificador indexado. Um `.md`, um `.json` ou
        # um `.txt` citado no relatório NUNCA está lá, e era reprovado como
        # inexistente a cada devolução, sem gastar LLM e sem chance nenhuma de o
        # modelo consertar — não havia o que consertar. O teste é pela extensão
        # que o índice de fato cobre, e não por uma lista fixa de extensões, que
        # envelheceria calada.
        try:
            extensoes_cobertas = {os.path.splitext(k)[1].lower()
                                  for k in self._sub_chaves_do_indice(project_name)}
        except Exception:
            extensoes_cobertas = set()

        problemas, conferidos = [], []
        for n, item in enumerate(arquivos, 1):
            caminho = (item.get('arquivo') or '').strip()
            if not caminho:
                problemas.append((n, 'não informou "arquivo"'))
                continue
            if extensoes_cobertas:
                ext = os.path.splitext(caminho)[1].lower()
                if ext not in extensoes_cobertas:
                    # Fora do alcance do índice: não é conferido nem reprovado.
                    # A camada 2, que abre arquivo de verdade, julga se quiser.
                    continue
            try:
                self._sub_resolver_chave_identificadores(project_name, caminho)
                conferidos.append(n)
            except ValueError as e:
                mensagem = str(e)
                if 'não gerado' in mensagem:
                    # Sem índice não dá para conferir nada. Isso não é defeito
                    # do relatório: passa para a camada 2 sem marcar item.
                    return True, [], []
                # ⚠️ A mensagem VERDADEIRA era jogada fora e trocada por "não
                # existe no índice". Um relatório que cita `fila.js` — que
                # existe, em mais de uma pasta — era reprovado por
                # INEXISTÊNCIA: uma devolução queimada com um motivo falso, que
                # o modelo não tinha como atender, porque o arquivo está lá.
                # As duas mensagens acionáveis do resolvedor passam inteiras; a
                # de "não está no índice" traz um catálogo de até 60 caminhos no
                # fim, e esse não vai para dentro da devolução.
                if ('mais de um arquivo do índice' in mensagem
                        or 'Arquivos com esse nome' in mensagem):
                    problemas.append((n, mensagem))
                else:
                    problemas.append((n, f'arquivo citado não existe no índice: "{caminho}"'))
            except Exception as e:
                # Engolir aqui APROVAVA em silêncio e ainda descartava os
                # problemas já encontrados nos itens anteriores. O que foi
                # achado até aqui vale; o item que estourou fica sem conferir, e
                # o motivo vai para o Log em vez de sumir.
                if log_cb:
                    log_cb({'agente': 'verificador-camada1',
                            'mensagem': f'não deu para conferir o item {n} '
                                        f'("{caminho}"): {e}'})
                continue

        return (not problemas), problemas, conferidos

    def _fila_pergunta_verificador(self, tarefa, relatorio, conferidos):
        linhas = [f'TAREFA: {tarefa["texto"]}', '']
        if relatorio.get('resumo'):
            linhas += [f'RESUMO DO RELATÓRIO: {relatorio["resumo"]}', '']
        linhas.append('ITENS DO RELATÓRIO:')
        for n, (tipo, alvo, texto, extra) in enumerate(self._fila_itens_numerados(relatorio), 1):
            if tipo == 'arquivo':
                linhas.append(f'{n}. [arquivo] {alvo} — {texto}')
                if extra:
                    linhas.append(f'   evidência alegada: {extra}')
            else:
                linhas.append(f'{n}. [restrição] {alvo} — {texto}')
                if extra:
                    linhas.append(f'   fonte alegada: {extra}')
        if relatorio.get('observacoes'):
            linhas += ['', f'OBSERVAÇÕES: {relatorio["observacoes"]}']
        linhas += ['', 'JÁ CONFERIDO PELO PROGRAMA, SEM IA:']
        if conferidos:
            nums = ', '.join(str(n) for n in conferidos)
            linhas.append(f'os arquivos dos itens {nums} existem no índice do projeto. '
                          'Não reconfira isso, e não contradiga este resultado.')
        else:
            linhas.append('nada — o índice do projeto não estava disponível. '
                          'Ainda assim, existência de arquivo não é assunto seu.')
        return '\n'.join(linhas)
