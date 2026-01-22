# Roteiro de Testes - CS Hub v1.0

> **Data de Criação**: Janeiro 2026
> **Projeto**: CS Hub - Customer Success Management System
> **Versão**: 1.0
> **Framework**: React 18 + Firebase + Vite

---

## Sumário

1. [Autenticação](#1-autenticação)
2. [Dashboard](#2-dashboard)
3. [Clientes](#3-clientes)
4. [Detalhe do Cliente](#4-detalhe-do-cliente)
5. [Formulário de Cliente](#5-formulário-de-cliente)
6. [Playbooks](#6-playbooks)
7. [Alertas](#7-alertas)
8. [Analytics](#8-analytics)
9. [Configurações](#9-configurações)
10. [Gerenciamento de Usuários](#10-gerenciamento-de-usuários)
11. [Auditoria](#11-auditoria)
12. [Integrações](#12-integrações)
13. [Casos de Erro](#13-casos-de-erro)
14. [Fluxos Completos](#14-fluxos-completos)

---

## 1. Autenticação

### 1.1 Login com Email @trakto.io

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 1.1.1 | Acessar `/login` sem estar logado | Exibir página de login com formulário | |
| [ ] | 1.1.2 | Inserir email válido `usuario@trakto.io` e senha correta | Redirecionar para Dashboard (`/`) | |
| [ ] | 1.1.3 | Verificar sessão persistida após refresh da página | Usuário continua logado | |
| [ ] | 1.1.4 | Verificar botão "Mostrar/Ocultar" senha | Alterna visibilidade da senha | |

### 1.2 Bloqueio de Outros Domínios

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 1.2.1 | Tentar login com email `usuario@gmail.com` | Exibir erro "Email deve ser @trakto.io" | |
| [ ] | 1.2.2 | Tentar login com email `usuario@empresa.com` | Exibir erro "Email deve ser @trakto.io" | |
| [ ] | 1.2.3 | Tentar login com email sem domínio | Exibir erro de formato inválido | |

### 1.3 Validações de Login

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 1.3.1 | Submeter formulário com campos vazios | Exibir erro de campos obrigatórios | |
| [ ] | 1.3.2 | Inserir email correto e senha incorreta | Exibir erro "Email ou senha inválidos" | |
| [ ] | 1.3.3 | Verificar loading state durante autenticação | Botão exibir spinner durante processo | |

### 1.4 Logout

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 1.4.1 | Clicar em "Sair" no sidebar | Redirecionar para `/login` | |
| [ ] | 1.4.2 | Tentar acessar página protegida após logout | Redirecionar para `/login` | |

### 1.5 Redirecionamento

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 1.5.1 | Acessar `/login` estando logado | Redirecionar para Dashboard | |
| [ ] | 1.5.2 | Acessar `/clientes` sem estar logado | Redirecionar para `/login` | |

---

## 2. Dashboard

### 2.1 Carregamento Inicial

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 2.1.1 | Acessar Dashboard | Exibir loading durante carregamento | |
| [ ] | 2.1.2 | Verificar cards de estatísticas | 4 cards: Total, Saudáveis, Atenção, Críticos | |
| [ ] | 2.1.3 | Verificar card de Alertas | Exibir contagem de alertas pendentes | |
| [ ] | 2.1.4 | Verificar gráfico de distribuição | Gráfico de barras com Health Score | |

### 2.2 Cards de Estatísticas

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 2.2.1 | Verificar contagem "Total de Clientes" | Número corresponde ao total no banco | |
| [ ] | 2.2.2 | Verificar contagem "Saudáveis" | Número de clientes com health_score >= 80 | |
| [ ] | 2.2.3 | Verificar contagem "Precisam Atenção" | Clientes com health_score 60-79 | |
| [ ] | 2.2.4 | Verificar contagem "Estado Crítico" | Clientes com health_score < 40 | |

### 2.3 Busca e Filtros

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 2.3.1 | Buscar por nome do cliente | Filtrar lista exibindo correspondências | |
| [ ] | 2.3.2 | Buscar por nome do responsável | Filtrar lista pelo responsável | |
| [ ] | 2.3.3 | Filtrar por Tipo de Time | Filtrar por team_type selecionado | |
| [ ] | 2.3.4 | Filtrar por Responsável | Filtrar por responsável selecionado | |
| [ ] | 2.3.5 | Aplicar múltiplos filtros | Combinar filtros corretamente | |
| [ ] | 2.3.6 | Clicar "Limpar Filtros" | Resetar todos os filtros | |
| [ ] | 2.3.7 | Verificar contador de resultados | Exibir "X de Y clientes" | |

### 2.4 Lista de Clientes em Atenção

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 2.4.1 | Verificar ordenação | Top 5 por menor health_score | |
| [ ] | 2.4.2 | Verificar informações do card | Nome, responsável, score, última interação | |
| [ ] | 2.4.3 | Clicar em um cliente | Navegar para `/clientes/:id` | |

### 2.5 Distribuição por Status

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 2.5.1 | Verificar cards de lifecycle | 5 cards: Ativo, Onboarding, Aviso Prévio, Inativo, Cancelado | |
| [ ] | 2.5.2 | Verificar contagens | Números correspondem aos status no banco | |

### 2.6 Navegação

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 2.6.1 | Clicar "Ver Clientes" | Navegar para `/clientes` | |
| [ ] | 2.6.2 | Clicar no card de Alertas | Navegar para `/alertas` | |

---

## 3. Clientes

### 3.1 Listagem

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 3.1.1 | Acessar `/clientes` | Exibir grid de clientes | |
| [ ] | 3.1.2 | Verificar informações do card | Nome, tipo, status, health, responsável | |
| [ ] | 3.1.3 | Verificar contador no header | "X clientes cadastrados" | |

### 3.2 Busca e Filtros

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 3.2.1 | Buscar por nome do cliente | Filtrar lista | |
| [ ] | 3.2.2 | Filtrar por Health Status (Saudável) | Mostrar apenas health_score >= 80 | |
| [ ] | 3.2.3 | Filtrar por Health Status (Atenção) | Mostrar apenas health_score 60-79 | |
| [ ] | 3.2.4 | Filtrar por Health Status (Risco) | Mostrar apenas health_score 40-59 | |
| [ ] | 3.2.5 | Filtrar por Health Status (Crítico) | Mostrar apenas health_score < 40 | |
| [ ] | 3.2.6 | Filtrar por Tipo de Time | Filtrar por team_type | |
| [ ] | 3.2.7 | Filtrar por Status (pills) | Filtrar por status do cliente | |
| [ ] | 3.2.8 | Multi-select de status | Combinar múltiplos status | |

### 3.3 Times Órfãos

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 3.3.1 | Verificar alerta de times órfãos | Exibir banner se existirem | |
| [ ] | 3.3.2 | Clicar "Ver times" | Abrir modal com lista | |
| [ ] | 3.3.3 | Clicar "Atribuir" em um time | Navegar para formulário | |

### 3.4 Ações nos Cards

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 3.4.1 | Clicar no card do cliente | Navegar para `/clientes/:id` | |
| [ ] | 3.4.2 | Clicar botão Editar | Navegar para `/clientes/:id/editar` | |
| [ ] | 3.4.3 | Clicar botão Excluir | Abrir modal de confirmação | |
| [ ] | 3.4.4 | Confirmar exclusão | Remover cliente e atualizar lista | |
| [ ] | 3.4.5 | Cancelar exclusão | Fechar modal sem excluir | |

### 3.5 Exportação CSV

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 3.5.1 | Clicar "Exportar CSV" sem filtros | Download com todos os clientes | |
| [ ] | 3.5.2 | Clicar "Exportar CSV" com filtros | Download apenas clientes filtrados | |
| [ ] | 3.5.3 | Abrir CSV no Excel | Arquivo com encoding UTF-8 correto | |
| [ ] | 3.5.4 | Verificar colunas do CSV | Nome, Responsável, Email, Tags, Score, Status, Qtd Times | |

### 3.6 Novo Cliente

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 3.6.1 | Clicar "Novo Cliente" | Navegar para `/clientes/novo` | |

---

## 4. Detalhe do Cliente

### 4.1 Informações Básicas

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 4.1.1 | Acessar `/clientes/:id` | Exibir detalhes do cliente | |
| [ ] | 4.1.2 | Verificar header | Nome, status, health badges | |
| [ ] | 4.1.3 | Verificar info do cliente | Responsável, email, times, data criação | |
| [ ] | 4.1.4 | Clicar "Voltar" | Retornar para lista de clientes | |
| [ ] | 4.1.5 | Clicar "Editar" | Navegar para formulário de edição | |

### 4.2 Health Score

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 4.2.1 | Verificar score atual | Exibir número 0-100 com cor | |
| [ ] | 4.2.2 | Verificar gráfico histórico | Linha com últimos 30 dias | |
| [ ] | 4.2.3 | Clicar "Recalcular" | Recalcular e atualizar score | |
| [ ] | 4.2.4 | Verificar componentes do score | Breakdown por categoria | |

### 4.3 Dados de Uso

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 4.3.1 | Verificar métricas de uso | Logins, Peças, Downloads, AI | |
| [ ] | 4.3.2 | Verificar lista de usuários | Exibir até 5 usuários | |
| [ ] | 4.3.3 | Clicar "Ver todos" usuários | Expandir lista completa | |

### 4.4 Playbooks Ativos

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 4.4.1 | Verificar playbooks ativos | Listar playbooks em andamento | |
| [ ] | 4.4.2 | Verificar progresso | Barra de progresso com percentual | |
| [ ] | 4.4.3 | Expandir playbook | Mostrar etapas | |
| [ ] | 4.4.4 | Marcar etapa como concluída | Atualizar status e progresso | |
| [ ] | 4.4.5 | Pular etapa opcional | Marcar como "pulada" | |
| [ ] | 4.4.6 | Adicionar observação em etapa | Salvar texto de observação | |
| [ ] | 4.4.7 | Cancelar playbook | Mudar status para "cancelado" | |
| [ ] | 4.4.8 | Verificar indicador de atraso | Badge vermelho se prazo vencido | |

### 4.5 Timeline de Conversas (ThreadsTimeline)

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 4.5.1 | Verificar lista de threads | Exibir conversas do cliente | |
| [ ] | 4.5.2 | Buscar por palavra-chave | Filtrar por assunto/resumo | |
| [ ] | 4.5.3 | Filtrar por Categoria | Filtrar threads por categoria | |
| [ ] | 4.5.4 | Filtrar por Sentimento | Filtrar por sentimento | |
| [ ] | 4.5.5 | Filtrar por Status | Filtrar por status da thread | |
| [ ] | 4.5.6 | Filtrar por período (data) | Filtrar por range de datas | |
| [ ] | 4.5.7 | Ordenar por recentes | Ordem decrescente por data | |
| [ ] | 4.5.8 | Ordenar por antigas | Ordem crescente por data | |
| [ ] | 4.5.9 | Ordenar por urgentes | Urgentes primeiro | |
| [ ] | 4.5.10 | Ordenar por atrasados | Atrasados primeiro | |
| [ ] | 4.5.11 | Verificar badge "Atrasado" | Badge vermelho se >2 dias aguardando | |
| [ ] | 4.5.12 | Verificar badge "Urgente" | Badge pulsante para urgentes | |
| [ ] | 4.5.13 | Verificar contador de resultados | "X resultados encontrados" | |

### 4.6 Ações Rápidas em Threads

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 4.6.1 | Clicar "Abrir no Gmail" | Abrir `mail.google.com/mail/u/0/#inbox/{thread_id}` | |
| [ ] | 4.6.2 | Clicar "Classificar" | Abrir modal de classificação IA | |
| [ ] | 4.6.3 | Clicar "Criar Tarefa ClickUp" | Abrir modal de criação de tarefa | |
| [ ] | 4.6.4 | Clicar na thread | Expandir detalhes/mensagens | |

---

## 5. Formulário de Cliente

### 5.1 Criar Novo Cliente

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 5.1.1 | Acessar `/clientes/novo` | Exibir formulário vazio | |
| [ ] | 5.1.2 | Preencher nome (obrigatório) | Campo aceita texto | |
| [ ] | 5.1.3 | Selecionar status | Dropdown com opções | |
| [ ] | 5.1.4 | Adicionar tags | Multi-select de tags | |
| [ ] | 5.1.5 | Adicionar responsável | Dropdown + botão adicionar | |
| [ ] | 5.1.6 | Remover responsável | Botão X remove da lista | |
| [ ] | 5.1.7 | Buscar times | Input de busca funciona | |
| [ ] | 5.1.8 | Filtrar times por tipo | Dropdown de tipos | |
| [ ] | 5.1.9 | Selecionar times | Checkbox em cada time | |
| [ ] | 5.1.10 | Salvar sem nome | Exibir erro de validação | |
| [ ] | 5.1.11 | Salvar com dados válidos | Criar cliente e redirecionar | |
| [ ] | 5.1.12 | Clicar "Cancelar" | Voltar para lista sem salvar | |

### 5.2 Editar Cliente

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 5.2.1 | Acessar `/clientes/:id/editar` | Formulário preenchido | |
| [ ] | 5.2.2 | Alterar nome | Campo atualiza | |
| [ ] | 5.2.3 | Alterar status | Dropdown atualiza | |
| [ ] | 5.2.4 | Adicionar/remover times | Checkboxes funcionam | |
| [ ] | 5.2.5 | Salvar alterações | Atualizar e redirecionar | |

### 5.3 Stakeholders

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 5.3.1 | Clicar "Adicionar Stakeholder" | Abrir modal | |
| [ ] | 5.3.2 | Preencher nome, email, cargo, telefone | Campos aceitam dados | |
| [ ] | 5.3.3 | Salvar stakeholder | Adicionar à lista | |
| [ ] | 5.3.4 | Editar stakeholder | Abrir modal com dados | |
| [ ] | 5.3.5 | Excluir stakeholder | Remover da lista | |

### 5.4 Reuniões

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 5.4.1 | Clicar "Adicionar Reunião" | Abrir modal | |
| [ ] | 5.4.2 | Preencher data, tipo, participantes, resumo | Campos aceitam dados | |
| [ ] | 5.4.3 | Salvar reunião | Adicionar à lista | |
| [ ] | 5.4.4 | Editar reunião | Abrir modal com dados | |
| [ ] | 5.4.5 | Excluir reunião | Remover da lista | |

---

## 6. Playbooks

### 6.1 Lista de Playbooks

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 6.1.1 | Acessar `/playbooks` | Exibir lista de templates | |
| [ ] | 6.1.2 | Verificar info do card | Nome, descrição, duração, etapas | |
| [ ] | 6.1.3 | Clicar "Ver" em playbook | Navegar para detalhe | |

### 6.2 Criar Playbooks Padrão

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 6.2.1 | Verificar botão "Criar Playbooks Padrão" | Exibir se não existem playbooks | |
| [ ] | 6.2.2 | Clicar botão | Criar 3 playbooks: Onboarding, Reativação, QBR | |
| [ ] | 6.2.3 | Verificar playbooks criados | Lista atualiza com novos playbooks | |

### 6.3 Detalhe do Playbook

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 6.3.1 | Acessar `/playbooks/:id` | Exibir detalhes | |
| [ ] | 6.3.2 | Verificar etapas | Lista com ordem, nome, prazo | |
| [ ] | 6.3.3 | Clicar "Aplicar a Cliente" | Abrir modal de seleção | |
| [ ] | 6.3.4 | Selecionar cliente e data início | Campos funcionam | |
| [ ] | 6.3.5 | Confirmar aplicação | Criar playbook ativo no cliente | |

---

## 7. Alertas

### 7.1 Lista de Alertas

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 7.1.1 | Acessar `/alertas` | Exibir lista de alertas | |
| [ ] | 7.1.2 | Verificar cards de estatísticas | Pendentes, Em Andamento, Resolvidos Hoje | |
| [ ] | 7.1.3 | Verificar info do alerta | Tipo, título, cliente, prioridade, status | |

### 7.2 Filtros de Alertas

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 7.2.1 | Filtrar por tipo (sem_contato) | Mostrar apenas este tipo | |
| [ ] | 7.2.2 | Filtrar por tipo (sentimento_negativo) | Mostrar apenas este tipo | |
| [ ] | 7.2.3 | Filtrar por tipo (health_critico) | Mostrar apenas este tipo | |
| [ ] | 7.2.4 | Filtrar por tipo (erro_bug) | Mostrar apenas este tipo | |
| [ ] | 7.2.5 | Filtrar por tipo (time_orfao) | Mostrar apenas este tipo | |
| [ ] | 7.2.6 | Filtrar por tipo (aviso_previo) | Mostrar apenas este tipo | |
| [ ] | 7.2.7 | Filtrar por prioridade (Urgente) | Mostrar apenas urgentes | |
| [ ] | 7.2.8 | Filtrar por prioridade (Alta) | Mostrar apenas alta | |
| [ ] | 7.2.9 | Filtrar por prioridade (Média) | Mostrar apenas média | |
| [ ] | 7.2.10 | Filtrar por prioridade (Baixa) | Mostrar apenas baixa | |
| [ ] | 7.2.11 | Filtrar por status (Pendente) | Mostrar apenas pendentes | |
| [ ] | 7.2.12 | Filtrar por status (Em Andamento) | Mostrar em andamento | |
| [ ] | 7.2.13 | Filtrar por status (Resolvido) | Mostrar resolvidos | |
| [ ] | 7.2.14 | Filtrar por Responsável | Filtrar por pessoa | |
| [ ] | 7.2.15 | Combinar múltiplos filtros | Aplicar todos corretamente | |
| [ ] | 7.2.16 | Limpar filtros | Resetar para padrão | |

### 7.3 Ações em Alertas

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 7.3.1 | Marcar como "Em Andamento" | Atualizar status do alerta | |
| [ ] | 7.3.2 | Marcar como "Resolvido" | Atualizar status e timestamp | |
| [ ] | 7.3.3 | Clicar no nome do cliente | Navegar para detalhe do cliente | |
| [ ] | 7.3.4 | Expandir detalhes do alerta | Mostrar mais informações | |

### 7.4 Verificar Alertas

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 7.4.1 | Clicar "Verificar Alertas" | Exibir loading | |
| [ ] | 7.4.2 | Verificar novos alertas criados | Alertas baseados em regras | |
| [ ] | 7.4.3 | Verificar atualização da lista | Lista recarrega após verificação | |

### 7.5 Criar Tarefa ClickUp

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 7.5.1 | Clicar botão ClickUp no alerta | Abrir modal de criação | |
| [ ] | 7.5.2 | Verificar dados pré-preenchidos | Nome e descrição do alerta | |
| [ ] | 7.5.3 | Selecionar prioridade | Dropdown com opções | |
| [ ] | 7.5.4 | Selecionar responsável | Dropdown carrega membros | |
| [ ] | 7.5.5 | Criar tarefa | Task criada no ClickUp | |
| [ ] | 7.5.6 | Verificar mensagem de sucesso | Toast de confirmação | |

---

## 8. Analytics

### 8.1 Visão Geral

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 8.1.1 | Acessar `/analytics` | Exibir dashboard completo | |
| [ ] | 8.1.2 | Verificar card "Clientes Ativos" | Número correto | |
| [ ] | 8.1.3 | Verificar card "Total Times" | Número correto | |
| [ ] | 8.1.4 | Verificar card "Threads" | Threads do período | |
| [ ] | 8.1.5 | Verificar card "Alertas Pendentes" | Número de pendentes | |
| [ ] | 8.1.6 | Verificar card "Health Score Médio" | Média calculada | |

### 8.2 Filtros Globais

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 8.2.1 | Filtrar por período (7 dias) | Dados atualizados | |
| [ ] | 8.2.2 | Filtrar por período (30 dias) | Dados atualizados | |
| [ ] | 8.2.3 | Filtrar por período (90 dias) | Dados atualizados | |
| [ ] | 8.2.4 | Filtrar por período (1 ano) | Dados atualizados | |
| [ ] | 8.2.5 | Filtrar por Responsável | Dados do responsável | |
| [ ] | 8.2.6 | Filtrar por Tipo de Time | Dados do tipo | |
| [ ] | 8.2.7 | Limpar filtros | Voltar ao padrão | |

### 8.3 Gráficos e Seções

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 8.3.1 | Verificar gráfico "Distribuição por Status" | Pie chart com status | |
| [ ] | 8.3.2 | Verificar gráfico "Distribuição por Health Score" | Bar chart por faixa | |
| [ ] | 8.3.3 | Verificar seção "Times em Risco" | Lista de times críticos | |
| [ ] | 8.3.4 | Clicar em time em risco | Navegar para cliente | |
| [ ] | 8.3.5 | Verificar tabela "Performance por Responsável" | Dados por CS | |
| [ ] | 8.3.6 | Verificar gráfico "Tendências" | Area chart com linhas | |
| [ ] | 8.3.7 | Verificar gráfico "Threads por Categoria" | Bar chart horizontal | |
| [ ] | 8.3.8 | Verificar gráfico "Sentimento das Conversas" | Pie chart | |

### 8.4 Exportação Excel

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 8.4.1 | Clicar exportar em cada seção | Download .xlsx da seção | |
| [ ] | 8.4.2 | Clicar "Exportar Relatório Completo" | Download com múltiplas abas | |
| [ ] | 8.4.3 | Abrir arquivo no Excel | Arquivo válido com dados | |
| [ ] | 8.4.4 | Verificar abas do relatório | Resumo, Clientes, Times em Risco, Threads, Alertas, Performance | |

### 8.5 Atualização

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 8.5.1 | Clicar "Atualizar" | Recarregar todos os dados | |
| [ ] | 8.5.2 | Verificar loading state | Spinner durante atualização | |

---

## 9. Configurações

### 9.1 Pesos do Health Score

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 9.1.1 | Acessar `/configuracoes` | Exibir página de config | |
| [ ] | 9.1.2 | Verificar pesos atuais | 6 campos com valores | |
| [ ] | 9.1.3 | Alterar peso de Engajamento | Campo atualiza | |
| [ ] | 9.1.4 | Verificar soma total | Exibir "XX%" com indicador | |
| [ ] | 9.1.5 | Soma diferente de 100% | Botão salvar desabilitado | |
| [ ] | 9.1.6 | Soma igual a 100% | Botão salvar habilitado | |

### 9.2 Thresholds de Status

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 9.2.1 | Verificar thresholds atuais | Saudável, Atenção, Risco, Crítico | |
| [ ] | 9.2.2 | Alterar threshold Saudável | Campo atualiza | |
| [ ] | 9.2.3 | Alterar threshold Atenção | Campo atualiza | |
| [ ] | 9.2.4 | Alterar threshold Risco | Campo atualiza | |
| [ ] | 9.2.5 | Verificar Crítico desabilitado | Campo não editável | |

### 9.3 Configurações de Alertas

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 9.3.1 | Alterar "Dias sem contato para alerta" | Campo numérico | |
| [ ] | 9.3.2 | Toggle "Alerta sentimento negativo" | Ativar/desativar | |
| [ ] | 9.3.3 | Toggle "Alerta erro/bug" | Ativar/desativar | |
| [ ] | 9.3.4 | Toggle "Alerta urgente automático" | Ativar/desativar | |

### 9.4 Parâmetros de Análise

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 9.4.1 | Alterar "Dias sem contato (Alerta)" | Campo numérico | |
| [ ] | 9.4.2 | Alterar "Dias sem contato (Crítico)" | Campo numérico | |
| [ ] | 9.4.3 | Alterar "Período de análise" | Campo numérico | |

### 9.5 Integrações

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 9.5.1 | Verificar status ClickUp | Conectado/Desconectado | |
| [ ] | 9.5.2 | Verificar status OpenAI | Conectado/Desconectado | |
| [ ] | 9.5.3 | Clicar "Testar Conexão" ClickUp | Testar API | |
| [ ] | 9.5.4 | Clicar "Testar Conexão" OpenAI | Testar API | |
| [ ] | 9.5.5 | Verificar resultado do teste | Sucesso ou erro exibido | |

### 9.6 Salvar Configurações

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 9.6.1 | Clicar "Salvar Configurações" | Salvar no Firebase | |
| [ ] | 9.6.2 | Verificar mensagem de sucesso | Toast "Salvo!" | |
| [ ] | 9.6.3 | Recarregar página | Valores persistidos | |

### 9.7 Navegação

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 9.7.1 | Clicar "Gerenciar Usuários" | Navegar para `/configuracoes/usuarios` | |

---

## 10. Gerenciamento de Usuários

### 10.1 Lista de Usuários

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 10.1.1 | Acessar `/configuracoes/usuarios` | Exibir lista de usuários | |
| [ ] | 10.1.2 | Verificar colunas | Nome, Email, Cargo, Permissão, Carteira, Status, Ações | |
| [ ] | 10.1.3 | Verificar contador | "X usuários cadastrados" | |

### 10.2 Criar Novo Usuário

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 10.2.1 | Clicar "Novo Usuário" | Abrir modal | |
| [ ] | 10.2.2 | Preencher nome (obrigatório) | Campo aceita texto | |
| [ ] | 10.2.3 | Preencher email @trakto.io | Campo aceita email válido | |
| [ ] | 10.2.4 | Tentar email de outro domínio | Exibir erro de validação | |
| [ ] | 10.2.5 | Preencher senha (mínimo 6 chars) | Campo aceita senha | |
| [ ] | 10.2.6 | Preencher cargo | Campo aceita texto | |
| [ ] | 10.2.7 | Selecionar role | Visualizador, CS, Gestor, Admin | |
| [ ] | 10.2.8 | Toggle Ativo | Ativar/desativar | |
| [ ] | 10.2.9 | Salvar usuário | Criar no Firebase Auth + Firestore | |
| [ ] | 10.2.10 | Cancelar | Fechar modal sem salvar | |

### 10.3 Editar Usuário

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 10.3.1 | Clicar botão Editar | Abrir modal com dados | |
| [ ] | 10.3.2 | Verificar email desabilitado | Não pode alterar email | |
| [ ] | 10.3.3 | Alterar nome | Campo atualiza | |
| [ ] | 10.3.4 | Alterar cargo | Campo atualiza | |
| [ ] | 10.3.5 | Alterar role | Dropdown atualiza | |
| [ ] | 10.3.6 | Alterar status ativo | Toggle funciona | |
| [ ] | 10.3.7 | Salvar alterações | Atualizar no Firestore | |

### 10.4 Atribuição de Carteira

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 10.4.1 | Clicar botão "X clientes" | Abrir modal de carteira | |
| [ ] | 10.4.2 | Verificar clientes já atribuídos | Checkboxes marcados | |
| [ ] | 10.4.3 | Buscar cliente | Filtrar lista | |
| [ ] | 10.4.4 | Selecionar novos clientes | Marcar checkboxes | |
| [ ] | 10.4.5 | Remover clientes | Desmarcar checkboxes | |
| [ ] | 10.4.6 | Verificar aviso "Atualmente com:" | Mostrar se atribuído a outro | |
| [ ] | 10.4.7 | Salvar atribuições | Atualizar responsável nos clientes | |
| [ ] | 10.4.8 | Verificar contagem atualizada | Badge atualiza na tabela | |

### 10.5 Excluir Usuário

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 10.5.1 | Clicar botão Excluir | Abrir modal de confirmação | |
| [ ] | 10.5.2 | Confirmar exclusão | Remover do Firestore | |
| [ ] | 10.5.3 | Cancelar exclusão | Fechar modal | |
| [ ] | 10.5.4 | Tentar excluir Super Admin | Botão não disponível | |

### 10.6 Redefinir Senha

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 10.6.1 | Clicar botão de chave | Abrir modal de reset | |
| [ ] | 10.6.2 | Confirmar envio | Enviar email Firebase | |
| [ ] | 10.6.3 | Verificar mensagem de sucesso | "Email enviado!" | |

### 10.7 Permissões

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 10.7.1 | Logar como Viewer | Sem acesso à página | |
| [ ] | 10.7.2 | Logar como CS | Sem acesso à página | |
| [ ] | 10.7.3 | Logar como Gestor | Com acesso à página | |
| [ ] | 10.7.4 | Logar como Admin | Com acesso à página | |
| [ ] | 10.7.5 | Verificar proteção Super Admin | Não pode editar/excluir marina@trakto.io | |

---

## 11. Auditoria

### 11.1 Lista de Logs

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 11.1.1 | Acessar `/configuracoes/auditoria` | Exibir lista de logs | |
| [ ] | 11.1.2 | Verificar colunas | Data, Usuário, Entidade, Ação, Detalhes | |

### 11.2 Filtros

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 11.2.1 | Buscar por nome/ID | Filtrar logs | |
| [ ] | 11.2.2 | Filtrar por tipo de entidade | Cliente, Thread, Config, etc | |
| [ ] | 11.2.3 | Filtrar por tipo de ação | Create, Update, Delete | |
| [ ] | 11.2.4 | Filtrar por usuário | Dropdown de usuários | |
| [ ] | 11.2.5 | Filtrar por data início | Date picker | |
| [ ] | 11.2.6 | Filtrar por data fim | Date picker | |
| [ ] | 11.2.7 | Combinar filtros | Múltiplos filtros | |

### 11.3 Detalhes do Log

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 11.3.1 | Expandir log | Mostrar detalhes | |
| [ ] | 11.3.2 | Verificar mudanças | Valor antigo → Novo | |

---

## 12. Integrações

### 12.1 OpenAI - Classificação de Threads

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 12.1.1 | Verificar VITE_OPENAI_API_KEY configurada | Variável de ambiente presente | |
| [ ] | 12.1.2 | Acessar thread não classificada | Exibir botão "Classificar" | |
| [ ] | 12.1.3 | Clicar "Classificar" | Abrir modal/loading | |
| [ ] | 12.1.4 | Aguardar resposta da IA | Receber classificação | |
| [ ] | 12.1.5 | Verificar categoria retornada | Uma das categorias válidas | |
| [ ] | 12.1.6 | Verificar sentimento retornado | Um dos sentimentos válidos | |
| [ ] | 12.1.7 | Verificar resumo gerado | Texto resumido da conversa | |
| [ ] | 12.1.8 | Verificar salvo no Firebase | Dados persistidos na thread | |
| [ ] | 12.1.9 | Verificar badge atualizado | Badge com nova classificação | |

### 12.2 OpenAI - Categorias Válidas

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 12.2.1 | Categoria: erro_bug | Badge vermelho "Erro/Bug" | |
| [ ] | 12.2.2 | Categoria: problema_tecnico | Badge laranja "Problema Técnico" | |
| [ ] | 12.2.3 | Categoria: feedback | Badge verde "Feedback" | |
| [ ] | 12.2.4 | Categoria: duvida | Badge azul "Dúvida" | |
| [ ] | 12.2.5 | Categoria: solicitacao | Badge roxo "Solicitação" | |
| [ ] | 12.2.6 | Categoria: outro | Badge cinza "Outro" | |

### 12.3 OpenAI - Sentimentos Válidos

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 12.3.1 | Sentimento: positivo | Indicador verde | |
| [ ] | 12.3.2 | Sentimento: neutro | Indicador cinza | |
| [ ] | 12.3.3 | Sentimento: negativo | Indicador vermelho | |
| [ ] | 12.3.4 | Sentimento: urgente | Indicador laranja pulsante | |

### 12.4 ClickUp - Criação de Tarefas

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 12.4.1 | Verificar VITE_CLICKUP_API_KEY configurada | Variável presente | |
| [ ] | 12.4.2 | Verificar VITE_CLICKUP_TEAM_ID configurada | Variável presente | |
| [ ] | 12.4.3 | Verificar VITE_CLICKUP_LIST_ID configurada | Variável presente | |
| [ ] | 12.4.4 | Clicar botão ClickUp em alerta | Abrir modal | |
| [ ] | 12.4.5 | Verificar dados pré-preenchidos | Título e descrição do alerta | |
| [ ] | 12.4.6 | Verificar dropdown de membros | Carrega lista do ClickUp | |
| [ ] | 12.4.7 | Selecionar prioridade | Urgente, Alta, Normal, Baixa | |
| [ ] | 12.4.8 | Criar tarefa | POST para API ClickUp | |
| [ ] | 12.4.9 | Verificar sucesso | Toast de confirmação | |
| [ ] | 12.4.10 | Verificar tarefa no ClickUp | Task criada na lista | |

### 12.5 ClickUp - Mapeamento de Prioridades

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 12.5.1 | Prioridade "urgente" | ClickUp priority = 1 | |
| [ ] | 12.5.2 | Prioridade "alta" | ClickUp priority = 2 | |
| [ ] | 12.5.3 | Prioridade "normal/media" | ClickUp priority = 3 | |
| [ ] | 12.5.4 | Prioridade "baixa" | ClickUp priority = 4 | |

### 12.6 Gmail - Abertura de Threads

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 12.6.1 | Clicar "Abrir no Gmail" | Abrir nova aba | |
| [ ] | 12.6.2 | Verificar URL | `mail.google.com/mail/u/0/#inbox/{thread_id}` | |
| [ ] | 12.6.3 | Verificar thread_id correto | ID corresponde à thread | |

---

## 13. Casos de Erro

### 13.1 Erros de Rede

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 13.1.1 | Desconectar internet | Exibir mensagem de erro | |
| [ ] | 13.1.2 | Timeout de requisição | Exibir mensagem de timeout | |
| [ ] | 13.1.3 | Reconectar | Recuperar estado | |

### 13.2 Erros de Autenticação

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 13.2.1 | Token expirado | Redirecionar para login | |
| [ ] | 13.2.2 | Sessão inválida | Redirecionar para login | |

### 13.3 Erros de Dados

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 13.3.1 | Cliente inexistente | Exibir "Não encontrado" | |
| [ ] | 13.3.2 | Thread inexistente | Exibir mensagem de erro | |
| [ ] | 13.3.3 | Dados corrompidos | Tratamento gracioso | |

### 13.4 Erros de Integração

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 13.4.1 | OpenAI API indisponível | Exibir erro e fallback | |
| [ ] | 13.4.2 | OpenAI API key inválida | Exibir erro de autenticação | |
| [ ] | 13.4.3 | ClickUp API indisponível | Exibir erro | |
| [ ] | 13.4.4 | ClickUp API key inválida | Exibir erro de autenticação | |
| [ ] | 13.4.5 | ClickUp list_id inválido | Exibir erro de configuração | |

### 13.5 Erros de Validação

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 13.5.1 | Formulário com campos obrigatórios vazios | Exibir erros de validação | |
| [ ] | 13.5.2 | Email formato inválido | Exibir erro de formato | |
| [ ] | 13.5.3 | Senha muito curta (<6 chars) | Exibir erro de tamanho | |
| [ ] | 13.5.4 | Pesos não somam 100% | Botão salvar desabilitado | |

### 13.6 Erros de Permissão

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [ ] | 13.6.1 | Acessar página sem permissão | Exibir "Acesso Restrito" | |
| [ ] | 13.6.2 | Tentar editar Super Admin | Ação bloqueada | |
| [ ] | 13.6.3 | Tentar excluir Super Admin | Ação bloqueada | |

---

## 14. Fluxos Completos

### 14.1 Fluxo: Onboarding de Novo Cliente

**Objetivo**: Criar cliente, aplicar playbook de onboarding, acompanhar etapas

| Passo | Ação | Resultado Esperado | Status |
|-------|------|-------------------|--------|
| [ ] | 1 | Acessar `/clientes/novo` | Formulário vazio | |
| [ ] | 2 | Preencher nome do cliente | Campo aceita | |
| [ ] | 3 | Selecionar status "Onboarding" | Dropdown atualiza | |
| [ ] | 4 | Adicionar responsável | Responsável na lista | |
| [ ] | 5 | Selecionar times | Times marcados | |
| [ ] | 6 | Salvar cliente | Cliente criado | |
| [ ] | 7 | Acessar `/playbooks` | Lista de playbooks | |
| [ ] | 8 | Clicar no playbook "Onboarding" | Detalhe do playbook | |
| [ ] | 9 | Clicar "Aplicar a Cliente" | Modal abre | |
| [ ] | 10 | Selecionar cliente criado | Cliente selecionado | |
| [ ] | 11 | Definir data de início | Data selecionada | |
| [ ] | 12 | Confirmar aplicação | Playbook aplicado | |
| [ ] | 13 | Acessar detalhe do cliente | Playbook aparece na seção | |
| [ ] | 14 | Expandir playbook | Ver etapas | |
| [ ] | 15 | Marcar primeira etapa como concluída | Progresso atualiza | |
| [ ] | 16 | Adicionar observação na etapa | Observação salva | |
| [ ] | 17 | Concluir todas etapas obrigatórias | Status "Concluído" | |

### 14.2 Fluxo: Tratamento de Alerta Crítico

**Objetivo**: Identificar alerta, investigar, resolver com ClickUp

| Passo | Ação | Resultado Esperado | Status |
|-------|------|-------------------|--------|
| [ ] | 1 | Acessar `/alertas` | Lista de alertas | |
| [ ] | 2 | Filtrar por prioridade "Urgente" | Alertas urgentes | |
| [ ] | 3 | Identificar alerta de health crítico | Alerta visível | |
| [ ] | 4 | Clicar nome do cliente | Navega para detalhe | |
| [ ] | 5 | Verificar health score | Score < 40 | |
| [ ] | 6 | Verificar threads recentes | Timeline carregada | |
| [ ] | 7 | Identificar threads com sentimento negativo | Filtrar por sentimento | |
| [ ] | 8 | Classificar thread com IA | OpenAI classifica | |
| [ ] | 9 | Criar tarefa no ClickUp | Modal abre | |
| [ ] | 10 | Preencher responsável e prioridade | Campos preenchidos | |
| [ ] | 11 | Criar tarefa | Tarefa criada | |
| [ ] | 12 | Voltar para Alertas | Lista de alertas | |
| [ ] | 13 | Marcar alerta como "Em Andamento" | Status atualizado | |
| [ ] | 14 | Após resolução, marcar como "Resolvido" | Status final | |

### 14.3 Fluxo: Análise de Performance do CS

**Objetivo**: Usar Analytics para avaliar performance da equipe

| Passo | Ação | Resultado Esperado | Status |
|-------|------|-------------------|--------|
| [ ] | 1 | Acessar `/analytics` | Dashboard completo | |
| [ ] | 2 | Selecionar período "30 dias" | Dados do período | |
| [ ] | 3 | Verificar Health Score médio | Métrica exibida | |
| [ ] | 4 | Analisar tabela "Performance por Responsável" | Dados por CS | |
| [ ] | 5 | Identificar CS com mais alertas pendentes | Ordenar coluna | |
| [ ] | 6 | Filtrar por esse responsável | Dados filtrados | |
| [ ] | 7 | Analisar Times em Risco | Lista atualizada | |
| [ ] | 8 | Verificar gráfico de Tendências | Evolução temporal | |
| [ ] | 9 | Exportar relatório completo | Download Excel | |
| [ ] | 10 | Verificar abas do Excel | Dados completos | |

### 14.4 Fluxo: Gestão de Usuários e Carteira

**Objetivo**: Criar usuário e atribuir clientes

| Passo | Ação | Resultado Esperado | Status |
|-------|------|-------------------|--------|
| [ ] | 1 | Acessar `/configuracoes/usuarios` | Lista de usuários | |
| [ ] | 2 | Clicar "Novo Usuário" | Modal abre | |
| [ ] | 3 | Preencher nome "João Silva" | Campo aceita | |
| [ ] | 4 | Preencher email "joao@trakto.io" | Email válido | |
| [ ] | 5 | Preencher senha (6+ chars) | Senha válida | |
| [ ] | 6 | Preencher cargo "Analista CS" | Campo aceita | |
| [ ] | 7 | Selecionar role "CS" | Role selecionada | |
| [ ] | 8 | Manter "Ativo" ligado | Toggle ativo | |
| [ ] | 9 | Salvar usuário | Usuário criado | |
| [ ] | 10 | Verificar na lista | João aparece | |
| [ ] | 11 | Clicar "0 clientes" em João | Modal de carteira | |
| [ ] | 12 | Buscar cliente específico | Filtro funciona | |
| [ ] | 13 | Selecionar 3 clientes | Checkboxes marcados | |
| [ ] | 14 | Salvar atribuições | Responsável atualizado | |
| [ ] | 15 | Verificar contador | "3 clientes" | |
| [ ] | 16 | Acessar detalhe de um cliente | Responsável = João | |

### 14.5 Fluxo: Configuração do Sistema

**Objetivo**: Ajustar parâmetros do Health Score e Alertas

| Passo | Ação | Resultado Esperado | Status |
|-------|------|-------------------|--------|
| [ ] | 1 | Acessar `/configuracoes` | Página de config | |
| [ ] | 2 | Alterar peso Engajamento para 25% | Campo atualiza | |
| [ ] | 3 | Alterar peso Sentimento para 25% | Campo atualiza | |
| [ ] | 4 | Ajustar outros para manter soma 100% | Total = 100% | |
| [ ] | 5 | Alterar threshold Saudável para 85 | Campo atualiza | |
| [ ] | 6 | Alterar "Dias sem contato para alerta" para 5 | Campo atualiza | |
| [ ] | 7 | Desativar "Alerta erro/bug" | Toggle desliga | |
| [ ] | 8 | Testar conexão ClickUp | Resultado exibido | |
| [ ] | 9 | Testar conexão OpenAI | Resultado exibido | |
| [ ] | 10 | Clicar "Salvar Configurações" | Loading + sucesso | |
| [ ] | 11 | Recarregar página | Valores persistidos | |
| [ ] | 12 | Verificar em outro navegador | Valores salvos no Firebase | |

---

## Checklist de Pré-Requisitos

Antes de iniciar os testes, verificar:

- [ ] Variáveis de ambiente configuradas no `.env`:
  - [ ] `VITE_OPENAI_API_KEY`
  - [ ] `VITE_CLICKUP_API_KEY`
  - [ ] `VITE_CLICKUP_TEAM_ID`
  - [ ] `VITE_CLICKUP_LIST_ID`
- [ ] Firebase configurado corretamente
- [ ] Regras do Firestore permitem acesso para @trakto.io
- [ ] Usuário de teste criado (email @trakto.io)
- [ ] Dados de teste no banco (clientes, threads, alertas)
- [ ] Playbooks padrão criados

---

## Ambiente de Testes

| Navegador | Versão | Status |
|-----------|--------|--------|
| Chrome | 120+ | [ ] |
| Firefox | 120+ | [ ] |
| Safari | 17+ | [ ] |
| Edge | 120+ | [ ] |

---

## Registro de Bugs Encontrados

| # | Página | Descrição | Severidade | Status |
|---|--------|-----------|------------|--------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

---

## Observações Finais

- Testes devem ser executados em ambiente de desenvolvimento
- Backup dos dados antes de testes destrutivos
- Documentar qualquer comportamento inesperado
- Screenshots de erros encontrados
- Notificar equipe sobre bugs críticos imediatamente

---

**Última Atualização**: Janeiro 2026
**Responsável**: Equipe CS Hub
