import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function listRoles() {
  const roles = await prisma.role.findMany()

  console.log('Roles in database:')
  roles.forEach(role => {
    console.log(`- ${role.name}: ${role.description}`)
  })
}

listRoles()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })