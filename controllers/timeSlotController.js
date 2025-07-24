const TimeSlot = require("../models/TimeSlot");

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
    const slots = await TimeSlot.find({ date });
    // console.log(slots);
    res.json({ success: true, data: slots });
  } catch (err) {
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
