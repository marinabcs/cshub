import { Link } from 'react-router-dom'
import { Users, Calendar, User } from 'lucide-react'
import { Card, CardContent } from '../UI/Card'
import { Badge } from '../UI/Badge'
import { SegmentoBadge } from '../UI/SegmentoBadge'
import { formatRelativeTime } from '../../utils/helpers'
import { timestampToDate } from '../../services/api'
import { getClienteSegmento } from '../../utils/segmentoCS'

export default function ClienteCard({ cliente, usuariosCount = 0 }) {
  return (
    <Link to={`/clientes/${cliente.id}`}>
      <Card className="hover:border-primary-500/50 hover:shadow-lg hover:shadow-primary-500/5 transition-all duration-200 cursor-pointer">
        <CardContent>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-600/20 to-primary-500/10 rounded-xl flex items-center justify-center border border-primary-500/30">
                <span className="text-lg font-bold text-primary-400">
                  {cliente.team_name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-white">{cliente.team_name}</h3>
                <p className="text-sm text-dark-400">{cliente.team_type}</p>
              </div>
            </div>
            <SegmentoBadge segmento={getClienteSegmento(cliente)} size="sm" />
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {cliente.tags?.map((tag, index) => (
              <Badge key={index} variant="primary">{tag}</Badge>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-dark-400">
              <User className="w-4 h-4" />
              <span className="truncate">{cliente.responsavel_nome}</span>
            </div>
            <div className="flex items-center gap-2 text-dark-400">
              <Users className="w-4 h-4" />
              <span>{usuariosCount} usuários</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-dark-700/50 flex items-center gap-2 text-xs text-dark-500">
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
