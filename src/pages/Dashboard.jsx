import { Link } from 'react-router-dom'
import {
  Users,
  AlertTriangle,
  CheckCircle,
  TrendingDown,
  ArrowRight
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
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              icon={Users}
              color="primary"
            />
            <StatsCard
              title="Clientes Saudáveis"
              value={stats?.saudaveis || 0}
              icon={CheckCircle}
              color="success"
            />
            <StatsCard
              title="Precisam Atenção"
              value={(stats?.atencao || 0) + (stats?.risco || 0)}
              icon={AlertTriangle}
              color="warning"
            />
            <StatsCard
              title="Em Estado Crítico"
              value={stats?.critico || 0}
              icon={TrendingDown}
              color="danger"
            />
          </>
        )}
      </div>

      {/* Clientes Críticos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">
              Clientes que precisam de atenção
            </h2>
            <Link
              to="/clientes"
              className="text-sm text-primary-400 hover:text-primary-300 font-medium flex items-center gap-1 transition-colors"
            >
              Ver todos
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingCriticos ? (
            <div className="p-6">
              <Loading />
            </div>
          ) : clientesCriticos.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <p className="text-slate-300 font-medium">Nenhum cliente em estado crítico</p>
              <p className="text-slate-500 text-sm mt-1">Bom trabalho!</p>
            </div>
          ) : (
            <div className="divide-y divide-dark-700">
              {clientesCriticos.map((cliente) => (
                <Link
                  key={cliente.id}
                  to={`/clientes/${cliente.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-dark-700/50 transition-colors"
                >
                  <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-dark-700 to-dark-600 rounded-xl flex items-center justify-center border border-dark-600">
                    <span className="text-sm font-semibold text-slate-300">
                      {cliente.team_name?.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-100 truncate">
                        {cliente.team_name}
                      </p>
                      <StatusBadge status={cliente.health_status} />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {cliente.team_type} • {cliente.responsavel_nome}
                    </p>
                  </div>

                  <div className="flex-shrink-0 w-32">
                    <HealthBar score={cliente.health_score} size="sm" />
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-slate-500">
                      Última interação
                    </p>
                    <p className="text-sm text-slate-300">
                      {formatRelativeTime(timestampToDate(cliente.ultima_interacao))}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-100">
              Distribuição por Status
            </h2>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Loading />
            ) : (
              <div className="space-y-5">
                <StatusRow
                  label="Saudáveis"
                  count={stats?.saudaveis || 0}
                  total={stats?.total || 1}
                  color="bg-emerald-500"
                  bgColor="bg-emerald-500/20"
                />
                <StatusRow
                  label="Atenção"
                  count={stats?.atencao || 0}
                  total={stats?.total || 1}
                  color="bg-amber-500"
                  bgColor="bg-amber-500/20"
                />
                <StatusRow
                  label="Risco"
                  count={stats?.risco || 0}
                  total={stats?.total || 1}
                  color="bg-orange-500"
                  bgColor="bg-orange-500/20"
                />
                <StatusRow
                  label="Crítico"
                  count={stats?.critico || 0}
                  total={stats?.total || 1}
                  color="bg-red-500"
                  bgColor="bg-red-500/20"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-100">
              Ações Rápidas
            </h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Link
                to="/clientes"
                className="p-5 bg-primary-500/10 border border-primary-500/20 rounded-xl hover:bg-primary-500/20 hover:border-primary-500/30 transition-all text-center group"
              >
                <div className="w-12 h-12 bg-primary-500/20 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <Users className="w-6 h-6 text-primary-400" />
                </div>
                <p className="text-sm font-medium text-primary-300">Ver Clientes</p>
              </Link>
              <div className="p-5 bg-dark-700/50 border border-dark-600 rounded-xl text-center opacity-60 cursor-not-allowed">
                <div className="w-12 h-12 bg-dark-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <AlertTriangle className="w-6 h-6 text-slate-500" />
                </div>
                <p className="text-sm font-medium text-slate-500">Em breve</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatusRow({ label, count, total, color, bgColor }) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0

  return (
    <div>
      <div className="flex justify-between text-sm mb-2">
        <span className="text-slate-400">{label}</span>
        <span className="font-medium text-slate-200">{count} <span className="text-slate-500">({percentage}%)</span></span>
      </div>
      <div className="w-full bg-dark-700 rounded-full h-2.5 overflow-hidden">
        <div
          className={`${color} h-2.5 rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
