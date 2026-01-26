# 🔒 Análise de Segurança - CS Hub

> **Data da Análise:** Janeiro 2026
> **Versão Analisada:** 1.0.0
> **Status:** 21 vulnerabilidades identificadas

---

## 📊 Resumo Executivo

| Severidade | Quantidade | Status |
|------------|------------|--------|
| 🔴 Crítico | 4 | Pendente |
| 🟠 Alto | 5 | Pendente |
| 🟡 Médio | 5 | Pendente |
| 🟢 Baixo | 2 | Pendente |
| **Total** | **16** | - |

---

## 🔴 CRÍTICO (Resolver Imediatamente)

### 1. API Keys Expostas no Repositório

| Campo | Valor |
|-------|-------|
| **Arquivo** | `.env` |
| **Linha** | 1-4 |
| **CVE/CWE** | CWE-798 (Use of Hard-coded Credentials) |
| **Impacto** | Acesso não autorizado às APIs OpenAI e ClickUp, custos financeiros não autorizados |

**Código Vulnerável:**
```
VITE_OPENAI_API_KEY=sk-proj-xxxxx...
VITE_CLICKUP_API_KEY=pk_43150128_xxxxx...
VITE_CLICKUP_TEAM_ID=9010147018
```

**Como Resolver:**
1. Revogar imediatamente todas as chaves nos dashboards (OpenAI, ClickUp)
2. Gerar novas chaves
3. Verificar se `.env` está no `.gitignore` (já está)
4. Remover do histórico Git:
```bash
# Usando BFG Repo-Cleaner (recomendado)
bfg --delete-files .env
git reflog expire --expire=now --all && git gc --prune=now --aggressive

# OU usando git filter-branch
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env' \
  --prune-empty --tag-name-filter cat -- --all
```

**Status:** ⬜ Pendente

---

### 2. Firebase Config Hardcoded

| Campo | Valor |
|-------|-------|
| **Arquivo** | `src/services/firebase.js` |
| **Linha** | 6-13 |
| **CVE/CWE** | CWE-798 (Use of Hard-coded Credentials) |
| **Impacto** | Abuso dos serviços Firebase se não houver Security Rules |

**Código Vulnerável:**
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyAj_5TqOMRSNVm4G0wmE3HgrHEIS7LkkE8",
  authDomain: "cs-hub-8c032.firebaseapp.com",
  projectId: "cs-hub-8c032",
  storageBucket: "cs-hub-8c032.firebasestorage.app",
  messagingSenderId: "266865305025",
  appId: "1:266865305025:web:bb6b7b6e7c2d3aa5b8d5d5"
};
```

**Como Resolver:**

> ⚠️ **Nota:** A API key do Firebase no frontend é aceitável por design, MAS requer Security Rules configuradas corretamente.

1. Mover configuração para variáveis de ambiente:
```javascript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};
```

2. Implementar Firestore Security Rules (ver item #4)

**Status:** ⬜ Pendente

---

### 3. API Keys no Bundle de Produção

| Campo | Valor |
|-------|-------|
| **Arquivo** | `vite.config.js` |
| **Linha** | 17-22 |
| **CVE/CWE** | CWE-200 (Exposure of Sensitive Information) |
| **Impacto** | Qualquer pessoa pode extrair as chaves do JavaScript compilado |

**Código Vulnerável:**
```javascript
define: {
  'import.meta.env.VITE_OPENAI_API_KEY': JSON.stringify(env.VITE_OPENAI_API_KEY || ''),
  'import.meta.env.VITE_CLICKUP_API_KEY': JSON.stringify(env.VITE_CLICKUP_API_KEY || ''),
  'import.meta.env.VITE_CLICKUP_TEAM_ID': JSON.stringify(env.VITE_CLICKUP_TEAM_ID || '9010147018'),
}
```

**Como Resolver:**

Criar um **backend proxy** usando Firebase Cloud Functions ou Vercel Edge Functions:

```javascript
// functions/src/index.ts (Firebase Cloud Functions)
import * as functions from 'firebase-functions';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: functions.config().openai.key // Configurado via firebase functions:config:set
});

export const classifyThread = functions.https.onCall(async (data, context) => {
  // Verificar autenticação
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  // Verificar domínio do email
  if (!context.auth.token.email?.endsWith('@trakto.io')) {
    throw new functions.https.HttpsError('permission-denied', 'Acesso negado');
  }

  // Chamar OpenAI de forma segura
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: data.messages
  });

  return response;
});
```

**Status:** ⬜ Pendente

---

### 4. Ausência de Firestore Security Rules

| Campo | Valor |
|-------|-------|
| **Arquivo** | `firestore.rules` (não existe) |
| **CVE/CWE** | CWE-862 (Missing Authorization) |
| **Impacto** | Acesso total ao banco de dados por qualquer pessoa |

**Como Resolver:**

Criar arquivo `firestore.rules` na raiz do projeto:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Função para verificar autenticação e domínio
    function isAuthenticated() {
      return request.auth != null &&
             request.auth.token.email.matches('.*@trakto\\.io$');
    }

    // Função para verificar se é admin
    function isAdmin() {
      return isAuthenticated() &&
             get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.role in ['admin', 'super_admin'];
    }

    // Função para verificar se é gestor ou superior
    function isGestorOrAbove() {
      return isAuthenticated() &&
             get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.role in ['gestor', 'admin', 'super_admin'];
    }

    // Clientes - leitura para todos autenticados, escrita para gestores+
    match /clientes/{clienteId} {
      allow read: if isAuthenticated();
      allow create, update: if isGestorOrAbove();
      allow delete: if isAdmin();
    }

    // Threads - leitura e escrita para todos autenticados
    match /threads/{threadId} {
      allow read, write: if isAuthenticated();
    }

    // Alertas - leitura e escrita para todos autenticados
    match /alertas/{alertaId} {
      allow read, write: if isAuthenticated();
    }

    // Playbooks - leitura para todos, escrita para gestores+
    match /playbooks/{playbookId} {
      allow read: if isAuthenticated();
      allow write: if isGestorOrAbove();
    }

    // Usuários - leitura para todos autenticados, escrita apenas para admins
    match /usuarios/{userId} {
      allow read: if isAuthenticated();
      allow create, update, delete: if isAdmin();

      // Usuário pode atualizar seu próprio perfil (campos limitados)
      allow update: if isAuthenticated() &&
                       request.auth.uid == userId &&
                       request.resource.data.diff(resource.data).affectedKeys().hasOnly(['nome', 'avatar', 'updated_at']);
    }

    // Configurações - apenas admins
    match /configuracoes/{configId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Auditoria - leitura para gestores+, escrita automática apenas
    match /auditoria/{logId} {
      allow read: if isGestorOrAbove();
      allow create: if isAuthenticated();
      allow update, delete: if false; // Nunca permitir alteração de logs
    }

    // Bloquear tudo que não foi explicitamente permitido
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Deploy das regras:**
```bash
firebase deploy --only firestore:rules
```

**Status:** ⬜ Pendente

---

## 🟠 ALTO (Resolver Esta Semana)

### 5. Validação de Domínio Apenas no Client-Side

| Campo | Valor |
|-------|-------|
| **Arquivo** | `src/contexts/AuthContext.jsx` |
| **Linha** | 17-30 |
| **CVE/CWE** | CWE-602 (Client-Side Enforcement of Server-Side Security) |
| **Impacto** | Bypass da autenticação via API direta do Firebase |

**Código Vulnerável:**
```javascript
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user && user.email?.endsWith('@trakto.io')) {
      setUser(user)
    } else {
      setUser(null)
    }
  })
}, [])
```

**Como Resolver:**

A validação de domínio DEVE ser feita nas Firestore Security Rules (item #4) e opcionalmente via Cloud Functions para bloquear login de outros domínios:

```javascript
// functions/src/auth.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const validateUserDomain = functions.auth.user().onCreate(async (user) => {
  if (!user.email?.endsWith('@trakto.io')) {
    // Deletar usuário criado com domínio inválido
    await admin.auth().deleteUser(user.uid);
    throw new functions.https.HttpsError(
      'permission-denied',
      'Apenas emails @trakto.io são permitidos'
    );
  }
});
```

**Status:** ⬜ Pendente

---

### 6. RBAC Apenas no Client-Side

| Campo | Valor |
|-------|-------|
| **Arquivo** | `src/pages/Usuarios.jsx` |
| **Linha** | 108-122 |
| **CVE/CWE** | CWE-602 (Client-Side Enforcement of Server-Side Security) |
| **Impacto** | Escalação de privilégios |

**Código Vulnerável:**
```javascript
const canManageUsers = () => {
  return currentUserRole === 'admin' || currentUserRole === 'super_admin' ||
         currentUserRole === 'gestor' || user?.email === SUPER_ADMIN_EMAIL;
};
```

**Como Resolver:**

1. Implementar Custom Claims no Firebase Auth:

```javascript
// functions/src/claims.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const setUserRole = functions.https.onCall(async (data, context) => {
  // Verificar se quem está chamando é admin
  if (!context.auth?.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Apenas admins podem alterar roles');
  }

  const { userId, role } = data;

  // Definir custom claim
  await admin.auth().setCustomUserClaims(userId, { role });

  return { success: true };
});
```

2. Usar os claims nas Security Rules:
```javascript
function hasRole(role) {
  return request.auth.token.role == role;
}

function isAdmin() {
  return hasRole('admin') || hasRole('super_admin');
}
```

**Status:** ⬜ Pendente

---

### 7. Página de Debug Acessível em Produção

| Campo | Valor |
|-------|-------|
| **Arquivo** | `src/pages/DebugFirestore.jsx` |
| **Rota** | `/debug` |
| **CVE/CWE** | CWE-489 (Active Debug Code) |
| **Impacto** | Destruição total do banco de dados |

**Como Resolver:**

**Opção 1 - Remover a rota em produção:**
```javascript
// src/App.jsx
const routes = [
  // ... outras rotas
];

// Adicionar rota de debug apenas em desenvolvimento
if (import.meta.env.DEV) {
  routes.push({
    path: '/debug',
    element: <DebugFirestore />
  });
}
```

**Opção 2 - Proteger com verificação de super_admin:**
```javascript
// src/pages/DebugFirestore.jsx
const DebugFirestore = () => {
  const { user } = useAuth();

  // Bloquear acesso em produção
  if (import.meta.env.PROD) {
    return <Navigate to="/" />;
  }

  // Verificar se é super_admin
  if (user?.email !== 'marina@trakto.io') {
    return <Navigate to="/" />;
  }

  // ... resto do componente
};
```

**Recomendação:** Remover completamente o arquivo e a rota em produção.

**Status:** ⬜ Pendente

---

### 8. Console.log com Dados Sensíveis

| Campo | Valor |
|-------|-------|
| **Arquivo** | `src/services/clickup.js` |
| **Linha** | 10-14 |
| **CVE/CWE** | CWE-532 (Insertion of Sensitive Information into Log File) |
| **Impacto** | Information disclosure |

**Código Vulnerável:**
```javascript
console.log('ClickUp Config:', {
  apiKey: CLICKUP_API_KEY ? 'Configurada' : 'NÃO CONFIGURADA',
  listId: CLICKUP_LIST_ID || 'NÃO CONFIGURADO',
  teamId: CLICKUP_TEAM_ID
});
```

**Como Resolver:**

1. Remover todos os console.log em produção usando um plugin do Vite:

```javascript
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : []
  }
});
```

2. Ou usar uma biblioteca de logging com níveis:

```javascript
// src/utils/logger.js
const isDev = import.meta.env.DEV;

export const logger = {
  debug: (...args) => isDev && console.log('[DEBUG]', ...args),
  info: (...args) => isDev && console.info('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
};
```

**Status:** ⬜ Pendente

---

### 9. parseInt sem Validação

| Campo | Valor |
|-------|-------|
| **Arquivo** | `src/services/clickup.js` |
| **Linha** | 60 |
| **CVE/CWE** | CWE-20 (Improper Input Validation) |
| **Impacto** | Comportamento inesperado ou injection |

**Código Vulnerável:**
```javascript
if (responsavelId) {
  body.assignees = [parseInt(responsavelId)];
}
```

**Como Resolver:**
```javascript
if (responsavelId) {
  const id = parseInt(responsavelId, 10);
  if (isNaN(id) || id <= 0) {
    throw new Error('ID do responsável inválido');
  }
  body.assignees = [id];
}
```

**Status:** ⬜ Pendente

---

## 🟡 MÉDIO (Resolver em 2 Sprints)

### 10. Política de Senha Fraca

| Campo | Valor |
|-------|-------|
| **Arquivo** | `src/pages/Usuarios.jsx` |
| **Linha** | 171 |
| **CVE/CWE** | CWE-521 (Weak Password Requirements) |
| **Impacto** | Senhas facilmente descobertas por brute-force |

**Código Vulnerável:**
```javascript
if (formData.senha.length < 6) {
  setFormError('A senha deve ter pelo menos 6 caracteres');
}
```

**Como Resolver:**
```javascript
const validatePassword = (password) => {
  const errors = [];

  if (password.length < 8) {
    errors.push('Mínimo 8 caracteres');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Pelo menos uma letra maiúscula');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Pelo menos uma letra minúscula');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Pelo menos um número');
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Pelo menos um caractere especial');
  }

  return errors;
};

// Uso
const passwordErrors = validatePassword(formData.senha);
if (passwordErrors.length > 0) {
  setFormError('Senha fraca: ' + passwordErrors.join(', '));
  return;
}
```

**Status:** ⬜ Pendente

---

### 11. JSON.parse sem Validação de Schema

| Campo | Valor |
|-------|-------|
| **Arquivo** | `src/services/openai.js` |
| **Linha** | 142 |
| **CVE/CWE** | CWE-502 (Deserialization of Untrusted Data) |
| **Impacto** | Crash da aplicação ou dados malformados |

**Código Vulnerável:**
```javascript
const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
const resultado = JSON.parse(jsonStr);
```

**Como Resolver:**

Usar Zod para validação de schema:

```javascript
import { z } from 'zod';

const ClassificacaoSchema = z.object({
  categoria: z.enum(['duvida', 'problema', 'sugestao', 'elogio', 'outros']),
  sentimento: z.enum(['positivo', 'neutro', 'negativo']),
  urgencia: z.enum(['baixa', 'media', 'alta', 'critica']),
  resumo: z.string().max(500),
  tags: z.array(z.string()).optional()
});

// Uso
const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
const parsed = JSON.parse(jsonStr);
const resultado = ClassificacaoSchema.parse(parsed); // Throws se inválido
```

**Status:** ⬜ Pendente

---

### 12. Erros de API Expostos no Console

| Campo | Valor |
|-------|-------|
| **Arquivo** | `src/services/openai.js`, `src/services/clickup.js` |
| **Linha** | 157, 74 |
| **CVE/CWE** | CWE-209 (Generation of Error Message Containing Sensitive Information) |
| **Impacto** | Exposição de detalhes internos da API |

**Como Resolver:**
```javascript
// Criar erro sanitizado
const sanitizeError = (error) => {
  // Não expor detalhes em produção
  if (import.meta.env.PROD) {
    return {
      message: 'Erro ao processar requisição',
      code: error.code || 'UNKNOWN_ERROR'
    };
  }
  return error;
};

// Uso
try {
  // ... código
} catch (error) {
  console.error('Erro:', sanitizeError(error));
  throw sanitizeError(error);
}
```

**Status:** ⬜ Pendente

---

### 13. Fallback Hardcoded do Team ID

| Campo | Valor |
|-------|-------|
| **Arquivo** | `src/services/clickup.js` |
| **Linha** | 5 |
| **CVE/CWE** | CWE-798 (Use of Hard-coded Credentials) |
| **Impacto** | Exposição de configuração |

**Código Vulnerável:**
```javascript
const CLICKUP_TEAM_ID = import.meta.env.VITE_CLICKUP_TEAM_ID || '9010147018';
```

**Como Resolver:**
```javascript
const CLICKUP_TEAM_ID = import.meta.env.VITE_CLICKUP_TEAM_ID;

if (!CLICKUP_TEAM_ID) {
  console.error('VITE_CLICKUP_TEAM_ID não configurado');
}

// Nas funções que usam, verificar antes:
export async function createClickUpTask(taskData) {
  if (!CLICKUP_TEAM_ID || !CLICKUP_API_KEY) {
    throw new Error('ClickUp não configurado. Verifique as variáveis de ambiente.');
  }
  // ...
}
```

**Status:** ⬜ Pendente

---

### 14. Inputs Numéricos sem Validação de Range

| Campo | Valor |
|-------|-------|
| **Arquivo** | `src/pages/Configuracoes.jsx` |
| **Linha** | 179-191 |
| **CVE/CWE** | CWE-20 (Improper Input Validation) |
| **Impacto** | Valores inválidos no banco de dados |

**Código Vulnerável:**
```javascript
setPesos(prev => ({ ...prev, [field]: Number(value) || 0 }));
```

**Como Resolver:**
```javascript
const validateNumericInput = (value, min = 0, max = 100) => {
  const num = Number(value);
  if (isNaN(num)) return min;
  return Math.min(max, Math.max(min, num));
};

// Uso
setPesos(prev => ({
  ...prev,
  [field]: validateNumericInput(value, 0, 100)
}));
```

**Status:** ⬜ Pendente

---

## 🟢 BAIXO (Backlog)

### 15. Uso de window.location.reload()

| Campo | Valor |
|-------|-------|
| **Arquivo** | `src/pages/DebugFirestore.jsx` |
| **CVE/CWE** | N/A (Code Quality) |
| **Impacto** | UX ruim, perda de estado |

**Como Resolver:**

Usar React state ou React Router:
```javascript
// Em vez de
window.location.reload();

// Usar
const [refreshKey, setRefreshKey] = useState(0);
const handleRefresh = () => setRefreshKey(prev => prev + 1);

// Ou com React Router
const navigate = useNavigate();
navigate(0); // Refresh da rota atual
```

**Status:** ⬜ Pendente

---

### 16. Falta de Rate Limiting

| Campo | Valor |
|-------|-------|
| **Arquivo** | N/A |
| **CVE/CWE** | CWE-770 (Allocation of Resources Without Limits) |
| **Impacto** | Abuso de recursos, custos elevados |

**Como Resolver:**

Implementar rate limiting no backend (Cloud Functions):
```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requisições por IP
  message: 'Muitas requisições, tente novamente mais tarde'
});

app.use('/api/', limiter);
```

**Status:** ⬜ Pendente

---

## 📋 Checklist de Implementação

### Semana 1 (URGENTE)
- [ ] Revogar e regenerar TODAS as API keys (OpenAI, ClickUp)
- [ ] Verificar se `.env` está no `.gitignore`
- [ ] Limpar histórico Git (remover .env dos commits antigos)
- [ ] Criar e fazer deploy das Firestore Security Rules
- [ ] Remover/proteger página `/debug`

### Semana 2
- [ ] Criar backend proxy para APIs externas (Cloud Functions)
- [ ] Implementar Custom Claims no Firebase Auth para roles
- [ ] Remover console.logs sensíveis ou usar plugin do Vite
- [ ] Adicionar validação de inputs numéricos

### Semana 3-4
- [ ] Melhorar política de senhas (mínimo 8 chars, complexidade)
- [ ] Adicionar validação de schema com Zod nas respostas de API
- [ ] Sanitizar mensagens de erro em produção
- [ ] Implementar rate limiting

### Backlog
- [ ] Substituir window.location.reload() por React state
- [ ] Code review completo de segurança
- [ ] Testes de penetração

---

## 📚 Referências

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Firebase Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [CWE - Common Weakness Enumeration](https://cwe.mitre.org/)
- [Firebase Auth Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims)

---

## 📝 Histórico de Revisões

| Data | Versão | Descrição |
|------|--------|-----------|
| Jan 2026 | 1.0 | Análise inicial de segurança |

---

> **Próxima Revisão:** Após implementação das correções críticas
