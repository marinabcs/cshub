import ThreadCard from './ThreadCard'
import { LoadingCard } from '../UI/Loading'

export default function ThreadsList({ threads, loading, onThreadClick }) {
  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <LoadingCard key={i} />
        ))}
      </div>
    )
  }

  if (threads.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <p className="text-gray-500">Nenhuma conversa encontrada.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {threads.map((thread) => (
        <ThreadCard
          key={thread.id}
          thread={thread}
          onClick={() => onThreadClick?.(thread)}
        />
      ))}
    </div>
  )
}
