import { z } from 'zod';

const senhaSchema = z.string()
  .min(8, 'Mínimo 8 caracteres')
  .regex(/[A-Z]/, 'Deve conter uma letra maiúscula')
  .regex(/[a-z]/, 'Deve conter uma letra minúscula')
  .regex(/[0-9]/, 'Deve conter um número');

export const usuarioCreateSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  senha: senhaSchema,
  cargo: z.string().optional().default(''),
  role: z.enum(['viewer', 'cs', 'gestor', 'admin', 'super_admin']),
  ativo: z.boolean()
});

export const usuarioEditSchema = usuarioCreateSchema.omit({ senha: true });
