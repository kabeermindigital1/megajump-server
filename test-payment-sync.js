const mongoose = require('mongoose');
const paymentSyncService = require('./services/paymentSyncService');
require('dotenv').config();

async function testPaymentSync() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Test the service
    console.log('🧪 Testing Payment Sync Service...');
    
    // Get status
    const status = paymentSyncService.getStatus();
    console.log('📊 Service Status:', status);

    // Start the service
    paymentSyncService.start();
    console.log('🚀 Service started');

    // Wait a bit and check status again
    setTimeout(() => {
      const newStatus = paymentSyncService.getStatus();
      console.log('📊 Updated Status:', newStatus);
      console.log('📅 Schedule:', newStatus.schedule);
      console.log('⏰ Next Run:', newStatus.nextRun?.toLocaleString());
      
      // Stop the service
      paymentSyncService.stop();
      console.log('⏹️ Service stopped');
      
      process.exit(0);
    }, 5000);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testPaymentSync(); 