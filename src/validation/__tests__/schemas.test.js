import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { validateForm } from '../index';
import { clienteSchema, stakeholderSchema } from '../cliente';
import { alertaEditSchema } from '../alerta';
import { classificacaoManualSchema, classificacaoIASchema, CATEGORIAS_VALIDAS, SENTIMENTOS_VALIDOS } from '../thread';
import { usuarioCreateSchema, usuarioEditSchema, senhaSchema } from '../usuario';
import { documentoSchema, observacaoSchema, interacaoSchema } from '../documento';
import { onboardingRespostasSchema, onboardingAjusteSchema } from '../onboarding';

// ============================================
// VALIDATE FORM (util)
// ============================================

describe('validateForm', () => {
  const testSchema = z.object({
    nome: z.string().min(1),
    idade: z.number(),
  });

  it('retorna null para dados válidos', () => {
    expect(validateForm(testSchema, { nome: 'Ana', idade: 25 })).toBeNull();
  });

  it('retorna erros para dados inválidos', () => {
    const errors = validateForm(testSchema, { nome: '', idade: 'abc' });
    expect(errors).not.toBeNull();
    expect(errors).toHaveProperty('nome');
    expect(errors).toHaveProperty('idade');
  });

  it('retorna apenas o primeiro erro por campo', () => {
    const errors = validateForm(testSchema, {});
    expect(typeof errors.nome).toBe('string');
  });
});

// ============================================
// STAKEHOLDER SCHEMA
// ============================================

describe('stakeholderSchema', () => {
  it('aceita stakeholder válido completo', () => {
    const data = {
      nome: 'João',
      email: 'joao@empresa.com',
      cargo: 'Diretor',
      telefone: '11999999999',
      linkedin_url: 'https://linkedin.com/in/joao',
      tipo_contato: 'decisor',
    };
    expect(stakeholderSchema.safeParse(data).success).toBe(true);
  });

  it('aceita stakeholder mínimo (só nome e email)', () => {
    const data = { nome: 'João', email: 'joao@empresa.com' };
    expect(stakeholderSchema.safeParse(data).success).toBe(true);
  });

  it('rejeita sem nome', () => {
    const data = { nome: '', email: 'joao@empresa.com' };
    expect(stakeholderSchema.safeParse(data).success).toBe(false);
  });

  it('rejeita email inválido', () => {
    const data = { nome: 'João', email: 'invalido' };
    expect(stakeholderSchema.safeParse(data).success).toBe(false);
  });

  it('aceita linkedin_url vazio', () => {
    const data = { nome: 'João', email: 'j@e.com', linkedin_url: '' };
    expect(stakeholderSchema.safeParse(data).success).toBe(true);
  });

  it('rejeita linkedin_url inválido', () => {
    const data = { nome: 'João', email: 'j@e.com', linkedin_url: 'not-a-url' };
    expect(stakeholderSchema.safeParse(data).success).toBe(false);
  });

  it('tipo_contato aceita todos os 6 valores', () => {
    const tipos = ['decisor', 'operacional', 'financeiro', 'tecnico', 'time_google', 'outro'];
    for (const tipo of tipos) {
      const data = { nome: 'A', email: 'a@b.com', tipo_contato: tipo };
      expect(stakeholderSchema.safeParse(data).success).toBe(true);
    }
  });

  it('tipo_contato rejeita valor inválido', () => {
    const data = { nome: 'A', email: 'a@b.com', tipo_contato: 'invalido' };
    expect(stakeholderSchema.safeParse(data).success).toBe(false);
  });
});

// ============================================
// CLIENTE SCHEMA
// ============================================

describe('clienteSchema', () => {
  const clienteValido = {
    nome: 'Acme Corp',
    status: 'ativo',
    categorias_produto: ['SaaS'],
    responsaveis: [{ email: 'cs@trakto.io', nome: 'CS' }],
    times: ['t1'],
    stakeholders: [{ nome: 'João', email: 'j@acme.com' }],
    area_atuacao: 'tecnologia',
  };

  it('aceita cliente válido', () => {
    expect(clienteSchema.safeParse(clienteValido).success).toBe(true);
  });

  it('rejeita sem nome', () => {
    const data = { ...clienteValido, nome: '' };
    expect(clienteSchema.safeParse(data).success).toBe(false);
  });

  it('status aceita os 4 valores válidos', () => {
    const statuses = ['ativo', 'aviso_previo', 'inativo', 'cancelado'];
    for (const status of statuses) {
      const data = { ...clienteValido, status };
      expect(clienteSchema.safeParse(data).success).toBe(true);
    }
  });

  it('rejeita status inválido', () => {
    const data = { ...clienteValido, status: 'xyz' };
    expect(clienteSchema.safeParse(data).success).toBe(false);
  });

  it('rejeita categorias_produto vazio', () => {
    const data = { ...clienteValido, categorias_produto: [] };
    expect(clienteSchema.safeParse(data).success).toBe(false);
  });

  it('tipo_conta aceita pagante e google_gratuito', () => {
    expect(clienteSchema.safeParse({ ...clienteValido, tipo_conta: 'pagante' }).success).toBe(true);
    expect(clienteSchema.safeParse({ ...clienteValido, tipo_conta: 'google_gratuito' }).success).toBe(true);
  });

  it('tipo_conta rejeita valor inválido', () => {
    expect(clienteSchema.safeParse({ ...clienteValido, tipo_conta: 'free' }).success).toBe(false);
  });

});

// ============================================
// ALERTA EDIT SCHEMA
// ============================================

describe('alertaEditSchema', () => {
  it('aceita alerta válido', () => {
    const data = {
      titulo: 'Alerta teste',
      mensagem: 'Descrição do alerta',
      prioridade: 'alta',
      status: 'pendente',
    };
    expect(alertaEditSchema.safeParse(data).success).toBe(true);
  });

  it('rejeita sem título', () => {
    const data = { titulo: '', mensagem: 'X', prioridade: 'alta', status: 'pendente' };
    expect(alertaEditSchema.safeParse(data).success).toBe(false);
  });

  it('prioridade aceita 4 valores', () => {
    for (const p of ['baixa', 'media', 'alta', 'urgente']) {
      const data = { titulo: 'T', mensagem: 'M', prioridade: p, status: 'pendente' };
      expect(alertaEditSchema.safeParse(data).success).toBe(true);
    }
  });

  it('status aceita 5 valores', () => {
    for (const s of ['pendente', 'em_andamento', 'resolvido', 'ignorado', 'bloqueado']) {
      const data = { titulo: 'T', mensagem: 'M', prioridade: 'alta', status: s };
      expect(alertaEditSchema.safeParse(data).success).toBe(true);
    }
  });

  it('notas é opcional', () => {
    const data = { titulo: 'T', mensagem: 'M', prioridade: 'alta', status: 'pendente' };
    expect(alertaEditSchema.safeParse(data).success).toBe(true);
  });
});

// ============================================
// THREAD SCHEMAS
// ============================================

describe('classificacaoManualSchema', () => {
  it('aceita classificação válida', () => {
    const data = { categoria: 'erro_bug', sentimento: 'negativo' };
    expect(classificacaoManualSchema.safeParse(data).success).toBe(true);
  });

  it('aceita todas as 7 categorias', () => {
    for (const cat of CATEGORIAS_VALIDAS) {
      const data = { categoria: cat, sentimento: 'neutro' };
      expect(classificacaoManualSchema.safeParse(data).success).toBe(true);
    }
  });

  it('aceita todos os 4 sentimentos', () => {
    for (const sent of SENTIMENTOS_VALIDOS) {
      const data = { categoria: 'outro', sentimento: sent };
      expect(classificacaoManualSchema.safeParse(data).success).toBe(true);
    }
  });

  it('rejeita categoria inválida', () => {
    expect(classificacaoManualSchema.safeParse({ categoria: 'xyz', sentimento: 'neutro' }).success).toBe(false);
  });

  it('resumo é opcional e pode ser null', () => {
    const data = { categoria: 'outro', sentimento: 'neutro', resumo: null };
    expect(classificacaoManualSchema.safeParse(data).success).toBe(true);
  });
});

describe('classificacaoIASchema', () => {
  it('aceita classificação válida', () => {
    const data = { categoria: 'erro_bug', sentimento: 'negativo', resumo: 'Resumo' };
    expect(classificacaoIASchema.safeParse(data).success).toBe(true);
  });

  it('usa fallback "outro" para categoria inválida', () => {
    const result = classificacaoIASchema.safeParse({ categoria: 'xyz', sentimento: 'neutro', resumo: 'ok' });
    expect(result.success).toBe(true);
    expect(result.data.categoria).toBe('outro');
  });

  it('usa fallback "neutro" para sentimento inválido', () => {
    const result = classificacaoIASchema.safeParse({ categoria: 'outro', sentimento: 'xyz', resumo: 'ok' });
    expect(result.success).toBe(true);
    expect(result.data.sentimento).toBe('neutro');
  });

  it('usa fallback para resumo inválido', () => {
    const result = classificacaoIASchema.safeParse({ categoria: 'outro', sentimento: 'neutro', resumo: 123 });
    expect(result.success).toBe(true);
    expect(result.data.resumo).toBe('Não foi possível gerar um resumo.');
  });
});

// ============================================
// USUARIO SCHEMAS
// ============================================

describe('senhaSchema', () => {
  it('aceita senha forte', () => {
    expect(senhaSchema.safeParse('Abc123!@').success).toBe(true);
  });

  it('rejeita senha curta (<8)', () => {
    expect(senhaSchema.safeParse('Ab1!').success).toBe(false);
  });

  it('rejeita sem maiúscula', () => {
    expect(senhaSchema.safeParse('abc123!@').success).toBe(false);
  });

  it('rejeita sem minúscula', () => {
    expect(senhaSchema.safeParse('ABC123!@').success).toBe(false);
  });

  it('rejeita sem número', () => {
    expect(senhaSchema.safeParse('Abcdefg!').success).toBe(false);
  });

  it('rejeita sem caractere especial', () => {
    expect(senhaSchema.safeParse('Abcdef12').success).toBe(false);
  });
});

describe('usuarioCreateSchema', () => {
  const valido = {
    nome: 'Marina',
    email: 'marina@trakto.io',
    senha: 'Abc123!@',
    role: 'cs',
    ativo: true,
  };

  it('aceita usuário válido', () => {
    expect(usuarioCreateSchema.safeParse(valido).success).toBe(true);
  });

  it('aceita todas as 5 roles', () => {
    for (const role of ['viewer', 'cs', 'gestor', 'admin', 'super_admin']) {
      expect(usuarioCreateSchema.safeParse({ ...valido, role }).success).toBe(true);
    }
  });

  it('rejeita role inválida', () => {
    expect(usuarioCreateSchema.safeParse({ ...valido, role: 'xyz' }).success).toBe(false);
  });

  it('rejeita email inválido', () => {
    expect(usuarioCreateSchema.safeParse({ ...valido, email: 'invalido' }).success).toBe(false);
  });

  it('rejeita sem nome', () => {
    expect(usuarioCreateSchema.safeParse({ ...valido, nome: '' }).success).toBe(false);
  });
});

describe('usuarioEditSchema', () => {
  it('não requer senha', () => {
    const data = { nome: 'Marina', email: 'm@t.io', role: 'cs', ativo: true };
    expect(usuarioEditSchema.safeParse(data).success).toBe(true);
  });
});

// ============================================
// DOCUMENTO / OBSERVACAO / INTERACAO
// ============================================

describe('documentoSchema', () => {
  it('aceita documento válido', () => {
    expect(documentoSchema.safeParse({ titulo: 'Doc', url: 'https://example.com' }).success).toBe(true);
  });

  it('rejeita URL vazia', () => {
    expect(documentoSchema.safeParse({ titulo: 'Doc', url: '' }).success).toBe(false);
  });

  it('rejeita sem título', () => {
    expect(documentoSchema.safeParse({ titulo: '', url: 'https://example.com' }).success).toBe(false);
  });
});

describe('observacaoSchema', () => {
  it('aceita texto válido', () => {
    expect(observacaoSchema.safeParse({ texto: 'Nota importante' }).success).toBe(true);
  });

  it('rejeita texto vazio', () => {
    expect(observacaoSchema.safeParse({ texto: '' }).success).toBe(false);
  });
});

describe('interacaoSchema', () => {
  it('aceita interação válida', () => {
    const data = { tipo: 'feedback', data: '2026-01-15' };
    expect(interacaoSchema.safeParse(data).success).toBe(true);
  });

  it('aceita todos os tipos', () => {
    for (const tipo of ['onboarding', 'feedback', 'suporte', 'treinamento', 'qbr', 'outro']) {
      expect(interacaoSchema.safeParse({ tipo, data: '2026-01-15' }).success).toBe(true);
    }
  });

  it('rejeita tipo inválido', () => {
    expect(interacaoSchema.safeParse({ tipo: 'xyz', data: '2026-01-15' }).success).toBe(false);
  });
});

// ============================================
// ONBOARDING SCHEMAS
// ============================================

describe('onboardingRespostasSchema', () => {
  const respostasValidas = {
    qtd_pessoas: '1_3',
    materiais: ['posts_social'],
    video_producao: 'nao',
    uso_ia: 'curioso',
    video_ia: 'nao',
    consistencia_marca: 'nao',
    publicam: ['download_manual'],
    analytics_performance: 'nao',
    extras: [],
    urgencia: 'mes',
  };

  it('aceita respostas válidas', () => {
    expect(onboardingRespostasSchema.safeParse(respostasValidas).success).toBe(true);
  });

  it('rejeita materiais vazio', () => {
    const data = { ...respostasValidas, materiais: [] };
    expect(onboardingRespostasSchema.safeParse(data).success).toBe(false);
  });

  it('rejeita publicam vazio', () => {
    const data = { ...respostasValidas, publicam: [] };
    expect(onboardingRespostasSchema.safeParse(data).success).toBe(false);
  });

  it('extras pode ser vazio', () => {
    const data = { ...respostasValidas, extras: [] };
    expect(onboardingRespostasSchema.safeParse(data).success).toBe(true);
  });
});

describe('onboardingAjusteSchema', () => {
  it('aceita ajuste válido', () => {
    const data = { modulo_id: 'M3', novo_modo: 'ao_vivo', justificativa: 'Cliente pediu sessão ao vivo' };
    expect(onboardingAjusteSchema.safeParse(data).success).toBe(true);
  });

  it('rejeita modo inválido', () => {
    const data = { modulo_id: 'M3', novo_modo: 'presencial', justificativa: 'Justificativa ok' };
    expect(onboardingAjusteSchema.safeParse(data).success).toBe(false);
  });

  it('rejeita justificativa curta (<10 chars)', () => {
    const data = { modulo_id: 'M3', novo_modo: 'online', justificativa: 'curto' };
    expect(onboardingAjusteSchema.safeParse(data).success).toBe(false);
  });
});
