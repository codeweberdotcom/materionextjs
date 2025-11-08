import jwt from 'jsonwebtoken';
import { User } from '../types/common';

// Секрет для JWT (должен браться из env)
const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'your-secret-key';

/**
 * Верифицировать JWT токен и извлечь данные пользователя
 */
export const verifyToken = (token: string): User | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    if (!decoded || !decoded.id) {
      return null;
    }

    // Создаем пользователя на основе данных из токена
    const user: User = {
      id: decoded.id,
      role: decoded.role || 'user',
      permissions: decoded.permissions || getDefaultPermissions(decoded.role || 'user'),
      name: decoded.name,
      email: decoded.email
    };

    return user;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      console.error('Invalid JWT token:', error.message);
    } else if (error instanceof jwt.TokenExpiredError) {
      console.error('JWT token expired:', error.message);
    } else {
      console.error('JWT verification error:', error);
    }
    return null;
  }
};

/**
 * Извлечь токен из handshake данных Socket.IO
 */
export const extractTokenFromHandshake = (handshake: any): string | null => {
  // Токен может быть в разных местах
  return handshake.auth?.token ||
         handshake.query?.token ||
         handshake.headers?.authorization?.replace('Bearer ', '') ||
         null;
};

/**
 * Проверить токен из handshake
 */
export const verifyHandshakeToken = (handshake: any): User | null => {
  const token = extractTokenFromHandshake(handshake);
  if (!token) return null;

  return verifyToken(token);
};

/**
 * Получить разрешения по умолчанию для роли
 */
function getDefaultPermissions(role: string): string[] {
  const rolePermissions: Record<string, string[]> = {
    admin: ['send_message', 'send_notification', 'moderate_chat', 'view_admin_panel'],
    moderator: ['send_message', 'send_notification', 'moderate_chat'],
    user: ['send_message', 'send_notification'],
    guest: ['send_notification']
  };

  return rolePermissions[role] || [];
}

/**
 * Создать JWT токен для пользователя (для тестирования)
 */
export const createToken = (user: User, expiresIn: string = '24h'): string => {
  const payload = {
    id: user.id,
    role: user.role,
    permissions: user.permissions,
    name: user.name,
    email: user.email,
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn } as any);
};

/**
 * Проверить, истек ли токен
 */
export const isTokenExpired = (token: string): boolean => {
  try {
    const decoded = jwt.decode(token) as any;
    if (!decoded || !decoded.exp) return true;

    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  } catch {
    return true;
  }
};

/**
 * Получить оставшееся время жизни токена в секундах
 */
export const getTokenTimeToLive = (token: string): number | null => {
  try {
    const decoded = jwt.decode(token) as any;
    if (!decoded || !decoded.exp) return null;

    const currentTime = Math.floor(Date.now() / 1000);
    return Math.max(0, decoded.exp - currentTime);
  } catch {
    return null;
  }
};