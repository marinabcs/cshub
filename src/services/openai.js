import { httpsCallable } from 'firebase/functions';
import { classificacaoIASchema } from '../validation/thread';
import { logger } from '../utils/logger';
import { functions } from './firebase';

const classifyThreadFn = httpsCallable(functions, 'classifyThread');

// Categorias de thread
export const THREAD_CATEGORIAS = {
  erro_bug: {
    value: 'erro_bug',
    label: 'Erro/Bug',
    color: '#ef4444', // vermelho
    icon: 'Bug',
  },
  reclamacao: {
    value: 'reclamacao',
    label: 'Reclamação',
    color: '#dc2626', // vermelho escuro
    icon: 'AlertTriangle',
  },
  problema_tecnico: {
    value: 'problema_tecnico',
    label: 'Problema Técnico',
    color: '#f97316', // laranja
    icon: 'Wrench',
  },
  feedback: {
    value: 'feedback',
    label: 'Feedback',
    color: '#3b82f6', // azul
    icon: 'MessageSquare',
  },
  duvida_pergunta: {
    value: 'duvida_pergunta',
    label: 'Dúvida/Pergunta',
    color: '#8b5cf6', // roxo
    icon: 'HelpCircle',
  },
  solicitacao: {
    value: 'solicitacao',
    label: 'Solicitação',
    color: '#10b981', // verde
    icon: 'FileText',
  },
  outro: {
    value: 'outro',
    label: 'Outro',
    color: '#6b7280', // cinza
    icon: 'MoreHorizontal',
  },
};

// Sentimentos
export const THREAD_SENTIMENTOS = {
  positivo: {
    value: 'positivo',
    label: 'Positivo',
    color: '#10b981', // verde
    emoji: '😊',
  },
  neutro: {
    value: 'neutro',
    label: 'Neutro',
    color: '#6b7280', // cinza
    emoji: '😐',
  },
  negativo: {
    value: 'negativo',
    label: 'Negativo',
    color: '#ef4444', // vermelho
    emoji: '😞',
  },
  urgente: {
    value: 'urgente',
    label: 'Urgente',
    color: '#dc2626', // vermelho escuro
    emoji: '🚨',
    pulse: true,
  },
};

// Funções utilitárias
export function getCategoriaInfo(categoria) {
  return THREAD_CATEGORIAS[categoria] || THREAD_CATEGORIAS.outro;
}

export function getSentimentoInfo(sentimento) {
  return THREAD_SENTIMENTOS[sentimento] || THREAD_SENTIMENTOS.neutro;
}

// Classificar thread com IA (via Cloud Function)
export async function classificarThread(conversa, contextoCliente = '') {
  try {
    const result = await classifyThreadFn({ conversa, contextoCliente });
    // Validar com Zod — campos inválidos recebem fallback automático
    return classificacaoIASchema.parse(result.data);
  } catch {
    logger.error('Falha na classificação de thread');
    throw new Error('Não foi possível classificar a conversa. Tente novamente.');
  }
}

// Cloud Function sempre disponível quando autenticado
export function isOpenAIConfigured() {
  return true;
}
