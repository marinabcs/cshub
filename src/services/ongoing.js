import { collection, doc, getDoc, getDocs, addDoc, updateDoc, query, orderBy, where, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

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
 */
export async function atribuirCiclo(clienteId, { segmento, cadencia, dataInicio, acoes }) {
  const diasCadencia = CADENCIA_OPTIONS.find(c => c.value === cadencia)?.dias || 30;
  const inicio = dataInicio instanceof Date ? dataInicio : new Date(dataInicio);
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + diasCadencia);

  const ciclo = {
    segmento,
    cadencia,
    data_inicio: Timestamp.fromDate(inicio),
    data_fim: Timestamp.fromDate(fim),
    status: 'em_andamento',
    progresso: 0,
    acoes: acoes.map(nome => ({
      nome,
      status: 'pendente',
      concluida_em: null,
      concluida_por: null,
      observacoes: '',
    })),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  const ref = collection(db, 'clientes', clienteId, 'ongoing_ciclos');
  const docRef = await addDoc(ref, ciclo);
  return { id: docRef.id, ...ciclo };
}

/**
 * Atualizar status de uma ação dentro de um ciclo
 */
export async function atualizarAcao(clienteId, cicloId, indexAcao, novoStatus, observacoes = '', email = '') {
  const docRef = doc(db, 'clientes', clienteId, 'ongoing_ciclos', cicloId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('Ciclo não encontrado');

  const ciclo = snap.data();
  const acoes = [...ciclo.acoes];

  acoes[indexAcao] = {
    ...acoes[indexAcao],
    status: novoStatus,
    concluida_em: novoStatus === 'concluida' ? Timestamp.now() : null,
    concluida_por: novoStatus === 'concluida' ? email : null,
    observacoes: observacoes || acoes[indexAcao].observacoes,
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
