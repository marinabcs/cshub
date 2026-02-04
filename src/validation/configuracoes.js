import { z } from 'zod';

const posInt = z.number().int().positive('Deve ser um número positivo');

export const configGeralSchema = z.object({
  dias_sem_contato_alerta: posInt,
  dias_sem_contato_critico: posInt,
  dias_periodo_analise: posInt,
  dias_sem_uso_watch: posInt,
  dias_sem_uso_rescue: posInt,
  dias_reclamacao_grave: posInt,
  dias_reclamacoes_recentes: posInt,
  dias_ativos_frequente: posInt,
  dias_ativos_regular: posInt,
  dias_ativos_irregular: posInt,
  engajamento_alto: posInt,
  engajamento_medio: posInt,
  pagante_dias_alerta: posInt.optional(),
  pagante_dias_resgate: posInt.optional(),
  pagante_periodo_analise: posInt.optional(),
  gratuito_dias_alerta: posInt.optional(),
  gratuito_dias_resgate: posInt.optional(),
  gratuito_periodo_analise: posInt.optional()
});

export const configAlertasSchema = z.object({
  alerta_sentimento_negativo: z.boolean(),
  alerta_erro_bug: z.boolean(),
  alerta_urgente_automatico: z.boolean()
});

export const configEmailFiltersSchema = z.object({
  dominios_bloqueados: z.array(z.string()),
  dominios_completos_bloqueados: z.array(z.string()),
  palavras_chave_assunto: z.array(z.string())
});
