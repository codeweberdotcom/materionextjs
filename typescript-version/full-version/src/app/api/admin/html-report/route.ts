import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const RUNS_DIR = path.join(process.cwd(), 'artifacts', 'playwright', 'runs')

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const runId = searchParams.get('runId')

    let reportPath: string | null = null

    if (runId) {
      reportPath = path.join(RUNS_DIR, runId, 'index.html')
    } else if (existsSync(RUNS_DIR)) {
      const entries = await fs.readdir(RUNS_DIR, { withFileTypes: true })
      const latest = entries
        .filter(entry => entry.isDirectory())
        .sort((a, b) => b.name.localeCompare(a.name))[0]
      if (latest) {
        reportPath = path.join(RUNS_DIR, latest.name, 'index.html')
      }
    }

    if (!reportPath || !existsSync(reportPath)) {
      // fallback to default latest report
      const defaultReport = path.join(process.cwd(), 'playwright-report', 'index.html')
      if (!existsSync(defaultReport)) {
        return NextResponse.json(
          { error: 'HTML report not found. Run tests first.' },
          { status: 404 }
        )
      }
      reportPath = defaultReport
    }

    const htmlContent = await fs.readFile(reportPath, 'utf-8')

    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html',
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
