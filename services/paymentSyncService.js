const Stripe = require('stripe');
const Ticket = require('../models/Ticket');
require('dotenv').config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-04-10',
});

class PaymentSyncService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.lastRun = null;
  }

  // Start the recurring service
  start() {
    if (this.isRunning) {
      console.log('🔄 Payment Sync Service is already running');
      return;
    }

    console.log('🚀 Starting Payment Sync Service...');
    this.isRunning = true;

    // Run immediately on start
    this.syncPayments();

    // Schedule to run every 3 minutes
    this.scheduleRecurringSync();
  }

  // Schedule recurring sync every 3 minutes
  scheduleRecurringSync() {
    const THREE_MINUTES = 3 * 60 * 1000; // 3 minutes in milliseconds
    
    console.log(`📅 Payment sync scheduled to run every 3 minutes`);
    console.log(`⏰ Next sync in: 3 minutes`);

    // Schedule the recurring sync
    this.intervalId = setInterval(() => {
      this.syncPayments();
    }, THREE_MINUTES);
  }

  // Stop the recurring service
  stop() {
    if (!this.isRunning) {
      console.log('🔄 Payment Sync Service is not running');
      return;
    }

    console.log('⏹️ Stopping Payment Sync Service...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // Main sync function
  async syncPayments() {
    try {
      console.log('🔍 Payment Sync Service: Checking for incomplete payments...');
      this.lastRun = new Date();

      // Find tickets that have session ID but no payment intent ID
      const incompleteTickets = await Ticket.find({
        'metadata.stripeSessionId': { $exists: true, $ne: null },
        $or: [
          { 'metadata.stripePaymentIntentId': { $exists: false } },
          { 'metadata.stripePaymentIntentId': null },
          { 'metadata.stripePaymentIntentId': '' }
        ]
      });

      console.log(`📊 Found ${incompleteTickets.length} tickets with incomplete payment data`);

      if (incompleteTickets.length === 0) {
        console.log('✅ All payments are up to date');
        return;
      }

      // Process each incomplete ticket
      for (const ticket of incompleteTickets) {
        await this.processIncompleteTicket(ticket);
      }

      console.log('✅ Payment sync completed');

    } catch (error) {
      console.error('❌ Payment Sync Service Error:', error);
    }
  }

  // Process a single incomplete ticket
  async processIncompleteTicket(ticket) {
    try {
      const sessionId = ticket.metadata?.stripeSessionId;
      
      if (!sessionId) {
        console.log(`⚠️ Ticket ${ticket.ticketId} has no session ID`);
        return;
      }

      console.log(`🔄 Processing ticket ${ticket.ticketId} with session ${sessionId}`);

      // Retrieve session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (!session) {
        console.log(`❌ Session ${sessionId} not found in Stripe for ticket ${ticket.ticketId}`);
        return;
      }

      const paymentStatus = session.payment_status;
      const paymentIntentId = session.payment_intent;

      console.log(`📊 Session ${sessionId} - Status: ${paymentStatus}, Payment Intent: ${paymentIntentId}`);

      // Update ticket with payment information
      if (paymentIntentId) {
        ticket.metadata = ticket.metadata || {};
        ticket.metadata.stripePaymentIntentId = paymentIntentId;
        
        if (paymentStatus === 'paid') {
          ticket.paymentStatus = 'paid';
          console.log(`✅ Ticket ${ticket.ticketId} marked as paid`);
        } else if (paymentStatus === 'unpaid') {
          ticket.paymentStatus = 'pending';
          console.log(`⏳ Ticket ${ticket.ticketId} payment pending`);
        }

        await ticket.save();
        console.log(`✅ Updated ticket ${ticket.ticketId} with payment intent ${paymentIntentId}`);
      } else {
        console.log(`⚠️ No payment intent found for session ${sessionId}`);
      }

    } catch (error) {
      console.error(`❌ Error processing ticket ${ticket.ticketId}:`, error.message);
    }
  }

  // Manual sync function (can be called from API)
  async manualSync() {
    console.log('🔄 Manual payment sync triggered');
    await this.syncPayments();
  }

  // Get service status
  getStatus() {
    const nextRun = this.isRunning && this.lastRun ? 
      new Date(this.lastRun.getTime() + (3 * 60 * 1000)) : null;

    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      nextRun: nextRun,
      schedule: 'Every 3 minutes'
    };
  }
}

// Create singleton instance
const paymentSyncService = new PaymentSyncService();

module.exports = paymentSyncService; 