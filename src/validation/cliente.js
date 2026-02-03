import { z } from 'zod';

export const stakeholderSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  cargo: z.string().optional().default(''),
  telefone: z.string().optional().default('')
});

export const clienteSchema = z.object({
  nome: z.string().min(1, 'Nome do cliente é obrigatório'),
  status: z.enum(['ativo', 'onboarding', 'aviso_previo', 'inativo', 'cancelado']),
  categorias_produto: z.array(z.string()).min(1, 'Selecione ao menos 1 categoria de produto'),
  responsaveis: z.array(z.object({
    email: z.string().email(),
    nome: z.string()
  })),
  tags: z.array(z.string()),
  times: z.array(z.string()),
  team_type: z.string().optional().default(''),
  stakeholders: z.array(stakeholderSchema),
  senha_padrao: z.string().optional().default(''),
  area_atuacao: z.string().nullable()
});
