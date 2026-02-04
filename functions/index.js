/**
 * Cloud Functions para CS Hub
 *
 * Webhook para sincronizacao bidirecional com ClickUp
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';

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
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Login necessário');
  }

  const { conversa, contextoCliente } = request.data;

  if (!conversa || typeof conversa !== 'string') {
    throw new HttpsError('invalid-argument', 'Campo "conversa" é obrigatório');
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
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Login necessário');
  }

  const { action, payload } = request.data;

  if (!action) {
    throw new HttpsError('invalid-argument', 'Campo "action" é obrigatório');
  }

  const apiKey = process.env.CLICKUP_API_KEY;
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'CLICKUP_API_KEY não configurada no servidor');
  }

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
        if (!taskId) {
          throw new HttpsError('invalid-argument', 'taskId é obrigatório');
        }
        const res = await fetch(`${CLICKUP_BASE}/task/${taskId}`, { headers: apiHeaders });
        if (!res.ok) {
          throw new HttpsError('internal', 'Erro ao buscar tarefa no ClickUp');
        }
        return await res.json();
      }

      case 'updateTaskStatus': {
        const { taskId, status } = payload;
        if (!taskId || !status) {
          throw new HttpsError('invalid-argument', 'taskId e status são obrigatórios');
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
        if (!teamId) {
          throw new HttpsError('invalid-argument', 'teamId é obrigatório');
        }
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
        throw new HttpsError('invalid-argument', `Ação desconhecida: ${action}`);
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
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Login necessário');
  }

  const { prompt, systemMsg, lang } = request.data;

  if (!prompt || typeof prompt !== 'string') {
    throw new HttpsError('invalid-argument', 'Campo "prompt" é obrigatório');
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
