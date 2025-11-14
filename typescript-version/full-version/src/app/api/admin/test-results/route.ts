import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'reports', 'e2e', 'test-results.json')

    // Проверяем, существует ли файл
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({
        suites: [],
        message: 'No Playwright results yet. Run tests to populate this table.'
      })
    }

    const fileContents = fs.readFileSync(filePath, 'utf8')
    const testResults = JSON.parse(fileContents)
    return NextResponse.json(testResults)
  } catch (error) {
    console.error('Error reading test results:', error)
    return NextResponse.json(
      { error: 'Failed to read test results' },
      { status: 500 }
    )
  }
}
