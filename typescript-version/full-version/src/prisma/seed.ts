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

  // Add regions - Russian regions data
  const regionsData = [
    { name: "Republic of Adygea", code: "AD", countryCode: "RU" },
    { name: "Republic of Bashkortostan", code: "BA", countryCode: "RU" },
    { name: "Republic of Buryatia", code: "BU", countryCode: "RU" },
    { name: "Altai Republic", code: "AL", countryCode: "RU" },
    { name: "Republic of Dagestan", code: "DA", countryCode: "RU" },
    { name: "Republic of Ingushetia", code: "IN", countryCode: "RU" },
    { name: "Kabardino-Balkarian Republic", code: "KB", countryCode: "RU" },
    { name: "Republic of Kalmykia", code: "KL", countryCode: "RU" },
    { name: "Karachay-Cherkess Republic", code: "KC", countryCode: "RU" },
    { name: "Republic of Karelia", code: "KR", countryCode: "RU" },
    { name: "Komi Republic", code: "KO", countryCode: "RU" },
    { name: "Mari El Republic", code: "ME", countryCode: "RU" },
    { name: "Republic of Mordovia", code: "MO", countryCode: "RU" },
    { name: "Republic of Sakha (Yakutia)", code: "SA", countryCode: "RU" },
    { name: "Republic of North Ossetia–Alania", code: "SE", countryCode: "RU" },
    { name: "Republic of Tatarstan", code: "TA", countryCode: "RU" },
    { name: "Tuva Republic", code: "TY", countryCode: "RU" },
    { name: "Udmurt Republic", code: "UD", countryCode: "RU" },
    { name: "Republic of Khakassia", code: "KK", countryCode: "RU" },
    { name: "Chechen Republic", code: "CE", countryCode: "RU" },
    { name: "Chuvash Republic", code: "CU", countryCode: "RU" },
    { name: "Republic of Crimea", code: "CR", countryCode: "RU" },
    { name: "Donetsk People's Republic", code: "DN", countryCode: "RU" },
    { name: "Luhansk People's Republic", code: "LG", countryCode: "RU" },
    { name: "Altai Krai", code: "ALT", countryCode: "RU" },
    { name: "Zabaykalsky Krai", code: "ZAB", countryCode: "RU" },
    { name: "Kamchatka Krai", code: "KAM", countryCode: "RU" },
    { name: "Krasnodar Krai", code: "KDA", countryCode: "RU" },
    { name: "Krasnoyarsk Krai", code: "KYA", countryCode: "RU" },
    { name: "Perm Krai", code: "PER", countryCode: "RU" },
    { name: "Primorsky Krai", code: "PRI", countryCode: "RU" },
    { name: "Stavropol Krai", code: "STA", countryCode: "RU" },
    { name: "Khabarovsk Krai", code: "KHA", countryCode: "RU" },
    { name: "Amur Oblast", code: "AMU", countryCode: "RU" },
    { name: "Arkhangelsk Oblast", code: "ARK", countryCode: "RU" },
    { name: "Astrakhan Oblast", code: "AST", countryCode: "RU" },
    { name: "Belgorod Oblast", code: "BEL", countryCode: "RU" },
    { name: "Bryansk Oblast", code: "BRY", countryCode: "RU" },
    { name: "Vladimir Oblast", code: "VLA", countryCode: "RU" },
    { name: "Volgograd Oblast", code: "VGG", countryCode: "RU" },
    { name: "Vologda Oblast", code: "VLG", countryCode: "RU" },
    { name: "Voronezh Oblast", code: "VOR", countryCode: "RU" },
    { name: "Ivanovo Oblast", code: "IVA", countryCode: "RU" },
    { name: "Irkutsk Oblast", code: "IRK", countryCode: "RU" },
    { name: "Kaliningrad Oblast", code: "KGD", countryCode: "RU" },
    { name: "Kaluga Oblast", code: "KLU", countryCode: "RU" },
    { name: "Kemerovo Oblast", code: "KEM", countryCode: "RU" },
    { name: "Kirov Oblast", code: "KIR", countryCode: "RU" },
    { name: "Kostroma Oblast", code: "KOS", countryCode: "RU" },
    { name: "Kurgan Oblast", code: "KGN", countryCode: "RU" },
    { name: "Kursk Oblast", code: "KRS", countryCode: "RU" },
    { name: "Leningrad Oblast", code: "LEN", countryCode: "RU" },
    { name: "Lipetsk Oblast", code: "LIP", countryCode: "RU" },
    { name: "Magadan Oblast", code: "MAG", countryCode: "RU" },
    { name: "Moscow Oblast", code: "MOS", countryCode: "RU" },
    { name: "Murmansk Oblast", code: "MUR", countryCode: "RU" },
    { name: "Nizhny Novgorod Oblast", code: "NIZ", countryCode: "RU" },
    { name: "Novgorod Oblast", code: "NGR", countryCode: "RU" },
    { name: "Novosibirsk Oblast", code: "NVS", countryCode: "RU" },
    { name: "Omsk Oblast", code: "OMS", countryCode: "RU" },
    { name: "Orenburg Oblast", code: "ORE", countryCode: "RU" },
    { name: "Oryol Oblast", code: "ORL", countryCode: "RU" },
    { name: "Penza Oblast", code: "PNZ", countryCode: "RU" },
    { name: "Pskov Oblast", code: "PSK", countryCode: "RU" },
    { name: "Rostov Oblast", code: "ROS", countryCode: "RU" },
    { name: "Ryazan Oblast", code: "RYA", countryCode: "RU" },
    { name: "Samara Oblast", code: "SAM", countryCode: "RU" },
    { name: "Saratov Oblast", code: "SAR", countryCode: "RU" },
    { name: "Sakhalin Oblast", code: "SAK", countryCode: "RU" },
    { name: "Sverdlovsk Oblast", code: "SVE", countryCode: "RU" },
    { name: "Smolensk Oblast", code: "SMO", countryCode: "RU" },
    { name: "Tambov Oblast", code: "TAM", countryCode: "RU" },
    { name: "Tver Oblast", code: "TVE", countryCode: "RU" },
    { name: "Tomsk Oblast", code: "TOM", countryCode: "RU" },
    { name: "Tula Oblast", code: "TUL", countryCode: "RU" },
    { name: "Tyumen Oblast", code: "TYU", countryCode: "RU" },
    { name: "Ulyanovsk Oblast", code: "ULY", countryCode: "RU" },
    { name: "Chelyabinsk Oblast", code: "CHE", countryCode: "RU" },
    { name: "Yaroslavl Oblast", code: "YAR", countryCode: "RU" },
    { name: "Zaporizhzhia Oblast", code: "ZAP", countryCode: "RU" },
    { name: "Kherson Oblast", code: "KHE", countryCode: "RU" },
    { name: "Moscow", code: "MOW", countryCode: "RU" },
    { name: "Saint Petersburg", code: "SPE", countryCode: "RU" },
    { name: "Sevastopol", code: "SEV", countryCode: "RU" },
    { name: "Nenets Autonomous Okrug", code: "NEN", countryCode: "RU" },
    { name: "Khanty-Mansi Autonomous Okrug", code: "KHM", countryCode: "RU" },
    { name: "Chukotka Autonomous Okrug", code: "CHU", countryCode: "RU" },
    { name: "Yamalo-Nenets Autonomous Okrug", code: "YAN", countryCode: "RU" }
  ]

  for (const region of regionsData) {
    await prisma.region.upsert({
      where: {
        name_id: {
          name: region.name,
          id: "region_" + region.code
        }
      },
      update: {},
      create: {
        name: region.name,
        code: region.code,
        isActive: true
      }
    })
  }

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