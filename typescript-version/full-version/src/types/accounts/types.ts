/**
 * Типы для системы аккаунтов пользователей
 */

/**
 * Тип аккаунта
 */
export enum AccountType {
  LISTING = 'LISTING', // Для публикации объявлений
  COMPANY = 'COMPANY', // Для размещения компании
  NETWORK = 'NETWORK' // Сеть компаний
}

/**
 * Статус аккаунта
 */
export enum AccountStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  ARCHIVED = 'archived'
}

/**
 * Статус передачи аккаунта
 */
export enum TransferStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled'
}

/**
 * Код тарифного плана
 */
export enum TariffPlanCode {
  FREE = 'FREE',
  BASIC = 'BASIC',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE'
}

/**
 * Права менеджера аккаунта
 */
export interface AccountManagerPermissions {
  canManage: boolean
  canEdit: boolean
  canDelete: boolean
}

/**
 * Возможности тарифного плана
 */
export interface TariffPlanFeatures {
  maxListings?: number // -1 для unlimited
  maxCompanies?: number // -1 для unlimited
  maxAccounts?: number // -1 для unlimited
  canAssignManagers?: boolean
  maxManagers?: number // -1 для unlimited
  support?: 'community' | 'email' | 'priority' | 'dedicated'
  analytics?: boolean
  apiAccess?: boolean
  customIntegration?: boolean
}



