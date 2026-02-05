/**
 * Constantes da Calculadora de Onboarding
 *
 * 11 Modulos da plataforma Trakto, 20 perguntas de qualificacao,
 * regras de classificacao (ao_vivo vs online) e first values.
 */

// ============================================
// MODULOS DA PLATAFORMA
// ============================================

export const MODULOS = {
  M1: {
    id: 'M1',
    nome: 'Editor Básico',
    descricao: 'Importação (PSD/Figma/AI), layers, réguas, Brand Kit',
    tempoAoVivo: 45,
    tempoOnline: 30,
    locked: true,
    prereqs: [],
    firstValue: 'Importou arquivo real (PSD/Figma/AI) e editou na plataforma'
  },
  M2: {
    id: 'M2',
    nome: 'Variáveis e Escala',
    descricao: 'Marcar variáveis, formulário, CSV, gerar em escala',
    tempoAoVivo: 60,
    tempoOnline: 45,
    locked: true,
    prereqs: ['M1'],
    firstValue: 'Gerou 10+ variações de um KV real usando dados próprios'
  },
  M3: {
    id: 'M3',
    nome: 'Integrações Google',
    descricao: 'Merchant Center, Google Ads, CM360, YouTube',
    tempoAoVivo: 45,
    tempoOnline: 30,
    locked: false,
    prereqs: ['M2'],
    firstValue: 'Publicou peças diretamente no Google Ads ou CM360'
  },
  M4: {
    id: 'M4',
    nome: 'IA Imagem',
    descricao: 'Nana Banana Pro, 300+ estilos, criar/editar por prompt',
    tempoAoVivo: 30,
    tempoOnline: 20,
    locked: false,
    prereqs: ['M1'],
    firstValue: 'Criou imagem com IA para uma campanha real'
  },
  M5: {
    id: 'M5',
    nome: 'IA Diretor',
    descricao: 'Modo Diretor, storyboard, consistência de marca',
    tempoAoVivo: 45,
    tempoOnline: 30,
    locked: false,
    prereqs: ['M4'],
    firstValue: 'Criou storyboard completo de campanha com consistência de marca'
  },
  M6: {
    id: 'M6',
    nome: 'IA Vídeo',
    descricao: 'V2, V3 com áudio, Viefex, efeitos 9x16',
    tempoAoVivo: 30,
    tempoOnline: 25,
    locked: false,
    prereqs: ['M4'],
    firstValue: 'Criou vídeo com IA para campanha'
  },
  M7: {
    id: 'M7',
    nome: 'Motion Básico',
    descricao: 'Animar elementos, trilha, transições, exportar vídeo',
    tempoAoVivo: 45,
    tempoOnline: 35,
    locked: false,
    prereqs: ['M1'],
    firstValue: 'Animou uma peça estática e exportou como vídeo'
  },
  M8: {
    id: 'M8',
    nome: 'Motion Avançado',
    descricao: 'Timeline completa, keyframes, curvas, HTML5',
    tempoAoVivo: 60,
    tempoOnline: 45,
    locked: false,
    prereqs: ['M7'],
    firstValue: 'Criou banner HTML5 ou vídeo completo com timeline'
  },
  M9: {
    id: 'M9',
    nome: '3D e Efeitos',
    descricao: 'Magic Brush, Shaders, vetor para 3D, Drawing Tool',
    tempoAoVivo: 45,
    tempoOnline: 35,
    locked: false,
    prereqs: ['M1'],
    firstValue: 'Criou elemento 3D ou aplicou shader em peça de campanha'
  },
  M10: {
    id: 'M10',
    nome: 'Analytics',
    descricao: 'Performance criativa, comparativo, análise com IA, ABCD',
    tempoAoVivo: 45,
    tempoOnline: 30,
    locked: false,
    prereqs: [],
    firstValue: 'Analisou campanha real e extraiu insights acionáveis'
  },
  M11: {
    id: 'M11',
    nome: 'Biblioteca',
    descricao: 'Pastas, nomenclatura em lote, organização',
    tempoAoVivo: 30,
    tempoOnline: 20,
    locked: false,
    prereqs: ['M1'],
    firstValue: 'Organizou campanha completa com nomenclatura padronizada'
  }
};

export const MODULOS_ORDEM = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11'];

// Grupos de afinidade para montagem de sessoes
export const SESSION_GROUPS = [
  ['M1', 'M2'],
  ['M4', 'M5', 'M6'],
  ['M7', 'M9'],
  ['M8'],
  ['M3'],
  ['M10', 'M11']
];

export const MAX_SESSION_MINUTES = 90;

// ============================================
// QUESTIONARIO DE QUALIFICACAO (10 perguntas)
// ============================================

export const PERGUNTAS = [
  {
    id: 'q1',
    campo: 'qtd_pessoas',
    texto: 'Quantas pessoas vão usar a plataforma?',
    tipo: 'select',
    opcoes: [
      { value: '1_3', label: '1-3' },
      { value: '4_10', label: '4-10' },
      { value: '11_20', label: '11-20' },
      { value: '20+', label: '20+' }
    ]
  },
  {
    id: 'q2',
    campo: 'materiais',
    texto: 'Que tipos de material produzem?',
    tipo: 'multiselect',
    campoOutro: 'materiais_outro',
    opcoes: [
      { value: 'posts_social', label: 'Posts social' },
      { value: 'banners_display', label: 'Banners display' },
      { value: 'video_curto', label: 'Vídeo curto' },
      { value: 'video_longo', label: 'Vídeo longo' },
      { value: 'html5', label: 'HTML5' },
      { value: 'catalogo_produtos', label: 'Catálogo produtos' },
      { value: 'outro', label: 'Outro' }
    ]
  },
  {
    id: 'q3',
    campo: 'video_producao',
    texto: 'Como é a produção de vídeo/motion no time?',
    tipo: 'select',
    opcoes: [
      { value: 'dedicada_frequente', label: 'Time dedicado, produz frequentemente' },
      { value: 'basico_frequente', label: 'Produz frequentemente, sem pessoa dedicada' },
      { value: 'ocasional', label: 'Produz ocasionalmente' },
      { value: 'quer_comecar', label: 'Não produz mas quer começar' },
      { value: 'nao', label: 'Não produz e não planeja' }
    ]
  },
  {
    id: 'q4',
    campo: 'uso_ia',
    texto: 'Como veem o uso de IA na criação?',
    tipo: 'select',
    opcoes: [
      { value: 'principal', label: 'Ferramenta principal' },
      { value: 'complemento', label: 'Complemento' },
      { value: 'curioso', label: 'Curioso' },
      { value: 'nao_quer', label: 'Não quer usar' }
    ]
  },
  {
    id: 'q5',
    campo: 'video_ia',
    texto: 'Interesse em criar vídeos com IA?',
    tipo: 'select',
    opcoes: [
      { value: 'sim_muito', label: 'Sim muito' },
      { value: 'talvez', label: 'Talvez' },
      { value: 'nao', label: 'Não' }
    ]
  },
  {
    id: 'q6',
    campo: 'consistencia_marca',
    texto: 'Consistência de marca com IA é importante?',
    tipo: 'select',
    opcoes: [
      { value: 'critico', label: 'Crítico' },
      { value: 'importante', label: 'Importante' },
      { value: 'nao', label: 'Não' }
    ]
  },
  {
    id: 'q7',
    campo: 'publicam',
    texto: 'Onde e como publicam campanhas?',
    tipo: 'multiselect',
    campoOutro: 'publicam_outro',
    opcoes: [
      { value: 'google_ads', label: 'Google Ads' },
      { value: 'cm360', label: 'CM360' },
      { value: 'youtube', label: 'YouTube' },
      { value: 'meta', label: 'Meta' },
      { value: 'merchant_center', label: 'Merchant Center' },
      { value: 'download_manual', label: 'Download manual' },
      { value: 'outro', label: 'Outro' }
    ]
  },
  {
    id: 'q8',
    campo: 'analytics_performance',
    texto: 'Acompanham performance criativa das campanhas?',
    tipo: 'select',
    opcoes: [
      { value: 'sim_campanhas', label: 'Sim, com campanhas rodando' },
      { value: 'sim_sem_campanhas', label: 'Sim, sem campanhas no momento' },
      { value: 'quer_comecar', label: 'Quer começar' },
      { value: 'nao', label: 'Não' }
    ]
  },
  {
    id: 'q9',
    campo: 'extras',
    texto: 'Quais recursos extras interessam ao time?',
    tipo: 'multiselect',
    campoOutro: 'extras_outro',
    opcoes: [
      { value: '3d', label: '3D e Efeitos' },
      { value: 'nomenclatura', label: 'Nomenclatura padronizada' },
      { value: 'outro', label: 'Outro' }
    ]
  },
  {
    id: 'q10',
    campo: 'urgencia',
    texto: 'Quando precisam usar para campanha real?',
    tipo: 'select',
    opcoes: [
      { value: 'esta_semana', label: 'Esta semana' },
      { value: 'proxima_semana', label: 'Próxima semana' },
      { value: '2_semanas', label: '2 semanas' },
      { value: 'mes', label: 'Mês' },
      { value: 'sem_pressa', label: 'Sem pressa' }
    ]
  }
];

// ============================================
// REGRAS DE CLASSIFICACAO (ao_vivo vs online)
// ============================================
// M1 e M2 sao SEMPRE ao_vivo (locked:true)
// Para os demais: se a funcao retornar true => ao_vivo, senao => online

export const REGRAS = {
  M3: (r) => {
    const publicam = r.publicam || [];
    return publicam.includes('google_ads') || publicam.includes('cm360') || publicam.includes('merchant_center');
  },
  M4: (r) => ['principal', 'complemento'].includes(r.uso_ia),
  M5: (r) => {
    const iaAlto = ['principal', 'complemento'].includes(r.uso_ia);
    return r.consistencia_marca === 'critico' && iaAlto;
  },
  M6: (r) => {
    const iaAlto = ['principal', 'complemento'].includes(r.uso_ia);
    return r.video_ia === 'sim_muito' && (r.video_producao !== 'nao' || iaAlto);
  },
  M7: (r) => r.video_producao === 'dedicada_frequente',
  M8: (r) => {
    const materiais = r.materiais || [];
    return materiais.includes('html5') || (r.video_producao === 'dedicada_frequente' && materiais.includes('video_longo'));
  },
  M9: (r) => (r.extras || []).includes('3d'),
  M10: (r) => r.analytics_performance === 'sim_campanhas',
  M11: (r) => (r.extras || []).includes('nomenclatura') || ['11_20', '20+'].includes(r.qtd_pessoas)
};

// ============================================
// URGENCIA
// ============================================

export const URGENCIA_MAP = {
  esta_semana: { sessoesPorSemana: 2, label: '2x por semana' },
  proxima_semana: { sessoesPorSemana: 2, label: '2x por semana' },
  '2_semanas': { sessoesPorSemana: 1, label: '1x por semana' },
  mes: { sessoesPorSemana: 1, label: '1x por semana' },
  sem_pressa: { sessoesPorSemana: 1, label: '1x por semana' }
};

// ============================================
// STATUS
// ============================================

export const PLANO_STATUS = {
  em_andamento: { label: 'Em Andamento', color: '#8b5cf6' },
  concluido: { label: 'Concluído', color: '#10b981' },
  cancelado: { label: 'Cancelado', color: '#64748b' }
};

export const SESSAO_STATUS = {
  agendada: { label: 'Agendada', color: '#3b82f6' },
  concluida: { label: 'Concluída', color: '#10b981' },
  remarcada: { label: 'Remarcada', color: '#f59e0b' },
  cancelada: { label: 'Cancelada', color: '#64748b' }
};

// Respostas iniciais vazias (para estado do formulario)
export function getRespostasIniciais() {
  const respostas = {};
  for (const p of PERGUNTAS) {
    if (p.tipo === 'multiselect') {
      respostas[p.campo] = [];
      if (p.campoOutro) respostas[p.campoOutro] = '';
    } else if (p.tipo === 'text') {
      respostas[p.campo] = '';
    } else {
      respostas[p.campo] = '';
    }
  }
  return respostas;
}
