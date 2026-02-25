/**
 * dataAccess.js - Unified Data Access Layer for CS Hub
 *
 * Centralized Firestore operations with consistent caching, cache invalidation,
 * parallel chunk queries, and plain-object returns.
 *
 * Collections covered:
 *   clientes, threads, mensagens, alertas, metricas_diarias,
 *   usuarios_sistema, usuarios_lookup, documentos, observacoes_cs,
 *   interacoes, config, templates_comunicacao
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore'
import { db } from './firebase'
import {
  getCached,
  setCached,
  invalidateCache,
  invalidateCachePrefix
} from './cache'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TTL_CLIENTES = 300000    // 5 min
const TTL_USUARIOS = 600000    // 10 min
const TTL_CONFIG = 300000      // 5 min
const TTL_THREADS = 300000     // 5 min
const TTL_ALERTAS = 300000     // 5 min
const TTL_TEMPLATES = 600000   // 10 min

const CHUNK_SIZE = 10 // Firestore 'in' query limit

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Convert a Firestore snapshot doc to a plain object with `id`. */
function docToObj(docSnap) {
  return { id: docSnap.id, ...docSnap.data() }
}

/** Split an array into chunks of `size`. */
function chunks(arr, size = CHUNK_SIZE) {
  const result = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}

/**
 * Execute parallel chunked `in` queries and return a flat array of plain objects.
 * @param {import('firebase/firestore').CollectionReference} colRef
 * @param {string} field - the field to use in the `in` clause
 * @param {string[]} values - values to query (will be chunked automatically)
 * @param {Array} extraConstraints - additional query constraints (where, orderBy, etc.)
 */
async function chunkedQuery(colRef, field, values, extraConstraints = []) {
  if (!values || values.length === 0) return []

  const promises = chunks(values).map(chunk => {
    const q = query(colRef, where(field, 'in', chunk), ...extraConstraints)
    return getDocs(q)
  })
  const snapshots = await Promise.all(promises)
  return snapshots.flatMap(snap => snap.docs.map(docToObj))
}

// ============================================================================
// READ OPERATIONS (with caching)
// ============================================================================

// ---------- Clientes --------------------------------------------------------

/**
 * Fetch all clientes, ordered by team_name. Cached for 5 min.
 * @returns {Promise<Array<Object>>}
 */
export async function fetchAllClientes() {
  const cacheKey = 'da:clientes:all'
  const cached = getCached(cacheKey)
  if (cached) return cached

  const q = query(collection(db, 'clientes'), orderBy('team_name'))
  const snap = await getDocs(q)
  const data = snap.docs.map(docToObj)
  setCached(cacheKey, data, TTL_CLIENTES)
  return data
}

/**
 * Fetch a single cliente by its document ID.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function fetchClienteById(id) {
  const cacheKey = `da:cliente:${id}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const docSnap = await getDoc(doc(db, 'clientes', id))
  if (!docSnap.exists()) return null

  const data = docToObj(docSnap)
  setCached(cacheKey, data, TTL_CLIENTES)
  return data
}

// ---------- Usuarios Sistema ------------------------------------------------

/**
 * Fetch all usuarios_sistema. Cached for 10 min.
 * @returns {Promise<Array<Object>>}
 */
export async function fetchUsuariosSistema() {
  const cacheKey = 'da:usuarios_sistema:all'
  const cached = getCached(cacheKey)
  if (cached) return cached

  const snap = await getDocs(collection(db, 'usuarios_sistema'))
  const data = snap.docs.map(docToObj)
  setCached(cacheKey, data, TTL_USUARIOS)
  return data
}

/**
 * Fetch a single usuario_sistema by UID.
 * @param {string} uid
 * @returns {Promise<Object|null>}
 */
export async function fetchUsuarioSistemaById(uid) {
  const cacheKey = `da:usuario_sistema:${uid}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const docSnap = await getDoc(doc(db, 'usuarios_sistema', uid))
  if (!docSnap.exists()) return null

  const data = docToObj(docSnap)
  setCached(cacheKey, data, TTL_USUARIOS)
  return data
}

// ---------- Usuarios Lookup -------------------------------------------------

/**
 * Fetch usuarios_lookup for an array of team IDs (chunked parallel queries).
 * @param {string[]} teamIds
 * @returns {Promise<Array<Object>>}
 */
export async function fetchUsuariosLookupByTeam(teamIds) {
  return chunkedQuery(collection(db, 'usuarios_lookup'), 'team_id', teamIds)
}

// ---------- Threads ---------------------------------------------------------

/**
 * Fetch all threads with optional limit. Cached for 5 min.
 * @param {{ limit?: number }} [options]
 * @returns {Promise<Array<Object>>}
 */
export async function fetchAllThreads(options = {}) {
  const lim = options.limit || 0
  const cacheKey = `da:threads:all:${lim}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const constraints = [orderBy('updated_at', 'desc')]
  if (lim > 0) constraints.push(firestoreLimit(lim))

  const q = query(collection(db, 'threads'), ...constraints)
  const snap = await getDocs(q)
  const data = snap.docs.map(docToObj)
  setCached(cacheKey, data, TTL_THREADS)
  return data
}

/**
 * Fetch threads by team IDs (chunked parallel queries, ordered by updated_at desc).
 * Cached per sorted team-ID set for 5 min.
 * @param {string[]} teamIds
 * @returns {Promise<Array<Object>>}
 */
export async function fetchThreadsByTeam(teamIds) {
  if (!teamIds || teamIds.length === 0) return []

  const sortedKey = [...teamIds].sort().join(',')
  const cacheKey = `da:threads:team:${sortedKey}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const data = await chunkedQuery(
    collection(db, 'threads'),
    'team_id',
    teamIds,
    [orderBy('updated_at', 'desc')]
  )
  setCached(cacheKey, data, TTL_THREADS)
  return data
}

/**
 * Fetch a single thread by its document ID.
 * @param {string} threadId
 * @returns {Promise<Object|null>}
 */
export async function fetchThreadById(threadId) {
  const docSnap = await getDoc(doc(db, 'threads', threadId))
  if (!docSnap.exists()) return null
  return docToObj(docSnap)
}

// ---------- Mensagens -------------------------------------------------------

/**
 * Fetch messages belonging to a thread, ordered by data asc.
 * @param {string} threadId
 * @returns {Promise<Array<Object>>}
 */
export async function fetchMensagensByThread(threadId) {
  const q = query(
    collection(db, 'mensagens'),
    where('thread_id', '==', threadId),
    orderBy('data', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(docToObj)
}

// ---------- Alertas ---------------------------------------------------------

/**
 * Fetch alertas filtered by status. Cached per status for 5 min.
 * @param {string} status - e.g. 'pendente', 'em_andamento', 'resolvido'
 * @returns {Promise<Array<Object>>}
 */
export async function fetchAlertasByStatus(status) {
  const cacheKey = `da:alertas:status:${status}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const q = query(
    collection(db, 'alertas'),
    where('status', '==', status)
  )
  const snap = await getDocs(q)
  const data = snap.docs.map(docToObj)
  setCached(cacheKey, data, TTL_ALERTAS)
  return data
}

/**
 * Fetch all alertas (no filter). Cached for 5 min.
 * @returns {Promise<Array<Object>>}
 */
export async function fetchAllAlertas() {
  const cacheKey = 'da:alertas:all'
  const cached = getCached(cacheKey)
  if (cached) return cached

  const snap = await getDocs(collection(db, 'alertas'))
  const data = snap.docs.map(docToObj)
  setCached(cacheKey, data, TTL_ALERTAS)
  return data
}

/**
 * Fetch alertas for a specific cliente, ordered by created_at desc.
 * @param {string} clienteId
 * @returns {Promise<Array<Object>>}
 */
export async function fetchAlertasByCliente(clienteId) {
  const q = query(
    collection(db, 'alertas'),
    where('cliente_id', '==', clienteId),
    orderBy('created_at', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(docToObj)
}

// ---------- Metricas Diarias ------------------------------------------------

/**
 * Fetch metricas_diarias for given team IDs since a date limit (chunked parallel).
 * @param {string[]} teamIds
 * @param {Date} dataLimite - only return metrics newer than this date
 * @returns {Promise<Array<Object>>}
 */
export async function fetchMetricasDiarias(teamIds, dataLimite) {
  if (!teamIds || teamIds.length === 0) return []

  const constraints = dataLimite
    ? [where('data', '>=', dataLimite)]
    : []

  return chunkedQuery(
    collection(db, 'metricas_diarias'),
    'team_id',
    teamIds,
    constraints
  )
}

// ---------- Documentos ------------------------------------------------------

/**
 * Fetch documentos for a specific cliente, sorted newest first.
 * @param {string} clienteId
 * @returns {Promise<Array<Object>>}
 */
export async function fetchDocumentos(clienteId) {
  const q = query(
    collection(db, 'documentos'),
    where('cliente_id', '==', clienteId)
  )
  const snap = await getDocs(q)
  return snap.docs
    .map(docToObj)
    .sort((a, b) => {
      const dateA = a.created_at?.toDate?.() || new Date(0)
      const dateB = b.created_at?.toDate?.() || new Date(0)
      return dateB - dateA
    })
}

/**
 * Fetch all documentos (global page). Cached for 5 min.
 * @returns {Promise<Array<Object>>}
 */
export async function fetchAllDocumentos() {
  const cacheKey = 'da:documentos:all'
  const cached = getCached(cacheKey)
  if (cached) return cached

  const snap = await getDocs(collection(db, 'documentos'))
  const data = snap.docs.map(docToObj)
  setCached(cacheKey, data, TTL_CLIENTES)
  return data
}

/**
 * Fetch all documentos_secoes. Cached for 5 min.
 * @returns {Promise<Array<Object>>}
 */
export async function fetchDocumentosSecoes() {
  const cacheKey = 'da:documentos_secoes:all'
  const cached = getCached(cacheKey)
  if (cached) return cached

  const snap = await getDocs(collection(db, 'documentos_secoes'))
  const data = snap.docs.map(docToObj)
  setCached(cacheKey, data, TTL_CLIENTES)
  return data
}

// ---------- Observacoes CS --------------------------------------------------

/**
 * Fetch observacoes_cs for a specific cliente, sorted newest first.
 * @param {string} clienteId
 * @returns {Promise<Array<Object>>}
 */
export async function fetchObservacoes(clienteId) {
  const q = query(
    collection(db, 'observacoes_cs'),
    where('cliente_id', '==', clienteId)
  )
  const snap = await getDocs(q)
  return snap.docs
    .map(docToObj)
    .sort((a, b) => {
      const dateA = a.criado_em?.toDate?.() || new Date(0)
      const dateB = b.criado_em?.toDate?.() || new Date(0)
      return dateB - dateA
    })
}

// ---------- Interacoes ------------------------------------------------------

/**
 * Fetch interacoes for a specific cliente, sorted newest first.
 * @param {string} clienteId
 * @returns {Promise<Array<Object>>}
 */
export async function fetchInteracoes(clienteId) {
  const q = query(
    collection(db, 'interacoes'),
    where('cliente_id', '==', clienteId)
  )
  const snap = await getDocs(q)
  return snap.docs
    .map(docToObj)
    .sort((a, b) => {
      const dateA = a.data_interacao?.toDate?.() || new Date(a.data_interacao || 0)
      const dateB = b.data_interacao?.toDate?.() || new Date(b.data_interacao || 0)
      return dateB - dateA
    })
}

/**
 * Fetch interacoes filtered by tipo (e.g. 'transicao_nivel').
 * @param {string} tipo
 * @returns {Promise<Array<Object>>}
 */
export async function fetchInteracoesByTipo(tipo) {
  const q = query(
    collection(db, 'interacoes'),
    where('tipo', '==', tipo)
  )
  const snap = await getDocs(q)
  return snap.docs.map(docToObj)
}

// ---------- Config ----------------------------------------------------------

/**
 * Fetch a config document by its ID (e.g. 'geral', 'email_filters', 'ongoing').
 * Cached for 5 min.
 * @param {string} configId
 * @returns {Promise<Object|null>}
 */
export async function fetchConfig(configId) {
  const cacheKey = `da:config:${configId}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const docSnap = await getDoc(doc(db, 'config', configId))
  if (!docSnap.exists()) return null

  const data = docToObj(docSnap)
  setCached(cacheKey, data, TTL_CONFIG)
  return data
}

// ---------- Stakeholders (stored as array inside cliente doc) ---------------

/**
 * Fetch stakeholders for a cliente (reads from cliente doc).
 * @param {string} clienteId
 * @returns {Promise<Array<Object>>}
 */
export async function fetchStakeholders(clienteId) {
  const cliente = await fetchClienteById(clienteId)
  return cliente?.stakeholders || []
}

// ---------- Templates Comunicacao -------------------------------------------

/**
 * Fetch all templates_comunicacao. Cached for 10 min.
 * @returns {Promise<Array<Object>>}
 */
export async function fetchTemplates() {
  const cacheKey = 'da:templates:all'
  const cached = getCached(cacheKey)
  if (cached) return cached

  const snap = await getDocs(collection(db, 'templates_comunicacao'))
  const data = snap.docs.map(docToObj)
  setCached(cacheKey, data, TTL_TEMPLATES)
  return data
}

// ---------- Ongoing Ciclos (subcollection) ----------------------------------

/**
 * Fetch ongoing ciclos for a cliente.
 * @param {string} clienteId
 * @param {{ status?: string }} [options]
 * @returns {Promise<Array<Object>>}
 */
export async function fetchOngoingCiclos(clienteId, options = {}) {
  const colRef = collection(db, 'clientes', clienteId, 'ongoing_ciclos')
  const constraints = []
  if (options.status) {
    constraints.push(where('status', '==', options.status))
  }
  const q = constraints.length > 0
    ? query(colRef, ...constraints)
    : query(colRef)
  const snap = await getDocs(q)
  return snap.docs.map(docToObj)
}

/**
 * Fetch onboarding planos for a cliente.
 * @param {string} clienteId
 * @param {{ status?: string, limitCount?: number }} [options]
 * @returns {Promise<Array<Object>>}
 */
export async function fetchOnboardingPlanos(clienteId, options = {}) {
  const colRef = collection(db, 'clientes', clienteId, 'onboarding_planos')
  const constraints = []
  if (options.status) {
    constraints.push(where('status', '==', options.status))
  }
  if (options.limitCount) {
    constraints.push(firestoreLimit(options.limitCount))
  }
  const q = constraints.length > 0
    ? query(colRef, ...constraints)
    : query(colRef)
  const snap = await getDocs(q)
  return snap.docs.map(docToObj)
}

// ---------- Times -----------------------------------------------------------

/**
 * Fetch all times. Cached for 5 min.
 * @returns {Promise<Array<Object>>}
 */
export async function fetchAllTimes() {
  const cacheKey = 'da:times:all'
  const cached = getCached(cacheKey)
  if (cached) return cached

  const snap = await getDocs(collection(db, 'times'))
  const data = snap.docs.map(docToObj)
  setCached(cacheKey, data, TTL_CLIENTES)
  return data
}

// ---------- Playbooks -------------------------------------------------------

/**
 * Fetch all playbooks. Cached for 5 min.
 * @returns {Promise<Array<Object>>}
 */
export async function fetchAllPlaybooks() {
  const cacheKey = 'da:playbooks:all'
  const cached = getCached(cacheKey)
  if (cached) return cached

  const snap = await getDocs(collection(db, 'playbooks'))
  const data = snap.docs.map(docToObj)
  setCached(cacheKey, data, TTL_CLIENTES)
  return data
}

// ============================================================================
// WRITE OPERATIONS
// ============================================================================

// ---------- Documentos ------------------------------------------------------

/**
 * Create or update a documento.
 * @param {Object} data - must include `cliente_id` for new docs
 * @param {string} [data.id] - if present, updates the existing doc
 * @returns {Promise<string>} - the document ID
 */
export async function saveDocumento(data) {
  const { id: docId, ...fields } = data
  const writeData = {
    ...fields,
    updated_at: serverTimestamp()
  }

  if (docId) {
    await updateDoc(doc(db, 'documentos', docId), writeData)
    invalidateCache('da:documentos:all')
    return docId
  }

  writeData.created_at = serverTimestamp()
  const ref = await addDoc(collection(db, 'documentos'), writeData)
  invalidateCache('da:documentos:all')
  return ref.id
}

/**
 * Delete a documento by ID.
 * @param {string} docId
 */
export async function removeDocumento(docId) {
  await deleteDoc(doc(db, 'documentos', docId))
  invalidateCache('da:documentos:all')
}

// ---------- Documentos Secoes -----------------------------------------------

/**
 * Create or update a documentos_secoes entry.
 * @param {Object} data
 * @param {string} [data.id]
 * @returns {Promise<string>}
 */
export async function saveDocumentoSecao(data) {
  const { id: docId, ...fields } = data
  const writeData = {
    ...fields,
    updated_at: serverTimestamp()
  }

  if (docId) {
    await updateDoc(doc(db, 'documentos_secoes', docId), writeData)
    invalidateCache('da:documentos_secoes:all')
    return docId
  }

  writeData.created_at = serverTimestamp()
  const ref = await addDoc(collection(db, 'documentos_secoes'), writeData)
  invalidateCache('da:documentos_secoes:all')
  return ref.id
}

/**
 * Delete a documentos_secoes entry.
 * @param {string} secaoId
 */
export async function removeDocumentoSecao(secaoId) {
  await deleteDoc(doc(db, 'documentos_secoes', secaoId))
  invalidateCache('da:documentos_secoes:all')
}

// ---------- Observacoes CS --------------------------------------------------

/**
 * Create or update an observacao.
 * @param {Object} data - must include `cliente_id` for new docs
 * @param {string} [data.id] - if present, updates the existing doc
 * @returns {Promise<string>}
 */
export async function saveObservacao(data) {
  const { id: docId, ...fields } = data
  const writeData = {
    ...fields,
    updated_at: serverTimestamp()
  }

  if (docId) {
    await updateDoc(doc(db, 'observacoes_cs', docId), writeData)
    return docId
  }

  writeData.criado_em = Timestamp.now()
  const ref = await addDoc(collection(db, 'observacoes_cs'), writeData)
  return ref.id
}

/**
 * Delete an observacao.
 * @param {string} obsId
 */
export async function removeObservacao(obsId) {
  await deleteDoc(doc(db, 'observacoes_cs', obsId))
}

// ---------- Interacoes ------------------------------------------------------

/**
 * Create or update an interacao.
 * @param {Object} data - must include `cliente_id` for new docs
 * @param {string} [data.id] - if present, updates the existing doc
 * @returns {Promise<string>}
 */
export async function saveInteracao(data) {
  const { id: docId, ...fields } = data
  const writeData = {
    ...fields,
    updated_at: serverTimestamp()
  }

  if (docId) {
    await updateDoc(doc(db, 'interacoes', docId), writeData)
    return docId
  }

  writeData.created_at = serverTimestamp()
  const ref = await addDoc(collection(db, 'interacoes'), writeData)
  return ref.id
}

/**
 * Delete an interacao.
 * @param {string} interacaoId
 */
export async function removeInteracao(interacaoId) {
  await deleteDoc(doc(db, 'interacoes', interacaoId))
}

// ---------- Clientes --------------------------------------------------------

/**
 * Update fields on an existing cliente document.
 * Invalidates the clientes cache.
 * @param {string} clienteId
 * @param {Object} data
 */
export async function updateCliente(clienteId, data) {
  await updateDoc(doc(db, 'clientes', clienteId), {
    ...data,
    updated_at: serverTimestamp()
  })
  invalidateClientes()
}

/**
 * Create a new cliente document with setDoc (allows specifying ID).
 * @param {string} clienteId
 * @param {Object} data
 */
export async function createCliente(clienteId, data) {
  await setDoc(doc(db, 'clientes', clienteId), {
    ...data,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  })
  invalidateClientes()
}

// ---------- Threads ---------------------------------------------------------

/**
 * Update fields on an existing thread document.
 * Invalidates thread caches.
 * @param {string} threadId
 * @param {Object} data
 */
export async function updateThread(threadId, data) {
  await updateDoc(doc(db, 'threads', threadId), {
    ...data,
    updated_at: serverTimestamp()
  })
  invalidateThreads()
}

// ---------- Mensagens -------------------------------------------------------

/**
 * Update fields on an existing mensagem document.
 * @param {string} mensagemId
 * @param {Object} data
 */
export async function updateMensagem(mensagemId, data) {
  await updateDoc(doc(db, 'mensagens', mensagemId), {
    ...data,
    updated_at: serverTimestamp()
  })
}

// ---------- Alertas ---------------------------------------------------------

/**
 * Update fields on an existing alerta document.
 * Invalidates alertas caches.
 * @param {string} alertaId
 * @param {Object} data
 */
export async function updateAlerta(alertaId, data) {
  await updateDoc(doc(db, 'alertas', alertaId), {
    ...data,
    updated_at: Timestamp.now()
  })
  invalidateAlertas()
}

/**
 * Create a new alerta.
 * @param {Object} data
 * @returns {Promise<string>} - the new document ID
 */
export async function createAlerta(data) {
  const ref = await addDoc(collection(db, 'alertas'), {
    ...data,
    created_at: Timestamp.now(),
    updated_at: Timestamp.now()
  })
  invalidateAlertas()
  return ref.id
}

/**
 * Delete an alerta by ID.
 * @param {string} alertaId
 */
export async function removeAlerta(alertaId) {
  await deleteDoc(doc(db, 'alertas', alertaId))
  invalidateAlertas()
}

// ---------- Stakeholders (array in cliente doc) -----------------------------

/**
 * Add a stakeholder to the cliente's stakeholders array.
 * @param {string} clienteId
 * @param {Object} data - stakeholder fields (nome, email, cargo, etc.)
 * @returns {Promise<Object>} - the new stakeholder object (with generated id)
 */
export async function saveStakeholder(clienteId, data) {
  const cliente = await fetchClienteById(clienteId)
  const current = cliente?.stakeholders || []
  const newStakeholder = {
    id: Date.now().toString(),
    ...data
  }
  const updated = [...current, newStakeholder]
  await updateDoc(doc(db, 'clientes', clienteId), { stakeholders: updated })
  invalidateCache(`da:cliente:${clienteId}`)
  invalidateClientes()
  return newStakeholder
}

/**
 * Remove a stakeholder from a cliente's stakeholders array.
 * @param {string} clienteId
 * @param {string} stakeholderId
 */
export async function deleteStakeholder(clienteId, stakeholderId) {
  const cliente = await fetchClienteById(clienteId)
  const current = cliente?.stakeholders || []
  const updated = current.filter(s => s.id !== stakeholderId)
  await updateDoc(doc(db, 'clientes', clienteId), { stakeholders: updated })
  invalidateCache(`da:cliente:${clienteId}`)
  invalidateClientes()
}

// ---------- Config ----------------------------------------------------------

/**
 * Save (merge) a config document. Uses setDoc with merge behavior.
 * Invalidates config cache for the given ID.
 * @param {string} configId - e.g. 'geral', 'email_filters', 'ongoing'
 * @param {Object} data
 */
export async function saveConfig(configId, data) {
  await setDoc(doc(db, 'config', configId), {
    ...data,
    updated_at: serverTimestamp()
  }, { merge: true })
  invalidateCache(`da:config:${configId}`)
}

// ---------- Templates Comunicacao -------------------------------------------

/**
 * Create or update a template_comunicacao.
 * @param {string} templateId - the document ID
 * @param {Object} data
 */
export async function saveTemplate(templateId, data) {
  await setDoc(doc(db, 'templates_comunicacao', templateId), {
    ...data,
    updated_at: serverTimestamp()
  }, { merge: true })
  invalidateCache('da:templates:all')
}

/**
 * Delete a template_comunicacao by ID.
 * @param {string} templateId
 */
export async function removeTemplate(templateId) {
  await deleteDoc(doc(db, 'templates_comunicacao', templateId))
  invalidateCache('da:templates:all')
}

// ---------- Usuarios Sistema ------------------------------------------------

/**
 * Create or update a usuario_sistema.
 * @param {string} uid
 * @param {Object} data
 * @param {{ merge?: boolean }} [options]
 */
export async function saveUsuarioSistema(uid, data, options = {}) {
  const writeData = {
    ...data,
    updated_at: serverTimestamp()
  }
  if (options.merge !== false) {
    await setDoc(doc(db, 'usuarios_sistema', uid), writeData, { merge: true })
  } else {
    await setDoc(doc(db, 'usuarios_sistema', uid), writeData)
  }
  invalidateUsuarios()
}

/**
 * Delete a usuario_sistema by UID.
 * @param {string} uid
 */
export async function removeUsuarioSistema(uid) {
  await deleteDoc(doc(db, 'usuarios_sistema', uid))
  invalidateUsuarios()
}

// ---------- Audit Logs (append-only) ----------------------------------------

/**
 * Append an audit log entry. Never update or delete audit logs.
 * @param {Object} data
 * @returns {Promise<string>}
 */
export async function appendAuditLog(data) {
  const ref = await addDoc(collection(db, 'audit_logs'), {
    ...data,
    timestamp: serverTimestamp()
  })
  return ref.id
}

// ============================================================================
// CACHE INVALIDATION
// ============================================================================

/** Invalidate all clientes caches. */
export function invalidateClientes() {
  invalidateCachePrefix('da:clientes:')
  invalidateCachePrefix('da:cliente:')
  // Also invalidate the legacy cache key used by cachedGetDocs in useAlertas
  invalidateCache('clientes')
}

/** Invalidate all usuarios_sistema caches. */
export function invalidateUsuarios() {
  invalidateCachePrefix('da:usuarios_sistema:')
  invalidateCachePrefix('da:usuario_sistema:')
}

/** Invalidate all thread caches. */
export function invalidateThreads() {
  invalidateCachePrefix('da:threads:')
}

/** Invalidate all alertas caches. */
export function invalidateAlertas() {
  invalidateCachePrefix('da:alertas:')
}

/** Invalidate all config caches. */
export function invalidateConfigs() {
  invalidateCachePrefix('da:config:')
}

/** Invalidate all documentos caches. */
export function invalidateDocumentos() {
  invalidateCachePrefix('da:documentos')
}

/** Invalidate all templates caches. */
export function invalidateTemplates() {
  invalidateCache('da:templates:all')
}
