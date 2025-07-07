const mongoose = require("mongoose");

const pendingTicketSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  bookingInfo: { type: Object, required: true },
}, { timestamps: true });

module.exports = mongoose.model("PendingTicket", pendingTicketSchema);
