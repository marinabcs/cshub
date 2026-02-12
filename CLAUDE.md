# CLAUDE.md - Diretrizes do CS Hub

## 📋 ESTADO ATUAL DO PROJETO (Atualizado: 11/02/2026)

### Status: Pronto para Lançamento ✅

**O que está pronto:**
- ✅ Frontend React completo com todas as 17 páginas
- ✅ Saúde CS (CRESCIMENTO, ESTAVEL, ALERTA, RESGATE) baseada em métricas diretas
- ✅ Classificação de threads com IA (OpenAI GPT-4o-mini)
- ✅ Sistema de auditoria (append-only log)
- ✅ Política de retenção de dados
- ✅ Página Analytics com 5 abas (Uso, Conversas, Usuários, Vendas, Churn)
- ✅ Otimizações de performance (Promise.all, queries paralelas)
- ✅ Firebase configurado com índices + Firestore rules com RBAC
- ✅ 13 Cloud Functions deployadas (segurança completa)
- ✅ Transcrição de reuniões (texto manual + resumo IA)
- ✅ Classificação automática de threads via Cloud Function (não mais no n8n)
- ✅ Sistema Ongoing completo (ações recorrentes por saúde)
- ✅ Minha Carteira com filtros multiselect (Status, Saúde, Responsável)
- ✅ Seção "Sem Playbook" em Minha Carteira
- ✅ 347 testes automatizados passando (Vitest)
- ✅ Status "onboarding" removido (tratado como "ativo")
- ✅ Label "Segmento" renomeado para "Saúde" em toda a UI
- ✅ Status de threads classificado por IA (resolvido, aguardando_cliente, aguardando_equipe)
- ✅ Ações do Ongoing atualizadas conforme Playbook V1 (com timelines D0, D7, etc.)
- ✅ Templates redesenhados com cards expansíveis, preview de email e feedback visual
- ✅ Gráficos de métricas (Escala e IA) nos últimos 60 dias em ClienteDetalhe
- ✅ Modal "Copiar Destinatários" corrigido (busca usuários pelos times do cliente)
- ✅ Terminologia "bug/reclamação" no Playbook Fluxograma
- ✅ Página "Oportunidades de Vendas" substituiu Resumo Executivo (clientes em CRESCIMENTO, dias, vezes, case obtido)

**Índices criados no Firebase:**
- `threads`: team_id + updated_at
- `metricas_diarias`: team_id + data
- `mensagens`: thread_id + data
- `alertas`: status + created_at

**Revisão pré-lançamento (em andamento):**
- ✅ Dashboard — OK
- ✅ Minha Carteira — OK (filtros refeitos, layout reorganizado)
- ✅ Clientes (lista) — OK (filtro status virou dropdown multiselect, layout reorganizado: linha 1 busca, linha 2 todos os filtros, contagens respeitam filtro de status)
- ✅ Cliente Detalhe — OK (abas Conversas+Interações unificadas, Playbooks removida, stakeholders com add/delete, todos responsáveis exibidos, cards métricas: Logins/Projetos/Assets/Créditos IA)
- ✅ Cliente Form — OK (removido: Tags de Contexto, Onboarding e Produto, Calendário de Campanhas, Pessoa para Video; Health Score→Saúde CS; Promise.all em queries; serverTimestamp; schema limpo)
- ✅ Resumo Executivo — OK (queries paralelas com Promise.all; nome||team_name consistente; imports limpos)
- ✅ Analytics — OK (imports limpos; nome||team_name; filtros globais Saúde+Status adicionados; fórmula score exibida; PDF tema claro; ExcelJS para export)
- ⚠️ Analytics PDF — tema claro funciona mas números grandes ainda cortam na parte inferior (precisa ajuste no clipping do html2canvas)
- Documentos — oculto (disponível dentro do cliente)
- ✅ Ongoing — OK (cards, D+X, nome clicável)
- ✅ Onboarding — OK
- ✅ Alertas — OK (reduzido para: sentimento_negativo, problema_reclamacao, entrou_resgate)
- ✅ Configurações — OK (Saúde CS: reclamações como números, pesos inteiros, regras especiais removidas, inputs 60px)
- ✅ Usuarios — OK (CRUD completo, 5 roles, atribuição de carteira multi-responsável, reset senha, validação senha forte)
- ✅ Auditoria — OK (filtros por entidade/ação/usuário/data, paginação 50/página, export CSV, entidades auth+system adicionadas)

**Validações manuais pós-lançamento:**
- Validar segmentação com 5 contas reais
- Testar Calculadora de Onboarding com cliente real
- Métricas: validar números/contagens em Dashboard KPIs, Analytics, etc.

**Adiado para V3:**
- 2FA para admins
- Calculadora de Onboarding (refinamentos)
- Analytics PDF (números grandes cortam na parte inferior)
- Bugs com peso por severidade (ver decisão 27)

---

## 📝 NOTAS DA SESSÃO (11/02/2026)

### Concluído nesta sessão:

1. **Templates (OnGoing.jsx)** - Redesign completo:
   - Cards expansíveis por template (clique para ver preview)
   - Preview de email estilizado com assunto destacado
   - Box de contexto por categoria (Momento + Tom)
   - Botão "Copiar Template" com feedback visual "Copiado!" (2s)
   - Tabela de referência rápida no final
   - Botão "Destinatários" movido para linha da busca

2. **Modal "Copiar Destinatários"** - Correções:
   - Busca usuários pelos `times` do cliente (não mais pelo ID principal)
   - Integração com hook `useUserActivityStatus` para classificação real (heavy_user/active/inactive)
   - Ícones: Estrela = Stakeholder, Coroa = Heavy User, Círculo verde = Ativo, Círculo cinza = Inativo
   - Botão "Selecionar todos" adicionado
   - Exibe nome do time (team_name) em vez do ID

3. **Gráficos de Métricas (ClienteDetalhe.jsx)**:
   - Dois gráficos LineChart (Recharts) nos últimos 60 dias
   - Gráfico ESCALA: Logins, Projetos, Assets
   - Gráfico IA: Créditos consumidos, Features únicas
   - Features conta quantidade de features diferentes (não soma de créditos)

4. **Terminologia "bug/reclamação"**:
   - PlaybookFluxograma.jsx: "BUGS" → "BUGS/RECLAMAÇÕES"
   - segmentoCS.js: critérios atualizados com "bug/reclamação"

### Pendências para próxima sessão:

1. **n8n - Sync Usuarios Lookup**: Usuários não estão crescendo na exportação
   - Workflow: `[CS Hub] Sync Usuarios Lookup`
   - Usa `user_id` como chave de upsert (pode haver duplicatas por email com user_ids diferentes)
   - Verificar se n8n está rodando corretamente às 5h
   - Possível causa: filtro `WHERE team_name NOT IN ('Hostgator')` pode estar excluindo demais

2. **Validar em produção**:
   - Testar modal de destinatários com cliente real (ex: Anima)
   - Verificar se gráficos de métricas aparecem corretamente
   - Testar botão "Copiar Template" em diferentes navegadores

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

### Saúde CS (4 níveis):
| Saúde | Descricao |
|-------|-----------|
| CRESCIMENTO | Melhores clientes - alto potencial de expansao |
| ESTAVEL | Clientes estaveis - manter engajamento |
| ALERTA | Atencao necessaria - sinais de risco |
| RESGATE | Critico - risco iminente de churn |

> **Nota:** No código, variáveis e campos Firestore usam "segmento" (nome técnico), mas na UI o termo exibido é "Saúde".

Calculo baseado em metricas diretas: dias sem uso, frequencia, reclamacoes, engajamento.
Compatibilidade retroativa com valores antigos (GROW, NURTURE, WATCH, RESCUE) via LEGACY_SEGMENT_MAP.

---

## 📝 Histórico de Decisões

1. **Arquitetura de threads**: Migrado de subcollections (`times/{id}/threads`) para collection raiz (`threads` com campo `team_id`) por performance
2. **CSS**: Inline styles ao invés de Tailwind para consistência
3. **Classificação IA**: OpenAI GPT-4o-mini com fallback para classificação manual
4. **Auditoria**: Append-only, nunca permite update/delete
5. **Saúde CS**: Classificação direta por métricas (sem Health Score intermediário). Na UI usa "Saúde", no código variáveis mantêm "segmento"
6. **Playbook = plano de atividades gerado por Onboarding ou Ongoing**. Quando o sistema diz "sem playbook", significa que o cliente não tem nenhum onboarding ou ongoing ativo
7. **Status "onboarding" removido** (05/02/2026). Clientes com status onboarding são tratados como "ativo" em todo o software
8. **Filtros Minha Carteira**: Dropdown multiselect para Status (default: ativo + aviso_prévio) e Saúde (default: todos). Responsável default: usuário logado
9. **Clientes (lista)**: Filtro status mudou de chips para dropdown multiselect. Layout: linha 1 = busca, linha 2 = Status + Saúde + Escopo + Área + Ordenar + Problemas + Limpar + contagem. Contagens dos filtros respeitam o filtro de status ativo (não contam inativos/cancelados)
10. **ClienteDetalhe tabs**: Abas reduzidas de 10 para 6 (resumo, interacoes, onboarding, ongoing, documentos, pessoas). "Conversas"+"Interações"+"Observações" unificadas em timeline única. "Playbooks" e "Bugs" removidas. Tipos: email, reunião, observação, onboarding, feedback, suporte, treinamento, qbr, outro. Timeline tem filtro de texto + filtro de tipo. Dois botões: "+ Observação" e "+ Interação"
13. **Aba Bugs removida** do ClienteDetalhe. Será readicionada quando houver fluxo com time técnico. Threads classificadas como bug pela IA serão o mecanismo futuro
14. **Tipo de contato "Time Google"** adicionado aos stakeholders (decisor, operacional, financeiro, técnico, time_google, outro)
11. **Stakeholders inline**: Botão "Adicionar" direto na aba Pessoas do ClienteDetalhe com formulário inline (nome, email, cargo, telefone, linkedin, tipo_contato). Botão excluir em cada card
12. **Múltiplos responsáveis**: ClienteDetalhe header mostra todos os nomes do array `cliente.responsaveis` (campo `{ email, nome }[]`), com fallback para `responsavel_nome` legado
15. **Classificação IA movida para Cloud Function** (09/02/2026). n8n agora só importa dados brutos com `classificado_por: 'pendente'`. A Cloud Function `classifyPendingThreads` classifica automaticamente 2x/dia (7:30 e 13:30, após imports)
16. **Filtro "Esconder informativos"** (09/02/2026). Timeline de interações tem checkbox para ocultar threads com `requer_acao: false` (compartilhamentos, etc). Ativo por padrão
17. **Transcrição de reuniões simplificada** (09/02/2026). Usuário cola texto da transcrição (Google Docs) + link opcional. IA gera resumo estruturado (resumo, pontos_chave, acoes_combinadas, sentimento)
18. **Export CSV melhorado** (09/02/2026). Inclui todos os responsáveis, escopos (categorias_produto) e team_type
19. **Filtros de email centralizados no CS Hub** (09/02/2026). n8n busca filtros do Firestore (`config/email_filters`) ao invés de usar listas hardcoded. Gerenciamento via Configurações → Filtros de Email
20. **Nova estrutura de métricas** (09/02/2026). Métricas divididas em dois pilares:
    - **ESCALA**: `logins`, `projetos_criados`, `pecas_criadas` (assets), `downloads`
    - **AI**: `creditos_consumidos`, `features_usadas` (objeto com breakdown por feature)
    - Campos `uso_ai_total` mantido para retrocompatibilidade
    - Fórmula de engajamento: `(logins × peso_logins) + (projetos × peso_projetos) + (assets × peso_pecas) + (downloads × peso_downloads) + (créditos IA × peso_creditos)`
    - Pesos configuráveis em Configurações → Saúde CS (valores inteiros)
    - Pesos padrão: logins=1, projetos=5, assets=1, downloads=0, creditos=3
21. **Reclamações como números** (09/02/2026). Reclamações em aberto mudou de boolean (permite/não permite) para número (máximo permitido por nível). Ex: CRESCIMENTO=0, ESTÁVEL=1, ALERTA=2, RESGATE=99. Bugs contam como reclamações.
22. **Regras especiais removidas** (09/02/2026). Removida seção "Regras Especiais de Classificação" (aviso_previo, champion_saiu, etc). Classificação agora é puramente baseada em: 1º Reclamações → 2º Dias ativos → 3º Engajamento.
23. **Cards ClienteDetalhe atualizados** (09/02/2026). Cards de métricas: Logins, Projetos, Assets, Créditos IA. Resumo simplificado: "X dias ativos no mês | Score engajamento: Y"
24. **Session timeout** (09/02/2026). Auto-logout após 8h de inatividade. Modal de aviso 60s antes do logout. Hook: `useSessionTimeout.js`
25. **ExcelJS** (09/02/2026). Biblioteca xlsx (vulnerável) substituída por ExcelJS. npm audit agora retorna 0 vulnerabilidades.
26. **Auditoria expandida** (10/02/2026). Página Auditoria atualizada com novas entidades (auth, system) e ações (login_sucesso, login_falha, logout, session_timeout, backup_firestore). Filtros funcionais por entidade, ação, usuário e período.
27. **[V3] Bugs com peso por severidade** (10/02/2026). Proposta para substituir contagem simples de bugs por sistema de pontos:
    - **Severidades:** Crítico (3 pts: não exporta, plataforma trava), Médio (2 pts: funcionalidade quebrada), Baixo (1 pt: UI, erro pontual)
    - **Regra:** 0 pts = normal, 1-2 pts = ALERTA, 3+ pts = RESGATE
    - **Benefício:** 2 bugs visuais (2 pts) → Alerta, 1 bug crítico (3 pts) → Resgate direto
    - **Implementação:** IA classifica severidade automaticamente ou CS ajusta manualmente
28. **Carência de 7 dias** (10/02/2026). Quando cliente cai de nível (exceto para RESGATE), período de carência de 7 dias:
    - **Queda para RESGATE:** Ação imediata, sem carência
    - **Queda para ALERTA/ESTÁVEL:** Inicia carência de 7 dias
    - **Alerta imediato:** `carencia_comunicacao` - CS deve comunicar com cliente
    - **Após 7 dias:** Se não recuperou, cria `carencia_playbook` - iniciar playbook do novo nível
    - **Recuperação:** Se cliente subir de nível durante carência, alertas são cancelados automaticamente
    - **Cloud Functions:** `registrarTransicoesNivel` gerencia carência, `verificarCarenciasVencidas` (7h BRT) verifica vencimentos
    - **Campos no cliente:** `carencia_nivel { ativa, data_inicio, data_fim, segmento_de, segmento_para, motivo, alerta_comunicacao_id, alerta_playbook_id }`
    - **UI:** Card de carência na aba Ongoing mostra dias restantes e barra de progresso
29. **Critérios de Saída do Resgate** (10/02/2026). Configurações para cliente sair do nível RESGATE:
    - **Parâmetros configuráveis:** `saida_resgate_dias_ativos` (default: 5), `saida_resgate_engajamento` (default: 15), `saida_resgate_bugs_zero` (default: true)
    - **Regra:** Cliente em RESGATE só é promovido se atender TODOS os critérios simultaneamente
    - **Lógica:** Se cliente está em RESGATE e teria sido promovido pela classificação normal, verifica critérios de saída primeiro
    - **UI:** Configurações → Saúde CS → Seção "Critérios de Saída do Resgate" com 3 campos editáveis
    - **Motivo exibido:** Quando não atinge critérios, motivo mostra quais critérios faltam (ex: "5/5 dias, score 10/15")
30. **Tags em Observações** (10/02/2026). Tags predefinidas para categorizar observações qualitativas:
    - **Tags disponíveis:** Roadmap, Sazonalidade, Champion Saiu, Reestruturação, Concorrência, Expansão, Treinamento, Integração
    - **Constante:** `TAGS_OBSERVACAO` no ClienteDetalhe.jsx
    - **UI:** Seleção múltipla com chips clicáveis no formulário de observação
    - **Armazenamento:** Campo `tags` (array de strings) na collection `observacoes_cs`
    - **Exibição:** Tags coloridas abaixo do texto da observação na timeline
    - **Tooltip:** Cada tag tem descrição ao passar o mouse
31. **Flag de Oportunidade de Vendas** (10/02/2026). Permite sinalizar clientes com potencial de vendas:
    - **Tipos de oportunidade:** Upsell, Cross-sell, Renovação Antecipada, Expansão
    - **Campos:** `tipo`, `valor_estimado` (opcional), `notas` (opcional), `criado_em`, `criado_por`
    - **Localização:** Seção Ongoing na página ClienteDetalhe (antes do ciclo ativo)
    - **Armazenamento:** Campo `oportunidade_vendas` no documento do cliente (`clientes/{id}`)
    - **UI:** Card colorido quando ativa, botão para adicionar quando inativa, formulário com tipos selecionáveis
    - **Ações:** Criar, Editar, Remover oportunidade
    - **Constante:** `TIPOS_OPORTUNIDADE` no OngoingSection.jsx
32. **Status de Thread Classificado por IA** (11/02/2026). IA agora determina o status da conversa:
    - **Problema anterior:** n8n usava regra simples (última msg do cliente → aguardando_equipe), ignorando contexto
    - **Solução:** IA analisa conteúdo e ÚLTIMA MENSAGEM para determinar status correto
    - **Valores possíveis:** `resolvido`, `aguardando_cliente`, `aguardando_equipe`
    - **Critérios IA (baseados na última mensagem):**
      - `resolvido` → cliente disse "obrigado", "valeu", "perfeito", confirmou que funcionou
      - `aguardando_cliente` → última msg é da EQUIPE (respondeu, enviou material, "fico à disposição")
      - `aguardando_equipe` → última msg é do CLIENTE (pergunta não respondida)
    - **Arquivos:** `functions/index.js` (CLASSIFY_PROMPT), `src/validation/thread.js` (schema Zod), `src/hooks/useClassificarThread.js`, `src/pages/ClienteDetalhe.jsx`
    - **Benefício:** Threads com "Obrigado!" → resolvido; Equipe respondeu → aguardando_cliente
33. **Ações Padrão do Ongoing - Playbook V1** (11/02/2026). Ações atualizadas conforme documento oficial:
    - **CRESCIMENTO (Mensal):** Reconhecimento + case, Compartilhar case do segmento, Expansão estratégica, Sinalizar para Vendas
    - **ESTÁVEL (Mensal):** Check-in, Novidade Trakto/IA ou data do mercado, Mapear sazonalidade/calendário, Monitorar renovação
    - **ALERTA (21 dias):** D0-1 comunicação rápida, D7 verificar, D7-8 e-mail aprofundado, D8-14 call diagnóstico, D14-21 métricas, D21+ escalar
    - **RESGATE (15-30 dias):** D0 alerta imediato, D0-1 revisar perfil, D1-2 e-mail diagnóstico, D2-3 acionar Vendas, D3-5 call 30min, D5-7 roadmap, D7+ acompanhamento semanal
    - **Critérios atualizados:** CRESCIMENTO (20+ dias, score 100+), ESTÁVEL (8-19 dias, score 30-99), ALERTA (1 bug OU 3-7 dias, score 5-29), RESGATE (2+ bugs OU 0-2 dias, score 0-4)
    - **Arquivo:** `src/utils/segmentoCS.js` (SEGMENTOS_CS)
34. **Página Oportunidades de Vendas** (12/02/2026). Substituiu o Resumo Executivo:
    - **Objetivo:** Lista de clientes em CRESCIMENTO prontos para expansão/vendas
    - **Dados exibidos:** Nome, quantidade de usuários, dias em crescimento, vezes em crescimento, stakeholders, case obtido
    - **Níveis de crescimento:** 60+ dias (verde), 30+ dias (roxo), Recente (ciano)
    - **Campo adicionado:** `case_obtido` (boolean) no cliente - checkbox na tabela
    - **Cálculo dias:** Usa collection `interacoes` com `tipo: 'transicao_nivel'` para encontrar última transição para CRESCIMENTO
    - **Cálculo vezes:** Conta quantas vezes o cliente já atingiu CRESCIMENTO no histórico
    - **Filtros:** Por nível de crescimento, por case (obtido/pendente), busca por nome
    - **Ordenação:** Por dias, usuários, vezes ou nome (clicável nos headers)
    - **Arquivo:** `src/pages/ResumoExecutivo.jsx`
    - **Menu:** Renomeado de "Resumo Executivo" para "Oportunidades"

---

## 📋 Sistema Ongoing (Ações Recorrentes)

- **Ações padrão**: Configuráveis por saúde em `config/ongoing` (Configurações > Ongoing > Ações Padrão)
- **Ciclo**: Conjunto de ações atribuídas a um cliente por período (mensal/bimestral), armazenado em `clientes/{id}/ongoing_ciclos/{cicloId}`
- **Fluxo**: Configurar ações → Atribuir ciclo ao cliente → CS executa ações → Ciclo termina → CS reatribui (cliente pode ter mudado de saúde)
- **Página Ongoing** (`/ongoing`): 2 abas — "Clientes" (lista com atribuição) e "Ações Padrão" (config por saúde)
- **ClienteDetalhe** (`/clientes/:id`): aba "Ongoing" mostra ciclo ativo com checklist + histórico
- **Minha Carteira**: seção "Sem Playbook" lista clientes sem onboarding ou ongoing ativo
- **Subcollections Firestore**: `ongoing_ciclos`, `onboarding_planos` (regras deployadas)

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

## 📧 Integração n8n (Atualizado: 09/02/2026)

### Fluxos n8n:
| Fluxo | Horário | Descrição |
|-------|---------|-----------|
| Export Usuários | 04:00-06:00 | Exporta usuários dos clientes para `usuarios_lookup` |
| Export Times | 04:00-06:00 | Exporta times/clientes para `clientes` |
| Export Métricas | 04:00-06:00 | Exporta métricas de uso para `metricas_diarias` |
| Import Emails | 07:00, 13:00 | Importa emails do Gmail para `threads` e `mensagens` |

### Arquitetura de Emails:
```
n8n (import)              →  Firestore (dados brutos)    →  CS Hub (classificação IA)
Gmail API → Filtros →        classificado_por: 'pendente'    classifyPendingThreads
Salvar threads/mensagens                                      (7:30 e 13:30)
```

### Fluxo Import Emails (n8n):
1. **Schedule** (7h, 13h) → Buscar emails das últimas 20h
2. **Buscar Dominios** → Mapear domínios para clientes
3. **Gmail API** → Buscar emails de cada colaborador CS
4. **Consolidar Threads** → Filtrar spam, agrupar por thread, extrair dados
5. **IF Thread** → Separar threads de mensagens
6. **Salvar** → Upsert no Firestore (threads + mensagens)

### Campos salvos nas threads (sem classificação IA):
```javascript
{
  thread_id, team_id, cliente_id, team_name, team_type,
  assunto, status, dias_sem_resposta_cliente,
  total_mensagens, ultima_msg_cliente, ultima_msg_equipe,
  colaborador_responsavel, conversa_para_resumo,
  classificado_por: 'pendente',  // Cloud Function vai classificar
  classificado_em: null,
  resumo_ia: null, sentimento: null, categoria: null
}
```

### Classificação Automática (Cloud Function):
- **Função:** `classifyPendingThreads`
- **Schedule:** 7:30 e 13:30, seg-sex (após imports do n8n)
- **Busca:** Threads com `classificado_por: null` ou `'pendente'`
- **Processa:** Batches de 5, usa GPT-4o-mini
- **Atualiza:** `categoria`, `sentimento`, `resumo_ia`, `classificado_por: 'ia_automatico'`

### Filtros de Spam (integrados):
- **Configuração:** CS Hub → Configurações → Filtros de Email
- **Storage:** Firestore `config/email_filters`
- **n8n:** Busca filtros do Firestore antes de processar emails
- **Campos configuráveis:**
  - `dominios_bloqueados` - Prefixos de email (noreply@, newsletter@, etc.)
  - `dominios_completos_bloqueados` - Domínios inteiros (mailchimp.com, sendgrid.net)
  - `palavras_chave_assunto` - Palavras para ignorar (unsubscribe, out of office)
  - `assuntos_informativos` - Registra mas marca como `requer_acao: false`

### Timeline no CS Hub:
- Checkbox "Esconder informativos" (ativo por padrão)
- Filtra threads com `requer_acao: false`

---

## 🔔 Sistema de Alertas (Atualizado: 06/02/2026)

### Tipos de Alertas ATIVOS:
| Tipo | Descrição | Prioridade |
|------|-----------|------------|
| `sentimento_negativo` | Conversa com sentimento negativo/urgente | Alta/Urgente |
| `problema_reclamacao` | Thread categorizada como erro/bug/reclamação | Alta |
| `entrou_resgate` | Cliente entrou no segmento RESGATE | Urgente |

### Tipos DESATIVADOS (mantidos para histórico):
- `sem_uso_plataforma` — Já tratado pela Saúde CS (14d→ALERTA, 30d→RESGATE)
- `sazonalidade_alta_inativo` — Desativado temporariamente

### Verificação Automática:
- **Cloud Function:** `verificarAlertasAutomatico`
- **Horários:** 9h e 14h (seg-sex, horário de Brasília, após classificação)
- **Lógica:** Verifica threads dos últimos 7 dias + clientes em RESGATE
- **ClickUp:** Cria tarefas automaticamente para cada alerta (requer `CLICKUP_LIST_ID` secret)

### Arquivos relevantes:
- `/src/utils/alertas.js` — Funções de geração de alertas
- `/src/pages/Alertas.jsx` — Interface de gerenciamento
- `/functions/index.js` — Cloud Function scheduled

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

## 🔒 SEGURANÇA (Atualizado: 09/02/2026)

> Documentacao completa: `/SEGURANCA.md`

### ✅ Cloud Functions Deployadas (southamerica-east1):
- `validateDomain` — bloqueia signup fora do @trakto.io (beforeUserCreated)
- `syncUserRole` — sincroniza Custom Claims quando role muda (onDocumentWritten)
- `recalcularSaudeDiaria` — recalcula segmento_cs de todos os clientes ativos (scheduled, 6:30 BRT)
- `verificarCarenciasVencidas` — verifica carências de 7 dias vencidas e cria alertas de playbook (scheduled, 7h BRT)
- `verificarAlertasAutomatico` — gera alertas automaticamente (scheduled, 9h/14h seg-sex BRT)
- `classifyPendingThreads` — classifica threads pendentes com GPT (scheduled, 7:30/13:30 seg-sex)
- `setUserRole` — admin define roles (onCall, rate limited 20/min)
- `classifyThread` — proxy OpenAI para reclassificação manual de threads (onCall, rate limited 30/min)
- `generateSummary` — proxy OpenAI para resumo executivo (onCall, rate limited 30/min)
- `clickupProxy` — proxy ClickUp API (onCall, rate limited 60/min)
- `clickupWebhook` — recebe webhooks do ClickUp com verificacao HMAC (onRequest, rate limited 120/min)
- `summarizeTranscription` — gera resumo de transcrição de reunião com GPT (onCall, rate limited 30/hora)

### ✅ Segurança Implementada:
1. ✅ API keys movidas para Firebase Secrets (OpenAI, ClickUp, Webhook)
2. ✅ Frontend usa `httpsCallable()` — nunca chama APIs externas diretamente
3. ✅ Rate limiter distribuido via Firestore (persiste entre cold starts)
4. ✅ Webhook ClickUp com verificacao HMAC-SHA256 + CORS desabilitado
5. ✅ Validacao de inputs em todas as Cloud Functions (limites de tamanho, tipo, whitelist)
6. ✅ Firestore Security Rules com RBAC (viewer < cs < gestor < admin < super_admin)
7. ✅ Content Security Policy (CSP) + X-Frame-Options + referrer policy
8. ✅ Rotas admin protegidas (`/configuracoes/usuarios`, `/configuracoes/auditoria`)
9. ✅ `usuarios_sistema` restringido (viewers leem so o proprio doc, CS+ leem todos)
10. ✅ Erros sanitizados nas Cloud Functions (nunca expoe error.message)
11. ✅ Console.logs removidos em producao (`esbuild.drop`)
12. ✅ Pagina debug excluida do bundle de producao
13. ✅ `.env` no `.gitignore`
14. ✅ npm audit: 0 vulnerabilidades (xlsx substituído por ExcelJS)
15. ✅ Session timeout: auto-logout após 8h de inatividade + aviso 60s antes
16. ✅ Audit log de autenticação: login_sucesso, login_falha, logout, session_timeout (email, user_agent, timestamp)
17. ✅ Backup automático diário: 3h (Brasília), 7 collections, retenção 30 dias, Cloud Storage
18. ✅ Dependabot: verifica vulnerabilidades semanalmente (segunda 9h), PRs automáticos

### ⚠️ Segurança Pendente (baixa prioridade):
- 2FA para admins (Firebase Auth suporta, mas precisa implementar UI)

### Firebase Secrets (Google Secret Manager):
- `OPENAI_API_KEY` — chave OpenAI
- `CLICKUP_API_KEY` — chave ClickUp
- `CLICKUP_LIST_ID` — ID da lista do ClickUp para criar tarefas automáticas
- `CLICKUP_WEBHOOK_SECRET` — secret HMAC do webhook

### Comandos de deploy:
```bash
firebase deploy --only functions --project cs-hub-8c032
firebase deploy --only firestore:rules --project cs-hub-8c032
firebase functions:log --project cs-hub-8c032
```

### Console de secrets:
https://console.cloud.google.com/security/secret-manager?project=cs-hub-8c032

---

## ⚡ PERFORMANCE (Atualizado: 30/01/2026)

### ✅ Otimizado:
1. ✅ `useAlertasCount` - Usa queries filtradas por status (não carrega todos alertas)
2. ✅ Console.logs removidos em produção (menos overhead)
3. ✅ Índices Firestore configurados para queries comuns
4. ✅ Paginação em Clientes (30/página)
5. ✅ Cache client-side com TTL (5-10 min)
6. ✅ Lazy loading para componentes pesados (bundle reduzido 66%)

### ⚠️ A otimizar futuramente:
1. Paginação em Analytics (pode carregar milhares de registros)
