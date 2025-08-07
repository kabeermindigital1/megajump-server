const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Ticket = require("../models/Ticket");
const TimeSlot = require("../models/TimeSlot");
const Setting = require("../models/Setting");
const { generateAndSendTicketPDF, printTicket } = require("../utils/ticketUtils");

exports.bookWalkInTicket = async (req, res) => {
  try {
    const {
      date,
      startTime,
      endTime,
      tickets,
      socksCount = 0,
      selectedBundel,
      isCashPayment = false,
      skipSlotCheck = false,
      name,
      surname,
      email,
      phone,
      
    } = req.body;

    if (!date || !startTime || !endTime || ( !tickets && !selectedBundel) || !name || !surname || !email) {
      return res.status(400).json({ success: false, message: "Missing required booking details." });
    }

    // Step 1: Optional Slot Check
    if (!skipSlotCheck) {
      const slot = await TimeSlot.findOne({ date, startTime, endTime });
      if (!slot) {
        return res.status(404).json({ success: false, message: "Time slot not found." });
      }

      const existing = await Ticket.aggregate([
        { $match: { date, startTime, endTime, cancelTicket: false } },
        { $group: { _id: null, totalSold: { $sum: "$tickets" } } },
      ]);
      const sold = existing[0]?.totalSold || 0;
      const remaining = slot.maxTickets - sold;

      if (tickets > remaining) {
        return res.status(400).json({ success: false, message: `Only ${remaining} tickets left.` });
      }
    }

    // Step 2: Get prices from settings
    const settings = await Setting.findOne();
    if (!settings) {
      return res.status(500).json({ success: false, message: "Settings not found. Please configure pricing." });
    }

    // Step 3: Calculate pricing using settings
    const ADMIN_FEE = 2.5;
    const ticketPrice = settings.ticketPrice;
    const baseAmount = ticketPrice * tickets;
    const socksPrice = settings.socksPrice;
    const totalSocksAmount = socksCount * socksPrice;
    const bundleNetPrice = selectedBundel?.price || 0;

    const subtotal = baseAmount + bundleNetPrice + totalSocksAmount + ADMIN_FEE;

    // Step 4: Create ticket object
    const ticket = new Ticket({
      date,
      startTime,
      endTime,
      tickets,
      socksCount,
      selectedBundel,
      amount: baseAmount,
      subtotal,
      name,
      surname,
      email,
      phone,
      administrationFee: ADMIN_FEE,
      addonData: {
        socksCount,
        totalAddOnAmount: totalSocksAmount,
      },
      metadata: {
        source: 'walkin',
        paymentMethod: isCashPayment ? 'cash' : 'stripe',
      },
      paymentStatus: isCashPayment ? 'paid' : 'pending',
    });

    // Step 5: Cash flow
    if (isCashPayment) {
      await ticket.save();
      await generateAndSendTicketPDF(ticket);
      await printTicket(ticket);

      return res.status(200).json({
        success: true,
        message: "Ticket booked with cash payment.",
        ticket,
      });
    }

    // Step 6: Online Payment Flow – Create Stripe session
    await ticket.save(); // Save before Stripe to get ticket._id

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email,
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: 'Walk-In Ticket' },
          unit_amount: Math.round(subtotal * 100),
        },
        quantity: 1,
      }],
      metadata: {
        ticketId: ticket._id.toString(),
      },
      success_url: `${process.env.FRONTEND_URL}/walkinTickets?session=success&sessionId={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/walkinTickets?session=cancelled`,
    });
    console.log('🟦 Stripe session created:', JSON.stringify(session, null, 2)); // <-- log full session

    ticket.metadata.stripeSessionId = session.id;
    // ticket.stripePaymentIntentId = session.payment_intent; // <-- store payment_intent
    await ticket.save();

    return res.status(200).json({
      success: true,
      message: "Stripe session created for payment.",
      sessionId: session.id,
      checkoutUrl: session.url,
    });

  } catch (err) {
    console.error("❌ Error in walk-in ticket booking:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error", error: err.message });
  }
};
