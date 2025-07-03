const express = require("express");
const router = express.Router();
const multer = require("multer");
const { sendTicketByEmail } = require("../controllers/emailTicketController");

const upload = multer({ dest: "uploads/" });

router.post("/send-email-ticket", upload.single("ticketPdf"), sendTicketByEmail);

module.exports = router;
