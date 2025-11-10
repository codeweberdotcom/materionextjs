import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import { getPlaywrightTestById, playwrightTestScripts } from '@/data/testing/test-scripts'

const execAsync = promisify(exec)
const ARTIFACTS_BASE = path.join(process.cwd(), 'artifacts', 'playwright', 'runs')

type ScriptSummary = {
  runId: string
  scriptId: string
  title: string
  file: string
  status: 'passed' | 'failed'
  duration: number
  startedAt: string
  finishedAt: string
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

  const execEnv = { ...process.env }
  delete execEnv.npm_config_verify_deps_before_run
  delete execEnv.NPM_CONFIG_VERIFY_DEPS_BEFORE_RUN

  let stdout = ''
  let stderr = ''
  let execFailed = false

  try {
    const result = await execAsync(command, {
      cwd: process.cwd(),
      timeout: 300000,
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
    selectedTestFile: selectedTest?.file
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
  selectedTestFile
}: {
  requestedTestId: string
  selectedTestTitle: string
  selectedTestFile?: string
}) {
  try {
    await fs.mkdir(ARTIFACTS_BASE, { recursive: true })
    const sanitizedSegment = requestedTestId.replace(/[^a-zA-Z0-9-_]/g, '_')
    const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}_${sanitizedSegment}`
    const runDir = path.join(ARTIFACTS_BASE, runId)
    const reportSrc = path.join(process.cwd(), 'playwright-report')
    const testResultsPath = path.join(process.cwd(), 'test-results.json')

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
      selectedTestFile
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

const scriptIdByFile = new Map<string, string>(
  playwrightTestScripts.map(script => [script.file, script.id])
)

async function buildRunSummary({
  runId,
  requestedTestId,
  selectedTestTitle,
  selectedTestFile
}: {
  runId: string
  requestedTestId: string
  selectedTestTitle: string
  selectedTestFile?: string
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

  const testResultsPath = path.join(process.cwd(), 'test-results.json')
  if (!existsSync(testResultsPath)) {
    return baseSummary
  }

  try {
    const raw = JSON.parse(await fs.readFile(testResultsPath, 'utf-8'))
    const stats = raw.stats || {}
    const scripts: ScriptSummary[] = []

    raw.suites?.forEach((suite: any) => {
      const suiteFile = suite.file ? path.relative(process.cwd(), suite.file).replace(/\\/g, '/') : undefined
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
          const scriptIdentifier =
            (filePath ? scriptIdByFile.get(filePath) : undefined) ||
            (requestedTestId !== 'all' ? requestedTestId : undefined) ||
            filePath ||
            selectedTestTitle

          scripts.push({
            runId,
            scriptId: scriptIdentifier,
            title: test.title || spec.title || selectedTestTitle,
            file: filePath,
            status: result.status === 'passed' ? 'passed' : 'failed',
            duration,
            startedAt,
            finishedAt
          })
        })
      })
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
