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