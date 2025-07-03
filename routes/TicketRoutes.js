const express = require('express');
const router = express.Router();
const {
  createTicket,
  getAllTickets,
  cancelTicket,
  verifyTicket,
} = require('../controllers/ticketController');

// Base path: /api/tickets
router.post('/', createTicket);           // POST /api/tickets
router.get('/', getAllTickets);           // GET /api/tickets
router.put('/:id/cancel', cancelTicket);  // PUT /api/tickets/:id/cancel

// ✅ Fixed verify route — now correctly maps to /api/tickets/verify
router.post('/verify', verifyTicket);  
module.exports = router;
