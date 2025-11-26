/**
 * Notification Queue Processor
 * 
 * Обработчик задач из очереди notifications.
 * Поддерживает email, SMS, Telegram и browser push уведомления.
 */

import type Queue from 'bull'
import nodemailer from 'nodemailer'
import fs from 'fs'
import path from 'path'

// Типы данных задачи
interface NotificationJobData {
  channel: 'email' | 'sms' | 'telegram' | 'browser'
  options: {
    to: string
    subject?: string
    body?: string
    html?: string
    template?: string
    templateData?: Record<string, any>
    // SMS specific
    phone?: string
    message?: string
    // Telegram specific
    chatId?: string
    text?: string
  }
}

// Загружаем SMTP настройки
function loadSmtpSettings() {
  const settingsPath = path.join(process.cwd(), 'smtp-settings.json')
  
  try {
    if (fs.existsSync(settingsPath)) {
      const content = fs.readFileSync(settingsPath, 'utf-8')
      return JSON.parse(content)
    }
  } catch (error) {
    console.error('[NotificationProcessor] Failed to load SMTP settings:', error)
  }
  
  // Fallback to environment variables
  return {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    username: process.env.SMTP_USER,
    password: process.env.SMTP_PASS,
    encryption: process.env.SMTP_ENCRYPTION || 'tls',
    fromEmail: process.env.SMTP_FROM_EMAIL,
    fromName: process.env.SMTP_FROM_NAME || 'Materio'
  }
}

// Email transporter (lazy initialized)
let emailTransporter: nodemailer.Transporter | null = null

function getEmailTransporter(): nodemailer.Transporter {
  if (!emailTransporter) {
    const settings = loadSmtpSettings()
    
    if (!settings.host || !settings.username) {
      throw new Error('SMTP settings not configured')
    }
    
    emailTransporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.encryption === 'ssl',
      auth: {
        user: settings.username,
        pass: settings.password
      }
    })
  }
  
  return emailTransporter
}

/**
 * Обработка email уведомления
 */
async function processEmail(data: NotificationJobData['options']): Promise<{ success: boolean; messageId?: string }> {
  const settings = loadSmtpSettings()
  const transporter = getEmailTransporter()
  
  const mailOptions: nodemailer.SendMailOptions = {
    from: `"${settings.fromName}" <${settings.fromEmail}>`,
    to: data.to,
    subject: data.subject,
    text: data.body,
    html: data.html
  }
  
  const result = await transporter.sendMail(mailOptions)
  
  return {
    success: true,
    messageId: result.messageId
  }
}

/**
 * Обработка SMS уведомления
 */
async function processSMS(data: NotificationJobData['options']): Promise<{ success: boolean }> {
  const phone = data.phone || data.to
  const message = data.message || data.body
  
  if (!phone || !message) {
    throw new Error('Phone and message are required for SMS')
  }
  
  // Здесь должна быть интеграция с SMS провайдером
  // Например: sms.ru, twilio, etc.
  
  const smsApiId = process.env.SMS_RU_API_ID
  
  if (!smsApiId) {
    console.warn('[NotificationProcessor] SMS_RU_API_ID not configured, skipping SMS')
    return { success: true } // Пропускаем в dev режиме
  }
  
  // Пример интеграции с sms.ru
  const response = await fetch(
    `https://sms.ru/sms/send?api_id=${smsApiId}&to=${phone}&msg=${encodeURIComponent(message)}&json=1`
  )
  
  const result = await response.json()
  
  if (result.status !== 'OK') {
    throw new Error(`SMS sending failed: ${result.status_text || 'Unknown error'}`)
  }
  
  return { success: true }
}

/**
 * Обработка Telegram уведомления
 */
async function processTelegram(data: NotificationJobData['options']): Promise<{ success: boolean }> {
  const chatId = data.chatId
  const text = data.text || data.body
  
  if (!chatId || !text) {
    throw new Error('Chat ID and text are required for Telegram')
  }
  
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  
  if (!botToken) {
    console.warn('[NotificationProcessor] TELEGRAM_BOT_TOKEN not configured, skipping Telegram')
    return { success: true } // Пропускаем в dev режиме
  }
  
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      })
    }
  )
  
  const result = await response.json()
  
  if (!result.ok) {
    throw new Error(`Telegram sending failed: ${result.description || 'Unknown error'}`)
  }
  
  return { success: true }
}

/**
 * Обработка browser push уведомления
 */
async function processBrowserPush(data: NotificationJobData['options']): Promise<{ success: boolean }> {
  // Browser push уведомления обычно отправляются через WebSocket
  // или специализированные сервисы (Firebase, OneSignal, etc.)
  
  console.log('[NotificationProcessor] Browser push notification queued:', {
    to: data.to,
    subject: data.subject
  })
  
  // TODO: Интеграция с push-сервисом
  return { success: true }
}

/**
 * Главная функция обработки задачи
 */
export async function processNotificationJob(job: Queue.Job<NotificationJobData>): Promise<{ success: boolean; error?: string }> {
  const { channel, options } = job.data
  
  console.log(`[NotificationProcessor] Processing ${channel} notification`, {
    jobId: job.id,
    attempt: job.attemptsMade + 1,
    to: options.to || options.phone || options.chatId
  })
  
  try {
    let result: { success: boolean }
    
    switch (channel) {
      case 'email':
        result = await processEmail(options)
        break
        
      case 'sms':
        result = await processSMS(options)
        break
        
      case 'telegram':
        result = await processTelegram(options)
        break
        
      case 'browser':
        result = await processBrowserPush(options)
        break
        
      default:
        throw new Error(`Unknown notification channel: ${channel}`)
    }
    
    return result
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    console.error(`[NotificationProcessor] Failed to process ${channel} notification:`, errorMessage)
    
    // Выбрасываем ошибку для retry механизма Bull
    throw error
  }
}




