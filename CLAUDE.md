# CLAUDE.md - Diretrizes do CS Hub

## 📋 ESTADO ATUAL DO PROJETO (Atualizado: Janeiro 2026)

### Status: Em desenvolvimento - Bloqueado no Firebase

**O que está pronto:**
- ✅ Frontend React completo com todas as páginas
- ✅ Sistema de Health Score (cálculo automático com 5 componentes)
- ✅ Classificação de threads com IA (OpenAI GPT-4o-mini)
- ✅ Sistema de auditoria (append-only log)
- ✅ Política de retenção de dados
- ✅ Página Analytics com 5 abas (Uso, Conversas, Usuários, Vendas, Churn)
- ✅ Otimizações de performance (Promise.all, queries paralelas)
- ✅ Documentação técnica completa

**Bloqueio atual:**
- ⚠️ **Firebase precisa ser configurado pelo time técnico**
- Não conseguimos validar threads porque as collections não estão populadas
- Ver `/docs/FIREBASE_SETUP.md` para instruções de setup

**Próximos passos:**
1. Time técnico configura Firebase (collections, índices, regras)
2. Popular dados de teste ou conectar ingestão real de emails
3. Validar funcionamento das threads e classificação
4. Criar tutorial operacional para usuários finais

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

### Health Score (5 componentes):
| Componente | Peso |
|------------|------|
| Engajamento | 25% |
| Sentimento | 25% |
| Tickets Abertos | 20% |
| Tempo sem Contato | 15% |
| Uso da Plataforma | 15% |

---

## 📝 Histórico de Decisões

1. **Arquitetura de threads**: Migrado de subcollections (`times/{id}/threads`) para collection raiz (`threads` com campo `team_id`) por performance
2. **CSS**: Inline styles ao invés de Tailwind para consistência
3. **Classificação IA**: OpenAI GPT-4o-mini com fallback para classificação manual
4. **Auditoria**: Append-only, nunca permite update/delete
5. **Health Score**: Cálculo diário automático via job agendado
