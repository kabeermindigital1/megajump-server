const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Ticket = require('../models/Ticket');
const facebookConversionsService = require('../services/facebookConversionsService');

exports.handleStripeWebhook = async (req, res) => {
  console.log('🚦 [WEBHOOK] Endpoint hit');
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    console.log('✅ [WEBHOOK] Stripe event constructed:', event.type);
  } catch (err) {
    console.error('❌ [WEBHOOK] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const ticketId = session.metadata?.ticketId;
    if (!ticketId) {
      console.error('❌ [WEBHOOK] No ticketId in session metadata');
      return res.status(400).send('Missing ticket ID.');
    }

    try {
      const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['payment_intent'],
      });

      const paymentIntentId = fullSession.payment_intent?.id;
      console.log('💳 [WEBHOOK] Retrieved payment_intent ID:', paymentIntentId);

      const ticket = await Ticket.findById(ticketId);
      if (!ticket) {
        console.error('❌ [WEBHOOK] Ticket not found for ID:', ticketId);
        return res.status(404).send('Ticket not found.');
      }

      ticket.paymentStatus = 'paid';
      ticket.metadata.stripeSessionId = session.id;
      if (paymentIntentId) {
        ticket.metadata.stripePaymentIntentId = paymentIntentId;
      }

      await ticket.save();
      console.log('✅ [WEBHOOK] Ticket updated:', ticket);

      // Send Facebook conversion event for successful payment
      try {
        const ticketData = {
          ticketId: ticket.ticketId,
          email: ticket.email,
          phone: ticket.phone,
          subtotal: ticket.subtotal,
          currency: 'EUR',
          eventId: `purchase_${ticket.ticketId}_${Date.now()}`,
          eventTime: Math.floor(Date.now() / 1000)
        };

        await facebookConversionsService.sendPurchaseEvent(ticketData);
        console.log('✅ [WEBHOOK] Facebook conversion event sent successfully');
      } catch (facebookError) {
        console.error('⚠️ [WEBHOOK] Facebook conversion event failed (non-blocking):', facebookError.message);
        // Don't fail the webhook if Facebook tracking fails
      }

    } catch (err) {
      console.error('❌ [WEBHOOK] Failed to update ticket:', err);
      return res.status(500).send('Server error.');
    }
  }

  res.status(200).json({ received: true });
};
