import { setupTestUsers } from './setup-test-user'

/**
 * Global setup для E2E тестов
 * Выполняется один раз перед всеми тестами
 */
async function globalSetup() {
  console.log('Setting up test environment...')
  
  try {
    await setupTestUsers()
    console.log('Test users setup completed')
  } catch (error) {
    console.error('Failed to setup test users:', error)
    // Не прерываем выполнение, возможно пользователи уже существуют
  }
}

export default globalSetup

