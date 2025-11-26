/**
 * Система уровней верификации пользователя
 * Определяет уровень доступа в зависимости от статуса верификации email, телефона и документов
 */

import type { User } from '@prisma/client'

export enum VerificationLevel {
  NONE = 'NONE', // Нет верификации (пользователь только зарегистрирован)
  EMAIL_ONLY = 'EMAIL_ONLY', // Верифицирован только email (может видеть админку, но не управлять)
  PHONE_ONLY = 'PHONE_ONLY', // Верифицирован только телефон (редкий случай)
  FULL = 'FULL', // Верифицированы email и телефон (полный доступ к управлению)
  DOCUMENTS_VERIFIED = 'DOCUMENTS_VERIFIED' // Документы подтверждены (максимальный уровень доверия)
}

export type DocumentsStatus = 'not_submitted' | 'pending' | 'verified' | 'rejected'

export interface VerificationStatus {
  level: VerificationLevel
  emailVerified: boolean
  phoneVerified: boolean
  documentsVerified: boolean
  documentsStatus: DocumentsStatus
  canViewAdmin: boolean // Может видеть админку
  canManage: boolean // Может управлять (создавать объявления, отправлять сообщения и т.д.)
  isTrusted: boolean // Документы подтверждены (максимальный уровень доверия)
}

/**
 * Определяет уровень верификации пользователя
 */
export function getVerificationLevel(user: User): VerificationLevel {
  const emailVerified = !!user.emailVerified
  const phoneVerified = !!user.phoneVerified
  const documentsVerified = !!(user as any).documentsVerified

  if (documentsVerified && emailVerified && phoneVerified) {
    return VerificationLevel.DOCUMENTS_VERIFIED
  } else if (emailVerified && phoneVerified) {
    return VerificationLevel.FULL
  } else if (emailVerified) {
    return VerificationLevel.EMAIL_ONLY
  } else if (phoneVerified) {
    return VerificationLevel.PHONE_ONLY
  } else {
    return VerificationLevel.NONE
  }
}

/**
 * Определяет статус документов пользователя
 */
export function getDocumentsStatus(user: User): DocumentsStatus {
  const userAny = user as any
  
  if (userAny.documentsVerified) {
    return 'verified'
  } else if (userAny.documentsRejectedAt) {
    return 'rejected'
  } else if (userAny.image) {
    // Если есть фото/документ, считаем что на проверке
    return 'pending'
  } else {
    return 'not_submitted'
  }
}

/**
 * Получает полный статус верификации пользователя
 */
export function getVerificationStatus(user: User): VerificationStatus {
  const level = getVerificationLevel(user)
  const emailVerified = !!user.emailVerified
  const phoneVerified = !!user.phoneVerified
  const documentsVerified = !!(user as any).documentsVerified
  const documentsStatus = getDocumentsStatus(user)

  return {
    level,
    emailVerified,
    phoneVerified,
    documentsVerified,
    documentsStatus,
    canViewAdmin: emailVerified || phoneVerified, // Может видеть админку если верифицирован email или phone
    canManage: emailVerified && phoneVerified, // Может управлять только если верифицированы оба
    isTrusted: documentsVerified // Документы подтверждены
  }
}

/**
 * Проверяет, может ли пользователь видеть админку
 */
export function canViewAdmin(user: User): boolean {
  return !!user.emailVerified || !!user.phoneVerified
}

/**
 * Проверяет, может ли пользователь управлять (полный доступ)
 */
export function canManage(user: User): boolean {
  return !!user.emailVerified && !!user.phoneVerified
}

/**
 * Проверяет, требуется ли верификация email
 */
export function requiresEmailVerification(user: User): boolean {
  return !user.emailVerified && !!user.email
}

/**
 * Проверяет, требуется ли верификация телефона
 */
export function requiresPhoneVerification(user: User): boolean {
  return !user.phoneVerified && !!user.phone
}

/**
 * Получает список того, что нужно верифицировать
 */
export function getRequiredVerifications(user: User): {
  email: boolean
  phone: boolean
  documents: boolean
} {
  return {
    email: requiresEmailVerification(user),
    phone: requiresPhoneVerification(user),
    documents: requiresDocumentsVerification(user)
  }
}

/**
 * Проверяет, требуется ли верификация документов
 */
export function requiresDocumentsVerification(user: User): boolean {
  return !(user as any).documentsVerified
}

/**
 * Проверяет, подтверждены ли документы пользователя
 */
export function isDocumentsVerified(user: User): boolean {
  return !!(user as any).documentsVerified
}

/**
 * Проверяет, является ли пользователь доверенным (документы подтверждены)
 */
export function isTrustedUser(user: User): boolean {
  return !!(user as any).documentsVerified && !!user.emailVerified && !!user.phoneVerified
}



