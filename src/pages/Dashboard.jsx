import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  AlertTriangle,
  Clock,
  CheckCircle,
  TrendingDown,
  Database,
  Loader2
} from 'lucide-react'
import { useDashboardStats, useClientesCriticos } from '../hooks/useClientes'
import { StatsCard, Card, CardHeader, CardContent } from '../components/UI/Card'
import { StatusBadge } from '../components/UI/Badge'
import { HealthBar } from '../components/UI/HealthBar'
import { Loading, LoadingCard } from '../components/UI/Loading'
import { formatRelativeTime } from '../utils/helpers'
import { timestampToDate } from '../services/api'
import { seedDatabase } from '../utils/seedData'

export default function Dashboard() {
  const { stats, loading: loadingStats } = useDashboardStats()
  const { clientes: clientesCriticos, loading: loadingCriticos } = useClientesCriticos(5)
  const [seeding, setSeeding] = useState(false)
  const [seedResult, setSeedResult] = useState(null)

  async function handleSeed() {
    if (seeding) return

    const confirmed = window.confirm(
      'Isso irá popular o banco de dados com dados de teste. Deseja continuar?'
    )

    if (!confirmed) return

    setSeeding(true)
    setSeedResult(null)

    try {
      const result = await seedDatabase()
      setSeedResult(result)
      // Recarrega a página após 2 segundos para mostrar os novos dados
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (err) {
      setSeedResult({ errors: [err.message] })
    } finally {
      setSeeding(false)
    }
  }

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
            />
            <StatsCard
              title="Clientes Saudáveis"
              value={stats?.saudaveis || 0}
              icon={CheckCircle}
            />
            <StatsCard
              title="Precisam Atenção"
              value={(stats?.atencao || 0) + (stats?.risco || 0)}
              icon={AlertTriangle}
            />
            <StatsCard
              title="Em Estado Crítico"
              value={stats?.critico || 0}
              icon={TrendingDown}
            />
          </>
        )}
      </div>

      {/* Clientes Críticos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Clientes que precisam de atenção
            </h2>
            <Link
              to="/clientes"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Ver todos
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingCriticos ? (
            <div className="p-6">
              <Loading />
            </div>
          ) : clientesCriticos.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              Nenhum cliente em estado crítico. Bom trabalho!
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {clientesCriticos.map((cliente) => (
                <Link
                  key={cliente.id}
                  to={`/clientes/${cliente.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-600">
                      {cliente.team_name?.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {cliente.team_name}
                      </p>
                      <StatusBadge status={cliente.health_status} />
                    </div>
                    <p className="text-xs text-gray-500">
                      {cliente.team_type} • {cliente.responsavel_nome}
                    </p>
                  </div>

                  <div className="flex-shrink-0 w-32">
                    <HealthBar score={cliente.health_score} size="sm" />
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-gray-500">
                      Última interação
                    </p>
                    <p className="text-sm text-gray-700">
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
            <h2 className="text-lg font-semibold text-gray-900">
              Distribuição por Status
            </h2>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Loading />
            ) : (
              <div className="space-y-4">
                <StatusRow
                  label="Saudáveis"
                  count={stats?.saudaveis || 0}
                  total={stats?.total || 1}
                  color="bg-emerald-500"
                />
                <StatusRow
                  label="Atenção"
                  count={stats?.atencao || 0}
                  total={stats?.total || 1}
                  color="bg-amber-500"
                />
                <StatusRow
                  label="Risco"
                  count={stats?.risco || 0}
                  total={stats?.total || 1}
                  color="bg-orange-500"
                />
                <StatusRow
                  label="Crítico"
                  count={stats?.critico || 0}
                  total={stats?.total || 1}
                  color="bg-red-500"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">
              Ações Rápidas
            </h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Link
                to="/clientes"
                className="p-4 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors text-center"
              >
                <Users className="w-8 h-8 text-primary-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-primary-700">Ver Clientes</p>
              </Link>
              <div className="p-4 bg-gray-50 rounded-lg text-center opacity-50">
                <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-500">Em breve</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dev Tools - Temporário */}
      <Card className="border-dashed border-2 border-amber-300 bg-amber-50/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-amber-800">
              Dev Tools (Temporário)
            </h2>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-700 mb-4">
            Use este botão para popular o banco de dados com dados de teste.
            Remova esta seção antes de ir para produção.
          </p>

          <button
            onClick={handleSeed}
            disabled={seeding}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {seeding ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Populando banco...
              </>
            ) : (
              <>
                <Database className="w-4 h-4" />
                Popular banco com dados de teste
              </>
            )}
          </button>

          {seedResult && (
            <div className={`mt-4 p-4 rounded-lg ${seedResult.errors?.length > 0 ? 'bg-red-100' : 'bg-emerald-100'}`}>
              {seedResult.errors?.length > 0 ? (
                <div className="text-red-700">
                  <p className="font-medium">Erros encontrados:</p>
                  <ul className="list-disc list-inside text-sm mt-1">
                    {seedResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="text-emerald-700">
                  <p className="font-medium">Seed concluído com sucesso!</p>
                  <ul className="text-sm mt-1">
                    <li>{seedResult.clientes} clientes criados</li>
                    <li>{seedResult.usuarios} usuários criados</li>
                    <li>{seedResult.threads} threads criadas</li>
                    <li>{seedResult.mensagens} mensagens criadas</li>
                  </ul>
                  <p className="text-sm mt-2">Recarregando página...</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatusRow({ label, count, total, color }) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-900">{count} ({percentage}%)</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
