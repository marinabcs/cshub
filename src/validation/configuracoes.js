import { z } from 'zod';

// Validadores base
const posInt = z.number().int().positive('Deve ser inteiro positivo');
const nonNegInt = z.number().int().nonnegative('Deve ser inteiro >= 0');
const posNum = z.number().positive('Deve ser positivo'); // Para SLA (aceita decimais)

/**
 * Schema de validacao para configuracoes de Saude CS
 *
 * Pilares (ordem de prioridade):
 * 1. Reclamacoes em aberto (veto absoluto)
 * 2. Dias ativos no mes (base da classificacao)
 * 3. Engajamento (elevacao para CRESCIMENTO)
 */
export const configGeralSchema = z.object({
  // Dias ativos no mes (thresholds por nivel) - INTEIROS
  dias_ativos_crescimento: posInt,
  dias_ativos_estavel: posInt,
  dias_ativos_alerta: posInt,
  dias_ativos_resgate: nonNegInt,
  // Score de engajamento (thresholds por nivel) - INTEIROS
  engajamento_crescimento: posInt,
  engajamento_estavel: posInt,
  engajamento_alerta: nonNegInt,
  engajamento_resgate: nonNegInt,
  // Reclamacoes em aberto (max permitido por nivel - 0 = nao aceita)
  reclamacoes_crescimento: nonNegInt,
  reclamacoes_estavel: nonNegInt,
  reclamacoes_alerta: nonNegInt,
  reclamacoes_resgate: nonNegInt,
  // Pesos do score de engajamento - INTEIROS
  peso_logins: nonNegInt.optional(),
  peso_projetos: nonNegInt.optional(),
  peso_pecas: nonNegInt.optional(),
  peso_downloads: nonNegInt.optional(),
  peso_creditos: nonNegInt.optional(),
  peso_ia: nonNegInt.optional(), // Legado: alias para peso_creditos
});

export const configAlertasSchema = z.object({
  alerta_sentimento_negativo: z.boolean(),
  alerta_erro_bug: z.boolean(),
  alerta_urgente_automatico: z.boolean()
});

const horaStr = z.string().regex(/^\d{2}:\d{2}$/, 'Formato invalido (HH:MM)');

export const configSlaSchema = z.object({
  resposta_dias_uteis: posNum,
  resposta_final_semana: posNum,
  resposta_campanha_ativa: posNum,
  resposta_bug_critico: posNum,
  horario_comercial_inicio: horaStr,
  horario_comercial_fim: horaStr
});

export const configEmailFiltersSchema = z.object({
  dominios_bloqueados: z.array(z.string()),
  dominios_completos_bloqueados: z.array(z.string()),
  palavras_chave_assunto: z.array(z.string())
});
