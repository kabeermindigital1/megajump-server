const TimeSlot = require("../models/TimeSlot");
const Ticket = require("../models/Ticket");

// Create single time slot
exports.createTimeSlot = async (req, res) => {
  try {
    const slot = new TimeSlot(req.body);
    await slot.save();
    res.status(201).json({ success: true, data: slot });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
// Get time slots by specific date
exports.getTimeSlotsByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const slots = await TimeSlot.find({ date }).sort({ startTime: 1 });
    
    // Get booking statistics for each slot
    const slotsWithBookings = await Promise.all(
      slots.map(async (slot) => {
        // Count total tickets booked for this slot (excluding cancelled/refunded)
        const bookedTickets = await Ticket.aggregate([
          {
            $match: {
              date: slot.date,
              startTime: slot.startTime,
              endTime: slot.endTime,
              cancelTicket: { $ne: true },
              refundStatus: { $nin: ["refunded", "failed"] }
            }
          },
          {
            $group: {
              _id: null,
              totalBooked: { $sum: "$tickets" },
              totalHalfTimeBooked: { $sum: "$halfTimeTickets" },
              totalBundelTickets: { $sum: { $ifNull: ["$selectedBundel.tickets", 0] } }
            }
          }
        ]);

        const bookingStats = bookedTickets[0] || { totalBooked: 0, totalHalfTimeBooked: 0, totalBundelTickets: 0 };
        const totalBooked = bookingStats.totalBooked + bookingStats.totalHalfTimeBooked + bookingStats.totalBundelTickets;
        const availableTickets = slot.maxTickets - totalBooked;

        return {
          _id: slot._id,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          maxTickets: slot.maxTickets,
          totalBooked: totalBooked,
          availableTickets: Math.max(0, availableTickets),
          isFullyBooked: availableTickets <= 0
        };
      })
    );

    // Calculate total bookings across all slots
    const totalBookings = slotsWithBookings.reduce((sum, slot) => sum + slot.totalBooked, 0);

    res.json({
      success: true,
      data: slotsWithBookings,
      totalBookings: totalBookings,
      totalSlots: slotsWithBookings.length
    });
  } catch (err) {
    console.error("❌ Get time slots by date failed:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
// Delete single time slot
exports.deleteTimeSlot = async (req, res) => {
  try {
    const { id } = req.params;
    await TimeSlot.findByIdAndDelete(id);
    res.json({ success: true, message: 'Time slot deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
// Update single time slot
exports.updateTimeSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await TimeSlot.findByIdAndUpdate(id, req.body, { new: true });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Bulk create time slots for weekdays/weekends
exports.bulkCreateSlots = async (req, res) => {
  try {
    const { eventStartDate, eventEndDate, dayType, slots } = req.body;

    if (!eventStartDate || !eventEndDate) {
      return res.status(400).json({ success: false, error: "Missing event dates." });
    }

    console.log("📦 Incoming bulk create payload:");
    console.log("Start Date:", eventStartDate);
    console.log("End Date:", eventEndDate);
    console.log("Day Type:", dayType);
    console.log("Slots:", slots);

    const start = new Date(eventStartDate);
    const end = new Date(eventEndDate);
    const slotDocs = [];

    // Check existing slots for the date range
    const existingSlots = await TimeSlot.find({
      date: {
        $gte: eventStartDate,
        $lte: eventEndDate
      }
    });

    // Group existing slots by date
    const slotsByDate = {};
    existingSlots.forEach(slot => {
      if (!slotsByDate[slot.date]) {
        slotsByDate[slot.date] = [];
      }
      slotsByDate[slot.date].push(slot);
    });

    // Check if we can add new slots
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      const isWeekday = day >= 1 && day <= 5;
      const isWeekend = day === 0 || day === 6;
      const match =
        (dayType === "weekday" && isWeekday) ||
        (dayType === "weekend" && isWeekend);

      if (match) {
        const date = new Date(d).toISOString().split("T")[0];
        const existingSlotsForDate = slotsByDate[date] || [];
        const maxAllowedSlots = dayType === "weekday" ? 6 : 7;
        
        if (existingSlotsForDate.length + slots.length > maxAllowedSlots) {
          return res.status(400).json({ 
            success: false, 
            error: `Cannot create slots. You already have ${existingSlotsForDate.length} slots and trying to add ${slots.length} more. Maximum allowed is ${maxAllowedSlots} slots per day for ${dayType}.` 
          });
        }
      }
    }

    // If validation passes, create the slots
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      const isWeekday = day >= 1 && day <= 5;
      const isWeekend = day === 0 || day === 6;
      const match =
        (dayType === "weekday" && isWeekday) ||
        (dayType === "weekend" && isWeekend);

      if (match) {
        const date = new Date(d).toISOString().split("T")[0];
        for (const slot of slots) {
          slotDocs.push({
            date,
            startTime: slot.startTime,
            endTime: slot.endTime,
            maxTickets: slot.maxTickets,
          });
        }
      }
    }

    console.log("✅ Final documents to insert:", slotDocs.length);

    await TimeSlot.insertMany(slotDocs);
    res.status(201).json({ success: true, count: slotDocs.length });
  } catch (err) {
    console.error("❌ Bulk create failed:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteAllSlots = async (req, res) => {
  try {
    const result = await TimeSlot.deleteMany({});
    res.status(200).json({ success: true, deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteSlotsByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const result = await TimeSlot.deleteMany({ date });
    res.status(200).json({ success: true, deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get all time slots with booking statistics
exports.getAllTimeSlots = async (req, res) => {
  try {
    const { date } = req.query;
    const query = date ? { date } : {};
    
    // Get all time slots
    const slots = await TimeSlot.find(query).sort({ startTime: 1 });
    
    // Get booking statistics for each slot
    const slotsWithBookings = await Promise.all(
      slots.map(async (slot) => {
        // Count total tickets booked for this slot (excluding cancelled/refunded)
        const bookedTickets = await Ticket.aggregate([
          {
            $match: {
              date: slot.date,
              startTime: slot.startTime,
              endTime: slot.endTime,
              cancelTicket: { $ne: true },
              refundStatus: { $nin: ["refunded", "failed"] }
            }
          },
          {
            $group: {
              _id: null,
              totalBooked: { $sum: "$tickets" },
              totalHalfTimeBooked: { $sum: "$halfTimeTickets" },
              totalBundelTickets: { $sum: { $ifNull: ["$selectedBundel.tickets", 0] } }
            }
          }
        ]);

        const bookingStats = bookedTickets[0] || { totalBooked: 0, totalHalfTimeBooked: 0, totalBundelTickets: 0 };
        const totalBooked = bookingStats.totalBooked + bookingStats.totalHalfTimeBooked + bookingStats.totalBundelTickets;
        const availableTickets = slot.maxTickets - totalBooked;

        return {
          _id: slot._id,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          maxTickets: slot.maxTickets,
          totalBooked: totalBooked,
          availableTickets: Math.max(0, availableTickets),
          isFullyBooked: availableTickets <= 0
        };
      })
    );

    // Calculate total bookings across all slots
    const totalBookings = slotsWithBookings.reduce((sum, slot) => sum + slot.totalBooked, 0);

    res.json({
      success: true,
      data: slotsWithBookings,
      totalBookings: totalBookings,
      totalSlots: slotsWithBookings.length
    });
  } catch (err) {
    console.error("❌ Get all time slots failed:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
