# 02 Básico ou detalhado — o nível certo

Como decidir quanta animação uma coisa recebe. Abra antes de escolher curva, camadas ou fundo.

## O ponto mínimo

**Demais fica ruim, de menos também.** Não existe "sempre rico" nem "sempre contido": esta skill diz **quando** cada um. Quem decide o nível é o **papel da animação**, não o gosto.

| Papel | Quando acontece | Nível | Como fica |
|---|---|---|---|
| **UI funcional** | muitas vezes: hover, botão, formulário, lista | **básica e contida** | uma ou duas propriedades (`transform`/`opacity`), curta, sem camadas extras |
| **Momento autoral** | poucas vezes: entrada de página, transição, herói, celebração | **detalhada e rica** | várias camadas orquestradas (→ `26`), curva forte, ação secundária, luz, partículas |
| **Ambiente** | sempre ligada: fundo vivo, deriva | **lenta e discreta** | baixa amplitude (10–20% *(convenção de ofício)*), mais lenta que o resto, nunca disputa com o herói |

## Por que existem duas escolas

- Os guias de slop de UI dizem "menos, mais contido, ≤ 300 ms".
- A tradição do motion design diz "mais camadas, ação secundária, overshoot, ritmo".

Ambos têm razão, **cada um no seu papel**. Quem só aplica o primeiro entrega animação **seca**; quem só aplica o segundo entrega animação que atrapalha o uso.

## A frequência de uso empurra o nível para baixo

- Ação repetida dezenas ou centenas de vezes por dia (ou feita por teclado) não ganha animação, ou ganha só ~100 ms (Kowalski; Atlassian: < 150 ms para o que ocorre dezenas de vezes por dia).
- Motion expressivo só em momento raro.
- A **linguagem** (curvas, tokens) é a mesma nos três papéis; o que varia é a **intensidade**, pela frequência (→ `14`).

## Como escolher em 3 passos

1. Quantas vezes o usuário verá isto por sessão?
2. O que acontece se eu tirar a animação — algo se perde?
3. Qual dos três papéis é?

Escreva a resposta no script de tempo (→ `07`).

## Cortar ou manter uma camada de riqueza

Cada camada precisa de um **papel**: profundidade, foco, ritmo ou marca. **Sem papel, corta** (→ `13`).

## Sinais

| Demais | De menos |
|---|---|
| tudo se move junto; o olho não sabe onde ir | seca, sem fundo, sem ação secundária |
| a animação atrasa a ação | sem hierarquia |
| glow ou grão atrapalha a leitura *(opinião de ofício)* | tudo em `ease` 300 ms (→ `15`) |

- **Faça:** UI de produto contida; herói e transição ricos; ambiente quase imperceptível.
- **Não faça:** riqueza de marketing dentro de um botão, nem botão seco numa página de abertura.

*Porquê:* o diagnóstico típico de animação de IA ("seca, sem fundo nem partículas") é a escola rica cobrada do papel errado, ou a contida aplicada em um momento autoral.

→ Relacionados: `07`, `13`, `15`, `26`
