import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    // Run the Playwright test
    const { stdout, stderr } = await execAsync(
      'npx playwright test e2e/chat.spec.ts --headed',
      {
        cwd: process.cwd(),
        timeout: 120000, // 2 minutes timeout
      }
    )

    // Check if test passed (exit code 0)
    const success = !stderr || !stderr.includes('failed')

    return NextResponse.json({
      success,
      output: stdout,
      error: stderr,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        output: error.stdout || '',
        error: error.stderr || error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}