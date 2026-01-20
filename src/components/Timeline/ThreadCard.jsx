import { MessageSquare, Clock, User } from 'lucide-react'
import { Card, CardContent } from '../UI/Card'
import { SentimentBadge, ThreadStatusBadge, CategoriaBadge } from '../UI/Badge'
import { formatRelativeTime, truncateText } from '../../utils/helpers'
import { timestampToDate } from '../../services/api'

export default function ThreadCard({ thread, onClick }) {
  return (
    <Card
      className="hover:shadow-md hover:border-primary-200 transition-all duration-200 cursor-pointer"
      onClick={onClick}
    >
      <CardContent>
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <SentimentBadge sentiment={thread.sentimento} />
              <h3 className="font-medium text-gray-900 truncate">
                {thread.assunto}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CategoriaBadge categoria={thread.categoria} />
              <ThreadStatusBadge status={thread.status} />
            </div>
          </div>
        </div>

        {thread.resumo_chat && (
          <p className="text-sm text-gray-600 mb-3">
            {truncateText(thread.resumo_chat, 150)}
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />
              {thread.total_mensagens || 0} mensagens
            </span>
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5" />
              {thread.colaborador_responsavel?.split('@')[0]}
            </span>
          </div>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {formatRelativeTime(timestampToDate(thread.updated_at))}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
