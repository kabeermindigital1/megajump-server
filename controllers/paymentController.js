const axios = require("axios");
const Ticket = require("../models/Ticket");
const TimeSlot = require("../models/TimeSlot");
const { v4: uuidv4 } = require("uuid");
const PendingTicket = require("../models/PendingTicket");

// 📌 POST /api/payment/session
exports.createSession = async (req, res) => {
  try {
    const {
      date,
      startTime,
      endTime,
      tickets: requestedTickets,
      subtotal,
      amount,
      name,
      surname,
      email,
    } = req.body;

    // 🔍 Validate fields
    if (!date || !startTime || !endTime || !requestedTickets || !amount || !name || !surname || !email) {
      console.error("❌ Missing booking fields", req.body);
      return res.status(400).json({ success: false, message: "Missing required booking information." });
    }

    const slot = await TimeSlot.findOne({ date, startTime, endTime });
    if (!slot) {
      console.error("❌ Slot not found:", { date, startTime, endTime });
      return res.status(404).json({ success: false, message: "Time slot not found." });
    }

    const existing = await Ticket.aggregate([
      { $match: { date, startTime, endTime, cancelTicket: false } },
      { $group: { _id: null, totalSold: { $sum: "$tickets" } } },
    ]);
    const sold = existing[0]?.totalSold || 0;
    const remaining = slot.maxTickets - sold;

    if (requestedTickets > remaining) {
      return res.status(400).json({
        success: false,
        message: `Only ${remaining} tickets left.`,
        remaining,
      });
    }

    const merchantReference = `MJ-${Date.now()}`;
    const sessionPayload = {
      type: "purchase",
      amount: amount.toFixed(2),
      currency: "NZD",
      merchantReference,
      methods: ["card"],
      customer: {
        email,
        name: `${name} ${surname}`,
      },
      notificationUrl: `${process.env.BASE_URL}/api/payment/notification`,
      callbackUrls: {
        approved: `${process.env.FRONTEND_URL}/ticket-booking?session=success`,
        declined: `${process.env.FRONTEND_URL}/ticket-booking?session=declined`,
        cancelled: `${process.env.FRONTEND_URL}/ticket-booking?session=cancelled`,
      },
      metadata: {
        bookingInfo: JSON.stringify(req.body),
      },
    };

    console.log("🔍 Windcave Session Payload:", sessionPayload);

    const username = process.env.WINDCAVE_USERNAME;
    const apiKey = process.env.WINDCAVE_API_KEY;
    const apiUrl = process.env.WINDCAVE_API_URL;

    if (!username || !apiKey || !apiUrl) {
      return res.status(500).json({ success: false, message: "Payment config error." });
    }

    const authHeader = "Basic " + Buffer.from(`${username}:${apiKey}`).toString("base64");

    const sessionRes = await axios.post(`${apiUrl}/sessions`, sessionPayload, {
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });

    const hppLink = sessionRes.data.links.find(link => link.rel === "hpp");

    if (!hppLink) {
      return res.status(500).json({ success: false, message: "HPP link not found." });
    }

    // ✅ Save pending ticket info
    await PendingTicket.create({
      sessionId: sessionRes.data.id,
      bookingInfo: req.body,
    });
    console.log("📝 Saved pending booking info for session:", sessionRes.data.id);

    console.log("✅ Session Created:", sessionRes.data.id);
    console.log("🔗 Redirect URL:", hppLink.href);

    return res.status(200).json({
      success: true,
      message: "Session created.",
      sessionId: sessionRes.data.id,
      checkoutUrl: hppLink.href,
    });
  } catch (err) {
    console.error("❌ Session error:", err.response?.data || err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to create session.",
      error: err.response?.data || err.message,
    });
  }
};

// 📌 POST /api/payment/notification
exports.handleNotification = async (req, res) => {
  try {
    const sessionId = req.body.sessionId || req.query.sessionId;
    if (!sessionId) {
      console.error("❌ Missing sessionId in webhook");
      return res.status(400).json({ success: false, message: "Missing sessionId." });
    }

    console.log("📨 Webhook triggered for session:", sessionId);

    const sessionRes = await axios.get(`${process.env.WINDCAVE_API_URL}/sessions/${sessionId}`, {
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${process.env.WINDCAVE_USERNAME}:${process.env.WINDCAVE_API_KEY}`).toString('base64'),
        "Content-Type": "application/json",
      },
    });

    const session = sessionRes.data;
    console.log("📨 Full session object received:", JSON.stringify(session, null, 2));

    const transaction = session.transactions?.[0];
    if (!transaction || !transaction.authorised) {
      console.error("❌ Transaction not authorized or missing.");
      return res.status(400).json({ success: false, message: "Payment not authorized." });
    }

    const pending = await PendingTicket.findOne({ sessionId });
    if (!pending) {
      console.error("❌ No pending booking found for session:", sessionId);
      return res.status(400).json({ success: false, message: "Missing booking info for session." });
    }

    const bookingInfo = pending.bookingInfo;

    console.log("📦 Creating ticket with recovered pending info:", {
      sessionId,
      transactionId: transaction.id,
    });

    const newTicket = new Ticket({
      ...bookingInfo,
      metadata: {
        sessionId,
        transactionId: transaction.id,
        windcaveResponse: transaction,
      },
    });

    await newTicket.save();
    await PendingTicket.deleteOne({ sessionId });
    console.log("✅ Ticket saved to DB:", newTicket._id);
    console.log("🧹 Cleaned up pending ticket for session:", sessionId);

    return res.status(200).json({ success: true, message: "Ticket saved.", ticket: newTicket });

  } catch (err) {
    console.error("❌ Notification error:", err.response?.data || err.message, {
      stack: err.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Error handling notification.",
      error: err.response?.data || err.message,
    });
  }
};

// 📌 GET /api/payment/session-result/:sessionId
exports.getTicketBySession = async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const ticket = await Ticket.findOne({ "metadata.sessionId": sessionId });
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found." });
    }

    console.log("🎫 Ticket retrieved by sessionId:", sessionId);
    return res.status(200).json({
      success: true,
      message: "Ticket found.",
      ticket,
    });
  } catch (err) {
    console.error("❌ Error fetching ticket by sessionId:", err.message);
    return res.status(500).json({
      success: false,
      message: "Error fetching ticket.",
      error: err.message,
    });
  }
};
