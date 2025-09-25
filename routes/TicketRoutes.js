const express = require('express');
const router = express.Router();
const {
  createTicket,
  getAllTickets,
  getTicketsByDateRange,
  cancelTicket,
  verifyTicket,
  getTicketAnalytics,
  getEmailStats,
  retryFailedEmail,
  deleteTicketById,
  deleteTicketByBody,
  getUnusedTicketsToday,
  bulkDeleteUnusedTicketsToday,
} = require('../controllers/ticketController');
const { deleteAllTicketsWithAuth } = require('../controllers/ticketController');
// Base path: /api/tickets
router.post('/', createTicket);           // POST /api/tickets
router.get('/', getAllTickets);           // GET /api/tickets
router.get('/by-date-range', getTicketsByDateRange); // GET /api/tickets/by-date-range
router.get('/analytics', getTicketAnalytics); // GET /api/tickets/analytics
router.put('/:id/cancel', cancelTicket);  // PUT /api/tickets/:id/cancel
router.delete('/:id', deleteTicketById);  // DELETE /api/tickets/:id
// Temporary: allow delete via POST body to bypass method blocks
router.post('/delete', deleteTicketByBody); // POST /api/tickets/delete { id }
router.delete('/delete-all-with-auth', deleteAllTicketsWithAuth);
// ✅ Fixed verify route — now correctly maps to /api/tickets/verify
router.post('/verify', verifyTicket);

// ✅ Email statistics route for admin monitoring
router.get('/email-stats', getEmailStats);
// ✅ Manual retry failed email route
router.post('/retry-email', retryFailedEmail);

// ✅ Admin routes for unused ticket management
router.get('/unused-today', getUnusedTicketsToday);           // GET /api/tickets/unused-today
router.post('/bulk-delete-unused-today', bulkDeleteUnusedTicketsToday); // POST /api/tickets/bulk-delete-unused-today

module.exports = router;
