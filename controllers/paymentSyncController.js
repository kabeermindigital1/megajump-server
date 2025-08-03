const paymentSyncService = require('../services/paymentSyncService');

// Start the payment sync service
exports.startPaymentSync = async (req, res) => {
  try {
    paymentSyncService.start();
    
    res.json({
      success: true,
      message: 'Payment sync service started successfully',
      status: paymentSyncService.getStatus()
    });
  } catch (error) {
    console.error('❌ Error starting payment sync service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start payment sync service',
      error: error.message
    });
  }
};

// Stop the payment sync service
exports.stopPaymentSync = async (req, res) => {
  try {
    paymentSyncService.stop();
    
    res.json({
      success: true,
      message: 'Payment sync service stopped successfully',
      status: paymentSyncService.getStatus()
    });
  } catch (error) {
    console.error('❌ Error stopping payment sync service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to stop payment sync service',
      error: error.message
    });
  }
};

// Get payment sync service status
exports.getPaymentSyncStatus = async (req, res) => {
  try {
    const status = paymentSyncService.getStatus();
    
    res.json({
      success: true,
      status: status
    });
  } catch (error) {
    console.error('❌ Error getting payment sync status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment sync status',
      error: error.message
    });
  }
};

// Manually trigger payment sync
exports.manualPaymentSync = async (req, res) => {
  try {
    await paymentSyncService.manualSync();
    
    res.json({
      success: true,
      message: 'Manual payment sync completed successfully',
      status: paymentSyncService.getStatus()
    });
  } catch (error) {
    console.error('❌ Error during manual payment sync:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete manual payment sync',
      error: error.message
    });
  }
}; 