import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Users, Mail, Building, User } from 'lucide-react'
import { useCliente } from '../hooks/useClientes'
import { useThreads } from '../hooks/useThreads'
import { getUsuariosCliente, timestampToDate } from '../services/api'
import { Card, CardHeader, CardContent } from '../components/UI/Card'
import { StatusBadge, Badge } from '../components/UI/Badge'
import { HealthScoreCircle, HealthBar } from '../components/UI/HealthBar'
import { Loading, LoadingPage } from '../components/UI/Loading'
import { ThreadsList, ThreadDetail } from '../components/Timeline'
import { formatDate, formatRelativeTime } from '../utils/helpers'

export default function ClienteDetalhe() {
  const { teamId } = useParams()
  const { cliente, loading: loadingCliente } = useCliente(teamId)
  const { threads, loading: loadingThreads } = useThreads(teamId)
  const [usuarios, setUsuarios] = useState([])
  const [loadingUsuarios, setLoadingUsuarios] = useState(true)
  const [activeTab, setActiveTab] = useState('timeline')
  const [selectedThread, setSelectedThread] = useState(null)

  useEffect(() => {
    async function fetchUsuarios() {
      if (!teamId) return
      try {
        const data = await getUsuariosCliente(teamId)
        setUsuarios(data)
      } catch (err) {
        console.error('Erro ao buscar usuários:', err)
      } finally {
        setLoadingUsuarios(false)
      }
    }
    fetchUsuarios()
  }, [teamId])

  if (loadingCliente) {
    return <LoadingPage />
  }

  if (!cliente) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Cliente não encontrado.</p>
        <Link to="/clientes" className="text-primary-600 hover:underline mt-4 inline-block">
          Voltar para clientes
        </Link>
      </div>
    )
  }

  const tabs = [
    { id: 'timeline', label: 'Timeline', count: threads.length },
    { id: 'usuarios', label: 'Usuários', count: usuarios.length },
    { id: 'info', label: 'Informações' }
  ]

  return (
    <div>
      {/* Back Link */}
      <Link
        to="/clientes"
        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para clientes
      </Link>

      {/* Header */}
      <Card className="mb-6">
        <CardContent>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center">
                <span className="text-2xl font-bold text-primary-600">
                  {cliente.team_name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold text-gray-900">{cliente.team_name}</h1>
                  <StatusBadge status={cliente.health_status} />
                </div>
                <p className="text-gray-500">{cliente.team_type}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {cliente.tags?.map((tag, index) => (
                    <Badge key={index} variant="primary">{tag}</Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-center">
                <HealthScoreCircle score={cliente.health_score} size="lg" />
                <p className="text-xs text-gray-500 mt-1">Health Score</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Última interação</p>
                <p className="font-medium text-gray-900">
                  {formatRelativeTime(timestampToDate(cliente.ultima_interacao))}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                pb-4 text-sm font-medium border-b-2 transition-colors
                ${activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                }
              `}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'timeline' && (
        <ThreadsList
          threads={threads}
          loading={loadingThreads}
          onThreadClick={setSelectedThread}
        />
      )}

      {activeTab === 'usuarios' && (
        <UsuariosTab usuarios={usuarios} loading={loadingUsuarios} />
      )}

      {activeTab === 'info' && (
        <InfoTab cliente={cliente} />
      )}

      {/* Thread Detail Modal */}
      {selectedThread && (
        <ThreadDetail
          teamId={teamId}
          thread={selectedThread}
          onClose={() => setSelectedThread(null)}
        />
      )}
    </div>
  )
}

function UsuariosTab({ usuarios, loading }) {
  if (loading) {
    return <Loading />
  }

  if (usuarios.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <p className="text-gray-500">Nenhum usuário cadastrado.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {usuarios.map((usuario) => (
        <Card key={usuario.id}>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{usuario.nome}</p>
                <p className="text-sm text-gray-500 truncate">{usuario.email}</p>
                {usuario.dominio && (
                  <p className="text-xs text-gray-400">{usuario.dominio}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function InfoTab({ cliente }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-gray-900">Informações Gerais</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <InfoRow
            icon={Building}
            label="Team ID"
            value={cliente.team_id || cliente.id}
          />
          <InfoRow
            icon={Building}
            label="Tipo"
            value={cliente.team_type}
          />
          <InfoRow
            icon={Users}
            label="Total de Usuários"
            value={cliente.total_usuarios || 0}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="font-semibold text-gray-900">Responsável</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <InfoRow
            icon={User}
            label="Nome"
            value={cliente.responsavel_nome}
          />
          <InfoRow
            icon={Mail}
            label="Email"
            value={cliente.responsavel_email}
          />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <h3 className="font-semibold text-gray-900">Health Score</h3>
        </CardHeader>
        <CardContent>
          <HealthBar score={cliente.health_score} />
          <div className="mt-4 grid grid-cols-4 gap-4 text-center text-sm">
            <div className={`p-3 rounded-lg ${cliente.health_score >= 80 ? 'bg-emerald-100' : 'bg-gray-50'}`}>
              <p className="font-medium text-emerald-700">80-100</p>
              <p className="text-xs text-gray-500">Saudável</p>
            </div>
            <div className={`p-3 rounded-lg ${cliente.health_score >= 60 && cliente.health_score < 80 ? 'bg-amber-100' : 'bg-gray-50'}`}>
              <p className="font-medium text-amber-700">60-79</p>
              <p className="text-xs text-gray-500">Atenção</p>
            </div>
            <div className={`p-3 rounded-lg ${cliente.health_score >= 40 && cliente.health_score < 60 ? 'bg-orange-100' : 'bg-gray-50'}`}>
              <p className="font-medium text-orange-700">40-59</p>
              <p className="text-xs text-gray-500">Risco</p>
            </div>
            <div className={`p-3 rounded-lg ${cliente.health_score < 40 ? 'bg-red-100' : 'bg-gray-50'}`}>
              <p className="font-medium text-red-700">0-39</p>
              <p className="text-xs text-gray-500">Crítico</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-medium text-gray-900">{value || '-'}</p>
      </div>
    </div>
  )
}
