import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore'
import { db } from './firebase'

// Clientes
export async function getClientes() {
  const clientesRef = collection(db, 'clientes')
  const q = query(clientesRef, orderBy('team_name'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export async function getClienteById(teamId) {
  const docRef = doc(db, 'clientes', teamId)
  const docSnap = await getDoc(docRef)
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() }
  }
  return null
}

export async function getClientesByStatus(status) {
  const clientesRef = collection(db, 'clientes')
  const q = query(clientesRef, where('health_status', '==', status))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export async function getClientesByResponsavel(email) {
  const clientesRef = collection(db, 'clientes')
  const q = query(clientesRef, where('responsavel_email', '==', email))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export async function getClientesCriticos(limite = 5) {
  const clientesRef = collection(db, 'clientes')
  const q = query(clientesRef, orderBy('health_score'), limit(limite))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

// Usuarios do time - busca de usuarios_lookup
export async function getUsuariosTime(teamId) {
  const usuariosRef = collection(db, 'usuarios_lookup')
  const q = query(usuariosRef, where('team_id', '==', teamId))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

// Contar usuários por team_id(s) a partir de usuarios_lookup
export async function getUsuariosCountByTeam(teamIds) {
  if (!teamIds || teamIds.length === 0) return {}

  const usuariosRef = collection(db, 'usuarios_lookup')
  const counts = {}

  teamIds.forEach(id => counts[id] = 0)

  const chunkSize = 10
  for (let i = 0; i < teamIds.length; i += chunkSize) {
    const chunk = teamIds.slice(i, i + chunkSize)
    const q = query(usuariosRef, where('team_id', 'in', chunk))
    const snapshot = await getDocs(q)

    snapshot.docs.forEach(doc => {
      const teamId = doc.data().team_id
      if (counts[teamId] !== undefined) {
        counts[teamId]++
      }
    })
  }

  return counts
}

// Threads - agora buscam de times/{teamId}/threads
export async function getThreadsCliente(teamId) {
  const threadsRef = collection(db, 'times', teamId, 'threads')
  const q = query(threadsRef, orderBy('updated_at', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

export async function getThreadById(teamId, threadId) {
  const docRef = doc(db, 'times', teamId, 'threads', threadId)
  const docSnap = await getDoc(docRef)
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() }
  }
  return null
}

// Mensagens - agora buscam de times/{teamId}/threads/{threadId}/mensagens
export async function getMensagensThread(teamId, threadId) {
  const mensagensRef = collection(db, 'times', teamId, 'threads', threadId, 'mensagens')
  const q = query(mensagensRef, orderBy('data', 'asc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

// Dashboard Stats
export async function getDashboardStats() {
  const clientes = await getClientes()

  const total = clientes.length
  const saudaveis = clientes.filter(c => c.health_status === 'saudavel').length
  const atencao = clientes.filter(c => c.health_status === 'atencao').length
  const risco = clientes.filter(c => c.health_status === 'risco').length
  const critico = clientes.filter(c => c.health_status === 'critico').length

  return { total, saudaveis, atencao, risco, critico }
}

// Heavy Users - ranking dos usuários mais ativos
export async function getHeavyUsers(teamIds, days = 30, topN = 10) {
  const metricasRef = collection(db, 'metricas_diarias')
  const dataLimite = new Date()
  dataLimite.setDate(dataLimite.getDate() - days)

  let allMetricas = []
  const chunkSize = 10

  for (let i = 0; i < teamIds.length; i += chunkSize) {
    const chunk = teamIds.slice(i, i + chunkSize)
    const q = query(
      metricasRef,
      where('team_id', 'in', chunk),
      where('data', '>=', dataLimite)
    )
    const snapshot = await getDocs(q)
    allMetricas.push(...snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })))
  }

  // Agregar por usuário
  const userMap = {}
  allMetricas.forEach(m => {
    // Ignora docs sem user_id (dados antigos)
    if (!m.user_id) return

    const key = m.user_id
    if (!userMap[key]) {
      userMap[key] = {
        user_id: m.user_id,
        user_email: m.user_email,
        user_nome: m.user_nome,
        team_id: m.team_id,
        logins: 0,
        pecas_criadas: 0,
        downloads: 0,
        uso_ai_total: 0,
        dias_ativos: 0
      }
    }
    userMap[key].logins += m.logins || 0
    userMap[key].pecas_criadas += m.pecas_criadas || 0
    userMap[key].downloads += m.downloads || 0
    userMap[key].uso_ai_total += m.uso_ai_total || 0
    userMap[key].dias_ativos += 1
  })

  // Calcular score de atividade
  const users = Object.values(userMap).map(u => ({
    ...u,
    activity_score: u.logins + (u.pecas_criadas * 2) + u.downloads + (u.uso_ai_total * 1.5)
  }))

  // Ordenar por score (decrescente)
  users.sort((a, b) => b.activity_score - a.activity_score)

  return users.slice(0, topN)
}

// Helpers
export function timestampToDate(timestamp) {
  if (!timestamp) return null
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate()
  }
  return new Date(timestamp)
}
