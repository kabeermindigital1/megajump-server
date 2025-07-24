const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  locationName: { type: String, required: true },
  address: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  ticketPrice: { type: Number, required: true },
  socksPrice: { type: Number, required: true },
  cancellationFee: { type: Number, required: true }
});

module.exports = mongoose.model('Setting', settingSchema);
