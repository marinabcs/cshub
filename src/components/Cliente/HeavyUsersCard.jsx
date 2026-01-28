import { useState, useEffect } from 'react';
import { Crown, LogIn, FileImage, Sparkles, TrendingUp } from 'lucide-react';
import { getHeavyUsers } from '../../services/api';

const getInitials = (name, email) => {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  if (email) {
    return email.charAt(0).toUpperCase();
  }
  return 'U';
};

const RANK_COLORS = ['#f59e0b', '#94a3b8', '#cd7f32'];

export default function HeavyUsersCard({ teamIds, days = 30, topN = 5 }) {
  const [heavyUsers, setHeavyUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!teamIds || teamIds.length === 0) {
        setLoading(false);
        return;
      }
      try {
        const users = await getHeavyUsers(teamIds, days, topN);
        setHeavyUsers(users);
      } catch (error) {
        console.error('Erro ao buscar heavy users:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [teamIds, days, topN]);

  if (loading) {
    return (
      <div style={{
        background: 'rgba(30, 27, 75, 0.4)',
        border: '1px solid rgba(139, 92, 246, 0.15)',
        borderRadius: '16px',
        padding: '20px'
      }}>
        <div style={{ textAlign: 'center', color: '#64748b' }}>Carregando...</div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'rgba(30, 27, 75, 0.4)',
      border: '1px solid rgba(139, 92, 246, 0.15)',
      borderRadius: '16px',
      padding: '20px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <Crown style={{ width: '20px', height: '20px', color: '#f59e0b' }} />
        <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>
          Heavy Users
        </h3>
        <span style={{
          padding: '4px 10px',
          background: 'rgba(245, 158, 11, 0.2)',
          color: '#f59e0b',
          borderRadius: '8px',
          fontSize: '12px'
        }}>
          Últimos {days} dias
        </span>
      </div>

      {heavyUsers.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {heavyUsers.map((user, index) => (
            <div key={user.user_id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              background: index < 3
                ? `linear-gradient(135deg, ${RANK_COLORS[index]}10 0%, rgba(15,10,31,0.6) 100%)`
                : 'rgba(15, 10, 31, 0.6)',
              border: `1px solid ${index < 3 ? `${RANK_COLORS[index]}30` : 'rgba(139,92,246,0.1)'}`,
              borderRadius: '12px'
            }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: index < 3 ? `${RANK_COLORS[index]}20` : 'rgba(100,116,139,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: index < 3 ? RANK_COLORS[index] : '#64748b',
                fontSize: '12px',
                fontWeight: '700'
              }}>
                {index + 1}
              </div>

              <div style={{
                width: '36px',
                height: '36px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                {getInitials(user.user_nome, user.user_email)}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.user_nome || user.user_email?.split('@')[0] || 'Usuário'}
                </p>
                <p style={{ color: '#64748b', fontSize: '12px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.user_email}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ textAlign: 'center' }}>
                  <LogIn style={{ width: '14px', height: '14px', color: '#8b5cf6', margin: '0 auto 2px' }} />
                  <p style={{ color: 'white', fontSize: '13px', fontWeight: '600', margin: 0 }}>
                    {user.logins}
                  </p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <FileImage style={{ width: '14px', height: '14px', color: '#06b6d4', margin: '0 auto 2px' }} />
                  <p style={{ color: 'white', fontSize: '13px', fontWeight: '600', margin: 0 }}>
                    {user.pecas_criadas}
                  </p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <Sparkles style={{ width: '14px', height: '14px', color: '#f97316', margin: '0 auto 2px' }} />
                  <p style={{ color: 'white', fontSize: '13px', fontWeight: '600', margin: 0 }}>
                    {user.uso_ai_total}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
          <TrendingUp style={{ width: '32px', height: '32px', margin: '0 auto 8px' }} />
          <p style={{ margin: 0 }}>Nenhum dado de uso encontrado</p>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>Os dados aparecem após a sincronização diária</p>
        </div>
      )}
    </div>
  );
}
