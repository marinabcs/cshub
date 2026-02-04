import { z } from 'zod';

export const CATEGORIAS_VALIDAS = [
  'erro_bug',
  'problema_tecnico',
  'feedback',
  'duvida_pergunta',
  'solicitacao',
  'reclamacao',
  'outro'
];

export const SENTIMENTOS_VALIDOS = [
  'positivo',
  'neutro',
  'negativo',
  'urgente'
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
  resumo: z.string().max(500).catch('Não foi possível gerar um resumo.')
});
