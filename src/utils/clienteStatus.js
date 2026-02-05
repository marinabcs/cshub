// Status do cliente - ciclo de vida
export const CLIENTE_STATUS = {
  ativo: {
    value: 'ativo',
    label: 'Ativo',
    description: 'Cliente em operação normal',
    color: '#10b981', // verde
  },
  aviso_previo: {
    value: 'aviso_previo',
    label: 'Em Aviso Prévio',
    description: 'Cliente sinalizou que vai cancelar',
    color: '#f97316', // laranja
  },
  inativo: {
    value: 'inativo',
    label: 'Inativo',
    description: 'Cliente pausou uso temporariamente',
    color: '#6b7280', // cinza
  },
  cancelado: {
    value: 'cancelado',
    label: 'Cancelado',
    description: 'Cliente cancelou contrato',
    color: '#ef4444', // vermelho
  },
};

// Lista ordenada de status para selects
export const STATUS_OPTIONS = [
  CLIENTE_STATUS.ativo,
  CLIENTE_STATUS.aviso_previo,
  CLIENTE_STATUS.inativo,
  CLIENTE_STATUS.cancelado,
];

// Status padrão para novos clientes
export const DEFAULT_STATUS = 'ativo';

// Status que devem ser exibidos por padrão (excluindo inativos e cancelados)
export const DEFAULT_VISIBLE_STATUS = ['ativo', 'aviso_previo'];

// Funções utilitárias
export function getStatusColor(status) {
  return CLIENTE_STATUS[status]?.color || '#6b7280';
}

export function getStatusLabel(status) {
  return CLIENTE_STATUS[status]?.label || 'Desconhecido';
}

export function getStatusDescription(status) {
  return CLIENTE_STATUS[status]?.description || '';
}
