// @ts-nocheck
import * as jwt from 'jsonwebtoken';
import { ExtendedError } from 'socket.io';
import { authLogger } from '../../logger';
import { User, TypedSocket, Permission } from '../types/common';

// JWT секрет (должен быть в env)
const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'your-secret-key-here';

authLogger.info('JWT Secret configured', {
  hasSecret: !!process.env.NEXTAUTH_SECRET,
  secretLength: process.env.NEXTAUTH_SECRET?.length || 0,
  usingFallback: !process.env.NEXTAUTH_SECRET
});

// Расширенный интерфейс для Socket.IO handshake
interface HandshakeAuth {
  token?: string;
  userId?: string;
}

// Middleware аутентификации для Socket.IO
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

    authLogger.info('Token received for verification', {
      socketId: socket.id,
      tokenLength: token.length,
      ip: socket.handshake.address
    });

    // Верификация JWT токена
    authLogger.info('Attempting JWT verification', {
      socketId: socket.id,
      secretLength: JWT_SECRET.length,
      ip: socket.handshake.address
    });

    const decoded = jwt.verify(token, JWT_SECRET) as any;

    authLogger.info('JWT token decoded successfully', {
      socketId: socket.id,
      decodedId: decoded.id,
      decodedRole: decoded.role,
      ip: socket.handshake.address
    });

    if (!decoded || !decoded.id) {
      authLogger.warn('Invalid JWT token', {
        socketId: socket.id,
        ip: socket.handshake.address
      });
      return next(new Error('Invalid token'));
    }

    // Получаем пользователя из токена NextAuth
    // В NextAuth JWT обычно содержится: id, email, name, role и т.д.
    const user: User = {
      id: decoded.id,
      role: decoded.role || 'user',
      permissions: decoded.permissions || getDefaultPermissions(decoded.role || 'user'),
      name: decoded.name,
      email: decoded.email
    };

    // Сохраняем данные пользователя в сокете
    socket.data = {
      user,
      authenticated: true,
      connectedAt: new Date(),
      lastActivity: new Date()
    };

    socket.userId = user.id;

    authLogger.info('Socket authenticated successfully', {
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

    if (error instanceof jwt.JsonWebTokenError) {
      return next(new Error('Invalid token'));
    }

    if (error instanceof jwt.TokenExpiredError) {
      return next(new Error('Token expired'));
    }

    next(new Error('Authentication failed'));
  }
};

// Получение разрешений по умолчанию для роли
function getDefaultPermissions(role: string): string[] {
  const rolePermissions: Record<string, string[]> = {
    admin: ['send_message', 'send_notification', 'moderate_chat', 'view_admin_panel'],
    moderator: ['send_message', 'send_notification', 'moderate_chat'],
    user: ['send_message', 'send_notification'],
    guest: ['send_notification'] // Только получение уведомлений
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
    if (!userPermissions.includes(permission as Permission)) {
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