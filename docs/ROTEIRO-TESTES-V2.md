# Roteiro de Testes - CS Hub (Item 4.3 do Roadmap V2)

**Criado em:** 03/02/2026
**Objetivo:** Validar todas as funcionalidades existentes antes de avançar para os próximos sprints

---

## 1. ANALYTICS

**Abas:** Engajamento, Usuários, Prevenção de Churn, Inativos

### Engajamento
- [ ] Cards de métricas carregam (Threads, Logins, Peças, AI, Threads Negativas)
- [ ] Variação percentual (seta + %) vs período anterior
- [ ] Filtro por período (7d, 30d, 90d, customizado)
- [ ] Filtro por responsável e team type (multiselect)
- [ ] Gráficos: Top 5 Engajados, Distribuição por Status, Segmento CS, Tendência 30d
- [ ] Gráficos: Threads por Categoria, Sentimento, Top 10 por Uso
- [ ] Click no cliente do ranking → navega para detalhe
- [ ] Export Excel → gera arquivo com todas as abas

### Usuários
- [ ] Heavy Users (top 15) com nome, email, cliente, logins, peças, downloads, AI
- [ ] Filtro por período atualiza lista
- [ ] Clientes inativos/cancelados excluídos da contagem

### Prevenção de Churn
- [ ] Clientes em Risco (ALERTA + RESGATE, top 10)
- [ ] Clientes Críticos (só RESGATE)
- [ ] Clientes sem Contato (30+ dias)
- [ ] Distribuição por Segmento CS
- [ ] Click no cliente → navega para detalhe

### Inativos
- [ ] Lista só mostra inativos/cancelados COM atividade no período
- [ ] Colunas: nome, threads, uso (logins + peças + downloads)
- [ ] Ordenado por uso decrescente

### Edge cases
- [ ] Período sem dados → exibe estado vazio
- [ ] Cliente sem responsável → "Não atribuído"

---

## 2. ALERTAS

### Criação automática
- [ ] `sem_uso_plataforma`: 15+ dias sem uso → alerta criado (media para 15-29d, alta para 30+d)
- [ ] `sentimento_negativo`: thread classificada negativo/urgente → alerta
- [ ] `problema_reclamacao`: thread com categoria erro_bug/reclamação → alerta
- [ ] Cliente inativo/cancelado → NÃO cria alertas
- [ ] Alerta pendente duplicado → NÃO cria outro
- [ ] Botão "Verificar Novos Alertas" → roda verificação completa

### Gestão
- [ ] Click no alerta → modal de detalhe
- [ ] Editar: título, mensagem, prioridade, status, notas
- [ ] Mudar status: pendente → em_andamento → resolvido/ignorado/bloqueado
- [ ] `resolved_at` preenchido ao resolver/ignorar
- [ ] Ver cliente → navega para ClienteDetalhe

### Filtros
- [ ] Status (pills multiselect)
- [ ] Prioridade (dropdown multiselect)
- [ ] Tipo (dropdown multiselect)
- [ ] Responsável (dropdown multiselect)
- [ ] Team Type (dropdown multiselect)
- [ ] Combinar filtros → lógica AND

### Batch
- [ ] Selecionar múltiplos alertas (checkbox)
- [ ] Atualizar status em lote
- [ ] Selecionar todos → conta bate com lista filtrada

### Edge cases
- [ ] Alerta de cliente excluído → exibe sem erro
- [ ] ClickUp não configurado → funciona sem criar tarefas

---

## 3. PLAYBOOKS

### Templates
- [ ] Criar playbook com N etapas → salvo corretamente
- [ ] Editar playbook → adicionar/remover etapas → ordem mantida
- [ ] Marcar etapa como obrigatória → badge visível
- [ ] Excluir playbook → modal de confirmação

### Aplicação
- [ ] Aplicar playbook a cliente com data_início → prazos calculados (data_início + prazo_dias)
- [ ] Playbook aparece em ClienteDetalhe → aba Playbooks
- [ ] ClickUp configurado → tarefas criadas para CADA etapa
- [ ] Título ClickUp: `[Nome Playbook] Nome Cliente - Nome Etapa`
- [ ] Responsáveis do cliente atribuídos automaticamente
- [ ] Data de vencimento = prazo_data calculado

### Execução
- [ ] Marcar etapa pendente → concluída → progresso atualiza
- [ ] Pular etapa opcional → progresso atualiza
- [ ] Tentar pular etapa obrigatória → bloqueado
- [ ] Adicionar observações à etapa → salva
- [ ] Barra de progresso = (obrigatórias concluídas / total obrigatórias) × 100

### Conclusão
- [ ] Completar todas obrigatórias → status = concluído
- [ ] `data_conclusao` preenchido
- [ ] Opcionais pendentes NÃO bloqueiam conclusão

### Cancelamento
- [ ] Cancelar playbook → confirmação → status = cancelado
- [ ] TODAS as tarefas ClickUp fechadas (status = ignorado)

### Edge cases
- [ ] Cliente sem responsáveis → tarefas ClickUp sem assignees
- [ ] Etapa com prazo no passado → destaque visual
- [ ] Aplicar mesmo playbook duas vezes ao mesmo cliente

---

## 4. SEGMENTAÇÃO CS

### Cálculo
- [ ] 30+ dias sem uso → RESGATE
- [ ] `status = aviso_prévio` → RESGATE (independente de outros fatores)
- [ ] Reclamação urgente (últimos 7 dias) → RESGATE
- [ ] 14-29 dias sem uso → ALERTA
- [ ] Reclamações recentes → ALERTA
- [ ] `champion_saiu = true` → ALERTA
- [ ] Frequência raro/sem_uso → ALERTA
- [ ] Frequente + engajamento alto + sem reclamações → CRESCIMENTO
- [ ] Demais → ESTÁVEL

### Exibição
- [ ] Badge com cor correta (verde/azul/amarelo/vermelho)
- [ ] ClienteDetalhe → Segmento Card com fatores e ações recomendadas
- [ ] Analytics → gráfico de distribuição por segmento
- [ ] Lista de clientes → filtro por segmento funciona

### Configuração (Configurações)
- [ ] Alterar `dias_sem_uso_rescue` (padrão 30) → segmento recalcula
- [ ] Alterar `dias_sem_uso_watch` (padrão 14) → segmento recalcula
- [ ] Alterar thresholds de engajamento → segmento atualiza

### Override manual
- [ ] Ativar override → selecionar segmento → salvar → badge mostra segmento manual
- [ ] Desativar override → volta ao cálculo automático

### Legado
- [ ] Cliente com segmento="GROW" → exibe CRESCIMENTO
- [ ] Cliente com segmento="RESCUE" → exibe RESGATE

---

## 5. INTEGRAÇÃO CLICKUP

### Setup
- [ ] Variáveis configuradas → `isClickUpConfigured()` = true
- [ ] Configurações → status mostra "Configurada"
- [ ] Variáveis ausentes → status "Não configurada", app funciona sem erro

### Alertas → ClickUp
- [ ] Criar alerta → tarefa ClickUp criada automaticamente
- [ ] Título: `[CS Hub] Nome Cliente - Título Alerta`
- [ ] Prioridade mapeada (urgente=1, alta=2, media=3, baixa=4)
- [ ] Responsáveis atribuídos (suporta múltiplos)
- [ ] Vencimento: +3 dias
- [ ] Link da tarefa (`clickup_task_url`) funciona

### Criação manual
- [ ] Modal ClickUp → membros carregam
- [ ] Selecionar assignee → criar → tarefa criada corretamente
- [ ] Editar descrição custom → salvo

### Sync CS Hub → ClickUp
- [ ] Mudar status do alerta → tarefa ClickUp atualiza
- [ ] Concluir etapa → tarefa = "resolvido"
- [ ] Pular etapa → tarefa = "ignorado"
- [ ] Cancelar playbook → TODAS tarefas fechadas

### Sync ClickUp → CS Hub
- [ ] Botão "Sincronizar ClickUp" → indicador de progresso
- [ ] Tarefa ClickUp "resolvido" → alerta CS Hub = resolvido
- [ ] Tarefa ClickUp "ignorado" → alerta = ignorado
- [ ] `clickup_sync_at` atualizado
- [ ] Resultado mostra contagem: alertas atualizados, playbooks atualizados

### Edge cases
- [ ] Tarefa deletada no ClickUp → sync trata 404 sem erro
- [ ] API ClickUp fora do ar → alerta criado no CS Hub mesmo sem tarefa
- [ ] Responsável com email que não existe no ClickUp → assignment parcial

---

## 6. FUNCIONALIDADES TRANSVERSAIS

### Clientes - Lista
- [ ] Filtros persistem no localStorage ao recarregar
- [ ] Busca por nome e responsável
- [ ] Filtro por status (pills), team type, segmento, área de atuação
- [ ] Edição em lote (status, responsável, tipo, área)
- [ ] Export CSV com filtros aplicados, UTF-8 com BOM
- [ ] Orphan times → banner + modal para vincular

### ClienteDetalhe - Conversas
- [ ] Timeline ordenada por updated_at desc
- [ ] Classificar com IA → categoria + sentimento + resumo salvos
- [ ] Classificar manualmente → salvos com `classificado_por = manual`
- [ ] Marcar como irrelevante (toggle)
- [ ] Toggle "Mostrar Irrelevantes"
- [ ] Observações do CS enviadas como contexto para IA

### ClienteDetalhe - Observações
- [ ] Criar observação → aparece na lista
- [ ] Resolver → `status = resolvida`, `resolvida_em` preenchido
- [ ] Toggle "Mostrar Resolvidas"
- [ ] Excluir observação

### ClienteDetalhe - Documentos
- [ ] Criar documento (título + URL)
- [ ] Editar → campos atualizados
- [ ] Excluir → removido

### ClienteDetalhe - Pessoas
- [ ] Lista de usuários do cliente com indicador de atividade
- [ ] Cores: verde (ativo 7d), amarelo (7-30d), vermelho (30+d), cinza (sem dados)
- [ ] Toggle "Mostrar Todos" (padrão: top 10)

### Email Filters
- [ ] Filtro ativo: threads de noreply@, newsletter@ filtradas
- [ ] Domínio completo bloqueado: todos emails do domínio filtrados
- [ ] Palavra-chave no assunto: threads com match filtradas
- [ ] Auto-reply detectado → filtrado
- [ ] Thread filtrada NÃO gera alerta
- [ ] Toggle filtro_ativo OFF → nenhuma filtragem automática

### Configurações
- [ ] Apenas admin/super_admin/gestor pode editar
- [ ] Outros roles → modo somente leitura + banner de aviso
- [ ] Salvar parâmetros → persistido no Firestore
- [ ] Recarregar página → valores carregados corretamente

---

## Ordem de Prioridade

| Prioridade | Funcionalidade |
|------------|----------------|
| **Crítico** | Login → Clientes → ClienteDetalhe → Conversas → Classificação → Alertas automáticos → Segmentação |
| **Alto** | Analytics (todas as abas) → Playbooks → ClickUp → Email Filters |
| **Médio** | Batch operations → Observações → Documentos → Export CSV/Excel |
| **Baixo** | Edge cases com dados faltantes, orphan times, combinações avançadas de filtros |
