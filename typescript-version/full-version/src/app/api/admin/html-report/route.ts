import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export async function GET(request: NextRequest) {
  try {
    // Path to the HTML report
    const reportPath = join(process.cwd(), 'playwright-report', 'index.html')

    if (!existsSync(reportPath)) {
      return NextResponse.json(
        { error: 'HTML report not found. Run tests first.' },
        { status: 404 }
      )
    }

    const htmlContent = readFileSync(reportPath, 'utf-8')

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