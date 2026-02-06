/**
 * Cloud Functions para CS Hub
 *
 * Webhook para sincronizacao bidirecional com ClickUp
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
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
  cors: false
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

    // Verificar se é um evento de mudança de status
    if (payload.event !== 'taskStatusUpdated' && payload.event !== 'taskUpdated') {
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
      res.status(200).json({ success: true, message: 'Status nao mapeado' });
      return;
    }

    // Buscar alerta pelo clickup_task_id
    const alertasSnap = await db.collection('alertas')
      .where('clickup_task_id', '==', taskId)
      .limit(5)
      .get();

    if (alertasSnap.empty) {
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
    }

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
- urgente = problema crítico que impede o uso ou precisa atenção imediata`;

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
        resumo: 'Não foi possível classificar esta conversa.'
      };
    }

    return {
      categoria: parsed.categoria || 'outro',
      sentimento: parsed.sentimento || 'neutro',
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
};

function calcularSegmentoCS(cliente, threads, metricas, totalUsers, config = {}) {
  const cfg = { ...DEFAULT_SAUDE_CONFIG, ...config };

  // Calcular fatores
  const diasAtivos = metricas?.dias_ativos || 0;
  const engajamentoScore = calcularEngajamentoScore(metricas, cfg);
  const reclamacoesEmAberto = temReclamacoesEmAberto(threads);
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

  // Flags especiais
  const emAvisoPrevio = cliente?.status === 'aviso_previo';
  const championSaiu = cliente?.champion_saiu === true;
  const temTagsProblema = (cliente?.tags_problema || []).length > 0;
  const bugsAbertos = (cliente?.bugs_reportados || []).filter(b => b.status !== 'resolvido').length;

  // Zero producao
  const zeroProd = (metricas?.pecas_criadas || 0) === 0 &&
                   (metricas?.downloads || 0) === 0 &&
                   (metricas?.uso_ai_total || 0) === 0;

  // 1. PRIORIDADE MAXIMA: CONDICOES DE RESGATE
  // Aviso previo = RESGATE automatico (se toggle ativo)
  if (cfg.aviso_previo_resgate && emAvisoPrevio) {
    return { segmento: 'RESGATE', motivo: 'Em aviso previo' };
  }
  // X+ reclamacoes em aberto = RESGATE (threshold configuravel)
  const thReclamacoesResgate = cfg.reclamacoes_max_resgate ?? 3;
  if (qtdReclamacoes >= thReclamacoesResgate) {
    return { segmento: 'RESGATE', motivo: `${qtdReclamacoes} reclamacoes em aberto (limite: ${thReclamacoesResgate})` };
  }
  // Zero dias ativos + zero producao = RESGATE
  if (diasAtivos === 0 && zeroProd) {
    return { segmento: 'RESGATE', motivo: 'Sem atividade e sem producao no mes' };
  }

  // 2. PRIORIDADE MEDIA: OUTRAS CONDICOES DE ALERTA
  // Champion saiu (se toggle ativo)
  if (cfg.champion_saiu_alerta && championSaiu) {
    return { segmento: 'ALERTA', motivo: 'Champion saiu' };
  }
  // Tags de problema ativas (se toggle ativo)
  if (cfg.tags_problema_alerta && temTagsProblema) {
    return { segmento: 'ALERTA', motivo: 'Tags de problema ativas' };
  }
  // Muitos bugs abertos (threshold configuravel)
  const thBugsAlerta = cfg.bugs_max_alerta ?? 3;
  if (bugsAbertos >= thBugsAlerta) {
    return { segmento: 'ALERTA', motivo: `${bugsAbertos} bugs abertos (limite: ${thBugsAlerta})` };
  }
  // Zero producao (se toggle ativo - logou sem produzir)
  if (cfg.zero_producao_alerta && zeroProd) {
    return { segmento: 'ALERTA', motivo: 'Login sem producao' };
  }
  // Poucos dias ativos
  if (diasAtivos < thDiasAtivosAlerta) {
    return { segmento: 'ALERTA', motivo: `Apenas ${diasAtivos} dias ativos (minimo: ${thDiasAtivosAlerta})` };
  }

  // 3. CLASSIFICACAO POSITIVA: ESTAVEL ou CRESCIMENTO
  // Verificar se atende criterios de CRESCIMENTO
  const podeSerCrescimento = !reclamacoesEmAberto || cfg.reclamacoes_crescimento;
  if (podeSerCrescimento && diasAtivos >= thDiasAtivosCrescimento && engajamentoScore >= thEngajamentoCrescimento) {
    return { segmento: 'CRESCIMENTO', motivo: `${diasAtivos} dias ativos + engajamento ${engajamentoScore}` };
  }

  // Verificar se atende criterios de ESTAVEL
  const podeSerEstavel = !reclamacoesEmAberto || cfg.reclamacoes_estavel;
  if (podeSerEstavel && diasAtivos >= thDiasAtivosEstavel) {
    return { segmento: 'ESTAVEL', motivo: `${diasAtivos} dias ativos no mes` };
  }

  // Se tem reclamacao e nao pode ser ESTAVEL, vai para ALERTA
  if (reclamacoesEmAberto) {
    return { segmento: 'ALERTA', motivo: `${qtdReclamacoes} reclamacao(es) em aberto` };
  }

  // Fallback
  return { segmento: 'ALERTA', motivo: `${diasAtivos} dias ativos (abaixo do ideal: ${thDiasAtivosEstavel})` };
}

/**
 * Recalcula saude (segmento_cs) de todos os clientes ativos.
 * Roda diariamente as 7h horario de Brasilia.
 */
export const recalcularSaudeDiaria = onSchedule({
  schedule: '0 7 * * *',
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
          const temAtividade = (d.logins || 0) > 0 || (d.pecas_criadas || 0) > 0 || (d.downloads || 0) > 0 || (d.uso_ai_total || 0) > 0;
          return {
            logins: acc.logins + (d.logins || 0),
            pecas_criadas: acc.pecas_criadas + (d.pecas_criadas || 0),
            downloads: acc.downloads + (d.downloads || 0),
            uso_ai_total: acc.uso_ai_total + (d.uso_ai_total || 0),
            dias_ativos: acc.dias_ativos + (temAtividade ? 1 : 0),
            ultima_atividade: dataDate && (!acc.ultima_atividade || dataDate > acc.ultima_atividade) ? dataDate : acc.ultima_atividade
          };
        }, { logins: 0, pecas_criadas: 0, downloads: 0, uso_ai_total: 0, dias_ativos: 0, ultima_atividade: null });

        const resultado = calcularSegmentoCS(cliente, threads, metricas, totalUsers, saudeConfig);
        const segmentoAtual = normalizarSegmento(cliente.segmento_cs);

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
      } else {
        batch.update(ref, { segmento_recalculado_em: Timestamp.now() });
      }
      batchCount++;
    }

    if (batchCount > 0) await batch.commit();
  }

  console.log(`Saude recalculada: ${clientes.length} clientes processados, ${updatedCount} atualizados`);
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
  schedule: '0 9,13,17 * * 1-5', // 9h, 13h, 17h de segunda a sexta
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
