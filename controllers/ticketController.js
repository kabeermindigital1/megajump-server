const Ticket = require('../models/Ticket');
const TimeSlot = require('../models/TimeSlot');
const { v4: uuidv4 } = require('uuid');

// ✅ Create ticket with slot availability check
exports.createTicket = async (req, res) => {
  try {
    const {
      date,
      startTime,
      endTime,
      tickets: requestedTickets,
    } = req.body;

    // Step 1: Validate required fields
    if (!date || !startTime || !endTime || !requestedTickets) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: date, startTime, endTime, or tickets",
      });
    }

    // Step 2: Find the matching time slot
    const slot = await TimeSlot.findOne({ date, startTime, endTime });
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: "Time slot not found for the given date and time range.",
      });
    }

    // Step 3: Check how many tickets already sold for this slot
    const existingTickets = await Ticket.aggregate([
      {
        $match: {
          date,
          startTime,
          endTime,
          cancelTicket: false,
        },
      },
      {
        $group: {
          _id: null,
          totalSold: { $sum: "$tickets" },
        },
      },
    ]);

    const ticketsAlreadySold = existingTickets[0]?.totalSold || 0;
    const remainingTickets = slot.maxTickets - ticketsAlreadySold;

    // Step 4: Check if requested number of tickets can be booked
    if (requestedTickets > remainingTickets) {
      return res.status(400).json({
        success: false,
        message: `Only ${remainingTickets} tickets left in this slot. Cannot book ${requestedTickets}.`,
        remaining: remainingTickets,
      });
    }

    // Step 5: Create a unique ticket ID (short & readable)
    const shortId = uuidv4().split('-')[0].toUpperCase(); // e.g., "AB12CD"
    const ticketId = `MJX-${shortId}`;

    // Step 6: Create ticket
    const newTicket = new Ticket({
      ...req.body,
      ticketId,
      qrCodeData: ticketId, // You can also embed more data if needed
    });

    await newTicket.save();

    return res.status(201).json({
      success: true,
      message: "Ticket booked successfully.",
      data: newTicket,
    });
  } catch (error) {
    console.error("Error creating ticket:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while processing the ticket.",
      error: error.message,
    });
  }
};
// Hardcoded admin credentials (for now)
const ADMIN_EMAIL = 'admin';
const ADMIN_PASSWORD = '123456'; // Replace with env or hash check in production

exports.deleteAllTicketsWithAuth = async (req, res) => {
  const { email, password } = req.body;

  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: '❌ Invalid admin credentials.' });
  }

  try {
    const result = await Ticket.deleteMany({});
    res.json({ success: true, message: `✅ Deleted ${result.deletedCount} tickets.` });
  } catch (err) {
    res.status(500).json({ success: false, message: '❌ Failed to delete tickets.', error: err.message });
  }
};

// ✅ Get all tickets
exports.getAllTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find().sort({ createdAt: -1 });
    res.json({ success: true, data: tickets });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ✅ Cancel ticket (update flag only if allowed)
exports.cancelTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const canCancel =
      ticket.cancellationEnabled || ticket.addonData?.cancellationEnabled;

    if (!canCancel) {
      return res.status(403).json({ success: false, message: 'Cancellation not allowed for this ticket' });
    }

    if (ticket.cancelTicket) {
      return res.status(400).json({ success: false, message: 'Ticket already cancelled' });
    }

    ticket.cancelTicket = true;
    await ticket.save();

    res.json({ success: true, message: 'Ticket cancelled successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ✅ VERIFY TICKET (QR SCAN)
exports.verifyTicket = async (req, res) => {
  console.log("Request Body:", req.body);
  try {
    const { ticketId } = req.body;

    if (!ticketId) {
      return res.status(400).json({ success: false, message: 'ticketId is required' });
    }

    const ticket = await Ticket.findOne({ ticketId: ticketId.trim() });

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    if (ticket.cancelTicket) {
      return res.status(403).json({ success: false, message: 'Ticket is cancelled and cannot be used' });
    }

    if (ticket.isUsed) {
      return res.status(409).json({ success: false, message: 'Ticket has already been used' });
    }

    ticket.isUsed = true;
    await ticket.save();

    console.log("Ticket Data Sent:", ticket); // ✅ See full data in terminal

    res.json({ success: true, message: 'Ticket verified and marked as used', ticket });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

