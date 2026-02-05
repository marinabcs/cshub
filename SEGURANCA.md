# Analise de Seguranca - CS Hub

> **Data da Analise:** Janeiro 2026
> **Ultima Atualizacao:** 05/02/2026
> **Versao Analisada:** 1.0.0
> **Status:** 16 vulnerabilidades identificadas — 14 resolvidas, 2 pendentes

---

## Resumo Executivo

| Severidade | Quantidade | Resolvidas | Pendentes |
|------------|------------|------------|-----------|
| Critico | 4 | 4 | 0 |
| Alto | 5 | 5 | 0 |
| Medio | 5 | 3 | 2 |
| Baixo | 2 | 2 | 0 |
| **Total** | **16** | **14** | **2** |

---

## CRITICO (Todos Resolvidos)

### 1. API Keys Expostas no Repositorio
- **CWE-798** (Use of Hard-coded Credentials)
- **Status:** RESOLVIDO (05/02/2026)
- **Solucao:** API keys (OpenAI, ClickUp) movidas para Firebase Secrets Manager. Frontend usa `httpsCallable()` via Cloud Functions proxy. Keys removidas do `.env`.
- **Secrets configurados:** `OPENAI_API_KEY`, `CLICKUP_API_KEY`, `CLICKUP_WEBHOOK_SECRET`
- **Arquivos:** `functions/index.js` (classifyThread, clickupProxy, generateSummary)

### 2. Firebase Config Hardcoded
- **CWE-798** (Use of Hard-coded Credentials)
- **Status:** RESOLVIDO (30/01/2026)
- **Solucao:** Config movida para variaveis de ambiente `VITE_FIREBASE_*` em `.env` (que esta no `.gitignore`). Firebase keys no frontend sao aceitaveis por design quando protegidas por Security Rules.
- **Arquivo:** `src/services/firebase.js`

### 3. API Keys no Bundle de Producao
- **CWE-200** (Exposure of Sensitive Information)
- **Status:** RESOLVIDO (05/02/2026)
- **Solucao:** OpenAI e ClickUp API keys removidas do `vite.config.js`. Apenas IDs de configuracao (TEAM_ID, LIST_ID) sao expostos no bundle — nao sao secrets. Chamadas passam por Cloud Functions.
- **Arquivo:** `vite.config.js`

### 4. Firestore Security Rules
- **CWE-862** (Missing Authorization)
- **Status:** RESOLVIDO (30/01/2026, atualizado 05/02/2026)
- **Solucao:** Rules completas com RBAC (viewer, cs, gestor, admin, super_admin). Deploy feito em 05/02/2026.
- **Arquivo:** `firestore.rules` (182 linhas)
- **Destaques:**
  - `usuarios_sistema`: leitura restrita (proprio doc ou CS+), escrita admin-only
  - `audit_logs`: append-only (update/delete = false)
  - `_rate_limits`: acesso bloqueado para clientes (uso interno das Cloud Functions)
  - Validacao de dominio @trakto.io em todas as collections

---

## ALTO (Todos Resolvidos)

### 5. Validacao de Dominio Apenas no Client-Side
- **CWE-602** (Client-Side Enforcement of Server-Side Security)
- **Status:** RESOLVIDO (05/02/2026)
- **Solucao:** Cloud Function `validateDomain` (beforeUserCreated) bloqueia signup de emails fora do @trakto.io no servidor. Firestore Rules tambem validam dominio.
- **Arquivo:** `functions/index.js` (validateDomain)

### 6. RBAC Apenas no Client-Side
- **CWE-602** (Client-Side Enforcement of Server-Side Security)
- **Status:** RESOLVIDO (05/02/2026)
- **Solucao:** Custom Claims sincronizados via Cloud Function `syncUserRole`. Funcao `setUserRole` para admins gerenciarem roles. `requireRole()` verifica claims em todas as Cloud Functions. Firestore Rules usam roles para controle de acesso.
- **Arquivos:** `functions/index.js` (syncUserRole, setUserRole, requireRole)

### 7. Pagina de Debug Acessivel em Producao
- **CWE-489** (Active Debug Code)
- **Status:** RESOLVIDO (30/01/2026)
- **Solucao:** Rota `/debug` condicionada a `import.meta.env.DEV`. Componente excluido do bundle de producao via lazy loading condicional.
- **Arquivo:** `src/App.jsx`

### 8. Console.log com Dados Sensiveis
- **CWE-532** (Insertion of Sensitive Information into Log File)
- **Status:** RESOLVIDO (30/01/2026)
- **Solucao:** `esbuild.drop` remove console/debugger em producao. Utilitario `logger.js` para logging em dev.
- **Arquivos:** `vite.config.js`, `src/utils/logger.js`

### 9. parseInt sem Validacao
- **CWE-20** (Improper Input Validation)
- **Status:** RESOLVIDO (30/01/2026)
- **Solucao:** Todos os `parseInt()` agora usam radix 10.

---

## MEDIO

### 10. Politica de Senha Fraca
- **CWE-521** (Weak Password Requirements)
- **Status:** RESOLVIDO (30/01/2026)
- **Solucao:** Validacao com Zod schema `senhaSchema` (minimo 8 chars, maiuscula, minuscula, numero, especial).
- **Arquivo:** `src/validation/usuario.js`

### 11. JSON.parse sem Validacao de Schema
- **CWE-502** (Deserialization of Untrusted Data)
- **Status:** RESOLVIDO (30/01/2026)
- **Solucao:** Zod schemas para todas as respostas da OpenAI (`classificacaoIASchema`) com `.catch()` para fallback seguro.
- **Arquivo:** `src/validation/thread.js`, `src/services/openai.js`

### 12. Erros de API Expostos no Console
- **CWE-209** (Generation of Error Message Containing Sensitive Information)
- **Status:** RESOLVIDO (05/02/2026)
- **Solucao:** `sanitizeError.js` no frontend. Cloud Functions retornam mensagens genericas (nunca `error.message` direto). Webhook retorna apenas "Erro interno do servidor".
- **Arquivos:** `src/utils/sanitizeError.js`, `functions/index.js`

### 13. Fallback Hardcoded do Team ID
- **CWE-798** (Use of Hard-coded Credentials)
- **Status:** PENDENTE (baixo risco)
- **Nota:** VITE_CLICKUP_TEAM_ID esta no .env e no bundle, mas e apenas um ID de configuracao, nao um secret. Risco aceitavel.

### 14. Inputs Numericos sem Validacao de Range
- **CWE-20** (Improper Input Validation)
- **Status:** PENDENTE (baixo risco)
- **Nota:** Zod schemas validam a maioria dos inputs. Campos numericos em Configuracoes usam `Number()` que retorna 0 para invalidos.

---

## BAIXO (Todos Resolvidos)

### 15. Uso de window.location.reload()
- **Status:** RESOLVIDO — Presente apenas na pagina de Debug (excluida de producao)

### 16. Falta de Rate Limiting
- **CWE-770** (Allocation of Resources Without Limits)
- **Status:** RESOLVIDO (05/02/2026)
- **Solucao:** Rate limiter distribuido usando Firestore (collection `_rate_limits`). Persiste entre cold starts, funciona com multiplas instancias.
- **Limites configurados:**
  - `classifyThread`: 30 req/min por usuario
  - `generateSummary`: 30 req/min por usuario
  - `clickupProxy`: 60 req/min por usuario
  - `setUserRole`: 20 req/min por usuario
  - `clickupWebhook`: 120 req/min por IP
- **Arquivo:** `functions/index.js`

---

## Seguranca Adicional Implementada (05/02/2026)

### Webhook ClickUp Securizado
- Verificacao de assinatura HMAC-SHA256 com `crypto.timingSafeEqual` (previne timing attacks)
- Secret armazenado em Firebase Secrets (`CLICKUP_WEBHOOK_SECRET`)
- CORS desabilitado (`cors: false`)
- Rate limiting por IP
- Validacao de taskId (tipo + tamanho max 100 chars)
- Validacao de history_items como Array
- Query limitada com `.limit(5)`

### Validacao de Inputs nas Cloud Functions
- `classifyThread`: conversa max 50k chars, contextoCliente max 5k chars
- `generateSummary`: prompt max 80k chars, systemMsg max 5k chars
- `clickupProxy`: whitelist de actions, validacao de IDs (tipo + tamanho), validacao de payload
- `setUserRole`: validacao de role contra VALID_ROLES, protecao contra auto-promocao a super_admin

### Content Security Policy (CSP)
- Meta tags adicionadas em `index.html`:
  - `Content-Security-Policy`: whitelist para Firebase, Cloud Functions, Google APIs
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`

### Protecao de Rotas Admin
- `/configuracoes/usuarios` protegida com `AdminRoute` (requer admin ou super_admin)
- `/configuracoes/auditoria` protegida com `AdminRoute`

### Restricao de Leitura no Firestore
- `usuarios_sistema`: viewers leem apenas o proprio documento, CS+ leem todos
- Frontend atualizado para usar `.doc(uid)` ao inves de `where('email')`:
  - `Sidebar.jsx`, `App.jsx` (AdminRoute), `Configuracoes.jsx`

### Chamada Externa Removida
- `auditService.js`: chamada a `api.ipify.org` removida. `getClientIP()` retorna null.

---

## Infraestrutura de Seguranca

### Firebase Secrets (Google Secret Manager)
| Secret | Descricao | Configurado |
|--------|-----------|-------------|
| `OPENAI_API_KEY` | Chave da API OpenAI (GPT-4o-mini) | Sim |
| `CLICKUP_API_KEY` | Chave da API ClickUp | Sim |
| `CLICKUP_WEBHOOK_SECRET` | Secret HMAC do webhook ClickUp | Sim |

### Cloud Functions Deployadas (southamerica-east1)
| Funcao | Tipo | Auth | Rate Limit | Secrets |
|--------|------|------|------------|---------|
| `validateDomain` | beforeUserCreated | Sistema | - | - |
| `syncUserRole` | onDocumentWritten | Sistema | - | - |
| `setUserRole` | onCall | admin/super_admin | 20/min | - |
| `classifyThread` | onCall | cs+ | 30/min | OPENAI_API_KEY |
| `generateSummary` | onCall | cs+ | 30/min | OPENAI_API_KEY |
| `clickupProxy` | onCall | cs+ | 60/min | CLICKUP_API_KEY |
| `clickupWebhook` | onRequest | HMAC | 120/min (IP) | CLICKUP_WEBHOOK_SECRET |

### Firestore Rules (182 linhas)
- Validacao de dominio @trakto.io
- RBAC: viewer < cs < gestor < admin < super_admin
- Audit logs imutaveis (append-only)
- Collection `_rate_limits` bloqueada para clientes

---

## Comandos Uteis

```bash
# Deploy de functions
firebase deploy --only functions --project cs-hub-8c032

# Deploy de rules
firebase deploy --only firestore:rules --project cs-hub-8c032

# Ver logs das functions
firebase functions:log --project cs-hub-8c032

# Gerenciar secrets
firebase functions:secrets:set NOME_DO_SECRET --project cs-hub-8c032

# Ver secrets no console
# https://console.cloud.google.com/security/secret-manager?project=cs-hub-8c032
```

---

## Historico de Revisoes

| Data | Versao | Descricao |
|------|--------|-----------|
| Jan 2026 | 1.0 | Analise inicial de seguranca (16 vulnerabilidades) |
| 30/01/2026 | 1.1 | Implementacao de items 7.1-7.10 do Roadmap V2 |
| 05/02/2026 | 2.0 | Deploy completo de Cloud Functions, rate limiting distribuido, webhook HMAC, CSP headers, restricao de Firestore rules, validacao de inputs |

---

> **Proxima Revisao:** Apos implementacao de testes automatizados
