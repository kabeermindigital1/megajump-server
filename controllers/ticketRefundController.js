const Ticket = require("../models/Ticket");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.cancelAndRefundTicket = async (req, res) => {
  const { ticketId } = req.params;
  console.log(`[REFUND] ➤ Initiating cancel+refund for ticket ID: ${ticketId}`);

  try {
    const ticket = await Ticket.findOne({ ticketId });

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (ticket.refundStatus === "refunded") {
      return res.status(400).json({ message: "Ticket already refunded" });
    }

    if (ticket.isCashPayment) {
      return res.status(400).json({ message: "Cash payments cannot be refunded via Stripe." });
    }

    const paymentIntentId =
      ticket.stripePaymentIntentId || ticket.metadata?.stripePaymentIntentId;

    if (!paymentIntentId) {
      return res.status(400).json({ message: "Missing Stripe paymentIntentId" });
    }

    // ✅ Fetch payment intent to get actual charge amount
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const amountReceived = paymentIntent.amount_received; // in cents

    const cancellationFee = ticket.addonData?.cancellationFee || 0;
    const refundAmountCents = Math.max(0, amountReceived - (cancellationFee * 100));

    if (refundAmountCents <= 0) {
      return res.status(400).json({ message: "Refund amount must be greater than 0" });
    }

    console.log(`[REFUND] ➤ Refunding ${refundAmountCents} cents from paid ${amountReceived} cents...`);

    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: refundAmountCents,
      reason: "requested_by_customer",
      metadata: {
        ticketId: ticket.ticketId,
      },
    });

    ticket.cancelTicket = true;
    ticket.refundedAmount = refundAmountCents / 100;
    ticket.refundStatus = "refunded";
    ticket.refundTransactionId = refund.id;
    ticket.refundDate = new Date();
    await ticket.save();

    console.log(`[REFUND] ✔ Ticket ${ticketId} refunded.`);

    return res.status(200).json({
      message: "Ticket refunded successfully.",
      ticket,
    });
  } catch (error) {
    console.error(`[REFUND] ✘ Refund failed for ${ticketId}:`, error);
    return res.status(500).json({
      message: "Failed to refund ticket. It has NOT been cancelled.",
      error: error?.message || "Unknown error",
    });
  }
};
