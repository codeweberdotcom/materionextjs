/**
 * State Machines Registry
 *
 * XState машины состояний для различных сущностей
 */

// Listing Machine (Этап 2 - готово)
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
} from './ListingMachine'

// User Machine (Этап 3 - готово)
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
} from './UserMachine'

// Account Machine (Этап 4 - готово)
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
} from './AccountMachine'

// TODO: Добавить CompanyMachine
// export { companyMachine } from './CompanyMachine'

// TODO: Добавить VerificationMachine
// export { verificationMachine } from './VerificationMachine'

