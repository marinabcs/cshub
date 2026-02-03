# ROADMAP V2 - CS Hub

**Criado em:** 02/02/2026
**Atualizado em:** 03/02/2026
**Objetivo:** Lista de implementações para discussão com o time
**Status:** Aguardando priorização

---

## 1. QUALIDADE DE DADOS E FUNDACAO (Prioridade Alta)

> Itens que melhoram a base de dados existente e habilitam funcionalidades futuras.

### 1.1 Melhorar filtros de email / conversas
**Status:** Pendente
**Prioridade:** ALTA - Impacto direto na operação diária

**Problema:**
- Emails de lixo (newsletters, notificações automáticas, spam) estão entrando nas conversas com clientes
- Polui a análise de sentimento e classificação da IA
- CS perde tempo filtrando manualmente

**O que fazer:**
- [ ] Criar lista de remetentes/domínios bloqueados (blacklist)
- [ ] Filtrar por padrões comuns (noreply@, newsletter@, marketing@, unsubscribe)
- [ ] Ignorar emails com headers de auto-reply/bulk/list
- [ ] Adicionar filtro por palavras-chave no assunto (ex: "unsubscribe", "newsletter")
- [ ] Interface em Configurações para gerenciar a blacklist
- [ ] Opção de marcar manualmente como "não relevante" para treinar o filtro

### 1.2 Campos de observação do CS (notas para contexto da IA)
**Status:** Pendente
**Prioridade:** ALTA - Enriquece a análise da IA

**Problema:**
- Após uma call ou reunião, o CS tem informações importantes que a IA não conhece
- A IA analisa o cliente sem contexto qualitativo (ex: "cliente mencionou que vai trocar de plano", "está insatisfeito com feature X")

**O que fazer:**
- [ ] Adicionar campo "Observações do CS" na ficha do cliente (textarea com histórico)
- [ ] Cada observação com data, autor e texto
- [ ] Incluir observações no prompt da IA ao classificar threads e calcular segmentação
- [ ] Permitir marcar observação como "ativa" ou "resolvida"
- [ ] Exibir observações recentes no detalhe do cliente e no painel da thread

### 1.3 Segmentação de empresas por área de atuação
**Status:** Pendente
**Prioridade:** ALTA - Pré-requisito para análise de sazonalidade

**O que fazer:**
- [ ] Adicionar campo `area_atuacao` na collection `clientes`
- [ ] Lista de áreas: Aviação, Telecomunicações, Varejo, Educação, Saúde, Financeiro, Tecnologia, Indústria, Governo, Alimentação, Imobiliário, Outros
- [ ] Select no formulário de cliente (criação e edição)
- [ ] Filtro por área na lista de clientes
- [ ] Permitir edição em lote (selecionar vários clientes e atribuir área)
- [ ] Migração: adicionar campo nos clientes existentes (valor padrão: null/não definido)

---

## 2. SEGURANCA (Prioridade Alta - Aguardando time)

> Itens que dependem de decisão/alinhamento com o time.

### 2.1 Migrar APIs para Cloud Functions
**Status:** Aguardando feedback do time
**Custo estimado:** $0-1/mês (free tier cobre maior parte)
**Requisito:** Ativar plano Blaze no Firebase

**O que fazer:**
- [ ] Criar Cloud Function `classificarThreadIA` (proxy OpenAI)
- [ ] Criar Cloud Function `criarTarefaClickUp` (proxy ClickUp)
- [ ] Criar Cloud Function `buscarMembrosClickUp` (proxy ClickUp)
- [ ] Mover chaves para Firebase Secrets
- [ ] Atualizar frontend para chamar as Functions
- [ ] Remover VITE_OPENAI_API_KEY e VITE_CLICKUP_API_KEY do .env

**Por que:**
- Chaves de API atualmente ficam expostas no bundle JavaScript
- Qualquer pessoa pode extrair e usar nossas chaves
- Risco de consumo indevido da quota OpenAI

### 2.2 Validação de inputs (Zod)
**Status:** Pendente
**Custo:** Nenhum (biblioteca Zod é gratuita)

**O que fazer:**
- [ ] Instalar Zod (`npm install zod`)
- [ ] Criar schemas de validação para formulários (clientes, alertas, threads)
- [ ] Validar dados antes de enviar ao Firestore
- [ ] Mensagens de erro claras para o usuário

### 2.3 Rate Limiting
**Status:** Pendente (depende de 2.1)
**Custo:** Depende da implementação

**O que fazer:**
- [ ] Implementar rate limiting nas Cloud Functions
- [ ] Limitar chamadas por usuário/IP

---

## 3. ENRIQUECIMENTO DE DADOS (Prioridade Média-Alta)

> Funcionalidades que adicionam contexto e profundidade aos dados dos clientes.

### 3.1 Busca de perfil online dos contatos
**Status:** Pendente
**Dependência:** Nenhuma

**O que fazer:**
- [ ] Adicionar campos de contato na ficha do cliente: nome do contato, cargo, LinkedIn URL, email
- [ ] Suporte a múltiplos contatos por empresa (decisor, operacional, financeiro)
- [ ] Busca automática de dados via LinkedIn (avaliar APIs: Proxycurl, RocketReach, ou scraping permitido)
- [ ] Exibir foto, cargo atual e empresa no card do contato
- [ ] Enriquecer contexto da IA com informações do contato (ex: "falar com diretor vs analista")

**Considerações:**
- APIs de LinkedIn têm custo (~$0.01-0.03 por lookup)
- Alternativa manual: CS preenche os dados após primeira call
- LGPD: armazenar apenas dados profissionais públicos

### 3.2 Registro e gestão de reuniões
**Status:** Pendente
**Dependência:** Nenhuma

**O que fazer:**
- [ ] Criar collection `reunioes` no Firestore (cliente_id, data, participantes, tipo, notas, gravacao_url, transcricao)
- [ ] Formulário para registrar reunião (data, participantes, pauta, resultado)
- [ ] Registro automático via integração com Google Calendar / Outlook (futuro)
- [ ] Timeline de reuniões na ficha do cliente
- [ ] Métricas: frequência de reuniões por cliente, tempo desde última reunião

### 3.3 Upload de gravações e transcrições de reuniões
**Status:** Pendente
**Dependência:** 3.2 (Registro de reuniões)

**O que fazer:**
- [ ] Upload de áudio/vídeo para Firebase Storage (limitar tamanho: 500MB)
- [ ] Transcrição automática via API (Whisper/OpenAI ou Google Speech-to-Text)
- [ ] Player de áudio/vídeo embutido na ficha da reunião
- [ ] Resumo automático da transcrição via IA (pontos-chave, ação items, sentimento)
- [ ] Busca por conteúdo nas transcrições
- [ ] Alimentar observações do CS automaticamente com insights da transcrição

**Custos estimados:**
- Firebase Storage: ~$0.026/GB/mês
- Whisper API: ~$0.006/minuto de áudio
- Google Speech-to-Text: ~$0.006-0.024/minuto

---

## 4. INTELIGENCIA E ANALYTICS (Prioridade Média)

> Funcionalidades que geram insights a partir dos dados enriquecidos.

### 4.1 Análise de uso por área de atuação + Predição de sazonalidade
**Status:** Pendente
**Dependência:** 1.3 (Segmentação por área de atuação)

**Objetivo:** Entender padrões sazonais por segmento de mercado e prever o melhor momento para abordagem proativa.

**O que fazer:**
- [ ] Filtro por área de atuação em todas as abas do Analytics
- [ ] Dashboard de sazonalidade: gráfico de uso ao longo do ano por área
- [ ] Detectar padrões (ex: Educação = pico jan-mar, Varejo = pico nov-dez)
- [ ] Calcular "janela de abordagem ideal" (X dias antes do pico de sazonalidade)
- [ ] Alertas automáticos: "Cliente [nome] (Varejo) - sazonalidade em 30 dias, agendar contato"
- [ ] Comparativo: uso real vs. padrão esperado para a área (identificar anomalias)

**Exemplos de sazonalidade:**
| Área | Período de pico | Abordagem ideal |
|------|----------------|-----------------|
| Educação | Janeiro-Março (volta às aulas) | Novembro-Dezembro |
| Varejo | Novembro (Black Friday) / Dezembro (Natal) | Setembro-Outubro |
| Financeiro | Janeiro (planejamento anual) | Novembro-Dezembro |

**Considerações:**
- Precisa de pelo menos 1 ano de dados históricos para predições confiáveis
- Inicialmente configuração manual das sazonalidades por área, depois machine learning

### 4.2 Melhorias no Analytics
**Status:** A definir com o time

**Possíveis melhorias:**
- [ ] Exportar relatórios (PDF/Excel)
- [ ] Filtros por período personalizados
- [ ] Comparativo entre períodos
- [ ] Dashboards customizáveis

### 4.3 Testes das funcionalidades existentes
**Status:** Pendente

**O que testar:**
- [ ] Analytics - todas as 5 abas
- [ ] Alertas - criação automática e manual
- [ ] Playbooks - execução completa
- [ ] Segmentação CS - cálculo e classificação
- [ ] Integração ClickUp - sincronização bidirecional

---

## 5. PERFORMANCE (Prioridade Média)

### 5.1 Paginação em listas grandes
**Status:** Pendente
**Custo:** Nenhum

**Páginas afetadas:**
- [ ] Lista de Clientes
- [ ] Analytics (todas as abas)
- [ ] Lista de Alertas
- [ ] Lista de Threads

**O que fazer:**
- [ ] Implementar paginação com `startAfter` do Firestore
- [ ] Adicionar controles de navegação (anterior/próximo)
- [ ] Limitar 20-50 itens por página

### 5.2 Cache client-side
**Status:** Pendente
**Custo:** Nenhum

**O que fazer:**
- [ ] Implementar cache para dados que mudam pouco (ex: lista de clientes)
- [ ] Usar React Query ou SWR para gerenciamento de cache
- [ ] Definir tempo de expiração por tipo de dado

### 5.3 Lazy Loading de componentes
**Status:** Pendente
**Custo:** Nenhum

**O que fazer:**
- [ ] Usar `React.lazy()` para páginas pesadas
- [ ] Implementar `Suspense` com loading states
- [ ] Code splitting por rota

---

## 6. FUNCIONALIDADES ADICIONAIS (Prioridade Média-Baixa)

### 6.1 Notificações
**Status:** A definir

**Opções:**
- [ ] Notificações in-app (badge, toast)
- [ ] Email para alertas críticos
- [ ] Integração Slack/Discord
- [ ] Push notifications (PWA)

### 6.2 Multi-tenant / Multi-usuário
**Status:** A definir

**O que avaliar:**
- [ ] Controle de acesso por papel (admin, CS, viewer)
- [ ] Permissões granulares
- [ ] Audit log por usuário

---

## 7. UX/UI (Prioridade Baixa)

### 7.1 Responsividade mobile
**Status:** A verificar

- [ ] Testar todas as páginas em mobile
- [ ] Ajustar layouts que não funcionam bem
- [ ] Menu mobile (hamburger)

### 7.2 Dark/Light mode
**Status:** Opcional

- [ ] Implementar toggle de tema
- [ ] Salvar preferência do usuário

### 7.3 Onboarding
**Status:** A definir

- [ ] Tour guiado para novos usuários
- [ ] Tooltips explicativos
- [ ] Checklist de configuração inicial

---

## 8. INFRAESTRUTURA (Prioridade Baixa)

### 8.1 CI/CD
**Status:** Opcional

- [ ] GitHub Actions para build automático
- [ ] Deploy automático no Firebase Hosting
- [ ] Testes automatizados antes do deploy

### 8.2 Monitoramento
**Status:** Opcional

- [ ] Firebase Crashlytics
- [ ] Logging estruturado
- [ ] Alertas de erro

### 8.3 Backup
**Status:** A definir

- [ ] Backup automático do Firestore
- [ ] Estratégia de recuperação

---

## ORDEM SUGERIDA DE IMPLEMENTACAO

### Sprint 1 - Fundação e qualidade de dados
1. Melhorar filtros de email/conversas (1.1)
2. Campos de observação do CS para IA (1.2)
3. Segmentação de empresas por área de atuação (1.3)
4. Testar funcionalidades existentes (4.3)

### Sprint 2 - Segurança + Validação
5. Migrar APIs para Cloud Functions (2.1) *(aguardando time)*
6. Validação de inputs com Zod (2.2)
7. Rate Limiting (2.3)

### Sprint 3 - Enriquecimento de dados
8. Busca de perfil online dos contatos (3.1)
9. Registro e gestão de reuniões (3.2)
10. Upload de gravações e transcrições (3.3)

### Sprint 4 - Inteligência e performance
11. Análise por área de atuação + sazonalidade (4.1)
12. Melhorias no Analytics (4.2)
13. Paginação em listas (5.1)

### Sprint 5 - Polish
14. Cache client-side (5.2)
15. Lazy Loading (5.3)
16. Notificações (6.1)
17. Responsividade mobile (7.1)

### Futuro (V2.1+)
18. Multi-usuário com permissões (6.2)
19. CI/CD (8.1)
20. Monitoramento avançado (8.2)
21. Dark/Light mode (7.2)
22. Onboarding (7.3)

---

## NOTAS DA REUNIAO

_Espaço para anotar decisões do time:_

**Participantes:**
-

**Decisões:**
-

**Prioridades definidas:**
1.
2.
3.

**Próximos passos:**
-

---

## ESTIMATIVA DE CUSTOS V2

| Item | Custo Mensal Estimado |
|------|----------------------|
| Cloud Functions (Blaze) | $0 - $1 |
| Firebase Hosting | $0 (free tier) |
| Firestore | $0 - $5 (depende do uso) |
| Firebase Storage (gravações) | $0 - $10 (depende do volume) |
| OpenAI API (classificação + transcrição) | $10 - $30 (depende do uso) |
| ClickUp | $0 (usa plano existente) |
| API de perfil (LinkedIn/Proxycurl) | $0 - $20 (depende de lookups) |
| **Total estimado** | **$10 - $66/mês** |

*Valores podem variar conforme uso real. Muitos itens novos podem começar com input manual (custo $0) e automatizar depois.*
