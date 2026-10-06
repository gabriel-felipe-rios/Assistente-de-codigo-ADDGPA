from ...constantes import *
from ...extensoes import eventos as xt_eventos
from .estado import (FILA_STATUS_FALHOU, FILA_STATUS_PRONTO, FILA_STATUS_PRONTO_COM_RESSALVA,
                     FILA_SUBTAGS_RESSALVA)

# Os desfechos que contam como "a tarefa terminou" para as extensões (D46). ⚠️
# `precisa_de_voce` fica FORA: ali a tarefa parou para perguntar, e continua.
_FILA_STATUS_FIM = (FILA_STATUS_PRONTO, FILA_STATUS_PRONTO_COM_RESSALVA, FILA_STATUS_FALHOU)

# Rótulo de cada ressalva no bloco de aviso do relatório. O id é o que fica
# gravado no estado; este texto é o que a pessoa lê.
_RESSALVA_ROTULO = {
    'arquivo_inexistente': 'arquivo inexistente',
    'trecho_nao_encontrado': 'trecho não encontrado',
    'contraria_decisao': 'contraria uma decisão',
    'sem_lastro': 'sem lastro',
    'pesquisa_incompleta': 'pesquisa incompleta',
    'subagente_indisponivel': 'subagente indisponível',
}

# Ressalvas que não apontam para um item específico do relatório: são sobre a
# pesquisa inteira, então entram como linha solta no bloco de aviso.
_RESSALVA_GERAL = {
    'pesquisa_incompleta': ('a pesquisa bateu o teto de rodadas antes de o agente se '
                            'dar por satisfeito — o relatório saiu com o que havia até ali'),
    'subagente_indisponivel': ('algum subagente falhou durante a pesquisa e o que ele '
                               'saberia não entrou no relatório'),
}


class FilaRelatorioMixin:
    """Montagem do relatório final em Markdown e notificações/log para a UI."""

    # ── Relatório final (Markdown) ───────────────────────────────────────────

    def _fila_arquivos_em_comum(self, project_name, tarefa_id, arquivos_tocados):
        if not arquivos_tocados:
            return {}
        state = self._fila_load_state(project_name)
        resultado = {}
        for t in state.get('tarefas', []):
            if t['id'] == tarefa_id:
                continue
            for arq in t.get('arquivos_tocados') or []:
                if arq in arquivos_tocados:
                    resultado.setdefault(arq, []).append(t['texto'][:40])
        return resultado

    def _fila_bloco_ressalvas(self, relatorio, sub_tags, veredito, devolucoes):
        """O aviso que abre o relatório quando ele saiu sem aprovação.

        Vem ANTES do conteúdo, e diz qual item foi afetado e por quê — um aviso
        genérico de "pode ter erros" não ajuda ninguém a decidir em que confiar.
        Também lista o que passou: saber que os itens 1, 2 e 3 foram conferidos
        é metade da informação.
        """
        if not sub_tags:
            return []

        veredito = veredito or {}
        problemas = veredito.get('problemas') or []
        conferidos = veredito.get('conferidos') or []

        # ⚠️ `veredito['aprovado']` PRIMEIRO. O bloco olhava só `sub_tags` e
        # `devolucoes`, e nunca o veredito — que está aqui, como parâmetro.
        # Como `ressalvas` acumula também tags do PROGRAMA
        # (`pesquisa_incompleta`, `subagente_indisponivel`), um relatório
        # aprovado pelo Verificador abria dizendo que ele "não chegou a
        # aprovar". A ressalva é verdadeira; o cabeçalho é que mentia sobre a
        # origem dela.
        #
        # ⛔ Só o cabeçalho muda. O status da tarefa e os cards ficam como estão:
        # uma tarefa com ressalva continua `pronto_com_ressalva`, porque a
        # ressalva existe de verdade — ela só não veio de uma reprovação.
        if veredito.get('aprovado'):
            if devolucoes:
                cabecalho = (f'⚠ APROVADO COM RESSALVA — o Verificador aprovou depois '
                             f'de reprovar {devolucoes} vez(es).')
            else:
                cabecalho = '⚠ APROVADO COM RESSALVA — o Verificador aprovou.'
        elif devolucoes:
            cabecalho = (f'⚠ ENTREGUE SEM APROVAÇÃO — o Verificador reprovou '
                         f'{devolucoes} vez(es).')
        else:
            cabecalho = '⚠ ENTREGUE COM RESSALVA — o Verificador não chegou a aprovar.'

        linhas = ['```', cabecalho, '']

        itens = self._fila_itens_numerados(relatorio)
        for p in problemas:
            rotulo = _RESSALVA_ROTULO.get(p['tipo'], p['tipo'])
            n = p.get('item')
            alvo = ''
            if isinstance(n, int) and 1 <= n <= len(itens):
                alvo = f' ({itens[n - 1][1]})'
            detalhe = p.get('detalhe') or ''
            linhas.append(f'Item {n}{alvo} — {rotulo}' + (f': {detalhe}' if detalhe else ''))

        for tag in sub_tags:
            if tag in _RESSALVA_GERAL:
                linhas.append(f'{_RESSALVA_ROTULO[tag].capitalize()}: {_RESSALVA_GERAL[tag]}.')

        if conferidos:
            nums = ', '.join(str(n) for n in conferidos)
            linhas.append('')
            if len(conferidos) == 1:
                linhas.append(f'Item {nums}: conferido.')
            else:
                ultimo = nums.rsplit(', ', 1)
                linhas.append(f'Itens {" e ".join(ultimo)}: conferidos.')

        linhas += ['```', '']
        return linhas

    def _fila_montar_relatorio_md(self, project_name, tarefa, relatorio, sub_tags,
                                  veredito, devolucoes, arquivos_tocados):
        """Monta o .md final a partir do JSON estruturado do agente.

        A tabela de arquivo × mudança sai sempre daqui, do JSON, e nunca da
        prosa do modelo: um caminho alucinado no meio de um parágrafo se
        disfarça de linha de tabela, e essa é a categoria de erro mais cara
        neste programa.
        """
        agora = datetime.now().strftime('%Y-%m-%d %H:%M')

        def _fmt(agent_id):
            t = self._ac_get_resumo_time(project_name, agent_id)
            return t.strftime('%d/%m %H:%M') if t else 'não gerado'

        fontes = (f'índice de navegação de {_fmt("indice-navegacao")} · '
                  f'pipeline de {_fmt("pipeline")} · '
                  f'resumo de pastas de {_fmt("resumo-pastas")}')

        linhas = [f'## Tarefa: {tarefa["texto"]}', '']
        linhas += self._fila_bloco_ressalvas(relatorio, sub_tags, veredito, devolucoes)
        linhas += [
            '> ⚠️ Este relatório é uma sugestão estruturada gerada por um modelo local.',
            '> Pode conter erros — verifique antes de executar.',
            '',
            f'**Gerado em:** {agora}',
            f'**Baseado em:** {fontes}',
            '',
        ]

        if relatorio.get('resumo'):
            linhas += ['### Resumo', relatorio['resumo'], '']

        linhas.append('### Arquivos a mexer')
        arquivos = relatorio.get('arquivos') or []
        if arquivos:
            linhas.append('| Arquivo | Linha | O que muda |')
            linhas.append('|---------|-------|------------|')
            for a in arquivos:
                linhas.append(f'| {a.get("arquivo","")} | {a.get("linha","")} | {a.get("mudanca","")} |')
        else:
            linhas.append('(nenhum arquivo apontado)')

        linhas += ['', '### O que o projeto já decidiu']
        restricoes = relatorio.get('restricoes') or []
        if restricoes:
            for r in restricoes:
                fonte = f' (`{r["fonte"]}`)' if r.get('fonte') else ''
                linhas.append(f'- **{r.get("decisao","")}**{fonte} — {r.get("implicacao","")}')
        else:
            linhas.append('(nenhuma decisão do projeto restringe esta tarefa)')

        outras = self._fila_arquivos_em_comum(project_name, tarefa['id'], arquivos_tocados)
        if outras:
            linhas += ['', '### Arquivos em comum com outras tarefas da fila']
            linhas += [f'- `{arq}` — também tocado por: {", ".join(nomes)}'
                       for arq, nomes in outras.items()]

        linhas += ['', '### Observações']
        linhas.append(relatorio.get('observacoes') or 'Nenhuma observação adicional.')

        return '\n'.join(linhas) + '\n'

    # ── Notificações / log para a UI ─────────────────────────────────────────

    def _fila_notify_tarefa(self, project_name, tarefa):
        """Empurra uma tarefa para a tela.

        ⚠️ `project_name` é OBRIGATÓRIO, e é o conserto: a notificação não dizia
        de que projeto era, e o `filaTarefaAtualizada` do outro lado dava
        `push` na tarefa que não achava na lista. A tarefa do projeto A
        aparecia na lista do projeto B, `_filaRodando` virava verdadeiro lá, e o
        "Iniciar tarefas" de B sumia. Posicional obrigatório de propósito:
        chamada esquecida estoura na hora, em vez de mandar tarefa sem dono.
        """
        try:
            self.window.evaluate_js(
                f'filaTarefaAtualizada({json.dumps(tarefa)}, {json.dumps(project_name)})')
        except Exception:
            pass

    def _fila_notify_sinal(self, project_name, tarefa_id, evento):
        """Empurra um SINAL AO VIVO para a conversa da Fila.

        Não é log e não é estado: é o que a tela precisa saber ENQUANTO a rodada
        acontece. A Fila roda o mesmo `_executar_chamadas_subagentes` do Chat, e
        rodava sem as duas linhas que o cercam lá — durante uma rodada de
        subagentes, que numa pesquisa longa leva minutos, a conversa não mudava.

        ⚠️ O projeto e a tarefa viajam JUNTO, e a tela confere os dois antes de
        pintar. A Fila roda em thread: sem isso, o empurrão de uma tarefa de
        outro projeto (ou de outra tarefa do mesmo) pintaria na conversa errada.
        É o mesmo cuidado que o despachante do Chat documenta.

        ⛔ O texto do agente principal NÃO passa por aqui. Streaming dele é
        mudança de arquitetura e ficou fora de propósito.
        """
        try:
            self.window.evaluate_js(
                'filaSinalAoVivo(%s, %s, %s)' % (json.dumps(project_name),
                                                 json.dumps(tarefa_id),
                                                 json.dumps(evento)))
        except Exception:
            # Sinal é enfeite: se a tela não estiver lá para receber, a pesquisa
            # continua. O que não pode é a pesquisa morrer por causa dele.
            pass

    def _fila_marcar_falha(self, project_name, tarefa_id, sub_tag, mensagem,
                           rodadas=None, devolucoes=None, ressalvas=None, voltas=None):
        """Marca a tarefa como falhada.

        `rodadas` e `devolucoes` são opcionais para as chamadas que não têm
        contador em mãos. Quando vêm, são gravados: uma rodada que rodou de
        verdade e foi paga não pode sumir da conta só porque a passada acabou
        em erro.

        `ressalvas` são as marcas de pesquisa acumuladas até a queda. Elas
        ficam junto da sub-tag da falha porque a passada NÃO terminou: quando
        você complementa, a conversa inteira volta e é a mesma passada — as
        marcas continuam valendo.
        """
        with self._fila_transacao(project_name) as state:
            tarefa = self._fila_find_tarefa(state, tarefa_id)
            if not tarefa:
                return
            de_pesquisa = sorted((set(ressalvas or []) & set(FILA_SUBTAGS_RESSALVA))
                                 - {sub_tag})
            tarefa['status'] = FILA_STATUS_FALHOU
            tarefa['sub_tags'] = [sub_tag] + de_pesquisa
            tarefa['erro'] = mensagem
            if rodadas is not None:
                tarefa['rodadas_usadas'] = rodadas
            if devolucoes is not None:
                tarefa['devolucoes'] = devolucoes
            if voltas is not None:
                tarefa['voltas_usadas'] = voltas
            tarefa['concluido_em'] = datetime.now().isoformat()
            tarefa = dict(tarefa)
        self._fila_notify_tarefa(project_name, tarefa)
        self._fila_avisar_extensoes(project_name, tarefa)

    def _fila_marcar_status(self, project_name, tarefa_id, status, **extra):
        with self._fila_transacao(project_name) as state:
            tarefa = self._fila_find_tarefa(state, tarefa_id)
            if not tarefa:
                return
            tarefa['status'] = status
            tarefa['concluido_em'] = datetime.now().isoformat()
            tarefa.update(extra)
            tarefa = dict(tarefa)
        self._fila_notify_tarefa(project_name, tarefa)
        self._fila_avisar_extensoes(project_name, tarefa)

    def _fila_avisar_extensoes(self, project_name, tarefa):
        """Reação (D46): `fila.tarefa_terminou`, só nos três desfechos de fim.

        ⚠️ FORA DA TRANSAÇÃO E DEPOIS DO AVISO À TELA, sempre: `emitir` espera
        até 2 s pelos observadores, e segurar o estado da Fila (ou a tela) por
        causa de uma extensão lenta seria cobrar de todo mundo o preço dela.
        `tarefa` chega como CÓPIA (`dict(tarefa)`), feita dentro do `with` —
        a extensão nunca recebe o dicionário vivo do estado.
        """
        if tarefa.get('status') not in _FILA_STATUS_FIM:
            return
        xt_eventos.emitir('fila.tarefa_terminou', {
            'projeto': project_name, 'id': tarefa.get('id'),
            'status': tarefa.get('status'), 'erro': tarefa.get('erro'),
            'relatorio': tarefa.get('relatorio_path')})

    # O que NUNCA entra no estado.json. `contexto` e `mensagens` são a janela
    # inteira de um turno; `parametros` e `resultado` são o corpo de uma chamada
    # de ferramenta. Os dois primeiros ficam no histórico da tarefa (sub-aba
    # Contexto); os dois últimos, no .jsonl de log (sub-aba Log).
    _FILA_LOG_PESADO = ('contexto', 'mensagens')
    _FILA_LOG_PESADO_FERRAMENTA = ('parametros', 'resultado')

    @staticmethod
    def _fila_evento_leve(evento):
        """O evento sem os campos gordos — é esta versão que vai ao estado."""
        fora = set(FilaRelatorioMixin._FILA_LOG_PESADO)
        if evento.get('agente') == 'ferramenta':
            fora |= set(FilaRelatorioMixin._FILA_LOG_PESADO_FERRAMENTA)
        return {k: v for k, v in evento.items() if k not in fora}

    def _fila_log_evento(self, project_name, tarefa_id, evento):
        """Grava um evento do log e avisa a tela.

        Uma lista só, `log.eventos`, na ordem em que aconteceram. Antes eram
        três coleções — `agentes` indexado por agente, `timeline` e
        `ferramentas` — e a sub-aba Log tinha de remontar a cronologia entre
        elas. Pior: os dez subagentes caíam todos na chave `'subagente'`, e o
        nome real de quem falou se perdia ali. Era por isso que o Log da Fila
        mostrava dez linhas escritas "subagente", todas da mesma cor.
        """
        leve = self._fila_evento_leve(evento)

        # O corpo da chamada de ferramenta vai para o arquivo próprio, fora da
        # transação: é append de uma linha, não depende do estado e é o evento
        # mais frequente que existe aqui.
        if evento.get('agente') == 'ferramenta':
            self._fila_anexar_log_ferramenta(project_name, tarefa_id, evento)

        # Sob transação: este é o gravador mais frequente do estado, e é ele
        # que atropelava a tarefa que você acabou de criar na outra thread.
        with self._fila_transacao(project_name) as state:
            tarefa = self._fila_find_tarefa(state, tarefa_id)
            if not tarefa:
                return
            log = tarefa.setdefault('log', {'eventos': []})
            log.setdefault('eventos', []).append(leve)
        try:
            self.window.evaluate_js(
                f'filaLogAtualizado({json.dumps(tarefa_id)}, {json.dumps(evento)})')
        except Exception:
            pass
