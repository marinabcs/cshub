import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Log an action to the audit_logs collection
 *
 * @param {string} action - "create" | "update" | "delete"
 * @param {string} entity - "cliente" | "thread" | "usuario_sistema" | "config"
 * @param {string} entityId - ID of the affected document
 * @param {string} entityName - Display name (e.g., client name)
 * @param {object} changes - Object with { field: { old: oldValue, new: newValue } }
 * @param {object} user - User object with email and name
 * @returns {Promise<string>} - The ID of the created log document
 */
export async function logAction(action, entity, entityId, entityName, changes = {}, user = {}) {
  try {
    const logData = {
      action,
      entity,
      entity_id: entityId,
      entity_name: entityName || entityId,
      changes,
      user_email: user.email || 'sistema',
      user_name: user.name || user.email?.split('@')[0] || 'Sistema',
      timestamp: serverTimestamp(),
      created_at: new Date().toISOString() // Backup timestamp for immediate use
    };

    const docRef = await addDoc(collection(db, 'audit_logs'), logData);
    return docRef.id;
  } catch (error) {
    console.error('Erro ao registrar log de auditoria:', error);
    // Don't throw - audit logging shouldn't break the main operation
    return null;
  }
}

/**
 * Calculate changes between two objects
 *
 * @param {object} oldObj - Original object
 * @param {object} newObj - New object
 * @param {array} fieldsToTrack - Array of field names to track (optional, tracks all if not provided)
 * @returns {object} - Changes object with { field: { old: oldValue, new: newValue } }
 */
export function calculateChanges(oldObj = {}, newObj = {}, fieldsToTrack = null) {
  const changes = {};
  const fields = fieldsToTrack || [...new Set([...Object.keys(oldObj), ...Object.keys(newObj)])];

  for (const field of fields) {
    // Skip internal fields
    if (field.startsWith('_') || field === 'updated_at' || field === 'created_at') {
      continue;
    }

    const oldValue = oldObj[field];
    const newValue = newObj[field];

    // Compare values (handle arrays and objects)
    const oldStr = JSON.stringify(oldValue);
    const newStr = JSON.stringify(newValue);

    if (oldStr !== newStr) {
      changes[field] = {
        old: oldValue !== undefined ? oldValue : null,
        new: newValue !== undefined ? newValue : null
      };
    }
  }

  return changes;
}

/**
 * Get a human-readable label for an action
 *
 * @param {string} action - The action type
 * @returns {string} - Human-readable label
 */
export function getActionLabel(action) {
  const labels = {
    create: 'Criou',
    update: 'Atualizou',
    delete: 'Excluiu'
  };
  return labels[action] || action;
}

/**
 * Get a human-readable label for an entity
 *
 * @param {string} entity - The entity type
 * @returns {string} - Human-readable label
 */
export function getEntityLabel(entity) {
  const labels = {
    cliente: 'Cliente',
    thread: 'Conversa',
    usuario_sistema: 'Usuário do Sistema',
    config: 'Configuração',
    stakeholder: 'Stakeholder',
    reuniao: 'Reunião'
  };
  return labels[entity] || entity;
}

/**
 * Get color for action type
 *
 * @param {string} action - The action type
 * @returns {string} - Color hex code
 */
export function getActionColor(action) {
  const colors = {
    create: '#10b981', // green
    update: '#8b5cf6', // purple
    delete: '#ef4444'  // red
  };
  return colors[action] || '#64748b';
}

/**
 * Format a value for display in the audit log
 *
 * @param {any} value - The value to format
 * @returns {string} - Formatted string
 */
export function formatValue(value) {
  if (value === null || value === undefined) {
    return '-';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '(vazio)';
    return value.map(v => typeof v === 'object' ? JSON.stringify(v) : v).join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'Sim' : 'Não';
  }
  return String(value);
}
