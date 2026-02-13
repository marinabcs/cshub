import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Users, BarChart3, Bell, MessageSquare, LogIn, Eye, EyeOff, Loader2, Shield } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    setLoading(true);
    try {
      // Usa login do AuthContext (inclui audit log automático)
      await login(email.toLowerCase(), password);
      navigate('/');
    } catch (err) {
      // Mensagens de erro amigáveis
      if (err.message?.includes('@trakto.io')) {
        setError('Apenas emails @trakto.io podem acessar o sistema');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('Email ou senha inválidos');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
      } else {
        setError('Erro ao fazer login. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (!forgotEmail) {
      setError('Digite seu email');
      return;
    }

    if (!forgotEmail.toLowerCase().endsWith('@trakto.io')) {
      setError('Apenas emails @trakto.io podem recuperar senha');
      return;
    }

    setForgotLoading(true);
    try {
      await sendPasswordResetEmail(auth, forgotEmail);
      setForgotSuccess(true);
    } catch {
      setError('Erro ao enviar email. Verifique o endereço e tente novamente.');
    } finally {
      setForgotLoading(false);
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
            { icon: Users, title: 'Gestão de Clientes', desc: 'Acompanhe todos os clientes em um só lugar com métricas de engajamento.' },
            { icon: BarChart3, title: 'Saúde CS Automática', desc: 'Classificação inteligente: Crescimento, Estável, Alerta e Resgate.' },
            { icon: Bell, title: 'Alertas com IA', desc: 'Detecção automática de sentimento negativo e clientes em risco.' },
            { icon: Shield, title: 'Segurança', desc: 'Backup diário, audit log e session timeout para proteção dos dados.' }
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
                  placeholder="seuemail@trakto.io"
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
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(true);
                  setForgotEmail(email);
                  setForgotSuccess(false);
                  setError('');
                }}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '14px', cursor: 'pointer' }}
              >
                Esqueci minha senha
              </button>
            </div>

            <div style={{ borderTop: '1px solid #3730a3', marginTop: '24px', paddingTop: '24px', textAlign: 'center' }}>
              <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Acesso restrito para colaboradores @trakto.io</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Esqueci minha senha */}
      {showForgotPassword && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div style={{
            background: 'rgba(30, 27, 75, 0.95)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '20px',
            padding: '32px',
            width: '100%',
            maxWidth: '400px'
          }}>
            {forgotSuccess ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px'
                }}>
                  <MessageSquare style={{ width: '32px', height: '32px', color: '#10b981' }} />
                </div>
                <h3 style={{ color: 'white', fontSize: '20px', fontWeight: '600', margin: '0 0 12px 0' }}>
                  Email enviado!
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 24px 0' }}>
                  Verifique sua caixa de entrada em <strong style={{ color: 'white' }}>{forgotEmail}</strong> para redefinir sua senha.
                </p>
                <button
                  onClick={() => setShowForgotPassword(false)}
                  style={{
                    width: '100%',
                    padding: '12px 20px',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                    border: 'none',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Voltar ao Login
                </button>
              </div>
            ) : (
              <>
                <h3 style={{ color: 'white', fontSize: '20px', fontWeight: '600', margin: '0 0 8px 0' }}>
                  Esqueceu sua senha?
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 24px 0' }}>
                  Digite seu email @trakto.io e enviaremos um link para redefinir sua senha.
                </p>

                <form onSubmit={handleForgotPassword}>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', color: '#e2e8f0', fontSize: '14px', marginBottom: '8px' }}>E-mail</label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="seuemail@trakto.io"
                      required
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: '#0f0a1f',
                        border: '1px solid #3730a3',
                        borderRadius: '12px',
                        color: 'white',
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
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

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(false);
                        setError('');
                      }}
                      style={{
                        flex: 1,
                        padding: '12px 20px',
                        background: 'rgba(100, 116, 139, 0.1)',
                        border: '1px solid rgba(100, 116, 139, 0.3)',
                        borderRadius: '12px',
                        color: '#94a3b8',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      style={{
                        flex: 1,
                        padding: '12px 20px',
                        background: forgotLoading ? 'rgba(139, 92, 246, 0.5)' : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                        border: 'none',
                        borderRadius: '12px',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: forgotLoading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      {forgotLoading ? (
                        <>
                          <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                          Enviando...
                        </>
                      ) : 'Enviar Email'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
