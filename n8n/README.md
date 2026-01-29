# Workflow n8n - Health Score CS Hub

## Pré-requisitos

### 1. Criar Credencial Google API no n8n

1. No n8n, vá em **Credentials** → **Add Credential**
2. Busque **Google API**
3. Selecione **Service Account**
4. Cole o JSON da sua Service Account do Firebase

### 2. Criar Service Account no Google Cloud

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Selecione o projeto `cshub-trakto`
3. Vá em **IAM & Admin** → **Service Accounts**
4. Clique **Create Service Account**
   - Nome: `n8n-health-score`
   - Descrição: `Service account para cálculo de health scores via n8n`
5. Clique **Create and Continue**
6. Adicione o role: **Cloud Datastore User** (permite ler/escrever no Firestore)
7. Clique **Done**
8. Na lista, clique no service account criado
9. Vá na aba **Keys** → **Add Key** → **Create new key**
10. Selecione **JSON** e clique **Create**
11. O arquivo JSON será baixado - use ele no n8n

### 3. Importar o Workflow

1. No n8n, vá em **Workflows**
2. Clique no menu **⋮** → **Import from File**
3. Selecione o arquivo `workflow-health-score.json`
4. Edite cada node HTTP Request e selecione sua credencial Google API

### 4. Configurar Schedule (Opcional)

O workflow vem com dois triggers:
- **Manual** - para testes
- **Schedule** (desabilitado) - 7h30 e 13h30

Para ativar o agendamento:
1. Clique no node "Schedule 7h30 e 13h30"
2. Desabilite o node "Trigger Manual ou Schedule"
3. Habilite o node de Schedule

## Como Funciona

1. **Buscar Clientes** - Pega todos os clientes do Firestore
2. **Processar Clientes** - Filtra inativos/cancelados
3. **Loop** - Para cada cliente:
   - Busca threads (conversas)
   - Busca usuários
   - Busca métricas de uso
4. **Calcular Score** - Aplica a fórmula do Health Score
5. **Salvar** - Atualiza o cliente e salva no histórico

## Fórmula do Health Score

| Componente | Peso |
|------------|------|
| Engajamento | 25% |
| Sentimento | 25% |
| Tickets Abertos | 20% |
| Tempo sem Contato | 15% |
| Uso da Plataforma | 15% |

## Troubleshooting

### Erro 403 - Permission Denied
- Verifique se a Service Account tem o role `Cloud Datastore User`
- Ou adicione o role `Firebase Admin`

### Erro 401 - Unauthorized
- A credencial pode ter expirado
- Recrie a key JSON da Service Account

### Timeout
- Se tiver muitos clientes, o workflow pode demorar
- Considere aumentar o timeout nas configurações do n8n

## Alternativa: Adicionar ao Workflow de Sincronização

Ao invés de criar um workflow separado, você pode adicionar estes nodes **no final** do seu workflow de sincronização de emails. Assim o Health Score é calculado automaticamente após cada sync.
