# ROADMAP V2 - CS Hub

**Criado em:** 02/02/2026
**Atualizado em:** 04/02/2026
**Objetivo:** Lista de implementações priorizadas com base no feedback do time
**Fonte:** Reunião 04/02 com Valeria, César, Nathalia Montiel e Natalia Santos

---

## STATUS DOS ITENS JA IMPLEMENTADOS

| Item | Status |
|------|--------|
| 1.1 Filtros de email/conversas | ✅ Concluído |
| 1.2 Observações do CS para IA | ✅ Concluído |
| 1.3 Segmentação por área de atuação | ✅ Concluído |
| 2.2 Validação com Zod | ✅ Concluído |
| 4.3 Roteiro de testes | ✅ Concluído |
| SEC-1 Firestore Security Rules | ✅ Concluído |
| SEC-2 Console.logs removidos em produção | ✅ Concluído |
| SEC-3 Logger utility | ✅ Concluído |
| SEC-4 Fallbacks hardcoded removidos | ✅ Concluído |
| 2.1 Cloud Functions | ⏸️ On hold (aguardando plano Blaze) |
| 2.3 Rate Limiting | ⏸️ On hold (depende de 2.1) |

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
- [ ] Adicionar campo `tipo_conta` no ClienteForm (select: Pagante / Google Gratuito)
- [ ] Ajustar `calcularSegmentoCS` para considerar tipo de conta nos thresholds
- [ ] Configuração dos períodos em Configurações

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
- [ ] Adicionar seção "SLA de Atendimento" na página Configurações
- [ ] Campos: tempo de resposta por situação (horas), horário comercial (início/fim)
- [ ] Salvar na collection `config` (doc `sla`)
- [ ] Validação Zod para os campos numéricos
- [ ] Futuro: alertas quando SLA estiver próximo de estourar (depende de 3.3 interações)

---

## 🔵 SPRINT 4 - PERFIS E BUSCA (Prioridade Média)

### 4.1 Busca de perfil online dos contatos
**Status:** Pendente
**Dependência:** Nenhuma

**O que fazer:**
- [ ] Adicionar campos: nome do contato, cargo, LinkedIn URL, email
- [ ] Suporte a múltiplos contatos por empresa (decisor, operacional, financeiro)
- [ ] Busca automática via LinkedIn (avaliar APIs: Proxycurl, RocketReach)
- [ ] Exibir foto, cargo e empresa no card do contato
- [ ] Enriquecer contexto da IA

**Considerações:**
- APIs de LinkedIn ~$0.01-0.03/lookup
- Alternativa manual: CS preenche após primeira call
- LGPD: apenas dados profissionais públicos

---

## 🟣 SPRINT 5 - INTELIGÊNCIA E ANALYTICS

### 5.1 Análise por área de atuação + Predição de sazonalidade
**Dependência:** 1.3 ✅ (já concluído) + 3.4 (calendário)

**O que fazer:**
- [ ] Filtro por área em todas as abas do Analytics
- [ ] Dashboard de sazonalidade: uso ao longo do ano por área
- [ ] Detectar padrões (Educação = pico jan-mar, Varejo = nov-dez)
- [ ] Calcular "janela de abordagem ideal" (X dias antes do pico)
- [ ] Alertas: "Cliente [nome] (Varejo) - sazonalidade em 30 dias"
- [ ] Comparativo: uso real vs. esperado

### 5.2 Melhorias no Analytics
- [ ] Exportar relatórios PDF/Excel
- [ ] Filtros por período personalizados
- [ ] Comparativo entre períodos
- [ ] Dashboard de bugs/problemas por cliente
- [ ] Dashboard de tags de problema (quais mais frequentes, tendência)

---

## ⚪ SPRINT 6 - PERFORMANCE

### 6.1 Paginação em listas grandes
- [ ] Lista de Clientes, Analytics, Alertas, Threads
- [ ] `startAfter` do Firestore, 20-50 itens/página

### 6.2 Cache client-side
- [ ] React Query ou SWR
- [ ] Tempo de expiração por tipo de dado

### 6.3 Lazy Loading
- [ ] `React.lazy()` + `Suspense` por rota

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

### 7.1 Remover/proteger página de Debug em produção
**Ref SEGURANCA.md:** #7 (CWE-489)
**Prioridade:** ALTA
**Risco:** Página `/debug` permite destruição total do banco de dados

**O que fazer:**
- [ ] Condicionar rota `/debug` a `import.meta.env.DEV` no App.jsx
- [ ] Ou remover completamente o arquivo `DebugFirestore.jsx` e a rota
- [ ] Verificar se existem outras rotas/funcionalidades de debug expostas

### 7.2 Validação de schema nas respostas da OpenAI
**Ref SEGURANCA.md:** #11 (CWE-502)
**Prioridade:** ALTA
**Risco:** `JSON.parse` sem validação pode causar crash ou dados malformados

**O que fazer:**
- [ ] Validar resposta da OpenAI com Zod schema em `src/services/openai.js`
- [ ] Schema: `categoria` (enum), `sentimento` (enum), `resumo` (string max 500)
- [ ] Fallback seguro se resposta não bater com schema (retornar classificação "indefinido")
- [ ] Logar erro sem expor detalhes da API

### 7.3 Firebase Config em variáveis de ambiente
**Ref SEGURANCA.md:** #2 (CWE-798)
**Prioridade:** MÉDIA
**Nota:** Firebase API key no frontend é aceitável por design (protegido pelas Security Rules), mas mover para env vars é boa prática.

**O que fazer:**
- [ ] Mover config do Firebase de hardcoded para `import.meta.env.VITE_FIREBASE_*`
- [ ] Adicionar variáveis no `.env` e `.env.example`
- [ ] Atualizar `src/services/firebase.js`

### 7.4 Sanitização de erros de API em produção
**Ref SEGURANCA.md:** #12 (CWE-209)
**Prioridade:** MÉDIA
**Risco:** Erros da OpenAI/ClickUp expõem detalhes internos

**O que fazer:**
- [ ] Criar função `sanitizeError(error)` em `src/utils/`
- [ ] Em produção: retornar mensagem genérica sem detalhes técnicos
- [ ] Em dev: manter erro completo para debugging
- [ ] Aplicar em `src/services/openai.js` e `src/services/clickup.js`

### 7.5 API Keys expostas no bundle de produção (CRÍTICO)
**Ref SEGURANCA.md:** #3 (CWE-200)
**Prioridade:** CRÍTICA
**Risco:** `VITE_OPENAI_API_KEY` e `VITE_CLICKUP_API_KEY` ficam visíveis no JavaScript compilado. Qualquer pessoa pode abrir o DevTools e extrair as chaves.

**Situação atual:**
- `src/services/openai.js` faz `fetch` direto para `api.openai.com` com a key no header `Authorization`
- `src/services/clickup.js` faz `fetch` direto para `api.clickup.com` com a key no header `Authorization`
- As chaves são injetadas via `vite.config.js` → `define` → ficam no bundle JS final

**O que fazer (sem Cloud Functions):**
- [ ] Criar um proxy simples com Vercel Edge Functions, Cloudflare Workers ou Netlify Functions (gratuito)
- [ ] Mover chamadas OpenAI para o proxy: frontend chama `/api/classify` → proxy chama OpenAI com a key segura
- [ ] Mover chamadas ClickUp para o proxy: frontend chama `/api/clickup/*` → proxy encaminha
- [ ] Remover `VITE_OPENAI_API_KEY` e `VITE_CLICKUP_API_KEY` do `vite.config.js` define
- [ ] Adicionar autenticação no proxy (verificar token Firebase do usuário)

**Alternativa com Cloud Functions (se plano Blaze disponível):**
- [ ] Criar Cloud Functions `classifyThread` e `clickupProxy`
- [ ] Usar `firebase-functions` com `onCall` (já verifica auth automaticamente)

### 7.6 Validação de parseInt e inputs numéricos
**Ref SEGURANCA.md:** #9, #14 (CWE-20)
**Prioridade:** MÉDIA
**Nota:** Zod já cobre formulários, mas falta validação em `clickup.js` e outros locais programáticos.

**O que fazer:**
- [ ] Adicionar radix 10 e validação `isNaN` em `parseInt` do `clickup.js` (linhas 61-63)
- [ ] Revisar outros usos de `parseInt`/`Number()` no projeto
- [ ] Criar util `safeParseInt(value, fallback)` se necessário

### 7.7 Limpeza do histórico Git (API keys)
**Ref SEGURANCA.md:** #1 (CWE-798)
**Prioridade:** ALTA
**Risco:** Chaves antigas podem estar no histórico do Git mesmo com `.env` no `.gitignore`

**O que fazer:**
- [ ] Verificar se `.env` aparece no histórico Git (`git log --all --full-history -- .env`)
- [ ] Se sim: usar BFG Repo-Cleaner para remover do histórico
- [ ] Revogar e regenerar TODAS as API keys (OpenAI, ClickUp)
- [ ] Gerar novas chaves nos dashboards respectivos
- [ ] Atualizar `.env` local com novas chaves

### 7.8 Política de senha mais forte
**Ref SEGURANCA.md:** #10 (CWE-521)
**Prioridade:** MÉDIA
**Risco:** Senhas fracas podem ser descobertas por brute-force

**Situação atual:** Zod em `src/validation/usuario.js` já tem `senhaSchema` com regex, mas a validação original em `Usuarios.jsx` exigia apenas 6 caracteres.

**O que fazer:**
- [ ] Verificar e reforçar `senhaSchema` no Zod: mínimo 8 chars, maiúscula, minúscula, número, especial
- [ ] Exibir indicador de força da senha no formulário de criação de usuário
- [ ] Mensagens claras em português sobre cada requisito não atendido

### 7.9 Atualizar dependências vulneráveis (npm audit)
**Prioridade:** ALTA
**Risco:** `jspdf` tem vulnerabilidade HIGH (CVE: PDF Injection + DoS via BMP)

**O que fazer:**
- [ ] Executar `npm audit` e avaliar todas as vulnerabilidades
- [ ] Atualizar `jspdf` para versão sem vulnerabilidades conhecidas (se disponível)
- [ ] Se não houver fix: avaliar alternativa (ex: `pdf-lib`, `react-pdf`)
- [ ] Configurar `npm audit` no CI/CD para alertar sobre novas vulnerabilidades
- [ ] Revisar e atualizar outras dependências desatualizadas

### 7.10 Segurança que depende de Cloud Functions (On Hold)

> Estes itens requerem backend (Cloud Functions / plano Blaze). Ficam junto com 2.1.
> O item 7.5 pode ser resolvido SEM Cloud Functions usando Vercel/Cloudflare Workers.

| Item | Ref | Descrição |
|------|-----|-----------|
| Backend proxy para APIs | #3 | Alternativa ao 7.5 usando Cloud Functions ao invés de Vercel/Cloudflare |
| Validação de domínio server-side | #5 | Cloud Function `auth.user().onCreate` para bloquear domínios inválidos |
| Custom Claims (RBAC server) | #6 | Implementar roles via Custom Claims no Firebase Auth |
| Rate Limiting | #16 | Limitar requisições por IP/usuário |

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

---

## ORDEM SUGERIDA DE IMPLEMENTAÇÃO (ATUALIZADA)

### Sprint 2 - Bugs Críticos ← ESTAMOS AQUI
1. Recalcular segmentação CS automaticamente (BUG-1)
2. Corrigir associação de threads/times (BUG-2)

### Sprint 3 - Novos Campos e Tags (Feedback do time)
3. Novos campos na ficha do cliente (3.0)
4. Sistema de tags de problema - manual + automático (3.1)
5. Registro de bugs/problemas por cliente (3.2)
6. Registro de interações completo (3.3)
7. Sazonalidade/calendário por cliente (3.4)
8. Tipo de conta e período diferenciado (3.5)
9. Configuração de SLA em Configurações (3.6)

### Sprint 4 - Perfis
10. Busca de perfil online dos contatos (4.1)

### Sprint 5 - Inteligência
11. Análise por área + sazonalidade (5.1)
12. Melhorias no Analytics (5.2)

### Sprint 6 - Performance
13. Paginação (6.1)
14. Cache (6.2)
15. Lazy Loading (6.3)

### On Hold (aguardando decisão do time)
- Cloud Functions (2.1) — precisa plano Blaze
- Rate Limiting (2.3) — depende de 2.1

### V3 (próximo ciclo)
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
