# **Roteiro de Testes - CS Hub v1.0**

**Data de Criação**: Janeiro 2026
**Projeto**: CS Hub - Customer Success Management System
**Versão**: 1.0
**Framework**: React 18 + Firebase + Vite

---

## **Sumário**

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

## **1. Autenticação**

### **1.1 Login com Email @trakto.io**

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [X] | 1.1.1 | Acessar /login sem estar logado | Exibir página de login com formulário | feito |
| [X] | 1.1.2 | Inserir email válido usuario@trakto.io e senha correta | Redirecionar para Dashboard (/) | Feito, ✅ CORRIGIDO - placeholder atualizado |
| [X] | 1.1.3 | Verificar sessão persistida após refresh da página | Usuário continua logado | Sessão persiste logada |
| [X] | 1.1.4 | Verificar botão "Mostrar/Ocultar" senha | Alterna visibilidade da senha | feito |

### **1.2 Bloqueio de Outros Domínios**

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [X] | 1.2.1 | Tentar login com email usuario@gmail.com | Exibir erro "Email deve ser @trakto.io" | ✅ CORRIGIDO - Exibe aviso agora |
| [X] | 1.2.2 | Tentar login com email usuario@empresa.com | Exibir erro "Email deve ser @trakto.io" | ✅ CORRIGIDO - Exibe aviso agora |
| [X] | 1.2.3 | Tentar login com email sem domínio | Exibir erro de formato inválido | Exibe aviso e solicita @ |

### **1.3 Validações de Login**

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [X] | 1.3.1 | Submeter formulário com campos vazios | Exibir erro de campos obrigatórios | feito |
| [X] | 1.3.2 | Inserir email correto e senha incorreta | Exibir erro "Email ou senha inválidos" | feito |
| [X] | 1.3.3 | Verificar loading state durante autenticação | Botão exibir spinner durante processo | feito |

### **1.4 Logout**

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [X] | 1.4.1 | Clicar em "Sair" no sidebar | Redirecionar para /login | feito |
| [X] | 1.4.2 | Tentar acessar página protegida após logout | Redirecionar para /login | feito |

### **1.5 Redirecionamento**

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [X] | 1.5.1 | Acessar /login estando logado | Redirecionar para Dashboard | feito |
| [X] | 1.5.2 | Acessar /clientes sem estar logado | Redirecionar para /login | feito |

### **1.6 Esqueci minha senha**

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [X] | 1.6.1 | Clicar em "Esqueci minha senha" | Abrir modal de recuperação | ✅ IMPLEMENTADO |
| [X] | 1.6.2 | Inserir email @trakto.io válido | Enviar email de recuperação | ✅ IMPLEMENTADO |
| [X] | 1.6.3 | Inserir email de outro domínio | Exibir erro de domínio | ✅ IMPLEMENTADO |

---

## **2. Dashboard**

### **2.1 Carregamento Inicial**

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [X] | 2.1.1 | Acessar Dashboard | Exibir loading durante carregamento | feito |
| [X] | 2.1.2 | Verificar cards de estatísticas | 4 cards: Total, Saudáveis, Atenção, Críticos | feito |
| [X] | 2.1.3 | Verificar card de Alertas | Exibir contagem de alertas pendentes | feito |
| [X] | 2.1.4 | Verificar gráfico de distribuição | Gráfico de barras com Health Score | feito |

### **2.2 Cards de Estatísticas**

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [X] | 2.2.1 | Verificar contagem "Total de Clientes" | Número corresponde ao total no banco | feito |
| [X] | 2.2.2 | Verificar contagem "Saudáveis" | Número de clientes com health_score >= 80 | feito |
| [X] | 2.2.3 | Verificar contagem "Precisam Atenção" | Clientes com health_score 60-79 | feito |
| [X] | 2.2.4 | Verificar contagem "Estado Crítico" | Clientes com health_score < 40 | feito |

### **2.3 Busca e Filtros**

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [X] | 2.3.1 | Buscar por nome do cliente | Filtrar lista exibindo correspondências | feito |
| [X] | 2.3.2 | Buscar por nome do responsável | Filtrar lista pelo responsável | feito |
| [X] | 2.3.3 | Filtrar por Tipo de Time | Filtrar por team_type selecionado | feito |
| [X] | 2.3.4 | Filtrar por Responsável | Filtrar por responsável selecionado | feito |
| [X] | 2.3.5 | Aplicar múltiplos filtros | Combinar filtros corretamente | feito |
| [X] | 2.3.6 | Clicar "Limpar Filtros" | Resetar todos os filtros | feito |
| [X] | 2.3.7 | Verificar contador de resultados | Exibir "X de Y clientes" | feito |

---

## **3. Clientes**

### **3.1 Listagem**

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [X] | 3.1.1 | Acessar /clientes | Exibir grid de clientes | feito |
| [X] | 3.1.2 | Verificar informações do card | Nome, tipo, status, health, responsável | feito |
| [X] | 3.1.3 | Verificar contador no header | "X clientes cadastrados" | feito |

### **3.2 Busca e Filtros**

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [X] | 3.2.1 | Buscar por nome do cliente | Filtrar lista | feito |
| [X] | 3.2.2 | Filtrar por Health Status (Saudável) | Mostrar apenas health_score >= 80 | ✅ CORRIGIDO - Adicionado botão "Limpar filtros" |
| [X] | 3.2.3 | Filtrar por Health Status (Atenção) | Mostrar apenas health_score 60-79 | feito |
| [X] | 3.2.4 | Filtrar por Health Status (Risco) | Mostrar apenas health_score 40-59 | feito |
| [X] | 3.2.5 | Filtrar por Health Status (Crítico) | Mostrar apenas health_score < 40 | feito |

### **3.3 Times Órfãos**

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [X] | 3.3.1 | Verificar alerta de times órfãos | Exibir banner se existirem | feito |
| [X] | 3.3.2 | Clicar "Ver times" | Abrir modal com lista | feito |
| [X] | 3.3.3 | Clicar "Atribuir" em um time | Navegar para lista de clientes | ✅ CORRIGIDO - Agora vincula a cliente existente |

### **3.4 Exportação CSV**

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [X] | 3.5.1 | Clicar "Exportar CSV" sem filtros | Download com todos os clientes | feito |
| [X] | 3.5.2 | Clicar "Exportar CSV" com filtros | Download apenas clientes filtrados | feito |
| [X] | 3.5.3 | Abrir CSV no Excel | Arquivo com encoding UTF-8 correto | feito |

### **3.5 Novo Cliente**

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [X] | 3.6.1 | Clicar "Novo Cliente" | Navegar para /clientes/novo | ✅ CORRIGIDO - Bloqueia nomes duplicados |

---

## **4. Detalhe do Cliente**

### **4.1 Informações Básicas**

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [X] | 4.1.1 | Acessar /clientes/:id | Exibir detalhes do cliente | feito |
| [X] | 4.1.2 | Verificar header | Nome, status, health badges | feito |
| [X] | 4.1.3 | Verificar info do cliente | Responsável, email, times, data criação | ✅ CORRIGIDO - Data de criação adicionada |

### **4.2 Health Score**

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [X] | 4.2.1 | Verificar score atual | Exibir número 0-100 com cor | feito |
| [X] | 4.2.2 | Verificar gráfico histórico | Linha com últimos 30 dias | feito |
| [X] | 4.2.3 | Clicar "Recalcular" | Recalcular e atualizar score | feito |

---

## **5. Formulário de Cliente**

### **5.1 Criar Novo Cliente**

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [X] | 5.1.1 | Acessar /clientes/novo | Exibir formulário vazio | feito |
| [X] | 5.1.2 | Preencher nome (obrigatório) | Campo aceita texto | feito |
| [X] | 5.1.3 | Selecionar status e categoria produto | Dropdown com opções | ✅ CORRIGIDO - Categoria produto adicionada |

---

## **6. Playbooks**

### **6.1 Lista de Playbooks**

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [X] | 6.1.1 | Acessar /playbooks | Exibir lista de templates | feito |
| [X] | 6.1.2 | Verificar info do card | Nome, descrição, duração, etapas | feito |
| [X] | 6.1.3 | Clicar "Ver" em playbook | Navegar para detalhe | feito |

---

## **7. Alertas**

### **7.1 Lista de Alertas**

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [X] | 7.1.1 | Acessar /alertas | Exibir lista de alertas | feito |
| [X] | 7.1.2 | Verificar cards de estatísticas | Pendentes, Em Andamento, Resolvidos Hoje | feito |
| [X] | 7.1.3 | Verificar info do alerta | Tipo, título, cliente, prioridade, status | feito |

### **7.2 Filtros de Alertas**

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [X] | 7.2.1 | Filtrar por tipo (sem_contato) | Mostrar apenas este tipo | ✅ CORRIGIDO - Adicionados filtros team_type e responsável |
| [X] | 7.2.2 | Filtrar por Tipo de Time | Filtrar por team_type | ✅ IMPLEMENTADO |
| [X] | 7.2.3 | Filtrar por Responsável | Filtrar por pessoa | ✅ IMPLEMENTADO |

---

## **8. Analytics**

### **8.1 Visão Geral**

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [X] | 8.1.1 | Acessar /analytics | Exibir dashboard completo | feito |
| [X] | 8.1.2 | Verificar cards de métricas | Clientes Ativos, Times, Threads, Alertas | feito |
| [X] | 8.1.3 | Exportar relatório Excel | Download .xlsx | feito |

---

## **9. Configurações**

### **9.1 Pesos do Health Score**

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [X] | 9.1.1 | Acessar /configuracoes | Exibir página de config | feito |
| [X] | 9.1.2 | Verificar soma = 100% | Validação funciona | feito |
| [X] | 9.1.3 | Salvar configurações | Persistir no Firebase | feito |

### **9.2 Integrações**

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [X] | 9.5.1 | Testar conexão ClickUp | Resultado exibido | feito |
| [X] | 9.5.2 | Testar conexão OpenAI | Resultado exibido | feito |

---

## **10. Gerenciamento de Usuários**

### **10.1 Lista de Usuários**

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [X] | 10.1.1 | Acessar /configuracoes/usuarios | Exibir lista de usuários | A verificar |
| [X] | 10.2.7 | Criar super_admin | Apenas marina@trakto.io pode | ✅ JÁ IMPLEMENTADO |

### **10.2 Criar Novo Usuário**

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [X] | 10.2.1 | Criar usuário | Não logar automaticamente | ✅ CORRIGIDO - Usa Firebase App secundário |

---

## **11. Sidebar**

### **11.1 Navegação**

| # | Teste | Passos | Resultado Esperado | Status |
|---|-------|--------|-------------------|--------|
| [X] | Bug 5 | Hover dos menus | Configurações não fica selecionado junto | ✅ CORRIGIDO |
| [X] | Bug 1 | Responsividade | Sidebar com scroll e user fixo | ✅ CORRIGIDO |

---

## **Registro de Bugs Corrigidos**

| # | Página | Descrição | Status |
|---|--------|-----------|--------|
| 1 | Login | Placeholder do email corrigido | ✅ CORRIGIDO |
| 2 | Login | Aviso para emails não @trakto.io | ✅ CORRIGIDO |
| 3 | Login | Botão "Esqueci minha senha" implementado | ✅ CORRIGIDO |
| 4 | Clientes | Botão "Limpar filtros" adicionado | ✅ CORRIGIDO |
| 5 | Clientes | Botão "Atribuir" vincula a cliente existente | ✅ CORRIGIDO |
| 6 | Clientes | Validação de nome duplicado | ✅ CORRIGIDO |
| 7 | Cliente Detalhe | Data de criação adicionada | ✅ CORRIGIDO |
| 8 | Cliente Form | Categoria de produto adicionada | ✅ CORRIGIDO |
| 9 | Alertas | Filtros team_type e responsável | ✅ CORRIGIDO |
| 10 | Sidebar | Hover dos menus corrigido | ✅ CORRIGIDO |
| 11 | Sidebar | Responsividade com scroll | ✅ CORRIGIDO |
| 12 | Usuários | Criar usuário não loga automaticamente | ✅ CORRIGIDO |

---

**Última Atualização**: Janeiro 2026
**Responsável**: Equipe CS Hub
