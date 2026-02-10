/**
 * Cloud Functions para CS Hub
 *
 * Webhook para sincronizacao bidirecional com ClickUp
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { beforeUserCreated } from 'firebase-functions/v2/identity';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import crypto from 'crypto';

// Inicializar Firebase Admin
initializeApp();
const db = getFirestore();

// ============================================
// HELPERS - RATE LIMITING & ROLE CHECKING
// ============================================

/**
 * Rate limiter distribuido usando Firestore.
 * Persiste entre cold starts e funciona com multiplas instancias.
 *
 * Usa collection `_rate_limits` com documentos por uid+endpoint.
 * Cada documento armazena timestamps dos requests na janela atual.
 */
async function checkRateLimit(uid, { maxRequests = 30, windowMs = 60000, endpoint = 'default' } = {}) {
  const now = Date.now();
  const docId = `${uid}_${endpoint}`;
  const ref = db.collection('_rate_limits').doc(docId);

  try {
    const result = await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);

      if (!doc.exists) {
        tx.set(ref, { count: 1, windowStart: now, updatedAt: Timestamp.now() });
        return { allowed: true };
      }

      const data = doc.data();

      // Janela expirou — resetar
      if (now - data.windowStart > windowMs) {
        tx.update(ref, { count: 1, windowStart: now, updatedAt: Timestamp.now() });
        return { allowed: true };
      }

      // Dentro da janela — verificar limite
      if (data.count >= maxRequests) {
        return { allowed: false };
      }

      tx.update(ref, { count: FieldValue.increment(1), updatedAt: Timestamp.now() });
      return { allowed: true };
    });

    if (!result.allowed) {
      throw new HttpsError(
        'resource-exhausted',
        'Muitas requisicoes. Tente novamente em alguns instantes.'
      );
    }
  } catch (error) {
    // Se o erro for de rate limit, relancar
    if (error instanceof HttpsError) throw error;
    // Se Firestore falhar, logar e permitir (fail-open para nao bloquear o sistema)
    console.error('Rate limit check falhou, permitindo request:', error.message);
  }
}

/**
 * Rate limiter simplificado para webhooks (sem uid).
 * Usa IP ou identificador fixo como chave.
 */
async function checkWebhookRateLimit(identifier, { maxRequests = 120, windowMs = 60000 } = {}) {
  await checkRateLimit(identifier, { maxRequests, windowMs, endpoint: 'webhook' });
}

/**
 * Verifica se o usuario tem um dos roles permitidos.
 * Usa custom claims (rapido) com fallback para Firestore (migracao).
 */
async function requireRole(request, allowedRoles) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Login necessario');
  }

  const claimRole = request.auth.token.role;
  if (claimRole && allowedRoles.includes(claimRole)) {
    return claimRole;
  }

  const uid = request.auth.uid;
  const userDoc = await db.collection('usuarios_sistema').doc(uid).get();
  if (!userDoc.exists) {
    throw new HttpsError('permission-denied', 'Usuario nao cadastrado no sistema');
  }

  const userData = userDoc.data();
  if (!userData.role || !allowedRoles.includes(userData.role)) {
    throw new HttpsError(
      'permission-denied',
      'Voce nao tem permissao para esta acao'
    );
  }

  return userData.role;
}

// ============================================
// BLOCKING FUNCTION - VALIDACAO DE DOMINIO
// ============================================

/**
 * Bloqueia criacao de usuarios com email fora do dominio @trakto.io.
 * Roda ANTES do usuario ser criado no Firebase Auth.
 */
export const validateDomain = beforeUserCreated({
  region: 'southamerica-east1'
}, (event) => {
  const email = event.data.email;

  if (!email || !email.toLowerCase().endsWith('@trakto.io')) {
    throw new HttpsError(
      'invalid-argument',
      'Apenas emails @trakto.io sao permitidos'
    );
  }

  console.log(`Usuario ${email} aprovado para criacao`);
});

// ============================================
// FIRESTORE TRIGGER - SINCRONIZAR CUSTOM CLAIMS
// ============================================

/**
 * Quando o documento do usuario em usuarios_sistema eh criado/atualizado,
 * sincroniza o role para Firebase Auth Custom Claims.
 */
export const syncUserRole = onDocumentWritten({
  document: 'usuarios_sistema/{userId}',
  region: 'southamerica-east1'
}, async (event) => {
  const userId = event.params.userId;

  if (!event.data.after.exists) {
    console.log(`Usuario ${userId} removido, limpando claims`);
    try {
      await getAuth().setCustomUserClaims(userId, {});
    } catch (err) {
      console.error(`Erro ao limpar claims de ${userId}:`, err.message);
    }
    return;
  }

  const afterData = event.data.after.data();
  const newRole = afterData.role || 'viewer';

  const beforeData = event.data.before.exists ? event.data.before.data() : null;
  if (beforeData && beforeData.role === newRole) {
    console.log(`Role de ${userId} nao mudou (${newRole}), pulando sync`);
    return;
  }

  console.log(`Sincronizando claims para ${userId}: role=${newRole}`);

  try {
    await getAuth().setCustomUserClaims(userId, {
      role: newRole,
      domain: 'trakto.io'
    });
    console.log(`Claims atualizadas para ${userId}: role=${newRole}`);
  } catch (err) {
    console.error(`Erro ao setar claims de ${userId}:`, err.message);
  }
});

// ============================================
// SET USER ROLE - FUNCAO ADMIN PARA SETAR ROLES
// ============================================

const VALID_ROLES = ['viewer', 'cs', 'gestor', 'admin', 'super_admin'];

/**
 * Funcao onCall para admins definirem roles de usuarios.
 * Util para migracao inicial e gerenciamento manual.
 */
export const setUserRole = onCall({
  region: 'southamerica-east1'
}, async (request) => {
  await requireRole(request, ['admin', 'super_admin']);
  await checkRateLimit(request.auth.uid, { maxRequests: 20, windowMs: 60000, endpoint: 'setUserRole' });

  const { userId, role } = request.data;

  if (!userId || typeof userId !== 'string') {
    throw new HttpsError('invalid-argument', 'userId eh obrigatorio');
  }

  if (!role || !VALID_ROLES.includes(role)) {
    throw new HttpsError(
      'invalid-argument',
      `Role invalido. Valores aceitos: ${VALID_ROLES.join(', ')}`
    );
  }

  const callerRole = request.auth.token.role;
  if (role === 'super_admin' && callerRole !== 'super_admin') {
    throw new HttpsError(
      'permission-denied',
      'Apenas super_admin pode promover a super_admin'
    );
  }

  try {
    await getAuth().setCustomUserClaims(userId, {
      role: role,
      domain: 'trakto.io'
    });

    await db.collection('usuarios_sistema').doc(userId).update({
      role: role,
      updated_at: Timestamp.now()
    });

    console.log(`Role de ${userId} atualizado para ${role} por ${request.auth.uid}`);

    return { success: true, userId, role };
  } catch (err) {
    console.error(`Erro ao setar role de ${userId}:`, err.message);
    throw new HttpsError('internal', 'Erro ao atualizar role do usuario');
  }
});

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

// Mapeamento para ações de Ongoing (diferentes status)
const CLICKUP_STATUS_MAP_ONGOING = {
  'pendente': 'pendente',
  'em andamento': 'pendente',
  'bloqueado': 'pendente',
  'resolvido': 'concluida',
  'ignorado': 'pulada'
};

/**
 * Normalizar nome do status para comparação
 */
function normalizeStatus(status) {
  if (!status) return '';
  return status.toLowerCase().trim();
}

/**
 * Verifica assinatura HMAC do webhook do ClickUp.
 * ClickUp assina os payloads com o webhook secret.
 */
function verifyClickUpSignature(req, secret) {
  const signature = req.headers['x-signature'];
  if (!signature || !secret) return false;

  const payload = JSON.stringify(req.body);
  const hash = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Comparacao em tempo constante para prevenir timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hash));
  } catch {
    return false;
  }
}

/**
 * Webhook para receber atualizações do ClickUp
 * POST /clickupWebhook
 *
 * Para configurar no ClickUp:
 * 1. Vá em Settings > Integrations > Webhooks
 * 2. Crie um novo webhook com a URL desta função
 * 3. Selecione o evento "Task Status Updated"
 * 4. Configure o secret e salve em: firebase functions:secrets:set CLICKUP_WEBHOOK_SECRET
 */
export const clickupWebhook = onRequest({
  region: 'southamerica-east1',
  cors: false,
  secrets: ['CLICKUP_WEBHOOK_SECRET']
}, async (req, res) => {
  // Aceitar apenas POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Metodo nao permitido' });
    return;
  }

  // Verificar assinatura HMAC do ClickUp (quando configurado)
  const webhookSecret = process.env.CLICKUP_WEBHOOK_SECRET;
  if (webhookSecret) {
    if (!verifyClickUpSignature(req, webhookSecret)) {
      console.warn('Webhook rejeitado: assinatura invalida');
      res.status(401).json({ error: 'Assinatura invalida' });
      return;
    }
  } else {
    console.warn('CLICKUP_WEBHOOK_SECRET nao configurado — verificacao de assinatura desativada');
  }

  // Rate limiting por IP
  const clientIp = req.headers['x-forwarded-for'] || req.ip || 'unknown';
  try {
    await checkWebhookRateLimit(clientIp, { maxRequests: 120, windowMs: 60000 });
  } catch (error) {
    res.status(429).json({ error: 'Muitas requisicoes' });
    return;
  }

  try {
    const payload = req.body;

    // Log do evento recebido para debug
    console.log(`[ClickUp Webhook] Evento recebido: ${payload.event || 'sem evento'}, task_id: ${payload.task_id || 'sem id'}`);

    // Verificar se é um evento de mudança de status
    if (payload.event !== 'taskStatusUpdated' && payload.event !== 'taskUpdated') {
      console.log(`[ClickUp Webhook] Evento ignorado: ${payload.event}`);
      res.status(200).json({ success: true, message: 'Evento ignorado' });
      return;
    }

    const taskId = payload.task_id;
    if (!taskId || typeof taskId !== 'string' || taskId.length > 100) {
      res.status(400).json({ error: 'Task ID invalido' });
      return;
    }

    // Extrair novo status do payload
    // ClickUp envia history_items com as mudanças
    let novoStatusClickUp = null;

    if (payload.history_items && Array.isArray(payload.history_items) && payload.history_items.length > 0) {
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

    if (!novoStatusClickUp || typeof novoStatusClickUp !== 'string') {
      res.status(200).json({ success: true, message: 'Status nao alterado' });
      return;
    }

    // Mapear para status do CS Hub
    const novoStatusCSHub = CLICKUP_STATUS_MAP[normalizeStatus(novoStatusClickUp)];

    if (!novoStatusCSHub) {
      console.log(`[ClickUp Webhook] Status nao mapeado: ${novoStatusClickUp}`);
      res.status(200).json({ success: true, message: 'Status nao mapeado' });
      return;
    }

    console.log(`[ClickUp Webhook] Buscando alerta com clickup_task_id: ${taskId}, novo status: ${novoStatusClickUp} -> ${novoStatusCSHub}`);

    // Buscar alerta pelo clickup_task_id
    const alertasSnap = await db.collection('alertas')
      .where('clickup_task_id', '==', taskId)
      .limit(5)
      .get();

    if (alertasSnap.empty) {
      console.log(`[ClickUp Webhook] Alerta nao encontrado para task_id: ${taskId}`);
      res.status(200).json({ success: true, message: 'Alerta nao encontrado' });
      return;
    }

    // Atualizar todos os alertas encontrados (normalmente será apenas 1)
    let atualizados = 0;
    for (const alertaDoc of alertasSnap.docs) {
      const alertaAtual = alertaDoc.data();

      // Só atualizar se o status for diferente
      if (alertaAtual.status === novoStatusCSHub) {
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
      atualizados++;
      console.log(`[ClickUp Webhook] Alerta ${alertaDoc.id} atualizado: ${alertaAtual.status} -> ${novoStatusCSHub}`);
    }

    console.log(`[ClickUp Webhook] Finalizado: ${atualizados} alerta(s) atualizado(s)`);
    res.status(200).json({
      success: true,
      message: `${atualizados} alerta(s) atualizado(s)`
    });

  } catch (error) {
    console.error('Erro no webhook ClickUp:', error.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ============================================
// CLASSIFY THREAD - PROXY PARA OPENAI
// ============================================

const CLASSIFY_PROMPT = `Analise a seguinte conversa entre uma equipe de Customer Success e um cliente.

CONVERSA:
{conversa}
{contexto}
Retorne APENAS um JSON válido (sem markdown, sem explicações) com:
{
  "categoria": "erro_bug" | "reclamacao" | "problema_tecnico" | "feedback" | "duvida_pergunta" | "solicitacao" | "outro",
  "sentimento": "positivo" | "neutro" | "negativo" | "urgente",
  "status": "resolvido" | "aguardando_cliente" | "aguardando_equipe",
  "resumo": "Resumo em 1-2 frases do que foi discutido"
}

Critérios para CATEGORIA (escolha a mais adequada):
- erro_bug = cliente reportou erro, bug ou falha no sistema
- reclamacao = cliente está reclamando ou insatisfeito com o serviço/produto
- problema_tecnico = dificuldade técnica ou de configuração (não é bug)
- feedback = sugestão, elogio ou crítica construtiva sobre o produto
- duvida_pergunta = pergunta sobre como usar uma funcionalidade
- solicitacao = pedido de feature, recurso ou ajuda específica
- outro = não se encaixa nas anteriores

Critérios para SENTIMENTO:
- positivo = cliente satisfeito, agradecendo ou elogiando
- neutro = conversa normal, sem emoção forte detectada
- negativo = cliente insatisfeito, frustrado ou reclamando
- urgente = problema crítico que impede o uso ou precisa atenção imediata

Critérios para STATUS (baseado na ÚLTIMA MENSAGEM da conversa):
- resolvido = cliente confirmou que o problema foi resolvido, agradeceu explicitamente ("obrigado", "valeu", "perfeito"), ou disse que funcionou
- aguardando_cliente = a ÚLTIMA MENSAGEM é da EQUIPE (respondeu dúvida, enviou material, disse "fico à disposição", aguarda retorno do cliente)
- aguardando_equipe = a ÚLTIMA MENSAGEM é do CLIENTE (fez pergunta, reportou problema, pediu algo que ainda não foi respondido)

IMPORTANTE: Se a equipe respondeu por último (mesmo que seja "fico à disposição"), o status é "aguardando_cliente".
Se o cliente respondeu "obrigado" ou similar, o status é "resolvido".`;

export const classifyThread = onCall({
  region: 'southamerica-east1',
  secrets: ['OPENAI_API_KEY']
}, async (request) => {
  await requireRole(request, ['cs', 'gestor', 'admin', 'super_admin']);
  await checkRateLimit(request.auth.uid, { maxRequests: 30, windowMs: 60000, endpoint: 'classifyThread' });

  const { conversa, contextoCliente } = request.data;

  if (!conversa || typeof conversa !== 'string') {
    throw new HttpsError('invalid-argument', 'Campo "conversa" é obrigatório');
  }

  if (conversa.length > 50000) {
    throw new HttpsError('invalid-argument', 'Campo "conversa" excede o limite de 50.000 caracteres');
  }

  if (contextoCliente && (typeof contextoCliente !== 'string' || contextoCliente.length > 5000)) {
    throw new HttpsError('invalid-argument', 'Campo "contextoCliente" invalido ou excede 5.000 caracteres');
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'OPENAI_API_KEY não configurada no servidor');
  }

  const contextoBlock = contextoCliente
    ? `\nCONTEXTO DO CLIENTE (observações do CS):\n${contextoCliente}\n\nConsidere estas observações ao avaliar sentimento e categoria.\n`
    : '';

  const prompt = CLASSIFY_PROMPT
    .replace('{conversa}', conversa)
    .replace('{contexto}', contextoBlock);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um assistente que classifica conversas de suporte. Responda APENAS com JSON válido.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status);
      throw new HttpsError('internal', 'Erro na API de classificação');
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.warn('Resposta da IA não é JSON válido:', jsonStr);
      return {
        categoria: 'outro',
        sentimento: 'neutro',
        status: 'aguardando_equipe',
        resumo: 'Não foi possível classificar esta conversa.'
      };
    }

    return {
      categoria: parsed.categoria || 'outro',
      sentimento: parsed.sentimento || 'neutro',
      status: parsed.status || 'aguardando_equipe',
      resumo: parsed.resumo || 'Sem resumo'
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('Erro na classificação:', error.message);
    throw new HttpsError('internal', 'Não foi possível classificar a conversa');
  }
});

// ============================================
// CLICKUP PROXY - PROXY PARA API DO CLICKUP
// ============================================

export const clickupProxy = onCall({
  region: 'southamerica-east1',
  secrets: ['CLICKUP_API_KEY']
}, async (request) => {
  await requireRole(request, ['cs', 'gestor', 'admin', 'super_admin']);
  await checkRateLimit(request.auth.uid, { maxRequests: 60, windowMs: 60000, endpoint: 'clickupProxy' });

  const { action, payload } = request.data;

  const VALID_ACTIONS = ['createTask', 'getTask', 'updateTaskStatus', 'getTeamMembers'];
  if (!action || typeof action !== 'string' || !VALID_ACTIONS.includes(action)) {
    throw new HttpsError('invalid-argument', 'Campo "action" invalido');
  }

  if (!payload || typeof payload !== 'object') {
    throw new HttpsError('invalid-argument', 'Campo "payload" é obrigatório');
  }

  const apiKey = process.env.CLICKUP_API_KEY;
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'CLICKUP_API_KEY não configurada no servidor');
  }

  // Validar que IDs no payload sao strings alfanumericas com tamanho razoavel
  const validateId = (id, fieldName) => {
    if (!id || typeof id !== 'string' || id.length > 100) {
      throw new HttpsError('invalid-argument', `${fieldName} invalido`);
    }
  };

  const CLICKUP_BASE = 'https://api.clickup.com/api/v2';
  const apiHeaders = {
    'Content-Type': 'application/json',
    'Authorization': apiKey
  };

  try {
    switch (action) {
      case 'createTask': {
        const { listId, body } = payload;
        if (!listId || !body) {
          throw new HttpsError('invalid-argument', 'listId e body são obrigatórios');
        }
        validateId(listId, 'listId');
        const res = await fetch(`${CLICKUP_BASE}/list/${listId}/task`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify(body)
        });
        if (!res.ok) {
          console.error('ClickUp createTask error:', res.status);
          throw new HttpsError('internal', 'Erro ao criar tarefa no ClickUp');
        }
        const tarefa = await res.json();
        return {
          id: tarefa.id,
          url: tarefa.url,
          nome: tarefa.name,
          status: tarefa.status?.status
        };
      }

      case 'getTask': {
        const { taskId } = payload;
        validateId(taskId, 'taskId');
        const res = await fetch(`${CLICKUP_BASE}/task/${taskId}`, { headers: apiHeaders });
        if (!res.ok) {
          throw new HttpsError('internal', 'Erro ao buscar tarefa no ClickUp');
        }
        return await res.json();
      }

      case 'updateTaskStatus': {
        const { taskId, status } = payload;
        validateId(taskId, 'taskId');
        if (!status || typeof status !== 'string' || status.length > 50) {
          throw new HttpsError('invalid-argument', 'status invalido');
        }
        const res = await fetch(`${CLICKUP_BASE}/task/${taskId}`, {
          method: 'PUT',
          headers: apiHeaders,
          body: JSON.stringify({ status: status.toLowerCase() })
        });
        if (!res.ok) {
          throw new HttpsError('internal', 'Erro ao atualizar tarefa no ClickUp');
        }
        return await res.json();
      }

      case 'getTeamMembers': {
        const { teamId } = payload;
        validateId(teamId, 'teamId');
        const res = await fetch(`${CLICKUP_BASE}/team/${teamId}`, { headers: apiHeaders });
        if (!res.ok) {
          console.error('ClickUp getTeamMembers error:', res.status);
          return [];
        }
        const data = await res.json();
        return (data.team?.members || []).map(m => ({
          id: m.user.id,
          nome: m.user.username || m.user.email,
          email: m.user.email,
          avatar: m.user.profilePicture
        }));
      }

      default:
        throw new HttpsError('invalid-argument', 'Acao desconhecida');
    }
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('Erro no clickupProxy:', error.message);
    throw new HttpsError('internal', 'Erro ao comunicar com ClickUp');
  }
});

// ============================================
// GENERATE SUMMARY - RESUMO EXECUTIVO VIA OPENAI
// ============================================

export const generateSummary = onCall({
  region: 'southamerica-east1',
  secrets: ['OPENAI_API_KEY']
}, async (request) => {
  await requireRole(request, ['cs', 'gestor', 'admin', 'super_admin']);
  await checkRateLimit(request.auth.uid, { maxRequests: 30, windowMs: 60000, endpoint: 'generateSummary' });

  const { prompt, systemMsg, lang } = request.data;

  if (!prompt || typeof prompt !== 'string') {
    throw new HttpsError('invalid-argument', 'Campo "prompt" é obrigatório');
  }

  if (prompt.length > 80000) {
    throw new HttpsError('invalid-argument', 'Campo "prompt" excede o limite de 80.000 caracteres');
  }

  if (systemMsg && (typeof systemMsg !== 'string' || systemMsg.length > 5000)) {
    throw new HttpsError('invalid-argument', 'Campo "systemMsg" invalido ou excede 5.000 caracteres');
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'OPENAI_API_KEY não configurada no servidor');
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemMsg || 'You are a Customer Success analyst. Reply ONLY with valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5
      })
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status);
      throw new HttpsError('internal', 'Erro na API de geração de resumo');
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();

    try {
      return JSON.parse(jsonStr);
    } catch {
      console.warn('Resposta da IA não é JSON válido:', jsonStr);
      return { resumo: content, atencao: [], recomendacoes: [] };
    }
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('Erro na geração de resumo:', error.message);
    throw new HttpsError('internal', 'Não foi possível gerar o resumo');
  }
});

// ============================================
// RECALCULAR SAUDE DIARIA - SCHEDULED (7h BRT)
// ============================================

const MESES_KEYS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const LEGACY_SEGMENT_MAP = {
  'GROW': 'CRESCIMENTO',
  'NURTURE': 'ESTAVEL',
  'WATCH': 'ALERTA',
  'RESCUE': 'RESGATE'
};

function normalizarSegmento(seg) {
  return LEGACY_SEGMENT_MAP[seg] || seg || 'ESTAVEL';
}

function calcularDiasSemUso(cliente, metricas) {
  const now = new Date();
  let ultima = null;

  if (metricas?.ultima_atividade) {
    ultima = metricas.ultima_atividade.toDate
      ? metricas.ultima_atividade.toDate()
      : new Date(metricas.ultima_atividade);
  }
  if (!ultima && cliente?.ultima_interacao) {
    ultima = cliente.ultima_interacao.toDate
      ? cliente.ultima_interacao.toDate()
      : new Date(cliente.ultima_interacao);
  }
  if (!ultima && cliente?.updated_at) {
    ultima = cliente.updated_at.toDate
      ? cliente.updated_at.toDate()
      : new Date(cliente.updated_at);
  }
  if (!ultima) return 999;
  return Math.max(0, Math.floor((now - ultima) / (1000 * 60 * 60 * 24)));
}

function calcularFrequenciaUso(metricas, totalUsers = 1, config = {}) {
  if (!metricas) return 'sem_uso';
  const { logins = 0, dias_ativos = 0 } = metricas;
  const loginsPerUser = logins / Math.max(totalUsers, 1);

  // Thresholds configuráveis (com defaults)
  const thCrescimento = config.dias_ativos_crescimento || 20;
  const thEstavel = config.dias_ativos_estavel || 8;
  const thAlerta = config.dias_ativos_alerta || 3;
  const thResgate = config.dias_ativos_resgate || 2;

  if (dias_ativos >= thCrescimento || loginsPerUser >= 15) return 'frequente';
  if (dias_ativos >= thEstavel || loginsPerUser >= 6) return 'regular';
  if (dias_ativos >= thAlerta || loginsPerUser >= 2) return 'irregular';
  if (dias_ativos > thResgate || logins > 0) return 'raro';
  return 'sem_uso';
}

// Verifica reclamações em aberto (não resolvidas)
function temReclamacoesEmAberto(threads) {
  if (!threads || threads.length === 0) return false;
  return threads.some(t => {
    const isNegative = t.sentimento === 'negativo' || t.sentimento === 'urgente';
    const isComplaint = t.categoria === 'reclamacao' || t.categoria === 'erro_bug';
    const isOpen = !t.resolvido && t.status !== 'resolvido' && t.status !== 'fechado' && t.status !== 'closed';
    return (isNegative || isComplaint) && isOpen;
  });
}

function contarReclamacoesEmAberto(threads) {
  if (!threads || threads.length === 0) return 0;
  return threads.filter(t => {
    const isNegative = t.sentimento === 'negativo' || t.sentimento === 'urgente';
    const isComplaint = t.categoria === 'reclamacao' || t.categoria === 'erro_bug';
    const isOpen = !t.resolvido && t.status !== 'resolvido' && t.status !== 'fechado' && t.status !== 'closed';
    return (isNegative || isComplaint) && isOpen;
  }).length;
}

// Mantém compatibilidade
function temReclamacoesRecentes(threads) {
  return temReclamacoesEmAberto(threads);
}

function temReclamacaoGrave(threads) {
  return temReclamacoesEmAberto(threads);
}

/**
 * Calcular score de engajamento
 * Score = (pecas x peso_pecas) + (IA x peso_ia) + (downloads x peso_downloads)
 * Os pesos sao configuraveis
 */
function calcularEngajamentoScore(metricas, config = {}) {
  if (!metricas) return 0;
  const pesoPecas = config.peso_pecas ?? 2;
  const pesoIA = config.peso_ia ?? 1.5;
  const pesoDownloads = config.peso_downloads ?? 1;
  const { pecas_criadas = 0, uso_ai_total = 0, downloads = 0 } = metricas;
  return (pecas_criadas * pesoPecas) + (uso_ai_total * pesoIA) + (downloads * pesoDownloads);
}

/**
 * Configuracao padrao para os thresholds de Saude CS
 *
 * HIERARQUIA DE PRIORIDADE:
 * 1. Reclamacoes em aberto (veto) -> ALERTA/RESGATE
 * 2. Dias ativos (base) -> Define nivel base
 * 3. Engajamento (elevacao) -> Pode subir para CRESCIMENTO
 */
const DEFAULT_SAUDE_CONFIG = {
  dias_ativos_crescimento: 20,
  dias_ativos_estavel: 8,
  dias_ativos_alerta: 3,
  dias_ativos_resgate: 0,
  engajamento_crescimento: 50,
  engajamento_estavel: 15,
  engajamento_alerta: 1,
  engajamento_resgate: 0,
  reclamacoes_crescimento: false,
  reclamacoes_estavel: false,
  reclamacoes_alerta: true,
  reclamacoes_resgate: true,
  // Thresholds adicionais
  reclamacoes_max_resgate: 3,
  bugs_max_alerta: 3,
  // Toggles de regras especiais
  aviso_previo_resgate: true,
  champion_saiu_alerta: true,
  tags_problema_alerta: true,
  zero_producao_alerta: true,
  // Pesos do score de engajamento
  peso_pecas: 2,
  peso_ia: 1.5,
  peso_downloads: 1,
  // Critérios de Saída do Resgate (V1)
  saida_resgate_dias_ativos: 5,      // Dias ativos mínimos para sair do RESGATE
  saida_resgate_engajamento: 15,     // Score engajamento mínimo
  saida_resgate_bugs_zero: true,     // Exige 0 bugs para sair
};

/**
 * Calcular segmento do cliente (Cloud Function)
 *
 * HIERARQUIA DE PRIORIDADE (NOVA REGRA V1):
 * 1. Bugs/Reclamacoes em aberto (OVERRIDE ABSOLUTO):
 *    - 2+ bugs → RESGATE (ignora tudo)
 *    - 1 bug → ALERTA (ignora tudo)
 *    - 0 bugs → segue para proximas regras
 * 2. Dias ativos (base) -> Define nivel base
 * 3. Engajamento (elevacao) -> Pode subir para CRESCIMENTO
 * 4. Critérios de Saída do Resgate (se cliente atual está em RESGATE)
 *
 * @param segmentoAtual - Segmento atual do cliente (usado para verificar saída do RESGATE)
 */
function calcularSegmentoCS(cliente, threads, metricas, totalUsers, config = {}, segmentoAtual = null) {
  const cfg = { ...DEFAULT_SAUDE_CONFIG, ...config };

  // Calcular fatores
  const diasAtivos = metricas?.dias_ativos || 0;
  const engajamentoScore = calcularEngajamentoScore(metricas, cfg);
  const qtdReclamacoes = contarReclamacoesEmAberto(threads);

  // Sazonalidade: mes de baixa divide thresholds por 2
  const calendario = cliente?.calendario_campanhas;
  const mesKey = MESES_KEYS[new Date().getMonth()];
  const sazonalidade = calendario?.[mesKey] || 'normal';
  const divisorSazonalidade = sazonalidade === 'baixa' ? 2 : 1;

  // Tipo de conta: google_gratuito divide thresholds por 2
  const tipoConta = cliente?.tipo_conta || 'pagante';
  const divisorConta = tipoConta === 'google_gratuito' ? 2 : 1;

  const divisor = divisorSazonalidade * divisorConta;

  // Thresholds ajustados
  const thDiasAtivosCrescimento = Math.ceil(cfg.dias_ativos_crescimento / divisor);
  const thDiasAtivosEstavel = Math.ceil(cfg.dias_ativos_estavel / divisor);
  const thDiasAtivosAlerta = Math.ceil(cfg.dias_ativos_alerta / divisor);
  const thEngajamentoCrescimento = Math.ceil(cfg.engajamento_crescimento / divisor);

  // ============================================
  // 1. PRIORIDADE MAXIMA: REGRA DE BUGS (OVERRIDE ABSOLUTO)
  // ============================================
  // Nova regra V1: Bugs sobrepõem TODAS as outras métricas
  // - 2+ bugs/reclamações → RESGATE (mesmo com 25 dias ativos e score 150)
  // - 1 bug/reclamação → ALERTA (mesmo com métricas excelentes)
  // - 0 bugs → classificar por métricas normalmente

  if (qtdReclamacoes >= 2) {
    return {
      segmento: 'RESGATE',
      motivo: `${qtdReclamacoes} bugs/reclamações em aberto (regra: 2+ = Resgate)`
    };
  }

  if (qtdReclamacoes === 1) {
    return {
      segmento: 'ALERTA',
      motivo: `1 bug/reclamação em aberto (regra: 1 = Alerta)`
    };
  }

  // ============================================
  // 2. SEM BUGS: VERIFICAR CONDICOES DE RESGATE POR METRICAS
  // ============================================

  // Zero dias ativos = RESGATE
  if (diasAtivos === 0) {
    return { segmento: 'RESGATE', motivo: 'Sem atividade no mes' };
  }

  // ============================================
  // 2.5. CRITÉRIOS DE SAÍDA DO RESGATE (V1)
  // ============================================
  // Se cliente está atualmente em RESGATE e teria sido promovido,
  // verificar se atende os critérios de saída configuráveis
  if (segmentoAtual === 'RESGATE') {
    const thSaidaDias = cfg.saida_resgate_dias_ativos || 5;
    const thSaidaEngajamento = cfg.saida_resgate_engajamento || 15;
    const exigeBugsZero = cfg.saida_resgate_bugs_zero !== false; // default true

    // Verificar critérios de saída
    const atendeDias = diasAtivos >= thSaidaDias;
    const atendeEngajamento = engajamentoScore >= thSaidaEngajamento;
    const atendeBugs = !exigeBugsZero || qtdReclamacoes === 0;

    // Se não atende TODOS os critérios, permanece em RESGATE
    if (!atendeDias || !atendeEngajamento || !atendeBugs) {
      const motivos = [];
      if (!atendeDias) motivos.push(`${diasAtivos}/${thSaidaDias} dias`);
      if (!atendeEngajamento) motivos.push(`score ${Math.round(engajamentoScore)}/${thSaidaEngajamento}`);
      if (!atendeBugs) motivos.push(`${qtdReclamacoes} bugs (precisa 0)`);

      return {
        segmento: 'RESGATE',
        motivo: `Não atingiu critérios de saída: ${motivos.join(', ')}`
      };
    }
    // Se atende todos os critérios, permite a promoção (continua o fluxo normal)
  }

  // ============================================
  // 3. VERIFICAR DIAS ATIVOS MINIMOS
  // ============================================

  // Poucos dias ativos
  if (diasAtivos < thDiasAtivosAlerta) {
    return { segmento: 'ALERTA', motivo: `Apenas ${diasAtivos} dias ativos (minimo: ${thDiasAtivosAlerta})` };
  }

  // ============================================
  // 4. CLASSIFICACAO POSITIVA: ESTAVEL ou CRESCIMENTO
  // (Só chega aqui se não tem bugs)
  // ============================================

  // Verificar se atende criterios de CRESCIMENTO
  if (diasAtivos >= thDiasAtivosCrescimento && engajamentoScore >= thEngajamentoCrescimento) {
    return { segmento: 'CRESCIMENTO', motivo: `${diasAtivos} dias ativos + engajamento ${Math.round(engajamentoScore)}` };
  }

  // Verificar se atende criterios de ESTAVEL
  if (diasAtivos >= thDiasAtivosEstavel) {
    return { segmento: 'ESTAVEL', motivo: `${diasAtivos} dias ativos no mes` };
  }

  // ============================================
  // 5. ALERTA (fallback quando não atinge CRESCIMENTO/ESTÁVEL)
  // ============================================

  // Fallback para ALERTA
  return { segmento: 'ALERTA', motivo: `${diasAtivos} dias ativos (abaixo do ideal: ${thDiasAtivosEstavel})` };
}

// Ordem de prioridade dos segmentos (1 = melhor, 4 = pior)
const SEGMENTO_PRIORIDADE = {
  'CRESCIMENTO': 1,
  'ESTAVEL': 2,
  'ALERTA': 3,
  'RESGATE': 4
};

// Dias de carência para quedas de nível (exceto para RESGATE)
const DIAS_CARENCIA = 7;

/**
 * Registra transições de nível na collection interacoes.
 * Cria um registro na timeline do cliente para cada mudança de saúde.
 *
 * NOVA REGRA V1 - Carência de 7 dias:
 * - Quando cliente CAI de nível (exceto para RESGATE), inicia carência de 7 dias
 * - Cria alerta imediato de comunicação
 * - Após 7 dias, se não recuperou, sistema cria alerta de playbook
 * - Se cliente SOBE de nível durante carência, cancela a carência
 */
async function registrarTransicoesNivel(transicoes) {
  if (!transicoes || transicoes.length === 0) return;

  const now = Timestamp.now();
  const nowDate = now.toDate();

  for (const t of transicoes) {
    try {
      const prioridadeAnterior = SEGMENTO_PRIORIDADE[t.segmentoAnterior] || 2;
      const prioridadeNova = SEGMENTO_PRIORIDADE[t.novoSegmento] || 2;
      const direcao = prioridadeNova > prioridadeAnterior ? 'descida' : 'subida';

      // Criar documento de interação tipo transicao_nivel
      await db.collection('interacoes').add({
        cliente_id: t.clienteId,
        tipo: 'transicao_nivel',
        data: now,
        created_at: now,
        created_by: 'Sistema',
        // Dados específicos da transição
        segmento_anterior: t.segmentoAnterior,
        segmento_novo: t.novoSegmento,
        direcao: direcao, // 'subida' ou 'descida'
        motivo: t.motivo,
        // Notas formatadas para exibição
        notas: `${direcao === 'descida' ? '🔻' : '🔺'} Transição de ${t.segmentoAnterior} para ${t.novoSegmento}. Motivo: ${t.motivo}`
      });

      console.log(`[Transição] ${t.clienteId}: ${t.segmentoAnterior} → ${t.novoSegmento} (${direcao})`);

      // ============================================
      // CARÊNCIA DE 7 DIAS (apenas para quedas, exceto para RESGATE)
      // ============================================
      const clienteRef = db.collection('clientes').doc(t.clienteId);
      const clienteDoc = await clienteRef.get();
      const clienteData = clienteDoc.exists ? clienteDoc.data() : {};
      const clienteNome = clienteData.team_name || clienteData.nome || t.clienteId;

      if (direcao === 'descida') {
        // Queda para RESGATE = ação imediata, SEM carência
        if (t.novoSegmento === 'RESGATE') {
          console.log(`[Carência] ${t.clienteId}: Queda para RESGATE - ação imediata (sem carência)`);

          // Cancelar carência existente se houver
          if (clienteData.carencia_nivel?.ativa) {
            await clienteRef.update({
              'carencia_nivel.ativa': false,
              'carencia_nivel.cancelada_em': now,
              'carencia_nivel.motivo_cancelamento': 'Queda para RESGATE - ação imediata necessária'
            });
          }
        } else {
          // Queda para ESTÁVEL ou ALERTA = iniciar carência de 7 dias
          const dataFim = new Date(nowDate);
          dataFim.setDate(dataFim.getDate() + DIAS_CARENCIA);

          // Criar alerta de comunicação imediata
          const alertaComunicacao = await db.collection('alertas').add({
            tipo: 'carencia_comunicacao',
            titulo: `⏳ ${clienteNome} caiu para ${t.novoSegmento} - Comunicar cliente`,
            mensagem: `Cliente caiu de ${t.segmentoAnterior} para ${t.novoSegmento}. Motivo: ${t.motivo}. Período de carência de ${DIAS_CARENCIA} dias iniciado. Comunique-se com o cliente para entender a situação.`,
            prioridade: 'alta',
            status: 'pendente',
            cliente_id: t.clienteId,
            cliente_nome: clienteNome,
            responsaveis: clienteData.responsaveis || [],
            responsavel_email: clienteData.responsaveis?.[0]?.email || clienteData.responsavel_email || null,
            responsavel_nome: clienteData.responsaveis?.map(r => r.nome).join(', ') || clienteData.responsavel_nome || null,
            created_at: now,
            updated_at: now,
            origem: 'automatico',
            carencia_relacionada: true
          });

          // Salvar carência no cliente
          await clienteRef.update({
            carencia_nivel: {
              ativa: true,
              data_inicio: now,
              data_fim: Timestamp.fromDate(dataFim),
              segmento_de: t.segmentoAnterior,
              segmento_para: t.novoSegmento,
              motivo: t.motivo,
              alerta_comunicacao_id: alertaComunicacao.id,
              alerta_playbook_id: null // Será preenchido após 7 dias se não recuperar
            }
          });

          console.log(`[Carência] ${t.clienteId}: Carência de ${DIAS_CARENCIA} dias iniciada (${t.segmentoAnterior} → ${t.novoSegmento})`);
        }
      } else if (direcao === 'subida') {
        // Cliente SUBIU de nível = cancelar carência se existir
        if (clienteData.carencia_nivel?.ativa) {
          // Cancelar alerta de comunicação se ainda pendente
          if (clienteData.carencia_nivel.alerta_comunicacao_id) {
            try {
              const alertaRef = db.collection('alertas').doc(clienteData.carencia_nivel.alerta_comunicacao_id);
              const alertaDoc = await alertaRef.get();
              if (alertaDoc.exists && alertaDoc.data().status === 'pendente') {
                await alertaRef.update({
                  status: 'resolvido',
                  resolved_at: now,
                  motivo_fechamento: 'Cliente recuperou nível durante carência'
                });
              }
            } catch (e) {
              console.error(`[Carência] Erro ao cancelar alerta de comunicação:`, e.message);
            }
          }

          // Cancelar alerta de playbook se existir e ainda pendente
          if (clienteData.carencia_nivel.alerta_playbook_id) {
            try {
              const alertaRef = db.collection('alertas').doc(clienteData.carencia_nivel.alerta_playbook_id);
              const alertaDoc = await alertaRef.get();
              if (alertaDoc.exists && alertaDoc.data().status === 'pendente') {
                await alertaRef.update({
                  status: 'resolvido',
                  resolved_at: now,
                  motivo_fechamento: 'Cliente recuperou nível durante carência'
                });
              }
            } catch (e) {
              console.error(`[Carência] Erro ao cancelar alerta de playbook:`, e.message);
            }
          }

          // Marcar carência como cancelada (recuperação)
          await clienteRef.update({
            'carencia_nivel.ativa': false,
            'carencia_nivel.cancelada_em': now,
            'carencia_nivel.motivo_cancelamento': `Cliente recuperou: ${t.segmentoAnterior} → ${t.novoSegmento}`
          });

          // Registrar na timeline
          await db.collection('interacoes').add({
            cliente_id: t.clienteId,
            tipo: 'carencia_cancelada',
            data: now,
            created_at: now,
            created_by: 'Sistema',
            notas: `✅ Carência cancelada - Cliente recuperou de ${clienteData.carencia_nivel.segmento_para} para ${t.novoSegmento}`
          });

          console.log(`[Carência] ${t.clienteId}: Carência CANCELADA - cliente recuperou para ${t.novoSegmento}`);
        }
      }
    } catch (error) {
      console.error(`[Transição] Erro ao registrar para ${t.clienteId}:`, error.message);
    }
  }
}

/**
 * Recalcula saude (segmento_cs) de todos os clientes ativos.
 * Roda diariamente as 7h horario de Brasilia.
 */
export const recalcularSaudeDiaria = onSchedule({
  schedule: '30 6 * * *', // 6:30, após export de métricas do n8n (4h-6h)
  timeZone: 'America/Sao_Paulo',
  region: 'southamerica-east1',
  timeoutSeconds: 540,
  memory: '512MiB'
}, async () => {
  // Buscar config de Saúde CS (config/geral.segmentoConfig)
  const configSnap = await db.collection('config').doc('geral').get();
  const saudeConfig = configSnap.exists ? (configSnap.data().segmentoConfig || {}) : {};

  const clientesSnap = await db.collection('clientes').get();
  const clientes = clientesSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(c => {
      const st = c.status === 'onboarding' ? 'ativo' : (c.status || 'ativo');
      return st !== 'inativo' && st !== 'cancelado' && !c.segmento_override;
    });

  if (clientes.length === 0) {
    console.log('Nenhum cliente ativo para recalcular');
    return;
  }

  const thirtyDaysAgo = Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  let updatedCount = 0;
  const BATCH_SIZE = 5;

  for (let i = 0; i < clientes.length; i += BATCH_SIZE) {
    const chunk = clientes.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(chunk.map(async (cliente) => {
      try {
        let teamIds = cliente.times || [];
        if (teamIds.length === 0 && cliente.team_id) teamIds = [cliente.team_id];
        if (teamIds.length === 0) teamIds = [cliente.id];

        // Buscar threads, metricas e usuarios em paralelo
        const threadPromises = [];
        const metricasPromises = [];
        const usuariosPromises = [];

        for (let j = 0; j < teamIds.length; j += 10) {
          const ids = teamIds.slice(j, j + 10);
          threadPromises.push(
            db.collection('threads').where('team_id', 'in', ids).get().catch(() => ({ docs: [] }))
          );
          metricasPromises.push(
            db.collection('metricas_diarias').where('team_id', 'in', ids).where('data', '>=', thirtyDaysAgo).get().catch(() => ({ docs: [] }))
          );
          usuariosPromises.push(
            db.collection('usuarios_lookup').where('team_id', 'in', ids).get().catch(() => ({ docs: [] }))
          );
        }

        const [threadSnaps, metricasSnaps, usuariosSnaps] = await Promise.all([
          Promise.all(threadPromises),
          Promise.all(metricasPromises),
          Promise.all(usuariosPromises)
        ]);

        const threads = threadSnaps.flatMap(s => s.docs.map(d => d.data()));
        const metricasRaw = metricasSnaps.flatMap(s => s.docs.map(d => d.data()));
        const totalUsers = Math.max(usuariosSnaps.reduce((acc, s) => acc + s.docs.length, 0), 1);

        // Agregar metricas dos ultimos 30 dias
        const metricas = metricasRaw.reduce((acc, d) => {
          const dataDate = d.data?.toDate?.() || (d.data ? new Date(d.data) : null);
          const temAtividade = (d.logins || 0) > 0 || (d.pecas_criadas || 0) > 0 || (d.downloads || 0) > 0 || (d.creditos_consumidos || d.uso_ai_total || 0) > 0;
          return {
            // ESCALA
            logins: acc.logins + (d.logins || 0),
            projetos_criados: acc.projetos_criados + (d.projetos_criados || 0),
            pecas_criadas: acc.pecas_criadas + (d.pecas_criadas || 0),
            downloads: acc.downloads + (d.downloads || 0),
            // AI
            creditos_consumidos: acc.creditos_consumidos + (d.creditos_consumidos || 0),
            uso_ai_total: acc.uso_ai_total + (d.uso_ai_total || d.creditos_consumidos || 0), // retrocompatibilidade
            // Geral
            dias_ativos: acc.dias_ativos + (temAtividade ? 1 : 0),
            ultima_atividade: dataDate && (!acc.ultima_atividade || dataDate > acc.ultima_atividade) ? dataDate : acc.ultima_atividade
          };
        }, { logins: 0, projetos_criados: 0, pecas_criadas: 0, downloads: 0, creditos_consumidos: 0, uso_ai_total: 0, dias_ativos: 0, ultima_atividade: null });

        const segmentoAtual = normalizarSegmento(cliente.segmento_cs);
        const resultado = calcularSegmentoCS(cliente, threads, metricas, totalUsers, saudeConfig, segmentoAtual);

        return {
          clienteId: cliente.id,
          novoSegmento: resultado.segmento,
          motivo: resultado.motivo,
          changed: resultado.segmento !== segmentoAtual,
          segmentoAnterior: segmentoAtual
        };
      } catch (err) {
        console.error(`Erro ao recalcular ${cliente.id}:`, err.message);
        return null;
      }
    }));

    // Batch write
    const batch = db.batch();
    let batchCount = 0;
    const transicoesParaRegistrar = [];

    for (const r of results) {
      if (!r) continue;
      const ref = db.collection('clientes').doc(r.clienteId);
      if (r.changed) {
        batch.update(ref, {
          segmento_cs: r.novoSegmento,
          segmento_motivo: r.motivo,
          segmento_recalculado_em: Timestamp.now(),
          segmento_anterior: r.segmentoAnterior
        });
        updatedCount++;

        // Preparar registro de transição para a timeline
        transicoesParaRegistrar.push({
          clienteId: r.clienteId,
          segmentoAnterior: r.segmentoAnterior,
          novoSegmento: r.novoSegmento,
          motivo: r.motivo
        });
      } else {
        batch.update(ref, { segmento_recalculado_em: Timestamp.now() });
      }
      batchCount++;
    }

    if (batchCount > 0) await batch.commit();

    // Registrar transições na collection interacoes (após commit)
    if (transicoesParaRegistrar.length > 0) {
      await registrarTransicoesNivel(transicoesParaRegistrar);
    }
  }

  console.log(`Saude recalculada: ${clientes.length} clientes processados, ${updatedCount} atualizados`);
});

// ============================================
// VERIFICAR CARÊNCIAS VENCIDAS - DIÁRIO (após recálculo)
// ============================================

/**
 * Verifica carências de 7 dias que venceram.
 * Se cliente ainda está no nível inferior, cria alerta de playbook.
 * Roda às 7h, após o recálculo de saúde (6:30).
 */
export const verificarCarenciasVencidas = onSchedule({
  schedule: '0 7 * * *', // 7h BRT, todos os dias
  timeZone: 'America/Sao_Paulo',
  region: 'southamerica-east1',
  timeoutSeconds: 300,
  memory: '256MiB'
}, async () => {
  console.log('[Carências] Verificando carências vencidas...');

  const now = Timestamp.now();
  const nowDate = now.toDate();

  // Buscar clientes com carência ativa
  const clientesSnap = await db.collection('clientes')
    .where('carencia_nivel.ativa', '==', true)
    .get();

  if (clientesSnap.empty) {
    console.log('[Carências] Nenhuma carência ativa encontrada');
    return;
  }

  console.log(`[Carências] Encontradas ${clientesSnap.size} carências ativas`);

  let carenciasVencidas = 0;
  let playbacksCriados = 0;

  for (const doc of clientesSnap.docs) {
    const cliente = { id: doc.id, ...doc.data() };
    const carencia = cliente.carencia_nivel;

    if (!carencia || !carencia.data_fim) continue;

    // Verificar se carência venceu
    const dataFim = carencia.data_fim.toDate ? carencia.data_fim.toDate() : new Date(carencia.data_fim);

    if (nowDate < dataFim) {
      // Carência ainda não venceu
      continue;
    }

    carenciasVencidas++;
    const clienteNome = cliente.team_name || cliente.nome || cliente.id;

    // Verificar se cliente ainda está no nível inferior (não recuperou)
    const segmentoAtual = cliente.segmento_cs;
    const prioridadeAtual = SEGMENTO_PRIORIDADE[segmentoAtual] || 2;
    const prioridadeCarencia = SEGMENTO_PRIORIDADE[carencia.segmento_para] || 3;

    // Se cliente está no mesmo nível ou pior = não recuperou
    if (prioridadeAtual >= prioridadeCarencia) {
      // Criar alerta de playbook (cliente não recuperou após 7 dias)
      const alertaPlaybook = await db.collection('alertas').add({
        tipo: 'carencia_playbook',
        titulo: `📋 ${clienteNome} não recuperou após ${DIAS_CARENCIA} dias - Iniciar playbook`,
        mensagem: `Cliente caiu de ${carencia.segmento_de} para ${carencia.segmento_para} há ${DIAS_CARENCIA} dias e não recuperou. Motivo original: ${carencia.motivo}. É necessário iniciar o playbook de ${carencia.segmento_para}.`,
        prioridade: carencia.segmento_para === 'ALERTA' ? 'alta' : 'media',
        status: 'pendente',
        cliente_id: cliente.id,
        cliente_nome: clienteNome,
        responsaveis: cliente.responsaveis || [],
        responsavel_email: cliente.responsaveis?.[0]?.email || cliente.responsavel_email || null,
        responsavel_nome: cliente.responsaveis?.map(r => r.nome).join(', ') || cliente.responsavel_nome || null,
        created_at: now,
        updated_at: now,
        origem: 'automatico',
        carencia_relacionada: true,
        segmento_sugerido: carencia.segmento_para
      });

      // Atualizar carência com ID do alerta de playbook e marcar como finalizada
      await doc.ref.update({
        'carencia_nivel.ativa': false,
        'carencia_nivel.alerta_playbook_id': alertaPlaybook.id,
        'carencia_nivel.finalizada_em': now,
        'carencia_nivel.resultado': 'nao_recuperou'
      });

      // Registrar na timeline
      await db.collection('interacoes').add({
        cliente_id: cliente.id,
        tipo: 'carencia_vencida',
        data: now,
        created_at: now,
        created_by: 'Sistema',
        notas: `⏰ Carência de ${DIAS_CARENCIA} dias vencida - Cliente não recuperou de ${carencia.segmento_para}. Playbook necessário.`
      });

      playbacksCriados++;
      console.log(`[Carências] ${cliente.id}: Carência vencida - alerta de playbook criado`);

    } else {
      // Cliente recuperou durante a carência (mas sistema não detectou a transição)
      // Isso pode acontecer se o cliente subiu antes do recálculo diário
      await doc.ref.update({
        'carencia_nivel.ativa': false,
        'carencia_nivel.finalizada_em': now,
        'carencia_nivel.resultado': 'recuperou_tardio'
      });

      // Cancelar alerta de comunicação se ainda pendente
      if (carencia.alerta_comunicacao_id) {
        try {
          const alertaRef = db.collection('alertas').doc(carencia.alerta_comunicacao_id);
          const alertaDoc = await alertaRef.get();
          if (alertaDoc.exists && alertaDoc.data().status === 'pendente') {
            await alertaRef.update({
              status: 'resolvido',
              resolved_at: now,
              motivo_fechamento: 'Cliente recuperou nível (verificação tardia)'
            });
          }
        } catch (e) {
          // Ignora erros
        }
      }

      console.log(`[Carências] ${cliente.id}: Cliente já havia recuperado (${segmentoAtual})`);
    }
  }

  console.log(`[Carências] Concluído: ${carenciasVencidas} carências vencidas processadas, ${playbacksCriados} alertas de playbook criados`);
});

// ============================================
// VERIFICAR ALERTAS AUTOMATICO - 3X/DIA EM HORÁRIO COMERCIAL
// ============================================

// Mapear prioridade CS Hub → ClickUp (1=urgente, 2=alta, 3=normal, 4=baixa)
const PRIORIDADE_CLICKUP_MAP = {
  'urgente': 1,
  'alta': 2,
  'media': 3,
  'baixa': 4
};

/**
 * Criar tarefa no ClickUp via API direta
 */
async function criarTarefaClickUpDireto(alerta, apiKey, listId) {
  if (!apiKey || !listId) return null;

  const clienteNome = alerta.cliente_nome || alerta.time_name || '';
  const nome = clienteNome
    ? `[CS Hub] ${clienteNome} - ${alerta.titulo}`
    : `[CS Hub] ${alerta.titulo}`;

  // Descrição formatada
  const descricao = [
    `**Tipo:** ${alerta.tipo}`,
    `**Prioridade:** ${alerta.prioridade}`,
    `**Cliente:** ${alerta.cliente_nome || 'N/A'}`,
    '',
    `**Detalhes:**`,
    alerta.mensagem,
    '',
    `---`,
    `Alerta gerado automaticamente pelo CS Hub`
  ].join('\n');

  // Data de vencimento: 3 dias úteis
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 3);

  const body = {
    name: nome,
    description: descricao,
    priority: PRIORIDADE_CLICKUP_MAP[alerta.prioridade] || 3,
    due_date: dueDate.getTime()
  };

  try {
    const response = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      console.error('[ClickUp] Erro ao criar tarefa:', response.status);
      return null;
    }

    const tarefa = await response.json();
    return {
      id: tarefa.id,
      url: tarefa.url
    };
  } catch (error) {
    console.error('[ClickUp] Erro:', error.message);
    return null;
  }
}

/**
 * Buscar detalhes de uma tarefa no ClickUp (status)
 */
async function buscarTarefaClickUp(taskId, apiKey) {
  if (!apiKey || !taskId) return null;

  try {
    const response = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
      headers: { 'Authorization': apiKey }
    });

    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('[ClickUp] Erro ao buscar tarefa:', error.message);
    return null;
  }
}

/**
 * Buscar comentários de uma tarefa no ClickUp
 */
async function buscarComentariosClickUp(taskId, apiKey) {
  if (!apiKey || !taskId) return [];

  try {
    const response = await fetch(`https://api.clickup.com/api/v2/task/${taskId}/comment`, {
      headers: { 'Authorization': apiKey }
    });

    if (!response.ok) return [];

    const data = await response.json();
    return (data.comments || []).map(c => ({
      id: c.id,
      texto: c.comment_text || '',
      autor: c.user?.username || c.user?.email || 'Desconhecido',
      data: c.date ? new Date(parseInt(c.date)).toISOString() : null
    }));
  } catch (error) {
    console.error('[ClickUp] Erro ao buscar comentários:', error.message);
    return [];
  }
}

/**
 * Gera alertas automaticamente 3x por dia:
 * - 9h, 13h, 17h (horário de Brasília)
 *
 * Tipos de alertas gerados:
 * - sentimento_negativo: conversas com sentimento negativo/urgente
 * - problema_reclamacao: threads categorizadas como problema
 * - entrou_resgate: cliente entrou no segmento RESGATE
 *
 * Também cria tarefas no ClickUp automaticamente.
 */
export const verificarAlertasAutomatico = onSchedule({
  schedule: '0 9,14 * * 1-5', // 9h e 14h de segunda a sexta (após classificação)
  timeZone: 'America/Sao_Paulo',
  region: 'southamerica-east1',
  timeoutSeconds: 540,
  memory: '512MiB',
  secrets: ['CLICKUP_API_KEY', 'CLICKUP_LIST_ID']
}, async () => {
  // Configurações ClickUp
  const clickupApiKey = process.env.CLICKUP_API_KEY;
  const clickupListId = process.env.CLICKUP_LIST_ID;
  const clickupEnabled = !!clickupApiKey && !!clickupListId;

  console.log(`[Alertas Auto] Iniciando verificacao automatica (ClickUp: ${clickupEnabled ? 'ativo' : 'desativado'})`);

  // Buscar clientes ativos
  const clientesSnap = await db.collection('clientes').get();
  const clientes = clientesSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(c => {
      const st = c.status === 'onboarding' ? 'ativo' : (c.status || 'ativo');
      return st !== 'inativo' && st !== 'cancelado';
    });

  if (clientes.length === 0) {
    console.log('[Alertas Auto] Nenhum cliente ativo');
    return;
  }

  // Buscar threads dos ultimos 7 dias
  const sevenDaysAgo = Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const threadsSnap = await db.collection('threads')
    .where('updated_at', '>=', sevenDaysAgo)
    .get();
  const threads = threadsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Buscar alertas existentes (pendentes ou em andamento)
  const alertasSnap = await db.collection('alertas')
    .where('status', 'in', ['pendente', 'em_andamento'])
    .get();
  const alertasExistentes = alertasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Criar mapa de clientes por ID
  const clientesMap = {};
  for (const cliente of clientes) {
    clientesMap[cliente.id] = cliente;
    if (cliente.team_id) clientesMap[cliente.team_id] = cliente;
    if (cliente.times) {
      for (const tid of cliente.times) {
        clientesMap[tid] = cliente;
      }
    }
  }

  const novosAlertas = [];

  // 1. ALERTAS DE SENTIMENTO NEGATIVO
  for (const thread of threads) {
    if (thread.sentimento !== 'negativo' && thread.sentimento !== 'urgente') continue;
    if (thread.filtrado_manual) continue;

    const clienteId = thread.cliente_id || thread.team_id;
    const cliente = clienteId ? clientesMap[clienteId] : null;
    if (!cliente) continue;
    if (cliente.status === 'inativo' || cliente.status === 'cancelado') continue;

    // Verificar se ja existe alerta
    const jaExiste = alertasExistentes.some(
      a => a.tipo === 'sentimento_negativo' && a.thread_id === thread.id
    );
    if (jaExiste) continue;

    const clienteNome = cliente.team_name || cliente.nome;
    const responsaveis = (cliente.responsaveis?.length > 0)
      ? cliente.responsaveis
      : (cliente.responsavel_email ? [{ email: cliente.responsavel_email, nome: cliente.responsavel_nome }] : []);

    novosAlertas.push({
      tipo: 'sentimento_negativo',
      titulo: `Conversa com sentimento ${thread.sentimento}`,
      mensagem: `A conversa "${thread.assunto || 'Sem assunto'}" foi classificada como ${thread.sentimento}.`,
      prioridade: thread.sentimento === 'urgente' ? 'urgente' : 'alta',
      status: 'pendente',
      time_id: thread.team_id || null,
      time_name: clienteNome,
      cliente_id: cliente.id,
      cliente_nome: clienteNome,
      thread_id: thread.id,
      responsaveis: responsaveis,
      responsavel_email: responsaveis[0]?.email || null,
      responsavel_nome: responsaveis.map(r => r.nome).join(', ') || null,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
      origem: 'automatico'
    });
  }

  // 2. ALERTAS DE PROBLEMA/RECLAMACAO
  const CATEGORIAS_PROBLEMA = ['erro_bug', 'reclamacao', 'problema', 'bug', 'erro'];
  for (const thread of threads) {
    const categoria = (thread.categoria || '').toLowerCase();
    const isProblem = CATEGORIAS_PROBLEMA.some(cat => categoria.includes(cat));
    if (!isProblem) continue;
    if (thread.filtrado_manual) continue;

    const clienteId = thread.cliente_id || thread.team_id;
    const cliente = clienteId ? clientesMap[clienteId] : null;
    if (!cliente) continue;
    if (cliente.status === 'inativo' || cliente.status === 'cancelado') continue;

    const jaExiste = alertasExistentes.some(
      a => a.tipo === 'problema_reclamacao' && a.thread_id === thread.id
    );
    if (jaExiste) continue;

    const clienteNome = cliente.team_name || cliente.nome;
    const responsaveis = (cliente.responsaveis?.length > 0)
      ? cliente.responsaveis
      : (cliente.responsavel_email ? [{ email: cliente.responsavel_email, nome: cliente.responsavel_nome }] : []);

    novosAlertas.push({
      tipo: 'problema_reclamacao',
      titulo: `Problema reportado: ${thread.assunto || 'Sem assunto'}`,
      mensagem: `Cliente reportou um problema/reclamação que precisa de atenção.`,
      prioridade: 'alta',
      status: 'pendente',
      time_id: thread.team_id || null,
      time_name: clienteNome,
      cliente_id: cliente.id,
      cliente_nome: clienteNome,
      thread_id: thread.id,
      responsaveis: responsaveis,
      responsavel_email: responsaveis[0]?.email || null,
      responsavel_nome: responsaveis.map(r => r.nome).join(', ') || null,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
      origem: 'automatico'
    });
  }

  // 3. ALERTAS DE ENTROU EM RESGATE
  for (const cliente of clientes) {
    if (cliente.segmento_cs !== 'RESGATE') continue;

    const jaExiste = alertasExistentes.some(
      a => a.tipo === 'entrou_resgate' && a.cliente_id === cliente.id
    );
    if (jaExiste) continue;

    const clienteNome = cliente.team_name || cliente.nome;
    const responsaveis = (cliente.responsaveis?.length > 0)
      ? cliente.responsaveis
      : (cliente.responsavel_email ? [{ email: cliente.responsavel_email, nome: cliente.responsavel_nome }] : []);

    const motivo = cliente.segmento_motivo || 'Critérios de risco atingidos';

    novosAlertas.push({
      tipo: 'entrou_resgate',
      titulo: `🚨 ${clienteNome} entrou em RESGATE`,
      mensagem: `Cliente entrou no segmento crítico RESGATE. Motivo: ${motivo}. Ação urgente necessária.`,
      prioridade: 'urgente',
      status: 'pendente',
      time_id: cliente.team_id || cliente.times?.[0] || null,
      time_name: clienteNome,
      cliente_id: cliente.id,
      cliente_nome: clienteNome,
      thread_id: null,
      responsaveis: responsaveis,
      responsavel_email: responsaveis[0]?.email || null,
      responsavel_nome: responsaveis.map(r => r.nome).join(', ') || null,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
      origem: 'automatico'
    });
  }

  // Salvar novos alertas e criar tarefas no ClickUp
  let alertasCriados = 0;
  let tarefasClickUpCriadas = 0;

  if (novosAlertas.length > 0) {
    // Processar em chunks para não sobrecarregar
    const CHUNK_SIZE = 10;

    for (let i = 0; i < novosAlertas.length; i += CHUNK_SIZE) {
      const chunk = novosAlertas.slice(i, i + CHUNK_SIZE);

      // Criar alertas e tarefas ClickUp em paralelo (por chunk)
      const resultados = await Promise.all(chunk.map(async (alerta) => {
        try {
          // Salvar alerta no Firestore
          const alertaRef = await db.collection('alertas').add(alerta);
          alertasCriados++;

          // Criar tarefa no ClickUp se configurado
          if (clickupEnabled) {
            const tarefaClickUp = await criarTarefaClickUpDireto(alerta, clickupApiKey, clickupListId);

            if (tarefaClickUp) {
              // Atualizar alerta com dados do ClickUp
              await alertaRef.update({
                clickup_task_id: tarefaClickUp.id,
                clickup_task_url: tarefaClickUp.url,
                status: 'em_andamento' // Já colocar em andamento pois tem tarefa
              });
              tarefasClickUpCriadas++;
            }
          }

          return { success: true };
        } catch (error) {
          console.error('[Alertas Auto] Erro ao processar alerta:', error.message);
          return { success: false };
        }
      }));
    }
  }

  // ============================================
  // SYNC: Atualizar alertas existentes com dados do ClickUp
  // ============================================
  let alertasSincronizados = 0;

  if (clickupEnabled) {
    // Buscar alertas com tarefa ClickUp que ainda estão abertos
    const alertasComClickUp = alertasExistentes.filter(
      a => a.clickup_task_id && (a.status === 'pendente' || a.status === 'em_andamento' || a.status === 'bloqueado')
    );

    console.log(`[Alertas Auto] Sincronizando ${alertasComClickUp.length} alertas com ClickUp`);

    // Processar em chunks
    const SYNC_CHUNK_SIZE = 5;
    for (let i = 0; i < alertasComClickUp.length; i += SYNC_CHUNK_SIZE) {
      const chunk = alertasComClickUp.slice(i, i + SYNC_CHUNK_SIZE);

      await Promise.all(chunk.map(async (alerta) => {
        try {
          // Buscar tarefa e comentários do ClickUp em paralelo
          const [tarefa, comentarios] = await Promise.all([
            buscarTarefaClickUp(alerta.clickup_task_id, clickupApiKey),
            buscarComentariosClickUp(alerta.clickup_task_id, clickupApiKey)
          ]);

          if (!tarefa) return;

          const updateData = {
            clickup_sync_at: Timestamp.now()
          };

          // Atualizar status se mudou
          const statusClickUp = tarefa.status?.status?.toLowerCase();
          const novoStatus = CLICKUP_STATUS_MAP[statusClickUp];

          if (novoStatus && novoStatus !== alerta.status) {
            updateData.status = novoStatus;
            updateData.updated_at = Timestamp.now();

            if (novoStatus === 'resolvido' || novoStatus === 'ignorado') {
              updateData.resolved_at = Timestamp.now();
              updateData.motivo_fechamento = `Sincronizado do ClickUp (${statusClickUp})`;
            }
          }

          // Atualizar comentários se houver novos
          if (comentarios.length > 0) {
            const comentariosAtuais = alerta.clickup_comentarios || [];
            const idsAtuais = new Set(comentariosAtuais.map(c => c.id));
            const novosComentarios = comentarios.filter(c => !idsAtuais.has(c.id));

            if (novosComentarios.length > 0) {
              updateData.clickup_comentarios = [...comentariosAtuais, ...novosComentarios];
              updateData.updated_at = Timestamp.now();
            }
          }

          // Só atualizar se houver mudanças além do sync_at
          if (Object.keys(updateData).length > 1) {
            await db.collection('alertas').doc(alerta.id).update(updateData);
            alertasSincronizados++;
          }
        } catch (error) {
          console.error(`[Alertas Auto] Erro ao sincronizar alerta ${alerta.id}:`, error.message);
        }
      }));
    }
  }

  // ============================================
  // SYNC: Atualizar ações de Ongoing com dados do ClickUp
  // ============================================
  let ongoingAcoesAtualizadas = 0;

  if (clickupEnabled) {
    console.log('[Alertas Auto] Sincronizando Ongoing com ClickUp...');

    // Buscar todos os clientes
    for (const cliente of clientes) {
      try {
        // Buscar ciclos ativos do cliente
        const ciclosSnap = await db.collection('clientes').doc(cliente.id)
          .collection('ongoing_ciclos')
          .where('status', '==', 'em_andamento')
          .get();

        for (const cicloDoc of ciclosSnap.docs) {
          const ciclo = cicloDoc.data();
          if (!ciclo.clickup_enabled) continue;

          const acoes = [...(ciclo.acoes || [])];
          let cicloAtualizado = false;

          for (let i = 0; i < acoes.length; i++) {
            const acao = acoes[i];
            if (!acao.clickup_task_id || acao.status !== 'pendente') continue;

            try {
              const tarefaClickUp = await buscarTarefaClickUp(acao.clickup_task_id, clickupApiKey);
              if (!tarefaClickUp) continue;

              const statusClickUp = tarefaClickUp.status?.status?.toLowerCase() || '';
              const novoStatus = CLICKUP_STATUS_MAP_ONGOING[statusClickUp];

              if (novoStatus && novoStatus !== acao.status) {
                acoes[i] = {
                  ...acao,
                  status: novoStatus,
                  concluida_em: novoStatus === 'concluida' ? Timestamp.now() : null,
                  concluida_por: novoStatus === 'concluida' ? 'Sincronizado do ClickUp' : null,
                };
                cicloAtualizado = true;
                ongoingAcoesAtualizadas++;
              }
            } catch (e) {
              // Ignora erros individuais
            }
          }

          if (cicloAtualizado) {
            const total = acoes.length;
            const concluidas = acoes.filter(a => a.status === 'concluida' || a.status === 'pulada').length;
            const progresso = total > 0 ? Math.round((concluidas / total) * 100) : 0;
            const todasFeitas = acoes.every(a => a.status === 'concluida' || a.status === 'pulada');

            await cicloDoc.ref.update({
              acoes,
              progresso,
              status: todasFeitas ? 'concluido' : ciclo.status,
              updated_at: Timestamp.now(),
            });
          }
        }
      } catch (e) {
        // Ignora erros por cliente
      }
    }
    console.log(`[Alertas Auto] Ongoing: ${ongoingAcoesAtualizadas} ações atualizadas`);
  }

  // Salvar status da última execução em config/sync_status
  await db.collection('config').doc('sync_status').set({
    ultima_verificacao_alertas: Timestamp.now(),
    ultima_sync_clickup: clickupEnabled ? Timestamp.now() : null,
    alertas_criados: alertasCriados,
    tarefas_clickup_criadas: tarefasClickUpCriadas,
    alertas_sincronizados: alertasSincronizados,
    ongoing_acoes_atualizadas: ongoingAcoesAtualizadas,
    clickup_ativo: clickupEnabled
  }, { merge: true });

  console.log(`[Alertas Auto] Concluido: ${alertasCriados} alertas, ${tarefasClickUpCriadas} tarefas ClickUp, ${alertasSincronizados} alertas sync, ${ongoingAcoesAtualizadas} ongoing sync`);
});

// ============================================
// CLASSIFY PENDING THREADS - CLASSIFICAÇÃO AUTOMÁTICA
// ============================================

/**
 * Classifica threads automaticamente.
 * Roda a cada 30 minutos das 7h às 19h (horário comercial).
 *
 * Busca threads onde:
 * - classificado_por é null/undefined (ainda não classificado)
 * - OU classificado_por é 'pendente' (importado sem classificação)
 * - OU classificado_por é 'ia' (classificado pelo n8n, precisa padronizar)
 *
 * Usa GPT-4o-mini para classificar e atualiza o documento.
 */
export const classifyPendingThreads = onSchedule({
  schedule: '30 7,13 * * 1-5', // 7:30 e 13:30, seg-sex (após import n8n)
  timeZone: 'America/Sao_Paulo',
  region: 'southamerica-east1',
  timeoutSeconds: 540,
  memory: '512MiB',
  secrets: ['OPENAI_API_KEY']
}, async () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('[ClassifyThreads] OPENAI_API_KEY não configurada');
    return;
  }

  console.log('[ClassifyThreads] Iniciando classificação de threads...');

  // Buscar threads para classificar (últimos 30 dias)
  const thirtyDaysAgo = Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

  // Buscar TODAS as threads recentes e filtrar no código
  // Isso é mais simples que múltiplas queries com índices diferentes
  const threadsSnap = await db.collection('threads')
    .where('updated_at', '>=', thirtyDaysAgo)
    .orderBy('updated_at', 'desc')
    .limit(200)
    .get();

  // Filtrar threads que precisam de classificação
  const threadMap = new Map();

  for (const doc of threadsSnap.docs) {
    const data = doc.data();

    // Pular threads já classificadas pela Cloud Function
    if (data.classificado_por === 'ia_automatico') {
      continue;
    }

    // Incluir threads que precisam classificação:
    // - classificado_por é null, undefined, 'pendente', ou 'ia' (n8n antigo)
    const classificadoPor = data.classificado_por;
    const precisaClassificar = !classificadoPor ||
                               classificadoPor === 'pendente' ||
                               classificadoPor === 'ia';

    if (precisaClassificar) {
      threadMap.set(doc.id, { id: doc.id, ref: doc.ref, ...data });
    }
  }

  const threads = Array.from(threadMap.values());

  if (threads.length === 0) {
    console.log('[ClassifyThreads] Nenhuma thread pendente para classificar');
    return;
  }

  console.log(`[ClassifyThreads] Encontradas ${threads.length} threads para classificar`);

  // Processar em batches de 5 (para não sobrecarregar a API)
  const BATCH_SIZE = 5;
  let classificadas = 0;
  let erros = 0;

  for (let i = 0; i < threads.length; i += BATCH_SIZE) {
    const batch = threads.slice(i, i + BATCH_SIZE);

    const resultados = await Promise.all(batch.map(async (thread) => {
      try {
        // Montar conversa para classificação
        // Usar conversa_para_resumo se existir, senão montar do assunto + snippet + body
        let conversa = thread.conversa_para_resumo;

        if (!conversa) {
          const partes = [];
          if (thread.assunto) partes.push(`Assunto: ${thread.assunto}`);
          if (thread.snippet) partes.push(`Resumo: ${thread.snippet}`);
          // Buscar body das mensagens se disponível
          if (thread.body) partes.push(`Conteúdo: ${thread.body.substring(0, 3000)}`);
          conversa = partes.join('\n\n');
        }

        if (!conversa || conversa.length < 20) {
          // Thread sem conteúdo suficiente
          return { threadId: thread.id, skipped: true, reason: 'conteudo_insuficiente' };
        }

        // Limitar tamanho
        if (conversa.length > 15000) {
          conversa = conversa.substring(0, 15000) + '...';
        }

        // Chamar GPT
        const prompt = CLASSIFY_PROMPT
          .replace('{conversa}', conversa)
          .replace('{contexto}', '');

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'Você é um assistente que classifica conversas de suporte. Responda APENAS com JSON válido.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.3
          })
        });

        if (!response.ok) {
          console.error(`[ClassifyThreads] OpenAI error ${response.status} para thread ${thread.id}`);
          return { threadId: thread.id, error: true };
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();

        let classificacao;
        try {
          classificacao = JSON.parse(jsonStr);
        } catch {
          console.warn(`[ClassifyThreads] JSON inválido para thread ${thread.id}`);
          classificacao = { categoria: 'outro', sentimento: 'neutro', status: 'aguardando_equipe', resumo: 'Não foi possível classificar' };
        }

        // Atualizar thread no Firestore (incluindo status da IA)
        await thread.ref.update({
          categoria: classificacao.categoria || 'outro',
          sentimento: classificacao.sentimento || 'neutro',
          status: classificacao.status || 'aguardando_equipe',
          resumo_ia: classificacao.resumo || null,
          classificado_por: 'ia_automatico',
          classificado_em: Timestamp.now(),
          updated_at: Timestamp.now()
        });

        return { threadId: thread.id, success: true, categoria: classificacao.categoria, status: classificacao.status };

      } catch (error) {
        console.error(`[ClassifyThreads] Erro na thread ${thread.id}:`, error.message);
        return { threadId: thread.id, error: true };
      }
    }));

    // Contar resultados
    for (const r of resultados) {
      if (r.success) classificadas++;
      else if (r.error) erros++;
    }

    // Pequena pausa entre batches para não sobrecarregar
    if (i + BATCH_SIZE < threads.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Salvar status da execução
  await db.collection('config').doc('sync_status').set({
    ultima_classificacao_threads: Timestamp.now(),
    threads_classificadas: classificadas,
    threads_erros: erros
  }, { merge: true });

  console.log(`[ClassifyThreads] Concluído: ${classificadas} classificadas, ${erros} erros`);
});

// ============================================
// SUMMARIZE TRANSCRIPTION - RESUMO DE TRANSCRIÇÃO
// ============================================

/**
 * Prompt para resumo estruturado da transcrição
 */
const TRANSCRIPTION_SUMMARY_PROMPT = `Analise a seguinte transcrição de uma reunião de Customer Success.

TRANSCRIÇÃO:
{transcricao}

Retorne APENAS um JSON válido (sem markdown, sem explicações) com:
{
  "resumo": "Resumo em 3-5 frases do que foi discutido",
  "pontos_chave": ["Ponto 1", "Ponto 2", "Ponto 3"],
  "acoes_combinadas": ["Ação 1", "Ação 2"],
  "sentimento_geral": "positivo" | "neutro" | "negativo"
}

Critérios para SENTIMENTO_GERAL:
- positivo = reunião produtiva, cliente satisfeito, boas perspectivas
- neutro = reunião padrão, sem indicadores fortes de satisfação ou insatisfação
- negativo = cliente insatisfeito, problemas reportados, tensão na conversa`;

/**
 * Gera resumo estruturado de uma transcrição de reunião.
 * Recebe texto da transcrição, gera resumo com GPT e atualiza a interação no Firestore.
 */
export const summarizeTranscription = onCall({
  region: 'southamerica-east1',
  secrets: ['OPENAI_API_KEY'],
  timeoutSeconds: 120
}, async (request) => {
  await requireRole(request, ['cs', 'gestor', 'admin', 'super_admin']);
  await checkRateLimit(request.auth.uid, { maxRequests: 30, windowMs: 3600000, endpoint: 'summarizeTranscription' });

  const { transcricaoTexto, linkTranscricao, interacaoId, clienteId } = request.data;

  // Validações de entrada
  if (!transcricaoTexto || typeof transcricaoTexto !== 'string') {
    throw new HttpsError('invalid-argument', 'Campo "transcricaoTexto" é obrigatório');
  }

  if (transcricaoTexto.length < 50) {
    throw new HttpsError('invalid-argument', 'Transcrição muito curta (mínimo 50 caracteres)');
  }

  if (transcricaoTexto.length > 100000) {
    throw new HttpsError('invalid-argument', 'Transcrição muito longa (máximo 100.000 caracteres)');
  }

  if (!interacaoId || typeof interacaoId !== 'string') {
    throw new HttpsError('invalid-argument', 'Campo "interacaoId" é obrigatório');
  }

  if (!clienteId || typeof clienteId !== 'string') {
    throw new HttpsError('invalid-argument', 'Campo "clienteId" é obrigatório');
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'OPENAI_API_KEY não configurada no servidor');
  }

  // Atualizar status para "processing"
  const interacaoRef = db.collection('interacoes').doc(interacaoId);
  await interacaoRef.update({
    transcricao_status: 'processing',
    updated_at: Timestamp.now()
  });

  try {
    // Chamar GPT para resumo estruturado
    const summaryPrompt = TRANSCRIPTION_SUMMARY_PROMPT.replace('{transcricao}', transcricaoTexto);

    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um assistente que analisa transcrições de reuniões de Customer Success. Responda APENAS com JSON válido.' },
          { role: 'user', content: summaryPrompt }
        ],
        temperature: 0.3
      })
    });

    if (!gptResponse.ok) {
      console.error('GPT API error:', gptResponse.status);
      throw new Error('Erro ao gerar resumo');
    }

    const gptData = await gptResponse.json();
    const content = gptData.choices[0].message.content;
    const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();

    let resumoIA;
    try {
      resumoIA = JSON.parse(jsonStr);
    } catch {
      console.warn('Resposta do GPT não é JSON válido:', jsonStr);
      resumoIA = {
        resumo: 'Não foi possível gerar resumo estruturado.',
        pontos_chave: [],
        acoes_combinadas: [],
        sentimento_geral: 'neutro'
      };
    }

    // Atualizar interação com resumo
    await interacaoRef.update({
      transcricao: transcricaoTexto,
      link_transcricao: linkTranscricao || null,
      resumo_ia: JSON.stringify(resumoIA),
      transcricao_status: 'completed',
      updated_at: Timestamp.now()
    });

    console.log(`[SummarizeTranscription] Sucesso: interacao=${interacaoId}, chars=${transcricaoTexto.length}`);

    return {
      success: true,
      resumo_ia: resumoIA
    };

  } catch (error) {
    console.error('[SummarizeTranscription] Erro:', error.message);

    // Atualizar status para erro
    await interacaoRef.update({
      transcricao_status: 'error',
      transcricao_erro: error.message || 'Erro desconhecido',
      updated_at: Timestamp.now()
    });

    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Erro ao gerar resumo. Tente novamente.');
  }
});

// ============================================
// BACKUP AUTOMÁTICO DO FIRESTORE
// ============================================

/**
 * Backup diário das collections críticas para Cloud Storage
 * Roda às 3h da manhã (horário de Brasília), todos os dias
 *
 * Collections exportadas:
 * - clientes (dados principais)
 * - threads (conversas)
 * - alertas (alertas do sistema)
 * - audit_logs (logs de auditoria)
 * - config (configurações)
 * - usuarios_sistema (usuários)
 *
 * Retenção: 30 dias (backups antigos são deletados automaticamente)
 */
export const backupFirestore = onSchedule(
  {
    schedule: '0 3 * * *', // 3h da manhã, todos os dias
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
    timeoutSeconds: 540, // 9 minutos
    memory: '1GiB'
  },
  async () => {
    console.log('[Backup] Iniciando backup diário do Firestore...');

    const bucket = getStorage().bucket();
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const backupFolder = `backups/${timestamp}`;

    // Collections para backup (críticas)
    const collections = [
      'clientes',
      'threads',
      'alertas',
      'audit_logs',
      'config',
      'usuarios_sistema',
      'metricas_diarias'
    ];

    const results = {
      success: [],
      failed: [],
      totalDocs: 0
    };

    for (const collectionName of collections) {
      try {
        console.log(`[Backup] Exportando ${collectionName}...`);

        const snapshot = await db.collection(collectionName).get();
        const docs = [];

        snapshot.forEach(doc => {
          docs.push({
            id: doc.id,
            data: doc.data()
          });
        });

        // Salvar como JSON no Cloud Storage
        const fileName = `${backupFolder}/${collectionName}.json`;
        const file = bucket.file(fileName);

        await file.save(JSON.stringify(docs, null, 2), {
          contentType: 'application/json',
          metadata: {
            backupDate: timestamp,
            collection: collectionName,
            documentCount: docs.length.toString()
          }
        });

        results.success.push(collectionName);
        results.totalDocs += docs.length;
        console.log(`[Backup] ${collectionName}: ${docs.length} documentos exportados`);

      } catch (error) {
        console.error(`[Backup] Erro ao exportar ${collectionName}:`, error.message);
        results.failed.push({ collection: collectionName, error: error.message });
      }
    }

    // Limpar backups antigos (mais de 30 dias)
    try {
      console.log('[Backup] Limpando backups antigos...');

      const [files] = await bucket.getFiles({ prefix: 'backups/' });
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);

      let deletedCount = 0;
      for (const file of files) {
        const fileDate = file.name.split('/')[1]; // backups/YYYY-MM-DD/...
        if (fileDate && new Date(fileDate) < cutoffDate) {
          await file.delete();
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        console.log(`[Backup] ${deletedCount} arquivos antigos removidos`);
      }
    } catch (error) {
      console.error('[Backup] Erro ao limpar backups antigos:', error.message);
    }

    // Registrar backup na auditoria
    try {
      await db.collection('audit_logs').add({
        acao: 'backup_firestore',
        entidade_tipo: 'system',
        entidade_id: 'backup',
        usuario_email: 'sistema@cshub.local',
        usuario_nome: 'Sistema',
        dados_novos: {
          date: timestamp,
          collections_success: results.success,
          collections_failed: results.failed.map(f => f.collection),
          total_documents: results.totalDocs
        },
        created_at: Timestamp.now()
      });
    } catch (error) {
      console.error('[Backup] Erro ao registrar na auditoria:', error.message);
    }

    console.log(`[Backup] Concluído! ${results.success.length} collections, ${results.totalDocs} documentos`);

    if (results.failed.length > 0) {
      console.error('[Backup] Falhas:', results.failed);
    }

    return {
      success: results.failed.length === 0,
      date: timestamp,
      collections: results.success,
      totalDocs: results.totalDocs,
      failed: results.failed
    };
  }
);
