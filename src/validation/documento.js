import { z } from 'zod';

export const documentoSchema = z.object({
  titulo: z.string().min(1, 'Título é obrigatório'),
  url: z.string().url('URL inválida')
});

export const observacaoSchema = z.object({
  texto: z.string().min(1, 'Texto da observação é obrigatório')
});
