import { getFunctions, httpsCallable } from 'firebase/functions';

/**
 * Status possíveis da transcrição
 */
export const TRANSCRIPTION_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error'
};

/**
 * Valida o texto da transcrição
 */
export function validateTranscriptionText(text) {
  if (!text || typeof text !== 'string') {
    return 'Texto da transcrição é obrigatório';
  }

  const trimmed = text.trim();

  if (trimmed.length < 50) {
    return 'Transcrição muito curta (mínimo 50 caracteres)';
  }

  if (trimmed.length > 100000) {
    return 'Transcrição muito longa (máximo 100.000 caracteres)';
  }

  return null;
}

/**
 * Valida URL do link da transcrição
 */
export function validateTranscriptionLink(link) {
  if (!link) return null; // Link é opcional

  try {
    new URL(link);
    return null;
  } catch {
    return 'Link inválido';
  }
}

/**
 * Gera resumo de uma transcrição
 * @param {string} transcricaoTexto - Texto da transcrição
 * @param {string} linkTranscricao - Link para o documento original (Google Docs, etc.)
 * @param {string} interacaoId - ID da interação no Firestore
 * @param {string} clienteId - ID do cliente
 * @returns {Promise<{success: boolean, resumo_ia?: object, error?: string}>}
 */
export async function summarizeTranscription(transcricaoTexto, linkTranscricao, interacaoId, clienteId) {
  // Validar texto
  const textError = validateTranscriptionText(transcricaoTexto);
  if (textError) {
    return { success: false, error: textError };
  }

  // Validar link (se fornecido)
  const linkError = validateTranscriptionLink(linkTranscricao);
  if (linkError) {
    return { success: false, error: linkError };
  }

  try {
    // Chamar Cloud Function
    const functions = getFunctions(undefined, 'southamerica-east1');
    const summarizeFunction = httpsCallable(functions, 'summarizeTranscription');

    const result = await summarizeFunction({
      transcricaoTexto: transcricaoTexto.trim(),
      linkTranscricao: linkTranscricao?.trim() || null,
      interacaoId,
      clienteId
    });

    return {
      success: true,
      resumo_ia: result.data.resumo_ia
    };

  } catch (error) {
    console.error('Erro ao gerar resumo:', error);

    // Extrair mensagem de erro da Cloud Function
    const message = error.message || 'Erro ao gerar resumo';

    return {
      success: false,
      error: message.includes('INTERNAL') ? 'Erro ao gerar resumo. Tente novamente.' : message
    };
  }
}

/**
 * Parse do resumo_ia (vem como string JSON do Firestore)
 */
export function parseResumoIA(resumoString) {
  if (!resumoString) return null;

  try {
    if (typeof resumoString === 'object') return resumoString;
    return JSON.parse(resumoString);
  } catch {
    return null;
  }
}

/**
 * Retorna cor baseada no sentimento
 */
export function getSentimentoColor(sentimento) {
  const colors = {
    positivo: '#10b981',
    neutro: '#64748b',
    negativo: '#ef4444'
  };
  return colors[sentimento] || colors.neutro;
}

/**
 * Retorna label do sentimento
 */
export function getSentimentoLabel(sentimento) {
  const labels = {
    positivo: 'Positivo',
    neutro: 'Neutro',
    negativo: 'Negativo'
  };
  return labels[sentimento] || 'Neutro';
}
