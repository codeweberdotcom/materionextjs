import { IEntityAdapter, ExportField, ImportField, ValidationError, ImportResult, DuplicateInfo, ImportMode } from '@/types/export-import'
import type { UsersType } from '@/types/apps/userTypes'

// Helper to get base URL for client-side fetch
const getBaseUrl = () => ''

// Lazy load prisma only on server
const getPrisma = async () => {
  if (typeof window === 'undefined') {
    const { prisma } = await import('@/libs/prisma')
    return prisma
  }
  return null
}

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
      // On server, use Prisma directly
      const prisma = await getPrisma()
      if (prisma) {
        console.log('Export: Using Prisma directly on server')
        
        const where: any = {}
        
        if (filters?.role) {
          where.role = { code: filters.role.toUpperCase() }
        }
        if (filters?.status) {
          where.status = filters.status
        }
        if (filters?.q) {
          where.OR = [
            { name: { contains: filters.q } },
            { email: { contains: filters.q } }
          ]
        }
        
        const users = await prisma.user.findMany({
          where,
          include: { role: true },
          orderBy: { createdAt: 'desc' }
        })
        
        // Transform to UsersType format
        // Note: Prisma schema has 'name' field, not 'fullName'
        return users.map(user => ({
          id: user.id,
          fullName: user.name || '',
          username: user.email?.split('@')[0] || '', // Use email prefix as username
          email: user.email || '',
          role: user.role?.name || 'user',
          status: user.status || 'active',
          currentPlan: 'basic',
          isActive: user.status === 'active',
          avatar: user.image || '',
          createdAt: user.createdAt?.toISOString() || ''
        })) as UsersType[]
      }
      
      // On client, use API
      const queryParams = new URLSearchParams()
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            queryParams.append(key, String(value))
          }
        })
      }

      const url = `${getBaseUrl()}/api/admin/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
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

    // Log incoming data for debugging
    console.log('[UserAdapter] saveImportedData called with:', {
      mode,
      dataCount: data.length,
      firstRow: data[0] ? JSON.stringify(data[0]) : 'no data'
    })

    // Use Prisma directly on server
    const prisma = await getPrisma()
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i]

      try {
        if (prisma) {
          // Server-side: use Prisma directly
          // Find role by name or code
          const roleName = (row.role || 'user').toLowerCase()
          const roleCode = roleName.toUpperCase()
          const role = await prisma.role.findFirst({
            where: { 
              OR: [
                { name: roleName },
                { code: roleCode }
              ]
            }
          })
          
          if (!role) {
            throw new Error(`Role "${roleName}" not found`)
          }

          const baseData = {
            name: row.fullName || row.name || '', // Prisma uses 'name' field
            email: row.email || '',
            roleId: role.id,
            status: row.isActive === true || row.isActive === 'true' ? 'active' : 'inactive'
          }

          if (mode === 'create') {
            // Generate a random temporary password for new users
            const tempPassword = Math.random().toString(36).slice(-12) + 'A1!'
            const bcrypt = await import('bcryptjs')
            const hashedPassword = await bcrypt.hash(tempPassword, 10)
            
            await prisma.user.create({ 
              data: { ...baseData, password: hashedPassword } 
            })
          } else if (mode === 'update') {
            // Update without changing password
            await prisma.user.update({
              where: { email: row.email },
              data: baseData
            })
          } else {
            // Upsert - need password for create case
            const tempPassword = Math.random().toString(36).slice(-12) + 'A1!'
            const bcrypt = await import('bcryptjs')
            const hashedPassword = await bcrypt.hash(tempPassword, 10)
            
            await prisma.user.upsert({
              where: { email: row.email },
              create: { ...baseData, password: hashedPassword },
              update: baseData
            })
          }
          results.successCount++
        } else {
          // Client-side: use API (this branch shouldn't be reached in normal flow)
          throw new Error('Import must be performed on server')
        }
      } catch (error) {
        let errorMessage = error instanceof Error ? error.message : String(error) || 'Unknown error'
        
        // Make error messages user-friendly
        if (errorMessage.includes('Unique constraint failed') && errorMessage.includes('email')) {
          errorMessage = `Email "${row.email}" already exists. Use "Upsert" mode to update existing users.`
        } else if (errorMessage.includes('Unique constraint failed')) {
          errorMessage = `Duplicate record found for row ${i + 1}. Use "Upsert" mode to update existing records.`
        } else if (errorMessage.includes('Role') && errorMessage.includes('not found')) {
          errorMessage = `Role "${row.role}" not found. Check available roles.`
        }
        
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
      
      try {
        // Use Prisma directly on server
        const prisma = await getPrisma()
        
        if (prisma) {
          // Check all emails at once
          const existingUsers = await prisma.user.findMany({
            where: {
              email: { in: uniqueEmails }
            },
            select: { id: true, email: true }
          })
          
          const existingEmailMap = new Map(
            existingUsers.map(u => [u.email?.toLowerCase(), u.id])
          )
          
          // Находим дубликаты
          emails.forEach(({ email, rowIndex }) => {
            const existingId = existingEmailMap.get(email!)
            if (existingId) {
              duplicates.push({
                row: rowIndex,
                field: 'email',
                value: email,
                existingRecordId: existingId,
                message: `User with email "${email}" already exists`
              })
            }
          })
        }
      } catch (error) {
        // Если не удалось проверить дубликаты, логируем ошибку, но не блокируем импорт
        console.warn('[UserAdapter] Failed to check duplicates:', error)
      }
    }

    return duplicates
  }
}
