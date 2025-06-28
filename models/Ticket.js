const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const ticketSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    unique: true,
    index: true,
  },

  date: String,
  time: String, // Optional if you're using startTime + endTime
  startTime: String,
  endTime: String,
  timestamp: Number,

  tickets: Number,
  amount: Number,
  subtotal: Number,

  socksCount: Number,
  cancellationEnabled: Boolean,
  cancellationFee: Number,
  totalAddOnAmount: Number,

  name: String,
  surname: String,
  email: String,
  repeatEmail: String,
  phone: String,
  postalCode: String,
  couponCode: String,

  addonData: {
    type: {
      socksCount: Number,
      cancellationEnabled: Boolean,
      cancellationFee: Number,
      totalAddOnAmount: Number,
    },
  },

  termsAccepted: [Boolean],

  cancelTicket: {
    type: Boolean,
    default: false,
  },

  isUsed: {
    type: Boolean,
    default: false,
  },

  qrCodeData: {
    type: String,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// ✅ Automatically generate ticketId before saving
ticketSchema.pre('save', function (next) {
  if (!this.ticketId) {
    const shortId = uuidv4().split('-')[0].toUpperCase(); // e.g., 'F4A2D9'
    this.ticketId = `MJX-${shortId}`; // Prefix with your brand or venue
  }
  next();
});

module.exports = mongoose.model('Ticket', ticketSchema);
