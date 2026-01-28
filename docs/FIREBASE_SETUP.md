# Firebase Setup - CS Hub

Este documento descreve as collections e índices necessários para o funcionamento do CS Hub.

---

## 1. Collections Obrigatórias

### 1.1 `clientes`

**Descrição:** Empresas/clientes gerenciados pelo CS Hub.

**Campos obrigatórios:**
```javascript
{
  team_name: string,           // Nome do cliente
  status: string,              // "ativo" | "onboarding" | "aviso_previo" | "inativo" | "cancelado"
  times: string[],             // Array de team_ids vinculados
  responsavel_nome: string,    // Nome do CS responsável
  responsavel_email: string,   // Email do CS responsável
  health_score: number,        // 0-100 (calculado automaticamente)
  health_status: string,       // "saudavel" | "atencao" | "risco" | "critico"
  created_at: timestamp,
  updated_at: timestamp
}
```

**Exemplo de documento:**
```json
{
  "team_name": "Empresa Exemplo",
  "status": "ativo",
  "times": ["T001", "T002"],
  "responsavel_nome": "Marina Silva",
  "responsavel_email": "marina@suaempresa.com",
  "health_score": 75,
  "health_status": "atencao",
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-28T00:00:00Z"
}
```

---

### 1.2 `threads`

**Descrição:** Conversas de email agrupadas por thread.

**Campos obrigatórios:**
```javascript
{
  thread_id: string,           // ID original do Gmail
  team_id: string,             // ID do time (para queries)
  subject: string,             // Assunto do email
  status: string,              // "aguardando_equipe" | "aguardando_cliente" | "resolvido"
  created_at: timestamp,
  updated_at: timestamp
}
```

**Campos opcionais (preenchidos pela classificação):**
```javascript
{
  categoria: string,           // "erro_bug" | "problema_tecnico" | "feedback" | etc
  sentimento: string,          // "positivo" | "neutro" | "negativo" | "urgente"
  resumo_ia: string,           // Resumo gerado pela IA
  classificado_em: timestamp,
  classificado_por: string     // "ia" | "manual"
}
```

**Exemplo de documento:**
```json
{
  "thread_id": "18d5a2b3c4e5f6g7",
  "team_id": "T001",
  "subject": "Problema com exportação de PDF",
  "status": "aguardando_equipe",
  "categoria": "problema_tecnico",
  "sentimento": "negativo",
  "resumo_ia": "Cliente relata erro ao exportar documentos em PDF",
  "created_at": "2026-01-25T10:00:00Z",
  "updated_at": "2026-01-28T14:30:00Z"
}
```

---

### 1.3 `mensagens`

**Descrição:** Mensagens individuais de cada thread.

**Campos obrigatórios:**
```javascript
{
  thread_id: string,           // Referência à thread
  message_id: string,          // ID único da mensagem (para deduplicação)
  de: string,                  // Email do remetente
  corpo: string,               // Conteúdo da mensagem
  data: timestamp              // Data/hora do email
}
```

**Exemplo de documento:**
```json
{
  "thread_id": "thread_xyz789",
  "message_id": "msg_abc123",
  "de": "cliente@empresa.com",
  "para": ["suporte@suaempresa.com"],
  "assunto": "Re: Problema com exportação de PDF",
  "corpo": "O erro continua acontecendo quando tento exportar...",
  "data": "2026-01-28T14:30:00Z"
}
```

---

### 1.4 `alertas`

**Descrição:** Alertas que requerem ação do time de CS.

**Campos obrigatórios:**
```javascript
{
  tipo: string,                // "sentimento_negativo" | "erro_bug" | "inatividade" | "churn_risk"
  titulo: string,
  mensagem: string,
  prioridade: string,          // "baixa" | "media" | "alta" | "urgente"
  status: string,              // "pendente" | "em_andamento" | "resolvido"
  time_id: string,
  created_at: timestamp
}
```

**Exemplo de documento:**
```json
{
  "tipo": "sentimento_negativo",
  "titulo": "Sentimento URGENTE detectado: Empresa Exemplo",
  "mensagem": "Cliente demonstrou insatisfação com tempo de resposta",
  "prioridade": "urgente",
  "status": "pendente",
  "time_id": "T001",
  "time_name": "Empresa Exemplo",
  "thread_id": "thread_xyz789",
  "responsavel_email": "marina@suaempresa.com",
  "created_at": "2026-01-28T14:35:00Z"
}
```

---

### 1.5 `metricas_diarias`

**Descrição:** Métricas de uso da plataforma agregadas por dia/time.

**Campos obrigatórios:**
```javascript
{
  team_id: string,
  data: timestamp,             // Data do registro
  logins: number,
  pecas_criadas: number,
  downloads: number,
  uso_ai_total: number
}
```

**ID do documento:** `{team_id}_{YYYY-MM-DD}`

**Exemplo de documento:**
```json
{
  "team_id": "T001",
  "data": "2026-01-28T00:00:00Z",
  "logins": 15,
  "pecas_criadas": 8,
  "downloads": 12,
  "uso_ai_total": 25
}
```

---

### 1.6 `usuarios_lookup`

**Descrição:** Usuários dos clientes (para contagem e listagem).

**Campos obrigatórios:**
```javascript
{
  team_id: string,
  email: string,
  nome: string,
  status: string,              // "ativo" | "inativo"
  created_at: timestamp
}
```

**Exemplo de documento:**
```json
{
  "team_id": "T001",
  "email": "joao@cliente.com",
  "nome": "João Silva",
  "cargo": "Designer",
  "status": "ativo",
  "created_at": "2026-01-01T00:00:00Z"
}
```

---

### 1.7 `usuarios_sistema`

**Descrição:** Usuários do CS Hub (time interno).

**Campos obrigatórios:**
```javascript
{
  email: string,
  nome: string,
  role: string                 // "admin" | "cs" | "viewer"
}
```

---

### 1.8 `auditoria`

**Descrição:** Log de ações (append-only, nunca deletar).

**Campos obrigatórios:**
```javascript
{
  acao: string,
  descricao: string,
  entidade_tipo: string,       // "cliente" | "thread" | "alerta"
  entidade_id: string,
  usuario_email: string,
  created_at: timestamp
}
```

---

## 2. Índices Compostos Obrigatórios

Criar no Firebase Console → Firestore → Indexes:

### Índice 1: threads por team_id
```
Collection: threads
Fields:
  - team_id (Ascending)
  - updated_at (Descending)
```

### Índice 2: metricas_diarias por team e data
```
Collection: metricas_diarias
Fields:
  - team_id (Ascending)
  - data (Descending)
```

### Índice 3: alertas por status
```
Collection: alertas
Fields:
  - status (Ascending)
  - created_at (Descending)
```

### Índice 4: mensagens por thread
```
Collection: mensagens
Fields:
  - thread_id (Ascending)
  - data (Ascending)
```

### Índice 5: usuarios_lookup por team
```
Collection: usuarios_lookup
Fields:
  - team_id (Ascending)
```

---

## 3. Regras de Segurança

Cole no Firebase Console → Firestore → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Função helper para verificar autenticação
    function isAuthenticated() {
      return request.auth != null;
    }

    // Clientes - leitura e escrita para autenticados
    match /clientes/{clienteId} {
      allow read, write: if isAuthenticated();

      // Subcollection health_history
      match /health_history/{historyId} {
        allow read, write: if isAuthenticated();
      }
    }

    // Threads
    match /threads/{threadId} {
      allow read, write: if isAuthenticated();
    }

    // Mensagens
    match /mensagens/{messageId} {
      allow read, write: if isAuthenticated();
    }

    // Alertas
    match /alertas/{alertaId} {
      allow read, write: if isAuthenticated();
    }

    // Métricas diárias
    match /metricas_diarias/{metricaId} {
      allow read, write: if isAuthenticated();
    }

    // Usuários lookup
    match /usuarios_lookup/{userId} {
      allow read, write: if isAuthenticated();
    }

    // Usuários do sistema
    match /usuarios_sistema/{userId} {
      allow read, write: if isAuthenticated();
    }

    // Auditoria - SOMENTE LEITURA E CRIAÇÃO (nunca update/delete)
    match /auditoria/{auditId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if false;
    }

    // Times (legado)
    match /times/{timeId} {
      allow read, write: if isAuthenticated();

      match /{subcollection}/{docId} {
        allow read, write: if isAuthenticated();
      }
    }
  }
}
```

---

## 4. Dados de Teste

Para testar o sistema, crie pelo menos:

### 4.1 Um cliente de teste

```javascript
// Collection: clientes
// Document ID: cliente_teste_001
{
  "team_name": "Cliente Teste",
  "status": "ativo",
  "times": ["time_teste_001"],
  "responsavel_nome": "CS Teste",
  "responsavel_email": "cs@teste.com",
  "health_score": 75,
  "health_status": "atencao",
  "created_at": Timestamp.now(),
  "updated_at": Timestamp.now()
}
```

### 4.2 Uma thread de teste

```javascript
// Collection: threads
// Document ID: thread_teste_001
{
  "thread_id": "gmail_thread_teste",
  "team_id": "time_teste_001",
  "subject": "Teste de thread",
  "status": "aguardando_equipe",
  "created_at": Timestamp.now(),
  "updated_at": Timestamp.now()
}
```

### 4.3 Uma mensagem de teste

```javascript
// Collection: mensagens
// Document ID: msg_teste_001
{
  "thread_id": "thread_teste_001",
  "message_id": "gmail_msg_teste",
  "de": "cliente@teste.com",
  "para": ["suporte@empresa.com"],
  "assunto": "Teste de thread",
  "corpo": "Esta é uma mensagem de teste para validar o sistema.",
  "data": Timestamp.now()
}
```

### 4.4 Métricas de teste

```javascript
// Collection: metricas_diarias
// Document ID: time_teste_001_2026-01-28
{
  "team_id": "time_teste_001",
  "data": Timestamp.fromDate(new Date("2026-01-28")),
  "logins": 10,
  "pecas_criadas": 5,
  "downloads": 3,
  "uso_ai_total": 8
}
```

---

## 5. Verificação

Após configurar, verificar no console do browser:

1. Abrir a página de Clientes
2. Verificar se carrega sem erros
3. Abrir um cliente específico
4. Verificar se as abas funcionam
5. Testar a classificação de thread (requer API key da OpenAI)

Se aparecer erro de índice:
- O Firebase mostra link direto para criar o índice
- Clicar no link e aguardar criação (pode levar alguns minutos)

---

## 6. Migração de Dados

Se você tem dados em outra estrutura, precisará migrar:

### De subcollections para collection raiz (threads)

```javascript
// Script de migração (rodar uma vez)
async function migrarThreads() {
  const timesSnap = await getDocs(collection(db, 'times'));

  for (const timeDoc of timesSnap.docs) {
    const teamId = timeDoc.id;
    const threadsSnap = await getDocs(
      collection(db, 'times', teamId, 'threads')
    );

    for (const threadDoc of threadsSnap.docs) {
      const data = threadDoc.data();

      // Criar na collection raiz
      await setDoc(doc(db, 'threads', threadDoc.id), {
        ...data,
        team_id: teamId  // Adicionar referência ao time
      });
    }
  }
}
```

---

**Dúvidas?** Consulte a documentação técnica completa em `docs/TECHNICAL.md`.
