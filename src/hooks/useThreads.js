import { useState, useEffect } from 'react'
import { getThreadsByTeam, getThreadById, getMensagensByThread } from '../services/api'

export function useThreads(teamId) {
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchThreads() {
      if (!teamId) return
      try {
        setLoading(true)
        const teamIds = Array.isArray(teamId) ? teamId : [teamId]
        const data = await getThreadsByTeam(teamIds)
        setThreads(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchThreads()
  }, [teamId])

  return { threads, loading, error }
}

export function useThread(threadId) {
  const [thread, setThread] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchThread() {
      if (!threadId) return
      try {
        setLoading(true)
        const data = await getThreadById(threadId)
        setThread(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchThread()
  }, [threadId])

  return { thread, loading, error }
}

export function useMensagens(threadId) {
  const [mensagens, setMensagens] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchMensagens() {
      if (!threadId) return
      try {
        setLoading(true)
        const data = await getMensagensByThread(threadId)
        setMensagens(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchMensagens()
  }, [threadId])

  return { mensagens, loading, error }
}
