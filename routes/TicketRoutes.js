const express = require('express');
const router = express.Router();
const {
  createTicket,
  getAllTickets,
  cancelTicket,
  verifyTicket,
  getTicketAnalytics,
} = require('../controllers/ticketController');
const { deleteAllTicketsWithAuth } = require('../controllers/ticketController');
// Base path: /api/tickets
router.post('/', createTicket);           // POST /api/tickets
router.get('/', getAllTickets);           // GET /api/tickets
router.get('/analytics', getTicketAnalytics); // GET /api/tickets/analytics
router.put('/:id/cancel', cancelTicket);  // PUT /api/tickets/:id/cancel
router.delete('/delete-all-with-auth', deleteAllTicketsWithAuth);
// ✅ Fixed verify route — now correctly maps to /api/tickets/verify
router.post('/verify', verifyTicket);
module.exports = router;
