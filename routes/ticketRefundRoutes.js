// routes/ticketRefundRoutes.js

const express = require("express");
const router = express.Router();
const ticketRefundController = require("../controllers/ticketRefundController");

// Admin triggers cancellation + refund for a specific ticket
router.post("/cancel-refund/:ticketId", ticketRefundController.cancelAndRefundTicket);

module.exports = router;
