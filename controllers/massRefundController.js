const Ticket = require("../models/Ticket");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.massCancelAndRefundBySlot = async (req, res) => {
  const { date, startTime, endTime } = req.body;

  if (!date || !startTime || !endTime) {
    return res.status(400).json({ message: "Missing date or time range." });
  }

  try {
    const tickets = await Ticket.find({
      date,
      startTime,
      endTime,
      cancelTicket: false,
    });

    console.log(`🔎 [MASS REFUND] Found ${tickets.length} tickets for slot:`, { date, startTime, endTime });

    if (tickets.length === 0) {
      return res.status(200).json({
        message: "No tickets found for the specified date and time slot.",
        refunded: [],
        failed: [],
      });
    }

    const refunded = [];
    const failed = [];

    for (const ticket of tickets) {
      const paymentIntentId = ticket?.metadata?.stripePaymentIntentId;
      console.log(`➡️ [MASS REFUND] Processing ticket: ${ticket.ticketId}, paymentIntentId: ${paymentIntentId}`);

      if (!paymentIntentId || ticket.isCashPayment) {
        const reason = !paymentIntentId
          ? "Missing Stripe paymentIntent ID"
          : "Cash payments can't be refunded through Stripe";
        console.warn(`⚠️ [MASS REFUND] Skipping ticket ${ticket.ticketId}: ${reason}`);
        failed.push({
          ticketId: ticket.ticketId,
          reason,
        });
        continue;
      }

      const subtotal = parseFloat(ticket.subtotal || 0);
      const cancellationFee = parseFloat(ticket.cancellationFee || ticket.addonData?.cancellationFee || 0);
      const refundAmount = Math.max(0, Math.round((subtotal - cancellationFee) * 100)); // cents, non-negative
      console.log(`💸 [MASS REFUND] Attempting refund for ticket ${ticket.ticketId}: refundAmount=${refundAmount} cents (subtotal=${subtotal}, cancellationFee=${cancellationFee})`);

      try {
        const refund = await stripe.refunds.create({
          payment_intent: paymentIntentId,
          amount: refundAmount,
          reason: "requested_by_customer",
          metadata: {
            ticketId: ticket.ticketId,
          },
        });
        console.log(`✅ [MASS REFUND] Refund successful for ticket ${ticket.ticketId}: refundId=${refund.id}`);

        ticket.cancelTicket = true;
        ticket.refundStatus = "refunded";
        ticket.refundedAmount = refundAmount / 100;
        ticket.refundTransactionId = refund.id;
        ticket.refundDate = new Date();
        await ticket.save();

        refunded.push(ticket.ticketId);
      } catch (err) {
        console.error(`❌ [MASS REFUND] Refund failed for ticket ${ticket.ticketId}:`, err?.message || err);
        failed.push({
          ticketId: ticket.ticketId,
          reason: err?.message || "Stripe refund failed",
        });
      }
    }

    console.log('🏁 [MASS REFUND] Refund process complete. Refunded:', refunded, 'Failed:', failed);

    res.status(200).json({
      message: "Mass cancel/refund attempt completed.",
      totalTicketsProcessed: tickets.length,
      refunded,
      failed,
    });
  } catch (err) {
    console.error("❌ [MASS REFUND] Error in mass cancellation:", err);
    res.status(500).json({
      message: "Failed to process mass cancellation and refund.",
      error: err.message,
    });
  }
};
