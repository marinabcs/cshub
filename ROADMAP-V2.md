# ROADMAP V2 - CS Hub

**Criado em:** 02/02/2026
**Atualizado em:** 04/02/2026
**Objetivo:** Lista de implementações priorizadas com base no feedback do time
**Fonte:** Reunião 04/02 com Valeria, César, Nathalia Montiel e Natalia Santos

---

## STATUS GERAL DO PROJETO

**🎉 ROADMAP V2 COMPLETO (código) — 04/02/2026**

Todos os sprints de código (2-7) estão concluídos. Restam apenas ações manuais de deploy/validação.

| Sprint | Itens | Status |
|--------|-------|--------|
| Pré-V2 | 1.1, 1.2, 1.3, 2.2, 4.3, SEC-1 a SEC-4 | ✅ Concluído |
| Sprint 2 — Bugs Críticos | BUG-1, BUG-2 | ✅ Código pronto (validação manual pendente) |
| Sprint 3 — Campos e Tags | 3.0, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6 | ✅ Completo |
| Sprint 4 — Perfis | 4.1 | ⚠️ Parcial (4 items [x], 3 dependem de Apollo.io) |
| Sprint 5 — Analytics | 5.1, 5.2 | ✅ Completo |
| Sprint 6 — Performance | 6.1, 6.2, 6.3 | ✅ Completo |
| Sprint 7 — Segurança | 7.1–7.10 | ✅ Completo (7.7 e 7.9 parciais — ações manuais) |
| Extra — Calculadora Onboarding | — | ✅ Completo |

---

## 🔴 SPRINT 2 - BUGS CRÍTICOS (Prioridade Máxima)

> Reportados pelo time na reunião de 04/02. Comprometem a confiabilidade da ferramenta.

### BUG-1: Segmentação CS não recalcula automaticamente
**Reportado por:** Valeria (exemplo: Bodega Aurrera 63% saúde sem usar plataforma)
**Prioridade:** CRÍTICA
**Causa raiz:** Segmento é gravado no Firestore (`cliente.segmento_cs`) mas nunca recalculado automaticamente. Cliente pode ficar como ESTÁVEL indefinidamente mesmo sem uso.

**O que fazer:**
- [x] Recalcular segmento ao abrir a ficha do cliente (ClienteDetalhe)
- [x] Recalcular em lote na lista de clientes (botão "Recalcular Segmentos" em Clientes.jsx)
- [x] Garantir que cliente com 0 uso → ALERTA ou RESGATE (nunca ESTÁVEL/CRESCIMENTO)
- [x] Exibir data da última recalculação no SegmentoCard
- [ ] Validar com 5 contas de teste (Bodega Aurrera, EPA, etc.)

### BUG-2: Threads associadas a clientes errados
**Reportado por:** Valeria (Bodega Aurrera mostrando conversas de Omnicom, Nissan)
**Prioridade:** CRÍTICA
**Causa raiz:** Múltiplos clientes podem compartilhar o mesmo `team_id` no array `times`. O mapeamento `clientesMap[teamId]` sobrescreve — o último cliente processado "rouba" as threads.

**O que fazer:**
- [x] Adicionar validação: impedir vincular time que já pertence a outro cliente (já existia, feedback visual melhorado)
- [x] Criar ferramenta de diagnóstico: listar times compartilhados entre clientes (banner + modal em Clientes.jsx)
- [ ] Revisar dados atuais e corrigir associações duplicadas (manual, usar a ferramenta de diagnóstico)
- [x] Garantir que ClienteForm.jsx já bloqueia times de outros clientes (verificado e melhorado)
- [x] Fix: clientesMap em alertas.js agora detecta conflitos e remove times compartilhados do mapa

---

## 🟡 SPRINT 3 - NOVOS CAMPOS E ENRIQUECIMENTO (Feedback do time)

> Funcionalidades pedidas diretamente pelo time para o dia a dia.

### 3.0 Novos campos na ficha do cliente
**Reportado por:** Valeria, Nathalia Montiel
**Prioridade:** ALTA

**Campos a adicionar na collection `clientes` e no ClienteForm:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `bugs_reportados` | Array de `{titulo, descricao, link_clickup, status, data, prioridade}` | Bugs reportados pelo cliente |
| `calendario_campanhas` | Object `{jan: 'alta'/'baixa'/'normal', fev: ...}` | Sazonalidade esperada por mês |
| `pessoa_video` | Boolean | Tem pessoa capacitada para Motion |
| `modulos_concluidos` | Array de strings `['estatico', 'ai', 'motion']` | Módulos finalizados do onboarding |
| `first_value_atingido` | Object `{estatico: date, ai: date, motion: date}` | Data de primeiro valor por módulo |
| `tipo_conta` | Enum `'pagante' / 'google_gratuito'` | Diferencia período de análise e pesos |
| `tags_problema` | Array de `{tag, origem, data, thread_id?}` | Tags de problema (manual ou automática) |

**O que fazer:**
- [x] Adicionar campos no ClienteForm.jsx (seção "Onboarding e Produto" + "Calendário de Campanhas")
- [x] Criar schema Zod para os novos campos (tipo_conta, pessoa_video, modulos_concluidos, first_value_atingido, calendario_campanhas)
- [x] Exibir no ClienteDetalhe → Resumo (cards "Conta e Onboarding" + "Sazonalidade")
- [x] Migrar clientes existentes (valores padrão automáticos via || nos loads)
- **Nota:** `bugs_reportados` e `tags_problema` implementados nos itens 3.2 e 3.1 respectivamente

### 3.1 Sistema de Tags de Problema (manual + automático)
**Reportado por:** Marina
**Prioridade:** ALTA
**Problema:** Não há forma rápida de identificar visualmente quais clientes estão com problemas ativos.

**Como funciona:**

**Tags manuais:**
- CS pode adicionar/remover tags de problema diretamente na ficha do cliente
- Tags pré-definidas: `Problema Ativo`, `Bug Reportado`, `Insatisfeito`, `Risco de Churn`, `Aguardando Resolução`
- Tags customizadas: CS pode digitar tags livres

**Tags automáticas (via classificação IA):**
- Quando a IA classifica uma thread como `erro_bug`, `reclamacao` ou `problema` → auto-adiciona tag no cliente
- Quando sentimento = `negativo` ou `urgente` → auto-adiciona tag `Insatisfeito` ou `Urgente`
- Tag automática registra `origem: 'ia'`, `thread_id` e `data` para rastreabilidade
- CS pode remover tags automáticas manualmente se o problema foi resolvido

**Visualização:**
- Tags visíveis no card do cliente na lista (chips coloridos)
- Filtro na lista de clientes: "Mostrar apenas clientes com problemas"
- Contador de tags ativas no dashboard/analytics

**O que fazer:**
- [x] Adicionar campo `tags_problema` na collection `clientes` (array de objetos com tag, origem, data, thread_id)
- [x] Interface de tags no ClienteDetalhe (card no Resumo com chips coloridos, add/remove)
- [x] Tags pré-definidas (5) + campo de tag customizada
- [x] Integrar com `useClassificarThread.js`: auto-tag para erro_bug, reclamacao, problema, sentimento negativo/urgente
- [x] Exibir tags no card da lista de clientes (mini chips vermelhos, max 3 + "+N")
- [x] Filtro "Com problemas" na lista (botão toggle com contagem)
- [x] Tags como fator na segmentação CS (Risco de Churn → ALERTA, qualquer tag → bloqueia CRESCIMENTO)

### 3.2 Registro de bugs/problemas por cliente
**Reportado por:** Valeria, Nathalia Montiel
**Prioridade:** ALTA
**Exemplo:** "EPA já reportou 5 bugs — isso contextualiza risco de churn"

**O que fazer:**
- [x] Criar aba "Bugs" no ClienteDetalhe com CRUD completo (título, descrição, prioridade 4 níveis, status 3 estados, link ClickUp)
- [x] Formulário de edição/criação com toggle de prioridade visual
- [ ] Vincular com tarefas ClickUp automaticamente (futuro)
- [x] Contagem de bugs ativos visível no card da lista (ícone Bug + número)
- [x] `bugs_abertos_count` como fator na segmentação CS (>=3 → ALERTA, qualquer → bloqueia CRESCIMENTO)

### 3.3 Registro de TODAS as interações (calls, reuniões, touchpoints)
**Reportado por:** Valeria, Nathalia Montiel
**Prioridade:** ALTA

**O que registrar:**
- Calls de onboarding
- Calls de feedback
- Calls de dúvidas/suporte
- Sessões extras de treinamento
- Qualquer touchpoint relevante

**O que fazer:**
- [x] Criar collection `interacoes` (cliente_id, tipo, data_interacao, participantes, notas, duracao, link_gravacao)
- [x] Tipos: `onboarding`, `feedback`, `suporte`, `treinamento`, `qbr`, `outro`
- [x] Aba "Interações" no ClienteDetalhe com formulário rápido (tipo, data, participantes, duração, notas, link gravação)
- [x] Timeline cronológica com dots coloridos por tipo
- [x] Métricas: total interações (30d), dias desde última interação, horas totais
- [x] `dias_sem_interacao` como fator na segmentação CS (>60d sem contato → bloqueia CRESCIMENTO)
- [x] Campo `ultima_interacao_data` no doc do cliente para exibir na listagem sem queries extras
- [ ] Futuro: integrar com Google Drive para puxar gravações automaticamente

### 3.4 Sazonalidade por cliente (calendário de campanhas)
**Reportado por:** Marina
**Prioridade:** MÉDIA-ALTA
**Problema:** Cliente pode ter mês sem campanha e parecer "em risco"

**O que fazer:**
- [x] Interface visual de calendário 12 meses no ClienteForm (grid 4x3, Alta/Normal/Baixa) — feito no item 3.0
- [x] Exibir no ClienteDetalhe → Resumo como mini calendário visual (card Sazonalidade) — feito no item 3.0
- [x] Ajustar segmentação: mês "baixa" → thresholds dobrados (RESGATE: 30→60d, ALERTA: 14→28d)
- [x] Alerta inteligente: "Inativo em Alta Temporada" gerado automaticamente em verificarTodosAlertas
- [x] Edição em lote de sazonalidade (botão "Definir Sazonalidade" na barra de lote, grid 4x3 com presets)

### 3.5 Tipo de conta e período de análise diferenciado
**Reportado por:** Valeria
**Prioridade:** MÉDIA

**Regras:**
```
SE tipo_conta == "pagante":
    periodo_analise = 30 dias
    peso_metricas_plataforma = alto (inatividade é grave)

SE tipo_conta == "google_gratuito":
    periodo_analise = 60 dias
    peso_metricas_plataforma = moderado
```

**O que fazer:**
- [x] Adicionar campo `tipo_conta` no ClienteForm (select: Pagante / Google Gratuito) — feito no item 3.0
- [x] Ajustar `calcularSegmentoCS` para considerar tipo de conta nos thresholds (pagante: 14/30d, gratuito: 28/60d, sazonalidade baixa dobra)
- [x] Configuração dos períodos em Configurações (seção "Períodos por Tipo de Conta" com thresholds editáveis por tipo)

### 3.6 Configuração de SLA na página de Configurações
**Reportado por:** Time (reunião 04/02)
**Prioridade:** MÉDIA
**Decisão:** SLA é configuração global (uma vez), não por cliente.

**Parâmetros de SLA a configurar:**

| Situação | Primeira Resposta (padrão) |
|----------|---------------------------|
| Dias úteis (horário comercial) | 8 horas |
| Final de semana | Próximo dia útil |
| Cliente em campanha ativa | 4 horas |
| Bug crítico bloqueante | 2 horas |

**O que fazer:**
- [x] Adicionar seção "SLA de Atendimento" na página Configurações (card com Shield icon, horário comercial + tempos de resposta)
- [x] Campos: tempo de resposta por situação (horas), horário comercial (início/fim)
- [x] Salvar na collection `config` (doc `sla`)
- [x] Validação Zod para os campos numéricos (`configSlaSchema`)
- [ ] Futuro: alertas quando SLA estiver próximo de estourar (depende de 3.3 interações)

---

## 🔵 SPRINT 4 - PERFIS E BUSCA (Prioridade Média)

### 4.1 Busca de perfil online dos contatos
**Status:** Parcialmente implementado
**Dependência:** Nenhuma

**O que fazer:**
- [x] Adicionar campos: linkedin_url, tipo_contato (decisor/operacional/financeiro/tecnico/outro) ao stakeholderSchema
- [x] Edição de stakeholders existentes (modal com modo edição + botão Pencil)
- [x] Cards ricos no ClienteDetalhe: avatar colorido por tipo, badge, LinkedIn clicável
- [x] Sugestão automática de contatos extraídos das threads (seção "Contatos Sugeridos")
- [ ] Busca automática via API (Apollo.io — ver V3.8)
- [ ] Exibir foto no card do contato
- [ ] Enriquecer contexto da IA com dados de contatos

**Considerações:**
- APIs de LinkedIn ~$0.01-0.03/lookup
- Apollo.io: 50 créditos/mês grátis (enriquecimento por email)
- Alternativa manual: CS preenche após primeira call
- LGPD: apenas dados profissionais públicos

---

## 🟣 SPRINT 5 - INTELIGÊNCIA E ANALYTICS

### 5.1 Análise por área de atuação + Predição de sazonalidade
**Dependência:** 1.3 ✅ (já concluído) + 3.4 (calendário)

**O que fazer:**
- [x] Filtro por área em todas as abas do Analytics (dropdown multiselect global, filtra clientesFiltrados, threadsFiltradas, alertasFiltrados)
- [x] Dashboard de sazonalidade: nova aba "Sazonalidade" com visão geral do mês atual (Alta/Normal/Baixa)
- [x] Detectar padrões: Mapa de calor Áreas × Meses (12 colunas, intensidade por contagem de clientes em alta)
- [x] Calcular "janela de abordagem ideal" (1 mês antes do pico, ordenado por proximidade, badges AGORA/PRÓXIMO)
- [x] Alertas: seção de alertas de sazonalidade pendentes (`sazonalidade_alta_inativo`) com link para cliente
- [x] Comparativo: barra empilhada uso real vs esperado (ativos vs inativos em alta temporada, drill-down lista)

### 5.2 Melhorias no Analytics
- [x] Exportar relatórios PDF/Excel (botão PDF via html2pdf.js + Excel expandido com abas Bugs e Tags Problema)
- [x] Filtros por período personalizados (já existia: 7/15/30/60/90d + custom)
- [x] Comparativo entre períodos (variação % em Threads, Logins, Peças e AI com badges verde/vermelho)
- [x] Dashboard de bugs/problemas por cliente (nova aba Problemas: PieChart prioridade, BarChart status, top 10 afetados, bugs recentes)
- [x] Dashboard de tags de problema (top 10 tags frequentes com barra CS vs IA, % origem)

---

## ⚪ SPRINT 6 - PERFORMANCE

### 6.1 Paginação em listas grandes
- [x] Componente reutilizável `Pagination.jsx` (primeira/anterior/números/próxima/última, tema escuro)
- [x] Clientes: paginação de exibição (30/página), reset ao mudar filtros, seleção em lote mantida
- [x] Alertas: paginação de exibição (30/página), reset ao mudar filtros
- [x] Auditoria: paginação de exibição (50/página)
- [x] Analytics: safety limits `limit(1000)` nas queries de threads e alertas

### 6.2 Cache client-side ✅
- [x] Módulo `src/services/cache.js` — Map em memória com TTL, `cachedGetDocs`, `invalidateCache`, `invalidateCachePrefix`
- [x] Hook `src/hooks/useCachedQuery.js` — hook React genérico com cache (para uso futuro)
- [x] Cache aplicado: `clientes` (5min), `usuarios_sistema` (10min), `metricas_diarias` (5min)
- [x] Páginas otimizadas: Dashboard, Clientes, Analytics, MinhaCarteira, useAlertas
- [x] Invalidação automática em mutations (Clientes: batch update, delete)
- [x] Zero dependências externas — solução customizada leve

### 6.3 Lazy Loading ✅
- [x] `React.lazy()` + `Suspense` em App.jsx — 15 páginas lazy, Login+Dashboard eager
- [x] Bundle principal reduzido de 1.940KB → 649KB (66% menor)
- [x] Cada página gera chunk separado (Analytics 749KB, ClienteDetalhe 133KB, etc.)

---

## 🛡️ SPRINT 7 - SEGURANÇA

> Baseado na análise de segurança (SEGURANCA.md). Itens separados entre o que pode ser feito AGORA e o que depende de Cloud Functions.

### Itens já implementados

| Item | Status |
|------|--------|
| Firestore Security Rules (RBAC completo) | ✅ Concluído |
| Console.logs removidos em produção (esbuild.drop) | ✅ Concluído |
| Logger utility com níveis (src/utils/logger.js) | ✅ Concluído |
| Fallbacks hardcoded removidos do vite.config.js | ✅ Concluído |
| Validação de inputs com Zod (2.2) | ✅ Concluído |
| `.env` no `.gitignore` | ✅ Concluído |

### 7.1 Remover/proteger página de Debug em produção ✅
**Ref SEGURANCA.md:** #7 (CWE-489)
**Prioridade:** ALTA

- [x] Rota `/debug` condicionada a `import.meta.env.DEV` (já existia)
- [x] Lazy import movido para dentro do componente `DevDebugPage` — DebugFirestore.jsx + seedData.js excluídos do bundle de produção
- [x] Sidebar não expõe link para `/debug`
- [x] Nenhuma outra rota/funcionalidade de debug encontrada

### 7.2 Validação de schema nas respostas da OpenAI ✅
**Ref SEGURANCA.md:** #11 (CWE-502)
**Prioridade:** ALTA

- [x] `classificacaoIASchema` com Zod em `src/validation/thread.js` — `.catch()` para fallback automático
- [x] Corrigido enum mismatch: `'duvida'` → `'duvida_pergunta'` em CATEGORIAS_VALIDAS
- [x] `JSON.parse` com try/catch dedicado — retorna classificação default se JSON inválido
- [x] `logger.error` em vez de `console.error` — sem exposição de detalhes da API
- [x] Erro genérico para o caller: `'Não foi possível classificar a conversa'`

### 7.3 Firebase Config em variáveis de ambiente ✅
**Ref SEGURANCA.md:** #2 (CWE-798)
**Prioridade:** MÉDIA

- [x] Config movida de hardcoded para `import.meta.env.VITE_FIREBASE_*` em `firebase.js`
- [x] 6 variáveis adicionadas ao `.env` e `.env.example`
- [x] Valores reais removidos do código-fonte

### 7.4 Sanitização de erros de API em produção ✅
**Ref SEGURANCA.md:** #12 (CWE-209)
**Prioridade:** MÉDIA

- [x] `sanitizeError()` criada em `src/utils/sanitizeError.js` — dev: erro completo, prod: mensagem genérica
- [x] `clickup.js`: 6 `console.error/warn` → `logger.error/warn` + `sanitizeError`
- [x] `clickup.js`: 3 `throw new Error(error.err)` → mensagens genéricas sem detalhes da API
- [x] `openai.js`: já sanitizado no 7.2

### 7.5 ~~API Keys expostas no bundle de produção~~ ✅ CONCLUÍDO
**Ref SEGURANCA.md:** #3 (CWE-200)
**Prioridade:** CRÍTICA
**Solução:** Cloud Functions (onCall) com Firebase Secrets

**O que foi feito:**
- [x] Criadas Cloud Functions `classifyThread`, `clickupProxy` e `generateSummary` em `functions/index.js`
- [x] API keys movidas para Firebase Secrets (`firebase functions:secrets:set`)
- [x] Frontend refatorado: `openai.js`, `clickup.js` e `ResumoExecutivo.jsx` usam `httpsCallable`
- [x] Removidas `VITE_OPENAI_API_KEY` e `VITE_CLICKUP_API_KEY` do `.env` e `vite.config.js`
- [x] Verificado: zero ocorrências de `sk-proj-` e `pk_` no `dist/` após build
- [x] Autenticação verificada automaticamente pelo `onCall` (request.auth)

### 7.6 ~~Validação de parseInt e inputs numéricos~~ ✅ CONCLUÍDO
**Ref SEGURANCA.md:** #9, #14 (CWE-20)
**Prioridade:** MÉDIA

**O que foi feito:**
- [x] Radix 10 adicionado em 9 ocorrências de `parseInt` em 6 arquivos
- [x] `Number()` revisado — 4 usos em Configuracoes.jsx já tinham `|| 0`
- [x] Util `safeParseInt` não necessário (todos os usos são simples)

### 7.7 ~~Limpeza do histórico Git (API keys)~~ ⚠️ PARCIAL
**Ref SEGURANCA.md:** #1 (CWE-798)
**Prioridade:** ALTA

**Diagnóstico realizado:**
- [x] `.env` nunca foi commitado (`.gitignore` protegeu)
- [x] OpenAI key: apenas placeholder `sk-proj-xxxxx...` no histórico (chave real nunca exposta)
- [x] Firebase key: pública por design, protegida por Security Rules — sem ação
- [ ] ClickUp key `pk_43150128_...` hardcoded em 3 commits — **requer ação manual:**
  1. Revogar e regenerar no dashboard ClickUp
  2. `firebase functions:secrets:set CLICKUP_API_KEY` com nova chave
  3. `firebase deploy --only functions`
  4. (Opcional) BFG Repo-Cleaner: `bfg --replace-text <(echo 'pk_43150128_J7V5F0JC0VC3QQS1TJP2D53F5Q7TFKBE') .`

### 7.8 ~~Política de senha mais forte~~ ✅ CONCLUÍDO
**Ref SEGURANCA.md:** #10 (CWE-521)
**Prioridade:** MÉDIA

**O que foi feito:**
- [x] `senhaSchema` reforçado: adicionado regex de caractere especial (`/[^A-Za-z0-9]/`)
- [x] Schema exportado e reutilizado em `Usuarios.jsx` (removida função `validatePassword` duplicada)
- [x] Indicador visual de força: barra de progresso + checklist de 5 requisitos em tempo real
- [x] Placeholder corrigido: "Mínimo 6 caracteres" → "Mínimo 8 caracteres"

### 7.9 ~~Atualizar dependências vulneráveis (npm audit)~~ ⚠️ PARCIAL
**Prioridade:** ALTA

**O que foi feito:**
- [x] `jspdf` atualizado 4.0.0 → 4.1.0 (4 CVEs corrigidas: PDF Injection, DoS via BMP, XMP Injection, Race Condition)
- [x] `xlsx@0.18.5` analisado — sem fix disponível (SheetJS abandonou versão open-source)
  - Uso atual é **apenas escrita/exportação** (`json_to_sheet`, `writeFile`) em `Analytics.jsx`
  - Vulnerabilidades (Prototype Pollution, ReDoS) afetam **parsing de input**, não escrita — risco mitigado
  - Avaliar substituição por alternativa em V3 se necessário

### 7.10 Segurança que depende de Cloud Functions ✅

| Item | Ref | Status |
|------|-----|--------|
| Backend proxy para APIs | #3 | ✅ Concluído no 7.5 (classifyThread, clickupProxy, generateSummary) |
| Validação de domínio server-side | #5 | ✅ `validateDomain` — beforeUserCreated bloqueia emails fora @trakto.io |
| Custom Claims (RBAC server) | #6 | ✅ `syncUserRole` (trigger Firestore→Claims) + `setUserRole` (admin onCall) |
| Rate Limiting | #16 | ✅ In-memory rate limiting: 30/min OpenAI, 60/min ClickUp |

- `requireRole()` helper com custom claims + fallback Firestore (período de migração)
- Viewers excluídos das funções (consistente com Firestore rules)
- 7 Cloud Functions total em `southamerica-east1`

---

## 🎓 CALCULADORA DE ONBOARDING ✅ (Feature extra — fora do ROADMAP original)

**Implementado em:** 04/02/2026
**Status:** Completo

Wizard que gera plano de onboarding personalizado baseado em questionário de 20 perguntas, calculando quais dos 11 módulos devem ser Ao Vivo vs Online.

**Arquivos criados:**
| Arquivo | Descrição |
|---------|-----------|
| `src/constants/onboarding.js` | 11 módulos, 20 perguntas, regras de classificação, first values |
| `src/utils/onboardingCalculator.js` | Lógica pura: classificação, montagem de sessões, progresso |
| `src/validation/onboarding.js` | Zod schemas do questionário e ajustes |
| `src/services/onboarding.js` | CRUD Firestore (`clientes/{id}/onboarding_planos` subcollection) |
| `src/pages/OnboardingCalculadora.jsx` | Página wizard: selecionar cliente → questionário → resultado → salvar |
| `src/components/Cliente/OnboardingSection.jsx` | Tab no ClienteDetalhe: sessões, first values, progresso, handoff |

**Arquivos editados:** App.jsx (rotas), Sidebar.jsx (menu), ClienteDetalhe.jsx (tab), validation/index.js (exports)

**Funcionalidades:**
- [x] Wizard 4 etapas (selecionar cliente → 20 perguntas → resultado com grid 11 módulos → confirmação)
- [x] Classificação automática: M1/M2 sempre ao vivo, demais por regras de negócio
- [x] Ajuste manual pelo CSM com justificativa obrigatória (min 10 chars)
- [x] Agendamento de sessões (max 90min, exceção M1+M2=105min, respeita pré-requisitos)
- [x] Progress tracking: 60% sessões + 30% first values + 10% tutoriais
- [x] Handoff elegível quando todas sessões concluídas + todos first values ao vivo atingidos

---

## ⚠️ AÇÕES MANUAIS PENDENTES (DEPLOY / SEGURANÇA / VALIDAÇÃO)

> Itens que requerem ação manual da Marina ou do time. Nenhum depende de código novo.

### 🚀 Deploy Cloud Functions (PRIORIDADE ALTA)
As 7 Cloud Functions estão prontas em `functions/index.js` mas precisam ser deployed:

```bash
# 1. Configurar secrets (se ainda não feito)
firebase functions:secrets:set OPENAI_API_KEY
firebase functions:secrets:set CLICKUP_API_KEY    # usar chave NOVA (ver item 3 abaixo)

# 2. Deploy
firebase deploy --only functions

# 3. Verificar
firebase functions:log
```

**Funções que serão deployadas:**
| Função | Tipo | Descrição |
|--------|------|-----------|
| `classifyThread` | onCall | Classificação de threads via OpenAI |
| `clickupProxy` | onCall | Proxy para API ClickUp |
| `generateSummary` | onCall | Geração de resumo executivo via OpenAI |
| `validateDomain` | beforeUserCreated | Bloqueia cadastro de emails fora @trakto.io |
| `syncUserRole` | onDocumentWritten | Sincroniza role Firestore → Custom Claims |
| `setUserRole` | onCall | Admin define role manualmente |
| `scheduledCleanup` | onSchedule | (se existir) Limpeza periódica |

### 🔑 Segurança — ClickUp Key Exposta (PRIORIDADE ALTA)
A chave ClickUp `pk_43150128_...` está hardcoded em 3 commits antigos do histórico git.

**Passos:**
1. **Revogar** a key atual no dashboard ClickUp (Settings → Apps → API Token)
2. **Gerar** uma nova API key
3. **Salvar** via: `firebase functions:secrets:set CLICKUP_API_KEY`
4. **Deploy**: `firebase deploy --only functions`
5. **(Opcional)** Limpar histórico: `bfg --replace-text <(echo 'pk_43150128_J7V5F0JC0VC3QQS1TJP2D53F5Q7TFKBE') .`

### 👥 Migrar Custom Claims (PRIORIDADE MÉDIA)
Usuários existentes não têm Custom Claims no Firebase Auth. Duas opções:

**Opção A (automática):** Editar qualquer campo do usuário em `usuarios_sistema` no Firestore → trigger `syncUserRole` propagará o role para Custom Claims automaticamente.

**Opção B (manual):** Chamar a Cloud Function `setUserRole` via console ou script:
```js
// No console do Firebase ou via httpsCallable
setUserRole({ uid: 'USER_UID', role: 'admin' })
```

### ✅ Validação Manual (PRIORIDADE BAIXA)
- [ ] Validar segmentação com 5 contas de teste (Bodega Aurrera, EPA, etc.) — BUG-1
- [ ] Revisar associações duplicadas de times/clientes usando ferramenta de diagnóstico — BUG-2
- [ ] Testar Calculadora de Onboarding com cliente real

### 📦 Dependências Externas (NÃO BLOQUEANTES)
- `xlsx@0.18.5`: sem fix disponível (SheetJS abandonou open-source). Uso atual é write-only (exportação), vulnerabilidades afetam parsing. Risco mitigado.
- Apollo.io API (item 4.1): requer conta para completar enriquecimento automático de contatos

---

## 🔮 V3 - FUNCIONALIDADES FUTURAS

> Itens levantados na reunião mas que dependem de infraestrutura adicional.

### V3.1 Emails enriquecidos com contexto
**Reportado por:** Time
**Necessidade:** Email de engajamento preenchido com nome, dias sem acesso, última conversa, próxima campanha
**Dependência:** 3.3 (interações) + 3.4 (sazonalidade)

### V3.2 Thread interna para time técnico
**Referência:** Modelo Hotmart (Zendesk)
**Necessidade:** Encaminhar problema para time técnico sem sair do CS Hub, com thread interna (cliente não vê)
**Dependência:** Infraestrutura de comunicação

### V3.3 Disparo de emails direto do CS Hub
**Necessidade:** Enviar emails sem sair para Gmail/Outlook. Registro automático da interação
**Dependência:** Integração Gmail API ou SMTP

### V3.4 Transcrição automática de reuniões
**O que fazer:**
- [ ] Upload de áudio/vídeo para Firebase Storage
- [ ] Transcrição via Whisper/OpenAI
- [ ] Resumo automático via IA
- [ ] Puxar automaticamente do Google Drive (meeting recordings)

### V3.5 Notificações
- [ ] In-app (badge, toast)
- [ ] Email para alertas críticos
- [ ] Push notifications (PWA)

### V3.6 Multi-usuário com permissões
- [ ] Controle de acesso por papel (admin, CS, viewer)
- [ ] Permissões granulares
- [ ] Audit log

### V3.7 Responsividade mobile
- [ ] Testar e ajustar todas as páginas
- [ ] Menu mobile (hamburger)

### V3.8 Enriquecimento de contatos via Apollo.io
**Necessidade:** Enriquecer automaticamente dados de stakeholders (cargo, LinkedIn, telefone) via API
**Dependência:** Sistema de stakeholders atualizado (4.1)

- [ ] Integrar API Apollo.io para enriquecimento por email (50 créditos/mês grátis)
- [ ] Botão "Enriquecer" individual no card do stakeholder
- [ ] Enriquecimento em lote (todos stakeholders sem LinkedIn)
- [ ] Cache de resultados para evitar lookups duplicados
- [ ] Alternativas: Proxycurl, RocketReach, Clearbit

---

## ORDEM SUGERIDA DE IMPLEMENTAÇÃO (ATUALIZADA 04/02/2026)

### ~~Sprint 2 - Bugs Críticos~~ ✅
1. ~~Recalcular segmentação CS automaticamente (BUG-1)~~ ✅
2. ~~Corrigir associação de threads/times (BUG-2)~~ ✅

### ~~Sprint 3 - Novos Campos e Tags~~ ✅
3. ~~Novos campos na ficha do cliente (3.0)~~ ✅
4. ~~Sistema de tags de problema (3.1)~~ ✅
5. ~~Registro de bugs/problemas (3.2)~~ ✅
6. ~~Registro de interações (3.3)~~ ✅
7. ~~Sazonalidade/calendário (3.4)~~ ✅
8. ~~Tipo de conta e período (3.5)~~ ✅
9. ~~Configuração de SLA (3.6)~~ ✅

### ~~Sprint 4 - Perfis~~ ⚠️ Parcial
10. ~~Busca de perfil (4.1)~~ ⚠️ — campos, edição e sugestão IA feitos; Apollo.io pendente

### ~~Sprint 5 - Inteligência~~ ✅
11. ~~Análise por área + sazonalidade (5.1)~~ ✅
12. ~~Melhorias no Analytics (5.2)~~ ✅

### ~~Sprint 6 - Performance~~ ✅
13. ~~Paginação (6.1)~~ ✅
14. ~~Cache (6.2)~~ ✅
15. ~~Lazy Loading (6.3)~~ ✅

### ~~Sprint 7 - Segurança~~ ✅
16. ~~Debug protegido (7.1)~~ ✅
17. ~~Validação OpenAI (7.2)~~ ✅
18. ~~Firebase env vars (7.3)~~ ✅
19. ~~Sanitização de erros (7.4)~~ ✅
20. ~~API Keys → Cloud Functions (7.5)~~ ✅
21. ~~parseInt radix 10 (7.6)~~ ✅
22. ~~Limpeza Git (7.7)~~ ⚠️ parcial — ClickUp key requer ação manual
23. ~~Política de senha (7.8)~~ ✅
24. ~~npm audit (7.9)~~ ⚠️ parcial — jspdf corrigido, xlsx sem fix (uso write-only mitiga risco)
25. ~~Segurança Cloud Functions (7.10)~~ ✅

### ~~Extra - Calculadora de Onboarding~~ ✅
26. Wizard 20 perguntas → classificação 11 módulos → plano de sessões ✅
27. Progress tracking no ClienteDetalhe (tab Onboarding) ✅

### V3 (próximo ciclo) ← PRÓXIMO
- Emails enriquecidos (V3.1)
- Thread interna (V3.2)
- Disparo de emails (V3.3)
- Transcrição de reuniões (V3.4)
- Notificações (V3.5)
- Multi-usuário (V3.6)
- Mobile (V3.7)

---

## NOTAS DA REUNIÃO 04/02/2026

**Participantes:** Valeria, César, Nathalia Montiel, Natalia Santos, Marina

**Decisões:**
- Manter período de 30 dias para clientes pagantes (R$20k/mês sem usar = red flag)
- Considerar 60 dias apenas para contas Google gratuitas
- Sem WhatsApp para suporte (não resolve problemas complexos, gera expectativa 24/7)
- Alternativa: 2 sessões de 30 min/semana para dúvidas ao vivo
- SLA é configuração global na página de Configurações (não por cliente)
- Sistema de tags automáticas para marcar clientes com problemas via classificação IA

**SLA Sugerido (a configurar em Configurações):**

| Situação | Primeira Resposta |
|----------|-------------------|
| Dias úteis (horário comercial) | 8 horas |
| Final de semana | Próximo dia útil |
| Cliente em campanha ativa | 4 horas |
| Bug crítico bloqueante | 2 horas |

**Referência Hotmart (Nathalia Montiel):**
- Todos emails → tickets Zendesk automáticos
- Templates prontos para questões fáceis
- Thread interna no ticket (cliente não vê)
- SLA: 24h primeira resposta, 3-5 dias resolução
- CS: saúde = quantas features o cliente usa ativamente
- Tudo em Salesforce + HubSpot

**Próximos passos:**
1. Marina: Corrigir bugs críticos (BUG-1, BUG-2)
2. Marina: Preparar reunião de sexta para bater martelo nos playbooks
3. César: Compartilhar vídeo do Banco Inter (modelo de onboarding)
4. Time: Testar CS Hub e reportar mais bugs/sugestões
5. Marina: Definir SLA de atendimento e comunicar no kickoff dos clientes

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
