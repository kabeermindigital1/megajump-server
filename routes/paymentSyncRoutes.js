const express = require('express');
const router = express.Router();
const {
  startPaymentSync,
  stopPaymentSync,
  getPaymentSyncStatus,
  manualPaymentSync
} = require('../controllers/paymentSyncController');

// Payment Sync Service Routes
router.post('/start', startPaymentSync);           // POST /api/payment-sync/start
router.post('/stop', stopPaymentSync);             // POST /api/payment-sync/stop
router.get('/status', getPaymentSyncStatus);       // GET /api/payment-sync/status
router.post('/manual-sync', manualPaymentSync);    // POST /api/payment-sync/manual-sync

module.exports = router; 