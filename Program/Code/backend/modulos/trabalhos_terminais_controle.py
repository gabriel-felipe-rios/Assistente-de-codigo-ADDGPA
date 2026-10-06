"""Mandar entrada para um processo vivo, e pará-lo.

⚠️ PARAR MATA A ÁRVORE, sempre — nunca só o processo. Ver o aviso do
`taskkill /F /T` em `trabalhos_terminais_rodar.py`: o órfão segura o cano, e o
programa fica esperando um EOF que não vem.

⚠️ `parar_tudo` DEVOLVE QUANTOS PAROU. A tela precisa do número: "parado" sem
quantidade não distingue "não havia nada rodando" de "não consegui parar".
"""

from .trabalhos_terminais_constantes import *


class TrabalhosTerminaisControleMixin:

    # ── Entrada num processo vivo ────────────────────────────────────────────

    def enviar_entrada(self, project_name, id_no, texto):
        """Escreve no stdin de um processo que já está rodando.

        ⚠️ NÃO É O CAMINHO PRINCIPAL, e o cabeçalho deste módulo explica por
        quê: um pipe não é um TTY, e um programa que bufferiza em bloco fora de
        um terminal não responde — medido, não suposto. Existe porque um CLI
        que dê flush funciona perfeitamente assim, e porque responder a um
        prompt de confirmação no meio de uma execução é exatamente o caso em
        que o modo tiro só não serve.
        """
        try:
            proc = self._ofi_procs_dict().get(self._ofi_chave(project_name, id_no))
            if not proc or proc.poll() is not None:
                return {'success': False,
                        'error': 'Não há processo rodando neste terminal. Use o campo de '
                                 'mensagem para começar uma execução nova.'}
            if not proc.stdin or proc.stdin.closed:
                return {'success': False, 'error': 'A entrada deste processo já foi fechada.'}
            proc.stdin.write((texto or '') + '\n')
            proc.stdin.flush()
            self._ofi_registrar_linha(project_name, id_no, 'ent', f'> {texto}')
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Parar ────────────────────────────────────────────────────────────────

    def parar_terminal(self, project_name, id_no):
        """Mata a ÁRVORE do processo. Seguro de chamar com nada rodando.

        Para um nó que está só AGUARDANDO dependência, parar é descartar a
        mensagem guardada: sem isto, "Parar" num nó em espera não faria nada
        visível, e ele dispararia sozinho depois — que é o oposto do que o
        botão promete.
        """
        cancelada = self.cancelar_espera(project_name, id_no).get('cancelada')
        proc = self._ofi_procs_dict().get(self._ofi_chave(project_name, id_no))
        if not proc or proc.poll() is not None:
            return {'success': True, 'rodando': False, 'espera_cancelada': bool(cancelada)}
        try:
            subprocess.run(['taskkill', '/F', '/T', '/PID', str(proc.pid)],
                           capture_output=True, timeout=10)
        except Exception as e:
            return {'success': False, 'error': str(e)}
        dado = self._ofi_dado(project_name, id_no)
        dado['estado'] = 'parado'
        if dado['inicio']:
            dado['segundos'] += time.time() - dado['inicio']
            dado['inicio'] = None
        return {'success': True, 'rodando': True}

    def parar_tudo(self, project_name):
        """Para todo terminal do projeto E reabre os papéis (D34).

        As duas coisas juntas, e não em botões separados, porque é essa a
        definição de "Parar tudo": o único caminho de volta depois que um papel
        travou. Separá-las daria um "parar" que não destrava e um "destravar"
        que mataria a garantia no meio de uma execução.
        """
        try:
            parados = []
            for (proj, id_no) in list(self._ofi_procs_dict().keys()):
                if proj != project_name:
                    continue
                if self.parar_terminal(project_name, id_no).get('rodando'):
                    parados.append(id_no)
            # Os terminais do sistema vão junto: um botão que promete parar
            # TUDO e deixasse um `cmd.exe` vivo num nó estaria mentindo — e o
            # processo ficaria sem nada na tela para pará-lo.
            parados += self.fechar_shells_do_projeto(project_name)
            # As esperas e as rodadas de ida e volta vão junto: um nó que
            # dispararia sozinho depois de "Parar tudo" faria o botão mentir.
            self._conx_esquecer_projeto(project_name)
            # ⚠️ AQUI TAMBÉM FECHA A SESSÃO DO ORQUESTRADOR, e o motivo é o
            # mesmo que fez "Parar tudo" ser o único destravador de papel: é o
            # único momento em que o programa sabe, com certeza, que a sessão
            # anterior acabou. A foto do Quadro daquele fluxo é tirada agora.
            self._flx_fechar_abertos(project_name)
            self.destravar_papeis(project_name)
            return {'success': True, 'parados': parados}
        except Exception as e:
            return {'success': False, 'error': str(e)}

