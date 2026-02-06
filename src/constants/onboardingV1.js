/**
 * Onboarding v1.0 - Estrutura Simplificada
 *
 * 4 reuniões fixas com cadência de 7 dias:
 * - Kick off: Apresentação da plataforma, importação, Brand Kit
 * - Escala: Variáveis, formulário, CSV, geração em escala
 * - AI: IA Imagem, IA Diretor, IA Vídeo
 * - Motion: Animação, timeline, exportação
 *
 * Todos os clientes passam por todas as reuniões.
 */

// ============================================
// REUNIÕES DO ONBOARDING v1.0
// ============================================

export const REUNIOES_V1 = {
  kickoff: {
    id: 'kickoff',
    nome: 'Kick off',
    descricao: 'Apresentação da plataforma, importação de arquivos (PSD/Figma/AI), layers, réguas, Brand Kit',
    duracao: 60,
    ordem: 1,
    topicos: [
      'Visão geral da plataforma',
      'Importação de arquivos (PSD, Figma, AI)',
      'Navegação e interface',
      'Layers e organização',
      'Réguas e guias',
      'Configuração do Brand Kit'
    ],
    entregavel: 'Cliente consegue importar arquivo real e editar na plataforma'
  },
  escala: {
    id: 'escala',
    nome: 'Escala',
    descricao: 'Variáveis, formulário de dados, importação CSV, geração em escala de peças',
    duracao: 60,
    ordem: 2,
    topicos: [
      'Marcação de variáveis',
      'Formulário de entrada de dados',
      'Importação de CSV',
      'Geração em lote',
      'Exportação em escala',
      'Boas práticas de nomenclatura'
    ],
    entregavel: 'Cliente gera 10+ variações de um KV usando dados próprios'
  },
  ai: {
    id: 'ai',
    nome: 'AI',
    descricao: 'IA Imagem (Nana Banana Pro), IA Diretor (storyboard), IA Vídeo (V2/V3)',
    duracao: 60,
    ordem: 3,
    topicos: [
      'IA Imagem: criação por prompt',
      'IA Imagem: estilos e consistência',
      'IA Diretor: storyboard',
      'IA Diretor: consistência de marca',
      'IA Vídeo: V2 e V3',
      'IA Vídeo: efeitos e áudio'
    ],
    entregavel: 'Cliente cria imagem e vídeo com IA para campanha'
  },
  motion: {
    id: 'motion',
    nome: 'Motion',
    descricao: 'Animação de elementos, timeline, transições, trilha sonora, exportação de vídeo e HTML5',
    duracao: 60,
    ordem: 4,
    topicos: [
      'Animação de elementos',
      'Timeline e keyframes',
      'Transições e curvas',
      'Trilha sonora',
      'Exportação de vídeo',
      'Exportação HTML5'
    ],
    entregavel: 'Cliente anima peça e exporta como vídeo ou HTML5'
  }
};

export const REUNIOES_ORDEM = ['kickoff', 'escala', 'ai', 'motion'];

// ============================================
// CADÊNCIA PADRÃO
// ============================================

export const CADENCIA_DIAS = 7; // 7 dias entre cada reunião

// ============================================
// STATUS
// ============================================

export const PLANO_STATUS_V1 = {
  em_andamento: { label: 'Em Andamento', color: '#8b5cf6' },
  concluido: { label: 'Concluído', color: '#10b981' },
  cancelado: { label: 'Cancelado', color: '#64748b' }
};

export const REUNIAO_STATUS = {
  pendente: { label: 'Pendente', color: '#64748b' },
  agendada: { label: 'Agendada', color: '#3b82f6' },
  concluida: { label: 'Concluída', color: '#10b981' },
  nao_aplicada: { label: 'Não Aplicada', color: '#f59e0b' },
  remarcada: { label: 'Remarcada', color: '#f59e0b' },
  cancelada: { label: 'Cancelada', color: '#ef4444' }
};

// ============================================
// HELPERS
// ============================================

/**
 * Converte string YYYY-MM-DD para Date local (evita problema de timezone)
 */
function parseLocalDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Formata Date para string YYYY-MM-DD
 */
function formatToDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gera o cronograma de reuniões a partir de uma data de início
 * @param {string} dataInicio - Data de início (YYYY-MM-DD)
 * @returns {Array} Lista de reuniões com datas sugeridas
 */
export function gerarCronograma(dataInicio) {
  const inicio = parseLocalDate(dataInicio);

  return REUNIOES_ORDEM.map((id, index) => {
    const reuniao = REUNIOES_V1[id];
    const dataSugerida = new Date(inicio);
    dataSugerida.setDate(inicio.getDate() + (index * CADENCIA_DIAS));

    // Ajustar para dia útil (se cair no fim de semana, move para segunda)
    const diaSemana = dataSugerida.getDay();
    if (diaSemana === 0) dataSugerida.setDate(dataSugerida.getDate() + 1); // Domingo -> Segunda
    if (diaSemana === 6) dataSugerida.setDate(dataSugerida.getDate() + 2); // Sábado -> Segunda

    return {
      ...reuniao,
      numero: index + 1,
      data_sugerida: formatToDateString(dataSugerida),
      status: 'pendente'
    };
  });
}

/**
 * Calcula a duração total do onboarding
 * @returns {Object} { totalMinutos, totalReunioes, semanas }
 */
export function calcularDuracaoTotal() {
  const totalMinutos = REUNIOES_ORDEM.reduce((acc, id) => acc + REUNIOES_V1[id].duracao, 0);
  const totalReunioes = REUNIOES_ORDEM.length;
  const semanas = Math.ceil((totalReunioes - 1) * CADENCIA_DIAS / 7) + 1;

  return { totalMinutos, totalReunioes, semanas };
}
