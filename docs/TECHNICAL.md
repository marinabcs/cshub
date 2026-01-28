# CS Hub - Documentação Técnica

**Versão:** 1.0
**Última atualização:** Janeiro 2026
**Stack:** React 18 + Vite + Firebase Firestore + Recharts

---

## Índice

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Estrutura de Diretórios](#2-estrutura-de-diretórios)
3. [Modelo de Dados (Firebase Collections)](#3-modelo-de-dados-firebase-collections)
4. [Services (Camada de Dados)](#4-services-camada-de-dados)
5. [Hooks Customizados](#5-hooks-customizados)
6. [Páginas e Componentes](#6-páginas-e-componentes)
7. [Scripts de Jobs Agendados](#7-scripts-de-jobs-agendados)
8. [Sistema de Health Score](#8-sistema-de-health-score)
9. [Classificação de Threads com IA](#9-classificação-de-threads-com-ia)
10. [Otimizações de Performance](#10-otimizações-de-performance)
11. [Variáveis de Ambiente](#11-variáveis-de-ambiente)
12. [Setup e Deploy](#12-setup-e-deploy)

---

## 1. Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                        │
├─────────────────────────────────────────────────────────────────┤
│  Pages          │  Components      │  Hooks                     │
│  - Dashboard    │  - Cards         │  - useHealthScore          │
│  - Clientes     │  - Charts        │  - useClassificarThread    │
│  - Analytics    │  - Modals        │  - useRetention            │
│  - Alertas      │  - Timeline      │  - useAuditoria            │
└────────┬────────┴────────┬─────────┴────────┬───────────────────┘
         │                 │                  │
         ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICES (Camada de Dados)                 │
├─────────────────────────────────────────────────────────────────┤
│  api.js            │  healthScoreService.js  │  openai.js       │
│  firebase.js       │  auditService.js        │  emailValidation │
│  retentionService  │  threadMatcher.js       │  emailCleaner    │
└────────────────────┴─────────────┬───────────┴──────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FIREBASE FIRESTORE                         │
├─────────────────────────────────────────────────────────────────┤
│  Collections:                                                   │
│  - clientes          - threads           - alertas              │
│  - mensagens         - metricas_diarias  - usuarios_lookup      │
│  - auditoria         - health_history    - usuarios_sistema     │
└─────────────────────────────────────────────────────────────────┘
```

### Fluxo de Dados Principal

1. **Ingestão de Emails** → Cloud Function processa emails do Gmail
2. **Criação de Threads** → Mensagens agrupadas em threads na collection `threads`
3. **Classificação IA** → OpenAI classifica categoria/sentimento
4. **Alertas Automáticos** → Sistema cria alertas para situações críticas
5. **Cálculo de Health Score** → Job diário calcula score de cada cliente
6. **Visualização** → Dashboard exibe métricas e permite ações

---

## 2. Estrutura de Diretórios

```
cshub/
├── src/
│   ├── components/           # Componentes reutilizáveis
│   │   ├── Auditoria/
│   │   │   └── HistoricoTimeline.jsx
│   │   ├── Cliente/
│   │   │   ├── HeavyUsersCard.jsx
│   │   │   ├── PlaybooksSection.jsx
│   │   │   └── ThreadsTimeline.jsx
│   │   └── Layout/
│   │       └── Sidebar.jsx
│   │
│   ├── hooks/                # React Hooks customizados
│   │   ├── useClassificarThread.js
│   │   ├── useHealthScore.js
│   │   └── useRetention.js
│   │
│   ├── pages/                # Páginas da aplicação
│   │   ├── Dashboard.jsx
│   │   ├── Clientes.jsx
│   │   ├── ClienteDetalhe.jsx
│   │   ├── Analytics.jsx     # 5 abas: Uso, Conversas, Usuários, Vendas, Churn
│   │   └── Alertas.jsx
│   │
│   ├── services/             # Camada de acesso a dados
│   │   ├── api.js            # Funções principais do Firebase
│   │   ├── firebase.js       # Configuração do Firebase
│   │   ├── openai.js         # Integração com OpenAI
│   │   ├── healthScoreService.js
│   │   ├── auditService.js
│   │   ├── retentionService.js
│   │   └── emailValidation.js
│   │
│   ├── utils/                # Utilitários
│   │   ├── healthScore.js    # Helpers de formatação
│   │   ├── emailCleaner.js   # Limpeza de conteúdo de email
│   │   └── threadMatcher.js  # Matching de threads
│   │
│   ├── scripts/              # Jobs agendados (rodar via cron/Cloud Scheduler)
│   │   ├── calcularHealthScoreDiario.js
│   │   └── retentionJob.js
│   │
│   ├── App.jsx
│   └── main.jsx
│
├── docs/
│   └── TECHNICAL.md          # Esta documentação
│
├── .env                      # Variáveis de ambiente (não commitado)
├── .env.example              # Template de variáveis
├── package.json
├── vite.config.js
└── CLAUDE.md                 # Diretrizes de estilo CSS
```

---

## 3. Modelo de Dados (Firebase Collections)

### 3.1 `clientes`
Representa uma empresa/cliente do CS Hub.

```javascript
{
  id: "cliente_abc123",              // ID do documento (auto-gerado ou team_id)
  team_name: "Empresa XYZ",          // Nome do cliente
  team_type: "enterprise",           // Tipo: enterprise, business, starter
  status: "ativo",                   // ativo, onboarding, aviso_previo, inativo, cancelado

  // Responsável CS
  responsavel_nome: "Marina Silva",
  responsavel_email: "marina@empresa.com",

  // Health Score (calculado diariamente)
  health_score: 75,                  // 0-100
  health_status: "atencao",          // saudavel (80+), atencao (60-79), risco (40-59), critico (<40)
  health_score_trend: -5,            // Tendência vs semana anterior
  health_componentes: {
    engajamento: 80,
    sentimento: 70,
    tickets_abertos: 65,
    tempo_sem_contato: 85,
    uso_plataforma: 75
  },

  // Times vinculados (IDs dos times no Slack/sistema origem)
  times: ["T001", "T002"],

  // Timestamps
  created_at: Timestamp,
  updated_at: Timestamp,
  ultimo_contato: Timestamp,
  ultima_interacao: Timestamp
}
```

### 3.2 `threads`
Conversas agrupadas por thread (collection raiz - arquitetura otimizada).

```javascript
{
  id: "thread_xyz789",
  thread_id: "gmail_thread_id",      // ID original do Gmail
  team_id: "T001",                   // ID do time (para queries)

  // Conteúdo
  subject: "Problema com exportação de PDF",
  snippet: "Estamos com dificuldade...",

  // Participantes
  participantes: ["cliente@email.com", "suporte@empresa.com"],
  ultimo_remetente: "cliente@email.com",

  // Classificação (preenchido pela IA ou manual)
  categoria: "problema_tecnico",     // erro_bug, problema_tecnico, feedback, duvida_pergunta, solicitacao, outro
  sentimento: "negativo",            // positivo, neutro, negativo, urgente
  resumo_ia: "Cliente relata erro ao exportar PDF em formato A3",
  classificado_em: Timestamp,
  classificado_por: "ia",            // "ia" ou "manual"

  // Status
  status: "aguardando_equipe",       // aguardando_equipe, aguardando_cliente, resolvido

  // Timestamps
  created_at: Timestamp,
  updated_at: Timestamp,

  // Contadores
  message_count: 5
}
```

**Categorias disponíveis:**
| Valor | Label | Cor | Descrição |
|-------|-------|-----|-----------|
| `erro_bug` | Erro/Bug | #EF4444 | Cliente reportou erro no sistema |
| `problema_tecnico` | Problema Técnico | #F97316 | Dificuldade técnica ou configuração |
| `feedback` | Feedback | #10B981 | Sugestão, elogio ou crítica |
| `duvida_pergunta` | Dúvida/Pergunta | #8B5CF6 | Pergunta sobre funcionalidade |
| `solicitacao` | Solicitação | #3B82F6 | Pedido de feature ou ajuda |
| `outro` | Outro | #64748B | Não se encaixa nas anteriores |

**Sentimentos disponíveis:**
| Valor | Label | Cor | Descrição |
|-------|-------|-----|-----------|
| `positivo` | Positivo | #10B981 | Cliente satisfeito |
| `neutro` | Neutro | #64748B | Conversa normal |
| `negativo` | Negativo | #EF4444 | Cliente insatisfeito |
| `urgente` | Urgente | #DC2626 | Problema crítico, atenção imediata |

### 3.3 `mensagens`
Mensagens individuais de cada thread.

```javascript
{
  id: "msg_001",
  thread_id: "thread_xyz789",        // Referência à thread
  message_id: "gmail_message_id",    // ID original do Gmail (para deduplicação)

  // Conteúdo
  de: "cliente@email.com",
  para: ["suporte@empresa.com"],
  assunto: "Re: Problema com exportação",
  corpo: "O erro continua acontecendo...",
  corpo_limpo: "O erro continua...",  // Sem assinaturas/quotes

  // Timestamp
  data: Timestamp
}
```

### 3.4 `alertas`
Alertas automáticos ou manuais que requerem ação.

```javascript
{
  id: "alerta_001",

  // Tipo e conteúdo
  tipo: "sentimento_negativo",       // sentimento_negativo, erro_bug, inatividade, churn_risk
  titulo: "Sentimento URGENTE detectado: Empresa XYZ",
  mensagem: "Cliente reportou problema crítico com exportação",

  // Prioridade e status
  prioridade: "urgente",             // baixa, media, alta, urgente
  status: "pendente",                // pendente, em_andamento, resolvido

  // Referências
  time_id: "T001",
  time_name: "Empresa XYZ",
  cliente_id: "cliente_abc123",
  thread_id: "thread_xyz789",

  // Responsável
  responsavel_email: "marina@empresa.com",
  responsavel_nome: "Marina Silva",

  // Timestamps
  created_at: Timestamp,
  updated_at: Timestamp,
  resolved_at: Timestamp | null,
  resolved_by: "usuario@empresa.com" | null
}
```

### 3.5 `metricas_diarias`
Métricas de uso da plataforma por time/dia.

```javascript
{
  id: "T001_2026-01-28",             // {team_id}_{data}
  team_id: "T001",
  data: Timestamp,                   // Data do registro

  // Métricas de uso
  logins: 15,                        // Quantidade de logins no dia
  pecas_criadas: 8,                  // Peças/documentos criados
  downloads: 12,                     // Downloads realizados
  uso_ai_total: 25,                  // Uso de features de IA

  // Por usuário (opcional, para heavy users)
  user_id: "user_123",
  user_email: "joao@cliente.com",
  user_nome: "João Silva"
}
```

### 3.6 `usuarios_lookup`
Usuários dos clientes (para contagem e listagem).

```javascript
{
  id: "user_123",
  team_id: "T001",

  nome: "João Silva",
  email: "joao@cliente.com",
  cargo: "Designer",

  status: "ativo",                   // ativo, inativo
  created_at: Timestamp,
  deleted_at: Timestamp | null
}
```

### 3.7 `auditoria`
Log de todas as ações realizadas no sistema (append-only).

```javascript
{
  id: "audit_001",

  // Ação
  acao: "HEALTH_SCORE_CALCULADO",
  descricao: "Health Score calculado automaticamente",

  // Contexto
  entidade_tipo: "cliente",          // cliente, thread, alerta, usuario
  entidade_id: "cliente_abc123",
  entidade_nome: "Empresa XYZ",

  // Dados da mudança
  dados_anteriores: { health_score: 80 },
  dados_novos: { health_score: 75 },

  // Autor
  usuario_id: "system",              // ou ID do usuário
  usuario_email: "system@cshub",
  usuario_nome: "Sistema",

  // Timestamp
  created_at: Timestamp
}
```

**Ações de auditoria:**
- `CLIENTE_CRIADO`, `CLIENTE_ATUALIZADO`, `CLIENTE_REMOVIDO`
- `HEALTH_SCORE_CALCULADO`, `HEALTH_SCORE_MANUAL`
- `THREAD_CLASSIFICADA_IA`, `THREAD_CLASSIFICADA_MANUAL`
- `ALERTA_CRIADO`, `ALERTA_RESOLVIDO`
- `THREAD_ARQUIVADA`, `ALERTA_ARQUIVADO`

### 3.8 `clientes/{id}/health_history` (Subcollection)
Histórico diário do Health Score de cada cliente.

```javascript
{
  id: "2026-01-28",
  hist_date: Timestamp,
  hist_score: 75,
  hist_status: "atencao",
  hist_componentes: {
    engajamento: 80,
    sentimento: 70,
    tickets_abertos: 65,
    tempo_sem_contato: 85,
    uso_plataforma: 75
  }
}
```

---

## 4. Services (Camada de Dados)

### 4.1 `api.js` - Funções Principais

```javascript
// Clientes
getClientes()                        // Lista todos os clientes
getClienteById(teamId)               // Busca cliente por ID
getClientesByStatus(status)          // Filtra por status
getClientesByResponsavel(email)      // Filtra por responsável
getClientesCriticos(limite)          // Top N clientes com menor health score

// Threads (arquitetura otimizada - collection raiz)
getThreadsByTeam(teamIds)            // Busca threads por array de team_ids
getThreadById(threadId)              // Busca thread específica
getMensagensByThread(threadId)       // Mensagens de uma thread

// Usuários
getUsuariosTime(teamId)              // Usuários de um time
getUsuariosCountByTeam(teamIds)      // Contagem de usuários por time

// Heavy Users
getHeavyUsers(teamIds, days, topN)   // Ranking de usuários mais ativos

// Helpers
timestampToDate(timestamp)           // Converte Firestore Timestamp para Date
```

### 4.2 `healthScoreService.js` - Cálculo do Health Score

```javascript
// Pesos dos componentes (total = 100)
PESOS = {
  ENGAJAMENTO: 25,        // Frequência de interações
  SENTIMENTO: 25,         // Análise de sentimento das conversas
  TICKETS_ABERTOS: 20,    // Quantidade de tickets/alertas pendentes
  TEMPO_SEM_CONTATO: 15,  // Dias desde último contato
  USO_PLATAFORMA: 15      // Métricas de uso (logins, peças, etc)
}

// Funções exportadas
calcularHealthScore(clienteId)       // Calcula score completo
calcularComponenteEngajamento(threads, dias)
calcularComponenteSentimento(threads)
calcularComponenteTickets(alertasPendentes)
calcularComponenteTempoContato(ultimoContato)
calcularComponenteUsoPlataforma(metricas)
determinarStatus(score)              // Retorna: saudavel, atencao, risco, critico
```

### 4.3 `auditService.js` - Sistema de Auditoria

```javascript
// Constantes de ações
ACOES = {
  CLIENTE_CRIADO: 'CLIENTE_CRIADO',
  HEALTH_SCORE_CALCULADO: 'HEALTH_SCORE_CALCULADO',
  THREAD_CLASSIFICADA_IA: 'THREAD_CLASSIFICADA_IA',
  // ... etc
}

// Funções exportadas
registrarAcao(acao, dados)           // Registra ação no log
getHistorico(entidadeTipo, entidadeId, limite)  // Busca histórico
formatarAcaoParaExibicao(registro)   // Formata para UI
```

### 4.4 `retentionService.js` - Política de Retenção

```javascript
// Configuração de retenção
RETENTION_CONFIG = {
  threads: { meses: 12, acao: 'arquivar' },
  alertas_resolvidos: { meses: 6, acao: 'soft_delete' },
  metricas_diarias: { meses: 24, acao: 'deletar' },
  health_history: { meses: 24, acao: 'deletar' },
  auditoria: { meses: null, acao: 'manter' }  // Nunca deletar
}

// Funções exportadas
arquivarThreadsAntigas(mesesAtras)
softDeleteAlertasAntigos(mesesAtras)
limparHealthHistoryAntigo(mesesAtras)
executarPoliticaRetencao(dryRun)     // Executa todas as políticas
gerarRelatorioRetencao()             // Relatório do que será afetado
```

### 4.5 `openai.js` - Classificação com IA

```javascript
// Categorias e sentimentos disponíveis
THREAD_CATEGORIAS = { erro_bug, problema_tecnico, feedback, ... }
THREAD_SENTIMENTOS = { positivo, neutro, negativo, urgente }

// Funções exportadas
classificarThread(conversa)          // Retorna { categoria, sentimento, resumo }
getCategoriaInfo(categoria)          // Metadados da categoria
getSentimentoInfo(sentimento)        // Metadados do sentimento
isOpenAIConfigured()                 // Verifica se API key está configurada
```

### 4.6 `emailValidation.js` - Validação de Emails

```javascript
isValidEmail(email)                  // Validação RFC 5322 básica
normalizeEmail(email)                // Lowercase, trim, remove aliases (+tag)
extractEmailParts(email)             // { local, domain }
isBusinessEmail(email)               // Verifica se é email corporativo
```

### 4.7 `threadMatcher.js` - Matching de Threads

```javascript
// Estratégias de matching (em ordem de prioridade)
MATCH_STRATEGIES = [
  'thread_id',        // Match exato por thread_id do Gmail
  'in_reply_to',      // Header In-Reply-To
  'references',       // Header References
  'subject',          // Assunto normalizado
  'sender_timeframe'  // Mesmo remetente em 24h
]

// Funções exportadas
findMatchingThread(email, existingThreads)
normalizeSubject(subject)            // Remove Re:, Fwd:, [tags], etc
isForwardedEmail(content)            // Detecta email encaminhado
```

### 4.8 `emailCleaner.js` - Limpeza de Conteúdo

```javascript
removeQuotedText(content)            // Remove texto citado (> linhas)
removeSignature(content)             // Remove assinaturas
extractMainContent(content)          // Extrai conteúdo principal
sanitizeHtml(content)                // Remove HTML malicioso
cleanEmailContent(content)           // Aplica todas as limpezas
```

---

## 5. Hooks Customizados

### 5.1 `useHealthScore`

```javascript
const {
  healthData,          // Dados do health score atual
  calculating,         // Boolean - está calculando?
  error,               // Erro se houver
  calcularESalvar      // Função para recalcular manualmente
} = useHealthScore(clienteId);

// healthData contém:
{
  score: 75,
  status: 'atencao',
  componentes: { engajamento, sentimento, ... },
  calculado_em: Date
}
```

### 5.2 `useClassificarThread`

```javascript
const {
  classificar,         // Função para classificar com IA
  classificarManual,   // Função para classificação manual
  classificando,       // Boolean - está processando?
  erro                 // Mensagem de erro
} = useClassificarThread();

// Uso:
await classificar(teamId, threadId, conversaTexto, threadData);
await classificarManual(teamId, threadId, { categoria, sentimento, resumo });
```

### 5.3 `useRetention`

```javascript
// Arquivar thread
const { arquivar, arquivando } = useArquivarThread();

// Soft delete de alerta
const { softDelete, deletando } = useSoftDeleteAlerta();

// Admin - executar políticas
const { executar, executando, relatorio } = useRetentionAdmin();

// Toggle para mostrar arquivados
const { showArchived, setShowArchived } = useShowArchived();
```

---

## 6. Páginas e Componentes

### 6.1 Páginas Principais

| Página | Rota | Descrição |
|--------|------|-----------|
| `Dashboard.jsx` | `/` | Visão geral com cards e gráficos |
| `Clientes.jsx` | `/clientes` | Lista de clientes com filtros |
| `ClienteDetalhe.jsx` | `/clientes/:id` | Detalhe do cliente com 4 abas |
| `Analytics.jsx` | `/analytics` | Dashboard gerencial com 5 abas |
| `Alertas.jsx` | `/alertas` | Gestão de alertas |

### 6.2 Analytics - Abas

| Aba | Descrição | Métricas |
|-----|-----------|----------|
| **Uso da Plataforma** | Métricas de uso | Logins, peças criadas, downloads, uso AI |
| **Conversas** | Análise de threads | Por categoria, sentimento, tendências |
| **Usuários** | Heavy users e CS | Ranking de usuários, performance por responsável |
| **Vendas** | Oportunidades | Upsell, clientes em crescimento |
| **Prevenção de Churn** | Risco de churn | Clientes em risco, sem contato, alertas |

### 6.3 ClienteDetalhe - Abas

| Aba | Descrição |
|-----|-----------|
| **Resumo** | Health score, métricas de uso, gráfico de evolução |
| **Conversas** | Timeline de threads com classificação |
| **Playbooks** | Ações recomendadas baseadas no status |
| **Pessoas** | Lista de usuários do cliente |

---

## 7. Scripts de Jobs Agendados

### 7.1 `calcularHealthScoreDiario.js`

Calcula o Health Score de todos os clientes ativos.

```bash
# Execução manual
node src/scripts/calcularHealthScoreDiario.js

# Flags disponíveis
--dry-run       # Simula sem salvar
--cliente=ID    # Calcula apenas para um cliente
--verbose       # Log detalhado
```

**Recomendação:** Agendar via Cloud Scheduler para rodar diariamente às 6h.

```
0 6 * * * node /path/to/calcularHealthScoreDiario.js >> /var/log/health-score.log 2>&1
```

### 7.2 `retentionJob.js`

Executa políticas de retenção de dados.

```bash
# Execução manual
node src/scripts/retentionJob.js

# Flags disponíveis
--dry-run       # Simula sem executar
--report-only   # Apenas gera relatório
--verbose       # Log detalhado
```

**Recomendação:** Agendar para rodar semanalmente (domingo às 3h).

```
0 3 * * 0 node /path/to/retentionJob.js --verbose >> /var/log/retention.log 2>&1
```

---

## 8. Sistema de Health Score

### 8.1 Componentes e Pesos

| Componente | Peso | Descrição | Cálculo |
|------------|------|-----------|---------|
| **Engajamento** | 25% | Frequência de interações | Baseado em threads nos últimos 30 dias |
| **Sentimento** | 25% | Tom das conversas | % de threads positivas vs negativas |
| **Tickets Abertos** | 20% | Problemas pendentes | Penaliza alertas não resolvidos |
| **Tempo sem Contato** | 15% | Recência | Dias desde última interação |
| **Uso da Plataforma** | 15% | Adoção | Logins, peças criadas, downloads |

### 8.2 Faixas de Status

| Status | Score | Cor | Ação Recomendada |
|--------|-------|-----|------------------|
| **Saudável** | 80-100 | Verde (#10B981) | Manter relacionamento |
| **Atenção** | 60-79 | Amarelo (#F59E0B) | Acompanhar de perto |
| **Risco** | 40-59 | Laranja (#F97316) | Intervenção proativa |
| **Crítico** | 0-39 | Vermelho (#EF4444) | Ação urgente |

### 8.3 Fórmula

```javascript
healthScore = (
  componenteEngajamento * 0.25 +
  componenteSentimento * 0.25 +
  componenteTickets * 0.20 +
  componenteTempoContato * 0.15 +
  componenteUsoPlataforma * 0.15
)
```

---

## 9. Classificação de Threads com IA

### 9.1 Fluxo

```
1. Usuário clica em "Classificar com IA" na thread
2. Hook useClassificarThread prepara a conversa
3. Service openai.js envia para GPT-4o-mini
4. Resposta parseada: { categoria, sentimento, resumo }
5. Thread atualizada no Firestore
6. Se urgente/negativo ou erro_bug: alerta criado automaticamente
7. Ação registrada na auditoria
```

### 9.2 Prompt Utilizado

O prompt solicita análise da conversa e retorno de JSON com:
- `categoria`: Uma das 6 categorias definidas
- `sentimento`: Um dos 4 sentimentos definidos
- `resumo`: 1-2 frases resumindo o assunto

### 9.3 Fallbacks

Se a API da OpenAI falhar:
1. Retry com backoff exponencial (3 tentativas)
2. Se persistir, permite classificação manual
3. Classificação baseada em keywords (futuro)

---

## 10. Otimizações de Performance

### 10.1 Queries Paralelas

Todas as páginas usam `Promise.all` para queries independentes:

```javascript
// ANTES (lento - sequencial)
const clientes = await getDocs(collection(db, 'clientes'));
const alertas = await getDocs(collection(db, 'alertas'));
const threads = await getDocs(collection(db, 'threads'));

// DEPOIS (rápido - paralelo)
const [clientes, alertas, threads] = await Promise.all([
  getDocs(collection(db, 'clientes')),
  getDocs(collection(db, 'alertas')),
  getDocs(collection(db, 'threads'))
]);
```

### 10.2 Collection Raiz para Threads

Arquitetura anterior (lenta):
```
times/{teamId}/threads/{threadId}
```
Problema: N queries para N times.

Arquitetura atual (rápida):
```
threads/{threadId}  (com campo team_id)
```
Vantagem: Uma única query com `where('team_id', 'in', [...])`.

### 10.3 Chunks Paralelos

Para queries com mais de 10 IDs (limite do Firestore `in`):

```javascript
// ANTES (sequencial)
for (let i = 0; i < teamIds.length; i += 10) {
  const chunk = teamIds.slice(i, i + 10);
  const result = await getDocs(query(...));  // Espera cada um
}

// DEPOIS (paralelo)
const promises = [];
for (let i = 0; i < teamIds.length; i += 10) {
  const chunk = teamIds.slice(i, i + 10);
  promises.push(getDocs(query(...)));  // Não espera
}
const results = await Promise.all(promises);  // Espera todos juntos
```

### 10.4 Limites de Data

Queries de métricas limitadas aos últimos 90 dias por padrão:

```javascript
const dataLimite = new Date();
dataLimite.setDate(dataLimite.getDate() - 90);

const q = query(
  collection(db, 'metricas_diarias'),
  where('data', '>=', dataLimite)
);
```

---

## 11. Variáveis de Ambiente

Criar arquivo `.env` na raiz do projeto:

```env
# Firebase
VITE_FIREBASE_API_KEY=sua_api_key
VITE_FIREBASE_AUTH_DOMAIN=seu_projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu_projeto
VITE_FIREBASE_STORAGE_BUCKET=seu_projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

# OpenAI (para classificação de threads)
VITE_OPENAI_API_KEY=sk-...
```

---

## 12. Setup e Deploy

### 12.1 Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Build de produção
npm run build

# Preview do build
npm run preview
```

### 12.2 Índices do Firestore

Criar os seguintes índices compostos no Firebase Console:

```
Collection: threads
  - team_id (Ascending) + updated_at (Descending)

Collection: metricas_diarias
  - team_id (Ascending) + data (Ascending)

Collection: alertas
  - status (Ascending) + created_at (Descending)

Collection: mensagens
  - thread_id (Ascending) + data (Ascending)
```

### 12.3 Regras de Segurança (Firestore)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Apenas usuários autenticados
    match /{document=**} {
      allow read, write: if request.auth != null;
    }

    // Auditoria: apenas escrita (append-only)
    match /auditoria/{docId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if false;  // Nunca permite
    }
  }
}
```

### 12.4 Deploy

```bash
# Build
npm run build

# Deploy para Firebase Hosting
firebase deploy --only hosting

# Ou para outro serviço (Vercel, Netlify, etc)
# O diretório de build é ./dist
```

---

## Apêndice A: Troubleshooting

### Página lenta para carregar
1. Verificar se índices do Firestore estão criados
2. Verificar console do browser para queries lentas
3. Verificar se está usando `Promise.all` para queries paralelas

### Classificação IA não funciona
1. Verificar se `VITE_OPENAI_API_KEY` está no `.env`
2. Verificar limites da API da OpenAI
3. Verificar console para erros de CORS ou rate limit

### Health Score não atualiza
1. Verificar se job diário está rodando
2. Rodar manualmente: `node src/scripts/calcularHealthScoreDiario.js --verbose`
3. Verificar se cliente tem status `ativo`

### Threads não aparecem
1. Verificar se collection `threads` existe e tem documentos
2. Verificar se `team_id` dos threads corresponde aos `times` do cliente
3. Verificar índice `team_id + updated_at`

---

## Apêndice B: Diagrama de Collections

```
Firebase Firestore
│
├── clientes/
│   ├── {clienteId}/
│   │   └── health_history/          # Subcollection
│   │       └── {date}/
│   │
├── threads/                          # Collection raiz (otimizada)
│   └── {threadId}/
│
├── mensagens/                        # Collection raiz
│   └── {messageId}/
│
├── alertas/
│   └── {alertaId}/
│
├── metricas_diarias/
│   └── {teamId}_{date}/
│
├── usuarios_lookup/
│   └── {userId}/
│
├── usuarios_sistema/
│   └── {userId}/
│
├── auditoria/                        # Append-only log
│   └── {auditId}/
│
└── times/                            # Legado (manter para compatibilidade)
    └── {teamId}/
```

---

**Documento gerado em:** Janeiro 2026
**Autor:** Equipe CS Hub
**Próximos passos:** Tutorial operacional para usuários finais
