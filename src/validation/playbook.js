import { z } from 'zod';

const documentoEtapaSchema = z.object({
  nome: z.string().min(1),
  url: z.string().url('URL inválida')
});

const etapaSchema = z.object({
  ordem: z.number().int().positive(),
  nome: z.string().min(1, 'Nome da etapa é obrigatório'),
  descricao: z.string().optional().default(''),
  prazo_dias: z.number().int().positive('Prazo deve ser positivo'),
  obrigatoria: z.boolean(),
  documentos: z.array(documentoEtapaSchema).optional().default([])
});

export const playbookSchema = z.object({
  nome: z.string().min(1, 'Nome do playbook é obrigatório'),
  descricao: z.string().optional().default(''),
  duracao_estimada_dias: z.number().int().positive('Duração deve ser positiva'),
  ativo: z.boolean(),
  etapas: z.array(etapaSchema).min(1, 'Adicione ao menos 1 etapa')
});
