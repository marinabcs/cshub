// Playbooks Service - Gerenciamento de playbooks e checklists
import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';

// Status possíveis do playbook aplicado
export const PLAYBOOK_STATUS = {
  em_andamento: { value: 'em_andamento', label: 'Em Andamento', color: '#8b5cf6' },
  concluido: { value: 'concluido', label: 'Concluído', color: '#10b981' },
  cancelado: { value: 'cancelado', label: 'Cancelado', color: '#64748b' }
};

// Status das etapas
export const ETAPA_STATUS = {
  pendente: { value: 'pendente', label: 'Pendente', color: '#f59e0b', icon: '🔄' },
  concluida: { value: 'concluida', label: 'Concluída', color: '#10b981', icon: '✅' },
  pulada: { value: 'pulada', label: 'Pulada', color: '#64748b', icon: '⏭️' }
};

/**
 * Buscar todos os playbooks (templates)
 */
export async function buscarPlaybooks() {
  try {
    const playbooksRef = collection(db, 'playbooks');
    const q = query(playbooksRef, where('ativo', '==', true), orderBy('nome', 'asc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Erro ao buscar playbooks:', error);
    throw error;
  }
}

/**
 * Buscar um playbook específico por ID
 */
export async function buscarPlaybook(playbookId) {
  try {
    const docRef = doc(db, 'playbooks', playbookId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Playbook não encontrado');
    }

    return {
      id: docSnap.id,
      ...docSnap.data()
    };
  } catch (error) {
    console.error('Erro ao buscar playbook:', error);
    throw error;
  }
}

/**
 * Aplicar um playbook a um cliente
 */
export async function aplicarPlaybook(clienteId, playbookId, dataInicio = new Date()) {
  try {
    // Buscar o template do playbook
    const playbook = await buscarPlaybook(playbookId);

    // Calcular datas das etapas
    const etapasComDatas = playbook.etapas.map(etapa => {
      const prazoData = new Date(dataInicio);
      prazoData.setDate(prazoData.getDate() + etapa.prazo_dias);

      return {
        ...etapa,
        prazo_data: Timestamp.fromDate(prazoData),
        status: 'pendente',
        concluida_em: null,
        concluida_por: null,
        observacoes: ''
      };
    });

    // Calcular data prevista de fim
    const dataPrevisaoFim = new Date(dataInicio);
    dataPrevisaoFim.setDate(dataPrevisaoFim.getDate() + playbook.duracao_estimada_dias);

    // Criar o playbook aplicado
    const playbookAplicado = {
      playbook_id: playbookId,
      playbook_nome: playbook.nome,
      data_inicio: Timestamp.fromDate(dataInicio),
      data_previsao_fim: Timestamp.fromDate(dataPrevisaoFim),
      status: 'em_andamento',
      progresso: 0,
      etapas: etapasComDatas,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    };

    // Salvar na subcollection do cliente
    const playbooksAtivosRef = collection(db, 'clientes', clienteId, 'playbooks_ativos');
    const docRef = await addDoc(playbooksAtivosRef, playbookAplicado);

    return {
      id: docRef.id,
      ...playbookAplicado
    };
  } catch (error) {
    console.error('Erro ao aplicar playbook:', error);
    throw error;
  }
}

/**
 * Buscar playbooks ativos de um cliente
 */
export async function buscarPlaybooksCliente(clienteId) {
  try {
    const playbooksRef = collection(db, 'clientes', clienteId, 'playbooks_ativos');
    const q = query(playbooksRef, orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Erro ao buscar playbooks do cliente:', error);
    throw error;
  }
}

/**
 * Atualizar status de uma etapa
 */
export async function atualizarEtapa(clienteId, playbookAtivoId, ordemEtapa, novoStatus, observacoes = '', usuarioEmail = '') {
  try {
    const docRef = doc(db, 'clientes', clienteId, 'playbooks_ativos', playbookAtivoId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Playbook não encontrado');
    }

    const playbook = docSnap.data();
    const etapas = [...playbook.etapas];

    // Encontrar a etapa
    const etapaIndex = etapas.findIndex(e => e.ordem === ordemEtapa);
    if (etapaIndex === -1) {
      throw new Error('Etapa não encontrada');
    }

    // Atualizar a etapa
    etapas[etapaIndex] = {
      ...etapas[etapaIndex],
      status: novoStatus,
      concluida_em: novoStatus === 'concluida' ? Timestamp.now() : null,
      concluida_por: novoStatus === 'concluida' ? usuarioEmail : null,
      observacoes: observacoes || etapas[etapaIndex].observacoes
    };

    // Calcular progresso
    const etapasObrigatorias = etapas.filter(e => e.obrigatoria);
    const etapasConcluidas = etapasObrigatorias.filter(e => e.status === 'concluida' || e.status === 'pulada');
    const progresso = Math.round((etapasConcluidas.length / etapasObrigatorias.length) * 100);

    // Verificar se todas as etapas obrigatórias foram concluídas
    const todasConcluidas = etapasObrigatorias.every(e => e.status === 'concluida' || e.status === 'pulada');
    const novoStatusPlaybook = todasConcluidas ? 'concluido' : playbook.status;

    // Atualizar documento
    await updateDoc(docRef, {
      etapas,
      progresso,
      status: novoStatusPlaybook,
      updated_at: serverTimestamp()
    });

    return {
      success: true,
      progresso,
      status: novoStatusPlaybook
    };
  } catch (error) {
    console.error('Erro ao atualizar etapa:', error);
    throw error;
  }
}

/**
 * Cancelar um playbook ativo
 */
export async function cancelarPlaybook(clienteId, playbookAtivoId) {
  try {
    const docRef = doc(db, 'clientes', clienteId, 'playbooks_ativos', playbookAtivoId);

    await updateDoc(docRef, {
      status: 'cancelado',
      updated_at: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Erro ao cancelar playbook:', error);
    throw error;
  }
}

/**
 * Verificar se uma etapa está atrasada
 */
export function verificarAtraso(prazoData) {
  if (!prazoData) return { atrasado: false, dias: 0 };

  const prazo = prazoData.toDate ? prazoData.toDate() : new Date(prazoData);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  prazo.setHours(0, 0, 0, 0);

  const diffMs = prazo - hoje;
  const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return {
    atrasado: diffDias < 0,
    dias: Math.abs(diffDias),
    proximo: diffDias >= 0 && diffDias <= 3 // Próximo se faltam 3 dias ou menos
  };
}

/**
 * Formatar data para exibição
 */
export function formatarData(timestamp) {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Formatar prazo com indicador de atraso
 */
export function formatarPrazo(prazoData, status) {
  if (status === 'concluida' || status === 'pulada') {
    return { texto: formatarData(prazoData), cor: '#10b981' };
  }

  const { atrasado, dias, proximo } = verificarAtraso(prazoData);

  if (atrasado) {
    return { texto: `Atrasado há ${dias} dia${dias > 1 ? 's' : ''}`, cor: '#ef4444' };
  }

  if (proximo) {
    return { texto: `Até ${formatarData(prazoData)} (${dias} dia${dias > 1 ? 's' : ''})`, cor: '#f59e0b' };
  }

  return { texto: `Até ${formatarData(prazoData)}`, cor: '#94a3b8' };
}
