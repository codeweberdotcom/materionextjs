import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

import { prisma } from '@/libs/prisma'
import { rateLimitService } from '@/lib/rate-limit'
import { createErrorResponse } from '@/utils/apiError'
import { eventService } from '@/services/events'
import { getEnvironmentFromRequest } from '@/lib/metrics/helpers'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'
import { registrationSettingsService } from '@/services/settings/RegistrationSettingsService'
import { getRegistrationSchema } from '@/lib/validations/registration-schemas'
import { verificationService } from '@/services/verification/VerificationService'
import { emailService } from '@/services/external/emailService'
import { normalizePhone } from '@/lib/utils/phone-utils'
import { smsRuSettingsService } from '@/services/settings/SMSRuSettingsService'
import { SMSRuProvider } from '@/services/sms'
import { accountService } from '@/services/accounts'
import type { AccountType } from '@/types/accounts/types'
import { slugService } from '@/services/slug'

export async function POST(request: NextRequest) {
  const correlationId = crypto.randomUUID()

  try {
    // Check if request body exists
    if (!request.body) {
      const { payload, init } = createErrorResponse({
        status: 400,
        code: 'REG_BODY_REQUIRED',
        message: 'Request body is required',
        logLevel: 'warn',
        route: 'register',
        context: { route: 'register' }
      })
      return new NextResponse(JSON.stringify(payload), init)
    }

    let body

    try {
      body = await request.json()
    } catch (parseError) {
      console.error('JSON parse error:', parseError)

      const { payload, init } = createErrorResponse({
        status: 400,
        code: 'REG_INVALID_JSON',
        message: 'Invalid JSON in request body',
        logLevel: 'warn',
        route: 'register',
        context: { route: 'register', error: (parseError as Error)?.message }
      })
      return new NextResponse(JSON.stringify(payload), init)
    }

    // Получаем настройки регистрации
    const settings = await registrationSettingsService.getSettings()
    const registrationMode = settings.registrationMode

    // Валидируем данные в зависимости от режима
    const registrationSchema = await getRegistrationSchema()
    const validationResult = registrationSchema.safeParse(body)

    if (!validationResult.success) {
      await eventService.record(enrichEventInputFromRequest(request, {
        source: 'registration',
        type: 'signup_failed',
        severity: 'info',
        message: 'Registration failed: validation error',
        actor: { type: 'user', id: null },
        subject: { type: 'system', id: 'registration' },
        key: body.email || body.phone || 'unknown',
        correlationId,
        payload: {
          errors: validationResult.error.errors,
          registrationMode,
          reason: 'validation_error'
        }
      }))

      const { payload, init } = createErrorResponse({
        status: 400,
        code: 'REG_VALIDATION_ERROR',
        message: 'Validation failed',
        details: validationResult.error.errors,
        logLevel: 'warn',
        route: 'register',
        context: { route: 'register', errors: validationResult.error.errors }
      })
      return new NextResponse(JSON.stringify(payload), init)
    }

    const { name, email, phone, password } = validationResult.data

    // Нормализуем телефон, если указан
    const normalizedPhone = phone ? normalizePhone(phone) : null

    // Rate limit check - skip for test requests
    const isTestRequest = request.headers.get('x-test-request') === 'true'
    const environment = getEnvironmentFromRequest(request)

    const clientIp = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown'

    const calculateRetryAfter = (resetTime?: number) => {
      if (!resetTime) {
        return 0
      }
      const diff = resetTime - Date.now()
      return Math.max(0, Math.ceil(diff / 1000))
    }

    const enforceRateLimit = async (
      key: string,
      module: 'registration-ip' | 'registration-domain' | 'registration-email' | 'registration-phone',
      options: { keyType?: 'ip' | 'user'; mailDomain?: string | null }
    ) => {
      const result = await rateLimitService.checkLimit(key, module, {
        increment: true,
        userId: null,
        email: email || '',
        ipAddress: clientIp,
        mailDomain: options.mailDomain ?? null,
        environment,
        ...options
      })

      if (!result.allowed) {
        await eventService.record(enrichEventInputFromRequest(request, {
          source: 'registration',
          type: 'signup_failed',
          severity: 'warning',
          message: `Registration rate limit exceeded: ${module}`,
          actor: { type: 'user', id: null },
          subject: { type: 'system', id: 'rate_limit' },
          key: key,
          correlationId,
          payload: {
            email: email,
            phone: normalizedPhone,
            ipAddress: clientIp,
            module: module,
            reason: 'rate_limit_exceeded'
          }
        }))

        const retryAfter = calculateRetryAfter(result.resetTime)
        const { payload, init } = createErrorResponse({
          status: 429,
          code: 'REG_RATE_LIMIT',
          message: 'Too many registration attempts. Try again later.',
          details: { module, retryAfter },
          route: 'register',
          context: { route: 'register', module, key }
        })
        return { response: new NextResponse(JSON.stringify(payload), init) }
      }

      return null
    }

    // Skip rate limiting for test requests
    if (!isTestRequest) {
      const ipCheck = await enforceRateLimit(clientIp || 'unknown', 'registration-ip', { keyType: 'ip' })
      if (ipCheck?.response) {
        return ipCheck.response
      }

      if (email) {
        const mailDomain = email.split('@')[1]?.toLowerCase() || null
        if (mailDomain) {
          const domainCheck = await enforceRateLimit(mailDomain, 'registration-domain', { mailDomain })
          if (domainCheck?.response) {
            return domainCheck.response
          }
        }

        const emailCheck = await enforceRateLimit(email, 'registration-email', { mailDomain: email.split('@')[1]?.toLowerCase() || null })
        if (emailCheck?.response) {
          return emailCheck.response
        }
      }

      if (normalizedPhone) {
        const phoneCheck = await enforceRateLimit(normalizedPhone, 'registration-phone', { keyType: 'user' })
        if (phoneCheck?.response) {
          return phoneCheck.response
        }
      }
    }

    // Record signup attempt event
    const mailDomain = email ? email.split('@')[1]?.toLowerCase() || null : null
    await eventService.record(enrichEventInputFromRequest(request, {
      source: 'registration',
      type: 'signup_attempt',
      severity: 'info',
      message: 'User registration attempt',
      actor: { type: 'user', id: null },
      subject: { type: 'system', id: 'registration' },
      key: email || normalizedPhone || 'unknown',
      correlationId,
      payload: {
        email: email,
        phone: normalizedPhone,
        name: name,
        ipAddress: clientIp,
        mailDomain: mailDomain,
        registrationMode
      }
    }))

    // Проверяем уникальность email
    if (email) {
      const existingUserByEmail = await prisma.user.findUnique({
        where: { email }
      })

      if (existingUserByEmail) {
        await eventService.record(enrichEventInputFromRequest(request, {
          source: 'registration',
          type: 'signup_failed',
          severity: 'warning',
          message: 'Registration failed: email already exists',
          actor: { type: 'user', id: null },
          subject: { type: 'system', id: 'registration' },
          key: email,
          correlationId,
          payload: {
            email: email,
            ipAddress: clientIp,
            reason: 'email_already_exists'
          }
        }))

        const { payload, init } = createErrorResponse({
          status: 409,
          code: 'REG_EMAIL_EXISTS',
          message: 'User with this email already exists',
          logLevel: 'warn',
          route: 'register',
          context: { route: 'register', email }
        })
        return new NextResponse(JSON.stringify(payload), init)
      }
    }

    // Проверяем уникальность phone
    if (normalizedPhone) {
      const existingUserByPhone = await prisma.user.findUnique({
        where: { phone: normalizedPhone }
      })

      if (existingUserByPhone) {
        await eventService.record(enrichEventInputFromRequest(request, {
          source: 'registration',
          type: 'signup_failed',
          severity: 'warning',
          message: 'Registration failed: phone already exists',
          actor: { type: 'user', id: null },
          subject: { type: 'system', id: 'registration' },
          key: normalizedPhone,
          correlationId,
          payload: {
            phone: normalizedPhone,
            ipAddress: clientIp,
            reason: 'phone_already_exists'
          }
        }))

        const { payload, init } = createErrorResponse({
          status: 409,
          code: 'REG_PHONE_EXISTS',
          message: 'User with this phone number already exists',
          logLevel: 'warn',
          route: 'register',
          context: { route: 'register', phone: normalizedPhone }
        })
        return new NextResponse(JSON.stringify(payload), init)
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Get default user role
    const defaultRole = await prisma.role.findUnique({
      where: { name: 'user' }
    })

    if (!defaultRole) {
      const { payload, init } = createErrorResponse({
        status: 500,
        code: 'REG_ROLE_NOT_FOUND',
        message: 'Default role not found. Please contact administrator.',
        route: 'register',
        context: { route: 'register' }
      })
      return new NextResponse(JSON.stringify(payload), init)
    }

    // Определяем, нужно ли активировать пользователя сразу
    // isActive: false если регистрация по email и требуется верификация email
    // isActive: true если регистрация по phone или email уже верифицирован
    const requiresEmailVerification = email && settings.requireEmailVerification
    const isActive = !requiresEmailVerification

    // Генерируем уникальный username
    // Приоритет: name > email prefix > random
    const usernameSource = name || (email ? email.split('@')[0] : `user_${Date.now().toString(36)}`)
    const username = await slugService.generateUniqueSlug(usernameSource, 'user')

    // Create user
    const newUser = await prisma.user.create({
      data: {
        name,
        username, // Автоматически сгенерированный username
        email: email || null,
        phone: normalizedPhone || null,
        password: hashedPassword,
        roleId: defaultRole.id,
        country: 'russia',
        language: 'Russian',
        currency: 'RUB',
        isActive
      },
      include: { role: true }
    })

    // Генерируем коды верификации
    let emailToken: string | null = null
    let phoneCode: string | null = null

    if (email && settings.requireEmailVerification) {
      emailToken = await verificationService.generateCode({
        identifier: email,
        type: 'email',
        expiresInMinutes: 60 // Email токен живет 1 час
      })

      // Отправляем email с токеном
      try {
        const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/verify/email?token=${emailToken}`
        await emailService.sendEmail({
          to: email,
          subject: 'Подтвердите ваш email',
          html: `
            <h2>Добро пожаловать!</h2>
            <p>Для завершения регистрации подтвердите ваш email адрес, перейдя по ссылке:</p>
            <p><a href="${verificationUrl}">${verificationUrl}</a></p>
            <p>Ссылка действительна в течение 1 часа.</p>
          `,
          text: `Добро пожаловать! Для завершения регистрации подтвердите ваш email адрес, перейдя по ссылке: ${verificationUrl}`
        })

        await eventService.record(enrichEventInputFromRequest(request, {
          source: 'registration',
          type: 'verification_code_sent',
          severity: 'info',
          message: 'Email verification code sent',
          actor: { type: 'user', id: newUser.id.toString() },
          subject: { type: 'user', id: newUser.id.toString() },
          key: email,
          correlationId,
          payload: {
            userId: newUser.id,
            email: email,
            type: 'email'
          }
        }))
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError)
        // Не прерываем регистрацию, если не удалось отправить email
        // Пользователь сможет запросить повторную отправку
      }
    }

    if (normalizedPhone && settings.requirePhoneVerification) {
      phoneCode = await verificationService.generateCode({
        identifier: normalizedPhone,
        type: 'phone',
        expiresInMinutes: 15 // SMS код живет 15 минут
      })

      // Отправка SMS через SMS.ru
      try {
        const smsSettings = await smsRuSettingsService.getSettings()

        if (smsSettings.apiKey) {
          const smsProvider = new SMSRuProvider({
            apiKey: smsSettings.apiKey,
            sender: smsSettings.sender,
            testMode: smsSettings.testMode
          })

          const smsResult = await smsProvider.sendCode(normalizedPhone, phoneCode)

          if (smsResult.success) {
            await eventService.record(enrichEventInputFromRequest(request, {
              source: 'registration',
              type: 'verification_code_sent',
              severity: 'info',
              message: 'SMS verification code sent',
              actor: { type: 'user', id: newUser.id.toString() },
              subject: { type: 'user', id: newUser.id.toString() },
              key: normalizedPhone,
              correlationId,
              payload: {
                userId: newUser.id,
                phone: normalizedPhone,
                type: 'phone',
                messageId: smsResult.messageId,
                cost: smsResult.cost,
                testMode: smsSettings.testMode
              }
            }))
          } else {
            // Логируем ошибку, но не прерываем регистрацию
            console.error('Failed to send SMS:', smsResult.error)
            await eventService.record(enrichEventInputFromRequest(request, {
              source: 'registration',
              type: 'verification_code_sent',
              severity: 'warning',
              message: 'SMS verification code generated but failed to send',
              actor: { type: 'user', id: newUser.id.toString() },
              subject: { type: 'user', id: newUser.id.toString() },
              key: normalizedPhone,
              correlationId,
              payload: {
                userId: newUser.id,
                phone: normalizedPhone,
                type: 'phone',
                error: smsResult.error
              }
            }))
          }
        } else {
          // API ключ не настроен - логируем для тестирования
          console.log(`[TEST] SMS verification code for ${normalizedPhone}: ${phoneCode}`)
          await eventService.record(enrichEventInputFromRequest(request, {
            source: 'registration',
            type: 'verification_code_sent',
            severity: 'info',
            message: 'SMS verification code generated (API key not configured)',
            actor: { type: 'user', id: newUser.id.toString() },
            subject: { type: 'user', id: newUser.id.toString() },
            key: normalizedPhone,
            correlationId,
            payload: {
              userId: newUser.id,
              phone: normalizedPhone,
              type: 'phone'
            }
          }))
        }
      } catch (smsError) {
        console.error('Failed to send SMS:', smsError)
        // Не прерываем регистрацию, если не удалось отправить SMS
        // Пользователь сможет запросить повторную отправку
        await eventService.record(enrichEventInputFromRequest(request, {
          source: 'registration',
          type: 'verification_code_sent',
          severity: 'warning',
          message: 'SMS verification code generated but failed to send',
          actor: { type: 'user', id: newUser.id.toString() },
          subject: { type: 'user', id: newUser.id.toString() },
          key: normalizedPhone,
          correlationId,
          payload: {
            userId: newUser.id,
            phone: normalizedPhone,
            type: 'phone',
            error: smsError instanceof Error ? smsError.message : 'Unknown error'
          }
        }))
      }
    }

    // Создаем аккаунт для пользователя
    let createdAccount = null
    const accountType = (body.accountType as AccountType) || 'LISTING'
    
    try {
      createdAccount = await accountService.createAccount(
        newUser.id,
        accountType,
        'FREE' // Всегда создаем с тарифом FREE при регистрации
      )

      // Устанавливаем созданный аккаунт как текущий
      // (сохраняется в localStorage через AccountContext на клиенте)
      await accountService.getAccountById(createdAccount.id, newUser.id)

      await eventService.record(enrichEventInputFromRequest(request, {
        source: 'registration',
        type: 'account.created',
        severity: 'info',
        message: 'Account created during registration',
        actor: { type: 'user', id: newUser.id.toString() },
        subject: { type: 'account', id: createdAccount.id },
        key: email || normalizedPhone || 'unknown',
        correlationId,
        payload: {
          accountId: createdAccount.id,
          accountType,
          tariffPlan: 'FREE'
        }
      }))
    } catch (accountError) {
      console.error('Failed to create account during registration:', accountError)
      // Не прерываем регистрацию, если не удалось создать аккаунт
      // Пользователь сможет создать аккаунт позже
      await eventService.record(enrichEventInputFromRequest(request, {
        source: 'registration',
        type: 'account.creation_failed',
        severity: 'warning',
        message: 'Account creation failed during registration',
        actor: { type: 'user', id: newUser.id.toString() },
        subject: { type: 'user', id: newUser.id.toString() },
        key: email || normalizedPhone || 'unknown',
        correlationId,
        payload: {
          error: accountError instanceof Error ? accountError.message : 'Unknown error',
          accountType
        }
      }))
    }

    // Record successful signup event
    await eventService.record(enrichEventInputFromRequest(request, {
      source: 'registration',
      type: 'signup_success',
      severity: 'info',
      message: 'User registered successfully',
      actor: { type: 'user', id: newUser.id.toString() },
      subject: { type: 'system', id: 'registration' },
      key: email || normalizedPhone || 'unknown',
      correlationId,
      payload: {
        userId: newUser.id,
        username: newUser.username,
        email: email,
        phone: normalizedPhone,
        name: name,
        ipAddress: clientIp,
        role: newUser.role?.name || newUser.role?.code || 'user',
        registrationMode,
        requiresEmailVerification: !!email && settings.requireEmailVerification,
        requiresPhoneVerification: !!normalizedPhone && settings.requirePhoneVerification,
        isActive,
        accountType,
        accountCreated: !!createdAccount
      }
    }))

    // Return user data without password
    const { password: _, ...userWithoutPassword } = newUser

    return NextResponse.json({
      message: 'User registered successfully',
      user: {
        ...userWithoutPassword,
        role: newUser.role
      },
      account: createdAccount ? {
        id: createdAccount.id,
        name: createdAccount.name,
        type: createdAccount.type
      } : null,
      requiresVerification: {
        email: !!email && settings.requireEmailVerification,
        phone: !!normalizedPhone && settings.requirePhoneVerification
      }
    })
  } catch (error) {
    console.error('Registration error:', error)

    const { payload, init } = createErrorResponse({
      status: 500,
      code: 'REG_INTERNAL_ERROR',
      message: 'Internal server error',
      route: 'register',
      context: { route: 'register' }
    })
    return new NextResponse(JSON.stringify(payload), init)
  }
}
