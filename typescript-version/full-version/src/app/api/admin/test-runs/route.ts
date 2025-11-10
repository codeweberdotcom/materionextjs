import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'

const RUNS_DIR = path.join(process.cwd(), 'artifacts', 'playwright', 'runs')

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = Number(searchParams.get('limit')) || 20

  try {
    if (!existsSync(RUNS_DIR)) {
      return NextResponse.json({ runs: [] })
    }

    const entries = await fs.readdir(RUNS_DIR, { withFileTypes: true })
    const summaries = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const summaryPath = path.join(RUNS_DIR, entry.name, 'summary.json')
      if (!existsSync(summaryPath)) continue
      try {
        const raw = await fs.readFile(summaryPath, 'utf-8')
        const summary = JSON.parse(raw)
        summaries.push(summary)
      } catch (error) {
        console.error(`Failed to read summary for ${entry.name}:`, error)
      }
    }

    summaries.sort(
      (a, b) =>
        new Date(b.startedAt ?? b.finishedAt ?? 0).getTime() -
        new Date(a.startedAt ?? a.finishedAt ?? 0).getTime()
    )

    return NextResponse.json({
      runs: summaries.slice(0, limit)
    })
  } catch (error) {
    console.error('Failed to list Playwright runs:', error)
    return NextResponse.json({ error: 'Failed to list runs' }, { status: 500 })
  }
}
