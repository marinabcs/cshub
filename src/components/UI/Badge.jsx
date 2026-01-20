export function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-emerald-100 text-emerald-800',
    warning: 'bg-amber-100 text-amber-800',
    danger: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800',
    info: 'bg-cyan-100 text-cyan-800',
    primary: 'bg-primary-100 text-primary-800'
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  )
}

export function StatusBadge({ status }) {
  const config = {
    saudavel: { variant: 'success', label: 'Saudável' },
    atencao: { variant: 'warning', label: 'Atenção' },
    risco: { variant: 'danger', label: 'Risco' },
    critico: { variant: 'critical', label: 'Crítico' }
  }

  const { variant, label } = config[status] || { variant: 'default', label: status }

  return <Badge variant={variant}>{label}</Badge>
}

export function SentimentBadge({ sentiment }) {
  const config = {
    positivo: { emoji: '😊', color: 'bg-emerald-100 text-emerald-800' },
    neutro: { emoji: '😐', color: 'bg-gray-100 text-gray-800' },
    negativo: { emoji: '😟', color: 'bg-red-100 text-red-800' },
    urgente: { emoji: '🚨', color: 'bg-red-100 text-red-800 animate-pulse' }
  }

  const { emoji, color } = config[sentiment] || config.neutro

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-sm ${color}`}>
      {emoji}
    </span>
  )
}

export function ThreadStatusBadge({ status }) {
  const config = {
    ativo: { variant: 'info', label: 'Ativo' },
    aguardando_cliente: { variant: 'warning', label: 'Aguardando Cliente' },
    aguardando_equipe: { variant: 'danger', label: 'Aguardando Equipe' },
    resolvido: { variant: 'success', label: 'Resolvido' },
    inativo: { variant: 'default', label: 'Inativo' }
  }

  const { variant, label } = config[status] || { variant: 'default', label: status }

  return <Badge variant={variant}>{label}</Badge>
}

export function CategoriaBadge({ categoria }) {
  const config = {
    erro_bug: { variant: 'critical', label: 'Erro/Bug' },
    problema_tecnico: { variant: 'danger', label: 'Problema Técnico' },
    feedback: { variant: 'info', label: 'Feedback' },
    duvida_pergunta: { variant: 'primary', label: 'Dúvida' },
    solicitacao: { variant: 'warning', label: 'Solicitação' },
    outro: { variant: 'default', label: 'Outro' }
  }

  const { variant, label } = config[categoria] || { variant: 'default', label: categoria }

  return <Badge variant={variant}>{label}</Badge>
}
