import { z } from 'zod';

export const documentoSchema = z.object({
  titulo: z.string().min(1, 'Título é obrigatório'),
  url: z.string().url('URL inválida')
});

export const observacaoSchema = z.object({
  texto: z.string().min(1, 'Texto da observação é obrigatório')
});

export const interacaoSchema = z.object({
  tipo: z.enum(['onboarding', 'feedback', 'suporte', 'treinamento', 'qbr', 'outro']),
  data: z.string().min(1, 'Data é obrigatória'),
  participantes: z.string().optional().default(''),
  notas: z.string().optional().default(''),
  duracao: z.number().min(0).optional().default(0),
  link_gravacao: z.string().optional().default('')
});
