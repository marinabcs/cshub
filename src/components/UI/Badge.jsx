export function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'bg-dark-700 text-dark-300 border-dark-600',
    success: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    danger: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    info: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    primary: 'bg-primary-500/20 text-primary-400 border-primary-500/30'
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${variants[variant]} ${className}`}
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
    positivo: { emoji: '😊', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30' },
    neutro: { emoji: '😐', bg: 'bg-dark-700', border: 'border-dark-600' },
    negativo: { emoji: '😟', bg: 'bg-red-500/20', border: 'border-red-500/30' },
    urgente: { emoji: '🚨', bg: 'bg-red-500/20', border: 'border-red-500/30 animate-pulse' }
  }

  const { emoji, bg, border } = config[sentiment] || config.neutro

  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-base ${bg} border ${border}`}>
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
