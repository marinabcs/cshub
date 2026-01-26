import { format, formatDistanceToNow, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatDate(date) {
  if (!date) return '-'
  const d = date instanceof Date ? date : new Date(date)
  if (!isValid(d)) return '-'
  return format(d, "dd/MM/yyyy", { locale: ptBR })
}

export function formatDateTime(date) {
  if (!date) return '-'
  const d = date instanceof Date ? date : new Date(date)
  if (!isValid(d)) return '-'
  return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

export function formatRelativeTime(date) {
  if (!date) return '-'
  const d = date instanceof Date ? date : new Date(date)
  if (!isValid(d)) return '-'
  return formatDistanceToNow(d, { locale: ptBR, addSuffix: true })
}

export function getHealthColor(score) {
  if (score >= 80) return 'green'
  if (score >= 60) return 'yellow'
  if (score >= 40) return 'orange'
  return 'red'
}

export function getHealthStatus(score) {
  if (score >= 80) return 'saudavel'
  if (score >= 60) return 'atencao'
  if (score >= 40) return 'risco'
  return 'critico'
}

export function getStatusLabel(status) {
  const labels = {
    saudavel: 'Saudável',
    atencao: 'Atenção',
    risco: 'Risco',
    critico: 'Crítico'
  }
  return labels[status] || status
}

export function getTeamTypeLabel(type) {
  const labels = {
    'Vendas B2B': 'Vendas B2B',
    'BR LCS': 'BR LCS',
    'BR MMS': 'BR MMS',
    'SPLA LCS': 'SPLA LCS',
    'SPLA MMS': 'SPLA MMS',
    'CA LCS': 'CA LCS'
  }
  return labels[type] || type
}

export function getCategoriaLabel(categoria) {
  const labels = {
    erro_bug: 'Erro/Bug',
    problema_tecnico: 'Problema Técnico',
    feedback: 'Feedback',
    duvida_pergunta: 'Dúvida',
    solicitacao: 'Solicitação',
    outro: 'Outro'
  }
  return labels[categoria] || categoria
}

export function getThreadStatusLabel(status) {
  const labels = {
    ativo: 'Ativo',
    aguardando_cliente: 'Aguardando Cliente',
    aguardando_equipe: 'Aguardando Equipe',
    resolvido: 'Resolvido',
    inativo: 'Inativo'
  }
  return labels[status] || status
}

export function getSentimentEmoji(sentiment) {
  const emojis = {
    positivo: '😊',
    neutro: '😐',
    negativo: '😟',
    urgente: '🚨'
  }
  return emojis[sentiment] || '😐'
}

export function truncateText(text, maxLength = 100) {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

export function getInitials(name) {
  if (!name) return '?'
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2)
}
