const express = require('express');
const router = express.Router();
const {
  createDiscountVoucher,
  getAllDiscountVouchers,
  getDiscountVoucherById,
  updateDiscountVoucher,
  deleteDiscountVoucher,
  validateDiscountVoucher,
  incrementVoucherUsage,
  getVoucherUsageStats
} = require('../controllers/discountVoucherController');

// Base path: /api/discount-vouchers

// Create a new discount voucher
router.post('/', createDiscountVoucher);

// Get all discount vouchers (with optional active filter)
router.get('/', getAllDiscountVouchers);

// Get discount voucher by ID
router.get('/:id', getDiscountVoucherById);

// Get voucher usage statistics
router.get('/:id/stats', getVoucherUsageStats);

// Update discount voucher
router.put('/:id', updateDiscountVoucher);

// Delete discount voucher
router.delete('/:id', deleteDiscountVoucher);

// Validate discount voucher
router.post('/validate', validateDiscountVoucher);

// Increment voucher usage count
router.post('/increment-usage', incrementVoucherUsage);

module.exports = router; 