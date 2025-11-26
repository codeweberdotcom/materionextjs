import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const roles = await prisma.role.findMany({ orderBy: { level: 'asc' } })
  console.table(roles.map(r => ({ 
    code: r.code, 
    name: r.name, 
    level: r.level, 
    isSystem: r.isSystem 
  })))
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })


