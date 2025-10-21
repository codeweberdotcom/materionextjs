import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Sample data for reference tables
const languages = [
  { name: 'English', code: 'en' },
  { name: 'Spanish', code: 'es' },
  { name: 'French', code: 'fr' },
  { name: 'German', code: 'de' },
  { name: 'Italian', code: 'it' },
  { name: 'Portuguese', code: 'pt' },
  { name: 'Russian', code: 'ru' },
  { name: 'Chinese', code: 'zh' },
  { name: 'Japanese', code: 'ja' },
  { name: 'Korean', code: 'ko' }
]

const countries = [
  { name: 'United States', code: 'US' },
  { name: 'United Kingdom', code: 'GB' },
  { name: 'France', code: 'FR' },
  { name: 'Germany', code: 'DE' },
  { name: 'Italy', code: 'IT' },
  { name: 'Spain', code: 'ES' },
  { name: 'Portugal', code: 'PT' },
  { name: 'Russia', code: 'RU' },
  { name: 'China', code: 'CN' },
  { name: 'Japan', code: 'JP' },
  { name: 'South Korea', code: 'KR' },
  { name: 'Canada', code: 'CA' },
  { name: 'Australia', code: 'AU' },
  { name: 'Brazil', code: 'BR' },
  { name: 'India', code: 'IN' }
]

const timezones = [
  { name: 'UTC-12:00', value: 'utc-12', offset: '-12:00' },
  { name: 'UTC-11:00', value: 'utc-11', offset: '-11:00' },
  { name: 'UTC-10:00', value: 'utc-10', offset: '-10:00' },
  { name: 'UTC-09:00', value: 'utc-09', offset: '-09:00' },
  { name: 'UTC-08:00', value: 'utc-08', offset: '-08:00' },
  { name: 'UTC-07:00', value: 'utc-07', offset: '-07:00' },
  { name: 'UTC-06:00', value: 'utc-06', offset: '-06:00' },
  { name: 'UTC-05:00', value: 'utc-05', offset: '-05:00' },
  { name: 'UTC-04:00', value: 'utc-04', offset: '-04:00' },
  { name: 'UTC-03:00', value: 'utc-03', offset: '-03:00' },
  { name: 'UTC-02:00', value: 'utc-02', offset: '-02:00' },
  { name: 'UTC-01:00', value: 'utc-01', offset: '-01:00' },
  { name: 'UTC+00:00', value: 'utc+00', offset: '+00:00' },
  { name: 'UTC+01:00', value: 'utc+01', offset: '+01:00' },
  { name: 'UTC+02:00', value: 'utc+02', offset: '+02:00' },
  { name: 'UTC+03:00', value: 'utc+03', offset: '+03:00' },
  { name: 'UTC+04:00', value: 'utc+04', offset: '+04:00' },
  { name: 'UTC+05:00', value: 'utc+05', offset: '+05:00' },
  { name: 'UTC+06:00', value: 'utc+06', offset: '+06:00' },
  { name: 'UTC+07:00', value: 'utc+07', offset: '+07:00' },
  { name: 'UTC+08:00', value: 'utc+08', offset: '+08:00' },
  { name: 'UTC+09:00', value: 'utc+09', offset: '+09:00' },
  { name: 'UTC+10:00', value: 'utc+10', offset: '+10:00' },
  { name: 'UTC+11:00', value: 'utc+11', offset: '+11:00' },
  { name: 'UTC+12:00', value: 'utc+12', offset: '+12:00' }
]

const currencies = [
  { name: 'US Dollar', code: 'USD', symbol: '$' },
  { name: 'Euro', code: 'EUR', symbol: '€' },
  { name: 'British Pound', code: 'GBP', symbol: '£' },
  { name: 'Japanese Yen', code: 'JPY', symbol: '¥' },
  { name: 'Swiss Franc', code: 'CHF', symbol: 'CHF' },
  { name: 'Canadian Dollar', code: 'CAD', symbol: 'C$' },
  { name: 'Australian Dollar', code: 'AUD', symbol: 'A$' },
  { name: 'Chinese Yuan', code: 'CNY', symbol: '¥' },
  { name: 'Russian Ruble', code: 'RUB', symbol: '₽' },
  { name: 'Indian Rupee', code: 'INR', symbol: '₹' },
  { name: 'Brazilian Real', code: 'BRL', symbol: 'R$' },
  { name: 'South Korean Won', code: 'KRW', symbol: '₩' }
]

async function main() {
   // Create default roles
   const adminRole = await prisma.role.upsert({
     where: { name: 'admin' },
     update: {},
     create: {
       name: 'admin',
       description: 'Administrator with full access',
       permissions: JSON.stringify(['read', 'write', 'delete', 'manage_users'])
     }
   })

   const userRole = await prisma.role.upsert({
     where: { name: 'user' },
     update: {},
     create: {
       name: 'user',
       description: 'Regular user with basic access',
       permissions: JSON.stringify(['read'])
     }
   })

   const moderatorRole = await prisma.role.upsert({
     where: { name: 'moderator' },
     update: {},
     create: {
       name: 'moderator',
       description: 'Moderator with content management access',
       permissions: JSON.stringify(['read', 'write', 'moderate'])
     }
   })

   // Create default admin user
   const hashedPassword = await bcrypt.hash('admin123', 10)
   const adminUser = await prisma.user.upsert({
     where: { email: 'admin@example.com' },
     update: {},
     create: {
       email: 'admin@example.com',
       name: 'Admin User',
       password: hashedPassword,
       roleId: adminRole.id
     }
   })

   // Seed reference data
   console.log('Seeding reference data...')

   // Seed languages
   for (const language of languages) {
     await prisma.language.upsert({
       where: { code: language.code },
       update: {},
       create: {
         name: language.name,
         code: language.code
       }
     })
   }

   // Seed countries
   for (const country of countries) {
     await prisma.country.upsert({
       where: { code: country.code },
       update: {},
       create: {
         name: country.name,
         code: country.code
       }
     })
   }

   // Seed timezones
   for (const timezone of timezones) {
     await prisma.timezone.upsert({
       where: { value: timezone.value },
       update: {},
       create: {
         name: timezone.name,
         value: timezone.value,
         offset: timezone.offset
       }
     })
   }

   // Seed currencies
   for (const currency of currencies) {
     await prisma.currency.upsert({
       where: { code: currency.code },
       update: {},
       create: {
         name: currency.name,
         code: currency.code,
         symbol: currency.symbol
       }
     })
   }

   // Seed regions/states for major countries
   const usa = await prisma.country.findUnique({ where: { code: 'US' } })
   if (usa) {
     const regions = [
       { name: 'California', code: 'CA' },
       { name: 'New York', code: 'NY' },
       { name: 'Texas', code: 'TX' },
       { name: 'Florida', code: 'FL' },
       { name: 'Illinois', code: 'IL' }
     ]

     for (const region of regions) {
       await prisma.region.upsert({
         where: {
           name_countryId: {
             name: region.name,
             countryId: usa.id
           }
         },
         update: {},
         create: {
           name: region.name,
           code: region.code,
           countryId: usa.id
         }
       })
     }
   }

   console.log('Database seeded successfully!')
   console.log('Default roles created:', { adminRole, userRole, moderatorRole })
   console.log('Default admin user:', { email: adminUser.email })
   console.log('Reference data seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })