// Using built-in fetch in Node 18+
const fetch = global.fetch || require('node-fetch');

async function testNotificationsAPI() {
  try {
    console.log('🔍 Testing notifications API...\n');

    // Test GET /api/notifications
    console.log('📡 Testing GET /api/notifications...');
    const response = await fetch('http://localhost:3000/api/notifications', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Note: In a real scenario, you'd need to include authentication headers
        // For testing purposes, we'll assume the API handles auth internally
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ API Response:', {
        total: data.total,
        notificationsCount: data.notifications?.length || 0
      });

      if (data.notifications && data.notifications.length > 0) {
        console.log('📋 First 3 notifications:');
        data.notifications.slice(0, 3).forEach((n, i) => {
          console.log(`${i + 1}. ${n.title} (${n.status})`);
        });
      } else {
        console.log('⚠️ No notifications returned by API');
      }
    } else {
      console.log('❌ API Error:', response.status, response.statusText);
      const errorText = await response.text();
      console.log('Error details:', errorText);
    }

  } catch (error) {
    console.error('❌ Network error:', error);
  }
}

testNotificationsAPI();