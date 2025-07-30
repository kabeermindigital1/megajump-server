const Ticket = require('../models/Ticket');
const TimeSlot = require('../models/TimeSlot');
const { v4: uuidv4 } = require('uuid');

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

// ✅ VERIFY TICKET (QR SCAN)
exports.verifyTicket = async (req, res) => {
  console.log("Request Body:", req.body);
  try {
    const { ticketId } = req.body;

    if (!ticketId) {
      return res.status(400).json({ success: false, message: 'ticketId is required' });
    }

    const ticket = await Ticket.findOne({ ticketId: ticketId.trim() });

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    if (ticket.cancelTicket) {
      return res.status(403).json({ success: false, message: 'Ticket is cancelled and cannot be used' });
    }

    if (ticket.isUsed) {
      return res.status(409).json({ success: false, message: 'Ticket has already been used' });
    }

    ticket.isUsed = true;
    await ticket.save();

    console.log("Ticket Data Sent:", ticket); // ✅ See full data in terminal

    res.json({ success: true, message: 'Ticket verified and marked as used', ticket });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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

