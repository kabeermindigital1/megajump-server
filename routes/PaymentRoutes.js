const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");

router.post("/session", paymentController.createSession);
router.post("/notification", paymentController.handleNotification);
router.get("/session-result/:sessionId", paymentController.getTicketBySession);

module.exports = router;
