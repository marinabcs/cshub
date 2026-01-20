import { Link } from 'react-router-dom'
import {
  Users,
  AlertTriangle,
  CheckCircle,
  TrendingDown,
  ArrowRight,
  Clock,
  Activity,
  Calendar,
  Target,
  Gift
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
      {/* Stats Cards - Linha 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              color="cyan"
            />
            <StatsCard
              title="Clientes Saudáveis"
              value={stats?.saudaveis || 0}
              icon={CheckCircle}
              color="green"
            />
            <StatsCard
              title="Precisam Atenção"
              value={(stats?.atencao || 0) + (stats?.risco || 0)}
              icon={AlertTriangle}
              color="orange"
            />
            <StatsCard
              title="Em Estado Crítico"
              value={stats?.critico || 0}
              icon={TrendingDown}
              color="red"
            />
          </>
        )}
      </div>

      {/* Stats Cards - Linha 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              title="Interações (mês)"
              value="-"
              icon={Activity}
              color="purple"
            />
            <StatsCard
              title="Tempo Médio Resposta"
              value="-"
              icon={Clock}
              color="amber"
            />
            <StatsCard
              title="NPS Médio"
              value="-"
              icon={Target}
              color="green"
            />
            <StatsCard
              title="Renovações (mês)"
              value="-"
              icon={Calendar}
              color="cyan"
            />
          </>
        )}
      </div>

      {/* Seções em Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clientes que precisam de atenção */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-semibold text-white">
                  Clientes em Atenção
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
          <CardContent className="p-0">
            {loadingCriticos ? (
              <div className="p-6">
                <Loading />
              </div>
            ) : clientesCriticos.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-dark-400">Nenhum cliente em estado crítico</p>
              </div>
            ) : (
              <div className="divide-y divide-dark-700">
                {clientesCriticos.map((cliente) => (
                  <ClienteRow key={cliente.id} cliente={cliente} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Distribuição por Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary-400" />
                <h2 className="text-base font-semibold text-white">
                  Distribuição por Status
                </h2>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Loading />
            ) : (
              <div className="space-y-5">
                <StatusBar
                  label="Saudáveis"
                  count={stats?.saudaveis || 0}
                  total={stats?.total || 1}
                  color="emerald"
                />
                <StatusBar
                  label="Atenção"
                  count={stats?.atencao || 0}
                  total={stats?.total || 1}
                  color="amber"
                />
                <StatusBar
                  label="Risco"
                  count={stats?.risco || 0}
                  total={stats?.total || 1}
                  color="orange"
                />
                <StatusBar
                  label="Crítico"
                  count={stats?.critico || 0}
                  total={stats?.total || 1}
                  color="red"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Seção de Aniversários - Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-pink-400" />
                <h2 className="text-base font-semibold text-white">
                  Aniversários do Mês
                </h2>
              </div>
              <span className="text-sm text-primary-400 font-medium">
                Ver todos →
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-dark-400 text-center py-8">
              Nenhum aniversário este mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-cyan-400" />
                <h2 className="text-base font-semibold text-white">
                  Renovações Próximas
                </h2>
              </div>
              <span className="text-sm text-primary-400 font-medium">
                Ver todos →
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-dark-400 text-center py-8">
              Nenhuma renovação próxima
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ClienteRow({ cliente }) {
  return (
    <Link
      to={`/clientes/${cliente.id}`}
      className="flex items-center gap-4 px-5 py-4 hover:bg-dark-750 transition-colors"
    >
      <div className="flex-shrink-0 w-10 h-10 bg-dark-700 rounded-xl flex items-center justify-center">
        <span className="text-sm font-semibold text-white">
          {cliente.team_name?.charAt(0).toUpperCase()}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-white truncate">
            {cliente.team_name}
          </p>
          <StatusBadge status={cliente.health_status} />
        </div>
        <p className="text-xs text-dark-400 mt-0.5">
          {cliente.responsavel_nome}
        </p>
      </div>

      <div className="flex-shrink-0 w-24 hidden sm:block">
        <HealthBar score={cliente.health_score} showLabel={false} size="sm" />
        <p className="text-xs text-dark-400 mt-1 text-center">{cliente.health_score}%</p>
      </div>
    </Link>
  )
}

function StatusBar({ label, count, total, color }) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0

  const colorClasses = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500'
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-dark-300">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-white">{count}</span>
          <span className="text-xs text-dark-500">{percentage}%</span>
        </div>
      </div>
      <div className="w-full bg-dark-700 rounded-full h-2 overflow-hidden">
        <div
          className={`${colorClasses[color]} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
