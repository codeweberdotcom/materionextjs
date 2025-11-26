/**
 * Примеры использования модуля уведомлений
 * 
 * Этот файл демонстрирует, как использовать NotificationService и NotificationQueue
 */

import { notificationService } from './NotificationService'
import { notificationQueue } from './NotificationQueue'

/**
 * Пример 1: Немедленная отправка email
 */
export async function exampleSendEmailImmediate() {
  const result = await notificationService.send({
    channel: 'email',
    to: 'user@example.com',
    subject: 'Welcome!',
    content: '<h1>Welcome to our platform!</h1>',
    variables: {
      name: 'John Doe'
    }
  })

  if (result.success) {
    console.log('Email sent:', result.messageId)
  } else {
    console.error('Failed to send email:', result.error)
  }
}

/**
 * Пример 2: Отправка через очередь (немедленно)
 */
export async function exampleSendViaQueueImmediate() {
  const job = await notificationQueue.add({
    channel: 'email',
    to: 'user@example.com',
    subject: 'Notification',
    content: 'This is a notification'
  })

  // job будет null для немедленных отправок
  console.log('Job added:', job)
}

/**
 * Пример 3: Отложенная отправка (через 1 час)
 */
export async function exampleSendDelayed() {
  const oneHour = 60 * 60 * 1000 // 1 час в миллисекундах

  const job = await notificationQueue.add(
    {
      channel: 'email',
      to: 'user@example.com',
      subject: 'Reminder',
      content: 'Don\'t forget about our meeting!'
    },
    {
      delay: oneHour
    }
  )

  console.log('Delayed job scheduled:', job)
}

/**
 * Пример 4: Отправка SMS
 */
export async function exampleSendSMS() {
  const result = await notificationService.send({
    channel: 'sms',
    to: '+79991234567',
    content: 'Your verification code: 123456'
  })

  if (result.success) {
    console.log('SMS sent:', result.messageId)
  }
}

/**
 * Пример 5: Отправка браузерного уведомления
 */
export async function exampleSendBrowserNotification(userId: string) {
  const result = await notificationService.send({
    channel: 'browser',
    to: userId,
    subject: 'New Message',
    content: 'You have a new message',
    metadata: {
      type: 'info',
      action: 'view-message'
    }
  })

  if (result.success) {
    console.log('Browser notification sent')
  }
}

/**
 * Пример 6: Отправка через шаблон
 */
export async function exampleSendWithTemplate() {
  const result = await notificationService.send({
    channel: 'email',
    to: 'user@example.com',
    templateId: '1', // ID шаблона из БД
    variables: {
      name: 'John Doe',
      loginUrl: 'https://example.com/login'
    }
  })

  if (result.success) {
    console.log('Email sent with template:', result.messageId)
  }
}

/**
 * Пример 7: Отправка в несколько каналов
 */
export async function exampleSendMultipleChannels(userId: string, email: string, phone: string) {
  const results = await notificationService.sendMultiple([
    {
      channel: 'email',
      to: email,
      subject: 'Important Update',
      content: 'You have an important update'
    },
    {
      channel: 'sms',
      to: phone,
      content: 'Important: Check your email'
    },
    {
      channel: 'browser',
      to: userId,
      subject: 'Important Update',
      content: 'You have an important update'
    }
  ])

  console.log('Multiple notifications sent:', results)
}

/**
 * Пример 8: Получение статистики очереди
 */
export async function exampleGetQueueStats() {
  const stats = await notificationQueue.getStats()
  console.log('Queue stats:', stats)
  // {
  //   waiting: 5,
  //   active: 2,
  //   completed: 100,
  //   failed: 3,
  //   queueType: 'bull' | 'in-memory' | 'none'
  // }
}







