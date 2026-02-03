import { z } from 'zod';

export const CATEGORIAS_VALIDAS = [
  'erro_bug',
  'problema_tecnico',
  'feedback',
  'duvida',
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
