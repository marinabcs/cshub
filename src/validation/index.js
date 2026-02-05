import { z } from 'zod';

// Mapa de erros em português
const customErrorMap = (issue, ctx) => {
  if (issue.code === z.ZodIssueCode.invalid_type) {
    if (issue.expected === 'string') return { message: 'Campo obrigatório' };
    if (issue.expected === 'number') return { message: 'Deve ser um número' };
    if (issue.expected === 'boolean') return { message: 'Campo obrigatório' };
  }
  if (issue.code === z.ZodIssueCode.too_small) {
    if (issue.type === 'string') {
      if (issue.minimum === 1) return { message: 'Campo obrigatório' };
      return { message: `Mínimo ${issue.minimum} caracteres` };
    }
    if (issue.type === 'number') return { message: `Deve ser no mínimo ${issue.minimum}` };
    if (issue.type === 'array') return { message: `Selecione ao menos ${issue.minimum} item(ns)` };
  }
  if (issue.code === z.ZodIssueCode.too_big) {
    if (issue.type === 'string') return { message: `Máximo ${issue.maximum} caracteres` };
    if (issue.type === 'number') return { message: `Deve ser no máximo ${issue.maximum}` };
  }
  if (issue.code === z.ZodIssueCode.invalid_string) {
    if (issue.validation === 'email') return { message: 'Email inválido' };
    if (issue.validation === 'url') return { message: 'URL inválida' };
  }
  if (issue.code === z.ZodIssueCode.invalid_enum_value) {
    return { message: 'Valor inválido' };
  }
  return { message: ctx?.defaultError || 'Valor inválido' };
};

z.setErrorMap(customErrorMap);

/**
 * Valida dados contra um schema Zod.
 * @returns null se válido, ou { campo: 'mensagem de erro' }
 */
export function validateForm(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return null;

  const errors = {};
  result.error.issues.forEach(issue => {
    const path = issue.path.join('.');
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  });
  return errors;
}

export { z };
export { clienteSchema, stakeholderSchema } from './cliente';
export { playbookSchema } from './playbook';
export { documentoSchema, observacaoSchema, interacaoSchema } from './documento';
export { classificacaoManualSchema } from './thread';
export { configGeralSchema, configAlertasSchema, configEmailFiltersSchema, configSlaSchema } from './configuracoes';
export { alertaEditSchema } from './alerta';
export { usuarioCreateSchema, usuarioEditSchema } from './usuario';
export { onboardingRespostasSchema, onboardingAjusteSchema } from './onboarding';
