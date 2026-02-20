import { z } from 'zod';

export const CATEGORIAS_VALIDAS = [
  'erro_bug',
  'problema_tecnico',
  'feedback',
  'duvida_pergunta',
  'solicitacao',
  'reclamacao',
  'informativo',
  'promocional',
  'outro'
];

export const SENTIMENTOS_VALIDOS = [
  'positivo',
  'neutro',
  'negativo',
  'urgente'
];

export const STATUS_VALIDOS = [
  'resolvido',
  'aguardando_cliente',
  'aguardando_equipe',
  'informativo'
];

export const classificacaoManualSchema = z.object({
  categoria: z.enum(CATEGORIAS_VALIDAS, {
    errorMap: () => ({ message: 'Selecione uma categoria' })
  }),
  sentimento: z.enum(SENTIMENTOS_VALIDOS, {
    errorMap: () => ({ message: 'Selecione um sentimento' })
  }),
  resumo: z.string().nullable().optional()
});

export const classificacaoIASchema = z.object({
  categoria: z.enum(CATEGORIAS_VALIDAS).catch('outro'),
  sentimento: z.enum(SENTIMENTOS_VALIDOS).catch('neutro'),
  status: z.enum(STATUS_VALIDOS).catch('aguardando_equipe'),
  resumo: z.string().max(500).catch('Não foi possível gerar um resumo.')
});
