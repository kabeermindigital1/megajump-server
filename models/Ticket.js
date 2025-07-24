const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const ticketSchema = new mongoose.Schema({
  ticketId: { type: String, unique: true, index: true },

  date: String,
  startTime: String,
  endTime: String,
  timestamp: Number,

  tickets: Number,
  amount: Number,
  subtotal: Number,
  administrationFee: Number,
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
    socksCount: Number,
    cancellationEnabled: Boolean,
    cancellationFee: Number,
    totalAddOnAmount: Number,
  },

  termsAccepted: [Boolean],

  cancelTicket: { type: Boolean, default: false },
  refundedAmount: { type: Number, default: 0 },
  refundStatus: {
    type: String,
    enum: ["not_requested", "pending", "refunded", "failed"],
    default: "not_requested",
  },

  bundelSelected: { type: Boolean, default: false },
  selectedBundel: {
    name: String,
    discountPercent: Number,
    price: Number,
    description: String,
    tickets: Number,
  },

  isCashPayment: { type: Boolean, default: false },
  skipSlotCheck: { type: Boolean, default: false },

  paymentStatus: {
    type: String,
    enum: ["paid", "pending", "cash"],
    default: "pending",
  },
  paymentMethod: {
    type: String,
    enum: ["card", "cash", "qr"],
    default: "card",
  },
  qrCodePaymentUrl: String,

  refundTransactionId: String,
  refundDate: Date,
  isUsed: { type: Boolean, default: false },
  qrCodeData: String,
  stripePaymentIntentId: String,

  createdAt: { type: Date, default: Date.now },
  metadata: {
    sessionId: String,
    stripeSessionId: String,
    stripePaymentIntentId: String, // <== Move it here
  },
});

ticketSchema.pre('save', function (next) {
  if (!this.ticketId) {
    const shortId = uuidv4().split('-')[0].toUpperCase();
    this.ticketId = `MJX-${shortId}`;
  }
  next();
});

module.exports = mongoose.model('Ticket', ticketSchema);
