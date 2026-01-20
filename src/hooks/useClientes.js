import { useState, useEffect } from 'react'
import { getClientes, getClienteById, getClientesCriticos, getDashboardStats } from '../services/api'

export function useClientes() {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchClientes() {
      try {
        setLoading(true)
        const data = await getClientes()
        setClientes(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchClientes()
  }, [])

  return { clientes, loading, error, refetch: () => {} }
}

export function useCliente(teamId) {
  const [cliente, setCliente] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchCliente() {
      if (!teamId) return
      try {
        setLoading(true)
        const data = await getClienteById(teamId)
        setCliente(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchCliente()
  }, [teamId])

  return { cliente, loading, error }
}

export function useClientesCriticos(limite = 5) {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchClientes() {
      try {
        setLoading(true)
        const data = await getClientesCriticos(limite)
        setClientes(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchClientes()
  }, [limite])

  return { clientes, loading, error }
}

export function useDashboardStats() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true)
        const data = await getDashboardStats()
        setStats(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  return { stats, loading, error }
}
