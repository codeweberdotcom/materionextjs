/**
 * Скрипт импорта дашбордов в Grafana через API
 * 
 * Использование:
 *   npx ts-node scripts/grafana-import.ts
 * 
 * Переменные окружения:
 *   GRAFANA_URL - URL Grafana (например: https://grafana.example.com)
 *   GRAFANA_API_KEY - API ключ с правами Admin
 * 
 * Или через аргументы:
 *   npx ts-node scripts/grafana-import.ts --url=https://grafana.example.com --key=YOUR_API_KEY
 */

import * as fs from 'fs'
import * as path from 'path'

interface GrafanaConfig {
  url: string
  apiKey: string
}

interface DashboardFile {
  name: string
  path: string
  uid: string
}

// Список дашбордов для импорта
const DASHBOARDS: DashboardFile[] = [
  { name: 'Rate Limit', path: 'rate-limit-dashboard.json', uid: 'materio-rl' },
  { name: 'Notifications', path: 'notifications-dashboard.json', uid: 'materio-notifications' },
  { name: 'Redis', path: 'redis-dashboard.json', uid: 'materio-redis' },
  { name: 'Socket.IO', path: 'socket-dashboard.json', uid: 'materio-socket' },
  { name: 'Operations', path: 'operations-dashboard.json', uid: 'materio-operations' },
  { name: 'System', path: 'system-dashboard.json', uid: 'materio-system' },
  { name: 'Security', path: 'security-dashboard.json', uid: 'materio-security' },
]

// Datasources для создания
const DATASOURCES = [
  {
    name: 'Prometheus',
    type: 'prometheus',
    url: 'http://prometheus:9090', // Замените на ваш URL
    access: 'proxy',
    isDefault: true
  },
  {
    name: 'Loki',
    type: 'loki', 
    url: 'http://loki:3100', // Замените на ваш URL
    access: 'proxy',
    isDefault: false
  }
]

function parseArgs(): Partial<GrafanaConfig> {
  const args: Partial<GrafanaConfig> = {}
  
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--url=')) {
      args.url = arg.replace('--url=', '')
    }
    if (arg.startsWith('--key=')) {
      args.apiKey = arg.replace('--key=', '')
    }
  })
  
  return args
}

function getConfig(): GrafanaConfig {
  const args = parseArgs()
  
  const url = args.url || process.env.GRAFANA_URL
  const apiKey = args.apiKey || process.env.GRAFANA_API_KEY
  
  if (!url) {
    console.error('❌ GRAFANA_URL не указан')
    console.error('   Используйте: --url=https://grafana.example.com')
    console.error('   Или установите переменную окружения GRAFANA_URL')
    process.exit(1)
  }
  
  if (!apiKey) {
    console.error('❌ GRAFANA_API_KEY не указан')
    console.error('   Используйте: --key=YOUR_API_KEY')
    console.error('   Или установите переменную окружения GRAFANA_API_KEY')
    console.error('')
    console.error('   Создайте API ключ в Grafana:')
    console.error('   Configuration → API Keys → Add API key (Admin role)')
    process.exit(1)
  }
  
  return { url: url.replace(/\/$/, ''), apiKey }
}

async function grafanaRequest(
  config: GrafanaConfig,
  endpoint: string,
  method: string = 'GET',
  body?: any
): Promise<any> {
  const response = await fetch(`${config.url}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  })
  
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Grafana API error: ${response.status} - ${text}`)
  }
  
  return response.json()
}

async function testConnection(config: GrafanaConfig): Promise<boolean> {
  try {
    const health = await grafanaRequest(config, '/api/health')
    console.log(`✅ Подключение к Grafana успешно`)
    console.log(`   Version: ${health.version || 'unknown'}`)
    return true
  } catch (error) {
    console.error(`❌ Не удалось подключиться к Grafana: ${error}`)
    return false
  }
}

async function createDatasource(config: GrafanaConfig, datasource: any): Promise<void> {
  try {
    // Проверяем, существует ли уже
    try {
      await grafanaRequest(config, `/api/datasources/name/${datasource.name}`)
      console.log(`   ⏭️  Datasource "${datasource.name}" уже существует`)
      return
    } catch {
      // Не существует, создаём
    }
    
    await grafanaRequest(config, '/api/datasources', 'POST', datasource)
    console.log(`   ✅ Datasource "${datasource.name}" создан`)
  } catch (error) {
    console.error(`   ❌ Ошибка создания datasource "${datasource.name}": ${error}`)
  }
}

async function importDashboard(config: GrafanaConfig, dashboard: DashboardFile): Promise<void> {
  const dashboardPath = path.join(__dirname, '..', 'monitoring', 'grafana', 'dashboards', dashboard.path)
  
  if (!fs.existsSync(dashboardPath)) {
    console.error(`   ❌ Файл не найден: ${dashboardPath}`)
    return
  }
  
  try {
    const dashboardJson = JSON.parse(fs.readFileSync(dashboardPath, 'utf-8'))
    
    // Убираем id чтобы Grafana создал новый
    delete dashboardJson.id
    
    const payload = {
      dashboard: dashboardJson,
      overwrite: true,
      message: `Imported by grafana-import.ts at ${new Date().toISOString()}`
    }
    
    await grafanaRequest(config, '/api/dashboards/db', 'POST', payload)
    console.log(`   ✅ Dashboard "${dashboard.name}" импортирован (UID: ${dashboard.uid})`)
  } catch (error) {
    console.error(`   ❌ Ошибка импорта "${dashboard.name}": ${error}`)
  }
}

async function main() {
  console.log('🚀 Grafana Import Script')
  console.log('========================\n')
  
  const config = getConfig()
  console.log(`📡 Grafana URL: ${config.url}\n`)
  
  // Тест подключения
  const connected = await testConnection(config)
  if (!connected) {
    process.exit(1)
  }
  
  // Создание datasources
  console.log('\n📊 Создание Datasources...')
  console.log('   ⚠️  Убедитесь, что URL-ы Prometheus и Loki указаны правильно в скрипте!')
  for (const ds of DATASOURCES) {
    await createDatasource(config, ds)
  }
  
  // Импорт дашбордов
  console.log('\n📈 Импорт Dashboards...')
  for (const dashboard of DASHBOARDS) {
    await importDashboard(config, dashboard)
  }
  
  console.log('\n✅ Импорт завершён!')
  console.log(`\n🔗 Откройте Grafana: ${config.url}/dashboards`)
}

main().catch(console.error)

