# 05 Para onde vai cada arquivo

*Abra este arquivo primeiro, ao instalar o painel num projeto: ele diz onde cada cópia mora, a ordem do trabalho e — o mais importante — o que você NÃO pode editar.*

## Onde cada arquivo mora

Os destinos abaixo são a recomendação. Cada arquivo de código tem no topo um bloco `# --- AJUSTES DO PROJETO ---` … `# --- FIM DOS AJUSTES ---` com as constantes de caminho; se o projeto tiver outra estrutura de pastas, adapte esse bloco **na cópia**.

| Arquivo da skill | Destino no projeto | Se o projeto tiver outra estrutura |
|---|---|---|
| `Observar.pyw` | **raiz** do projeto, ao lado do arquivo que abre o programa | ajuste `RAIZ`, `PASTA_DO_PAINEL`, `RASTRO` |
| `painel.html` | `Workshop/observar/painel.html` | qualquer pasta de ferramentas de desenvolvimento; ajuste `PASTA_DO_PAINEL` |
| `analisador.py` | `Workshop/observar/analisador.py` | a mesma pasta do painel; ajuste `RAIZ_DO_PROJETO`, `PASTA_DAS_DESCRICOES`, `IGNORAR` |
| descrições (você escreve) | `Workshop/observar/descricoes/<fluxo>.json` | dentro da pasta do analisador |
| `emissor.py` | `Program/Code/utils/emissor.py` | onde ficam os utilitários do código que roda com o programa; ajuste `RAIZ_DO_PROJETO` e `CAMINHO_RASTRO` |
| rastro (o programa escreve) | `Program/Internal/logs/rastro.jsonl` | a pasta de logs do projeto; **o mesmo caminho** no emissor (`CAMINHO_RASTRO`) e no `Observar.pyw` (`RASTRO`) |

Mantenha os quatro papéis em pastas equivalentes: **raiz** (o arranque), **ferramentas de desenvolvimento** (painel, analisador, descrições), **código que roda com o programa** (o emissor) e **logs** (o rastro). O painel e o analisador **não** ficam na parte que vai para o usuário final; o emissor **fica**, porque as marcas dependem dele.

O analisador ignora pastas chamadas `.git`, `.venv`, `venv`, `env`, `node_modules`, `__pycache__`, `Distribution`, `Files`, `observar` e qualquer pasta que começa com `.`. Se o código do projeto mora numa pasta com um desses nomes, ajuste `IGNORAR` na cópia.

## A ordem do trabalho

| # | Passo | Tipo |
|---|---|---|
| 1 | Ler esta skill e decidir onde as coisas moram | pronto |
| 2 | Copiar `emissor.py` | cópia pronta |
| 3 | Copiar `painel.html`, `analisador.py` e `Observar.pyw` | cópia pronta |
| 4 | Rodar `analisador.py --candidatos` e escrever as descrições (arquivo 06) | sob medida, mínimo |
| 5 | Pôr as marcas (arquivo 07) | sob medida, mínimo |
| 6 | Conferir (arquivo 08) | roteiro |

## O que NÃO se pode editar

- **Só estes arquivos podem ser criados ou alterados no projeto:**
  - (a) os arquivos **novos**: as cópias de `emissor.py`, `painel.html`, `analisador.py`, `Observar.pyw` e os JSON de descrição em `Workshop/observar/descricoes/`;
  - (b) as **marcas mínimas** dos Logs no código do programa: um `import` por arquivo marcado e uma linha de decorador (ou uma chamada `marcar`) por ponto — **só acrescentam**.
- **Mais nada.** Não edite nenhum outro arquivo do projeto, mesmo que pareça melhoria, refatoração, correção de bug, formatação, atualização de dependência, `.gitignore`, `README`, arquivo de configuração, documentação de arquitetura ou base de decisões do projeto.
- **Nunca edite os arquivos da skill.** Copie e adapte a cópia.
- **O painel e o analisador só leem** o código; nada do que eles fazem escreve no projeto.
- Se o projeto tiver uma regra própria de organização de pastas que o arquivo de arranque na raiz fira, **não registre a exceção você mesmo**: escreva no relatório final ao usuário (arquivo 08) que a raiz ganhou um segundo arquivo de arranque (`Observar.pyw`) e que ele pode querer registrar isso onde o projeto guarda suas exceções.
- Achou que precisa mexer em outro arquivo para o painel funcionar? **Pare e diga ao usuário qual e por quê**; não mexa.

## O que copiar não altera

Copiar os arquivos, escrever as descrições e rodar o painel **não mudam nenhum código existente**. A única coisa que acrescenta linhas ao código do programa são as marcas.

## Sem marcas

O Pipeline funciona inteiro (ele lê o código); os Logs ficam vazios.

## Requisitos do projeto

Python 3.9 ou mais novo instalado. Não há nada a instalar: o código usa só a biblioteca padrão.
