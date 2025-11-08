// @ts-nocheck
import { ExtendedError } from 'socket.io';
import { authLogger } from '../../logger';
import { User, TypedSocket, Permission } from '../types/common';
import { lucia } from '../../../libs/lucia';

authLogger.info('Lucia auth configured for Socket.IO middleware');

// Расширенный интерфейс для Socket.IO handshake
interface HandshakeAuth {
  token?: string;
  userId?: string;
}

// Middleware аутентификации для Socket.IO с Lucia
export const authenticateSocket = async (
  socket: TypedSocket,
  next: (err?: ExtendedError) => void
) => {
  try {
    const token = socket.handshake.auth?.token as string ||
                   (socket.handshake.query as any)?.token as string;

    authLogger.info('Socket authentication attempt', {
      socketId: socket.id,
      hasAuthToken: !!socket.handshake.auth?.token,
      hasQueryToken: !!(socket.handshake.query as any)?.token,
      ip: socket.handshake.address
    });

    if (!token) {
      authLogger.warn('Socket connection attempt without token', {
        socketId: socket.id,
        ip: socket.handshake.address
      });
      return next(new Error('Authentication token required'));
    }

    authLogger.info('Token received for Lucia validation', {
      socketId: socket.id,
      tokenLength: token.length,
      ip: socket.handshake.address
    });

    // Валидация сессии через Lucia
    const session = await lucia.validateSession(token);

    authLogger.info('Lucia session validation result', {
      socketId: socket.id,
      hasSession: !!session,
      hasUser: !!session?.user,
      ip: socket.handshake.address
    });

    if (!session || !session.user) {
      authLogger.warn('Invalid Lucia session', {
        socketId: socket.id,
        ip: socket.handshake.address
      });
      return next(new Error('Invalid session'));
    }

    // Создаем объект пользователя
    const user: User = {
      id: session.user.id,
      role: (session.user as any).role || 'user',
      permissions: (session.user as any).permissions || getDefaultPermissions((session.user as any).role || 'user'),
      name: (session.user as any).name,
      email: (session.user as any).email
    };

    // Добавляем receive_notifications к permissions, если его нет
    if (!user.permissions.includes('receive_notifications')) {
      user.permissions.push('receive_notifications');
    }

    // Сохраняем данные пользователя в сокете
    socket.data = {
      user,
      authenticated: true,
      connectedAt: new Date(),
      lastActivity: new Date()
    };

    socket.userId = user.id;

    authLogger.info('Socket authenticated successfully with Lucia', {
      socketId: socket.id,
      userId: user.id,
      role: user.role,
      ip: socket.handshake.address
    });

    next();
  } catch (error) {
    authLogger.error('Socket authentication failed', {
      socketId: socket.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: socket.handshake.address
    });

    next(new Error('Authentication failed'));
  }
};

// Получение разрешений по умолчанию для роли
function getDefaultPermissions(role: string): string[] {
  const rolePermissions: Record<string, string[]> = {
    admin: ['send_message', 'receive_notifications', 'send_notification', 'moderate_chat', 'view_admin_panel'],
    moderator: ['send_message', 'receive_notifications', 'send_notification', 'moderate_chat'],
    user: ['send_message', 'receive_notifications', 'send_notification'],
    guest: ['receive_notifications', 'send_notification'] // Только получение уведомлений
  };

  return rolePermissions[role] || [];
}

// Middleware для проверки разрешений
export const requirePermission = (permission: string) => {
  return (socket: TypedSocket, next: (err?: ExtendedError) => void) => {
    if (!socket.data?.authenticated) {
      authLogger.warn('Permission check failed: not authenticated', {
        socketId: socket.id,
        userId: socket.userId
      });
      return next(new Error('Not authenticated'));
    }

    const userPermissions = socket.data.user.permissions;
    // Check if user has 'all' permissions or the specific permission
    const hasPermission = userPermissions === 'all' || userPermissions.includes(permission as Permission);

    if (!hasPermission) {
      authLogger.warn('Permission check failed: insufficient permissions', {
        socketId: socket.id,
        userId: socket.userId,
        requiredPermission: permission,
        userPermissions
      });
      return next(new Error(`Permission denied: ${permission}`));
    }

    // Обновляем время последней активности
    socket.data.lastActivity = new Date();

    next();
  };
};

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