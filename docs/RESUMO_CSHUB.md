# CS Hub - Sistema de Customer Success

## O que é

O **CS Hub** é uma plataforma interna de Customer Success desenvolvida para a Trakto. Centraliza todas as informações dos clientes, automatiza a classificação de saúde e ajuda o time de CS a priorizar ações de forma inteligente.

---

## Problema que resolve

Antes do CS Hub, o time de CS enfrentava:
- Informações espalhadas em planilhas, emails e ferramentas diferentes
- Dificuldade em identificar clientes em risco antes do churn
- Falta de visibilidade sobre o engajamento real dos clientes
- Processo manual e demorado para classificar conversas

---

## Principais funcionalidades

### 1. Classificação automática de Saúde (Health Score)

O sistema classifica automaticamente cada cliente em 4 níveis:

| Saúde | Significado | Ação |
|-------|-------------|------|
| **CRESCIMENTO** | Cliente engajado, potencial de expansão | Upsell/Cross-sell |
| **ESTÁVEL** | Cliente saudável, uso regular | Manter relacionamento |
| **ALERTA** | Sinais de risco, precisa atenção | Intervir proativamente |
| **RESGATE** | Risco iminente de churn | Ação urgente |

**Critérios de classificação (em ordem de prioridade):**
1. Reclamações/Bugs em aberto
2. Dias ativos no mês
3. Score de engajamento

### 2. Métricas de uso integradas

Dados importados automaticamente da plataforma Trakto:
- **Logins** - Frequência de acesso
- **Projetos criados** - Engajamento com a ferramenta
- **Assets (peças)** - Produtividade
- **Créditos de IA** - Uso de features avançadas

### 3. Classificação de emails com IA

Emails trocados com clientes são classificados automaticamente usando GPT-4o-mini:
- **Categoria**: dúvida, feedback, reclamação, bug, solicitação, etc.
- **Sentimento**: positivo, neutro, negativo, urgente
- **Resumo**: Síntese automática da conversa

### 4. Sistema de Alertas

Alertas automáticos para situações críticas:
- Cliente com sentimento negativo
- Bug/reclamação reportada
- Cliente entrou em RESGATE

### 5. Gestão de Onboarding

- Calculadora de complexidade de onboarding
- Planos de atividades personalizados por cliente
- Acompanhamento de progresso

### 6. Ações Ongoing (recorrentes)

- Ações padrão configuráveis por nível de saúde
- Ciclos mensais/bimestrais de atividades
- Checklist de execução para o CS

### 7. Analytics e Relatórios

- Dashboard com visão geral da carteira
- Métricas por responsável
- Exportação para Excel
- Resumo executivo com IA

---

## Integrações

| Sistema | Função |
|---------|--------|
| **Firebase** | Banco de dados, autenticação, hosting |
| **OpenAI** | Classificação de emails e resumos com IA |
| **Gmail** | Importação de emails via n8n |
| **ClickUp** | Criação automática de tarefas para alertas |
| **Plataforma Trakto** | Importação de métricas de uso |

---

## Arquitetura técnica

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │     │  Cloud Functions │     │   Firestore     │
│   React + Vite  │────▶│   Node.js        │────▶│   NoSQL DB      │
│   SPA           │     │   11 funções     │     │   Real-time     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │   Externos      │
                        │   OpenAI, n8n   │
                        │   ClickUp       │
                        └─────────────────┘
```

### Stack
- **Frontend**: React 18, Vite, CSS inline
- **Backend**: Firebase Cloud Functions (Node.js)
- **Banco**: Firestore (NoSQL)
- **Auth**: Firebase Authentication
- **IA**: OpenAI GPT-4o-mini
- **Automação**: n8n (importação de dados)

---

## Segurança

- Autenticação restrita a emails @trakto.io
- Controle de acesso por roles (viewer, cs, gestor, admin)
- API keys em Firebase Secrets
- Rate limiting em todas as APIs
- Session timeout após 8h de inatividade
- 0 vulnerabilidades (npm audit)

---

## Fluxo diário automático

| Horário | Processo |
|---------|----------|
| 04:00-06:00 | n8n exporta usuários, times e métricas |
| 06:30 | Recalcula saúde de todos os clientes |
| 07:00 | n8n importa emails do Gmail |
| 07:30 | Classifica emails pendentes com IA |
| 09:00 | Verifica e gera alertas automáticos |
| 13:00 | n8n importa emails novamente |
| 13:30 | Classifica emails pendentes |
| 14:00 | Verifica alertas novamente |

---

## Páginas do sistema

| Página | Descrição |
|--------|-----------|
| **Dashboard** | Visão geral com KPIs e distribuição de saúde |
| **Minha Carteira** | Clientes do CS logado + ações pendentes |
| **Clientes** | Lista completa com filtros avançados |
| **Cliente Detalhe** | Tudo sobre um cliente (métricas, conversas, pessoas) |
| **Analytics** | Relatórios gerenciais com gráficos |
| **Alertas** | Central de alertas pendentes |
| **Ongoing** | Gestão de ações recorrentes |
| **Onboarding** | Planos de onboarding ativos |
| **Configurações** | Parâmetros de saúde, pesos, filtros |

---

## Resultados esperados

1. **Redução de churn**: Identificação proativa de clientes em risco
2. **Eficiência do CS**: Menos tempo em tarefas manuais, mais tempo com clientes
3. **Visibilidade**: Gestão tem visão clara da saúde da base
4. **Padronização**: Processos consistentes para todo o time
5. **Dados para decisão**: Métricas reais para estratégia de CS

---

## Desenvolvido por

- **Marina Barros** - Product Owner / CS
- **Claude (Anthropic)** - Desenvolvimento assistido por IA

**Período**: Janeiro - Fevereiro 2026

---

## Links úteis

- **Produção**: [URL do CS Hub]
- **Firebase Console**: https://console.firebase.google.com/project/cs-hub-8c032
- **Repositório**: https://github.com/marinabcs/cshub
