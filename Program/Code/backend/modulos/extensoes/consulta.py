"""M5 — a CONSULTA, lado servidor.

O último dos seis mecanismos, e o inverso do M4. Lá o programa **avisa** e a
extensão reage; aqui o programa **pergunta** e a extensão responde.

    M2/M3  a extensão desenha ou age num ponto      (o usuário provoca)
    M4     o programa avisa, a extensão reage        (o programa provoca)
    M5     o programa pergunta, a extensão responde  (o programa precisa da resposta)

⚠️ **Este módulo não executa nada da extensão** — e desta vez a razão é mais
forte que nas obras anteriores. A consulta do autocomplete (Recursos do
Editor › sugestões ao digitar) responde
**a cada tecla**: ela precisa terminar em milissegundos, e uma ida ao Python
por tecla é exatamente o que faria o Editor engasgar. Por isso M5 é
**frontend puro**: quem chama, quem responde e quem desenha estão todos na
tela.

O que mora aqui é o de sempre — o CATÁLOGO de consultas e a validação do que o
manifesto declarou — mais **a fonte de dados do caminho quente**: o índice de
símbolos, entregue UMA vez ao abrir o projeto para o JavaScript filtrar em
memória.

Cada consulta é uma PARTE do recurso Recursos do Editor (`'parte'`): é o que
liga o item `{"recurso": "editor", "parte": "sugestoes"}` do manifesto a ela.
São três (fase 12): sugestões ao digitar, dica ao passar o mouse e formatação.
A quarta parte que responde a pergunta do Editor — trechos prontos — é DADO,
e não consulta: vem por `dados.py`, sem código nenhum.

⚠️ **Cada consulta tem o PRÓPRIO teto** (`teto_ms`), e ele chega ao frontend
junto de cada consulta derivada (`validacao.derivar_campos_da_tela`) — nunca
copiado para o JavaScript. 150 ms é o do autocomplete, que roda a cada tecla;
formatar um arquivo inteiro não cabe nisso, e a resposta seria sempre
descartada (o mesmo sintoma do defeito real de `_xtComTeto`).
"""

from .constantes import erro_do_arquivo_declarado

# As consultas da primeira versão.
#
# ⚠️ `frontend_puro` não é decoração: onde ele é verdadeiro, a extensão
# responde SEM ir ao backend, a partir de um dado que o programa já carregou.
# É o que separa uma consulta que pode rodar a cada tecla de uma que não pode.
XT_CONSULTAS = (
    {
        'nome': 'editor.autocomplete',
        'parte': 'sugestoes',
        'frontend_puro': True,
        'teto_ms': 150,
        'quando': 'Editor › a cada tecla, depois de uma pausa de 80 ms',
        'pergunta': '{ projeto, arquivo, linha, coluna, prefixo, simbolos }',
        'resposta': '[{ texto, detalhe, prioridade }]',
        'nota': 'a extensão recebe os símbolos do projeto JÁ CARREGADOS e filtra '
                'em memória — nenhuma ida ao Python por tecla',
    },
    {
        'nome': 'editor.dica',
        'parte': 'dica',
        'frontend_puro': True,
        'teto_ms': 300,
        'quando': 'Editor › o mouse parou sobre uma palavra (pausa de 400 ms)',
        'pergunta': '{ projeto, arquivo, linguagem, linha, coluna, palavra, texto }',
        'resposta': '[{ texto }] — texto simples, uma ou poucas linhas',
        'nota': 'só é perguntada a extensão que declarou a linguagem do arquivo; '
                'as respostas de várias se SOMAM no mesmo balão',
    },
    {
        'nome': 'editor.formatar',
        'parte': 'formatacao',
        'frontend_puro': True,
        'teto_ms': 1500,
        'quando': 'Editor › o usuário pediu para formatar o arquivo',
        'pergunta': '{ projeto, arquivo, linguagem, texto }',
        'resposta': '{ texto } — o arquivo inteiro formatado, ou null para "não sei formatar este"',
        'nota': 'uma extensão só responde por linguagem (escolha única): vale a '
                'primeira na ordem da lista que devolver algo',
    },
)

# O teto de quem não diz o próprio — o mesmo do frontend (`consulta.js`).
XT_TETO_CONSULTA_PADRAO_MS = 150

XT_CONSULTAS_POR_NOME = {c['nome']: c for c in XT_CONSULTAS}

# Quantos símbolos o programa entrega ao frontend de uma vez. Um projeto grande
# passa de 50 mil, e mandar tudo custaria memória e um congelamento visível na
# serialização — sem servir para nada: ninguém rola uma lista de sugestões
# além das primeiras dezenas, e o filtro de prefixo corta antes disso.
XT_TETO_SIMBOLOS = 20000


def validar_consultas(caminho_relativo, declarados):
    """Confere o que o manifesto declarou em `consultas` contra o catálogo.

    Mesma forma de `validar_encaixes` e `validar_eventos`, e pelo mesmo motivo:
    erro aqui aparece na lista de Configurações sem impedir a extensão de
    ligar. Um `nome` com um caractere trocado, sem isto, seria uma extensão que
    liga, não dá erro e nunca é perguntada.
    """
    erros, normalizados = [], []

    for i, bruto in enumerate(declarados or []):
        rotulo = 'consultas[%d]' % i

        if not isinstance(bruto, dict):
            erros.append('%s precisa ser um objeto `{"nome": …, "arquivo": …}`, '
                         'e veio %s.' % (rotulo, type(bruto).__name__))
            continue

        nome = str(bruto.get('nome', '')).strip()
        arquivo = str(bruto.get('arquivo', '')).strip()

        if not nome:
            erros.append('%s não disse que consulta responde.' % rotulo)
            continue
        if nome not in XT_CONSULTAS_POR_NOME:
            erros.append('%s: consulta desconhecida "%s". As que existem hoje são: %s.'
                         % (rotulo, nome, ', '.join(sorted(XT_CONSULTAS_POR_NOME))))
            continue
        erro_arquivo = erro_do_arquivo_declarado(caminho_relativo, arquivo, rotulo)
        if erro_arquivo:
            erros.append(erro_arquivo)
            continue

        # ⚠️ Mesma regra dos encaixes e dos eventos: o registro da tela guarda
        # uma resposta por extensão por consulta, e a segunda declaração
        # apagaria a primeira em silêncio.
        if any(n['nome'] == nome for n in normalizados):
            erros.append('%s: a consulta "%s" já foi declarada acima. Uma por '
                         'extensão — junte as duas num arquivo só.' % (rotulo, nome))
            continue

        normalizados.append({'nome': nome, 'arquivo': arquivo})

    return erros, normalizados


class XtConsultaMixin:
    def list_consultas_programa(self):
        """O catálogo de consultas, e quem responde cada uma.

        Alimenta o mesmo cartão de Configurações que já mostra os pontos de
        encaixe e os eventos — as três listas respondem à mesma pergunta do
        autor de extensão: "por onde eu entro?".
        """
        try:
            resposta = self.list_extensoes_programa()
            if not resposta.get('success'):
                return {'success': False, 'error': resposta.get('error', ''), 'consultas': []}
            folhas = [f for f in _todas_as_folhas(resposta['arvore']) if f['ligado']]
        except Exception as e:
            print('[extensoes] falha ao listar as consultas:', e)
            return {'success': False, 'error': str(e), 'consultas': []}

        consultas = []
        for c in XT_CONSULTAS:
            respondem = [
                {'caminho': f['caminho'], 'slug': f['slug'], 'nome': f['nome']}
                for f in folhas for d in f['consultas'] if d['nome'] == c['nome']
            ]
            consultas.append(dict(c, respondem=respondem))

        return {'success': True, 'consultas': consultas}

    def simbolos_para_autocomplete(self, project_name):
        """Os nomes do projeto, para o autocomplete filtrar EM MEMÓRIA.

        ⚠️ **Esta é a chamada que existe para não haver outra.** Ela roda uma
        vez, quando o projeto abre; a partir daí cada tecla é filtrada no
        JavaScript. Uma variante "me dá os símbolos que começam com X" seria
        mais elegante e destruiria o recurso: ida ao Python por tecla é
        exatamente o que o teto de milissegundos não comporta.

        Enxuga o símbolo ao osso — `nome`, `tipo`, `arquivo`, `linha`. O índice
        guarda também o caminho absoluto, a pasta-raiz e a linguagem, e nada
        disso serve para completar uma palavra: mandá-los multiplicaria o
        tamanho da resposta sem mudar uma sugestão sequer.

        Devolve lista vazia, e não erro, quando o índice não foi construído: o
        autocomplete some, o Editor continua. Um projeto sem Índice de Símbolos
        é o estado normal de quem nunca abriu a aba Análise.
        """
        try:
            r = self.get_symbol_index(project_name)
        except Exception as e:
            print('[extensoes] falha ao ler o indice de simbolos:', e)
            return {'success': True, 'simbolos': [], 'truncado': False}

        indice = (r or {}).get('index') or {}
        brutos = indice.get('symbols') or []

        vistos = set()
        simbolos = []
        for s in brutos:
            nome = s.get('name')
            if not nome:
                continue
            # O mesmo nome definido em cinco arquivos é UMA sugestão, não
            # cinco: a lista de completar mostra a palavra, e repeti-la só
            # empurra as outras para fora da tela. O primeiro vence, e o índice
            # já vem ordenado por nome.
            chave = (nome, s.get('type'))
            if chave in vistos:
                continue
            vistos.add(chave)
            simbolos.append({'nome': nome, 'tipo': s.get('type', ''),
                             'arquivo': s.get('relative', ''), 'linha': s.get('line', 0)})
            if len(simbolos) >= XT_TETO_SIMBOLOS:
                return {'success': True, 'simbolos': simbolos, 'truncado': True}

        return {'success': True, 'simbolos': simbolos, 'truncado': False}


def _todas_as_folhas(no):
    """Cópia local, pelo mesmo motivo de `encaixes.py` e `eventos.py`:
    importar `descoberta` aqui fecharia o ciclo pelo `manifesto`."""
    folhas = list(no.get('extensoes', []))
    for pasta in no.get('pastas', []):
        folhas.extend(_todas_as_folhas(pasta))
    return folhas
