/**
 * Cloud Functions para CS Hub
 *
 * Webhook para sincronizacao bidirecional com ClickUp
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';

// Inicializar Firebase Admin
initializeApp();
const db = getFirestore();

// ============================================
// WEBHOOK CLICKUP - SINCRONIZAÇÃO DE STATUS
// ============================================

/**
 * Mapeamento de status do ClickUp para status do CS Hub
 *
 * Status configurados no ClickUp:
 * - PENDENTE (Not started)
 * - EM ANDAMENTO (Active)
 * - BLOQUEADO (Active)
 * - RESOLVIDO (Done)
 * - IGNORADO (Done)
 */
const CLICKUP_STATUS_MAP = {
  // PENDENTE (Not started)
  'pendente': 'pendente',

  // EM ANDAMENTO (Active)
  'em andamento': 'em_andamento',

  // BLOQUEADO (Active)
  'bloqueado': 'bloqueado',

  // RESOLVIDO (Done)
  'resolvido': 'resolvido',

  // IGNORADO (Done)
  'ignorado': 'ignorado'
};

/**
 * Normalizar nome do status para comparação
 */
function normalizeStatus(status) {
  if (!status) return '';
  return status.toLowerCase().trim();
}

/**
 * Webhook para receber atualizações do ClickUp
 * POST /clickupWebhook
 *
 * Para configurar no ClickUp:
 * 1. Vá em Settings > Integrations > Webhooks
 * 2. Crie um novo webhook com a URL desta função
 * 3. Selecione o evento "Task Status Updated"
 */
export const clickupWebhook = onRequest({
  region: 'southamerica-east1',
  cors: true
}, async (req, res) => {
  // Aceitar apenas POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido. Use POST.' });
    return;
  }

  console.log('='.repeat(60));
  console.log('CLICKUP WEBHOOK RECEBIDO');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  try {
    const payload = req.body;

    // Log do payload para debug
    console.log('Evento:', payload.event);
    console.log('Task ID:', payload.task_id);

    // Verificar se é um evento de mudança de status
    if (payload.event !== 'taskStatusUpdated' && payload.event !== 'taskUpdated') {
      console.log('Evento ignorado (não é atualização de status)');
      res.status(200).json({ success: true, message: 'Evento ignorado' });
      return;
    }

    const taskId = payload.task_id;
    if (!taskId) {
      console.log('Task ID não encontrado no payload');
      res.status(400).json({ error: 'Task ID não encontrado' });
      return;
    }

    // Extrair novo status do payload
    // ClickUp envia history_items com as mudanças
    let novoStatusClickUp = null;

    if (payload.history_items && payload.history_items.length > 0) {
      const statusChange = payload.history_items.find(
        item => item.field === 'status' || item.field === 'task_status'
      );
      if (statusChange && statusChange.after) {
        novoStatusClickUp = statusChange.after.status || statusChange.after;
      }
    }

    // Fallback: tentar pegar do próprio payload
    if (!novoStatusClickUp && payload.status) {
      novoStatusClickUp = payload.status.status || payload.status;
    }

    if (!novoStatusClickUp) {
      console.log('Novo status não encontrado no payload');
      res.status(200).json({ success: true, message: 'Status não alterado' });
      return;
    }

    console.log('Novo status ClickUp:', novoStatusClickUp);

    // Mapear para status do CS Hub
    const novoStatusCSHub = CLICKUP_STATUS_MAP[normalizeStatus(novoStatusClickUp)];

    if (!novoStatusCSHub) {
      console.log(`Status "${novoStatusClickUp}" não mapeado, ignorando`);
      res.status(200).json({ success: true, message: 'Status não mapeado' });
      return;
    }

    console.log('Novo status CS Hub:', novoStatusCSHub);

    // Buscar alerta pelo clickup_task_id
    const alertasSnap = await db.collection('alertas')
      .where('clickup_task_id', '==', taskId)
      .get();

    if (alertasSnap.empty) {
      console.log(`Nenhum alerta encontrado com clickup_task_id: ${taskId}`);
      res.status(200).json({ success: true, message: 'Alerta não encontrado' });
      return;
    }

    // Atualizar todos os alertas encontrados (normalmente será apenas 1)
    let atualizados = 0;
    for (const alertaDoc of alertasSnap.docs) {
      const alertaAtual = alertaDoc.data();

      // Só atualizar se o status for diferente
      if (alertaAtual.status === novoStatusCSHub) {
        console.log(`Alerta ${alertaDoc.id} já está com status ${novoStatusCSHub}`);
        continue;
      }

      const updateData = {
        status: novoStatusCSHub,
        updated_at: Timestamp.now(),
        clickup_sync_at: Timestamp.now()
      };

      // Adicionar resolved_at se for resolvido ou ignorado
      if (novoStatusCSHub === 'resolvido' || novoStatusCSHub === 'ignorado') {
        updateData.resolved_at = Timestamp.now();
        updateData.motivo_fechamento = `Sincronizado do ClickUp (${novoStatusClickUp})`;
      }

      await alertaDoc.ref.update(updateData);
      console.log(`Alerta ${alertaDoc.id} atualizado: ${alertaAtual.status} -> ${novoStatusCSHub}`);
      atualizados++;
    }

    console.log(`Total de alertas atualizados: ${atualizados}`);
    console.log('='.repeat(60));

    res.status(200).json({
      success: true,
      message: `${atualizados} alerta(s) atualizado(s)`,
      taskId,
      novoStatus: novoStatusCSHub
    });

  } catch (error) {
    console.error('Erro no webhook ClickUp:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
