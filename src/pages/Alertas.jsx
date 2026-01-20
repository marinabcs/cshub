import { Bell, Clock, UserX, Frown, TrendingDown } from 'lucide-react';

export default function Alertas() {
  return (
    <div style={{ padding: '32px', background: '#0f0a1f', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', margin: 0 }}>Alertas</h1>
          <span style={{
            padding: '4px 12px',
            background: 'rgba(139, 92, 246, 0.2)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '20px',
            color: '#a78bfa',
            fontSize: '12px',
            fontWeight: '600'
          }}>
            Em breve
          </span>
        </div>
        <p style={{ color: '#94a3b8', margin: 0 }}>Sistema de notificações automáticas</p>
      </div>

      {/* Card Central */}
      <div style={{
        maxWidth: '600px',
        margin: '80px auto',
        background: 'rgba(30, 27, 75, 0.4)',
        border: '1px solid rgba(139, 92, 246, 0.15)',
        borderRadius: '20px',
        padding: '48px',
        textAlign: 'center'
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px'
        }}>
          <Bell style={{ width: '40px', height: '40px', color: 'white' }} />
        </div>

        <h2 style={{ color: 'white', fontSize: '24px', fontWeight: '600', margin: '0 0 12px 0' }}>
          Sistema de alertas em desenvolvimento
        </h2>

        <p style={{ color: '#94a3b8', fontSize: '16px', margin: '0 0 32px 0', lineHeight: '1.6' }}>
          Em breve você receberá notificações automáticas para acompanhar a saúde dos seus clientes de forma proativa.
        </p>

        {/* Lista de alertas futuros */}
        <div style={{
          background: 'rgba(15, 10, 31, 0.6)',
          borderRadius: '16px',
          padding: '24px',
          textAlign: 'left'
        }}>
          <p style={{ color: '#64748b', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 16px 0' }}>
            Alertas que serão gerados automaticamente:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                background: 'rgba(249, 115, 22, 0.2)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <UserX style={{ width: '22px', height: '22px', color: '#f97316' }} />
              </div>
              <div>
                <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '0 0 2px 0' }}>
                  Clientes sem contato
                </p>
                <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
                  Notificação quando um cliente ficar muito tempo sem interação
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                background: 'rgba(239, 68, 68, 0.2)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Frown style={{ width: '22px', height: '22px', color: '#ef4444' }} />
              </div>
              <div>
                <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '0 0 2px 0' }}>
                  Sentimento negativo
                </p>
                <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
                  Alerta quando conversas apresentarem tom negativo ou insatisfação
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                background: 'rgba(245, 158, 11, 0.2)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <TrendingDown style={{ width: '22px', height: '22px', color: '#f59e0b' }} />
              </div>
              <div>
                <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '0 0 2px 0' }}>
                  Health Score baixo
                </p>
                <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
                  Aviso quando o score de saúde do cliente entrar em zona de risco
                </p>
              </div>
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginTop: '24px',
          color: '#64748b',
          fontSize: '13px'
        }}>
          <Clock style={{ width: '16px', height: '16px' }} />
          <span>Funcionalidade em desenvolvimento</span>
        </div>
      </div>
    </div>
  );
}
