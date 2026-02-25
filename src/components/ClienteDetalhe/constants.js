// Shared constants and utility functions for ClienteDetalhe components

export const TIPOS_CONTATO = [
  { value: 'decisor', label: 'Decisor', color: '#8b5cf6' },
  { value: 'operacional', label: 'Operacional', color: '#06b6d4' },
  { value: 'financeiro', label: 'Financeiro', color: '#10b981' },
  { value: 'tecnico', label: 'Técnico', color: '#f59e0b' },
  { value: 'time_google', label: 'Time Google', color: '#3b82f6' },
  { value: 'outro', label: 'Outro', color: '#64748b' }
];

export const TAGS_OBSERVACAO = [
  { value: 'roadmap', label: 'Roadmap', color: '#8b5cf6', description: 'Aguardando feature do roadmap' },
  { value: 'sazonalidade', label: 'Sazonalidade', color: '#3b82f6', description: 'Baixo uso devido a sazonalidade' },
  { value: 'champion_saiu', label: 'Champion Saiu', color: '#ef4444', description: 'Contato principal deixou a empresa' },
  { value: 'reestruturacao', label: 'Reestruturação', color: '#f97316', description: 'Cliente em reestruturação interna' },
  { value: 'concorrencia', label: 'Concorrência', color: '#dc2626', description: 'Avaliando concorrentes' },
  { value: 'expansao', label: 'Expansão', color: '#10b981', description: 'Potencial de expansão/upsell' },
  { value: 'treinamento', label: 'Treinamento', color: '#06b6d4', description: 'Precisa de treinamento adicional' },
  { value: 'integracao', label: 'Integração', color: '#a855f7', description: 'Problemas ou demandas de integração' },
];

export const TIPOS_INTERACAO = [
  { value: 'email', label: 'Email', color: '#06b6d4' },
  { value: 'reuniao', label: 'Reunião', color: '#a855f7' },
  { value: 'observacao', label: 'Observação', color: '#10b981' },
  { value: 'alerta', label: 'Alerta', color: '#ef4444' },
  { value: 'onboarding', label: 'Onboarding', color: '#8b5cf6' },
  { value: 'feedback', label: 'Feedback', color: '#3b82f6' },
  { value: 'suporte', label: 'Suporte', color: '#f59e0b' },
  { value: 'treinamento', label: 'Treinamento', color: '#10b981' },
  { value: 'qbr', label: 'QBR', color: '#f97316' },
  { value: 'transicao_nivel', label: 'Transição', color: '#f97316' },
  { value: 'outro', label: 'Outro', color: '#64748b' }
];

export const SAUDE_COLORS = {
  CRESCIMENTO: '#10b981',
  ESTAVEL: '#3b82f6',
  ALERTA: '#f59e0b',
  RESGATE: '#ef4444'
};

export const TAGS_PREDEFINIDAS = ['Problema Ativo', 'Bug Reportado', 'Insatisfeito', 'Risco de Churn', 'Aguardando Resolução'];

// Extrair iniciais do nome (ex: "Marina Barros" -> "MB")
export const getInitials = (name) => {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

// Decodificar HTML entities e limpar conteudo de mensagem
export const cleanMessageContent = (text) => {
  if (!text) return 'Sem conteúdo';

  // Decodificar HTML entities
  let cleaned = text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");

  // 1. Remover blocos do Microsoft Teams (reunioes)
  const teamsPatterns = [
    /_{3,}[\s\S]*?Reunião do Microsoft Teams[\s\S]*/i,
    /_{3,}[\s\S]*?Microsoft Teams meeting[\s\S]*/i,
    /Reunião do Microsoft Teams[\s\S]*?(Saiba mais|Learn more)[\s\S]*/i,
    /Microsoft Teams meeting[\s\S]*?(Saiba mais|Learn more)[\s\S]*/i,
    /Participe pelo computador[\s\S]*$/i,
    /Join on your computer[\s\S]*$/i,
    /https:\/\/teams\.microsoft\.com\/l\/meetup-join[\s\S]*/i,
    /ID da reunião:[\s\S]*$/i,
    /Meeting ID:[\s\S]*$/i,
  ];

  for (const pattern of teamsPatterns) {
    cleaned = cleaned.replace(pattern, '').trim();
  }

  // 2. Remover citacoes de mensagens anteriores (quoted replies)
  const quotedPatterns = [
    /On .+wrote:[\s\S]*$/i,
    /Em .+escreveu:[\s\S]*$/i,
    /^>+.*$/gm,
    /De:.*\nEnviado:.*\nPara:.*\nAssunto:[\s\S]*/i,
    /From:.*\nSent:.*\nTo:.*\nSubject:[\s\S]*/i,
    /-----\s*Original Message\s*-----[\s\S]*/i,
    /-----\s*Mensagem Original\s*-----[\s\S]*/i,
    /---------- Forwarded message ---------[\s\S]*/i,
    /---------- Mensagem encaminhada ---------[\s\S]*/i,
  ];

  for (const pattern of quotedPatterns) {
    cleaned = cleaned.replace(pattern, '').trim();
  }

  // 3. Remover separadores visuais no final
  const separatorPatterns = [
    /_{10,}[\s\S]*$/,
    /-{10,}[\s\S]*$/,
    /={10,}[\s\S]*$/,
    /\*{10,}[\s\S]*$/,
  ];

  for (const pattern of separatorPatterns) {
    cleaned = cleaned.replace(pattern, '').trim();
  }

  // 4. Remover padroes de assinatura comuns
  const signaturePatterns = [
    /--\s*\n[\s\S]*$/,
    /Enviado do meu (iPhone|Android|iPad)[\s\S]*/i,
    /Sent from my (iPhone|Android|iPad)[\s\S]*/i,
    /Enviado pelo Outlook[\s\S]*/i,
    /Sent from Outlook[\s\S]*/i,
    /Get Outlook for [\s\S]*/i,
    /Obter o Outlook para [\s\S]*/i,
    /Atenciosamente,[\s\S]*$/i,
    /Att,[\s\S]*$/i,
    /Abraços?,[\s\S]*$/i,
    /Best regards,[\s\S]*$/i,
    /Kind regards,[\s\S]*$/i,
    /Regards,[\s\S]*$/i,
    /Cordialmente,[\s\S]*$/i,
    /Canal de Ética[\s\S]*$/i,
    /Av\.Industrial[\s\S]*$/i,
    /CEP \d{5}-?\d{3}[\s\S]*$/i,
    /\+55\s*\(?\d{2}\)?\s*\d{4,5}-?\d{4}[\s\S]*$/i,
  ];

  for (const pattern of signaturePatterns) {
    cleaned = cleaned.replace(pattern, '').trim();
  }

  // 5. Limpar espacos extras e linhas em branco multiplas
  cleaned = cleaned
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .trim();

  return cleaned || 'Sem conteúdo';
};

export const getStatusColor = (status) => {
  const colors = { ativo: '#8b5cf6', aguardando_cliente: '#f59e0b', aguardando_equipe: '#06b6d4', resolvido: '#10b981', inativo: '#64748b' };
  return colors[status] || '#64748b';
};

export const getStatusLabel = (status) => {
  const labels = { ativo: 'Ativo', aguardando_cliente: 'Aguardando Cliente', aguardando_equipe: 'Aguardando Equipe', resolvido: 'Resolvido', inativo: 'Inativo' };
  return labels[status] || status;
};

export const formatDate = (timestamp) => {
  if (!timestamp) return 'Sem data';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const formatSimpleDate = (timestamp) => {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : (timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp));
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const getUserStatusColor = (user) => {
  if (user.deleted_at) return '#ef4444';
  if (user.status === 'ativo' || user.status === 'active') return '#10b981';
  if (user.status === 'inativo' || user.status === 'inactive') return '#64748b';
  return '#10b981';
};

export const getUserStatusLabel = (user) => {
  if (user.deleted_at) return 'Excluído';
  if (user.status === 'ativo' || user.status === 'active') return 'Ativo';
  if (user.status === 'inativo' || user.status === 'inactive') return 'Inativo';
  return 'Ativo';
};
