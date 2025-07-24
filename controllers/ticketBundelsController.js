const TicketBundels = require('../models/TicketBundels');

// Create a new Ticket Bundel
exports.createTicketBundels = async (req, res) => {
    try {
        const { name, discountPercent, price, description, tickets } = req.body;
        const ticketBundel = new TicketBundels({ name, discountPercent, price, description, tickets });
        await ticketBundel.save();
        res.status(201).json(ticketBundel);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get all Ticket Bundels
exports.getTicketBundels = async (req, res) => {
    try {
        const bundels = await TicketBundels.find();
        res.json(bundels);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Update Ticket Bundel by ID
exports.updateTicketBundels = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, discountPercent, price, description, tickets } = req.body;
        const updatedBundel = await TicketBundels.findByIdAndUpdate(
            id,
            { name, discountPercent, price, description, tickets },
            { new: true }
        );
        res.status(200).json(updatedBundel);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete Ticket Bundel by ID
exports.deleteTicketBundels = async (req, res) => {
    try {
        const { id } = req.params;
        await TicketBundels.findByIdAndDelete(id);
        res.status(200).json({ message: 'Ticket bundel deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete all Ticket Bundels
exports.deleteAllTicketBundels = async (req, res) => {
    try {
        await TicketBundels.deleteMany({});
        res.status(200).json({ message: 'All ticket bundels deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get Ticket Bundel by ID
exports.getTicketBundelsById = async (req, res) => {
    try {
        const { id } = req.params;
        const bundel = await TicketBundels.findById(id);
        res.status(200).json(bundel);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
