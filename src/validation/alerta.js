import { z } from 'zod';

export const alertaEditSchema = z.object({
  titulo: z.string().min(1, 'Título é obrigatório'),
  mensagem: z.string().min(1, 'Mensagem é obrigatória'),
  prioridade: z.enum(['baixa', 'media', 'alta', 'urgente']),
  status: z.enum(['pendente', 'em_andamento', 'resolvido', 'ignorado', 'bloqueado']),
  notas: z.string().optional().default('')
});
