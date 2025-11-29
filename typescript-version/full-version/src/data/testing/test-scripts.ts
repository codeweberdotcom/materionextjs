export type PlaywrightTestScript = {
  id: string
  title: string
  description: string
  file: string
  type: 'E2E' | 'Integration' | 'Unit' | 'Unknown'
  timeout?: number // in milliseconds
}

export const playwrightTestScripts: PlaywrightTestScript[] = [
  {
    id: 'registration-to-chat',
    title: 'Registration -> Chat Flow',
    description: 'Covers user sign-up, first login, sending a message to superadmin, and logout.',
    file: 'e2e/register-chat-flow.spec.ts',
    type: 'E2E',
    timeout: 30000
  },
  {
    id: 'events-integration',
    title: 'Events Integration Verification',
    description: 'Verifies that Events are correctly recorded for export, import, and bulk operations. Checks correlationId, actorId, and event structure.',
    file: 'events-integration.spec.ts',
    type: 'E2E',
    timeout: 60000
  },
  {
    id: 'rate-limit-chat-messages',
    title: 'Rate Limit - Chat Messages',
    description: 'Tests rate limiting for chat messages: allows messages within limit, blocks after exceeding limit, and shows warnings when approaching limit.',
    file: 'rate-limit/chat-messages.spec.ts',
    type: 'E2E',
    timeout: 120000
  },
  {
    id: 'rate-limit-auth',
    title: 'Rate Limit - Authentication',
    description: 'Tests rate limiting for authentication: blocks brute force login attempts and allows login after rate limit window expires.',
    file: 'rate-limit/auth.spec.ts',
    type: 'E2E',
    timeout: 120000
  },
  {
    id: 'rate-limit-admin-operations',
    title: 'Rate Limit - Admin Operations',
    description: 'Tests admin operations for rate limiting: view statistics, update configuration, create/deactivate blocks, reset limits, and view events.',
    file: 'rate-limit/admin-operations.spec.ts',
    type: 'E2E',
    timeout: 120000
  },
  {
    id: 'rate-limit-modes',
    title: 'Rate Limit - Modes (Enforce/Monitor)',
    description: 'Tests rate limit modes: monitor mode logs but does not block, enforce mode blocks requests strictly, and switching between modes.',
    file: 'rate-limit/modes.spec.ts',
    type: 'E2E',
    timeout: 120000
  },
  {
    id: 'rate-limit-deduplication',
    title: 'Rate Limit - Deduplication',
    description: 'Ensures warning events are deduplicated within the configured interval and repeated warnings are suppressed.',
    file: 'rate-limit/deduplication.spec.ts',
    type: 'E2E',
    timeout: 120000
  },
  {
    id: 'rate-limit-metrics',
    title: 'Rate Limit - Prometheus Metrics',
    description: 'Validates rate limit Prometheus counters (checks, events, blocks) increase when limits are hit.',
    file: 'rate-limit/metrics.spec.ts',
    type: 'E2E',
    timeout: 120000
  },
  {
    id: 'user-management',
    title: 'User Management - Admin Operations',
    description: 'Tests user management through admin panel: create user, update user, toggle status, bulk operations, export/import users.',
    file: 'e2e/user/user-management.spec.ts',
    type: 'E2E',
    timeout: 120000
  },
  {
    id: 'user-profile',
    title: 'User Profile - Profile Management',
    description: 'Tests user profile functionality: view profile, update profile, change password, upload avatar.',
    file: 'e2e/user/user-profile.spec.ts',
    type: 'E2E',
    timeout: 90000
  },
  {
    id: 'bulk-operations',
    title: 'Bulk Operations - User Management',
    description: 'Tests bulk operations for users: bulk activate, bulk deactivate, bulk delete via API. Verifies filtering of superadmin, session deletion on deactivate, and transaction atomicity.',
    file: 'e2e/user/bulk-operations.spec.ts',
    type: 'E2E',
    timeout: 120000
  },
  {
    id: 'registration-email',
    title: 'Registration - Email Flow',
    description: 'Tests user registration via email: form validation, email format validation, password requirements, terms agreement, duplicate email handling, redirect to verification.',
    file: 'e2e/registration/registration-email.spec.ts',
    type: 'E2E',
    timeout: 60000
  },
  {
    id: 'registration-phone',
    title: 'Registration - Phone Flow',
    description: 'Tests user registration via phone: switching registration mode, phone format validation, Russian phone formats (+7, 8), duplicate phone handling, redirect to SMS verification.',
    file: 'e2e/registration/registration-phone.spec.ts',
    type: 'E2E',
    timeout: 60000
  },
  {
    id: 'registration-email-and-phone',
    title: 'Registration - Email AND Phone Mode',
    description: 'Tests registration when both email and phone are required: dual field validation, info about double verification, simultaneous validation errors.',
    file: 'e2e/registration/registration-email-and-phone.spec.ts',
    type: 'E2E',
    timeout: 60000
  },
  {
    id: 'verification-email',
    title: 'Verification - Email',
    description: 'Tests email verification flow: verification page display, resend functionality, token validation, success/error states.',
    file: 'e2e/verification/verification-email.spec.ts',
    type: 'E2E',
    timeout: 60000
  },
  {
    id: 'verification-phone',
    title: 'Verification - Phone (SMS)',
    description: 'Tests phone verification flow: phone format validation, SMS code sending, OTP input display, code validation, resend functionality.',
    file: 'e2e/verification/verification-phone.spec.ts',
    type: 'E2E',
    timeout: 60000
  },
  {
    id: 'verification-flow',
    title: 'Verification - Complete Flow',
    description: 'Tests complete verification flow: unverified user redirect, verification status headers, action blocking without full verification, admin access after email verification, full access after phone verification.',
    file: 'e2e/verification/verification-flow.spec.ts',
    type: 'E2E',
    timeout: 120000
  },
  {
    id: 'username-change',
    title: 'Username/Slug System',
    description: 'Tests username system: public profile display, 404 for non-existent users, username change in settings, availability checking, format validation, 301 redirects for old usernames.',
    file: 'e2e/username/username-change.spec.ts',
    type: 'E2E',
    timeout: 90000
  }
]

export const getPlaywrightTestById = (id?: string | null) =>
  playwrightTestScripts.find(script => script.id === id)
