import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useSessionTimeout } from '../../hooks/useSessionTimeout';
import { Clock } from 'lucide-react';

export default function Layout() {
  const { showWarning, secondsRemaining, keepAlive, logout } = useSessionTimeout();

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#0f0a1f'
    }}>
      <Sidebar />
      <main style={{
        flex: 1,
        marginLeft: '260px',
        minHeight: '100vh',
        background: '#0f0a1f',
        overflow: 'hidden'
      }}>
        <Outlet />
      </main>

      {/* Modal de aviso de inatividade */}
      {showWarning && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: '#1e1b4b',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              background: 'rgba(239, 68, 68, 0.15)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <Clock style={{ width: '32px', height: '32px', color: '#ef4444' }} />
            </div>
            <h3 style={{ color: 'white', fontSize: '20px', margin: '0 0 12px' }}>
              Sessao inativa
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 8px' }}>
              Voce sera desconectado por inatividade em:
            </p>
            <p style={{
              color: '#ef4444',
              fontSize: '36px',
              fontWeight: '700',
              margin: '0 0 24px'
            }}>
              {secondsRemaining}s
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={keepAlive}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  color: 'white',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Continuar conectado
              </button>
              <button
                onClick={logout}
                style={{
                  padding: '12px 24px',
                  background: 'transparent',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  borderRadius: '12px',
                  color: '#ef4444',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Sair agora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
