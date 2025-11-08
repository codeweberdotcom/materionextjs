import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    // Путь к файлу с результатами тестов
    const filePath = path.join(process.cwd(), 'test-results.json')

    // Проверяем, существует ли файл
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Test results file not found' },
        { status: 404 }
      )
    }

    // Читаем файл
    const fileContents = fs.readFileSync(filePath, 'utf8')

    // Парсим JSON
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