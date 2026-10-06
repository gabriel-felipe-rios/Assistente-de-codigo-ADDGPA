"""A ferramenta que uma EXTENSÃO atende, e os limites que todo subagente segue.

Pergunta que este arquivo responde: "o subagente pediu uma ferramenta que não
é do programa — quem responde, e com que teto?". Desde a fase 07 (D51) uma
extensão pode declarar ferramenta própria (o recurso `ferramenta` do
manifesto), dá-la aos subagentes dela e emprestá-la a um subagente do
programa (`subagentes_do_programa`). Quem executa é o backend DA EXTENSÃO,
pela porta de sempre (`executar(payload)`, ação `xt.ferramenta`); o programa
só leva o pedido e corta a resposta.

⚠️ O TETO É O DO PROGRAMA, e é o mesmo de toda ferramenta que lê (D53): o que
a extensão devolve passa por `_sub_cortar_avisando` com
`_sub_teto_ler_arquivo`. Ela não tem teto próprio e não precisa contar token.

⚠️ O PROGRAMA NÃO LÊ O QUE A FERRAMENTA LÊ. Quem abre arquivo — dentro ou
fora da pasta de trabalho — é a extensão, e o que ela lê fora está declarado
no `le_fora` do manifesto. O núcleo continua preso à pasta de trabalho (P7).

⚠️ IMPORT TARDIO de `modulos.extensoes`: a camada de extensões confere o
manifesto com os catálogos daqui (`ferramentas_subagentes_constantes`), e um
import no topo fecharia o ciclo.
"""


def ferramenta_de_extensao_ligada(nome):
    """O item `ferramenta` de uma extensão LIGADA que se chama `nome` — ou
    `None`. Nunca lança: falhar ao ler as extensões é "não existe"."""
    try:
        from modulos.extensoes.agentes import ferramenta_de_extensao
        return ferramenta_de_extensao(nome)
    except Exception as e:
        print('[subagentes] falha ao ler as ferramentas de extensão:', e)
        return None


def descricao_de_ferramenta_de_extensao(nome):
    """`(devolve, se_errar)` da ferramenta de extensão `nome`, para a tabela da
    sub-aba Ferramentas do Chat e da Fila — ou `None`."""
    f = ferramenta_de_extensao_ligada(nome)
    return (f['devolve'], f['se_errar']) if f else None


class FerramentasSubagentesExtensaoMixin:

    def _ferr_de_extensao(self, project_name, subagente, ferramenta, parametros):
        """Leva a chamada ao backend da extensão e devolve o texto, cortado no
        teto de leitura. Falha vira `ValueError` — o despachante a transforma em
        `ERRO: …` e a anota no rastro, como a de qualquer ferramenta."""
        from modulos.extensoes.constantes import XT_ACAO_FERRAMENTA
        from modulos.extensoes.ponte import chamar_pelo_programa
        r = chamar_pelo_programa(self, ferramenta['caminho_extensao'], {
            'acao': XT_ACAO_FERRAMENTA,
            'ferramenta': ferramenta['nome'],
            'subagente': subagente,
            'parametros': dict(parametros or {}),
            'projeto': project_name,
        })
        if not isinstance(r, dict):
            raise ValueError('a extensão "%s" respondeu sem o formato {success, texto}'
                             % ferramenta['extensao'])
        if not r.get('success'):
            raise ValueError(r.get('error')
                             or 'a extensão "%s" não respondeu' % ferramenta['extensao'])
        texto = r.get('texto')
        if not isinstance(texto, str):
            raise ValueError('a extensão "%s" respondeu sem `texto`' % ferramenta['extensao'])
        return self._sub_cortar_avisando(texto, self._sub_teto_ler_arquivo())

    def _sub_limites_gerais(self):
        """Os cinco limites que TODO subagente segue, do programa ou de extensão
        (D53) — com o valor de agora, para a página da extensão MOSTRAR.

        `rotulo` é o texto da tela; `unidade` vazia é contagem. O paralelo sai
        grampeado em `MAX_PARALELO`, que é o que `_executar_chamadas_subagentes`
        usa de fato."""
        from modulos.agentes.execucao.subagentes_constantes import MAX_PARALELO
        return [
            {'rotulo': 'Subagentes em paralelo',
             'valor': min(self._sub_limite('max_paralelo_subagentes'), MAX_PARALELO),
             'unidade': ''},
            {'rotulo': 'Rodadas de ferramentas',
             'valor': self._sub_limite('max_rodadas_ferramentas'), 'unidade': ''},
            {'rotulo': 'Ferramentas por rodada',
             'valor': self._sub_limite('max_ferramentas_rodada'), 'unidade': ''},
            {'rotulo': 'Teto de leitura — vale para toda ferramenta que lê',
             'valor': self._sub_teto_ler_arquivo(), 'unidade': 'tokens'},
            {'rotulo': 'Teto da resposta',
             'valor': self._sub_limite('teto_resposta_subagente_tokens'), 'unidade': 'tokens'},
        ]
