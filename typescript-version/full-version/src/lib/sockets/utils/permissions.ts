import { User, Permission, UserRole } from '../types/common';

// Карта разрешений по ролям
const rolePermissions: Record<UserRole, Permission[]> = {
  admin: [
    'send_message',
    'send_notification',
    'moderate_chat',
    'view_admin_panel'
  ],
  moderator: [
    'send_message',
    'send_notification',
    'moderate_chat'
  ],
  user: [
    'send_message',
    'send_notification'
  ],
  guest: [
    'send_notification' // Только получение уведомлений
  ]
};

/**
 * Получить разрешения для роли
 */
export const getPermissionsForRole = (role: UserRole): Permission[] => {
  return rolePermissions[role] || [];
};

/**
 * Проверить, имеет ли пользователь разрешение
 */
export const hasPermission = (user: User, permission: Permission): boolean => {
  return user.permissions.includes(permission);
};

/**
 * Проверить, имеет ли пользователь все указанные разрешения
 */
export const hasAllPermissions = (user: User, permissions: Permission[]): boolean => {
  return permissions.every(permission => user.permissions.includes(permission));
};

/**
 * Проверить, имеет ли пользователь хотя бы одно из указанных разрешений
 */
export const hasAnyPermission = (user: User, permissions: Permission[]): boolean => {
  return permissions.some(permission => user.permissions.includes(permission));
};

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
  const allPermissions = users.flatMap(user => user.permissions);
  return [...new Set(allPermissions)];
};

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

  if (!user.permissions || !Array.isArray(user.permissions)) {
    errors.push('User permissions must be an array');
  } else {
    // Проверить, что все разрешения пользователя соответствуют его роли
    const expectedPermissions = getPermissionsForRole(user.role);
    const extraPermissions = user.permissions.filter(p => !expectedPermissions.includes(p));

    if (extraPermissions.length > 0) {
      errors.push(`User has extra permissions not allowed for role ${user.role}: ${extraPermissions.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
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
  };
};