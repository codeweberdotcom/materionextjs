export type PlaywrightTestScript = {
  id: string
  title: string
  description: string
  file: string
  type: 'E2E' | 'Integration' | 'Unit' | 'Unknown'
}

export const playwrightTestScripts: PlaywrightTestScript[] = [
  {
    id: 'chat-smoke',
    title: 'Chat Smoke',
    description: 'Logs in as the seeded admin and verifies chat message delivery.',
    file: 'e2e/chat.spec.ts',
    type: 'E2E'
  },
  {
    id: 'registration-to-chat',
    title: 'Registration -> Chat Flow',
    description: 'Covers user sign-up, first login, sending a message to superadmin, and logout.',
    file: 'e2e/register-chat-flow.spec.ts',
    type: 'E2E'
  }
]

export const getPlaywrightTestById = (id?: string | null) =>
  playwrightTestScripts.find(script => script.id === id)
