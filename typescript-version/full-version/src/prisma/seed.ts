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
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: 'Administrator role',
      permissions: 'all'
    }
  })

  const userRole = await prisma.role.upsert({
    where: { name: 'user' },
    update: {},
    create: {
      name: 'user',
      description: 'Regular user role',
      permissions: 'read'
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
      language: 'Russian',
      timezone: 'Europe/Moscow',
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

  // Add regions
  const regionsData = [
    { name: "California", code: "CA", countryCode: "US" },
    { name: "New York", code: "NY", countryCode: "US" },
    { name: "Texas", code: "TX", countryCode: "US" },
    { name: "England", code: "ENG", countryCode: "GB" },
    { name: "Scotland", code: "SCO", countryCode: "GB" },
    { name: "North Rhine-Westphalia", code: "NRW", countryCode: "DE" },
    { name: "Bavaria", code: "BY", countryCode: "DE" }
  ]

  for (const region of regionsData) {
    const country = await prisma.country.findUnique({ where: { code: region.countryCode } })
    if (country) {
      await prisma.region.upsert({
        where: { id: `${region.countryCode}-${region.code}` }, // unique id
        update: {},
        create: {
          name: region.name,
          code: region.code,
          countryId: country.id,
          isActive: true
        }
      })
    }
  }

  // Add states
  const statesData = [
    { name: "California", code: "CA", countryCode: "US" },
    { name: "Texas", code: "TX", countryCode: "US" },
    { name: "Florida", code: "FL", countryCode: "US" },
    { name: "New York", code: "NY", countryCode: "US" },
    { name: "England", code: "ENG", countryCode: "GB" },
    { name: "Scotland", code: "SCO", countryCode: "GB" },
    { name: "Wales", code: "WAL", countryCode: "GB" },
    { name: "North Rhine-Westphalia", code: "NRW", countryCode: "DE" },
    { name: "Bavaria", code: "BY", countryCode: "DE" },
    { name: "Berlin", code: "BE", countryCode: "DE" }
  ]

  for (const state of statesData) {
    const country = await prisma.country.findUnique({ where: { code: state.countryCode } })
    if (country) {
      await prisma.state.upsert({
        where: { id: `${state.countryCode}-${state.code}` },
        update: {},
        create: {
          name: state.name,
          code: state.code,
          countryId: country.id,
          isActive: true
        }
      })
    }
  }

  // Add cities
  const citiesData = [
    { name: "Los Angeles", code: "LA", stateCode: "CA", countryCode: "US" },
    { name: "San Francisco", code: "SF", stateCode: "CA", countryCode: "US" },
    { name: "Houston", code: "HOU", stateCode: "TX", countryCode: "US" },
    { name: "Dallas", code: "DAL", stateCode: "TX", countryCode: "US" },
    { name: "Miami", code: "MIA", stateCode: "FL", countryCode: "US" },
    { name: "Orlando", code: "ORL", stateCode: "FL", countryCode: "US" },
    { name: "New York City", code: "NYC", stateCode: "NY", countryCode: "US" },
    { name: "Buffalo", code: "BUF", stateCode: "NY", countryCode: "US" },
    { name: "London", code: "LON", stateCode: "ENG", countryCode: "GB" },
    { name: "Manchester", code: "MAN", stateCode: "ENG", countryCode: "GB" },
    { name: "Edinburgh", code: "EDI", stateCode: "SCO", countryCode: "GB" },
    { name: "Glasgow", code: "GLA", stateCode: "SCO", countryCode: "GB" },
    { name: "Cardiff", code: "CAR", stateCode: "WAL", countryCode: "GB" },
    { name: "Cologne", code: "CGN", stateCode: "NRW", countryCode: "DE" },
    { name: "Dusseldorf", code: "DUS", stateCode: "NRW", countryCode: "DE" },
    { name: "Munich", code: "MUC", stateCode: "BY", countryCode: "DE" },
    { name: "Nuremberg", code: "NUE", stateCode: "BY", countryCode: "DE" },
    { name: "Berlin", code: "BER", stateCode: "BE", countryCode: "DE" }
  ]

  for (const city of citiesData) {
    const state = await prisma.state.findFirst({ where: { code: city.stateCode, country: { code: city.countryCode } } })
    if (state) {
      await prisma.city.upsert({
        where: { id: `${city.countryCode}-${city.stateCode}-${city.code}` },
        update: {},
        create: {
          name: city.name,
          code: city.code,
          stateId: state.id,
          isActive: true
        }
      })
    }
  }

  console.log('Database seeded successfully!')
  console.log('User created:')
  console.log('- Email: admin@example.com')
  console.log('- Password: admin123')
  console.log('- Role: admin')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })