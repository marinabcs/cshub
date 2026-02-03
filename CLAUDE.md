# CLAUDE.md - Diretrizes do CS Hub

## 📋 ESTADO ATUAL DO PROJETO (Atualizado: Janeiro 2026)

### Status: Em desenvolvimento - Firebase configurado ✅

**O que está pronto:**
- ✅ Frontend React completo com todas as páginas
- ✅ Segmentacao CS (CRESCIMENTO, ESTAVEL, ALERTA, RESGATE) baseada em metricas diretas
- ✅ Classificação de threads com IA (OpenAI GPT-4o-mini)
- ✅ Sistema de auditoria (append-only log)
- ✅ Política de retenção de dados
- ✅ Página Analytics com 5 abas (Uso, Conversas, Usuários, Vendas, Churn)
- ✅ Otimizações de performance (Promise.all, queries paralelas)
- ✅ Documentação técnica completa
- ✅ Firebase configurado com índices
- ✅ Threads e mensagens funcionando

**Índices criados no Firebase:**
- `threads`: team_id + updated_at
- `metricas_diarias`: team_id + data
- `mensagens`: thread_id + data
- `alertas`: status + created_at

**Próximos passos:**
1. Testar outras funcionalidades (Analytics, Alertas, etc)
2. Criar tutorial operacional para usuários finais

### Arquivos de documentação:
- `/docs/TECHNICAL.md` - Documentação técnica completa (arquitetura, APIs, etc)
- `/docs/FIREBASE_SETUP.md` - Setup específico do Firebase (collections, índices)

---

## ⚠️ REGRA PRINCIPAL DE CÓDIGO
**SEMPRE use CSS inline nos componentes React. NÃO use classes Tailwind.**

O projeto usa CSS inline para garantir consistência visual. Quando criar ou editar componentes, use o atributo `style={{}}` em vez de `className=""`.

---

## 🎨 Paleta de Cores
```javascript
const colors = {
  bgPrimary: '#0f0a1f',
  bgCard: 'rgba(30, 27, 75, 0.4)',
  borderPrimary: 'rgba(139, 92, 246, 0.15)',
  textPrimary: 'white',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
  success: '#10b981',
  warning: '#f59e0b',
  orange: '#f97316',
  danger: '#ef4444',
  gradientPrimary: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
};
```

## 📐 Padrões de Estilo

### Card
```javascript
style={{
  background: 'rgba(30, 27, 75, 0.4)',
  border: '1px solid rgba(139, 92, 246, 0.15)',
  borderRadius: '16px',
  padding: '20px'
}}
```

### Botão Primário
```javascript
style={{
  padding: '12px 20px',
  background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
  border: 'none',
  borderRadius: '12px',
  color: 'white',
  fontWeight: '600',
  cursor: 'pointer'
}}
```

### Input
```javascript
style={{
  width: '100%',
  padding: '12px 16px',
  background: '#0f0a1f',
  border: '1px solid #3730a3',
  borderRadius: '12px',
  color: 'white',
  outline: 'none'
}}
```

## 🚫 O que NÃO fazer

1. NÃO use className com Tailwind - Use sempre style={{}}
2. NÃO modifique código quando eu mandar EXATO
3. NÃO use cores diferentes das definidas
4. NÃO use border-radius diferente de 12px, 16px ou 20px

---

## 🏗️ Arquitetura Importante

### Collections do Firebase (usar collection raiz, não subcollections):
- `clientes` - Empresas/clientes
- `threads` - Conversas (com campo `team_id` para queries)
- `mensagens` - Mensagens individuais (com campo `thread_id`)
- `alertas` - Alertas automáticos e manuais
- `metricas_diarias` - Uso da plataforma por dia
- `usuarios_lookup` - Usuários dos clientes
- `auditoria` - Log de ações (nunca deletar)

### Performance:
- SEMPRE usar `Promise.all` para queries independentes
- NUNCA fazer loops com `await` dentro (converter para Promise.all)
- Chunks de queries `in` devem rodar em paralelo

### Segmentacao CS (4 segmentos):
| Segmento | Descricao |
|----------|-----------|
| CRESCIMENTO | Melhores clientes - alto potencial de expansao |
| ESTAVEL | Clientes estaveis - manter engajamento |
| ALERTA | Atencao necessaria - sinais de risco |
| RESGATE | Critico - risco iminente de churn |

Calculo baseado em metricas diretas: dias sem uso, frequencia, reclamacoes, engajamento.
Compatibilidade retroativa com valores antigos (GROW, NURTURE, WATCH, RESCUE) via LEGACY_SEGMENT_MAP.

---

## 📝 Histórico de Decisões

1. **Arquitetura de threads**: Migrado de subcollections (`times/{id}/threads`) para collection raiz (`threads` com campo `team_id`) por performance
2. **CSS**: Inline styles ao invés de Tailwind para consistência
3. **Classificação IA**: OpenAI GPT-4o-mini com fallback para classificação manual
4. **Auditoria**: Append-only, nunca permite update/delete
5. **Segmentacao CS**: Classificacao direta por metricas (sem Health Score intermediario)

---

## 🔗 Integração ClickUp (Janeiro 2026)

### Status: Implementado parcialmente ✅

**O que está funcionando:**
- ✅ Criação automática de tarefas no ClickUp ao criar alertas
- ✅ Criação de tarefas para etapas de playbooks
- ✅ Múltiplos responsáveis (assignees) nas tarefas
- ✅ Nome do cliente no título das tarefas
- ✅ Data de vencimento automática (3 dias)
- ✅ Fechamento de tarefas ao cancelar playbook
- ✅ Sincronização manual (botão em Configurações)
- ✅ Mapeamento de status bidirecional

**Mapeamento de Status CS Hub ↔ ClickUp:**
```javascript
const STATUS_CSHUB_TO_CLICKUP = {
  'pendente': 'pendente',
  'em_andamento': 'em andamento',
  'concluida': 'resolvido',
  'pulada': 'ignorado',
  'bloqueado': 'bloqueado',
  'resolvido': 'resolvido',
  'ignorado': 'ignorado',
  'cancelado': 'ignorado'
};
```

**Variáveis de ambiente necessárias:**
```
VITE_CLICKUP_API_KEY=pk_xxxxxx
VITE_CLICKUP_LIST_ID=xxxxxxx
VITE_CLICKUP_TEAM_ID=xxxxxxx
```

---

## ✅ BUG RESOLVIDO - Alertas não encontravam clientes (30/01/2026)

### Problema original:
Os alertas de sentimento negativo não eram criados porque o cliente não era encontrado no `clientesMap`.

### Causa raiz:
O campo `times` (array de team_ids) nos clientes não estava sendo mapeado no `clientesMap`.

### Solução aplicada (30/01/2026):
1. Adicionado mapeamento do array `cliente.times` no `clientesMap` em `/src/utils/alertas.js`
2. Corrigida função `gerarAlertasSemUso` para buscar threads usando todos os IDs possíveis do cliente

### Código corrigido:
```javascript
// Mapear por CADA ID no array times (principal fonte de team_ids)
if (cliente.times && Array.isArray(cliente.times)) {
  for (const timeId of cliente.times) {
    if (timeId) {
      clientesMap[timeId] = cliente;
    }
  }
}
```

### Arquivos modificados:
- `/src/utils/alertas.js` - Função `verificarTodosAlertas` (linhas 447-458)

---

## 🔒 SEGURANÇA (Atualizado: 30/01/2026)

### ✅ Implementado:
1. ✅ Firestore Security Rules completas (`firestore.rules`)
2. ✅ Console.logs removidos em produção (`vite.config.js` com `esbuild.drop`)
3. ✅ Utilitário de logging criado (`/src/utils/logger.js`)
4. ✅ Fallbacks hardcoded removidos do `vite.config.js`
5. ✅ `.env` no `.gitignore`

### ⚠️ Pendente (requer Cloud Functions):
1. API keys expostas no frontend (VITE_* são visíveis no bundle)
   - **Solução ideal:** Mover chamadas OpenAI e ClickUp para Firebase Cloud Functions
   - Ver `/SEGURANCA.md` para detalhes de implementação
2. Validação de inputs do usuário (usar Zod)
3. Rate limiting nas APIs

---

## ⚡ PERFORMANCE (Atualizado: 30/01/2026)

### ✅ Otimizado:
1. ✅ `useAlertasCount` - Usa queries filtradas por status (não carrega todos alertas)
2. ✅ Console.logs removidos em produção (menos overhead)
3. ✅ Índices Firestore configurados para queries comuns

### ⚠️ A otimizar futuramente:
1. Adicionar paginação em listas grandes (Clientes, Analytics)
2. Implementar cache client-side para dados frequentes
3. Lazy loading para componentes pesados
