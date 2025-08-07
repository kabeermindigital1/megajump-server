const mongoose = require("mongoose");

const EmailLogSchema = new mongoose.Schema({
  email: { type: String, required: true },
  name: { type: String },
  ticketId: { type: String },
  status: { type: String, enum: ["SENT", "FAILED"], default: "SENT" },
  sentAt: { type: Date, default: Date.now },
  error: { type: String },
  retryCount: { type: Number, default: 0 },
  isRetry: { type: Boolean, default: false },
});

module.exports = mongoose.model("EmailLog", EmailLogSchema);
