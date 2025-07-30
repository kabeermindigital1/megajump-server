const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Ticket = require("../models/Ticket");
const TimeSlot = require("../models/TimeSlot");

// POST /api/payment/session
exports.createSession = async (req, res) => {
  try {
    const {
      date, startTime, endTime, tickets: requestedTickets, subtotal, amount,
      name, surname, email, socksCount, selectedBundel, administrationFee,
      totalAddOnAmount, isCashPayment = false, skipSlotCheck = false,
      couponCode, phone, addon, addonData
    } = req.body;

    if (!date || !startTime || !endTime || !amount || !name || !surname || !email) {
      return res.status(400).json({ success: false, message: "Missing required booking information." });
    }

    // Check if user has selected either tickets or a bundle
    if (!requestedTickets && !selectedBundel) {
      return res.status(400).json({ success: false, message: "Please select either tickets or a bundle to proceed." });
    }

    if (!skipSlotCheck) {
      const slot = await TimeSlot.findOne({ date, startTime, endTime });
      if (!slot) return res.status(404).json({ success: false, message: "Time slot not found." });

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
    }

    // Save initial ticket
    const ticket = new Ticket({
      date,
      startTime,
      endTime,
      tickets: requestedTickets,
      amount,
      subtotal,
      name,
      surname,
      email,
      phone,
      socksCount,
      selectedBundel,
      administrationFee,
      totalAddOnAmount,
      isCashPayment,
      skipSlotCheck,
      couponCode,
      paymentStatus: 'pending',
      addon,
      addonData,
      metadata: {
        source: 'online',
        paymentMethod: 'stripe',
      }
    });

    await ticket.save();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email,
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: 'MegaJump Tickets' },
          unit_amount: Math.round(subtotal * 100),
        },
        quantity: 1,
      }],
      metadata: {
        ticketId: ticket._id.toString(),
      },
      success_url: `${process.env.FRONTEND_URL}/ticket-booking?session=success&sessionId={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/ticket-booking?session=cancelled`,
    });

    console.log('🟦 Stripe session created:', JSON.stringify(session, null, 2));

    // Save only session ID now (paymentIntent will come via webhook)
    ticket.metadata.stripeSessionId = session.id;
    await ticket.save();

    return res.status(200).json({
      success: true,
      sessionId: session.id,
      checkoutUrl: session.url,
    });

  } catch (err) {
    console.error("❌ Error creating session:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/payment/session-result/:sessionId
exports.getTicketBySession = async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const ticket = await Ticket.findOne({ "metadata.stripeSessionId": sessionId });

    if (!ticket) {
      console.warn("⚠️ No ticket found for session ID:", sessionId);
      return res.status(404).json({ success: false, message: "Ticket not found." });
    }

    return res.status(200).json({ success: true, message: "Ticket found.", ticket });

  } catch (err) {
    console.error("❌ Error retrieving ticket:", err.message);
    return res.status(500).json({ success: false, message: "Server error.", error: err.message });
  }
};

// POST /api/payment/webhook
exports.handleWebhook = async (req, res) => {
  console.log('🚦 [WEBHOOK] Endpoint hit');
  console.log('📝 Raw body received');
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    console.log('✅ [WEBHOOK] Event type:', event.type);
  } catch (err) {
    console.error('❌ [WEBHOOK] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const ticketId = session.metadata?.ticketId;

    console.log('✅ [WEBHOOK] Session completed for session ID:', session.id);
    console.log('🔑 ticketId from metadata:', ticketId);

    if (!ticketId) {
      console.error('❌ No ticketId found in metadata');
      return res.status(400).send('Missing ticket ID in metadata.');
    }

    try {
      const ticket = await Ticket.findById(ticketId);
      if (!ticket) {
        console.error('❌ Ticket not found for ID:', ticketId);
        return res.status(404).send('Ticket not found.');
      }

      ticket.paymentStatus = 'processing'; // temporarily mark
      ticket.metadata.stripeSessionId = session.id;

      await ticket.save();
      console.log('⏳ [WEBHOOK] Ticket saved with status "processing". Waiting 5 mins to fetch payment_intent...');

      // Wait 5 minutes (300000 ms), then fetch payment intent and update ticket
      setTimeout(async () => {
        console.log('\n⏱️ [DELAY] 5 minutes passed. Fetching session again with expand:payment_intent');

        const start = Date.now();
        try {
          const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
            expand: ['payment_intent'],
          });
          const duration = Date.now() - start;

          const paymentIntentId = fullSession.payment_intent?.id;
          const ticketToUpdate = await Ticket.findById(ticketId);

          if (!ticketToUpdate) {
            console.error('❌ Ticket not found after 5 mins delay');
            return;
          }

          if (paymentIntentId) {
            ticketToUpdate.paymentStatus = 'paid';
            ticketToUpdate.metadata.stripePaymentIntentId = paymentIntentId;
            await ticketToUpdate.save();

            console.log(`✅ [DELAYED SAVE] PaymentIntent fetched & saved after ${duration} ms`);
            console.log('📦 [PaymentIntent object]:\n', JSON.stringify(fullSession.payment_intent, null, 2));
          } else {
            console.warn('⚠️ [DELAY] No paymentIntent found even after 5 minutes');
          }
        } catch (delayErr) {
          console.error('❌ [DELAY ERROR] Failed to retrieve or save paymentIntent:', delayErr.message);
        }

      }, 5 * 60 * 1000); // 5 minutes

    } catch (err) {
      console.error('❌ Error processing session completed webhook:', err);
      return res.status(500).send('Internal server error while updating ticket.');
    }
  }

  // Always respond to Stripe right away
  res.status(200).json({ received: true });
};