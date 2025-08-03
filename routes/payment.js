const express = require('express');
const Stripe = require('stripe');
const Ticket = require('../models/Ticket'); // Make sure this path is correct
require('dotenv').config();

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-04-10',
});

// GET /api/verify-payment?sessionId=cs_...
router.get('/verify-payment', async (req, res) => {
  const sessionId = req.query.sessionId;

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Stripe session not found' });
    }

    const paymentStatus = session.payment_status;
    const ticketId = session.metadata?.ticketId;
    const paymentIntentId = session.payment_intent;

    console.log('🔍 Verifying payment...');
    console.log('➡️ Session ID:', sessionId);
    console.log('➡️ Payment Status:', paymentStatus);
    console.log('➡️ Payment Intent ID:', paymentIntentId);
    console.log('➡️ Ticket ID (from metadata):', ticketId);

    if (paymentStatus === 'paid' && ticketId) {
        const ticket = await Ticket.findById(ticketId);
      
        if (!ticket) {
          console.warn('⚠️ Ticket not found for ID:', ticketId);
          return res.status(404).json({ error: 'Ticket not found' });
        }
      
        ticket.paymentStatus = 'paid';
        ticket.metadata = ticket.metadata || {};
        ticket.metadata.stripePaymentIntentId = paymentIntentId;
        ticket.metadata.stripeSessionId = sessionId; // Store session ID for sync service
      
        await ticket.save();
      
        console.log('✅ Ticket updated successfully in DB');
      } else if (ticketId) {
        // Store session ID even for unpaid tickets for sync service
        const ticket = await Ticket.findById(ticketId);
        
        if (ticket) {
          ticket.metadata = ticket.metadata || {};
          ticket.metadata.stripeSessionId = sessionId;
          await ticket.save();
          console.log('📝 Session ID stored for ticket:', ticketId);
        }
      }

    return res.json({
      success: true,
      paymentStatus,
      ticketId,
      paymentIntentId,
    });
  } catch (err) {
    console.error('❌ Error verifying payment:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
