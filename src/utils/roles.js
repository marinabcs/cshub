// Hierarquia centralizada de roles do CS Hub
// Ordem crescente de permissão: viewer < cs < gestor < admin < super_admin

const ROLE_HIERARCHY = ['viewer', 'cs', 'gestor', 'admin', 'super_admin'];

/**
 * Retorna o índice numérico de uma role na hierarquia.
 * Roles desconhecidas retornam -1.
 */
export function getRoleIndex(role) {
  return ROLE_HIERARCHY.indexOf(role);
}

/**
 * Verifica se a role do usuário tem nível igual ou superior ao mínimo exigido.
 * Ex: hasMinRole('admin', 'gestor') → true
 *     hasMinRole('cs', 'admin') → false
 */
export function hasMinRole(userRole, minRole) {
  const userIdx = getRoleIndex(userRole);
  const minIdx = getRoleIndex(minRole);
  if (userIdx === -1 || minIdx === -1) return false;
  return userIdx >= minIdx;
}

/**
 * Verifica se a role está em uma lista de roles permitidas.
 * Ex: hasAnyRole('gestor', ['admin', 'super_admin', 'gestor']) → true
 */
export function hasAnyRole(userRole, allowedRoles) {
  return allowedRoles.includes(userRole);
}

/**
 * Atalho: role é admin ou super_admin.
 */
export function isAdmin(role) {
  return hasMinRole(role, 'admin');
}

/**
 * Atalho: role é gestor, admin ou super_admin.
 */
export function isGestorOrHigher(role) {
  return hasMinRole(role, 'gestor');
}

/**
 * Atalho: role é cs ou superior.
 */
export function isCSOrHigher(role) {
  return hasMinRole(role, 'cs');
}

/**
 * Filtra usuários ativos que são CS ou acima (para listas de responsáveis).
 */
export function filterActiveCSUsers(usuarios) {
  return usuarios
    .filter(u => u.ativo !== false && isCSOrHigher(u.role))
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
}

export { ROLE_HIERARCHY };
