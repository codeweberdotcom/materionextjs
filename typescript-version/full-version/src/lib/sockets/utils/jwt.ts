import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import type { IncomingMessage } from 'http';
import type { Socket } from 'socket.io';
import type { ParsedUrlQuery } from 'querystring';
import { env, authJwtSecret } from '@/shared/config/env';
import { User } from '../types/common';

const JWT_SECRET = authJwtSecret || env.NEXTAUTH_SECRET || 'your-secret-key';

type JwtPayload = {
  id: string;
  role?: User['role'];
  permissions?: User['permissions'];
  name?: string;
  email?: string;
  exp?: number;
  iat?: number;
};

type HandshakeLike = {
  auth?: { token?: string };
  query?: ParsedUrlQuery & { token?: string };
  headers?: IncomingMessage['headers'];
};

export const verifyToken = (token: string): User | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    if (!decoded || !decoded.id) {
      return null;
    }

    return {
      id: decoded.id,
      role: decoded.role || 'user',
      permissions: decoded.permissions || getDefaultPermissions(decoded.role || 'user'),
      name: decoded.name,
      email: decoded.email
    };
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

export const extractTokenFromHandshake = (handshake: HandshakeLike): string | null => {
  const headerAuth = handshake.headers?.authorization;

  return (
    handshake.auth?.token ||
    handshake.query?.token ||
    (headerAuth?.startsWith('Bearer ') ? headerAuth.replace('Bearer ', '') : undefined) ||
    null
  );
};

export const verifyHandshakeToken = (handshake: HandshakeLike): User | null => {
  const token = extractTokenFromHandshake(handshake);

  if (!token) return null;

  return verifyToken(token);
};

function getDefaultPermissions(role: User['role']): User['permissions'] {
  const rolePermissions: Record<User['role'], User['permissions']> = {
    admin: ['send_message', 'send_notification', 'moderate_chat', 'view_admin_panel'],
    moderator: ['send_message', 'send_notification', 'moderate_chat'],
    user: ['send_message', 'send_notification'],
    guest: ['send_notification']
  };

  return rolePermissions[role] || [];
}

export const createToken = (user: User, expiresIn: string = '24h'): string => {
  const payload: JwtPayload = {
    id: user.id,
    role: user.role,
    permissions: user.permissions,
    name: user.name,
    email: user.email,
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn } as SignOptions);
};

export const isTokenExpired = (token: string): boolean => {
  try {
    const decoded = jwt.decode(token) as JwtPayload | null;
    if (!decoded || !decoded.exp) return true;

    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  } catch {
    return true;
  }
};

export const getTokenTimeToLive = (token: string): number | null => {
  try {
    const decoded = jwt.decode(token) as JwtPayload | null;
    if (!decoded || !decoded.exp) return null;

    const currentTime = Math.floor(Date.now() / 1000);
    return Math.max(0, decoded.exp - currentTime);
  } catch {
    return null;
  }
};
