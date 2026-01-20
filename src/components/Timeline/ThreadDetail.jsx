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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-end">
      <div className="w-full max-w-2xl bg-dark-900 h-full overflow-hidden flex flex-col animate-slide-in border-l border-dark-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-700">
          <button
            onClick={onClose}
            className="p-2 text-dark-400 hover:text-white rounded-lg hover:bg-dark-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            className="p-2 text-dark-400 hover:text-white rounded-lg hover:bg-dark-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thread Info */}
        <div className="p-4 border-b border-dark-700 bg-dark-800">
          <div className="flex items-center gap-2 mb-2">
            <SentimentBadge sentiment={thread.sentimento} />
            <h2 className="font-semibold text-white">{thread.assunto}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <CategoriaBadge categoria={thread.categoria} />
            <ThreadStatusBadge status={thread.status} />
          </div>
          {thread.resumo_chat && (
            <p className="text-sm text-dark-400">{thread.resumo_chat}</p>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-dark-900">
          {loading ? (
            <Loading />
          ) : mensagens.length === 0 ? (
            <p className="text-center text-dark-500 py-8">
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
            ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
            : 'bg-dark-700 text-dark-400 border border-dark-600'
        }`}
      >
        {getInitials(mensagem.remetente_nome)}
      </div>

      <div className={`flex-1 max-w-[80%] ${isEquipe ? 'text-right' : ''}`}>
        <div className={`flex items-center gap-2 mb-1 ${isEquipe ? 'justify-end' : ''}`}>
          <span className="text-sm font-medium text-white">
            {mensagem.remetente_nome}
          </span>
          <span className="text-xs text-dark-500">
            {formatDateTime(timestampToDate(mensagem.data))}
          </span>
        </div>
        <div
          className={`inline-block p-3 rounded-xl text-sm ${
            isEquipe
              ? 'bg-primary-600 text-white rounded-tr-none'
              : 'bg-dark-700 text-dark-200 rounded-tl-none border border-dark-600'
          }`}
        >
          {mensagem.assunto && (
            <p className={`font-medium mb-1 ${isEquipe ? 'text-white' : 'text-dark-300'}`}>
              {mensagem.assunto}
            </p>
          )}
          <p>{mensagem.snippet}</p>
        </div>
      </div>
    </div>
  )
}
