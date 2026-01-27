import { useState } from 'react';
import { doc, updateDoc, addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { classificarThread, isOpenAIConfigured } from '../services/openai';

// Hook para classificar uma thread com IA
export function useClassificarThread() {
  const [classificando, setClassificando] = useState(false);
  const [erro, setErro] = useState(null);

  const classificar = async (teamId, threadId, conversa, threadData = {}) => {
    setClassificando(true);
    setErro(null);

    try {
      // Verificar se a API está configurada
      if (!isOpenAIConfigured()) {
        throw new Error('API da OpenAI não configurada. Adicione VITE_OPENAI_API_KEY no arquivo .env');
      }

      // Chamar a IA para classificar
      const resultado = await classificarThread(conversa);

      // Preparar dados para salvar
      const classificacaoData = {
        categoria: resultado.categoria,
        sentimento: resultado.sentimento,
        resumo_ia: resultado.resumo,
        classificado_em: Timestamp.now(),
        classificado_por: 'ia'
      };

      // Atualizar a thread no Firebase (nova arquitetura - collection raiz)
      const threadRef = doc(db, 'threads', threadId);
      await updateDoc(threadRef, classificacaoData);

      // Criar alertas se necessário
      await criarAlertasSeNecessario(resultado, teamId, threadId, threadData);

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

// Criar alertas automaticamente se sentimento urgente ou erro_bug
async function criarAlertasSeNecessario(resultado, teamId, threadId, threadData) {
  const alertasParaCriar = [];

  // Alerta para sentimento urgente ou negativo
  if (resultado.sentimento === 'urgente' || resultado.sentimento === 'negativo') {
    alertasParaCriar.push({
      tipo: 'sentimento_negativo',
      titulo: resultado.sentimento === 'urgente'
        ? `Sentimento URGENTE detectado: ${threadData.team_name || 'Time'}`
        : `Sentimento negativo: ${threadData.team_name || 'Time'}`,
      mensagem: resultado.resumo || `Thread classificada com sentimento ${resultado.sentimento}.`,
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

  // Alerta para erro/bug
  if (resultado.categoria === 'erro_bug') {
    alertasParaCriar.push({
      tipo: 'erro_bug',
      titulo: `Bug reportado: ${threadData.team_name || 'Time'}`,
      mensagem: resultado.resumo || 'Cliente reportou um erro/bug no sistema.',
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
