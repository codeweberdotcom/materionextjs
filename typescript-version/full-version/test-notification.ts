import { prisma } from './src/libs/prisma'

async function sendTestNotification() {
  try {
    // Найдем пользователя superadmin@example.com
    const user = await prisma.user.findUnique({
      where: { email: 'superadmin@example.com' }
    })

    if (!user) {
      console.error('Пользователь superadmin@example.com не найден')
      return
    }

    console.log(`Найден пользователь: ${user.name} (ID: ${user.id})`)

    // Создаем тестовое уведомление
    const notification = await prisma.notification.create({
      data: {
        userId: user.id,
        title: 'Письмл деду Морозу',
        message: 'Дорогой Дед Мороз! Пожалуйста, принеси мне много подарков на Новый год! 🎄',
        type: 'system',
        status: 'unread',
        avatarIcon: 'ri-gift-line',
        avatarColor: 'success'
      }
    })

    console.log('✅ Тестовое уведомление успешно создано!')
    console.log(`ID уведомления: ${notification.id}`)
    console.log(`Заголовок: ${notification.title}`)
    console.log(`Сообщение: ${notification.message}`)
    console.log(`Тип: ${notification.type}`)
    console.log(`Статус: ${notification.status}`)

  } catch (error) {
    console.error('Ошибка при создании уведомления:', error)
  } finally {
    await prisma.$disconnect()
  }
}

sendTestNotification()