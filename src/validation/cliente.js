import { z } from 'zod';

export const stakeholderSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  cargo: z.string().optional().default(''),
  telefone: z.string().optional().default(''),
  linkedin_url: z.string().url('URL do LinkedIn inválida').optional().or(z.literal('')).default(''),
  tipo_contato: z.enum(['decisor', 'operacional', 'financeiro', 'tecnico', 'outro']).optional().default('outro')
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
  area_atuacao: z.string().nullable(),
  tipo_conta: z.enum(['pagante', 'google_gratuito']).optional().default('pagante'),
  pessoa_video: z.boolean().optional().default(false),
  modulos_concluidos: z.array(z.enum(['estatico', 'ai', 'motion'])).optional().default([]),
  first_value_atingido: z.object({
    estatico: z.string().optional().default(''),
    ai: z.string().optional().default(''),
    motion: z.string().optional().default('')
  }).optional().default({}),
  calendario_campanhas: z.object({
    jan: z.enum(['alta', 'normal', 'baixa']).default('normal'),
    fev: z.enum(['alta', 'normal', 'baixa']).default('normal'),
    mar: z.enum(['alta', 'normal', 'baixa']).default('normal'),
    abr: z.enum(['alta', 'normal', 'baixa']).default('normal'),
    mai: z.enum(['alta', 'normal', 'baixa']).default('normal'),
    jun: z.enum(['alta', 'normal', 'baixa']).default('normal'),
    jul: z.enum(['alta', 'normal', 'baixa']).default('normal'),
    ago: z.enum(['alta', 'normal', 'baixa']).default('normal'),
    set: z.enum(['alta', 'normal', 'baixa']).default('normal'),
    out: z.enum(['alta', 'normal', 'baixa']).default('normal'),
    nov: z.enum(['alta', 'normal', 'baixa']).default('normal'),
    dez: z.enum(['alta', 'normal', 'baixa']).default('normal')
  }).optional().default({}),
  tags_problema: z.array(z.object({
    tag: z.string().min(1),
    origem: z.enum(['cs', 'ia']),
    data: z.any(),
    thread_id: z.string().optional().default('')
  })).optional().default([]),
  bugs_reportados: z.array(z.object({
    id: z.string().min(1),
    titulo: z.string().min(1),
    descricao: z.string().optional().default(''),
    prioridade: z.enum(['baixa', 'media', 'alta', 'critica']),
    status: z.enum(['aberto', 'em_andamento', 'resolvido']),
    link_clickup: z.string().optional().default(''),
    data: z.any(),
    resolvido_em: z.any().optional().nullable()
  })).optional().default([])
});
