const express = require('express');
const router = express.Router();
const { massCancelAndRefundBySlot } = require('../controllers/massRefundController');

router.post('/mass-cancel-refund', massCancelAndRefundBySlot);

module.exports = router;
