import { X, ArrowLeft } from 'lucide-react'
import { useMensagens } from '../../hooks/useThreads'
import { SentimentBadge, ThreadStatusBadge, CategoriaBadge } from '../UI/Badge'
import { Loading } from '../UI/Loading'
import { formatDateTime, getInitials } from '../../utils/helpers'
import { timestampToDate } from '../../services/api'

export default function ThreadDetail({ teamId, thread, onClose }) {
  const { mensagens, loading } = useMensagens(teamId, thread?.id)

  if (!thread) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
      <div className="w-full max-w-2xl bg-white h-full overflow-hidden flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thread Info */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2 mb-2">
            <SentimentBadge sentiment={thread.sentimento} />
            <h2 className="font-semibold text-gray-900">{thread.assunto}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <CategoriaBadge categoria={thread.categoria} />
            <ThreadStatusBadge status={thread.status} />
          </div>
          {thread.resumo_chat && (
            <p className="text-sm text-gray-600">{thread.resumo_chat}</p>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <Loading />
          ) : mensagens.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              Nenhuma mensagem encontrada.
            </p>
          ) : (
            mensagens.map((msg) => (
              <MessageBubble key={msg.id} mensagem={msg} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ mensagem }) {
  const isEquipe = mensagem.tipo_remetente === 'equipe'

  return (
    <div className={`flex gap-3 ${isEquipe ? 'flex-row-reverse' : ''}`}>
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
          isEquipe
            ? 'bg-primary-100 text-primary-700'
            : 'bg-gray-100 text-gray-700'
        }`}
      >
        {getInitials(mensagem.remetente_nome)}
      </div>

      <div className={`flex-1 max-w-[80%] ${isEquipe ? 'text-right' : ''}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-gray-900">
            {mensagem.remetente_nome}
          </span>
          <span className="text-xs text-gray-400">
            {formatDateTime(timestampToDate(mensagem.data))}
          </span>
        </div>
        <div
          className={`inline-block p-3 rounded-lg text-sm ${
            isEquipe
              ? 'bg-primary-600 text-white rounded-tr-none'
              : 'bg-gray-100 text-gray-900 rounded-tl-none'
          }`}
        >
          {mensagem.assunto && (
            <p className={`font-medium mb-1 ${isEquipe ? 'text-white' : 'text-gray-700'}`}>
              {mensagem.assunto}
            </p>
          )}
          <p>{mensagem.snippet}</p>
        </div>
      </div>
    </div>
  )
}
