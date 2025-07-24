require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const ticketRoutes = require('./routes/TicketRoutes');
const timeSlotRoutes = require('./routes/TimeSlotRouter');
const settingRoutes = require('./routes/SettingRouter');
const adminRoutes = require('./routes/AdminRoutes');
const cancelRequestRoutes = require("./routes/cancelRequest");
const emailTicketRoutes = require("./routes/emailTicketRoutes");
const paymentRoutes = require('./routes/PaymentRoutes');
const ticketRefundRoutes = require("./routes/ticketRefundRoutes");
const massRefundRoutes = require("./routes/massRefundRoutes");
const ticketBundelsRoutes = require("./routes/ticketBundelsRoutes");
const walkinRoutes = require('./routes/walkinRoutes');
const webhookController = require('./controllers/webhookController');
const paymentRoute = require('./routes/payment');
const app = express();

// ✅ Stripe webhook route — must come BEFORE express.json middleware
app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), webhookController.handleStripeWebhook);

// 🔧 Standard middleware
app.use(cors());
app.use(express.json()); // ⬅️ Comes AFTER webhook raw middleware

// 🔗 API Routes
app.use('/api/tickets', ticketRoutes);
app.use('/api/timeslots', timeSlotRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/admin', adminRoutes);
app.use("/api/cancel-request", cancelRequestRoutes);
app.use("/api/email-ticket", emailTicketRoutes);
app.use('/api/payment', paymentRoutes);
app.use("/api/refund", ticketRefundRoutes);
app.use("/api/refund", massRefundRoutes); // (same path, different logic?)
app.use('/api/ticketbundels', ticketBundelsRoutes);
app.use('/api/walkin', walkinRoutes);
app.use('/api/payment', paymentRoute);
// 📦 MongoDB Connection + App Start
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ Missing MONGO_URI in .env file');
  process.exit(1);
}

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('✅ MongoDB connected');
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});
