import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebase';
import { Users, BarChart3, Bell, MessageSquare, LogIn, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err) {
      setError('Email ou senha inválidos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      {/* Lado Esquerdo */}
      <div style={{
        width: '50%',
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)',
        padding: '48px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Blur decorativo */}
        <div style={{
          position: 'absolute',
          top: '10%',
          left: '10%',
          width: '300px',
          height: '300px',
          background: 'rgba(139, 92, 246, 0.3)',
          borderRadius: '50%',
          filter: 'blur(100px)'
        }}></div>
        <div style={{
          position: 'absolute',
          bottom: '10%',
          right: '10%',
          width: '400px',
          height: '400px',
          background: 'rgba(6, 182, 212, 0.2)',
          borderRadius: '50%',
          filter: 'blur(120px)'
        }}></div>

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '64px',
              height: '64px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 10px 40px rgba(139, 92, 246, 0.4)'
            }}>
              <Users style={{ width: '32px', height: '32px', color: 'white' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: 'white', margin: 0 }}>CS Hub</h1>
              <p style={{ color: '#a5b4fc', margin: 0 }}>Sistema de Customer Success v1.0</p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {[
            { icon: Users, title: 'Gestão de Clientes', desc: 'Acompanhe todos os clientes em um só lugar com informações completas.' },
            { icon: BarChart3, title: 'Health Score', desc: 'Monitore a saúde dos clientes em tempo real com métricas inteligentes.' },
            { icon: Bell, title: 'Alertas Inteligentes', desc: 'Receba notificações sobre clientes em risco ou que precisam de atenção.' },
            { icon: MessageSquare, title: 'Timeline de Conversas', desc: 'Histórico completo de todas as interações com cada cliente.' }
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: 'rgba(139, 92, 246, 0.2)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <item.icon style={{ width: '24px', height: '24px', color: '#a5b4fc' }} />
              </div>
              <div>
                <h3 style={{ color: 'white', fontWeight: '600', margin: '0 0 4px 0' }}>{item.title}</h3>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Rodapé */}
        <div style={{ position: 'relative', zIndex: 10 }}>
          <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #4c1d95, transparent)', marginBottom: '24px' }}></div>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Feito com 💜 pelo time de CS</p>
        </div>
      </div>

      {/* Lado Direito */}
      <div style={{
        width: '50%',
        background: '#0f0a1f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px'
      }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <div style={{
            background: 'rgba(30, 27, 75, 0.6)',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            borderRadius: '24px',
            padding: '40px',
            backdropFilter: 'blur(20px)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', margin: '0 0 8px 0' }}>Bem-vindo de volta!</h2>
              <p style={{ color: '#94a3b8', margin: 0 }}>Entre para gerenciar seus clientes</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#e2e8f0', fontSize: '14px', marginBottom: '8px' }}>E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.trakto.io"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#0f0a1f',
                    border: '1px solid #3730a3',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '16px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#e2e8f0', fontSize: '14px', marginBottom: '8px' }}>Senha</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      paddingRight: '48px',
                      background: '#0f0a1f',
                      border: '1px solid #3730a3',
                      borderRadius: '12px',
                      color: 'white',
                      fontSize: '16px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                  >
                    {showPassword ?
                      <EyeOff style={{ width: '20px', height: '20px', color: '#64748b' }} /> :
                      <Eye style={{ width: '20px', height: '20px', color: '#64748b' }} />
                    }
                  </button>
                </div>
              </div>

              {error && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  color: '#f87171',
                  fontSize: '14px',
                  marginBottom: '20px'
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 10px 40px rgba(139, 92, 246, 0.3)',
                  opacity: loading ? 0.7 : 1
                }}
              >
                <LogIn style={{ width: '20px', height: '20px' }} />
                Entrar
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <button style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '14px', cursor: 'pointer' }}>
                Esqueci minha senha
              </button>
            </div>

            <div style={{ borderTop: '1px solid #3730a3', marginTop: '24px', paddingTop: '24px', textAlign: 'center' }}>
              <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Acesso restrito para colaboradores @trakto.io</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
