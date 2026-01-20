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
    <div className="min-h-screen flex">
      {/* Lado Esquerdo - Features */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#1a1625] via-[#1e1a2e] to-[#151220] p-12 flex-col justify-between relative">
        {/* Background decorativo */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-40 right-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl"></div>
        </div>

        {/* Logo - Topo */}
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Users className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">CS Hub</h1>
            <p className="text-slate-400">Sistema de Customer Success v1.0</p>
          </div>
        </div>

        {/* Features - Meio */}
        <div className="relative z-10 space-y-7">
          <FeatureItem
            icon={Users}
            title="Gestão de Clientes"
            description="Acompanhe todos os clientes em um só lugar com informações completas e atualizadas."
          />
          <FeatureItem
            icon={BarChart3}
            title="Health Score"
            description="Monitore a saúde dos clientes em tempo real com métricas inteligentes."
          />
          <FeatureItem
            icon={Bell}
            title="Alertas Inteligentes"
            description="Receba notificações automáticas sobre clientes em risco ou que precisam de atenção."
          />
          <FeatureItem
            icon={MessageSquare}
            title="Timeline de Conversas"
            description="Histórico completo de todas as interações com cada cliente."
          />
        </div>

        {/* Rodapé - Base */}
        <div className="relative z-10">
          <div className="h-px bg-gradient-to-r from-transparent via-slate-600/50 to-transparent mb-6"></div>
          <p className="text-slate-500 text-sm">Feito com 💜 pelo time de CS</p>
        </div>
      </div>

      {/* Lado Direito - Login */}
      <div className="w-full lg:w-1/2 bg-[#0d0b12] flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Logo Mobile */}
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">CS Hub</h1>
              <p className="text-slate-400 text-xs">v1.0</p>
            </div>
          </div>

          {/* Card de Login */}
          <div className="bg-[#1a1625] border border-[#2d2640] rounded-3xl p-8 shadow-2xl">
            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Bem-vindo de volta!</h2>
              <p className="text-slate-400">Entre para gerenciar seus clientes</p>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.trakto.io"
                  className="w-full px-4 py-3.5 bg-[#0d0b12] border border-[#2d2640] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                  required
                />
              </div>

              {/* Senha */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3.5 bg-[#0d0b12] border border-[#2d2640] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all pr-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Erro */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Botão */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    Entrar
                  </>
                )}
              </button>
            </form>

            {/* Link */}
            <div className="mt-6 text-center">
              <button className="text-slate-400 hover:text-purple-400 text-sm transition-colors">
                Esqueci minha senha
              </button>
            </div>
          </div>

          {/* Aviso fora do card */}
          <p className="text-slate-600 text-xs text-center mt-6">
            Acesso restrito para colaboradores @trakto.io
          </p>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-11 h-11 bg-[#252035] border border-[#3a3350] rounded-xl flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-purple-400" />
      </div>
      <div className="pt-0.5">
        <h3 className="text-white font-semibold text-base mb-1">{title}</h3>
        <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
