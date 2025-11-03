const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugNotifications() {
  try {
    console.log('🔍 Debugging notifications for superadmin@example.com...\n');

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: 'superadmin@example.com' }
    });

    if (!user) {
      console.log('❌ User superadmin@example.com not found');
      return;
    }

    console.log('✅ User found:', {
      id: user.id,
      email: user.email,
      name: user.name
    });

    // Get all notifications for this user
    const allNotifications = await prisma.notification.findMany({
      where: { userId: user.id }
    });

    console.log(`\n📊 Total notifications in DB: ${allNotifications.length}`);

    // Get active notifications (not archived)
    const activeNotifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
        status: {
          not: 'archived'
        }
      }
    });

    console.log(`📊 Active notifications (not archived): ${activeNotifications.length}`);

    // Show details of all notifications
    console.log('\n📋 All notifications:');
    allNotifications.forEach((n, i) => {
      console.log(`${i + 1}. ID: ${n.id}`);
      console.log(`   Title: ${n.title}`);
      console.log(`   Status: ${n.status}`);
      console.log(`   Created: ${n.createdAt}`);
      console.log('');
    });

    // Show details of active notifications
    console.log('\n📋 Active notifications (should appear in dropdown):');
    activeNotifications.forEach((n, i) => {
      console.log(`${i + 1}. ID: ${n.id}`);
      console.log(`   Title: ${n.title}`);
      console.log(`   Status: ${n.status}`);
      console.log(`   Created: ${n.createdAt}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugNotifications();