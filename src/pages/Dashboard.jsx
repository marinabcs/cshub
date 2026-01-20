import { Link } from 'react-router-dom'
import {
  Users,
  AlertTriangle,
  CheckCircle,
  TrendingDown,
  ArrowRight,
  ArrowUpRight,
  Bell,
  FileText,
  Activity,
  Clock
} from 'lucide-react'
import { useDashboardStats, useClientesCriticos } from '../hooks/useClientes'
import { StatsCard, Card, CardHeader, CardContent } from '../components/UI/Card'
import { StatusBadge } from '../components/UI/Badge'
import { HealthBar } from '../components/UI/HealthBar'
import { Loading, LoadingCard } from '../components/UI/Loading'
import { formatRelativeTime } from '../utils/helpers'
import { timestampToDate } from '../services/api'

export default function Dashboard() {
  const { stats, loading: loadingStats } = useDashboardStats()
  const { clientes: clientesCriticos, loading: loadingCriticos } = useClientesCriticos(5)

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {loadingStats ? (
          <>
            <LoadingCard />
            <LoadingCard />
            <LoadingCard />
            <LoadingCard />
          </>
        ) : (
          <>
            <StatsCard
              title="Total de Clientes"
              value={stats?.total || 0}
              subtitle="Clientes ativos"
              icon={Users}
              color="primary"
            />
            <StatsCard
              title="Clientes Saudáveis"
              value={stats?.saudaveis || 0}
              subtitle="Health score ≥ 80"
              icon={CheckCircle}
              color="success"
            />
            <StatsCard
              title="Precisam Atenção"
              value={(stats?.atencao || 0) + (stats?.risco || 0)}
              subtitle="Health score 40-79"
              icon={AlertTriangle}
              color="warning"
            />
            <StatsCard
              title="Em Estado Crítico"
              value={stats?.critico || 0}
              subtitle="Health score < 40"
              icon={TrendingDown}
              color="danger"
            />
          </>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Clientes que precisam de atenção - Takes 2 columns */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/20 rounded-lg">
                    <Bell className="w-5 h-5 text-amber-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-100">
                    Clientes que precisam de atenção
                  </h2>
                </div>
                <Link
                  to="/clientes"
                  className="text-sm text-primary-400 hover:text-primary-300 font-medium flex items-center gap-1 transition-colors"
                >
                  Ver todos
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {loadingCriticos ? (
                <div className="p-6">
                  <Loading />
                </div>
              ) : clientesCriticos.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                  </div>
                  <p className="text-slate-300 font-medium">Nenhum cliente em estado crítico</p>
                  <p className="text-slate-500 text-sm mt-1">Todos os clientes estão saudáveis!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {clientesCriticos.map((cliente) => (
                    <ClienteCard key={cliente.id} cliente={cliente} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Distribution & Actions */}
        <div className="space-y-6">
          {/* Distribuição por Status */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-500/20 rounded-lg">
                  <Activity className="w-5 h-5 text-primary-400" />
                </div>
                <h2 className="text-lg font-semibold text-slate-100">
                  Distribuição
                </h2>
              </div>
            </CardHeader>
            <CardContent>
              {loadingStats ? (
                <Loading />
              ) : (
                <div className="space-y-4">
                  <StatusRow
                    icon={CheckCircle}
                    label="Saudáveis"
                    count={stats?.saudaveis || 0}
                    total={stats?.total || 1}
                    color="emerald"
                  />
                  <StatusRow
                    icon={AlertTriangle}
                    label="Atenção"
                    count={stats?.atencao || 0}
                    total={stats?.total || 1}
                    color="amber"
                  />
                  <StatusRow
                    icon={AlertTriangle}
                    label="Risco"
                    count={stats?.risco || 0}
                    total={stats?.total || 1}
                    color="orange"
                  />
                  <StatusRow
                    icon={TrendingDown}
                    label="Crítico"
                    count={stats?.critico || 0}
                    total={stats?.total || 1}
                    color="red"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ações Rápidas */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-500/20 rounded-lg">
                  <ArrowUpRight className="w-5 h-5 text-slate-400" />
                </div>
                <h2 className="text-lg font-semibold text-slate-100">
                  Ações Rápidas
                </h2>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link
                to="/clientes"
                className="flex items-center gap-3 p-3 bg-dark-700/50 border border-dark-600 rounded-xl hover:bg-dark-700 hover:border-dark-500 transition-all group"
              >
                <div className="p-2 bg-primary-500/20 rounded-lg group-hover:bg-primary-500/30 transition-colors">
                  <Users className="w-4 h-4 text-primary-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-200">Ver Clientes</p>
                  <p className="text-xs text-slate-500">Lista completa</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
              </Link>

              <button
                disabled
                className="flex items-center gap-3 p-3 bg-dark-700/30 border border-dark-700 rounded-xl w-full opacity-50 cursor-not-allowed"
              >
                <div className="p-2 bg-dark-600 rounded-lg">
                  <Bell className="w-4 h-4 text-slate-500" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-slate-400">Alertas</p>
                  <p className="text-xs text-slate-600">Em breve</p>
                </div>
              </button>

              <button
                disabled
                className="flex items-center gap-3 p-3 bg-dark-700/30 border border-dark-700 rounded-xl w-full opacity-50 cursor-not-allowed"
              >
                <div className="p-2 bg-dark-600 rounded-lg">
                  <FileText className="w-4 h-4 text-slate-500" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-slate-400">Exportar Relatório</p>
                  <p className="text-xs text-slate-600">Em breve</p>
                </div>
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ClienteCard({ cliente }) {
  return (
    <Link
      to={`/clientes/${cliente.id}`}
      className="flex items-center gap-4 p-4 bg-dark-700/50 border border-dark-600 rounded-xl hover:bg-dark-700 hover:border-dark-500 transition-all group"
    >
      {/* Avatar */}
      <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl flex items-center justify-center border border-slate-500/30">
        <span className="text-lg font-bold text-white">
          {cliente.team_name?.charAt(0).toUpperCase()}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-semibold text-slate-100 truncate group-hover:text-white transition-colors">
            {cliente.team_name}
          </p>
          <StatusBadge status={cliente.health_status} />
        </div>
        <p className="text-xs text-slate-500">
          {cliente.team_type} • {cliente.responsavel_nome}
        </p>
      </div>

      {/* Health Bar */}
      <div className="flex-shrink-0 w-28">
        <HealthBar score={cliente.health_score} size="md" showLabel />
      </div>

      {/* Last Interaction */}
      <div className="flex-shrink-0 hidden sm:block">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Clock className="w-3.5 h-3.5" />
          <span>{formatRelativeTime(timestampToDate(cliente.ultima_interacao))}</span>
        </div>
      </div>

      {/* Arrow */}
      <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0" />
    </Link>
  )
}

function StatusRow({ icon: Icon, label, count, total, color }) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0

  const colorClasses = {
    emerald: {
      icon: 'text-emerald-400',
      iconBg: 'bg-emerald-500/20',
      bar: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
      text: 'text-emerald-400'
    },
    amber: {
      icon: 'text-amber-400',
      iconBg: 'bg-amber-500/20',
      bar: 'bg-gradient-to-r from-amber-500 to-amber-400',
      text: 'text-amber-400'
    },
    orange: {
      icon: 'text-orange-400',
      iconBg: 'bg-orange-500/20',
      bar: 'bg-gradient-to-r from-orange-500 to-orange-400',
      text: 'text-orange-400'
    },
    red: {
      icon: 'text-red-400',
      iconBg: 'bg-red-500/20',
      bar: 'bg-gradient-to-r from-red-500 to-red-400',
      text: 'text-red-400'
    }
  }

  const colors = colorClasses[color] || colorClasses.emerald

  return (
    <div className="flex items-center gap-3">
      <div className={`p-1.5 ${colors.iconBg} rounded-lg flex-shrink-0`}>
        <Icon className={`w-4 h-4 ${colors.icon}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-sm text-slate-400">{label}</span>
          <div className="flex items-center gap-2">
            <span className={`text-lg font-bold ${colors.text}`}>{count}</span>
            <span className="text-xs text-slate-600">({percentage}%)</span>
          </div>
        </div>
        <div className="w-full bg-dark-700 rounded-full h-2.5 overflow-hidden">
          <div
            className={`${colors.bar} h-2.5 rounded-full transition-all duration-500`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  )
}
