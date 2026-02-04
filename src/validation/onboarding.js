import { z } from 'zod';

export const onboardingRespostasSchema = z.object({
  qtd_pessoas: z.string().min(1, 'Selecione uma opção'),
  ferramentas: z.array(z.string()).default([]),
  maior_desafio: z.string().min(1, 'Selecione uma opção'),
  materiais: z.array(z.string()).min(1, 'Selecione ao menos um tipo'),
  formatos_campanha: z.string().min(1, 'Selecione uma opção'),
  catalogo: z.string().min(1, 'Selecione uma opção'),
  video: z.string().min(1, 'Selecione uma opção'),
  pessoa_video: z.string().min(1, 'Selecione uma opção'),
  html5: z.string().min(1, 'Selecione uma opção'),
  uso_ia: z.string().min(1, 'Selecione uma opção'),
  video_ia: z.string().min(1, 'Selecione uma opção'),
  consistencia_marca: z.string().min(1, 'Selecione uma opção'),
  publicam: z.array(z.string()).min(1, 'Selecione ao menos uma opção'),
  analytics: z.string().min(1, 'Selecione uma opção'),
  campanhas_rodando: z.string().min(1, 'Selecione uma opção'),
  '3d': z.string().min(1, 'Selecione uma opção'),
  nomenclatura: z.string().min(1, 'Selecione uma opção'),
  urgencia: z.string().min(1, 'Selecione uma opção'),
  kv_disponivel: z.string().min(1, 'Selecione uma opção'),
  participantes: z.string().optional().default('')
});

export const onboardingAjusteSchema = z.object({
  modulo_id: z.string().min(1),
  novo_modo: z.enum(['ao_vivo', 'online']),
  justificativa: z.string().min(10, 'Justificativa deve ter no mínimo 10 caracteres')
});
