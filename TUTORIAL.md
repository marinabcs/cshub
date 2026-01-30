# CS Hub - Tutorial Completo e Roteiro de Demo

> **Versao:** 1.0.0
> **Data:** Janeiro 2026
> **Autor:** Equipe CS Trakto

---

## Sumario

1. [Introducao](#introducao)
2. [Requisitos e Instalacao](#requisitos-e-instalacao)
3. [Configuracao Inicial](#configuracao-inicial)
4. [Guia de Funcionalidades](#guia-de-funcionalidades)
5. [Roteiro de Video Demo](#roteiro-de-video-demo)
6. [FAQ e Troubleshooting](#faq-e-troubleshooting)

---

## Introducao

O **CS Hub** e uma plataforma completa para gestao de Customer Success, desenvolvida para ajudar equipes a:

- Monitorar a saude dos clientes em tempo real
- Classificar conversas automaticamente com IA
- Gerenciar alertas e acoes proativas
- Acompanhar metricas e analytics
- Executar playbooks de sucesso do cliente
- Integrar com ClickUp para gestao de tarefas

### Stack Tecnologico

| Tecnologia | Uso |
|------------|-----|
| React 19 | Frontend |
| Firebase | Backend (Firestore, Auth) |
| OpenAI GPT-4o-mini | Classificacao de threads |
| ClickUp API | Integracao de tarefas |
| Vite | Build tool |

---

## Requisitos e Instalacao

### Pre-requisitos

- Node.js 18+ instalado
- Conta Firebase configurada
- Chaves de API (OpenAI, ClickUp - opcional)
- Email @trakto.io para acesso

### Passo a Passo de Instalacao

```bash
# 1. Clonar o repositorio
git clone [url-do-repo]
cd cshub

# 2. Instalar dependencias
npm install

# 3. Configurar variaveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas chaves

# 4. Iniciar servidor de desenvolvimento
npm run dev

# 5. Acessar no navegador
# http://localhost:5173
```

### Variaveis de Ambiente

Edite o arquivo `.env` com as seguintes variaveis:

```env
# OpenAI - para classificacao de threads
VITE_OPENAI_API_KEY=sua_chave_openai

# ClickUp - para integracao de tarefas (opcional)
VITE_CLICKUP_API_KEY=sua_chave_clickup
VITE_CLICKUP_TEAM_ID=id_do_time
VITE_CLICKUP_LIST_ID=id_da_lista
```

---

## Configuracao Inicial

### 1. Primeiro Acesso

1. Acesse a URL da aplicacao
2. Faca login com seu email @trakto.io
3. O sistema criara seu usuario automaticamente

### 2. Niveis de Acesso

| Role | Permissoes |
|------|------------|
| **CS** | Visualizar clientes, threads, alertas. Criar/editar alertas |
| **Gestor** | Tudo do CS + gerenciar playbooks, ver analytics completo |
| **Admin** | Tudo do Gestor + gerenciar usuarios, configuracoes |
| **Super Admin** | Acesso total, incluindo auditoria |

### 3. Configurar Integracoes (Admin)

Acesse **Configuracoes** no menu lateral para:
- Verificar status das APIs (OpenAI, ClickUp)
- Configurar pesos do Health Score
- Gerenciar calculos automaticos

---

## Guia de Funcionalidades

### Dashboard

A pagina inicial mostra uma visao geral:

- **Cards de resumo**: Total de clientes, alertas pendentes, health medio
- **Grafico de saude**: Distribuicao dos clientes por status de saude
- **Alertas recentes**: Ultimos alertas criados que precisam de atencao
- **Acoes rapidas**: Links para funcionalidades principais

**Como usar:**
1. Verifique os alertas urgentes primeiro
2. Clique em um alerta para ver detalhes
3. Use os cards para navegar para areas especificas

---

### Clientes

Lista completa de clientes com filtros avancados.

**Funcionalidades:**
- Busca por nome ou responsavel
- Filtro por status de saude (Saudavel, Atencao, Risco, Critico)
- Filtro por status do cliente (Ativo, Em risco, Inativo, etc.)
- Ordenacao por nome, health score, ultima interacao
- Selecao multipla para edicao em lote

**Acoes disponiveis:**
- Ver detalhes do cliente
- Editar informacoes
- Aplicar playbook
- Exportar lista

---

### Detalhe do Cliente

Pagina completa com todas as informacoes de um cliente.

**Abas disponiveis:**

1. **Visao Geral**
   - Health Score com grafico historico
   - Informacoes basicas (nome, responsavel, status)
   - Alertas ativos do cliente
   - Acoes rapidas

2. **Threads/Conversas**
   - Lista de todas as conversas
   - Classificacao por IA (categoria, sentimento)
   - Status (ativo, resolvido, aguardando)
   - Botao para classificar manualmente

3. **Playbooks**
   - Playbooks ativos para o cliente
   - Progresso de cada etapa
   - Historico de playbooks concluidos

4. **Metricas**
   - Uso da plataforma (logins, pecas criadas)
   - Tendencias de engajamento
   - Comparativo com periodo anterior

**Como classificar uma thread:**
1. Clique na thread para abrir detalhes
2. Clique em "Classificar com IA"
3. O sistema analisa a conversa e retorna:
   - Categoria (Erro, Reclamacao, Duvida, etc.)
   - Sentimento (Positivo, Neutro, Negativo, Urgente)
   - Resumo automatico
4. Se necessario, ajuste manualmente

---

### Alertas

Central de alertas para gestao proativa.

**Tipos de Alerta:**

| Tipo | Descricao | Prioridade Default |
|------|-----------|-------------------|
| Sem Uso | Cliente sem usar a plataforma ha 15+ dias | Media/Alta |
| Problema/Reclamacao | Thread classificada como problema | Alta |
| Sentimento Negativo | Thread com sentimento negativo/urgente | Alta/Urgente |

**Fluxo de trabalho:**

1. **Verificar alertas**: Clique em "Verificar Alertas" para gerar novos
2. **Priorizar**: Ordene por prioridade (Urgente > Alta > Media > Baixa)
3. **Atuar**: Clique no alerta para ver detalhes e tomar acao
4. **Atualizar status**:
   - Pendente -> Em Andamento -> Resolvido
   - Ou marcar como Ignorado se nao aplicavel
5. **ClickUp**: Alertas criam tarefas automaticamente (se configurado)

**Sincronizacao ClickUp:**
- Status do ClickUp sincroniza com CS Hub
- Botao "Sincronizar" em Configuracoes

---

### Analytics

Dashboard de metricas em 5 abas:

1. **Uso da Plataforma**
   - Logins por periodo
   - Pecas criadas
   - Downloads
   - Uso de IA

2. **Conversas**
   - Volume de threads
   - Distribuicao por categoria
   - Tempo medio de resposta
   - Sentimento geral

3. **Usuarios**
   - Total de usuarios ativos
   - Heavy users por cliente
   - Engajamento medio

4. **Vendas**
   - MRR por cliente
   - Crescimento de receita
   - Upsell/Downsell

5. **Churn**
   - Taxa de churn
   - Clientes em risco
   - Motivos de cancelamento

---

### Playbooks

Biblioteca de playbooks para acoes padronizadas.

**O que e um Playbook:**
Sequencia de acoes predefinidas para situacoes especificas:
- Onboarding de novo cliente
- Recuperacao de cliente em risco
- Follow-up pos-suporte
- Renovacao de contrato

**Estrutura de um Playbook:**
- Nome e descricao
- Etapas sequenciais
- Acoes por etapa (enviar email, agendar call, etc.)
- Prazos sugeridos

**Como aplicar um Playbook:**
1. Acesse o cliente
2. Clique em "Aplicar Playbook"
3. Selecione o playbook adequado
4. Confirme a aplicacao
5. Acompanhe o progresso nas etapas

---

### Configuracoes

Pagina de configuracoes do sistema (Admin).

**Secoes:**

1. **Status das APIs**
   - Verificar conexao OpenAI
   - Verificar conexao ClickUp
   - Testar integracao

2. **Health Score**
   - Ajustar pesos dos componentes
   - Definir thresholds de status

3. **Calculos Automaticos**
   - Executar calculo de Health Score para todos
   - Verificar e gerar alertas

4. **Manutencao**
   - Limpar alertas antigos
   - Fechar alertas de clientes inativos

---

### Usuarios (Admin)

Gerenciamento de usuarios do sistema.

**Funcionalidades:**
- Listar usuarios
- Criar novo usuario
- Editar permissoes (role)
- Desativar usuario

**Importante:** Apenas emails @trakto.io podem acessar o sistema.

---

### Auditoria (Admin)

Log de todas as acoes realizadas no sistema.

**O que e registrado:**
- Login/logout de usuarios
- Criacoes e edicoes de clientes
- Mudancas de status de alertas
- Aplicacao de playbooks
- Alteracoes de configuracao

**Caracteristicas:**
- Append-only (nao pode ser editado ou deletado)
- Filtro por data, usuario, tipo de acao
- Exportacao para analise

---

## Roteiro de Video Demo

### Duracao Total: 8-10 minutos

---

### Abertura (30 segundos)

```
[TELA: Logo CS Hub]

NARRADOR:
"Ola! Bem-vindo ao CS Hub, a plataforma de Customer Success da Trakto.
Neste video, vou mostrar como usar as principais funcionalidades
para monitorar seus clientes e agir proativamente."
```

---

### Parte 1: Dashboard e Visao Geral (1 minuto)

```
[TELA: Dashboard]

NARRADOR:
"Ao fazer login, voce chega no Dashboard.
Aqui voce ve um resumo rapido:
- Quantos clientes voce gerencia
- Alertas que precisam de atencao
- Saude geral da sua carteira

Os cards coloridos mostram a distribuicao de saude:
- Verde: clientes saudaveis
- Amarelo: precisam de atencao
- Vermelho: em risco

Clique em qualquer card para ir direto para a lista filtrada."

[ACAO: Clicar no card de alertas pendentes]
```

---

### Parte 2: Gestao de Alertas (2 minutos)

```
[TELA: Pagina de Alertas]

NARRADOR:
"A pagina de Alertas e sua central de comando.
O sistema gera alertas automaticamente quando detecta:
- Clientes sem usar a plataforma ha mais de 15 dias
- Conversas com sentimento negativo
- Problemas ou reclamacoes reportados

Vamos ver como funciona:"

[ACAO: Clicar em "Verificar Alertas"]

"Clicando em Verificar Alertas, o sistema analisa todos os dados
e cria alertas para situacoes que precisam de atencao."

[ACAO: Clicar em um alerta urgente]

"Ao clicar em um alerta, voce ve os detalhes:
- Qual cliente
- Qual o problema
- Link para a conversa original

Daqui voce pode:
- Marcar como Em Andamento enquanto resolve
- Ir para o cliente para ver mais contexto
- Marcar como Resolvido quando concluir

Se voce tem ClickUp configurado, cada alerta cria uma tarefa
automaticamente, e o status sincroniza entre os dois sistemas."
```

---

### Parte 3: Classificacao de Threads com IA (2 minutos)

```
[TELA: Detalhe de um cliente > Aba Threads]

NARRADOR:
"Uma das funcionalidades mais poderosas e a classificacao com IA.
Vamos ver uma thread deste cliente."

[ACAO: Clicar em uma thread nao classificada]

"Esta conversa ainda nao foi classificada.
Clicando em 'Classificar com IA'..."

[ACAO: Clicar no botao Classificar]

"...o sistema envia a conversa para analise.
Em segundos, recebemos:
- Categoria: neste caso, 'Problema Tecnico'
- Sentimento: 'Negativo'
- Resumo: uma descricao do que foi discutido

Se o sentimento for negativo ou urgente, um alerta e criado
automaticamente para voce acompanhar.

Isso economiza tempo de leitura e garante que nenhum
problema passe despercebido."
```

---

### Parte 4: Health Score (1.5 minutos)

```
[TELA: Detalhe do cliente > Visao Geral]

NARRADOR:
"Cada cliente tem um Health Score de 0 a 100.
O score e calculado com base em 5 componentes:"

[ACAO: Apontar para o grafico de Health Score]

"1. Engajamento - quantas conversas o cliente teve
2. Sentimento - proporcao de conversas positivas vs negativas
3. Tickets Abertos - threads nao resolvidas
4. Tempo sem Contato - dias desde a ultima interacao
5. Uso da Plataforma - logins, pecas criadas, etc.

O grafico mostra a evolucao ao longo do tempo.
Se o score cair, voce sabe que precisa agir.

Os status sao:
- Saudavel (70-100): tudo bem
- Atencao (50-69): monitorar de perto
- Risco (30-49): intervencao necessaria
- Critico (0-29): acao urgente"
```

---

### Parte 5: Playbooks (1.5 minutos)

```
[TELA: Pagina de Playbooks]

NARRADOR:
"Playbooks sao sequencias de acoes padronizadas.
Por exemplo, temos um playbook de 'Recuperacao de Cliente em Risco'
com etapas como:
- Enviar email de check-in
- Agendar call de diagnostico
- Criar plano de acao
- Fazer follow-up

Vamos aplicar um playbook a um cliente."

[ACAO: Ir para cliente > Clicar em Aplicar Playbook]

"Seleciono o playbook adequado e confirmo.
Agora posso acompanhar o progresso de cada etapa.

Se ClickUp estiver configurado, cada etapa cria uma tarefa
para voce nao esquecer de executar."
```

---

### Parte 6: Analytics (1 minuto)

```
[TELA: Pagina Analytics]

NARRADOR:
"A pagina Analytics mostra metricas detalhadas em 5 abas.

Na aba Uso, vejo como os clientes estao usando a plataforma.
Na aba Conversas, analiso o volume e sentimento das threads.
Na aba Churn, monitoro clientes em risco de cancelamento.

Esses dados ajudam a identificar tendencias e agir antes
que pequenos problemas se tornem grandes."

[ACAO: Navegar entre as abas rapidamente]
```

---

### Encerramento (30 segundos)

```
[TELA: Dashboard]

NARRADOR:
"E isso! Com o CS Hub voce tem:
- Visao completa da saude dos seus clientes
- Alertas automaticos para agir proativamente
- IA para classificar conversas rapidamente
- Playbooks para padronizar suas acoes
- Analytics para tomar decisoes baseadas em dados

Se tiver duvidas, fale com o time de tecnologia.
Obrigado por assistir!"

[TELA: Logo CS Hub + "Duvidas? Fale conosco"]
```

---

### Checklist de Gravacao

**Antes de gravar:**
- [ ] Ambiente limpo (dados de teste, nao producao)
- [ ] Alguns clientes com diferentes status de saude
- [ ] Algumas threads para classificar
- [ ] Um alerta urgente para demonstrar
- [ ] ClickUp configurado (se possivel)

**Durante a gravacao:**
- [ ] Movimentos de mouse calmos e deliberados
- [ ] Pausar em telas importantes
- [ ] Narrar em ritmo natural
- [ ] Destacar cliques importantes

**Pos-producao:**
- [ ] Adicionar zoom em areas importantes
- [ ] Inserir setas ou destaques visuais
- [ ] Adicionar legendas
- [ ] Musica de fundo suave (opcional)

---

## FAQ e Troubleshooting

### Problemas Comuns

**1. Nao consigo fazer login**
- Verifique se seu email e @trakto.io
- Limpe o cache do navegador
- Tente em uma janela anonima

**2. Classificacao com IA nao funciona**
- Verifique se a chave OpenAI esta configurada
- Veja o console do navegador para erros
- A thread precisa ter mensagens para classificar

**3. Alertas nao estao sendo criados**
- Clique em "Verificar Alertas" na pagina de Alertas
- Verifique se os clientes estao com status ativo
- Threads precisam estar classificadas para gerar alguns alertas

**4. ClickUp nao sincroniza**
- Verifique as chaves de API em Configuracoes
- Teste a conexao com o botao de teste
- Verifique se o List ID esta correto

**5. Health Score zerado**
- Execute o calculo em Configuracoes
- Verifique se o cliente tem dados (threads, metricas)

### Contato

Para suporte tecnico, entre em contato com a equipe de desenvolvimento.

---

**Documento criado em:** Janeiro 2026
**Ultima atualizacao:** 30/01/2026
