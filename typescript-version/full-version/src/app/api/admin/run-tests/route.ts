import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import { getPlaywrightTestById, playwrightTestScripts } from '@/data/testing/test-scripts'

const execAsync = promisify(exec)
const ARTIFACTS_BASE = path.join(process.cwd(), 'artifacts', 'playwright', 'runs')
const PLAYWRIGHT_REPORT_DIR = path.join(process.cwd(), 'reports', 'e2e', 'html')
const PLAYWRIGHT_RESULTS_FILE = path.join(process.cwd(), 'reports', 'e2e', 'test-results.json')

type ScriptSummary = {
  runId: string
  scriptId: string
  title: string
  file: string
  status: 'passed' | 'failed'
  duration: number
  startedAt: string
  finishedAt: string
  timeout?: number
}

type RunSummary = {
  runId: string
  label: string
  testId: string
  status: 'passed' | 'failed'
  startedAt: string
  finishedAt: string
  artifactsPath?: string
  scripts: ScriptSummary[]
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const requestedTestId: string | undefined = body?.testId
  const requestedMode: 'headed' | 'headless' =
    body?.mode === 'headless' ? 'headless' : 'headed'
  const requestedTimeout: number = typeof body?.timeout === 'number' ? body.timeout : 300000

  const selectedTest =
    requestedTestId && requestedTestId !== 'all' ? getPlaywrightTestById(requestedTestId) : null

  if (requestedTestId && requestedTestId !== 'all' && !selectedTest) {
    return NextResponse.json(
      { success: false, error: 'Requested test is not allow-listed.' },
      { status: 400 }
    )
  }

  const baseCommand = selectedTest
    ? `pnpm exec playwright test ${selectedTest.file}`
    : 'pnpm exec playwright test'
  const command = requestedMode === 'headed' ? `${baseCommand} --headed` : baseCommand

  const execEnv = {
    ...process.env as any,
    TEST_TIMEOUT: requestedTimeout.toString()
  }
  delete execEnv.npm_config_verify_deps_before_run
  delete execEnv.NPM_CONFIG_VERIFY_DEPS_BEFORE_RUN

  let stdout = ''
  let stderr = ''
  let execFailed = false

  try {
    const result = await execAsync(command, {
      cwd: process.cwd(),
      timeout: Math.max(requestedTimeout + 60000, 600000), // Add 1 minute buffer, minimum 10 minutes
      env: execEnv
    })
    stdout = result.stdout
    stderr = result.stderr
  } catch (error: any) {
    execFailed = true
    stdout = error.stdout || ''
    stderr = error.stderr || error.message || ''
  }

  const persistence = await persistRunArtifacts({
    requestedTestId: selectedTest?.id ?? requestedTestId ?? 'all',
    selectedTestTitle: selectedTest?.title ?? 'Playwright Test Run',
    selectedTestFile: selectedTest?.file,
    requestedTimeout
  })

  const responsePayload = {
    success: !execFailed,
    testId: selectedTest?.id ?? 'all',
    output: stdout,
    error: stderr,
    runId: persistence?.runId,
    mode: requestedMode,
    timestamp: new Date().toISOString()
  }

  if (execFailed) {
    return NextResponse.json(responsePayload, { status: 500 })
  }

  return NextResponse.json(responsePayload)
}

async function persistRunArtifacts({
  requestedTestId,
  selectedTestTitle,
  selectedTestFile,
  requestedTimeout
}: {
  requestedTestId: string
  selectedTestTitle: string
  selectedTestFile?: string
  requestedTimeout: number
}) {
  try {
    await fs.mkdir(ARTIFACTS_BASE, { recursive: true })
    const sanitizedSegment = requestedTestId.replace(/[^a-zA-Z0-9-_]/g, '_')
    const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}_${sanitizedSegment}`
    const runDir = path.join(ARTIFACTS_BASE, runId)
    const reportSrc = PLAYWRIGHT_REPORT_DIR
    const testResultsPath = PLAYWRIGHT_RESULTS_FILE

    await fs.mkdir(runDir, { recursive: true })

    if (existsSync(reportSrc)) {
      await fs.rm(runDir, { recursive: true, force: true })
      await fs.mkdir(runDir, { recursive: true })
      await fs.cp(reportSrc, runDir, { recursive: true })
    }

    const summary = await buildRunSummary({
      runId,
      requestedTestId,
      selectedTestTitle,
      selectedTestFile,
      requestedTimeout
    })

    summary.artifactsPath = path.relative(process.cwd(), runDir)

    if (existsSync(testResultsPath)) {
      await fs.copyFile(testResultsPath, path.join(runDir, 'test-results.json'))
    }

    await fs.writeFile(
      path.join(runDir, 'summary.json'),
      JSON.stringify(summary, null, 2),
      'utf-8'
    )

    return { runId, summary }
  } catch (error) {
    console.error('Failed to persist Playwright artifacts:', error)
    return null
  }
}

// Создаем мапу для сопоставления путей к scriptId
// Поддерживаем разные форматы путей: относительные, полные, с/без tests/e2e/
const scriptIdByFile = new Map<string, string>()

playwrightTestScripts.forEach(script => {
  // Добавляем оригинальный путь
  scriptIdByFile.set(script.file, script.id)
  
  // Добавляем путь с tests/e2e/ префиксом
  if (!script.file.startsWith('tests/')) {
    scriptIdByFile.set(`tests/e2e/${script.file}`, script.id)
  }
  
  // Добавляем путь с e2e/ префиксом (для совместимости)
  if (!script.file.startsWith('e2e/') && !script.file.startsWith('tests/')) {
    scriptIdByFile.set(`e2e/${script.file}`, script.id)
  }
  
  // Добавляем только имя файла (для fallback)
  const fileName = path.basename(script.file)
  if (fileName && !scriptIdByFile.has(fileName)) {
    scriptIdByFile.set(fileName, script.id)
  }
})

async function buildRunSummary({
  runId,
  requestedTestId,
  selectedTestTitle,
  selectedTestFile,
  requestedTimeout
}: {
  runId: string
  requestedTestId: string
  selectedTestTitle: string
  selectedTestFile?: string
  requestedTimeout: number
}): Promise<RunSummary> {
  const now = new Date().toISOString()
  const baseSummary: RunSummary = {
    runId,
    label: selectedTestTitle,
    testId: requestedTestId,
    status: 'failed',
    startedAt: now,
    finishedAt: now,
    scripts: []
  }

  const testResultsPath = PLAYWRIGHT_RESULTS_FILE
  if (!existsSync(testResultsPath)) {
    return baseSummary
  }

  try {
    const raw = JSON.parse(await fs.readFile(testResultsPath, 'utf-8'))
    const stats = raw.stats || {}
    const scripts: ScriptSummary[] = []

    // Рекурсивная функция для обхода вложенных suites
    const processSuite = (suite: any, parentFile?: string) => {
      const suiteFile = suite.file 
        ? (suite.file.startsWith(process.cwd()) 
            ? path.relative(process.cwd(), suite.file).replace(/\\/g, '/')
            : suite.file.replace(/\\/g, '/'))
        : parentFile
      
      // Обрабатываем specs в текущем suite
      suite.specs?.forEach((spec: any) => {
        spec.tests?.forEach((test: any) => {
          const result = test.results?.[0]
          if (!result) return
          const duration = typeof result.duration === 'number' ? result.duration : 0
          const startedAt = result.startTime || stats.startTime || now
          const finishedAt = new Date(new Date(startedAt).getTime() + duration).toISOString()
          const filePath =
            suiteFile ||
            (spec.file ? spec.file.replace(/\\/g, '/') : undefined) ||
            (selectedTestFile ? selectedTestFile.replace(/\\/g, '/') : undefined) ||
            selectedTestTitle
          
          // Нормализуем путь для поиска в scriptIdByFile
          let normalizedPath = filePath
          if (filePath) {
            // Если путь абсолютный, делаем относительным
            if (filePath.startsWith(process.cwd())) {
              try {
                normalizedPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/')
              } catch {
                normalizedPath = filePath
              }
            }
            
            // Если путь начинается с tests/e2e/, убираем префикс для поиска
            // (так как в test-scripts.ts пути указаны относительно testDir)
            if (normalizedPath.startsWith('tests/e2e/')) {
              normalizedPath = normalizedPath.replace('tests/e2e/', '')
            }
            // Если путь начинается с e2e/, убираем префикс
            if (normalizedPath.startsWith('e2e/')) {
              normalizedPath = normalizedPath.replace('e2e/', '')
            }
            
            // Путь уже может быть относительным от testDir (например, "rate-limit/chat-messages.spec.ts")
            // В этом случае оставляем как есть
          }
          
          // Пробуем найти scriptId по разным вариантам пути
          let scriptIdentifier: string | undefined
          
          // 1. По нормализованному пути
          if (normalizedPath) {
            scriptIdentifier = scriptIdByFile.get(normalizedPath)
          }
          
          // 2. По оригинальному filePath
          if (!scriptIdentifier && filePath) {
            scriptIdentifier = scriptIdByFile.get(filePath)
          }
          
          // 3. По полному пути с tests/e2e/
          if (!scriptIdentifier && filePath && !filePath.startsWith('tests/e2e/')) {
            scriptIdentifier = scriptIdByFile.get(`tests/e2e/${filePath}`)
          }
          
            // 4. По имени файла (базовое имя без расширения тоже пробуем)
            if (!scriptIdentifier && filePath) {
              const fileName = path.basename(filePath)
              scriptIdentifier = scriptIdByFile.get(fileName)
              // Также пробуем без расширения для совместимости
              if (!scriptIdentifier && fileName.includes('.')) {
                const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'))
                scriptIdentifier = scriptIdByFile.get(nameWithoutExt)
              }
            }
          
          // 5. Fallback на requestedTestId
          if (!scriptIdentifier && requestedTestId !== 'all') {
            scriptIdentifier = requestedTestId
          }
          
          // 6. Последний fallback
          if (!scriptIdentifier) {
            scriptIdentifier = normalizedPath || filePath || selectedTestTitle || 'unknown'
          }

          // Get timeout from the script if available
          const script = scriptIdentifier ? getPlaywrightTestById(scriptIdentifier) : null
          const timeout = script?.timeout || requestedTimeout

          scripts.push({
            runId,
            scriptId: scriptIdentifier || 'unknown',
            title: test.title || spec.title || selectedTestTitle || 'Unknown Test',
            file: filePath || normalizedPath || 'unknown',
            status: result.status === 'passed' ? 'passed' : 'failed',
            duration,
            startedAt,
            finishedAt,
            timeout
          })
        })
      })
      
      // Рекурсивно обрабатываем вложенные suites
      suite.suites?.forEach((nestedSuite: any) => {
        processSuite(nestedSuite, suiteFile)
      })
    }
    
    // Обрабатываем все suites (включая вложенные)
    raw.suites?.forEach((suite: any) => {
      processSuite(suite)
    })

    return {
      ...baseSummary,
      status: scripts.every(script => script.status === 'passed') ? 'passed' : 'failed',
      startedAt: stats.startTime || now,
      finishedAt: stats.endTime || now,
      scripts
    }
  } catch (error) {
    console.error('Failed to build Playwright run summary:', error)
    return baseSummary
  }
}
