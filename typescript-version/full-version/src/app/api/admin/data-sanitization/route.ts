import { NextRequest, NextResponse } from 'next/server'
import { DataSanitizationService, SanitizationMode, DataType } from '@/services/data-sanitization.service'

// POST /api/admin/data-sanitization - выполнить очистку данных
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Валидация входных данных
    const { target, options } = body

    if (!target || typeof target !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Не указана цель очистки (target)' },
        { status: 400 }
      )
    }

    if (!options || typeof options !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Не указаны опции очистки (options)' },
        { status: 400 }
      )
    }

    // Валидация режима
    if (!options.mode || !Object.values(SanitizationMode).includes(options.mode)) {
      return NextResponse.json(
        { success: false, error: `Неверный режим очистки. Допустимые значения: ${Object.values(SanitizationMode).join(', ')}` },
        { status: 400 }
      )
    }

    // Валидация типов данных для selective режима
    if (options.mode === SanitizationMode.SELECTIVE) {
      if (!target.dataTypes || !Array.isArray(target.dataTypes)) {
        return NextResponse.json(
          { success: false, error: 'Для selective режима необходимо указать dataTypes массивом' },
          { status: 400 }
        )
      }

      const validTypes = Object.values(DataType)
      const invalidTypes = target.dataTypes.filter(type => !validTypes.includes(type))
      if (invalidTypes.length > 0) {
        return NextResponse.json(
          { success: false, error: `Неверные типы данных: ${invalidTypes.join(', ')}. Допустимые: ${validTypes.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Выполнение очистки
    const service = new DataSanitizationService()
    const result = await service.sanitize(target, options)
    await service.disconnect()

    return NextResponse.json({
      success: true,
      result
    })

  } catch (error) {
    console.error('Data sanitization error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка при очистке данных'

    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: 500 }
    )
  }
}

// GET /api/admin/data-sanitization/preview - предварительный просмотр
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Извлечение параметров из query string
    const target: any = {}
    const options: any = {}

    // Парсинг target параметров
    const userId = searchParams.get('userId')
    const email = searchParams.get('email')
    const ip = searchParams.get('ip')
    const emailDomain = searchParams.get('emailDomain')
    const dataTypes = searchParams.get('dataTypes')?.split(',').filter(Boolean)

    if (userId) target.userId = userId
    if (email) target.email = email
    if (ip) target.ip = ip
    if (emailDomain) target.emailDomain = emailDomain
    if (dataTypes && dataTypes.length > 0) target.dataTypes = dataTypes

    // Парсинг options
    const mode = searchParams.get('mode') as SanitizationMode
    const preserveAudit = searchParams.get('preserveAudit') === 'true'
    const reason = searchParams.get('reason')

    if (mode) options.mode = mode
    if (preserveAudit !== null) options.preserveAudit = preserveAudit
    if (reason) options.reason = reason

    // Валидация
    if (Object.keys(target).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Не указана цель для предварительного просмотра' },
        { status: 400 }
      )
    }

    if (!options.mode) {
      options.mode = SanitizationMode.DELETE // По умолчанию для preview
    }

    // Выполнение предварительного просмотра
    const service = new DataSanitizationService()
    const result = await service.previewSanitization(target, options)
    await service.disconnect()

    return NextResponse.json({
      success: true,
      preview: result
    })

  } catch (error) {
    console.error('Data sanitization preview error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка при предварительном просмотре'

    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: 500 }
    )
  }
}
