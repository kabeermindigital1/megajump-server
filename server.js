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
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/tickets', ticketRoutes);
app.use('/api/timeslots', timeSlotRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/admin', adminRoutes);
app.use("/api/cancel-request", cancelRequestRoutes);
app.use("/api/email-ticket", emailTicketRoutes);
app.use('/api/payment', paymentRoutes);
// DB Connection + Server Start
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
