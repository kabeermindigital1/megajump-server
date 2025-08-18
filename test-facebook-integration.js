require('dotenv').config();
const facebookConversionsService = require('./services/facebookConversionsService');

async function testFacebookIntegration() {
  console.log('🧪 Testing Facebook Conversions API Integration...\n');

  // Test 1: Check if access token is configured
  console.log('1️⃣ Checking Facebook Access Token...');
  if (!process.env.FACEBOOK_ACCESS_TOKEN) {
    console.log('❌ FACEBOOK_ACCESS_TOKEN not found in .env file');
    console.log('   Please add: FACEBOOK_ACCESS_TOKEN=your_access_token_here');
    return;
  }
  console.log('✅ FACEBOOK_ACCESS_TOKEN is configured\n');

  // Test 2: Test API connection
  console.log('2️⃣ Testing Facebook API Connection...');
  try {
    const connectionResult = await facebookConversionsService.testConnection();
    if (connectionResult.success) {
      console.log('✅ Facebook API connection successful');
      console.log(`   Pixel ID: ${connectionResult.pixelId}`);
      console.log(`   Pixel Name: ${connectionResult.pixelName}\n`);
    } else {
      console.log('❌ Facebook API connection failed');
      console.log(`   Error: ${connectionResult.error}\n`);
      return;
    }
  } catch (error) {
    console.log('❌ Facebook API connection test failed');
    console.log(`   Error: ${error.message}\n`);
    return;
  }

  // Test 3: Test purchase event (dry run - won't actually send)
  console.log('3️⃣ Testing Purchase Event Structure...');
  const testTicketData = {
    ticketId: 'TEST-12345',
    email: 'test@example.com',
    phone: '+1234567890',
    subtotal: 25.50,
    currency: 'EUR',
    eventId: `test_purchase_${Date.now()}`,
    eventTime: Math.floor(Date.now() / 1000)
  };

  console.log('   Test Ticket Data:');
  console.log(`   - Ticket ID: ${testTicketData.ticketId}`);
  console.log(`   - Email: ${testTicketData.email}`);
  console.log(`   - Phone: ${testTicketData.phone}`);
  console.log(`   - Amount: €${testTicketData.subtotal}`);
  console.log(`   - Event ID: ${testTicketData.eventId}\n`);

  // Test 4: Test hashing functions
  console.log('4️⃣ Testing Data Hashing...');
  const hashedEmail = facebookConversionsService.hashEmail(testTicketData.email);
  const hashedPhone = facebookConversionsService.hashPhone(testTicketData.phone);
  
  console.log(`   Original Email: ${testTicketData.email}`);
  console.log(`   Hashed Email: ${hashedEmail}`);
  console.log(`   Original Phone: ${testTicketData.phone}`);
  console.log(`   Hashed Phone: ${hashedPhone}\n`);

  // Test 5: Check environment variables
  console.log('5️⃣ Environment Variables Check...');
  console.log(`   FACEBOOK_PIXEL_ID: ${process.env.FACEBOOK_PIXEL_ID || '1121695493214669 (default)'}`);
  console.log(`   FACEBOOK_API_VERSION: ${process.env.FACEBOOK_API_VERSION || 'v17.0 (default)'}`);
  console.log(`   FACEBOOK_ACCESS_TOKEN: ${process.env.FACEBOOK_ACCESS_TOKEN ? '✅ Configured' : '❌ Missing'}\n`);

  console.log('🎯 Integration Test Complete!');
  console.log('\n📋 Next Steps:');
  console.log('   1. Ensure your Facebook access token has proper permissions');
  console.log('   2. Test the /api/facebook/test endpoint');
  console.log('   3. Make a test purchase to verify conversion tracking');
  console.log('   4. Check Meta Events Manager for incoming events');
}

// Run the test
testFacebookIntegration().catch(console.error); 