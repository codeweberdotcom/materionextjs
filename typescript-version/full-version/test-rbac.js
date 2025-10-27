// Test the RBAC functions with the new format
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// Copy the RBAC functions here for testing
function parseModulePermissions(permissionsString) {
  if (!permissionsString) {
    return {}
  }

  try {
    const parsed = JSON.parse(permissionsString)
    return (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) ? parsed : {}
  } catch {
    return {}
  }
}

function hasPermissionInternal(user, module, action) {
  if (!user?.role) {
    return false
  }

  // If permissions are 'all', allow everything
  if (user.role.permissions === 'all') {
    return true
  }

  // Parse permissions in new format
  const modulePermissions = parseModulePermissions(user.role.permissions)

  // Check if user has the specific action for the module
  return modulePermissions[module]?.includes(action) || false
}

function hasPermissionCompat(user, permission) {
  // Try to detect if this is a new format permission (contains dash)
  if (permission.includes('-')) {
    // Convert old format permission to new format
    const mapping = {
      'smtp-management-read': { module: 'SMTP', action: 'Read' },
      'email-templates-management-read': { module: 'Email Templates', action: 'Read' },
      'email-templates-management-write': { module: 'Email Templates', action: 'Write' },
      'email-templates-management-create': { module: 'Email Templates', action: 'Create' },
    }

    const mapped = mapping[permission]
    if (mapped) {
      return hasPermissionInternal(user, mapped.module, mapped.action)
    }
  }

  // Fall back to legacy format
  return false
}

async function testRBAC() {
  try {
    // Get admin user
    const adminUser = await prisma.user.findFirst({
      where: { role: { name: 'admin' } },
      include: { role: true }
    })

    console.log('Testing RBAC functions:')
    console.log(`User: ${adminUser.email}`)
    console.log(`Role: ${adminUser.role.name}`)

    // Test SMTP permissions
    const hasSMTPRead = hasPermissionCompat(adminUser, 'smtp-management-read')
    console.log(`✅ SMTP Read permission: ${hasSMTPRead}`)

    // Test Email Templates permissions
    const hasEmailTemplatesRead = hasPermissionCompat(adminUser, 'email-templates-management-read')
    const hasEmailTemplatesWrite = hasPermissionCompat(adminUser, 'email-templates-management-write')
    const hasEmailTemplatesCreate = hasPermissionCompat(adminUser, 'email-templates-management-create')

    console.log(`✅ Email Templates Read permission: ${hasEmailTemplatesRead}`)
    console.log(`✅ Email Templates Write permission: ${hasEmailTemplatesWrite}`)
    console.log(`✅ Email Templates Create permission: ${hasEmailTemplatesCreate}`)

    // Test direct module permission checks
    const hasSMTPDirect = hasPermissionInternal(adminUser, 'SMTP', 'Read')
    const hasEmailTemplatesDirect = hasPermissionInternal(adminUser, 'Email Templates', 'Read')

    console.log(`✅ Direct SMTP Read: ${hasSMTPDirect}`)
    console.log(`✅ Direct Email Templates Read: ${hasEmailTemplatesDirect}`)

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testRBAC()