# 06 Espaço livre, conversa e fluxo

Os seis Estilos de espaço, conversa e sequência: Canvas infinito, Janelas flutuantes, Chat com contexto, Foco único, Assistente em passos e Documentação. Cada um tem os mesmos quatro subtítulos: *Quando usar*, *Regiões*, *Como se constrói*, *Cuidados*.

## Canvas infinito

**Quando usar.** Trabalho espacial em plano sem limite: diagramas, quadros, mapas.

**Regiões.** Superfície com grade de pontos; controles flutuando sem ocupar layout.

**Como se constrói.**
- **Pan**: arrastar o fundo, ou espaço + arrastar, ou rolagem.
- **Zoom**: Ctrl/Cmd + rolagem, ou pinça.
- Controles flutuantes: **+ / −**, porcentagem de zoom, voltar a 100%, ajustar tudo à tela, desfazer/refazer.
- Barra de status com coordenadas e zoom.
- Arrastar e soltar objetos com ajuste (snap) à grade e guias.
- Seleção múltipla por retângulo.
- O conteúdo nunca some: «ajustar tudo à tela» traz de volta. *Porquê: num plano sem limite, um objeto arrastado para longe fica perdido para sempre sem esse botão.*

**Cuidados.** Os controles não cobrem o conteúdo: ficam nos cantos e recolhem.

## Janelas flutuantes

**Quando usar.** Várias ferramentas que a pessoa organiza como quiser.

**Regiões.** Barra de ferramentas → área com janelas livres.

**Como se constrói.**
- Arrastar pela barra de título; redimensionar pelas bordas e cantos.
- Clicar traz a janela para a frente.
- Minimizar, fechar e restaurar.
- Janela nova abre sem cobrir a anterior por inteiro.
- Nenhuma janela sai inteira da área visível. *Porquê: janela arrastada para fora da tela não tem como ser recuperada.*
- Poucas janelas de cada vez.

**Cuidados.** No Celular não se usa (→ `10`).

## Chat com contexto

**Quando usar.** Conversa com um assistente em que o contexto importa.

**Regiões.** Sessões à esquerda → conversa + campo de envio → painel do contexto à direita.

**Como se constrói.**
- **Streaming** da resposta é o mínimo. *Porquê: esperar a resposta inteira parece travamento.*
- Para ferramenta, a mensagem ocupa a **largura total**, não bolhas de mensageiro. *Porquê: respostas longas com código e tabelas ficam ilegíveis numa bolha estreita.*
- A mensagem da pessoa aparece **na hora**.
- Markdown incompleto não é mostrado cru: o bloco de código só aparece formatado ao fechar.
- A resposta em construção fica numa região `aria-live="polite"`.
- **Ctrl/Cmd+Enter** envia e Enter quebra linha.
- Botão de parar durante a resposta.
- Ordem do Tab: campo de envio → ações da mensagem → ações globais; ação secundária um nível abaixo (menu da mensagem).
- Campo de envio fixo embaixo, cresce até um limite.
- Lista de sessões com a ativa marcada.
- O painel do contexto mostra o que a IA está vendo e pode ser recolhido.

**Cuidados.** Ação destrutiva de mensagem (apagar) fica no menu, nunca à vista ao lado de «copiar».

## Foco único

**Quando usar.** Coleta curta, principalmente no Celular.

**Regiões.** Uma pergunta por vez, progresso discreto.

**Como se constrói.**
- Uma pergunta e uma resposta por tela.
- Progresso discreto («3 de 7»).
- Enter ou botão avançam.
- **Voltar** sempre possível, e a resposta anterior continua lá. *Porquê: quem errou uma resposta não pode ser obrigado a recomeçar.*
- A última tela é o resumo, com o envio.

**Cuidados.** Se as respostas dependem umas das outras e precisam ser revistas juntas, use Assistente em passos.

## Assistente em passos

**Quando usar.** Processo sequencial com dependência entre etapas e revisão no fim.

**Regiões.** Trilha de etapas → cartão do passo → Voltar/Avançar.

**Como se constrói.**
- A trilha mostra o passo atual, os feitos e os que faltam.
- O cartão traz só o que o passo pede.
- Validação **ao avançar**, com o erro junto do campo.
- Avançar diz o que vem («Continuar para pagamento»); o último passo é revisão + confirmação com o nome da ação.
- Voltar não perde o que foi preenchido.
- Entre 3 e 6 passos; mais que isso, repense a divisão.

**Cuidados.** Fluxo complexo **nunca** vai dentro de um modal. *Porquê: modal não comporta trilha, voltar nem estado preservado — e some com um clique fora.*

## Documentação

**Quando usar.** Leitura de conteúdo longo.

**Regiões.** Capítulos → texto de largura contida → índice da página.

**Como se constrói.**
- Texto em coluna de 60 a 80 caracteres por linha. *Porquê: linha mais larga cansa e faz o olho perder a linha seguinte.*
- Capítulos na esquerda, com o atual marcado.
- Índice da página à direita, acompanhando a rolagem.
- Títulos com âncora e link copiável.
- Blocos de código com botão de copiar.
- Busca no topo.
- Anterior/próximo no fim da página.

**Cuidados.** Não coloque o índice da página e os capítulos no mesmo lado: são dois níveis diferentes.

## Erros comuns

| Sintoma | Causa | Regra |
|---|---|---|
| o chat despeja a resposta inteira de uma vez | sem streaming | streaming |
| bloco de código aparece cru no meio da resposta | markdown incompleto renderizado | só formata ao fechar |
| canvas em que o conteúdo «some» | sem como ajustar à tela | botão e atalho «ajustar tudo» |
| assistente de 9 passos | divisão ruim | 3 a 6 passos |
| janela arrastada para fora da tela | sem limite de área | nenhuma janela sai inteira da área visível |
| Enter envia a mensagem e a pessoa não consegue quebrar linha | atalho invertido | Ctrl/Cmd+Enter envia; Enter quebra linha |
