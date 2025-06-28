const express = require('express');
const router = express.Router();
const {
  createTicket,
  getAllTickets,
  cancelTicket,
  verifyTicket,
} = require('../controllers/ticketController');

router.post('/', createTicket);           // Create ticket
router.get('/', getAllTickets);           // Get all tickets
router.put('/:id/cancel', cancelTicket);  // Cancel ticket
router.post('/tickets/verify', verifyTicket);// ✅ verify ticket through QR scan application

module.exports = router;
