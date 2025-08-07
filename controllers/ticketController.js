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

    // Step 6: Validate ticket date and time
    const currentDate = new Date();
    
    // Parse ticket date string (format: YYYY-MM-DD)
    const ticketDateParts = ticket.date.split('-');
    const ticketYear = parseInt(ticketDateParts[0]);
    const ticketMonth = parseInt(ticketDateParts[1]) - 1; // Month is 0-indexed
    const ticketDay = parseInt(ticketDateParts[2]);
    
    const ticketDate = new Date(ticketYear, ticketMonth, ticketDay);
    
    // Reset time to start of day for date comparison
    const currentDateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    const ticketDateOnly = new Date(ticketDate.getFullYear(), ticketDate.getMonth(), ticketDate.getDate());
    
    // Debug logging
    console.log("🔍 Date Validation Debug:", {
      currentDate: currentDate.toISOString(),
      currentDateOnly: currentDateOnly.toISOString(),
      ticketDate: ticket.date,
      ticketDateOnly: ticketDateOnly.toISOString(),
      currentDateOnlyTime: currentDateOnly.getTime(),
      ticketDateOnlyTime: ticketDateOnly.getTime(),
      isBeforeTicketDate: currentDateOnly < ticketDateOnly,
      isAfterTicketDate: currentDateOnly > ticketDateOnly
    });
    
    // Check if scanning before the ticket date
    if (currentDateOnly < ticketDateOnly) {
      console.log("❌ Ticket scanned before valid date");
      return res.status(403).json({ 
        success: false, 
        message: 'This ticket is not valid yet. Please scan on the correct date.',
        error: 'TICKET_DATE_NOT_REACHED',
        ticketId: cleanTicketId,
        ticketDate: ticket.date,
        currentDate: currentDateOnly.toISOString().split('T')[0]
      });
    }
    
    // Check if scanning after the ticket date
    if (currentDateOnly > ticketDateOnly) {
      console.log("❌ Ticket scanned after valid date");
      return res.status(403).json({ 
        success: false, 
        message: 'This ticket has expired. It was only valid for the specified date.',
        error: 'TICKET_DATE_EXPIRED',
        ticketId: cleanTicketId,
        ticketDate: ticket.date,
        currentDate: currentDateOnly.toISOString().split('T')[0]
      });
    }
    
    // Check if scanning more than 30 minutes after start time (only if it's the correct date)
    if (currentDateOnly.getTime() === ticketDateOnly.getTime()) {
      const startTimeParts = ticket.startTime.split(':');
      const startHour = parseInt(startTimeParts[0]);
      const startMinute = parseInt(startTimeParts[1]);
      
      // Create ticket start time by combining the ticket date with the start time
      // This ensures we're working in the local timezone
      const ticketStartTime = new Date(ticketYear, ticketMonth, ticketDay, startHour, startMinute, 0, 0);
      
      // Get current time
      const currentLocalTime = new Date();
      
      // Calculate 30 minutes after start time
      const thirtyMinutesAfterStart = new Date(ticketStartTime.getTime() + (30 * 60 * 1000));
      
      console.log("🔍 Time Validation Debug:", {
        startTime: ticket.startTime,
        startHour: startHour,
        startMinute: startMinute,
        ticketStartTime: ticketStartTime.toISOString(),
        ticketStartTimeLocal: ticketStartTime.toLocaleString(),
        thirtyMinutesAfterStart: thirtyMinutesAfterStart.toISOString(),
        thirtyMinutesAfterStartLocal: thirtyMinutesAfterStart.toLocaleString(),
        currentDate: currentDate.toISOString(),
        currentLocalTime: currentLocalTime.toLocaleString(),
        timeDifference: currentLocalTime.getTime() - ticketStartTime.getTime(),
        timeDifferenceMinutes: Math.floor((currentLocalTime.getTime() - ticketStartTime.getTime()) / (1000 * 60)),
        isLate: currentLocalTime > thirtyMinutesAfterStart
      });
      
      if (currentLocalTime > thirtyMinutesAfterStart) {
        console.log("❌ Ticket scanned too late");
        return res.status(403).json({ 
          success: false, 
          message: 'You are late! Your ticket has expired. Please arrive on time for your booking.',
          error: 'TICKET_TIME_EXPIRED',
          ticketId: cleanTicketId,
          ticketDate: ticket.date,
          startTime: ticket.startTime,
          currentTime: currentLocalTime.toLocaleTimeString(),
          expiredAt: thirtyMinutesAfterStart.toLocaleTimeString()
        });
      }
    }

    // Step 7: Mark ticket as used
    ticket.isUsed = true;
    await ticket.save();

    console.log("✅ Ticket Verified Successfully:", {
      ticketId: cleanTicketId,
      customerName: `${ticket.name} ${ticket.surname}`,
      date: ticket.date,
      time: `${ticket.startTime} - ${ticket.endTime}`
    });

    // Step 8: Return success response with complete ticket details
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
    // Check if request body exists
    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: "Request body is missing or invalid",
        error: 'MISSING_REQUEST_BODY'
      });
    }
    
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

    // Step 4: Check if ticket is cancelled
    if (ticket.cancelTicket) {
      return res.status(403).json({
        success: false,
        message: "Cannot send email for cancelled ticket",
        error: 'TICKET_CANCELLED'
      });
    }

    // Step 5: Convert base64 to buffer and save temporarily
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const tempFileName = `ticket_${ticketId}_${Date.now()}.pdf`;
    const tempFilePath = `uploads/${tempFileName}`;
    
    const fs = require('fs');
    fs.writeFileSync(tempFilePath, pdfBuffer);

    // Step 6: Send email using nodemailer with iPhone-compatible settings
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // Use TLS
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false
      },
      // iPhone-compatible settings
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateLimit: 14, // Limit to 14 emails per second
    });

    // SIMPLIFIED EMAIL FOR TESTING - ONLY TICKET ID
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Mega Jump Ticket</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h1 style="color: #2196F3; text-align: center; margin-bottom: 30px;">🎫 Mega Jump Ticket</h1>
          
          <h2 style="color: #333; margin-bottom: 20px;">Hello ${ticket.name || 'there'}!</h2>
          
                      <p style="color: #666; line-height: 1.6; font-size: 16px; margin-bottom: 20px;">
              Your Mega Jump ticket is ready! Please find your ticket attached to this email.
            </p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
            <h3 style="margin-top: 0; color: #333;">Ticket Details:</h3>
            <p style="margin: 8px 0; font-size: 16px;"><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
            <p style="margin: 8px 0; font-size: 16px;"><strong>Date:</strong> ${ticket.date}</p>
            <p style="margin: 8px 0; font-size: 16px;"><strong>Time:</strong> ${ticket.startTime} - ${ticket.endTime}</p>
            <p style="margin: 8px 0; font-size: 16px;"><strong>Number of Tickets:</strong> ${ticket.tickets}</p>
            <p style="margin: 8px 0; font-size: 16px;"><strong>Total Amount:</strong> €${ticket.subtotal}</p>
          </div>
          
                      <p style="color: #666; line-height: 1.6; font-size: 16px; margin-bottom: 20px;">
              <strong>Important:</strong> Please keep this ticket safe and present it at the entrance. 
              You can either print it or show it on your mobile device.
            </p>
          
          <div style="background: #e8f4fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #0056b3; font-size: 16px;">
              <strong>📍 Location:</strong> Mega Jump Trampoline Park<br>
              <strong>📞 Contact:</strong> For any questions, please contact us
            </p>
          </div>
          
          <p style="color: #666; line-height: 1.6; font-size: 16px; margin-bottom: 20px;">
            We hope you have an amazing time at Mega Jump! 🎉
          </p>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
            <p style="color: #999; font-size: 14px; margin: 0;">
              Best regards,<br>
              The Mega Jump Team
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Mega Jump Ticket

Hello ${ticket.name || 'there'}!

Your Mega Jump ticket is ready! Please find your ticket attached to this email.

Ticket Details:
- Ticket ID: ${ticket.ticketId}
- Date: ${ticket.date}
- Time: ${ticket.startTime} - ${ticket.endTime}
- Number of Tickets: ${ticket.tickets}
- Total Amount: €${ticket.subtotal}

Important: Please keep this ticket safe and present it at the entrance. 
You can either print it or show it on your mobile device.

Location: Mega Jump Trampoline Park
Contact: For any questions, please contact us

We hope you have an amazing time at Mega Jump!

Best regards,
The Mega Jump Team
    `;

    const mailOptions = {
      from: `"Mega Jump" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🎫 Your Mega Jump Ticket - Ready for Download!",
      text: textContent,
      html: htmlContent,
      // COMMENTED OUT FOR TESTING - NO PDF ATTACHMENT
      attachments: [
        {
          filename: `MegaJump_Ticket_${ticketId}.pdf`,
          path: tempFilePath,
          contentType: 'application/pdf',
        },
      ],
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high',
        'X-Mailer': 'MegaJump-Ticket-System'
      }
    };

    await transporter.sendMail(mailOptions);

    // Step 7: Log the email send
    const EmailLog = require('../models/EmailLog');
    await EmailLog.create({
      email: email,
      name: ticket.name || '',
      ticketId: ticketId,
      status: "SENT",
      retryCount: 0,
      isRetry: false,
    });

    // Step 8: Clean up temporary file
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
      if (req.body && req.body.ticketId && req.body.pdfBase64) {
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
        email: req.body?.email || '',
        name: req.body?.name || '',
        ticketId: req.body?.ticketId || '',
        status: "FAILED",
        error: error.message,
        retryCount: 0,
        isRetry: false,
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



// ✅ GET EMAIL STATISTICS - For admin monitoring
exports.getEmailStats = async (req, res) => {
  try {
    const EmailLog = require('../models/EmailLog');
    const emailRetryService = require('../services/emailRetryService');
    
    // Get stats from the retry service
    const stats = await emailRetryService.getEmailStats();
    
    // Get recent email logs
    const recentLogs = await EmailLog.find()
      .sort({ sentAt: -1 })
      .limit(20);
    
    // Get failed emails that need attention
    const failedEmails = await EmailLog.find({ 
      status: 'FAILED',
      sentAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    }).sort({ sentAt: -1 });
    
    res.json({
      success: true,
      data: {
        stats,
        recentLogs,
        failedEmails,
        serviceStatus: {
          isRunning: emailRetryService.isRunning,
          lastCheck: new Date()
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Get Email Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get email statistics',
      error: error.message
    });
  }
};

// ✅ MANUAL RETRY EMAIL - For admin to manually retry failed emails
exports.retryFailedEmail = async (req, res) => {
  try {
    const { ticketId } = req.body;
    
    if (!ticketId) {
      return res.status(400).json({
        success: false,
        message: 'Ticket ID is required',
        error: 'MISSING_TICKET_ID'
      });
    }
    
    const ticket = await Ticket.findOne({ ticketId: ticketId.trim() });
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
        error: 'TICKET_NOT_FOUND'
      });
    }
    
    const emailRetryService = require('../services/emailRetryService');
    const emailSent = await emailRetryService.sendRetryEmail(ticket);
    
    if (emailSent) {
      // Log successful retry
      const EmailLog = require('../models/EmailLog');
      await EmailLog.create({
        email: ticket.email,
        name: ticket.name || '',
        ticketId: ticket.ticketId,
        status: 'SENT',
        retryCount: 1,
        isRetry: true,
      });
      
      res.json({
        success: true,
        message: 'Retry email sent successfully',
        data: {
          ticketId: ticket.ticketId,
          email: ticket.email,
          sentAt: new Date()
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send retry email',
        error: 'EMAIL_SEND_FAILED'
      });
    }
    
  } catch (error) {
    console.error('❌ Retry Email Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retry email',
      error: error.message
    });
  }
};

