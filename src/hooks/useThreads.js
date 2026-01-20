import { useState, useEffect } from 'react'
import { getThreadsCliente, getThreadById, getMensagensThread } from '../services/api'

export function useThreads(teamId) {
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchThreads() {
      if (!teamId) return
      try {
        setLoading(true)
        const data = await getThreadsCliente(teamId)
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

export function useThread(teamId, threadId) {
  const [thread, setThread] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchThread() {
      if (!teamId || !threadId) return
      try {
        setLoading(true)
        const data = await getThreadById(teamId, threadId)
        setThread(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchThread()
  }, [teamId, threadId])

  return { thread, loading, error }
}

export function useMensagens(teamId, threadId) {
  const [mensagens, setMensagens] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchMensagens() {
      if (!teamId || !threadId) return
      try {
        setLoading(true)
        const data = await getMensagensThread(teamId, threadId)
        setMensagens(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchMensagens()
  }, [teamId, threadId])

  return { mensagens, loading, error }
}
