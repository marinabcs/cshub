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

// Usuarios do time (métricas de uso)
export async function getUsuariosTime(teamId) {
  const usuariosRef = collection(db, 'times', teamId, 'usuarios')
  const snapshot = await getDocs(usuariosRef)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
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

// Helpers
export function timestampToDate(timestamp) {
  if (!timestamp) return null
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate()
  }
  return new Date(timestamp)
}
