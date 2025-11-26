import { IEntityAdapter, ExportField, ImportField, ValidationError, ImportResult, DuplicateInfo, ImportMode } from '@/types/export-import'
import type { UsersType } from '@/types/apps/userTypes'

/**
 * Адаптер для экспорта/импорта пользователей
 */
export class UserAdapter implements IEntityAdapter {
  exportFields: ExportField[] = [
    { key: 'id', label: 'ID', type: 'string', required: true },
    { key: 'fullName', label: 'Full Name', type: 'string', required: true },
    { key: 'username', label: 'Username', type: 'string', required: true },
    { key: 'email', label: 'Email', type: 'string', required: true },
    { key: 'role', label: 'Role', type: 'string', required: true },
    { key: 'status', label: 'Status', type: 'string', required: true },
    { key: 'currentPlan', label: 'Plan', type: 'string' },
    { key: 'isActive', label: 'Active', type: 'boolean' },
    { key: 'createdAt', label: 'Created Date', type: 'date' },
    { key: 'lastSeen', label: 'Last Seen', type: 'date' }
  ]

  importFields: ImportField[] = [
    { key: 'fullName', label: 'Full Name', type: 'string', required: true, maxLength: 100 },
    { key: 'username', label: 'Username', type: 'string', required: true, maxLength: 50 },
    { key: 'email', label: 'Email', type: 'string', required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    { key: 'role', label: 'Role', type: 'string', required: true, enum: ['superadmin', 'admin', 'manager', 'editor', 'moderator', 'seo', 'marketolog', 'support', 'subscriber', 'user', 'author', 'maintainer'] },
    { key: 'currentPlan', label: 'Plan', type: 'string', enum: ['basic', 'team', 'company', 'enterprise'] },
    { key: 'isActive', label: 'Active', type: 'boolean', default: true }
  ]

  /**
   * Получение данных пользователей для экспорта
   */
  async getDataForExport(filters?: Record<string, any>): Promise<UsersType[]> {
    try {
      const queryParams = new URLSearchParams()

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            queryParams.append(key, String(value))
          }
        })
      }

      const url = `/api/admin/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      console.log('Export: Fetching users from:', url)
      
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Export: API error response:', response.status, errorText)
        throw new Error(`Failed to fetch users: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('Export: Received users data:', Array.isArray(data) ? `${data.length} users` : 'Not an array', data)
      
      // Убеждаемся, что возвращаем массив
      if (!Array.isArray(data)) {
        console.warn('Export: API returned non-array data, converting to array')
        return Array.isArray(data.data) ? data.data : []
      }

      return data
    } catch (error) {
      console.error('Error fetching users for export:', error)
      throw new Error('Failed to fetch users data')
    }
  }

  /**
   * Преобразование данных для экспорта
   */
  transformForExport(data: UsersType[]): Record<string, any>[] {
    return data.map(user => ({
      id: user.id,
      fullName: user.fullName || '',
      username: user.username || '',
      email: user.email || '',
      role: user.role || '',
      status: user.status || (user.isActive ? 'active' : 'inactive'),
      currentPlan: user.currentPlan || '',
      isActive: String(user.isActive ?? true), // Преобразуем boolean в строку "true"/"false"
      createdAt: user.createdAt ? new Date(user.createdAt).toISOString().split('T')[0] : '',
      lastSeen: user.lastSeen ? new Date(user.lastSeen).toISOString().split('T')[0] : ''
    }))
  }

  /**
   * Преобразование данных из импорта (маппинг заголовков CSV на ключи полей)
   */
  transformForImport(data: Record<string, any>[]): Partial<UsersType>[] {
    return data.map(row => {
      const transformed: Partial<UsersType> = {}
      
      // Маппинг заголовков CSV на ключи полей
      // Поддерживаем оба варианта: заголовки из экспорта и прямые ключи
      transformed.fullName = row['Full Name'] || row.fullName || row['fullName'] || ''
      transformed.username = row['Username'] || row.username || row['username'] || ''
      transformed.email = row['Email'] || row.email || row['email'] || ''
      transformed.role = row['Role'] || row.role || row['role'] || ''
      transformed.currentPlan = row['Plan'] || row.currentPlan || row['currentPlan'] || 'basic'
      
      // Преобразование Active: может быть "true"/"false" (строка) или true/false (boolean)
      const activeValue = row['Active'] !== undefined ? row['Active'] : (row.isActive !== undefined ? row.isActive : row['isActive'])
      if (typeof activeValue === 'string') {
        transformed.isActive = activeValue.toLowerCase() === 'true' || activeValue === '1'
      } else if (typeof activeValue === 'boolean') {
        transformed.isActive = activeValue
      } else {
        transformed.isActive = true // По умолчанию
      }
      
      return transformed
    })
  }

  /**
   * Валидация данных импорта
   */
  validateImportData(data: Record<string, any>[]): ValidationError[] {
    const errors: ValidationError[] = []
    const usernames = new Set<string>()
    const emails = new Set<string>()

    data.forEach((row, index) => {
      // Функция для получения значения с поддержкой разных форматов заголовков
      const getValue = (key: string, label: string): any => {
        return row[label] || row[key] || row[label.toLowerCase()] || row[key.toLowerCase()] || ''
      }

      // Проверка обязательных полей
      this.importFields.forEach(field => {
        const value = getValue(field.key, field.label)
        if (field.required && (!value || value === '')) {
          errors.push({
            field: field.key,
            message: `${field.label} is required`,
            row: index + 1
          })
        }
      })

      // Получаем значения с поддержкой разных форматов заголовков
      const fullName = getValue('fullName', 'Full Name')
      const username = getValue('username', 'Username')
      const email = getValue('email', 'Email')
      const role = getValue('role', 'Role')
      const currentPlan = getValue('currentPlan', 'Plan')
      const isActive = getValue('isActive', 'Active')

      // Проверка типов и ограничений
      if (fullName && typeof fullName !== 'string') {
        errors.push({
          field: 'fullName',
          message: 'Full Name must be a string',
          row: index + 1
        })
      }

      if (username) {
        if (typeof username !== 'string') {
          errors.push({
            field: 'username',
            message: 'Username must be a string',
            row: index + 1
          })
        } else if (username.length > 50) {
          errors.push({
            field: 'username',
            message: 'Username must be less than 50 characters',
            row: index + 1
          })
        } else if (usernames.has(username)) {
          errors.push({
            field: 'username',
            message: 'Username must be unique',
            row: index + 1
          })
        } else {
          usernames.add(username)
        }
      }

      if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (typeof email !== 'string') {
          errors.push({
            field: 'email',
            message: 'Email must be a string',
            row: index + 1
          })
        } else if (!emailRegex.test(email)) {
          errors.push({
            field: 'email',
            message: 'Invalid email format',
            row: index + 1
          })
        } else if (emails.has(email.toLowerCase())) {
          errors.push({
            field: 'email',
            message: 'Email must be unique',
            row: index + 1
          })
        } else {
          emails.add(email.toLowerCase())
        }
      }

      const validRoles = ['superadmin', 'admin', 'manager', 'editor', 'moderator', 'seo', 'marketolog', 'support', 'subscriber', 'user', 'author', 'maintainer']
      if (role && !validRoles.includes(role)) {
        errors.push({
          field: 'role',
          message: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
          row: index + 1
        })
      }

      if (currentPlan && !['basic', 'team', 'company', 'enterprise'].includes(currentPlan)) {
        errors.push({
          field: 'currentPlan',
          message: 'Invalid plan. Must be one of: basic, team, company, enterprise',
          row: index + 1
        })
      }

      // Преобразуем isActive в boolean для проверки
      let isActiveBool: boolean | undefined
      if (isActive !== undefined && isActive !== '') {
        if (typeof isActive === 'string') {
          isActiveBool = isActive.toLowerCase() === 'true' || isActive === '1'
        } else if (typeof isActive === 'boolean') {
          isActiveBool = isActive
        }
      }

      if (isActiveBool !== undefined && typeof isActiveBool !== 'boolean') {
        errors.push({
          field: 'isActive',
          message: 'Active must be true or false',
          row: index + 1
        })
      }
    })

    return errors
  }

  /**
   * Сохранение импортированных данных
   */
  async saveImportedData(data: Record<string, any>[], mode: 'create' | 'update' | 'upsert' = 'create'): Promise<ImportResult> {
    const results = {
      successCount: 0,
      errorCount: 0,
      errors: [] as ValidationError[],
      totalProcessed: data.length
    }

    for (let i = 0; i < data.length; i++) {
      const row = data[i]

      try {
        let response: Response

        if (mode === 'create') {
          // Создание нового пользователя
          // API ожидает FormData, а не JSON
          const formData = new FormData()
          formData.append('fullName', row.fullName || '')
          formData.append('username', row.username || '')
          formData.append('email', row.email || '')
          formData.append('role', row.role || 'user')
          formData.append('plan', row.currentPlan || 'basic')
          formData.append('status', row.isActive ? 'active' : 'inactive')
          formData.append('company', '')
          formData.append('country', '')
          formData.append('contact', '')
          
          response = await fetch('/api/admin/users', {
            method: 'POST',
            body: formData
          })
        } else if (mode === 'update') {
          // Обновление существующего пользователя (по email)
          response = await fetch(`/api/admin/users/update-by-email`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              email: row.email,
              fullName: row.fullName,
              username: row.username,
              role: row.role,
              currentPlan: row.currentPlan,
              isActive: row.isActive
            })
          })
        } else {
          // Upsert - попытка обновить, если не существует - создать
          response = await fetch(`/api/admin/users/upsert`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              fullName: row.fullName,
              username: row.username,
              email: row.email,
              role: row.role,
              currentPlan: row.currentPlan || 'basic',
              isActive: row.isActive ?? true
            })
          })
        }

        if (response.ok) {
          results.successCount++
        } else {
          let errorMessage = `Failed to ${mode} user`
          let errorDetails: any = null
          
          try {
            // Пытаемся получить JSON с ошибкой
            const contentType = response.headers.get('content-type')
            if (contentType && contentType.includes('application/json')) {
              errorDetails = await response.json()
              errorMessage = errorDetails?.message || errorDetails?.error || errorDetails?.details || errorMessage
            } else {
              // Если не JSON, пытаемся получить текст
              const errorText = await response.text()
              if (errorText && errorText.trim()) {
                errorMessage = errorText
              } else {
                errorMessage = `HTTP ${response.status}: ${response.statusText}`
              }
            }
          } catch (parseError) {
            // Если не удалось распарсить, используем статус
            errorMessage = `HTTP ${response.status}: ${response.statusText || 'Unknown error'}`
          }
          
          results.errorCount++
          results.errors.push({
            field: 'general',
            message: errorMessage,
            row: i + 1,
            value: JSON.stringify(row)
          })
          
          // Логируем только если есть реальная информация об ошибке
          const logData: any = {
            status: response.status,
            statusText: response.statusText,
            errorMessage,
            rowData: row
          }
          if (errorDetails && Object.keys(errorDetails).length > 0) {
            logData.errorDetails = errorDetails
          }
          
          console.error(`[UserAdapter] Failed to ${mode} user at row ${i + 1}:`, logData)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error) || 'Unknown error'
        results.errorCount++
        results.errors.push({
          field: 'general',
          message: errorMessage,
          row: i + 1,
          value: JSON.stringify(row)
        })
        
        console.error(`[UserAdapter] Error processing row ${i + 1}:`, {
          error: errorMessage,
          errorStack: error instanceof Error ? error.stack : undefined,
          rowData: row
        })
      }
    }

    return results
  }

  /**
   * Проверка дубликатов с существующими пользователями в БД
   * Проверяет по email (уникальное поле)
   */
  async checkDuplicates(data: Record<string, any>[], mode: ImportMode): Promise<DuplicateInfo[]> {
    const duplicates: DuplicateInfo[] = []
    
    // Для режима 'create' проверяем все email
    // Для режима 'update' и 'upsert' дубликаты не являются проблемой (это обновление)
    if (mode === 'create') {
      // Собираем все email из импортируемых данных
      const emails = data
        .map((row, index) => ({ email: row.email?.toLowerCase()?.trim(), rowIndex: index + 1 }))
        .filter(item => item.email) // Фильтруем пустые email
      
      if (emails.length === 0) {
        return duplicates
      }

      // Получаем уникальные email для проверки
      const uniqueEmails = [...new Set(emails.map(e => e.email))]
      const checkedEmails = new Map<string, { exists: boolean; userId?: string }>()
      
      try {
        // Проверяем каждый email через API (можно оптимизировать позже batch запросом)
        // Используем кэширование результатов для одинаковых email
        for (const email of uniqueEmails) {
          if (checkedEmails.has(email)) {
            continue // Уже проверен
          }

          try {
            // Проверяем существование пользователя по email через поиск
            const response = await fetch(`/api/admin/users?email=${encodeURIComponent(email)}&limit=1`, {
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json'
              }
            })

            if (response.ok) {
              const users: UsersType[] = await response.json()
              const exists = Array.isArray(users) && users.length > 0 && users.some(u => u.email?.toLowerCase()?.trim() === email)
              checkedEmails.set(email, {
                exists,
                userId: exists ? users.find(u => u.email?.toLowerCase()?.trim() === email)?.id ? String(users.find(u => u.email?.toLowerCase()?.trim() === email)!.id) : undefined : undefined
              })
            } else {
              // Если запрос не удался, считаем что дубликата нет (не блокируем импорт)
              checkedEmails.set(email, { exists: false })
            }
          } catch (error) {
            // Если ошибка при проверке одного email, пропускаем его
            checkedEmails.set(email, { exists: false })
            console.warn(`[UserAdapter] Failed to check email ${email}:`, error)
          }
        }
        
        // Находим дубликаты на основе проверенных email
        emails.forEach(({ email, rowIndex }) => {
          const checkResult = checkedEmails.get(email!)
          if (checkResult?.exists) {
            duplicates.push({
              row: rowIndex,
              field: 'email',
              value: email,
              existingRecordId: checkResult.userId,
              message: `User with email "${email}" already exists`
            })
          }
        })
      } catch (error) {
        // Если не удалось проверить дубликаты, логируем ошибку, но не блокируем импорт
        console.warn('[UserAdapter] Failed to check duplicates:', error)
      }
    }

    return duplicates
  }
}
