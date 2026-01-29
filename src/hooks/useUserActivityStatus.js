import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Hook para calcular o status de atividade dos usuários
 *
 * Retorna um mapa de user_id/email -> status:
 * - 'heavy_user': Top 1 usuário mais ativo do time
 * - 'active': Teve atividade nos últimos 30 dias
 * - 'inactive': Sem atividade nos últimos 30 dias
 */
export function useUserActivityStatus(teamIds, usuarios = []) {
  const [activityStatus, setActivityStatus] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivityData = async () => {
      if (!teamIds || teamIds.length === 0 || usuarios.length === 0) {
        setLoading(false);
        return;
      }

      try {
        const metricasRef = collection(db, 'metricas_diarias');
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Buscar métricas dos últimos 30 dias
        const chunkSize = 10;
        const allMetricas = [];

        for (let i = 0; i < teamIds.length; i += chunkSize) {
          const chunk = teamIds.slice(i, i + chunkSize);
          const q = query(
            metricasRef,
            where('team_id', 'in', chunk),
            where('data', '>=', thirtyDaysAgo)
          );
          const snapshot = await getDocs(q);
          allMetricas.push(...snapshot.docs.map(doc => doc.data()));
        }

        // Agregar atividade por usuário (usar email como chave)
        const userActivity = {};

        allMetricas.forEach(m => {
          // Usar email como identificador principal (mais confiável)
          const userKey = m.user_email || m.user_id;
          if (!userKey) return;

          if (!userActivity[userKey]) {
            userActivity[userKey] = {
              email: m.user_email,
              user_id: m.user_id,
              team_id: m.team_id,
              logins: 0,
              pecas_criadas: 0,
              downloads: 0,
              uso_ai_total: 0,
              dias_ativos: 0
            };
          }

          userActivity[userKey].logins += m.logins || 0;
          userActivity[userKey].pecas_criadas += m.pecas_criadas || 0;
          userActivity[userKey].downloads += m.downloads || 0;
          userActivity[userKey].uso_ai_total += m.uso_ai_total || 0;
          userActivity[userKey].dias_ativos += 1;
        });

        // Calcular score de atividade para cada usuário
        Object.keys(userActivity).forEach(key => {
          const u = userActivity[key];
          u.activity_score = u.logins + (u.pecas_criadas * 2) + u.downloads + (u.uso_ai_total * 1.5);
        });

        // Agrupar por team_id e encontrar o heavy user de cada time
        const heavyUsersByTeam = {};
        Object.values(userActivity).forEach(u => {
          const teamId = u.team_id;
          if (!heavyUsersByTeam[teamId] || u.activity_score > heavyUsersByTeam[teamId].activity_score) {
            heavyUsersByTeam[teamId] = u;
          }
        });

        // Criar mapa de status final
        const statusMap = {};

        // Primeiro, marcar todos os usuários como inativos
        usuarios.forEach(user => {
          const email = user.email?.toLowerCase();
          if (email) {
            statusMap[email] = 'inactive';
          }
        });

        // Marcar usuários com atividade como ativos
        Object.keys(userActivity).forEach(key => {
          const email = userActivity[key].email?.toLowerCase();
          if (email && userActivity[key].activity_score > 0) {
            statusMap[email] = 'active';
          }
        });

        // Marcar heavy users (top 1 de cada time)
        Object.values(heavyUsersByTeam).forEach(heavyUser => {
          const email = heavyUser.email?.toLowerCase();
          if (email && heavyUser.activity_score > 0) {
            statusMap[email] = 'heavy_user';
          }
        });

        setActivityStatus(statusMap);
      } catch (error) {
        console.error('Erro ao buscar dados de atividade:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivityData();
  }, [teamIds, usuarios]);

  // Função helper para obter o status de um usuário
  const getStatus = (email) => {
    if (!email) return 'inactive';
    return activityStatus[email.toLowerCase()] || 'inactive';
  };

  return { activityStatus, loading, getStatus };
}

// Constantes para os status
export const USER_ACTIVITY_STATUS = {
  HEAVY_USER: 'heavy_user',
  ACTIVE: 'active',
  INACTIVE: 'inactive'
};

// Configurações visuais para cada status
export const USER_ACTIVITY_CONFIG = {
  heavy_user: {
    label: 'Heavy User',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.2)',
    icon: 'crown'
  },
  active: {
    label: 'Ativo',
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.2)',
    icon: 'dot'
  },
  inactive: {
    label: 'Inativo',
    color: '#64748b',
    bgColor: 'rgba(100, 116, 139, 0.2)',
    icon: 'dot'
  }
};
