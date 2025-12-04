/**
 * Workflow Service Module
 *
 * Управление state machines для сущностей:
 * - Listing (объявления)
 * - User (пользователи)
 * - Company (компании)
 * - Verification (верификация)
 */

// Generic Workflow Service
export { workflowService, WorkflowService } from './WorkflowService'

// Listing Workflow Service
export { listingWorkflowService, ListingWorkflowService } from './ListingWorkflowService'

// User Workflow Service
export { userWorkflowService, UserWorkflowService } from './UserWorkflowService'

// Account Workflow Service
export { accountWorkflowService, AccountWorkflowService } from './AccountWorkflowService'

// Listing Machine (XState)
export {
  listingMachine,
  listingGuards,
  listingActions,
  listingStateLabels,
  listingEventLabels,
  listingStateColors,
  type ListingContext,
  type ListingEvent,
  type ListingState
} from './machines'

// User Machine (XState)
export {
  userMachine,
  userGuards,
  userActions,
  userStateLabels,
  userEventLabels,
  userStateColors,
  type UserContext,
  type UserEvent,
  type UserState
} from './machines'

// Account Machine (XState)
export {
  accountMachine,
  accountGuards,
  accountActions,
  accountStateLabels,
  accountEventLabels,
  accountStateColors,
  type AccountContext,
  type AccountEvent,
  type AccountState
} from './machines'

// Types
export type {
  WorkflowType,
  ListingState as WorkflowListingState,
  ListingEvent as WorkflowListingEvent,
  CompanyState,
  CompanyEvent,
  VerificationState,
  VerificationEvent,
  ActorType,
  TransitionResult,
  WorkflowContext,
  TransitionInput,
  WorkflowState,
  TransitionHistory,
  CanTransitionResult,
  GetWorkflowOptions,
  GuardParams,
  ActionParams
} from './types'

