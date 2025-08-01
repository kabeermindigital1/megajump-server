const Ticket = require('../models/Ticket');
const TimeSlot = require('../models/TimeSlot');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose'); // Added for mongoose connection check

// ✅ Create ticket with slot availability check
exports.createTicket = async (req, res) => {
  try {
    const {
      date,
      startTime,
      endTime,
      tickets: requestedTickets,
    } = req.body;

    // Step 1: Validate required fields
    if (!date || !startTime || !endTime || !requestedTickets) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: date, startTime, endTime, or tickets",
      });
    }

    // Step 2: Find the matching time slot
    const slot = await TimeSlot.findOne({ date, startTime, endTime });
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: "Time slot not found for the given date and time range.",
      });
    }

    // Step 3: Check how many tickets already sold for this slot
    const existingTickets = await Ticket.aggregate([
      {
        $match: {
          date,
          startTime,
          endTime,
          cancelTicket: false,
        },
      },
      {
        $group: {
          _id: null,
          totalSold: { $sum: "$tickets" },
        },
      },
    ]);

    const ticketsAlreadySold = existingTickets[0]?.totalSold || 0;
    const remainingTickets = slot.maxTickets - ticketsAlreadySold;

    // Step 4: Check if requested number of tickets can be booked
    if (requestedTickets > remainingTickets) {
      return res.status(400).json({
        success: false,
        message: `Only ${remainingTickets} tickets left in this slot. Cannot book ${requestedTickets}.`,
        remaining: remainingTickets,
      });
    }

    // Step 5: Create a unique ticket ID (short & readable)
    const shortId = uuidv4().split('-')[0].toUpperCase(); // e.g., "AB12CD"
    const ticketId = `MJX-${shortId}`;

    // Step 6: Create ticket
    const newTicket = new Ticket({
      ...req.body,
      ticketId,
      qrCodeData: ticketId, // You can also embed more data if needed
    });

    await newTicket.save();

    return res.status(201).json({
      success: true,
      message: "Ticket booked successfully.",
      data: newTicket,
    });
  } catch (error) {
    console.error("Error creating ticket:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while processing the ticket.",
      error: error.message,
    });
  }
};
// Hardcoded admin credentials (for now)
const ADMIN_EMAIL = 'admin';
const ADMIN_PASSWORD = '123456'; // Replace with env or hash check in production

exports.deleteAllTicketsWithAuth = async (req, res) => {
  const { email, password } = req.body;

  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: '❌ Invalid admin credentials.' });
  }

  try {
    const result = await Ticket.deleteMany({});
    res.json({ success: true, message: `✅ Deleted ${result.deletedCount} tickets.` });
  } catch (err) {
    res.status(500).json({ success: false, message: '❌ Failed to delete tickets.', error: err.message });
  }
};

// ✅ Get all tickets
exports.getAllTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find().sort({ createdAt: -1 });
    res.json({ success: true, data: tickets });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ✅ Cancel ticket (update flag only if allowed)
exports.cancelTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const canCancel =
      ticket.cancellationEnabled || ticket.addonData?.cancellationEnabled;

    if (!canCancel) {
      return res.status(403).json({ success: false, message: 'Cancellation not allowed for this ticket' });
    }

    if (ticket.cancelTicket) {
      return res.status(400).json({ success: false, message: 'Ticket already cancelled' });
    }

    ticket.cancelTicket = true;
    await ticket.save();

    res.json({ success: true, message: 'Ticket cancelled successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ✅ VERIFY TICKET (QR SCAN) - IMPROVED VERSION
exports.verifyTicket = async (req, res) => {
  console.log("🔍 Verify Ticket Request Body:", req.body);
  
  try {
    // Step 1: Validate request body
    if (!req.body) {
      return res.status(400).json({ 
        success: false, 
        message: 'Request body is missing',
        error: 'INVALID_REQUEST_BODY'
      });
    }

    const { ticketId } = req.body;

    // Step 2: Validate ticketId parameter
    if (!ticketId) {
      return res.status(400).json({ 
        success: false, 
        message: 'ticketId is required',
        error: 'MISSING_TICKET_ID'
      });
    }

    if (typeof ticketId !== 'string' || ticketId.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'ticketId must be a non-empty string',
        error: 'INVALID_TICKET_ID_FORMAT'
      });
    }

    const cleanTicketId = ticketId.trim();

    // Step 3: Check database connection
    if (mongoose.connection.readyState !== 1) {
      console.error("❌ Database not connected. Ready state:", mongoose.connection.readyState);
      return res.status(503).json({ 
        success: false, 
        message: 'Database connection unavailable',
        error: 'DATABASE_CONNECTION_ERROR'
      });
    }

    // Step 4: Find ticket with timeout
    const ticket = await Promise.race([
      Ticket.findOne({ ticketId: cleanTicketId }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database query timeout')), 10000)
      )
    ]);

    if (!ticket) {
      return res.status(404).json({ 
        success: false, 
        message: 'Ticket not found',
        error: 'TICKET_NOT_FOUND',
        ticketId: cleanTicketId
      });
    }

    // Step 5: Validate ticket status
    if (ticket.cancelTicket) {
      return res.status(403).json({ 
        success: false, 
        message: 'Ticket is cancelled and cannot be used',
        error: 'TICKET_CANCELLED',
        ticketId: cleanTicketId
      });
    }

    if (ticket.isUsed) {
      return res.status(409).json({ 
        success: false, 
        message: 'Ticket has already been used',
        error: 'TICKET_ALREADY_USED',
        ticketId: cleanTicketId,
        usedAt: ticket.updatedAt
      });
    }

    // Step 6: Mark ticket as used
    ticket.isUsed = true;
    await ticket.save();

    console.log("✅ Ticket Verified Successfully:", {
      ticketId: cleanTicketId,
      customerName: `${ticket.name} ${ticket.surname}`,
      date: ticket.date,
      time: `${ticket.startTime} - ${ticket.endTime}`
    });

    // Step 7: Return success response with complete ticket details
    res.json({ 
      success: true, 
      message: 'Ticket verified and marked as used',
      ticket: {
        ticketId: ticket.ticketId,
        name: ticket.name,
        surname: ticket.surname,
        email: ticket.email,
        phone: ticket.phone,
        date: ticket.date,
        startTime: ticket.startTime,
        endTime: ticket.endTime,
        tickets: ticket.tickets,
        
        subtotal: ticket.subtotal,
        administrationFee: ticket.administrationFee,
         
        cancellationEnabled: ticket.cancellationEnabled,
      
        addonData: ticket.addonData,
        bundelSelected: ticket.bundelSelected,
        selectedBundel: ticket.selectedBundel,
        isCashPayment: ticket.isCashPayment,
        paymentStatus: ticket.paymentStatus,
        paymentMethod: ticket.paymentMethod,
        isUsed: ticket.isUsed,
        verifiedAt: new Date()
      }
    });

  } catch (error) {
    console.error("❌ Verify Ticket Error:", error);
    
    // Handle specific error types
    if (error.message === 'Database query timeout') {
      return res.status(504).json({ 
        success: false, 
        message: 'Request timeout - please try again',
        error: 'REQUEST_TIMEOUT'
      });
    }

    if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      return res.status(503).json({ 
        success: false, 
        message: 'Database service temporarily unavailable',
        error: 'DATABASE_ERROR'
      });
    }

    // Generic error response
    res.status(500).json({ 
      success: false, 
      message: 'An unexpected error occurred while verifying the ticket',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

// ✅ ANALYTICS - Get consolidated ticket sales information
exports.getTicketAnalytics = async (req, res) => {
  try {
    const { period = 'all' } = req.query; // 'all', 'today', 'week', 'month'
    
    let dateFilter = {};
    const now = new Date();
    
    if (period === 'today') {
      const today = now.toISOString().split('T')[0];
      dateFilter = { date: today };
    } else if (period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = { createdAt: { $gte: weekAgo } };
    } else if (period === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      dateFilter = { createdAt: { $gte: monthAgo } };
    }

    // Get all tickets with filter (including cancelled/refunded tickets)
    const tickets = await Ticket.find({ ...dateFilter });

    // Calculate analytics
    const analytics = {
      period: period,
      totalSales: 0,           // Number of sales (records)
      totalTickets: 0,         // Total individual tickets sold
      totalSocks: 0,
      totalRevenue: 0,         // Total revenue from subtotal
      totalProfit: 0,          // Calculated profit
      bundleSales: 0,          // Number of sales with bundles
      cashPayments: 0,
      cardPayments: 0,
      dailyBreakdown: {},
      weeklyBreakdown: {},
      monthlyBreakdown: {},
      bundleBreakdown: {},
      paymentMethodBreakdown: {},
      topSellingDates: [],
      averageTicketPrice: 0,
      averageSaleValue: 0,
      totalRefunds: 0,
      refundedAmount: 0,
      usedTickets: 0,
      unusedTickets: 0
    };

    // Process each ticket (each record = 1 sale)
    tickets.forEach(ticket => {
      // Count this as 1 sale
      analytics.totalSales += 1;
      
      // Calculate total tickets from this sale
      const regularTickets = ticket.tickets || 0;
      const bundleTickets = ticket.selectedBundel?.tickets || 0;
      const totalTicketsInSale = regularTickets + bundleTickets;
      
      analytics.totalTickets += totalTicketsInSale;
      analytics.totalSocks += ticket.socksCount || 0;
      analytics.totalRevenue += ticket.subtotal || 0;  // Use subtotal for revenue
      
      // Calculate profit (assuming 70% profit margin - adjust as needed)
      const saleProfit = (ticket.subtotal || 0) * 0.7;
      analytics.totalProfit += saleProfit;
      
      // Bundle sales (count sales that have bundles)
      if (ticket.selectedBundel) {
        analytics.bundleSales += 1;
        const bundleName = ticket.selectedBundel.name;
        analytics.bundleBreakdown[bundleName] = (analytics.bundleBreakdown[bundleName] || 0) + 1;
      }
      
      // Payment methods
      if (ticket.isCashPayment) {
        analytics.cashPayments += 1;
      } else {
        analytics.cardPayments += 1;
      }
      
      // Daily breakdown
      const date = ticket.date;
      if (!analytics.dailyBreakdown[date]) {
        analytics.dailyBreakdown[date] = {
          sales: 0,        // Number of sales
          tickets: 0,      // Total tickets
          socks: 0,
          revenue: 0,
          profit: 0,
          bundles: 0
        };
      }
      analytics.dailyBreakdown[date].sales += 1;
      analytics.dailyBreakdown[date].tickets += totalTicketsInSale;
      analytics.dailyBreakdown[date].socks += ticket.socksCount || 0;
      analytics.dailyBreakdown[date].revenue += ticket.subtotal || 0;
      analytics.dailyBreakdown[date].profit += saleProfit;
      if (ticket.selectedBundel) {
        analytics.dailyBreakdown[date].bundles += 1;
      }
      
      // Weekly breakdown
      const ticketDate = new Date(ticket.date);
      const weekStart = new Date(ticketDate);
      weekStart.setDate(ticketDate.getDate() - ticketDate.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!analytics.weeklyBreakdown[weekKey]) {
        analytics.weeklyBreakdown[weekKey] = {
          weekStart: weekKey,
          sales: 0,
          tickets: 0,
          socks: 0,
          revenue: 0,
          profit: 0,
          bundles: 0,
          averageDailySales: 0
        };
      }
      analytics.weeklyBreakdown[weekKey].sales += 1;
      analytics.weeklyBreakdown[weekKey].tickets += totalTicketsInSale;
      analytics.weeklyBreakdown[weekKey].socks += ticket.socksCount || 0;
      analytics.weeklyBreakdown[weekKey].revenue += ticket.subtotal || 0;
      analytics.weeklyBreakdown[weekKey].profit += saleProfit;
      if (ticket.selectedBundel) {
        analytics.weeklyBreakdown[weekKey].bundles += 1;
      }
      
      // Monthly breakdown
      const monthKey = `${ticketDate.getFullYear()}-${String(ticketDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!analytics.monthlyBreakdown[monthKey]) {
        analytics.monthlyBreakdown[monthKey] = {
          month: monthKey,
          sales: 0,
          tickets: 0,
          socks: 0,
          revenue: 0,
          profit: 0,
          bundles: 0,
          averageDailySales: 0,
          averageWeeklySales: 0
        };
      }
      analytics.monthlyBreakdown[monthKey].sales += 1;
      analytics.monthlyBreakdown[monthKey].tickets += totalTicketsInSale;
      analytics.monthlyBreakdown[monthKey].socks += ticket.socksCount || 0;
      analytics.monthlyBreakdown[monthKey].revenue += ticket.subtotal || 0;
      analytics.monthlyBreakdown[monthKey].profit += saleProfit;
      if (ticket.selectedBundel) {
        analytics.monthlyBreakdown[monthKey].bundles += 1;
      }
      
      // Refunds (check refundStatus properly - include cancelled tickets)
      if (ticket.refundStatus === 'refunded') {
        analytics.totalRefunds += 1;
        analytics.refundedAmount += ticket.refundedAmount || 0;
      }
      
      // Used tickets (count individual tickets, not sales) - only for non-cancelled tickets
      if (!ticket.cancelTicket) {
        if (ticket.isUsed) {
          analytics.usedTickets += totalTicketsInSale;
        } else {
          analytics.unusedTickets += totalTicketsInSale;
        }
      }
    });

    // Calculate averages and additional metrics
    if (analytics.totalSales > 0) {
      analytics.averageSaleValue = analytics.totalRevenue / analytics.totalSales;
    }
    if (analytics.totalTickets > 0) {
      analytics.averageTicketPrice = analytics.totalRevenue / analytics.totalTickets;
    }

    // Calculate weekly averages
    Object.keys(analytics.weeklyBreakdown).forEach(weekKey => {
      const week = analytics.weeklyBreakdown[weekKey];
      week.averageDailySales = week.sales / 7;
    });

    // Calculate monthly averages
    Object.keys(analytics.monthlyBreakdown).forEach(monthKey => {
      const month = analytics.monthlyBreakdown[monthKey];
      const daysInMonth = new Date(monthKey.split('-')[0], monthKey.split('-')[1], 0).getDate();
      month.averageDailySales = month.sales / daysInMonth;
      month.averageWeeklySales = month.sales / 4.33; // Average weeks per month
    });

    // Get top selling dates (by number of tickets)
    const dailyArray = Object.entries(analytics.dailyBreakdown)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => b.tickets - a.tickets)
      .slice(0, 10);
    
    analytics.topSellingDates = dailyArray;

    // Payment method breakdown
    analytics.paymentMethodBreakdown = {
      cash: analytics.cashPayments,
      card: analytics.cardPayments,
      total: analytics.cashPayments + analytics.cardPayments
    };

    // Convert breakdowns to arrays for easier frontend consumption
    analytics.dailyBreakdownArray = Object.entries(analytics.dailyBreakdown)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    analytics.weeklyBreakdownArray = Object.entries(analytics.weeklyBreakdown)
      .map(([weekKey, data]) => ({ weekKey, ...data }))
      .sort((a, b) => new Date(a.weekKey) - new Date(b.weekKey));

    analytics.monthlyBreakdownArray = Object.entries(analytics.monthlyBreakdown)
      .map(([monthKey, data]) => ({ monthKey, ...data }))
      .sort((a, b) => new Date(a.monthKey) - new Date(b.monthKey));

    // Bundle breakdown array
    analytics.bundleBreakdownArray = Object.entries(analytics.bundleBreakdown)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error("Error getting ticket analytics:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching analytics.",
      error: error.message
    });
  }
};

// ✅ SEND TICKET VIA EMAIL - Send ticket PDF to purchaser
exports.sendTicketEmail = async (req, res) => {
  try {
    const { email, ticketId, pdfBase64 } = req.body;

    // Step 1: Validate required fields
    if (!email || !ticketId || !pdfBase64) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: email, ticketId, or pdfBase64",
        error: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Step 2: Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
        error: 'INVALID_EMAIL_FORMAT'
      });
    }

    // Step 3: Find the ticket in database
    const ticket = await Ticket.findOne({ ticketId: ticketId.trim() });
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
        error: 'TICKET_NOT_FOUND',
        ticketId: ticketId
      });
    }

    // Step 4: Verify email matches ticket purchaser (optional security check)
    if (ticket.email && ticket.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: "Email does not match ticket purchaser",
        error: 'EMAIL_MISMATCH'
      });
    }

    // Step 5: Check if ticket is cancelled
    if (ticket.cancelTicket) {
      return res.status(403).json({
        success: false,
        message: "Cannot send email for cancelled ticket",
        error: 'TICKET_CANCELLED'
      });
    }

    // Step 6: Convert base64 to buffer and save temporarily
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const tempFileName = `ticket_${ticketId}_${Date.now()}.pdf`;
    const tempFilePath = `uploads/${tempFileName}`;
    
    const fs = require('fs');
    fs.writeFileSync(tempFilePath, pdfBuffer);

    // Step 7: Send email using nodemailer
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransporter({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"Mega Jump" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🎫 Your Mega Jump Ticket - Ready for Download!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center; color: white;">
            <h1 style="margin: 0;">🎫 Mega Jump Ticket</h1>
          </div>
          
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333;">Hello ${ticket.name || 'there'}!</h2>
            
            <p style="color: #666; line-height: 1.6;">
              Your Mega Jump ticket is ready! Please find your ticket attached to this email.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
              <h3 style="margin-top: 0; color: #333;">Ticket Details:</h3>
              <p><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
              <p><strong>Date:</strong> ${ticket.date}</p>
              <p><strong>Time:</strong> ${ticket.startTime} - ${ticket.endTime}</p>
              <p><strong>Number of Tickets:</strong> ${ticket.tickets}</p>
              <p><strong>Total Amount:</strong> €${ticket.subtotal}</p>
            </div>
            
            <p style="color: #666; line-height: 1.6;">
              <strong>Important:</strong> Please keep this ticket safe and present it at the entrance. 
              You can either print it or show it on your mobile device.
            </p>
            
            <div style="background: #e8f4fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #0056b3;">
                <strong>📍 Location:</strong> Mega Jump Trampoline Park<br>
                <strong>📞 Contact:</strong> For any questions, please contact us
              </p>
            </div>
            
            <p style="color: #666; line-height: 1.6;">
              We hope you have an amazing time at Mega Jump! 🎉
            </p>
            
            <p style="color: #999; font-size: 14px; margin-top: 30px;">
              Best regards,<br>
              The Mega Jump Team
            </p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `MegaJump_Ticket_${ticketId}.pdf`,
          path: tempFilePath,
        },
      ],
    };

    await transporter.sendMail(mailOptions);

    // Step 8: Log the email send
    const EmailLog = require('../models/EmailLog');
    await EmailLog.create({
      email: email,
      name: ticket.name || '',
      ticketId: ticketId,
      status: "SENT",
    });

    // Step 9: Clean up temporary file
    fs.unlinkSync(tempFilePath);

    console.log("✅ Ticket Email Sent Successfully:", {
      ticketId: ticketId,
      email: email,
      customerName: `${ticket.name} ${ticket.surname}`
    });

    res.json({
      success: true,
      message: "Ticket email sent successfully",
      data: {
        ticketId: ticketId,
        email: email,
        sentAt: new Date()
      }
    });

  } catch (error) {
    console.error("❌ Send Ticket Email Error:", error);
    
    // Clean up temp file if it exists
    try {
      const fs = require('fs');
      if (req.body.ticketId && req.body.pdfBase64) {
        const tempFileName = `ticket_${req.body.ticketId}_${Date.now()}.pdf`;
        const tempFilePath = `uploads/${tempFileName}`;
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    } catch (cleanupError) {
      console.error("Cleanup error:", cleanupError);
    }

    // Log the failure
    try {
      const EmailLog = require('../models/EmailLog');
      await EmailLog.create({
        email: req.body.email || '',
        name: req.body.name || '',
        ticketId: req.body.ticketId || '',
        status: "FAILED",
        error: error.message,
      });
    } catch (logError) {
      console.error("Failed to log email error:", logError);
    }

    res.status(500).json({
      success: false,
      message: "Failed to send ticket email",
      error: error.message
    });
  }
};

