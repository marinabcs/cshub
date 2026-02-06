import { z } from 'zod';

const posInt = z.number().int().positive('Deve ser um numero positivo');
const nonNegInt = z.number().int().nonnegative('Deve ser zero ou positivo');
const posNum = z.number().positive('Deve ser um numero positivo');

/**
 * Schema de validacao para configuracoes de Saude CS
 *
 * Pilares (ordem de prioridade):
 * 1. Reclamacoes em aberto (veto absoluto)
 * 2. Dias ativos no mes (base da classificacao)
 * 3. Engajamento (elevacao para CRESCIMENTO)
 */
export const configGeralSchema = z.object({
  // Dias ativos no mes (thresholds por nivel)
  dias_ativos_crescimento: posInt,
  dias_ativos_estavel: posInt,
  dias_ativos_alerta: posInt,
  dias_ativos_resgate: nonNegInt,
  // Score de engajamento (thresholds por nivel)
  engajamento_crescimento: posInt,
  engajamento_estavel: posInt,
  engajamento_alerta: nonNegInt,
  engajamento_resgate: nonNegInt,
  // Reclamacoes em aberto (toggles por nivel - se TRUE, esse nivel aceita reclamacoes)
  reclamacoes_crescimento: z.boolean(),
  reclamacoes_estavel: z.boolean(),
  reclamacoes_alerta: z.boolean(),
  reclamacoes_resgate: z.boolean(),
  // Thresholds adicionais
  reclamacoes_max_resgate: posInt.optional(),
  bugs_max_alerta: posInt.optional(),
  // Toggles de regras especiais
  aviso_previo_resgate: z.boolean().optional(),
  champion_saiu_alerta: z.boolean().optional(),
  tags_problema_alerta: z.boolean().optional(),
  zero_producao_alerta: z.boolean().optional(),
  // Pesos do score de engajamento
  peso_pecas: posNum.optional(),
  peso_ia: posNum.optional(),
  peso_downloads: posNum.optional(),
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
