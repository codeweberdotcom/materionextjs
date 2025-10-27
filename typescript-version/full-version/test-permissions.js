const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// Import the RBAC functions (we'll need to copy them or test them separately)
async function testPermissions() {
  try {
    // Get admin user
    const adminUser = await prisma.user.findFirst({
      where: { role: { name: 'admin' } },
      include: { role: true }
    })

    console.log('Testing admin user permissions:')
    console.log(`User: ${adminUser.email}`)
    console.log(`Role: ${adminUser.role.name}`)
    console.log(`Permissions: ${adminUser.role.permissions}`)

    // Test parsing
    try {
      const parsed = JSON.parse(adminUser.role.permissions)
      console.log('✅ Successfully parsed permissions')
      console.log(`Number of modules: ${Object.keys(parsed).length}`)

      // Check if admin has SMTP permission
      const hasSMTP = parsed['SMTP'] && parsed['SMTP'].includes('Read')
      console.log(`Has SMTP Read permission: ${hasSMTP}`)

      // Check if admin has Email Templates permission
      const hasEmailTemplates = parsed['Email Templates'] && parsed['Email Templates'].includes('Read')
      console.log(`Has Email Templates Read permission: ${hasEmailTemplates}`)

    } catch (e) {
      console.log(`❌ Failed to parse permissions: ${e.message}`)
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testPermissions()