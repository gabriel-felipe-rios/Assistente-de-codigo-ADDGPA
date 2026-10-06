"""A configuração da aba Trabalhos — bloqueio, Portão e limites.

Dois lugares, e a divisão não é arbitrária:

    o PADRÃO de fábrica é GLOBAL, e mora no `settings.json` do programa — o
      mesmo arquivo que já guarda os presets de Preparar Projeto. É o que o
      usuário quer valendo em todo projeto sem reconfigurar um por um.

    o DESVIO é POR PROJETO, e mora em `Trabalhos/Configuração.json`. É onde o
      "liga o `git commit` só neste projeto aqui" cabe.

Ler é sempre "o desvio do projeto, e o global no que ele não disser". Gravar
pela tela de Configuração grava o desvio; gravar o padrão é ação explícita e
separada ("valer para todo projeto").

⚠️ A LISTA NÃO MORA AQUI. Quais bloqueios existem, quais gatilhos existem e
quais limites existem está em `catalogo_trabalhos.py`, que é a fonte única —
lida também pela tela, pelo system prompt e pelo hook. Este módulo só sabe
LER e GRAVAR o que aquele declara.
"""

import json
import os
import re

from .caminhos import (
    obter_arquivo_de_configuracao_dos_trabalhos,
    obter_prompt_dos_trabalhos,
)
from .catalogo_trabalhos import (
    BLOQUEIOS_COM_INTERRUPTOR,
    BLOQUEIOS_DUROS,
    COLUNAS_DO_QUADRO,
    GATILHO_FIXO,
    GATILHOS_DO_PORTAO,
    LIMITES_EDITAVEIS,
    LIMITES_FIXOS,
    PADROES_DOS_TRABALHOS,
    TAGS_DAS_ATIVIDADES,
)
from .trabalhos_estado import gravar_json_atomico, travar_entre_processos

# Os comentarios de autoria do molde (`<!-- ... -->`), que nao vao ao modelo.
_RE_COMENTARIO_DE_MOLDE = re.compile(r'<!--.*?-->\s*', re.DOTALL)


class TrabalhosConfigMixin:

    # ── Leitura ──────────────────────────────────────────────────────────────

    def _trab_padroes_globais(self):
        """Os padrões de fábrica, já com o que o usuário salvou por cima.

        `load_settings` é a mesma porta que Preparar, Editor e Notificações
        usam. Valor ausente cai no padrão de `catalogo_trabalhos.py`, e nunca
        num número escrito à mão no ponto de uso.
        """
        try:
            salvos = self.load_settings().get('settings', {}) or {}
        except Exception:
            salvos = {}
        return {chave: salvos.get(chave, padrao)
                for chave, padrao in PADROES_DOS_TRABALHOS.items()}

    def _trab_desvio_do_projeto(self, project_name):
        caminho = obter_arquivo_de_configuracao_dos_trabalhos(project_name)
        if not os.path.isfile(caminho):
            return {}
        try:
            with open(caminho, 'r', encoding='utf-8') as f:
                dados = json.load(f)
            return dados if isinstance(dados, dict) else {}
        except Exception:
            # Desvio ilegível cai no global, e isso é seguro na direção certa:
            # o global tem TODOS os interruptores desligados de fábrica, então
            # o pior caso é o agente ficar mais preso do que o usuário pediu —
            # nunca mais solto.
            return {}

    def _trab_config_efetiva(self, project_name):
        """O que de fato vale neste projeto. É esta a leitura que o system
        prompt, o hook e a recusa de comando consultam — nunca as duas metades
        soltas.
        """
        efetiva = self._trab_padroes_globais()
        efetiva.update(self._trab_desvio_do_projeto(project_name))
        # ⚠️ O gatilho fixo é reafirmado DEPOIS do desvio, de propósito: um
        # `Configuração.json` editado à mão (ou de uma versão futura) não pode
        # desligar a trava. Ela não é preferência.
        efetiva['trabalhos_portao_' + GATILHO_FIXO] = True
        return efetiva

    def carregar_config_dos_trabalhos(self, project_name):
        """Tudo que a tela de Configuração precisa desenhar, numa chamada.

        Manda as LISTAS junto com os valores porque a tela não tem cópia
        própria delas — é o que garante que um bloqueio novo apareça na tela
        sem ninguém editar o JavaScript.
        """
        try:
            return {
                'success': True,
                'valores': self._trab_config_efetiva(project_name),
                'globais': self._trab_padroes_globais(),
                'catalogo': {
                    'colunas': COLUNAS_DO_QUADRO,
                    'tags': TAGS_DAS_ATIVIDADES,
                    'bloqueios_duros': BLOQUEIOS_DUROS,
                    'bloqueios_com_interruptor': BLOQUEIOS_COM_INTERRUPTOR,
                    'gatilhos': GATILHOS_DO_PORTAO,
                    'gatilho_fixo': GATILHO_FIXO,
                    'limites_editaveis': LIMITES_EDITAVEIS,
                    'limites_fixos': LIMITES_FIXOS,
                },
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Gravação ─────────────────────────────────────────────────────────────

    def _trab_validar_patch(self, patch):
        """Deixa passar só chave conhecida, com valor do tipo certo.

        Chave desconhecida é RECUSADA, não ignorada: um `Configuração.json` com
        lixo dentro é o começo de um interruptor que a tela mostra e o hook não
        aplica.
        """
        limpo = {}
        for chave, valor in (patch or {}).items():
            if chave not in PADROES_DOS_TRABALHOS:
                raise ValueError(f'Configuração desconhecida: {chave}')
            if chave == 'trabalhos_portao_' + GATILHO_FIXO:
                # Não é erro do usuário — é a tela mandando o estado inteiro de
                # volta, com o cadeado junto. Ignorar esta chave é o certo;
                # recusar o patch todo por causa dela seria hostil.
                continue
            padrao = PADROES_DOS_TRABALHOS[chave]
            if isinstance(padrao, bool):
                limpo[chave] = bool(valor)
            else:
                try:
                    numero = int(valor)
                except (TypeError, ValueError):
                    raise ValueError(f'"{chave}" precisa de um número, veio: {valor!r}')
                limite = next((l for l in LIMITES_EDITAVEIS
                               if 'trabalhos_limite_' + l['id'] == chave), None)
                if limite and not (limite['minimo'] <= numero <= limite['maximo']):
                    raise ValueError(
                        f'"{limite["rotulo"]}" aceita de {limite["minimo"]} a '
                        f'{limite["maximo"]}; veio {numero}.')
                limpo[chave] = numero
        return limpo

    def salvar_config_dos_trabalhos(self, project_name, patch):
        """Grava o DESVIO deste projeto."""
        try:
            limpo = self._trab_validar_patch(patch)
            caminho = obter_arquivo_de_configuracao_dos_trabalhos(project_name)
            # Mesmo lock entre processos do `Estado.json`, e pelo mesmo motivo:
            # o processo do servidor MCP LÊ este arquivo para saber o que pode
            # rodar, e ler um arquivo meio gravado é ler permissão errada.
            with travar_entre_processos(caminho):
                atual = self._trab_desvio_do_projeto(project_name)
                atual.update(limpo)
                gravar_json_atomico(caminho, atual)
            return {'success': True, 'valores': self._trab_config_efetiva(project_name)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def salvar_padrao_dos_trabalhos(self, patch):
        """Grava o padrão GLOBAL, para todo projeto.

        `save_settings_parcial` e não `save_settings`: gravar o dicionário
        inteiro daqui reverteria, em silêncio, qualquer outra configuração que
        outra tela tenha mudado desde a última leitura.
        """
        try:
            limpo = self._trab_validar_patch(patch)
            return self.save_settings_parcial(limpo)
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def restaurar_config_dos_trabalhos(self, project_name):
        """Apaga o desvio do projeto — volta a valer o global, inteiro."""
        try:
            caminho = obter_arquivo_de_configuracao_dos_trabalhos(project_name)
            with travar_entre_processos(caminho):
                if os.path.isfile(caminho):
                    os.remove(caminho)
            return {'success': True, 'valores': self._trab_config_efetiva(project_name)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── O que a configuração PRODUZ ──────────────────────────────────────────

    def _trab_comandos_bloqueados(self, project_name):
        """Os prefixos de comando recusados neste projeto, agora.

        Fonte ÚNICA de quem recusa: a verificação sem IA, o hook `PostToolUse`
        e o texto do system prompt saem todos daqui. Copiar esta lista para
        qualquer um dos três é o defeito que `arquivos.py::_mcp_registrar`
        documenta ter acontecido com as ferramentas do MCP.
        """
        config = self._trab_config_efetiva(project_name)
        comandos = []
        for b in BLOQUEIOS_DUROS:
            comandos.extend(b['comandos'])
        for b in BLOQUEIOS_COM_INTERRUPTOR:
            # Desligado = recusado. O interruptor LIBERA; ele não avisa.
            if not config.get('trabalhos_bloqueio_' + b['id'], b['padrao']):
                comandos.extend(b['comandos'])
        return comandos

    def _trab_gatilhos_ligados(self, project_name):
        config = self._trab_config_efetiva(project_name)
        return [g for g in GATILHOS_DO_PORTAO
                if config.get('trabalhos_portao_' + g['id'], g['padrao'])]

    # ── O system prompt de cada papel ────────────────────────────────────────
    #
    # ⚠️ É AQUI QUE A FONTE ÚNICA DEIXA DE SER PROMESSA. Os moldes em
    # `prompts/Trabalhos/` carregam `{{BLOQUEIOS}}`, `{{GATILHOS}}` e
    # `{{LIMITES}}` como buracos, e não as listas escritas à mão — quem os
    # preenche é esta função, lendo o mesmo catálogo que a tela desenha e que
    # a recusa de comando consulta.
    #
    # Escrever a lista dentro do `.md` seria a segunda cópia, e o comentário de
    # `arquivos.py::_mcp_registrar` já conta como esse defeito termina: a tela
    # mostrando uma regra que o resto do programa não aplica, sem ninguém ter
    # como notar.
    #
    # ⚠️ Entra no system prompt UMA VEZ, no começo da sessão do terminal, e não
    # é reenviado a cada mensagem — é o que preserva o cache do assistente
    # externo em vez de gastar cota repetindo o mesmo aviso.

    def _trab_texto_dos_bloqueios(self, project_name):
        config = self._trab_config_efetiva(project_name)
        linhas = []
        for b in BLOQUEIOS_DUROS:
            comandos = (' — `' + '` · `'.join(b['comandos']) + '`') if b['comandos'] else ''
            linhas.append(f'- **{b["rotulo"]}**{comandos} — sem interruptor, nunca liberável.')
        for b in BLOQUEIOS_COM_INTERRUPTOR:
            if config.get('trabalhos_bloqueio_' + b['id'], b['padrao']):
                continue  # liberado neste projeto: não anuncie como bloqueio.
            comandos = (' — `' + '` · `'.join(b['comandos']) + '`') if b['comandos'] else ''
            linhas.append(f'- **{b["rotulo"]}**{comandos}')
        return '\n'.join(linhas)

    def _trab_texto_dos_gatilhos(self, project_name):
        linhas = []
        for g in self._trab_gatilhos_ligados(project_name):
            fixo = ' *(não desliga)*' if g['fixo'] else ''
            linhas.append(f'- {g["rotulo"]}{fixo}')
        return '\n'.join(linhas)

    def _trab_texto_dos_limites(self, project_name):
        config = self._trab_config_efetiva(project_name)
        linhas = []
        for l in LIMITES_EDITAVEIS:
            valor = config.get('trabalhos_limite_' + l['id'], l['padrao'])
            linhas.append(f'- {l["rotulo"]}: **{valor}**')
        for l in LIMITES_FIXOS:
            linhas.append(f'- {l["rotulo"]}: {l["valor"]}')
        return '\n'.join(linhas)

    def _trab_montar_prompt(self, project_name, papel):
        """O molde de um papel, com os buracos preenchidos.

        `papel` é 'orquestrador' ou 'subagente' — os dois únicos que existem.
        Molde ausente levanta, e não devolve texto vazio: um terminal aberto
        com system prompt em branco não anuncia bloqueio nenhum ao agente, e o
        primeiro sinal disso seria o agente tentando o que não podia.
        """
        if papel not in ('orquestrador', 'subagente'):
            raise ValueError(f'Papel desconhecido: {papel}. Existem dois: '
                             'orquestrador e subagente.')
        caminho = obter_prompt_dos_trabalhos(f'{papel}.md')
        if not os.path.isfile(caminho):
            raise ValueError(f'O molde de prompt do {papel} não foi encontrado: {caminho}')
        with open(caminho, 'r', encoding='utf-8') as f:
            molde = f.read()
        # O comentario HTML do molde e recado para quem EDITA o arquivo ("nao
        # escreva a lista a mao aqui"), nao para o modelo. Mandar isso no
        # system prompt gasta token e ainda instrui o agente sobre uma regra de
        # manutencao do programa que nao e assunto dele.
        molde = _RE_COMENTARIO_DE_MOLDE.sub('', molde)
        return (molde
                .replace('{{BLOQUEIOS}}', self._trab_texto_dos_bloqueios(project_name))
                .replace('{{GATILHOS}}', self._trab_texto_dos_gatilhos(project_name))
                .replace('{{LIMITES}}', self._trab_texto_dos_limites(project_name)))
