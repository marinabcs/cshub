# Feedback das Reunioes do Time de CS

Documentacao consolidada dos insights, decisoes e pontos de acao extraidos das reunioes do time de atendimento/CS.

---

## Reuniao 1 - 11/02/2026

**Participantes:** Marina Barros, Cesar Oliveira, Rafael Nascimento, Natalia Santos, Nathalia Montiel
**Tema:** Apresentacao do novo processo de atendimento com playbooks e templates de email

### Contexto

Marina apresentou ao time o sistema de playbooks baseado nos 4 niveis de saude do CS Hub (Crescimento, Estavel, Alerta, Resgate). A proposta e que cada nivel tenha um playbook com sequencia de acoes, emails e prazos definidos, permitindo ao time saber exatamente o que fazer em cada situacao.

### Decisoes e Definicoes

#### Playbooks por Nivel de Saude

**Crescimento (ciclo mensal):**
- Objetivo: Acelerar, coletar cases e expandir
- Acoes: reconhecimento, pedido de case de sucesso do segmento, sugestao de estrategias usadas por empresas do mesmo segmento (sem citar concorrente direto)
- Sinalizar para Teness (time comercial) entrar nas calls para captar oportunidades de venda
- CS abre portas, Teness vende

**Estavel (ciclo mensal):**
- Objetivo: Nutrir relacionamento e mapear sazonalidade
- Ganchos mensais: alertas sobre datas de mercado, novidades de features da Trakto
- Mapear sazonalidade com o cliente ou com o account do Google
- Importancia: documentar sazonalidade por segmento (ex: educacao = Nov-Fev para matriculas, varejo = Black Friday)
- Hoje o time sabe de cabeca, mas falta documentar e cruzar dados de 3-4 clientes do mesmo segmento para validar

**Alerta (ciclo de 21 dias):**
- Objetivo: Intervir antes de piorar
- Trigger principal: bugs/reclamacoes
- Carencia interna de 7 dias antes de iniciar playbook completo (bug pode ser resolvido em 2-3 dias)
- Se bug nao resolver em 7 dias, iniciar comunicacao mais intensa
- Principio: comunicacao em excesso para cliente nao se sentir abandonado (repetir mesma informacao com palavras diferentes)
- Ao final dos 21 dias sem melhora, cliente vai para Resgate

**Resgate (ciclo de 15-30 dias):**
- Objetivo: Recuperacao antes do churn
- Dia 0: revisao interna do perfil do cliente, identificar oportunidades
- Dia 1-2: enviar email de diagnostico
- Dia 2-3: acionar Vendas/gestor de cima (Teness tem contato com gestores, CS tem contato com operacional)
- Dia 3-5: call de diagnostico com cliente
- Dia 5-7: roadmap de recuperacao
- Dia 7+: acompanhamento semanal
- Lista de acoes pre-aprovadas que CS pode oferecer por conta propria (sem precisar validar internamente):
  - Calls recorrentes com cliente
  - Treinamento com todo o time do cliente
  - Sessoes oficiais fixas
  - Criacao de materiais/pecas sugeridas (ex: Gabriel criou pecas para concessionarias da Hyundai)
  - Videos tutoriais especificos

#### Regras de Classificacao

- Bugs/reclamacoes sobrepoem tudo: cliente em Crescimento com bug vai para Alerta independente das metricas
- 1 bug = Alerta, 2+ bugs = Resgate
- Carencia de 7 dias antes de mudar playbook (exceto para Resgate que e imediato)
- Saida do Resgate: completar roadmap + criterios de recuperacao

#### Templates de Email

- Criados em 3 idiomas: Portugues, Espanhol e Ingles
- Ingles pode ficar para depois (reflexo do PT/ES)
- Espanhol precisa ser mais direto (cultura LATAM nao gosta de rodeios)
- Portugues tende a ser mais florido
- Emails devem parecer pessoais, NAO marketing (sem GIF, sem design elaborado, sem formatacao de email marketing)
- Templates sao base, time deve personalizar com o jeito de cada um falar
- Futuro: IA vai personalizar emails usando historico de trades e classificacao do cliente

#### Funcionalidades do CS Hub Demonstradas

- Graficos de 60 dias de uso na pagina do cliente
- Metricas de 30 dias no header
- Copiar destinatarios (puxa todos usuarios do cliente, com classificacao ativo/inativo/stakeholder)
- Objetivo: eliminar trabalho manual de copiar emails um a um (ex: 32 emails)

#### Fluxo de Trabalho Proposto

1. Fluxos rodam de madrugada para as 9h ja ter tudo pronto
2. CS chega no ClickUp, ve as tarefas do dia (playbook X, etapa Y, cliente Z)
3. Abre CS Hub para copiar template de email e destinatarios
4. Envia pelo Gmail
5. Respostas aparecem no CS Hub como interacoes
6. CS avalia se segue no playbook ou ajusta (ex: cliente ja respondeu na trade)

### Problemas Levantados

#### Processo de Bugs Quebrado (critico)
- **Historico de responsaveis:** Gabriel Magro (saiu) -> Magda -> Wai (ferias) -> terceira pessoa (saiu) -> Wai (voltou e saiu)
- **Situacao atual:** Ninguem e dono oficial do processo
- **Formulario do ClickUp:** Cesar confirma que "vai pro limbo", ninguem tem acesso
- **Workaround:** Time manda bugs direto pro Odai (CTO) ou Paulo via WhatsApp
- **Cesar:** "Do jeito que ta hoje, a gente nao tem como extrair metrica"
- **Necessidade:** Registrar quantidade de bugs, resolucao, tempo, para ter metricas

#### Rafael Sugere Classificacao de Severidade de Bugs
- Diferenciar bugs que quebram a plataforma vs botao que nao funciona
- Registrar tempo de resolucao
- Documentar bugs recorrentes para resolucao mais rapida
- Bug recorrente mais comum: **fontes** (tudo que nao e Google Fonts da problema - fontes proprietarias das marcas)
- Workarounds existem para alguns bugs mas usuario nao sabe (CS ensina a contornar)

#### Novo Deploy da Plataforma Trakto
- Nova versao recem lancada com muitas mudancas
- Resolveu alguns bugs antigos mas trouxe novos
- Paulo apresentou Analytics e Campaign Manager para Madeira Madeira (primeira vez)

### Acoes Definidas

- [ ] Time analisar templates de email e deixar comentarios no Google Docs
- [ ] Vale e Nati Montiel revisarem espanhol dos templates
- [ ] Reuniao sexta-feira (13/02) para consolidar feedback
- [ ] Pos-carnaval: implementar playbooks na plataforma e comecar testes
- [ ] Separar 4 clientes (1 por nivel) para testar playbooks
- [ ] Cesar criar pasta no Drive com apresentacoes importantes do Paulo (Banco Inter = editor completo, Madeira Madeira = Analytics)
- [ ] Nati Montiel criar doc com passos para Campaign Manager (baseado no video da Madeira Madeira)

---

## Reuniao 2 - 13/02/2026

**Participantes:** Marina Barros, Valeria Bendezu, Rafael Nascimento, Natalia Santos, Nathalia Montiel, Gabriel Aguiar
**Ausente:** Cesar Oliveira (acompanha por transcricao)
**Tema:** Fechamento pre-carnaval, feedback dos templates e duvidas do processo

### Esclarecimentos Importantes

#### "Dias Ativos" = Dentro do Periodo de 30 Dias (nao consecutivos)
- Valeria perguntou se 3-7 dias ativos era continuo
- Marina esclareceu: sao dias PONTUAIS dentro dos ultimos 30 dias, nao consecutivos
- **Acao necessaria no CS Hub:** Deixar mais claro na interface que "dias ativos" refere-se ao periodo de 30 dias

#### CS Hub vs ClickUp - Divisao de Responsabilidades
- Natalia Santos perguntou: "quando a gente tiver usando o CS Hub, qual a parte do ClickUp?"
- **CS Hub:** Analise, monitoramento, perfil do cliente, metricas, historico de interacoes, templates
- **ClickUp:** Tarefas diarias, lembretes, acoes do playbook, checklist do que fazer no dia
- Exemplo: ClickUp mostra "Hoje voce precisa mandar email X para cliente Y (etapa Z do playbook de Alerta)"
- CS Hub e onde voce vai buscar o template, copiar destinatarios e analisar o perfil
- Interacoes registradas no ClickUp puxam automaticamente para o CS Hub

### Problemas Identificados

#### Thresholds de Saude Muito Baixos (urgente)
- Marina testou e percebeu que clientes mudam de faixa 3-4 vezes no mes
- Isso torna os playbooks impraticaveis (mal inicia um e ja precisa trocar)
- **Decisao:** Aumentar thresholds ANTES de iniciar testes, principalmente dias de ativacao
- Necessidade de ja implementar a estrategia de "tornar mais dificil chegar em Crescimento"

#### Emails Promocionais Poluindo Threads
- Times de marketing dos clientes usam mesmas contas que trocam emails com CS
- Emails promocionais (disparos em massa) estao entrando como threads de comunicacao
- Exemplo: usuario de marketing do cliente usado para disparar campanhas gera threads falsas

#### Processo de Bugs Continua Quebrado
- Valeria confirma que nao sabe para quem mandar bugs (Odai? Paulo? Formulario?)
- "Eu reportava para Magda, depois para Wy, ai eu decidi mandar tudo diretamente para Dair"
- CS Hub tem formulario de bugs mas time ainda nao usa
- Valeria encontrou muitos bugs na nova versao ao criar campanhas para onboardings novos
- **Decisao:** Por enquanto continuar mandando para Odai. Marina vai reorganizar o processo

#### Previsao de Tempo de Resolucao de Bugs
- Valeria alerta: "Na minha experiencia, previsoes de tempo de resolucao de bugs nunca sao certas"
- "Eu acho ate perigoso colocar porque o cliente fica atras e a gente acaba dando uma imagem ruim quando nao cumpre os prazos"
- **Decisao:** NAO incluir previsao de tempo nos templates de email de bugs ate o processo de dev estar maduro

### Ideias Novas

#### Aba de Rally no CS Hub
- Marina propos criar uma aba especifica para acompanhar rallys (entregas de pecas para clientes)
- Puxaria threads de email do rally + transcricoes de calls
- IA geraria relatorio automatico (interacoes, modificacoes, entregas)
- Gabriel aprovou: "ia ajudar muito"
- Util especialmente para clientes complexos como Amazon (Black Friday = muitas campanhas e entregas)

#### Emails Personalizados com IA (futuro)
- Com historico de trades, emails trocados e classificacao do cliente
- IA cria email personalizado com objetivo especifico do playbook
- Preenche destinatarios corretos automaticamente
- Precisa de mais dados antes de implementar

### Decisoes Tomadas

#### Carnaval (17-18/02/2026)
- Segunda e terca: 100% off
- Quarta: volta acompanhando emails e demandas urgentes
- Quinta: volta 100%
- Todos devem colocar aviso de ausencia no email
- Vale e Nati Montiel comunicar clientes LATAM (Ines e Caro) sobre feriado

#### Proximos Passos Pos-Carnaval
- Quinta ou sexta pos-carnaval: reuniao para separar clientes e iniciar testes
- Testar playbooks com ~4 clientes (1 por nivel de saude)
- Cada CS fica responsavel por acompanhar 1 cliente no teste
- Foco inicial nos clientes em Resgate e Alerta
- Rafael foca em estrategia de onboarding (nao entra nos playbooks por enquanto)
- Montar lista de acoes pre-aprovadas que CS pode oferecer ao cliente

#### Rally
- Gabriel voltou a receber rallys (Amazon, entre outros)
- Marina vai pedir audio do Gabriel explicando processo do rally para alimentar IA
- Materiais de referencia: videos do Paulo (Banco Inter, Madeira Madeira)

---

## Consolidado - Itens de Acao para o CS Hub

### Prioridade Alta (antes dos testes)

| # | Item | Contexto |
|---|------|----------|
| 1 | **Aumentar thresholds de classificacao** | Clientes mudam de faixa 3-4x no mes. Thresholds atuais muito baixos, especialmente para Crescimento |
| 2 | **Melhorar fluxo de report de bugs** | Processo quebrado, sem dono, sem metricas. CS Hub tem formulario mas nao esta sendo usado |
| 3 | **Filtrar emails promocionais** | Emails marketing dos proprios clientes poluem threads. Times de mkt usam mesmas contas |
| 4 | **Clarificar "dias ativos" na UI** | Valeria achou que era consecutivo. Precisa tooltip ou descricao clara |
| 5 | **Remover previsao de tempo de bugs dos templates** | Valeria: "nunca sao certas, perigoso colocar" |

### Prioridade Media (pos-testes iniciais)

| # | Item | Contexto |
|---|------|----------|
| 6 | **Lista de acoes pre-aprovadas para Resgate** | CS precisa saber o que pode oferecer sem validar internamente (calls, treinamentos, materiais) |
| 7 | **Mapeamento de sazonalidade por segmento** | Time sabe de cabeca mas nao esta documentado. Precisa retroalimentar CS Hub |
| 8 | **Classificacao de severidade de bugs** | Rafael sugeriu. Ja planejado para V3 (decisao 27 do CLAUDE.md) |
| 9 | **Integracao com time de Vendas (Teness)** | Clientes em Crescimento devem ser sinalizados para Teness entrar nas calls |

### Prioridade Baixa (futuro)

| # | Item | Contexto |
|---|------|----------|
| 10 | **Aba de Rally no CS Hub** | Acompanhar entregas de pecas, gerar relatorios com IA. Gabriel aprovou |
| 11 | **Emails personalizados com IA** | Usar historico de trades + classificacao para gerar emails sob medida |
| 12 | **Modulos de onboarding online** | Diferente de tutoriais curtos (1-2min). Formato curso com introducao, tutoriais, fechamento |
| 13 | **Relatorio automatico de rally** | IA analisa trades + transcricoes + planilhas para gerar relatorio de entregas |

---

## Insights sobre o Time

### Perfil dos Membros

| Membro | Perfil | Observacoes |
|--------|--------|-------------|
| **Cesar Oliveira** | CS senior, conhece a plataforma profundamente | Sabe diferenciar bugs novos vs antigos, contato direto com devs |
| **Gabriel Aguiar** | CS senior, especialista em rallys e grandes contas | Fez resgate da Editora do Brasil (calls semanais por meses), Hyundai (pecas personalizadas) |
| **Valeria Bendezu** | CS, foco em clientes LATAM | Comunicacao com Ines (Chile) e Caro (Mexico), experiencia com processo de bugs |
| **Natalia Santos** | CS, participou de apresentacoes com Paulo | Conhece features novas, referencia para Campaign Manager |
| **Nathalia Montiel** | CS, foco em clientes LATAM (espanhol) | Comunicacao em espanhol, testes de features para clientes |
| **Rafael Nascimento** | CS novo, em fase de aprendizagem | Precisa de documentacao, nao pegou o "antes e depois" da plataforma |

### Dinamicas Observadas

- Time ja faz muitas das acoes propostas nos playbooks, mas de forma nao documentada e inconsistente
- Conhecimento concentrado em Cesar e Gabriel (seniors). Novatos (Rafael, Nathalias) precisam de guia estruturado
- Proatividade e um ponto sensivel: validar internamente antes de responder ao cliente passa impressao de falta de proatividade
- Cultura de comunicacao: emails da equipe devem ser pessoais e diretos, nunca parecer email marketing automatizado
- Bugs de fontes sao o calcanhar de Aquiles historico da Trakto

### Casos de Referencia

- **Hyundai (Gabriel):** Resgate com criacao de pecas + treinamento recorrente para concessionarias
- **Editora do Brasil (Gabriel):** Resgate com calls semanais por 2-3 meses (white label). Picos de uso nos dias de call, queda depois. Terminou em cancelamento
- **Amazon (Gabriel):** Cliente complexo com rallys de Black Friday, agencia caotica
- **Madeira Madeira (Cesar):** Primeiro cliente a ver demo de Analytics/Campaign Manager do Paulo
- **Banco Inter (Paulo):** Apresentacao completa do editor, referencia para onboarding

---

## Notas Tecnicas para Implementacao

### Sobre os Thresholds

Valores atuais no CS Hub (muito baixos segundo Marina):
- Crescimento: 20 dias ativos, score 100+
- Estavel: 8-19 dias, score 30-99
- Alerta: 3-7 dias, score 5-29
- Resgate: 0-2 dias, score 0-4

**Recomendacao da reuniao:** Aumentar especialmente os dias de ativacao para evitar trocas frequentes de faixa. Tornar mais dificil entrar em Crescimento.

### Sobre Emails Promocionais

Os times de marketing/design dos clientes sao os mesmos que usam a Trakto. Quando disparam campanhas em massa, esses emails entram como threads no CS Hub. Necessario:
- Identificar padroes de emails em massa (muitos destinatarios, conteudo HTML pesado)
- Possivelmente filtrar por volume de destinatarios ou conteudo tipico de marketing

### Sobre o Processo de Bugs

Fluxo ideal proposto:
1. CS identifica bug (proprio ou reportado pelo cliente)
2. Registra no CS Hub (formulario de bugs)
3. CS Hub envia para planilha/sistema estruturado
4. Time de dev (Odai) recebe com todas as informacoes (video, descricao, cliente impactado, n. de usuarios)
5. CS cobra resolucao usando dados do CS Hub ("X bugs registrados desde dia Y, Z usuarios impactados")

### Sobre Campaign Manager

- Paulo apresentou pela primeira vez para Madeira Madeira
- Cliente precisa autenticar com a mesma conta do Google Ads/Campaign Manager
- CS nao consegue demonstrar com dados do cliente (autenticacao e do cliente)
- Pode demonstrar com dados fakes na dashboard geral
- Nati Montiel vai criar documento com passos para orientar clientes
