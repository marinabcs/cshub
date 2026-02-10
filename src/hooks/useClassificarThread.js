import { useState } from 'react';
import { doc, getDoc, updateDoc, addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { classificarThread, isOpenAIConfigured } from '../services/openai';
import { validateForm } from '../validation';
import { classificacaoManualSchema } from '../validation/thread';

// Hook para classificar uma thread com IA
export function useClassificarThread() {
  const [classificando, setClassificando] = useState(false);
  const [erro, setErro] = useState(null);

  const classificar = async (teamId, threadId, conversa, threadData = {}, observacoesAtivas = []) => {
    setClassificando(true);
    setErro(null);

    try {
      // Verificar se a API está configurada (Cloud Function)
      if (!isOpenAIConfigured()) {
        throw new Error('Classificação por IA indisponível no momento.');
      }

      // Formatar observações do CS como contexto
      let contextoCliente = '';
      if (observacoesAtivas.length > 0) {
        contextoCliente = observacoesAtivas.map(o => {
          const data = o.criado_em?.toDate ? o.criado_em.toDate() : new Date(o.criado_em);
          const dataStr = data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
          return `- [${dataStr}] ${o.texto}`;
        }).join('\n');
      }

      // Chamar a IA para classificar
      const resultado = await classificarThread(conversa, contextoCliente);

      // Preparar dados para salvar (incluindo status da IA)
      const classificacaoData = {
        categoria: resultado.categoria,
        sentimento: resultado.sentimento,
        status: resultado.status || 'aguardando_equipe',
        resumo_ia: resultado.resumo,
        classificado_em: Timestamp.now(),
        classificado_por: 'ia'
      };

      // Atualizar a thread no Firebase (nova arquitetura - collection raiz)
      const threadRef = doc(db, 'threads', threadId);
      await updateDoc(threadRef, classificacaoData);

      // Criar alertas se necessário
      await criarAlertasSeNecessario(resultado, teamId, threadId, threadData);

      // Criar tags de problema se necessário
      await criarTagsSeNecessario(resultado, threadId, threadData);

      return { success: true, resultado };
    } catch (error) {
      console.error('Erro ao classificar thread:', error);
      setErro(error.message);
      return { success: false, error: error.message };
    } finally {
      setClassificando(false);
    }
  };

  // Classificar manualmente
  const classificarManual = async (teamId, threadId, classificacao) => {
    setClassificando(true);
    setErro(null);

    try {
      // Validar dados da classificação
      const validationErrors = validateForm(classificacaoManualSchema, classificacao);
      if (validationErrors) {
        throw new Error(Object.values(validationErrors).join(', '));
      }

      const classificacaoData = {
        categoria: classificacao.categoria,
        sentimento: classificacao.sentimento,
        resumo_ia: classificacao.resumo || null,
        classificado_em: Timestamp.now(),
        classificado_por: 'manual'
      };

      // Atualizar a thread no Firebase (nova arquitetura - collection raiz)
      const threadRef = doc(db, 'threads', threadId);
      await updateDoc(threadRef, classificacaoData);

      return { success: true };
    } catch (error) {
      console.error('Erro ao classificar thread manualmente:', error);
      setErro(error.message);
      return { success: false, error: error.message };
    } finally {
      setClassificando(false);
    }
  };

  return { classificar, classificarManual, classificando, erro };
}

// Criar alertas automaticamente baseado na classificação
async function criarAlertasSeNecessario(resultado, teamId, threadId, threadData) {
  const alertasParaCriar = [];

  // Alerta para sentimento urgente ou negativo
  if (resultado.sentimento === 'urgente' || resultado.sentimento === 'negativo') {
    alertasParaCriar.push({
      tipo: 'sentimento_negativo',
      titulo: resultado.sentimento === 'urgente'
        ? `Conversa URGENTE: ${threadData.team_name || 'Cliente'}`
        : `Conversa com sentimento negativo`,
      mensagem: resultado.resumo || `Conversa classificada com sentimento ${resultado.sentimento}.`,
      prioridade: resultado.sentimento === 'urgente' ? 'urgente' : 'alta',
      status: 'pendente',
      time_id: teamId,
      time_name: threadData.team_name || null,
      cliente_id: threadData.cliente_id || null,
      cliente_nome: threadData.cliente_nome || null,
      thread_id: threadId,
      responsavel_email: threadData.responsavel_email || null,
      responsavel_nome: threadData.responsavel_nome || null,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
      resolved_at: null
    });
  }

  // Alerta para problema/reclamação (inclui erro_bug e reclamação)
  const categoriasProblema = ['erro_bug', 'reclamacao', 'problema', 'bug'];
  if (categoriasProblema.includes(resultado.categoria)) {
    alertasParaCriar.push({
      tipo: 'problema_reclamacao',
      titulo: `Problema reportado: ${threadData.team_name || 'Cliente'}`,
      mensagem: resultado.resumo || 'Cliente reportou um problema ou reclamação.',
      prioridade: 'alta',
      status: 'pendente',
      time_id: teamId,
      time_name: threadData.team_name || null,
      cliente_id: threadData.cliente_id || null,
      cliente_nome: threadData.cliente_nome || null,
      thread_id: threadId,
      responsavel_email: threadData.responsavel_email || null,
      responsavel_nome: threadData.responsavel_nome || null,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
      resolved_at: null
    });
  }

  // Criar os alertas
  for (const alerta of alertasParaCriar) {
    try {
      await addDoc(collection(db, 'alertas'), alerta);
    } catch (e) {
      console.error('Erro ao criar alerta:', e);
    }
  }
}

// Criar tags de problema automaticamente baseado na classificação
async function criarTagsSeNecessario(resultado, threadId, threadData) {
  if (!threadData.cliente_id) return;

  const tagsParaAdicionar = [];

  if (resultado.categoria === 'erro_bug') tagsParaAdicionar.push('Bug Reportado');
  if (resultado.categoria === 'reclamacao') tagsParaAdicionar.push('Insatisfeito');
  if (resultado.categoria === 'problema') tagsParaAdicionar.push('Problema Ativo');
  if (resultado.sentimento === 'urgente') tagsParaAdicionar.push('Risco de Churn');
  if (resultado.sentimento === 'negativo' && resultado.categoria !== 'reclamacao') {
    tagsParaAdicionar.push('Problema Ativo');
  }

  if (tagsParaAdicionar.length === 0) return;

  try {
    const clienteRef = doc(db, 'clientes', threadData.cliente_id);
    const clienteSnap = await getDoc(clienteRef);
    if (!clienteSnap.exists()) return;

    const tagsAtuais = clienteSnap.data().tags_problema || [];
    const tagsNovas = tagsParaAdicionar
      .filter(tag => !tagsAtuais.some(t => t.tag === tag))
      .map(tag => ({ tag, origem: 'ia', data: Timestamp.now(), thread_id: threadId }));

    if (tagsNovas.length === 0) return;

    await updateDoc(clienteRef, { tags_problema: [...tagsAtuais, ...tagsNovas] });
  } catch (e) {
    console.error('Erro ao criar tags de problema:', e);
  }
}
