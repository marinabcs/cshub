/**
 * Logica da Calculadora de Onboarding
 *
 * Funcoes puras (sem Firebase) para:
 * - Classificar modulos (ao_vivo vs online)
 * - Montar sessoes respeitando prereqs e tempo maximo
 * - Agendar sessoes com base na urgencia
 * - Calcular progresso e elegibilidade de handoff
 */

import {
  MODULOS, MODULOS_ORDEM, REGRAS, SESSION_GROUPS,
  MAX_SESSION_MINUTES, URGENCIA_MAP
} from '../constants/onboarding';

/**
 * Classifica cada modulo como 'ao_vivo' ou 'online'
 * com base nas respostas do questionario.
 *
 * M1 e M2 sao sempre 'ao_vivo' (locked).
 */
export function classifyModules(respostas) {
  const classificacao = {};

  for (const id of MODULOS_ORDEM) {
    const modulo = MODULOS[id];

    if (modulo.locked) {
      classificacao[id] = 'ao_vivo';
      continue;
    }

    const regra = REGRAS[id];
    if (regra && regra(respostas)) {
      classificacao[id] = 'ao_vivo';
    } else {
      classificacao[id] = 'online';
    }
  }

  return classificacao;
}

/**
 * Monta as sessoes ao vivo respeitando:
 * - Max 90 min por sessao (excecao M1+M2 = 105 min)
 * - Pre-requisitos (M5 depois de M4, M8 depois de M7, etc.)
 * - Agrupamento por afinidade
 */
export function buildSessions(classificacao) {
  // Sessao 1 sempre M1+M2
  const sessoes = [{
    numero: 1,
    modulos: ['M1', 'M2'],
    duracao: MODULOS.M1.tempoAoVivo + MODULOS.M2.tempoAoVivo // 105
  }];

  // Coletar modulos ao_vivo restantes (sem M1, M2)
  const aoVivoRestantes = MODULOS_ORDEM
    .filter(id => id !== 'M1' && id !== 'M2' && classificacao[id] === 'ao_vivo');

  if (aoVivoRestantes.length === 0) return sessoes;

  // Ordenar por grupos de afinidade + prereqs
  const ordered = orderByAffinity(aoVivoRestantes);

  // Agrupar em sessoes de max 90 min
  let sessaoAtual = { modulos: [], duracao: 0 };

  for (const id of ordered) {
    const tempo = MODULOS[id].tempoAoVivo;

    if (sessaoAtual.modulos.length > 0 && sessaoAtual.duracao + tempo > MAX_SESSION_MINUTES) {
      // Sessao cheia, salvar e comecar nova
      sessoes.push({
        numero: sessoes.length + 1,
        modulos: sessaoAtual.modulos,
        duracao: sessaoAtual.duracao
      });
      sessaoAtual = { modulos: [], duracao: 0 };
    }

    sessaoAtual.modulos.push(id);
    sessaoAtual.duracao += tempo;
  }

  // Salvar ultima sessao
  if (sessaoAtual.modulos.length > 0) {
    sessoes.push({
      numero: sessoes.length + 1,
      modulos: sessaoAtual.modulos,
      duracao: sessaoAtual.duracao
    });
  }

  return sessoes;
}

/**
 * Ordena modulos por afinidade de grupo e prereqs.
 * Garante que prereqs aparecem antes dos dependentes.
 */
function orderByAffinity(modulos) {
  const moduloSet = new Set(modulos);
  const ordered = [];
  const added = new Set();

  // Percorrer os grupos de afinidade em ordem
  for (const group of SESSION_GROUPS) {
    for (const id of group) {
      if (moduloSet.has(id) && !added.has(id)) {
        // Verificar se prereqs ja foram adicionados
        const prereqs = MODULOS[id].prereqs.filter(p => moduloSet.has(p));
        for (const p of prereqs) {
          if (!added.has(p)) {
            ordered.push(p);
            added.add(p);
          }
        }
        ordered.push(id);
        added.add(id);
      }
    }
  }

  // Adicionar qualquer modulo que nao estava em nenhum grupo
  for (const id of modulos) {
    if (!added.has(id)) {
      ordered.push(id);
      added.add(id);
    }
  }

  return ordered;
}

/**
 * Agenda datas sugeridas para cada sessao.
 * Pula fins de semana. Urgente = 2x/sem, normal = 1x/sem.
 */
export function scheduleSessions(sessoes, dataInicio, urgencia) {
  const freq = URGENCIA_MAP[urgencia] || URGENCIA_MAP.mes;
  const diasEntreSessoes = freq.sessoesPorSemana === 2 ? 3 : 7; // ~3 dias ou 7 dias

  let dataAtual = new Date(dataInicio);

  return sessoes.map((sessao, index) => {
    if (index > 0) {
      dataAtual = addBusinessDays(dataAtual, diasEntreSessoes);
    }

    return {
      ...sessao,
      data_sugerida: new Date(dataAtual),
      data_realizada: null,
      status: 'agendada',
      observacoes: ''
    };
  });
}

/**
 * Adiciona dias uteis (pula sabado e domingo).
 */
function addBusinessDays(date, days) {
  const result = new Date(date);
  let remaining = days;

  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) {
      remaining--;
    }
  }

  return result;
}

/**
 * Calcula progresso do plano de onboarding.
 */
export function calculateProgress(plano) {
  if (!plano) return { percentual: 0, sessoesFeitas: 0, totalSessoes: 0, firstValuesAtingidos: 0, totalFirstValues: 0, handoffElegivel: false };

  const sessoes = plano.sessoes || [];
  const totalSessoes = sessoes.length;
  const sessoesFeitas = sessoes.filter(s => s.status === 'concluida').length;

  const firstValues = plano.first_values || {};
  const modulosAoVivo = Object.entries(plano.classificacao || {})
    .filter(([, v]) => (typeof v === 'object' ? v.modo : v) === 'ao_vivo')
    .map(([k]) => k);

  const totalFirstValues = modulosAoVivo.length;
  const firstValuesAtingidos = modulosAoVivo.filter(id => firstValues[id]?.atingido).length;

  const modulosOnline = plano.modulos_online || [];
  const tutoriaisEnviados = modulosOnline.filter(m => m.tutorial_enviado).length;
  const totalTutoriais = modulosOnline.length;

  // Progresso: 60% sessoes + 30% first values + 10% tutoriais
  const pSessoes = totalSessoes > 0 ? sessoesFeitas / totalSessoes : 1;
  const pFirst = totalFirstValues > 0 ? firstValuesAtingidos / totalFirstValues : 1;
  const pTutoriais = totalTutoriais > 0 ? tutoriaisEnviados / totalTutoriais : 1;

  const percentual = Math.round((pSessoes * 60 + pFirst * 30 + pTutoriais * 10));

  // Handoff: todas sessoes concluidas + todos first values ao_vivo atingidos + tutoriais enviados
  const handoffElegivel = sessoesFeitas === totalSessoes &&
    firstValuesAtingidos === totalFirstValues &&
    tutoriaisEnviados === totalTutoriais;

  return {
    percentual,
    sessoesFeitas,
    totalSessoes,
    firstValuesAtingidos,
    totalFirstValues,
    tutoriaisEnviados,
    totalTutoriais,
    handoffElegivel
  };
}
