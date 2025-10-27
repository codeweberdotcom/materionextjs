import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import { prisma } from '../libs/prisma'

// Country data
const countriesData = [
  {"code": "US", "name": "United States"},
  {"code": "GB", "name": "United Kingdom"},
  {"code": "DE", "name": "Germany"},
  {"code": "FR", "name": "France"},
  {"code": "CA", "name": "Canada"},
  {"code": "AU", "name": "Australia"},
  {"code": "JP", "name": "Japan"},
  {"code": "KR", "name": "South Korea"},
  {"code": "CN", "name": "China"},
  {"code": "IN", "name": "India"},
  {"code": "BR", "name": "Brazil"},
  {"code": "IT", "name": "Italy"},
  {"code": "ES", "name": "Spain"},
  {"code": "NL", "name": "Netherlands"},
  {"code": "SE", "name": "Sweden"},
  {"code": "NO", "name": "Norway"},
  {"code": "DK", "name": "Denmark"},
  {"code": "FI", "name": "Finland"},
  {"code": "PL", "name": "Poland"},
  {"code": "RU", "name": "Russia"},
  {"code": "UA", "name": "Ukraine"},
  {"code": "TR", "name": "Turkey"},
  {"code": "SA", "name": "Saudi Arabia"},
  {"code": "AE", "name": "United Arab Emirates"},
  {"code": "SG", "name": "Singapore"},
  {"code": "MY", "name": "Malaysia"},
  {"code": "ID", "name": "Indonesia"},
  {"code": "TH", "name": "Thailand"},
  {"code": "VN", "name": "Vietnam"},
  {"code": "PH", "name": "Philippines"},
  {"code": "MX", "name": "Mexico"},
  {"code": "AR", "name": "Argentina"},
  {"code": "CL", "name": "Chile"},
  {"code": "CO", "name": "Colombia"},
  {"code": "ZA", "name": "South Africa"},
  {"code": "EG", "name": "Egypt"},
  {"code": "NG", "name": "Nigeria"},
  {"code": "KE", "name": "Kenya"},
  {"code": "IL", "name": "Israel"},
  {"code": "CH", "name": "Switzerland"},
  {"code": "AT", "name": "Austria"},
  {"code": "BE", "name": "Belgium"},
  {"code": "PT", "name": "Portugal"},
  {"code": "IE", "name": "Ireland"},
  {"code": "CZ", "name": "Czech Republic"},
  {"code": "RO", "name": "Romania"},
  {"code": "HU", "name": "Hungary"},
  {"code": "GR", "name": "Greece"},
  {"code": "BG", "name": "Bulgaria"},
  {"code": "RS", "name": "Serbia"}
]

async function main() {
  // Create default role if it doesn't exist
  const superadminRole = await prisma.role.upsert({
    where: { name: 'superadmin' },
    update: {
      permissions: JSON.stringify(['all'])
    },
    create: {
      name: 'superadmin',
      description: 'Super Administrator role with full access',
      permissions: JSON.stringify(['all'])
    }
  })

  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {
      permissions: JSON.stringify(['all'])
    },
    create: {
      name: 'admin',
      description: 'Administrator role',
      permissions: JSON.stringify(['all'])
    }
  })

  const userRole = await prisma.role.upsert({
    where: { name: 'user' },
    update: {},
    create: {
      name: 'user',
      description: 'Regular user role',
      permissions: JSON.stringify({ 'Profile': ['Read'], 'Content': ['Read'] })
    }
  })

  const moderatorRole = await prisma.role.upsert({
    where: { name: 'moderator' },
    update: {},
    create: {
      name: 'moderator',
      description: 'Moderator role with content moderation permissions',
      permissions: JSON.stringify({ 'Users': ['Read'], 'Roles': ['Read'], 'Content Moderation': ['Write'] })
    }
  })

  const seoRole = await prisma.role.upsert({
    where: { name: 'seo' },
    update: {},
    create: {
      name: 'seo',
      description: 'SEO specialist role',
      permissions: JSON.stringify({ 'Content': ['Read', 'Write'], 'Analytics': ['Read'] })
    }
  })

  const editorRole = await prisma.role.upsert({
    where: { name: 'editor' },
    update: {},
    create: {
      name: 'editor',
      description: 'Content editor role',
      permissions: JSON.stringify({ 'Content': ['Read', 'Write'], 'Media': ['Write'] })
    }
  })

  const marketologRole = await prisma.role.upsert({
    where: { name: 'marketolog' },
    update: {},
    create: {
      name: 'marketolog',
      description: 'Marketing specialist role',
      permissions: JSON.stringify({ 'Marketing': ['Read', 'Write'], 'Analytics': ['Read'] })
    }
  })

  const subscriberRole = await prisma.role.upsert({
    where: { name: 'subscriber' },
    update: {},
    create: {
      name: 'subscriber',
      description: 'Subscriber role with limited access',
      permissions: JSON.stringify({ 'Content': ['Read'], 'Profile': ['Read'] })
    }
  })

  const supportRole = await prisma.role.upsert({
    where: { name: 'support' },
    update: {},
    create: {
      name: 'support',
      description: 'Customer support role',
      permissions: JSON.stringify({ 'Support': ['Read', 'Write'], 'Users': ['Read'] })
    }
  })

  const managerRole = await prisma.role.upsert({
    where: { name: 'manager' },
    update: {},
    create: {
      name: 'manager',
      description: 'Manager role with team management permissions',
      permissions: JSON.stringify({ 'Users': ['Read', 'Write'], 'Reports': ['Read'], 'Team': ['Write'] })
    }
  })

  // Create default user
  const hashedPassword = await bcrypt.hash('admin123', 10)

  const user = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      password: hashedPassword,
      roleId: adminRole.id
    },
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: hashedPassword,
      roleId: adminRole.id,
      language: 'ru',
      currency: 'RUB',
      country: 'russia'
    }
  })

  // Create superadmin user
  const superadminPassword = await bcrypt.hash('admin123', 10)

  const superadminUser = await prisma.user.upsert({
    where: { email: 'superadmin@example.com' },
    update: {
      password: superadminPassword,
      roleId: superadminRole.id
    },
    create: {
      email: 'superadmin@example.com',
      name: 'Superadmin User',
      password: superadminPassword,
      roleId: superadminRole.id,
      language: 'ru',
      currency: 'RUB',
      country: 'russia'
    }
  })

  // Create some sample currencies if they don't exist
  await prisma.currency.upsert({
    where: { code: 'RUB' },
    update: {},
    create: {
      name: 'Russian Ruble',
      code: 'RUB',
      symbol: '₽',
      isActive: true
    }
  })

  await prisma.currency.upsert({
    where: { code: 'USD' },
    update: {},
    create: {
      name: 'US Dollar',
      code: 'USD',
      symbol: '$',
      isActive: true
    }
  })

  await prisma.currency.upsert({
    where: { code: 'EUR' },
    update: {},
    create: {
      name: 'Euro',
      code: 'EUR',
      symbol: '€',
      isActive: true
    }
  })

  // Create some sample languages if they don't exist
  await prisma.language.upsert({
    where: { code: 'ru' },
    update: {},
    create: {
      name: 'Russian',
      code: 'ru',
      isActive: true
    }
  })

  await prisma.language.upsert({
    where: { code: 'en' },
    update: {},
    create: {
      name: 'English',
      code: 'en',
      isActive: true
    }
  })

  // Add countries
  for (const country of countriesData) {
    await prisma.country.upsert({
      where: { code: country.code },
      update: {},
      create: {
        name: country.name,
        code: country.code,
        isActive: true
      }
    })
  }

  // Add states - Russian states data
  const statesData = [
    {"code": "AD", "name": "Republic of Adygea"},
    {"code": "BA", "name": "Republic of Bashkortostan"},
    {"code": "BU", "name": "Republic of Buryatia"},
    {"code": "AL", "name": "Altai Republic"},
    {"code": "DA", "name": "Republic of Dagestan"},
    {"code": "IN", "name": "Republic of Ingushetia"},
    {"code": "KB", "name": "Kabardino-Balkarian Republic"},
    {"code": "KL", "name": "Republic of Kalmykia"},
    {"code": "KC", "name": "Karachay-Cherkess Republic"},
    {"code": "KR", "name": "Republic of Karelia"},
    {"code": "KO", "name": "Komi Republic"},
    {"code": "ME", "name": "Mari El Republic"},
    {"code": "MO", "name": "Republic of Mordovia"},
    {"code": "SA", "name": "Republic of Sakha (Yakutia)"},
    {"code": "SE", "name": "Republic of North Ossetia–Alania"},
    {"code": "TA", "name": "Republic of Tatarstan"},
    {"code": "TY", "name": "Tuva Republic"},
    {"code": "UD", "name": "Udmurt Republic"},
    {"code": "KK", "name": "Republic of Khakassia"},
    {"code": "CE", "name": "Chechen Republic"},
    {"code": "CU", "name": "Chuvash Republic"},
    {"code": "CR", "name": "Republic of Crimea"},
    {"code": "DN", "name": "Donetsk People's Republic"},
    {"code": "LG", "name": "Luhansk People's Republic"},
    {"code": "ALT", "name": "Altai Krai"},
    {"code": "ZAB", "name": "Zabaykalsky Krai"},
    {"code": "KAM", "name": "Kamchatka Krai"},
    {"code": "KDA", "name": "Krasnodar Krai"},
    {"code": "KYA", "name": "Krasnoyarsk Krai"},
    {"code": "PER", "name": "Perm Krai"},
    {"code": "PRI", "name": "Primorsky Krai"},
    {"code": "STA", "name": "Stavropol Krai"},
    {"code": "KHA", "name": "Khabarovsk Krai"},
    {"code": "AMU", "name": "Amur Oblast"},
    {"code": "ARK", "name": "Arkhangelsk Oblast"},
    {"code": "AST", "name": "Astrakhan Oblast"},
    {"code": "BEL", "name": "Belgorod Oblast"},
    {"code": "BRY", "name": "Bryansk Oblast"},
    {"code": "VLA", "name": "Vladimir Oblast"},
    {"code": "VGG", "name": "Volgograd Oblast"},
    {"code": "VLG", "name": "Vologda Oblast"},
    {"code": "VOR", "name": "Voronezh Oblast"},
    {"code": "IVA", "name": "Ivanovo Oblast"},
    {"code": "IRK", "name": "Irkutsk Oblast"},
    {"code": "KGD", "name": "Kaliningrad Oblast"},
    {"code": "KLU", "name": "Kaluga Oblast"},
    {"code": "KEM", "name": "Kemerovo Oblast"},
    {"code": "KIR", "name": "Kirov Oblast"},
    {"code": "KOS", "name": "Kostroma Oblast"},
    {"code": "KGN", "name": "Kurgan Oblast"},
    {"code": "KRS", "name": "Kursk Oblast"},
    {"code": "LEN", "name": "Leningrad Oblast"},
    {"code": "LIP", "name": "Lipetsk Oblast"},
    {"code": "MAG", "name": "Magadan Oblast"},
    {"code": "MOS", "name": "Moscow Oblast"},
    {"code": "MUR", "name": "Murmansk Oblast"},
    {"code": "NIZ", "name": "Nizhny Novgorod Oblast"},
    {"code": "NGR", "name": "Novgorod Oblast"},
    {"code": "NVS", "name": "Novosibirsk Oblast"},
    {"code": "OMS", "name": "Omsk Oblast"},
    {"code": "ORE", "name": "Orenburg Oblast"},
    {"code": "ORL", "name": "Oryol Oblast"},
    {"code": "PNZ", "name": "Penza Oblast"},
    {"code": "PSK", "name": "Pskov Oblast"},
    {"code": "ROS", "name": "Rostov Oblast"},
    {"code": "RYA", "name": "Ryazan Oblast"},
    {"code": "SAM", "name": "Samara Oblast"},
    {"code": "SAR", "name": "Saratov Oblast"},
    {"code": "SAK", "name": "Sakhalin Oblast"},
    {"code": "SVE", "name": "Sverdlovsk Oblast"},
    {"code": "SMO", "name": "Smolensk Oblast"},
    {"code": "TAM", "name": "Tambov Oblast"},
    {"code": "TVE", "name": "Tver Oblast"},
    {"code": "TOM", "name": "Tomsk Oblast"},
    {"code": "TUL", "name": "Tula Oblast"},
    {"code": "TYU", "name": "Tyumen Oblast"},
    {"code": "ULY", "name": "Ulyanovsk Oblast"},
    {"code": "CHE", "name": "Chelyabinsk Oblast"},
    {"code": "YAR", "name": "Yaroslavl Oblast"},
    {"code": "ZAP", "name": "Zaporizhzhia Oblast"},
    {"code": "KHE", "name": "Kherson Oblast"},
    {"code": "MOW", "name": "Moscow"},
    {"code": "SPE", "name": "Saint Petersburg"},
    {"code": "SEV", "name": "Sevastopol"},
    {"code": "NEN", "name": "Nenets Autonomous Okrug"},
    {"code": "KHM", "name": "Khanty-Mansi Autonomous Okrug"},
    {"code": "CHU", "name": "Chukotka Autonomous Okrug"},
    {"code": "YAN", "name": "Yamalo-Nenets Autonomous Okrug"}
  ]

  // Clear existing states first
  await prisma.state.deleteMany({})
  console.log('🗑️  Cleared existing states')

  // Insert new states
  for (const stateData of statesData) {
    await prisma.state.create({
      data: {
        name: stateData.name,
        code: stateData.code,
        isActive: true
      }
    })
    console.log(`✅ Created state: ${stateData.name} (${stateData.code})`)
  }

  console.log(`🎉 Successfully seeded ${statesData.length} states!`)

  // Add cities
  const citiesData = [
    { name: "Los Angeles", code: "LA", countryCode: "US" },
    { name: "San Francisco", code: "SF", countryCode: "US" },
    { name: "Houston", code: "HOU", countryCode: "US" },
    { name: "Dallas", code: "DAL", countryCode: "US" },
    { name: "Miami", code: "MIA", countryCode: "US" },
    { name: "Orlando", code: "ORL", countryCode: "US" },
    { name: "New York City", code: "NYC", countryCode: "US" },
    { name: "Buffalo", code: "BUF", countryCode: "US" },
    { name: "London", code: "LON", countryCode: "GB" },
    { name: "Manchester", code: "MAN", countryCode: "GB" },
    { name: "Edinburgh", code: "EDI", countryCode: "GB" },
    { name: "Glasgow", code: "GLA", countryCode: "GB" },
    { name: "Cardiff", code: "CAR", countryCode: "GB" },
    { name: "Cologne", code: "CGN", countryCode: "DE" },
    { name: "Dusseldorf", code: "DUS", countryCode: "DE" },
    { name: "Munich", code: "MUC", countryCode: "DE" },
    { name: "Nuremberg", code: "NUE", countryCode: "DE" },
    { name: "Berlin", code: "BER", countryCode: "DE" }
  ]

  for (const city of citiesData) {
    await prisma.city.upsert({
      where: {
        name_id: {
          name: city.name,
          id: "city_" + city.code
        }
      },
      update: {},
      create: {
        name: city.name,
        code: city.code,
        isActive: true
      }
    })
  }

  // Create email templates
  const welcomeTemplate = await prisma.emailTemplate.upsert({
    where: { name: 'welcome' },
    update: {},
    create: {
      name: 'welcome',
      subject: 'Добро пожаловать, {name}!',
      content: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Добро пожаловать, {name}!</h1>
          <p>Спасибо за регистрацию в нашей системе.</p>
          <p>Ваш аккаунт был успешно создан и готов к использованию.</p>
          <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3>Ваши данные для входа:</h3>
            <p><strong>Email:</strong> {email}</p>
            <p><strong>Дата регистрации:</strong> {date}</p>
          </div>
          <p>Если у вас возникнут вопросы, пожалуйста, свяжитесь с нашей службой поддержки.</p>
          <p>С уважением,<br>Команда поддержки</p>
        </div>
      `
    }
  })

  const passwordResetTemplate = await prisma.emailTemplate.upsert({
    where: { name: 'password-reset' },
    update: {},
    create: {
      name: 'password-reset',
      subject: 'Восстановление пароля - {date}',
      content: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Восстановление пароля</h1>
          <p>Вы получили это письмо, потому что был сделан запрос на восстановление пароля для вашего аккаунта.</p>
          <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px; text-align: center;">
            <a href="{link}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Восстановить пароль
            </a>
          </div>
          <p>Если вы не запрашивали восстановление пароля, пожалуйста, игнорируйте это письмо.</p>
          <p>Ссылка действительна в течение 24 часов.</p>
          <p>Если у вас возникнут проблемы, пожалуйста, свяжитесь с нашей службой поддержки.</p>
          <p>С уважением,<br>Команда поддержки</p>
        </div>
      `
    }
  })

  const orderConfirmationTemplate = await prisma.emailTemplate.upsert({
    where: { name: 'order-confirmation' },
    update: {},
    create: {
      name: 'order-confirmation',
      subject: 'Подтверждение заказа #{orderId}',
      content: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Подтверждение заказа</h1>
          <p>Здравствуйте, {name}!</p>
          <p>Ваш заказ #{orderId} был успешно оформлен.</p>
          <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3>Детали заказа:</h3>
            <p><strong>Номер заказа:</strong> #{orderId}</p>
            <p><strong>Дата:</strong> {date}</p>
            <p><strong>Сумма:</strong> {amount}</p>
            <p><strong>Статус:</strong> Подтвержден</p>
          </div>
          <p>Спасибо за покупку! Мы свяжемся с вами в ближайшее время для уточнения деталей доставки.</p>
          <p>С уважением,<br>Команда магазина</p>
        </div>
      `
    }
  })

  console.log('Email templates created successfully!')
  console.log('Database seeded successfully!')
  console.log('Users created:')
  console.log('- Email: superadmin@example.com, Password: admin123, Role: superadmin (DEFAULT ADMIN)')
  console.log('- Email: admin@example.com, Password: admin123, Role: admin')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })