import { collection, doc, getDoc, getDocs, addDoc, updateDoc, query, orderBy, where, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { isClickUpConfigured, criarTarefaOngoing, atualizarStatusTarefaClickUp, buscarTarefaClickUp } from './clickup';

// Constantes
export const ONGOING_STATUS = {
  em_andamento: { value: 'em_andamento', label: 'Em Andamento', color: '#8b5cf6' },
  concluido: { value: 'concluido', label: 'Concluído', color: '#10b981' },
  cancelado: { value: 'cancelado', label: 'Cancelado', color: '#64748b' },
};

export const ACAO_STATUS = {
  pendente: { value: 'pendente', label: 'Pendente', color: '#f59e0b' },
  concluida: { value: 'concluida', label: 'Concluída', color: '#10b981' },
  pulada: { value: 'pulada', label: 'Pulada', color: '#64748b' },
};

export const CADENCIA_OPTIONS = [
  { value: 'mensal', label: 'Mensal', dias: 30 },
  { value: 'bimestral', label: 'Bimestral', dias: 60 },
];

/**
 * Buscar todos os ciclos de um cliente (ordenados por data)
 */
export async function buscarCiclosCliente(clienteId) {
  const ref = collection(db, 'clientes', clienteId, 'ongoing_ciclos');
  const q = query(ref, orderBy('created_at', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Atribuir novo ciclo a um cliente
 * acoes: array de { nome: string, dias: number } ou string (compatibilidade)
 * cliente: objeto do cliente (opcional, necessário para criar tarefas no ClickUp)
 * criarClickUp: boolean (default: true se ClickUp configurado)
 */
export async function atribuirCiclo(clienteId, { segmento, cadencia, dataInicio, acoes, cliente = null, criarClickUp = true }) {
  const diasCadencia = CADENCIA_OPTIONS.find(c => c.value === cadencia)?.dias || 30;
  const inicio = dataInicio instanceof Date ? dataInicio : new Date(dataInicio);
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + diasCadencia);

  // Preparar ações com campos para ClickUp
  const acoesPreparadas = acoes.map(acao => {
    const nome = typeof acao === 'string' ? acao : acao.nome;
    const dias = typeof acao === 'object' && acao.dias ? acao.dias : 7;
    const dataVencimento = new Date(inicio);
    dataVencimento.setDate(dataVencimento.getDate() + dias);
    return {
      nome,
      dias,
      data_vencimento: Timestamp.fromDate(dataVencimento),
      status: 'pendente',
      concluida_em: null,
      concluida_por: null,
      observacoes: '',
      clickup_task_id: null,
      clickup_task_url: null,
    };
  });

  const ciclo = {
    segmento,
    cadencia,
    data_inicio: Timestamp.fromDate(inicio),
    data_fim: Timestamp.fromDate(fim),
    status: 'em_andamento',
    progresso: 0,
    acoes: acoesPreparadas,
    clickup_enabled: false,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  // Criar tarefas no ClickUp se configurado e cliente fornecido
  if (criarClickUp && cliente && isClickUpConfigured()) {
    ciclo.clickup_enabled = true;

    for (let i = 0; i < ciclo.acoes.length; i++) {
      const acao = ciclo.acoes[i];
      try {
        const tarefaClickUp = await criarTarefaOngoing(acao, ciclo, cliente);
        if (tarefaClickUp) {
          ciclo.acoes[i].clickup_task_id = tarefaClickUp.id;
          ciclo.acoes[i].clickup_task_url = tarefaClickUp.url;
        }
      } catch (err) {
        console.error(`Erro ao criar tarefa ClickUp para ação "${acao.nome}":`, err);
        // Continua mesmo se falhar
      }
    }
  }

  const ref = collection(db, 'clientes', clienteId, 'ongoing_ciclos');
  const docRef = await addDoc(ref, ciclo);
  return { id: docRef.id, ...ciclo };
}

// Mapeamento de status Ongoing → ClickUp
const STATUS_ONGOING_TO_CLICKUP = {
  'pendente': 'pendente',
  'concluida': 'resolvido',
  'pulada': 'ignorado',
};

// Mapeamento de status ClickUp → Ongoing
const STATUS_CLICKUP_TO_ONGOING = {
  'pendente': 'pendente',
  'em andamento': 'pendente',
  'resolvido': 'concluida',
  'ignorado': 'pulada',
  'bloqueado': 'pendente',
};

/**
 * Atualizar status de uma ação dentro de um ciclo
 */
export async function atualizarAcao(clienteId, cicloId, indexAcao, novoStatus, observacoes = '', email = '') {
  const docRef = doc(db, 'clientes', clienteId, 'ongoing_ciclos', cicloId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('Ciclo não encontrado');

  const ciclo = snap.data();
  const acoes = [...ciclo.acoes];
  const acaoAtual = acoes[indexAcao];

  acoes[indexAcao] = {
    ...acaoAtual,
    status: novoStatus,
    concluida_em: novoStatus === 'concluida' ? Timestamp.now() : null,
    concluida_por: novoStatus === 'concluida' ? email : null,
    observacoes: observacoes || acaoAtual.observacoes,
  };

  // Recalcular progresso
  const total = acoes.length;
  const concluidas = acoes.filter(a => a.status === 'concluida' || a.status === 'pulada').length;
  const progresso = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  // Auto-completar ciclo se todas concluídas
  const todasFeitas = acoes.every(a => a.status === 'concluida' || a.status === 'pulada');
  const novoStatusCiclo = todasFeitas ? 'concluido' : ciclo.status;

  await updateDoc(docRef, {
    acoes,
    progresso,
    status: novoStatusCiclo,
    updated_at: serverTimestamp(),
  });

  // Atualizar status no ClickUp se a ação tem task vinculada
  if (acaoAtual.clickup_task_id && isClickUpConfigured()) {
    const statusClickUp = STATUS_ONGOING_TO_CLICKUP[novoStatus];
    if (statusClickUp) {
      try {
        await atualizarStatusTarefaClickUp(acaoAtual.clickup_task_id, statusClickUp);
      } catch (err) {
        console.error('Erro ao atualizar status no ClickUp:', err);
        // Não impede a atualização local
      }
    }
  }

  return { progresso, status: novoStatusCiclo };
}

/**
 * Cancelar ciclo ativo
 */
export async function cancelarCiclo(clienteId, cicloId) {
  const docRef = doc(db, 'clientes', clienteId, 'ongoing_ciclos', cicloId);
  await updateDoc(docRef, {
    status: 'cancelado',
    updated_at: serverTimestamp(),
  });
}

/**
 * Buscar ciclo ativo de um cliente (o mais recente em_andamento)
 */
export async function buscarCicloAtivo(clienteId) {
  const ref = collection(db, 'clientes', clienteId, 'ongoing_ciclos');
  const q = query(ref, where('status', '==', 'em_andamento'), orderBy('created_at', 'desc'));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

/**
 * Sincronizar status das ações de Ongoing com ClickUp
 * Busca status atualizado do ClickUp e atualiza no CS Hub
 */
export async function sincronizarOngoingComClickUp() {
  if (!isClickUpConfigured()) {
    return { success: false, error: 'ClickUp não está configurado' };
  }

  try {
    // Buscar todos os clientes
    const clientesSnap = await getDocs(collection(db, 'clientes'));

    let totalCiclos = 0;
    let totalAcoes = 0;
    let acoesAtualizadas = 0;
    let erros = 0;
    const detalhes = [];

    // Para cada cliente, buscar ciclos ativos
    for (const clienteDoc of clientesSnap.docs) {
      const clienteId = clienteDoc.id;
      const ciclosRef = collection(db, 'clientes', clienteId, 'ongoing_ciclos');
      const ciclosSnap = await getDocs(query(ciclosRef, where('status', '==', 'em_andamento')));

      for (const cicloDoc of ciclosSnap.docs) {
        const ciclo = cicloDoc.data();

        // Só sincronizar ciclos com ClickUp habilitado
        if (!ciclo.clickup_enabled) continue;

        totalCiclos++;
        const acoes = [...(ciclo.acoes || [])];
        let cicloAtualizado = false;

        for (let i = 0; i < acoes.length; i++) {
          const acao = acoes[i];

          // Só sincronizar ações pendentes com task_id
          if (!acao.clickup_task_id || acao.status !== 'pendente') continue;

          totalAcoes++;

          try {
            // Buscar status atual no ClickUp
            const tarefaClickUp = await buscarTarefaClickUp(acao.clickup_task_id);
            const statusClickUp = tarefaClickUp.status?.status?.toLowerCase() || '';
            const novoStatus = STATUS_CLICKUP_TO_ONGOING[statusClickUp];

            if (novoStatus && novoStatus !== acao.status) {
              acoes[i] = {
                ...acao,
                status: novoStatus,
                concluida_em: novoStatus === 'concluida' ? Timestamp.now() : null,
                concluida_por: novoStatus === 'concluida' ? 'Sincronizado do ClickUp' : null,
              };
              cicloAtualizado = true;
              acoesAtualizadas++;
              detalhes.push({
                cliente: clienteDoc.data().team_name || clienteId,
                acao: acao.nome,
                de: acao.status,
                para: novoStatus
              });
            }

            // Pequeno delay para evitar rate limit
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (e) {
            console.error(`Erro ao sincronizar ação ${acao.clickup_task_id}:`, e);
            erros++;
          }
        }

        // Se houve atualizações, salvar o ciclo
        if (cicloAtualizado) {
          // Recalcular progresso
          const total = acoes.length;
          const concluidas = acoes.filter(a => a.status === 'concluida' || a.status === 'pulada').length;
          const progresso = total > 0 ? Math.round((concluidas / total) * 100) : 0;
          const todasFeitas = acoes.every(a => a.status === 'concluida' || a.status === 'pulada');
          const novoStatusCiclo = todasFeitas ? 'concluido' : ciclo.status;

          const cicloRef = doc(db, 'clientes', clienteId, 'ongoing_ciclos', cicloDoc.id);
          await updateDoc(cicloRef, {
            acoes,
            progresso,
            status: novoStatusCiclo,
            updated_at: serverTimestamp(),
          });
        }
      }
    }

    return {
      success: true,
      totalCiclos,
      totalAcoes,
      acoesAtualizadas,
      erros,
      detalhes
    };
  } catch (error) {
    console.error('Erro ao sincronizar Ongoing com ClickUp:', error);
    return { success: false, error: error.message };
  }
}
