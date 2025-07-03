// models/CancelRequest.js
const mongoose = require('mongoose');

const cancelRequestSchema = new mongoose.Schema({
  ticketId: { type: String, required: true },
  email: { type: String, required: true },
  reason: { type: String },
  reviewed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CancelRequest', cancelRequestSchema);
