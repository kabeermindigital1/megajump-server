const express = require('express');
const router = express.Router();
const ticketBundelsController = require('../controllers/ticketBundelsController');

// Create
router.post('/', ticketBundelsController.createTicketBundels);

// Read All
router.get('/', ticketBundelsController.getTicketBundels);

// Read One
router.get('/:id', ticketBundelsController.getTicketBundelsById);

// Update
router.put('/:id', ticketBundelsController.updateTicketBundels);

// Delete One
router.delete('/:id', ticketBundelsController.deleteTicketBundels);

// Delete All
router.delete('/', ticketBundelsController.deleteAllTicketBundels);

module.exports = router;
