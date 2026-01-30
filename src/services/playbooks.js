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
import { isClickUpConfigured, criarTarefaClickUp, atualizarStatusTarefaClickUp, buscarTarefaClickUp, STATUS_CSHUB_TO_CLICKUP, STATUS_CLICKUP_TO_ETAPA } from './clickup';

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
    const snapshot = await getDocs(playbooksRef);

    // Retornar todos os playbooks (ordenação e filtros são feitos na página)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
 * @param {string} clienteId - ID do cliente
 * @param {string} playbookId - ID do playbook template
 * @param {Date} dataInicio - Data de início
 * @param {Object} opcoes - Opções adicionais
 * @param {boolean} opcoes.criarTarefasClickUp - Se deve criar tarefas no ClickUp (default: true)
 */
export async function aplicarPlaybook(clienteId, playbookId, dataInicio = new Date(), opcoes = {}) {
  const { criarTarefasClickUp: deveCriarClickUp = true } = opcoes;

  try {
    // Buscar o template do playbook e dados do cliente
    const [playbook, clienteDoc] = await Promise.all([
      buscarPlaybook(playbookId),
      getDoc(doc(db, 'clientes', clienteId))
    ]);

    const cliente = clienteDoc.exists() ? { id: clienteDoc.id, ...clienteDoc.data() } : { id: clienteId };

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
        observacoes: '',
        clickup_task_id: null,
        clickup_task_url: null
      };
    });

    // Calcular data prevista de fim
    const dataPrevisaoFim = new Date(dataInicio);
    dataPrevisaoFim.setDate(dataPrevisaoFim.getDate() + playbook.duracao_estimada_dias);

    // Criar tarefas no ClickUp se configurado
    if (deveCriarClickUp && isClickUpConfigured()) {
      const { criarTarefaPlaybook } = await import('./clickup');

      for (let i = 0; i < etapasComDatas.length; i++) {
        const etapa = etapasComDatas[i];
        try {
          const tarefaClickUp = await criarTarefaPlaybook(etapa, playbook, cliente);
          if (tarefaClickUp) {
            etapasComDatas[i].clickup_task_id = tarefaClickUp.id;
            etapasComDatas[i].clickup_task_url = tarefaClickUp.url;
          }
        } catch (err) {
          console.error(`Erro ao criar tarefa ClickUp para etapa ${etapa.ordem}:`, err);
          // Continua mesmo se falhar
        }
      }
    }

    // Criar o playbook aplicado
    const playbookAplicado = {
      playbook_id: playbookId,
      playbook_nome: playbook.nome,
      data_inicio: Timestamp.fromDate(dataInicio),
      data_previsao_fim: Timestamp.fromDate(dataPrevisaoFim),
      status: 'em_andamento',
      progresso: 0,
      etapas: etapasComDatas,
      clickup_enabled: deveCriarClickUp && isClickUpConfigured(),
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

    const etapaAtual = etapas[etapaIndex];

    // Atualizar a etapa
    etapas[etapaIndex] = {
      ...etapaAtual,
      status: novoStatus,
      concluida_em: novoStatus === 'concluida' ? Timestamp.now() : null,
      concluida_por: novoStatus === 'concluida' ? usuarioEmail : null,
      observacoes: observacoes || etapaAtual.observacoes
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

    // Sincronizar com ClickUp se a etapa tem task_id
    if (etapaAtual.clickup_task_id && isClickUpConfigured()) {
      try {
        const statusClickUp = STATUS_CSHUB_TO_CLICKUP[novoStatus];
        if (statusClickUp) {
          await atualizarStatusTarefaClickUp(etapaAtual.clickup_task_id, statusClickUp);
        }
      } catch (clickupError) {
        console.error('Erro ao sincronizar etapa com ClickUp:', clickupError);
        // Não falha a operação se ClickUp der erro
      }
    }

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
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Playbook não encontrado');
    }

    const playbook = docSnap.data();

    await updateDoc(docRef, {
      status: 'cancelado',
      updated_at: serverTimestamp()
    });

    // Fechar TODAS as tarefas no ClickUp (não só pendentes)
    let tarefasFechadas = 0;
    let tarefasErro = 0;
    const detalhesErros = [];

    if (isClickUpConfigured() && playbook.etapas) {
      // Pegar todas as etapas que têm clickup_task_id, independente do status
      const etapasComClickUp = playbook.etapas.filter(e => e.clickup_task_id);

      console.log(`[Cancelar Playbook] Total etapas: ${playbook.etapas.length}, Com ClickUp ID: ${etapasComClickUp.length}`);
      console.log(`[Cancelar Playbook] IDs das tarefas:`, etapasComClickUp.map(e => e.clickup_task_id));

      for (const etapa of etapasComClickUp) {
        try {
          console.log(`[Cancelar Playbook] Fechando tarefa ${etapa.clickup_task_id}...`);
          await atualizarStatusTarefaClickUp(etapa.clickup_task_id, 'ignorado');
          tarefasFechadas++;
          console.log(`[Cancelar Playbook] Tarefa ${etapa.clickup_task_id} fechada com sucesso`);
          // Pequeno delay para evitar rate limit
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (clickupError) {
          console.error(`[Cancelar Playbook] Erro ao fechar tarefa ${etapa.clickup_task_id}:`, clickupError.message);
          tarefasErro++;
          detalhesErros.push({ taskId: etapa.clickup_task_id, erro: clickupError.message });
        }
      }

      console.log(`[Cancelar Playbook] Concluído: ${tarefasFechadas} fechadas, ${tarefasErro} erros`);
    } else {
      console.log(`[Cancelar Playbook] ClickUp não configurado ou sem etapas`);
    }

    return { success: true, tarefasFechadas, tarefasErro, detalhesErros };
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

/**
 * Sincronizar status das etapas de playbooks com ClickUp
 * Busca status atualizado do ClickUp e atualiza no CS Hub
 */
export async function sincronizarPlaybooksComClickUp() {
  if (!isClickUpConfigured()) {
    return { success: false, error: 'ClickUp não está configurado' };
  }

  try {
    // Buscar todos os clientes
    const clientesSnap = await getDocs(collection(db, 'clientes'));

    let totalPlaybooks = 0;
    let totalEtapas = 0;
    let etapasAtualizadas = 0;
    let erros = 0;
    const detalhes = [];

    // Para cada cliente, buscar playbooks ativos
    for (const clienteDoc of clientesSnap.docs) {
      const clienteId = clienteDoc.id;
      const playbooksRef = collection(db, 'clientes', clienteId, 'playbooks_ativos');
      const playbooksSnap = await getDocs(playbooksRef);

      for (const playbookDoc of playbooksSnap.docs) {
        const playbook = playbookDoc.data();

        // Só sincronizar playbooks em andamento
        if (playbook.status !== 'em_andamento') continue;

        totalPlaybooks++;
        const etapas = [...(playbook.etapas || [])];
        let playbookAtualizado = false;

        for (let i = 0; i < etapas.length; i++) {
          const etapa = etapas[i];

          // Só sincronizar etapas pendentes com task_id
          if (!etapa.clickup_task_id || etapa.status !== 'pendente') continue;

          totalEtapas++;

          try {
            // Buscar status atual no ClickUp
            const tarefaClickUp = await buscarTarefaClickUp(etapa.clickup_task_id);
            const statusClickUp = tarefaClickUp.status?.status?.toLowerCase() || '';
            const novoStatus = STATUS_CLICKUP_TO_ETAPA[statusClickUp];

            if (novoStatus && novoStatus !== etapa.status) {
              etapas[i] = {
                ...etapa,
                status: novoStatus,
                concluida_em: novoStatus === 'concluida' ? Timestamp.now() : null,
                concluida_por: novoStatus === 'concluida' ? 'Sincronizado do ClickUp' : null
              };
              playbookAtualizado = true;
              etapasAtualizadas++;
              detalhes.push({
                cliente: clienteDoc.data().team_name || clienteId,
                playbook: playbook.playbook_nome,
                etapa: etapa.nome || `Etapa ${etapa.ordem}`,
                de: etapa.status,
                para: novoStatus
              });
            }

            // Pequeno delay para evitar rate limit
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (e) {
            console.error(`Erro ao sincronizar etapa ${etapa.clickup_task_id}:`, e);
            erros++;
          }
        }

        // Se houve atualizações, salvar o playbook
        if (playbookAtualizado) {
          // Recalcular progresso
          const etapasObrigatorias = etapas.filter(e => e.obrigatoria);
          const etapasConcluidas = etapasObrigatorias.filter(e => e.status === 'concluida' || e.status === 'pulada');
          const progresso = etapasObrigatorias.length > 0
            ? Math.round((etapasConcluidas.length / etapasObrigatorias.length) * 100)
            : 0;

          // Verificar se todas as etapas obrigatórias foram concluídas
          const todasConcluidas = etapasObrigatorias.every(e => e.status === 'concluida' || e.status === 'pulada');
          const novoStatusPlaybook = todasConcluidas ? 'concluido' : 'em_andamento';

          await updateDoc(doc(db, 'clientes', clienteId, 'playbooks_ativos', playbookDoc.id), {
            etapas,
            progresso,
            status: novoStatusPlaybook,
            updated_at: serverTimestamp(),
            clickup_sync_at: serverTimestamp()
          });
        }
      }
    }

    return {
      success: true,
      totalPlaybooks,
      totalEtapas,
      etapasAtualizadas,
      erros,
      detalhes
    };
  } catch (error) {
    console.error('Erro ao sincronizar playbooks com ClickUp:', error);
    return { success: false, error: error.message };
  }
}
