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
// QUESTIONARIO DE QUALIFICACAO (20 perguntas)
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
    campo: 'ferramentas',
    texto: 'Quais ferramentas o time usa hoje?',
    tipo: 'multiselect',
    opcoes: [
      { value: 'photoshop', label: 'Photoshop' },
      { value: 'illustrator', label: 'Illustrator' },
      { value: 'figma', label: 'Figma' },
      { value: 'after_effects', label: 'After Effects' },
      { value: 'premiere', label: 'Premiere' },
      { value: 'canva', label: 'Canva' },
      { value: 'outras_ias', label: 'Outras IAs' },
      { value: 'nenhuma', label: 'Nenhuma' }
    ]
  },
  {
    id: 'q3',
    campo: 'maior_desafio',
    texto: 'Qual é o maior desafio hoje?',
    tipo: 'select',
    opcoes: [
      { value: 'desdobrar_formatos', label: 'Desdobrar formatos' },
      { value: 'velocidade', label: 'Velocidade de criação' },
      { value: 'produzir_videos', label: 'Produzir vídeos' },
      { value: 'organizar_materiais', label: 'Organizar materiais' },
      { value: 'analisar_performance', label: 'Analisar performance' }
    ]
  },
  {
    id: 'q4',
    campo: 'materiais',
    texto: 'Que tipos de material produzem?',
    tipo: 'multiselect',
    opcoes: [
      { value: 'posts_social', label: 'Posts social' },
      { value: 'banners_display', label: 'Banners display' },
      { value: 'video_curto', label: 'Vídeo curto' },
      { value: 'video_longo', label: 'Vídeo longo' },
      { value: 'html5', label: 'HTML5' },
      { value: 'catalogo_produtos', label: 'Catálogo produtos' }
    ]
  },
  {
    id: 'q5',
    campo: 'formatos_campanha',
    texto: 'Quantos formatos por campanha?',
    tipo: 'select',
    opcoes: [
      { value: '1_5', label: '1-5' },
      { value: '6_15', label: '6-15' },
      { value: '15+', label: '15+' }
    ]
  },
  {
    id: 'q6',
    campo: 'catalogo',
    texto: 'Trabalham com catálogo de produtos?',
    tipo: 'select',
    opcoes: [
      { value: 'merchant_center', label: 'Sim com Merchant Center' },
      { value: 'planilha', label: 'Sim com planilha' },
      { value: 'nao', label: 'Não' }
    ]
  },
  {
    id: 'q7',
    campo: 'video',
    texto: 'Produzem vídeos/motion?',
    tipo: 'select',
    opcoes: [
      { value: 'frequentemente', label: 'Sim frequentemente' },
      { value: 'ocasionalmente', label: 'Sim ocasionalmente' },
      { value: 'nao_mas_quer', label: 'Não mas quer' },
      { value: 'nao', label: 'Não' }
    ]
  },
  {
    id: 'q8',
    campo: 'pessoa_video',
    texto: 'Têm pessoa dedicada a vídeo?',
    tipo: 'select',
    opcoes: [
      { value: 'dedicada', label: 'Sim dedicada' },
      { value: 'basico', label: 'Sim básico' },
      { value: 'nao', label: 'Não' }
    ]
  },
  {
    id: 'q9',
    campo: 'html5',
    texto: 'Precisam de HTML5?',
    tipo: 'select',
    opcoes: [
      { value: 'sim', label: 'Sim' },
      { value: 'talvez', label: 'Talvez' },
      { value: 'nao', label: 'Não' }
    ]
  },
  {
    id: 'q10',
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
    id: 'q11',
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
    id: 'q12',
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
    id: 'q13',
    campo: 'publicam',
    texto: 'Onde publicam campanhas?',
    tipo: 'multiselect',
    opcoes: [
      { value: 'google_ads', label: 'Google Ads' },
      { value: 'cm360', label: 'CM360' },
      { value: 'youtube', label: 'YouTube' },
      { value: 'meta', label: 'Meta' },
      { value: 'download_manual', label: 'Download manual' }
    ]
  },
  {
    id: 'q14',
    campo: 'analytics',
    texto: 'Acompanham performance criativa?',
    tipo: 'select',
    opcoes: [
      { value: 'avancado', label: 'Sim avançado' },
      { value: 'basico', label: 'Sim básico' },
      { value: 'quer_comecar', label: 'Quer começar' },
      { value: 'nao', label: 'Não' }
    ]
  },
  {
    id: 'q15',
    campo: 'campanhas_rodando',
    texto: 'Têm campanhas rodando para analisar?',
    tipo: 'select',
    opcoes: [
      { value: 'sim', label: 'Sim' },
      { value: 'nao', label: 'Não' }
    ]
  },
  {
    id: 'q16',
    campo: '3d',
    texto: 'Interesse em 3D e efeitos?',
    tipo: 'select',
    opcoes: [
      { value: 'sim_muito', label: 'Sim muito' },
      { value: 'sim_pouco', label: 'Sim pouco' },
      { value: 'nao', label: 'Não' }
    ]
  },
  {
    id: 'q17',
    campo: 'nomenclatura',
    texto: 'Precisam de nomenclatura padronizada?',
    tipo: 'select',
    opcoes: [
      { value: 'critico', label: 'Crítico' },
      { value: 'importante', label: 'Importante' },
      { value: 'nao', label: 'Não' }
    ]
  },
  {
    id: 'q18',
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
  },
  {
    id: 'q19',
    campo: 'kv_disponivel',
    texto: 'Têm KV para usar no treinamento?',
    tipo: 'select',
    opcoes: [
      { value: 'sim_atual', label: 'Sim atual' },
      { value: 'sim_anterior', label: 'Sim anterior' },
      { value: 'nao', label: 'Não' }
    ]
  },
  {
    id: 'q20',
    campo: 'participantes',
    texto: 'Quem vai participar do treinamento?',
    tipo: 'text'
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
    return publicam.includes('google_ads') || publicam.includes('cm360') || r.catalogo === 'merchant_center';
  },
  M4: (r) => ['principal', 'complemento'].includes(r.uso_ia),
  M5: (r) => {
    const iaAlto = ['principal', 'complemento'].includes(r.uso_ia);
    return r.consistencia_marca === 'critico' && iaAlto;
  },
  M6: (r) => {
    const iaAlto = ['principal', 'complemento'].includes(r.uso_ia);
    return r.video_ia === 'sim_muito' && (r.video !== 'nao' || iaAlto);
  },
  M7: (r) => r.video === 'frequentemente' && r.pessoa_video === 'dedicada',
  M8: (r) => {
    const materiais = r.materiais || [];
    return r.html5 === 'sim' || (r.pessoa_video === 'dedicada' && materiais.includes('video_longo'));
  },
  M9: (r) => r['3d'] === 'sim_muito',
  M10: (r) => ['avancado', 'basico'].includes(r.analytics) && r.campanhas_rodando === 'sim',
  M11: (r) => r.nomenclatura === 'critico' || ['11_20', '20+'].includes(r.qtd_pessoas)
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
    } else if (p.tipo === 'text') {
      respostas[p.campo] = '';
    } else {
      respostas[p.campo] = '';
    }
  }
  return respostas;
}
