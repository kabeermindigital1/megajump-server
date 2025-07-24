const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");

// Raw body for Stripe webhook (must come BEFORE express.json())
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  paymentController.handleWebhook
);

// Apply express.json() for all routes *after* the webhook
router.use(express.json());

// Create Stripe checkout session
router.post("/session", paymentController.createSession);

// Get ticket after successful session
router.get("/session-result/:sessionId", paymentController.getTicketBySession);

module.exports = router;
