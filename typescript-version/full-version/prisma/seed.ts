import bcrypt from 'bcryptjs'
import { prisma } from '../src/libs/prisma'
import { encrypt } from '../src/lib/config/encryption'

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
      code: 'SUPERADMIN',
      permissions: JSON.stringify(['all']),
      level: 0,
      isSystem: true
    },
    create: {
      code: 'SUPERADMIN',
      name: 'superadmin',
      description: 'Super Administrator role with full access',
      permissions: JSON.stringify(['all']),
      level: 0,
      isSystem: true
    }
  })

  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {
      code: 'ADMIN',
      permissions: JSON.stringify({
        userManagement: ['create', 'read', 'update', 'delete'],
        roleManagement: ['read'],
        countryManagement: ['create', 'read', 'update', 'delete'],
        currencyManagement: ['create', 'read', 'update', 'delete'],
        stateManagement: ['create', 'read', 'update', 'delete'],
        cityManagement: ['create', 'read', 'update', 'delete'],
        districtManagement: ['create', 'read', 'update', 'delete'],
        languageManagement: ['create', 'read', 'update', 'delete'],
        translationManagement: ['create', 'read', 'update', 'delete'],
        emailTemplatesManagement: ['create', 'read', 'update', 'delete'],
        smtpManagement: ['create', 'read', 'update', 'delete'],
        notificationScenarios: ['create', 'read', 'update', 'delete']
      }),
      level: 10,
      isSystem: true
    },
    create: {
      code: 'ADMIN',
      name: 'admin',
      description: 'Administrator role',
      permissions: JSON.stringify({
        userManagement: ['create', 'read', 'update', 'delete'],
        roleManagement: ['read'],
        countryManagement: ['create', 'read', 'update', 'delete'],
        currencyManagement: ['create', 'read', 'update', 'delete'],
        stateManagement: ['create', 'read', 'update', 'delete'],
        cityManagement: ['create', 'read', 'update', 'delete'],
        districtManagement: ['create', 'read', 'update', 'delete'],
        languageManagement: ['create', 'read', 'update', 'delete'],
        translationManagement: ['create', 'read', 'update', 'delete'],
        emailTemplatesManagement: ['create', 'read', 'update', 'delete'],
        smtpManagement: ['create', 'read', 'update', 'delete'],
        notificationScenarios: ['create', 'read', 'update', 'delete']
      }),
      level: 10,
      isSystem: true
    }
  })

  const userRole = await prisma.role.upsert({
    where: { name: 'user' },
    update: {
      level: 90,
      isSystem: true
    },
    create: {
      code: 'USER',
      name: 'user',
      description: 'Regular user role',
      permissions: JSON.stringify({
        userManagement: ['create', 'read'],
        roleManagement: ['create', 'read', 'update', 'delete'],
        profileManagement: ['read', 'update'],
        contentManagement: ['read']
      }),
      level: 90,
      isSystem: true
    }
  })

  const moderatorRole = await prisma.role.upsert({
    where: { name: 'moderator' },
    update: {
      level: 40,
      isSystem: true
    },
    create: {
      code: 'MODERATOR',
      name: 'moderator',
      description: 'Moderator role with content moderation permissions',
      permissions: JSON.stringify({
        userManagement: ['read'],
        roleManagement: ['read'],
        contentModerationManagement: ['create', 'read', 'update', 'delete']
      }),
      level: 40,
      isSystem: true
    }
  })

  const seoRole = await prisma.role.upsert({
    where: { name: 'seo' },
    update: {
      level: 50,
      isSystem: true
    },
    create: {
      code: 'SEO',
      name: 'seo',
      description: 'SEO specialist role',
      permissions: JSON.stringify({
        contentManagement: ['create', 'read', 'update', 'delete'],
        analyticsManagement: ['read']
      }),
      level: 50,
      isSystem: true
    }
  })

  const editorRole = await prisma.role.upsert({
    where: { name: 'editor' },
    update: {
      level: 30,
      isSystem: true
    },
    create: {
      code: 'EDITOR',
      name: 'editor',
      description: 'Content editor role',
      permissions: JSON.stringify({
        contentManagement: ['create', 'read', 'update', 'delete'],
        mediaManagement: ['create', 'read', 'update', 'delete']
      }),
      level: 30,
      isSystem: true
    }
  })

  const marketologRole = await prisma.role.upsert({
    where: { name: 'marketolog' },
    update: {
      level: 60,
      isSystem: true
    },
    create: {
      code: 'MARKETOLOG',
      name: 'marketolog',
      description: 'Marketing specialist role',
      permissions: JSON.stringify({
        marketingManagement: ['create', 'read', 'update', 'delete'],
        analyticsManagement: ['read']
      }),
      level: 60,
      isSystem: true
    }
  })

  const subscriberRole = await prisma.role.upsert({
    where: { name: 'subscriber' },
    update: {
      level: 80,
      isSystem: true
    },
    create: {
      code: 'SUBSCRIBER',
      name: 'subscriber',
      description: 'Subscriber role with limited access',
      permissions: JSON.stringify({
        contentManagement: ['read'],
        profileManagement: ['read', 'update']
      }),
      level: 80,
      isSystem: true
    }
  })

  const supportRole = await prisma.role.upsert({
    where: { name: 'support' },
    update: {
      level: 70,
      isSystem: true
    },
    create: {
      code: 'SUPPORT',
      name: 'support',
      description: 'Customer support role',
      permissions: JSON.stringify({
        supportManagement: ['create', 'read', 'update', 'delete'],
        userManagement: ['read']
      }),
      level: 70,
      isSystem: true
    }
  })

  const managerRole = await prisma.role.upsert({
    where: { name: 'manager' },
    update: {
      level: 20,
      isSystem: true
    },
    create: {
      code: 'MANAGER',
      name: 'manager',
      description: 'Manager role with team management permissions',
      permissions: JSON.stringify({
        userManagement: ['create', 'read', 'update', 'delete'],
        roleManagement: ['create', 'read', 'update', 'delete'],
        countryManagement: ['create', 'read', 'update', 'delete'],
        currencyManagement: ['create', 'read', 'update', 'delete'],
        stateManagement: ['create', 'read', 'update', 'delete'],
        cityManagement: ['create', 'read', 'update', 'delete'],
        districtManagement: ['create', 'read', 'update', 'delete'],
        languageManagement: ['create', 'read', 'update', 'delete'],
        translationManagement: ['create', 'read', 'update', 'delete'],
        emailTemplatesManagement: ['create', 'read', 'update', 'delete'],
        smtpManagement: ['read']
      }),
      level: 20,
      isSystem: true
    }
  })

  // Create default user
  const hashedPassword = await bcrypt.hash('admin123', 10)

  const user = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      password: hashedPassword,
      roleId: adminRole.id,
      status: 'active'
    },
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: hashedPassword,
      roleId: adminRole.id,
      language: 'ru',
      currency: 'RUB',
      country: 'russia',
      status: 'active'
    }
  })

  // Create superadmin user
  const superadminPassword = await bcrypt.hash('admin123', 10)

  const superadminUser = await prisma.user.upsert({
    where: { email: 'superadmin@example.com' },
    update: {
      password: superadminPassword,
      roleId: superadminRole.id,
      status: 'active'
    },
    create: {
      email: 'superadmin@example.com',
      name: 'Superadmin User',
      password: superadminPassword,
      roleId: superadminRole.id,
      language: 'ru',
      currency: 'RUB',
      country: 'russia',
      status: 'active'
    }
  })

  // Create sample users for each role (except admin/superadmin)
  const defaultUserPassword = await bcrypt.hash('user123', 10)
  const additionalUsers = [
    { email: 'user@example.com', name: 'Regular User', roleId: userRole.id },
    { email: 'moderator@example.com', name: 'Moderator User', roleId: moderatorRole.id },
    { email: 'seo@example.com', name: 'SEO Specialist', roleId: seoRole.id },
    { email: 'editor@example.com', name: 'Content Editor', roleId: editorRole.id },
    { email: 'marketing@example.com', name: 'Marketing Specialist', roleId: marketologRole.id },
    { email: 'subscriber@example.com', name: 'Subscriber User', roleId: subscriberRole.id },
    { email: 'support@example.com', name: 'Support Agent', roleId: supportRole.id },
    { email: 'manager@example.com', name: 'Manager User', roleId: managerRole.id }
  ]

  for (const sampleUser of additionalUsers) {
    await prisma.user.upsert({
      where: { email: sampleUser.email },
      update: {
        password: defaultUserPassword,
        roleId: sampleUser.roleId,
        status: 'active'
      },
      create: {
        email: sampleUser.email,
        name: sampleUser.name,
        password: defaultUserPassword,
        roleId: sampleUser.roleId,
        language: 'ru',
        currency: 'RUB',
        country: 'russia',
        status: 'active'
      }
    })
  }

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

  // Tariff expiration reminder templates
  await prisma.emailTemplate.upsert({
    where: { name: 'tariff-expiring-7-days' },
    update: {},
    create: {
      name: 'tariff-expiring-7-days',
      subject: 'Ваш тариф истекает через 7 дней',
      content: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Напоминание о тарифе</h1>
          <p>Здравствуйте, {name}!</p>
          <p>Ваш тариф <strong>{tariffName}</strong> истекает через <strong>7 дней</strong> ({expirationDate}).</p>
          <div style="background-color: #fff3cd; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #ffc107;">
            <h3 style="color: #856404; margin-top: 0;">Что произойдёт при истечении:</h3>
            <ul style="color: #856404;">
              <li>Аккаунт будет переведён на бесплатный тариф FREE</li>
              <li>Некоторые функции станут недоступны</li>
              <li>Лимиты будут снижены</li>
            </ul>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="{renewUrl}" style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Продлить тариф
            </a>
          </div>
          <p>С уважением,<br>Команда поддержки</p>
        </div>
      `
    }
  })

  await prisma.emailTemplate.upsert({
    where: { name: 'tariff-expiring-3-days' },
    update: {},
    create: {
      name: 'tariff-expiring-3-days',
      subject: '⚠️ Ваш тариф истекает через 3 дня',
      content: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #dc3545;">Срочно: тариф скоро истекает!</h1>
          <p>Здравствуйте, {name}!</p>
          <p>Ваш тариф <strong>{tariffName}</strong> истекает через <strong>3 дня</strong> ({expirationDate}).</p>
          <div style="background-color: #f8d7da; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #dc3545;">
            <h3 style="color: #721c24; margin-top: 0;">Не упустите момент!</h3>
            <p style="color: #721c24;">Продлите тариф сейчас, чтобы не потерять доступ к функциям:</p>
            <ul style="color: #721c24;">
              <li>Публикация объявлений</li>
              <li>Управление менеджерами</li>
              <li>Расширенная статистика</li>
            </ul>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="{renewUrl}" style="background-color: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Продлить тариф сейчас
            </a>
          </div>
          <p>С уважением,<br>Команда поддержки</p>
        </div>
      `
    }
  })

  await prisma.emailTemplate.upsert({
    where: { name: 'tariff-expiring-1-day' },
    update: {},
    create: {
      name: 'tariff-expiring-1-day',
      subject: '🚨 Последний день тарифа!',
      content: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #dc3545;">🚨 Тариф истекает завтра!</h1>
          <p>Здравствуйте, {name}!</p>
          <p>Ваш тариф <strong>{tariffName}</strong> истекает <strong>завтра</strong> ({expirationDate}).</p>
          <div style="background-color: #dc3545; color: white; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0;">⏰ Осталось менее 24 часов!</h3>
            <p>После истечения тарифа вы будете переведены на бесплатный план FREE с ограниченными возможностями.</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="{renewUrl}" style="background-color: #28a745; color: white; padding: 20px 40px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 18px;">
              Продлить тариф немедленно
            </a>
          </div>
          <p>С уважением,<br>Команда поддержки</p>
        </div>
      `
    }
  })

  await prisma.emailTemplate.upsert({
    where: { name: 'tariff-expired' },
    update: {},
    create: {
      name: 'tariff-expired',
      subject: 'Ваш тариф истёк - переход на FREE',
      content: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #6c757d;">Тариф истёк</h1>
          <p>Здравствуйте, {name}!</p>
          <p>Ваш тариф <strong>{previousTariffName}</strong> истёк.</p>
          <div style="background-color: #e9ecef; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin-top: 0;">Ваш аккаунт переведён на бесплатный тариф FREE</h3>
            <p>Теперь вам доступны ограниченные возможности:</p>
            <ul>
              <li>До 5 объявлений</li>
              <li>1 аккаунт</li>
              <li>Базовая поддержка</li>
            </ul>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="{upgradeUrl}" style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Выбрать новый тариф
            </a>
          </div>
          <p>С уважением,<br>Команда поддержки</p>
        </div>
      `
    }
  })

  // Create sample notifications for superadmin user
  const sampleNotifications = [
    {
      title: 'Добро пожаловать в систему! 🎉',
      message: 'Ваш аккаунт суперадминистратора успешно настроен. У вас есть полный доступ ко всем функциям.',
      type: 'system',
      avatarIcon: 'ri-user-star-line',
      avatarColor: 'success',
      status: 'unread',
    },
    {
      title: 'Система готова к работе',
      message: 'Все компоненты системы успешно инициализированы и готовы к использованию.',
      type: 'system',
      avatarIcon: 'ri-check-double-line',
      avatarColor: 'info',
      status: 'unread',
    },
    {
      title: 'Проверьте настройки безопасности',
      message: 'Рекомендуется обновить пароль и настроить двухфакторную аутентификацию.',
      type: 'security',
      avatarIcon: 'ri-shield-check-line',
      avatarColor: 'warning',
      status: 'unread',
    },
    {
      title: 'Новые возможности чата',
      message: 'Теперь доступна система уведомлений о новых сообщениях в реальном времени.',
      type: 'feature',
      avatarIcon: 'ri-chat-1-line',
      avatarColor: 'primary',
      status: 'unread',
    },
    {
      title: 'Бэкап завершен',
      message: 'Автоматический бэкап базы данных выполнен успешно.',
      type: 'system',
      avatarIcon: 'ri-database-2-line',
      avatarColor: 'secondary',
      status: 'read',
    },
    {
      title: 'Обновление системы',
      message: 'Доступно новое обновление системы. Рекомендуется установить обновления для улучшения безопасности.',
      type: 'update',
      avatarIcon: 'ri-refresh-line',
      avatarColor: 'info',
      status: 'unread',
    },
    {
      title: 'Новый пользователь зарегистрирован',
      message: 'Пользователь john.doe@example.com успешно зарегистрировался в системе.',
      type: 'user',
      avatarIcon: 'ri-user-add-line',
      avatarColor: 'success',
      status: 'unread',
    },
    {
      title: 'Ошибка сервера',
      message: 'Обнаружена временная ошибка сервера. Команда разработчиков уже работает над исправлением.',
      type: 'error',
      avatarIcon: 'ri-error-warning-line',
      avatarColor: 'error',
      status: 'unread',
    },
    {
      title: 'Тестовое уведомление 1',
      message: 'Это тестовое уведомление для проверки системы статусов.',
      type: 'system',
      avatarIcon: 'ri-information-line',
      avatarColor: 'primary',
      status: 'unread',
    },
    {
      title: 'Тестовое уведомление 2',
      message: 'Еще одно тестовое уведомление с разным статусом.',
      type: 'system',
      avatarIcon: 'ri-notification-2-line',
      avatarColor: 'info',
      status: 'read',
    },
    {
      title: 'Тестовое уведомление 3',
      message: 'Третье тестовое уведомление для демонстрации архивных уведомлений.',
      type: 'system',
      avatarIcon: 'ri-archive-line',
      avatarColor: 'secondary',
      status: 'archived',
    },
    {
      title: 'Важное обновление',
      message: 'Критическое обновление безопасности доступно. Рекомендуется установить немедленно.',
      type: 'security',
      avatarIcon: 'ri-alert-line',
      avatarColor: 'error',
      status: 'unread',
    }
  ]

  for (const notificationData of sampleNotifications) {
    await prisma.notification.create({
      data: {
        userId: superadminUser.id,
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type,
        status: notificationData.status || 'unread',
        avatarIcon: notificationData.avatarIcon,
        avatarColor: notificationData.avatarColor,
      },
    })
  }

  console.log(`✅ Created ${sampleNotifications.length} sample notifications for superadmin user`)

  // Remove deprecated registration module config
  await prisma.rateLimitConfig.deleteMany({
    where: { module: 'registration' }
  })

  // Create rate limit configurations
  const rateLimitConfigs = [
    {
      module: 'chat-messages',
      maxRequests: 10,
      windowMs: 60000, // 1 minute
      blockMs: 900000, // 15 minutes
      isActive: true
    },
    {
      module: 'chat-rooms',
      maxRequests: 20,
      windowMs: 60000, // 1 minute
      blockMs: 900000, // 15 minutes
      warnThreshold: 2,
      isActive: true
    },
    {
      module: 'ads',
      maxRequests: 5,
      windowMs: 3600000, // 1 hour
      blockMs: 3600000, // 1 hour
      isActive: true
    },
    {
      module: 'upload',
      maxRequests: 20,
      windowMs: 3600000, // 1 hour
      blockMs: 1800000, // 30 minutes
      isActive: true
    },
    {
      module: 'auth',
      maxRequests: 5,
      windowMs: 900000, // 15 minutes
      blockMs: 3600000, // 1 hour
      warnThreshold: 3,
      isActive: true,
      storeEmailInEvents: true,
      storeIpInEvents: true
    },
    {
      module: 'email',
      maxRequests: 50,
      windowMs: 3600000, // 1 hour
      blockMs: 3600000, // 1 hour
      isActive: true
    },
    {
      module: 'export',
      maxRequests: 10,
      windowMs: 900000, // 15 minutes
      blockMs: 900000, // 15 minutes
      warnThreshold: 3,
      isActive: true,
      storeEmailInEvents: true,
      storeIpInEvents: true
    },
    {
      module: 'import',
      maxRequests: 5,
      windowMs: 900000, // 15 minutes
      blockMs: 900000, // 15 minutes
      warnThreshold: 2,
      isActive: true,
      storeEmailInEvents: true,
      storeIpInEvents: true
    },
    // Новые модули для многоуровневой защиты регистрации
    {
      module: 'registration-ip',
      maxRequests: 3,        // 3 регистрации с одного IP
      windowMs: 60 * 60 * 1000, // за 1 час
      blockMs: 24 * 60 * 60 * 1000, // блок на 24 часа
      warnThreshold: 2,
      isActive: true,
      storeEmailInEvents: true,
      storeIpInEvents: true
    },
    {
      module: 'registration-domain',
      maxRequests: 10,       // 10 регистраций с одного домена
      windowMs: 60 * 60 * 1000, // за 1 час
      blockMs: 6 * 60 * 60 * 1000, // блок на 6 часов
      warnThreshold: 5,
      isActive: true,
      storeEmailInEvents: true,
      storeIpInEvents: true
    },
    {
      module: 'registration-email',
      maxRequests: 1,        // 1 попытка на email
      windowMs: 24 * 60 * 60 * 1000, // за 24 часа
      blockMs: 24 * 60 * 60 * 1000, // блок на 24 часа
      warnThreshold: 0,
      isActive: true,
      storeEmailInEvents: true,
      storeIpInEvents: true
    }
  ]

  // Создаем тестовые блокировки для демонстрации системы
  const userBlocks = [
    {
      userId: user.id, // Блокируем обычного админа для тестирования
      reason: 'rate_limit_violation',
      module: 'chat-messages',
      blockedBy: 'system',
      blockedAt: new Date(Date.now() - 30 * 60 * 1000), // Заблокирован 30 минут назад
      unblockedAt: new Date(Date.now() + 10 * 60 * 1000), // Разблокируется через 10 минут
      isActive: true,
      notes: 'Exceeded 10 messages per hour limit - automatic block'
    },
    {
      userId: superadminUser.id, // Блокируем суперадмина для тестирования
      reason: 'spam',
      module: 'ads',
      blockedBy: superadminRole.id, // Заблокирован другим админом
      blockedAt: new Date(Date.now() - 60 * 60 * 1000), // Заблокирован час назад
      unblockedAt: null, // Permanent block
      isActive: true,
      notes: 'Manual block for excessive ad posting'
    },
    {
      userId: user.id,
      reason: 'rate_limit_violation',
      module: 'chat-rooms',
      blockedBy: 'system',
      blockedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 минут назад
      unblockedAt: new Date(Date.now() + 5 * 60 * 1000), // ещё 5 минут блок
      isActive: true,
      notes: 'Создание комнат слишком часто'
    }
  ]

  const ipBlocks = [
    {
      ipAddress: '192.168.1.100',
      reason: 'abuse',
      blockedBy: superadminRole.id,
      blockedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Заблокирован сутки назад
      unblockedAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Разблокируется через сутки
      isActive: true,
      notes: 'Multiple failed login attempts - brute force protection'
    },
    {
      ipAddress: '10.0.0.50',
      reason: 'rate_limit_violation',
      blockedBy: 'system',
      blockedAt: new Date(Date.now() - 15 * 60 * 1000), // Заблокирован 15 минут назад
      unblockedAt: new Date(Date.now() + 45 * 60 * 1000), // Разблокируется через 45 минут
      isActive: true,
      notes: 'Excessive API calls - automatic IP block'
    }
  ]

  for (const config of rateLimitConfigs) {
    await prisma.rateLimitConfig.upsert({
      where: { module: config.module },
      update: {
        maxRequests: config.maxRequests,
        windowMs: config.windowMs,
        blockMs: config.blockMs,
        warnThreshold: config.warnThreshold ?? 0,
        isActive: config.isActive,
        storeEmailInEvents: config.storeEmailInEvents ?? true,
        storeIpInEvents: config.storeIpInEvents ?? true
      },
      create: {
        module: config.module,
        maxRequests: config.maxRequests,
        windowMs: config.windowMs,
        blockMs: config.blockMs,
        warnThreshold: config.warnThreshold ?? 0,
        isActive: config.isActive,
        storeEmailInEvents: config.storeEmailInEvents ?? true,
        storeIpInEvents: config.storeIpInEvents ?? true
      }
    })
  }

  // Создаем блокировки пользователей
  for (const block of userBlocks) {
    await prisma.userBlock.create({
      data: block
    })
  }

  console.log(`✅ Created ${userBlocks.length} user blocks for testing`)

  // IP блокировки теперь создаются через UserBlock с ipAddress полем
  // Создаем блокировки IP через UserBlock
  for (const block of ipBlocks) {
    await prisma.userBlock.create({
      data: {
        ipAddress: block.ipAddress,
        reason: block.reason,
        blockedBy: block.blockedBy,
        blockedAt: block.blockedAt,
        unblockedAt: block.unblockedAt,
        isActive: block.isActive,
        notes: block.notes,
        module: 'general' // Общий модуль для IP блокировок
      }
    })
  }

  console.log(`✅ Created ${ipBlocks.length} IP blocks via UserBlock for testing`)

  // Create demo users with different roles and lastSeen
  const demoUsers = [
    {
      name: 'Маргарита Менеджер',
      email: 'manager.demo@example.com',
      password: 'DemoManager123!',
      roleId: managerRole.id,
      lastSeen: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
    },
    {
      name: 'Матвей Модератор',
      email: 'moderator.demo@example.com',
      password: 'DemoModerator123!',
      roleId: moderatorRole.id,
      lastSeen: new Date(Date.now() - 15 * 60 * 1000) // 15 minutes ago
    },
    {
      name: 'София Support',
      email: 'support.demo@example.com',
      password: 'DemoSupport123!',
      roleId: supportRole.id,
      lastSeen: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
    },
    {
      name: 'Елена Редактор',
      email: 'editor.demo@example.com',
      password: 'DemoEditor123!',
      roleId: editorRole.id,
      lastSeen: new Date(Date.now() - 45 * 60 * 1000) // 45 minutes ago
    },
    {
      name: 'Максим Маркетолог',
      email: 'marketer.demo@example.com',
      password: 'DemoMarketer123!',
      roleId: marketologRole.id,
      lastSeen: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
    }
  ]

  for (const demoUser of demoUsers) {
    const hashedDemoPassword = await bcrypt.hash(demoUser.password, 10)

    await prisma.user.upsert({
      where: { email: demoUser.email },
      update: {
        name: demoUser.name,
        password: hashedDemoPassword,
        roleId: demoUser.roleId,
        lastSeen: demoUser.lastSeen,
        status: 'active'
      },
      create: {
        email: demoUser.email,
        name: demoUser.name,
        password: hashedDemoPassword,
        roleId: demoUser.roleId,
        language: 'ru',
        currency: 'RUB',
        country: 'russia',
        lastSeen: demoUser.lastSeen,
        status: 'active'
      }
    })
  }

  console.log('Email templates created successfully!')

  // ============================================
  // Service Configurations (Test/Example)
  // ============================================
  console.log('Creating test service configurations...')

  // Helper function to safely encrypt (fallback if CREDENTIALS_ENCRYPTION_KEY not set)
  const safeEncrypt = (value: string): string | null => {
    try {
      return encrypt(value)
    } catch (error) {
      console.warn(`⚠️  Cannot encrypt value (CREDENTIALS_ENCRYPTION_KEY not set). Storing as plain text for seed.`)
      return value // В seed можно хранить без шифрования, но в production это недопустимо
    }
  }

  const testServices = [
    // Redis
    {
      name: 'redis',
      displayName: 'Redis (Local Docker)',
      type: 'REDIS',
      host: 'localhost',
      port: 6379,
      protocol: 'redis://',
      username: null,
      password: safeEncrypt(''),
      token: null,
      tlsEnabled: false,
      enabled: false,
      status: 'UNKNOWN',
      metadata: null
    },
    {
      name: 'redis-production',
      displayName: 'Redis (Production)',
      type: 'REDIS',
      host: 'redis.example.com',
      port: 6379,
      protocol: 'rediss://',
      username: null,
      password: safeEncrypt('your-redis-password'),
      token: null,
      tlsEnabled: true,
      enabled: false,
      status: 'UNKNOWN',
      metadata: null
    },
    // PostgreSQL
    {
      name: 'postgresql',
      displayName: 'PostgreSQL (Local)',
      type: 'POSTGRESQL',
      host: 'localhost',
      port: 5432,
      protocol: 'postgresql://',
      username: 'postgres',
      password: safeEncrypt('postgres'),
      token: null,
      tlsEnabled: false,
      enabled: false,
      status: 'UNKNOWN',
      metadata: JSON.stringify({ database: 'mydb' })
    },
    {
      name: 'postgresql-production',
      displayName: 'PostgreSQL (Production)',
      type: 'POSTGRESQL',
      host: 'db.example.com',
      port: 5432,
      protocol: 'postgresql://',
      username: 'app_user',
      password: safeEncrypt('secure-password'),
      token: null,
      tlsEnabled: true,
      enabled: false,
      status: 'UNKNOWN',
      metadata: JSON.stringify({ database: 'production_db' })
    },
    // Prometheus
    {
      name: 'prometheus',
      displayName: 'Prometheus (Local Docker)',
      type: 'PROMETHEUS',
      host: 'localhost',
      port: 9090,
      protocol: 'http://',
      basePath: '/api/v1',
      username: null,
      password: null,
      token: null,
      tlsEnabled: false,
      enabled: false,
      status: 'UNKNOWN',
      metadata: null
    },
    {
      name: 'prometheus-production',
      displayName: 'Prometheus (Production)',
      type: 'PROMETHEUS',
      host: 'prometheus.example.com',
      port: 9090,
      protocol: 'https://',
      basePath: '/api/v1',
      username: null,
      password: null,
      token: safeEncrypt('your-prometheus-token'),
      tlsEnabled: true,
      enabled: false,
      status: 'UNKNOWN',
      metadata: null
    },
    // Loki
    {
      name: 'loki',
      displayName: 'Loki (Local Docker)',
      type: 'LOKI',
      host: 'localhost',
      port: 3100,
      protocol: 'http://',
      basePath: '/loki/api/v1',
      username: null,
      password: null,
      token: null,
      tlsEnabled: false,
      enabled: false,
      status: 'UNKNOWN',
      metadata: null
    },
    {
      name: 'loki-production',
      displayName: 'Loki (Production)',
      type: 'LOKI',
      host: 'loki.example.com',
      port: 3100,
      protocol: 'https://',
      basePath: '/loki/api/v1',
      username: null,
      password: null,
      token: safeEncrypt('your-loki-token'),
      tlsEnabled: true,
      enabled: false,
      status: 'UNKNOWN',
      metadata: null
    },
    // Grafana
    {
      name: 'grafana',
      displayName: 'Grafana (Local Docker)',
      type: 'GRAFANA',
      host: 'localhost',
      port: 3001,
      protocol: 'http://',
      basePath: '/api',
      username: 'admin',
      password: safeEncrypt('admin'),
      token: null,
      tlsEnabled: false,
      enabled: false,
      status: 'UNKNOWN',
      metadata: null
    },
    {
      name: 'grafana-production',
      displayName: 'Grafana (Production)',
      type: 'GRAFANA',
      host: 'grafana.example.com',
      port: 443,
      protocol: 'https://',
      basePath: '/api',
      username: 'grafana_user',
      password: safeEncrypt('secure-password'),
      token: safeEncrypt('your-grafana-api-token'),
      tlsEnabled: true,
      enabled: false,
      status: 'UNKNOWN',
      metadata: null
    },
    // Sentry
    {
      name: 'sentry',
      displayName: 'Sentry (Production)',
      type: 'SENTRY',
      host: 'sentry.io',
      port: 443,
      protocol: 'https://',
      basePath: '/api',
      username: null,
      password: null,
      token: safeEncrypt('https://your-key@sentry.io/your-project-id'),
      tlsEnabled: true,
      enabled: false,
      status: 'UNKNOWN',
      metadata: null
    },
    // S3
    {
      name: 's3-minio',
      displayName: 'S3 MinIO (Local)',
      type: 'S3',
      host: 'localhost',
      port: 9000,
      protocol: 'http',
      username: 'minioadmin',
      password: safeEncrypt('minioadmin123'),
      token: null,
      tlsEnabled: false,
      enabled: false,
      status: 'UNKNOWN',
      metadata: JSON.stringify({
        region: 'us-east-1',
        bucket: 'materio-bucket',
        storageType: 'minio',
        forcePathStyle: true
      })
    },
    {
      name: 's3-aws',
      displayName: 'S3 AWS (Production)',
      type: 'S3',
      host: 's3.amazonaws.com',
      port: 443,
      protocol: 'https://',
      username: 'AKIAIOSFODNN7EXAMPLE',
      password: safeEncrypt('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'),
      token: null,
      tlsEnabled: true,
      enabled: false,
      status: 'UNKNOWN',
      metadata: JSON.stringify({
        region: 'us-east-1',
        bucket: 'my-production-bucket',
        storageType: 'aws',
        forcePathStyle: false
      })
    },
    {
      name: 's3-yandex',
      displayName: 'S3 Yandex Object Storage',
      type: 'S3',
      host: 'storage.yandexcloud.net',
      port: 443,
      protocol: 'https://',
      username: 'YCAJxxxxxxxxxxxxxxxxxxxx',
      password: safeEncrypt('YCMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'),
      token: null,
      tlsEnabled: true,
      enabled: false,
      status: 'UNKNOWN',
      metadata: JSON.stringify({
        region: 'ru-central1',
        bucket: 'my-bucket',
        storageType: 'yandex',
        forcePathStyle: false
      })
    },
    // SMTP
    {
      name: 'smtp-gmail',
      displayName: 'SMTP Gmail',
      type: 'SMTP',
      host: 'smtp.gmail.com',
      port: 587,
      protocol: 'smtp://',
      username: 'your-email@gmail.com',
      password: safeEncrypt('your-app-password'),
      token: null,
      tlsEnabled: true,
      enabled: false,
      status: 'UNKNOWN',
      metadata: null
    },
    {
      name: 'smtp-sendgrid',
      displayName: 'SMTP SendGrid',
      type: 'SMTP',
      host: 'smtp.sendgrid.net',
      port: 587,
      protocol: 'smtp://',
      username: 'apikey',
      password: safeEncrypt('SG.your-sendgrid-api-key'),
      token: null,
      tlsEnabled: true,
      enabled: false,
      status: 'UNKNOWN',
      metadata: null
    },
    // Elasticsearch
    {
      name: 'elasticsearch',
      displayName: 'Elasticsearch (Local)',
      type: 'ELASTICSEARCH',
      host: 'localhost',
      port: 9200,
      protocol: 'http://',
      basePath: '',
      username: 'elastic',
      password: safeEncrypt('changeme'),
      token: null,
      tlsEnabled: false,
      enabled: false,
      status: 'UNKNOWN',
      metadata: null
    },
    {
      name: 'elasticsearch-production',
      displayName: 'Elasticsearch (Production)',
      type: 'ELASTICSEARCH',
      host: 'elasticsearch.example.com',
      port: 9200,
      protocol: 'https://',
      basePath: '',
      username: 'elastic',
      password: safeEncrypt('secure-password'),
      token: null,
      tlsEnabled: true,
      enabled: false,
      status: 'UNKNOWN',
      metadata: null
    },
    // Firecrawl
    {
      name: 'firecrawl',
      displayName: 'Firecrawl (Web Scraper)',
      type: 'FIRECRAWL',
      host: 'api.firecrawl.dev',
      port: 443,
      protocol: 'https://',
      basePath: '/v1',
      username: null,
      password: null,
      token: safeEncrypt('fc-4bca2c4dbee84d85b25f184057534558'),
      tlsEnabled: true,
      enabled: true,
      status: 'UNKNOWN',
      metadata: null
    }
  ]

  for (const service of testServices) {
    await prisma.serviceConfiguration.upsert({
      where: { name: service.name },
      update: {
        displayName: service.displayName,
        type: service.type,
        host: service.host,
        port: service.port,
        protocol: service.protocol,
        basePath: service.basePath || null,
        username: service.username,
        password: service.password,
        token: service.token,
        tlsEnabled: service.tlsEnabled,
        enabled: service.enabled,
        status: service.status,
        metadata: service.metadata || '{}'
      },
      create: {
        name: service.name,
        displayName: service.displayName,
        type: service.type,
        host: service.host,
        port: service.port,
        protocol: service.protocol,
        basePath: service.basePath || null,
        username: service.username,
        password: service.password,
        token: service.token,
        tlsEnabled: service.tlsEnabled,
        enabled: service.enabled,
        status: service.status,
        metadata: service.metadata || '{}'
      }
    })
  }

  console.log(`✅ Created ${testServices.length} test service configurations (all disabled by default)`)

  // Create tariff plans
  const tariffPlans = [
    {
      code: 'FREE',
      name: 'Free',
      description: 'Бесплатный тариф для начала работы',
      price: 0,
      currency: 'RUB',
      features: JSON.stringify({
        maxListings: 5,
        maxCompanies: 1,
        maxAccounts: 1,
        canAssignManagers: false,
        support: 'community'
      }),
      maxAccounts: 1,
      isActive: true,
      isSystem: true
    },
    {
      code: 'BASIC',
      name: 'Basic',
      description: 'Базовый тариф для малого бизнеса',
      price: 500,
      currency: 'RUB',
      features: JSON.stringify({
        maxListings: 50,
        maxCompanies: 3,
        maxAccounts: 3,
        canAssignManagers: true,
        maxManagers: 2,
        support: 'email'
      }),
      maxAccounts: 3,
      isActive: true,
      isSystem: false
    },
    {
      code: 'PRO',
      name: 'Professional',
      description: 'Профессиональный тариф для среднего бизнеса',
      price: 2000,
      currency: 'RUB',
      features: JSON.stringify({
        maxListings: 200,
        maxCompanies: 10,
        maxAccounts: 10,
        canAssignManagers: true,
        maxManagers: 10,
        support: 'priority',
        analytics: true
      }),
      maxAccounts: 10,
      isActive: true,
      isSystem: false
    },
    {
      code: 'ENTERPRISE',
      name: 'Enterprise',
      description: 'Корпоративный тариф для крупного бизнеса',
      price: 10000,
      currency: 'RUB',
      features: JSON.stringify({
        maxListings: -1, // unlimited
        maxCompanies: -1, // unlimited
        maxAccounts: -1, // unlimited
        canAssignManagers: true,
        maxManagers: -1, // unlimited
        support: 'dedicated',
        analytics: true,
        apiAccess: true,
        customIntegration: true
      }),
      maxAccounts: null, // unlimited
      isActive: true,
      isSystem: false
    }
  ]

  for (const plan of tariffPlans) {
    await prisma.tariffPlan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan
    })
  }

  console.log(`✅ Created ${tariffPlans.length} tariff plans`)

  // ==========================================
  // Create demo user accounts
  // ==========================================

  // Get tariff plans for accounts
  const freePlan = await prisma.tariffPlan.findUnique({ where: { code: 'FREE' } })
  const basicPlan = await prisma.tariffPlan.findUnique({ where: { code: 'BASIC' } })
  const proPlan = await prisma.tariffPlan.findUnique({ where: { code: 'PRO' } })

  if (freePlan && basicPlan && proPlan) {
    // Get users for accounts
    const adminUser = await prisma.user.findUnique({ where: { email: 'admin@example.com' } })
    const regularUser = await prisma.user.findUnique({ where: { email: 'user@example.com' } })
    const moderatorUser = await prisma.user.findUnique({ where: { email: 'moderator@example.com' } })
    const editorUser = await prisma.user.findUnique({ where: { email: 'editor@example.com' } })

    if (adminUser && regularUser && moderatorUser && editorUser) {
      // Даты для демо тарифов
      const now = new Date()
      const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      const in5Days = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)   // Для теста напоминания за 3 дня
      const in2Days = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)   // Для теста напоминания за 1 день
      const yesterday = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)  // Для теста истекшего тарифа

      // Create NETWORK account for admin (PRO tariff) - истекает через 30 дней
      const adminAccount = await prisma.userAccount.upsert({
        where: {
          id: 'demo-account-admin-network'
        },
        update: {
          name: 'Сеть компаний Admin',
          description: 'Демо-аккаунт типа "Сеть компаний" с PRO тарифом',
          type: 'NETWORK',
          tariffPlanId: proPlan.id,
          status: 'active',
          tariffStartedAt: now,
          tariffPaidUntil: in30Days,
          tariffAutoRenew: true
        },
        create: {
          id: 'demo-account-admin-network',
          userId: adminUser.id,
          ownerId: adminUser.id,
          name: 'Сеть компаний Admin',
          description: 'Демо-аккаунт типа "Сеть компаний" с PRO тарифом',
          type: 'NETWORK',
          tariffPlanId: proPlan.id,
          status: 'active',
          tariffStartedAt: now,
          tariffPaidUntil: in30Days,
          tariffAutoRenew: true
        }
      })

      // Create LISTING account for regular user (FREE tariff) - пробный период 30 дней
      const userAccount = await prisma.userAccount.upsert({
        where: {
          id: 'demo-account-user-listing'
        },
        update: {
          name: 'Мои объявления',
          description: 'Демо-аккаунт для публикации объявлений',
          type: 'LISTING',
          tariffPlanId: freePlan.id,
          status: 'active',
          tariffStartedAt: now,
          tariffPaidUntil: in5Days, // Истекает через 5 дней (тест напоминания)
          tariffAutoRenew: false
        },
        create: {
          id: 'demo-account-user-listing',
          userId: regularUser.id,
          ownerId: regularUser.id,
          name: 'Мои объявления',
          description: 'Демо-аккаунт для публикации объявлений',
          type: 'LISTING',
          tariffPlanId: freePlan.id,
          status: 'active',
          tariffStartedAt: now,
          tariffPaidUntil: in5Days,
          tariffAutoRenew: false
        }
      })

      // Create COMPANY account for moderator (BASIC tariff) - истекает через 2 дня (тест срочного напоминания)
      const moderatorAccount = await prisma.userAccount.upsert({
        where: {
          id: 'demo-account-moderator-company'
        },
        update: {
          name: 'Компания Модератора',
          description: 'Демо-аккаунт компании с BASIC тарифом',
          type: 'COMPANY',
          tariffPlanId: basicPlan.id,
          status: 'active',
          tariffStartedAt: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000), // Начался 28 дней назад
          tariffPaidUntil: in2Days, // Истекает через 2 дня (тест срочного напоминания)
          tariffAutoRenew: true
        },
        create: {
          id: 'demo-account-moderator-company',
          userId: moderatorUser.id,
          ownerId: moderatorUser.id,
          name: 'Компания Модератора',
          description: 'Демо-аккаунт компании с BASIC тарифом',
          type: 'COMPANY',
          tariffPlanId: basicPlan.id,
          status: 'active',
          tariffStartedAt: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000),
          tariffPaidUntil: in2Days,
          tariffAutoRenew: true
        }
      })

      // Create LISTING account for editor (FREE tariff) - бессрочный (после downgrade)
      const editorAccount = await prisma.userAccount.upsert({
        where: {
          id: 'demo-account-editor-listing'
        },
        update: {
          name: 'Объявления редактора',
          description: 'Демо-аккаунт редактора для объявлений (бессрочный FREE)',
          type: 'LISTING',
          tariffPlanId: freePlan.id,
          status: 'active',
          tariffStartedAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000), // Начался 60 дней назад
          tariffPaidUntil: null, // Бессрочный FREE (после downgrade)
          tariffAutoRenew: false
        },
        create: {
          id: 'demo-account-editor-listing',
          userId: editorUser.id,
          ownerId: editorUser.id,
          name: 'Объявления редактора',
          description: 'Демо-аккаунт редактора для объявлений (бессрочный FREE)',
          type: 'LISTING',
          tariffPlanId: freePlan.id,
          status: 'active',
          tariffStartedAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
          tariffPaidUntil: null,
          tariffAutoRenew: false
        }
      })

      console.log('✅ Created 4 demo user accounts')

      // Assign editor as manager of admin's NETWORK account
      await prisma.accountManager.upsert({
        where: {
          accountId_userId: {
            accountId: adminAccount.id,
            userId: editorUser.id
          }
        },
        update: {
          canEdit: true,
          canManage: false,
          canDelete: false
        },
        create: {
          accountId: adminAccount.id,
          userId: editorUser.id,
          assignedBy: adminUser.id,
          canEdit: true,
          canManage: false,
          canDelete: false
        }
      })

      console.log('✅ Created 1 demo account manager (editor → admin account)')

      // Create demo transfer request from moderator to user
      const existingTransfer = await prisma.accountTransfer.findFirst({
        where: {
          fromAccountId: moderatorAccount.id,
          toUserId: regularUser.id
        }
      })

      if (!existingTransfer) {
        await prisma.accountTransfer.create({
          data: {
            fromAccountId: moderatorAccount.id,
            toUserId: regularUser.id,
            requestedBy: moderatorUser.id,
            status: 'pending'
          }
        })
      }

      console.log('✅ Created 1 demo account transfer request (moderator → user)')
    }
  }

  // ==========================================
  // Workflow & Rules Engine Demo Data
  // ==========================================

  // Create listing categories
  const listingCategories = [
    {
      name: 'Недвижимость',
      slug: 'real-estate',
      description: 'Квартиры, дома, земельные участки',
      icon: 'ri-home-line',
      sortOrder: 1
    },
    {
      name: 'Транспорт',
      slug: 'transport',
      description: 'Автомобили, мотоциклы, спецтехника',
      icon: 'ri-car-line',
      sortOrder: 2
    },
    {
      name: 'Электроника',
      slug: 'electronics',
      description: 'Телефоны, компьютеры, техника',
      icon: 'ri-smartphone-line',
      sortOrder: 3
    },
    {
      name: 'Услуги',
      slug: 'services',
      description: 'Ремонт, строительство, консалтинг',
      icon: 'ri-briefcase-line',
      sortOrder: 4
    },
    {
      name: 'Работа',
      slug: 'jobs',
      description: 'Вакансии и резюме',
      icon: 'ri-user-search-line',
      sortOrder: 5
    }
  ]

  const createdCategories: Record<string, string> = {}

  for (const category of listingCategories) {
    const created = await prisma.listingCategory.upsert({
      where: { slug: category.slug },
      update: category,
      create: category
    })
    createdCategories[category.slug] = created.id
  }

  console.log(`✅ Created ${listingCategories.length} listing categories`)

  // Get users for listings
  const listingOwner = await prisma.user.findUnique({ where: { email: 'user@example.com' } })
  const listingModerator = await prisma.user.findUnique({ where: { email: 'moderator@example.com' } })

  if (listingOwner && listingModerator) {
    // Create demo listings with different workflow states
    const demoListings = [
      {
        id: 'demo-listing-draft',
        title: 'Квартира 2-комнатная (черновик)',
        description: 'Просторная двухкомнатная квартира в центре города. Хороший ремонт, тихий двор.',
        price: 5500000,
        currency: 'RUB',
        categoryId: createdCategories['real-estate'],
        status: 'draft',
        ownerId: listingOwner.id,
        location: 'Москва, Центральный район',
        contacts: JSON.stringify({ phone: '+7 999 123-45-67', email: 'owner@example.com' }),
        images: JSON.stringify(['https://picsum.photos/800/600?random=1']),
        metadata: JSON.stringify({ area: 65, rooms: 2, floor: 5 })
      },
      {
        id: 'demo-listing-pending',
        title: 'Toyota Camry 2020 (на модерации)',
        description: 'Отличное состояние, один владелец, полный комплект документов.',
        price: 2800000,
        currency: 'RUB',
        categoryId: createdCategories['transport'],
        status: 'pending',
        ownerId: listingOwner.id,
        location: 'Санкт-Петербург',
        contacts: JSON.stringify({ phone: '+7 999 234-56-78' }),
        images: JSON.stringify(['https://picsum.photos/800/600?random=2']),
        metadata: JSON.stringify({ year: 2020, mileage: 45000, engine: '2.5L' })
      },
      {
        id: 'demo-listing-active',
        title: 'iPhone 15 Pro Max 256GB (активное)',
        description: 'Новый телефон в заводской упаковке. Гарантия 1 год.',
        price: 145000,
        currency: 'RUB',
        categoryId: createdCategories['electronics'],
        status: 'active',
        ownerId: listingOwner.id,
        moderatorId: listingModerator.id,
        moderatedAt: new Date(),
        publishedAt: new Date(),
        location: 'Москва',
        contacts: JSON.stringify({ telegram: '@seller' }),
        images: JSON.stringify(['https://picsum.photos/800/600?random=3']),
        viewsCount: 156
      },
      {
        id: 'demo-listing-rejected',
        title: 'Услуги по ремонту (отклонено)',
        description: 'Качественный ремонт квартир под ключ.',
        price: null,
        currency: 'RUB',
        categoryId: createdCategories['services'],
        status: 'rejected',
        ownerId: listingOwner.id,
        moderatorId: listingModerator.id,
        moderatedAt: new Date(),
        rejectionReason: 'Недостаточно информации о компании и портфолио работ',
        location: 'Екатеринбург',
        contacts: JSON.stringify({ phone: '+7 999 345-67-89' })
      },
      {
        id: 'demo-listing-sold',
        title: 'MacBook Pro M3 (продано)',
        description: 'Ноутбук в отличном состоянии, использовался 6 месяцев.',
        price: 185000,
        currency: 'RUB',
        categoryId: createdCategories['electronics'],
        status: 'sold',
        ownerId: listingOwner.id,
        moderatorId: listingModerator.id,
        moderatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        soldAt: new Date(),
        location: 'Новосибирск',
        viewsCount: 342
      },
      {
        id: 'demo-listing-archived',
        title: 'Вакансия: Frontend разработчик (архив)',
        description: 'Ищем опытного React разработчика в команду.',
        price: 250000,
        currency: 'RUB',
        categoryId: createdCategories['jobs'],
        status: 'archived',
        ownerId: listingOwner.id,
        archivedAt: new Date(),
        location: 'Удаленно',
        viewsCount: 89
      }
    ]

    for (const listing of demoListings) {
      await prisma.listing.upsert({
        where: { id: listing.id },
        update: listing,
        create: listing
      })
    }

    console.log(`✅ Created ${demoListings.length} demo listings with different workflow states`)

    // Create WorkflowInstance for active listings
    const workflowInstances = [
      {
        type: 'listing',
        entityId: 'demo-listing-draft',
        state: 'draft',
        context: JSON.stringify({ createdAt: new Date().toISOString() })
      },
      {
        type: 'listing',
        entityId: 'demo-listing-pending',
        state: 'pending',
        context: JSON.stringify({ submittedAt: new Date().toISOString() })
      },
      {
        type: 'listing',
        entityId: 'demo-listing-active',
        state: 'active',
        context: JSON.stringify({ approvedAt: new Date().toISOString(), moderatorId: listingModerator.id })
      },
      {
        type: 'listing',
        entityId: 'demo-listing-rejected',
        state: 'rejected',
        context: JSON.stringify({ rejectedAt: new Date().toISOString(), reason: 'Недостаточно информации' })
      },
      {
        type: 'listing',
        entityId: 'demo-listing-sold',
        state: 'sold',
        context: JSON.stringify({ soldAt: new Date().toISOString() })
      },
      {
        type: 'listing',
        entityId: 'demo-listing-archived',
        state: 'archived',
        context: JSON.stringify({ archivedAt: new Date().toISOString() })
      }
    ]

    for (const instance of workflowInstances) {
      await prisma.workflowInstance.upsert({
        where: {
          type_entityId: {
            type: instance.type,
            entityId: instance.entityId
          }
        },
        update: instance,
        create: instance
      })
    }

    console.log(`✅ Created ${workflowInstances.length} workflow instances`)
  }

  // Create demo business rules
  const businessRules = [
    {
      name: 'auto-block-on-spam-reports',
      description: 'Автоблокировка пользователя при 5+ жалобах на спам',
      category: 'blocking',
      conditions: JSON.stringify({
        all: [
          { fact: 'userStats', operator: 'greaterThanInclusive', value: 5, path: '$.reportsCount' }
        ]
      }),
      event: JSON.stringify({
        type: 'user.block',
        params: { reason: 'auto-block-spam-reports', notify: true }
      }),
      priority: 100,
      enabled: true
    },
    {
      name: 'auto-suspend-on-excessive-listings',
      description: 'Автоприостановка при создании 10+ объявлений за час',
      category: 'blocking',
      conditions: JSON.stringify({
        all: [
          { fact: 'userStats', operator: 'greaterThanInclusive', value: 10, path: '$.listingsLastHour' }
        ]
      }),
      event: JSON.stringify({
        type: 'user.suspend',
        params: { reason: 'auto-suspend-excessive-listings', duration: 3600000 }
      }),
      priority: 90,
      enabled: true
    },
    {
      name: 'welcome-email-on-registration',
      description: 'Отправка приветственного письма при регистрации',
      category: 'notification',
      conditions: JSON.stringify({
        all: [
          { fact: 'event.source', operator: 'equal', value: 'auth' },
          { fact: 'event.type', operator: 'equal', value: 'user.registered' }
        ]
      }),
      event: JSON.stringify({
        type: 'notification.send',
        params: { channels: ['email'], templateId: 'welcome', delay: 0 }
      }),
      priority: 50,
      enabled: true
    },
    {
      name: 'listing-approved-notification',
      description: 'Уведомление владельцу при одобрении объявления',
      category: 'notification',
      conditions: JSON.stringify({
        all: [
          { fact: 'event.source', operator: 'equal', value: 'workflow' },
          { fact: 'event.type', operator: 'equal', value: 'listing.approved' }
        ]
      }),
      event: JSON.stringify({
        type: 'notification.send',
        params: { channels: ['email', 'browser'], templateId: 'listing-approved', delay: 0 }
      }),
      priority: 50,
      enabled: true
    },
    {
      name: 'listing-rejected-notification',
      description: 'Уведомление владельцу при отклонении объявления',
      category: 'notification',
      conditions: JSON.stringify({
        all: [
          { fact: 'event.source', operator: 'equal', value: 'workflow' },
          { fact: 'event.type', operator: 'equal', value: 'listing.rejected' }
        ]
      }),
      event: JSON.stringify({
        type: 'notification.send',
        params: { channels: ['email', 'browser'], templateId: 'listing-rejected', delay: 0 }
      }),
      priority: 50,
      enabled: true
    },
    {
      name: 'tariff-expiring-7-days',
      description: 'Напоминание об истечении тарифа за 7 дней',
      category: 'notification',
      conditions: JSON.stringify({
        all: [
          { fact: 'event', operator: 'equal', value: 'scheduler', path: '$.source' },
          { fact: 'event', operator: 'equal', value: 'tariff.check_expiration', path: '$.type' },
          { fact: 'account', operator: 'equal', value: true, path: '$.needsReminder7Days' },
          { fact: 'account', operator: 'notEqual', value: 'FREE', path: '$.tariffPlanCode' }
        ]
      }),
      event: JSON.stringify({
        type: 'notification.send',
        params: { channels: ['email', 'browser'], templateId: 'tariff-expiring-7-days', delay: 0 }
      }),
      priority: 80,
      enabled: true
    },
    {
      name: 'tariff-expiring-3-days',
      description: 'Напоминание об истечении тарифа за 3 дня',
      category: 'notification',
      conditions: JSON.stringify({
        all: [
          { fact: 'event', operator: 'equal', value: 'scheduler', path: '$.source' },
          { fact: 'event', operator: 'equal', value: 'tariff.check_expiration', path: '$.type' },
          { fact: 'account', operator: 'equal', value: true, path: '$.needsReminder3Days' },
          { fact: 'account', operator: 'notEqual', value: 'FREE', path: '$.tariffPlanCode' }
        ]
      }),
      event: JSON.stringify({
        type: 'notification.send',
        params: { channels: ['email', 'browser'], templateId: 'tariff-expiring-3-days', delay: 0 }
      }),
      priority: 85,
      enabled: true
    },
    {
      name: 'tariff-expiring-1-day',
      description: 'Срочное напоминание об истечении тарифа за 1 день',
      category: 'notification',
      conditions: JSON.stringify({
        all: [
          { fact: 'event', operator: 'equal', value: 'scheduler', path: '$.source' },
          { fact: 'event', operator: 'equal', value: 'tariff.check_expiration', path: '$.type' },
          { fact: 'account', operator: 'equal', value: true, path: '$.needsReminder1Day' },
          { fact: 'account', operator: 'notEqual', value: 'FREE', path: '$.tariffPlanCode' }
        ]
      }),
      event: JSON.stringify({
        type: 'notification.send',
        params: { channels: ['email', 'browser', 'sms'], templateId: 'tariff-expiring-1-day', delay: 0 }
      }),
      priority: 90,
      enabled: true
    },
    {
      name: 'tariff-expired',
      description: 'Уведомление об истечении тарифа и переходе на FREE',
      category: 'notification',
      conditions: JSON.stringify({
        all: [
          { fact: 'event', operator: 'equal', value: 'scheduler', path: '$.source' },
          { fact: 'event', operator: 'equal', value: 'tariff.expired', path: '$.type' },
          { fact: 'account', operator: 'equal', value: true, path: '$.tariffExpired' }
        ]
      }),
      event: JSON.stringify({
        type: 'notification.send',
        params: { channels: ['email', 'browser'], templateId: 'tariff-expired', delay: 0 }
      }),
      priority: 100,
      enabled: true
    },
    {
      name: 'new-message-notification',
      description: 'Уведомление о новом сообщении в чате',
      category: 'notification',
      conditions: JSON.stringify({
        all: [
          { fact: 'event.source', operator: 'equal', value: 'chat' },
          { fact: 'event.type', operator: 'equal', value: 'message.received' }
        ]
      }),
      event: JSON.stringify({
        type: 'notification.send',
        params: { channels: ['browser'], delay: 0 }
      }),
      priority: 30,
      enabled: true
    },
    {
      name: 'password-reset-email',
      description: 'Отправка письма для сброса пароля',
      category: 'notification',
      conditions: JSON.stringify({
        all: [
          { fact: 'event.source', operator: 'equal', value: 'auth' },
          { fact: 'event.type', operator: 'equal', value: 'password_reset_requested' }
        ]
      }),
      event: JSON.stringify({
        type: 'notification.send',
        params: { channels: ['email'], templateId: 'password-reset', delay: 0 }
      }),
      priority: 100,
      enabled: true
    }
  ]

  for (const rule of businessRules) {
    await prisma.businessRule.upsert({
      where: { name: rule.name },
      update: rule,
      create: rule
    })
  }

  console.log(`✅ Created ${businessRules.length} demo business rules`)

  console.log('Database seeded successfully!')
  console.log('Users created:')
  console.log('- Email: superadmin@example.com, Password: admin123, Role: superadmin (DEFAULT ADMIN)')
  console.log('- Email: admin@example.com, Password: admin123, Role: admin')
  console.log('- Email: manager.demo@example.com, Password: DemoManager123!, Role: manager')
  console.log('- Email: moderator.demo@example.com, Password: DemoModerator123!, Role: moderator')
  console.log('- Email: support.demo@example.com, Password: DemoSupport123!, Role: support')
  console.log('- Email: editor.demo@example.com, Password: DemoEditor123!, Role: editor')
  console.log('- Email: marketer.demo@example.com, Password: DemoMarketer123!, Role: marketolog')
  console.log('')
  console.log('Demo accounts created:')
  console.log('- admin@example.com → NETWORK account (PRO tariff)')
  console.log('- user@example.com → LISTING account (FREE tariff)')
  console.log('- moderator@example.com → COMPANY account (BASIC tariff)')
  console.log('- editor@example.com → LISTING account (FREE tariff) + manager of admin account')
  console.log('')
  console.log('Demo transfers:')
  console.log('- moderator@example.com → user@example.com (pending)')
  console.log('')
  console.log('Workflow & Rules Engine demo data:')
  console.log('- 5 listing categories (real-estate, transport, electronics, services, jobs)')
  console.log('- 6 demo listings with different workflow states (draft, pending, active, rejected, sold, archived)')
  console.log('- 6 workflow instances for listings')
  console.log('- 8 business rules (blocking + notification)')

  // ========================================
  // Media Module - Настройки изображений
  // ========================================
  console.log('Seeding Media Module...')

  // Глобальные настройки медиа
  await prisma.mediaGlobalSettings.upsert({
    where: { id: 'global-media-settings' },
    update: {},
    create: {
      id: 'global-media-settings',
      defaultStorageStrategy: 'local_first',
      s3DefaultBucket: 'materio-bucket',
      s3DefaultRegion: 'us-east-1',
      s3PublicUrlPrefix: null,
      localUploadPath: '/uploads',
      localPublicUrlPrefix: '/uploads',
      organizeByDate: true,
      organizeByEntityType: true,
      globalMaxFileSize: 20 * 1024 * 1024, // 20MB
      globalDailyUploadLimit: null,
      autoDeleteOrphans: false,
      orphanRetentionDays: 30,
      autoSyncEnabled: false,
      autoSyncDelayMinutes: 30,
      autoCleanupLocalEnabled: false,
      keepLocalDays: 7,
      defaultQuality: 85,
      defaultConvertToWebP: true,
      processingConcurrency: 3,
    }
  })

  console.log('✅ Created global media settings')

  // Настройки по типам сущностей
  const imageSettingsData = [
    {
      entityType: 'user_avatar',
      displayName: 'Аватар пользователя',
      description: 'Фотография профиля пользователя',
      maxFileSize: 5 * 1024 * 1024,
      maxFilesPerEntity: 1,
      allowedMimeTypes: 'image/jpeg,image/png,image/webp',
      variants: JSON.stringify([
        { name: 'thumb', width: 48, height: 48, fit: 'cover', quality: 85 },
        { name: 'small', width: 96, height: 96, fit: 'cover', quality: 85 },
        { name: 'medium', width: 256, height: 256, fit: 'cover', quality: 90 },
      ]),
      convertToWebP: true,
      stripMetadata: true,
      quality: 85,
      watermarkEnabled: false,
      storageStrategy: 'local_first',
      namingStrategy: 'slug',
    },
    {
      entityType: 'company_logo',
      displayName: 'Логотип компании',
      description: 'Логотип организации или компании',
      maxFileSize: 2 * 1024 * 1024,
      maxFilesPerEntity: 1,
      allowedMimeTypes: 'image/jpeg,image/png,image/webp,image/svg+xml',
      variants: JSON.stringify([
        { name: 'thumb', width: 64, height: 64, fit: 'contain', quality: 90 },
        { name: 'small', width: 128, height: 128, fit: 'contain', quality: 90 },
        { name: 'medium', width: 256, height: 256, fit: 'contain', quality: 95 },
      ]),
      convertToWebP: true,
      stripMetadata: true,
      quality: 90,
      watermarkEnabled: false,
      storageStrategy: 'local_first',
      namingStrategy: 'slug',
    },
    {
      entityType: 'company_banner',
      displayName: 'Баннер компании',
      description: 'Баннер или обложка профиля компании',
      maxFileSize: 10 * 1024 * 1024,
      maxFilesPerEntity: 1,
      allowedMimeTypes: 'image/jpeg,image/png,image/webp',
      variants: JSON.stringify([
        { name: 'thumb', width: 400, height: 150, fit: 'cover', quality: 80 },
        { name: 'medium', width: 800, height: 300, fit: 'cover', quality: 85 },
        { name: 'large', width: 1920, height: 480, fit: 'cover', quality: 90 },
      ]),
      convertToWebP: true,
      stripMetadata: true,
      quality: 85,
      watermarkEnabled: false,
      storageStrategy: 'local_first',
      namingStrategy: 'slug',
    },
    {
      entityType: 'company_photo',
      displayName: 'Фото компании',
      description: 'Фотографии офиса, продукции, команды',
      maxFileSize: 10 * 1024 * 1024,
      maxFilesPerEntity: 20,
      allowedMimeTypes: 'image/jpeg,image/png,image/webp',
      variants: JSON.stringify([
        { name: 'thumb', width: 150, height: 150, fit: 'cover', quality: 80 },
        { name: 'medium', width: 600, height: 400, fit: 'cover', quality: 85 },
        { name: 'large', width: 1200, height: 800, fit: 'inside', quality: 90 },
      ]),
      convertToWebP: true,
      stripMetadata: true,
      quality: 85,
      watermarkEnabled: true,
      watermarkPosition: 'bottom-right',
      watermarkOpacity: 0.25,
      watermarkScale: 0.12,
      watermarkOnVariants: 'medium,large',
      storageStrategy: 'local_first',
      namingStrategy: 'slug',
    },
    {
      entityType: 'listing_image',
      displayName: 'Фото объявления',
      description: 'Изображения для объявлений',
      maxFileSize: 10 * 1024 * 1024,
      maxFilesPerEntity: 10,
      allowedMimeTypes: 'image/jpeg,image/png,image/webp',
      variants: JSON.stringify([
        { name: 'thumb', width: 150, height: 150, fit: 'cover', quality: 80 },
        { name: 'medium', width: 600, height: 400, fit: 'cover', quality: 85 },
        { name: 'large', width: 1200, height: 800, fit: 'inside', quality: 90 },
      ]),
      convertToWebP: true,
      stripMetadata: true,
      quality: 85,
      watermarkEnabled: true,
      watermarkPosition: 'bottom-right',
      watermarkOpacity: 0.3,
      watermarkScale: 0.15,
      watermarkOnVariants: 'medium,large',
      storageStrategy: 'local_first',
      namingStrategy: 'slug',
    },
    {
      entityType: 'site_logo',
      displayName: 'Логотип сайта',
      description: 'Логотип и фавикон сайта',
      maxFileSize: 1 * 1024 * 1024,
      maxFilesPerEntity: 1,
      allowedMimeTypes: 'image/png,image/svg+xml,image/x-icon',
      variants: JSON.stringify([
        { name: 'favicon', width: 32, height: 32, fit: 'contain', quality: 100 },
        { name: 'favicon-lg', width: 192, height: 192, fit: 'contain', quality: 100 },
        { name: 'small', width: 120, height: 40, fit: 'contain', quality: 95 },
        { name: 'medium', width: 240, height: 80, fit: 'contain', quality: 95 },
      ]),
      convertToWebP: false,
      stripMetadata: true,
      quality: 95,
      watermarkEnabled: false,
      storageStrategy: 'both',
      namingStrategy: 'slug',
    },
    {
      entityType: 'watermark',
      displayName: 'Водяной знак',
      description: 'PNG изображение с прозрачностью для водяного знака',
      maxFileSize: 1 * 1024 * 1024,
      maxFilesPerEntity: 1,
      allowedMimeTypes: 'image/png',
      variants: JSON.stringify([
        { name: 'original', width: 1000, height: 1000, fit: 'inside', quality: 100 },
      ]),
      convertToWebP: false,
      stripMetadata: true,
      quality: 100,
      watermarkEnabled: false,
      storageStrategy: 'both',
      namingStrategy: 'slug',
    },
    {
      entityType: 'document',
      displayName: 'Документ',
      description: 'Сканы документов, паспортов и т.д.',
      maxFileSize: 15 * 1024 * 1024,
      maxFilesPerEntity: 10,
      allowedMimeTypes: 'image/jpeg,image/png,image/webp,application/pdf',
      variants: JSON.stringify([
        { name: 'thumb', width: 200, height: 200, fit: 'cover', quality: 75 },
        { name: 'preview', width: 800, height: 1200, fit: 'inside', quality: 85 },
      ]),
      convertToWebP: true,
      stripMetadata: false,
      quality: 90,
      watermarkEnabled: false,
      storageStrategy: 's3_only',
      namingStrategy: 'uuid',
    },
    {
      entityType: 'other',
      displayName: 'Прочие файлы',
      description: 'Файлы без категории (медиатека)',
      maxFileSize: 10 * 1024 * 1024,
      maxFilesPerEntity: 100,
      allowedMimeTypes: 'image/jpeg,image/png,image/webp,image/gif',
      variants: JSON.stringify([
        { name: 'thumb', width: 150, height: 150, fit: 'cover', quality: 80 },
        { name: 'medium', width: 600, height: 400, fit: 'inside', quality: 85 },
        { name: 'large', width: 1200, height: 800, fit: 'inside', quality: 90 },
      ]),
      convertToWebP: true,
      stripMetadata: true,
      quality: 85,
      watermarkEnabled: false,
      storageStrategy: 'local_first',
      namingStrategy: 'slug',
    },
  ]

  for (const settings of imageSettingsData) {
    await prisma.imageSettings.upsert({
      where: { entityType: settings.entityType },
      update: settings,
      create: settings,
    })
  }

  console.log(`✅ Created ${imageSettingsData.length} image settings presets`)

  // Демо водяной знак (без медиа файла, нужно загрузить вручную)
  await prisma.watermark.upsert({
    where: { name: 'default' },
    update: {},
    create: {
      name: 'default',
      displayName: 'Водяной знак по умолчанию',
      description: 'Стандартный водяной знак для изображений объявлений',
      mediaId: null, // Нужно загрузить PNG файл через админку
      defaultPosition: 'bottom-right',
      defaultOpacity: 0.3,
      defaultScale: 0.15,
      entityTypes: JSON.stringify(['listing_image', 'company_photo']),
      isDefault: true,
      isActive: true,
    }
  })

  console.log('✅ Created default watermark (upload PNG via admin panel)')

  // Демо лицензии
  const demoLicenses = [
    {
      id: 'demo-license-1',
      licenseType: 'royalty_free',
      licensorName: 'Shutterstock',
      licensorEmail: 'license@shutterstock.com',
      licensorUrl: 'https://www.shutterstock.com',
      licenseeName: 'ООО "Моя Компания"',
      licenseeEmail: 'admin@example.com',
      territory: 'Весь мир',
      notes: 'Демо-лицензия Royalty-Free для тестирования',
    },
    {
      id: 'demo-license-2',
      licenseType: 'creative_commons',
      licensorName: 'John Doe',
      licensorEmail: 'john@example.com',
      licenseeName: 'ООО "Моя Компания"',
      licenseeEmail: 'admin@example.com',
      territory: 'Россия',
      validUntil: new Date('2025-12-31'),
      notes: 'Creative Commons BY-SA 4.0',
    },
    {
      id: 'demo-license-3',
      licenseType: 'exclusive',
      licensorName: 'Фотограф Иван Петров',
      licensorEmail: 'ivan@photo.ru',
      licenseeName: 'ООО "Моя Компания"',
      territory: 'СНГ',
      validFrom: new Date('2024-01-01'),
      validUntil: new Date('2026-01-01'),
      notes: 'Эксклюзивная лицензия на фото продукта',
    },
  ]

  for (const licenseData of demoLicenses) {
    await prisma.mediaLicense.upsert({
      where: { id: licenseData.id },
      update: {},
      create: licenseData,
    })
  }

  console.log(`✅ Created ${demoLicenses.length} demo licenses`)

  console.log('')
  console.log('Media Module:')
  console.log('- Global settings created')
  console.log(`- ${imageSettingsData.length} image settings presets`)
  console.log('- Default watermark placeholder (upload PNG via /admin/media/settings)')
  console.log(`- ${demoLicenses.length} demo licenses`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
