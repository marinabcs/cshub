# Cloud Functions - CS Hub

## Funções Disponíveis

### 1. `healthScoreManha` (Agendada)
- **Horário:** 7:30 AM (horário de Brasília)
- **Trigger:** Cloud Scheduler
- Roda após a sincronização das 7h do n8n

### 2. `healthScoreTarde` (Agendada)
- **Horário:** 13:30 PM (horário de Brasília)
- **Trigger:** Cloud Scheduler
- Roda após a sincronização das 13h do n8n

### 3. `calcularHealthScores` (HTTP)
- **Método:** POST
- **URL:** `https://southamerica-east1-cshub-trakto.cloudfunctions.net/calcularHealthScores`
- Para execução manual ou via webhook

## Deploy

### Pré-requisitos
1. Firebase CLI instalado: `npm install -g firebase-tools`
2. Autenticado no Firebase: `firebase login`
3. Projeto configurado: `firebase use cshub-trakto`

### Comandos

```bash
# Instalar dependências
cd functions
npm install

# Deploy de todas as funções
firebase deploy --only functions

# Deploy de função específica
firebase deploy --only functions:healthScoreManha
firebase deploy --only functions:healthScoreTarde
firebase deploy --only functions:calcularHealthScores

# Ver logs
firebase functions:log
```

## Configuração do Cloud Scheduler

Após o deploy, o Cloud Scheduler será configurado automaticamente via Firebase.
As funções agendadas criam jobs no Cloud Scheduler:

- `firebase-schedule-healthScoreManha-southamerica-east1`
- `firebase-schedule-healthScoreTarde-southamerica-east1`

## Execução Manual via HTTP

```bash
# Exemplo com curl
curl -X POST https://southamerica-east1-cshub-trakto.cloudfunctions.net/calcularHealthScores
```

## Logs

```bash
# Ver todos os logs
firebase functions:log

# Filtrar por função
firebase functions:log --only healthScoreManha
```

## Troubleshooting

### Erro de permissão
Verifique se a Service Account do Cloud Functions tem permissão de leitura/escrita no Firestore.

### Timeout
As funções estão configuradas com timeout padrão de 60s. Se necessário aumentar:
```javascript
export const healthScoreManha = onSchedule({
  schedule: '30 7 * * *',
  timeZone: 'America/Sao_Paulo',
  region: 'southamerica-east1',
  timeoutSeconds: 540  // 9 minutos
}, async (event) => {
  // ...
});
```
