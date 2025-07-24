const mongoose = require('mongoose');

const ticketBundelsSchema = new mongoose.Schema({
    name: { type: String, required: true },
    discountPercent: { type: Number, required: true },
    price: { type: Number, required: true },
    description: { type: String, required: true },
    tickets: { type: Number, required: true }
});

module.exports = mongoose.model('TicketBundels', ticketBundelsSchema);
