import type { ExtendedError } from 'socket.io'
import { authLogger } from '../../logger'
import type { Permission, TypedSocket, User, UserRole } from '../types/common'
import { lucia } from '../../../libs/lucia'
import { prisma } from '@/libs/prisma'

type LuciaValidationResult = Awaited<ReturnType<typeof lucia.validateSession>>
type LuciaUser = NonNullable<LuciaValidationResult['user']>

authLogger.info('Lucia auth configured for Socket.IO middleware')

// Middleware аутентификации для Socket.IO с Lucia
export const authenticateSocket = async (socket: TypedSocket, next: (err?: ExtendedError) => void) => {
  try {
    const queryTokenProvided = hasQueryToken(socket)
    if (queryTokenProvided) {
      authLogger.warn('Socket connection attempt included token in query string. Query tokens are ignored.', {
        socketId: socket.id,
        ip: socket.handshake.address
      })
    }

    const token = extractToken(socket)

    authLogger.info('Socket authentication attempt', {
      socketId: socket.id,
      hasAuthToken: !!socket.handshake.auth?.token,
      queryTokenProvided,
      ip: socket.handshake.address
    })

    if (!token) {
      authLogger.warn('Socket connection attempt without token', {
        socketId: socket.id,
        ip: socket.handshake.address
      })
      return next(new Error('Authentication token required'))
    }

    authLogger.info('Token received for Lucia validation', {
      socketId: socket.id,
      tokenLength: token.length,
      ip: socket.handshake.address
    })

    const { session, user } = await lucia.validateSession(token)

    authLogger.info('Lucia session validation result', {
      socketId: socket.id,
      hasSession: !!session,
      hasUser: !!user,
      ip: socket.handshake.address
    })

    if (!session || !user) {
      authLogger.warn('Invalid Lucia session', {
        socketId: socket.id,
        ip: socket.handshake.address
      })
      return next(new Error('Invalid session'))
    }

    const socketUser = await buildSocketUser(user)

    socket.data = {
      user: socketUser,
      authenticated: true,
      connectedAt: new Date(),
      lastActivity: new Date()
    }

    socket.userId = socketUser.id

    authLogger.info('Socket authenticated successfully with Lucia', {
      socketId: socket.id,
      userId: socketUser.id,
      role: socketUser.role,
      ip: socket.handshake.address
    })

    next()
  } catch (error) {
    authLogger.error('Socket authentication failed', {
      socketId: socket.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: socket.handshake.address
    })

    next(new Error('Authentication failed'))
  }
}

const hasQueryToken = (socket: TypedSocket): boolean => {
  const queryToken = (socket.handshake.query as Record<string, unknown> | undefined)?.token
  if (typeof queryToken === 'string') {
    return true
  }

  return Array.isArray(queryToken) && queryToken.some(val => typeof val === 'string')
}

const normalizeTokenValue = (value: unknown): string | null => {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    const found = value.find((entry): entry is string => typeof entry === 'string')
    return found ?? null
  }

  return null
}

const extractToken = (socket: TypedSocket): string | null => {
  const authToken = normalizeTokenValue(socket.handshake.auth?.token)
  if (authToken) {
    return authToken
  }

  const headerToken = socket.handshake.headers?.authorization
  if (typeof headerToken === 'string' && headerToken.startsWith('Bearer ')) {
    return headerToken.slice('Bearer '.length)
  }

  return null
}

const ROLE_MAP: Record<string, UserRole> = {
  admin: 'admin',
  moderator: 'moderator',
  user: 'user',
  guest: 'guest'
}

const mapRoleName = (roleName?: string | null): UserRole => {
  if (!roleName) {
    return 'user'
  }

  const normalized = roleName.toLowerCase()
  return ROLE_MAP[normalized] ?? 'user'
}

const getDefaultPermissions = (role: UserRole): Permission[] => {
  const rolePermissions: Record<UserRole, Permission[]> = {
    admin: ['send_message', 'receive_notifications', 'send_notification', 'moderate_chat', 'view_admin_panel'],
    moderator: ['send_message', 'receive_notifications', 'send_notification', 'moderate_chat'],
    user: ['send_message', 'receive_notifications', 'send_notification'],
    guest: ['receive_notifications', 'send_notification']
  }

  return rolePermissions[role] ?? []
}

const ensureReceivePermission = (permissions: Permission[]): Permission[] => {
  return permissions.includes('receive_notifications') ? permissions : [...permissions, 'receive_notifications']
}

const resolveUserRole = async (roleId?: string | null): Promise<UserRole> => {
  if (!roleId) {
    return 'user'
  }

  try {
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: { name: true }
    })

    return mapRoleName(role?.name)
  } catch (error) {
    authLogger.error('Failed to resolve role for socket user', {
      roleId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return 'user'
  }
}

const buildSocketUser = async (user: LuciaUser): Promise<User> => {
  const role = await resolveUserRole(user.roleId)
  const permissions = ensureReceivePermission(getDefaultPermissions(role))

  return {
    id: user.id,
    role,
    permissions,
    name: user.name ?? undefined,
    email: user.email ?? undefined
  }
}

// Middleware для проверки разрешений
export const requirePermission = (permission: string) => {
  return (socket: TypedSocket, next: (err?: ExtendedError) => void) => {
    if (!socket.data?.authenticated) {
      authLogger.warn('Permission check failed: not authenticated', {
        socketId: socket.id,
        userId: socket.userId
      })
      return next(new Error('Not authenticated'))
    }

    const userPermissions = socket.data.user.permissions
    const hasPermission =
      userPermissions === 'all' || (Array.isArray(userPermissions) && userPermissions.includes(permission as Permission))

    if (!hasPermission) {
      authLogger.warn('Permission check failed: insufficient permissions', {
        socketId: socket.id,
        userId: socket.userId,
        requiredPermission: permission,
        userPermissions
      })
      return next(new Error(`Permission denied: ${permission}`))
    }

    socket.data.lastActivity = new Date()

    next()
  }
}

// Middleware для проверки роли
export const requireRole = (requiredRole: string) => {
  return (socket: TypedSocket, next: (err?: ExtendedError) => void) => {
    if (!socket.data?.authenticated) {
      return next(new Error('Not authenticated'));
    }

    const userRole = socket.data.user.role;
    const roleHierarchy = ['guest', 'user', 'moderator', 'admin'];

    const userRoleIndex = roleHierarchy.indexOf(userRole);
    const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);

    if (userRoleIndex < requiredRoleIndex) {
      authLogger.warn('Role check failed: insufficient role', {
        socketId: socket.id,
        userId: socket.userId,
        userRole,
        requiredRole
      });
      return next(new Error(`Role access denied: requires ${requiredRole}`));
    }

    socket.data.lastActivity = new Date();
    next();
  };
};

// Middleware для логирования активности
export const logActivity = (eventName: string) => {
  return (socket: TypedSocket, next: (err?: ExtendedError) => void) => {
    authLogger.debug('Socket activity', {
      socketId: socket.id,
      userId: socket.userId,
      event: eventName,
      timestamp: new Date().toISOString()
    });

    if (socket.data) {
      socket.data.lastActivity = new Date();
    }

    next();
  };
};
