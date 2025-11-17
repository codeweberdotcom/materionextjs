import { User, Permission, UserRole } from '../types/common'

// Карта разрешений по ролям
const rolePermissions: Record<UserRole, Permission[]> = {
  admin: ['send_message', 'send_notification', 'moderate_chat', 'view_admin_panel', 'receive_notifications'],
  moderator: ['send_message', 'send_notification', 'moderate_chat', 'receive_notifications'],
  user: ['send_message', 'send_notification', 'receive_notifications'],
  guest: ['send_notification', 'receive_notifications'] // Только получение уведомлений
}

const ALL_PERMISSIONS: Permission[] = Array.from(
  new Set(Object.values(rolePermissions).flat())
)

const toPermissionArray = (permissions: User['permissions']): Permission[] => {
  if (permissions === 'all') {
    return ALL_PERMISSIONS
  }

  return permissions
}

/**
 * Получить разрешения для роли
 */
export const getPermissionsForRole = (role: UserRole): Permission[] => {
  return rolePermissions[role] || []
}

/**
 * Проверить, имеет ли пользователь разрешение
 */
export const hasPermission = (user: User, permission: Permission): boolean => {
  return toPermissionArray(user.permissions).includes(permission)
}

/**
 * Проверить, имеет ли пользователь все указанные разрешения
 */
export const hasAllPermissions = (user: User, permissions: Permission[]): boolean => {
  const userPermissions = toPermissionArray(user.permissions)
  return permissions.every(permission => userPermissions.includes(permission))
}

/**
 * Проверить, имеет ли пользователь хотя бы одно из указанных разрешений
 */
export const hasAnyPermission = (user: User, permissions: Permission[]): boolean => {
  const userPermissions = toPermissionArray(user.permissions)
  return permissions.some(permission => userPermissions.includes(permission))
}

/**
 * Проверить, имеет ли пользователь роль с достаточным уровнем
 */
export const hasRoleLevel = (user: User, requiredRole: UserRole): boolean => {
  const roleHierarchy: UserRole[] = ['guest', 'user', 'moderator', 'admin'];
  const userRoleIndex = roleHierarchy.indexOf(user.role);
  const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);

  return userRoleIndex >= requiredRoleIndex;
};

/**
 * Получить все уникальные разрешения для списка пользователей
 */
export const getUniquePermissions = (users: User[]): Permission[] => {
  if (users.some(user => user.permissions === 'all')) {
    return ALL_PERMISSIONS
  }

  const allPermissions = users.flatMap(user => toPermissionArray(user.permissions))
  return [...new Set(allPermissions)]
}

/**
 * Проверить, может ли пользователь выполнять действие над другим пользователем
 */
export const canPerformActionOnUser = (
  actor: User,
  target: User,
  action: 'moderate' | 'ban' | 'message'
): boolean => {
  // Админ может все
  if (actor.role === 'admin') return true;

  // Модератор может модерировать пользователей и гостей
  if (actor.role === 'moderator') {
    return target.role === 'user' || target.role === 'guest';
  }

  // Пользователь может только отправлять сообщения
  if (actor.role === 'user' && action === 'message') {
    return target.role !== 'guest'; // Не может отправлять гостям
  }

  return false;
};

/**
 * Валидировать разрешения пользователя
 */
export const validateUserPermissions = (user: User): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!user.role) {
    errors.push('User role is required');
  }

  if (!user.permissions) {
    errors.push('User permissions must be provided')
  } else if (user.permissions === 'all') {
    return {
      valid: true,
      errors
    }
  } else if (Array.isArray(user.permissions)) {
    // Проверить, что все разрешения пользователя соответствуют его роли
    const expectedPermissions = getPermissionsForRole(user.role)
    const extraPermissions = user.permissions.filter(p => !expectedPermissions.includes(p))

    if (extraPermissions.length > 0) {
      errors.push(`User has extra permissions not allowed for role ${user.role}: ${extraPermissions.join(', ')}`)
    }
  } else {
    errors.push('User permissions must be an array or "all"')
  }

  return {
    valid: errors.length === 0,
    errors
  }
};

/**
 * Создать пользователя с правильными разрешениями для роли
 */
export const createUserWithPermissions = (
  id: string,
  role: UserRole,
  name?: string,
  email?: string
): User => {
  return {
    id,
    role,
    permissions: getPermissionsForRole(role),
    name,
    email
  }
}
