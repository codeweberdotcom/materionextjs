/**
 * Типы для Workflow Service (XState)
 */

// Типы сущностей с workflow
export type WorkflowType = 'listing' | 'user' | 'company' | 'verification'

// Состояния объявления
export type ListingState = 'draft' | 'pending' | 'active' | 'rejected' | 'sold' | 'archived' | 'deleted'

// События объявления
export type ListingEvent = 'SUBMIT' | 'APPROVE' | 'REJECT' | 'SELL' | 'ARCHIVE' | 'DELETE' | 'RESTORE'

// Состояния пользователя
export type UserState = 'active' | 'suspended' | 'blocked' | 'deleted'

// События пользователя
export type UserEvent = 'SUSPEND' | 'RESTORE' | 'BLOCK' | 'UNBLOCK' | 'DELETE'

// Состояния компании
export type CompanyState = 'pending' | 'verified' | 'suspended' | 'rejected'

// События компании
export type CompanyEvent = 'VERIFY' | 'REJECT' | 'SUSPEND' | 'RESTORE'

// Состояния верификации
export type VerificationState = 'uploaded' | 'reviewing' | 'approved' | 'rejected'

// События верификации
export type VerificationEvent = 'START_REVIEW' | 'APPROVE' | 'REJECT'

// Тип актора (кто инициирует переход)
export type ActorType = 'user' | 'system' | 'cron' | 'admin'

// Результат перехода
export interface TransitionResult {
  success: boolean
  fromState: string
  toState: string
  event: string
  error?: string
}

// Контекст workflow
export interface WorkflowContext {
  entityId: string
  type: WorkflowType
  metadata?: Record<string, unknown>
  reason?: string
  rejectedBy?: string
  rejectedAt?: string
  approvedBy?: string
  approvedAt?: string
}

// Данные для перехода
export interface TransitionInput {
  type: WorkflowType
  entityId: string
  event: string
  actorId?: string
  actorType?: ActorType
  metadata?: Record<string, unknown>
}

// Данные состояния workflow
export interface WorkflowState {
  id: string
  type: WorkflowType
  entityId: string
  state: string
  context: WorkflowContext
  version: number
  createdAt: Date
  updatedAt: Date
}

// Данные истории переходов
export interface TransitionHistory {
  id: string
  instanceId: string
  fromState: string
  toState: string
  event: string
  actorId?: string
  actorType?: ActorType
  metadata?: Record<string, unknown>
  createdAt: Date
}

// Параметры Guard (условия перехода)
export interface GuardParams {
  context: WorkflowContext
  event: { type: string; [key: string]: unknown }
  actorId?: string
  actorRole?: string
}

// Параметры Action (действия при переходе)
export interface ActionParams {
  context: WorkflowContext
  event: { type: string; [key: string]: unknown }
  actorId?: string
  actorType?: ActorType
}

// Результат проверки возможности перехода
export interface CanTransitionResult {
  allowed: boolean
  reason?: string
}

// Опции получения workflow
export interface GetWorkflowOptions {
  includeTransitions?: boolean
  transitionsLimit?: number
}

