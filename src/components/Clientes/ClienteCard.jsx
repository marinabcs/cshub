import { Link } from 'react-router-dom'
import { Users, Calendar, User } from 'lucide-react'
import { Card, CardContent } from '../UI/Card'
import { StatusBadge, Badge } from '../UI/Badge'
import { HealthBar } from '../UI/HealthBar'
import { formatRelativeTime } from '../../utils/helpers'
import { timestampToDate } from '../../services/api'

export default function ClienteCard({ cliente }) {
  return (
    <Link to={`/clientes/${cliente.id}`}>
      <Card className="hover:shadow-md hover:border-primary-200 transition-all duration-200 cursor-pointer">
        <CardContent>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                <span className="text-lg font-bold text-primary-600">
                  {cliente.team_name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{cliente.team_name}</h3>
                <p className="text-sm text-gray-500">{cliente.team_type}</p>
              </div>
            </div>
            <StatusBadge status={cliente.health_status} />
          </div>

          <div className="mb-4">
            <HealthBar score={cliente.health_score} />
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {cliente.tags?.map((tag, index) => (
              <Badge key={index} variant="primary">{tag}</Badge>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-gray-500">
              <User className="w-4 h-4" />
              <span className="truncate">{cliente.responsavel_nome}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <Users className="w-4 h-4" />
              <span>{cliente.total_usuarios || 0} usuários</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              Última interação: {formatRelativeTime(timestampToDate(cliente.ultima_interacao))}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
